// The working state and every transition on it (phase-3-plan §1, phase-4-plan §3).
// Pure: no DOM, storage, or Preact. The UI holds one WorkingState and replaces it through these functions.
import {
  computeLayout,
  hasErrors,
  isPattern,
  summarize,
  validateLayout,
  type Block,
  type ItemErrors,
  type Layout,
  type LayoutErrors,
  type LayoutResult,
  type SequenceItem,
  type Summary,
} from '../engine';
import { newId } from './ids';

export type Mode = Layout['mode'];

// Advanced-mode items as typed, so partial typing round-trips, like the simple inputs.
export interface DraftBlock {
  kind: 'block';
  id: string;
  label: string;
  footprint: string;
  quantity: string;
}

export interface DraftPattern {
  kind: 'pattern';
  id: string;
  repeat: string;
  blocks: DraftBlock[];
}

export type DraftItem = DraftBlock | DraftPattern;

export interface WorkingState {
  mode: Mode;
  /** Shared by both modes: the same position in the universe. */
  start: string;
  // Simple mode.
  footprint: string;
  quantity: string;
  // Advanced mode.
  sequence: DraftItem[];
  /** Advanced mode has been opened, so its first block was seeded from the simple inputs. */
  seeded: boolean;
  doneUnits: number[];
  /** The stored copy of the open saved layout. Absent for an unsaved working layout. */
  saved?: Layout;
}

export interface Evaluation {
  layout: Layout;
  /** Errors, leaving out blank required fields: those are "not entered yet". */
  errors: LayoutErrors;
  /** Null while a required field is blank or any field has an error. */
  result: LayoutResult | null;
  summary: Summary | null;
  /** Why there is no result; null when there is one. */
  status: string | null;
}

export function initialState(): WorkingState {
  return { mode: 'simple', start: '1', footprint: '', quantity: '', sequence: [], seeded: false, doneUnits: [] };
}

function toNumber(value: string): number | undefined {
  return value.trim() === '' ? undefined : Number(value);
}

function num(value: string): number {
  return toNumber(value) ?? NaN;
}

function isBlank(value: string): boolean {
  return value.trim() === '';
}

export function emptyBlock(): DraftBlock {
  return { kind: 'block', id: newId(), label: '', footprint: '', quantity: '' };
}

// Draft ↔ engine conversion.

function toBlock(d: DraftBlock): Block {
  const block: Block = { id: d.id, footprint: num(d.footprint), quantity: num(d.quantity) };
  const label = d.label.trim();
  if (label) block.label = label;
  return block;
}

export function toSequence(items: DraftItem[]): SequenceItem[] {
  return items.map((d) =>
    d.kind === 'block' ? toBlock(d) : { id: d.id, repeat: num(d.repeat), blocks: d.blocks.map(toBlock) },
  );
}

function fromBlock(b: Block): DraftBlock {
  return { kind: 'block', id: b.id, label: b.label ?? '', footprint: String(b.footprint), quantity: String(b.quantity) };
}

function fromSequence(items: SequenceItem[]): DraftItem[] {
  return items.map((item) =>
    isPattern(item)
      ? { kind: 'pattern', id: item.id, repeat: String(item.repeat), blocks: item.blocks.map(fromBlock) }
      : fromBlock(item),
  );
}

function simpleInputs(state: WorkingState): { footprint: number; quantity?: number } {
  const qty = toNumber(state.quantity);
  return qty === undefined ? { footprint: num(state.footprint) } : { footprint: num(state.footprint), quantity: qty };
}

/** The Layout the engine sees: the active mode only. Name, note, and id come from the open saved layout, if any. */
export function toLayout(state: WorkingState): Layout {
  const layout: Layout = {
    id: state.saved?.id ?? 'working',
    name: state.saved?.name ?? '',
    mode: state.mode,
    startAddress: num(state.start),
    doneUnits: state.doneUnits,
    updatedAt: state.saved?.updatedAt ?? 0,
    schemaVersion: 1,
  };
  if (state.mode === 'simple') layout.simple = simpleInputs(state);
  else layout.sequence = toSequence(state.sequence);
  if (state.saved?.locationNote) layout.locationNote = state.saved.locationNote;
  if (state.saved?.lastOpenedAt !== undefined) layout.lastOpenedAt = state.saved.lastOpenedAt;
  return layout;
}

