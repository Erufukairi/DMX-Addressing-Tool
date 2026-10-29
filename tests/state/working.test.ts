import { describe, expect, it } from 'vitest';
import {
  checksAutosave,
  continueAddress,
  continueFrom,
  describeLayout,
  detach,
  evaluate,
  hasUnsavedWork,
  initialState,
  isDirty,
  isStoredSimpleLayout,
  layoutForSave,
  markSaved,
  openSaved,
  parseWorkingState,
  reset,
  resetChecks,
  setFootprint,
  setQuantity,
  setStart,
  sortByLastOpened,
  suggestName,
  toggleDone,
  type WorkingState,
} from '../../src/state/working';
import { simpleLayout } from '../engine/helpers';

function state(footprint: string, start = '1', quantity = '', doneUnits: number[] = []): WorkingState {
  return { footprint, start, quantity, doneUnits };
}

const saved = simpleLayout(19, 1, undefined, { id: 'a', name: 'Pipe 1', locationNote: 'Univ 4', updatedAt: 100 });

describe('initial state and evaluate', () => {
  it('starts with a blank footprint and start 1', () => {
    expect(initialState()).toEqual({ footprint: '', start: '1', quantity: '', doneUnits: [] });
  });

  it('treats blank required fields as not entered yet, not errors', () => {
    const ev = evaluate(initialState());
    expect(ev.errors).toEqual({});
    expect(ev.result).toBeNull();
    expect(ev.status).toBe('Enter a footprint');
    expect(evaluate(state('19', '')).status).toBe('Enter a start address');
  });

  it('reports field errors and pluralizes the status', () => {
    expect(evaluate(state('0')).status).toBe('Fix the highlighted field');
    const ev = evaluate(state('0', '600'));
    expect(Object.keys(ev.errors).sort()).toEqual(['footprint', 'startAddress']);
    expect(ev.status).toBe('Fix the highlighted fields');
    expect(ev.result).toBeNull();
  });

  it('computes the result and summary for valid inputs', () => {
    const ev = evaluate(state('19'));
    expect(ev.result?.placed).toHaveLength(26);
    expect(ev.status).toBe('26 units · 18 addr left, next 495');
  });
});

describe('done checks', () => {
  it('toggles a unit on and off, keeping checks sorted', () => {
    let s = toggleDone(state('19'), 5);
    s = toggleDone(s, 2);
    expect(s.doneUnits).toEqual([2, 5]);
    expect(toggleDone(s, 5).doneUnits).toEqual([2]);
  });

  it('clears checks when footprint changes', () => {
    expect(setFootprint(state('19', '1', '', [1, 2]), '20').doneUnits).toEqual([]);
  });

  it('clears checks when start changes', () => {
    expect(setStart(state('19', '1', '', [1, 2]), '10').doneUnits).toEqual([]);
  });

  it('keeps checks when the value is unchanged, e.g. a leading zero', () => {
    expect(setFootprint(state('19', '1', '', [1, 2]), '019').doneUnits).toEqual([1, 2]);
    expect(setStart(state('19', '1', '', [1, 2]), '01').doneUnits).toEqual([1, 2]);
  });

  it('keeps checks for units that still exist when quantity changes', () => {
    const s = setQuantity(state('19', '1', '', [1, 3, 5, 20]), '4');
    expect(s.doneUnits).toEqual([1, 3]);
  });

  it('caps quantity-change pruning at the fit count', () => {
    // Quantity 100 still places only 26.
    expect(setQuantity(state('19', '1', '', [1, 26]), '100').doneUnits).toEqual([1, 26]);
  });

  it('leaves checks alone while the inputs do not validate', () => {
    expect(setQuantity(state('19', '1', '', [1, 20]), '0').doneUnits).toEqual([1, 20]);
  });

  it('resets checks', () => {
    expect(resetChecks(state('19', '1', '', [1, 2])).doneUnits).toEqual([]);
  });
});

describe('reset and continue', () => {
  it('reset returns the defaults and detaches', () => {
    expect(reset()).toEqual(initialState());
  });

  it('continues from the next address with footprint and quantity cleared', () => {
    const s = { ...state('19', '1', '4', [1]), saved };
    expect(continueAddress(s)).toBe(77);
    expect(continueFrom(s)).toEqual({ footprint: '', start: '77', quantity: '', doneUnits: [] });
  });

  it('does not offer continue when the universe is full', () => {
    const full = state('32'); // 16 × 32 = 512
    expect(continueAddress(full)).toBeNull();
    expect(continueFrom(full)).toBe(full);
  });

  it('does not offer continue while inputs are incomplete or invalid', () => {
    expect(continueAddress(initialState())).toBeNull();
    expect(continueAddress(state('0'))).toBeNull();
  });
});

