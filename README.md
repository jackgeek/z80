# ZX Spectrum 48K Emulator

A ZX Spectrum 48K emulator running in the browser via WebAssembly.

**[Play it live on GitHub Pages](https://jackgeek.github.io/z80/)**

## Features

- Full Z80 CPU emulation compiled to WebAssembly (AssemblyScript)
- Accurate ULA screen rendering — 256x192 pixels, attributes, flash, border colour
- 1-bit beeper audio via Web Audio API (AudioWorklet)
- TAP/TZX/ZIP file loading via drag & drop
- .z80 snapshot save/restore (v1/v2/v3 format)
- Keyboard mapped to the ZX Spectrum matrix
- Virtual on-screen keyboard (ZX Spectrum replica)
- Touch joystick for mobile (Kempston, Sinclair, Cursor)
- 3D rotating cube mode — the live screen rendered on all six faces (Three.js)
- Memory debug view — 256x256 grayscale heatmap of the full 64 KB address space

## Usage

1. The emulator loads the ROM automatically on startup (`48.rom` must be present)
2. Drag and drop a `.tap` file onto the page to load software
3. Type `LOAD ""` — press **J**, then **Ctrl+P** twice, then **Enter**
4. Toggle **Cube mode** in the controls for a 3D view

### Keyboard

| Key | Spectrum key |
|-----|-------------|
| Shift | Caps Shift |
| Ctrl | Symbol Shift |
| Arrow keys | Caps Shift + 5/6/7/8 |
| Backspace | Caps Shift + 0 |

## Building

Requires Node.js 20+.

```bash
npm install
npm run build   # compiles AssemblyScript → WASM + Vite production build → dist/
npm run dev     # builds WASM + starts Vite dev server with HMR
npm run serve   # preview production build (vite preview)
```

## Project Structure

```
assembly/index.ts        # Z80 CPU + ULA emulation (AssemblyScript → WASM)
src/
  index.html             # Main UI (dark theme, responsive layout)
  main.js                # Entry point — imports and wires all modules
  emulator/
    state.js             # Shared emulator state (replaces globals)
    wasm-loader.js       # WASM fetch, instantiate, ROM loading
    frame-loop.js        # requestAnimationFrame loop, turbo mode
  input/
    keyboard.js          # Physical keyboard mapping + handlers
    vkeyboard.js         # Virtual keyboard (ZX Spectrum replica)
    joystick.js          # Fullscreen mode + touch joystick overlay
  audio/
    audio.js             # AudioWorklet setup + fallback
  video/
    screen.js            # WebGL/Canvas2D screen rendering
    cube.js              # Three.js 3D cube visualization
  media/
    tape.js              # TAP/TZX/ZIP file format parsing + loading
    snapshot.js          # .z80 format save/restore
  debug/
    debug-view.js        # Memory debug visualization
  ui/
    ui.js                # Button handlers, drag-drop, file inputs
public/
  48.rom                 # ZX Spectrum 48K ROM binary (16 KB)
  audio-worklet.js       # AudioWorklet processor (must be non-module)
  spectrum.wasm          # Compiled WASM (build artifact)
packages/
  assembler/             # Z80 assembler CLI (source → TAP)
vite.config.js           # Vite bundler configuration
```

## Credits

Developed by **Jack Allan** with the assistance of [Anthropic Claude](https://www.anthropic.com).

The ZX Spectrum 48K ROM is Amstrad plc. Amstrad have given their permission for the ROM to be distributed with emulators.

## Tech stack

- [AssemblyScript](https://www.assemblyscript.org/) — Z80 CPU and Spectrum hardware compiled to WASM
- [Vite](https://vite.dev/) — dev server with HMR + production bundler
- [Three.js](https://threejs.org/) — 3D cube renderer
- Web Audio API — beeper audio via AudioWorklet
- GitHub Actions + GitHub Pages — CI/CD and hosting
