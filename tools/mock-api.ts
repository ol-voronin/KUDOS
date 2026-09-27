/**
 * Підробний API — щоб побачити сайт очима, без бази.
 *
 * Навіщо це існує. Вітрину двічі віддавали, не подивившись на неї з
 * реальним вмістом: локально не було ні бази, ні API, а без них головна
 * рендериться як заглушка «сторінка оновлюється». Дивитися на порожню
 * сторінку й вирішувати, що дизайн готовий, — і є та помилка, через яку
 * довелося все відкочувати.
 *
 * Цей файл віддає ті самі контракти, що й справжній API, з тих самих сідів,
 * і підставляє фото з мокапів у `apps/web/public/mock/`.
 *
 *   npx tsx tools/mock-api.ts                       # :3001
 *   cd apps/web && API_INTERNAL_URL=http://localhost:3001/api/v1 \
 *     NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1 npx next dev
 *
 * Це інструмент розробки, а не частина застосунку: у продакшн він не
 * потрапляє й нічого про справжню базу не знає.
 */
import http from 'node:http';
import { HOME_PAGE } from '../apps/api/prisma/pages/home';
import { OWN_IDEA } from '../apps/api/prisma/pages/marketing';

const P = (n) => `/mock/${n}.jpg`;
const PHOTOS = ['art-black','art-white','art-pair','boss-w','boss-chi','boss-pit',
  'cow-full','cow-black','cow-olive','cow-red','cow-purple','cow-yellow','boss-kit','cow-green','cow-zone','hero'];

const uuid = (i) => `00000000-0000-4000-8000-${String(i).padStart(12,'0')}`;

const SETTINGS = {
  brand: 'Бабака', legalEntityName: 'Фізична особа-підприємець Воронін Олексій Петрович',
  taxNumber: '3442812170', city: 'Харків', cityIn: 'у Харкові',
  phone: '+380508646355', phoneDisplay: '+380 50 864 63 55',
  telegram: 'kudos_print', telegramUrl: 'https://t.me/kudos_print',
  email: 'kudos.print.ua@gmail.com', returnDays: 14,
  // Саме `freeShippingFromMinor` і `legalEntityShort` — так називає ці поля
  // контракт. Поки тут стояли `freeShippingFrom` та порожнеча, `/content/site`
  // не проходив схему, сайт тихо падав на запасне меню, і локальна перевірка
  // показувала не те меню, яке ми щойно змінили.
  legalEntityShort: 'ФОП Воронін О. П.',
  workingHours: 'Пн–Пт, 10:00–19:00',
  freeShippingFromMinor: 150000,
  productionDaysMin: 4, productionDaysMax: 7,
  ga4MeasurementId: '', googleAdsId: '',
  allowIndexing: false, defaultOgImage: '', googleSiteVerification: '',
};

const MENU = [
  ['Породи','/breeds','HEADER',''],['Колекції','/collections','HEADER',''],
  ['Базовий одяг','/vyroby','HEADER',''],['Свій принт','/svoya-ideya','HEADER',''],
  ['Магазин','/prints','FOOTER','Магазин'],['За породами','/#породи','FOOTER','Магазин'],
  ['Свій принт','/svoya-ideya','FOOTER','Магазин'],
  ['Розміри','/vyroby','FOOTER','Допомога'],['Оплата й доставка','/dostavka','FOOTER','Допомога'],
  ['Оферта','/oferta','FOOTER','Документи'],['Політика приватності','/pryvatnist','FOOTER','Документи'],
].map(([label,href,area,group],i)=>({id:uuid(900+i),label,href,area,group,position:i*10,isActive:true}));

const BREEDS = ['Бігль','Вест-хайленд-терʼєр','Джек-рассел терʼєр','Доберман','Золотистий ретривер',
  'Йоркширський терʼєр','Коргі','Лабрадор','Мальтіпу','Метис','Мопс','Німецька вівчарка']
  .map((name,i)=>({
    id: uuid(100+i), slug: `breed-${i}`, name,
    printCount: i % 5 === 4 ? 0 : 1 + (i%4),
    // Кожна пʼята порода навмисно без превʼю: плитка з лапою має бути видна
    // на екрані, а не тільки в коді.
    previewUrl: i % 5 === 4 ? '' : P(PHOTOS[i % 12]),
  }));

