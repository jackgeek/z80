# Light Editor — Design Spec

**Date:** 2026-04-03
**Branch:** ver2
**Status:** Approved for implementation

## Overview

A developer-only, in-browser light editor for the PlayCanvas 3D scene. Inspired by HardOps Blank Light, it provides a floating HTML panel paired with live 3D gizmos for interactive light placement and color tuning. When satisfied, the user exports the configuration as a ready-to-paste TypeScript snippet that replaces the lighting block in `scene-graph.ts`.

---

## Activation

Registered once at app startup, gated to `import.meta.env.DEV`:

```ts
// in main.ts (dev only)
if (import.meta.env.DEV) {
  const { createLightEditor } = await import('./debug/light-editor.js');
  (window as any).__le = () => createLightEditor(app);
}
```

Usage in the browser console:
```js
__le()   // opens the editor
```

Closing is done via the ✕ button in the panel — no console command needed.

---

## Architecture

**File:** `src/debug/light-editor.ts`

Exports a single function:
```ts
export function createLightEditor(app: pc.Application): void
```

The function is fire-and-forget — it sets up the panel and gizmos, and the destroy lifecycle is handled internally by the panel's close button.

Internally manages two parallel systems that stay in sync:

1. **HTML Panel** — a floating draggable `<div>` injected into `document.body`
2. **PlayCanvas Gizmo Entities** — sphere/arrow meshes added to `app.root`, removed on destroy

### Light State Model

Each light is tracked as a plain object:

```ts
interface LightState {
  name: string;
  type: 'directional' | 'point' | 'spot';
  color: pc.Color;
  intensity: number;
  // point/spot only:
  position?: pc.Vec3;
  range?: number;
  // directional only:
  eulerAngles?: pc.Vec3;
  // runtime refs (not exported):
  entity: pc.Entity;
  gizmoEntity: pc.Entity;
}
```

