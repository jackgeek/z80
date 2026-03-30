// Unified input routing — physical keyboard + 3D entity click/touch → WASM

import * as pc from 'playcanvas';
import { KEY_MAP, COMPOUND_KEYS } from './keyboard.js';
import { ROW_BIT_TO_KEY_INDEX } from '../data/key-layout.js';
import { getWasm, isRunning } from '../emulator/state.js';
import { initAudio } from '../audio/audio.js';
import { GestureDetector } from './gesture-detector.js';
import { interpolateScenes, getCurrentScene, transitionToScene } from '../scene/scene-transitions.js';
import type { SceneEntities } from '../scene/scene-graph.js';
import type { MenuController } from '../ui/menu-controller.js';

let audioInitialized = false;

function ensureAudio(): void {
  if (!audioInitialized) {
    initAudio();
    audioInitialized = true;
  }
}

// Sticky modifier state
let capsLatched = false;
let symLatched = false;

// Joystick state
export type JoystickType = 'sinclair1' | 'cursor' | 'kempston';
let joystickType: JoystickType = 'sinclair1';
let joystickActive = false;
let joystickDownX = 0;
let joystickDownY = 0;
let currentJoyDir: 'left' | 'right' | 'up' | 'down' | null = null;
let kempstonByte = 0;
let firePressed = false;

const JOYSTICK_FIRE: Record<JoystickType, { row: number; bit: number }> = {
  sinclair1: { row: 4, bit: 0x01 },
  cursor:    { row: 4, bit: 0x01 },
  kempston:  { row: 4, bit: 0x01 },
};

export function setJoystickType(type: JoystickType): void {
  joystickType = type;
}

export function getJoystickType(): JoystickType {
  return joystickType;
}

// State machine actor reference — set after creation
let sceneActor: any = null;

export function setSceneActor(actor: any): void {
  sceneActor = actor;
}

function sendScene(event: Record<string, unknown>): void {
  if (!sceneActor) return;
  console.log(`[SceneMachine] → send:`, event);
  sceneActor.send(event);
}

const gestureDetector = new GestureDetector();

// Whether the menu is currently open (set by MenuController)
let menuOpen = false;

export function setMenuOpen(open: boolean): void {
  menuOpen = open;
}

// MenuController reference — set by main.ts after construction
let menuController: MenuController | null = null;

export function setMenuController(ctrl: MenuController): void {
  menuController = ctrl;
}

