# DMX Address Table App — Design Document

## 1. Purpose

A fast, offline, field-friendly tool that answers one question: **"What address does each unit start at?"**

The user enters a fixture footprint (number of DMX addresses per fixture) and a start address. The app shows each unit's start address and how many fixtures fit before address 512.

This is an **addressing tool, not a patching tool.** It has no concept of universes, fixture profiles, or console channels. Footprints are always typed in manually.

### Scope philosophy
The app covers two kinds of situations:
- jobs too simple to justify formal paperwork, and
- jobs where paperwork exists, but the app is a faster source of the answer.

Anything more complex belongs in Lightwright, Vectorworks, or a photo of the console patch. **When a feature is in doubt, leave it out.** Simplicity and speed of use beat completeness.

**Primary users:** lighting techs and stagehands addressing fixtures on a ladder or lift. Assume one hand, bright or dark environments, and no network.

## 2. Platform

**A single Progressive Web App (PWA)** for Android and iPhone. There is no native app and no Play Store listing for now.

- **iPhone:** install from Safari via Share → Add to Home Screen. It runs standalone and works offline.
- **Android:** install from Chrome.
- **Desktop:** works in any browser.

### iOS caveats (design around these)
- Safari may clear storage for PWAs that go unused for a long time. JSON export/import of saved layouts (§5.4) is the backup path.
- iOS shows no install prompt. Show a one-time "How to install" hint when the app detects iOS Safari and is not running standalone.

## 2a. Longevity Requirements

Earlier apps like this one died because they went unmaintained and stopped running on newer devices. Longevity is a primary design goal, equal to simplicity. The aim is an app that keeps working for years with **zero maintenance**.

**Principles**
- **Plain web first.** The app must be fully functional as a normal browser tab, not only when installed. Installing it, offline caching, wake lock, and Web Share are progressive enhancements. If a platform changes or removes PWA support, the worst case should be losing the home-screen icon, not losing the app.
- **No backend, no accounts, no network calls at runtime.** The app is purely static files. Nothing depends on a server staying up.
- **Baseline web features only.** Use only APIs supported in current Safari, Chrome, and Firefox. Feature-detect every optional API and hide its UI when unsupported. Do not use APIs Safari lacks (Web Bluetooth, Web Serial, install prompts, etc.).
- **No store builds.** Store wrappers (TWA, App Store shells) add yearly policy and toolchain upkeep. Revisit only if there's a compelling reason.

**Distribution resilience**
- Public open-source repository with a permissive license. This lets anyone fork, host, or fix it if the project goes quiet.
- Deploy to at least two independent free static hosts, e.g. GitHub Pages and Cloudflare Pages.
- The build also produces a **single self-contained `.html` file** with all JS and CSS inlined, published as a release asset. It must run when opened directly from local storage (`file://`). Service worker features are not required for this file.

**Service worker safety**
- The app shell uses a network-first or stale-while-revalidate update strategy, so a fixed release reaches users on their next online launch.
- Ship a documented **kill-switch** procedure: a replacement service worker that unregisters itself and clears caches. This is the recovery path if a bad release gets cached.
- Show the app version in the UI. Show an "update available, tap to reload" notice when a new version is waiting.

**Dependency discipline**
- Use as few runtime dependencies as possible: Preact (or none), `idb-keyval`, and nothing else without justification.
- Commit the lockfile. Keep the build config standard and minimal, so a future developer can rebuild it years later.
- The runtime does not depend on the build toolchain: the deployed output is plain HTML, CSS, and JS.

**Data durability**
- The JSON format is versioned (`schemaVersion`), and older versions always import correctly.
- Saved data is never only in browser storage without a way out. JSON export is always available.

## 3. Tech Stack

