# Menu Freeze Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Freeze the emulator when the menu is open and save a recovery snapshot to `currentImage` so state is preserved if the browser is closed.

**Architecture:** `MenuController.open()` calls `setPaused(true)` + `captureZ80()` + `db.saveCurrentImage()` before building the menu. `MenuController.close()` calls `setPaused(false)` after hiding the panel. The frame loop already skips `wasm.frame()` when `isPaused()` is true — no changes needed there.

**Tech Stack:** TypeScript (strict), IndexedDB via `src/data/db.ts`, WASM state via `src/emulator/state.ts`, snapshot capture via `src/media/snapshot.ts`.

---

### Task 1: Freeze emulator and save snapshot on menu open

**Files:**
- Modify: `src/ui/menu-controller.ts`

**Context — existing imports already in `menu-controller.ts`:**
```ts
import { isRomLoaded } from '../emulator/state.js';
import { captureZ80 } from '../media/snapshot.js';
import * as db from '../data/db.js';
```

`setPaused` is **not** currently imported — it needs to be added.

- [x] **Step 1: Add `setPaused` to the import from `state.ts`**

In `src/ui/menu-controller.ts`, find the existing import:

```ts
import {
  isRomLoaded,
  getCurrentTapeId, setCurrentTapeId,
  getCurrentTapeData, setCurrentTapeData,
} from '../emulator/state.js';
```

Replace with:

```ts
import {
  isRomLoaded, setPaused,
  getCurrentTapeId, setCurrentTapeId,
  getCurrentTapeData, setCurrentTapeData,
} from '../emulator/state.js';
```

- [x] **Step 2: Pause and snapshot at the top of `open()`**

`open()` currently starts with:

```ts
async open(): Promise<void> {
  try {
    const [tapes, joystickOverlay, joystickType, clockSpeed] = await Promise.all([
```

Replace with:

```ts
async open(): Promise<void> {
  setPaused(true);
  const snapshot = captureZ80();
  if (snapshot.byteLength > 0) {
    void db.saveCurrentImage(snapshot);
  }
  try {
    const [tapes, joystickOverlay, joystickType, clockSpeed] = await Promise.all([
```

- [x] **Step 3: Unpause at the end of `close()`**

`close()` currently reads:

```ts
close(): void {
  this.stack = [];
  this.stackTitles = [];
  this.panel.hide();
  setMenuOpen(false);
}
```

Replace with:

```ts
close(): void {
  this.stack = [];
  this.stackTitles = [];
  this.panel.hide();
  setMenuOpen(false);
  setPaused(false);
}
```

- [x] **Step 4: Build and verify no TypeScript errors**

```bash
bun run build
```

Expected: build completes with no errors.

- [x] **Step 5: Manual smoke test**

1. `bun run dev` and open the emulator in a browser.
2. Load a tape and start it running (screen should be animating).
3. Open the menu — screen should freeze immediately.
4. Close the menu — emulation should resume from exactly where it paused.
5. Open the menu again, then close the browser tab and reopen — the emulator should restore to the state captured when the menu was opened (via the existing `currentImage` restore path on load).

- [x] **Step 6: Commit**

```bash
git add src/ui/menu-controller.ts
git commit -m "feat: freeze emulator and save snapshot when menu opens"
```
