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
/*
 * Плитка, а не рядок у списку.
 *
 * Спроба зробити «легше» перетворила смугу порід на текст із волосінню
 * зверху — і вітрина стала схожа на таблицю даних. Волосінь працює там, де
 * поруч є фотографія: вона розділяє товар. Там, де фотографії немає, її
 * місце має тримати сама плитка, інакше на сторінці лишається порожнеча.
 *
 * Заливка світла, рамки немає — плитка помітна, але не сперечається з
 * сусідніми секціями.
 */
const TILE =
  'flex min-h-[4.5rem] flex-col justify-center rounded-card bg-surface-sunken px-4 py-3 ' +
  'transition hover:bg-ghost focus:outline-none focus-visible:ring-2 focus-visible:ring-ink';

export function BreedStrip({ breeds }: { breeds: readonly BreedCardDto[] }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
      {breeds.slice(0, 11).map((breed) => (
        <Link key={breed.id} href={`/breeds/${breed.slug}`} className={TILE}>
          <span className="font-display text-base font-semibold uppercase leading-tight text-ink">
            {breed.name}
          </span>
          {/*
            Нуль принтів — не «порожньо», а «малюємо на замовлення». Це правда
            й це пропозиція; «0 принтів» було б і правдою, і антирекламою.
          */}
          <span className="mt-0.5 text-sm text-ink-muted">
            {breed.printCount > 0
              ? `${breed.printCount} ${plural(breed.printCount, 'принт', 'принти', 'принтів')}`
              : 'малюємо на замовлення'}
          </span>
        </Link>
      ))}
      {/* Остання плитка — темна: вона єдина веде не в каталог, а в бриф. */}
      <Link
        href="/svoya-ideya"
        className="flex min-h-[4.5rem] flex-col justify-center rounded-card bg-ink px-4 py-3 transition hover:bg-ink/85 focus:outline-none focus-visible:ring-2 focus-visible:ring-ink"
      >
        <span className="font-display text-base font-semibold uppercase leading-tight text-surface">
          Немає вашої?
        </span>
        <span className="text-sm text-surface/70">Намалюємо з фото →</span>
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
          className="group flex flex-col rounded-card bg-surface-sunken p-3 transition hover:bg-ghost focus:outline-none focus-visible:ring-2 focus-visible:ring-ink"
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
          <p className="mt-3 font-display text-lg font-bold uppercase leading-tight text-ink group-hover:underline">
            {collection.title}
          </p>
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
