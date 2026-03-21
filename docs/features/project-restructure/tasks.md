# Tasks: Project Restructure — ES Modules + Vite + Full Decomposition

## Tasks

### Phase 1: Infrastructure Setup

**Status**: Complete
**Progress**: 7/7 tasks complete (100%)
**Phase Started**: 2026-03-21 20:41:00 UTC+0
**Phase Completed**: 2026-03-21 20:44:00 UTC+0

- [x] 1.0 Set up Vite build infrastructure and public/ directory
  - **Relevant Documentation:**
    - `docs/features/project-restructure/design.md` - Feature requirements and new folder structure
    - `CLAUDE.md` - Project overview, build conventions, key conventions
    - `docs/architecture.md` - System architecture, WASM/JS boundary, build pipeline
    - `docs/setup.md` - Build instructions, dev workflow
    - `src/docs/CLAUDE.md` - Frontend module overview
  - [x] 1.1 Create `public/` directory and move static assets
    - **Started**: 2026-03-21 20:41:00 UTC+0
    - **Completed**: 2026-03-21 20:42:00 UTC+0
    - **Duration**: 1m
  - [x] 1.2 Install Vite and Three.js via npm
    - Installed vite@6.4.1 (Node 20 compatible) and three@0.183.2
    - **Started**: 2026-03-21 20:42:00 UTC+0
    - **Completed**: 2026-03-21 20:43:00 UTC+0
    - **Duration**: 1m
  - [x] 1.3 Create `vite.config.js` at project root
    - **Started**: 2026-03-21 20:43:00 UTC+0
    - **Completed**: 2026-03-21 20:43:00 UTC+0
    - **Duration**: <1m
  - [x] 1.4 Update `package.json` scripts
    - **Started**: 2026-03-21 20:43:00 UTC+0
    - **Completed**: 2026-03-21 20:43:00 UTC+0
    - **Duration**: <1m
  - [x] 1.5 Add `dist/` to `.gitignore`
    - **Started**: 2026-03-21 20:43:00 UTC+0
    - **Completed**: 2026-03-21 20:43:00 UTC+0
    - **Duration**: <1m
  - [x] 1.6 Verify infrastructure works
    - WASM builds and copies to public/spectrum.wasm successfully
    - Vite dev server starts on port 8080 in 333ms
    - **Started**: 2026-03-21 20:43:00 UTC+0
    - **Completed**: 2026-03-21 20:44:00 UTC+0
    - **Duration**: 1m
  - [x] 1.7 Create phase completion summary
    - Create `docs/tasks/TASK-1.0-INFRASTRUCTURE-SETUP-COMPLETION-SUMMARY.md`
    - Include: what was set up, verification results, key files created
    - **Started**: TBD
    - **Completed**: TBD
    - **Duration**: TBD

---

### Phase 2: Create Shared State Module + Directory Scaffolding

**Status**: Not Started
**Progress**: 0/4 tasks complete (0%)
**Phase Started**: TBD
**Phase Completed**: TBD

