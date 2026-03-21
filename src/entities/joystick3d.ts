// 3D brass joystick — base cylinder + stick + ball, facing camera

import * as pc from 'playcanvas';
import { createBrassMaterial } from '../materials/brass.js';
import { createCopperMaterial } from '../materials/copper.js';

export interface Joystick3DResult {
  joystickEntity: pc.Entity;
  joystickStick: pc.Entity;
  joystickBall: pc.Entity;
}

export function createJoystick3D(app: pc.Application): Joystick3DResult {
  const device = app.graphicsDevice;
  const brassMat = createBrassMaterial(device);
  const copperMat = createCopperMaterial(device);

  const joystick = new pc.Entity('Joystick3D');
  joystick.tags.add('joystick');

  // Pivot rotates content so joystick top faces camera (Z-forward)
  const pivot = new pc.Entity('JoyPivot');
  pivot.setLocalEulerAngles(-90, 180, 0);
  joystick.addChild(pivot);

  // Base cylinder
  const base = new pc.Entity('JoystickBase');
  base.addComponent('render', { type: 'cylinder' });
  base.setLocalScale(0.5, 0.12, 0.5);
  base.setLocalPosition(0, 0, 0);
  base.render!.meshInstances[0].material = brassMat;
  pivot.addChild(base);

  // Stick
  const stick = new pc.Entity('JoystickStick');
  stick.addComponent('render', { type: 'cylinder' });
  stick.setLocalScale(0.06, 0.5, 0.06);
  stick.setLocalPosition(0, 0.31, 0);
  stick.render!.meshInstances[0].material = copperMat;
  pivot.addChild(stick);

  // Ball at top
  const ball = new pc.Entity('JoystickBall');
  ball.addComponent('render', { type: 'sphere' });
  ball.setLocalScale(0.14, 0.14, 0.14);
  ball.setLocalPosition(0, 0.6, 0);
  ball.render!.meshInstances[0].material = brassMat;
  pivot.addChild(ball);

  // Collision for the whole joystick area
  joystick.addComponent('collision', {
    type: 'box',
    halfExtents: new pc.Vec3(0.25, 0.35, 0.25),
  });

  return { joystickEntity: joystick, joystickStick: stick, joystickBall: ball };
}
