import { describe, expect, it } from 'vitest';
import { computeLayout, formatSummary } from '../../src/engine';
import { simpleLayout } from './helpers';

function summary(footprint: number, start = 1, quantity?: number): string {
  const layout = simpleLayout(footprint, start, quantity);
  return formatSummary(layout, computeLayout(layout));
}

describe('formatSummary', () => {
  it('reports units placed, addresses left, and the next address', () => {
    expect(summary(24)).toBe('21 units · 8 addr left, next 505');
  });

  it('reports a full universe', () => {
    expect(summary(16)).toBe('32 units · universe full');
  });

  it('reports a shortfall when a quantity was entered', () => {
    expect(summary(24, 1, 24)).toBe("21 of 24 units · 3 didn't fit · 8 addr left, next 505");
  });

  it('reports a shortfall with a full universe', () => {
    expect(summary(16, 1, 40)).toBe("32 of 40 units · 8 didn't fit · universe full");
  });

  it('uses the singular for one unit', () => {
    expect(summary(511)).toBe('1 unit · 1 addr left, next 512');
  });

  it('gives a clear message when nothing fits', () => {
    expect(summary(512, 2)).toBe('No units fit · 511 addr left from 2');
  });
});
