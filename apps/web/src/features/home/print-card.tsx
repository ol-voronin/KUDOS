import Link from 'next/link';
import { formatUAH, minor, type PrintCardDto } from '@dt/contracts';
import { PrintThumb } from '@/components/print-thumb';
import { PrintListTracker } from '@/features/analytics/PrintListTracker';
import type { ListName } from '@/features/analytics/lists';

/**
 * Плитка принта. Одна на всі сітки — головна, породна, колекція.
 *
 * Рамки навколо картки більше немає. Це не смак: рамка малює прямокутник
 * навколо фотографії, на якій і так є прямокутник — сам принт. Два
 * вкладені прямокутники читаються як шум, і саме тому обидва референси
 * кладуть товар на голе тло й розділяють колонки волосінню.
 *
 * Ціна на плитці є (мобільний аудит, 01.10.2026): без неї людина не
 * розуміє бюджету до кліку. З «від» (аудит 17.10, C-2): на фото часто
 * світшот чи худі, а число — найдешевший виріб, і «1 190 ₴» під худі за
 * 2 300 ₴ читалося як обіцянка, якої сторінка товару не тримає. Число —
 * `fromPriceMinor` із каталогу: найдешевший виріб, на якому принт можна
 * надрукувати, плюс друк за його розміром — і сторінка принта відкривається
 * саме з цим виробом, тож людина бачить ту саму суму. Друк різний за
 * розміром принта, тож числа на плитках справді різні. `null` — ціни немає
 * (принт ніде не продається), і тоді рядок не показуємо, а не пишемо нуль.
 */
/**
 * Ширина фото в плитці в CSS-пікселях на кожному брейкпоінті сітки
 * (2 колонки до 640, 3 до 1024, далі 4; відступи сторінки й картки вже
 * відняті; на 1280+ контейнер перестає рости). За цим браузер вибирає з
 * `srcset` найменшу копію, якої вистачає: ≈384 px на телефоні при DPR 2.
 * Змінюєш сітку (`PrintGrid`) чи відступи — онови й це.
 */
const CARD_IMAGE_SIZES =
  '(min-width: 1280px) 284px, (min-width: 1024px) calc(25vw - 36px), (min-width: 640px) calc(33vw - 40px), calc(50vw - 40px)';

/** Скільком першим плиткам сітки на першому екрані не потрібен lazy. */
const EAGER_CARDS = 8;

