'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '@/components/ui';
import { CartProvider } from '@/features/cart/cart-store';
import { createContext, useContext, useState, type ReactNode } from 'react';
import type { SiteSettingsDto } from '@dt/contracts';

/**
 * Реквізити сайту для клієнтських компонентів.
 *
 * Серверні читають їх запитом, клієнтські так не вміють — і саме тому вони
 * досі тримали телефон і телеграм у файлі з константами. Контекст закриває
 * цю дірку одним місцем: значення приходять із того самого запиту, що й для
 * шапки, і жодна форма більше не має власної копії контакту.
 */
const SettingsContext = createContext<SiteSettingsDto | null>(null);

export function useSiteSettings(): SiteSettingsDto {
  const value = useContext(SettingsContext);
  if (value === null) {
    // Провайдер стоїть у корені, тож сюди можна потрапити лише помилкою
    // складання дерева — і краще впасти на ній, ніж мовчки намалювати
    // порожній телефон.
    throw new Error('useSiteSettings викликано поза Providers');
  }
  return value;
}

export function Providers({ settings, children }: { settings: SiteSettingsDto; children: ReactNode }) {
  const [client] = useState(() => new QueryClient());
  return (
    <SettingsContext.Provider value={settings}>
      <QueryClientProvider client={client}>
        {/*
          Кошик обгортає все: лічильник у шапці й сторінка кошика — це різні
          гілки дерева, і спільний стан у них може бути тільки тут.
        */}
        <CartProvider>
          <ToastProvider>{children}</ToastProvider>
        </CartProvider>
      </QueryClientProvider>
    </SettingsContext.Provider>
  );
}
