import { describe, expect, it } from 'vitest';
import {
  addBlock,
  addPattern,
  blockColors,
  checksAutosave,
  continueAddress,
  continueFrom,
  describeLayout,
  describeSequence,
  detach,
  duplicateItem,
  evaluate,
  hasUnsavedWork,
  initialState,
  isDirty,
  isStoredLayout,
  layoutForSave,
  markSaved,
  moveItem,
  openSaved,
  parseWorkingState,
  removeItem,
  reset,
  resetChecks,
  setBlockField,
  setFootprint,
  setQuantity,
  setRepeat,
  setStart,
  sortByLastOpened,
  suggestName,
  toSequence,
  toggleDone,
  type DraftBlock,
  type DraftItem,
  type DraftPattern,
  type WorkingState,
} from '../../src/state/working';
import { advancedLayout, block, pattern, simpleLayout } from '../engine/helpers';

function state(footprint: string, start = '1', quantity = '', doneUnits: number[] = []): WorkingState {
  return { ...initialState(), footprint, start, quantity, doneUnits };
}

function db(id: string, footprint: string, quantity: string, label = ''): DraftBlock {
  return { kind: 'block', id, label, footprint, quantity };
}

function dp(id: string, repeat: string, ...blocks: DraftBlock[]): DraftPattern {
  return { kind: 'pattern', id, repeat, blocks };
}

function adv(sequence: DraftItem[], start = '1', doneUnits: number[] = []): WorkingState {
  return { ...initialState(), mode: 'advanced', seeded: true, start, sequence, doneUnits };
}

const spotWash = () => adv([dp('p', '8', db('s', '19', '1', 'Spot'), db('w', '14', '1', 'Wash'))]);
const ids = (items: DraftItem[]) => items.map((d) => (d.kind === 'block' ? d.id : [d.id, d.blocks.map((b) => b.id)]));

const saved = simpleLayout(19, 1, undefined, { id: 'a', name: 'Pipe 1', locationNote: 'Univ 4', updatedAt: 100 });

describe('initial state and evaluate (simple)', () => {
  it('starts in simple mode with a blank footprint and start 1', () => {
    expect(initialState()).toEqual({
      mode: 'simple',
      start: '1',
      footprint: '',
      quantity: '',
      sequence: [],
      seeded: false,
      doneUnits: [],
    });
  });

  it('treats blank required fields as not entered yet, not errors', () => {
    const ev = evaluate(initialState());
    expect(ev.errors).toEqual({});
    expect(ev.result).toBeNull();
    expect(ev.summary).toBeNull();
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
    expect(ev.summary).toEqual({ units: '26 units', short: false, addresses: '18 addr left', nextAddress: 495 });
    expect(ev.status).toBeNull();
  });
});

describe('evaluate (advanced)', () => {
  it('computes an interleaved pattern with label counts', () => {
    const ev = evaluate(spotWash());
    expect(ev.result?.placed).toHaveLength(16);
    expect(ev.summary?.labels).toBe('8 Spot, 8 Wash');
  });

  it('treats blank item fields as not entered yet', () => {
    const ev = evaluate(adv([db('a', '', ''), dp('p', '', db('b', '10', ''))]));
    expect(ev.errors).toEqual({});
    expect(ev.result).toBeNull();
    expect(ev.status).toBe('Finish the sequence');
  });

  it('reports invalid item fields keyed by id, keeping other fields of the same item', () => {
    const ev = evaluate(adv([db('a', '0', ''), dp('p', '0', db('b', '10', '1'))]));
    expect(ev.errors.items).toEqual({
      a: { footprint: expect.any(String) },
      p: { repeat: expect.any(String) },
    });
    expect(ev.status).toBe('Fix the sequence');
  });

  it('reports an empty sequence', () => {
    expect(evaluate(adv([])).status).toBe('Fix the sequence');
  });

  it('asks for the start address before the sequence', () => {
    expect(evaluate(adv([db('a', '10', '1')], '')).status).toBe('Enter a start address');
  });

  it('flags a start error on the start field', () => {
    const ev = evaluate(adv([db('a', '10', '1')], '0'));
    expect(ev.errors.startAddress).toBeTruthy();
    expect(ev.status).toBe('Fix the highlighted field');
  });
});

