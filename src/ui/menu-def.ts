import type { TapeItem, SaveItem } from '../data/db.js';

export type MenuItem =
  | { type: 'action';  label: string; id: string }
  | { type: 'submenu'; label: string; items: MenuItem[] }
  | { type: 'toggle';  label: string; settingKey: string }
  | { type: 'choice';  label: string; settingKey: string; options: string[] }
  | { type: 'separator' }

// Builds the root menu list, injecting conditional + dynamic items.
export function buildRootMenu(
  tapes: TapeItem[],
  currentTapeId: string | null,
  savesForCurrentTape: SaveItem[],
): MenuItem[] {
  const items: MenuItem[] = [];

  items.push({ type: 'action', label: 'IMPORT TAPE/TZX/Z80/ZIP', id: 'IMPORT_FILE' });
  items.push({ type: 'action', label: 'IMPORT URL', id: 'IMPORT_URL' });

  // Export submenu
  const exportItems: MenuItem[] = [];
  if (currentTapeId) {
    exportItems.push({ type: 'action', label: 'CURRENT TAPE', id: 'EXPORT_CURRENT_TAPE' });
    if (savesForCurrentTape.length > 0) {
      exportItems.push({
        type: 'submenu',
        label: 'A SAVE\u2026',
        items: savesForCurrentTape.map(s => ({
          type: 'action' as const,
          label: s.saveName.toUpperCase(),
          id: `EXPORT_SAVE:${s.id}`,
        })),
      });
    }
  }
  if (exportItems.length > 0) {
    items.push({ type: 'submenu', label: 'EXPORT', items: exportItems });
  }

  items.push({ type: 'action', label: 'BASIC', id: 'BASIC' });

  items.push({
    type: 'submenu',
    label: 'SETTINGS',
    items: [
      {
        type: 'submenu',
        label: 'JOYSTICK',
        items: [
          { type: 'toggle', label: 'OVERLAY', settingKey: 'joystickOverlay' },
          { type: 'choice', label: 'EMULATION', settingKey: 'joystickType', options: ['kempston', 'sinclair1', 'cursor'] },
        ],
      },
      { type: 'choice', label: 'CLOCK SPEED', settingKey: 'clockSpeed', options: ['slow', 'normal', 'fast', 'fastest'] },
    ],
  });

  if (currentTapeId) {
    items.push({ type: 'action', label: 'SAVE', id: 'SAVE' });
    if (savesForCurrentTape.length > 0) {
      items.push({
        type: 'submenu',
        label: 'LOAD',
        items: savesForCurrentTape.map(s => ({
          type: 'action' as const,
          label: s.saveName.toUpperCase(),
          id: `LOAD_SAVE:${s.id}`,
        })),
      });
    }
  } else {
    items.push({ type: 'action', label: 'CREATE TAPE', id: 'CREATE_TAPE' });
  }

  if (tapes.length > 0) {
    items.push({
      type: 'submenu',
      label: 'DELETE TAPE',
      items: tapes.map(t => ({
        type: 'action' as const,
        label: t.name.toUpperCase(),
        id: `DELETE_TAPE:${t.id}`,
      })),
    });
  }

  items.push({ type: 'separator' });

  // Dynamic tape list
  for (const tape of tapes) {
    items.push({
      type: 'action',
      label: tape.name.toUpperCase(),
      id: `LOAD_TAPE:${tape.id}`,
    });
  }

  return items;
}
