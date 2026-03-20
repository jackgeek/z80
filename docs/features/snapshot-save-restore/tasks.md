## Tasks

### Phase 1: WASM Register Exports

**Status**: Complete
**Progress**: 5/5 tasks complete (100%)
**Phase Started**: 2026-03-20 00:10:00 UTC+0
**Phase Completed**: 2026-03-20 00:15:00 UTC+0

- [ ] 1.0 Add missing getter and setter functions to the WASM core
  - **Relevant Documentation:**
    - `assembly/docs/CLAUDE.md` — Z80 core overview, instruction categories
    - `assembly/docs/architecture.md` — CPU pipeline, memory layout, register storage
    - `docs/features/snapshot-save-restore/design.md` — Full list of required exports (section 4.1)
    - `docs/architecture.md` — System-wide architecture, WASM/JS boundary
    - `CLAUDE.md` — Project conventions, build commands
  - [ ] 1.1 Add 8 missing getter functions to `assembly/index.ts`
    - Add these exported functions near the existing getter block (around line 1894):
      - `export function getR(): u8` — return `R_reg`
      - `export function getIFF2(): u8` — return `IFF2 ? 1 : 0`
      - `export function getHalted(): u8` — return `halted ? 1 : 0`
      - `export function getA2(): u8` — return `A2`
      - `export function getF2(): u8` — return `F2`
      - `export function getBC_prime(): u16` — return `(<u16>B2 << 8) | C2`
      - `export function getDE_prime(): u16` — return `(<u16>D2 << 8) | E2`
      - `export function getHL_prime(): u16` — return `(<u16>H2 << 8) | L2`
    - **Started**: TBD
    - **Completed**: TBD
    - **Duration**: TBD
  - [ ] 1.2 Add 21 setter functions to `assembly/index.ts`
    - Add these exported functions after the getters:
      - `setPC(v: u16)` — set `PC = v`
      - `setSP(v: u16)` — set `SP = v`
      - `setA(v: u8)` — set `A = v`
      - `setF(v: u8)` — set `F = v`
      - `setBC(v: u16)` — set `B = <u8>(v >> 8)`, `C = <u8>(v & 0xFF)`
      - `setDE(v: u16)` — set `D = <u8>(v >> 8)`, `E = <u8>(v & 0xFF)`
      - `setHL(v: u16)` — set `H = <u8>(v >> 8)`, `L = <u8>(v & 0xFF)`
      - `setIX(v: u16)` — set `IX = v`
      - `setIY(v: u16)` — set `IY = v`
      - `setI(v: u8)` — set `I_reg = v`
      - `setR(v: u8)` — set `R_reg = v`
      - `setIM(v: u8)` — set `IM = v`
      - `setIFF1(v: u8)` — set `IFF1 = v != 0`
      - `setIFF2(v: u8)` — set `IFF2 = v != 0`
      - `setHalted(v: u8)` — set `halted = v != 0`
      - `setA2(v: u8)` — set `A2 = v`
      - `setF2(v: u8)` — set `F2 = v`
      - `setBC_prime(v: u16)` — set `B2 = <u8>(v >> 8)`, `C2 = <u8>(v & 0xFF)`
      - `setDE_prime(v: u16)` — set `D2 = <u8>(v >> 8)`, `E2 = <u8>(v & 0xFF)`
      - `setHL_prime(v: u16)` — set `H2 = <u8>(v >> 8)`, `L2 = <u8>(v & 0xFF)`
      - `setBorderColor(v: u8)` — set `borderColor = v`
    - **Started**: TBD
    - **Completed**: TBD
    - **Duration**: TBD
  - [ ] 1.3 Rebuild WASM module
    - Run `npm run build` to recompile AssemblyScript → spectrum.wasm
    - Verify build succeeds with no errors
    - The updated `src/spectrum.wasm` will be committed later
    - **Started**: TBD
    - **Completed**: TBD
    - **Duration**: TBD
  - [ ] 1.4 Update component documentation
    - Update `assembly/docs/CLAUDE.md` — mention the new getter/setter exports for snapshot support
    - **Started**: TBD
    - **Completed**: TBD
    - **Duration**: TBD
  - [ ] 1.5 Create phase completion summary
    - Create `docs/tasks/TASK-1.0-WASM-REGISTER-EXPORTS-COMPLETION-SUMMARY.md`
    - Include: list of functions added, build status, any issues encountered
    - **Started**: TBD
    - **Completed**: TBD
    - **Duration**: TBD

