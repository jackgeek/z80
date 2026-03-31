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

**2. Delete all bezel geometry** (~55 lines):
- `backPlate` entity (solid brass back)
- `topBezel`, `bottomBezel`, `leftBezel`, `rightBezel` entities
- Corner rivets loop (4 spheres)
- Steam pipes loop (2 cylinders)
- `createBrassMaterial` import (no longer used)

**What stays:**
- `borderPlane` — renders the ZX Spectrum border color (dynamic, driven by WASM)
- `screenQuad` — renders the 256×192 main display texture

## What Does NOT Change

- `SCREEN_W`, `SCREEN_H` — world-space display dimensions unchanged
- `scene-layouts.ts` — `MONITOR_UNIT_W/H` layout constants remain valid
- Texture update and border color logic — untouched
- All other entities (keyboard, joystick, fire button, menu button)

## Result

The monitor entity becomes two flat quads — border color plane + screen — with no 3D decorations. The screen fills significantly more of its allocated layout space in every scene (portrait, landscape, menu).
