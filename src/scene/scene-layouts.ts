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
// Keyboard tilt toward viewport center: bottom-edge forward when above center, top-edge forward when below
const KB_TILT_UP: [number, number, number]   = [-12, 0, 0]; // keyboard above center → bottom tilts toward camera
const KB_TILT_DOWN: [number, number, number] = [ 12, 0, 0]; // keyboard below center → top tilts toward camera

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

// Monitor world-space width at scale 1 (BORDER_W + bezels ≈ 3.08)
const MONITOR_UNIT_W = 3.08;
// Keyboard world-space width at entity scale 1 — GLB model has internal 13.2× scale,
// so effective width = 0.233 × 13.2 = 3.076 (matches monitor width)
const KB_UNIT_W = 3.076;
// Keyboard visual height at entity scale 1 — model Z extent 0.146 × 13.2 = 1.927
const FLATED_H = 1.927;

// ── Layout computation ────────────────────────────────────────────────────────

export function computeLayout(sceneName: string, fovDeg: number, aspect: number): SceneLayout | null {
  const camZ = sceneName.includes('landscape') ? 6 : 7;
  const f = computeFrustum(fovDeg, aspect, camZ);

  // Visible edges with small margin
  const left = -f.halfW * (1 - MARGIN);
  const right = f.halfW * (1 - MARGIN);
  const top = f.halfH * (1 - MARGIN);
  const bottom = -f.halfH * (1 - MARGIN);
  const usableW = right - left;

  // Control scale relative to viewport
  const ctrlScale = Math.min(0.6, Math.max(0.3, usableW * 0.08));
  const cs: [number, number, number] = [ctrlScale, ctrlScale, ctrlScale];
  // Height reserved for controls row at bottom
  const ctrlRowH = ctrlScale * 1.2;

  // Monitor scale: fit width to usable viewport width
  const monScale = Math.min(1.4, usableW / MONITOR_UNIT_W);
  const ms: [number, number, number] = [monScale, monScale, monScale];

  // Keyboard scale: match monitor visual width, uniform (1:1 aspect ratio)
  const monVisualW = MONITOR_UNIT_W * monScale;
  const kbScale = monVisualW / KB_UNIT_W;
  const ks: [number, number, number] = [kbScale, kbScale, kbScale];

  // Keyboard visual height when tilted
  const kbVisualH = FLATED_H * kbScale;
  // Monitor visual height
  const monVisualH = 2.2 * monScale; // approx total monitor height with bezels

  switch (sceneName) {
    case 'portrait1': {
      // Layout from bottom up: controls → monitor → keyboard
      const ctrlY = bottom + ctrlRowH * 0.5;
      const monY = ctrlY + ctrlRowH * 0.5 + 0.1 + monVisualH * 0.5;
      const kbY = monY + monVisualH * 0.5 + 0.1 + kbVisualH * 0.5;
      return {
        keyboard:   { position: [0, kbY, 0],             rotation: KB_TILT_DOWN,   scale: ks, visible: true },
        monitor:    { position: [0, monY, 0],            rotation: [0, 0, 0], scale: ms, visible: true },
        joystick:   { position: [left, ctrlY, 0],         rotation: FLAT, scale: cs, visible: true },
        fireButton: { position: [right, ctrlY, 0.4],     rotation: FLAT, scale: cs, visible: true },
        menuButton: { position: [0, ctrlY, 0.4],         rotation: FLAT, scale: cs, visible: true },
        menuCodex:  { position: [0, 0, -8],              rotation: [0, 0, 0], scale: [1, 1, 1], visible: false },
        camera:     { position: [0, 0, camZ],            rotation: [0, 0, 0], scale: [1, 1, 1] },
      };
    }
    case 'portrait2': {
      // Layout from bottom up: controls → keyboard → monitor
      const ctrlY = bottom + ctrlRowH * 0.5;
      const kbY = ctrlY + ctrlRowH * 0.5 + 0.1 + kbVisualH * 0.5;
      const monY = kbY + kbVisualH * 0.5 + 0.1 + monVisualH * 0.5;
      return {
        monitor:    { position: [0, monY, 0],            rotation: [0, 0, 0], scale: ms, visible: true },
        keyboard:   { position: [0, kbY, 0.5],           rotation: KB_TILT_UP,   scale: ks, visible: true },
        joystick:   { position: [left, ctrlY, 0],         rotation: FLAT, scale: cs, visible: true },
        fireButton: { position: [right, ctrlY, 0.4],     rotation: FLAT, scale: cs, visible: true },
        menuButton: { position: [0, ctrlY, 0.4],         rotation: FLAT, scale: cs, visible: true },
        menuCodex:  { position: [0, 0, -8],              rotation: [0, 0, 0], scale: [1, 1, 1], visible: false },
        camera:     { position: [0, 0, camZ],            rotation: [0, 0, 0], scale: [1, 1, 1] },
      };
    }
    case 'landscape': {
      const ctrlY = bottom + ctrlRowH * 0.5;
      const gap = usableW * 0.03;
      const halfW = (usableW - gap) / 2;
      const leftCenterX = left + halfW / 2;
      const rightCenterX = right - halfW / 2;
      const lMonScale = Math.min(1.4, halfW / MONITOR_UNIT_W);
      const lMs: [number, number, number] = [lMonScale, lMonScale, lMonScale];
      const lKbScale = halfW / KB_UNIT_W;
      const lKs: [number, number, number] = [lKbScale, lKbScale, lKbScale];
      const centerY = (top + ctrlY + ctrlRowH * 0.5) / 2;
      return {
        monitor:    { position: [leftCenterX,  centerY, 0], rotation: [0, 0, 0], scale: lMs, visible: true },
        keyboard:   { position: [rightCenterX, centerY, 0], rotation: FLAT,      scale: lKs, visible: true },
        joystick:   { position: [left,  ctrlY, 0],           rotation: FLAT, scale: cs, visible: true },
        fireButton: { position: [right, ctrlY, 0.4],         rotation: FLAT, scale: cs, visible: true },
        menuButton: { position: [0,     ctrlY, 0.4],         rotation: FLAT, scale: cs, visible: true },
        menuCodex:  { position: [0, 0, -8],                  rotation: [0, 0, 0], scale: [1, 1, 1], visible: false },
        camera:     { position: [0, 0, camZ],                rotation: [0, 0, 0], scale: [1, 1, 1] },
      };
    }
    case 'menuPortrait': {
      const pushZ = -4;
      const ctrlY = bottom + ctrlRowH * 0.4;
      const smallMs: [number, number, number] = [monScale * 0.6, monScale * 0.6, monScale * 0.6];
      const smallKs: [number, number, number] = [kbScale * 0.6, kbScale * 0.6, kbScale * 0.6];
      return {
        monitor:    { position: [0, 0, pushZ],            rotation: FLAT, scale: smallMs, visible: true },
        keyboard:   { position: [0, -1.5, pushZ],        rotation: FLAT, scale: smallKs, visible: true },
        joystick:   { position: [left * 0.6, ctrlY, pushZ], rotation: FLAT, scale: [ctrlScale * 0.6, ctrlScale * 0.6, ctrlScale * 0.6], visible: true },
        fireButton: { position: [right * 0.6, ctrlY, pushZ], rotation: FLAT, scale: [ctrlScale * 0.6, ctrlScale * 0.6, ctrlScale * 0.6], visible: true },
        menuButton: { position: [0, ctrlY, pushZ],       rotation: FLAT, scale: [ctrlScale * 0.6, ctrlScale * 0.6, ctrlScale * 0.6], visible: true },
        menuCodex:  { position: [0, 0, 0],               rotation: [0, 0, 0], scale: [1, 1, 1], visible: true },
        camera:     { position: [0, 0, 7],               rotation: [0, 0, 0], scale: [1, 1, 1] },
      };
    }
    case 'menuLandscape': {
      const pushZ = -4;
      const ctrlY = bottom + ctrlRowH * 0.5;
      const gap = usableW * 0.03;
      const halfW = (usableW - gap) / 2;
      const leftCenterX = left + halfW / 2;
      const rightCenterX = right - halfW / 2;
      const centerY = (top + ctrlY + ctrlRowH * 0.5) / 2;
      const lMonScale = Math.min(1.4, halfW / MONITOR_UNIT_W) * 0.65;
      const lMs: [number, number, number] = [lMonScale, lMonScale, lMonScale];
      const lKbScale = (halfW / KB_UNIT_W) * 0.65;
      const lKs: [number, number, number] = [lKbScale, lKbScale, lKbScale];
      const cs06: [number, number, number] = [ctrlScale * 0.6, ctrlScale * 0.6, ctrlScale * 0.6];
      return {
        monitor:    { position: [leftCenterX,  centerY, pushZ], rotation: FLAT, scale: lMs,  visible: true },
        keyboard:   { position: [rightCenterX, centerY, pushZ], rotation: FLAT, scale: lKs,  visible: true },
        joystick:   { position: [left * 0.6,   ctrlY,   pushZ], rotation: FLAT, scale: cs06, visible: true },
        fireButton: { position: [right * 0.6,  ctrlY,   pushZ], rotation: FLAT, scale: cs06, visible: true },
        menuButton: { position: [0,            ctrlY,   pushZ], rotation: FLAT, scale: cs06, visible: true },
        menuCodex:  { position: [0, 0, 0],                      rotation: [0, 0, 0], scale: [1.2, 1.2, 1.2], visible: true },
        camera:     { position: [0, 0, 6],                      rotation: [0, 0, 0], scale: [1, 1, 1] },
      };
    }
    default:
      return null;
  }
}
