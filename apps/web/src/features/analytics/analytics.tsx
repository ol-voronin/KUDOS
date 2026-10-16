'use client';

import Link from 'next/link';
import Script from 'next/script';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import type { TrackingConfigDto } from '@dt/contracts';
import { setTrackingConfig, track } from './client';
import { ga4ConsentGranted, sendGtag } from './ga4';

const CONSENT_KEY = 'dt.consent';

type Consent = 'granted' | 'denied' | 'unknown';
/** Ще не прочитали сховище — нічого не вантажимо, щоб не випередити «ні». */
type ConsentState = Consent | 'loading';

function readConsent(): Consent {
  try {
    const value = window.localStorage.getItem(CONSENT_KEY);
    return value === 'granted' || value === 'denied' ? value : 'unknown';
  } catch {
    // Сховище недоступне — плашка просто покажеться знову.
    return 'unknown';
  }
}

/**
 * Статистика й теги.
 *
 *   · **власні події** пишуться завжди. Вони не ставлять cookie й не
 *     містять нічого, що дозволяє когось упізнати, — отже, згода на них не
 *     потрібна;
 *   · **GA4 і Google Ads** працюють одразу: внизу лише плашка «ми
 *     аналізуємо відвідування» з кнопкою «Ок», без вибору.
 *
 * Чому не банер згоди, як було з 12.10. Його ігнорувала більшість людей з
 * реклами, а до згоди GA4 не показує візит у звітах: з 44 кліків по рекламі
 * GA4 побачив 9 сесій, і кампанії не бачили покупок. Рішення Олексія, 15.10:
 * плашка-повідомлення замість згоди.
 *
 * Хто раніше натиснув «Не треба» в старому банері, тому й далі нічого не
 * дозволяємо: тег вантажиться в режимі Consent Mode «усе заборонено» — без
 * cookie, лише знеособлені пінги, з яких Google моделює конверсії.
 */
export function Analytics({ config }: { config: TrackingConfigDto }) {
  const pathname = usePathname();
  const [consent, setConsent] = useState<ConsentState>('loading');

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
      // Instagram — лише подія GA4: власний список подій фіксований у контракті
      // API, а для «чи переходять у Instagram» GA4 достатньо. У Google Ads її
      // можна імпортувати як вторинну конверсію.
      if (href.includes('instagram.com/')) sendGtag('event', 'instagram_click', { link_url: href, page_path: window.location.pathname });
    };
    document.addEventListener('click', onClick, { capture: true });
    return () => document.removeEventListener('click', onClick, { capture: true });
  }, []);

  const decide = (value: 'granted' | 'denied') => {
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

  // Стан за замовчуванням вписується в той самий скрипт, що й `config`, і
  // стоїть перед ним. «Заборонено» — лише для тих, хто колись явно відмовився.
  const level = consent === 'denied' ? 'denied' : 'granted';
  const init = `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}
gtag('consent','default',{ad_storage:'${level}',ad_user_data:'${level}',ad_personalization:'${level}',analytics_storage:'${level}',wait_for_update:500});
gtag('set','ads_data_redaction',true);
gtag('set','url_passthrough',true);
gtag('js', new Date());
${config.ga4MeasurementId !== '' ? `gtag('config','${config.ga4MeasurementId}');` : ''}
${config.googleAdsId !== '' ? `gtag('config','${config.googleAdsId}',{allow_enhanced_conversions:true});` : ''}`;

  // Вирішується один раз на візит, після читання сховища: інакше перший хіт
  // міг би піти з «дозволено» людині, яка колись відмовилась.
  const loadTags = wanted && tagId !== '' && consent !== 'loading';

  return (
    <>
      {loadTags && (
        <>
          <Script id="gtag-init" strategy="afterInteractive">{init}</Script>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${tagId}`} strategy="afterInteractive" />
        </>
      )}

      {wanted && consent === 'unknown' && <AnalyticsNotice onOk={() => decide('granted')} />}
    </>
  );
}

/**
 * Плашка «ми аналізуємо» з однією кнопкою «Ок». Вибору немає (рішення
 * Олексія, 15.10); «Ок» лише ховає плашку назавжди для цього браузера.
 */
function AnalyticsNotice({ onOk }: { onOk: () => void }) {
  const ref = useRef<HTMLDivElement>(null);

  /*
   * Банер не має нічого закривати. Його висота йде в `--consent-h`: на неї
   * піднімаються липкі кнопки «Додати в кошик» (вони теж притиснуті до низу
   * екрана і раніше ховалися під банером), а сторінка отримує такий самий
   * відступ знизу, щоб футер і останні кнопки лишалися досяжними.
   */
  useEffect(() => {
    const el = ref.current;
    if (el === null) return undefined;
    const root = document.documentElement;
    const apply = () => {
      const h = `${Math.ceil(el.getBoundingClientRect().height)}px`;
      root.style.setProperty('--consent-h', h);
      document.body.style.paddingBottom = h;
    };
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(el);
    return () => {
      observer.disconnect();
      root.style.removeProperty('--consent-h');
      document.body.style.paddingBottom = '';
    };
  }, []);

  /*
   * Компактна нижня плашка: 1–2 рядки тексту й кнопка поруч.
   *
   * Попередня версія на телефоні займала ~31 % висоти екрана (пʼять рядків
   * тексту + кнопки стовпчиком) і закривала кнопку першого екрана — тобто
   * перший екран не продавав, доки людина не розбереться з cookie. Пояснення
   * про власну статистику без cookie живе в політиці, куди веде посилання.
   */
  return (
    <div
      ref={ref}
      role="region"
      aria-label="Про аналітику"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-surface px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-lg sm:px-6"
    >
      <div className="mx-auto flex max-w-4xl items-center gap-3 sm:gap-4">
        <p className="flex-1 text-[0.8125rem] leading-snug text-ink-muted">
          Ми використовуємо файли cookie та подібні технології, щоб забезпечувати роботу сайту, аналізувати трафік та покращувати ваш досвід користування.{' '}
          <Link href="/pryvatnist" className="font-medium text-ink underline">Деталі</Link>
        </p>
        <button
          type="button"
          onClick={onOk}
          className="min-h-11 rounded-card border border-ink bg-ink px-6 text-sm font-medium text-surface transition hover:bg-ink/90"
        >
          Ок
        </button>
      </div>
    </div>
  );
}
