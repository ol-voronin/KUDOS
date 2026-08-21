import { Injectable, NotFoundException } from '@nestjs/common';
import type { CatalogQueryDto } from '@dt/contracts';
import { ErrorCode } from '@dt/contracts';
import { PrismaService } from '../common/prisma.service';

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

  async getPrintOffer(slug: string) {
    const print = await this.prisma.print.findFirst({
      where: { slug, isPublished: true },
      select: {
        id: true, slug: true, title: true, sizeTier: true, previewUrl: true, isPublished: true,
        collections: { select: { collection: { select: { slug: true } } } },
        breeds: { select: { breed: { select: { slug: true } } } },
      },
    });
    if (!print) {
      throw new NotFoundException({ code: ErrorCode.NOT_FOUND, message: 'Принт не знайдено' });
    }

    // TODO(step 2): resolve offerable garments via PrintGarmentRule, load their
    // variants and colours, and run each through priceOffer() from the pricing
    // domain. Kept as a seam so the shape is agreed before the query is tuned.
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
      garments: [],
      variants: [],
      colours: [],
      printPriceMinor: 0,
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
