/**
 * Demo catalogue data for local UI review — NOT real product/business data.
 *
 * The production seed (`seed.ts`) intentionally leaves both garments
 * `isPublished: false` because their real colour palettes and lead times
 * aren't finalised yet. This script flips them to published and adds a demo
 * breed/collection/prints/variants on top, purely so the redesigned public
 * pages (home grid, breed page, product page) have something real to render
 * against during development.
 *
 * Everything created here is clearly labelled "[DEMO]" in its title so it can
 * never be mistaken for real catalogue content, and the whole thing is
 * idempotent (safe to re-run).
 *
 * Run: pnpm --filter @dt/api run db:seed:demo (after `prisma db seed`)
 */

import { PrismaClient, type VariantAvailability } from '@prisma/client';

const prisma = new PrismaClient();

const AVAILABILITY_CYCLE: Array<{ availability: VariantAvailability; leadTimeDays: number | null }> = [
  { availability: 'IN_STOCK', leadTimeDays: null },
  { availability: 'MADE_TO_ORDER', leadTimeDays: 5 },
  { availability: 'UNAVAILABLE', leadTimeDays: null },
];

/** Index is always `n % AVAILABILITY_CYCLE.length`, so it's always in range. */
function cycleAt(i: number): { availability: VariantAvailability; leadTimeDays: number | null } {
  const entry = AVAILABILITY_CYCLE[i % AVAILABILITY_CYCLE.length];
  if (!entry) throw new Error('unreachable: index is always within AVAILABILITY_CYCLE bounds');
  return entry;
}

async function seedVariants(
  garmentId: string,
  fabricId: string,
  colourIds: string[],
  sizes: Array<{ id: string; label: string }>,
): Promise<number> {
  let i = 0;
  for (const size of sizes) {
    for (const colourId of colourIds) {
      const cycle = cycleAt(i);
      i += 1;
      await prisma.variant.upsert({
        where: { garmentId_fabricId_colourId_sizeId: { garmentId, fabricId, colourId, sizeId: size.id } },
        update: { availability: cycle.availability, leadTimeDays: cycle.leadTimeDays },
        create: {
          sku: `DEMO-${garmentId.slice(0, 8)}-${colourId.slice(0, 8)}-${size.label}`,
          garmentId,
          fabricId,
          colourId,
          sizeId: size.id,
          availability: cycle.availability,
          leadTimeDays: cycle.leadTimeDays,
        },
      });
    }
  }
  return i;
}

async function main(): Promise<void> {
  // -------------------------------------------------------------------------
  // Publish the two real garments (dev-only toggle — see file header).
  // -------------------------------------------------------------------------
  const ownTee = await prisma.garment.update({
    where: { slug: 'futbolka-klasychna-nasha' },
    data: { isPublished: true },
    include: { fabrics: { include: { fabric: true } }, sizes: true },
  });
  const nsTee = await prisma.garment.update({
    where: { slug: 'futbolka-klasychna-native-spirit' },
    data: { isPublished: true },
    include: { fabrics: { include: { fabric: true } }, sizes: true },
  });

  const ownFabricId = ownTee.fabrics.find((f) => f.isDefault)?.fabricId ?? ownTee.fabrics[0]?.fabricId;
  const nsFabricId = nsTee.fabrics.find((f) => f.isDefault)?.fabricId ?? nsTee.fabrics[0]?.fabricId;
  if (!ownFabricId || !nsFabricId) {
    throw new Error('Seed order problem: run `prisma db seed` before this script.');
  }

  const ownColour = await prisma.colour.findUniqueOrThrow({ where: { supplierCode: 'OWN-1' } });
  const nsColourCodes = ['NS-Чорний', 'NS-Червоний', 'NS-Темний Синій'];
  const nsColours = await prisma.colour.findMany({ where: { supplierCode: { in: nsColourCodes } } });
  if (nsColours.length !== nsColourCodes.length) {
    throw new Error('Seed order problem: run `prisma db seed` before this script.');
  }

  // -------------------------------------------------------------------------
  // Breed + demo collection, linking both garments via PrintGarmentRule.
  // -------------------------------------------------------------------------
  const breed = await prisma.breed.upsert({
    where: { slug: 'corgi' },
    update: {},
    create: { slug: 'corgi', name: 'Коргі', synonyms: ['вельш-коргі', 'welsh corgi'] },
  });

  const collection = await prisma.collection.upsert({
    where: { slug: 'demo-korgi-portrety' },
    update: { isPublished: true },
    create: {
      slug: 'demo-korgi-portrety',
      title: '[DEMO] Портрети коргі',
      description: 'Демонстраційна колекція для перевірки UI — не для продажу.',
      position: 0,
      isPublished: true,
    },
  });

  for (const garmentId of [ownTee.id, nsTee.id]) {
    await prisma.printGarmentRule.upsert({
      where: { collectionId_garmentId: { collectionId: collection.id, garmentId } },
      update: {},
      create: { collectionId: collection.id, garmentId },
    });
  }

  // -------------------------------------------------------------------------
  // Prints
  // -------------------------------------------------------------------------
  const DEMO_PRINTS = [
    { slug: 'demo-korgi-usmishka', title: '[DEMO] Коргі-усмішка', sizeTier: 'MEDIUM' as const },
    { slug: 'demo-korgi-portret', title: '[DEMO] Портрет коргі', sizeTier: 'MAXI' as const },
    { slug: 'demo-korgi-biguny', title: '[DEMO] Коргі-бігуни', sizeTier: 'MINI' as const },
    { slug: 'demo-korgi-akvarel', title: '[DEMO] Коргі-акварель', sizeTier: 'MEDIUM' as const },
  ];

  const printIds: string[] = [];
  for (const p of DEMO_PRINTS) {
    const print = await prisma.print.upsert({
      where: { slug: p.slug },
      update: { isPublished: true },
      create: {
        slug: p.slug,
        title: p.title,
        sizeTier: p.sizeTier,
        previewUrl: `https://placehold.co/600x600/f0ece3/1a1714?text=${encodeURIComponent(p.title)}`,
        artworkKey: `demo/${p.slug}.png`,
        isPublished: true,
      },
    });
    printIds.push(print.id);

    await prisma.printCollection.upsert({
      where: { printId_collectionId: { printId: print.id, collectionId: collection.id } },
      update: {},
      create: { printId: print.id, collectionId: collection.id },
    });
    await prisma.printBreed.upsert({
      where: { printId_breedId: { printId: print.id, breedId: breed.id } },
      update: {},
      create: { printId: print.id, breedId: breed.id },
    });
  }

  // -------------------------------------------------------------------------
  // Variants — a deliberate mix of IN_STOCK / MADE_TO_ORDER / UNAVAILABLE so
  // the product page can demonstrate all three AvailabilityBadge states.
  // -------------------------------------------------------------------------
  const ownCount = await seedVariants(ownTee.id, ownFabricId, [ownColour.id], ownTee.sizes);
  const nsCount = await seedVariants(
    nsTee.id,
    nsFabricId,
    nsColours.map((c) => c.id),
    nsTee.sizes,
  );

  console.info(
    `demo seed done: breed=${breed.slug} collection=${collection.slug} prints=${printIds.length} ` +
    `variants=${ownCount + nsCount} (garments published: ${ownTee.slug}, ${nsTee.slug})`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
