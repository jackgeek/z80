// ============================================================
// TAP / TZX / ZIP tape handling
// ============================================================
import { getWasm, getMemory, isRomLoaded } from '../emulator/state.js';
import { initAudio } from '../audio/audio.js';
import { showStatus } from '../ui/status-bridge.js';

// ============================================================
// TZX → TAP CONVERTER
// Extracts standard data blocks from TZX and wraps them as TAP.
// ============================================================
export function tzxToTap(data: ArrayBuffer): ArrayBuffer {
  const b = new Uint8Array(data);

  // Validate header: "ZXTape!" + 0x1A
  const sig = String.fromCharCode(b[0],b[1],b[2],b[3],b[4],b[5],b[6]);
  if (sig !== 'ZXTape!') throw new Error('Not a valid TZX file');

  const blocks: Uint8Array[] = [];
  let pos = 10; // skip 10-byte TZX header

  while (pos < b.length) {
    const id = b[pos++];

    switch (id) {
      case 0x10: { // Standard speed data block
        pos += 2; // pause duration
        const len = b[pos] | (b[pos+1] << 8); pos += 2;
        blocks.push(b.slice(pos, pos + len)); pos += len;
        break;
      }
      case 0x11: { // Turbo speed data block
        pos += 15; // pilot/sync/bit timings + pause (15 bytes)
        const len = b[pos] | (b[pos+1] << 8) | (b[pos+2] << 16); pos += 3;
        blocks.push(b.slice(pos, pos + len)); pos += len;
        break;
      }
      case 0x14: { // Pure data block — skip for TAP (no pilot/sync/flag; custom loaders only)
        pos += 7; // zero/one bit timings + used bits + pause
        const len = b[pos] | (b[pos+1] << 8) | (b[pos+2] << 16); pos += 3;
        pos += len;
        break;
      }
      case 0x12: pos += 4;  break; // Pure tone
      case 0x13: pos += b[pos] * 2 + 1; break; // Pulse sequence
      case 0x15: { // Direct recording
        pos += 5;
        const len = b[pos] | (b[pos+1] << 8) | (b[pos+2] << 16); pos += 3 + len;
        break;
      }
      case 0x18: case 0x19: { // CSW / Generalized data
        const len = b[pos]|(b[pos+1]<<8)|(b[pos+2]<<16)|(b[pos+3]<<24); pos += 4 + len;
        break;
      }
      case 0x20: pos += 2; break; // Pause
      case 0x21: pos += b[pos] + 1; break; // Group start
      case 0x22: break; // Group end
      case 0x23: pos += 2; break; // Jump to block
      case 0x24: pos += 2; break; // Loop start
      case 0x25: break; // Loop end
      case 0x26: pos += (b[pos]|(b[pos+1]<<8)) * 2 + 2; break; // Call sequence
      case 0x27: break; // Return from sequence
      case 0x28: { const len = b[pos]|(b[pos+1]<<8); pos += 2 + len; break; } // Select block
      case 0x2A: pos += 4; break; // Stop tape if 48K
      case 0x2B: { const len = b[pos]|(b[pos+1]<<8)|(b[pos+2]<<16)|(b[pos+3]<<24); pos += 4 + len; break; } // Set signal level
      case 0x30: pos += b[pos] + 1; break; // Text description
      case 0x31: pos += b[pos+1] + 2; break; // Message block
      case 0x32: { const len = b[pos]|(b[pos+1]<<8); pos += 2 + len; break; } // Archive info
      case 0x33: pos += b[pos] * 3 + 1; break; // Hardware type
      case 0x35: { const len = b[pos+10]|(b[pos+11]<<8)|(b[pos+12]<<16)|(b[pos+13]<<24); pos += 14 + len; break; } // Custom info
      case 0x4B: { const len = b[pos]|(b[pos+1]<<8)|(b[pos+2]<<16)|(b[pos+3]<<24); pos += 4 + len; break; } // Kansas City
      case 0x5A: pos += 9; break; // Glue block
      default:
        console.warn('Unknown TZX block 0x' + id.toString(16) + ' at pos ' + pos + ', stopping parse');
        pos = b.length; // can't safely skip unknown blocks
    }
  }

  // Build TAP buffer: each block prefixed with 2-byte length
  let total = 0;
  for (const blk of blocks) total += 2 + blk.length;
  const tap = new Uint8Array(total);
  let off = 0;
  for (const blk of blocks) {
    tap[off++] = blk.length & 0xFF;
    tap[off++] = (blk.length >> 8) & 0xFF;
    tap.set(blk, off); off += blk.length;
  }
  return tap.buffer;
}

