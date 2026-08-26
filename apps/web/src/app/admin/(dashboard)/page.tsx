import Link from 'next/link';
import { AdminPage } from '@/features/admin-shell/admin-shell';

/**
 * Перший екран після входу.
 *
 * Був заглушкою з одним абзацом — тобто найчастіше відкриваний екран
 * адмінки не робив нічого. Тут навмисно немає цифр: показувати числа,
 * поки для них немає окремого запиту, означало б смикати чотири API заради
 * сторінки, з якої й так одразу йдуть далі. Замість цього — короткий опис,
 * що робить кожен розділ, бо адмінку відкриває не лише той, хто її будував.
 */
const ENTRIES = [
  { href: '/admin/leads', title: 'Заявки', text: 'Хто написав і що просив. Тут же статус і експорт.' },
  { href: '/admin/prints', title: 'Принти', text: 'Каталог: фото, породи, публікація.' },
  { href: '/admin/tsiny', title: 'Ціни', text: 'База, надбавки за розмір і тканину, акції з датами.' },
  { href: '/admin/storinky', title: 'Сторінки', text: 'Головна, статті, юридичні документи — блоками.' },
  { href: '/admin/statystyka', title: 'Статистика', text: 'Звідки приходять і що з цього приносить гроші.' },
  { href: '/admin/nalashtuvannya', title: 'Налаштування', text: 'Контакти, меню, SEO, конверсії Google Ads.' },
];

export default function AdminHomePage() {
  return (
    <AdminPage title="Огляд" hint="З чого складається адмінка й куди йти за чим.">
      <div className="grid gap-px bg-line sm:grid-cols-2 lg:grid-cols-3">
        {ENTRIES.map((e) => (
          <Link
            key={e.href}
            href={e.href}
            className="group flex flex-col bg-surface p-5 transition hover:bg-surface-sunken focus:outline-none focus-visible:ring-2 focus-visible:ring-ink"
          >
            <span className="font-display text-lg font-bold uppercase text-ink group-hover:underline">
              {e.title}
            </span>
            <span className="mt-1.5 text-sm text-ink-muted">{e.text}</span>
          </Link>
        ))}
      </div>
    </AdminPage>
  );
}
