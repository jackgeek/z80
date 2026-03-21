# System Architecture

## Overview

The emulator is a two-layer system: a WASM core (AssemblyScript) handling all Z80/ULA emulation, and a JS frontend handling I/O, UI, and browser APIs. They communicate through shared WASM linear memory.

```
┌──────────────────────────────────────────────────────┐
│                     Browser                           │
│                                                      │
│  ┌───────────────────────────────────────────────┐   │
│  │  JS Frontend (src/, ES modules, bundled by Vite) │
│  │                                               │   │
│  │  main.js (entry point — imports all modules)  │   │
│  │  emulator/  state, wasm-loader, frame-loop    │   │
│  │  input/     keyboard, vkeyboard, joystick     │   │
│  │  audio/     audio                             │   │
│  │  video/     screen, cube (Three.js via npm)   │   │
│  │  media/     tape, snapshot                    │   │
│  │  debug/     debug-view                        │   │
│  │  ui/        ui                                │   │
│  └──────────────────┬────────────────────────────┘   │
│                     │                                │
│          WASM shared memory (16 MB)                  │
│                     │                                │
│  ┌──────────────────▼────────────────────────────┐   │
│  │  WASM Core (assembly/index.ts)                │   │
│  │  Z80 CPU + ULA                                │   │
│  └───────────────────────────────────────────────┘   │
│                                                      │
│  public/  (static assets: 48.rom, spectrum.wasm,     │
│            audio-worklet.js)                          │
└──────────────────────────────────────────────────────┘
```

## Module Architecture

The JS frontend uses ES modules (`import`/`export`) bundled by Vite. There are no script-tag globals — shared state lives in `emulator/state.js` with getter/setter exports that all other modules import.

`main.js` is a slim ~30-line entry point that imports and calls init functions from each module group:

```
main.js
  ├── emulator/state.js        Shared state (wasm instance, flags, constants)
  ├── emulator/wasm-loader.js  Fetches + instantiates spectrum.wasm, loads ROM
  ├── emulator/frame-loop.js   requestAnimationFrame loop (50 Hz PAL)
  ├── input/keyboard.js        Physical keyboard → keyState matrix
  ├── input/vkeyboard.js       Virtual ZX Spectrum keyboard overlay
  ├── input/joystick.js        Fullscreen + touch joystick
  ├── audio/audio.js           Web Audio pipeline (AudioWorklet)
  ├── video/screen.js          Canvas rendering (ImageData blit)
  ├── video/cube.js            Three.js 3D cube visualization
  ├── media/tape.js            TAP / TZX / ZIP file parsing + loading
  ├── media/snapshot.js        .z80 snapshot save / restore
  ├── debug/debug-view.js      Memory / register debug panel
  └── ui/ui.js                 Buttons, drag-and-drop, file inputs, game library
```

## WASM Linear Memory Layout

All communication between JS and WASM uses fixed offsets in a shared 16 MB buffer:

| Offset | Size | Purpose |
|--------|------|---------|
| `0x100000` | 64 KB | Z80 address space (16 KB ROM + 48 KB RAM) |
| `0x110000` | 192 KB | Screen buffer (256×192×4 RGBA pixels) |
| `0x140000` | 512 KB | TAP file buffer (tape data loaded by JS) |
| `0x1C0000` | 3.5 KB | Audio sample buffer (882 i16 samples/frame) |

## Frame Loop

Each iteration of the main loop (targeting 50 Hz PAL):

1. **JS** calls `wasm.frame()`
2. **WASM** executes 69,888 T-cycles of Z80 instructions
3. **WASM** renders the screen into the screen buffer (ULA emulation)
4. **WASM** samples the beeper into the audio buffer (~every 79 T-cycles)
5. **JS** blits the screen buffer onto a `<canvas>` via `ImageData`
6. **JS** reads the audio buffer, applies a high-pass filter, and pushes to Web Audio
7. `requestAnimationFrame` schedules the next iteration (throttled to ~50 FPS)

## Data Flow: Keyboard Input

```
Physical key / Virtual keyboard / Touch joystick
        │
        ▼
  JS keyState[] array (8 rows × 5-bit bitmask)
        │
        ▼  (written to WASM memory before each frame)
  WASM reads via IN port 0xFE (keyboard matrix)
```

## Data Flow: Tape Loading

```
User drops/selects file
        │
        ▼
  JS parses format (TAP / TZX→TAP / ZIP→TAP)
        │
        ▼
  JS writes raw TAP bytes to 0x140000 in WASM memory
        │
        ▼
  WASM ROM trap at PC=0x0556 intercepts LD-BYTES
        │
        ▼
  Data copied directly into Z80 RAM (instant load)
```

## Data Flow: Audio

```
Z80 OUT to port 0xFE bit 4 (beeper toggle)
        │
        ▼
  WASM samples beeper state every ~79 T-cycles → audio buffer
        │
        ▼
  JS reads audio buffer (882 samples/frame)
        │
        ▼
  High-pass filter (α=0.995, removes DC offset)
        │
        ▼
  AudioWorklet (public/audio-worklet.js) → Web Audio API → speakers
```

> `audio-worklet.js` lives in `public/` because AudioWorklet processors must be loaded from a standalone URL — they cannot be part of the ES module bundle.

## Z80 Assembler toolchain

*Added: 2026-03-19*

A standalone Node.js CLI tool (`packages/assembler/cli.js`) that assembles Z80 source files into ZX Spectrum TAP files. The output TAP integrates directly with the emulator via drag-and-drop or the game library dropdown.

```
source.asm → [z80asm] → output.tap → [emulator loads via ROM trap]
```

The assembler is a two-pass design:
- **Pass 1**: Collect labels and calculate instruction sizes
- **Pass 2**: Emit binary with resolved symbol references

Output TAP contains a BASIC loader (`CLEAR / LOAD "" CODE / RANDOMIZE USR`) plus the assembled CODE block. See [packages/assembler/docs/CLAUDE.md](../packages/assembler/docs/CLAUDE.md) for module details.

## Build Pipeline

Vite is the bundler. Source lives in `src/`, static assets in `public/`, and `dist/` is the build output.

```bash
npm run build:wasm   # AssemblyScript → public/spectrum.wasm
npm run build:web    # Vite bundles src/ → dist/
npm run build        # Both steps
npm run dev          # build:wasm + Vite dev server (HMR)
npm run asm          # Z80 assembler CLI (packages/assembler/)
```

Key build notes:
- `spectrum.wasm` is built into `public/` so Vite copies it to `dist/` as a static asset
- Three.js is an npm dependency — Vite tree-shakes it into the bundle
- `audio-worklet.js` is in `public/` (AudioWorklet constraint: must be a standalone file)

## Deployment

GitHub Actions builds WASM and runs `vite build`, then deploys the `dist/` directory to GitHub Pages. The site is 100% static files — no server-side logic.
