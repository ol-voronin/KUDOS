import type { Config } from 'tailwindcss';

/**
 * Tokens only — no raw hex in components.
 *
 * Палітра свідомо яскравіша за першу версію: чорний текст на білому читався
 * як технічна документація, а не як магазин одягу. Але яскравість тут не в
 * заливці великих площин кольором — вона в трьох насичених акцентах, які
 * розводять секції за змістом:
 *
 *   accent  (теракота) — дія: кнопки, ціни, «купити»
 *   teal    (смарагд)  — довіра: гарантії, оплата, B2B
 *   sun     (вохра)    — радість: подарунки, новинки, «весела» частина
 *   plum    (слива)    — колекції: жанри, творчість
 *
 * Фон під фото товару лишається білим: кремовий підмішує жовтизну в білі
 * футболки, а їх у Native Spirit половина асортименту. Кольорові зони —
 * лише під текстовими секціями, де фото немає.
 */
export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: '#17120e', muted: '#5b5248', subtle: '#8a8175' },
        /** raised === DEFAULT навмисно: картку тримає рамка, не заливка. */
        surface: { DEFAULT: '#ffffff', raised: '#ffffff', sunken: '#faf6f0' },
        line: { DEFAULT: '#e8e2d8', strong: '#cfc6b7' },

        accent: { DEFAULT: '#d9531e', soft: '#ffe9dc', strong: '#ad3d11', ink: '#6f2708' },
        teal:   { DEFAULT: '#0f7368', soft: '#dcf3ef', strong: '#0a5850', ink: '#06342f' },
        sun:    { DEFAULT: '#c98a00', soft: '#fdf0cf', strong: '#a06d00', ink: '#5a3d00' },
        plum:   { DEFAULT: '#7b2d5e', soft: '#fae4f1', strong: '#5f2149', ink: '#3a1330' },

        info: { DEFAULT: '#3a5a85', soft: '#e6ecf3' },
        danger: { DEFAULT: '#a83226', soft: '#f8e7e3' },
        ok: { DEFAULT: '#0f7368', soft: '#dcf3ef' },
      },
      spacing: { '4.5': '1.125rem', '18': '4.5rem' },
      borderRadius: { card: '0.25rem', pill: '9999px' },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'var(--font-sans)', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'hero': ['clamp(2.5rem, 2rem + 2.5vw, 3.75rem)', { lineHeight: '1.05', letterSpacing: '-0.02em' }],
      },
    },
  },
  plugins: [],
} satisfies Config;
