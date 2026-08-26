'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DiscountsPanel } from './discounts-panel';
import { ModifiersPanel } from './modifiers-panel';
import { PriceCalculator } from './price-calculator';
import { PricingTable } from './pricing-table';
import { getPriceRules } from './rules-api';
import { RULES_KEY } from './rules-key';

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
      <nav className="flex flex-wrap gap-2 border-b border-line" aria-label="Розділи цін">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            aria-current={tab === t.id ? 'page' : undefined}
            onClick={() => setTab(t.id)}
            className={[
              '-mb-px border-b-2 px-3 py-2 text-sm',
              tab === t.id ? 'border-ink font-medium text-ink' : 'border-transparent text-ink-muted hover:text-ink',
            ].join(' ')}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === 'base' && <PricingTable />}

      {tab !== 'base' && isLoading && <p className="text-ink-muted">Завантаження…</p>}
      {tab !== 'base' && isError && <p className="text-danger">Не вдалося завантажити правила.</p>}

      {tab === 'modifiers' && data && <ModifiersPanel data={data} />}
      {tab === 'discounts' && data && <DiscountsPanel data={data} />}
      {tab === 'calculator' && data && <PriceCalculator data={data} />}
    </div>
  );
}
