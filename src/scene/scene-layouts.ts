// Responsive scene layouts — positions computed from camera frustum bounds

export interface EntityLayout {
  position: [number, number, number];
  rotation: [number, number, number]; // Euler degrees
  scale: [number, number, number];
  visible?: boolean;
}

export interface SceneLayout {
  monitor: EntityLayout;
  keyboard: EntityLayout;
  joystick: EntityLayout;
  fireButton: EntityLayout;
  menuButton: EntityLayout;
  menuCodex: EntityLayout;
  camera: EntityLayout;
}

// All entities face the camera directly — no tilt
const FLAT: [number, number, number] = [0, 0, 0];

// ── Frustum helpers ───────────────────────────────────────────────────────────

export interface FrustumBounds {
  halfW: number;
  halfH: number;
  camZ: number;
}

export function computeFrustum(fovDeg: number, aspect: number, camZ: number): FrustumBounds {
  const fovRad = (fovDeg * Math.PI) / 180;
  const halfH = camZ * Math.tan(fovRad / 2);
  const halfW = halfH * aspect;
  return { halfW, halfH, camZ };
}

// Inset margin from edges (fraction of half-extent)
const MARGIN = 0.08;
const GAP = 0.06;

// Monitor world-space dimensions at entity scale 1
// Border quad: SCREEN_W * (1 + 0.125) = 2.25, SCREEN_H * (1 + 0.125) = 1.6875
const MONITOR_UNIT_W = 2.25;
const MONITOR_UNIT_H = 1.6875;

// Keyboard world-space dimensions at entity scale 1
// GLB model has internal 13.2× scale: width = 0.233×13.2, height = 0.146×13.2
const KB_UNIT_W = 3.076;
const KB_UNIT_H = 1.927;

// ── Layout computation ────────────────────────────────────────────────────────

