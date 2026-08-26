import Link from 'next/link';
import type { BreedCardDto, CollectionCardDto } from '@dt/contracts';
import { PrintThumb } from '@/components/print-thumb';

/**
 * Смуга порід. Стоїть одразу під героєм, до каталогу й до всього іншого.
 *
 * Причина: «а мою породу вмієте?» — питання №1, з яким приходять. Ставити
 * його нижче сітки товарів означає змусити людину шукати відповідь на те,
 * з чим вона й прийшла. Остання плитка навмисно веде в бриф — саме там
 * закінчують ті, чиєї породи немає.
 */
export function BreedStrip({ breeds }: { breeds: readonly BreedCardDto[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {breeds.slice(0, 11).map((breed) => (
        <Link
          key={breed.id}
          href={`/breeds/${breed.slug}`}
          className="flex min-h-16 flex-col justify-center rounded-card border border-line bg-surface-raised px-4 py-3 transition hover:border-ink focus:outline-none focus:ring-2 focus:ring-accent"
        >
          <span className="font-medium text-ink">{breed.name}</span>
          {/*
            Нуль принтів — не «порожньо», а «малюємо на замовлення». Це правда
            й це пропозиція; «0 принтів» було б і правдою, і антирекламою.
          */}
          <span className="text-sm text-ink-subtle">
            {breed.printCount > 0
              ? `${breed.printCount} ${plural(breed.printCount, 'принт', 'принти', 'принтів')}`
              : 'малюємо на замовлення'}
          </span>
        </Link>
      ))}
      <Link
        href="/svoya-ideya"
        className="flex min-h-16 flex-col justify-center rounded-card border border-dashed border-accent bg-accent-soft px-4 py-3 transition hover:border-accent-strong focus:outline-none focus:ring-2 focus:ring-accent"
      >
        <span className="font-medium text-accent-strong">Немає вашої?</span>
        <span className="text-sm text-accent-strong/80">Намалюємо з фото →</span>
      </Link>
    </div>
  );
}

export function CollectionStrip({ collections }: { collections: readonly CollectionCardDto[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {collections.map((collection) => (
        <Link
          key={collection.id}
          href={`/collections/${collection.slug}`}
          className="group flex flex-col rounded-card border border-plum/20 bg-surface p-4 transition hover:border-plum focus:outline-none focus:ring-2 focus:ring-plum"
        >
          <div className="flex gap-2">
            {(collection.previewUrls.length > 0 ? collection.previewUrls : [null, null, null])
              .slice(0, 3)
              .map((url, i) => (
                <div key={i} className="w-1/3">
                  <PrintThumb src={url} alt="" />
                </div>
              ))}
          </div>
          <p className="mt-3 font-display font-bold text-ink group-hover:underline">{collection.title}</p>
          {collection.description && (
            <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-ink-muted">{collection.description}</p>
          )}
          <p className="mt-auto pt-2 text-sm text-ink-subtle">
            {collection.printCount} {plural(collection.printCount, 'принт', 'принти', 'принтів')}
          </p>
        </Link>
      ))}
    </div>
  );
}

/** Українське відмінювання. 1 принт / 2 принти / 5 принтів. */
export function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}
