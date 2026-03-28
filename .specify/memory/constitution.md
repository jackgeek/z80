<!--
SYNC IMPACT REPORT
==================
Version change: (none — initial population) → 1.0.0
Modified principles: N/A (first-time fill from blank template)
Added sections:
  - Core Principles (8 principles, user-supplied)
  - Technology Stack & Toolchain
  - Development Workflow
  - Governance
Removed sections: N/A
Templates requiring updates:
  - .specify/templates/plan-template.md ✅ No changes required — Constitution Check
    section uses a dynamic placeholder filled per feature; the 8 gates below guide that fill.
  - .specify/templates/spec-template.md ✅ No changes required — generic structure is
    compatible with all 8 principles.
  - .specify/templates/tasks-template.md ✅ No changes required — task phases are
    framework-agnostic and compatible.
Follow-up TODOs:
  - TODO(RATIFICATION_DATE): exact original adoption date unknown; set to first-fill date
    2026-03-22. Update if an earlier decision record exists.

AMENDMENT 1.0.0 → 1.1.0 (2026-03-28)
==================
Principle III updated: replaced "Three.js" with "PlayCanvas" as the sole permitted
third-party UI dependency. Three.js was removed as part of the steampunk-UI rewrite
(Phase 1, committed 2026-03-21). Technology Stack section updated to match.
Templates requiring updates: none — principle change is a scoping clarification.
-->

# ZX Spectrum 48K Emulator Constitution

## Core Principles

### I. WASM Boundary Integrity

All Z80 CPU and ULA emulation logic MUST reside exclusively in `assembly/index.ts` and compile
to WASM. The TypeScript frontend MUST NOT implement any emulation logic. WASM code MUST NOT call
browser APIs directly.

**Rationale**: Mixing emulation logic into JS degrades determinism and performance. The WASM
boundary is the performance and correctness firewall; breaching it makes the system untestable
in isolation.

### II. Shared Memory Communication

JS and WASM MUST exchange data exclusively via fixed offsets in the 16 MB `WebAssembly.Memory`
linear buffer. JS MUST NOT call WASM functions to pass per-frame data values that fit in the
shared memory layout. The only permitted cross-boundary calls are the exported functions defined
in `WasmExports`.

**Rationale**: Ad-hoc function-call interfaces between JS and WASM create implicit coupling and
make the data-flow hard to audit. Shared memory with documented offsets is the contract.

**Current memory layout** (normative — changes require a constitution amendment):

| Offset       | Size    | Purpose                                   |
|--------------|---------|-------------------------------------------|
| `0x100000`   | 64 KB   | Z80 address space (16 KB ROM + 48 KB RAM) |
| `0x110000`   | 192 KB  | Screen buffer (256×192×4 RGBA pixels)     |
| `0x140000`   | 512 KB  | TAP file buffer                           |
| `0x1C0000`   | 3.5 KB  | Audio sample buffer (882 i16 samples)     |

### III. No Frameworks

The browser-side codebase MUST use vanilla TypeScript only. React, Vue, Angular, Svelte, and any
equivalent UI framework are prohibited. DOM manipulation MUST be direct. PlayCanvas is the sole
permitted third-party UI dependency (scoped to 3D scene rendering in `src/entities/`, `src/scene/`,
and `src/materials/`).

**Rationale**: Framework overhead conflicts with the performance budget of a real-time emulator
running at 50 Hz. Vanilla TS keeps bundle size minimal and avoids virtual-DOM reconciliation
interfering with the frame loop.

### IV. Domain Module Isolation

Each `src/` subdirectory (`emulator/`, `input/`, `audio/`, `video/`, `media/`, `debug/`, `ui/`)
MUST own its domain exclusively. Cross-domain shared state MUST flow through getter/setter
functions in `emulator/state.ts` only. No module MUST export mutable variables directly. No
symbol MUST be attached to `window`.

**Rationale**: Global state makes concurrency and testing unpredictable. The getter/setter pattern
in `state.ts` is the single source of truth for all shared emulator state.

### V. AssemblyScript Performance Idioms (NON-NEGOTIABLE)

All code on the Z80 execution hot path MUST follow these idioms without exception:

- `@inline` decorator on functions called per-instruction or per-cycle.
- `unchecked()` wrapper on all array/typed-array accesses inside inner loops.
- Explicit `u8`, `u16`, `u32`, `i16`, `i32` casts everywhere — no implicit widening.
- No dynamic allocation inside `frame()` or `execute()`.

**Rationale**: The emulator must sustain 69,888 T-cycles per 20 ms frame. AssemblyScript's
performance characteristics require explicit control over memory and typing; implicit coercions
produce suboptimal WASM and can introduce correctness bugs in flag calculations.

