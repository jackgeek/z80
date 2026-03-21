// File handling — drag-drop + hidden file input for tape/ROM/snapshot loading

import { loadROM } from '../emulator/wasm-loader.js';
import { loadTapeFile } from '../media/tape.js';
import { loadZ80 } from '../media/snapshot.js';
import { showStatus } from './status-bridge.js';

export function initFileHandler(): void {
  // Drag-drop on window
  window.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
  });

  window.addEventListener('drop', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer?.files[0];
    if (file) await handleFile(file);
  });

  // Hidden file input
  const fileInput = document.getElementById('file-input') as HTMLInputElement | null;
  if (fileInput) {
    fileInput.addEventListener('change', async () => {
      const file = fileInput.files?.[0];
      if (file) {
        await handleFile(file);
        fileInput.value = '';
      }
    });
  }
}

export function triggerFileInput(): void {
  const fileInput = document.getElementById('file-input') as HTMLInputElement | null;
  fileInput?.click();
}

async function handleFile(file: File): Promise<void> {
  const data = await file.arrayBuffer();
  const name = file.name.toLowerCase();

  if (name.endsWith('.rom') || name.endsWith('.bin') || data.byteLength === 16384) {
    loadROM(data, true);
  } else if (name.endsWith('.z80')) {
    loadZ80(data);
  } else if (name.endsWith('.tap') || name.endsWith('.tzx') || name.endsWith('.zip')) {
    await loadTapeFile(data, file.name);
  } else {
    showStatus('Unknown file type: ' + file.name);
  }
}
