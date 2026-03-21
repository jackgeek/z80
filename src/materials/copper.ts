// Procedural copper material — reddish metallic with green patina

import * as pc from 'playcanvas';
import { createProceduralTexture } from './material-factory.js';

export function createCopperMaterial(device: pc.GraphicsDevice): pc.StandardMaterial {
  const mat = new pc.StandardMaterial();

  mat.diffuseMap = createProceduralTexture(device, 256, 256, (ctx, w, h) => {
    const imageData = ctx.createImageData(w, h);
    const d = imageData.data;
    for (let i = 0; i < d.length; i += 4) {
      const noise = Math.random() * 15 - 7;
      // Base copper with occasional green patina spots
      const patina = Math.random() < 0.05;
      d[i]     = Math.min(255, Math.max(0, patina ? 80 + noise : 184 + noise));
      d[i + 1] = Math.min(255, Math.max(0, patina ? 140 + noise : 115 + noise));
      d[i + 2] = Math.min(255, Math.max(0, patina ? 100 + noise : 51 + noise));
      d[i + 3] = 255;
    }
    ctx.putImageData(imageData, 0, 0);
  });
  mat.diffuse = new pc.Color(0.72, 0.45, 0.20);

  mat.useMetalness = true;
  mat.metalness = 0.85;
  mat.gloss = 0.5;

  mat.update();
  return mat;
}
