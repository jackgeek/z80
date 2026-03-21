# src/ — Frontend

The `src/` directory contains the emulator's browser-side code, organized as ES modules in domain-specific subdirectories. Vite serves as the dev server and production bundler. Static assets (ROM, audio worklet, example files) live in `public/` and are served as-is.

## Modules

### main.js (~30 lines)
Entry point that imports and wires all modules together. Calls each subsystem's init function in sequence:
1. `initScreen()` — WebGL/Canvas2D setup
2. `attachKeyboardHandlers()` — physical keyboard
3. `initVirtualKeyboard()` — virtual ZX keyboard
4. `initJoystick()` — fullscreen + touch controls
5. `initCube()` — Three.js 3D cube
6. `initUI()` — buttons, drag-drop, file inputs
7. `initWasm()` — WASM loading, ROM fetch, frame loop start

### emulator/state.js
Shared emulator state module (replaces all globals). Exports mutable state that other modules import:
- WASM instance reference and memory buffer views
- Keyboard state array
- Emulator flags (paused, turbo, etc.)
- Canvas and rendering context references

### emulator/wasm-loader.js
WASM instantiation and ROM loading:
- Fetches and compiles `spectrum.wasm` from `public/`
- Creates `WebAssembly.Memory` (256 pages / 16 MB)
- Loads `48.rom` into WASM memory
- Stores WASM exports in shared state
- Kicks off the frame loop after initialization

### emulator/frame-loop.js
The main emulation loop:
- `requestAnimationFrame` throttled to ~50 FPS
- Pushes keyboard state to WASM each frame
- Calls `wasm.frame()` (69,888 T-cycles per frame)
- Triggers screen rendering and audio output
- Supports turbo mode for maximum emulation speed

### input/keyboard.js
Physical keyboard mapping and event handlers:
- Maps PC keys to the Spectrum 8x5 keyboard matrix
- Arrow keys mapped to Caps Shift + 5/6/7/8
- Shift = Caps Shift, Ctrl = Symbol Shift

### input/vkeyboard.js
Faithful ZX Spectrum keyboard replica:
- Dynamically generates DOM from key data arrays (4 rows matching the real layout)
- Each key stores its matrix position (row + bit) and labels (main, symbol shift, BASIC keyword, extended mode)
- Latching modifiers: tapping Caps Shift or Symbol Shift latches them; the next key press auto-releases
- Touch-friendly: 44px keys on mobile, 56px on desktop
- Rainbow stripe decoration on the right edge

### input/joystick.js
Fullscreen mode and touch joystick overlay:
- Enters/exits fullscreen via Fullscreen API
- Shows a virtual D-pad (left 50% of screen) and fire button (right 50%) in fullscreen
- Supports three joystick types: Kempston (port 0x1F), Sinclair 1 (key row 4), Cursor (key rows 3/4)
- Uses `ResizeObserver` for reliable fullscreen canvas resizing (avoids iOS viewport bugs)
- 8-directional D-pad with 0.3 deadzone threshold

### audio/audio.js
Audio pipeline setup:
- Creates AudioContext on first user interaction (browser autoplay policy)
- Sets up AudioWorklet with processor from `public/audio-worklet.js`
- Reads WASM audio buffer (882 i16 samples/frame at 44.1 kHz)
- High-pass filter for DC offset removal

### video/screen.js
Main display rendering:
- Copies WASM screen buffer to canvas via `ImageData`
- CSS-scaled to fill available space
- No WebGL for the main display

### video/cube.js
Three.js 3D cube visualization:
- Creates a 512x512 texture canvas showing the Spectrum screen with border color
- Applies the texture to all 6 faces of a rotating cube
- Updates texture every frame from the main screen canvas
- Toggle on/off via checkbox in the UI
- Three.js loaded via npm (not CDN)

### media/tape.js
File format parsing and tape loading:
- TAP: 2-byte length + data blocks, written to WASM tape buffer
- TZX: extracts standard data blocks (types 0x10, 0x11, 0x14), converts to TAP
- ZIP: decompressed via `DecompressionStream`, first .tap/.tzx extracted

### media/snapshot.js
.z80 snapshot save/restore:
- Saves as v3 format (30-byte header + 56-byte extended header + 3 compressed pages)
- Loads v1, v2, and v3 formats (auto-detected by header fields)
- ED ED RLE compression for page data
- Restores via WASM setter functions + `writeRAM()`

### debug/debug-view.js
Live memory debug view:
- Renders the full 64 KB Z80 address space (0x0000-0xFFFF) as a 256x256 grayscale heatmap
- WebGL LUMINANCE texture upload (~64 KB/frame) with Canvas 2D fallback
- Zoom slider (1x-8x) via CSS transform
- Click-to-inspect when paused: shows address, value (hex + decimal), ROM/RAM indicator
- Inline hex editor for RAM bytes (Enter to commit)
- Toggle on/off via "Debug" checkbox; hidden by default

### ui/ui.js
UI controller:
- Button handlers (reset, pause, save state, turbo)
- Drag-and-drop file loading
- File picker input
- Game library dropdown
- Wires UI events to emulator state and media loaders

## Key Integration Points

- **Shared state**: `emulator/state.js` exports mutable state that all modules import — no globals on `window`
- **WASM memory**: `emulator/wasm-loader.js` creates the `WebAssembly.Memory` (256 pages / 16 MB) and stores it in shared state
- **Keyboard state**: `input/keyboard.js` maintains `keyState[8]` in shared state; `emulator/frame-loop.js` pushes it to WASM each frame
- **Joystick -> keyboard**: `input/joystick.js` writes to the same `keyState` array or calls `wasm.setKempston()` directly
- **Virtual keyboard -> keyboard**: `input/vkeyboard.js` calls back into shared state key handlers
- **Cube -> screen**: `video/cube.js` reads the main `<canvas>` element to create its texture
- **Debug -> WASM memory**: `debug/debug-view.js` reads WASM linear memory at `MEM_BASE` (0x100000) directly; uses `wasm.readMem()` / `wasm.writeRAM()` for inspect/edit

## File Formats

| Format | Detection | Handling |
|--------|-----------|----------|
| `.tap` | Extension or magic bytes | Direct: 2-byte length + data blocks, written to WASM tape buffer |
| `.tzx` | Extension + `ZXTape!` header | Converted to TAP on-the-fly (extracts data blocks from block types 0x10, 0x11, 0x14) |
| `.zip` | Extension + PK header | Decompressed via `DecompressionStream`, first .tap/.tzx extracted |
| `.rom` | Exactly 16,384 bytes | Written directly to ROM area in WASM memory |
| `.z80` | Extension | Snapshot: restores full CPU state + 48 KB RAM (supports v1, v2, v3) |
