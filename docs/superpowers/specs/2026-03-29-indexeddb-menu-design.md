# IndexedDB Storage + Configurable Menu System

**Date:** 2026-03-29
**Status:** Approved

## Overview

Replace the 3D brass codex cylinder menu with an HTML overlay list-based menu system backed by IndexedDB storage. The new menu supports submenus, settings toggles/choices, dynamic tape libraries, and save/load management.

---

## 1. Data Layer — IndexedDB (`src/data/db.ts`)

### Database

- **Name:** `zx-spectrum-db`
- **Version:** 1
- **Four object stores:**

#### `tapes`
Stores imported TAP/TZX files.

| Field | Type | Notes |
|---|---|---|
| `id` | `string` (guid) | Primary key |
| `name` | `string` | User-supplied display name |
| `data` | `ArrayBuffer \| null` | Raw TAP or TZX bytes; `null` for Create Tape items |
| `format` | `'tap' \| 'tzx' \| null` | File format; `null` for Create Tape items |
| `createdAt` | `number` | Unix timestamp ms |

#### `saves`
Stores Z80 snapshot saves associated with a tape.

| Field | Type | Notes |
|---|---|---|
| `id` | `string` (guid) | Primary key |
| `parentTapeId` | `string` | Foreign key → `tapes.id`; indexed |
| `saveName` | `string` | e.g. `'Quick Start'`, `'Level 3'` |
| `data` | `ArrayBuffer` | Raw Z80 snapshot bytes |
| `createdAt` | `number` | Unix timestamp ms |

Index: `parentTapeId` (for efficient per-tape save lookup).

#### `currentImage`
Single-record store. Holds the most recent auto-saved Z80 state for session restore.

| Field | Type | Notes |
|---|---|---|
| `id` | `'current'` | Fixed key — only one record |
| `data` | `ArrayBuffer` | Raw Z80 snapshot bytes |
| `savedAt` | `number` | Unix timestamp ms |

#### `settings`
Key-value store for persistent settings.

| Field | Type | Notes |
|---|---|---|
| `key` | `string` | Primary key |
| `value` | `string \| boolean` | Setting value |

**Known setting keys:**

| Key | Type | Values |
|---|---|---|
| `joystickOverlay` | `boolean` | `true` / `false` |
| `joystickType` | `string` | `'kempston'` / `'sinclair1'` / `'cursor'` |
| `clockSpeed` | `string` | `'slow'` / `'normal'` / `'fast'` / `'fastest'` |

### Public API

All methods are async and return Promises.

```ts
// Tapes
saveTape(name: string, data: ArrayBuffer, format: 'tap' | 'tzx'): Promise<string>   // → tapeId
getTapes(): Promise<TapeItem[]>
deleteTape(id: string): Promise<void>   // also deletes all saves for this tape

// Saves
createSave(parentTapeId: string, saveName: string, data: ArrayBuffer): Promise<string>  // → saveId
getSave(id: string): Promise<SaveItem | null>
getSavesForTape(tapeId: string): Promise<SaveItem[]>
deleteSave(id: string): Promise<void>

// Current image
saveCurrentImage(data: ArrayBuffer): Promise<void>
loadCurrentImage(): Promise<ArrayBuffer | null>

// Settings
getSetting(key: string): Promise<string | boolean | null>
setSetting(key: string, value: string | boolean): Promise<void>
```

`deleteTape` deletes all saves for that tape in the same transaction via the `parentTapeId` index.

---

## 2. Menu System

### 2.1 Menu Item Types (`src/ui/menu-def.ts`)

```ts
export type MenuItem =
  | { type: 'action';    label: string; id: string }
  | { type: 'submenu';   label: string; items: MenuItem[] }
  | { type: 'toggle';    label: string; settingKey: string }
  | { type: 'choice';    label: string; settingKey: string; options: string[] }
  | { type: 'separator' }
  | { type: 'dynamic';   id: 'tape-list' | 'save-list' }
```

**Static menu definition** (the full tree, minus dynamic items):

