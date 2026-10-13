'use client';

import Image from 'next/image';
import { useState } from 'react';
import { canOptimizeImage } from '@/lib/image-source';

/**
 * Якість зменшеної копії. Одне значення на весь сайт: `q` входить у ключ кешу
 * оптимізатора, тож кожне інше значення подвоювало б кількість трансформацій.
 */
const CARD_QUALITY = 72;

/**
 * Заглушка на місці фото, якого немає або яке не завантажилось.
 *
 * Поки завантаження зображень не зроблено, каталог тримається на демо-даних, і
 * будь-який з посилань може виявитись мертвим. Порожній прямокутник виглядає
 * як зламана сторінка; підписаний — як товар, у якого просто ще немає фото.
 */
export function PrintThumb({
  src, alt, className = '', ratio = 'square', sizes, priority = false, eager = false,
}: {
  src?: string | null;
  alt: string;
  className?: string;
  /**
   * Квадрат — для дрібних мініатюр (кошик, пошук, адмінка), де важливо, щоб
   * рядок не розповзався. Вертикаль 3:4 — для вітрини: обкладинка принта це
   * фото людини у виробі, і квадрат різав би її по груди.
   */
  ratio?: 'square' | 'portrait';
  /**
   * Режим картки. Якщо задано, фото йде через `next/image`: браузер отримує
   * зменшену копію під цей розмір замість оригіналу ≈1200×1800 (≈150 КБ), а
   * `loading` стає ледачим, поки не сказано іншого. Значення це CSS-ширина
   * фото на кожному брейкпоінті, так само як атрибут `sizes` в `<img>`.
   * Без нього компонент працює як раніше: кошик, пошук і адмінка не змінюються.
   */
  sizes?: string;
  /** Перша картка екрана (потенційний LCP): без lazy, з preload і `fetchpriority=high`. */
  priority?: boolean;
  /** Картка першого екрана: без lazy, але без preload. Має сенс лише разом із `sizes`. */
  eager?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const box = ratio === 'portrait' ? 'aspect-[3/4]' : 'aspect-square';

  if (!src || failed) {
    return (
      <div
        className={`flex ${box} w-full flex-col items-center justify-center gap-2 rounded-card border border-dashed border-line-strong bg-surface-sunken text-ink-subtle ${className}`}
        role="img"
        aria-label={`${alt} — фото ще немає`}
      >
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"
             strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <circle cx="8.5" cy="10" r="1.5" />
          <path d="m21 15-5-4-4 3-2-1.5L3 17" />
        </svg>
        <span className="px-2 text-center text-xs">Фото готуємо</span>
      </div>
    );
  }

  if (sizes !== undefined) {
    const above = priority || eager;
    // Місце під фото задає обгортка з фіксованою пропорцією: макет не стрибає,
    // поки картинка ще вантажиться.
    if (canOptimizeImage(src)) {
      return (
        <div className={`relative ${box} w-full overflow-hidden rounded-card ${className}`}>
          <Image
            src={src}
            alt={alt}
            fill
            sizes={sizes}
            quality={CARD_QUALITY}
            priority={priority}
            loading={priority ? undefined : above ? 'eager' : 'lazy'}
            decoding="async"
            onError={() => setFailed(true)}
            className="object-cover"
          />
        </div>
      );
    }
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt}
        loading={above ? 'eager' : 'lazy'}
        decoding="async"
        onError={() => setFailed(true)}
        className={`${box} w-full rounded-card object-cover ${className}`}
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      onError={() => setFailed(true)}
      className={`${box} w-full rounded-card object-cover ${className}`}
    />
  );
}
