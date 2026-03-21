# Steam-Punk 3D UI — Design Document

## Context

The ZX Spectrum 48K emulator currently uses a traditional HTML/CSS/DOM UI with Three.js for an optional 3D cube effect. This redesign replaces the entire frontend with a **PlayCanvas WebGL 3D scene** featuring a 1980s steampunk aesthetic, using **XState v5** for scene state management. All emulator controls (ROM/tape loading, save, reset, pause, turbo, joystick type) migrate into a **Da Vinci cryptex-style Menu Codex** cylinder.

The WASM Z80 core, audio worklet, tape/snapshot parsers, and emulator state management remain unchanged.

---

## 1. Goals

1. Replace the DOM-based UI with a full-viewport PlayCanvas 3D scene
2. Render all UI elements (monitor, keyboard, joystick, fire button, menu) as interactive 3D entities with procedurally-generated steampunk brass/copper materials
3. Implement 5 scene layouts with smooth tween-based transitions driven by XState v5
4. Render the WASM emulator screen as a dynamic texture on a 3D monitor model
5. Build a fully interactive 3D ZX Spectrum keyboard with individually pressable keys
6. Create a spinning cryptex cylinder menu (Menu Codex) containing all emulator controls
7. Support portrait/landscape orientation with automatic scene switching
8. Maintain full emulator functionality (keyboard input, joystick, tape/ROM loading, snapshots, audio)
9. Zero scrollbars — viewport is 100% PlayCanvas canvas

---

## 2. User Stories

- **As a user**, I want to see the emulator output on a steampunk-styled 3D monitor so the experience feels immersive
- **As a user**, I want to type on a 3D replica of the ZX Spectrum keyboard by tapping/clicking individual keys
- **As a user**, I want to use a touch joystick and fire button for game input on mobile
- **As a user**, I want to swipe the monitor or keyboard to swap their positions (portrait mode)
- **As a user**, I want the layout to automatically adapt when I rotate my device
- **As a user**, I want to open a spinning brass cylinder menu to access emulator controls (load tape, save state, reset, etc.)
- **As a user**, I want all transitions between scenes to feel smooth and physical

---

## 3. UI Elements

| Element | Description | Interaction |
|---------|-------------|-------------|
| **Monitor** | 3D CRT with brass frame, rivets, steam pipes. WASM screen rendered as dynamic texture (256x192 RGBA, NEAREST filtering, self-lit emissive). Border color applied to frame glow. | Swipeable (portrait mode) to trigger scene change |
| **Keyboard** | 3D ZX Spectrum 48K keyboard. ~40 individually pressable key entities on a dark body with brass trim and rainbow stripe. Key labels rendered as canvas textures. Sticky CAPS/SYM modifiers with visual feedback. | Tap/click keys to send keyDown/keyUp to WASM. Swipeable (portrait mode). |
| **Joystick** | 3D brass joystick on a cylindrical base. 4-directional with diagonal support. | Touch/mouse drag for direction. Maps to Sinclair/Cursor/Kempston. |
| **Fire Button** | Red dome button on brass base. | Tap/click to fire. Press animation. |
| **Menu Button** | Brass gear-shaped button. | Tap/click to open Menu Codex (sends MENU_OPEN to XState). |
| **Menu Codex** | Da Vinci cryptex — brass cylinder with engraved menu text, decorative end caps and bands. Options on cylinder surface. Selection arrows at center. | Spin via mouse/touch drag (with inertia + snap). Select via tap/click/Enter. Arrow keys to step. |

### Menu Codex Options (migrated from current UI buttons)

| Option | Action |
|--------|--------|
| Load Tape | Triggers hidden `<input type="file">` for .tap/.tzx/.z80/.zip |
| Load ROM | Triggers hidden `<input type="file">` for .rom/.bin |
| Save State | Calls `saveZ80()` to download .z80 snapshot |
| Reset | Calls WASM `init()` + reloads cached ROM |
| Pause / Resume | Toggles pause state |
| Turbo Mode | Toggles turbo (50 frames/tick) |
| Joystick Type | Cycles Sinclair 1 → Cursor → Kempston |
| Close Menu | Dismisses the codex (sends MENU_CLOSE to XState) |

---

## 4. Scene Compositions

### Scene 1: Portrait 1
Keyboard top, Monitor middle, Joystick bottom-left, Fire bottom-right, Menu bottom-center. Codex off-screen.

