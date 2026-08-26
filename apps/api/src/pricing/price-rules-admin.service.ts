import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  AdminPriceRulesDto, DiscountCreateDto, DiscountDto, DiscountUpdateDto,
  PriceBreakdownDto, PriceModifierCreateDto, PriceModifierDto, PriceModifierUpdateDto,
  PriceQuoteRequestDto,
} from '@dt/contracts';
import { ErrorCode, minor } from '@dt/contracts';
import { PrismaService } from '../common/prisma.service';
import { PriceBookService } from './price-book.service';
import { quoteLine } from './price-rules';

const PRINT_TIER_LABEL: Readonly<Record<string, string>> = {
  MINI: 'Друк (міні)',
  MEDIUM: 'Друк (середній)',
  MAXI: 'Друк (максі)',
};

/**
 * Правила ціни в адмінці.
 *
 * Крім звичайного CRUD тут є калькулятор, і він не декоративний. Правил може
 * бути десяток, вони перетинаються, і єдиний чесний спосіб перевірити «що
 * вийде за 2XL у начосі, якщо взяти десять» — порахувати це тією самою
 * функцією, якою рахує каса, і показати розкладку по рядках. Без нього
 * налаштування цін перетворюється на здогадки з подальшою перевіркою на
 * живих замовленнях.
 */
