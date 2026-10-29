import type { Layout } from '../../src/engine';

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
