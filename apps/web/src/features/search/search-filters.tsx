'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';

/**
 * Фільтри над результатами.
 *
 * ── Що фільтруємо і, головне, чого НЕ фільтруємо ──────────────────────
 *
 * Замовник спитав «що ще?». Ось відповідь і причини.
 *
 * **Є:**
 *   · порода — питання №1 на цьому сайті;
 *   · колекція — «Босс дзвонить» люди шукають назвою;
 *   · тип виробу — «мені треба худі, а не футболку» звужує вибір удвічі;
 *   · розмір ПРИНТА — він міняє ціну, тобто це чесний фільтр;
 *   · тільки в наявності — єдиний фільтр, що відповідає на «коли отримаю»;
 *   · порядок: новинки / дешевші / дорожчі / за назвою.
 *
 * **Немає — навмисно:**
 *   · розмір одягу (S/M/L). Принт друкується на будь-якому розмірі, тож
 *     такий фільтр не відсіює нічого. Він виглядав би корисним і не робив
 *     би нічого — це гірше за його відсутність. Те, що люди насправді
 *     мають на увазі, кажучи «є мій розмір», закриває «в наявності».
 *   · колір виробу. Він обирається в картці товару, а не звужує перелік
 *     малюнків: той самий принт є на чорному й на білому.
 *   · ціна діапазоном. Поки в каталозі десятки принтів, а не тисячі,
 *     сортування «спершу дешеві» відповідає на те саме питання й не
 *     потребує двох полів вводу.
 *
 * Стан живе в адресі, а не в компоненті: відфільтрованим результатом можна
 * поділитись, його видно в історії й він переживає перезавантаження.
 * `replace`, а не `push` — інакше кнопка «назад» відмотує по одному фільтру.
 */

export interface FilterOption { readonly value: string; readonly label: string }

const TIERS: readonly FilterOption[] = [
  { value: 'MINI', label: 'Міні' },
  { value: 'MEDIUM', label: 'Середній' },
  { value: 'MAXI', label: 'Максі' },
];

const SORTS: readonly FilterOption[] = [
  { value: 'new', label: 'Спершу нові' },
  { value: 'cheap', label: 'Спершу дешевші' },
  { value: 'expensive', label: 'Спершу дорожчі' },
  { value: 'name', label: 'За назвою' },
];

const SELECT =
  'h-11 rounded-card border border-line bg-surface px-3 text-sm text-ink ' +
  'focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink';

export function SearchFilters({
  breeds, collections, garmentTypes, resultCount,
}: {
  breeds: readonly FilterOption[];
  collections: readonly FilterOption[];
  garmentTypes: readonly FilterOption[];
  resultCount: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const setParam = useCallback((key: string, value: string) => {
    const next = new URLSearchParams(params?.toString() ?? '');
    if (value === '') next.delete(key);
    else next.set(key, value);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }, [params, pathname, router]);

  const get = (key: string): string => params?.get(key) ?? '';
  const active = ['breed', 'collection', 'garmentType', 'sizeTier', 'inStock']
    .filter((k) => get(k) !== '').length;

  return (
    <div className="mt-8 border-y border-line py-4">
      <div className="flex flex-wrap items-center gap-3">
        {breeds.length > 0 && (
          <Select label="Порода" value={get('breed')} options={breeds} onChange={(v) => setParam('breed', v)} anyLabel="Будь-яка порода" />
        )}
        {collections.length > 0 && (
          <Select label="Колекція" value={get('collection')} options={collections} onChange={(v) => setParam('collection', v)} anyLabel="Усі колекції" />
        )}
        {garmentTypes.length > 0 && (
          <Select label="Виріб" value={get('garmentType')} options={garmentTypes} onChange={(v) => setParam('garmentType', v)} anyLabel="Будь-який виріб" />
        )}
        <Select label="Розмір принта" value={get('sizeTier')} options={TIERS} onChange={(v) => setParam('sizeTier', v)} anyLabel="Будь-який розмір" />

        <label className="flex h-11 cursor-pointer items-center gap-2 rounded-card border border-line px-3 text-sm text-ink">
          <input
            type="checkbox"
            checked={get('inStock') === '1'}
            onChange={(e) => setParam('inStock', e.target.checked ? '1' : '')}
            className="h-4 w-4 accent-ink"
          />
          Тільки в наявності
        </label>

        <div className="ms-auto flex items-center gap-3">
          <Select label="Порядок" value={get('sort')} options={SORTS} onChange={(v) => setParam('sort', v)} anyLabel="Спершу нові" />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-baseline gap-3 text-sm text-ink-muted">
        {/* Лічильник рахує ПРИНТИ: фільтри не чіпають ні порід, ні колекцій. */}
        <span>
          {resultCount === 0 ? 'Жоден принт не підійшов' : `Принтів: ${resultCount}`}
        </span>
        {active > 0 && (
          <button
            type="button"
            onClick={() => {
              const next = new URLSearchParams();
              const q = get('q');
              if (q !== '') next.set('q', q);
              router.replace(`${pathname}?${next.toString()}`, { scroll: false });
            }}
            className="link-sweep tap-sm text-ink"
          >
            Скинути фільтри ({active})
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Звичайний `<select>`, а не намальована випадайка.
 *
 * На телефоні системний список — це нативне колесо, яке працює краще за
 * будь-що, що ми намалюємо; з клавіатури він працює без жодного рядка
 * коду; скрінрідер знає його напамʼять. Малювати своє тут означало б
 * витратити день і отримати гірше.
 */
function Select({
  label, value, options, onChange, anyLabel,
}: {
  label: string;
  value: string;
  options: readonly FilterOption[];
  onChange: (value: string) => void;
  anyLabel: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        className={`${SELECT} ${value === '' ? 'text-ink-muted' : 'border-ink font-medium'}`}
      >
        <option value="">{anyLabel}</option>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}
