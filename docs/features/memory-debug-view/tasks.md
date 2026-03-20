# Tasks for memory-debug-view

## Tasks

### Phase 1: WebGL Debug Renderer & HTML Structure

**Status**: Not Started
**Progress**: 0/7 tasks complete (0%)
**Phase Started**: TBD
**Phase Completed**: TBD

- [ ] 1.0 Create the WebGL debug renderer module and HTML structure
  - **Relevant Documentation:**
    - `docs/features/memory-debug-view/design.md` — Full feature requirements, technical design, WASM memory offsets
    - `src/docs/CLAUDE.md` — Frontend module overview, integration points, module patterns
    - `src/docs/architecture.md` — WASM memory layout, screen rendering pipeline, frame loop structure
    - `assembly/docs/CLAUDE.md` — Z80 core overview, memory access functions
    - `assembly/docs/architecture.md` — CPU pipeline, memory layout (MEM_BASE offsets)
    - `docs/architecture.md` — System-wide architecture, WASM/JS boundary
    - `CLAUDE.md` — Project conventions (vanilla JS, no frameworks, no bundler)
  - [ ] 1.1 Add debug HTML elements to `src/index.html`
    - Add a "Debug" checkbox in the controls toolbar, following the pattern of `#cube-toggle-label` and `#turbo-toggle-label` (around line 440):
      ```html
      <label id="debug-toggle-label">
        <input type="checkbox" id="debug-toggle"> Debug
      </label>
      ```
    - Add a `#debug-container` div after the `#main-area` closing `</div>` (around line 453) but before `#fs-exit-btn`. This container is hidden by default:
      ```html
      <div id="debug-container" style="display:none;">
        <div id="debug-canvas-wrap">
          <canvas id="debug-canvas" width="256" height="256"></canvas>
        </div>
        <div id="debug-controls">
          <label>Zoom: <input type="range" id="debug-zoom" min="1" max="8" value="1" step="1"> <span id="debug-zoom-label">1×</span></label>
        </div>
        <div id="debug-info">
          <span id="debug-addr">—</span>
          <span id="debug-value">—</span>
          <span id="debug-region">—</span>
          <input type="text" id="debug-edit" maxlength="2" size="2" disabled placeholder="--">
        </div>
      </div>
      ```
    - Add CSS styles for the debug container: dark background (`#1a1a2e`), centered, `max-width: 100%`, canvas with `image-rendering: pixelated` and subtle border (`1px solid #333`). The `#debug-canvas-wrap` needs `overflow: auto` and a `max-height` (e.g., `600px`) so scrollbars appear when zoomed. Style the info panel as a single row with `display: flex`, `gap: 12px`, `align-items: center`, monospace font, light text color.
    - Add a `<script src="debug-view.js"></script>` tag after `main.js` (around line 459).
    - **Started**: TBD
    - **Completed**: TBD
    - **Duration**: TBD
  - [ ] 1.2 Create `src/debug-view.js` — WebGL setup and render function
    - Create a new file `src/debug-view.js`. This module follows the same pattern as `cube.js` — it reads global variables set by `main.js` and exposes a global `debugView` object.
    - Define constants: `const MEM_BASE = 0x100000;` and `const MEM_SIZE = 65536;` (full 64KB address space, 256×256 pixels).
    - **WebGL initialization** (called once from `main.js` after WASM loads):
      - Get `#debug-canvas` element and create a WebGL context: `canvas.getContext('webgl', { antialias: false, depth: false, stencil: false, alpha: false })`.
      - Create a fullscreen quad with vertices `[-1,-1, 1,-1, -1,1, 1,1]` — same pattern as `src/main.js` line 725.
      - Create vertex shader: map clip-space coords to UV coords (`uv = vec2(p.x*0.5+0.5, 0.5-p.y*0.5)`).
      - Create fragment shader: sample `LUMINANCE` texture (`gl_FragColor = texture2D(tex, uv)`).
      - Compile both shaders, link program, use program, set up vertex attribute pointer.
      - Create texture with `NEAREST` filtering (no interpolation) and `CLAMP_TO_EDGE` wrapping.
      - Allocate texture: `gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, 256, 256, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, null)`.
      - Set viewport: `gl.viewport(0, 0, 256, 256)`.
    - **Canvas 2D fallback**: If WebGL context creation fails, fall back to Canvas 2D:
      - Get 2D context, create an `ImageData(256, 256)`.
      - On each render, loop through 65536 bytes, set each pixel to `(val, val, val, 255)` in the ImageData.
      - This is slower but ensures the feature works on all browsers.
    - **Render function** `debugView.render(memoryBuffer)`:
      - Create a `Uint8Array` view: `new Uint8Array(memoryBuffer, MEM_BASE, MEM_SIZE)`.
      - Cache this view (only recreate if `memoryBuffer` changes — WASM memory buffer is fixed-size so this should be stable).
      - WebGL path: `gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 256, 256, gl.LUMINANCE, gl.UNSIGNED_BYTE, memView)` then `gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)`.
      - Canvas 2D path: iterate 65536 bytes, write RGBA to ImageData, then `ctx.putImageData(...)`.
    - Expose `window.debugView = { init, render }` so `main.js` can call it.
    - **Started**: TBD
    - **Completed**: TBD
    - **Duration**: TBD
  - [ ] 1.3 Create `src/debug-view.js` — zoom control
    - Add an event listener on `#debug-zoom` (range input) for the `input` event.
    - On change: read the slider value (1–8), update `#debug-zoom-label` text (e.g., "4×").
    - Apply CSS transform to `#debug-canvas`: `canvas.style.transform = 'scale(' + zoom + ')'` and `canvas.style.transformOrigin = 'top left'`.
    - The parent `#debug-canvas-wrap` already has `overflow: auto`, so scrollbars will appear when the scaled canvas exceeds the container size.
    - **Started**: TBD
    - **Completed**: TBD
    - **Duration**: TBD
  - [ ] 1.4 Create `src/debug-view.js` — click-to-inspect and memory editing
    - Add a `click` event listener on `#debug-canvas`.
    - **Coordinate calculation**: The canvas is 256×256 pixels but may be CSS-zoomed. To get the pixel coordinate:
      - Get the canvas bounding rect: `const rect = canvas.getBoundingClientRect()`.
      - Compute CSS-to-pixel ratio: `const scaleX = 256 / rect.width`, `const scaleY = 256 / rect.height`.
      - Pixel x = `Math.floor((event.clientX - rect.left) * scaleX)`, same for y.
      - Clamp x to [0, 255] and y to [0, 255].
    - Compute Z80 address: `const addr = y * 256 + x`.
    - Read current value: call `wasm.readMem(addr)` (passed in during init).
    - Update info panel:
      - `#debug-addr`: `'$' + addr.toString(16).toUpperCase().padStart(4, '0')`.
      - `#debug-value`: `'$' + val.toString(16).toUpperCase().padStart(2, '0') + ' (' + val + ')'`.
      - `#debug-region`: `addr < 0x4000 ? 'ROM (read-only)' : 'RAM'`.
    - **Edit input** (`#debug-edit`):
      - If address < 0x4000 (ROM): set input to `disabled`, clear value.
      - If address >= 0x4000 (RAM): enable input, set value to current hex string.
      - On `keydown` event with `Enter` key: parse hex value (`parseInt(input.value, 16)`), validate it's 0–255. If valid, call `wasm.writeRAM(addr, newVal)`. Then call `debugView.render()` to refresh the view. Also call `renderFrame()` (from main.js) if the address falls in the display area (0x4000–0x5AFF) so the main screen updates.
    - The click handler must check if the emulator is paused (a `paused` flag passed during init). If not paused, ignore the click (or show a "Pause to inspect" message in the info panel).
    - **Started**: TBD
    - **Completed**: TBD
    - **Duration**: TBD
  - [ ] 1.5 Integrate debug view into `src/main.js` frame loop
    - **Toggle wiring**: Add an event listener on `#debug-toggle` checkbox. On change:
      - Show/hide `#debug-container` by setting `style.display` to `'block'` or `'none'`.
      - Set a module-level boolean `debugVisible` to track state.
    - **Initialization**: After WASM is loaded and `wasm`/`memory` are available, call `debugView.init(memory, wasm)` passing the WASM memory object and the wasm exports object. The debug view needs `memory.buffer` for rendering and `wasm.readMem` / `wasm.writeRAM` for inspect/edit.
    - **Frame loop hook**: In the `frameLoop()` function, after `renderFrame()` and `pushAudioFrame()`, add:
      ```javascript
      if (debugVisible) debugView.render(memory.buffer);
      ```
      This must go inside the `try` block (around line 824 in current code), after `renderFrame()`.
    - **Also render on pause**: When the emulator is paused and the debug view is visible, ensure the debug view still shows the last frame's memory. Since `frameLoop()` returns early when `paused`, add a one-shot render when pausing: in the pause button handler, if `debugVisible`, call `debugView.render(memory.buffer)`.
    - **Pass paused state**: Either pass the `paused` variable reference to `debugView.init()`, or expose a `debugView.setPaused(paused)` method that main.js calls when the pause button is toggled.
    - **Pass renderFrame**: The debug view needs to call `renderFrame()` after a memory edit to update the main screen. Either expose `renderFrame` globally or pass it during init.
    - **Started**: TBD
    - **Completed**: TBD
    - **Duration**: TBD
  - [ ] 1.6 Update component documentation
    - Update `src/docs/CLAUDE.md` — add a section for `debug-view.js` describing what it does, following the pattern used for `cube.js`, `joystick.js`, and `vkeyboard.js`.
    - Update `src/docs/architecture.md` — add a "Memory Debug View" section explaining the WebGL LUMINANCE texture approach and integration with the frame loop.
    - **Started**: TBD
    - **Completed**: TBD
    - **Duration**: TBD
  - [ ] 1.7 Create phase completion summary
    - Create `docs/tasks/TASK-1.0-MEMORY-DEBUG-VIEW-COMPLETION-SUMMARY.md`
    - Include: files created/modified, WebGL approach used, any fallback behavior, testing done
    - **Started**: TBD
    - **Completed**: TBD
    - **Duration**: TBD