const PRINT_TITLES = [
  ['Мистецтво бути шедевром · чорна', 'art-black', 129000, true],
  ['Мистецтво бути шедевром · біла', 'art-white', 129000, true],
  ['Парний набір «Мистецтво»', 'art-pair', 219000, false],
  ['Бос дзвонить · лабрадор', 'boss-w', 119000, true],
  ['Бос дзвонить · чихуахуа', 'boss-chi', 119000, true],
  ['Бос дзвонить · стафорд', 'boss-pit', 119000, false],
  ['Call of Woof · олива', 'cow-full', 129000, true],
  ['Dog Zone · чорна', 'cow-black', 129000, true],
  ['Call of Woof · крупний принт', 'cow-olive', 129000, true],
  ['Call of Woof · кане-корсо', 'cow-red', 129000, false],
  ['Call of Woof · постер', 'cow-purple', 99000, true],
  ['Dog Zone · вузький принт', 'cow-yellow', 119000, true],
];
const PRINTS = PRINT_TITLES.map(([title,photo,price,inStock],i)=>({
  id: uuid(200+i), slug: `print-${i}`, title, sizeTier: 'MEDIUM',
  previewUrl: P(photo), fromPriceMinor: price, inStock,
}));

const COLLECTIONS = [
  ['Мистецтво бути шедевром','Шість полотен, які знає кожен. І шість морд, які знаєте тільки ви.',['art-black','art-white','art-pair']],
  ['Бос дзвонить','Екран вхідного дзвінка. У колі — ваш пес.',['boss-w','boss-chi','boss-pit']],
  ['Call of Woof','Welcome to blackout, soldier.',['cow-full','cow-black','cow-red']],
].map(([title,description,ph],i)=>({
  id: uuid(300+i), slug: `collection-${i}`, title, description,
  printCount: 4, previewUrls: ph.map(P),
}));

/*
 * Ті самі підстановки, що й у справжньому API (`tokenValues`), а не просто
 * ключі налаштувань: частина токенів має інші назви (`freeShippingFrom` —
 * гривні, а не копійки; `phone` — той, що для показу). Поки мок брав ключі
 * навпростець, на сторінці лишався напис «від {{freeShippingFrom}} ₴», і
 * незрозуміло було, це помилка сайту чи мока.
 */
const TOKENS = {
  ...SETTINGS,
  phone: SETTINGS.phoneDisplay,
  legalEntity: SETTINGS.legalEntityName,
  returnDays: String(SETTINGS.returnDays),
  freeShippingFrom: String(Math.round(SETTINGS.freeShippingFromMinor / 100)),
  productionDays: `${SETTINGS.productionDaysMin}–${SETTINGS.productionDaysMax}`,
};

function subst(v) {
  if (typeof v === 'string') return v.replace(/\{\{(\w+)\}\}/g, (m,k)=> String(TOKENS[k] ?? m));
  if (Array.isArray(v)) return v.map(subst);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k,x])=>[k,subst(x)]));
  return v;
}

const NOW = '2026-08-26T12:00:00.000Z';
const page = (seed) => subst({
  slug: seed.slug, kind: seed.kind === 'SYSTEM' ? 'SYSTEM' : seed.kind, locale: 'UK',
  title: seed.title, excerpt: seed.excerpt ?? '', coverUrl: '',
  seo: { title: seed.seoTitle ?? '', description: seed.seoDescription ?? '', noindex: false },
  publishedAt: NOW, updatedAt: NOW, readingMinutes: 2,
  breeds: [], collections: [], blocks: seed.blocks,
});

/*
 * Вироби, кольори й розміри — спільні для трьох маршрутів: пропозиції принта,
 * асортименту (/catalog/range) і сторінки базового одягу (/catalog/garments).
 * Один набір даних — інакше локальна перевірка показує різні магазини на
 * різних сторінках.
 */