### VI. Static-Only Deployment

The deployable artefact MUST be a directory of static files (`dist/`) with zero server-side
logic, no dynamic backends, and no runtime network dependencies beyond fetching the WASM binary
and ROM. All external libraries MUST be bundled at build time by Vite.

**Rationale**: GitHub Pages is the hosting target. Server-side code is impossible there, and
any runtime CDN dependency would introduce availability risk for a demo emulator.

### VII. Hardware Accuracy First

Emulation behaviour MUST faithfully replicate ZX Spectrum 48K hardware semantics:

- ROM trap at PC=`0x0556` MUST intercept tape loads without altering ROM content.
- ULA screen rendering MUST honour the Spectrum's non-linear screen memory layout and attribute
  colours including flash.
- Beeper sampling MUST capture the 1-bit output at the correct T-cycle interval (~79 cycles).
- Z80 flag tables MUST use pre-computed lookup tables for S, Z, P, H flags.

Convenience shortcuts that break compatibility with commercial ZX Spectrum software are
prohibited regardless of implementation effort saved.

**Rationale**: The primary value proposition of this emulator is running real Spectrum software
correctly. An inaccurate emulator that runs fast is worthless.

### VIII. File Format Compatibility

TAP, TZX, ZIP, ROM, and `.z80` file handling MUST maintain byte-level compatibility with the
broader ZX Spectrum ecosystem:

- `.z80` snapshot save MUST write v3 format; load MUST auto-detect and support v1, v2, v3.
- TZX parsing MUST extract block types `0x10`, `0x11`, and `0x14`; other block types MAY be
  skipped with a console warning.
- TAP blocks MUST use the 2-byte-length + data layout exactly.

**Rationale**: Users load files created by other emulators and tools. Silent format divergence
would corrupt their data.

## Technology Stack & Toolchain

**Language (core)**: AssemblyScript → WASM (`assembly/index.ts`)
**Language (frontend)**: TypeScript (strict), ES modules, no transpile targets below ES2020
**Bundler**: Vite — dev server with HMR, production build to `dist/`
**Runtime**: Bun (build scripts, assembler CLI, dependency management)
**3D library**: PlayCanvas (bundled via bun, tree-shaken by Vite)
**Assembler tool**: Node.js CLI in `packages/assembler/` (standalone, not bundled into the site)
**Deployment**: GitHub Actions → `dist/` → GitHub Pages (static)

Build commands (normative):

```
bun run build        # WASM compile + Vite production build
bun run dev          # WASM compile + Vite dev server (HMR)
bun run serve        # vite preview of dist/
bun run asm          # Z80 assembler CLI
```

**AudioWorklet constraint**: `public/audio-worklet.js` MUST remain a standalone non-module file
in `public/`. It cannot be part of the ES module bundle because the AudioWorklet API requires a
standalone URL.

## Development Workflow

**Testing**: No automated test suite at present. Correctness is verified by running known
Spectrum software through the emulator. Any feature that adds a testable unit (e.g., the
assembler) SHOULD introduce a corresponding test script.

**Code review gates** (apply to every PR):

1. Does the change respect the WASM boundary? (Principle I)
2. Does any new JS↔WASM communication use shared memory rather than ad-hoc calls? (Principle II)
3. Has any framework or global been introduced? (Principles III, IV)
4. Do hot-path changes in AssemblyScript use the required idioms? (Principle V)
5. Does the build output remain static-deployable? (Principle VI)
6. Does the change preserve timing-accurate hardware behaviour? (Principle VII)
7. Does the change preserve file format compatibility? (Principle VIII)

**Branch strategy**: Feature branches off `main`; merge via PR after review.
**Build verification**: `bun run build` MUST succeed with zero errors before any PR is merged.

## Governance

This constitution supersedes all other project conventions. Where CLAUDE.md, inline comments,
or prior practice conflict with this document, this document takes precedence.

**Amendment procedure**:
1. Propose the amendment in a PR description with rationale.
2. Update `CONSTITUTION_VERSION` per semantic versioning rules below.
3. Update `LAST_AMENDED_DATE` to the merge date.
4. Run the consistency propagation checklist (templates, CLAUDE.md references).

**Versioning policy**:
- MAJOR: Principle removed, renamed, or redefined in a backward-incompatible way.
- MINOR: New principle or section added; existing principle materially expanded.
- PATCH: Wording clarification, typo fix, non-semantic refinement.

**Compliance**: All PRs MUST be reviewed against the eight-point gate list in the Development
Workflow section before merge.

---

**Version**: 1.1.0 | **Ratified**: 2026-03-22 | **Last Amended**: 2026-03-28
