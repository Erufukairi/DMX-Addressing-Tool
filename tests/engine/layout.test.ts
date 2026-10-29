import { describe, expect, it } from 'vitest';
import { computeLayout } from '../../src/engine';
import { simpleLayout } from './helpers';

describe('computeLayout (simple mode)', () => {
  it('places fixtures end to end from the start address', () => {
    const result = computeLayout(simpleLayout(19, 1));
    expect(result.placed).toHaveLength(26); // floor(512 / 19)
    expect(result.placed.slice(0, 3)).toEqual([
      { unit: 1, address: 1, endAddress: 19 },
      { unit: 2, address: 20, endAddress: 38 },
      { unit: 3, address: 39, endAddress: 57 },
    ]);
    expect(result.nextAddress).toBe(495);
    expect(result.remaining).toBe(18);
    expect(result.notPlaced).toEqual([]);
  });

  it('never places a fixture partially past 512', () => {
    const result = computeLayout(simpleLayout(22, 6));
    const last = result.placed.at(-1)!;
    expect(last.endAddress).toBeLessThanOrEqual(512);
    expect(last.endAddress + 22).toBeGreaterThan(512);
  });

  it('footprint 512 at start 1 fits exactly one fixture and fills the universe', () => {
    const result = computeLayout(simpleLayout(512, 1));
    expect(result.placed).toEqual([{ unit: 1, address: 1, endAddress: 512 }]);
    expect(result.nextAddress).toBeNull();
    expect(result.remaining).toBe(0);
  });

  it('footprint 512 at start 2 fits nothing', () => {
    const result = computeLayout(simpleLayout(512, 2));
    expect(result.placed).toEqual([]);
    expect(result.nextAddress).toBe(2);
    expect(result.remaining).toBe(511);
  });

  it('footprint 1 at start 1 gives 512 rows', () => {
    const result = computeLayout(simpleLayout(1, 1));
    expect(result.placed).toHaveLength(512);
    expect(result.placed[511]).toEqual({ unit: 512, address: 512, endAddress: 512 });
    expect(result.nextAddress).toBeNull();
  });

  it('exact fill sets nextAddress to null', () => {
    const result = computeLayout(simpleLayout(16, 1));
    expect(result.placed).toHaveLength(32);
    expect(result.nextAddress).toBeNull();
    expect(result.remaining).toBe(0);
  });

  it('start 512 with footprint 1 places one fixture', () => {
    const result = computeLayout(simpleLayout(1, 512));
    expect(result.placed).toEqual([{ unit: 1, address: 512, endAddress: 512 }]);
    expect(result.nextAddress).toBeNull();
  });

  it('quantity below the fit count places only that many', () => {
    const result = computeLayout(simpleLayout(10, 1, 5));
    expect(result.placed).toHaveLength(5);
    expect(result.notPlaced).toEqual([]);
    expect(result.nextAddress).toBe(51);
    expect(result.remaining).toBe(462);
  });

  it('quantity above the fit count reports the shortfall', () => {
    const result = computeLayout(simpleLayout(24, 1, 24));
    expect(result.placed).toHaveLength(21);
    expect(result.notPlaced).toEqual([{ count: 3 }]);
    expect(result.nextAddress).toBe(505);
    expect(result.remaining).toBe(8);
  });

  it('quantity with zero fit reports every fixture as not placed', () => {
    const result = computeLayout(simpleLayout(512, 2, 3));
    expect(result.placed).toEqual([]);
    expect(result.notPlaced).toEqual([{ count: 3 }]);
  });

  it('unit numbers are continuous from 1', () => {
    const result = computeLayout(simpleLayout(7, 100));
    result.placed.forEach((f, i) => expect(f.unit).toBe(i + 1));
  });

  it.each([
    [0, 1],
    [-3, 1],
    [1.5, 1],
    [513, 1],
    [10, 0],
    [10, 513],
  ])('throws on invalid input (footprint %s, start %s)', (footprint, start) => {
    expect(() => computeLayout(simpleLayout(footprint, start))).toThrow(/Invalid layout/);
  });

  it('is deterministic', () => {
    const layout = simpleLayout(13, 40, 9);
    expect(computeLayout(layout)).toEqual(computeLayout(layout));
  });
});
