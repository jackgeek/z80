import * as db from '../data/db.js';
import type { SaveItem } from '../data/db.js';
import type { MenuItem } from './menu-def.js';
import { buildRootMenu } from './menu-def.js';
import { MenuPanel } from './menu-panel.js';
import { captureZ80, loadZ80 } from '../media/snapshot.js';
import { loadTapeFile } from '../media/tape.js';
import { resetEmulator } from '../emulator/wasm-loader.js';
import {
  isRomLoaded,
  getCurrentTapeId, setCurrentTapeId,
  getCurrentTapeData, setCurrentTapeData,
} from '../emulator/state.js';
import { registerTapeDoneCallback } from '../emulator/frame-loop.js';
import { typeLoadAndRun } from '../input/keyboard-macro.js';
import { showStatus } from './status-bridge.js';
import { setMenuOpen } from '../input/input-bridge.js';

export class MenuController {
  private panel: MenuPanel;
  private stack: MenuItem[][] = [];
  private stackTitles: string[] = [];
  private settingCache: Record<string, string | boolean | null> = {};

  constructor() {
    this.panel = new MenuPanel();
    this.panel.onActivate = (item) => { void this.activate(item); };
    this.panel.onClose = () => this.close();
  }

  async open(): Promise<void> {
    try {
      const [tapes, joystickOverlay, joystickType, clockSpeed] = await Promise.all([
        db.getTapes(),
        db.getSetting('joystickOverlay'),
        db.getSetting('joystickType'),
        db.getSetting('clockSpeed'),
      ]);

      this.settingCache = {
        joystickOverlay: joystickOverlay ?? false,
        joystickType: joystickType ?? 'sinclair1',
        clockSpeed: clockSpeed ?? 'normal',
      };

      const currentTapeId = getCurrentTapeId();
      let savesForCurrentTape: SaveItem[] = [];
      if (currentTapeId) {
        savesForCurrentTape = await db.getSavesForTape(currentTapeId);
      }

      const rootItems = buildRootMenu(tapes, currentTapeId, savesForCurrentTape);
      this.stack = [rootItems];
      this.stackTitles = ['ZX SPECTRUM'];
      setMenuOpen(true);
      this._showCurrent();
    } catch (e) {
      showStatus('Menu unavailable: ' + (e as Error).message);
    }
  }

  close(): void {
    this.stack = [];
    this.stackTitles = [];
    this.panel.hide();
    setMenuOpen(false);
  }

  push(items: MenuItem[], title: string): void {
    const withBack: MenuItem[] = [
      { type: 'action', label: '◄ BACK', id: 'BACK' },
      ...items,
    ];
    this.stack.push(withBack);
    this.stackTitles.push(title);
    this._showCurrent();
  }

  pop(): void {
    if (this.stack.length > 1) {
      this.stack.pop();
      this.stackTitles.pop();
      this._showCurrent();
    } else {
      this.close();
    }
  }

  async activate(item: MenuItem): Promise<void> {
    try {
      switch (item.type) {
        case 'action':
          await this._handleAction(item.id);
          break;
        case 'submenu':
          this.push(item.items, item.label);
          break;
        case 'toggle': {
          const current = this.settingCache[item.settingKey];
          const next = !(current === true || current === 'true');
          await db.setSetting(item.settingKey, next);
          this.settingCache[item.settingKey] = next;
          this._showCurrent();
          break;
        }
        case 'choice': {
          const choiceItems: MenuItem[] = item.options.map(opt => ({
            type: 'action' as const,
            label: opt.toUpperCase(),
            id: `CHOICE:${item.settingKey}:${opt}`,
          }));
          this.push(choiceItems, item.label);
          break;
        }
      }
    } catch (e) {
      showStatus('Error: ' + (e as Error).message);
    }
  }

  private async _handleAction(id: string): Promise<void> {
    if (id === 'BACK') {
      this.pop();
      return;
    }

    if (id.startsWith('CHOICE:')) {
      const parts = id.split(':');
      const key = parts[1];
      const value = parts.slice(2).join(':');
      await db.setSetting(key, value);
      this.settingCache[key] = value;
      this.pop();
      return;
    }

    if (id.startsWith('LOAD_TAPE:')) {
      const success = await this._loadTape(id.slice('LOAD_TAPE:'.length));
      if (success) this.close();
      return;
    }

    if (id.startsWith('LOAD_SAVE:')) {
      const save = await db.getSave(id.slice('LOAD_SAVE:'.length));
      if (save) loadZ80(save.data);
      this.close();
      return;
    }

    if (id.startsWith('EXPORT_SAVE:')) {
      const save = await db.getSave(id.slice('EXPORT_SAVE:'.length));
      if (save) this._triggerDownload(save.data, `${save.saveName}.z80`);
      this.close();
      return;
    }

    switch (id) {
      case 'IMPORT_FILE':
        this.close();
        this._triggerFileImport();
        break;

      case 'IMPORT_URL':
        await this._importUrl();
        break;

      case 'EXPORT_CURRENT_TAPE': {
        const data = getCurrentTapeData();
        const tapeId = getCurrentTapeId();
        if (data && tapeId) {
          const tapes = await db.getTapes();
          const tape = tapes.find(t => t.id === tapeId);
          const ext = tape?.format ?? 'tap';
          this._triggerDownload(data, `${tape?.name ?? 'tape'}.${ext}`);
        } else {
          showStatus('No tape data to export.');
        }
        this.close();
        break;
      }

      case 'BASIC':
        resetEmulator();
        setCurrentTapeId(null);
        setCurrentTapeData(null);
        this.close();
        break;

      case 'SAVE':
        await this._promptSave();
        break;

      case 'CREATE_TAPE':
        await this._promptCreateTape();
        break;
    }
  }

