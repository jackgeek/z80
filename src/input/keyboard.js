/**
 * Keyboard input handling for ZX Spectrum emulator.
 * Maps physical keyboard events to the Spectrum's 8x5 keyboard matrix.
 */

import { getWasm, isRunning } from '../emulator/state.js';

/**
 * ZX Spectrum keyboard matrix mapping.
 * Each key maps to a half-row (0-7) and a bit within that row.
 */
export const KEY_MAP = {
  'ShiftLeft':   { row: 0, bit: 0x01 },
  'ShiftRight':  { row: 0, bit: 0x01 },
  'KeyZ':        { row: 0, bit: 0x02 },
  'KeyX':        { row: 0, bit: 0x04 },
  'KeyC':        { row: 0, bit: 0x08 },
  'KeyV':        { row: 0, bit: 0x10 },
  'KeyA':        { row: 1, bit: 0x01 },
  'KeyS':        { row: 1, bit: 0x02 },
  'KeyD':        { row: 1, bit: 0x04 },
  'KeyF':        { row: 1, bit: 0x08 },
  'KeyG':        { row: 1, bit: 0x10 },
  'KeyQ':        { row: 2, bit: 0x01 },
  'KeyW':        { row: 2, bit: 0x02 },
  'KeyE':        { row: 2, bit: 0x04 },
  'KeyR':        { row: 2, bit: 0x08 },
  'KeyT':        { row: 2, bit: 0x10 },
  'Digit1':      { row: 3, bit: 0x01 },
  'Digit2':      { row: 3, bit: 0x02 },
  'Digit3':      { row: 3, bit: 0x04 },
  'Digit4':      { row: 3, bit: 0x08 },
  'Digit5':      { row: 3, bit: 0x10 },
  'Digit0':      { row: 4, bit: 0x01 },
  'Digit9':      { row: 4, bit: 0x02 },
  'Digit8':      { row: 4, bit: 0x04 },
  'Digit7':      { row: 4, bit: 0x08 },
  'Digit6':      { row: 4, bit: 0x10 },
  'KeyP':        { row: 5, bit: 0x01 },
  'KeyO':        { row: 5, bit: 0x02 },
  'KeyI':        { row: 5, bit: 0x04 },
  'KeyU':        { row: 5, bit: 0x08 },
  'KeyY':        { row: 5, bit: 0x10 },
  'Enter':       { row: 6, bit: 0x01 },
  'KeyL':        { row: 6, bit: 0x02 },
  'KeyK':        { row: 6, bit: 0x04 },
  'KeyJ':        { row: 6, bit: 0x08 },
  'KeyH':        { row: 6, bit: 0x10 },
  'Space':       { row: 7, bit: 0x01 },
  'ControlLeft': { row: 7, bit: 0x02 },
  'ControlRight':{ row: 7, bit: 0x02 },
  'KeyM':        { row: 7, bit: 0x04 },
  'KeyN':        { row: 7, bit: 0x08 },
  'KeyB':        { row: 7, bit: 0x10 },
};

/**
 * Compound keys that map a single physical key to multiple Spectrum keys.
 * For example, Backspace = Caps Shift + 0 (DELETE).
 */
export const COMPOUND_KEYS = {
  'Backspace':  [{ row: 0, bit: 0x01 }, { row: 4, bit: 0x01 }],
  'ArrowLeft':  [{ row: 0, bit: 0x01 }, { row: 3, bit: 0x10 }],
  'ArrowDown':  [{ row: 0, bit: 0x01 }, { row: 4, bit: 0x10 }],
  'ArrowUp':    [{ row: 0, bit: 0x01 }, { row: 4, bit: 0x08 }],
  'ArrowRight': [{ row: 0, bit: 0x01 }, { row: 4, bit: 0x04 }],
};

/**
 * Attach keydown and keyup event listeners to the document for
 * ZX Spectrum keyboard input.
 */
export function attachKeyboardHandlers() {
  document.addEventListener('keydown', (e) => {
    if (!getWasm() || !isRunning()) return;

    const tag = e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;

    const compound = COMPOUND_KEYS[e.code];
    if (compound) {
      e.preventDefault();
      for (const k of compound) {
        getWasm().keyDown(k.row, k.bit);
      }
      return;
    }

    const mapping = KEY_MAP[e.code];
    if (mapping) {
      e.preventDefault();
      getWasm().keyDown(mapping.row, mapping.bit);
    }
  });

  document.addEventListener('keyup', (e) => {
    if (!getWasm() || !isRunning()) return;

    const tag = e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;

    const compound = COMPOUND_KEYS[e.code];
    if (compound) {
      e.preventDefault();
      for (const k of compound) {
        getWasm().keyUp(k.row, k.bit);
      }
      return;
    }

    const mapping = KEY_MAP[e.code];
    if (mapping) {
      e.preventDefault();
      getWasm().keyUp(mapping.row, mapping.bit);
    }
  });
}