// ============================================================
// TZX → PULSE STREAM CONVERTER
// ============================================================
export interface PulseResult {
  pulses: number[];
  dataBlockEndPulses: number[];
}

export function tzxToPulses(data: ArrayBuffer): PulseResult {
  const b = new Uint8Array(data);
  const sig = String.fromCharCode(b[0],b[1],b[2],b[3],b[4],b[5],b[6]);
  if (sig !== 'ZXTape!') throw new Error('Not a valid TZX file');

  const pulses: number[] = [];
  const dataBlockEndPulses: number[] = [];
  let pos = 10;

  function addDataBits(byte: number, zeroPulse: number, onePulse: number, numBits: number): void {
    for (let bit = 7; bit >= 8 - numBits; bit--) {
      const p = (byte >> bit) & 1 ? onePulse : zeroPulse;
      pulses.push(p);
      pulses.push(p);
    }
  }

  function addDataBlock(offset: number, length: number, zeroPulse: number, onePulse: number, usedBitsLastByte: number): void {
    for (let i = 0; i < length - 1; i++) {
      addDataBits(b[offset + i], zeroPulse, onePulse, 8);
    }
    if (length > 0) {
      addDataBits(b[offset + length - 1], zeroPulse, onePulse, usedBitsLastByte);
    }
  }

  function addPause(ms: number): void {
    if (ms <= 0) return;
    if (pulses.length & 1) {
      pulses.push(1);
    }
    pulses.push(ms * 3500);
    pulses.push(1);
  }

  while (pos < b.length) {
    const id = b[pos++];

    switch (id) {
      case 0x10: { // Standard speed data block
        const pause = b[pos] | (b[pos+1] << 8); pos += 2;
        const len = b[pos] | (b[pos+1] << 8); pos += 2;
        const flagByte = b[pos];
        const pilotCount = flagByte < 0x80 ? 8063 : 3223;
        for (let i = 0; i < pilotCount; i++) pulses.push(2168);
        pulses.push(667);
        pulses.push(735);
        addDataBlock(pos, len, 855, 1710, 8);
        pos += len;
        dataBlockEndPulses.push(pulses.length);
        addPause(pause);
        break;
      }

      case 0x11: { // Turbo speed data block
        const pilotPulse = b[pos] | (b[pos+1] << 8); pos += 2;
        const sync1 = b[pos] | (b[pos+1] << 8); pos += 2;
        const sync2 = b[pos] | (b[pos+1] << 8); pos += 2;
        const zeroPulse = b[pos] | (b[pos+1] << 8); pos += 2;
        const onePulse = b[pos] | (b[pos+1] << 8); pos += 2;
        const pilotLen = b[pos] | (b[pos+1] << 8); pos += 2;
        const usedBits = b[pos++] || 8;
        const pause = b[pos] | (b[pos+1] << 8); pos += 2;
        const dataLen = b[pos] | (b[pos+1] << 8) | (b[pos+2] << 16); pos += 3;
        for (let i = 0; i < pilotLen; i++) pulses.push(pilotPulse);
        pulses.push(sync1);
        pulses.push(sync2);
        addDataBlock(pos, dataLen, zeroPulse, onePulse, usedBits);
        pos += dataLen;
        dataBlockEndPulses.push(pulses.length);
        addPause(pause);
        break;
      }

      case 0x12: { // Pure tone
        const pulseLen = b[pos] | (b[pos+1] << 8); pos += 2;
        const count = b[pos] | (b[pos+1] << 8); pos += 2;
        for (let i = 0; i < count; i++) pulses.push(pulseLen);
        break;
      }

      case 0x13: { // Pulse sequence
        const n = b[pos++];
        for (let i = 0; i < n; i++) {
          pulses.push(b[pos] | (b[pos+1] << 8));
          pos += 2;
        }
        break;
      }

      case 0x14: { // Pure data block
        const zeroPulse = b[pos] | (b[pos+1] << 8); pos += 2;
        const onePulse = b[pos] | (b[pos+1] << 8); pos += 2;
        const usedBits = b[pos++] || 8;
        const pause = b[pos] | (b[pos+1] << 8); pos += 2;
        const dataLen = b[pos] | (b[pos+1] << 8) | (b[pos+2] << 16); pos += 3;
        addDataBlock(pos, dataLen, zeroPulse, onePulse, usedBits);
        pos += dataLen;
        addPause(pause);
        break;
      }

      case 0x15: { // Direct recording
        const tstPerSample = b[pos] | (b[pos+1] << 8); pos += 2;
        const pause = b[pos] | (b[pos+1] << 8); pos += 2;
        const usedBits = b[pos++] || 8;
        const dataLen = b[pos] | (b[pos+1] << 8) | (b[pos+2] << 16); pos += 3;
        let lastLevel = 0, currentPulse = 0;
        for (let i = 0; i < dataLen; i++) {
          const byte = b[pos + i];
          const bits = (i === dataLen - 1) ? usedBits : 8;
          for (let bit = 7; bit >= 8 - bits; bit--) {
            const level = (byte >> bit) & 1;
            if (level !== lastLevel) {
              if (currentPulse > 0) pulses.push(currentPulse);
              currentPulse = tstPerSample;
              lastLevel = level;
            } else {
              currentPulse += tstPerSample;
            }
          }
        }
        if (currentPulse > 0) pulses.push(currentPulse);
        pos += dataLen;
        addPause(pause);
        break;
      }

      // Metadata / control blocks — skip (no pulses)
      case 0x18: case 0x19: {
        const len = b[pos]|(b[pos+1]<<8)|(b[pos+2]<<16)|(b[pos+3]<<24); pos += 4 + len;
        break;
      }
      case 0x20: { // Pause / stop
        const pause = b[pos] | (b[pos+1] << 8); pos += 2;
        addPause(pause);
        break;
      }
      case 0x21: pos += b[pos] + 1; break;
      case 0x22: break;
      case 0x23: pos += 2; break;
      case 0x24: pos += 2; break;
      case 0x25: break;
      case 0x26: pos += (b[pos]|(b[pos+1]<<8)) * 2 + 2; break;
      case 0x27: break;
      case 0x28: { const len = b[pos]|(b[pos+1]<<8); pos += 2 + len; break; }
      case 0x2A: pos += 4; break;
      case 0x2B: { const len = b[pos]|(b[pos+1]<<8)|(b[pos+2]<<16)|(b[pos+3]<<24); pos += 4 + len; break; }
      case 0x30: pos += b[pos] + 1; break;
      case 0x31: pos += b[pos+1] + 2; break;
      case 0x32: { const len = b[pos]|(b[pos+1]<<8); pos += 2 + len; break; }
      case 0x33: pos += b[pos] * 3 + 1; break;
      case 0x35: { const len = b[pos+10]|(b[pos+11]<<8)|(b[pos+12]<<16)|(b[pos+13]<<24); pos += 14 + len; break; }
      case 0x4B: { const len = b[pos]|(b[pos+1]<<8)|(b[pos+2]<<16)|(b[pos+3]<<24); pos += 4 + len; break; }
      case 0x5A: pos += 9; break;
      default:
        console.warn('TZX pulses: unknown block 0x' + id.toString(16) + ', stopping');
        pos = b.length;
    }
  }

  return { pulses, dataBlockEndPulses };
}

