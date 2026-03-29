# IndexedDB Storage + Configurable Menu System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 3D brass codex cylinder menu with an HTML overlay menu backed by IndexedDB storage, supporting tape libraries, save management, and settings persistence.

**Architecture:** New `src/data/db.ts` owns all IndexedDB access. New `src/ui/menu-{def,panel,controller}.ts` implement a navigation-stack HTML menu. The codex 3D entity and its interaction class are deleted; the menu button now calls `menuController.open()` directly.

**Tech Stack:** Vanilla TypeScript ES modules, IndexedDB (browser native), no additional dependencies.

---

## File Map

**New files:**
- `src/data/db.ts` — IndexedDB module (4 stores, typed public API)
- `src/ui/menu-def.ts` — MenuItem type union + `buildRootMenu()` function
- `src/ui/menu-panel.ts` — HTML overlay renderer, keyboard nav, text-input mode
- `src/ui/menu-controller.ts` — Navigation stack, action dispatch, DB integration
- `src/input/keyboard-macro.ts` — `typeLoadAndRun()` key sequence helper

**Modified files:**
- `src/emulator/state.ts` — Add `currentTapeId` / `currentTapeData` state
- `src/emulator/frame-loop.ts` — Add tape-done callback polling
- `src/media/snapshot.ts` — Extract `captureZ80(): ArrayBuffer` from `saveZ80()`
- `src/scene/scene-graph.ts` — Remove `menuCodex` / `codexInteraction` from `SceneEntities`
- `src/input/input-bridge.ts` — Remove codex code; menu-button calls `menuController.open()`
- `src/main.ts` — Construct `MenuController`; wire `beforeunload`; restore session on startup

**Deleted files:**
- `src/entities/menu-codex.ts`
- `src/input/codex-interaction.ts`

---

## Task 1: Add currentTapeId + currentTapeData to state.ts

**Files:**
- Modify: `src/emulator/state.ts`

No test framework exists in this project. Verification is via `bun run dev` + browser console.

- [ ] **Step 1: Add the two state variables and their getters/setters**

Open `src/emulator/state.ts` and append after the last existing export:

```ts
let currentTapeId: string | null = null;
let currentTapeData: ArrayBuffer | null = null;

export function getCurrentTapeId(): string | null { return currentTapeId; }
export function setCurrentTapeId(id: string | null): void { currentTapeId = id; }

export function getCurrentTapeData(): ArrayBuffer | null { return currentTapeData; }
export function setCurrentTapeData(d: ArrayBuffer | null): void { currentTapeData = d; }
```

- [ ] **Step 2: TypeScript check**

```bash
cd /Users/jackallan/dev/z80 && npx tsc --noEmit
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/emulator/state.ts
git commit -m "feat: add currentTapeId and currentTapeData to emulator state"
```

---

## Task 2: Extract captureZ80() from snapshot.ts

**Files:**
- Modify: `src/media/snapshot.ts`

`saveZ80()` builds the byte array and then triggers a download. We extract the build step into `captureZ80(): ArrayBuffer` and call it from `saveZ80()`.

- [ ] **Step 1: Add captureZ80() and refactor saveZ80()**

In `src/media/snapshot.ts`, replace the current `saveZ80()` function with:

```ts
// Returns raw .z80 v3 bytes without triggering a download
export function captureZ80(): ArrayBuffer {
  const wasm = getWasm();
  const memory = getMemory();
  if (!wasm || !memory) return new ArrayBuffer(0);

  const a = wasm.getA();
  const f = wasm.getF();
  const bc = wasm.getBC2();
  const de = wasm.getDE2();
  const hl = wasm.getHL2();
  const pc = wasm.getPC();
  const sp = wasm.getSP();
  const ix = wasm.getIX();
  const iy = wasm.getIY();
  const i = wasm.getI();
  const r = wasm.getR();
  const im = wasm.getIM();
  const iff1 = wasm.getIFF1();
  const iff2 = wasm.getIFF2();
  const border = wasm.getBorderColor();
  const a2 = wasm.getA2();
  const f2 = wasm.getF2();
  const bc2 = wasm.getBC_prime();
  const de2 = wasm.getDE_prime();
  const hl2 = wasm.getHL_prime();

  const header = new Uint8Array(30);
  header[0] = a;
  header[1] = f;
  header[2] = bc & 0xFF; header[3] = bc >> 8;
  header[4] = hl & 0xFF; header[5] = hl >> 8;
  header[6] = 0; header[7] = 0;
  header[8] = sp & 0xFF; header[9] = sp >> 8;
  header[10] = i;
  header[11] = r & 0x7F;
  header[12] = ((r >> 7) & 1) | ((border & 7) << 1) | (1 << 5);
  header[13] = de & 0xFF; header[14] = de >> 8;
  header[15] = bc2 & 0xFF; header[16] = bc2 >> 8;
  header[17] = de2 & 0xFF; header[18] = de2 >> 8;
  header[19] = hl2 & 0xFF; header[20] = hl2 >> 8;
  header[21] = a2;
  header[22] = f2;
  header[23] = iy & 0xFF; header[24] = iy >> 8;
  header[25] = ix & 0xFF; header[26] = ix >> 8;
  header[27] = iff1 ? 1 : 0;
  header[28] = iff2 ? 1 : 0;
  header[29] = im & 3;

  const extHeader = new Uint8Array(56);
  extHeader[0] = 54; extHeader[1] = 0;
  extHeader[2] = pc & 0xFF; extHeader[3] = pc >> 8;
  extHeader[4] = 0;

  const ram = new Uint8Array(memory.buffer, MEM_BASE + 0x4000, 0xC000);
  const pages = [
    { id: 8, data: ram.slice(0, 0x4000) },
    { id: 4, data: ram.slice(0x4000, 0x8000) },
    { id: 5, data: ram.slice(0x8000, 0xC000) },
  ];

  const pageBlocks: Uint8Array[] = [];
  for (const page of pages) {
    const compressed = compressZ80Page(page.data);
    const block = new Uint8Array(3 + compressed.length);
    block[0] = compressed.length & 0xFF;
    block[1] = (compressed.length >> 8) & 0xFF;
    block[2] = page.id;
    block.set(compressed, 3);
    pageBlocks.push(block);
  }

  const totalLen = 30 + 56 + pageBlocks.reduce((s, b) => s + b.length, 0);
  const file = new Uint8Array(totalLen);
  file.set(header, 0);
  file.set(extHeader, 30);
  let offset = 86;
  for (const block of pageBlocks) {
    file.set(block, offset);
    offset += block.length;
  }
  return file.buffer;
}

// Save emulator state as .z80 v3 file (triggers download)
export function saveZ80(): void {
  if (!isRomLoaded()) return;
  const buf = captureZ80();
  if (buf.byteLength === 0) return;
  const blob = new Blob([buf], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a_el = document.createElement('a');
  a_el.href = url;
  a_el.download = 'snapshot.z80';
  document.body.appendChild(a_el);
  a_el.click();
  document.body.removeChild(a_el);
  URL.revokeObjectURL(url);
  showStatus('Snapshot saved.');
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/media/snapshot.ts
git commit -m "refactor: extract captureZ80() from saveZ80() in snapshot.ts"
```

---

## Task 3: Add tape-done callback to frame-loop.ts

**Files:**
- Modify: `src/emulator/frame-loop.ts`

- [ ] **Step 1: Add wasPlaying state + registerTapeDoneCallback**

Replace the entire `src/emulator/frame-loop.ts` with:

```ts
import {
  getWasm, isRunning, isPaused, isRomLoaded, isTurboMode, setRunning
} from './state.js';
import { pushAudioFrame } from '../audio/audio.js';

let lastFrameTime = 0;
let wasPlaying = false;
let onTapeDoneCallback: (() => void) | null = null;

export function registerTapeDoneCallback(cb: () => void): void {
  onTapeDoneCallback = cb;
}

export function tickEmulatorFrame(): void {
  const wasm = getWasm();
  if (!isRunning() || isPaused() || !isRomLoaded() || !wasm) return;

  try {
    if (isTurboMode()) {
      for (let i = 0; i < 50; i++) wasm.frame();
      const playing = wasm.isTapePlaying();
      if (wasPlaying && !playing && onTapeDoneCallback) {
        const cb = onTapeDoneCallback;
        onTapeDoneCallback = null;
        cb();
      }
      wasPlaying = playing;
      return;
    }

    if (wasm.isTapePlaying()) {
      for (let i = 0; i < 19; i++) wasm.frame();
    }
    wasm.frame();
    pushAudioFrame();

    const playing = wasm.isTapePlaying();
    if (wasPlaying && !playing && onTapeDoneCallback) {
      const cb = onTapeDoneCallback;
      onTapeDoneCallback = null;
      cb();
    }
    wasPlaying = playing;
  } catch (e) {
    console.error('Emulation error:', e);
    console.error('PC was:', wasm ? wasm.getPC().toString(16) : 'unknown');
    setRunning(false);
  }
}

export function resetFrameTime(): void {
  lastFrameTime = 0;
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/emulator/frame-loop.ts
git commit -m "feat: add tape-done callback polling to frame-loop"
```

