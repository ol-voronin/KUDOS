'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { minor, formatUAH, type PrintOfferDto } from '@dt/contracts';
import { PrintThumb } from '@/components/print-thumb';
import { Button, ButtonLink, Drawer, ErrorBanner, Skeleton } from '@/components/ui';
import { useCart } from '@/features/cart/cart-store';
import { useSiteSettings } from '@/app/providers';
import { shipWindow } from '../delivery-estimate';
import { readRememberedSize, rememberSize } from '../remembered-size';
import { usePrintOffer } from '../hooks/usePrintOffer';
import { findVariant, selectableColours, selectableSizes } from '../variant-selection';
import { AvailabilityBadge } from './AvailabilityBadge';
import { ColourSwatch } from './ColourSwatch';
import { GarmentPreview } from './GarmentPreview';
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

  function handleAddToCart(): void {
    if (!variant) return;
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

  return (
    <div className="grid items-start gap-10 md:grid-cols-2">
      {/*
        Галерея липне до верху на широкому екрані.

        Права колонка з описом і акордеоном удвічі довша за фото, і без
        цього під галереєю лишалася порожня половина екрана — а товар,
        заради якого сторінку відкрили, їхав угору саме тоді, коли людина
        читає, з чого він і коли приїде. Baymard називає це прямо: фото має
        лишатися в полі зору весь час, поки триває вибір.
      */}
      <div className="md:sticky md:top-24">
        <Gallery images={data.images} fallback={data.print.previewUrl} title={data.print.title} />
      </div>

      <div>
        <h1 className="font-display text-section font-bold uppercase text-ink">{data.print.title}</h1>
        <div className="mt-3 border-t border-ink pt-3" aria-live="polite">
          <p className="font-display text-3xl font-bold text-ink">
            {priceIsExact ? '' : 'від '}{formatUAH(minor(totalMinor))}
          </p>
          {garment && (
            <p className="mt-1 text-sm text-ink-subtle">
              {formatUAH(minor(garmentPriceMinor))} виріб + {formatUAH(minor(data.printPriceMinor))} друк
            </p>
          )}
        </div>

        {data.garments.length > 1 && (
          <fieldset className="mt-6">
            <legend className="label-eyebrow mb-2">Виріб</legend>
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
            <legend id="colour-label" className="label-eyebrow mb-2">Колір</legend>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-labelledby="colour-label">
              {colours.map((c) => (
                <ColourSwatch key={c.id} colour={c} selected={c.id === colourId} onSelect={setColourId} />
              ))}
            </div>
          </fieldset>
        )}

        {/*
          Авто-мокап: якщо в принта є вебмакет, а в кольору — фото, покупець
          бачить саме цей принт на саме цьому виробі в саме цьому кольорі.
          Картинка складається на льоту (фото + прозорий PNG), тож комбінацій
          може бути скільки завгодно без жодного намальованого мокапа.
          Немає макета чи кадру — стара маленька картка «носія», як і було.
        */}
        {garment && selectedColour && canMockup(garment.slug, selectedColour.supplierCode, data.print.mockupUrl) ? (
          <figure className="mt-6 rounded-card border border-line bg-surface-sunken p-3">
            <PrintOnGarment
              garmentSlug={garment.slug}
              colourCode={selectedColour.supplierCode}
              mockupUrl={data.print.mockupUrl}
              sizeTier={data.print.sizeTier}
              alt={`${data.print.title} на ${garment.name}, ${selectedColour.name ?? selectedColour.supplierCode}`}
              className="mx-auto max-w-xs"
            />
            <figcaption className="mt-2 text-center text-xs text-ink-subtle">
              Орієнтовний вигляд · {garment.name}, {selectedColour.name ?? selectedColour.supplierCode}.
              Розмір принта: {data.print.sizeTier}.
            </figcaption>
          </figure>
        ) : garment && selectedColour && (
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
          <Drawer open={sizeChartOpen} onClose={() => setSizeChartOpen(false)} title={`Розміри · ${garment.name}`}>
            <SizeChart sizes={garment.sizes} highlight={sizeId} />
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
              <li>· Оплата не зараз — спершу підтвердимо наявність і напишемо</li>
              <li>· Обмін і повернення {site.returnDays} днів, якщо річ не носили</li>
              <li>
                · Доставка від {Math.round(site.freeShippingFromMinor / 100).toLocaleString('uk-UA')} ₴ — за наш рахунок
              </li>
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

        {/*
          Опис розбито на розділи, а не викладено абзацом.

          Baymard: на сторінці товару читають не підряд, а шукають свою
          відповідь — «з чого це», «як прати», «коли приїде», «що як не
          підійде». Суцільний текст змушує вичитувати чуже, щоб знайти своє.
          Перший розділ відкритий: якщо всі згорнуті, більшість не відкриє
          жодного.
        */}
        <div className="mt-8 divide-y divide-line border-y border-line">
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
            <p>
              Прати при 30 °C навиворіт, без відбілювача. Не сушити в машині.
              Прасувати з вивороту або через тканину, не по принту.
            </p>
          </Section>

          <Section title="Строки й доставка">
            <p>
              Виготовлення та відправка: {site.productionDaysMin}–{site.productionDaysMax} робочих
              днів{selectedSize?.leadTimeDays != null ? `, плюс ${selectedSize.leadTimeDays} днів на пошиття цього розміру` : ''}.
            </p>
            <p>
              Нова Пошта — на відділення, в поштомат або курʼєром. Від{' '}
              {Math.round(site.freeShippingFromMinor / 100).toLocaleString('uk-UA')} ₴ доставка за наш рахунок,
              менші замовлення — за тарифами перевізника.
            </p>
          </Section>

          <Section title="Оплата, обмін і повернення">
            <p>
              Після оформлення ми звіряємо наявність і надсилаємо рахунок. Картку вводиш на
              стороні Monobank, не в нас; гроші блокуються й списуються після підтвердження.
            </p>
            <p>
              Обмін і повернення — {site.returnDays} днів, якщо річ не носили й збережено вигляд.
              Принт, намальований із твого фото, поверненню не підлягає: він зроблений
              персонально. Помилились ми — переробимо або повернемо гроші, зворотна пересилка наша.
            </p>
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

/**
 * Галерея товару.
 *
 * Без сторонніх бібліотек і без каруселі: пʼять фото — це рівно той обсяг,
 * який показується мініатюрами без гортання. Карусель тут додала б анімацію,
 * свайпи й клавіатурну навігацію на порожньому місці.
 */
function Gallery({
  images, fallback, title,
}: { images: ReadonlyArray<{ url: string; alt: string }>; fallback: string; title: string }) {
  const list = images.length > 0
    ? images
    : (fallback ? [{ url: fallback, alt: title }] : []);
  const [active, setActive] = useState(0);
  const [zoomed, setZoomed] = useState(false);
  const current = list[Math.min(active, list.length - 1)];

  /*
   * Стрілки гортають і Escape закриває, поки збільшене фото відкрите.
   *
   * Слухач висить лише в стані zoom — постійний перехоплював би стрілки
   * в полях вводу решти сторінки.
   */
  useEffect(() => {
    if (!zoomed) return;
    function onKey(e: KeyboardEvent): void {
      if (e.key === 'Escape') setZoomed(false);
      if (e.key === 'ArrowRight') setActive((i) => (i + 1) % list.length);
      if (e.key === 'ArrowLeft') setActive((i) => (i - 1 + list.length) % list.length);
    }
    window.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [zoomed, list.length]);

  if (!current) return <PrintThumb src={null} alt={title} />;

  return (
    <div>
      {/*
        Фото збільшується кліком.

        Для одягу це не прикраса: рішення про покупку ухвалюють, роздивившись
        принт і фактуру, а квадрат у пів колонки цього не дає. Збільшення на
        весь екран — найдешевша форма зуму, яка працює й на телефоні.
      */}
      <button
        type="button"
        onClick={() => setZoomed(true)}
        className="block w-full cursor-zoom-in focus:outline-none focus-visible:ring-2 focus-visible:ring-ink"
        aria-label="Збільшити фото"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={current.url}
          alt={current.alt}
          className="aspect-square w-full bg-surface-sunken object-cover"
        />
      </button>

      {/*
        Портал у body, а не рендер на місці.

        Галерея живе всередині sticky-обгортки, і `fixed` елемент усередині
        неї опиняється в чужому stacking context: підкладка не накривала
        шапку, і крізь «затемнення» просвічували кнопки сторінки. Портал
        виносить оверлей на верхній рівень документа, де z-index означає
        те, що написано.
      */}
      {zoomed && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${title} — збільшене фото`}
          className="fixed inset-0 z-[80] flex items-center justify-center bg-ink/90 animate-[fade-in_.15s_ease-out]"
          onClick={() => setZoomed(false)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={current.url}
            alt={current.alt}
            className="max-h-[92vh] max-w-[92vw] cursor-zoom-out object-contain"
          />
          {list.length > 1 && (
            <p className="absolute bottom-5 left-1/2 -translate-x-1/2 text-sm tabular-nums text-white/80">
              {active + 1} / {list.length} · гортай стрілками
            </p>
          )}
          <button
            type="button"
            onClick={() => setZoomed(false)}
            aria-label="Закрити"
            className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center text-white hover:opacity-70"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>,
        document.body,
      )}
      {list.length > 1 && (
        <div className="mt-3 flex gap-2">
          {list.map((image, index) => (
            <button
              key={image.url}
              type="button"
              onClick={() => setActive(index)}
              aria-label={`Фото ${index + 1} з ${list.length}`}
              aria-current={index === active}
              className={[
                'w-1/5 overflow-hidden border-2 transition',
                index === active ? 'border-ink' : 'border-transparent hover:border-line-strong',
              ].join(' ')}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image.url} alt="" className="aspect-square w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
