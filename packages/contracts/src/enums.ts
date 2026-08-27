import { z } from 'zod';

/**
 * The two supply lines. This is deliberately NOT a navigation axis on the
 * storefront — nobody shops for "a Native Spirit t-shirt". It is a property of
 * the garment that drives sizes, colours, lead time and copy.
 */
export const ProductLine = z.enum(['OWN_PRODUCTION', 'NATIVE_SPIRIT']);
export type ProductLine = z.infer<typeof ProductLine>;

/** Cut/model families. Drives the size schema and the size labels. */
export const GarmentFit = z.enum([
  'CLASSIC',        // прямий крій
  'OVERSIZE',       // real оверсайз
  'OVERSIZE_WOMEN', // вкорочений жіночий оверсайз
  'COMFORT',        // модель Комфорт (власне виробництво, верх)
  'HYBRID',         // гібрид світшот-футболка / худі-футболка
  'KIDS',
]);
export type GarmentFit = z.infer<typeof GarmentFit>;

export const GarmentType = z.enum([
  'TSHIRT', 'SWEATSHIRT', 'HOODIE', 'ZIP_HOODIE', 'JOGGERS', 'TOTE_BAG',
]);
export type GarmentType = z.infer<typeof GarmentType>;

/**
 * Availability is the single most important field in the catalogue.
 *
 * Own production guarantees exactly one colour in stock (black); everything
 * else is "we will sew it, but delivery from another city takes longer".
 * Encoding that as data is what stops the shop selling something it cannot
 * ship. See `isPurchasable` in the pricing domain service.
 */
export const VariantAvailability = z.enum([
  'IN_STOCK',       // physically on the shelf, ships within the standard window
  'MADE_TO_ORDER',  // will be produced/ordered; REQUIRES leadTimeDays
  'UNAVAILABLE',    // visible for reference, cannot be bought
]);
export type VariantAvailability = z.infer<typeof VariantAvailability>;

/**
 * Куди їде замовлення.
 *
 * Тільки Нова Пошта: інших перевізників ми не використовуємо, а перелік із
 * порожніми пунктами читається як обіцянка, якої немає. Зʼявиться Укрпошта —
 * зʼявиться значення.
 */
export const DeliveryMethod = z.enum([
  'NP_BRANCH',    // відділення Нової Пошти
  'NP_POSTOMAT',  // поштомат Нової Пошти
  'NP_COURIER',   // курʼєр Нової Пошти на адресу
  'PICKUP',       // самовивіз у Харкові
]);
export type DeliveryMethod = z.infer<typeof DeliveryMethod>;

/** Print price depends on the print size tier, not on the print method. */
export const PrintSizeTier = z.enum(['MINI', 'MEDIUM', 'MAXI']);
export type PrintSizeTier = z.infer<typeof PrintSizeTier>;

/** Both methods work on both lines — this affects production, not the price. */
export const PrintMethod = z.enum(['DTF', 'DTG']);
export type PrintMethod = z.infer<typeof PrintMethod>;

/** The three revenue streams. They are NOT the same funnel. */
export const OrderStream = z.enum([
  'READY_PRINT',   // catalogue -> cart -> paid in two minutes
  'CUSTOMISATION', // ready print, swapped dog or text -> cart, then agreement
  'FROM_ZERO',     // brief -> quote -> deposit -> ~16h of design -> approval
]);
export type OrderStream = z.infer<typeof OrderStream>;

/**
 * Життя замовлення.
 *
 * `NEW` зʼявився разом із кошиком і змінює зміст усього переліку. Раніше
 * замовлення народжувалося вже з виставленим рахунком: людина тиснула
 * «Оплатити» і одразу їхала на сторінку Monobank, тож перший стан і був
 * `PENDING_PAYMENT`.
 *
 * Тепер між «замовив» і «платить» стоїть людина: ми звіряємо наявність,
 * пишемо покупцеві й лише потім виставляємо рахунок. Тобто:
 *
 *   NEW              — замовлення прийняте, ніхто ще нічого не винен
 *   PENDING_PAYMENT  — рахунок виставлено, чекаємо оплату
 *   PAID             — гроші отримані (або заблоковані під HOLD)
 *
 * Порядок значень тут — це порядок у житті, і саме в такому вигляді він
 * малюється в адмінці.
 */
export const OrderStatus = z.enum([
  'NEW', 'PENDING_PAYMENT', 'PAID', 'IN_PRODUCTION', 'SHIPPED', 'COMPLETED', 'CANCELLED',
]);
export type OrderStatus = z.infer<typeof OrderStatus>;

/** Mirrors Monobank's invoice status field — see apps/api payments module. */
export const PaymentStatus = z.enum([
  'CREATED', 'PROCESSING', 'HOLD', 'SUCCESS', 'FAILURE', 'REVERSED', 'EXPIRED',
]);
export type PaymentStatus = z.infer<typeof PaymentStatus>;

/** DEBIT captures immediately; HOLD blocks funds until an explicit finalize. */
export const PaymentType = z.enum(['DEBIT', 'HOLD']);
export type PaymentType = z.infer<typeof PaymentType>;

export const CustomRequestStatus = z.enum([
  'SUBMITTED', 'QUOTED', 'DEPOSIT_PAID', 'IN_DESIGN',
  'AWAITING_APPROVAL', 'APPROVED', 'IN_PRODUCTION', 'COMPLETED', 'CANCELLED',
]);
export type CustomRequestStatus = z.infer<typeof CustomRequestStatus>;

/** Measurement rows differ per garment: 2 rows, 3 rows, or waist/hip/length. */
export const MeasurementKey = z.enum([
  'WIDTH', 'LENGTH', 'SLEEVE', 'WAIST', 'HIP',
]);
export type MeasurementKey = z.infer<typeof MeasurementKey>;

/** Where a lead sits in the admin's follow-up workflow. */
export const LeadStatus = z.enum(['NEW', 'CONTACTED', 'CONVERTED', 'LOST']);
export type LeadStatus = z.infer<typeof LeadStatus>;

/**
 * Мова вмісту.
 *
 * Значення поки одне, і це навмисно: поле є в кожній таблиці вмісту з
 * першого дня, тож друга мова — це новий варіант enum і нові рядки, а не
 * міграція всієї бази й переписування кожної адмін-форми. Ціна зараз —
 * одна колонка; ціна потім — тиждень.
 */
export const Locale = z.enum(['UK']);
export type Locale = z.infer<typeof Locale>;

/**
 * PAGE    — довільна сторінка: «Доставка», «Про нас».
 * ARTICLE — матеріал: має дату, обкладинку й живе в стрічці.
 * SYSTEM  — головна, оферта, політика. Редагуються, але не видаляються,
 *           і адресу їм міняти не можна: на них посилається код і закон.
 */
export const PageKind = z.enum(['PAGE', 'ARTICLE', 'SYSTEM']);
export type PageKind = z.infer<typeof PageKind>;

/** Версія сторінки. Одна DRAFT і одна PUBLISHED на сторінку — це стежить база. */
export const PageVersionStatus = z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']);
export type PageVersionStatus = z.infer<typeof PageVersionStatus>;
