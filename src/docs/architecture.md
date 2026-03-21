# Frontend Architecture

## Module Structure

All browser code is written in TypeScript using ES modules (`import`/`export`). The entry point `src/main.ts` imports and initializes each subsystem. Shared mutable state lives in `emulator/state.ts` (no globals on `window`).

```
main.ts
  ├── emulator/wasm-loader.ts  ← WASM instantiation, ROM load, starts frame loop
  │     └── emulator/state.ts  ← shared state (wasm instance, keyState, flags)
  ├── emulator/frame-loop.ts   ← requestAnimationFrame loop, turbo mode
  │     └── emulator/state.ts
  ├── video/screen.ts          ← canvas rendering (WASM screen buffer → ImageData)
  │     └── emulator/state.ts
  ├── input/keyboard.ts        ← physical keyboard → Spectrum matrix
  │     └── emulator/state.ts
  ├── input/vkeyboard.ts       ← virtual keyboard UI
  │     └── emulator/state.ts
  ├── input/joystick.ts        ← fullscreen + touch joystick
  │     └── emulator/state.ts
  ├── video/cube.ts            ← Three.js 3D cube (imports three from npm)
  │     └── emulator/state.ts
  ├── audio/audio.ts           ← AudioWorklet setup, WASM audio buffer read
  │     └── emulator/state.ts
  ├── media/tape.ts            ← TAP/TZX/ZIP parsing
  │     └── emulator/state.ts
  ├── media/snapshot.ts        ← .z80 save/restore
  │     └── emulator/state.ts
  ├── debug/debug-view.ts      ← memory heatmap visualization
  │     └── emulator/state.ts
  └── ui/ui.ts                 ← button handlers, drag-drop, file picker
        └── emulator/state.ts
```

## WASM Integration

```javascript
const memory = new WebAssembly.Memory({ initial: 256, maximum: 256 });
const { instance } = await WebAssembly.instantiate(wasmBytes, { env: { memory, abort: () => {} } });
```

TypeScript and WASM share the same memory buffer. The TS side reads/writes at known offsets:

| Offset | JS reads/writes | Purpose |
|--------|----------------|---------|
| `0x100000` | Write (ROM load) | Z80 address space — TS loads ROM here at startup |
| `0x110000` | Read | Screen buffer — WASM renders 256x192 RGBA pixels |
| `0x140000` | Write | TAP buffer — TS writes parsed tape data |
| `0x1C0000` | Read | Audio buffer — WASM writes 882 i16 beeper samples/frame |

## Audio Pipeline

```
WASM beeper samples (882 i16/frame at 44.1 kHz)
        │
        ▼
  audio/audio.ts reads from WASM memory as Int16Array
        │
        ▼
  High-pass filter: y[n] = α·(y[n-1] + x[n] - x[n-1])
  α = 0.995 (~35 Hz cutoff, removes DC offset)
        │
        ▼
  AudioWorklet (public/audio-worklet.js, served as non-module)
  Processes samples off the main thread
        │
        ▼
  Web Audio API → speakers
```

Audio context is created on first user interaction (required by browser autoplay policies). On iOS, the context may auto-suspend and needs resuming on touch.

The audio worklet processor lives in `public/audio-worklet.js` because AudioWorklet scripts must be loaded by URL (not as ES module imports).

## Screen Rendering

Each frame, `video/screen.ts` copies the WASM screen buffer to a canvas:

```javascript
const src = new Uint8Array(memory.buffer, SCREEN_BASE, 256 * 192 * 4);
imageData.data.set(src);
ctx.putImageData(imageData, 0, 0);
```

The canvas is CSS-scaled to fill the available space. No WebGL is used for the main display (only for the optional 3D cube via Three.js).

## Frame Loop

`emulator/frame-loop.ts` runs the main emulation loop:

```javascript
function frameLoop(timestamp) {
    requestAnimationFrame(frameLoop);
    if (timestamp - lastFrameTime < FRAME_INTERVAL * 0.9) return;  // throttle to ~50 FPS
    lastFrameTime = timestamp;

    // Push keyboard state to WASM
    for (let row = 0; row < 8; row++) wasm.setKeyRow(row, keyState[row]);

    wasm.frame();        // Execute one Z80 frame (69,888 T-cycles)
    renderFrame();       // Blit screen buffer to canvas
    pushAudioFrame();    // Queue audio samples
}
```

## Keyboard Mapping

The ZX Spectrum uses an 8-row x 5-column keyboard matrix. `input/keyboard.ts` maps modern keyboard events to this matrix:

