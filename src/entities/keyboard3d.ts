// 3D ZX Spectrum 48K keyboard with individually pressable key entities

import * as pc from 'playcanvas';
import { ROWS, type VKeyDef } from '../data/key-layout.js';
import { createBrassMaterial } from '../materials/brass.js';
import { createRubberKeyMaterial } from '../materials/rubber-key.js';

// Key dimensions (world units)
const KEY_W = 0.30;
const KEY_H = 0.10;
const KEY_D = 0.26;
const COL_GAP = 0.33;
const ROW_GAP = 0.36;

// Spectrum rainbow colors for the right-edge stripe
const RAINBOW = ['#0000CD', '#CD0000', '#CD00CD', '#00CD00', '#00CDCD'];

export interface Keyboard3DResult {
  keyboardEntity: pc.Entity;
  keys: Map<string, pc.Entity>;
}

export function createKeyboard3D(app: pc.Application): Keyboard3DResult {
  const device = app.graphicsDevice;
  const brassMat = createBrassMaterial(device);
  const rubberMat = createRubberKeyMaterial(device);
  const keys = new Map<string, pc.Entity>();

  const keyboard = new pc.Entity('Keyboard3D');
  keyboard.tags.add('swipeable');

  // Pivot rotates content so key faces point toward camera (Z-forward)
  // Keys are built on XZ plane with Y-up; rotate -90° on X to face Z
  const pivot = new pc.Entity('KBPivot');
  pivot.setLocalEulerAngles(-90, 180, 0);
  keyboard.addChild(pivot);

  // ── Keyboard body ─────────────────────────────────────────────────────────
  const totalW = 10 * COL_GAP + 0.4;
  const totalD = 4 * ROW_GAP + 0.2;

  const body = new pc.Entity('KeyboardBody');
  body.addComponent('render', { type: 'box' });
  body.setLocalScale(totalW + 0.2, 0.08, totalD + 0.1);
  body.setLocalPosition(0, -KEY_H / 2 - 0.04, 0);
  const bodyMat = new pc.StandardMaterial();
  bodyMat.diffuse = new pc.Color(0.12, 0.12, 0.14);
  bodyMat.useMetalness = true;
  bodyMat.metalness = 0.1;
  bodyMat.gloss = 0.15;
  bodyMat.update();
  body.render!.meshInstances[0].material = bodyMat;
  pivot.addChild(body);

  // ── Brass edge trim ───────────────────────────────────────────────────────
  const trimH = 0.03;
  const trimEntities = [
    { s: [totalW + 0.3, trimH, 0.04], p: [0, -KEY_H / 2, totalD / 2 + 0.06] },
    { s: [totalW + 0.3, trimH, 0.04], p: [0, -KEY_H / 2, -totalD / 2 - 0.06] },
    { s: [0.04, trimH, totalD + 0.22], p: [-totalW / 2 - 0.14, -KEY_H / 2, 0] },
    { s: [0.04, trimH, totalD + 0.22], p: [totalW / 2 + 0.14, -KEY_H / 2, 0] },
  ];
  for (const { s, p } of trimEntities) {
    const trim = new pc.Entity('BrassTrim');
    trim.addComponent('render', { type: 'box' });
    trim.setLocalScale(s[0], s[1], s[2]);
    trim.setLocalPosition(p[0], p[1], p[2]);
    trim.render!.meshInstances[0].material = brassMat;
    pivot.addChild(trim);
  }

  // ── Rainbow stripe on right edge ──────────────────────────────────────────
  const stripeW = 0.025;
  const stripeH = totalD * 0.7;
  for (let i = 0; i < RAINBOW.length; i++) {
    const stripe = new pc.Entity(`Rainbow${i}`);
    stripe.addComponent('render', { type: 'box' });
    stripe.setLocalScale(stripeW, 0.02, stripeH / RAINBOW.length);
    stripe.setLocalPosition(
      totalW / 2 + 0.08,
      -KEY_H / 2 + 0.01,
      (i - 2) * (stripeH / RAINBOW.length)
    );
    const stripeMat = new pc.StandardMaterial();
    const c = new pc.Color();
    c.fromString(RAINBOW[i]);
    stripeMat.diffuse = c;
    stripeMat.emissive = new pc.Color(c.r * 0.3, c.g * 0.3, c.b * 0.3);
    stripeMat.useMetalness = true;
    stripeMat.metalness = 0.0;
    stripeMat.gloss = 0.4;
    stripeMat.update();
    stripe.render!.meshInstances[0].material = stripeMat;
    pivot.addChild(stripe);
  }

  // ── Key label texture atlas ───────────────────────────────────────────────
  const atlas = buildKeyLabelAtlas(device);

  // ── Build key rows ────────────────────────────────────────────────────────
  ROWS.forEach((rowKeys, rowIdx) => {
    // Calculate total row width for centering
    const rowWidth = rowKeys.reduce((sum, k) => sum + COL_GAP * (k.wide || 1), 0);
    let x = -rowWidth / 2;

    for (let colIdx = 0; colIdx < rowKeys.length; colIdx++) {
      const keyDef = rowKeys[colIdx];
      const wideMul = keyDef.wide || 1;
      const keyWidth = KEY_W * wideMul;
      const colWidth = COL_GAP * wideMul;

      const keyEntity = new pc.Entity(`Key_${keyDef.label.replace(/\n/g, '_')}`);
      keyEntity.addComponent('render', { type: 'box' });
      keyEntity.setLocalScale(keyWidth, KEY_H, KEY_D);
      keyEntity.setLocalPosition(
        x + colWidth / 2,
        0,
        (1.5 - rowIdx) * ROW_GAP
      );

      // Apply rubber material
      keyEntity.render!.meshInstances[0].material = rubberMat;

      // Add collision for raycasting
      keyEntity.addComponent('collision', {
        type: 'box',
        halfExtents: new pc.Vec3(keyWidth / 2, KEY_H / 2, KEY_D / 2),
      });

      // Tag and store key data for input routing
      keyEntity.tags.add('spectrum-key');
      (keyEntity as any)._specRow = keyDef.row;
      (keyEntity as any)._specBit = keyDef.bit;
      (keyEntity as any)._sticky = keyDef.sticky || false;
      (keyEntity as any)._label = keyDef.label;

      // Add key label (small plane on top of key)
      const labelEntity = createKeyLabel(app, keyDef, atlas, keyWidth);
      if (labelEntity) {
        keyEntity.addChild(labelEntity);
      }

      keys.set(keyDef.label, keyEntity);
      pivot.addChild(keyEntity);

      x += colWidth;
    }
  });

  return { keyboardEntity: keyboard, keys };
}

