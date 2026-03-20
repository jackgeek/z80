# TASK 1.0 — Memory Debug View — Completion Summary

## What Was Implemented

A real-time memory debug view that visualizes the Z80's full 64 KB address space (0x0000–0xFFFF) as a 256×256 pixel grayscale heatmap, updated every emulator frame.

## Files Created

- `src/debug-view.js` — WebGL debug renderer module (~180 lines)

## Files Modified

- `src/index.html` — Added "Debug" checkbox, `#debug-container` with canvas/zoom/info panel, CSS styles, `<script>` tag
- `src/main.js` — Added `debugVisible` flag, debug toggle listener, `debugView.init()` call after WASM load, `debugView.render()` calls in frame loop (normal + turbo paths) and on pause
- `src/docs/CLAUDE.md` — Added debug-view.js module description
- `src/docs/architecture.md` — Added "Memory Debug View" section

## Key Design Decisions

- **WebGL LUMINANCE texture**: Single byte per pixel (~64 KB upload per frame) instead of RGBA (256 KB). GPU handles grayscale conversion.
- **Canvas 2D fallback**: For browsers without WebGL support, uses `putImageData()` with per-pixel loop.
- **CSS zoom**: `transform: scale(N)` on the canvas (1×–8×) with scrollable container. No canvas resize needed.
- **Conditional rendering**: Debug view only renders when `debugVisible` is true. Zero performance cost when hidden.
- **Click-to-inspect**: Only works when paused. Computes pixel coordinates accounting for CSS zoom via `getBoundingClientRect()`.
- **ROM protection**: Addresses < 0x4000 show "ROM (read-only)" and disable the edit input. `wasm.writeRAM()` already ignores ROM writes.

## Architecture

```
main.js frameLoop()
    │
    ├── renderFrame()          (main screen)
    ├── pushAudioFrame()       (audio)
    └── debugView.render()     (memory view, conditional)
            │
            └── texSubImage2D(LUMINANCE, memView)  → WebGL quad
```

The debug view has its own WebGL context, separate from the main screen renderer.
