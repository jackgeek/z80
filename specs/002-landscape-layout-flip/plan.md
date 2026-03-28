# Implementation Plan: Landscape Layout — Screen Left, Keyboard Right

**Branch**: `002-landscape-layout-flip` | **Date**: 2026-03-28 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/002-landscape-layout-flip/spec.md`

## Summary

Replace the current landscape layout (monitor centred, keyboard hidden off-screen) with a side-by-side layout: emulator screen on the left half, ZX Spectrum keyboard on the right half, both fully visible and interactive. The menu button moves from the top-right corner to the bottom-centre, between the joystick and fire button, matching portrait mode. The change is contained entirely in `src/scene/scene-layouts.ts`.

## Technical Context

**Language/Version**: TypeScript (strict) — ES2020 modules
**Primary Dependencies**: PlayCanvas (3D scene positioning via `EntityLayout`)
**Storage**: N/A
**Testing**: Manual — run `bun run dev`, verify in browser at a landscape viewport
**Target Platform**: Browser (desktop + mobile), static deployment via GitHub Pages
**Project Type**: Browser-based emulator (vanilla TypeScript + PlayCanvas 3D front-end)
**Performance Goals**: Layout computation runs once per orientation change — no frame-budget impact
**Constraints**: Must not modify portrait layouts; keyboard was previously hidden in landscape
**Scale/Scope**: Single file, two switch cases

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Principle | Status | Notes |
|------|-----------|--------|-------|
| 1 | WASM Boundary — no emulation logic in TS | ✅ Pass | No WASM changes; purely a scene layout change |
| 2 | Shared Memory — no new ad-hoc WASM calls | ✅ Pass | No new WASM interactions |
| 3 | No Frameworks — vanilla TS + PlayCanvas only | ✅ Pass | Change stays in `src/scene/` (PlayCanvas scope) |
| 4 | Domain Module Isolation — no cross-domain state | ✅ Pass | Only `scene-layouts.ts` touched; no state.ts changes |
| 5 | AssemblyScript idioms on hot paths | ✅ N/A | No AssemblyScript changes |
| 6 | Static-only deployment | ✅ Pass | No build system changes |
| 7 | Hardware accuracy | ✅ N/A | No emulation logic touched |
| 8 | File format compatibility | ✅ N/A | No file format handling touched |

**Post-design re-check**: All gates remain clear — implementation touches only layout coordinate calculations.

## Project Structure

### Documentation (this feature)

```text
specs/002-landscape-layout-flip/
├── plan.md          ← this file
├── research.md      ← Phase 0 (layout maths decisions)
├── quickstart.md    ← Phase 1 (verification guide)
└── tasks.md         ← Phase 2 output (/speckit.tasks — NOT created here)
```

### Source Code (affected files only)

```text
src/scene/
└── scene-layouts.ts   ← only file that changes (landscape + menuLandscape cases)
```

## Implementation Steps

### Step 1 — Rewrite the `landscape` case in `computeLayout()`

File: `src/scene/scene-layouts.ts`, `case 'landscape':` block (currently lines 116–127).

Replace the current implementation with the following logic:

```
usableW      = right - left
gap          = usableW * 0.03
halfW        = (usableW - gap) / 2

leftCenterX  = left + halfW / 2         // monitor X position
rightCenterX = right - halfW / 2        // keyboard X position

monScale     = min(1.4, halfW / MONITOR_UNIT_W)
ms           = [monScale, monScale, monScale]

kbScale      = halfW / KB_UNIT_W
ks           = [kbScale, kbScale, kbScale]

ctrlY        = bottom + ctrlRowH * 0.5
centerY      = (top + ctrlY + ctrlRowH * 0.5) / 2

return {
  monitor:    position [leftCenterX,  centerY, 0],  rotation [0,0,0],  scale ms, visible true
  keyboard:   position [rightCenterX, centerY, 0],  rotation FLAT,     scale ks, visible true
  joystick:   position [left,   ctrlY, 0],           rotation FLAT, scale cs, visible true
  fireButton: position [right,  ctrlY, 0.4],         rotation FLAT, scale cs, visible true
  menuButton: position [0,      ctrlY, 0.4],         rotation FLAT, scale cs, visible true  // ← moved from top-right to bottom-centre
  menuCodex:  position [0, 0, -8],                   rotation [0,0,0], scale [1,1,1], visible false
  camera:     position [0, 0, camZ],                 rotation [0,0,0], scale [1,1,1]
}
```

### Step 2 — Update the `menuLandscape` case in `computeLayout()`

File: `src/scene/scene-layouts.ts`, `case 'menuLandscape':` block (currently lines 143–156).

Apply the same side-by-side logic with the existing 0.65 shrink factor and `pushZ = -4`:

```
usableW      = right - left
gap          = usableW * 0.03
halfW        = (usableW - gap) / 2

leftCenterX  = left + halfW / 2
rightCenterX = right - halfW / 2

monScale     = min(1.4, halfW / MONITOR_UNIT_W) * 0.65
kbScale      = (halfW / KB_UNIT_W) * 0.65

ctrlY        = bottom + ctrlRowH * 0.5
centerY      = (top + ctrlY + ctrlRowH * 0.5) / 2

pushZ = -4

return {
  monitor:    position [leftCenterX,  centerY, pushZ],  rotation FLAT,    scale [monScale,monScale,monScale], visible true
  keyboard:   position [rightCenterX, centerY, pushZ],  rotation FLAT,    scale [kbScale,kbScale,kbScale],   visible true
  joystick:   position [left*0.6,  ctrlY, pushZ],       rotation FLAT, scale [cs*0.6...], visible true
  fireButton: position [right*0.6, ctrlY, pushZ],       rotation FLAT, scale [cs*0.6...], visible true
  menuButton: position [0,         ctrlY, pushZ],       rotation FLAT, scale [cs*0.6...], visible true
  menuCodex:  position [0, 0, 0],                       rotation [0,0,0], scale [1.2,1.2,1.2], visible true
  camera:     position [0, 0, 6],                       rotation [0,0,0], scale [1,1,1]
}
```

### Step 3 — Verify

Run `bun run dev` and verify all acceptance scenarios from the spec in a landscape viewport. Check portrait layouts are unchanged.

## Complexity Tracking

No constitution violations. No complexity tracking required.
