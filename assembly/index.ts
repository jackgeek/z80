// ZX Spectrum 48K Emulator - WebAssembly Core
// Z80 CPU + ULA + Memory + TAP loading

// ============================================================
// MEMORY LAYOUT (in WASM linear memory, imported from JS)
// 0x000000 - 0x00FFFF: Spectrum 64KB address space (0x0000-0x3FFF = ROM)
// 0x010000 - 0x03FFFF: Screen pixel buffer (256*192*4 = 196608 bytes, RGBA)
// 0x040000 - 0x0BFFFF: TAP file buffer (up to 512KB)
// ============================================================

// Start at 1MB to avoid overlapping AssemblyScript's own static data/heap
const MEM_BASE: u32    = 0x100000;  // 1MB: Spectrum 64KB address space
const SCREEN_BASE: u32 = 0x110000;  // 1MB+64K: Screen pixel buffer (256*192*4)
const TAP_BASE: u32    = 0x140000;  // 1MB+256K: TAP file buffer
const TAP_MAX: u32     = 0x080000;  // 512KB max TAP size

// ============================================================
// FLAGS
// ============================================================
const FLAG_C:  u8 = 0x01;
const FLAG_N:  u8 = 0x02;
const FLAG_PV: u8 = 0x04;
const FLAG_3:  u8 = 0x08;
const FLAG_H:  u8 = 0x10;
const FLAG_5:  u8 = 0x20;
const FLAG_Z:  u8 = 0x40;
const FLAG_S:  u8 = 0x80;

// ============================================================
// COLOR TABLE (ABGR for ImageData on little-endian)
// ============================================================
// @ts-ignore: decorator
@inline function COLOR(r: u8, g: u8, b: u8): u32 {
  return 0xFF000000 | (<u32>b << 16) | (<u32>g << 8) | <u32>r;
}

const COLORS: StaticArray<u32> = [
  0xFF000000, // 0: black
  0xFFCD0000, // 1: blue
  0xFF0000CD, // 2: red
  0xFFCD00CD, // 3: magenta
  0xFF00CD00, // 4: green
  0xFFCDCD00, // 5: cyan
  0xFF00CDCD, // 6: yellow
  0xFFCDCDCD, // 7: white
  0xFF000000, // 8: bright black
  0xFFFF0000, // 9: bright blue
  0xFF0000FF, // 10: bright red
  0xFFFF00FF, // 11: bright magenta
  0xFF00FF00, // 12: bright green
  0xFFFFFF00, // 13: bright cyan
  0xFF00FFFF, // 14: bright yellow
  0xFFFFFFFF, // 15: bright white
];

// ============================================================
// LOOKUP TABLES
// ============================================================
const sz53Table: StaticArray<u8> = new StaticArray<u8>(256);
const parityTable: StaticArray<u8> = new StaticArray<u8>(256);
const sz53pTable: StaticArray<u8> = new StaticArray<u8>(256);

function initTables(): void {
  for (let i: i32 = 0; i < 256; i++) {
    let v: u8 = <u8>i;
    // S, 5, 3 flags from value
    let s53: u8 = v & 0xA8; // bits 7,5,3
    if (v == 0) s53 |= FLAG_Z;
    unchecked(sz53Table[i] = s53);

    // Parity: even number of bits = PV set
    let bits: u8 = v;
    bits = (bits ^ (bits >> 4));
    bits = (bits ^ (bits >> 2));
    bits = (bits ^ (bits >> 1));
    let par: u8 = (bits & 1) ? 0 : FLAG_PV;
    unchecked(parityTable[i] = par);
    unchecked(sz53pTable[i] = s53 | par);
  }
}

// ============================================================
// Z80 REGISTERS
// ============================================================
let A: u8 = 0xFF, F: u8 = 0xFF;
let B: u8 = 0, C: u8 = 0;
let D: u8 = 0, E: u8 = 0;
let H: u8 = 0, L: u8 = 0;

// Shadow registers
let A2: u8 = 0, F2: u8 = 0;
let B2: u8 = 0, C2: u8 = 0;
let D2: u8 = 0, E2: u8 = 0;
let H2: u8 = 0, L2: u8 = 0;

// Index registers
let IX: u16 = 0, IY: u16 = 0;

// Stack pointer and program counter
let SP: u16 = 0xFFFF, PC: u16 = 0;

// Interrupt and refresh
let I_reg: u8 = 0, R_reg: u8 = 0;
let IFF1: bool = false, IFF2: bool = false;
let IM: u8 = 0;
let halted: bool = false;

// Cycle counter
let cycles: i32 = 0;
const CYCLES_PER_FRAME: i32 = 69888;

// ============================================================
// SPECTRUM STATE
// ============================================================
let borderColor: u8 = 7; // white border
let flashState: bool = false;
let frameCount: u32 = 0;

// Keyboard: 8 rows, bits 0-4 (0 = pressed)
const keyboardState: StaticArray<u8> = new StaticArray<u8>(8);

// TAP file state
let tapSize: u32 = 0;
let tapPos: u32 = 0;
let tapLoaded: bool = false;

// Audio: beeper state and sample buffer
// We record one sample per AUDIO_DIVISOR T-states
// At 69888 T-states/frame and ~44100 Hz audio at 50fps → ~882 samples/frame
const AUDIO_SAMPLES_PER_FRAME: i32 = 882;
const AUDIO_DIVISOR: i32 = 79; // 69888 / 882 ≈ 79
const AUDIO_BASE: u32 = 0x1C0000; // audio sample buffer in WASM memory
let beeperState: u8 = 0; // current beeper level (0 or 1)
let audioSampleIndex: i32 = 0;
let audioCycleAccum: i32 = 0;

// ============================================================
// REGISTER PAIR HELPERS
// ============================================================
// @ts-ignore: decorator
@inline function getBC(): u16 { return (<u16>B << 8) | <u16>C; }
// @ts-ignore: decorator
@inline function getDE(): u16 { return (<u16>D << 8) | <u16>E; }
// @ts-ignore: decorator
@inline function getHL(): u16 { return (<u16>H << 8) | <u16>L; }
// @ts-ignore: decorator
@inline function getAF(): u16 { return (<u16>A << 8) | <u16>F; }

// @ts-ignore: decorator
@inline function setBC(v: u16): void { B = <u8>(v >> 8); C = <u8>(v & 0xFF); }
// @ts-ignore: decorator
@inline function setDE(v: u16): void { D = <u8>(v >> 8); E = <u8>(v & 0xFF); }
// @ts-ignore: decorator
@inline function setHL(v: u16): void { H = <u8>(v >> 8); L = <u8>(v & 0xFF); }
// @ts-ignore: decorator
@inline function setAF(v: u16): void { A = <u8>(v >> 8); F = <u8>(v & 0xFF); }

// ============================================================
// MEMORY ACCESS
// ============================================================
// @ts-ignore: decorator
@inline function readByte(addr: u16): u8 {
  return load<u8>(MEM_BASE + <u32>addr);
}

// @ts-ignore: decorator
@inline function writeByte(addr: u16, val: u8): void {
  // Don't write to ROM (0x0000-0x3FFF)
  if (addr >= 0x4000) {
    store<u8>(MEM_BASE + <u32>addr, val);
  }
}

// @ts-ignore: decorator
@inline function readWord(addr: u16): u16 {
  return <u16>load<u8>(MEM_BASE + <u32>addr) | (<u16>load<u8>(MEM_BASE + <u32>((addr + 1) & 0xFFFF)) << 8);
}

// @ts-ignore: decorator
@inline function writeWord(addr: u16, val: u16): void {
  writeByte(addr, <u8>(val & 0xFF));
  writeByte((addr + 1) & 0xFFFF, <u8>(val >> 8));
}

// @ts-ignore: decorator
@inline function fetchByte(): u8 {
  let v = readByte(PC);
  PC = (PC + 1) & 0xFFFF;
  return v;
}

// @ts-ignore: decorator
@inline function fetchWord(): u16 {
  let lo = fetchByte();
  let hi = fetchByte();
  return (<u16>hi << 8) | <u16>lo;
}

// Push/Pop helpers
// @ts-ignore: decorator
@inline function pushWord(val: u16): void {
  SP = (SP - 2) & 0xFFFF;
  writeWord(SP, val);
}

// @ts-ignore: decorator
@inline function popWord(): u16 {
  let val = readWord(SP);
  SP = (SP + 2) & 0xFFFF;
  return val;
}

