"use strict";

/**
 * Parse a single Z80 assembly source line into a structured object.
 *
 * @param {string} line          - Raw source line
 * @param {number} lineNumber    - 1-based line number
 * @param {string} currentScope  - Last non-local label seen (for resolving local labels)
 * @returns {{ label: string|null, mnemonic: string|null, operands: string[], raw: string, lineNumber: number, isLocalLabel: boolean }}
 */
function parseLine(line, lineNumber, currentScope) {
  const result = {
    label: null,
    mnemonic: null,
    operands: [],
    raw: line,
    lineNumber: lineNumber,
    isLocalLabel: false,
  };

  // Strip comment (but not inside string literals)
  const stripped = stripComment(line);

  // Trim and bail on blank / comment-only lines
  let work = stripped.trim();
  if (work === "") return result;

  // --- Try to match EQU pattern first: name EQU value (no colon required) ---
  const equMatch = work.match(
    /^([a-zA-Z_.][a-zA-Z0-9_]*)\s+(?:EQU|equ|Equ)\s+(.*)/
  );
  if (equMatch) {
    const rawLabel = equMatch[1];
    const isLocal = rawLabel.startsWith(".");
    const resolvedLabel = isLocal && currentScope
      ? currentScope + rawLabel
      : rawLabel;

    result.label = resolvedLabel;
    result.isLocalLabel = isLocal;
    result.mnemonic = "EQU";
    result.operands = splitOperands(equMatch[2]);
    return result;
  }

  // --- Label detection ---
  const labelMatch = work.match(/^([a-zA-Z_.][a-zA-Z0-9_]*)\s*:/);
  if (labelMatch) {
    const rawLabel = labelMatch[0]; // includes the colon
    const labelName = labelMatch[1];
    const isLocal = labelName.startsWith(".");
    const resolvedLabel = isLocal && currentScope
      ? currentScope + labelName
      : labelName;

    result.label = resolvedLabel;
    result.isLocalLabel = isLocal;

    // Remove the label (and colon) from the working string
    work = work.slice(rawLabel.length).trim();
    if (work === "") return result;
  }

  // --- Mnemonic ---
  // The first whitespace-delimited token is the mnemonic
  const mnemonicMatch = work.match(/^(\S+)\s*(.*)/);
  if (mnemonicMatch) {
    result.mnemonic = mnemonicMatch[1].toUpperCase();
    const rest = mnemonicMatch[2].trim();
    if (rest !== "") {
      result.operands = splitOperands(rest);
    }
  }

  return result;
}

/**
 * Strip a comment (starting with ;) from a line, but not inside string literals.
 */
function stripComment(line) {
  let inSingle = false;
  let inDouble = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (ch === '"' && !inSingle) {
      inDouble = !inDouble;
    } else if (ch === "'" && !inDouble) {
      inSingle = !inSingle;
    } else if (ch === ";" && !inSingle && !inDouble) {
      return line.slice(0, i);
    }
  }

  return line;
}

/**
 * Split operand string by commas, but not inside parentheses or string literals.
 * Trims each operand.
 */
function splitOperands(str) {
  const operands = [];
  let current = "";
  let parenDepth = 0;
  let inDouble = false;
  let inSingle = false;

  for (let i = 0; i < str.length; i++) {
    const ch = str[i];

    if (ch === '"' && !inSingle) {
      inDouble = !inDouble;
      current += ch;
    } else if (ch === "'" && !inDouble) {
      inSingle = !inSingle;
      current += ch;
    } else if (ch === "(" && !inDouble && !inSingle) {
      parenDepth++;
      current += ch;
    } else if (ch === ")" && !inDouble && !inSingle) {
      parenDepth--;
      current += ch;
    } else if (ch === "," && parenDepth === 0 && !inDouble && !inSingle) {
      operands.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }

  const last = current.trim();
  if (last !== "") {
    operands.push(last);
  }

  return operands;
}

module.exports = { parseLine };
