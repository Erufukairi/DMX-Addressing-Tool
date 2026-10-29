import type { Layout, LayoutResult } from './types';

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 'es'}`;
}

function fixtures(n: number): string {
  return `${n} fixture${n === 1 ? '' : 's'}`;
}

/** Summary line from design doc §4, e.g. "Fit 21 fixtures · 45 addresses left starting at 468". */
export function formatSummary(layout: Layout, result: LayoutResult): string {
  const placedCount = result.placed.length;
  const notPlacedCount = result.notPlaced.reduce((sum, n) => sum + n.count, 0);

  const tail =
    result.nextAddress === null
      ? 'universe full'
      : `${plural(result.remaining, 'address')} left starting at ${result.nextAddress}`;

  if (placedCount === 0) {
    const footprint = layout.simple?.footprint;
    const reason =
      footprint === undefined ? '' : ` · footprint ${footprint} needs more than the ${result.remaining} left`;
    return `No fixtures fit${reason} starting at ${layout.startAddress}`;
  }

  if (notPlacedCount > 0) {
    const total = placedCount + notPlacedCount;
    return `Fit ${placedCount} of ${fixtures(total)} · ${notPlacedCount} didn't fit · ${tail}`;
  }
  return `Fit ${fixtures(placedCount)} · ${tail}`;
}