const G = (n) => uuid(400 + n);
const C = (n) => uuid(500 + n);
const S = (n) => uuid(600 + n);
const F = (n) => uuid(650 + n);
const SIZES = ['S', 'M', 'L', 'XL'].map((label, i) => ({
  id: S(i), label, position: i,
  measurements: [
    { key: 'LENGTH', value: String(68 + i * 2) },
    { key: 'WIDTH', value: String(48 + i * 3) },
  ],
}));
const fabric = (n, name, gsm, comp) => ({ id: F(n), name, weightGsm: gsm, composition: comp, origin: null });
const GARMENTS = [
  { id: G(0), slug: 'futbolka-klasychna', line: 'OWN_PRODUCTION', type: 'TSHIRT', fit: 'CLASSIC',
    name: 'Класична футболка', lengthAdjustable: true, basePriceMinor: 89000,
    description: 'Прямий крій, щільний трикотаж, не просвічує. Пасує всім, з ким ми досі мали справу.',
    fabrics: [fabric(0, 'Кулір 190', 190, '100 % бавовна')], sizes: SIZES },
  { id: G(1), slug: 'futbolka-oversayz-cholovicha', line: 'OWN_PRODUCTION', type: 'TSHIRT', fit: 'OVERSIZE',
    name: 'Оверсайз футболка', lengthAdjustable: true, basePriceMinor: 99000,
    description: 'Справжній оверсайз: спущене плече, вільний корпус. Бери свій розмір, не менший.',
    fabrics: [fabric(1, 'Кулір 220', 220, '100 % бавовна')], sizes: SIZES },
  { id: G(2), slug: 'hudi-klasychnyi', line: 'NATIVE_SPIRIT', type: 'HOODIE', fit: 'CLASSIC',
    name: 'Худі', lengthAdjustable: false, basePriceMinor: 179000,
    description: 'Native Spirit, органічна бавовна з начосом. Сертифікати — на сторінці «Вироби».',
    fabrics: [fabric(2, 'Трьохнитка з начосом', 300, '85 % органічна бавовна, 15 % поліестер')], sizes: SIZES },
];
// supplierCode = імена файлів у public/garments/*: мокапи й превʼю виробу
// знаходять фото саме за цим кодом, як і на проді.
const COLOURS = [
  { id: C(0), name: 'Чорний', supplierCode: 'chornyi', hex: '#111111', imageUrl: null },
  { id: C(1), name: 'Молочний', supplierCode: 'slonova-kistka', hex: '#f2efe8', imageUrl: null },
];
function variantsFor(garments) {
  const variants = [];
  garments.forEach((g, gi) => COLOURS.forEach((c, ci) => SIZES.forEach((sz, si) => {
    const unavailable = g.slug === 'hudi-klasychnyi' && si === 3;   // худі XL — немає
    const madeToOrder = ci === 1 && si >= 2;              // молочний від L — під замовлення
    variants.push({
      id: uuid(1000 + gi * 100 + ci * 10 + si),
      sku: `${g.slug}-${c.supplierCode}-${sz.label}`,
      garmentId: g.id, fabricId: g.fabrics[0].id, colourId: c.id, sizeId: sz.id,
      availability: unavailable ? 'UNAVAILABLE' : madeToOrder ? 'MADE_TO_ORDER' : 'IN_STOCK',
      leadTimeDays: madeToOrder ? 5 : null,
      priceOverrideMinor: null,
      priceMinor: g.basePriceMinor + si * 3000,
    });
  })));
  return variants;
}

/*
 * ── Адмінка в моку ─────────────────────────────────────────────────────
 *
 * Досі мок покривав лише вітрину, і кожен адмінський екран їхав до
 * замовника неподивленим — бо справжня адмінка за логіном, а пароль не
 * наш. Тепер мок відповідає на /auth/me і тримає колекції В ПАМʼЯТІ:
 * можна клікати створення, перейменування, порядок і принти — і бачити,
 * що зберігається (до перезапуску мока, чого для перевірки досить).
 */
