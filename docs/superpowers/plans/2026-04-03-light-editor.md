# Light Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a developer-only in-browser light editor: a floating draggable HTML panel + PlayCanvas scene gizmos for interactive light placement, colour and intensity tuning, random lighting randomisation via scroll wheel, Blender-style camera navigation, and one-click TypeScript export.

**Architecture:** A single new file `src/debug/light-editor.ts` exports `createLightEditor(app)`. It reads the "Lighting" entity's children from the live PlayCanvas scene to build its internal `LightState[]`, then creates HTML panel + PlayCanvas gizmo entities. All state flows through a single `applyToScene()` call. `main.ts` registers `window.__le` in a `DEV`-only block.

**Tech Stack:** PlayCanvas (`pc.Application`, `pc.Entity`, `pc.StandardMaterial`, `pc.Vec3`, `pc.Color`), TypeScript strict, browser Clipboard API, Vite (`import.meta.env.DEV`).

---

### Task 1: Scaffold `src/debug/light-editor.ts` with state model and scene reader

**Files:**
- Create: `src/debug/light-editor.ts`

No automated tests — this module requires a live PlayCanvas app. All testing is visual: run `bun run dev` and call `__le()` in the console.

- [ ] **Step 1: Create the file with imports, `LightState` interface, and the scene reader**

```typescript
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
  // Panel, gizmos, and event listeners added in subsequent tasks.
  console.log('[LightEditor] opened with', lights.length, 'lights');
}
```

- [ ] **Step 2: Verify it compiles**

```bash
bun run build
```

Expected: build succeeds with no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add src/debug/light-editor.ts
git commit -m "feat: scaffold light editor with LightState model and scene reader"
```

---

### Task 2: Register `window.__le` in `main.ts`

**Files:**
- Modify: `src/main.ts`

- [ ] **Step 1: Add the DEV-only registration block at the end of `main()`, just before the closing brace**

In [src/main.ts](src/main.ts), after the `beforeunload` listener (line ~133), add:

```typescript
  // DEV: light editor — open with __le() in the browser console
  if (import.meta.env.DEV) {
    const { createLightEditor } = await import('./debug/light-editor.js');
    (window as any).__le = () => createLightEditor(app);
  }
```

- [ ] **Step 2: Verify it works**

```bash
bun run dev
```

Open browser console, type `__le()`. Expected: `[LightEditor] opened with 5 lights` logged to console. No errors.

- [ ] **Step 3: Commit**

```bash
git add src/main.ts
git commit -m "feat: register window.__le for light editor (DEV only)"
```

---

### Task 3: Build the HTML panel skeleton (draggable, closeable)

**Files:**
- Modify: `src/debug/light-editor.ts`

- [ ] **Step 1: Add `createPanel()` and `makeDraggable()` helpers, and wire the close button**

Replace the `export function createLightEditor` body with:

```typescript
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
  function destroyGizmos(): void {}
  function removeEventListeners(): void {}

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
```

- [ ] **Step 2: Verify**

```bash
bun run dev
```

Call `__le()`. Panel should appear top-right, be draggable, and close when ✕ is clicked.

- [ ] **Step 3: Commit**

```bash
git add src/debug/light-editor.ts
git commit -m "feat: light editor panel skeleton — draggable, closeable"
```

---

### Task 4: Light list section in panel

**Files:**
- Modify: `src/debug/light-editor.ts`

- [ ] **Step 1: Add `buildLightList()` and `selectLight()` inside `createLightEditor`**

Add this after the header is appended to `panel`, before the `makeDraggable` call:

```typescript
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
    // Add light row
    listRows.appendChild(buildAddRow());
    highlightRow(selectedIndex);
  }

  function highlightRow(i: number): void {
    rowEls.forEach((r, idx) => {
      r.style.background = idx === i ? '#2a2a4e' : 'transparent';
      r.style.border = idx === i ? '1px solid #4a6fa5' : '1px solid transparent';
    });
  }

  // Properties section — built in next task; declared here so selectLight can call it
  let renderProps: (ls: LightState) => void = () => {};

  function selectLight(i: number): void {
    selectedIndex = i;
    highlightRow(i);
    if (lights[i]) renderProps(lights[i]);
  }

  refreshRows();
  selectLight(0);
```

Also add the `buildAddRow` function (stub for now — wired in Task 7):

```typescript
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

  // Stub — implemented in Task 7
  function addLight(_type: 'point' | 'directional' | 'spot'): void {}
