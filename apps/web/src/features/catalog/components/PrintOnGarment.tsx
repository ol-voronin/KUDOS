'use client';

import type { PrintSizeTier } from '@dt/contracts';
import { garmentPhoto } from '../garment-photos';
import { printAreaFor, tierScale } from '../print-area';

/**
 * Авто-мокап: макет принта поверх фото виробу в обраному кольорі.
 *
 * Жодних заздалегідь намальованих мокапів: фото виробу вже є на кожен
 * колір (той самий ракурс), макет у принта один, зона друку описана на
 * виріб у `print-area.ts`. Зміна кольору міняє лише підкладку — принт
 * лягає сам. Тому комбінацій принт×виріб×колір може бути хоч тисяча,
 * а картинок для цього — нуль.
 *
 * Свідомо БЕЗ blend-режимів у першій версії: multiply «вплавляє» принт у
 * складки на світлих виробах, але вбиває його на темних (друк іде з білою
 * підкладкою і в житті НЕ просвічує). Чесний рівний шар правильний для
 * обох випадків; тіні тканини — окрема пригода на потім.
 *
 * Повертає null, якщо фото цього кольору немає, — хай той, хто малює,
 * покаже свій запасний варіант, а не порожню рамку.
 */
export function PrintOnGarment({
  garmentSlug, colourCode, mockupUrl, sizeTier, alt, className = '',
}: {
  garmentSlug: string;
  colourCode: string;
  mockupUrl: string;
  sizeTier: PrintSizeTier;
  alt: string;
  className?: string;
}) {
  const photo = garmentPhoto(garmentSlug, colourCode);
  if (!photo || mockupUrl === '') return null;

  const area = printAreaFor(garmentSlug);
  const k = tierScale(sizeTier);
  // Менший за MAXI принт центрується в зоні по горизонталі; верхня межа
  // лишається — друк «росте вниз» від лінії грудей, як у житті.
  const left = area.x + (area.w * (1 - k)) / 2;
  const width = area.w * k;

  const printBox: React.CSSProperties = {
    left: `${left * 100}%`,
    top: `${area.y * 100}%`,
    width: `${width * 100}%`,
  };

  return (
    <div className={`relative overflow-hidden ${className}`} role="img" aria-label={alt}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={photo} alt="" className="block w-full" draggable={false} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={mockupUrl}
        alt=""
        draggable={false}
        className="absolute"
        style={printBox}
      />
    </div>
  );
}

/** Чи має сенс навіть намагатися: є й макет, і фото цього кольору. */
export function canMockup(garmentSlug: string, colourCode: string, mockupUrl: string): boolean {
  return mockupUrl !== '' && garmentPhoto(garmentSlug, colourCode) !== null;
}
