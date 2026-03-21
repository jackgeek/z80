// opcodes.js — Z80 opcode lookup tables for the assembler
//
// This module exports constant tables and codes that the encoder uses
// to construct Z80 machine code bytes from parsed instructions.
//
// Usage:
//   const { REGISTER_CODES, ALU_CODES, SIMPLE_OPCODES, ... } = require('./opcodes');

// ---------------------------------------------------------------------------
// REGISTER_CODES — Standard 3-bit register encoding (bits 0-2 or 3-5)
// ---------------------------------------------------------------------------
const REGISTER_CODES = {
  B: 0, C: 1, D: 2, E: 3, H: 4, L: 5, '(HL)': 6, A: 7,
};

// ---------------------------------------------------------------------------
// CONDITION_CODES — 3-bit condition codes for JP cc, CALL cc, RET cc, JR cc
// ---------------------------------------------------------------------------
// Note: JR only supports NZ, Z, NC, C (codes 0-3).
const CONDITION_CODES = {
  NZ: 0, Z: 1, NC: 2, C: 3, PO: 4, PE: 5, P: 6, M: 7,
};

// ---------------------------------------------------------------------------
// PAIR_CODES — Register pair encoding for 16-bit operations
// Used by: LD rr,nn, INC rr, DEC rr, ADD HL,rr, etc.
// ---------------------------------------------------------------------------
const PAIR_CODES = {
  BC: 0, DE: 1, HL: 2, SP: 3,
};

// ---------------------------------------------------------------------------
// PAIR_CODES_PUSH — Register pair encoding for PUSH/POP
// (AF replaces SP compared to PAIR_CODES)
// ---------------------------------------------------------------------------
const PAIR_CODES_PUSH = {
  BC: 0, DE: 1, HL: 2, AF: 3,
};

// ---------------------------------------------------------------------------
// ALU_CODES — ALU operation encoding (bits 3-5 of opcode)
//
// Encoding patterns:
//   ALU A,r      : 0x80 + (alu << 3) + reg
//   ALU A,n      : 0xC6 + (alu << 3), then n byte
//   ALU A,(HL)   : same as ALU A,r with reg=6
//   ALU A,(IX+d) : prefix, 0x86 + (alu << 3), d
// ---------------------------------------------------------------------------
const ALU_CODES = {
  ADD: 0, ADC: 1, SUB: 2, SBC: 3, AND: 4, XOR: 5, OR: 6, CP: 7,
};

// ---------------------------------------------------------------------------
// SHIFT_CODES — CB-prefix shift/rotate operation encoding
//
// Encoding patterns:
//   SHIFT r          : 0xCB, then (shift << 3) + reg
//   SHIFT (IX+d)     : prefix, 0xCB, d, (shift << 3) + 6
// ---------------------------------------------------------------------------
const SHIFT_CODES = {
  RLC: 0, RRC: 1, RL: 2, RR: 3, SLA: 4, SRA: 5, SLL: 6, SRL: 7,
};

// ---------------------------------------------------------------------------
// SIMPLE_OPCODES — No-operand instructions, single byte
// ---------------------------------------------------------------------------
const SIMPLE_OPCODES = {
  NOP:  0x00,
  RLCA: 0x07,
  RRCA: 0x0F,
  RLA:  0x17,
  RRA:  0x1F,
  DAA:  0x27,
  CPL:  0x2F,
  SCF:  0x37,
  CCF:  0x3F,
  HALT: 0x76,
  DI:   0xF3,
  EI:   0xFB,
  EXX:  0xD9,
};

// ---------------------------------------------------------------------------
// ED_SIMPLE — No-operand ED-prefix instructions
// These are encoded as: 0xED, then the byte listed here.
// ---------------------------------------------------------------------------
const ED_SIMPLE = {
  NEG:  0x44,
  RETN: 0x45,
  RETI: 0x4D,
  RRD:  0x67,
  RLD:  0x6F,
  LDI:  0xA0,
  CPI:  0xA1,
  INI:  0xA2,
  OUTI: 0xA3,
  LDD:  0xA8,
  CPD:  0xA9,
  IND:  0xAA,
  OUTD: 0xAB,
  LDIR: 0xB0,
  CPIR: 0xB1,
  INIR: 0xB2,
  OTIR: 0xB3,
  LDDR: 0xB8,
  CPDR: 0xB9,
  INDR: 0xBA,
  OTDR: 0xBB,
};