```

- [ ] **Step 2: Verify**

```bash
bun run dev
```

Call `__le()`. Light list should show 5 rows with correct names, type badges, colored dots, and eye icons. Clicking a row should highlight it.

- [ ] **Step 3: Commit**

```bash
git add src/debug/light-editor.ts
git commit -m "feat: light editor panel — light list with selection and visibility toggle"
```

---

### Task 5: Properties section (color, intensity, position/euler, delete)

**Files:**
- Modify: `src/debug/light-editor.ts`

- [ ] **Step 1: Add `propsSection` and implement `renderProps`**

Add this after `listSection` is appended to `panel`:

```typescript
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

    // Title
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
      // Update dot in list
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

      // Store refs so gizmo drag can update them
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

  // Stubs — implemented in later tasks
  function applyToScene(_ls: LightState): void {}
  function updateGizmoColor(_ls: LightState): void {}
  function updateGizmoTransform(_ls: LightState): void {}
  function deleteLight(_i: number): void {}
```

Also extend `LightState` with optional input refs by adding to the interface (before `entity`):

```typescript
  // panel input refs — for gizmo→panel sync:
  _xIn?: HTMLInputElement;
  _yIn?: HTMLInputElement;
  _zIn?: HTMLInputElement;
```

- [ ] **Step 2: Verify**

```bash
bun run dev
```

Call `__le()`. Click each light — properties section should update showing the correct type, color, intensity, and position/euler inputs. Sliders and inputs should be interactive (no errors in console).

- [ ] **Step 3: Commit**

```bash
git add src/debug/light-editor.ts
git commit -m "feat: light editor panel — properties section (color, intensity, position/euler, delete)"
```

---

### Task 6: `applyToScene` + footer (export + reset camera button)

**Files:**
- Modify: `src/debug/light-editor.ts`

- [ ] **Step 1: Implement `applyToScene` and add the footer**

Replace the `function applyToScene(_ls: LightState): void {}` stub with:

```typescript
  function applyToScene(ls: LightState): void {
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
  }
```

Add the footer section after `propsSection` is appended to `panel`:

```typescript
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
    display: 'none', // shown only in camera mode
  });
  resetCamBtn.addEventListener('click', resetCamera);
  footer.appendChild(resetCamBtn);

  panel.appendChild(footer);

  // Stubs — implemented in later tasks
  function resetCamera(): void {}
```

Add `generateTypeScript` as a module-level function (outside `createLightEditor`):

```typescript
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
```

- [ ] **Step 2: Verify**

```bash
bun run dev
```

Call `__le()`. Click "Copy TS to clipboard". Paste into a text editor — should produce well-formed TypeScript matching the style in `scene-graph.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/debug/light-editor.ts
git commit -m "feat: light editor — applyToScene, TS export, footer"
```

---

### Task 7: Add and delete lights

**Files:**
- Modify: `src/debug/light-editor.ts`

- [ ] **Step 1: Implement `addLight` and `deleteLight`**

Replace the `addLight` stub:

```typescript
  function addLight(type: 'point' | 'directional' | 'spot'): void {
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
  }
```

Replace the `deleteLight` stub:

```typescript
  function deleteLight(i: number): void {
    const ls = lights[i];
    if (!ls) return;
    ls.entity.destroy();
    if (ls.gizmoEntity) ls.gizmoEntity.destroy();
    lights.splice(i, 1);
    refreshRows();
    selectLight(Math.min(i, lights.length - 1));
  }