// ============================================================
// ZIP EXTRACTOR  (store + deflate-raw via DecompressionStream)
// ============================================================
interface ZipEntry {
  name: string;
  data: ArrayBuffer;
}

export async function extractZip(data: ArrayBuffer): Promise<ZipEntry[]> {
  const b = new Uint8Array(data);
  const files: ZipEntry[] = [];
  let pos = 0;

  while (pos < b.length - 4) {
    if (b[pos] !== 0x50 || b[pos+1] !== 0x4B || b[pos+2] !== 0x03 || b[pos+3] !== 0x04) break;

    const flags       = b[pos+6]  | (b[pos+7]  << 8);
    const compression = b[pos+8]  | (b[pos+9]  << 8);
    let compSize      = b[pos+18] | (b[pos+19] << 8) | (b[pos+20] << 16) | (b[pos+21] << 24);
    const nameLen     = b[pos+26] | (b[pos+27] << 8);
    const extraLen    = b[pos+28] | (b[pos+29] << 8);
    const name        = new TextDecoder().decode(b.slice(pos+30, pos+30+nameLen));

    const dataStart = pos + 30 + nameLen + extraLen;

    if ((flags & 0x08) && compSize === 0) {
      let scan = dataStart;
      while (scan < b.length - 4) {
        if (b[scan]===0x50&&b[scan+1]===0x4B&&(b[scan+2]===0x07||b[scan+2]===0x03)) break;
        scan++;
      }
      compSize = scan - dataStart;
    }

    const compressed = b.slice(dataStart, dataStart + compSize);
    let fileData: ArrayBuffer;

    if (compression === 0) {
      fileData = compressed.buffer.slice(compressed.byteOffset, compressed.byteOffset + compressed.byteLength);
    } else if (compression === 8 && typeof DecompressionStream !== 'undefined') {
      const ds = new DecompressionStream('deflate-raw');
      const writer = ds.writable.getWriter();
      writer.write(compressed);
      writer.close();
      const chunks: Uint8Array[] = [];
      const reader = ds.readable.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
      const total = chunks.reduce((s, c) => s + c.length, 0);
      const out = new Uint8Array(total);
      let off = 0;
      for (const c of chunks) { out.set(c, off); off += c.length; }
      fileData = out.buffer;
    } else {
      console.warn('Unsupported ZIP compression method:', compression, 'for', name);
      pos = dataStart + compSize;
      continue;
    }

    files.push({ name: name.toLowerCase(), data: fileData });
    pos = dataStart + compSize;

    if (b[pos]===0x50&&b[pos+1]===0x4B&&b[pos+2]===0x07&&b[pos+3]===0x08) pos += 16;
  }

  return files;
}

