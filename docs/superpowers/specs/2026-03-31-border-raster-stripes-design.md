# Border Raster Stripes Design

**Date:** 2026-03-31
**Status:** Approved

## Problem

During TZX pulse playback the Z80 CPU executes real `OUT (0xFE)` instructions that change the border colour many times per frame, producing the iconic loading stripes. Currently `updateBorderColor()` reads a single `borderColor` byte once per rendered frame, so all mid-frame changes are lost and the border shows only the final colour.

## Goal

Capture border colour changes at ~64-sample resolution per frame and render them as authentic horizontal raster stripes on the 3D border plane.

---

## Section 1: WASM changes (`assembly/index.ts`)

### New memory region

A 64-byte border log buffer at `BORDER_LOG_BASE = 0x1C0400` (1 KB after the audio buffer at `0x1C0000`). Each byte holds a border colour value (0–7) for one time slot.

### Sampling

```
BORDER_LOG_DIVISOR = 69888 / 64 = 1092  (T-cycles per slot)
```

- At the top of `frame()`: reset `borderLogIndex = 0`, `borderLogAccum = 0`.
- Inside the CPU loop, after accumulating instruction T-cycles: add cost to `borderLogAccum`. When `borderLogAccum >= BORDER_LOG_DIVISOR`, store `borderColor` into `BORDER_LOG_BASE + borderLogIndex`, increment `borderLogIndex` (capped at 63), subtract `BORDER_LOG_DIVISOR` from `borderLogAccum`.
- Mirrors the existing audio sampling pattern exactly.

### New export

```typescript
export function getBorderLogAddr(): u32 { return BORDER_LOG_BASE; }
```

Added to `WasmExports` interface in `src/emulator/wasm-types.ts`.

---

## Section 2: JS / PlayCanvas changes (`src/entities/monitor.ts`)

### Border texture

Replace the solid `StandardMaterial` colour with a 1×64 `pc.Texture`:
- Format: `PIXELFORMAT_RGBA8`
- Filtering: nearest-neighbour (`FILTER_NEAREST`)
- Address mode: `ADDRESS_CLAMP_TO_EDGE`
- Size: 1 pixel wide × 64 pixels tall

Each pixel maps to one time slot (one horizontal band on the border plane).

### Per-frame update

Replace `updateBorderColor()` with `updateBorderTexture()`:

1. Lazy-init a `Uint8Array` view into `BORDER_LOG_BASE` (same pattern as `screenSrc`).
2. Read the 64-byte log.
3. For each byte, look up RGBA from a pre-built `BORDER_PALETTE: Uint8Array` (64 entries × 4 bytes, indexed by colour 0–7).
4. Write into a reusable `borderPixels: Uint8Array[256]` buffer.
5. Upload to the texture.

### Material setup

```typescript
borderMat.diffuseMap = borderTexture;
borderMat.emissiveMap = borderTexture;
borderMat.emissive = new pc.Color(1, 1, 1);
borderMat.useLighting = false;
```

Identical to the screen quad material pattern.

### `MonitorResult` interface change

- Add: `borderTexture: pc.Texture`
- Remove: `borderMaterial: pc.StandardMaterial` (becomes internal to `monitor.ts`)

### `main.ts` call site change

```typescript
// Before
updateBorderColor(entities.borderMaterial, wasm);

// After
updateBorderTexture(entities.borderTexture, memory, wasm);
```

---

## Section 3: Edge cases

| Scenario | Behaviour |
|---|---|
| Tape not playing | Log contains 64 copies of the same colour → solid band, visually identical to current |
| Turbo mode (50× frames) | Each frame overwrites the log; only last frame rendered — acceptable, turbo is not visually accurate |
| TZX 20× fast-load | Same — last frame's log rendered per display frame; stripes still authentic per frame |
| Snapshot restore | `setBorderColor_ext` sets `borderColor`; log populated correctly on next `frame()` call |

### Removed optimisation

The `lastBorderColor` early-exit guard is removed. The texture is always uploaded each frame. Cost: 256 bytes written per frame — negligible.

---

## Files changed

| File | Change |
|---|---|
| `assembly/index.ts` | Add `BORDER_LOG_BASE`, `BORDER_LOG_DIVISOR`, sampling in CPU loop, `getBorderLogAddr()` export |
| `src/emulator/wasm-types.ts` | Add `getBorderLogAddr(): number` |
| `src/entities/monitor.ts` | Replace solid border material with 1×64 texture; replace `updateBorderColor` with `updateBorderTexture` |
| `src/main.ts` | Update call site and destructured field name |
