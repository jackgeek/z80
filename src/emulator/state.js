// Shared emulator state — single source of truth for all modules.
// No circular dependencies: every other module imports from here.

export const SCREEN_WIDTH = 256;
export const SCREEN_HEIGHT = 192;
export const MEM_BASE = 0x100000;

// Mutable state — accessed via getters/setters to allow cross-module mutation
let wasm = null;
let memory = null;
let running = false;
let paused = false;
let turboMode = false;
let debugVisible = false;
let romLoaded = false;
let animFrameId = null;
let cachedRomData = null;

export function getWasm() { return wasm; }
export function setWasm(w) { wasm = w; }

export function getMemory() { return memory; }
export function setMemory(m) { memory = m; }

export function isRunning() { return running; }
export function setRunning(v) { running = v; }

export function isPaused() { return paused; }
export function setPaused(v) { paused = v; }

export function isTurboMode() { return turboMode; }
export function setTurboMode(v) { turboMode = v; }

export function isDebugVisible() { return debugVisible; }
export function setDebugVisible(v) { debugVisible = v; }

export function isRomLoaded() { return romLoaded; }
export function setRomLoaded(v) { romLoaded = v; }

export function getAnimFrameId() { return animFrameId; }
export function setAnimFrameId(id) { animFrameId = id; }

export function getCachedRomData() { return cachedRomData; }
export function setCachedRomData(d) { cachedRomData = d; }
