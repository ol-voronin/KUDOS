import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Onest, Oswald } from 'next/font/google';
import '../styles/globals.css';
import { Providers } from './providers';
import { Analytics } from '@/features/analytics/analytics';
import { getSettings } from '@/lib/site-settings';
import { getTracking } from '@/lib/tracking';

/**
 * Абсолютна адреса сайту. Без неї Next лишає canonical відносним
 * (`<link rel="canonical" href="/breeds/korgi">`), а відносний canonical
 * пошуковики ігнорують — тобто його наче й немає.
 */
const BASE = process.env['NEXT_PUBLIC_SITE_URL'] ?? 'http://localhost:3000';

const onest = Onest({ subsets: ['latin', 'cyrillic'], variable: '--font-sans', display: 'swap' });

/**
 * Вузький важкий ґротеск у заголовках — головна впізнавана риса напрямку.
 * Oswald узятий тому, що це єдиний вузький капс на Google Fonts із повною
 * кирилицею; у референсі (vidro) стоїть ліцензійний шрифт типу Druk, і його
 * можна буде підмінити пізніше, змінивши тільки цей блок.
 */
const oswald = Oswald({
  subsets: ['latin', 'cyrillic'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-display',
  display: 'swap',
});

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings();
  return {
    metadataBase: new URL(BASE),
    // Поки індексація вимкнена — `noindex` на кожній сторінці, а не тільки в
    // robots.txt. robots.txt забороняє обхід, але сторінку, на яку вже є
    // посилання, він з індексу не прибирає; метатег прибирає.
    ...(settings.allowIndexing ? {} : { robots: { index: false, follow: false } }),
    ...(settings.googleSiteVerification !== ''
      ? { verification: { google: settings.googleSiteVerification } }
      : {}),
    ...(settings.defaultOgImage !== ''
      ? { openGraph: { images: [settings.defaultOgImage] } }
      : {}),
    // Простий рядок, а не `{ default, template }`: кожна сторінка вже додає
    // назву бренду сама, і шаблон приклеював другу — вийшло
    // «Футболки з принтом Коргі — Kudos print — Doggie Tale».
    title: `${settings.brand} — одяг з принтом вашої собаки`,
    description: 'Одяг для тих, у кого є собака.',
  };
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const [settings, tracking] = await Promise.all([getSettings(), getTracking()]);
  return (
    <html lang="uk" className={`${onest.variable} ${oswald.variable}`}>
      <body>
        <Providers settings={settings}>
          {children}
          {/* Після вмісту навмисно: статистика ніколи не має затримувати сторінку. */}
          <Analytics config={tracking} />
        </Providers>
      </body>
    </html>
  );
}
