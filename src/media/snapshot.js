import { getWasm, getMemory, MEM_BASE, getCachedRomData, setRunning, setRomLoaded, setPaused, isRomLoaded } from '../emulator/state.js';

// ED ED RLE compression for .z80 format
export function compressZ80Page(data) {
  const out = [];
  let i = 0;
  while (i < data.length) {
    const b = data[i];
    let count = 1;
    while (i + count < data.length && data[i + count] === b && count < 255) {
      count++;
    }
    if (b === 0xED) {
      // ED bytes always use RLE to avoid confusion with the ED ED escape
      out.push(0xED, 0xED, count, 0xED);
    } else if (count >= 2) {
      out.push(0xED, 0xED, count, b);
    } else {
      out.push(b);
    }
    i += count;
  }
  return new Uint8Array(out);
}

// ED ED RLE decompression for .z80 format
export function decompressZ80(data, expectedLength) {
  const out = new Uint8Array(expectedLength);
  let inPos = 0, outPos = 0;
  while (inPos < data.length && outPos < expectedLength) {
    if (data[inPos] === 0xED && inPos + 1 < data.length && data[inPos + 1] === 0xED) {
      // ED ED count byte — RLE run
      const count = data[inPos + 2];
      const value = data[inPos + 3];
      for (let j = 0; j < count && outPos < expectedLength; j++) {
        out[outPos++] = value;
      }
      inPos += 4;
    } else {
      out[outPos++] = data[inPos++];
    }
  }
  return out;
}

