// 3D monitor with dynamic WASM screen texture

import * as pc from 'playcanvas';
import { SCREEN_WIDTH, SCREEN_HEIGHT } from '../emulator/state.js';
import type { WasmExports } from '../emulator/wasm-types.js';

const SCREEN_BYTES = SCREEN_WIDTH * SCREEN_HEIGHT * 4;

// The full monitor opening includes border area around the 256x192 pixels.
// Real ZX Spectrum: 32px border on each side of 256px display = 32/256 = 0.125.
const BORDER_FRACTION = 0.125; // per-side border fraction: 32px / 256px = 0.125
const SCREEN_W = 2.0;   // main 256x192 display width in world units
const SCREEN_H = 1.5;   // main display height
const BORDER_W = SCREEN_W * (1 + BORDER_FRACTION);  // full opening width including border
const BORDER_H = SCREEN_H * (1 + BORDER_FRACTION);  // full opening height

export interface MonitorResult {
  monitorEntity: pc.Entity;
  screenQuad: pc.Entity;
  screenTexture: pc.Texture;
  borderTexture: pc.Texture;
}

// Two-canvas approach for crisp pixel rendering:
// 1. Native canvas: 256x192, receives raw WASM RGBA data
// 2. Upscaled canvas: 3x (768x576), nearest-neighbor blit for crisp pixels
const UPSCALE = 3;
const TEX_W = SCREEN_WIDTH * UPSCALE;
const TEX_H = SCREEN_HEIGHT * UPSCALE;

const nativeCanvas = document.createElement('canvas');
nativeCanvas.width = SCREEN_WIDTH;
nativeCanvas.height = SCREEN_HEIGHT;
const nativeCtx = nativeCanvas.getContext('2d')!;
const nativeImageData = nativeCtx.createImageData(SCREEN_WIDTH, SCREEN_HEIGHT);

const upscaledCanvas = document.createElement('canvas');
upscaledCanvas.width = TEX_W;
upscaledCanvas.height = TEX_H;
const upscaledCtx = upscaledCanvas.getContext('2d')!;
upscaledCtx.imageSmoothingEnabled = false;

// Border stripe texture: 1px wide × 64px tall canvas, one row per time slot
const borderCanvas = document.createElement('canvas');
borderCanvas.width = 1;
borderCanvas.height = 312;
const borderCtx = borderCanvas.getContext('2d')!;

// Pre-built RGBA palette for the 8 ZX Spectrum border colours
// Layout: 8 entries × 4 bytes [R, G, B, A]
const BORDER_PALETTE_RGBA = new Uint8Array([
  0,   0,   0,   255, // 0 black
  0,   0,   204, 255, // 1 blue
  204, 0,   0,   255, // 2 red
  204, 0,   204, 255, // 3 magenta
  0,   204, 0,   255, // 4 green
  0,   204, 204, 255, // 5 cyan
  204, 204, 0,   255, // 6 yellow
  204, 204, 204, 255, // 7 white
]);

// Reusable 1×312 RGBA pixel buffer for border stripe texture upload
const borderPixels = new ImageData(1, 312);

