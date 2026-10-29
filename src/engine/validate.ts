import { MAX_ADDRESS, MIN_ADDRESS, type Layout } from './types';

export type SimpleField = 'footprint' | 'startAddress' | 'quantity';
export type FieldErrors = Partial<Record<SimpleField, string>>;

export interface SimpleInput {
  footprint: number;
  startAddress: number;
  quantity?: number;
}

function isWhole(n: number): boolean {
  return Number.isInteger(n);
}

export function validateSimple(input: SimpleInput): FieldErrors {
  const errors: FieldErrors = {};
  const { footprint, startAddress, quantity } = input;

  if (!isWhole(footprint) || footprint < 1 || footprint > MAX_ADDRESS) {
    errors.footprint = `Footprint must be a whole number from 1 to ${MAX_ADDRESS}`;
  }
  if (!isWhole(startAddress) || startAddress < MIN_ADDRESS || startAddress > MAX_ADDRESS) {
    errors.startAddress = `Start address must be a whole number from ${MIN_ADDRESS} to ${MAX_ADDRESS}`;
  }
  if (quantity !== undefined && (!isWhole(quantity) || quantity < 1)) {
    errors.quantity = 'Quantity must be a whole number of 1 or more';
  }
  return errors;
}

export function validateLayout(layout: Layout): FieldErrors {
  if (layout.mode !== 'simple') {
    throw new Error('Advanced mode validation is not implemented yet');
  }
  if (!layout.simple) {
    return { footprint: 'Footprint is required' };
  }
  return validateSimple({ ...layout.simple, startAddress: layout.startAddress });
}

export function hasErrors(errors: FieldErrors): boolean {
  return Object.keys(errors).length > 0;
}
