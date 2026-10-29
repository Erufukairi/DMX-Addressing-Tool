// Phase 1 placeholder: bare inputs plus a JSON dump, just to confirm the engine is wired up.
import { render } from 'preact';
import { useState } from 'preact/hooks';
import {
  computeLayout,
  formatSummary,
  hasErrors,
  validateLayout,
  type Layout,
} from './engine';

function toNumber(value: string): number | undefined {
  return value.trim() === '' ? undefined : Number(value);
}

function App() {
  const [footprint, setFootprint] = useState('');
  const [start, setStart] = useState('1');
  const [quantity, setQuantity] = useState('');

  const qty = toNumber(quantity);
  const layout: Layout = {
    id: 'placeholder',
    name: 'Placeholder',
    mode: 'simple',
    startAddress: toNumber(start) ?? NaN,
    simple: qty === undefined ? { footprint: toNumber(footprint) ?? NaN } : { footprint: toNumber(footprint) ?? NaN, quantity: qty },
    doneUnits: [],
    updatedAt: 0,
    schemaVersion: 1,
  };

  const errors = validateLayout(layout);
  const result = hasErrors(errors) ? null : computeLayout(layout);

  return (
    <main>
      <h1>DMX Address Table (placeholder)</h1>
      <label>
        Footprint{' '}
        <input inputMode="numeric" value={footprint} onInput={(e) => setFootprint(e.currentTarget.value)} />
      </label>
      <label>
        Start{' '}
        <input inputMode="numeric" value={start} onInput={(e) => setStart(e.currentTarget.value)} />
      </label>
      <label>
        Quantity{' '}
        <input inputMode="numeric" value={quantity} onInput={(e) => setQuantity(e.currentTarget.value)} />
      </label>
      {result && <p>{formatSummary(layout, result)}</p>}
      <pre>{JSON.stringify(result ?? { errors }, null, 2)}</pre>
    </main>
  );
}

render(<App />, document.getElementById('app')!);
