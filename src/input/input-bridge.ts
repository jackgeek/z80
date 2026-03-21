// Unified input routing — physical keyboard + 3D entity click/touch → WASM

import * as pc from 'playcanvas';
import { KEY_MAP, COMPOUND_KEYS } from './keyboard.js';
import { getWasm, isRunning } from '../emulator/state.js';
import { initAudio } from '../audio/audio.js';
import { GestureDetector } from './gesture-detector.js';
import type { SceneEntities } from '../scene/scene-graph.js';

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
let firePressed = false;

const JOYSTICK_FIRE: Record<JoystickType, { row: number; bit: number }> = {
  sinclair1: { row: 4, bit: 0x01 }, // 0
  cursor:    { row: 4, bit: 0x01 }, // 0
  kempston:  { row: 4, bit: 0x01 }, // placeholder — kempston uses port
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

const gestureDetector = new GestureDetector();

export function initInputBridge(app: pc.Application, entities: SceneEntities): void {
  // ── Physical keyboard input ─────────────────────────────────────────────
  window.addEventListener('keydown', (e: KeyboardEvent) => {
    const wasm = getWasm();
    if (!wasm || !isRunning()) return;

    // Don't intercept if focus is on file input
    const tag = (e.target as HTMLElement).tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;

    ensureAudio();

    const compound = COMPOUND_KEYS[e.code];
    if (compound) {
      e.preventDefault();
      for (const k of compound) wasm.keyDown(k.row, k.bit);
      return;
    }

    const mapping = KEY_MAP[e.code];
    if (mapping) {
      e.preventDefault();
      wasm.keyDown(mapping.row, mapping.bit);
    }
  });

  window.addEventListener('keyup', (e: KeyboardEvent) => {
    const wasm = getWasm();
    if (!wasm || !isRunning()) return;

    const tag = (e.target as HTMLElement).tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;

    const compound = COMPOUND_KEYS[e.code];
    if (compound) {
      e.preventDefault();
      for (const k of compound) wasm.keyUp(k.row, k.bit);
      return;
    }

    const mapping = KEY_MAP[e.code];
    if (mapping) {
      e.preventDefault();
      wasm.keyUp(mapping.row, mapping.bit);
    }
  });

  // ── 3D entity click/touch input ─────────────────────────────────────────
  const canvas = app.graphicsDevice.canvas;
  const camera = entities.camera;

  // Track which keys are currently pressed (by entity name)
  const pressedKeys = new Set<string>();

  function handlePointerDown(screenX: number, screenY: number): void {
    const wasm = getWasm();
    if (!wasm || !isRunning()) return;
    ensureAudio();

    const hit = raycastFromScreen(app, camera, screenX, screenY);
    if (!hit) return;

    // Fire button press
    if (hit.tags.has('fire-button')) {
      const fireKey = JOYSTICK_FIRE[joystickType];
      wasm.keyDown(fireKey.row, fireKey.bit);
      firePressed = true;
      animateKeyPress(entities.fireButtonCap, true);
      return;
    }

    // Menu button press
    if (hit.tags.has('menu-button')) {
      if (sceneActor) sceneActor.send({ type: 'MENU_OPEN' });
      return;
    }

    // Joystick press
    if (hit.tags.has('joystick')) {
      joystickActive = true;
      return;
    }

    // Spectrum key press
    if (hit.tags.has('spectrum-key')) {
      const row = (hit as any)._specRow as number;
      const bit = (hit as any)._specBit as number;
      const sticky = (hit as any)._sticky as boolean;
      const label = (hit as any)._label as string;

      if (sticky) {
        // Toggle sticky modifier
        if (label.startsWith('CAPS')) {
          capsLatched = !capsLatched;
          if (capsLatched) wasm.keyDown(row, bit);
          else wasm.keyUp(row, bit);
        } else if (label.startsWith('SYM')) {
          symLatched = !symLatched;
          if (symLatched) wasm.keyDown(row, bit);
          else wasm.keyUp(row, bit);
        }
      } else {
        wasm.keyDown(row, bit);
        pressedKeys.add(hit.name);
        // Animate key press
        animateKeyPress(hit, true);
      }
    }
  }

  function handlePointerUp(_screenX: number, _screenY: number): void {
    const wasm = getWasm();
    if (!wasm) return;

    // Release fire button
    if (firePressed) {
      const fireKey = JOYSTICK_FIRE[joystickType];
      wasm.keyUp(fireKey.row, fireKey.bit);
      firePressed = false;
      animateKeyPress(entities.fireButtonCap, false);
    }

    // Release joystick
    joystickActive = false;

    // Release all pressed non-sticky keys
    for (const name of pressedKeys) {
      const entity = findEntityByName(app.root, name);
      if (entity && entity.tags.has('spectrum-key')) {
        const row = (entity as any)._specRow as number;
        const bit = (entity as any)._specBit as number;
        wasm.keyUp(row, bit);
        animateKeyPress(entity, false);
      }
    }
    pressedKeys.clear();

    // Auto-unlatch sticky modifiers on next non-modifier press
    // (handled on next keyDown)
  }

  // ── Gesture-aware pointer events ──────────────────────────────────────────

  function pointerDown(screenX: number, screenY: number): void {
    // Start gesture tracking on any swipeable entity
    const hit = raycastFromScreen(app, camera, screenX, screenY);
    gestureDetector.beginTracking(screenX, screenY, hit);
    handlePointerDown(screenX, screenY);
  }

  function pointerUp(screenX: number, screenY: number): void {
    // Check for swipe gesture before handling pointer up
    const swipe = gestureDetector.endTracking(screenX, screenY);
    if (swipe && sceneActor) {
      sceneActor.send({ type: 'SWIPE', direction: swipe.direction });
    } else {
      handlePointerUp(screenX, screenY);
    }
  }

  // Mouse events
  canvas.addEventListener('mousedown', (e: MouseEvent) => {
    pointerDown(e.offsetX, e.offsetY);
  });
  canvas.addEventListener('mouseup', (e: MouseEvent) => {
    pointerUp(e.offsetX, e.offsetY);
  });

  // Touch events
  canvas.addEventListener('touchstart', (e: TouchEvent) => {
    e.preventDefault();
    const touch = e.changedTouches[0];
    const rect = canvas.getBoundingClientRect();
    pointerDown(touch.clientX - rect.left, touch.clientY - rect.top);
  }, { passive: false });

  canvas.addEventListener('touchend', (e: TouchEvent) => {
    e.preventDefault();
    const touch = e.changedTouches[0];
    const rect = canvas.getBoundingClientRect();
    pointerUp(touch.clientX - rect.left, touch.clientY - rect.top);
  }, { passive: false });
}

// ── Raycasting ────────────────────────────────────────────────────────────────

function raycastFromScreen(
  app: pc.Application,
  camera: pc.Entity,
  screenX: number,
  screenY: number
): pc.Entity | null {
  const cam = camera.camera!;
  const from = new pc.Vec3();
  const to = new pc.Vec3();
  cam.screenToWorld(screenX, screenY, cam.nearClip, from);
  cam.screenToWorld(screenX, screenY, cam.farClip, to);

  // Manual ray-entity intersection against all interactive entities
  const ray = new pc.Ray(from, to.sub(from).normalize());
  let closestEntity: pc.Entity | null = null;
  let closestDist = Infinity;

  const tags = ['spectrum-key', 'fire-button', 'menu-button', 'joystick'];
  for (const tag of tags) {
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
  const pos = entity.getPosition();
  const scale = entity.getLocalScale();
  // Account for parent scale
  const parent = entity.parent;
  const parentScale = parent ? parent.getLocalScale() : new pc.Vec3(1, 1, 1);
  const halfExtents = new pc.Vec3(
    (scale.x * parentScale.x) / 2,
    (scale.y * parentScale.y) / 2,
    (scale.z * parentScale.z) / 2
  );
  return new pc.BoundingBox(pos, halfExtents);
}

function findEntityByName(root: pc.Entity, name: string): pc.Entity | null {
  return root.findByName(name) as pc.Entity | null;
}

// ── Key press animation ───────────────────────────────────────────────────────

function animateKeyPress(entity: pc.Entity, down: boolean): void {
  const pos = entity.getLocalPosition();
  if (down) {
    entity.setLocalPosition(pos.x, pos.y - 0.02, pos.z);
  } else {
    entity.setLocalPosition(pos.x, pos.y + 0.02, pos.z);
  }
}
