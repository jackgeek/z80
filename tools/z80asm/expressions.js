'use strict';

/**
 * Expression evaluator for Z80 assembler.
 * Supports arithmetic expressions with symbols, numeric literals, and operator precedence.
 */

/**
 * Parse a numeric literal string and return its integer value.
 * Supported formats:
 *   Decimal: 42
 *   Hex: $FF, 0xFF, 0FFh, FFh
 *   Binary: %10101010, 0b10101010
 *   Character: 'A'
 * Returns NaN if the token doesn't match any format.
 */
function parseNumber(token) {
  if (typeof token !== 'string' || token.length === 0) return NaN;

  // Character literal: 'A'
  if (token.length === 3 && token[0] === "'" && token[2] === "'") {
    return token.charCodeAt(1);
  }

  // Hex: $FF
  if (token[0] === '$' && token.length > 1) {
    const val = parseInt(token.slice(1), 16);
    return isNaN(val) ? NaN : val;
  }

  // Hex: 0xFF or 0XFF
  if (token.length > 2 && token[0] === '0' && (token[1] === 'x' || token[1] === 'X')) {
    const val = parseInt(token.slice(2), 16);
    return isNaN(val) ? NaN : val;
  }

  // Binary: %10101010
  if (token[0] === '%' && token.length > 1) {
    const val = parseInt(token.slice(1), 2);
    return isNaN(val) ? NaN : val;
  }

  // Binary: 0b10101010 or 0B10101010
  if (token.length > 2 && token[0] === '0' && (token[1] === 'b' || token[1] === 'B')) {
    const val = parseInt(token.slice(2), 2);
    return isNaN(val) ? NaN : val;
  }

  // Hex with trailing h: 0FFh, FFh
  if (/^[0-9a-fA-F]+[hH]$/.test(token)) {
    const val = parseInt(token.slice(0, -1), 16);
    return isNaN(val) ? NaN : val;
  }

  // Decimal (must be purely digits)
  if (/^[0-9]+$/.test(token)) {
    return parseInt(token, 10);
  }

  return NaN;
}

/**
 * Tokenize an expression string into an array of token objects.
 * Each token is { type, value } where type is one of:
 *   'number', 'symbol', 'op', 'lparen', 'rparen', 'dollar'
 */
function tokenize(expr) {
  const tokens = [];
  let i = 0;

  while (i < expr.length) {
    const ch = expr[i];

    // Skip whitespace
    if (ch === ' ' || ch === '\t') {
      i++;
      continue;
    }

    // Character literal 'X'
    if (ch === "'") {
      if (i + 2 < expr.length && expr[i + 2] === "'") {
        const charLit = expr.slice(i, i + 3);
        tokens.push({ type: 'number', value: parseNumber(charLit) });
        i += 3;
        continue;
      }
      throw new Error(`Invalid character literal at position ${i}`);
    }

    // Parentheses
    if (ch === '(') { tokens.push({ type: 'lparen' }); i++; continue; }
    if (ch === ')') { tokens.push({ type: 'rparen' }); i++; continue; }

    // Operators: + - * / %
    if (ch === '+' || ch === '-' || ch === '*' || ch === '/' || ch === '%') {
      tokens.push({ type: 'op', value: ch });
      i++;
      continue;
    }

    // $ alone (PC) vs $hex
    if (ch === '$') {
      // Check if followed by hex digits — then it's a hex literal
      let j = i + 1;
      while (j < expr.length && /[0-9a-fA-F]/.test(expr[j])) j++;
      if (j > i + 1) {
        const hexStr = expr.slice(i, j);
        tokens.push({ type: 'number', value: parseNumber(hexStr) });
        i = j;
      } else {
        tokens.push({ type: 'dollar' });
        i++;
      }
      continue;
    }

    // Binary literal %...
    if (ch === '%' && i + 1 < expr.length && (expr[i + 1] === '0' || expr[i + 1] === '1')) {
      // This won't actually be reached because % is caught as operator above.
      // Binary literals starting with % must be written without spaces after %
      // and are ambiguous with the modulo operator. Since % is caught as op,
      // binary literals should use 0b prefix in expressions. This is intentional.
    }

    // Numbers starting with a digit
    if (/[0-9]/.test(ch)) {
      let j = i;
      // Gather digits, hex chars, and possible 'x', 'b', 'h' suffixes
      // First check for 0x or 0b prefixes
      if (ch === '0' && i + 1 < expr.length && (expr[i + 1] === 'x' || expr[i + 1] === 'X')) {
        j = i + 2;
        while (j < expr.length && /[0-9a-fA-F]/.test(expr[j])) j++;
      } else if (ch === '0' && i + 1 < expr.length && (expr[i + 1] === 'b' || expr[i + 1] === 'B')) {
        j = i + 2;
        while (j < expr.length && /[01]/.test(expr[j])) j++;
      } else {
        // Could be decimal, or hex with trailing h
        while (j < expr.length && /[0-9a-fA-F]/.test(expr[j])) j++;
        if (j < expr.length && (expr[j] === 'h' || expr[j] === 'H')) j++;
      }
      const numStr = expr.slice(i, j);
      const val = parseNumber(numStr);
      if (isNaN(val)) {
        throw new Error(`Invalid numeric literal: ${numStr}`);
      }
      tokens.push({ type: 'number', value: val });
      i = j;
      continue;
    }

    // Symbol names (identifiers): start with a letter, underscore, or dot (local labels)
    if (/[a-zA-Z_.]/.test(ch)) {
      let j = i;
      while (j < expr.length && /[a-zA-Z0-9_.]/.test(expr[j])) j++;
      // Check for trailing h — could be hex like FFh, but those start with a digit
      // Symbols starting with a letter that aren't hex-h are just symbols
      const name = expr.slice(i, j);
      tokens.push({ type: 'symbol', value: name });
      i = j;
      continue;
    }

    throw new Error(`Unexpected character '${ch}' at position ${i}`);
  }

  return tokens;
}

