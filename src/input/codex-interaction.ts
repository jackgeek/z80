// Codex spin/drag interaction — inertia, friction, snap to nearest item

import { CODEX_MENU_ITEMS, type MenuCodexResult } from '../entities/menu-codex.js';

const FRICTION = 0.92;
const SNAP_THRESHOLD = 0.5;
const SENSITIVITY = 0.4;
const ANGLE_PER_ITEM = 360 / CODEX_MENU_ITEMS.length;

export class CodexInteraction {
  private codex: MenuCodexResult;
  private dragging = false;
  private lastY = 0;
  private velocity = 0;
  private angle = 0;

  constructor(codex: MenuCodexResult) {
    this.codex = codex;
  }

  onDragStart(y: number): void {
    this.dragging = true;
    this.lastY = y;
    this.velocity = 0;
  }

  onDragMove(y: number): void {
    if (!this.dragging) return;
    const dy = y - this.lastY;
    this.velocity = dy * SENSITIVITY;
    this.angle += this.velocity;
    this.codex.setAngle(this.angle);
    this.lastY = y;
  }

  onDragEnd(): void {
    this.dragging = false;
    // Inertia takes over in update()
  }

  stepUp(): void {
    const targetIdx = this.codex.getSelectedIndex() - 1;
    const idx = ((targetIdx % CODEX_MENU_ITEMS.length) + CODEX_MENU_ITEMS.length) % CODEX_MENU_ITEMS.length;
    this.snapToIndex(idx);
  }

  stepDown(): void {
    const targetIdx = this.codex.getSelectedIndex() + 1;
    const idx = targetIdx % CODEX_MENU_ITEMS.length;
    this.snapToIndex(idx);
  }

  activate(): string {
    const idx = this.codex.getSelectedIndex();
    return CODEX_MENU_ITEMS[idx].action;
  }

  getSelectedLabel(): string {
    return CODEX_MENU_ITEMS[this.codex.getSelectedIndex()].label;
  }

  update(_dt: number): void {
    if (this.dragging) return;

    // Apply friction
    this.velocity *= FRICTION;
    this.angle += this.velocity;
    this.codex.setAngle(this.angle);

    // Snap when velocity is low enough
    if (Math.abs(this.velocity) < SNAP_THRESHOLD) {
      this.velocity = 0;
      this.snapToNearest();
    }
  }

  private snapToNearest(): void {
    const nearest = Math.round(this.angle / ANGLE_PER_ITEM) * ANGLE_PER_ITEM;
    // Smooth snap
    this.angle += (nearest - this.angle) * 0.2;
    if (Math.abs(nearest - this.angle) < 0.1) {
      this.angle = nearest;
    }
    this.codex.setAngle(this.angle);
  }

  private snapToIndex(idx: number): void {
    this.angle = idx * ANGLE_PER_ITEM;
    this.velocity = 0;
    this.codex.setAngle(this.angle);
  }
}
