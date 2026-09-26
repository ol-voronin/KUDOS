'use client';

import Link from 'next/link';
import Script from 'next/script';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { TrackingConfigDto } from '@dt/contracts';
import { setTrackingConfig, track } from './client';
import { ga4ConsentGranted } from './ga4';

const CONSENT_KEY = 'dt.consent';

type Consent = 'granted' | 'denied' | 'unknown';

function readConsent(): Consent {
  try {
    const value = window.localStorage.getItem(CONSENT_KEY);
    return value === 'granted' || value === 'denied' ? value : 'unknown';
  } catch {
    // Сховище недоступне — вважаємо, що згоди немає. Помилка на користь
    // відвідувача, а не на користь звітів.
    return 'denied';
  }
}

/**
 * Статистика й теги.
 *
 * Тут проходить межа, заради якої весь цей модуль і розділений надвоє:
 *
 *   · **власні події** пишуться завжди. Вони не ставлять cookie й не
 *     містять нічого, що дозволяє когось упізнати, — отже, згода на них не
 *     потрібна ні за законом, ні по совісті;
 *   · **GA4 і Google Ads** не вантажаться взагалі, доки людина не натисне
 *     «Погоджуюсь». Не «вантажаться з обмеженнями», а не вантажаться: жоден
 *     запит на google не йде, поки згоди немає.
 *
 * Другий варіант — Consent Mode з дозволеними безcookie-пінгами — дав би
 * Google трохи більше даних для моделювання. Він теж законний, але означає
 * запит на чужий сервер до згоди, і пояснювати цю різницю в політиці
 * складніше, ніж вона того варта на нашому обсязі.
 */
export function Analytics({ config }: { config: TrackingConfigDto }) {
  const pathname = usePathname();
  const [consent, setConsent] = useState<Consent>('unknown');

  useEffect(() => { setTrackingConfig(config); }, [config]);
  useEffect(() => { setConsent(readConsent()); }, []);

  // Перегляд сторінки — на кожну зміну адреси, включно з переходами всередині
  // застосунку: у Next це не перезавантаження, і без цього рахувався б лише
  // перший екран візиту.
  useEffect(() => {
    if (pathname === null) return;
    track('page_view', { path: pathname });
  }, [pathname]);

  // Кліки в Telegram ловимо одним слухачем на документ, а не пропсом у
  // кожній кнопці. Причина не в лінощах: посилання на телеграм є і в шапці,
  // і у формах, і всередині блоків, які редагує людина, — і остання група
  // ніколи не отримала б обробника.
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const link = target?.closest?.('a');
      const href = link?.getAttribute('href') ?? '';
      if (href.includes('t.me/')) track('telegram_click');
    };
    document.addEventListener('click', onClick, { capture: true });
    return () => document.removeEventListener('click', onClick, { capture: true });
  }, []);

  const decide = (value: Consent) => {
    try { window.localStorage.setItem(CONSENT_KEY, value); } catch { /* нічого */ }
    setConsent(value);
    // Явні сигнали Consent Mode v2. Без `ad_user_data` розширені конверсії
    // не спрацьовують узагалі — а в інтерфейсі Google при цьому все
    // виглядає ввімкненим. Це найтихіша з відомих поломок вимірювання.
    if (value === 'granted') ga4ConsentGranted();
  };

  // Той самий сигнал для тих, хто дав згоду раніше: він живе у сховищі, а
  // не в теґу, і при кожному новому візиті його треба проставити знову.
  useEffect(() => { if (consent === 'granted') ga4ConsentGranted(); }, [consent]);

  const wanted = config.ga4MeasurementId !== '' || config.googleAdsId !== '';
  const tagId = config.ga4MeasurementId !== '' ? config.ga4MeasurementId : config.googleAdsId;

  return (
    <>
      {wanted && consent === 'granted' && tagId !== '' && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${tagId}`} strategy="afterInteractive" />
          <Script id="gtag-init" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
${config.ga4MeasurementId !== '' ? `gtag('config','${config.ga4MeasurementId}');` : ''}
${config.googleAdsId !== '' ? `gtag('config','${config.googleAdsId}');` : ''}`}
          </Script>
        </>
      )}

      {wanted && consent === 'unknown' && <ConsentBanner onDecide={decide} />}
    </>
  );
}

/**
 * Банер згоди.
 *
 * Дві однакові за вагою кнопки. Варіант, де «погоджуюсь» — велика кнопка, а
 * «ні» — сірий напис дрібним шрифтом, збирає більше згод і є маніпуляцією;
 * у ЄС за таке штрафують, а тут це просто нечесно.
 */
function ConsentBanner({ onDecide }: { onDecide: (value: 'granted' | 'denied') => void }) {
  return (
    <div
      role="dialog"
      aria-label="Згода на аналітику"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-surface px-6 py-4 shadow-lg"
    >
      <div className="mx-auto flex max-w-4xl flex-col gap-3 sm:flex-row sm:items-center">
        <p className="flex-1 text-sm leading-relaxed text-ink-muted">
          Ми користуємось Google Аналітикою, щоб бачити, які сторінки корисні. Вона ставить
          cookie. Наша власна статистика працює без них і нікого не впізнає — вона рахує
          сторінки, а не людей. Деталі —{' '}
          <Link href="/pryvatnist" className="font-medium text-ink underline">у політиці конфіденційності</Link>.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onDecide('denied')}
            className="min-h-11 flex-1 rounded-card border border-line px-5 text-sm font-medium text-ink transition hover:border-ink sm:flex-none"
          >
            Не треба
          </button>
          <button
            type="button"
            onClick={() => onDecide('granted')}
            className="min-h-11 flex-1 rounded-card border border-ink bg-ink px-5 text-sm font-medium text-surface transition hover:bg-ink/90 sm:flex-none"
          >
            Погоджуюсь
          </button>
        </div>
      </div>
    </div>
  );
}
