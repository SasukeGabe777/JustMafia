'use strict';
// JustZombies: driving in FIRST PERSON (window.TZFP). When you climb into a ride, the phone switches to
// a real 3D view from inside it (three.js r160, MIT, vendored at /box/games/lib/three.module.js and
// loaded only when the game starts). The town is the same block you are in: the textured floor from
// the iso renderer (roads, lots, paint), buildings and parked cars as lit boxes with window textures,
// trees and street furniture as billboards from the CC0 iso atlases, and the zombies as animated
// billboards from the same sprite sheets (walk / attack / death), facing the right way for the camera.
// Light on purpose: short draw distance + fog, one shared texture per atlas page, a sprite pool,
// a low pixel ratio on Low graphics. No WebGL -> rides stay in the iso view.
//   TZFP.supported()            WebGL is there
//   TZFP.prepare()              start loading three.js
//   TZFP.render(sim, V, cv)     draw the 3D frame into the WebGL canvas cv
//   TZFP.overlay(g, sim, V, dt) the dashboard / handlebars / tank hatch, blood on the glass, crosshair, timer
//   TZFP.controls(V, sim)       the on-screen pedals (and FIRE in a tank): [{ id, x, y, r }]
(function () {
  const TAU = Math.PI * 2;
  let THREE = null, loading = null, ok = null;
  const st = { ready: false };
  function supported() {
    if (ok != null) return ok;
    try { const c = document.createElement('canvas'); ok = !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl'))); } catch { ok = false; }
    return ok;
  }
  function prepare() {
    if (loading || !supported()) return loading;
    loading = import('/box/games/lib/three.module.js').then((m) => { THREE = m; st.ready = true; TZFP.ready = true; }).catch((e) => { console.warn('[JustZombies 3D]', e && e.message); ok = false; });
    return loading;
  }
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  // ---------------- the scene for an area ----------------
  let R = null, S = null; // renderer, scene state
  const HEIGHT = { house: 190, tower: 430, store: 230, mall: 260, school: 240, plant: 300, warehouse: 270, shack: 140, kiosk: 150, tent: 170 };
  const WALL = { house: ['#cdbfa6', '#a9b4b8', '#c9a27e', '#b9b1a4'], tower: ['#7d6253', '#8b8f94', '#6e5a4c'], store: ['#d2c7b3', '#b5895a'], mall: ['#cfc6b4'], school: ['#a85d45'], plant: ['#8f948c'], warehouse: ['#8d9298', '#7a6a58'], shack: ['#8a7660'], kiosk: ['#cfc6b4'], tent: ['#c23a3a'] };
  const ROOF = { house: '#5a4a44', tower: '#55524c', store: '#6d6a63', mall: '#77736b', school: '#6b5f55', plant: '#5f625b', warehouse: '#5d6268', shack: '#6d7378', kiosk: '#6d6a63', tent: '#9a2a2a' };
  const BOXP = { car: [150, 70, 80], wreck: [150, 60, 80], bus: [230, 110, 90], stack: [150, 110, 80], container: [230, 110, 90], fridge: [50, 90, 45], cart: [60, 50, 45], barrier: [140, 45, 30], pump: [50, 90, 50], crate: [55, 55, 55], dumpster: [130, 65, 70], bench: [110, 30, 30], booth: [140, 120, 140], picnic: [120, 35, 70], tank: [140, 150, 140], pipe: [220, 40, 40] };
  const BOXC = { car: ['#c0392b', '#2f6db5', '#d9c08a', '#3d8a4a', '#e8e2d4'], wreck: ['#6a5a4a', '#4a4440', '#7a3a2a'], bus: ['#d9b030'], stack: ['#5a5048'], container: ['#a83a2a', '#3d6a3a', '#2f5a8a'], fridge: ['#e8e2d4'], cart: ['#9aa2aa'], barrier: ['#c9c3b4'], pump: ['#d9483a'], crate: ['#8a5a2a'], dumpster: ['#2f6a4a'], bench: ['#6a4a2a'], booth: ['#c0392b'], picnic: ['#7a5a3a'], tank: ['#c9b080'], pipe: ['#7a8088'] };
  const BILL = { tree: ['prop.tree', 'prop.tree2', 'prop.pine', 'prop.tree.dead'], lamp: ['prop.lamp'], hydrant: ['prop.hydrant'], bin: ['prop.bin', 'prop.bin2'], hedge: ['prop.hedge'], bush: ['prop.bush'], planter: ['prop.planter'], barrel: ['prop.barrel', 'prop.barrel.rusty'], tires: ['prop.tires'], trash: ['prop.bags2'], bags: ['prop.bags'], mailbox: ['prop.hydrant'], mound: ['prop.mound'], balloons: ['prop.sign'], rope: ['prop.tires'] };
  const pick = (a, v) => a[(v || 0) % a.length];
  function facade(wall, roofLike, seed) {
    const c = document.createElement('canvas'); c.width = 128; c.height = 128; const g = c.getContext('2d');
    g.fillStyle = wall; g.fillRect(0, 0, 128, 128);
    g.fillStyle = 'rgba(0,0,0,0.08)'; for (let y = 0; y < 128; y += 8) g.fillRect(0, y, 128, 1);
    if (!roofLike) for (let y = 14; y < 120; y += 40) for (let x = 12; x < 120; x += 38) { const lit = ((x * 7 + y * 3 + seed) % 5) === 0; g.fillStyle = lit ? '#ffd98a' : '#26303a'; g.fillRect(x, y, 22, 24); g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(x, y, 22, 4); g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 2; g.strokeRect(x, y, 22, 24); }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t;
  }
  // one CanvasTexture per atlas page; each sprite gets a clone (same GPU image, its own UVs)
  const pageTex = new Map();
  function texFor(canvas) { let t = pageTex.get(canvas); if (!t) { t = new THREE.CanvasTexture(canvas); t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter; t.generateMipmaps = false; pageTex.set(canvas, t); } return t; }
  function setFrame(sp, fr, P, scale) {
    const base = texFor(fr.c); let tx = sp.userData.tx && sp.userData.tx.get(fr.c);
    if (!tx) { tx = base.clone(); tx.needsUpdate = false; (sp.userData.tx || (sp.userData.tx = new Map())).set(fr.c, tx); }
    if (sp.material.map !== tx) { sp.material.map = tx; sp.material.needsUpdate = true; }
    const W0 = fr.c.width, H0 = fr.c.height; tx.offset.set(fr.px / W0, 1 - (fr.py + fr.ph) / H0); tx.repeat.set(fr.pw / W0, fr.ph / H0);
    const k = P.sc * scale / 0.98; sp.scale.set(fr.w * k, fr.h * k, 1); sp.center.set(fr.ax / fr.w, 1 - fr.ay / fr.h);
  }
  // (alphaTest 0.5: clean cut-outs; the sheets' baked ground shadow, ~0.3-0.4 alpha, is left out in 3D)
  function makeSprite() { const m = new THREE.SpriteMaterial({ transparent: true, alphaTest: 0.5, fog: true }); const sp = new THREE.Sprite(m); sp.userData = {}; return sp; }
  function build(sim) {
    const Z = window.TZW, area = sim.area, I = window.TZI, E = I.E, AW = Z.AW, AH = Z.AH;
    const scene = new THREE.Scene(), WX = sim._wx || {}, night = WX.tod === 'night', dusk = WX.tod === 'dusk';
    const fogC = night ? 0x0d1424 : dusk ? 0x6b3a50 : 0x8a8e96;
    scene.fog = new THREE.Fog(fogC, 220, night ? 760 : 1000);
    const sky = document.createElement('canvas'); sky.width = 4; sky.height = 128; const sg = sky.getContext('2d'), gr = sg.createLinearGradient(0, 0, 0, 128);
    if (night) { gr.addColorStop(0, '#05070f'); gr.addColorStop(1, '#1a2238'); } else if (dusk) { gr.addColorStop(0, '#24163a'); gr.addColorStop(0.6, '#6b3550'); gr.addColorStop(1, '#e0794a'); } else { gr.addColorStop(0, '#5a6372'); gr.addColorStop(1, '#a9adb3'); }
    sg.fillStyle = gr; sg.fillRect(0, 0, 4, 128); const skyT = new THREE.CanvasTexture(sky); skyT.colorSpace = THREE.SRGBColorSpace; scene.background = skyT;
    scene.add(new THREE.HemisphereLight(night ? 0x8090c0 : 0xffe6d0, 0x404030, night ? 0.9 : 1.6));
    const sun = new THREE.DirectionalLight(night ? 0x9fb0ff : 0xffd2a0, night ? 0.6 : 1.4); sun.position.set(-300, 600, -200); scene.add(sun);
    // the floor: the same textured top view the iso view projects
    const top = I.topFor(area, sim._lowGfx ? 0.45 : 0.7), gt = new THREE.CanvasTexture(top); gt.colorSpace = THREE.SRGBColorSpace; gt.anisotropy = 4;
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(AW + 2 * E, AH + 2 * E), new THREE.MeshLambertMaterial({ map: gt }));
    ground.rotation.x = -Math.PI / 2; ground.position.set(AW / 2, 0, AH / 2); scene.add(ground);
    // the world past the floor: a dark plain so the horizon isn't empty
    const far = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000), new THREE.MeshBasicMaterial({ color: night ? 0x0b0d10 : 0x2a2622 })); far.rotation.x = -Math.PI / 2; far.position.set(AW / 2, -1, AH / 2); scene.add(far);
    const mats = new Map(), mat = (key, make) => { if (!mats.has(key)) mats.set(key, make()); return mats.get(key); };
    const box = (x, y, w, h, H, side, topC) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, H, h), [side, side, topC, topC, side, side]); m.position.set(x + w / 2, H / 2, y + h / 2); scene.add(m); return m; };
    const bills = [];
    for (const o of area.obstacles) {
      if (o.kind === 'wall' || o.kind === 'none') continue;
      if (o.kind === 'bld') {
        const H = HEIGHT[o.style] || 200, wall = pick(WALL[o.style] || WALL.house, o.v);
        const side = mat('w' + wall + o.style, () => { const t = facade(wall, false, o.seed || 0); t.repeat.set(1, 1); return new THREE.MeshLambertMaterial({ map: t }); });
        const roof = mat('r' + o.style, () => new THREE.MeshLambertMaterial({ color: ROOF[o.style] || '#5a5a5a' }));
        const m = box(o.x, o.y, o.w, o.h, H, side, roof); m.geometry.attributes.uv && scaleUV(m.geometry, o.w, o.h, H);
        continue;
      }
      if (BILL[o.kind]) { bills.push({ key: pick(BILL[o.kind], o.v), x: o.x + o.w / 2, y: o.y + o.h / 2, sc: o.kind === 'tree' ? 1 : 0.9 }); continue; }
      const P = BOXP[o.kind]; if (!P) continue;
      const col = pick(BOXC[o.kind] || ['#7a7a7a'], o.v), side = mat('p' + col, () => new THREE.MeshLambertMaterial({ color: col })), topm = mat('pt' + col, () => new THREE.MeshLambertMaterial({ color: new THREE.Color(col).multiplyScalar(0.75) }));
      box(o.x + 4, o.y + 4, Math.max(20, o.w - 8), Math.max(20, o.h - 8), P[1], side, topm);
      if (o.kind === 'car' || o.kind === 'wreck') { const glass = mat('glass', () => new THREE.MeshLambertMaterial({ color: 0x1c2630 })); const g2 = box(o.x + o.w * 0.25, o.y + o.h * 0.15, o.w * 0.5, o.h * 0.7, 30, glass, glass); g2.position.y = P[1] + 15; }
    }
    // the garage, the shop / landmark spot
    const G = area.garage; if (G) { const side = mat('garage', () => new THREE.MeshLambertMaterial({ map: facade('#c9b79a', false, 3) })), roof = mat('groof', () => new THREE.MeshLambertMaterial({ color: '#5b3a32' })); box(G.x, G.y, G.w, G.h, 160, side, roof); }
    if (area.spot && sim.placeType && sim.placeType()) { const S2 = area.spot, side = mat('shop', () => new THREE.MeshLambertMaterial({ map: facade('#b5895a', false, 9) })), roof = mat('shoproof', () => new THREE.MeshLambertMaterial({ color: '#4a3a30' })); box(S2.x, S2.y, S2.w, S2.h * 0.7, 200, side, roof); }
    // the fence along the closed edges
    const fm = mat('fence', () => new THREE.MeshLambertMaterial({ color: 0x5a6168, transparent: true, opacity: 0.75 })), ex = area.exits;
    const fence = (x0, y0, x1, y1) => { const L = Math.hypot(x1 - x0, y1 - y0); if (L < 4) return; const m = new THREE.Mesh(new THREE.BoxGeometry(L, 60, 4), fm); m.position.set((x0 + x1) / 2, 30, (y0 + y1) / 2); m.rotation.y = -Math.atan2(y1 - y0, x1 - x0); scene.add(m); };
    const run = (fixed, horiz, gap) => { const L = horiz ? AW : AH; if (!gap) { horiz ? fence(0, fixed, L, fixed) : fence(fixed, 0, fixed, L); return; } const a = gap.p - gap.w / 2 - 34, b = gap.p + gap.w / 2 + 34; if (horiz) { fence(0, fixed, a, fixed); fence(b, fixed, L, fixed); } else { fence(fixed, 0, fixed, a); fence(fixed, b, fixed, L); } };
    run(0, true, ex.n); run(AH, true, ex.s); run(0, false, ex.w); run(AW, false, ex.e);
    // billboards (trees, lamps, bins) from the iso atlases
    const props = [];
    for (const b of bills) { const sp = makeSprite(); sp.position.set(b.x, 0, b.y); scene.add(sp); props.push({ sp, ...b }); }
    // a pool for the zombies, bodies, pickups and blasts
    const pool = []; for (let i = 0; i < 70; i++) { const sp = makeSprite(); sp.visible = false; scene.add(sp); pool.push(sp); }
    const fxPool = []; for (let i = 0; i < 24; i++) { const m = new THREE.SpriteMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }); const sp = new THREE.Sprite(m); sp.visible = false; sp.userData = {}; scene.add(sp); fxPool.push(sp); }
    const cam = new THREE.PerspectiveCamera(72, 16 / 9, 4, night ? 900 : 1150);
    return { area, scene, cam, props, pool, fxPool, ground, mats };
  }
  function scaleUV(geo, w, d, H) { // windows repeat with the wall size (about one window block per 1.6 m)
    const uv = geo.attributes.uv, n = uv.count; for (let i = 0; i < n; i++) { const face = Math.floor(i / 4); const sx = face < 2 ? d / 90 : face < 4 ? 1 : w / 90, sy = face === 2 || face === 3 ? 1 : H / 90; uv.setXY(i, uv.getX(i) * sx, uv.getY(i) * sy); } uv.needsUpdate = true;
  }
  // which of the 8 art rows a body facing world angle phi shows to a camera looking along yaw
  const DIRS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  function relDir(phi, yaw) { let a = phi - yaw; a = Math.atan2(Math.sin(a), Math.cos(a)); return DIRS[((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8]; }
  const HEAD = { cart: 52, push: 55, mower: 62, gtruck: 120, tank: 120 };
  function render(sim, V, cv) {
    if (!st.ready || !THREE) return false;
    const I = window.TZI; if (!I || !I.ready) return false;
    if (!R || R.domElement !== cv) { R = new THREE.WebGLRenderer({ canvas: cv, antialias: false, powerPreference: 'low-power', alpha: false }); R.outputColorSpace = THREE.SRGBColorSpace; }
    const low = !V.hi, pr = Math.min(1.5, V.dpr) * (low ? 0.6 : 0.9);
    if (R.getPixelRatio() !== pr) R.setPixelRatio(pr);
    const sz = R.getSize(new THREE.Vector2()); if (sz.x !== V.w || sz.y !== V.h) R.setSize(V.w, V.h, false);
    sim._lowGfx = low;
    if (!S || S.area !== sim.area) { if (S) disposeScene(S); S = build(sim); }
    const P = sim.p, r = sim.ride || (sim.fpOut && sim._lastRide) || {}, t = sim.t;
    if (sim.ride) sim._lastRide = sim.ride;
    const yaw = r.kind === 'tank' ? (r.tur != null ? r.tur : r.head || 0) : (r.head || 0), cam = S.cam;
    cam.aspect = V.w / V.h; cam.fov = V.w > V.h ? 66 : 80; cam.updateProjectionMatrix();
    const sh = sim.shake > 0 ? sim.shake * 10 : 0, bob = Math.abs(r.spd || 0) * Math.sin(t * 18) * (r.kind === 'cart' ? 2.2 : 1);
    const H = HEAD[r.kind] || 70;
    cam.position.set(P.x - Math.cos(yaw) * (r.kind === 'tank' ? 30 : 6) + (Math.random() - 0.5) * sh, H + bob + (Math.random() - 0.5) * sh, P.y - Math.sin(yaw) * (r.kind === 'tank' ? 30 : 6));
    cam.lookAt(P.x + Math.cos(yaw) * 200, H - 18, P.y + Math.sin(yaw) * 200);
    S.yaw = yaw;
    // billboards: the props
    for (const b of S.props) { const Pk = I.need(b.key); if (!Pk) continue; const F = Pk.anims.static; if (!F) continue; const rows = F.rows, fr = (rows.S || rows.SE || rows[Object.keys(rows)[0]])[0]; setFrame(b.sp, fr, Pk, b.sc * 0.82); }
    // zombies (alive: walk / attack; dead: their death animation, then they fade)
    let n = 0; const pool = S.pool, near = (x, y, m) => { const dx = x - P.x, dy = y - P.y; if (dx * dx + dy * dy > m * m) return false; const a = Math.atan2(dy, dx) - yaw; return Math.cos(a) > -0.2 || dx * dx + dy * dy < 160 * 160; };
    const dt = Math.min(0.1, Math.max(0, t - (S.lt == null ? t : S.lt))); S.lt = t;
    for (const z of sim.z) {
      if (n >= pool.length) break; if (!(z.hp > 0) || !near(z.x, z.y, 1000)) continue;
      if ((z.x - P.x) * (z.x - P.x) + (z.y - P.y) * (z.y - P.y) < 80 * 80) continue; // (right at the bumper: not drawn, no blurry giant on the glass)
      const key = I.zKey(z), Pk = I.need(key); if (!Pk) continue;
      const A = I.zState(z, dt, sim.dead ? null : P), an = Pk.anims.static ? 'static' : I.animName(Pk, A.an), fi = Pk.anims.static ? 0 : I.animFrame(Pk, an, A.ft);
      const phi = A.an === 'attack' ? Math.atan2(P.y - z.y, P.x - z.x) : Math.atan2(A.vy || 0.01, A.vx || 0.01);
      const F = Pk.anims[an]; if (!F) continue; let d = relDir(phi, yaw), flip = false; if (!F.rows[d]) { const m = { SW: 'SE', W: 'E', NW: 'NE' }[d]; if (m && F.rows[m]) { d = m; flip = true; } else d = Object.keys(F.rows)[0]; }
      const list = F.rows[d], fr = list[fi % list.length], sp = pool[n++];
      setFrame(sp, fr, Pk, z.boss || z.fb || z.mb ? 1 : 0.8); if (flip) { sp.scale.x *= -1; sp.center.x = 1 - sp.center.x; }
      sp.position.set(z.x, 0, z.y); sp.visible = true; sp.material.color.setScalar(z.flash > 0 ? 2.2 : 1);
    }
    for (const c of sim.corpses) {
      if (n >= pool.length) break; if (!near(c.x, c.y, 800)) continue; const key = c.boss ? (I.BOSSKEY[c.boss] || 'boss.final') : 'zombie.' + c.type, Pk = I.need(key); if (!Pk || !Pk.anims.death) continue;
      const D = Pk.anims.death, fi = Math.min(D.n - 1, Math.floor(c.t * D.fps)), rows = D.rows, d = rows.SE ? 'SE' : Object.keys(rows)[0], fr = rows[d][fi], sp = pool[n++];
      setFrame(sp, fr, Pk, c.boss ? 1 : 0.8); sp.position.set(c.x, 0, c.y); sp.visible = true; sp.material.color.setScalar(1); sp.material.opacity = clamp((c.life - c.t) / 1.2, 0, 1);
    }
    for (const q of sim.gems) { if (n >= pool.length) break; if (!near(q.x, q.y, 600)) continue; const Pk = I.need('pickup.xp'); if (!Pk) continue; const fr = Pk.anims.spin.rows.S[Math.floor(t * 10) % 8], sp = pool[n++]; setFrame(sp, fr, Pk, 1.6); sp.position.set(q.x, 8 + Math.sin(t * 4 + q.x) * 4, q.y); sp.visible = true; sp.material.opacity = 1; }
    for (const p of sim.pk) { if (n >= pool.length) break; if (!near(p.x, p.y, 800)) continue; const Pk = I.need('pickup.' + p.k); if (!Pk) continue; const fr = Pk.anims.spin.rows.S[Math.floor(t * 10) % 8], sp = pool[n++]; setFrame(sp, fr, Pk, 2.4); sp.position.set(p.x, 10 + Math.sin(t * 4) * 6, p.y); sp.visible = true; sp.material.opacity = 1; }
    for (let i = n; i < pool.length; i++) { pool[i].visible = false; pool[i].material.opacity = 1; }
    // blasts, fire and smoke from the fx atlas; the tank's shells
    let k = 0; const fxImg = I.fxImage && I.fxImage();
    if (fxImg) {
      const M = I.manifest();
      const put = (name, fi, x, y, h, size, add) => { if (k >= S.fxPool.length) return; const F = M.fx[name]; if (!F) return; const fr = F.frames[Math.min(F.frames.length - 1, fi)], sp = S.fxPool[k++]; let tx = sp.userData.t; if (!tx) { tx = sp.userData.t = new THREE.CanvasTexture(fxImg); tx.colorSpace = THREE.SRGBColorSpace; sp.material.map = tx; sp.material.needsUpdate = true; } const W0 = fxImg.width, H0 = fxImg.height; tx.offset.set(fr[0] / W0, 1 - (fr[1] + fr[3]) / H0); tx.repeat.set(fr[2] / W0, fr[3] / H0); sp.material.blending = add ? THREE.AdditiveBlending : THREE.NormalBlending; sp.scale.set(size * fr[2] / 128, size * fr[3] / 128, 1); sp.position.set(x, h, y); sp.visible = true; };
      for (const f of sim.fx) { if (!near(f.x, f.y, 900)) continue; const u = f.t / f.life; if (f.k === 'fire') put('fx.explosion', Math.floor(u * 9), f.x, f.y + 10, 40, f.r * 2.4, true); else if (f.k === 's' && k < 16) put('fx.smoke', Math.floor(u * 10), f.x, f.y, 30 + u * 40, f.r * 2.5, false); else if (f.k === 'spurt' && k < 20) put(f.goo ? 'fx.goo.spurt' : 'fx.blood.spurt', Math.floor(u * 8), f.x, f.y + 30, 50, 90, false); }
      for (const s2 of sim.shells || []) { const u = s2.t / s2.T; put('fx.glow', 0, s2.x0 + (s2.x - s2.x0) * u, s2.y0 + (s2.y - s2.y0) * u, 90 - 40 * u, 40, true); }
    }
    for (let i = k; i < S.fxPool.length; i++) S.fxPool[i].visible = false;
    R.render(S.scene, cam);
    S.cam = cam; return true;
  }
  function disposeScene(Sx) { Sx.scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) { const m = Array.isArray(o.material) ? o.material : [o.material]; for (const mm of m) { if (mm.map && !pageTex.has(mm.map.image)) mm.map.dispose(); mm.dispose(); } } }); }
  // where a world point shows on screen (for the lock-on box)
  function project(x, y, h) { if (!S || !THREE) return null; const v = new THREE.Vector3(x, h, y).project(S.cam); if (v.z > 1) return null; return [(v.x * 0.5 + 0.5), (-v.y * 0.5 + 0.5)]; }

  // ---------------- the 2D layer: the cab, blood on the glass, the dials ----------------
  const blood = [];
  let lastSplat = 0;
  function controls(V, sim) {
    const r = sim.ride, small = Math.min(V.w, V.h) < 420, R0 = small ? 34 : 42, L = [];
    if (!r) return L;
    L.push({ id: 'gas', x: V.w - R0 - 24, y: V.h - R0 - 24, r: R0, label: 'GAS', c: '#7dff6a' });
    L.push({ id: 'brake', x: V.w - R0 * 3 - 40, y: V.h - R0 * 0.8 - 22, r: R0 * 0.8, label: 'BRAKE', c: '#ff6a5a' });
    if (r.kind === 'tank') L.push({ id: 'fire', x: V.w - R0 * 1.2 - 24, y: V.h * 0.42, r: R0 * 1.2, label: 'FIRE', c: '#ffb02e' });
    return L;
  }
  function overlay(g, sim, V, dt, held) {
    const w = V.w, h = V.h, r = sim.ride || sim._lastRide || {}, t = sim.t, kind = r.kind, P = sim.p;
    g.setTransform(V.dpr, 0, 0, V.dpr, 0, 0); g.clearRect(0, 0, w, h);
    // blood on the windshield after a ram kill
    if ((sim.splatN || 0) > lastSplat) { for (let i = lastSplat; i < sim.splatN; i++) for (let j = 0; j < 3; j++) if (blood.length < 18) blood.push({ x: 0.15 + Math.random() * 0.7, y: 0.1 + Math.random() * 0.45, r: 0.03 + Math.random() * 0.06, a: 0.85, rot: Math.random() * TAU }); lastSplat = sim.splatN; }
    const I = window.TZI, M = I && I.manifest && I.manifest(), fxImg = I && I.fxImage && I.fxImage();
    for (let i = blood.length - 1; i >= 0; i--) { const b = blood[i]; b.a -= dt * 0.22; b.y += dt * 0.01; if (b.a <= 0) { blood.splice(i, 1); continue; } g.globalAlpha = b.a; if (fxImg && M) { const fr = M.fx['fx.decal.blood'].frames[i % 6], s = (b.r * w) / 60; g.save(); g.translate(b.x * w, b.y * h); g.rotate(b.rot); g.drawImage(fxImg, fr[0], fr[1], fr[2], fr[3], -fr[4] * s, -fr[5] * s, fr[2] * s, fr[3] * s); g.restore(); } else { g.fillStyle = '#7a0a08'; g.beginPath(); g.arc(b.x * w, b.y * h, b.r * w, 0, TAU); g.fill(); } }
    g.globalAlpha = 1;
    const steer = (sim._drvIn && sim._drvIn.steer) || 0;
    if (kind === 'gtruck') { // the cab: pillars, a dashboard, the big wheel
      g.fillStyle = '#1c2024'; g.beginPath(); g.moveTo(0, 0); g.lineTo(w * 0.07, 0); g.lineTo(w * 0.02, h); g.lineTo(0, h); g.fill(); g.beginPath(); g.moveTo(w, 0); g.lineTo(w * 0.93, 0); g.lineTo(w * 0.98, h); g.lineTo(w, h); g.fill(); g.fillRect(0, 0, w, h * 0.05);
      dash(g, w, h, '#2b3a2e', '#3d8a4a'); wheel(g, w * 0.34, h * 0.93, h * 0.28, steer, '#1c1f22');
    } else if (kind === 'cart') { // the cart's handle and the wire basket
      g.strokeStyle = 'rgba(200,210,220,0.65)'; g.lineWidth = 2; g.beginPath(); for (let x = -0.1; x < 1.1; x += 0.05) { g.moveTo(w * (0.15 + x * 0.7), h * 0.78); g.lineTo(w * (0.08 + x * 0.84), h); } g.moveTo(w * 0.15, h * 0.78); g.lineTo(w * 0.85, h * 0.78); g.stroke();
      g.save(); g.translate(w / 2, h * 0.9); g.rotate(steer * 0.12); g.fillStyle = '#c0392b'; g.strokeStyle = '#1b1410'; g.lineWidth = 3; roundRect(g, -w * 0.32, -h * 0.03, w * 0.64, h * 0.06, h * 0.03); g.fill(); g.stroke(); g.restore();
    } else if (kind === 'mower' || kind === 'push') { // the green hood (ride-on) or the push handle
      if (kind === 'mower') { g.fillStyle = '#47a83f'; g.beginPath(); g.moveTo(w * 0.22, h); g.quadraticCurveTo(w * 0.5, h * 0.62, w * 0.78, h); g.fill(); g.fillStyle = '#f2c200'; g.fillRect(w * 0.47, h * 0.72, w * 0.06, h * 0.28); wheel(g, w * 0.5, h * 1.02, h * 0.2, steer, '#1c1f22'); }
      else { g.save(); g.translate(w / 2, h * 0.92); g.rotate(steer * 0.1); g.strokeStyle = '#9aa2aa'; g.lineWidth = 8; g.beginPath(); g.moveTo(-w * 0.3, h * 0.1); g.lineTo(-w * 0.26, -h * 0.02); g.lineTo(w * 0.26, -h * 0.02); g.lineTo(w * 0.3, h * 0.1); g.stroke(); g.restore(); }
      if (Math.abs(r.spd || 0) > 0.2) { g.fillStyle = 'rgba(140,200,90,0.8)'; for (let i = 0; i < 8; i++) { const x = (Math.sin(t * 13 + i * 2.1) * 0.5 + 0.5) * w, y = h * (0.55 + ((t * 2 + i * 0.13) % 0.4)); g.fillRect(x, y, 4, 2); } }
    } else if (kind === 'tank') { // the hatch rim, you up top, the crosshair and the lock-on box
      g.fillStyle = '#2a2f22'; g.beginPath(); g.moveTo(0, h); g.lineTo(0, h * 0.82); g.quadraticCurveTo(w * 0.5, h * 0.7, w, h * 0.82); g.lineTo(w, h); g.fill(); g.strokeStyle = '#5d6b3a'; g.lineWidth = 6; g.beginPath(); g.moveTo(0, h * 0.82); g.quadraticCurveTo(w * 0.5, h * 0.7, w, h * 0.82); g.stroke();
      if (window.TZSim && sim.me) { const kp = 1.4; g.save(); g.translate(w * 0.14, h * 1.12); g.scale(h / 260, h / 260); window.TZSim.heroDraw(g, sim.me, 0, 0, { k: kp, face: 1 }); g.restore(); }
      const lock = r.lock != null ? sim.z.find((z) => z.id === r.lock && z.hp > 0) : null, cx = w / 2, cy = h * 0.46;
      g.strokeStyle = lock ? '#ff4a3a' : 'rgba(255,255,255,0.85)'; g.lineWidth = 2.5; g.beginPath(); g.arc(cx, cy, 18, 0, TAU); g.moveTo(cx - 30, cy); g.lineTo(cx - 8, cy); g.moveTo(cx + 8, cy); g.lineTo(cx + 30, cy); g.moveTo(cx, cy - 30); g.lineTo(cx, cy - 8); g.moveTo(cx, cy + 8); g.lineTo(cx, cy + 30); g.stroke();
      if (lock) { const p = project(lock.x, lock.y, 40); if (p) { const x = p[0] * w, y = p[1] * h, s = 26 + Math.sin(t * 12) * 3; g.strokeStyle = '#ff4a3a'; g.lineWidth = 3; for (const [ax, ay] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { g.beginPath(); g.moveTo(x + ax * s, y + ay * (s - 10)); g.lineTo(x + ax * s, y + ay * s); g.lineTo(x + ax * (s - 10), y + ay * s); g.stroke(); } label(g, '🔒 LOCKED', x, y - s - 12, 13, '#ff6a5a'); } }
      const C0 = window.TZX.VEHICLES.tank.cannon, u = 1 - clamp((r.reload || 0) / C0.reload, 0, 1); g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 6; g.beginPath(); g.arc(cx, cy, 44, 0, TAU); g.stroke(); g.strokeStyle = u >= 1 ? '#9cff5a' : '#ffb02e'; g.beginPath(); g.arc(cx, cy, 44, -Math.PI / 2, -Math.PI / 2 + TAU * u); g.stroke();
      if (u < 1) label(g, 'RELOADING', cx, cy + 62, 13, '#ffb02e');
    }
    // the clock (every ride is timed) and the ride's health
    const L = r.life != null ? r.life : r.time, L0 = r.life0 || 20, cx = 74, cy = h * 0.5 - 50;
    if (L != null && sim.ride) {
      const u = clamp(L / L0, 0, 1), hot = u < 0.25; g.fillStyle = 'rgba(15,10,6,0.75)'; g.beginPath(); g.arc(cx, cy + 50, 26, 0, TAU); g.fill();
      g.strokeStyle = hot ? (Math.sin(t * 14) > 0 ? '#ff4a3a' : '#ffb02e') : '#9cff5a'; g.lineWidth = 5; g.beginPath(); g.arc(cx, cy + 50, 26, -Math.PI / 2, -Math.PI / 2 + TAU * u); g.stroke();
      label(g, String(Math.ceil(L)), cx, cy + 51, 18, '#fff'); label(g, (window.TZX.VEHICLES[kind] || {}).name || '', cx, cy + 92, 12, '#ffe9a8');
      const bw = 110, bx = cx - bw / 2, by = cy + 104; g.fillStyle = 'rgba(15,10,6,0.75)'; roundRect(g, bx - 3, by - 3, bw + 6, 14, 6); g.fill(); g.fillStyle = r.hp / r.mhp < 0.3 ? '#ff4a3a' : '#7fd6ff'; roundRect(g, bx, by, bw * clamp(r.hp / r.mhp, 0, 1), 8, 4); g.fill();
    }
    // the pedals (touch) / key hints
    const touch = !!held;
    if (touch) for (const b of controls(V, sim)) { const on = held[b.id]; g.globalAlpha = on ? 0.95 : 0.6; g.fillStyle = 'rgba(15,10,6,0.6)'; g.beginPath(); g.arc(b.x, b.y, b.r, 0, TAU); g.fill(); g.strokeStyle = b.c; g.lineWidth = on ? 5 : 3; g.stroke(); label(g, b.label, b.x, b.y + 1, b.r * 0.42, b.c); g.globalAlpha = 1; }
    else if (sim.ride) label(g, kind === 'tank' ? 'W/S drive · A/D turn · mouse turns the turret · click or Space fires · V hops out' : 'W gas · S brake · A/D steer · V hops out', w / 2, h - 16, 13, 'rgba(255,255,255,0.75)');
    // the end of the ride: a crash flash with cracks, or a quick fade
    const O = sim.fpOut; if (O) { const u = O.t / 0.6; if (O.crash) { g.fillStyle = `rgba(255,240,220,${0.8 * (1 - u)})`; g.fillRect(0, 0, w, h); g.strokeStyle = `rgba(255,255,255,${1 - u})`; g.lineWidth = 2; g.beginPath(); for (let i = 0; i < 9; i++) { const a = i * 0.7; g.moveTo(w * 0.55, h * 0.4); g.lineTo(w * 0.55 + Math.cos(a) * w, h * 0.4 + Math.sin(a) * w); } g.stroke(); label(g, '💥 WRECKED', w / 2, h * 0.3, 34, '#ff6a5a'); } else { g.fillStyle = `rgba(0,0,0,${Math.sin(u * Math.PI) * 0.9})`; g.fillRect(0, 0, w, h); } }
  }
  function dash(g, w, h, c1, c2) { const gr = g.createLinearGradient(0, h * 0.72, 0, h); gr.addColorStop(0, c2); gr.addColorStop(0.15, c1); gr.addColorStop(1, '#101411'); g.fillStyle = gr; g.beginPath(); g.moveTo(0, h); g.lineTo(0, h * 0.8); g.quadraticCurveTo(w * 0.5, h * 0.7, w, h * 0.8); g.lineTo(w, h); g.fill(); g.fillStyle = '#ffb02e'; g.fillRect(w * 0.6, h * 0.84, w * 0.05, 4); g.fillStyle = '#9cff5a'; g.fillRect(w * 0.67, h * 0.84, w * 0.03, 4); }
  function wheel(g, x, y, R0, steer, c) { g.save(); g.translate(x, y); g.rotate(steer * 1.2); g.strokeStyle = c; g.lineWidth = R0 * 0.16; g.beginPath(); g.arc(0, 0, R0, 0, TAU); g.stroke(); g.lineWidth = R0 * 0.12; g.beginPath(); g.moveTo(-R0, 0); g.lineTo(R0, 0); g.moveTo(0, 0); g.lineTo(0, R0); g.stroke(); g.fillStyle = '#ffd23f'; g.beginPath(); g.arc(0, -R0, R0 * 0.09, 0, TAU); g.fill(); g.restore(); }
  function roundRect(g, x, y, w, h, r) { w = Math.max(0, w); r = Math.min(r, w / 2, h / 2); g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  function label(g, s, x, y, px, c) { g.font = `bold ${Math.round(px)}px "Lilita One", sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = Math.max(3, px / 5); g.strokeStyle = 'rgba(15,10,6,0.9)'; g.strokeText(s, x, y); g.fillStyle = c; g.fillText(s, x, y); }
  const TZFP = window.TZFP = { ready: false, supported, prepare, render, overlay, controls, project, st, relDir };
})();
