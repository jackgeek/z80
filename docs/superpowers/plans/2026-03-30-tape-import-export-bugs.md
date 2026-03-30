# Tape Import/Export Bug Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix four bugs in tape import/export: ZIP TZX preference, iOS accept filter, URL import error messages.

**Architecture:** All changes are surgical edits to three existing files. No new files or abstractions needed. Bug 3 (export) requires no code change — the existing raw download is already correct.

**Tech Stack:** TypeScript, Vite, browser APIs (File, ArrayBuffer). No test framework — manual browser verification.

---

## File Map

- Modify: `src/media/tape.ts` — ZIP selection logic
- Modify: `src/ui/menu-controller.ts` — file import accept, format detection, URL error messages
- Modify: `src/index.html` — `#file-input` accept attribute
- Modify: `src/ui/file-handler.ts` — unknown file type error message

---

### Task 1: Fix ZIP selection logic in `tape.ts`

**Files:**
- Modify: `src/media/tape.ts:373-384`

Currently `loadTapeFile` picks the first `.tap` or `.tzx` entry from a ZIP. It needs to:
- Collect all `.tap`/`.tzx` entries
- If 0: existing error path (unchanged)
- If exactly 1: use it (unchanged behaviour)
- If exactly 2 and one is `.tzx` + one is `.tap`: pick the `.tzx`
- Any other case with >1 entry: error "ZIP must contain at most one TAP or TZX file."

- [ ] **Step 1: Open `src/media/tape.ts` and locate the ZIP branch** (~line 374)

  Current code in the `if (name.endsWith('.zip') || ...)` branch:
  ```typescript
  const files = await extractZip(data);
  const entry = files.find(f => f.name.endsWith('.tap') || f.name.endsWith('.tzx'));
  if (!entry) {
    showStatus('No .tap or .tzx file found inside ZIP.');
    return;
  }
  isTzx = entry.name.endsWith('.tzx');
  if (isTzx) tzxSource = entry.data;
  tapData = isTzx ? tzxToTap(entry.data) : entry.data;
  showStatus(`Loaded ${entry.name} from ZIP.`);
  ```

- [ ] **Step 2: Replace with the new selection logic**

  Replace the block above with:
  ```typescript
  const files = await extractZip(data);
  const tapeFiles = files.filter(f => f.name.endsWith('.tap') || f.name.endsWith('.tzx'));
  let entry: { name: string; data: ArrayBuffer } | undefined;
  if (tapeFiles.length === 0) {
    showStatus('No .tap or .tzx file found inside ZIP.');
    return;
  } else if (tapeFiles.length === 1) {
    entry = tapeFiles[0];
  } else {
    const tzxEntry = tapeFiles.find(f => f.name.endsWith('.tzx'));
    const tapEntry = tapeFiles.find(f => f.name.endsWith('.tap'));
    if (tzxEntry && tapEntry && tapeFiles.length === 2) {
      entry = tzxEntry;
    } else {
      showStatus('ZIP must contain at most one TAP or TZX file.');
      return;
    }
  }
  isTzx = entry.name.endsWith('.tzx');
  if (isTzx) tzxSource = entry.data;
  tapData = isTzx ? tzxToTap(entry.data) : entry.data;
  showStatus(`Loaded ${entry.name} from ZIP.`);
  ```

- [ ] **Step 3: Verify build passes**

  ```bash
  cd /Users/jackallan/dev/z80 && bun run build 2>&1 | tail -20
  ```
  Expected: no TypeScript errors, build succeeds.

- [ ] **Step 4: Commit**

  ```bash
  cd /Users/jackallan/dev/z80
  git add src/media/tape.ts
  git commit -m "fix: prefer TZX over TAP in ZIP imports, error on multiple tape files"
  ```

---

### Task 2: Fix format detection after ZIP import in `menu-controller.ts`

**Files:**
- Modify: `src/ui/menu-controller.ts:333-342`

After the file picker loads a ZIP, the format is hardcoded to `'tap'`. It should be read from the selected entry's extension.

