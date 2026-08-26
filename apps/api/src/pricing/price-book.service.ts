import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import type { DiscountRule, PriceModifierRule } from './price-rules';

/**
 * Читання правил ціни з бази.
 *
 * Єдине місце, де правила перетворюються з рядків таблиці на аргументи для
 * чистих функцій. Сенс окремого сервісу — не в економії коду, а в тому, що
 * вітрина й каса читають правила однаковим запитом. Якби кожна робила свій
 * `findMany`, розбіжність зʼявилася б на першому ж фільтрі, доданому в одному
 * місці й забутому в іншому, — і сторінка показувала б одну ціну, а каса
 * рахувала іншу.
 *
 * Правил тут одиниці, тож жодного кешу: два дешевих запити на сторінку
 * коштують менше, ніж один випадок, коли покупець бачить учорашню ціну.
 */
@Injectable()
export class PriceBookService {
  constructor(private readonly prisma: PrismaService) {}

  async modifiers(): Promise<PriceModifierRule[]> {
    return this.prisma.db.priceModifier.findMany({
      where: { isActive: true },
      select: {
        id: true, name: true, target: true, sizeLabel: true,
        fabricId: true, colourId: true, garmentId: true,
        kind: true, amount: true, isActive: true,
      },
    });
  }

  /**
   * Знижки, які ще можуть спрацювати.
   *
   * За часом тут відсіюються лише ті, що завершилися або ще не почалися, —
   * решту перевірок робить чиста функція. Межа проведена так навмисно:
   * умова «від 10 шт» залежить від рядка замовлення, а не від бази, і
   * тягнути її в SQL означало б рахувати ціну у двох місцях одразу.
   */
  async discounts(now: Date = new Date()): Promise<DiscountRule[]> {
    return this.prisma.db.discount.findMany({
      where: {
        isActive: true,
        OR: [{ startsAt: null }, { startsAt: { lte: now } }],
        AND: [{ OR: [{ endsAt: null }, { endsAt: { gt: now } }] }],
      },
      select: {
        id: true, name: true, scope: true, garmentId: true, collectionId: true,
        kind: true, amount: true, minQty: true,
        startsAt: true, endsAt: true, isActive: true,
      },
    });
  }
}