- [ ] 2.0 Create module directories and shared state
  - **Relevant Documentation:**
    - `docs/features/project-restructure/design.md` - Module decomposition, import graph, state.js spec
    - `CLAUDE.md` - Key conventions (no frameworks, vanilla JS)
    - `src/docs/CLAUDE.md` - Frontend module overview
    - `src/docs/architecture.md` - WASM integration, module relationships
    - `docs/architecture.md` - System architecture
  - [ ] 2.1 Create directory structure under `src/`
    - Create directories: `src/emulator/`, `src/input/`, `src/audio/`, `src/media/`, `src/video/`, `src/debug/`, `src/ui/`
    - **Started**: TBD
    - **Completed**: TBD
    - **Duration**: TBD
  - [ ] 2.2 Create `src/emulator/state.js` — shared state module
    - Extract state variables from `src/main.js` lines 4-15: `SCREEN_WIDTH`, `SCREEN_HEIGHT`, `wasm`, `memory`, `running`, `paused`, `turboMode`, `debugVisible`, `romLoaded`, `animFrameId`, `cachedRomData`
    - Also extract memory base address constants: `MEM_BASE` (0x100000), `SCREEN_BASE` (0x110000), `TAP_BASE` (0x140000), `AUDIO_BASE` (0x1C0000), `PULSE_BASE`
    - Export each as a getter/setter pair (e.g., `getWasm()`, `setWasm(w)`) to allow mutation from any module
    - This is the central dependency that all other modules will import from — no circular deps
    - **Started**: TBD
    - **Completed**: TBD
    - **Duration**: TBD
  - [ ] 2.3 Verify state module exports work
    - Temporarily import state.js from main.js using `<script type="module">` to confirm ES module loading works in Vite dev server
    - Revert temp change after verification
    - **Started**: TBD
    - **Completed**: TBD
    - **Duration**: TBD
  - [ ] 2.4 Create phase completion summary
    - Create `docs/tasks/TASK-2.0-STATE-MODULE-SCAFFOLDING-COMPLETION-SUMMARY.md`
    - **Started**: TBD
    - **Completed**: TBD
    - **Duration**: TBD

---

### Phase 3: Extract Leaf Modules from main.js

**Status**: Not Started
**Progress**: 0/8 tasks complete (0%)
**Phase Started**: TBD
**Phase Completed**: TBD

- [ ] 3.0 Extract standalone modules that have no project imports (only import from state.js)
  - **Relevant Documentation:**
    - `docs/features/project-restructure/design.md` - Module decomposition specs, export lists
    - `CLAUDE.md` - Key conventions
    - `src/docs/CLAUDE.md` - Frontend module overview, current main.js responsibilities
    - `src/docs/architecture.md` - Audio pipeline, keyboard mapping, file formats, rendering
    - `assembly/docs/CLAUDE.md` - WASM exported functions (needed to know which wasm.* calls go where)
    - `docs/architecture.md` - Data flow between modules
  - [ ] 3.1 Create `src/input/keyboard.js`
    - Extract `KEY_MAP` object (main.js lines ~44-112) and `COMPOUND_KEYS` object
    - Extract keyboard event handler functions (keydown/keyup listeners)
    - Export: `KEY_MAP`, `COMPOUND_KEYS`, `attachKeyboardHandlers()`
    - Import: `getWasm`, `isRunning` from `../emulator/state.js`
    - **Started**: TBD
    - **Completed**: TBD
    - **Duration**: TBD
  - **Parallel Group A** (after 3.1 completes — these are all independent leaf extractions):
    - [ ] 3.2 Create `src/audio/audio.js`
      - Extract audio state variables (main.js lines ~17-28): `audioCtx`, `audioWorkletNode`, `audioScriptNode`, `useWorklet`, `AUDIO_SAMPLE_RATE`, `AUDIO_SAMPLES_PER_FRAME`, ring buffer vars
      - Extract `initAudio()` function and audio worklet/ScriptProcessor setup
      - Extract `pushAudioFrame()` function (reads audio samples from WASM memory, feeds to worklet/scriptprocessor)
      - AudioWorklet URL should be `/audio-worklet.js` (served from public/)
      - Export: `initAudio()`, `pushAudioFrame()`
      - Import: `getWasm`, `getMemory`, `AUDIO_BASE` from `../emulator/state.js`
      - **Started**: TBD
      - **Completed**: TBD
      - **Duration**: TBD
    - [ ] 3.3 Create `src/video/screen.js`
      - Extract canvas/screen rendering code: `BORDER_COLORS` array, screen canvas setup, `renderFrame()` function (blits WASM screen buffer to canvas via ImageData)
      - Export: `initScreen(canvas)`, `renderFrame()`, `BORDER_COLORS`
      - Import: `getWasm`, `getMemory`, `SCREEN_BASE`, `SCREEN_WIDTH`, `SCREEN_HEIGHT` from `../emulator/state.js`
      - **Started**: TBD
      - **Completed**: TBD
      - **Duration**: TBD
    - [ ] 3.4 Create `src/media/snapshot.js`
      - Extract all .z80 format code (main.js lines ~1046-1311): `saveZ80()`, `loadZ80()`, `compressZ80Page()`, `decompressZ80()`
      - Export: `saveZ80()`, `loadZ80()`
      - Import: `getWasm`, `getMemory`, `MEM_BASE`, `getCachedRomData`, `setRunning`, `setRomLoaded`, `setPaused` from `../emulator/state.js`
      - Note: `loadZ80` calls `wasm.init()`, sets ROM bytes, writes RAM, and updates state flags — all these come from state.js getters
      - **Started**: TBD
      - **Completed**: TBD
      - **Duration**: TBD
    - [ ] 3.5 Create `src/media/tape.js`
      - Extract TAP/TZX/ZIP parsing code: `tzxToTap()`, `tzxToPulses()`, ZIP extraction logic, `loadTapeFile()`, `loadPulseData()`
      - This is the largest extraction (~300 lines)
      - Export: `loadTapeFile()`, `tzxToTap()`, `tzxToPulses()`, `loadPulseData()`
      - Import: `getWasm`, `getMemory`, `TAP_BASE`, `PULSE_BASE` from `../emulator/state.js`
      - **Started**: TBD
      - **Completed**: TBD
      - **Duration**: TBD
    - [ ] 3.6 Convert `src/debug-view.js` → `src/debug/debug-view.js`
      - Move file to new location
      - Convert from `window.debugView = { ... }` pattern to ES module with named exports
      - Export: `initDebugView(memory, wasm, callbacks)`, `renderDebugView(memoryBuffer)`
      - Import: `getWasm`, `getMemory`, `MEM_BASE` from `../emulator/state.js`
      - Remove `window.debugView` assignment
      - **Started**: TBD
      - **Completed**: TBD
      - **Duration**: TBD
  - [ ] 3.7 Verify all leaf modules export correctly
    - Confirm each module can be imported without errors in Vite dev server
    - Check no `window.*` globals are used in the new modules
    - **Started**: TBD
    - **Completed**: TBD
    - **Duration**: TBD
  - [ ] 3.8 Create phase completion summary
    - Create `docs/tasks/TASK-3.0-LEAF-MODULE-EXTRACTION-COMPLETION-SUMMARY.md`
    - **Started**: TBD
    - **Completed**: TBD
    - **Duration**: TBD