---

## Task 4: Create keyboard-macro.ts

**Files:**
- Create: `src/input/keyboard-macro.ts`

Types LOAD "" ENTER into the emulator via wasm.keyDown/keyUp with 80ms timing.

Key mappings:
- J (LOAD) = row 6, bit 0x08
- SYMBOL SHIFT = row 7, bit 0x02
- P = row 5, bit 0x01  (SYMBOL+P = `"`)
- ENTER = row 6, bit 0x01

- [ ] **Step 1: Create the file**

```ts
import { getWasm } from '../emulator/state.js';

// Types: J  SYMBOL+P  SYMBOL+P  ENTER
// (i.e. LOAD "" then Enter — standard 48K BASIC tape loader)
export function typeLoadAndRun(): void {
  const wasm = getWasm();
  if (!wasm) return;

  type Step = () => void;
  const steps: Step[] = [];
  const GAP = 80; // ms between each keydown/keyup

  function press(row: number, bit: number, mod?: { row: number; bit: number }): void {
    steps.push(() => {
      wasm!.keyDown(row, bit);
      if (mod) wasm!.keyDown(mod.row, mod.bit);
    });
    steps.push(() => {
      wasm!.keyUp(row, bit);
      if (mod) wasm!.keyUp(mod.row, mod.bit);
    });
  }

  // J
  press(6, 0x08);
  // SYMBOL+P (opening ")
  press(5, 0x01, { row: 7, bit: 0x02 });
  // SYMBOL+P (closing ")
  press(5, 0x01, { row: 7, bit: 0x02 });
  // ENTER
  press(6, 0x01);

  steps.forEach((step, i) => setTimeout(step, i * GAP));
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/input/keyboard-macro.ts
git commit -m "feat: add keyboard-macro typeLoadAndRun helper"
```

---

## Task 5: Create src/data/db.ts

**Files:**
- Create: `src/data/db.ts`

- [ ] **Step 1: Create the file**

```ts
// IndexedDB storage — tapes, saves, session image, settings

const DB_NAME = 'zx-spectrum-db';
const DB_VERSION = 1;

export interface TapeItem {
  id: string;
  name: string;
  data: ArrayBuffer | null;
  format: 'tap' | 'tzx' | null;
  createdAt: number;
}

export interface SaveItem {
  id: string;
  parentTapeId: string;
  saveName: string;
  data: ArrayBuffer;
  createdAt: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('tapes')) {
        db.createObjectStore('tapes', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('saves')) {
        const savesStore = db.createObjectStore('saves', { keyPath: 'id' });
        savesStore.createIndex('parentTapeId', 'parentTapeId', { unique: false });
      }
      if (!db.objectStoreNames.contains('currentImage')) {
        db.createObjectStore('currentImage', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ── Tapes ────────────────────────────────────────────────────────────────────

export async function saveTape(
  name: string,
  data: ArrayBuffer | null,
  format: 'tap' | 'tzx' | null,
): Promise<string> {
  const db = await openDB();
  const id = crypto.randomUUID();
  const item: TapeItem = { id, name, data, format, createdAt: Date.now() };
  return new Promise((resolve, reject) => {
    const tx = db.transaction('tapes', 'readwrite');
    tx.objectStore('tapes').put(item);
    tx.oncomplete = () => resolve(id);
    tx.onerror = () => reject(tx.error);
  });
}

export async function getTapes(): Promise<TapeItem[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('tapes', 'readonly');
    const req = tx.objectStore('tapes').getAll();
    req.onsuccess = () => resolve(req.result as TapeItem[]);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteTape(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['tapes', 'saves'], 'readwrite');
    tx.objectStore('tapes').delete(id);
    const req = tx.objectStore('saves').index('parentTapeId').getAllKeys(id);
    req.onsuccess = () => {
      for (const key of req.result) {
        tx.objectStore('saves').delete(key);
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ── Saves ────────────────────────────────────────────────────────────────────

export async function createSave(
  parentTapeId: string,
  saveName: string,
  data: ArrayBuffer,
): Promise<string> {
  const db = await openDB();
  const id = crypto.randomUUID();
  const item: SaveItem = { id, parentTapeId, saveName, data, createdAt: Date.now() };
  return new Promise((resolve, reject) => {
    const tx = db.transaction('saves', 'readwrite');
    tx.objectStore('saves').put(item);
    tx.oncomplete = () => resolve(id);
    tx.onerror = () => reject(tx.error);
  });
}

export async function getSave(id: string): Promise<SaveItem | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('saves', 'readonly');
    const req = tx.objectStore('saves').get(id);
    req.onsuccess = () => resolve((req.result as SaveItem) ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function getSavesForTape(tapeId: string): Promise<SaveItem[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('saves', 'readonly');
    const req = tx.objectStore('saves').index('parentTapeId').getAll(tapeId);
    req.onsuccess = () => resolve(req.result as SaveItem[]);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteSave(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('saves', 'readwrite');
    tx.objectStore('saves').delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ── Current image ─────────────────────────────────────────────────────────────

export async function saveCurrentImage(data: ArrayBuffer): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('currentImage', 'readwrite');
    tx.objectStore('currentImage').put({ id: 'current', data, savedAt: Date.now() });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadCurrentImage(): Promise<ArrayBuffer | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('currentImage', 'readonly');
    const req = tx.objectStore('currentImage').get('current');
    req.onsuccess = () => resolve((req.result as { data: ArrayBuffer } | undefined)?.data ?? null);
    req.onerror = () => reject(req.error);
  });
}

// ── Settings ─────────────────────────────────────────────────────────────────

export async function getSetting(key: string): Promise<string | boolean | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('settings', 'readonly');
    const req = tx.objectStore('settings').get(key);
    req.onsuccess = () => resolve((req.result as { value: string | boolean } | undefined)?.value ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function setSetting(key: string, value: string | boolean): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('settings', 'readwrite');
    tx.objectStore('settings').put({ key, value });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/data/db.ts
git commit -m "feat: add IndexedDB module (tapes, saves, currentImage, settings)"
```

---

## Task 6: Create src/ui/menu-def.ts

**Files:**
- Create: `src/ui/menu-def.ts`

Defines the `MenuItem` type union and `buildRootMenu()` which constructs the full root menu at open-time by injecting conditional items and the tape list.

- [ ] **Step 1: Create the file**

```ts
import type { TapeItem, SaveItem } from '../data/db.js';

export type MenuItem =
  | { type: 'action';  label: string; id: string }
  | { type: 'submenu'; label: string; items: MenuItem[] }
  | { type: 'toggle';  label: string; settingKey: string }
  | { type: 'choice';  label: string; settingKey: string; options: string[] }
  | { type: 'separator' }

// Builds the root menu list, injecting conditional + dynamic items.
export function buildRootMenu(
  tapes: TapeItem[],
  currentTapeId: string | null,
  savesForCurrentTape: SaveItem[],
): MenuItem[] {
  const items: MenuItem[] = [];

  items.push({ type: 'action', label: 'IMPORT TAPE/TZX/Z80/ZIP', id: 'IMPORT_FILE' });
  items.push({ type: 'action', label: 'IMPORT URL', id: 'IMPORT_URL' });

  // Export submenu
  const exportItems: MenuItem[] = [];
  if (currentTapeId) {
    exportItems.push({ type: 'action', label: 'CURRENT TAPE', id: 'EXPORT_CURRENT_TAPE' });
    if (savesForCurrentTape.length > 0) {
      exportItems.push({
        type: 'submenu',
        label: 'A SAVE\u2026',
        items: savesForCurrentTape.map(s => ({
          type: 'action' as const,
          label: s.saveName.toUpperCase(),
          id: `EXPORT_SAVE:${s.id}`,
        })),
      });
    }
  }
  items.push({ type: 'submenu', label: 'EXPORT', items: exportItems });

  items.push({ type: 'action', label: 'BASIC', id: 'BASIC' });

  items.push({
    type: 'submenu',
    label: 'SETTINGS',
    items: [
      {
        type: 'submenu',
        label: 'JOYSTICK',
        items: [
          { type: 'toggle', label: 'OVERLAY', settingKey: 'joystickOverlay' },
          { type: 'choice', label: 'EMULATION', settingKey: 'joystickType', options: ['kempston', 'sinclair1', 'cursor'] },
        ],
      },
      { type: 'choice', label: 'CLOCK SPEED', settingKey: 'clockSpeed', options: ['slow', 'normal', 'fast', 'fastest'] },
    ],
  });

  if (currentTapeId) {
    items.push({ type: 'action', label: 'SAVE', id: 'SAVE' });
    items.push({
      type: 'submenu',
      label: 'LOAD',
      items: savesForCurrentTape.map(s => ({
        type: 'action' as const,
        label: s.saveName.toUpperCase(),
        id: `LOAD_SAVE:${s.id}`,
      })),
    });
  } else {
    items.push({ type: 'action', label: 'CREATE TAPE', id: 'CREATE_TAPE' });
  }

  items.push({ type: 'separator' });

  // Dynamic tape list
  for (const tape of tapes) {
    items.push({
      type: 'action',
      label: tape.name.toUpperCase(),
      id: `LOAD_TAPE:${tape.id}`,
    });
  }

  return items;
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/ui/menu-def.ts
git commit -m "feat: add menu-def with MenuItem types and buildRootMenu"
```

