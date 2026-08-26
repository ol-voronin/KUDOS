import { describe, expect, it } from 'vitest';
import { dailySeries, dayKey, rankPages, rankSources, sourceLabel, type EventRow, type OutcomeRow } from './stats.domain';

const AT = new Date('2026-08-26T10:00:00.000Z');

function view(over: Partial<EventRow> = {}): EventRow {
  return {
    name: 'page_view', path: '/', sessionId: 's1', at: AT,
    source: '', medium: '', campaign: '', valueMinor: null,
    ...over,
  };
}

function outcome(over: Partial<OutcomeRow> = {}): OutcomeRow {
  return { at: AT, source: '', medium: '', campaign: '', valueMinor: 0, ...over };
}

describe('dailySeries', () => {
  it('віддає рівно стільки днів, скільки просили, включно з порожніми', () => {
    const series = dailySeries([view()], [], 7, AT);

    expect(series).toHaveLength(7);
    // День без подій має бути нулем у ряду, а не зникати: графік із
    // пропущеним днем виглядає рівним там, де був провал.
    expect(series.filter((d) => d.views === 0)).toHaveLength(6);
    expect(series[6]?.date).toBe('2026-08-26');
  });

  it('візит рахує за сесією, а не за подією', () => {
    const series = dailySeries(
      [view(), view(), view({ sessionId: 's2' })],
      [],
      1,
      AT,
    );

    expect(series[0]?.views).toBe(3);
    expect(series[0]?.visits).toBe(2);
  });

  it('події, які не є переглядом, у перегляди не потрапляють', () => {
    const series = dailySeries([view({ name: 'telegram_click' })], [], 1, AT);
    expect(series[0]?.views).toBe(0);
    // Але візитом вони лишаються: людина ж була.
    expect(series[0]?.visits).toBe(1);
  });
});

describe('rankSources', () => {
  it('рахує візити за сесіями й додає результат', () => {
    const google = { source: 'google', medium: 'cpc', campaign: 'brand' };
    const rows = rankSources(
      [view({ ...google }), view({ ...google }), view({ ...google, sessionId: 's2' })],
      [outcome({ ...google })],
      [outcome({ ...google, valueMinor: 120_000 })],
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]?.visits).toBe(2);
    expect(rows[0]?.leads).toBe(1);
    expect(rows[0]?.revenueMinor).toBe(120_000);
    expect(rows[0]?.label).toBe('google / cpc / brand');
  });

  it('спершу те, що принесло гроші', () => {
    const rows = rankSources(
      [
        view({ source: 'many', sessionId: 'a' }), view({ source: 'many', sessionId: 'b' }),
        view({ source: 'many', sessionId: 'c' }), view({ source: 'paid', sessionId: 'd' }),
      ],
      [],
      [outcome({ source: 'paid', valueMinor: 50_000 })],
    );

    expect(rows[0]?.source).toBe('paid');
  });

  it('замовлення з джерела, яке не дало жодного перегляду, не губиться', () => {
    // Так буває: людина прийшла місяць тому, а купила сьогодні.
    const rows = rankSources([], [], [outcome({ source: 'newsletter', valueMinor: 1 })]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.visits).toBe(0);
  });
});

describe('sourceLabel', () => {
  it('порожня атрибуція — це прямий захід, а не «—/—»', () => {
    expect(sourceLabel('', '', '')).toBe('прямі заходи');
  });

  it('без кампанії підпис коротший', () => {
    expect(sourceLabel('google', 'organic', '')).toBe('google / organic');
  });
});

describe('rankPages', () => {
  it('рахує тільки перегляди й сортує за спаданням', () => {
    const rows = rankPages([
      view({ path: '/a' }), view({ path: '/a' }), view({ path: '/b' }),
      view({ path: '/c', name: 'purchase' }),
    ]);

    expect(rows.map((r) => r.path)).toEqual(['/a', '/b']);
    expect(rows[0]?.views).toBe(2);
  });
});

describe('dayKey', () => {
  it('рахує за UTC — щоб звіт не залежав від того, де стоїть сервер', () => {
    expect(dayKey(new Date('2026-08-26T23:30:00.000Z'))).toBe('2026-08-26');
  });
});