---

### Phase 4: Convert Existing Standalone Modules to ES Modules

**Status**: Not Started
**Progress**: 0/5 tasks complete (0%)
**Phase Started**: TBD
**Phase Completed**: TBD

- [ ] 4.0 Convert vkeyboard.js, joystick.js, and cube.js to ES modules
  - **Relevant Documentation:**
    - `docs/features/project-restructure/design.md` - Module specs, import graph
    - `CLAUDE.md` - Key conventions
    - `src/docs/CLAUDE.md` - Current module relationships (vkeyboard defines specKeyDown/Up, joystick consumes them)
    - `src/docs/architecture.md` - Keyboard mapping, joystick types, Three.js cube
    - `docs/architecture.md` - System architecture
  - **Parallel Group A** (all three conversions are independent):
    - [ ] 4.1 Convert `src/vkeyboard.js` → `src/input/vkeyboard.js`
      - Move file to `src/input/vkeyboard.js`
      - Remove IIFE wrapper
      - Remove `window.specKeyDown` and `window.specKeyUp` assignments
      - Remove `window.wasm` reads — import `getWasm` from `../emulator/state.js`
      - Remove `window.initAudio` reference — import `initAudio` from `../audio/audio.js`
      - Export: `initVirtualKeyboard()`, `specKeyDown(row, bit)`, `specKeyUp(row, bit)`
      - The `specKeyDown`/`specKeyUp` functions are the shared interface that joystick.js will import
      - **Started**: TBD
      - **Completed**: TBD
      - **Duration**: TBD
    - [ ] 4.2 Convert `src/joystick.js` → `src/input/joystick.js`
      - Move file to `src/input/joystick.js`
      - Remove IIFE wrapper
      - Replace `window.specKeyDown`/`window.specKeyUp` with import from `./vkeyboard.js`
      - Replace `window.wasm` reads with import `getWasm` from `../emulator/state.js`
      - Export: `initJoystick()`
      - **Started**: TBD
      - **Completed**: TBD
      - **Duration**: TBD
    - [ ] 4.3 Convert `src/cube.js` → `src/video/cube.js`
      - Move file to `src/video/cube.js`
      - Remove IIFE wrapper
      - Replace global `THREE` (from CDN) with `import * as THREE from 'three'` (npm package)
      - Replace `window.wasm` with import `getWasm` from `../emulator/state.js`
      - Export: `initCube()`
      - **Started**: TBD
      - **Completed**: TBD
      - **Duration**: TBD
  - [ ] 4.4 Verify converted modules
    - Confirm each module can be imported in isolation
    - Confirm no `window.*` globals remain in the converted files
    - **Started**: TBD
    - **Completed**: TBD
    - **Duration**: TBD
  - [ ] 4.5 Create phase completion summary
    - Create `docs/tasks/TASK-4.0-ES-MODULE-CONVERSION-COMPLETION-SUMMARY.md`
    - **Started**: TBD
    - **Completed**: TBD
    - **Duration**: TBD

