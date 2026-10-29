import { useEffect, useRef } from 'preact/hooks';
import type { Mode } from '../state/working';

interface MenuProps {
  mode: Mode;
  onMode: (mode: Mode) => void;
  /** Open and Save both go to the Layouts page for now (design doc §5.5). */
  onLayouts: () => void;
  onClose: () => void;
}

/**
 * The hamburger menu (design doc §5.5): mode switch, Open, Save. Share, Backup, and Settings join it
 * as they're built, so nothing appears before it works. A modal sheet over the table; tapping
 * outside it, Escape, or the phone's Back gesture closes it.
 */
export function Menu({ mode, onMode, onLayouts, onClose }: MenuProps) {
  const sheet = useRef<HTMLDivElement>(null);
  useEffect(() => {
    sheet.current?.querySelector<HTMLButtonElement>('button[aria-pressed="true"]')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div class="menu-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div class="menu-sheet" role="dialog" aria-modal="true" aria-label="Menu" ref={sheet}>
        <div class="mode-switch" role="group" aria-label="Mode">
          {(['simple', 'advanced'] as const).map((m) => (
            <button type="button" key={m} aria-pressed={mode === m} onClick={() => onMode(m)}>
              {m === 'simple' ? 'Simple' : 'Advanced'}
            </button>
          ))}
        </div>
        <ul class="menu-items">
          <li>
            <button type="button" onClick={onLayouts}>
              Open
            </button>
          </li>
          <li>
            <button type="button" onClick={onLayouts}>
              Save
            </button>
          </li>
        </ul>
      </div>
    </div>
  );
}
