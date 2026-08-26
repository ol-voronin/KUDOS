'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DiscountsPanel } from './discounts-panel';
import { ModifiersPanel } from './modifiers-panel';
import { PriceCalculator } from './price-calculator';
import { PricingTable } from './pricing-table';
import { getPriceRules } from './rules-api';
import { RULES_KEY } from './rules-key';
import { TableSkeleton, ErrorBanner } from '@/components/ui';

const TABS = [
  { id: 'base', label: 'Базові ціни' },
  { id: 'modifiers', label: 'Надбавки' },
  { id: 'discounts', label: 'Знижки' },
  { id: 'calculator', label: 'Калькулятор' },
] as const;

type TabId = (typeof TABS)[number]['id'];

/**
 * Ціни одним екраном із чотирма вкладками.
 *
 * Розділ один навмисно. База, надбавки й знижки — це три частини однієї
 * суми, і рознесені по різних пунктах меню вони перетворюються на три
 * незалежні налаштування, наслідки яких людина бачить уперше в замовленні.
 * Тут же поруч стоїть калькулятор, який показує результат усіх трьох.
 */
export function PricingScreen() {
  const [tab, setTab] = useState<TabId>('base');
  const { data, isLoading, isError } = useQuery({ queryKey: RULES_KEY, queryFn: getPriceRules });

  return (
    <div className="flex flex-col gap-8">
      {/*
        Це справді вкладки, тож і ролі мають бути вкладок. Раніше стояло
        `aria-current="page"` — зчитувач читав це як навігацію по сайту й
        обіцяв людині перехід на іншу сторінку, якого не відбувається.
      */}
      <div role="tablist" aria-label="Розділи цін" className="flex flex-wrap gap-1 border-b border-line">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`panel-${t.id}`}
            onClick={() => setTab(t.id)}
            className={[
              'tap-sm -mb-px min-h-9 border-b-2 px-3 text-sm transition',
              tab === t.id ? 'border-ink font-semibold text-ink' : 'border-transparent text-ink-muted hover:text-ink',
            ].join(' ')}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === 'base' && <PricingTable />}

        {tab !== 'base' && isLoading && <TableSkeleton rows={4} cols={4} />}
        {tab !== 'base' && isError && <ErrorBanner>Не вдалося завантажити правила.</ErrorBanner>}

        {tab === 'modifiers' && data && <ModifiersPanel data={data} />}
        {tab === 'discounts' && data && <DiscountsPanel data={data} />}
        {tab === 'calculator' && data && <PriceCalculator data={data} />}
      </div>
    </div>
  );
}