- [ ] **Step 1: Locate `_triggerFileImport` in `src/ui/menu-controller.ts`** (~line 316)

  Find this block inside the `change` event handler:
  ```typescript
  const format: 'tap' | 'tzx' = lower.endsWith('.tzx') ? 'tzx' : 'tap';
  const defaultName = file.name.replace(/\.[^.]+$/, '');
  const name = window.prompt('Tape name:', defaultName) ?? defaultName;

  const tapeId = await db.saveTape(name, data, format);
  ```

  The issue: when `lower` ends with `.zip`, `format` becomes `'tap'` regardless of what's inside.

- [ ] **Step 2: Replace the format detection with ZIP-aware logic**

  Replace the block above (from `const format:` through `const tapeId =`) with:
  ```typescript
  let format: 'tap' | 'tzx' = lower.endsWith('.tzx') ? 'tzx' : 'tap';

  if (lower.endsWith('.zip')) {
    const { extractZip } = await import('../media/tape.js');
    const zipFiles = await extractZip(data);
    const tapeFiles = zipFiles.filter(f => f.name.endsWith('.tap') || f.name.endsWith('.tzx'));
    const chosen = tapeFiles.length === 2
      ? tapeFiles.find(f => f.name.endsWith('.tzx')) ?? tapeFiles[0]
      : tapeFiles[0];
    format = chosen?.name.endsWith('.tzx') ? 'tzx' : 'tap';
  }

  const defaultName = file.name.replace(/\.[^.]+$/, '');
  const name = window.prompt('Tape name:', defaultName) ?? defaultName;

  const tapeId = await db.saveTape(name, data, format);
  ```

  Note: `extractZip` is already imported at the top of `tape.ts` but not yet in `menu-controller.ts`. Check the existing imports at the top of `menu-controller.ts` — `loadTapeFile` is imported from `'../media/tape.js'`. Add `extractZip` to that import:
  ```typescript
  import { loadTapeFile, extractZip } from '../media/tape.js';
  ```

- [ ] **Step 3: Verify build passes**

  ```bash
  cd /Users/jackallan/dev/z80 && bun run build 2>&1 | tail -20
  ```
  Expected: no TypeScript errors.

- [ ] **Step 4: Commit**

  ```bash
  cd /Users/jackallan/dev/z80
  git add src/ui/menu-controller.ts
  git commit -m "fix: detect correct TAP/TZX format from ZIP contents on file import"
  ```

---

### Task 3: Fix iOS file accept filter

**Files:**
- Modify: `src/ui/menu-controller.ts` — `_triggerFileImport` accept attribute
- Modify: `src/index.html` — `#file-input` accept attribute
- Modify: `src/ui/file-handler.ts` — unknown file type message

iOS Safari ignores or mishandles `accept` lists with specific extensions — users can't select the right files. Removing the `accept` filter entirely allows all files through, then we validate by extension after selection.

- [ ] **Step 1: Remove accept filter from `_triggerFileImport` in `menu-controller.ts`**

  Find (~line 318):
  ```typescript
  input.accept = '.tap,.tzx,.z80,.zip,.rom';
  ```
  Change to:
  ```typescript
  input.accept = '';
  ```

- [ ] **Step 2: Add post-selection validation in `_triggerFileImport`**

  After `const lower = file.name.toLowerCase();` and before the `.z80` branch, add a validation guard:
  ```typescript
  const validExts = ['.tap', '.tzx', '.zip', '.z80', '.rom', '.bin'];
  if (!validExts.some(ext => lower.endsWith(ext))) {
    showStatus('Unsupported file. Expected TAP, TZX, ZIP, Z80, or ROM.');
    return;
  }
  ```

- [ ] **Step 3: Fix `accept` on `#file-input` in `index.html`**

  Find:
  ```html
  <input type="file" id="file-input" accept=".tap,.tzx,.z80,.zip,.rom,.bin" style="display:none">
  ```
  Change to:
  ```html
  <input type="file" id="file-input" accept="*/*" style="display:none">
  ```

