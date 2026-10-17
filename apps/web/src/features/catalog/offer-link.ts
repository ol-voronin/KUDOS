import type { PrintOfferDto } from '@dt/contracts';

/**
 * Посилання на конкретний варіант товару: `/prints/<принт>?garment=…&colour=…&size=…`.
 *
 * Навіщо. Фід Merchant Center (і будь-яка реклама товару) веде людину на
 * сторінку з ціною конкретного виробу. Без параметрів сторінка відкривається
 * з найдешевшим виробом — тобто реклама худі за 2 300 ₴ приводила б на
 * футболку за 1 190 ₴. Google звіряє ціну на посадковій із фідом і за
 * розбіжність знімає товар.
 *
 * У параметрах — слаги й підписи, а не uuid: адреса читається людиною і не
 * ламається, якщо варіант перестворили в адмінці з новим id.
 *
 * Побудова адреси й її розбір живуть поруч навмисно: фід і сторінка мусять
 * розуміти одне одного, і тест тримає їх разом.
 */
export const OFFER_PARAMS = { garment: 'garment', colour: 'colour', size: 'size' } as const;

export function printOfferPath(
  printSlug: string,
  pick: { garmentSlug: string; colourCode?: string; sizeLabel?: string },
): string {
  const q = new URLSearchParams({ [OFFER_PARAMS.garment]: pick.garmentSlug });
  if (pick.colourCode !== undefined) q.set(OFFER_PARAMS.colour, pick.colourCode);
  if (pick.sizeLabel !== undefined) q.set(OFFER_PARAMS.size, pick.sizeLabel);
  return `/prints/${printSlug}?${q.toString()}`;
}

export interface OfferPreselect {
  garmentId: string;
  fabricId: string;
  colourId: string | null;
  sizeId: string | null;
}

/**
 * Параметри адреси → початковий вибір на сторінці.
 *
 * Кожен рівень приймається, лише якщо такий варіант справді є: колір, якого
 * немає на цьому виробі, або розмір, якого немає в цьому кольорі, тихо
 * відкидаються — сторінка тоді поводиться як без них, а не показує
 * неіснуючу комбінацію з вимкненою кнопкою. Немає виробу — немає й решти:
 * колір без виробу не має сенсу.
 */
export function resolvePreselect(
  offer: Pick<PrintOfferDto, 'garments' | 'colours' | 'variants'>,
  params: URLSearchParams,
): OfferPreselect | null {
  const garmentSlug = params.get(OFFER_PARAMS.garment);
  const garment = garmentSlug === null ? undefined : offer.garments.find((g) => g.slug === garmentSlug);
  if (!garment) return null;

  const ofGarment = offer.variants.filter((v) => v.garmentId === garment.id);
  const colourCode = params.get(OFFER_PARAMS.colour);
  const colour = colourCode === null ? undefined : offer.colours.find((c) => c.supplierCode === colourCode);
  const ofColour = colour ? ofGarment.filter((v) => v.colourId === colour.id) : [];

  const sizeLabel = params.get(OFFER_PARAMS.size);
  const size = sizeLabel === null ? undefined : garment.sizes.find((s) => s.label === sizeLabel);
  const exact = size ? ofColour.find((v) => v.sizeId === size.id) : undefined;

  // Тканина береться з того варіанта, який знайшли: у виробу їх може бути
  // кілька, і колір або розмір є не в кожній.
  const anchor = exact ?? ofColour[0];
  const fabricId = anchor?.fabricId ?? garment.fabrics[0]?.id;
  if (fabricId === undefined) return null;

  return {
    garmentId: garment.id,
    fabricId,
    colourId: anchor ? anchor.colourId : null,
    sizeId: exact ? exact.sizeId : null,
  };
}