// ============================================================
// I/O PORTS
// ============================================================
function portIn(port: u16): u8 {
  // ULA port (any even port, bit 0 of port low byte = 0)
  if ((port & 0x01) == 0) {
    let result: u8 = 0xFF; // all keys released (active low)
    let highByte: u8 = <u8>(port >> 8);
    // Check each keyboard row
    for (let row: i32 = 0; row < 8; row++) {
      if ((highByte & (<u8>1 << <u8>row)) == 0) {
        result &= unchecked(keyboardState[row]);
      }
    }
    // Bits 5-7: bit 6 = ear input (0), bits 5,7 = 1
    result = (result & 0x1F) | 0xA0;
    return result;
  }
  // Kempston joystick (port 0x1F) - no joystick, return 0
  if ((port & 0xFF) == 0x1F) return 0;
  // Floating bus / default
  return 0xFF;
}

function portOut(port: u16, val: u8): void {
  // ULA port
  if ((port & 0x01) == 0) {
    borderColor = val & 0x07;
    // bit 4 = EAR (speaker)
    beeperState = (val >> 4) & 1;
  }
}

// ============================================================
// REGISTER ACCESS BY INDEX (for opcode decoding)
// ============================================================
function getReg(r: u8): u8 {
  switch (r) {
    case 0: return B;
    case 1: return C;
    case 2: return D;
    case 3: return E;
    case 4: return H;
    case 5: return L;
    case 6: return readByte(getHL());
    case 7: return A;
    default: return 0;
  }
}

function setReg(r: u8, val: u8): void {
  switch (r) {
    case 0: B = val; break;
    case 1: C = val; break;
    case 2: D = val; break;
    case 3: E = val; break;
    case 4: H = val; break;
    case 5: L = val; break;
    case 6: writeByte(getHL(), val); break;
    case 7: A = val; break;
  }
}

function getReg16(rr: u8): u16 {
  switch (rr) {
    case 0: return getBC();
    case 1: return getDE();
    case 2: return getHL();
    case 3: return SP;
    default: return 0;
  }
}

function setReg16(rr: u8, val: u16): void {
  switch (rr) {
    case 0: setBC(val); break;
    case 1: setDE(val); break;
    case 2: setHL(val); break;
    case 3: SP = val; break;
  }
}

function getReg16AF(rr: u8): u16 {
  switch (rr) {
    case 0: return getBC();
    case 1: return getDE();
    case 2: return getHL();
    case 3: return getAF();
    default: return 0;
  }
}

function setReg16AF(rr: u8, val: u16): void {
  switch (rr) {
    case 0: setBC(val); break;
    case 1: setDE(val); break;
    case 2: setHL(val); break;
    case 3: setAF(val); break;
  }
}

// ============================================================
// ALU OPERATIONS
// ============================================================
function addA(val: u8): void {
  let result: u16 = <u16>A + <u16>val;
  let lookup: u8 = <u8>(((A & 0x88) >> 3) | ((val & 0x88) >> 2) | ((<u8>result & 0x88) >> 1));
  A = <u8>result;
  F = unchecked(sz53Table[A]) |
      (result & 0x100 ? FLAG_C : 0) |
      (halfcarryAddTable(lookup & 0x07)) |
      (overflowAddTable(lookup >> 4));
}

function adcA(val: u8): void {
  let carry: u16 = <u16>(F & FLAG_C);
  let result: u16 = <u16>A + <u16>val + carry;
  let lookup: u8 = <u8>(((A & 0x88) >> 3) | ((val & 0x88) >> 2) | ((<u8>result & 0x88) >> 1));
  A = <u8>result;
  F = unchecked(sz53Table[A]) |
      (result & 0x100 ? FLAG_C : 0) |
      (halfcarryAddTable(lookup & 0x07)) |
      (overflowAddTable(lookup >> 4));
}

function subA(val: u8): void {
  let result: u16 = <u16>A - <u16>val;
  let lookup: u8 = <u8>(((A & 0x88) >> 3) | ((val & 0x88) >> 2) | ((<u8>result & 0x88) >> 1));
  A = <u8>result;
  F = unchecked(sz53Table[A]) | FLAG_N |
      (result & 0x100 ? FLAG_C : 0) |
      (halfcarrySubTable(lookup & 0x07)) |
      (overflowSubTable(lookup >> 4));
}

function sbcA(val: u8): void {
  let carry: u16 = <u16>(F & FLAG_C);
  let result: u16 = <u16>A - <u16>val - carry;
  let lookup: u8 = <u8>(((A & 0x88) >> 3) | ((val & 0x88) >> 2) | ((<u8>result & 0x88) >> 1));
  A = <u8>result;
  F = unchecked(sz53Table[A]) | FLAG_N |
      (result & 0x100 ? FLAG_C : 0) |
      (halfcarrySubTable(lookup & 0x07)) |
      (overflowSubTable(lookup >> 4));
}

function andA(val: u8): void {
  A &= val;
  F = unchecked(sz53pTable[A]) | FLAG_H;
}

function xorA(val: u8): void {
  A ^= val;
  F = unchecked(sz53pTable[A]);
}

function orA(val: u8): void {
  A |= val;
  F = unchecked(sz53pTable[A]);
}

function cpA(val: u8): void {
  let result: u16 = <u16>A - <u16>val;
  let lookup: u8 = <u8>(((A & 0x88) >> 3) | ((val & 0x88) >> 2) | ((<u8>result & 0x88) >> 1));
  // Note: bits 3,5 come from the operand, not the result
  F = (unchecked(sz53Table[<u8>result]) & (FLAG_S | FLAG_Z)) | FLAG_N |
      (val & (FLAG_5 | FLAG_3)) |
      (result & 0x100 ? FLAG_C : 0) |
      (halfcarrySubTable(lookup & 0x07)) |
      (overflowSubTable(lookup >> 4));
}

function incVal(val: u8): u8 {
  let result: u8 = val + 1;
  F = (F & FLAG_C) | (result == 0x80 ? FLAG_PV : 0) |
      ((result & 0x0F) == 0 ? FLAG_H : 0) |
      unchecked(sz53Table[result]);
  return result;
}

function decVal(val: u8): u8 {
  let result: u8 = val - 1;
  F = (F & FLAG_C) | FLAG_N | (val == 0x80 ? FLAG_PV : 0) |
      ((result & 0x0F) == 0x0F ? FLAG_H : 0) |
      unchecked(sz53Table[result]);
  return result;
}

// Half-carry and overflow lookup tables (module-level to avoid heap allocation)
const _halfcarryAdd: StaticArray<u8> = [0, FLAG_H, FLAG_H, FLAG_H, 0, 0, 0, FLAG_H];
const _halfcarrySub: StaticArray<u8> = [0, 0, FLAG_H, 0, FLAG_H, 0, FLAG_H, FLAG_H];
const _overflowAdd: StaticArray<u8>  = [0, 0, 0, FLAG_PV, FLAG_PV, 0, 0, 0];
const _overflowSub: StaticArray<u8>  = [0, FLAG_PV, 0, 0, 0, 0, FLAG_PV, 0];

// @ts-ignore: decorator
@inline function halfcarryAddTable(idx: u8): u8 {
  return unchecked(_halfcarryAdd[idx & 7]);
}

// @ts-ignore: decorator
@inline function halfcarrySubTable(idx: u8): u8 {
  return unchecked(_halfcarrySub[idx & 7]);
}

// @ts-ignore: decorator
@inline function overflowAddTable(idx: u8): u8 {
  return unchecked(_overflowAdd[idx & 7]);
}

// @ts-ignore: decorator
@inline function overflowSubTable(idx: u8): u8 {
  return unchecked(_overflowSub[idx & 7]);
}

// ADD HL, rr (16-bit add)
function addHL(val: u16): void {
  let hl: u32 = <u32>getHL();
  let result: u32 = hl + <u32>val;
  let r16: u16 = <u16>(result & 0xFFFF);
  F = (F & (FLAG_S | FLAG_Z | FLAG_PV)) |
      (result & 0x10000 ? FLAG_C : 0) |
      (<u8>((r16 >> 8) & (FLAG_5 | FLAG_3))) |
      (<u8>(((hl ^ <u32>val ^ result) >> 8) & 0x10) ? FLAG_H : 0);
  setHL(r16);
}

// ============================================================
// CONDITION CODES
// ============================================================
function getCondition(cc: u8): bool {
  switch (cc) {
    case 0: return (F & FLAG_Z) == 0;   // NZ
    case 1: return (F & FLAG_Z) != 0;   // Z
    case 2: return (F & FLAG_C) == 0;   // NC
    case 3: return (F & FLAG_C) != 0;   // C
    case 4: return (F & FLAG_PV) == 0;  // PO
    case 5: return (F & FLAG_PV) != 0;  // PE
    case 6: return (F & FLAG_S) == 0;   // P
    case 7: return (F & FLAG_S) != 0;   // M
    default: return false;
  }
}

