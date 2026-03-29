import type { MenuItem } from './menu-def.js';

export class MenuPanel {
  private el: HTMLDivElement;
  private headerEl: HTMLDivElement;
  private listEl: HTMLDivElement;
  private items: MenuItem[] = [];
  private activeIndex = 0;
  private _visible = false;
  private _lastSettingValues: Record<string, string | boolean | null> = {};

  // Set by controller before show()
  onActivate: ((item: MenuItem) => void) | null = null;
  onClose: (() => void) | null = null;
  el_show_for_import = false;

  constructor() {
    this.el = document.createElement('div');
    this.el.style.cssText = [
      'position:fixed',
      'top:50%',
      'left:50%',
      'transform:translate(-50%,-50%)',
      'background:#000',
      'border:2px solid #00d4ff',
      'color:#fff',
      'font-family:"Courier New",monospace',
      'font-size:14px',
      'min-width:320px',
      'max-width:480px',
      'max-height:80vh',
      'overflow-y:auto',
      'z-index:9999',
      'display:none',
      'user-select:none',
      'box-sizing:border-box',
    ].join(';');

    this.headerEl = document.createElement('div');
    this.headerEl.style.cssText = [
      'padding:8px 12px',
      'border-bottom:1px solid #00d4ff',
      'color:#00d4ff',
      'font-weight:bold',
      'display:flex',
      'justify-content:space-between',
      'align-items:center',
    ].join(';');

    this.listEl = document.createElement('div');

    this.el.appendChild(this.headerEl);
    this.el.appendChild(this.listEl);
    document.body.appendChild(this.el);

    this._bindKeys();
  }

  show(
    items: MenuItem[],
    title: string,
    breadcrumb: string,
    settingValues?: Record<string, string | boolean | null>,
  ): void {
    this.items = items;
    this.activeIndex = this._firstSelectableIndex(items);
    this._visible = true;
    this._lastSettingValues = settingValues ?? {};
    this.el.style.display = 'block';
    this._render(title, breadcrumb, this._lastSettingValues);
  }

  hide(): void {
    this._visible = false;
    this.el.style.display = 'none';
  }

  // Show a text input prompt overlaid in the panel.
  // Resolves with the entered string or null if cancelled.
  prompt(label: string): Promise<string | null> {
    return new Promise((resolve) => {
      this.listEl.innerHTML = '';

      const wrapper = document.createElement('div');
      wrapper.style.cssText = 'padding:12px';

      const lbl = document.createElement('div');
      lbl.style.cssText = 'color:#ff0;margin-bottom:8px';
      lbl.textContent = label;

      const input = document.createElement('input');
      input.type = 'text';
      input.style.cssText = [
        'background:#111',
        'color:#fff',
        'border:1px solid #00d4ff',
        'font-family:"Courier New",monospace',
        'font-size:14px',
        'padding:4px 8px',
        'width:100%',
        'box-sizing:border-box',
        'outline:none',
      ].join(';');

      input.addEventListener('keydown', (e) => {
        e.stopPropagation();
        if (e.code === 'Enter') {
          e.preventDefault();
          const val = input.value.trim();
          resolve(val || null);
        }
        if (e.code === 'Escape') {
          e.preventDefault();
          resolve(null);
        }
      });

      wrapper.appendChild(lbl);
      wrapper.appendChild(input);
      this.listEl.appendChild(wrapper);

      setTimeout(() => input.focus(), 0);
    });
  }

