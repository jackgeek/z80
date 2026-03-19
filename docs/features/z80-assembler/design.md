# Z80 Assembler — Design Document

## 1. Introduction / Overview

A Node.js CLI tool that reads Z80 assembly source files and outputs ZX Spectrum TAP files. The TAP includes a BASIC loader that loads the assembled machine code into RAM and optionally auto-executes it via `RANDOMIZE USR`. This enables a rapid development workflow: write assembly, run the assembler, drag the TAP into the emulator.

## 2. Goals

1. Assemble the **full Z80 instruction set** (main, CB, ED, DD/FD prefixes) from human-readable mnemonics to binary.
2. Output valid **TAP files** containing a BASIC loader + CODE block that the emulator can load via drag-and-drop or the game library.
3. Support standard assembler **directives**: `ORG`, `EQU`, `DB`/`DEFB`, `DW`/`DEFW`, `DS`/`DEFS`, labels, and comments.
4. Default **auto-run** with a `--no-autorun` flag to skip execution.
5. Provide **clear error messages** with line numbers for syntax and encoding errors.
6. Single-file input, no INCLUDE or macro support (keep it simple).

## 3. User Stories

- **As a Z80 developer**, I want to write assembly in a text editor, run a single command, and get a TAP file I can drag into the emulator.
- **As a Z80 developer**, I want clear error messages when I make a syntax mistake, so I can fix it quickly.
- **As a Z80 developer**, I want to use labels for jump targets and data, so I don't have to calculate addresses manually.
- **As a Z80 developer**, I want the TAP to auto-run my code by default, but be able to disable auto-run for programs that need manual setup.

## 4. Functional Requirements

### 4.1 CLI Interface

1. **Invocation**: `node tools/z80asm.js <input.asm> [-o output.tap] [--no-autorun] [--org 0x8000]`
2. If `-o` is omitted, output filename is derived from input (e.g., `hello.asm` → `hello.tap`)
3. `--no-autorun` — BASIC loader loads code but does not execute it
4. `--org 0x8000` — override the default ORG if none is specified in the source (default: 0x8000)
5. Exit code 0 on success, non-zero on error
6. Print assembled size and load address on success

### 4.2 Assembly Language Syntax

7. **Mnemonics**: Standard Zilog Z80 mnemonics (uppercase or lowercase, case-insensitive)
8. **Registers**: `A, B, C, D, E, H, L, AF, BC, DE, HL, SP, IX, IY, I, R, AF'`
9. **Labels**: Identifiers followed by `:` at start of line. Referenced by name in operands.
10. **Local labels**: Labels starting with `.` are scoped to the previous non-local label (e.g., `.loop`)
11. **Comments**: `;` to end of line
12. **Number formats**:
    - Decimal: `42`
    - Hexadecimal: `$FF`, `0xFF`, `FFh`, `0FFh`
    - Binary: `%10101010`, `0b10101010`
    - Character: `'A'`
13. **Expressions**: Basic arithmetic in operands: `+`, `-`, `*`, `/`, `%`, `(`, `)`. Labels and EQU constants can appear in expressions. Evaluated at assembly time (no relocations).
14. **String literals**: `"Hello"` in DB directives to emit ASCII bytes.

### 4.3 Directives

15. **ORG addr** — Set the assembly origin address. Can appear multiple times. Default is 0x8000.
16. **EQU** — `name EQU value` — Define a constant. Must be defined before use (or use two-pass).
17. **DB / DEFB** — `DB 0x00, 0xFF, "Hello", 0` — Emit literal bytes. Supports comma-separated values, strings, expressions.
18. **DW / DEFW** — `DW 0x1234, label` — Emit 16-bit words (little-endian).
19. **DS / DEFS** — `DS 10` or `DS 10, 0xFF` — Reserve N bytes, optionally filled with a value (default 0x00).
20. **END** — Optional. Stop assembly (ignore remaining lines).

### 4.4 Full Z80 Instruction Set

21. All **main opcodes** (no prefix): LD, ADD, ADC, SUB, SBC, AND, OR, XOR, CP, INC, DEC, PUSH, POP, JP, JR, CALL, RET, RST, NOP, HALT, DI, EI, EX, EXX, DJNZ, CPL, NEG, CCF, SCF, RLCA, RRCA, RLA, RRA, DAA, IM
22. All **CB-prefix** bit operations: RLC, RRC, RL, RR, SLA, SRA, SRL, SLL, BIT, SET, RES on all registers and (HL)
23. All **ED-prefix** extended ops: block transfers (LDI, LDIR, LDD, LDDR), block compare (CPI, CPIR, CPD, CPDR), block I/O (INI, INIR, IND, INDR, OUTI, OTIR, OUTD, OTDR), 16-bit ADC/SBC, LD (nn) rr, LD rr (nn), NEG, RETI, RETN, IM 0/1/2, LD I/R,A and LD A,I/R, RRD, RLD, IN r,(C), OUT (C),r
24. All **DD/FD-prefix** indexed ops: IX/IY variants of LD, ADD, ADC, SUB, SBC, AND, OR, XOR, CP, INC, DEC, PUSH, POP, JP, EX (SP) with `(IX+d)` / `(IY+d)` addressing
25. All **DDCB/FDCB** indexed bit operations: BIT/SET/RES on (IX+d) and (IY+d)