**Parallelization note for Phase 1:** Sub-tasks 1.1 and 1.2 both modify the same file (`assembly/index.ts`) and are small enough to implement together. No parallelization is beneficial — they should be done sequentially in one editing session, followed by the build step.

---

### Phase 2: .z80 Format Save & Load

**Status**: Complete
**Progress**: 6/6 tasks complete (100%)
**Phase Started**: 2026-03-20 00:15:00 UTC+0
**Phase Completed**: 2026-03-20 00:22:00 UTC+0

- [ ] 2.0 Implement .z80 file saving (v3 format)
  - **Relevant Documentation:**
    - `src/docs/CLAUDE.md` — Frontend module overview, module relationships
    - `src/docs/architecture.md` — File formats, WASM integration, rendering pipeline
    - `docs/features/snapshot-save-restore/design.md` — .z80 v3 format spec (section 4.2), JS implementation (section 4.4)
    - `docs/architecture.md` — System-wide architecture, WASM/JS boundary
    - `CLAUDE.md` — Project conventions (vanilla JS, no frameworks)
  - **Parallel Group A** (2.1 and 3.1 are independent helper functions):
    - [ ] 2.1 Implement ED ED RLE compression helper function in `src/main.js`
      - Add `function compressZ80Page(data)` that takes a `Uint8Array` (16384 bytes) and returns a compressed `Uint8Array`
      - Compression rules per design doc section 4.2:
        - Scan input bytes sequentially
        - If a byte repeats 2+ times consecutively, emit `ED ED count byte` (max count 255, split if longer)
        - If byte is `ED` and NOT part of a repeat, emit as `ED ED 01 ED`
        - Otherwise emit the byte literally
      - Return the compressed data as a new `Uint8Array`
      - **Started**: TBD
      - **Completed**: TBD
      - **Duration**: TBD
    - [ ] 3.1 Implement ED ED RLE decompression helper function in `src/main.js`
      - Add `function decompressZ80(data, expectedLength)` that takes compressed `Uint8Array` and expected output length
      - Decompression rules per design doc section 4.3:
        - Read bytes sequentially from input
        - If current byte is `0xED` and next byte is also `0xED`: read count (byte 3) and value (byte 4), emit value × count times, advance input by 4
        - Otherwise: emit byte literally, advance input by 1
      - Return decompressed `Uint8Array`
      - For v1 format: also handle the `00 ED ED 00` end-of-data marker (stop decompression when encountered)
      - **Started**: TBD
      - **Completed**: TBD
      - **Duration**: TBD
  - [ ] 2.2 Implement `saveZ80()` function in `src/main.js` (after 2.1 completes)
    - Read all CPU registers via WASM getter functions (`wasm.getA()`, `wasm.getF()`, `wasm.getBC2()`, etc.)
    - Read 48 KB RAM: create `new Uint8Array(memory.buffer, 0x104000, 0xC000)` — this is a direct view, very fast
    - Build the 30-byte main header per design doc section 4.2:
      - Byte 6-7 (PC) = 0 to indicate v3 format
      - Byte 12: bit 0 = R bit 7, bits 1-3 = border colour, bit 5 = 1 (compressed)
    - Build the 56-byte extended header:
      - Bytes 30-31: extended header length = 54 (LSB first)
      - Bytes 32-33: actual PC value (LSB first)
      - Byte 34: hardware mode = 0 (48K)
      - Bytes 35-85: all zeros
    - Split RAM into 3 pages of 16 KB each:
      - Page 8: RAM bytes 0x0000-0x3FFF (Z80 address 0x4000-0x7FFF)
      - Page 4: RAM bytes 0x4000-0x7FFF (Z80 address 0x8000-0xBFFF)
      - Page 5: RAM bytes 0x8000-0xBFFF (Z80 address 0xC000-0xFFFF)
    - Compress each page using `compressZ80Page()`
    - For each page, prepend 3-byte header: [compressed_length_lo, compressed_length_hi, page_id]
    - Concatenate: main header + extended header + 3 page blocks
    - Trigger download: create `Blob`, `URL.createObjectURL`, click hidden `<a>` element, revoke URL
    - Use filename `snapshot.z80`
    - **Started**: TBD
    - **Completed**: TBD
    - **Duration**: TBD