// Save emulator state as .z80 v3 file
export function saveZ80() {
  const wasm = getWasm();
  const memory = getMemory();
  if (!wasm || !isRomLoaded()) return;

  // Read registers
  const a = wasm.getA();
  const f = wasm.getF();
  const bc = wasm.getBC2();
  const de = wasm.getDE2();
  const hl = wasm.getHL2();
  const pc = wasm.getPC();
  const sp = wasm.getSP();
  const ix = wasm.getIX();
  const iy = wasm.getIY();
  const i = wasm.getI();
  const r = wasm.getR();
  const im = wasm.getIM();
  const iff1 = wasm.getIFF1();
  const iff2 = wasm.getIFF2();
  const border = wasm.getBorderColor();
  const a2 = wasm.getA2();
  const f2 = wasm.getF2();
  const bc2 = wasm.getBC_prime();
  const de2 = wasm.getDE_prime();
  const hl2 = wasm.getHL_prime();

  // Build 30-byte main header
  const header = new Uint8Array(30);
  header[0] = a;
  header[1] = f;
  header[2] = bc & 0xFF; header[3] = bc >> 8;
  header[4] = hl & 0xFF; header[5] = hl >> 8;
  header[6] = 0; header[7] = 0; // PC=0 means v2/v3
  header[8] = sp & 0xFF; header[9] = sp >> 8;
  header[10] = i;
  header[11] = r & 0x7F;
  header[12] = ((r >> 7) & 1) | ((border & 7) << 1) | (1 << 5); // bit5=compressed
  header[13] = de & 0xFF; header[14] = de >> 8;
  header[15] = bc2 & 0xFF; header[16] = bc2 >> 8;
  header[17] = de2 & 0xFF; header[18] = de2 >> 8;
  header[19] = hl2 & 0xFF; header[20] = hl2 >> 8;
  header[21] = a2;
  header[22] = f2;
  header[23] = iy & 0xFF; header[24] = iy >> 8;
  header[25] = ix & 0xFF; header[26] = ix >> 8;
  header[27] = iff1 ? 1 : 0;
  header[28] = iff2 ? 1 : 0;
  header[29] = im & 3;

  // Build 56-byte extended header (v3: length=54)
  const extHeader = new Uint8Array(56);
  extHeader[0] = 54; extHeader[1] = 0; // extended header length = 54
  extHeader[2] = pc & 0xFF; extHeader[3] = pc >> 8; // actual PC
  extHeader[4] = 0; // hardware mode: 0 = 48K

  // Read 48 KB RAM directly from WASM linear memory
  const ram = new Uint8Array(memory.buffer, MEM_BASE + 0x4000, 0xC000);

  // Compress 3 pages (16 KB each)
  const pages = [
    { id: 8, data: ram.slice(0, 0x4000) },         // 0x4000-0x7FFF
    { id: 4, data: ram.slice(0x4000, 0x8000) },     // 0x8000-0xBFFF
    { id: 5, data: ram.slice(0x8000, 0xC000) },     // 0xC000-0xFFFF
  ];

  const pageBlocks = [];
  for (const page of pages) {
    const compressed = compressZ80Page(page.data);
    const block = new Uint8Array(3 + compressed.length);
    block[0] = compressed.length & 0xFF;
    block[1] = (compressed.length >> 8) & 0xFF;
    block[2] = page.id;
    block.set(compressed, 3);
    pageBlocks.push(block);
  }

  // Concatenate all parts
  const totalLen = 30 + 56 + pageBlocks.reduce((s, b) => s + b.length, 0);
  const file = new Uint8Array(totalLen);
  file.set(header, 0);
  file.set(extHeader, 30);
  let offset = 86;
  for (const block of pageBlocks) {
    file.set(block, offset);
    offset += block.length;
  }

  // Trigger download
  const blob = new Blob([file], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a_el = document.createElement('a');
  a_el.href = url;
  a_el.download = 'snapshot.z80';
  document.body.appendChild(a_el);
  a_el.click();
  document.body.removeChild(a_el);
  URL.revokeObjectURL(url);

  document.getElementById('status').textContent = 'Snapshot saved.';
}

// Load .z80 snapshot file (v1, v2, v3)
export function loadZ80(arrayBuffer) {
  const wasm = getWasm();
  const cachedRomData = getCachedRomData();
  if (!wasm || !cachedRomData) return;

  const data = new Uint8Array(arrayBuffer);
  if (data.length < 30) return;

  // Parse 30-byte main header
  const a = data[0];
  const f = data[1];
  const bc = data[2] | (data[3] << 8);
  const hl = data[4] | (data[5] << 8);
  const headerPC = data[6] | (data[7] << 8);
  const sp = data[8] | (data[9] << 8);
  const i_reg = data[10];
  const rLow = data[11];
  const flags = data[12];
  const rBit7 = (flags & 1) << 7;
  const r = (rLow & 0x7F) | rBit7;
  const border = (flags >> 1) & 7;
  const compressed = (flags >> 5) & 1;
  const de = data[13] | (data[14] << 8);
  const bc2 = data[15] | (data[16] << 8);
  const de2 = data[17] | (data[18] << 8);
  const hl2 = data[19] | (data[20] << 8);
  const a2 = data[21];
  const f2 = data[22];
  const iy = data[23] | (data[24] << 8);
  const ix = data[25] | (data[26] << 8);
  const iff1 = data[27];
  const iff2 = data[28];
  const im = data[29] & 3;

  let pc;
  let ram; // 48 KB Uint8Array for addresses 0x4000-0xFFFF

  if (headerPC !== 0) {
    // ── Version 1 ──
    pc = headerPC;
    const rawData = data.slice(30);
    if (compressed) {
      ram = decompressZ80(rawData, 49152);
    } else {
      ram = rawData.slice(0, 49152);
    }
  } else {
    // ── Version 2 or 3 ──
    const extLen = data[30] | (data[31] << 8);
    pc = data[32] | (data[33] << 8);
    // const hwMode = data[34]; // 0 = 48K

    const dataStart = 32 + extLen;
    ram = new Uint8Array(49152); // pre-fill with zeros

    // Read pages until end of file
    let pos = dataStart;
    while (pos + 3 <= data.length) {
      const pageLen = data[pos] | (data[pos + 1] << 8);
      const pageId = data[pos + 2];
      pos += 3;

      let pageData;
      if (pageLen === 0xFFFF) {
        // Uncompressed page
        pageData = data.slice(pos, pos + 16384);
        pos += 16384;
      } else {
        pageData = decompressZ80(data.slice(pos, pos + pageLen), 16384);
        pos += pageLen;
      }

      // Map page ID to RAM offset (relative to 0x4000)
      let ramOffset;
      if (pageId === 8) ramOffset = 0x0000;      // 0x4000-0x7FFF
      else if (pageId === 4) ramOffset = 0x4000;  // 0x8000-0xBFFF
      else if (pageId === 5) ramOffset = 0x8000;  // 0xC000-0xFFFF
      else continue; // Skip unknown pages

      ram.set(pageData.slice(0, 16384), ramOffset);
    }
  }

  // Restore machine state
  wasm.init();
  for (let j = 0; j < cachedRomData.length; j++) {
    wasm.setRomByte(j, cachedRomData[j]);
  }

  // Set registers
  wasm.setA_ext(a);
  wasm.setF_ext(f);
  wasm.setBC_ext(bc);
  wasm.setDE_ext(de);
  wasm.setHL_ext(hl);
  wasm.setPC_ext(pc);
  wasm.setSP_ext(sp);
  wasm.setIX_ext(ix);
  wasm.setIY_ext(iy);
  wasm.setI_ext(i_reg);
  wasm.setR_ext(r);
  wasm.setIM_ext(im);
  wasm.setIFF1_ext(iff1);
  wasm.setIFF2_ext(iff2);
  wasm.setA2_ext(a2);
  wasm.setF2_ext(f2);
  wasm.setBC_prime_ext(bc2);
  wasm.setDE_prime_ext(de2);
  wasm.setHL_prime_ext(hl2);
  wasm.setBorderColor_ext(border);

  // Write 48 KB RAM
  for (let addr = 0; addr < 49152; addr++) {
    wasm.writeRAM(0x4000 + addr, ram[addr]);
  }

  setRunning(true);
  setRomLoaded(true);
  setPaused(false);
  document.getElementById('pause-btn').textContent = 'Pause';
  document.getElementById('status').textContent = 'Snapshot loaded.';
}
