// ZX Spectrum 48K Emulator — Steam-Punk 3D UI Entry Point
// PlayCanvas scene with WASM emulator core + XState scene management

import { initPlayCanvasApp } from './scene/app.js';
import { buildSceneGraph } from './scene/scene-graph.js';
import { createStatusOverlay } from './ui/status-overlay.js';
import { initWasm } from './emulator/wasm-loader.js';
import { tickEmulatorFrame } from './emulator/frame-loop.js';
import { updateMonitorTexture, updateBorderColor } from './entities/monitor.js';
import { getWasm, getMemory, isRunning } from './emulator/state.js';
import { initInputBridge, setSceneActor, setMenuOpen } from './input/input-bridge.js';
import { setGlobalStatusFn } from './ui/status-bridge.js';
import { initFileHandler } from './ui/file-handler.js';
import { createSceneMachineActor } from './state-machine/machine.js';
import { updateTweens, setViewportParams, snapToCurrentScene } from './scene/scene-transitions.js';
import { createFrustumMarkers } from './debug/frustum-markers.js';

const FRAME_INTERVAL = 1000 / 50; // 20ms per PAL frame

async function main(): Promise<void> {
  // 1. Create PlayCanvas application (full viewport)
  const app = initPlayCanvasApp();

  // 2. Build 3D scene graph (camera, lights, all entities)
  const entities = buildSceneGraph(app);

  // DEBUG: frustum corner markers — remove when measurements confirmed
  const frustumMarkers = createFrustumMarkers(app, entities.camera);

  // 3. Create status overlay for messages
  const { setStatusText } = createStatusOverlay(app);

  // 4. Create and start XState scene state machine
  const sceneActor = createSceneMachineActor(entities);
  sceneActor.start();

  // 5. Wire PlayCanvas update loop — emulator tick + texture update + tweens
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
      updateBorderColor(entities.borderMaterial, wasm);
    }

    // Update scene transition tweens
    updateTweens(dt);

    // Update codex spin interaction
    entities.codexInteraction.update(dt);
    frustumMarkers.update(dt);
  });

  // 6. Wire global status function for media modules
  setGlobalStatusFn(setStatusText);

  // 7. Load WASM and ROM
  await initWasm(setStatusText);

  // 8. Initialize input system + wire state machine actor
  initInputBridge(app, entities);
  setSceneActor(sceneActor);

  // Track menu open/close state for input routing + debug logging
  sceneActor.subscribe((state) => {
    const isMenu = state.value === 'menuPortrait' || state.value === 'menuLandscape';
    setMenuOpen(isMenu);
    console.log(`[SceneMachine] state: ${String(state.value)} | context:`, {
      lastPortrait: state.context.lastPortraitScene,
      orientation: state.context.orientation,
      previousScene: state.context.previousScene,
    });
  });

  // 9. Initialize file handling (drag-drop + hidden file input)
  initFileHandler();

  // 10. Set initial viewport params for responsive layouts
  function updateViewport(): void {
    const canvas = app.graphicsDevice.canvas;
    const aspect = canvas.clientWidth / canvas.clientHeight;
    setViewportParams(45, aspect); // FOV matches camera
  }
  updateViewport();

  // 11. Detect initial orientation and send to state machine
  const orientation = window.innerHeight > window.innerWidth ? 'portrait' : 'landscape';
  console.log(`[SceneMachine] initial orientation: ${orientation}`);
  if (orientation === 'landscape') {
    sceneActor.send({ type: 'ORIENTATION_CHANGE', orientation: 'landscape' });
  }

  // 12. Listen for resize — update viewport params + snap positions + check orientation
  let currentOrientation = orientation;
  window.addEventListener('resize', () => {
    updateViewport();
    snapToCurrentScene(); // instantly reposition for new viewport

    const newOrientation = window.innerHeight > window.innerWidth ? 'portrait' : 'landscape';
    if (newOrientation !== currentOrientation) {
      console.log(`[SceneMachine] orientation change: ${currentOrientation} → ${newOrientation}`);
      currentOrientation = newOrientation;
      sceneActor.send({ type: 'ORIENTATION_CHANGE', orientation: newOrientation });
    }
  });
}

main().catch(console.error);
