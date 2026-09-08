'use client';

import { useEffect, useMemo, useState } from 'react';
import { minor, formatUAH, type GarmentOfferDto } from '@dt/contracts';
import { Button, ButtonLink, Drawer, ErrorBanner, Skeleton } from '@/components/ui';
import { useCart } from '@/features/cart/cart-store';
import { useSiteSettings } from '@/app/providers';
import { shipWindow } from '../delivery-estimate';
import { garmentPhoto } from '../garment-photos';
import { readRememberedSize, rememberSize } from '../remembered-size';
import { useGarmentOffer } from '../hooks/useGarmentOffer';
import { findVariant, selectableColours, selectableSizes } from '../variant-selection';
import { AvailabilityBadge } from './AvailabilityBadge';
import { ColourSwatch } from './ColourSwatch';
import { GarmentGallery } from './GarmentGallery';
import { SizeButton } from './SizeButton';
import { SizeChart } from './SizeChart';

/**
 * Сторінка базового одягу: та сама механіка вибору, що в картці принта, —
 * мінус усе, що стосується малюнка.
 *
 * Це навмисно ОКРЕМИЙ компонент, а не PrintOfferView із пропом «без принта».
 * Спільне тут — дрібні цеглинки (свотчі, розміри, шухляда з сіткою), і вони
 * й так спільні. А от каркас різний: у принта дві сутності (малюнок і носій)
 * і галерея макетів, у порожньої речі — одна сутність і фото по кольорах.
 * Один компонент на обидва сценарії перетворився б на ліс if-ів.
 */