```

- [ ] **Step 2: Verify**

```bash
bun run dev
```

Call `__le()`. Click "Add light…" with Point selected. A new light should appear in the list, selected, with default white color. Click Delete — it should be removed from the list.

- [ ] **Step 3: Commit**

```bash
git add src/debug/light-editor.ts
git commit -m "feat: light editor — add and delete lights"
```

---

### Task 8: PlayCanvas gizmos (sphere for point/spot, arrow for directional)

**Files:**
- Modify: `src/debug/light-editor.ts`

- [ ] **Step 1: Add `createGizmo`, `updateGizmoColor`, `updateGizmoTransform`, gizmo drag, and init all gizmos**

Add `createGizmo` inside `createLightEditor` (after the lights array is built):

```typescript
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

  function createGizmo(ls: LightState): pc.Entity {
    if (ls.type === 'directional') {
      // Arrow = parent entity with cylinder body + cone tip
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
  }

  // Replace stubs
  updateGizmoColor = function(ls: LightState): void {
    if (!ls.gizmoEntity) return;
    const mat = makeEmissiveMaterial(ls.color);
    ls.gizmoEntity.find((e: pc.Entity) => !!e.render).forEach((e: pc.Entity) => {
      if (e.render) e.render.meshInstances[0].material = mat;
    });
    // Also update self if it has render
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

  // Highlight selected gizmo
  function updateGizmoHighlight(): void {
    lights.forEach((ls, i) => {
      if (!ls.gizmoEntity) return;
      const scale = i === selectedIndex ? GIZMO_SCALE_SELECTED : GIZMO_SCALE_NORMAL;
      if (ls.type !== 'directional') {
        ls.gizmoEntity.setLocalScale(scale.x, scale.y, scale.z);
      }
    });
  }
```

Patch `selectLight` to call `updateGizmoHighlight()` after `renderProps`:

```typescript
  function selectLight(i: number): void {
    selectedIndex = i;
    highlightRow(i);
    if (lights[i]) renderProps(lights[i]);
    updateGizmoHighlight();
  }
```

- [ ] **Step 2: Add sphere drag (point/spot lights) and arrow drag (directional lights)**

Add after the gizmo creation loop:

```typescript
  // ── Gizmo drag (point/spot) ───────────────────────────────────────────────
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

  function onMouseDown(e: MouseEvent): void {
    if (mode !== 'light') return;
    if (e.button !== 0) return; // left button only for gizmo pick
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;

    // Find closest directional arrow gizmo within pick radius
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

    if (dragArrow) return; // arrow takes priority

    // Find closest point/spot gizmo within pick radius
    let closest: LightState | null = null;
    let closestDist = 30; // px
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

  let arrowDragLastX = 0, arrowDragLastY = 0;
  let dragArrow: LightState | null = null;

  function onMouseMove(e: MouseEvent): void {
    if (mode !== 'light') return;

    // Arrow drag (directional)
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

    // Sphere drag (point/spot)
    if (!dragLight) return;
    const rect = canvas.getBoundingClientRect();
    const hit = screenToZ0(e.clientX - rect.left, e.clientY - rect.top);
    if (!hit) return;
    dragLight.position.set(hit.x, hit.y, dragLight.position.z);
    applyToScene(dragLight);
    updateGizmoTransform(dragLight);
    // Sync panel inputs
    if (dragLight._xIn) dragLight._xIn.value = n2(hit.x);
    if (dragLight._yIn) dragLight._yIn.value = n2(hit.y);
  }

  function onMouseUp(): void { dragLight = null; dragArrow = null; }

  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);

  // Extend removeEventListeners
  removeEventListeners = function(): void {
    canvas.removeEventListener('mousedown', onMouseDown);
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
  };
```

- [ ] **Step 3: Verify**

```bash
bun run dev
```

Call `__le()`. Coloured sphere/arrow gizmos should appear at each light's position. Dragging a point light sphere in the scene should move it, with the panel X/Y inputs updating in sync.

- [ ] **Step 4: Commit**

```bash
git add src/debug/light-editor.ts
git commit -m "feat: light editor — scene gizmos with drag-to-reposition for point lights"
```

---

### Task 9: Random lighting (scroll wheel, light mode)

**Files:**
- Modify: `src/debug/light-editor.ts`

- [ ] **Step 1: Add HSV→RGB helper and `randomizeLights`, wire to scroll event**

Add `hsvToRgb` as a module-level function:

```typescript
function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  switch (i % 6) {
    case 0: return [v, t, p];
    case 1: return [q, v, p];
    case 2: return [p, v, t];
    case 3: return [p, q, v];
    case 4: return [t, p, v];
    default: return [v, p, q];
  }
}
```

Add inside `createLightEditor` (after gizmo setup):

```typescript
  // ── Random lighting ───────────────────────────────────────────────────────
  function rnd(min: number, max: number): number { return min + Math.random() * (max - min); }

  function randomizeLights(): void {
    lights.forEach(ls => {
      const [r, g, b] = hsvToRgb(Math.random(), rnd(0.5, 0.9), rnd(0.7, 1.0));
      ls.color.set(r, g, b, 1);
      ls.intensity = ls.type === 'directional' ? rnd(0.3, 2.0) : rnd(0.5, 4.0);
      if (ls.type === 'directional') {
        ls.eulerAngles.set(rnd(-60, 60), rnd(-180, 180), 0);
      } else {
        ls.position.set(rnd(-5, 5), rnd(-5, 5), rnd(0, 15));
      }
      applyToScene(ls);
      updateGizmoColor(ls);
      updateGizmoTransform(ls);
    });
    // Re-render props for selected light
    if (lights[selectedIndex]) renderProps(lights[selectedIndex]);
    refreshRows();
  }

  function onWheel(e: WheelEvent): void {
    if (mode === 'light') {
      e.preventDefault();
      randomizeLights();
    }
    // Camera dolly handled in Task 10
  }

  canvas.addEventListener('wheel', onWheel, { passive: false });

  // Extend removeEventListeners
  const prevRemove = removeEventListeners;
  removeEventListeners = function(): void {
    prevRemove();
    canvas.removeEventListener('wheel', onWheel);
  };
```

- [ ] **Step 2: Verify**

```bash
bun run dev
```

Call `__le()`. Scroll the mouse wheel over the canvas. Each tick should produce a new random colour/intensity/position setup. Panel and gizmos update live.

- [ ] **Step 3: Commit**

```bash
git add src/debug/light-editor.ts
git commit -m "feat: light editor — scroll wheel random lighting (light mode)"
```

---

### Task 10: Camera navigation (camera mode)

**Files:**
- Modify: `src/debug/light-editor.ts`

- [ ] **Step 1: Add mode toggle (`C` key), camera orbit/pan/dolly/reset, and console logging**

Add inside `createLightEditor` after the wheel handler:

```typescript
  // ── Camera navigation ─────────────────────────────────────────────────────
  const cameraRig    = app.root.findByName('CameraRig') as pc.Entity;
  const cameraLocal  = app.root.findByName('MainCamera') as pc.Entity;

  // Initial state for reset
  const initRigPos    = cameraRig.getLocalPosition().clone();
  const initRigEuler  = cameraRig.getLocalEulerAngles().clone();
  const initCamZ      = cameraLocal.getLocalPosition().z;

  // Live camera state
  let rigYaw   = initRigEuler.y;
  let rigPitch = initRigEuler.x;
  let camZ     = initCamZ;
  const rigPos = initRigPos.clone();

  function applyCameraTransform(): void {
    cameraRig.setLocalPosition(rigPos.x, rigPos.y, rigPos.z);
    cameraRig.setLocalEulerAngles(rigPitch, rigYaw, 0);
    cameraLocal.setLocalPosition(0, 0, camZ);
    console.log(
      `[LightEditor] camera  rig=(${rigPos.x.toFixed(2)}, ${rigPos.y.toFixed(2)}, ${rigPos.z.toFixed(2)})` +
      `  rot=(${rigPitch.toFixed(2)}, ${rigYaw.toFixed(2)}, 0.00)  cam-z=${camZ.toFixed(2)}`
    );
  }

  resetCamera = function(): void {
    rigYaw   = initRigEuler.y;
    rigPitch = initRigEuler.x;
    camZ     = initCamZ;
    rigPos.copy(initRigPos);
    applyCameraTransform();
  };

  // Middle-mouse orbit / pan
  let midDragActive = false;
  let midLastX = 0, midLastY = 0;
  const ORBIT_SPEED = 0.4;
  const PAN_SPEED   = 0.01;

  function onMouseDownCam(e: MouseEvent): void {
    if (mode !== 'camera') return;
    if (e.button !== 1) return; // middle mouse
    e.preventDefault();
    midDragActive = true;
    midLastX = e.clientX;
    midLastY = e.clientY;
  }

  function onMouseMoveCam(e: MouseEvent): void {
    if (!midDragActive || mode !== 'camera') return;
    const dx = e.clientX - midLastX;
    const dy = e.clientY - midLastY;
    midLastX = e.clientX;
    midLastY = e.clientY;

    if (e.shiftKey) {
      // Pan
      rigPos.x -= dx * PAN_SPEED;
      rigPos.y += dy * PAN_SPEED;
    } else {
      // Orbit
      rigYaw   -= dx * ORBIT_SPEED;
      rigPitch -= dy * ORBIT_SPEED;
      rigPitch  = Math.max(-89, Math.min(89, rigPitch));
    }
    applyCameraTransform();
  }

  function onMouseUpCam(): void { midDragActive = false; }

  // Scroll dolly (camera mode) — extend existing onWheel
  const prevWheel = onWheel; // already assigned
  // Replace onWheel in-place by redefining the canvas listener:
  canvas.removeEventListener('wheel', onWheel);
  function onWheelFull(e: WheelEvent): void {
    e.preventDefault();
    if (mode === 'light') {
      randomizeLights();
    } else {
      camZ -= e.deltaY * 0.01;
      camZ  = Math.max(0.5, camZ);
      applyCameraTransform();
    }
  }
  canvas.addEventListener('wheel', onWheelFull, { passive: false });

  // Key: C toggles mode, Numpad0/Home resets camera
  function onKeyDown(e: KeyboardEvent): void {
    if (e.key === 'c' || e.key === 'C') {
      mode = mode === 'light' ? 'camera' : 'light';
      headerLabel.textContent = `💡 Light Editor [${mode.toUpperCase()}]`;
      resetCamBtn.style.display = mode === 'camera' ? 'block' : 'none';
    }
    if (mode === 'camera' && (e.code === 'Numpad0' || e.key === 'Home')) {
      resetCamera();
    }
  }

  canvas.addEventListener('mousedown', onMouseDownCam);
  window.addEventListener('mousemove', onMouseMoveCam);
  window.addEventListener('mouseup', onMouseUpCam);
  window.addEventListener('keydown', onKeyDown);

  // Context menu suppression (middle mouse)
  function onContextMenu(e: MouseEvent): void { if (mode === 'camera') e.preventDefault(); }
  canvas.addEventListener('contextmenu', onContextMenu);

  // Extend removeEventListeners again
  const prevRemove2 = removeEventListeners;
  removeEventListeners = function(): void {
    prevRemove2();
    canvas.removeEventListener('wheel', onWheelFull);
    canvas.removeEventListener('mousedown', onMouseDownCam);
    window.removeEventListener('mousemove', onMouseMoveCam);
    window.removeEventListener('mouseup', onMouseUpCam);
    window.removeEventListener('keydown', onKeyDown);
    canvas.removeEventListener('contextmenu', onContextMenu);
  };
```

> **Note:** Because `onWheel` was replaced in this task, remove the `canvas.removeEventListener('wheel', onWheel)` line added in Task 9's `removeEventListeners` — it's superseded by the `onWheelFull` removal above.

- [ ] **Step 2: Verify orbit**

```bash
bun run dev
```

Call `__le()`. Press `C` — panel header should show `[CAMERA]` and Reset camera button appears. Middle-mouse drag should orbit the camera. `Numpad0`/`Home` or Reset button restores the camera. Each camera change logs to console.

- [ ] **Step 3: Verify dolly**

In camera mode, scroll wheel should dolly the camera in/out (not randomise lights). Press `C` again — scroll should randomise lights again.

- [ ] **Step 4: Commit**

```bash
git add src/debug/light-editor.ts
git commit -m "feat: light editor — camera mode (orbit, pan, dolly, reset, console logging)"
```

---

### Task 11: Verify full flow end-to-end

No code changes — this is a verification task.

- [ ] **Step 1: Run the dev server**

```bash
bun run dev
```

- [ ] **Step 2: Full feature checklist**

Open browser console and run through:

| # | Action | Expected |
|---|--------|----------|
| 1 | `__le()` | Panel appears top-right, 5 lights listed |
| 2 | Click each light row | Properties section updates correctly |
| 3 | Change color swatch | Light color changes live, gizmo color updates |
| 4 | Move intensity slider | Light intensity changes live |
| 5 | Edit X/Y/Z number inputs | Light position/euler updates live |
| 6 | Click eye icon | Light toggles off/on |
| 7 | Drag a point light sphere | Light moves, panel X/Y inputs sync |
| 8 | Scroll wheel | Random lighting cycles through |
| 9 | Click "Add light…" (Point) | New light appears, gizmo created |
| 10 | Click Delete | Light and gizmo removed |
| 11 | Click "Copy TS to clipboard" | TypeScript block on clipboard, button shows ✓ |
| 12 | Press `C` | Header shows `[CAMERA]`, Reset button appears |
| 13 | Middle-mouse drag | Camera orbits |
| 14 | Shift + middle-mouse drag | Camera pans |
| 15 | Scroll in camera mode | Camera dollies |
| 16 | Press `Home` | Camera resets to (0,0,7) |
| 17 | Camera move | Console logs rig/rot/cam-z |
| 18 | Click ✕ | Panel removed, gizmos destroyed, camera navigation disabled |
| 19 | `__le()` again | Editor reopens cleanly |

- [ ] **Step 3: Production build check**

```bash
bun run build
```

Expected: build succeeds. `__le` must NOT be bundled into production — verify by checking that `light-editor` does not appear in the `dist/` output:

```bash
grep -r "light-editor" dist/ && echo "FAIL: editor in prod build" || echo "OK: not in prod build"
```

Expected output: `OK: not in prod build`

- [ ] **Step 4: Commit**

```bash
git commit --allow-empty -m "chore: verify light editor end-to-end"
```

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/debug/light-editor.ts` | Create | Full editor: state, panel, gizmos, camera nav |
| `src/main.ts` | Modify | Register `window.__le` (DEV only, 4 lines) |
