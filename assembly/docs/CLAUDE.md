# Assembly — Z80 Core

This directory contains the complete Z80 CPU and ZX Spectrum 48K hardware emulation in a single AssemblyScript file (`index.ts`, ~1780 lines). It compiles to WASM and is the performance-critical core of the emulator.

## Entry Points (Exported to JS)

| Export | Purpose |
|--------|---------|
| `frame()` | Execute one 50 Hz frame (69,888 T-cycles), render screen, sample audio |
| `reset()` | Reset CPU state (registers, flags, PC=0) |
| `setKeyRow(row, value)` | Set keyboard matrix row (0-7), value is 5-bit bitmask |
| `setKempston(value)` | Set Kempston joystick port value |
| `getTapeActive()` | Check if tape data is loaded and available |
| `setTapeLength(len)` | Set length of TAP data in the tape buffer |

## Snapshot Support (Exported Getters/Setters)

For `.z80` snapshot save/restore, additional exports expose all CPU state:

- **Getters**: `getA()`, `getF()`, `getBC2()`, `getDE2()`, `getHL2()`, `getPC()`, `getSP()`, `getIX()`, `getIY()`, `getI()`, `getR()`, `getIM()`, `getIFF1()`, `getIFF2()`, `getHalted()`, `getA2()`, `getF2()`, `getBC_prime()`, `getDE_prime()`, `getHL_prime()`, `getBorderColor()`
- **Setters**: `setPC_ext()`, `setSP_ext()`, `setA_ext()`, `setF_ext()`, `setBC_ext()`, `setDE_ext()`, `setHL_ext()`, `setIX_ext()`, `setIY_ext()`, `setI_ext()`, `setR_ext()`, `setIM_ext()`, `setIFF1_ext()`, `setIFF2_ext()`, `setHalted_ext()`, `setA2_ext()`, `setF2_ext()`, `setBC_prime_ext()`, `setDE_prime_ext()`, `setHL_prime_ext()`, `setBorderColor_ext()`

Setters use the `_ext` suffix to avoid name collisions with internal helpers like `setBC()`.

## Key Concepts

- **Memory-mapped I/O**: Port 0xFE handles both keyboard input and border/beeper output
- **ROM trap**: Tape loading is intercepted at PC=0x0556 (the ROM's LD-BYTES routine) for instant loading
- **Flag lookup tables**: Pre-computed tables for S, Z, P, H flags avoid per-instruction calculation
- **Screen rendering**: ULA emulation converts the Spectrum's peculiar screen memory layout to RGBA pixels
- **Beeper sampling**: The 1-bit beeper output is sampled every ~79 T-cycles into a buffer that JS reads for audio

## Code Organization

The file is organized roughly as:
1. Constants and memory layout definitions
2. Lookup table initialization (`initTables()`)
3. CPU register declarations
4. Memory read/write helpers
5. ALU operations (add, sub, and, or, xor, cp, inc, dec)
6. Instruction execution (`execute()` — main opcode dispatch + CB/ED/DD/FD prefixes)
7. I/O port handling
8. Screen rendering (`renderScreen()`)
9. Audio sampling
10. TAP ROM trap logic
11. Frame orchestration (`frame()`)

See [architecture.md](architecture.md) for detailed technical documentation.
