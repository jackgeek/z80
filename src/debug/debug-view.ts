// ============================================================
// MEMORY DEBUG VIEW — real-time 256×256 grayscale memory map
// ============================================================

import { MEM_BASE } from '../emulator/state.js';
import type { WasmExports } from '../emulator/wasm-types.js';

const DBG_MEM_SIZE = 65536;
const DBG_W = 256;
const DBG_H = 256;

let _dbgCanvas: HTMLCanvasElement | null = null;
let _dbgCtx: CanvasRenderingContext2D | null = null;
let _dbgImageData: ImageData | null = null;
let _dbgImgBuf: Uint8Array | null = null;
let _dbgMemView: Uint8Array | null = null;
let _dbgGfxReady = false;

// References from main.js
let _dbgMemory: WebAssembly.Memory | null = null;
let _dbgWasm: WasmExports | null = null;
let _dbgIsPaused: (() => boolean) | null = null;
let _dbgRenderFrame: (() => void) | null = null;
let _dbgInitialized = false;
let _dbgSelectedAddr = -1;

// DOM
let _dbgElAddr: HTMLElement;
let _dbgElValue: HTMLElement;
let _dbgElRegion: HTMLElement;
let _dbgElEdit: HTMLInputElement;

// ── Lazy graphics setup (deferred until canvas is visible) ──
function dbgEnsureGfx(): void {
  if (_dbgGfxReady) return;
  _dbgCtx = _dbgCanvas!.getContext('2d');
  _dbgImageData = _dbgCtx!.createImageData(DBG_W, DBG_H);
  _dbgImgBuf = new Uint8Array(_dbgImageData.data.buffer);
  _dbgGfxReady = true;
}

// ── Click-to-inspect ────────────────────────────────────────
function dbgOnCanvasClick(e: MouseEvent): void {
  if (!_dbgIsPaused || !_dbgIsPaused()) {
    _dbgElAddr.textContent = 'Pause to inspect';
    _dbgElValue.textContent = '';
    _dbgElRegion.textContent = '';
    _dbgElEdit.disabled = true;
    _dbgElEdit.value = '';
    return;
  }

  const rect = _dbgCanvas!.getBoundingClientRect();
  const x = Math.min(DBG_W - 1, Math.max(0, Math.floor((e.clientX - rect.left) * DBG_W / rect.width)));
  const y = Math.min(DBG_H - 1, Math.max(0, Math.floor((e.clientY - rect.top) * DBG_H / rect.height)));
  const addr = y * DBG_W + x;
  if (addr >= DBG_MEM_SIZE) return;

  const val = _dbgWasm!.readMem(addr);
  _dbgSelectedAddr = addr;

  _dbgElAddr.textContent = '$' + addr.toString(16).toUpperCase().padStart(4, '0');
  _dbgElValue.textContent = '$' + val.toString(16).toUpperCase().padStart(2, '0') + ' (' + val + ')';

  if (addr < 0x4000) {
    _dbgElRegion.textContent = 'ROM (read-only)';
    _dbgElEdit.disabled = true;
    _dbgElEdit.value = '';
  } else {
    _dbgElRegion.textContent = 'RAM';
    _dbgElEdit.disabled = false;
    _dbgElEdit.value = val.toString(16).toUpperCase().padStart(2, '0');
    _dbgElEdit.select();
  }
}

// ── Memory editing ──────────────────────────────────────────
function dbgOnEditKeydown(e: KeyboardEvent): void {
  if (e.key !== 'Enter') return;
  if (_dbgSelectedAddr < 0x4000 || _dbgSelectedAddr < 0) return;

  const newVal = parseInt(_dbgElEdit.value, 16);
  if (isNaN(newVal) || newVal < 0 || newVal > 255) return;

  _dbgWasm!.writeRAM(_dbgSelectedAddr, newVal);
  _dbgElValue.textContent = '$' + newVal.toString(16).toUpperCase().padStart(2, '0') + ' (' + newVal + ')';

  if (_dbgMemory) renderDebugView(_dbgMemory.buffer);
  if (_dbgSelectedAddr >= 0x4000 && _dbgSelectedAddr <= 0x5AFF && _dbgRenderFrame) {
    _dbgRenderFrame();
  }
}

// ── Initialisation ──────────────────────────────────────────
export interface DebugViewOpts {
  isPaused: () => boolean;
  renderFrame: () => void;
}

export function initDebugView(memory: WebAssembly.Memory, wasm: WasmExports, opts: DebugViewOpts): void {
  _dbgMemory = memory;
  _dbgWasm = wasm;
  _dbgIsPaused = opts.isPaused;
  _dbgRenderFrame = opts.renderFrame;

  _dbgCanvas = document.getElementById('debug-canvas') as HTMLCanvasElement;
  _dbgElAddr = document.getElementById('debug-addr')!;
  _dbgElValue = document.getElementById('debug-value')!;
  _dbgElRegion = document.getElementById('debug-region')!;
  _dbgElEdit = document.getElementById('debug-edit') as HTMLInputElement;

  // ── Zoom slider ──
  const zoomSlider = document.getElementById('debug-zoom') as HTMLInputElement;
  const zoomLabel = document.getElementById('debug-zoom-label')!;
  const inner = document.getElementById('debug-canvas-inner')!;
  const wrap = document.getElementById('debug-canvas-wrap')!;
  zoomSlider.addEventListener('input', () => {
    const z = parseInt(zoomSlider.value, 10);
    zoomLabel.textContent = z + '\u00d7';
    _dbgCanvas!.style.transform = 'scale(' + z + ')';
    inner.style.width = (DBG_W * z) + 'px';
    inner.style.height = (DBG_H * z) + 'px';
    wrap.classList.toggle('zoomed', z > 1);
  });

  // ── Click-to-inspect ──
  _dbgCanvas.addEventListener('click', dbgOnCanvasClick);
  _dbgElEdit.addEventListener('keydown', dbgOnEditKeydown);

  _dbgInitialized = true;
}

// ── Render ──────────────────────────────────────────────────
export function renderDebugView(memoryBuffer: ArrayBuffer): void {
  if (!_dbgInitialized) return;
  dbgEnsureGfx();

  if (!_dbgMemView || _dbgMemView.buffer !== memoryBuffer) {
    _dbgMemView = new Uint8Array(memoryBuffer, MEM_BASE, DBG_MEM_SIZE);
  }

  const src = _dbgMemView;
  const dst = _dbgImgBuf!;
  for (let i = 0; i < DBG_MEM_SIZE; i++) {
    const v = src[i];
    const o = i << 2;
    dst[o] = v;
    dst[o + 1] = v;
    dst[o + 2] = v;
    dst[o + 3] = 255;
  }
  _dbgCtx!.putImageData(_dbgImageData!, 0, 0);
}
