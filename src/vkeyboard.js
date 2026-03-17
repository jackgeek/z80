// ZX Spectrum 48K virtual keyboard — styled after the original rubber-key layout

(function () {

  window.specKeyDown = (row, bit) => {
    if (typeof initAudio !== 'undefined') initAudio();
    if (typeof wasm !== 'undefined' && wasm) wasm.keyDown(row, bit);
  };
  window.specKeyUp = (row, bit) => {
    if (typeof wasm !== 'undefined' && wasm) wasm.keyUp(row, bit);
  };

  // ── Layout ────────────────────────────────────────────────────────────────
  // Each key: { label, row, bit, sub (green keyword), sym (red symbol),
  //             ext (white extended), wide (flex-grow multiplier), sticky }
  //
  // The real Spectrum key legend has:
  //   main label  (black on key)
  //   above-key green BASIC keyword (e.g. PRINT, LOAD)
  //   red symbol  (Symbol Shift combo)
  //   white/cyan "EXTEND MODE" label (rare, omitted for clarity)

  const ROWS = [
    // Row 1: 1–0
    [
      { label:'1', sym:'!', sub:'EDIT',   row:3, bit:0x01 },
      { label:'2', sym:'@', sub:'CAPS\nLK',row:3, bit:0x02 },
      { label:'3', sym:'#', sub:'TRUE\nVID',row:3,bit:0x04 },
      { label:'4', sym:'$', sub:'INV\nVID', row:3, bit:0x08 },
      { label:'5', sym:'%', sub:'←',      row:3, bit:0x10 },
      { label:'6', sym:'&', sub:'↓',      row:4, bit:0x10 },
      { label:'7', sym:"'", sub:'↑',      row:4, bit:0x08 },
      { label:'8', sym:'(', sub:'→',      row:4, bit:0x04 },
      { label:'9', sym:')', sub:'GRAPH',  row:4, bit:0x02 },
      { label:'0', sym:'_', sub:'DELETE', row:4, bit:0x01 },
    ],
    // Row 2: Q–P
    [
      { label:'Q', sym:'<=', sub:'PLOT',   row:2, bit:0x01 },
      { label:'W', sym:'<>', sub:'DRAW',   row:2, bit:0x02 },
      { label:'E', sym:'>=', sub:'REM',    row:2, bit:0x04 },
      { label:'R', sym:'<',  sub:'RUN',    row:2, bit:0x08 },
      { label:'T', sym:'>',  sub:'RAND',   row:2, bit:0x10 },
      { label:'Y', sym:'[',  sub:'RETURN', row:5, bit:0x10 },
      { label:'U', sym:']',  sub:'IF',     row:5, bit:0x08 },
      { label:'I', sym:'↑',  sub:'INPUT',  row:5, bit:0x04 },
      { label:'O', sym:';',  sub:'POKE',   row:5, bit:0x02 },
      { label:'P', sym:'"',  sub:'PRINT',  row:5, bit:0x01 },
    ],
    // Row 3: A–ENTER
    [
      { label:'A', sym:'~',  sub:'NEW',    row:1, bit:0x01 },
      { label:'S', sym:'|',  sub:'SAVE',   row:1, bit:0x02 },
      { label:'D', sym:'\\', sub:'DIM',    row:1, bit:0x04 },
      { label:'F', sym:'{',  sub:'FOR',    row:1, bit:0x08 },
      { label:'G', sym:'}',  sub:'GOTO',   row:1, bit:0x10 },
      { label:'H', sym:'^',  sub:'GOSUB',  row:6, bit:0x10 },
      { label:'J', sym:'-',  sub:'LOAD',   row:6, bit:0x08 },
      { label:'K', sym:'+',  sub:'LIST',   row:6, bit:0x04 },
      { label:'L', sym:'=',  sub:'LET',    row:6, bit:0x02 },
      { label:'ENTER', row:6, bit:0x01, wide:1.6 },
    ],
    // Row 4: CAPS–SPACE
    [
      { label:'CAPS\nSHIFT', row:0, bit:0x01, wide:1.8, sticky:true, id:'key-caps' },
      { label:'Z', sym:':', sub:'COPY',  row:0, bit:0x02 },
      { label:'X', sym:'/', sub:'CLEAR', row:0, bit:0x04 },
      { label:'C', sym:'?', sub:'CONT',  row:0, bit:0x08 },
      { label:'V', sym:'/', sub:'CLS',   row:0, bit:0x10 },
      { label:'B', sym:'*', sub:'BORDER',row:7, bit:0x10 },
      { label:'N', sym:',', sub:'NEXT',  row:7, bit:0x08 },
      { label:'M', sym:'.', sub:'PAUSE', row:7, bit:0x04 },
      { label:'SYM\nSHIFT', row:7, bit:0x02, wide:1.8, sticky:true, id:'key-sym' },
      { label:'SPACE', row:7, bit:0x01, wide:2.2 },
    ],
  ];

  let capsLatch = false;
  let symLatch  = false;

  // ── Build DOM ─────────────────────────────────────────────────────────────
  const kb = document.createElement('div');
  kb.id = 'vkeyboard';

  ROWS.forEach((rowKeys, rowIdx) => {
    const rowDiv = document.createElement('div');
    rowDiv.className = 'vkb-row';

    rowKeys.forEach(key => {
      const el = document.createElement('div');
      el.className = 'vkb-key';
      if (key.id)   el.id = key.id;
      if (key.wide) el.style.flexGrow = key.wide;

      // Green BASIC keyword above the key
      if (key.sub) {
        const subEl = document.createElement('div');
        subEl.className = 'vkb-sub';
        subEl.textContent = key.sub;
        el.appendChild(subEl);
      }

      // Red symbol (Symbol Shift) — top-right
      if (key.sym) {
        const symEl = document.createElement('div');
        symEl.className = 'vkb-sym';
        symEl.textContent = key.sym;
        el.appendChild(symEl);
      }

      // Main key label
      const mainEl = document.createElement('div');
      mainEl.className = 'vkb-main';
      mainEl.textContent = key.label;
      el.appendChild(mainEl);

      // ── Touch/mouse events ──────────────────────────────────────────────
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
        // Release latched modifiers after a normal keypress
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
      el.addEventListener('mouseleave',  e => { if (!key.sticky && el.classList.contains('vkb-pressed')) release(e); });

      rowDiv.appendChild(el);
    });

    kb.appendChild(rowDiv);
  });

  document.body.appendChild(kb);

  // ── Styles ────────────────────────────────────────────────────────────────
  const style = document.createElement('style');
  style.textContent = `
    #vkeyboard {
      width: 100%;
      max-width: 680px;
      margin: 14px auto 8px;
      padding: 10px 8px 8px;
      background: #1a1a1a;
      border-radius: 6px;
      border: 2px solid #333;
      box-shadow: 0 6px 24px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.05);
      user-select: none;
      -webkit-user-select: none;
      touch-action: none;
    }

    .vkb-row {
      display: flex;
      gap: 3px;
      margin-bottom: 3px;
      justify-content: center;
    }

    /* ── Individual key ── */
    .vkb-key {
      flex: 1;
      min-width: 0;
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-end;
      padding-bottom: 4px;
      height: 52px;

      background: linear-gradient(180deg, #2e2e2e 0%, #1c1c1c 100%);
      border: 1px solid #555;
      border-bottom: 3px solid #111;
      border-radius: 3px;
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
      transition: filter 0.05s;
      overflow: hidden;
    }

    .vkb-key:active, .vkb-key.vkb-pressed {
      background: linear-gradient(180deg, #444 0%, #2a2a2a 100%);
      border-bottom-width: 1px;
      transform: translateY(1px);
      filter: brightness(1.3);
    }

    /* Caps / Sym latch: glow red */
    .vkb-key.vkb-latched {
      background: linear-gradient(180deg, #5a1a1a 0%, #3a0a0a 100%);
      border-color: #c00;
    }

    /* ── Sub label (green BASIC keyword above key) ── */
    .vkb-sub {
      position: absolute;
      top: 1px;
      left: 0; right: 0;
      text-align: center;
      font-size: clamp(5px, 1.1vw, 7px);
      font-family: 'Courier New', monospace;
      font-weight: bold;
      color: #3d3;
      line-height: 1.1;
      white-space: pre;
      pointer-events: none;
      letter-spacing: -0.5px;
    }

    /* ── Symbol label (red, top-right) ── */
    .vkb-sym {
      position: absolute;
      top: 1px;
      right: 3px;
      font-size: clamp(6px, 1.3vw, 8px);
      font-family: 'Courier New', monospace;
      font-weight: bold;
      color: #c33;
      pointer-events: none;
      opacity: 0.7;
      transition: opacity 0.12s, color 0.12s;
    }

    #vkeyboard.vkb-sym-active .vkb-sym {
      opacity: 1;
      color: #f55;
    }

    /* ── Main label (white, centred on key face) ── */
    .vkb-main {
      font-size: clamp(7px, 2vw, 12px);
      font-family: 'Courier New', monospace;
      font-weight: bold;
      color: #eee;
      white-space: pre;
      text-align: center;
      line-height: 1.1;
      pointer-events: none;
      letter-spacing: -0.3px;
    }

    /* Slightly taller rows on wider screens */
    @media (min-width: 480px) {
      .vkb-key { height: 58px; }
      .vkb-sub  { font-size: 7px; }
      .vkb-main { font-size: 12px; }
      .vkb-sym  { font-size: 8px; }
    }
    @media (min-width: 640px) {
      .vkb-key  { height: 62px; }
      .vkb-sub  { font-size: 8px; }
      .vkb-main { font-size: 13px; }
      .vkb-sym  { font-size: 9px; }
    }
  `;
  document.head.appendChild(style);

})();
