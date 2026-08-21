import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import '../styles/globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: { default: 'Doggie Tale', template: '%s — Doggie Tale' },
  description: 'Одяг для тих, у кого є собака.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="uk">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
