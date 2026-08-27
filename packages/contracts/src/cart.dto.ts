import { z } from 'zod';
import { AttributionDto } from './analytics.dto';
import { DeliveryMethod, OrderStatus, PrintMethod } from './enums';
import { PhoneSchema } from './phone';

/**
 * Кошик і замовлення з кількох позицій.
 *
 * ── Головне правило, яке тут не можна порушити ───────────────────────
 *
 * Клієнт присилає ТІЛЬКИ «що і скільки». Жодної ціни, жодної суми, жодної
 * знижки. Усе це рахує сервер із variantId і printId через той самий
 * ціновий домен, яким користується каталог. Інакше кошик стає полем вводу
 * для того, скільки людина хоче заплатити.
 *
 * Саме тому сам кошик живе в браузері (`localStorage`) і не потребує ні
 * таблиці, ні cookie: у ньому немає нічого, що варто було б захищати —
 * тільки перелік ідентифікаторів. Мінус чесний: кошик не переїжджає на
 * інший пристрій, і покинутих кошиків ми не бачимо. Обидві речі можна буде
 * додати, не змінюючи цей контракт: сервер уже вміє приймати кошик цілком.
 */

const Slug = z.string().min(1).max(120);

/**
 * Один рядок кошика.
 *
 * `printSlug` і `variantId` разом — це і є товар: малюнок і конкретний виріб
 * у розмірі й кольорі. Кількість обмежена пʼятьма з тієї ж причини, що й
 * раніше: більше — це вже опт, і на нього інша ціна й інша розмова.
 */
export const CartItemDto = z.object({
  printSlug: Slug,
  variantId: z.string().uuid(),
  printMethod: PrintMethod.default('DTF'),
  quantity: z.number().int().min(1).max(5).default(1),
});
export type CartItemDto = z.infer<typeof CartItemDto>;

/**
 * Куди везти.
 *
 * `city` і `branch` — вільний текст, а не довідник Нової Пошти. Це свідомий
 * перший крок: інтеграція з їхнім API — окрема робота з ключем, лімітами й
 * кешем довідника, а замовлення треба вміти приймати вже зараз. Текст, який
 * людина написала сама, менеджер прочитає й зрозуміє; порожнє поле —
 * не зрозуміє ніхто.
 *
 * Для самовивозу місто й відділення не потрібні — перевірка нижче це знає.
 */
export const DeliveryDto = z.object({
  method: DeliveryMethod,
  city: z.string().max(120).default(''),
  /** Номер відділення чи поштомата, або адреса для курʼєра. */
  branch: z.string().max(200).default(''),
  /**
   * Одержувач, якщо він не той, хто замовляє. Порожньо — веземо на
   * замовника. Це не формальність: подарунок іншій людині — звичайна річ,
   * а Нова Пошта видає посилку за іменем.
   */
  recipientName: z.string().max(120).default(''),
  recipientPhone: z.union([PhoneSchema, z.literal('')]).default(''),
}).refine(
  (d) => d.method === 'PICKUP' || (d.city.trim() !== '' && d.branch.trim() !== ''),
  { message: 'Вкажіть місто й відділення', path: ['branch'] },
);
export type DeliveryDto = z.infer<typeof DeliveryDto>;

/**
 * Оформлення замовлення. Оплати тут немає навмисно.
 *
 * Замовлення приходить у стані `NEW`: ми звіряємо наявність, пишемо людині
 * й лише потім виставляємо рахунок. Причина не технічна, а торгова —
 * власне виробництво гарантує один колір на складі, і продати те, чого
 * немає, дорожче, ніж зачекати годину до підтвердження.
 */
export const OrderDraftRequestDto = z.object({
  items: z.array(CartItemDto).min(1).max(20),
  customer: z.object({
    name: z.string().min(2).max(120),
    phone: PhoneSchema,
    /**
     * За замовчуванням `false`, і це не забудькуватість: залишений телефон —
     * це згода відповісти на це замовлення, а не згода на розсилку.
     */
    marketingConsent: z.boolean().default(false),
  }),
  delivery: DeliveryDto,
  note: z.string().max(500).default(''),
  attribution: AttributionDto.optional(),
});
export type OrderDraftRequestDto = z.infer<typeof OrderDraftRequestDto>;

export const OrderDraftResponseDto = z.object({
  orderId: z.string().uuid(),
  orderNumber: z.number().int().positive(),
  totalMinor: z.number().int().nonnegative(),
});
export type OrderDraftResponseDto = z.infer<typeof OrderDraftResponseDto>;

// ---------------------------------------------------------------------------
// Попередній підрахунок кошика
// ---------------------------------------------------------------------------

/**
 * Скільки коштує кошик — рахує сервер, показує сторінка.
 *
 * Окремий ендпоінт, а не арифметика на клієнті. Ціна складається з базової
 * ціни виробу, надбавок, ціни друку за розміром принта і знижок із датами —
 * повторити це в браузері означає завести другий ціновий движок, який
 * розійдеться з першим на першій же акції. Розійшовшись, він покаже одну
 * суму на сторінці й іншу в касі.
 */