// ============================================================
// CB PREFIX INSTRUCTIONS
// ============================================================
function executeCB(): i32 {
  let op: u8 = fetchByte();
  R_reg = (R_reg + 1) & 0x7F;
  let r: u8 = op & 0x07;
  let val: u8 = getReg(r);
  let bit: u8 = (op >> 3) & 0x07;
  let result: u8;

  if (op < 0x40) {
    // Rotates and shifts
    switch (op >> 3) {
      case 0: // RLC r
        result = (val << 1) | (val >> 7);
        F = unchecked(sz53pTable[result]) | (val >> 7);
        setReg(r, result);
        break;
      case 1: // RRC r
        result = (val >> 1) | (val << 7);
        F = unchecked(sz53pTable[result]) | (val & 1);
        setReg(r, result);
        break;
      case 2: // RL r
        result = (val << 1) | (F & FLAG_C);
        F = unchecked(sz53pTable[result]) | (val >> 7);
        setReg(r, result);
        break;
      case 3: // RR r
        result = (val >> 1) | ((F & FLAG_C) << 7);
        F = unchecked(sz53pTable[result]) | (val & 1);
        setReg(r, result);
        break;
      case 4: // SLA r
        result = val << 1;
        F = unchecked(sz53pTable[result]) | (val >> 7);
        setReg(r, result);
        break;
      case 5: // SRA r
        result = (val >> 1) | (val & 0x80);
        F = unchecked(sz53pTable[result]) | (val & 1);
        setReg(r, result);
        break;
      case 6: // SLL r (undocumented: shift left, bit 0 = 1)
        result = (val << 1) | 1;
        F = unchecked(sz53pTable[result]) | (val >> 7);
        setReg(r, result);
        break;
      case 7: // SRL r
        result = val >> 1;
        F = unchecked(sz53pTable[result]) | (val & 1);
        setReg(r, result);
        break;
    }
  } else if (op < 0x80) {
    // BIT b, r
    let mask: u8 = (<u8>1) << bit;
    let masked: u8 = val & mask;
    F = (F & FLAG_C) | FLAG_H |
        (masked == 0 ? (FLAG_Z | FLAG_PV) : 0) |
        (masked & FLAG_S) |
        (val & (FLAG_5 | FLAG_3));
  } else if (op < 0xC0) {
    // RES b, r
    setReg(r, val & ~((<u8>1) << bit));
  } else {
    // SET b, r
    setReg(r, val | ((<u8>1) << bit));
  }

  return r == 6 ? 15 : 8; // (HL) variants take longer
}