@Injectable()
export class PriceRulesAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly priceBook: PriceBookService,
  ) {}

  async list(): Promise<AdminPriceRulesDto> {
    const [modifiers, discounts, fabrics, colours, garments, collections] = await Promise.all([
      this.prisma.db.priceModifier.findMany({
        orderBy: [{ target: 'asc' }, { name: 'asc' }],
        select: {
          id: true, name: true, target: true, sizeLabel: true,
          fabricId: true, colourId: true, garmentId: true,
          kind: true, amount: true, isActive: true,
        },
      }),
      this.prisma.db.discount.findMany({
        orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
        select: {
          id: true, name: true, scope: true, garmentId: true, collectionId: true,
          kind: true, amount: true, minQty: true,
          startsAt: true, endsAt: true, isActive: true,
        },
      }),
      this.prisma.db.fabric.findMany({ select: { id: true, name: true } }),
      this.prisma.db.colour.findMany({ select: { id: true, name: true, supplierCode: true } }),
      this.prisma.db.garment.findMany({ select: { id: true, name: true, fit: true } }),
      this.prisma.db.collection.findMany({ select: { id: true, title: true }, orderBy: { title: 'asc' } }),
    ]);

    // Написи розмірів — з реальних сіток, без повторів. Так у формі не можна
    // вибрати розмір, якого немає, а отже й створити правило, що мовчить.
    const sizeRows = await this.prisma.db.size.findMany({
      distinct: ['label'],
      select: { label: true, position: true },
      orderBy: [{ position: 'asc' }, { label: 'asc' }],
    });

    const fabricName = new Map(fabrics.map((f) => [f.id, f.name] as const));
    const colourName = new Map(colours.map(
      (c) => [c.id, c.name ?? `колір ${c.supplierCode}`] as const,
    ));
    const garmentName = new Map(garments.map((g) => [g.id, `${g.name} (${g.fit})`] as const));
    const collectionName = new Map(collections.map((c) => [c.id, c.title] as const));

    const now = new Date();

    return {
      modifiers: modifiers.map((m): PriceModifierDto => ({
        ...m,
        targetLabel: this.modifierLabel(m, fabricName, colourName),
        garmentLabel: m.garmentId === null ? null : garmentName.get(m.garmentId) ?? '—',
      })),
      discounts: discounts.map((d): DiscountDto => ({
        ...d,
        startsAt: d.startsAt === null ? null : d.startsAt.toISOString(),
        endsAt: d.endsAt === null ? null : d.endsAt.toISOString(),
        scopeLabel: this.discountLabel(d, garmentName, collectionName),
        activeNow: d.isActive
          && (d.startsAt === null || d.startsAt <= now)
          && (d.endsAt === null || d.endsAt > now),
      })),
      options: {
        garments: garments.map((g) => ({ id: g.id, name: `${g.name} (${g.fit})` })),
        fabrics: fabrics.map((f) => ({ id: f.id, name: f.name })),
        colours: colours.map((c) => ({ id: c.id, name: c.name ?? `колір ${c.supplierCode}` })),
        sizeLabels: sizeRows.map((s) => s.label),
        collections: collections.map((c) => ({ id: c.id, name: c.title })),
      },
    };
  }

  private modifierLabel(
    m: { target: string; sizeLabel: string | null; fabricId: string | null; colourId: string | null },
    fabricName: ReadonlyMap<string, string>,
    colourName: ReadonlyMap<string, string>,
  ): string {
    switch (m.target) {
      case 'SIZE_LABEL': return `Розмір ${m.sizeLabel ?? '—'}`;
      case 'FABRIC': return `Тканина ${m.fabricId === null ? '—' : fabricName.get(m.fabricId) ?? '—'}`;
      case 'COLOUR': return `Колір ${m.colourId === null ? '—' : colourName.get(m.colourId) ?? '—'}`;
      default: return '—';
    }
  }

  private discountLabel(
    d: { scope: string; garmentId: string | null; collectionId: string | null; minQty: number },
    garmentName: ReadonlyMap<string, string>,
    collectionName: ReadonlyMap<string, string>,
  ): string {
    const base = d.scope === 'GARMENT'
      ? (d.garmentId === null ? '—' : garmentName.get(d.garmentId) ?? '—')
      : d.scope === 'COLLECTION'
        ? `Колекція ${d.collectionId === null ? '—' : collectionName.get(d.collectionId) ?? '—'}`
        : 'Весь асортимент';
    return d.minQty > 1 ? `${base}, від ${d.minQty} шт` : base;
  }

  async createModifier(dto: PriceModifierCreateDto): Promise<AdminPriceRulesDto> {
    await this.assertTargetExists(dto);
    try {
      await this.prisma.db.priceModifier.create({ data: dto });
    } catch (error) {
      throw this.duplicate(error, 'Така надбавка вже є. Змініть наявну замість того, щоб додавати другу — вони складаються.');
    }
    return this.list();
  }

  async updateModifier(id: string, dto: PriceModifierUpdateDto): Promise<AdminPriceRulesDto> {
    const exists = await this.prisma.db.priceModifier.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new NotFoundException({ code: ErrorCode.NOT_FOUND, message: 'Надбавку не знайдено' });
    await this.prisma.db.priceModifier.update({ where: { id }, data: dto });
    return this.list();
  }

  async deleteModifier(id: string): Promise<AdminPriceRulesDto> {
    await this.prisma.db.priceModifier.deleteMany({ where: { id } });
    return this.list();
  }

  async createDiscount(dto: DiscountCreateDto): Promise<AdminPriceRulesDto> {
    await this.assertDiscountScopeExists(dto);
    await this.prisma.db.discount.create({
      data: {
        ...dto,
        startsAt: dto.startsAt === null ? null : new Date(dto.startsAt),
        endsAt: dto.endsAt === null ? null : new Date(dto.endsAt),
      },
    });
    return this.list();
  }

  async updateDiscount(id: string, dto: DiscountUpdateDto): Promise<AdminPriceRulesDto> {
    const exists = await this.prisma.db.discount.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new NotFoundException({ code: ErrorCode.NOT_FOUND, message: 'Знижку не знайдено' });
    await this.prisma.db.discount.update({
      where: { id },
      data: {
        ...dto,
        ...(dto.startsAt !== undefined ? { startsAt: dto.startsAt === null ? null : new Date(dto.startsAt) } : {}),
        ...(dto.endsAt !== undefined ? { endsAt: dto.endsAt === null ? null : new Date(dto.endsAt) } : {}),
      },
    });
    return this.list();
  }

  async deleteDiscount(id: string): Promise<AdminPriceRulesDto> {
    await this.prisma.db.discount.deleteMany({ where: { id } });
    return this.list();
  }

  /**
   * Калькулятор: та сама функція, що й у касі.
   *
   * Ціна друку береться з таблиці, а не приймається аргументом, — інакше
   * калькулятор показував би те, що в нього ввели, а не те, що станеться
   * насправді.
   */
  async quote(dto: PriceQuoteRequestDto): Promise<PriceBreakdownDto> {
    const garment = await this.prisma.db.garment.findUnique({
      where: { id: dto.garmentId },
      select: { id: true, basePriceMinor: true },
    });
    if (!garment) {
      throw new NotFoundException({ code: ErrorCode.NOT_FOUND, message: 'Виріб не знайдено' });
    }

    const [modifiers, discounts, printPrice] = await Promise.all([
      this.priceBook.modifiers(),
      this.priceBook.discounts(),
      dto.printTier === null
        ? Promise.resolve(null)
        : this.prisma.db.printPrice.findUnique({
          where: { tier: dto.printTier },
          select: { priceMinor: true },
        }),
    ]);

    const line = quoteLine({
      basePriceMinor: minor(garment.basePriceMinor),
      priceOverrideMinor: null,
      printPriceMinor: printPrice === null ? null : minor(printPrice.priceMinor),
      printLabel: dto.printTier === null ? 'Друк' : PRINT_TIER_LABEL[dto.printTier] ?? 'Друк',
      subject: {
        garmentId: garment.id,
        sizeLabel: dto.sizeLabel,
        fabricId: dto.fabricId,
        colourId: dto.colourId,
      },
      modifiers,
      discounts,
      discountSubject: {
        garmentId: garment.id,
        // Колекції тут не звужуємо: калькулятор рахує виріб, а не конкретний
        // принт. Знижку на колекцію він тому не покаже — і це чесніше, ніж
        // показати її для довільно вибраної колекції.
        collectionIds: [],
        quantity: dto.quantity,
        now: new Date(),
      },
    });

    return {
      steps: line.steps.map((s) => ({ label: s.label, amountMinor: s.amountMinor })),
      unitMinor: line.unitMinor,
      quantity: line.quantity,
      subtotalMinor: line.subtotalMinor,
      discountName: line.discount?.name ?? null,
      discountMinor: line.discount?.amountMinor ?? 0,
      totalMinor: line.totalMinor,
    };
  }

  /**
   * Ціль правила має існувати.
   *
   * Зовнішні ключі це вже гарантують для тканини й кольору, але не для
   * розміру: розмір тут — напис, а не звʼязок. Правило «3XL +50 ₴», написане
   * з одруківкою, мовчки не діє ні на що, тож перевіряємо, що такий напис
   * узагалі є в сітках.
   */
  private async assertTargetExists(dto: PriceModifierCreateDto): Promise<void> {
    if (dto.target !== 'SIZE_LABEL' || dto.sizeLabel === null) return;
    const size = await this.prisma.db.size.findFirst({
      where: {
        label: dto.sizeLabel,
        ...(dto.garmentId === null ? {} : { garmentId: dto.garmentId }),
      },
      select: { id: true },
    });
    if (!size) {
      throw new BadRequestException({
        code: ErrorCode.VALIDATION_FAILED,
        message: `Розміру «${dto.sizeLabel}» немає в жодній розмірній сітці — надбавка не діяла б ні на що.`,
      });
    }
  }

  private async assertDiscountScopeExists(dto: DiscountCreateDto): Promise<void> {
    if (dto.scope === 'GARMENT' && dto.garmentId !== null) {
      const g = await this.prisma.db.garment.findUnique({ where: { id: dto.garmentId }, select: { id: true } });
      if (!g) throw new NotFoundException({ code: ErrorCode.NOT_FOUND, message: 'Виріб не знайдено' });
    }
    if (dto.scope === 'COLLECTION' && dto.collectionId !== null) {
      const c = await this.prisma.db.collection.findUnique({ where: { id: dto.collectionId }, select: { id: true } });
      if (!c) throw new NotFoundException({ code: ErrorCode.NOT_FOUND, message: 'Колекцію не знайдено' });
    }
  }

  /** Унікальний індекс по виразу ловить дубль — перекладаємо це людською мовою. */
  private duplicate(error: unknown, message: string): unknown {
    const code = (error as { code?: string }).code;
    if (code === 'P2002') {
      return new BadRequestException({ code: ErrorCode.VALIDATION_FAILED, message });
    }
    return error;
  }
}
