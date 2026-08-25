import type {
  CardsBlock, CtaBlock, FaqBlock, FeaturesBlock, GalleryBlock, HeroBlock,
  ImageTextBlock, LegalBlock, QuoteBlock, StepsBlock, TextBlock,
} from '@dt/contracts';
import { Inline, InlineParagraph } from '../inline';
import { BlockHeading, BlockLinks } from './shared';

/**
 * Статичні блоки: усе, що малюється з власних полів і нікуди не ходить.
 *
 * Кожен компонент отримує рівно свій тип із union — тобто якщо в схемі
 * зʼявиться нове поле, а тут його не використати, TypeScript промовчить,
 * але якщо поле зникне зі схеми, компонент не збереться. Це той бік захисту,
 * який реально ловить помилки при зміні блока.
 */

export function Hero({ block }: { block: HeroBlock }) {
  return (
    <>
      {block.eyebrow.trim() !== '' && (
        <p className="mb-3 inline-flex rounded-pill bg-accent-soft px-3 py-1 text-xs font-bold uppercase tracking-[0.11em] text-accent-ink">
          {block.eyebrow}
        </p>
      )}
      <h1 className="max-w-3xl font-display text-hero font-bold text-ink">{block.heading}</h1>
      <InlineParagraph text={block.lead} className="mt-4 max-w-prose text-lg leading-relaxed text-ink-muted" />
      {block.footnote.trim() !== '' && (
        <p className="mt-4 text-sm text-ink-subtle">{block.footnote}</p>
      )}
      <BlockLinks links={block.links} className="mt-8" />
    </>
  );
}

