import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Який сайт обслуговується прямо зараз.
 *
 * Зберігається в `AsyncLocalStorage`, а не передається параметром через усі
 * сервіси. Причина не в зручності: параметр можна забути передати, і саме це
 * рано чи пізно станеться в одному з сотні місць. Контекст, навпаки, або є
 * на весь ланцюжок викликів, або його немає взагалі — і тоді запит падає.
 *
 * `AsyncLocalStorage` переживає `await`: значення лишається тим самим у всіх
 * продовженнях, породжених усередині `run`, і не змішується між паралельними
 * запитами. Це рівно те, чого не дає звичайна змінна модуля.
 */

export interface SiteContext {
  readonly siteId: string;
  readonly key: string;
  readonly modules: readonly string[];
}

const storage = new AsyncLocalStorage<SiteContext>();

export function runWithSite<T>(context: SiteContext, fn: () => T): T {
  return storage.run(context, fn);
}

export function currentSite(): SiteContext | undefined {
  return storage.getStore();
}

/**
 * Сайт або помилка. Повідомлення навмисно довге: коли це спрацює, людина
 * дивитиметься на стек із глибини Prisma й потребуватиме не «no site», а
 * пояснення, що саме забули зробити.
 */
export function requireSiteId(model = 'запису', operation = 'операції'): string {
  const site = storage.getStore();
  if (!site) {
    throw new Error(
      `Звернення до ${model}.${operation} поза контекстом сайту. `
      + 'Кожен запит до таблиці вмісту мусить знати, якому сайту належать дані. '
      + 'У HTTP-запиті контекст ставить SiteMiddleware; у скрипті — обгорніть '
      + 'роботу в runWithSite(). Без цього запит віддав би дані всіх сайтів одразу.',
    );
  }
  return site.siteId;
}
