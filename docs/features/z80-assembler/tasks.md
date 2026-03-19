## Tasks

### Phase 1: Foundation Modules

**Status**: Not Started
**Progress**: 0/5 tasks complete (0%)
**Phase Started**: TBD
**Phase Completed**: TBD

- [ ] 1.0 Create the three foundation modules: expression evaluator, line parser, and opcode tables
  - **Relevant Documentation:**
    - `docs/features/z80-assembler/design.md` — Full requirements: syntax (4.2), directives (4.3), instruction set (4.4), two-pass (4.5)
    - `assembly/docs/CLAUDE.md` — Z80 core overview, instruction categories
    - `assembly/docs/architecture.md` — CPU pipeline, instruction fetch/decode, opcode encoding
    - `docs/architecture.md` — System-wide architecture
    - `CLAUDE.md` — Project conventions (vanilla JS, no frameworks)
  - **Parallel Group A** (all three sub-tasks are independent — no shared code between them):
    - [ ] 1.1 Create `tools/z80asm/expressions.js` — Expression evaluator
      - Create `tools/z80asm/` directory
      - Implement `evaluateExpression(expr, symbols)` that parses and evaluates arithmetic expressions
      - Support number formats: decimal (`42`), hex (`$FF`, `0xFF`, `FFh`, `0FFh`), binary (`%10101010`, `0b10101010`), character (`'A'`)
      - Support operators: `+`, `-`, `*`, `/`, `%` with standard precedence and `(` `)` grouping
      - Support symbol references (labels, EQU constants) via the `symbols` map
      - Support special token `$` meaning "current address" (PC)
      - Return an integer value, or throw an error with description for invalid expressions
      - Export: `{ evaluateExpression, parseNumber }`
      - See design.md section 4.2 requirements 12-13
      - **Started**: TBD
      - **Completed**: TBD
      - **Duration**: TBD
    - [ ] 1.2 Create `tools/z80asm/parser.js` — Line parser
      - Implement `parseLine(line, lineNumber, currentScope)` that tokenizes a single assembly line
      - Extract: label (optional, ends with `:`), mnemonic/directive (optional), operands (comma-separated)
      - Strip comments (`;` to end of line, but not inside string literals)
      - Handle local labels: labels starting with `.` get prefixed with `currentScope` (the last non-local label)
      - Handle string literals in DB: `"Hello"` → array of ASCII byte values
      - Return object: `{ label, mnemonic, operands: [], raw: originalLine, lineNumber }`
      - Case-insensitive mnemonic handling (normalize to uppercase internally)
      - Handle edge cases: blank lines, comment-only lines, label-only lines
      - Export: `{ parseLine }`
      - See design.md sections 4.2 and 4.3
      - **Started**: TBD
      - **Completed**: TBD
      - **Duration**: TBD
    - [ ] 1.3 Create `tools/z80asm/opcodes.js` — Full Z80 opcode lookup tables
      - Build a table-driven opcode map: key is `"MNEMONIC operand_pattern"`, value is `{ prefix, opcode, size, operandType }`
      - **Main opcodes (no prefix)**: All LD variants (r,r' / r,n / r,(HL) / (HL),r / A,(BC) / A,(DE) / (nn),A / etc.), ADD/ADC/SUB/SBC/AND/OR/XOR/CP (r / n / (HL)), INC/DEC (r / rr / (HL)), PUSH/POP (rr), JP/JR/CALL/RET (cc/nn), RST, NOP, HALT, DI, EI, EX, EXX, DJNZ, CPL, CCF, SCF, RLCA, RRCA, RLA, RRA, DAA
      - **CB-prefix**: RLC/RRC/RL/RR/SLA/SRA/SRL/SLL/BIT/SET/RES on registers B,C,D,E,H,L,(HL),A with bit numbers 0-7
      - **ED-prefix**: Block ops (LDI/LDIR/LDD/LDDR/CPI/CPIR/CPD/CPDR/INI/INIR/IND/INDR/OUTI/OTIR/OUTD/OTDR), 16-bit ADC/SBC HL,rr, LD (nn),rr / LD rr,(nn), NEG, RETI, RETN, IM 0/1/2, LD I,A / LD R,A / LD A,I / LD A,R, RRD, RLD, IN r,(C), OUT (C),r
      - **DD/FD-prefix (IX/IY)**: LD r,(IX+d) / LD (IX+d),r / LD (IX+d),n, ADD/ADC/SUB/SBC/AND/OR/XOR/CP (IX+d), INC/DEC (IX+d), PUSH/POP IX/IY, LD IX,nn / LD IX,(nn) / LD (nn),IX, ADD IX,rr, INC/DEC IX, JP (IX), EX (SP),IX
      - **DDCB/FDCB**: BIT/SET/RES b,(IX+d) and (IY+d) — displacement comes before the CB sub-opcode
      - Use register encoding: B=0, C=1, D=2, E=3, H=4, L=5, (HL)=6, A=7
      - Use condition encoding: NZ=0, Z=1, NC=2, C=3, PO=4, PE=5, P=6, M=7
      - Use register pair encoding: BC=0, DE=1, HL=2, SP=3 (or AF=3 for PUSH/POP)
      - Export: `{ lookupOpcode, REGISTER_CODES, CONDITION_CODES, PAIR_CODES }`
      - Reference `assembly/index.ts` lines 1184-1526 (main), 485-554 (CB), 559-700 (ED), 930-1138 (DD/FD) for exact opcode values
      - **Started**: TBD
      - **Completed**: TBD
      - **Duration**: TBD
  - [ ] 1.4 Create/update component documentation
    - Create `tools/z80asm/docs/CLAUDE.md` — overview of the assembler modules and how they fit together
    - **Started**: TBD
    - **Completed**: TBD
    - **Duration**: TBD
  - [ ] 1.5 Create phase completion summary
    - Create `docs/tasks/TASK-1.0-FOUNDATION-MODULES-COMPLETION-SUMMARY.md`
    - Include: what was implemented, module APIs, design decisions
    - **Started**: TBD
    - **Completed**: TBD
    - **Duration**: TBD

---

### Phase 2: Instruction Encoding

**Status**: Not Started
**Progress**: 0/4 tasks complete (0%)
**Phase Started**: TBD
**Phase Completed**: TBD

- [ ] 2.0 Create the instruction encoder and two-pass assembler core
  - **Relevant Documentation:**
    - `docs/features/z80-assembler/design.md` — Two-pass assembly (4.5), instruction set (4.4), directives (4.3)
    - `assembly/docs/architecture.md` — Z80 instruction fetch/decode, prefix handling
    - `assembly/docs/CLAUDE.md` — Z80 core overview
    - `docs/architecture.md` — System-wide architecture
    - `CLAUDE.md` — Project conventions
  - [ ] 2.1 Create `tools/z80asm/encoder.js` — Instruction encoder
    - Implement `encodeInstruction(mnemonic, operands, symbols, pc)` that returns an array of bytes
    - Uses `opcodes.js` to look up the base opcode for a mnemonic + operand pattern
    - Uses `expressions.js` to evaluate operand expressions (immediates, addresses, displacements)
    - Handles operand pattern matching: classify each operand as register, register pair, immediate, memory indirect, indexed, condition code, etc.
    - For relative jumps (JR, DJNZ): calculate displacement = target - (pc + 2), validate range -128 to +127
    - For indexed addressing (IX+d, IY+d): extract displacement, validate range -128 to +127
    - For RST: validate target is one of 0x00, 0x08, 0x10, 0x18, 0x20, 0x28, 0x30, 0x38
    - Return `{ bytes: [...], size: N }` or throw error with description
    - Export: `{ encodeInstruction }`
    - **Started**: TBD
    - **Completed**: TBD
    - **Duration**: TBD
  - [ ] 2.2 Create `tools/z80asm/assembler.js` — Two-pass assembler core
    - Implement `assemble(sourceText, options)` where options = `{ org, filename }`
    - **Pass 1**: Iterate all lines via `parser.parseLine()`. For each line:
      - If label: record label → current PC in symbols table. For local labels, prefix with scope.
      - If EQU: evaluate expression (may fail if forward ref), store in symbols
      - If ORG: update PC
      - If DB/DW/DS: calculate size, advance PC
      - If instruction: call `encoder.encodeInstruction()` with a dummy/size-only mode to get instruction size, advance PC
      - If END: stop processing
    - **Pass 2**: Iterate all lines again. For each line:
      - If DB: evaluate each expression/string, emit bytes
      - If DW: evaluate each expression, emit 16-bit LE words
      - If DS: emit N fill bytes
      - If instruction: call `encoder.encodeInstruction()` with full symbols table, emit bytes
    - Collect all emitted bytes into a single binary buffer
    - Track the first ORG address as the load address
    - Return `{ binary: Uint8Array, loadAddress, endAddress, symbols, errors }`
    - If any errors occur during either pass, collect them all (don't stop at first) and return them
    - Export: `{ assemble }`
    - **Started**: TBD
    - **Completed**: TBD
    - **Duration**: TBD
  - [ ] 2.3 Create phase completion summary
    - Create `docs/tasks/TASK-2.0-INSTRUCTION-ENCODING-COMPLETION-SUMMARY.md`
    - **Started**: TBD
    - **Completed**: TBD
    - **Duration**: TBD

---

### Phase 3: TAP Generation & CLI

**Status**: Not Started
**Progress**: 0/5 tasks complete (0%)
**Phase Started**: TBD
**Phase Completed**: TBD

- [ ] 3.0 Create TAP file generator
  - **Relevant Documentation:**
    - `docs/features/z80-assembler/design.md` — TAP output format (4.6), BASIC loader encoding (section 7)
    - `src/docs/architecture.md` — TAP file format details, file loading pipeline
    - `docs/architecture.md` — System-wide architecture
    - `CLAUDE.md` — Project conventions
  - [ ] 3.1 Create `tools/z80asm/tap.js` — TAP file generator
    - Implement `generateTAP(binary, loadAddress, name, autorun)` that returns a `Buffer` containing a valid TAP file
    - **Helper: `makeBlock(flag, data)`** — wraps data in a TAP block: `[2-byte LE length][flag][data][checksum]` where length = 2 + data.length and checksum = XOR of flag + all data bytes
    - **Helper: `makeHeader(type, name, dataLength, param1, param2)`** — creates a 17-byte header payload: type (1 byte), name (10 bytes padded with spaces), dataLength (2 bytes LE), param1 (2 bytes LE), param2 (2 bytes LE)
    - **BASIC loader generation**: Encode a tokenized BASIC program for line 10:
      - `CLEAR {org-1}` → tokens: `0xFD` (CLEAR) + number encoding
      - `:` → `0x3A`
      - `LOAD "" CODE` → `0xEF` (LOAD) + `0x22 0x22` (empty string) + `0xAF` (CODE)
      - If autorun: `:` + `0xF9` (RANDOMIZE) + `0xC0` (USR) + number encoding of org
      - Number encoding: ASCII digits + `0x0E` + 5-byte floating point representation
      - Line format: `[2-byte line number BE][2-byte length LE][tokens][0x0D]`
    - **5-byte float encoding**: Convert integer to Spectrum floating point format (exponent + 4-byte mantissa). For integers 0-65535: exponent=0x00, followed by sign byte, then 2-byte LE value, then 0x00
    - **Build 4 TAP blocks**: BASIC header, BASIC data, CODE header, CODE data
    - Concatenate all blocks and return as Buffer
    - Export: `{ generateTAP }`
    - See design.md section 4.6 for the exact block structure
    - **Started**: TBD
    - **Completed**: TBD
    - **Duration**: TBD

- [ ] 4.0 Create CLI entry point and npm integration
  - **Relevant Documentation:**
    - `docs/features/z80-assembler/design.md` — CLI interface (4.1), usage examples (section 6)
    - `docs/architecture.md` — System-wide architecture
    - `CLAUDE.md` — Project conventions
  - [ ] 4.1 Create `tools/z80asm.js` — CLI entry point
    - Parse command-line arguments: `process.argv` for input file, `-o` output, `--no-autorun`, `--org`
    - Read input file via `fs.readFileSync()`
    - Call `assembler.assemble(source, { org, filename })`
    - If errors: print each error with filename, line number, line text, description. Exit with code 1.
    - If success: call `tap.generateTAP(binary, loadAddress, name, autorun)`, write to output file
    - Print summary: `"Assembled {size} bytes at {loadAddress} → {outputFile}"`
    - Derive output filename from input if `-o` not provided: replace `.asm` extension with `.tap`
    - Derive program name from input filename (first 10 chars, no extension)
    - Handle `--org`: parse as hex (0x prefix) or decimal, default 0x8000
    - Export nothing (this is the CLI entry point, runs via `node tools/z80asm.js`)
    - **Started**: TBD
    - **Completed**: TBD
    - **Duration**: TBD
  - [ ] 4.2 Add `asm` npm script to `package.json`
    - Add to scripts: `"asm": "node tools/z80asm.js"`
    - Usage: `npm run asm -- hello.asm -o hello.tap`
    - **Started**: TBD
    - **Completed**: TBD
    - **Duration**: TBD
  - [ ] 4.3 Create phase completion summary
    - Create `docs/tasks/TASK-3.0-TAP-CLI-COMPLETION-SUMMARY.md`
    - **Started**: TBD
    - **Completed**: TBD
    - **Duration**: TBD

---

### Phase 4: End-to-End Testing & Documentation

**Status**: Not Started
**Progress**: 0/5 tasks complete (0%)
**Phase Started**: TBD
**Phase Completed**: TBD

- [ ] 5.0 Create test programs and verify end-to-end
  - **Relevant Documentation:**
    - `docs/features/z80-assembler/design.md` — Sample source file (section 6), success metrics (section 8)
    - `docs/architecture.md` — System-wide architecture, WASM/JS boundary
    - `CLAUDE.md` — Project conventions
  - [ ] 5.1 Create `examples/border.asm` — simple border color cycler test program
    - A minimal program that cycles border colors using `OUT ($FE), A`
    - Tests: ORG, labels, local labels, LD, OUT, INC, AND, JR
    - Assemble it and verify the TAP loads and runs in the emulator
    - **Started**: TBD
    - **Completed**: TBD
    - **Duration**: TBD
  - [ ] 5.2 Create `examples/hello.asm` — print text to screen test program
    - A program that writes characters to the Spectrum screen using ROM routine RST 0x10
    - Tests: DB with strings, CALL, RST, more LD variants, loop constructs
    - Assemble and verify in emulator
    - **Started**: TBD
    - **Completed**: TBD
    - **Duration**: TBD

- [ ] 6.0 Version bump and final documentation
  - **Relevant Documentation:**
    - `docs/features/z80-assembler/design.md` — Feature requirements
    - `CLAUDE.md` — Project conventions, version sync requirement
  - [ ] 6.1 Bump version in `package.json` and `src/index.html`
    - Increment patch version, keep both files in sync
    - **Started**: TBD
    - **Completed**: TBD
    - **Duration**: TBD
  - [ ] 6.2 Update project documentation
    - Update `CLAUDE.md` to mention the assembler tool and its location
    - Update `docs/architecture.md` if relevant (new tool in tools/)
    - Create `tools/z80asm/docs/CLAUDE.md` with assembler overview, module descriptions, usage examples
    - **Started**: TBD
    - **Completed**: TBD
    - **Duration**: TBD
  - [ ] 6.3 Create phase completion summary
    - Create `docs/tasks/TASK-4.0-TESTING-DOCS-COMPLETION-SUMMARY.md`
    - Include: what was tested, how to use the assembler, known limitations
    - **Started**: TBD
    - **Completed**: TBD
    - **Duration**: TBD

---

## Parallelization Notes

**Phase 1:**
- Sub-tasks 1.1, 1.2, and 1.3 are fully independent modules with no shared code → **Parallel Group A**
- Sub-tasks 1.4 and 1.5 run sequentially after Parallel Group A

**Phase 2:**
- Task 2.1 (encoder) and 2.2 (assembler core) are sequential — the assembler core depends on the encoder
- No parallelization possible within this phase because each module depends on the previous

**Phase 3:**
- Tasks 3.0 (TAP generator) and 4.0 (CLI) could theoretically parallel, but the CLI (4.1) needs to import the TAP generator, so they should be sequential: TAP first, then CLI
- Within 4.0: sub-tasks 4.1 and 4.2 are independent but 4.2 is trivial

**Phase 4:**
- Tasks 5.1 and 5.2 (example programs) are independent and can run in parallel after all code is complete
- Task 6.0 runs last

**Cross-phase dependencies:**
- Phase 2 depends on Phase 1 (encoder uses opcodes.js and expressions.js)
- Phase 3 depends on Phase 2 (CLI orchestrates the assembler)
- Phase 4 depends on Phase 3 (testing needs the complete tool)
