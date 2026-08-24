/**
 * Публікує базові вироби, засіяні seed.ts.
 *
 * Навіщо окремим кроком: `isPublished` за замовчуванням false, і це правильно —
 * виріб має зʼявитися на вітрині свідомо, а не тому що хтось запустив сід.
 * Але поки немає жодного опублікованого виробу, seed-catalog не створює
 * `PrintGarmentRule`, а без них принти показуються без ціни й без можливості
 * замовити. Тому після першого сіду цей крок обовʼязковий.
 *
 * Запуск: pnpm --filter @dt/api run db:publish:garments
 */

import { PrismaClient } from '@prisma/client';

const SLUGS = ['futbolka-klasychna-nasha', 'futbolka-klasychna-native-spirit'];

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const { count } = await prisma.garment.updateMany({
    where: { slug: { in: SLUGS }, isPublished: false },
    data: { isPublished: true },
  });

  const published = await prisma.garment.findMany({
    where: { isPublished: true },
    select: { slug: true, basePriceMinor: true },
    orderBy: { slug: 'asc' },
  });

  console.info(`опубліковано нових: ${count} · усього опублікованих: ${published.length}`);
  for (const garment of published) {
    console.info(`  ${garment.slug} — ${(garment.basePriceMinor / 100).toFixed(2)} грн`);
  }
}

main()
  .catch((error: unknown) => { console.error(error); process.exitCode = 1; })
  .finally(() => void prisma.$disconnect());
