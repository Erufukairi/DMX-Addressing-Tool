import { isPattern, type Layout, type LayoutResult } from './types';

/** The two-line summary from design doc §4. Terse on purpose: the readers are lighting techs. */
export interface Summary {
  /** Line 1, e.g. "21 units", "21 of 24 units", "No units fit". */
  units: string;
  /** Some fixtures didn't fit: line 1 shows in the warning color. */
  short: boolean;
  /** Advanced mode with more than one label, e.g. "8 Spot, 6 of 8 Wash". */
  labels?: string;
  /** Line 2, e.g. "8 addr left", "universe full". */
  addresses: string;
  /** Where Continue starts from; null when there's nothing to continue from. */
  nextAddress: number | null;
}

function units(n: number): string {
  return `${n} unit${n === 1 ? '' : 's'}`;
}

/** Labels in order of first appearance in the sequence. */
function sequenceLabels(layout: Layout): string[] {
  const labels: string[] = [];
  for (const item of layout.sequence ?? []) {
    for (const block of isPattern(item) ? item.blocks : [item]) {
      const label = block.label?.trim();
      if (label && !labels.includes(label)) labels.push(label);
    }
  }
  return labels;
}

function labelCounts(layout: Layout, result: LayoutResult): string | undefined {
  const labels = sequenceLabels(layout);
  if (labels.length < 2) return undefined;
  return labels
    .map((label) => {
      const placed = result.placed.filter((f) => f.label === label).length;
      const missing = result.notPlaced.filter((n) => n.label === label).reduce((sum, n) => sum + n.count, 0);
      return missing > 0 ? `${placed} of ${placed + missing} ${label}` : `${placed} ${label}`;
    })
    .join(', ');
}

export function summarize(layout: Layout, result: LayoutResult): Summary {
  const placedCount = result.placed.length;
  const notPlacedCount = result.notPlaced.reduce((sum, n) => sum + n.count, 0);

  const summary: Summary = {
    units:
      placedCount === 0
        ? 'No units fit'
        : notPlacedCount > 0
          ? `${placedCount} of ${units(placedCount + notPlacedCount)}`
          : units(placedCount),
    short: placedCount === 0 || notPlacedCount > 0,
    addresses: result.nextAddress === null ? 'universe full' : `${result.remaining} addr left`,
    // Continuing from where nothing was placed would change nothing.
    nextAddress: placedCount === 0 ? null : result.nextAddress,
  };
  if (layout.mode === 'advanced') {
    const labels = labelCounts(layout, result);
    if (labels) summary.labels = labels;
  }
  return summary;
}
