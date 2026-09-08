'use client';

import { useEffect, useState } from 'react';

export interface RangeAnchor {
  readonly id: string;
  readonly label: string;
  readonly count: number;
}

/**
 * Липка стрічка якорів над асортиментом.
 *
 * Виробів стало забагато для однієї стрічки карток, а пагінація тут була б
 * знущанням: людина шукає ТИП речі, а не сторінку 2. Тому типи — секціями,
 * а це — зміст, який їде разом зі скролом і підсвічує, де ти зараз.
 *
 * Підсвітка через IntersectionObserver, а не onScroll-математику: браузер
 * сам каже, яка секція в кадрі, і жодного перерахунку на кожен піксель.
 */
export function RangeAnchors({ anchors }: { anchors: readonly RangeAnchor[] }) {
  const [activeId, setActiveId] = useState(anchors[0]?.id ?? null);

  useEffect(() => {
    const visible = new Map<string, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) visible.set(e.target.id, e.intersectionRatio);
          else visible.delete(e.target.id);
        }
        // Активна — найвища з видимих у порядку сторінки, а не найбільша за
        // площею: коротка секція внизу не має перебивати ту, що читається.
        const first = anchors.find((a) => visible.has(a.id));
        if (first) setActiveId(first.id);
      },
      { rootMargin: '-96px 0px -55% 0px', threshold: [0, 0.1] },
    );
    for (const a of anchors) {
      const el = document.getElementById(a.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [anchors]);

  return (
    <nav
      aria-label="Типи виробів"
      className="sticky top-16 z-20 -mx-4 border-b border-line bg-surface/95 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6 md:top-20"
    >
      <div className="flex gap-2 overflow-x-auto">
        {anchors.map((a) => (
          <a
            key={a.id}
            href={`#${a.id}`}
            aria-current={a.id === activeId ? 'true' : undefined}
            className={[
              'shrink-0 rounded-pill border px-4 py-1.5 text-sm font-medium transition',
              a.id === activeId
                ? 'border-ink bg-ink text-surface'
                : 'border-line text-ink hover:border-ink',
            ].join(' ')}
          >
            {a.label}
            <span className={a.id === activeId ? 'ml-1.5 opacity-70' : 'ml-1.5 text-ink-subtle'}>
              {a.count}
            </span>
          </a>
        ))}
      </div>
    </nav>
  );
}