### Scene 2: Portrait 2
Monitor top, Keyboard middle. Bottom controls same as Scene 1.

### Scene 3: Landscape
Monitor center (scaled up), Joystick lower-left, Fire lower-right, Menu top-right. Keyboard off-screen.

### Scene 4: Menu Portrait
Current portrait scene pushed back on Z-axis + depth-of-field blur. Codex centered.

### Scene 5: Menu Landscape
Current landscape scene pushed back + blurred. Codex centered (scaled up).

---

## 5. State Machine (XState v5)

```
portrait1 ←→ portrait2      (entity-targeted swipe on Monitor/Keyboard)
portrait1/2 → landscape     (orientation change)
landscape → portrait1/2     (orientation change, restores last portrait via context)
any scene → menu            (menu button click)
menu → previous scene       (menu dismiss or codex Close option)
menuPortrait ←→ menuLandscape (orientation change while menu open)
```

**Context**: `{ lastPortraitScene: 'portrait1' | 'portrait2', orientation, previousScene }`

Entry actions trigger tween transitions. Menu entry enables depth-of-field; menu exit disables it.

The user-provided XState implementation sketch (in the feature spec) is the basis — with actions wired to PlayCanvas tween functions.

---

## 6. File Structure

### New files

```
src/
  scene/
    app.ts                 # PlayCanvas Application bootstrap (FILLMODE_FILL_WINDOW, RESOLUTION_AUTO)
    scene-graph.ts         # Builds entity hierarchy, returns SceneEntities interface
    scene-layouts.ts       # Position/rotation/scale for each entity in each of 5 scenes
    scene-transitions.ts   # Tween engine: animates entities between layouts (easeInOutSine, ~600ms)
    camera-rig.ts          # Camera entity + depth-of-field post-processing for menu blur
  entities/
    monitor.ts             # CRT monitor: brass frame, screen plane with dynamic pc.Texture, rivets, pipes
    keyboard3d.ts          # 3D keyboard: body, trim, 4 rows of key entities from ROWS data
    joystick3d.ts          # Joystick: base cylinder + stick + ball, touch drag interaction
    fire-button.ts         # Fire button: brass base + red dome, press animation
    menu-button.ts         # Gear-shaped button
    menu-codex.ts          # Cryptex cylinder: body, end caps, decorative bands, text texture, selection arrows
  materials/
    material-factory.ts    # createProceduralTexture() helper using canvas
    brass.ts               # PBR brass: diffuse(0.78,0.57,0.11), metalness 0.9, brushed normal map
    copper.ts              # PBR copper: diffuse(0.72,0.45,0.20), green patina spots, rougher
    aged-metal.ts          # Dark iron with rust, used for rivets/structural parts
    rubber-key.ts          # Non-metallic dark teal (matching Spectrum keys)
    glass-crt.ts           # Transparent overlay with subtle reflection (optional)
  state-machine/
    machine.ts             # XState v5 setup() + createMachine() — scene state machine
    actions.ts             # Connects XState actions to PlayCanvas transition functions
    guards.ts              # Orientation and history guards
  input/
    input-bridge.ts        # Routes PlayCanvas mouse/touch/keyboard events to WASM + XState
    gesture-detector.ts    # Entity-targeted swipe detection (threshold 50px, max 500ms)
    codex-interaction.ts   # Cryptex spin: drag, inertia (friction 0.95), snap to nearest item
  ui/
    status-overlay.ts      # PlayCanvas 2D screen element for status text
    file-handler.ts        # Drag-drop + hidden <input> file handling (extracted from old ui.ts)
  data/
    key-layout.ts          # VKeyDef interface + ROWS array extracted from vkeyboard.ts
```

### Modified files

| File | Changes |
|------|---------|
| `src/main.ts` | Complete rewrite: init PlayCanvas → build scene → create XState actor → init input → init WASM → detect orientation |
| `src/index.html` | Minimal: `<canvas id="app-canvas">` + `<input type="file" hidden>` + no-scroll CSS. ~30 lines. |
| `src/emulator/frame-loop.ts` | Remove rAF loop. Export `tickEmulatorFrame()` called from PlayCanvas update event. Remove `renderFrame`/`renderDebugView` imports. Remove DOM status writes. |
| `src/emulator/wasm-loader.ts` | Remove `document.getElementById` calls. Accept status callback instead. Remove `initDebugView` call. |
| `src/media/tape.ts` | Replace `document.getElementById('status')` with imported `setStatusText()` |
| `src/media/snapshot.ts` | Replace DOM references with status callback. Keep download `<a>` trick. |
| `src/input/keyboard.ts` | Keep `KEY_MAP` and `COMPOUND_KEYS` exports. Remove `attachKeyboardHandlers()`. |

