import { Fragment } from 'react';
import type {
  CardsBlock, CtaBlock, FaqBlock, FeaturesBlock, GalleryBlock, HeroBlock,
  ImageTextBlock, LegalBlock, QuoteBlock, StepsBlock, TextBlock,
} from '@dt/contracts';
import type { BlockIcon } from '@dt/contracts';
import { Inline, InlineParagraph } from '../inline';
import { BlockHeading, BlockLinks, palette } from './shared';

/** Спільний проп усіх блоків: чи стоїть блок на чорній секції. */
interface Dark { readonly onDark?: boolean }

/**
 * Статичні блоки: усе, що малюється з власних полів і нікуди не ходить.
 *
 * Кожен компонент отримує рівно свій тип із union — тобто якщо в схемі
 * зʼявиться нове поле, а тут його не використати, TypeScript промовчить,
 * але якщо поле зникне зі схеми, компонент не збереться. Це той бік захисту,
 * який реально ловить помилки при зміні блока.
 */

/**
 * Заголовок героя, у якому частину виділяють так: `**отак**`.
 *
 * Виділене малюється блідим тоном — це «слово-привид», головний прийом
 * напрямку. Але тільки якщо виділене справді коротке.
 *
 * Правило народилося з помилки: на головній стоїть «Ваш пес — **на вашій
 * футболці**», і бліда половина заголовка розповзлася на два рядки
 * величезним кеглем. Прийом працює, коли привид дочитує слово; на цілій
 * фразі він читається як недовантажений текст. Тому довше за два слова
 * повертається до акценту — виділення лишається, крику не виникає.
 */
const GHOST_MAX_WORDS = 2;

function HeroHeading({ text, onDark = false }: { text: string; onDark?: boolean }) {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  return (
    <>
      {parts.map((part, i) => {
        if (i % 2 === 0) return <Fragment key={i}>{part}</Fragment>;
        // Довше за два слова — просто чорнило: виділення зникає, заголовок
        // лишається цілим. Пофарбувати половину заголовка в акцент означало б
        // замінити одну надто гучну помилку на іншу.
        const short = part.trim().split(/\s+/).length <= GHOST_MAX_WORDS;
        if (!short) return <Fragment key={i}>{part}</Fragment>;
        // На фотографії привида немає зовсім. Напівпрозорий білий на
        // строкатому знімку не читається як прийом — читається як погано
        // видно. Прийом лишається там, де під ним рівне тло.
        return onDark
          ? <Fragment key={i}>{part}</Fragment>
          : <span key={i} className="ghost-word">{part}</span>;
      })}
    </>
  );
}

export function Hero({ block, onDark = false }: { block: HeroBlock } & Dark) {
  return block.image.url === '' ? <HeroPlain block={block} onDark={onDark} /> : <HeroFull block={block} />;
}

/** Набірний варіант: сторінка статті, документа, розділу. */
function HeroPlain({ block, onDark = false }: { block: HeroBlock } & Dark) {
  const c = palette(onDark);
  return (
    <>
      {block.eyebrow.trim() !== '' && (
        <p className={`label-eyebrow mb-3 ${onDark ? 'text-surface/60' : ''}`}>{block.eyebrow}</p>
      )}
      <h1 className={`max-w-4xl font-display text-hero font-extrabold uppercase ${c.head}`}>
        <HeroHeading text={block.heading} onDark={onDark} />
      </h1>
      <InlineParagraph text={block.lead} className={`mt-4 max-w-prose text-lg leading-relaxed ${c.body}`} />
      {block.footnote.trim() !== '' && (
        <p className={`mt-4 text-sm ${c.faint}`}>{block.footnote}</p>
      )}
      <BlockLinks links={block.links} className="mt-8" onDark={onDark} />
    </>
  );
}