| Concern | Choice |
|---|---|
| Build | Vite + TypeScript (strict) |
| UI | Preact (or React), function components |
| Styling | Plain CSS with custom properties |
| PWA | `vite-plugin-pwa` (Workbox); precache everything; fully offline after first load |
| Storage | `localStorage` for settings; IndexedDB (via `idb-keyval`) for saved layouts |
| Tests | Vitest for the calculation engine (required) |
| Hosting | Any static host (GitHub Pages, Cloudflare Pages, Netlify) |

**Architecture rule:** all addressing math lives in a pure, framework-free module (`src/engine/`) with no DOM or storage access. The UI only calls into it.

## 4. Domain Rules

- Valid addresses are **1–512**.
- A fixture with footprint `F` starting at address `A` fits only if `A + F − 1 ≤ 512`. A fixture is never partially placed.
- **Unit #** is a simple incrementing sequence starting at 1. It always runs continuously across every block in the layout. It is not a channel number or a fixture label.
- **Overflow:** placement always stops when the next fixture won't fit. There is no rollover.

### Core calculation (simple mode)
```
fitCount      = floor((512 − start + 1) / footprint)
unit i (1-based):
  address     = start + (i − 1) × footprint
nextAddress   = start + fitCount × footprint      // first address after the last fixture
remaining     = 512 − nextAddress + 1             // addresses left
```
If `nextAddress > 512`, then `remaining = 0` and there is no next address.

### Summary line
Format: **"Fit 21 fixtures · 45 addresses left starting at 468"**

- If the universe is filled exactly: "Fit 32 fixtures · universe full".
- If a quantity was entered and some fixtures didn't fit: "Fit 21 of 24 fixtures · 3 didn't fit · 45 addresses left starting at 468".

## 5. Features

### 5.1 Simple Mode (default screen)
Inputs, as large numeric fields that use the numeric keypad:
- **Footprint** (addresses per fixture), required
- **Start address**, default 1
- **Quantity**, optional. If blank, the app fills to 512. If set, it shows that many fixtures, or as many as fit, and the summary flags the shortfall.

Output:
- The summary line (§4)
- A table with columns **Unit # | Address**
- Results update live as the user types. There is no Calculate button.

### 5.2 Advanced Mode (sequence builder)
For mixed or interleaved rigs. The user builds an ordered list of **blocks**:
- **Label** (optional, e.g. "Spot", "Wash")
- **Footprint**
- **Quantity**

Blocks are packed end-to-end from the start address. Unit # runs continuously across all blocks.

**Pattern repeat (interleaving):** the user can group consecutive blocks into a pattern and set a repeat count. For example, `[Spot ×1 (19), Wash ×1 (14)] × 8` produces Spot, Wash, Spot, Wash… along a pipe. If spare addresses are ever wanted between fixtures, they can be modeled as a block, so a separate gap setting isn't needed.

Output:
- **Summary line.** Same format as simple mode. Add a short per-label count if more than one label is used, e.g. "8 Spot, 8 Wash".
- **Table columns:** Unit # | Label | Address. Rows are color-coded per block.
- **Overflow.** If a fixture won't fit, placement stops there and the summary reports how many fixtures from which blocks didn't fit.

Block list interactions: add, duplicate, delete, reorder (drag handle plus up/down buttons), and collapse.

### 5.3 Field Usability
- Dark theme by default. Include a light theme and a red "night" theme.
- Minimum 48px touch targets and large table text.
- **Tap a row to mark it done** (checkmark plus dimmed row) while walking the pipe. Done-state is saved with the layout and has a "Reset checks" action.
- Screen wake lock toggle, where supported.

### 5.4 Save, Share, Export
- **Saved layouts:** each has a name. The list is sorted by last opened. Each layout includes an optional free-text **location note**, e.g. "Univ 4 - 1st Elec". This is the only place universe information appears, and the app treats it as plain text with no meaning.
- **Plain-text share:** the Web Share API opens the phone's share sheet (Messages, etc.), with clipboard copy as a fallback. Formatted for a text message:
  ```
  Univ 4 - 1st Elec
  Wash (14) / Spot (19)
  1: 1 Wash
  2: 15 Spot
  3: 34 Wash
  ...
  Next free: 265
  ```
  Simple mode omits the labels: `1: 1`, `2: 20`, …