/**
 * Evaluate an arithmetic expression string.
 *
 * @param {string} expr - Expression like "label + 4", "$8000", "start - $"
 * @param {Map|Object} symbols - Map or object of symbol names to integer values (case-insensitive)
 * @param {number} pc - Current program counter (used when $ appears)
 * @returns {number} Integer result
 * @throws {Error} On undefined symbol, syntax error, or division by zero
 */
function evaluateExpression(expr, symbols, pc) {
  if (typeof expr !== 'string') {
    throw new Error('Expression must be a string');
  }

  const trimmed = expr.trim();
  if (trimmed.length === 0) {
    throw new Error('Empty expression');
  }

  const tokens = tokenize(trimmed);
  if (tokens.length === 0) {
    throw new Error('Empty expression');
  }

  // Normalize symbols to a case-insensitive lookup
  const symLookup = new Map();
  if (symbols instanceof Map) {
    for (const [k, v] of symbols) {
      symLookup.set(k.toLowerCase(), v);
    }
  } else if (symbols && typeof symbols === 'object') {
    for (const k of Object.keys(symbols)) {
      symLookup.set(k.toLowerCase(), symbols[k]);
    }
  }

  // Recursive descent parser
  let pos = 0;

  function peek() {
    return pos < tokens.length ? tokens[pos] : null;
  }

  function consume() {
    return tokens[pos++];
  }

  // expression = term (('+' | '-') term)*
  function parseExpression() {
    let left = parseTerm();
    while (true) {
      const t = peek();
      if (t && t.type === 'op' && (t.value === '+' || t.value === '-')) {
        consume();
        const right = parseTerm();
        if (t.value === '+') left = left + right;
        else left = left - right;
      } else {
        break;
      }
    }
    return left;
  }

  // term = unary (('*' | '/' | '%') unary)*
  function parseTerm() {
    let left = parseUnary();
    while (true) {
      const t = peek();
      if (t && t.type === 'op' && (t.value === '*' || t.value === '/' || t.value === '%')) {
        consume();
        const right = parseUnary();
        if (t.value === '*') {
          left = left * right;
        } else if (t.value === '/') {
          if (right === 0) throw new Error('Division by zero');
          left = Math.trunc(left / right);
        } else {
          if (right === 0) throw new Error('Division by zero');
          left = left % right;
        }
      } else {
        break;
      }
    }
    return left;
  }

  // unary = '-' unary | '+' unary | primary
  function parseUnary() {
    const t = peek();
    if (t && t.type === 'op' && t.value === '-') {
      consume();
      return -parseUnary();
    }
    if (t && t.type === 'op' && t.value === '+') {
      consume();
      return parseUnary();
    }
    return parsePrimary();
  }

  // primary = number | dollar | symbol | '(' expression ')'
  function parsePrimary() {
    const t = peek();
    if (!t) {
      throw new Error('Unexpected end of expression');
    }

    if (t.type === 'number') {
      consume();
      return t.value;
    }

    if (t.type === 'dollar') {
      consume();
      if (pc === undefined || pc === null) {
        throw new Error('Program counter ($) not available');
      }
      return pc;
    }

    if (t.type === 'symbol') {
      consume();
      const key = t.value.toLowerCase();
      if (!symLookup.has(key)) {
        throw new Error(`Undefined symbol: ${t.value}`);
      }
      return symLookup.get(key);
    }

    if (t.type === 'lparen') {
      consume();
      const val = parseExpression();
      const closing = peek();
      if (!closing || closing.type !== 'rparen') {
        throw new Error('Missing closing parenthesis');
      }
      consume();
      return val;
    }

    throw new Error(`Unexpected token: ${t.value || t.type}`);
  }

  const result = parseExpression();

  if (pos < tokens.length) {
    throw new Error(`Unexpected token after expression: ${tokens[pos].value || tokens[pos].type}`);
  }

  return result;
}

module.exports = { evaluateExpression, parseNumber };
