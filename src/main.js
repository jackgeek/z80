// ZX Spectrum 48K Emulator - JavaScript Frontend
// Handles WASM loading, keyboard, screen rendering, drag-and-drop

const SCREEN_WIDTH = 256;
const SCREEN_HEIGHT = 192;

let wasm = null;
let memory = null;
let running = false;
let paused = false;
let turboMode = false;
let romLoaded = false;
let animFrameId = null;
let cachedRomData = null; // keep a copy for resets

// Audio
let audioCtx = null;
let audioWorkletNode = null; // AudioWorklet (preferred, off-main-thread)
let audioScriptNode = null;  // ScriptProcessorNode (fallback)
let useWorklet = false;
const AUDIO_SAMPLE_RATE = 44100;
const AUDIO_SAMPLES_PER_FRAME = 882; // 44100 / 50
// Ring buffer for ScriptProcessorNode fallback
const AUDIO_RING_SIZE = 8192;
const audioRing = new Float32Array(AUDIO_RING_SIZE);
let audioRingHead = 0;
let audioRingTail = 0;

// ============================================================
// KEYBOARD MAPPING
// ZX Spectrum keyboard matrix: 8 rows × 5 columns
// Each row is read via port 0xFE with row selected by high address byte
// ============================================================
// Row 0: Caps Shift, Z, X, C, V   (bits 0-4)
// Row 1: A, S, D, F, G
// Row 2: Q, W, E, R, T
// Row 3: 1, 2, 3, 4, 5
// Row 4: 0, 9, 8, 7, 6
// Row 5: P, O, I, U, Y
// Row 6: Enter, L, K, J, H
// Row 7: Space, Sym Shift, M, N, B

const KEY_MAP = {
  // Row 0 - Caps Shift, Z, X, C, V
  'ShiftLeft':   { row: 0, bit: 0x01 },
  'ShiftRight':  { row: 0, bit: 0x01 },
  'KeyZ':        { row: 0, bit: 0x02 },
  'KeyX':        { row: 0, bit: 0x04 },
  'KeyC':        { row: 0, bit: 0x08 },
  'KeyV':        { row: 0, bit: 0x10 },

  // Row 1 - A, S, D, F, G
  'KeyA':        { row: 1, bit: 0x01 },
  'KeyS':        { row: 1, bit: 0x02 },
  'KeyD':        { row: 1, bit: 0x04 },
  'KeyF':        { row: 1, bit: 0x08 },
  'KeyG':        { row: 1, bit: 0x10 },

  // Row 2 - Q, W, E, R, T
  'KeyQ':        { row: 2, bit: 0x01 },
  'KeyW':        { row: 2, bit: 0x02 },
  'KeyE':        { row: 2, bit: 0x04 },
  'KeyR':        { row: 2, bit: 0x08 },
  'KeyT':        { row: 2, bit: 0x10 },

  // Row 3 - 1, 2, 3, 4, 5
  'Digit1':      { row: 3, bit: 0x01 },
  'Digit2':      { row: 3, bit: 0x02 },
  'Digit3':      { row: 3, bit: 0x04 },
  'Digit4':      { row: 3, bit: 0x08 },
  'Digit5':      { row: 3, bit: 0x10 },

  // Row 4 - 0, 9, 8, 7, 6
  'Digit0':      { row: 4, bit: 0x01 },
  'Digit9':      { row: 4, bit: 0x02 },
  'Digit8':      { row: 4, bit: 0x04 },
  'Digit7':      { row: 4, bit: 0x08 },
  'Digit6':      { row: 4, bit: 0x10 },

  // Row 5 - P, O, I, U, Y
  'KeyP':        { row: 5, bit: 0x01 },
  'KeyO':        { row: 5, bit: 0x02 },
  'KeyI':        { row: 5, bit: 0x04 },
  'KeyU':        { row: 5, bit: 0x08 },
  'KeyY':        { row: 5, bit: 0x10 },

  // Row 6 - Enter, L, K, J, H
  'Enter':       { row: 6, bit: 0x01 },
  'KeyL':        { row: 6, bit: 0x02 },
  'KeyK':        { row: 6, bit: 0x04 },
  'KeyJ':        { row: 6, bit: 0x08 },
  'KeyH':        { row: 6, bit: 0x10 },

  // Row 7 - Space, Sym Shift, M, N, B
  'Space':       { row: 7, bit: 0x01 },
  'ControlLeft': { row: 7, bit: 0x02 },  // Ctrl = Symbol Shift
  'ControlRight':{ row: 7, bit: 0x02 },
  'KeyM':        { row: 7, bit: 0x04 },
  'KeyN':        { row: 7, bit: 0x08 },
  'KeyB':        { row: 7, bit: 0x10 },
};

