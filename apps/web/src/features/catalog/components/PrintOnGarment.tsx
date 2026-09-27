'use client';

import type { PrintSizeTier } from '@dt/contracts';
import { placementFor, previewBase } from '../print-placement';

/**
 * Орієнтовний вигляд: макет принта поверх фото виробу в обраному кольорі.
 *
 * Мокапів на кожну пару принт×колір ніхто не малює: фото виробу зняті в
 * одному кадрі на всі кольори, а де лежить принт — знято з прикладів
 * розташування (див. `print-placement.ts`). Зміна кольору міняє лише
 * підкладку — принт лягає на те саме місце, під тим самим кутом.
 *
 * Принт вписується в рамку (`object-contain`), а не розтягується: у «Поло»
 * фігурки різної ширини, але одного зросту, і рамка тримає саме зріст.
 *
 * Свідомо БЕЗ blend-режимів: multiply «вплавляє» принт у складки на
 * світлих речах, але вбиває його на темних (друк іде з білою підкладкою і
 * в житті не просвічує). Рівний шар чесний для обох випадків.
 *
 * Повертає null, якщо фото цього кольору немає, — хай той, хто малює,
 * покаже свій запасний варіант, а не порожню рамку.
 */
export function PrintOnGarment({
  printSlug, collectionSlugs, garmentSlug, colourCode, mockupUrl, sizeTier, alt, className = '',
}: {
  printSlug: string;
  collectionSlugs: readonly string[];
  garmentSlug: string;
  colourCode: string;
  mockupUrl: string;
  sizeTier: PrintSizeTier;
  alt: string;
  className?: string;
}) {
  const base = previewBase(garmentSlug, colourCode);
  if (!base || mockupUrl === '') return null;
  const found = placementFor(printSlug, collectionSlugs, garmentSlug, sizeTier, base.aspect);
  if (!found) return null;
  const { placement: p } = found;

  const box: React.CSSProperties = {
    left: `${(p.cx - p.w / 2) * 100}%`,
    top: `${(p.cy - p.h / 2) * 100}%`,
    width: `${p.w * 100}%`,
    height: `${p.h * 100}%`,
    transform: Math.abs(p.rot) > 0.05 ? `rotate(${p.rot}deg)` : undefined,
  };

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      role="img"
      aria-label={alt}
      data-placement={found.source}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={base.src} alt="" className="block h-auto w-full" draggable={false} />
      <div className="absolute" style={box}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={mockupUrl} alt="" draggable={false} className="h-full w-full object-contain" />
      </div>
    </div>
  );
}

/** Чи має сенс навіть намагатися: є і макет, і фото цього кольору. */
export function canMockup(garmentSlug: string, colourCode: string, mockupUrl: string): boolean {
  return mockupUrl !== '' && previewBase(garmentSlug, colourCode) !== null;
}

/** Плоске фото (класична футболка) малюємо з полями, сцену — на всю ширину. */
export function isFlatPreview(garmentSlug: string, colourCode: string): boolean {
  return previewBase(garmentSlug, colourCode)?.flat ?? true;
}