// ============================================================
// ED PREFIX INSTRUCTIONS
// ============================================================
function executeED(): i32 {
  let op: u8 = fetchByte();
  R_reg = (R_reg + 1) & 0x7F;

  switch (op) {
    // IN r, (C)
    case 0x40: B = inC(); return 12;
    case 0x48: C = inC(); return 12;
    case 0x50: D = inC(); return 12;
    case 0x58: E = inC(); return 12;
    case 0x60: H = inC(); return 12;
    case 0x68: L = inC(); return 12;
    case 0x70: inC(); return 12; // IN (C) - result discarded
    case 0x78: A = inC(); return 12;

    // OUT (C), r
    case 0x41: portOut(getBC(), B); return 12;
    case 0x49: portOut(getBC(), C); return 12;
    case 0x51: portOut(getBC(), D); return 12;
    case 0x59: portOut(getBC(), E); return 12;
    case 0x61: portOut(getBC(), H); return 12;
    case 0x69: portOut(getBC(), L); return 12;
    case 0x71: portOut(getBC(), 0); return 12;
    case 0x79: portOut(getBC(), A); return 12;

    // SBC HL, rr
    case 0x42: sbcHL(getBC()); return 15;
    case 0x52: sbcHL(getDE()); return 15;
    case 0x62: sbcHL(getHL()); return 15;
    case 0x72: sbcHL(SP); return 15;

    // ADC HL, rr
    case 0x4A: adcHL(getBC()); return 15;
    case 0x5A: adcHL(getDE()); return 15;
    case 0x6A: adcHL(getHL()); return 15;
    case 0x7A: adcHL(SP); return 15;

    // LD (nn), rr
    case 0x43: { let addr = fetchWord(); writeWord(addr, getBC()); return 20; }
    case 0x53: { let addr = fetchWord(); writeWord(addr, getDE()); return 20; }
    case 0x63: { let addr = fetchWord(); writeWord(addr, getHL()); return 20; }
    case 0x73: { let addr = fetchWord(); writeWord(addr, SP); return 20; }

    // LD rr, (nn)
    case 0x4B: { let addr = fetchWord(); setBC(readWord(addr)); return 20; }
    case 0x5B: { let addr = fetchWord(); setDE(readWord(addr)); return 20; }
    case 0x6B: { let addr = fetchWord(); setHL(readWord(addr)); return 20; }
    case 0x7B: { let addr = fetchWord(); SP = readWord(addr); return 20; }

    // NEG
    case 0x44: case 0x4C: case 0x54: case 0x5C:
    case 0x64: case 0x6C: case 0x74: case 0x7C: {
      let prev = A;
      A = 0;
      subA(prev);
      return 8;
    }

    // RETN
    case 0x45: case 0x55: case 0x65: case 0x75: {
      IFF1 = IFF2;
      PC = popWord();
      return 14;
    }

    // RETI
    case 0x4D: case 0x5D: case 0x6D: case 0x7D: {
      IFF1 = IFF2;
      PC = popWord();
      return 14;
    }

    // IM
    case 0x46: case 0x4E: case 0x66: case 0x6E: IM = 0; return 8;
    case 0x56: case 0x76: IM = 1; return 8;
    case 0x5E: case 0x7E: IM = 2; return 8;

    // LD I,A / LD R,A / LD A,I / LD A,R
    case 0x47: I_reg = A; return 9;
    case 0x4F: R_reg = A; return 9;
    case 0x57: { // LD A, I
      A = I_reg;
      F = (F & FLAG_C) | unchecked(sz53Table[A]) | (IFF2 ? FLAG_PV : 0);
      return 9;
    }
    case 0x5F: { // LD A, R
      A = R_reg;
      F = (F & FLAG_C) | unchecked(sz53Table[A]) | (IFF2 ? FLAG_PV : 0);
      return 9;
    }

    // RRD
    case 0x67: {
      let memval = readByte(getHL());
      let newmem: u8 = (A << 4) | (memval >> 4);
      A = (A & 0xF0) | (memval & 0x0F);
      writeByte(getHL(), newmem);
      F = (F & FLAG_C) | unchecked(sz53pTable[A]);
      return 18;
    }

    // RLD
    case 0x6F: {
      let memval = readByte(getHL());
      let newmem: u8 = (memval << 4) | (A & 0x0F);
      A = (A & 0xF0) | (memval >> 4);
      writeByte(getHL(), newmem);
      F = (F & FLAG_C) | unchecked(sz53pTable[A]);
      return 18;
    }

    // LDI
    case 0xA0: {
      let val = readByte(getHL());
      writeByte(getDE(), val);
      setHL((getHL() + 1) & 0xFFFF);
      setDE((getDE() + 1) & 0xFFFF);
      setBC((getBC() - 1) & 0xFFFF);
      let n: u8 = val + A;
      F = (F & (FLAG_S | FLAG_Z | FLAG_C)) |
          (getBC() != 0 ? FLAG_PV : 0) |
          (n & FLAG_3) | ((n & 0x02) ? FLAG_5 : 0);
      return 16;
    }

    // LDIR
    case 0xB0: {
      let val = readByte(getHL());
      writeByte(getDE(), val);
      setHL((getHL() + 1) & 0xFFFF);
      setDE((getDE() + 1) & 0xFFFF);
      setBC((getBC() - 1) & 0xFFFF);
      let n: u8 = val + A;
      F = (F & (FLAG_S | FLAG_Z | FLAG_C)) |
          (getBC() != 0 ? FLAG_PV : 0) |
          (n & FLAG_3) | ((n & 0x02) ? FLAG_5 : 0);
      if (getBC() != 0) {
        PC = (PC - 2) & 0xFFFF;
        return 21;
      }
      return 16;
    }

    // LDD
    case 0xA8: {
      let val = readByte(getHL());
      writeByte(getDE(), val);
      setHL((getHL() - 1) & 0xFFFF);
      setDE((getDE() - 1) & 0xFFFF);
      setBC((getBC() - 1) & 0xFFFF);
      let n: u8 = val + A;
      F = (F & (FLAG_S | FLAG_Z | FLAG_C)) |
          (getBC() != 0 ? FLAG_PV : 0) |
          (n & FLAG_3) | ((n & 0x02) ? FLAG_5 : 0);
      return 16;
    }

    // LDDR
    case 0xB8: {
      let val = readByte(getHL());
      writeByte(getDE(), val);
      setHL((getHL() - 1) & 0xFFFF);
      setDE((getDE() - 1) & 0xFFFF);
      setBC((getBC() - 1) & 0xFFFF);
      let n: u8 = val + A;
      F = (F & (FLAG_S | FLAG_Z | FLAG_C)) |
          (getBC() != 0 ? FLAG_PV : 0) |
          (n & FLAG_3) | ((n & 0x02) ? FLAG_5 : 0);
      if (getBC() != 0) {
        PC = (PC - 2) & 0xFFFF;
        return 21;
      }
      return 16;
    }

    // CPI
    case 0xA1: {
      let val = readByte(getHL());
      let result: u8 = A - val;
      setHL((getHL() + 1) & 0xFFFF);
      setBC((getBC() - 1) & 0xFFFF);
      let hc: bool = (A & 0x0F) < (val & 0x0F);
      let n2: u8 = result - (hc ? 1 : 0);
      F = (F & FLAG_C) | FLAG_N |
          (getBC() != 0 ? FLAG_PV : 0) |
          (hc ? FLAG_H : 0) |
          (result == 0 ? FLAG_Z : 0) |
          (result & FLAG_S) |
          (n2 & FLAG_3) | ((n2 & 0x02) ? FLAG_5 : 0);
      return 16;
    }

    // CPIR
    case 0xB1: {
      let val = readByte(getHL());
      let result: u8 = A - val;
      setHL((getHL() + 1) & 0xFFFF);
      setBC((getBC() - 1) & 0xFFFF);
      let hc: bool = (A & 0x0F) < (val & 0x0F);
      let n2: u8 = result - (hc ? 1 : 0);
      F = (F & FLAG_C) | FLAG_N |
          (getBC() != 0 ? FLAG_PV : 0) |
          (hc ? FLAG_H : 0) |
          (result == 0 ? FLAG_Z : 0) |
          (result & FLAG_S) |
          (n2 & FLAG_3) | ((n2 & 0x02) ? FLAG_5 : 0);
      if (getBC() != 0 && result != 0) {
        PC = (PC - 2) & 0xFFFF;
        return 21;
      }
      return 16;
    }

    // CPD
    case 0xA9: {
      let val = readByte(getHL());
      let result: u8 = A - val;
      setHL((getHL() - 1) & 0xFFFF);
      setBC((getBC() - 1) & 0xFFFF);
      let hc: bool = (A & 0x0F) < (val & 0x0F);
      let n2: u8 = result - (hc ? 1 : 0);
      F = (F & FLAG_C) | FLAG_N |
          (getBC() != 0 ? FLAG_PV : 0) |
          (hc ? FLAG_H : 0) |
          (result == 0 ? FLAG_Z : 0) |
          (result & FLAG_S) |
          (n2 & FLAG_3) | ((n2 & 0x02) ? FLAG_5 : 0);
      return 16;
    }

    // CPDR
    case 0xB9: {
      let val = readByte(getHL());
      let result: u8 = A - val;
      setHL((getHL() - 1) & 0xFFFF);
      setBC((getBC() - 1) & 0xFFFF);
      let hc: bool = (A & 0x0F) < (val & 0x0F);
      let n2: u8 = result - (hc ? 1 : 0);
      F = (F & FLAG_C) | FLAG_N |
          (getBC() != 0 ? FLAG_PV : 0) |
          (hc ? FLAG_H : 0) |
          (result == 0 ? FLAG_Z : 0) |
          (result & FLAG_S) |
          (n2 & FLAG_3) | ((n2 & 0x02) ? FLAG_5 : 0);
      if (getBC() != 0 && result != 0) {
        PC = (PC - 2) & 0xFFFF;
        return 21;
      }
      return 16;
    }

    // INI
    case 0xA2: {
      let val = portIn(getBC());
      writeByte(getHL(), val);
      B = decVal(B);
      setHL((getHL() + 1) & 0xFFFF);
      return 16;
    }

    // INIR
    case 0xB2: {
      let val = portIn(getBC());
      writeByte(getHL(), val);
      B = decVal(B);
      setHL((getHL() + 1) & 0xFFFF);
      if (B != 0) { PC = (PC - 2) & 0xFFFF; return 21; }
      return 16;
    }

    // IND
    case 0xAA: {
      let val = portIn(getBC());
      writeByte(getHL(), val);
      B = decVal(B);
      setHL((getHL() - 1) & 0xFFFF);
      return 16;
    }

    // INDR
    case 0xBA: {
      let val = portIn(getBC());
      writeByte(getHL(), val);
      B = decVal(B);
      setHL((getHL() - 1) & 0xFFFF);
      if (B != 0) { PC = (PC - 2) & 0xFFFF; return 21; }
      return 16;
    }

    // OUTI
    case 0xA3: {
      let val = readByte(getHL());
      B = decVal(B);
      portOut(getBC(), val);
      setHL((getHL() + 1) & 0xFFFF);
      return 16;
    }

    // OTIR
    case 0xB3: {
      let val = readByte(getHL());
      B = decVal(B);
      portOut(getBC(), val);
      setHL((getHL() + 1) & 0xFFFF);
      if (B != 0) { PC = (PC - 2) & 0xFFFF; return 21; }
      return 16;
    }

    // OUTD
    case 0xAB: {
      let val = readByte(getHL());
      B = decVal(B);
      portOut(getBC(), val);
      setHL((getHL() - 1) & 0xFFFF);
      return 16;
    }

    // OTDR
    case 0xBB: {
      let val = readByte(getHL());
      B = decVal(B);
      portOut(getBC(), val);
      setHL((getHL() - 1) & 0xFFFF);
      if (B != 0) { PC = (PC - 2) & 0xFFFF; return 21; }
      return 16;
    }

    default:
      return 8; // NOP for unknown ED instructions
  }
  return 8;
}

// IN r, (C) helper
function inC(): u8 {
  let val = portIn(getBC());
  F = (F & FLAG_C) | unchecked(sz53pTable[val]);
  return val;
}

// SBC HL, rr
function sbcHL(val: u16): void {
  let hl: u32 = <u32>getHL();
  let carry: u32 = <u32>(F & FLAG_C);
  let result: u32 = hl - <u32>val - carry;
  let r16: u16 = <u16>(result & 0xFFFF);
  F = (<u8>((r16 >> 8) & (FLAG_S | FLAG_5 | FLAG_3))) | FLAG_N |
      (r16 == 0 ? FLAG_Z : 0) |
      (result & 0x10000 ? FLAG_C : 0) |
      (<u8>((((hl ^ <u32>val) & (hl ^ result)) >> 8) & 0x80) ? FLAG_PV : 0) |
      (<u8>(((hl ^ <u32>val ^ result) >> 8) & 0x10) ? FLAG_H : 0);
  setHL(r16);
}

// ADC HL, rr
function adcHL(val: u16): void {
  let hl: u32 = <u32>getHL();
  let carry: u32 = <u32>(F & FLAG_C);
  let result: u32 = hl + <u32>val + carry;
  let r16: u16 = <u16>(result & 0xFFFF);
  F = (<u8>((r16 >> 8) & (FLAG_S | FLAG_5 | FLAG_3))) |
      (r16 == 0 ? FLAG_Z : 0) |
      (result & 0x10000 ? FLAG_C : 0) |
      (<u8>(((~(hl ^ <u32>val) & (hl ^ result)) >> 8) & 0x80) ? FLAG_PV : 0) |
      (<u8>(((hl ^ <u32>val ^ result) >> 8) & 0x10) ? FLAG_H : 0);
  setHL(r16);
}

