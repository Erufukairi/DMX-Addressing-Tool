# Phase 4 Plan — Advanced mode

Implementation plan for Phase 4 of [the design doc](dmx-address-table-design.md) (§8). Read the design doc first; this file records the decisions made while planning, so they don't need to be re-derived.

Scope:
- The simple-mode refinements decided after Phase 3 field use (design doc §4, §5.1, §5.3).
- Advanced mode (§5.2): blocks with label, footprint, and quantity; patterns with repeat; labels and colors; the Unit # | Label | Address table; per-label summary; overflow reporting.

## Status at hand-off

- Phase 3 is deployed (`bc4a808`) and in field use on both phones.
- All Phase 3 on-device checks pass:
  - The iPhone update-banner fix from `95ffca5` now works in the installed app.
  - Save, open, delete.
  - Relaunch restore.
  - Unsaved-changes behavior.
  - Reset and Continue.
- **Update banner in a browser tab:** the banner shows, but tapping it does nothing (seen in Firefox on desktop and Safari on iOS). It works in the installed app. Fixed in step 1 below.

## As built

Where the implementation differs from the plan below:

- **No separate Edit button.** The sequence description is itself the edit button: a field-styled button showing e.g. "[Spot 19, Wash 14] ×8" with "Edit" at its right end. A separate button left about 100px for the description on a phone.
- **Reset checks** is a small button at the right end of summary line 1, which had spare room, so it needs no line of its own. Its final home is still to be decided (design doc §5.3).
- **`--warning`** is the same red as `--error` for now, as its own token so themes can split them.
- **Mode switch** is a full-width Simple | Advanced segmented control under the header.
- Verified with a scratch browser-driving script (40 checks, served build and `file://` single-file build), covering the v1 → v2 conversion, the simple-mode refinements, the editor, overflow, mode switching, and save/open/edit of an advanced layout.
- The user is collecting more UI ideas from field use and will raise them later. Don't anticipate them.

## Decisions made while planning

These came from the user:

- **Separate edit screen.** The block editor is a full-screen panel, like the Layouts panel.
  - The main screen keeps the same shape in both modes: header, inputs row, sticky summary, table.
  - In advanced mode, the inputs row is the start address, a one-line sequence description (tap to edit), an **Edit** button, and the Reset icon.
- **Block interactions:** add, delete, up/down reorder, and **duplicate**.
  - Drag-to-reorder and collapse are left out. Up/down covers reordering. Collapse matters little on a dedicated edit screen.
  - Update design doc §5.2 to match.
- **Each mode keeps its own inputs.**
  - Switching modes loses nothing.
  - The first time advanced mode is opened (no sequence yet), its first block is seeded from the simple footprint and quantity.
  - The start address is shared by both modes: it's the same position in the universe.
- **Simple-mode refinements** (design doc §4, §5.1, §5.3), done first because advanced mode shares the summary and table:
  - Two-line summary: units on line 1, addresses on line 2.
  - A shortfall shows as "x of y units" in a warning color, with no "n didn't fit".
  - Continue is labelled **Next 505 →** and sits beside line 2.
  - No "x of y done" count.
  - No confirmation on Reset or Reset checks.
  - **Reset checks stays where it is for now.** Its final location is still to be decided (design doc §5.3). Without the done count it becomes a lone button; keep it compact and right-aligned.

These were decided during planning:

- **Colors by label.**
  - Blocks with the same label share a color, wherever they appear, including inside and outside patterns. Unlabeled blocks get their own color each.
  - Use a fixed palette of 6 tokens defined in CSS (`--block-1` … `--block-6`), cycling if there are more.
  - Show color as a stripe on the row's left edge, and as the label's text color. The label text is always present, so color is never the only cue.
  - The red night theme (Phase 6) will need its own answer for these; note it there.
- **Patterns hold blocks only**, as the data model already says: no nested patterns.
  - A pattern card has its own repeat field and its own block list, with add, delete, up/down, and duplicate inside it.
  - Blocks are not moved into or out of patterns. Delete and re-add instead. When in doubt, leave it out.
