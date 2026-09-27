import type { PrintSizeTier } from '@dt/contracts';
import { garmentPhoto } from './garment-photos';
import { PREVIEW_PHOTOS } from './preview-photos.generated';
import { COLLECTION_PLACEMENTS, PRINT_PLACEMENTS } from './print-placement.generated';

/**
 * Орієнтовний вигляд: де саме й якого розміру лежить принт на фото виробу.
 *
 * Раніше зону друку виводили з силуету речі й масштабували за ярусом
 * MINI/MEDIUM/MAXI. Виходило «приблизно», і на різних виробах — по-різному.
 * Тепер розташування не вгадується, а знімається з прикладів, які власник
 * склав руками («Приклади розташування принтів»): один принт на семи
 * виробах. `tools/print-preview.py placements` накладає наш власний макет
 * на те саме фото й підганяє центр, розмір і кут, доки картинка не
 * збіжеться з прикладом, — і записує результат сюди.
 *
 * Колір на прикладі випадковий і нічого не значить: фото виробу в усіх
 * кольорах зняті в одному кадрі, тож рамка переноситься на будь-який колір.
 *
 * Порядок пошуку:
 *   1. приклад саме цього принта (Бабаки з зірками, Бабаки UA — кожен свій);
 *   2. приклад колекції (Бабаки в пабі, Поло Бабаки — усі одного розміру);
 *   3. запасна рамка — поки для принта немає прикладу.
 */
export interface Placement {
  /** Центр рамки, частки ширини й висоти кадру. */
  readonly cx: number;
  readonly cy: number;
  /** Розмір рамки, частки ширини й висоти кадру. Принт вписується в неї. */
  readonly w: number;
  readonly h: number;
  /** Кут у градусах за годинниковою: на розкладках річ лежить навскоси. */
  readonly rot: number;
}

/** Класична футболка лишається на своїх плоских фото — рішення власника. */
const PASSPORT_GARMENTS = new Set(['futbolka-klasychna']);

export interface PreviewBase {
  readonly src: string;
  /** Ширина / висота кадру — щоб перевести частки в пікселі для кута. */
  readonly aspect: number;
  /** Плоске фото на прозорому тлі, а не сцена: малюється з полями. */
  readonly flat: boolean;
}

const SCENE_ASPECT = 1200 / 1697;

export function previewBase(garmentSlug: string, colourCode: string): PreviewBase | null {
  if (PASSPORT_GARMENTS.has(garmentSlug)) {
    const src = garmentPhoto(garmentSlug, colourCode);
    return src ? { src, aspect: 1, flat: true } : null;
  }
  return PREVIEW_PHOTOS[garmentSlug]?.includes(colourCode) === true
    ? { src: `/garments-preview/${garmentSlug}/${colourCode}.webp`, aspect: SCENE_ASPECT, flat: false }
    : null;
}

/**
 * Запасна рамка — з принта «Семюел Джексон» (MAXI, перший приклад серед
 * «Зірок»). Менші яруси зменшуються від неї, тримаючи верхній край:
 * друк «росте вниз» від лінії грудей, як у житті.
 */
const FALLBACK_PRINT = 'zirky-semiuel';
const TIER_SCALE: Readonly<Record<PrintSizeTier, number>> = { MINI: 0.55, MEDIUM: 0.8, MAXI: 1 };

export type PlacementSource = 'print' | 'collection' | 'fallback';

export function placementFor(
  printSlug: string,
  collectionSlugs: readonly string[],
  garmentSlug: string,
  tier: PrintSizeTier,
  aspect: number,
): { placement: Placement; source: PlacementSource } | null {
  const own = PRINT_PLACEMENTS[printSlug]?.[garmentSlug];
  if (own) return { placement: own, source: 'print' };

  for (const slug of collectionSlugs) {
    const fromCollection = COLLECTION_PLACEMENTS[slug]?.[garmentSlug];
    if (fromCollection) return { placement: fromCollection, source: 'collection' };
  }

  const base = PRINT_PLACEMENTS[FALLBACK_PRINT]?.[garmentSlug];
  if (!base) return null;
  return { placement: shrinkFromTop(base, TIER_SCALE[tier], aspect), source: 'fallback' };
}

/**
 * Зменшити рамку в k разів, лишивши на місці її верхній край. Край
 * повернутий разом із рамкою, тож зсув центру теж іде вздовж повернутої
 * осі — рахуємо в пікселях кадру, де кут справжній.
 */
export function shrinkFromTop(p: Placement, k: number, aspect: number): Placement {
  if (k === 1) return p;
  const hPx = p.h;               // висота в одиницях висоти кадру
  const shift = (hPx * (1 - k)) / 2;
  const rad = (p.rot * Math.PI) / 180;
  // Локальна вісь «вниз» після повороту за годинниковою: (-sin, cos).
  const dxPx = -Math.sin(rad) * shift; // в одиницях висоти кадру
  const dyPx = Math.cos(rad) * shift;
  return {
    cx: p.cx + dxPx / aspect,
    cy: p.cy + dyPx,
    w: p.w * k,
    h: p.h * k,
    rot: p.rot,
  };
}
