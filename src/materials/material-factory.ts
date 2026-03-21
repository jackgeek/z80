// Procedural texture generation utilities for steampunk materials

import * as pc from 'playcanvas';

export function createProceduralTexture(
  device: pc.GraphicsDevice,
  width: number,
  height: number,
  generator: (ctx: CanvasRenderingContext2D, w: number, h: number) => void
): pc.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  generator(ctx, width, height);

  const texture = new pc.Texture(device, {
    width,
    height,
    format: pc.PIXELFORMAT_RGBA8,
    mipmaps: true,
    minFilter: pc.FILTER_LINEAR_MIPMAP_LINEAR,
    magFilter: pc.FILTER_LINEAR,
  });
  texture.setSource(canvas);
  return texture;
}
