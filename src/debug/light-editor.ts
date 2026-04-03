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

  // ── Light list ───────────────────────────────────────────────────────────
  const listSection = document.createElement('div');
  Object.assign(listSection.style, {
    padding: '8px',
    borderBottom: '1px solid #2a2a3e',
  });
  const listLabel = document.createElement('div');
  Object.assign(listLabel.style, {
    fontSize: '10px', textTransform: 'uppercase',
    color: '#666', letterSpacing: '1px', marginBottom: '6px',
  });
  listLabel.textContent = 'Lights';
  listSection.appendChild(listLabel);

  const listRows = document.createElement('div');
  Object.assign(listRows.style, { display: 'flex', flexDirection: 'column', gap: '3px' });
  listSection.appendChild(listRows);
  panel.appendChild(listSection);

  let selectedIndex = 0;
  const rowEls: HTMLElement[] = [];

  function colorToHex(c: pc.Color): string {
    const r = Math.round(Math.clamp(c.r, 0, 1) * 255);
    const g = Math.round(Math.clamp(c.g, 0, 1) * 255);
    const b = Math.round(Math.clamp(c.b, 0, 1) * 255);
    return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
  }

  function buildRow(ls: LightState, i: number): HTMLElement {
    const row = document.createElement('div');
    Object.assign(row.style, {
      display: 'flex', alignItems: 'center', gap: '6px',
      padding: '5px 8px', borderRadius: '4px', cursor: 'pointer',
      border: '1px solid transparent',
    });

    const dot = document.createElement('span');
    dot.textContent = '●';
    dot.style.color = colorToHex(ls.color);

    const nameEl = document.createElement('span');
    nameEl.style.flex = '1';
    nameEl.textContent = ls.name;

    const badge = document.createElement('span');
    Object.assign(badge.style, { fontSize: '10px', color: '#777', marginLeft: '4px' });
    badge.textContent = ls.type === 'directional' ? 'DIR' : ls.type === 'point' ? 'PT' : 'SPOT';

    const eye = document.createElement('span');
    eye.textContent = '👁';
    eye.style.cursor = 'pointer';
    eye.title = 'Toggle visibility';
    eye.addEventListener('click', (e) => {
      e.stopPropagation();
      ls.entity.enabled = !ls.entity.enabled;
      eye.style.opacity = ls.entity.enabled ? '1' : '0.3';
    });

    row.append(dot, nameEl, badge, eye);
    row.addEventListener('click', () => selectLight(i));
    return row;
  }

  function refreshRows(): void {
    rowEls.length = 0;
    listRows.innerHTML = '';
    lights.forEach((ls, i) => {
      const row = buildRow(ls, i);
      rowEls.push(row);
      listRows.appendChild(row);
    });
    listRows.appendChild(buildAddRow());
    highlightRow(selectedIndex);
  }

  function highlightRow(i: number): void {
    rowEls.forEach((r, idx) => {
      r.style.background = idx === i ? '#2a2a4e' : 'transparent';
      r.style.border = idx === i ? '1px solid #4a6fa5' : '1px solid transparent';
    });
  }

  let renderProps: (ls: LightState) => void = () => {};

  function selectLight(i: number): void {
    selectedIndex = i;
    highlightRow(i);
    if (lights[i]) renderProps(lights[i]);
  }

  function buildAddRow(): HTMLElement {
    const row = document.createElement('div');
    Object.assign(row.style, {
      display: 'flex', alignItems: 'center', gap: '6px',
      padding: '5px 8px', borderRadius: '4px', cursor: 'pointer',
      border: '1px dashed #444', marginTop: '2px', color: '#666',
    });
    row.innerHTML = '<span>＋</span><span style="flex:1;font-size:11px">Add light…</span>';

    const typeSelect = document.createElement('select');
    Object.assign(typeSelect.style, {
      fontSize: '11px', background: '#111', color: '#888',
      border: '1px solid #444', borderRadius: '3px',
    });
    ['Point', 'Directional', 'Spot'].forEach(t => {
      const opt = document.createElement('option');
      opt.value = t.toLowerCase();
      opt.textContent = t;
      typeSelect.appendChild(opt);
    });
    typeSelect.addEventListener('click', e => e.stopPropagation());
    row.appendChild(typeSelect);

    row.addEventListener('click', () => {
      addLight(typeSelect.value as 'point' | 'directional' | 'spot');
    });
    return row;
  }

  let addLight: (type: 'point' | 'directional' | 'spot') => void = () => {};

  refreshRows();
  selectLight(0);

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
