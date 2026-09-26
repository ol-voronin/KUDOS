'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { minor, formatUAH, type PrintOfferDto } from '@dt/contracts';
import { Button, ButtonLink, Drawer, ErrorBanner, Skeleton } from '@/components/ui';
import { useCart } from '@/features/cart/cart-store';
import { useSiteSettings } from '@/app/providers';
import { CARE_WARNING, buyNotes, paymentText, shippingText } from '@/config/product-copy';
import { ga4AddToCart, ga4ViewItem, hryvnia, type Ga4Item } from '@/features/analytics/ga4';
import { shipWindow } from '../delivery-estimate';
import { readRememberedSize, rememberSize } from '../remembered-size';
import { usePrintOffer } from '../hooks/usePrintOffer';
import { findVariant, selectableColours, selectableSizes } from '../variant-selection';
import { AvailabilityBadge } from './AvailabilityBadge';
import { ColourSwatch } from './ColourSwatch';
import { GarmentPreview } from './GarmentPreview';
import { MediaStack, type MediaFrame } from './MediaStack';
import { canMockup, PrintOnGarment } from './PrintOnGarment';
import { SizeButton } from './SizeButton';
import { SizeChart } from './SizeChart';

export function PrintOfferView({ slug, initialData }: { slug: string; initialData?: PrintOfferDto }) {
  const { data, isLoading, isError } = usePrintOffer(slug, initialData);
  const { add } = useCart();
  const site = useSiteSettings();
  const [sizeChartOpen, setSizeChartOpen] = useState(false);

  const [garmentId, setGarmentId] = useState<string | null>(null);
  const [fabricId, setFabricId] = useState<string | null>(null);
  const [colourId, setColourId] = useState<string | null>(null);
  const [sizeId, setSizeId] = useState<string | null>(null);

  /**
   * Напис розміру з минулого візиту. Читається один раз після монтування —
   * на сервері `localStorage` не існує, і читання під час рендера дало б
   * розбіжність розмітки.
   */
  const [rememberedLabel, setRememberedLabel] = useState<string | null>(null);
  useEffect(() => { setRememberedLabel(readRememberedSize()); }, []);

  /*
   * Перегляд товару — один раз на принт, не на кожну зміну виробу чи кольору.
   * Ціна тут та сама, що людина бачить до вибору: найдешевший носій плюс
   * друк. Інакше «перегляд за 1290» і «перегляд за 2190» були б двома
   * різними подіями про один і той самий малюнок.
   */
  const viewedSlug = useRef<string | null>(null);
  useEffect(() => {
    if (!data || viewedSlug.current === slug) return;
    viewedSlug.current = slug;
    const cheapestGarment = Math.min(...data.garments.map((g) => g.basePriceMinor));
    ga4ViewItem({
      item_id: slug,
      item_name: data.print.title,
      item_category: 'Принт',
      price: hryvnia(cheapestGarment + data.printPriceMinor),
      quantity: 1,
    });
  }, [data, slug]);

  /*
   * «У кошику ✓» тримається, доки людина не змінила вибір.
   *
   * Скидається на будь-якій зміні виробу, кольору чи розміру: інакше
   * галочка стоїть біля кнопки, яка тепер додасть інший товар, і читається
   * як «цей варіант уже в кошику», хоча в кошику попередній.
   */
  const [added, setAdded] = useState(false);

  useEffect(() => { setAdded(false); }, [garmentId, fabricId, colourId, sizeId]);

  // Re-anchor the selection on the first garment/fabric whenever fresh data
  // arrives — a stale id from a previous slug must never leak into this one.
  useEffect(() => {
    if (!data || data.garments.length === 0) return;
    setGarmentId((current) => current ?? data.garments[0]?.id ?? null);
  }, [data]);

  const garment = data?.garments.find((g) => g.id === garmentId) ?? data?.garments[0];

  useEffect(() => {
    if (!garment) return;
    setFabricId((current) => (current && garment.fabrics.some((f) => f.id === current) ? current : garment.fabrics[0]?.id ?? null));
  }, [garment]);

  const colours = useMemo(() => {
    if (!data || !garment || !fabricId) return [];
    return selectableColours(data.colours, data.variants, garment.id, fabricId);
  }, [data, garment, fabricId]);

  useEffect(() => {
    if (colours.length === 0) return;
    setColourId((current) => (current && colours.some((c) => c.id === current) ? current : colours[0]?.id ?? null));
  }, [colours]);

  const sizes = useMemo(() => {
    if (!data || !garment || !fabricId || !colourId) return [];
    return selectableSizes(garment.sizes, data.variants, garment.id, fabricId, colourId);
  }, [data, garment, fabricId, colourId]);

  /**
   * Переанкорення розміру.
   *
   * Порядок вибору тут і є всією «розумністю» екрана: якщо поточний розмір
   * ще доступний — лишаємо його; інакше беремо той, який людина обирала
   * минулого разу; і лише якщо його теж немає — перший зі списку.
   *
   * Запамʼятований розмір, якого немає в наявності, свідомо не підставляється:
   * підставити недоступний варіант означало б показати кнопку «Оплатити»
   * вимкненою одразу після відкриття сторінки.
   */
  useEffect(() => {
    if (sizes.length === 0) return;
    setSizeId((current) => {
      if (current !== null && sizes.some((s) => s.id === current)) return current;
      /*
       * Преселект — ТІЛЬКИ запамʼятований розмір із минулого візиту.
       *
       * Раніше тут стояло `?? sizes[0]?.id`: першому відвідувачу мовчки
       * обирався S, і кнопка купівлі працювала одразу. Виглядало як
       * зручність, а було головним джерелом замовлень «не той розмір» —
       * людина не помічає вибору, якого не робила. Запамʼятований розмір
       * інша справа: його вона колись обрала сама.
       */
      const remembered = rememberedLabel === null
        ? undefined
        : sizes.find((s) => s.label === rememberedLabel && s.state !== 'UNAVAILABLE');
      return remembered?.id ?? null;
    });
  }, [sizes, rememberedLabel]);

  /** Кожен свідомий вибір розміру стає підказкою для наступного разу. */
  function chooseSize(id: string): void {
    setSizeId(id);
    const picked = sizes.find((s) => s.id === id);
    if (picked) { rememberSize(picked.label); setRememberedLabel(picked.label); }
  }

  // Найдешевший варіант кожного виробу — для кнопок вибору. Рахується з
  // цін, які прислав сервер, а не з базової: після надбавок «база + друк»
  // може не збігтися з жодним реальним варіантом.
  const cheapestByGarment = useMemo(() => {
    const map = new Map<string, number>();
    for (const v of data?.variants ?? []) {
      const current = map.get(v.garmentId);
      if (current === undefined || v.priceMinor < current) map.set(v.garmentId, v.priceMinor);
    }
    return map;
  }, [data]);

  const selectedColour = colours.find((c) => c.id === colourId);
  const selectedFabric = garment?.fabrics.find((f) => f.id === fabricId);
  const selectedSize = sizes.find((s) => s.id === sizeId);
  const variant = garment && fabricId && colourId && sizeId
    ? findVariant(data?.variants ?? [], garment.id, fabricId, colourId, sizeId)
    : undefined;

  if (isLoading) {
    // Каркас тієї самої форми, що й готова сторінка: інакше вміст стрибає
    // на місце, і людина встигає натиснути не туди.
    return (
      <div className="grid gap-10 md:grid-cols-2">
        <Skeleton className="aspect-square w-full" />
        <div className="flex flex-col gap-4">
          <Skeleton className="h-9 w-3/4" />
          <Skeleton className="h-7 w-1/3" />
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-2/3" />
          <Skeleton className="mt-4 h-13 w-full" />
        </div>
      </div>
    );
  }
  if (isError || !data) {
    return <ErrorBanner>Не вдалося завантажити принт.</ErrorBanner>;
  }
  if (data.garments.length === 0) {
    return (
      <div>
        <h1 className="font-display text-section font-bold uppercase text-ink">{data.print.title}</h1>
        <p className="mt-4 text-ink-muted">
          Поки що немає жодного виробу у вітрині, тож замовити цей принт нема на чому.
          Напиши нам — зробимо вручну.
        </p>
      </div>
    );
  }

  // Ціну варіанта рахує сервер: у ній уже враховані надбавки за розмір,
  // тканину й колір. Складати її тут із бази означало б тримати в браузері
  // другу реалізацію ціноутворення — і колись розійтися з касою.
  //
  // Поки розмір не обрано, варіанта немає — і точної ціни теж: надбавка за
  // розмір може її змінити. Тому до вибору показуємо «від найдешевшого
  // варіанта цього виробу», а не базу, якої може не існувати в природі.
  const cheapestForGarment = garment ? cheapestByGarment.get(garment.id) : undefined;
  const garmentPriceMinor = variant?.priceMinor ?? cheapestForGarment ?? garment?.basePriceMinor ?? 0;
  const totalMinor = garmentPriceMinor + data.printPriceMinor;
  const priceIsExact = variant !== null && variant !== undefined;

  /*
   * Назву й обкладинку кладемо в кошик знімком.
   *
   * Не заради економії запиту: сторінка кошика має щось показати ще до
   * того, як приїде перерахунок із сервера, інакше вона блимає порожніми
   * рядками. Ціни в цьому знімку немає й бути не може — її рахує сервер.
   *
   * Значення витягуються тут, поза функцією: усередині вкладеної функції
   * TypeScript уже не памʼятає, що `data` перевірено вище.
   */
  const printTitle = data.print.title;
  const printPreviewUrl = data.print.previewUrl;

  /*
   * Позиція для GA4. Товаром тут вважається ПРИНТ, а виріб, колір і розмір —
   * його варіант: у звіті потрібно бачити, який малюнок продається, а не те,
   * що «футболок продано 40». Виріб нікуди не дівається — він у `item_variant`.
   */
  const ga4Item: Ga4Item | null = garment === undefined ? null : {
    item_id: slug,
    item_name: data?.print.title ?? slug,
    item_category: 'Принт',
    item_variant: [garment.name, selectedColour?.name ?? selectedColour?.supplierCode, selectedSize?.label]
      .filter((part) => part !== undefined && part !== '')
      .join(' · '),
    price: hryvnia(totalMinor),
    quantity: 1,
  };

  function handleAddToCart(): void {
    if (!variant) return;
    if (ga4Item !== null) ga4AddToCart(ga4Item);
    add({
      printSlug: slug,
      variantId: variant.id,
      printMethod: 'DTF',
      quantity: 1,
      title: printTitle,
      previewUrl: printPreviewUrl,
    });
    setAdded(true);
  }

  const photoFrames: MediaFrame[] = (data.images.length > 0
    ? data.images
    : (data.print.previewUrl ? [{ url: data.print.previewUrl, alt: data.print.title }] : [])
  ).map((image, index) => ({ key: `${image.url}-${index}`, src: image.url, alt: image.alt || data.print.title }));

  /*
   * Авто-мокап живе В ГАЛЕРЕЇ, другим кадром після обкладинки, — прохання
   * Даші: «як виглядає принт» має бути фотографією зліва, а не віджетом у
   * колонці покупки. Кадр живий: перемкнули виріб чи колір — мокап у стосі
   * перемалювався. Немає макета чи фото кольору — кадр просто не додається.
   */
  const mockupFrame: MediaFrame[] = garment && selectedColour
    && canMockup(garment.slug, selectedColour.supplierCode, data.print.mockupUrl)
    ? [{
      key: 'mockup',
      alt: `${data.print.title} на ${garment.name}, ${selectedColour.name ?? selectedColour.supplierCode} — орієнтовний вигляд`,
      node: (
        <figure className="p-3">
          <PrintOnGarment
            garmentSlug={garment.slug}
            colourCode={selectedColour.supplierCode}
            mockupUrl={data.print.mockupUrl}
            sizeTier={data.print.sizeTier}
            alt={`${data.print.title} на ${garment.name}, ${selectedColour.name ?? selectedColour.supplierCode}`}
            className="mx-auto max-w-md"
          />
          <figcaption className="mt-2 text-center text-xs text-ink-subtle">
            Орієнтовний вигляд · {garment.name}, {selectedColour.name ?? selectedColour.supplierCode}
          </figcaption>
        </figure>
      ),
    }]
    : [];

  const frames: MediaFrame[] = [
    ...photoFrames.slice(0, 1),
    ...mockupFrame,
    ...photoFrames.slice(1),
  ];

  return (
    /*
     * Фото стосом ліворуч, панель покупки липне праворуч — тепер липне
     * САМЕ панель, а не галерея: кадрів стало багато, вони довші за екран,
     * і липка галерея ховала б власні нижні кадри. Довідковий хвіст
     * (догляд, доставка) — під фото, щоб липка панель була короткою.
     */
    <div className="grid items-start gap-x-10 gap-y-12 md:grid-cols-2">
      <div>
        <MediaStack frames={frames} emptyText="Фото принта готуємо" />
      </div>

      <div className="md:sticky md:top-24">
        <h1 className="font-display text-section font-bold uppercase text-ink">{data.print.title}</h1>
        {/*
          Розкладу «стільки виріб + стільки друк» тут більше немає.
          Покупець платить одну суму; знати, як вона ділиться всередині, йому
          ні для чого — це наша бухгалтерія, винесена на вітрину. Що йому
          справді треба — побачити, у скільки обійдеться саме худі, а не
          футболка; це видно на кнопках вибору виробу нижче.
        */}
        <div className="mt-3 border-t border-ink pt-3" aria-live="polite">
          <p className="font-display text-3xl font-bold text-ink">
            {priceIsExact ? '' : 'від '}{formatUAH(minor(totalMinor))}
          </p>
        </div>

        {data.garments.length > 1 && (
          <fieldset className="mt-6">
            <legend className="label-eyebrow mb-2">Обрати виріб</legend>
            <div className="flex flex-wrap gap-2">
              {data.garments.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  aria-pressed={g.id === garment?.id}
                  onClick={() => setGarmentId(g.id)}
                  className={[
                    'min-h-10 rounded-pill border px-4 text-sm font-medium transition',
                    g.id === garment?.id ? 'border-ink bg-ink text-surface' : 'border-line text-ink hover:border-ink',
                  ].join(' ')}
                >
                  {g.name}
                  {/* Ціна поруч із назвою, бо саме вона робить вибір виробом,
                      а не вгадуванням: різниця між футболкою й худі тут у
                      два з половиною рази. */}
                  <span className={g.id === garment?.id ? 'ml-2 opacity-70' : 'ml-2 text-ink-subtle'}>
                    {/* Найдешевший варіант цього виробу: з надбавками ціна
                        залежить від розміру, тож «база + друк» показувала б
                        суму, якої може не бути в жодному варіанті. */}
                    {formatUAH(minor((cheapestByGarment.get(g.id) ?? g.basePriceMinor) + data.printPriceMinor))}
                  </span>
                </button>
              ))}
            </div>
          </fieldset>
        )}

        {garment && garment.fabrics.length > 1 && (
          <fieldset className="mt-6">
            <legend className="label-eyebrow mb-2">Тканина</legend>
            <div className="flex flex-wrap gap-2">
              {garment.fabrics.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  aria-pressed={f.id === fabricId}
                  onClick={() => setFabricId(f.id)}
                  className={[
                    'min-h-10 rounded-pill border px-4 text-sm font-medium transition',
                    f.id === fabricId ? 'border-ink bg-ink text-surface' : 'border-line text-ink hover:border-ink',
                  ].join(' ')}
                >
                  {f.name}
                </button>
              ))}
            </div>
          </fieldset>
        )}

        {colours.length > 0 && (
          <fieldset className="mt-6">
            {/*
              Назва кольору поруч із міткою, а не лише в підказці свотча:
              «Смарагдовий» і «Зелений мох» на екрані відрізняються менше,
              ніж у назві, а з телефона підказки не видно взагалі.
            */}
            <legend id="colour-label" className="label-eyebrow mb-2">
              Колір{' '}
              {selectedColour && (
                <span className="text-ink">
                  {(selectedColour.name ?? selectedColour.supplierCode).toUpperCase()}
                </span>
              )}
            </legend>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-labelledby="colour-label">
              {colours.map((c) => (
                <ColourSwatch key={c.id} colour={c} selected={c.id === colourId} onSelect={setColourId} />
              ))}
            </div>
          </fieldset>
        )}

        {/*
          Мокап тепер живе другим кадром у галереї зліва (прохання Даші).
          Тут лишається тільки запасна картка «носія» для принтів БЕЗ
          вебмакета — щоб вибір кольору все одно щось показував.
        */}
        {garment && selectedColour
          && !canMockup(garment.slug, selectedColour.supplierCode, data.print.mockupUrl) && (
          <GarmentPreview
            garmentSlug={garment.slug}
            garmentName={garment.name}
            colourCode={selectedColour.supplierCode}
            colourName={selectedColour.name}
            colourHex={selectedColour.hex}
            fabric={selectedFabric}
          />
        )}

        {sizes.length > 0 && (
          <fieldset className="mt-6">
            {/*
              Таблиця розмірів відкривається ЗВІДСИ, а не з окремого блока
              внизу картки. Baymard знаходить це в кожному тесті одягу:
              питання «який мій розмір» виникає рівно в мить вибору розміру,
              і відповідь має бути на відстані одного погляду, а не
              прокрутки.
            */}
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <legend id="size-label" className="label-eyebrow">Розмір</legend>
              {garment && garment.sizes.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSizeChartOpen(true)}
                  className="tap-sm text-sm text-ink underline underline-offset-4 hover:opacity-60"
                >
                  Таблиця розмірів
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-labelledby="size-label">
              {sizes.map((s) => (
                <SizeButton
                  key={s.id}
                  size={s}
                  selected={s.id === sizeId}
                  remembered={rememberedLabel !== null && s.label === rememberedLabel}
                  onSelect={chooseSize}
                />
              ))}
            </div>
            {rememberedLabel !== null && (
              <p className="mt-2 text-xs text-ink-subtle">
                {/*
                  Без дієслова навмисно: «ти брав» і «ти брала» — різні
                  форми, а статі покупця ми не знаємо. Речення без роду
                  краще за вгадування навпіл.
                */}
                Минулого разу тут був розмір {rememberedLabel} — позначено крапкою.
              </p>
            )}
          </fieldset>
        )}

        {garment && (
          <Drawer open={sizeChartOpen} onClose={() => setSizeChartOpen(false)} title="Таблиця розмірів">
            <SizeChart garment={garment} highlight={sizeId} />
          </Drawer>
        )}

        {selectedSize && (
          <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-2" aria-live="polite">
            <AvailabilityBadge state={selectedSize.state} leadTimeDays={selectedSize.leadTimeDays} />
            {/*
              Дата, а не «4–7 днів».

              Строк, названий днями, покупець однаково перекладає в дату —
              просто робить це сам, у голові й з помилкою. Названий датою,
              він читається як зобовʼязання; це найдешевший спосіб зняти
              питання «а коли вже».
            */}
            {selectedSize.state !== 'UNAVAILABLE' && (
              <span className="text-sm text-ink-muted">
                Відправимо{' '}
                <b className="font-medium text-ink">
                  {shipWindow(site.productionDaysMin, site.productionDaysMax, selectedSize.leadTimeDays).label}
                </b>
              </span>
            )}
          </div>
        )}

        {/*
          Смуга купівлі липне до низу екрана на телефоні. Причина не в моді:
          селектори кольору й розміру разом із таблицею розмірів забирають
          більше висоти, ніж є в екрана, тож кнопка «Оплатити» опинялася поза
          полем зору саме тоді, коли вибір нарешті зроблено. На широкому
          екрані вона нікуди не липне — там усе видно й так.
        */}
        <div className="sticky bottom-0 z-10 mt-8 -mx-4 border-t border-ink bg-surface/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 md:static md:mx-0 md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
          {/*
            Кнопка кладе товар у кошик, а не веде на оплату.

            Раніше тут була форма з іменем і телефоном просто в картці
            товару: людина тиснула «Оплатити», вводила контакти й одразу
            їхала в Monobank. Це чесно працює рівно для одного товару — а
            той, хто хоче худі собі й футболку сестрі, мусив проходити цей
            шлях двічі й отримував два замовлення й дві доставки.

            Тепер контакти й доставка питаються один раз на касі, а тут
            лишається один рух.
          */}
          <Button
            size="lg"
            full
            disabled={!variant || selectedSize?.state === 'UNAVAILABLE'}
            onClick={handleAddToCart}
          >
            {/*
              Вимкнена кнопка без пояснення — окремий гріх: людина тисне,
              нічого не відбувається, і незрозуміло чому. Напис називає
              причину прямо на кнопці.
            */}
            {sizeId === null
              ? 'Спершу обери розмір'
              : added ? 'У кошику ✓' : `Додати в кошик · ${formatUAH(minor(totalMinor))}`}
          </Button>
          {added ? (
            <ButtonLink href="/koshyk" variant="quiet" size="md" full className="mt-2">
              Перейти в кошик →
            </ButtonLink>
          ) : (
            /*
              Три рядки під кнопкою — не прикраса, а зняття трьох конкретних
              сумнівів, які Baymard бачить у кожному тесті чекауту:
              «коли з мене візьмуть гроші», «а якщо не підійде» і «скільки
              коштує доставка». Кожен із них поодинці зупиняє покупку, і
              жоден не потребує більше рядка.
            */
            <ul className="mt-3 flex flex-col gap-1.5 text-xs leading-relaxed text-ink-muted">
              {buyNotes(site, true).map((n) => <li key={n}>· {n}</li>)}
            </ul>
          )}
        </div>

        {/*
          Другий шлях, про який просив замовник: людині сподобався принт,
          але пес не той. Без цієї кнопки вона або купує «схоже», або йде.
          Вторинна дія й нижче основної — вона потрібна меншості, але саме
          тій меншості, яка інакше не купить нічого.
        */}
        <div className="mt-6 rounded-card border border-line p-4">
          <p className="text-sm font-medium text-ink">Подобається принт, але пес не той?</p>
          <p className="mt-1 text-sm leading-relaxed text-ink-muted">
            Надішли 2–3 фото свого хвостика — зробимо цей самий принт із його мордочкою.
            Доплата 200 ₴, строк той самий.
          </p>
          <ButtonLink href="/zayavka" variant="outline" size="md" className="mt-3">
            Хочу такий, але зі своїм песом
          </ButtonLink>
        </div>

      </div>

      {/*
        Опис розбито на розділи, а не викладено абзацом.

        Baymard: на сторінці товару читають не підряд, а шукають свою
        відповідь — «з чого це», «як прати», «коли приїде», «що як не
        підійде». Суцільний текст змушує вичитувати чуже, щоб знайти своє.
        Перший розділ відкритий: якщо всі згорнуті, більшість не відкриє
        жодного. Живе під фото: це читання ПІСЛЯ вибору, а не замість.
      */}
      <div className="md:col-start-1">
        <div className="divide-y divide-line border-y border-line">
          <Section title="Виріб і друк" open>
            <p>
              {garment?.description !== undefined && garment.description !== ''
                ? garment.description
                : 'Друкуємо на власних виробах і на готових від еко-бренду Native Spirit (Франція).'}
            </p>
            <p>
              Друк DTF або DTG на промисловому обладнанні. Принт не тріскається й не злазить
              після прання; трісне з нашої вини — переробимо або повернемо гроші.
            </p>
          </Section>

          <Section title="Догляд">
            {/*
              Догляд за річчю з принтом СУВОРІШИЙ за догляд за базовою, і
              саме тому текст тут свій, а не спільний з `product-copy`:
              плівка не переживе ні прасування по принту, ні гарячої сушки.
              Спільний текст закінчується попередженням «вказано догляд за
              виробом без принтів» — ось річ, до якої воно відсилає.
            */}
            <p>
              Прати при 30 °C навиворіт, без відбілювача. Не сушити в машині.
              Прасувати з вивороту або через тканину, не по принту.
            </p>
            <p>{CARE_WARNING.replace('без принтів!', 'без принтів — цей суворіший.')}</p>
          </Section>

          <Section title="Строки й доставка">
            {shippingText(site).map((p) => <p key={p}>{p}</p>)}
          </Section>

          <Section title="Оплата, обмін і повернення">
            {paymentText(site, true).map((p) => <p key={p}>{p}</p>)}
          </Section>
        </div>
      </div>
    </div>
  );
}

/**
 * Один розділ опису. `<details>`, а не свій акордеон: пошук у браузері
 * знаходить текст усередині згорнутого `<details>` і сам його розкриває —
 * своя реалізація на `useState` цього не вміє й ховає відповідь від того,
 * хто шукає її через Ctrl+F.
 */
function Section({ title, children, open = false }: { title: string; children: ReactNode; open?: boolean }) {
  return (
    <details className="group py-4" {...(open ? { open: true } : {})}>
      <summary className="flex cursor-pointer items-center justify-between gap-3 text-sm font-medium text-ink">
        {title}
        <span aria-hidden className="text-ink-subtle transition-transform group-open:rotate-180">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </span>
      </summary>
      <div className="mt-3 flex flex-col gap-2 text-sm leading-relaxed text-ink-muted">{children}</div>
    </details>
  );
}

