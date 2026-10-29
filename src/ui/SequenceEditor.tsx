import type { ItemErrors } from '../engine';
import {
  addBlock,
  addPattern,
  blockColors,
  duplicateItem,
  evaluate,
  moveItem,
  removeItem,
  setBlockField,
  setRepeat,
  toSequence,
  type DraftBlock,
  type DraftPattern,
  type WorkingState,
} from '../state/working';
import { NumberField, TextField } from './fields';
import { DeleteIcon, DownIcon, DuplicateIcon, UpIcon } from './icons';
import { SummaryLines } from './SummaryLines';

type Update = (change: (s: WorkingState) => WorkingState) => void;

interface SequenceEditorProps {
  state: WorkingState;
  update: Update;
  onBack: () => void;
}

/** Up, down, duplicate, delete for one block or pattern. */
function ItemActions({ id, name, first, last, update }: { id: string; name: string; first: boolean; last: boolean; update: Update }) {
  return (
    <div class="item-actions">
      <button type="button" class="icon-button" aria-label={`Move ${name} up`} disabled={first} onClick={() => update((s) => moveItem(s, id, -1))}>
        <UpIcon />
      </button>
      <button type="button" class="icon-button" aria-label={`Move ${name} down`} disabled={last} onClick={() => update((s) => moveItem(s, id, 1))}>
        <DownIcon />
      </button>
      <button type="button" class="icon-button" aria-label={`Duplicate ${name}`} onClick={() => update((s) => duplicateItem(s, id))}>
        <DuplicateIcon />
      </button>
      <button type="button" class="icon-button icon-danger" aria-label={`Delete ${name}`} onClick={() => update((s) => removeItem(s, id))}>
        <DeleteIcon />
      </button>
    </div>
  );
}

interface BlockCardProps {
  block: DraftBlock;
  index: number;
  count: number;
  errors: ItemErrors;
  color: number | undefined;
  update: Update;
}

function BlockCard({ block, index, count, errors, color, update }: BlockCardProps) {
  const e = errors[block.id] ?? {};
  const name = block.label.trim() || `block ${index + 1}`;
  return (
    <li class="card block-card" style={color ? { '--row-color': `var(--block-${color})` } : undefined}>
      <div class="block-fields">
        <TextField
          compact
          id={`${block.id}-label`}
          label="Label"
          value={block.label}
          placeholder="Optional"
          onInput={(v) => update((s) => setBlockField(s, block.id, 'label', v))}
        />
        <NumberField
          compact
          id={`${block.id}-footprint`}
          label="Footprint"
          value={block.footprint}
          error={e.footprint}
          onInput={(v) => update((s) => setBlockField(s, block.id, 'footprint', v))}
        />
        <NumberField
          compact
          id={`${block.id}-quantity`}
          label="Qty"
          value={block.quantity}
          error={e.quantity}
          onInput={(v) => update((s) => setBlockField(s, block.id, 'quantity', v))}
        />
      </div>
      <ItemActions id={block.id} name={name} first={index === 0} last={index === count - 1} update={update} />
    </li>
  );
}

interface PatternCardProps {
  pattern: DraftPattern;
  index: number;
  count: number;
  errors: ItemErrors;
  colors: Map<string, number>;
  update: Update;
}

function PatternCard({ pattern, index, count, errors, colors, update }: PatternCardProps) {
  const e = errors[pattern.id] ?? {};
  return (
    <li class="card pattern-card">
      <div class="pattern-head">
        <h3>Pattern</h3>
        <NumberField
          compact
          id={`${pattern.id}-repeat`}
          label="Repeat ×"
          value={pattern.repeat}
          error={e.repeat}
          onInput={(v) => update((s) => setRepeat(s, pattern.id, v))}
        />
      </div>
      {e.blocks && <p class="field-error">{e.blocks}</p>}
      <ul class="card-list">
        {pattern.blocks.map((b, i) => (
          <BlockCard
            key={b.id}
            block={b}
            index={i}
            count={pattern.blocks.length}
            errors={errors}
            color={colors.get(b.id)}
            update={update}
          />
        ))}
      </ul>
      <div class="pattern-foot">
        <button type="button" class="button" onClick={() => update((s) => addBlock(s, pattern.id))}>
          + Block
        </button>
        <ItemActions id={pattern.id} name={`pattern ${index + 1}`} first={index === 0} last={index === count - 1} update={update} />
      </div>
    </li>
  );
}

/**
 * Advanced-mode sequence editor (design doc §5.2), full screen. Edits apply live to the working
 * state; Back returns to the table. The saved copy only changes on Save.
 */
export function SequenceEditor({ state, update, onBack }: SequenceEditorProps) {
  const evaluation = evaluate(state);
  const errors = evaluation.errors.items ?? {};
  const colors = blockColors(toSequence(state.sequence));
  const count = state.sequence.length;

  return (
    <div class="panel editor">
      <header class="panel-header">
        <button type="button" class="button" onClick={onBack}>
          Back
        </button>
        <h1>Sequence</h1>
      </header>

      <div class="sticky-bar">
        <SummaryLines evaluation={evaluation} />
      </div>

      {evaluation.errors.sequence && <p class="field-error">{evaluation.errors.sequence}</p>}

      <ul class="card-list">
        {state.sequence.map((item, i) =>
          item.kind === 'block' ? (
            <BlockCard key={item.id} block={item} index={i} count={count} errors={errors} color={colors.get(item.id)} update={update} />
          ) : (
            <PatternCard key={item.id} pattern={item} index={i} count={count} errors={errors} colors={colors} update={update} />
          ),
        )}
      </ul>

      <div class="button-row editor-add">
        <button type="button" class="button" onClick={() => update(addBlock)}>
          + Block
        </button>
        <button type="button" class="button" onClick={() => update(addPattern)}>
          + Pattern
        </button>
      </div>
    </div>
  );
}
