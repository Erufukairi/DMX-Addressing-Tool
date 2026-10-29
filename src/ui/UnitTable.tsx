import type { PlacedFixture } from '../engine';

interface UnitTableProps {
  placed: PlacedFixture[];
  doneUnits: number[];
  onToggle: (unit: number) => void;
  /** Advanced mode: color slot (1–6) per block id. Adds the Label column. */
  colors?: Map<string, number>;
}

/**
 * Unit # | Address (simple) or Unit # | Label | Address (advanced), large text.
 * Tapping anywhere on a row marks it done (design doc §5.3). The handler is on the row; the address
 * cell's button only makes the row reachable by keyboard and screen readers, and its click bubbles.
 */
export function UnitTable({ placed, doneUnits, onToggle, colors }: UnitTableProps) {
  const done = new Set(doneUnits);
  return (
    <table class={colors ? 'units units-labeled' : 'units'}>
      <thead>
        <tr>
          <th scope="col">Unit #</th>
          {colors && (
            <th scope="col" class="label-col">
              Label
            </th>
          )}
          <th scope="col">Address</th>
        </tr>
      </thead>
      <tbody>
        {placed.map((f) => {
          const isDone = done.has(f.unit);
          const slot = colors && f.blockId ? colors.get(f.blockId) : undefined;
          return (
            <tr
              key={f.unit}
              class={isDone ? 'done' : undefined}
              style={slot ? { '--row-color': `var(--block-${slot})` } : undefined}
              onClick={() => onToggle(f.unit)}
            >
              <td class={slot ? 'unit unit-colored' : 'unit'}>
                <span class="check" aria-hidden="true">
                  {isDone ? '✓' : ''}
                </span>
                {f.unit}
              </td>
              {colors && <td class="label">{f.label ?? ''}</td>}
              <td class="address">
                <button
                  type="button"
                  class="row-toggle"
                  aria-pressed={isDone}
                  aria-label={`Unit ${f.unit}${f.label ? ` ${f.label}` : ''}, address ${f.address}`}
                >
                  {f.address}
                </button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
