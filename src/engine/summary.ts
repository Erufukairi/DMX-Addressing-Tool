import type { Layout, LayoutResult } from './types';

function units(n: number): string {
  return `${n} unit${n === 1 ? '' : 's'}`;
}

/**
 * Summary line from design doc §4, e.g. "21 units · 8 addr left, next 505".
 * Terse on purpose: the readers are lighting techs.
 */
export function formatSummary(layout: Layout, result: LayoutResult): string {
  const placedCount = result.placed.length;
  const notPlacedCount = result.notPlaced.reduce((sum, n) => sum + n.count, 0);

  const tail =
    result.nextAddress === null ? 'universe full' : `${result.remaining} addr left, next ${result.nextAddress}`;

  if (placedCount === 0) {
    return `No units fit · ${result.remaining} addr left from ${layout.startAddress}`;
  }

  if (notPlacedCount > 0) {
    const total = placedCount + notPlacedCount;
    return `${placedCount} of ${units(total)} · ${notPlacedCount} didn't fit · ${tail}`;
  }
  return `${units(placedCount)} · ${tail}`;
}
