// 3D CRT monitor with brass steampunk frame and dynamic WASM screen texture

import * as pc from 'playcanvas';
import { createBrassMaterial } from '../materials/brass.js';
import { SCREEN_WIDTH, SCREEN_HEIGHT } from '../emulator/state.js';
import type { WasmExports } from '../emulator/wasm-types.js';

const SCREEN_BYTES = SCREEN_WIDTH * SCREEN_HEIGHT * 4;

// Aspect ratio: 256:192 = 4:3
const SCREEN_W = 2.56;
const SCREEN_H = 1.92;
const BEZEL = 0.12;

export interface MonitorResult {
  monitorEntity: pc.Entity;
  screenQuad: pc.Entity;
  screenTexture: pc.Texture;
}

// Off-screen canvas for texture updates (avoids lock/unlock API issues)
const offCanvas = document.createElement('canvas');
offCanvas.width = SCREEN_WIDTH;
offCanvas.height = SCREEN_HEIGHT;
const offCtx = offCanvas.getContext('2d')!;
const offImageData = offCtx.createImageData(SCREEN_WIDTH, SCREEN_HEIGHT);

export function createMonitor(app: pc.Application): MonitorResult {
  const device = app.graphicsDevice;
  const brassMat = createBrassMaterial(device);
  const monitor = new pc.Entity('Monitor');
  monitor.tags.add('swipeable');

  // ── Screen texture via canvas source ──────────────────────────────────────
  const screenTexture = new pc.Texture(device, {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    format: pc.PIXELFORMAT_RGBA8,
    minFilter: pc.FILTER_NEAREST,
    magFilter: pc.FILTER_NEAREST,
    addressU: pc.ADDRESS_CLAMP_TO_EDGE,
    addressV: pc.ADDRESS_CLAMP_TO_EDGE,
    mipmaps: false,
  });
  // Initial source — will be updated each frame
  screenTexture.setSource(offCanvas);

  const screenMat = new pc.StandardMaterial();
  screenMat.diffuseMap = screenTexture;
  screenMat.emissiveMap = screenTexture;
  screenMat.emissive = new pc.Color(1.0, 1.0, 1.0);
  screenMat.useLighting = false;
  screenMat.update();

  const screenQuad = new pc.Entity('ScreenQuad');
  screenQuad.addComponent('render', { type: 'plane' });
  screenQuad.setLocalScale(SCREEN_W, 1, SCREEN_H);
  screenQuad.setLocalEulerAngles(90, 0, 0);
  screenQuad.setLocalPosition(0, 0, 0.07);
  screenQuad.render!.meshInstances[0].material = screenMat;
  monitor.addChild(screenQuad);

  // ── Brass bezel frame ─────────────────────────────────────────────────────
  const halfW = SCREEN_W / 2 + BEZEL;
  const halfH = SCREEN_H / 2 + BEZEL;
  const depth = 0.12;

  // Back plate (solid brass behind the screen)
  const backPlate = new pc.Entity('BackPlate');
  backPlate.addComponent('render', { type: 'box' });
  backPlate.setLocalScale(SCREEN_W + BEZEL * 2, SCREEN_H + BEZEL * 2, depth);
  backPlate.setLocalPosition(0, 0, 0);
  backPlate.render!.meshInstances[0].material = brassMat;
  monitor.addChild(backPlate);

  // Top bezel
  const topBezel = new pc.Entity('TopBezel');
  topBezel.addComponent('render', { type: 'box' });
  topBezel.setLocalScale(SCREEN_W + BEZEL * 4, BEZEL, depth + 0.04);
  topBezel.setLocalPosition(0, halfH, 0.02);
  topBezel.render!.meshInstances[0].material = brassMat;
  monitor.addChild(topBezel);

  // Bottom bezel
  const bottomBezel = new pc.Entity('BottomBezel');
  bottomBezel.addComponent('render', { type: 'box' });
  bottomBezel.setLocalScale(SCREEN_W + BEZEL * 4, BEZEL, depth + 0.04);
  bottomBezel.setLocalPosition(0, -halfH, 0.02);
  bottomBezel.render!.meshInstances[0].material = brassMat;
  monitor.addChild(bottomBezel);

  // Left bezel
  const leftBezel = new pc.Entity('LeftBezel');
  leftBezel.addComponent('render', { type: 'box' });
  leftBezel.setLocalScale(BEZEL, SCREEN_H + BEZEL * 4, depth + 0.04);
  leftBezel.setLocalPosition(-halfW, 0, 0.02);
  leftBezel.render!.meshInstances[0].material = brassMat;
  monitor.addChild(leftBezel);

  // Right bezel
  const rightBezel = new pc.Entity('RightBezel');
  rightBezel.addComponent('render', { type: 'box' });
  rightBezel.setLocalScale(BEZEL, SCREEN_H + BEZEL * 4, depth + 0.04);
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
    pipe.setLocalScale(0.06, SCREEN_H * 0.8, 0.06);
    pipe.setLocalPosition(side * (halfW + 0.08), 0, 0);
    pipe.render!.meshInstances[0].material = brassMat;
    monitor.addChild(pipe);
  }

  return { monitorEntity: monitor, screenQuad, screenTexture };
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
  // Copy WASM RGBA buffer to canvas ImageData, then update texture source
  offImageData.data.set(screenSrc);
  offCtx.putImageData(offImageData, 0, 0);
  screenTexture.setSource(offCanvas);
}