- **Editor edits apply live** to the working state. There is no Apply/Cancel. Back (button or phone gesture) returns to the table. This matches the explicit-Save model: the saved copy only changes on Save.
- **Advanced block quantity is required** (≥1), as §5.2 says. There's no "fill" in advanced mode.
- **Check clearing** follows the Phase 3 rule: any change that can move addresses clears all done checks. That means start, any footprint, quantity, or repeat, and adding, deleting, duplicating, or reordering items. Label edits keep checks.
- **Reset in advanced mode:** start 1 and a single empty block. **Continue in advanced mode:** start = next address and a single empty block. In both cases the simple-mode inputs are untouched.
- **Overflow:**
  - Placement walks the expanded sequence in order and stops at the first fixture that doesn't fit, as design doc §7 says. It never skips ahead to a smaller fixture.
  - `notPlaced` has one entry per block (by `blockId`), summed across pattern repeats, in sequence order, with zero counts omitted.

## Order of work

### 1. Simple-mode refinements

- **Engine:** replace the string `formatSummary` with a structured result so the UI can lay out two lines and color the shortfall, e.g.:
  ```ts
  interface Summary {
    units: string;          // "21 units", "21 of 24 units", "No units fit"
    short: boolean;         // warning color on line 1
    labels?: string;        // advanced only, e.g. "8 Spot, 6 of 8 Wash"
    addresses: string;      // "8 addr left", "universe full", "511 addr left"
    nextAddress: number | null;
  }
  ```
  Update `tests/engine/summary.test.ts` to the table in design doc §4.
- **UI** (`App.tsx`, `styles.css`):
  - Two-line summary. Line 2 has **Next 505 →** at its right end, with `aria-label="Continue from 505"`.
  - Remove the done count.
  - Remove `confirmClearChecks`.
  - Add a warning-color token, `--warning`, distinct from the input-error red.
- **Update banner only in the installed app.**
  - Show it only when running standalone: `matchMedia('(display-mode: standalone)')` or iOS `navigator.standalone`.
  - A browser tab picks up the new version on its own the next time it is closed and reopened, and browsers prune idle tabs often.
  - If hiding it turns out to be awkward, the fallback the user accepts is for the tap to simply reload the page.
  - Update design doc §2a, which says to show the notice, to say "in the installed app".
- **Design doc §4:** remove the "not yet implemented" status note once this ships.

### 2. Engine: advanced mode

- **`src/engine/validate.ts`**: `validateAdvanced(layout)` returns:
  - Start address error (same rule as simple).
  - Per-item field errors keyed by item id, e.g. `{ [blockId]: { footprint?, quantity? }, [patternId]: { repeat? } }`.
  - A sequence-level error when the sequence is empty, or a pattern has no blocks.

  `validateLayout` dispatches on mode instead of throwing.
- **`src/engine/layout.ts`**: `computeLayout` handles advanced mode.
  - Expand the sequence lazily: block quantity, and pattern repeat × inner blocks in order.
  - Place until the first fixture that doesn't fit, then count the rest per block for `notPlaced`.
  - Each `PlacedFixture` gets `label` and `blockId`.
- **`src/engine/summary.ts`**: label counts when more than one distinct label is used, in order of first appearance, e.g. "8 Spot, 8 Wash". When a label is short, show "6 of 8 Wash".
- **Tests** (`tests/engine/`), covering every advanced case in design doc §7, plus:
  - Unlabeled blocks.
  - A pattern with repeat 1.
  - Duplicate labels across blocks summed together in label counts.
  - Validation keyed by item id.
  - Determinism.

### 3. Working state and storage

- **`WorkingState` gains `mode`, `sequence`, and `seeded`:**
  - `mode`: `'simple' | 'advanced'`.
  - `sequence`: the advanced items, with typed-string fields like the simple inputs, so partial typing round-trips.
  - `seeded`: whether advanced mode has been opened before.
  - `start` stays shared between the modes.
- **Transitions** for the editor and mode switch:
  - Add, delete, move up or down, and duplicate a block or pattern, both top-level and inside a pattern.
  - Set label, footprint, quantity, or repeat.
  - Switch mode, seeding on first open.
  - All of them follow the check-clearing rule above.
  - New ids reuse one small id helper. Move `newLayoutId` from `src/storage/layouts.ts` into `src/state/` and use it for both.
