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

export const LAYOUTS: Record<string, SceneLayout> = {
  portrait1: {
    // Keyboard top, Monitor middle, controls bottom
    keyboard:   { position: [0, 2.0, 0.5],    rotation: [65, 0, 0],   scale: [0.55, 0.55, 0.55] },
    monitor:    { position: [0, -0.2, 0],      rotation: [0, 0, 0],    scale: [1, 1, 1] },
    joystick:   { position: [-2.0, -2.5, 0],   rotation: [0, 0, 0],    scale: [0.5, 0.5, 0.5] },
    fireButton: { position: [2.0, -2.5, 0],    rotation: [0, 0, 0],    scale: [0.5, 0.5, 0.5] },
    menuButton: { position: [0, -2.5, 0],      rotation: [0, 0, 0],    scale: [0.5, 0.5, 0.5] },
    menuCodex:  { position: [0, 0, -8],        rotation: [0, 0, 0],    scale: [1, 1, 1], visible: false },
    camera:     { position: [0, 0, 7],         rotation: [0, 0, 0],    scale: [1, 1, 1] },
  },
  portrait2: {
    // Monitor top, Keyboard middle, controls bottom
    monitor:    { position: [0, 2.0, 0],       rotation: [0, 0, 0],    scale: [1, 1, 1] },
    keyboard:   { position: [0, -0.2, 0.5],    rotation: [65, 0, 0],   scale: [0.55, 0.55, 0.55] },
    joystick:   { position: [-2.0, -2.5, 0],   rotation: [0, 0, 0],    scale: [0.5, 0.5, 0.5] },
    fireButton: { position: [2.0, -2.5, 0],    rotation: [0, 0, 0],    scale: [0.5, 0.5, 0.5] },
    menuButton: { position: [0, -2.5, 0],      rotation: [0, 0, 0],    scale: [0.5, 0.5, 0.5] },
    menuCodex:  { position: [0, 0, -8],        rotation: [0, 0, 0],    scale: [1, 1, 1], visible: false },
    camera:     { position: [0, 0, 7],         rotation: [0, 0, 0],    scale: [1, 1, 1] },
  },
  landscape: {
    // Monitor center, Keyboard off-screen, controls spread wider
    monitor:    { position: [0, 0.2, 0],       rotation: [0, 0, 0],    scale: [1.2, 1.2, 1.2] },
    keyboard:   { position: [0, -10, 0],       rotation: [65, 0, 0],   scale: [0.55, 0.55, 0.55], visible: false },
    joystick:   { position: [-3.5, -1.8, 0],   rotation: [0, 0, 0],    scale: [0.6, 0.6, 0.6] },
    fireButton: { position: [3.5, -1.8, 0],    rotation: [0, 0, 0],    scale: [0.6, 0.6, 0.6] },
    menuButton: { position: [3.5, 2.0, 0],     rotation: [0, 0, 0],    scale: [0.5, 0.5, 0.5] },
    menuCodex:  { position: [0, 0, -8],        rotation: [0, 0, 0],    scale: [1, 1, 1], visible: false },
    camera:     { position: [0, 0, 6],         rotation: [0, 0, 0],    scale: [1, 1, 1] },
  },
  menuPortrait: {
    // Push scene back + defocus, codex centered
    monitor:    { position: [0, -0.2, -4],     rotation: [5, 0, 0],    scale: [0.7, 0.7, 0.7] },
    keyboard:   { position: [0, -1.6, -3.5],   rotation: [65, 0, 0],   scale: [0.4, 0.4, 0.4] },
    joystick:   { position: [-2.0, -2.5, -4],  rotation: [0, 0, 0],    scale: [0.35, 0.35, 0.35] },
    fireButton: { position: [2.0, -2.5, -4],   rotation: [0, 0, 0],    scale: [0.35, 0.35, 0.35] },
    menuButton: { position: [0, -2.5, -4],     rotation: [0, 0, 0],    scale: [0.35, 0.35, 0.35] },
    menuCodex:  { position: [0, 0, 0],         rotation: [0, 0, 0],    scale: [1, 1, 1], visible: true },
    camera:     { position: [0, 0, 7],         rotation: [0, 0, 0],    scale: [1, 1, 1] },
  },
  menuLandscape: {
    // Push landscape scene back + defocus, codex centered
    monitor:    { position: [0, 0.2, -4],      rotation: [5, 0, 0],    scale: [0.8, 0.8, 0.8] },
    keyboard:   { position: [0, -10, -4],      rotation: [65, 0, 0],   scale: [0.55, 0.55, 0.55], visible: false },
    joystick:   { position: [-3.5, -1.8, -4],  rotation: [0, 0, 0],    scale: [0.4, 0.4, 0.4] },
    fireButton: { position: [3.5, -1.8, -4],   rotation: [0, 0, 0],    scale: [0.4, 0.4, 0.4] },
    menuButton: { position: [3.5, 2.0, -4],    rotation: [0, 0, 0],    scale: [0.35, 0.35, 0.35] },
    menuCodex:  { position: [0, 0, 0],         rotation: [0, 0, 0],    scale: [1.2, 1.2, 1.2], visible: true },
    camera:     { position: [0, 0, 6],         rotation: [0, 0, 0],    scale: [1, 1, 1] },
  },
};
