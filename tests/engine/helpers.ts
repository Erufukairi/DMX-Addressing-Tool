import type { Block, Layout, Pattern, SequenceItem } from '../../src/engine';

export function simpleLayout(
  footprint: number,
  startAddress = 1,
  quantity?: number,
  extra: Partial<Layout> = {},
): Layout {
  return {
    id: 'test',
    name: 'Test',
    mode: 'simple',
    startAddress,
    simple: quantity === undefined ? { footprint } : { footprint, quantity },
    doneUnits: [],
    updatedAt: 0,
    schemaVersion: 1,
    ...extra,
  };
}

export function block(id: string, footprint: number, quantity: number, label?: string): Block {
  return label === undefined ? { id, footprint, quantity } : { id, label, footprint, quantity };
}

export function pattern(id: string, repeat: number, ...blocks: Block[]): Pattern {
  return { id, repeat, blocks };
}

export function advancedLayout(sequence: SequenceItem[], startAddress = 1, extra: Partial<Layout> = {}): Layout {
  return {
    id: 'test',
    name: 'Test',
    mode: 'advanced',
    startAddress,
    sequence,
    doneUnits: [],
    updatedAt: 0,
    schemaVersion: 1,
    ...extra,
  };
}
