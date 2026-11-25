'use strict';
// JustZombies: the isometric look (window.TZI). The simulation stays in flat world units (TZW: a tile
// is 80 units = 1.6 m); only the drawing is projected, 2:1 "pixel isometric" like the staged art set
// (public/box/games/trash-assets/manifest.json, CC0, see CREDITS.md):
//   art x = (x - y) * 0.8, art y = (x + y) * 0.4 - height * 0.98     (a 128 x 64 px tile diamond)
// Things are depth-sorted by x + y (the projected foot), ground things are drawn with one affine
// transform (so collision boxes, roads, gates and decals line up with the art), standing things are
// sprites from the atlases (or the older code-drawn art stood up as a billboard).
//   TZI.boot(onProgress)     load the manifest + the core atlases (the phone's loading screen)
//   TZI.need(key)            a packed sprite (or null while it loads: it is queued)
//   TZI.render(g, sim, V)    draw a game frame (called by TZSim.render once TZI.ready)
//   TZI.cam                  the camera of the last frame: toScreen(x, y, z), toWorld(sx, sy), dirToWorld(dx, dy)
// Memory: atlases are decoded one at a time, each frame is trimmed to its pixels and packed into
// small canvases (low graphics packs at 0.6 scale); zombie types load as they appear.
(function () {
  const TAU = Math.PI * 2, BASE = '/box/games/trash-assets/';
  const HX = 0.8, HY = 0.4, HZ = 0.98; // art px per world unit: across (x - y), down (x + y), up (height)
  // Standing things are drawn a little under true size (the floor is true size), so the view keeps its
  // wide feel: the same ground as the old top-down view, with people and props that don't crowd it.
  const CH = 0.8; // zombies, survivors, NPCs
  const HB = 1.0; // your JustGameBox character (drawn by BOX.drawChar in old units) and what hangs on it
  const ST = 0.82; // props
  const BB = 0.78; // the older code-drawn (3/4 view) art, stood up: art px per old unit
  const DIR8 = ['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE'], MIRROR = { SW: 'SE', W: 'E', NW: 'NE' };
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const W = () => window.TZW;
  // The camera shows 8% more than the old top-down view (the owner asked to zoom out a little; never closer).
  const ZOOM_OUT = 1.08;
  // Shots fly at chest height: SHOT_H world units up (= the hero's gun hand), dipping or rising to the
  // chest of the zombie they are about to hit, so a hit lands on the body that is drawn.
  const SHOT_H = 36;
  let M = null, low = false;
  const st = { ready: false, loaded: 0, total: 1, failed: 0 };

  // ---------------- projection + camera ----------------
  const C = { s: 1, k: 1, dpr: 1, w: 1, h: 1, cx: 0, cy: 0, sx: 0, sy: 0 };
  const isoX = (x, y) => (x - y) * HX, isoY = (x, y, z = 0) => (x + y) * HY - z * HZ;
  C.toScreen = (x, y, z = 0) => [(isoX(x, y) - C.cx) * C.s + C.w / 2 + C.sx, (isoY(x, y, z) - C.cy) * C.s + C.h / 2 + C.sy];
  C.toWorld = (sx, sy, z = 0) => { const ix = (sx - C.w / 2 - C.sx) / C.s + C.cx, iy = (sy - C.h / 2 - C.sy) / C.s + C.cy + z * HZ; const a = ix / HX, b = iy / HY; return [(a + b) / 2, (b - a) / 2]; };
  // A direction on the screen (dx right, dy down) -> the world direction that looks the same, same length.
  function dirToWorld(dx, dy) { const L = Math.hypot(dx, dy); if (!L) return [0, 0]; const wx = dx / HX + dy / HY, wy = dy / HY - dx / HX, m = Math.hypot(wx, wy) || 1; return [(wx / m) * L, (wy / m) * L]; }
  // A world direction -> the screen angle it shows at.
  const screenAngle = (a) => Math.atan2((Math.cos(a) + Math.sin(a)) * HY, (Math.cos(a) - Math.sin(a)) * HX);
  C.dirToWorld = dirToWorld; C.screenAngle = screenAngle;
  // Which of the 8 art directions a world velocity shows (the manifest's rule).
  function dirOf(vx, vy) { const sx = vx - vy, sy = (vx + vy) / 2; return DIR8[Math.round(Math.atan2(sy, sx) / (Math.PI / 4)) & 7]; }
  function setScreen(g) { g.setTransform(C.dpr, 0, 0, C.dpr, 0, 0); }
  function setGround(g, H = 0) { const k = C.s * C.dpr; g.setTransform(HX * k, HY * k, -HX * k, HY * k, (C.w / 2 + C.sx - C.cx * C.s - HX * H * C.s) * C.dpr, (C.h / 2 + C.sy - C.cy * C.s + (HY - HZ) * H * C.s) * C.dpr); }
  // old 3/4 art anchored at (ax, ay): offsets from it are screen offsets (up is up)
  function setBill(g, ax, ay, z = 0, sc = BB) { const [X, Y] = C.toScreen(ax, ay, z), k = C.s * sc * C.dpr; g.setTransform(k, 0, 0, k, X * C.dpr - k * ax, Y * C.dpr - k * ay); }

  // ---------------- loading + packing ----------------
  const imgs = new Map(), packs = new Map(), queue = [];
  function img(file) {
    if (!imgs.has(file)) imgs.set(file, new Promise((ok, no) => { const im = new Image(); im.decoding = 'async'; im.onload = () => ok(im); im.onerror = () => no(new Error('art ' + file)); im.src = BASE + file; }));
    return imgs.get(file);
  }
  const keyOf = (k) => (M && M.aliases && M.aliases[k] && M.assets[M.aliases[k]] ? M.aliases[k] : k);
  const tick = () => new Promise((r) => setTimeout(r, 0));
  // Which animations a sprite keeps (the rest are never drawn, so never packed).
  const ANIMS1 = { static: { frames: 1, fps: 1, loop: true, rows: { S: 0 } } };
  function keepAnims(key, a) {
    const n = Object.keys(a.anims || ANIMS1);
    if (key.startsWith('zombie.') && key !== 'zombie.nest') return n.filter((x) => x !== 'idle');
    if (key.startsWith('npc.')) return n.filter((x) => x !== 'interact');
    return n;
  }
  // Trim every frame to its pixels and pack them into page canvases (exact size, max 2048 wide).
  async function pack(key, slow) {
    const a = M.assets[key]; if (!a) throw new Error('no art ' + key);
    const im = await img(a.file), [cw, ch] = a.cell, q = low ? 0.6 : 1, cut = a.kind === 'weapon' ? 150 : 6; // (weapons are held: drop their baked shadow)
    const out = { key, a, q, sc: a.scale || 1, anims: {}, pages: [], h: (a.size ? a.size[1] : 1.8) * 49 };
    const tc = document.createElement('canvas'), tg = tc.getContext('2d', { willReadFrequently: true });
    const items = [];
    for (const an of keepAnims(key, a)) {
      const A = (a.anims || ANIMS1)[an]; out.anims[an] = { fps: A.fps || 12, loop: A.loop !== false, n: A.frames, rows: {} };
      for (const [dir, row] of Object.entries(A.rows)) {
        const n = A.frames, rw = cw * n; tc.width = rw; tc.height = ch; tg.clearRect(0, 0, rw, ch);
        if (a.rect) tg.drawImage(im, a.rect[0], a.rect[1], a.rect[2], a.rect[3], 0, 0, cw, ch); else tg.drawImage(im, 0, row * ch, rw, ch, 0, 0, rw, ch);
        const d = tg.getImageData(0, 0, rw, ch).data, list = out.anims[an].rows[dir] = [];
        for (let f = 0; f < n; f++) {
          let x0 = cw, y0 = ch, x1 = -1, y1 = -1;
          for (let y = 0; y < ch; y++) { const o = (y * rw + f * cw) * 4 + 3; for (let x = 0; x < cw; x++) if (d[o + x * 4] > cut) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; y1 = y; } }
          if (x1 < 0) { x0 = y0 = 0; x1 = y1 = 1; }
          const fr = { sx: (a.rect ? a.rect[0] : f * cw) + x0, sy: (a.rect ? a.rect[1] : row * ch) + y0, w: x1 - x0 + 1, h: y1 - y0 + 1, ax: a.anchor[0] - x0, ay: a.anchor[1] - y0 };
          list.push(fr); items.push(fr);
          // a held gun: where its lowest quarter sits (the grip / stock hang below the back end) tells which way it points
          if (an === 'spin' && (a.kind === 'weapon' || a.kind === 'pickup') && x1 >= 0) { let sx = 0, n2 = 0; const yq = y1 - Math.max(1, Math.round((y1 - y0) * 0.3)); for (let y = yq; y <= y1; y++) { const o = (y * rw + f * cw) * 4 + 3; for (let x = x0; x <= x1; x++) if (d[o + x * 4] > cut) { sx += x; n2++; } } fr.lx = n2 ? sx / n2 - x0 : fr.w / 2; }
          // the body's size (cell px): height above the feet, width across the chest (for shots and hit boxes)
          if (f === 0 && dir === (A.rows.S != null ? 'S' : Object.keys(A.rows)[0]) && (an === 'walk' || (!out.body && (an === 'static' || an === 'idle' || an === 'spin')))) {
            const top = a.anchor[1] - y0, ty = Math.round(a.anchor[1] - top * 0.55); let bx0 = cw, bx1 = -1;
            if (ty >= 0 && ty < ch) { const o = (ty * rw + f * cw) * 4 + 3; for (let x = 0; x < cw; x++) if (d[o + x * 4] > 128) { if (x < bx0) bx0 = x; bx1 = x; } }
            out.body = { h: Math.max(10, top), w: bx1 >= bx0 ? bx1 - bx0 + 1 : top * 0.5 };
          }
        }
        if (slow) await tick();
      }
    }
    // shelf packing (tallest first), then exact-size pages
    const PW = 2048, PH = 2048, order = items.slice().sort((p, r) => r.h - p.h);
    let page = { w: 0, h: 0, list: [] }, x = 0, y = 0, sh = 0; const pages = [page];
    for (const fr of order) {
      const w = Math.ceil(fr.w * q) + 2, h = Math.ceil(fr.h * q) + 2;
      if (x + w > PW) { x = 0; y += sh; sh = 0; }
      if (y + h > PH) { page = { w: 0, h: 0, list: [] }; pages.push(page); x = 0; y = 0; sh = 0; }
      fr.px = x + 1; fr.py = y + 1; fr.pw = w - 2; fr.ph = h - 2; fr.pg = pages.length - 1; page.list.push(fr);
      x += w; sh = Math.max(sh, h); page.w = Math.max(page.w, x); page.h = Math.max(page.h, y + sh);
    }
    for (const pg of pages) {
      const c = document.createElement('canvas'); c.width = Math.max(1, pg.w); c.height = Math.max(1, pg.h); const g = c.getContext('2d');
      g.imageSmoothingQuality = 'high';
      for (const fr of pg.list) g.drawImage(im, fr.sx, fr.sy, fr.w, fr.h, fr.px, fr.py, fr.pw, fr.ph);
      out.pages.push(c);
    }
    for (const fr of items) fr.c = out.pages[fr.pg];
    tc.width = tc.height = 1;
    return out;
  }
  let pumping = false;
  async function pump() {
    if (pumping) return; pumping = true;
    while (queue.length) {
      const key = queue.shift(), P = packs.get(key);
      try { const out = await pack(key, true); packs.set(key, out); } catch (e) { console.warn('[JustZombies art]', e && e.message); packs.set(key, { failed: true }); }
      void P; await tick();
    }
    pumping = false;
  }
  function need(key) {
    if (!M) return null; key = keyOf(key);
    const P = packs.get(key);
    if (P) return P.anims ? P : null;
    if (!M.assets[key]) { packs.set(key, { failed: true }); return null; }
    packs.set(key, { loading: true }); queue.push(key); pump(); return null;
  }
  function has(key) { key = keyOf(key); const P = packs.get(key); return !!(P && P.anims); }
  // The loading screen: the manifest, the ground tiles, the fx atlas and the art every area needs.
  const CORE = ['tile.grass', 'tile.grass2', 'tile.asphalt', 'tile.asphalt2', 'tile.concrete', 'tile.dirt', 'tile.dirt2', 'tile.gravel', 'tile.paving', 'tile.planks', 'tile.rust',
    'zombie.walker', 'zombie.runner', 'zombie.bloater', 'garage.door', 'chest', 'chest.key', 'weapon.pistol', 'pickup.xp', 'pickup.coins',
    'prop.fence.metal', 'prop.bin', 'prop.car', 'prop.tree', 'prop.lamp', 'prop.hedge', 'prop.wreck', 'prop.barrier.striped', 'bld.house1', 'bld.house2'];
  let booting = null;
  function boot(onProgress, o = {}) {
    if (booting) return booting;
    low = !!o.low;
    booting = (async () => {
      try {
        const r = await fetch(BASE + 'manifest.json'); M = await r.json();
        const list = (o.keys || CORE).map(keyOf).filter((k) => M.assets[k]);
        st.total = list.length + 2; st.loaded = 1; if (onProgress) onProgress(st.loaded / st.total);
        FX.img = await img('fx/fx.webp'); try { toonFx(); } catch (e) { /* the plain frames */ } st.loaded++; if (onProgress) onProgress(st.loaded / st.total);
        for (const k of list) { if (!packs.get(k) || !packs.get(k).anims) { try { packs.set(k, await pack(k, false)); } catch (e) { packs.set(k, { failed: true }); st.failed++; } } st.loaded++; if (onProgress) onProgress(st.loaded / st.total); }
        st.ready = true; TZI.ready = true;
      } catch (e) { console.warn('[JustZombies art] could not load the art set', e && e.message); st.ready = false; TZI.ready = false; TZI.broken = true; }
      return st.ready;
    })();
    return booting;
  }
  // Ask for the art an area / a wave is going to need (so it loads before it shows up).
  function prefetch(keys) { for (const k of keys) need(k); }

  // ---------------- drawing sprites ----------------
  // Draw frame fi of anim in dir with its anchor at screen (X, Y) (CSS px); k = screen px per art px.
  function frameOf(P, anim, dir) {
    const A = P.anims[anim] || P.anims.walk || P.anims.static || P.anims[Object.keys(P.anims)[0]]; if (!A) return null;
    let d = dir, flip = false;
    if (!A.rows[d]) { const m = MIRROR[d]; if (m && A.rows[m]) { d = m; flip = true; } else d = A.rows.S ? 'S' : Object.keys(A.rows)[0]; }
    return { A, list: A.rows[d], flip };
  }
  const TINTS = { frost: ['rgba(205,235,255,0.55)', 'rgba(255,255,255,0.25)'], ember: ['rgba(255,96,24,0.42)', null], farmer: ['rgba(150,104,52,0.32)', null] };
  let tintN = 0;
  function tinted(fr, tint) {
    const k = 't_' + tint; if (fr[k]) return fr[k]; if (tintN > 900) return null; tintN++;
    const c = document.createElement('canvas'); c.width = Math.max(1, fr.pw); c.height = Math.max(1, fr.ph); const x = c.getContext('2d');
    x.drawImage(fr.c, fr.px, fr.py, fr.pw, fr.ph, 0, 0, fr.pw, fr.ph); x.globalCompositeOperation = 'source-atop'; const T = TINTS[tint]; x.fillStyle = T[0]; x.fillRect(0, 0, c.width, c.height);
    if (T[1]) { const gr = x.createLinearGradient(0, 0, 0, c.height * 0.4); gr.addColorStop(0, T[1]); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, c.width, c.height * 0.4); } // (snow on the shoulders)
    fr[k] = c; return c;
  }
  function blit(g, P, fr, X, Y, k, flip, tint) {
    const sc = k * P.sc, dw = fr.w * sc, dh = fr.h * sc, D = C.dpr;
    if (flip) { g.setTransform(-D, 0, 0, D, 2 * X * D, 0); } else g.setTransform(D, 0, 0, D, 0, 0);
    const tc = tint && TINTS[tint] ? tinted(fr, tint) : null;
    if (tc) g.drawImage(tc, 0, 0, tc.width, tc.height, X - fr.ax * sc, Y - fr.ay * sc, dw, dh);
    else g.drawImage(fr.c, fr.px, fr.py, fr.pw, fr.ph, X - fr.ax * sc, Y - fr.ay * sc, dw, dh);
  }
  function sprite(g, key, anim, dir, fi, X, Y, k, o) {
    const P = typeof key === 'string' ? need(key) : key; if (!P) return false;
    const F = frameOf(P, anim, dir); if (!F) return false;
    const fr = F.list[((fi % F.list.length) + F.list.length) % F.list.length];
    if (o && o.alpha != null) g.globalAlpha = o.alpha;
    blit(g, P, fr, X, Y, k, F.flip, o && o.tint);
    if (o && o.flash) { g.globalCompositeOperation = 'lighter'; g.globalAlpha = (o.alpha == null ? 1 : o.alpha) * o.flash; blit(g, P, fr, X, Y, k, F.flip); g.globalCompositeOperation = 'source-over'; }
    if (o && (o.alpha != null || o.flash)) g.globalAlpha = 1;
    return true;
  }
  // A sprite stretched by kk along the screen direction (ux, uy) (a door filling a wider opening).
  function stretchSprite(g, P, anim, dir, fi, X, Y, k, ux, uy, kk, alpha = 1) {
    const F = frameOf(P, anim, dir); if (!F) return false; const fr = F.list[fi % F.list.length], sc = k * P.sc, D = C.dpr, e = kk - 1, f = F.flip ? -1 : 1;
    const a = kk * f, b = (e * uy / ux) * f, c2 = 0, d2 = 1; void e; // stretch along u, verticals stay vertical
    g.setTransform(a * D, b * D, c2 * D, d2 * D, (X - a * X - c2 * Y) * D, (Y - b * X - d2 * Y) * D);
    if (alpha < 1) g.globalAlpha = alpha;
    g.drawImage(fr.c, fr.px, fr.py, fr.pw, fr.ph, X - fr.ax * sc, Y - fr.ay * sc, fr.w * sc, fr.h * sc);
    g.globalAlpha = 1; return true;
  }
  // The frame size on screen (for x-ray and labels).
  function frameRect(key, anim, dir, X, Y, k) { const P = need(key); if (!P) return null; const F = frameOf(P, anim, dir); if (!F) return null; const fr = F.list[0], sc = k * P.sc; const x0 = F.flip ? X - (fr.w - fr.ax) * sc : X - fr.ax * sc; return [x0, Y - fr.ay * sc, fr.w * sc, fr.h * sc]; }

  // fx atlas frames ([x, y, w, h, ax, ay]); additive where it glows
  const FX = { img: null };
  function fx(g, name, fi, X, Y, scale, o = {}) {
    if (!FX.img || !M) return; const F = M.fx[name]; if (!F) return; const fr = F.frames[Math.min(F.frames.length - 1, Math.max(0, fi | 0))]; if (!fr) return;
    const D = C.dpr, k = scale * C.s;
    if (o.rot || o.flip) { const c = Math.cos(o.rot || 0) * k * D, s2 = Math.sin(o.rot || 0) * k * D, fx2 = o.flip ? -1 : 1; g.setTransform(c * fx2, s2 * fx2, -s2, c, X * D, Y * D); }
    else g.setTransform(k * D, 0, 0, k * D, X * D, Y * D);
    if (o.alpha != null) g.globalAlpha = o.alpha; if (o.add) g.globalCompositeOperation = 'lighter';
    const T = F.toon && F.toon[F.frames.indexOf(fr)]; if (T) g.drawImage(T.c, -T.ax, -T.ay); else g.drawImage(FX.img, fr[0], fr[1], fr[2], fr[3], -fr[4], -fr[5], fr[2], fr[3]);
    if (o.add) g.globalCompositeOperation = 'source-over'; if (o.alpha != null) g.globalAlpha = 1;
  }
  // Cartoon blood and goo: the fx atlas' splats and spurts redrawn flat, bright and chunky with an ink edge.
  function toonFx() {
    for (const [name, col] of [['fx.blood.spurt', '#e8212c'], ['fx.decal.blood', '#d01a26'], ['fx.goo.spurt', '#8dff3a'], ['fx.decal.goo', '#7be82c']]) {
      const F = M.fx[name]; if (!F || F.toon) continue; F.toon = F.frames.map((fr) => {
        const p = 3, w = fr[2] + p * 2, h = fr[3] + p * 2, c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
        const m = document.createElement('canvas'); m.width = w; m.height = h; const mg = m.getContext('2d'); mg.drawImage(FX.img, fr[0], fr[1], fr[2], fr[3], p, p, fr[2], fr[3]);
        const d = mg.getImageData(0, 0, w, h), a = d.data; for (let i = 3; i < a.length; i += 4) a[i] = a[i] > 70 ? 255 : 0; mg.putImageData(d, 0, 0); // chunky: a hard edge
        for (const [dx, dy] of [[-2, 0], [2, 0], [0, -2], [0, 2], [-1, -1], [1, 1], [-1, 1], [1, -1]]) g.drawImage(m, dx, dy);
        g.globalCompositeOperation = 'source-in'; g.fillStyle = '#2a0c0c'; g.fillRect(0, 0, w, h); g.globalCompositeOperation = 'source-over';
        const b = document.createElement('canvas'); b.width = w; b.height = h; const bg = b.getContext('2d'); bg.drawImage(m, 0, 0); bg.globalCompositeOperation = 'source-in'; bg.fillStyle = col; bg.fillRect(0, 0, w, h);
        bg.globalCompositeOperation = 'source-atop'; bg.fillStyle = 'rgba(255,255,255,0.35)'; bg.beginPath(); bg.ellipse(w * 0.4, h * 0.35, w * 0.16, h * 0.1, -0.5, 0, TAU); bg.fill(); // a shine
        g.drawImage(b, 0, 0); return { c, ax: fr[4] + p, ay: fr[5] + p };
      });
    }
  }
  const fxLen = (name) => (M && M.fx[name] ? M.fx[name].frames.length : 1), fxFps = (name) => (M && M.fx[name] ? M.fx[name].fps || 12 : 12);

  // ---------------- ground: tile textures -> the area's floor, projected once ----------------
  const tex = new Map();
  // the wild realms' ground (our own procedural tiles, seamless: every speck is drawn wrapped)
  const PROC_TILE = {
    snow: ['#e9eff6', [['rgba(160,185,220,0.35)', 60, 3, 9], ['rgba(255,255,255,0.9)', 120, 1, 2], ['rgba(190,210,235,0.5)', 30, 6, 14]]],
    ash: ['#4c4547', [['rgba(25,20,20,0.55)', 160, 1, 3], ['rgba(110,100,98,0.35)', 60, 3, 8], ['rgba(255,110,40,0.6)', 8, 1, 2]]],
  };
  function procTile(name) {
    const D = PROC_TILE[name], c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'), rr = W().rng(W().hash('tile', name));
    x.fillStyle = D[0]; x.fillRect(0, 0, 128, 128);
    for (const [col, n, r0, r1] of D[1]) { x.fillStyle = col; for (let i = 0; i < n; i++) { const px = rr() * 128, py = rr() * 128, r = r0 + rr() * (r1 - r0); for (const ox of [-128, 0, 128]) for (const oy of [-128, 0, 128]) { x.beginPath(); x.ellipse(px + ox, py + oy, r, r * 0.7, 0, 0, TAU); x.fill(); } } }
    return c;
  }
  function tilePattern(g, name) {
    const id = keyOf('tile.' + name); if (!tex.has(id) && PROC_TILE[name]) tex.set(id, procTile(name)); if (tex.has(id)) return g.createPattern(tex.get(id), 'repeat');
    const P = packs.get(id), a = M && M.assets[id]; if (!a) return null;
    const N = 128, c = document.createElement('canvas'); c.width = c.height = N; const x = c.getContext('2d');
    // un-project the 128 x 64 diamond back into a square texture (slightly enlarged so the seams close)
    const fr = P && P.anims ? P.anims.static.rows.S[0] : null; if (!fr) return null;
    for (const e of [1.06, 1]) { x.setTransform(1, 0, 0, 1, 0, 0); x.translate(N / 2, N / 2); x.scale(e, e); x.translate(-N / 2, -N / 2); x.transform(N / 128, -N / 128, N / 64, N / 64, -N / 2, N / 2); x.drawImage(fr.c, fr.px, fr.py, fr.pw, fr.ph, fr.sx - a.rect[0], fr.sy - a.rect[1], fr.w, fr.h); }
    tex.set(id, c); return g.createPattern(c, 'repeat');
  }
  const LOT = { junkyard: 'gravel', suburb: 'grass', lot: 'asphalt2', gas: 'concrete', mall: 'paving', park: 'grass2', roof: 'paving', sewer: 'concrete', carnival: 'dirt', school: 'grass', docks: 'planks', landfill: 'dirt2', home: 'grass',
    farm: 'grass', fields: 'grass2', snow: 'snow', icelake: 'snow', lodge: 'snow', fortress: 'snow', ash: 'ash', lavafield: 'ash', crater: 'ash' };
  const E = 300; // the floor drawn around the area (outside the fence)
  // the flat floor in world units (roads, sidewalks, lots, paint, grime), textured; also the 3D drive's ground
  function topFor(area, r) {
    const Z = W(), AW = Z.AW, AH = Z.AH, TA = window.TZA;
    const td = document.createElement('canvas'); td.width = Math.ceil((AW + 2 * E) * r); td.height = Math.ceil((AH + 2 * E) * r);
    const g = td.getContext('2d'); g.scale(r, r); g.translate(E, E);
    const pat = (n) => { const p = tilePattern(g, n); if (p && p.setTransform && window.DOMMatrix) p.setTransform(new DOMMatrix().scale(80 / 128)); return p; };
    const lot = pat(LOT[area.biome.key] || 'grass') || area.biome.ground[0];
    g.fillStyle = lot; g.fillRect(-E, -E, AW + 2 * E, AH + 2 * E);
    TA.tex = { lot, road: pat('asphalt') || null, walk: pat('concrete') || null, parking: pat('asphalt2') || null, slab: pat('concrete') || null, plaza: pat('paving') || null, docks: pat('planks') || null, dirt: pat('dirt') || null };
    try { TA.drawArea(g, area, 1, { ground: true }); } finally { TA.tex = null; }
    // the world past the fence sinks into the dark
    g.fillStyle = 'rgba(8,7,6,0.55)'; for (const [x, y, w, h] of [[-E, -E, AW + 2 * E, E - 140], [-E, AH + 140, AW + 2 * E, E - 140], [-E, -140, E - 140, AH + 280], [AW + 140, -140, E - 140, AH + 280]]) g.fillRect(x, y, w, h);
    return td;
  }
  function groundFor(area, q) {
    const Z = W(), AW = Z.AW, AH = Z.AH, r = Math.min(1, q * 0.8 + 0.1), td = topFor(area, r);
    // 2) project it: the iso floor canvas (art px * q)
    const ix0 = isoX(-E, AH + E), iy0 = isoY(-E, -E), iw = isoX(AW + E, -E) - ix0, ih = isoY(AW + E, AH + E) - iy0;
    const c = document.createElement('canvas'); c.width = Math.ceil(iw * q); c.height = Math.ceil(ih * q);
    const x = c.getContext('2d'); x.fillStyle = '#0c0a08'; x.fillRect(0, 0, c.width, c.height);
    x.setTransform(HX * q / r, HY * q / r, -HX * q / r, HY * q / r, (-ix0 + isoX(-E, -E)) * q, (-iy0 + isoY(-E, -E)) * q);
    x.imageSmoothingQuality = 'high'; x.drawImage(td, 0, 0);
    // 3) the back fences (north + west edges) stand up behind everything else in the area
    x.setTransform(1, 0, 0, 1, 0, 0);
    const fence = need('prop.fence.metal'), ex = area.exits, SWk = Z.SW, k = q;
    if (fence) {
      const post = (wx, wy, dir) => { const X = (isoX(wx, wy) - ix0) * k, Y = (isoY(wx, wy) - iy0) * k; const F = frameOf(fence, 'static', dir); if (!F) return; const fr = F.list[0], sc = k * fence.sc; if (F.flip) { x.setTransform(-1, 0, 0, 1, 2 * X, 0); } else x.setTransform(1, 0, 0, 1, 0, 0); x.drawImage(fr.c, fr.px, fr.py, fr.pw, fr.ph, X - fr.ax * sc, Y - fr.ay * sc, fr.w * sc, fr.h * sc); };
      const gap = (road, v) => road && v > road.p - road.w / 2 - SWk && v < road.p + road.w / 2 + SWk;
      for (let v = 40; v < AW; v += 80) if (!gap(ex.n, v)) post(v, -6, 'SE');
      for (let v = 40; v < AH; v += 80) if (!gap(ex.w, v)) post(-6, v, 'NE');
      x.setTransform(1, 0, 0, 1, 0, 0);
    }
    td.width = td.height = 1;
    return { canvas: c, q, ix0, iy0, area };
  }

  // ---------------- standing scenery: buildings, props, the garage ----------------
  const BLD = { house: ['bld.house1', 'bld.house2', 'bld.house3', 'bld.house4'], tower: ['bld.kk.c', 'bld.kk.d', 'bld.kk.g', 'bld.kk.h', 'bld.office'], store: ['bld.kk.a', 'bld.kk.b', 'bld.kk.e'],
    mall: ['bld.warehouse', 'bld.office'], school: ['bld.kk.e', 'bld.office'], plant: ['bld.factory', 'bld.crucible'], warehouse: ['bld.warehouse', 'bld.factory'], shack: ['bld.shack'], kiosk: ['bld.shack', 'bld.kk.a'], tent: ['bld.shack'],
    barn: ['bld.barn'], cabin: ['bld.cabin'], lodge: ['bld.lodge'], volcano: ['bld.volcano'] };
  const PROP = { car: ['prop.car', 'prop.car2', 'prop.car3', 'prop.taxi', 'prop.police', 'prop.van'], wreck: ['prop.wreck', 'prop.wreck.burnt', 'prop.wreck.suv', 'prop.wreck2'], bus: ['prop.bus', 'prop.ambulance'], stack: ['prop.wreck2', 'prop.wreck.burnt'],
    container: ['prop.container', 'prop.container2'], tires: ['prop.tires', 'prop.tirepile'], trash: ['prop.trash', 'prop.bags2', 'prop.bags'], barrel: ['prop.barrel', 'prop.barrel.rusty', 'prop.barrel.explosive', 'prop.barrel.spilled'],
    fridge: ['prop.fridge'], bin: ['prop.bin', 'prop.bin2', 'prop.bin3'], hedge: ['prop.hedge', 'prop.bush'], tree: ['prop.tree', 'prop.tree2', 'prop.pine', 'prop.tree.dead'], mailbox: ['prop.hydrant'], cart: ['prop.cart'],
    barrier: ['prop.barrier.concrete', 'prop.barrier.striped', 'prop.barrier'], pump: ['prop.fridge'], crate: ['prop.crate', 'prop.boxes', 'prop.boxes2'], dumpster: ['prop.dumpster', 'prop.dumpster.open'], bench: ['prop.bench'],
    planter: ['prop.planter', 'prop.pot'], bush: ['prop.bush', 'prop.pot'], tank: ['prop.tank'], pipe: ['prop.pipe'], booth: ['prop.container', 'prop.couch'], balloons: ['prop.sign'], picnic: ['prop.bench'], rope: ['prop.tires'],
    bags: ['prop.bags', 'prop.bags2'], mound: ['prop.mound'], lamp: ['prop.lamp', 'prop.lamp2'], hydrant: ['prop.hydrant'],
    haybale: ['prop.haybale'], corn: ['prop.corn'], wheat: ['prop.wheat'], fencefarm: ['prop.fence.farm'], scarecrow: ['prop.scarecrow'], tractor: ['prop.tractor'], silo: ['prop.silo'],
    snowpine: ['prop.snowpine', 'prop.snowpine2'], snowpine2: ['prop.snowpine2', 'prop.snowpine'], snowrock: ['prop.snowrock'], logs: ['prop.logs'], tent: ['prop.tent'], campfire: ['prop.campfire'], icechunk: ['prop.icechunk'],
    lavarock: ['prop.lavarock'], basalt: ['prop.basalt'], vent: ['prop.vent'], charred: ['prop.deadtree.charred'] };
  const FREE = { tree: 1, lamp: 1, hydrant: 1, bush: 1.1, planter: 1, mailbox: 1, balloons: 1, hedge: 1.1, bin: 1, barrel: 1, tires: 1, rope: 1, bags: 1, trash: 1,
    haybale: 1.1, corn: 1.25, wheat: 1.1, scarecrow: 1, silo: 1, snowpine: 1, snowpine2: 1, snowrock: 1.1, logs: 1, campfire: 1, icechunk: 1, lavarock: 1.1, basalt: 1, vent: 1, charred: 1, tent: 1 }; // natural size, not fitted to the box
  const FLAT = { grate: 1, pond: 1, fountain: 1 };
  function standFor(area) {
    if (area._iso) return area._iso;
    const L = [];
    for (const o of area.obstacles.concat(area.soft || [])) {
      if (o.kind === 'wall' || FLAT[o.kind]) continue;
      const list = o.kind === 'bld' ? BLD[o.style] || BLD.house : PROP[o.kind]; if (!list) continue;
      const key = keyOf(list[(o.v || 0) % list.length]), a = M.assets[key]; if (!a) continue;
      const cx = o.x + o.w / 2, cy = o.y + o.h / 2, rows = a.anims.static ? Object.keys(a.anims.static.rows) : ['S'];
      const wm = o.w / 50, hm = o.h / 50, sz = a.size || [1, 1, 1];
      let row = rows[0], sc = 1;
      if (o.kind === 'bld') { // S: model x along world x; E: turned a quarter
        const fitS = Math.abs(Math.log((wm / hm) / (sz[0] / sz[2]))), fitE = Math.abs(Math.log((wm / hm) / (sz[2] / sz[0])));
        row = rows.includes('E') && fitE < fitS ? 'E' : 'S'; const fx = row === 'S' ? sz[0] : sz[2], fz = row === 'S' ? sz[2] : sz[0];
        sc = clamp(Math.sqrt((wm / fx) * (hm / fz)) * 1.04, 0.45, 1.3);
      } else if (rows.includes('SE')) { row = o.w >= o.h ? 'SE' : 'NE'; const L2 = Math.max(wm, hm), S2 = Math.min(wm, hm); sc = FREE[o.kind] ? ST * FREE[o.kind] : ST * clamp(Math.sqrt((L2 / Math.max(sz[0], sz[2])) * (S2 / Math.max(0.3, Math.min(sz[0], sz[2])))) * 1.1, 0.55, 1.25); }
      else sc = FREE[o.kind] ? ST * FREE[o.kind] : clamp(Math.sqrt((wm * hm) / Math.max(0.2, sz[0] * sz[2])) * 1.05, 0.6, 1.3);
      L.push({ k: 'obs', key, row, sc, x: cx, y: cy, depth: cx + cy, o, big: o.kind === 'bld' || (sz[1] * sc > 2.6) });
    }
    area._iso = L; return L;
  }
  // flat-shaded iso box (garage walls etc.): top + south (+y) + east (+x) faces
  function prism(g, x, y, w, h, H, col, o = {}) {
    setScreen(g); const p = (X, Y, Z) => C.toScreen(X, Y, Z);
    const quad = (a, b, c, d, f) => { g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.lineTo(c[0], c[1]); g.lineTo(d[0], d[1]); g.closePath(); g.fillStyle = f; g.fill(); };
    if (o.alpha != null) g.globalAlpha = o.alpha;
    quad(p(x, y + h, 0), p(x + w, y + h, 0), p(x + w, y + h, H), p(x, y + h, H), col[1]);
    quad(p(x + w, y, 0), p(x + w, y + h, 0), p(x + w, y + h, H), p(x + w, y, H), col[2]);
    quad(p(x, y, H), p(x + w, y, H), p(x + w, y + h, H), p(x, y + h, H), col[0]);
    if (o.trim) { g.strokeStyle = o.trim; g.lineWidth = Math.max(1, 2 * C.s); g.beginPath(); const a = p(x, y + h, H), b = p(x + w, y + h, H), c2 = p(x + w, y, H); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.lineTo(c2[0], c2[1]); g.stroke(); }
    if (o.alpha != null) g.globalAlpha = 1;
  }

  // ---------------- zombies: state from movement ----------------
  const BOSSKEY = { boss: 'boss.dumpster', truck: 'boss.truck', ratking: 'boss.ratking', sludge: 'boss.sludge', mascot: 'boss.mascot', spider: 'boss.spider', foghorn: 'boss.foghorn', toxic: 'boss.toxic', icecream: 'boss.icecream', compactor: 'boss.compactor', final: 'boss.final' };
  const BOSSCOL = { boss: '#7dff6a', spider: '#e6ecff', foghorn: '#ffb02e', toxic: '#b6ff3a', final: '#ff3a3a', icecream: '#ff9ad5', compactor: '#9aa8b4', truck: '#7fd6ff', ratking: '#ffd0c8', sludge: '#5aff6a', mascot: '#ffd23f' };
  const zKey = (z) => (z.fb || z.mb ? BOSSKEY[z.fb || z.mb] || 'boss.final' : z.type === 'boss' ? 'boss.dumpster' : BOSSKEY[z.type] && W().ZOMBIES[z.type] && W().ZOMBIES[z.type].boss ? BOSSKEY[z.type] : 'zombie.' + z.type);
  function zState(z, dt, tg) {
    let A = z._ia;
    if (!A) A = z._ia = { px: z.x, py: z.y, vx: 0, vy: 0, dir: dirOf(z.face >= 0 ? 1 : -1, 0.3), an: 'walk', ft: (z.id * 0.37) % 2, hit: 0, lf: 0 };
    if (dt > 0) { const dx = z.x - A.px, dy = z.y - A.py, k = Math.min(1, dt * 8); A.vx += (dx / dt - A.vx) * k; A.vy += (dy / dt - A.vy) * k; }
    A.px = z.x; A.py = z.y;
    const sp = Math.hypot(A.vx, A.vy), d = tg ? Math.hypot(tg.x - z.x, tg.y - z.y) : 1e9, atk = tg && d < z.r + (z.boss ? 70 : 44);
    if (atk) A.dir = dirOf(tg.x - z.x, tg.y - z.y); else if (sp > 10) A.dir = dirOf(A.vx, A.vy);
    if (z.flash > 0.05 && A.lf <= 0 && (z.mhp > 60 || z.boss)) A.hit = 0.28; A.lf = z.flash;
    if (A.hit > 0) A.hit -= dt;
    const an = A.hit > 0 ? 'hit' : atk ? 'attack' : sp > 12 ? (sp > 105 ? 'run' : 'walk') : 'idle';
    if (an !== A.an) { A.an = an; A.ft = an === 'walk' || an === 'run' ? A.ft : 0; }
    // feet planted: the walk / run cycle advances with the distance covered (one cycle = STRIDE world units)
    const rate = an === 'walk' || an === 'run' ? clamp(sp / (an === 'run' ? 125 : 70) * (z.boss || z.fb || z.mb ? 0.75 : 1), 0.35, 2.2) : an === 'idle' ? 0 : 1;
    A.ft += dt * rate; z._dir = A.dir;
    return A;
  }
  function animFrame(P, an, ft) { const A = P.anims[an] || P.anims.walk || P.anims.idle || P.anims.static; if (!A) return 0; const f = Math.floor(ft * A.fps); return A.loop ? f % A.n : Math.min(A.n - 1, f); }
  const animName = (P, an) => (P.anims[an] ? an : an === 'run' ? 'walk' : an === 'idle' ? (P.anims.walk ? 'walk' : 'static') : P.anims.walk ? 'walk' : Object.keys(P.anims)[0]);

  // ---------------- the frame ----------------
  const VEH = { cart: 'vehicle.cart', mower: 'vehicle.ridemower', push: 'vehicle.mower', gtruck: 'vehicle.garbagetruck', tank: 'vehicle.tank', gunship: 'heli.gunship', jetpack: 'fly.jetpack', glider: 'fly.glider' };
  const HELI_K = 0.8; // the helicopters' size in the scene (art px per art px)
  const SURV = ['survivor.lis', 'survivor.matt', 'survivor.sam', 'survivor.shaun'];
  const PLACE = { market: 'bld.market', armor: 'bld.surplus', clinic: 'bld.clinic', tinker: 'bld.gun1', gunsmith: 'bld.gun2', master: 'bld.gun3', forge: 'bld.crucible', camper: 'vehicle.camper' };
  const hashS = (s) => { let h = 7; for (let i = 0; i < String(s).length; i++) h = (h * 31 + String(s).charCodeAt(i)) | 0; return Math.abs(h); };
  let LC = null, VIG = null;
  function vignette(w, h) {
    if (VIG && VIG.w === w && VIG.h === h) return VIG.c;
    const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w / 2)); c.height = Math.max(1, Math.round(h / 2)); const g = c.getContext('2d');
    const gr = g.createRadialGradient(c.width / 2, c.height / 2, Math.min(c.width, c.height) * 0.35, c.width / 2, c.height / 2, Math.hypot(c.width, c.height) * 0.6); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.55)'); g.fillStyle = gr; g.fillRect(0, 0, c.width, c.height);
    VIG = { w, h, c }; return c;
  }
  const TODS = { night: { dark: 0.74, tint: 'rgba(30,50,110,0.16)', col: '4,6,16' }, dusk: { dark: 0.3, tint: 'rgba(255,120,50,0.12)', col: '40,14,30' }, overcast: { dark: 0.16, tint: 'rgba(90,105,125,0.1)', col: '20,24,32' } };
  // The gun in your hands: a timed super weapon, else your strongest ranged weapon, else the pistol.
  // g = where the back hand grips (0 = the stock end, 1 = the muzzle), f = the front hand (two-handed guns),
  // y = the barrel line (0 = top of the art, 1 = bottom), k = size.
  const GUNS = { 'weapon.pistol': { g: 0.3, y: 0.4, k: 0.82 }, 'pickup.raygun': { g: 0.3, y: 0.4, k: 0.85 }, 'weapon.nailgun': { g: 0.3, y: 0.42, k: 0.85 },
    'weapon.smg': { g: 0.32, f: 0.62, y: 0.38, k: 0.85 }, 'weapon.shotgun': { g: 0.26, f: 0.6, y: 0.38, k: 0.95 }, 'weapon.rail': { g: 0.24, f: 0.58, y: 0.38, k: 0.9 },
    'weapon.rifle': { g: 0.3, f: 0.62, y: 0.38, k: 0.95 }, 'weapon.launcher': { g: 0.3, f: 0.62, y: 0.42, k: 0.95 }, 'pickup.minigun': { g: 0.34, f: 0.6, y: 0.45, k: 1 },
    'pickup.rockets': { g: 0.34, f: 0.62, y: 0.42, k: 0.9 }, 'weapon.crossbow': { g: 0.24, f: 0.56, y: 0.45, k: 0.95 }, 'weapon.flamer': { g: 0.3, f: 0.62, y: 0.42, k: 0.95 },
    'weapon.blower': { g: 0.3, f: 0.6, y: 0.45, k: 0.95 }, 'weapon.coil': { g: 0.3, f: 0.6, y: 0.42, k: 0.95 } };
  const HELD = ['rail', 'launcher', 'shotgun', 'flamer', 'coil', 'crossbow', 'smg', 'blower', 'nailgun'];
  function GUN(sim) {
    const B = sim.buffs; sim._heldW = null; if (B.minigun > 0) return 'pickup.minigun'; if (B.raygun > 0) return 'pickup.raygun'; if (B.rockets > 0) return 'pickup.rockets';
    let best = null, bs = -1; for (const w of sim.weapons || []) { const i = HELD.indexOf(w.id); if (i < 0) continue; const sc = (w.tier || 1) * 100 + (w.lv || 1) * 10 - i; if (sc > bs) { bs = sc; best = w.id; } }
    const key = best ? 'weapon.' + best : 'weapon.pistol', ok = !!need(key); sim._heldW = ok && best ? best : null; return ok ? key : 'weapon.pistol';
  }
  let SKIN = null;
  function skinOf(sim) {
    if (SKIN && SKIN.id === (sim.me && sim.me.id)) return SKIN.c; let c = '#f3c9a0';
    try { const L2 = window.BOX && BOX.lookOf && sim.me ? BOX.lookOf({ id: sim.me.id, name: sim.me.name, bot: true }) : null, v = L2 && L2.look && L2.look.skin, O = window.MT_OPTIONS; if (typeof v === 'string' && v[0] === '#') c = v; else if (v != null && O && O.skins && O.skins[v]) c = O.skins[v]; } catch (e) { /* the default */ }
    SKIN = { id: sim.me && sim.me.id, c }; return c;
  }

  function render(g, sim, V) {
    if (!st.ready) return false;
    const Z = W(), TA = window.TZA, TS = window.TZSim, P = sim.p, hi = V.hi !== false, t = sim.t, AW = Z.AW, AH = Z.AH;
    sim._iso = true;
    // ---- CAMERA (hard rule) ----------------------------------------------------------------
    // Centred on the hero, NO look-ahead. The amount of world on screen stays what the owner chose
    // for the old top-down view: V.k = min(w, h) / 500 screen px per world unit there. The iso
    // projection shows a world square at 0.8 x 0.4 x 2 = 0.64 of its top-down area, so drawing
    // art px at s = V.k / 0.8 keeps the visible ground area the same (not closer, not further).
    // The owner then asked for a little more world: ZOOM_OUT (8%) further out than that. Never closer.
    const s = V.k / 0.8 / ZOOM_OUT;
    const intro = sim.phase === 'intro', G = sim.area.garage;
    let fx0 = P.x, fy0 = P.y; if (intro && G) { fx0 = G.x + G.w / 2; fy0 = Math.max(G.y + G.h * 0.7, P.y - 20); }
    const sh = sim.shake > 0 ? sim.shake * 22 * V.k : 0;
    // (up in the air: a gunship, a glider, the helicopter: the camera looks at the ride, up where it flies)
    const fr0 = sim.flying && sim.flying(), hp0 = sim.heliPose && sim.heliPose(), camAlt = fr0 && fr0.kind !== 'jetpack' ? fr0.alt || 0 : hp0 ? (hp0.inside ? hp0.alt : hp0.heroAlt || 0) : sim.jetAlt ? sim.jetAlt() * 0.7 : 0;
    Object.assign(C, { s, k: V.k, dpr: V.dpr, w: V.w, h: V.h, cx: isoX(fx0, fy0), cy: isoY(fx0, fy0) - 34 - camAlt * HZ * 0.8, sx: sh ? (Math.random() - 0.5) * sh : 0, sy: sh ? (Math.random() - 0.5) * sh : 0 });
    sim.cam = C; TZI.cam = C;
    const dt = Math.min(0.1, Math.max(0, t - (sim._isoT == null ? t : sim._isoT))); sim._isoT = t;
    const hw = V.w / 2 / s + 60, hh = V.h / 2 / s + 60;
    const vis = (x, y, m = 120) => { const ix = isoX(x, y) - C.cx, iy = isoY(x, y) - C.cy; return ix > -hw - m && ix < hw + m && iy > -hh - m * 0.6 && iy < hh + m * 1.6; };
    // ---- the floor ----
    setScreen(g); g.fillStyle = '#0c0a08'; g.fillRect(0, 0, V.w, V.h);
    const q = hi ? Math.min(1.1, Math.max(0.55, s * V.dpr * 0.85)) : Math.min(0.6, Math.max(0.4, s * V.dpr * 0.5));
    if (!sim._isoBg || sim._isoBg.area !== sim.area || Math.abs(sim._isoBg.q - q) > 0.2) sim._isoBg = groundFor(sim.area, q);
    const B = sim._isoBg, bx = (C.cx - V.w / 2 / s - B.ix0) * B.q, by = (C.cy - V.h / 2 / s - B.iy0) * B.q;
    g.imageSmoothingEnabled = true;
    { const sx0 = Math.max(0, bx), sy0 = Math.max(0, by), sw = Math.min(B.canvas.width - sx0, V.w / s * B.q), shh = Math.min(B.canvas.height - sy0, V.h / s * B.q); if (sw > 0 && shh > 0) g.drawImage(B.canvas, sx0, sy0, sw, shh, (sx0 - bx) / B.q * s + C.sx, (sy0 - by) / B.q * s + C.sy, sw / B.q * s, shh / B.q * s); }
    // ---- on the ground: grime, gates, the yard, coins, puddles ----
    setGround(g);
    for (const d of sim.decals) {
      if (!vis(d.x, d.y)) continue; const a = Math.min(1, (d.life - d.t) / 3) * (d.a || 0.9); if (a <= 0) continue;
      const name = d.k === 'goo' ? 'fx.decal.goo' : d.k === 'scorch' ? 'fx.scorch' : 'fx.decal.blood', F = M.fx[name]; if (!F || !FX.img) continue;
      const fr = F.frames[(d.i || 0) % F.frames.length], sc = (d.s || 1) * (d.k === 'scorch' ? 0.9 : 0.75);
      g.save(); g.translate(d.x, d.y); g.rotate(d.rot || 0); g.globalAlpha = a; const T = F.toon && F.toon[(d.i || 0) % F.frames.length]; if (T) g.drawImage(T.c, -T.ax * sc, -T.ay * sc, T.c.width * sc, T.c.height * sc); else g.drawImage(FX.img, fr[0], fr[1], fr[2], fr[3], -fr[4] * sc, -fr[5] * sc, fr[2] * sc, fr[3] * sc); g.restore();
    }
    g.globalAlpha = 1;
    const e = sim.area.exits, gates = [];
    for (const [d, road] of Object.entries(e)) {
      if (!road) continue;
      const x = d === 'w' ? 0 : d === 'e' ? AW : road.p, y = d === 'n' ? 0 : d === 's' ? AH : road.p;
      const gi = sim.gateInfo ? sim.gateInfo(d) : null;
      if (gi) { gates.push({ d, gi, road, x, y }); continue; }
      if (sim.cleared) {
        const pulse = 0.55 + 0.35 * Math.sin(t * 6), dir = { n: -Math.PI / 2, s: Math.PI / 2, w: Math.PI, e: 0 }[d];
        g.save(); g.translate(x, y); g.rotate(dir); g.globalAlpha = pulse; g.fillStyle = '#9cff5a'; g.beginPath(); g.moveTo(-110, -30); g.lineTo(-60, -30); g.lineTo(-60, -56); g.lineTo(-10, 0); g.lineTo(-60, 56); g.lineTo(-60, 30); g.lineTo(-110, 30); g.closePath(); g.fill(); g.lineWidth = 3; g.strokeStyle = 'rgba(20,50,10,0.8)'; g.stroke(); g.restore();
      } else gates.push({ d, gi: null, road, x, y });
    }
    if (sim.drawExtraGround) sim.drawExtraGround(g, t, vis);
    const pad = sim.padHere && sim.padHere(); if (pad && vis(pad.x, pad.y, 300)) drawPad(g, sim, pad, t);
    if (sim.area.hazards && sim.area.hazards.length) drawHazards(g, sim, t);
    setGround(g);
    for (const c of sim.coins || []) if (vis(c.x, c.y)) { g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(c.x + 3, c.y + 4, 8, 8, 0, 0, TAU); g.fill(); }
    // ---- the fallen: their death animation, then the body lingers and fades ----
    for (const c of sim.corpses) {
      if (!vis(c.x, c.y, 160)) continue; const key = c.key || (c.boss ? BOSSKEY[c.boss] || 'boss.final' : 'zombie.' + c.type), Pk = need(key); if (!Pk || !Pk.anims.death) continue;
      const D = Pk.anims.death, fi = Math.min(D.n - 1, Math.floor(c.t * D.fps)), fade = Math.min(1, (c.life - c.t) / 1.2);
      const [X, Y] = C.toScreen(c.x, c.y); sprite(g, Pk, 'death', c.dir || 'S', fi, X, Y, s * (c.boss ? 1 : CH), { alpha: Math.max(0, fade) });
    }
    // ---- pickups, gems, cash, drops: spinning art with a glow ----
    const spin = (key, x, y, k, bob = 4, glow) => { const [X, Y] = C.toScreen(x, y); if (glow) { setScreen(g); const R = 34 * s * k; const gr = g.createRadialGradient(X, Y - 10 * s, 1, X, Y - 10 * s, R); gr.addColorStop(0, glow); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.globalCompositeOperation = 'lighter'; g.fillStyle = gr; g.fillRect(X - R, Y - 10 * s - R, R * 2, R * 2); g.globalCompositeOperation = 'source-over'; } sprite(g, key, 'spin', 'S', Math.floor(t * 10 + x * 0.01), X, Y - (Math.sin(t * 4 + x) * bob + bob) * s, s * k); };
    for (const q2 of sim.gems) if (vis(q2.x, q2.y)) spin(q2.v >= 3 ? 'pickup.xp.pink' : q2.v >= 2 ? 'pickup.xp.green' : 'pickup.xp', q2.x, q2.y, 0.7, 3);
    for (const c of sim.coins || []) if (vis(c.x, c.y)) spin('pickup.coins', c.x, c.y, 0.55, 2);
    for (const p of sim.pk) if (vis(p.x, p.y)) { const Pk = Z.PK[p.k]; g.globalAlpha = p.life < 4 ? (Math.sin(t * 16) > 0 ? 1 : 0.35) : 1; spin(p.k === 'jetpack' ? 'fly.jetpack' : 'pickup.' + p.k, p.x, p.y, p.k === 'jetpack' ? 1.4 : 1.15, 5, Pk ? hexA(Pk.color, 0.55) : null); g.globalAlpha = 1; }
    for (const d of sim.drops || []) if (vis(d.x, d.y)) spin(d.k === 'core' ? 'pickup.core' : 'pickup.ammo.crate', d.x, d.y, 1.1, 5, d.k === 'core' ? 'rgba(255,110,40,0.6)' : 'rgba(127,214,255,0.55)');
    if (sim.mapItem) spin('pickup.map', sim.mapItem.x, sim.mapItem.y, 1.3, 5, 'rgba(255,220,120,0.6)');
    // ---- everything that stands, sorted by depth (x + y) ----
    const list = sim._isoList || (sim._isoList = []); list.length = 0;
    const tg = sim.dead ? null : P;
    for (const z of sim.z) { if (!(z.hp > 0 || sim.mode === 'guest')) continue; if (!vis(z.x, z.y, 240)) { if (z._ia) { z._ia.px = z.x; z._ia.py = z.y; } continue; } list.push(z); z._d = z.x + z.y; }
    P._d = P.x + P.y; list.push(P);
    for (const o of sim.others.values()) { o._d = o.x + o.y; list.push(o); }
    if (sim.raccoon && sim.S.raccoon) { sim.raccoon._d = sim.raccoon.x + sim.raccoon.y; list.push(sim.raccoon); }
    for (const S2 of standFor(sim.area)) if (vis(S2.x, S2.y, S2.big ? 600 : 260)) { S2._d = S2.depth; list.push(S2); }
    if (G) for (const part of garageParts(sim.area)) { part._d = part.depth; list.push(part); }
    if (sim.story && window.TZB && sim.isDoorCell && sim.isDoorCell() && sim.area.spot) { const S3 = sim.area.spot, bd = sim._ibd || (sim._ibd = { k: 'bossDoor' }); bd.x = S3.x + S3.w / 2; bd.y = S3.y + S3.h; bd._d = bd.x + bd.y - 40; list.push(bd); }
    for (const gt of gates) { gt.k = 'gate'; gt._d = gt.x + gt.y + 1; list.push(gt); }
    const ext = sim._isoExt || (sim._isoExt = []); ext.length = 0;
    if (sim.extraStanding) sim.extraStanding(ext);
    for (const q2 of ext) { if (q2.x == null) q2.x = P.x; q2._d = q2.x + q2.y + (q2.dz || 0); list.push(q2); }
    // big boxes (buildings, the garage): whoever is really in front of one draws after it
    for (const B of list) { const o = B.k === 'obs' && B.big ? B.o : B.front ? sim.area.garage : null; if (!o) continue;
      for (const it of list) { if (!(it === P || it.hp != null || it.tx != null)) continue; if (it.x < o.x - 320 || it.x > o.x + o.w + 320 || it.y < o.y - 320 || it.y > o.y + o.h + 320) continue;
        const front = it.x >= o.x + o.w || it.y >= o.y + o.h; if (front && it._d <= B._d) it._d = B._d + 0.01; else if (!front && it._d >= B._d) it._d = B._d - 0.01; } }
    list.sort((a, b) => a._d - b._d);
    const frozen = sim.buffs.freeze > 0 || sim.remoteFreeze > 0;
    const heroSx = C.toScreen(P.x, P.y);
    for (const q2 of list) {
      if (q2 === P) { drawYou(g, sim, V); continue; }
      if (q2 === sim.raccoon) { setBill(g, q2.x, q2.y); TS._drawRaccoon ? TS._drawRaccoon(g, q2, t) : null; continue; }
      if (q2.k === 'obs') { drawObs(g, sim, q2, heroSx); continue; }
      if (q2.k === 'garage') { q2.draw(g, sim, t); continue; }
      if (q2.k === 'gate') { drawGate(g, sim, q2, t); continue; }
      if (q2.k === 'bossDoor') { setBill(g, q2.x, q2.y); TZB.drawDoor(g, sim.story.plan.doorLook, !!sim.story.doorOpen, t, sim.story.keys >= 3, sim.area.spot); continue; }
      if (q2.k) { if (drawExtra(g, sim, q2, t)) continue; }
      if (q2.draw) { setBill(g, q2.x, q2.y); q2.draw(g, t); continue; }
      if (q2.tx != null && q2.ti == null && q2.id && sim.others.has(q2.id)) { drawOther(g, sim, q2, V); continue; }
      drawZombie(g, sim, q2, t, dt, tg, frozen);
    }
    // ---- in the air: shots, spit, weapons' moving parts, effects ----
    setGround(g, SHOT_H);
    if (sim.drawExtraAir) sim.drawExtraAir(g, t, vis);
    drawShots(g, sim, hi);
    setGround(g, SHOT_H);
    if (sim.drawBullets) sim.drawBullets(g, t);
    if (sim.ghost.length) { g.strokeStyle = 'rgba(170,240,255,0.85)'; g.lineWidth = 3; g.beginPath(); for (const b of sim.ghost) { g.moveTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02); g.lineTo(b.x, b.y); } g.stroke(); }
    setGround(g, 34);
    for (const sp of sim.spit) { g.fillStyle = sp.col || (sp.big ? '#c8ff4a' : '#a6e83a'); g.beginPath(); g.arc(sp.x, sp.y, sp.big ? 12 : 8, 0, TAU); g.fill(); g.fillStyle = 'rgba(255,255,200,0.6)'; g.beginPath(); g.arc(sp.x - 3, sp.y - 3, 3, 0, TAU); g.fill(); }
    drawFx(g, sim, t, hi);
    // muzzle flash at the gun's tip
    if (sim.muzzle > 0 && !sim.dead && !sim.ride && sim._gunTip) { const [mx, my, ma] = sim._gunTip; fx(g, 'fx.muzzle', Math.floor(t * 60) % fxLen('fx.muzzle'), mx, my, Math.sin(ma) < -0.35 ? 0.28 : 0.4, { rot: ma, add: true, alpha: Math.sin(ma) < -0.35 ? 0.6 : 1 }); }
    if (sim._dbgHit) drawHitDebug(g, sim);
    // ---------------- light, weather, mood (screen space) ----------------
    setScreen(g);
    if (sim.drawBiomeSky) sim.drawBiomeSky(g, V, t, C); // snowfall, the blizzard, ash
    mood(g, sim, V, t, hi, intro);
    return true;
  }
  function hexA(hex, a) { const h = String(hex || '#ffffff').replace('#', ''); const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; }

  // ---------------- bodies, shots and hit points ----------------
  // How big a zombie / boss is drawn (art px per art px) and its body in world units: h = top of the
  // head above the feet, w = chest width (screen px at s = 1). Bodies are measured from the art (pack()).
  // A body drawn narrower than its collision ring is drawn up to 15% bigger (bosses 50%), so shots never connect in the air beside it.
  const zBase = (z) => ((z.boss || z.fb || z.mb) ? 1 : CH) * (z.elite ? 1.08 : 1);
  function zScale(z) { if (z._fit == null) { const P = need(zKey(z)); if (!P || !P.body) return zBase(z); z._fit = clamp((2 * z.r * 1.131) / (P.body.w * zBase(z) * P.sc), 1, z.boss || z.fb || z.mb ? 1.5 : 1.15); } return zBase(z) * z._fit; }
  function bodyOf(z) { const P = need(zKey(z)); if (!P || !P.body) return null; const k = zScale(z) * P.sc; return { h: P.body.h * k / HZ, w: P.body.w * k, k }; }
  const chestH = (z) => { const B = bodyOf(z); return B ? B.h * 0.55 : SHOT_H; };
  // The point a shot meets a zombie, on screen: the edge of its collision circle facing the shot, at
  // chest height. TZI.hitPoint is what the debug overlay and the tests check against the drawn body.
  function hitPoint(z, ang, br = 6) { const r = z.r + br; return C.toScreen(z.x - Math.cos(ang) * r, z.y - Math.sin(ang) * r, chestH(z)); }
  function bodyBox(z) { const P = need(zKey(z)); if (!P || !P.body) return null; const [X, Y] = C.toScreen(z.x, z.y), k = C.s * zScale(z) * P.sc, w = Math.max(P.body.w, P.body.h * 0.45) * k; return [X - w / 2, Y - P.body.h * k, w, P.body.h * k]; }
  // the height a shot flies at: chest height, easing to the chest of the zombie just ahead of it
  function shotH(sim, b) {
    let best = 1e9, zb = null; const Z = sim.z;
    for (let i = 0; i < Z.length; i++) { const z = Z[i]; if (z.hp <= 0) continue; const dx = z.x - b.x, dy = z.y - b.y, d = dx * dx + dy * dy; if (d < best) { best = d; zb = z; } }
    if (!zb || best > 200 * 200) return SHOT_H;
    const u = clamp(1 - (Math.sqrt(best) - zb.r) / 130, 0, 1), e = u * u * (3 - 2 * u); return SHOT_H + (chestH(zb) - SHOT_H) * e;
  }
  // tracers: from the barrel tip (they start where the gun is and blend onto their true line), at chest height
  function drawShots(g, sim, hi) {
    const s = C.s, D = C.dpr, P = sim.p, tip = sim._gunTip, list = sim.b; if (!list.length) return;
    g.setTransform(D, 0, 0, D, 0, 0); g.lineCap = 'round';
    const seg = [];
    for (const b of list) {
      if (b.kind) continue;
      const sp = Math.hypot(b.vx, b.vy) || 1;
      if (b._t0 == null) { b._t0 = sim.t; b._ox = 0; b._oy = 0; if (tip && !b.drone && (b.x - P.x) * (b.x - P.x) + (b.y - P.y) * (b.y - P.y) < 110 * 110) { const [X0, Y0] = C.toScreen(b.x, b.y, SHOT_H); b._ox = (tip[0] - X0) / s; b._oy = (tip[1] - Y0) / s; } }
      const run = (sim.t - b._t0) * sp, h = hi ? shotH(sim, b) : SHOT_H, f1 = Math.max(0, 1 - run / 170), tl = Math.min(run, sp * 0.022), f0 = Math.max(0, 1 - (run - tl) / 170);
      const [X1, Y1] = C.toScreen(b.x, b.y, h), [X0, Y0] = C.toScreen(b.x - (b.vx / sp) * tl, b.y - (b.vy / sp) * tl, h);
      seg.push(X0 + b._ox * f0 * s, Y0 + b._oy * f0 * s, X1 + b._ox * f1 * s, Y1 + b._oy * f1 * s, b.crit ? 1 : 0);
    }
    const pass = (col, w, only) => { g.strokeStyle = col; g.lineWidth = w; g.beginPath(); for (let i = 0; i < seg.length; i += 5) { if (only && !seg[i + 4]) continue; g.moveTo(seg[i], seg[i + 1]); g.lineTo(seg[i + 2], seg[i + 3]); } g.stroke(); };
    g.globalCompositeOperation = 'lighter'; pass('rgba(255,170,60,0.35)', Math.max(3, 7 * s)); g.globalCompositeOperation = 'source-over';
    pass('#fff6d0', Math.max(1.5, 2.6 * s)); if (seg.some((v, i) => i % 5 === 4 && v)) pass('#ff6a3c', Math.max(2, 4 * s), true);
  }
  // debug overlay (TZ_DEBUG.hitbox(true)): each zombie's measured body box, its collision ring at chest
  // height and the point a shot from you would land
  function drawHitDebug(g, sim) {
    setScreen(g); g.lineWidth = 1.5;
    for (const z of sim.z) { if (z.hp <= 0) continue; const B = bodyBox(z); if (!B) continue; g.strokeStyle = 'rgba(0,255,255,0.9)'; g.strokeRect(B[0], B[1], B[2], B[3]);
      const H = chestH(z); g.strokeStyle = 'rgba(255,0,255,0.9)'; g.beginPath(); for (let i = 0; i <= 24; i++) { const a = (i / 24) * TAU, [X, Y] = C.toScreen(z.x + Math.cos(a) * z.r, z.y + Math.sin(a) * z.r, H); if (i) g.lineTo(X, Y); else g.moveTo(X, Y); } g.stroke();
      const [hx, hy] = hitPoint(z, Math.atan2(z.y - sim.p.y, z.x - sim.p.x)); g.fillStyle = '#ff0'; g.fillRect(hx - 3, hy - 3, 6, 6); }
  }
  // a zombie / boss: animated sprite, elite glow, debuff aura, hit flash, health bar
  function drawZombie(g, sim, z, t, dt, tg, frozen) {
    const s = C.s, Zd = W().ZOMBIES[z.type] || {}, key = zKey(z), Pk = need(key), boss = !!(z.boss || z.fb || z.mb);
    const [X, Y] = C.toScreen(z.x, z.y), k = s * zScale(z);
    if (!Pk) { setBill(g, z.x, z.y); if (z.fb || z.mb) { if (window.TZB) TZB.drawBoss(g, z, t); } else { const kp = Math.max(0.2, Math.round(s * BB * C.dpr * 10) / 10), spr = window.TZA.zombie(z.type, Math.floor(z.f) % 4, kp, z.flash > 0, z.id % 5); g.save(); g.translate(z.x, z.y); if (z.face < 0) g.scale(-1, 1); g.drawImage(spr, -spr.ox, -spr.oy, spr.width / kp, spr.height / kp); g.restore(); } return; }
    const A = zState(z, frozen ? 0 : dt, tg && !(tg.ride && false) ? tg : null);
    const static1 = !!Pk.anims.static, an = static1 ? (Math.hypot(A.vx, A.vy) > 12 && Pk.anims.drive ? 'drive' : 'static') : animName(Pk, A.an);
    const fi = static1 ? Math.floor(t * 12) : animFrame(Pk, an, A.ft);
    setScreen(g);
    if (z.elite) { const R = z.r * 2.4 * s; const gr = g.createRadialGradient(X, Y, 1, X, Y, R); gr.addColorStop(0, hexA(z.elite, 0.32 + 0.1 * Math.sin(t * 6 + z.id))); gr.addColorStop(1, hexA(z.elite, 0)); g.globalCompositeOperation = 'lighter'; g.fillStyle = gr; g.save(); g.translate(X, Y); g.scale(1, 0.5); g.translate(-X, -Y); g.fillRect(X - R, Y - R, R * 2, R * 2); g.restore(); g.globalCompositeOperation = 'source-over'; }
    if (Zd.aura) { g.globalAlpha = 0.16 + 0.08 * Math.sin(t * 5 + z.id); g.fillStyle = Zd.aura; g.beginPath(); g.ellipse(X, Y - Pk.h * k * 0.45, z.r * 1.3 * s, Pk.h * k * 0.55, 0, 0, TAU); g.fill(); g.globalAlpha = 1; }
    // a boss stands in its own coloured ring (its signature), which flares while it winds up an attack
    if (boss) { const bc = BOSSCOL[z.fb || z.mb || z.type] || '#ff4a3a', hot = A.an === 'attack' ? 1 : 0; setGround(g); g.globalAlpha = 0.35 + 0.15 * Math.sin(t * 4 + z.id) + hot * 0.4; g.strokeStyle = bc; g.lineWidth = 7 + hot * 5; g.beginPath(); g.ellipse(z.x, z.y, z.r * (1.15 + hot * 0.15), z.r * (1.15 + hot * 0.15), 0, 0, TAU); g.stroke(); g.globalAlpha = 0.14 + hot * 0.12; g.fillStyle = bc; g.fill(); g.globalAlpha = 1; setScreen(g); }
    const bob = static1 ? Math.sin(t * 9 + z.id) * 1.2 * s : 0;
    // tall corn hides a zombie standing in it (until it's close to you)
    let za = z.alpha != null ? z.alpha : undefined; if (sim.area.soft && sim.area.soft.length && !boss && sim.inCorn && sim.inCorn(z) && (z.x - sim.p.x) * (z.x - sim.p.x) + (z.y - sim.p.y) * (z.y - sim.p.y) > 150 * 150) za = (za == null ? 1 : za) * 0.28;
    if (z.variant === 'ember') { setScreen(g); g.globalCompositeOperation = 'lighter'; const R2 = z.r * 1.8 * s, gr = g.createRadialGradient(X, Y - 20 * s, 1, X, Y - 20 * s, R2); gr.addColorStop(0, 'rgba(255,120,30,0.35)'); gr.addColorStop(1, 'rgba(255,60,0,0)'); g.fillStyle = gr; g.fillRect(X - R2, Y - 20 * s - R2, R2 * 2, R2 * 2); g.globalCompositeOperation = 'source-over'; }
    sprite(g, Pk, an, A.dir, fi, X, Y + bob, k, { alpha: za, flash: z.flash > 0 ? 0.85 : 0, tint: z.variant });
    setScreen(g);
    if (z.elite) { g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.18 + 0.08 * Math.sin(t * 8); g.strokeStyle = z.elite; g.lineWidth = 2 * s; g.beginPath(); g.ellipse(X, Y - Pk.h * k * 0.5, z.r * 1.2 * s, Pk.h * k * 0.6, 0, 0, TAU); g.stroke(); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; }
    if (frozen) { g.fillStyle = 'rgba(170,230,255,0.38)'; g.beginPath(); g.ellipse(X, Y - Pk.h * k * 0.45, z.r * 1.2 * s, Pk.h * k * 0.55, 0, 0, TAU); g.fill(); }
    const top = Y - Pk.h * k - 8 * s;
    if (Zd.aura && window.TZR) { const D = TZR.DEBUFFS[Zd.debuff]; if (D) { const iy = top - 10 * s, ir = 11 * s; g.fillStyle = 'rgba(15,10,6,0.72)'; g.beginPath(); g.arc(X, iy, ir, 0, TAU); g.fill(); g.lineWidth = Math.max(1.5, 2 * s); g.strokeStyle = Zd.aura; g.stroke(); g.font = `${Math.round(15 * s)}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff'; g.fillText(D.icon, X, iy + s); } } // (a chip in its colour: the debuff it gives, at a glance)
    if (z.carry && window.TZR) { const T = TZR.TIMED[z.carry]; if (T) { g.strokeStyle = T.color; g.lineWidth = 2.5 * s; g.globalAlpha = 0.7 + 0.3 * Math.sin(t * 10); g.beginPath(); g.ellipse(X, Y, z.r * 1.4 * s, z.r * 0.7 * s, 0, 0, TAU); g.stroke(); g.globalAlpha = 1; g.font = `${Math.round(18 * s)}px sans-serif`; g.textAlign = 'center'; g.fillText(T.icon, X + 18 * s, top); } }
    if (z.rageT > 0) { g.fillStyle = 'rgba(255,40,30,0.28)'; g.beginPath(); g.ellipse(X, Y - Pk.h * k * 0.45, z.r * 1.3 * s, Pk.h * k * 0.55, 0, 0, TAU); g.fill(); }
    if (z.burnT > 0) fx(g, 'fx.fire', Math.floor(t * 12 + z.id), X, Y - Pk.h * k * 0.6, 0.35 * (boss ? 1.6 : 1), { add: true, alpha: 0.85 });
    if (boss || (z.hp < z.mhp && z.mhp > 40)) { const w = (boss ? 120 : 40) * s, y = top - 4 * s; g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(X - w / 2, y, w, 6 * s); g.fillStyle = boss ? '#e8483a' : '#e0a030'; g.fillRect(X - w / 2 + s, y + s, (w - 2 * s) * Math.max(0, z.hp / z.mhp), 4 * s); }
  }
  // buildings and props; the ones in front of you turn see-through
  function drawObs(g, sim, S2, heroSx) {
    const s = C.s, [X, Y] = C.toScreen(S2.x, S2.y), k = s * S2.sc;
    let alpha;
    if (S2.big) { const o = S2.o, P = sim.p; const behind = !(P.x >= o.x + o.w || P.y >= o.y + o.h); if (behind) { const R = frameRect(S2.key, 'static', S2.row, X, Y, k); if (R && heroSx[0] > R[0] && heroSx[0] < R[0] + R[2] && heroSx[1] - 30 * s > R[1] && heroSx[1] < Y + 40 * s) alpha = 0.38; } }
    if (!sprite(g, S2.key, 'static', S2.row, 0, X, Y, k, alpha != null ? { alpha } : null)) { prism(g, S2.o.x, S2.o.y, S2.o.w, S2.o.h, S2.o.kind === 'bld' ? 140 : 40, ['#7d776a', '#5f5a50', '#4a463e'], { alpha }); }
  }
  // the garage: walls + roof as boxes, the roll-up door from the art set
  // Your garage: a little building with a pitched roof; the front wall has the door opening, so you
  // are hidden inside until the roll-up door (art set) lifts and you step out. See-through if you're behind it.
  function garageParts(area) {
    if (area._isoG) return area._isoG;
    const G = area.garage, H = 150, R = 78, d = G.door, L = [], y1 = G.y + G.h, x1 = G.x + G.w, ym = G.y + G.h / 2;
    const quad = (g, pts, f, st) => { g.beginPath(); pts.forEach((p, i) => { const [X, Y] = C.toScreen(p[0], p[1], p[2]); if (i) g.lineTo(X, Y); else g.moveTo(X, Y); }); g.closePath(); g.fillStyle = f; g.fill(); if (st) { g.strokeStyle = st; g.lineWidth = Math.max(1, 1.5 * C.s); g.stroke(); } };
    const siding = (g, xa, xb, z0, z1, yy) => { g.strokeStyle = 'rgba(60,40,25,0.22)'; g.lineWidth = Math.max(1, C.s); g.beginPath(); for (let z = z0 + 14; z < z1; z += 16) { const [a1, b1] = C.toScreen(xa, yy, z), [a2, b2] = C.toScreen(xb, yy, z); g.moveTo(a1, b1); g.lineTo(a2, b2); } g.stroke(); };
    // inside: the back wall seen through the door
    L.push({ k: 'garage', depth: G.x + G.y, x: d.x + d.w / 2, y: G.y, draw: (g) => { setScreen(g); quad(g, [[d.x, G.y + 30, 0], [d.x + d.w, G.y + 30, 0], [d.x + d.w, G.y + 30, H], [d.x, G.y + 30, H]], '#3a332c'); } });
    L.push({ k: 'garage', front: true, depth: G.x + G.w / 2 + y1 + 1, x: d.x + d.w / 2, y: y1, draw: (g, sim, t) => {
      const P = sim.p, behind = P.x > G.x - 30 && P.x < x1 + 30 && P.y < G.y + 10 && P.y > G.y - 260 && sim.phase !== 'intro';
      setScreen(g); if (behind) g.globalAlpha = 0.4;
      const wall = '#c9b79a', wallE = '#a8957a', trim = '#3a2e24';
      // east wall (+x side) with its gable, then the front wall around the door opening
      quad(g, [[x1, G.y, 0], [x1, y1, 0], [x1, y1, H], [x1, G.y, H]], wallE, trim);
      quad(g, [[x1, G.y, H], [x1, y1, H], [x1, ym, H + R]], '#9a8870', trim);
      quad(g, [[G.x, y1, 0], [d.x, y1, 0], [d.x, y1, H], [G.x, y1, H]], wall, trim);
      quad(g, [[d.x + d.w, y1, 0], [x1, y1, 0], [x1, y1, H], [d.x + d.w, y1, H]], wall, trim);
      quad(g, [[d.x, y1, H - 34], [d.x + d.w, y1, H - 34], [d.x + d.w, y1, H], [d.x, y1, H]], wall, trim);
      siding(g, G.x, d.x, 0, H, y1); siding(g, d.x + d.w, x1, 0, H, y1); siding(g, d.x, d.x + d.w, H - 34, H, y1);
      // the roof: the front slope (shingle rows) over everything, eaves sticking out a little
      quad(g, [[G.x - 14, y1 + 18, H - 8], [x1 + 14, y1 + 18, H - 8], [x1 + 14, ym, H + R], [G.x - 14, ym, H + R]], '#5b3a32', '#2a1a16');
      g.strokeStyle = 'rgba(20,10,8,0.35)'; g.lineWidth = Math.max(1, C.s); g.beginPath(); for (let k = 1; k < 6; k++) { const u = k / 6, yy = y1 + 18 + (ym - y1 - 18) * u, zz = H - 8 + (R + 8) * u, [a1, b1] = C.toScreen(G.x - 14, yy, zz), [a2, b2] = C.toScreen(x1 + 14, yy, zz); g.moveTo(a1, b1); g.lineTo(a2, b2); } g.stroke();
      quad(g, [[x1 + 14, ym, H + R], [x1 + 14, y1 + 18, H - 8], [x1 + 14, y1 + 22, H - 14], [x1 + 14, ym, H + R - 6]], '#3a2420');
      // the roll-up door (two panels) in the opening
      const open = sim.phase === 'intro' ? clamp((sim.introT - 1.3) / 1.5, 0, 1) : sim._doorOpen != null ? sim._doorOpen : 1, Pk = need('garage.door'), s = C.s;
      if (Pk && open < 0.99) { const [X, Y] = C.toScreen(d.x + d.w / 2, y1 - 4), an = open <= 0.01 ? 'closed' : open >= 0.99 ? 'open' : 'opening', fi = an === 'opening' ? Math.floor(open * Pk.anims.opening.n) : 0;
        // one roll-up door, stretched along the wall to fill the 4-tile opening
        stretchSprite(g, Pk, an, 'SW', fi, X + (open > 0.01 && open < 0.99 ? Math.sin(t * 60) * 1.2 * s : 0), Y, s * 1.1, 0.894, 0.447, (d.w / 50) / (2.9 * 1.1), behind ? 0.4 : 1); }
      setScreen(g);
      // the house number on the lintel
      const [nx, ny] = C.toScreen(d.x + d.w / 2, y1 + 1, H - 17); g.fillStyle = '#2a2018'; g.fillRect(nx - 30 * s, ny - 9 * s, 60 * s, 18 * s); g.fillStyle = '#e8d29a'; g.font = `bold ${Math.round(13 * s)}px "Lilita One", sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('No.' + (10 + ((area.x * 7 + area.y * 3) % 89)), nx, ny + s);
      g.globalAlpha = 1;
    } });
    area._isoG = L; return L;
  }
  // a locked gate across the road (fence panels from the art) and its sign; or shut sawhorses
  function drawGate(g, sim, Gt, t) {
    const s = C.s, horiz = Gt.d === 'n' || Gt.d === 's', road = Gt.road, half = road.w / 2 + 30, Pk = need(Gt.gi ? 'prop.fence.metal' : 'prop.barrier.striped');
    const step = Gt.gi ? 80 : 110;
    for (let v = -half + step / 2; v < half; v += step) { const x = horiz ? Gt.x + v : Gt.x, y = horiz ? Gt.y : Gt.y + v, [X, Y] = C.toScreen(x, y); sprite(g, Pk || 'prop.barrier', 'static', horiz ? 'SE' : 'NE', 0, X, Y, s); }
    if (Gt.gi && window.TZG && TZG.drawGateSign) { const lx = Gt.d === 'w' ? 60 : Gt.d === 'e' ? W().AW - 60 : road.p, ly = Gt.d === 'n' ? 60 : Gt.d === 's' ? W().AH - 60 : road.p; setBill(g, lx, ly, 0, BB * 0.85); TZG.drawGateSign(g, lx, ly - 110, Gt.gi, t); }
  }
  // tagged standing things from the game modules (vehicles, survivors, chests, buildables, places)
  function drawExtra(g, sim, q2, t) {
    const s = C.s, [X, Y] = C.toScreen(q2.x, q2.y);
    switch (q2.k) {
      case 'veh': { const v = q2.v, key = VEH[v.kind] || 'vehicle.cart', dir = v.dir || 'SE'; if (!sprite(g, key, 'static', dir, 0, X, Y, s * vehScale(v.kind))) return false; setBill(g, q2.x, q2.y); if (q2.label) q2.label(g); return true; }
      case 'npc': { const N = q2.n, key = SURV[hashS(N.id) % SURV.length], Pk = need(key); if (!Pk) return false; const A = N._ia || (N._ia = { px: N.x, py: N.y, dir: 'S', ft: 0 }); const mv = Math.hypot(N.x - A.px, N.y - A.py); if (mv > 0.5) A.dir = dirOf(N.x - A.px, N.y - A.py); A.px = N.x; A.py = N.y; A.ft += 1 / 60;
        if (q2.hiding) { setScreen(g); g.fillStyle = `rgba(255,240,160,${0.22 + 0.12 * Math.sin(t * 4)})`; g.beginPath(); g.ellipse(X, Y - 36 * s, 44 * s, 56 * s, 0, 0, TAU); g.fill(); }
        sprite(g, Pk, q2.hiding ? 'wave' : mv > 0.5 ? (mv > 3 ? 'run' : 'walk') : 'idle', A.dir, Math.floor(A.ft * 12), X, Y, s * CH, { flash: N.hurtT > 0 ? 0.6 : 0 });
        setBill(g, N.x, N.y); if (q2.labels) q2.labels(g, t); return true; }
      case 'chest': { const C2 = q2.C, Pk = need(q2.look === 'key' || q2.look === 'vault' ? 'chest.key' : 'chest'); if (!Pk) return false; const A = q2.A, at = A ? A.t : -1, an = at < 0 ? 'closed' : at > 0.6 ? 'open' : 'opening', fi = an === 'opening' ? Math.floor((at / 0.6) * Pk.anims.opening.n) : 0;
        setScreen(g); const R = 70 * s, gl = g.createRadialGradient(X, Y - 14 * s, 2, X, Y - 14 * s, R); gl.addColorStop(0, `rgba(255,214,120,${0.28 + 0.18 * Math.sin(t * 4) * (q2.cleared ? 1 : 0.4) + (at > 0 ? 0.3 : 0)})`); gl.addColorStop(1, 'rgba(255,214,120,0)'); g.globalCompositeOperation = 'lighter'; g.fillStyle = gl; g.fillRect(X - R, Y - 14 * s - R, R * 2, R * 2); g.globalCompositeOperation = 'source-over';
        sprite(g, Pk, an, 'S', fi, X, Y, s * (q2.look === 'vault' || q2.look === 'key' ? 1.35 : 1.2)); setBill(g, C2.x, C2.y); if (q2.labels) q2.labels(g, t); return true; }
      case 'turret': { const T = q2.T, dir = dirOf(Math.cos(T.a), Math.sin(T.a)); if (!sprite(g, 'turret', 'static', dir, 0, X, Y, s)) return false; if (T.life < 5 && Math.sin(t * 12) > 0) { setScreen(g); g.fillStyle = '#ff4a3a'; g.beginPath(); g.arc(X, Y - 40 * s, 3 * s, 0, TAU); g.fill(); } return true; }
      case 'barricade': { const o = q2.o, horiz = o.w >= o.h, n = Math.max(1, Math.round((horiz ? o.w : o.h) / 110)); let ok = true; for (let i = 0; i < n; i++) { const x = horiz ? o.x + (i + 0.5) * (o.w / n) : o.x + o.w / 2, y = horiz ? o.y + o.h / 2 : o.y + (i + 0.5) * (o.h / n), [X2, Y2] = C.toScreen(x, y); ok = sprite(g, 'prop.barricade', 'static', horiz ? 'SE' : 'NE', 0, X2, Y2, s * 0.85) && ok; } return ok; }
      case 'heli': return drawHeli(g, sim, q2, X, Y, t);
      case 'flamer': return sprite(g, 'prop.sprinkler', 'static', 'S', 0, X, Y, s * 1.2);
      case 'decoy': { const ok = sprite(g, 'vehicle.sedan', 'static', 'SE', 0, X, Y, s * 0.9); if (ok) { const on = Math.sin(t * 14) > 0; sprite(g, 'prop.alarm', 'static', 'S', 0, X, Y - 40 * s, s); if (on) fx(g, 'fx.glow', 0, X, Y - 70 * s, 0.6, { add: true, alpha: 0.8 }); } return ok; }
      case 'crate': { const c = q2.c, u = c.t < c.land ? c.t / c.land : 1, h = (1 - u) * 260; if (!sprite(g, 'prop.crate', 'static', 'S', 0, X, Y - h * HZ * s, s * 1.1)) return false; if (c.landed && q2.labels) { setBill(g, c.x, c.y); q2.labels(g, t); } return true; }
      case 'place': { const S3 = q2.S, key = PLACE[q2.type] || 'bld.shop1', a = M.assets[keyOf(key)]; if (!a) return false; const isV = key.startsWith('vehicle'), cx = S3.x + S3.w / 2, cy = S3.y + S3.h * 0.42, [X2, Y2] = C.toScreen(cx, cy);
        const sz = a.size || [7, 7, 7], sc = isV ? 0.9 : clamp(Math.min((S3.w / 50) / sz[0], ((S3.h * 0.84) / 50) / sz[2]) * 1.25, 0.4, 1.1);
        const P = sim.p, behind = P.x < S3.x + S3.w && P.y < S3.y + S3.h * 0.84 && P.x > S3.x - 40 && P.y > S3.y - 200;
        if (!sprite(g, key, 'static', isV ? 'SE' : 'S', 0, X2, Y2, s * sc, behind ? { alpha: 0.45 } : null)) return false;
        setBill(g, cx, S3.y + S3.h, 0, BB); if (q2.sign) q2.sign(g, t); return true; }
      default: return false;
    }
  }
  const vehScale = (kind) => (kind === 'gtruck' || kind === 'tank' ? 0.95 : kind === 'cart' ? 1.25 : kind === 'push' ? 1.25 : 1.15);

  // you: your own character standing in the scene, the gun from the art set, or your ride
  function drawYou(g, sim, V) {
    const P = sim.p, t = sim.t, s = C.s, TS = window.TZSim, [X, Y] = C.toScreen(P.x, P.y);
    const aS = screenAngle(P.aim), aiming = !!(sim._lastInput && (sim._lastInput.ax || sim._lastInput.ay || sim._lastInput.fire)) || sim.muzzle > 0 || sim.b.length > 0;
    const mvx = (P.vx || 0) - (P.vy || 0), face = aiming ? (Math.cos(aS) >= 0 ? 1 : -1) : Math.abs(mvx) > 8 ? (mvx > 0 ? 1 : -1) : sim._iFace || 1; sim._iFace = face;
    sim._gunTip = null;
    if (sim.ride && !sim.dead) { drawRide(g, sim, sim.ride, P.x, P.y, true, t); return; }
    const hp = sim.heliPose && sim.heliPose();
    if (hp && hp.inside) return; // (in the helicopter)
    if (hp && hp.heroAlt > 1) { // sliding down the rope
      const kp2 = Math.max(0.2, Math.round(s * HB * C.dpr * 10) / 10), [, Yh] = C.toScreen(P.x, P.y, hp.heroAlt);
      setScreen(g); g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(X, Y, 18 * s, 7 * s, 0, 0, TAU); g.fill();
      setBill(g, P.x, P.y, hp.heroAlt, HB); TS.heroDraw(g, sim.me, P.x, P.y, { k: kp2, face, moving: false });
      void Yh; return;
    }
    setScreen(g); g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.ellipse(X + 5 * s, Y + 1 * s, 22 * s, 9 * s, 0, 0, TAU); g.fill();
    const kp = Math.max(0.2, Math.round(s * HB * C.dpr * 10) / 10), F0 = P.face; P.face = face;
    const jalt = sim.jetAlt ? sim.jetAlt() : 0; sim._heroZ = jalt;
    if (jalt > 0.5) return drawJetYou(g, sim, P, aS, face, X, Y, kp, t, jalt, F0);
    try {
      setBill(g, P.x, P.y, 0, HB);
      if (sim.dead) { TS.heroDraw(g, sim.me, P.x, P.y, { k: kp, dead: true, face }); return; }
      const blink = P.inv > 0 && P.inv < 60 && Math.sin(t * 40) > 0; // (not under the debug god mode)
      if (sim.drawUnderYou) sim.drawUnderYou(g, t);
      setBill(g, P.x, P.y, 0, HB);
      g.strokeStyle = sim.me.color || '#ffd23f'; g.lineWidth = 2.5; g.globalAlpha = 0.55; g.beginPath(); g.ellipse(P.x, P.y, 26, 11, 0, 0, TAU); g.stroke(); g.globalAlpha = 1;
      const up = Math.sin(aS) < -0.35, showGun = sim.phase !== 'intro' || sim.introT > 2.9, moving = P.moving || (sim.phase === 'intro' && sim.introT > 2.9);
      if (showGun && window.TZH && heroArms(g, sim, P, aS, face, X, Y, kp, moving, blink ? 0.5 : 1, t)) { /* body, arms and gun drawn */ }
      else {
        if (up && showGun) gunIso(g, sim, P, aS, face);
        setBill(g, P.x, P.y, 0, HB);
        TS.heroDraw(g, sim.me, P.x, P.y, { k: kp, moving, walkT: P.walkT, face, hurt: P.inv > 0.4, alpha: blink ? 0.5 : 1 });
        if (!up && showGun) gunIso(g, sim, P, aS, face);
      }
      setBill(g, P.x, P.y, 0, HB);
      if (P.armor > 0) { const ay = P.y - 96; g.fillStyle = '#9aa2aa'; g.strokeStyle = 'rgba(0,0,0,0.6)'; g.lineWidth = 2; g.beginPath(); g.ellipse(P.x, ay, 20, 7, 0, 0, TAU); g.fill(); g.stroke(); g.fillStyle = '#6a737c'; g.fillRect(P.x - 6, ay - 7, 12, 5); }
      if (sim.buffs.shield > 0) fx(g, 'fx.shield.ring', Math.floor(t * 10), X, Y - 40 * s, 0.95, { alpha: 0.75 });
      setBill(g, P.x, P.y, 0, HB);
      if (sim.buffs.kicks > 0 && P.moving) for (let i = 0; i < 2; i++) sim.particle(P.x - P.vx * 0.04 + (Math.random() - 0.5) * 10, P.y - 4, -P.vx * 0.2, -20, '#7dff6a', 0.25, 4);
      if (sim.drawOnYou) sim.drawOnYou(g, t);
    } finally { P.face = F0; }
  }
  // ---- your hero holding the gun (trash-hero.js: arms, recoil, the pick-up / swap moves) ----
  let ARMS = null;
  function armLookOf(sim) {
    const id = sim.me && sim.me.id; if (ARMS && ARMS.id === id) return ARMS.L;
    let L = null; try { L = window.BOX && BOX.armLook && sim.me ? BOX.armLook({ id, name: sim.me.name, bot: true }) : null; } catch (e) { L = null; }
    if (!L) L = { sleeve: (sim.me && sim.me.color) || '#3498db', skin: skinOf(sim), w: 7.4, hand: 3.1, sw: 12.2, y: -28.5, len: 14, ink: '#2b1f3d' };
    ARMS = { id, L }; return L;
  }
  const GUN_K = 1.3; // the held gun's size (art px per art px at the scene scale): clearly a gun in your hands
  let PARTS_N = 0; // (how many parts are merged into the gun being drawn: it grows a little with each)
  // where the other parts sit on the gun (along it from the grip, and under (+) / over (-) it): under-barrel, top rail, front top, rear
  const MOUNTS = [[0.72, 0.42], [0.35, -0.5], [0.95, -0.25], [0.05, 0.2]];
  function partKey(id) { return id === 'bat' || id === 'saw' ? 'weapon.' + id : 'weapon.' + id; }
  // the parts other than the body, drawn small on it (a rocket tube, a drum, a coil, a blade...)
  function drawParts(g, sim, I, hx, hy, ang, bodyId) {
    const parts = (sim.weapons || []).filter((w) => 'weapon.' + w.id !== bodyId); if (!parts.length) return;
    const c = Math.cos(ang), sn = Math.sin(ang), fy = c < 0 ? -1 : 1, gx = I.Lg * (1 - I.G.g), dx = -sn * fy, dy = c * fy;
    parts.slice(0, 4).forEach((w, i) => { const Pk = need(partKey(w.id)); if (!Pk || !Pk.anims.spin) return; const Ia = gunInfo(partKey(w.id), 0.42); if (!Ia) return; const [fa, fb] = MOUNTS[i];
      const mx = hx + c * gx * fa + dx * I.Hg * fb, my = hy + sn * gx * fa + dy * I.Hg * fb; gunAt(g, Ia, mx - c * Ia.Lg * (0.5 - Ia.G.g), my - sn * Ia.Lg * (0.5 - Ia.G.g), ang); });
  }
  // the merged gun on its own (the loadout screen): the body and its parts, big, on a canvas
  function gunPreview(cv, sim) {
    const x = cv.getContext('2d'), w = cv.width, h = cv.height, s0 = C.s, d0 = C.dpr; C.dpr = 1; x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, w, h);
    try { const key = GUN(sim); PARTS_N = (sim.weapons || []).length; C.s = Math.min(w / 120, h / 60); const I = gunInfo(key); if (!I) return false; const hx = w / 2 - I.Lg * (0.5 - I.G.g), hy = h / 2 + I.Hg * 0.2; gunAt(x, I, hx, hy, 0); drawParts(x, sim, I, hx, hy, 0, key); return true; }
    finally { C.s = s0; C.dpr = d0; PARTS_N = 0; x.setTransform(1, 0, 0, 1, 0, 0); }
  }
  function gunInfo(key, scale) {
    const Pk = need(key); if (!Pk || !Pk.anims.spin) return null;
    if (!Pk._side) { const L0 = Pk.anims.spin.rows.S; let bi = 0; L0.forEach((q, i) => { if (q.w / q.h > L0[bi].w / L0[bi].h + 0.02) bi = i; }); const q = L0[bi]; Pk._side = { fr: q, ml: q.lx == null ? true : q.lx > q.w / 2 }; }
    const G = GUNS[key] || GUNS['weapon.pistol'], sc = C.s * GUN_K * Pk.sc * G.k * (1 + 0.06 * (PARTS_N || 0)), fr = Pk._side.fr;
    const sc2 = sc * (scale || 1); return { Pk, fr, ml: Pk._side.ml, G, sc: sc2, Lg: fr.w * sc2, Hg: fr.h * sc2 };
  }
  // the gun with its grip at (hx, hy), turned to ang (never upside down); returns the barrel tip
  function gunAt(g, I, hx, hy, ang, alpha) {
    const D = C.dpr, c = Math.cos(ang), sn = Math.sin(ang), fy = c < 0 ? -1 : 1, gx = I.Lg * (1 - I.G.g), my = I.Hg * I.G.y;
    if (I.ml) g.setTransform(-c * D, -sn * D, -sn * fy * D, c * fy * D, (hx + gx * c + my * sn * fy) * D, (hy + gx * sn - my * c * fy) * D);
    else { const gp = I.Lg - gx; g.setTransform(c * D, sn * D, -sn * fy * D, c * fy * D, (hx - gp * c + my * sn * fy) * D, (hy - gp * sn - my * c * fy) * D); }
    if (alpha != null) g.globalAlpha = alpha;
    g.drawImage(I.fr.c, I.fr.px, I.fr.py, I.fr.pw, I.fr.ph, 0, 0, I.Lg, I.Hg); g.globalAlpha = 1;
    return [hx + c * gx, hy + sn * gx];
  }
  const FLASH = { cash: '#ffd23f', snack: '#7dff6a', armor: '#c9ccd1', shield: '#7fd6ff', freeze: '#bfefff', xp2: '#5affc8', kicks: '#7dff6a', nuke: '#ff8c42' };
  function heroArms(g, sim, P, aS, face, X, Y, kp, moving, alpha, t) {
    const H = window.TZH, TS = window.TZSim, s = C.s, key = GUN(sim); PARTS_N = (sim.weapons || []).length; const I = gunInfo(key); PARTS_N = 0; if (!I) return false;
    const AL = armLookOf(sim), dt = Math.min(0.1, Math.max(0, t - (sim._heroT == null ? t : sim._heroT))); sim._heroT = t;
    const E = sim._eq = H.equipStep(sim._eq, key, sim._grab, t, dt);
    const fi = Math.floor((P.walkT || 0) * 14) % 8, bob = moving ? Math.abs(Math.sin((fi / 8) * TAU)) * 2.5 : 0.43;
    const firing = sim.muzzle > 0 || (P.kick || 0) > 0.25, mini = sim.buffs.minigun > 0;
    sim._spin = clamp((sim._spin || 0) + (mini && firing ? dt * 2.5 : -dt * 1.5), 0, 1);
    let melee = null;
    if (sim.weapons) { const w = sim.weapons.find((q) => q.id === 'bat' || q.id === 'saw'); if (w) melee = { id: w.id, tier: w.tier, a: screenAngle(w.a || P.aim), swing: w.swing || 0 }; }
    sim._meleeHand = melee ? melee.id : null;
    const Q = H.pose({ X, Y, s, face, aS, key, kick: P.kick || 0, bob, moving, walkT: P.walkT || 0, t, firing, mini: sim._spin, AL, E, gunLen: I.Lg, gg: I.G.g, gf: I.G.f, melee });
    sim._pose = Q; // (tests / debug)
    const K = Q.K, J = Q.gunKey === key ? I : gunInfo(Q.gunKey) || I;
    const drawGunArms = () => {
      setScreen(g);
      const Sg = Q.one ? Q.SF : Q.SB, Hg = H.arm(g, Sg, Q.G, AL, K); let Hf = null;
      if (Q.F) Hf = H.arm(g, Q.SF, Q.F, AL, K);
      if (Q.item && Q.item.k > 0.02) { // the item flying into your hands
        const a = Q.ang + Q.item.spin * (face > 0 ? -1 : 1); gunAt(g, J, Q.item.x, Q.item.y, a); sim._gunTip = null;
      } else { sim._gunTip = [...gunAt(g, J, Hg[0], Hg[1], Q.ang), Q.ang]; drawParts(g, sim, J, Hg[0], Hg[1], Q.ang, Q.gunKey);
        // mixed muzzle effects: a flame part licks fire, a launcher / rail part puffs smoke
        const MG = sim.merged; if (MG && sim.muzzle > 0) { const [tx, ty] = sim._gunTip; if (MG.flame) fx(g, 'fx.fire', Math.floor(t * 20) % fxLen('fx.fire'), tx, ty, 0.22, { add: true, alpha: 0.9 }); if (MG.every.length && (sim.shotN || 0) % 2 === 0) fx(g, 'fx.smoke', Math.floor(t * 12) % fxLen('fx.smoke'), tx, ty - 4 * s, 0.16, { alpha: 0.6 }); } }
      setScreen(g); H.hand(g, Hg, AL, K); if (Hf) H.hand(g, Hf, AL, K);
    };
    const drawFree = () => {
      if (!Q.free) { if (Q.swing && Q.swing.at && melee) { setScreen(g); H.melee(g, melee.id, Q.swing.at, Q.swing.a, Q.swing.u, K, melee.tier, t); } return; } setScreen(g);
      const Hh = H.arm(g, Q.SB, Q.free, AL, K);
      if (Q.swing && melee) H.melee(g, melee.id, Hh, Q.swing.a, Q.swing.u, K, melee.tier, t);
      setScreen(g); H.hand(g, Hh, AL, K);
    };
    const drawBody = () => { setBill(g, P.x, P.y, sim._heroZ || 0, HB); TS.heroDraw(g, sim.me, P.x, P.y, { k: kp, moving, walkT: P.walkT, face, hurt: P.inv > 0.4, alpha, noArms: true, dx: Q.body.dx / s, dy: Q.body.dy / s, lean: Q.body.lean, sq: Q.body.sq }); };
    if (Q.behind) { drawGunArms(); drawBody(); drawFree(); } else { drawBody(); drawGunArms(); drawFree(); }
    // a quick grab: a flash at the hand
    if (Q.flash) { setScreen(g); const col = FLASH[Q.flash.k] || '#ffd23f', u = Q.flash.u; g.globalCompositeOperation = 'lighter'; g.globalAlpha = (1 - u) * 0.9; g.strokeStyle = col; g.lineWidth = 3 * s; g.beginPath(); g.arc(Q.flash.x, Q.flash.y, (4 + u * 16) * s, 0, TAU); g.stroke(); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; fx(g, 'fx.star', Math.floor(u * fxLen('fx.star')), Q.flash.x, Q.flash.y - 4 * s, 0.45, { add: true, alpha: 1 - u }); }
    if (Q.item && Q.item.k > 0.02 && E.kind === 'catch') { setScreen(g); g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.5 * Q.item.k; g.fillStyle = '#fff1b0'; g.beginPath(); g.arc(Q.item.x, Q.item.y, 18 * s, 0, TAU); g.fill(); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; }
    return true;
  }
  // flying on the jetpack: the pack on your back, two flame jets, you (with your gun) up high, the fuel ring
  function drawJetYou(g, sim, P, aS, face, X, Y, kp, t, alt, F0) {
    const s = C.s, Y2 = Y - alt * HZ * s, fuel = Math.max(0, (sim.buffs.jetpack || 0) / 10), J = sim.jet || {};
    try {
      sprite(g, 'fly.jetpack', 'static', face > 0 ? 'SW' : 'SE', 0, X - face * 13 * s, Y2 - 22 * s, s * 1.1);
      if (!J.fall) { setScreen(g); g.globalCompositeOperation = 'lighter'; for (const dx of [-5, 5]) { const fx0 = X - face * 13 * s + dx * s, fy0 = Y2 - 20 * s, L = (16 + Math.random() * 12) * s, gr = g.createLinearGradient(fx0, fy0, fx0, fy0 + L); gr.addColorStop(0, 'rgba(255,240,170,0.95)'); gr.addColorStop(0.5, 'rgba(255,140,40,0.7)'); gr.addColorStop(1, 'rgba(255,60,20,0)'); g.fillStyle = gr; g.beginPath(); g.moveTo(fx0 - 3.5 * s, fy0); g.lineTo(fx0 + 3.5 * s, fy0); g.lineTo(fx0, fy0 + L); g.closePath(); g.fill(); } g.globalCompositeOperation = 'source-over'; }
      const moving = P.moving, blink = P.inv > 0 && P.inv < 60 && Math.sin(t * 40) > 0;
      if (!(window.TZH && heroArms(g, sim, P, aS, face, X, Y2, kp, false, blink ? 0.5 : 1, t))) { setBill(g, P.x, P.y, alt, HB); window.TZSim.heroDraw(g, sim.me, P.x, P.y, { k: kp, face, moving }); }
      if (J.fall) { setScreen(g); g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 2 * s; g.beginPath(); g.moveTo(X - 16 * s, Y2 - 60 * s); g.lineTo(X, Y2 - 120 * s); g.lineTo(X + 16 * s, Y2 - 60 * s); g.stroke(); g.fillStyle = '#ff6a2a'; g.beginPath(); g.ellipse(X, Y2 - 122 * s, 34 * s, 14 * s, 0, Math.PI, 0); g.fill(); g.strokeStyle = '#1b1410'; g.stroke(); } // (a little chute on the way down)
      // the fuel ring
      setScreen(g); const rx = X + 30 * s, ry = Y2 - 74 * s, r = 11 * s; g.fillStyle = 'rgba(15,10,6,0.75)'; g.beginPath(); g.arc(rx, ry, r + 3 * s, 0, TAU); g.fill();
      g.strokeStyle = fuel < 0.3 ? (Math.sin(t * 14) > 0 ? '#ff4a3a' : '#ffb02e') : '#ff9a2e'; g.lineWidth = 4 * s; g.beginPath(); g.arc(rx, ry, r, -Math.PI / 2, -Math.PI / 2 + TAU * fuel); g.stroke();
      g.font = `${Math.round(11 * s)}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff'; g.fillText('⛽', rx, ry + s);
    } finally { P.face = F0; sim._heroZ = 0; }
  }
  // The gun held in your hand(s) at chest height, turned to the on-screen aim (never upside down), with a
  // recoil kick; two-handed guns get the front hand on the fore-grip. Sets sim._gunTip (the barrel tip:
  // the muzzle flash and the tracers start there).
  function gunIso(g, sim, P, aS, face) {
    const s = C.s, key = GUN(sim), Pk = need(key), [X, Y] = C.toScreen(P.x, P.y), left = Math.cos(aS) < 0;
    const c = Math.cos(aS), sn = Math.sin(aS), kick = (P.kick || 0) * 6 * s;
    // the hand: in front of the chest, a little toward the aim
    const hx = X + face * 4 * s + c * 9 * s - c * kick, hy = Y - SHOT_H * HZ * s + sn * 5 * s - sn * kick;
    if (!Pk) { setBill(g, P.x, P.y, 0, HB); window.TZA.drawGun(g, P.x + face * 13, P.y - 30, Math.atan2(sn, c), P.kick, sim.buffs.minigun > 0); sim._gunTip = [hx + c * 40 * s, hy + sn * 40 * s, aS]; return; }
    // the side view: the widest frame of the spin; the grip end (lowest quarter) tells which way the muzzle points
    if (!Pk._side) { const L0 = Pk.anims.spin.rows.S; let bi = 0; L0.forEach((q, i) => { if (q.w / q.h > L0[bi].w / L0[bi].h + 0.02) bi = i; }); const q = L0[bi]; Pk._side = { fr: q, ml: q.lx == null ? true : q.lx > q.w / 2 }; }
    const G = GUNS[key] || GUNS['weapon.pistol'], fr = Pk._side.fr, ml = Pk._side.ml, sc = s * 1.1 * Pk.sc * G.k, D = C.dpr;
    const Lg = fr.w * sc, Hg = fr.h * sc, gx = Lg * (1 - G.g), my = Hg * G.y, fy = left ? -1 : 1;
    // map the art's length onto the aim (muzzle forward) and its height across it (flipped when aiming left, never upside down)
    if (ml) g.setTransform(-c * D, -sn * D, -sn * fy * D, c * fy * D, (hx + gx * c + my * sn * fy) * D, (hy + gx * sn - my * c * fy) * D);
    else { const gp = Lg - gx; g.setTransform(c * D, sn * D, -sn * fy * D, c * fy * D, (hx - gp * c + my * sn * fy) * D, (hy - gp * sn - my * c * fy) * D); }
    g.drawImage(fr.c, fr.px, fr.py, fr.pw, fr.ph, 0, 0, Lg, Hg);
    sim._gunTip = [hx + c * gx, hy + sn * gx, aS];
    // hands (skin tone, inked): the grip, and the fore-grip on two-handed guns
    setScreen(g); const r = Math.max(2, 3.5 * s), skin = skinOf(sim); g.lineWidth = Math.max(1, 1.4 * s); g.strokeStyle = 'rgba(20,12,8,0.85)'; g.fillStyle = skin;
    g.beginPath(); g.arc(hx, hy + r * 0.3, r, 0, TAU); g.fill(); g.stroke();
    if (G.f) { const d = Lg * (G.f - G.g); g.beginPath(); g.arc(hx + c * d, hy + sn * d + r * 0.3, r * 0.95, 0, TAU); g.fill(); g.stroke(); }
  }
  // a ride (yours or a friend's): the vehicle art, its driving anim, exhaust / clippings, the timer ring
  function drawRide(g, sim, r, x, y, mine, t, who) {
    const s = C.s, [X, Y] = C.toScreen(x, y), A = r._ia || (r._ia = { px: x, py: y, dir: 'SE', mv: 0 });
    const mv = Math.hypot(x - A.px, y - A.py); if (mv > 0.6) A.dir = dirOf(x - A.px, y - A.py); A.mv += (mv - A.mv) * 0.3; A.px = x; A.py = y; r.dir = A.dir;
    const key = VEH[r.kind] || 'vehicle.cart', moving = A.mv > 0.4, FV = window.TZX && TZX.VEHICLES[r.kind], fly = !!(FV && FV.fly);
    const alt = fly ? (r.alt != null ? r.alt : FV.hop ? Math.abs(Math.sin(t * Math.PI / FV.hop)) * FV.alt : FV.alt) : 0;
    if (fly) drawFlying(g, sim, r, FV, x, y, X, Y, alt, A, mine, t, who);
    else if (!sprite(g, key, moving ? 'drive' : 'static', A.dir, Math.floor(t * 16), X, Y, s * vehScale(r.kind))) { setBill(g, x, y); if (sim._drawVehicleOld) sim._drawVehicleOld(g, r.kind, x, y, 1, t, moving, r); }
    // the tank: the turret's aim line, a lock ring on the target, the reload ring
    if (mine && r.kind === 'tank') { const tur = r.tur != null ? r.tur : sim.p.aim, z = r.lock != null && sim.z.find((q) => q.id === r.lock && q.hp > 0), C0 = window.TZX.VEHICLES.tank.cannon, rl = Math.min(1, (r.reload || 0) / C0.reload);
      setScreen(g); const a2 = screenAngle(tur), [mx, my] = C.toScreen(x + Math.cos(tur) * 260, y + Math.sin(tur) * 260, 20); g.strokeStyle = 'rgba(255,220,120,0.55)'; g.lineWidth = 2; g.setLineDash([6, 8]); g.beginPath(); g.moveTo(X + Math.cos(a2) * 50 * s, Y - 50 * s + Math.sin(a2) * 25 * s); g.lineTo(mx, my); g.stroke(); g.setLineDash([]);
      if (z) { const [zx, zy] = C.toScreen(z.x, z.y, chestH(z)), R2 = (26 + 6 * Math.sin(t * 8)) * s; g.strokeStyle = '#ff4a3a'; g.lineWidth = 3 * s; g.beginPath(); g.arc(zx, zy, R2, 0, TAU); g.stroke(); for (let i = 0; i < 4; i++) { const b = i * Math.PI / 2 + t; g.beginPath(); g.moveTo(zx + Math.cos(b) * R2 * 0.6, zy + Math.sin(b) * R2 * 0.6); g.lineTo(zx + Math.cos(b) * R2 * 1.3, zy + Math.sin(b) * R2 * 1.3); g.stroke(); } }
      else { g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 2; g.beginPath(); g.arc(mx, my, 14 * s, 0, TAU); g.moveTo(mx - 20 * s, my); g.lineTo(mx + 20 * s, my); g.moveTo(mx, my - 20 * s); g.lineTo(mx, my + 20 * s); g.stroke(); }
      if (rl > 0) { g.strokeStyle = '#ffb02e'; g.lineWidth = 4 * s; g.beginPath(); g.arc(X, Y - 100 * s, 12 * s, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - rl)); g.stroke(); }
      if (sim.muzzle > 0) fx(g, 'fx.muzzle', 0, X + Math.cos(a2) * 70 * s, Y - 55 * s + Math.sin(a2) * 35 * s, 0.7, { rot: a2, add: true }); }
    // exhaust (engines) or grass clippings (mowers)
    if (moving && sim.fx.length < 200 && Math.random() < 0.5) {
      if (r.kind === 'gtruck' || r.kind === 'mower') sim.fx.push({ k: 's', x: x - Math.cos(sim.p.aim) * 30, y: y - 12, r: 8 + Math.random() * 6, t: 0, life: 0.7, a: 0.35, c: '#6a6560' });
      if (r.kind === 'mower' || r.kind === 'push') sim.particle(x + (Math.random() - 0.5) * 30, y - 6, (Math.random() - 0.5) * 120, -60 - Math.random() * 60, Math.random() < 0.5 ? '#7fbf4a' : '#a6d86a', 0.5, 3);
    }
    // the countdown ring + HP (every ride is a limited-time thing)
    setScreen(g);
    const L = r.life || r.time, L0 = r.life0 || (r.kind === 'gtruck' ? 15 : 0), R = 30 * s, cy = Y - (r.kind === 'gtruck' ? 120 : fly ? (r.kind === 'gunship' ? 150 : 130) : 70) * s - alt * HZ * s;
    if (L != null && L0 > 0) {
      const u = clamp(L / L0, 0, 1);
      g.fillStyle = 'rgba(15,10,6,0.72)'; g.beginPath(); g.arc(X, cy, R * 0.72, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = 5 * s; g.beginPath(); g.arc(X, cy, R * 0.72, 0, TAU); g.stroke();
      g.strokeStyle = u < 0.25 ? (Math.sin(t * 14) > 0 ? '#ff4a3a' : '#ffb02e') : '#9cff5a'; g.beginPath(); g.arc(X, cy, R * 0.72, -Math.PI / 2, -Math.PI / 2 + TAU * u); g.stroke();
      g.font = `bold ${Math.round(14 * s)}px "Lilita One", sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff'; g.fillText(String(Math.ceil(L)), X, cy + s);
    }
    if (r.mhp) { const w = 60 * s; g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(X - w / 2, cy + R * 0.9, w, 6 * s); g.fillStyle = r.hp / r.mhp < 0.3 ? '#ff4a3a' : '#7fd6ff'; g.fillRect(X - w / 2 + s, cy + R * 0.9 + s, (w - 2 * s) * Math.max(0, r.hp / r.mhp), 4 * s); }
    if (mine) { const name = (sim.me && sim.me.name) || ''; if (name) { g.font = `bold ${Math.round(13 * s)}px "Lilita One", sans-serif`; g.lineWidth = 4; g.strokeStyle = '#1b1410'; g.strokeText(name, X, cy - R); g.fillStyle = sim.me.color || '#fff'; g.fillText(name, X, cy - R); } }
  }
  // ---- the wild realms: lava glows and flows, ice glints ----
  function drawHazards(g, sim, t) {
    setGround(g); const H = sim.area.hazards;
    g.globalCompositeOperation = 'lighter';
    const p = 0.5 + 0.5 * Math.sin(t * 2.2); window.TZA.lavaPaths(g, H, (q) => { g.strokeStyle = `rgba(255,${120 + Math.round(60 * p)},40,${0.25 + 0.2 * p})`; g.lineWidth = q.ww * 0.9; g.stroke(); g.strokeStyle = 'rgba(255,230,140,0.4)'; g.lineWidth = q.ww * 0.18; g.setLineDash([10, 30]); g.lineDashOffset = -t * 40; g.stroke(); g.setLineDash([]); g.lineDashOffset = 0; });
    for (const h of H) {
      if (h.kind === 'lava') continue; if (false) { const p = 0; g.fillStyle = `rgba(255,${120 + Math.round(60 * p)},40,${0.28 + 0.2 * p})`; g.fillRect(h.x, h.y, h.w, h.h);
        g.fillStyle = 'rgba(255,230,140,0.45)'; const k = (t * 30 + h.x * 0.7 + h.y * 0.3) % 40; g.fillRect(h.x + (h.w > h.h ? k : h.w * 0.3), h.y + (h.w > h.h ? h.h * 0.35 : k), h.w > h.h ? 8 : h.w * 0.4, h.w > h.h ? h.h * 0.3 : 8); }
      else if (h.kind === 'ice') { const u = (t * 0.25 + h.x * 0.001) % 1; g.fillStyle = 'rgba(255,255,255,0.10)'; g.beginPath(); g.ellipse(h.x + h.w * (0.2 + 0.6 * u), h.y + h.h * 0.5, h.w * 0.08, h.h * 0.35, 0.6, 0, TAU); g.fill(); }
    }
    g.globalCompositeOperation = 'source-over';
  }
  // ---- helipads, helicopters, flying rides (trash-heli.js) ----
  function drawPad(g, sim, pd, t) {
    const s = C.s, [X, Y] = C.toScreen(pd.x, pd.y), ok = sim.heliWait() <= 0;
    sprite(g, 'heli.pad', 'static', 'S', 0, X, Y, s * 0.92);
    // the landing lights blink; a label: what it is, or when the pilot is back
    setScreen(g); g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.25 + 0.2 * Math.sin(t * 5); g.fillStyle = ok ? '#7dff6a' : '#ffb02e'; g.beginPath(); g.ellipse(X, Y, 120 * s, 60 * s, 0, 0, TAU); g.fill(); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    if (sim.heli) return;
    const near = sim.nearPad && sim.nearPad(), txt2 = ok ? (near ? '🚁 TAP FLY: PICK A PLACE' : '🚁 HELIPAD') : '🚁 BACK IN ' + Math.ceil(sim.heliWait()) + ' s';
    g.font = `bold ${Math.round(13 * s + 2)}px "Lilita One", sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 4; g.strokeStyle = '#1b1410'; const ly = Y + 70 * s; g.strokeText(txt2, X, ly); g.fillStyle = ok ? '#9cff3c' : '#ffb02e'; g.fillText(txt2, X, ly);
  }
  // a helicopter (q2: x, y, alt, still, rope, heroAlt, alpha, gun): its shadow on the ground, the body up in the air
  function drawHeli(g, sim, q2, X, Y, t) {
    const s = C.s, alt = q2.alt || 0, key = q2.gun ? 'heli.gunship' : 'heli.rescue', Pk = need(key); if (!Pk) return true; // (still loading: nothing yet)
    const a = q2.alpha == null ? 1 : q2.alpha; setScreen(g);
    g.globalAlpha = a * Math.max(0.12, 0.42 - alt / 900); g.fillStyle = '#000'; g.beginPath(); g.ellipse(X + alt * 0.12 * s, Y + alt * 0.05 * s, 95 * s * (1 - alt / 1400), 34 * s * (1 - alt / 1400), 0, 0, TAU); g.fill(); g.globalAlpha = 1;
    const hy = Y - alt * HZ * s;
    if (q2.rope) { g.strokeStyle = '#3a2a1c'; g.lineWidth = Math.max(1.5, 2.2 * s); g.beginPath(); g.moveTo(X + 14 * s, hy - 40 * s); g.lineTo(X + 14 * s, Y - (q2.heroAlt || 0) * HZ * s - 60 * s); g.stroke(); }
    sprite(g, Pk, q2.still ? 'static' : 'fly', q2.dir || 'SE', Math.floor(t * 24), X, hy, s * HELI_K, a < 1 ? { alpha: a } : null);
    if (q2.parked && sim.nearPad && sim.nearPad()) { setScreen(g); g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.3 + 0.2 * Math.sin(t * 6); g.strokeStyle = '#9cff3c'; g.lineWidth = 3 * s; g.beginPath(); g.ellipse(X, Y, 110 * s, 50 * s, 0, 0, TAU); g.stroke(); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; }
    return true;
  }
  // the chopper on a plain screen spot (the phone's flight view, trash.js)
  function heliAt(g, X, Y, k, dir, t, gun) { const Pk = need(gun ? 'heli.gunship' : 'heli.rescue'); if (!Pk) return false; const D0 = C.dpr; C.dpr = window.devicePixelRatio ? Math.min(2, window.devicePixelRatio) : 1; const ok = sprite(g, Pk, 'fly', dir || 'E', Math.floor(t * 24), X, Y, k); C.dpr = D0; return ok; }
  // a flying ride: shadow on the ground, the ride (or you on it) up high
  function drawFlying(g, sim, r, FV, x, y, X, Y, alt, A, mine, t, who) {
    const s = C.s, TS = window.TZSim, hy = Y - alt * HZ * s, P = sim.p, face = mine ? (P.face || 1) : (Math.cos(screenAngle(r.head || 0)) >= 0 ? 1 : -1);
    setScreen(g); g.fillStyle = 'rgba(0,0,0,0.32)'; g.beginPath(); const sr = r.kind === 'gunship' ? 80 : r.kind === 'glider' ? 60 : 22; g.ellipse(X + alt * 0.1 * s, Y + alt * 0.04 * s, sr * s * (1 - alt / 900), sr * 0.4 * s * (1 - alt / 900), 0, 0, TAU); g.fill();
    if (r.kind === 'gunship') {
      sprite(g, 'heli.gunship', 'fly', A.dir, Math.floor(t * 24), X, hy, s * HELI_K);
      if (mine) { const a = screenAngle(P.aim); sim._gunTip = [X + Math.cos(a) * 40 * s, hy - 14 * s + Math.sin(a) * 18 * s, a]; }
      return;
    }
    const kp = Math.max(0.2, Math.round(s * HB * C.dpr * 10) / 10), me = who || sim.me;
    if (r.kind === 'jetpack') {
      sprite(g, 'fly.jetpack', 'static', face > 0 ? 'SW' : 'SE', 0, X - face * 13 * s, hy - 22 * s, s * 1.1);
      const thrust = alt > 2 ? 1 : 0.3; setScreen(g); g.globalCompositeOperation = 'lighter';
      for (const dx of [-5, 5]) { const fx0 = X - face * 13 * s + dx * s, fy0 = hy - 20 * s, L = (14 + Math.random() * 10) * thrust * s; const gr = g.createLinearGradient(fx0, fy0, fx0, fy0 + L); gr.addColorStop(0, 'rgba(255,240,170,0.95)'); gr.addColorStop(0.5, 'rgba(255,140,40,0.7)'); gr.addColorStop(1, 'rgba(255,60,20,0)'); g.fillStyle = gr; g.beginPath(); g.moveTo(fx0 - 3 * s, fy0); g.lineTo(fx0 + 3 * s, fy0); g.lineTo(fx0, fy0 + L); g.closePath(); g.fill(); }
      g.globalCompositeOperation = 'source-over';
      setBill(g, x, y, alt, HB); TS.heroDraw(g, me, x, y, { k: kp, face, moving: alt < 2 && Math.hypot(P.vx || 0, P.vy || 0) > 30 && mine, walkT: P.walkT });
      if (mine && alt > 20 && Math.random() < 0.3) sim.particle(x, y - 4, (Math.random() - 0.5) * 40, 40, '#cfcfcf', 0.4, 5);
      return;
    }
    // the glider: you hang under the wing
    sprite(g, 'fly.glider', 'static', A.dir, 0, X, Y - (alt + 38) * HZ * s, s * 0.95);
    setBill(g, x, y, alt - 30, HB); TS.heroDraw(g, me, x, y, { k: kp, face, moving: false, lean: face * 0.15 });
  }
  function drawOther(g, sim, o, V) {
    const s = C.s, TS = window.TZSim, who = (sim.o.people && sim.o.people(o.id)) || { id: o.id, name: '?', color: '#fff' }, [X, Y] = C.toScreen(o.x, o.y);
    if (o.veh && !o.dead && !o.down) { const r = o._ride || (o._ride = {}); r.kind = o.veh; r.life = o.vl; r.life0 = o.vl0; drawRide(g, sim, r, o.x, o.y, false, sim.t, who); setScreen(g); g.font = `bold ${Math.round(13 * s)}px "Lilita One", sans-serif`; g.textAlign = 'center'; g.lineWidth = 4; g.strokeStyle = '#1b1410'; g.strokeText(who.name || '', X, Y - 110 * s); g.fillStyle = who.color || '#fff'; g.fillText(who.name || '', X, Y - 110 * s); return; }
    setScreen(g); g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.ellipse(X + 5 * s, Y + s, 22 * s, 9 * s, 0, 0, TAU); g.fill();
    const aS = screenAngle(o.aim || 0), face = Math.cos(aS) >= 0 ? 1 : -1, F0 = o.face; o.face = face;
    setBill(g, o.x, o.y, 0, HB); g.strokeStyle = who.color || '#fff'; g.lineWidth = 2.5; g.beginPath(); g.ellipse(o.x, o.y, 26, 11, 0, 0, TAU); g.stroke();
    if (sim.drawOtherExtra) sim.drawOtherExtra(g, o, who, false);
    setBill(g, o.x, o.y, 0, HB);
    TS.heroDraw(g, who, o.x, o.y, { k: Math.max(0.2, Math.round(s * HB * C.dpr * 10) / 10), moving: Math.abs(o.tx - o.x) + Math.abs(o.ty - o.y) > 2, walkT: o.walkT, face, dead: o.dead || o.down });
    if (!o.dead && !o.down) { const Pk = need('weapon.pistol'); if (Pk) { const fr = Pk.anims.spin.rows.S[0], sc = s * 0.8 * Pk.sc, D = C.dpr, c = Math.cos(aS), sn = Math.sin(aS), fy2 = c < 0 ? -1 : 1, hx = X + face * 8 * s, hy = Y - 34 * s; g.setTransform(-c * D, -sn * D, -sn * fy2 * D, c * fy2 * D, hx * D, hy * D); g.drawImage(fr.c, fr.px, fr.py, fr.pw, fr.ph, -fr.w * sc * 0.65, -fr.h * 0.42 * sc, fr.w * sc, fr.h * sc); } }
    setBill(g, o.x, o.y, 0, HB);
    if (o.shield) { g.strokeStyle = 'rgba(110,227,255,0.6)'; g.lineWidth = 4; g.beginPath(); g.arc(o.x, o.y - 40, 46, 0, TAU); g.stroke(); }
    g.font = 'bold 20px "Lilita One", sans-serif'; g.textAlign = 'center'; g.lineWidth = 5; g.strokeStyle = '#1b1410'; g.strokeText(who.name || '', o.x, o.y - 120); g.fillStyle = who.color || '#fff'; g.fillText(who.name || '', o.x, o.y - 120);
    if (o.mhp) { g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(o.x - 24, o.y - 112, 48, 6); g.fillStyle = '#7dff6a'; g.fillRect(o.x - 23, o.y - 111, 46 * Math.max(0, o.hp / o.mhp), 4); }
    if (o.down) { g.font = 'bold 18px "Lilita One", sans-serif'; g.lineWidth = 4; g.strokeText('🆘 HOLD NEAR TO REVIVE', o.x, o.y - 140); g.fillStyle = '#ff8c6a'; g.fillText('🆘 HOLD NEAR TO REVIVE', o.x, o.y - 140); if (o.rev > 0) { g.strokeStyle = '#7dff6a'; g.lineWidth = 6; g.beginPath(); g.arc(o.x, o.y - 40, 50, -Math.PI / 2, -Math.PI / 2 + TAU * Math.min(1, o.rev)); g.stroke(); } }
    if (o.ch) { g.font = '24px sans-serif'; g.fillText('🃏', o.x + 30, o.y - 80); }
    if (sim.drawOtherExtra) sim.drawOtherExtra(g, o, who, true);
    o.face = F0;
  }
  // effects: sprites from the fx atlas where they exist (sparks, blood/goo spurts, smoke, fire, explosions)
  function drawFx(g, sim, t, hi) {
    const s = C.s;
    for (const f of sim.fx) {
      const u = f.t / f.life;
      if (f.ox == null) { f.ox = f.x; f.oy = f.y; }
      // anchored where it started (its ground spot + a height), moving like the old 3/4 art did
      const H = f.k === 'txt' ? 0 : f.h != null ? f.h : 30, [X0, Y0] = C.toScreen(f.ox, f.oy + H, (f.k === 'spurt' || f.k === 'poof') && f.src ? chestH(f.src) : H), X = X0 + (f.x - f.ox) * s * BB, Y = Y0 + (f.y - f.oy) * s * BB;
      if (f.k === 'p') { if (u >= 1) continue; setScreen(g); g.globalAlpha = 1 - u; g.fillStyle = f.c; const sz = f.s * s * 0.9; g.fillRect(X - sz / 2, Y - sz / 2, sz, sz); }
      else if (f.k === 's') { const n = fxLen('fx.smoke'); fx(g, f.c === '#4a5a2a' ? 'fx.smoke' : 'fx.smoke', Math.floor(u * n), X, Y - u * 30 * s, (f.r / 60) * (0.6 + u), { alpha: (1 - u) * (f.a || 0.5) * 1.3 }); }
      else if (f.k === 'fire') { const n = fxLen('fx.explosion'); fx(g, 'fx.explosion', Math.floor(u * n), X, Y - f.r * 0.3 * s, (f.r / 85) * 1.2, { add: true, alpha: 1 - u * 0.5 }); }
      else if (f.k === 'spurt') { if (u >= 1) continue; const nm = f.goo ? 'fx.goo.spurt' : 'fx.blood.spurt', n = fxLen(nm), a = screenAngle(f.wa || 0), left = Math.cos(a) < 0; fx(g, nm, Math.floor(u * n), X, Y, (f.big ? 0.8 : 0.5), { rot: left ? a + Math.PI : a, flip: left }); }
      else if (f.k === 'poof') { if (u >= 1) continue; const sc0 = (f.big ? 1.2 : 0.6) * (0.7 + u * 0.6); fx(g, 'fx.puff.white', Math.floor(u * fxLen('fx.puff.white')), X, Y, sc0, { alpha: 0.85 * (1 - u) }); fx(g, 'fx.star', Math.floor(u * fxLen('fx.star')), X, Y - 6 * s, (f.big ? 0.9 : 0.5), { add: true, alpha: 1 - u }); }
      else if (f.k === 'ring') { setGround(g); g.globalAlpha = (1 - u) * 0.8; g.strokeStyle = f.c; g.lineWidth = 8 * (1 - u) + 1.5; g.beginPath(); g.arc(f.x, f.y, f.r + (f.R - f.r) * u, 0, TAU); g.stroke(); }
      else if (f.k === 'zap') { setGround(g, 30); g.globalAlpha = 1 - u; g.strokeStyle = '#d8f6ff'; g.lineWidth = 3; g.shadowColor = '#7fd6ff'; g.shadowBlur = hi ? 10 : 0; g.beginPath(); g.moveTo(f.x, f.y); const nn = 5; for (let i = 1; i <= nn; i++) { const kk = i / nn; g.lineTo(f.x + (f.x2 - f.x) * kk + (i < nn ? (Math.random() - 0.5) * 24 : 0), f.y + (f.y2 - f.y) * kk + (i < nn ? (Math.random() - 0.5) * 24 : 0)); } g.stroke(); g.shadowBlur = 0; }
      else if (f.k === 'txt') { setScreen(g); const [tx, ty] = C.toScreen(f.ox, f.oy + 80, 80); g.globalAlpha = 1 - u * u; const sz = Math.round((f.size || 28) * s * 0.8); g.font = `bold ${sz}px "Lilita One", sans-serif`; g.textAlign = 'center'; g.lineWidth = Math.max(3, sz / 5); g.strokeStyle = 'rgba(15,10,6,0.9)'; g.strokeText(f.text, tx, ty - u * 40 * s); g.fillStyle = f.c; g.fillText(f.text, tx, ty - u * 40 * s); }
      else if (f.k === 'c') { setScreen(g); g.globalAlpha = Math.min(1, (f.life - f.t) * 2); g.fillStyle = f.t < f.life * 0.3 ? '#e8c46a' : '#b08a3a'; const [cx2, cy2] = C.toScreen(f.ox, f.oy + 30, 30); g.fillRect(cx2 + (f.x - f.ox) * s * BB - 2 * s, cy2 + (f.y - f.oy) * s * BB - s, 4 * s, 2 * s); }
      g.globalAlpha = 1;
    }
  }
  // light and weather over the frame (screen space)
  function mood(g, sim, V, t, hi, intro) {
    const WX = sim._wx || (sim._wx = window.TZSim.weather(sim.seed)), T = TODS[WX.tod], s = C.s, P = sim.p, TA = window.TZA;
    if (T && !intro) {
      g.fillStyle = T.tint; g.fillRect(0, 0, V.w, V.h);
      const ds = hi ? 0.35 : 0.22, lw = Math.max(16, Math.round(V.w * ds)), lh = Math.max(16, Math.round(V.h * ds));
      if (!LC) LC = document.createElement('canvas');
      if (LC.width !== lw || LC.height !== lh) { LC.width = lw; LC.height = lh; }
      const l = LC.getContext('2d'); l.setTransform(1, 0, 0, 1, 0, 0); l.globalCompositeOperation = 'source-over'; l.clearRect(0, 0, lw, lh);
      l.fillStyle = `rgba(${T.col},${T.dark})`; l.fillRect(0, 0, lw, lh);
      l.globalCompositeOperation = 'destination-out';
      // light pools are ground ellipses (2:1), centred a little above the spot
      const hole = (x, y, r, a = 1) => { const [sx2, sy2] = C.toScreen(x, y + 20, 20), R = r * s * HX * 1.2 * ds, cx = sx2 * ds, cy = sy2 * ds; if (cx < -R || cy < -R || cx > lw + R || cy > lh + R) return; const gr = l.createRadialGradient(cx, cy, 0, cx, cy, R); gr.addColorStop(0, `rgba(0,0,0,${a})`); gr.addColorStop(0.55, `rgba(0,0,0,${a * 0.6})`); gr.addColorStop(1, 'rgba(0,0,0,0)'); l.fillStyle = gr; l.save(); l.translate(cx, cy); l.scale(1, 0.72); l.translate(-cx, -cy); l.fillRect(cx - R, cy - R, R * 2, R * 2); l.restore(); };
      const view = sim.S.view || 1, scope = sim.buffs.scope > 0 ? 1.35 : 1;
      if (!sim.dead) {
        hole(P.x, P.y - 30, 150 * view * scope, 0.9);
        if (WX.tod === 'night') { // the flashlight cone, along the aim as it shows on screen
          const [hx, hy] = C.toScreen(P.x, P.y, 30), [ex, ey] = C.toScreen(P.x + Math.cos(P.aim) * 620 * view * scope, P.y + Math.sin(P.aim) * 620 * view * scope, 0), len = Math.hypot(ex - hx, ey - hy) * ds * 1.1, a0 = Math.atan2(ey - hy, ex - hx), half = 0.42 * Math.min(1.6, view * scope);
          const gr = l.createRadialGradient(hx * ds, hy * ds, 0, hx * ds, hy * ds, len); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.7, 'rgba(0,0,0,0.75)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
          l.fillStyle = gr; l.beginPath(); l.moveTo(hx * ds, hy * ds); l.arc(hx * ds, hy * ds, len, a0 - half, a0 + half); l.closePath(); l.fill();
        }
      }
      if (sim.muzzle > 0) hole(P.x + Math.cos(P.aim) * 50, P.y + Math.sin(P.aim) * 50, 300, 0.85);
      for (const o of sim.others.values()) if (!o.dead) hole(o.x, o.y - 30, 170, 0.8);
      for (const Lt of TA.lights(sim.area)) hole(Lt.x, Lt.y, Lt.r, 0.85);
      for (const f of sim.fx) if ((f.k === 'ring' && f.R > 120) || f.k === 'fire') hole(f.x, f.y, (f.R || f.r * 3) * 1.3, (1 - f.t / f.life));
      for (const p of sim.pk) hole(p.x, p.y, 90, 0.6);
      if (sim.lightHoles) sim.lightHoles(hole);
      for (const z of sim.z) if (z.burnT > 0 || z.fb) hole(z.x, z.y - z.r, z.fb ? 220 : 90, 0.6);
      g.imageSmoothingEnabled = true; g.drawImage(LC, 0, 0, V.w, V.h);
      g.globalCompositeOperation = 'lighter';
      for (const Lt of TA.lights(sim.area)) { const [lx, ly] = C.toScreen(Lt.x, Lt.y), R = Lt.r * s * 0.5; if (lx < -R || ly < -R || lx > V.w + R || ly > V.h + R) continue; const gr = g.createRadialGradient(lx, ly, 0, lx, ly, R); gr.addColorStop(0, Lt.c + (WX.tod === 'night' ? '0.22)' : '0.1)')); gr.addColorStop(1, Lt.c + '0)'); g.fillStyle = gr; g.save(); g.translate(lx, ly); g.scale(1, 0.6); g.translate(-lx, -ly); g.fillRect(lx - R, ly - R, R * 2, R * 2); g.restore(); }
      g.globalCompositeOperation = 'source-over';
    }
    if (WX.rain && !intro) {
      const n = hi ? 140 : 60, stt = sim._rain || (sim._rain = Array.from({ length: 160 }, () => ({ x: Math.random(), y: Math.random(), s: 0.6 + Math.random() * 0.8 })));
      g.strokeStyle = 'rgba(190,210,230,0.32)'; g.lineWidth = 1.2; g.beginPath();
      for (let i = 0; i < n; i++) { const d = stt[i]; d.y += 0.024 * d.s; d.x -= 0.004 * d.s; if (d.y > 1) { d.y -= 1; d.x = Math.random(); } if (d.x < 0) d.x += 1; const px = d.x * V.w, py = d.y * V.h; g.moveTo(px, py); g.lineTo(px - 5 * d.s, py + 18 * d.s); }
      g.stroke();
      if (hi) { g.strokeStyle = 'rgba(200,220,240,0.28)'; g.lineWidth = 1; for (let i = 0; i < 14; i++) { const px = (Math.sin(t * 3.1 + i * 7.7) * 0.5 + 0.5) * V.w, py = (Math.cos(t * 2.3 + i * 3.3) * 0.5 + 0.5) * V.h, r = ((t * 2 + i * 0.37) % 1) * 9; g.beginPath(); g.ellipse(px, py, r + 2, (r + 2) * 0.45, 0, 0, TAU); g.stroke(); } }
    }
    if (WX.fog && !intro && sim.wxk === 'fog') { const R0 = Math.min(V.w, V.h) * 0.42, gr = g.createRadialGradient(V.w / 2, V.h / 2 - 10, R0 * 0.5, V.w / 2, V.h / 2 - 10, Math.max(V.w, V.h) * 0.7); gr.addColorStop(0, 'rgba(170,175,185,0)'); gr.addColorStop(1, `rgba(170,175,185,${hi ? 0.5 : 0.42})`); g.fillStyle = gr; g.fillRect(0, 0, V.w, V.h); }
    if (hi && WX.fog && !intro) { const fogC = WX.tod === 'night' ? '120,130,150' : '200,190,180'; for (let i = 0; i < 5; i++) { const fx2 = ((i * 0.27 + t * 0.012 * (1 + i * 0.3)) % 1.4 - 0.2) * V.w, fy = (0.15 + 0.18 * i) * V.h, R = V.w * 0.35; const gr = g.createRadialGradient(fx2, fy, 0, fx2, fy, R); gr.addColorStop(0, `rgba(${fogC},0.07)`); gr.addColorStop(1, `rgba(${fogC},0)`); g.fillStyle = gr; g.fillRect(fx2 - R, fy - R, R * 2, R * 2); } }
    if (WX.heat && !intro) { g.fillStyle = `rgba(255,120,40,${0.07 + 0.03 * Math.sin(t * 1.3)})`; g.fillRect(0, 0, V.w, V.h); }
    if (hi && !intro && WX.tod !== 'night') { g.fillStyle = 'rgba(255,240,210,0.25)'; for (let i = 0; i < 18; i++) { const px = ((i * 97 + t * 14 * (1 + (i % 3))) % V.w), py = ((i * 53 + Math.sin(t * 0.7 + i) * 30) % V.h); g.fillRect(px, py, 2, 2); } }
    g.drawImage(vignette(V.w, V.h), 0, 0, V.w, V.h);
    if (intro) {
      const T2 = sim.introT, dark = T2 < 1.3 ? 0.85 : Math.max(0, 0.85 - (T2 - 1.3) * 0.6);
      if (dark > 0) { g.fillStyle = `rgba(5,4,3,${dark})`; g.fillRect(0, 0, V.w, V.h); }
      if (T2 > 1.3 && T2 < 3.2) { g.fillStyle = `rgba(255,240,200,${0.3 * Math.sin(((T2 - 1.3) / 1.9) * Math.PI)})`; g.fillRect(0, 0, V.w, V.h); }
    }
    if (sim.flash > 0) { g.fillStyle = `rgba(200,20,10,${sim.flash * 1.1})`; g.fillRect(0, 0, V.w, V.h); }
    else if (sim.flash < 0) { g.fillStyle = `rgba(230,255,160,${-sim.flash})`; g.fillRect(0, 0, V.w, V.h); }
    const lowHp = !sim.dead && sim.p.hp / sim.S.mhp < 0.3 && sim.phase === 'play';
    if (lowHp) { const a = 0.25 + 0.15 * Math.sin(t * 7); const gr = g.createRadialGradient(V.w / 2, V.h / 2, Math.min(V.w, V.h) * 0.35, V.w / 2, V.h / 2, Math.max(V.w, V.h) * 0.75); gr.addColorStop(0, 'rgba(255,0,0,0)'); gr.addColorStop(1, `rgba(170,0,0,${a})`); g.fillStyle = gr; g.fillRect(0, 0, V.w, V.h); }
    if (sim.buffs.freeze > 0) { g.fillStyle = 'rgba(160,220,255,0.10)'; g.fillRect(0, 0, V.w, V.h); }
    const DBf = sim.debuffs || {};
    if (DBf.blind > 0 && !sim.dead) { const R0 = Math.min(V.w, V.h) * 0.2, gr = g.createRadialGradient(V.w / 2, V.h / 2 - 10, R0 * 0.6, V.w / 2, V.h / 2 - 10, R0 * 1.6); gr.addColorStop(0, 'rgba(14,6,22,0)'); gr.addColorStop(1, `rgba(14,6,22,${Math.min(0.97, DBf.blind * 0.6)})`); g.fillStyle = gr; g.fillRect(0, 0, V.w, V.h); }
    if (DBf.confuse > 0) { g.fillStyle = `rgba(150,80,220,${0.12 + 0.06 * Math.sin(t * 6)})`; g.fillRect(0, 0, V.w, V.h); const [hx, hy] = C.toScreen(P.x, P.y, 110); fx(g, 'fx.twirl', Math.floor(t * 8), hx, hy, 0.5, { add: true }); setScreen(g); }
    if (DBf.web > 0) { g.strokeStyle = 'rgba(240,240,240,0.5)'; g.lineWidth = 2; g.beginPath(); for (let i = 0; i < 10; i++) { const a = (i * TAU) / 10; g.moveTo(V.w / 2, V.h / 2); g.lineTo(V.w / 2 + Math.cos(a) * V.w, V.h / 2 + Math.sin(a) * V.w); } g.stroke(); }
    if (sim.slowmo > 0) { g.fillStyle = `rgba(20,30,40,${Math.min(0.25, sim.slowmo * 0.4)})`; g.fillRect(0, 0, V.w, V.h); }
  }

  // what an area and its wave are going to need (asked for on entering, so it loads in time)
  function prefetchArea(sim) {
    const keys = [];
    for (const S2 of standFor(sim.area)) keys.push(S2.key);
    if (sim.spec && sim.spec.weights) for (const [k] of sim.spec.weights) keys.push('zombie.' + k);
    if (sim.spec && sim.spec.mini) keys.push(BOSSKEY[sim.spec.mini] || 'boss.final');
    if (sim.bossDue) keys.push('boss.dumpster');
    keys.push('pickup.coins', 'pickup.xp.green', 'pickup.xp.pink', 'prop.barrier.striped', 'prop.fence.metal');
    keys.push(...Object.values(VEH));
    for (const p of W().PICKUPS) keys.push('pickup.' + p.id);
    prefetch(keys);
  }

  // ---------------- the showcase: a little scripted scene for the title screen and the TV intro ----------------
  // A real town block (your garage on a crossroads) at dusk: zombies shamble in, the roll-up door lifts,
  // your character steps out and takes a few of them down. o.intro: the timeline below (seconds); else a loop.
  const SHOW_KEYS = CORE.concat(['zombie.screamer', 'zombie.canhead', 'zombie.brute', 'zombie.crawler', 'pickup.xp.green', 'prop.lamp2', 'prop.dumpster', 'prop.car2', 'prop.taxi', 'prop.police', 'prop.van', 'prop.wreck.burnt', 'prop.pine', 'prop.tree2', 'bld.house3', 'bld.house4']);
  let SH = null;
  function showSetup() {
    if (SH) return SH;
    const area = W().genArea(11, 4, 4, true), G = area.garage, cx = G.x + G.w / 2, fy = G.y + G.h;
    const types = ['walker', 'runner', 'bloater', 'walker', 'screamer', 'canhead', 'walker', 'crawler', 'walker', 'brute'];
    const Z = types.map((type, i) => { const a = -0.3 + (i / types.length) * Math.PI * 1.4 + (i % 2) * 0.2, R = 560 + (i % 3) * 90; return { type, id: i + 1, r: 20, hp: 1, mhp: 1, speed: type === 'runner' ? 120 : 60, flash: 0, sx: cx + Math.cos(a) * R, sy: fy + 140 + Math.sin(a) * R * 0.75, die: [6.4, 6.9, 7.5, 8.1, 8.6, 9.2, 9.9, 10.5, 11.1, 11.8][i], x: 0, y: 0 }; });
    SH = { area, G, cx, fy, Z, hero: { x: cx, y: G.y + 120 }, sim: { phase: 'play', _doorOpen: 0, p: { x: -9999, y: -9999 }, t: 0 }, corpses: [], fx: [] };
    return SH;
  }
  function showcase(g, Wd, Hd, dpr, t, o = {}) {
    if (!st.ready) return false;
    const S = showSetup(), { area, G, cx, fy } = S, loop = !o.intro, T = loop ? 4.6 + (t % 9) : t;
    // the timeline
    const door = clamp((T - 2.4) / 1.8, 0, 1), heroK = clamp((T - 4.4) / 1.3, 0, 1);
    const hx = cx, hy = G.y + 120 + (fy + 150 - (G.y + 120)) * (heroK < 1 ? heroK : 1);
    S.sim._doorOpen = door;
    // camera: a slow drift toward the driveway; the intro starts wider on the street
    const zoom = Hd / (loop ? 600 : 760 - 160 * clamp(T / 7, 0, 1)), fxp = cx + (loop ? Math.sin(t * 0.1) * 40 : 160 * (1 - clamp(T / 5, 0, 1))), fyp = fy + (loop ? 330 : 130);
    Object.assign(C, { s: zoom, k: zoom * 0.8, dpr, w: Wd, h: Hd, cx: isoX(fxp, fyp), cy: isoY(fxp, fyp) - 30, sx: 0, sy: 0 });
    setScreen(g); g.fillStyle = '#0c0a08'; g.fillRect(0, 0, Wd, Hd);
    const q = Math.min(1, Math.max(0.6, zoom * dpr * 0.8));
    if (!S.bg || Math.abs(S.bg.q - q) > 0.25) S.bg = groundFor(area, q);
    const B = S.bg, bx = (C.cx - Wd / 2 / zoom - B.ix0) * B.q, by = (C.cy - Hd / 2 / zoom - B.iy0) * B.q;
    { const sx0 = Math.max(0, bx), sy0 = Math.max(0, by), sw = Math.min(B.canvas.width - sx0, Wd / zoom * B.q), shh = Math.min(B.canvas.height - sy0, Hd / zoom * B.q); if (sw > 0 && shh > 0) g.drawImage(B.canvas, sx0, sy0, sw, shh, (sx0 - bx) / B.q * zoom, (sy0 - by) / B.q * zoom, sw / B.q * zoom, shh / B.q * zoom); }
    // zombies: walk in, stop near you, drop when shot (death animation, blood)
    const list = [], hero = { _d: hx + hy, k: 'hero' }, aimAt = [];
    for (const z of S.Z) {
      const T0 = loop ? 0 : 0.2, u = clamp((T - T0) / 7, 0, 1), tx = hx + (z.sx - hx) * 0.22, ty = hy + 60 + (z.sy - hy) * 0.22;
      z.x = z.sx + (tx - z.sx) * u; z.y = z.sy + (ty - z.sy) * u; z.dir = dirOf(tx - z.sx, ty - z.sy);
      if (heroK >= 1 && T >= z.die) { const dt2 = T - z.die; if (dt2 < 0.1) aimAt.push(z); const key = 'zombie.' + z.type, Pk = need(key); if (Pk && Pk.anims.death) { const D = Pk.anims.death; S.corpses.length = 0; z._dead = { fi: Math.min(D.n - 1, Math.floor(dt2 * D.fps)), a: clamp((loop ? 9 : 99) - dt2, 0, 1) }; } continue; }
      z._dead = null; z._d = z.x + z.y; list.push(z);
    }
    // the bodies (under everything that stands)
    for (const z of S.Z) if (z._dead) { const [X, Y] = C.toScreen(z.x, z.y); sprite(g, 'zombie.' + z.type, 'death', z.dir, z._dead.fi, X, Y, zoom * CH, { alpha: z._dead.a }); if (z._dead.fi < 3) { fx(g, 'fx.blood.spurt', z._dead.fi * 2, X, Y - 40 * zoom, 0.7); } }
    for (const S2 of standFor(area)) { S2._d = S2.depth; list.push(S2); }
    for (const part of garageParts(area)) { part._d = part.depth; list.push(part); }
    if (heroK > 0) list.push(hero);
    list.sort((a, b) => a._d - b._d);
    const target = S.Z.filter((z) => !z._dead && heroK >= 1).sort((a, b) => a.die - b.die)[0];
    const aim = target ? Math.atan2(target.y - hy, target.x - hx) : Math.PI / 2, aS = screenAngle(aim), face = Math.cos(aS) >= 0 ? 1 : -1;
    const shooting = target && T > target.die - 0.5;
    for (const q2 of list) {
      if (q2.k === 'obs') { const [X, Y] = C.toScreen(q2.x, q2.y); sprite(g, q2.key, 'static', q2.row, 0, X, Y, zoom * q2.sc); continue; }
      if (q2.k === 'garage') { q2.draw(g, S.sim, t); continue; }
      if (q2.k === 'hero') {
        const [X, Y] = C.toScreen(hx, hy); setScreen(g); g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.ellipse(X + 5 * zoom, Y + zoom, 22 * zoom, 9 * zoom, 0, 0, TAU); g.fill();
        const who = o.who || { id: 'jz-hero', name: 'You', color: '#ffd23f' }, kp = Math.max(0.3, Math.round(zoom * HB * dpr * 10) / 10);
        setBill(g, hx, hy, 0, HB); window.TZSim.heroDraw(g, who, hx, hy, { k: kp, moving: heroK < 1, walkT: t, face: heroK < 1 ? 1 : face });
        if (heroK >= 1) { const Pk = need('weapon.shotgun') || need('weapon.pistol'); if (Pk) { const fr = Pk.anims.spin.rows.S[0], sc = zoom * 0.8 * Pk.sc, D = C.dpr, c = Math.cos(aS), sn = Math.sin(aS), fy2 = c < 0 ? -1 : 1, gx = X + face * 10 * zoom, gy = Y - 34 * zoom; g.setTransform(-c * D, -sn * D, -sn * fy2 * D, c * fy2 * D, gx * D, gy * D); g.drawImage(fr.c, fr.px, fr.py, fr.pw, fr.ph, -fr.w * sc * 0.65, -fr.h * 0.42 * sc, fr.w * sc, fr.h * sc); if (shooting && Math.sin(t * 40) > 0) fx(g, 'fx.muzzle', Math.floor(t * 30) % fxLen('fx.muzzle'), gx + c * fr.w * sc * 0.6, gy + sn * fr.w * sc * 0.6, 0.45, { rot: aS, add: true }); } }
        continue;
      }
      const [X, Y] = C.toScreen(q2.x, q2.y), Pk = need('zombie.' + q2.type); if (!Pk) continue;
      const near = Math.hypot(q2.x - hx, q2.y - hy) < 200 && heroK >= 1, an = near ? 'attack' : q2.type === 'runner' ? 'run' : 'walk';
      sprite(g, Pk, animName(Pk, an), q2.dir, animFrame(Pk, animName(Pk, an), t + q2.id * 0.3), X, Y, zoom * CH, { flash: shooting && q2 === target && Math.sin(t * 30) > 0 ? 0.7 : 0 });
    }
    // dusk: warm tint, the porch light, a vignette
    setScreen(g);
    g.fillStyle = 'rgba(255,120,50,0.12)'; g.fillRect(0, 0, Wd, Hd); g.fillStyle = 'rgba(40,14,30,0.22)'; g.fillRect(0, 0, Wd, Hd);
    if (door > 0) { const [lx, ly] = C.toScreen(cx, fy + 40); const R = 260 * zoom, gr = g.createRadialGradient(lx, ly, 0, lx, ly, R); gr.addColorStop(0, `rgba(255,220,150,${0.35 * door})`); gr.addColorStop(1, 'rgba(255,220,150,0)'); g.globalCompositeOperation = 'lighter'; g.fillStyle = gr; g.save(); g.translate(lx, ly); g.scale(1, 0.6); g.translate(-lx, -ly); g.fillRect(lx - R, ly - R, R * 2, R * 2); g.restore(); g.globalCompositeOperation = 'source-over'; }
    g.drawImage(vignette(Wd, Hd), 0, 0, Wd, Hd);
    return true;
  }

  window.TZI_HELI = { heliAt, gunPreview };
  const TZI = window.TZI = { bodyOf, bodyBox, hitPoint, chestH, SHOT_H, ZOOM_OUT, fxImage: () => FX.img, topFor, E, SHOW_KEYS, showcase, ready: false, boot, need, has, prefetch, prefetchArea, render, sprite, fx, dirOf, dirToWorld, screenAngle, toScreen: C.toScreen, cam: C, C, st, setGround, setScreen, setBill, prism, groundFor, standFor, garageParts, iso: { HX, HY, HZ, CH, BB }, manifest: () => M, zKey, drawZombie, zState, animFrame, animName, BOSSKEY, VEH, keyOf };
})();
