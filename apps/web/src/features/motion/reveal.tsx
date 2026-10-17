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
 *
 * Перший екран не анімується ніколи (аудит 17.10, LCP). Порядок важливий:
 * спершу все, що вже в полі зору, отримує `is-in`, і лише потім на `<html>`
 * ставиться `reveal-ready`, після якого CSS починає ховати решту. Тобто
 * видимий вміст не блимає навіть на кадр, а без JS сторінка просто видима.
 * Під `prefers-reduced-motion` клас не ставиться зовсім.
 */
export function Reveal() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    if (typeof IntersectionObserver === 'undefined') return undefined;

    const root = document.documentElement;
    const pending = () => document.querySelectorAll<HTMLElement>('.reveal:not(.is-in)');
    /** Уже на екрані (або вище) — показуємо без анімації. */
    const onScreen = (el: HTMLElement) => el.getBoundingClientRect().top < window.innerHeight;

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          e.target.classList.add('is-in');
          io.unobserve(e.target);
        }
      },
      // Спрацьовує трохи раніше, ніж елемент доїде до видимої зони: поява
      // має закінчитись до того, як людина почне читати.
      { rootMargin: '0px 0px -10% 0px', threshold: 0.05 },
    );

    const watched = new WeakSet<HTMLElement>();
    const sweep = () => pending().forEach((n) => {
      if (watched.has(n)) return;
      if (onScreen(n)) { n.classList.add('is-in'); return; }
      watched.add(n);
      io.observe(n);
    });

    sweep();
    root.classList.add('reveal-ready');

    // Вміст приїжджає частинами (серверні блоки, клієнтські запити), тож
    // самого одноразового обходу мало.
    // Обхід — раз на кадр, а не на кожну мутацію: шапка, кошик і фільтри
    // міняють DOM часто, а замір позиції кожного елемента не безкоштовний.
    let frame = 0;
    const mo = new MutationObserver(() => {
      if (frame !== 0) return;
      frame = requestAnimationFrame(() => { frame = 0; sweep(); });
    });
    mo.observe(document.body, { childList: true, subtree: true });

    return () => {
      io.disconnect();
      mo.disconnect();
      if (frame !== 0) cancelAnimationFrame(frame);
      root.classList.remove('reveal-ready');
    };
  }, []);

  return null;
}