/**
 * Фотографія на весь екран, текст поверх неї.
 *
 * Висота — `100svh` мінус шапка. Саме `svh`, а не `vh`: на телефоні `vh`
 * рахується від висоти екрана без панелі браузера, тож кнопка під
 * заголовком опиняється рівно під нижньою панеллю й здається обрізаною.
 *
 * Затемнення — градієнт, а не рівна плівка: угорі воно тримає білий текст,
 * унизу — відпускає фотографію. Рівна плівка гасить знімок цілком, і тоді
 * незрозуміло, навіщо він тут.
 */
function HeroFull({ block }: { block: HeroBlock }) {
  return (
    <section className="relative -mt-px flex min-h-[calc(100svh-4.4rem)] items-center justify-center overflow-hidden">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={block.image.url}
        alt={block.image.alt}
        className="absolute inset-0 h-full w-full object-cover object-[50%_28%]"
      />
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-b from-ink/55 via-ink/25 to-ink/45"
      />
      <div className="relative z-10 flex max-w-4xl flex-col items-center px-4 py-20 text-center sm:px-6">
        {block.eyebrow.trim() !== '' && (
          <p className="reveal label-eyebrow mb-4 text-white/70">{block.eyebrow}</p>
        )}
        {/*
          На фотографії заголовок навмисно на щабель менший за той, що на
          світлому: там він єдиний елемент і може бути скільки завгодно
          великим, а тут конкурує зі знімком і мусить лишити його видимим.
          `balance` тримає рядки приблизно рівними — довга українська фраза
          інакше ламається як «чотири слова / одне».
        */}
        <h1 className="reveal reveal-1 max-w-3xl text-balance font-display text-[clamp(1.9rem,4.4vw,3.6rem)] font-extrabold uppercase leading-[1.05] tracking-tight text-white drop-shadow-sm">
          <HeroHeading text={block.heading} onDark />
        </h1>
        <InlineParagraph
          text={block.lead}
          className="reveal reveal-2 mt-5 max-w-xl text-base leading-relaxed text-white/85 sm:text-lg"
        />
        {block.footnote.trim() !== '' && (
          <p className="reveal reveal-2 mt-3 text-sm text-white/60">{block.footnote}</p>
        )}
        <div className="reveal reveal-3">
          <BlockLinks links={block.links} className="mt-9 justify-center" onDark />
        </div>
      </div>

      {/* Підказка, що сторінка продовжується. Зникає, щойно людина гортає. */}
      <span aria-hidden className="scroll-hint absolute bottom-8 left-1/2 z-10 -translate-x-1/2 text-white/70">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <path d="M12 5v14M6 13l6 6 6-6" />
        </svg>
      </span>
    </section>
  );
}

export function Text({ block, onDark = false }: { block: TextBlock } & Dark) {
  const c = palette(onDark);
  return (
    <div className="max-w-prose">
      <BlockHeading text={block.heading} onDark={onDark} />
      <div className={`space-y-3 leading-relaxed ${c.body}`}>
        {block.paragraphs.map((p, i) => <InlineParagraph key={i} text={p} />)}
      </div>
      {block.bullets.length > 0 && (
        <ul className={`mt-4 list-disc space-y-2 pl-5 leading-relaxed ${c.body}`}>
          {block.bullets.map((b, i) => <li key={i}><Inline text={b} /></li>)}
        </ul>
      )}
    </div>
  );
}

/**
 * Розділ юридичного документа.
 *
 * `id="p7"` — не декор. На пункт посилаються в переписці з покупцем і в
 * самому документі («див. розділ 7»), тому якір мусить лишатися стабільним
 * навіть коли розділ переїде вище чи нижче.
 */
export function Legal({ block, onDark = false }: { block: LegalBlock } & Dark) {
  const id = `p${block.number}`;
  const c = palette(onDark);
  return (
    <section id={id} className="max-w-3xl scroll-mt-24">
      <h2 className={`font-display text-xl font-bold ${c.head}`}>
        <a href={`#${id}`} className="hover:opacity-70">{block.number}. {block.heading}</a>
      </h2>
      <div className={`mt-3 space-y-3 leading-relaxed ${c.body}`}>
        {block.items.map((item, i) => (
          <p key={i}>
            {item.n.trim() !== '' && <span className={`font-medium ${c.head}`}>{item.n} </span>}
            <Inline text={item.text} />
          </p>
        ))}
      </div>
    </section>
  );
}

