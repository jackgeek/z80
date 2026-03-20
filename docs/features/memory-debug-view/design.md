# Design Document: Live Memory Debug View

## 1. Introduction / Overview

The ZX Spectrum emulator needs a live debugging tool that visualizes the Z80's entire 64KB address space as a real-time grayscale heatmap. This allows developers to observe memory changes as the emulator runs, inspect individual byte values when paused, and edit memory on the fly — all without leaving the browser.

**Problem it solves:** Currently there is no way to see what's happening in memory while the emulator runs. Developers debugging Z80 programs or understanding Spectrum behavior must rely on external tools. This feature brings memory inspection directly into the emulator UI.

## 2. Goals

1. Display all 65,536 bytes of the Z80 address space (0x0000–0xFFFF) as a 256×256 pixel grayscale image, updated every frame in real-time.
2. Allow zooming (1×–8×) so individual pixels/bytes are clearly visible and selectable.
3. When the emulator is paused, allow clicking any pixel to see its address and value in a fixed info panel below the canvas.
4. Allow editing the clicked byte's value (RAM addresses only; ROM is read-only).
5. Maintain emulator performance — no noticeable frame drops when the debug view is visible.
6. Toggle the entire debug view on/off via a checkbox, hidden by default.

## 3. User Stories

- **As a developer**, I want to see memory changing in real-time so I can understand what my Z80 program is writing to RAM.
- **As a developer**, I want to pause the emulator and click on a memory pixel to see the exact address and byte value.
- **As a developer**, I want to edit a byte in RAM while paused so I can test how the program reacts to different memory states.
- **As a developer**, I want to zoom in on the memory view so I can identify and click individual bytes in dense areas.
- **As a user**, I want the debug view hidden by default so it doesn't clutter the normal emulator experience.

## 4. Functional Requirements

### FR-1: Debug Toggle
- A "Debug" checkbox in the existing controls toolbar (following the pattern of `#cube-toggle` and `#turbo-toggle` in `src/index.html`).
- When unchecked (default): the debug container is hidden (`display: none`).
- When checked: the debug container appears at the bottom of the page.

### FR-2: Memory Canvas
- A `<canvas>` element, 256×256 pixels, rendered with WebGL.
- Each pixel represents one byte of the Z80's 64KB address space (0x0000–0xFFFF).
- Pixel mapping: pixel at (x, y) = address `y * 256 + x`.
- Grayscale: byte value 0x00 = black, 0xFF = white, linear interpolation.
- Updated every emulator frame (~50 Hz) when visible.
- The first 64 rows (addresses 0x0000–0x3FFF) represent ROM and will be static/unchanging.

### FR-3: Zoom Control
- A range slider (1× to 8×, default 1×) below the debug canvas.
- Zooming uses CSS `transform: scale(N)` with `transform-origin: top left`.
- The debug container has `overflow: auto` so scrollbars appear when the canvas exceeds the container.
- The current zoom level is displayed next to the slider (e.g., "Zoom: 4×").

### FR-4: Click-to-Inspect (Paused Only)
- When the emulator is paused and the debug view is visible, clicking a pixel in the canvas shows info in a fixed panel below the canvas.
- The info panel displays:
  - Address in hex (e.g., `$C000`)
  - Value in hex and decimal (e.g., `$3E (62)`)
  - Whether the address is ROM or RAM
- Click coordinates must account for CSS zoom and scroll offset.

### FR-5: Memory Editing (RAM Only)
- The info panel includes an editable input field pre-filled with the current byte value (hex).
- On submit (Enter key), the new value is written via `wasm.writeRAM(addr, val)`.
- ROM addresses (0x0000–0x3FFF): the input is disabled with a "ROM (read-only)" indicator.
- After editing, the debug view re-renders to reflect the change.
- The main screen also re-renders if the edit affects the display area (0x4000–0x5AFF).

### FR-6: Performance
- The debug view must not cause noticeable frame drops when visible.
- Only render the debug canvas when the debug toggle is checked.
- Use a single `texSubImage2D` call per frame to upload memory data to the GPU — no per-pixel JavaScript loops.

## 5. Non-Goals (Out of Scope)

- **Register view** — this feature is memory-only; CPU register inspection is not included.
- **Breakpoints / step debugging** — no execution control beyond the existing pause button.
- **Memory search / find** — no search-by-value functionality.
- **Color coding by type** — no color differentiation for screen memory vs. attributes vs. general RAM (all grayscale).
- **History / diff view** — no comparison between frames or undo of edits.

## 6. Design Considerations

### UI Layout
- The debug container sits below the main emulator content, full-width, centered.
- Dark background matching the page theme (`#1a1a2e`).
- The canvas has a subtle border to distinguish it from the page background.
- The info panel is a single row below the canvas: address | value | edit input | ROM/RAM indicator.

### Existing Patterns to Follow
- Toggle checkbox style matches `#cube-toggle-label` and `#turbo-toggle-label`.
- WebGL setup matches the main screen renderer pattern in `src/main.js` lines 719–769 (vertex shader, fragment shader, NEAREST filtering, texture upload).
- New functionality goes in a separate JS module (`src/debug-view.js`) loaded via `<script>` tag, consistent with `cube.js`, `vkeyboard.js`, `joystick.js`.

## 7. Technical Considerations

### WASM Memory Access
- The Z80's 64KB address space lives at WASM linear memory offset `MEM_BASE (0x100000)`.
- JS can create a zero-copy view: `new Uint8Array(memory.buffer, 0x100000, 65536)`.
- For single-byte read: `wasm.readMem(addr)` — used for the info panel display.
- For single-byte write: `wasm.writeRAM(addr, val)` — used for editing. This function already skips writes to ROM addresses (< 0x4000).

### WebGL Renderer
- Use `LUMINANCE` format for the texture — 1 byte per pixel instead of 4 (RGBA). The GPU maps the single value to all RGB channels, producing grayscale automatically.
- Canvas size: 256×256 pixels (fixed). Zoom is CSS-only.
- Separate WebGL context from the main screen to avoid state conflicts.
- Texture upload: `gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 256, 256, gl.LUMINANCE, gl.UNSIGNED_BYTE, memView)`.
- This is ~64 KB per frame upload — very fast for modern GPUs.

### Integration Points
- `src/main.js` `frameLoop()`: after `renderFrame()`, call `debugView.render(memory.buffer)` if debug is visible.
- `src/main.js` `paused` variable: passed to debug view so it knows when click-to-inspect is allowed.
- `src/main.js` `wasm` and `memory` objects: passed to debug view during initialization.

### Files to Create/Modify
| File | Action | Purpose |
|------|--------|---------|
| `src/debug-view.js` | Create | WebGL debug renderer module |
| `src/index.html` | Modify | Add debug checkbox, container, canvas, zoom slider, info panel, `<script>` tag |
| `src/main.js` | Modify | Initialize debug view, hook into frame loop, wire toggle checkbox |

## 8. Success Metrics

1. **Functional**: Memory pixels update visibly when the emulator is running (e.g., screen memory area flickers as the display renders).
2. **Inspection**: Clicking a pixel while paused shows the correct address and value (verified against `wasm.readMem()`).
3. **Editing**: Changing a value in the screen memory area (0x4000–0x5AFF) produces a visible change on the main Spectrum screen.
4. **Performance**: No visible frame stutter or FPS drop below 50 Hz with the debug view active (testable by eye or with browser DevTools performance tab).
5. **Toggle**: Debug view is completely hidden when unchecked — no performance cost when not in use.

## 9. Open Questions

None — all clarifications resolved during design.
