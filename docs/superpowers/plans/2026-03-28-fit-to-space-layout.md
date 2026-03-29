# Fit-to-Space Scene Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite `src/scene/scene-layouts.ts` so every scene element fills its allocated frustum region with no gaps, no off-screen overflow, and no overlaps.

**Architecture:** One file changes: `src/scene/scene-layouts.ts`. `computeFrustum` is untouched. The three gameplay layouts (portrait1, portrait2, landscape) are rewritten to derive element scale from available space rather than from fixed unit-width ratios. The two menu layouts are updated to use the new scale values × their existing shrink factors.

**Tech Stack:** TypeScript strict, pure math (no PlayCanvas dependency in this file).

---

### Task 1: Rewrite gameplay layouts — portrait1, portrait2, landscape

**Files:**
- Modify: `src/scene/scene-layouts.ts`

No automated tests — verification is visual. Run `bun run dev` and confirm with the frustum markers.

- [ ] **Step 1: Update the constants — remove tilt, add GAP and unit heights**

Make three targeted edits to `src/scene/scene-layouts.ts`:

**1a. Delete the two tilt constants** (lines that define `KB_TILT_UP` and `KB_TILT_DOWN`). The `FLAT` constant stays.

Before (remove these two lines):
```typescript
const KB_TILT_UP: [number, number, number]   = [-12, 0, 0]; // keyboard above center → bottom tilts toward camera
const KB_TILT_DOWN: [number, number, number] = [ 12, 0, 0]; // keyboard below center → top tilts toward camera
```

After: those lines are gone. `FLAT` remains.

**1b. Add `GAP` immediately after the `MARGIN` constant:**

```typescript
const MARGIN = 0.08;
const GAP = 0.06;    // ← add this line
```

**1c. Replace `FLATED_H` with `MONITOR_UNIT_H` and `KB_UNIT_H`:**

Before:
```typescript
// Monitor world-space width at scale 1 (BORDER_W + bezels ≈ 3.08)
const MONITOR_UNIT_W = 3.08;
// Keyboard world-space width at entity scale 1 — GLB model has internal 13.2× scale,
// so effective width = 0.233 × 13.2 = 3.076 (matches monitor width)
const KB_UNIT_W = 3.076;
// Keyboard visual height at entity scale 1 — model Z extent 0.146 × 13.2 = 1.927
const FLATED_H = 1.927;
```

After:
```typescript
// Monitor world-space dimensions at entity scale 1
const MONITOR_UNIT_W = 3.08;
const MONITOR_UNIT_H = 2.2;

// Keyboard world-space dimensions at entity scale 1
// GLB model has internal 13.2× scale: width = 0.233×13.2, height = 0.146×13.2
const KB_UNIT_W = 3.076;
const KB_UNIT_H = 1.927;
```

- [ ] **Step 2: Rewrite `computeLayout` — shared preamble**

Replace the existing `computeLayout` function body's opening (from `const camZ = …` through the end of the `usableW` / `ctrlScale` block) with:

```typescript
export function computeLayout(sceneName: string, fovDeg: number, aspect: number): SceneLayout | null {
  const camZ = sceneName.includes('landscape') ? 6 : 7;
  const f = computeFrustum(fovDeg, aspect, camZ);

  // Visible edges with small margin
  const left   = -f.halfW * (1 - MARGIN);
  const right  =  f.halfW * (1 - MARGIN);
  const top    =  f.halfH * (1 - MARGIN);
  const bottom = -f.halfH * (1 - MARGIN);
  const usableW = right - left;

  // Controls row: size relative to viewport width
  const ctrlScale = Math.min(0.6, Math.max(0.3, usableW * 0.08));
  const cs: [number, number, number] = [ctrlScale, ctrlScale, ctrlScale];
  const ctrlRowH = ctrlScale * 1.2;

  // Content area: all space above the controls row
  const contentBottom = bottom + ctrlRowH + GAP;
  const contentH      = top - contentBottom;

  // Controls Y centre (shared by all scenes)
  const ctrlY = bottom + ctrlRowH / 2;
```

- [ ] **Step 3: Rewrite the `portrait1` case**

Replace the existing `case 'portrait1':` block (including its closing `}`) with:

```typescript
    case 'portrait1': {
      // Split content height equally; scale each element to fill its half
      const elemH     = (contentH - GAP) / 2;
      const monScale  = Math.min(elemH / MONITOR_UNIT_H, usableW / MONITOR_UNIT_W);
      const kbScale   = Math.min(elemH / KB_UNIT_H,      usableW / KB_UNIT_W);
      const ms: [number, number, number] = [monScale, monScale, monScale];
      const ks: [number, number, number] = [kbScale,  kbScale,  kbScale];

      const lowerCenterY = contentBottom + elemH / 2;
      const upperCenterY = contentBottom + elemH + GAP + elemH / 2;

      // portrait1: keyboard on top, monitor below
      return {
        keyboard:   { position: [0,     upperCenterY, 0],   rotation: FLAT, scale: ks, visible: true },
        monitor:    { position: [0,     lowerCenterY, 0],   rotation: FLAT, scale: ms, visible: true },
        joystick:   { position: [left,  ctrlY, 0],          rotation: FLAT, scale: cs, visible: true },
        fireButton: { position: [right, ctrlY, 0.4],        rotation: FLAT, scale: cs, visible: true },
        menuButton: { position: [0,     ctrlY, 0.4],        rotation: FLAT, scale: cs, visible: true },
        menuCodex:  { position: [0, 0, -8], rotation: FLAT, scale: [1, 1, 1], visible: false },
        camera:     { position: [0, 0, camZ], rotation: FLAT, scale: [1, 1, 1] },
      };
    }
```