// ── Key label texture atlas ───────────────────────────────────────────────────

interface KeyAtlas {
  texture: pc.Texture;
  cellW: number;
  cellH: number;
  cols: number;
  rows: number;
}

function buildKeyLabelAtlas(device: pc.GraphicsDevice): KeyAtlas {
  const cols = 10;
  const rows = 4;
  const cellW = 64;
  const cellH = 64;
  const atlasW = cols * cellW;
  const atlasH = rows * cellH;

  const canvas = document.createElement('canvas');
  canvas.width = atlasW;
  canvas.height = atlasH;
  const ctx = canvas.getContext('2d')!;

  // Transparent background
  ctx.clearRect(0, 0, atlasW, atlasH);

  // Render each key label into its atlas cell
  ROWS.forEach((rowKeys, rowIdx) => {
    for (let colIdx = 0; colIdx < rowKeys.length && colIdx < cols; colIdx++) {
      const keyDef = rowKeys[colIdx];
      const cx = colIdx * cellW;
      const cy = rowIdx * cellH;

      // Main label (white)
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 18px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const mainLabel = keyDef.label.replace('\n', ' ');
      const fontSize = mainLabel.length > 3 ? 11 : 18;
      ctx.font = `bold ${fontSize}px monospace`;
      ctx.fillText(mainLabel, cx + cellW / 2, cy + cellH / 2 - 6);

      // Sub label / BASIC keyword (green, smaller)
      if (keyDef.sub) {
        ctx.fillStyle = '#00d800';
        ctx.font = '8px monospace';
        const subLabel = keyDef.sub.replace('\n', ' ');
        ctx.fillText(subLabel, cx + cellW / 2, cy + cellH - 10);
      }

      // Symbol (red, top-right)
      if (keyDef.sym) {
        ctx.fillStyle = '#d80000';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'right';
        ctx.fillText(keyDef.sym, cx + cellW - 4, cy + 12);
        ctx.textAlign = 'center';
      }
    }
  });

  const texture = new pc.Texture(device, {
    width: atlasW,
    height: atlasH,
    format: pc.PIXELFORMAT_RGBA8,
    mipmaps: true,
    minFilter: pc.FILTER_LINEAR_MIPMAP_LINEAR,
    magFilter: pc.FILTER_LINEAR,
  });
  texture.setSource(canvas);

  return { texture, cellW, cellH, cols, rows };
}

function createKeyLabel(
  app: pc.Application,
  keyDef: VKeyDef,
  atlas: KeyAtlas,
  keyWidth: number
): pc.Entity | null {
  // Find position in atlas
  let rowIdx = -1, colIdx = -1;
  for (let r = 0; r < ROWS.length; r++) {
    const c = ROWS[r].indexOf(keyDef);
    if (c >= 0) { rowIdx = r; colIdx = c; break; }
  }
  if (rowIdx < 0 || colIdx < 0) return null;

  const label = new pc.Entity('Label');
  label.addComponent('render', { type: 'plane' });
  label.setLocalScale(keyWidth * 0.85, 1, KEY_D * 0.85);
  label.setLocalEulerAngles(90, 0, 0);
  label.setLocalPosition(0, KEY_H / 2 + 0.001, 0);

  // Create material with atlas UV offset
  const mat = new pc.StandardMaterial();
  mat.diffuseMap = atlas.texture;
  mat.emissiveMap = atlas.texture;
  mat.emissive = new pc.Color(0.7, 0.7, 0.7);
  mat.useLighting = false;
  mat.blendType = pc.BLEND_NORMAL;
  mat.opacity = 0.95;
  mat.depthWrite = false;

  // UV offset/tiling for this key's atlas cell
  const u = colIdx / atlas.cols;
  const v = 1 - (rowIdx + 1) / atlas.rows;
  const uScale = 1 / atlas.cols;
  const vScale = 1 / atlas.rows;
  mat.diffuseMapTiling = new pc.Vec2(uScale, vScale);
  mat.diffuseMapOffset = new pc.Vec2(u, v);
  mat.emissiveMapTiling = new pc.Vec2(uScale, vScale);
  mat.emissiveMapOffset = new pc.Vec2(u, v);

  mat.update();
  label.render!.meshInstances[0].material = mat;

  return label;
}
