import { useEffect, useState } from 'preact/hooks';
import type { Layout } from '../engine';
import { deleteLayout, listLayouts, newLayoutId, putLayout } from '../storage/layouts';
import {
  describeLayout,
  evaluate,
  hasUnsavedWork,
  layoutForSave,
  sortByLastOpened,
  suggestName,
  type WorkingState,
} from '../state/working';

interface LayoutsPanelProps {
  state: WorkingState;
  onBack: () => void;
  onOpen: (layout: Layout) => void;
  onSaved: (layout: Layout) => void;
  onDeleted: (id: string) => void;
}

/** Save, open, and delete layouts (design doc §5.4). Edits to an open layout need an explicit Save. */
export function LayoutsPanel({ state, onBack, onOpen, onSaved, onDeleted }: LayoutsPanelProps) {
  const [layouts, setLayouts] = useState<Layout[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [name, setName] = useState(() => state.saved?.name ?? suggestName(state));
  const [note, setNote] = useState(() => state.saved?.locationNote ?? '');

  useEffect(() => {
    listLayouts()
      .then(setLayouts)
      .catch(() => setProblem("Saving isn't available in this browser."));
  }, []);

  const canSave = evaluate(state).result !== null;
  const open = state.saved;

  async function save(asNew: boolean) {
    const id = open && !asNew ? open.id : newLayoutId();
    const layout = layoutForSave(state, { id, name, locationNote: note, now: Date.now() });
    try {
      await putLayout(layout);
      onSaved(layout);
    } catch {
      setProblem("Couldn't save. Storage may be full or unavailable.");
    }
  }

  function openLayout(layout: Layout) {
    if (hasUnsavedWork(state) && !window.confirm('Discard your unsaved changes?')) return;
    const opened = { ...layout, lastOpenedAt: Date.now() };
    putLayout(opened).catch(() => {});
    onOpen(opened);
  }

  async function remove(layout: Layout) {
    if (!window.confirm(`Delete "${layout.name}"?`)) return;
    try {
      await deleteLayout(layout.id);
      setLayouts((list) => sortByLastOpened((list ?? []).filter((l) => l.id !== layout.id)));
      onDeleted(layout.id);
    } catch {
      setProblem("Couldn't delete. Storage may be unavailable.");
    }
  }

  return (
    <div class="panel">
      <header class="panel-header">
        <button type="button" class="button" onClick={onBack}>
          Back
        </button>
        <h1>Layouts</h1>
      </header>

      <form
        class="save-form"
        onSubmit={(e) => {
          e.preventDefault();
          void save(false);
        }}
      >
        <h2>{open ? `Save "${open.name}"` : 'Save current layout'}</h2>
        <label class="text-field">
          <span>Name</span>
          <input type="text" value={name} onInput={(e) => setName(e.currentTarget.value)} autoComplete="off" />
        </label>
        <label class="text-field">
          <span>Location note</span>
          <input
            type="text"
            value={note}
            placeholder="e.g. Univ 4 - 1st Elec"
            onInput={(e) => setNote(e.currentTarget.value)}
            autoComplete="off"
          />
        </label>
        {!canSave && <p class="hint">Enter a valid footprint and start address to save.</p>}
        <div class="button-row">
          <button type="submit" class="button button-primary" disabled={!canSave || name.trim() === ''}>
            Save
          </button>
          {open && (
            <button
              type="button"
              class="button"
              disabled={!canSave || name.trim() === ''}
              onClick={() => void save(true)}
            >
              Save as new
            </button>
          )}
        </div>
      </form>

      {problem && <p class="problem">{problem}</p>}

      <section class="saved-list">
        <h2>Saved</h2>
        {layouts?.length === 0 && (
          <p class="hint">
            Nothing saved yet. Saved layouts keep their inputs and done checks. Changes to an open layout are kept
            only when you tap Save.
          </p>
        )}
        <ul>
          {layouts?.map((layout) => (
            <li key={layout.id} class={layout.id === open?.id ? 'is-open' : undefined}>
              <button type="button" class="saved-open" onClick={() => openLayout(layout)}>
                <span class="saved-name">{layout.name}</span>
                {layout.locationNote && <span class="saved-note">{layout.locationNote}</span>}
                <span class="saved-desc">{describeLayout(layout)}</span>
              </button>
              <button
                type="button"
                class="button button-danger"
                aria-label={`Delete ${layout.name}`}
                onClick={() => void remove(layout)}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
