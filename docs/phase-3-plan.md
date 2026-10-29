# Phase 3 Plan — Persistence

Implementation plan for Phase 3 of [the design doc](dmx-address-table-design.md) (§8). Read the design doc first; this file records the decisions made while planning, so they don't need to be re-derived.

Scope: save, load, and delete layouts; location note; done checkmarks; the simple mode **Reset** and **Continue from next address** actions (§5.1). Simple mode only. Advanced mode is Phase 4.

## Status at hand-off

- Phase 2 is deployed to both hosts from `main`:
  - GitHub Pages: https://erufukairi.github.io/DMX-Addressing-Tool/
  - Cloudflare: https://dmx-addressing-tool.brandon-kitson.workers.dev/
- The app is installed on a real Android phone and a real iPhone.
- The update path works on Android.
- **iPhone update path:** the banner appears when the app returns to the foreground, but tapping it did nothing; only a full close and relaunch picked up the update. Commit `95ffca5` changes the tap handler so it doesn't depend on the plugin's update events, and shows "Updating…" when tapped. It is **not verified on a device yet**. The user chose not to deploy just to test it. Check it on the first Phase 3 deploy:
  1. Make sure the iPhone app is running `+95ffca5` or later before that deploy.
  2. After the deploy, bring the app to the foreground and tap the banner.
  3. Expected: "Updating…", then a reload into the new version.
  4. If it shows "Updating…" but doesn't reload, the timeout fallback reloaded with the old worker still in control. Look at `applyUpdate` in `src/ui/App.tsx`.
- Airplane mode works on both phones.
- The Cloudflare branch preview check was skipped for now by the user's choice.

## Decisions made while planning

These came from the user:

- **Explicit Save.** Edits to the inputs of an open saved layout are not written to it until the user taps Save. The user isn't yet sure how saved layouts will be used in practice, so this is the conservative option, and the saved-layout UI should stay minimal.
  - Done checks are the exception: toggling a check on an open saved layout writes it immediately, *as long as the inputs have no unsaved changes*. If the inputs have unsaved changes, the checks belong to the edited inputs and are saved by the next Save.
- **Restore last state on relaunch.** The current working state (inputs, done checks, and which saved layout is open, if any) is kept on the device automatically, saved or not. A phone killing the app in the background must not lose work.
- **Clear checks on change.** Changing footprint or start address clears all done checks, since every unit's address moves. Changing quantity keeps the checks for units that still exist and drops the rest.

These were decided during planning:

- **Reset and Continue start a new, unsaved working layout.** They detach from any open saved layout and never change it. Both also clear done checks.
  - Reset: footprint blank, start 1, quantity blank.
  - Continue: start = the summary's next address; footprint and quantity blank. Shown only when there is a next address.
- **"Sorted by last opened" needs a field.** Add optional `lastOpenedAt?: number` to `Layout`. It's optional, so `schemaVersion` stays 1 and older data still reads. Update design doc §6. `updatedAt` keeps meaning "last saved".
- **No router.** The layouts screen is a full-screen panel switched by component state.
- **Confirmations use native `window.confirm()`.** It works in iOS and Android standalone apps and needs no custom dialog. It's used for deleting a layout and for discarding unsaved changes.

## Order of work

### 1. Working-state logic (pure, tested)

All state transitions live in one pure module so they can be tested without a DOM or storage.

- **`src/state/working.ts`**: framework-free; it may import from `src/engine/`.
  - `WorkingState`: the current inputs as typed strings (footprint, start, quantity, so partial typing round-trips), `doneUnits`, plus `openId?: string` and `saved?: Layout` (the stored copy of the open saved layout, used to detect unsaved changes).
  - A reducer, or plain functions, for: `setFootprint`, `setStart`, `setQuantity`, `toggleDone(unit)`, `resetChecks`, `reset`, `continueFrom(nextAddress)`, `openSaved(layout)`, `markSaved(layout)`.
  - `toLayout(state)`: builds the `Layout` the engine and storage use.
  - `isDirty(state)`: true when the inputs, name, or location note differ from `saved`. Compare values, not the typed strings, so "019" and "19" count as the same.
  - Check-clearing rules from the decisions above. For a quantity change, drop checks for units above the new placed count. If the new inputs don't validate, leave checks alone until they do.