- [ ] **Step 4: Rewrite the `portrait2` case**

Replace the existing `case 'portrait2':` block with:

```typescript
    case 'portrait2': {
      // Same split as portrait1 but monitor on top, keyboard below
      const elemH     = (contentH - GAP) / 2;
      const monScale  = Math.min(elemH / MONITOR_UNIT_H, usableW / MONITOR_UNIT_W);
      const kbScale   = Math.min(elemH / KB_UNIT_H,      usableW / KB_UNIT_W);
      const ms: [number, number, number] = [monScale, monScale, monScale];
      const ks: [number, number, number] = [kbScale,  kbScale,  kbScale];

      const lowerCenterY = contentBottom + elemH / 2;
      const upperCenterY = contentBottom + elemH + GAP + elemH / 2;

      // portrait2: monitor on top, keyboard below
      return {
        monitor:    { position: [0,     upperCenterY, 0],   rotation: FLAT, scale: ms, visible: true },
        keyboard:   { position: [0,     lowerCenterY, 0],   rotation: FLAT, scale: ks, visible: true },
        joystick:   { position: [left,  ctrlY, 0],          rotation: FLAT, scale: cs, visible: true },
        fireButton: { position: [right, ctrlY, 0.4],        rotation: FLAT, scale: cs, visible: true },
        menuButton: { position: [0,     ctrlY, 0.4],        rotation: FLAT, scale: cs, visible: true },
        menuCodex:  { position: [0, 0, -8], rotation: FLAT, scale: [1, 1, 1], visible: false },
        camera:     { position: [0, 0, camZ], rotation: FLAT, scale: [1, 1, 1] },
      };
    }
```

- [ ] **Step 5: Rewrite the `landscape` case**

Replace the existing `case 'landscape':` block with:

```typescript
    case 'landscape': {
      const panelGap     = usableW * 0.03;
      const halfPanelW   = (usableW - panelGap) / 2;
      const leftCenterX  = left  + halfPanelW / 2;
      const rightCenterX = right - halfPanelW / 2;

      // Each element fills the full content height in its half-panel
      const monScale = Math.min(contentH / MONITOR_UNIT_H, halfPanelW / MONITOR_UNIT_W);
      const kbScale  = Math.min(contentH / KB_UNIT_H,      halfPanelW / KB_UNIT_W);
      const ms: [number, number, number] = [monScale, monScale, monScale];
      const ks: [number, number, number] = [kbScale,  kbScale,  kbScale];

      const centerY = contentBottom + contentH / 2;

      return {
        monitor:    { position: [leftCenterX,  centerY, 0], rotation: FLAT, scale: ms, visible: true },
        keyboard:   { position: [rightCenterX, centerY, 0], rotation: FLAT, scale: ks, visible: true },
        joystick:   { position: [left,  ctrlY, 0],          rotation: FLAT, scale: cs, visible: true },
        fireButton: { position: [right, ctrlY, 0.4],        rotation: FLAT, scale: cs, visible: true },
        menuButton: { position: [0,     ctrlY, 0.4],        rotation: FLAT, scale: cs, visible: true },
        menuCodex:  { position: [0, 0, -8], rotation: FLAT, scale: [1, 1, 1], visible: false },
        camera:     { position: [0, 0, camZ], rotation: FLAT, scale: [1, 1, 1] },
      };
    }
```

- [ ] **Step 6: Build and verify no TypeScript errors**

```bash
cd /Users/jackallan/dev/z80 && bun run build 2>&1 | tail -15
```

Expected: build completes with no errors (only the usual chunk-size warning is acceptable).

- [ ] **Step 7: Visual check — portrait**

```bash
bun run dev
```

Open in browser, hold phone portrait (or resize window to portrait ratio). Confirm:
- Frustum markers (red/green/blue/yellow spheres) sit at the four viewport corners
- Monitor and keyboard each fill roughly half the height between the top marker and the controls row
- No gap between the two elements or between the bottom element and the controls
- Joystick at left edge, fire button at right edge, menu button centred

- [ ] **Step 8: Visual check — landscape**

Rotate device / resize window to landscape. Confirm:
- Monitor fills the left half, keyboard fills the right half
- Both reach from the top marker down to the controls row
- Controls span full width below

- [ ] **Step 9: Commit**

```bash
git add src/scene/scene-layouts.ts
git commit -m "feat: fit-to-space layout for portrait and landscape scenes"
```

---

### Task 2: Update menu layouts — menuPortrait, menuLandscape

**Files:**
- Modify: `src/scene/scene-layouts.ts`

