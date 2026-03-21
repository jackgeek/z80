// Tween-based scene transition engine

import * as pc from 'playcanvas';
import { computeLayout, type EntityLayout } from './scene-layouts.js';
import type { SceneEntities } from './scene-graph.js';

const DEFAULT_DURATION = 600; // ms

// ── Active tween tracking ─────────────────────────────────────────────────────

interface TweenState {
  entity: pc.Entity;
  property: 'position' | 'euler' | 'scale';
  start: [number, number, number];
  end: [number, number, number];
  elapsed: number;
  duration: number;
  onComplete?: () => void;
}

const activeTweens: TweenState[] = [];

function easeInOutSine(t: number): number {
  return -(Math.cos(Math.PI * t) - 1) / 2;
}

// ── Public API ────────────────────────────────────────────────────────────────

// Viewport info needed for responsive layout computation
let _fov = 45;
let _aspect = 1;

export function setViewportParams(fovDeg: number, aspect: number): void {
  _fov = fovDeg;
  _aspect = aspect;
}

// Track current scene so we can recompute positions on resize
let _currentScene = '';
let _entities: SceneEntities | null = null;

export function getCurrentScene(): string { return _currentScene; }

/** Instantly reposition all entities for current scene (no tween). Called on resize. */
export function snapToCurrentScene(): void {
  if (!_currentScene || !_entities) return;
  const layout = computeLayout(_currentScene, _fov, _aspect);
  if (!layout) return;

  const entityMap: Array<{ entity: pc.Entity; target: EntityLayout }> = [
    { entity: _entities.monitor, target: layout.monitor },
    { entity: _entities.keyboard, target: layout.keyboard },
    { entity: _entities.joystick, target: layout.joystick },
    { entity: _entities.fireButton, target: layout.fireButton },
    { entity: _entities.menuButton, target: layout.menuButton },
    { entity: _entities.camera, target: layout.camera },
  ];
  if (_entities.menuCodex) {
    entityMap.push({ entity: _entities.menuCodex, target: layout.menuCodex });
  }

  for (const { entity, target } of entityMap) {
    if (target.visible === true) entity.enabled = true;
    entity.setLocalPosition(target.position[0], target.position[1], target.position[2]);
    entity.setLocalEulerAngles(target.rotation[0], target.rotation[1], target.rotation[2]);
    entity.setLocalScale(target.scale[0], target.scale[1], target.scale[2]);
    if (target.visible === false) entity.enabled = false;
  }
}

export function transitionToScene(
  sceneName: string,
  entities: SceneEntities,
  onComplete?: () => void
): void {
  _currentScene = sceneName;
  _entities = entities;

  const layout = computeLayout(sceneName, _fov, _aspect);
  if (!layout) {
    console.warn(`Unknown scene: ${sceneName}`);
    return;
  }

  // Clear any in-flight tweens
  activeTweens.length = 0;

  const entityMap: Array<{ entity: pc.Entity; target: EntityLayout }> = [
    { entity: entities.monitor, target: layout.monitor },
    { entity: entities.keyboard, target: layout.keyboard },
    { entity: entities.joystick, target: layout.joystick },
    { entity: entities.fireButton, target: layout.fireButton },
    { entity: entities.menuButton, target: layout.menuButton },
    { entity: entities.camera, target: layout.camera },
  ];

  // Add codex if it exists
  if (entities.menuCodex) {
    entityMap.push({ entity: entities.menuCodex, target: layout.menuCodex });
  }

  let completed = 0;
  const total = entityMap.length;

  for (const { entity, target } of entityMap) {
    // Handle visibility: show before tween starts
    if (target.visible === true) {
      entity.enabled = true;
    }

    const completionCallback = () => {
      // Handle visibility: hide after tween ends
      if (target.visible === false) {
        entity.enabled = false;
      }
      completed++;
      if (completed === total && onComplete) {
        onComplete();
      }
    };

    // Position tween
    tweenProperty(entity, 'position', target.position, DEFAULT_DURATION, completionCallback);

    // Rotation tween
    tweenProperty(entity, 'euler', target.rotation, DEFAULT_DURATION);

    // Scale tween
    tweenProperty(entity, 'scale', target.scale, DEFAULT_DURATION);
  }
}

export function updateTweens(dt: number): void {
  for (let i = activeTweens.length - 1; i >= 0; i--) {
    const t = activeTweens[i];
    t.elapsed += dt * 1000;
    const progress = Math.min(t.elapsed / t.duration, 1);
    const eased = easeInOutSine(progress);

    const v0 = t.start;
    const v1 = t.end;
    const x = v0[0] + (v1[0] - v0[0]) * eased;
    const y = v0[1] + (v1[1] - v0[1]) * eased;
    const z = v0[2] + (v1[2] - v0[2]) * eased;

    switch (t.property) {
      case 'position':
        t.entity.setLocalPosition(x, y, z);
        break;
      case 'euler':
        t.entity.setLocalEulerAngles(x, y, z);
        break;
      case 'scale':
        t.entity.setLocalScale(x, y, z);
        break;
    }

    if (progress >= 1) {
      activeTweens.splice(i, 1);
      if (t.onComplete) t.onComplete();
    }
  }
}

// ── Internal ──────────────────────────────────────────────────────────────────

function tweenProperty(
  entity: pc.Entity,
  property: 'position' | 'euler' | 'scale',
  target: [number, number, number],
  duration: number,
  onComplete?: () => void
): void {
  let start: [number, number, number];

  switch (property) {
    case 'position': {
      const p = entity.getLocalPosition();
      start = [p.x, p.y, p.z];
      break;
    }
    case 'euler': {
      const e = entity.getLocalEulerAngles();
      start = [e.x, e.y, e.z];
      break;
    }
    case 'scale': {
      const s = entity.getLocalScale();
      start = [s.x, s.y, s.z];
      break;
    }
  }

  activeTweens.push({
    entity,
    property,
    start,
    end: target,
    elapsed: 0,
    duration,
    onComplete,
  });
}
