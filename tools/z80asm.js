/**
 * Mini Z80 assembler for ROM patching.
 *
 * Supports a practical subset of Z80 instructions commonly needed for
 * Spectrum ROM patches: LD, PUSH, POP, JP, CALL, RET, EX, LDIR, INC,
 * DEC, NOP, DI, EI, XOR, AND, OR, CP, DB/DW directives, and labels.
 *
 * Usage:
 *   const { assemble } = require('./z80asm');
 *   const result = assemble(`
 *     .org 0x386E
 *     start:
 *       LD HL, (0x5C53)
 *       LD DE, data
 *       LDIR
 *       JP 0x124D
 *     data:
 *       DB 0x00, 0x0A
 *   `);
 *   // result = { bytes: Uint8Array, org: 0x386E, labels: { start: 0x386E, data: ... } }
 */

'use strict';

// Instruction encoders - each returns an array of bytes or null if no match.
// Operands are pre-parsed tokens.

const R8 = { B: 0, C: 1, D: 2, E: 3, H: 4, L: 5, '(HL)': 6, A: 7 };
const R16 = { BC: 0, DE: 1, HL: 2, SP: 3 };
const R16_PUSH = { BC: 0, DE: 1, HL: 2, AF: 3 };

function parseNumber(s) {
  s = s.trim();
  if (/^0x[0-9a-fA-F]+$/i.test(s)) return parseInt(s, 16);
  if (/^[0-9a-fA-F]+h$/i.test(s)) return parseInt(s.slice(0, -1), 16);
  if (/^\$[0-9a-fA-F]+$/i.test(s)) return parseInt(s.slice(1), 16);
  if (/^0b[01]+$/i.test(s)) return parseInt(s.slice(2), 2);
  if (/^[0-9]+$/.test(s)) return parseInt(s, 10);
  return NaN;
}

function isIndirect(s) {
  return s.startsWith('(') && s.endsWith(')');
}

function stripParens(s) {
  return s.slice(1, -1).trim();
}

function lo(v) { return v & 0xFF; }
function hi(v) { return (v >> 8) & 0xFF; }

/**
 * Assemble source text into bytes.
 * Two-pass: first pass collects labels, second pass emits bytes.
 */
function assemble(source) {
  const lines = source.split('\n');
  let org = 0;
  const labels = {};
  const errors = [];

  // Pre-process: strip comments, collect raw lines
  const processed = [];
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    // Strip comments (but not inside strings)
    const commentIdx = findComment(line);
    if (commentIdx >= 0) line = line.slice(0, commentIdx);
    line = line.trim();
    if (!line) continue;
    processed.push({ text: line, lineNum: i + 1 });
  }

  // Two-pass assembly
  let bytes = [];

  for (let pass = 0; pass < 2; pass++) {
    bytes = [];
    let pc = org;

    for (const { text, lineNum } of processed) {
      try {
        // .org directive
        if (/^\.org\s+/i.test(text)) {
          const val = resolveExpr(text.replace(/^\.org\s+/i, ''), labels, pass);
          org = val;
          pc = val;
          continue;
        }

        // Label definition (ends with :)
        let line = text;
        const labelMatch = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*:/);
        if (labelMatch) {
          labels[labelMatch[1]] = pc;
          line = line.slice(labelMatch[0].length).trim();
          if (!line) continue;
        }

        // DB directive
        if (/^(DB|DEFB|\.db|\.byte)\s+/i.test(line)) {
          const dataStr = line.replace(/^(DB|DEFB|\.db|\.byte)\s+/i, '');
          const vals = parseDataList(dataStr, labels, pass);
          for (const v of vals) {
            bytes.push(v & 0xFF);
            pc++;
          }
          continue;
        }

        // DW directive
        if (/^(DW|DEFW|\.dw|\.word)\s+/i.test(line)) {
          const dataStr = line.replace(/^(DW|DEFW|\.dw|\.word)\s+/i, '');
          const vals = parseCommaSep(dataStr).map(s => resolveExpr(s, labels, pass));
          for (const v of vals) {
            bytes.push(lo(v));
            bytes.push(hi(v));
            pc += 2;
          }
          continue;
        }

        // DS (define space) directive
        if (/^(DS|DEFS|\.ds)\s+/i.test(line)) {
          const parts = parseCommaSep(line.replace(/^(DS|DEFS|\.ds)\s+/i, ''));
          const count = resolveExpr(parts[0], labels, pass);
          const fill = parts.length > 1 ? resolveExpr(parts[1], labels, pass) : 0;
          for (let i = 0; i < count; i++) {
            bytes.push(fill & 0xFF);
            pc++;
          }
          continue;
        }

        // Instruction
        const encoded = encodeInstruction(line, labels, pass, pc);
        if (encoded === null) {
          if (pass === 1) errors.push(`Line ${lineNum}: Unknown instruction: ${line}`);
        } else {
          for (const b of encoded) {
            bytes.push(b);
            pc++;
          }
        }
      } catch (e) {
        if (pass === 1) errors.push(`Line ${lineNum}: ${e.message}`);
      }
    }
  }

  if (errors.length > 0) {
    throw new Error('Assembly errors:\n' + errors.join('\n'));
  }

  return { bytes: new Uint8Array(bytes), org, labels };
}

