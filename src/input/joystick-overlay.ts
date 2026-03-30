// HTML touch overlay for joystick d-pad and fire button
// Ported from main branch joystick.ts — direction computed relative to dpad visual centre

import * as pc from 'playcanvas';
import type { JoystickType } from './input-bridge.js';
import { getWasm } from '../emulator/state.js';

const KEYMAPS: Record<string, Record<string, { row: number; bit: number }>> = {
  sinclair1: {
    up:    { row: 4, bit: 0x02 },
    down:  { row: 4, bit: 0x04 },
    left:  { row: 4, bit: 0x10 },
    right: { row: 4, bit: 0x08 },
    fire:  { row: 4, bit: 0x01 },
  },
  cursor: {
    up:    { row: 4, bit: 0x08 },
    down:  { row: 4, bit: 0x10 },
    left:  { row: 3, bit: 0x10 },
    right: { row: 4, bit: 0x04 },
    fire:  { row: 4, bit: 0x01 },
  },
  kempston: {
    up:    { row: 0, bit: 0 },
    down:  { row: 0, bit: 0 },
    left:  { row: 0, bit: 0 },
    right: { row: 0, bit: 0 },
    fire:  { row: 0, bit: 0 },
  },
};

interface JoyDirs {
  up: boolean; down: boolean; left: boolean; right: boolean; fire: boolean;
}

export class JoystickOverlay {
  private dpadZone: HTMLElement;
  private dpadEl: HTMLElement;
  private fireZone: HTMLElement;
  private fireBtnEl: HTMLElement;
  private arms: Record<string, HTMLElement> = {};

  private joy: JoyDirs = { up: false, down: false, left: false, right: false, fire: false };
  private dpadTouches = new Map<number, { x: number; y: number }>();
  private fireTouches = new Set<number>();
  private joystickType: JoystickType = 'sinclair1';

  constructor() {
    this.dpadZone = this._el('div', 'joy-dpad-zone');
    this.dpadEl   = this._el('div', 'joy-dpad');
    this.dpadZone.appendChild(this.dpadEl);

    for (const dir of ['up', 'left', 'center', 'right', 'down'] as const) {
      const arm = this._el('div', `joy-dpad-arm joy-dpad-${dir}`);
      if (dir === 'up')    arm.textContent = '▲';
      if (dir === 'left')  arm.textContent = '◄';
      if (dir === 'right') arm.textContent = '►';
      if (dir === 'down')  arm.textContent = '▼';
      this.dpadEl.appendChild(arm);
      if (dir !== 'center') this.arms[dir] = arm;
    }

    this.fireZone   = this._el('div', 'joy-fire-zone');
    this.fireBtnEl  = this._el('div', 'joy-fire-btn');
    const dot       = this._el('div', 'joy-fire-dot');
    const label     = this._el('span', 'joy-fire-label');
    label.textContent = 'FIRE';
    this.fireBtnEl.appendChild(dot);
    this.fireBtnEl.appendChild(label);
    this.fireZone.appendChild(this.fireBtnEl);

    this._injectStyles();
    document.body.appendChild(this.dpadZone);
    document.body.appendChild(this.fireZone);

    this._bindEvents();
  }

  setJoystickType(type: JoystickType): void {
    this.joystickType = type;
    this.releaseAll();
  }

  /** Reposition zones to match projected screen positions of joystick + fire entities */
  updatePositions(
    app: pc.Application,
    camera: pc.Entity,
    joystickEntity: pc.Entity,
    fireEntity: pc.Entity,
  ): void {
    const cam = camera.camera!;
    const canvas = app.graphicsDevice.canvas;

    const joyWorld = joystickEntity.getPosition();
    const fireWorld = fireEntity.getPosition();

    const joyScreen = new pc.Vec3();
    const fireScreen = new pc.Vec3();
    cam.worldToScreen(joyWorld, joyScreen);
    cam.worldToScreen(fireWorld, fireScreen);

    const canvasRect = canvas.getBoundingClientRect();

    // worldToScreen returns coordinates in canvas CSS pixels from top-left
    const joyX = canvasRect.left + joyScreen.x;
    const joyY = canvasRect.top  + joyScreen.y;
    const fireX = canvasRect.left + fireScreen.x;
    const fireY = canvasRect.top  + fireScreen.y;

    const SIZE = 96; // 1 inch at 96dpi CSS pixels
    const half = SIZE / 2;

    this._positionZone(this.dpadZone, joyX - half, joyY - half, SIZE);
    this._positionZone(this.fireZone, fireX - half, fireY - half, SIZE);
  }

