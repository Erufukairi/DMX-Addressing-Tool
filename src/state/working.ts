// The simple-mode working state and every transition on it (phase-3-plan §1).
// Pure: no DOM, storage, or Preact. The UI holds one WorkingState and replaces it through these functions.
import {
  computeLayout,
  formatSummary,
  hasErrors,
  validateLayout,
  type FieldErrors,
  type Layout,
  type LayoutResult,
} from '../engine';

export interface WorkingState {
  // Inputs as typed, so partial typing round-trips.
  footprint: string;
  start: string;
  quantity: string;
  doneUnits: number[];
  /** The stored copy of the open saved layout. Absent for an unsaved working layout. */
  saved?: Layout;
}

export interface Evaluation {
  layout: Layout;
  /** Field errors, leaving out blank required fields: those are "not entered yet". */
  errors: FieldErrors;
  /** Null while a required field is blank or any field has an error. */
  result: LayoutResult | null;
  status: string;
}

export function initialState(): WorkingState {
  return { footprint: '', start: '1', quantity: '', doneUnits: [] };
}

function toNumber(value: string): number | undefined {
  return value.trim() === '' ? undefined : Number(value);
}

/** The Layout the engine and storage see. Name, note, and id come from the open saved layout, if any. */
export function toLayout(state: WorkingState): Layout {
  const fp = toNumber(state.footprint) ?? NaN;
  const qty = toNumber(state.quantity);
  const layout: Layout = {
    id: state.saved?.id ?? 'working',
    name: state.saved?.name ?? '',
    mode: 'simple',
    startAddress: toNumber(state.start) ?? NaN,
    simple: qty === undefined ? { footprint: fp } : { footprint: fp, quantity: qty },
    doneUnits: state.doneUnits,
    updatedAt: state.saved?.updatedAt ?? 0,
    schemaVersion: 1,
  };
  if (state.saved?.locationNote) layout.locationNote = state.saved.locationNote;
  if (state.saved?.lastOpenedAt !== undefined) layout.lastOpenedAt = state.saved.lastOpenedAt;
  return layout;
}

export function evaluate(state: WorkingState): Evaluation {
  const layout = toLayout(state);
  const footprintBlank = toNumber(state.footprint) === undefined;
  const startBlank = toNumber(state.start) === undefined;

  const errors = validateLayout(layout);
  if (footprintBlank) delete errors.footprint;
  if (startBlank) delete errors.startAddress;
  const result = footprintBlank || startBlank || hasErrors(errors) ? null : computeLayout(layout);

  let status: string;
  if (result) status = formatSummary(layout, result);
  else if (hasErrors(errors))
    status = Object.keys(errors).length > 1 ? 'Fix the highlighted fields' : 'Fix the highlighted field';
  else if (footprintBlank) status = 'Enter a footprint';
  else status = 'Enter a start address';

  return { layout, errors, result, status };
}

function sameValue(a: string, b: string): boolean {
  return Object.is(toNumber(a), toNumber(b));
}

// Footprint and start move every unit's address, so their checks no longer apply.
export function setFootprint(state: WorkingState, value: string): WorkingState {
  return { ...state, footprint: value, doneUnits: sameValue(state.footprint, value) ? state.doneUnits : [] };
}

export function setStart(state: WorkingState, value: string): WorkingState {
  return { ...state, start: value, doneUnits: sameValue(state.start, value) ? state.doneUnits : [] };
}

/** Keeps checks for units that still exist. While the inputs don't validate, checks are left alone. */
export function setQuantity(state: WorkingState, value: string): WorkingState {
  const next = { ...state, quantity: value };
  const { result } = evaluate(next);
  if (!result) return next;
  const count = result.placed.length;
  return { ...next, doneUnits: state.doneUnits.filter((u) => u <= count) };
}

export function toggleDone(state: WorkingState, unit: number): WorkingState {
  const doneUnits = state.doneUnits.includes(unit)
    ? state.doneUnits.filter((u) => u !== unit)
    : [...state.doneUnits, unit].sort((a, b) => a - b);
  return { ...state, doneUnits };
}

export function resetChecks(state: WorkingState): WorkingState {
  return { ...state, doneUnits: [] };
}

/** Starts a new unsaved working layout; an open saved layout is left as it was. */
export function reset(): WorkingState {
  return initialState();
}

/** The address Continue starts from, or null when Continue isn't offered. */
export function continueAddress(state: WorkingState): number | null {
  return evaluate(state).result?.nextAddress ?? null;
}

/** Starts a new unsaved working layout at the next free address. */
export function continueFrom(state: WorkingState): WorkingState {
  const next = continueAddress(state);
  if (next === null) return state;
  return { footprint: '', start: String(next), quantity: '', doneUnits: [] };
}