// Backspace = Caps Shift + 0
// Arrow keys mapped via Caps Shift + 5/6/7/8
const COMPOUND_KEYS = {
  'Backspace':  [{ row: 0, bit: 0x01 }, { row: 4, bit: 0x01 }],  // CS + 0
  'ArrowLeft':  [{ row: 0, bit: 0x01 }, { row: 3, bit: 0x10 }],  // CS + 5
  'ArrowDown':  [{ row: 0, bit: 0x01 }, { row: 4, bit: 0x10 }],  // CS + 6
  'ArrowUp':    [{ row: 0, bit: 0x01 }, { row: 4, bit: 0x08 }],  // CS + 7
  'ArrowRight': [{ row: 0, bit: 0x01 }, { row: 4, bit: 0x04 }],  // CS + 8
};

// ============================================================
// BORDER COLORS
// ============================================================
const BORDER_COLORS = [
  '#000000', '#0000CD', '#CD0000', '#CD00CD',
  '#00CD00', '#00CDCD', '#CDCD00', '#CDCDCD'
];

// ============================================================
// INITIALIZATION
// ============================================================
async function initEmulator() {
  // Create shared memory (256 pages = 16MB)
  memory = new WebAssembly.Memory({ initial: 256, maximum: 256 });

  try {
    const response = await fetch('spectrum.wasm');
    const wasmBytes = await response.arrayBuffer();
    const result = await WebAssembly.instantiate(wasmBytes, {
      env: {
        memory: memory,
        abort: (msg, file, line, col) => {
          console.error(`WASM abort at ${line}:${col}`);
        }
      }
    });
    wasm = result.instance.exports;
    wasm.init();
    setStatus('Loading ROM...');

    // Auto-load 48.rom from same directory
    try {
      const romResp = await fetch('48.rom');
      if (romResp.ok) {
        const romBuf = await romResp.arrayBuffer();
        loadROM(romBuf, false);
      } else {
        setStatus('48.rom not found. Drop a ZX Spectrum 48K ROM file onto the page.');
      }
    } catch (e) {
      setStatus('Could not load 48.rom. Drop a ROM file onto the page.');
    }
  } catch (e) {
    setStatus('Failed to load WASM: ' + e.message);
    console.error(e);
  }
}

// ============================================================
// AUDIO
// ============================================================
// High-pass filter state to remove DC offset from 1-bit beeper
let hpfPrevInput = 0;
let hpfPrevOutput = 0;
const HPF_ALPHA = 0.995; // cutoff ~35Hz at 44100Hz

async function initAudio() {
  if (audioCtx) {
    // iOS suspends context when page loses focus — always try to resume
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return;
  }
  audioCtx = new (window.AudioContext || window.webkitAudioContext)({
    sampleRate: AUDIO_SAMPLE_RATE
  });

  // Try AudioWorklet first (runs on dedicated audio thread)
  if (audioCtx.audioWorklet) {
    try {
      await audioCtx.audioWorklet.addModule('audio-worklet.js');
      audioWorkletNode = new AudioWorkletNode(audioCtx, 'beeper-processor');
      audioWorkletNode.connect(audioCtx.destination);
      useWorklet = true;
    } catch (e) {
      console.warn('AudioWorklet failed, using ScriptProcessor fallback:', e);
    }
  }

  // Fallback to ScriptProcessorNode (runs on main thread)
  if (!useWorklet) {
    audioScriptNode = audioCtx.createScriptProcessor(2048, 0, 1);
    audioScriptNode.onaudioprocess = function(e) {
      const output = e.outputBuffer.getChannelData(0);
      const needed = output.length;

      for (let i = 0; i < needed; i++) {
        if (audioRingHead !== audioRingTail) {
          const raw = audioRing[audioRingTail];
          audioRingTail = (audioRingTail + 1) & (AUDIO_RING_SIZE - 1);
          hpfPrevOutput = HPF_ALPHA * (hpfPrevOutput + raw - hpfPrevInput);
          hpfPrevInput = raw;
          output[i] = hpfPrevOutput * 0.5;
        } else {
          hpfPrevOutput *= 0.99;
          output[i] = 0;
        }
      }
    };
    audioScriptNode.connect(audioCtx.destination);
  }

  // iOS requires an explicit resume after creation
  audioCtx.resume();
}

