// 3D menu button — brass gear/cog shape

import * as pc from 'playcanvas';
import { createBrassMaterial } from '../materials/brass.js';
import { createAgedMetalMaterial } from '../materials/aged-metal.js';

export interface MenuButtonResult {
  menuButtonEntity: pc.Entity;
}

export function createMenuButton(app: pc.Application): MenuButtonResult {
  const device = app.graphicsDevice;
  const brassMat = createBrassMaterial(device);
  const agedMat = createAgedMetalMaterial(device);

  const menuButton = new pc.Entity('MenuButton');
  menuButton.tags.add('menu-button');

  // Outer ring (aged metal)
  const ring = new pc.Entity('ButtonRing');
  ring.addComponent('render', { type: 'cylinder' });
  ring.setLocalScale(0.35, 0.04, 0.35);
  ring.setLocalPosition(0, 0, 0);
  ring.render!.meshInstances[0].material = agedMat;
  menuButton.addChild(ring);

  // Inner gear icon (brass, slightly raised)
  const gear = new pc.Entity('GearIcon');
  gear.addComponent('render', { type: 'cylinder' });
  gear.setLocalScale(0.25, 0.06, 0.25);
  gear.setLocalPosition(0, 0.02, 0);
  gear.render!.meshInstances[0].material = brassMat;
  menuButton.addChild(gear);

  // Collision
  menuButton.addComponent('collision', {
    type: 'box',
    halfExtents: new pc.Vec3(0.18, 0.05, 0.18),
  });

  return { menuButtonEntity: menuButton };
}
