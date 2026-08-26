'use client';

import { useEffect } from 'react';

/**
 * Поява елементів при прокрутці.
 *
 * Один спостерігач на всю сторінку, а не компонент-обгортка навколо
 * кожного блока: обгортка додала б зайвий рівень DOM у кожну секцію й
 * змусила б переписати всі блоки. Тут будь-що з класом `reveal` починає
 * працювати саме собою — включно з тим, що редактор додасть завтра.
 *
 * Клас знімається назавжди після першої появи: елемент, який зникає, коли
 * ти гортаєш назад, — це не анімація, а миготіння.
 */
export function Reveal() {
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const nodes = () => document.querySelectorAll<HTMLElement>('.reveal:not(.is-in)');

    if (reduced) {
      nodes().forEach((n) => n.classList.add('is-in'));
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          e.target.classList.add('is-in');
          io.unobserve(e.target);
        }
      },
      // Спрацьовує, коли елемент увійшов на чверть висоти екрана: інакше
      // поява починається вже після того, як людина його прочитала.
      { rootMargin: '0px 0px -18% 0px', threshold: 0.05 },
    );

    nodes().forEach((n) => io.observe(n));

    // Вміст приїжджає частинами (серверні блоки, клієнтські запити), тож
    // самого одноразового обходу мало.
    const mo = new MutationObserver(() => nodes().forEach((n) => io.observe(n)));
    mo.observe(document.body, { childList: true, subtree: true });

    return () => { io.disconnect(); mo.disconnect(); };
  }, []);

  return null;
}
