// ZX Spectrum 48K virtual keyboard — faithful recreation of the original

import { getWasm } from '../emulator/state.js';
import { initAudio } from '../audio/audio.js';

export function specKeyDown(row, bit) {
  initAudio();
  const wasm = getWasm();
  if (wasm) wasm.keyDown(row, bit);
}

export function specKeyUp(row, bit) {
  const wasm = getWasm();
  if (wasm) wasm.keyUp(row, bit);
}

// ── Key data ────────────────────────────────────────────────────────────────
// label  = main white letter on key
// sym    = red symbol (top-right of key, Symbol Shift)
// sub    = green BASIC keyword (top-left of key, Caps Shift)
// ext    = blue extended-mode function (above key on bezel)
// color  = spectrum colour label above key (row 1 only), shown in that colour
// wide   = flex-grow multiplier
// sticky = latching modifier key

const ROWS = [
  [
    { label:'1', sym:'!',  sub:'EDIT',      ext:'DEF FN', color:'BLUE',    colorHex:'#1818f0', row:3, bit:0x01 },
    { label:'2', sym:'@',  sub:'CAPS LOCK', ext:'FN',     color:'RED',     colorHex:'#d80000', row:3, bit:0x02 },
    { label:'3', sym:'#',  sub:'TRUE\nVIDEO',ext:'LINE',  color:'MAGENTA', colorHex:'#d800d8', row:3, bit:0x04 },
    { label:'4', sym:'$',  sub:'INV\nVIDEO',ext:'OPEN #', color:'GREEN',   colorHex:'#00d800', row:3, bit:0x08 },
    { label:'5', sym:'%',  sub:'←',        ext:'CLOSE #',color:'CYAN',    colorHex:'#00d8d8', row:3, bit:0x10 },
    { label:'6', sym:'&',  sub:'↓',        ext:'MOVE',   color:'YELLOW',  colorHex:'#d8d800', row:4, bit:0x10 },
    { label:'7', sym:"'",  sub:'↑',        ext:'ERASE',  color:'WHITE',   colorHex:'#d8d8d8', row:4, bit:0x08 },
    { label:'8', sym:'(',  sub:'→',        ext:'POINT',  color:'',        colorHex:'',         row:4, bit:0x04 },
    { label:'9', sym:')',  sub:'GRAPHICS', ext:'TAG',    color:'',        colorHex:'',         row:4, bit:0x02 },
    { label:'0', sym:'_',  sub:'DELETE',   ext:'FORMAT', color:'BLACK',   colorHex:'#686868', row:4, bit:0x01 },
  ],
  [
    { label:'Q', sym:'<=', sub:'PLOT',   ext:'SIN',    row:2, bit:0x01 },
    { label:'W', sym:'<>', sub:'DRAW',   ext:'COS',    row:2, bit:0x02 },
    { label:'E', sym:'>=', sub:'REM',    ext:'TAN',    row:2, bit:0x04 },
    { label:'R', sym:'<',  sub:'RUN',    ext:'INT',    row:2, bit:0x08 },
    { label:'T', sym:'>',  sub:'RAND',   ext:'RND',    row:2, bit:0x10 },
    { label:'Y', sym:'[',  sub:'RETURN', ext:'STR$',   row:5, bit:0x10 },
    { label:'U', sym:']',  sub:'IF',     ext:'CHR$',   row:5, bit:0x08 },
    { label:'I', sym:'↑',  sub:'INPUT',  ext:'CODE',   row:5, bit:0x04 },
    { label:'O', sym:';',  sub:'POKE',   ext:'PEEK',   row:5, bit:0x02 },
    { label:'P', sym:'"',  sub:'PRINT',  ext:'TAB',    row:5, bit:0x01 },
  ],
  [
    { label:'A', sym:'~',  sub:'NEW',    ext:'READ',   row:1, bit:0x01 },
    { label:'S', sym:'|',  sub:'SAVE',   ext:'RESTORE',row:1, bit:0x02 },
    { label:'D', sym:'\\', sub:'DIM',    ext:'DATA',   row:1, bit:0x04 },
    { label:'F', sym:'{',  sub:'FOR',    ext:'SGN',    row:1, bit:0x08 },
    { label:'G', sym:'}',  sub:'GOTO',   ext:'ABS',    row:1, bit:0x10 },
    { label:'H', sym:'^',  sub:'GOSUB',  ext:'SQR',    row:6, bit:0x10 },
    { label:'J', sym:'-',  sub:'LOAD',   ext:'VAL',    row:6, bit:0x08 },
    { label:'K', sym:'+',  sub:'LIST',   ext:'LEN',    row:6, bit:0x04 },
    { label:'L', sym:'=',  sub:'LET',    ext:'USR',    row:6, bit:0x02 },
    { label:'ENTER', row:6, bit:0x01, wide:1.8 },
  ],
  [
    { label:'CAPS\nSHIFT', row:0, bit:0x01, wide:1.8, sticky:true, id:'key-caps' },
    { label:'Z', sym:':',  sub:'COPY',   ext:'LN',     row:0, bit:0x02 },
    { label:'X', sym:'/',  sub:'CLEAR',  ext:'EXP',    row:0, bit:0x04 },
    { label:'C', sym:'?',  sub:'CONT',   ext:'LPRINT', row:0, bit:0x08 },
    { label:'V', sym:'/',  sub:'CLS',    ext:'LLIST',  row:0, bit:0x10 },
    { label:'B', sym:'*',  sub:'BORDER', ext:'BIN',    row:7, bit:0x10 },
    { label:'N', sym:',',  sub:'NEXT',   ext:"INKEY$", row:7, bit:0x08 },
    { label:'M', sym:'.',  sub:'PAUSE',  ext:'PI',     row:7, bit:0x04 },
    { label:'SYM\nSHIFT', row:7, bit:0x02, wide:1.8, sticky:true, id:'key-sym' },
    { label:'BREAK\nSPACE', row:7, bit:0x01, wide:2.2 },
  ],
];

