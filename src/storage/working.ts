// The workspace in localStorage, so a relaunch comes back where the user was (phase-3-plan §2).
// Synchronous, so the app restores on first paint. Storage can be missing or throw; the app then starts fresh.
import { parseWorkspace, type Workspace } from '../state/workspace';

const KEY = 'dmx.workspace.v3';
/** Earlier builds' keys, read once so an update keeps work in progress; parseWorkspace converts them. */
const OLD_KEYS = ['dmx.working.v2', 'dmx.working.v1'];

export function loadWorkspace(): Workspace | null {
  try {
    for (const key of [KEY, ...OLD_KEYS]) {
      const raw = localStorage.getItem(key);
      if (raw !== null) return parseWorkspace(JSON.parse(raw));
    }
    return null;
  } catch {
    return null;
  }
}

export function saveWorkspace(ws: Workspace): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(ws));
    for (const key of OLD_KEYS) localStorage.removeItem(key);
  } catch {
    // Storage full or unavailable: keep working without it.
  }
}
