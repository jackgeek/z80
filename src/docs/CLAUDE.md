# src/ — Frontend

The `src/` directory is the complete deployable website. It contains vanilla JavaScript modules, the HTML page, the compiled WASM binary, and the Spectrum ROM.

## Modules

### main.js (~1100 lines)
The central controller. Handles:
- WASM instantiation and shared memory setup
- Keyboard event handling (maps PC keys to Spectrum 8×5 matrix)
- Frame loop (`requestAnimationFrame` throttled to 50 Hz)
- Screen rendering (copies WASM screen buffer to canvas via `ImageData`)
- Audio pipeline (reads WASM audio buffer → high-pass filter → Web Audio)
- File loading (drag-and-drop + file picker, parses TAP/TZX/ZIP/.z80 formats)
- Snapshot save/restore (`.z80` v1/v2/v3 format — save as v3, load all versions)
- Reset, pause, and Save State controls

*Updated: 2026-03-20 - Added .z80 snapshot save/restore support*

### joystick.js (231 lines)
Fullscreen mode and touch joystick overlay:
- Enters/exits fullscreen via Fullscreen API
- Shows a virtual D-pad (left 50% of screen) and fire button (right 50%) in fullscreen
- Supports three joystick types: Kempston (port 0x1F), Sinclair 1 (key row 4), Cursor (key rows 3/4)
- Uses `ResizeObserver` for reliable fullscreen canvas resizing (avoids iOS viewport bugs)
- 8-directional D-pad with 0.3 deadzone threshold

### vkeyboard.js (408 lines)
Faithful ZX Spectrum keyboard replica:
- Dynamically generates DOM from key data arrays (4 rows matching the real layout)
- Each key stores its matrix position (row + bit) and labels (main, symbol shift, BASIC keyword, extended mode)
- Latching modifiers: tapping Caps Shift or Symbol Shift latches them; the next key press auto-releases
- Touch-friendly: 44px keys on mobile, 56px on desktop
- Rainbow stripe decoration on the right edge

### cube.js (109 lines)
Three.js 3D cube visualization (loaded from CDN):
- Creates a 512×512 texture canvas showing the Spectrum screen with border color
- Applies the texture to all 6 faces of a rotating cube
- Updates texture every frame from the main screen canvas
- Toggle on/off via checkbox in the UI

## Key Integration Points

- **WASM memory**: `main.js` creates the `WebAssembly.Memory` (256 pages / 16 MB) and shares it with all modules
- **Keyboard state**: `main.js` maintains `keyState[8]` and calls `wasm.setKeyRow()` each frame
- **Joystick → keyboard**: `joystick.js` writes to the same `keyState` array or calls `wasm.setKempston()` directly
- **Virtual keyboard → keyboard**: `vkeyboard.js` calls back into `main.js` key handlers
- **Cube → screen**: `cube.js` reads the main `<canvas>` element to create its texture

## File Formats

| Format | Detection | Handling |
|--------|-----------|----------|
| `.tap` | Extension or magic bytes | Direct: 2-byte length + data blocks, written to WASM tape buffer |
| `.tzx` | Extension + `ZXTape!` header | Converted to TAP on-the-fly (extracts data blocks from block types 0x10, 0x11, 0x14) |
| `.zip` | Extension + PK header | Decompressed via `DecompressionStream`, first .tap/.tzx extracted |
| `.rom` | Exactly 16,384 bytes | Written directly to ROM area in WASM memory |
| `.z80` | Extension | Snapshot: restores full CPU state + 48 KB RAM (supports v1, v2, v3) |

*Updated: 2026-03-20 - Added .z80 snapshot format*
