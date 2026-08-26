'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { MenuArea, MenuItemDto, SiteChromeDto, SiteSettingsDto } from '@dt/contracts';
import { ApiError } from '@/lib/api-client';
import { createMenuItem, deleteMenuItem, getSettings, updateMenuItem, updateSettings } from './api';
import { SeoPanel } from './seo-panel';

const KEY = ['admin-settings'];

const inputCls =
  'w-full rounded-card border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-ink focus:outline-none';
const labelCls = 'block text-xs font-semibold uppercase tracking-wide text-ink-subtle';

/**
 * Поля згруповані так, як про них думають, а не так, як вони лежать у базі.
 *
 * `hint` тут важливіший за назву: «місцевий відмінок» — це не примха, а
 * причина, чому в тексті виходить «шиємо у Харкові», а не «шиємо Харків».
 */
const GROUPS: ReadonlyArray<{
  title: string;
  hint?: string;
  fields: ReadonlyArray<{ name: keyof SiteSettingsDto; label: string; hint?: string; numeric?: boolean; boolean?: boolean }>;
}> = [
  {
    title: 'Назва й місто',
    fields: [
      { name: 'brand', label: 'Назва', hint: 'Підставляється в тексти як {{brand}} і стоїть у заголовку кожної сторінки.' },
      { name: 'city', label: 'Місто', hint: 'Називний відмінок: Харків.' },
      { name: 'cityIn', label: 'Місто у фразі', hint: 'Місцевий відмінок із прийменником: «у Харкові». Так виходить «шиємо у Харкові».' },
      { name: 'workingHours', label: 'Години роботи', hint: 'Необовʼязково.' },
    ],
  },
  {
    title: 'Контакти',
    hint: 'Ці ж значення підставляються в тексти сторінок і стоять у футері.',
    fields: [
      { name: 'phone', label: 'Телефон для посилання', hint: 'Без пробілів: +380501234567 — з нього робиться tel:.' },
      { name: 'phoneDisplay', label: 'Телефон як показувати', hint: '+380 50 123 45 67' },
      { name: 'telegram', label: 'Telegram', hint: 'Без «собачки».' },
      { name: 'telegramUrl', label: 'Посилання на Telegram', hint: 'Повна адреса з https://.' },
      { name: 'email', label: 'Пошта', hint: 'Канал для звернень щодо персональних даних — його вимагає політика конфіденційності.' },
    ],
  },
  {
    title: 'Реквізити',
    hint: 'Сторона договору в офері. Без них оферта юридично порожня.',
    fields: [
      { name: 'legalEntityName', label: 'Повна назва' },
      { name: 'legalEntityShort', label: 'Коротка назва', hint: 'Для футера: ФОП Прізвище І. П.' },
      { name: 'taxNumber', label: 'РНОКПП' },
    ],
  },
  {
    title: 'Пошук',
    hint: 'Поки індексацію вимкнено, сайт закритий від пошуку — і в robots.txt, і метатегом на кожній сторінці.',
    fields: [
      { name: 'allowIndexing', label: 'Показувати сайт у пошуку', boolean: true, hint: 'Вмикайте, коли на сайті остаточна назва й свій домен.' },
      { name: 'googleSiteVerification', label: 'Код Search Console', hint: 'Тільки значення content із тега підтвердження.' },
      { name: 'defaultOgImage', label: 'Картинка для превʼю', hint: 'Показується в месенджерах, коли у сторінки немає своєї. Адреса з / або https://.' },
    ],
  },
  {
    title: 'Умови',
    fields: [
      { name: 'freeShippingFromMinor', label: 'Безкоштовна доставка від, ₴', numeric: true, hint: 'Підставляється як {{freeShippingFrom}}.' },
      { name: 'returnDays', label: 'Днів на повернення', numeric: true, hint: 'Підставляється як {{returnDays}}.' },
    ],
  },
];

export function SettingsScreen() {
  const { data, isLoading, isError } = useQuery({ queryKey: KEY, queryFn: getSettings });

  if (isLoading) return <p className="text-ink-muted">Завантаження…</p>;
  if (isError || !data) return <p className="text-danger">Не вдалося завантажити налаштування.</p>;

  return (
    <div className="flex flex-col gap-10">
      <SettingsForm data={data} />
      <MenuEditor data={data} />
      <SeoPanel />
    </div>
  );
}