// ============================================================
// DD/FD PREFIX (IX/IY INSTRUCTIONS)
// ============================================================
function executeIndexed(isIY: bool): i32 {
  let op: u8 = fetchByte();
  R_reg = (R_reg + 1) & 0x7F;
  let idx: u16 = isIY ? IY : IX;

  switch (op) {
    // ADD IX, rr
    case 0x09: { idx = addIdx(idx, getBC()); break; }
    case 0x19: { idx = addIdx(idx, getDE()); break; }
    case 0x29: { idx = addIdx(idx, idx); break; }
    case 0x39: { idx = addIdx(idx, SP); break; }

    // LD IX, nn
    case 0x21: { idx = fetchWord(); break; }

    // LD (nn), IX
    case 0x22: { let addr = fetchWord(); writeWord(addr, idx); break; }

    // INC IX
    case 0x23: { idx = (idx + 1) & 0xFFFF; break; }

    // INC IXH
    case 0x24: { idx = (<u16>incVal(<u8>(idx >> 8)) << 8) | (idx & 0xFF); break; }

    // DEC IXH
    case 0x25: { idx = (<u16>decVal(<u8>(idx >> 8)) << 8) | (idx & 0xFF); break; }

    // LD IXH, n
    case 0x26: { idx = (<u16>fetchByte() << 8) | (idx & 0xFF); break; }

    // LD IX, (nn)
    case 0x2A: { let addr = fetchWord(); idx = readWord(addr); break; }

    // DEC IX
    case 0x2B: { idx = (idx - 1) & 0xFFFF; break; }

    // INC IXL
    case 0x2C: { idx = (idx & 0xFF00) | <u16>incVal(<u8>(idx & 0xFF)); break; }

    // DEC IXL
    case 0x2D: { idx = (idx & 0xFF00) | <u16>decVal(<u8>(idx & 0xFF)); break; }

    // LD IXL, n
    case 0x2E: { idx = (idx & 0xFF00) | <u16>fetchByte(); break; }

    // INC (IX+d)
    case 0x34: {
      let d: i8 = <i8>fetchByte();
      let addr: u16 = (idx + <u16><i16>d) & 0xFFFF;
      writeByte(addr, incVal(readByte(addr)));
      if (isIY) IY = idx; else IX = idx;
      return 23;
    }

    // DEC (IX+d)
    case 0x35: {
      let d: i8 = <i8>fetchByte();
      let addr: u16 = (idx + <u16><i16>d) & 0xFFFF;
      writeByte(addr, decVal(readByte(addr)));
      if (isIY) IY = idx; else IX = idx;
      return 23;
    }

    // LD (IX+d), n
    case 0x36: {
      let d: i8 = <i8>fetchByte();
      let n: u8 = fetchByte();
      writeByte((idx + <u16><i16>d) & 0xFFFF, n);
      if (isIY) IY = idx; else IX = idx;
      return 19;
    }

    // LD r, (IX+d) - 0x46, 0x4E, 0x56, 0x5E, 0x66, 0x6E, 0x7E
    case 0x46: case 0x4E: case 0x56: case 0x5E:
    case 0x66: case 0x6E: case 0x7E: {
      let d: i8 = <i8>fetchByte();
      let val = readByte((idx + <u16><i16>d) & 0xFFFF);
      let dst: u8 = (op >> 3) & 0x07;
      setReg(dst, val);
      if (isIY) IY = idx; else IX = idx;
      return 19;
    }

    // LD (IX+d), r - 0x70-0x77 (except 0x76 which is HALT)
    case 0x70: case 0x71: case 0x72: case 0x73:
    case 0x74: case 0x75: case 0x77: {
      let d: i8 = <i8>fetchByte();
      let src: u8 = op & 0x07;
      writeByte((idx + <u16><i16>d) & 0xFFFF, getReg(src));
      if (isIY) IY = idx; else IX = idx;
      return 19;
    }

    // ALU A, (IX+d)
    case 0x86: case 0x8E: case 0x96: case 0x9E:
    case 0xA6: case 0xAE: case 0xB6: case 0xBE: {
      let d: i8 = <i8>fetchByte();
      let val = readByte((idx + <u16><i16>d) & 0xFFFF);
      let aluOp: u8 = (op >> 3) & 0x07;
      doAlu(aluOp, val);
      if (isIY) IY = idx; else IX = idx;
      return 19;
    }

    // LD r, IXH/IXL and other undocumented
    case 0x44: { B = <u8>(idx >> 8); break; }
    case 0x45: { B = <u8>(idx & 0xFF); break; }
    case 0x4C: { C = <u8>(idx >> 8); break; }
    case 0x4D: { C = <u8>(idx & 0xFF); break; }
    case 0x54: { D = <u8>(idx >> 8); break; }
    case 0x55: { D = <u8>(idx & 0xFF); break; }
    case 0x5C: { E = <u8>(idx >> 8); break; }
    case 0x5D: { E = <u8>(idx & 0xFF); break; }
    case 0x60: { idx = (idx & 0xFF) | (<u16>B << 8); break; }
    case 0x61: { idx = (idx & 0xFF) | (<u16>C << 8); break; }
    case 0x62: { idx = (idx & 0xFF) | (<u16>D << 8); break; }
    case 0x63: { idx = (idx & 0xFF) | (<u16>E << 8); break; }
    case 0x64: { break; } // LD IXH, IXH
    case 0x65: { idx = (idx & 0xFF) | (<u16>(idx & 0xFF) << 8); break; }
    case 0x67: { idx = (idx & 0xFF) | (<u16>A << 8); break; }
    case 0x68: { idx = (idx & 0xFF00) | <u16>B; break; }
    case 0x69: { idx = (idx & 0xFF00) | <u16>C; break; }
    case 0x6A: { idx = (idx & 0xFF00) | <u16>D; break; }
    case 0x6B: { idx = (idx & 0xFF00) | <u16>E; break; }
    case 0x6C: { idx = (idx & 0xFF00) | (idx >> 8); break; }
    case 0x6D: { break; } // LD IXL, IXL
    case 0x6F: { idx = (idx & 0xFF00) | <u16>A; break; }
    case 0x7C: { A = <u8>(idx >> 8); break; }
    case 0x7D: { A = <u8>(idx & 0xFF); break; }

    // ALU A, IXH/IXL (undocumented)
    case 0x84: { addA(<u8>(idx >> 8)); break; }
    case 0x85: { addA(<u8>(idx & 0xFF)); break; }
    case 0x8C: { adcA(<u8>(idx >> 8)); break; }
    case 0x8D: { adcA(<u8>(idx & 0xFF)); break; }
    case 0x94: { subA(<u8>(idx >> 8)); break; }
    case 0x95: { subA(<u8>(idx & 0xFF)); break; }
    case 0x9C: { sbcA(<u8>(idx >> 8)); break; }
    case 0x9D: { sbcA(<u8>(idx & 0xFF)); break; }
    case 0xA4: { andA(<u8>(idx >> 8)); break; }
    case 0xA5: { andA(<u8>(idx & 0xFF)); break; }
    case 0xAC: { xorA(<u8>(idx >> 8)); break; }
    case 0xAD: { xorA(<u8>(idx & 0xFF)); break; }
    case 0xB4: { orA(<u8>(idx >> 8)); break; }
    case 0xB5: { orA(<u8>(idx & 0xFF)); break; }
    case 0xBC: { cpA(<u8>(idx >> 8)); break; }
    case 0xBD: { cpA(<u8>(idx & 0xFF)); break; }

    // POP IX
    case 0xE1: { idx = popWord(); break; }

    // EX (SP), IX
    case 0xE3: {
      let tmp = readWord(SP);
      writeWord(SP, idx);
      idx = tmp;
      break;
    }

    // PUSH IX
    case 0xE5: { pushWord(idx); break; }

    // JP (IX)
    case 0xE9: { PC = idx; if (isIY) IY = idx; else IX = idx; return 8; }

    // LD SP, IX
    case 0xF9: { SP = idx; break; }

    // DDCB / FDCB prefix
    case 0xCB: {
      let d: i8 = <i8>fetchByte();
      let cbop: u8 = fetchByte();
      let addr: u16 = (idx + <u16><i16>d) & 0xFFFF;
      let val: u8 = readByte(addr);
      let result: u8 = 0;
      let bit: u8 = (cbop >> 3) & 7;
      let destReg: u8 = cbop & 7;

      if (cbop < 0x40) {
        switch (cbop >> 3) {
          case 0: result = (val << 1) | (val >> 7); F = unchecked(sz53pTable[result]) | (val >> 7); break;
          case 1: result = (val >> 1) | (val << 7); F = unchecked(sz53pTable[result]) | (val & 1); break;
          case 2: result = (val << 1) | (F & FLAG_C); F = unchecked(sz53pTable[result]) | (val >> 7); break;
          case 3: result = (val >> 1) | ((F & FLAG_C) << 7); F = unchecked(sz53pTable[result]) | (val & 1); break;
          case 4: result = val << 1; F = unchecked(sz53pTable[result]) | (val >> 7); break;
          case 5: result = (val >> 1) | (val & 0x80); F = unchecked(sz53pTable[result]) | (val & 1); break;
          case 6: result = (val << 1) | 1; F = unchecked(sz53pTable[result]) | (val >> 7); break;
          case 7: result = val >> 1; F = unchecked(sz53pTable[result]) | (val & 1); break;
        }
        writeByte(addr, result);
        if (destReg != 6) setReg(destReg, result);
      } else if (cbop < 0x80) {
        // BIT b, (IX+d)
        let bmask: u8 = (<u8>1) << bit;
        let masked = val & bmask;
        F = (F & FLAG_C) | FLAG_H |
            (masked == 0 ? (FLAG_Z | FLAG_PV) : 0) |
            (masked & FLAG_S) |
            (<u8>((addr >> 8) & (FLAG_5 | FLAG_3)));
      } else if (cbop < 0xC0) {
        result = val & ~((<u8>1) << bit);
        writeByte(addr, result);
        if (destReg != 6) setReg(destReg, result);
      } else {
        result = val | ((<u8>1) << bit);
        writeByte(addr, result);
        if (destReg != 6) setReg(destReg, result);
      }

      if (isIY) IY = idx; else IX = idx;
      return 23;
    }

    default: {
      // For unimplemented IX/IY opcodes, just execute as normal
      // (rewind PC and execute as unprefixed)
      PC = (PC - 1) & 0xFFFF;
      if (isIY) IY = idx; else IX = idx;
      return 4;
    }
  }

  if (isIY) IY = idx; else IX = idx;
  return 8; // approximate timing
}

