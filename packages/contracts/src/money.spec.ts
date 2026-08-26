import { describe, expect, it } from 'vitest';
import {
  addMinor, formatUAH, fromUAH, minor, mulMinor, percentOfMinor, subMinor,
} from './money';

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

  it('рахує відсоток у сотих відсотка й округлює симетрично', () => {
    expect(percentOfMinor(fromUAH(500), 1000)).toBe(fromUAH(50));
    expect(percentOfMinor(fromUAH(500), 10_000)).toBe(fromUAH(500));
    expect(percentOfMinor(fromUAH(0.01), 5000)).toBe(1);
    expect(percentOfMinor(minor(-1), 5000)).toBe(-1);
    expect(percentOfMinor(minor(1), 5000)).toBe(1);
    expect(() => percentOfMinor(fromUAH(500), 12.5)).toThrow(TypeError);
  });
});
