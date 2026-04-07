/** Type definitions for the Z80 WASM module exports */
export interface WasmExports {
  // Core
  init(): void;
  frame(): void;

  // Memory
  getScreenBaseAddr(): number;
  getAudioBaseAddr(): number;
  getPulseBaseAddr(): number;
  setRomByte(index: number, value: number): void;
  readMem(addr: number): number;
  writeRAM(addr: number, value: number): void;

  // Keyboard
  keyDown(row: number, bit: number): void;
  keyUp(row: number, bit: number): void;
  setKempston(value: number): void;

  // Audio
  getAudioSampleCount(): number;

  // Tape
  loadTapData(index: number, value: number): void;
  setTapSize(size: number): void;
  isTapePlaying(): boolean;
  setPulseCount(count: number): void;
  setBlockBound(index: number, value: number): void;
  setBlockBoundsCount(count: number): void;

  // Border
  getBorderColor(): number;
  getBorderLogAddr(): number;
  setBorderColor_ext(color: number): void;

  // CPU registers — getters
  getA(): number;
  getF(): number;
  getBC2(): number;
  getDE2(): number;
  getHL2(): number;
  getPC(): number;
  getSP(): number;
  getIX(): number;
  getIY(): number;
  getI(): number;
  getR(): number;
  getIM(): number;
  getIFF1(): number;
  getIFF2(): number;
  getA2(): number;
  getF2(): number;
  getBC_prime(): number;
  getDE_prime(): number;
  getHL_prime(): number;

  // CPU registers — setters (for snapshot restore)
  setA_ext(v: number): void;
  setF_ext(v: number): void;
  setBC_ext(v: number): void;
  setDE_ext(v: number): void;
  setHL_ext(v: number): void;
  setPC_ext(v: number): void;
  setSP_ext(v: number): void;
  setIX_ext(v: number): void;
  setIY_ext(v: number): void;
  setI_ext(v: number): void;
  setR_ext(v: number): void;
  setIM_ext(v: number): void;
  setIFF1_ext(v: number): void;
  setIFF2_ext(v: number): void;
  setA2_ext(v: number): void;
  setF2_ext(v: number): void;
  setBC_prime_ext(v: number): void;
  setDE_prime_ext(v: number): void;
  setHL_prime_ext(v: number): void;
}
