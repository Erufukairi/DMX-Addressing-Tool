import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import type { Layout } from '../engine';
import { putLayout } from '../storage/layouts';
import { loadWorkspace, saveWorkspace } from '../storage/working';
import {
  blockColors,
  checksAutosave,
  continueFrom,
  describeSequence,
  detach,
  evaluate,
  isDirty,
  markSaved,
  reset,
  resetChecks,
  setFootprint,
  setQuantity,
  setStart,
  toggleDone,
  type WorkingState,
} from '../state/working';
import {
  activeState,
  initialWorkspace,
  openLayout,
  switchMode,
  updateActive,
  updateOpen,
  type Workspace,
} from '../state/workspace';
import { NumberField } from './fields';
import { MenuIcon, ResetIcon } from './icons';
import { LayoutsPanel } from './LayoutsPanel';
import { Menu } from './Menu';
import { SequenceEditor } from './SequenceEditor';
import { SummaryLines } from './SummaryLines';
import { UnitTable } from './UnitTable';
import { usePanel } from './usePanel';
import { useUpdateNotice } from './useUpdateNotice';

/** Keeps --bar-h at the sticky bar's height, so the table's header row can stick right under it. */
function useBarHeight() {
  const bar = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = bar.current;
    if (!el) return;
    const set = () => document.documentElement.style.setProperty('--bar-h', `${el.offsetHeight}px`);
    set();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(set);
    observer.observe(el);
    return () => observer.disconnect();
  });
  return bar;
}

export function App() {
  const [workspace, setWorkspace] = useState<Workspace>(() => loadWorkspace() ?? initialWorkspace());
  const { panel, open, switchTo, close } = usePanel();
  const { needRefresh, updating, reload } = useUpdateNotice();
  const bar = useBarHeight();

  const pendingCheckSave = useRef<Layout | null>(null);

  // Kept on the device, saved or not, so a relaunch comes back where the user was.
  useEffect(() => {
    saveWorkspace(workspace);
    if (pendingCheckSave.current) {
      putLayout(pendingCheckSave.current).catch(() => {});
      pendingCheckSave.current = null;
    }
  }, [workspace]);

  const state = activeState(workspace);
  const evaluation = evaluate(state);
  const { errors, result, layout } = evaluation;
  const dirty = isDirty(state);
  const advanced = state.mode === 'advanced';

  /** Changes the active mode's state. setWorkspace(fn), so taps that land before a re-render all apply. */
  const update = (change: (s: WorkingState) => WorkingState) => setWorkspace((ws) => updateActive(ws, change));

  /** Check changes on an open, unmodified saved layout are written to it after the render. */
  function changeChecks(change: (s: WorkingState) => WorkingState) {
    update((s) => {
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
          workspace={workspace}
          onBack={close}
          onOpen={(opened) => {
            setWorkspace((ws) => openLayout(ws, opened));
            close();
          }}
          onSaved={(saved) => {
            update((s) => markSaved(s, saved));
            close();
          }}
          onDeleted={(id) => setWorkspace((ws) => updateOpen(ws, id, detach))}
        />
        {updateNotice}
      </div>
    );
  }

  if (panel === 'editor' && advanced) {
    return (
      <div class="app">
        <SequenceEditor state={state} update={update} onBack={close} />
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
          <button type="button" class="icon-button" aria-label="Menu" aria-haspopup="dialog" onClick={() => open('menu')}>
            <MenuIcon />
          </button>
          {dirty && <span class="unsaved">Unsaved changes</span>}
        </div>
      </header>

      <form class={advanced ? 'inputs inputs-advanced' : 'inputs'} onSubmit={(e) => e.preventDefault()}>
        {!advanced && (
          <NumberField
            id="footprint"
            label="Footprint"
            value={state.footprint}
            onInput={(v) => update((s) => setFootprint(s, v))}
            error={errors.footprint}
          />
        )}
        <NumberField
          id="start"
          label="Start"
          value={state.start}
          onInput={(v) => update((s) => setStart(s, v))}
          error={errors.startAddress}
        />
        {!advanced && (
          <NumberField
            id="quantity"
            label="Quantity"
            value={state.quantity}
            onInput={(v) => update((s) => setQuantity(s, v))}
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
          <button type="button" class="icon-button icon-button-tall" aria-label="Reset" title="Reset" onClick={() => update(reset)}>
            <ResetIcon />
          </button>
        </div>
      </form>

      <div class="sticky-bar" ref={bar}>
        <SummaryLines evaluation={evaluation} onContinue={() => update(continueFrom)} />
      </div>

      {result && result.placed.length > 0 && (
        <UnitTable
          placed={result.placed}
          doneUnits={state.doneUnits}
          onToggle={(unit) => changeChecks((s) => toggleDone(s, unit))}
          onClear={() => changeChecks(resetChecks)}
          {...(advanced ? { colors: blockColors(layout.sequence ?? []) } : {})}
        />
      )}

      <footer class="app-footer">v{__APP_VERSION__}</footer>

      {panel === 'menu' && (
        <Menu
          mode={state.mode}
          onMode={(m) => {
            setWorkspace((ws) => switchMode(ws, m));
            close();
          }}
          onLayouts={() => switchTo('layouts')}
          onClose={close}
        />
      )}

      {updateNotice}
    </div>
  );
}