  private async _loadTape(tapeId: string): Promise<boolean> {
    const tapes = await db.getTapes();
    const tape = tapes.find(t => t.id === tapeId);
    if (!tape) { showStatus('Tape not found.'); return false; }

    const saves = await db.getSavesForTape(tapeId);
    const quickStart = saves.find(s => s.saveName === 'Quick Start');

    if (quickStart) {
      loadZ80(quickStart.data);
      showStatus(`Loaded: ${tape.name}`);
      return true;
    }

    // No Quick Start — load tape and auto-save when done
    if (!tape.data) {
      showStatus('No tape data (Create Tape item).');
      return false;
    }

    resetEmulator();
    await loadTapeFile(tape.data, `tape.${tape.format ?? 'tap'}`);
    setCurrentTapeId(tapeId);
    setCurrentTapeData(tape.data);

    registerTapeDoneCallback(() => {
      void this._autoSaveQuickStart(tapeId);
    });

    typeLoadAndRun(3000); // wait for 48K ROM boot (~2.5 s) before typing
    showStatus(`Loading: ${tape.name}…`);
    return true;
  }

  private async _autoSaveQuickStart(tapeId: string): Promise<void> {
    try {
      const saves = await db.getSavesForTape(tapeId);
      if (saves.some(s => s.saveName === 'Quick Start')) return;
      if (!isRomLoaded()) return;
      const data = captureZ80();
      if (data.byteLength === 0) return;
      await db.createSave(tapeId, 'Quick Start', data);
      showStatus('Quick Start saved.');
    } catch (e) {
      showStatus('Auto-save failed: ' + (e as Error).message);
    }
  }

  private async _promptSave(): Promise<void> {
    const name = await this.panel.prompt('Save name:');
    if (!name) return;
    const tapeId = getCurrentTapeId();
    if (!tapeId) { showStatus('No tape loaded.'); return; }
    if (!isRomLoaded()) return;
    const data = captureZ80();
    if (data.byteLength === 0) return;
    await db.createSave(tapeId, name, data);
    showStatus(`Saved: ${name}`);
    this.close();
  }

  private async _promptCreateTape(): Promise<void> {
    const name = await this.panel.prompt('Tape name:');
    if (!name) return;
    if (!isRomLoaded()) return;
    const data = captureZ80();
    if (data.byteLength === 0) return;
    const tapeId = await db.saveTape(name, null, null);
    await db.createSave(tapeId, 'Quick Start', data);
    setCurrentTapeId(tapeId);
    setCurrentTapeData(null);
    showStatus(`Created tape: ${name}`);
    this.close();
  }

  private async _importUrl(): Promise<void> {
    const url = await this.panel.prompt('URL:');
    if (!url) return;

    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.arrayBuffer();

      const lower = url.toLowerCase();
      const format: 'tap' | 'tzx' = lower.endsWith('.tzx') ? 'tzx' : 'tap';

      const name = await this.panel.prompt('Tape name:');
      if (!name) return;

      const tapeId = await db.saveTape(name, data, format);
      await loadTapeFile(data, `tape.${format}`);
      setCurrentTapeId(tapeId);
      setCurrentTapeData(data);
      showStatus(`Imported: ${name}`);
      this.close();
    } catch (e) {
      showStatus('Import error: ' + (e as Error).message);
    }
  }

  private _triggerFileImport(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.tap,.tzx,.z80,.zip,.rom';
    input.style.display = 'none';
    document.body.appendChild(input);

    input.addEventListener('change', () => {
      void (async () => {
        try {
          const file = input.files?.[0];
          document.body.removeChild(input);
          if (!file) return;

          const data = await file.arrayBuffer();
          const lower = file.name.toLowerCase();

          if (lower.endsWith('.z80')) {
            loadZ80(data);
            return;
          }

          const format: 'tap' | 'tzx' = lower.endsWith('.tzx') ? 'tzx' : 'tap';
          const defaultName = file.name.replace(/\.[^.]+$/, '');
          const name = window.prompt('Tape name:', defaultName) ?? defaultName;

          const tapeId = await db.saveTape(name, data, format);
          await loadTapeFile(data, file.name);
          setCurrentTapeId(tapeId);
          setCurrentTapeData(data);
          showStatus(`Imported: ${name}`);
        } catch (e) {
          showStatus('Import error: ' + (e as Error).message);
        }
      })();
    });

    input.click();
  }

  private _triggerDownload(data: ArrayBuffer, filename: string): void {
    const blob = new Blob([data], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  private _showCurrent(): void {
    const items = this.stack[this.stack.length - 1];
    const title = this.stackTitles[0] ?? 'ZX SPECTRUM';
    const breadcrumb = this.stackTitles.slice(1).join(' › ');
    this.panel.show(items, title, breadcrumb, this.settingCache);
  }
}
