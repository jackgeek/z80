// Position/rotation/scale definitions for each UI element in each scene

export interface EntityLayout {
  position: [number, number, number];
  rotation: [number, number, number]; // Euler degrees
  scale: [number, number, number];
  visible?: boolean; // undefined = no change, false = hide after tween, true = show before tween
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

export const LAYOUTS: Record<string, SceneLayout> = {
  portrait1: {
    // Keyboard top, Monitor middle, controls bottom
    keyboard:   { position: [0, 2.0, 0.5],    rotation: [65, 0, 0],   scale: [0.55, 0.55, 0.55], visible: true },
    monitor:    { position: [0, -0.2, 0],      rotation: [0, 0, 0],    scale: [1, 1, 1], visible: true },
    joystick:   { position: [-2.0, -2.5, 0.4], rotation: CTRL_TILT,    scale: [0.5, 0.5, 0.5], visible: true },
    fireButton: { position: [2.0, -2.5, 0.4],  rotation: CTRL_TILT,    scale: [0.5, 0.5, 0.5], visible: true },
    menuButton: { position: [0, -2.5, 0.4],    rotation: CTRL_TILT,    scale: [0.5, 0.5, 0.5], visible: true },
    menuCodex:  { position: [0, 0, -8],        rotation: [0, 0, 0],    scale: [1, 1, 1], visible: false },
    camera:     { position: [0, 0, 7],         rotation: [0, 0, 0],    scale: [1, 1, 1] },
  },
  portrait2: {
    // Monitor top, Keyboard middle, controls bottom
    monitor:    { position: [0, 2.0, 0],       rotation: [0, 0, 0],    scale: [1, 1, 1], visible: true },
    keyboard:   { position: [0, -0.2, 0.5],    rotation: [65, 0, 0],   scale: [0.55, 0.55, 0.55], visible: true },
    joystick:   { position: [-2.0, -2.5, 0.4], rotation: CTRL_TILT,    scale: [0.5, 0.5, 0.5], visible: true },
    fireButton: { position: [2.0, -2.5, 0.4],  rotation: CTRL_TILT,    scale: [0.5, 0.5, 0.5], visible: true },
    menuButton: { position: [0, -2.5, 0.4],    rotation: CTRL_TILT,    scale: [0.5, 0.5, 0.5], visible: true },
    menuCodex:  { position: [0, 0, -8],        rotation: [0, 0, 0],    scale: [1, 1, 1], visible: false },
    camera:     { position: [0, 0, 7],         rotation: [0, 0, 0],    scale: [1, 1, 1] },
  },
  landscape: {
    // Monitor center, Keyboard off-screen, controls spread wider
    monitor:    { position: [0, 0.2, 0],       rotation: [0, 0, 0],    scale: [1.2, 1.2, 1.2], visible: true },
    keyboard:   { position: [0, -10, 0],       rotation: [65, 0, 0],   scale: [0.55, 0.55, 0.55], visible: false },
    joystick:   { position: [-3.5, -1.8, 0.4], rotation: CTRL_TILT,    scale: [0.6, 0.6, 0.6], visible: true },
    fireButton: { position: [3.5, -1.8, 0.4],  rotation: CTRL_TILT,    scale: [0.6, 0.6, 0.6], visible: true },
    menuButton: { position: [3.5, 2.0, 0.4],   rotation: CTRL_TILT,    scale: [0.5, 0.5, 0.5], visible: true },
    menuCodex:  { position: [0, 0, -8],        rotation: [0, 0, 0],    scale: [1, 1, 1], visible: false },
    camera:     { position: [0, 0, 6],         rotation: [0, 0, 0],    scale: [1, 1, 1] },
  },
  menuPortrait: {
    // Push scene back + defocus, codex centered
    monitor:    { position: [0, -0.2, -4],     rotation: [5, 0, 0],    scale: [0.7, 0.7, 0.7], visible: true },
    keyboard:   { position: [0, -1.6, -3.5],   rotation: [65, 0, 0],   scale: [0.4, 0.4, 0.4], visible: true },
    joystick:   { position: [-2.0, -2.5, -3.6],rotation: CTRL_TILT,    scale: [0.35, 0.35, 0.35], visible: true },
    fireButton: { position: [2.0, -2.5, -3.6], rotation: CTRL_TILT,    scale: [0.35, 0.35, 0.35], visible: true },
    menuButton: { position: [0, -2.5, -3.6],   rotation: CTRL_TILT,    scale: [0.35, 0.35, 0.35], visible: true },
    menuCodex:  { position: [0, 0, 0],         rotation: [0, 0, 0],    scale: [1, 1, 1], visible: true },
    camera:     { position: [0, 0, 7],         rotation: [0, 0, 0],    scale: [1, 1, 1] },
  },
  menuLandscape: {
    // Push landscape scene back + defocus, codex centered
    monitor:    { position: [0, 0.2, -4],      rotation: [5, 0, 0],    scale: [0.8, 0.8, 0.8], visible: true },
    keyboard:   { position: [0, -10, -4],      rotation: [65, 0, 0],   scale: [0.55, 0.55, 0.55], visible: false },
    joystick:   { position: [-3.5, -1.8, -3.6],rotation: CTRL_TILT,    scale: [0.4, 0.4, 0.4], visible: true },
    fireButton: { position: [3.5, -1.8, -3.6], rotation: CTRL_TILT,    scale: [0.4, 0.4, 0.4], visible: true },
    menuButton: { position: [3.5, 2.0, -3.6],  rotation: CTRL_TILT,    scale: [0.35, 0.35, 0.35], visible: true },
    menuCodex:  { position: [0, 0, 0],         rotation: [0, 0, 0],    scale: [1.2, 1.2, 1.2], visible: true },
    camera:     { position: [0, 0, 6],         rotation: [0, 0, 0],    scale: [1, 1, 1] },
  },
};
