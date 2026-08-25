'use client';

import { useEffect, useMemo, useState } from 'react';
import { minor, formatUAH, type PrintOfferDto } from '@dt/contracts';
import { ApiError } from '@/lib/api-client';
import { PrintThumb } from '@/components/print-thumb';
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

  useEffect(() => {
    if (sizes.length === 0) return;
    setSizeId((current) => (current && sizes.some((s) => s.id === current) ? current : sizes[0]?.id ?? null));
  }, [sizes]);

  const selectedColour = colours.find((c) => c.id === colourId);
  const selectedFabric = garment?.fabrics.find((f) => f.id === fabricId);
  const selectedSize = sizes.find((s) => s.id === sizeId);
  const variant = garment && fabricId && colourId && sizeId
    ? findVariant(data?.variants ?? [], garment.id, fabricId, colourId, sizeId)
    : undefined;

  if (isLoading) {
    return <p className="text-ink-muted">Завантаження…</p>;
  }
  if (isError || !data) {
    return <p className="text-danger">Не вдалося завантажити принт.</p>;
  }
  if (data.garments.length === 0) {
    return (
      <div>
        <h1 className="text-2xl text-ink">{data.print.title}</h1>
        <p className="mt-4 text-ink-muted">
          Поки що немає жодного виробу у вітрині, тож замовити цей принт нема на чому.
          Напишіть нам — зробимо вручну.
        </p>
      </div>
    );
  }

  const garmentPriceMinor = variant?.priceOverrideMinor ?? garment?.basePriceMinor ?? 0;
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
        <h1 className="text-2xl text-ink">{data.print.title}</h1>
        <p className="mt-2 text-xl font-semibold text-ink" aria-live="polite">
          {formatUAH(minor(totalMinor))}
          {garment && (
            <span className="ml-2 text-sm font-normal text-ink-subtle">
              {formatUAH(minor(garmentPriceMinor))} виріб + {formatUAH(minor(data.printPriceMinor))} друк
            </span>
          )}
        </p>

        {data.garments.length > 1 && (
          <fieldset className="mt-6">
            <legend className="mb-2 text-sm font-medium text-ink-muted">Виріб</legend>
            <div className="flex flex-wrap gap-2">
              {data.garments.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  aria-pressed={g.id === garment?.id}
                  onClick={() => setGarmentId(g.id)}
                  className={[
                    'rounded-pill border-2 px-4 py-1.5 text-sm font-medium transition',
                    g.id === garment?.id ? 'border-ink bg-ink text-surface' : 'border-line text-ink-muted hover:border-ink-subtle',
                  ].join(' ')}
                >
                  {g.name}
                  {/* Ціна поруч із назвою, бо саме вона робить вибір виробом,
                      а не вгадуванням: різниця між футболкою й худі тут у
                      два з половиною рази. */}
                  <span className={g.id === garment?.id ? 'ml-2 opacity-70' : 'ml-2 text-ink-subtle'}>
                    {formatUAH(minor(g.basePriceMinor + data.printPriceMinor))}
                  </span>
                </button>
              ))}
            </div>
          </fieldset>
        )}

        {garment && garment.fabrics.length > 1 && (
          <fieldset className="mt-6">
            <legend className="mb-2 text-sm font-medium text-ink-muted">Тканина</legend>
            <div className="flex flex-wrap gap-2">
              {garment.fabrics.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  aria-pressed={f.id === fabricId}
                  onClick={() => setFabricId(f.id)}
                  className={[
                    'rounded-pill border-2 px-4 py-1.5 text-sm font-medium transition',
                    f.id === fabricId ? 'border-ink bg-ink text-surface' : 'border-line text-ink-muted hover:border-ink-subtle',
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
            <legend id="colour-label" className="mb-2 text-sm font-medium text-ink-muted">Колір</legend>
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
            <legend id="size-label" className="mb-2 text-sm font-medium text-ink-muted">Розмір</legend>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-labelledby="size-label">
              {sizes.map((s) => (
                <SizeButton key={s.id} size={s} selected={s.id === sizeId} onSelect={setSizeId} />
              ))}
            </div>
          </fieldset>
        )}

        {garment && <SizeChart sizes={garment.sizes} highlight={sizeId} />}

        {selectedSize && (
          <div className="mt-6" aria-live="polite">
            <AvailabilityBadge state={selectedSize.state} leadTimeDays={selectedSize.leadTimeDays} />
          </div>
        )}

        {!checkoutOpen && (
          <button
            type="button"
            disabled={!variant || selectedSize?.state === 'UNAVAILABLE'}
            onClick={() => setCheckoutOpen(true)}
            className="mt-8 w-full rounded-card bg-ink px-6 py-3 font-semibold text-surface transition hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Оплатити
          </button>
        )}

        {checkoutOpen && (
          <form className="mt-8 flex flex-col gap-3" onSubmit={handleCheckoutSubmit}>
            <label className="flex flex-col gap-1 text-sm text-ink-muted">
              Ім&rsquo;я
              <input
                type="text"
                required
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="rounded-card border border-line px-3 py-2 text-ink focus:border-ink"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-ink-muted">
              Телефон
              <input
                type="tel"
                required
                placeholder="+380XXXXXXXXX"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="rounded-card border border-line px-3 py-2 text-ink focus:border-ink"
              />
            </label>
            {checkoutError && <p className="text-sm text-danger" role="alert">{checkoutError}</p>}
            <button
              type="submit"
              disabled={checkout.isPending}
              className="rounded-card bg-ink px-6 py-3 font-semibold text-surface transition hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {checkout.isPending ? 'Оформлюємо…' : `Оплатити ${formatUAH(minor(totalMinor))}`}
            </button>
          </form>
        )}
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
        className="aspect-square w-full rounded-card border border-line object-cover"
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
                'w-1/5 overflow-hidden rounded-card border transition',
                index === active ? 'border-accent ring-2 ring-accent' : 'border-line hover:border-ink',
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
