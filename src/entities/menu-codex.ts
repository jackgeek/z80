// Da Vinci cryptex-style Menu Codex — brass cylinder with engraved menu text

import * as pc from 'playcanvas';
import { createBrassMaterial } from '../materials/brass.js';
import { createAgedMetalMaterial } from '../materials/aged-metal.js';

export interface CodexMenuItem {
  label: string;
  action: string;
}

export const CODEX_MENU_ITEMS: CodexMenuItem[] = [
  { label: 'Load Tape',      action: 'LOAD_TAPE' },
  { label: 'Load ROM',       action: 'LOAD_ROM' },
  { label: 'Save State',     action: 'SAVE_STATE' },
  { label: 'Reset',          action: 'RESET' },
  { label: 'Pause / Resume', action: 'TOGGLE_PAUSE' },
  { label: 'Turbo Mode',     action: 'TOGGLE_TURBO' },
  { label: 'Joystick Type',  action: 'CYCLE_JOYSTICK' },
  { label: 'Close Menu',     action: 'MENU_CLOSE' },
];

export interface MenuCodexResult {
  codexEntity: pc.Entity;
  getSelectedIndex: () => number;
  getAngle: () => number;
  setAngle: (angle: number) => void;
}

export function createMenuCodex(app: pc.Application): MenuCodexResult {
  const device = app.graphicsDevice;
  const brassMat = createBrassMaterial(device);
  const agedMat = createAgedMetalMaterial(device);

  const codex = new pc.Entity('MenuCodex');
  codex.tags.add('menu-codex');

  // ── Main cylinder body with text texture ──────────────────────────────────
  const body = new pc.Entity('CodexBody');
  body.addComponent('render', { type: 'cylinder' });
  // Cylinder extends along Y axis; we rotate the whole codex so it's horizontal
  body.setLocalScale(1.0, 2.8, 1.0);
  body.setLocalPosition(0, 0, 0);

  // Create text texture for cylinder surface
  const textTexture = createCodexTextTexture(device);
  const bodyMat = new pc.StandardMaterial();
  bodyMat.diffuse = new pc.Color(0.78, 0.57, 0.11);
  bodyMat.diffuseMap = textTexture;
  bodyMat.useMetalness = true;
  bodyMat.metalness = 0.85;
  bodyMat.gloss = 0.6;
  bodyMat.update();
  body.render!.meshInstances[0].material = bodyMat;
  codex.addChild(body);

  // ── End caps ──────────────────────────────────────────────────────────────
  for (const yDir of [-1, 1]) {
    const cap = new pc.Entity(`EndCap_${yDir > 0 ? 'Top' : 'Bottom'}`);
    cap.addComponent('render', { type: 'cylinder' });
    cap.setLocalScale(1.15, 0.12, 1.15);
    cap.setLocalPosition(0, yDir * 1.45, 0);
    cap.render!.meshInstances[0].material = agedMat;
    codex.addChild(cap);
  }

  // ── Decorative brass bands ────────────────────────────────────────────────
  for (let i = -1; i <= 1; i++) {
    const band = new pc.Entity(`Band_${i}`);
    band.addComponent('render', { type: 'cylinder' });
    band.setLocalScale(1.06, 0.06, 1.06);
    band.setLocalPosition(0, i * 0.9, 0);
    band.render!.meshInstances[0].material = brassMat;
    codex.addChild(band);
  }

  // ── Selection arrows (brass triangles at center) ──────────────────────────
  for (const side of [-1, 1]) {
    const arrow = new pc.Entity(`Arrow_${side > 0 ? 'Right' : 'Left'}`);
    arrow.addComponent('render', { type: 'cone' });
    arrow.setLocalScale(0.15, 0.25, 0.15);
    arrow.setLocalPosition(side * 0.75, 0, 0.6);
    arrow.setLocalEulerAngles(0, 0, side > 0 ? -90 : 90);
    arrow.render!.meshInstances[0].material = brassMat;
    codex.addChild(arrow);
  }

  // Lay the cylinder on its side — rotate so the long axis runs left-to-right
  // Rotate 90° on Z to make Y-axis horizontal
  codex.setLocalEulerAngles(0, 0, 90);
  // The body spins around local Y (now horizontal), and the texture wraps
  // around the circumference so items appear as horizontal bands

  // Start hidden
  codex.enabled = false;

  // ── Angle tracking for spin interaction ───────────────────────────────────
  let currentAngle = 0;
  const anglePerItem = 360 / CODEX_MENU_ITEMS.length;

  return {
    codexEntity: codex,
    getSelectedIndex: () => {
      const idx = Math.round(currentAngle / anglePerItem) % CODEX_MENU_ITEMS.length;
      return ((idx % CODEX_MENU_ITEMS.length) + CODEX_MENU_ITEMS.length) % CODEX_MENU_ITEMS.length;
    },
    getAngle: () => currentAngle,
    setAngle: (angle: number) => {
      currentAngle = angle;
      // Rotate around X to scroll through items distributed around circumference
      body.setLocalEulerAngles(angle, 0, 0);
    },
  };
}

// ── Text texture for cylinder surface ─────────────────────────────────────────

function createCodexTextTexture(device: pc.GraphicsDevice): pc.Texture {
  const w = 1024;
  const h = 512;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  // Brass-colored background
  ctx.fillStyle = '#c89530';
  ctx.fillRect(0, 0, w, h);

  // Add subtle grain
  const imageData = ctx.getImageData(0, 0, w, h);
  const d = imageData.data;
  for (let i = 0; i < d.length; i += 4) {
    const noise = Math.random() * 12 - 6;
    d[i] = Math.min(255, Math.max(0, d[i] + noise));
    d[i + 1] = Math.min(255, Math.max(0, d[i + 1] + noise));
    d[i + 2] = Math.min(255, Math.max(0, d[i + 2] + noise));
  }
  ctx.putImageData(imageData, 0, 0);

  // Draw menu items as engraved text
  const itemCount = CODEX_MENU_ITEMS.length;
  const itemHeight = h / itemCount;

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (let i = 0; i < itemCount; i++) {
    const y = i * itemHeight + itemHeight / 2;

    // Separator line
    ctx.strokeStyle = '#8a6518';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(40, i * itemHeight);
    ctx.lineTo(w - 40, i * itemHeight);
    ctx.stroke();

    // Item number (small, left side)
    ctx.fillStyle = '#5a3e0a';
    ctx.font = 'bold 16px serif';
    ctx.textAlign = 'left';
    ctx.fillText(`${i + 1}.`, 60, y);

    // Item label (engraved look — dark shadow + slightly lighter text)
    ctx.font = 'bold 28px serif';
    ctx.textAlign = 'center';

    // Shadow (darker, offset down)
    ctx.fillStyle = '#5a3e0a';
    ctx.fillText(CODEX_MENU_ITEMS[i].label, w / 2, y + 2);

    // Main text (slightly lighter to create embossed effect)
    ctx.fillStyle = '#3d2a06';
    ctx.fillText(CODEX_MENU_ITEMS[i].label, w / 2, y);
  }

  // Final separator
  ctx.strokeStyle = '#8a6518';
  ctx.beginPath();
  ctx.moveTo(40, h - 1);
  ctx.lineTo(w - 40, h - 1);
  ctx.stroke();

  const texture = new pc.Texture(device, {
    width: w,
    height: h,
    format: pc.PIXELFORMAT_RGBA8,
    mipmaps: true,
    minFilter: pc.FILTER_LINEAR_MIPMAP_LINEAR,
    magFilter: pc.FILTER_LINEAR,
  });
  texture.setSource(canvas);
  return texture;
}