### Removed files

| File | Replaced by |
|------|-------------|
| `src/video/screen.ts` | `entities/monitor.ts` (dynamic texture from WASM buffer) |
| `src/video/cube.ts` | Entire PlayCanvas scene replaces the Three.js cube |
| `src/input/vkeyboard.ts` | `entities/keyboard3d.ts` + `data/key-layout.ts` |
| `src/input/joystick.ts` | `entities/joystick3d.ts` |
| `src/ui/ui.ts` | `ui/file-handler.ts` + Menu Codex + XState actions |
| `src/debug/debug-view.ts` | Deferred to future phase |

### Dependency changes

```
REMOVE: three, @types/three
ADD:    playcanvas, xstate
```

Install: `bun add playcanvas xstate && bun remove three @types/three`

---

## 7. Render Loop Integration

Current: standalone `requestAnimationFrame` → `wasm.frame()` → `renderFrame()` (WebGL texSubImage2D)

New: PlayCanvas owns the rAF loop. Integration via `app.on('update')`:

```
PlayCanvas update event (every frame)
  ├── Accumulate time, tick emulator at 50Hz:
  │     tickEmulatorFrame() → wasm.frame() + pushAudioFrame()
  ├── Update monitor dynamic texture:
  │     Copy Uint8Array from WASM buffer (getScreenBaseAddr()) → pc.Texture lock/unlock
  ├── Update border color on monitor frame glow
  ├── Update tween animations (updateTweens(dt))
  └── PlayCanvas renders scene automatically
```

The dynamic texture uses `pc.FILTER_NEAREST` for pixel-perfect Spectrum rendering and `pc.PIXELFORMAT_RGBA8` matching the WASM RGBA buffer. The texture is 256x192 — only ~192KB per frame copy, trivially fast.

---

## 8. Input Pipeline

### Flow A: Physical keyboard → WASM
```
Browser keydown/keyup → input-bridge.ts → KEY_MAP/COMPOUND_KEYS lookup → wasm.keyDown(row, bit)
```
Reuses existing `KEY_MAP` and `COMPOUND_KEYS` from [keyboard.ts](src/input/keyboard.ts).

### Flow B: 3D entity click/touch → WASM
```
PlayCanvas pointer event → raycast from camera → identify hit entity
  → spectrum-key tag: animate key press, wasm.keyDown(row, bit) from entity metadata
  → joystick: track drag direction, map to Sinclair/Cursor/Kempston input
  → fire-button: animate press, send fire input
  → menu-button: send MENU_OPEN to XState
  → codex: route to codex-interaction.ts
```

### Flow C: Swipe gesture → XState
```
Touch start on swipeable entity → track position → touch end
  → If vertical distance > 50px within 500ms on Monitor/Keyboard entity
    → Send SWIPE event to XState machine
```

### Flow D: Codex interaction → XState
```
Drag on codex → spin cylinder (with inertia, friction 0.95)
  → On stop: snap to nearest menu item
  → On tap/Enter: send CODEX_ACTIVATE with selected index
    → XState action executes corresponding emulator command
```

### Flow E: Arrow keys while menu open → Codex
```
ArrowUp/ArrowDown while in menuPortrait/menuLandscape state
  → Step codex to next/previous item (animate rotation)
Enter → activate selected item
```

---

## 9. Procedural Materials

All steampunk visuals are code-generated using PlayCanvas `StandardMaterial` with PBR properties and canvas-based procedural textures. No external 3D assets.

| Material | Diffuse | Metalness | Gloss | Special |
|----------|---------|-----------|-------|---------|
| Brass | (0.78, 0.57, 0.11) + noise | 0.9 | 0.7 | Brushed horizontal normal map |
| Copper | (0.72, 0.45, 0.20) + noise | 0.85 | 0.5 | Green patina spots in diffuse |
| Aged Metal | (0.25, 0.25, 0.28) | 0.7 | 0.3 | Rust spots, high roughness |
| Rubber Key | (0.22, 0.31, 0.29) | 0.0 | 0.2 | Non-metallic, slight sheen |
| Screen | N/A (dynamic WASM texture) | 0.0 | N/A | emissiveMap = screenTexture, useLighting = false |

---