---

## Task 7: Create src/ui/menu-panel.ts

**Files:**
- Create: `src/ui/menu-panel.ts`

HTML overlay. Supports three modes: list navigation, text input prompt, choice list (with ●/○). The panel is created once and toggled visible. It doesn't know about nav stack — it just renders a flat item list and calls `onActivate`.

- [ ] **Step 1: Create the file**

```ts
import type { MenuItem } from './menu-def.js';

export class MenuPanel {
  private el: HTMLDivElement;
  private headerEl: HTMLDivElement;
  private listEl: HTMLDivElement;
  private items: MenuItem[] = [];
  private activeIndex = 0;
  private _visible = false;

  // Set by controller before show()
  onActivate: ((item: MenuItem) => void) | null = null;
  onClose: (() => void) | null = null;

  constructor() {
    this.el = document.createElement('div');
    this.el.style.cssText = [
      'position:fixed',
      'top:50%',
      'left:50%',
      'transform:translate(-50%,-50%)',
      'background:#000',
      'border:2px solid #00d4ff',
      'color:#fff',
      'font-family:"Courier New",monospace',
      'font-size:14px',
      'min-width:320px',
      'max-width:480px',
      'max-height:80vh',
      'overflow-y:auto',
      'z-index:9999',
      'display:none',
      'user-select:none',
      'box-sizing:border-box',
    ].join(';');

    this.headerEl = document.createElement('div');
    this.headerEl.style.cssText = [
      'padding:8px 12px',
      'border-bottom:1px solid #00d4ff',
      'color:#00d4ff',
      'font-weight:bold',
      'display:flex',
      'justify-content:space-between',
      'align-items:center',
    ].join(';');

    this.listEl = document.createElement('div');

    this.el.appendChild(this.headerEl);
    this.el.appendChild(this.listEl);
    document.body.appendChild(this.el);

    this._bindKeys();
  }

  show(
    items: MenuItem[],
    title: string,
    breadcrumb: string,
    settingValues?: Record<string, string | boolean | null>,
  ): void {
    this.items = items;
    this.activeIndex = this._firstSelectableIndex(items);
    this._visible = true;
    this.el.style.display = 'block';
    this._render(title, breadcrumb, settingValues ?? {});
  }

  hide(): void {
    this._visible = false;
    this.el.style.display = 'none';
  }

  // Show a text input prompt overlaid in the panel.
  // Resolves with the entered string or null if cancelled.
  prompt(label: string): Promise<string | null> {
    return new Promise((resolve) => {
      this.listEl.innerHTML = '';

      const wrapper = document.createElement('div');
      wrapper.style.cssText = 'padding:12px';

      const lbl = document.createElement('div');
      lbl.style.cssText = 'color:#ff0;margin-bottom:8px';
      lbl.textContent = label;

      const input = document.createElement('input');
      input.type = 'text';
      input.style.cssText = [
        'background:#111',
        'color:#fff',
        'border:1px solid #00d4ff',
        'font-family:"Courier New",monospace',
        'font-size:14px',
        'padding:4px 8px',
        'width:100%',
        'box-sizing:border-box',
        'outline:none',
      ].join(';');

      input.addEventListener('keydown', (e) => {
        e.stopPropagation();
        if (e.code === 'Enter') {
          e.preventDefault();
          const val = input.value.trim();
          resolve(val || null);
        }
        if (e.code === 'Escape') {
          e.preventDefault();
          resolve(null);
        }
      });

      wrapper.appendChild(lbl);
      wrapper.appendChild(input);
      this.listEl.appendChild(wrapper);

      setTimeout(() => input.focus(), 0);
    });
  }

  private _render(
    title: string,
    breadcrumb: string,
    settingValues: Record<string, string | boolean | null>,
  ): void {
    // Header
    const crumbDisplay = breadcrumb ? ` ${breadcrumb}` : '';
    this.headerEl.innerHTML = `<span>&#9658; ${title}${crumbDisplay}</span><span style="cursor:pointer;color:#888" title="Close">X</span>`;
    const closeBtn = this.headerEl.querySelector('span:last-child') as HTMLElement;
    closeBtn.addEventListener('click', () => this.onClose?.());

    // Items
    this.listEl.innerHTML = '';
    this.items.forEach((item, idx) => {
      const row = document.createElement('div');

      if (item.type === 'separator') {
        row.style.cssText = 'border-top:1px solid #333;margin:4px 0';
        this.listEl.appendChild(row);
        return;
      }

      const isActive = idx === this.activeIndex;
      row.style.cssText = [
        'padding:6px 12px',
        'cursor:pointer',
        isActive ? 'color:#ff0;border-left:3px solid #00d4ff' : 'color:#fff;border-left:3px solid transparent',
        'display:flex',
        'justify-content:space-between',
        'align-items:center',
      ].join(';');

      let label = '';
      let suffix = '';

      if (item.type === 'action') {
        label = (isActive ? '► ' : '  ') + item.label;
      } else if (item.type === 'submenu') {
        label = (isActive ? '► ' : '  ') + item.label;
        suffix = '›';
      } else if (item.type === 'toggle') {
        const val = settingValues[item.settingKey];
        const on = val === true || val === 'true';
        label = (isActive ? '► ' : '  ') + item.label;
        suffix = on ? '● ON' : '○ OFF';
      } else if (item.type === 'choice') {
        const val = settingValues[item.settingKey];
        label = (isActive ? '► ' : '  ') + item.label;
        suffix = val != null ? String(val).toUpperCase() : '›';
      }

      const labelEl = document.createElement('span');
      labelEl.textContent = label;
      const suffixEl = document.createElement('span');
      suffixEl.style.cssText = 'color:#00d4ff;font-size:12px';
      suffixEl.textContent = suffix;

      row.appendChild(labelEl);
      row.appendChild(suffixEl);

      row.addEventListener('click', () => {
        this.activeIndex = idx;
        this._activateCurrent();
      });
      row.addEventListener('mouseover', () => {
        if (item.type !== 'separator') {
          this.activeIndex = idx;
          this._rerenderRows(settingValues);
        }
      });

      this.listEl.appendChild(row);
    });
  }

  private _rerenderRows(settingValues: Record<string, string | boolean | null>): void {
    const rows = Array.from(this.listEl.children) as HTMLElement[];
    let rowIdx = 0;
    this.items.forEach((item, idx) => {
      if (item.type === 'separator') { rowIdx++; return; }
      const row = rows[rowIdx++];
      if (!row) return;
      const isActive = idx === this.activeIndex;
      row.style.color = isActive ? '#ff0' : '#fff';
      row.style.borderLeft = isActive ? '3px solid #00d4ff' : '3px solid transparent';
      const labelEl = row.querySelector('span:first-child') as HTMLElement;
      if (!labelEl) return;
      let label = '';
      if (item.type === 'action') label = (isActive ? '► ' : '  ') + item.label;
      else if (item.type === 'submenu') label = (isActive ? '► ' : '  ') + item.label;
      else if (item.type === 'toggle') label = (isActive ? '► ' : '  ') + item.label;
      else if (item.type === 'choice') label = (isActive ? '► ' : '  ') + item.label;
      labelEl.textContent = label;
    });
  }

  private _bindKeys(): void {
    window.addEventListener('keydown', (e) => {
      if (!this._visible) return;
      // Don't intercept if focus is on a text input inside the panel
      if ((e.target as HTMLElement).tagName === 'INPUT') return;

      if (e.code === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        this._navigate(-1);
      } else if (e.code === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        this._navigate(1);
      } else if (e.code === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        this._activateCurrent();
      } else if (e.code === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        this.onClose?.();
      }
    }, true); // capture phase so input-bridge sees it only after
  }

  private _navigate(dir: number): void {
    const len = this.items.length;
    if (len === 0) return;
    let next = (this.activeIndex + dir + len) % len;
    // Skip separators
    let guard = 0;
    while (this.items[next].type === 'separator' && guard < len) {
      next = (next + dir + len) % len;
      guard++;
    }
    this.activeIndex = next;
    this._rerenderRows({});
  }

  private _activateCurrent(): void {
    const item = this.items[this.activeIndex];
    if (item && item.type !== 'separator') {
      this.onActivate?.(item);
    }
  }

  private _firstSelectableIndex(items: MenuItem[]): number {
    for (let i = 0; i < items.length; i++) {
      if (items[i].type !== 'separator') return i;
    }
    return 0;
  }
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/ui/menu-panel.ts
git commit -m "feat: add HTML MenuPanel overlay with keyboard nav and text-input mode"
```

---

## Task 8: Create src/ui/menu-controller.ts

**Files:**
- Create: `src/ui/menu-controller.ts`

Navigation stack + full action dispatch. Owns the MenuPanel instance. Calls `setMenuOpen()` from input-bridge to block emulator keys while open.

- [ ] **Step 1: Create the file**

```ts
import * as db from '../data/db.js';
import type { SaveItem } from '../data/db.js';
import type { MenuItem } from './menu-def.js';
import { buildRootMenu } from './menu-def.js';
import { MenuPanel } from './menu-panel.js';
import { captureZ80, loadZ80 } from '../media/snapshot.js';
import { loadTapeFile } from '../media/tape.js';
import { resetEmulator } from '../emulator/wasm-loader.js';
import {
  isRomLoaded,
  getCurrentTapeId, setCurrentTapeId,
  getCurrentTapeData, setCurrentTapeData,
} from '../emulator/state.js';
import { registerTapeDoneCallback } from '../emulator/frame-loop.js';
import { typeLoadAndRun } from '../input/keyboard-macro.js';
import { showStatus } from './status-bridge.js';
import { setMenuOpen } from '../input/input-bridge.js';