export function openSaved(layout: Layout): WorkingState {
  const simple = layout.simple ?? { footprint: NaN };
  return {
    footprint: Number.isNaN(simple.footprint) ? '' : String(simple.footprint),
    start: String(layout.startAddress),
    quantity: simple.quantity === undefined ? '' : String(simple.quantity),
    doneUnits: [...layout.doneUnits],
    saved: layout,
  };
}

/** After a save: the working state now refers to `layout` and matches it. */
export function markSaved(state: WorkingState, layout: Layout): WorkingState {
  return { ...state, saved: layout };
}

/** Detaches from the open saved layout (e.g. after it was deleted), keeping the inputs. */
export function detach(state: WorkingState): WorkingState {
  const { saved: _saved, ...rest } = state;
  return rest;
}

/** True when the inputs differ from the open saved layout. Values are compared, so "019" equals "19". */
export function isDirty(state: WorkingState): boolean {
  const saved = state.saved;
  if (!saved) return false;
  return (
    !Object.is(toNumber(state.footprint), saved.simple?.footprint) ||
    !Object.is(toNumber(state.start), saved.startAddress) ||
    !Object.is(toNumber(state.quantity), saved.simple?.quantity)
  );
}

/** Done checks on an open, unmodified saved layout are written straight away. */
export function checksAutosave(state: WorkingState): boolean {
  return state.saved !== undefined && !isDirty(state);
}

/** Work that opening another layout would discard. */
export function hasUnsavedWork(state: WorkingState): boolean {
  return state.saved ? isDirty(state) : state.footprint.trim() !== '';
}

/** The Layout to store for a save, under `id` (the open layout's id to overwrite, or a new one). */
export function layoutForSave(
  state: WorkingState,
  fields: { id: string; name: string; locationNote: string; now: number },
): Layout {
  const layout: Layout = {
    ...toLayout(state),
    id: fields.id,
    name: fields.name.trim(),
    updatedAt: fields.now,
    lastOpenedAt: fields.now,
  };
  const note = fields.locationNote.trim();
  if (note) layout.locationNote = note;
  else delete layout.locationNote;
  return layout;
}

/** Default name offered when saving, e.g. "19ch × 26 @ 1". */
export function suggestName(state: WorkingState): string {
  const { result, layout } = evaluate(state);
  if (!result) return '';
  return `${layout.simple!.footprint}ch × ${result.placed.length} @ ${layout.startAddress}`;
}

/** One-line description of a saved layout for the list, e.g. "Footprint 19 · 26 fixtures · start 1". */
export function describeLayout(layout: Layout): string {
  const footprint = layout.simple?.footprint;
  const parts = [`Footprint ${footprint}`];
  try {
    const count = computeLayout(layout).placed.length;
    parts.push(`${count} fixture${count === 1 ? '' : 's'}`);
  } catch {
    // Unreadable inputs: describe what we have.
  }
  parts.push(`start ${layout.startAddress}`);
  return parts.join(' · ');
}

/** Saved list order (design doc §5.4): last opened first; never-opened layouts fall back to last saved. */
export function sortByLastOpened(layouts: Layout[]): Layout[] {
  const key = (l: Layout) => l.lastOpenedAt ?? l.updatedAt;
  return [...layouts].sort((a, b) => key(b) - key(a));
}

/** Stored records that aren't a readable v1 simple layout are skipped. Full import validation is Phase 5. */
export function isStoredSimpleLayout(value: unknown): value is Layout {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  const simple = v.simple as Record<string, unknown> | undefined;
  return (
    v.schemaVersion === 1 &&
    v.mode === 'simple' &&
    typeof v.id === 'string' &&
    typeof v.name === 'string' &&
    typeof v.startAddress === 'number' &&
    typeof v.updatedAt === 'number' &&
    Array.isArray(v.doneUnits) &&
    v.doneUnits.every((u) => typeof u === 'number') &&
    typeof simple === 'object' &&
    simple !== null &&
    typeof simple.footprint === 'number' &&
    (simple.quantity === undefined || typeof simple.quantity === 'number') &&
    (v.locationNote === undefined || typeof v.locationNote === 'string') &&
    (v.lastOpenedAt === undefined || typeof v.lastOpenedAt === 'number')
  );
}

/** Reads a persisted WorkingState back, or null if it isn't one. */
export function parseWorkingState(value: unknown): WorkingState | null {
  if (typeof value !== 'object' || value === null) return null;
  const v = value as Record<string, unknown>;
  if (
    typeof v.footprint !== 'string' ||
    typeof v.start !== 'string' ||
    typeof v.quantity !== 'string' ||
    !Array.isArray(v.doneUnits) ||
    !v.doneUnits.every((u) => typeof u === 'number')
  ) {
    return null;
  }
  const state: WorkingState = {
    footprint: v.footprint,
    start: v.start,
    quantity: v.quantity,
    doneUnits: v.doneUnits as number[],
  };
  if (isStoredSimpleLayout(v.saved)) state.saved = v.saved;
  return state;
}
