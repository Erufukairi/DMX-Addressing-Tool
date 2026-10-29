import { useState } from 'preact/hooks';
import { useRegisterSW } from 'virtual:pwa-register/preact';
import {
  computeLayout,
  formatSummary,
  hasErrors,
  validateLayout,
  type FieldErrors,
  type Layout,
  type LayoutResult,
} from '../engine';

function toNumber(value: string): number | undefined {
  return value.trim() === '' ? undefined : Number(value);
}

interface NumberFieldProps {
  id: string;
  label: string;
  value: string;
  onInput: (value: string) => void;
  error?: string | undefined;
  placeholder?: string;
}

function NumberField({ id, label, value, onInput, error, placeholder }: NumberFieldProps) {
  const errorId = `${id}-error`;
  return (
    <div class="field">
      <label for={id}>{label}</label>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="off"
        enterKeyHint="done"
        value={value}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        onInput={(e) => onInput(e.currentTarget.value)}
      />
      {error && (
        <p class="field-error" id={errorId}>
          {error}
        </p>
      )}
    </div>
  );
}

/** Service worker updates: prompt, never auto-reload mid-job (phase-2-plan §2). */
function useUpdateNotice() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      // Installed apps can stay open for days; check again whenever the app comes back to the foreground.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && navigator.onLine) {
          registration.update().catch(() => {});
        }
      });
    },
  });
  return { needRefresh, reload: () => updateServiceWorker(true) };
}

export function App() {
  const [footprint, setFootprint] = useState('');
  const [start, setStart] = useState('1');
  const [quantity, setQuantity] = useState('');
  const { needRefresh, reload } = useUpdateNotice();

  const fp = toNumber(footprint);
  const st = toNumber(start);
  const qty = toNumber(quantity);
  const layout: Layout = {
    id: 'simple',
    name: '',
    mode: 'simple',
    startAddress: st ?? NaN,
    simple: qty === undefined ? { footprint: fp ?? NaN } : { footprint: fp ?? NaN, quantity: qty },
    doneUnits: [],
    updatedAt: 0,
    schemaVersion: 1,
  };

  // A blank required field is "not entered yet", not an error.
  const errors: FieldErrors = validateLayout(layout);
  if (fp === undefined) delete errors.footprint;
  if (st === undefined) delete errors.startAddress;
  const incomplete = fp === undefined || st === undefined;
  const result: LayoutResult | null = incomplete || hasErrors(errors) ? null : computeLayout(layout);

  let status: string;
  if (result) status = formatSummary(layout, result);
  else if (hasErrors(errors)) status = Object.keys(errors).length > 1 ? 'Fix the highlighted fields' : 'Fix the highlighted field';
  else if (fp === undefined) status = 'Enter a footprint';
  else status = 'Enter a start address';

  return (
    <div class="app">
      <header class="app-header">
        <h1>DMX Address Table</h1>
        <span class="version">v{__APP_VERSION__}</span>
      </header>

      <form class="inputs" onSubmit={(e) => e.preventDefault()}>
        <NumberField id="footprint" label="Footprint" value={footprint} onInput={setFootprint} error={errors.footprint} />
        <NumberField id="start" label="Start" value={start} onInput={setStart} error={errors.startAddress} />
        <NumberField
          id="quantity"
          label="Quantity"
          value={quantity}
          onInput={setQuantity}
          error={errors.quantity}
          placeholder="Fill"
        />
      </form>

      <p class={result ? 'summary' : 'summary summary-idle'} role="status" aria-live="polite">
        {status}
      </p>

      {result && result.placed.length > 0 && (
        <table class="units">
          <thead>
            <tr>
              <th scope="col">Unit #</th>
              <th scope="col">Address</th>
            </tr>
          </thead>
          <tbody>
            {result.placed.map((f) => (
              <tr key={f.unit}>
                <td class="unit">{f.unit}</td>
                <td class="address">{f.address}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {needRefresh && (
        <button type="button" class="update-notice" onClick={reload}>
          Update available, tap to reload
        </button>
      )}
    </div>
  );
}
