import type { BlockList } from '@dt/contracts';

/**
 * Перевірка SEO по тому, що вже лежить у базі.
 *
 * Чисті функції, без Prisma: усе вирішується з аргументів, тож перевірки
 * можна ганяти в тестах десятками, а не дивитися на живий сайт.
 *
 * Що це і чого це не є. Це не «оцінка оптимізації» й не бали зі ста — такі
 * цифри не означають нічого. Це перелік конкретних дефектів, кожен з яких
 * має адресу, причину й дію: заголовок, який Google обріже посеред слова;
 * дві сторінки з однаковим заголовком, з яких пошук покаже одну; посилання
 * в тексті на сторінку, якої немає.
 *
 * Межі взяті з того, як виглядає видача, а не з рекомендацій: приблизно 60
 * символів заголовка й 160 опису — це те, після чого рядок обрізається.
 */

export const TITLE_MAX = 60;
export const TITLE_MIN = 15;
export const DESCRIPTION_MAX = 160;
export const DESCRIPTION_MIN = 70;

export type SeoLevel = 'error' | 'warning' | 'info';

export interface SeoFinding {
  readonly level: SeoLevel;
  readonly code: string;
  /** Що саме не так — формулювання для людини, а не назва правила. */
  readonly message: string;
  /** Що з цим робити. Порожньо, коли дія очевидна з повідомлення. */
  readonly fix: string;
  readonly pageId: string | null;
  readonly pageTitle: string;
  readonly pageSlug: string;
}

export interface AuditPage {
  readonly id: string;
  readonly slug: string;
  readonly kind: 'PAGE' | 'ARTICLE' | 'SYSTEM';
  readonly isPublished: boolean;
  readonly title: string;
  readonly seoTitle: string;
  readonly seoDescription: string;
  readonly excerpt: string;
  readonly noindex: boolean;
  readonly blocks: BlockList;
}

export interface AuditWorld {
  readonly pages: readonly AuditPage[];
  readonly allowIndexing: boolean;
  readonly brand: string;
  /** Адреси, які існують у каталозі: щоб ловити посилання в нікуди. */
  readonly printSlugs: ReadonlySet<string>;
  readonly breedSlugs: ReadonlySet<string>;
  readonly collectionSlugs: ReadonlySet<string>;
}

/** Маршрути сайту без параметра. Посилання на них завжди дійсне. */
const STATIC_ROUTES: ReadonlySet<string> = new Set([
  '/', '/prints', '/collections', '/vyroby', '/zayavka', '/search', '/statti',
]);

/** Заголовок, який реально побачить пошук. */
function effectiveTitle(page: AuditPage, brand: string): string {
  return page.seoTitle.trim() !== '' ? page.seoTitle : `${page.title} — ${brand}`;
}

function effectiveDescription(page: AuditPage): string {
  return page.seoDescription.trim() !== '' ? page.seoDescription : page.excerpt;
}

/** Усі адреси з блоків сторінки: кнопки, посилання в тексті, картинки. */
export function linksOf(blocks: BlockList): string[] {
  const out: string[] = [];
  const walk = (value: unknown, key: string): void => {
    if (typeof value === 'string') {
      if (key === 'href') out.push(value);
      for (const m of value.matchAll(/\[[^\]]+\]\(([^)\s]+)\)/g)) {
        const href = m[1];
        if (href !== undefined) out.push(href);
      }
      return;
    }
    if (Array.isArray(value)) { for (const v of value) walk(v, key); return; }
    if (value !== null && typeof value === 'object') {
      for (const [k, v] of Object.entries(value)) walk(v, k);
    }
  };
  walk(blocks, 'blocks');
  return out;
}

/** Картинки з блоків разом із підписом — щоб знайти порожні `alt`. */
function imagesOf(blocks: BlockList): Array<{ url: string; alt: string }> {
  const out: Array<{ url: string; alt: string }> = [];
  const walk = (value: unknown): void => {
    if (Array.isArray(value)) { for (const v of value) walk(v); return; }
    if (value !== null && typeof value === 'object') {
      const row = value as Record<string, unknown>;
      if (typeof row['url'] === 'string' && 'alt' in row) {
        out.push({ url: row['url'], alt: String(row['alt'] ?? '') });
      }
      for (const v of Object.values(row)) walk(v);
    }
  };
  walk(blocks);
  return out;
}

/**
 * Чи веде внутрішнє посилання кудись.
 *
 * Зовнішні адреси, пошта, телефони й якорі не перевіряємо: якір може
 * вказувати на блок сусідньої сторінки, а перевірити чужий сайт звідси
 * неможливо, і «схоже, недоступний» у списку дефектів — це шум.
 */
export function resolvesInternally(href: string, world: AuditWorld): boolean | null {
  if (!href.startsWith('/')) return null;

  const path = (href.split('#')[0] ?? '').split('?')[0] ?? '';
  if (path === '' || STATIC_ROUTES.has(path)) return true;

  const parts = path.split('/').filter((p) => p !== '');
  const [head, tail] = parts;
  if (head === undefined) return true;

  if (parts.length === 1) {
    return world.pages.some((p) => p.slug === head && p.isPublished);
  }
  if (tail === undefined) return true;

  switch (head) {
    case 'prints': return world.printSlugs.has(tail);
    case 'breeds': return world.breedSlugs.has(tail);
    case 'collections': return world.collectionSlugs.has(tail);
    case 'statti': return world.pages.some((p) => p.slug === tail && p.kind === 'ARTICLE' && p.isPublished);
    // Чужі розділи (`/admin`, `/order/...`) не перевіряємо.
    default: return null;
  }
}

