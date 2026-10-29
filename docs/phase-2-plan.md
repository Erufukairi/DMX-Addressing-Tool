# Phase 2 Plan — Simple mode UI + deployment pipeline

Implementation plan for Phase 2 of [the design doc](dmx-address-table-design.md) (§8). Read the design doc first; this file records the decisions made while planning, so they don't need to be re-derived.

## Status at hand-off

- Phase 1 is complete and committed. `npm test`, `typecheck`, `build`, and `build:single` all pass.
- The repo is on GitHub as `Erufukairi/<repo>`. It was renamed on GitHub after the first push, so check `git remote -v` and update with `git remote set-url` if it still points at the old name.
- Phase 2 work has not started.

## Order of work

Set up deployment first. Service workers and installation only work over HTTPS, so phone testing depends on deployed builds.

### 1. Deployment

- **`.nvmrc`**: pin the Node major version (Node 26 was used locally). GitHub Actions (`node-version-file`) and Cloudflare Pages both read it.
- **`.github/workflows/deploy.yml`**: runs on push to `main`, plus `workflow_dispatch`.
  - Steps: `npm ci`, `npm test`, `npm run typecheck`, `npm run build`.
  - Publish `dist/` with `actions/upload-pages-artifact` and `actions/deploy-pages`.
  - A failing test blocks the deploy.
  - Permissions: `pages: write`, `id-token: write`.
- **`.github/workflows/release.yml`**: runs on `v*` tags.
  - Runs `npm run build:single`.
  - Attaches `dist-single/index.html` to a GitHub Release using the `gh` CLI that is preinstalled on runners. No third-party release action, to reduce long-term upkeep.
  - Permissions: `contents: write`.
- **Cloudflare Pages**: no repo files needed. Configured in the dashboard by the user: build command `npm run build`, output directory `dist`. If the build fails, set the `NODE_VERSION` environment variable to match `.nvmrc`.
- **Version display**: inject the version at build time through Vite `define`.
  - The version comes from `package.json`.
  - Non-release builds append the short commit hash. Sources, in this order: `GITHUB_SHA`, `CF_PAGES_COMMIT_SHA`, then `git rev-parse --short HEAD`.
  - A build is a release when `GITHUB_REF_TYPE === 'tag'`; release builds show no hash.
  - Put the version-string logic in a small pure function with a Vitest test. It must stay outside `src/engine/`, because it is build config, not addressing math.

### 2. PWA

- **`vite-plugin-pwa` (v2.0.0, `generateSW`)**:
  - `registerType: 'prompt'`.
  - Precache all build output so the app is fully offline after the first load.
  - Manifest: `start_url: './'`, `scope: './'`, `display: 'standalone'`, dark `theme_color` and `background_color`.
- **Update strategy (§2a)**: serve from the precache, detect a new service worker in the background, and show an "Update available, tap to reload" notice.
  - Also call `registration.update()` on `visibilitychange` when the app becomes visible again. Phone PWAs can stay open for days.
  - **Decision:** prompt rather than auto-update. Auto-update could reload mid-job, and the design doc asks for the notice. This is the stale-while-revalidate option §2a allows. Network-first was rejected because it stalls on weak venue signal.
  - Use `useRegisterSW` from `virtual:pwa-register/preact`.
- **Single-file build**: do not load the PWA plugin when `mode === 'single'`.
  - Alias `virtual:pwa-register/preact` to a local stub that reports no update, so the `file://` build never registers a service worker.
  - The version still shows.
- **Kill-switch**: document it in `docs/kill-switch.md`. The procedure is to set `selfDestroying: true` in the `VitePWA` options and deploy. The plugin then emits a service worker that unregisters itself and clears caches.
  - Build it once locally and inspect the generated `dist/sw.js` to confirm it really does this before documenting.
  - Include how to revert after recovery.
- **Icons**: draw one simple SVG by hand and render it once to PNG using headless Edge (`msedge --headless=new --screenshot`). Commit the results to `public/`. Sizes:
  - 192
  - 512
  - maskable 512, with safe-zone padding
  - 180 for the Apple touch icon

  No icon-generator dependency.
- **`index.html` head**:
  - `apple-touch-icon`
  - `apple-mobile-web-app-capable`
  - `apple-mobile-web-app-status-bar-style`
  - `theme-color`
  - `viewport-fit=cover`

### 3. Simple mode UI (replaces the Phase 1 placeholder in `src/main.tsx`)

- **Files**:
  - `src/main.tsx` only renders.
  - `src/ui/App.tsx` holds the inputs, summary, table, and the footer with the version and update notice.
  - `src/ui/styles.css` holds the styles.
  - Split into more components only where it helps.
- **Styling**: plain CSS with custom properties. Dark theme only in this phase; light and red night themes come in Phase 6. Define colors as tokens so themes can be added later.
- **Inputs**:
  - Footprint (required), start address (default 1), and quantity (optional).
  - Large fields with `inputmode="numeric"`.
  - Field-level errors from `validateSimple` appear inline under each field.
  - No table while there are errors.
  - Results update live as the user types; there is no Calculate button.
- **Output**:
  - The `formatSummary` line, sticky at the top of the results.
  - A table with columns Unit # | Address, in large text.
- **Touch targets**: at least 48px.
- **Long tables**: start with a plain table. Footprint 1 gives 512 rows; test scrolling on a phone and virtualize only if it is actually slow.
- **Out of scope for this phase**:
  - Tap-to-mark-done and persistence (Phase 3).
  - Share and export (Phase 5).
  - Wake lock and the iOS install hint (Phase 6).

### 4. Finish

- Add both production URLs to `README.md`.
- Run `npm test`, `typecheck`, `build`, and `build:single` before calling the phase done.

## Needed from the user

- In GitHub repo **Settings → Pages**, set Source to **GitHub Actions**.
- Create the Cloudflare Pages project connected to the repo, using the settings above.
- Provide both production URLs.
- Do the on-device checks from the design doc's "Done when" list:
  - Android install and airplane mode.
  - iPhone Add to Home Screen and airplane mode.
  - The update notice after a new deploy.

## Notes carried over from Phase 1

- The summary example in design doc §4 ("Fit 21 fixtures · 45 addresses left starting at 468") can't occur: 45 addresses left implies another fixture fits unless the footprint is over 45. Tests use the doc's format with real numbers instead. The doc example should be corrected.
- The design doc refers to `docs/DESIGN.md` and `CLAUDE.md`. The actual files are `docs/dmx-address-table-design.md` and `claude.md`.
- Phase 1 behavior that the design doc doesn't specify:
  - `computeLayout` throws on advanced-mode layouts until Phase 4.
  - The "nothing fits" summary wording was chosen during Phase 1.
  - Simple-mode share text has a `Footprint N` header line.