export function Steps({ block, onDark = false }: { block: StepsBlock } & Dark) {
  const c = palette(onDark);
  return (
    <>
      <BlockHeading text={block.heading} lead={block.lead} onDark={onDark} />
      <ol className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {block.items.map((item, i) => (
          <li key={i} className={`border-t pt-4 ${c.ruleStrong}`}>
            <span
              aria-hidden="true"
              className={`flex h-7 w-7 items-center justify-center rounded-pill border font-display text-xs font-bold ${c.ruleStrong} ${c.head}`}
            >
              {i + 1}
            </span>
            <h3 className={`mt-3 font-semibold ${c.head}`}>{item.title}</h3>
            <InlineParagraph text={item.text} className={`mt-1.5 text-sm leading-relaxed ${c.body}`} />
          </li>
        ))}
      </ol>
    </>
  );
}

/**
 * Іконки намальовані тут, а не приходять із бази.
 *
 * Поле в блоці — це ключ зі списку, не SVG і не адреса файлу. Інакше в
 * контент потрапляє довільна розмітка або чужий домен, і одне з двох
 * рано чи пізно стріляє.
 *
 * Малюнок один на всі блоки: іконка на картці й іконка в перевагах мають
 * означати те саме й важити однаково. Стиль навмисно однаковий — тонка
 * лінія, без заливки: заливка на 22 px перетворюється на пляму.
 */
const ICONS: Record<Exclude<BlockIcon, 'none'>, string> = {
  scissors: 'M6 3v12M18 3v12M6 15a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM18 15a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM6 3l12 12M18 3 6 15',
  printer: 'M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2M6 14h12v7H6z',
  truck: 'M1 3h13v13H1zM14 8h4l3 3v5h-7zM5.5 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM17.5 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z',
  shield: 'M12 2 4 5v7c0 4.5 3.4 8.7 8 10 4.6-1.3 8-5.5 8-10V5z',
  heart: 'M20.8 5.6a5 5 0 0 0-7.1 0L12 7.3l-1.7-1.7a5 5 0 1 0-7.1 7.1L12 21.4l8.8-8.7a5 5 0 0 0 0-7.1Z',
  clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20ZM12 6v6l4 2',
  /** Коробка: готовий виріб, який лишилося відправити. */
  box: 'M3 7.5 12 3l9 4.5v9L12 21l-9-4.5zM3 7.5 12 12l9-4.5M12 12v9',
  /** Олівець: той самий принт, але з правками. */
  pencil: 'M4 20h4L20.5 7.5a2.1 2.1 0 0 0-3-3L5 17v3zM14.5 6.5l3 3',
  /** Палітра: малюнок із нуля. */
  palette: 'M12 21a9 9 0 1 1 9-9c0 2-1.6 2.6-3 2.6h-1.6c-1.2 0-2.1 1-2.1 2.1 0 .5.2 1 .5 1.4.3.4.2 1-.3 1.3-.7.4-1.6.6-2.5.6ZM7.5 10.5h.01M11 7h.01M15.5 8.5h.01',
  /** Лапа: усе, що про саму собаку. */
  paw: 'M6.5 12.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM17.5 12.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM10 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM14 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM12 13c-2.5 0-4.5 2-4.5 4a2.5 2.5 0 0 0 3.6 2.2c.6-.3 1.2-.3 1.8 0A2.5 2.5 0 0 0 16.5 17c0-2-2-4-4.5-4Z',
  /** Іскра: те, чого не було, поки ми не намалювали. */
  sparkle: 'M12 3v5M12 16v5M3 12h5M16 12h5M6.3 6.3l3.2 3.2M14.5 14.5l3.2 3.2M17.7 6.3l-3.2 3.2M9.5 14.5l-3.2 3.2',
  /** Хмарка: розмова з людиною. */
  chat: 'M21 12a8 8 0 0 1-8 8H4l2.2-2.9A8 8 0 1 1 21 12Z',
};

