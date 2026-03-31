# Remove Bezel, Pixel-Accurate Border Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the brass steampunk bezel from the 3D monitor and shrink the border to the real ZX Spectrum pixel-accurate ratio (0.125).

**Architecture:** Single file change to `src/entities/monitor.ts` — update one constant and delete all bezel geometry entities. The two flat quads (border plane + screen quad) remain.

**Tech Stack:** TypeScript, PlayCanvas

---

### Task 1: Update border fraction and remove bezel geometry

**Files:**
- Modify: `src/entities/monitor.ts`

- [ ] **Step 1: Change `BORDER_FRACTION` from `0.30` to `0.125`**

In `src/entities/monitor.ts`, line 13, change:

```ts
const BORDER_FRACTION = 0.30; // how much larger the border area is vs the screen
```

to:

```ts
const BORDER_FRACTION = 0.125; // pixel-accurate: 32px border / 256px display = 0.125
```

- [ ] **Step 2: Remove the `createBrassMaterial` import**

Remove line 3:

```ts
import { createBrassMaterial } from '../materials/brass.js';
```

- [ ] **Step 3: Remove all bezel geometry from `createMonitor`**

In `src/entities/monitor.ts`, delete everything from the `// ── Brass bezel frame` comment through to the end of the steam pipes loop — that is, delete this entire block (currently lines 114–180):

```ts
  // ── Brass bezel frame ─────────────────────────────────────────────────────
  const halfW = BORDER_W / 2 + BEZEL;
  const halfH = BORDER_H / 2 + BEZEL;
  const depth = 0.12;

  // Back plate (solid brass behind the border area)
  const backPlate = new pc.Entity('BackPlate');
  backPlate.addComponent('render', { type: 'box' });
  backPlate.setLocalScale(BORDER_W + BEZEL * 2, BORDER_H + BEZEL * 2, depth);
  backPlate.setLocalPosition(0, 0, 0);
  backPlate.render!.meshInstances[0].material = brassMat;
  monitor.addChild(backPlate);

  // Top bezel
  const topBezel = new pc.Entity('TopBezel');
  topBezel.addComponent('render', { type: 'box' });
  topBezel.setLocalScale(BORDER_W + BEZEL * 4, BEZEL, depth + 0.04);
  topBezel.setLocalPosition(0, halfH, 0.02);
  topBezel.render!.meshInstances[0].material = brassMat;
  monitor.addChild(topBezel);

  // Bottom bezel
  const bottomBezel = new pc.Entity('BottomBezel');
  bottomBezel.addComponent('render', { type: 'box' });
  bottomBezel.setLocalScale(BORDER_W + BEZEL * 4, BEZEL, depth + 0.04);
  bottomBezel.setLocalPosition(0, -halfH, 0.02);
  bottomBezel.render!.meshInstances[0].material = brassMat;
  monitor.addChild(bottomBezel);

  // Left bezel
  const leftBezel = new pc.Entity('LeftBezel');
  leftBezel.addComponent('render', { type: 'box' });
  leftBezel.setLocalScale(BEZEL, BORDER_H + BEZEL * 4, depth + 0.04);
  leftBezel.setLocalPosition(-halfW, 0, 0.02);
  leftBezel.render!.meshInstances[0].material = brassMat;
  monitor.addChild(leftBezel);

  // Right bezel
  const rightBezel = new pc.Entity('RightBezel');
  rightBezel.addComponent('render', { type: 'box' });
  rightBezel.setLocalScale(BEZEL, BORDER_H + BEZEL * 4, depth + 0.04);
  rightBezel.setLocalPosition(halfW, 0, 0.02);
  rightBezel.render!.meshInstances[0].material = brassMat;
  monitor.addChild(rightBezel);

  // ── Rivets at corners ─────────────────────────────────────────────────────
  const rivetPositions: [number, number][] = [
    [-halfW, halfH], [halfW, halfH], [-halfW, -halfH], [halfW, -halfH]
  ];
  for (const [x, y] of rivetPositions) {
    const rivet = new pc.Entity('Rivet');
    rivet.addComponent('render', { type: 'sphere' });
    rivet.setLocalScale(0.08, 0.08, 0.08);
    rivet.setLocalPosition(x, y, 0.08);
    rivet.render!.meshInstances[0].material = brassMat;
    monitor.addChild(rivet);
  }

  // ── Steam pipes along sides ───────────────────────────────────────────────
  for (const side of [-1, 1]) {
    const pipe = new pc.Entity('SteamPipe');
    pipe.addComponent('render', { type: 'cylinder' });
    pipe.setLocalScale(0.06, BORDER_H * 0.8, 0.06);
    pipe.setLocalPosition(side * (halfW + 0.08), 0, 0);
    pipe.render!.meshInstances[0].material = brassMat;
    monitor.addChild(pipe);
  }
```

Also delete the now-unused `const brassMat = createBrassMaterial(device);` line near the top of `createMonitor`.

- [ ] **Step 4: Verify the build compiles cleanly**

```bash
bun run build
```

Expected: No TypeScript errors. The `brass.js` import is gone, `brassMat` is gone, build succeeds.

- [ ] **Step 5: Verify visually in dev server**

```bash
bun run dev
```

Open the dev URL in a browser. Confirm:
- Monitor shows only the border color plane and screen quad — no brass frame, no rivets, no pipes
- Border area is visibly smaller than before
- Screen content (ZX Spectrum display) renders correctly
- Border color changes dynamically (e.g., load `hello.tap` and observe border color)
- All scenes (portrait, landscape) display correctly

- [ ] **Step 6: Commit**

```bash
git add src/entities/monitor.ts
git commit -m "feat: remove bezel and use pixel-accurate border fraction"
```
