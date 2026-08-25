/**
 * Заливає асортимент із `range.ts` у базу.
 *
 * Ідемпотентний і безпечний для повторного запуску. Три правила, які роблять
 * його безпечним:
 *
 *   1. Ціни ставляться ЛИШЕ при створенні запису. Виправлена в адмінці ціна
 *      переживає будь-яку кількість повторних сідів — інакше скрипт мовчки
 *      відкочував би роботу людини.
 *   2. `availability` варіанта теж ставиться лише при створенні. Позначений
 *      «є в наявності» варіант не має ставати «під замовлення» через те, що
 *      хтось перезалив довідник.
 *   3. Нічого не видаляється мовчки. Зайві розміри й варіанти видаляються
 *      тільки якщо на них не посилаються замовлення; інакше скрипт каже про
 *      це вголос і йде далі.
 *
 * Запуск: pnpm --filter @dt/api run db:seed:range
 */

import { PrismaClient } from '@prisma/client';
import { COLOURS, FABRICS, GARMENTS, PRINT_PRICES, garmentPhotoPath } from './range';

const prisma = new PrismaClient();

const LINE = 'OWN_PRODUCTION' as const;

/** SKU має бути читабельним у накладній, а не лише унікальним у базі. */
function sku(garmentSlug: string, colourCode: string, sizeLabel: string): string {
  const size = sizeLabel.replace(/\//g, '_').toUpperCase();
  return `${garmentSlug}--${colourCode}--${size}`;
}

async function main(): Promise<void> {
  const notes: string[] = [];

  // ── тканини ───────────────────────────────────────────────────────────────
  const fabricIdByKey = new Map<string, string>();
  for (const f of FABRICS) {
    const row = await prisma.fabric.upsert({
      where: { line_name: { line: LINE, name: f.name } },
      update: { weightGsm: f.weightGsm, composition: f.composition },
      create: { line: LINE, name: f.name, weightGsm: f.weightGsm, composition: f.composition, origin: null },
    });
    fabricIdByKey.set(f.key, row.id);
  }

  // ── кольори ───────────────────────────────────────────────────────────────
  const colourIdByCode = new Map<string, string>();
  for (const c of COLOURS) {
    const row = await prisma.colour.upsert({
      where: { supplierCode: c.code },
      update: { name: c.name, hex: c.hex },
      create: { supplierCode: c.code, name: c.name, hex: c.hex },
    });
    colourIdByCode.set(c.code, row.id);
  }

  // Обкладинка кольору — фото першого виробу, який шиється в цьому кольорі.
  // Порядок GARMENTS не випадковий: класична футболка йде першою саме тому,
  // що вона є в найбільшій кількості кольорів і читається як еталон.
  for (const c of COLOURS) {
    const host = GARMENTS.find((g) => g.colours.includes(c.code));
    if (!host) { notes.push(`колір «${c.name}» не використовується в жодному виробі`); continue; }
    await prisma.colour.update({
      where: { supplierCode: c.code },
      data: { imageUrl: garmentPhotoPath(host.slug, c.code) },
    });
  }

  // ── вироби ────────────────────────────────────────────────────────────────
  let variantsCreated = 0;
  let variantsKept = 0;

  for (const g of GARMENTS) {
    const fabricId = fabricIdByKey.get(g.fabric);
    if (!fabricId) throw new Error(`невідома тканина «${g.fabric}» у виробі ${g.slug}`);
    const leadTimeDays = FABRICS.find((f) => f.key === g.fabric)?.leadTimeDays ?? 7;

    const garment = await prisma.garment.upsert({
      where: { line_type_fit: { line: LINE, type: g.type, fit: g.fit } },
      update: { slug: g.slug, name: g.name, description: g.description, isPublished: true },
      create: {
        slug: g.slug, line: LINE, type: g.type, fit: g.fit, name: g.name,
        description: g.description, lengthAdjustable: false,
        basePriceMinor: g.basePriceMinor, isPublished: true,
      },
    });

    await prisma.garmentFabric.upsert({
      where: { garmentId_fabricId: { garmentId: garment.id, fabricId } },
      update: { isDefault: true },
      create: { garmentId: garment.id, fabricId, isDefault: true },
    });

    // ── розміри ─────────────────────────────────────────────────────────────
    // `position` унікальний у межах виробу, тому канонічні позиції не можна
    // проставляти «на місці»: XS переїжджає з 0 на 1 і стикається з тим, хто
    // вже там сидить. Спершу відсуваємо всі наявні розміри в діапазон 1000+,
    // потім розставляємо канонічні, потім прибираємо те, що лишилося вгорі.
    await prisma.$executeRaw`
      UPDATE "Size" SET "position" = "position" + 1000
      WHERE "garmentId" = ${garment.id}::uuid AND "position" < 1000
    `;

    const sizeIdByLabel = new Map<string, string>();
    for (const [index, s] of g.sizes.entries()) {
      const size = await prisma.size.upsert({
        where: { garmentId_label: { garmentId: garment.id, label: s.label } },
        update: { position: index },
        create: { garmentId: garment.id, label: s.label, position: index },
      });
      sizeIdByLabel.set(s.label, size.id);

      for (const [key, value] of [['LENGTH', s.length], ['WIDTH', s.width], ['SLEEVE', s.sleeve]] as const) {
        await prisma.measurement.upsert({
          where: { sizeId_key: { sizeId: size.id, key } },
          update: { value },
          create: { sizeId: size.id, key, value },
        });
      }
    }

    const stale = await prisma.size.findMany({
      where: { garmentId: garment.id, position: { gte: 1000 } },
      select: { id: true, label: true },
    });
    for (const s of stale) {
      const blocking = await prisma.orderItem.count({ where: { variant: { sizeId: s.id } } });
      if (blocking > 0) {
        notes.push(`розмір «${s.label}» у ${g.slug} застарілий, але на нього є ${blocking} позицій у замовленнях — лишаю`);
        continue;
      }
      await prisma.variant.deleteMany({ where: { sizeId: s.id } });
      await prisma.size.delete({ where: { id: s.id } });
    }

    // ── кольори виробу ──────────────────────────────────────────────────────
    for (const code of g.colours) {
      const colourId = colourIdByCode.get(code);
      if (!colourId) throw new Error(`невідомий колір «${code}» у виробі ${g.slug}`);
      await prisma.fabricColour.upsert({
        where: { fabricId_colourId: { fabricId, colourId } },
        update: {},
        create: { fabricId, colourId },
      });
    }

    // ── варіанти ────────────────────────────────────────────────────────────
    const wanted = new Set<string>();
    for (const code of g.colours) {
      const colourId = colourIdByCode.get(code) as string;
      for (const s of g.sizes) {
        const sizeId = sizeIdByLabel.get(s.label) as string;
        wanted.add(`${colourId}:${sizeId}`);
        const key = { garmentId: garment.id, fabricId, colourId, sizeId };
        const existing = await prisma.variant.findUnique({
          where: { garmentId_fabricId_colourId_sizeId: key },
          select: { id: true },
        });
        if (existing) { variantsKept += 1; continue; }
        await prisma.variant.create({
          data: {
            ...key,
            sku: sku(g.slug, code, s.label),
            availability: 'MADE_TO_ORDER',
            leadTimeDays,
          },
        });
        variantsCreated += 1;
      }
    }

    const orphans = await prisma.variant.findMany({
      where: { garmentId: garment.id },
      select: { id: true, sku: true, colourId: true, sizeId: true },
    });
    for (const v of orphans) {
      if (wanted.has(`${v.colourId}:${v.sizeId}`)) continue;
      const blocking = await prisma.orderItem.count({ where: { variantId: v.id } });
      if (blocking > 0) {
        notes.push(`варіант ${v.sku} більше не в асортименті, але є в замовленнях — лишаю`);
        continue;
      }
      await prisma.variant.delete({ where: { id: v.id } });
    }
  }

  // ── ціни друку ────────────────────────────────────────────────────────────
  for (const p of PRINT_PRICES) {
    await prisma.printPrice.upsert({
      where: { tier: p.tier },
      update: {},                       // наявну ціну не чіпаємо: див. правило 1
      create: { tier: p.tier, priceMinor: p.priceMinor },
    });
  }

  // ── прибирання попереднього довідника ────────────────────────────────────
  const canonicalSlugs = GARMENTS.map((g) => g.slug);
  const retired = await prisma.garment.updateMany({
    where: { slug: { notIn: canonicalSlugs }, isPublished: true },
    data: { isPublished: false },
  });
  if (retired.count > 0) notes.push(`знято з вітрини застарілих виробів: ${retired.count}`);

  // ── звіт ──────────────────────────────────────────────────────────────────
  const printPrices = await prisma.printPrice.findMany({ orderBy: { tier: 'asc' } });
  const cheapestPrint = Math.min(...printPrices.map((p: { priceMinor: number }) => p.priceMinor));
  const published = await prisma.garment.findMany({
    where: { isPublished: true },
    select: { slug: true, name: true, basePriceMinor: true, _count: { select: { variants: true, sizes: true } } },
    orderBy: { basePriceMinor: 'asc' },
  });

  console.info('');
  console.info(`тканин: ${FABRICS.length} · кольорів: ${COLOURS.length} · виробів: ${GARMENTS.length}`);
  console.info(`варіантів створено: ${variantsCreated} · уже було: ${variantsKept}`);
  console.info('');
  console.info('опубліковані вироби (ціна виробу → з найдешевшим друком):');
  for (const g of published) {
    const base = (g.basePriceMinor / 100).toFixed(0).padStart(5);
    const total = ((g.basePriceMinor + cheapestPrint) / 100).toFixed(0).padStart(5);
    console.info(`  ${base} ₴ → ${total} ₴   ${g.name}  (${g._count.sizes} розмірів, ${g._count.variants} варіантів)`);
  }
  console.info('');
  console.info('ціни друку:');
  for (const p of printPrices) console.info(`  ${p.tier.padEnd(7)} ${(p.priceMinor / 100).toFixed(0)} ₴`);
  console.info('');
  console.warn('⚠ ЦІНИ — ЗАГЛУШКИ. Виправити: /admin/tsiny. Повторний сід їх не перетре.');
  for (const n of notes) console.warn(`  · ${n}`);
}

main()
  .catch((error: unknown) => { console.error(error); process.exitCode = 1; })
  .finally(() => void prisma.$disconnect());
