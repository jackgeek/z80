/**
 * ZX Spectrum keyboard matrix mapping data.
 * Maps physical keyboard event codes to Spectrum's 8x5 keyboard matrix.
 * The actual event listeners are in input-bridge.ts.
 */

export interface KeyMapping {
  row: number;
  bit: number;
}

/**
 * ZX Spectrum keyboard matrix mapping.
 * Each key maps to a half-row (0-7) and a bit within that row.
 */
export const KEY_MAP: Record<string, KeyMapping> = {
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
export const COMPOUND_KEYS: Record<string, KeyMapping[]> = {
  'Backspace':  [{ row: 0, bit: 0x01 }, { row: 4, bit: 0x01 }],
  'ArrowLeft':  [{ row: 0, bit: 0x01 }, { row: 3, bit: 0x10 }],
  'ArrowDown':  [{ row: 0, bit: 0x01 }, { row: 4, bit: 0x10 }],
  'ArrowUp':    [{ row: 0, bit: 0x01 }, { row: 4, bit: 0x08 }],
  'ArrowRight': [{ row: 0, bit: 0x01 }, { row: 4, bit: 0x04 }],
};
