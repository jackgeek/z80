// Shared emulator state — single source of truth for all modules.
// No circular dependencies: every other module imports from here.

import type { WasmExports } from './wasm-types.js';

export const SCREEN_WIDTH = 256;
export const SCREEN_HEIGHT = 192;
export const MEM_BASE = 0x100000;

// Mutable state — accessed via getters/setters to allow cross-module mutation
let wasm: WasmExports | null = null;
let memory: WebAssembly.Memory | null = null;
let running = false;
let paused = false;
let turboMode = false;
let debugVisible = false;
let romLoaded = false;
let animFrameId: number | null = null;
let cachedRomData: Uint8Array | null = null;

export function getWasm(): WasmExports | null { return wasm; }
export function setWasm(w: WasmExports | null): void { wasm = w; }

export function getMemory(): WebAssembly.Memory | null { return memory; }
export function setMemory(m: WebAssembly.Memory): void { memory = m; }

export function isRunning(): boolean { return running; }
export function setRunning(v: boolean): void { running = v; }

export function isPaused(): boolean { return paused; }
export function setPaused(v: boolean): void { paused = v; }

export function isTurboMode(): boolean { return turboMode; }
export function setTurboMode(v: boolean): void { turboMode = v; }

export function isDebugVisible(): boolean { return debugVisible; }
export function setDebugVisible(v: boolean): void { debugVisible = v; }

export function isRomLoaded(): boolean { return romLoaded; }
export function setRomLoaded(v: boolean): void { romLoaded = v; }

export function getAnimFrameId(): number | null { return animFrameId; }
export function setAnimFrameId(id: number | null): void { animFrameId = id; }

export function getCachedRomData(): Uint8Array | null { return cachedRomData; }
export function setCachedRomData(d: Uint8Array): void { cachedRomData = d; }
