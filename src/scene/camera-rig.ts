// Camera depth-of-field state management for menu blur effect
// Actual visual effect will be refined in Phase 5 with the full codex

import * as pc from 'playcanvas';

let dofEnabled = false;

export function enableDepthOfField(_app: pc.Application): void {
  dofEnabled = true;
  // Visual blur effect implemented in Phase 5 with post-processing or material tweaks
}

export function disableDepthOfField(_app: pc.Application): void {
  dofEnabled = false;
}

export function isDepthOfFieldEnabled(): boolean {
  return dofEnabled;
}
