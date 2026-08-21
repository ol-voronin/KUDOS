'use client';

import { useEffect, useMemo, useState } from 'react';
import { minor, formatUAH } from '@dt/contracts';
import { usePrintOffer } from '../hooks/usePrintOffer';
import { findVariant, selectableColours, selectableSizes } from '../variant-selection';
import { AvailabilityBadge } from './AvailabilityBadge';
import { ColourSwatch } from './ColourSwatch';
import { SizeButton } from './SizeButton';

export function PrintOfferView({ slug }: { slug: string }) {
  const { data, isLoading, isError } = usePrintOffer(slug);

  const [garmentId, setGarmentId] = useState<string | null>(null);
  const [fabricId, setFabricId] = useState<string | null>(null);
  const [colourId, setColourId] = useState<string | null>(null);
  const [sizeId, setSizeId] = useState<string | null>(null);

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
        <h1 className="text-2xl font-bold">{data.print.title}</h1>
        <p className="mt-4 text-ink-muted">Цей принт поки що не доступний на жодному виробі.</p>
      </div>
    );
  }

  const garmentPriceMinor = variant?.priceOverrideMinor ?? garment?.basePriceMinor ?? 0;
  const totalMinor = garmentPriceMinor + data.printPriceMinor;

  return (
    <div className="grid gap-10 md:grid-cols-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={data.print.previewUrl} alt={data.print.title} className="w-full rounded-card border border-line object-cover" />

      <div>
        <h1 className="text-2xl font-bold">{data.print.title}</h1>
        <p className="mt-2 text-xl font-semibold text-ink">{formatUAH(minor(totalMinor))}</p>

        {data.garments.length > 1 && (
          <div className="mt-6">
            <p className="mb-2 text-sm font-medium text-ink-muted">Виріб</p>
            <div className="flex flex-wrap gap-2">
              {data.garments.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setGarmentId(g.id)}
                  className={[
                    'rounded-card border-2 px-3 py-1.5 text-sm font-medium transition',
                    g.id === garment?.id ? 'border-ink text-ink' : 'border-line text-ink-muted hover:border-ink-subtle',
                  ].join(' ')}
                >
                  {g.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {garment && garment.fabrics.length > 1 && (
          <div className="mt-6">
            <p className="mb-2 text-sm font-medium text-ink-muted">Тканина</p>
            <div className="flex flex-wrap gap-2">
              {garment.fabrics.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFabricId(f.id)}
                  className={[
                    'rounded-card border-2 px-3 py-1.5 text-sm font-medium transition',
                    f.id === fabricId ? 'border-ink text-ink' : 'border-line text-ink-muted hover:border-ink-subtle',
                  ].join(' ')}
                >
                  {f.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {colours.length > 0 && (
          <div className="mt-6">
            <p className="mb-2 text-sm font-medium text-ink-muted">Колір</p>
            <div className="flex flex-wrap gap-2" role="radiogroup">
              {colours.map((c) => (
                <ColourSwatch key={c.id} colour={c} selected={c.id === colourId} onSelect={setColourId} />
              ))}
            </div>
          </div>
        )}

        {sizes.length > 0 && (
          <div className="mt-6">
            <p className="mb-2 text-sm font-medium text-ink-muted">Розмір</p>
            <div className="flex flex-wrap gap-2" role="radiogroup">
              {sizes.map((s) => (
                <SizeButton key={s.id} size={s} selected={s.id === sizeId} onSelect={setSizeId} />
              ))}
            </div>
          </div>
        )}

        {selectedSize && (
          <div className="mt-6">
            <AvailabilityBadge state={selectedSize.state} leadTimeDays={selectedSize.leadTimeDays} />
          </div>
        )}

        <button
          type="button"
          disabled={!variant || selectedSize?.state === 'UNAVAILABLE'}
          className="mt-8 w-full rounded-card bg-ink px-6 py-3 font-semibold text-surface transition disabled:cursor-not-allowed disabled:opacity-40"
        >
          Додати в кошик
        </button>
      </div>
    </div>
  );
}
