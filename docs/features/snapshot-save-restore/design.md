# Snapshot Save/Restore — Design Document

## 1. Introduction / Overview

Add the ability to save and restore the complete emulator state using the industry-standard `.z80` snapshot file format. This lets users freeze the machine at any point, download a `.z80` file, and restore it later — or load snapshots created by other ZX Spectrum emulators (Fuse, ZXSpin, etc.).

The saved state includes 48 KB of RAM, all Z80 CPU registers (including shadow registers), interrupt state, and border colour.

## 2. Goals

1. Save complete machine state (RAM + CPU registers + interrupt/border) to a downloadable `.z80` file.
2. Load `.z80` snapshot files (versions 1, 2, and 3) to restore machine state.
3. Use the standard `.z80` format for interoperability with other emulators.
4. Add Save State / Load State toolbar buttons to the UI.

## 3. User Stories

- **As a user**, I want to save the current state of the emulator to a file so I can resume later.
- **As a user**, I want to load a `.z80` snapshot file from my computer (or from another emulator) and have the machine jump to that exact state.
- **As a developer**, I want the save format to be compatible with other emulators so users can bring their existing snapshot libraries.

## 4. Functional Requirements

### 4.1 WASM Exports (`assembly/index.ts`)

New exported getter functions are needed for registers not currently exposed:

| # | Function | Returns | Purpose |
|---|----------|---------|---------|
| 1 | `getR(): u8` | R register | Refresh counter (7 bits meaningful) |
| 2 | `getIFF2(): u8` | IFF2 flag | Second interrupt flip-flop (0 or 1) |
| 3 | `getHalted(): u8` | halted flag | Whether CPU is in HALT state (0 or 1) |
| 4 | `getA2(): u8` | A' register | Shadow accumulator |
| 5 | `getF2(): u8` | F' register | Shadow flags |
| 6 | `getBC_prime(): u16` | BC' register | Shadow BC pair |
| 7 | `getDE_prime(): u16` | DE' register | Shadow DE pair |
| 8 | `getHL_prime(): u16` | HL' register | Shadow HL pair |

New exported setter functions needed to restore state:

| # | Function | Purpose |
|---|----------|---------|
| 9 | `setPC(v: u16)` | Set program counter |
| 10 | `setSP(v: u16)` | Set stack pointer |
| 11 | `setA(v: u8)` | Set accumulator |
| 12 | `setF(v: u8)` | Set flags |
| 13 | `setBC(v: u16)` | Set BC pair |
| 14 | `setDE(v: u16)` | Set DE pair |
| 15 | `setHL(v: u16)` | Set HL pair |
| 16 | `setIX(v: u16)` | Set IX index register |
| 17 | `setIY(v: u16)` | Set IY index register |
| 18 | `setI(v: u8)` | Set interrupt vector register |
| 19 | `setR(v: u8)` | Set refresh register |
| 20 | `setIM(v: u8)` | Set interrupt mode (0, 1, or 2) |
| 21 | `setIFF1(v: u8)` | Set interrupt flip-flop 1 |
| 22 | `setIFF2(v: u8)` | Set interrupt flip-flop 2 |
| 23 | `setHalted(v: u8)` | Set halted state |
| 24 | `setA2(v: u8)` | Set shadow accumulator |
| 25 | `setF2(v: u8)` | Set shadow flags |
| 26 | `setBC_prime(v: u16)` | Set shadow BC pair |
| 27 | `setDE_prime(v: u16)` | Set shadow DE pair |
| 28 | `setHL_prime(v: u16)` | Set shadow HL pair |
| 29 | `setBorderColor(v: u8)` | Set border colour (0-7) |

Existing exports already sufficient:
- `readMem(addr)` — read RAM byte-by-byte for saving
- `writeRAM(addr, val)` — write RAM byte-by-byte for restoring
- `getBorderColor()` — read current border colour
- `init()` — reset machine state before restore
- `setRomByte(addr, val)` — re-load ROM after init

### 4.2 .z80 File Format — Saving (v3)

The `.z80` format version 3 is used for saving because it avoids the end-marker ambiguity of v1 and uses explicit per-page data lengths.