## 10. Menu Codex Detail

Visual reference: Da Vinci cryptex — a brass cylinder with rotating letter rings and ornate end caps.

**Geometry**: Procedural cylinder (radius ~0.5, height ~2.5, 32 segments). Menu text rendered onto a 1024x512 canvas texture wrapped around the cylinder. Two brass end caps (flat cylinders, slightly larger radius). 3 decorative brass bands at intervals.

**Selection indicator**: Two arrow entities (brass triangles) fixed at the cylinder's center height, pointing inward from left and right.

**Interaction**:
- Mouse/touch drag on cylinder rotates it around its X-axis
- Inertia: velocity decays by 0.95/frame; snaps to nearest item when velocity < 0.1
- Tap/click (non-drag) or Enter key: activates the item at center position
- Arrow keys: step to next/previous item with animated rotation
- The cylinder's current rotation maps to a selected index: `Math.round(angle / (360 / itemCount)) % itemCount`

---

## 11. Non-Goals (Out of Scope)

- Debug memory visualization (deferred to future phase)
- Pre-made 3D model assets (all procedural for v1)
- ammo.js physics engine (using tweens instead)
- Multiple camera angles or free camera control
- Audio 3D spatialization
- Multiplayer or network features
- Settings persistence (localStorage) — deferred

---

## 12. Technical Considerations

- **PlayCanvas ESM**: The `playcanvas` npm package has a `"module"` field and works with Vite's bundler. Import as `import * as pc from 'playcanvas'`.
- **Bundle size**: PlayCanvas ~300-400KB minified (replacing Three.js ~300KB). XState v5 ~30KB. Net increase ~30KB.
- **Texture performance**: 256x192x4 = 196KB copied per frame at 50Hz. Trivially fast for modern GPUs.
- **Raycasting**: Use PlayCanvas collision components on key entities for ray-entity intersection. Group by row for hierarchical culling.
- **Key label textures**: Use a texture atlas (one 1024x256 canvas with all 40 key labels UV-mapped) rather than 40 individual textures, to reduce draw calls.
- **Depth-of-field**: For menu background blur, use PlayCanvas post-processing layer on camera. Fallback: push entities back on Z and reduce emissive/opacity.
- **No scrollbars**: `html, body { overflow: hidden }` + `touch-action: none` on body.
- **Version sync**: Bump patch version in both `package.json` and `src/index.html` after implementation (per project convention).

---

## 13. PlayCanvas Scene Graph

```
Root
├── CameraRig
│   └── MainCamera (perspective, FOV 45)
├── Lighting
│   ├── KeyLight (directional, warm, intensity 0.7)
│   ├── FillLight (directional, cool blue, intensity 0.2)
│   └── RimLight (point, amber, intensity 0.4)
├── Monitor (tagged: swipeable)
│   ├── BrassFrame (4 bezel boxes)
│   ├── ScreenQuad (plane, dynamic texture)
│   ├── Rivets (4 corner spheres)
│   └── SteamPipes (2 side cylinders)
├── Keyboard3D (tagged: swipeable)
│   ├── KeyboardBody (dark box)
│   ├── BrassEdgeTrim
│   ├── RainbowStripe
│   └── KeyRow0..3
│       └── Key_* (box + collision, tagged: spectrum-key)
├── Joystick3D
│   ├── JoystickBase (cylinder)
│   ├── JoystickStick (cylinder)
│   └── JoystickBall (sphere)
├── FireButton
│   ├── ButtonBase (cylinder)
│   └── ButtonCap (sphere, red)
├── MenuButton
│   ├── GearIcon (flattened cylinder)
│   └── ButtonRing (torus/ring)
└── MenuCodex (starts off-screen/disabled)
    ├── CylinderBody (cylinder + text texture)
    ├── EndCap_Top / EndCap_Bottom
    ├── DecorativeBand_0..2
    └── SelectionArrows (2 triangle entities)
```

---

## 14. Implementation Phases

### Phase 1: Foundation
1. Install `playcanvas` + `xstate`, remove `three` + `@types/three`
2. Create `src/scene/app.ts` — PlayCanvas bootstrap
3. Rewrite `src/index.html` — minimal canvas + no-scroll CSS
4. Create `src/materials/material-factory.ts` + `brass.ts`
5. Create `src/entities/monitor.ts` — brass frame + dynamic screen texture
6. Extract `src/data/key-layout.ts` from `vkeyboard.ts` (ROWS + VKeyDef)
7. Modify `src/emulator/frame-loop.ts` — export `tickEmulatorFrame()`
8. Modify `src/emulator/wasm-loader.ts` — remove DOM dependencies
9. Create `src/ui/status-overlay.ts` — PlayCanvas 2D text element
10. Rewrite `src/main.ts` — PlayCanvas init + WASM load + update loop
11. **Milestone**: Emulator runs with WASM screen visible on 3D brass monitor