describe('saved layouts', () => {
  it('opens a saved layout into the working state', () => {
    const withQty = simpleLayout(19, 10, 4, { id: 'b', doneUnits: [2] });
    expect(openSaved(withQty)).toEqual({ footprint: '19', start: '10', quantity: '4', doneUnits: [2], saved: withQty });
    expect(openSaved(saved).quantity).toBe('');
  });

  it('is not dirty right after opening', () => {
    expect(isDirty(openSaved(saved))).toBe(false);
  });

  it('is dirty when an input value changes', () => {
    const s = openSaved(saved);
    expect(isDirty(setFootprint(s, '20'))).toBe(true);
    expect(isDirty(setStart(s, '2'))).toBe(true);
    expect(isDirty(setQuantity(s, '3'))).toBe(true);
    expect(isDirty(setFootprint(s, 'abc'))).toBe(true);
  });

  it('compares values, so "019" over "19" is not dirty', () => {
    expect(isDirty(setFootprint(openSaved(saved), '019'))).toBe(false);
  });

  it('does not count checks as unsaved changes', () => {
    expect(isDirty(toggleDone(openSaved(saved), 1))).toBe(false);
  });

  it('autosaves checks only on an open, unmodified saved layout', () => {
    expect(checksAutosave(openSaved(saved))).toBe(true);
    expect(checksAutosave(setFootprint(openSaved(saved), '20'))).toBe(false);
    expect(checksAutosave(state('19'))).toBe(false);
  });

  it('knows when opening another layout would discard work', () => {
    expect(hasUnsavedWork(initialState())).toBe(false);
    expect(hasUnsavedWork(state('19'))).toBe(true);
    expect(hasUnsavedWork(openSaved(saved))).toBe(false);
    expect(hasUnsavedWork(setFootprint(openSaved(saved), '20'))).toBe(true);
  });

  it('reset and continue leave the saved layout untouched and detach from it', () => {
    const s = openSaved(saved);
    expect(reset().saved).toBeUndefined();
    expect(continueFrom(s).saved).toBeUndefined();
    expect(saved).toEqual(simpleLayout(19, 1, undefined, { id: 'a', name: 'Pipe 1', locationNote: 'Univ 4', updatedAt: 100 }));
  });

  it('detaches but keeps the inputs', () => {
    const s = detach(setFootprint(openSaved(saved), '20'));
    expect(s).toEqual({ footprint: '20', start: '1', quantity: '', doneUnits: [] });
  });

  it('builds the layout to save, with trimmed name and note', () => {
    const s = toggleDone(state('19', '1', '4'), 2);
    const layout = layoutForSave(s, { id: 'new', name: ' Pipe 2 ', locationNote: '  ', now: 500 });
    expect(layout).toEqual({
      id: 'new',
      name: 'Pipe 2',
      mode: 'simple',
      startAddress: 1,
      simple: { footprint: 19, quantity: 4 },
      doneUnits: [2],
      updatedAt: 500,
      lastOpenedAt: 500,
      schemaVersion: 1,
    });
    expect(layoutForSave(s, { id: 'n', name: 'x', locationNote: 'Univ 4', now: 1 }).locationNote).toBe('Univ 4');
  });

  it('overwriting clears a removed location note', () => {
    const layout = layoutForSave(openSaved(saved), { id: 'a', name: 'Pipe 1', locationNote: '', now: 1 });
    expect(layout).not.toHaveProperty('locationNote');
  });

  it('is not dirty after a save', () => {
    const s = setFootprint(openSaved(saved), '20');
    const layout = layoutForSave(s, { id: 'a', name: 'Pipe 1', locationNote: '', now: 1 });
    expect(isDirty(markSaved(s, layout))).toBe(false);
  });

  it('suggests a name from the inputs', () => {
    expect(suggestName(state('19', '1'))).toBe('19ch × 26 @ 1');
    expect(suggestName(initialState())).toBe('');
  });

  it('describes a layout for the list', () => {
    expect(describeLayout(saved)).toBe('Footprint 19 · 26 fixtures · start 1');
    expect(describeLayout(simpleLayout(512))).toBe('Footprint 512 · 1 fixture · start 1');
  });

  it('sorts by last opened, falling back to last saved', () => {
    const a = simpleLayout(1, 1, undefined, { id: 'a', updatedAt: 10, lastOpenedAt: 50 });
    const b = simpleLayout(1, 1, undefined, { id: 'b', updatedAt: 40 });
    const c = simpleLayout(1, 1, undefined, { id: 'c', updatedAt: 5, lastOpenedAt: 100 });
    expect(sortByLastOpened([a, b, c]).map((l) => l.id)).toEqual(['c', 'a', 'b']);
  });
});

describe('reading stored data', () => {
  it('accepts a v1 simple layout, with or without optional fields', () => {
    expect(isStoredSimpleLayout(saved)).toBe(true);
    expect(isStoredSimpleLayout(simpleLayout(19, 1, 4, { lastOpenedAt: 3 }))).toBe(true);
  });

  it('rejects records it cannot read', () => {
    expect(isStoredSimpleLayout(null)).toBe(false);
    expect(isStoredSimpleLayout('x')).toBe(false);
    expect(isStoredSimpleLayout({ ...saved, schemaVersion: 2 })).toBe(false);
    expect(isStoredSimpleLayout({ ...saved, mode: 'advanced' })).toBe(false);
    expect(isStoredSimpleLayout({ ...saved, simple: undefined })).toBe(false);
    expect(isStoredSimpleLayout({ ...saved, doneUnits: ['1'] })).toBe(false);
    expect(isStoredSimpleLayout({ ...saved, locationNote: 4 })).toBe(false);
  });

  it('round-trips a working state through JSON', () => {
    const s = toggleDone(openSaved(saved), 3);
    expect(parseWorkingState(JSON.parse(JSON.stringify(s)))).toEqual(s);
    const unsaved = state('19', '1', '4', [1]);
    expect(parseWorkingState(JSON.parse(JSON.stringify(unsaved)))).toEqual(unsaved);
  });

  it('drops an unreadable saved copy but keeps the inputs', () => {
    expect(parseWorkingState({ ...state('19'), saved: { id: 'x' } })).toEqual(state('19'));
  });

  it('rejects anything that is not a working state', () => {
    expect(parseWorkingState(null)).toBeNull();
    expect(parseWorkingState({ footprint: 19, start: '1', quantity: '', doneUnits: [] })).toBeNull();
    expect(parseWorkingState({ footprint: '19', start: '1', quantity: '' })).toBeNull();
  });
});
