import type { Config } from 'tailwindcss';

/**
 * Tokens only — no raw hex in components.
 *
 * База біла. Попередній теплий беж (#f0ece3) на великих площинах читався як
 * «брудно»: кремовий фон під фото товару підмішує жовтизну в білі футболки,
 * а їх у Native Spirit половина асортименту. Тепло лишилось там, де воно
 * працює — у вохряному акценті й у ледь теплих нейтралях ліній і заливок.
 *
 * Картки тепер відділяються рамкою, а не заливкою: `surface` і
 * `surface.raised` обидва білі. Це навмисно — так виглядає більшість
 * сучасних магазинів, і фото товару не змагається з фоном.
 */
export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: '#1a1714', muted: '#645c51', subtle: '#8d8578' },
        /** raised === DEFAULT навмисно: картку тримає рамка, не заливка. */
        surface: { DEFAULT: '#ffffff', raised: '#ffffff', sunken: '#f7f6f3' },
        line: { DEFAULT: '#e6e3dc', strong: '#cfcabf' },
        accent: { DEFAULT: '#c2622e', soft: '#f6e4d6', strong: '#9c4d23' },
        info: { DEFAULT: '#3a5a85', soft: '#e6ecf3' },
        danger: { DEFAULT: '#a83226', soft: '#f8e7e3' },
        ok: { DEFAULT: '#3f6b48', soft: '#e7f1e9' },
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

