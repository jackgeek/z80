import {
  setWasm, setMemory, setRunning, setRomLoaded, setPaused,
  setCachedRomData, getWasm, getMemory, getCachedRomData
} from './state.js';
import type { WasmExports } from './wasm-types.js';
import { initAudio } from '../audio/audio.js';

export async function initWasm(onStatus?: (msg: string) => void): Promise<void> {
  const status = onStatus ?? console.log;
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
    status('Loading ROM...');

    try {
      const romResp = await fetch('48.rom');
      if (romResp.ok) {
        const romBuf = await romResp.arrayBuffer();
        loadROM(romBuf, false, onStatus);
      } else {
        status('48.rom not found. Drop a ZX Spectrum 48K ROM file onto the page.');
      }
    } catch {
      status('Could not load 48.rom. Drop a ROM file onto the page.');
    }
  } catch (e) {
    status('Failed to load WASM: ' + (e as Error).message);
    console.error(e);
  }
}

export function loadROM(data: ArrayBuffer, fromUserGesture = true, onStatus?: (msg: string) => void): void {
  const status = onStatus ?? console.log;
  const wasm = getWasm();
  if (!wasm) return;
  if (fromUserGesture) initAudio();
  const bytes = new Uint8Array(data);
  if (bytes.length < 1024 || bytes.length > 16384) {
    status('Invalid ROM size. Expected 16384 bytes for ZX Spectrum 48K ROM.');
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
  status('ROM loaded. Running. Drag & drop a .tap file to load software.');
}

export function resetEmulator(onStatus?: (msg: string) => void): void {
  const status = onStatus ?? console.log;
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
  status('Reset. Running.');
}
