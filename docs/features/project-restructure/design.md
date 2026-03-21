# Project Restructure: ES Modules + Vite + Full Decomposition

## 1. Introduction/Overview

The ZX Spectrum 48K emulator currently has a flat `src/` directory that serves as both source and deploy root. The core `main.js` is a ~1,316-line monolith handling WASM loading, keyboard mapping, audio pipeline, tape format parsing, snapshot management, and UI — all in one file. Frontend modules communicate via `window.*` globals with implicit script load ordering.

This refactor introduces:
- **ES modules** (`import`/`export`) to replace global variable coupling
- **Vite** as the bundler for dev server (HMR) and production builds
- **Separate `src/` and `dist/`** directories (source vs build output)
- **Full decomposition** of `main.js` into ~12 focused, domain-grouped modules
- **Three.js via npm** instead of CDN script tag
- **Assembler toolchain reorganization** to `packages/assembler/`

All existing functionality is retained. No features are added or removed.

## 2. Goals

1. **Separation of concerns** — Each module has a single responsibility (audio, keyboard, tape parsing, etc.)
2. **Explicit dependencies** — ES module imports replace implicit globals (`window.wasm`, `window.specKeyDown`)
3. **Modern DX** — Vite provides hot module replacement, fast dev server, and optimized production builds
4. **Reusability** — Domain modules (tape parser, snapshot handler, assembler) become independently importable
5. **Clean deploy model** — Source in `src/`, built site in `dist/`, static assets in `public/`
6. **Documentation accuracy** — All docs updated to reflect new structure

## 3. User Stories

- **As a developer**, I want to find code by domain (audio, input, media) rather than scanning a 1,300-line file, so I can make targeted changes quickly.
- **As a developer**, I want explicit import/export relationships so I can trace dependencies without searching for global variable usage.
- **As a developer**, I want HMR during development so I see changes instantly without manual page refresh.
- **As a contributor**, I want a conventional project structure (src/public/dist) so I can orient myself quickly.
- **As the maintainer**, I want the assembler toolchain in its own package so it can evolve independently.

## 4. Functional Requirements

### 4.1 New Folder Structure

```
z80/
├── assembly/                          # UNCHANGED
│   ├── index.ts
│   ├── tsconfig.json
│   └── docs/CLAUDE.md, architecture.md
├── src/                               # SOURCE (Vite root)
│   ├── index.html                     # Single <script type="module" src="main.js">
│   ├── main.js                        # ~40-line entry: imports + wires modules
│   ├── emulator/
│   │   ├── wasm-loader.js             # WASM fetch, instantiate, ROM loading
│   │   ├── frame-loop.js              # requestAnimationFrame loop, turbo mode
│   │   └── state.js                   # Shared emulator state (wasm, memory, flags)
│   ├── input/
│   │   ├── keyboard.js                # KEY_MAP, COMPOUND_KEYS, keydown/keyup
│   │   ├── vkeyboard.js               # Virtual ZX Spectrum keyboard (ES module)
│   │   └── joystick.js                # Fullscreen + touch joystick (ES module)
│   ├── audio/
│   │   └── audio.js                   # AudioContext init, worklet setup, pushAudioFrame
│   ├── media/
│   │   ├── tape.js                    # TAP/TZX parsing, tzxToTap, tzxToPulses, ZIP
│   │   └── snapshot.js                # .z80 save/load, compress/decompress
│   ├── video/
│   │   ├── screen.js                  # Canvas rendering, renderFrame, BORDER_COLORS
│   │   └── cube.js                    # Three.js 3D cube (import THREE from npm)
│   ├── debug/
│   │   └── debug-view.js              # Memory debug heatmap (ES module)
│   ├── ui/
│   │   └── ui.js                      # Button handlers, drag-drop, file inputs, setStatus
│   └── docs/CLAUDE.md, architecture.md
├── public/                            # Static assets (Vite serves at root, copies to dist/)
│   ├── 48.rom
│   ├── audio-worklet.js               # Must stay non-module (AudioWorklet constraint)
│   └── hello.tap
├── dist/                              # Vite build output (GITIGNORED)
├── packages/
│   └── assembler/
│       ├── cli.js                     # CLI entry (was tools/z80asm.js)
│       ├── assembler.js, parser.js, encoder.js, opcodes.js, expressions.js, tap.js
│       └── docs/CLAUDE.md
├── examples/hello.asm, hello.tap      # UNCHANGED
├── docs/                              # Updated with new paths
├── .github/workflows/deploy.yml       # Build with Vite, upload dist/
├── vite.config.js                     # NEW
├── package.json                       # Updated scripts + deps
└── CLAUDE.md                          # Updated paths
```

### 4.2 Module Decomposition

