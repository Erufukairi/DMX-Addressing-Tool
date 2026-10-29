import { useRef, useState } from 'preact/hooks';
import { useRegisterSW } from 'virtual:pwa-register/preact';

/**
 * Activate the waiting service worker, then reload into the new version.
 * Not the plugin's updateServiceWorker(): in iOS standalone apps resumed from the background,
 * its message or the `controlling` event it waits for can go missing, so the tap did nothing.
 * Here we message the waiting worker directly, reload on whichever signal comes first,
 * and reload anyway after a timeout.
 */
function applyUpdate(registration: ServiceWorkerRegistration | undefined) {
  let reloading = false;
  const reload = () => {
    if (reloading) return;
    reloading = true;
    window.location.reload();
  };
  const waiting = registration?.waiting;
  if (!waiting) {
    reload();
    return;
  }
  navigator.serviceWorker.addEventListener('controllerchange', reload);
  waiting.addEventListener('statechange', () => {
    if (waiting.state === 'activated') reload();
  });
  waiting.postMessage({ type: 'SKIP_WAITING' });
  setTimeout(reload, 3000);
}

/**
 * Running as the installed app. In a browser tab the notice did nothing when tapped (Firefox desktop,
 * iOS Safari), and tabs pick up the new version anyway the next time they're reopened.
 */
function isStandalone(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** Service worker updates: prompt, never auto-reload mid-job (phase-2-plan §2). Installed app only. */
export function useUpdateNotice() {
  const registration = useRef<ServiceWorkerRegistration | undefined>(undefined);
  const [updating, setUpdating] = useState(false);
  const {
    needRefresh: [needRefresh],
  } = useRegisterSW({
    onRegisteredSW(_url, r) {
      if (!r) return;
      registration.current = r;
      // Installed apps can stay open for days; check again whenever the app comes back to the foreground.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && navigator.onLine) {
          r.update().catch(() => {});
        }
      });
    },
  });
  const reload = () => {
    setUpdating(true);
    applyUpdate(registration.current);
  };
  return { needRefresh: needRefresh && isStandalone(), updating, reload };
}