**Main header (30 bytes):**

| Offset | Size | Field |
|--------|------|-------|
| 0 | 1 | A register |
| 1 | 1 | F register |
| 2 | 2 | BC register (LSB first) |
| 4 | 2 | HL register (LSB first) |
| 6 | 2 | PC — set to `0` to indicate v2/v3 format |
| 8 | 2 | SP register (LSB first) |
| 10 | 1 | I register |
| 11 | 1 | R register (bits 0-6) |
| 12 | 1 | Flags byte: bit 0 = R bit 7, bits 1-3 = border colour, bit 5 = compression flag (1) |
| 13 | 2 | DE register (LSB first) |
| 15 | 2 | BC' register (LSB first) |
| 17 | 2 | DE' register (LSB first) |
| 19 | 2 | HL' register (LSB first) |
| 21 | 1 | A' register |
| 22 | 1 | F' register |
| 23 | 2 | IY register (LSB first) |
| 25 | 2 | IX register (LSB first) |
| 27 | 1 | IFF1 (0=disabled, nonzero=enabled) |
| 28 | 1 | IFF2 |
| 29 | 1 | Bits 0-1: IM (0/1/2) |

**Extended header (56 bytes at offset 30):**

| Offset | Size | Field |
|--------|------|-------|
| 30 | 2 | Extended header length = 54 (LSB first) |
| 32 | 2 | PC register (LSB first) — the actual PC value |
| 34 | 1 | Hardware mode: `0` = 48K Spectrum |
| 35-85 | 51 | Remaining fields — set to 0 for 48K |

**Data pages (after extended header):**

Each 16 KB page has a 3-byte header followed by compressed data:

| Offset | Size | Field |
|--------|------|-------|
| 0 | 2 | Compressed data length (LSB first). If 0xFFFF, data is 16384 bytes uncompressed. |
| 2 | 1 | Page ID: `4` = 0x8000-0xBFFF, `5` = 0xC000-0xFFFF, `8` = 0x4000-0x7FFF |
| 3 | N | Compressed data |

**Compression scheme (ED ED RLE):**
- Most bytes are emitted literally
- `ED ED count byte` = repeat `byte` `count` times (count ≥ 1)
- A single `ED` in the source data that is NOT followed by another `ED` is emitted literally
- Two consecutive `ED` bytes in source data are encoded as `ED ED 02 ED`

Three pages are written for a 48K Spectrum: pages 8, 4, and 5 (in address order).

### 4.3 .z80 File Format — Loading (v1, v2, v3)

**Version detection:**
- Read bytes 6-7 (PC field). If nonzero → **v1** format.
- If PC=0: read bytes 30-31 (extended header length). If 23 → **v2**. If 54 or 55 → **v3**.

**v1 loading:**
- Read 30-byte header, extract all registers.
- Remaining bytes are compressed RAM (48 KB once decompressed).
- If byte 12 bit 5 = 1: data is compressed using ED ED scheme, terminated by `00 ED ED 00`.
- If byte 12 bit 5 = 0: data is 48 KB raw (49152 bytes).
- Decompressed data maps directly to Z80 addresses 0x4000-0xFFFF.

**v2/v3 loading:**
- Read 30-byte header (PC field is ignored; real PC is in extended header).
- Read extended header (length at offset 30-31, PC at offset 32-33, hardware mode at 34).
- Verify hardware mode is 48K compatible (mode 0, 1, or sometimes 3).
- Read data pages sequentially until EOF. Each page: 2 bytes length + 1 byte page ID + compressed data.
- Decompress each page and copy to the correct 16 KB address range based on page ID.
- Page ID mapping for 48K: `8` → 0x4000, `4` → 0x8000, `5` → 0xC000.

**Decompression (all versions):**
- Read bytes sequentially from compressed data.
- If current byte is `ED` and next byte is also `ED`: read count (byte 3) and value (byte 4), emit value × count times. Advance 4 bytes.
- Otherwise: emit byte literally. Advance 1 byte.

### 4.4 JS Implementation (`src/main.js`)

