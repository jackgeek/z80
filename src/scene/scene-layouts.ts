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

// Controls tilt toward camera so their tops are visible
const CTRL_TILT: [number, number, number] = [70, 0, 0];
const KB_TILT: [number, number, number] = [65, 0, 0];

// ── Frustum helpers ───────────────────────────────────────────────────────────

export interface FrustumBounds {
  halfW: number;  // half-width of visible area at z=0
  halfH: number;  // half-height of visible area at z=0
  camZ: number;   // camera Z distance
}

export function computeFrustum(fovDeg: number, aspect: number, camZ: number): FrustumBounds {
  const fovRad = (fovDeg * Math.PI) / 180;
  const halfH = camZ * Math.tan(fovRad / 2);
  const halfW = halfH * aspect;
  return { halfW, halfH, camZ };
}

// Inset margins (fraction of frustum half-extent)
const MARGIN = 0.12;       // inset from edges
// ── Layout computation ────────────────────────────────────────────────────────

export function computeLayout(sceneName: string, fovDeg: number, aspect: number): SceneLayout | null {

  // Camera distance varies by scene
  const camZ = sceneName.includes('landscape') ? 6 : 7;
  const f = computeFrustum(fovDeg, aspect, camZ);

  // Edge positions with margin inset
  const left = -f.halfW + f.halfW * MARGIN;
  const right = f.halfW - f.halfW * MARGIN;
  const top = f.halfH - f.halfH * MARGIN;
  const bottom = -f.halfH + f.halfH * MARGIN;
  const centerX = 0;
  const centerY = (top + bottom) / 2;

  // Control scale relative to viewport — smaller on narrow viewports
  const ctrlScale = Math.min(0.6, Math.max(0.35, f.halfW * 0.15));
  const cs: [number, number, number] = [ctrlScale, ctrlScale, ctrlScale];

  switch (sceneName) {
    case 'portrait1': {
      // Keyboard top, Monitor middle, controls bottom
      const ctrlY = bottom + f.halfH * 0.05;
      const monY = centerY * 0.3;
      const kbY = top - f.halfH * 0.15;
      return {
        keyboard:   { position: [0, kbY, 0.5],         rotation: KB_TILT, scale: [ctrlScale * 1.1, ctrlScale * 1.1, ctrlScale * 1.1], visible: true },
        monitor:    { position: [0, monY, 0],           rotation: [0, 0, 0], scale: [1, 1, 1], visible: true },
        joystick:   { position: [left, ctrlY, 0.4],     rotation: CTRL_TILT, scale: cs, visible: true },
        fireButton: { position: [right, ctrlY, 0.4],    rotation: CTRL_TILT, scale: cs, visible: true },
        menuButton: { position: [centerX, ctrlY, 0.4],  rotation: CTRL_TILT, scale: cs, visible: true },
        menuCodex:  { position: [0, 0, -8],             rotation: [0, 0, 0], scale: [1, 1, 1], visible: false },
        camera:     { position: [0, 0, camZ],           rotation: [0, 0, 0], scale: [1, 1, 1] },
      };
    }
    case 'portrait2': {
      // Monitor top, Keyboard middle, controls bottom
      const ctrlY = bottom + f.halfH * 0.05;
      const monY = top - f.halfH * 0.15;
      const kbY = centerY * 0.3;
      return {
        monitor:    { position: [0, monY, 0],           rotation: [0, 0, 0], scale: [1, 1, 1], visible: true },
        keyboard:   { position: [0, kbY, 0.5],          rotation: KB_TILT, scale: [ctrlScale * 1.1, ctrlScale * 1.1, ctrlScale * 1.1], visible: true },
        joystick:   { position: [left, ctrlY, 0.4],     rotation: CTRL_TILT, scale: cs, visible: true },
        fireButton: { position: [right, ctrlY, 0.4],    rotation: CTRL_TILT, scale: cs, visible: true },
        menuButton: { position: [centerX, ctrlY, 0.4],  rotation: CTRL_TILT, scale: cs, visible: true },
        menuCodex:  { position: [0, 0, -8],             rotation: [0, 0, 0], scale: [1, 1, 1], visible: false },
        camera:     { position: [0, 0, camZ],           rotation: [0, 0, 0], scale: [1, 1, 1] },
      };
    }
    case 'landscape': {
      // Monitor center, Keyboard off, controls at edges
      const ctrlY = bottom + f.halfH * 0.08;
      return {
        monitor:    { position: [0, 0.2, 0],            rotation: [0, 0, 0], scale: [1.2, 1.2, 1.2], visible: true },
        keyboard:   { position: [0, -10, 0],            rotation: KB_TILT, scale: [ctrlScale, ctrlScale, ctrlScale], visible: false },
        joystick:   { position: [left, ctrlY, 0.4],     rotation: CTRL_TILT, scale: cs, visible: true },
        fireButton: { position: [right, ctrlY, 0.4],    rotation: CTRL_TILT, scale: cs, visible: true },
        menuButton: { position: [right, top, 0.4],      rotation: CTRL_TILT, scale: cs, visible: true },
        menuCodex:  { position: [0, 0, -8],             rotation: [0, 0, 0], scale: [1, 1, 1], visible: false },
        camera:     { position: [0, 0, camZ],           rotation: [0, 0, 0], scale: [1, 1, 1] },
      };
    }
    case 'menuPortrait': {
      // Push scene back, codex centered
      const pushZ = -4;
      const ctrlY = bottom + f.halfH * 0.05;
      return {
        monitor:    { position: [0, 0, pushZ],          rotation: [5, 0, 0], scale: [0.7, 0.7, 0.7], visible: true },
        keyboard:   { position: [0, -1.6, pushZ + 0.5], rotation: KB_TILT, scale: [0.4, 0.4, 0.4], visible: true },
        joystick:   { position: [left * 0.7, ctrlY, pushZ + 0.4], rotation: CTRL_TILT, scale: [0.3, 0.3, 0.3], visible: true },
        fireButton: { position: [right * 0.7, ctrlY, pushZ + 0.4], rotation: CTRL_TILT, scale: [0.3, 0.3, 0.3], visible: true },
        menuButton: { position: [0, ctrlY, pushZ + 0.4], rotation: CTRL_TILT, scale: [0.3, 0.3, 0.3], visible: true },
        menuCodex:  { position: [0, 0, 0],              rotation: [0, 0, 0], scale: [1, 1, 1], visible: true },
        camera:     { position: [0, 0, 7],              rotation: [0, 0, 0], scale: [1, 1, 1] },
      };
    }
    case 'menuLandscape': {
      // Push landscape scene back, codex centered
      const pushZ = -4;
      const ctrlY = bottom + f.halfH * 0.08;
      return {
        monitor:    { position: [0, 0.2, pushZ],        rotation: [5, 0, 0], scale: [0.8, 0.8, 0.8], visible: true },
        keyboard:   { position: [0, -10, pushZ],        rotation: KB_TILT, scale: [0.5, 0.5, 0.5], visible: false },
        joystick:   { position: [left * 0.7, ctrlY, pushZ + 0.4], rotation: CTRL_TILT, scale: [0.35, 0.35, 0.35], visible: true },
        fireButton: { position: [right * 0.7, ctrlY, pushZ + 0.4], rotation: CTRL_TILT, scale: [0.35, 0.35, 0.35], visible: true },
        menuButton: { position: [right * 0.7, top * 0.7, pushZ + 0.4], rotation: CTRL_TILT, scale: [0.3, 0.3, 0.3], visible: true },
        menuCodex:  { position: [0, 0, 0],              rotation: [0, 0, 0], scale: [1.2, 1.2, 1.2], visible: true },
        camera:     { position: [0, 0, 6],              rotation: [0, 0, 0], scale: [1, 1, 1] },
      };
    }
    default:
      return null;
  }
}

// Keep the old static type for backward compatibility with transitions
export type { SceneLayout as SceneLayoutType };
