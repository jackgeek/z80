// Procedural brass material — warm gold metallic with brushed surface

import * as pc from 'playcanvas';
import { createProceduralTexture } from './material-factory.js';

export function createBrassMaterial(device: pc.GraphicsDevice): pc.StandardMaterial {
  const mat = new pc.StandardMaterial();

  // Diffuse: warm brass gold with subtle noise grain
  mat.diffuseMap = createProceduralTexture(device, 256, 256, (ctx, w, h) => {
    const imageData = ctx.createImageData(w, h);
    const d = imageData.data;
    for (let i = 0; i < d.length; i += 4) {
      const noise = Math.random() * 20 - 10;
      d[i]     = Math.min(255, Math.max(0, 200 + noise));       // R
      d[i + 1] = Math.min(255, Math.max(0, 146 + noise));       // G
      d[i + 2] = Math.min(255, Math.max(0, 28 + noise * 0.5));  // B
      d[i + 3] = 255;
    }
    ctx.putImageData(imageData, 0, 0);
  });
  mat.diffuse = new pc.Color(0.78, 0.57, 0.11);

  // PBR metallic brass
  mat.useMetalness = true;
  mat.metalness = 0.9;
  mat.gloss = 0.7;

  // Brushed horizontal normal map
  mat.normalMap = createProceduralTexture(device, 256, 256, (ctx, w, h) => {
    // Fill with flat normal (128, 128, 255)
    ctx.fillStyle = '#8080ff';
    ctx.fillRect(0, 0, w, h);
    // Add subtle horizontal brush lines
    for (let y = 0; y < h; y += 2) {
      const offset = Math.floor(Math.random() * 6 - 3);
      const r = 128 + offset;
      const g = 128 + offset;
      ctx.fillStyle = `rgb(${r}, ${g}, 255)`;
      ctx.fillRect(0, y, w, 1);
    }
  });
  mat.bumpiness = 0.3;

  mat.update();
  return mat;
}