export function GarmentOfferView({ slug, initialData }: { slug: string; initialData?: GarmentOfferDto }) {
  const { data, isLoading, isError } = useGarmentOffer(slug, initialData);
  const { add } = useCart();
  const site = useSiteSettings();
  const [sizeChartOpen, setSizeChartOpen] = useState(false);

  const [fabricId, setFabricId] = useState<string | null>(null);
  const [colourId, setColourId] = useState<string | null>(null);
  const [sizeId, setSizeId] = useState<string | null>(null);

  const [rememberedLabel, setRememberedLabel] = useState<string | null>(null);
  useEffect(() => { setRememberedLabel(readRememberedSize()); }, []);

  const [added, setAdded] = useState(false);
  useEffect(() => { setAdded(false); }, [fabricId, colourId, sizeId]);

  const garment = data?.garment;

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

  // Те саме правило, що на сторінці принта: преселект — ТІЛЬКИ розмір,
  // який людина колись обрала сама. Сліпий вибір першого продавав S.
  useEffect(() => {
    if (sizes.length === 0) return;
    setSizeId((current) => {
      if (current !== null && sizes.some((s) => s.id === current)) return current;
      const remembered = rememberedLabel === null
        ? undefined
        : sizes.find((s) => s.label === rememberedLabel && s.state !== 'UNAVAILABLE');
      return remembered?.id ?? null;
    });
  }, [sizes, rememberedLabel]);

  function chooseSize(id: string): void {
    setSizeId(id);
    const picked = sizes.find((s) => s.id === id);
    if (picked) { rememberSize(picked.label); setRememberedLabel(picked.label); }
  }

  const cheapestMinor = useMemo(() => {
    const prices = (data?.variants ?? []).map((v) => v.priceMinor);
    return prices.length > 0 ? Math.min(...prices) : undefined;
  }, [data]);

  const selectedColour = colours.find((c) => c.id === colourId);
  const selectedFabric = garment?.fabrics.find((f) => f.id === fabricId);
  const selectedSize = sizes.find((s) => s.id === sizeId);
  const variant = garment && fabricId && colourId && sizeId
    ? findVariant(data?.variants ?? [], garment.id, fabricId, colourId, sizeId)
    : undefined;

  if (isLoading) {
    return (
      <div className="grid gap-10 md:grid-cols-2">
        <Skeleton className="aspect-square w-full" />
        <div className="flex flex-col gap-4">
          <Skeleton className="h-9 w-3/4" />
          <Skeleton className="h-7 w-1/3" />
          <Skeleton className="h-11 w-full" />
          <Skeleton className="mt-4 h-13 w-full" />
        </div>
      </div>
    );
  }
  if (isError || !data || !garment) {
    return <ErrorBanner>Не вдалося завантажити виріб.</ErrorBanner>;
  }

  const priceIsExact = variant !== null && variant !== undefined;
  const priceMinor = variant?.priceMinor ?? cheapestMinor ?? garment.basePriceMinor;

  // Фото — по кольору: складеного «каталожного» кадру без принта в нас
  // рівно один на колір, і саме він тут головний.
  const photo = selectedColour
    ? garmentPhoto(garment.slug, selectedColour.supplierCode) ?? selectedColour.imageUrl
    : null;

  const garmentName = garment.name;

  function handleAddToCart(): void {
    if (!variant) return;
    add({
      printSlug: null,
      variantId: variant.id,
      printMethod: null,
      quantity: 1,
      title: garmentName,
      previewUrl: photo ?? '',
    });
    setAdded(true);
  }

  return (
    <div className="grid items-start gap-10 md:grid-cols-2">
      <div className="md:sticky md:top-24">
        {selectedColour ? (
          <GarmentGallery
            garmentSlug={garment.slug}
            colourCode={selectedColour.supplierCode}
            colourName={selectedColour.name ?? selectedColour.supplierCode}
            garmentName={garment.name}
          />
        ) : (
          <div className="flex aspect-square items-center justify-center bg-surface-sunken p-6">
            <span className="text-sm text-ink-subtle">Фото цього кольору готуємо</span>
          </div>
        )}
      </div>

      <div>
        <h1 className="font-display text-section font-bold uppercase text-ink">{garment.name}</h1>
        <div className="mt-3 border-t border-ink pt-3" aria-live="polite">
          <p className="font-display text-3xl font-bold text-ink">
            {priceIsExact ? '' : 'від '}{formatUAH(minor(priceMinor))}
          </p>
          <p className="mt-1 text-sm text-ink-subtle">Без принта. Чиста річ — і все.</p>
        </div>

        {garment.fabrics.length > 1 && (
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

        {selectedFabric && (
          <p className="mt-4 text-sm text-ink-muted">
            {selectedFabric.composition} · {selectedFabric.weightGsm} г/м²
            {garment.lengthAdjustable ? ' · можемо вкоротити під зріст' : ''}
          </p>
        )}

        {sizes.length > 0 && (
          <fieldset className="mt-6">
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <legend id="size-label" className="label-eyebrow">Розмір</legend>
              <button
                type="button"
                onClick={() => setSizeChartOpen(true)}
                className="tap-sm text-sm text-ink underline underline-offset-4 hover:opacity-60"
              >
                Таблиця розмірів
              </button>
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
                Минулого разу тут був розмір {rememberedLabel} — позначено крапкою.
              </p>
            )}
          </fieldset>
        )}

        <Drawer open={sizeChartOpen} onClose={() => setSizeChartOpen(false)} title={`Розміри · ${garment.name}`}>
          <SizeChart sizes={garment.sizes} highlight={sizeId} />
        </Drawer>

        {selectedSize && (
          <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-2" aria-live="polite">
            <AvailabilityBadge state={selectedSize.state} leadTimeDays={selectedSize.leadTimeDays} />
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

        <div className="sticky bottom-0 z-10 mt-8 -mx-4 border-t border-ink bg-surface/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 md:static md:mx-0 md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
          <Button
            size="lg"
            full
            disabled={!variant || selectedSize?.state === 'UNAVAILABLE'}
            onClick={handleAddToCart}
          >
            {sizeId === null
              ? 'Спершу обери розмір'
              : added ? 'У кошику ✓' : `Додати в кошик · ${formatUAH(minor(priceMinor))}`}
          </Button>
          {added ? (
            <ButtonLink href="/koshyk" variant="quiet" size="md" full className="mt-2">
              Перейти в кошик →
            </ButtonLink>
          ) : (
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
          Дзеркало блока з картки принта: там пропонуємо «свого пса» на
          принт, тут — принт на чисту річ. Людина, що прийшла по базову
          футболку, може не знати, що каталог узагалі існує.
        */}
        <div className="mt-6 rounded-card border border-line p-4">
          <p className="text-sm font-medium text-ink">Хочеш на цю річ принт?</p>
          <p className="mt-1 text-sm leading-relaxed text-ink-muted">
            У каталозі — принти з собаками за породами й колекціями, а з твого фото
            намалюємо власний.
          </p>
          <ButtonLink href="/prints" variant="outline" size="md" className="mt-3">
            Дивитись принти
          </ButtonLink>
        </div>

        <div className="mt-8 divide-y divide-line border-y border-line">
          <DetailsSection title="Виріб" open>
            <p>
              {garment.description !== ''
                ? garment.description
                : 'Шиємо самі або беремо готові від еко-бренду Native Spirit (Франція).'}
            </p>
            {selectedFabric && (
              <p>
                {selectedFabric.name}: {selectedFabric.composition}, {selectedFabric.weightGsm} г/м²
                {selectedFabric.origin ? ` (${selectedFabric.origin})` : ''}.
              </p>
            )}
          </DetailsSection>

          <DetailsSection title="Догляд">
            <p>
              Прати при 30 °C навиворіт, без відбілювача. Не сушити в машині.
            </p>
          </DetailsSection>

          <DetailsSection title="Строки й доставка">
            <p>
              Виготовлення та відправка: {site.productionDaysMin}–{site.productionDaysMax} робочих
              днів{selectedSize?.leadTimeDays != null ? `, плюс ${selectedSize.leadTimeDays} днів на пошиття цього розміру` : ''}.
            </p>
            <p>
              Нова Пошта — на відділення, в поштомат або курʼєром. Від{' '}
              {Math.round(site.freeShippingFromMinor / 100).toLocaleString('uk-UA')} ₴ доставка за наш рахунок,
              менші замовлення — за тарифами перевізника.
            </p>
          </DetailsSection>

          <DetailsSection title="Оплата, обмін і повернення">
            <p>
              Після оформлення ми звіряємо наявність і надсилаємо рахунок. Картку вводиш на
              стороні Monobank, не в нас; гроші блокуються й списуються після підтвердження.
            </p>
            <p>
              Обмін і повернення — {site.returnDays} днів, якщо річ не носили й збережено вигляд.
            </p>
          </DetailsSection>
        </div>
      </div>
    </div>
  );
}

/** Той самий `<details>`, що на сторінці принта, — Ctrl+F знаходить текст усередині. */
function DetailsSection({ title, children, open = false }: { title: string; children: React.ReactNode; open?: boolean }) {
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