**`saveZ80()` function:**
1. Pause emulation (optional — atomic snapshot).
2. Read all registers via WASM getter functions.
3. Read 48 KB RAM: create `Uint8Array` view at WASM memory offset `0x104000`, length `0xC000`.
4. Build the 30-byte main header from register values.
5. Build the 56-byte extended header (with actual PC at offset 32).
6. Compress each 16 KB page using ED ED RLE.
7. Concatenate header + extended header + 3 compressed pages.
8. Trigger browser download as `snapshot.z80` using `Blob` + `URL.createObjectURL` + hidden `<a>` element.

**`loadZ80(data)` function:**
1. Detect .z80 version from header.
2. Parse header to extract all register values.
3. Decompress RAM pages.
4. Call `wasm.init()` to reset machine.
5. Re-load ROM via `wasm.setRomByte()` (using cached ROM data).
6. Write all registers via WASM setter functions.
7. Write 48 KB RAM via `wasm.writeRAM()` byte-by-byte.
8. Set border colour via `wasm.setBorderColor()`.

**File detection:**
- In the existing `handleFile()` function, detect `.z80` extension.
- Also detect by content: if file starts with a valid .z80 header signature (heuristic: bytes 10-12 contain plausible I, R, flags values).

### 4.5 UI (`src/index.html`)

Add a "Save" button to the toolbar, next to the existing Reset button.

The existing Load button and drag-drop already handle file input — `.z80` files will be detected and routed to `loadZ80()` alongside existing TAP/TZX/ZIP handling.

### 4.6 WASM Build Requirement

After adding new exports to `assembly/index.ts`, the WASM module must be rebuilt:
```bash
npm run build    # Recompiles AssemblyScript → spectrum.wasm
```

The built `spectrum.wasm` is checked into `src/` for GitHub Pages deployment.

## 5. Non-Goals (Out of Scope)

- No `.sna` snapshot format support (only `.z80`)
- No 128K Spectrum snapshot support (48K only)
- No auto-save, save slots, or quicksave
- No keyboard shortcuts for save/load (toolbar buttons only)
- No cloud storage or IndexedDB persistence

## 6. Design Considerations

### Register Naming
The existing WASM exports use a `2` suffix to mean "16-bit" (e.g., `getBC2()` returns primary BC as u16). The new shadow register exports use `_prime` suffix to avoid confusion (e.g., `getBC_prime()` returns BC').

### Memory Access Performance
Saving RAM: Use a direct `Uint8Array` view into WASM linear memory for bulk read (fast, no per-byte function call overhead).
Restoring RAM: Use `writeRAM()` per byte since it handles ROM protection correctly (addresses < 0x4000 are ignored).

### File Size
- Uncompressed: 30 + 56 + 3×(3 + 16384) = 49237 bytes (~48 KB)
- Compressed (typical game): ~15-30 KB depending on RAM content
- Compressed (empty RAM): ~200 bytes

## 7. Technical Considerations

### Files to Modify

| File | Changes |
|------|---------|
| `assembly/index.ts` | Add ~21 new exported functions (8 getters + 29 setters, minus existing) |
| `src/main.js` | Add `saveZ80()`, `loadZ80()`, `.z80` detection in file handler |
| `src/index.html` | Add Save button to toolbar |

### Dependencies
- No new dependencies. Uses only browser APIs (`Blob`, `URL.createObjectURL`, `FileReader`).

### Build
- Must run `npm run build` after modifying `assembly/index.ts` to recompile WASM.
- The updated `src/spectrum.wasm` must be committed for GitHub Pages.

## 8. Success Metrics

- Save produces a valid `.z80` v3 file that other emulators (e.g., Fuse) can load.
- Load correctly restores `.z80` snapshots from other emulators.
- Round-trip test: save state → load state → machine continues identically.
- Save/Load buttons visible and functional in the UI.

## 9. Open Questions

1. Should the save filename include a timestamp (e.g., `snapshot-2026-03-20-1230.z80`) or just `snapshot.z80`?
2. Should loading a `.z80` file auto-pause the emulator first, or just replace state mid-frame?
3. Should we validate the hardware mode byte when loading and warn/reject 128K snapshots?