export function createMonitor(app: pc.Application): MonitorResult {
  const device = app.graphicsDevice;
  const monitor = new pc.Entity('Monitor');
  monitor.tags.add('swipeable');

  // ── Screen texture via canvas source ──────────────────────────────────────
  // GPU uses LINEAR filtering on the pre-upscaled texture. Since the CPU already
  // did nearest-neighbor 3x upscale, LINEAR just smoothly interpolates between
  // the crisp pixel blocks instead of dropping pixels at non-integer scale ratios.
  const screenTexture = new pc.Texture(device, {
    width: TEX_W,
    height: TEX_H,
    format: pc.PIXELFORMAT_RGBA8,
    minFilter: pc.FILTER_LINEAR,
    magFilter: pc.FILTER_LINEAR,
    addressU: pc.ADDRESS_CLAMP_TO_EDGE,
    addressV: pc.ADDRESS_CLAMP_TO_EDGE,
    mipmaps: false,
  });
  // Initial source — will be updated each frame
  screenTexture.setSource(upscaledCanvas);

  const screenMat = new pc.StandardMaterial();
  screenMat.diffuseMap = screenTexture;
  screenMat.emissiveMap = screenTexture;
  screenMat.emissive = new pc.Color(1.0, 1.0, 1.0);
  screenMat.useLighting = false;
  screenMat.update();

  // ── Border stripe texture (1×64, one row per ~1092 T-cycle slot) ────────
  const borderTexture = new pc.Texture(device, {
    width: 1,
    height: 312,
    format: pc.PIXELFORMAT_RGBA8,
    minFilter: pc.FILTER_NEAREST,
    magFilter: pc.FILTER_NEAREST,
    addressU: pc.ADDRESS_CLAMP_TO_EDGE,
    addressV: pc.ADDRESS_CLAMP_TO_EDGE,
    mipmaps: false,
  });
  // Initialise to solid white (border colour 7)
  for (let i = 0; i < 312; i++) {
    borderPixels.data[i * 4 + 0] = 204;
    borderPixels.data[i * 4 + 1] = 204;
    borderPixels.data[i * 4 + 2] = 204;
    borderPixels.data[i * 4 + 3] = 255;
  }
  borderCtx.putImageData(borderPixels, 0, 0);
  borderTexture.setSource(borderCanvas);

  const borderMat = new pc.StandardMaterial();
  borderMat.diffuseMap = borderTexture;
  borderMat.emissiveMap = borderTexture;
  borderMat.emissive = new pc.Color(1, 1, 1);
  borderMat.useLighting = false;
  borderMat.update();

  const borderPlane = new pc.Entity('BorderPlane');
  borderPlane.addComponent('render', { type: 'plane' });
  borderPlane.setLocalScale(BORDER_W, 1, BORDER_H);
  borderPlane.setLocalEulerAngles(90, 0, 0);
  borderPlane.setLocalPosition(0, 0, 0.065);
  borderPlane.render!.meshInstances[0].material = borderMat;
  monitor.addChild(borderPlane);
  borderPlane.tags.add('screen');

  // ── Screen quad (256x192 main display, on top of border) ──────────────
  const screenQuad = new pc.Entity('ScreenQuad');
  screenQuad.addComponent('render', { type: 'plane' });
  screenQuad.setLocalScale(SCREEN_W, 1, SCREEN_H);
  screenQuad.setLocalEulerAngles(90, 0, 0);
  screenQuad.setLocalPosition(0, 0, 0.07);
  screenQuad.render!.meshInstances[0].material = screenMat;
  monitor.addChild(screenQuad);
  screenQuad.tags.add('screen');

  return { monitorEntity: monitor, screenQuad, screenTexture, borderTexture };
}

let borderLogSrc: Uint8Array | null = null;

export function updateBorderTexture(
  borderTexture: pc.Texture,
  memory: WebAssembly.Memory,
  wasm: WasmExports
): void {
  if (!borderLogSrc || borderLogSrc.buffer !== memory.buffer) {
    borderLogSrc = new Uint8Array(memory.buffer, wasm.getBorderLogAddr(), 312);
  }
  for (let i = 0; i < 312; i++) {
    const c = (borderLogSrc[i] & 7) * 4;
    borderPixels.data[i * 4 + 0] = BORDER_PALETTE_RGBA[c + 0];
    borderPixels.data[i * 4 + 1] = BORDER_PALETTE_RGBA[c + 1];
    borderPixels.data[i * 4 + 2] = BORDER_PALETTE_RGBA[c + 2];
    borderPixels.data[i * 4 + 3] = 255;
  }
  borderCtx.putImageData(borderPixels, 0, 0);
  borderTexture.setSource(borderCanvas);
}

// Reusable view into WASM memory for texture updates
let screenSrc: Uint8Array | null = null;

export function updateMonitorTexture(
  screenTexture: pc.Texture,
  memory: WebAssembly.Memory,
  wasm: WasmExports
): void {
  if (!screenSrc || screenSrc.buffer !== memory.buffer) {
    screenSrc = new Uint8Array(memory.buffer, wasm.getScreenBaseAddr(), SCREEN_BYTES);
  }
  // Copy WASM RGBA to native canvas, then nearest-neighbor upscale to texture canvas
  nativeImageData.data.set(screenSrc);
  nativeCtx.putImageData(nativeImageData, 0, 0);
  upscaledCtx.drawImage(nativeCanvas, 0, 0, TEX_W, TEX_H);
  screenTexture.setSource(upscaledCanvas);
}
