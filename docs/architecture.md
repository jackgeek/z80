# System Architecture

## Overview

The emulator is a two-layer system: a WASM core (AssemblyScript) handling all Z80/ULA emulation, and a JS frontend handling I/O, UI, and browser APIs. They communicate through shared WASM linear memory.

```
┌─────────────────────────────────────────────────────┐
│                    Browser                           │
│                                                     │
│  ┌──────────────────────┐  ┌─────────────────────┐  │
│  │   JS Frontend (src/) │  │  Three.js (CDN)     │  │
│  │                      │  │  cube.js            │  │
│  │  main.js             │  └─────────┬───────────┘  │
│  │  joystick.js         │            │              │
│  │  vkeyboard.js        │     reads canvas         │
│  └──────────┬───────────┘            │              │
│             │                        │              │
│     WASM shared memory (16 MB)       │              │
│             │                        │              │
│  ┌──────────▼───────────┐            │              │
│  │  WASM Core           │            │              │
│  │  assembly/index.ts   │────────────┘              │
│  │                      │  (screen buffer)          │
│  │  Z80 CPU + ULA       │                           │
│  └──────────────────────┘                           │
└─────────────────────────────────────────────────────┘
```

## WASM Linear Memory Layout

All communication between JS and WASM uses fixed offsets in a shared 16 MB buffer:

| Offset | Size | Purpose |
|--------|------|---------|
| `0x100000` | 64 KB | Z80 address space (16 KB ROM + 48 KB RAM) |
| `0x110000` | 192 KB | Screen buffer (256×192×4 RGBA pixels) |
| `0x140000` | 512 KB | TAP file buffer (tape data loaded by JS) |
| `0x1C0000` | 3.5 KB | Audio sample buffer (882 i16 samples/frame) |
| `0x1F0000` | 1 KB | Block boundary pulse indices (max 256 × u32) |
| `0x200000` | 4 MB | Pulse duration buffer (up to 1M u32 pulse durations, TZX playback) |

## Frame Loop

Each iteration of the main loop (targeting 50 Hz PAL):

1. **JS** calls `wasm.frame()`
2. **WASM** executes 69,888 T-cycles of Z80 instructions
3. **WASM** renders the screen into the screen buffer (ULA emulation)
4. **WASM** samples the beeper into the audio buffer (~every 79 T-cycles)
5. **JS** uploads the screen buffer to a WebGL texture (with Canvas 2D `ImageData` fallback)
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

For TZX files with custom loaders, a pulse-based path runs alongside the ROM trap:

```
User drops/selects TZX file
        │
        ▼
  JS parses TZX blocks → generates pulse stream (u32 T-cycle durations)
        │
        ▼
  JS writes pulse data to 0x200000 in WASM memory
        │
        ▼
  WASM plays back pulses in real time via IN port 0xFE bit 6 (EAR input)
        │
        ▼
  Custom loader routine reads data from the tape signal
```

*Updated: 2026-03-19 — WebGL renderer, AudioWorklet, pulse tape playback*

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
  AudioWorklet (off-thread) → Web Audio API → speakers
  (ScriptProcessorNode fallback when AudioWorklet is unavailable)
```

Audio samples are buffered through a typed ring buffer (`Float32Array`) or posted via `MessagePort` to the AudioWorklet processor.

*Updated: 2026-03-19 — WebGL renderer, AudioWorklet, pulse tape playback*

## Deployment

GitHub Actions builds WASM on every push to `main` and deploys the `src/` directory to GitHub Pages. The site is 100% static files — no server-side logic.
