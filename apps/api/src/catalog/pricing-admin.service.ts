import { Injectable, NotFoundException } from '@nestjs/common';
import { ErrorCode, type AdminGarmentUpdateDto, type AdminPricingDto, type AdminPrintPriceUpdateDto } from '@dt/contracts';
import { PrismaService } from '../common/prisma.service';

/**
 * Ціни в адмінці.
 *
 * Цей сервіс існує через одне рішення: базові ціни виробів залиті сідером як
 * заглушки. Заглушка допустима рівно доти, доки її можна виправити без
 * деплою — інакше «тимчасова ціна» доживає до першого замовлення за
 * неправильною сумою. Тут же лежить перемикач публікації: виріб зʼявляється
 * у вітрині тоді, коли за нього є остаточна ціна, і це має бути одна дія в
 * одному місці.
 */
@Injectable()
export class PricingAdminService {
  constructor(private readonly prisma: PrismaService) {}

  async get(): Promise<AdminPricingDto> {
    const [garments, printPrices] = await Promise.all([
      this.prisma.db.garment.findMany({
        orderBy: [{ isPublished: 'desc' }, { basePriceMinor: 'asc' }],
        select: {
          id: true, slug: true, name: true, line: true, type: true, fit: true,
          basePriceMinor: true, isPublished: true,
          _count: { select: { sizes: true, variants: true } },
          variants: { select: { colourId: true } },
        },
      }),
      this.prisma.db.printPrice.findMany({ select: { tier: true, priceMinor: true }, orderBy: { tier: 'asc' } }),
    ]);

    return {
      garments: garments.map((g) => ({
        id: g.id,
        slug: g.slug,
        name: g.name,
        line: g.line,
        type: g.type,
        fit: g.fit,
        basePriceMinor: g.basePriceMinor,
        isPublished: g.isPublished,
        colourCount: new Set(g.variants.map((v: { colourId: string }) => v.colourId)).size,
        sizeCount: g._count.sizes,
        variantCount: g._count.variants,
      })),
      printPrices,
    };
  }

  async updateGarment(id: string, dto: AdminGarmentUpdateDto): Promise<AdminPricingDto> {
    const exists = await this.prisma.db.garment.findUnique({ where: { id }, select: { id: true } });
    if (!exists) {
      throw new NotFoundException({ code: ErrorCode.NOT_FOUND, message: 'Виріб не знайдено' });
    }
    await this.prisma.db.garment.update({
      where: { id },
      data: {
        ...(dto.basePriceMinor !== undefined ? { basePriceMinor: dto.basePriceMinor } : {}),
        ...(dto.isPublished !== undefined ? { isPublished: dto.isPublished } : {}),
      },
    });
    return this.get();
  }

  async updatePrintPrices(dto: AdminPrintPriceUpdateDto): Promise<AdminPricingDto> {
    await this.prisma.db.$transaction(
      dto.prices.map((p) => this.prisma.db.printPrice.upsert({
        where: { tier: p.tier },
        update: { priceMinor: p.priceMinor },
        create: { tier: p.tier, priceMinor: p.priceMinor },
      })),
    );
    return this.get();
  }
}
