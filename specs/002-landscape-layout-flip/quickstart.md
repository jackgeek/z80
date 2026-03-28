# Quickstart: Landscape Layout — Screen Left, Keyboard Right

## What changes

One file: `src/scene/scene-layouts.ts`

Two switch cases inside `computeLayout()`:
- `landscape` — the primary layout change
- `menuLandscape` — updated to stay coherent with the new baseline

## How to verify

```bash
bun run dev
```

Open the browser, open DevTools, and use the Responsive Design Mode (or rotate a mobile device) to a landscape viewport (e.g., 812 × 375). Confirm:

1. Emulator screen is visible on the left half.
2. ZX Spectrum keyboard is visible on the right half.
3. No overlap between screen and keyboard.
4. All keyboard keys are pressable and register in the emulator.
5. Joystick is at bottom-left, menu button at bottom-centre, fire button at bottom-right.
6. Opening the menu overlay still works and all menu actions execute.

## Key constants (already defined in scene-layouts.ts)

| Constant        | Value   | Meaning                                |
|-----------------|---------|----------------------------------------|
| `MONITOR_UNIT_W`| 3.08    | Monitor world-space width at scale 1   |
| `KB_UNIT_W`     | 3.076   | Keyboard world-space width at scale 1  |
| `MARGIN`        | 0.08    | Edge inset fraction                    |
| `camZ`          | 6       | Camera Z for landscape scenes          |

## Layout maths (landscape case)

```
usableW      = right - left
gap          = usableW * 0.03
halfW        = (usableW - gap) / 2

leftCenterX  = left + halfW / 2       → monitor X
rightCenterX = right - halfW / 2      → keyboard X

monScale     = min(1.4, halfW / MONITOR_UNIT_W)
kbScale      = halfW / KB_UNIT_W

ctrlY        = bottom + ctrlRowH * 0.5
centerY      = (top + ctrlY + ctrlRowH * 0.5) / 2  → both elements' Y
```

Controls row: joystick at `left`, menu at `0`, fire at `right`.
