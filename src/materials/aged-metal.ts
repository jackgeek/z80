// Procedural aged/dark iron material with rust spots

import * as pc from 'playcanvas';
import { createProceduralTexture } from './material-factory.js';

export function createAgedMetalMaterial(device: pc.GraphicsDevice): pc.StandardMaterial {
  const mat = new pc.StandardMaterial();

  mat.diffuseMap = createProceduralTexture(device, 256, 256, (ctx, w, h) => {
    const imageData = ctx.createImageData(w, h);
    const d = imageData.data;
    for (let i = 0; i < d.length; i += 4) {
      const noise = Math.random() * 10 - 5;
      const rust = Math.random() < 0.08;
      d[i]     = Math.min(255, Math.max(0, rust ? 120 + noise : 64 + noise));
      d[i + 1] = Math.min(255, Math.max(0, rust ? 60 + noise : 64 + noise));
      d[i + 2] = Math.min(255, Math.max(0, rust ? 30 + noise : 72 + noise));
      d[i + 3] = 255;
    }
    ctx.putImageData(imageData, 0, 0);
  });
  mat.diffuse = new pc.Color(0.25, 0.25, 0.28);

  mat.useMetalness = true;
  mat.metalness = 0.7;
  mat.gloss = 0.3;

  mat.update();
  return mat;
}
