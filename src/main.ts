// ZX Spectrum 48K Emulator — Steam-Punk 3D UI Entry Point
// PlayCanvas scene with WASM emulator core

import { initPlayCanvasApp } from './scene/app.js';
import { buildSceneGraph } from './scene/scene-graph.js';
import { createStatusOverlay } from './ui/status-overlay.js';
import { initWasm } from './emulator/wasm-loader.js';
import { tickEmulatorFrame } from './emulator/frame-loop.js';
import { updateMonitorTexture } from './entities/monitor.js';
import { getWasm, getMemory, isRunning } from './emulator/state.js';

const FRAME_INTERVAL = 1000 / 50; // 20ms per PAL frame

async function main(): Promise<void> {
  // 1. Create PlayCanvas application (full viewport)
  const app = initPlayCanvasApp();

  // 2. Build 3D scene graph (camera, lights, brass monitor)
  const entities = buildSceneGraph(app);

  // 3. Create status overlay for messages
  const { setStatusText } = createStatusOverlay(app);

  // 4. Wire PlayCanvas update loop — emulator tick + texture update
  let frameAccum = 0;

  app.on('update', (dt: number) => {
    frameAccum += dt * 1000;

    // Tick emulator at ~50Hz
    while (frameAccum >= FRAME_INTERVAL) {
      frameAccum -= FRAME_INTERVAL;
      tickEmulatorFrame();
    }

    // Update monitor texture from WASM screen buffer
    const wasm = getWasm();
    const memory = getMemory();
    if (wasm && memory && isRunning()) {
      updateMonitorTexture(entities.screenTexture, memory, wasm);
    }
  });

  // 5. Load WASM and ROM
  await initWasm(setStatusText);
}

main().catch(console.error);