```
Import Tape/TZX/Z80/ZIP   [action: IMPORT_FILE]
Import URL                [action: IMPORT_URL]
Export                    [submenu]
  ├── Current Tape        [action: EXPORT_CURRENT_TAPE]   (only if tape loaded)
  ├── A Save…             [submenu → save-list]           (only if tape loaded)
  ╰── [dynamic: tape-list for export]
Basic                     [action: BASIC]
Settings                  [submenu]
  ├── Joystick            [submenu]
  │   ├── Overlay         [toggle: joystickOverlay]
  │   ╰── Emulation       [choice: joystickType, options: kempston/sinclair1/cursor]
  ╰── Clock Speed         [choice: clockSpeed, options: slow/normal/fast/fastest]
Save                      [action: SAVE]                  (only if tape loaded)
Load                      [submenu → save-list]           (only if tape loaded)
Create Tape               [action: CREATE_TAPE]           (only if NO tape loaded)
[separator]
[dynamic: tape-list]
```

Dynamic `tape-list` items are injected at render time by querying IndexedDB. Each tape name becomes an `action` item with `id: 'LOAD_TAPE:<tapeId>'`.

### 2.2 MenuController (`src/ui/menu-controller.ts`)

Manages a navigation stack and dispatches actions.

**State:**
- `stack: MenuItem[][]` — current navigation path; top = current screen
- `currentTapeId: string | null` — from `state.ts`

**Key methods:**
```ts
open(): Promise<void>      // loads tape list from DB, builds root menu, shows panel
close(): void
push(items: MenuItem[]): void
pop(): void
activate(item: MenuItem): Promise<void>
```

**`open()` sequence:**
1. Load all tapes from IndexedDB
2. Check `currentTapeId` to decide which conditional items to include
3. Inject tape-list dynamic items at the `dynamic: tape-list` slot
4. Push root screen onto stack, show panel

**`activate()` behaviour by item type:**
- `action` → dispatch to action handler, close menu (unless action opens an input prompt)
- `submenu` → push its items onto stack
- `toggle` → flip value in IndexedDB, re-render current screen
- `choice` → push a screen listing the options; selecting one saves to IndexedDB and pops
- `dynamic` → resolved before this point; treated as action

**Back navigation:** Controller auto-prepends `{ type: 'action', label: '◄ BACK', id: 'BACK' }` to every pushed submenu screen. `BACK` action calls `pop()`.

### 2.3 MenuPanel (`src/ui/menu-panel.ts`)

HTML renderer — a single `<div>` overlay, created once and toggled visible.

**Visual style:** ZX Retro — black background, cyan border (`#00d4ff`), white/yellow text, `Courier New` monospace.

**Structure:**
```
┌──────────────────────────┐  ← 2px cyan border
│ ► ZX SPECTRUM  MAIN › X  │  ← header (title + breadcrumb)
├──────────────────────────┤
│ ► IMPORT TAPE            │  ← active item (yellow text, cyan left border)
│   IMPORT URL             │
│   EXPORT              ›  │
│   ...                    │
│ ── TAPES ──────────────  │  ← separator
│   Manic Miner            │
└──────────────────────────┘
```

**Input states:**
- Normal list: keyboard `↑↓` navigate, `Enter` activate, `Escape` close
- Text input prompt (tape name / URL): renders an `<input>` field; `Enter` confirms, `Escape` cancels
- Choice submenu: items show `●`/`○` prefix for current selection

**`MenuPanel` interface:**
```ts
show(items: MenuItem[], title: string, breadcrumb: string): void
hide(): void
onActivate: (item: MenuItem) => void   // callback to controller
```

The panel does not know about navigation state — it only renders a flat list and calls `onActivate`. The controller owns the stack.

---

## 3. State Changes

### `src/emulator/state.ts` additions

```ts
let currentTapeId: string | null = null;
let currentTapeData: ArrayBuffer | null = null;  // original TAP/TZX bytes for export

export function getCurrentTapeId(): string | null
export function setCurrentTapeId(id: string | null): void
export function getCurrentTapeData(): ArrayBuffer | null
export function setCurrentTapeData(d: ArrayBuffer | null): void
```

### `src/emulator/frame-loop.ts` — tape-done detection

```ts
let wasPlaying = false;
let onTapeDoneCallback: (() => void) | null = null;

export function registerTapeDoneCallback(cb: () => void): void {
  onTapeDoneCallback = cb;
}

// Inside the per-frame tick:
const playing = wasm.isTapePlaying();
if (wasPlaying && !playing && onTapeDoneCallback) {
  const cb = onTapeDoneCallback;
  onTapeDoneCallback = null;
  cb();
}
wasPlaying = playing;
```

### `src/input/keyboard-macro.ts` (new)

Utility to auto-type a key sequence into the emulator.

```ts
export function typeLoadAndRun(): void
// Types: J (LOAD), SYMBOL+P ("), SYMBOL+P ("), ENTER
// Each key: keyDown → 80ms → keyUp → 80ms gap → next key
```

