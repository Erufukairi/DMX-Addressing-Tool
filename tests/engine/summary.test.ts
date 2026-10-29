import { describe, expect, it } from 'vitest';
import { computeLayout, summarize, type Layout } from '../../src/engine';
import { advancedLayout, block, pattern, simpleLayout } from './helpers';

function summaryOf(layout: Layout) {
  return summarize(layout, computeLayout(layout));
}

function summary(footprint: number, start = 1, quantity?: number) {
  return summaryOf(simpleLayout(footprint, start, quantity));
}

describe('summarize (design doc §4)', () => {
  it('reports units placed, addresses left, and the next address', () => {
    expect(summary(24)).toEqual({ units: '21 units', short: false, addresses: '8 addr left', nextAddress: 505 });
  });

  it('reports a full universe with nothing to continue from', () => {
    expect(summary(16)).toEqual({ units: '32 units', short: false, addresses: 'universe full', nextAddress: null });
  });

  it('flags a shortfall as "x of y" without a separate count', () => {
    expect(summary(24, 1, 24)).toEqual({
      units: '21 of 24 units',
      short: true,
      addresses: '8 addr left',
      nextAddress: 505,
    });
  });

  it('flags a shortfall with a full universe', () => {
    expect(summary(16, 1, 40)).toMatchObject({ units: '32 of 40 units', short: true, addresses: 'universe full' });
  });

  it('uses the singular for one unit', () => {
    expect(summary(511).units).toBe('1 unit');
  });

  it('flags nothing fitting and offers no continue', () => {
    expect(summary(512, 2)).toEqual({ units: 'No units fit', short: true, addresses: '511 addr left', nextAddress: null });
  });

  it('has no label counts in simple mode', () => {
    expect(summary(19)).not.toHaveProperty('labels');
  });
});

describe('summarize (advanced mode)', () => {
  const spot = block('s', 19, 1, 'Spot');
  const wash = block('w', 14, 1, 'Wash');

  it('counts each label in order of first appearance', () => {
    const s = summaryOf(advancedLayout([pattern('p', 8, spot, wash)]));
    expect(s).toEqual({
      units: '16 units',
      short: false,
      labels: '8 Spot, 8 Wash',
      addresses: '248 addr left',
      nextAddress: 265,
    });
  });

  it('shows "x of y" for a label that came up short', () => {
    // 20 × (19 + 14) = 660 > 512: 15 full pairs (495), then Spot 496–514 doesn't fit.
    const s = summaryOf(advancedLayout([pattern('p', 20, spot, wash)]));
    expect(s.units).toBe('30 of 40 units');
    expect(s.short).toBe(true);
    expect(s.labels).toBe('15 of 20 Spot, 15 of 20 Wash');
  });

  it('sums the same label across separate blocks', () => {
    const s = summaryOf(advancedLayout([block('a', 10, 2, 'Spot'), block('b', 5, 3, 'Wash'), block('c', 10, 1, 'Spot')]));
    expect(s.labels).toBe('3 Spot, 3 Wash');
  });

  it('omits label counts when only one label is used', () => {
    expect(summaryOf(advancedLayout([block('a', 10, 2, 'Spot'), block('b', 5, 3)]))).not.toHaveProperty('labels');
  });
});