// Breadcrumb labels per stack depth
const BREADCRUMB_LABELS = ['MAIN', 'SETTINGS', 'JOYSTICK'];

export class MenuController {
  private panel: MenuPanel;
  private stack: MenuItem[][] = [];
  private stackTitles: string[] = [];
  // Setting values cache for rendering toggle/choice state
  private settingCache: Record<string, string | boolean | null> = {};

  constructor() {
    this.panel = new MenuPanel();
    this.panel.onActivate = (item) => { void this.activate(item); };
    this.panel.onClose = () => this.close();
  }

  async open(): Promise<void> {
    const [tapes, joystickOverlay, joystickType, clockSpeed] = await Promise.all([
      db.getTapes(),
      db.getSetting('joystickOverlay'),
      db.getSetting('joystickType'),
      db.getSetting('clockSpeed'),
    ]);

    this.settingCache = {
      joystickOverlay: joystickOverlay ?? false,
      joystickType: joystickType ?? 'sinclair1',
      clockSpeed: clockSpeed ?? 'normal',
    };

    const currentTapeId = getCurrentTapeId();
    let savesForCurrentTape: SaveItem[] = [];
    if (currentTapeId) {
      savesForCurrentTape = await db.getSavesForTape(currentTapeId);
    }

    const rootItems = buildRootMenu(tapes, currentTapeId, savesForCurrentTape);
    this.stack = [rootItems];
    this.stackTitles = ['ZX SPECTRUM'];
    setMenuOpen(true);
    this._showCurrent();
  }

  close(): void {
    this.stack = [];
    this.stackTitles = [];
    this.panel.hide();
    setMenuOpen(false);
  }

  push(items: MenuItem[], title: string): void {
    const withBack: MenuItem[] = [
      { type: 'action', label: '◄ BACK', id: 'BACK' },
      ...items,
    ];
    this.stack.push(withBack);
    this.stackTitles.push(title);
    this._showCurrent();
  }

  pop(): void {
    if (this.stack.length > 1) {
      this.stack.pop();
      this.stackTitles.pop();
      this._showCurrent();
    } else {
      this.close();
    }
  }

  async activate(item: MenuItem): Promise<void> {
    switch (item.type) {
      case 'action':
        await this._handleAction(item.id);
        break;
      case 'submenu':
        this.push(item.items, item.label);
        break;
      case 'toggle': {
        const current = this.settingCache[item.settingKey];
        const next = !(current === true || current === 'true');
        await db.setSetting(item.settingKey, next);
        this.settingCache[item.settingKey] = next;
        this._showCurrent();
        break;
      }
      case 'choice': {
        const choiceItems: MenuItem[] = item.options.map(opt => ({
          type: 'action' as const,
          label: opt.toUpperCase(),
          id: `CHOICE:${item.settingKey}:${opt}`,
        }));
        this.push(choiceItems, item.label);
        break;
      }
    }
  }

  private async _handleAction(id: string): Promise<void> {
    if (id === 'BACK') {
      this.pop();
      return;
    }

    if (id.startsWith('CHOICE:')) {
      const parts = id.split(':');
      const key = parts[1];
      const value = parts.slice(2).join(':');
      await db.setSetting(key, value);
      this.settingCache[key] = value;
      this.pop();
      return;
    }

    if (id.startsWith('LOAD_TAPE:')) {
      await this._loadTape(id.slice('LOAD_TAPE:'.length));
      this.close();
      return;
    }

    if (id.startsWith('LOAD_SAVE:')) {
      const save = await db.getSave(id.slice('LOAD_SAVE:'.length));
      if (save) loadZ80(save.data);
      this.close();
      return;
    }

    if (id.startsWith('EXPORT_SAVE:')) {
      const save = await db.getSave(id.slice('EXPORT_SAVE:'.length));
      if (save) this._triggerDownload(save.data, `${save.saveName}.z80`);
      this.close();
      return;
    }

    switch (id) {
      case 'IMPORT_FILE':
        this.close();
        this._triggerFileImport();
        break;

      case 'IMPORT_URL':
        await this._importUrl();
        break;

      case 'EXPORT_CURRENT_TAPE': {
        const data = getCurrentTapeData();
        const tapeId = getCurrentTapeId();
        if (data && tapeId) {
          const tapes = await db.getTapes();
          const tape = tapes.find(t => t.id === tapeId);
          const ext = tape?.format ?? 'tap';
          this._triggerDownload(data, `${tape?.name ?? 'tape'}.${ext}`);
        } else {
          showStatus('No tape data to export.');
        }
        this.close();
        break;
      }

      case 'BASIC':
        resetEmulator();
        setCurrentTapeId(null);
        setCurrentTapeData(null);
        this.close();
        break;

      case 'SAVE':
        await this._promptSave();
        break;

      case 'CREATE_TAPE':
        await this._promptCreateTape();
        break;
    }
  }

  private async _loadTape(tapeId: string): Promise<void> {
    const tapes = await db.getTapes();
    const tape = tapes.find(t => t.id === tapeId);
    if (!tape) { showStatus('Tape not found.'); return; }

    const saves = await db.getSavesForTape(tapeId);
    const quickStart = saves.find(s => s.saveName === 'Quick Start');

    if (quickStart) {
      loadZ80(quickStart.data);
      showStatus(`Loaded: ${tape.name}`);
      return;
    }

    // No Quick Start — load tape and auto-save when done
    if (!tape.data) {
      showStatus('No tape data (Create Tape item).');
      return;
    }

    resetEmulator();
    await loadTapeFile(tape.data, `tape.${tape.format ?? 'tap'}`);
    setCurrentTapeId(tapeId);
    setCurrentTapeData(tape.data);

    registerTapeDoneCallback(() => {
      void this._autoSaveQuickStart(tapeId);
    });

    typeLoadAndRun();
    showStatus(`Loading: ${tape.name}…`);
  }

  private async _autoSaveQuickStart(tapeId: string): Promise<void> {
    // Guard: don't duplicate if one exists
    const saves = await db.getSavesForTape(tapeId);
    if (saves.some(s => s.saveName === 'Quick Start')) return;
    if (!isRomLoaded()) return;
    const data = captureZ80();
    if (data.byteLength === 0) return;
    await db.createSave(tapeId, 'Quick Start', data);
    showStatus('Quick Start saved.');
  }

  private async _promptSave(): Promise<void> {
    const name = await this.panel.prompt('Save name:');
    if (!name) return;
    const tapeId = getCurrentTapeId();
    if (!tapeId) { showStatus('No tape loaded.'); return; }
    if (!isRomLoaded()) return;
    const data = captureZ80();
    if (data.byteLength === 0) return;
    await db.createSave(tapeId, name, data);
    showStatus(`Saved: ${name}`);
    this.close();
  }

  private async _promptCreateTape(): Promise<void> {
    const name = await this.panel.prompt('Tape name:');
    if (!name) return;
    if (!isRomLoaded()) return;
    const data = captureZ80();
    if (data.byteLength === 0) return;
    const tapeId = await db.saveTape(name, null, null);
    await db.createSave(tapeId, 'Quick Start', data);
    setCurrentTapeId(tapeId);
    setCurrentTapeData(null);
    showStatus(`Created tape: ${name}`);
    this.close();
  }

  private async _importUrl(): Promise<void> {
    const url = await this.panel.prompt('URL:');
    if (!url) return;

    let data: ArrayBuffer;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      data = await res.arrayBuffer();
    } catch (e) {
      showStatus('Fetch error: ' + (e as Error).message);
      return;
    }

    const lower = url.toLowerCase();
    const format: 'tap' | 'tzx' = lower.endsWith('.tzx') ? 'tzx' : 'tap';

