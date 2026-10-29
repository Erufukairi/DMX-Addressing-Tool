import { describe, expect, it } from 'vitest';
import { computeLayout, hasErrors, validateLayout } from '../../src/engine';
import { advancedLayout, block, pattern } from './helpers';

describe('computeLayout (advanced mode)', () => {
  it('packs blocks end to end with labels and block ids', () => {
    const result = computeLayout(advancedLayout([block('a', 10, 2, 'Spot'), block('b', 5, 1, 'Wash')], 3));
    expect(result.placed).toEqual([
      { unit: 1, blockId: 'a', label: 'Spot', address: 3, endAddress: 12 },
      { unit: 2, blockId: 'a', label: 'Spot', address: 13, endAddress: 22 },
      { unit: 3, blockId: 'b', label: 'Wash', address: 23, endAddress: 27 },
    ]);
    expect(result.nextAddress).toBe(28);
    expect(result.remaining).toBe(485);
    expect(result.notPlaced).toEqual([]);
  });

  it('interleaves a pattern repeat', () => {
    const result = computeLayout(advancedLayout([pattern('p', 3, block('s', 19, 1, 'Spot'), block('w', 14, 1, 'Wash'))]));
    expect(result.placed.map((f) => [f.label, f.address])).toEqual([
      ['Spot', 1],
      ['Wash', 20],
      ['Spot', 34],
      ['Wash', 53],
      ['Spot', 67],
      ['Wash', 86],
    ]);
    expect(result.nextAddress).toBe(100);
  });

  it('keeps unit numbers continuous across blocks and pattern repeats', () => {
    const result = computeLayout(
      advancedLayout([block('a', 7, 3), pattern('p', 4, block('b', 3, 2), block('c', 11, 1)), block('d', 2, 5)]),
    );
    expect(result.placed).toHaveLength(3 + 4 * 3 + 5);
    result.placed.forEach((f, i) => expect(f.unit).toBe(i + 1));
  });

  it('omits the label for unlabeled or blank-labeled blocks', () => {
    const result = computeLayout(advancedLayout([block('a', 10, 1), block('b', 10, 1, '  ')]));
    expect(result.placed.every((f) => !('label' in f))).toBe(true);
  });

  it('trims labels', () => {
    expect(computeLayout(advancedLayout([block('a', 10, 1, ' Spot ')])).placed[0]?.label).toBe('Spot');
  });

  it('leaves earlier placements unchanged when a later block does not fit', () => {
    const before = computeLayout(advancedLayout([block('a', 100, 4, 'Spot')]));
    const after = computeLayout(advancedLayout([block('a', 100, 4, 'Spot'), block('b', 50, 3, 'Wash')]));
    expect(after.placed.slice(0, 4)).toEqual(before.placed);
    // 401 + 50 = 451 fits once more for addresses 401–450 and 451–500; the third needs 501–550.
    expect(after.placed).toHaveLength(6);
    expect(after.notPlaced).toEqual([{ blockId: 'b', label: 'Wash', count: 1 }]);
    expect(after.nextAddress).toBe(501);
    expect(after.remaining).toBe(12);
  });

  it('stops at the first fixture that does not fit, without skipping ahead to a smaller one', () => {
    // Big ends at 500; the 20-wide doesn't fit; the 1-wide after it would, but must not be placed.
    const result = computeLayout(
      advancedLayout([block('a', 500, 1, 'Big'), block('b', 20, 1, 'Mid'), block('c', 1, 2, 'Tiny')]),
    );
    expect(result.placed.map((f) => f.blockId)).toEqual(['a']);
    expect(result.notPlaced).toEqual([
      { blockId: 'b', label: 'Mid', count: 1 },
      { blockId: 'c', label: 'Tiny', count: 2 },
    ]);
    expect(result.nextAddress).toBe(501);
  });

  it('overflows partway through a pattern repeat and counts the rest per block', () => {
    // 20 × (19 + 14): 15 full pairs end at 495; repeat 16's Spot needs 496–514.
    const result = computeLayout(
      advancedLayout([pattern('p', 20, block('s', 19, 1, 'Spot'), block('w', 14, 1, 'Wash')), block('x', 1, 4)]),
    );
    expect(result.placed).toHaveLength(30);
    expect(result.placed.at(-1)).toMatchObject({ label: 'Wash', address: 482, endAddress: 495 });
    expect(result.notPlaced).toEqual([
      { blockId: 's', label: 'Spot', count: 5 },
      { blockId: 'w', label: 'Wash', count: 5 },
      { blockId: 'x', count: 4 },
    ]);
    expect(result.nextAddress).toBe(496);
  });

  it('counts a huge repeat arithmetically', () => {
    const result = computeLayout(advancedLayout([pattern('p', 1_000_000, block('s', 10, 2))]));
    expect(result.placed).toHaveLength(51);
    expect(result.notPlaced).toEqual([{ blockId: 's', count: 2_000_000 - 51 }]);
  });

  it('a pattern with repeat 1 behaves like its blocks in order', () => {
    const flat = computeLayout(advancedLayout([block('s', 19, 2), block('w', 14, 1)]));
    const grouped = computeLayout(advancedLayout([pattern('p', 1, block('s', 19, 2), block('w', 14, 1))]));
    expect(grouped).toEqual(flat);
  });

  it('exact fill sets nextAddress to null', () => {
    const result = computeLayout(advancedLayout([pattern('p', 16, block('a', 16, 1), block('b', 16, 1))]));
    expect(result.placed).toHaveLength(32);
    expect(result.nextAddress).toBeNull();
    expect(result.remaining).toBe(0);
  });

  it('is deterministic', () => {
    const layout = advancedLayout([pattern('p', 9, block('s', 19, 1, 'Spot'), block('w', 14, 2, 'Wash'))], 40);
    expect(computeLayout(layout)).toEqual(computeLayout(layout));
  });

  it('throws on an invalid layout', () => {
    expect(() => computeLayout(advancedLayout([block('a', 0, 1)]))).toThrow(/Invalid layout/);
  });
});