// Create or resume audio on any user interaction (required by mobile browsers).
// The ROM auto-loads without a gesture, so audioCtx may not exist yet.
['touchstart', 'touchend', 'mousedown', 'keydown'].forEach(evt => {
  document.addEventListener(evt, () => initAudio(), { passive: true });
});

let cachedAudioBase = 0;
const audioPostBuf = new Float32Array(AUDIO_SAMPLES_PER_FRAME);

function pushAudioFrame() {
  if (!audioCtx || !wasm) return;
  if (audioCtx.state !== 'running') return;

  if (!cachedAudioBase) cachedAudioBase = wasm.getAudioBaseAddr();
  const sampleCount = wasm.getAudioSampleCount();
  const samples = new Uint8Array(memory.buffer, cachedAudioBase, sampleCount);

  if (useWorklet) {
    // Post samples to AudioWorklet thread
    for (let i = 0; i < sampleCount; i++) {
      audioPostBuf[i] = samples[i] ? 1.0 : 0.0;
    }
    audioWorkletNode.port.postMessage(
      sampleCount === audioPostBuf.length
        ? audioPostBuf
        : audioPostBuf.subarray(0, sampleCount)
    );
  } else {
    // ScriptProcessorNode fallback — write to shared ring buffer
    let head = audioRingHead;
    let tail = audioRingTail;
    for (let i = 0; i < sampleCount; i++) {
      audioRing[head] = samples[i] ? 1.0 : 0.0;
      head = (head + 1) & (AUDIO_RING_SIZE - 1);
      if (head === tail) {
        tail = (tail + 1) & (AUDIO_RING_SIZE - 1);
      }
    }
    audioRingHead = head;
    audioRingTail = tail;
  }
}

// ============================================================
// ROM LOADING
// ============================================================
function loadROM(data, fromUserGesture = true) {
  if (!wasm) return;
  if (fromUserGesture) initAudio(); // only init audio on user gesture
  const bytes = new Uint8Array(data);
  if (bytes.length < 1024 || bytes.length > 16384) {
    setStatus('Invalid ROM size. Expected 16384 bytes for ZX Spectrum 48K ROM.');
    return;
  }
  wasm.init();
  for (let i = 0; i < bytes.length; i++) {
    wasm.setRomByte(i, bytes[i]);
  }
  cachedRomData = bytes.slice(); // cache for resets
  romLoaded = true;
  running = true;
  paused = false;
  setStatus('ROM loaded. Running. Drag & drop a .tap file to load software.');
  if (!animFrameId) requestAnimationFrame(frameLoop);
}

