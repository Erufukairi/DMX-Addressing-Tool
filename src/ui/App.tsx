import { useEffect, useRef, useState } from 'preact/hooks';
import type { Layout } from '../engine';
import { putLayout } from '../storage/layouts';
import { loadWorkingState, saveWorkingState } from '../storage/working';
import {
  blockColors,
  checksAutosave,
  continueFrom,
  describeSequence,
  detach,
  evaluate,
  initialState,
  isDirty,
  markSaved,
  openSaved,
  reset,
  resetChecks,
  setFootprint,
  setMode,
  setQuantity,
  setStart,
  toggleDone,
  type Mode,
  type WorkingState,
} from '../state/working';
import { NumberField } from './fields';
import { ResetIcon } from './icons';
import { LayoutsPanel } from './LayoutsPanel';
import { SequenceEditor } from './SequenceEditor';
import { SummaryLines } from './SummaryLines';
import { UnitTable } from './UnitTable';
import { usePanel } from './usePanel';
import { useUpdateNotice } from './useUpdateNotice';

function ModeSwitch({ mode, onChange }: { mode: Mode; onChange: (mode: Mode) => void }) {
  return (
    <div class="mode-switch" role="group" aria-label="Mode">
      {(['simple', 'advanced'] as const).map((m) => (
        <button type="button" key={m} aria-pressed={mode === m} onClick={() => onChange(m)}>
          {m === 'simple' ? 'Simple' : 'Advanced'}
        </button>
      ))}
    </div>
  );
}

export function App() {
  const [state, setState] = useState<WorkingState>(() => loadWorkingState() ?? initialState());
  const { panel, open, close } = usePanel();
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

  const evaluation = evaluate(state);
  const { errors, result, layout } = evaluation;
  const dirty = isDirty(state);
  const advanced = state.mode === 'advanced';

  /** Check changes on an open, unmodified saved layout are written to it after the render. */
  function changeChecks(change: (s: WorkingState) => WorkingState) {
    // setState(fn), so taps that land before a re-render all apply.
    setState((s) => {
      const next = change(s);
      if (!checksAutosave(next)) return next;
      const saved: Layout = { ...next.saved!, doneUnits: next.doneUnits };
      pendingCheckSave.current = saved;
      return markSaved(next, saved);
    });
  }

  const updateNotice = needRefresh && (
    <button type="button" class="update-notice" onClick={reload} disabled={updating}>
      {updating ? 'Updating…' : 'Update available, tap to reload'}
    </button>
  );

  if (panel === 'layouts') {
    return (
      <div class="app">
        <LayoutsPanel
          state={state}
          onBack={close}
          onOpen={(opened) => {
            setState(() => openSaved(opened));
            close();
          }}
          onSaved={(saved) => {
            setState((s) => markSaved(s, saved));
            close();
          }}
          onDeleted={(id) => {
            setState((s) => (s.saved?.id === id ? detach(s) : s));
          }}
        />
        {updateNotice}
      </div>
    );
  }

  if (panel === 'editor' && advanced) {
    return (
      <div class="app">
        <SequenceEditor state={state} update={setState} onBack={close} />
        {updateNotice}
      </div>
    );
  }

  const sequenceProblem = errors.sequence !== undefined || errors.items !== undefined;

  return (
    <div class="app">
      <header class="app-header">
        <div class="app-title">
          <h1>{state.saved ? state.saved.name : 'DMX Address Table'}</h1>
          {state.saved?.locationNote && <p class="app-meta">{state.saved.locationNote}</p>}
        </div>
        <div class="header-actions">
          <button type="button" class="button" onClick={() => open('layouts')}>
            Layouts
          </button>
          {dirty && <span class="unsaved">Unsaved changes</span>}
        </div>
      </header>

      <ModeSwitch mode={state.mode} onChange={(m) => setState((s) => setMode(s, m))} />

      <form class={advanced ? 'inputs inputs-advanced' : 'inputs'} onSubmit={(e) => e.preventDefault()}>
        {!advanced && (
          <NumberField
            id="footprint"
            label="Footprint"
            value={state.footprint}
            onInput={(v) => setState((s) => setFootprint(s, v))}
            error={errors.footprint}
          />
        )}
        <NumberField
          id="start"
          label="Start"
          value={state.start}
          onInput={(v) => setState((s) => setStart(s, v))}
          error={errors.startAddress}
        />
        {!advanced && (
          <NumberField
            id="quantity"
            label="Quantity"
            value={state.quantity}
            onInput={(v) => setState((s) => setQuantity(s, v))}
            error={errors.quantity}
            placeholder="Fill"
          />
        )}
        {advanced && (
          <div class="field">
            <span class="field-label-spacer" id="sequence-label">
              Sequence
            </span>
            <button
              type="button"
              class={sequenceProblem ? 'sequence-button sequence-problem' : 'sequence-button'}
              aria-describedby="sequence-label"
              onClick={() => open('editor')}
            >
              <span class="sequence-text">{describeSequence(layout.sequence ?? []) || 'Add blocks'}</span>
              <span class="sequence-edit">Edit</span>
            </button>
          </div>
        )}
        <div class="field">
          <span class="field-label-spacer" aria-hidden="true">
            &nbsp;
          </span>
          <button type="button" class="icon-button icon-button-tall" aria-label="Reset" title="Reset" onClick={() => setState(reset)}>
            <ResetIcon />
          </button>
        </div>
      </form>

      <div class="sticky-bar">
        <SummaryLines
          evaluation={evaluation}
          onContinue={() => setState((s) => continueFrom(s))}
          {...(state.doneUnits.length > 0 ? { onResetChecks: () => changeChecks(resetChecks) } : {})}
        />
      </div>

      {result && result.placed.length > 0 && (
        <UnitTable
          placed={result.placed}
          doneUnits={state.doneUnits}
          onToggle={(unit) => changeChecks((s) => toggleDone(s, unit))}
          {...(advanced ? { colors: blockColors(layout.sequence ?? []) } : {})}
        />
      )}

      <footer class="app-footer">v{__APP_VERSION__}</footer>

      {updateNotice}
    </div>
  );
}
