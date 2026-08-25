import type { ReactNode } from 'react';
import type { AnyBlock, BlockType } from '@dt/contracts';
import { Section } from '@/components/section';
import {
  Cards, Cta, Faq, Features, Gallery, Hero, ImageText, Legal, Quote, Steps, Text,
} from './blocks/static-blocks';
import {
  BreedStripBlockView, CollectionStripBlockView, LeadFormBlockView, PrintGridBlockView,
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
  hero: true, text: true, legal: true, steps: true, cards: true, features: true,
  faq: true, cta: true, leadForm: true, imageText: true, gallery: true, quote: true,
  printGrid: true, breedStrip: true, collectionStrip: true,
};

function renderBlock(block: AnyBlock): ReactNode {
  switch (block.type) {
    case 'hero': return <Hero block={block} />;
    case 'text': return <Text block={block} />;
    case 'legal': return <Legal block={block} />;
    case 'steps': return <Steps block={block} />;
    case 'cards': return <Cards block={block} />;
    case 'features': return <Features block={block} />;
    case 'faq': return <Faq block={block} />;
    case 'cta': return <Cta block={block} />;
    case 'imageText': return <ImageText block={block} />;
    case 'gallery': return <Gallery block={block} />;
    case 'quote': return <Quote block={block} />;
    case 'leadForm': return <LeadFormBlockView block={block} />;
    case 'printGrid': return <PrintGridBlockView block={block} />;
    case 'breedStrip': return <BreedStripBlockView block={block} />;
    case 'collectionStrip': return <CollectionStripBlockView block={block} />;
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
      {groupByTone(blocks).map((group, i) => (
        <Section key={group[0]?.id ?? i} tone={group[0]?.tone ?? 'plain'}>
          <div className="flex flex-col gap-12">
            {group.map((block) => <div key={block.id}>{renderBlock(block)}</div>)}
          </div>
        </Section>
      ))}
    </>
  );
}
