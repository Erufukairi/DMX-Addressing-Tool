interface FieldProps {
  id: string;
  label: string;
  value: string;
  onInput: (value: string) => void;
  error?: string | undefined;
  placeholder?: string;
  /** Smaller text, for the sequence editor's cards. */
  compact?: boolean;
}

/** Large numeric field with the numeric keypad, and its inline error underneath. */
export function NumberField({ id, label, value, onInput, error, placeholder, compact }: FieldProps) {
  const errorId = `${id}-error`;
  return (
    <div class={compact ? 'field field-compact' : 'field'}>
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

export function TextField({ id, label, value, onInput, placeholder, compact }: Omit<FieldProps, 'error'>) {
  return (
    <div class={compact ? 'field field-compact field-text' : 'field field-text'}>
      <label for={id}>{label}</label>
      <input
        id={id}
        type="text"
        autoComplete="off"
        enterKeyHint="done"
        value={value}
        placeholder={placeholder}
        onInput={(e) => onInput(e.currentTarget.value)}
      />
    </div>
  );
}
