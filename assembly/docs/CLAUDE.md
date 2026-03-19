# Assembly — Z80 Core

This directory contains the complete Z80 CPU and ZX Spectrum 48K hardware emulation in a single AssemblyScript file (`index.ts`, ~1900 lines). It compiles to WASM and is the performance-critical core of the emulator.

## Entry Points (Exported to JS)

| Export | Purpose |
|--------|---------|
| `frame()` | Execute one 50 Hz frame (69,888 T-cycles), render screen, sample audio |
| `reset()` | Reset CPU state (registers, flags, PC=0) |
| `setKeyRow(row, value)` | Set keyboard matrix row (0-7), value is 5-bit bitmask |
| `setKempston(value)` | Set Kempston joystick port value |
| `getTapeActive()` | Check if tape data is loaded and available |
| `setTapeLength(len)` | Set length of TAP data in the tape buffer |
| `getPulseBaseAddr()` | Return base address of the pulse duration buffer in WASM memory |
| `loadPulseByte(offset, val)` | Write a byte into the pulse duration buffer |
| `setPulseCount(count)` | Set total number of pulse durations and reset playback state |
| `setBlockBound(index, pulseIndex)` | Map a TAP block index to its starting pulse index |
| `setBlockBoundsCount(count)` | Set number of block boundary entries |
| `isTapePlaying()` | Check if pulse tape playback is currently active |
| `getPulsePos()` | Return current pulse index during playback |
| `getTapeLevel()` | Return current tape signal level (0 or 1) |

*Updated: 2026-03-19 -- added pulse tape playback exports*

## Key Concepts

- **Memory-mapped I/O**: Port 0xFE handles both keyboard input and border/beeper output
- **ROM trap**: Tape loading is intercepted at PC=0x0556 (the ROM's LD-BYTES routine) for instant loading
- **Pulse tape playback**: TZX files are converted to an array of pulse durations that drive the EAR bit in real time, enabling custom loaders (Speedlock, etc.) that bypass the ROM routine. Block boundaries keep the ROM trap and pulse stream in sync.
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
