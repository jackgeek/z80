# ZX Spectrum 48K Emulator

Browser-based ZX Spectrum 48K emulator using WebAssembly (AssemblyScript) for the CPU core and vanilla JavaScript for the frontend.

**Live demo:** https://jackgeek.github.io/z80/

## Quick Reference

```bash
npm run build    # Compile AssemblyScript → WASM + Vite production build → dist/
npm run dev      # Start Vite dev server with HMR
npm run serve    # Preview production build (vite preview)
npm run asm -- input.asm -o output.tap   # Assemble Z80 source → TAP file
```

## Project Structure

```
assembly/index.ts    # Z80 CPU + ULA emulation (AssemblyScript, compiles to WASM)
src/
  index.html         # Main UI (dark theme, responsive layout)
  main.js            # Entry point — imports and wires all modules
  emulator/
    state.js         # Shared emulator state (replaces all globals)
    wasm-loader.js   # WASM fetch, instantiate, ROM loading
    frame-loop.js    # requestAnimationFrame loop, turbo mode
  input/
    keyboard.js      # Physical keyboard mapping + handlers
    vkeyboard.js     # Virtual keyboard (ZX Spectrum replica)
    joystick.js      # Fullscreen mode + touch joystick overlay
  audio/
    audio.js         # AudioWorklet processor setup + fallback
  video/
    screen.js        # WebGL/Canvas2D screen rendering
    cube.js          # Three.js 3D cube visualization
  media/
    tape.js          # TAP/TZX/ZIP file format parsing + loading
    snapshot.js      # .z80 format save/restore
  debug/
    debug-view.js    # Memory debug visualization
  ui/
    ui.js            # Button handlers, drag-drop, file inputs
public/
  48.rom             # ZX Spectrum 48K ROM binary (16 KB)
  audio-worklet.js   # AudioWorklet processor (must be non-module)
  hello.tap          # Example TAP file
packages/
  assembler/
    cli.js           # Z80 assembler CLI entry point
    assembler.js     # Two-pass assembler
    parser.js, encoder.js, opcodes.js, expressions.js, tap.js
vite.config.js       # Vite bundler configuration
```

## Architecture Overview

The emulator has two layers separated by the WASM boundary:

1. **WASM core** (`assembly/index.ts`) — Z80 CPU, ULA screen rendering, beeper sampling, memory, I/O ports
2. **JS frontend** (`src/`) — ES modules wired together in `main.js`, organized by domain (emulator, input, audio, video, media, ui)

They share a 16 MB WASM linear memory buffer. JS writes ROM/tape data and keyboard state into known offsets; WASM writes screen pixels and audio samples back.

All browser code uses ES modules with `import`/`export` (no globals). Vite provides the dev server (with HMR) and production bundling. `src/` contains source modules, `public/` holds static assets served as-is, and `dist/` is the build output (gitignored). Three.js is loaded via npm, not CDN.

See [docs/architecture.md](docs/architecture.md) for full system design.

## Key Conventions

- **No frameworks** — vanilla JS, no UI framework
- **ES modules** — all browser code uses `import`/`export`
- **Vite** — dev server with HMR, production build to `dist/`
- **Static hosting** — `dist/` is the deployable site (GitHub Pages)
- **AssemblyScript idioms** — `@inline` on hot paths, `unchecked()` array access, explicit `u8`/`u16` casts
- **ROM trap + pulse playback** — standard blocks load instantly via ROM trap at PC=0x0556; TZX files also generate a pulse stream for timing-accurate custom loader support
- **Snapshot save/restore** — full machine state (RAM + CPU registers) saved/loaded as `.z80` format (v1/v2/v3 compatible with other emulators)

## Deeper Documentation

- [docs/architecture.md](docs/architecture.md) — System architecture, WASM/JS boundary, data flow
- [docs/setup.md](docs/setup.md) — Getting started, build instructions, dev workflow
- [assembly/docs/CLAUDE.md](assembly/docs/CLAUDE.md) — Z80 core overview
- [assembly/docs/architecture.md](assembly/docs/architecture.md) — CPU pipeline, memory layout, ULA
- [src/docs/CLAUDE.md](src/docs/CLAUDE.md) — Frontend overview, module relationships
- [src/docs/architecture.md](src/docs/architecture.md) — Audio, file formats, WASM integration, rendering
- [packages/assembler/docs/CLAUDE.md](packages/assembler/docs/CLAUDE.md) — Z80 assembler tool overview