/**
 * Одна іконка. `none` не малює нічого — і не лишає місця.
 *
 * Розмір задає той, хто малює, і власного розміру тут НЕМАЄ навмисно.
 * Спершу було `h-[22px] w-[22px]` за замовчуванням плюс `h-7 w-7` від
 * картки — і в розмітку йшли обидва класи одночасно. Який із них виграє,
 * вирішує порядок правил у зібраному CSS, а не порядок слів у рядку; ми на
 * цьому вже обпеклися на полях вводу. Один клас — одне джерело правди.
 */
function Glyph({ icon, className = 'h-[22px] w-[22px]' }: { icon: BlockIcon; className?: string }) {
  if (icon === 'none') return null;
  return (
    <svg
      viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true" className={`shrink-0 ${className}`}
    >
      <path d={ICONS[icon]} />
    </svg>
  );
}

const COLUMNS: Record<2 | 3 | 4, string> = {
  2: 'sm:grid-cols-2',
  3: 'sm:grid-cols-2 lg:grid-cols-3',
  4: 'sm:grid-cols-2 lg:grid-cols-4',
};

/**
 * Картки: кілька рівноправних варіантів.
 *
 * Що тут змінилося й чому:
 *
 *   · **Іконка замість номера.** Спокуса пронумерувати «01 / 02 / 03» велика,
 *     але номер означає послідовність — «спершу це, потім те». А тут три
 *     СПОСОБИ, з яких обирають один. Нумерація читалася б як інструкція й
 *     підказувала б, що перший спосіб «правильніший».
 *   · **Повітря.** Було `gap-4` і `pt-3` — три щільні колонки тексту, які
 *     зливалися в абзац із трьома жирними словами. Стало `gap-x-8 gap-y-10`
 *     і `pt-5`: між колонками зʼявився проміжок, у якому око встигає
 *     зупинитися, а волосінь зверху почала розділяти, а не просто бути.
 */
export function Cards({ block, onDark = false }: { block: CardsBlock } & Dark) {
  const c = palette(onDark);
  const withIcons = block.items.some((i) => i.icon !== 'none');
  return (
    <>
      <BlockHeading text={block.heading} lead={block.lead} onDark={onDark} />
      <div className={`grid gap-x-8 gap-y-10 ${COLUMNS[block.columns]}`}>
        {block.items.map((item, i) => (
          <div key={i} className={`border-t pt-5 ${c.rule}`}>
            {/*
              Місце під іконку тримається на всіх картках, щойно вона є хоч
              на одній: інакше картка без іконки піднімає заголовок вище за
              сусідів, і ряд перестає бути рядом.
            */}
            {withIcons && (
              /*
                Іконка без медальйона. Спершу тут була кругла підкладка —
                спочатку заливкою, потім обведенням, — і обидва варіанти на
                кремовій секції виявилися невидимими: різниця між `#f6f6f3` і
                `#e4e4df` на колі в 44 px не читається. Лишилася сама іконка:
                волосінь зверху вже розділяє картки, другий контур їй нічого
                не додавав.
              */
              <div className={`mb-4 ${c.head}`}>
                <Glyph icon={item.icon} className="h-7 w-7" />
              </div>
            )}
            <h3 className={`font-display text-base font-bold uppercase leading-tight ${c.head}`}>{item.title}</h3>
            <InlineParagraph text={item.text} className={`mt-2 text-sm leading-relaxed ${c.body}`} />
          </div>
        ))}
      </div>
    </>
  );
}