// Evaluation.

function allBlocks(items: DraftItem[]): DraftBlock[] {
  return items.flatMap((d) => (d.kind === 'block' ? [d] : d.blocks));
}

/** Drops errors for blank advanced fields (not entered yet); reports whether any were blank. */
function dropBlankItemErrors(items: DraftItem[], errors: LayoutErrors): boolean {
  let blank = false;
  const itemErrors: ItemErrors = { ...errors.items };
  const clear = (id: string, field: 'footprint' | 'quantity' | 'repeat') => {
    blank = true;
    const e = itemErrors[id];
    if (!e) return;
    const { [field]: _dropped, ...rest } = e;
    if (Object.keys(rest).length > 0) itemErrors[id] = rest;
    else delete itemErrors[id];
  };
  for (const d of items) {
    if (d.kind === 'pattern' && isBlank(d.repeat)) clear(d.id, 'repeat');
  }
  for (const b of allBlocks(items)) {
    if (isBlank(b.footprint)) clear(b.id, 'footprint');
    if (isBlank(b.quantity)) clear(b.id, 'quantity');
  }
  if (Object.keys(itemErrors).length > 0) errors.items = itemErrors;
  else delete errors.items;
  return blank;
}

export function evaluate(state: WorkingState): Evaluation {
  const layout = toLayout(state);
  const errors = validateLayout(layout);

  const startBlank = isBlank(state.start);
  if (startBlank) delete errors.startAddress;

  let incomplete = startBlank;
  if (state.mode === 'simple') {
    if (isBlank(state.footprint)) {
      delete errors.footprint;
      incomplete = true;
    }
  } else if (dropBlankItemErrors(state.sequence, errors)) {
    incomplete = true;
  }

  const result = incomplete || hasErrors(errors) ? null : computeLayout(layout);
  return { layout, errors, result, summary: result && summarize(layout, result), status: result ? null : statusFor(state, errors) };
}

function statusFor(state: WorkingState, errors: LayoutErrors): string {
  const sequenceProblem = errors.sequence !== undefined || errors.items !== undefined;
  if (state.mode === 'advanced' && sequenceProblem) return 'Fix the sequence';
  const fieldCount = (['footprint', 'startAddress', 'quantity'] as const).filter((f) => errors[f]).length;
  if (fieldCount > 0) return fieldCount > 1 ? 'Fix the highlighted fields' : 'Fix the highlighted field';
  if (isBlank(state.start)) return 'Enter a start address';
  return state.mode === 'simple' ? 'Enter a footprint' : 'Finish the sequence';
}

// Inputs. Anything that can move addresses clears the done checks.

function sameValue(a: string, b: string): boolean {
  return Object.is(toNumber(a), toNumber(b));
}

function clearIf(changed: boolean, state: WorkingState): WorkingState {
  return changed ? { ...state, doneUnits: [] } : state;
}

export function setFootprint(state: WorkingState, value: string): WorkingState {
  return clearIf(!sameValue(state.footprint, value), { ...state, footprint: value });
}

export function setStart(state: WorkingState, value: string): WorkingState {
  return clearIf(!sameValue(state.start, value), { ...state, start: value });
}

/** Keeps checks for units that still exist. While the inputs don't validate, checks are left alone. */
export function setQuantity(state: WorkingState, value: string): WorkingState {
  const next = { ...state, quantity: value };
  const { result } = evaluate(next);
  if (!result) return next;
  const count = result.placed.length;
  return { ...next, doneUnits: state.doneUnits.filter((u) => u <= count) };
}