- **JSON app-to-app:** export one layout or all layouts as a `.json` file, sent through the share sheet or a download. Importing a file adds layouts and never overwrites existing ones. The same mechanism also serves as the backup for the iOS storage caveat.

## 6. Data Model (TypeScript)

```ts
interface Block {
  id: string;
  label?: string;
  footprint: number;      // 1–512
  quantity: number;       // ≥1
}

interface Pattern {
  id: string;
  blocks: Block[];
  repeat: number;         // ≥1
}

type SequenceItem = Block | Pattern;

interface Layout {
  id: string;
  name: string;
  locationNote?: string;  // free text, e.g. "Univ 4 - 1st Elec"; used only in shares
  mode: 'simple' | 'advanced';
  startAddress: number;
  simple?: { footprint: number; quantity?: number };
  sequence?: SequenceItem[];
  doneUnits: number[];
  updatedAt: number;
  schemaVersion: 1;
}

interface PlacedFixture {
  unit: number;
  label?: string;
  blockId?: string;
  address: number;
  endAddress: number;
}

interface LayoutResult {
  placed: PlacedFixture[];
  notPlaced: { blockId?: string; label?: string; count: number }[];
  nextAddress: number | null;   // null when 512 is used exactly
  remaining: number;
}
```

Engine entry points:
- `computeLayout(layout: Layout): LayoutResult`, which is pure and deterministic
- `formatShareText(layout, result): string`, which is also pure and is also tested

## 7. Validation & Edge Cases

These must be covered by unit tests:
- Footprint of 0, negative, non-integer, or greater than 512 → inline error, no table.
- Start address outside 1–512 → inline error.
- Footprint 512 at start 1 → 1 fixture, "universe full". Footprint 512 at start 2 → 0 fixtures, with a clear message.
- Footprint 1 at start 1 → 512 rows. The table must stay smooth (virtualize if needed).
- Exact fill → `nextAddress` is null, and the summary reads "universe full".
- Simple-mode quantity larger than the fit count → shortfall is reported correctly.
- Advanced mode where a later block doesn't fit → earlier placements stay unchanged and the not-placed count is correct.
- Overflow partway through a pattern repeat → place up to the first fixture that doesn't fit, then stop. Do not skip ahead to try smaller fixtures later in the sequence.
- Unit # stays continuous across blocks and pattern repeats.
- Importing a malformed or old-schema JSON file → friendly error, with migration through `schemaVersion`.

## 8. Build Phases

### Phase 1 — Scaffolding + engine + tests

**Scaffold** (on a fresh repo containing only `docs/DESIGN.md` and `CLAUDE.md`):
- Create a Vite project with the `preact-ts` template.
- Turn on TypeScript `strict`.
- Install dependencies. Runtime: `preact` and `idb-keyval` only. Dev: `vite`, `@preact/preset-vite`, `typescript`, `vite-plugin-pwa`, `vitest`, `vite-plugin-singlefile` (for the self-contained HTML build in §2a). Pin exact versions and commit the lockfile.
- Install `vite-plugin-pwa`, but leave it unconfigured here; the manifest and service worker come in Phase 2.
- Set the Vite `base` to `./` (relative paths), so the same build works on GitHub Pages subpaths, other hosts, and the single-file build.
- Add a `.gitignore` (node_modules, dist), an `.editorconfig`, and an MIT `LICENSE`.
- Add a `README.md` with the project purpose, dev commands, and a link to `docs/DESIGN.md`.

