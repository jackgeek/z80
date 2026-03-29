// Debug utility — places coloured sphere markers at the four corners of the
// Z=0 entity plane by casting rays from the viewport corners each frame.

import * as pc from 'playcanvas';

export interface FrustumMarkers {
  /** Call once per frame (pass dt in seconds) to reposition markers and log. */
  update(dt: number): void;
}

interface Marker {
  entity: pc.Entity;
  screenX: number; // 0 = left, canvas.width = right
  screenY: number; // 0 = top, canvas.height = bottom (PlayCanvas convention)
  label: string;
}

export function createFrustumMarkers(
  app: pc.Application,
  cameraEntity: pc.Entity
): FrustumMarkers {
  const colors: Array<[string, pc.Color]> = [
    ['TL', new pc.Color(1, 0, 0)],   // top-left     red
    ['TR', new pc.Color(0, 1, 0)],   // top-right    green
    ['BL', new pc.Color(0, 0, 1)],   // bottom-left  blue
    ['BR', new pc.Color(1, 1, 0)],   // bottom-right yellow
  ];

  const markers: Marker[] = colors.map(([label, color]) => {
    const entity = new pc.Entity(`FrustumMarker_${label}`);
    entity.addComponent('render', {
      type: 'sphere',
      castShadows: false,
    });

    const mat = new pc.StandardMaterial();
    mat.emissive = color;
    mat.emissiveIntensity = 1;
    mat.diffuse = new pc.Color(0, 0, 0);
    mat.update();
    entity.render!.meshInstances[0].material = mat;

    entity.setLocalScale(0.15, 0.15, 0.15);
    app.root.addChild(entity);

    // Placeholder screen coords — updated each frame
    return { entity, screenX: 0, screenY: 0, label };
  });

  const worldPos = new pc.Vec3();
  let logTimer = 0;

  return {
    update(dt: number): void {
      const cam = cameraEntity.camera;
      if (!cam) return;

      const canvas = app.graphicsDevice.canvas;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      const camZ = cameraEntity.getPosition().z;

      // Screen coords for each corner (PlayCanvas: 0,0 = top-left)
      const corners: Array<[number, number, string, Marker]> = [
        [0,     0,     'TL', markers[0]],
        [w - 1, 0,     'TR', markers[1]],
        [0,     h - 1, 'BL', markers[2]],
        [w - 1, h - 1, 'BR', markers[3]],
      ];

      let minX = Infinity, maxX = -Infinity;
      let minY = Infinity, maxY = -Infinity;

      const positions: Record<string, pc.Vec3> = {};

      for (const [sx, sy, label, marker] of corners) {
        cam.screenToWorld(sx, sy, camZ, worldPos);
        marker.entity.setPosition(worldPos.x, worldPos.y, 0);
        positions[label] = worldPos.clone();
        if (worldPos.x < minX) minX = worldPos.x;
        if (worldPos.x > maxX) maxX = worldPos.x;
        if (worldPos.y < minY) minY = worldPos.y;
        if (worldPos.y > maxY) maxY = worldPos.y;
      }

      logTimer += dt;
      if (logTimer >= 1) {
        logTimer = 0;
        const W = maxX - minX;
        const H = maxY - minY;
        const tl = positions['TL'];
        const tr = positions['TR'];
        const bl = positions['BL'];
        const br = positions['BR'];
        console.log(
          `[FrustumMarkers] W=${W.toFixed(3)} H=${H.toFixed(3)} camZ=${camZ.toFixed(2)}` +
          ` | TL=(${tl.x.toFixed(3)}, ${tl.y.toFixed(3)})` +
          ` TR=(${tr.x.toFixed(3)}, ${tr.y.toFixed(3)})` +
          ` BL=(${bl.x.toFixed(3)}, ${bl.y.toFixed(3)})` +
          ` BR=(${br.x.toFixed(3)}, ${br.y.toFixed(3)})`
        );
      }
    },
  };
}
