// Fullscreen mode + touch joystick overlay

(function () {

  // ── Joystick key mappings (for non-Kempston types) ───────────────────────
  // Format: { up, down, left, right, fire } each with { row, bit }
  const KEYMAPS = {
    sinclair1: {
      up:    { row: 4, bit: 0x02 }, // 9
      down:  { row: 4, bit: 0x04 }, // 8
      left:  { row: 4, bit: 0x10 }, // 6
      right: { row: 4, bit: 0x08 }, // 7
      fire:  { row: 4, bit: 0x01 }, // 0
    },
    cursor: {
      up:    { row: 4, bit: 0x08 }, // 7
      down:  { row: 4, bit: 0x10 }, // 6
      left:  { row: 3, bit: 0x10 }, // 5
      right: { row: 4, bit: 0x04 }, // 8
      fire:  { row: 4, bit: 0x01 }, // 0
    },
  };

  // ── State ─────────────────────────────────────────────────────────────────
  let joyType = 'kempston';
  let joy     = { up: false, down: false, left: false, right: false, fire: false };
  let prev    = { up: false, down: false, left: false, right: false, fire: false };
  let isFullscreen = false;

  // ── Elements ──────────────────────────────────────────────────────────────
  const overlay   = document.getElementById('joystick-overlay');
  const fireZone  = document.getElementById('js-fire-zone');
  const dpadZone  = document.getElementById('js-dpad-zone');
  const dpad      = document.getElementById('js-dpad');
  const fsBtn     = document.getElementById('fs-btn');
  const fsExitBtn = document.getElementById('fs-exit-btn');
  const joySelect = document.getElementById('joy-type-select');

  // D-pad arm elements keyed by direction
  const arms = {};
  dpad.querySelectorAll('.js-dpad-arm').forEach(el => {
    arms[el.dataset.dir] = el;
  });

  // ── Apply joystick state to emulator ──────────────────────────────────────
  function applyJoy() {
    const dirs = ['up', 'down', 'left', 'right', 'fire'];

    if (joyType === 'kempston') {
      const changed = dirs.some(d => joy[d] !== prev[d]);
      if (changed && typeof wasm !== 'undefined' && wasm && wasm.setKempston) {
        const v = (joy.right ? 0x01 : 0) | (joy.left  ? 0x02 : 0) |
                  (joy.down  ? 0x04 : 0) | (joy.up    ? 0x08 : 0) |
                  (joy.fire  ? 0x10 : 0);
        wasm.setKempston(v);
      }
    } else {
      const map = KEYMAPS[joyType];
      if (!map) return;
      dirs.forEach(d => {
        if (joy[d] === prev[d]) return;
        const k = map[d];
        if (!k) return;
        if (joy[d]) window.specKeyDown(k.row, k.bit);
        else        window.specKeyUp(k.row, k.bit);
      });
    }

    // Update D-pad arm visuals
    ['up','down','left','right'].forEach(d => {
      if (arms[d]) arms[d].classList.toggle('active', joy[d]);
    });
    fireZone.classList.toggle('active', joy.fire);

    prev = { ...joy };
  }

  function releaseAll() {
    joy = { up: false, down: false, left: false, right: false, fire: false };
    applyJoy();
  }

  // ── D-pad touch → direction ───────────────────────────────────────────────
  function dpadDirs(touchX, touchY) {
    const rect = dpadZone.getBoundingClientRect();
    const cx   = rect.left + rect.width  * 0.5;
    const cy   = rect.top  + rect.height * 0.5;
    const dx   = touchX - cx;
    const dy   = touchY - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const deadzone = Math.min(rect.width, rect.height) * 0.12;

    if (dist < deadzone) {
      return { up: false, down: false, left: false, right: false };
    }

    const nx = dx / dist;  // normalised x:  -1…1
    const ny = dy / dist;  // normalised y:  -1…1

    return {
      up:    ny < -0.35,
      down:  ny >  0.35,
      left:  nx < -0.35,
      right: nx >  0.35,
    };
  }

  // ── Multi-touch tracking ──────────────────────────────────────────────────
  // Maps touch identifier → zone ('fire' | 'dpad')
  const touchZones = new Map();

  function zoneFor(clientX, clientY) {
    const or = overlay.getBoundingClientRect();
    const relX = clientX - or.left;
    if (relX < or.width * 0.45) return 'fire';
    if (relX > or.width * 0.55) return 'dpad';
    return null; // dead middle strip
  }

  function recalcJoy() {
    let fire = false;
    let dirs = { up: false, down: false, left: false, right: false };

    touchZones.forEach((zone, id) => {
      if (zone.type === 'fire') {
        fire = true;
      } else if (zone.type === 'dpad') {
        const d = dpadDirs(zone.x, zone.y);
        if (d.up)    dirs.up    = true;
        if (d.down)  dirs.down  = true;
        if (d.left)  dirs.left  = true;
        if (d.right) dirs.right = true;
      }
    });

    joy = { ...dirs, fire };
    applyJoy();
  }

  overlay.addEventListener('touchstart', e => {
    e.preventDefault();
    Array.from(e.changedTouches).forEach(t => {
      const type = zoneFor(t.clientX, t.clientY);
      if (type) touchZones.set(t.identifier, { type, x: t.clientX, y: t.clientY });
    });
    recalcJoy();
  }, { passive: false });

  overlay.addEventListener('touchmove', e => {
    e.preventDefault();
    Array.from(e.changedTouches).forEach(t => {
      if (touchZones.has(t.identifier)) {
        const z = touchZones.get(t.identifier);
        z.x = t.clientX;
        z.y = t.clientY;
      }
    });
    recalcJoy();
  }, { passive: false });

  overlay.addEventListener('touchend', e => {
    e.preventDefault();
    Array.from(e.changedTouches).forEach(t => touchZones.delete(t.identifier));
    recalcJoy();
  }, { passive: false });

  overlay.addEventListener('touchcancel', e => {
    Array.from(e.changedTouches).forEach(t => touchZones.delete(t.identifier));
    recalcJoy();
  }, { passive: false });

  // ── Fullscreen ────────────────────────────────────────────────────────────
  function enterFullscreen() {
    isFullscreen = true;
    document.body.classList.add('js-fullscreen');
    releaseAll();
    touchZones.clear();

    // Try native fullscreen (works on Android, desktop; not iOS Safari)
    const el = document.documentElement;
    const req = el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen;
    if (req) req.call(el).catch(() => {}); // ignore errors (e.g. iOS denies it)
  }

  function exitFullscreen() {
    isFullscreen = false;
    document.body.classList.remove('js-fullscreen');
    releaseAll();
    touchZones.clear();

    if (document.fullscreenElement || document.webkitFullscreenElement) {
      (document.exitFullscreen || document.webkitExitFullscreen || document.mozCancelFullScreen)
        .call(document).catch(() => {});
    }
  }

  fsBtn.addEventListener('click', () => isFullscreen ? exitFullscreen() : enterFullscreen());
  fsExitBtn.addEventListener('click', exitFullscreen);

  // Sync if user exits native fullscreen via browser UI / Escape key
  document.addEventListener('fullscreenchange',       syncFsState);
  document.addEventListener('webkitfullscreenchange', syncFsState);
  function syncFsState() {
    if (!document.fullscreenElement && !document.webkitFullscreenElement && isFullscreen) {
      isFullscreen = false;
      document.body.classList.remove('js-fullscreen');
      releaseAll();
    }
  }

  // Escape key exits CSS fullscreen too
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && isFullscreen) exitFullscreen();
  });

  // ── Joystick type selector ────────────────────────────────────────────────
  joySelect.addEventListener('change', () => {
    joyType = joySelect.value;
    releaseAll();
  });

})();
