'use client';

import { useEffect } from 'react';

/**
 * Курсор — крапка з кільцем, що відстає.
 *
 * Прийом упізнаваний саме в тому сегменті, на який ми рівняємось, але він
 * має три чесні обмеження, і всі три тут дотримані:
 *
 *   · тільки миша (`pointer: fine`) і широкий екран — на тачскріні курсора
 *     немає, і ховати системний означало б зламати сторінку;
 *   · вимикається під `prefers-reduced-motion` — рух, що тягнеться за
 *     рукою, найгірше переноситься саме тими, кому шкодить рух узагалі;
 *   · нічого не перехоплює: `pointer-events: none`, тож жоден клік не
 *     проходить через нього інакше, ніж проходив би без нього.
 *
 * Позиція рахується у `requestAnimationFrame` і пишеться в `transform` —
 * не в `left/top`. Інакше кожен рух миші викликає перерахунок розкладки, і
 * на довгій сторінці курсор починає відставати ривками.
 */
const RING_LAG = 0.18;

export function Cursor() {
  useEffect(() => {
    const fine = window.matchMedia('(pointer: fine) and (min-width: 64rem)');
    const calm = window.matchMedia('(prefers-reduced-motion: no-preference)');
    if (!fine.matches || !calm.matches) return;

    const dot = document.createElement('div');
    const ring = document.createElement('div');
    dot.className = 'cursor-dot';
    ring.className = 'cursor-ring';
    dot.setAttribute('aria-hidden', 'true');
    ring.setAttribute('aria-hidden', 'true');
    document.body.append(dot, ring);
    document.documentElement.classList.add('has-cursor');

    let x = window.innerWidth / 2, y = window.innerHeight / 2;
    let rx = x, ry = y, frame = 0;

    function onMove(e: MouseEvent): void {
      x = e.clientX; y = e.clientY;
      const el = e.target instanceof Element ? e.target : null;
      const hot = el?.closest('a, button, [role="button"], input, select, textarea, label') !== null && el !== null;
      ring.classList.toggle('is-hot', hot);
      // Світлий курсор там, де під ним фотографія або темна секція.
      const dark = el?.closest('[data-cursor="light"]') !== null && el !== null;
      dot.classList.toggle('on-dark', dark);
      ring.classList.toggle('on-dark', dark);
    }

    function tick(): void {
      rx += (x - rx) * RING_LAG;
      ry += (y - ry) * RING_LAG;
      dot.style.transform = `translate3d(${x - 3}px, ${y - 3}px, 0)`;
      ring.style.transform = `translate3d(${rx - 18}px, ${ry - 18}px, 0)`;
      frame = requestAnimationFrame(tick);
    }

    function onLeave(): void { dot.style.opacity = '0'; ring.style.opacity = '0'; }
    function onEnter(): void { dot.style.opacity = '1'; ring.style.opacity = '1'; }

    window.addEventListener('mousemove', onMove, { passive: true });
    document.addEventListener('mouseleave', onLeave);
    document.addEventListener('mouseenter', onEnter);
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseleave', onLeave);
      document.removeEventListener('mouseenter', onEnter);
      document.documentElement.classList.remove('has-cursor');
      dot.remove(); ring.remove();
    };
  }, []);

  return null;
}