Uses `wasm.keyDown` / `wasm.keyUp` with `setTimeout` chains. Called after reset when loading a tape from the tape list.

---

## 4. Action Handler

`MenuController` accepts an `ActionHandler` at construction. The handler maps action IDs to emulator operations:

| Action ID | Behaviour |
|---|---|
| `IMPORT_FILE` | Open hidden file input; on file selected → prompt tape name → `db.saveTape()` + `loadTapeFile()` + `setCurrentTapeId()` |
| `IMPORT_URL` | Show URL input prompt → fetch → detect format → prompt tape name → same as above |
| `EXPORT_CURRENT_TAPE` | Download current tape data as ZIP; disabled (greyed out) if `currentTapeData` is null (Create Tape item with no original media) |
| `EXPORT_SAVE:<saveId>` | `db.getSave(id)` → download Z80 as ZIP |
| `BASIC` | `resetEmulator()`; `setCurrentTapeId(null)`; `setCurrentTapeData(null)` |
| `SAVE` | Prompt save name → `captureZ80()` → `db.createSave(currentTapeId, name, data)` |
| `LOAD_SAVE:<saveId>` | `db.getSave(id)` → `loadZ80(data)` |
| `CREATE_TAPE` | Prompt tape name → `captureZ80()` → `db.saveTape(name, null, null)` + `db.createSave(tapeId, 'Quick Start', data)` + `setCurrentTapeId(tapeId)` |
| `LOAD_TAPE:<tapeId>` | See Quick Start flow below |

### Quick Start flow for `LOAD_TAPE:<tapeId>`

1. Load tape record from DB
2. Check if a save named `'Quick Start'` exists for this tape
3. **If Quick Start exists:** call `loadZ80(quickStartData)` immediately → close menu
4. **If no Quick Start:**
   - `resetEmulator()`
   - `loadTapeFile(tapeData, format)`
   - `setCurrentTapeId(tapeId)` + `setCurrentTapeData(tapeData)`
   - `registerTapeDoneCallback(() => autoSaveQuickStart(tapeId))`
   - `typeLoadAndRun()`
   - Close menu

`autoSaveQuickStart(tapeId)`:
- Re-checks that no Quick Start exists (guard against duplicate)
- `captureZ80()` → `db.createSave(tapeId, 'Quick Start', data)`

---

## 5. Session Restore (Auto-Save on Close)

```ts
// In main.ts, after DB is initialised:
window.addEventListener('beforeunload', () => {
  if (isRomLoaded()) {
    db.saveCurrentImage(captureZ80());
  }
});

// On startup, after WASM is ready:
const saved = await db.loadCurrentImage();
if (saved) loadZ80(saved);
```

`captureZ80()` is a helper extracted from the existing `saveZ80()` in `snapshot.ts` that returns the bytes instead of triggering a download.

---

## 6. Integration — Files Changed

### New files
| File | Purpose |
|---|---|
| `src/data/db.ts` | IndexedDB module |
| `src/ui/menu-def.ts` | Static menu definition tree |
| `src/ui/menu-controller.ts` | Navigation stack + action dispatch |
| `src/ui/menu-panel.ts` | HTML overlay renderer |
| `src/input/keyboard-macro.ts` | Auto-type key sequences |

### Modified files
| File | Change |
|---|---|
| `src/emulator/state.ts` | Add `currentTapeId`, `currentTapeData` |
| `src/emulator/frame-loop.ts` | Add `wasPlaying` polling + `onTapeDoneCallback` |
| `src/media/snapshot.ts` | Extract `captureZ80(): ArrayBuffer` from `saveZ80()` |
| `src/scene/scene-graph.ts` | Remove `createMenuCodex` + `CodexInteraction`; `SceneEntities` no longer includes `menuCodex` or `codexInteraction` |
| `src/input/input-bridge.ts` | Remove all codex drag/interaction code + `handleCodexAction`; menu-button hit calls `menuController.open()` |
| `src/main.ts` | Construct `MenuController`; wire `beforeunload`; restore current image on startup |

### Deleted files
| File | Reason |
|---|---|
| `src/entities/menu-codex.ts` | Replaced by HTML menu |
| `src/input/codex-interaction.ts` | Replaced by `MenuController` |

---

## 7. Out of Scope

- Deleting tapes from the menu (can be added later)
- Renaming tapes or saves
- Multiple simultaneous tape slots
- Cloud sync or export to external services