export const CartLineDto = z.object({
  printSlug: Slug,
  variantId: z.string().uuid(),
  quantity: z.number().int().positive(),
  title: z.string(),
  garmentName: z.string(),
  colourName: z.string(),
  sizeLabel: z.string(),
  previewUrl: z.string(),
  unitMinor: z.number().int().nonnegative(),
  lineTotalMinor: z.number().int().nonnegative(),
  /** Знижка на цей рядок, назвою. `null` — знижки немає. */
  discountName: z.string().nullable(),
  discountMinor: z.number().int().nonnegative(),
  /**
   * Позиція, яку більше не можна купити: варіант зняли з продажу, принт
   * прибрали з виробу, колір закінчився. Рядок лишається видимим із
   * причиною — мовчки викинути товар із кошика гірше, ніж пояснити.
   */
  blockedReason: z.string().nullable(),
  leadTimeDays: z.number().int().positive().nullable(),
});
export type CartLineDto = z.infer<typeof CartLineDto>;

export const CartQuoteDto = z.object({
  lines: z.array(CartLineDto),
  subtotalMinor: z.number().int().nonnegative(),
  discountMinor: z.number().int().nonnegative(),
  shippingMinor: z.number().int().nonnegative(),
  /** Порогова сума безкоштовної доставки, щоб сторінка могла сказати «ще N ₴». */
  freeShippingFromMinor: z.number().int().nonnegative(),
  totalMinor: z.number().int().nonnegative(),
  maxLeadTimeDays: z.number().int().nonnegative(),
  /** Чи можна взагалі оформлювати: хоч один заблокований рядок — не можна. */
  purchasable: z.boolean(),
});
export type CartQuoteDto = z.infer<typeof CartQuoteDto>;

export const CartQuoteRequestDto = z.object({
  items: z.array(CartItemDto).max(20).default([]),
});
export type CartQuoteRequestDto = z.infer<typeof CartQuoteRequestDto>;

// ---------------------------------------------------------------------------
// Адмінка
// ---------------------------------------------------------------------------

export const AdminOrderRowDto = z.object({
  id: z.string().uuid(),
  number: z.number().int().positive(),
  status: OrderStatus,
  customerName: z.string(),
  customerPhone: z.string(),
  itemCount: z.number().int().nonnegative(),
  totalMinor: z.number().int().nonnegative(),
  /** Чи є вже виставлений рахунок — щоб не виставити другий. */
  hasInvoice: z.boolean(),
  placedAt: z.coerce.date(),
});
export type AdminOrderRowDto = z.infer<typeof AdminOrderRowDto>;

export const AdminOrderListDto = z.object({
  items: z.array(AdminOrderRowDto),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  perPage: z.number().int().positive(),
});
export type AdminOrderListDto = z.infer<typeof AdminOrderListDto>;

export const AdminOrderItemDto = z.object({
  printTitle: z.string(),
  printSlug: Slug,
  garmentName: z.string(),
  colourName: z.string(),
  sizeLabel: z.string(),
  quantity: z.number().int().positive(),
  lineTotalMinor: z.number().int().nonnegative(),
  promisedLeadTimeDays: z.number().int().positive().nullable(),
});
export type AdminOrderItemDto = z.infer<typeof AdminOrderItemDto>;

export const AdminOrderDto = z.object({
  id: z.string().uuid(),
  number: z.number().int().positive(),
  status: OrderStatus,
  customer: z.object({ name: z.string(), phone: z.string() }),
  delivery: z.object({
    method: DeliveryMethod,
    city: z.string(),
    branch: z.string(),
    recipientName: z.string(),
    recipientPhone: z.string(),
  }),
  note: z.string(),
  items: z.array(AdminOrderItemDto),
  subtotalMinor: z.number().int().nonnegative(),
  discountMinor: z.number().int().nonnegative(),
  discountName: z.string().nullable(),
  shippingMinor: z.number().int().nonnegative(),
  totalMinor: z.number().int().nonnegative(),
  /** Посилання на сторінку оплати, якщо рахунок уже виставлено. */
  paymentPageUrl: z.string().nullable(),
  paymentStatus: z.string().nullable(),
  placedAt: z.coerce.date(),
  utmSource: z.string(),
  utmCampaign: z.string(),
});
export type AdminOrderDto = z.infer<typeof AdminOrderDto>;

export const AdminOrderStatusUpdateDto = z.object({ status: OrderStatus });
export type AdminOrderStatusUpdateDto = z.infer<typeof AdminOrderStatusUpdateDto>;

export const AdminOrderInvoiceResponseDto = z.object({
  pageUrl: z.string().url(),
  invoiceId: z.string(),
});
export type AdminOrderInvoiceResponseDto = z.infer<typeof AdminOrderInvoiceResponseDto>;
