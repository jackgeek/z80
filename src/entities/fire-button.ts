// 3D fire button — brass base + red dome

import * as pc from 'playcanvas';
import { createBrassMaterial } from '../materials/brass.js';

export interface FireButtonResult {
  fireEntity: pc.Entity;
  fireButtonCap: pc.Entity;
}

export function createFireButton(app: pc.Application): FireButtonResult {
  const device = app.graphicsDevice;
  const brassMat = createBrassMaterial(device);

  const fire = new pc.Entity('FireButton');
  fire.tags.add('fire-button');

  // Base cylinder
  const base = new pc.Entity('FireBase');
  base.addComponent('render', { type: 'cylinder' });
  base.setLocalScale(0.4, 0.1, 0.4);
  base.setLocalPosition(0, 0, 0);
  base.render!.meshInstances[0].material = brassMat;
  fire.addChild(base);

  // Red dome cap
  const cap = new pc.Entity('FireCap');
  cap.addComponent('render', { type: 'sphere' });
  cap.setLocalScale(0.32, 0.2, 0.32);
  cap.setLocalPosition(0, 0.12, 0);
  const redMat = new pc.StandardMaterial();
  redMat.diffuse = new pc.Color(0.8, 0.1, 0.1);
  redMat.emissive = new pc.Color(0.3, 0.02, 0.02);
  redMat.useMetalness = true;
  redMat.metalness = 0.1;
  redMat.gloss = 0.6;
  redMat.update();
  cap.render!.meshInstances[0].material = redMat;
  fire.addChild(cap);

  // Collision for the button
  fire.addComponent('collision', {
    type: 'box',
    halfExtents: new pc.Vec3(0.2, 0.15, 0.2),
  });

  return { fireEntity: fire, fireButtonCap: cap };
}
