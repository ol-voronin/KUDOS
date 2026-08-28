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
 * Плитка породи: медальйон + назва.
 *
 * Замовник просив «фото породи якось на фон». Спробувати варто було, і саме
 * тому цього тут немає — ось що з цим не так:
 *
 *   1. Фотографію породи довелося б взяти стоковою. Це чужа собака, знята
 *      кимось іншим у чужому стилі, і поруч із власними малюнками вона
 *      читається як реклама з іншого сайту. Плюс ліцензія на кожну.
 *   2. Текст поверх фотографії вимагає затемнення. Двадцять плиток із
 *      затемненням — це двадцять сірих прямокутників, тобто рівно та сама
 *      відсутність розрізнення, з якої ми почали, лише темніша.
 *
 * Тому на плитці стоїть превʼю ОДНОГО з принтів цієї породи. Це наш малюнок,
 * він у нас уже є, він оновлюється сам — і, головне, він показує те, що
 * людина насправді купить. Медальйон збоку, а не тло: малюнки на світлому
 * тлі, і білий напис поверх них не читався б.
 *
 * Порода без принтів лишається з лапою замість превʼю. Це не «порожньо», а
 * «намалюємо з фото» — і саме так підписано.
 */
const TILE =
  'group reveal flex items-center gap-3.5 rounded-card bg-surface-sunken p-3 ' +
  'transition-[background-color,transform] duration-200 hover:-translate-y-0.5 hover:bg-ghost ' +
  'motion-reduce:transform-none focus:outline-none focus-visible:ring-2 focus-visible:ring-ink';

/** Медальйон: превʼю принта або лапа, якщо принтів ще немає. */
function BreedMedallion({ src }: { src: string }) {
  if (src === '') {
    return (
      <span
        aria-hidden
        className="flex h-14 w-14 shrink-0 items-center justify-center rounded-card border border-dashed border-line-strong bg-surface text-ink-subtle"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6.5 12.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM17.5 12.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM10 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM14 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM12 13c-2.5 0-4.5 2-4.5 4a2.5 2.5 0 0 0 3.6 2.2c.6-.3 1.2-.3 1.8 0A2.5 2.5 0 0 0 16.5 17c0-2-2-4-4.5-4Z" />
        </svg>
      </span>
    );
  }
  return (
    <span className="h-14 w-14 shrink-0 overflow-hidden rounded-card bg-surface">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        loading="lazy"
        className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105 motion-reduce:transform-none"
      />
    </span>
  );
}

export function BreedStrip({
  breeds, limit = 11, cta = true,
}: { breeds: readonly BreedCardDto[]; limit?: number; cta?: boolean }) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {breeds.slice(0, limit).map((breed) => (
        <Link key={breed.id} href={`/breeds/${breed.slug}`} className={TILE}>
          <BreedMedallion src={breed.previewUrl} />
          <span className="min-w-0">
            <span className="block truncate font-display text-base font-semibold uppercase leading-tight text-ink">
              {breed.name}
            </span>
            {/*
              Нуль принтів — не «порожньо», а «малюємо на замовлення». Це правда
              й це пропозиція; «0 принтів» було б і правдою, і антирекламою.
            */}
            <span className="mt-0.5 block text-sm text-ink-muted">
              {breed.printCount > 0
                ? `${breed.printCount} ${plural(breed.printCount, 'принт', 'принти', 'принтів')}`
                : 'малюємо на замовлення'}
            </span>
          </span>
        </Link>
      ))}
      {/*
        Остання плитка — темна й на всю ширину рядка.

        Вона єдина веде не в каталог, а в бриф, і замовник просив зробити її
        помітнішою. Ширина тут працює краще за колір: серед однакових плиток
        помітна та, що іншого РОЗМІРУ, а не та, що іншого відтінку — темних
        плиток на сторінці й так вистачає.
      */}
      {cta && (
      <Link
        href="/svoya-ideya"
        className="reveal flex min-h-[5rem] items-center gap-3.5 rounded-card bg-ink p-4 transition-[background-color,transform] duration-200 hover:-translate-y-0.5 hover:bg-ink/85 motion-reduce:transform-none focus:outline-none focus-visible:ring-2 focus-visible:ring-ink sm:col-span-2 lg:col-span-3"
      >
        <span aria-hidden className="flex h-14 w-14 shrink-0 items-center justify-center rounded-card border border-surface/30 text-surface">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 20h4L20.5 7.5a2.1 2.1 0 0 0-3-3L5 17v3zM14.5 6.5l3 3" />
          </svg>
        </span>
        <span className="min-w-0">
          <span className="block font-display text-base font-semibold uppercase leading-tight text-surface">
            Не знайшов те саме?
          </span>
          <span className="mt-0.5 block text-sm text-surface/70">
            Замов адаптацію готового принту або власну ідею →
          </span>
        </span>
      </Link>
      )}
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
          className="group reveal flex flex-col rounded-card bg-surface-sunken p-3 transition-[background-color,transform] duration-200 hover:-translate-y-0.5 hover:bg-ghost motion-reduce:transform-none focus:outline-none focus-visible:ring-2 focus-visible:ring-ink"
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
