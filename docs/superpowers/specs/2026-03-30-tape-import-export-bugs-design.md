# Tape Import/Export Bug Fixes — Design

**Date:** 2026-03-30

## Summary

Four bugs in the tape import/export flow:

1. ZIP import doesn't prefer TZX over TAP, and allows multiple tape files silently
2. File import `accept` attribute blocks TAP/TZX on iOS
3. Export should download the raw file (not zipped — no size benefit)
4. URL import shows no useful error message on failure

---

## Bug 1 — ZIP Import: Prefer TZX, Error on Multiple

**Location:** `tape.ts` → `loadTapeFile`, and `menu-controller.ts` → `_triggerFileImport`

**Rules:**
- After `extractZip`, filter entries to those ending `.tap` or `.tzx`.
- If 0 found: existing error ("No .tap or .tzx file found inside ZIP.")
- If exactly 1: use it.
- If exactly 2 and one is `.tzx` + one is `.tap`: prefer the `.tzx`.
- Any other count > 1 (two of the same type, or 3+): `showStatus('ZIP must contain at most one TAP or TZX file.')` and return.

**Format detection fix in `_triggerFileImport`:**
After a ZIP is imported via the file picker, the format stored in the DB must be derived from the chosen entry's extension (`.tzx` → `'tzx'`, else `'tap'`), not hardcoded to `'tap'`.

---

## Bug 2 — iOS File Import Accept Fix

**Locations:** `menu-controller.ts` → `_triggerFileImport`, `src/index.html` → `#file-input`

**Change:**
- `_triggerFileImport`: set `input.accept = ''` (no filter — iOS respects no-filter correctly)
- `index.html`: change `accept=".tap,.tzx,.z80,.zip,.rom,.bin"` to `accept="*/*"`

**Validation after import:**
- `file-handler.ts` `handleFile`: the existing `else` branch (`'Unknown file type'`) is improved to: `'Unsupported file type. Please use a TAP, TZX, ZIP, Z80, or ROM file.'`
- `menu-controller.ts` `_triggerFileImport`: if the file doesn't match `.tap`, `.tzx`, `.zip`, `.z80`, `.rom`, `.bin` by extension, and magic bytes don't match ZIP (`PK\x03\x04`) or TZX (`ZXTape!`), show: `'Unsupported file. Expected TAP, TZX, ZIP, Z80, or ROM.'`

---

## Bug 3 — Export Downloads Raw File

**Location:** `menu-controller.ts` → `EXPORT_CURRENT_TAPE`, `EXPORT_SAVE`

No change needed. Existing `_triggerDownload` already downloads:
- Tapes as `name.tap` or `name.tzx` (using `tape.format`)
- Saves as `saveName.z80`

Raw download is correct — ZIP compression gives no benefit for binary tape data.

---

## Bug 4 — URL Import Error Messages

**Location:** `menu-controller.ts` → `_importUrl`

**Changes:**
- On `!res.ok`: throw with `HTTP ${res.status} ${res.statusText}` included in message.
- In the `catch` block: show a two-part status message:
  `'Import failed: <reason>. URL imports rely on a CORS proxy (allorigins.win) — some URLs may not be supported.'`

---

## Files Touched

| File | Change |
|------|--------|
| `src/media/tape.ts` | ZIP selection logic: prefer TZX, error on ambiguous multiple files |
| `src/ui/menu-controller.ts` | Fix format detection in `_triggerFileImport`; remove accept filter; improve URL error messages |
| `src/index.html` | Change `accept` to `*/*` on `#file-input` |
| `src/ui/file-handler.ts` | Improve unknown file type error message |