function addIdx(idx: u16, val: u16): u16 {
  let result: u32 = <u32>idx + <u32>val;
  let r16: u16 = <u16>(result & 0xFFFF);
  F = (F & (FLAG_S | FLAG_Z | FLAG_PV)) |
      (result & 0x10000 ? FLAG_C : 0) |
      (<u8>((r16 >> 8) & (FLAG_5 | FLAG_3))) |
      (<u8>(((idx ^ val ^ r16) >> 8) & 0x10) ? FLAG_H : 0);
  return r16;
}

// ============================================================
// ALU DISPATCH
// ============================================================
function doAlu(op: u8, val: u8): void {
  switch (op) {
    case 0: addA(val); break;
    case 1: adcA(val); break;
    case 2: subA(val); break;
    case 3: sbcA(val); break;
    case 4: andA(val); break;
    case 5: xorA(val); break;
    case 6: orA(val); break;
    case 7: cpA(val); break;
  }
}

// ============================================================
// MAIN INSTRUCTION EXECUTION
// ============================================================
function execute(): i32 {
  // TAP ROM trap: intercept tape loading routine
  if (PC == 0x0556 && tapLoaded && tapPos < tapSize) {
    return trapTapeLoad();
  }

  let op: u8 = fetchByte();
  R_reg = (R_reg + 1) & 0x7F;

  // Decode groups
  if (op >= 0x40 && op <= 0x7F) {
    // LD r, r' group (including HALT at 0x76)
    if (op == 0x76) {
      halted = true;
      PC = (PC - 1) & 0xFFFF; // keep PC pointing at HALT
      return 4;
    }
    let dst: u8 = (op >> 3) & 0x07;
    let src: u8 = op & 0x07;
    setReg(dst, getReg(src));
    return (src == 6 || dst == 6) ? 7 : 4;
  }

  if (op >= 0x80 && op <= 0xBF) {
    // ALU A, r group
    let aluOp: u8 = (op >> 3) & 0x07;
    let src: u8 = op & 0x07;
    doAlu(aluOp, getReg(src));
    return src == 6 ? 7 : 4;
  }

  switch (op) {
    case 0x00: return 4; // NOP

    // LD rr, nn
    case 0x01: setBC(fetchWord()); return 10;
    case 0x11: setDE(fetchWord()); return 10;
    case 0x21: setHL(fetchWord()); return 10;
    case 0x31: SP = fetchWord(); return 10;

    // LD (rr), A / LD A, (rr)
    case 0x02: writeByte(getBC(), A); return 7;
    case 0x12: writeByte(getDE(), A); return 7;
    case 0x0A: A = readByte(getBC()); return 7;
    case 0x1A: A = readByte(getDE()); return 7;

    // LD (nn), HL / LD HL, (nn)
    case 0x22: { let addr = fetchWord(); writeWord(addr, getHL()); return 16; }
    case 0x2A: { let addr = fetchWord(); setHL(readWord(addr)); return 16; }

    // LD (nn), A / LD A, (nn)
    case 0x32: { let addr = fetchWord(); writeByte(addr, A); return 13; }
    case 0x3A: { let addr = fetchWord(); A = readByte(addr); return 13; }

    // INC rr
    case 0x03: setBC((getBC() + 1) & 0xFFFF); return 6;
    case 0x13: setDE((getDE() + 1) & 0xFFFF); return 6;
    case 0x23: setHL((getHL() + 1) & 0xFFFF); return 6;
    case 0x33: SP = (SP + 1) & 0xFFFF; return 6;

    // DEC rr
    case 0x0B: setBC((getBC() - 1) & 0xFFFF); return 6;
    case 0x1B: setDE((getDE() - 1) & 0xFFFF); return 6;
    case 0x2B: setHL((getHL() - 1) & 0xFFFF); return 6;
    case 0x3B: SP = (SP - 1) & 0xFFFF; return 6;

    // INC r
    case 0x04: B = incVal(B); return 4;
    case 0x0C: C = incVal(C); return 4;
    case 0x14: D = incVal(D); return 4;
    case 0x1C: E = incVal(E); return 4;
    case 0x24: H = incVal(H); return 4;
    case 0x2C: L = incVal(L); return 4;
    case 0x34: { let hl = getHL(); writeByte(hl, incVal(readByte(hl))); return 11; }
    case 0x3C: A = incVal(A); return 4;

    // DEC r
    case 0x05: B = decVal(B); return 4;
    case 0x0D: C = decVal(C); return 4;
    case 0x15: D = decVal(D); return 4;
    case 0x1D: E = decVal(E); return 4;
    case 0x25: H = decVal(H); return 4;
    case 0x2D: L = decVal(L); return 4;
    case 0x35: { let hl = getHL(); writeByte(hl, decVal(readByte(hl))); return 11; }
    case 0x3D: A = decVal(A); return 4;

    // LD r, n
    case 0x06: B = fetchByte(); return 7;
    case 0x0E: C = fetchByte(); return 7;
    case 0x16: D = fetchByte(); return 7;
    case 0x1E: E = fetchByte(); return 7;
    case 0x26: H = fetchByte(); return 7;
    case 0x2E: L = fetchByte(); return 7;
    case 0x36: writeByte(getHL(), fetchByte()); return 10;
    case 0x3E: A = fetchByte(); return 7;

    // RLCA, RRCA, RLA, RRA
    case 0x07: { // RLCA
      A = (A << 1) | (A >> 7);
      F = (F & (FLAG_S | FLAG_Z | FLAG_PV)) | (A & (FLAG_5 | FLAG_3 | FLAG_C));
      return 4;
    }
    case 0x0F: { // RRCA
      F = (F & (FLAG_S | FLAG_Z | FLAG_PV)) | (A & FLAG_C);
      A = (A >> 1) | (A << 7);
      F |= (A & (FLAG_5 | FLAG_3));
      return 4;
    }
    case 0x17: { // RLA
      let carry: u8 = F & FLAG_C;
      F = (F & (FLAG_S | FLAG_Z | FLAG_PV)) | (A >> 7);
      A = (A << 1) | carry;
      F |= (A & (FLAG_5 | FLAG_3));
      return 4;
    }
    case 0x1F: { // RRA
      let carry: u8 = F & FLAG_C;
      F = (F & (FLAG_S | FLAG_Z | FLAG_PV)) | (A & FLAG_C);
      A = (A >> 1) | (carry << 7);
      F |= (A & (FLAG_5 | FLAG_3));
      return 4;
    }

    // ADD HL, rr
    case 0x09: addHL(getBC()); return 11;
    case 0x19: addHL(getDE()); return 11;
    case 0x29: addHL(getHL()); return 11;
    case 0x39: addHL(SP); return 11;

    // JR, JR cc
    case 0x18: { // JR d
      let d: i8 = <i8>fetchByte();
      PC = (PC + <u16><i16>d) & 0xFFFF;
      return 12;
    }
    case 0x20: { // JR NZ
      let d: i8 = <i8>fetchByte();
      if ((F & FLAG_Z) == 0) { PC = (PC + <u16><i16>d) & 0xFFFF; return 12; }
      return 7;
    }
    case 0x28: { // JR Z
      let d: i8 = <i8>fetchByte();
      if ((F & FLAG_Z) != 0) { PC = (PC + <u16><i16>d) & 0xFFFF; return 12; }
      return 7;
    }
    case 0x30: { // JR NC
      let d: i8 = <i8>fetchByte();
      if ((F & FLAG_C) == 0) { PC = (PC + <u16><i16>d) & 0xFFFF; return 12; }
      return 7;
    }
    case 0x38: { // JR C
      let d: i8 = <i8>fetchByte();
      if ((F & FLAG_C) != 0) { PC = (PC + <u16><i16>d) & 0xFFFF; return 12; }
      return 7;
    }

    // DJNZ
    case 0x10: {
      let d: i8 = <i8>fetchByte();
      B = (B - 1) & 0xFF;
      if (B != 0) { PC = (PC + <u16><i16>d) & 0xFFFF; return 13; }
      return 8;
    }

    // EX AF, AF'
    case 0x08: {
      let tmpA = A; let tmpF = F;
      A = A2; F = F2;
      A2 = tmpA; F2 = tmpF;
      return 4;
    }

    // DAA
    case 0x27: {
      let correction: u8 = 0;
      let carry: u8 = F & FLAG_C;
      if ((F & FLAG_H) != 0 || (A & 0x0F) > 9) correction |= 0x06;
      if (carry != 0 || A > 0x99) { correction |= 0x60; carry = FLAG_C; }
      if ((F & FLAG_N) != 0) {
        A -= correction;
        F = unchecked(sz53pTable[A]) | carry | FLAG_N |
            ((A ^ (A + correction)) & FLAG_H);
      } else {
        A += correction;
        F = unchecked(sz53pTable[A]) | carry |
            ((A ^ (A - correction)) & FLAG_H);
      }
      return 4;
    }

    // CPL
    case 0x2F: {
      A = ~A;
      F = (F & (FLAG_S | FLAG_Z | FLAG_PV | FLAG_C)) |
          (A & (FLAG_5 | FLAG_3)) | FLAG_H | FLAG_N;
      return 4;
    }

    // SCF
    case 0x37: {
      F = (F & (FLAG_S | FLAG_Z | FLAG_PV)) |
          (A & (FLAG_5 | FLAG_3)) | FLAG_C;
      return 4;
    }

    // CCF
    case 0x3F: {
      F = (F & (FLAG_S | FLAG_Z | FLAG_PV)) |
          (A & (FLAG_5 | FLAG_3)) |
          ((F & FLAG_C) ? FLAG_H : FLAG_C);
      return 4;
    }

    // ALU A, n
    case 0xC6: addA(fetchByte()); return 7;
    case 0xCE: adcA(fetchByte()); return 7;
    case 0xD6: subA(fetchByte()); return 7;
    case 0xDE: sbcA(fetchByte()); return 7;
    case 0xE6: andA(fetchByte()); return 7;
    case 0xEE: xorA(fetchByte()); return 7;
    case 0xF6: orA(fetchByte()); return 7;
    case 0xFE: cpA(fetchByte()); return 7;

    // RET cc
    case 0xC0: if (!getCondition(0)) return 5; PC = popWord(); return 11;
    case 0xC8: if (!getCondition(1)) return 5; PC = popWord(); return 11;
    case 0xD0: if (!getCondition(2)) return 5; PC = popWord(); return 11;
    case 0xD8: if (!getCondition(3)) return 5; PC = popWord(); return 11;
    case 0xE0: if (!getCondition(4)) return 5; PC = popWord(); return 11;
    case 0xE8: if (!getCondition(5)) return 5; PC = popWord(); return 11;
    case 0xF0: if (!getCondition(6)) return 5; PC = popWord(); return 11;
    case 0xF8: if (!getCondition(7)) return 5; PC = popWord(); return 11;

    // RET
    case 0xC9: PC = popWord(); return 10;

    // POP rr
    case 0xC1: setBC(popWord()); return 10;
    case 0xD1: setDE(popWord()); return 10;
    case 0xE1: setHL(popWord()); return 10;
    case 0xF1: setAF(popWord()); return 10;

    // PUSH rr
    case 0xC5: pushWord(getBC()); return 11;
    case 0xD5: pushWord(getDE()); return 11;
    case 0xE5: pushWord(getHL()); return 11;
    case 0xF5: pushWord(getAF()); return 11;

    // JP cc, nn
    case 0xC2: { let addr = fetchWord(); if (getCondition(0)) PC = addr; return 10; }
    case 0xCA: { let addr = fetchWord(); if (getCondition(1)) PC = addr; return 10; }
    case 0xD2: { let addr = fetchWord(); if (getCondition(2)) PC = addr; return 10; }
    case 0xDA: { let addr = fetchWord(); if (getCondition(3)) PC = addr; return 10; }
    case 0xE2: { let addr = fetchWord(); if (getCondition(4)) PC = addr; return 10; }
    case 0xEA: { let addr = fetchWord(); if (getCondition(5)) PC = addr; return 10; }
    case 0xF2: { let addr = fetchWord(); if (getCondition(6)) PC = addr; return 10; }
    case 0xFA: { let addr = fetchWord(); if (getCondition(7)) PC = addr; return 10; }

    // JP nn
    case 0xC3: PC = fetchWord(); return 10;

    // CALL cc, nn
    case 0xC4: { let addr = fetchWord(); if (getCondition(0)) { pushWord(PC); PC = addr; return 17; } return 10; }
    case 0xCC: { let addr = fetchWord(); if (getCondition(1)) { pushWord(PC); PC = addr; return 17; } return 10; }
    case 0xD4: { let addr = fetchWord(); if (getCondition(2)) { pushWord(PC); PC = addr; return 17; } return 10; }
    case 0xDC: { let addr = fetchWord(); if (getCondition(3)) { pushWord(PC); PC = addr; return 17; } return 10; }
    case 0xE4: { let addr = fetchWord(); if (getCondition(4)) { pushWord(PC); PC = addr; return 17; } return 10; }
    case 0xEC: { let addr = fetchWord(); if (getCondition(5)) { pushWord(PC); PC = addr; return 17; } return 10; }
    case 0xF4: { let addr = fetchWord(); if (getCondition(6)) { pushWord(PC); PC = addr; return 17; } return 10; }
    case 0xFC: { let addr = fetchWord(); if (getCondition(7)) { pushWord(PC); PC = addr; return 17; } return 10; }

    // CALL nn
    case 0xCD: { let addr = fetchWord(); pushWord(PC); PC = addr; return 17; }

    // RST
    case 0xC7: pushWord(PC); PC = 0x00; return 11;
    case 0xCF: pushWord(PC); PC = 0x08; return 11;
    case 0xD7: pushWord(PC); PC = 0x10; return 11;
    case 0xDF: pushWord(PC); PC = 0x18; return 11;
    case 0xE7: pushWord(PC); PC = 0x20; return 11;
    case 0xEF: pushWord(PC); PC = 0x28; return 11;
    case 0xF7: pushWord(PC); PC = 0x30; return 11;
    case 0xFF: pushWord(PC); PC = 0x38; return 11;

    // JP (HL)
    case 0xE9: PC = getHL(); return 4;

    // LD SP, HL
    case 0xF9: SP = getHL(); return 6;

    // EX DE, HL
    case 0xEB: {
      let tmp = getDE();
      setDE(getHL());
      setHL(tmp);
      return 4;
    }

    // EX (SP), HL
    case 0xE3: {
      let tmp = readWord(SP);
      writeWord(SP, getHL());
      setHL(tmp);
      return 19;
    }

    // EXX
    case 0xD9: {
      let tmp: u8;
      tmp = B; B = B2; B2 = tmp;
      tmp = C; C = C2; C2 = tmp;
      tmp = D; D = D2; D2 = tmp;
      tmp = E; E = E2; E2 = tmp;
      tmp = H; H = H2; H2 = tmp;
      tmp = L; L = L2; L2 = tmp;
      return 4;
    }

    // DI / EI
    case 0xF3: IFF1 = false; IFF2 = false; return 4;
    case 0xFB: IFF1 = true; IFF2 = true; return 4;

    // OUT (n), A
    case 0xD3: { let port = <u16>fetchByte() | (<u16>A << 8); portOut(port, A); return 11; }

    // IN A, (n)
    case 0xDB: { let port = <u16>fetchByte() | (<u16>A << 8); A = portIn(port); return 11; }

    // PREFIX CB
    case 0xCB: return executeCB();

    // PREFIX ED
    case 0xED: return executeED();

    // PREFIX DD (IX)
    case 0xDD: return executeIndexed(false);

    // PREFIX FD (IY)
    case 0xFD: return executeIndexed(true);

    default: return 4; // NOP for unknown
  }
  return 4;
}

