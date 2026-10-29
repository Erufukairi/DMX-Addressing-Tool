// Stand-in for `virtual:pwa-register/preact` in the single-file build (vite.config.ts).
// The file:// build never registers a service worker, so it never has an update.
import { useState } from 'preact/hooks';

export function useRegisterSW() {
  return {
    needRefresh: useState(false),
    offlineReady: useState(false),
    updateServiceWorker: async () => {},
  };
}
