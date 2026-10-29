import { useEffect, useRef, useState } from 'preact/hooks';
import type { Layout } from '../engine';
import { putLayout } from '../storage/layouts';
import { loadWorkingState, saveWorkingState } from '../storage/working';
import {
  checksAutosave,
  continueFrom,
  detach,
  evaluate,
  initialState,
  isDirty,
  markSaved,
  openSaved,
  reset,
  resetChecks,
  setFootprint,
  setQuantity,
  setStart,
  toggleDone,
  type WorkingState,
} from '../state/working';
import { LayoutsPanel } from './LayoutsPanel';
import { UnitTable } from './UnitTable';
import { useUpdateNotice } from './useUpdateNotice';

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

/** Counter-clockwise arrow. */
function ResetIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="26"
      height="26"
      fill="none"
      stroke="currentColor"
      stroke-width="2.5"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1" />
      <path d="M3.5 3.5v5h5" />
    </svg>
  );
}

function confirmClearChecks(state: WorkingState): boolean {
  const n = state.doneUnits.length;
  return n === 0 || window.confirm(`Clear ${n} done check${n === 1 ? '' : 's'}?`);
}

/**
 * The Layouts panel is a full-screen view. It gets a history entry so the phone's Back gesture
 * returns to the table instead of leaving the app.
 */
function useLayoutsView() {
  const [showLayouts, setShowLayouts] = useState(false);
  useEffect(() => {
    const onPop = () => setShowLayouts(false);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  const openLayouts = () => {
    try {
      history.pushState({ view: 'layouts' }, '');
    } catch {
      // No history in this context; the Back button still works.
    }
    setShowLayouts(true);
  };
  const closeLayouts = () => {
    if (history.state?.view === 'layouts') history.back();
    else setShowLayouts(false);
  };
  return { showLayouts, openLayouts, closeLayouts };
}

export function App() {
  const [state, setState] = useState<WorkingState>(() => loadWorkingState() ?? initialState());
  const { showLayouts, openLayouts, closeLayouts } = useLayoutsView();
  const { needRefresh, updating, reload } = useUpdateNotice();

  const pendingCheckSave = useRef<Layout | null>(null);

  // Kept on the device, saved or not, so a relaunch comes back where the user was.
  useEffect(() => {
    saveWorkingState(state);
    if (pendingCheckSave.current) {
      putLayout(pendingCheckSave.current).catch(() => {});
      pendingCheckSave.current = null;
    }
  }, [state]);

  const { errors, result, status } = evaluate(state);
  const nextAddress = result?.nextAddress ?? null;
  const dirty = isDirty(state);
  const doneCount = state.doneUnits.length;


  /** Check changes on an open, unmodified saved layout are written to it after the render. */
  function changeChecks(change: (s: WorkingState) => WorkingState) {
    // setState(fn), so taps that land before a re-render all apply.
    setState((s) => {
      const next = change(s);
      if (!checksAutosave(next)) return next;
      const layout: Layout = { ...next.saved!, doneUnits: next.doneUnits };
      pendingCheckSave.current = layout;
      return markSaved(next, layout);
    });
  }

  const updateNotice = needRefresh && (
    <button type="button" class="update-notice" onClick={reload} disabled={updating}>
      {updating ? 'Updating…' : 'Update available, tap to reload'}
    </button>
  );

  if (showLayouts) {
    return (
      <div class="app">
        <LayoutsPanel
          state={state}
          onBack={closeLayouts}
          onOpen={(layout) => {
            setState(() => openSaved(layout));
            closeLayouts();
          }}
          onSaved={(layout) => {
            setState((s) => markSaved(s, layout));
            closeLayouts();
          }}
          onDeleted={(id) => {
            setState((s) => (s.saved?.id === id ? detach(s) : s));
          }}
        />
        {updateNotice}
      </div>
    );
  }

  return (
    <div class="app">
      <header class="app-header">
        <div class="app-title">
          <h1>{state.saved ? state.saved.name : 'DMX Address Table'}</h1>
          {state.saved?.locationNote && <p class="app-meta">{state.saved.locationNote}</p>}
        </div>
        <div class="header-actions">
          <button type="button" class="button" onClick={openLayouts}>
            Layouts
          </button>
          {dirty && <span class="unsaved">Unsaved changes</span>}
        </div>
      </header>

      <form class="inputs" onSubmit={(e) => e.preventDefault()}>
        <NumberField
          id="footprint"
          label="Footprint"
          value={state.footprint}
          onInput={(v) => setState((s) => setFootprint(s, v))}
          error={errors.footprint}
        />
        <NumberField
          id="start"
          label="Start"
          value={state.start}
          onInput={(v) => setState((s) => setStart(s, v))}
          error={errors.startAddress}
        />
        <NumberField
          id="quantity"
          label="Quantity"
          value={state.quantity}
          onInput={(v) => setState((s) => setQuantity(s, v))}
          error={errors.quantity}
          placeholder="Fill"
        />
        <div class="field">
          <span class="field-label-spacer" aria-hidden="true">
            &nbsp;
          </span>
          <button
            type="button"
            class="icon-button"
            aria-label="Reset"
            title="Reset"
            onClick={() => {
              if (confirmClearChecks(state)) setState(() => reset());
            }}
          >
            <ResetIcon />
          </button>
        </div>
      </form>

      <div class="sticky-bar">
        <div class="bar-row">
          <p class={result ? 'summary' : 'summary summary-idle'} role="status" aria-live="polite">
            {/* Keep "next 495" together when the line wraps. */}
            {status.replace(/next (\d+)/, 'next $1')}
          </p>
          {nextAddress !== null && (
            <button
              type="button"
              class="button button-primary"
              aria-label={`Continue from ${nextAddress}`}
              onClick={() => setState((s) => continueFrom(s))}
            >
              Continue
            </button>
          )}
        </div>
        {result && doneCount > 0 && (
          <div class="bar-row bar-row-end">
            <span class="done-count">
              {doneCount} of {result.placed.length} done
            </span>
            <button
              type="button"
              class="button"
              onClick={() => {
                if (confirmClearChecks(state)) changeChecks(resetChecks);
              }}
            >
              Reset checks
            </button>
          </div>
        )}
      </div>

      {result && result.placed.length > 0 && (
        <UnitTable
          placed={result.placed}
          doneUnits={state.doneUnits}
          onToggle={(unit) => changeChecks((s) => toggleDone(s, unit))}
        />
      )}

      <footer class="app-footer">v{__APP_VERSION__}</footer>

      {updateNotice}
    </div>
  );
}
