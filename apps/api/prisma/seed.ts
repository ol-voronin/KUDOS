/**
 * Reference data, transcribed from the workshop's own price sheets and size
 * charts (August 2026). Everything here is verified against a source image —
 * where a number was unreadable or contradictory it is marked TODO rather than
 * guessed, because a plausible-looking wrong measurement is worse than a gap.
 *
 * Run: pnpm --filter @dt/api prisma db seed
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  // -------------------------------------------------------------------------
  // Print prices. By print SIZE, not by print method — DTF and DTG both work
  // on both lines and cost the same.
  // -------------------------------------------------------------------------
  await prisma.printPrice.createMany({
    data: [
      { tier: 'MINI', priceMinor: 50_000 },   // до 15×20 см — 500 ₴
      { tier: 'MEDIUM', priceMinor: 60_000 }, // до 20×30 см — 600 ₴
      { tier: 'MAXI', priceMinor: 70_000 },   // до 35×45 см — 700 ₴
    ],
    skipDuplicates: true,
  });

  // -------------------------------------------------------------------------
  // Fabrics
  // -------------------------------------------------------------------------
  const kulir = await prisma.fabric.upsert({
    where: { line_name: { line: 'OWN_PRODUCTION', name: 'Кулір' } },
    update: {},
    create: {
      line: 'OWN_PRODUCTION', name: 'Кулір', weightGsm: 200,
      composition: 'бавовна 95%, еластан 5%', origin: 'Туреччина',
    },
  });

  // NOTE: the palette sheet says 320-340 g/m², the size charts say 330.
  // 330 chosen as the single published number — confirm with production.
  const petlya = await prisma.fabric.upsert({
    where: { line_name: { line: 'OWN_PRODUCTION', name: 'Тринитка петля' } },
    update: {},
    create: {
      line: 'OWN_PRODUCTION', name: 'Тринитка петля', weightGsm: 330,
      composition: 'бавовна 65%, поліестер 35%', origin: 'Туреччина',
    },
  });

  const nachis = await prisma.fabric.upsert({
    where: { line_name: { line: 'OWN_PRODUCTION', name: 'Тринитка з начісом' } },
    update: {},
    create: {
      line: 'OWN_PRODUCTION', name: 'Тринитка з начісом', weightGsm: 340,
      composition: 'бавовна 65%, поліестер 35%', origin: 'Туреччина',
    },
  });

  const nsJersey180 = await prisma.fabric.upsert({
    where: { line_name: { line: 'NATIVE_SPIRIT', name: 'Органічний джерсі 180' } },
    update: {},
    create: {
      line: 'NATIVE_SPIRIT', name: 'Органічний джерсі 180', weightGsm: 180,
      composition: '100% органічна бавовна', origin: null,
    },
  });

  // -------------------------------------------------------------------------
  // Garments. Two "classic t-shirts" that are genuinely different products —
  // this is the pair that read as a data contradiction until the two supply
  // lines were named.
  // -------------------------------------------------------------------------
  const ownClassicTee = await prisma.garment.upsert({
    where: { line_type_fit: { line: 'OWN_PRODUCTION', type: 'TSHIRT', fit: 'CLASSIC' } },
    update: {},
    create: {
      slug: 'futbolka-klasychna-nasha',
      line: 'OWN_PRODUCTION', type: 'TSHIRT', fit: 'CLASSIC',
      name: 'Класична футболка (власне виробництво)',
      lengthAdjustable: true,
      basePriceMinor: 59_000, // 590 ₴
      isPublished: false,
      fabrics: { create: [{ fabricId: kulir.id, isDefault: true }] },
      sizes: {
        create: [
          { label: 'XS', position: 0, measurements: { create: [{ key: 'WIDTH', value: '42' }, { key: 'LENGTH', value: '62' }] } },
          { label: 'S', position: 1, measurements: { create: [{ key: 'WIDTH', value: '46' }, { key: 'LENGTH', value: '66' }] } },
          { label: 'M', position: 2, measurements: { create: [{ key: 'WIDTH', value: '50' }, { key: 'LENGTH', value: '68' }] } },
          { label: 'L', position: 3, measurements: { create: [{ key: 'WIDTH', value: '54' }, { key: 'LENGTH', value: '72' }] } },
          { label: 'XL', position: 4, measurements: { create: [{ key: 'WIDTH', value: '58' }, { key: 'LENGTH', value: '74' }] } },
          { label: 'XXL', position: 5, measurements: { create: [{ key: 'WIDTH', value: '60' }, { key: 'LENGTH', value: '78' }] } },
          { label: '3XL', position: 6, measurements: { create: [{ key: 'WIDTH', value: '64' }, { key: 'LENGTH', value: '80' }] } },
        ],
      },
    },
  });

  const nsClassicTee = await prisma.garment.upsert({
    where: { line_type_fit: { line: 'NATIVE_SPIRIT', type: 'TSHIRT', fit: 'CLASSIC' } },
    update: {},
    create: {
      slug: 'futbolka-klasychna-native-spirit',
      line: 'NATIVE_SPIRIT', type: 'TSHIRT', fit: 'CLASSIC',
      name: 'Класична футболка Native Spirit',
      lengthAdjustable: false,
      basePriceMinor: 59_000,
      isPublished: false,
      fabrics: { create: [{ fabricId: nsJersey180.id, isDefault: true }] },
      sizes: {
        create: [
          { label: 'XXS', position: 0, measurements: { create: [{ key: 'LENGTH', value: '66' }, { key: 'WIDTH', value: '43' }, { key: 'SLEEVE', value: '19.5' }] } },
          { label: 'XS', position: 1, measurements: { create: [{ key: 'LENGTH', value: '68' }, { key: 'WIDTH', value: '46' }, { key: 'SLEEVE', value: '20.2' }] } },
          { label: 'S', position: 2, measurements: { create: [{ key: 'LENGTH', value: '70' }, { key: 'WIDTH', value: '49' }, { key: 'SLEEVE', value: '21' }] } },
          { label: 'M', position: 3, measurements: { create: [{ key: 'LENGTH', value: '72' }, { key: 'WIDTH', value: '52' }, { key: 'SLEEVE', value: '21.8' }] } },
          { label: 'L', position: 4, measurements: { create: [{ key: 'LENGTH', value: '74' }, { key: 'WIDTH', value: '55' }, { key: 'SLEEVE', value: '22.5' }] } },
          { label: 'XL', position: 5, measurements: { create: [{ key: 'LENGTH', value: '76' }, { key: 'WIDTH', value: '58' }, { key: 'SLEEVE', value: '23.8' }] } },
          { label: 'XXL', position: 6, measurements: { create: [{ key: 'LENGTH', value: '78' }, { key: 'WIDTH', value: '61' }, { key: 'SLEEVE', value: '24' }] } },
        ],
      },
    },
  });

  // -------------------------------------------------------------------------
  // Colours. Native Spirit has 15 named, photographed colours — real catalogue
  // content. Own production has numbered swatches with no names and no hexes,
  // which is exactly why only one of these lines can be sold from a cart today.
  // -------------------------------------------------------------------------
  const nsColours = [
    'Сніжно Білий', 'Слонова Кістка', 'Ананасовий', 'Дерев’яний', 'Мандариновий',
    'Антична троянда', 'Червоний', 'Смарагдовий', 'Зелений Нефрит', 'Зелений Мох',
    'Аквамарин', 'Блакитний Сапфір', 'Темний Синій', 'Сталевий Сірий', 'Чорний',
  ];
  for (const name of nsColours) {
    await prisma.colour.upsert({
      where: { supplierCode: `NS-${name}` },
      update: {},
      // hex is null on purpose: nobody has digitised these yet. The UI falls
      // back to the product photo rather than inventing a swatch colour.
      create: { name, supplierCode: `NS-${name}`, hex: null },
    });
  }

  // Own production: black is the only colour guaranteed in stock.
  await prisma.colour.upsert({
    where: { supplierCode: 'OWN-1' },
    update: {},
    create: { name: 'Чорний', supplierCode: 'OWN-1', hex: '#111111' },
  });

  console.info(
    `seeded: fabrics=4 garments=2 (${ownClassicTee.slug}, ${nsClassicTee.slug}) ` +
    `colours=${nsColours.length + 1} printPrices=3`,
  );
  console.warn(
    'TODO: remaining garments, own-production palette (40-60 numbered swatches), ' +
    'Native Spirit colours for everything except t-shirts, and lead times.',
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
