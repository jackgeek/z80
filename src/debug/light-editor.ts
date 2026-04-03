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
    updateGizmoHighlight();
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

  // ── Properties ───────────────────────────────────────────────────────────
  const propsSection = document.createElement('div');
  Object.assign(propsSection.style, { padding: '10px' });
  panel.appendChild(propsSection);

  function n2(v: number): string { return v.toFixed(2); }

  function row(label: string, ...children: HTMLElement[]): HTMLElement {
    const wrap = document.createElement('div');
    wrap.style.marginBottom = '8px';
    const lbl = document.createElement('div');
    Object.assign(lbl.style, { fontSize: '11px', color: '#888', marginBottom: '3px' });
    lbl.textContent = label;
    wrap.appendChild(lbl);
    children.forEach(c => wrap.appendChild(c));
    return wrap;
  }

  function numInput(val: number, min: number, max: number, step: number, onChange: (v: number) => void): HTMLInputElement {
    const el = document.createElement('input');
    el.type = 'number';
    el.value = String(val);
    el.min = String(min);
    el.max = String(max);
    el.step = String(step);
    Object.assign(el.style, {
      width: '60px', fontSize: '11px', background: '#111',
      color: '#eee', border: '1px solid #444', borderRadius: '3px',
      padding: '3px', textAlign: 'center',
    });
    el.addEventListener('input', () => onChange(parseFloat(el.value) || 0));
    return el;
  }

  function slider(val: number, min: number, max: number, step: number, onChange: (v: number) => void): HTMLInputElement {
    const el = document.createElement('input');
    el.type = 'range';
    el.value = String(val);
    el.min = String(min);
    el.max = String(max);
    el.step = String(step);
    el.style.width = '100%';
    el.addEventListener('input', () => onChange(parseFloat(el.value)));
    return el;
  }

  renderProps = function(ls: LightState): void {
    propsSection.innerHTML = '';

    const title = document.createElement('div');
    Object.assign(title.style, {
      fontSize: '11px', textTransform: 'uppercase', color: '#666',
      letterSpacing: '1px', marginBottom: '10px',
    });
    title.textContent = `${ls.name} — ${ls.type}`;
    propsSection.appendChild(title);

    // Color
    const colorSwatch = document.createElement('input');
    colorSwatch.type = 'color';
    colorSwatch.value = colorToHex(ls.color);
    Object.assign(colorSwatch.style, { width: '28px', height: '28px', border: 'none', cursor: 'pointer', borderRadius: '4px' });

    const rIn = numInput(ls.color.r, 0, 1, 0.01, v => { ls.color.r = v; syncColor(); });
    const gIn = numInput(ls.color.g, 0, 1, 0.01, v => { ls.color.g = v; syncColor(); });
    const bIn = numInput(ls.color.b, 0, 1, 0.01, v => { ls.color.b = v; syncColor(); });

    function syncColor(): void {
      colorSwatch.value = colorToHex(ls.color);
      applyToScene(ls);
      updateGizmoColor(ls);
      const dot = rowEls[selectedIndex]?.querySelector('span');
      if (dot) dot.style.color = colorToHex(ls.color);
    }

    colorSwatch.addEventListener('input', () => {
      const hex = colorSwatch.value;
      ls.color.r = parseInt(hex.slice(1, 3), 16) / 255;
      ls.color.g = parseInt(hex.slice(3, 5), 16) / 255;
      ls.color.b = parseInt(hex.slice(5, 7), 16) / 255;
      rIn.value = n2(ls.color.r);
      gIn.value = n2(ls.color.g);
      bIn.value = n2(ls.color.b);
      applyToScene(ls);
      updateGizmoColor(ls);
    });

    const colorRow = document.createElement('div');
    Object.assign(colorRow.style, { display: 'flex', alignItems: 'center', gap: '6px' });
    colorRow.append(colorSwatch, rIn, gIn, bIn);
    propsSection.appendChild(row('Color', colorRow));

    // Intensity
    const intensityVal = document.createElement('span');
    Object.assign(intensityVal.style, { fontSize: '11px', color: '#eee', float: 'right' });
    intensityVal.textContent = n2(ls.intensity);
    const intensitySlider = slider(ls.intensity, 0, 10, 0.05, v => {
      ls.intensity = v;
      intensityVal.textContent = n2(v);
      applyToScene(ls);
    });
    const intensityLabel = document.createElement('div');
    Object.assign(intensityLabel.style, { fontSize: '11px', color: '#888', marginBottom: '3px', display: 'flex', justifyContent: 'space-between' });
    intensityLabel.append(document.createTextNode('Intensity'), intensityVal);
    const intensityWrap = document.createElement('div');
    intensityWrap.style.marginBottom = '8px';
    intensityWrap.append(intensityLabel, intensitySlider);
    propsSection.appendChild(intensityWrap);

    // Position (point/spot) or Euler angles (directional)
    if (ls.type === 'directional') {
      const xIn = numInput(ls.eulerAngles.x, -180, 180, 0.5, v => { ls.eulerAngles.x = v; applyToScene(ls); updateGizmoTransform(ls); });
      const yIn = numInput(ls.eulerAngles.y, -180, 180, 0.5, v => { ls.eulerAngles.y = v; applyToScene(ls); updateGizmoTransform(ls); });
      const zIn = numInput(ls.eulerAngles.z, -180, 180, 0.5, v => { ls.eulerAngles.z = v; applyToScene(ls); updateGizmoTransform(ls); });
      const xyzRow = document.createElement('div');
      Object.assign(xyzRow.style, { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4px' });

      function labeledInput(label: string, input: HTMLInputElement): HTMLElement {
        const wrap = document.createElement('div');
        const lbl = document.createElement('div');
        Object.assign(lbl.style, { fontSize: '9px', color: '#555', textAlign: 'center' });
        lbl.textContent = label;
        wrap.append(lbl, input);
        return wrap;
      }

      ls._xIn = xIn; ls._yIn = yIn; ls._zIn = zIn;
      xyzRow.append(labeledInput('X', xIn), labeledInput('Y', yIn), labeledInput('Z', zIn));
      propsSection.appendChild(row('Direction (euler °)', xyzRow));
    } else {
      const xIn = numInput(ls.position.x, -20, 20, 0.1, v => { ls.position.x = v; applyToScene(ls); updateGizmoTransform(ls); });
      const yIn = numInput(ls.position.y, -20, 20, 0.1, v => { ls.position.y = v; applyToScene(ls); updateGizmoTransform(ls); });
      const zIn = numInput(ls.position.z, -20, 20, 0.1, v => { ls.position.z = v; applyToScene(ls); updateGizmoTransform(ls); });
      const xyzRow = document.createElement('div');
      Object.assign(xyzRow.style, { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4px' });

      function labeledInput(label: string, input: HTMLInputElement): HTMLElement {
        const wrap = document.createElement('div');
        const lbl = document.createElement('div');
        Object.assign(lbl.style, { fontSize: '9px', color: '#555', textAlign: 'center' });
        lbl.textContent = label;
        wrap.append(lbl, input);
        return wrap;
      }

      ls._xIn = xIn; ls._yIn = yIn; ls._zIn = zIn;
      xyzRow.append(labeledInput('X', xIn), labeledInput('Y', yIn), labeledInput('Z', zIn));
      propsSection.appendChild(row('Position', xyzRow));

      // Range
      const rangeVal = document.createElement('span');
      Object.assign(rangeVal.style, { fontSize: '11px', color: '#eee', float: 'right' });
      rangeVal.textContent = n2(ls.range);
      const rangeSlider = slider(ls.range, 1, 100, 0.5, v => {
        ls.range = v;
        rangeVal.textContent = n2(v);
        applyToScene(ls);
      });
      const rangeLabelRow = document.createElement('div');
      Object.assign(rangeLabelRow.style, { fontSize: '11px', color: '#888', marginBottom: '3px', display: 'flex', justifyContent: 'space-between' });
      rangeLabelRow.append(document.createTextNode('Range'), rangeVal);
      const rangeWrap = document.createElement('div');
      rangeWrap.style.marginBottom = '8px';
      rangeWrap.append(rangeLabelRow, rangeSlider);
      propsSection.appendChild(rangeWrap);
    }

    // Delete
    const delBtn = document.createElement('button');
    delBtn.textContent = 'Delete';
    Object.assign(delBtn.style, {
      width: '100%', fontSize: '11px', background: '#2a1a1a',
      color: '#ff6666', border: '1px solid #662222', borderRadius: '4px',
      padding: '5px', cursor: 'pointer', marginTop: '6px',
    });
    delBtn.addEventListener('click', () => deleteLight(selectedIndex));
    propsSection.appendChild(delBtn);
  };

  // Stubs — replaced in later tasks
  let applyToScene: (ls: LightState) => void = () => {};
  let updateGizmoColor: (ls: LightState) => void = () => {};
  let updateGizmoTransform: (ls: LightState) => void = () => {};
  let deleteLight: (i: number) => void = () => {};

  // ── applyToScene (real implementation) ───────────────────────────────────
  applyToScene = function(ls: LightState): void {
    const lc = ls.entity.light;
    if (!lc) return;
    lc.color = ls.color;
    lc.intensity = ls.intensity;
    if (ls.type !== 'directional') {
      (lc as any).range = ls.range;
      ls.entity.setLocalPosition(ls.position.x, ls.position.y, ls.position.z);
    } else {
      ls.entity.setLocalEulerAngles(ls.eulerAngles.x, ls.eulerAngles.y, ls.eulerAngles.z);
    }
  };

  // ── Footer ───────────────────────────────────────────────────────────────
  const footer = document.createElement('div');
  Object.assign(footer.style, {
    borderTop: '1px solid #2a2a3e', padding: '8px 10px',
    display: 'flex', flexDirection: 'column', gap: '6px',
  });

  const exportBtn = document.createElement('button');
  exportBtn.textContent = 'Copy TS to clipboard';
  Object.assign(exportBtn.style, {
    fontSize: '11px', background: '#1a3a1a', color: '#88ff88',
    border: '1px solid #226622', borderRadius: '4px', padding: '6px', cursor: 'pointer',
  });
  exportBtn.addEventListener('click', () => {
    const ts = generateTypeScript(lights);
    navigator.clipboard.writeText(ts).then(() => {
      exportBtn.textContent = '✓ Copied!';
      setTimeout(() => { exportBtn.textContent = 'Copy TS to clipboard'; }, 2000);
    });
  });
  footer.appendChild(exportBtn);

  const resetCamBtn = document.createElement('button');
  resetCamBtn.textContent = 'Reset camera';
  Object.assign(resetCamBtn.style, {
    fontSize: '11px', background: '#1a1a3a', color: '#8888ff',
    border: '1px solid #224466', borderRadius: '4px', padding: '6px', cursor: 'pointer',
    display: 'none',
  });
  resetCamBtn.addEventListener('click', () => resetCamera());
  footer.appendChild(resetCamBtn);

  panel.appendChild(footer);

  let resetCamera: () => void = () => {};

  document.body.appendChild(panel);

  // Drag
  makeDraggable(panel, header);

  // Destroy
  function destroy(): void {
    panel.remove();
    destroyGizmos();
    removeEventListeners();
  }

  // Placeholder — filled in later tasks
  let destroyGizmos: () => void = () => {};
  let removeEventListeners: () => void = () => {};

  closeBtn.addEventListener('click', destroy);

  // ── Gizmos ───────────────────────────────────────────────────────────────
  const GIZMO_SCALE_NORMAL = new pc.Vec3(0.2, 0.2, 0.2);
  const GIZMO_SCALE_SELECTED = new pc.Vec3(0.28, 0.28, 0.28);
  const GIZMO_DIR_POS = new pc.Vec3(0, 2, 0); // fixed anchor for directional arrows

  function makeEmissiveMaterial(color: pc.Color): pc.StandardMaterial {
    const mat = new pc.StandardMaterial();
    mat.emissive = color.clone();
    mat.emissiveIntensity = 1.5;
    mat.diffuse = new pc.Color(0, 0, 0);
    mat.update();
    return mat;
  }

  let createGizmo: (ls: LightState) => pc.Entity | null = (_ls) => null;

  createGizmo = function(ls: LightState): pc.Entity {
    if (ls.type === 'directional') {
      const arrow = new pc.Entity(`Gizmo_${ls.name}`);

      const body = new pc.Entity('ArrowBody');
      body.addComponent('render', { type: 'cylinder', castShadows: false });
      body.render!.meshInstances[0].material = makeEmissiveMaterial(ls.color);
      body.setLocalScale(0.05, 0.4, 0.05);
      body.setLocalPosition(0, 0.2, 0);
      arrow.addChild(body);

      const tip = new pc.Entity('ArrowTip');
      tip.addComponent('render', { type: 'cone', castShadows: false });
      tip.render!.meshInstances[0].material = makeEmissiveMaterial(ls.color);
      tip.setLocalScale(0.12, 0.2, 0.12);
      tip.setLocalPosition(0, 0.5, 0);
      arrow.addChild(tip);

      arrow.setPosition(GIZMO_DIR_POS.x, GIZMO_DIR_POS.y, GIZMO_DIR_POS.z);
      arrow.setLocalEulerAngles(ls.eulerAngles.x, ls.eulerAngles.y, ls.eulerAngles.z);
      arrow.setLocalScale(1, 1, 1);
      app.root.addChild(arrow);
      return arrow;
    } else {
      const sphere = new pc.Entity(`Gizmo_${ls.name}`);
      sphere.addComponent('render', { type: 'sphere', castShadows: false });
      sphere.render!.meshInstances[0].material = makeEmissiveMaterial(ls.color);
      sphere.setPosition(ls.position.x, ls.position.y, ls.position.z);
      sphere.setLocalScale(GIZMO_SCALE_NORMAL.x, GIZMO_SCALE_NORMAL.y, GIZMO_SCALE_NORMAL.z);
      app.root.addChild(sphere);
      return sphere;
    }
  };

  updateGizmoColor = function(ls: LightState): void {
    if (!ls.gizmoEntity) return;
    const mat = makeEmissiveMaterial(ls.color);
    ls.gizmoEntity.find((e: pc.Entity) => !!e.render).forEach((e: pc.Entity) => {
      if (e.render) e.render.meshInstances[0].material = mat;
    });
    if (ls.gizmoEntity.render) ls.gizmoEntity.render.meshInstances[0].material = mat;
  };

  updateGizmoTransform = function(ls: LightState): void {
    if (!ls.gizmoEntity) return;
    if (ls.type === 'directional') {
      ls.gizmoEntity.setLocalEulerAngles(ls.eulerAngles.x, ls.eulerAngles.y, ls.eulerAngles.z);
    } else {
      ls.gizmoEntity.setPosition(ls.position.x, ls.position.y, ls.position.z);
    }
  };

  // Create gizmos for all initial lights
  lights.forEach(ls => { ls.gizmoEntity = createGizmo(ls); });

  // Update destroyGizmos
  destroyGizmos = function(): void {
    lights.forEach(ls => { if (ls.gizmoEntity) { ls.gizmoEntity.destroy(); ls.gizmoEntity = null; } });
  };

  function updateGizmoHighlight(): void {
    lights.forEach((ls, i) => {
      if (!ls.gizmoEntity) return;
      const scale = i === selectedIndex ? GIZMO_SCALE_SELECTED : GIZMO_SCALE_NORMAL;
      if (ls.type !== 'directional') {
        ls.gizmoEntity.setLocalScale(scale.x, scale.y, scale.z);
      }
    });
  }

  // ── Gizmo drag ────────────────────────────────────────────────────────────
  const canvas = app.graphicsDevice.canvas;
  let dragLight: LightState | null = null;
  const camEntity = app.root.findByName('MainCamera') as pc.Entity;

  const rayNear = new pc.Vec3();
  const rayFar  = new pc.Vec3();

  function screenToZ0(sx: number, sy: number): pc.Vec3 | null {
    const cam = camEntity.camera;
    if (!cam) return null;
    cam.screenToWorld(sx, sy, cam.nearClip, rayNear);
    cam.screenToWorld(sx, sy, cam.farClip,  rayFar);
    const dz = rayFar.z - rayNear.z;
    if (Math.abs(dz) < 1e-6) return null;
    const t = -rayNear.z / dz;
    return new pc.Vec3(
      rayNear.x + t * (rayFar.x - rayNear.x),
      rayNear.y + t * (rayFar.y - rayNear.y),
      0
    );
  }

  let arrowDragLastX = 0, arrowDragLastY = 0;
  let dragArrow: LightState | null = null;

  function onMouseDown(e: MouseEvent): void {
    if (mode !== 'light') return;
    if (e.button !== 0) return;
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;

    // Arrow pick (directional)
    lights.forEach(ls => {
      if (ls.type !== 'directional' || !ls.gizmoEntity) return;
      const cam = camEntity.camera;
      if (!cam) return;
      const screenPos = new pc.Vec3();
      cam.worldToScreen(ls.gizmoEntity.getPosition(), screenPos);
      const dist = Math.hypot(screenPos.x - sx, screenPos.y - sy);
      if (dist < 40) {
        dragArrow = ls;
        arrowDragLastX = e.clientX;
        arrowDragLastY = e.clientY;
        e.preventDefault();
      }
    });

    if (dragArrow) return;

    // Sphere pick (point/spot)
    let closest: LightState | null = null;
    let closestDist = 30;
    lights.forEach(ls => {
      if (ls.type === 'directional' || !ls.gizmoEntity) return;
      const cam = camEntity.camera;
      if (!cam) return;
      const screenPos = new pc.Vec3();
      cam.worldToScreen(ls.position, screenPos);
      const dist = Math.hypot(screenPos.x - sx, screenPos.y - sy);
      if (dist < closestDist) { closestDist = dist; closest = ls; }
    });

    if (closest) {
      dragLight = closest;
      e.preventDefault();
    }
  }

  function onMouseMove(e: MouseEvent): void {
    if (mode !== 'light') return;

    if (dragArrow) {
      const dx = e.clientX - arrowDragLastX;
      const dy = e.clientY - arrowDragLastY;
      arrowDragLastX = e.clientX;
      arrowDragLastY = e.clientY;
      dragArrow.eulerAngles.y -= dx * 0.5;
      dragArrow.eulerAngles.x -= dy * 0.5;
      dragArrow.eulerAngles.x = Math.max(-89, Math.min(89, dragArrow.eulerAngles.x));
      applyToScene(dragArrow);
      updateGizmoTransform(dragArrow);
      if (dragArrow._xIn) dragArrow._xIn.value = n2(dragArrow.eulerAngles.x);
      if (dragArrow._yIn) dragArrow._yIn.value = n2(dragArrow.eulerAngles.y);
      if (dragArrow._zIn) dragArrow._zIn.value = n2(dragArrow.eulerAngles.z);
      return;
    }

    if (!dragLight) return;
    const rect = canvas.getBoundingClientRect();
    const hit = screenToZ0(e.clientX - rect.left, e.clientY - rect.top);
    if (!hit) return;
    dragLight.position.set(hit.x, hit.y, dragLight.position.z);
    applyToScene(dragLight);
    updateGizmoTransform(dragLight);
    if (dragLight._xIn) dragLight._xIn.value = n2(hit.x);
    if (dragLight._yIn) dragLight._yIn.value = n2(hit.y);
  }

  function onMouseUp(): void { dragLight = null; dragArrow = null; }

  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);

  removeEventListeners = function(): void {
    canvas.removeEventListener('mousedown', onMouseDown);
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
  };

  // ── Add / Delete lights ───────────────────────────────────────────────────

  addLight = function(type: 'point' | 'directional' | 'spot'): void {
    const lightingEntity = app.root.findByName('Lighting')!;
    const entity = new pc.Entity(`Light${lights.length + 1}`);
    entity.addComponent('light', {
      type,
      color: new pc.Color(1, 1, 1),
      intensity: 1.0,
      castShadows: false,
      ...(type !== 'directional' ? { range: 10 } : {}),
    });
    lightingEntity.addChild(entity);

    const ls: LightState = {
      name: entity.name,
      type,
      color: new pc.Color(1, 1, 1),
      intensity: 1.0,
      position: new pc.Vec3(0, 0, 0),
      range: 10,
      eulerAngles: new pc.Vec3(0, 0, 0),
      entity,
      gizmoEntity: null,
    };
    lights.push(ls);
    ls.gizmoEntity = createGizmo(ls);
    refreshRows();
    selectLight(lights.length - 1);
  };

  deleteLight = function(i: number): void {
    const ls = lights[i];
    if (!ls) return;
    ls.entity.destroy();
    if (ls.gizmoEntity) ls.gizmoEntity.destroy();
    lights.splice(i, 1);
    refreshRows();
    selectLight(Math.min(i, lights.length - 1));
  };

  refreshRows();
  selectLight(0);

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

function generateTypeScript(lights: LightState[]): string {
  const f = (v: number) => parseFloat(v.toFixed(3)).toString();

  const blocks = lights.map(ls => {
    const varName = ls.name.charAt(0).toLowerCase() + ls.name.slice(1);
    const colorArgs = `${f(ls.color.r)}, ${f(ls.color.g)}, ${f(ls.color.b)}`;
    let props = `  type: "${ls.type}",\n  color: new pc.Color(${colorArgs}),\n  intensity: ${f(ls.intensity)},\n  castShadows: false,`;
    if (ls.type !== 'directional') props += `\n  range: ${f(ls.range)},`;
    let transform = '';
    if (ls.type === 'directional') {
      transform = `${varName}.setLocalEulerAngles(${f(ls.eulerAngles.x)}, ${f(ls.eulerAngles.y)}, ${f(ls.eulerAngles.z)});`;
    } else {
      transform = `${varName}.setLocalPosition(${f(ls.position.x)}, ${f(ls.position.y)}, ${f(ls.position.z)});`;
    }
    return [
      `const ${varName} = new pc.Entity("${ls.name}");`,
      `${varName}.addComponent("light", {\n${props}\n});`,
      transform,
      `lighting.addChild(${varName});`,
    ].join('\n');
  });

  return [
    '// ── Lighting ──────────────────────────────────────────────────────────────',
    'const lighting = new pc.Entity("Lighting");',
    '',
    ...blocks.flatMap(b => [b, '']),
    'app.root.addChild(lighting);',
  ].join('\n');
}