  releaseAll(): void {
    this.fireTouches.clear();
    this.dpadTouches.clear();
    this._applyJoy({ up: false, down: false, left: false, right: false, fire: false });
  }

  private _positionZone(el: HTMLElement, x: number, y: number, size: number): void {
    el.style.left   = `${x}px`;
    el.style.top    = `${y}px`;
    el.style.width  = `${size}px`;
    el.style.height = `${size}px`;
  }

  private _applyJoy(next: JoyDirs): void {
    const dirs = ['up', 'down', 'left', 'right', 'fire'] as const;
    const wasm = getWasm();

    if (this.joystickType === 'kempston') {
      const changed = dirs.some(d => next[d] !== this.joy[d]);
      if (changed && wasm?.setKempston) {
        wasm.setKempston(
          (next.right ? 0x01 : 0) | (next.left  ? 0x02 : 0) |
          (next.down  ? 0x04 : 0) | (next.up    ? 0x08 : 0) |
          (next.fire  ? 0x10 : 0),
        );
      }
    } else {
      const map = KEYMAPS[this.joystickType];
      if (map && wasm) {
        for (const d of dirs) {
          if (next[d] === this.joy[d]) continue;
          const k = map[d];
          if (!k || k.row === 0) continue;
          if (next[d]) wasm.keyDown(k.row, k.bit);
          else         wasm.keyUp(k.row, k.bit);
        }
      }
    }

    for (const d of ['up', 'down', 'left', 'right'] as const) {
      this.arms[d]?.classList.toggle('active', next[d]);
    }
    this.fireZone.classList.toggle('active', next.fire);

    this.joy = { ...next };
  }

  private _calcDirs(): { up: boolean; down: boolean; left: boolean; right: boolean } {
    if (this.dpadTouches.size === 0) {
      return { up: false, down: false, left: false, right: false };
    }
    const touch = this.dpadTouches.values().next().value!;
    const rect = this.dpadEl.getBoundingClientRect();
    const cx = rect.left + rect.width  * 0.5;
    const cy = rect.top  + rect.height * 0.5;
    const dx = touch.x - cx;
    const dy = touch.y - cy;
    const dist = Math.hypot(dx, dy);
    const deadzone = Math.min(rect.width, rect.height) * 0.08;

    if (dist < deadzone) return { up: false, down: false, left: false, right: false };

    const nx = dx / dist;
    const ny = dy / dist;
    return { up: ny < -0.3, down: ny > 0.3, left: nx < -0.3, right: nx > 0.3 };
  }

  private _updateJoy(): void {
    this._applyJoy({ ...this._calcDirs(), fire: this.fireTouches.size > 0 });
  }

