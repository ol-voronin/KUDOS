'use client';

import { useEffect, useMemo, useState } from 'react';
import { minor, formatUAH, type PrintOfferDto } from '@dt/contracts';
import { ApiError } from '@/lib/api-client';
import { PrintThumb } from '@/components/print-thumb';
import { Button, Skeleton, ErrorBanner, inputClass, FieldShell } from '@/components/ui';
import { readRememberedSize, rememberSize } from '../remembered-size';
import { useCheckoutReadyPrint } from '../hooks/useCheckoutReadyPrint';
import { usePrintOffer } from '../hooks/usePrintOffer';
import { findVariant, selectableColours, selectableSizes } from '../variant-selection';
import { AvailabilityBadge } from './AvailabilityBadge';
import { ColourSwatch } from './ColourSwatch';
import { GarmentPreview } from './GarmentPreview';
import { SizeButton } from './SizeButton';
import { SizeChart } from './SizeChart';

const PHONE_PATTERN = /^\+380\d{9}$/;

export function PrintOfferView({ slug, initialData }: { slug: string; initialData?: PrintOfferDto }) {
  const { data, isLoading, isError } = usePrintOffer(slug, initialData);
  const checkout = useCheckoutReadyPrint();

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

  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

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
      const remembered = rememberedLabel === null
        ? undefined
        : sizes.find((s) => s.label === rememberedLabel && s.state !== 'UNAVAILABLE');
      return remembered?.id ?? sizes[0]?.id ?? null;
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
          Напишіть нам — зробимо вручну.
        </p>
      </div>
    );
  }

  // Ціну варіанта рахує сервер: у ній уже враховані надбавки за розмір,
  // тканину й колір. Складати її тут із бази означало б тримати в браузері
  // другу реалізацію ціноутворення — і колись розійтися з касою.
  const garmentPriceMinor = variant?.priceMinor ?? garment?.basePriceMinor ?? 0;
  const totalMinor = garmentPriceMinor + data.printPriceMinor;

  async function handleCheckoutSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!variant) return;
    setCheckoutError(null);
    if (!PHONE_PATTERN.test(customerPhone)) {
      setCheckoutError('Введіть телефон у форматі +380XXXXXXXXX');
      return;
    }
    try {
      const result = await checkout.mutateAsync({
        printSlug: slug,
        variantId: variant.id,
        printMethod: 'DTF',
        quantity: 1,
        paymentType: 'HOLD',
        customer: { name: customerName, phone: customerPhone, marketingConsent: false },
      });
      window.location.href = result.pageUrl;
    } catch (err) {
      setCheckoutError(err instanceof ApiError ? err.message : 'Не вдалося оформити замовлення');
    }
  }

  return (
    <div className="grid gap-10 md:grid-cols-2">
      <Gallery images={data.images} fallback={data.print.previewUrl} title={data.print.title} />

      <div>
        <h1 className="font-display text-section font-bold uppercase text-ink">{data.print.title}</h1>
        <div className="mt-3 border-t border-ink pt-3" aria-live="polite">
          <p className="font-display text-3xl font-bold text-ink">{formatUAH(minor(totalMinor))}</p>
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

        {garment && selectedColour && (
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
            <legend id="size-label" className="label-eyebrow mb-2">Розмір</legend>
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
                Минулого разу ви брали {rememberedLabel} — позначено крапкою.
              </p>
            )}
          </fieldset>
        )}

        {garment && <SizeChart sizes={garment.sizes} highlight={sizeId} />}

        {selectedSize && (
          <div className="mt-6" aria-live="polite">
            <AvailabilityBadge state={selectedSize.state} leadTimeDays={selectedSize.leadTimeDays} />
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
          {!checkoutOpen && (
            <>
              <Button
                size="lg"
                full
                disabled={!variant || selectedSize?.state === 'UNAVAILABLE'}
                onClick={() => setCheckoutOpen(true)}
              >
                Оплатити {formatUAH(minor(totalMinor))}
              </Button>
              <p className="mt-2 text-center text-xs text-ink-subtle md:text-left">
                Гроші списуються після того, як ми підтвердили замовлення.
              </p>
            </>
          )}

          {checkoutOpen && (
            <form className="flex flex-col gap-3" onSubmit={handleCheckoutSubmit}>
              <FieldShell label="Імʼя" htmlFor="checkout-name">
                <input
                  id="checkout-name"
                  type="text"
                  required
                  autoComplete="name"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className={`${inputClass()} w-full`}
                />
              </FieldShell>
              <FieldShell label="Телефон" htmlFor="checkout-phone" hint="У форматі +380XXXXXXXXX">
                <input
                  id="checkout-phone"
                  type="tel"
                  required
                  autoComplete="tel"
                  inputMode="tel"
                  placeholder="+380XXXXXXXXX"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className={`${inputClass(checkoutError !== null)} w-full`}
                />
              </FieldShell>
              {checkoutError !== null && <ErrorBanner>{checkoutError}</ErrorBanner>}
              <Button type="submit" size="lg" full disabled={checkout.isPending}>
                {checkout.isPending ? 'Оформлюємо…' : `Оплатити ${formatUAH(minor(totalMinor))}`}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
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
  const current = list[Math.min(active, list.length - 1)];

  if (!current) return <PrintThumb src={null} alt={title} />;

  return (
    <div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={current.url}
        alt={current.alt}
        className="aspect-square w-full bg-surface-sunken object-cover"
      />
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
