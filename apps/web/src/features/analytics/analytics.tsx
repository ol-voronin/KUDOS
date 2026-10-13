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
    // Сховище недоступне — вважаємо, що згоди немає. Помилка на користь
    // відвідувача, а не на користь звітів.
    return 'denied';
  }
}

/**
 * Статистика й теги.
 *
 *   · **власні події** пишуться завжди. Вони не ставлять cookie й не
 *     містять нічого, що дозволяє когось упізнати, — отже, згода на них не
 *     потрібна;
 *   · **GA4 і Google Ads** працюють у розширеному Consent Mode v2. Тег
 *     вантажиться одразу, але зі станом «усе заборонено»: до згоди Google не
 *     ставить і не читає cookie, а отримує лише знеособлені пінги, з яких
 *     моделює пропущені візити й конверсії. Після «Погоджуюсь» стан
 *     оновлюється до «дозволено».
 *
 * Чому не базовий режим, як було. На рекламі з телефона більшість людей
 * банер просто ігнорує — і для Google їх не існувало: кампанії вчилися на
 * кількох відсотках трафіку, а покупок не бачили зовсім. Розширений режим
 * повертає Google ці дані без cookie.
 *
 * Явне «Не треба» шануємо жорсткіше, ніж вимагає Consent Mode: такій людині
 * тег не вантажиться взагалі, жоден запит на google не йде.
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
  // стоїть перед ним: інакше перший хіт піде без стану згоди, і Google
  // вважатиме, що згода була.
  const level = consent === 'granted' ? 'granted' : 'denied';
  const init = `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}
gtag('consent','default',{ad_storage:'${level}',ad_user_data:'${level}',ad_personalization:'${level}',analytics_storage:'${level}',wait_for_update:500});
gtag('set','ads_data_redaction',true);
gtag('set','url_passthrough',true);
gtag('js', new Date());
${config.ga4MeasurementId !== '' ? `gtag('config','${config.ga4MeasurementId}');` : ''}
${config.googleAdsId !== '' ? `gtag('config','${config.googleAdsId}',{allow_enhanced_conversions:true});` : ''}`;

  // Вирішується один раз на візит: <Script> не вивантажується, тож теги, які
  // вже поїхали, лишаються, а після «Не треба» вони просто й далі без cookie.
  const loadTags = wanted && tagId !== '' && (consent === 'granted' || consent === 'unknown');

  return (
    <>
      {loadTags && (
        <>
          <Script id="gtag-init" strategy="afterInteractive">{init}</Script>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${tagId}`} strategy="afterInteractive" />
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
   * Компактна нижня плашка: 1–2 рядки тексту й дві кнопки поруч.
   *
   * Попередня версія на телефоні займала ~31 % висоти екрана (пʼять рядків
   * тексту + кнопки стовпчиком) і закривала кнопку першого екрана — тобто
   * перший екран не продавав, доки людина не розбереться з cookie. Пояснення
   * про власну статистику без cookie живе в політиці, куди веде посилання.
   */
  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Згода на аналітику"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-surface px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-lg sm:px-6"
    >
      <div className="mx-auto flex max-w-4xl flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-4">
        <p className="flex-1 text-[0.8125rem] leading-snug text-ink-muted">
          Google Аналітика ставить cookie лише з твоєї згоди.{' '}
          <Link href="/pryvatnist" className="font-medium text-ink underline">Деталі</Link>
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