describe('validateLayout (advanced mode)', () => {
  it('accepts a valid sequence', () => {
    expect(validateLayout(advancedLayout([block('a', 10, 1), pattern('p', 2, block('b', 5, 1))]))).toEqual({});
  });

  it('requires at least one item', () => {
    expect(validateLayout(advancedLayout([])).sequence).toBeTruthy();
    const noSequence = advancedLayout([]);
    delete noSequence.sequence;
    expect(validateLayout(noSequence).sequence).toBeTruthy();
  });

  it('checks the start address', () => {
    expect(validateLayout(advancedLayout([block('a', 10, 1)], 0)).startAddress).toBeTruthy();
  });

  it('keys block and pattern errors by id', () => {
    const errors = validateLayout(
      advancedLayout([block('a', 0, 1), pattern('p', 0, block('b', 10, 1.5)), pattern('q', 2), block('c', 513, 0)]),
    );
    expect(hasErrors(errors)).toBe(true);
    expect(Object.keys(errors.items ?? {}).sort()).toEqual(['a', 'b', 'c', 'p', 'q']);
    expect(Object.keys(errors.items!.a!)).toEqual(['footprint']);
    expect(Object.keys(errors.items!.b!)).toEqual(['quantity']);
    expect(Object.keys(errors.items!.c!).sort()).toEqual(['footprint', 'quantity']);
    expect(Object.keys(errors.items!.p!)).toEqual(['repeat']);
    expect(Object.keys(errors.items!.q!)).toEqual(['blocks']);
  });

  it('has no items key when every item is valid', () => {
    expect(validateLayout(advancedLayout([block('a', 10, 1)], 0))).not.toHaveProperty('items');
  });
});
