/**
 * Соцмережі бренду, яких немає в налаштуваннях з адмінки.
 *
 * Instagram живе тут, а не в `SiteSettings`: щоб завести поле в адмінці,
 * потрібна міграція БД, а нік змінюється раз на роки. Порожній рядок
 * ховає всі посилання на Instagram по сайту й сторінку `/insta`.
 */
export const INSTAGRAM_HANDLE: string = 'babaka_club';

export const INSTAGRAM_URL = INSTAGRAM_HANDLE === '' ? '' : `https://www.instagram.com/${INSTAGRAM_HANDLE}/`;