---

### Phase 5: Create Core Emulator Modules + UI + Entry Point

**Status**: Not Started
**Progress**: 0/7 tasks complete (0%)
**Phase Started**: TBD
**Phase Completed**: TBD

- [ ] 5.0 Create wasm-loader, frame-loop, ui modules and rewrite main.js entry point
  - **Relevant Documentation:**
    - `docs/features/project-restructure/design.md` - Module specs, import graph, entry point design
    - `CLAUDE.md` - Key conventions, build commands
    - `src/docs/CLAUDE.md` - Frontend overview
    - `src/docs/architecture.md` - WASM integration, frame loop, audio pipeline
    - `assembly/docs/CLAUDE.md` - WASM exported functions list
    - `docs/architecture.md` - Frame loop, data flows
  - [ ] 5.1 Create `src/emulator/wasm-loader.js`
    - Extract WASM loading logic from main.js `initEmulator()`: `fetch('spectrum.wasm')`, `WebAssembly.instantiate()`, `importObject` construction, ROM loading + caching
    - Export: `initWasm()` (returns Promise), `loadROM(data)`
    - Import: state setters (`setWasm`, `setMemory`, `setRunning`, `setRomLoaded`, `setCachedRomData`) from `./state.js`
    - The `importObject` must include the shared `WebAssembly.Memory` (256 pages)
    - **Started**: TBD
    - **Completed**: TBD
    - **Duration**: TBD
  - [ ] 5.2 Create `src/emulator/frame-loop.js`
    - Extract the `requestAnimationFrame` loop logic from main.js
    - Contains: frame timing, calling `wasm.frame()`, calling `renderFrame()`, calling `pushAudioFrame()`, turbo mode (skip rendering some frames), debug view rendering
    - Export: `startFrameLoop()`, `stopFrameLoop()`
    - Import: state getters from `./state.js`, `renderFrame` from `../video/screen.js`, `pushAudioFrame` from `../audio/audio.js`, `renderDebugView` from `../debug/debug-view.js`
    - **Started**: TBD
    - **Completed**: TBD
    - **Duration**: TBD
  - [ ] 5.3 Create `src/ui/ui.js`
    - Extract UI wiring from main.js: button click handlers (Load ROM, Load TAP, Save Snapshot, Reset, Pause, Turbo, Debug toggle), drag-and-drop handlers, file input change handlers, `setStatus()` function
    - Export: `initUI()`, `setStatus(msg)`
    - Import: `loadROM` from `../emulator/wasm-loader.js`, `loadTapeFile` from `../media/tape.js`, `saveZ80`/`loadZ80` from `../media/snapshot.js`, `initAudio` from `../audio/audio.js`, state getters/setters
    - `setStatus()` updates the status display element — keep it simple
    - **Started**: TBD
    - **Completed**: TBD
    - **Duration**: TBD
  - [ ] 5.4 Rewrite `src/main.js` as slim entry point
    - Replace the entire 1,316-line file with ~40 lines
    - Import all modules and call their init functions in order
    - Flow: `initWasm()` → `initScreen()` → `attachKeyboardHandlers()` → `initVirtualKeyboard()` → `initJoystick()` → `initCube()` → `initUI()` → `startFrameLoop()`
    - No business logic — just wiring
    - **Started**: TBD
    - **Completed**: TBD
    - **Duration**: TBD
  - [ ] 5.5 Update `src/index.html`
    - Remove all 6 `<script>` tags (Three.js CDN + main.js + debug-view.js + cube.js + vkeyboard.js + joystick.js)
    - Add single `<script type="module" src="main.js"></script>`
    - Keep all HTML structure and inline CSS unchanged
    - **Started**: TBD
    - **Completed**: TBD
    - **Duration**: TBD
  - [ ] 5.6 Full integration verification
    - Run `npm run dev` — confirm Vite dev server starts
    - Test: emulator boots, keyboard input works, virtual keyboard works
    - Test: load a .tap file (drag-drop or file input)
    - Test: audio plays (beeper sounds)
    - Test: 3D cube toggle works
    - Test: debug memory view toggle works
    - Test: snapshot save/load (.z80 format)
    - Test: joystick in fullscreen mode
    - Test: turbo mode toggle
    - Test: pause/resume
    - Test: reset
    - Run `npm run build` — confirm `dist/` is produced
    - Run `npx vite preview --port 8080` — confirm built site works
    - **Started**: TBD
    - **Completed**: TBD
    - **Duration**: TBD
  - [ ] 5.7 Create phase completion summary
    - Create `docs/tasks/TASK-5.0-CORE-MODULES-ENTRY-POINT-COMPLETION-SUMMARY.md`
    - **Started**: TBD
    - **Completed**: TBD
    - **Duration**: TBD

