/**
 * Які фото виробів у нас справді є.
 *
 * Паспортні кадри лежать у `public/garments/<виріб>/<колір>.webp`, знімальні —
 * у `public/garments/<виріб>/views/<колір>/<ракурс>.webp`. Реєстр згенеровано
 * зі вмісту теки, а не написано вручну, і саме тому він тут потрібен: без
 * нього компонент мусив би пробувати шлях і ловити `onError`, тобто малювати
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

const VIEWS: Readonly<Record<string, Readonly<Record<string, readonly string[]>>>> = {
  'futbolka-klasychna': {
    'akvamaryn': ['manfront', 'ladyfront'],
    'ananasovyi': ['manfront', 'ladyfront'],
    'antychna-troianda': ['manfront', 'ladyfront'],
    'bilyi': ['manfront', 'ladyfront'],
    'blakytnyi-safir': ['manfront', 'ladyfront'],
    'chervonyi': ['manfront', 'ladyfront'],
    'chornyi': ['manfront', 'ladyfront'],
    'derevianyi': ['manfront', 'ladyfront'],
    'mandarynovyi': ['manfront', 'ladyfront'],
    'slonova-kistka': ['manfront', 'ladyfront'],
    'smarahdovyi': ['manfront', 'ladyfront'],
    'stalevyi-siryi': ['manfront', 'ladyfront'],
    'temno-synii': ['manfront', 'ladyfront'],
    'zelenyi-nefryt': ['manfront', 'ladyfront'],
  },
  'futbolka-oversayz-cholovicha': {
    'bilyi': ['manfront', 'ladyfront', 'manback', 'nopeople'],
    'chornyi': ['manfront', 'ladyfront', 'manback', 'nopeople'],
    'derevianyi': ['manfront', 'ladyfront', 'manback', 'nopeople'],
    'stalevyi-siryi': ['manfront', 'ladyfront', 'manback', 'nopeople'],
    'temno-synii': ['manfront', 'ladyfront', 'manback', 'nopeople'],
  },
  'futbolka-oversayz-zhinocha': {
    'akvamaryn': ['front', 'back', 'nopeople'],
    'bilyi': ['front', 'back', 'nopeople'],
    'chornyi': ['front', 'back', 'nopeople'],
    'rozhevyi': ['front', 'back', 'nopeople'],
  },
  'hibryd-hudi': {
    'chornyi': ['manfront', 'ladyfront', 'manback', 'nopeople'],
    'slonova-kistka': ['manfront', 'ladyfront', 'manback', 'nopeople'],
  },
  'hibryd-svitshot': {
    'chornyi': ['manfront', 'ladyfront', 'ladyback', 'nopeople'],
    'slonova-kistka': ['manfront', 'ladyfront', 'manback', 'nopeople'],
    'temno-synii': ['manfront', 'ladyfront', 'manback', 'nopeople'],
  },
  'hudi-klasychnyi': {
    'akvamaryn': ['man', 'lady', 'nopeople'],
    'ananasovyi': ['man', 'lady', 'nopeople'],
    'antychna-troianda': ['man', 'lady', 'nopeople'],
    'blakytnyi-safir': ['man', 'lady', 'nopeople'],
    'chervonyi': ['man', 'lady', 'nopeople'],
    'chornyi': ['man', 'lady', 'nopeople'],
    'khaki': ['man', 'lady', 'nopeople'],
    'mokryi-pisok': ['man', 'lady', 'nopeople'],
    'molochnyi-shokolad': ['man', 'nopeople'],
    'slonova-kistka': ['man', 'lady', 'nopeople'],
    'smarahdovyi': ['man', 'lady', 'nopeople'],
    'stalevyi-siryi': ['man', 'lady', 'nopeople'],
    'svitlo-biriuzovyi': ['man', 'lady', 'nopeople'],
    'svitlyi-buzok': ['man', 'lady', 'nopeople'],
    'temna-vyshnia': ['man', 'lady', 'nopeople'],
    'temno-synii': ['man', 'lady', 'nopeople'],
    'zelenyi-marmur': ['man', 'lady', 'nopeople'],
    'zelenyi-nefryt': ['man', 'lady', 'nopeople'],
  },
  'svitshot-klasychnyi': {
    'akvamaryn': ['man', 'lady', 'nopeople'],
    'ananasovyi': ['man', 'lady', 'nopeople'],
    'antychna-troianda': ['man', 'lady', 'nopeople'],
    'blakytnyi-safir': ['man', 'lady', 'nopeople'],
    'chervonyi': ['man', 'lady', 'nopeople'],
    'chornyi': ['man', 'lady', 'nopeople'],
    'khaki': ['man', 'lady', 'nopeople'],
    'mokryi-pisok': ['man', 'lady', 'nopeople'],
    'molochnyi-shokolad': ['man', 'lady', 'nopeople'],
    'slonova-kistka': ['man', 'lady', 'nopeople'],
    'smarahdovyi': ['man', 'lady', 'nopeople'],
    'stalevyi-siryi': ['man', 'lady', 'nopeople'],
    'svitlo-biriuzovyi': ['man', 'lady', 'nopeople'],
    'svitlyi-buzok': ['man', 'lady', 'nopeople'],
    'temna-vyshnia': ['man', 'lady', 'nopeople'],
    'temno-synii': ['man', 'lady', 'nopeople'],
    'zelenyi-marmur': ['man', 'lady', 'nopeople'],
    'zelenyi-nefryt': ['man', 'lady', 'nopeople'],
  },
};

/** Шлях до паспортного фото виробу в кольорі, або null — якщо кадру немає. */
export function garmentPhoto(garmentSlug: string, colourCode: string): string | null {
  return PHOTOS[garmentSlug]?.includes(colourCode) === true
    ? `/garments/${garmentSlug}/${colourCode}.webp`
    : null;
}

/** Скільки кольорів виробу ми можемо показати кадром. */
export function garmentPhotoCount(garmentSlug: string): number {
  return PHOTOS[garmentSlug]?.length ?? 0;
}

export interface GarmentView {
  readonly view: string;
  readonly src: string;
}

/** Знімальні кадри виробу в кольорі, вже у правильному порядку показу. */
export function garmentViews(garmentSlug: string, colourCode: string): readonly GarmentView[] {
  const views = VIEWS[garmentSlug]?.[colourCode] ?? [];
  return views.map((view) => ({
    view,
    src: `/garments/${garmentSlug}/views/${colourCode}/${view}.webp`,
  }));
}

/** Головний кадр картки: знімальний, якщо є, інакше паспортний. */
export function garmentCardPhoto(garmentSlug: string, colourCode: string): string | null {
  return garmentViews(garmentSlug, colourCode)[0]?.src ?? garmentPhoto(garmentSlug, colourCode);
}

/** Людські підписи ракурсів для галереї та alt-текстів. */
export function viewLabel(view: string): string {
  switch (view) {
    case 'man':
    case 'manfront': return 'На ньому';
    case 'lady':
    case 'ladyfront': return 'На ній';
    case 'front': return 'Спереду';
    case 'back':
    case 'manback': return 'Спина';
    case 'ladyback': return 'Спина, на ній';
    case 'nopeople': return 'Річ';
    default: return view;
  }
}
