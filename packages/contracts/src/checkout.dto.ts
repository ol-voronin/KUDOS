import { z } from 'zod';
import { OrderStatus } from './enums';

/*
 * Одинична каса («один принт → одразу Monobank») жила тут до появи кошика.
 *
 * Її прибрано, а не залишено «про всяк випадок»: вона реалізовувала рівно
 * протилежний порядок — гроші беруться до підтвердження наявності. Два
 * чекаути з різними правилами про гроші — це не запас, а місце, де колись
 * спишуть кошти за товар, якого немає.
 *
 * Кошик і оформлення живуть у `cart.dto.ts`.
 */
/**
 * What the "thank you" page is allowed to know: no contact details, no line
 * items, just enough to tell the customer what happened to their money.
 */
export const OrderStatusPublicDto = z.object({
  orderNumber: z.number().int().positive(),
  status: OrderStatus,
  totalMinor: z.number().int().nonnegative(),
});
export type OrderStatusPublicDto = z.infer<typeof OrderStatusPublicDto>;
