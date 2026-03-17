// ZX Spectrum 48K Emulator - JavaScript Frontend
// Handles WASM loading, keyboard, screen rendering, drag-and-drop

const SCREEN_WIDTH = 256;
const SCREEN_HEIGHT = 192;

let wasm = null;
let memory = null;
let running = false;
let paused = false;
let romLoaded = false;
let animFrameId = null;
let cachedRomData = null; // keep a copy for resets

// Audio
let audioCtx = null;
let audioScriptNode = null;
const AUDIO_SAMPLE_RATE = 44100;
const AUDIO_SAMPLES_PER_FRAME = 882; // 44100 / 50
let audioQueue = []; // ring buffer of frame audio data
let audioQueueReadPos = 0;

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

function initAudio() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)({
    sampleRate: AUDIO_SAMPLE_RATE
  });

  audioScriptNode = audioCtx.createScriptProcessor(2048, 0, 1);
  audioScriptNode.onaudioprocess = function(e) {
    const output = e.outputBuffer.getChannelData(0);
    const needed = output.length;

    for (let i = 0; i < needed; i++) {
      if (audioQueue.length > 0) {
        const raw = audioQueue.shift();
        // First-order high-pass filter: removes DC, keeps transitions
        hpfPrevOutput = HPF_ALPHA * (hpfPrevOutput + raw - hpfPrevInput);
        hpfPrevInput = raw;
        output[i] = hpfPrevOutput * 0.5;
      } else {
        // Fade filter state toward zero when no data
        hpfPrevOutput *= 0.99;
        output[i] = 0;
      }
    }
  };
  audioScriptNode.connect(audioCtx.destination);
}

function pushAudioFrame() {
  if (!audioCtx || !wasm) return;

  const audioBase = wasm.getAudioBaseAddr();
  const sampleCount = wasm.getAudioSampleCount();
  const samples = new Uint8Array(memory.buffer, audioBase, sampleCount);

  for (let i = 0; i < sampleCount; i++) {
    // Convert 0/1 to 0.0/1.0
    audioQueue.push(samples[i] ? 1.0 : 0.0);
  }

  // Prevent audio queue from growing too large (cap at ~4 frames worth)
  const maxQueue = AUDIO_SAMPLES_PER_FRAME * 4;
  if (audioQueue.length > maxQueue) {
    audioQueue.splice(0, audioQueue.length - maxQueue);
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
// TAP LOADING
// ============================================================
function loadTAP(data) {
  if (!wasm) return;
  initAudio();
  if (!romLoaded) {
    setStatus('Please load a ROM first!');
    return;
  }
  const bytes = new Uint8Array(data);
  for (let i = 0; i < bytes.length; i++) {
    wasm.loadTapData(i, bytes[i]);
  }
  wasm.setTapSize(bytes.length);
  setStatus('TAP loaded (' + bytes.length + ' bytes). Type LOAD "" and press Enter.');
}

// ============================================================
// SCREEN RENDERING
// ============================================================
const canvas = document.getElementById('screen');
const ctx = canvas.getContext('2d');
const imageData = ctx.createImageData(SCREEN_WIDTH, SCREEN_HEIGHT);

function renderFrame() {
  if (!wasm || !memory) return;

  const screenBase = wasm.getScreenBaseAddr();
  const memArray = new Uint8Array(memory.buffer);

  // Copy screen buffer to ImageData
  const pixels = imageData.data;
  const src = new Uint8Array(memory.buffer, screenBase, SCREEN_WIDTH * SCREEN_HEIGHT * 4);
  pixels.set(src);

  ctx.putImageData(imageData, 0, 0);

  // Update border colour on the flat-screen container
  const bColor = BORDER_COLORS[wasm.getBorderColor()];
  document.getElementById('screen-container').style.background = bColor;
}

// ============================================================
// MAIN LOOP (50 FPS for PAL)
// ============================================================
let lastFrameTime = 0;
const FRAME_INTERVAL = 1000 / 50; // 20ms per frame

function frameLoop(timestamp) {
  animFrameId = requestAnimationFrame(frameLoop);

  if (!running || paused || !romLoaded) return;

  const elapsed = timestamp - lastFrameTime;
  if (elapsed < FRAME_INTERVAL * 0.9) return; // throttle to ~50fps

  lastFrameTime = timestamp;

  try {
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
  reader.onload = () => loadTAP(reader.result);
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
  } else if (name.endsWith('.tap')) {
    reader.onload = () => loadTAP(reader.result);
    reader.readAsArrayBuffer(file);
  } else {
    // Try to auto-detect: if 16384 bytes, probably ROM, otherwise TAP
    reader.onload = () => {
      const data = new Uint8Array(reader.result);
      if (data.length === 16384) {
        loadROM(reader.result);
      } else {
        loadTAP(reader.result);
      }
    };
    reader.readAsArrayBuffer(file);
  }
});

// ============================================================
// BUTTONS
// ============================================================
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
// START
// ============================================================
initEmulator();
