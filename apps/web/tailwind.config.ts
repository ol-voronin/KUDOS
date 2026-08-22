import type { Config } from 'tailwindcss';

/**
 * Tokens only — no raw hex in components. Warm-neutral base + a single
 * terracotta accent, per the approved "тепла редакція" direction
 * (Unbounded display + Onest text, 4px corner radius system-wide).
 */
export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: '#1a1714', muted: '#6b6255', subtle: '#948b7c' },
        surface: { DEFAULT: '#f0ece3', raised: '#ffffff', sunken: '#e7e1d4' },
        line: { DEFAULT: '#e0d9cb', strong: '#cfc5b1' },
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