  private _render(
    title: string,
    breadcrumb: string,
    settingValues: Record<string, string | boolean | null>,
  ): void {
    // Header
    const crumbDisplay = breadcrumb ? ` ${breadcrumb}` : '';
    this.headerEl.innerHTML = `<span>&#9658; ${title}${crumbDisplay}</span><span style="cursor:pointer;color:#888" title="Close">X</span>`;
    const closeBtn = this.headerEl.querySelector('span:last-child') as HTMLElement;
    closeBtn.addEventListener('click', () => this.onClose?.());

    // Items
    this.listEl.innerHTML = '';
    this.items.forEach((item, idx) => {
      const row = document.createElement('div');

      if (item.type === 'separator') {
        row.style.cssText = 'border-top:1px solid #333;margin:4px 0';
        this.listEl.appendChild(row);
        return;
      }

      const isActive = idx === this.activeIndex;
      row.style.cssText = [
        'padding:6px 12px',
        'cursor:pointer',
        isActive ? 'color:#ff0;border-left:3px solid #00d4ff' : 'color:#fff;border-left:3px solid transparent',
        'display:flex',
        'justify-content:space-between',
        'align-items:center',
      ].join(';');

      let label = '';
      let suffix = '';

      if (item.type === 'action') {
        label = (isActive ? '► ' : '  ') + item.label;
      } else if (item.type === 'submenu') {
        label = (isActive ? '► ' : '  ') + item.label;
        suffix = '›';
      } else if (item.type === 'toggle') {
        const val = settingValues[item.settingKey];
        const on = val === true || val === 'true';
        label = (isActive ? '► ' : '  ') + item.label;
        suffix = on ? '● ON' : '○ OFF';
      } else if (item.type === 'choice') {
        const val = settingValues[item.settingKey];
        label = (isActive ? '► ' : '  ') + item.label;
        suffix = val != null ? String(val).toUpperCase() : '›';
      }

      const labelEl = document.createElement('span');
      labelEl.textContent = label;
      const suffixEl = document.createElement('span');
      suffixEl.style.cssText = 'color:#00d4ff;font-size:12px';
      suffixEl.textContent = suffix;

      row.appendChild(labelEl);
      row.appendChild(suffixEl);

      row.addEventListener('click', () => {
        this.activeIndex = idx;
        this._activateCurrent();
      });
      row.addEventListener('mouseover', () => {
        this.activeIndex = idx;
        this._rerenderRows(settingValues);
      });

      this.listEl.appendChild(row);
    });
  }

  private _rerenderRows(settingValues: Record<string, string | boolean | null>): void {
    const rows = Array.from(this.listEl.children) as HTMLElement[];
    let rowIdx = 0;
    this.items.forEach((item, idx) => {
      if (item.type === 'separator') { rowIdx++; return; }
      const row = rows[rowIdx++];
      if (!row) return;
      const isActive = idx === this.activeIndex;
      row.style.color = isActive ? '#ff0' : '#fff';
      row.style.borderLeft = isActive ? '3px solid #00d4ff' : '3px solid transparent';
      const labelEl = row.querySelector('span:first-child') as HTMLElement;
      if (!labelEl) return;
      let label = '';
      if (item.type === 'action') label = (isActive ? '► ' : '  ') + item.label;
      else if (item.type === 'submenu') label = (isActive ? '► ' : '  ') + item.label;
      else if (item.type === 'toggle') label = (isActive ? '► ' : '  ') + item.label;
      else if (item.type === 'choice') label = (isActive ? '► ' : '  ') + item.label;
      labelEl.textContent = label;
    });
  }

  private _bindKeys(): void {
    window.addEventListener('keydown', (e) => {
      if (!this._visible) return;
      // Don't intercept if focus is on a text input inside the panel
      if ((e.target as HTMLElement).tagName === 'INPUT') return;

      if (e.code === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        this._navigate(-1);
      } else if (e.code === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        this._navigate(1);
      } else if (e.code === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        this._activateCurrent();
      } else if (e.code === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        this.onClose?.();
      }
    }, true); // capture phase so input-bridge sees it only after panel handles it
  }

  private _navigate(dir: number): void {
    const len = this.items.length;
    if (len === 0) return;
    let next = (this.activeIndex + dir + len) % len;
    // Skip separators
    let guard = 0;
    while (this.items[next].type === 'separator' && guard < len) {
      next = (next + dir + len) % len;
      guard++;
    }
    this.activeIndex = next;
    this._rerenderRows(this._lastSettingValues);
  }

  private _activateCurrent(): void {
    const item = this.items[this.activeIndex];
    if (item && item.type !== 'separator') {
      this.onActivate?.(item);
    }
  }

  private _firstSelectableIndex(items: MenuItem[]): number {
    for (let i = 0; i < items.length; i++) {
      if (items[i].type !== 'separator') return i;
    }
    return 0;
  }
}
