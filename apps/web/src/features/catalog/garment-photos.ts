/**
 * Які фото виробів у нас справді є.
 *
 * Файли лежать у `public/garments/<виріб>/<колір>.webp` — це кадри з
 * паспортів виробів, знятих із прозорим тлом. Реєстр згенеровано зі вмісту
 * теки, а не написано вручну, і саме тому він тут потрібен: без нього
 * компонент мусив би пробувати шлях і ловити `onError`, тобто малювати
 * зламану картинку, щоб дізнатися, що її немає. Дешевше знати заздалегідь.
 *
 * Оновити після додавання фото: `pnpm --filter @dt/web run gen:garment-photos`.
 */

/* eslint-disable */
// ЗГЕНЕРОВАНО. Не редагувати руками.
const PHOTOS: Readonly<Record<string, readonly string[]>> = {
  'futbolka-klasychna': ['akvamaryn', 'ananasovyi', 'antychna-troianda', 'bilyi', 'blakytnyi-safir', 'chervonyi', 'chornyi', 'derevianyi', 'mandarynovyi', 'slonova-kistka', 'smarahdovyi', 'stalevyi-siryi', 'temno-synii', 'zelenyi-mokh', 'zelenyi-nefryt'],
  'futbolka-oversayz-cholovicha': ['bilyi', 'chornyi', 'derevianyi', 'stalevyi-siryi', 'temno-synii'],
  'futbolka-oversayz-zhinocha': ['akvamaryn', 'bilyi', 'chornyi', 'rozhevyi'],
  'hibryd-hudi': ['chornyi', 'slonova-kistka'],
  'hibryd-svitshot': ['chornyi', 'slonova-kistka', 'temno-synii'],
  'hudi-klasychnyi': ['akvamaryn', 'ananasovyi', 'antychna-troianda', 'blakytnyi-safir', 'chervonyi', 'chornyi', 'khaki', 'mokryi-pisok', 'molochnyi-shokolad', 'slonova-kistka', 'smarahdovyi', 'stalevyi-siryi', 'svitlo-biriuzovyi', 'svitlyi-buzok', 'temna-vyshnia', 'temno-synii', 'zelenyi-marmur', 'zelenyi-nefryt'],
  'svitshot-klasychnyi': ['akvamaryn', 'ananasovyi', 'antychna-troianda', 'blakytnyi-safir', 'chervonyi', 'chornyi', 'khaki', 'mokryi-pisok', 'molochnyi-shokolad', 'slonova-kistka', 'smarahdovyi', 'stalevyi-siryi', 'svitlo-biriuzovyi', 'svitlyi-buzok', 'temna-vyshnia', 'temno-synii', 'zelenyi-marmur', 'zelenyi-nefryt'],
};

/** Шлях до фото виробу в кольорі, або null — якщо такого кадру немає. */
export function garmentPhoto(garmentSlug: string, colourCode: string): string | null {
  return PHOTOS[garmentSlug]?.includes(colourCode) === true
    ? `/garments/${garmentSlug}/${colourCode}.webp`
    : null;
}

/** Скільки кольорів виробу ми можемо показати кадром. */
export function garmentPhotoCount(garmentSlug: string): number {
  return PHOTOS[garmentSlug]?.length ?? 0;
}
