// Data model from design doc §6.

export const MIN_ADDRESS = 1;
export const MAX_ADDRESS = 512;

export interface Block {
  id: string;
  label?: string;
  footprint: number; // 1–512
  quantity: number; // ≥1
}

export interface Pattern {
  id: string;
  blocks: Block[];
  repeat: number; // ≥1
}

export type SequenceItem = Block | Pattern;

export interface Layout {
  id: string;
  name: string;
  locationNote?: string; // free text, e.g. "Univ 4 - 1st Elec"; used only in shares
  mode: 'simple' | 'advanced';
  startAddress: number;
  simple?: { footprint: number; quantity?: number };
  sequence?: SequenceItem[];
  doneUnits: number[];
  updatedAt: number; // last saved
  lastOpenedAt?: number; // sorts the saved list; optional, so older data still reads
  schemaVersion: 1;
}

export interface PlacedFixture {
  unit: number;
  label?: string;
  blockId?: string;
  address: number;
  endAddress: number;
}

export interface LayoutResult {
  placed: PlacedFixture[];
  notPlaced: { blockId?: string; label?: string; count: number }[];
  nextAddress: number | null; // null when 512 is used exactly
  remaining: number;
}

export function isPattern(item: SequenceItem): item is Pattern {
  return 'blocks' in item;
}