// ===========================================================================
// OPCODE ENCODING PATTERNS REFERENCE
// ===========================================================================
//
// The encoder module uses the tables above together with the patterns below
// to emit the correct bytes for each instruction.
//
// ---------------------------------------------------------------------------
// Main opcodes (unprefixed)
// ---------------------------------------------------------------------------
//
//   LD r,r'       : 0x40 + (dst << 3) + src
//                    (but NOT when both dst and src are (HL))
//   LD r,n        : 0x06 + (r << 3), then n byte
//   LD (HL),n     : 0x36, then n byte
//   LD A,(BC)     : 0x0A
//   LD A,(DE)     : 0x1A
//   LD (BC),A     : 0x02
//   LD (DE),A     : 0x12
//   LD A,(nn)     : 0x3A, then nn little-endian
//   LD (nn),A     : 0x32, then nn little-endian
//   LD rr,nn      : 0x01 + (pair << 4), then nn little-endian
//   LD HL,(nn)    : 0x2A, then nn little-endian
//   LD (nn),HL    : 0x22, then nn little-endian
//   LD SP,HL      : 0xF9
//
//   INC r         : 0x04 + (r << 3)
//   DEC r         : 0x05 + (r << 3)
//   INC rr        : 0x03 + (pair << 4)
//   DEC rr        : 0x0B + (pair << 4)
//
//   ADD HL,rr     : 0x09 + (pair << 4)
//
//   ALU A,r       : 0x80 + (alu << 3) + r
//   ALU A,n       : 0xC6 + (alu << 3), then n
//   ALU A,(HL)    : same as ALU A,r with r=6
//
//   JP nn         : 0xC3, then nn little-endian
//   JP cc,nn      : 0xC2 + (cc << 3), then nn little-endian
//   JP (HL)       : 0xE9
//
//   JR e          : 0x18, then displacement byte
//   JR cc,e       : 0x20 + (cc << 3), then displacement
//                    (cc: NZ=0, Z=1, NC=2, C=3 only)
//   DJNZ e        : 0x10, then displacement byte
//
//   CALL nn       : 0xCD, then nn little-endian
//   CALL cc,nn    : 0xC4 + (cc << 3), then nn little-endian
//
//   RET           : 0xC9
//   RET cc        : 0xC0 + (cc << 3)
//
//   RST n         : 0xC7 + n  (n must be 0x00, 0x08, 0x10, ..., 0x38)
//
//   PUSH rr       : 0xC5 + (pair_push << 4)
//   POP rr        : 0xC1 + (pair_push << 4)
//
//   EX DE,HL      : 0xEB
//   EX AF,AF'     : 0x08
//   EX (SP),HL    : 0xE3
//
//   IN A,(n)      : 0xDB, then n
//   OUT (n),A     : 0xD3, then n
//
// ---------------------------------------------------------------------------
// CB prefix — bit manipulation and shifts
// ---------------------------------------------------------------------------
//
//   SHIFT r       : 0xCB, then (shift << 3) + reg
//   BIT b,r       : 0xCB, then 0x40 + (b << 3) + reg
//   SET b,r       : 0xCB, then 0xC0 + (b << 3) + reg
//   RES b,r       : 0xCB, then 0x80 + (b << 3) + reg
//
// ---------------------------------------------------------------------------
// ED prefix
// ---------------------------------------------------------------------------
//
//   IN r,(C)      : 0xED, then 0x40 + (r << 3)
//   OUT (C),r     : 0xED, then 0x41 + (r << 3)
//   SBC HL,rr     : 0xED, then 0x42 + (pair << 4)
//   ADC HL,rr     : 0xED, then 0x4A + (pair << 4)
//   LD (nn),rr    : 0xED, then 0x43 + (pair << 4), then nn little-endian
//   LD rr,(nn)    : 0xED, then 0x4B + (pair << 4), then nn little-endian
//   LD I,A        : 0xED 0x47
//   LD R,A        : 0xED 0x4F
//   LD A,I        : 0xED 0x57
//   LD A,R        : 0xED 0x5F
//   IM 0          : 0xED 0x46
//   IM 1          : 0xED 0x56
//   IM 2          : 0xED 0x5E
//
// ---------------------------------------------------------------------------
// DD/FD prefix (IX = 0xDD, IY = 0xFD)
// ---------------------------------------------------------------------------
//
//   LD r,(IX+d)   : prefix, 0x46 + (r << 3), d
//   LD (IX+d),r   : prefix, 0x70 + r, d
//   LD (IX+d),n   : prefix, 0x36, d, n
//   ALU A,(IX+d)  : prefix, 0x86 + (alu << 3), d
//   INC (IX+d)    : prefix, 0x34, d
//   DEC (IX+d)    : prefix, 0x35, d
//   LD IX,nn      : prefix, 0x21, nn little-endian
//   LD IX,(nn)    : prefix, 0x2A, nn little-endian
//   LD (nn),IX    : prefix, 0x22, nn little-endian
//   PUSH IX       : prefix, 0xE5
//   POP IX        : prefix, 0xE1
//   ADD IX,rr     : prefix, 0x09 + (pair << 4)
//                    (pairs: BC, DE, IX, SP — IX replaces HL in pair encoding)
//   INC IX        : prefix, 0x23
//   DEC IX        : prefix, 0x2B
//   JP (IX)       : prefix, 0xE9
//   EX (SP),IX    : prefix, 0xE3
//   LD SP,IX      : prefix, 0xF9
//
// ---------------------------------------------------------------------------
// DDCB/FDCB prefix (indexed bit operations)
// ---------------------------------------------------------------------------
//
//   BIT b,(IX+d)  : prefix, 0xCB, d, 0x46 + (b << 3)
//   SET b,(IX+d)  : prefix, 0xCB, d, 0xC6 + (b << 3)
//   RES b,(IX+d)  : prefix, 0xCB, d, 0x86 + (b << 3)
//   RLC (IX+d)    : prefix, 0xCB, d, 0x06
//   (other shifts) : prefix, 0xCB, d, (shift << 3) + 6
//
// ===========================================================================

module.exports = {
  REGISTER_CODES,
  CONDITION_CODES,
  PAIR_CODES,
  PAIR_CODES_PUSH,
  ALU_CODES,
  SHIFT_CODES,
  SIMPLE_OPCODES,
  ED_SIMPLE,
};
