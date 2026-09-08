'use client';

import { useEffect, useState } from 'react';
import { garmentPhoto, garmentViews, viewLabel } from '../garment-photos';

/**
 * Галерея кадрів базового одягу: великий кадр + стрічка мініатюр.
 *
 * Кадри йдуть за кольором: людина перемкнула колір — увесь набір підмінився,
 * а обраний ракурс за можливості зберігся (дивилась спинку в чорному —
 * побачить спинку і в хакі). Паспортний кадр підмішується останнім як «Схема»:
 * на ньому найкраще видно крій без людини й інтер'єру.
 *
 * Коли знімальних кадрів немає (гібриди поки без фотосесії) — це просто
 * паспортне фото без мініатюр, тобто рівно те, що сторінка показувала досі.
 */
export function GarmentGallery({ garmentSlug, colourCode, colourName, garmentName }: {
  garmentSlug: string;
  colourCode: string;
  colourName: string;
  garmentName: string;
}) {
  const shots = garmentViews(garmentSlug, colourCode);
  const passport = garmentPhoto(garmentSlug, colourCode);
  const frames = [
    ...shots.map((s) => ({ key: s.view, src: s.src, label: viewLabel(s.view) })),
    ...(passport !== null ? [{ key: 'passport', src: passport, label: 'Схема' }] : []),
  ];

  const [activeKey, setActiveKey] = useState(frames[0]?.key ?? null);
  // Зміна кольору: тримаємо ракурс, якщо він існує і в новому кольорі.
  useEffect(() => {
    setActiveKey((current) => (
      current !== null && frames.some((f) => f.key === current) ? current : frames[0]?.key ?? null
    ));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [garmentSlug, colourCode]);

  const active = frames.find((f) => f.key === activeKey) ?? frames[0];

  if (!active) {
    return (
      <div className="flex aspect-square items-center justify-center bg-surface-sunken p-6">
        <span className="text-sm text-ink-subtle">Фото цього кольору готуємо</span>
      </div>
    );
  }

  return (
    <div>
      <div className="flex aspect-square items-center justify-center overflow-hidden bg-surface-sunken">
        {/* Паспортний кадр — «схема» на світлому тлі, його не можна кропати. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={active.src}
          alt={`${garmentName}, ${colourName} — ${active.label.toLowerCase()}`}
          className={active.key === 'passport' ? 'max-h-full w-auto object-contain p-6' : 'h-full w-full object-cover'}
        />
      </div>

      {frames.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Ракурси фото">
          {frames.map((f) => (
            <button
              key={f.key}
              type="button"
              role="tab"
              aria-selected={f.key === active.key}
              aria-label={f.label}
              title={f.label}
              onClick={() => setActiveKey(f.key)}
              className={[
                'h-16 w-16 shrink-0 overflow-hidden rounded-card border-2 bg-surface-sunken transition',
                f.key === active.key ? 'border-ink' : 'border-line hover:border-ink-subtle',
              ].join(' ')}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={f.src} alt="" className="h-full w-full object-cover" draggable={false} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
