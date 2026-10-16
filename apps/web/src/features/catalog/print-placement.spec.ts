import { describe, expect, it } from 'vitest';
import { placementFor } from './print-placement';

describe('placementFor', () => {
  it('ставить принт на класичному худі по осі виробу', () => {
    const r = placementFor('any-print', ['polo-babaky'], 'hudi-klasychnyi', 'MAXI', 1200 / 1697);
    expect(r?.placement.cx).toBe(0.63);
  });

  it('не чіпає вироби, де приклад уже по центру', () => {
    const r = placementFor('any-print', ['polo-babaky'], 'svitshot-klasychnyi', 'MAXI', 1200 / 1697);
    expect(r?.placement.cx).not.toBe(0.63);
  });
});