- [ ] **Step 4: Improve error message in `file-handler.ts`**

  In `src/ui/file-handler.ts`, find the `handleFile` function's final `else` branch (~line 51):
  ```typescript
  } else {
    showStatus('Unknown file type: ' + file.name);
  }
  ```
  Change to:
  ```typescript
  } else {
    showStatus('Unsupported file type. Please use a TAP, TZX, ZIP, Z80, or ROM file.');
  }
  ```

- [ ] **Step 5: Verify build passes**

  ```bash
  cd /Users/jackallan/dev/z80 && bun run build 2>&1 | tail -20
  ```
  Expected: no errors.

- [ ] **Step 6: Commit**

  ```bash
  cd /Users/jackallan/dev/z80
  git add src/ui/menu-controller.ts src/index.html src/ui/file-handler.ts
  git commit -m "fix: remove accept filter for iOS compatibility, validate file type after selection"
  ```

---

### Task 4: Improve URL import error messages

**Files:**
- Modify: `src/ui/menu-controller.ts` — `_importUrl` method (~line 288)

Currently errors from URL imports show only the raw error message with no context. We need to:
- Include the HTTP status/statusText when the response is not OK
- Add a note about the CORS proxy in all failure messages

- [ ] **Step 1: Locate `_importUrl` in `menu-controller.ts`**

  Find the try/catch block (~line 297):
  ```typescript
  try {
    showStatus('Fetching…');
    const fetchUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
    const res = await fetch(fetchUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.arrayBuffer();
    // ...
  } catch (e) {
    showStatus('Import error: ' + (e as Error).message);
  }
  ```

- [ ] **Step 2: Replace with improved error handling**

  Change `if (!res.ok) throw new Error(`HTTP ${res.status}`);` to:
  ```typescript
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`.trim());
  ```

  Change the catch block from:
  ```typescript
  } catch (e) {
    showStatus('Import error: ' + (e as Error).message);
  }
  ```
  to:
  ```typescript
  } catch (e) {
    showStatus(`Import failed: ${(e as Error).message}. URL imports rely on a CORS proxy (allorigins.win) — some URLs may not be supported.`);
  }
  ```

- [ ] **Step 3: Verify build passes**

  ```bash
  cd /Users/jackallan/dev/z80 && bun run build 2>&1 | tail -20
  ```
  Expected: no errors.

- [ ] **Step 4: Commit**

  ```bash
  cd /Users/jackallan/dev/z80
  git add src/ui/menu-controller.ts
  git commit -m "fix: improve URL import error messages, mention CORS proxy on failure"
  ```

---

### Task 5: Manual verification

- [ ] **Step 1: Start dev server**

  ```bash
  cd /Users/jackallan/dev/z80 && bun run dev
  ```

- [ ] **Step 2: Verify Bug 1 — ZIP with both TAP and TZX picks TZX**

  Create a test ZIP containing both a `.tap` and `.tzx` file. Import via the menu. Confirm TZX format is stored (check the tape's export extension is `.tzx`).

- [ ] **Step 3: Verify Bug 1 — ZIP with two TZX files shows error**

  Create a ZIP with two `.tzx` files. Import. Confirm status shows "ZIP must contain at most one TAP or TZX file."

- [ ] **Step 4: Verify Bug 2 — File picker accepts any file on iOS**

  On an iOS device (or Safari), open the file import. Confirm all file types are selectable. Import an unsupported file type (e.g. `.pdf`) and confirm the error message appears.

- [ ] **Step 5: Verify Bug 4 — URL import failure shows CORS note**

  Use a URL that will fail (e.g. an invalid URL or one blocked by the proxy). Confirm the status message includes both the failure reason and the CORS proxy note.

- [ ] **Step 6: Verify drag-drop still works**

  Drag a `.tap` file onto the emulator. Confirm it loads correctly (existing `file-handler.ts` path).
