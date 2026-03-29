# Screen-Only Swipe Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restrict scene-switching swipe gestures so they only begin when the pointer/touch starts on the monitor screen, preventing accidental swipes from the keyboard area.

**Architecture:** Tag the `screenQuad` entity with `'screen'`, include it in the raycast hit-test, then gate `gestureDetector.beginTracking` on a screen hit in `pointerDown`. `pointerMove` and `pointerUp` already guard on `isTracking()`, so they require no changes.

**Tech Stack:** TypeScript, PlayCanvas (`pc.Entity.tags`), existing `raycastFromScreen` AABB pipeline in `input-bridge.ts`.

---

## Files

| File | Change |
|------|--------|
| `src/entities/monitor.ts` | Add `screenQuad.tags.add('screen')` after `screenQuad` is added to `monitor` |
| `src/input/input-bridge.ts` | Add `'screen'` to `otherTags` in `raycastFromScreen`; gate `beginTracking` on screen hit in `pointerDown` |

---

### Task 1: Tag the screen quad

**Files:**
- Modify: `src/entities/monitor.ts:110`

- [ ] **Step 1: Add the `screen` tag**

In `src/entities/monitor.ts`, after line 110 (`monitor.addChild(screenQuad);`), add:

```ts
screenQuad.tags.add('screen');
```

The surrounding context should look like:

```ts
  screenQuad.render!.meshInstances[0].material = screenMat;
  monitor.addChild(screenQuad);
  screenQuad.tags.add('screen');

  // ── Brass bezel frame ──
```

- [ ] **Step 2: Build and verify no TypeScript errors**

```bash
bun run build
```

Expected: build succeeds with no errors.

- [ ] **Step 3: Commit**

```bash
git add src/entities/monitor.ts
git commit -m "feat: tag screenQuad with 'screen' for swipe hit-testing"
```

---

### Task 2: Include `screen` in the raycast and gate `beginTracking`

**Files:**
- Modify: `src/input/input-bridge.ts` — `raycastFromScreen` function and `pointerDown` function

- [ ] **Step 1: Add `'screen'` to `otherTags` in `raycastFromScreen`**

Find the `otherTags` array in `raycastFromScreen` (around line 549):

```ts
  const otherTags = ['fire-button', 'menu-button', 'joystick', 'menu-codex'];
```

Change it to:

```ts
  const otherTags = ['fire-button', 'menu-button', 'joystick', 'menu-codex', 'screen'];
```

- [ ] **Step 2: Gate `beginTracking` on a screen hit in `pointerDown`**

Find `pointerDown` (around line 380). The current code is:

```ts
  function pointerDown(screenX: number, screenY: number): void {
    pendingDownX = screenX;
    pendingDownY = screenY;
    const viewportH = canvas.clientHeight || canvas.height;
    gestureDetector.beginTracking(screenY, viewportH);

    if (menuOpen) {
      handlePointerDown(screenX, screenY);
      return;
    }
    // Immediately press any spectrum key under the pointer
    pressSpectrumKey(screenX, screenY);
  }
```

Replace it with:

```ts
  function pointerDown(screenX: number, screenY: number): void {
    pendingDownX = screenX;
    pendingDownY = screenY;

    const screenHit = raycastFromScreen(app, camera, screenX, screenY);
    if (screenHit?.tags.has('screen')) {
      const viewportH = canvas.clientHeight || canvas.height;
      gestureDetector.beginTracking(screenY, viewportH);
    }

    if (menuOpen) {
      handlePointerDown(screenX, screenY);
      return;
    }
    // Immediately press any spectrum key under the pointer
    pressSpectrumKey(screenX, screenY);
  }
```

- [ ] **Step 3: Build and verify no TypeScript errors**

```bash
bun run build
```

Expected: build succeeds with no errors.

- [ ] **Step 4: Manual verification — swipe from screen works**

```bash
bun run dev
```

Open in browser. In portrait mode (keyboard on top, monitor below or vice versa):
1. Place finger/mouse on the monitor screen area
2. Drag vertically — the scene should transition (portrait1 ↔ portrait2)
3. Release past 25% drag — scene commits
4. Release before 25% drag — scene snaps back

- [ ] **Step 5: Manual verification — swipe from keyboard does NOT trigger scene transition**

1. Place finger/mouse on a keyboard key
2. Drag vertically — no scene transition should occur; the held key releases at 8px movement threshold as before
3. The scene stays put

- [ ] **Step 6: Manual verification — keyboard key presses still work**

1. Tap individual keys on the on-screen keyboard — they should press and release as before
2. No regression in key input

- [ ] **Step 7: Commit**

```bash
git add src/input/input-bridge.ts
git commit -m "feat: restrict scene swipe to screen area only"
```
