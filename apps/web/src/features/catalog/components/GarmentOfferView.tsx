'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { minor, formatUAH, type GarmentOfferDto } from '@dt/contracts';
import { Button, ButtonLink, Drawer, ErrorBanner, Skeleton } from '@/components/ui';
import { useCart } from '@/features/cart/cart-store';
import { useSiteSettings } from '@/app/providers';
import {
  CARE_LINE, CARE_WARNING, buyNotes, paymentText, shippingText,
} from '@/config/product-copy';
import { ga4AddToCart, ga4ViewItem, hryvnia, type Ga4Item } from '@/features/analytics/ga4';
import { garmentPhoto } from '../garment-photos';
import { readRememberedSize, rememberSize } from '../remembered-size';
import { useGarmentOffer } from '../hooks/useGarmentOffer';
import { findVariant, selectableColours, selectableSizes } from '../variant-selection';
import { garmentViews, viewLabel } from '../garment-photos';
import { AvailabilityBadge } from './AvailabilityBadge';
import { ColourSwatch } from './ColourSwatch';
import { MediaStack, type MediaFrame } from './MediaStack';
import { SizeButton } from './SizeButton';
import { SizeChart } from './SizeChart';

/**
 * Сторінка базового одягу: та сама механіка вибору, що в картці принта, —
 * мінус усе, що стосується малюнка.
 *
 * Це навмисно ОКРЕМИЙ компонент, а не PrintOfferView із пропом «без принта».
 * Спільне тут — дрібні цеглинки (свотчі, розміри, шухляда з сіткою) і
 * тексти (`config/product-copy`), і вони й так спільні. А от каркас різний:
 * у принта дві сутності (малюнок і носій) і галерея макетів, у порожньої
 * речі — одна сутність і фото по кольорах. Один компонент на обидва
 * сценарії перетворився б на ліс if-ів.
 *
 * ── Розкладка: ліворуч лише візуал, праворуч увесь текст ──────────────
 *
 * Раніше довідковий хвіст (склад, догляд, строки, повернення) стояв під
 * фото, у лівій колонці, а праворуч липла коротка панель покупки. Виглядало
 * охайно й читалося погано: щоб дізнатися склад тканини, треба було
 * повернутися очима ліворуч і вниз, під фото, які до того моменту вже
 * прокрутилися. Тепер поділ проходить по природному шву — картинка проти
 * слів, — і весь текст читається однією колонкою згори вниз, у тому
 * порядку, у якому виникають питання: що це → скільки → в якому кольорі →
 * з чого → якого розміру → як і коли приїде.
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

  // Перегляд виробу — один раз на виріб. Тут товаром є сама річ, а не принт,
  // тож окрема категорія: інакше базовий одяг і принти злипнуться в звіті.
  const viewedSlug = useRef<string | null>(null);
  useEffect(() => {
    if (!data || viewedSlug.current === slug) return;
    viewedSlug.current = slug;
    ga4ViewItem({
      item_id: slug,
      item_name: data.garment.name,
      item_category: 'Базовий одяг',
      price: hryvnia(data.garment.basePriceMinor),
      quantity: 1,
    });
  }, [data, slug]);

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

  /*
   * «Від» ставиться лише тоді, коли ціна справді залежить від вибору.
   *
   * На базових речах надбавок за розмір і колір немає: усі варіанти коштують
   * однаково, і «від 590 ₴» до вибору розміру відрізнялося від 590 ₴ після
   * нього рівно нічим, крім натяку на дрібний шрифт, якого не існує.
   * Надбавки в моделі даних можливі (`priceOverrideMinor`), тож питання
   * вирішується розкидом цін, а не припущенням.
   */
  const priceRange = useMemo(() => {
    const prices = (data?.variants ?? []).map((v) => v.priceMinor);
    if (prices.length === 0) return null;
    return { from: Math.min(...prices), to: Math.max(...prices) };
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
        <Skeleton className="aspect-[3/4] w-full" />
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

  const priceMinor = variant?.priceMinor ?? priceRange?.from ?? garment.basePriceMinor;
  const priceIsExact = variant !== undefined || priceRange === null || priceRange.from === priceRange.to;

  // Фото — по кольору: складеного «каталожного» кадру без принта в нас
  // рівно один на колір, і саме він тут головний.
  const photo = selectedColour
    ? garmentPhoto(garment.slug, selectedColour.supplierCode) ?? selectedColour.imageUrl
    : null;

  const garmentName = garment.name;

  const ga4Item: Ga4Item = {
    item_id: garment.slug,
    item_name: garment.name,
    item_category: 'Базовий одяг',
    item_variant: [selectedColour?.name ?? selectedColour?.supplierCode, selectedSize?.label]
      .filter((part) => part !== undefined && part !== '')
      .join(' · '),
    price: hryvnia(priceMinor),
    quantity: 1,
  };

  function handleAddToCart(): void {
    if (!variant) return;
    ga4AddToCart(ga4Item);
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

  // Кадри обраного кольору: знімальні у своїй пропорції, схема крою —
  // останньою (на ній найкраще видно крій без людини й інтерʼєру).
  const colourName = selectedColour?.name ?? selectedColour?.supplierCode ?? '';
  const frames: MediaFrame[] = selectedColour ? [
    ...garmentViews(garment.slug, selectedColour.supplierCode).map((s) => ({
      key: s.view,
      src: s.src,
      alt: `${garment.name}, ${colourName} — ${viewLabel(s.view).toLowerCase()}`,
    })),
    ...(photo !== null ? [{
      key: 'scheme', src: photo, alt: `${garment.name}, ${colourName} — схема крою`, kind: 'scheme' as const,
    }] : []),
  ] : [];

  return (
    <div className="grid items-start gap-x-10 gap-y-10 md:grid-cols-2">
      <div>
        <MediaStack frames={frames} emptyText="Фото цього кольору готуємо" />
      </div>

      <div>
        <h1 className="font-display text-section font-bold uppercase text-ink">{garment.name}</h1>

        <div className="mt-4 border-t border-ink pt-4" aria-live="polite">
          <p className="font-display text-3xl font-bold text-ink">
            {priceIsExact ? '' : 'від '}{formatUAH(minor(priceMinor))}
          </p>
          {/*
            Перший рядок однаковий на всіх семи виробах і стоїть тут
            навмисно: сторінка базового одягу відкривається з каталогу
            принтів, і перше питання до неї — «а це взагалі з малюнком чи
            без». Другий рядок — паспорт конкретного виробу.
          */}
          <p className="mt-3 text-sm leading-relaxed text-ink-muted">
            Без принта. Чиста базова річ — і все.
            {garment.description !== '' && <><br />{garment.description}</>}
          </p>
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
            {/*
              Назва кольору поруч із міткою, а не в підказці свотча.
              «Смарагдовий» і «Зелений мох» на екрані відрізняються менше,
              ніж у назві, а кружечок не вміщає підпису; доки назву було
              видно тільки при наведенні, з телефона вона не була видна
              взагалі — і в замовленні опинявся не той зелений.
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
          Склад і догляд — одразу під кружками кольорів, а не в розділі
          внизу. Це не довідка «на потім»: щільність 180 проти 350 г/м²
          відповідає на питання «це на літо чи на зиму», яке виникає рівно
          тут, поки людина дивиться на річ.
        */}
        {selectedFabric && (
          <p className="mt-5 text-sm leading-relaxed text-ink-muted">
            <span className="label-eyebrow">Склад:</span>{' '}
            {selectedFabric.composition.replace(/[.\s]+$/, '')}. Щільність {selectedFabric.weightGsm} г/м².
          </p>
        )}
        <p className="mt-3 text-sm leading-relaxed text-ink-muted">
          <span className="label-eyebrow">Догляд:</span> {CARE_LINE}
          <br />
          {CARE_WARNING}
        </p>

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
            {/*
              Попередження стоїть ПІД кнопками розмірів, а не над ними:
              зверху його зчитують як підпис до поля й пропускають. Наші
              вироби йдуть у розмірах виробу, не тіла, і «зазвичай ношу M» —
              найчастіша причина обміну.
            */}
            <p className="mt-3 text-sm text-ink">
              Перш ніж обрати розмір, ознайомся із{' '}
              <button
                type="button"
                onClick={() => setSizeChartOpen(true)}
                className="tap-sm font-medium text-ink underline underline-offset-4 hover:opacity-60"
              >
                Таблицею розмірів
              </button>!
            </p>
            {rememberedLabel !== null && (
              <p className="mt-2 text-xs text-ink-subtle">
                Минулого разу тут був розмір {rememberedLabel} — позначено крапкою.
              </p>
            )}
          </fieldset>
        )}

        <Drawer open={sizeChartOpen} onClose={() => setSizeChartOpen(false)} title="Таблиця розмірів">
          <SizeChart garment={garment} highlight={sizeId} />
        </Drawer>

        {selectedSize && (
          <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-2" aria-live="polite">
            <AvailabilityBadge state={selectedSize.state} leadTimeDays={selectedSize.leadTimeDays} />
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
              {buyNotes(site, false).map((n) => <li key={n}>· {n}</li>)}
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
          <DetailsSection title="Строки й доставка" open>
            {shippingText(site).map((p) => <p key={p}>{p}</p>)}
          </DetailsSection>
          <DetailsSection title="Оплата, обмін і повернення" open>
            {paymentText(site, false).map((p) => <p key={p}>{p}</p>)}
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
      <div className="mt-3 flex flex-col gap-3 text-sm leading-relaxed text-ink-muted">{children}</div>
    </details>
  );
}
