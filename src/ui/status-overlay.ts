// Minimal 2D status text overlay using PlayCanvas screen elements

import * as pc from 'playcanvas';

export interface StatusOverlay {
  setStatusText: (text: string) => void;
}

export function createStatusOverlay(app: pc.Application): StatusOverlay {
  // Create a 2D screen entity for HUD-style text
  const screen = new pc.Entity('StatusScreen');
  screen.addComponent('screen', {
    screenSpace: true,
    referenceResolution: new pc.Vec2(1280, 720),
    scaleMode: 'blend',
    scaleBlend: 0.5,
  });
  app.root.addChild(screen);

  // Text element anchored at bottom-center
  const textEntity = new pc.Entity('StatusText');
  textEntity.addComponent('element', {
    type: 'text',
    anchor: new pc.Vec4(0.5, 0, 0.5, 0),
    pivot: new pc.Vec2(0.5, 0),
    text: '',
    fontSize: 18,
    color: new pc.Color(0.7, 0.7, 0.7),
    width: 800,
    height: 40,
    wrapLines: false,
    autoWidth: false,
    autoHeight: false,
  });
  textEntity.setLocalPosition(0, 30, 0);
  screen.addChild(textEntity);

  let fadeTimer: number | null = null;

  return {
    setStatusText(text: string): void {
      textEntity.element!.text = text;
      textEntity.element!.opacity = 1;

      // Auto-fade after 5 seconds
      if (fadeTimer !== null) clearTimeout(fadeTimer);
      if (text) {
        fadeTimer = window.setTimeout(() => {
          textEntity.element!.text = '';
          fadeTimer = null;
        }, 5000);
      }
    },
  };
}