- [ ] 3.0 Implement .z80 file loading (v1, v2, v3 formats)
  - **Relevant Documentation:**
    - `src/docs/CLAUDE.md` — Frontend module overview, module relationships
    - `src/docs/architecture.md` — File formats, TAP/TZX loading pipeline, WASM integration
    - `docs/features/snapshot-save-restore/design.md` — .z80 loading spec (section 4.3), JS implementation (section 4.4)
    - `docs/architecture.md` — System-wide architecture, WASM/JS boundary
    - `CLAUDE.md` — Project conventions
  - **Parallel Group B** (after Parallel Group A completes — 2.2 and 3.2 are independent save/load functions):
    - [ ] 2.2 (listed above under 2.0)
    - [ ] 3.2 Implement `loadZ80(data)` function in `src/main.js`
      - Accept `Uint8Array` of the full .z80 file
      - **Version detection**: read bytes 6-7 (PC). If nonzero → v1. If zero → read bytes 30-31 for extended header length: 23 = v2, 54/55 = v3
      - **Parse 30-byte header**: extract A, F, BC, HL, SP, I, R (including bit 7 from byte 12), DE, BC', DE', HL', A', F', IY, IX, IFF1, IFF2, IM, border colour (byte 12 bits 1-3)
      - **v1 loading**: remaining bytes after header are compressed RAM (or raw if byte 12 bit 5 = 0). Decompress to 49152 bytes → maps to Z80 addresses 0x4000-0xFFFF
      - **v2/v3 loading**: read extended header to get real PC and hardware mode. Read data pages until EOF: each page = 2 bytes length + 1 byte page ID + compressed data. Decompress each page (16384 bytes). Map page ID to address: 8→0x4000, 4→0x8000, 5→0xC000
      - **Restore state**:
        1. Call `wasm.init()` to reset
        2. Re-load ROM from `cachedRomData` via `wasm.setRomByte()` loop
        3. Set all registers via setter functions (setPC, setSP, setA, setF, setBC, setDE, setHL, setIX, setIY, setI, setR, setIM, setIFF1, setIFF2, setHalted, setA2, setF2, setBC_prime, setDE_prime, setHL_prime)
        4. Write 48 KB RAM via `wasm.writeRAM(addr, byte)` loop for addresses 0x4000-0xFFFF
        5. Set border via `wasm.setBorderColor()`
      - **Started**: TBD
      - **Completed**: TBD
      - **Duration**: TBD
  - [ ] 3.3 Integrate .z80 detection into existing file handler in `src/main.js` (after 3.2 completes)
    - Find the existing `handleFile()` or file-loading function that detects TAP/TZX/ZIP
    - Add `.z80` extension detection: if filename ends in `.z80`, call `loadZ80(data)`
    - This makes .z80 files work with the existing Load button and drag-drop
    - **Started**: TBD
    - **Completed**: TBD
    - **Duration**: TBD
  - [ ] 3.4 Update component documentation
    - Update `src/docs/CLAUDE.md` — mention .z80 save/load capability
    - Update `src/docs/architecture.md` — add .z80 format to the file formats section
    - **Started**: TBD
    - **Completed**: TBD
    - **Duration**: TBD
  - [ ] 3.5 Create phase completion summary
    - Create `docs/tasks/TASK-2.0-Z80-FORMAT-SAVE-LOAD-COMPLETION-SUMMARY.md`
    - Include: what was implemented, format versions supported, compression details
    - **Started**: TBD
    - **Completed**: TBD
    - **Duration**: TBD

