# Task 1.0 — WASM Register Exports — Completion Summary

## What was implemented

Added 29 new exported functions to `assembly/index.ts` for snapshot save/restore support:
- 8 new getters: `getR`, `getIFF2`, `getHalted`, `getA2`, `getF2`, `getBC_prime`, `getDE_prime`, `getHL_prime`
- 21 new setters for all CPU registers, shadow registers, interrupt state, and border colour

## Design decisions

- **`_ext` suffix on setters**: Internal non-exported helpers `setBC()`, `setDE()`, `setHL()` already exist. To avoid name collisions, all exported setters use `_ext` suffix (e.g., `setBC_ext()`). The JS side calls `wasm.setBC_ext()`.
- **Boolean conversion**: `IFF1`, `IFF2`, and `halted` are stored as `bool` internally. Getters return `1`/`0` as `u8`. Setters accept `u8` and convert via `v != 0`.

## Build status

WASM build succeeded with no errors. Updated `src/spectrum.wasm` committed.

## Files modified

| File | Changes |
|------|---------|
| `assembly/index.ts` | Added 29 exported functions (8 getters + 21 setters) |
| `assembly/docs/CLAUDE.md` | Added snapshot support section |
| `src/spectrum.wasm` | Rebuilt binary |
