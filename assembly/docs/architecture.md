# Z80 Core Architecture

## CPU Registers

```
Main:    A F  B C  D E  H L  IX  IY  SP  PC
Shadow:  A'F' B'C' D'E' H'L'
Control: I (interrupt vector)  R (refresh counter)
         IFF1/IFF2 (interrupt flip-flops)  IM (interrupt mode)
```

## Flags Register (F)

```
Bit 7: S   Sign
Bit 6: Z   Zero
Bit 5: 5   Undocumented (bit 5 of result)
Bit 4: H   Half-carry (carry from bit 3)
Bit 3: 3   Undocumented (bit 3 of result)
Bit 2: PV  Parity/Overflow
Bit 1: N   Subtract
Bit 0: C   Carry
```

Flag computation uses pre-built lookup tables (`sz53Table`, `parityTable`, `sz53pTable`) and half-carry/overflow tables indexed by a 3-bit lookup combining operand and result bits.

## Memory Map (Z80 Address Space)

```
0x0000–0x3FFF  16 KB ROM (read-only, loaded from 48.rom)
0x4000–0x57FF   6 KB Screen bitmap
0x5800–0x5AFF  768 B Screen attributes (color)
0x5B00–0xFFFF  ~41 KB General RAM
```

Mapped into WASM linear memory at offset `MEM_BASE` (0x100000).

## Instruction Pipeline

The `execute()` function runs in a loop accumulating T-cycles until 69,888 per frame:

1. **TAP trap check** — if `PC == 0x0556` and tape data is available, intercept and load directly
2. **Fetch opcode** — `fetchByte()` reads from `[PC]`, increments PC
3. **Decode** — switch on opcode byte
4. **Prefix handling**:
   - `0xCB` → bit operations (rotate, shift, bit test/set/reset)
   - `0xED` → extended operations (block transfers, I/O blocks, 16-bit arithmetic)
   - `0xDD`/`0xFD` → IX/IY indexed variants (with displacement byte)
   - `0xDDCB`/`0xFDCB` → indexed bit operations
5. **Execute** — perform operation, update flags
6. **Return T-cycles consumed**

Each instruction returns its cycle count (4–23 T-cycles). The main loop sums these until the frame budget is exhausted.

## ULA Screen Rendering

The Spectrum screen has a non-linear memory layout. Each scanline address is computed as:

```
addr = 0x4000 | (y & 0xC0) << 5 | (y & 0x07) << 8 | (y & 0x38) << 2
```

For each 8-pixel block, an attribute byte at `0x5800 + (y/8)*32 + col` provides:
- Bits 0–2: ink color (foreground)
- Bits 3–5: paper color (background)
- Bit 6: bright (doubles as color palette selector)
- Bit 7: flash (swap ink/paper every 16 frames)

Output is 256×192×4 bytes RGBA written to the screen buffer at offset 0x110000.

## Color Palette

16 colors: 8 normal + 8 bright variants.

```
0: #000000  Black         8: #000000  Bright Black
1: #0000CD  Blue          9: #0000FF  Bright Blue
2: #CD0000  Red          10: #FF0000  Bright Red
3: #CD00CD  Magenta      11: #FF00FF  Bright Magenta
4: #00CD00  Green        12: #00FF00  Bright Green
5: #00CDCD  Cyan         13: #00FFFF  Bright Cyan
6: #CDCD00  Yellow       14: #FFFF00  Bright Yellow
7: #CDCDCD  White        15: #FFFFFF  Bright White
```

## Audio (Beeper)

The Spectrum has a 1-bit beeper controlled by bit 4 of port 0xFE. The emulator samples this output every ~79 T-cycles (69,888 cycles / 882 samples = ~79.24), producing 882 samples per frame at 44,100 Hz.

Samples are written as `i16` values to the audio buffer at offset 0x1C0000.

## I/O Ports

**Port 0xFE (any even port — active when bit 0 of port address is 0):**
- **IN**: Keyboard matrix. High byte of port address selects row(s); returns 5-bit key state in bits 0–4.
- **OUT**: Bits 0–2 = border color, bit 4 = beeper output.

**Port 0x1F (Kempston joystick):**
- **IN**: Bit 0=right, 1=left, 2=down, 3=up, 4=fire.

## TAP ROM Trap

At `PC == 0x0556` (the ROM's LD-BYTES entry point), the emulator intercepts and loads tape blocks directly into Z80 memory:

1. Read 2-byte block length from tape buffer
2. Read flag byte, compare with register A
3. If match: copy DE bytes from tape to address IX in Z80 RAM
4. Set carry flag (success), fix up stack, return to caller
5. If no match: skip block, try next

This makes tape loading instant rather than requiring real-time tape signal emulation.

## Interrupts

A maskable interrupt fires once per frame (after 69,888 T-cycles). In mode 1 (standard Spectrum), this calls RST 0x38 which handles keyboard scanning and the system clock.

## Performance Notes

- `@inline` decorators on all hot-path functions (ALU ops, memory access, flag computation)
- `unchecked()` on all table lookups (skips bounds checking)
- `StaticArray` for lookup tables (no GC allocation)
- Explicit `u8`/`u16` casts throughout (AssemblyScript requires this for correct WASM codegen)