export function initInputBridge(app: pc.Application, entities: SceneEntities): void {
  // ── Physical keyboard input ─────────────────────────────────────────────
  window.addEventListener('keydown', (e: KeyboardEvent) => {
    const tag = (e.target as HTMLElement).tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;

    ensureAudio();

    // While menu is open, MenuPanel handles its own keyboard in capture phase
    if (menuOpen) return;

    const wasm = getWasm();
    if (!wasm || !isRunning()) return;

    if (e.metaKey) return;

    const compound = COMPOUND_KEYS[e.code];
    if (compound) {
      e.preventDefault();
      for (const k of compound) {
        wasm.keyDown(k.row, k.bit);
        const idx = ROW_BIT_TO_KEY_INDEX[`${k.row},${k.bit}`];
        if (idx !== undefined) entities.pressKey3D(idx, true);
      }
      return;
    }

    const mapping = KEY_MAP[e.code];
    if (mapping) {
      e.preventDefault();
      wasm.keyDown(mapping.row, mapping.bit);
      const idx = ROW_BIT_TO_KEY_INDEX[`${mapping.row},${mapping.bit}`];
      if (idx !== undefined) entities.pressKey3D(idx, true);
    }
  });

  window.addEventListener('keyup', (e: KeyboardEvent) => {
    const wasm = getWasm();
    if (!wasm) return;

    const tag = (e.target as HTMLElement).tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;

    if (e.code === 'MetaLeft' || e.code === 'MetaRight') {
      releaseAllKeys();
      return;
    }

    const compound = COMPOUND_KEYS[e.code];
    if (compound) {
      e.preventDefault();
      for (const k of compound) {
        wasm.keyUp(k.row, k.bit);
        const idx = ROW_BIT_TO_KEY_INDEX[`${k.row},${k.bit}`];
        if (idx !== undefined) entities.pressKey3D(idx, false);
      }
      return;
    }

    const mapping = KEY_MAP[e.code];
    if (mapping) {
      e.preventDefault();
      wasm.keyUp(mapping.row, mapping.bit);
      const idx = ROW_BIT_TO_KEY_INDEX[`${mapping.row},${mapping.bit}`];
      if (idx !== undefined) entities.pressKey3D(idx, false);
    }
  });

  function releaseAllKeys(): void {
    const wasm = getWasm();
    if (!wasm) return;
    const seen = new Set<string>();
    const allMappings: Array<{ row: number; bit: number }> = [
      ...Object.values(KEY_MAP),
      ...Object.values(COMPOUND_KEYS).flat(),
    ];
    for (const k of allMappings) {
      const key = `${k.row},${k.bit}`;
      if (seen.has(key)) continue;
      seen.add(key);
      wasm.keyUp(k.row, k.bit);
      const idx = ROW_BIT_TO_KEY_INDEX[key];
      if (idx !== undefined) entities.pressKey3D(idx, false);
    }
    releaseHeldKey();
  }

  window.addEventListener('blur', releaseAllKeys);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) releaseAllKeys();
  });

  // ── 3D entity click/touch input ─────────────────────────────────────────
  const canvas = app.graphicsDevice.canvas;
  const camera = entities.camera;

  const pressedKeys = new Set<string>();
  let heldSpectrumKey: { row: number; bit: number; keyIndex: number | undefined } | null = null;

  function releaseJoyDir(): void {
    if (!currentJoyDir) return;
    const wasm = getWasm();
    if (!wasm) { currentJoyDir = null; return; }
    const type = joystickType;
    if (type === 'kempston') {
      kempstonByte = 0;
      wasm.setKempston(0);
    } else if (type === 'sinclair1') {
      const sinclair1Map: Record<string, { row: number; bit: number }> = {
        left:  { row: 4, bit: 0x10 },
        right: { row: 4, bit: 0x08 },
        down:  { row: 4, bit: 0x04 },
        up:    { row: 4, bit: 0x02 },
      };
      const k = sinclair1Map[currentJoyDir];
      if (k) wasm.keyUp(k.row, k.bit);
    } else {
      // cursor — release Caps shift + direction key
      wasm.keyUp(0, 0x01);
      const cursorMap: Record<string, { row: number; bit: number }> = {
        left:  { row: 3, bit: 0x10 },
        right: { row: 4, bit: 0x04 },
        down:  { row: 4, bit: 0x10 },
        up:    { row: 4, bit: 0x08 },
      };
      const k = cursorMap[currentJoyDir];
      if (k) wasm.keyUp(k.row, k.bit);
    }
    currentJoyDir = null;
  }

  function pressJoyDir(dir: 'left' | 'right' | 'up' | 'down'): void {
    const wasm = getWasm();
    if (!wasm) return;
    const type = joystickType;
    if (type === 'kempston') {
      const bits: Record<string, number> = { right: 0x01, left: 0x02, down: 0x04, up: 0x08 };
      kempstonByte = bits[dir] ?? 0;
      wasm.setKempston(kempstonByte);
    } else if (type === 'sinclair1') {
      const sinclair1Map: Record<string, { row: number; bit: number }> = {
        left:  { row: 4, bit: 0x10 },
        right: { row: 4, bit: 0x08 },
        down:  { row: 4, bit: 0x04 },
        up:    { row: 4, bit: 0x02 },
      };
      const k = sinclair1Map[dir];
      if (k) wasm.keyDown(k.row, k.bit);
    } else {
      // cursor — Caps shift + direction key
      wasm.keyDown(0, 0x01);
      const cursorMap: Record<string, { row: number; bit: number }> = {
        left:  { row: 3, bit: 0x10 },
        right: { row: 4, bit: 0x04 },
        down:  { row: 4, bit: 0x10 },
        up:    { row: 4, bit: 0x08 },
      };
      const k = cursorMap[dir];
      if (k) wasm.keyDown(k.row, k.bit);
    }
    currentJoyDir = dir;
  }

  function releaseHeldKey(): void {
    if (!heldSpectrumKey) return;
    const wasm = getWasm();
    if (wasm) {
      wasm.keyUp(heldSpectrumKey.row, heldSpectrumKey.bit);
      if (heldSpectrumKey.keyIndex !== undefined) {
        entities.pressKey3D(heldSpectrumKey.keyIndex, false);
      }
    }
    heldSpectrumKey = null;
  }

  function pressSpectrumKey(screenX: number, screenY: number): void {
    const wasm = getWasm();
    if (!wasm || !isRunning()) return;
    ensureAudio();
    const hit = raycastFromScreen(app, camera, screenX, screenY);
    if (!hit?.tags.has('spectrum-key')) return;

    const row = (hit as any)._specRow as number;
    const bit = (hit as any)._specBit as number;
    const sticky = (hit as any)._sticky as boolean;
    const label = (hit as any)._label as string;
    const keyIndex = (hit as any)._specKeyIndex as number | undefined;

    if (sticky) {
      if (label.startsWith('CAPS')) {
        capsLatched = !capsLatched;
        if (capsLatched) wasm.keyDown(row, bit); else wasm.keyUp(row, bit);
        if (keyIndex !== undefined) entities.pressKey3D(keyIndex, capsLatched);
      } else if (label.startsWith('SYM')) {
        symLatched = !symLatched;
        if (symLatched) wasm.keyDown(row, bit); else wasm.keyUp(row, bit);
        if (keyIndex !== undefined) entities.pressKey3D(keyIndex, symLatched);
      }
    } else {
      wasm.keyDown(row, bit);
      if (keyIndex !== undefined) entities.pressKey3D(keyIndex, true);
      heldSpectrumKey = { row, bit, keyIndex };
    }
  }

  function projectToScreen(entity: pc.Entity): { x: number; y: number } | null {
    const cam = camera.camera!;
    const worldPos = entity.getPosition();
    const screenPos = new pc.Vec3();
    cam.worldToScreen(worldPos, screenPos);
    // screenPos is in CSS pixels from top-left of canvas
    return { x: screenPos.x, y: screenPos.y };
  }

  function hitTestEntity(entity: pc.Entity, screenX: number, screenY: number, radiusPx: number): boolean {
    const proj = projectToScreen(entity);
    if (!proj) return false;
    const dx = screenX - proj.x;
    const dy = screenY - proj.y;
    return dx * dx + dy * dy <= radiusPx * radiusPx;
  }

  function handlePointerDown(screenX: number, screenY: number): void {
    const wasm = getWasm();
    if (!wasm || !isRunning()) return;
    ensureAudio();

    if (menuOpen) {
      const hit = raycastFromScreen(app, camera, screenX, screenY);
      if (!hit) menuController?.close();
      return;
    }

    // 1 inch hit area: 96 CSS px/inch → radius = 48px
    const hitRadius = 48;

    if (hitTestEntity(entities.fireButton, screenX, screenY, hitRadius)) {
      const fireKey = JOYSTICK_FIRE[joystickType];
      wasm.keyDown(fireKey.row, fireKey.bit);
      firePressed = true;
      animateKeyPress(entities.fireButtonCap, true);
      return;
    }

    if (hitTestEntity(entities.menuButton, screenX, screenY, hitRadius)) {
      void menuController?.open();
      return;
    }

    if (hitTestEntity(entities.joystick, screenX, screenY, hitRadius)) {
      joystickActive = true;
      joystickDownX = screenX;
      joystickDownY = screenY;
      return;
    }
  }

  function handlePointerUp(_screenX: number, _screenY: number): void {
    const wasm = getWasm();
    if (!wasm) return;

    if (firePressed) {
      const fireKey = JOYSTICK_FIRE[joystickType];
      wasm.keyUp(fireKey.row, fireKey.bit);
      firePressed = false;
      animateKeyPress(entities.fireButtonCap, false);
    }

    releaseJoyDir();
    joystickActive = false;

    for (const name of pressedKeys) {
      const entity = findEntityByName(app.root, name);
      if (entity && entity.tags.has('spectrum-key')) {
        const row = (entity as any)._specRow as number;
        const bit = (entity as any)._specBit as number;
        const keyIndex = (entity as any)._specKeyIndex as number | undefined;
        wasm.keyUp(row, bit);
        if (keyIndex !== undefined) {
          entities.pressKey3D(keyIndex, false);
        } else {
          animateKeyPress(entity, false);
        }
      }
    }
    pressedKeys.clear();
  }

  // ── Gesture-aware pointer events ──────────────────────────────────────────

  let sceneDragging = false;

  function getSwipeTarget(direction: 'up' | 'down'): string | null {
    const current = getCurrentScene();
    if (current === 'portrait1' && direction === 'up') return 'portrait2';
    if (current === 'portrait1' && direction === 'down') return 'portrait2';
    if (current === 'portrait2' && direction === 'up') return 'portrait1';
    if (current === 'portrait2' && direction === 'down') return 'portrait1';
    return null;
  }

  let pendingDownX = 0;
  let pendingDownY = 0;

  function pointerDown(screenX: number, screenY: number): void {
    pendingDownX = screenX;
    pendingDownY = screenY;

    const screenHit = raycastFromScreen(app, camera, screenX, screenY);
    if (screenHit?.tags.has('screen')) {
      const viewportH = canvas.clientHeight || canvas.height;
      gestureDetector.beginTracking(screenY, viewportH);
    }

    // Always handle joystick/fire/menu/menuClose detection on pointer down
    handlePointerDown(screenX, screenY);

    // Spectrum key press only fires if no control was activated
    if (!joystickActive && !firePressed && !menuOpen) {
      pressSpectrumKey(screenX, screenY);
    }
  }

  function pointerMove(screenX: number, screenY: number): void {
    if (joystickActive) {
      const dx = screenX - joystickDownX;
      const dy = screenY - joystickDownY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 20) {
        releaseJoyDir();
      } else {
        const dir: 'left' | 'right' | 'up' | 'down' =
          Math.abs(dx) >= Math.abs(dy)
            ? (dx < 0 ? 'left' : 'right')
            : (dy < 0 ? 'up' : 'down');
        if (dir !== currentJoyDir) {
          releaseJoyDir();
          pressJoyDir(dir);
        }
      }
      return;
    }

    if (heldSpectrumKey) {
      const dx = screenX - pendingDownX;
      const dy = screenY - pendingDownY;
      if (dx * dx + dy * dy > 64) releaseHeldKey();
    }

    if (gestureDetector.isTracking()) {
      const drag = gestureDetector.updateTracking(screenY);
      if (drag && drag.progress > 0.02) {
        const target = getSwipeTarget(drag.direction);
        if (target) {
          sceneDragging = true;
          interpolateScenes(getCurrentScene(), target, drag.progress, entities);
        }
      }
    }
  }

  function pointerUp(_screenX: number, screenY: number): void {
    releaseHeldKey();

    const result = gestureDetector.endTracking(screenY);
    if (sceneDragging) {
      sceneDragging = false;
      const target = result && getSwipeTarget(result.direction);
      if (result?.commit && target) {
        sendScene({ type: 'SWIPE', direction: result.direction });
        return;
      }
      sendScene({ type: 'SWIPE_CANCEL' });
      const current = getCurrentScene();
      if (sceneActor) transitionToScene(current, entities);
    }

    handlePointerUp(pendingDownX, pendingDownY);
  }

  // Mouse events
  canvas.addEventListener('mousedown', (e: MouseEvent) => { pointerDown(e.offsetX, e.offsetY); });
  canvas.addEventListener('mousemove', (e: MouseEvent) => { pointerMove(e.offsetX, e.offsetY); });
  canvas.addEventListener('mouseup',   (e: MouseEvent) => { pointerUp(e.offsetX, e.offsetY); });

  // Touch events
  canvas.addEventListener('touchstart', (e: TouchEvent) => {
    e.preventDefault();
    const touch = e.changedTouches[0];
    const rect = canvas.getBoundingClientRect();
    pointerDown(touch.clientX - rect.left, touch.clientY - rect.top);
  }, { passive: false });

  canvas.addEventListener('touchmove', (e: TouchEvent) => {
    e.preventDefault();
    const touch = e.changedTouches[0];
    const rect = canvas.getBoundingClientRect();
    pointerMove(touch.clientX - rect.left, touch.clientY - rect.top);
  }, { passive: false });

  canvas.addEventListener('touchend', (e: TouchEvent) => {
    e.preventDefault();
    const touch = e.changedTouches[0];
    const rect = canvas.getBoundingClientRect();
    pointerUp(touch.clientX - rect.left, touch.clientY - rect.top);
  }, { passive: false });

  canvas.addEventListener('touchcancel', () => {
    releaseAllKeys();
    releaseJoyDir();
    joystickActive = false;
    if (firePressed) {
      const wasm = getWasm();
      if (wasm) wasm.keyUp(JOYSTICK_FIRE[joystickType].row, JOYSTICK_FIRE[joystickType].bit);
      firePressed = false;
      animateKeyPress(entities.fireButtonCap, false);
    }
  });
}