describe('sequence editing', () => {
  it('sets block fields, inside patterns too', () => {
    let s = setBlockField(spotWash(), 'w', 'label', 'Beam');
    s = setBlockField(s, 'w', 'footprint', '16');
    expect((s.sequence[0] as DraftPattern).blocks[1]).toEqual(db('w', '16', '1', 'Beam'));
  });

  it('sets a pattern repeat', () => {
    expect((setRepeat(spotWash(), 'p', '3').sequence[0] as DraftPattern).repeat).toBe('3');
  });

  it('adds a block at the end or inside a pattern, and a pattern with two blocks', () => {
    let s = addBlock(spotWash());
    expect(s.sequence).toHaveLength(2);
    expect(s.sequence[1]).toMatchObject({ kind: 'block', footprint: '', quantity: '' });
    s = addBlock(s, 'p');
    expect((s.sequence[0] as DraftPattern).blocks).toHaveLength(3);
    s = addPattern(s);
    expect(s.sequence[2]).toMatchObject({ kind: 'pattern', repeat: '', blocks: [{}, {}] });
  });

  it('removes an item at either level', () => {
    const s = adv([db('a', '1', '1'), dp('p', '2', db('b', '1', '1'), db('c', '1', '1'))]);
    expect(ids(removeItem(s, 'a').sequence)).toEqual([['p', ['b', 'c']]]);
    expect(ids(removeItem(s, 'c').sequence)).toEqual(['a', ['p', ['b']]]);
    expect(ids(removeItem(s, 'p').sequence)).toEqual(['a']);
  });

  it('moves items up and down within their own list, stopping at the ends', () => {
    const s = adv([db('a', '1', '1'), dp('p', '2', db('b', '1', '1'), db('c', '1', '1')), db('d', '1', '1')]);
    expect(ids(moveItem(s, 'd', -1).sequence)).toEqual(['a', 'd', ['p', ['b', 'c']]]);
    expect(ids(moveItem(s, 'a', -1).sequence)).toEqual(ids(s.sequence));
    expect(ids(moveItem(s, 'b', 1).sequence)).toEqual(['a', ['p', ['c', 'b']], 'd']);
    expect(ids(moveItem(s, 'c', 1).sequence)).toEqual(ids(s.sequence));
  });

  it('duplicates an item right after itself with new ids', () => {
    const s = adv([dp('p', '2', db('b', '5', '1', 'Spot')), db('d', '1', '1')]);
    const pat = duplicateItem(s, 'p').sequence;
    expect(pat).toHaveLength(3);
    const copy = pat[1] as DraftPattern;
    expect(copy.id).not.toBe('p');
    expect(copy.blocks[0]!.id).not.toBe('b');
    expect(copy.blocks[0]).toMatchObject({ label: 'Spot', footprint: '5', quantity: '1' });
    const inner = duplicateItem(s, 'b').sequence[0] as DraftPattern;
    expect(inner.blocks).toHaveLength(2);
  });

  it('clears checks on any change that can move addresses', () => {
    const s = { ...spotWash(), doneUnits: [1, 2] };
    expect(setBlockField(s, 's', 'footprint', '20').doneUnits).toEqual([]);
    expect(setBlockField(s, 's', 'quantity', '2').doneUnits).toEqual([]);
    expect(setRepeat(s, 'p', '9').doneUnits).toEqual([]);
    expect(setStart(s, '2').doneUnits).toEqual([]);
    expect(addBlock(s).doneUnits).toEqual([]);
    expect(addPattern(s).doneUnits).toEqual([]);
    expect(removeItem(s, 'w').doneUnits).toEqual([]);
    expect(moveItem(s, 'w', -1).doneUnits).toEqual([]);
    expect(duplicateItem(s, 'w').doneUnits).toEqual([]);
  });

  it('keeps checks for label edits and value-preserving edits', () => {
    const s = { ...spotWash(), doneUnits: [1, 2] };
    expect(setBlockField(s, 's', 'label', 'Beam').doneUnits).toEqual([1, 2]);
    expect(setBlockField(s, 's', 'footprint', '019').doneUnits).toEqual([1, 2]);
    expect(setRepeat(s, 'p', '08').doneUnits).toEqual([1, 2]);
  });
});