export function initVirtualKeyboard() {
  let capsLatch = false, symLatch = false;

  // ── Build DOM ───────────────────────────────────────────────────────────────
  const kb = document.createElement('div');
  kb.id = 'vkeyboard';

  // Header bar: "ZX Spectrum" branding
  const header = document.createElement('div');
  header.id = 'vkb-header';
  header.innerHTML = '<span class="vkb-brand">ZX Spectrum</span>';
  kb.appendChild(header);

  // Key rows
  ROWS.forEach((rowKeys, rowIdx) => {
    const rowDiv = document.createElement('div');
    rowDiv.className = 'vkb-row';

    rowKeys.forEach(key => {
      // Wrapper: holds above-bezel labels + the key itself
      const wrap = document.createElement('div');
      wrap.className = 'vkb-wrap';
      if (key.wide) wrap.style.flexGrow = key.wide;

      // Above-key bezel area
      const above = document.createElement('div');
      above.className = 'vkb-above';

      if (key.color) {
        const colorEl = document.createElement('div');
        colorEl.className = 'vkb-color-name';
        colorEl.textContent = key.color;
        colorEl.style.color = key.colorHex;
        above.appendChild(colorEl);
      }
      if (key.ext) {
        const extEl = document.createElement('div');
        extEl.className = 'vkb-ext';
        extEl.textContent = key.ext;
        above.appendChild(extEl);
      }
      wrap.appendChild(above);

      // The key itself
      const el = document.createElement('div');
      el.className = 'vkb-key';
      if (key.id) el.id = key.id;

      // Green BASIC keyword — top-left
      if (key.sub) {
        const subEl = document.createElement('div');
        subEl.className = 'vkb-sub';
        subEl.textContent = key.sub;
        el.appendChild(subEl);
      }

      // Red symbol — top-right
      if (key.sym) {
        const symEl = document.createElement('div');
        symEl.className = 'vkb-sym';
        symEl.textContent = key.sym;
        el.appendChild(symEl);
      }

      // Main white label
      const mainEl = document.createElement('div');
      mainEl.className = 'vkb-main';
      mainEl.textContent = key.label;
      el.appendChild(mainEl);

      // ── Events ──────────────────────────────────────────────────────────
      function press(e) {
        e.preventDefault();
        if (key.sticky) {
          if (key.label.startsWith('CAPS')) {
            capsLatch = !capsLatch;
            el.classList.toggle('vkb-latched', capsLatch);
            capsLatch ? specKeyDown(key.row, key.bit) : specKeyUp(key.row, key.bit);
          } else {
            symLatch = !symLatch;
            el.classList.toggle('vkb-latched', symLatch);
            kb.classList.toggle('vkb-sym-active', symLatch);
            symLatch ? specKeyDown(key.row, key.bit) : specKeyUp(key.row, key.bit);
          }
          return;
        }
        el.classList.add('vkb-pressed');
        specKeyDown(key.row, key.bit);
      }

      function release(e) {
        e.preventDefault();
        if (key.sticky) return;
        el.classList.remove('vkb-pressed');
        specKeyUp(key.row, key.bit);
        if (capsLatch) {
          capsLatch = false;
          document.getElementById('key-caps').classList.remove('vkb-latched');
          specKeyUp(0, 0x01);
        }
        if (symLatch) {
          symLatch = false;
          document.getElementById('key-sym').classList.remove('vkb-latched');
          kb.classList.remove('vkb-sym-active');
          specKeyUp(7, 0x02);
        }
      }

      el.addEventListener('touchstart',  press,   { passive: false });
      el.addEventListener('touchend',    release, { passive: false });
      el.addEventListener('mousedown',   press);
      el.addEventListener('mouseup',     release);
      el.addEventListener('mouseleave',  e => {
        if (!key.sticky && el.classList.contains('vkb-pressed')) release(e);
      });

      wrap.appendChild(el);
      rowDiv.appendChild(wrap);
    });

    kb.appendChild(rowDiv);
  });

  // Rainbow stripe (right edge decoration)
  const stripe = document.createElement('div');
  stripe.id = 'vkb-stripe';
  ['#1818f0','#d80000','#d8d800','#00d800','#00d8d8'].forEach(c => {
    const s = document.createElement('div');
    s.style.background = c;
    stripe.appendChild(s);
  });
  kb.appendChild(stripe);

  const kbSide = document.getElementById('keyboard-side');
  const controls = document.getElementById('controls');
  if (kbSide && controls) {
    kbSide.insertBefore(kb, controls);
  } else {
    (kbSide || document.body).appendChild(kb);
  }

  // ── Styles ──────────────────────────────────────────────────────────────────
  const style = document.createElement('style');
  style.textContent = `
    /* ── Keyboard body ── */
    #vkeyboard {
      position: relative;
      width: 100%;
      max-width: 700px;
      margin: 14px auto 8px;
      padding: 6px 48px 10px 10px; /* right padding for stripe */
      background: #111;
      border-radius: 8px 4px 4px 8px;
      border: 1px solid #333;
      box-shadow:
        0 8px 32px rgba(0,0,0,0.8),
        inset 0 1px 0 rgba(255,255,255,0.07);
      user-select: none;
      -webkit-user-select: none;
      touch-action: none;
    }

    /* ── Brand header ── */
    #vkb-header {
      display: flex;
      align-items: center;
      padding: 2px 0 4px 4px;
    }
    .vkb-brand {
      font-size: clamp(8px, 1.8vw, 12px);
      font-family: Arial, sans-serif;
      font-weight: bold;
      color: #ccc;
      letter-spacing: 1px;
    }

    /* ── Rainbow stripe (right side) ── */
    #vkb-stripe {
      position: absolute;
      top: 0; bottom: 0; right: 0;
      width: 40px;
      border-radius: 0 4px 4px 0;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    #vkb-stripe > div {
      flex: 1;
    }

    /* ── Rows ── */
    .vkb-row {
      display: flex;
      gap: 2px;
      margin-bottom: 2px;
      align-items: flex-end;
    }

    /* ── Key wrapper (above-bezel + key) ── */
    .vkb-wrap {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      align-items: stretch;
    }

    /* ── Above-key bezel labels ── */
    .vkb-above {
      min-height: 18px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-end;
      padding-bottom: 1px;
      line-height: 1;
    }
    .vkb-color-name {
      font-size: clamp(5px, 1.1vw, 7px);
      font-family: Arial, sans-serif;
      font-weight: bold;
      text-align: center;
      line-height: 1.2;
    }
    .vkb-ext {
      font-size: clamp(5px, 1vw, 6.5px);
      font-family: Arial, sans-serif;
      color: #5af;
      text-align: center;
      line-height: 1.2;
      white-space: nowrap;
    }

    /* ── Rubber key ── */
    .vkb-key {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-end;
      padding: 2px 2px 3px;
      height: 44px;

      /* Dark teal rubber key colour */
      background: linear-gradient(160deg, #5a706a 0%, #3c4e4a 40%, #2e3e3c 100%);
      border: 1px solid #2a3a38;
      border-top: 1px solid #6a8078;
      border-bottom: 3px solid #1a2826;
      border-radius: 3px;
      box-shadow:
        inset 0 1px 0 rgba(255,255,255,0.12),
        inset 0 -1px 0 rgba(0,0,0,0.3);

      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
      transition: filter 0.05s;
      overflow: hidden;
    }

    .vkb-key:active, .vkb-key.vkb-pressed {
      background: linear-gradient(160deg, #6a8078 0%, #4c5e5a 40%, #3e5250 100%);
      border-bottom-width: 1px;
      transform: translateY(2px);
      filter: brightness(1.15);
    }

    /* Latched modifier: orange-red highlight */
    .vkb-key.vkb-latched {
      background: linear-gradient(160deg, #704040 0%, #4a2828 100%);
      border-color: #a03030;
      border-top-color: #c04040;
    }

    /* ── Green BASIC keyword — top-left ── */
    .vkb-sub {
      position: absolute;
      top: 1px;
      left: 2px;
      font-size: clamp(4.5px, 0.95vw, 6.5px);
      font-family: Arial, sans-serif;
      font-weight: bold;
      color: #3d3;
      line-height: 1.1;
      white-space: pre;
      pointer-events: none;
    }

    /* ── Red symbol — top-right ── */
    .vkb-sym {
      position: absolute;
      top: 1px;
      right: 2px;
      font-size: clamp(5px, 1.1vw, 7px);
      font-family: Arial, sans-serif;
      font-weight: bold;
      color: #e44;
      pointer-events: none;
      opacity: 0.8;
      transition: opacity 0.12s;
    }

    #vkeyboard.vkb-sym-active .vkb-sym {
      opacity: 1;
      color: #f66;
    }

    /* ── Main white label ── */
    .vkb-main {
      font-size: clamp(8px, 2vw, 13px);
      font-family: Arial, sans-serif;
      font-weight: bold;
      color: #e8e8e8;
      text-align: center;
      line-height: 1.1;
      white-space: pre;
      pointer-events: none;
      text-shadow: 0 1px 2px rgba(0,0,0,0.6);
    }

    @media (min-width: 480px) {
      .vkb-key  { height: 50px; }
      .vkb-above { min-height: 20px; }
    }
    @media (min-width: 640px) {
      .vkb-key  { height: 56px; }
      .vkb-sub  { font-size: 7px; }
      .vkb-sym  { font-size: 8px; }
      .vkb-main { font-size: 14px; }
      .vkb-ext  { font-size: 7px; }
      .vkb-color-name { font-size: 7.5px; }
      .vkb-above { min-height: 24px; }
    }
  `;
  document.head.appendChild(style);
}
