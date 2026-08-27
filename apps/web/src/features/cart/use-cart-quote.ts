'use client';

import { useQuery } from '@tanstack/react-query';
import { CartQuoteDto, type CartItemDto } from '@dt/contracts';
import { apiFetch } from '@/lib/api-client';
import { toCartItems, useCart } from './cart-store';

/**
 * Скільки коштує кошик — питаємо сервер.
 *
 * Не рахуємо в браузері навмисно. Ціна складається з базової ціни виробу,
 * надбавок за розмір і тканину, ціни друку за розміром принта й знижок із
 * датами. Повторити це тут означає завести другий ціновий движок, який
 * розійдеться з першим на першій же акції — і покаже одну суму в кошику й
 * іншу в рахунку.
 *
 * `queryKey` містить самі позиції, тож зміна кількості одразу дає новий
 * запит, а повернення до попереднього стану — миттєву відповідь із кешу.
 */
export function useCartQuote() {
  const { lines, ready } = useCart();
  const items = toCartItems(lines);
  return useQuery({
    queryKey: ['cart-quote', items],
    enabled: ready,
    queryFn: () => quoteCart(items),
    // Ціни живуть довше за секунду, але не набагато: акція може скінчитися
    // просто поки сторінка відкрита, і показувати вчорашню суму не можна.
    staleTime: 30_000,
  });
}

export function quoteCart(items: readonly CartItemDto[]): Promise<CartQuoteDto> {
  return apiFetch('/cart/quote', CartQuoteDto, {
    method: 'POST',
    body: JSON.stringify({ items }),
  });
}
