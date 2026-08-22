import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Onest, Unbounded } from 'next/font/google';
import '../styles/globals.css';
import { Providers } from './providers';

const onest = Onest({ subsets: ['latin', 'cyrillic'], variable: '--font-sans', display: 'swap' });
const unbounded = Unbounded({
  subsets: ['latin', 'cyrillic'],
  weight: ['500', '600', '700', '800'],
  variable: '--font-display',
  display: 'swap',
});

export const metadata: Metadata = {
  title: { default: 'Doggie Tale', template: '%s — Doggie Tale' },
  description: 'Одяг для тих, у кого є собака.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="uk" className={`${onest.variable} ${unbounded.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