// ============================================================
// TAPE LOADING (TAP / TZX / ZIP)
// ============================================================

export function loadPulseData(pulseResult: PulseResult): void {
  const wasm = getWasm()!;
  const memory = getMemory()!;
  const { pulses, dataBlockEndPulses } = pulseResult;
  const pulseBase = wasm.getPulseBaseAddr();
  const dest = new Uint32Array(memory.buffer, pulseBase, pulses.length);
  for (let i = 0; i < pulses.length; i++) dest[i] = pulses[i];

  for (let i = 0; i < dataBlockEndPulses.length && i < 256; i++) {
    wasm.setBlockBound(i, dataBlockEndPulses[i]);
  }
  wasm.setBlockBoundsCount(Math.min(dataBlockEndPulses.length, 256));
  wasm.setPulseCount(pulses.length);
  console.log(`Pulse tape: ${pulses.length} pulses, ${dataBlockEndPulses.length} ROM-loadable blocks`);
}

export async function loadTapeFile(data: ArrayBuffer, filename: string): Promise<void> {
  const wasm = getWasm();
  if (!wasm) return;
  initAudio();
  if (!isRomLoaded()) {
    showStatus('Please load a ROM first!');
    return;
  }

  const name = (filename || '').toLowerCase();
  let tapData: ArrayBuffer;
  let isTzx = false;
  let tzxSource: ArrayBuffer | null = null;

  const header = new Uint8Array(data, 0, Math.min(8, data.byteLength));
  const isZipContent = header[0]===0x50 && header[1]===0x4B && header[2]===0x03 && header[3]===0x04;
  const isTzxContent = String.fromCharCode(...Array.from(header.slice(0, 7))) === 'ZXTape!';

  try {
    if (name.endsWith('.zip') || (!name.endsWith('.tap') && !name.endsWith('.tzx') && isZipContent)) {
      const files = await extractZip(data);
      const tapeFiles = files.filter(f => f.name.endsWith('.tap') || f.name.endsWith('.tzx'));
      let entry: { name: string; data: ArrayBuffer } | undefined;
      if (tapeFiles.length === 0) {
        showStatus('No .tap or .tzx file found inside ZIP.');
        return;
      } else if (tapeFiles.length === 1) {
        entry = tapeFiles[0];
      } else {
        const tzxFiles = tapeFiles.filter(f => f.name.endsWith('.tzx'));
        const tapFiles = tapeFiles.filter(f => f.name.endsWith('.tap'));
        if (tzxFiles.length === 1 && tapFiles.length === 1) {
          entry = tzxFiles[0];
        } else {
          showStatus('ZIP contains multiple tape files; include one TAP, one TZX, or a matching TAP+TZX pair.');
          return;
        }
      }
      isTzx = entry.name.endsWith('.tzx');
      if (isTzx) tzxSource = entry.data;
      tapData = isTzx ? tzxToTap(entry.data) : entry.data;
      showStatus(`Loaded ${entry.name} from ZIP.`);
    } else if (name.endsWith('.tzx') || isTzxContent) {
      isTzx = true;
      tzxSource = data;
      tapData = tzxToTap(data);
      showStatus('TZX loaded. Type LOAD "" and press Enter.');
    } else {
      tapData = data; // plain TAP
      showStatus('TAP loaded. Type LOAD "" and press Enter.');
    }
  } catch (e) {
    showStatus('Error loading tape: ' + (e as Error).message);
    console.error(e);
    return;
  }

  const bytes = new Uint8Array(tapData);
  for (let i = 0; i < bytes.length; i++) wasm.loadTapData(i, bytes[i]);
  wasm.setTapSize(bytes.length);
  console.log(`TAP data: ${bytes.length} bytes`);

  if (isTzx && tzxSource) {
    try {
      const pulseResult = tzxToPulses(tzxSource);
      loadPulseData(pulseResult);
      console.log(`TZX: ${pulseResult.dataBlockEndPulses.length} ROM blocks, pulse stream ready for custom loaders`);
    } catch (e) {
      console.warn('Pulse generation failed, ROM trap only:', e);
    }
  }
}