// ============================================================
// TAP TAPE LOADING TRAP
// ============================================================
function trapTapeLoad(): i32 {
  // ROM LD-BYTES routine at 0x0556
  // A = flag byte expected, IX = dest address, DE = length
  // CF = 1 for LOAD, CF = 0 for VERIFY

  if (tapPos >= tapSize) {
    // No more data
    F &= ~FLAG_C; // failure
    PC = popWord();
    return 100;
  }

  // Read TAP block length
  let blockLen: u32 = <u32>load<u8>(TAP_BASE + tapPos) | (<u32>load<u8>(TAP_BASE + tapPos + 1) << 8);
  tapPos += 2;

  if (tapPos + blockLen > tapSize) {
    F &= ~FLAG_C;
    PC = popWord();
    return 100;
  }

  // Read flag byte
  let flagByte: u8 = load<u8>(TAP_BASE + tapPos);

  if (flagByte == A) {
    // Flag matches - load data
    let dataLen: u32 = blockLen - 2; // subtract flag and checksum
    let loadLen: u16 = <u16>(dataLen < <u32>getDE() ? dataLen : <u32>getDE());

    for (let i: u16 = 0; i < loadLen; i++) {
      writeByte((IX + i) & 0xFFFF, load<u8>(TAP_BASE + tapPos + 1 + <u32>i));
    }

    tapPos += blockLen;
    IX = (IX + loadLen) & 0xFFFF;
    setDE(0);
    F |= FLAG_C; // success
  } else {
    // Flag doesn't match, skip block and try next
    tapPos += blockLen;
    // Try next block recursively
    return trapTapeLoad();
  }

  PC = popWord();
  return 100; // approximate cycle cost
}

