/**
 * Хост API. У проді — адреса Railway/Render; локально — той самий :4000.
 * Переписування нижче робить так, що браузер завжди звертається до домену
 * сайту, а не до чужого: інакше cookie сесії з `sameSite: 'lax'` не
 * надсилалась би, і адмінка мовчки не працювала б у проді.
 */
const API_ORIGIN = process.env.API_ORIGIN ?? 'http://localhost:4000';

/**
 * Ребрендинг «Бабака» (вересень 2026) перейменував чотири колекції і всі
 * двадцять чотири принти Polo. Старі адреси лишати мертвими не можна з двох
 * причин, і друга неочевидна.
 *
 * Перша: на них є посилання — в пошуку, в чатах, у закладках.
 *
 * Друга: Next пререндерив ці сторінки під час збірки, ще зі старими даними.
 * Після перейменування API на них відповідає 404, але в кеші лишається
 * готовий HTML із назвою «Пес ін POLO №18» і без обкладинки — і саме його
 * бачить той, хто прийшов за старою адресою. Редирект перехоплює запит
 * раніше за кеш, тож стара сторінка перестає існувати як така.
 */
const RENAMED_COLLECTIONS = [
  ['pesy-zirky', 'zirky-z-babakamy'],
  ['ua-diiachi', 'babaka-ua'],
  ['pes-pub', 'babaky-v-pabi'],
  ['polo-style', 'polo-babaky'],
];

/** «Пес ін POLO №N» → порода. Номер той самий, що був у слагу. */
const RENAMED_POLO = {
  'polo-01': 'polo-siba-inu', 'polo-02': 'polo-toi-pudel', 'polo-03': 'polo-maltese',
  'polo-04': 'polo-shpits', 'polo-05': 'polo-korhi', 'polo-06': 'polo-kavaler-charlz',
  'polo-07': 'polo-mops', 'polo-08': 'polo-chikhuakhua', 'polo-09': 'polo-dzhek-rassel',
  'polo-10': 'polo-bishon-frize', 'polo-11': 'polo-taksa', 'polo-12': 'polo-retryver',
  'polo-13': 'polo-doberman', 'polo-14': 'polo-tsverhshnautser', 'polo-15': 'polo-bihl',
  'polo-16': 'polo-vestik', 'polo-17': 'polo-levretka', 'polo-18': 'polo-samoid',
  'polo-19': 'polo-dalmatyn', 'polo-20': 'polo-ksolo', 'polo-21': 'polo-bulterier',
  'polo-22': 'polo-labrador', 'polo-23': 'polo-amstaf', 'polo-24': 'polo-frantsuz',
};

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@dt/contracts'],
  poweredByHeader: false,
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${API_ORIGIN}/api/:path*` }];
  },
  async redirects() {
    return [
      /*
       * «Мистецтво бути шедевром» злито у Vintage (міграція
       * 20260907120000). Стара адреса вже могла розійтися посиланнями —
       * 301 веде їх на нову полицю, а не на 404.
       */
      { source: '/collections/mystetstvo', destination: '/collections/vintage', permanent: true },
      ...RENAMED_COLLECTIONS.map(([was, now]) => ({
        source: `/collections/${was}`, destination: `/collections/${now}`, permanent: true,
      })),
      ...Object.entries(RENAMED_POLO).map(([was, now]) => ({
        source: `/prints/${was}`, destination: `/prints/${now}`, permanent: true,
      })),
    ];
  },
  async headers() {
    return [{
      source: '/:path*',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      ],
    }];
  },
};
export default nextConfig;