export function Text({ block }: { block: TextBlock }) {
  return (
    <div className="max-w-prose">
      <BlockHeading text={block.heading} />
      <div className="space-y-3 leading-relaxed text-ink-muted">
        {block.paragraphs.map((p, i) => <InlineParagraph key={i} text={p} />)}
      </div>
      {block.bullets.length > 0 && (
        <ul className="mt-4 list-disc space-y-2 pl-5 leading-relaxed text-ink-muted">
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
export function Legal({ block }: { block: LegalBlock }) {
  const id = `p${block.number}`;
  return (
    <section id={id} className="max-w-3xl scroll-mt-24">
      <h2 className="font-display text-xl font-bold text-ink">
        <a href={`#${id}`} className="hover:text-accent">{block.number}. {block.heading}</a>
      </h2>
      <div className="mt-3 space-y-3 leading-relaxed text-ink-muted">
        {block.items.map((item, i) => (
          <p key={i}>
            {item.n.trim() !== '' && <span className="font-medium text-ink">{item.n} </span>}
            <Inline text={item.text} />
          </p>
        ))}
      </div>
    </section>
  );
}

export function Steps({ block }: { block: StepsBlock }) {
  return (
    <>
      <BlockHeading text={block.heading} lead={block.lead} />
      <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {block.items.map((item, i) => (
          <li key={i} className="rounded-card border border-line bg-surface p-5">
            <span
              aria-hidden="true"
              className="flex h-8 w-8 items-center justify-center rounded-pill bg-teal text-sm font-bold text-white"
            >
              {i + 1}
            </span>
            <h3 className="mt-3 font-display font-bold text-ink">{item.title}</h3>
            <InlineParagraph text={item.text} className="mt-1.5 text-sm leading-relaxed text-ink-muted" />
          </li>
        ))}
      </ol>
    </>
  );
}

const COLUMNS: Record<2 | 3 | 4, string> = {
  2: 'sm:grid-cols-2',
  3: 'sm:grid-cols-2 lg:grid-cols-3',
  4: 'sm:grid-cols-2 lg:grid-cols-4',
};

export function Cards({ block }: { block: CardsBlock }) {
  return (
    <>
      <BlockHeading text={block.heading} lead={block.lead} />
      <div className={`grid gap-4 ${COLUMNS[block.columns]}`}>
        {block.items.map((item, i) => (
          <div key={i} className="rounded-card border border-line bg-surface p-5">
            <h3 className="font-display font-bold text-ink">{item.title}</h3>
            <InlineParagraph text={item.text} className="mt-1.5 text-sm leading-relaxed text-ink-muted" />
          </div>
        ))}
      </div>
    </>
  );
}

/**
 * Іконки намальовані тут, а не приходять із бази.
 *
 * Поле в блоці — це ключ зі списку, не SVG і не адреса файлу. Інакше в
 * контент потрапляє довільна розмітка або чужий домен, і одне з двох
 * рано чи пізно стріляє.
 */
const ICONS: Record<FeaturesBlock['items'][number]['icon'], string> = {
  scissors: 'M6 3v12M18 3v12M6 15a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM18 15a3 3 0 1 0 0 6 3 3 0 0 0 0-6ZM6 3l12 12M18 3 6 15',
  printer: 'M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2M6 14h12v7H6z',
  truck: 'M1 3h13v13H1zM14 8h4l3 3v5h-7zM5.5 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM17.5 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z',
  shield: 'M12 2 4 5v7c0 4.5 3.4 8.7 8 10 4.6-1.3 8-5.5 8-10V5z',
  heart: 'M20.8 5.6a5 5 0 0 0-7.1 0L12 7.3l-1.7-1.7a5 5 0 1 0-7.1 7.1L12 21.4l8.8-8.7a5 5 0 0 0 0-7.1Z',
  clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20ZM12 6v6l4 2',
};

export function Features({ block }: { block: FeaturesBlock }) {
  return (
    <>
      <BlockHeading text={block.heading} />
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {block.items.map((item, i) => (
          <div key={i} className="flex gap-3">
            <svg
              width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
              aria-hidden="true" className="mt-0.5 shrink-0 text-accent"
            >
              <path d={ICONS[item.icon]} />
            </svg>
            <div>
              <h3 className="font-display font-bold text-ink">{item.title}</h3>
              <InlineParagraph text={item.text} className="mt-1 text-sm leading-relaxed text-ink-muted" />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

export function Faq({ block }: { block: FaqBlock }) {
  return (
    <>
      <BlockHeading text={block.heading} />
      <div className="max-w-3xl divide-y divide-line">
        {block.items.map((item, i) => (
          <details key={i} className="group py-4">
            <summary className="cursor-pointer font-display font-bold text-ink marker:text-ink-subtle">
              {item.q}
            </summary>
            <InlineParagraph text={item.a} className="mt-2 leading-relaxed text-ink-muted" />
          </details>
        ))}
      </div>
    </>
  );
}

export function Cta({ block }: { block: CtaBlock }) {
  return (
    <div className="max-w-prose">
      <h2 className="font-display text-2xl font-bold text-ink">{block.heading}</h2>
      <InlineParagraph text={block.text} className="mt-3 leading-relaxed text-ink-muted" />
      <BlockLinks links={block.links} className="mt-6" />
    </div>
  );
}

export function ImageText({ block }: { block: ImageTextBlock }) {
  const media = (
    <figure className="m-0">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={block.image.url}
        alt={block.image.alt}
        className="w-full rounded-card border border-line object-cover"
      />
      {block.image.caption.trim() !== '' && (
        <figcaption className="mt-2 text-sm text-ink-subtle">{block.image.caption}</figcaption>
      )}
    </figure>
  );
  const body = (
    <div>
      {block.heading.trim() !== '' && (
        <h2 className="font-display text-2xl font-bold text-ink">{block.heading}</h2>
      )}
      <InlineParagraph text={block.text} className="mt-3 leading-relaxed text-ink-muted" />
      <BlockLinks links={block.links} className="mt-6" />
    </div>
  );

  return (
    <div className="grid items-center gap-8 md:grid-cols-2">
      {block.side === 'left' ? <>{media}{body}</> : <>{body}{media}</>}
    </div>
  );
}

export function Gallery({ block }: { block: GalleryBlock }) {
  return (
    <>
      <BlockHeading text={block.heading} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {block.items.map((img, i) => (
          <figure key={i} className="m-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={img.url}
              alt={img.alt}
              className="aspect-square w-full rounded-card border border-line object-cover"
            />
            {img.caption.trim() !== '' && (
              <figcaption className="mt-2 text-sm text-ink-subtle">{img.caption}</figcaption>
            )}
          </figure>
        ))}
      </div>
    </>
  );
}

export function Quote({ block }: { block: QuoteBlock }) {
  return (
    <figure className="m-0 max-w-3xl">
      <blockquote className="font-display text-xl font-semibold leading-snug text-ink">
        <Inline text={block.text} />
      </blockquote>
      {(block.author.trim() !== '' || block.role.trim() !== '') && (
        <figcaption className="mt-3 text-sm text-ink-muted">
          {block.author}
          {block.role.trim() !== '' && <span className="text-ink-subtle"> · {block.role}</span>}
        </figcaption>
      )}
    </figure>
  );
}
