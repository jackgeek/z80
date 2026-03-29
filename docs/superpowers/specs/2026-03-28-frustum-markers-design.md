---
title: Viewport Frustum Corner Markers
date: 2026-03-28
status: approved
---

# Viewport Frustum Corner Markers

Debug tool that ray-casts from each viewport corner onto the Z=0 entity plane and places visible sphere markers there. Updates every frame so it stays accurate through scene transitions, resizes, and camera moves.

## Goal

Measure the world-space dimensions of the visible Z=0 plane for all scene layouts, with visual confirmation via corner markers.

## Approach

Use PlayCanvas `camera.screenToWorld(x, y, depth)` where depth = `camera.getLocalPosition().z`. This is the actual camera's world Z, which the scene transition system tweens to 6 (landscape) or 7 (portrait). No manual frustum math — the camera component does all projection.

## New File

**`src/debug/frustum-markers.ts`**

- `createFrustumMarkers(app, camera)` — creates 4 small sphere entities (scale 0.15), adds to `app.root`, returns a `FrustumMarkers` object
- `FrustumMarkers.update()` — reads current `camera.getLocalPosition().z`, calls `screenToWorld` for all 4 corners, moves spheres, logs width/height/corners to console

Sphere color-coding:
- Top-left: red `(1, 0, 0)`
- Top-right: green `(0, 1, 0)`
- Bottom-left: blue `(0, 0, 1)`
- Bottom-right: yellow `(1, 1, 0)`

All spheres: emissive material (not affected by scene lighting), `castShadows: false`.

## Wiring in `main.ts`

`update()` is called inside the existing `app.on('update', ...)` loop every frame. This ensures markers track the camera through all tweens and resizes with zero additional event wiring.

No changes to `scene-graph.ts`, `scene-transitions.ts`, or `scene-layouts.ts`.

## Console Output

Every frame (or throttled):
```
[FrustumMarkers] W=5.45 H=7.27 | TL=(-2.72, 3.64) TR=(2.72, 3.64) BL=(-2.72, -3.64) BR=(2.72, -3.64)
```

Throttled to once per second to avoid console spam.