export function auditSeo(world: AuditWorld): SeoFinding[] {
  const findings: SeoFinding[] = [];
  const published = world.pages.filter((p) => p.isPublished);

  const add = (
    level: SeoLevel, code: string, message: string, fix: string, page: AuditPage | null,
  ): void => {
    findings.push({
      level, code, message, fix,
      pageId: page?.id ?? null,
      pageTitle: page?.title ?? 'Сайт',
      pageSlug: page?.slug ?? '',
    });
  };

  if (!world.allowIndexing) {
    add(
      'info',
      'INDEXING_OFF',
      'Індексацію вимкнено: сайт закритий від пошуку.',
      'Це нормально, доки немає домену й остаточної назви. Вмикається в налаштуваннях.',
      null,
    );
  }

  // ── дублікати ──────────────────────────────────────────────────────────────
  const byTitle = new Map<string, AuditPage[]>();
  const byDescription = new Map<string, AuditPage[]>();
  for (const page of published) {
    const t = effectiveTitle(page, world.brand).trim().toLowerCase();
    byTitle.set(t, [...(byTitle.get(t) ?? []), page]);
    const d = effectiveDescription(page).trim().toLowerCase();
    if (d !== '') byDescription.set(d, [...(byDescription.get(d) ?? []), page]);
  }

  for (const [, group] of byTitle) {
    if (group.length < 2) continue;
    const others = group.map((p) => `/${p.slug}`).join(', ');
    for (const page of group) {
      add(
        'error', 'DUPLICATE_TITLE',
        'Такий самий заголовок уже є на іншій сторінці.',
        `Пошук покаже одну з них і сховає решту. Однакові: ${others}.`,
        page,
      );
    }
  }

  for (const [, group] of byDescription) {
    if (group.length < 2) continue;
    for (const page of group) {
      add(
        'warning', 'DUPLICATE_DESCRIPTION',
        'Опис дослівно повторює опис іншої сторінки.',
        'Опис — це рядок під заголовком у видачі; однаковий текст не дає причини клікнути саме сюди.',
        page,
      );
    }
  }

  // ── посторінково ───────────────────────────────────────────────────────────
  for (const page of published) {
    const title = effectiveTitle(page, world.brand);
    const description = effectiveDescription(page);

    if (title.length > TITLE_MAX) {
      add(
        'warning', 'TITLE_TOO_LONG',
        `Заголовок ${title.length} символів — довший за ${TITLE_MAX}.`,
        'Google обріже його посеред слова. Найважливіше має стояти на початку.',
        page,
      );
    } else if (title.trim().length < TITLE_MIN) {
      add(
        'warning', 'TITLE_TOO_SHORT',
        `Заголовок ${title.trim().length} символів — це майже нічого.`,
        'Додайте те, що людина шукає: виріб, породу, місто.',
        page,
      );
    }

    if (description.trim() === '') {
      add(
        'error', 'NO_DESCRIPTION',
        'Немає опису для пошуку.',
        'Google складе рядок сам із випадкового місця сторінки. Заповніть «опис» або «короткий опис».',
        page,
      );
    } else if (description.length > DESCRIPTION_MAX) {
      add(
        'warning', 'DESCRIPTION_TOO_LONG',
        `Опис ${description.length} символів — довший за ${DESCRIPTION_MAX}.`,
        'Хвіст обріжеться. Перевірте, що заклик стоїть не в кінці.',
        page,
      );
    } else if (description.trim().length < DESCRIPTION_MIN) {
      add(
        'info', 'DESCRIPTION_SHORT',
        `Опис короткий — ${description.trim().length} символів.`,
        `До ${DESCRIPTION_MAX} є місце сказати ще щось корисне.`,
        page,
      );
    }

    if (page.noindex) {
      add(
        'warning', 'PAGE_NOINDEX',
        'Сторінка опублікована, але закрита від пошуку.',
        'Якщо це навмисно — усе гаразд. Якщо ні, зніміть галочку «не показувати в пошуку».',
        page,
      );
    }

    // H1 у звичайної сторінки малює блок героя. У матеріала заголовок малює
    // сам маршрут, тож там перевіряти нема чого.
    if (page.kind !== 'ARTICLE' && !page.blocks.some((b) => b.type === 'hero')) {
      add(
        'warning', 'NO_H1',
        'На сторінці немає блока «Герой» — отже, немає головного заголовка.',
        'Сторінка без H1 гірше зрозуміла і пошуку, і читачам з екранного диктора.',
        page,
      );
    }

    if (page.blocks.length === 0) {
      add('error', 'EMPTY_PAGE', 'Сторінка опублікована порожньою.', 'Додайте блоки або зніміть із публікації.', page);
    }

    for (const image of imagesOf(page.blocks)) {
      if (image.alt.trim() !== '') continue;
      add(
        'warning', 'IMAGE_NO_ALT',
        'Картинка без опису.',
        'Опис читають екранні диктори й пошук по картинках. Заповнюється в медіатеці — один раз на файл.',
        page,
      );
      break; // одного попередження на сторінку досить, решта — той самий дефект
    }

    for (const href of linksOf(page.blocks)) {
      if (resolvesInternally(href, world) === false) {
        add(
          'error', 'BROKEN_LINK',
          `Посилання «${href}» веде в нікуди.`,
          'Такої сторінки немає. Людина побачить 404, а пошук — сигнал, що за сайтом не стежать.',
          page,
        );
      }
    }
  }

  const order: Readonly<Record<SeoLevel, number>> = { error: 0, warning: 1, info: 2 };
  return findings.sort((a, b) => order[a.level] - order[b.level] || a.code.localeCompare(b.code));
}
