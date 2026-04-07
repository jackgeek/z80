// Scene graph builder — creates camera, lights, and all 3D entities

import * as pc from "playcanvas";
import { createMonitor, type MonitorResult } from "../entities/monitor.js";
import {
  createKeyboard3D,
  type Keyboard3DResult,
} from "../entities/keyboard3d.js";
import {
  createJoystick3D,
  type Joystick3DResult,
} from "../entities/joystick3d.js";
import {
  createFireButton,
  type FireButtonResult,
} from "../entities/fire-button.js";
import {
  createMenuButton,
  type MenuButtonResult,
} from "../entities/menu-button.js";

export interface SceneEntities {
  camera: pc.Entity;
  monitor: pc.Entity;
  screenQuad: pc.Entity;
  screenTexture: pc.Texture;
  borderTexture: pc.Texture;
  keyboard: pc.Entity;
  keys: Map<string, pc.Entity>;
  pressKey3D: (index: number, down: boolean) => void;
  joystick: pc.Entity;
  joystickStick: pc.Entity;
  fireButton: pc.Entity;
  fireButtonCap: pc.Entity;
  menuButton: pc.Entity;
}

export function buildSceneGraph(app: pc.Application): SceneEntities {
  // ── Camera ────────────────────────────────────────────────────────────────
  const cameraRig = new pc.Entity("CameraRig");
  const camera = new pc.Entity("MainCamera");
  camera.addComponent("camera", {
    fov: 45,
    nearClip: 0.1,
    farClip: 100,
    clearColor: new pc.Color(0.53, 0.68, 0.82),
  });
  camera.setLocalPosition(0, 0, 7);
  cameraRig.addChild(camera);
  app.root.addChild(cameraRig);

  // ── Lighting ──────────────────────────────────────────────────────────────
  const lighting = new pc.Entity("Lighting");

  const keyLight = new pc.Entity("KeyLight");
  keyLight.addComponent("light", {
    type: "directional",
    color: new pc.Color(0.555, 0.14, 0.982),
    intensity: 1.605,
    castShadows: false,
  });
  keyLight.setLocalEulerAngles(32.41, -30.838, 0);
  lighting.addChild(keyLight);

  const fillLight = new pc.Entity("FillLight");
  fillLight.addComponent("light", {
    type: "directional",
    color: new pc.Color(0.669, 0.804, 0.347),
    intensity: 0.423,
    castShadows: false,
  });
  fillLight.setLocalEulerAngles(-49.673, 18.126, 0);
  lighting.addChild(fillLight);

  const rimLight = new pc.Entity("RimLight");
  rimLight.addComponent("light", {
    type: "point",
    color: new pc.Color(0.313, 0.633, 0.822),
    intensity: 1.489,
    castShadows: false,
    range: 25,
  });
  rimLight.setLocalPosition(-3.772, -2.078, 8.335);
  lighting.addChild(rimLight);

  const keyboardLightL = new pc.Entity("KeyboardLightL");
  keyboardLightL.addComponent("light", {
    type: "point",
    color: new pc.Color(0.305, 0.36, 0.769),
    intensity: 3.438,
    castShadows: false,
    range: 25,
  });
  keyboardLightL.setLocalPosition(4.196, 3.188, 8.841);
  lighting.addChild(keyboardLightL);

  const keyboardLightR = new pc.Entity("KeyboardLightR");
  keyboardLightR.addComponent("light", {
    type: "point",
    color: new pc.Color(0.803, 0.409, 0.269),
    intensity: 3.943,
    castShadows: false,
    range: 50,
  });
  keyboardLightR.setLocalPosition(-2.475, -0.777, 12.715);
  lighting.addChild(keyboardLightR);

  app.root.addChild(lighting);

  // ── Monitor ───────────────────────────────────────────────────────────────
  const monitorResult: MonitorResult = createMonitor(app);
  monitorResult.monitorEntity.setLocalPosition(0, 0.8, 0);
  app.root.addChild(monitorResult.monitorEntity);

  // ── Keyboard ──────────────────────────────────────────────────────────────
  // GLB lies flat (XZ plane, surface +Y). Rotate +90° on X so the +Y surface
  // maps to +Z (toward camera), giving a top-down view. Scale to monitor width.
  const kbResult: Keyboard3DResult = createKeyboard3D(app);
  kbResult.keyboardEntity.setLocalPosition(0, -1.6, 0);
  app.root.addChild(kbResult.keyboardEntity);

  // ── Joystick ──────────────────────────────────────────────────────────────
  const joyResult: Joystick3DResult = createJoystick3D(app);
  joyResult.joystickEntity.setLocalPosition(-2.0, -2.5, 0);
  joyResult.joystickEntity.setLocalScale(0.5, 0.5, 0.5);
  app.root.addChild(joyResult.joystickEntity);

  // ── Fire Button ───────────────────────────────────────────────────────────
  const fireResult: FireButtonResult = createFireButton(app);
  fireResult.fireEntity.setLocalPosition(2.0, -2.5, 0);
  fireResult.fireEntity.setLocalScale(0.5, 0.5, 0.5);
  app.root.addChild(fireResult.fireEntity);

  // ── Menu Button ───────────────────────────────────────────────────────────
  const menuResult: MenuButtonResult = createMenuButton(app);
  menuResult.menuButtonEntity.setLocalPosition(0, -2.5, 0);
  menuResult.menuButtonEntity.setLocalScale(0.5, 0.5, 0.5);
  app.root.addChild(menuResult.menuButtonEntity);

  return {
    camera,
    monitor: monitorResult.monitorEntity,
    screenQuad: monitorResult.screenQuad,
    screenTexture: monitorResult.screenTexture,
    borderTexture: monitorResult.borderTexture,
    keyboard: kbResult.keyboardEntity,
    keys: kbResult.keys,
    pressKey3D: kbResult.pressKey,
    joystick: joyResult.joystickEntity,
    joystickStick: joyResult.joystickStick,
    fireButton: fireResult.fireEntity,
    fireButtonCap: fireResult.fireButtonCap,
    menuButton: menuResult.menuButtonEntity,
  };
}