/** Switching modes changes every address. The first switch to advanced seeds its first block. */
export function setMode(state: WorkingState, mode: Mode): WorkingState {
  if (mode === state.mode) return state;
  const next: WorkingState = { ...state, mode, doneUnits: [] };
  if (mode === 'advanced' && !state.seeded) {
    next.seeded = true;
    next.sequence = [{ ...emptyBlock(), footprint: state.footprint, quantity: state.quantity }];
  }
  return next;
}

// Sequence editing. Ids are unique across the sequence, including inside patterns.

type BlockField = 'label' | 'footprint' | 'quantity';

function mapBlocks(items: DraftItem[], fn: (b: DraftBlock) => DraftBlock): DraftItem[] {
  return items.map((d) => (d.kind === 'block' ? fn(d) : { ...d, blocks: d.blocks.map(fn) }));
}

export function setBlockField(state: WorkingState, id: string, field: BlockField, value: string): WorkingState {
  let changed = false;
  const sequence = mapBlocks(state.sequence, (b) => {
    if (b.id !== id) return b;
    changed = field !== 'label' && !sameValue(b[field], value);
    return { ...b, [field]: value };
  });
  return clearIf(changed, { ...state, sequence });
}

export function setRepeat(state: WorkingState, id: string, value: string): WorkingState {
  let changed = false;
  const sequence = state.sequence.map((d) => {
    if (d.kind !== 'pattern' || d.id !== id) return d;
    changed = !sameValue(d.repeat, value);
    return { ...d, repeat: value };
  });
  return clearIf(changed, { ...state, sequence });
}

/** Adds an empty block at the end of the sequence, or of the pattern `patternId`. */
export function addBlock(state: WorkingState, patternId?: string): WorkingState {
  const sequence =
    patternId === undefined
      ? [...state.sequence, emptyBlock()]
      : state.sequence.map((d) =>
          d.kind === 'pattern' && d.id === patternId ? { ...d, blocks: [...d.blocks, emptyBlock()] } : d,
        );
  return { ...state, sequence, doneUnits: [] };
}

/** A new pattern starts with two empty blocks: a pattern of one is just a block. */
export function addPattern(state: WorkingState): WorkingState {
  const pattern: DraftPattern = { kind: 'pattern', id: newId(), repeat: '', blocks: [emptyBlock(), emptyBlock()] };
  return { ...state, sequence: [...state.sequence, pattern], doneUnits: [] };
}

/** Applies `fn` to whichever list (top level or a pattern's blocks) holds `id`. */
function editList(state: WorkingState, id: string, fn: <T extends DraftItem>(list: T[], index: number) => T[]): WorkingState {
  const top = state.sequence.findIndex((d) => d.id === id);
  if (top >= 0) return { ...state, sequence: fn(state.sequence, top), doneUnits: [] };
  const sequence = state.sequence.map((d) => {
    if (d.kind !== 'pattern') return d;
    const i = d.blocks.findIndex((b) => b.id === id);
    return i >= 0 ? { ...d, blocks: fn(d.blocks, i) } : d;
  });
  return { ...state, sequence, doneUnits: [] };
}

export function removeItem(state: WorkingState, id: string): WorkingState {
  return editList(state, id, (list, i) => list.filter((_, j) => j !== i));
}

export function moveItem(state: WorkingState, id: string, by: -1 | 1): WorkingState {
  return editList(state, id, (list, i) => {
    const j = i + by;
    if (j < 0 || j >= list.length) return list;
    const next = [...list];
    [next[i], next[j]] = [next[j]!, next[i]!];
    return next;
  });
}

function copyItem<T extends DraftItem>(item: T): T {
  if (item.kind === 'block') return { ...item, id: newId() };
  return { ...item, id: newId(), blocks: item.blocks.map((b) => ({ ...b, id: newId() })) };
}

/** Inserts a copy, with new ids, right after the original. */
export function duplicateItem(state: WorkingState, id: string): WorkingState {
  return editList(state, id, (list, i) => [...list.slice(0, i + 1), copyItem(list[i]!), ...list.slice(i + 1)]);
}

