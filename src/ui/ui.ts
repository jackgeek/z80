import { getWasm, getMemory, isPaused, setPaused, setTurboMode, isDebugVisible, setDebugVisible, getCachedRomData } from '../emulator/state.js';
import { loadROM, resetEmulator } from '../emulator/wasm-loader.js';
import { resetFrameTime } from '../emulator/frame-loop.js';
import { initAudio } from '../audio/audio.js';
import { loadTapeFile } from '../media/tape.js';
import { saveZ80, loadZ80 } from '../media/snapshot.js';
import { renderDebugView } from '../debug/debug-view.js';

export function setStatus(msg: string): void {
  document.getElementById('status')!.textContent = msg;
}

export function initUI(): void {
  // ROM file input
  document.getElementById('rom-input')!.addEventListener('change', (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => loadROM(reader.result as ArrayBuffer);
    reader.readAsArrayBuffer(file);
  });

  // TAP/TZX/Z80 file input
  document.getElementById('tap-input')!.addEventListener('change', (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    if (file.name.toLowerCase().endsWith('.z80')) {
      reader.onload = () => loadZ80(reader.result as ArrayBuffer);
    } else {
      reader.onload = () => loadTapeFile(reader.result as ArrayBuffer, file.name);
    }
    reader.readAsArrayBuffer(file);
  });

  // Drag and drop
  const dropOverlay = document.getElementById('drop-overlay')!;
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

    const file = e.dataTransfer?.files[0];
    if (!file) return;

    const name = file.name.toLowerCase();
    const reader = new FileReader();

    if (name.endsWith('.rom') || name.endsWith('.bin')) {
      reader.onload = () => loadROM(reader.result as ArrayBuffer);
      reader.readAsArrayBuffer(file);
    } else if (name.endsWith('.z80')) {
      reader.onload = () => loadZ80(reader.result as ArrayBuffer);
      reader.readAsArrayBuffer(file);
    } else if (name.endsWith('.tap') || name.endsWith('.tzx') || name.endsWith('.zip')) {
      reader.onload = () => loadTapeFile(reader.result as ArrayBuffer, file.name);
      reader.readAsArrayBuffer(file);
    } else {
      reader.onload = () => {
        const data = new Uint8Array(reader.result as ArrayBuffer);
        if (data.length === 16384) {
          loadROM(reader.result as ArrayBuffer);
        } else {
          loadTapeFile(reader.result as ArrayBuffer, file.name);
        }
      };
      reader.readAsArrayBuffer(file);
    }
  });

  // Buttons
  document.getElementById('save-btn')!.addEventListener('click', () => saveZ80());

  document.getElementById('turbo-toggle')!.addEventListener('change', (e) => {
    setTurboMode((e.target as HTMLInputElement).checked);
    resetFrameTime();
    setStatus((e.target as HTMLInputElement).checked ? 'Max speed.' : 'Normal speed.');
  });

  document.getElementById('debug-toggle')!.addEventListener('change', (e) => {
    setDebugVisible((e.target as HTMLInputElement).checked);
    document.getElementById('debug-container')!.style.display = (e.target as HTMLInputElement).checked ? 'flex' : 'none';
    if ((e.target as HTMLInputElement).checked && getMemory()) {
      try { renderDebugView(getMemory()!.buffer); } catch { /* not ready */ }
    }
  });

  document.getElementById('reset-btn')!.addEventListener('click', () => resetEmulator());

  document.getElementById('pause-btn')!.addEventListener('click', () => {
    const newPaused = !isPaused();
    setPaused(newPaused);
    document.getElementById('pause-btn')!.textContent = newPaused ? 'Resume' : 'Pause';
    setStatus(newPaused ? 'Paused.' : 'Running.');
    if (newPaused && isDebugVisible() && getMemory()) {
      try { renderDebugView(getMemory()!.buffer); } catch { /* not ready */ }
    }
  });
}
