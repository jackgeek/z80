// 2D screen-space drag gesture for scene transitions
// Provides continuous progress (0→1) during drag, and commit/cancel on release

export interface DragState {
  progress: number;     // 0 = at start scene, 1 = fully at target scene
  direction: 'up' | 'down';
}

const COMMIT_THRESHOLD = 0.25; // drag 25% of screen height to commit

export class GestureDetector {
  private startY = 0;
  private screenHeight = 0;
  private tracking = false;
  private _direction: 'up' | 'down' = 'up';

  beginTracking(screenY: number, viewportHeight: number): void {
    this.startY = screenY;
    this.screenHeight = viewportHeight;
    this.tracking = true;
  }

  isTracking(): boolean {
    return this.tracking;
  }

  /** Returns drag progress during move. Null if not tracking. */
  updateTracking(screenY: number): DragState | null {
    if (!this.tracking) return null;

    const dy = screenY - this.startY;
    const absDy = Math.abs(dy);

    // Need a minimum movement to determine direction
    if (absDy < 5) return null;

    this._direction = dy < 0 ? 'up' : 'down';
    const progress = Math.min(1, absDy / (this.screenHeight * 0.4));

    return { progress, direction: this._direction };
  }

  /** Returns true if the gesture should commit to the transition, false to cancel. */
  endTracking(screenY: number): { commit: boolean; direction: 'up' | 'down' } | null {
    if (!this.tracking) return null;
    this.tracking = false;

    const dy = screenY - this.startY;
    const absDy = Math.abs(dy);
    const direction: 'up' | 'down' = dy < 0 ? 'up' : 'down';
    const progress = absDy / (this.screenHeight * 0.4);

    return { commit: progress >= COMMIT_THRESHOLD, direction };
  }

  cancelTracking(): void {
    this.tracking = false;
  }
}
