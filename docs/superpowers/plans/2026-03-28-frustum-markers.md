# Frustum Corner Markers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Place four colored sphere markers at the world-space corners of the Z=0 entity plane by ray-casting from viewport corners each frame, with dimensions logged to console.

**Architecture:** A new `src/debug/frustum-markers.ts` module creates 4 sphere entities with emissive materials and exposes an `update(dt)` method that reads the current camera Z, calls `camera.camera.screenToWorld()` for each canvas corner, repositions the spheres, and throttles a console log. `main.ts` calls `update(dt)` inside the existing `app.on('update')` loop.

**Tech Stack:** PlayCanvas (`pc.Entity`, `pc.StandardMaterial`, `CameraComponent.screenToWorld`), TypeScript strict.

---

### Task 1: Create `src/debug/frustum-markers.ts`

**Files:**
- Create: `src/debug/frustum-markers.ts`

No unit tests — this module depends entirely on a live PlayCanvas `Application` and `CameraComponent` with a real WebGL canvas. Testing is visual (run `bun run dev`, observe markers).

- [ ] **Step 1: Create the file**

```typescript
// Debug utility — places coloured sphere markers at the four corners of the
// Z=0 entity plane by casting rays from the viewport corners each frame.

import * as pc from 'playcanvas';

export interface FrustumMarkers {
  /** Call once per frame (pass dt in seconds) to reposition markers and log. */
  update(dt: number): void;
}

interface Marker {
  entity: pc.Entity;
  screenX: number; // 0 = left, canvas.width = right
  screenY: number; // 0 = top, canvas.height = bottom (PlayCanvas convention)
  label: string;
}

export function createFrustumMarkers(
  app: pc.Application,
  cameraEntity: pc.Entity
): FrustumMarkers {
  const colors: Array<[string, pc.Color]> = [
    ['TL', new pc.Color(1, 0, 0)],   // top-left     red
    ['TR', new pc.Color(0, 1, 0)],   // top-right    green
    ['BL', new pc.Color(0, 0, 1)],   // bottom-left  blue
    ['BR', new pc.Color(1, 1, 0)],   // bottom-right yellow
  ];

  const markers: Marker[] = colors.map(([label, color]) => {
    const entity = new pc.Entity(`FrustumMarker_${label}`);
    entity.addComponent('render', {
      type: 'sphere',
      castShadows: false,
    });

    const mat = new pc.StandardMaterial();
    mat.emissive = color;
    mat.emissiveIntensity = 1;
    mat.diffuse = new pc.Color(0, 0, 0);
    mat.update();
    entity.render!.meshInstances[0].material = mat;

    entity.setLocalScale(0.15, 0.15, 0.15);
    app.root.addChild(entity);

    // Placeholder screen coords — updated each frame
    return { entity, screenX: 0, screenY: 0, label };
  });

  const worldPos = new pc.Vec3();
  let logTimer = 0;

  return {
    update(dt: number): void {
      const cam = cameraEntity.camera;
      if (!cam) return;

      const canvas = app.graphicsDevice.canvas;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      const camZ = cameraEntity.getPosition().z;

      // Screen coords for each corner (PlayCanvas: 0,0 = top-left)
      const corners: Array<[number, number, string, Marker]> = [
        [0,     0,     'TL', markers[0]],
        [w - 1, 0,     'TR', markers[1]],
        [0,     h - 1, 'BL', markers[2]],
        [w - 1, h - 1, 'BR', markers[3]],
      ];

      let minX = Infinity, maxX = -Infinity;
      let minY = Infinity, maxY = -Infinity;

      const positions: Record<string, pc.Vec3> = {};

      for (const [sx, sy, label, marker] of corners) {
        cam.screenToWorld(sx, sy, camZ, worldPos);
        marker.entity.setPosition(worldPos.x, worldPos.y, 0);
        positions[label] = worldPos.clone();
        if (worldPos.x < minX) minX = worldPos.x;
        if (worldPos.x > maxX) maxX = worldPos.x;
        if (worldPos.y < minY) minY = worldPos.y;
        if (worldPos.y > maxY) maxY = worldPos.y;
      }

      logTimer += dt;
      if (logTimer >= 1) {
        logTimer = 0;
        const W = maxX - minX;
        const H = maxY - minY;
        const tl = positions['TL'];
        const tr = positions['TR'];
        const bl = positions['BL'];
        const br = positions['BR'];
        console.log(
          `[FrustumMarkers] W=${W.toFixed(3)} H=${H.toFixed(3)} camZ=${camZ.toFixed(2)}` +
          ` | TL=(${tl.x.toFixed(3)}, ${tl.y.toFixed(3)})` +
          ` TR=(${tr.x.toFixed(3)}, ${tr.y.toFixed(3)})` +
          ` BL=(${bl.x.toFixed(3)}, ${bl.y.toFixed(3)})` +
          ` BR=(${br.x.toFixed(3)}, ${br.y.toFixed(3)})`
        );
      }
    },
  };
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/jackallan/dev/z80 && bun run build 2>&1 | head -40
```

Expected: build succeeds (the new file isn't imported yet, so it won't be included — that's fine at this stage).

- [ ] **Step 3: Commit**

```bash
git add src/debug/frustum-markers.ts
git commit -m "feat: add frustum corner marker debug utility"
```

---

### Task 2: Wire markers into `main.ts`

**Files:**
- Modify: `src/main.ts`

- [ ] **Step 1: Add the import at the top of `main.ts`** (after the existing imports)

```typescript
import { createFrustumMarkers } from './debug/frustum-markers.js';
```

- [ ] **Step 2: Create markers after the scene graph is built**

After line `const entities = buildSceneGraph(app);` (step 2 in `main()`), add:

```typescript
  // DEBUG: frustum corner markers — remove when measurements confirmed
  const frustumMarkers = createFrustumMarkers(app, entities.camera);
```

- [ ] **Step 3: Call `update` inside the existing `app.on('update')` loop**

Inside the `app.on('update', (dt: number) => { ... })` callback, add one line at the end of the callback body (after `entities.codexInteraction.update(dt)`):

```typescript
    frustumMarkers.update(dt);
```

- [ ] **Step 4: Build and verify no TypeScript errors**

```bash
cd /Users/jackallan/dev/z80 && bun run build 2>&1 | tail -20
```

Expected: build completes with no errors, `dist/` updated.

- [ ] **Step 5: Run dev server and visually confirm**

```bash
bun run dev
```

Open the app in a browser. You should see:
- A **red** sphere at the top-left of the visible area
- A **green** sphere at the top-right
- A **blue** sphere at the bottom-left
- A **yellow** sphere at the bottom-right

Resize the window — all four spheres should move to stay at the viewport corners. Rotate to landscape — spheres reposition to the landscape frustum corners. Check the browser console for `[FrustumMarkers]` log lines with W/H dimensions.

- [ ] **Step 6: Commit**

```bash
git add src/main.ts
git commit -m "feat: wire frustum markers into update loop for visual measurement"
```
