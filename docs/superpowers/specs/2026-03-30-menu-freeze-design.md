# Design: Freeze Emulator on Menu Open

**Date:** 2026-03-30

## Summary

When the menu opens, the emulator CPU should pause so no frames are emulated while the user navigates the menu. On menu close, emulation resumes. A snapshot is saved to `currentImage` on open so the machine state is recoverable if the browser is closed while the menu is open.

## Behaviour

**On `MenuController.open()`** (before building menu items):
1. Call `setPaused(true)` — the frame loop already skips `wasm.frame()` when paused, so the emulator freezes immediately.
2. Call `captureZ80()` to capture full machine state.
3. If the result is non-empty (`byteLength > 0`), call `db.saveCurrentImage(data)` — fire-and-forget (no `await` blocking the UI).

**On `MenuController.close()`** (after hiding the panel):
1. Call `setPaused(false)` — emulation resumes.

## Scope

Only two touch points in `menu-controller.ts`:

- Top of `open()` — add pause + snapshot save
- Bottom of `close()` — add unpause

No changes required to `frame-loop.ts`, `input-bridge.ts`, or `state.ts`.

## Edge Cases

- **ROM not loaded:** `captureZ80()` returns a zero-length `ArrayBuffer`. Skip `saveCurrentImage` in that case — consistent with existing guard in `_autoSaveQuickStart`.
- **No tape loaded:** Save snapshot anyway — the `currentImage` slot is not tape-specific, it represents the full machine state regardless.
- **Re-entrant open:** Not possible — the menu button hit-test is skipped while `menuOpen` is true in `input-bridge.ts`.

## Files Changed

| File | Change |
|------|--------|
| `src/ui/menu-controller.ts` | Add `setPaused(true)` + snapshot save in `open()`; add `setPaused(false)` in `close()` |
