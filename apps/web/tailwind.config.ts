import type { Config } from 'tailwindcss';

/**
 * Tokens only — no raw hex in components. The palette is deliberately neutral
 * until the brand identity is decided; swapping these values is the whole
 * change when it is.
 */
export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: '#1c1a17', muted: '#5a5245', subtle: '#8a8071' },
        surface: { DEFAULT: '#faf9f7', raised: '#ffffff', sunken: '#f2efe8' },
        line: { DEFAULT: '#e4e0d9', strong: '#d8d3ca' },
        accent: { DEFAULT: '#c9a227', soft: '#fdf8e8' },
        danger: { DEFAULT: '#8a3a22', soft: '#f7ece8' },
        ok: { DEFAULT: '#3f6b48', soft: '#eaf4ec' },
      },
      spacing: { '4.5': '1.125rem', '18': '4.5rem' },
      borderRadius: { card: '0.75rem' },
      fontFamily: { sans: ['var(--font-sans)', 'system-ui', 'sans-serif'] },
    },
  },
  plugins: [],
} satisfies Config;
