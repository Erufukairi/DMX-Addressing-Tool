// Simple and advanced mode as two independent workspaces, like two tabs (phase-4-plan, "As built").
// Each has its own start, inputs, checks, and open saved layout; switching never changes the other.
// Pure: no DOM, storage, or Preact.
import type { Layout } from '../engine';
import { emptyBlock, initialFor, openSaved, parseWorkingState, type Mode, type WorkingState } from './working';

export interface Workspace {
  active: Mode;
  simple: WorkingState;
  advanced: WorkingState;
}

export function initialWorkspace(): Workspace {
  return { active: 'simple', simple: initialFor('simple'), advanced: initialFor('advanced') };
}

export function activeState(ws: Workspace): WorkingState {
  return ws[ws.active];
}

/** Applies a WorkingState transition to the active mode only. */
export function updateActive(ws: Workspace, change: (s: WorkingState) => WorkingState): Workspace {
  return { ...ws, [ws.active]: change(ws[ws.active]) };
}

/** The first switch to advanced seeds its first block, and its start, from the simple inputs. */
export function switchMode(ws: Workspace, mode: Mode): Workspace {
  if (mode === ws.active) return ws;
  const next = { ...ws, active: mode };
  if (mode === 'advanced' && !ws.advanced.seeded) {
    const { footprint, quantity, start } = ws.simple;
    next.advanced = { ...ws.advanced, start, seeded: true, sequence: [{ ...emptyBlock(), footprint, quantity }] };
  }
  return next;
}

/** Opens a saved layout into its own mode and switches to it. The other mode is untouched. */
export function openLayout(ws: Workspace, layout: Layout): Workspace {
  return { ...ws, active: layout.mode, [layout.mode]: openSaved(layout) };
}

/** Applies `change` to whichever mode has `id` open (e.g. after a delete). */
export function updateOpen(ws: Workspace, id: string, change: (s: WorkingState) => WorkingState): Workspace {
  let next = ws;
  for (const mode of ['simple', 'advanced'] as const) {
    if (ws[mode].saved?.id === id) next = { ...next, [mode]: change(ws[mode]) };
  }
  return next;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Reads a persisted Workspace back, or null. Also reads the single WorkingState that earlier builds
 * stored (Phase 3's v1 and the first Phase 4 build's v2), so an update keeps work in progress:
 * its active mode's inputs, checks, and open layout go to that mode; the other mode keeps its inputs.
 */
export function parseWorkspace(value: unknown): Workspace | null {
  if (!isRecord(value)) return null;
  if ('active' in value) {
    const simple = parseWorkingState(value.simple);
    const advanced = parseWorkingState(value.advanced);
    if ((value.active !== 'simple' && value.active !== 'advanced') || !simple || !advanced) return null;
    if (simple.mode !== 'simple' || advanced.mode !== 'advanced') return null;
    return { active: value.active, simple, advanced };
  }

  const old = parseWorkingState(value);
  if (!old) return null;
  const { saved, doneUnits, ...inputs } = old;
  const keep = (mode: Mode): Partial<WorkingState> =>
    mode === old.mode ? { doneUnits, ...(saved && saved.mode === mode ? { saved } : {}) } : { doneUnits: [] };
  return {
    active: old.mode,
    simple: { ...inputs, mode: 'simple', sequence: [], seeded: false, doneUnits: [], ...keep('simple') },
    advanced: { ...inputs, mode: 'advanced', footprint: '', quantity: '', doneUnits: [], ...keep('advanced') },
  };
}