export function Features({ block, onDark = false }: { block: FeaturesBlock } & Dark) {
  const c = palette(onDark);
  return (
    <>
      <BlockHeading text={block.heading} onDark={onDark} />
      <div className="grid gap-x-8 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
        {block.items.map((item, i) => (
          <div key={i} className="flex gap-4">
            <Glyph icon={item.icon} className={`mt-0.5 h-[22px] w-[22px] ${c.head}`} />
            <div>
              <h3 className={`font-semibold ${c.head}`}>{item.title}</h3>
              <InlineParagraph text={item.text} className={`mt-1 text-sm leading-relaxed ${c.body}`} />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

export function Faq({ block, onDark = false }: { block: FaqBlock } & Dark) {
  const c = palette(onDark);
  return (
    <>
      <BlockHeading text={block.heading} onDark={onDark} />
      <div className={`max-w-3xl divide-y ${onDark ? 'divide-surface/20' : 'divide-line'}`}>
        {block.items.map((item, i) => (
          <details key={i} className="group py-4">
            <summary className={`cursor-pointer font-semibold ${c.head}`}>
              {item.q}
            </summary>
            <InlineParagraph text={item.a} className={`mt-2 leading-relaxed ${c.body}`} />
          </details>
        ))}
      </div>
    </>
  );
}

export function Cta({ block, onDark = false }: { block: CtaBlock } & Dark) {
  const c = palette(onDark);
  return (
    <div className="max-w-prose">
      <h2 className={`text-section font-display font-bold uppercase ${c.head}`}>{block.heading}</h2>
      <InlineParagraph text={block.text} className={`mt-3 leading-relaxed ${c.body}`} />
      <BlockLinks links={block.links} className="mt-6" onDark={onDark} />
    </div>
  );
}

export function ImageText({ block, onDark = false }: { block: ImageTextBlock } & Dark) {
  const c = palette(onDark);
  const media = (
    <figure className="m-0">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={block.image.url}
        alt={block.image.alt}
        className="w-full object-cover"
      />
      {block.image.caption.trim() !== '' && (
        <figcaption className={`mt-2 text-sm ${c.faint}`}>{block.image.caption}</figcaption>
      )}
    </figure>
  );
  const body = (
    <div>
      {block.heading.trim() !== '' && (
        <h2 className={`text-section font-display font-bold uppercase ${c.head}`}>{block.heading}</h2>
      )}
      <InlineParagraph text={block.text} className={`mt-3 leading-relaxed ${c.body}`} />
      <BlockLinks links={block.links} className="mt-6" onDark={onDark} />
    </div>
  );

  return (
    <div className="grid items-center gap-8 md:grid-cols-2">
      {block.side === 'left' ? <>{media}{body}</> : <>{body}{media}</>}
    </div>
  );
}

export function Gallery({ block, onDark = false }: { block: GalleryBlock } & Dark) {
  const c = palette(onDark);
  return (
    <>
      <BlockHeading text={block.heading} onDark={onDark} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {block.items.map((img, i) => (
          <figure key={i} className="m-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={img.url}
              alt={img.alt}
              className="aspect-square w-full bg-surface-sunken object-cover"
            />
            {img.caption.trim() !== '' && (
              <figcaption className={`mt-2 text-sm ${c.faint}`}>{img.caption}</figcaption>
            )}
          </figure>
        ))}
      </div>
    </>
  );
}

export function Quote({ block, onDark = false }: { block: QuoteBlock } & Dark) {
  const c = palette(onDark);
  return (
    <figure className="m-0 max-w-3xl">
      <blockquote className={`font-display text-2xl font-bold leading-tight sm:text-3xl ${c.head}`}>
        <Inline text={block.text} />
      </blockquote>
      {(block.author.trim() !== '' || block.role.trim() !== '') && (
        <figcaption className={`mt-3 text-sm ${c.body}`}>
          {block.author}
          {block.role.trim() !== '' && <span className={c.faint}> · {block.role}</span>}
        </figcaption>
      )}
    </figure>
  );
}
