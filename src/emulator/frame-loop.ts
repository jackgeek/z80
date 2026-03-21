import {
  getWasm, isRunning, isPaused, isRomLoaded, isTurboMode,
  isDebugVisible, getAnimFrameId, setAnimFrameId, setRunning, getMemory
} from './state.js';
import { renderFrame } from '../video/screen.js';
import { pushAudioFrame } from '../audio/audio.js';
import { renderDebugView } from '../debug/debug-view.js';

const FRAME_INTERVAL = 1000 / 50; // 20ms per frame (50 FPS PAL)
let lastFrameTime = 0;

function frameLoop(timestamp: number): void {
  setAnimFrameId(requestAnimationFrame(frameLoop));

  const wasm = getWasm();
  if (!isRunning() || isPaused() || !isRomLoaded()) return;

  if (isTurboMode()) {
    try {
      const TURBO_FRAMES = 50;
      for (let i = 0; i < TURBO_FRAMES; i++) wasm!.frame();
      renderFrame();
    } catch (e) {
      console.error('Emulation error:', e);
      document.getElementById('status')!.textContent = 'Emulation error: ' + (e as Error).message;
      setRunning(false);
    }
    if (isDebugVisible()) {
      try { renderDebugView(getMemory()!.buffer); } catch (e) { console.warn('Debug view error:', e); }
    }
    lastFrameTime = timestamp;
    return;
  }

  const elapsed = timestamp - lastFrameTime;
  if (elapsed < FRAME_INTERVAL * 0.9) return;

  lastFrameTime = elapsed > FRAME_INTERVAL * 2
    ? timestamp
    : lastFrameTime + FRAME_INTERVAL;

  try {
    if (wasm!.isTapePlaying()) {
      for (let i = 0; i < 19; i++) wasm!.frame();
    }
    wasm!.frame();
    renderFrame();
    pushAudioFrame();
  } catch (e) {
    console.error('Emulation error:', e);
    console.error('PC was:', wasm ? wasm.getPC().toString(16) : 'unknown');
    document.getElementById('status')!.textContent = 'Emulation error: ' + (e as Error).message;
    setRunning(false);
  }

  if (isDebugVisible()) {
    try { renderDebugView(getMemory()!.buffer); } catch (e) { console.warn('Debug view error:', e); }
  }
}

export function startFrameLoop(): void {
  lastFrameTime = 0;
  setAnimFrameId(requestAnimationFrame(frameLoop));
}

export function stopFrameLoop(): void {
  const id = getAnimFrameId();
  if (id) {
    cancelAnimationFrame(id);
    setAnimFrameId(null);
  }
}

export function resetFrameTime(): void {
  lastFrameTime = 0;
}
