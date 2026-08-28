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

const P = (n) => `/mock/${n}.jpg`;
const PHOTOS = ['art-black','art-white','art-pair','boss-w','boss-chi','boss-pit',
  'cow-full','cow-black','cow-olive','cow-red','cow-purple','cow-yellow','boss-kit','cow-green','cow-zone','hero'];

const uuid = (i) => `00000000-0000-4000-8000-${String(i).padStart(12,'0')}`;

const SETTINGS = {
  brand: 'Хвісторія', legalEntityName: 'Фізична особа-підприємець Воронін Олексій Петрович',
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
  ['Вироби','/vyroby','HEADER',''],['Свій принт','/svoya-ideya','HEADER',''],
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

const ROUTES = {
  '/content/site': () => ({ settings: SETTINGS, menu: MENU }),
  '/content/pages/home': () => page(HOME_PAGE),
  '/catalog/home': () => ({ breeds: BREEDS, collections: COLLECTIONS,
    newPrints: PRINTS.slice(0,8), readyToShip: PRINTS.filter(p=>p.inStock).slice(0,8), totalPrints: PRINTS.length }),
  '/catalog/breeds': () => ({ items: BREEDS }),
  '/catalog/collections': () => ({ items: COLLECTIONS }),
  '/analytics/config': () => ({ googleAdsId: '', ga4MeasurementId: '', conversions: [] }),
  '/catalog/range': () => ({
    garments: [], printPrices: [{ tier: 'MEDIUM', priceMinor: 30000 }],
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
  'access-control-allow-methods': 'GET,POST,OPTIONS',
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
  if (req.method === 'POST') {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    try { json = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); } catch { json = {}; }
  }

  let body = null;
  if (ROUTES[url.pathname]) body = ROUTES[url.pathname]();
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
    const G = (n) => uuid(400 + n);
    const C = (n) => uuid(500 + n);
    const S = (n) => uuid(600 + n);
    const F = (n) => uuid(650 + n);
    const sizes = ['S', 'M', 'L', 'XL'].map((label, i) => ({
      id: S(i), label, position: i,
      measurements: [
        { key: 'LENGTH', value: String(68 + i * 2) },
        { key: 'WIDTH', value: String(48 + i * 3) },
        { key: 'SLEEVE', value: String(20 + i) },
      ],
    }));
    const fabric = (n, name, gsm, comp) => ({ id: F(n), name, weightGsm: gsm, composition: comp, origin: null });
    const garments = [
      { id: G(0), slug: 'klasychna-futbolka', line: 'OWN_PRODUCTION', type: 'TSHIRT', fit: 'CLASSIC',
        name: 'Класична футболка', lengthAdjustable: true, basePriceMinor: 89000,
        description: 'Прямий крій, щільний трикотаж, не просвічує. Пасує всім, з ким ми досі мали справу.',
        fabrics: [fabric(0, 'Кулір 190', 190, '100 % бавовна')], sizes },
      { id: G(1), slug: 'oversayz-futbolka', line: 'OWN_PRODUCTION', type: 'TSHIRT', fit: 'OVERSIZE',
        name: 'Оверсайз футболка', lengthAdjustable: true, basePriceMinor: 99000,
        description: 'Справжній оверсайз: спущене плече, вільний корпус. Бери свій розмір, не менший.',
        fabrics: [fabric(1, 'Кулір 220', 220, '100 % бавовна')], sizes },
      { id: G(2), slug: 'khudi', line: 'NATIVE_SPIRIT', type: 'HOODIE', fit: 'CLASSIC',
        name: 'Худі', lengthAdjustable: false, basePriceMinor: 179000,
        description: 'Native Spirit, органічна бавовна з начосом. Сертифікати — на сторінці «Вироби».',
        fabrics: [fabric(2, 'Трьохнитка з начосом', 300, '85 % органічна бавовна, 15 % поліестер')], sizes },
    ];
    const colours = [
      { id: C(0), name: 'Чорний', supplierCode: '01', hex: '#111111', imageUrl: null },
      { id: C(1), name: 'Молочний', supplierCode: '02', hex: '#f2efe8', imageUrl: null },
    ];
    const variants = [];
    garments.forEach((g, gi) => colours.forEach((c, ci) => sizes.forEach((sz, si) => {
      const unavailable = gi === 2 && si === 3;         // худі XL — немає
      const madeToOrder = ci === 1 && si >= 2;          // молочний від L — під замовлення
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
    body = {
      print: { id: p.id, slug: p.slug, title: p.title, sizeTier: 'MEDIUM',
        collectionSlugs: ['collection-0'], breedSlugs: ['breed-6'],
        previewUrl: p.previewUrl, isPublished: true },
      images: PHOTOS.slice(0, 4).map((n) => ({ url: P(n), alt: p.title })),
      garments, variants, colours, printPriceMinor: 40000,
    };
  }
  else if (url.pathname === '/cart/quote') {
    // Мок рахує кошик грубо — по 1290 ₴ за позицію: перевіряємо верстку
    // сторінки, а не ціноутворення (воно перевіряється тестами в apps/api).
    const items = (json?.items ?? []);
    const lines = items.map((it, i) => {
      const p = PRINTS.find((x) => x.slug === it.printSlug) ?? PRINTS[i % PRINTS.length];
      const unit = p.fromPriceMinor;
      const qty = it.quantity ?? 1;
      const discount = qty >= 2 ? Math.round(unit * qty * 0.1) : 0;
      return {
        printSlug: it.printSlug, variantId: it.variantId, quantity: qty,
        title: p.title, garmentName: 'Класична футболка', colourName: 'Чорний',
        sizeLabel: 'M', previewUrl: p.previewUrl,
        unitMinor: unit, lineTotalMinor: unit * qty - discount,
        discountName: discount > 0 ? 'Друга річ −10 %' : null, discountMinor: discount,
        blockedReason: i === 99 ? 'Знято з продажу' : null,
        leadTimeDays: p.inStock ? null : 7,
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
    body = { orderNumber: 42, status: 'NEW', totalMinor: 258000 };
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
  res.writeHead(body ? 200 : 404, { 'content-type': 'application/json', ...CORS(req.headers.origin) });
  res.end(JSON.stringify(body ?? { error: 'no mock for ' + url.pathname }));
}).listen(3001, ()=>console.log('mock api :3001'));
