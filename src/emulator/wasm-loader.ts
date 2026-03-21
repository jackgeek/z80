import {
  setWasm, setMemory, setRunning, setRomLoaded, setPaused,
  setCachedRomData, getWasm, getMemory, getCachedRomData, getAnimFrameId,
  isDebugVisible
} from './state.js';
import type { WasmExports } from './wasm-types.js';
import { initAudio } from '../audio/audio.js';
import { renderFrame } from '../video/screen.js';
import { initDebugView, renderDebugView } from '../debug/debug-view.js';
import { startFrameLoop } from './frame-loop.js';

export async function initWasm(): Promise<void> {
  const memory = new WebAssembly.Memory({ initial: 256, maximum: 256 });
  setMemory(memory);

  try {
    const response = await fetch('spectrum.wasm');
    const wasmBytes = await response.arrayBuffer();
    const result = await WebAssembly.instantiate(wasmBytes, {
      env: {
        memory: memory,
        abort: (_msg: number, _file: number, line: number, col: number) => {
          console.error(`WASM abort at ${line}:${col}`);
        }
      }
    });
    const wasm = result.instance.exports as unknown as WasmExports;
    setWasm(wasm);
    wasm.init();
    document.getElementById('status')!.textContent = 'Loading ROM...';

    try {
      const romResp = await fetch('48.rom');
      if (romResp.ok) {
        const romBuf = await romResp.arrayBuffer();
        loadROM(romBuf, false);
      } else {
        document.getElementById('status')!.textContent = '48.rom not found. Drop a ZX Spectrum 48K ROM file onto the page.';
      }
    } catch {
      document.getElementById('status')!.textContent = 'Could not load 48.rom. Drop a ROM file onto the page.';
    }
  } catch (e) {
    document.getElementById('status')!.textContent = 'Failed to load WASM: ' + (e as Error).message;
    console.error(e);
  }
}

export function loadROM(data: ArrayBuffer, fromUserGesture = true): void {
  const wasm = getWasm();
  if (!wasm) return;
  if (fromUserGesture) initAudio();
  const bytes = new Uint8Array(data);
  if (bytes.length < 1024 || bytes.length > 16384) {
    document.getElementById('status')!.textContent = 'Invalid ROM size. Expected 16384 bytes for ZX Spectrum 48K ROM.';
    return;
  }
  wasm.init();
  for (let i = 0; i < bytes.length; i++) {
    wasm.setRomByte(i, bytes[i]);
  }
  setCachedRomData(bytes.slice());
  setRomLoaded(true);
  setRunning(true);
  setPaused(false);
  document.getElementById('status')!.textContent = 'ROM loaded. Running. Drag & drop a .tap file to load software.';
  if (!getAnimFrameId()) startFrameLoop();

  // Initialise debug memory view
  const memory = getMemory();
  if (memory) {
    try {
      initDebugView(memory, wasm, {
        isPaused: () => false, // will be updated by frame-loop
        renderFrame: renderFrame
      });
    } catch { /* debug-view not ready yet */ }
  }
}

export function resetEmulator(): void {
  const wasm = getWasm();
  const cachedRomData = getCachedRomData();
  if (!wasm || !cachedRomData) return;
  wasm.init();
  for (let i = 0; i < cachedRomData.length; i++) {
    wasm.setRomByte(i, cachedRomData[i]);
  }
  setRunning(true);
  setRomLoaded(true);
  setPaused(false);
  document.getElementById('pause-btn')!.textContent = 'Pause';
  document.getElementById('status')!.textContent = 'Reset. Running.';
}