export function computeLayout(sceneName: string, fovDeg: number, aspect: number): SceneLayout | null {
  const camZ = sceneName.includes('landscape') ? 6 : 7;
  const f = computeFrustum(fovDeg, aspect, camZ);

  // Visible edges with small margin
  const left   = -f.halfW * (1 - MARGIN);
  const right  =  f.halfW * (1 - MARGIN);
  const top    =  f.halfH * (1 - MARGIN);
  const bottom = -f.halfH * (1 - MARGIN);
  const usableW = right - left;

  // Controls row: size relative to viewport width
  const ctrlScale = Math.min(0.6, Math.max(0.3, usableW * 0.08));
  const cs: [number, number, number] = [ctrlScale, ctrlScale, ctrlScale];
  const ctrlRowH = ctrlScale * 1.2;

  // Content area: all space above the controls row
  const contentBottom = bottom + ctrlRowH + GAP;
  const contentH      = top - contentBottom;

  // Controls Y centre (shared by all scenes)
  const ctrlY = bottom + ctrlRowH / 2;

  switch (sceneName) {
    case 'portrait1': {
      // Split content height equally; scale each element to fill its half
      const elemH     = (contentH - GAP) / 2;
      const monScale  = Math.min(elemH / MONITOR_UNIT_H, usableW / MONITOR_UNIT_W);
      const kbScale   = Math.min(elemH / KB_UNIT_H,      usableW / KB_UNIT_W);
      const ms: [number, number, number] = [monScale, monScale, monScale];
      const ks: [number, number, number] = [kbScale,  kbScale,  kbScale];

      const lowerCenterY = contentBottom + elemH / 2;
      const upperCenterY = contentBottom + elemH + GAP + elemH / 2;

      // portrait1: keyboard on top, monitor below
      return {
        keyboard:   { position: [0,     upperCenterY, 0],   rotation: FLAT, scale: ks, visible: true },
        monitor:    { position: [0,     lowerCenterY, 0],   rotation: FLAT, scale: ms, visible: true },
        joystick:   { position: [left * 0.7,  ctrlY, 0],    rotation: FLAT, scale: cs, visible: true },
        fireButton: { position: [right * 0.7, ctrlY, 0.4],  rotation: FLAT, scale: cs, visible: true },
        menuButton: { position: [0,     ctrlY, 0.4],        rotation: FLAT, scale: cs, visible: true },
        menuCodex:  { position: [0, 0, -8], rotation: FLAT, scale: [1, 1, 1], visible: false },
        camera:     { position: [0, 0, camZ], rotation: FLAT, scale: [1, 1, 1] },
      };
    }
    case 'portrait2': {
      // Same split as portrait1 but monitor on top, keyboard below
      const elemH     = (contentH - GAP) / 2;
      const monScale  = Math.min(elemH / MONITOR_UNIT_H, usableW / MONITOR_UNIT_W);
      const kbScale   = Math.min(elemH / KB_UNIT_H,      usableW / KB_UNIT_W);
      const ms: [number, number, number] = [monScale, monScale, monScale];
      const ks: [number, number, number] = [kbScale,  kbScale,  kbScale];

      const lowerCenterY = contentBottom + elemH / 2;
      const upperCenterY = contentBottom + elemH + GAP + elemH / 2;

      // portrait2: monitor on top, keyboard below
      return {
        monitor:    { position: [0,     upperCenterY, 0],   rotation: FLAT, scale: ms, visible: true },
        keyboard:   { position: [0,     lowerCenterY, 0],   rotation: FLAT, scale: ks, visible: true },
        joystick:   { position: [left * 0.7,  ctrlY, 0],    rotation: FLAT, scale: cs, visible: true },
        fireButton: { position: [right * 0.7, ctrlY, 0.4],  rotation: FLAT, scale: cs, visible: true },
        menuButton: { position: [0,     ctrlY, 0.4],        rotation: FLAT, scale: cs, visible: true },
        menuCodex:  { position: [0, 0, -8], rotation: FLAT, scale: [1, 1, 1], visible: false },
        camera:     { position: [0, 0, camZ], rotation: FLAT, scale: [1, 1, 1] },
      };
    }
    case 'landscape': {
      const panelGap = usableW * 0.03;
      const availW   = usableW - panelGap;

      // Distribute width proportional to each entity's aspect ratio so both
      // fill their panel without wasted space.
      const monAR    = MONITOR_UNIT_W / MONITOR_UNIT_H;
      const kbAR     = KB_UNIT_W      / KB_UNIT_H;
      const totalAR  = monAR + kbAR;
      const monPanelW = availW * (monAR / totalAR);
      const kbPanelW  = availW * (kbAR  / totalAR);

      const leftCenterX  = left  + monPanelW / 2;
      const rightCenterX = right - kbPanelW  / 2;

      const monScale = Math.min(contentH / MONITOR_UNIT_H, monPanelW / MONITOR_UNIT_W);
      const kbScale  = Math.min(contentH / KB_UNIT_H,      kbPanelW  / KB_UNIT_W);
      const ms: [number, number, number] = [monScale, monScale, monScale];
      const ks: [number, number, number] = [kbScale,  kbScale,  kbScale];

      // Align each entity to the top of the content area so they share a common
      // top edge and the background gap appears only at the bottom, not around them.
      const monCenterY = top - (MONITOR_UNIT_H * monScale) / 2;
      const kbCenterY  = top - (KB_UNIT_H      * kbScale)  / 2;

      return {
        monitor:    { position: [leftCenterX,  monCenterY, 0], rotation: FLAT, scale: ms, visible: true },
        keyboard:   { position: [rightCenterX, kbCenterY,  0], rotation: FLAT, scale: ks, visible: true },
        joystick:   { position: [left * 0.7,  ctrlY, 0],    rotation: FLAT, scale: cs, visible: true },
        fireButton: { position: [right * 0.7, ctrlY, 0.4],  rotation: FLAT, scale: cs, visible: true },
        menuButton: { position: [0,     ctrlY, 0.4],        rotation: FLAT, scale: cs, visible: true },
        menuCodex:  { position: [0, 0, -8], rotation: FLAT, scale: [1, 1, 1], visible: false },
        camera:     { position: [0, 0, camZ], rotation: FLAT, scale: [1, 1, 1] },
      };
    }
    case 'menuPortrait': {
      const pushZ  = -4;
      const shrink = 0.6;

      // Derive background element scales from the portrait fit-to-space values × shrink
      const elemH    = (contentH - GAP) / 2;
      const monScale = Math.min(elemH / MONITOR_UNIT_H, usableW / MONITOR_UNIT_W);
      const kbScale  = Math.min(elemH / KB_UNIT_H,      usableW / KB_UNIT_W);
      const smallMs: [number, number, number] = [monScale * shrink, monScale * shrink, monScale * shrink];
      const smallKs: [number, number, number] = [kbScale  * shrink, kbScale  * shrink, kbScale  * shrink];
      const cs06:    [number, number, number] = [ctrlScale * shrink, ctrlScale * shrink, ctrlScale * shrink];

      // Elements cluster around screen centre, pushed back; codex is in front at Z=0
      const monY    =  (elemH / 2) * shrink;
      const kbY     = -(elemH / 2 + GAP) * shrink;
      const ctrlY06 =  bottom * shrink;

      return {
        monitor:    { position: [0,              monY,    pushZ], rotation: FLAT, scale: smallMs, visible: true },
        keyboard:   { position: [0,              kbY,     pushZ], rotation: FLAT, scale: smallKs, visible: true },
        joystick:   { position: [left  * shrink * 0.7, ctrlY06, pushZ], rotation: FLAT, scale: cs06, visible: true },
        fireButton: { position: [right * shrink * 0.7, ctrlY06, pushZ], rotation: FLAT, scale: cs06, visible: true },
        menuButton: { position: [0,              ctrlY06, pushZ], rotation: FLAT, scale: cs06,    visible: true },
        menuCodex:  { position: [0, 0, 0], rotation: FLAT, scale: [1, 1, 1],     visible: true },
        camera:     { position: [0, 0, 7], rotation: FLAT, scale: [1, 1, 1] },
      };
    }
    case 'menuLandscape': {
      const pushZ        = -4;
      const elementShrink = 0.65;
      const ctrlShrink   = 0.6;

      // Derive background element scales from the landscape fit-to-space values × elementShrink
      const panelGap     = usableW * 0.03;
      const availW       = usableW - panelGap;
      const monAR        = MONITOR_UNIT_W / MONITOR_UNIT_H;
      const kbAR         = KB_UNIT_W      / KB_UNIT_H;
      const totalAR      = monAR + kbAR;
      const monPanelW    = availW * (monAR / totalAR);
      const kbPanelW     = availW * (kbAR  / totalAR);
      const leftCenterX  = left  + monPanelW / 2;
      const rightCenterX = right - kbPanelW  / 2;
      const centerY      = contentBottom + contentH / 2;

      const monScale = Math.min(contentH / MONITOR_UNIT_H, monPanelW / MONITOR_UNIT_W);
      const kbScale  = Math.min(contentH / KB_UNIT_H,      kbPanelW  / KB_UNIT_W);
      const smallMs: [number, number, number] = [monScale * elementShrink, monScale * elementShrink, monScale * elementShrink];
      const smallKs: [number, number, number] = [kbScale  * elementShrink, kbScale  * elementShrink, kbScale  * elementShrink];
      const cs06:    [number, number, number] = [ctrlScale * ctrlShrink, ctrlScale * ctrlShrink, ctrlScale * ctrlShrink];

      return {
        monitor:    { position: [leftCenterX,  centerY, pushZ], rotation: FLAT, scale: smallMs,     visible: true },
        keyboard:   { position: [rightCenterX, centerY, pushZ], rotation: FLAT, scale: smallKs,     visible: true },
        joystick:   { position: [left  * ctrlShrink * 0.7, ctrlY, pushZ], rotation: FLAT, scale: cs06, visible: true },
        fireButton: { position: [right * ctrlShrink * 0.7, ctrlY, pushZ], rotation: FLAT, scale: cs06, visible: true },
        menuButton: { position: [0,            ctrlY,   pushZ], rotation: FLAT, scale: cs06,        visible: true },
        menuCodex:  { position: [0, 0, 0], rotation: FLAT, scale: [1.2, 1.2, 1.2], visible: true },
        camera:     { position: [0, 0, 6], rotation: FLAT, scale: [1, 1, 1] },
      };
    }
    default:
      return null;
  }
}
