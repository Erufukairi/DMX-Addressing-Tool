import type { Layout, LayoutResult } from './types';

/** Plain-text share from design doc §5.4. Simple mode omits labels: "1: 1", "2: 20", … */
export function formatShareText(layout: Layout, result: LayoutResult): string {
  const lines: string[] = [];

  const note = layout.locationNote?.trim();
  if (note) lines.push(note);

  if (layout.simple) lines.push(`Footprint ${layout.simple.footprint}`);

  for (const f of result.placed) {
    lines.push(`${f.unit}: ${f.address}`);
  }

  lines.push(result.nextAddress === null ? 'Universe full' : `Next free: ${result.nextAddress}`);
  return lines.join('\n');
}
