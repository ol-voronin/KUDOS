import { useSiteSettings } from '@/app/providers';

/**
 * Заглушка замість завантаження фото.
 *
 * Ендпоінта завантаження ще немає (приватний бакет, presigned upload,
 * перевірка MIME й розміру, антивірус — окремий шматок роботи). Але бриф без
 * фото все одно кращий за відсутній бриф: ви й так підтверджуєте кожне
 * замовлення в Telegram, тож фото приходять саме там.
 *
 * Блок навмисно виглядає як частина форми, а не як зламане поле: людина має
 * зрозуміти, що це так задумано, і що від неї нічого не загубилось.
 */
export function PhotoPlaceholder() {
  const site = useSiteSettings();
  return (
    <div className="rounded-card border border-dashed border-line-strong bg-surface-sunken p-5">
      <div className="flex items-start gap-3">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
             strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="mt-0.5 shrink-0 text-ink-subtle">
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <circle cx="8.5" cy="10" r="1.5" />
          <path d="m21 15-5-4-4 3-2-1.5L3 17" />
        </svg>
        <div>
          <p className="text-sm font-medium text-ink">Фото собаки</p>
          <p className="mt-1 text-sm leading-relaxed text-ink-muted">
            Завантаження на сайті ще робимо. Надішліть фото у відповідь у Telegram —
            ми напишемо вам одразу після брифу, і там же все обговоримо.
          </p>
          <a
            href={site.telegramUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex min-h-11 items-center rounded-card border border-line bg-surface-raised px-4 text-sm font-medium text-ink transition hover:border-ink"
          >
            Відкрити Telegram
          </a>
        </div>
      </div>
    </div>
  );
}
