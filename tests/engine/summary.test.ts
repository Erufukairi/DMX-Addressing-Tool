import { describe, expect, it } from 'vitest';
import { computeLayout, formatSummary } from '../../src/engine';
import { simpleLayout } from './helpers';

function summary(footprint: number, start = 1, quantity?: number): string {
  const layout = simpleLayout(footprint, start, quantity);
  return formatSummary(layout, computeLayout(layout));
}

describe('formatSummary', () => {
  // The doc's example numbers (45 left at 468) can't occur, so these use the doc's format with real numbers.
  it('reports fixtures fitted and addresses left', () => {
    expect(summary(24)).toBe('Fit 21 fixtures · 8 addresses left starting at 505');
  });

  it('reports a full universe', () => {
    expect(summary(16)).toBe('Fit 32 fixtures · universe full');
  });

  it('reports a shortfall when a quantity was entered', () => {
    expect(summary(24, 1, 24)).toBe(
      "Fit 21 of 24 fixtures · 3 didn't fit · 8 addresses left starting at 505",
    );
  });

  it('reports a shortfall with a full universe', () => {
    expect(summary(16, 1, 40)).toBe("Fit 32 of 40 fixtures · 8 didn't fit · universe full");
  });

  it('uses singular words for one', () => {
    expect(summary(511)).toBe('Fit 1 fixture · 1 address left starting at 512');
  });

  it('gives a clear message when nothing fits', () => {
    expect(summary(512, 2)).toBe(
      'No fixtures fit · footprint 512 needs more than the 511 left starting at 2',
    );
  });
});