| Row | Bit 0 | Bit 1 | Bit 2 | Bit 3 | Bit 4 |
|-----|-------|-------|-------|-------|-------|
| 0 | Caps Shift | Z | X | C | V |
| 1 | A | S | D | F | G |
| 2 | Q | W | E | R | T |
| 3 | 1 | 2 | 3 | 4 | 5 |
| 4 | 0 | 9 | 8 | 7 | 6 |
| 5 | P | O | I | U | Y |
| 6 | Enter | L | K | J | H |
| 7 | Space | Sym Shift | M | N | B |

Special mappings: Shift -> Caps Shift (row 0), Ctrl -> Symbol Shift (row 7), Arrow keys -> Caps Shift + 5/6/7/8.

## File Loading

File loading is handled by `media/tape.ts` and `media/snapshot.ts`.

### TAP Format
Simple sequential blocks: `[2-byte length][data...]` repeated. Written directly to the WASM tape buffer at offset 0x140000.

### TZX Format
Complex multi-block format. The loader extracts standard data blocks (types 0x10, 0x11, 0x14) and reassembles them into TAP format before writing to WASM memory. Other block types (pauses, text descriptions, etc.) are skipped.

### ZIP Format
Uses the browser's `DecompressionStream` API for deflate. Parses the ZIP local file headers to find the first `.tap` or `.tzx` file, decompresses it, then processes it as above.

### .z80 Snapshot Format

The `.z80` format is the industry-standard ZX Spectrum snapshot format. Handled by `media/snapshot.ts`. Saves/restores complete machine state (48 KB RAM + all CPU registers + interrupt state + border colour).

**Saving (v3 format):**
- 30-byte header (registers: A, F, BC, DE, HL, SP, I, R, IX, IY, shadow registers, IFF1/2, IM, border)
- 56-byte extended header (actual PC, hardware mode = 48K)
- 3 compressed pages (16 KB each): page 8 (0x4000), page 4 (0x8000), page 5 (0xC000)
- ED ED RLE compression: `ED ED count byte` for repeated bytes

**Loading (v1, v2, v3):**
- v1: PC in header bytes 6-7 is nonzero, compressed RAM follows header
- v2/v3: PC=0 in header, extended header contains real PC, paged data blocks follow
- Auto-detected by header fields; restores via WASM setter functions + `writeRAM()`

**Functions:** `saveZ80()`, `loadZ80()`, `compressZ80Page()`, `decompressZ80()`

## Fullscreen & Joystick

Fullscreen mode (`input/joystick.ts`):
- Uses `element.requestFullscreen()` / vendor prefixes
- Hides the virtual keyboard, shows the touch joystick overlay
- Canvas is letterboxed to maintain 4:3 aspect ratio
- `ResizeObserver` handles viewport changes (more reliable than `resize` events on iOS)

Touch joystick:
- Left half of screen: D-pad zone (8-directional, deadzone threshold 0.3)
- Right half: circular fire button
- Maps to selected joystick type (Kempston port or Spectrum key rows)

## 3D Cube (video/cube.ts)

Optional visualization using Three.js (loaded via npm):
- Creates a 512x512 off-screen canvas as a texture source
- Each frame: fills with border color, draws the scaled Spectrum screen centered, updates texture
- Cube rotates continuously on all 3 axes
- Toggle via checkbox; hidden by default on mobile

## Memory Debug View (debug/debug-view.ts)

Real-time memory visualization displaying the Z80's full 64 KB address space as a 256x256 grayscale image.

**Rendering pipeline:**
- Reads `Uint8Array` view of WASM linear memory at offset `MEM_BASE` (0x100000), 65,536 bytes
- Uploads as a `LUMINANCE` texture via `texSubImage2D()` — single byte per pixel, GPU converts to grayscale
- Falls back to Canvas 2D `putImageData()` if WebGL is unavailable
- Renders conditionally: only when the "Debug" checkbox is checked

**Performance characteristics:**
- ~64 KB texture upload per frame via WebGL (negligible for modern GPUs)
- Zero-copy `Uint8Array` view into WASM memory — no data copying
- No per-pixel JavaScript loops in the WebGL path
- Separate WebGL context from the main screen to avoid state conflicts

**Interaction (paused only):**
- Click a pixel -> fixed info panel shows address (hex), value (hex + decimal), ROM/RAM indicator
- RAM bytes editable via hex input; writes via `wasm.writeRAM(addr, val)`
- Zoom slider (1x-8x) applies CSS `transform: scale()` with scrollable container

*Updated: 2026-03-21 - TypeScript migration: .js → .ts references*