// Done checks.

export function toggleDone(state: WorkingState, unit: number): WorkingState {
  const doneUnits = state.doneUnits.includes(unit)
    ? state.doneUnits.filter((u) => u !== unit)
    : [...state.doneUnits, unit].sort((a, b) => a - b);
  return { ...state, doneUnits };
}

export function resetChecks(state: WorkingState): WorkingState {
  return { ...state, doneUnits: [] };
}

// Reset and Continue start a new unsaved working layout; an open saved layout is left as it was.
// Only the active mode's inputs are cleared.

function fresh(state: WorkingState, start: string): WorkingState {
  const { saved: _saved, ...rest } = state;
  return state.mode === 'simple'
    ? { ...rest, start, footprint: '', quantity: '', doneUnits: [] }
    : { ...rest, start, sequence: [emptyBlock()], doneUnits: [] };
}

export function reset(state: WorkingState): WorkingState {
  return fresh(state, '1');
}

/** The address Continue starts from, or null when Continue isn't offered. */
export function continueAddress(state: WorkingState): number | null {
  return evaluate(state).summary?.nextAddress ?? null;
}

/** Starts a new unsaved working layout at the next free address. */
export function continueFrom(state: WorkingState): WorkingState {
  const next = continueAddress(state);
  return next === null ? state : fresh(state, String(next));
}

// Saved layouts.

