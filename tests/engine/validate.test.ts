import { describe, expect, it } from 'vitest';
import { hasErrors, validateLayout, validateSimple } from '../../src/engine';
import { simpleLayout } from './helpers';

describe('validateSimple', () => {
  it('accepts valid input', () => {
    expect(validateSimple({ footprint: 19, startAddress: 1 })).toEqual({});
    expect(validateSimple({ footprint: 512, startAddress: 512, quantity: 1 })).toEqual({});
  });

  it.each([0, -1, 1.5, 513, NaN, Infinity])('rejects footprint %s', (footprint) => {
    const errors = validateSimple({ footprint, startAddress: 1 });
    expect(errors.footprint).toBeTruthy();
    expect(errors.startAddress).toBeUndefined();
  });

  it.each([0, -5, 513, 2.5, NaN])('rejects start address %s', (startAddress) => {
    const errors = validateSimple({ footprint: 10, startAddress });
    expect(errors.startAddress).toBeTruthy();
    expect(errors.footprint).toBeUndefined();
  });

  it.each([0, -1, 1.5, NaN])('rejects quantity %s', (quantity) => {
    expect(validateSimple({ footprint: 10, startAddress: 1, quantity }).quantity).toBeTruthy();
  });

  it('reports every bad field at once', () => {
    const errors = validateSimple({ footprint: 0, startAddress: 0, quantity: 0 });
    expect(Object.keys(errors).sort()).toEqual(['footprint', 'quantity', 'startAddress']);
  });
});

describe('validateLayout', () => {
  it('validates simple layouts', () => {
    expect(hasErrors(validateLayout(simpleLayout(10)))).toBe(false);
    expect(hasErrors(validateLayout(simpleLayout(0)))).toBe(true);
  });

  it('requires simple settings in simple mode', () => {
    const layout = simpleLayout(10);
    delete layout.simple;
    expect(validateLayout(layout).footprint).toBeTruthy();
  });
});
