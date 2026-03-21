// ZX Spectrum Cube — Three.js rotating cube with live screen texture

import * as THREE from 'three';
import { getWasm } from '../emulator/state.js';

const BORDER_COLORS = [
  '#000000', '#0000CD', '#CD0000', '#CD00CD',
  '#00CD00', '#00CDCD', '#CDCD00', '#CDCDCD'
];

export function initCube() {
  const cubeCanvas     = document.getElementById('cube-canvas');
  const flatContainer  = document.getElementById('screen-container');
  const spectrumCanvas = document.getElementById('screen');
  const toggle         = document.getElementById('cube-toggle');

  let cubeMode = false;

  // ── Renderer ──────────────────────────────────────────────
  const SIZE = Math.min((document.getElementById('screen-side') || document.body).clientWidth || 560, 560);
  cubeCanvas.width  = SIZE;
  cubeCanvas.height = SIZE;

  const renderer = new THREE.WebGLRenderer({ canvas: cubeCanvas, antialias: true });
  renderer.setSize(SIZE, SIZE);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setClearColor(0x1a1a2e, 1);

  // ── Scene & Camera ────────────────────────────────────────
  const scene  = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, 0, 3.2);

  // ── Lighting ──────────────────────────────────────────────
  scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
  dirLight.position.set(3, 4, 5);
  scene.add(dirLight);
  const backLight = new THREE.DirectionalLight(0x8888ff, 0.3);
  backLight.position.set(-3, -2, -3);
  scene.add(backLight);

  // ── Texture ───────────────────────────────────────────────
  const texCanvas = document.createElement('canvas');
  texCanvas.width  = 512;
  texCanvas.height = 512;
  const texCtx = texCanvas.getContext('2d');

  const texture = new THREE.CanvasTexture(texCanvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.NearestFilter;

  function updateTexture() {
    const wasm = getWasm();
    const border = (wasm && wasm.getBorderColor)
      ? BORDER_COLORS[wasm.getBorderColor()]
      : '#cdcdcd';

    texCtx.fillStyle = border;
    texCtx.fillRect(0, 0, 512, 512);

    const padX = 44, padY = 64;
    texCtx.imageSmoothingEnabled = false;
    texCtx.drawImage(spectrumCanvas, padX, padY, 512 - padX * 2, 512 - padY * 2);

    texture.needsUpdate = true;
  }

  // ── Cube ──────────────────────────────────────────────────
  const geometry  = new THREE.BoxGeometry(1.6, 1.6, 1.6);
  const materials = Array(6).fill(null).map(() =>
    new THREE.MeshStandardMaterial({ map: texture, roughness: 0.3, metalness: 0.1 })
  );
  const cube = new THREE.Mesh(geometry, materials);
  scene.add(cube);

  // ── Render loop ───────────────────────────────────────────
  function animate() {
    requestAnimationFrame(animate);
    if (!cubeMode) return;

    cube.rotation.x += 0.007;
    cube.rotation.y += 0.011;
    cube.rotation.z += 0.005;

    updateTexture();
    renderer.render(scene, camera);
  }

  animate();

  // ── Toggle ────────────────────────────────────────────────
  toggle.addEventListener('change', () => {
    cubeMode = toggle.checked;
    if (cubeMode) {
      flatContainer.style.display = 'none';
      cubeCanvas.style.display    = 'block';
    } else {
      flatContainer.style.display = '';
      cubeCanvas.style.display    = 'none';
    }
  });

  // ── Resize ────────────────────────────────────────────────
  window.addEventListener('resize', () => {
    const s = Math.min((document.getElementById('screen-side') || document.body).clientWidth || 560, 560);
    renderer.setSize(s, s);
    cubeCanvas.width  = s;
    cubeCanvas.height = s;
  });
}
