# Design: Joystick Directional Input + Fire Button Position Fix

**Date:** 2026-03-30

## Summary

Two related fixes:
1. Move the fire button and joystick inward from the viewport edge to a thumb-reachable position.
2. Implement directional input for the 3D virtual joystick — currently it only sets an `active` flag but never sends any direction to the emulator.

---

## Part 1 — Control Positioning (`scene-layouts.ts`)

Both the joystick and fire button are currently placed at the far edges of the viewport (`[left, ctrlY, ...]` and `[right, ctrlY, ...]`), which puts them partially off-screen or at the very edge — unreachable by thumb.

**Fix:** Move both inward to 70% of the edge distance:
- Joystick: `left * 0.7` (bottom-left, thumb reach)
- Fire button: `right * 0.7` (bottom-right, thumb reach)

Apply across all 5 scenes: `portrait1`, `portrait2`, `landscape`, `menuPortrait`, `menuLandscape`.

The menu scenes use `left * shrink` / `right * shrink` patterns — apply the 0.7 factor on top of those (i.e. `left * shrink * 0.7`).

---

## Part 2 — Joystick Directional Input (`input-bridge.ts`)

### Current state

`joystickActive` is set to `true` on pointer-down over the joystick entity, and `false` on pointer-up. No direction is ever computed or sent to WASM.

### New behaviour

**On pointer-down** over the joystick: record the touch origin (`joystickDownX`, `joystickDownY`), set `joystickActive = true`.

**On pointer-move** while `joystickActive`:
- Compute `(dx, dy)` from origin
- Dead zone: if distance < 20px, treat as neutral (release current direction)
- Otherwise resolve to the dominant axis direction: `left`, `right`, `up`, or `down` (4-directional, no diagonals)
- If direction changed from previous: release old direction keys, press new direction keys
- Track current held direction in `currentJoyDir: 'left' | 'right' | 'up' | 'down' | null`

**On pointer-up / touch-cancel**: release current direction keys, reset `joystickActive`, `currentJoyDir = null`.

### Key mappings by joystick type

The type is read from `getJoystickType()` (already exported from `input-bridge.ts`).

| Direction | Sinclair1 | Cursor | Kempston |
|-----------|-----------|--------|----------|
| Left  | `keyDown(4, 0x10)` (key 6) | `keyDown(0, 0x01)` + `keyDown(3, 0x10)` (Caps+5) | `setKempston` bit 1 |
| Right | `keyDown(4, 0x08)` (key 7) | `keyDown(0, 0x01)` + `keyDown(4, 0x04)` (Caps+8) | `setKempston` bit 0 |
| Down  | `keyDown(4, 0x04)` (key 8) | `keyDown(0, 0x01)` + `keyDown(4, 0x10)` (Caps+6) | `setKempston` bit 2 |
| Up    | `keyDown(4, 0x02)` (key 9) | `keyDown(0, 0x01)` + `keyDown(4, 0x08)` (Caps+7) | `setKempston` bit 3 |

Fire is handled separately by the existing fire button entity — the virtual joystick only handles directions.

For Kempston, `setKempston(byte)` writes the full port byte. Track a `kempstonByte` that is updated as directions change, then call `wasm.setKempston(kempstonByte)`. On release, call `wasm.setKempston(0)`.

### Release logic

`releaseJoyDir()` — releases whatever `currentJoyDir` is holding:
- Sinclair1/Cursor: call the appropriate `keyUp` (and `keyUp(0, 0x01)` for Caps on Cursor)
- Kempston: clear direction bits and call `wasm.setKempston(0)`

### Integration with existing pointer flow

The existing `pointerMove` already handles `heldSpectrumKey` drag-cancel and gesture detection. Add joystick direction handling at the top of `pointerMove` when `joystickActive` is true — before the gesture detector logic, since joystick and swipe gesture are mutually exclusive.

---

## Files Changed

| File | Change |
|------|--------|
| `src/scene/scene-layouts.ts` | Move joystick to `left * 0.7`, fire button to `right * 0.7` across all 5 scenes |
| `src/input/input-bridge.ts` | Add `joystickDownX/Y`, `currentJoyDir`, `kempstonByte` state; implement direction logic in `pointerMove`; release in `pointerUp`/`touchCancel` |

---

## Edge Cases

- **Menu open:** Joystick input is already blocked — `pointerMove` with `menuOpen` exits early before joystick logic runs.
- **Touch cancel:** Existing `touchcancel` handler calls `releaseAllKeys()` — add `releaseJoyDir()` there too (Kempston needs `setKempston(0)`, not just key releases).
- **Joystick type change mid-drag:** Safe — direction is released and re-pressed on every direction change, reading the current type each time.