// ── Raycasting ─────────────────────────────────────────────────────────────────

function raycastFromScreen(
  app: pc.Application,
  camera: pc.Entity,
  screenX: number,
  screenY: number,
): pc.Entity | null {
  const cam = camera.camera!;
  const from = new pc.Vec3();
  const to = new pc.Vec3();
  cam.screenToWorld(screenX, screenY, cam.nearClip, from);
  cam.screenToWorld(screenX, screenY, cam.farClip, to);

  const ray = new pc.Ray(from, to.sub(from).normalize());
  let closestEntity: pc.Entity | null = null;
  let closestDist = Infinity;

  const KEY_HIT_RADIUS = 0.3;
  let closestPerpDist = KEY_HIT_RADIUS;
  const spectrumKeys = app.root.findByTag('spectrum-key') as pc.Entity[];
  for (const entity of spectrumKeys) {
    const pos = entity.getPosition();
    const toPos = new pc.Vec3().sub2(pos, from);
    const proj = toPos.dot(ray.direction);
    if (proj <= 0) continue;
    const closestPoint = new pc.Vec3().copy(ray.direction).mulScalar(proj).add(from);
    const perpDist = pos.distance(closestPoint);
    if (perpDist < closestPerpDist) {
      closestPerpDist = perpDist;
      closestDist = proj;
      closestEntity = entity;
    }
  }

  const otherTags = ['fire-button', 'menu-button', 'joystick', 'screen'];
  for (const tag of otherTags) {
    const tagEntities = app.root.findByTag(tag) as pc.Entity[];
    for (const entity of tagEntities) {
      const aabb = getEntityAABB(entity);
      const hitPoint = new pc.Vec3();
      if (aabb.intersectsRay(ray, hitPoint)) {
        const dist = from.distance(hitPoint);
        if (dist < closestDist) {
          closestDist = dist;
          closestEntity = entity;
        }
      }
    }
  }

  return closestEntity;
}

