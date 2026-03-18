# ZX Spectrum 48K Emulator

Browser-based ZX Spectrum 48K emulator using WebAssembly (AssemblyScript) for the CPU core and vanilla JavaScript for the frontend.

**Live demo:** https://jackgeek.github.io/z80/

## Quick Reference

```bash
npm run build    # Compile AssemblyScript → WASM, copy to src/
npm run serve    # Start http-server on localhost:8080
npm run dev      # Build + serve
```

## Project Structure

```
assembly/index.ts    # Z80 CPU + ULA emulation (AssemblyScript, compiles to WASM)
src/
  index.html         # Main UI (dark theme, responsive layout)
  main.js            # WASM loader, keyboard, tape loading, audio, frame loop
  joystick.js        # Fullscreen mode + touch joystick overlay
  vkeyboard.js       # Virtual keyboard (ZX Spectrum replica)
  cube.js            # Three.js 3D cube visualization
  48.rom             # ZX Spectrum 48K ROM binary (16 KB)
  spectrum.wasm      # Compiled WASM (build artifact, checked in for GitHub Pages)
```

## Architecture Overview

The emulator has two layers separated by the WASM boundary:

1. **WASM core** (`assembly/index.ts`) — Z80 CPU, ULA screen rendering, beeper sampling, memory, I/O ports
2. **JS frontend** (`src/`) — WASM loading, keyboard mapping, audio pipeline, file format parsing, UI

They share a 16 MB WASM linear memory buffer. JS writes ROM/tape data and keyboard state into known offsets; WASM writes screen pixels and audio samples back.

See [docs/architecture.md](docs/architecture.md) for full system design.

## Key Conventions

- **No frameworks** — vanilla JS, no bundler, no transpiler
- **Static hosting** — the `src/` directory is the entire deployable site (GitHub Pages)
- **AssemblyScript idioms** — `@inline` on hot paths, `unchecked()` array access, explicit `u8`/`u16` casts
- **ROM trap** — tape loading is instant via interception at PC=0x0556, not timing-accurate

## Deeper Documentation

- [docs/architecture.md](docs/architecture.md) — System architecture, WASM/JS boundary, data flow
- [docs/setup.md](docs/setup.md) — Getting started, build instructions, dev workflow
- [assembly/docs/CLAUDE.md](assembly/docs/CLAUDE.md) — Z80 core overview
- [assembly/docs/architecture.md](assembly/docs/architecture.md) — CPU pipeline, memory layout, ULA
- [src/docs/CLAUDE.md](src/docs/CLAUDE.md) — Frontend overview, module relationships
- [src/docs/architecture.md](src/docs/architecture.md) — Audio, file formats, WASM integration, rendering
