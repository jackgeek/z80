#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { assemble } = require('./z80asm/assembler');
const { generateTAP } = require('./z80asm/tap');

// --- Parse command-line arguments ---
const args = process.argv.slice(2);
let inputFile = null;
let outputFile = null;
let autorun = true;
let defaultOrg = 0x8000;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '-o' && i + 1 < args.length) {
    outputFile = args[++i];
  } else if (args[i] === '--no-autorun') {
    autorun = false;
  } else if (args[i] === '--org' && i + 1 < args.length) {
    const orgStr = args[++i];
    defaultOrg = orgStr.startsWith('0x') || orgStr.startsWith('0X')
      ? parseInt(orgStr, 16)
      : parseInt(orgStr, 10);
    if (isNaN(defaultOrg)) {
      console.error('Error: Invalid --org value:', orgStr);
      process.exit(1);
    }
  } else if (args[i].startsWith('-')) {
    console.error('Error: Unknown option:', args[i]);
    process.exit(1);
  } else {
    inputFile = args[i];
  }
}

if (!inputFile) {
  console.error('Usage: node tools/z80asm.js <input.asm> [-o output.tap] [--no-autorun] [--org 0x8000]');
  process.exit(1);
}

// --- Read input file ---
let source;
try {
  source = fs.readFileSync(inputFile, 'utf-8');
} catch (e) {
  console.error(`Error: Cannot read file: ${inputFile}`);
  console.error(e.message);
  process.exit(1);
}

// --- Assemble ---
const filename = path.basename(inputFile);
const result = assemble(source, { org: defaultOrg, filename });

if (result.errors.length > 0) {
  console.error(`Assembly failed with ${result.errors.length} error(s):\n`);
  for (const err of result.errors) {
    console.error(`  ${err}`);
  }
  process.exit(1);
}

// --- Generate TAP ---
if (!outputFile) {
  outputFile = inputFile.replace(/\.[^.]+$/, '.tap');
}

const programName = path.basename(inputFile, path.extname(inputFile)).slice(0, 10);
const tap = generateTAP(result.binary, result.loadAddress, programName, autorun);

try {
  fs.writeFileSync(outputFile, tap);
} catch (e) {
  console.error(`Error: Cannot write file: ${outputFile}`);
  console.error(e.message);
  process.exit(1);
}

const size = result.binary.length;
const addr = '0x' + result.loadAddress.toString(16).toUpperCase();
console.log(`Assembled ${size} bytes at ${addr} → ${outputFile}`);
