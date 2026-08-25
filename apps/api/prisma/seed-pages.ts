/**
 * Переносить сторінки з коду в базу.
 *
 * Це і є гейт першого етапу: якщо сторінка не складається з наявних блоків —
 * набір блоків неправильний, і дізнатися це треба зараз, а не після того, як
 * під нього написано двадцять форм в адмінці.
 *
 * Ідемпотентний і обережний: якщо сторінку вже редагували в адмінці (є
 * чернетка або опублікована версія, створена людиною), сідер її НЕ чіпає.
 * Інакше повторний запуск скрипта одного дня мовчки затер би тижневу роботу.
 *
 * Запуск: pnpm --filter @dt/api run db:seed:pages
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { BlockList } from '@dt/contracts';
import { MARKETING_PAGES, type PageSeed } from './pages/marketing';

const prisma = new PrismaClient();

/** Той самий банер, що й у сідері асортименту: куди саме ми пишемо. */
function targetSummary(): string {
  const raw = process.env['DATABASE_URL'] ?? '';
  if (raw === '') return 'DATABASE_URL не задано';
  try {
    const url = new URL(raw);
    return `${url.hostname}${url.pathname}`;
  } catch {
    return 'нерозбірливий DATABASE_URL';
  }
}

interface LegalDoc {
  title: string;
  seoTitle: string;
  seoDescription: string;
  blocks: unknown[];
}

/**
 * Юридичні сторінки згенеровані конвертером із наявного JSX — див.
 * `pages/legal.json`. Ручне переписування 21 розділу й 70 пунктів гарантовано
 * внесло б помилку в документ, на який посилається закон.
 */
function legalSeeds(): PageSeed[] {
  const raw = readFileSync(join(__dirname, 'pages', 'legal.json'), 'utf8');
  const docs = JSON.parse(raw) as Record<string, LegalDoc>;

  return Object.entries(docs).map(([slug, doc]) => {
    const parsed = BlockList.safeParse(doc.blocks);
    if (!parsed.success) {
      throw new Error(`legal.json → ${slug}: блоки не проходять схему.\n${parsed.error.message}`);
    }
    return {
      slug,
      kind: 'SYSTEM' as const,
      isSystem: true,
      title: doc.title,
      excerpt: '',
      seoTitle: doc.seoTitle,
      seoDescription: doc.seoDescription,
      blocks: parsed.data,
    };
  });
}

async function upsertPage(seed: PageSeed): Promise<'створено' | 'оновлено' | 'пропущено'> {
  // Схему перевіряємо ще раз, уже на боці сідера: сторінка з блоком, який не
  // проходить контракт, не має потрапити в базу навіть із нашого ж коду.
  const blocks = BlockList.parse(seed.blocks);

  const existing = await prisma.page.findUnique({
    where: { locale_slug: { locale: 'UK', slug: seed.slug } },
    select: { id: true, versions: { select: { id: true, number: true, authorId: true, status: true } } },
  });

  if (existing) {
    // Людина вже щось із цією сторінкою робила — не чіпаємо.
    const touchedByHuman = existing.versions.some((v) => v.authorId !== null);
    if (touchedByHuman) return 'пропущено';

    const next = Math.max(0, ...existing.versions.map((v) => v.number)) + 1;
    await prisma.$transaction([
      prisma.pageVersion.updateMany({
        where: { pageId: existing.id, status: { in: ['DRAFT', 'PUBLISHED'] } },
        data: { status: 'ARCHIVED' },
      }),
      prisma.pageVersion.create({
        data: {
          pageId: existing.id, number: next, status: 'PUBLISHED',
          title: seed.title, excerpt: seed.excerpt,
          seoTitle: seed.seoTitle, seoDescription: seed.seoDescription,
          blocks, note: 'перенесення з коду',
        },
      }),
    ]);
    return 'оновлено';
  }

  await prisma.page.create({
    data: {
      slug: seed.slug, kind: seed.kind, locale: 'UK', isSystem: seed.isSystem,
      publishedAt: new Date(),
      versions: {
        create: {
          number: 1, status: 'PUBLISHED',
          title: seed.title, excerpt: seed.excerpt,
          seoTitle: seed.seoTitle, seoDescription: seed.seoDescription,
          blocks, note: 'перенесення з коду',
        },
      },
    },
  });
  return 'створено';
}

async function main(): Promise<void> {
  console.info(`база: ${targetSummary()}`);

  const seeds: PageSeed[] = [...legalSeeds(), ...MARKETING_PAGES];
  const report: string[] = [];

  for (const seed of seeds) {
    const result = await upsertPage(seed);
    report.push(`  ${result.padEnd(10)} /${seed.slug}  ${seed.blocks.length} блоків  «${seed.title}»`);
  }

  console.info('');
  console.info(`сторінок у наборі: ${seeds.length}`);
  for (const line of report) console.info(line);

  const skipped = report.filter((r) => r.includes('пропущено')).length;
  if (skipped > 0) {
    console.warn('');
    console.warn(`⚠ ${skipped} сторінок пропущено: їх уже редагували в адмінці, і сідер не перетирає ручну роботу.`);
  }
}

main()
  .catch((error: unknown) => { console.error(error); process.exitCode = 1; })
  .finally(() => void prisma.$disconnect());
