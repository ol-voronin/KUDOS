import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  BreedListDto, BreedPageDto, CatalogQueryDto, CollectionListDto, CollectionPageDto,
  HomeDto, PrintListDto, PrintOfferDto, SitemapDto,
} from '@dt/contracts';
import { ErrorCode, minor } from '@dt/contracts';
import { PrismaService } from '../common/prisma.service';
import { blockReasonFor, printPriceFor, type PricingGarment, type PricingPrint, type PricingVariant, type PrintPriceTable } from '../pricing/pricing.domain';
import { garmentTypesFor, toPrintCard, type OfferableGarment, type PrintRow } from './print-card';

/** Скільки карток показувати в блоці на головній. */
const HOME_BLOCK_SIZE = 8;

/**
 * Catalogue reads.
 *
 * Every query here selects explicit fields. `include: { everything: true }` is
 * how a product page turns into forty queries and a two-second response — the
 * N+1 review in the casic checklist starts with this file.
 */
@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async listPrints(query: CatalogQueryDto): Promise<PrintListDto> {
    const where = {
      isPublished: true,
      ...(query.collection ? { collections: { some: { collection: { slug: query.collection } } } } : {}),
      ...(query.breed ? { breeds: { some: { breed: { slug: query.breed } } } } : {}),
    };

    const [garments, printPrices] = await Promise.all([
      this.loadOfferableGarments(),
      this.loadPrintPrices(),
    ]);

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.print.findMany({
        where,
        select: CatalogService.PRINT_ROW_SELECT,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.perPage,
        take: query.perPage,
      }),
      this.prisma.print.count({ where }),
    ]);

    return {
      items: rows.map((p) => toPrintCard(CatalogService.toRow(p), garments, printPrices)),
      total,
      page: query.page,
      perPage: query.perPage,
    };
  }

  async getPrintOffer(slug: string): Promise<PrintOfferDto> {
    const print = await this.prisma.print.findFirst({
      where: { slug, isPublished: true },
      select: {
        id: true, slug: true, title: true, sizeTier: true, previewUrl: true, isPublished: true,
        collections: { select: { collectionId: true, collection: { select: { slug: true } } } },
        breeds: { select: { breed: { select: { slug: true } } } },
      },
    });
    if (!print) {
      throw new NotFoundException({ code: ErrorCode.NOT_FOUND, message: 'Принт не знайдено' });
    }

    // A print is offerable on a garment only through an explicit
    // PrintGarmentRule row on one of its collections — "портрети тільки
    // оверсайз" as data, not as a rule someone has to remember.
    const collectionIds = print.collections.map((c: { collectionId: string }) => c.collectionId);

    const garments = collectionIds.length === 0 ? [] : await this.prisma.garment.findMany({
      where: { isPublished: true, rules: { some: { collectionId: { in: collectionIds } } } },
      select: {
        id: true, slug: true, line: true, type: true, fit: true, name: true,
        lengthAdjustable: true, basePriceMinor: true, isPublished: true,
        fabrics: { select: { fabric: { select: { id: true, name: true, weightGsm: true, composition: true, origin: true } } } },
        sizes: {
          orderBy: { position: 'asc' },
          select: { id: true, label: true, position: true, measurements: { select: { key: true, value: true } } },
        },
      },
    });

    const garmentIds = garments.map((g: { id: string }) => g.id);
    const variants = garmentIds.length === 0 ? [] : await this.prisma.variant.findMany({
      where: { garmentId: { in: garmentIds } },
      select: {
        id: true, sku: true, garmentId: true, fabricId: true, colourId: true, sizeId: true,
        availability: true, leadTimeDays: true, priceOverrideMinor: true,
      },
    });

    const colourIds = [...new Set(variants.map((v: { colourId: string }) => v.colourId))];
    const colours = colourIds.length === 0 ? [] : await this.prisma.colour.findMany({
      where: { id: { in: colourIds } },
      select: { id: true, name: true, supplierCode: true, hex: true, imageUrl: true },
    });

    const printPriceRows = await this.prisma.printPrice.findMany({ select: { tier: true, priceMinor: true } });
    const priceTable = Object.fromEntries(
      printPriceRows.map((r: { tier: string; priceMinor: number }) => [r.tier, r.priceMinor]),
    ) as PrintPriceTable;

    const pricingPrint: PricingPrint = { id: print.id, sizeTier: print.sizeTier, isPublished: print.isPublished };
    const printPriceMinor = printPriceFor(pricingPrint, priceTable);

    // Defensive pass through the pricing domain: drop a variant only for a
    // structural reason (unpublished garment/print, print not offered on this
    // garment). "Unavailable" and "needs a lead time" stay in — the customer
    // needs to see those states, not have them silently disappear.
    const garmentById = new Map(garments.map((g) => [g.id, g] as const));
    const offerableVariants = variants.filter((v) => {
      const garment = garmentById.get(v.garmentId);
      if (!garment) return false;
      const pricingGarment: PricingGarment = {
        id: garment.id, basePriceMinor: minor(garment.basePriceMinor), isPublished: garment.isPublished,
      };
      const pricingVariant: PricingVariant = {
        id: v.id,
        availability: v.availability,
        leadTimeDays: v.leadTimeDays,
        priceOverrideMinor: v.priceOverrideMinor === null ? null : minor(v.priceOverrideMinor),
      };
      const reason = blockReasonFor(pricingGarment, pricingPrint, pricingVariant, true);
      return reason === null
        || reason === 'VARIANT_UNAVAILABLE'
        || reason === 'MISSING_LEAD_TIME'
        || reason === 'LEAD_TIME_TOO_LONG';
    });

    return {
      print: {
        id: print.id,
        slug: print.slug,
        title: print.title,
        sizeTier: print.sizeTier,
        collectionSlugs: print.collections.map((c: { collection: { slug: string } }) => c.collection.slug),
        breedSlugs: print.breeds.map((b: { breed: { slug: string } }) => b.breed.slug),
        previewUrl: print.previewUrl,
        isPublished: print.isPublished,
      },
      garments: garments.map((g) => ({
        id: g.id,
        slug: g.slug,
        line: g.line,
        type: g.type,
        fit: g.fit,
        name: g.name,
        lengthAdjustable: g.lengthAdjustable,
        basePriceMinor: g.basePriceMinor,
        fabrics: g.fabrics.map((f) => f.fabric),
        sizes: g.sizes,
      })),
      variants: offerableVariants,
      colours,
      printPriceMinor,
    };
  }

  // ---------------------------------------------------------------------------
  // Спільна основа для всіх сіток. Вироби вантажаться ОДИН раз на запит, а не
  // на кожен принт — саме тут інакше зʼявляється N+1.
  // ---------------------------------------------------------------------------

  private async loadOfferableGarments(): Promise<OfferableGarment[]> {
    const garments = await this.prisma.garment.findMany({
      where: { isPublished: true },
      select: {
        id: true, basePriceMinor: true, type: true,
        rules: { select: { collectionId: true } },
        // Один рядок достатньо, щоб відповісти «чи є склад» — повний список
        // варіантів тут не потрібен і коштував би дорого.
        variants: { where: { availability: 'IN_STOCK' }, select: { id: true }, take: 1 },
      },
    });

    return garments.map((g: {
      id: string; basePriceMinor: number; type: string;
      rules: Array<{ collectionId: string }>; variants: Array<{ id: string }>;
    }) => ({
      id: g.id,
      basePriceMinor: g.basePriceMinor,
      type: g.type,
      collectionIds: g.rules.map((r) => r.collectionId),
      hasStock: g.variants.length > 0,
    }));
  }

  /**
   * Скільки опублікованих принтів у кожної породи.
   *
   * Через `groupBy` по таблиці звʼязку, а не через `_count` із `where`:
   * фільтрований лічильник звʼязку в Prisma 5 — це preview-фіча
   * (`filteredRelationCount`), а вмикати preview-фічі в проєкті, що приймає
   * гроші, заради одного лічильника не варто.
   */
  private async breedPrintCounts(): Promise<Map<string, number>> {
    const rows = await this.prisma.printBreed.groupBy({
      by: ['breedId'],
      where: { print: { isPublished: true } },
      _count: { printId: true },
    });
    return new Map(rows.map((r: { breedId: string; _count: { printId: number } }) => [r.breedId, r._count.printId]));
  }

  private async collectionPrintCounts(): Promise<Map<string, number>> {
    const rows = await this.prisma.printCollection.groupBy({
      by: ['collectionId'],
      where: { print: { isPublished: true } },
      _count: { printId: true },
    });
    return new Map(rows.map((r: { collectionId: string; _count: { printId: number } }) => [r.collectionId, r._count.printId]));
  }

  private async loadPrintPrices(): Promise<PrintPriceTable> {
    const rows = await this.prisma.printPrice.findMany({ select: { tier: true, priceMinor: true } });
    return Object.fromEntries(
      rows.map((r: { tier: string; priceMinor: number }) => [r.tier, r.priceMinor]),
    ) as PrintPriceTable;
  }

  private static readonly PRINT_ROW_SELECT = {
    id: true, slug: true, title: true, sizeTier: true, previewUrl: true,
    collections: { select: { collectionId: true } },
  } as const;

  private static toRow(p: {
    id: string; slug: string; title: string; sizeTier: string; previewUrl: string;
    collections: Array<{ collectionId: string }>;
  }): PrintRow {
    return {
      id: p.id, slug: p.slug, title: p.title,
      sizeTier: p.sizeTier as PrintRow['sizeTier'],
      previewUrl: p.previewUrl,
      collectionIds: p.collections.map((c) => c.collectionId),
    };
  }

  // ---------------------------------------------------------------------------

  /**
   * Уся головна одним запитом. Порядок блоків тут — це і є порядок на
   * сторінці: склад головної живе на сервері, а не збирається на клієнті.
   */
  async getHome(): Promise<HomeDto> {
    const [garments, printPrices, breedCounts, collectionCounts] = await Promise.all([
      this.loadOfferableGarments(),
      this.loadPrintPrices(),
      this.breedPrintCounts(),
      this.collectionPrintCounts(),
    ]);

    const [breedRows, collectionRows, newRows, totalPrints] = await this.prisma.$transaction([
      this.prisma.breed.findMany({
        select: {
          id: true, slug: true, name: true,
        },
      }),
      this.prisma.collection.findMany({
        where: { isPublished: true },
        orderBy: { position: 'asc' },
        select: {
          id: true, slug: true, title: true, description: true,
          prints: {
            where: { print: { isPublished: true } },
            take: 3,
            select: { print: { select: { previewUrl: true } } },
          },
        },
      }),
      this.prisma.print.findMany({
        where: { isPublished: true },
        select: CatalogService.PRINT_ROW_SELECT,
        orderBy: { createdAt: 'desc' },
        take: HOME_BLOCK_SIZE,
      }),
      this.prisma.print.count({ where: { isPublished: true } }),
    ]);

    const newPrints = newRows.map((p) => toPrintCard(CatalogService.toRow(p), garments, printPrices));

    // «Готові до відправки» замість розпродажу: дефіцит справжній, бо власне
    // виробництво гарантує лише один колір на складі. Беремо ширше вікно й
    // фільтруємо вже порахованим полем inStock.
    const stockCandidates = await this.prisma.print.findMany({
      where: { isPublished: true },
      select: CatalogService.PRINT_ROW_SELECT,
      orderBy: { createdAt: 'desc' },
      take: HOME_BLOCK_SIZE * 6,
    });
    const readyToShip = stockCandidates
      .map((p) => toPrintCard(CatalogService.toRow(p), garments, printPrices))
      .filter((card) => card.inStock)
      .slice(0, HOME_BLOCK_SIZE);

    return {
      // Породи без принтів на головну не потрапляють: порожня плитка обіцяє
      // те, чого немає. Власну сторінку така порода все одно має.
      breeds: breedRows
        .map((b) => ({ id: b.id, slug: b.slug, name: b.name, printCount: breedCounts.get(b.id) ?? 0 }))
        .filter((b) => b.printCount > 0)
        .sort((a, b) => b.printCount - a.printCount || a.name.localeCompare(b.name, 'uk')),
      collections: collectionRows.map((c) => ({
        id: c.id, slug: c.slug, title: c.title, description: c.description,
        printCount: collectionCounts.get(c.id) ?? 0,
        previewUrls: c.prints.map((p) => p.print.previewUrl),
      })),
      newPrints,
      readyToShip,
      totalPrints,
    };
  }

  async listBreeds(): Promise<BreedListDto> {
    const [rows, counts] = await Promise.all([
      this.prisma.breed.findMany({ select: { id: true, slug: true, name: true }, orderBy: { name: 'asc' } }),
      this.breedPrintCounts(),
    ]);
    // Тут, на відміну від головної, віддаємо всі — включно з порожніми:
    // сторінка породи без принтів усе одно працює й пропонує намалювати.
    return {
      items: rows.map((b) => ({ id: b.id, slug: b.slug, name: b.name, printCount: counts.get(b.id) ?? 0 })),
    };
  }

  async listCollections(): Promise<CollectionListDto> {
    const rows = await this.prisma.collection.findMany({
      where: { isPublished: true },
      orderBy: { position: 'asc' },
      select: {
        id: true, slug: true, title: true, description: true,
        prints: {
          where: { print: { isPublished: true } },
          take: 3,
          select: { print: { select: { previewUrl: true } } },
        },
      },
    });
    const counts = await this.collectionPrintCounts();
    return {
      items: rows.map((c) => ({
        id: c.id, slug: c.slug, title: c.title, description: c.description,
        printCount: counts.get(c.id) ?? 0,
        previewUrls: c.prints.map((p) => p.print.previewUrl),
      })),
    };
  }

  async getBreedPage(slug: string): Promise<BreedPageDto> {
    const breed = await this.prisma.breed.findUnique({
      where: { slug },
      select: { id: true, slug: true, name: true, synonyms: true },
    });
    if (!breed) {
      throw new NotFoundException({ code: ErrorCode.NOT_FOUND, message: 'Породу не знайдено' });
    }

    const [garments, printPrices, breedCounts, rows, related] = await Promise.all([
      this.loadOfferableGarments(),
      this.loadPrintPrices(),
      this.breedPrintCounts(),
      this.prisma.print.findMany({
        where: { isPublished: true, breeds: { some: { breedId: breed.id } } },
        select: CatalogService.PRINT_ROW_SELECT,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.breed.findMany({
        where: { id: { not: breed.id } },
        select: { id: true, slug: true, name: true },
      }),
    ]);

    const printRows = rows.map(CatalogService.toRow);
    return {
      breed,
      prints: printRows.map((p) => toPrintCard(p, garments, printPrices)),
      garmentTypes: garmentTypesFor(printRows, garments) as BreedPageDto['garmentTypes'],
      relatedBreeds: related
        .map((b) => ({ id: b.id, slug: b.slug, name: b.name, printCount: breedCounts.get(b.id) ?? 0 }))
        .filter((b) => b.printCount > 0)
        .sort((a, b) => b.printCount - a.printCount)
        .slice(0, 8),
    };
  }

  async getCollectionPage(slug: string): Promise<CollectionPageDto> {
    const collection = await this.prisma.collection.findFirst({
      where: { slug, isPublished: true },
      select: { id: true, slug: true, title: true, description: true },
    });
    if (!collection) {
      throw new NotFoundException({ code: ErrorCode.NOT_FOUND, message: 'Колекцію не знайдено' });
    }

    const [garments, printPrices, rows] = await Promise.all([
      this.loadOfferableGarments(),
      this.loadPrintPrices(),
      this.prisma.print.findMany({
        where: { isPublished: true, collections: { some: { collectionId: collection.id } } },
        select: CatalogService.PRINT_ROW_SELECT,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      collection,
      prints: rows.map((p) => toPrintCard(CatalogService.toRow(p), garments, printPrices)),
    };
  }

  /** Плоскі списки для sitemap.xml. Породи віддаємо всі — навіть порожні мають сторінку. */
  async getSitemap(): Promise<SitemapDto> {
    const [prints, breeds, collections] = await this.prisma.$transaction([
      this.prisma.print.findMany({ where: { isPublished: true }, select: { slug: true, updatedAt: true } }),
      this.prisma.breed.findMany({ select: { slug: true, updatedAt: true } }),
      this.prisma.collection.findMany({ where: { isPublished: true }, select: { slug: true, updatedAt: true } }),
    ]);
    return { prints, breeds, collections };
  }
}