export function openSaved(layout: Layout): WorkingState {
  const sequence = layout.sequence ? fromSequence(layout.sequence) : [];
  return {
    mode: layout.mode,
    start: String(layout.startAddress),
    footprint: layout.simple ? String(layout.simple.footprint) : '',
    quantity: layout.simple?.quantity === undefined ? '' : String(layout.simple.quantity),
    sequence,
    seeded: sequence.length > 0,
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

/** True when the mode, start, or active mode's inputs differ from the open saved layout. Values are compared, so "019" equals "19". */
export function isDirty(state: WorkingState): boolean {
  const saved = state.saved;
  if (!saved) return false;
  if (state.mode !== saved.mode || !Object.is(toNumber(state.start), saved.startAddress)) return true;
  if (state.mode === 'simple') {
    return (
      !Object.is(toNumber(state.footprint), saved.simple?.footprint) ||
      !Object.is(toNumber(state.quantity), saved.simple?.quantity)
    );
  }
  return canonical(toSequence(state.sequence)) !== canonical(saved.sequence ?? []);
}

/** Key order and blank labels don't count as changes. */
function canonical(sequence: SequenceItem[]): string {
  const b = (x: Block) => [x.id, x.label?.trim() || '', x.footprint, x.quantity];
  return JSON.stringify(sequence.map((item) => (isPattern(item) ? [item.id, item.repeat, item.blocks.map(b)] : b(item))));
}

/** Done checks on an open, unmodified saved layout are written straight away. */
export function checksAutosave(state: WorkingState): boolean {
  return state.saved !== undefined && !isDirty(state);
}

function hasSequenceInput(items: DraftItem[]): boolean {
  return items.some((d) =>
    d.kind === 'pattern'
      ? !isBlank(d.repeat) || hasSequenceInput(d.blocks)
      : !isBlank(d.label) || !isBlank(d.footprint) || !isBlank(d.quantity),
  );
}

/** Work that opening another layout would discard. */
export function hasUnsavedWork(state: WorkingState): boolean {
  if (state.saved) return isDirty(state);
  return state.mode === 'simple' ? !isBlank(state.footprint) : hasSequenceInput(state.sequence);
}

function isComplete(sequence: SequenceItem[]): boolean {
  return (
    sequence.length > 0 &&
    sequence.every((item) =>
      isPattern(item)
        ? Number.isFinite(item.repeat) && item.blocks.length > 0 && isComplete(item.blocks)
        : Number.isFinite(item.footprint) && Number.isFinite(item.quantity),
    )
  );
}

/**
 * The Layout to store for a save, under `id` (the open layout's id to overwrite, or a new one).
 * The active mode is valid (Save requires it). The other mode's inputs are kept too when complete,
 * so both survive Save → open.
 */
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
  const simple = simpleInputs(state);
  if (state.mode === 'advanced' && Number.isFinite(simple.footprint) && Number.isFinite(simple.quantity ?? 0)) {
    layout.simple = simple;
  }
  const sequence = toSequence(state.sequence);
  if (state.mode === 'simple' && isComplete(sequence)) layout.sequence = sequence;

  const note = fields.locationNote.trim();
  if (note) layout.locationNote = note;
  else delete layout.locationNote;
  return layout;
}

// Descriptions.

function show(n: number): string {
  return Number.isFinite(n) ? String(n) : '?';
}

function describeBlock(b: Block): string {
  const qty = b.quantity === 1 ? '' : ` ×${show(b.quantity)}`;
  return `${b.label ? `${b.label} ` : ''}${show(b.footprint)}${qty}`;
}

/** e.g. "[Spot 19, Wash 14] ×8, Spot 19 ×2". Unfinished numbers show as "?". */
export function describeSequence(sequence: SequenceItem[]): string {
  return sequence
    .map((item) =>
      isPattern(item) ? `[${item.blocks.map(describeBlock).join(', ')}] ×${show(item.repeat)}` : describeBlock(item),
    )
    .join(', ');
}

/** Labels in order of first appearance. */
function labelsOf(sequence: SequenceItem[]): string[] {
  const labels: string[] = [];
  for (const item of sequence) {
    for (const b of isPattern(item) ? item.blocks : [item]) {
      if (b.label && !labels.includes(b.label)) labels.push(b.label);
    }
  }
  return labels;
}

/** Default name offered when saving, e.g. "19ch × 26 @ 1" or "Spot/Wash × 16 @ 1". */
export function suggestName(state: WorkingState): string {
  const { result, layout } = evaluate(state);
  if (!result) return '';
  const what = state.mode === 'simple' ? `${layout.simple!.footprint}ch` : labelsOf(layout.sequence!).join('/') || 'Mixed';
  return `${what} × ${result.placed.length} @ ${layout.startAddress}`;
}

/** One-line description of a saved layout for the list, e.g. "Footprint 19 · 26 units · start 1". */
export function describeLayout(layout: Layout): string {
  const parts = [
    layout.mode === 'advanced' ? describeSequence(layout.sequence ?? []) : `Footprint ${layout.simple?.footprint}`,
  ];
  try {
    const count = computeLayout(layout).placed.length;
    parts.push(`${count} unit${count === 1 ? '' : 's'}`);
  } catch {
    // Unreadable inputs: describe what we have.
  }
  parts.push(`start ${layout.startAddress}`);
  return parts.join(' · ');
}

/**
 * Color slot (1–6) per block id. Blocks with the same label share a color wherever they appear;
 * unlabeled blocks get their own. Slots are assigned in order of first appearance and cycle.
 */
export function blockColors(sequence: SequenceItem[]): Map<string, number> {
  const colors = new Map<string, number>();
  const byLabel = new Map<string, number>();
  let nextSlot = 0;
  const slot = () => (nextSlot++ % 6) + 1;
  for (const item of sequence) {
    for (const b of isPattern(item) ? item.blocks : [item]) {
      if (b.label === undefined) {
        colors.set(b.id, slot());
        continue;
      }
      if (!byLabel.has(b.label)) byLabel.set(b.label, slot());
      colors.set(b.id, byLabel.get(b.label)!);
    }
  }
  return colors;
}

/** Saved list order (design doc §5.4): last opened first; never-opened layouts fall back to last saved. */
export function sortByLastOpened(layouts: Layout[]): Layout[] {
  const key = (l: Layout) => l.lastOpenedAt ?? l.updatedAt;
  return [...layouts].sort((a, b) => key(b) - key(a));
}

// Reading stored data. Full import validation and migration come with JSON import (Phase 5).

type Rec = Record<string, unknown>;

function isRecord(value: unknown): value is Rec {
  return typeof value === 'object' && value !== null;
}

function isStoredBlock(value: unknown): value is Block {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.footprint === 'number' &&
    typeof value.quantity === 'number' &&
    (value.label === undefined || typeof value.label === 'string')
  );
}