---

### Phase 3: UI Integration & Testing

**Status**: Complete
**Progress**: 5/5 tasks complete (100%)
**Phase Started**: 2026-03-20 00:22:00 UTC+0
**Phase Completed**: 2026-03-20 00:24:14 UTC+0

- [ ] 4.0 Add Save button to UI and verify end-to-end
  - **Relevant Documentation:**
    - `src/docs/CLAUDE.md` — Frontend module overview
    - `src/docs/architecture.md` — UI structure, rendering pipeline
    - `docs/features/snapshot-save-restore/design.md` — UI requirements (section 4.5), success metrics (section 8)
    - `docs/architecture.md` — System-wide architecture
    - `CLAUDE.md` — Project conventions, version sync requirement
  - [ ] 4.1 Add Save State button to `src/index.html`
    - Find the existing Reset button in the toolbar area
    - Add a "Save" button next to it, using the same styling
    - Wire the button's click event to call `saveZ80()` in main.js
    - **Started**: TBD
    - **Completed**: TBD
    - **Duration**: TBD
  - [ ] 4.2 End-to-end testing
    - Test save: load a TAP game, let it run, click Save → verify .z80 file downloads
    - Test load: drag the saved .z80 file back into the emulator → verify game resumes
    - Test interop: try loading a .z80 file from another emulator (if available)
    - Test round-trip: save → load → verify machine state is identical
    - **Started**: TBD
    - **Completed**: TBD
    - **Duration**: TBD
  - [ ] 4.3 Version bump and documentation update
    - Bump patch version in `package.json` and `src/index.html` (keep in sync)
    - Update `CLAUDE.md` to mention .z80 snapshot save/load capability
    - **Started**: TBD
    - **Completed**: TBD
    - **Duration**: TBD
  - [ ] 4.4 Update component documentation
    - Update `src/docs/CLAUDE.md` — finalize .z80 documentation
    - Update `assembly/docs/CLAUDE.md` — finalize getter/setter documentation
    - **Started**: TBD
    - **Completed**: TBD
    - **Duration**: TBD
  - [ ] 4.5 Create phase completion summary
    - Create `docs/tasks/TASK-3.0-UI-INTEGRATION-TESTING-COMPLETION-SUMMARY.md`
    - Include: test results, any bugs found and fixed, interop results
    - **Started**: TBD
    - **Completed**: TBD
    - **Duration**: TBD

**Parallelization note for Phase 3:** All sub-tasks are sequential — the Save button needs saveZ80() from Phase 2, testing needs the button, and docs/version bump need testing to pass first.

---

## Parallelization Notes

**Phase 1:** Sequential — all changes are in one file (`assembly/index.ts`), followed by a build step.

**Phase 2:** Two parallel groups:
- **Parallel Group A**: 2.1 (compress) and 3.1 (decompress) — independent helper functions
- **Parallel Group B**: 2.2 (saveZ80) and 3.2 (loadZ80) — independent save/load functions
- Then 3.3, 3.4, 3.5 run sequentially after both parallel groups

**Phase 3:** Sequential — UI → test → docs.

**Cross-phase dependencies:**
- Phase 2 depends on Phase 1 (needs WASM getters/setters built)
- Phase 3 depends on Phase 2 (needs save/load functions implemented)