---

### Phase 6: Clean Up Old Files

**Status**: Not Started
**Progress**: 0/4 tasks complete (0%)
**Phase Started**: TBD
**Phase Completed**: TBD

- [ ] 6.0 Remove old files that have been moved or are now in public/
  - **Relevant Documentation:**
    - `docs/features/project-restructure/design.md` - New folder structure
    - `CLAUDE.md` - Project structure
  - **Parallel Group A** (all deletions are independent):
    - [ ] 6.1 Remove old flat JS files from `src/`
      - Delete `src/vkeyboard.js` (moved to `src/input/vkeyboard.js`)
      - Delete `src/joystick.js` (moved to `src/input/joystick.js`)
      - Delete `src/cube.js` (moved to `src/video/cube.js`)
      - Delete `src/debug-view.js` (moved to `src/debug/debug-view.js`)
      - Delete `src/audio-worklet.js` (now only in `public/`)
      - **Started**: TBD
      - **Completed**: TBD
      - **Duration**: TBD
    - [ ] 6.2 Remove static assets from `src/` that are now in `public/`
      - Delete `src/48.rom` (now in `public/48.rom`)
      - Delete `src/hello.tap` (now in `public/hello.tap`)
      - Note: `src/spectrum.wasm` is already gitignored, no action needed
      - **Started**: TBD
      - **Completed**: TBD
      - **Duration**: TBD
  - [ ] 6.3 Verify app still works after cleanup
    - Run `npm run dev` and confirm full functionality
    - **Started**: TBD
    - **Completed**: TBD
    - **Duration**: TBD
  - [ ] 6.4 Create phase completion summary
    - Create `docs/tasks/TASK-6.0-FILE-CLEANUP-COMPLETION-SUMMARY.md`
    - **Started**: TBD
    - **Completed**: TBD
    - **Duration**: TBD

