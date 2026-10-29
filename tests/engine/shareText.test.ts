import { describe, expect, it } from 'vitest';
import { computeLayout, formatShareText } from '../../src/engine';
import { simpleLayout } from './helpers';

function share(...args: Parameters<typeof simpleLayout>): string {
  const layout = simpleLayout(...args);
  return formatShareText(layout, computeLayout(layout));
}

describe('formatShareText (simple mode)', () => {
  it('lists unit and address without labels, then the next free address', () => {
    expect(share(19, 1, 3, { locationNote: 'Univ 4 - 1st Elec' })).toBe(
      ['Univ 4 - 1st Elec', 'Footprint 19', '1: 1', '2: 20', '3: 39', 'Next free: 58'].join('\n'),
    );
  });

  it('omits a blank location note', () => {
    expect(share(100, 1, 2, { locationNote: '   ' })).toBe(
      ['Footprint 100', '1: 1', '2: 101', 'Next free: 201'].join('\n'),
    );
  });

  it('says the universe is full on exact fill', () => {
    expect(share(256)).toBe(['Footprint 256', '1: 1', '2: 257', 'Universe full'].join('\n'));
  });
});
