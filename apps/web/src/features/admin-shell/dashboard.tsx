'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { AdminStatsDto, formatUAH, minor } from '@dt/contracts';
import { apiFetch } from '@/lib/api-client';
import { listLeads } from '@/features/leads/api';
import { DailyChart } from '@/features/admin-stats/daily-chart';
import { Skeleton } from '@/components/ui';

/**
 * Головний екран адмінки.
 *
 * Був заглушкою з одним абзацом — тобто екран, який відкривають найчастіше,
 * не робив нічого. Тепер він відповідає на три питання в тому порядку, у
 * якому їх ставлять уранці: чи є нові заявки, скільки людей приходило, чи
 * були гроші.
 *
 * Цифри беруться з тих самих двох запитів, що вже є на інших екранах, — не
 * заводимо окремий «дашбордний» ендпоінт заради сторінки, з якої одразу
 * йдуть далі.
 *
 * Тиждень, а не місяць: на місячному вікні падіння за три дні непомітне, а
 * саме воно й вимагає реакції.
 */
const DAYS = 7;

function getStats(): Promise<AdminStatsDto> {
  return apiFetch(`/admin/analytics/stats?days=${DAYS}`, AdminStatsDto);
}

export function Dashboard() {
  const stats = useQuery({ queryKey: ['admin-stats', DAYS], queryFn: getStats });
  const fresh = useQuery({
    queryKey: ['admin-leads-new'],
    queryFn: () => listLeads('NEW', 1),
    staleTime: 30_000,
  });

  const t = stats.data?.totals;
  const newLeads = fresh.data?.total ?? 0;

  return (
    <div className="flex flex-col gap-8">
      <section>
        <dl className="grid gap-px bg-line sm:grid-cols-2 lg:grid-cols-4">
          <Tile
            label="Нові заявки"
            value={fresh.isLoading ? null : String(newLeads)}
            hint={newLeads > 0 ? 'чекають на відповідь' : 'усі опрацьовані'}
            href="/admin/leads"
            alarm={newLeads > 0}
          />
          <Tile label="Візити за тиждень" value={t ? String(t.visits) : null} hint="унікальні сесії" href="/admin/statystyka" delay={90} />
          <Tile label="Замовлення" value={t ? String(t.orders) : null} hint="оплачені за тиждень" href="/admin/statystyka" delay={180} />
          <Tile
            label="Дохід"
            value={t ? formatUAH(minor(t.revenueMinor)) : null}
            hint={t ? `конверсія ${(t.conversionHundredths / 100).toFixed(1)} %` : undefined}
            href="/admin/statystyka"
            delay={270}
          />
        </dl>
      </section>

      {/*
        Графік має місце ще до того, як приїхали дані. Раніше секція просто
        не малювалась, і сторінка стрибала на висоту графіка рівно тоді,
        коли на неї вже дивилися.
      */}
      {stats.isLoading && (
        <section className="rounded-card border border-line p-4">
          <Skeleton className="h-4 w-40" />
          <div className="mt-4 flex h-32 items-end gap-1.5" aria-busy="true">
            {Array.from({ length: DAYS }, (_, i) => (
              <Skeleton
                key={i}
                className={`flex-1 ${['h-1/3', 'h-2/3', 'h-1/2', 'h-full', 'h-3/5', 'h-2/5', 'h-4/5'][i % 7] ?? 'h-1/2'}`}
                delay={i * 90}
              />
            ))}
          </div>
        </section>
      )}

      {stats.data && stats.data.daily.length > 0 && (
        <section className="rounded-card border border-line p-4">
          <DailyChart
            title="Візити за день"
            points={stats.data.daily}
            pick={(p) => p.visits}
            ariaTotalLabel={`${stats.data.totals.visits} візитів за ${DAYS} днів`}
          />
        </section>
      )}

      <section>
        <h2 className="label-eyebrow mb-3">Куди далі</h2>
        <div className="grid gap-px bg-line sm:grid-cols-2 lg:grid-cols-3">
          {ENTRIES.map((e) => (
            <Link
              key={e.href}
              href={e.href}
              className="group flex flex-col bg-surface p-5 transition-colors duration-200 hover:bg-surface-sunken focus:outline-none focus-visible:ring-2 focus-visible:ring-ink"
            >
              <span className="flex items-center gap-2 font-display text-base font-bold uppercase text-ink">
                {e.title}
                <span
                  aria-hidden
                  className="translate-x-0 opacity-0 transition-all duration-200 group-hover:translate-x-1 group-hover:opacity-100 motion-reduce:transition-none"
                >
                  →
                </span>
              </span>
              <span className="mt-1.5 text-sm text-ink-muted">{e.text}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

const ENTRIES = [
  { href: '/admin/zamovlennya', title: 'Замовлення', text: 'Нові приходять неоплаченими. Підтвердьте — і виставте рахунок.' },
  { href: '/admin/leads', title: 'Заявки', text: 'Хто написав і що просив. Статус і експорт.' },
  { href: '/admin/prints', title: 'Принти', text: 'Каталог: фото, породи, публікація.' },
  { href: '/admin/tsiny', title: 'Ціни', text: 'База, надбавки, акції з датами.' },
  { href: '/admin/storinky', title: 'Сторінки', text: 'Головна, статті, документи — блоками.' },
  { href: '/admin/statystyka', title: 'Статистика', text: 'Звідки приходять і що приносить гроші.' },
  { href: '/admin/nalashtuvannya', title: 'Налаштування', text: 'Контакти, меню, SEO, конверсії.' },
];

/**
 * Плитка з числом.
 *
 * `null` означає «ще рахуємо» й малює смугу тієї ж висоти, що й число —
 * інакше рядок плиток підстрибує, коли приходять дані.
 */
function Tile({
  label, value, hint, href, alarm = false, delay = 0,
}: { label: string; value: string | null; hint?: string; href: string; alarm?: boolean; delay?: number }) {
  return (
    <Link
      href={href}
      className="group flex flex-col bg-surface p-5 transition-colors duration-200 hover:bg-surface-sunken focus:outline-none focus-visible:ring-2 focus-visible:ring-ink"
    >
      <dt className="label-eyebrow">{label}</dt>
      <dd className="mt-2">
        {value === null
          ? <Skeleton className="h-8 w-20" delay={delay} />
          : (
            <span className={`font-display text-3xl font-extrabold tabular-nums ${alarm ? 'text-accent' : 'text-ink'}`}>
              {value}
            </span>
          )}
      </dd>
      {hint !== undefined && <p className="mt-1 text-xs text-ink-subtle">{hint}</p>}
    </Link>
  );
}
