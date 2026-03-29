// Debug utility — places coloured sphere markers at the four corners of the
// Z=0 entity plane by casting rays from the viewport corners each frame.

import * as pc from 'playcanvas';

export interface FrustumMarkers {
  /** Call once per frame (pass dt in seconds) to reposition markers and log. */
  update(dt: number): void;
}

interface Marker {
  entity: pc.Entity;
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
    return { entity, label };
  });

  // Pre-allocated to avoid per-frame GC
  const rayNear = new pc.Vec3();
  const rayFar = new pc.Vec3();
  const cornerScreens: Array<[number, number, Marker]> = [
    [0, 0, markers[0]],
    [0, 0, markers[1]],
    [0, 0, markers[2]],
    [0, 0, markers[3]],
  ];
  let logTimer = 0;

  return {
    update(dt: number): void {
      const cam = cameraEntity.camera;
      if (!cam) return;

      const canvas = app.graphicsDevice.canvas;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;

      // Screen corners: (PlayCanvas: 0,0 = top-left)
      cornerScreens[0][0] = 0;     cornerScreens[0][1] = 0;
      cornerScreens[1][0] = w - 1; cornerScreens[1][1] = 0;
      cornerScreens[2][0] = 0;     cornerScreens[2][1] = h - 1;
      cornerScreens[3][0] = w - 1; cornerScreens[3][1] = h - 1;

      let minX = Infinity, maxX = -Infinity;
      let minY = Infinity, maxY = -Infinity;

      const positions: [number, number][] = [];

      for (const [sx, sy, marker] of cornerScreens) {
        // Cast ray at near and far clip planes, then intersect with Z=0 plane.
        // This is correct regardless of how screenToWorld interprets its depth
        // parameter — corner rays aren't parallel to the camera axis, so passing
        // camZ directly would place the point above Z=0 in world space.
        cam.screenToWorld(sx, sy, cam.nearClip, rayNear);
        cam.screenToWorld(sx, sy, cam.farClip, rayFar);
        // Parametric: P = rayNear + t*(rayFar - rayNear), solve P.z = 0
        const t = -rayNear.z / (rayFar.z - rayNear.z);
        const wx = rayNear.x + t * (rayFar.x - rayNear.x);
        const wy = rayNear.y + t * (rayFar.y - rayNear.y);
        marker.entity.setPosition(wx, wy, 0);
        positions.push([wx, wy]);
        if (wx < minX) minX = wx;
        if (wx > maxX) maxX = wx;
        if (wy < minY) minY = wy;
        if (wy > maxY) maxY = wy;
      }

      logTimer += dt;
      if (logTimer >= 1) {
        logTimer = 0;
        const W = maxX - minX;
        const H = maxY - minY;
        const camZ = cameraEntity.getLocalPosition().z;
        const fmt = (v: number) => v.toFixed(3);
        console.log(
          `[FrustumMarkers] W=${fmt(W)} H=${fmt(H)} camZ=${camZ.toFixed(2)}` +
          ` | TL=(${fmt(positions[0][0])}, ${fmt(positions[0][1])})` +
          ` TR=(${fmt(positions[1][0])}, ${fmt(positions[1][1])})` +
          ` BL=(${fmt(positions[2][0])}, ${fmt(positions[2][1])})` +
          ` BR=(${fmt(positions[3][0])}, ${fmt(positions[3][1])})`
        );
      }
    },
  };
}
