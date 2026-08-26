import type { Metadata } from 'next';
import type { ReactNode } from 'react';
/*
 * Шрифти лежать у репозиторії, а не тягнуться з Google під час збірки.
 *
 * `next/font/google` качає файли на етапі білду. За корпоративним проксі
 * (або просто без інтернету) це падає — і падає тихо: змінна `--font-display`
 * не зʼявляється, `font-family: var(--font-display), …` стає недійсною
 * декларацією цілком, разом із запасними варіантами, і браузер малює все
 * дефолтним засічковим. Сайт виглядає як газета, і за виглядом неможливо
 * здогадатися, що причина в мережі.
 *
 * @fontsource ставиться як звичайна залежність із npm: збірка більше не
 * залежить від доступу до fonts.googleapis.com узагалі.
 */
import '@fontsource/oswald/cyrillic-400.css';
import '@fontsource/oswald/cyrillic-500.css';
import '@fontsource/oswald/cyrillic-600.css';
import '@fontsource/oswald/cyrillic-700.css';
import '@fontsource/oswald/latin-400.css';
import '@fontsource/oswald/latin-500.css';
import '@fontsource/oswald/latin-600.css';
import '@fontsource/oswald/latin-700.css';
import '@fontsource-variable/onest';
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
    <html lang="uk">
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