**Folder layout:**
```
docs/DESIGN.md
CLAUDE.md
src/
  engine/            # pure TS: no DOM, no storage, no Preact imports
    types.ts         # data model from §6
    layout.ts        # computeLayout()
    shareText.ts     # formatShareText()
    validate.ts      # input validation
    index.ts         # public exports
  ui/                # Preact components (Phase 2+)
  storage/           # idb-keyval wrappers (Phase 3)
  main.tsx
tests/
  engine/            # Vitest specs mirroring src/engine/
public/              # icons, manifest assets (Phase 2)
```

**npm scripts:**
| Script | Does |
|---|---|
| `dev` | Vite dev server |
| `dev:lan` | Vite dev server with `--host`, for testing on a phone over the LAN |
| `build` | Type-check (`tsc --noEmit`), then production build to `dist/` |
| `build:single` | Self-contained single-file HTML build to `dist-single/` |
| `preview` | Serve the production build locally |
| `test` | Run Vitest once |
| `test:watch` | Run Vitest in watch mode |
| `typecheck` | `tsc --noEmit` |

Prettier and ESLint are not required. Add them only if they cause no friction.

**Engine work:**
- `computeLayout` for simple mode, with types for advanced mode already defined.
- `formatShareText` for simple mode.
- `validate` returns field-level errors.
- Tests cover every simple-mode case in §7.

**Placeholder UI:** `main.tsx` renders bare inputs plus a JSON dump of the `computeLayout` result. This is just enough to confirm the engine is wired up; it is not real UI.

**Done when:**
- `npm test`, `npm run typecheck`, `npm run build`, and `npm run build:single` all pass.
- `dist-single/index.html` opens directly from disk and shows the placeholder.
- The engine has no imports outside `src/engine/`.

### Phase 2 — Simple mode UI + deployment pipeline

**UI:** inputs, live table, summary line, dark theme, PWA manifest, icons, service worker (§2a update strategy), and offline support.

**Deployment.** Set this up early in the phase: service workers and installation only work over HTTPS, so all on-phone PWA testing happens on deployed builds.
- **GitHub Pages (production):** a GitHub Actions workflow runs on every push to `main`. It runs `npm ci`, `npm test`, `npm run typecheck`, and `npm run build`, then deploys `dist/` with the official `actions/deploy-pages` action. A failing test blocks the deploy.
- **Cloudflare Pages (second host + previews):** connect the repo through the Cloudflare dashboard. Build command is `npm run build`, output directory is `dist`. `main` deploys to the Cloudflare production URL, and every other branch gets its own preview URL automatically. Feature branches are tested on a phone through their preview URL before merging.
- **Single-file release asset:** a workflow on version tags (`v*`) runs `npm run build:single` and attaches `dist-single/index.html` to a GitHub Release.
- **Version display:** inject the version from `package.json` at build time, along with the short git hash for non-release builds. Show it in the UI as §2a requires.
- Add both production URLs to `README.md`.

**Done when:**
- A push to `main` deploys to both hosts.
- A branch push produces a Cloudflare preview URL.
- **On a real Android phone:** the app installs from Chrome, launches standalone, and works in airplane mode.
- **On a real iPhone:** Add to Home Screen works, the app launches standalone, and it works in airplane mode.
- **Update path:** after a new deploy, the installed app shows the "update available" notice and picks up the new version.

### Phase 3 — Persistence

Save, load, and delete layouts; location note; done checkmarks.

### Phase 4 — Advanced mode

Block editor, patterns with repeat, labels and colors.

### Phase 5 — Share & transfer

Plain-text share sheet with clipboard fallback; JSON export and import.

### Phase 6 — Polish

Red night theme, wake lock, iOS install hint, accessibility pass.

Each phase should end with a working, deployable build.

## 9. Deferred — revisit after field use

- **Reserved address ranges**, e.g. skipping 1–24 for house dimmers. It's unclear whether the usefulness justifies the added complexity.

## 10. Out of Scope

- Universes, rollover, and absolute addressing
- Address rounding and gap settings
- CSV, PDF, and print export
- Fixture profile libraries; RDM or any live DMX output
- Native Android or Play Store build
