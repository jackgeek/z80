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

type EditorMode = 'light' | 'camera';

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
  let mode: EditorMode = 'light';

  // ── Panel ────────────────────────────────────────────────────────────────
  const panel = document.createElement('div');
  Object.assign(panel.style, {
    position: 'fixed',
    top: '16px',
    right: '16px',
    width: '280px',
    background: '#12121e',
    border: '1px solid #333',
    borderRadius: '6px',
    fontFamily: 'monospace',
    fontSize: '12px',
    color: '#ddd',
    zIndex: '9999',
    userSelect: 'none',
    boxShadow: '0 4px 24px rgba(0,0,0,0.6)',
  });

  // Header
  const header = document.createElement('div');
  Object.assign(header.style, {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 10px',
    background: '#1a1a2e',
    borderRadius: '6px 6px 0 0',
    cursor: 'grab',
  });
  const headerLabel = document.createElement('span');
  headerLabel.textContent = '💡 Light Editor [LIGHT]';
  const closeBtn = document.createElement('span');
  closeBtn.textContent = '✕';
  Object.assign(closeBtn.style, { cursor: 'pointer', opacity: '0.7' });
  closeBtn.onmouseenter = () => (closeBtn.style.opacity = '1');
  closeBtn.onmouseleave = () => (closeBtn.style.opacity = '0.7');
  header.appendChild(headerLabel);
  header.appendChild(closeBtn);
  panel.appendChild(header);

  document.body.appendChild(panel);

  // Drag
  makeDraggable(panel, header);

  // Destroy
  function destroy(): void {
    panel.remove();
    destroyGizmos();
    removeEventListeners();
  }
  closeBtn.addEventListener('click', destroy);

  // Placeholder — filled in later tasks
  let destroyGizmos: () => void = () => {};
  let removeEventListeners: () => void = () => {};

  console.log('[LightEditor] opened with', lights.length, 'lights');
}

function makeDraggable(panel: HTMLElement, handle: HTMLElement): void {
  let startX = 0, startY = 0, startLeft = 0, startTop = 0;

  handle.addEventListener('mousedown', (e) => {
    e.preventDefault();
    const rect = panel.getBoundingClientRect();
    startX = e.clientX;
    startY = e.clientY;
    startLeft = rect.left;
    startTop = rect.top;
    handle.style.cursor = 'grabbing';

    function onMove(e: MouseEvent): void {
      panel.style.left = startLeft + (e.clientX - startX) + 'px';
      panel.style.top  = startTop  + (e.clientY - startY) + 'px';
      panel.style.right = 'auto';
    }
    function onUp(): void {
      handle.style.cursor = 'grab';
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  });
}