function findComment(line) {
  let inString = false;
  let quote = '';
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inString) {
      if (c === quote) inString = false;
    } else {
      if (c === '"' || c === "'") { inString = true; quote = c; }
      if (c === ';') return i;
    }
  }
  return -1;
}

function parseCommaSep(s) {
  const parts = [];
  let depth = 0, current = '', inStr = false, quote = '';
  for (const c of s) {
    if (inStr) {
      current += c;
      if (c === quote) inStr = false;
    } else if (c === '"' || c === "'") {
      inStr = true; quote = c; current += c;
    } else if (c === '(') { depth++; current += c; }
    else if (c === ')') { depth--; current += c; }
    else if (c === ',' && depth === 0) { parts.push(current.trim()); current = ''; }
    else { current += c; }
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

function parseDataList(s, labels, pass) {
  const parts = parseCommaSep(s);
  const result = [];
  for (const p of parts) {
    if ((p.startsWith('"') && p.endsWith('"')) || (p.startsWith("'") && p.endsWith("'"))) {
      const str = p.slice(1, -1);
      for (const ch of str) result.push(ch.charCodeAt(0));
    } else {
      result.push(resolveExpr(p, labels, pass));
    }
  }
  return result;
}

function resolveExpr(expr, labels, pass) {
  expr = expr.trim();
  // Simple expressions: number, label, or label +/- number
  const n = parseNumber(expr);
  if (!isNaN(n)) return n;

  if (labels.hasOwnProperty(expr)) return labels[expr];

  // label + offset or label - offset
  const m = expr.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*([+-])\s*(.+)$/);
  if (m) {
    const base = labels.hasOwnProperty(m[1]) ? labels[m[1]] : (pass === 0 ? 0 : NaN);
    const offset = resolveExpr(m[3], labels, pass);
    if (isNaN(base) && pass === 1) throw new Error(`Unknown label: ${m[1]}`);
    return m[2] === '+' ? base + offset : base - offset;
  }

  // $ = current PC (not implemented here for simplicity)
  if (pass === 0) return 0; // placeholder
  throw new Error(`Cannot resolve expression: ${expr}`);
}

function encodeInstruction(line, labels, pass, pc) {
  // Normalize whitespace: collapse runs of spaces, remove space after commas
  const upper = line.toUpperCase().trim().replace(/\s+/g, ' ').replace(/,\s+/g, ',');

  // Simple instructions (no operands)
  const simple = {
    'NOP': [0x00], 'RLCA': [0x07], 'RRCA': [0x0F], 'RLA': [0x17], 'RRA': [0x1F],
    'DAA': [0x27], 'CPL': [0x2F], 'SCF': [0x37], 'CCF': [0x3F],
    'HALT': [0x76], 'DI': [0xF3], 'EI': [0xFB], 'RET': [0xC9],
    'EXX': [0xD9], 'LDIR': [0xED, 0xB0], 'LDDR': [0xED, 0xB8],
    'CPIR': [0xED, 0xB1], 'CPDR': [0xED, 0xB9],
    'EX DE,HL': [0xEB], 'EX (SP),HL': [0xE3], 'EX AF,AF\'': [0x08],
    'RETI': [0xED, 0x4D], 'RETN': [0xED, 0x45],
    'NEG': [0xED, 0x44],
    'IM 0': [0xED, 0x46], 'IM 1': [0xED, 0x56], 'IM 2': [0xED, 0x5E],
  };
  if (simple[upper]) return simple[upper];

  // Split mnemonic and operands
  const spaceIdx = line.search(/\s/);
  if (spaceIdx < 0) return null; // unknown single-word instruction
  const mnemonic = line.slice(0, spaceIdx).toUpperCase();
  const operandStr = line.slice(spaceIdx).trim();
  const operands = parseCommaSep(operandStr).map(s => s.trim());

  switch (mnemonic) {
    case 'LD': return encodeLd(operands, labels, pass);
    case 'PUSH': return encodePushPop(operands, 0xC5);
    case 'POP': return encodePushPop(operands, 0xC1);
    case 'JP': return encodeJpCall(operands, 0xC3, labels, pass);
    case 'CALL': return encodeJpCall(operands, 0xCD, labels, pass);
    case 'JR': return encodeJr(operands, labels, pass, pc);
    case 'DJNZ': return encodeDjnz(operands, labels, pass, pc);
    case 'INC': return encodeIncDec(operands, 0x04, 0x03);
    case 'DEC': return encodeIncDec(operands, 0x05, 0x0B);
    case 'ADD': return encodeAlu(operands, 0x80, 0xC6, labels, pass);
    case 'ADC': return encodeAlu(operands, 0x88, 0xCE, labels, pass);
    case 'SUB': return encodeAlu1(operands, 0x90, 0xD6, labels, pass);
    case 'SBC': return encodeAlu(operands, 0x98, 0xDE, labels, pass);
    case 'AND': return encodeAlu1(operands, 0xA0, 0xE6, labels, pass);
    case 'XOR': return encodeAlu1(operands, 0xA8, 0xEE, labels, pass);
    case 'OR': return encodeAlu1(operands, 0xB0, 0xF6, labels, pass);
    case 'CP': return encodeAlu1(operands, 0xB8, 0xFE, labels, pass);
    case 'RST': return encodeRst(operands, labels, pass);
    case 'OUT': return encodeOut(operands, labels, pass);
    case 'IN': return encodeIn(operands, labels, pass);
    case 'BIT': return encodeBitOp(operands, 0xCB, 0x40);
    case 'SET': return encodeBitOp(operands, 0xCB, 0xC0);
    case 'RES': return encodeBitOp(operands, 0xCB, 0x80);
    case 'RLC': return encodeShift(operands, 0xCB, 0x00);
    case 'RRC': return encodeShift(operands, 0xCB, 0x08);
    case 'RL': return encodeShift(operands, 0xCB, 0x10);
    case 'RR': return encodeShift(operands, 0xCB, 0x18);
    case 'SLA': return encodeShift(operands, 0xCB, 0x20);
    case 'SRA': return encodeShift(operands, 0xCB, 0x28);
    case 'SRL': return encodeShift(operands, 0xCB, 0x38);
    default: return null;
  }
}

function encodeLd(ops, labels, pass) {
  if (ops.length !== 2) return null;
  const [dst, src] = [ops[0].toUpperCase(), ops[1]];
  const srcUpper = src.toUpperCase();

  // LD r, r'
  if (R8[dst] !== undefined && R8[srcUpper] !== undefined) {
    return [0x40 | (R8[dst] << 3) | R8[srcUpper]];
  }

  // LD r, n
  if (R8[dst] !== undefined) {
    const n = resolveExpr(src, labels, pass);
    return [0x06 | (R8[dst] << 3), lo(n)];
  }

  // LD rr, nn
  if (R16[dst] !== undefined) {
    const nn = resolveExpr(src, labels, pass);
    return [0x01 | (R16[dst] << 4), lo(nn), hi(nn)];
  }

  // LD SP, HL
  if (dst === 'SP' && srcUpper === 'HL') return [0xF9];

  // LD HL, (nn)
  if (dst === 'HL' && isIndirect(srcUpper)) {
    const inner = stripParens(src);
    if (R8[inner.toUpperCase()] === undefined && R16[inner.toUpperCase()] === undefined) {
      const nn = resolveExpr(inner, labels, pass);
      return [0x2A, lo(nn), hi(nn)];
    }
  }

  // LD (nn), HL
  if (isIndirect(dst) && srcUpper === 'HL') {
    const inner = stripParens(ops[0]);
    const nn = resolveExpr(inner, labels, pass);
    return [0x22, lo(nn), hi(nn)];
  }

  // LD rr, (nn) - BC, DE, SP via ED prefix
  if (R16[dst] !== undefined && dst !== 'HL' && isIndirect(srcUpper)) {
    const inner = stripParens(src);
    const nn = resolveExpr(inner, labels, pass);
    return [0xED, 0x4B | (R16[dst] << 4), lo(nn), hi(nn)];
  }

  // LD (nn), rr - BC, DE, SP via ED prefix
  if (isIndirect(dst) && R16[srcUpper] !== undefined && srcUpper !== 'HL') {
    const inner = stripParens(ops[0]);
    const nn = resolveExpr(inner, labels, pass);
    return [0xED, 0x43 | (R16[srcUpper] << 4), lo(nn), hi(nn)];
  }

  // LD (nn), A
  if (isIndirect(dst) && srcUpper === 'A') {
    const inner = stripParens(ops[0]).toUpperCase();
    if (inner === 'BC') return [0x02];
    if (inner === 'DE') return [0x12];
    const nn = resolveExpr(stripParens(ops[0]), labels, pass);
    return [0x32, lo(nn), hi(nn)];
  }

  // LD A, (nn)
  if (dst === 'A' && isIndirect(srcUpper)) {
    const inner = stripParens(src).toUpperCase();
    if (inner === 'BC') return [0x0A];
    if (inner === 'DE') return [0x1A];
    const nn = resolveExpr(stripParens(src), labels, pass);
    return [0x3A, lo(nn), hi(nn)];
  }

  // LD (HL), n
  if (dst === '(HL)') {
    const n = resolveExpr(src, labels, pass);
    return [0x36, lo(n)];
  }

  // LD I, A / LD A, I / LD R, A / LD A, R
  if (dst === 'I' && srcUpper === 'A') return [0xED, 0x47];
  if (dst === 'A' && srcUpper === 'I') return [0xED, 0x57];
  if (dst === 'R' && srcUpper === 'A') return [0xED, 0x4F];
  if (dst === 'A' && srcUpper === 'R') return [0xED, 0x5F];

  // LD (IY+d), n  and  LD (IX+d), n
  const iyMatch = dst.match(/^\(I([XY])\s*([+-])\s*(.+)\)$/i);
  if (iyMatch) {
    const prefix = iyMatch[1].toUpperCase() === 'X' ? 0xDD : 0xFD;
    const sign = iyMatch[2];
    let d = resolveExpr(iyMatch[3], labels, pass);
    if (sign === '-') d = (-d) & 0xFF;
    const n = resolveExpr(src, labels, pass);
    return [prefix, 0x36, d & 0xFF, lo(n)];
  }

  return null;
}

function encodePushPop(ops, baseOpcode) {
  if (ops.length !== 1) return null;
  const reg = ops[0].toUpperCase();
  if (R16_PUSH[reg] === undefined) return null;
  return [baseOpcode | (R16_PUSH[reg] << 4)];
}

function encodeJpCall(ops, opcode, labels, pass) {
  // Unconditional: JP nn / CALL nn
  if (ops.length === 1) {
    const upper = ops[0].toUpperCase();
    // JP (HL)
    if (opcode === 0xC3 && upper === '(HL)') return [0xE9];
    const nn = resolveExpr(ops[0], labels, pass);
    return [opcode, lo(nn), hi(nn)];
  }
  // Conditional: JP cc, nn / CALL cc, nn
  if (ops.length === 2) {
    const cc = { 'NZ': 0, 'Z': 1, 'NC': 2, 'C': 3, 'PO': 4, 'PE': 5, 'P': 6, 'M': 7 };
    const cond = ops[0].toUpperCase();
    if (cc[cond] === undefined) return null;
    const nn = resolveExpr(ops[1], labels, pass);
    const base = opcode === 0xC3 ? 0xC2 : 0xC4;
    return [base | (cc[cond] << 3), lo(nn), hi(nn)];
  }
  return null;
}

function encodeJr(ops, labels, pass, pc) {
  const cc = { 'NZ': 0x20, 'Z': 0x28, 'NC': 0x30, 'C': 0x38 };
  if (ops.length === 1) {
    const target = resolveExpr(ops[0], labels, pass);
    const offset = (target - (pc + 2)) & 0xFF;
    return [0x18, offset];
  }
  if (ops.length === 2) {
    const cond = ops[0].toUpperCase();
    if (cc[cond] === undefined) return null;
    const target = resolveExpr(ops[1], labels, pass);
    const offset = (target - (pc + 2)) & 0xFF;
    return [cc[cond], offset];
  }
  return null;
}

function encodeDjnz(ops, labels, pass, pc) {
  if (ops.length !== 1) return null;
  const target = resolveExpr(ops[0], labels, pass);
  const offset = (target - (pc + 2)) & 0xFF;
  return [0x10, offset];
}

function encodeIncDec(ops, r8Base, r16Base) {
  if (ops.length !== 1) return null;
  const reg = ops[0].toUpperCase();
  if (R8[reg] !== undefined) return [r8Base | (R8[reg] << 3)];
  if (R16[reg] !== undefined) return [r16Base | (R16[reg] << 4)];
  return null;
}

function encodeAlu(ops, r8Base, immOpcode, labels, pass) {
  // ADD A, r / ADD A, n / ADD HL, rr
  if (ops.length === 2) {
    const dst = ops[0].toUpperCase();
    const src = ops[1].toUpperCase();
    if (dst === 'A') {
      if (R8[src] !== undefined) return [r8Base | R8[src]];
      const n = resolveExpr(ops[1], labels, pass);
      return [immOpcode, lo(n)];
    }
    if (dst === 'HL' && R16[src] !== undefined) {
      if (r8Base === 0x80) return [0x09 | (R16[src] << 4)]; // ADD HL, rr
      if (r8Base === 0x88) return [0xED, 0x4A | (R16[src] << 4)]; // ADC HL, rr
      if (r8Base === 0x98) return [0xED, 0x42 | (R16[src] << 4)]; // SBC HL, rr
    }
  }
  return null;
}

function encodeAlu1(ops, r8Base, immOpcode, labels, pass) {
  // SUB r / AND r / etc. (single operand implicit A)
  if (ops.length === 1) {
    const src = ops[0].toUpperCase();
    if (R8[src] !== undefined) return [r8Base | R8[src]];
    const n = resolveExpr(ops[0], labels, pass);
    return [immOpcode, lo(n)];
  }
  // Also accept "SUB A, r" form
  if (ops.length === 2 && ops[0].toUpperCase() === 'A') {
    const src = ops[1].toUpperCase();
    if (R8[src] !== undefined) return [r8Base | R8[src]];
    const n = resolveExpr(ops[1], labels, pass);
    return [immOpcode, lo(n)];
  }
  return null;
}

function encodeRst(ops, labels, pass) {
  if (ops.length !== 1) return null;
  const n = resolveExpr(ops[0], labels, pass);
  if ([0x00, 0x08, 0x10, 0x18, 0x20, 0x28, 0x30, 0x38].includes(n)) {
    return [0xC7 | n];
  }
  return null;
}

function encodeOut(ops, labels, pass) {
  if (ops.length === 2) {
    if (isIndirect(ops[0]) && ops[1].toUpperCase() === 'A') {
      const port = resolveExpr(stripParens(ops[0]), labels, pass);
      return [0xD3, lo(port)];
    }
  }
  return null;
}

function encodeIn(ops, labels, pass) {
  if (ops.length === 2) {
    if (ops[0].toUpperCase() === 'A' && isIndirect(ops[1])) {
      const port = resolveExpr(stripParens(ops[1]), labels, pass);
      return [0xDB, lo(port)];
    }
  }
  return null;
}

function encodeBitOp(ops, prefix, baseOp) {
  if (ops.length !== 2) return null;
  const bit = parseNumber(ops[0]);
  const reg = ops[1].toUpperCase();
  if (isNaN(bit) || bit < 0 || bit > 7) return null;

  // Check for (IY+d)
  const iyMatch = reg.match(/^\(I([XY])\s*([+-])\s*(.+)\)$/i);
  if (iyMatch) {
    const ixiy = iyMatch[1].toUpperCase() === 'X' ? 0xDD : 0xFD;
    const sign = iyMatch[2];
    let d = parseNumber(iyMatch[3]);
    if (sign === '-') d = (-d) & 0xFF;
    return [ixiy, 0xCB, d & 0xFF, baseOp | (bit << 3) | 6];
  }

  if (R8[reg] === undefined) return null;
  return [prefix, baseOp | (bit << 3) | R8[reg]];
}

function encodeShift(ops, prefix, baseOp) {
  if (ops.length !== 1) return null;
  const reg = ops[0].toUpperCase();
  if (R8[reg] === undefined) return null;
  return [prefix, baseOp | R8[reg]];
}

module.exports = { assemble, parseNumber };
