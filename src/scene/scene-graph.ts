// Scene graph builder — creates camera, lights, and all 3D entities

import * as pc from 'playcanvas';
import { createMonitor, type MonitorResult } from '../entities/monitor.js';
import { createKeyboard3D, type Keyboard3DResult } from '../entities/keyboard3d.js';
import { createJoystick3D, type Joystick3DResult } from '../entities/joystick3d.js';
import { createFireButton, type FireButtonResult } from '../entities/fire-button.js';
import { createMenuButton, type MenuButtonResult } from '../entities/menu-button.js';
import { createMenuCodex, type MenuCodexResult } from '../entities/menu-codex.js';
import { CodexInteraction } from '../input/codex-interaction.js';

export interface SceneEntities {
  camera: pc.Entity;
  monitor: pc.Entity;
  screenQuad: pc.Entity;
  screenTexture: pc.Texture;
  keyboard: pc.Entity;
  keys: Map<string, pc.Entity>;
  joystick: pc.Entity;
  joystickStick: pc.Entity;
  fireButton: pc.Entity;
  fireButtonCap: pc.Entity;
  menuButton: pc.Entity;
  menuCodex: pc.Entity;
  codexInteraction: CodexInteraction;
}

export function buildSceneGraph(app: pc.Application): SceneEntities {
  // ── Camera ────────────────────────────────────────────────────────────────
  const cameraRig = new pc.Entity('CameraRig');
  const camera = new pc.Entity('MainCamera');
  camera.addComponent('camera', {
    fov: 45,
    nearClip: 0.1,
    farClip: 100,
    clearColor: new pc.Color(0.53, 0.68, 0.82),
  });
  camera.setLocalPosition(0, 0, 7);
  cameraRig.addChild(camera);
  app.root.addChild(cameraRig);

  // ── Lighting ──────────────────────────────────────────────────────────────
  const lighting = new pc.Entity('Lighting');

  // Key light — warm directional from top-front-right
  const keyLight = new pc.Entity('KeyLight');
  keyLight.addComponent('light', {
    type: 'directional',
    color: new pc.Color(1.0, 0.95, 0.85),
    intensity: 1.2,
    castShadows: false,
  });
  keyLight.setLocalEulerAngles(35, 20, 0);
  lighting.addChild(keyLight);

  // Fill light — cool from left to soften shadows
  const fillLight = new pc.Entity('FillLight');
  fillLight.addComponent('light', {
    type: 'directional',
    color: new pc.Color(0.7, 0.75, 1.0),
    intensity: 0.5,
    castShadows: false,
  });
  fillLight.setLocalEulerAngles(-20, -40, 0);
  lighting.addChild(fillLight);

  // Rim light — amber accent from behind/above
  const rimLight = new pc.Entity('RimLight');
  rimLight.addComponent('light', {
    type: 'point',
    color: new pc.Color(1.0, 0.85, 0.5),
    intensity: 0.8,
    range: 25,
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
  // Tilt keyboard toward camera so key faces are visible and clickable
  const kbResult: Keyboard3DResult = createKeyboard3D(app);
  kbResult.keyboardEntity.setLocalPosition(0, -1.6, 0.5);
  kbResult.keyboardEntity.setLocalEulerAngles(65, 0, 0);
  kbResult.keyboardEntity.setLocalScale(0.65, 0.65, 0.65);
  app.root.addChild(kbResult.keyboardEntity);

  // ── Joystick ──────────────────────────────────────────────────────────────
  const joyResult: Joystick3DResult = createJoystick3D(app);
  joyResult.joystickEntity.setLocalPosition(-2.2, -2.8, 0);
  joyResult.joystickEntity.setLocalScale(0.6, 0.6, 0.6);
  app.root.addChild(joyResult.joystickEntity);

  // ── Fire Button ───────────────────────────────────────────────────────────
  const fireResult: FireButtonResult = createFireButton(app);
  fireResult.fireEntity.setLocalPosition(2.2, -2.8, 0);
  fireResult.fireEntity.setLocalScale(0.6, 0.6, 0.6);
  app.root.addChild(fireResult.fireEntity);

  // ── Menu Button ───────────────────────────────────────────────────────────
  const menuResult: MenuButtonResult = createMenuButton(app);
  menuResult.menuButtonEntity.setLocalPosition(0, -2.8, 0);
  menuResult.menuButtonEntity.setLocalScale(0.6, 0.6, 0.6);
  app.root.addChild(menuResult.menuButtonEntity);

  // ── Menu Codex ─────────────────────────────────────────────────────────
  const codexResult: MenuCodexResult = createMenuCodex(app);
  codexResult.codexEntity.setLocalPosition(0, 0, -8);
  app.root.addChild(codexResult.codexEntity);
  const codexInteraction = new CodexInteraction(codexResult);

  return {
    camera,
    monitor: monitorResult.monitorEntity,
    screenQuad: monitorResult.screenQuad,
    screenTexture: monitorResult.screenTexture,
    keyboard: kbResult.keyboardEntity,
    keys: kbResult.keys,
    joystick: joyResult.joystickEntity,
    joystickStick: joyResult.joystickStick,
    fireButton: fireResult.fireEntity,
    fireButtonCap: fireResult.fireButtonCap,
    menuButton: menuResult.menuButtonEntity,
    menuCodex: codexResult.codexEntity,
    codexInteraction,
  };
}