### Phase 2: Keyboard + Input
1. Create `src/entities/keyboard3d.ts` — all 40 keys from ROWS data
2. Create `src/materials/rubber-key.ts`
3. Create `src/input/input-bridge.ts` — physical keyboard + raycast click/touch
4. Key press/release animations (tween Y translation)
5. Sticky modifier logic (CAPS/SYM latch)
6. Modify `src/input/keyboard.ts` — keep data exports, remove DOM handlers
7. **Milestone**: Full keyboard input works (physical + 3D tap/click)

### Phase 3: Controls + File Handling
1. Create `src/entities/joystick3d.ts`, `fire-button.ts`, `menu-button.ts`
2. Create `src/materials/copper.ts`, `aged-metal.ts`
3. Wire joystick drag → WASM input (Sinclair/Cursor/Kempston)
4. Wire fire button → WASM input
5. Create `src/ui/file-handler.ts` — drag-drop + hidden file input
6. Modify `src/media/tape.ts` + `snapshot.ts` — use status overlay
7. **Milestone**: All interactive elements work, files loadable via drag-drop

### Phase 4: State Machine + Scene Transitions
1. Create `src/state-machine/machine.ts` + `actions.ts` + `guards.ts`
2. Create `src/scene/scene-layouts.ts` — 5 layout definitions
3. Create `src/scene/scene-transitions.ts` — tween engine (easeInOutSine, ~600ms)
4. Create `src/scene/camera-rig.ts` — camera + DOF blur
5. Create `src/input/gesture-detector.ts` — entity-targeted swipe
6. Wire orientation detection → XState events
7. **Milestone**: Scene transitions work (portrait1↔2, landscape, orientation auto-switch)

### Phase 5: Menu Codex
1. Create `src/entities/menu-codex.ts` — cylinder + text + caps + bands + arrows
2. Create `src/input/codex-interaction.ts` — spin/drag/inertia/snap
3. Wire menu button → XState MENU_OPEN/MENU_CLOSE
4. Wire codex selection → emulator actions (load/save/reset/pause/turbo/joystick type)
5. DOF blur on menu open, clear on dismiss
6. Arrow key + Enter navigation while menu open
7. **Milestone**: Full menu system works

### Phase 6: Polish + Cleanup
1. Remove old files: `video/screen.ts`, `video/cube.ts`, `input/vkeyboard.ts`, `input/joystick.ts`, `ui/ui.ts`, `debug/debug-view.ts`
2. Fine-tune layout positions for all scenes (exact 3D coordinates)
3. Performance profiling — ensure 60fps on mobile
4. Version bump in `package.json` and `src/index.html`
5. Update docs

---

## 15. Verification Plan

1. `bun run dev` — verify PlayCanvas scene loads with steampunk monitor showing WASM output
2. Type on physical keyboard — verify key presses reach WASM (text appears in Spectrum BASIC)
3. Tap 3D keys — verify each key sends correct (row, bit) to WASM
4. Drag-drop a .tap file — verify it loads and runs
5. Resize browser window between portrait/landscape — verify scene transitions animate smoothly
6. In portrait mode, swipe up on monitor — verify transition to portrait2
7. Tap menu button — verify codex appears, background blurs
8. Spin codex, select "Reset" — verify emulator resets
9. Select "Close Menu" — verify return to previous scene
10. Test on mobile device — verify touch joystick, fire button, and swipe gestures work
11. `bun run build` — verify production build succeeds and `dist/` is deployable

---

## 16. Resolved Questions

1. **Exact 3D coordinates**: Build a debug mode with position readouts during development for iterative layout tuning. Add this as a dev-only overlay in Phase 1.
2. **Key label readability**: No zoom-on-focus or tooltip. Keep keys at their natural size.
3. **Joystick type**: Maintain the type selector in the Menu Codex (Sinclair 1 / Cursor / Kempston). Default to Sinclair 1.
4. **Audio init**: Any touch/click on any 3D entity triggers `initAudio()` on first interaction (browser autoplay policy).
