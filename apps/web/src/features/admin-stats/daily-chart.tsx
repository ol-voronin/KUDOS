'use client';

import type { DailyPointDto } from '@dt/contracts';

/**
 * Стовпчики по днях.
 *
 * Два окремі графіки замість одного з двома серіями — рішення, а не смак.
 * Візитів на день десятки, заявок одиниці; на спільній шкалі заявки
 * перетворюються на непомітну лінію біля нуля, а друга вісь справа —
 * найпоширеніший спосіб намалювати неіснуючий звʼязок між двома рядами.
 *
 * Колір тут нічого не означає: серія в кожному графіку одна, і називає її
 * заголовок. Тому легенди немає, а відтінок узятий один — акцентний.
 *
 * Підпис ставиться тільки над максимумом: число над кожним стовпчиком
 * перетворює графік на таблицю, яку незручно читати.
 */

const WIDTH = 720;
const HEIGHT = 96;
const BAR_GAP = 2;

function shortDate(iso: string): string {
  const [, month, day] = iso.split('-');
  return `${day}.${month}`;
}

export function DailyChart({
  title, points, pick, ariaTotalLabel,
}: {
  title: string;
  points: readonly DailyPointDto[];
  pick: (p: DailyPointDto) => number;
  ariaTotalLabel: string;
}) {
  const values = points.map(pick);
  const max = Math.max(...values, 1);
  const total = values.reduce((a, b) => a + b, 0);
  const barWidth = Math.max(2, WIDTH / points.length - BAR_GAP);
  const peak = values.indexOf(max);

  const first = points[0];
  const last = points[points.length - 1];

  return (
    <figure className="m-0">
      <figcaption className="flex items-baseline justify-between">
        <span className="font-display text-sm font-bold text-ink">{title}</span>
        <span className="text-xs tabular-nums text-ink-subtle">{total} за період</span>
      </figcaption>

      <div className="mt-2 overflow-x-auto">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT + 18}`}
          className="h-28 w-full min-w-[32rem]"
          role="img"
          aria-label={`${title}: ${ariaTotalLabel}. Максимум ${max} ${first ? shortDate(first.date) : ''}—${last ? shortDate(last.date) : ''}.`}
        >
          {points.map((point, i) => {
            const value = pick(point);
            const height = value === 0 ? 0 : Math.max(2, Math.round((value / max) * HEIGHT));
            const x = (WIDTH / points.length) * i;
            return (
              <g key={point.date}>
                {/* Порожній день лишає слід: ряд без нього виглядав би рівним
                    саме там, де був провал. */}
                <rect
                  x={x} y={HEIGHT - 1} width={barWidth} height={1}
                  className="fill-line"
                />
                {height > 0 && (
                  <rect
                    x={x} y={HEIGHT - height} width={barWidth} height={height}
                    rx={height > 4 ? 2 : 0}
                    className="fill-accent"
                  >
                    <title>{`${shortDate(point.date)}: ${value}`}</title>
                  </rect>
                )}
              </g>
            );
          })}

          {max > 0 && values[peak] !== 0 && (
            <text
              x={Math.min(WIDTH - 16, (WIDTH / points.length) * peak + barWidth / 2)}
              y={Math.max(10, HEIGHT - Math.round((max / max) * HEIGHT) - 4)}
              textAnchor="middle"
              className="fill-ink-muted text-[10px] tabular-nums"
            >
              {max}
            </text>
          )}

          {first && (
            <text x={0} y={HEIGHT + 14} className="fill-ink-subtle text-[10px] tabular-nums">
              {shortDate(first.date)}
            </text>
          )}
          {last && (
            <text x={WIDTH} y={HEIGHT + 14} textAnchor="end" className="fill-ink-subtle text-[10px] tabular-nums">
              {shortDate(last.date)}
            </text>
          )}
        </svg>
      </div>
    </figure>
  );
}
