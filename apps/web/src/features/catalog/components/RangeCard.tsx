'use client';

import Link from 'next/link';
import { useState } from 'react';
import { formatUAH, minor, type RangeGarmentDto } from '@dt/contracts';
import { ButtonLink } from '@/components/ui';
import { garmentPhoto } from '../garment-photos';
import { SizeChart } from './SizeChart';

/**
 * Один виріб у вітрині асортименту.
 *
 * Інтерактив тут рівно один: перемикання кольору міняє кадр. Це не прикраса —
 * це і є відповідь на питання, з яким приходять на цю сторінку («покажіть,
 * як воно виглядає в темно синьому»). Усе інше — статичний текст, і воно
 * рендериться на сервері, бо саме за цими словами сторінку знаходять.
 */
export function RangeCard({ garment, cheapestPrintMinor }: {
  garment: RangeGarmentDto;
  cheapestPrintMinor: number | null;
}) {
  const withPhoto = garment.colours.filter((c) => garmentPhoto(garment.slug, c.supplierCode) !== null);
  const gallery = withPhoto.length > 0 ? withPhoto : garment.colours;
  const [activeId, setActiveId] = useState(gallery[0]?.id ?? null);
  const active = gallery.find((c) => c.id === activeId) ?? gallery[0];
  const src = active ? garmentPhoto(garment.slug, active.supplierCode) : null;
  const fabric = garment.fabrics[0];

  return (
    <article className="grid gap-6 rounded-card border border-line bg-surface p-6 md:grid-cols-[minmax(0,15rem)_1fr]">
      <div>
        <div className="flex aspect-square items-center justify-center rounded-card bg-surface-sunken p-4">
          {src && active ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt={`${garment.name}, ${active.name ?? active.supplierCode}`}
              className="max-h-full w-auto object-contain"
            />
          ) : (
            <span className="text-sm text-ink-subtle">Фото готуємо</span>
          )}
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5" role="radiogroup" aria-label={`Кольори: ${garment.name}`}>
          {gallery.map((c) => (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={c.id === active?.id}
              aria-label={c.name ?? c.supplierCode}
              title={c.name ?? c.supplierCode}
              onClick={() => setActiveId(c.id)}
              className={[
                'h-7 w-7 rounded-full border-2 transition',
                c.id === active?.id ? 'border-ink' : 'border-line hover:border-ink-subtle',
              ].join(' ')}
              style={c.hex ? { backgroundColor: c.hex } : undefined}
            />
          ))}
        </div>
        <p className="mt-2 text-xs text-ink-subtle" aria-live="polite">
          {active?.name ?? '—'} · {garment.colours.length} {plural(garment.colours.length, 'колір', 'кольори', 'кольорів')}
        </p>
      </div>

      <div>
        <h2 className="font-display text-xl font-bold text-ink">
          {/* Заголовок веде на сторінку покупки: картка — це вітрина, купують на PDP. */}
          <Link href={`/vyroby/${garment.slug}`} className="hover:underline">{garment.name}</Link>
        </h2>
        {garment.description && <p className="mt-2 text-sm text-ink-muted">{garment.description}</p>}

        <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          {fabric && (
            <>
              <dt className="text-ink-subtle">Тканина</dt>
              <dd className="text-ink">{fabric.composition}</dd>
              <dt className="text-ink-subtle">Щільність</dt>
              <dd className="text-ink tabular-nums">{fabric.weightGsm} г/м²</dd>
            </>
          )}
          <dt className="text-ink-subtle">Розміри</dt>
          <dd className="text-ink">{garment.sizes.map((s) => s.label).join(' · ')}</dd>
          {garment.leadTimeDays !== null && (
            <>
              <dt className="text-ink-subtle">Шиємо</dt>
              <dd className="text-ink">
                {garment.leadTimeDays} {plural(garment.leadTimeDays, 'робочий день', 'робочі дні', 'робочих днів')}
              </dd>
            </>
          )}
        </dl>

        <p className="mt-4 text-lg font-semibold text-ink">
          {formatUAH(minor(garment.basePriceMinor))}
          <span className="ml-2 text-sm font-normal text-ink-subtle">
            без принта
            {cheapestPrintMinor !== null && (
              <> · з принтом від {formatUAH(minor(garment.basePriceMinor + cheapestPrintMinor))}</>
            )}
          </span>
        </p>

        {/*
          Дві дії, бо в людини два наміри: купити чисту річ або піти
          обирати малюнок. Раніше сторінка була довідником без жодної
          кнопки — тепер базовий одяг купується (прохання Даші).
        */}
        <div className="mt-4 flex flex-wrap gap-3">
          <ButtonLink href={`/vyroby/${garment.slug}`} variant="primary" size="md">
            Купити без принта
          </ButtonLink>
          <ButtonLink href="/prints" variant="outline" size="md">
            Обрати принт
          </ButtonLink>
        </div>

        <SizeChart sizes={garment.sizes} />
      </div>
    </article>
  );
}

/** Українська множина: 1 колір, 2 кольори, 5 кольорів. */
function plural(n: number, one: string, few: string, many: string): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return many;
  const mod10 = n % 10;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}
