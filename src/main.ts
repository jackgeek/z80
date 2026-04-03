// ZX Spectrum 48K Emulator — Steam-Punk 3D UI Entry Point

import { initPlayCanvasApp } from './scene/app.js';
import { buildSceneGraph } from './scene/scene-graph.js';
import { createStatusOverlay } from './ui/status-overlay.js';
import { initWasm } from './emulator/wasm-loader.js';
import { tickEmulatorFrame } from './emulator/frame-loop.js';
import { updateMonitorTexture, updateBorderColor } from './entities/monitor.js';
import { getWasm, getMemory, isRunning, isRomLoaded } from './emulator/state.js';
import { initInputBridge, setSceneActor, setMenuController, setJoystickTypeCallback } from './input/input-bridge.js';
import { JoystickOverlay } from './input/joystick-overlay.js';
import { setGlobalStatusFn } from './ui/status-bridge.js';
import { initFileHandler } from './ui/file-handler.js';
import { createSceneMachineActor } from './state-machine/machine.js';
import { updateTweens, setViewportParams, snapToCurrentScene } from './scene/scene-transitions.js';
import { createFrustumMarkers } from './debug/frustum-markers.js';
import { MenuController } from './ui/menu-controller.js';
import { captureZ80, loadZ80 } from './media/snapshot.js';
import * as db from './data/db.js';

const FRAME_INTERVAL = 1000 / 50;

async function main(): Promise<void> {
  // 1. Create PlayCanvas application
  const app = initPlayCanvasApp();

  // 2. Build 3D scene graph
  const entities = buildSceneGraph(app);

  // DEBUG: frustum corner markers — remove when measurements confirmed
  const frustumMarkers = createFrustumMarkers(app, entities.camera);

  // 3. Create status overlay
  const { setStatusText } = createStatusOverlay(app);

  // 4. Create and start XState scene state machine
  const sceneActor = createSceneMachineActor(entities);
  sceneActor.start();

  // 5. Wire PlayCanvas update loop
  let frameAccum = 0;

  app.on('update', (dt: number) => {
    frameAccum += dt * 1000;

    while (frameAccum >= FRAME_INTERVAL) {
      frameAccum -= FRAME_INTERVAL;
      tickEmulatorFrame();
    }

    const wasm = getWasm();
    const memory = getMemory();
    if (wasm && memory && isRunning()) {
      updateMonitorTexture(entities.screenTexture, memory, wasm);
      updateBorderColor(entities.borderMaterial, wasm);
    }

    updateTweens(dt);
    frustumMarkers.update(dt);
    updateJoystickPositions();
  });

  // 6. Wire global status function
  setGlobalStatusFn(setStatusText);

  // 7. Load WASM and ROM
  await initWasm(setStatusText);

  // 8. Initialize input system + wire state machine actor
  initInputBridge(app, entities);
  setSceneActor(sceneActor);

  // 8b. Create joystick/fire HTML overlay and keep it aligned with 3D entities
  const joystickOverlay = new JoystickOverlay();
  setJoystickTypeCallback((type) => joystickOverlay.setJoystickType(type));
  function updateJoystickPositions(): void {
    joystickOverlay.updatePositions(app, entities.camera, entities.joystick, entities.fireButton);
  }

  // 9. Create MenuController and wire into input-bridge
  const menuController = new MenuController();
  setMenuController(menuController);

  // 10. Track menu state via state machine
  sceneActor.subscribe((state: any) => {
    console.log(`[SceneMachine] state: ${String(state.value)} | context:`, {
      lastPortrait: state.context.lastPortraitScene,
      orientation: state.context.orientation,
      previousScene: state.context.previousScene,
    });
  });

  // 11. Initialize file handling (drag-drop + hidden file input)
  initFileHandler();

  // 12. Set initial viewport params
  function updateViewport(): void {
    const canvas = app.graphicsDevice.canvas;
    const aspect = canvas.clientWidth / canvas.clientHeight;
    setViewportParams(45, aspect);
  }
  updateViewport();

  // 13. Detect initial orientation
  const orientation = window.innerHeight > window.innerWidth ? 'portrait' : 'landscape';
  console.log(`[SceneMachine] initial orientation: ${orientation}`);
  if (orientation === 'landscape') {
    sceneActor.send({ type: 'ORIENTATION_CHANGE', orientation: 'landscape' });
  }

  // 14. Listen for resize
  let currentOrientation = orientation;
  window.addEventListener('resize', () => {
    updateViewport();
    snapToCurrentScene();
    const newOrientation = window.innerHeight > window.innerWidth ? 'portrait' : 'landscape';
    if (newOrientation !== currentOrientation) {
      console.log(`[SceneMachine] orientation change: ${currentOrientation} → ${newOrientation}`);
      currentOrientation = newOrientation;
      sceneActor.send({ type: 'ORIENTATION_CHANGE', orientation: newOrientation });
    }
  });

  // 15. Session restore — load previous session state from IndexedDB
  const savedImage = await db.loadCurrentImage();
  if (savedImage) {
    loadZ80(savedImage);
    console.log('[Session] Restored previous session.');
  }

  // 16. Auto-save session state on page unload
  window.addEventListener('beforeunload', () => {
    if (isRomLoaded()) {
      const data = captureZ80();
      if (data.byteLength > 0) {
        void db.saveCurrentImage(data);
      }
    }
  });

  // DEV: light editor — open with __le() in the browser console
  if (import.meta.env.DEV) {
    const { createLightEditor } = await import('./debug/light-editor.js');
    (window as any).__le = () => createLightEditor(app);
  }
}

main().catch(console.error);