function SettingsForm({ data }: { data: SiteChromeDto }) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<SiteSettingsDto>(data.settings);

  // Значення з сервера мають перемагати локальні: два відкриті таби інакше
  // розходяться мовчки, і той, що зберігся другим, затирає перший.
  useEffect(() => { setDraft(data.settings); }, [data.settings]);

  const save = useMutation({
    mutationFn: updateSettings,
    onSuccess: (fresh) => qc.setQueryData(KEY, fresh),
  });

  const dirty = JSON.stringify(draft) !== JSON.stringify(data.settings);

  return (
    <form
      className="flex flex-col gap-8"
      onSubmit={(e) => { e.preventDefault(); save.mutate(draft); }}
    >
      <div>
        <h2 className="font-display text-lg font-bold text-ink">Реквізити сайту</h2>
        <p className="mt-1 max-w-prose text-sm text-ink-muted">
          Звідси беруться футер, метадані сторінок і всі підстановки в текстах: напишете новий
          телефон тут — він зміниться і в офері, і в питаннях на головній.
        </p>
      </div>

      {GROUPS.map((group) => (
        <section key={group.title}>
          <h3 className="font-display font-bold text-ink">{group.title}</h3>
          {group.hint && <p className="mt-1 text-sm text-ink-muted">{group.hint}</p>}
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {group.fields.map((field) => {
              const value = draft[field.name];

              if (field.boolean) {
                return (
                  <div key={String(field.name)} className="md:col-span-2">
                    <label className="flex items-center gap-2 text-sm text-ink">
                      <input
                        type="checkbox"
                        checked={value === true}
                        onChange={(e) => setDraft({ ...draft, [field.name]: e.target.checked })}
                        className="h-4 w-4"
                      />
                      {field.label}
                    </label>
                    {field.hint && <p className="mt-1 text-xs text-ink-subtle">{field.hint}</p>}
                  </div>
                );
              }

              const shown = field.numeric && field.name === 'freeShippingFromMinor'
                ? String((value as number) / 100)
                : String(value);
              return (
                <div key={String(field.name)}>
                  <label className={labelCls} htmlFor={`s-${String(field.name)}`}>{field.label}</label>
                  <input
                    id={`s-${String(field.name)}`}
                    type="text"
                    className={`${inputCls} mt-1`}
                    value={shown}
                    onChange={(e) => {
                      const raw = e.target.value;
                      setDraft({
                        ...draft,
                        [field.name]: field.numeric
                          ? Math.max(0, Math.round(Number(raw.replace(',', '.')) * (field.name === 'freeShippingFromMinor' ? 100 : 1)) || 0)
                          : raw,
                      });
                    }}
                  />
                  {field.hint && <p className="mt-1 text-xs text-ink-subtle">{field.hint}</p>}
                </div>
              );
            })}
          </div>
        </section>
      ))}

      {save.error && (
        <p className="rounded-card border border-danger px-4 py-3 text-sm text-danger" role="alert">
          {save.error instanceof ApiError ? save.error.message : 'Не вдалося зберегти'}
        </p>
      )}

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={!dirty || save.isPending}
          className="rounded-card bg-accent px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
        >
          {save.isPending ? 'Зберігаю…' : dirty ? 'Зберегти' : 'Збережено'}
        </button>
        <p className="text-xs text-ink-subtle">
          Сторінки оновляться протягом кількох хвилин — вони кешуються.
        </p>
      </div>
    </form>
  );
}

const AREA_LABEL: Record<MenuArea, string> = { HEADER: 'Шапка', FOOTER: 'Футер' };

function MenuEditor({ data }: { data: SiteChromeDto }) {
  const qc = useQueryClient();
  const [adding, setAdding] = useState<MenuArea | null>(null);

  const save = useMutation({
    mutationFn: ({ id, ...dto }: { id: string; isActive?: boolean; position?: number }) => updateMenuItem(id, dto),
    onSuccess: (fresh) => qc.setQueryData(KEY, fresh),
  });
  const remove = useMutation({
    mutationFn: deleteMenuItem,
    onSuccess: (fresh) => qc.setQueryData(KEY, fresh),
  });

  const error = save.error ?? remove.error;

  return (
    <section className="flex flex-col gap-6">
      <div>
        <h2 className="font-display text-lg font-bold text-ink">Меню</h2>
        <p className="mt-1 max-w-prose text-sm text-ink-muted">
          Вимкнений пункт зникає з сайту, але лишається тут. Це навмисно: пункт, який
          прибрали на місяць, не треба набирати заново.
        </p>
      </div>

      {error && (
        <p className="rounded-card border border-danger px-4 py-3 text-sm text-danger" role="alert">
          {error instanceof ApiError ? error.message : 'Не вдалося зберегти'}
        </p>
      )}

      {(['HEADER', 'FOOTER'] as const).map((area) => {
        const items = data.menu.filter((m) => m.area === area);
        return (
          <div key={area}>
            <h3 className="font-display font-bold text-ink">{AREA_LABEL[area]}</h3>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-max border-collapse text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-ink-muted">
                    {area === 'FOOTER' && <th scope="col" className="py-2 pr-4 font-medium">Колонка</th>}
                    <th scope="col" className="py-2 pr-4 font-medium">Напис</th>
                    <th scope="col" className="px-3 py-2 font-medium">Адреса</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">Порядок</th>
                    <th scope="col" className="px-3 py-2 text-center font-medium">На сайті</th>
                    <th scope="col" className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <MenuRow
                      key={item.id}
                      item={item}
                      showGroup={area === 'FOOTER'}
                      busy={save.isPending || remove.isPending}
                      onSave={(dto) => save.mutate({ id: item.id, ...dto })}
                      onDelete={() => remove.mutate(item.id)}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            {adding === area
              ? <NewMenuItem area={area} onDone={() => setAdding(null)} />
              : (
                <button
                  type="button"
                  onClick={() => setAdding(area)}
                  className="mt-3 rounded-card border border-line px-4 py-2 text-sm text-ink hover:border-ink"
                >
                  Додати пункт
                </button>
              )}
          </div>
        );
      })}
    </section>
  );
}

