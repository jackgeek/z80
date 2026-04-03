# Light Editor: Seeded Random Lighting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace non-deterministic `Math.random()` in `randomizeLights()` with a seeded PRNG so scrolling back restores previous lighting setups.

**Architecture:** Add `mulberry32` as a module-level PRNG factory. Add a `seeds: number[]` array and `seedIndex` cursor inside `createLightEditor`. Change `randomizeLights` to accept a seed, create a local `rand` function from it, and replace all `Math.random()` / `rnd()` calls with `rand()`. Update `onWheelFull` to advance/retreat the cursor and call `randomizeLights(seeds[seedIndex])`.

**Tech Stack:** TypeScript strict, single file `src/debug/light-editor.ts`, no new dependencies.

---

### Task 1: Add mulberry32 and update `randomizeLights` signature

**Files:**
- Modify: `src/debug/light-editor.ts`

**Context:**

The file currently has at module level:
- `readLightsFromScene` (line ~28)
- `createLightEditor` (line ~55)

Inside `createLightEditor`, around line 675:
```ts
function rnd(min: number, max: number): number { return min + Math.random() * (max - min); }

function randomizeLights(): void {
  lights.forEach(ls => {
    const [r, g, b] = hsvToRgb(Math.random(), rnd(0.5, 0.9), rnd(0.7, 1.0));
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
  if (lights[selectedIndex]) renderProps(lights[selectedIndex]);
  refreshRows();
}
```

**Steps:**

- [ ] **Step 1: Add `mulberry32` as a module-level function**

  Add this function at module level, immediately before `readLightsFromScene` (which is before `export function createLightEditor`):

  ```ts
  function mulberry32(seed: number): () => number {
    return function() {
      seed |= 0;
      seed = seed + 0x6D2B79F5 | 0;
      let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 0x100000000;
    };
  }
  ```

- [ ] **Step 2: Replace `rnd` standalone function and update `randomizeLights` signature**

  Replace the existing `rnd` + `randomizeLights` block:

  ```ts
  // REMOVE THIS:
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
    if (lights[selectedIndex]) renderProps(lights[selectedIndex]);
    refreshRows();
  }
  ```

  With:

  ```ts
  function randomizeLights(seed: number): void {
    const rand = mulberry32(seed);
    const rnd = (min: number, max: number) => min + rand() * (max - min);
    lights.forEach(ls => {
      const [r, g, b] = hsvToRgb(rand(), rnd(0.5, 0.9), rnd(0.7, 1.0));
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
    if (lights[selectedIndex]) renderProps(lights[selectedIndex]);
    refreshRows();
  }
  ```

- [ ] **Step 3: Verify TypeScript compiles**

  Run: `cd /Users/jackallan/dev/z80 && npx tsc --noEmit`

  Expected: zero errors (or only the pre-existing `vite.config.ts` process error if present — that is unrelated).

- [ ] **Step 4: Commit**

  ```bash
  git add src/debug/light-editor.ts
  git commit -m "feat: add mulberry32 PRNG and seed randomizeLights"
  ```

---

### Task 2: Add seed history state and update `onWheelFull`

**Files:**
- Modify: `src/debug/light-editor.ts`

**Context:**

After Task 1, `randomizeLights(seed)` accepts a seed but nothing calls it correctly yet. The current `onWheelFull` still calls `randomizeLights()` with no argument (which will be a TS error after Task 1). We need to:
1. Add `seeds` array and `seedIndex` cursor near the top of `createLightEditor`
2. Update `onWheelFull` to implement scroll-forward / scroll-backward logic

The existing `onWheelFull` (around line 777) looks like:
```ts
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
```

**Steps:**

- [ ] **Step 1: Add `seeds` and `seedIndex` state**

  Near the top of `createLightEditor`, immediately after:
  ```ts
  let mode: EditorMode = 'light';
  ```

  Add:
  ```ts
  const seeds: number[] = [];
  let seedIndex = -1;
  ```

- [ ] **Step 2: Update `onWheelFull` to use seed history**

  Replace:
  ```ts
  function onWheelFull(e: WheelEvent): void {
    e.preventDefault();
    if (mode === 'light') {
      randomizeLights();
    } else {
  ```

  With:
  ```ts
  function onWheelFull(e: WheelEvent): void {
    e.preventDefault();
    if (mode === 'light') {
      if (e.deltaY > 0) {
        // scroll forward
        if (seedIndex < seeds.length - 1) {
          seedIndex++;
        } else {
          seeds.push(Math.random() * 0xFFFFFFFF | 0);
          seedIndex = seeds.length - 1;
        }
        randomizeLights(seeds[seedIndex]);
      } else if (e.deltaY < 0 && seedIndex > 0) {
        // scroll backward
        seedIndex--;
        randomizeLights(seeds[seedIndex]);
      }
    } else {
  ```

- [ ] **Step 3: Verify TypeScript compiles with zero errors**

  Run: `cd /Users/jackallan/dev/z80 && npx tsc --noEmit`

  Expected: zero errors (or only pre-existing unrelated errors).

- [ ] **Step 4: Verify dev build starts**

  Run: `cd /Users/jackallan/dev/z80 && bun run build 2>&1 | tail -20`

  Expected: build succeeds with no errors in `src/debug/light-editor.ts`.

- [ ] **Step 5: Manual smoke test**

  Open the dev server (`bun run dev`), open the browser console, call `__le()`.
  - Scroll forward several times → different lighting each time
  - Scroll backward → previous lighting restored exactly (same colors, intensities, positions)
  - Scroll forward again to the same position → same lighting as before
  - Scroll backward past index 0 → does nothing (stays at first setup)

- [ ] **Step 6: Commit**

  ```bash
  git add src/debug/light-editor.ts
  git commit -m "feat: seed history for bidirectional scroll randomisation"
  ```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Covered by |
|---|---|
| Scroll forward → new or already-seen setup | Task 2 Step 2 — `seedIndex < seeds.length - 1` branch revisits; else generates new |
| Scroll backward → same lights restored | Task 2 Step 2 — `seedIndex--` + `randomizeLights(seeds[seedIndex])` |
| Setups persistent for session lifetime | `seeds` array lives inside `createLightEditor` closure |
| `mulberry32` PRNG, module-level | Task 1 Step 1 |
| `randomizeLights(seed: number)` signature | Task 1 Step 2 |
| `rand` replaces `rnd` + `Math.random()` inside `randomizeLights` | Task 1 Step 2 |
| `seeds.push(Math.random() * 0xFFFFFFFF | 0)` for new seeds | Task 2 Step 2 |
| `seedIndex` starts at -1 | Task 2 Step 1 |
| No action when scrolling backward at index 0 | Task 2 Step 2 — `seedIndex > 0` guard |
| No action when scrolling backward at index -1 (nothing yet) | Task 2 Step 2 — `seedIndex > 0` guard covers this |

**Placeholder scan:** None found.

**Type consistency:** `randomizeLights(seed: number)` defined in Task 1, called with `randomizeLights(seeds[seedIndex])` in Task 2. `seeds` is `number[]`, `seedIndex` is `number`. Consistent.

**deltaY direction:** `WheelEvent.deltaY > 0` is scroll down (forward) as specified in the spec. Backward is `deltaY < 0`. The `else if (e.deltaY < 0 && seedIndex > 0)` — note that when `seedIndex === -1` (no setup applied yet), backward scroll correctly does nothing since `-1 > 0` is false.
