import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Onest, Unbounded } from 'next/font/google';
import '../styles/globals.css';
import { Providers } from './providers';
import { getSettings } from '@/lib/site-settings';

/**
 * Абсолютна адреса сайту. Без неї Next лишає canonical відносним
 * (`<link rel="canonical" href="/breeds/korgi">`), а відносний canonical
 * пошуковики ігнорують — тобто його наче й немає.
 */
const BASE = process.env['NEXT_PUBLIC_SITE_URL'] ?? 'http://localhost:3000';

const onest = Onest({ subsets: ['latin', 'cyrillic'], variable: '--font-sans', display: 'swap' });
const unbounded = Unbounded({
  subsets: ['latin', 'cyrillic'],
  weight: ['500', '600', '700', '800'],
  variable: '--font-display',
  display: 'swap',
});

export async function generateMetadata(): Promise<Metadata> {
  const site = await getSettings();
  return {
    metadataBase: new URL(BASE),
    // Простий рядок, а не `{ default, template }`: кожна сторінка вже додає
    // назву бренду сама, і шаблон приклеював другу — вийшло
    // «Футболки з принтом Коргі — Kudos print — Doggie Tale».
    title: `${site.brand} — одяг з принтом вашої собаки`,
    description: 'Одяг для тих, у кого є собака.',
  };
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const settings = await getSettings();
  return (
    <html lang="uk" className={`${onest.variable} ${unbounded.variable}`}>
      <body>
        <Providers settings={settings}>{children}</Providers>
      </body>
    </html>
  );
}
