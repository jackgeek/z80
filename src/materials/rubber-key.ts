// Rubber key material — dark teal non-metallic, matching ZX Spectrum keys

import * as pc from 'playcanvas';

export function createRubberKeyMaterial(device: pc.GraphicsDevice): pc.StandardMaterial {
  const mat = new pc.StandardMaterial();
  mat.diffuse = new pc.Color(0.22, 0.31, 0.29);
  mat.useMetalness = true;
  mat.metalness = 0.0;
  mat.gloss = 0.2;
  mat.update();
  return mat;
}

export function createRubberKeyPressedMaterial(device: pc.GraphicsDevice): pc.StandardMaterial {
  const mat = new pc.StandardMaterial();
  mat.diffuse = new pc.Color(0.30, 0.40, 0.37);
  mat.useMetalness = true;
  mat.metalness = 0.0;
  mat.gloss = 0.25;
  mat.update();
  return mat;
}
