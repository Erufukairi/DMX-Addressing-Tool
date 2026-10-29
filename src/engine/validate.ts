import { MAX_ADDRESS, MIN_ADDRESS, isPattern, type Block, type Layout } from './types';

export type SimpleField = 'footprint' | 'startAddress' | 'quantity';
export type FieldErrors = Partial<Record<SimpleField, string>>;

export type ItemField = 'footprint' | 'quantity' | 'repeat' | 'blocks';
/** Advanced-mode errors keyed by block or pattern id. */
export type ItemErrors = Record<string, Partial<Record<ItemField, string>>>;

export interface LayoutErrors extends FieldErrors {
  /** Advanced mode: the sequence as a whole, e.g. empty. */
  sequence?: string;
  /** Advanced mode: per-item errors. Present only when there are some. */
  items?: ItemErrors;
}

export interface SimpleInput {
  footprint: number;
  startAddress: number;
  quantity?: number;
}

function isWhole(n: number): boolean {
  return Number.isInteger(n);
}

const FOOTPRINT_ERROR = `Footprint must be a whole number from 1 to ${MAX_ADDRESS}`;
const START_ERROR = `Start address must be a whole number from ${MIN_ADDRESS} to ${MAX_ADDRESS}`;
const QUANTITY_ERROR = 'Quantity must be a whole number of 1 or more';

function validFootprint(n: number): boolean {
  return isWhole(n) && n >= 1 && n <= MAX_ADDRESS;
}

function validStart(n: number): boolean {
  return isWhole(n) && n >= MIN_ADDRESS && n <= MAX_ADDRESS;
}

function validCount(n: number): boolean {
  return isWhole(n) && n >= 1;
}

export function validateSimple(input: SimpleInput): FieldErrors {
  const errors: FieldErrors = {};
  const { footprint, startAddress, quantity } = input;

  if (!validFootprint(footprint)) errors.footprint = FOOTPRINT_ERROR;
  if (!validStart(startAddress)) errors.startAddress = START_ERROR;
  if (quantity !== undefined && !validCount(quantity)) errors.quantity = QUANTITY_ERROR;
  return errors;
}

function validateBlock(block: Block, items: ItemErrors): void {
  const errors: ItemErrors[string] = {};
  if (!validFootprint(block.footprint)) errors.footprint = FOOTPRINT_ERROR;
  if (!validCount(block.quantity)) errors.quantity = QUANTITY_ERROR;
  if (Object.keys(errors).length > 0) items[block.id] = errors;
}

/** Start address, the sequence as a whole, and each block and pattern. */
export function validateAdvanced(layout: Layout): LayoutErrors {
  const errors: LayoutErrors = {};
  if (!validStart(layout.startAddress)) errors.startAddress = START_ERROR;

  const sequence = layout.sequence ?? [];
  if (sequence.length === 0) errors.sequence = 'Add at least one block';

  const items: ItemErrors = {};
  for (const item of sequence) {
    if (!isPattern(item)) {
      validateBlock(item, items);
      continue;
    }
    const patternErrors: ItemErrors[string] = {};
    if (!validCount(item.repeat)) patternErrors.repeat = 'Repeat must be a whole number of 1 or more';
    if (item.blocks.length === 0) patternErrors.blocks = 'Add a block to this pattern';
    if (Object.keys(patternErrors).length > 0) items[item.id] = patternErrors;
    for (const block of item.blocks) validateBlock(block, items);
  }
  if (Object.keys(items).length > 0) errors.items = items;
  return errors;
}

export function validateLayout(layout: Layout): LayoutErrors {
  if (layout.mode === 'advanced') return validateAdvanced(layout);
  if (!layout.simple) {
    return { footprint: 'Footprint is required' };
  }
  return validateSimple({ ...layout.simple, startAddress: layout.startAddress });
}

export function hasErrors(errors: LayoutErrors): boolean {
  return Object.keys(errors).length > 0;
}
