# Light Editor: Seeded Random Lighting Design Spec

**Date:** 2026-04-03
**Branch:** ver2
**Status:** Approved for implementation

## Overview

Replace the non-deterministic scroll-wheel randomisation in the light editor with a seeded PRNG so each scroll position maps to a reproducible lighting setup. Scrolling forward generates new setups; scrolling backward restores previous ones.

---

## Current Behaviour

`randomizeLights()` calls `Math.random()` directly. Each scroll tick produces a new unrepeatable setup with no way to return to a previous one.

---

## Desired Behaviour

- **Scroll forward:** advance to a new (or already-seen) setup
- **Scroll backward:** return to the previous setup — same lights, same values
- **Setups are persistent** for the lifetime of the editor session

---

## Architecture

All changes are confined to `src/debug/light-editor.ts`, inside `createLightEditor`. No new files.

### Seed History

```ts
const seeds: number[] = [];
let seedIndex = -1; // -1 = no setup applied yet
```

`seeds` grows as the user scrolls forward into new territory. It never shrinks. `seedIndex` is the cursor into `seeds`.

### Scroll Direction

`WheelEvent.deltaY > 0` → scroll forward (new/next setup).
`WheelEvent.deltaY < 0` → scroll backward (previous setup).

### Scroll-Forward Logic

```
if seedIndex < seeds.length - 1:
    seedIndex++               // revisit an already-generated setup
else:
    seeds.push(randomSeed())  // generate a new seed
    seedIndex = seeds.length - 1
randomizeLights(seeds[seedIndex])
```

`randomSeed()` uses `Math.random() * 0xFFFFFFFF | 0` — a random 32-bit integer used as the PRNG seed.

### Scroll-Backward Logic

```
if seedIndex > 0:
    seedIndex--
    randomizeLights(seeds[seedIndex])
// if seedIndex === 0, already at first setup — do nothing
```

### PRNG: mulberry32

A simple, fast, good-quality 32-bit seeded PRNG. Module-level function, no dependencies:

```ts
function mulberry32(seed: number): () => number {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 0x100000000;
  };
}
```

Returns a function `rand()` that produces floats in [0, 1) from the given seed. Calling `mulberry32(seed)` twice with the same seed produces identical sequences.

### `randomizeLights(seed: number)`

Signature changes from `randomizeLights(): void` to `randomizeLights(seed: number): void`.

Inside, a fresh PRNG instance is created from the seed at the top of the function:

```ts
const rand = mulberry32(seed);
```

The existing `rnd(min, max)` helper is replaced inline with:

```ts
const rnd = (min: number, max: number) => min + rand() * (max - min);
```

All `Math.random()` calls in the per-light loop are replaced with `rand()`. The rest of the function body is unchanged.

---

## Data Flow

```
Scroll forward (deltaY > 0)
    └─→ advance seedIndex (generate new seed if at end)
    └─→ randomizeLights(seeds[seedIndex])
        └─→ mulberry32(seed) → rand()
        └─→ per-light: color, intensity, position/euler via rand()
        └─→ applyToScene + updateGizmoColor + updateGizmoTransform
        └─→ renderProps + refreshRows

Scroll backward (deltaY < 0)
    └─→ decrement seedIndex (floor at 0, no-op if already 0)
    └─→ randomizeLights(seeds[seedIndex])  ← same path, deterministic replay
```

---

## Non-Goals

- No persistence across sessions (seeds live only in memory for the editor's lifetime)
- No UI display of current seed index
- No ability to enter a seed manually
