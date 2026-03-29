# Screen-Only Swipe Design

**Date:** 2026-03-29

## Problem

Scene-switching swipes can be triggered by dragging anywhere on the canvas, including on the keyboard. This causes accidental scene transitions when the user intends to tap a key.

## Goal

Swipe-to-switch-scene gestures should only begin when the pointer/touch starts on the monitor screen (the `screenQuad` entity). Drags starting on any other entity — keyboard keys, joystick, fire button, border area — do not initiate a scene transition.

## Design

### 1. Tag the screen quad (`src/entities/monitor.ts`)

After `screenQuad` is created and its render component is attached, add a `screen` tag:

```ts
screenQuad.tags.add('screen');
```

This is consistent with how all other interactive entities are tagged in this codebase (`spectrum-key`, `fire-button`, `menu-button`, `joystick`, `menu-codex`).

### 2. Include `screen` in the raycast (`src/input/input-bridge.ts`)

Add `'screen'` to the `otherTags` array in `raycastFromScreen` so AABB hit-testing covers it:

```ts
const otherTags = ['fire-button', 'menu-button', 'joystick', 'menu-codex', 'screen'];
```

### 3. Gate `beginTracking` on a screen hit (`src/input/input-bridge.ts`)

In `pointerDown`, only call `gestureDetector.beginTracking` when the initial touch lands on the `screen`-tagged entity:

```ts
function pointerDown(screenX: number, screenY: number): void {
  pendingDownX = screenX;
  pendingDownY = screenY;

  const hit = raycastFromScreen(app, camera, screenX, screenY);
  if (hit?.tags.has('screen')) {
    const viewportH = canvas.clientHeight || canvas.height;
    gestureDetector.beginTracking(screenY, viewportH);
  }

  if (menuOpen) {
    handlePointerDown(screenX, screenY);
    return;
  }
  pressSpectrumKey(screenX, screenY);
}
```

The `gestureDetector.beginTracking` call that was previously unconditional is now behind the screen-hit check. All other logic in `pointerDown` is unchanged.

## What doesn't change

- Scene swipe logic, commit threshold, progress interpolation — untouched
- `pointerMove` and `pointerUp` gesture handling — untouched (they already guard on `gestureDetector.isTracking()`)
- Keyboard press/release, joystick, fire button, menu button — untouched

## Files changed

| File | Change |
|------|--------|
| `src/entities/monitor.ts` | Add `screenQuad.tags.add('screen')` after entity creation |
| `src/input/input-bridge.ts` | Add `'screen'` to `otherTags`; gate `beginTracking` on screen hit |
