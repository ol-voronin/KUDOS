import type { PrismaClient } from '@prisma/client';
import { requireSiteId } from './site-context';

/**
 * Примусова ізоляція даних між сайтами.
 *
 * Розширення Prisma додає `siteId` у кожен запит до таблиць вмісту. Сенс не
 * в економії рядків — фільтр можна написати й руками. Сенс у тому, що
 * написати його неможливо забути: без контексту сайту запит не доходить до
 * бази, а падає з поясненням.
 *
 * Це та частина системи, де ціна помилки — не «незручно», а «клієнт побачив
 * чужі дані». Тому механізм такий, що помилка неможлива, а не малоймовірна.
 *
 * Чого воно НЕ покриває, і про це треба знати:
 *
 *   · сирі запити (`$queryRaw`, `$executeRaw`) — розширення бачить тільки
 *     операції над моделями. Сирий SQL до таблиць вмісту писати не можна;
 *     сьогодні їх два, обидва до `_prisma_migrations` і `Size`.
 *   · вкладене створення (`page.create({ versions: { create: … } })`) —
 *     розширення бачить лише верхній рівень. Тут рятує схема: `siteId`
 *     обовʼязковий і без значення за замовчуванням, тож вкладене створення
 *     без нього не компілюється.
 */

/** Таблиці, які належать конкретному сайту. */
export const TENANT_MODELS: ReadonlySet<string> = new Set([
  'Page', 'PageVersion', 'MediaAsset', 'Redirect', 'PageBreed', 'PageCollection',
  'SiteSettings', 'MenuItem', 'AnalyticsEvent', 'ConversionAction',
]);

/**
 * Таблиці, спільні для всієї установки, — перелічені явно.
 *
 * Це не документація, а запобіжник. Модель, якої немає в жодному з двох
 * списків, валить перший же запит до себе: тоді додавання таблиці змушує
 * свідомо відповісти «вона чия?», а не мовчки лишитися глобальною.
 *
 * Каталог поки тут. Він стане орендним тоді, коли зʼявиться другий клієнт
 * із магазином, — і це буде окреме рішення, а не забута дрібниця.
 */
export const GLOBAL_MODELS: ReadonlySet<string> = new Set([
  'Site', 'SiteMember', 'AdminUser', 'AuditLog',
  'Fabric', 'Colour', 'FabricColour', 'Garment', 'GarmentFabric', 'Size',
  'Measurement', 'Variant', 'Collection', 'Breed', 'Print', 'PrintImage',
  'PrintCollection', 'PrintBreed', 'PrintGarmentRule', 'PrintGarmentExclusion', 'PrintColourExclusion',
  'PrintPrice', 'PriceModifier', 'Discount',
  'Customer', 'Order', 'Payment', 'OrderItem', 'CustomRequest', 'Lead',
]);

type Args = Record<string, unknown>;

/**
 * Аргументи одного виклику Prisma.
 *
 * Описані тут, а не взяті з типів згенерованого клієнта, свідомо: цей файл —
 * межа з бібліотекою, і він не повинен ламатися від того, що згенерований
 * клієнт ще не зібрано. `model` необовʼязковий, бо в типах Prisma він саме
 * такий, хоча під `$allModels` завжди присутній.
 */
interface OperationParams {
  model?: string;
  operation: string;
  args: unknown;
  query: (args: unknown) => Promise<unknown>;
}

/** Додає належність сайту в аргументи операції. */
function scope(operation: string, raw: unknown, siteId: string): unknown {
  const args = (raw ?? {}) as Args;
  const withWhere = (): Args => ({ ...args, where: { ...((args['where'] ?? {}) as Args), siteId } });

  switch (operation) {
    case 'create':
      return { ...args, data: { ...((args['data'] ?? {}) as Args), siteId } };

    case 'createMany': {
      const data = args['data'];
      return {
        ...args,
        data: Array.isArray(data)
          ? data.map((row) => ({ ...(row as Args), siteId }))
          : { ...((data ?? {}) as Args), siteId },
      };
    }

    case 'upsert':
      return {
        ...args,
        where: { ...((args['where'] ?? {}) as Args), siteId },
        create: { ...((args['create'] ?? {}) as Args), siteId },
      };

    // Читання й зміни за умовою. `findUnique` тут теж приймає зайве поле:
    // з Prisma 5 у `where` можна класти неунікальні поля — вони працюють як
    // додатковий фільтр. Саме це дозволяє не переписувати сотню викликів.
    case 'findUnique': case 'findUniqueOrThrow':
    case 'findFirst': case 'findFirstOrThrow':
    case 'findMany': case 'count': case 'aggregate': case 'groupBy':
    case 'update': case 'updateMany': case 'delete': case 'deleteMany':
      return withWhere();

    default:
      // Невідома операція — краще впасти, ніж пропустити її без фільтра.
      throw new Error(
        `Операція ${operation} не описана в ізоляції сайтів. `
        + 'Додайте її в scope() у tenancy.ts і переконайтеся, що вона обмежена сайтом.',
      );
  }
}

export function withTenancy(client: PrismaClient) {
  return client.$extends({
    name: 'site-tenancy',
    query: {
      $allModels: {
        $allOperations({ model, operation, args, query }: OperationParams) {
          if (model === undefined) return query(args);
          if (!TENANT_MODELS.has(model)) {
            if (!GLOBAL_MODELS.has(model)) {
              throw new Error(
                `Модель ${model} не віднесена ні до орендних, ні до спільних. `
                + 'Додайте її у TENANT_MODELS (дані належать сайту) або в '
                + 'GLOBAL_MODELS (спільні для всієї установки) у tenancy.ts.',
              );
            }
            return query(args);
          }
          return query(scope(operation, args, requireSiteId(model, operation)));
        },
      },
    },
  });
}

/** Клієнт із ізоляцією — тип, який бачать сервіси. */
export type TenantClient = ReturnType<typeof withTenancy>;

/**
 * Клієнт усередині транзакції.
 *
 * Виводиться з `TenantClient`, а не береться з `Prisma.TransactionClient`.
 * Різниця принципова: всередині транзакції має працювати той самий клієнт із
 * підстановкою `siteId`. Написаний руками тип `Prisma.TransactionClient`
 * описує сирий клієнт — тобто рівно те, від чого ми пішли, і при цьому
 * виглядає правильно.
 */
export type TransactionClient = Parameters<Parameters<TenantClient['$transaction']>[0]>[0];