// ============================================================
// SCREEN RENDERING
// ============================================================
function renderScreen(): void {
  for (let y: i32 = 0; y < 192; y++) {
    // Calculate screen address for this line
    let lineAddr: u16 = <u16>(0x4000 | ((y & 0xC0) << 5) | ((y & 0x07) << 8) | ((y & 0x38) << 2));
    let attrRow: i32 = y >> 3;

    for (let col: i32 = 0; col < 32; col++) {
      let pixelByte: u8 = readByte((lineAddr + <u16>col) & 0xFFFF);
      let attr: u8 = readByte(<u16>(0x5800 + attrRow * 32 + col));

      let ink: u8 = attr & 0x07;
      let paper: u8 = (attr >> 3) & 0x07;
      let bright: u8 = (attr & 0x40) ? 8 : 0;
      let flash: bool = (attr & 0x80) != 0;

      if (flash && flashState) {
        let tmp = ink;
        ink = paper;
        paper = tmp;
      }

      let inkColor: u32 = unchecked(COLORS[ink + bright]);
      let paperColor: u32 = unchecked(COLORS[paper + bright]);

      let screenOffset: u32 = SCREEN_BASE + (<u32>y * 256 + <u32>(col * 8)) * 4;

      for (let bit: i32 = 7; bit >= 0; bit--) {
        let color: u32 = (pixelByte & ((<u8>1) << (<u8>bit))) ? inkColor : paperColor;
        store<u32>(screenOffset, color);
        screenOffset += 4;
      }
    }
  }
}

// ============================================================
// INTERRUPT HANDLING
// ============================================================
function handleInterrupt(): void {
  if (!IFF1) return;

  if (halted) {
    halted = false;
    PC = (PC + 1) & 0xFFFF;
  }

  IFF1 = false;
  IFF2 = false;

  switch (IM) {
    case 0:
    case 1:
      // IM 0/1: RST 38h
      pushWord(PC);
      PC = 0x0038;
      cycles += 13;
      break;
    case 2: {
      // IM 2: jump to address at (I * 256 + data_bus)
      // Data bus is typically 0xFF on Spectrum
      pushWord(PC);
      let vectorAddr: u16 = (<u16>I_reg << 8) | 0xFF;
      PC = readWord(vectorAddr);
      cycles += 19;
      break;
    }
  }
}

// ============================================================
// EXPORTED FUNCTIONS
// ============================================================

export function init(): void {
  initTables();

  // Clear memory
  for (let i: u32 = 0; i < 65536; i++) {
    store<u8>(MEM_BASE + i, 0);
  }

  // Reset keyboard (all released = 0xFF)
  for (let i: i32 = 0; i < 8; i++) {
    unchecked(keyboardState[i] = 0xFF);
  }

  // Reset CPU
  A = 0xFF; F = 0xFF;
  B = 0; C = 0; D = 0; E = 0; H = 0; L = 0;
  A2 = 0; F2 = 0; B2 = 0; C2 = 0; D2 = 0; E2 = 0; H2 = 0; L2 = 0;
  IX = 0; IY = 0;
  SP = 0xFFFF; PC = 0;
  I_reg = 0; R_reg = 0;
  IFF1 = false; IFF2 = false; IM = 0;
  halted = false;
  cycles = 0;
  borderColor = 7;
  flashState = false;
  frameCount = 0;
  tapPos = 0;
  tapSize = 0;
  tapLoaded = false;
}

export function frame(): void {
  cycles = 0;
  let safety: i32 = 0;
  audioSampleIndex = 0;
  audioCycleAccum = 0;

  while (cycles < CYCLES_PER_FRAME) {
    let c = execute();
    if (c <= 0) c = 4; // safety: ensure forward progress
    cycles += c;

    // Record audio samples at regular intervals
    audioCycleAccum += c;
    while (audioCycleAccum >= AUDIO_DIVISOR && audioSampleIndex < AUDIO_SAMPLES_PER_FRAME) {
      audioCycleAccum -= AUDIO_DIVISOR;
      store<u8>(AUDIO_BASE + <u32>audioSampleIndex, beeperState);
      audioSampleIndex++;
    }

    safety++;
    if (safety > 200000) break; // safety limit
  }

  // Generate maskable interrupt at 50Hz
  handleInterrupt();

  // Flash toggle every 16 frames
  frameCount++;
  if ((frameCount & 0x0F) == 0) {
    flashState = !flashState;
  }

  // Render screen to pixel buffer
  renderScreen();
}

export function setRomByte(addr: u32, val: u8): void {
  if (addr < 0x4000) {
    store<u8>(MEM_BASE + addr, val);
  }
}

export function loadTapData(offset: u32, val: u8): void {
  if (offset < TAP_MAX) {
    store<u8>(TAP_BASE + offset, val);
  }
}

export function setTapSize(size: u32): void {
  tapSize = size;
  tapPos = 0;
  tapLoaded = true;
}

export function resetTapPos(): void {
  tapPos = 0;
}

export function keyDown(row: u8, colBit: u8): void {
  if (row < 8) {
    unchecked(keyboardState[row] &= ~colBit);
  }
}

export function keyUp(row: u8, colBit: u8): void {
  if (row < 8) {
    unchecked(keyboardState[row] |= colBit);
  }
}

export function getScreenBaseAddr(): u32 {
  return SCREEN_BASE;
}

export function getBorderColor(): u8 {
  return borderColor;
}

export function getAudioBaseAddr(): u32 {
  return AUDIO_BASE;
}

export function getAudioSampleCount(): i32 {
  return audioSampleIndex;
}

export function getPC(): u16 {
  return PC;
}

// Write directly to Spectrum RAM (for testing)
export function writeRAM(addr: u16, val: u8): void {
  store<u8>(MEM_BASE + <u32>addr, val);
}

// Debug: single step, returns PC
export function step(): u16 {
  cycles += execute();
  return PC;
}

export function getSP(): u16 { return SP; }
export function getA(): u8 { return A; }
export function getF(): u8 { return F; }
export function getBC2(): u16 { return (<u16>B << 8) | <u16>C; }
export function getDE2(): u16 { return (<u16>D << 8) | <u16>E; }
export function getHL2(): u16 { return (<u16>H << 8) | <u16>L; }
export function getIX(): u16 { return IX; }
export function getIY(): u16 { return IY; }
export function readMem(addr: u16): u8 { return readByte(addr); }
