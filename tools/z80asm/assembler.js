'use strict';

const { parseLine } = require('./parser');
const { encodeInstruction, getInstructionSize } = require('./encoder');
const { evaluateExpression } = require('./expressions');

/**
 * Two-pass Z80 assembler.
 *
 * @param {string} sourceText - Full assembly source
 * @param {object} options    - { org: number, filename: string }
 * @returns {{ binary: Buffer, loadAddress: number, endAddress: number, symbols: Map, errors: string[] }}
 */
function assemble(sourceText, options) {
  const defaultOrg = (options && options.org != null) ? options.org : 0x8000;
  const errors = [];
  const symbols = new Map(); // lowercase key → value
  const lines = sourceText.split(/\r?\n/);

  let pc = defaultOrg;
  let loadAddress = defaultOrg;
  let loadAddressSet = false;
  let currentScope = '';

  // Stored parsed lines with their PC values for pass 2
  const parsed = [];

  // ---------------------------------------------------------------------------
  // Helper: evaluate expression, returning undefined on failure (pass 1)
  // ---------------------------------------------------------------------------
  function tryEval(expr, pcVal) {
    try {
      return evaluateExpression(expr, symbols, pcVal);
    } catch (_) {
      return undefined;
    }
  }

  // ---------------------------------------------------------------------------
  // Helper: evaluate expression, throwing on failure (pass 2)
  // ---------------------------------------------------------------------------
  function evalExpr(expr, pcVal) {
    return evaluateExpression(expr, symbols, pcVal);
  }

  // ---------------------------------------------------------------------------
  // Helper: count bytes for DB operands
  // ---------------------------------------------------------------------------
  function countDbBytes(operands) {
    let count = 0;
    for (const op of operands) {
      if (isStringLiteral(op)) {
        count += op.length - 2; // subtract the two quote chars
      } else {
        count += 1;
      }
    }
    return count;
  }

  // ---------------------------------------------------------------------------
  // Helper: check if operand is a string literal
  // ---------------------------------------------------------------------------
  function isStringLiteral(op) {
    return op.length >= 2 && op[0] === '"' && op[op.length - 1] === '"';
  }

  // ---------------------------------------------------------------------------
  // Helper: resolve local label references in operands
  // Replaces .label with scope.label so the expression evaluator can find them
  // ---------------------------------------------------------------------------
  function resolveLocalRefs(operands, scope) {
    return operands.map(op => {
      // Replace standalone .name references (but not inside strings)
      if (op.startsWith('"')) return op;
      return op.replace(/(^|[^a-zA-Z0-9_])\.([a-zA-Z_][a-zA-Z0-9_]*)/g, (match, prefix, name) => {
        return prefix + scope + '.' + name;
      });
    });
  }

  // ---------------------------------------------------------------------------
  // Helper: store symbol (case-insensitive), report duplicate
  // ---------------------------------------------------------------------------
  function defineSymbol(name, value, lineNumber) {
    const key = name.toLowerCase();
    if (symbols.has(key)) {
      errors.push(`Line ${lineNumber}: Duplicate label '${name}'`);
      return;
    }
    symbols.set(key, value);
  }

  // ---------------------------------------------------------------------------
  // Pass 1: Collect labels and calculate sizes
  // ---------------------------------------------------------------------------
  for (let i = 0; i < lines.length; i++) {
    const lineNumber = i + 1;
    let info;
    try {
      info = parseLine(lines[i], lineNumber, currentScope);
    } catch (e) {
      errors.push(`Line ${lineNumber}: ${e.message}`);
      parsed.push({ info: null, pc });
      continue;
    }

    // Update current scope for local label resolution
    if (info.label && !info.isLocalLabel) {
      currentScope = info.label;
    }

    // Handle label (if not EQU — EQU labels get their value from the expression)
    if (info.label && info.mnemonic !== 'EQU') {
      defineSymbol(info.label, pc, lineNumber);
    }

    const entry = { info, pc };
    parsed.push(entry);

    if (!info.mnemonic) continue;

    const mn = info.mnemonic;
    const ops = resolveLocalRefs(info.operands, currentScope);
    info.operands = ops; // store resolved operands for pass 2

    try {
      switch (mn) {
        case 'EQU': {
          // Try to evaluate now; if forward ref, we'll resolve in pass 2
          const val = tryEval(ops[0], pc);
          if (val !== undefined) {
            defineSymbol(info.label, val, lineNumber);
          } else {
            // Reserve slot so we can fill it in pass 2
            // Don't error on duplicate here — defineSymbol will catch it
            const key = info.label.toLowerCase();
            if (!symbols.has(key)) {
              symbols.set(key, 0); // placeholder
              entry.deferredEqu = true;
            }
          }
          break;
        }

        case 'ORG': {
          const val = tryEval(ops[0], pc);
          if (val !== undefined) {
            pc = val;
            if (!loadAddressSet) {
              loadAddress = val;
              loadAddressSet = true;
            }
          } else {
            errors.push(`Line ${lineNumber}: Cannot resolve ORG expression`);
          }
          // Update stored pc after ORG
          entry.pc = pc;
          break;
        }

        case 'DB':
        case 'DEFB': {
          pc += countDbBytes(ops);
          break;
        }

        case 'DW':
        case 'DEFW': {
          pc += ops.length * 2;
          break;
        }

        case 'DS':
        case 'DEFS': {
          const count = tryEval(ops[0], pc);
          if (count !== undefined) {
            pc += count;
          } else {
            errors.push(`Line ${lineNumber}: Cannot resolve DS/DEFS count expression`);
          }
          break;
        }

        case 'END': {
          // Stop processing further lines
          break;
        }

        default: {
          // Regular instruction
          const size = getInstructionSize(mn, ops);
          pc += size;
          break;
        }
      }
    } catch (e) {
      errors.push(`Line ${lineNumber}: ${e.message}`);
    }

    // Stop processing on END directive
    if (mn === 'END') break;
  }

  // ---------------------------------------------------------------------------
  // Pass 2: Emit bytes
  // ---------------------------------------------------------------------------
  const output = [];
  pc = defaultOrg;

  for (const entry of parsed) {
    const { info } = entry;
    if (!info || !info.mnemonic) {
      // Restore pc from pass 1 for label-only or empty lines
      pc = entry.pc;
      continue;
    }

    pc = entry.pc;
    const mn = info.mnemonic;
    const ops = info.operands;
    const lineNumber = info.lineNumber;

    try {
      switch (mn) {
        case 'EQU': {
          // Re-evaluate with full symbol table
          const val = evalExpr(ops[0], pc);
          const key = info.label.toLowerCase();
          symbols.set(key, val);
          break;
        }

        case 'ORG': {
          pc = evalExpr(ops[0], pc);
          break;
        }

        case 'DB':
        case 'DEFB': {
          for (const op of ops) {
            if (isStringLiteral(op)) {
              const str = op.slice(1, -1);
              for (let c = 0; c < str.length; c++) {
                output.push(str.charCodeAt(c) & 0xFF);
              }
              pc += str.length;
            } else {
              const val = evalExpr(op, pc);
              output.push(val & 0xFF);
              pc += 1;
            }
          }
          break;
        }

        case 'DW':
        case 'DEFW': {
          for (const op of ops) {
            const val = evalExpr(op, pc);
            output.push(val & 0xFF);
            output.push((val >> 8) & 0xFF);
            pc += 2;
          }
          break;
        }

        case 'DS':
        case 'DEFS': {
          const count = evalExpr(ops[0], pc);
          const fill = ops.length > 1 ? evalExpr(ops[1], pc) : 0;
          for (let j = 0; j < count; j++) {
            output.push(fill & 0xFF);
          }
          pc += count;
          break;
        }

        case 'END': {
          break;
        }

        default: {
          // Regular instruction
          const result = encodeInstruction(mn, ops, symbols, pc);
          for (const b of result.bytes) {
            output.push(b);
          }
          pc += result.size;
          break;
        }
      }
    } catch (e) {
      errors.push(`Line ${lineNumber}: ${e.message}`);
    }

    if (mn === 'END') break;
  }

  const endAddress = pc;
  const binary = Buffer.from(output);

  return { binary, loadAddress, endAddress, symbols, errors };
}

module.exports = { assemble };