At init, the editor reads the current lights from the PlayCanvas scene (from the "Lighting" entity's children) to populate initial state. No hardcoded values — it reads whatever is live.

---

## Panel UI

A fixed-position, draggable panel (top-right by default). Dark theme matching the existing debug tools aesthetic.

### Structure

```
┌─────────────────────────────────┐
│ 💡 Light Editor [LIGHT]     [✕] │  ← draggable header, [C] toggles LIGHT/CAMERA
├─────────────────────────────────┤
│ LIGHTS                          │
│ ● KeyLight          [DIR] [👁]  │  ← selected (highlighted)
│ ● FillLight         [DIR] [👁]  │
│ ● RimLight          [PT]  [👁]  │
│ ● KeyboardLightL    [PT]  [👁]  │
│ ● KeyboardLightR    [PT]  [👁]  │
│ ＋ Add light…   [Point ▾]       │
├─────────────────────────────────┤
│ KeyLight — Directional          │  ← properties for selected light
│                                 │
│ Color  [■ swatch] [1.0 0.95 0.85] │
│ Intensity ────────●─── 1.2      │
│ Direction (euler °)             │
│ [X: 35] [Y: 20] [Z: 0]         │
│                                 │
│ [    Delete    ]                │
├─────────────────────────────────┤
│ [  Copy TS to clipboard  ]      │
│ [     Reset camera       ]      │  ← visible in CAMERA mode only
└─────────────────────────────────┘
```

### Light List

- Each row shows: color swatch dot, name, type badge (DIR / PT / SPOT), visibility toggle eye icon
- Selected light is highlighted
- Clicking a row selects it and updates the properties section below
- Color swatch dot is colored to match the light's current color

### Properties Section (per light type)

**All lights:**
- **Color:** native `<input type="color">` swatch + three `<input type="number">` fields for R/G/B (0–1 range)
- **Intensity:** range slider (0–10, step 0.05) + numeric display

**Point / Spot only:**
- **Position:** three number inputs (X / Y / Z), updated live when gizmo is dragged
- **Range:** range slider (1–100, step 0.5)

**Directional only:**
- **Direction:** three number inputs (X / Y / Z euler degrees), updated live when arrow gizmo is dragged

**All lights:**
- **Delete** button (red, removes light entity, gizmo, and panel row)

### Add Light

A dashed "+ Add light…" row at the bottom of the list with a type dropdown (Point / Directional / Spot). Clicking adds a new light at position (0, 0, 0) / angles (0, 0, 0) with neutral white color and intensity 1.0, and immediately selects it.

### Visibility Toggle

Eye icon per light. Toggles `entity.enabled` — lets you solo or mute lights without deleting them. Disabled lights are still exported as enabled (visibility is editor-only).

### Export

"Copy TS to clipboard" button at the panel footer. Generates the exact TypeScript block that replaces the lighting section in `scene-graph.ts` and copies it to the clipboard. Format matches the existing code style:

```ts
// ── Lighting ──────────────────────────────────────────────────────────────
const lighting = new pc.Entity("Lighting");

const keyLight = new pc.Entity("KeyLight");
keyLight.addComponent("light", {
  type: "directional",
  color: new pc.Color(1.0, 0.95, 0.85),
  intensity: 1.2,
  castShadows: false,
});
keyLight.setLocalEulerAngles(35, 20, 0);
lighting.addChild(keyLight);

// ... (one block per light)

app.root.addChild(lighting);
```

---

## Scene Gizmos

### Point / Spot Lights — Sphere Marker

- A small sphere mesh entity added to `app.root` at the light's world position
- Color matches the light color
- On **mousedown** over the sphere: enters drag mode
- During drag: raycasts against the Z=0 plane (the scene's natural working plane), updates `LightState.position` and the real light entity's position live
- Panel XYZ inputs update in sync

### Directional Lights — Arrow Marker

- A cone+cylinder arrow entity pointing in the light's direction, positioned at a fixed reference point in the scene (e.g. (0, 2, 0)) for visibility
- Color matches the light color
- On **mousedown** over the arrow: enters rotation drag mode
- During drag: maps mouse delta to euler angle changes, updates `LightState.eulerAngles` and the real light entity's rotation live
- Panel euler inputs update in sync

### Gizmo Selection Highlight

Selected light's gizmo gets an emissive highlight (brighter, slightly enlarged) to indicate selection. Matches which light is selected in the panel.

### Gizmo Lifecycle

- Created for all existing lights at editor init
- Created immediately when "Add light" is clicked
- Destroyed when a light is deleted
- All gizmos destroyed when the panel close button is clicked

---

## Editor Modes

The editor operates in one of two modes, toggled by pressing `C`. The current mode is shown in the panel header.

| Mode | Panel label | Scroll wheel | Middle mouse |
|------|-------------|--------------|--------------|
| **Light** (default) | `💡 Light Editor [LIGHT]` | Randomise lights | — |
| **Camera** | `💡 Light Editor [CAMERA]` | Zoom (dolly) | Orbit / Pan |

Switching mode is instant — no state is lost. Light gizmos remain visible in camera mode (useful for seeing how camera angle affects lighting).

---

## Random Lighting (Scroll Wheel — Light Mode)

When the mouse wheel scrolls over the canvas in **Light mode**, a new random lighting setup is generated and applied live. Preserves the current light **count and types** — only randomizes:

- **Color:** random hue, medium-high saturation, high value (HSV → RGB)
- **Intensity:** random within a sensible range per type (directional: 0.3–2.0, point: 0.5–4.0)
- **Position** (point/spot): random within a bounding box that covers the scene (roughly ±5 x, ±5 y, 0–15 z)
- **Euler angles** (directional): random X (-60–60°), Y (-180–180°), Z 0°

The panel and gizmos update live. Each scroll tick generates a new random setup (no debounce — fast iteration is the point). The user can stop scrolling when they like what they see, then fine-tune via the panel.

---

## Camera Navigation (Camera Mode)

Blender viewport controls, active only while the editor is in **Camera mode**. Operates on the existing `CameraRig` + `MainCamera` entities from the scene graph — no new camera entities are created.

### Controls

| Input | Action |
|-------|--------|
| Middle mouse drag | Orbit around pivot point |
| Shift + middle mouse drag | Pan (truck camera laterally) |
| Scroll wheel | Zoom (dolly in/out along view axis) |
| `Numpad 0` or `Home` | Reset to initial position |

### Orbit

Pivot point is the world origin (0, 0, 0) by default. Horizontal mouse delta rotates the CameraRig around the Y axis; vertical delta rotates around the CameraRig's local X axis, clamped to ±89° to prevent gimbal flip.

### Pan

Shifts the CameraRig position laterally (X/Y) in camera space, moving the pivot with it.

### Zoom

Moves the camera entity along its local Z axis (dolly), clamped to a minimum distance of 0.5 units from the pivot.

### Reset

Pressing `Numpad 0` or `Home` (or a **Reset camera** button in the panel) restores the exact initial state:
- CameraRig position: (0, 0, 0), rotation: (0, 0, 0)
- Camera local position: (0, 0, 7)

No export for camera — it is a navigation aid only.

### Conflict prevention

All camera navigation mouse events call `event.preventDefault()` to suppress browser defaults (context menu, scroll). The middle mouse button is only captured when the canvas has focus (pointer is over the canvas).

---

## Data Flow

```
Scroll wheel (Light mode)
    └─→ randomize() → LightState[] → applyToScene() + updatePanel()

Scroll wheel (Camera mode)
    └─→ dolly camera along view axis

Middle mouse drag (Camera mode)
    └─→ orbit or pan CameraRig

Panel input change
    └─→ LightState update → applyToScene() + updateGizmo()

Gizmo drag
    └─→ LightState update → applyToScene() + updatePanel()

"Copy TS" button
    └─→ generateTypeScript(LightState[]) → clipboard

C key
    └─→ toggle mode → update panel header label

Reset (button or Numpad0/Home, Camera mode)
    └─→ restore CameraRig + camera to initial transform
```

`applyToScene()` is the single function that writes `LightState` values to the real PlayCanvas light entities. Panel and gizmo updates are kept separate so each can be called independently.

---

## File Structure

```
src/debug/
  light-editor.ts    # new — the full editor (panel + gizmos + camera nav + state)
  frustum-markers.ts # existing — unchanged
```

`main.ts` gains a small dev-only block (3–4 lines) to register `window.__le`.

No new dependencies. Uses PlayCanvas APIs already present, and the browser's native Clipboard API.

---

## Non-Goals

- No save/load of JSON presets (export is TS only)
- No undo/redo
- No light linking or shadow control
- No production build inclusion — entirely behind `import.meta.env.DEV`
- No spot light cone angle control (spot is treated as point for positioning; cone angle left at default)
- No camera export — camera navigation is a temporary viewing aid only
