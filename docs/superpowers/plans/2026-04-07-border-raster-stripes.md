# Border Raster Stripes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Capture border colour changes at 64-sample resolution per frame in WASM and render them as authentic horizontal raster stripes on the 3D border plane.

**Architecture:** A 64-byte ring buffer in WASM linear memory records `borderColor` once per ~1092 T-cycles during the CPU loop. After each frame, JS reads those 64 bytes, paints them as horizontal bands into a 1×64 canvas, and uploads it as a texture to the PlayCanvas border plane material — replacing the current single-colour solid plane.

**Tech Stack:** AssemblyScript (WASM core), TypeScript, PlayCanvas

---

## Task 1: Add border log buffer and sampling to WASM

**Files:**
- Modify: `assembly/index.ts`

- [ ] **Step 1: Add the buffer constant and state variables**

In `assembly/index.ts`, after the existing audio constants (around line 149), add:

```typescript
// Border colour log: 64 samples per frame, one per ~1092 T-cycles
const BORDER_LOG_BASE: u32     = 0x1C0400; // 1KB after audio buffer
const BORDER_LOG_SAMPLES: i32  = 64;
const BORDER_LOG_DIVISOR: i32  = 1092;     // 69888 / 64
let borderLogIndex: i32 = 0;
let borderLogAccum: i32 = 0;
```

- [ ] **Step 2: Reset the log at the top of `frame()`**

In the `frame()` function (around line 1721), after `audioCycleAccum = 0;`, add:

```typescript
  borderLogIndex = 0;
  borderLogAccum = 0;
```

- [ ] **Step 3: Sample border colour in the CPU loop**

In `frame()`, inside the `while (cycles < CYCLES_PER_FRAME)` loop, after the existing `audioCycleAccum += c;` block (around line 1751), add:

```typescript
    // Record border colour at ~64 evenly-spaced points per frame
    borderLogAccum += c;
    while (borderLogAccum >= BORDER_LOG_DIVISOR && borderLogIndex < BORDER_LOG_SAMPLES) {
      borderLogAccum -= BORDER_LOG_DIVISOR;
      store<u8>(BORDER_LOG_BASE + <u32>borderLogIndex, borderColor);
      borderLogIndex++;
    }
```

- [ ] **Step 4: Add the export function**

After the existing `getBorderColor()` export (around line 1813), add:

```typescript
export function getBorderLogAddr(): u32 {
  return BORDER_LOG_BASE;
}
```

- [ ] **Step 5: Build and verify no errors**

```bash
bun run build
```

Expected: build succeeds, `dist/` updated. No AssemblyScript type errors.

- [ ] **Step 6: Commit**

```bash
git add assembly/index.ts
git commit -m "feat: add 64-sample border colour log to WASM frame loop"
```

---

## Task 2: Expose the new export in the TypeScript interface

**Files:**
- Modify: `src/emulator/wasm-types.ts`

- [ ] **Step 1: Add `getBorderLogAddr` to `WasmExports`**

In `src/emulator/wasm-types.ts`, in the `// Border` section (around line 31), add the new export:

```typescript
  // Border
  getBorderColor(): number;
  getBorderLogAddr(): number;
  setBorderColor_ext(color: number): void;
```

- [ ] **Step 2: Build and verify no type errors**

```bash
bun run build
```

Expected: succeeds. TypeScript now knows about `getBorderLogAddr()`.

- [ ] **Step 3: Commit**

```bash
git add src/emulator/wasm-types.ts
git commit -m "feat: expose getBorderLogAddr in WasmExports interface"
```

---

## Task 3: Replace solid border material with a 1×64 stripe texture

**Files:**
- Modify: `src/entities/monitor.ts`

- [ ] **Step 1: Add the border canvas and palette constants**

At the top of `src/entities/monitor.ts`, after the existing canvas setup (after line 53), add:

```typescript
// Border stripe texture: 1px wide × 64px tall canvas, one row per time slot
const borderCanvas = document.createElement('canvas');
borderCanvas.width = 1;
borderCanvas.height = 64;
const borderCtx = borderCanvas.getContext('2d')!;

// Pre-built RGBA palette for the 8 ZX Spectrum border colours (matches BORDER_COLORS)
// Layout: 8 entries × 4 bytes [R, G, B, A]
const BORDER_PALETTE_RGBA = new Uint8Array([
  0,   0,   0,   255, // 0 black
  0,   0,   204, 255, // 1 blue
  204, 0,   0,   255, // 2 red
  204, 0,   204, 255, // 3 magenta
  0,   204, 0,   255, // 4 green
  0,   204, 204, 255, // 5 cyan
  204, 204, 0,   255, // 6 yellow
  204, 204, 204, 255, // 7 white
]);
```

Note: these RGB values match the existing `BORDER_COLORS` pc.Color entries (0.80 × 255 ≈ 204).

- [ ] **Step 2: Add the `borderPixels` reusable buffer**

After the palette constant, add:

```typescript
// Reusable 1×64 RGBA pixel buffer for border stripe texture upload
const borderPixels = new ImageData(1, 64);
```