    const name = await this.panel.prompt('Tape name:');
    if (!name) return;

    const tapeId = await db.saveTape(name, data, format);
    await loadTapeFile(data, `tape.${format}`);
    setCurrentTapeId(tapeId);
    setCurrentTapeData(data);
    showStatus(`Imported: ${name}`);
    this.close();
  }

  private _triggerFileImport(): void {
    // Create a hidden file input, trigger it, handle the file
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.tap,.tzx,.z80,.zip,.rom';
    input.style.display = 'none';
    document.body.appendChild(input);

    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      document.body.removeChild(input);
      if (!file) return;

      const data = await file.arrayBuffer();
      const lower = file.name.toLowerCase();

      if (lower.endsWith('.z80')) {
        loadZ80(data);
        return;
      }

      const format: 'tap' | 'tzx' = lower.endsWith('.tzx') ? 'tzx' : 'tap';

      // Re-open panel for name prompt
      this.panel.el_show_for_import = true;
      this.panel.hide();
      // Use a native prompt for simplicity during file import (panel is hidden)
      const defaultName = file.name.replace(/\.[^.]+$/, '');
      const name = window.prompt('Tape name:', defaultName) ?? defaultName;

      const tapeId = await db.saveTape(name, data, format);
      await loadTapeFile(data, file.name);
      setCurrentTapeId(tapeId);
      setCurrentTapeData(data);
      showStatus(`Imported: ${name}`);
    });

    input.click();
  }

  private _triggerDownload(data: ArrayBuffer, filename: string): void {
    const blob = new Blob([data], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  private _showCurrent(): void {
    const items = this.stack[this.stack.length - 1];
    const title = this.stackTitles[0] ?? 'ZX SPECTRUM';
    const breadcrumb = this.stackTitles.slice(1).join(' › ');
    this.panel.show(items, title, breadcrumb, this.settingCache);
  }
}
```

Note: `this.panel.el_show_for_import` is a quick escape hatch for the file import flow where we need to hide the panel while the file picker is open. Add the property to `MenuPanel`:

In `MenuPanel` class, add the public property: `el_show_for_import = false;`

- [ ] **Step 2: Add el_show_for_import property to MenuPanel**

In `src/ui/menu-panel.ts`, after the line `private _visible = false;`, add:

```ts
  el_show_for_import = false; // used by MenuController file import flow
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors. If `loadTapeFile` import causes a type error because it's not exported, check `src/media/tape.ts` — the function is exported on line 355.

- [ ] **Step 4: Commit**

```bash
git add src/ui/menu-controller.ts src/ui/menu-panel.ts
git commit -m "feat: add MenuController with navigation stack and full action dispatch"
```

---

## Task 9: Remove codex from scene-graph.ts

**Files:**
- Modify: `src/scene/scene-graph.ts`

Remove `createMenuCodex`, `CodexInteraction`, and the `menuCodex`/`codexInteraction` fields from `SceneEntities`.

- [ ] **Step 1: Update scene-graph.ts**

Replace the entire `src/scene/scene-graph.ts` with:

```ts
import * as pc from "playcanvas";
import { createMonitor, type MonitorResult } from "../entities/monitor.js";
import { createKeyboard3D, type Keyboard3DResult } from "../entities/keyboard3d.js";
import { createJoystick3D, type Joystick3DResult } from "../entities/joystick3d.js";
import { createFireButton, type FireButtonResult } from "../entities/fire-button.js";
import { createMenuButton, type MenuButtonResult } from "../entities/menu-button.js";

export interface SceneEntities {
  camera: pc.Entity;
  monitor: pc.Entity;
  screenQuad: pc.Entity;
  screenTexture: pc.Texture;
  borderMaterial: pc.StandardMaterial;
  keyboard: pc.Entity;
  keys: Map<string, pc.Entity>;
  pressKey3D: (index: number, down: boolean) => void;
  joystick: pc.Entity;
  joystickStick: pc.Entity;
  fireButton: pc.Entity;
  fireButtonCap: pc.Entity;
  menuButton: pc.Entity;
}

export function buildSceneGraph(app: pc.Application): SceneEntities {
  // ── Camera ────────────────────────────────────────────────────────────────
  const cameraRig = new pc.Entity("CameraRig");
  const camera = new pc.Entity("MainCamera");
  camera.addComponent("camera", {
    fov: 45,
    nearClip: 0.1,
    farClip: 100,
    clearColor: new pc.Color(0.53, 0.68, 0.82),
  });
  camera.setLocalPosition(0, 0, 7);
  cameraRig.addChild(camera);
  app.root.addChild(cameraRig);

  // ── Lighting ──────────────────────────────────────────────────────────────
  const lighting = new pc.Entity("Lighting");

  const keyLight = new pc.Entity("KeyLight");
  keyLight.addComponent("light", {
    type: "directional",
    color: new pc.Color(1.0, 0.95, 0.85),
    intensity: 1.2,
    castShadows: false,
  });
  keyLight.setLocalEulerAngles(35, 20, 0);
  lighting.addChild(keyLight);

  const fillLight = new pc.Entity("FillLight");
  fillLight.addComponent("light", {
    type: "directional",
    color: new pc.Color(0.7, 0.75, 1.0),
    intensity: 0.5,
    castShadows: false,
  });
  fillLight.setLocalEulerAngles(-20, -40, 0);
  lighting.addChild(fillLight);

  const rimLight = new pc.Entity("RimLight");
  rimLight.addComponent("light", {
    type: "point",
    color: new pc.Color(1.0, 0.85, 0.5),
    intensity: 0.8,
    range: 25,
    castShadows: false,
  });
  rimLight.setLocalPosition(0, 4, -3);
  lighting.addChild(rimLight);

  const kbLight = new pc.Entity("KeyboardLight");
  kbLight.addComponent("light", {
    type: "point",
    color: new pc.Color(1.0, 1.0, 0.95),
    intensity: 1.5,
    range: 20,
    castShadows: false,
  });
  kbLight.setLocalPosition(-5, 0, 15);
  lighting.addChild(kbLight);

  app.root.addChild(lighting);

  // ── Monitor ───────────────────────────────────────────────────────────────
  const monitorResult: MonitorResult = createMonitor(app);
  monitorResult.monitorEntity.setLocalPosition(0, 0.8, 0);
  app.root.addChild(monitorResult.monitorEntity);

  // ── Keyboard ──────────────────────────────────────────────────────────────
  const kbResult: Keyboard3DResult = createKeyboard3D(app);
  kbResult.keyboardEntity.setLocalPosition(0, -1.6, 0);
  app.root.addChild(kbResult.keyboardEntity);

  // ── Joystick ──────────────────────────────────────────────────────────────
  const joyResult: Joystick3DResult = createJoystick3D(app);
  joyResult.joystickEntity.setLocalPosition(-2.0, -2.5, 0);
  joyResult.joystickEntity.setLocalScale(0.5, 0.5, 0.5);
  app.root.addChild(joyResult.joystickEntity);

  // ── Fire Button ───────────────────────────────────────────────────────────
  const fireResult: FireButtonResult = createFireButton(app);
  fireResult.fireEntity.setLocalPosition(2.0, -2.5, 0);
  fireResult.fireEntity.setLocalScale(0.5, 0.5, 0.5);
  app.root.addChild(fireResult.fireEntity);

  // ── Menu Button ───────────────────────────────────────────────────────────
  const menuResult: MenuButtonResult = createMenuButton(app);
  menuResult.menuButtonEntity.setLocalPosition(0, -2.5, 0);
  menuResult.menuButtonEntity.setLocalScale(0.5, 0.5, 0.5);
  app.root.addChild(menuResult.menuButtonEntity);

  return {
    camera,
    monitor: monitorResult.monitorEntity,
    screenQuad: monitorResult.screenQuad,
    screenTexture: monitorResult.screenTexture,
    borderMaterial: monitorResult.borderMaterial,
    keyboard: kbResult.keyboardEntity,
    keys: kbResult.keys,
    pressKey3D: kbResult.pressKey,
    joystick: joyResult.joystickEntity,
    joystickStick: joyResult.joystickStick,
    fireButton: fireResult.fireEntity,
    fireButtonCap: fireResult.fireButtonCap,
    menuButton: menuResult.menuButtonEntity,
  };
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: errors in `input-bridge.ts` and `main.ts` because they still reference `codexInteraction`. That's fine — we fix them in Tasks 10 and 11.

- [ ] **Step 3: Commit (even with errors — they'll be resolved)**

```bash
git add src/scene/scene-graph.ts
git commit -m "refactor: remove menuCodex and codexInteraction from SceneEntities"
```

---

## Task 10: Update input-bridge.ts

**Files:**
- Modify: `src/input/input-bridge.ts`

Remove all codex drag/interaction code and `handleCodexAction`. The menu-button hit now calls `menuController.open()`. `setMenuOpen` is still exported so MenuController can call it.

- [ ] **Step 1: Replace input-bridge.ts**

Replace the entire `src/input/input-bridge.ts` with:

```ts
// Unified input routing — physical keyboard + 3D entity click/touch → WASM

import * as pc from 'playcanvas';
import { KEY_MAP, COMPOUND_KEYS } from './keyboard.js';
import { ROW_BIT_TO_KEY_INDEX } from '../data/key-layout.js';
import { getWasm, isRunning, isPaused, setPaused, isTurboMode, setTurboMode } from '../emulator/state.js';
import { initAudio } from '../audio/audio.js';
import { resetEmulator } from '../emulator/wasm-loader.js';
import { showStatus } from '../ui/status-bridge.js';
import { GestureDetector } from './gesture-detector.js';
import { interpolateScenes, getCurrentScene, transitionToScene } from '../scene/scene-transitions.js';
import type { SceneEntities } from '../scene/scene-graph.js';
import type { MenuController } from '../ui/menu-controller.js';

let audioInitialized = false;

function ensureAudio(): void {
  if (!audioInitialized) {
    initAudio();
    audioInitialized = true;
  }
}

// Sticky modifier state
let capsLatched = false;
let symLatched = false;

// Joystick state
export type JoystickType = 'sinclair1' | 'cursor' | 'kempston';
let joystickType: JoystickType = 'sinclair1';
let joystickActive = false;
let firePressed = false;

const JOYSTICK_FIRE: Record<JoystickType, { row: number; bit: number }> = {
  sinclair1: { row: 4, bit: 0x01 },
  cursor:    { row: 4, bit: 0x01 },
  kempston:  { row: 4, bit: 0x01 },
};

export function setJoystickType(type: JoystickType): void {
  joystickType = type;
}

export function getJoystickType(): JoystickType {
  return joystickType;
}

// State machine actor reference — set after creation
let sceneActor: any = null;

export function setSceneActor(actor: any): void {
  sceneActor = actor;
}

function sendScene(event: Record<string, unknown>): void {
  if (!sceneActor) return;
  console.log(`[SceneMachine] → send:`, event);
  sceneActor.send(event);
}

const gestureDetector = new GestureDetector();

// Whether the menu is currently open (set by MenuController)
let menuOpen = false;

export function setMenuOpen(open: boolean): void {
  menuOpen = open;
}

// MenuController reference — set by main.ts after construction
let menuController: MenuController | null = null;

export function setMenuController(ctrl: MenuController): void {
  menuController = ctrl;
}

export function initInputBridge(app: pc.Application, entities: SceneEntities): void {
  // ── Physical keyboard input ─────────────────────────────────────────────
  window.addEventListener('keydown', (e: KeyboardEvent) => {
    const tag = (e.target as HTMLElement).tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;

    ensureAudio();

    // While menu is open, MenuPanel handles its own keyboard in capture phase
    if (menuOpen) return;

    const wasm = getWasm();
    if (!wasm || !isRunning()) return;

    if (e.metaKey) return;

    const compound = COMPOUND_KEYS[e.code];
    if (compound) {
      e.preventDefault();
      for (const k of compound) {
        wasm.keyDown(k.row, k.bit);
        const idx = ROW_BIT_TO_KEY_INDEX[`${k.row},${k.bit}`];
        if (idx !== undefined) entities.pressKey3D(idx, true);
      }
      return;
    }

    const mapping = KEY_MAP[e.code];
    if (mapping) {
      e.preventDefault();
      wasm.keyDown(mapping.row, mapping.bit);
      const idx = ROW_BIT_TO_KEY_INDEX[`${mapping.row},${mapping.bit}`];
      if (idx !== undefined) entities.pressKey3D(idx, true);
    }
  });

  window.addEventListener('keyup', (e: KeyboardEvent) => {
    const wasm = getWasm();
    if (!wasm) return;

    const tag = (e.target as HTMLElement).tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;

    if (e.code === 'MetaLeft' || e.code === 'MetaRight') {
      releaseAllKeys();
      return;
    }

    const compound = COMPOUND_KEYS[e.code];
    if (compound) {
      e.preventDefault();
      for (const k of compound) {
        wasm.keyUp(k.row, k.bit);
        const idx = ROW_BIT_TO_KEY_INDEX[`${k.row},${k.bit}`];
        if (idx !== undefined) entities.pressKey3D(idx, false);
      }
      return;
    }

    const mapping = KEY_MAP[e.code];
    if (mapping) {
      e.preventDefault();
      wasm.keyUp(mapping.row, mapping.bit);
      const idx = ROW_BIT_TO_KEY_INDEX[`${mapping.row},${mapping.bit}`];
      if (idx !== undefined) entities.pressKey3D(idx, false);
    }
  });

  function releaseAllKeys(): void {
    const wasm = getWasm();
    if (!wasm) return;
    const seen = new Set<string>();
    const allMappings: Array<{ row: number; bit: number }> = [
      ...Object.values(KEY_MAP),
      ...Object.values(COMPOUND_KEYS).flat(),
    ];
    for (const k of allMappings) {
      const key = `${k.row},${k.bit}`;
      if (seen.has(key)) continue;
      seen.add(key);
      wasm.keyUp(k.row, k.bit);
      const idx = ROW_BIT_TO_KEY_INDEX[key];
      if (idx !== undefined) entities.pressKey3D(idx, false);
    }
    releaseHeldKey();
  }

  window.addEventListener('blur', releaseAllKeys);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) releaseAllKeys();
  });

  // ── 3D entity click/touch input ─────────────────────────────────────────
  const canvas = app.graphicsDevice.canvas;
  const camera = entities.camera;

  const pressedKeys = new Set<string>();
  let heldSpectrumKey: { row: number; bit: number; keyIndex: number | undefined } | null = null;

  function releaseHeldKey(): void {
    if (!heldSpectrumKey) return;
    const wasm = getWasm();
    if (wasm) {
      wasm.keyUp(heldSpectrumKey.row, heldSpectrumKey.bit);
      if (heldSpectrumKey.keyIndex !== undefined) {
        entities.pressKey3D(heldSpectrumKey.keyIndex, false);
      }
    }
    heldSpectrumKey = null;
  }

  function pressSpectrumKey(screenX: number, screenY: number): void {
    const wasm = getWasm();
    if (!wasm || !isRunning()) return;
    ensureAudio();
    const hit = raycastFromScreen(app, camera, screenX, screenY);
    if (!hit?.tags.has('spectrum-key')) return;

    const row = (hit as any)._specRow as number;
    const bit = (hit as any)._specBit as number;
    const sticky = (hit as any)._sticky as boolean;
    const label = (hit as any)._label as string;
    const keyIndex = (hit as any)._specKeyIndex as number | undefined;

    if (sticky) {
      if (label.startsWith('CAPS')) {
        capsLatched = !capsLatched;
        if (capsLatched) wasm.keyDown(row, bit); else wasm.keyUp(row, bit);
        if (keyIndex !== undefined) entities.pressKey3D(keyIndex, capsLatched);
      } else if (label.startsWith('SYM')) {
        symLatched = !symLatched;
        if (symLatched) wasm.keyDown(row, bit); else wasm.keyUp(row, bit);
        if (keyIndex !== undefined) entities.pressKey3D(keyIndex, symLatched);
      }
    } else {
      wasm.keyDown(row, bit);
      if (keyIndex !== undefined) entities.pressKey3D(keyIndex, true);
      heldSpectrumKey = { row, bit, keyIndex };
    }
  }

  function handlePointerDown(screenX: number, screenY: number): void {
    const wasm = getWasm();
    if (!wasm || !isRunning()) return;
    ensureAudio();

    const hit = raycastFromScreen(app, camera, screenX, screenY);

    if (menuOpen) {
      // Tap outside the HTML panel area closes menu
      if (!hit) menuController?.close();
      return;
    }

    if (!hit) return;

    if (hit.tags.has('fire-button')) {
      const fireKey = JOYSTICK_FIRE[joystickType];
      wasm.keyDown(fireKey.row, fireKey.bit);
      firePressed = true;
      animateKeyPress(entities.fireButtonCap, true);
      return;
    }

    if (hit.tags.has('menu-button')) {
      void menuController?.open();
      return;
    }

    if (hit.tags.has('joystick')) {
      joystickActive = true;
      return;
    }
  }

  function handlePointerUp(_screenX: number, _screenY: number): void {
    const wasm = getWasm();
    if (!wasm) return;

    if (firePressed) {
      const fireKey = JOYSTICK_FIRE[joystickType];
      wasm.keyUp(fireKey.row, fireKey.bit);
      firePressed = false;
      animateKeyPress(entities.fireButtonCap, false);
    }

    joystickActive = false;

    for (const name of pressedKeys) {
      const entity = findEntityByName(app.root, name);
      if (entity && entity.tags.has('spectrum-key')) {
        const row = (entity as any)._specRow as number;
        const bit = (entity as any)._specBit as number;
        const keyIndex = (entity as any)._specKeyIndex as number | undefined;
        wasm.keyUp(row, bit);
        if (keyIndex !== undefined) {
          entities.pressKey3D(keyIndex, false);
        } else {
          animateKeyPress(entity, false);
        }
      }
    }
    pressedKeys.clear();
  }

  // ── Gesture-aware pointer events ──────────────────────────────────────────

  let sceneDragging = false;

  function getSwipeTarget(direction: 'up' | 'down'): string | null {
    const current = getCurrentScene();
    if (current === 'portrait1' && direction === 'up') return 'portrait2';
    if (current === 'portrait1' && direction === 'down') return 'portrait2';
    if (current === 'portrait2' && direction === 'up') return 'portrait1';
    if (current === 'portrait2' && direction === 'down') return 'portrait1';
    return null;
  }

  let pendingDownX = 0;
  let pendingDownY = 0;

  function pointerDown(screenX: number, screenY: number): void {
    pendingDownX = screenX;
    pendingDownY = screenY;

    const screenHit = raycastFromScreen(app, camera, screenX, screenY);
    if (screenHit?.tags.has('screen')) {
      const viewportH = canvas.clientHeight || canvas.height;
      gestureDetector.beginTracking(screenY, viewportH);
    }

    if (menuOpen) {
      handlePointerDown(screenX, screenY);
      return;
    }
    pressSpectrumKey(screenX, screenY);
  }

  function pointerMove(screenX: number, screenY: number): void {
    if (heldSpectrumKey) {
      const dx = screenX - pendingDownX;
      const dy = screenY - pendingDownY;
      if (dx * dx + dy * dy > 64) releaseHeldKey();
    }

    if (gestureDetector.isTracking()) {
      const drag = gestureDetector.updateTracking(screenY);
      if (drag && drag.progress > 0.02) {
        const target = getSwipeTarget(drag.direction);
        if (target) {
          sceneDragging = true;
          interpolateScenes(getCurrentScene(), target, drag.progress, entities);
        }
      }
    }
  }

  function pointerUp(_screenX: number, screenY: number): void {
    releaseHeldKey();

    const result = gestureDetector.endTracking(screenY);
    if (sceneDragging) {
      sceneDragging = false;
      const target = result && getSwipeTarget(result.direction);
      if (result?.commit && target) {
        sendScene({ type: 'SWIPE', direction: result.direction });
        return;
      }
      sendScene({ type: 'SWIPE_CANCEL' });
      const current = getCurrentScene();
      if (sceneActor) transitionToScene(current, entities);
    }

    handlePointerDown(pendingDownX, pendingDownY);
    setTimeout(() => {
      handlePointerUp(pendingDownX, pendingDownY);
    }, 120);
  }

  // Mouse events
  canvas.addEventListener('mousedown', (e: MouseEvent) => { pointerDown(e.offsetX, e.offsetY); });
  canvas.addEventListener('mousemove', (e: MouseEvent) => { pointerMove(e.offsetX, e.offsetY); });
  canvas.addEventListener('mouseup',   (e: MouseEvent) => { pointerUp(e.offsetX, e.offsetY); });

  // Touch events
  canvas.addEventListener('touchstart', (e: TouchEvent) => {
    e.preventDefault();
    const touch = e.changedTouches[0];
    const rect = canvas.getBoundingClientRect();
    pointerDown(touch.clientX - rect.left, touch.clientY - rect.top);
  }, { passive: false });

  canvas.addEventListener('touchmove', (e: TouchEvent) => {
    e.preventDefault();
    const touch = e.changedTouches[0];
    const rect = canvas.getBoundingClientRect();
    pointerMove(touch.clientX - rect.left, touch.clientY - rect.top);
  }, { passive: false });

  canvas.addEventListener('touchend', (e: TouchEvent) => {
    e.preventDefault();
    const touch = e.changedTouches[0];
    const rect = canvas.getBoundingClientRect();
    pointerUp(touch.clientX - rect.left, touch.clientY - rect.top);
  }, { passive: false });

  canvas.addEventListener('touchcancel', () => {
    releaseAllKeys();
    joystickActive = false;
    if (firePressed) {
      const wasm = getWasm();
      if (wasm) wasm.keyUp(JOYSTICK_FIRE[joystickType].row, JOYSTICK_FIRE[joystickType].bit);
      firePressed = false;
      animateKeyPress(entities.fireButtonCap, false);
    }
  });
}