const ADMIN_NOW = () => new Date().toISOString();
const ADMIN_PRINTS = PRINTS.map((p, i) => ({
  id: p.id, slug: p.slug, title: p.title, sizeTier: 'MEDIUM',
  previewUrl: p.previewUrl, artworkKey: '', mockupUrl: '', isPublished: p.inStock,
  // Контракт вимагає СПРАВЖНІЙ URL у фото (z.string().url()) — відносний
  // шлях тихо валив схему, і пікер вічно крутив скелетони.
  images: [{ id: uuid(800 + i), url: `http://localhost:3010${p.previewUrl}`, pathname: `mock/${i}`, alt: p.title, position: 0 }],
  breeds: [], collections: [], excludedColourIds: [],
  createdAt: NOW, updatedAt: NOW,
}));
const printRef = (p) => ({ id: p.id, slug: p.slug, title: p.title, previewUrl: p.previewUrl, isPublished: p.isPublished });
let ADMIN_COLLECTIONS = COLLECTIONS.map((c, i) => ({
  id: c.id, slug: c.slug, title: c.title, description: c.description,
  position: (i + 1) * 10, isPublished: i < 2,
  prints: ADMIN_PRINTS.slice(i * 3, i * 3 + 3).map(printRef),
  createdAt: NOW, updatedAt: NOW,
}));
const collectionsSorted = () => [...ADMIN_COLLECTIONS].sort((a, b) => a.position - b.position);

const ROUTES = {
  '/auth/me': () => ({ email: 'dasha@local.dev' }),
  '/admin/leads': () => ({ items: [], total: 0, page: 1, perPage: 20 }),
  '/admin/collections': () => ({ items: collectionsSorted() }),
  '/content/site': () => ({ settings: SETTINGS, menu: MENU }),
  '/content/pages/home': () => page(HOME_PAGE),
  '/content/pages/svoya-ideya': () => page(OWN_IDEA),
  '/catalog/home': () => ({ breeds: BREEDS, collections: COLLECTIONS,
    newPrints: PRINTS.slice(0,8), readyToShip: PRINTS.filter(p=>p.inStock).slice(0,8), totalPrints: PRINTS.length }),
  '/catalog/breeds': () => ({ items: BREEDS }),
  '/catalog/collections': () => ({ items: COLLECTIONS }),
  '/analytics/config': () => ({ googleAdsId: '', ga4MeasurementId: '', conversions: [] }),
  '/catalog/range': () => ({
    garments: GARMENTS.map((g) => ({
      ...g,
      colours: COLOURS.map((c) => ({ ...c, hasPhoto: false })),
      leadTimeDays: 5,
    })),
    printPrices: [{ tier: 'MEDIUM', priceMinor: 30000 }],
  }),
};

const CORS = (origin) => ({
  // `apiFetch` ходить із `credentials: 'include'` і заголовком `content-type`,
  // тож браузер спершу питає дозволу (preflight). Поки мок на нього не
  // відповідав, живий пошук у локальній перевірці мовчки не працював — і ми
  // вкотре дивилися б не на те, що змінили.
  'access-control-allow-origin': origin ?? '*',
  'access-control-allow-credentials': 'true',
  'access-control-allow-headers': 'content-type',
  'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS',
  'vary': 'Origin',
});

