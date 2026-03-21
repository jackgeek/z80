// Fullscreen mode + touch joystick overlay

import { getWasm } from '../emulator/state.js';
import { specKeyDown, specKeyUp } from './vkeyboard.js';

interface KeyMapping {
  row: number;
  bit: number;
}

interface JoyDirs {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  fire: boolean;
}

// ── Key mappings ──────────────────────────────────────────────────────────
const KEYMAPS: Record<string, Record<string, KeyMapping>> = {
  sinclair1: {
    up:    { row: 4, bit: 0x02 }, // 9
    down:  { row: 4, bit: 0x04 }, // 8
    left:  { row: 4, bit: 0x10 }, // 6
    right: { row: 4, bit: 0x08 }, // 7
    fire:  { row: 4, bit: 0x01 }, // 0
  },
  cursor: {
    up:    { row: 4, bit: 0x08 }, // 7
    down:  { row: 4, bit: 0x10 }, // 6
    left:  { row: 3, bit: 0x10 }, // 5
    right: { row: 4, bit: 0x04 }, // 8
    fire:  { row: 4, bit: 0x01 }, // 0
  },
};

export function initJoystick(): void {

  // ── State ─────────────────────────────────────────────────────────────────
  let joyType = 'sinclair1';
  let isFullscreen = false;
  let joy: JoyDirs = { up: false, down: false, left: false, right: false, fire: false };

  // ── Elements ──────────────────────────────────────────────────────────────
  const screenEl  = document.getElementById('screen') as HTMLCanvasElement;
  const fireZone  = document.getElementById('js-fire-zone')!;
  const dpadZone  = document.getElementById('js-dpad-zone')!;
  const dpadEl    = document.getElementById('js-dpad')!;
  const arms: Record<string, HTMLElement> = {};
  document.querySelectorAll<HTMLElement>('.js-dpad-arm').forEach(el => { arms[el.dataset.dir!] = el; });

  // ── Apply joystick state ──────────────────────────────────────────────────
  function applyJoy(next: JoyDirs): void {
    const dirs: (keyof JoyDirs)[] = ['up', 'down', 'left', 'right', 'fire'];

    if (joyType === 'kempston') {
      const changed = dirs.some(d => next[d] !== joy[d]);
      const wasm = getWasm();
      if (changed && wasm && wasm.setKempston) {
        wasm.setKempston(
          (next.right ? 0x01 : 0) | (next.left  ? 0x02 : 0) |
          (next.down  ? 0x04 : 0) | (next.up    ? 0x08 : 0) |
          (next.fire  ? 0x10 : 0)
        );
      }
    } else {
      const map = KEYMAPS[joyType];
      if (map) {
        dirs.forEach(d => {
          if (next[d] === joy[d]) return;
          const k = map[d];
          if (!k) return;
          if (next[d]) specKeyDown(k.row, k.bit);
          else         specKeyUp(k.row, k.bit);
        });
      }
    }

    // Update D-pad visuals
    (['up','down','left','right'] as const).forEach(d => {
      if (arms[d]) arms[d].classList.toggle('active', next[d]);
    });
    fireZone.classList.toggle('active', next.fire);

    joy = { ...next };
  }

  function releaseAll(): void {
    fireTouches.clear();
    dpadTouches.clear();
    applyJoy({ up: false, down: false, left: false, right: false, fire: false });
  }

  // ── D-pad touch tracking ──────────────────────────────────────────────────
  const dpadTouches = new Map<number, { x: number; y: number }>();
  const fireTouches = new Set<number>();

  function calcDirs(): { up: boolean; down: boolean; left: boolean; right: boolean } {
    if (dpadTouches.size === 0) {
      return { up: false, down: false, left: false, right: false };
    }

    // Use the most recently moved dpad touch
    const touch = dpadTouches.values().next().value!;

    // Compute direction relative to the visual dpad cross, not the full zone
    const rect = dpadEl.getBoundingClientRect();
    const cx = rect.left + rect.width  * 0.5;
    const cy = rect.top  + rect.height * 0.5;
    const dx = touch.x - cx;
    const dy = touch.y - cy;
    const dist = Math.hypot(dx, dy);
    const deadzone = Math.min(rect.width, rect.height) * 0.08;

    if (dist < deadzone) return { up: false, down: false, left: false, right: false };

    const nx = dx / dist;
    const ny = dy / dist;
    return {
      up:    ny < -0.3,
      down:  ny >  0.3,
      left:  nx < -0.3,
      right: nx >  0.3,
    };
  }

  function updateJoy(): void {
    applyJoy({ ...calcDirs(), fire: fireTouches.size > 0 });
  }

  // ── D-pad touch events ────────────────────────────────────────────────────
  dpadZone.addEventListener('touchstart', e => {
    e.preventDefault();
    for (const t of Array.from(e.changedTouches)) {
      dpadTouches.set(t.identifier, { x: t.clientX, y: t.clientY });
    }
    updateJoy();
  }, { passive: false });

  dpadZone.addEventListener('touchmove', e => {
    e.preventDefault();
    for (const t of Array.from(e.changedTouches)) {
      if (dpadTouches.has(t.identifier)) {
        dpadTouches.set(t.identifier, { x: t.clientX, y: t.clientY });
      }
    }
    updateJoy();
  }, { passive: false });

  function dpadEnd(e: TouchEvent): void {
    e.preventDefault();
    for (const t of Array.from(e.changedTouches)) dpadTouches.delete(t.identifier);
    updateJoy();
  }
  dpadZone.addEventListener('touchend',    dpadEnd, { passive: false });
  dpadZone.addEventListener('touchcancel', dpadEnd, { passive: false });

  // ── Fire touch events ─────────────────────────────────────────────────────
  fireZone.addEventListener('touchstart', e => {
    e.preventDefault();
    for (const t of Array.from(e.changedTouches)) fireTouches.add(t.identifier);
    updateJoy();
  }, { passive: false });

  function fireEnd(e: TouchEvent): void {
    e.preventDefault();
    for (const t of Array.from(e.changedTouches)) fireTouches.delete(t.identifier);
    updateJoy();
  }
  fireZone.addEventListener('touchend',    fireEnd, { passive: false });
  fireZone.addEventListener('touchcancel', fireEnd, { passive: false });
  fireZone.addEventListener('touchmove',   e => e.preventDefault(), { passive: false });

  // ── Screen resizing ───────────────────────────────────────────────────────
  const screenContainer = document.getElementById('screen-container')!;
  const RATIO = 256 / 192;

  function fitScreen(cw: number, ch: number): void {
    if (!cw || !ch) return;
    let w: number, h: number;
    if (cw / ch > RATIO) { h = ch; w = h * RATIO; }
    else                  { w = cw; h = w / RATIO; }
    screenEl.style.width  = Math.floor(w) + 'px';
    screenEl.style.height = Math.floor(h) + 'px';
  }

  function clearScreenSize(): void {
    screenEl.style.width  = '';
    screenEl.style.height = '';
  }

  if (window.ResizeObserver) {
    new ResizeObserver(entries => {
      if (!isFullscreen) return;
      const { width, height } = entries[0].contentRect;
      fitScreen(width, height);
    }).observe(screenContainer);
  }

  // ── Fullscreen ────────────────────────────────────────────────────────────
  function enterFullscreen(): void {
    isFullscreen = true;
    document.body.classList.add('js-fullscreen');
    clearScreenSize();
    releaseAll();
    window.scrollTo(0, 0);

    const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };
    const req = el.requestFullscreen || el.webkitRequestFullscreen;
    if (req) req.call(el).catch(() => {});
  }

  function exitFullscreen(): void {
    isFullscreen = false;
    document.body.classList.remove('js-fullscreen');
    clearScreenSize();
    releaseAll();

    const doc = document as Document & { webkitFullscreenElement?: Element; webkitExitFullscreen?: () => Promise<void> };
    if (document.fullscreenElement || doc.webkitFullscreenElement) {
      (document.exitFullscreen || doc.webkitExitFullscreen!).call(document).catch(() => {});
    }
  }

  document.getElementById('fs-btn')!.addEventListener('click',      () => isFullscreen ? exitFullscreen() : enterFullscreen());
  document.getElementById('fs-exit-btn')!.addEventListener('click', exitFullscreen);

  // Sync when user exits via browser UI / Escape
  function syncFsState(): void {
    const doc = document as Document & { webkitFullscreenElement?: Element };
    if (!document.fullscreenElement && !doc.webkitFullscreenElement && isFullscreen) {
      exitFullscreen();
    }
  }
  document.addEventListener('fullscreenchange',       syncFsState);
  document.addEventListener('webkitfullscreenchange', syncFsState);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && isFullscreen) exitFullscreen(); });

  // ── Joystick type ─────────────────────────────────────────────────────────
  document.getElementById('joy-type-select')!.addEventListener('change', e => {
    joyType = (e.target as HTMLSelectElement).value;
    releaseAll();
  });

}