// ── Raycasting ─────────────────────────────────────────────────────────────────

function raycastFromScreen(
  app: pc.Application,
  camera: pc.Entity,
  screenX: number,
  screenY: number,
): pc.Entity | null {
  const cam = camera.camera!;
  const from = new pc.Vec3();
  const to = new pc.Vec3();
  cam.screenToWorld(screenX, screenY, cam.nearClip, from);
  cam.screenToWorld(screenX, screenY, cam.farClip, to);

  const ray = new pc.Ray(from, to.sub(from).normalize());
  let closestEntity: pc.Entity | null = null;
  let closestDist = Infinity;

  const KEY_HIT_RADIUS = 0.3;
  let closestPerpDist = KEY_HIT_RADIUS;
  const spectrumKeys = app.root.findByTag('spectrum-key') as pc.Entity[];
  for (const entity of spectrumKeys) {
    const pos = entity.getPosition();
    const toPos = new pc.Vec3().sub2(pos, from);
    const proj = toPos.dot(ray.direction);
    if (proj <= 0) continue;
    const closestPoint = new pc.Vec3().copy(ray.direction).mulScalar(proj).add(from);
    const perpDist = pos.distance(closestPoint);
    if (perpDist < closestPerpDist) {
      closestPerpDist = perpDist;
      closestDist = proj;
      closestEntity = entity;
    }
  }

  const otherTags = ['fire-button', 'menu-button', 'joystick', 'screen'];
  for (const tag of otherTags) {
    const tagEntities = app.root.findByTag(tag) as pc.Entity[];
    for (const entity of tagEntities) {
      const aabb = getEntityAABB(entity);
      const hitPoint = new pc.Vec3();
      if (aabb.intersectsRay(ray, hitPoint)) {
        const dist = from.distance(hitPoint);
        if (dist < closestDist) {
          closestDist = dist;
          closestEntity = entity;
        }
      }
    }
  }

  return closestEntity;
}

