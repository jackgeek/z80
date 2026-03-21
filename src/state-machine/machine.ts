// XState v5 scene state machine — manages scene transitions and orientation

import { setup, assign, createActor, type AnyActorRef } from 'xstate';
import { transitionToScene } from '../scene/scene-transitions.js';
import type { SceneEntities } from '../scene/scene-graph.js';

export interface SceneContext {
  lastPortraitScene: 'portrait1' | 'portrait2';
  orientation: 'portrait' | 'landscape';
  previousScene: string;
}

export type SceneEvent =
  | { type: 'SWIPE'; direction: 'up' | 'down' }
  | { type: 'ORIENTATION_CHANGE'; orientation: 'portrait' | 'landscape' }
  | { type: 'MENU_OPEN' }
  | { type: 'MENU_CLOSE' }
  | { type: 'CODEX_ACTIVATE'; index: number };

export function createSceneMachineActor(entities: SceneEntities) {
  const sceneMachine = setup({
    types: {
      context: {} as SceneContext,
      events: {} as SceneEvent,
    },
    guards: {
      lastWasPortrait1: ({ context }) => context.lastPortraitScene === 'portrait1',
      lastWasPortrait2: ({ context }) => context.lastPortraitScene === 'portrait2',
      isLandscape: ({ event }) =>
        event.type === 'ORIENTATION_CHANGE' && event.orientation === 'landscape',
      isPortrait: ({ event }) =>
        event.type === 'ORIENTATION_CHANGE' && event.orientation === 'portrait',
    },
    actions: {
      goPortrait1: () => transitionToScene('portrait1', entities),
      goPortrait2: () => transitionToScene('portrait2', entities),
      goLandscape: () => transitionToScene('landscape', entities),
      goMenuPortrait: () => transitionToScene('menuPortrait', entities),
      goMenuLandscape: () => transitionToScene('menuLandscape', entities),
      trackPortrait1: assign({ lastPortraitScene: 'portrait1' as const }),
      trackPortrait2: assign({ lastPortraitScene: 'portrait2' as const }),
      trackOrientation: assign({
        orientation: ({ event }) =>
          event.type === 'ORIENTATION_CHANGE' ? event.orientation : 'portrait',
      }),
    },
  }).createMachine({
    id: 'sceneMachine',
    initial: 'portrait1',
    context: {
      lastPortraitScene: 'portrait1',
      orientation: 'portrait',
      previousScene: 'portrait1',
    },
    states: {
      portrait1: {
        entry: ['goPortrait1', 'trackPortrait1'],
        on: {
          SWIPE: { target: 'portrait2' },
          ORIENTATION_CHANGE: {
            target: 'landscape',
            guard: 'isLandscape',
            actions: ['trackOrientation'],
          },
          MENU_OPEN: {
            target: 'menuPortrait',
            actions: [assign({ previousScene: 'portrait1' })],
          },
        },
      },
      portrait2: {
        entry: ['goPortrait2', 'trackPortrait2'],
        on: {
          SWIPE: { target: 'portrait1' },
          ORIENTATION_CHANGE: {
            target: 'landscape',
            guard: 'isLandscape',
            actions: ['trackOrientation'],
          },
          MENU_OPEN: {
            target: 'menuPortrait',
            actions: [assign({ previousScene: 'portrait2' })],
          },
        },
      },
      landscape: {
        entry: ['goLandscape'],
        on: {
          ORIENTATION_CHANGE: [
            {
              target: 'portrait1',
              guard: ({ context, event }) =>
                event.type === 'ORIENTATION_CHANGE' &&
                event.orientation === 'portrait' &&
                context.lastPortraitScene === 'portrait1',
              actions: ['trackOrientation'],
            },
            {
              target: 'portrait2',
              guard: ({ context, event }) =>
                event.type === 'ORIENTATION_CHANGE' &&
                event.orientation === 'portrait' &&
                context.lastPortraitScene === 'portrait2',
              actions: ['trackOrientation'],
            },
          ],
          MENU_OPEN: {
            target: 'menuLandscape',
            actions: [assign({ previousScene: 'landscape' })],
          },
        },
      },
      menuPortrait: {
        entry: ['goMenuPortrait'],
        on: {
          MENU_CLOSE: [
            { target: 'portrait1', guard: 'lastWasPortrait1' },
            { target: 'portrait2', guard: 'lastWasPortrait2' },
          ],
          ORIENTATION_CHANGE: {
            target: 'menuLandscape',
            guard: 'isLandscape',
            actions: ['trackOrientation'],
          },
        },
      },
      menuLandscape: {
        entry: ['goMenuLandscape'],
        on: {
          MENU_CLOSE: { target: 'landscape' },
          ORIENTATION_CHANGE: {
            target: 'menuPortrait',
            guard: 'isPortrait',
            actions: ['trackOrientation'],
          },
        },
      },
    },
  });

  const actor = createActor(sceneMachine);
  return actor;
}
