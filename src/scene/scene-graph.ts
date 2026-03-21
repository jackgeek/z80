// Scene graph builder — creates camera, lights, and all 3D entities

import * as pc from 'playcanvas';
import { createMonitor, type MonitorResult } from '../entities/monitor.js';
import { createKeyboard3D, type Keyboard3DResult } from '../entities/keyboard3d.js';

export interface SceneEntities {
  camera: pc.Entity;
  monitor: pc.Entity;
  screenQuad: pc.Entity;
  screenTexture: pc.Texture;
  keyboard: pc.Entity;
  keys: Map<string, pc.Entity>;
}

export function buildSceneGraph(app: pc.Application): SceneEntities {
  // ── Camera ────────────────────────────────────────────────────────────────
  const cameraRig = new pc.Entity('CameraRig');
  const camera = new pc.Entity('MainCamera');
  camera.addComponent('camera', {
    fov: 45,
    nearClip: 0.1,
    farClip: 100,
    clearColor: new pc.Color(0.05, 0.04, 0.03),
  });
  camera.setLocalPosition(0, 0, 7);
  cameraRig.addChild(camera);
  app.root.addChild(cameraRig);

  // ── Lighting ──────────────────────────────────────────────────────────────
  const lighting = new pc.Entity('Lighting');

  // Key light — warm directional from top-right
  const keyLight = new pc.Entity('KeyLight');
  keyLight.addComponent('light', {
    type: 'directional',
    color: new pc.Color(1.0, 0.95, 0.85),
    intensity: 0.7,
    castShadows: false,
  });
  keyLight.setLocalEulerAngles(45, 30, 0);
  lighting.addChild(keyLight);

  // Fill light — cool blue from bottom-left
  const fillLight = new pc.Entity('FillLight');
  fillLight.addComponent('light', {
    type: 'directional',
    color: new pc.Color(0.6, 0.7, 1.0),
    intensity: 0.2,
    castShadows: false,
  });
  fillLight.setLocalEulerAngles(-30, -45, 0);
  lighting.addChild(fillLight);

  // Rim light — amber point light behind/above scene
  const rimLight = new pc.Entity('RimLight');
  rimLight.addComponent('light', {
    type: 'point',
    color: new pc.Color(1.0, 0.85, 0.5),
    intensity: 0.4,
    range: 20,
    castShadows: false,
  });
  rimLight.setLocalPosition(0, 4, -3);
  lighting.addChild(rimLight);

  app.root.addChild(lighting);

  // ── Monitor ───────────────────────────────────────────────────────────────
  const monitorResult: MonitorResult = createMonitor(app);
  monitorResult.monitorEntity.setLocalPosition(0, 0.8, 0);
  app.root.addChild(monitorResult.monitorEntity);

  // ── Keyboard ──────────────────────────────────────────────────────────────
  const kbResult: Keyboard3DResult = createKeyboard3D(app);
  kbResult.keyboardEntity.setLocalPosition(0, -1.5, 0);
  kbResult.keyboardEntity.setLocalScale(0.65, 0.65, 0.65);
  app.root.addChild(kbResult.keyboardEntity);

  return {
    camera,
    monitor: monitorResult.monitorEntity,
    screenQuad: monitorResult.screenQuad,
    screenTexture: monitorResult.screenTexture,
    keyboard: kbResult.keyboardEntity,
    keys: kbResult.keys,
  };
}