### 4.5 Two-Pass Assembly

26. **Pass 1**: Parse all lines, collect labels and their addresses, evaluate EQU constants, calculate instruction sizes.
27. **Pass 2**: Emit binary, resolve all label references and expressions to concrete values.
28. Forward references to labels are supported (label used before defined).

### 4.6 TAP Output

29. Output a valid TAP file containing 4 blocks:
    - **Block 1 — BASIC header** (19 bytes): flag=0x00, type=0 (Program), name (10 chars padded), data length, autostart line (10 or 0x8000 if no-autorun), variable area offset
    - **Block 2 — BASIC data**: flag=0xFF, BASIC program bytes, checksum
    - **Block 3 — CODE header** (19 bytes): flag=0x00, type=3 (Bytes), name (10 chars padded), data length, start address (ORG), 0x8000
    - **Block 4 — CODE data**: flag=0xFF, assembled machine code bytes, checksum

30. **BASIC loader program** (auto-run, line 10):
    ```
    10 CLEAR {org-1}: LOAD "" CODE: RANDOMIZE USR {org}
    ```
    When `--no-autorun`:
    ```
    10 CLEAR {org-1}: LOAD "" CODE
    ```

31. **Checksum**: XOR of all bytes in the block (including the flag byte).

32. **Block length prefix**: Each block is preceded by a 2-byte little-endian length (flag byte + data + checksum byte).

### 4.7 Error Handling

33. Syntax errors report: filename, line number, the offending line, and a description.
34. Unknown mnemonics, invalid register combinations, out-of-range values (e.g., 8-bit value > 255) are detected and reported.
35. Undefined labels report the label name and where it was referenced.
36. Duplicate label definitions are reported.

## 5. Non-Goals (Out of Scope)

- **INCLUDE / macro support** — single file only for now.
- **Linker / relocatable output** — no object files, no linking step.
- **Optimization** — the assembler outputs exactly what you write.
- **Disassembler** — not included.
- **Browser integration** — CLI only.
- **TZX output** — TAP only (sufficient for the emulator).

## 6. Design Considerations

### CLI Usage Examples

```bash
# Basic usage
node tools/z80asm.js hello.asm

# Specify output file
node tools/z80asm.js hello.asm -o examples/hello.tap

# No auto-run
node tools/z80asm.js test.asm --no-autorun

# Override default ORG
node tools/z80asm.js test.asm --org 0x6000
```

### Sample Source File

```z80
; hello.asm — border color cycler
        ORG $8000

start:  ld a, 0
.loop:  out ($fe), a
        inc a
        and 7
        jr .loop
```

### npm Script Integration

```json
{
  "asm": "node tools/z80asm.js"
}
```

Usage: `npm run asm -- hello.asm -o hello.tap`

## 7. Technical Considerations

### Files to Create

| File | Description |
|------|-------------|
| `tools/z80asm.js` | Main assembler entry point (CLI argument parsing, orchestration) |
| `tools/z80asm/parser.js` | Tokenizer and line parser |
| `tools/z80asm/encoder.js` | Z80 instruction encoding (mnemonic → bytes) |
| `tools/z80asm/tap.js` | TAP file generation (headers, BASIC loader, checksums) |
| `tools/z80asm/opcodes.js` | Opcode lookup tables for all Z80 instructions |
| `tools/z80asm/expressions.js` | Expression evaluator for operands |

### Opcode Encoding Approach

The instruction encoder will use a table-driven approach:
- A master opcode table maps `(mnemonic, operand_pattern)` → `(prefix_bytes, opcode, operand_type, size)`
- Operand patterns are templates like `r,r'`, `r,n`, `(HL)`, `(IX+d),r`, `nn`, etc.
- The parser identifies which pattern matches the source operands
- The encoder looks up the base opcode and fills in register bits / immediate values

### BASIC Loader Encoding

BASIC programs on the Spectrum are stored as tokenized lines:
- Each line: `[2-byte line number BE][2-byte length LE][tokens...][0x0D]`
- Keywords are single-byte tokens (e.g., CLEAR=0xFD, LOAD=0xEF, CODE=0xAF, RANDOMIZE=0xF9, USR=0xC0)
- Numbers are stored as: `0x0E [5-byte float] + display digits`

### Reference: Existing Opcode Implementation

The emulator's `assembly/index.ts` contains the complete Z80 instruction dispatch. The assembler's encoder should produce bytes that match exactly what the emulator decodes. Key reference sections:
- Main opcodes: lines 1184-1526
- CB prefix: lines 485-554
- ED prefix: lines 559-700
- DD/FD indexed: lines 930-1138

## 8. Success Metrics

- Assembler correctly encodes all Z80 instructions (verified against known test programs).
- Output TAP files load and execute correctly in the emulator.
- Error messages are clear enough to fix problems without consulting documentation.
- A simple program can go from source to running in the emulator in under 2 seconds.

## 9. Open Questions

1. **Should an npm script be added to package.json?** — Likely yes, e.g., `"asm": "node tools/z80asm.js"`.
2. **Test suite** — Should we include automated tests for instruction encoding? (Probably yes, but could be Phase 2.)
3. **Source file extension convention** — `.asm` or `.z80`? Using `.asm` as it's more universal.
