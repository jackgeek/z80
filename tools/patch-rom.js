#!/usr/bin/env node
/**
 * ROM Patcher - Applies patch definitions to a base ZX Spectrum ROM.
 *
 * Usage:
 *   node tools/patch-rom.js <patch-file> [--base src/48.rom] [--output src/custom.rom]
 *
 * A patch file is a Node module that exports:
 *   {
 *     name: string,           // Human-readable patch name
 *     description: string,    // What the patch does
 *     base: string,           // Optional: override base ROM path
 *     output: string,         // Optional: override output path
 *     patches: [
 *       {
 *         // Binary patch: overwrite bytes at a specific address
 *         address: 0x124A,
 *         bytes: [0xC3, 0x6E, 0x38]
 *       },
 *       {
 *         // Assembly patch: assemble source and write at .org address
 *         asm: `
 *           .org 0x386E
 *           LD HL, (0x5C53)
 *           ...
 *         `
 *       }
 *     ]
 *   }
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { assemble } = require('./z80asm');

function applyPatch(romBuffer, patchDef) {
  const rom = Buffer.from(romBuffer); // work on a copy
  const log = [];

  for (let i = 0; i < patchDef.patches.length; i++) {
    const p = patchDef.patches[i];

    if (p.bytes && p.address !== undefined) {
      // Binary patch
      const bytes = Array.isArray(p.bytes) ? p.bytes : [...p.bytes];
      log.push(`  Binary patch at 0x${p.address.toString(16).padStart(4, '0')}: ${bytes.length} bytes`);
      for (let j = 0; j < bytes.length; j++) {
        if (p.address + j >= rom.length) {
          throw new Error(`Patch ${i}: address 0x${(p.address + j).toString(16)} out of ROM range`);
        }
        rom[p.address + j] = bytes[j] & 0xFF;
      }
    } else if (p.asm) {
      // Assembly patch
      const result = assemble(p.asm);
      log.push(`  ASM patch at 0x${result.org.toString(16).padStart(4, '0')}: ${result.bytes.length} bytes`);
      if (Object.keys(result.labels).length > 0) {
        for (const [name, addr] of Object.entries(result.labels)) {
          log.push(`    ${name} = 0x${addr.toString(16).padStart(4, '0')}`);
        }
      }
      for (let j = 0; j < result.bytes.length; j++) {
        if (result.org + j >= rom.length) {
          throw new Error(`ASM patch: address 0x${(result.org + j).toString(16)} out of ROM range`);
        }
        rom[result.org + j] = result.bytes[j];
      }
    } else {
      throw new Error(`Patch ${i}: must have either { address, bytes } or { asm }`);
    }
  }

  return { rom, log };
}

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log('Usage: node tools/patch-rom.js <patch-file> [--base <rom>] [--output <rom>]');
    console.log('');
    console.log('Options:');
    console.log('  --base <path>     Base ROM file (default: src/48.rom)');
    console.log('  --output <path>   Output ROM file (default: from patch or src/custom.rom)');
    console.log('  --verify          Verify patch can be applied without writing');
    console.log('  --diff            Show hex diff of changed bytes');
    process.exit(0);
  }

  const projectRoot = path.resolve(__dirname, '..');
  let patchFile = null;
  let baseRom = path.join(projectRoot, 'src', '48.rom');
  let outputRom = null;
  let verify = false;
  let showDiff = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--base' && args[i + 1]) { baseRom = args[++i]; }
    else if (args[i] === '--output' && args[i + 1]) { outputRom = args[++i]; }
    else if (args[i] === '--verify') { verify = true; }
    else if (args[i] === '--diff') { showDiff = true; }
    else if (!patchFile) { patchFile = args[i]; }
  }

  if (!patchFile) {
    console.error('Error: no patch file specified');
    process.exit(1);
  }

  // Resolve patch file path
  const patchPath = path.resolve(patchFile);
  const patchDef = require(patchPath);

  // Override base/output from patch definition
  if (!outputRom) {
    outputRom = patchDef.output
      ? path.resolve(projectRoot, patchDef.output)
      : path.join(projectRoot, 'src', 'custom.rom');
  }
  if (patchDef.base) {
    baseRom = path.resolve(projectRoot, patchDef.base);
  }

  console.log(`Patch: ${patchDef.name}`);
  console.log(`  ${patchDef.description}`);
  console.log(`Base ROM: ${baseRom}`);
  console.log(`Output:   ${outputRom}`);
  console.log('');

  const romData = fs.readFileSync(baseRom);
  if (romData.length !== 16384) {
    console.error(`Error: ROM file is ${romData.length} bytes, expected 16384`);
    process.exit(1);
  }

  const { rom, log } = applyPatch(romData, patchDef);
  log.forEach(l => console.log(l));

  if (showDiff) {
    console.log('\nChanged bytes:');
    for (let i = 0; i < rom.length; i++) {
      if (rom[i] !== romData[i]) {
        console.log(`  0x${i.toString(16).padStart(4, '0')}: ${romData[i].toString(16).padStart(2, '0')} -> ${rom[i].toString(16).padStart(2, '0')}`);
      }
    }
  }

  if (verify) {
    console.log('\nVerification passed - no output written.');
  } else {
    fs.writeFileSync(outputRom, rom);
    console.log(`\nWrote ${rom.length} bytes to ${outputRom}`);
  }
}

module.exports = { applyPatch };

if (require.main === module) {
  main();
}
