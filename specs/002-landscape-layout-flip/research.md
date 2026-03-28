# Research: Landscape Layout — Screen Left, Keyboard Right

## Decision 1: Which file(s) need to change?

**Decision**: Only `src/scene/scene-layouts.ts` needs to change — specifically the `landscape` and `menuLandscape` cases inside `computeLayout()`.

**Rationale**: All scene positioning is computed by `computeLayout()`. The rest of the pipeline (scene-transitions, scene-graph, input-bridge) reads positions from this function and applies them; they have no landscape-specific hardcoding that needs updating.

**Alternatives considered**: Modifying `scene-graph.ts` or `scene-transitions.ts` directly — rejected because those files consume layout data, they do not produce it.

---

## Decision 2: How to split the viewport into two halves

**Decision**: Divide the usable horizontal extent equally at X=0, with a small gap between the two panels. Use the available half-width to scale each element independently.

**Rationale**: The existing code already computes `left`, `right`, and `usableW` from the frustum. Splitting at the viewport centre (X=0) is the natural midpoint and avoids any bias.

```
usableW  = right - left                     (full usable width)
gap      = usableW * 0.03                   (3% separator, ~0.15 world units)
halfW    = (usableW - gap) / 2              (each panel's available width)

leftCenterX  = left + halfW / 2             (monitor X)
rightCenterX = right - halfW / 2            (keyboard X)
```

**Alternatives considered**: A 40/60 split favouring the keyboard — rejected because the monitor and keyboard are visually similar widths at their natural scales; a 50/50 split keeps them balanced.

---

## Decision 3: How to scale each element

**Decision**: Scale the monitor to fill its half-width (capped at 1.4 to avoid oversizing on very wide screens). Scale the keyboard to fill its half-width independently.

```
monScale = min(1.4, halfW / MONITOR_UNIT_W)
kbScale  = halfW / KB_UNIT_W
```

**Rationale**: Each element's natural width constant (`MONITOR_UNIT_W = 3.08`, `KB_UNIT_W = 3.076`) is already defined in the file. Using these gives a clean fill of each panel with no overlap.

**Alternatives considered**: Keeping the keyboard's scale matched to the monitor's scale (as portrait mode does) — rejected because in landscape each element has its own half-width to fill; matching them would leave one under-scaled.

---

## Decision 4: Vertical positioning of monitor and keyboard

**Decision**: Both elements are vertically centred in the space between the top of the viewport and the controls row, using the same `ctrlY` calculation already in the file.

```
ctrlY  = bottom + ctrlRowH * 0.5
centerY = (top + ctrlY + ctrlRowH * 0.5) / 2
```

**Rationale**: Landscape viewports are wide but short. Centering both elements in the remaining vertical space (above the controls row) maximises use of the viewport height.

---

## Decision 5: Controls row arrangement

**Decision**: Joystick at `left`, menu button at `0` (viewport centre), fire button at `right` — matching portrait mode.

**Rationale**: This is explicitly required by FR-008. The menu button is currently at `[right, top, 0.4]` in landscape (top-right corner), which is inconsistent with portrait. Moving it to the bottom centre aligns the control mental model across orientations.

---

## Decision 6: menuLandscape scene

**Decision**: Apply the same side-by-side split to `menuLandscape`, scaled down by the same factor used today (0.65 for monitor), with the keyboard visible at its corresponding scale. Both elements pushed back in Z by `pushZ = -4` as today.

**Rationale**: The menu overlay must remain coherent with the new baseline layout (FR-006). The keyboard was hidden in the old `menuLandscape`; with the new baseline showing it, the menu overlay should too.

---

## No NEEDS CLARIFICATION items remain.
