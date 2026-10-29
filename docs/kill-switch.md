# Service worker kill-switch

The recovery path if a bad release gets cached on users' devices (design doc §2a). It replaces the app's service worker with one that unregisters itself and deletes every cache, so the next load comes straight from the network.

Normal fixes don't need this. A fixed release reaches installed apps through the usual "Update available, tap to reload" notice. Use the kill-switch only when that path is broken, for example a release that crashes before it can show the notice, or a broken service worker.

## Turn it on

1. In `vite.config.ts`, add `selfDestroying: true` to the `VitePWA({ ... })` options.
2. Commit and push to `main`. Both hosts deploy it.
3. Check the deployed `sw.js` (e.g. `https://<host>/sw.js`). It should be a short script, not a Workbox precache list.

## What the generated `sw.js` does

Checked against `vite-plugin-pwa` 2.0.0 by building with the flag and reading `dist/sw.js`:

- On `install`, it calls `skipWaiting()`. It does not wait for the user to tap the update notice.
- On `activate`, it calls `registration.unregister()`, reloads every open page it controls (`client.navigate(client.url)`), and deletes all Cache Storage caches.

The browser fetches `sw.js` from the network when the app is opened online, at most once a day by default, and the app also checks when it returns to the foreground. So each device picks up the kill-switch on its next online launch. Devices that stay offline keep the old version until they reconnect.

The app's registration code still runs with the flag on. Each page load registers the self-destroying worker again, and it unregisters itself again. That's harmless: only the first activation finds pages to reload, because later loads aren't controlled by it, so there is no reload loop. The app works as a plain web page, with no offline support, while the flag is on.

## Turn it off again

1. Fix the underlying problem.
2. Remove `selfDestroying: true` from `vite.config.ts`, commit, and push.
3. Devices register the normal service worker on their next online visit and are offline-capable again after that load.

Keep the kill-switch deployed long enough for affected devices to come online and pick it up, typically a few days to a week, before reverting.
