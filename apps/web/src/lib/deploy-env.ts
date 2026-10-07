/**
 * Де крутиться ця збірка.
 *
 * Превʼю на Vercel дивиться в той самий API, що й прод: та сама база, ті
 * самі замовлення, той самий Monobank (див. API_ORIGIN у налаштуваннях
 * kudos-web — значення однакове для Production і Preview). Тому превʼю —
 * це «подивитись», а не «спробувати купити»: усе, що щось пише, тут
 * вимкнене (middleware.ts), а статистика й рекламні теги не вантажаться,
 * щоб тестові кліки не потрапили в кампанії.
 *
 * `VERCEL_ENV` ставить сам Vercel: production | preview | development.
 * Локально змінної немає — і це не превʼю.
 */
export function isPreviewDeploy(): boolean {
  return process.env['VERCEL_ENV'] === 'preview';
}

export function isProductionDeploy(): boolean {
  return process.env['VERCEL_ENV'] === 'production';
}

export const PREVIEW_READ_ONLY_MESSAGE =
  'Це тестова версія сайту: замовлення, заявки й оплата тут вимкнені.';