---

### Phase 7: Assembler Reorganization

**Status**: Not Started
**Progress**: 0/5 tasks complete (0%)
**Phase Started**: TBD
**Phase Completed**: TBD

- [ ] 7.0 Move assembler toolchain from tools/ to packages/assembler/
  - **Relevant Documentation:**
    - `docs/features/project-restructure/design.md` - Assembler reorganization spec
    - `CLAUDE.md` - Assembler CLI usage
    - `tools/z80asm/docs/CLAUDE.md` - Assembler module overview, data flow
    - `docs/features/z80-assembler/design.md` - Assembler feature design
  - [ ] 7.1 Create `packages/assembler/` directory
    - Create `packages/` and `packages/assembler/` directories
    - **Started**: TBD
    - **Completed**: TBD
    - **Duration**: TBD
  - [ ] 7.2 Move assembler files
    - Move `tools/z80asm/assembler.js` → `packages/assembler/assembler.js`
    - Move `tools/z80asm/parser.js` → `packages/assembler/parser.js`
    - Move `tools/z80asm/encoder.js` → `packages/assembler/encoder.js`
    - Move `tools/z80asm/opcodes.js` → `packages/assembler/opcodes.js`
    - Move `tools/z80asm/expressions.js` → `packages/assembler/expressions.js`
    - Move `tools/z80asm/tap.js` → `packages/assembler/tap.js`
    - Move `tools/z80asm/docs/CLAUDE.md` → `packages/assembler/docs/CLAUDE.md`
    - Move `tools/z80asm.js` → `packages/assembler/cli.js`
    - Update `require()` paths in `cli.js`: change `./z80asm/assembler` → `./assembler`, `./z80asm/tap` → `./tap`
    - Internal module require() paths (assembler→parser, encoder→opcodes, etc.) use `./` already so they don't change
    - **Started**: TBD
    - **Completed**: TBD
    - **Duration**: TBD
  - [ ] 7.3 Update `package.json` asm script
    - Change `"asm"` script from `"node tools/z80asm.js"` to `"node packages/assembler/cli.js"`
    - **Started**: TBD
    - **Completed**: TBD
    - **Duration**: TBD
  - [ ] 7.4 Verify assembler works
    - Run `node packages/assembler/cli.js examples/hello.asm -o test.tap`
    - Confirm TAP file is generated correctly
    - Clean up test.tap
    - **Started**: TBD
    - **Completed**: TBD
    - **Duration**: TBD
  - [ ] 7.5 Create phase completion summary
    - Create `docs/tasks/TASK-7.0-ASSEMBLER-REORGANIZATION-COMPLETION-SUMMARY.md`
    - **Started**: TBD
    - **Completed**: TBD
    - **Duration**: TBD

---

### Phase 8: CI Pipeline + Documentation Updates

**Status**: Not Started
**Progress**: 0/6 tasks complete (0%)
**Phase Started**: TBD
**Phase Completed**: TBD

