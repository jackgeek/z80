'use strict';

const {
  REGISTER_CODES, CONDITION_CODES, PAIR_CODES, PAIR_CODES_PUSH,
  ALU_CODES, SHIFT_CODES, SIMPLE_OPCODES, ED_SIMPLE,
} = require('./opcodes');
const { evaluateExpression, parseNumber } = require('./expressions');

// ---------------------------------------------------------------------------
// Operand classification
// ---------------------------------------------------------------------------

const REGISTERS = new Set(['A', 'B', 'C', 'D', 'E', 'H', 'L']);
const PAIRS = new Set(['BC', 'DE', 'HL', 'SP', 'AF', 'IX', 'IY']);
const INDIRECT_PAIRS = new Set(['BC', 'DE', 'HL', 'SP']);
const CONDITIONS = new Set(['NZ', 'Z', 'NC', 'PO', 'PE', 'P', 'M']);
// Note: C is ambiguous — handled per-context

const IX_IY_OFFSET_RE = /^\((IX|IY)\s*([+-].*)\)$/i;
const IX_IY_BARE_RE = /^\((IX|IY)\)$/i;
const INDIRECT_RE = /^\((.+)\)$/;

function classifyOperand(op) {
  const upper = op.toUpperCase();

  // Register
  if (REGISTERS.has(upper)) {
    return { type: 'reg', value: upper };
  }

  // AF'
  if (upper === "AF'") {
    return { type: 'af_prime' };
  }

  // Register pair (including IX, IY)
  if (PAIRS.has(upper)) {
    return { type: 'pair', value: upper };
  }

  // Condition codes (not C — that's handled contextually)
  if (CONDITIONS.has(upper)) {
    return { type: 'condition', value: upper };
  }

  // Indexed: (IX+d), (IX-d), (IY+d), (IY-d)
  let m = upper.match(IX_IY_OFFSET_RE);
  if (m) {
    // Extract the original expression (preserve case for symbols)
    const origMatch = op.match(IX_IY_OFFSET_RE);
    return { type: 'indexed', reg: m[1], expr: origMatch[2].trim() };
  }

  // Bare (IX) or (IY) — treat as indexed with displacement 0
  m = upper.match(IX_IY_BARE_RE);
  if (m) {
    return { type: 'indexed', reg: m[1], expr: '0' };
  }

  // Indirect register pair: (BC), (DE), (HL), (SP)
  const indirectMatch = upper.match(INDIRECT_RE);
  if (indirectMatch) {
    const inner = indirectMatch[1].trim();
    if (INDIRECT_PAIRS.has(inner)) {
      return { type: 'indirect_pair', value: inner };
    }
    // Indirect address: (expr)
    const origInner = op.match(INDIRECT_RE)[1].trim();
    return { type: 'indirect_addr', expr: origInner };
  }

  // Immediate value
  return { type: 'immediate', expr: op };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ixIyPrefix(reg) {
  return reg === 'IX' ? 0xDD : 0xFD;
}

function lo(val) { return val & 0xFF; }
function hi(val) { return (val >> 8) & 0xFF; }

function signedByte(val) {
  if (val < -128 || val > 127) {
    throw new Error(`Displacement out of range: ${val} (must be -128..127)`);
  }
  return val & 0xFF;
}

function evalExpr(expr, symbols, pc) {
  return evaluateExpression(expr, symbols, pc);
}

function evalByte(expr, symbols, pc) {
  const val = evalExpr(expr, symbols, pc);
  return val & 0xFF;
}

function evalWord(expr, symbols, pc) {
  const val = evalExpr(expr, symbols, pc);
  return val & 0xFFFF;
}

function regCode(name) {
  const code = REGISTER_CODES[name];
  if (code === undefined) throw new Error(`Invalid register: ${name}`);
  return code;
}

function pairCode(name) {
  const code = PAIR_CODES[name];
  if (code === undefined) throw new Error(`Invalid register pair: ${name}`);
  return code;
}

function condCode(name) {
  const code = CONDITION_CODES[name];
  if (code === undefined) throw new Error(`Invalid condition: ${name}`);
  return code;
}

/**
 * Determine if an operand (already classified or raw string) should be treated
 * as condition code C vs register C based on instruction context.
 */
function isConditionContext(mnemonic) {
  return mnemonic === 'JP' || mnemonic === 'CALL' || mnemonic === 'RET' || mnemonic === 'JR';
}

// Re-classify first operand for JP/CALL/RET/JR: treat "C" as condition
function classifyFirstOperand(op, mnemonic) {
  const upper = op.toUpperCase();
  if (upper === 'C' && isConditionContext(mnemonic)) {
    return { type: 'condition', value: 'C' };
  }
  return classifyOperand(op);
}

// ---------------------------------------------------------------------------
// getInstructionSize — pass 1 size calculation (no expression evaluation)
// ---------------------------------------------------------------------------

function getInstructionSize(mnemonic, operands) {
  const mn = mnemonic.toUpperCase();
  const ops = operands.map(o => o.trim()).filter(o => o.length > 0);

  // No-operand instructions
  if (ops.length === 0) {
    if (SIMPLE_OPCODES[mn] !== undefined) return 1;
    if (ED_SIMPLE[mn] !== undefined) return 2;
    if (mn === 'RET') return 1;
    throw new Error(`Unknown instruction: ${mn}`);
  }

  // Classify operands for size determination
  const c0 = ops.length > 0 ? classifyFirstOperand(ops[0], mn) : null;
  const c1 = ops.length > 1 ? classifyOperand(ops[1]) : null;

  switch (mn) {
    case 'LD': return sizeLD(c0, c1, ops);
    case 'ADD': case 'ADC': case 'SUB': case 'SBC':
    case 'AND': case 'XOR': case 'OR': case 'CP':
      return sizeALU(mn, c0, c1, ops);
    case 'INC': case 'DEC':
      return sizeINCDEC(c0);
    case 'JP':
      return sizeJP(c0, c1, ops);
    case 'JR':
      return ops.length === 2 ? 2 : 2;
    case 'DJNZ':
      return 2;
    case 'CALL':
      return 3;
    case 'RET':
      return ops.length === 1 ? 2 : 1;
    case 'RST':
      return 1;
    case 'PUSH': case 'POP':
      return sizePUSHPOP(c0);
    case 'EX':
      return sizeEX(c0, c1, ops);
    case 'IN':
      return sizeIN(c0, c1);
    case 'OUT':
      return sizeOUT(c0, c1);
    case 'IM':
      return 2;
    case 'RLC': case 'RRC': case 'RL': case 'RR':
    case 'SLA': case 'SRA': case 'SRL': case 'SLL':
      return sizeSHIFT(c0);
    case 'BIT': case 'SET': case 'RES':
      return sizeBIT(c1);
    default:
      throw new Error(`Unknown instruction: ${mn}`);
  }
}

function sizeLD(c0, c1, ops) {
  // LD I,A / LD R,A / LD A,I / LD A,R
  if (ops.length === 2) {
    const u0 = ops[0].toUpperCase();
    const u1 = ops[1].toUpperCase();
    if ((u0 === 'I' || u0 === 'R') && u1 === 'A') return 2;
    if (u0 === 'A' && (u1 === 'I' || u1 === 'R')) return 2;
  }

  // LD SP,HL/IX/IY
  if (c0 && c0.type === 'pair' && c0.value === 'SP' && c1 && c1.type === 'pair') {
    return (c1.value === 'IX' || c1.value === 'IY') ? 2 : 1;
  }

  // LD IX/IY,nn
  if (c0 && c0.type === 'pair' && (c0.value === 'IX' || c0.value === 'IY')) {
    if (c1 && c1.type === 'immediate') return 4; // prefix + 0x21 + nn
    if (c1 && c1.type === 'indirect_addr') return 4; // prefix + 0x2A + nn
    throw new Error(`Invalid LD ${ops[0]},${ops[1]}`);
  }

  // LD (nn),IX/IY
  if (c0 && c0.type === 'indirect_addr' && c1 && c1.type === 'pair' && (c1.value === 'IX' || c1.value === 'IY')) {
    return 4;
  }

  // LD r,(IX+d) or LD (IX+d),r or LD (IX+d),n
  if (c0 && c0.type === 'indexed') {
    if (c1 && c1.type === 'reg') return 3; // prefix + opcode + d
    if (c1 && c1.type === 'immediate') return 4; // prefix + 0x36 + d + n
    throw new Error(`Invalid LD ${ops[0]},${ops[1]}`);
  }
  if (c1 && c1.type === 'indexed') {
    return 3; // prefix + opcode + d
  }

  // LD rr,nn
  if (c0 && c0.type === 'pair' && c0.value !== 'AF' && c0.value !== 'IX' && c0.value !== 'IY') {
    if (c1 && c1.type === 'immediate') return 3;
    if (c1 && c1.type === 'indirect_addr') {
      // LD HL,(nn) = 3, ED LD rr,(nn) = 4
      return c0.value === 'HL' ? 3 : 4;
    }
  }

  // LD (nn),rr
  if (c0 && c0.type === 'indirect_addr' && c1 && c1.type === 'pair') {
    return c1.value === 'HL' ? 3 : 4;
  }

  // LD r,r' / LD r,n / LD r,(HL)
  if (c0 && c0.type === 'reg') {
    if (c1 && c1.type === 'reg') return 1;
    if (c1 && c1.type === 'indirect_pair' && c1.value === 'HL') return 1;
    if (c1 && c1.type === 'immediate') return 2;
    // LD A,(BC) / LD A,(DE) / LD A,(nn)
    if (c0.value === 'A') {
      if (c1 && c1.type === 'indirect_pair') return 1;
      if (c1 && c1.type === 'indirect_addr') return 3;
    }
  }

  // LD (HL),r / LD (HL),n
  if (c0 && c0.type === 'indirect_pair' && c0.value === 'HL') {
    if (c1 && c1.type === 'reg') return 1;
    if (c1 && c1.type === 'immediate') return 2;
  }

  // LD (BC),A / LD (DE),A
  if (c0 && c0.type === 'indirect_pair' && c1 && c1.type === 'reg' && c1.value === 'A') {
    return 1;
  }

  // LD (nn),A
  if (c0 && c0.type === 'indirect_addr' && c1 && c1.type === 'reg' && c1.value === 'A') {
    return 3;
  }

  throw new Error(`Invalid LD instruction: LD ${ops.join(',')}`);
}

function sizeALU(mn, c0, c1, ops) {
  // ADD HL,rr / ADD IX,rr — 16-bit add
  if (mn === 'ADD' && c0 && c0.type === 'pair' && c0.value === 'HL' && c1) return 1;
  if (mn === 'ADD' && c0 && c0.type === 'pair' && (c0.value === 'IX' || c0.value === 'IY') && c1) return 2;

  // ADC HL,rr / SBC HL,rr — ED prefix
  if ((mn === 'ADC' || mn === 'SBC') && c0 && c0.type === 'pair' && c0.value === 'HL' && c1) return 2;

  // Normalize: accept "ADD B" as "ADD A,B"
  let target;
  if (ops.length === 1) {
    target = c0;
  } else if (ops.length === 2 && c0 && c0.type === 'reg' && c0.value === 'A') {
    target = c1;
  } else if (ops.length === 2) {
    // Already handled 16-bit variants above
    target = c1;
  } else {
    throw new Error(`Invalid ${mn} instruction`);
  }

  if (!target) throw new Error(`Invalid ${mn} instruction`);
  if (target.type === 'reg') return 1;
  if (target.type === 'indirect_pair' && target.value === 'HL') return 1;
  if (target.type === 'immediate') return 2;
  if (target.type === 'indexed') return 3;
  throw new Error(`Invalid ${mn} operand`);
}

function sizeINCDEC(c0) {
  if (!c0) throw new Error('INC/DEC requires an operand');
  if (c0.type === 'reg') return 1;
  if (c0.type === 'indirect_pair' && c0.value === 'HL') return 1;
  if (c0.type === 'pair') {
    if (c0.value === 'IX' || c0.value === 'IY') return 2;
    return 1;
  }
  if (c0.type === 'indexed') return 3;
  throw new Error('Invalid INC/DEC operand');
}

function sizeJP(c0, c1, ops) {
  // JP (HL)
  if (ops.length === 1 && c0.type === 'indirect_pair' && c0.value === 'HL') return 1;
  // JP (IX) / JP (IY)
  if (ops.length === 1 && c0.type === 'indexed') return 2;
  // JP nn
  if (ops.length === 1) return 3;
  // JP cc,nn
  if (ops.length === 2) return 3;
  throw new Error('Invalid JP instruction');
}

function sizePUSHPOP(c0) {
  if (!c0) throw new Error('PUSH/POP requires an operand');
  if (c0.type === 'pair' && (c0.value === 'IX' || c0.value === 'IY')) return 2;
  return 1;
}

function sizeEX(c0, c1, ops) {
  if (ops.length !== 2) throw new Error('EX requires two operands');
  const u0 = ops[0].toUpperCase();
  const u1 = ops[1].toUpperCase();
  if (u0 === 'DE' && u1 === 'HL') return 1;
  if (u0 === 'AF' && u1 === "AF'") return 1;
  if (c0.type === 'indirect_pair' && c0.value === 'SP') {
    if (c1.type === 'pair' && (c1.value === 'IX' || c1.value === 'IY')) return 2;
    return 1;
  }
  throw new Error(`Invalid EX instruction: EX ${ops.join(',')}`);
}

function sizeIN(c0, c1) {
  // IN A,(n) = 2; IN r,(C) = 2
  return 2;
}

function sizeOUT(c0, c1) {
  // OUT (n),A = 2; OUT (C),r = 2
  return 2;
}

function sizeSHIFT(c0) {
  if (!c0) throw new Error('Shift/rotate requires an operand');
  if (c0.type === 'reg') return 2;
  if (c0.type === 'indirect_pair' && c0.value === 'HL') return 2;
  if (c0.type === 'indexed') return 4;
  throw new Error('Invalid shift/rotate operand');
}

function sizeBIT(c1) {
  if (!c1) throw new Error('BIT/SET/RES requires two operands');
  if (c1.type === 'reg') return 2;
  if (c1.type === 'indirect_pair' && c1.value === 'HL') return 2;
  if (c1.type === 'indexed') return 4;
  throw new Error('Invalid BIT/SET/RES operand');
}

// ---------------------------------------------------------------------------
// encodeInstruction — full encoding with expression evaluation
// ---------------------------------------------------------------------------

function encodeInstruction(mnemonic, operands, symbols, pc) {
  const mn = mnemonic.toUpperCase();
  const ops = operands.map(o => o.trim()).filter(o => o.length > 0);

  // No-operand: simple opcodes
  if (ops.length === 0) {
    if (SIMPLE_OPCODES[mn] !== undefined) {
      return { bytes: [SIMPLE_OPCODES[mn]], size: 1 };
    }
    if (ED_SIMPLE[mn] !== undefined) {
      return { bytes: [0xED, ED_SIMPLE[mn]], size: 2 };
    }
    if (mn === 'RET') {
      return { bytes: [0xC9], size: 1 };
    }
    throw new Error(`Unknown instruction: ${mn}`);
  }

  const c0 = ops.length > 0 ? classifyFirstOperand(ops[0], mn) : null;
  const c1 = ops.length > 1 ? classifyOperand(ops[1]) : null;

  switch (mn) {
    case 'LD': return encodeLD(c0, c1, ops, symbols, pc);
    case 'ADD': case 'ADC': case 'SUB': case 'SBC':
    case 'AND': case 'XOR': case 'OR': case 'CP':
      return encodeALU(mn, c0, c1, ops, symbols, pc);
    case 'INC': return encodeINCDEC(mn, c0, ops, symbols, pc, 0x04, 0x03, 0x34);
    case 'DEC': return encodeINCDEC(mn, c0, ops, symbols, pc, 0x05, 0x0B, 0x35);
    case 'JP': return encodeJP(c0, c1, ops, symbols, pc);
    case 'JR': return encodeJR(c0, c1, ops, symbols, pc);
    case 'DJNZ': return encodeDJNZ(c0, ops, symbols, pc);
    case 'CALL': return encodeCALL(c0, c1, ops, symbols, pc);
    case 'RET': return encodeRET(c0, ops);
    case 'RST': return encodeRST(c0, ops, symbols, pc);
    case 'PUSH': return encodePUSHPOP(c0, ops, 0xC5, 0xE5);
    case 'POP': return encodePUSHPOP(c0, ops, 0xC1, 0xE1);
    case 'EX': return encodeEX(c0, c1, ops);
    case 'IN': return encodeIN(c0, c1, ops, symbols, pc);
    case 'OUT': return encodeOUT(c0, c1, ops, symbols, pc);
    case 'IM': return encodeIM(c0, ops, symbols, pc);
    case 'RLC': case 'RRC': case 'RL': case 'RR':
    case 'SLA': case 'SRA': case 'SRL': case 'SLL':
      return encodeSHIFT(mn, c0, ops, symbols, pc);
    case 'BIT': return encodeBITSETRES(mn, c0, c1, ops, symbols, pc, 0x40);
    case 'SET': return encodeBITSETRES(mn, c0, c1, ops, symbols, pc, 0xC0);
    case 'RES': return encodeBITSETRES(mn, c0, c1, ops, symbols, pc, 0x80);
    default:
      throw new Error(`Unknown instruction: ${mn}`);
  }
}

// ---------------------------------------------------------------------------
// LD encoding
// ---------------------------------------------------------------------------

function encodeLD(c0, c1, ops, symbols, pc) {
  const u0 = ops[0].toUpperCase();
  const u1 = ops[1].toUpperCase();

  // ---- ED specials: I, R ----
  if (u0 === 'I' && u1 === 'A') return { bytes: [0xED, 0x47], size: 2 };
  if (u0 === 'R' && u1 === 'A') return { bytes: [0xED, 0x4F], size: 2 };
  if (u0 === 'A' && u1 === 'I') return { bytes: [0xED, 0x57], size: 2 };
  if (u0 === 'A' && u1 === 'R') return { bytes: [0xED, 0x5F], size: 2 };

  // ---- LD SP,HL/IX/IY ----
  if (c0.type === 'pair' && c0.value === 'SP' && c1.type === 'pair') {
    if (c1.value === 'HL') return { bytes: [0xF9], size: 1 };
    if (c1.value === 'IX' || c1.value === 'IY') {
      return { bytes: [ixIyPrefix(c1.value), 0xF9], size: 2 };
    }
  }

  // ---- LD IX/IY,nn ----
  if (c0.type === 'pair' && (c0.value === 'IX' || c0.value === 'IY')) {
    const prefix = ixIyPrefix(c0.value);
    if (c1.type === 'immediate') {
      const val = evalWord(c1.expr, symbols, pc);
      return { bytes: [prefix, 0x21, lo(val), hi(val)], size: 4 };
    }
    // LD IX,(nn)
    if (c1.type === 'indirect_addr') {
      const val = evalWord(c1.expr, symbols, pc);
      return { bytes: [prefix, 0x2A, lo(val), hi(val)], size: 4 };
    }
  }

  // ---- LD (nn),IX/IY ----
  if (c0.type === 'indirect_addr' && c1.type === 'pair' && (c1.value === 'IX' || c1.value === 'IY')) {
    const prefix = ixIyPrefix(c1.value);
    const val = evalWord(c0.expr, symbols, pc);
    return { bytes: [prefix, 0x22, lo(val), hi(val)], size: 4 };
  }

  // ---- LD (IX+d),r ----
  if (c0.type === 'indexed' && c1.type === 'reg') {
    const prefix = ixIyPrefix(c0.reg);
    const d = signedByte(evalExpr(c0.expr, symbols, pc));
    const r = regCode(c1.value);
    return { bytes: [prefix, 0x70 + r, d], size: 3 };
  }

  // ---- LD r,(IX+d) ----
  if (c0.type === 'reg' && c1.type === 'indexed') {
    const prefix = ixIyPrefix(c1.reg);
    const d = signedByte(evalExpr(c1.expr, symbols, pc));
    const r = regCode(c0.value);
    return { bytes: [prefix, 0x46 + (r << 3), d], size: 3 };
  }

  // ---- LD (IX+d),n ----
  if (c0.type === 'indexed' && c1.type === 'immediate') {
    const prefix = ixIyPrefix(c0.reg);
    const d = signedByte(evalExpr(c0.expr, symbols, pc));
    const n = evalByte(c1.expr, symbols, pc);
    return { bytes: [prefix, 0x36, d, n], size: 4 };
  }

  // ---- LD rr,nn (BC,DE,HL,SP) ----
  if (c0.type === 'pair' && PAIR_CODES[c0.value] !== undefined) {
    if (c1.type === 'immediate') {
      const val = evalWord(c1.expr, symbols, pc);
      return { bytes: [0x01 + (pairCode(c0.value) << 4), lo(val), hi(val)], size: 3 };
    }
    // LD HL,(nn)
    if (c1.type === 'indirect_addr' && c0.value === 'HL') {
      const val = evalWord(c1.expr, symbols, pc);
      return { bytes: [0x2A, lo(val), hi(val)], size: 3 };
    }
    // ED LD rr,(nn)
    if (c1.type === 'indirect_addr' && c0.value !== 'HL') {
      const val = evalWord(c1.expr, symbols, pc);
      return { bytes: [0xED, 0x4B + (pairCode(c0.value) << 4), lo(val), hi(val)], size: 4 };
    }
  }

  // ---- LD (nn),HL ----
  if (c0.type === 'indirect_addr' && c1.type === 'pair' && c1.value === 'HL') {
    const val = evalWord(c0.expr, symbols, pc);
    return { bytes: [0x22, lo(val), hi(val)], size: 3 };
  }

  // ---- ED LD (nn),rr ----
  if (c0.type === 'indirect_addr' && c1.type === 'pair' && PAIR_CODES[c1.value] !== undefined && c1.value !== 'HL') {
    const val = evalWord(c0.expr, symbols, pc);
    return { bytes: [0xED, 0x43 + (pairCode(c1.value) << 4), lo(val), hi(val)], size: 4 };
  }

  // ---- LD r,r' / LD r,(HL) / LD (HL),r ----
  if (c0.type === 'reg' && c1.type === 'reg') {
    return { bytes: [0x40 + (regCode(c0.value) << 3) + regCode(c1.value)], size: 1 };
  }
  if (c0.type === 'reg' && c1.type === 'indirect_pair' && c1.value === 'HL') {
    return { bytes: [0x40 + (regCode(c0.value) << 3) + 6], size: 1 };
  }
  if (c0.type === 'indirect_pair' && c0.value === 'HL' && c1.type === 'reg') {
    return { bytes: [0x70 + regCode(c1.value)], size: 1 };
  }

  // ---- LD r,n ----
  if (c0.type === 'reg' && c1.type === 'immediate') {
    const n = evalByte(c1.expr, symbols, pc);
    return { bytes: [0x06 + (regCode(c0.value) << 3), n], size: 2 };
  }

  // ---- LD (HL),n ----
  if (c0.type === 'indirect_pair' && c0.value === 'HL' && c1.type === 'immediate') {
    const n = evalByte(c1.expr, symbols, pc);
    return { bytes: [0x36, n], size: 2 };
  }

  // ---- LD A,(BC) / LD A,(DE) ----
  if (c0.type === 'reg' && c0.value === 'A' && c1.type === 'indirect_pair') {
    if (c1.value === 'BC') return { bytes: [0x0A], size: 1 };
    if (c1.value === 'DE') return { bytes: [0x1A], size: 1 };
  }

  // ---- LD (BC),A / LD (DE),A ----
  if (c0.type === 'indirect_pair' && c1.type === 'reg' && c1.value === 'A') {
    if (c0.value === 'BC') return { bytes: [0x02], size: 1 };
    if (c0.value === 'DE') return { bytes: [0x12], size: 1 };
  }

  // ---- LD A,(nn) ----
  if (c0.type === 'reg' && c0.value === 'A' && c1.type === 'indirect_addr') {
    const val = evalWord(c1.expr, symbols, pc);
    return { bytes: [0x3A, lo(val), hi(val)], size: 3 };
  }

  // ---- LD (nn),A ----
  if (c0.type === 'indirect_addr' && c1.type === 'reg' && c1.value === 'A') {
    const val = evalWord(c0.expr, symbols, pc);
    return { bytes: [0x32, lo(val), hi(val)], size: 3 };
  }

  throw new Error(`Invalid LD instruction: LD ${ops.join(',')}`);
}

// ---------------------------------------------------------------------------
// ALU encoding
// ---------------------------------------------------------------------------

function encodeALU(mn, c0, c1, ops, symbols, pc) {
  const aluCode = ALU_CODES[mn];

  // ---- ADD HL,rr ----
  if (mn === 'ADD' && c0.type === 'pair' && c0.value === 'HL' && c1) {
    if (c1.type !== 'pair' || PAIR_CODES[c1.value] === undefined) {
      throw new Error(`Invalid operand for ADD HL: ${ops[1]}`);
    }
    return { bytes: [0x09 + (pairCode(c1.value) << 4)], size: 1 };
  }

  // ---- ADD IX,rr / ADD IY,rr ----
  if (mn === 'ADD' && c0.type === 'pair' && (c0.value === 'IX' || c0.value === 'IY') && c1) {
    const prefix = ixIyPrefix(c0.value);
    // For IX/IY add: BC=0, DE=1, IX/IY=2 (replaces HL), SP=3
    let pp;
    if (c1.type === 'pair') {
      if (c1.value === c0.value) pp = 2; // IX+IX or IY+IY
      else if (PAIR_CODES[c1.value] !== undefined) pp = pairCode(c1.value);
      else throw new Error(`Invalid operand for ADD ${c0.value}: ${ops[1]}`);
    } else {
      throw new Error(`Invalid operand for ADD ${c0.value}: ${ops[1]}`);
    }
    return { bytes: [prefix, 0x09 + (pp << 4)], size: 2 };
  }

  // ---- ADC HL,rr / SBC HL,rr ----
  if ((mn === 'ADC' || mn === 'SBC') && c0.type === 'pair' && c0.value === 'HL' && c1) {
    if (c1.type !== 'pair' || PAIR_CODES[c1.value] === undefined) {
      throw new Error(`Invalid operand for ${mn} HL: ${ops[1]}`);
    }
    const base = mn === 'ADC' ? 0x4A : 0x42;
    return { bytes: [0xED, base + (pairCode(c1.value) << 4)], size: 2 };
  }

  // ---- 8-bit ALU: normalize operand ----
  let target;
  if (ops.length === 1) {
    target = c0;
  } else if (ops.length === 2) {
    // First operand should be A (or pair handled above)
    target = c1;
  } else {
    throw new Error(`Invalid ${mn} instruction`);
  }

  if (!target) throw new Error(`Invalid ${mn} instruction`);

  // ALU A,r
  if (target.type === 'reg') {
    return { bytes: [0x80 + (aluCode << 3) + regCode(target.value)], size: 1 };
  }
  // ALU A,(HL)
  if (target.type === 'indirect_pair' && target.value === 'HL') {
    return { bytes: [0x80 + (aluCode << 3) + 6], size: 1 };
  }
  // ALU A,n
  if (target.type === 'immediate') {
    const n = evalByte(target.expr, symbols, pc);
    return { bytes: [0xC6 + (aluCode << 3), n], size: 2 };
  }
  // ALU A,(IX+d)
  if (target.type === 'indexed') {
    const prefix = ixIyPrefix(target.reg);
    const d = signedByte(evalExpr(target.expr, symbols, pc));
    return { bytes: [prefix, 0x86 + (aluCode << 3), d], size: 3 };
  }

  throw new Error(`Invalid ${mn} operand: ${ops.join(',')}`);
}

// ---------------------------------------------------------------------------
// INC/DEC encoding
// ---------------------------------------------------------------------------

function encodeINCDEC(mn, c0, ops, symbols, pc, regBase, pairBase, indexedOpcode) {
  // INC r / DEC r
  if (c0.type === 'reg') {
    return { bytes: [regBase + (regCode(c0.value) << 3)], size: 1 };
  }
  // INC (HL) / DEC (HL)
  if (c0.type === 'indirect_pair' && c0.value === 'HL') {
    return { bytes: [regBase + (6 << 3)], size: 1 };
  }
  // INC rr / DEC rr
  if (c0.type === 'pair') {
    if (c0.value === 'IX' || c0.value === 'IY') {
      const prefix = ixIyPrefix(c0.value);
      // INC IX = DD 23, DEC IX = DD 2B
      const ixBase = mn === 'INC' ? 0x23 : 0x2B;
      return { bytes: [prefix, ixBase], size: 2 };
    }
    if (PAIR_CODES[c0.value] !== undefined) {
      return { bytes: [pairBase + (pairCode(c0.value) << 4)], size: 1 };
    }
  }
  // INC (IX+d) / DEC (IX+d)
  if (c0.type === 'indexed') {
    const prefix = ixIyPrefix(c0.reg);
    const d = signedByte(evalExpr(c0.expr, symbols, pc));
    return { bytes: [prefix, indexedOpcode, d], size: 3 };
  }

  throw new Error(`Invalid ${mn} operand: ${ops[0]}`);
}

// ---------------------------------------------------------------------------
// JP encoding
// ---------------------------------------------------------------------------

function encodeJP(c0, c1, ops, symbols, pc) {
  // JP (HL)
  if (ops.length === 1 && c0.type === 'indirect_pair' && c0.value === 'HL') {
    return { bytes: [0xE9], size: 1 };
  }
  // JP (IX) / JP (IY)
  if (ops.length === 1 && c0.type === 'indexed') {
    return { bytes: [ixIyPrefix(c0.reg), 0xE9], size: 2 };
  }
  // JP nn
  if (ops.length === 1) {
    const val = evalWord(c0.type === 'immediate' ? c0.expr : ops[0], symbols, pc);
    return { bytes: [0xC3, lo(val), hi(val)], size: 3 };
  }
  // JP cc,nn
  if (ops.length === 2) {
    let cc;
    if (c0.type === 'condition') {
      cc = condCode(c0.value);
    } else {
      throw new Error(`Invalid condition code: ${ops[0]}`);
    }
    const val = evalWord(c1.type === 'immediate' ? c1.expr : ops[1], symbols, pc);
    return { bytes: [0xC2 + (cc << 3), lo(val), hi(val)], size: 3 };
  }
  throw new Error('Invalid JP instruction');
}

// ---------------------------------------------------------------------------
// JR encoding
// ---------------------------------------------------------------------------

function encodeJR(c0, c1, ops, symbols, pc) {
  if (ops.length === 1) {
    // JR e
    const target = evalExpr(c0.type === 'immediate' ? c0.expr : ops[0], symbols, pc);
    const disp = target - (pc + 2);
    return { bytes: [0x18, signedByte(disp)], size: 2 };
  }
  if (ops.length === 2) {
    // JR cc,e — only NZ, Z, NC, C
    let cc;
    if (c0.type === 'condition') {
      cc = condCode(c0.value);
    } else {
      throw new Error(`Invalid condition for JR: ${ops[0]}`);
    }
    if (cc > 3) throw new Error(`JR only supports NZ, Z, NC, C conditions`);
    const target = evalExpr(c1.type === 'immediate' ? c1.expr : ops[1], symbols, pc);
    const disp = target - (pc + 2);
    return { bytes: [0x20 + (cc << 3), signedByte(disp)], size: 2 };
  }
  throw new Error('Invalid JR instruction');
}

// ---------------------------------------------------------------------------
// DJNZ encoding
// ---------------------------------------------------------------------------

function encodeDJNZ(c0, ops, symbols, pc) {
  const target = evalExpr(c0.type === 'immediate' ? c0.expr : ops[0], symbols, pc);
  const disp = target - (pc + 2);
  return { bytes: [0x10, signedByte(disp)], size: 2 };
}

// ---------------------------------------------------------------------------
// CALL encoding
// ---------------------------------------------------------------------------

function encodeCALL(c0, c1, ops, symbols, pc) {
  if (ops.length === 1) {
    // CALL nn
    const val = evalWord(c0.type === 'immediate' ? c0.expr : ops[0], symbols, pc);
    return { bytes: [0xCD, lo(val), hi(val)], size: 3 };
  }
  if (ops.length === 2) {
    // CALL cc,nn
    let cc;
    if (c0.type === 'condition') {
      cc = condCode(c0.value);
    } else {
      throw new Error(`Invalid condition code: ${ops[0]}`);
    }
    const val = evalWord(c1.type === 'immediate' ? c1.expr : ops[1], symbols, pc);
    return { bytes: [0xC4 + (cc << 3), lo(val), hi(val)], size: 3 };
  }
  throw new Error('Invalid CALL instruction');
}

// ---------------------------------------------------------------------------
// RET encoding
// ---------------------------------------------------------------------------

function encodeRET(c0, ops) {
  if (ops.length === 0) {
    return { bytes: [0xC9], size: 1 };
  }
  // RET cc
  if (ops.length === 1) {
    let cc;
    if (c0.type === 'condition') {
      cc = condCode(c0.value);
    } else {
      throw new Error(`Invalid condition for RET: ${ops[0]}`);
    }
    return { bytes: [0xC0 + (cc << 3)], size: 2 };
  }
  throw new Error('Invalid RET instruction');
}

// ---------------------------------------------------------------------------
// RST encoding
// ---------------------------------------------------------------------------

function encodeRST(c0, ops, symbols, pc) {
  const val = evalExpr(c0.type === 'immediate' ? c0.expr : ops[0], symbols, pc);
  const valid = [0x00, 0x08, 0x10, 0x18, 0x20, 0x28, 0x30, 0x38];
  if (!valid.includes(val)) {
    throw new Error(`Invalid RST target: ${val} (must be 0x00, 0x08, ..., 0x38)`);
  }
  return { bytes: [0xC7 + val], size: 1 };
}

// ---------------------------------------------------------------------------
// PUSH/POP encoding
// ---------------------------------------------------------------------------

function encodePUSHPOP(c0, ops, baseOpcode, ixIyOpcode) {
  if (c0.type === 'pair') {
    if (c0.value === 'IX' || c0.value === 'IY') {
      return { bytes: [ixIyPrefix(c0.value), ixIyOpcode], size: 2 };
    }
    const pp = PAIR_CODES_PUSH[c0.value];
    if (pp === undefined) throw new Error(`Invalid pair for PUSH/POP: ${c0.value}`);
    return { bytes: [baseOpcode + (pp << 4)], size: 1 };
  }
  throw new Error(`Invalid PUSH/POP operand: ${ops[0]}`);
}

// ---------------------------------------------------------------------------
// EX encoding
// ---------------------------------------------------------------------------

function encodeEX(c0, c1, ops) {
  const u0 = ops[0].toUpperCase();
  const u1 = ops[1].toUpperCase();

  if (u0 === 'DE' && u1 === 'HL') return { bytes: [0xEB], size: 1 };
  if (u0 === 'AF' && u1 === "AF'") return { bytes: [0x08], size: 1 };

  if (c0.type === 'indirect_pair' && c0.value === 'SP') {
    if (c1.type === 'pair' && c1.value === 'HL') return { bytes: [0xE3], size: 1 };
    if (c1.type === 'pair' && (c1.value === 'IX' || c1.value === 'IY')) {
      return { bytes: [ixIyPrefix(c1.value), 0xE3], size: 2 };
    }
  }

  throw new Error(`Invalid EX instruction: EX ${ops.join(',')}`);
}

// ---------------------------------------------------------------------------
// IN encoding
// ---------------------------------------------------------------------------

function encodeIN(c0, c1, ops, symbols, pc) {
  // IN A,(n)
  if (c0.type === 'reg' && c0.value === 'A' && c1.type === 'indirect_addr') {
    const n = evalByte(c1.expr, symbols, pc);
    return { bytes: [0xDB, n], size: 2 };
  }
  // IN r,(C)
  if (c0.type === 'reg' && c1.type === 'indirect_pair' && c1.value === 'C') {
    // (C) is classified as indirect_pair with value C — but C is not in INDIRECT_PAIRS.
    // Actually, classifyOperand will see "(C)" — inner is "C" which is not in INDIRECT_PAIRS,
    // so it becomes indirect_addr with expr="C". We need to check for this.
    throw new Error('Internal: IN r,(C) should use indirect_addr path');
  }
  // IN r,(C) — arrives as c1 = indirect_addr with expr "C"
  if (c0.type === 'reg' && c1.type === 'indirect_addr' && c1.expr.toUpperCase() === 'C') {
    const r = regCode(c0.value);
    return { bytes: [0xED, 0x40 + (r << 3)], size: 2 };
  }
  throw new Error(`Invalid IN instruction: IN ${ops.join(',')}`);
}

// ---------------------------------------------------------------------------
// OUT encoding
// ---------------------------------------------------------------------------

function encodeOUT(c0, c1, ops, symbols, pc) {
  // OUT (n),A
  if (c0.type === 'indirect_addr' && c1.type === 'reg' && c1.value === 'A') {
    // Check if it's OUT (C),A — ED prefix
    if (c0.expr.toUpperCase() === 'C') {
      const r = regCode('A');
      return { bytes: [0xED, 0x41 + (r << 3)], size: 2 };
    }
    const n = evalByte(c0.expr, symbols, pc);
    return { bytes: [0xD3, n], size: 2 };
  }
  // OUT (C),r
  if (c0.type === 'indirect_addr' && c0.expr.toUpperCase() === 'C' && c1.type === 'reg') {
    const r = regCode(c1.value);
    return { bytes: [0xED, 0x41 + (r << 3)], size: 2 };
  }
  throw new Error(`Invalid OUT instruction: OUT ${ops.join(',')}`);
}

// ---------------------------------------------------------------------------
// IM encoding
// ---------------------------------------------------------------------------

function encodeIM(c0, ops, symbols, pc) {
  const val = evalExpr(c0.type === 'immediate' ? c0.expr : ops[0], symbols, pc);
  switch (val) {
    case 0: return { bytes: [0xED, 0x46], size: 2 };
    case 1: return { bytes: [0xED, 0x56], size: 2 };
    case 2: return { bytes: [0xED, 0x5E], size: 2 };
    default: throw new Error(`Invalid IM mode: ${val} (must be 0, 1, or 2)`);
  }
}

// ---------------------------------------------------------------------------
// CB-prefix shift/rotate encoding
// ---------------------------------------------------------------------------

function encodeSHIFT(mn, c0, ops, symbols, pc) {
  const shiftCode = SHIFT_CODES[mn];

  // SHIFT r
  if (c0.type === 'reg') {
    return { bytes: [0xCB, (shiftCode << 3) + regCode(c0.value)], size: 2 };
  }
  // SHIFT (HL)
  if (c0.type === 'indirect_pair' && c0.value === 'HL') {
    return { bytes: [0xCB, (shiftCode << 3) + 6], size: 2 };
  }
  // SHIFT (IX+d)
  if (c0.type === 'indexed') {
    const prefix = ixIyPrefix(c0.reg);
    const d = signedByte(evalExpr(c0.expr, symbols, pc));
    return { bytes: [prefix, 0xCB, d, (shiftCode << 3) + 6], size: 4 };
  }

  throw new Error(`Invalid ${mn} operand: ${ops[0]}`);
}

// ---------------------------------------------------------------------------
// BIT/SET/RES encoding
// ---------------------------------------------------------------------------

function encodeBITSETRES(mn, c0, c1, ops, symbols, pc, baseOpcode) {
  const bit = evalExpr(c0.type === 'immediate' ? c0.expr : ops[0], symbols, pc);
  if (bit < 0 || bit > 7) throw new Error(`Bit number out of range: ${bit} (must be 0-7)`);

  // BIT b,r
  if (c1.type === 'reg') {
    return { bytes: [0xCB, baseOpcode + (bit << 3) + regCode(c1.value)], size: 2 };
  }
  // BIT b,(HL)
  if (c1.type === 'indirect_pair' && c1.value === 'HL') {
    return { bytes: [0xCB, baseOpcode + (bit << 3) + 6], size: 2 };
  }
  // BIT b,(IX+d)
  if (c1.type === 'indexed') {
    const prefix = ixIyPrefix(c1.reg);
    const d = signedByte(evalExpr(c1.expr, symbols, pc));
    return { bytes: [prefix, 0xCB, d, baseOpcode + (bit << 3) + 6], size: 4 };
  }

  throw new Error(`Invalid ${mn} operand: ${ops.join(',')}`);
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = { encodeInstruction, getInstructionSize };