Menu scenes display a full-screen codex overlay in the foreground (Z=0); the gameplay elements are pushed to Z=−4 and scaled down to appear as a recessed background.

- [ ] **Step 1: Rewrite the `menuPortrait` case**

Replace the existing `case 'menuPortrait':` block with:

```typescript
    case 'menuPortrait': {
      const pushZ  = -4;
      const shrink = 0.6;

      // Derive background element scales from the portrait fit-to-space values × shrink
      const elemH    = (contentH - GAP) / 2;
      const monScale = Math.min(elemH / MONITOR_UNIT_H, usableW / MONITOR_UNIT_W);
      const kbScale  = Math.min(elemH / KB_UNIT_H,      usableW / KB_UNIT_W);
      const smallMs: [number, number, number] = [monScale * shrink, monScale * shrink, monScale * shrink];
      const smallKs: [number, number, number] = [kbScale  * shrink, kbScale  * shrink, kbScale  * shrink];
      const cs06:    [number, number, number] = [ctrlScale * shrink, ctrlScale * shrink, ctrlScale * shrink];

      // Elements cluster around screen centre, pushed back; codex is in front at Z=0
      const monY = (elemH / 2) * shrink;
      const kbY  = -(elemH / 2 + GAP) * shrink;
      const ctrlY06 = bottom * shrink;

      return {
        monitor:    { position: [0, monY,  pushZ], rotation: FLAT, scale: smallMs, visible: true },
        keyboard:   { position: [0, kbY,   pushZ], rotation: FLAT, scale: smallKs, visible: true },
        joystick:   { position: [left  * shrink, ctrlY06, pushZ], rotation: FLAT, scale: cs06, visible: true },
        fireButton: { position: [right * shrink, ctrlY06, pushZ], rotation: FLAT, scale: cs06, visible: true },
        menuButton: { position: [0,              ctrlY06, pushZ], rotation: FLAT, scale: cs06, visible: true },
        menuCodex:  { position: [0, 0, 0], rotation: FLAT, scale: [1, 1, 1], visible: true },
        camera:     { position: [0, 0, 7], rotation: FLAT, scale: [1, 1, 1] },
      };
    }
```

- [ ] **Step 2: Rewrite the `menuLandscape` case**

Replace the existing `case 'menuLandscape':` block with:

```typescript
    case 'menuLandscape': {
      const pushZ  = -4;
      const shrink = 0.65;

      // Derive background element scales from the landscape fit-to-space values × shrink
      const panelGap     = usableW * 0.03;
      const halfPanelW   = (usableW - panelGap) / 2;
      const leftCenterX  = left  + halfPanelW / 2;
      const rightCenterX = right - halfPanelW / 2;
      const centerY      = contentBottom + contentH / 2;

      const monScale = Math.min(contentH / MONITOR_UNIT_H, halfPanelW / MONITOR_UNIT_W);
      const kbScale  = Math.min(contentH / KB_UNIT_H,      halfPanelW / KB_UNIT_W);
      const smallMs: [number, number, number] = [monScale * shrink, monScale * shrink, monScale * shrink];
      const smallKs: [number, number, number] = [kbScale  * shrink, kbScale  * shrink, kbScale  * shrink];
      const cs06:    [number, number, number] = [ctrlScale * 0.6, ctrlScale * 0.6, ctrlScale * 0.6];

      return {
        monitor:    { position: [leftCenterX,  centerY, pushZ], rotation: FLAT, scale: smallMs,     visible: true },
        keyboard:   { position: [rightCenterX, centerY, pushZ], rotation: FLAT, scale: smallKs,     visible: true },
        joystick:   { position: [left  * 0.6,  ctrlY,   pushZ], rotation: FLAT, scale: cs06,        visible: true },
        fireButton: { position: [right * 0.6,  ctrlY,   pushZ], rotation: FLAT, scale: cs06,        visible: true },
        menuButton: { position: [0,            ctrlY,   pushZ], rotation: FLAT, scale: cs06,        visible: true },
        menuCodex:  { position: [0, 0, 0], rotation: FLAT, scale: [1.2, 1.2, 1.2], visible: true },
        camera:     { position: [0, 0, 6], rotation: FLAT, scale: [1, 1, 1] },
      };
    }
```

- [ ] **Step 3: Close the switch and function, verify the file compiles**

The `default: return null;` case and closing braces should already be in place from the existing code. Confirm the file ends correctly:

```typescript
    default:
      return null;
  }
}
```

Then build:

```bash
cd /Users/jackallan/dev/z80 && bun run build 2>&1 | tail -10
```

Expected: clean build.

- [ ] **Step 4: Visual check — menu scenes**

In the running dev server, open the menu (tap/click the menu button). Confirm:
- The codex overlay appears in the foreground at full size
- The monitor and keyboard are visible as a smaller background behind the codex
- No element clips the frustum marker corners
- Switching back to gameplay restores the full-size portrait or landscape layout

- [ ] **Step 5: Commit**

```bash
git add src/scene/scene-layouts.ts
git commit -m "feat: update menu layouts to use fit-to-space base scales"
```