- **`tests/state/working.test.ts`**: every transition and rule above, including:
  - Continue from the exact-fill case is not offered (no next address).
  - Reset and Continue detach from the open layout.
  - A quantity change keeps lower checks.
  - Typing `"019"` over `"19"` isn't dirty.

### 2. Storage

- **`src/storage/layouts.ts`**: thin `idb-keyval` wrapper with its own store, `createStore('dmx-address-table', 'layouts')`, keyed by layout id.
  - `listLayouts()` sorted by `lastOpenedAt` (falling back to `updatedAt`), newest first; `getLayout(id)`; `putLayout(layout)`; `deleteLayout(id)`.
  - Records that aren't a readable v1 simple layout are skipped, not thrown. Full import validation and migration come with JSON import in Phase 5.
- **`src/storage/working.ts`**: the working state in `localStorage` (design doc §3: settings-like, synchronous, so the app restores on first paint with no flash). One versioned key, e.g. `dmx.working.v1`. Every read and write is wrapped in `try/catch`; on failure the app starts with defaults.
- **Persistent storage:** on the first save, call `navigator.storage.persist()` if it exists. It makes eviction less likely on platforms that honor it. Feature-detected, and failure is ignored.
- **Testing:** jsdom/fake IndexedDB would be new dev dependencies, so skip them. Keep the storage wrappers thin enough that the pure state tests carry the logic, and cover the storage paths in the on-device checks.

### 3. UI

- **Main screen** (`src/ui/App.tsx`, splitting out components where it helps):
  - **Reset** button near the inputs, at least 48px.
  - **Continue** button at the end of the summary line, labelled with the address, e.g. "Continue from 495".
  - **Tap a row to toggle done:** checkmark plus dimmed row. Each row's content is a full-width `<button aria-pressed>` so it is keyboard- and screen-reader-accessible.
  - **Reset checks** appears when any unit is checked.
  - **Header:** the open layout's name (or nothing for an unsaved working layout), an "Unsaved changes" marker when dirty, and a **Layouts** button. The version stays in the header.
- **Layouts panel** (`src/ui/LayoutsPanel.tsx`), full-screen, with a Back button:
  - **Save section:** Name (required; prefilled with a suggestion like "19ch × 26 @ 1") and Location note (optional, free text).
    - Nothing open: **Save**.
    - A saved layout is open: **Save** (overwrite) and **Save as new**.
  - **Saved list:** name, location note, and a one-line description (footprint, count, start). Tap to open; it prompts first if the working state has unsaved changes. Opening sets `lastOpenedAt`.
  - **Delete** on each entry, with a confirm. Deleting the open layout leaves its contents as an unsaved working layout.
  - Empty state: one line saying how saving works.
- **Name and location note** are edited in the Layouts panel only, so the main screen stays three numbers and a table.

### 4. Docs

- **Design doc §6:** add `lastOpenedAt?: number` to `Layout`.
- **Design doc §5.4:** note that edits need an explicit Save, while done checks on an unmodified saved layout save immediately.
- **Design doc §4:** the summary example ("Fit 21 fixtures · 45 addresses left starting at 468") is still the impossible one noted in the Phase 2 plan. Fix it, e.g. footprint 24 from 1 gives "Fit 21 fixtures · 8 addresses left starting at 505".

### 5. Finish

- Run `npm test`, `typecheck`, `build`, and `build:single` before calling the phase done.
- Deploy and do the on-device checks below.

## Done when

- All four commands pass, and a push to `main` deploys to both hosts.
- On both phones:
  - Save a layout with a location note, open it from the list, and delete it.
  - Tick some checks, close the app from the app switcher, and relaunch: inputs and checks are restored.
  - Edit an open saved layout: "Unsaved changes" shows, and the stored copy is unchanged until Save.
  - Reset and Continue behave as above and leave the saved layout untouched.
- The iPhone update banner check from "Status at hand-off".
- The single-file build still works from `file://`. Storage may be unavailable there; the app must still run.

## Out of scope for this phase

- Advanced mode and its per-block colours (Phase 4).
- Share text, JSON export/import, and full schema migration (Phase 5).
- Themes, wake lock, and the iOS install hint (Phase 6).