function getEntityAABB(entity: pc.Entity): pc.BoundingBox {
  const render = entity.render;
  if (render && render.meshInstances.length > 0) {
    const mesh = render.meshInstances[0].mesh;
    if (mesh) {
      const worldAabb = new pc.BoundingBox();
      worldAabb.setFromTransformedAabb(mesh.aabb, entity.getWorldTransform());
      worldAabb.halfExtents.add(new pc.Vec3(0.05, 0.05, 0.1));
      return worldAabb;
    }
  }
  const pos = entity.getPosition();
  const scale = entity.getLocalScale();
  const parent = entity.parent;
  const parentScale = parent ? parent.getLocalScale() : new pc.Vec3(1, 1, 1);
  const halfExtents = new pc.Vec3(
    (scale.x * parentScale.x) / 2,
    (scale.y * parentScale.y) / 2,
    (scale.z * parentScale.z) / 2,
  );
  return new pc.BoundingBox(pos, halfExtents);
}

function findEntityByName(root: pc.Entity, name: string): pc.Entity | null {
  return root.findByName(name) as pc.Entity | null;
}

function animateKeyPress(entity: pc.Entity, down: boolean): void {
  const pos = entity.getLocalPosition();
  if (down) {
    entity.setLocalPosition(pos.x, pos.y - 0.02, pos.z);
  } else {
    entity.setLocalPosition(pos.x, pos.y + 0.02, pos.z);
  }
}
