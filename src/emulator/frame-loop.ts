import {
  getWasm, isRunning, isPaused, isRomLoaded, isTurboMode, setRunning
} from './state.js';
import { pushAudioFrame } from '../audio/audio.js';

let lastFrameTime = 0;

export function tickEmulatorFrame(): void {
  const wasm = getWasm();
  if (!isRunning() || isPaused() || !isRomLoaded() || !wasm) return;

  try {
    if (isTurboMode()) {
      for (let i = 0; i < 50; i++) wasm.frame();
      return;
    }

    if (wasm.isTapePlaying()) {
      for (let i = 0; i < 19; i++) wasm.frame();
    }
    wasm.frame();
    pushAudioFrame();
  } catch (e) {
    console.error('Emulation error:', e);
    console.error('PC was:', wasm ? wasm.getPC().toString(16) : 'unknown');
    setRunning(false);
  }
}

export function resetFrameTime(): void {
  lastFrameTime = 0;
}