function isStoredSequence(value: unknown): value is SequenceItem[] {
  return (
    Array.isArray(value) &&
    value.every((item) =>
      isRecord(item) && 'blocks' in item
        ? typeof item.id === 'string' &&
          typeof item.repeat === 'number' &&
          Array.isArray(item.blocks) &&
          item.blocks.every(isStoredBlock)
        : isStoredBlock(item),
    )
  );
}

function isStoredSimple(value: unknown): value is NonNullable<Layout['simple']> {
  return (
    isRecord(value) &&
    typeof value.footprint === 'number' &&
    (value.quantity === undefined || typeof value.quantity === 'number')
  );
}

/** Stored records that aren't a readable v1 layout are skipped. */
export function isStoredLayout(value: unknown): value is Layout {
  if (!isRecord(value)) return false;
  const v = value;
  const common =
    v.schemaVersion === 1 &&
    (v.mode === 'simple' || v.mode === 'advanced') &&
    typeof v.id === 'string' &&
    typeof v.name === 'string' &&
    typeof v.startAddress === 'number' &&
    typeof v.updatedAt === 'number' &&
    Array.isArray(v.doneUnits) &&
    v.doneUnits.every((u) => typeof u === 'number') &&
    (v.locationNote === undefined || typeof v.locationNote === 'string') &&
    (v.lastOpenedAt === undefined || typeof v.lastOpenedAt === 'number') &&
    (v.simple === undefined || isStoredSimple(v.simple)) &&
    (v.sequence === undefined || isStoredSequence(v.sequence));
  // The active mode's inputs must be there.
  return common && (v.mode === 'simple' ? v.simple !== undefined : v.sequence !== undefined);
}

function isStringList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((s) => typeof s === 'string');
}

function isDraftBlock(value: unknown): value is DraftBlock {
  return (
    isRecord(value) &&
    value.kind === 'block' &&
    isStringList([value.id, value.label, value.footprint, value.quantity])
  );
}

function isDraftSequence(value: unknown): value is DraftItem[] {
  return (
    Array.isArray(value) &&
    value.every(
      (d) =>
        isDraftBlock(d) ||
        (isRecord(d) &&
          d.kind === 'pattern' &&
          isStringList([d.id, d.repeat]) &&
          Array.isArray(d.blocks) &&
          d.blocks.every(isDraftBlock)),
    )
  );
}

/**
 * Reads a persisted WorkingState back, or null if it isn't one.
 * Also reads the Phase 3 (v1) shape, which had only the simple inputs, so an update keeps work in progress.
 */
export function parseWorkingState(value: unknown): WorkingState | null {
  if (!isRecord(value)) return null;
  const v = value;
  if (
    !isStringList([v.footprint, v.start, v.quantity]) ||
    !Array.isArray(v.doneUnits) ||
    !v.doneUnits.every((u) => typeof u === 'number')
  ) {
    return null;
  }
  const isV1 = v.mode === undefined;
  if (!isV1 && ((v.mode !== 'simple' && v.mode !== 'advanced') || !isDraftSequence(v.sequence) || typeof v.seeded !== 'boolean')) {
    return null;
  }
  const state: WorkingState = {
    mode: isV1 ? 'simple' : (v.mode as Mode),
    start: v.start as string,
    footprint: v.footprint as string,
    quantity: v.quantity as string,
    sequence: isV1 ? [] : (v.sequence as DraftItem[]),
    seeded: isV1 ? false : (v.seeded as boolean),
    doneUnits: v.doneUnits as number[],
  };
  if (isStoredLayout(v.saved)) state.saved = v.saved;
  return state;
}