function MenuRow({
  item, showGroup, busy, onSave, onDelete,
}: {
  item: MenuItemDto;
  showGroup: boolean;
  busy: boolean;
  onSave: (dto: { isActive?: boolean; position?: number }) => void;
  onDelete: () => void;
}) {
  const [position, setPosition] = useState(String(item.position));
  useEffect(() => { setPosition(String(item.position)); }, [item.position]);

  const parsed = Number(position);
  const valid = Number.isInteger(parsed) && parsed >= 0 && parsed <= 999;

  return (
    <tr className="border-b border-line">
      {showGroup && <td className="py-2 pr-4 text-ink-muted">{item.group || '—'}</td>}
      <th scope="row" className="py-2 pr-4 text-left font-medium text-ink">{item.label}</th>
      <td className="px-3 py-2 font-mono text-xs text-ink-muted">{item.href}</td>
      <td className="px-3 py-2 text-right">
        <input
          type="text"
          inputMode="numeric"
          value={position}
          aria-label={`Порядок: ${item.label}`}
          onChange={(e) => setPosition(e.target.value)}
          onBlur={() => { if (valid && parsed !== item.position) onSave({ position: parsed }); }}
          disabled={busy}
          className={[
            'w-16 rounded-card border px-2 py-1 text-right tabular-nums text-ink',
            valid ? 'border-line focus:border-ink' : 'border-danger',
          ].join(' ')}
        />
      </td>
      <td className="px-3 py-2 text-center">
        <input
          type="checkbox"
          checked={item.isActive}
          aria-label={`Показувати ${item.label}`}
          disabled={busy}
          onChange={(e) => onSave({ isActive: e.target.checked })}
          className="h-4 w-4"
        />
      </td>
      <td className="px-3 py-2 text-right">
        <button type="button" onClick={onDelete} disabled={busy} className="text-sm text-ink-subtle hover:text-danger">
          Видалити
        </button>
      </td>
    </tr>
  );
}

function NewMenuItem({ area, onDone }: { area: MenuArea; onDone: () => void }) {
  const qc = useQueryClient();
  const [label, setLabel] = useState('');
  const [href, setHref] = useState('/');
  const [group, setGroup] = useState('');
  const [position, setPosition] = useState('100');

  const create = useMutation({
    mutationFn: createMenuItem,
    onSuccess: (fresh) => { qc.setQueryData(KEY, fresh); onDone(); },
  });

  const parsed = Number(position);
  const canSubmit = label.trim() !== '' && /^(\/|#|https?:\/\/|mailto:|tel:)/.test(href) && Number.isInteger(parsed);

  return (
    <form
      className="mt-3 flex flex-wrap items-end gap-4 rounded-card border border-line p-4"
      onSubmit={(e) => {
        e.preventDefault();
        create.mutate({ area, group: group.trim(), label: label.trim(), href: href.trim(), position: parsed });
      }}
    >
      <label className="flex flex-col gap-1 text-sm text-ink-muted">
        Напис
        <input type="text" value={label} onChange={(e) => setLabel(e.target.value)} className={`${inputCls} w-48`} />
      </label>
      <label className="flex flex-col gap-1 text-sm text-ink-muted">
        Адреса
        <input type="text" value={href} onChange={(e) => setHref(e.target.value)} className={`${inputCls} w-56`} />
      </label>
      {area === 'FOOTER' && (
        <label className="flex flex-col gap-1 text-sm text-ink-muted">
          Колонка
          <input type="text" value={group} onChange={(e) => setGroup(e.target.value)} className={`${inputCls} w-40`} />
        </label>
      )}
      <label className="flex flex-col gap-1 text-sm text-ink-muted">
        Порядок
        <input type="text" inputMode="numeric" value={position} onChange={(e) => setPosition(e.target.value)} className={`${inputCls} w-20 text-right`} />
      </label>

      {create.error && (
        <p className="w-full text-sm text-danger" role="alert">
          {create.error instanceof ApiError ? create.error.message : 'Не вдалося створити'}
        </p>
      )}

      <button
        type="submit"
        disabled={!canSubmit || create.isPending}
        className="rounded-card bg-ink px-4 py-2 text-sm text-surface disabled:opacity-40"
      >
        Додати
      </button>
      <button type="button" onClick={onDone} className="px-3 py-2 text-sm text-ink-muted">Скасувати</button>
    </form>
  );
}