  private _bindEvents(): void {
    this.dpadZone.addEventListener('touchstart', e => {
      e.preventDefault();
      e.stopPropagation();
      for (const t of Array.from(e.changedTouches)) {
        this.dpadTouches.set(t.identifier, { x: t.clientX, y: t.clientY });
      }
      this._updateJoy();
    }, { passive: false });

    this.dpadZone.addEventListener('touchmove', e => {
      e.preventDefault();
      e.stopPropagation();
      for (const t of Array.from(e.changedTouches)) {
        if (this.dpadTouches.has(t.identifier)) {
          this.dpadTouches.set(t.identifier, { x: t.clientX, y: t.clientY });
        }
      }
      this._updateJoy();
    }, { passive: false });

    const dpadEnd = (e: TouchEvent): void => {
      e.preventDefault();
      e.stopPropagation();
      for (const t of Array.from(e.changedTouches)) this.dpadTouches.delete(t.identifier);
      this._updateJoy();
    };
    this.dpadZone.addEventListener('touchend',    dpadEnd, { passive: false });
    this.dpadZone.addEventListener('touchcancel', dpadEnd, { passive: false });

    this.fireZone.addEventListener('touchstart', e => {
      e.preventDefault();
      e.stopPropagation();
      for (const t of Array.from(e.changedTouches)) this.fireTouches.add(t.identifier);
      this._updateJoy();
    }, { passive: false });

    const fireEnd = (e: TouchEvent): void => {
      e.preventDefault();
      e.stopPropagation();
      for (const t of Array.from(e.changedTouches)) this.fireTouches.delete(t.identifier);
      this._updateJoy();
    };
    this.fireZone.addEventListener('touchend',    fireEnd, { passive: false });
    this.fireZone.addEventListener('touchcancel', fireEnd, { passive: false });
    this.fireZone.addEventListener('touchmove', e => { e.preventDefault(); e.stopPropagation(); }, { passive: false });
  }

  private _el(tag: string, className: string): HTMLElement {
    const el = document.createElement(tag);
    el.className = className;
    return el as HTMLElement;
  }

  private _injectStyles(): void {
    if (document.getElementById('joy-overlay-styles')) return;
    const style = document.createElement('style');
    style.id = 'joy-overlay-styles';
    style.textContent = `
      .joy-dpad-zone, .joy-fire-zone {
        position: fixed;
        touch-action: none;
        z-index: 100;
        border-radius: 50%;
      }
      .joy-dpad-zone {
        background: rgba(255,255,255,0.04);
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .joy-fire-zone {
        background: rgba(255,80,80,0.06);
        border: 2px solid rgba(255,80,80,0.20);
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .joy-fire-zone.active {
        background: rgba(255,80,80,0.30);
        border-color: rgba(255,80,80,0.70);
      }
      .joy-dpad {
        width: 88%;
        height: 88%;
        position: relative;
        pointer-events: none;
      }
      .joy-dpad-arm {
        position: absolute;
        background: rgba(255,255,255,0.12);
        border: 1px solid rgba(255,255,255,0.20);
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 3px;
        font-size: 11px;
        color: rgba(255,255,255,0.5);
        transition: background 0.08s, border-color 0.08s;
      }
      .joy-dpad-arm.active {
        background: rgba(255,255,255,0.40);
        border-color: rgba(255,255,255,0.80);
        color: rgba(255,255,255,1);
      }
      .joy-dpad-up    { top: 0;    left: 33%; width: 34%; height: 34%; }
      .joy-dpad-down  { bottom: 0; left: 33%; width: 34%; height: 34%; }
      .joy-dpad-left  { top: 33%;  left: 0;   width: 34%; height: 34%; }
      .joy-dpad-right { top: 33%;  right: 0;  width: 34%; height: 34%; }
      .joy-dpad-center {
        position: absolute;
        top: 33%; left: 33%; width: 34%; height: 34%;
        background: rgba(255,255,255,0.08);
        border: 1px solid rgba(255,255,255,0.15);
      }
      .joy-fire-btn {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 3px;
        pointer-events: none;
      }
      .joy-fire-dot {
        width: 28px; height: 28px;
        border-radius: 50%;
        background: rgba(255,80,80,0.50);
        transition: background 0.08s;
      }
      .joy-fire-zone.active .joy-fire-dot {
        background: rgba(255,100,100,0.90);
      }
      .joy-fire-label {
        font-size: 11px;
        color: rgba(255,120,120,0.80);
        font-family: 'Courier New', monospace;
        font-weight: bold;
        letter-spacing: 1px;
      }
    `;
    document.head.appendChild(style);
  }
}