**Parallel Group A** (after 1.1 completes — HTML structure must exist before any JS work):
  - Sub-task 1.2 (WebGL setup & render) and 1.3 (zoom control) and 1.4 (click-to-inspect & editing) can all run in parallel since they are independent sections of `debug-view.js`. Each adds separate functions and event listeners that don't depend on each other.

**After Parallel Group A:**
  - Sub-task 1.5 (main.js integration) depends on 1.2, 1.3, 1.4 — it wires everything together.
  - Sub-tasks 1.6 and 1.7 run sequentially last.

### Phase 2: Version Bump & Final Polish

**Status**: Not Started
**Progress**: 0/2 tasks complete (0%)
**Phase Started**: TBD
**Phase Completed**: TBD

- [ ] 2.0 Version bump and final verification
  - **Relevant Documentation:**
    - `docs/features/memory-debug-view/design.md` — Success metrics and verification steps
    - `CLAUDE.md` — Project conventions, version sync requirement between package.json and src/index.html
    - `src/docs/CLAUDE.md` — Frontend module overview
  - [ ] 2.1 Bump patch version
    - Increment the patch version in both `package.json` and `src/index.html` (these must stay in sync per project conventions).
    - Find the current version in both files and increment the patch number (e.g., `1.2.3` → `1.2.4`).
    - **Started**: TBD
    - **Completed**: TBD
    - **Duration**: TBD
  - [ ] 2.2 Create phase completion summary
    - Create `docs/tasks/TASK-2.0-VERSION-BUMP-COMPLETION-SUMMARY.md`
    - Include: version bumped to, files modified
    - **Started**: TBD
    - **Completed**: TBD
    - **Duration**: TBD

**Parallelization note for Phase 2:** All sub-tasks are sequential — version bump must happen before the completion summary.

---

## Parallelization Notes

**Phase 1:** One parallel group:
- **Parallel Group A**: 1.2 (WebGL renderer), 1.3 (zoom), 1.4 (click/edit) — all write independent sections of `debug-view.js`
- After Group A: 1.5 (main.js integration), then 1.6 (docs), then 1.7 (summary)

**Phase 2:** Sequential — version bump then summary.

**Cross-phase dependencies:**
- Phase 2 depends on Phase 1 (all code must be complete before version bump)
