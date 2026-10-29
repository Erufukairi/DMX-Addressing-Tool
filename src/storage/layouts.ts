// Saved layouts in IndexedDB via idb-keyval (design doc §3). Kept thin: the logic is in src/state/.
import { createStore, del, set, values, type UseStore } from 'idb-keyval';
import type { Layout } from '../engine';
import { isStoredLayout, sortByLastOpened } from '../state/working';

let store: UseStore | undefined;

// Created on first use, so a browser without IndexedDB (e.g. some file:// contexts) fails a call, not app startup.
function layoutsStore(): UseStore {
  store ??= createStore('dmx-address-table', 'layouts');
  return store;
}

/** Last opened first. Records that aren't a readable v1 layout are skipped. */
export async function listLayouts(): Promise<Layout[]> {
  const all = await values<unknown>(layoutsStore());
  return sortByLastOpened(all.filter(isStoredLayout));
}

export async function putLayout(layout: Layout): Promise<void> {
  await set(layout.id, layout, layoutsStore());
  requestPersistence();
}

export async function deleteLayout(id: string): Promise<void> {
  await del(id, layoutsStore());
}

let persistenceRequested = false;

// Makes eviction less likely where the browser honors it. Optional; failure is ignored.
function requestPersistence(): void {
  if (persistenceRequested) return;
  persistenceRequested = true;
  navigator.storage?.persist?.().catch(() => {});
}
