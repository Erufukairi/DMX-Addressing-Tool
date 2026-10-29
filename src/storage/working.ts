// The working state in localStorage, so a relaunch comes back where the user was (phase-3-plan §2).
// Synchronous, so the app restores on first paint. Storage can be missing or throw; the app then starts fresh.
import { parseWorkingState, type WorkingState } from '../state/working';

const KEY = 'dmx.working.v2';
/** Phase 3's key. Read once so an update keeps work in progress; parseWorkingState converts it. */
const V1_KEY = 'dmx.working.v1';

export function loadWorkingState(): WorkingState | null {
  try {
    const raw = localStorage.getItem(KEY) ?? localStorage.getItem(V1_KEY);
    return raw === null ? null : parseWorkingState(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveWorkingState(state: WorkingState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    localStorage.removeItem(V1_KEY);
  } catch {
    // Storage full or unavailable: keep working without it.
  }
}
