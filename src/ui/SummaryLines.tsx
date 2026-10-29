import type { Evaluation } from '../state/working';

interface SummaryLinesProps {
  evaluation: Evaluation;
  /** Continue (design doc §5.1). Omitted where Continue isn't offered, e.g. in the editor. */
  onContinue?: () => void;
}

/**
 * The two-line summary from design doc §4: units, then addresses, set tight like one wrapped line,
 * with Continue centered beside both.
 */
export function SummaryLines({ evaluation, onContinue }: SummaryLinesProps) {
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
      <div class="summary-text" role="status">
        <p class={summary.short ? 'summary-units summary-short' : 'summary-units'}>
          {summary.units}
          {summary.labels && <span class="summary-labels"> · {summary.labels}</span>}
        </p>
        <p class="summary-addresses">{summary.addresses}</p>
      </div>
      {onContinue && next !== null && (
        <button type="button" class="button button-primary" aria-label={`Continue from ${next}`} onClick={onContinue}>
          Next {next} →
        </button>
      )}
    </div>
  );
}
