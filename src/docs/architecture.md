# Frontend Architecture

## WASM Integration

```javascript
const memory = new WebAssembly.Memory({ initial: 256, maximum: 256 });
const { instance } = await WebAssembly.instantiate(wasmBytes, { env: { memory, abort: () => {} } });
```

JS and WASM share the same memory buffer. JS reads/writes at known offsets:

| Offset | JS reads/writes | Purpose |
|--------|----------------|---------|
| `0x100000` | Write (ROM load) | Z80 address space — JS loads ROM here at startup |
| `0x110000` | Read | Screen buffer — WASM renders 256×192 RGBA pixels |
| `0x140000` | Write | TAP buffer — JS writes parsed tape data |
| `0x1C0000` | Read | Audio buffer — WASM writes 882 u8 beeper samples/frame |
| `0x200000` | Write | Pulse buffer — JS writes u32 T-state durations for TZX pulse playback |

## Audio pipeline

*Updated: 2026-03-19 (AudioWorklet path, u8 samples)*

```
WASM beeper samples (882 u8/frame at 44.1 kHz)
        │
        ▼
  Read from WASM memory as Uint8Array
        │
        ▼
  Converted to float (0.0 / 1.0)
        │
        ├─── AudioWorklet path (preferred) ──────────────────────┐
        │    Posted via MessagePort to BeeperProcessor           │
        │    running on dedicated audio thread                   │
        │    Applies HPF, outputs to speakers                    │
        │                                                        │
        ├─── ScriptProcessorNode fallback ───────────────────────┤
        │    Written to Float32Array ring buffer                 │
        │    (8192 entries, bitmask indexing)                     │
        │    Read by ScriptProcessorNode callback                │
        │    Applies HPF                                         │
        │                                                        │
        ▼                                                        │
  High-pass filter: y[n] = α·(y[n-1] + x[n] - x[n-1])  ◄───────┘
  α = 0.995 (~35 Hz cutoff, removes DC offset)
        │
        ▼
  Web Audio API → speakers
```

AudioWorklet runs on a dedicated audio thread, freeing the main thread from audio processing. Browsers without AudioWorklet support fall back to ScriptProcessorNode. Audio context is created on first user interaction (required by browser autoplay policies). On iOS, the context may auto-suspend and needs resuming on touch.

## Screen rendering

*Updated: 2026-03-19 (WebGL primary renderer)*

Primary: WebGL with `texSubImage2D` uploads the WASM screen buffer directly as a GPU texture, rendered via a fullscreen quad with `NEAREST` filtering for pixel-perfect scaling.

Fallback: Canvas 2D with `putImageData` for browsers without WebGL support:

```javascript
const src = new Uint8Array(memory.buffer, SCREEN_BASE, 256 * 192 * 4);
imageData.data.set(src);
ctx.putImageData(imageData, 0, 0);
```

Both paths cache the source `Uint8Array` view since WASM memory is fixed-size. The canvas is CSS-scaled to fill the available space. The optional 3D cube visualization also uses WebGL via Three.js.

## Frame Loop

```javascript
function frameLoop(timestamp) {
    requestAnimationFrame(frameLoop);
    if (timestamp - lastFrameTime < FRAME_INTERVAL * 0.9) return;  // throttle to ~50 FPS
    lastFrameTime = timestamp;

    // Push keyboard state to WASM
    for (let row = 0; row < 8; row++) wasm.setKeyRow(row, keyState[row]);

    wasm.frame();        // Execute one Z80 frame (69,888 T-cycles)
    renderFrame();       // Blit screen buffer to canvas
    pushAudioFrame();    // Queue audio samples
}
```

## Keyboard Mapping

The ZX Spectrum uses an 8-row × 5-column keyboard matrix. JS maps modern keyboard events to this matrix:

| Row | Bit 0 | Bit 1 | Bit 2 | Bit 3 | Bit 4 |
|-----|-------|-------|-------|-------|-------|
| 0 | Caps Shift | Z | X | C | V |
| 1 | A | S | D | F | G |
| 2 | Q | W | E | R | T |
| 3 | 1 | 2 | 3 | 4 | 5 |
| 4 | 0 | 9 | 8 | 7 | 6 |
| 5 | P | O | I | U | Y |
| 6 | Enter | L | K | J | H |
| 7 | Space | Sym Shift | M | N | B |

Special mappings: Shift → Caps Shift (row 0), Ctrl → Symbol Shift (row 7), Arrow keys → Caps Shift + 5/6/7/8.

## File Loading

### TAP Format
Simple sequential blocks: `[2-byte length][data...]` repeated. Written directly to the WASM tape buffer at offset 0x140000.

### TZX Format

*Updated: 2026-03-19 (pulse stream generation, content-based detection)*

Complex multi-block format. The loader extracts standard data blocks (types 0x10, 0x11, 0x14) and reassembles them into TAP format before writing to WASM memory. Other block types (pauses, text descriptions, etc.) are skipped. TZX files also generate a pulse stream (array of T-state durations) for accurate tape signal emulation via port 0xFE bit 6, supporting custom loaders like Speedlock.

### ZIP Format
Uses the browser's `DecompressionStream` API for deflate. Parses the ZIP local file headers to find the first `.tap` or `.tzx` file, decompresses it, then processes it as above.

### Content-based format detection
Files are auto-detected by magic bytes (`PK` header for ZIP, `ZXTape!` for TZX) when the file extension is missing or unrecognized. This is important for mobile where file pickers may strip extensions.

## Fullscreen & Joystick

Fullscreen mode (`joystick.js`):
- Uses `element.requestFullscreen()` / vendor prefixes
- Hides the virtual keyboard, shows the touch joystick overlay
- Canvas is letterboxed to maintain 4:3 aspect ratio
- `ResizeObserver` handles viewport changes (more reliable than `resize` events on iOS)

Touch joystick:
- Left half of screen: D-pad zone (8-directional, deadzone threshold 0.3)
- Right half: circular fire button
- Maps to selected joystick type (Kempston port or Spectrum key rows)

## 3D Cube (cube.js)

Optional visualization using Three.js (loaded from CDN):
- Creates a 512×512 off-screen canvas as a texture source
- Each frame: fills with border color, draws the scaled Spectrum screen centered, updates texture
- Cube rotates continuously on all 3 axes
- Toggle via checkbox; hidden by default on mobile