export function PrintCard(
  { print, eager = false, priority = false }:
  { print: PrintCardDto; eager?: boolean; priority?: boolean },
) {
  /*
   * Плитки першого екрана (`eager`/`priority`) без `reveal`: перша з них —
   * LCP сторінки, і прозорість до гідратації тримала її невидимою вже
   * завантаженою на 1–2 с (аудит 17.10, тех. п. 1). Нижчі плитки й далі
   * зʼявляються при прокрутці.
   */
  const reveal = eager || priority ? '' : 'reveal ';
  return (
    <Link
      href={`/prints/${print.slug}`}
      className={`group ${reveal}flex flex-col px-3 pb-5 pt-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-ink`}
    >
      {/*
        Фото ледь наближається під курсором. Рух живе на обгортці з
        `overflow-hidden`, а не на самій картці: інакше зростала б уся
        плитка й сусідні колонки смикалися б разом із нею.
      */}
      <div className="relative overflow-hidden bg-surface-sunken">
        <div className="transition-transform duration-500 ease-out group-hover:scale-[1.04] motion-reduce:transform-none motion-reduce:transition-none">
          <PrintThumb
            src={print.previewUrl}
            alt={print.title}
            ratio="portrait"
            sizes={CARD_IMAGE_SIZES}
            eager={eager}
            priority={priority}
          />
        </div>
      </div>

      {/*
        Без товстої лінії над назвою: у сітці й так є межі рядів і колонок,
        третя система ліній робила плитку строкатою (аудит 17.10, U7). Назва
        й ціна розрізняються вагою: ціна жирна, назва звичайна.
      */}
      <div className="mt-3">
        <p className="text-sm text-ink transition-opacity duration-200 group-hover:opacity-60">
          {print.title}
        </p>
        <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
          {print.fromPriceMinor !== null && (
            <p className="whitespace-nowrap text-[0.95rem] font-semibold text-ink">{print.priceIsExact ? '' : 'від '}{formatUAH(minor(print.fromPriceMinor))}</p>
          )}
          {/*
            Наявність — короткий підпис, а не зелена плашка. Плашка кричала на
            кожній картці однаково голосно, тобто не означала нічого. Але й одна
            літера «є» біля крапки не читалася — потрібне слово, яке щось каже:
            «є» відповідає на питання «коли», а не «скільки».
          */}
          {print.inStock && (
            <span className="flex shrink-0 items-center gap-1.5 whitespace-nowrap text-xs font-medium text-ok">
              <span aria-hidden className="h-1.5 w-1.5 rounded-pill bg-ok" />
              в наявності
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

/**
 * Сітка товарів.
 *
 * Волосінь між колонками замальовується не проміжком, а рамкою самих
 * комірок: у сітці з незаповненим останнім рядком фон-роздільник
 * перетворився б на сірі плями там, де товарів забракло.
 */
export function PrintGrid(
  { prints, list, listId, aboveFold = false }:
  {
    prints: readonly PrintCardDto[]; list?: ListName; listId?: string;
    /**
     * Сітка — головний вміст сторінки і починається на першому екрані
     * (каталог, колекція, порода, пошук). Тоді перші `EAGER_CARDS` плиток
     * вантажаться без lazy, а перша ще й із preload: вона найімовірніший LCP.
     * Решта сіток (головна, «схожі» на сторінці принта) лежать нижче за
     * першу прокрутку, і для них ледачими лишаються всі плитки.
     */
    aboveFold?: boolean;
  },
) {
  const grid = (
    <div
      className={[
        'grid grid-cols-2 border-t border-line sm:grid-cols-3 lg:grid-cols-4',
        '[&>*]:border-b [&>*]:border-r [&>*]:border-line',
        '[&>*:nth-child(2n)]:border-r-0',
        'sm:[&>*:nth-child(2n)]:border-r sm:[&>*:nth-child(3n)]:border-r-0',
        'lg:[&>*:nth-child(3n)]:border-r lg:[&>*:nth-child(4n)]:border-r-0',
      ].join(' ')}
    >
      {prints.map((print, i) => (
        <PrintCard
          key={print.id}
          print={print}
          eager={aboveFold && i < EAGER_CARDS}
          priority={aboveFold && i === 0}
        />
      ))}
    </div>
  );

  // Без `list` сітка лишається чистим сервером: обгортка й слухач додаються
  // тільки там, де вітрину справді треба відрізнити від інших у звіті.
  if (list === undefined) return grid;
  return (
    <PrintListTracker
      list={list}
      listId={listId}
      prints={prints.map((p) => ({ slug: p.slug, title: p.title, fromPriceMinor: p.fromPriceMinor }))}
    >
      {grid}
    </PrintListTracker>
  );
}

/**
 * Заголовок секції.
 *
 * Два тони одного заголовка — головний прийом напрямку: перше слово
 * чорнилом, продовження блідим. Читається як одне ціле, але великий кегль
 * не перетворює сторінку на суцільний крик.
 */
export function SectionHead({
  title, ghost, eyebrow, subtitle, href, hrefLabel, onDark = false,
}: {
  title: string; ghost?: string; eyebrow?: string; subtitle?: string;
  href?: string; hrefLabel?: string; onDark?: boolean;
}) {
  const head = onDark ? 'text-surface' : 'text-ink';
  const body = onDark ? 'text-surface/75' : 'text-ink-muted';
  const rule = onDark ? 'border-surface/45' : 'border-ink';
  return (
    <div className="reveal mb-6">
      {eyebrow !== undefined && <p className={`label-eyebrow mb-1 ${onDark ? 'text-surface/60' : ''}`}>{eyebrow}</p>}
      <h2 className={`text-section font-display font-bold uppercase ${head}`}>
        {title}
        {/* Привида на чорному немає: блідий тон там зчитується як брак контрасту. */}
        {ghost !== undefined && <> <span className={onDark ? '' : 'ghost-word'}>{ghost}</span></>}
      </h2>
      <div className={`mt-3 flex flex-wrap items-baseline justify-between gap-3 border-t pt-2 ${rule}`}>
        {subtitle !== undefined
          ? <p className={`max-w-prose text-sm ${body}`}>{subtitle}</p>
          : <span />}
        {/*
          «Дивитись усі» — дія, а не підпис: 14 px жирним із підкресленням,
          синім бренду (на чорному — білим). Раніше 11 px капсом читалось як
          мітка під лінією (аудит 17.10, U9).
        */}
        {href !== undefined && (
          <Link
            href={href}
            className={onDark
              ? 'shrink-0 text-sm font-semibold text-surface underline decoration-2 underline-offset-4 hover:opacity-70'
              : 'link-brand shrink-0 text-sm'}
          >
            {hrefLabel ?? 'Дивитись усі'} →
          </Link>
        )}
      </div>
    </div>
  );
}
