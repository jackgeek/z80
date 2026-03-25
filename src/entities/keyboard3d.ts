// 3D ZX Spectrum keyboard — loaded from GLB model

import * as pc from "playcanvas";

export interface Keyboard3DResult {
  keyboardEntity: pc.Entity;
  keys: Map<string, pc.Entity>;
  pressKey: (index: number, down: boolean) => void;
}

const KEY_PRESS_OFFSET = 0.001; // local-space Y offset when a key is pressed

export function createKeyboard3D(app: pc.Application): Keyboard3DResult {
  const keyboard = new pc.Entity("Keyboard3D");
  keyboard.tags.add("swipeable");

  const keys = new Map<string, pc.Entity>();
  const restPositions = new Map<string, pc.Vec3>();

  const asset = new pc.Asset("ZXSpectrum2", "container", {
    url: "assets/ZXSpectrum2.glb",
  });
  app.assets.add(asset);
  asset.ready(() => {
    const model = (
      asset.resource as pc.ContainerResource
    ).instantiateRenderEntity();
    // Rotate flat XZ-plane model to face +Z (toward camera), matching monitor orientation
    model.setLocalEulerAngles(90, 0, 0);
    model.setLocalScale(13.2, 13.2, 13.2);
    keyboard.addChild(model);

    // Collect individual key entities (numbered 0–39, top-left to bottom-right)
    for (let i = 0; i < 40; i++) {
      const keyEntity = model.findByName(`Key.Caps.${i}`) as pc.Entity | null;
      if (keyEntity) {
        keys.set(String(i), keyEntity);
        restPositions.set(String(i), keyEntity.getLocalPosition().clone());
      }
    }
  });
  app.assets.load(asset);

  function pressKey(index: number, down: boolean): void {
    const key = String(index);
    const entity = keys.get(key);
    const rest = restPositions.get(key);
    if (!entity || !rest) return;
    if (down) {
      entity.setLocalPosition(rest.x, rest.y - KEY_PRESS_OFFSET, rest.z);
    } else {
      entity.setLocalPosition(rest.x, rest.y, rest.z);
    }
  }

  return { keyboardEntity: keyboard, keys, pressKey };
}
