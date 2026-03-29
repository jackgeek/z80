import {
  getWasm, isRunning, isPaused, isRomLoaded, isTurboMode, setRunning
} from './state.js';
import { pushAudioFrame } from '../audio/audio.js';

let lastFrameTime = 0;
let wasPlaying = false;
let onTapeDoneCallback: (() => void) | null = null;

export function registerTapeDoneCallback(cb: () => void): void {
  onTapeDoneCallback = cb;
}

export function tickEmulatorFrame(): void {
  const wasm = getWasm();
  if (!isRunning() || isPaused() || !isRomLoaded() || !wasm) return;

  try {
    if (isTurboMode()) {
      for (let i = 0; i < 50; i++) wasm.frame();
      const playing = wasm.isTapePlaying();
      if (wasPlaying && !playing && onTapeDoneCallback) {
        const cb = onTapeDoneCallback;
        onTapeDoneCallback = null;
        cb();
      }
      wasPlaying = playing;
      return;
    }

    if (wasm.isTapePlaying()) {
      for (let i = 0; i < 19; i++) wasm.frame();
    }
    wasm.frame();
    pushAudioFrame();

    const playing = wasm.isTapePlaying();
    if (wasPlaying && !playing && onTapeDoneCallback) {
      const cb = onTapeDoneCallback;
      onTapeDoneCallback = null;
      cb();
    }
    wasPlaying = playing;
  } catch (e) {
    console.error('Emulation error:', e);
    console.error('PC was:', wasm ? wasm.getPC().toString(16) : 'unknown');
    setRunning(false);
  }
}

export function resetFrameTime(): void {
  lastFrameTime = 0;
}
