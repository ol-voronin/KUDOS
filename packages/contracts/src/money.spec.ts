import { describe, expect, it } from 'vitest';
import { addMinor, formatUAH, fromUAH, minor, mulMinor, subMinor } from './money';

describe('money', () => {
  it('keeps arithmetic exact where floats would drift', () => {
    // 0.1 + 0.2 !== 0.3 in floating point. In kopiykas it is exact.
    expect(addMinor(fromUAH(0.1), fromUAH(0.2))).toBe(fromUAH(0.3));
  });

  it('multiplies only by integer quantities', () => {
    expect(mulMinor(fromUAH(590), 3)).toBe(177_000);
    expect(() => mulMinor(fromUAH(590), 1.5)).toThrow(TypeError);
    expect(() => mulMinor(fromUAH(590), -1)).toThrow(TypeError);
  });

  it('rejects fractional kopiykas at the boundary', () => {
    expect(() => minor(0.5)).toThrow(TypeError);
    expect(() => fromUAH(1.005)).toThrow(RangeError);
  });

  it('subtracts without going through a float', () => {
    expect(subMinor(fromUAH(700), fromUAH(150))).toBe(55_000);
  });

  it('formats once, at the edge', () => {
    expect(formatUAH(fromUAH(1600))).toMatch(/1\s?600/);
  });
});
