import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  BreedListDto, BreedPageDto, CatalogQueryDto, CollectionListDto, CollectionPageDto,
  GarmentOfferDto, HomeDto, PrintCardDto, PrintListDto, PrintOfferDto, RangeColourDto, RangeDto,
  SearchQueryDto, SearchResultDto, SitemapDto,
} from '@dt/contracts';
import { ErrorCode, minor } from '@dt/contracts';
import { PrismaService } from '../common/prisma.service';
import { excludedColoursOf } from './colour-rules';
import { PriceBookService } from '../pricing/price-book.service';
import { blockReasonFor, garmentPriceFor, printPriceFor, type PricingGarment, type PricingPrint, type PricingVariant, type PrintPriceTable } from '../pricing/pricing.domain';
import {
  garmentTypesFor, matchesGarmentFilters, toPrintCard,
  type OfferContext, type OfferableGarment, type PrintRow,
} from './print-card';

/** Рядок принта в тому вигляді, у якому його вибирає `PRINT_ROW_SELECT`. */
interface PrintSelectRow {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly sizeTier: string;
  readonly previewUrl: string;
  readonly collections: ReadonlyArray<{ collectionId: string }>;
}

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
  constructor(
    private readonly prisma: PrismaService,
    private readonly priceBook: PriceBookService,
  ) {}

  /**
   * Скільки принтів каталог готовий тримати в памʼяті за один запит.
   *
   * Частина фільтрів (тип виробу, лінійка, наявність) не виражається в SQL:
   * вона залежить від ланцюжка `принт → колекції → правила → вироби`, який
   * рахується вже над завантаженим контекстом. Тому сторінка ріжеться після
   * фільтрації, а не в базі. Стеля потрібна, щоб це рішення мало межу: коли
   * принтів стане більше за неї, денормалізація перестане бути передчасною.
   */
  private static readonly FILTER_SCAN_LIMIT = 600;

  async listPrints(query: CatalogQueryDto): Promise<PrintListDto> {
    const where = {
      isPublished: true,
      ...(query.collection ? { collections: { some: { collection: { slug: query.collection } } } } : {}),
      ...(query.breed ? { breeds: { some: { breed: { slug: query.breed } } } } : {}),
      ...(query.sizeTier ? { sizeTier: query.sizeTier } : {}),
    };

    const [offer, printPrices] = await Promise.all([
      this.loadOfferContext(),
      this.loadPrintPrices(),
    ]);

    const rows = await this.prisma.db.print.findMany({
      where,
      select: CatalogService.PRINT_ROW_SELECT,
      orderBy: { createdAt: 'desc' },
      take: CatalogService.FILTER_SCAN_LIMIT,
    });

    const filtered = this.applyOfferFilters(rows, offer, printPrices, query);
    const start = (query.page - 1) * query.perPage;

    return {
      items: filtered.slice(start, start + query.perPage),
      total: filtered.length,
      page: query.page,
      perPage: query.perPage,
    };
  }

  /**
   * Фільтри, які стосуються виробів, і сортування — над уже зібраними
   * плитками.
   *
   * Один метод на каталог і на пошук навмисно: два списки з однаковими
   * фільтрами, які по-різному розуміють «є в наявності», — це та розбіжність,
   * яку помічає покупець і не помічає розробник.
   */
  private applyOfferFilters(
    rows: readonly PrintSelectRow[],
    offer: OfferContext,
    printPrices: PrintPriceTable,
    query: Pick<CatalogQueryDto, 'garmentType' | 'line' | 'inStock' | 'sort'>,
  ): PrintCardDto[] {
    const cards = rows
      .map((p) => ({ row: CatalogService.toRow(p), card: toPrintCard(CatalogService.toRow(p), offer, printPrices) }))
      .filter(({ row }) => matchesGarmentFilters(row, offer, {
        ...(query.garmentType === undefined ? {} : { garmentType: query.garmentType }),
        ...(query.line === undefined ? {} : { line: query.line }),
      }))
      .filter(({ card }) => query.inStock !== true || card.inStock)
      .map(({ card }) => card);

    /*
     * Принт без ціни («немає на чому друкувати») при сортуванні за ціною
     * їде в кінець в обидва боки. Ставити його першим у «спершу дешеві»
     * означало б показати як найдешевше те, що взагалі не купується.
     */
    const price = (c: PrintCardDto): number => c.fromPriceMinor ?? Number.MAX_SAFE_INTEGER;
    switch (query.sort) {
      case 'cheap': cards.sort((a, b) => price(a) - price(b)); break;
      case 'expensive': cards.sort((a, b) => (b.fromPriceMinor ?? -1) - (a.fromPriceMinor ?? -1)); break;
      case 'name': cards.sort((a, b) => a.title.localeCompare(b.title, 'uk')); break;
      case 'new': break; // порядок із бази вже такий
      default: break;
    }
    return cards;
  }

  async getPrintOffer(slug: string): Promise<PrintOfferDto> {
    const print = await this.prisma.db.print.findFirst({
      where: { slug, isPublished: true },
      select: {
        id: true, slug: true, title: true, sizeTier: true, previewUrl: true, mockupUrl: true, isPublished: true,
        images: {
          select: { url: true, alt: true },
          orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
        },
        collections: {
          select: {
            collectionId: true,
            collection: { select: { slug: true, colourExclusions: { select: { colourId: true } } } },
          },
        },
        breeds: { select: { breed: { select: { slug: true } } } },
        exclusions: { select: { garmentId: true } },
        colourExclusions: { select: { colourId: true } },
        colourAllowances: { select: { colourId: true } },
      },
    });
    if (!print) {
      throw new NotFoundException({ code: ErrorCode.NOT_FOUND, message: 'Принт не знайдено' });
    }

    // На чому цей принт можна надрукувати.
    //
    // Раніше тут стояв дозвільний принцип: виріб пропонується, лише якщо
    // якась колекція принта явно його дозволила рядком `PrintGarmentRule`.
    // Виглядало це строго, а на практиці означало, що принт без колекції не
    // продавався взагалі — сторінка товару відкривалася порожньою при
    // повністю коректних даних. Кожен новий принт мусив пройти крок, про
    // який ніде не написано.
    //
    // Тепер навпаки: за замовчуванням друкуємо на всьому опублікованому
    // асортименті. Правило колекції звужує вибір лише тоді, коли воно
    // справді заведене («портрети — тільки оверсайз»), а точкова заборона
    // на конкретному принті прибирає окремий виріб.
    const collectionIds = print.collections.map((c: { collectionId: string }) => c.collectionId);
    const excludedGarmentIds = print.exclusions.map((e: { garmentId: string }) => e.garmentId);

    const restrictingRules = collectionIds.length === 0 ? [] : await this.prisma.db.printGarmentRule.findMany({
      where: { collectionId: { in: collectionIds } },
      select: { garmentId: true },
    });
    const allowedGarmentIds = [...new Set(restrictingRules.map((r: { garmentId: string }) => r.garmentId))];

    const garments = await this.prisma.db.garment.findMany({
      where: {
        isPublished: true,
        id: {
          ...(allowedGarmentIds.length > 0 ? { in: allowedGarmentIds } : {}),
          ...(excludedGarmentIds.length > 0 ? { notIn: excludedGarmentIds } : {}),
        },
      },
      orderBy: { basePriceMinor: 'asc' },
      select: {
        id: true, slug: true, line: true, type: true, fit: true, name: true,
        lengthAdjustable: true, basePriceMinor: true, isPublished: true, description: true,
        // Основна тканина — перша. Сторінка товару бере `fabrics[0]` як вибір
        // за замовчуванням, а порядок без `orderBy` не гарантований нічим:
        // випадкова прив'язка від старого довідника могла опинитися попереду
        // й зустріти покупця тканиною, у якій цей виріб не шиється.
        fabrics: {
          orderBy: { isDefault: 'desc' },
          select: { fabric: { select: { id: true, name: true, weightGsm: true, composition: true, origin: true } } },
        },
        sizes: {
          orderBy: { position: 'asc' },
          select: { id: true, label: true, position: true, measurements: { select: { key: true, value: true } } },
        },
      },
    });

    const garmentIds = garments.map((g: { id: string }) => g.id);
    const variants = garmentIds.length === 0 ? [] : await this.prisma.db.variant.findMany({
      where: { garmentId: { in: garmentIds } },
      select: {
        id: true, sku: true, garmentId: true, fabricId: true, colourId: true, sizeId: true,
        availability: true, leadTimeDays: true, priceOverrideMinor: true,
        // Напис розміру потрібен для надбавок: правило «2XL дорожчий»
        // зберігається за написом, бо сіток у нас девʼять різних.
        size: { select: { label: true } },
      },
    });

    // Кольори — з варіантів, що лишаться після фільтра заборон: колір, у
    // якому цей принт не існує, не має зʼявлятися навіть сірим квадратиком.
    // Заборони складаються з колекційних і власних — див. `colour-rules.ts`.
    const excludedColourIds = excludedColoursOf(print);
    const colourIds = [...new Set(
      variants.map((v: { colourId: string }) => v.colourId).filter((id) => !excludedColourIds.has(id)),
    )];
    const colours = colourIds.length === 0 ? [] : await this.prisma.db.colour.findMany({
      where: { id: { in: colourIds } },
      select: { id: true, name: true, supplierCode: true, hex: true, imageUrl: true },
    });

    const [printPriceRows, modifiers] = await Promise.all([
      this.prisma.db.printPrice.findMany({ select: { tier: true, priceMinor: true } }),
      this.priceBook.modifiers(),
    ]);
    const priceTable = Object.fromEntries(
      printPriceRows.map((r: { tier: string; priceMinor: number }) => [r.tier, r.priceMinor]),
    ) as PrintPriceTable;

    const pricingPrint: PricingPrint = { id: print.id, sizeTier: print.sizeTier, isPublished: print.isPublished };
    const printPriceMinor = printPriceFor(pricingPrint, priceTable);

    // Defensive pass through the pricing domain: drop a variant only for a
    // structural reason (unpublished garment/print, print not offered on this
    // garment). "Unavailable" and "needs a lead time" stay in — the customer
    // needs to see those states, not have them silently disappear.
    //
    // Заборонені кольори — теж структурна причина: «песи в барі» на
    // оранжевому не існують як товар, тож оранжевий на цій сторінці не
    // показується взагалі, а не сіріє з поясненням.
    const garmentById = new Map(garments.map((g) => [g.id, g] as const));
    const offerableVariants = variants.flatMap((v) => {
      if (excludedColourIds.has(v.colourId)) return [];
      const garment = garmentById.get(v.garmentId);
      if (!garment) return [];
      const pricingGarment: PricingGarment = {
        id: garment.id, basePriceMinor: minor(garment.basePriceMinor), isPublished: garment.isPublished,
      };
      const pricingVariant: PricingVariant = {
        id: v.id,
        availability: v.availability,
        leadTimeDays: v.leadTimeDays,
        priceOverrideMinor: v.priceOverrideMinor === null ? null : minor(v.priceOverrideMinor),
        sizeLabel: v.size.label,
        fabricId: v.fabricId,
        colourId: v.colourId,
      };
      const reason = blockReasonFor(pricingGarment, pricingPrint, pricingVariant, { onGarment: true, onColour: true });
      const keep = reason === null
        || reason === 'VARIANT_UNAVAILABLE'
        || reason === 'MISSING_LEAD_TIME'
        || reason === 'LEAD_TIME_TOO_LONG';
      if (!keep) return [];

      // Ціну кожного варіанта рахує сервер тією самою функцією, що й каса.
      // Розмір відповіді від цього майже не зростає, а розбіжність між
      // сторінкою й кошиком стає неможливою.
      const { size: _size, ...row } = v;
      return [{ ...row, priceMinor: garmentPriceFor(pricingGarment, pricingVariant, modifiers).amountMinor }];
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
        mockupUrl: print.mockupUrl,
        isPublished: print.isPublished,
      },
      images: print.images.map((img: { url: string; alt: string }) => ({
        url: img.url,
        // Порожній alt у базі — норма: підпис необовʼязковий. Для доступності
        // потрібен осмислений текст, тому підставляємо назву принта.
        alt: img.alt === '' ? print.title : img.alt,
      })),
      garments: garments.map((g) => ({
        id: g.id,
        slug: g.slug,
        line: g.line,
        type: g.type,
        fit: g.fit,
        name: g.name,
        lengthAdjustable: g.lengthAdjustable,
        basePriceMinor: g.basePriceMinor,
        description: g.description,
        fabrics: g.fabrics.map((f) => f.fabric),
        sizes: g.sizes,
      })),
      variants: offerableVariants,
      colours,
      printPriceMinor,
    };
  }

  /**
   * Базовий одяг: один виріб із варіантами й цінами, без принта.
   *
   * Той самий зріз, що й вироби в пропозиції принта, і та сама цінова
   * функція — тільки без цінового рядка друку. Сторінка виробу продає
   * порожню річ, і їй потрібні кольори, розміри й чесні стани наявності.
   */
  async getGarmentOffer(slug: string): Promise<GarmentOfferDto> {
    const garment = await this.prisma.db.garment.findFirst({
      where: { slug, isPublished: true },
      select: {
        id: true, slug: true, line: true, type: true, fit: true, name: true,
        lengthAdjustable: true, basePriceMinor: true, isPublished: true, description: true,
        fabrics: {
          orderBy: { isDefault: 'desc' },
          select: { fabric: { select: { id: true, name: true, weightGsm: true, composition: true, origin: true } } },
        },
        sizes: {
          orderBy: { position: 'asc' },
          select: { id: true, label: true, position: true, measurements: { select: { key: true, value: true } } },
        },
      },
    });
    if (!garment) {
      throw new NotFoundException({ code: ErrorCode.NOT_FOUND, message: 'Виріб не знайдено' });
    }

    const [variants, modifiers] = await Promise.all([
      this.prisma.db.variant.findMany({
        where: { garmentId: garment.id },
        select: {
          id: true, sku: true, garmentId: true, fabricId: true, colourId: true, sizeId: true,
          availability: true, leadTimeDays: true, priceOverrideMinor: true,
          size: { select: { label: true } },
        },
      }),
      this.priceBook.modifiers(),
    ]);

    const pricingGarment: PricingGarment = {
      id: garment.id, basePriceMinor: minor(garment.basePriceMinor), isPublished: garment.isPublished,
    };
    const pricedVariants = variants.map((v) => {
      const pricingVariant: PricingVariant = {
        id: v.id,
        availability: v.availability,
        leadTimeDays: v.leadTimeDays,
        priceOverrideMinor: v.priceOverrideMinor === null ? null : minor(v.priceOverrideMinor),
        sizeLabel: v.size.label,
        fabricId: v.fabricId,
        colourId: v.colourId,
      };
      const { size: _size, ...row } = v;
      return { ...row, priceMinor: garmentPriceFor(pricingGarment, pricingVariant, modifiers).amountMinor };
    });

    const colourIds = [...new Set(variants.map((v: { colourId: string }) => v.colourId))];
    const colours = colourIds.length === 0 ? [] : await this.prisma.db.colour.findMany({
      where: { id: { in: colourIds } },
      select: { id: true, name: true, supplierCode: true, hex: true, imageUrl: true },
    });

    return {
      garment: {
        id: garment.id,
        slug: garment.slug,
        line: garment.line,
        type: garment.type,
        fit: garment.fit,
        name: garment.name,
        lengthAdjustable: garment.lengthAdjustable,
        basePriceMinor: garment.basePriceMinor,
        description: garment.description,
        fabrics: garment.fabrics.map((f) => f.fabric),
        sizes: garment.sizes,
      },
      variants: pricedVariants,
      colours,
    };
  }

  /**
   * Асортимент: сім виробів як самостійна вітрина.
   *
   * Це не той самий зріз, що в пропозиції принта. Там виріб — варіант вибору
   * всередині товару; тут він сам товар, який розглядають окремо: «а що ви
   * взагалі шиєте, з чого і в яких кольорах». Тому тут є кольори по кожному
   * виробу й немає варіантів — покупцеві на цій сторінці не треба знати, що
   * така сутність існує.
   */
  async getRange(): Promise<RangeDto> {
    const [garments, printPrices] = await Promise.all([
      this.prisma.db.garment.findMany({
        where: { isPublished: true },
        orderBy: { basePriceMinor: 'asc' },
        select: {
          id: true, slug: true, line: true, type: true, fit: true, name: true,
          lengthAdjustable: true, basePriceMinor: true, description: true,
          // Основна тканина — перша. Сторінка товару бере `fabrics[0]` як вибір
        // за замовчуванням, а порядок без `orderBy` не гарантований нічим:
        // випадкова прив'язка від старого довідника могла опинитися попереду
        // й зустріти покупця тканиною, у якій цей виріб не шиється.
        fabrics: {
          orderBy: { isDefault: 'desc' },
          select: { fabric: { select: { id: true, name: true, weightGsm: true, composition: true, origin: true } } },
        },
          sizes: {
            orderBy: { position: 'asc' },
            select: { id: true, label: true, position: true, measurements: { select: { key: true, value: true } } },
          },
          variants: {
            select: {
              leadTimeDays: true,
              colour: { select: { id: true, name: true, supplierCode: true, hex: true, imageUrl: true } },
            },
          },
        },
      }),
      this.prisma.db.printPrice.findMany({ select: { tier: true, priceMinor: true } }),
    ]);

    return {
      garments: garments.map((g) => {
        // Кольори виробу виводяться з варіантів, а не з тканини. Тканина може
        // ткатися в кольорі, якого ми в цьому крої не виготовляємо — і саме варіант
        // є твердженням «оце ми справді робимо».
        const byId = new Map<string, RangeColourDto>();
        for (const v of g.variants) {
          if (byId.has(v.colour.id)) continue;
          byId.set(v.colour.id, {
            ...v.colour,
            hasPhoto: v.colour.imageUrl !== null,
          });
        }
        const leadTimes = g.variants
          .map((v) => v.leadTimeDays)
          .filter((d): d is number => d !== null && d > 0);

        return {
          id: g.id,
          slug: g.slug,
          line: g.line,
          type: g.type,
          fit: g.fit,
          name: g.name,
          lengthAdjustable: g.lengthAdjustable,
          basePriceMinor: g.basePriceMinor,
          description: g.description,
          fabrics: g.fabrics.map((f) => f.fabric),
          sizes: g.sizes,
          colours: [...byId.values()],
          leadTimeDays: leadTimes.length > 0 ? Math.min(...leadTimes) : null,
        };
      }),
      printPrices,
    };
  }

  // ---------------------------------------------------------------------------
  // Спільна основа для всіх сіток. Вироби вантажаться ОДИН раз на запит, а не
  // на кожен принт — саме тут інакше зʼявляється N+1.
  // ---------------------------------------------------------------------------

  private async loadOfferContext(): Promise<OfferContext> {
    const [rows, rules, exclusions] = await Promise.all([
      this.prisma.db.garment.findMany({
        where: { isPublished: true },
        select: {
          id: true, basePriceMinor: true, type: true, line: true,
          rules: { select: { collectionId: true } },
          // Один рядок достатньо, щоб відповісти «чи є склад» — повний список
          // варіантів тут не потрібен і коштував би дорого.
          variants: { where: { availability: 'IN_STOCK' }, select: { id: true }, take: 1 },
        },
      }),
      // Уся таблиця правил і вся таблиця заборон — це десятки рядків, і вони
      // потрібні цілком: без них не відрізнити «обмежень немає» від «обмеження
      // є, але вони нікуди не ведуть». Читати їх посторінково нічого не дає.
      this.prisma.db.printGarmentRule.findMany({ select: { collectionId: true } }),
      this.prisma.db.printGarmentExclusion.findMany({ select: { printId: true, garmentId: true } }),
    ]);

    const garments: OfferableGarment[] = rows.map((g: {
      id: string; basePriceMinor: number; type: string; line: string;
      rules: Array<{ collectionId: string }>; variants: Array<{ id: string }>;
    }) => ({
      id: g.id,
      basePriceMinor: g.basePriceMinor,
      type: g.type,
      line: g.line,
      collectionIds: g.rules.map((r) => r.collectionId),
      hasStock: g.variants.length > 0,
    }));

    const exclusionsByPrint = new Map<string, Set<string>>();
    for (const e of exclusions as Array<{ printId: string; garmentId: string }>) {
      const set = exclusionsByPrint.get(e.printId);
      if (set) set.add(e.garmentId);
      else exclusionsByPrint.set(e.printId, new Set([e.garmentId]));
    }

    return {
      garments,
      restrictedCollectionIds: new Set(rules.map((r: { collectionId: string }) => r.collectionId)),
      exclusionsByPrint,
    };
  }

  /**
   * Скільки опублікованих принтів у кожної породи.
   *
   * Через `groupBy` по таблиці звʼязку, а не через `_count` із `where`:
   * фільтрований лічильник звʼязку в Prisma 5 — це preview-фіча
   * (`filteredRelationCount`), а вмикати preview-фічі в проєкті, що приймає
   * гроші, заради одного лічильника не варто.
   */
  /**
   * Обкладинка для плитки породи: фото самої собаки, якщо воно є, інакше —
   * превʼю найновішого її принта.
   *
   * Довго тут було тільки друге, і це створювало коло: плитка «такса» вела
   * малюнком такси в капелюсі, з якого породи не видно. Людина ж приходить
   * саме перевірити, чи то її собака. Фото має пріоритет; принт лишається
   * запасним, тож породи без фото працюють як працювали.
   */
  private async breedPreviews(): Promise<Map<string, string>> {
    const [photos, rows] = await Promise.all([
      this.prisma.db.breed.findMany({
        where: { photoUrl: { not: null } },
        select: { id: true, photoUrl: true },
      }),
      this.prisma.db.printBreed.findMany({
        where: { print: { isPublished: true, previewUrl: { not: '' } } },
        select: { breedId: true, print: { select: { previewUrl: true } } },
        orderBy: { print: { createdAt: 'desc' } },
      }),
    ]);
    const map = new Map<string, string>();
    for (const b of photos as Array<{ id: string; photoUrl: string | null }>) {
      if (b.photoUrl) map.set(b.id, b.photoUrl);
    }
    for (const r of rows as Array<{ breedId: string; print: { previewUrl: string } }>) {
      if (!map.has(r.breedId)) map.set(r.breedId, r.print.previewUrl);
    }
    return map;
  }

  private async breedPrintCounts(): Promise<Map<string, number>> {
    const rows = await this.prisma.db.printBreed.groupBy({
      by: ['breedId'],
      where: { print: { isPublished: true } },
      _count: { printId: true },
    });
    return new Map(rows.map((r: { breedId: string; _count: { printId: number } }) => [r.breedId, r._count.printId]));
  }

  private async collectionPrintCounts(): Promise<Map<string, number>> {
    const rows = await this.prisma.db.printCollection.groupBy({
      by: ['collectionId'],
      where: { print: { isPublished: true } },
      _count: { printId: true },
    });
    return new Map(rows.map((r: { collectionId: string; _count: { printId: number } }) => [r.collectionId, r._count.printId]));
  }

  private async loadPrintPrices(): Promise<PrintPriceTable> {
    const rows = await this.prisma.db.printPrice.findMany({ select: { tier: true, priceMinor: true } });
    return Object.fromEntries(
      rows.map((r: { tier: string; priceMinor: number }) => [r.tier, r.priceMinor]),
    ) as PrintPriceTable;
  }

  private static readonly PRINT_ROW_SELECT = {
    id: true, slug: true, title: true, sizeTier: true, previewUrl: true,
    collections: { select: { collectionId: true } },
  } as const satisfies Prisma.PrintSelect;

  private static toRow(p: PrintSelectRow): PrintRow {
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
    const [offer, printPrices, breedCounts, collectionCounts, breedPreviews] = await Promise.all([
      this.loadOfferContext(),
      this.loadPrintPrices(),
      this.breedPrintCounts(),
      this.collectionPrintCounts(),
      this.breedPreviews(),
    ]);

    const [breedRows, collectionRows, newRows, totalPrints] = await this.prisma.db.$transaction([
      this.prisma.db.breed.findMany({
        select: {
          id: true, slug: true, name: true,
        },
      }),
      this.prisma.db.collection.findMany({
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
      this.prisma.db.print.findMany({
        where: { isPublished: true },
        select: CatalogService.PRINT_ROW_SELECT,
        orderBy: { createdAt: 'desc' },
        take: HOME_BLOCK_SIZE,
      }),
      this.prisma.db.print.count({ where: { isPublished: true } }),
    ]);

    const newPrints = newRows.map((p) => toPrintCard(CatalogService.toRow(p), offer, printPrices));

    // «Готові до відправки» замість розпродажу: дефіцит справжній, бо власне
    // виробництво гарантує лише один колір на складі. Беремо ширше вікно й
    // фільтруємо вже порахованим полем inStock.
    const stockCandidates = await this.prisma.db.print.findMany({
      where: { isPublished: true },
      select: CatalogService.PRINT_ROW_SELECT,
      orderBy: { createdAt: 'desc' },
      take: HOME_BLOCK_SIZE * 6,
    });
    const readyToShip = stockCandidates
      .map((p) => toPrintCard(CatalogService.toRow(p), offer, printPrices))
      .filter((card) => card.inStock)
      .slice(0, HOME_BLOCK_SIZE);

    return {
      /**
       * Породи віддаємо всі, включно з тими, у яких ще немає жодного принта.
       *
       * Спершу я їх відфільтровував — і це була помилка для магазину, який
       * тільки наповнюється: смуга порід виявлялась порожньою рівно тоді,
       * коли вона найпотрібніша. Плитка породи без принтів нічого не обіцяє
       * зайвого: сторінка існує, працює й пропонує намалювати з фото. Саме
       * це зараз і є пропозиція.
       *
       * Порядок: спершу ті, де є що показати, далі за абеткою.
       */
      breeds: breedRows
        .map((b) => ({
          id: b.id, slug: b.slug, name: b.name,
          printCount: breedCounts.get(b.id) ?? 0,
          previewUrl: breedPreviews.get(b.id) ?? '',
        }))
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
    const [rows, counts, previews] = await Promise.all([
      this.prisma.db.breed.findMany({ select: { id: true, slug: true, name: true }, orderBy: { name: 'asc' } }),
      this.breedPrintCounts(),
      this.breedPreviews(),
    ]);
    /*
     * Порядок: спершу породи, у яких є що показати, далі за абеткою.
     *
     * Раніше тут була чиста абетка, і смуга порід починалася з трьох плиток
     * без картинки просто тому, що назви на «А». Виглядало це як порожній
     * каталог, хоча принти є — просто в інших порід.
     */
    return {
      items: rows
        .map((b) => ({
          id: b.id, slug: b.slug, name: b.name,
          printCount: counts.get(b.id) ?? 0,
          previewUrl: previews.get(b.id) ?? '',
        }))
        .sort((a, b) => b.printCount - a.printCount || a.name.localeCompare(b.name, 'uk')),
    };
  }

  async listCollections(): Promise<CollectionListDto> {
    const rows = await this.prisma.db.collection.findMany({
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
    const breed = await this.prisma.db.breed.findUnique({
      where: { slug },
      select: { id: true, slug: true, name: true, synonyms: true, photoUrl: true },
    });
    if (!breed) {
      throw new NotFoundException({ code: ErrorCode.NOT_FOUND, message: 'Породу не знайдено' });
    }

    const [offer, printPrices, breedCounts, breedPreviews, rows, related] = await Promise.all([
      this.loadOfferContext(),
      this.loadPrintPrices(),
      this.breedPrintCounts(),
      this.breedPreviews(),
      this.prisma.db.print.findMany({
        where: { isPublished: true, breeds: { some: { breedId: breed.id } } },
        select: CatalogService.PRINT_ROW_SELECT,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.db.breed.findMany({
        where: { id: { not: breed.id } },
        select: { id: true, slug: true, name: true },
      }),
    ]);

    const printRows = rows.map(CatalogService.toRow);
    return {
      breed,
      prints: printRows.map((p) => toPrintCard(p, offer, printPrices)),
      garmentTypes: garmentTypesFor(printRows, offer) as BreedPageDto['garmentTypes'],
      relatedBreeds: related
        .map((b) => ({
          id: b.id, slug: b.slug, name: b.name,
          printCount: breedCounts.get(b.id) ?? 0,
          previewUrl: breedPreviews.get(b.id) ?? '',
        }))
        .filter((b) => b.printCount > 0)
        .sort((a, b) => b.printCount - a.printCount)
        .slice(0, 8),
    };
  }

  async getCollectionPage(slug: string): Promise<CollectionPageDto> {
    const collection = await this.prisma.db.collection.findFirst({
      where: { slug, isPublished: true },
      select: { id: true, slug: true, title: true, description: true },
    });
    if (!collection) {
      throw new NotFoundException({ code: ErrorCode.NOT_FOUND, message: 'Колекцію не знайдено' });
    }

    const [offer, printPrices, rows] = await Promise.all([
      this.loadOfferContext(),
      this.loadPrintPrices(),
      this.prisma.db.print.findMany({
        where: { isPublished: true, collections: { some: { collectionId: collection.id } } },
        select: CatalogService.PRINT_ROW_SELECT,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return {
      collection,
      prints: rows.map((p) => toPrintCard(CatalogService.toRow(p), offer, printPrices)),
    };
  }

  /**
   * Пошук по каталогу.
   *
   * Шукає в трьох місцях і повертає їх окремо:
   *  • породи — за назвою і за **синонімами**: «йорк», «yorkie», «дворняга»
   *    приводять туди ж, куди «йоркширський терʼєр» і «метис». Без цього
   *    половина запитів не знаходить нічого, хоча сторінка існує;
   *  • колекції — за назвою й описом;
   *  • принти — за назвою і за slug.
   *
   * Регістр ігнорується (`mode: 'insensitive'`). Пошук по синонімах — через
   * `has` по масиву: точний збіг елемента, а не підрядок, бо синоніми і так
   * записані у формі, у якій їх набирають.
   */
  async search(input: SearchQueryDto): Promise<SearchResultDto> {
    const query = input.q.trim();
    if (query.length < 2) {
      return { query, breeds: [], collections: [], prints: [], total: 0 };
    }
    const lower = query.toLowerCase();

    const [offer, printPrices, breedCounts, collectionCounts, breedPreviews] = await Promise.all([
      this.loadOfferContext(),
      this.loadPrintPrices(),
      this.breedPrintCounts(),
      this.collectionPrintCounts(),
      this.breedPreviews(),
    ]);

    const [breedRows, collectionRows, printRows] = await this.prisma.db.$transaction([
      this.prisma.db.breed.findMany({
        where: {
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { slug: { contains: lower } },
            { synonyms: { has: lower } },
          ],
        },
        select: { id: true, slug: true, name: true },
        take: 8,
      }),
      this.prisma.db.collection.findMany({
        where: {
          isPublished: true,
          OR: [
            { title: { contains: query, mode: 'insensitive' } },
            { description: { contains: query, mode: 'insensitive' } },
          ],
        },
        orderBy: { position: 'asc' },
        select: {
          id: true, slug: true, title: true, description: true,
          prints: {
            where: { print: { isPublished: true } },
            take: 3,
            select: { print: { select: { previewUrl: true } } },
          },
        },
        take: 8,
      }),
      this.prisma.db.print.findMany({
        where: {
          isPublished: true,
          ...(input.sizeTier ? { sizeTier: input.sizeTier } : {}),
          ...(input.collection ? { collections: { some: { collection: { slug: input.collection } } } } : {}),
          ...(input.breed ? { breeds: { some: { breed: { slug: input.breed } } } } : {}),
          OR: [
            { title: { contains: query, mode: 'insensitive' } },
            { slug: { contains: lower } },
            // Принти знайденої породи — а не лише ті, у чиїй назві є слово.
            { breeds: { some: { breed: { OR: [
              { name: { contains: query, mode: 'insensitive' } },
              { synonyms: { has: lower } },
            ] } } } },
          ],
        },
        select: CatalogService.PRINT_ROW_SELECT,
        orderBy: { createdAt: 'desc' },
        /*
         * Беремо із запасом, а не рівно стільки, скільки покажемо: фільтри за
         * типом виробу й наявністю відсіюють уже після вибірки, і `take: 24`
         * означав би «двадцять чотири до фільтра, шість після».
         */
        take: 120,
      }),
    ]);

    const breeds = breedRows.map((b) => ({
      id: b.id, slug: b.slug, name: b.name,
      printCount: breedCounts.get(b.id) ?? 0,
      previewUrl: breedPreviews.get(b.id) ?? '',
    }));
    const collections = collectionRows.map((c) => ({
      id: c.id, slug: c.slug, title: c.title, description: c.description,
      printCount: collectionCounts.get(c.id) ?? 0,
      previewUrls: c.prints.map((p) => p.print.previewUrl),
    }));
    /*
     * Фільтри застосовуються тільки до принтів.
     *
     * Порода й колекція — це не товар, а вхід у каталог. Сховати сторінку
     * породи «Коргі» тому, що ввімкнено фільтр «худі», означало б не
     * відповісти на питання, з яким людина прийшла.
     */
    const prints = this.applyOfferFilters(printRows, offer, printPrices, input).slice(0, 24);

    return { query, breeds, collections, prints, total: breeds.length + collections.length + prints.length };
  }

  /** Плоскі списки для sitemap.xml. Породи віддаємо всі — навіть порожні мають сторінку. */
  async getSitemap(): Promise<SitemapDto> {
    const [prints, breeds, collections, garments] = await this.prisma.db.$transaction([
      this.prisma.db.print.findMany({ where: { isPublished: true }, select: { slug: true, updatedAt: true } }),
      this.prisma.db.breed.findMany({ select: { slug: true, updatedAt: true } }),
      this.prisma.db.collection.findMany({ where: { isPublished: true }, select: { slug: true, updatedAt: true } }),
      this.prisma.db.garment.findMany({ where: { isPublished: true }, select: { slug: true, updatedAt: true } }),
    ]);
    return { prints, breeds, collections, garments };
  }
}
