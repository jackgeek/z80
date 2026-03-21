# packages/assembler — Z80 assembler

A Node.js CLI tool that assembles Z80 source files into ZX Spectrum TAP files. Supports the full Z80 instruction set, labels, expressions, and standard assembler directives.

## Usage

```bash
node packages/assembler/cli.js input.asm                    # Output: input.tap
node packages/assembler/cli.js input.asm -o output.tap      # Explicit output path
node packages/assembler/cli.js input.asm --no-autorun        # Don't auto-execute
node packages/assembler/cli.js input.asm --org 0x6000        # Override default ORG
```

Or via npm: `npm run asm -- input.asm -o output.tap`

## Modules

| File | Purpose |
|------|---------|
| `cli.js` | CLI entry point — argument parsing, orchestrates assembly and TAP generation |
| `parser.js` | Line parser — extracts labels, mnemonics, operands from source lines |
| `expressions.js` | Expression evaluator — arithmetic with symbols, multi-format number literals |
| `opcodes.js` | Opcode tables — register/condition/pair codes, simple opcode maps, encoding pattern reference |
| `encoder.js` | Instruction encoder — converts mnemonic + operands to byte sequences |
| `assembler.js` | Two-pass assembler core — pass 1 collects labels, pass 2 emits binary |
| `tap.js` | TAP generator — builds BASIC loader + CODE block with checksums |

## Data flow

```
source.asm
    │
    ▼
  parser.parseLine() — tokenizes each line
    │
    ▼
  assembler.assemble() — two-pass:
    Pass 1: collect labels, calculate sizes (via encoder.getInstructionSize)
    Pass 2: emit bytes (via encoder.encodeInstruction + expressions.evaluateExpression)
    │
    ▼
  tap.generateTAP() — wraps binary in TAP with BASIC loader
    │
    ▼
  output.tap
```

## Supported syntax

- **Instructions**: Full Z80 set (main, CB, ED, DD/FD prefixes)
- **Directives**: ORG, EQU, DB/DEFB, DW/DEFW, DS/DEFS, END
- **Labels**: Global (`name:`) and local (`.name:`, scoped to previous global label)
- **Numbers**: Decimal, hex (`$FF`, `0xFF`, `FFh`), binary (`%10101010`, `0b10101010`), char (`'A'`)
- **Expressions**: `+`, `-`, `*`, `/`, `%`, parentheses, `$` for current PC
- **Comments**: `;` to end of line

## Design document

See [/docs/features/z80-assembler/design.md](/docs/features/z80-assembler/design.md) for full requirements.
