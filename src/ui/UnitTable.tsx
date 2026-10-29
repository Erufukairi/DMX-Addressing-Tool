import type { PlacedFixture } from '../engine';

interface UnitTableProps {
  placed: PlacedFixture[];
  doneUnits: number[];
  onToggle: (unit: number) => void;
}

/**
 * Unit # | Address, large text. Tapping anywhere on a row marks it done (design doc §5.3).
 * The handler is on the row; the address cell's button only makes the row reachable by keyboard
 * and screen readers, and its click bubbles to the row.
 */
export function UnitTable({ placed, doneUnits, onToggle }: UnitTableProps) {
  const done = new Set(doneUnits);
  return (
    <table class="units">
      <thead>
        <tr>
          <th scope="col">Unit #</th>
          <th scope="col">Address</th>
        </tr>
      </thead>
      <tbody>
        {placed.map((f) => {
          const isDone = done.has(f.unit);
          return (
            <tr key={f.unit} class={isDone ? 'done' : undefined} onClick={() => onToggle(f.unit)}>
              <td class="unit">
                <span class="check" aria-hidden="true">
                  {isDone ? '✓' : ''}
                </span>
                {f.unit}
              </td>
              <td class="address">
                <button
                  type="button"
                  class="row-toggle"
                  aria-pressed={isDone}
                  aria-label={`Unit ${f.unit}, address ${f.address}`}
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