// ============================================================
// TZX → TAP CONVERTER
// Extracts data blocks from TZX and rebuilds a TAP-compatible buffer
// ============================================================
function tzxToTap(data) {
  const b = new Uint8Array(data);

  // Validate header: "ZXTape!" + 0x1A
  const sig = String.fromCharCode(b[0],b[1],b[2],b[3],b[4],b[5],b[6]);
  if (sig !== 'ZXTape!') throw new Error('Not a valid TZX file');

  const blocks = [];
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
// Converts TZX blocks into an array of pulse durations (T-states)
// for accurate tape signal emulation via port 0xFE bit 6.
// Also tracks which pulse index each data block ends at so the
// ROM trap can stay in sync with pulse playback.
// ============================================================
function tzxToPulses(data) {
  const b = new Uint8Array(data);
  const sig = String.fromCharCode(b[0],b[1],b[2],b[3],b[4],b[5],b[6]);
  if (sig !== 'ZXTape!') throw new Error('Not a valid TZX file');

  const pulses = [];
  // Pulse index where each data block's pulses END (for ROM trap sync)
  const dataBlockEndPulses = [];
  let pos = 10;

  // Helper: add pulses for each bit of a data byte (MSB first per spec)
  function addDataBits(byte, zeroPulse, onePulse, numBits) {
    for (let bit = 7; bit >= 8 - numBits; bit--) {
      const p = (byte >> bit) & 1 ? onePulse : zeroPulse;
      pulses.push(p);
      pulses.push(p);
    }
  }

  // Helper: add pulses for a complete data block (bytes)
  function addDataBlock(offset, length, zeroPulse, onePulse, usedBitsLastByte) {
    for (let i = 0; i < length - 1; i++) {
      addDataBits(b[offset + i], zeroPulse, onePulse, 8);
    }
    if (length > 0) {
      addDataBits(b[offset + length - 1], zeroPulse, onePulse, usedBitsLastByte);
    }
  }

  // Helper: add a LOW-level pause per TZX spec.
  // Spec: "At the end of a Pause block the current pulse level is low"
  // and "the first pulse will therefore not immediately produce an edge."
  // We ensure the level is LOW before the pause, and LOW after it.
  function addPause(ms) {
    if (ms <= 0) return;
    // Transition to LOW if currently HIGH (odd pulse count = HIGH)
    if (pulses.length & 1) {
      pulses.push(1); // 1 T-state transition HIGH→LOW
    }
    // LOW-level silence for the pause duration
    pulses.push(ms * 3500); // after this, level toggles to HIGH
    // Restore level to LOW (spec requires LOW after pause)
    pulses.push(1); // 1 T-state transition HIGH→LOW
  }

  while (pos < b.length) {
    const id = b[pos++];

    switch (id) {
      case 0x10: { // Standard speed data block
        const pause = b[pos] | (b[pos+1] << 8); pos += 2;
        const len = b[pos] | (b[pos+1] << 8); pos += 2;
        const flagByte = b[pos];
        // Pilot tone
        const pilotCount = flagByte < 0x80 ? 8063 : 3223;
        for (let i = 0; i < pilotCount; i++) pulses.push(2168);
        // Sync pulses
        pulses.push(667);
        pulses.push(735);
        // Data bits (standard timings: zero=855, one=1710)
        addDataBlock(pos, len, 855, 1710, 8);
        pos += len;
        // Track end position BEFORE pause so ROM trap sync preserves
        // the silence gap that custom loaders need to detect pilot onset
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

      case 0x14: { // Pure data block — generate pulses but don't track as ROM-loadable
        const zeroPulse = b[pos] | (b[pos+1] << 8); pos += 2;
        const onePulse = b[pos] | (b[pos+1] << 8); pos += 2;
        const usedBits = b[pos++] || 8;
        const pause = b[pos] | (b[pos+1] << 8); pos += 2;
        const dataLen = b[pos] | (b[pos+1] << 8) | (b[pos+2] << 16); pos += 3;
        addDataBlock(pos, dataLen, zeroPulse, onePulse, usedBits);
        pos += dataLen;
        // Don't push to dataBlockEndPulses — 0x14 blocks have no pilot/sync/flag
        // and are only loadable via pulse-level playback (custom loaders like Speedlock)
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
async function extractZip(data) {
  const b = new Uint8Array(data);
  const files = [];
  let pos = 0;

  while (pos < b.length - 4) {
    // Local file header signature: PK\x03\x04
    if (b[pos] !== 0x50 || b[pos+1] !== 0x4B || b[pos+2] !== 0x03 || b[pos+3] !== 0x04) break;

    const flags       = b[pos+6]  | (b[pos+7]  << 8);
    const compression = b[pos+8]  | (b[pos+9]  << 8);
    let compSize      = b[pos+18] | (b[pos+19] << 8) | (b[pos+20] << 16) | (b[pos+21] << 24);
    const nameLen     = b[pos+26] | (b[pos+27] << 8);
    const extraLen    = b[pos+28] | (b[pos+29] << 8);
    const name        = new TextDecoder().decode(b.slice(pos+30, pos+30+nameLen));

    const dataStart = pos + 30 + nameLen + extraLen;

    // If data descriptor flag is set and sizes are zero, scan for next PK header
    if ((flags & 0x08) && compSize === 0) {
      let scan = dataStart;
      while (scan < b.length - 4) {
        if (b[scan]===0x50&&b[scan+1]===0x4B&&(b[scan+2]===0x07||b[scan+2]===0x03)) break;
        scan++;
      }
      compSize = scan - dataStart;
    }

    const compressed = b.slice(dataStart, dataStart + compSize);
    let fileData;

    if (compression === 0) {
      fileData = compressed.buffer.slice(compressed.byteOffset, compressed.byteOffset + compressed.byteLength);
    } else if (compression === 8 && typeof DecompressionStream !== 'undefined') {
      const ds = new DecompressionStream('deflate-raw');
      const writer = ds.writable.getWriter();
      writer.write(compressed);
      writer.close();
      const chunks = [];
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

    // Skip optional data descriptor (PK\x07\x08)
    if (b[pos]===0x50&&b[pos+1]===0x4B&&b[pos+2]===0x07&&b[pos+3]===0x08) pos += 16;
  }

  return files;
}

// ============================================================
// TAPE LOADING (TAP / TZX / ZIP)
// ============================================================
// Write pulse stream to WASM memory and set up block boundaries
function loadPulseData(pulseResult) {
  const { pulses, dataBlockEndPulses } = pulseResult;
  // Write pulse durations directly to WASM memory (much faster than byte-by-byte)
  const pulseBase = wasm.getPulseBaseAddr();
  const dest = new Uint32Array(memory.buffer, pulseBase, pulses.length);
  for (let i = 0; i < pulses.length; i++) dest[i] = pulses[i];

  // Write block boundary pulse indices
  for (let i = 0; i < dataBlockEndPulses.length && i < 256; i++) {
    wasm.setBlockBound(i, dataBlockEndPulses[i]);
  }
  wasm.setBlockBoundsCount(Math.min(dataBlockEndPulses.length, 256));
  wasm.setPulseCount(pulses.length);
  console.log(`Pulse tape: ${pulses.length} pulses, ${dataBlockEndPulses.length} ROM-loadable blocks`);
}

async function loadTapeFile(data, filename) {
  if (!wasm) return;
  initAudio();
  if (!romLoaded) { setStatus('Please load a ROM first!'); return; }

  const name = (filename || '').toLowerCase();
  let tapData;
  let isTzx = false;
  let tzxSource = null; // raw TZX ArrayBuffer for pulse generation

  // Auto-detect format from file content when extension is missing/unknown
  const header = new Uint8Array(data, 0, Math.min(8, data.byteLength));
  const isZipContent = header[0]===0x50 && header[1]===0x4B && header[2]===0x03 && header[3]===0x04;
  const isTzxContent = String.fromCharCode(...header.slice(0, 7)) === 'ZXTape!';

  try {
    if (name.endsWith('.zip') || (!name.endsWith('.tap') && !name.endsWith('.tzx') && isZipContent)) {
      const files = await extractZip(data);
      const entry = files.find(f => f.name.endsWith('.tap') || f.name.endsWith('.tzx'));
      if (!entry) { setStatus('No .tap or .tzx file found inside ZIP.'); return; }
      isTzx = entry.name.endsWith('.tzx');
      if (isTzx) tzxSource = entry.data;
      tapData = isTzx ? tzxToTap(entry.data) : entry.data;
      setStatus(`Loaded ${entry.name} from ZIP.`);
    } else if (name.endsWith('.tzx') || isTzxContent) {
      isTzx = true;
      tzxSource = data;
      tapData = tzxToTap(data);
      setStatus('TZX loaded. Type LOAD "" and press Enter.');
    } else {
      tapData = data; // plain TAP
      setStatus('TAP loaded. Type LOAD "" and press Enter.');
    }
  } catch (e) {
    setStatus('Error loading tape: ' + e.message);
    console.error(e);
    return;
  }

  // Load TAP data for ROM trap (instant loading of standard blocks)
  const bytes = new Uint8Array(tapData);
  for (let i = 0; i < bytes.length; i++) wasm.loadTapData(i, bytes[i]);
  wasm.setTapSize(bytes.length);
  console.log(`TAP data: ${bytes.length} bytes`);

  // For TZX files, also generate pulse stream for custom loader support
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

// ============================================================
// SCREEN RENDERING (WebGL with Canvas 2D fallback)
// ============================================================
const canvas = document.getElementById('screen');
const screenContainer = document.getElementById('screen-container');
const SCREEN_BYTES = SCREEN_WIDTH * SCREEN_HEIGHT * 4;
let screenSrc = null;
let lastBorderColor = -1;
let useWebGL = false;
let gl = null;
let glTexture = null;

// Canvas 2D fallback state
let ctx2d = null;
let imageData = null;
let imgDest = null;

// Try WebGL first
gl = canvas.getContext('webgl', { antialias: false, depth: false, stencil: false, alpha: false });
if (gl) {
  useWebGL = true;

  // Fullscreen quad (two triangles)
  const verts = new Float32Array([-1,-1, 1,-1, -1,1, 1,1]);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);

  const vs = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(vs, `
    attribute vec2 p;
    varying vec2 uv;
    void main() {
      uv = vec2(p.x * 0.5 + 0.5, 0.5 - p.y * 0.5);
      gl_Position = vec4(p, 0.0, 1.0);
    }
  `);
  gl.compileShader(vs);

  const fs = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(fs, `
    precision mediump float;
    varying vec2 uv;
    uniform sampler2D tex;
    void main() { gl_FragColor = texture2D(tex, uv); }
  `);
  gl.compileShader(fs);

  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  gl.useProgram(prog);

  const pLoc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(pLoc);
  gl.vertexAttribPointer(pLoc, 2, gl.FLOAT, false, 0, 0);

  glTexture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, glTexture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  // Allocate texture storage once
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, SCREEN_WIDTH, SCREEN_HEIGHT, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

  gl.viewport(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
} else {
  // Canvas 2D fallback
  ctx2d = canvas.getContext('2d');
  imageData = ctx2d.createImageData(SCREEN_WIDTH, SCREEN_HEIGHT);
  imgDest = new Uint8Array(imageData.data.buffer);
}

function renderFrame() {
  if (!wasm || !memory) return;

  // Cache source view (WASM memory is fixed-size, buffer never detaches)
  if (!screenSrc) {
    screenSrc = new Uint8Array(memory.buffer, wasm.getScreenBaseAddr(), SCREEN_BYTES);
  }

  if (useWebGL) {
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, SCREEN_WIDTH, SCREEN_HEIGHT, gl.RGBA, gl.UNSIGNED_BYTE, screenSrc);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  } else {
    imgDest.set(screenSrc);
    ctx2d.putImageData(imageData, 0, 0);
  }

  // Only update border DOM style when colour actually changes
  const border = wasm.getBorderColor();
  if (border !== lastBorderColor) {
    lastBorderColor = border;
    screenContainer.style.background = BORDER_COLORS[border];
  }
}

// ============================================================
// MAIN LOOP (50 FPS for PAL)
// ============================================================
let lastFrameTime = 0;
const FRAME_INTERVAL = 1000 / 50; // 20ms per frame

function frameLoop(timestamp) {
  animFrameId = requestAnimationFrame(frameLoop);

  if (!running || paused || !romLoaded) return;

  if (turboMode) {
    // Max speed: run as many frames as possible per rAF tick, render only the last
    try {
      const TURBO_FRAMES = 50; // ~50 Z80 frames per rAF tick ≈ 50× speed
      for (let i = 0; i < TURBO_FRAMES; i++) wasm.frame();
      renderFrame();
    } catch (e) {
      console.error('Emulation error:', e);
      setStatus('Emulation error: ' + e.message);
      running = false;
    }
    lastFrameTime = timestamp;
    return;
  }

  const elapsed = timestamp - lastFrameTime;
  if (elapsed < FRAME_INTERVAL * 0.9) return; // throttle to ~50fps

  // Anchor to previous frame time to prevent drift (cap catch-up to 1 frame)
  lastFrameTime = elapsed > FRAME_INTERVAL * 2
    ? timestamp
    : lastFrameTime + FRAME_INTERVAL;

  try {
    // Turbo: run extra frames during pulse tape playback (skip render/audio)
    if (wasm.isTapePlaying()) {
      for (let i = 0; i < 19; i++) wasm.frame();
    }
    wasm.frame();
    renderFrame();
    pushAudioFrame();
  } catch (e) {
    console.error('Emulation error:', e);
    console.error('PC was:', wasm.getPC ? wasm.getPC().toString(16) : 'unknown');
    setStatus('Emulation error: ' + e.message);
    running = false;
  }
}

// ============================================================
// KEYBOARD INPUT
// ============================================================
document.addEventListener('keydown', (e) => {
  if (!wasm || !running) return;

  // Prevent default for emulated keys
  const code = e.code;
  if (KEY_MAP[code] || COMPOUND_KEYS[code]) {
    e.preventDefault();
  }

  if (COMPOUND_KEYS[code]) {
    for (const k of COMPOUND_KEYS[code]) {
      wasm.keyDown(k.row, k.bit);
    }
    return;
  }

  const mapping = KEY_MAP[code];
  if (mapping) {
    wasm.keyDown(mapping.row, mapping.bit);
  }
});

document.addEventListener('keyup', (e) => {
  if (!wasm || !running) return;

  const code = e.code;
  if (KEY_MAP[code] || COMPOUND_KEYS[code]) {
    e.preventDefault();
  }

  if (COMPOUND_KEYS[code]) {
    for (const k of COMPOUND_KEYS[code]) {
      wasm.keyUp(k.row, k.bit);
    }
    return;
  }

  const mapping = KEY_MAP[code];
  if (mapping) {
    wasm.keyUp(mapping.row, mapping.bit);
  }
});

// ============================================================
// FILE INPUT HANDLERS
// ============================================================
document.getElementById('rom-input').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => loadROM(reader.result);
  reader.readAsArrayBuffer(file);
});

document.getElementById('tap-input').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  if (file.name.toLowerCase().endsWith('.z80')) {
    reader.onload = () => loadZ80(reader.result);
  } else {
    reader.onload = () => loadTapeFile(reader.result, file.name);
  }
  reader.readAsArrayBuffer(file);
});

// ============================================================
// DRAG AND DROP
// ============================================================
const dropOverlay = document.getElementById('drop-overlay');
let dragCounter = 0;

document.addEventListener('dragenter', (e) => {
  e.preventDefault();
  dragCounter++;
  dropOverlay.classList.add('active');
});

document.addEventListener('dragleave', (e) => {
  e.preventDefault();
  dragCounter--;
  if (dragCounter === 0) dropOverlay.classList.remove('active');
});

document.addEventListener('dragover', (e) => {
  e.preventDefault();
});

document.addEventListener('drop', (e) => {
  e.preventDefault();
  dragCounter = 0;
  dropOverlay.classList.remove('active');

  const file = e.dataTransfer.files[0];
  if (!file) return;

  const name = file.name.toLowerCase();
  const reader = new FileReader();

  if (name.endsWith('.rom') || name.endsWith('.bin')) {
    reader.onload = () => loadROM(reader.result);
    reader.readAsArrayBuffer(file);
  } else if (name.endsWith('.z80')) {
    reader.onload = () => loadZ80(reader.result);
    reader.readAsArrayBuffer(file);
  } else if (name.endsWith('.tap') || name.endsWith('.tzx') || name.endsWith('.zip')) {
    reader.onload = () => loadTapeFile(reader.result, file.name);
    reader.readAsArrayBuffer(file);
  } else {
    // Auto-detect by size: 16384 = ROM, otherwise try as tape
    reader.onload = () => {
      const data = new Uint8Array(reader.result);
      if (data.length === 16384) {
        loadROM(reader.result);
      } else {
        loadTapeFile(reader.result, file.name);
      }
    };
    reader.readAsArrayBuffer(file);
  }
});

// ============================================================
// BUTTONS
// ============================================================
document.getElementById('save-btn').addEventListener('click', () => saveZ80());

document.getElementById('turbo-toggle').addEventListener('change', (e) => {
  turboMode = e.target.checked;
  lastFrameTime = 0; // reset throttle anchor when switching back to normal
  setStatus(turboMode ? 'Max speed.' : 'Normal speed.');
});

document.getElementById('reset-btn').addEventListener('click', () => {
  if (!wasm || !cachedRomData) return;
  wasm.init();
  for (let i = 0; i < cachedRomData.length; i++) {
    wasm.setRomByte(i, cachedRomData[i]);
  }
  running = true;
  romLoaded = true;
  paused = false;
  document.getElementById('pause-btn').textContent = 'Pause';
  setStatus('Reset. Running.');
});

document.getElementById('pause-btn').addEventListener('click', () => {
  paused = !paused;
  document.getElementById('pause-btn').textContent = paused ? 'Resume' : 'Pause';
  setStatus(paused ? 'Paused.' : 'Running.');
});

// ============================================================
// STATUS
// ============================================================
function setStatus(msg) {
  document.getElementById('status').textContent = msg;
}

// ============================================================
// .Z80 SNAPSHOT SAVE/RESTORE
// ============================================================

// ED ED RLE compression for .z80 format (per-page)
function compressZ80Page(data) {
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
function decompressZ80(data, expectedLength) {
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
function saveZ80() {
  if (!wasm || !romLoaded) return;

  const MEM_BASE = 0x100000;

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

  setStatus('Snapshot saved.');
}

// Load .z80 snapshot file (v1, v2, v3)
function loadZ80(arrayBuffer) {
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

  running = true;
  romLoaded = true;
  paused = false;
  document.getElementById('pause-btn').textContent = 'Pause';
  setStatus('Snapshot loaded.');
}

// ============================================================
// START
// ============================================================
initEmulator();