describe('done checks (simple)', () => {
  it('toggles a unit on and off, keeping checks sorted', () => {
    let s = toggleDone(state('19'), 5);
    s = toggleDone(s, 2);
    expect(s.doneUnits).toEqual([2, 5]);
    expect(toggleDone(s, 5).doneUnits).toEqual([2]);
  });

  it('clears checks when footprint or start changes', () => {
    expect(setFootprint(state('19', '1', '', [1, 2]), '20').doneUnits).toEqual([]);
    expect(setStart(state('19', '1', '', [1, 2]), '10').doneUnits).toEqual([]);
  });

  it('keeps checks when the value is unchanged, e.g. a leading zero', () => {
    expect(setFootprint(state('19', '1', '', [1, 2]), '019').doneUnits).toEqual([1, 2]);
    expect(setStart(state('19', '1', '', [1, 2]), '01').doneUnits).toEqual([1, 2]);
  });

  it('keeps checks for units that still exist when quantity changes', () => {
    expect(setQuantity(state('19', '1', '', [1, 3, 5, 20]), '4').doneUnits).toEqual([1, 3]);
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
  it('simple reset clears the simple inputs and keeps the advanced sequence', () => {
    const s = { ...state('19', '50', '4', [1]), sequence: spotWash().sequence, seeded: true, saved };
    expect(reset(s)).toEqual({ ...initialState(), sequence: s.sequence, seeded: true });
  });

  it('advanced reset leaves one empty block and keeps the simple inputs', () => {
    const s = { ...spotWash(), footprint: '19', start: '50', doneUnits: [1] };
    const r = reset(s);
    expect(r.start).toBe('1');
    expect(r.footprint).toBe('19');
    expect(r.sequence).toEqual([{ kind: 'block', id: expect.any(String), label: '', footprint: '', quantity: '' }]);
    expect(r.doneUnits).toEqual([]);
  });

  it('continues from the next address with the active inputs cleared', () => {
    const s = { ...state('19', '1', '4', [1]), saved };
    expect(continueAddress(s)).toBe(77);
    expect(continueFrom(s)).toEqual({ ...initialState(), start: '77' });
  });

  it('continues an advanced layout with one empty block', () => {
    const c = continueFrom(spotWash());
    expect(c.start).toBe('265');
    expect(c.sequence).toHaveLength(1);
    expect(c.mode).toBe('advanced');
  });

  it('does not offer continue when full, when nothing fits, or while incomplete', () => {
    const full = state('32');
    expect(continueAddress(full)).toBeNull();
    expect(continueFrom(full)).toBe(full);
    expect(continueAddress(state('512', '2'))).toBeNull();
    expect(continueAddress(initialState())).toBeNull();
    expect(continueAddress(state('0'))).toBeNull();
  });
});

describe('saved layouts', () => {
  const savedAdv = advancedLayout([pattern('p', 8, block('s', 19, 1, 'Spot'), block('w', 14, 1, 'Wash'))], 1, {
    id: 'b',
    name: 'Pipe 2',
    updatedAt: 200,
  });

  it('opens a simple layout', () => {
    const withQty = simpleLayout(19, 10, 4, { id: 'b', doneUnits: [2] });
    expect(openSaved(withQty)).toEqual({
      mode: 'simple',
      start: '10',
      footprint: '19',
      quantity: '4',
      sequence: [],
      seeded: false,
      doneUnits: [2],
      saved: withQty,
    });
    expect(openSaved(saved).quantity).toBe('');
  });

  it('opens an advanced layout and round-trips its sequence', () => {
    const s = openSaved(savedAdv);
    expect(s.mode).toBe('advanced');
    expect(s.seeded).toBe(true);
    expect(toSequence(s.sequence)).toEqual(savedAdv.sequence);
    expect(s.footprint).toBe('');
  });

  it('is not dirty right after opening, in either mode', () => {
    expect(isDirty(openSaved(saved))).toBe(false);
    expect(isDirty(openSaved(savedAdv))).toBe(false);
  });

  it('is dirty when an input value changes', () => {
    const s = openSaved(saved);
    expect(isDirty(setFootprint(s, '20'))).toBe(true);
    expect(isDirty(setStart(s, '2'))).toBe(true);
    expect(isDirty(setQuantity(s, '3'))).toBe(true);
    expect(isDirty(setFootprint(s, 'abc'))).toBe(true);
  });

  it('is dirty when the sequence changes', () => {
    const s = openSaved(savedAdv);
    expect(isDirty(setRepeat(s, 'p', '9'))).toBe(true);
    expect(isDirty(setBlockField(s, 's', 'label', 'Beam'))).toBe(true);
    expect(isDirty(addBlock(s))).toBe(true);
    expect(isDirty(setStart(s, '2'))).toBe(true);
  });

  it('compares values, so "019" over "19" is not dirty', () => {
    expect(isDirty(setFootprint(openSaved(saved), '019'))).toBe(false);
    expect(isDirty(setBlockField(openSaved(savedAdv), 's', 'footprint', '019'))).toBe(false);
    expect(isDirty(setBlockField(openSaved(savedAdv), 's', 'label', 'Spot '))).toBe(false);
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
    expect(hasUnsavedWork(adv([db('a', '', '')]))).toBe(false);
    expect(hasUnsavedWork(adv([db('a', '', '', 'Spot')]))).toBe(true);
  });

  it('reset and continue detach from the saved layout and leave it untouched', () => {
    const s = openSaved(saved);
    expect(reset(s).saved).toBeUndefined();
    expect(continueFrom(s).saved).toBeUndefined();
    expect(saved).toEqual(simpleLayout(19, 1, undefined, { id: 'a', name: 'Pipe 1', locationNote: 'Univ 4', updatedAt: 100 }));
  });

  it('detaches but keeps the inputs', () => {
    expect(detach(setFootprint(openSaved(saved), '20'))).toEqual({
      ...initialState(),
      footprint: '20',
    });
  });

  it('builds a simple layout to save, with trimmed name and note', () => {
    const s = toggleDone(state('19', '1', '4'), 2);
    expect(layoutForSave(s, { id: 'new', name: ' Pipe 2 ', locationNote: '  ', now: 500 })).toEqual({
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

  it('saves only its own mode’s inputs', () => {
    const fromAdv = layoutForSave({ ...spotWash(), footprint: '19' }, { id: 'n', name: 'x', locationNote: '', now: 1 });
    expect(fromAdv.mode).toBe('advanced');
    expect(fromAdv).not.toHaveProperty('simple');
    expect(fromAdv.sequence).toEqual(toSequence(spotWash().sequence));
    const fromSimple = layoutForSave({ ...state('19'), sequence: spotWash().sequence }, { id: 'n', name: 'x', locationNote: '', now: 1 });
    expect(fromSimple).not.toHaveProperty('sequence');
    expect(isStoredLayout(fromAdv)).toBe(true);
    expect(isStoredLayout(fromSimple)).toBe(true);
  });

  it('opens only its own mode’s inputs, ignoring the other mode in older saves', () => {
    const olderSave = { ...savedAdv, simple: { footprint: 19, quantity: 4 } };
    const opened = openSaved(olderSave);
    expect(opened.mode).toBe('advanced');
    expect([opened.footprint, opened.quantity]).toEqual(['', '']);
    expect(toSequence(opened.sequence)).toEqual(savedAdv.sequence);
    expect(isDirty(opened)).toBe(false);
    const olderSimple = openSaved({ ...saved, sequence: savedAdv.sequence! });
    expect(olderSimple.sequence).toEqual([]);
  });

  it('overwriting clears a removed location note', () => {
    const layout = layoutForSave(openSaved(saved), { id: 'a', name: 'Pipe 1', locationNote: '', now: 1 });
    expect(layout).not.toHaveProperty('locationNote');
  });

  it('is not dirty after a save', () => {
    const s = setFootprint(openSaved(saved), '20');
    expect(isDirty(markSaved(s, layoutForSave(s, { id: 'a', name: 'Pipe 1', locationNote: '', now: 1 })))).toBe(false);
    const a = addBlock(openSaved(savedAdv));
    const filled = setBlockField(setBlockField(a, a.sequence[1]!.id, 'footprint', '5'), a.sequence[1]!.id, 'quantity', '1');
    expect(isDirty(markSaved(filled, layoutForSave(filled, { id: 'b', name: 'x', locationNote: '', now: 1 })))).toBe(false);
  });

  it('suggests a name from the inputs', () => {
    expect(suggestName(state('19', '1'))).toBe('19ch × 26 @ 1');
    expect(suggestName(spotWash())).toBe('Spot/Wash × 16 @ 1');
    expect(suggestName(adv([db('a', '10', '3')]))).toBe('Mixed × 3 @ 1');
    expect(suggestName(initialState())).toBe('');
  });

  it('describes a layout for the list', () => {
    expect(describeLayout(saved)).toBe('Footprint 19 · 26 units · start 1');
    expect(describeLayout(simpleLayout(512))).toBe('Footprint 512 · 1 unit · start 1');
    expect(describeLayout(savedAdv)).toBe('[Spot 19, Wash 14] ×8 · 16 units · start 1');
  });

  it('sorts by last opened, falling back to last saved', () => {
    const a = simpleLayout(1, 1, undefined, { id: 'a', updatedAt: 10, lastOpenedAt: 50 });
    const b = simpleLayout(1, 1, undefined, { id: 'b', updatedAt: 40 });
    const c = simpleLayout(1, 1, undefined, { id: 'c', updatedAt: 5, lastOpenedAt: 100 });
    expect(sortByLastOpened([a, b, c]).map((l) => l.id)).toEqual(['c', 'a', 'b']);
  });
});

describe('descriptions and colors', () => {
  it('describes a sequence, showing unfinished numbers as "?"', () => {
    expect(describeSequence(toSequence(spotWash().sequence))).toBe('[Spot 19, Wash 14] ×8');
    expect(describeSequence(toSequence([db('a', '10', '3'), db('b', '', '1', 'Spot'), dp('p', '', db('c', '5', '2'))]))).toBe(
      '10 ×3, Spot ?, [5 ×2] ×?',
    );
  });

  it('colors blocks by label, unlabeled blocks each on their own, cycling after 6', () => {
    const seq = toSequence([
      dp('p', '2', db('s1', '1', '1', 'Spot'), db('w1', '1', '1', 'Wash')),
      db('s2', '1', '1', 'Spot'),
      db('u1', '1', '1'),
      db('u2', '1', '1'),
      db('x', '1', '1', 'X'),
      db('y', '1', '1', 'Y'),
      db('z', '1', '1', 'Z'),
    ]);
    expect(Object.fromEntries(blockColors(seq))).toEqual({ s1: 1, w1: 2, s2: 1, u1: 3, u2: 4, x: 5, y: 6, z: 1 });
  });
});

describe('reading stored data', () => {
  it('accepts v1 simple and advanced layouts, with or without optional fields', () => {
    expect(isStoredLayout(saved)).toBe(true);
    expect(isStoredLayout(simpleLayout(19, 1, 4, { lastOpenedAt: 3 }))).toBe(true);
    expect(isStoredLayout(advancedLayout([block('a', 10, 1), pattern('p', 2, block('b', 5, 1, 'Spot'))]))).toBe(true);
  });

  it('rejects records it cannot read', () => {
    expect(isStoredLayout(null)).toBe(false);
    expect(isStoredLayout('x')).toBe(false);
    expect(isStoredLayout({ ...saved, schemaVersion: 2 })).toBe(false);
    expect(isStoredLayout({ ...saved, mode: 'other' })).toBe(false);
    expect(isStoredLayout({ ...saved, simple: undefined })).toBe(false);
    expect(isStoredLayout({ ...saved, mode: 'advanced' })).toBe(false);
    expect(isStoredLayout({ ...saved, doneUnits: ['1'] })).toBe(false);
    expect(isStoredLayout({ ...saved, locationNote: 4 })).toBe(false);
    expect(isStoredLayout(advancedLayout([{ id: 'a', footprint: '10', quantity: 1 } as never]))).toBe(false);
    expect(isStoredLayout(advancedLayout([{ id: 'p', repeat: 2, blocks: [{ id: 'b' }] } as never]))).toBe(false);
  });

  it('round-trips a working state through JSON, in both modes', () => {
    const s = toggleDone(openSaved(saved), 3);
    expect(parseWorkingState(JSON.parse(JSON.stringify(s)))).toEqual(s);
    const a = { ...spotWash(), footprint: '19', doneUnits: [1] };
    expect(parseWorkingState(JSON.parse(JSON.stringify(a)))).toEqual(a);
  });

  it('converts the Phase 3 (v1) working state, keeping inputs, checks, and the open layout', () => {
    const v1 = { footprint: '19', start: '5', quantity: '4', doneUnits: [1, 2], saved };
    expect(parseWorkingState(JSON.parse(JSON.stringify(v1)))).toEqual({
      mode: 'simple',
      start: '5',
      footprint: '19',
      quantity: '4',
      sequence: [],
      seeded: false,
      doneUnits: [1, 2],
      saved,
    });
  });

  it('drops an unreadable saved copy but keeps the inputs', () => {
    expect(parseWorkingState({ ...state('19'), saved: { id: 'x' } })).toEqual(state('19'));
  });

  it('rejects anything that is not a working state', () => {
    expect(parseWorkingState(null)).toBeNull();
    expect(parseWorkingState({ footprint: 19, start: '1', quantity: '', doneUnits: [] })).toBeNull();
    expect(parseWorkingState({ footprint: '19', start: '1', quantity: '' })).toBeNull();
    expect(parseWorkingState({ ...initialState(), mode: 'other' })).toBeNull();
    expect(parseWorkingState({ ...initialState(), mode: 'advanced', sequence: [{ kind: 'block' }] })).toBeNull();
  });
});
