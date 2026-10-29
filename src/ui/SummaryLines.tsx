import type { Evaluation } from '../state/working';

interface SummaryLinesProps {
  evaluation: Evaluation;
  /** Continue (design doc §5.1). Omitted where Continue isn't offered, e.g. in the editor. */
  onContinue?: () => void;
  /** Reset checks, shown at the end of line 1 when given. Its final home is still to be decided (§5.3). */
  onResetChecks?: () => void;
}

/** The two-line summary from design doc §4: units on line 1, addresses and Continue on line 2. */
export function SummaryLines({ evaluation, onContinue, onResetChecks }: SummaryLinesProps) {
  const { summary, status } = evaluation;
  if (!summary) {
    return (
      <p class="summary-idle" role="status">
        {status}
      </p>
    );
  }
  const next = summary.nextAddress;
  return (
    <div class="summary">
      <div class="summary-line">
        <p class={summary.short ? 'summary-units summary-short' : 'summary-units'} role="status">
          {summary.units}
          {summary.labels && <span class="summary-labels"> · {summary.labels}</span>}
        </p>
        {onResetChecks && (
          <button type="button" class="button button-small" onClick={onResetChecks}>
            Reset checks
          </button>
        )}
      </div>
      <div class="summary-line">
        <p class="summary-addresses">{summary.addresses}</p>
        {onContinue && next !== null && (
          <button
            type="button"
            class="button button-primary"
            aria-label={`Continue from ${next}`}
            onClick={onContinue}
          >
            Next {next} →
          </button>
        )}
      </div>
    </div>
  );
}
