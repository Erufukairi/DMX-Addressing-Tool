import { describe, expect, it } from 'vitest';
import {
  activeState,
  initialWorkspace,
  openLayout,
  parseWorkspace,
  switchMode,
  updateActive,
  updateOpen,
  type Workspace,
} from '../../src/state/workspace';
import {
  detach,
  evaluate,
  initialFor,
  setBlockField,
  setFootprint,
  setStart,
  toggleDone,
  type DraftBlock,
} from '../../src/state/working';
import { advancedLayout, block, pattern, simpleLayout } from '../engine/helpers';

const savedSimple = simpleLayout(19, 1, undefined, { id: 'a', name: 'Pipe 1', updatedAt: 100 });
const savedAdv = advancedLayout([pattern('p', 8, block('s', 19, 1, 'Spot'), block('w', 14, 1, 'Wash'))], 50, {
  id: 'b',
  name: 'Pipe 2',
  updatedAt: 200,
});

function withSimple(footprint: string, start = '1', quantity = ''): Workspace {
  return updateActive(initialWorkspace(), (s) => ({ ...s, footprint, start, quantity }));
}

describe('workspace', () => {
  it('starts in simple mode with both modes empty', () => {
    const ws = initialWorkspace();
    expect(ws.active).toBe('simple');
    expect(ws.simple).toEqual(initialFor('simple'));
    expect(ws.advanced).toEqual(initialFor('advanced'));
  });

  it('applies changes to the active mode only', () => {
    const ws = updateActive(switchMode(initialWorkspace(), 'advanced'), (s) => setStart(s, '100'));
    expect(ws.advanced.start).toBe('100');
    expect(ws.simple.start).toBe('1');
  });

  it('seeds advanced from the simple inputs and start on the first switch only', () => {
    let ws = switchMode(withSimple('19', '10', '4'), 'advanced');
    expect(ws.active).toBe('advanced');
    expect(ws.advanced.seeded).toBe(true);
    expect(ws.advanced.start).toBe('10');
    expect(ws.advanced.sequence).toEqual([
      { kind: 'block', id: expect.any(String), label: '', footprint: '19', quantity: '4' },
    ]);
    expect(evaluate(activeState(ws)).result?.placed).toHaveLength(4);

    ws = switchMode(ws, 'simple');
    ws = updateActive(ws, (s) => setFootprint(s, '30'));
    ws = switchMode(ws, 'advanced');
    expect((ws.advanced.sequence[0] as DraftBlock).footprint).toBe('19');
  });

  it('keeps each mode’s inputs, start, and checks across switches', () => {
    let ws = withSimple('19', '5');
    ws = updateActive(ws, (s) => toggleDone(s, 2));
    ws = switchMode(ws, 'advanced');
    ws = updateActive(ws, (s) => setBlockField(setStart(s, '200'), s.sequence[0]!.id, 'footprint', '20'));
    ws = switchMode(ws, 'simple');
    expect([ws.simple.footprint, ws.simple.start, ws.simple.doneUnits]).toEqual(['19', '5', [2]]);
    ws = switchMode(ws, 'advanced');
    expect(ws.advanced.start).toBe('200');
    expect((ws.advanced.sequence[0] as DraftBlock).footprint).toBe('20');
  });

  it('does nothing when switching to the active mode', () => {
    const ws = initialWorkspace();
    expect(switchMode(ws, 'simple')).toBe(ws);
  });

  it('opens a layout into its own mode and leaves the other untouched', () => {
    let ws = switchMode(withSimple('19', '7'), 'advanced');
    const advancedBefore = ws.advanced;
    ws = switchMode(ws, 'simple');
    ws = openLayout(ws, savedAdv);
    expect(ws.active).toBe('advanced');
    expect(ws.advanced.saved).toBe(savedAdv);
    expect(ws.advanced.start).toBe('50');
    expect(ws.simple).toEqual({ ...initialFor('simple'), footprint: '19', start: '7' });
    ws = openLayout(ws, savedSimple);
    expect(ws.active).toBe('simple');
    expect(ws.simple.saved).toBe(savedSimple);
    expect(ws.advanced.saved).toBe(savedAdv);
    expect(advancedBefore.saved).toBeUndefined();
  });

  it('applies a change to whichever mode has a layout open', () => {
    let ws = openLayout(openLayout(initialWorkspace(), savedAdv), savedSimple);
    ws = updateOpen(ws, 'b', detach);
    expect(ws.advanced.saved).toBeUndefined();
    expect(ws.simple.saved).toBe(savedSimple);
    expect(updateOpen(ws, 'nope', detach)).toBe(ws);
  });
});

describe('parseWorkspace', () => {
  it('round-trips through JSON', () => {
    let ws = openLayout(switchMode(withSimple('19'), 'advanced'), savedSimple);
    ws = updateActive(ws, (s) => toggleDone(s, 3));
    expect(parseWorkspace(JSON.parse(JSON.stringify(ws)))).toEqual(ws);
  });

  it('converts the first Phase 4 build’s single state (v2), splitting the shared start', () => {
    const v2 = {
      mode: 'advanced',
      start: '40',
      footprint: '19',
      quantity: '4',
      sequence: [{ kind: 'block', id: 'x', label: 'Spot', footprint: '10', quantity: '2' }],
      seeded: true,
      doneUnits: [1],
      saved: savedAdv,
    };
    expect(parseWorkspace(JSON.parse(JSON.stringify(v2)))).toEqual({
      active: 'advanced',
      simple: { ...initialFor('simple'), start: '40', footprint: '19', quantity: '4' },
      advanced: { ...initialFor('advanced'), start: '40', sequence: v2.sequence, seeded: true, doneUnits: [1], saved: savedAdv },
    });
  });

  it('converts Phase 3’s state (v1) into the simple mode', () => {
    const v1 = { footprint: '24', start: '5', quantity: '', doneUnits: [1, 2], saved: savedSimple };
    expect(parseWorkspace(JSON.parse(JSON.stringify(v1)))).toEqual({
      active: 'simple',
      simple: { ...initialFor('simple'), footprint: '24', start: '5', doneUnits: [1, 2], saved: savedSimple },
      advanced: { ...initialFor('advanced'), start: '5' },
    });
  });

  it('keeps an open layout only in the mode it belongs to', () => {
    const v2 = { ...initialFor('simple'), footprint: '19', saved: savedAdv };
    const ws = parseWorkspace(JSON.parse(JSON.stringify(v2)));
    expect(ws?.simple.saved).toBeUndefined();
    expect(ws?.advanced.saved).toBeUndefined();
  });

  it('rejects anything that is not a workspace', () => {
    expect(parseWorkspace(null)).toBeNull();
    expect(parseWorkspace({ active: 'simple', simple: initialFor('simple') })).toBeNull();
    expect(parseWorkspace({ active: 'other', simple: initialFor('simple'), advanced: initialFor('advanced') })).toBeNull();
    expect(parseWorkspace({ active: 'simple', simple: initialFor('advanced'), advanced: initialFor('advanced') })).toBeNull();
  });
});
