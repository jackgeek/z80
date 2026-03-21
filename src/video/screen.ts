import { getWasm, getMemory, SCREEN_WIDTH, SCREEN_HEIGHT } from '../emulator/state.js';

export const BORDER_COLORS = [
  '#000000', '#0000CD', '#CD0000', '#CD00CD',
  '#00CD00', '#00CDCD', '#CDCD00', '#CDCDCD'
];

const SCREEN_BYTES = SCREEN_WIDTH * SCREEN_HEIGHT * 4;
let screenSrc: Uint8Array | null = null;
let lastBorderColor = -1;
let useWebGL = false;
let gl: WebGLRenderingContext | null = null;
let glTexture: WebGLTexture | null = null;
let ctx2d: CanvasRenderingContext2D | null = null;
let imageData: ImageData | null = null;
let imgDest: Uint8Array | null = null;
let canvas: HTMLCanvasElement | null = null;
let screenContainer: HTMLElement | null = null;

export function initScreen(): void {
  canvas = document.getElementById('screen') as HTMLCanvasElement;
  screenContainer = document.getElementById('screen-container');

  gl = canvas.getContext('webgl', { antialias: false, depth: false, stencil: false, alpha: false });

  if (gl) {
    useWebGL = true;

    const vsSource = 'attribute vec2 p; varying vec2 uv; void main() { uv = vec2(p.x * 0.5 + 0.5, 0.5 - p.y * 0.5); gl_Position = vec4(p, 0.0, 1.0); }';
    const fsSource = 'precision mediump float; varying vec2 uv; uniform sampler2D tex; void main() { gl_FragColor = texture2D(tex, uv); }';

    const vs = gl.createShader(gl.VERTEX_SHADER)!;
    gl.shaderSource(vs, vsSource);
    gl.compileShader(vs);

    const fs = gl.createShader(gl.FRAGMENT_SHADER)!;
    gl.shaderSource(fs, fsSource);
    gl.compileShader(fs);

    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

    const pLoc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(pLoc);
    gl.vertexAttribPointer(pLoc, 2, gl.FLOAT, false, 0, 0);

    glTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, glTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, SCREEN_WIDTH, SCREEN_HEIGHT, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

    gl.viewport(0, 0, canvas.width, canvas.height);
  } else {
    useWebGL = false;
    ctx2d = canvas.getContext('2d')!;
    imageData = ctx2d.createImageData(SCREEN_WIDTH, SCREEN_HEIGHT);
    imgDest = new Uint8Array(imageData.data.buffer);
  }
}

export function renderFrame(): void {
  const wasm = getWasm();
  const memory = getMemory();
  if (!wasm || !memory) return;

  if (!screenSrc) {
    screenSrc = new Uint8Array(memory.buffer, wasm.getScreenBaseAddr(), SCREEN_BYTES);
  }

  if (useWebGL) {
    gl!.texSubImage2D(gl!.TEXTURE_2D, 0, 0, 0, SCREEN_WIDTH, SCREEN_HEIGHT, gl!.RGBA, gl!.UNSIGNED_BYTE, screenSrc);
    gl!.drawArrays(gl!.TRIANGLE_STRIP, 0, 4);
  } else {
    imgDest!.set(screenSrc);
    ctx2d!.putImageData(imageData!, 0, 0);
  }

  const borderColor = wasm.getBorderColor();
  if (borderColor !== lastBorderColor) {
    lastBorderColor = borderColor;
    screenContainer!.style.background = BORDER_COLORS[borderColor & 7];
  }
}
