# Design: Remove Bezel, Pixel-Accurate Border

**Date:** 2026-03-31
**Branch:** ver2

## Goal

Remove the ornate brass steampunk bezel from the monitor entity and reduce the ZX Spectrum border area to the pixel-accurate real-hardware ratio, maximizing screen size across all scenes.

## Changes

### `src/entities/monitor.ts`

**1. Change `BORDER_FRACTION` from `0.30` to `0.125`**

The real ZX Spectrum has a 32px border on each side around the 256×192 display:
- Horizontal: 32/256 = 0.125
- Vertical: 24/192 = 0.125

Both axes are identical, so a single scalar fraction remains correct.

**2. Delete all bezel geometry** (~70 lines):
- `backPlate` entity (solid brass back)
- `topBezel`, `bottomBezel`, `leftBezel`, `rightBezel` entities
- Corner rivets loop (4 spheres)
- Steam pipes loop (2 cylinders)
- `createBrassMaterial` import (no longer used)
- `const brassMat = createBrassMaterial(device)` usage
- `const BEZEL = 0.12` constant (no longer used)

**What stays:**
- `borderPlane` — renders the ZX Spectrum border color (dynamic, driven by WASM)
- `screenQuad` — renders the 256×192 main display texture

## What Does NOT Change

- `SCREEN_W`, `SCREEN_H` — world-space display dimensions unchanged
- Texture update and border color logic — untouched
- All other entities (keyboard, joystick, fire button, menu button)
- `src/materials/brass.ts` — still used by other entities (menu-button, joystick3d, fire-button)

## Result

The monitor entity becomes two flat quads — border color plane + screen — with no 3D decorations. The screen fills significantly more of its allocated layout space in every scene (portrait, landscape, menu).

## Implementation Notes

- `BORDER_FRACTION` comment clarified to "per-side border fraction: 32px / 256px = 0.125" to avoid ambiguity about whether the fraction is total or per-side
- File-level comment updated from "3D CRT monitor with brass steampunk frame…" to "3D monitor with dynamic WASM screen texture"
- Commits: `99ebb53`, `62c7f80`, `aa1511e`

## Post-Implementation Fixes

### `src/scene/scene-layouts.ts`

**`MONITOR_UNIT_W/H` updated** (`a77edaf`) — old values (`3.08 × 2.2`) were sized for the bezel; updated to actual border quad dimensions: `BORDER_W × BORDER_H = 2.25 × 1.6875`.

**Landscape panel widths split by aspect ratio** (`ae2de13`) — changed from equal 50/50 split to proportional split based on each entity's AR (`monAR / (monAR + kbAR)`) so both monitor and keyboard fill their panels without wasted space.

**Top-align monitor and keyboard in landscape** (`fff3aa7`) — entities are now aligned to the top of the content area (`top - entityH/2`) rather than vertically centred, so the monitor fills its panel and background gap appears only below both entities above the controls row.