http.createServer(async (req,res)=>{
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS(req.headers.origin));
    res.end();
    return;
  }
  const url = new URL((req.url ?? '/').replace(/^\/api\/v1/, ''), 'http://x');

  // POST-и кошика й каси приходять із тілом — читаємо його один раз тут.
  let json = null;
  if (req.method === 'POST' || req.method === 'PATCH' || req.method === 'DELETE') {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    try { json = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); } catch { json = {}; }
  }

  let body = null;
  let status = null;
  if (req.method === 'GET' && ROUTES[url.pathname]) body = ROUTES[url.pathname]();
  else if (url.pathname === '/catalog/prints') {
    const perPage = Number(url.searchParams.get('perPage') ?? 12);
    body = { items: PRINTS.slice(0, perPage), total: PRINTS.length, page: 1, perPage };
  } else if (url.pathname === '/content/pages') body = { items: [] };
  else if (url.pathname === '/analytics/events') body = { ok: true };
  else if (url.pathname.startsWith('/catalog/prints/')) {
    // Один принт на трьох виробах, у двох кольорах і чотирьох розмірах —
    // рівно стільки, щоб побачити всі стани картки товару: вибір виробу,
    // кольору, розміру, «під замовлення» й «немає».
    const slug = url.pathname.split('/').pop();
    const p = PRINTS.find((x) => x.slug === slug) ?? PRINTS[0];
    body = {
      print: { id: p.id, slug: p.slug, title: p.title, sizeTier: 'MEDIUM',
        collectionSlugs: ['collection-0'], breedSlugs: ['breed-6'],
        previewUrl: p.previewUrl, mockupUrl: '/mock/artwork-demo.png', isPublished: true },
      images: PHOTOS.slice(0, 4).map((n) => ({ url: P(n), alt: p.title })),
      garments: GARMENTS, variants: variantsFor(GARMENTS), colours: COLOURS, printPriceMinor: 40000,
    };
  }
  else if (url.pathname.startsWith('/catalog/garments/')) {
    // Базовий одяг: той самий виріб, ті самі варіанти — без принта.
    const slug = url.pathname.split('/').pop();
    const g = GARMENTS.find((x) => x.slug === slug);
    if (g) {
      body = { garment: g, variants: variantsFor([g]), colours: COLOURS };
    }
  }
  else if (url.pathname === '/cart/quote') {
    // Мок рахує кошик грубо — по 1290 ₴ за позицію: перевіряємо верстку
    // сторінки, а не ціноутворення (воно перевіряється тестами в apps/api).
    const items = (json?.items ?? []);
    const lines = items.map((it, i) => {
      // printSlug: null — базовий одяг: рядок без принта, ціна самої речі.
      const blank = it.printSlug == null;
      const p = blank ? null : (PRINTS.find((x) => x.slug === it.printSlug) ?? PRINTS[i % PRINTS.length]);
      const g = GARMENTS.find((x) => x.id === variantsFor(GARMENTS).find((v) => v.id === it.variantId)?.garmentId) ?? GARMENTS[0];
      const unit = blank ? g.basePriceMinor : p.fromPriceMinor;
      const qty = it.quantity ?? 1;
      const discount = qty >= 2 ? Math.round(unit * qty * 0.1) : 0;
      return {
        printSlug: blank ? null : it.printSlug, variantId: it.variantId, quantity: qty,
        title: blank ? g.name : p.title,
        garmentName: g.name, garmentSlug: g.slug, colourName: 'Чорний',
        sizeLabel: 'M', previewUrl: blank ? '' : p.previewUrl,
        unitMinor: unit, lineTotalMinor: unit * qty - discount,
        discountName: discount > 0 ? 'Друга річ −10 %' : null, discountMinor: discount,
        blockedReason: i === 99 ? 'Знято з продажу' : null,
        leadTimeDays: blank ? null : (p.inStock ? null : 7),
      };
    });
    const subtotal = lines.reduce((s2, l) => s2 + l.unitMinor * l.quantity, 0);
    const discountMinor = lines.reduce((s2, l) => s2 + l.discountMinor, 0);
    body = {
      lines, subtotalMinor: subtotal, discountMinor, shippingMinor: 0,
      freeShippingFromMinor: SETTINGS.freeShippingFromMinor,
      totalMinor: subtotal - discountMinor,
      maxLeadTimeDays: 7, purchasable: lines.length > 0,
    };
  } else if (url.pathname === '/checkout/order') {
    body = { orderId: uuid(700), orderNumber: 42, totalMinor: 258000 };
  } else if (url.pathname.startsWith('/orders/') && url.pathname.endsWith('/status')) {
    // /order/paid дає оплачене замовлення — інакше локально нема як
    // перевірити подію покупки: справжній статус ставить вебхук Monobank.
    body = {
      orderNumber: 42,
      status: url.pathname.includes('/paid/') ? 'PAID' : 'NEW',
      totalMinor: 258000,
    };
  }
  // ── адмінські маршрути (в памʼяті) ──────────────────────────────────
  else if (url.pathname === '/admin/prints' && req.method === 'GET') {
    const q = (url.searchParams.get('q') ?? '').toLowerCase();
    const perPage = Number(url.searchParams.get('perPage') ?? 20);
    const all = ADMIN_PRINTS.filter((p) => !q || p.title.toLowerCase().includes(q) || p.slug.includes(q));
    body = { items: all.slice(0, perPage), total: all.length, page: 1, perPage };
  }
  else if (url.pathname === '/admin/prints/options') {
    body = { breeds: [], collections: ADMIN_COLLECTIONS.map((c) => ({ id: c.id, slug: c.slug, name: c.title })), colours: [] };
  }
  else if (url.pathname === '/admin/collections/reorder' && req.method === 'PATCH') {
    (json?.ids ?? []).forEach((id, i) => {
      const c = ADMIN_COLLECTIONS.find((x) => x.id === id);
      if (c) c.position = (i + 1) * 10;
    });
    body = { items: collectionsSorted() };
  }
  else if (url.pathname === '/admin/collections' && req.method === 'POST') {
    const c = {
      id: uuid(3000 + ADMIN_COLLECTIONS.length), slug: json?.slug ?? 'nova', title: json?.title ?? 'Нова',
      description: json?.description ?? '', isPublished: json?.isPublished ?? false,
      position: Math.max(0, ...ADMIN_COLLECTIONS.map((x) => x.position)) + 10,
      prints: [], createdAt: ADMIN_NOW(), updatedAt: ADMIN_NOW(),
    };
    ADMIN_COLLECTIONS.push(c);
    body = c;
    status = 201;
  }
  else if (/^\/admin\/collections\/[^/]+\/prints$/.test(url.pathname) && req.method === 'POST') {
    const c = ADMIN_COLLECTIONS.find((x) => x.id === url.pathname.split('/')[3]);
    if (c) {
      for (const pid of json?.printIds ?? []) {
        if (!c.prints.some((p) => p.id === pid)) {
          const p = ADMIN_PRINTS.find((x) => x.id === pid);
          if (p) c.prints.push(printRef(p));
        }
      }
      c.updatedAt = ADMIN_NOW();
      body = c;
      status = 201;
    }
  }
  else if (/^\/admin\/collections\/[^/]+\/prints\/[^/]+$/.test(url.pathname) && req.method === 'DELETE') {
    const parts = url.pathname.split('/');
    const c = ADMIN_COLLECTIONS.find((x) => x.id === parts[3]);
    if (c) {
      c.prints = c.prints.filter((p) => p.id !== parts[5]);
      c.updatedAt = ADMIN_NOW();
      body = c;
    }
  }
  else if (/^\/admin\/collections\/[^/]+$/.test(url.pathname)) {
    const id = url.pathname.split('/').pop();
    const c = ADMIN_COLLECTIONS.find((x) => x.id === id);
    if (c && req.method === 'PATCH') {
      for (const k of ['title', 'slug', 'description', 'isPublished']) {
        if (json?.[k] !== undefined) c[k] = json[k];
      }
      c.updatedAt = ADMIN_NOW();
      body = c;
    } else if (c && req.method === 'DELETE') {
      if (c.prints.length > 0) {
        body = { code: 'CONFLICT', message: `У колекції ${c.prints.length} принт(и). Спершу приберіть їх.` };
        status = 409;
      } else {
        ADMIN_COLLECTIONS = ADMIN_COLLECTIONS.filter((x) => x.id !== id);
        body = { ok: true };
      }
    } else if (c) {
      body = c;
    }
  }
  else if (url.pathname === '/catalog/search') {
    const q = (url.searchParams.get('q') ?? '').trim().toLowerCase();
    const hit = (t) => t.toLowerCase().includes(q);
    const breeds = q.length < 2 ? [] : BREEDS.filter((b) => hit(b.name));
    const collections = q.length < 2 ? [] : COLLECTIONS.filter((c) => hit(c.title));
    const prints = q.length < 2 ? [] : PRINTS.filter((p) => hit(p.title));
    body = { query: q, breeds, collections, prints,
      total: breeds.length + collections.length + prints.length };
  }
  // Браузер ходить сюди з іншого порту — без цих заголовків живий пошук у
  // локальній перевірці мовчки падає на CORS, і ми знову дивимося не на те.
  // `apiFetch` ходить із `credentials: 'include'`, а на такий запит браузер
  // не приймає відповідь із `origin: *` — тільки з конкретним джерелом і
  // дозволом на облікові дані. Без цих двох рядків живий пошук у локальній
  // перевірці мовчки не працює, і ми знову дивимося не на те.
  res.writeHead(status ?? (body ? 200 : 404), { 'content-type': 'application/json', ...CORS(req.headers.origin) });
  res.end(JSON.stringify(body ?? { error: 'no mock for ' + url.pathname }));
}).listen(3001, ()=>console.log('mock api :3001'));
