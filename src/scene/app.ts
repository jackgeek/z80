// PlayCanvas application bootstrap — full viewport, no scroll

import * as pc from 'playcanvas';

export function initPlayCanvasApp(): pc.Application {
  const canvas = document.getElementById('app-canvas') as HTMLCanvasElement;

  const app = new pc.Application(canvas, {
    mouse: new pc.Mouse(canvas),
    touch: new pc.TouchDevice(canvas),
    keyboard: new pc.Keyboard(window),
    graphicsDeviceOptions: {
      antialias: true,
      alpha: false,
      preserveDrawingBuffer: false,
    },
  });

  app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
  app.setCanvasResolution(pc.RESOLUTION_AUTO);

  // Warm steampunk ambient — bright enough to see details
  app.scene.ambientLight = new pc.Color(0.38, 0.35, 0.30);

  app.start();

  window.addEventListener('resize', () => app.resizeCanvas());

  return app;
}