- [ ] 8.0 Update CI pipeline for Vite build
  - **Relevant Documentation:**
    - `docs/features/project-restructure/design.md` - CI pipeline update spec
    - `CLAUDE.md` - Build commands
    - `docs/setup.md` - Dev workflow
    - `docs/architecture.md` - Build pipeline
  - [ ] 8.1 Update `.github/workflows/deploy.yml`
    - Change `run: npm run build` to build both WASM and Vite (the updated `npm run build` script does this)
    - Change `path: src/` to `path: dist/` in the upload-pages-artifact step
    - **Started**: TBD
    - **Completed**: TBD
    - **Duration**: TBD
  - [ ] 8.2 Update `CLAUDE.md` (root)
    - Update Quick Reference build commands
    - Update Project Structure section with new folder tree
    - Update Architecture Overview to mention Vite + ES modules
    - Update Key Conventions (add "ES modules", "Vite bundler")
    - Update Deeper Documentation paths (assembler moved to packages/)
    - **Started**: TBD
    - **Completed**: TBD
    - **Duration**: TBD
  - **Parallel Group A** (after 8.2 — these doc updates are independent of each other):
    - [ ] 8.3 Update `docs/architecture.md`
      - Update JS frontend section to describe ES module system
      - Update build pipeline description (Vite, public/, dist/)
      - Update module list and their locations
      - Remove references to script tag load ordering and globals
      - **Started**: TBD
      - **Completed**: TBD
      - **Duration**: TBD
    - [ ] 8.4 Update `docs/setup.md`
      - Update build instructions: `npm run dev` replaces `npm run serve`
      - Mention Vite as a dev dependency
      - Update any file path references
      - **Started**: TBD
      - **Completed**: TBD
      - **Duration**: TBD
    - [ ] 8.5 Update `src/docs/CLAUDE.md` and `src/docs/architecture.md`
      - Rewrite module list to reflect new subdirectory structure
      - Update import graph (replace globals description with ES module imports)
      - Update audio worklet path references
      - Update all file path references throughout both files
      - **Started**: TBD
      - **Completed**: TBD
      - **Duration**: TBD
  - [ ] 8.6 Update remaining documentation
    - Update `assembly/docs/CLAUDE.md` — WASM build output path references (now `public/spectrum.wasm`)
    - Update `packages/assembler/docs/CLAUDE.md` — update paths to reflect new location
    - Update `README.md` — project structure, build commands
    - Scan `docs/features/*/design.md` and `docs/features/*/tasks.md` for any path references that need updating
    - **Started**: TBD
    - **Completed**: TBD
    - **Duration**: TBD

---

### Phase 9: Version Bump + Final Verification

**Status**: Not Started
**Progress**: 0/4 tasks complete (0%)
**Phase Started**: TBD
**Phase Completed**: TBD

- [ ] 9.0 Bump version and run final end-to-end verification
  - **Relevant Documentation:**
    - `docs/features/project-restructure/design.md` - Success metrics, verification steps
    - `CLAUDE.md` - Version sync convention
  - [ ] 9.1 Bump version to 1.0.19
    - Update `package.json` version field
    - Update `src/index.html` version div (`<div id="version">v1.0.19</div>`)
    - **Started**: TBD
    - **Completed**: TBD
    - **Duration**: TBD
  - [ ] 9.2 Full end-to-end verification
    - `npm run dev` — Vite dev server starts, emulator fully functional
    - `npm run build` — produces `dist/` with all static assets
    - `npx vite preview --port 8080` — built site serves correctly
    - `node packages/assembler/cli.js examples/hello.asm -o test.tap` — assembler works
    - Test all features: keyboard, virtual keyboard, joystick, tape loading (TAP/TZX/ZIP), snapshot save/load, audio, 3D cube, debug view, turbo mode, pause/resume, reset
    - Verify no `window.wasm`, `window.specKeyDown`, `window.specKeyUp`, or `window.debugView` globals exist in source
    - Verify no file in src/ exceeds ~400 lines
    - Clean up test.tap
    - **Started**: TBD
    - **Completed**: TBD
    - **Duration**: TBD
  - [ ] 9.3 Remove empty `tools/` directory
    - Delete `tools/z80asm/` directory and `tools/` directory (now empty after assembler moved)
    - **Started**: TBD
    - **Completed**: TBD
    - **Duration**: TBD
  - [ ] 9.4 Create phase completion summary
    - Create `docs/tasks/TASK-9.0-FINAL-VERIFICATION-COMPLETION-SUMMARY.md`
    - Include: full list of changes, verification results, before/after module count and sizes
    - **Started**: TBD
    - **Completed**: TBD
    - **Duration**: TBD
