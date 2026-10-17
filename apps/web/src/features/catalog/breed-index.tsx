'use client';

import Link from 'next/link';
import { useId, useMemo, useState } from 'react';
import { searchText, type BreedCardDto } from '@dt/contracts';
import { plural } from '@/features/home/blocks';

/**
 * Усі породи одразу, за абеткою, з полем «знайди свою породу».
 *
 * Раніше сторінка показувала 12 порід за кількістю принтів, решта ховалася
 * за «Показати всі (38)» (аудит 17.10.2026, IA-5). Порядок «за кількістю»
 * зручний магазину, а людина шукає свою собаку за назвою: «такса» стояла
 * лише після кнопки.
 *
 * Фільтр розуміє те саме, що й пошук по сайту (`searchText` зі спільного
 * пакета): синоніми («йорк», «стаф»), укр./рос. написання («шпиц»),
 * відмінки й апострофи. Без JavaScript поле просто не працює, а список
 * лишається повним — нічого не ховається.
 */
export function BreedIndex({ breeds }: { breeds: readonly BreedCardDto[] }) {
  const [query, setQuery] = useState('');
  const inputId = useId();

  const indexed = useMemo(() => [...breeds]
    .sort((a, b) => a.name.localeCompare(b.name, 'uk'))
    .map((b) => ({
      breed: b,
      words: searchText.haystackOf(b.name, b.synonyms ?? [], b.slug.split('-')),
    })), [breeds]);

  const terms = searchText.words(query);
  const shown = terms.length === 0
    ? indexed
    : indexed.filter(({ words }) => searchText.matchesAll(terms, words));

  // Групи за першою літерою — лише без фільтра: у відфільтрованих двох
  // породах заголовок «Т» нічого не додає.
  const groups = new Map<string, BreedCardDto[]>();
  for (const { breed } of shown) {
    const letter = terms.length === 0 ? breed.name.charAt(0).toUpperCase() : '';
    const list = groups.get(letter);
    if (list) list.push(breed);
    else groups.set(letter, [breed]);
  }

  return (
    <div>
      <div className="max-w-md">
        <label htmlFor={inputId} className="label-eyebrow">Знайди свою породу</label>
        <input
          id={inputId}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Наприклад, такса або йорк"
          autoComplete="off"
          className="mt-1 h-12 w-full rounded-card border border-line bg-surface px-4 text-base text-ink placeholder:text-ink-subtle focus:border-ink focus:outline-none focus:ring-2 focus:ring-ink"
        />
        <p className="mt-2 text-sm text-ink-muted" aria-live="polite">
          {terms.length === 0
            ? `${breeds.length} ${plural(breeds.length, 'порода', 'породи', 'порід')} за абеткою`
            : shown.length === 0
              ? 'Такої породи ще немає — намалюємо з фото.'
              : `Знайдено: ${shown.length}`}
        </p>
      </div>

      {shown.length === 0 ? (
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/svoya-ideya" className="inline-flex min-h-11 items-center rounded-pill bg-ink px-5 text-sm font-medium text-surface">
            Замовити свій принт
          </Link>
          <Link href="/prints" className="inline-flex min-h-11 items-center rounded-pill border border-line px-5 text-sm font-medium text-ink">
            Усі принти
          </Link>
        </div>
      ) : (
        <div className="mt-6 space-y-5">
          {[...groups.entries()].map(([letter, list]) => (
            <section key={letter || 'found'} aria-label={letter || undefined} className="flex gap-3">
              {letter !== '' && (
                <span aria-hidden className="w-6 shrink-0 pt-2.5 font-display text-lg font-bold text-ink-subtle">
                  {letter}
                </span>
              )}
              <ul className="grid min-w-0 flex-1 grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                {list.map((breed) => (
                  <li key={breed.id}>
                    <Link
                      href={`/breeds/${breed.slug}`}
                      className="flex min-h-11 flex-col justify-center rounded-card border border-line bg-surface px-3 py-2 transition-colors hover:border-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-ink"
                    >
                      <span className="text-sm font-semibold leading-tight text-ink">{breed.name}</span>
                      <span className="mt-0.5 text-xs text-ink-muted">
                        {breed.printCount > 0
                          ? `${breed.printCount} ${plural(breed.printCount, 'принт', 'принти', 'принтів')}`
                          : 'на замовлення'}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
