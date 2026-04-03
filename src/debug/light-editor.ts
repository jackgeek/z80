// Developer-only light editor — floating panel + PlayCanvas gizmos.
// Activation: window.__le() (registered in main.ts, DEV only).

import * as pc from 'playcanvas';

interface LightState {
  name: string;
  type: 'directional' | 'point' | 'spot';
  color: pc.Color;
  intensity: number;
  // point/spot only:
  position: pc.Vec3;
  range: number;
  // directional only:
  eulerAngles: pc.Vec3;
  // runtime refs — not exported:
  entity: pc.Entity;
  gizmoEntity: pc.Entity | null;
  // panel input refs — for gizmo→panel sync:
  _xIn?: HTMLInputElement;
  _yIn?: HTMLInputElement;
  _zIn?: HTMLInputElement;
}

export type EditorMode = 'light' | 'camera';

/** Read existing lights from the "Lighting" entity in the scene. */
function readLightsFromScene(app: pc.Application): LightState[] {
  const lightingEntity = app.root.findByName('Lighting');
  if (!lightingEntity) return [];

  const states: LightState[] = [];
  for (const child of lightingEntity.children) {
    const lc = (child as pc.Entity).light;
    if (!lc) continue;
    const entity = child as pc.Entity;
    const type = lc.type as 'directional' | 'point' | 'spot';
    const pos = entity.getLocalPosition();
    const euler = entity.getLocalEulerAngles();
    states.push({
      name: entity.name,
      type,
      color: lc.color.clone(),
      intensity: lc.intensity,
      position: pos.clone(),
      range: (lc as any).range ?? 10,
      eulerAngles: euler.clone(),
      entity,
      gizmoEntity: null,
    });
  }
  return states;
}

export function createLightEditor(app: pc.Application): void {
  const lights: LightState[] = readLightsFromScene(app);
  // Panel, gizmos, and event listeners added in subsequent tasks.
  console.log('[LightEditor] opened with', lights.length, 'lights');
}
