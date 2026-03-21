// Entity-targeted swipe detection for scene transitions

import * as pc from 'playcanvas';

export interface SwipeEvent {
  direction: 'up' | 'down';
  entity: pc.Entity;
}

const SWIPE_THRESHOLD = 50;  // pixels
const MAX_SWIPE_TIME = 500;  // ms

export class GestureDetector {
  private startX = 0;
  private startY = 0;
  private startTime = 0;
  private startEntity: pc.Entity | null = null;
  private tracking = false;

  beginTracking(screenX: number, screenY: number, entity: pc.Entity | null): void {
    if (!entity || !entity.tags.has('swipeable')) {
      this.tracking = false;
      return;
    }
    this.startX = screenX;
    this.startY = screenY;
    this.startTime = performance.now();
    this.startEntity = entity;
    this.tracking = true;
  }

  endTracking(screenX: number, screenY: number): SwipeEvent | null {
    if (!this.tracking || !this.startEntity) {
      this.tracking = false;
      return null;
    }

    const elapsed = performance.now() - this.startTime;
    const dy = screenY - this.startY;
    const dx = screenX - this.startX;

    this.tracking = false;

    // Must be primarily vertical, exceed threshold, and within time limit
    if (Math.abs(dy) > SWIPE_THRESHOLD && Math.abs(dy) > Math.abs(dx) && elapsed < MAX_SWIPE_TIME) {
      return {
        direction: dy < 0 ? 'up' : 'down',
        entity: this.startEntity,
      };
    }

    return null;
  }

  cancelTracking(): void {
    this.tracking = false;
    this.startEntity = null;
  }
}
