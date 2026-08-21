import { Injectable, NotFoundException } from '@nestjs/common';
import type { CatalogQueryDto, PrintOfferDto } from '@dt/contracts';
import { ErrorCode, minor } from '@dt/contracts';
import { PrismaService } from '../common/prisma.service';
import { blockReasonFor, printPriceFor, type PricingGarment, type PricingPrint, type PricingVariant, type PrintPriceTable } from '../pricing/pricing.domain';

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

  async listPrints(query: CatalogQueryDto) {
    const where = {
      isPublished: true,
      ...(query.collection ? { collections: { some: { collection: { slug: query.collection } } } } : {}),
      ...(query.breed ? { breeds: { some: { breed: { slug: query.breed } } } } : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.print.findMany({
        where,
        select: { id: true, slug: true, title: true, sizeTier: true, previewUrl: true },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.perPage,
        take: query.perPage,
      }),
      this.prisma.print.count({ where }),
    ]);

    return { items, total, page: query.page, perPage: query.perPage };
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

  async getBreedPage(slug: string) {
    const breed = await this.prisma.breed.findUnique({
      where: { slug },
      select: { id: true, slug: true, name: true, synonyms: true },
    });
    if (!breed) {
      throw new NotFoundException({ code: ErrorCode.NOT_FOUND, message: 'Породу не знайдено' });
    }
    const prints = await this.prisma.print.findMany({
      where: { isPublished: true, breeds: { some: { breedId: breed.id } } },
      select: { id: true, slug: true, title: true, previewUrl: true, sizeTier: true },
      orderBy: { createdAt: 'desc' },
    });
    return { breed, prints };
  }

  async getCollectionPage(slug: string) {
    const collection = await this.prisma.collection.findFirst({
      where: { slug, isPublished: true },
      select: { id: true, slug: true, title: true, description: true },
    });
    if (!collection) {
      throw new NotFoundException({ code: ErrorCode.NOT_FOUND, message: 'Колекцію не знайдено' });
    }
    const prints = await this.prisma.print.findMany({
      where: { isPublished: true, collections: { some: { collectionId: collection.id } } },
      select: { id: true, slug: true, title: true, previewUrl: true, sizeTier: true },
      orderBy: { createdAt: 'desc' },
    });
    return { collection, prints };
  }
}
