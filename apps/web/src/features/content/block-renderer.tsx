import type { ReactNode } from 'react';
import type { AnyBlock, BlockType } from '@dt/contracts';
import { Section } from '@/components/section';
import {
  Cards, Cta, Faq, Features, Gallery, Hero, ImageText, Legal, Quote, Split, Steps, Text,
} from './blocks/static-blocks';
import {
  ArticleListBlockView, BreedStripBlockView, CollectionStripBlockView,
  LeadFormBlockView, PrintGridBlockView,
} from './blocks/dynamic-blocks';

/**
 * Рендер сторінки з блоків.
 *
 * Тип `Renderers` — це і є та сама перевірка, заради якої існує реєстр:
 * ключі мусять точно збігатися з переліком типів у zod-union. Додав тип у
 * контракт і забув компонент — збірка падає тут, а не сторінка в проді.
 * Прибрав тип із контракту, а компонент лишився — теж падає.
 *
 * Значення навмисно не типізовані точніше за `(block: never) => ReactNode`:
 * звузити кожен ключ до свого варіанта union у звичайному `Record` не
 * виходить, тож звуження робить `switch` нижче, який TypeScript перевіряє
 * на вичерпність окремо. Дві перевірки з різних боків — навмисне
 * дублювання: одна ловить брак компонента, друга — брак гілки.
 */
type Renderers = Record<BlockType, true>;

/** Існує лише заради помилки компіляції, якщо тип блока лишиться без гілки. */
const IMPLEMENTED: Renderers = {
  hero: true, text: true, legal: true, steps: true, cards: true, split: true, features: true,
  faq: true, cta: true, leadForm: true, imageText: true, gallery: true, quote: true,
  articleList: true, printGrid: true, breedStrip: true, collectionStrip: true,
};

/**
 * Тон секції їде до блока.
 *
 * Чорна секція (`tone: 'ink'`) була в переліку тонів і в адмінці ще до того,
 * як хоч один блок навчився про неї знати: усі малювали `text-ink` на чорному
 * тлі. Тобто вибір, який редактор бачить у списку, гарантовано ламав сторінку.
 * Тепер тон доходить до блока й перемикає палітру.
 */
function renderBlock(block: AnyBlock, onDark = false): ReactNode {
  switch (block.type) {
    case 'hero': return <Hero block={block} onDark={onDark} />;
    case 'text': return <Text block={block} onDark={onDark} />;
    case 'legal': return <Legal block={block} onDark={onDark} />;
    case 'steps': return <Steps block={block} onDark={onDark} />;
    case 'cards': return <Cards block={block} onDark={onDark} />;
    case 'split': return <Split block={block} onDark={onDark} />;
    case 'features': return <Features block={block} onDark={onDark} />;
    case 'faq': return <Faq block={block} onDark={onDark} />;
    case 'cta': return <Cta block={block} onDark={onDark} />;
    case 'imageText': return <ImageText block={block} onDark={onDark} />;
    case 'gallery': return <Gallery block={block} onDark={onDark} />;
    case 'quote': return <Quote block={block} onDark={onDark} />;
    case 'leadForm': return <LeadFormBlockView block={block} onDark={onDark} />;
    case 'articleList': return <ArticleListBlockView block={block} onDark={onDark} />;
    case 'printGrid': return <PrintGridBlockView block={block} onDark={onDark} />;
    case 'breedStrip': return <BreedStripBlockView block={block} onDark={onDark} />;
    case 'collectionStrip': return <CollectionStripBlockView block={block} onDark={onDark} />;
    default: {
      // Недосяжно, доки кожен варіант union має гілку вище. Якщо зʼявиться
      // новий тип без гілки — тут буде помилка типів, а не тиха порожнеча.
      const exhaustive: never = block;
      void exhaustive;
      return null;
    }
  }
}

/**
 * Сусідні блоки з однаковим тоном зливаються в одну секцію.
 *
 * Інакше два текстові блоки поспіль малюють дві секції з однаковим фоном і
 * подвійним вертикальним відступом між ними — видно як діру посеред
 * сторінки. Редактор про відступи не думає й думати не повинен.
 */
function groupByTone(blocks: readonly AnyBlock[]): AnyBlock[][] {
  const groups: AnyBlock[][] = [];
  for (const block of blocks) {
    const last = groups[groups.length - 1];
    if (last !== undefined && last[0]?.tone === block.tone) last.push(block);
    else groups.push([block]);
  }
  return groups;
}

export function BlockRenderer({ blocks }: { blocks: readonly AnyBlock[] }) {
  void IMPLEMENTED;
  return (
    <>
      {/*
        Класи `block-section` і `block-stack` — не оформлення, а гачки для
        двох правил у globals.css. Динамічний блок, який нічого не знайшов
        (порожня колекція, немає принтів у наявності), повертає `null` — але
        обгортка навколо нього лишається, а разом із нею відступи секції.
        На сторінці це смуга іншого кольору без жодного вмісту.

        Порожнечу видно тільки після рендера, тож приховує її CSS. Зробити
        це в React не вийде: блоки — серверні компоненти, і батько не знає,
        що поверне дитина, доки та не відрендериться.
      */}
      {groupByTone(blocks).map((group, i) => {
        /*
         * Герой із фотографією малюється повз секцію.
         *
         * Секція дає максимальну ширину й вертикальні відступи — рівно те,
         * від чого фон на весь екран має бути вільним. Загорнути його
         * всередину означало б поле з боків і білі смуги згори й знизу:
         * «на весь екран», якого видно рівно посередині.
         */
        const solo = group.length === 1 ? group[0] : undefined;
        if (solo !== undefined && solo.type === 'hero' && solo.image.url !== '') {
          return <div key={solo.id} id={solo.id} data-cursor="light">{renderBlock(solo)}</div>;
        }
        const tone = group[0]?.tone ?? 'plain';
        const onDark = tone === 'ink';
        return (
          <Section key={group[0]?.id ?? i} tone={tone} className="block-section">
            <div className="block-stack flex flex-col gap-12">
              {group.map((block) => (
                // id блока — це якір: кнопка «Знайти за породою» веде на `#породи`.
                // scroll-mt — щоб липка шапка не накривала заголовок секції.
                <div key={block.id} id={block.id} className="reveal scroll-mt-24">{renderBlock(block, onDark)}</div>
              ))}
            </div>
          </Section>
        );
      })}
    </>
  );
}
