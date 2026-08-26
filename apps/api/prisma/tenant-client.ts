import { PrismaClient } from '@prisma/client';
import { runWithSite } from '../src/common/site-context';
import { withTenancy, type TenantClient } from '../src/common/tenancy';

/**
 * Клієнт із ізоляцією для скриптів.
 *
 * Сідери працюють поза HTTP, тож контекст сайту їм ніхто не поставить —
 * і без нього кожен запит до таблиці вмісту одразу впаде. Це навмисно:
 * скрипт мусить сказати, з яким сайтом він працює, а не зробити щось
 * «взагалі» й потрапити не туди.
 *
 * Сайт береться за ключем: `SITE_KEY` з оточення або `primary`.
 */
export async function withSite<T>(
  fn: (db: TenantClient, siteId: string) => Promise<T>,
): Promise<T> {
  const raw = new PrismaClient();
  const db = withTenancy(raw);
  const key = process.env['SITE_KEY'] ?? 'primary';

  try {
    // `Site` — таблиця спільна, тож читається без контексту.
    const site = await db.site.findUnique({
      where: { key },
      select: { id: true, key: true, modules: true },
    });
    if (!site) {
      throw new Error(
        `Сайту з ключем «${key}» немає. Перевірте, що міграції накочені: `
        + 'сайт створює міграція 20260825230000_sites. '
        + 'Інший сайт — задайте SITE_KEY.',
      );
    }
    return await runWithSite(
      { siteId: site.id, key: site.key, modules: site.modules },
      () => fn(db, site.id),
    );
  } finally {
    await raw.$disconnect();
  }
}