- **`toLayout`, `isDirty`, `openSaved`, `layoutForSave`** cover both modes.
  - A saved layout stores `mode` plus whichever of `simple` and `sequence` exist, so both modes' inputs survive Save → open.
  - `isDirty` compares the active mode's inputs, start, and mode.
- **`isStoredSimpleLayout` → `isStoredLayout`**: accept v1 advanced layouts too, checking the sequence shape. `describeLayout` gets an advanced form, e.g. "[Spot 19, Wash 14] ×8 · 16 units · start 1".
- **Persisted working state:**
  - The shape changes, so the key moves to `dmx.working.v2`.
  - Phones already have a `dmx.working.v1` from Phase 3. `loadWorkingState` must read v1 and convert it (simple mode, same inputs and checks), so the update doesn't wipe anyone's current work.
  - Test the conversion.
- **Tests** in `tests/state/working.test.ts` for every transition, seeding, mode switch, check clearing (including "label edit keeps checks"), dirty checks per mode, and v1 → v2 conversion.

### 4. UI

- **Mode switch:** a compact Simple | Advanced segmented control under the header, at least 48px tall. `aria-pressed` on each half.
- **Main screen, advanced:**
  - Inputs row: Start field, sequence description (truncated with ellipsis; tap opens the editor), **Edit** button, Reset icon.
  - When the sequence has errors, the status line reads "Fix the sequence" and the Edit button uses the warning style.
- **Table:** a Label column appears in advanced mode, with the color stripe. Simple mode stays two columns.
- **`src/ui/SequenceEditor.tsx`**: full-screen panel with a history entry for the Back gesture, the same mechanism as `useLayoutsView`. Generalize that hook rather than copying it.
  - Block card: label (text), footprint and quantity (numeric), with ↑ ↓ ⧉ (duplicate) 🗑 (delete) icon buttons, all at least 48px.
  - Pattern card: repeat field, its block cards, **+ Block** inside, and its own ↑ ↓ ⧉ 🗑.
  - Footer: **+ Block** and **+ Pattern** (a new pattern starts with two empty blocks).
  - Field errors show inline under each field, as in simple mode.
  - A small live summary at the top of the editor (the two summary lines) so the effect of edits is visible without leaving.
- **Layouts panel:** the save name suggestion and list description handle advanced layouts.

### 5. Docs

- **Design doc §5.2:** interactions are add, duplicate, delete, and up/down reorder (no drag, no collapse). Add color-by-label and the separate edit screen.
- **Design doc §6:** no schema change expected. If one becomes necessary, stop and raise it, since JSON import (Phase 5) depends on v1 staying readable.
- **Design doc §8 Phase 6:** colors under the red night theme.

### 6. Finish

- Run `npm test`, `typecheck`, `build`, and `build:single`.
- Re-run the scratch browser-driving script from Phase 3, extended for advanced mode.
- Deploy.

## Done when

- All four commands pass, and a push to `main` deploys to both hosts.
- Simple mode shows the two-line summary, **Next N →**, a warning-colored shortfall, and no confirmations or done count.
- On a phone, in advanced mode:
  - Build `[Spot 19, Wash 14] × 8`. The table alternates Spot and Wash with their colors, and the summary shows "16 units · 8 Spot, 8 Wash".
  - Push a pattern past 512. Placement stops at the first fixture that doesn't fit, and the shortfall shows per label.
  - Switch to simple and back: both modes' inputs are intact.
  - Save an advanced layout, open it from the list, and edit it: "Unsaved changes" behaves as in simple mode.
- Updating from Phase 3 keeps the work in progress on the phone, through the v1 → v2 working-state conversion.

## Out of scope for this phase

- Share text for advanced mode, JSON export/import (Phase 5). `formatShareText` stays simple-only until then.
- Drag-to-reorder, collapse, moving blocks into or out of patterns.
- Reset checks' final location, help screen, Continue icon (design doc §5.3, §9).
- Themes, wake lock, iOS install hint (Phase 6).
