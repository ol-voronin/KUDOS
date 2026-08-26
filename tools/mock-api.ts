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
  email: 'kudos.print.ua@gmail.com', instagram: '', returnDays: 14,
  freeShippingFrom: 150000, ga4MeasurementId: '', googleAdsId: '',
  allowIndexing: false, defaultOgImage: '', googleSiteVerification: '',
};

const MENU = [
  ['Каталог','/prints','HEADER',''],['Вироби','/vyroby','HEADER',''],
  ['Колекції','/collections','HEADER',''],['Свій принт','/svoya-ideya','HEADER',''],
  ['Статті','/statti','HEADER',''],
  ['Магазин','/prints','FOOTER','Магазин'],['За породами','/#породи','FOOTER','Магазин'],
  ['Свій принт','/svoya-ideya','FOOTER','Магазин'],
  ['Розміри','/vyroby','FOOTER','Допомога'],['Оплата й доставка','/dostavka','FOOTER','Допомога'],
  ['Оферта','/oferta','FOOTER','Документи'],['Політика приватності','/pryvatnist','FOOTER','Документи'],
].map(([label,href,area,group],i)=>({id:uuid(900+i),label,href,area,group,position:i*10,isActive:true}));

const BREEDS = ['Бігль','Вест-хайленд-терʼєр','Джек-рассел терʼєр','Доберман','Золотистий ретривер',
  'Йоркширський терʼєр','Коргі','Лабрадор','Мальтіпу','Метис','Мопс','Німецька вівчарка']
  .map((name,i)=>({ id: uuid(100+i), slug: `breed-${i}`, name, printCount: 1 + (i%4) }));

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

function subst(v) {
  if (typeof v === 'string') return v.replace(/\{\{(\w+)\}\}/g, (m,k)=> String(SETTINGS[k] ?? m));
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
};

http.createServer((req,res)=>{
  const url = new URL((req.url ?? '/').replace(/^\/api\/v1/, ''), 'http://x');
  let body = null;
  if (ROUTES[url.pathname]) body = ROUTES[url.pathname]();
  else if (url.pathname === '/catalog/prints') {
    const perPage = Number(url.searchParams.get('perPage') ?? 12);
    body = { items: PRINTS.slice(0, perPage), total: PRINTS.length, page: 1, perPage };
  } else if (url.pathname === '/content/pages') body = { items: [] };
  res.writeHead(body ? 200 : 404, {'content-type':'application/json'});
  res.end(JSON.stringify(body ?? { error: 'no mock for ' + url.pathname }));
}).listen(3001, ()=>console.log('mock api :3001'));
