// Unified input routing — physical keyboard + 3D entity click/touch → WASM

import * as pc from 'playcanvas';
import { KEY_MAP, COMPOUND_KEYS } from './keyboard.js';
import { ROW_BIT_TO_KEY_INDEX } from '../data/key-layout.js';
import { getWasm, isRunning, isPaused, setPaused, isTurboMode, setTurboMode } from '../emulator/state.js';
import { initAudio } from '../audio/audio.js';
import { resetEmulator } from '../emulator/wasm-loader.js';
import { saveZ80 } from '../media/snapshot.js';
import { triggerFileInput } from '../ui/file-handler.js';
import { showStatus } from '../ui/status-bridge.js';
import { GestureDetector } from './gesture-detector.js';
import { interpolateScenes, getCurrentScene, transitionToScene } from '../scene/scene-transitions.js';
import { CODEX_MENU_ITEMS } from '../entities/menu-codex.js';
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
let codexDragging = false;
let codexDragStartY = 0;
let codexDragMoved = false;

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

function sendScene(event: Record<string, unknown>): void {
  if (!sceneActor) return;
  console.log(`[SceneMachine] → send:`, event);
  sceneActor.send(event);
}

const gestureDetector = new GestureDetector();

// Whether the menu is currently open (tracked via state machine subscription)
let menuOpen = false;

export function setMenuOpen(open: boolean): void {
  menuOpen = open;
}

function handleCodexAction(action: string): void {
  switch (action) {
    case 'LOAD_TAPE':
    case 'LOAD_ROM':
      triggerFileInput();
      sendScene({ type: 'MENU_CLOSE' });
      break;
    case 'SAVE_STATE':
      saveZ80();
      sendScene({ type: 'MENU_CLOSE' });
      break;
    case 'RESET':
      resetEmulator();
      sendScene({ type: 'MENU_CLOSE' });
      break;
    case 'TOGGLE_PAUSE':
      setPaused(!isPaused());
      showStatus(isPaused() ? 'Paused' : 'Resumed');
      sendScene({ type: 'MENU_CLOSE' });
      break;
    case 'TOGGLE_TURBO':
      setTurboMode(!isTurboMode());
      showStatus(isTurboMode() ? 'Turbo ON' : 'Turbo OFF');
      sendScene({ type: 'MENU_CLOSE' });
      break;
    case 'CYCLE_JOYSTICK': {
      const types: JoystickType[] = ['sinclair1', 'cursor', 'kempston'];
      const idx = (types.indexOf(joystickType) + 1) % types.length;
      joystickType = types[idx];
      showStatus(`Joystick: ${joystickType}`);
      sendScene({ type: 'MENU_CLOSE' });
      break;
    }
    case 'MENU_CLOSE':
      sendScene({ type: 'MENU_CLOSE' });
      break;
  }
}

export function initInputBridge(app: pc.Application, entities: SceneEntities): void {
  // ── Physical keyboard input ─────────────────────────────────────────────
  window.addEventListener('keydown', (e: KeyboardEvent) => {
    // Don't intercept if focus is on file input
    const tag = (e.target as HTMLElement).tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;

    ensureAudio();

    // Codex navigation when menu is open
    if (menuOpen) {
      if (e.code === 'ArrowUp') {
        e.preventDefault();
        entities.codexInteraction.stepUp();
        return;
      }
      if (e.code === 'ArrowDown') {
        e.preventDefault();
        entities.codexInteraction.stepDown();
        return;
      }
      if (e.code === 'Enter') {
        e.preventDefault();
        const action = entities.codexInteraction.activate();
        handleCodexAction(action);
        return;
      }
      if (e.code === 'Escape') {
        e.preventDefault();
        sendScene({ type: 'MENU_CLOSE' });
        return;
      }
      return; // Don't process other keys while menu is open
    }

    const wasm = getWasm();
    if (!wasm || !isRunning()) return;

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
    if (!wasm || !isRunning()) return;

    const tag = (e.target as HTMLElement).tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;

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

    // When menu is open: tap on codex interacts, tap elsewhere dismisses
    if (menuOpen) {
      if (hit && hit.tags.has('menu-codex')) {
        codexDragging = true;
        codexDragStartY = screenY;
        codexDragMoved = false;
        entities.codexInteraction.onDragStart(screenY);
      } else {
        sendScene({ type: 'MENU_CLOSE' });
      }
      return;
    }

    if (!hit) return;

    // Codex interaction (fallback — shouldn't reach here when menu is open)
    if (hit.tags.has('menu-codex')) {
      codexDragging = true;
      codexDragStartY = screenY;
      codexDragMoved = false;
      entities.codexInteraction.onDragStart(screenY);
      return;
    }

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
      sendScene({ type: 'MENU_OPEN' });
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

  let sceneDragging = false; // true when user is mid-drag between scenes

  function getSwipeTarget(direction: 'up' | 'down'): string | null {
    const current = getCurrentScene();
    if (current === 'portrait1' && direction === 'up') return 'portrait2';
    if (current === 'portrait1' && direction === 'down') return 'portrait2';
    if (current === 'portrait2' && direction === 'up') return 'portrait1';
    if (current === 'portrait2' && direction === 'down') return 'portrait1';
    return null; // no swipe transition in other states
  }

  // Store pointer down position — only process key/button presses on pointerUp
  // if no scene drag occurred
  let pendingDownX = 0;
  let pendingDownY = 0;

  function pointerDown(screenX: number, screenY: number): void {
    pendingDownX = screenX;
    pendingDownY = screenY;
    const viewportH = canvas.clientHeight || canvas.height;
    gestureDetector.beginTracking(screenY, viewportH);

    // Only handle non-deferrable actions immediately (menu dismiss, codex start)
    if (menuOpen) {
      handlePointerDown(screenX, screenY);
    }
  }

  function pointerMove(screenX: number, screenY: number): void {
    // Codex drag
    if (codexDragging) {
      codexDragMoved = true;
      entities.codexInteraction.onDragMove(screenY);
      return;
    }

    // Scene drag — interpolate between current and target scene
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
    // Codex drag end
    if (codexDragging) {
      codexDragging = false;
      entities.codexInteraction.onDragEnd();
      if (!codexDragMoved) {
        const action = entities.codexInteraction.activate();
        handleCodexAction(action);
      }
      return;
    }

    // Scene drag end — commit or cancel
    const result = gestureDetector.endTracking(screenY);
    if (sceneDragging && result) {
      sceneDragging = false;
      const target = getSwipeTarget(result.direction);
      if (result.commit && target) {
        // Commit: send SWIPE to state machine (which will tween to final position)
        sendScene({ type: 'SWIPE', direction: result.direction });
      } else {
        // Cancel: snap back to current scene
        sendScene({ type: 'SWIPE_CANCEL' });
        // Re-transition to current scene to animate back
        const current = getCurrentScene();
        if (sceneActor) {
          transitionToScene(current, entities);
        }
      }
      return;
    }

    // Normal pointer up (no significant drag) — process deferred key/button press
    sceneDragging = false;
    gestureDetector.endTracking(screenY); // clear tracking state
    handlePointerDown(pendingDownX, pendingDownY);
    handlePointerUp(pendingDownX, pendingDownY);
  }

  // Mouse events
  canvas.addEventListener('mousedown', (e: MouseEvent) => {
    pointerDown(e.offsetX, e.offsetY);
  });
  canvas.addEventListener('mousemove', (e: MouseEvent) => {
    pointerMove(e.offsetX, e.offsetY);
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

  const tags = ['spectrum-key', 'fire-button', 'menu-button', 'joystick', 'menu-codex'];
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
