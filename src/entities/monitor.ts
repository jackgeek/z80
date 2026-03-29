// 3D CRT monitor with brass steampunk frame and dynamic WASM screen texture

import * as pc from 'playcanvas';
import { createBrassMaterial } from '../materials/brass.js';
import { SCREEN_WIDTH, SCREEN_HEIGHT } from '../emulator/state.js';
import type { WasmExports } from '../emulator/wasm-types.js';

const SCREEN_BYTES = SCREEN_WIDTH * SCREEN_HEIGHT * 4;

// The full monitor opening includes border area around the 256x192 pixels.
// Real Spectrum: 256x192 main area inside a ~352x296 total area (48px border each side).
// We scale proportionally: border is ~37% of screen width on each side.
const BORDER_FRACTION = 0.30; // how much larger the border area is vs the screen
const SCREEN_W = 2.0;   // main 256x192 display width in world units
const SCREEN_H = 1.5;   // main display height
const BORDER_W = SCREEN_W * (1 + BORDER_FRACTION);  // full opening width including border
const BORDER_H = SCREEN_H * (1 + BORDER_FRACTION);  // full opening height
const BEZEL = 0.12;

// ZX Spectrum border palette (same as original)
const BORDER_COLORS: pc.Color[] = [
  new pc.Color(0, 0, 0),             // 0 black
  new pc.Color(0, 0, 0.80),          // 1 blue
  new pc.Color(0.80, 0, 0),          // 2 red
  new pc.Color(0.80, 0, 0.80),       // 3 magenta
  new pc.Color(0, 0.80, 0),          // 4 green
  new pc.Color(0, 0.80, 0.80),       // 5 cyan
  new pc.Color(0.80, 0.80, 0),       // 6 yellow
  new pc.Color(0.80, 0.80, 0.80),    // 7 white
];

export interface MonitorResult {
  monitorEntity: pc.Entity;
  screenQuad: pc.Entity;
  screenTexture: pc.Texture;
  borderMaterial: pc.StandardMaterial;
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

export function createMonitor(app: pc.Application): MonitorResult {
  const device = app.graphicsDevice;
  const brassMat = createBrassMaterial(device);
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

  // ── Border plane (behind screen, shows ZX Spectrum border color) ────────
  const borderMat = new pc.StandardMaterial();
  borderMat.diffuse = BORDER_COLORS[7].clone(); // default white
  borderMat.emissive = BORDER_COLORS[7].clone();
  borderMat.useLighting = false;
  borderMat.update();

  const borderPlane = new pc.Entity('BorderPlane');
  borderPlane.addComponent('render', { type: 'plane' });
  borderPlane.setLocalScale(BORDER_W, 1, BORDER_H);
  borderPlane.setLocalEulerAngles(90, 0, 0);
  borderPlane.setLocalPosition(0, 0, 0.065);
  borderPlane.render!.meshInstances[0].material = borderMat;
  monitor.addChild(borderPlane);

  // ── Screen quad (256x192 main display, on top of border) ──────────────
  const screenQuad = new pc.Entity('ScreenQuad');
  screenQuad.addComponent('render', { type: 'plane' });
  screenQuad.setLocalScale(SCREEN_W, 1, SCREEN_H);
  screenQuad.setLocalEulerAngles(90, 0, 0);
  screenQuad.setLocalPosition(0, 0, 0.07);
  screenQuad.render!.meshInstances[0].material = screenMat;
  monitor.addChild(screenQuad);
  screenQuad.tags.add('screen');

  // ── Brass bezel frame ─────────────────────────────────────────────────────
  const halfW = BORDER_W / 2 + BEZEL;
  const halfH = BORDER_H / 2 + BEZEL;
  const depth = 0.12;

  // Back plate (solid brass behind the border area)
  const backPlate = new pc.Entity('BackPlate');
  backPlate.addComponent('render', { type: 'box' });
  backPlate.setLocalScale(BORDER_W + BEZEL * 2, BORDER_H + BEZEL * 2, depth);
  backPlate.setLocalPosition(0, 0, 0);
  backPlate.render!.meshInstances[0].material = brassMat;
  monitor.addChild(backPlate);

  // Top bezel
  const topBezel = new pc.Entity('TopBezel');
  topBezel.addComponent('render', { type: 'box' });
  topBezel.setLocalScale(BORDER_W + BEZEL * 4, BEZEL, depth + 0.04);
  topBezel.setLocalPosition(0, halfH, 0.02);
  topBezel.render!.meshInstances[0].material = brassMat;
  monitor.addChild(topBezel);

  // Bottom bezel
  const bottomBezel = new pc.Entity('BottomBezel');
  bottomBezel.addComponent('render', { type: 'box' });
  bottomBezel.setLocalScale(BORDER_W + BEZEL * 4, BEZEL, depth + 0.04);
  bottomBezel.setLocalPosition(0, -halfH, 0.02);
  bottomBezel.render!.meshInstances[0].material = brassMat;
  monitor.addChild(bottomBezel);

  // Left bezel
  const leftBezel = new pc.Entity('LeftBezel');
  leftBezel.addComponent('render', { type: 'box' });
  leftBezel.setLocalScale(BEZEL, BORDER_H + BEZEL * 4, depth + 0.04);
  leftBezel.setLocalPosition(-halfW, 0, 0.02);
  leftBezel.render!.meshInstances[0].material = brassMat;
  monitor.addChild(leftBezel);

  // Right bezel
  const rightBezel = new pc.Entity('RightBezel');
  rightBezel.addComponent('render', { type: 'box' });
  rightBezel.setLocalScale(BEZEL, BORDER_H + BEZEL * 4, depth + 0.04);
  rightBezel.setLocalPosition(halfW, 0, 0.02);
  rightBezel.render!.meshInstances[0].material = brassMat;
  monitor.addChild(rightBezel);

  // ── Rivets at corners ─────────────────────────────────────────────────────
  const rivetPositions: [number, number][] = [
    [-halfW, halfH], [halfW, halfH], [-halfW, -halfH], [halfW, -halfH]
  ];
  for (const [x, y] of rivetPositions) {
    const rivet = new pc.Entity('Rivet');
    rivet.addComponent('render', { type: 'sphere' });
    rivet.setLocalScale(0.08, 0.08, 0.08);
    rivet.setLocalPosition(x, y, 0.08);
    rivet.render!.meshInstances[0].material = brassMat;
    monitor.addChild(rivet);
  }

  // ── Steam pipes along sides ───────────────────────────────────────────────
  for (const side of [-1, 1]) {
    const pipe = new pc.Entity('SteamPipe');
    pipe.addComponent('render', { type: 'cylinder' });
    pipe.setLocalScale(0.06, BORDER_H * 0.8, 0.06);
    pipe.setLocalPosition(side * (halfW + 0.08), 0, 0);
    pipe.render!.meshInstances[0].material = brassMat;
    monitor.addChild(pipe);
  }

  return { monitorEntity: monitor, screenQuad, screenTexture, borderMaterial: borderMat };
}

let lastBorderColor = -1;

export function updateBorderColor(
  borderMaterial: pc.StandardMaterial,
  wasm: WasmExports
): void {
  const color = wasm.getBorderColor() & 7;
  if (color === lastBorderColor) return;
  lastBorderColor = color;
  const c = BORDER_COLORS[color];
  borderMaterial.diffuse.copy(c);
  borderMaterial.emissive.copy(c);
  borderMaterial.update();
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
