// 3D ZX Spectrum keyboard — loaded from GLB model

import * as pc from 'playcanvas';

export interface Keyboard3DResult {
  keyboardEntity: pc.Entity;
  keys: Map<string, pc.Entity>;
}

export function createKeyboard3D(app: pc.Application): Keyboard3DResult {
  const keyboard = new pc.Entity('Keyboard3D');
  keyboard.tags.add('swipeable');

  const asset = new pc.Asset('ZXSpectrum', 'container', {
    url: 'assets/ZXSpectrum.glb',
  });
  app.assets.add(asset);
  asset.ready(() => {
    const model = (asset.resource as pc.ContainerResource).instantiateRenderEntity();
    // Rotate flat XZ-plane model to face +Z (toward camera), matching monitor orientation
    model.setLocalEulerAngles(90, 0, 0);
    model.setLocalScale(13.2, 13.2, 13.2);
    keyboard.addChild(model);
  });
  app.assets.load(asset);

  return { keyboardEntity: keyboard, keys: new Map() };
}