| New Module | Responsibility | Exports |
|-----------|---------------|---------|
| `emulator/state.js` | Shared state (replaces all globals) | `wasm`, `memory`, `running`, `paused`, `turboMode`, `romLoaded`, `cachedRomData` + getters/setters |
| `emulator/wasm-loader.js` | WASM fetch, instantiate, ROM loading | `initWasm()`, `loadROM(data)`, memory base constants |
| `emulator/frame-loop.js` | requestAnimationFrame loop | `startFrameLoop()`, `stopFrameLoop()` |
| `audio/audio.js` | AudioContext, worklet, ScriptProcessor fallback | `initAudio()`, `pushAudioFrame()` |
| `input/keyboard.js` | Physical keyboard mapping + handlers | `KEY_MAP`, `COMPOUND_KEYS`, `attachKeyboardHandlers()` |
| `input/vkeyboard.js` | Virtual ZX Spectrum keyboard | `initVirtualKeyboard()`, `specKeyDown()`, `specKeyUp()` |
| `input/joystick.js` | Fullscreen + touch joystick | `initJoystick()` |
| `video/screen.js` | Canvas rendering | `initScreen()`, `renderFrame()`, `BORDER_COLORS` |
| `video/cube.js` | Three.js 3D cube | `initCube()` |
| `media/tape.js` | TAP/TZX/ZIP parsing | `loadTapeFile()`, `tzxToTap()`, `tzxToPulses()` |
| `media/snapshot.js` | .z80 format save/load | `saveZ80()`, `loadZ80()`, compression helpers |
| `debug/debug-view.js` | Memory debug heatmap | `initDebugView()`, `renderDebugView()` |
| `ui/ui.js` | Button handlers, drag-drop, setStatus | `initUI()`, `setStatus()` |
| `main.js` | Entry point — imports + wires all modules | (none, side-effect) |

### 4.3 Import Graph (no circular dependencies)

```
main.js → emulator/state, emulator/wasm-loader, emulator/frame-loop,
           audio/audio, input/keyboard, input/vkeyboard, input/joystick,
           video/screen, video/cube, debug/debug-view, ui/ui

emulator/wasm-loader → emulator/state
emulator/frame-loop → emulator/state, audio/audio, video/screen, debug/debug-view
audio/audio → emulator/state
input/keyboard → emulator/state
input/vkeyboard → emulator/state, audio/audio
input/joystick → emulator/state, input/vkeyboard
video/screen → emulator/state
video/cube → three, emulator/state
media/tape → emulator/state
media/snapshot → emulator/state
debug/debug-view → emulator/state
ui/ui → emulator/wasm-loader, media/tape, media/snapshot, audio/audio
```

### 4.4 Vite Configuration

```js
// vite.config.js
import { defineConfig } from 'vite';
export default defineConfig({
  root: 'src',
  publicDir: '../public',
  build: { outDir: '../dist', emptyOutDir: true },
  server: { port: 8080 },
});
```

### 4.5 Build Scripts

```json
{
  "build:wasm": "... asc assembly/index.ts → build/spectrum.wasm → public/spectrum.wasm",
  "build:web": "vite build",
  "build": "npm run build:wasm && npm run build:web",
  "dev": "npm run build:wasm && vite",
  "serve": "vite preview --port 8080",
  "asm": "node packages/assembler/cli.js"
}
```

### 4.6 CI Pipeline Update

GitHub Actions deploys `dist/` instead of `src/`. The build step runs `npm run build` (WASM + Vite).

### 4.7 HTML Changes

Replace 6 `<script>` tags (including Three.js CDN) with a single `<script type="module" src="main.js"></script>`.

### 4.8 Documentation Updates

All documentation files that reference file paths or architecture must be updated:
- `CLAUDE.md`, `README.md`
- `docs/architecture.md`, `docs/setup.md`
- `src/docs/CLAUDE.md`, `src/docs/architecture.md`
- `assembly/docs/CLAUDE.md`
- `packages/assembler/docs/CLAUDE.md` (moved from tools/)
- Feature docs in `docs/features/*/`

## 5. Non-Goals (Out of Scope)

- **No new features** — This is purely a structural refactor
- **No TypeScript conversion** — Frontend JS stays as JavaScript
- **No test framework** — Tests are a separate initiative
- **No CSS extraction** — Inline styles in index.html remain (Vite handles this fine)
- **No AssemblyScript splitting** — `assembly/index.ts` remains monolithic
- **No changes to WASM API** — All exported/imported functions stay the same

## 6. Technical Considerations

- **`audio-worklet.js` must stay in `public/`** — AudioWorklet's `addModule()` requires a URL-loadable non-module script; it cannot be bundled
- **`spectrum.wasm` in `public/`** — loaded via `fetch()` + `WebAssembly.instantiate()`, not a Vite-processed import
- **No `"type": "module"` in package.json** — assembler tools use CommonJS `require()`. Only browser code uses ES modules
- **Three.js moves to npm** — `npm install three` replaces CDN `<script>` tag, enabling tree-shaking
- **Version sync** — `package.json` and `index.html` versions must stay in sync (currently v1.0.18)

## 7. Success Metrics

1. All existing functionality works identically after refactor
2. No file in `src/` exceeds ~400 lines (down from 1,316)
3. Zero `window.*` global variable assignments for module communication
4. `npm run dev` starts in <2 seconds (Vite cold start)
5. `npm run build` produces a working `dist/` deployable to GitHub Pages
6. All documentation accurately reflects the new structure

## 8. Open Questions

None — all decisions resolved during design phase.