function getEntityAABB(entity: pc.Entity): pc.BoundingBox {
  const render = entity.render;
  if (render && render.meshInstances.length > 0) {
    const mesh = render.meshInstances[0].mesh;
    if (mesh) {
      const worldAabb = new pc.BoundingBox();
      worldAabb.setFromTransformedAabb(mesh.aabb, entity.getWorldTransform());
      worldAabb.halfExtents.add(new pc.Vec3(0.05, 0.05, 0.1));
      return worldAabb;
    }
  }
  const pos = entity.getPosition();
  const scale = entity.getLocalScale();
  const parent = entity.parent;
  const parentScale = parent ? parent.getLocalScale() : new pc.Vec3(1, 1, 1);
  const halfExtents = new pc.Vec3(
    (scale.x * parentScale.x) / 2,
    (scale.y * parentScale.y) / 2,
    (scale.z * parentScale.z) / 2,
  );
  return new pc.BoundingBox(pos, halfExtents);
}

function findEntityByName(root: pc.Entity, name: string): pc.Entity | null {
  return root.findByName(name) as pc.Entity | null;
}

function animateKeyPress(entity: pc.Entity, down: boolean): void {
  const pos = entity.getLocalPosition();
  if (down) {
    entity.setLocalPosition(pos.x, pos.y - 0.02, pos.z);
  } else {
    entity.setLocalPosition(pos.x, pos.y + 0.02, pos.z);
  }
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: errors only in `main.ts` because it still calls `entities.codexInteraction.update(dt)`. That's fine — fixed in Task 11.

- [ ] **Step 3: Commit**

```bash
git add src/input/input-bridge.ts
git commit -m "refactor: remove codex interaction from input-bridge; menu-button calls menuController.open()"
```

---

## Task 11: Wire everything in main.ts + session restore

**Files:**
- Modify: `src/main.ts`

Add: import + construct `MenuController`, pass it to `setMenuController`, wire `beforeunload` for session save, restore current image on startup, remove `codexInteraction.update(dt)`.

- [ ] **Step 1: Replace main.ts**

```ts
// ZX Spectrum 48K Emulator — Steam-Punk 3D UI Entry Point

import { initPlayCanvasApp } from './scene/app.js';
import { buildSceneGraph } from './scene/scene-graph.js';
import { createStatusOverlay } from './ui/status-overlay.js';
import { initWasm } from './emulator/wasm-loader.js';
import { tickEmulatorFrame } from './emulator/frame-loop.js';
import { updateMonitorTexture, updateBorderColor } from './entities/monitor.js';
import { getWasm, getMemory, isRunning, isRomLoaded } from './emulator/state.js';
import { initInputBridge, setSceneActor, setMenuOpen, setMenuController } from './input/input-bridge.js';
import { setGlobalStatusFn } from './ui/status-bridge.js';
import { initFileHandler } from './ui/file-handler.js';
import { createSceneMachineActor } from './state-machine/machine.js';
import { updateTweens, setViewportParams, snapToCurrentScene } from './scene/scene-transitions.js';
import { createFrustumMarkers } from './debug/frustum-markers.js';
import { MenuController } from './ui/menu-controller.js';
import { captureZ80, loadZ80 } from './media/snapshot.js';
import * as db from './data/db.js';

const FRAME_INTERVAL = 1000 / 50;

async function main(): Promise<void> {
  // 1. Create PlayCanvas application
  const app = initPlayCanvasApp();

  // 2. Build 3D scene graph
  const entities = buildSceneGraph(app);

  // DEBUG: frustum corner markers — remove when measurements confirmed
  const frustumMarkers = createFrustumMarkers(app, entities.camera);

  // 3. Create status overlay
  const { setStatusText } = createStatusOverlay(app);

  // 4. Create and start XState scene state machine
  const sceneActor = createSceneMachineActor(entities);
  sceneActor.start();

  // 5. Wire PlayCanvas update loop
  let frameAccum = 0;

  app.on('update', (dt: number) => {
    frameAccum += dt * 1000;

    while (frameAccum >= FRAME_INTERVAL) {
      frameAccum -= FRAME_INTERVAL;
      tickEmulatorFrame();
    }

    const wasm = getWasm();
    const memory = getMemory();
    if (wasm && memory && isRunning()) {
      updateMonitorTexture(entities.screenTexture, memory, wasm);
      updateBorderColor(entities.borderMaterial, wasm);
    }

    updateTweens(dt);
    frustumMarkers.update(dt);
  });

  // 6. Wire global status function
  setGlobalStatusFn(setStatusText);

  // 7. Load WASM and ROM
  await initWasm(setStatusText);

  // 8. Initialize input system + wire state machine actor
  initInputBridge(app, entities);
  setSceneActor(sceneActor);

  // 9. Create MenuController and wire into input-bridge
  const menuController = new MenuController();
  setMenuController(menuController);

  // 10. Track menu state via state machine (for any remaining state-machine-driven menu states)
  sceneActor.subscribe((state: any) => {
    const isMenu = state.value === 'menuPortrait' || state.value === 'menuLandscape';
    if (isMenu) setMenuOpen(true);
    console.log(`[SceneMachine] state: ${String(state.value)} | context:`, {
      lastPortrait: state.context.lastPortraitScene,
      orientation: state.context.orientation,
      previousScene: state.context.previousScene,
    });
  });

  // 11. Initialize file handling (drag-drop + hidden file input)
  initFileHandler();

  // 12. Set initial viewport params
  function updateViewport(): void {
    const canvas = app.graphicsDevice.canvas;
    const aspect = canvas.clientWidth / canvas.clientHeight;
    setViewportParams(45, aspect);
  }
  updateViewport();

  // 13. Detect initial orientation
  const orientation = window.innerHeight > window.innerWidth ? 'portrait' : 'landscape';
  console.log(`[SceneMachine] initial orientation: ${orientation}`);
  if (orientation === 'landscape') {
    sceneActor.send({ type: 'ORIENTATION_CHANGE', orientation: 'landscape' });
  }

  // 14. Listen for resize
  let currentOrientation = orientation;
  window.addEventListener('resize', () => {
    updateViewport();
    snapToCurrentScene();
    const newOrientation = window.innerHeight > window.innerWidth ? 'portrait' : 'landscape';
    if (newOrientation !== currentOrientation) {
      console.log(`[SceneMachine] orientation change: ${currentOrientation} → ${newOrientation}`);
      currentOrientation = newOrientation;
      sceneActor.send({ type: 'ORIENTATION_CHANGE', orientation: newOrientation });
    }
  });

  // 15. Session restore — load previous session state from IndexedDB
  const savedImage = await db.loadCurrentImage();
  if (savedImage) {
    loadZ80(savedImage);
    console.log('[Session] Restored previous session.');
  }

  // 16. Auto-save session state on page unload
  window.addEventListener('beforeunload', () => {
    if (isRomLoaded()) {
      const data = captureZ80();
      if (data.byteLength > 0) {
        void db.saveCurrentImage(data);
      }
    }
  });
}

main().catch(console.error);
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors (all codex references are gone).

- [ ] **Step 3: Build**

```bash
bun run build
```

Expected: clean build with no TypeScript errors, WASM compiled, Vite bundle produced.

- [ ] **Step 4: Commit**

```bash
git add src/main.ts
git commit -m "feat: wire MenuController, session restore, and beforeunload save in main.ts"
```

---

## Task 12: Delete obsolete files

**Files:**
- Delete: `src/entities/menu-codex.ts`
- Delete: `src/input/codex-interaction.ts`

- [ ] **Step 1: Delete the files**

```bash
rm /Users/jackallan/dev/z80/src/entities/menu-codex.ts
rm /Users/jackallan/dev/z80/src/input/codex-interaction.ts
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors (nothing imports these files after the previous tasks).

- [ ] **Step 3: Build**

```bash
bun run build
```

Expected: clean build.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: delete menu-codex.ts and codex-interaction.ts (replaced by HTML menu)"
```

---

## Task 13: Smoke test in browser

- [ ] **Step 1: Start dev server**

```bash
bun run dev
```

Open browser at `http://localhost:5173` (or whatever port Vite reports).

- [ ] **Step 2: Verify menu opens**

Click the menu button in the 3D scene. Expected: black overlay panel appears with "► ZX SPECTRUM" header and the full item list.

- [ ] **Step 3: Verify keyboard navigation**

Press `↑`/`↓` to navigate, `Enter` to select a submenu item. Expected: submenu items push onto the stack, header shows breadcrumb (e.g. `SETTINGS`), `◄ BACK` appears at top.

- [ ] **Step 4: Verify tape import**

Select `IMPORT TAPE/TZX/Z80/ZIP`, pick a `.tap` file. Expected: browser `prompt()` for tape name, tape loads and plays.

- [ ] **Step 5: Verify Quick Start save**

After a tape finishes loading (ROM trap), the tape-done callback fires. Open the menu, select the tape name. Expected: `Quick Start` save is used, emulator restores to post-load state.

- [ ] **Step 6: Verify session restore**

Reload the page. Expected: emulator automatically restores the previous session state without re-loading the tape.

- [ ] **Step 7: Verify settings**

Open `Settings > Joystick > Overlay`. Expected: toggles between `● ON` and `○ OFF`. Open `Settings > Clock Speed`. Expected: choice list with current value marked.

---

## Self-Review

### Spec coverage check

| Spec Section | Covered By |
|---|---|
| `src/data/db.ts` — 4 stores + full API | Task 5 |
| `src/ui/menu-def.ts` — MenuItem types | Task 6 |
| `buildRootMenu()` conditional items | Task 6 |
| `MenuController` open/close/push/pop | Task 8 |
| `MenuController activate()` — action/submenu/toggle/choice | Task 8 |
| BACK auto-prepend | Task 8 `push()` |
| `MenuPanel` ZX Retro style | Task 7 |
| `MenuPanel` text input mode | Task 7 `prompt()` |
| `MenuPanel` choice ●/○ prefix | Task 7 `_render()` toggle/choice rows |
| `state.ts` — `currentTapeId`/`currentTapeData` | Task 1 |
| `frame-loop.ts` — tape-done callback | Task 3 |
| `snapshot.ts` — `captureZ80()` | Task 2 |
| `keyboard-macro.ts` — `typeLoadAndRun()` | Task 4 |
| Quick Start flow | Task 8 `_loadTape()` |
| `autoSaveQuickStart` guard | Task 8 `_autoSaveQuickStart()` |
| Session restore on startup | Task 11 step 15 |
| `beforeunload` auto-save | Task 11 step 16 |
| Remove `menu-codex.ts` + `codex-interaction.ts` | Tasks 9, 10, 12 |
| `SceneEntities` no longer includes codex fields | Task 9 |
| `input-bridge.ts` menu-button calls `menuController.open()` | Task 10 |

All spec requirements covered. No gaps found.

### Type consistency check

- `TapeItem` / `SaveItem` defined in `db.ts` (Task 5), imported in `menu-def.ts` (Task 6) and `menu-controller.ts` (Task 8) ✓
- `MenuItem` defined in `menu-def.ts` (Task 6), used in `menu-panel.ts` (Task 7) and `menu-controller.ts` (Task 8) ✓
- `captureZ80()` returns `ArrayBuffer` (Task 2); used in Task 8 and Task 11 ✓
- `registerTapeDoneCallback(cb: () => void)` defined in Task 3, called in Task 8 ✓
- `setMenuController` exported from `input-bridge.ts` (Task 10), called in `main.ts` (Task 11) ✓
- `setMenuOpen` exported from `input-bridge.ts` (existing + kept), called in `menu-controller.ts` (Task 8) ✓

### Placeholder scan

No TBDs, TODOs, or incomplete stubs found. All code steps are complete.
