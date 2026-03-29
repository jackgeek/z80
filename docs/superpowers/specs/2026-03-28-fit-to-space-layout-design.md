# Fit-to-Space Scene Layout Design

**Date:** 2026-03-28
**Status:** approved

---

## Goal

Rewrite the entity positioning logic in `src/scene/scene-layouts.ts` so all scene elements are sized and placed relative to the actual frustum bounds with no gaps, no off-screen clipping, and no overlap. The frustum corner markers (from `src/debug/frustum-markers.ts`) are the visual ground truth.

---

## What Changes

Only `src/scene/scene-layouts.ts` is modified. Everything else stays the same.

---

## Unit Dimensions (world space at entity scale 1)

These constants already exist or are derivable from the codebase:

| Entity   | Unit Width | Unit Height | Source |
|----------|-----------|-------------|--------|
| Monitor  | 3.08      | 2.2         | `MONITOR_UNIT_W` + `monVisualH` approximation in current code |
| Keyboard | 3.076     | 1.927       | `KB_UNIT_W` + `FLATED_H` in current code |

Add `MONITOR_UNIT_H = 2.2` and `KB_UNIT_H = 1.927` as named constants (alongside existing `MONITOR_UNIT_W` and `KB_UNIT_W`).

---

## Layout Algorithm

### Shared preamble (all scenes)

```
frustum bounds: left, right, top, bottom  (with MARGIN = 0.08 applied)
usableW = right - left

ctrlScale = clamp(usableW * 0.08, 0.3, 0.6)
ctrlRowH  = ctrlScale * 1.2   (unchanged from current)

// Bottom of the content area (above controls + a small gap)
GAP = 0.06  // small uniform gap between stacked elements
contentBottom = bottom + ctrlRowH + GAP
contentH      = top - contentBottom
```

### Portrait (portrait1 and portrait2)

```
// Split content height equally between monitor and keyboard
elemH = (contentH - GAP) / 2

// Scale each to fill elemH, clamped to not exceed usableW
monScale = min(elemH / MONITOR_UNIT_H, usableW / MONITOR_UNIT_W)
kbScale  = min(elemH / KB_UNIT_H,     usableW / KB_UNIT_W)

// Vertical centres (bottom element first, then top element)
lowerCenterY = contentBottom + elemH / 2
upperCenterY = contentBottom + elemH + GAP + elemH / 2

// portrait1: keyboard on top, monitor below
keyboard Y = upperCenterY,  rotation = FLAT (no tilt — fills full height)
monitor  Y = lowerCenterY

// portrait2: monitor on top, keyboard below
monitor  Y = upperCenterY
keyboard Y = lowerCenterY,  rotation = FLAT

// Horizontal: both centred at X = 0
// Controls: joystick at left edge, fire at right edge, menu at centre
joystick   position = (left,  bottom + ctrlRowH/2, 0)
fireButton position = (right, bottom + ctrlRowH/2, 0.4)
menuButton position = (0,     bottom + ctrlRowH/2, 0.4)
```

KB_TILT rotations are removed for portrait — with elements filling their allocated space exactly, tilt would cause the keyboard to visually overflow its region.

### Landscape

```
gap         = usableW * 0.03
halfPanelW  = (usableW - gap) / 2
leftCenterX = left  + halfPanelW / 2
rightCenterX= right - halfPanelW / 2

// Each element fills the full content height and its half-panel width
monScale = min(contentH / MONITOR_UNIT_H, halfPanelW / MONITOR_UNIT_W)
kbScale  = min(contentH / KB_UNIT_H,     halfPanelW / KB_UNIT_W)

centerY = contentBottom + contentH / 2   // vertically centred in content area

monitor  position = (leftCenterX,  centerY, 0), rotation = FLAT
keyboard position = (rightCenterX, centerY, 0), rotation = FLAT

// Controls span full width at bottom
joystick   position = (left,  bottom + ctrlRowH/2, 0)
fireButton position = (right, bottom + ctrlRowH/2, 0.4)
menuButton position = (0,     bottom + ctrlRowH/2, 0.4)
```

### Menu scenes (menuPortrait, menuLandscape)

Menu scenes push all background entities to `pushZ = -4` (behind the codex overlay at Z=0). The background entity positions use the same frustum-relative logic but with scales multiplied by 0.6 (menuPortrait) or 0.65 (menuLandscape), and entity X/Y positions proportionally shrunk by the same factor so they remain centred. The codex entity itself stays at Z=0. This preserves the existing visual behaviour — a smaller, recessed background behind the full-screen menu — using the new scale values as the base instead of the old ones.

---

## What Is Removed

- `KB_TILT_UP` and `KB_TILT_DOWN` rotations in portrait layouts (keyboard fills its slot; tilt would overflow)
- The `monVisualH` and `kbVisualH` derived variables (replaced by direct elemH calculation)
- Scale caps like `Math.min(1.4, ...)` — the fit-to-space calculation already enforces bounds

---

## Acceptance Criteria

- In portrait: no visible gap between controls row and the element stack; no gap between monitor and keyboard; nothing outside frustum marker corners
- In landscape: monitor and keyboard each fill their half-panel height with no overflow; controls span full width below
- All layouts survive viewport resize (frustum markers recheck on each resize)
- Menu scenes remain visually coherent at 0.6× scale

---

## Testing

Visual — run `bun run dev`, observe markers at corners, confirm:
1. Portrait: stack fills top-to-bottom from frustum top to control row bottom, no gaps
2. Landscape: both panels fill full content height, no gaps
3. Resize window — everything re-snaps correctly
4. Rotate to landscape — transition and final position both correct
