# ZX Spectrum 48K Emulator

A ZX Spectrum 48K emulator running in the browser via WebAssembly.

**[▶ Play it live on GitHub Pages](https://jackgeek.github.io/z80/)**

## Features

- Full Z80 CPU emulation compiled to WebAssembly (AssemblyScript)
- Accurate ULA screen rendering — 256×192 pixels, attributes, flash, border colour
- 1-bit beeper audio via AudioWorklet (off-main-thread, with ScriptProcessorNode fallback)
- TAP, TZX, and ZIP file loading via drag & drop or file picker
- Instant loading via ROM trap, plus pulse-accurate tape playback for custom loaders
- Keyboard mapped to the ZX Spectrum matrix
- Virtual on-screen keyboard (ZX Spectrum replica)
- Fullscreen mode with touch joystick overlay (mobile-friendly)
- WebGL screen rendering (with Canvas 2D fallback)
- 3D rotating cube mode — the live screen rendered on all six faces (Three.js)

## Usage

1. The emulator loads the ROM automatically on startup (`48.rom` must be present)
2. Drag and drop a `.tap`, `.tzx`, or `.zip` file onto the page to load software
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

Requires Node.js.

```bash
npm install
npm run build   # compiles AssemblyScript → src/spectrum.wasm
npm run serve   # serves on http://localhost:8080
```

## Credits

Developed by **Jack Allan** with the assistance of [Anthropic Claude](https://www.anthropic.com).

The ZX Spectrum 48K ROM is © Amstrad plc. Amstrad have given their permission for the ROM to be distributed with emulators.

## Tech stack

- [AssemblyScript](https://www.assemblyscript.org/) — Z80 CPU and Spectrum hardware compiled to WASM
- WebGL — screen rendering (Canvas 2D fallback)
- AudioWorklet / Web Audio API — beeper audio (off main thread)
- [Three.js](https://threejs.org/) — 3D cube renderer
- GitHub Actions + GitHub Pages — CI/CD and hosting
