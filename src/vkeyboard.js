// ZX Spectrum virtual keyboard for mobile/touch devices

(function () {

  // Expose key functions globally so vkeyboard can call into the emulator
  window.specKeyDown = (row, bit) => {
    if (typeof initAudio !== 'undefined') initAudio(); // unlock iOS audio on first key tap
    if (typeof wasm !== 'undefined' && wasm) wasm.keyDown(row, bit);
  };
  window.specKeyUp = (row, bit) => {
    if (typeof wasm !== 'undefined' && wasm) wasm.keyUp(row, bit);
  };

  // ── Keyboard layout ────────────────────────────────────────────────────────
  // Each key: { label, row, bit, [sym], [wide] }
  // sym = label shown when Symbol Shift is active
  // wide = extra width multiplier
  const ROWS = [
    [
      { label:'1', sym:'!',  row:3, bit:0x01 },
      { label:'2', sym:'@',  row:3, bit:0x02 },
      { label:'3', sym:'#',  row:3, bit:0x04 },
      { label:'4', sym:'$',  row:3, bit:0x08 },
      { label:'5', sym:'%',  row:3, bit:0x10 },
      { label:'6', sym:'&',  row:4, bit:0x10 },
      { label:'7', sym:"'",  row:4, bit:0x08 },
      { label:'8', sym:'(',  row:4, bit:0x04 },
      { label:'9', sym:')',  row:4, bit:0x02 },
      { label:'0', sym:'_',  row:4, bit:0x01 },
    ],
    [
      { label:'Q', sym:'<=', row:2, bit:0x01 },
      { label:'W', sym:'<>', row:2, bit:0x02 },
      { label:'E', sym:'>=', row:2, bit:0x04 },
      { label:'R', sym:'<', row:2, bit:0x08 },
      { label:'T', sym:'>', row:2, bit:0x10 },
      { label:'Y', sym:'[', row:5, bit:0x10 },
      { label:'U', sym:']', row:5, bit:0x08 },
      { label:'I', sym:'↑', row:5, bit:0x04 },
      { label:'O', sym:';', row:5, bit:0x02 },
      { label:'P', sym:'"', row:5, bit:0x01 },
    ],
    [
      { label:'A', sym:'~',  row:1, bit:0x01 },
      { label:'S', sym:'|',  row:1, bit:0x02 },
      { label:'D', sym:'\\', row:1, bit:0x04 },
      { label:'F', sym:'{',  row:1, bit:0x08 },
      { label:'G', sym:'}',  row:1, bit:0x10 },
      { label:'H', sym:'^',  row:6, bit:0x10 },
      { label:'J', sym:'-',  row:6, bit:0x08 },
      { label:'K', sym:'+',  row:6, bit:0x04 },
      { label:'L', sym:'=',  row:6, bit:0x02 },
      { label:'ENT', row:6, bit:0x01, wide:1.5 },
    ],
    [
      { label:'CAPS', row:0, bit:0x01, wide:1.5, sticky:true, id:'key-caps' },
      { label:'Z', sym:':', row:0, bit:0x02 },
      { label:'X', sym:'/', row:0, bit:0x04 },
      { label:'C', sym:'?', row:0, bit:0x08 },
      { label:'V', sym:'/', row:0, bit:0x10 },
      { label:'B', sym:'*', row:7, bit:0x10 },
      { label:'N', sym:',', row:7, bit:0x08 },
      { label:'M', sym:'.', row:7, bit:0x04 },
      { label:'SYM', row:7, bit:0x02, wide:1.5, sticky:true, id:'key-sym' },
      { label:'SPC', row:7, bit:0x01, wide:2.0 },
    ],
  ];

  // Sticky key state
  let capsLatch = false;
  let symLatch  = false;

  // ── Build DOM ──────────────────────────────────────────────────────────────
  const kb = document.createElement('div');
  kb.id = 'vkeyboard';

  ROWS.forEach(rowKeys => {
    const rowDiv = document.createElement('div');
    rowDiv.className = 'vkb-row';

    rowKeys.forEach(key => {
      const el = document.createElement('div');
      el.className = 'vkb-key';
      if (key.id) el.id = key.id;
      if (key.wide) el.style.flexGrow = key.wide;

      // Main label
      const mainLabel = document.createElement('span');
      mainLabel.className = 'vkb-main';
      mainLabel.textContent = key.label;
      el.appendChild(mainLabel);

      // Symbol label (top-left, shown when SYM active)
      if (key.sym) {
        const symLabel = document.createElement('span');
        symLabel.className = 'vkb-sym';
        symLabel.textContent = key.sym;
        el.appendChild(symLabel);
      }

      // ── Touch / mouse events ─────────────────────────────────────────────
      function press(e) {
        e.preventDefault();

        if (key.sticky) {
          // Toggle sticky key
          if (key.label === 'CAPS') {
            capsLatch = !capsLatch;
            el.classList.toggle('vkb-latched', capsLatch);
            if (capsLatch) specKeyDown(key.row, key.bit);
            else           specKeyUp(key.row, key.bit);
          } else if (key.label === 'SYM') {
            symLatch = !symLatch;
            el.classList.toggle('vkb-latched', symLatch);
            updateSymLabels();
            if (symLatch) specKeyDown(key.row, key.bit);
            else          specKeyUp(key.row, key.bit);
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

        // Release latched modifiers after a normal key
        if (capsLatch) {
          capsLatch = false;
          document.getElementById('key-caps').classList.remove('vkb-latched');
          specKeyUp(0, 0x01);
        }
        if (symLatch) {
          symLatch = false;
          document.getElementById('key-sym').classList.remove('vkb-latched');
          updateSymLabels();
          specKeyUp(7, 0x02);
        }
      }

      el.addEventListener('touchstart', press,   { passive: false });
      el.addEventListener('touchend',   release, { passive: false });
      el.addEventListener('mousedown',  press);
      el.addEventListener('mouseup',    release);
      el.addEventListener('mouseleave', (e) => {
        if (!key.sticky && el.classList.contains('vkb-pressed')) release(e);
      });

      rowDiv.appendChild(el);
    });

    kb.appendChild(rowDiv);
  });

  document.body.appendChild(kb);

  function updateSymLabels() {
    kb.classList.toggle('vkb-sym-active', symLatch);
  }

  // ── Styles ─────────────────────────────────────────────────────────────────
  const style = document.createElement('style');
  style.textContent = `
    #vkeyboard {
      width: 100%;
      max-width: 640px;
      margin: 12px auto 4px;
      padding: 8px 4px;
      background: #111;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.6);
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
    .vkb-key {
      flex: 1;
      position: relative;
      min-width: 0;
      aspect-ratio: 1 / 1.1;
      max-height: 52px;
      background: #222;
      border: 1px solid #444;
      border-bottom: 3px solid #555;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: background 0.06s, transform 0.06s;
      -webkit-tap-highlight-color: transparent;
    }
    .vkb-key:active, .vkb-key.vkb-pressed {
      background: #3a3a6a;
      border-bottom-width: 1px;
      transform: translateY(1px);
    }
    .vkb-key.vkb-latched {
      background: #5a2a2a;
      border-color: #ff6b6b;
      color: #ff6b6b;
    }
    .vkb-main {
      font-size: clamp(8px, 2.2vw, 13px);
      font-family: 'Courier New', monospace;
      font-weight: bold;
      color: #ddd;
      pointer-events: none;
    }
    .vkb-sym {
      position: absolute;
      top: 2px;
      left: 3px;
      font-size: clamp(6px, 1.5vw, 9px);
      color: #f80;
      font-family: 'Courier New', monospace;
      pointer-events: none;
      opacity: 0.5;
      transition: opacity 0.15s;
    }
    #vkeyboard.vkb-sym-active .vkb-sym {
      opacity: 1;
    }
    /* Colour the number row labels like the real Spectrum */
    .vkb-row:first-child .vkb-main { color: #fff; }

    @media (min-width: 700px) {
      .vkb-key { max-height: 44px; }
      .vkb-main { font-size: 12px; }
      .vkb-sym  { font-size: 8px; }
    }
  `;
  document.head.appendChild(style);

})();