- [ ] **Step 3: Create the border texture in `createMonitor`**

In `createMonitor()`, replace the existing border material block (lines 84–98):

```typescript
  // ── Border stripe texture (1×64, one row per ~1092 T-cycle slot) ────────
  const borderTexture = new pc.Texture(device, {
    width: 1,
    height: 64,
    format: pc.PIXELFORMAT_RGBA8,
    minFilter: pc.FILTER_NEAREST,
    magFilter: pc.FILTER_NEAREST,
    addressU: pc.ADDRESS_CLAMP_TO_EDGE,
    addressV: pc.ADDRESS_CLAMP_TO_EDGE,
    mipmaps: false,
  });
  // Initialise to solid white (border colour 7)
  const initPixels = new ImageData(1, 64);
  for (let i = 0; i < 64; i++) {
    initPixels.data[i * 4 + 0] = 204;
    initPixels.data[i * 4 + 1] = 204;
    initPixels.data[i * 4 + 2] = 204;
    initPixels.data[i * 4 + 3] = 255;
  }
  borderCtx.putImageData(initPixels, 0, 0);
  borderTexture.setSource(borderCanvas);

  const borderMat = new pc.StandardMaterial();
  borderMat.diffuseMap = borderTexture;
  borderMat.emissiveMap = borderTexture;
  borderMat.emissive = new pc.Color(1, 1, 1);
  borderMat.useLighting = false;
  borderMat.update();

  const borderPlane = new pc.Entity('BorderPlane');
  borderPlane.addComponent('render', { type: 'plane' });
  borderPlane.setLocalScale(BORDER_W, 1, BORDER_H);
  borderPlane.setLocalEulerAngles(90, 0, 0);
  borderPlane.setLocalPosition(0, 0, 0.065);
  borderPlane.render!.meshInstances[0].material = borderMat;
  monitor.addChild(borderPlane);
  borderPlane.tags.add('screen');
```

- [ ] **Step 4: Update `MonitorResult` to expose `borderTexture`**

Replace the `MonitorResult` interface (lines 29–34):

```typescript
export interface MonitorResult {
  monitorEntity: pc.Entity;
  screenQuad: pc.Entity;
  screenTexture: pc.Texture;
  borderTexture: pc.Texture;
}
```

- [ ] **Step 5: Update the return statement in `createMonitor`**

Replace line 110:

```typescript
  return { monitorEntity: monitor, screenQuad, screenTexture, borderTexture };
```

- [ ] **Step 6: Replace `updateBorderColor` with `updateBorderTexture`**

Delete the existing `lastBorderColor` variable and `updateBorderColor` function (lines 113–126), and add:

```typescript
let borderLogSrc: Uint8Array | null = null;

export function updateBorderTexture(
  borderTexture: pc.Texture,
  memory: WebAssembly.Memory,
  wasm: WasmExports
): void {
  if (!borderLogSrc || borderLogSrc.buffer !== memory.buffer) {
    borderLogSrc = new Uint8Array(memory.buffer, wasm.getBorderLogAddr(), 64);
  }
  for (let i = 0; i < 64; i++) {
    const c = (borderLogSrc[i] & 7) * 4;
    borderPixels.data[i * 4 + 0] = BORDER_PALETTE_RGBA[c + 0];
    borderPixels.data[i * 4 + 1] = BORDER_PALETTE_RGBA[c + 1];
    borderPixels.data[i * 4 + 2] = BORDER_PALETTE_RGBA[c + 2];
    borderPixels.data[i * 4 + 3] = 255;
  }
  borderCtx.putImageData(borderPixels, 0, 0);
  borderTexture.setSource(borderCanvas);
}
```

- [ ] **Step 7: Build and verify no type errors**

```bash
bun run build
```

Expected: succeeds. TypeScript should report no errors about `borderMaterial` or `updateBorderColor` — those are gone from the public surface.

- [ ] **Step 8: Commit**

```bash
git add src/entities/monitor.ts
git commit -m "feat: replace solid border plane with 64-sample raster stripe texture"
```

---

## Task 4: Update the call site in `main.ts`

**Files:**
- Modify: `src/main.ts`

- [ ] **Step 1: Update the import**

In `src/main.ts` line 8, update the import:

```typescript
import { updateMonitorTexture, updateBorderTexture } from './entities/monitor.js';
```

- [ ] **Step 2: Update the frame callback**

Find the frame callback (around line 52–56):

```typescript
// Before
updateBorderColor(entities.borderMaterial, wasm);

// After
updateBorderTexture(entities.borderTexture, memory, wasm);
```

- [ ] **Step 3: Build and verify**

```bash
bun run build
```

Expected: clean build, no TypeScript errors.

- [ ] **Step 4: Smoke test**

```bash
bun run dev
```

Open the emulator, load a TZX file. Confirm:
- Border shows authentic alternating coloured stripes while loading
- After loading completes, border returns to a solid colour
- No regression: non-loading operation (e.g. BASIC prompt) shows a solid white border

- [ ] **Step 5: Commit**

```bash
git add src/main.ts
git commit -m "feat: wire updateBorderTexture into frame loop"
```
