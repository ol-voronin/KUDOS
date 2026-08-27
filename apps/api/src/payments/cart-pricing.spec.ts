import { describe, expect, it } from 'vitest';
import type { CartItemDto } from '@dt/contracts';
import { mergeCartItems } from './cart-pricing.service';

const line = (over: Partial<CartItemDto> = {}): CartItemDto => ({
  printSlug: 'boss-lab', variantId: 'v-1', printMethod: 'DTF', quantity: 1, ...over,
});

describe('mergeCartItems', () => {
  it('складає той самий товар, доданий двічі, в один рядок', () => {
    const merged = mergeCartItems([line(), line()]);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.quantity).toBe(2);
  });

  it('не змішує різні варіанти того самого принта', () => {
    // Худі й футболка з тим самим малюнком — це два товари, а не один.
    const merged = mergeCartItems([line(), line({ variantId: 'v-2' })]);
    expect(merged).toHaveLength(2);
  });

  it('не змішує той самий варіант під різними принтами', () => {
    const merged = mergeCartItems([line(), line({ printSlug: 'call-of-woof' })]);
    expect(merged).toHaveLength(2);
  });

  it('не пускає кількість вище стелі навіть складанням поштучно', () => {
    // Стеля існує тому, що більше — це вже опт, і на нього інша ціна.
    // Обійти її, натиснувши «додати» шість разів, бути не має.
    const merged = mergeCartItems(Array.from({ length: 6 }, () => line()));
    expect(merged[0]?.quantity).toBe(5);
  });

  it('зберігає порядок першої появи', () => {
    // Порядок рядків у кошику — це порядок, у якому їх клали. Перестановка
    // при кожному перерахунку читається як помилка.
    const merged = mergeCartItems([
      line({ printSlug: 'a' }), line({ printSlug: 'b' }), line({ printSlug: 'a' }),
    ]);
    expect(merged.map((m) => m.printSlug)).toEqual(['a', 'b']);
  });
});
