// Pre-renders glTF models to isometric (2:1, camera elevation 30 deg, yaw 45 deg) sprite atlases.
// Driven from Node over CDP: window.ISO.job(spec) -> { data: dataURL, meta }.
import * as THREE from 'three';
import { GLTFLoader } from './lib/loaders/GLTFLoader.js';
import * as SkeletonUtils from './lib/utils/SkeletonUtils.js';

const EL = THREE.MathUtils.degToRad(30), AZ = THREE.MathUtils.degToRad(45);
const SS = 2; // supersampling
const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setClearColor(0x000000, 0);
const loader = new GLTFLoader();
const cache = new Map();
const texLoader = new THREE.TextureLoader();

function makeScene(opts = {}) {
  const scene = new THREE.Scene();
  const hemi = new THREE.HemisphereLight(0xe4ecff, 0x4b4036, opts.hemi ?? 1.25);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff0dc, opts.sun ?? 2.7);
  // Key light from the upper-left of the screen (world -x, slightly -z), high up.
  sun.position.set(-5, 9, 1.5);
  sun.castShadow = true;
  const sc = opts.shadowExtent || 5;
  Object.assign(sun.shadow.camera, { left: -sc, right: sc, top: sc, bottom: -sc, near: 0.1, far: 40 });
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02; sun.shadow.radius = 3;
  scene.add(sun); scene.add(sun.target);
  const fill = new THREE.DirectionalLight(0xbcd2ff, opts.fill ?? 0.55); // cool rim/fill from the back-right
  fill.position.set(4, 3, -5); scene.add(fill);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.ShadowMaterial({ opacity: opts.shadowOpacity ?? 0.38 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; ground.renderOrder = -1;
  scene.add(ground);
  return { scene, sun, ground, hemi };
}

// Orthographic camera placing world origin at pixel (ax, ay) in a W x H cell, ppm pixels per metre.
function makeCamera(W, H, ax, ay, ppm) {
  const cam = new THREE.OrthographicCamera(-ax / ppm, (W - ax) / ppm, ay / ppm, -(H - ay) / ppm, 0.1, 200);
  const D = 50;
  cam.position.set(D * Math.cos(EL) * Math.sin(AZ), D * Math.sin(EL), D * Math.cos(EL) * Math.cos(AZ));
  cam.lookAt(0, 0, 0);
  cam.updateProjectionMatrix();
  return cam;
}

async function loadModel(url) {
  if (!cache.has(url)) cache.set(url, url.startsWith('proc:') ? { scene: procModel(url.slice(5)), animations: [] } : await loader.loadAsync(url));
  const g = cache.get(url);
  return { root: SkeletonUtils.clone(g.scene), clips: g.animations };
}

function prepModel(root, spec) {
  const hide = spec.hide ? new RegExp(spec.hide, 'i') : null;
  const only = spec.only ? new RegExp(spec.only, 'i') : null;
  root.traverse((o) => {
    if (hide && hide.test(o.name)) o.visible = false;
    if (o.isMesh) {
      if (only && !only.test(o.name)) o.visible = false;
      o.castShadow = spec.castShadow !== false; o.receiveShadow = !!spec.receiveShadow; o.frustumCulled = false;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      const out = mats.map((m) => {
        m = m.clone();
        if (m.map) { m.map.anisotropy = 8; }
        if (spec.flat) { m.metalness = 0; m.roughness = 1; }
        if (m.metalness > 0.6 && !m.metalnessMap) m.metalness = Math.min(m.metalness, spec.keepMetal ? 1 : 0.35);
        if (spec.tint) m.color.multiply(new THREE.Color(...spec.tint));
        if (spec.matTint) for (const [re, c] of spec.matTint) if (new RegExp(re, 'i').test(m.name)) m.color.set(c);
        if (spec.emissive) { m.emissive = new THREE.Color(spec.emissive); m.emissiveIntensity = spec.emissiveIntensity ?? 0.35; }
        if (spec.opacity != null) { m.transparent = true; m.opacity = spec.opacity; }
        return m;
      });
      o.material = Array.isArray(o.material) ? out : out[0];
    }
  });
}

function normalize(holder, root, spec) {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root, true);
  const size = box.getSize(new THREE.Vector3());
  let s = spec.scale || 1;
  if (spec.height) s = spec.height / size.y;
  else if (spec.length) s = spec.length / Math.max(size.x, size.z);
  else if (spec.width) s = spec.width / size.x;
  root.scale.multiplyScalar(s);
  root.updateMatrixWorld(true);
  const b2 = new THREE.Box3().setFromObject(root, true);
  const c = b2.getCenter(new THREE.Vector3());
  if (spec.center !== false) { root.position.x -= c.x; root.position.z -= c.z; }
  root.position.y -= b2.min.y - (spec.lift || 0);
  holder.add(root);
  return { size: b2.getSize(new THREE.Vector3()), scale: s };
}

function findClip(clips, name) {
  return clips.find((c) => c.name === name) || clips.find((c) => c.name.endsWith('|' + name)) || clips.find((c) => c.name.toLowerCase().includes(name.toLowerCase()));
}

// ---------- 2D compositing ----------
const work = document.createElement('canvas');
function grab(W, H) { // downsample the renderer canvas into a new W x H canvas
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d'); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
  g.drawImage(renderer.domElement, 0, 0, W, H); return c;
}
function outline(src, color, px) {
  const W = src.width, H = src.height;
  const m = document.createElement('canvas'); m.width = W; m.height = H; const g = m.getContext('2d');
  const offs = [];
  for (let dx = -px; dx <= px; dx++) for (let dy = -px; dy <= px; dy++) if ((dx || dy) && dx * dx + dy * dy <= px * px + 0.5) offs.push([dx, dy]);
  for (const [dx, dy] of offs) g.drawImage(src, dx, dy);
  g.globalCompositeOperation = 'source-in'; g.fillStyle = color; g.fillRect(0, 0, W, H);
  return m;
}
// Hard-threshold the alpha a little so the outline does not wrap semi-transparent fringe.
function compose(W, H, layers) {
  const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  for (const l of layers) if (l) { g.globalAlpha = l.alpha ?? 1; g.drawImage(l.c, 0, 0); }
  g.globalAlpha = 1; return c;
}
function blob(W, H, ax, ay, rx, ry, a) {
  const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  g.translate(ax, ay); g.scale(1, ry / rx);
  const gr = g.createRadialGradient(0, 0, 0, 0, 0, rx);
  gr.addColorStop(0, `rgba(0,0,0,${a})`); gr.addColorStop(0.6, `rgba(0,0,0,${a * 0.55})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.beginPath(); g.arc(0, 0, rx, 0, Math.PI * 2); g.fill(); return c;
}

// Render one frame: returns a composed canvas (shadow + blob + outline + model).
function renderFrame(ctx, spec) {
  const { scene, cam, ground, models, W, H, ax, ay, ppm } = ctx;
  renderer.setSize(W * SS, H * SS, false);
  const layers = [];
  if (spec.shadow !== false) {
    // shadow-only pass: models write no colour, the shadow catcher shows what they cast
    const saved = [];
    for (const m of models) m.traverse((o) => { if (o.isMesh) { const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach((mm) => { saved.push([mm, mm.colorWrite, mm.depthWrite]); mm.colorWrite = false; mm.depthWrite = false; }); } });
    ground.visible = true; renderer.render(scene, cam);
    layers.push({ c: grab(W, H) });
    for (const [mm, cw, dw] of saved) { mm.colorWrite = cw; mm.depthWrite = dw; }
  }
  if (spec.blob) layers.push({ c: blob(W, H, ax, ay, spec.blob[0] * ppm, spec.blob[0] * ppm * 0.5, spec.blob[1] ?? 0.35) });
  ground.visible = false; renderer.render(scene, cam);
  const body = grab(W, H);
  ground.visible = true;
  if (spec.outline !== false) layers.push({ c: outline(body, spec.outlineColor || 'rgba(22,16,12,0.85)', spec.outlinePx || 1) });
  layers.push({ c: body });
  return compose(W, H, layers);
}

function atlasCanvas(cols, rows, W, H) { const c = document.createElement('canvas'); c.width = cols * W; c.height = rows * H; return c; }
const YAW0 = Math.PI / 4; // model facing +Z turned to face the viewer (screen south)
const DIRNAMES = ['S', 'SE', 'E', 'NE', 'N', 'NW', 'W', 'SW'];

async function job(spec) {
  const W = spec.cell[0], H = spec.cell[1], ax = spec.anchor[0], ay = spec.anchor[1], ppm = spec.ppm;
  const env = makeScene(spec.light || {});
  const cam = makeCamera(W, H, ax, ay, ppm);
  const holder = new THREE.Group(); env.scene.add(holder);
  const { root, clips } = await loadModel(spec.url);
  prepModel(root, spec);
  if (spec.rot) root.rotation.set(...spec.rot.map(THREE.MathUtils.degToRad));
  const norm = normalize(holder, root, spec);
  const models = [holder];
  const follow = [];
  const syncFollow = () => { holder.updateMatrixWorld(true); const inv = holder.matrixWorld.clone().invert(); for (const fo of follow) { const p = new THREE.Vector3(), q = new THREE.Quaternion(), sc = new THREE.Vector3(); fo.bone.matrixWorld.decompose(p, q, sc); const w = new THREE.Matrix4().compose(p, q, new THREE.Vector3(1, 1, 1)).multiply(fo.off); fo.tmp.matrix.copy(inv.clone().multiply(w)); fo.tmp.matrixWorldNeedsUpdate = true; } holder.updateMatrixWorld(true); if (window.DBG) for (const fo of follow) { const v = new THREE.Vector3(); fo.tmp.getWorldPosition(v); const bb = new THREE.Box3().setFromObject(fo.tmp); console.log("FOLLOW", v.toArray().map((x) => x.toFixed(2)).join(","), bb.min.toArray().map((x) => x.toFixed(2)).join(","), bb.max.toArray().map((x) => x.toFixed(2)).join(",")); } };
  // attachments (eg a riot shield in a hand bone, or a prop on the head)
  for (const at of spec.attach || []) {
    const a = await loadModel(at.url); prepModel(a.root, at);
    const tmp = new THREE.Group(); const n2 = normalize(tmp, a.root, at);
    const key = (n) => n.toLowerCase().replace(/[^a-z0-9]/g, ''); let bone = null; if (at.bone) { const want = key(at.bone); root.traverse((o) => { if (!bone && o.isBone && key(o.name) === want) bone = o; }); if (!bone) root.traverse((o) => { if (!bone && o.isBone && key(o.name).includes(want)) bone = o; }); if (!bone) console.log('ATTACH: no bone', at.bone, 'in', spec.url); }
    // place in holder space (metres, model facing +Z) relative to the bone in its idle pose, then parent to the bone
    const idle = findClip(clips, at.pose || 'Idle'); const pm = new THREE.AnimationMixer(root);
    if (idle) { pm.clipAction(idle).play(); pm.setTime(0); }
    holder.rotation.y = 0; holder.updateMatrixWorld(true);
    const base = new THREE.Vector3(); if (bone) bone.getWorldPosition(base); if (bone) console.log("ATTACH", spec.url.split("/").pop(), bone.name, base.toArray().map((v) => v.toFixed(2)).join(","));
    tmp.position.copy(base).add(new THREE.Vector3(...(at.pos || [0, 0, 0])));
    if (at.rot) tmp.rotation.set(...at.rot.map(THREE.MathUtils.degToRad));
    holder.add(tmp); holder.updateMatrixWorld(true);
    if (bone) { // follow the bone rigidly (position + rotation only: rig bones carry odd scales)
      const bw = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), sc = new THREE.Vector3(); bone.matrixWorld.decompose(p, q, sc); bw.compose(p, q, new THREE.Vector3(1, 1, 1));
      follow.push({ bone, tmp, off: bw.invert().multiply(tmp.matrixWorld.clone()) }); tmp.matrixAutoUpdate = false;
    }
    pm.stopAllAction(); pm.uncacheRoot(root);
  }
  // blood decal (grows under the corpse during death clips)
  let blood = null;
  if (spec.blood) {
    const b = await loadModel(spec.blood.url); prepModel(b.root, { castShadow: false, ...spec.blood });
    const bh = new THREE.Group(); normalize(bh, b.root, spec.blood); bh.visible = false; env.scene.add(bh); blood = bh;
  }
  const mixer = new THREE.AnimationMixer(root);
  const ctx = { scene: env.scene, cam, ground: env.ground, models, W, H, ax, ay, ppm };
  const dirs = spec.dirs || [0];
  const anims = spec.anims || [{ name: 'static', frames: 1 }];
  const rows = [];
  for (const an of anims) for (const d of dirs) rows.push({ an, d });
  const cols = Math.max(...anims.map((a) => a.frames));
  const atlas = atlasCanvas(cols, rows.length, W, H); const ag = atlas.getContext('2d');
  const meta = { cell: [W, H], anchor: [ax, ay], ppm, cols, rows: [], size: [norm.size.x, norm.size.y, norm.size.z].map((v) => +v.toFixed(3)) };
  let hips = null; root.traverse((o) => { if (!hips && o.isBone && /hip|pelvis|root/i.test(o.name)) hips = o; });
  for (let r = 0; r < rows.length; r++) {
    const { an, d } = rows[r];
    holder.rotation.y = YAW0 + d * Math.PI / 4 + THREE.MathUtils.degToRad(spec.yaw || 0);
    let action = null, clip = null;
    mixer.stopAllAction();
    if (an.clip) {
      clip = findClip(clips, an.clip);
      if (!clip) throw new Error('no clip ' + an.clip + ' in ' + spec.url + ' have ' + clips.map((c) => c.name).join(','));
      action = mixer.clipAction(clip); action.reset(); action.setLoop(an.loop === false ? THREE.LoopOnce : THREE.LoopRepeat); action.clampWhenFinished = true; action.play();
    }
    for (let f = 0; f < an.frames; f++) {
      if (clip) {
        const t0 = (an.from || 0) * clip.duration, t1 = (an.to ?? 1) * clip.duration;
        const t = an.loop === false ? t0 + (t1 - t0) * (an.frames === 1 ? 1 : f / (an.frames - 1)) : t0 + (t1 - t0) * f / an.frames;
        mixer.setTime(Math.min(t, clip.duration - 1e-4));
      }
      if (an.spin) holder.rotation.y = YAW0 + (f / an.frames) * Math.PI * 2;
      if (blood) {
        if (an.blood) {
          const k = Math.max(0, (f / Math.max(1, an.frames - 1) - an.blood) / (1 - an.blood));
          root.updateMatrixWorld(true);
          const p = new THREE.Vector3(); (hips || root).getWorldPosition(p);
          blood.position.set(p.x, 0.01, p.z); blood.scale.setScalar(Math.max(0.001, 0.25 + 0.75 * k)); blood.visible = k > 0;
        } else blood.visible = false;
      }
      if (typeof spec.onFrame === 'string') new Function('THREE', 'holder', 'f', 'an', spec.onFrame)(THREE, holder, f, an);
      syncFollow();
      const fr = renderFrame(ctx, spec);
      ag.drawImage(fr, f * W, r * H);
    }
    meta.rows.push({ anim: an.name, dir: d, dirName: DIRNAMES[d], row: r, frames: an.frames, fps: an.fps || 12, loop: an.loop !== false });
  }
  env.scene.traverse((o) => { if (o.geometry && o.geometry.dispose && cache.size > 40) o.geometry.dispose(); });
  return { data: atlas.toDataURL(spec.format || 'image/webp', spec.quality ?? 0.9), meta };
}

// patch job() to expose the lid pivot for chest specs
const _job = job;
async function jobEntry(spec) {
  if (spec.kind === 'chest') {
    const g = await loader.loadAsync(spec.url);
    let mesh = null; g.scene.traverse((o) => { if (o.isMesh && !mesh) mesh = o; });
    mesh.updateWorldMatrix(true, false);
    const geo0 = (mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone()).applyMatrix4(mesh.matrixWorld);
    const pos = geo0.attributes.position; geo0.computeBoundingBox(); const bb = geo0.boundingBox;
    const cut = bb.min.y + (bb.max.y - bb.min.y) * spec.lidFrom;
    const tris = pos.count / 3, lidT = [], bodyT = [];
    for (let i = 0; i < tris; i++) { let lo = Infinity; for (let k = 0; k < 3; k++) lo = Math.min(lo, pos.getY(i * 3 + k)); (lo >= cut - 1e-4 ? lidT : bodyT).push(i); }
    const sub = (idx) => { const ng = new THREE.BufferGeometry(); for (const [name, at] of Object.entries(geo0.attributes)) { const sz = at.itemSize, arr = new Float32Array(idx.length * 3 * sz); idx.forEach((t, j) => { for (let k = 0; k < 3 * sz; k++) arr[j * 3 * sz + k] = at.array[t * 3 * sz + k]; }); ng.setAttribute(name, new THREE.BufferAttribute(arr, sz)); } return ng; };
    const body = new THREE.Mesh(sub(bodyT), mesh.material), lidG = sub(lidT); lidG.computeBoundingBox();
    const lid = new THREE.Mesh(lidG, mesh.material);
    const hingeZ = spec.hingeBack === 'x' ? 0 : lidG.boundingBox.min.z;
    const pivot = new THREE.Group(); pivot.position.set(0, cut, hingeZ); lid.position.set(0, -cut, -hingeZ); pivot.add(lid); pivot.name = 'LID_PIVOT';
    const grp = new THREE.Group(); grp.add(body); grp.add(pivot);
    const id = 'chest:' + spec.url;
    cache.set(id, { scene: grp, animations: [] });
    return _job({ ...spec, url: id, onFrame: `const p = holder.getObjectByName('LID_PIVOT'); if (p && an.lid != null) { const k = an.frames > 1 ? f / (an.frames - 1) : 1; const e = an.close ? 1 - k : k; const ease = e < 1 ? 1 - Math.pow(1 - e, 3) * (1 - 0.15 * Math.sin(e * 9)) : 1; p.rotation.x = -THREE.MathUtils.degToRad(an.lid) * Math.min(1.08, ease); }` });
  }
  if (spec.kind === 'tile') return tileJob(spec);
  if (spec.kind === 'sheet') return sheetJob(spec);
  if (spec.kind === 'proc') return procJob(spec);
  if (spec.kind === 'pack') { // pack cells [{src, rect}] into a cols-wide grid of cw x ch (transparent), for UI icons
    const cw = spec.cell[0], ch = spec.cell[1], cols = spec.cols, rows = Math.ceil(spec.items.length / cols); const c = document.createElement('canvas'); c.width = cols * cw; c.height = rows * ch; const g = c.getContext('2d'); g.imageSmoothingQuality = 'high';
    const imgs = {}; for (const it of spec.items) if (!imgs[it.src]) { const im = new Image(); im.src = it.src; await im.decode(); imgs[it.src] = im; }
    const rects = spec.items.map((it, i) => { const [sx, sy, sw, sh] = it.rect, x = (i % cols) * cw, y = Math.floor(i / cols) * ch, k = Math.min(cw / sw, ch / sh); g.drawImage(imgs[it.src], sx, sy, sw, sh, x + (cw - sw * k) / 2, y + (ch - sh * k) / 2, sw * k, sh * k); return [x, y, cw, ch]; });
    return { data: c.toDataURL('image/webp', spec.quality ?? 0.9), meta: { rects, names: spec.items.map((it) => it.name) } };
  }
  if (spec.kind === 'image') { // re-encode a 2D atlas (fx / icons) to WebP
    const im = new Image(); im.src = spec.src; await im.decode(); const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; c.getContext('2d').drawImage(im, 0, 0);
    return { data: c.toDataURL('image/webp', spec.quality ?? 0.9), meta: { w: im.width, h: im.height } };
  }
  return _job(spec);
}

// Ground tile: a textured square (tileM metres) rendered with the same camera/lights; no shadow or outline.
async function tileJob(spec) {
  const W = spec.cell[0], H = spec.cell[1];
  const env = makeScene(spec.light || {}); env.ground.visible = false;
  const cam = makeCamera(W, H, W / 2, H / 2 + (spec.raise || 0), spec.ppm);
  const out = atlasCanvas(spec.variants.length, 1, W, H), og = out.getContext('2d');
  for (let i = 0; i < spec.variants.length; i++) {
    const v = spec.variants[i];
    const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(...(v.tint || [1, 1, 1])), roughness: 0.95, metalness: 0 });
    if (v.map) { const t = await texLoader.loadAsync(v.map); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(v.repeat || 1, v.repeat || 1); t.offset.set(v.offset ? v.offset[0] : 0, v.offset ? v.offset[1] : 0); t.anisotropy = 16; mat.map = t; }
    if (v.normal) { const t = await texLoader.loadAsync(v.normal); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(v.repeat || 1, v.repeat || 1); mat.normalMap = t; mat.normalScale.set(v.normalScale || 1, v.normalScale || 1); }
    const s = spec.tileM;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(s, s), mat); m.rotation.x = -Math.PI / 2;
    env.scene.add(m);
    renderer.setSize(W * SS, H * SS, false);
    renderer.render(env.scene, cam);
    og.drawImage(grab(W, H), i * W, 0);
    env.scene.remove(m);
  }
  return { data: out.toDataURL('image/webp', spec.quality ?? 0.9), meta: { cell: [W, H], cols: spec.variants.length, variants: spec.variants.map((v) => v.name) } };
}

// Procedural pickup models (own geometry, no third-party art).
function procModel(kind) {
  const g = new THREE.Group();
  const std = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.5, metalness: 0.1, ...o });
  if (kind === 'gem') { // XP crystal
    const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 0), std(0x4fd8ff, { emissive: 0x1a7fbf, emissiveIntensity: 0.6, roughness: 0.15, metalness: 0.2, flatShading: true }));
    m.scale.set(0.8, 1.35, 0.8); m.position.y = 0.32; g.add(m);
  } else if (kind === 'core') { // boss core: glowing orb in a metal cage
    const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.2, 1), std(0xff3b5c, { emissive: 0xff1a3a, emissiveIntensity: 1.2, roughness: 0.2, flatShading: true }));
    orb.position.y = 0.32; g.add(orb);
    for (let i = 0; i < 3; i++) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.025, 6, 24), std(0x6d7480, { metalness: 0.8, roughness: 0.35 })); r.position.y = 0.32; r.rotation.set(i === 0 ? Math.PI / 2 : 0, i * Math.PI / 3, i === 2 ? Math.PI / 2 : 0); g.add(r); }
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.08, 8), std(0x3a3f47, { metalness: 0.7 })); base.position.y = 0.04; g.add(base);
  } else if (kind === 'shield') { // riot shield
    const sh = new THREE.Shape(); const w = 0.22, h = 0.36, r = 0.06;
    sh.moveTo(-w + r, -h); sh.lineTo(w - r, -h); sh.quadraticCurveTo(w, -h, w, -h + r); sh.lineTo(w, h - r); sh.quadraticCurveTo(w, h, w - r, h); sh.lineTo(-w + r, h); sh.quadraticCurveTo(-w, h, -w, h - r); sh.lineTo(-w, -h + r); sh.quadraticCurveTo(-w, -h, -w + r, -h);
    const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.03, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012, bevelSegments: 2 });
    const m = new THREE.Mesh(geo, std(0x3c8dff, { transparent: true, opacity: 0.85, emissive: 0x0d3c8a, emissiveIntensity: 0.5, roughness: 0.15, metalness: 0.3 })); m.position.y = 0.4; m.rotation.x = -0.25; g.add(m);
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.06, 0.05), std(0xf0f4ff, { emissive: 0x8899aa, emissiveIntensity: 0.2 })); band.position.set(0, 0.48, 0.045); band.rotation.x = -0.25; g.add(band);
  } else if (kind === 'armor') { // kevlar vest
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.42, 10, 1, false), std(0x3f4a36, { roughness: 0.85 })); torso.scale.z = 0.55; torso.position.y = 0.28; g.add(torso);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.44, 10), std(0x1b1f17, { roughness: 1 })); neck.scale.z = 0.5; neck.position.y = 0.29; g.add(neck);
    for (const x of [-0.11, 0.11]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.03), std(0x2e3628)); p.position.set(x, 0.18, 0.115); g.add(p); }
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.16, 0.03), std(0x8a949c, { metalness: 0.7, roughness: 0.35 })); plate.position.set(0, 0.36, 0.12); g.add(plate);
  } else if (kind === 'fov') { // binoculars
    for (const x of [-0.09, 0.09]) { const t = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.085, 0.3, 14), std(0x2b2f36, { roughness: 0.6 })); t.rotation.x = Math.PI / 2; t.position.set(x, 0.13, 0); g.add(t); const l = new THREE.Mesh(new THREE.CircleGeometry(0.066, 16), std(0x7fe0ff, { emissive: 0x2aa6d6, emissiveIntensity: 0.8, roughness: 0.05 })); l.position.set(x, 0.13, 0.152); g.add(l); }
    const br = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.05, 0.12), std(0x50555e, { metalness: 0.6 })); br.position.y = 0.13; g.add(br);
  } else if (kind === 'minigun') {
    const bar = std(0x7d848e, { metalness: 0.85, roughness: 0.3 });
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; const t = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.62, 8), bar); t.rotation.z = Math.PI / 2; t.position.set(0.12, 0.2 + Math.cos(a) * 0.055, Math.sin(a) * 0.055); g.add(t); }
    for (const x of [-0.02, 0.36]) { const r = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.04, 16), std(0x3a3f47, { metalness: 0.7 })); r.rotation.z = Math.PI / 2; r.position.set(x, 0.2, 0); g.add(r); }
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.17, 0.17), std(0x2f3540, { metalness: 0.6, roughness: 0.4 })); body.position.set(-0.17, 0.2, 0); g.add(body);
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.14), std(0x556b2f)); box.position.set(-0.15, 0.08, 0.14); g.add(box);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.14, 0.05), std(0x1c1f24)); grip.position.set(-0.24, 0.1, 0); g.add(grip);
    g.children.forEach((c) => { c.position.x -= 0.03; });
  } else if (kind === 'raygun') {
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 12), std(0xd8dde6, { metalness: 0.8, roughness: 0.25 })); body.scale.set(1.4, 0.9, 0.9); body.position.set(-0.06, 0.2, 0); g.add(body);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 0.26, 12), std(0xb8c0cc, { metalness: 0.8 })); barrel.rotation.z = Math.PI / 2; barrel.position.set(0.16, 0.2, 0); g.add(barrel);
    for (const x of [0.07, 0.13, 0.19]) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.014, 6, 18), std(0x7dff6a, { emissive: 0x3fd12a, emissiveIntensity: 1 })); r.rotation.y = Math.PI / 2; r.position.set(x, 0.2, 0); g.add(r); }
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), std(0x9dff8a, { emissive: 0x7dff6a, emissiveIntensity: 1.5 })); tip.position.set(0.3, 0.2, 0); g.add(tip);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.15, 0.06), std(0xc0392b)); grip.position.set(-0.1, 0.09, 0); grip.rotation.z = 0.25; g.add(grip);
  } else if (kind === 'cash') { // banded bill stacks
    const bill = std(0x5f9c55, { roughness: 0.8 }), band = std(0xf2e3b3, { roughness: 0.7 });
    const stacks = [[0, 0, 0], [0.05, 0.075, 0.02], [-0.02, 0.15, -0.03]];
    for (const [x, y, z] of stacks) { const s = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.07, 0.16), bill); s.position.set(x, y + 0.035, z); s.rotation.y = (x - z) * 4; g.add(s); const b = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.075, 0.165), band); b.position.copy(s.position); b.rotation.copy(s.rotation); g.add(b); }
  } else if (kind === 'keypiece') { // a third of a key: glowing bronze shard
    const m = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.035, 8, 20, Math.PI * 1.3), std(0xffc23a, { metalness: 0.9, roughness: 0.25, emissive: 0x7a4a00, emissiveIntensity: 0.4 })); m.position.y = 0.3; g.add(m);
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.2, 0.05), std(0xffc23a, { metalness: 0.9, roughness: 0.25 })); s.position.set(0, 0.14, 0); g.add(s);
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.04, 0.05), std(0xffc23a, { metalness: 0.9, roughness: 0.25 })); t.position.set(0.05, 0.07, 0); g.add(t);
  }
  else if (kind === 'spikes') { // spike strip
    const base = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.04, 0.22), std(0x2b2f36, { metalness: 0.6, roughness: 0.5 })); base.position.y = 0.02; g.add(base);
    const sp = std(0xc9ced6, { metalness: 0.9, roughness: 0.25 });
    for (let i = 0; i < 12; i++) for (const z of [-0.06, 0.06]) { const c = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.12, 6), sp); c.position.set(-0.64 + i * 0.116 + (z > 0 ? 0.05 : 0), 0.1, z); g.add(c); }
    for (const x of [-0.7, 0.7]) { const e = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.26), std(0xf2c200)); e.position.set(x, 0.03, 0); g.add(e); }
  } else if (kind === 'sprinkler') { // lawn sprinkler rigged to a fuel tank (sprinkler-flamer)
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.5, 16), std(0xc0392b, { metalness: 0.5, roughness: 0.4 })); tank.position.set(-0.22, 0.25, 0); g.add(tank);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), tank.material); cap.position.set(-0.22, 0.5, 0); g.add(cap);
    const hose = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.02, 6, 16, Math.PI), std(0x1e8449)); hose.position.set(0, 0.06, 0); hose.rotation.x = Math.PI / 2; g.add(hose);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.04, 0.3, 8), std(0x7f8c8d, { metalness: 0.8 })); post.position.set(0.18, 0.15, 0); g.add(post);
    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.05, 10), std(0x2c3e50, { metalness: 0.7 })); head.position.set(0.18, 0.31, 0); g.add(head);
    for (const a of [0, Math.PI]) { const arm = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.02, 0.02), std(0xb0b6bd, { metalness: 0.8 })); arm.position.set(0.18, 0.33, 0); arm.rotation.y = a + 0.4; g.add(arm); }
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.08, 8), std(0xff8c2e, { emissive: 0xff6a00, emissiveIntensity: 1.5 })); flame.position.set(0.28, 0.36, 0.04); g.add(flame);
  } else if (kind === 'beacon') { // car-alarm decoy: siren light on a box
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.16, 0.22), std(0x34495e, { metalness: 0.4 })); box.position.y = 0.08; g.add(box);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), std(0xff3030, { emissive: 0xff1010, emissiveIntensity: 1.2, transparent: true, opacity: 0.9, roughness: 0.1 })); dome.position.y = 0.16; g.add(dome);
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.3, 6), std(0x111111)); ant.position.set(0.1, 0.3, 0.06); g.add(ant);
  } else if (kind === 'kicks') { // rocket sneakers: a pair of trainers with little thrusters
    for (const [x, z, ry] of [[-0.09, 0.02, 0.15], [0.1, -0.03, -0.1]]) {
      const s = new THREE.Group(); s.position.set(x, 0, z); s.rotation.y = ry; g.add(s);
      const sole = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.035, 0.3), std(0xf4f4f0, { roughness: 0.9 })); sole.position.y = 0.0175; s.add(sole);
      const toe = new THREE.Mesh(new THREE.SphereGeometry(0.055, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), std(0xe8412f, { roughness: 0.6 })); toe.scale.set(1, 0.9, 1.3); toe.position.set(0, 0.035, 0.08); s.add(toe);
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.09, 0.17), std(0xe8412f, { roughness: 0.6 })); body.position.set(0, 0.08, -0.04); s.add(body);
      const collar = new THREE.Mesh(new THREE.BoxGeometry(0.104, 0.03, 0.1), std(0x23252b)); collar.position.set(0, 0.13, -0.07); s.add(collar);
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.106, 0.018, 0.12), std(0xffffff)); stripe.position.set(0, 0.07, -0.01); stripe.rotation.x = 0.35; s.add(stripe);
      const jet = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.07, 12), std(0x8a929c, { metalness: 0.8, roughness: 0.3 })); jet.rotation.x = Math.PI / 2; jet.position.set(0, 0.07, -0.16); s.add(jet);
      const fl = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.1, 10), std(0xffb02e, { emissive: 0xff6a00, emissiveIntensity: 1.6 })); fl.rotation.x = -Math.PI / 2; fl.position.set(0, 0.07, -0.24); s.add(fl);
    }
  } else if (kind === 'crown') {
    const gold = std(0xffc83a, { metalness: 0.9, roughness: 0.25, emissive: 0x4a3000, emissiveIntensity: 0.3 });
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.18, 0.12, 20, 1, true), gold); band.position.y = 0.06; band.material.side = THREE.DoubleSide; g.add(band);
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; const c = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.14, 6), gold); c.position.set(Math.sin(a) * 0.19, 0.18, Math.cos(a) * 0.19); g.add(c); const j = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), std(i % 2 ? 0xe0204a : 0x2a7fff, { emissive: i % 2 ? 0x600010 : 0x0a2a70, roughness: 0.2 })); j.position.set(Math.sin(a) * 0.205, 0.06, Math.cos(a) * 0.205); g.add(j); }
  } else if (kind === 'chainsaw') {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.17, 0.12), std(0xe8742a, { roughness: 0.5 })); body.position.set(-0.16, 0.12, 0); g.add(body);
    const motor = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, 0.13), std(0x2b2f36, { metalness: 0.5 })); motor.position.set(-0.17, 0.05, 0); g.add(motor);
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.016, 6, 16, Math.PI), std(0x1c1f24)); handle.position.set(-0.12, 0.2, 0); g.add(handle);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.07, 0.02), std(0xb8c0cc, { metalness: 0.85, roughness: 0.3 })); bar.position.set(0.2, 0.12, 0); g.add(bar);
    const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.02, 14), bar.material); tip.rotation.x = Math.PI / 2; tip.position.set(0.43, 0.12, 0); g.add(tip);
    for (let i = 0; i < 14; i++) { const t = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.02, 0.028), std(0x3a3f47, { metalness: 0.8 })); t.position.set(-0.02 + i * 0.033, i % 2 ? 0.163 : 0.077, 0); g.add(t); }
  } else if (kind === 'mower') { // push lawnmower
    const deck = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.28, 0.1, 20), std(0xc0392b, { metalness: 0.4, roughness: 0.4 })); deck.position.y = 0.12; g.add(deck);
    const eng = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.14, 0.18), std(0x2b2f36, { metalness: 0.5 })); eng.position.set(0, 0.24, 0.02); g.add(eng);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.04, 10), std(0xf2c200)); cap.position.set(0.05, 0.33, 0.05); g.add(cap);
    for (const [x, z] of [[-0.24, 0.2], [0.24, 0.2], [-0.24, -0.2], [0.24, -0.2]]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.05, 14), std(0x1c1f24, { roughness: 0.9 })); w.rotation.z = Math.PI / 2; w.position.set(x, 0.07, z); w.name = 'wheel'; const hub = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.055, 0.025), std(0xd8dde3, { metalness: 0.6 })); hub.position.set(0, 0, 0); w.add(hub); g.add(w); }
    for (const x of [-0.2, 0.2]) { const h = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.75, 8), std(0x9aa2aa, { metalness: 0.8 })); h.position.set(x, 0.45, -0.42); h.rotation.x = -0.75; g.add(h); }
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.44, 8), std(0x1c1f24)); grip.rotation.z = Math.PI / 2; grip.position.set(0, 0.73, -0.68); g.add(grip);
    const bag = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.26), std(0x4a5a3a, { roughness: 1 })); bag.position.set(0, 0.2, -0.36); g.add(bag);
  } else if (kind === 'ridemower') { // JustZombies ride-on mower (our own model): deck with a spinning blade, seat, wheel, big back wheels
    const body = new THREE.Group(); body.name = 'body'; g.add(body);
    const deck = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.14, 0.7), std(0x3f8f3a, { metalness: 0.3, roughness: 0.45 })); deck.position.set(0, 0.2, 0.25); body.add(deck);
    const hood = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.32, 0.6), std(0x47a83f, { metalness: 0.3, roughness: 0.4 })); hood.position.set(0, 0.42, 0.42); body.add(hood);
    const grill = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.02), std(0x22262b)); grill.position.set(0, 0.42, 0.73); body.add(grill);
    for (const x of [-0.18, 0.18]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.03, 12), std(0xfff3c0, { emissive: 0xffe08a, emissiveIntensity: 0.8 })); l.rotation.x = Math.PI / 2; l.position.set(x, 0.5, 0.735); body.add(l); }
    const seatB = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 0.42), std(0x23262b, { roughness: 0.8 })); seatB.position.set(0, 0.58, -0.2); body.add(seatB);
    const seatK = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.42, 0.08), std(0x23262b, { roughness: 0.8 })); seatK.position.set(0, 0.8, -0.4); body.add(seatK);
    const rear = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.26, 0.5), std(0x3f8f3a, { metalness: 0.3, roughness: 0.45 })); rear.position.set(0, 0.4, -0.25); body.add(rear);
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.4, 8), std(0x2b2f36)); col.position.set(0, 0.75, 0.12); col.rotation.x = -0.5; body.add(col);
    const sw = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.022, 8, 18), std(0x1c1f24)); sw.position.set(0, 0.93, 0.04); sw.rotation.x = -1.1; body.add(sw);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.05, 0.62), std(0xf2c200)); stripe.position.set(0, 0.585, 0.42); body.add(stripe);
    const blade = new THREE.Group(); blade.name = 'blade'; blade.position.set(0, 0.1, 0.25); g.add(blade);
    const bl = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.02, 0.08), std(0xc9ccd1, { metalness: 0.85, roughness: 0.3 })); blade.add(bl);
    for (const [x, z, r] of [[-0.42, 0.42, 0.13], [0.42, 0.42, 0.13], [-0.4, -0.3, 0.2], [0.4, -0.3, 0.2]]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.12, 16), std(0x1c1f24, { roughness: 0.9 })); w.rotation.z = Math.PI / 2; w.position.set(x, r, z); w.name = 'wheel'; const hub = new THREE.Mesh(new THREE.BoxGeometry(r * 1.5, 0.13, 0.05), std(0xf2c200)); w.add(hub); g.add(w); }
  } else if (kind === 'blower') { // backpack leaf blower
    const pack = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.26, 0.16), std(0xf28c28, { roughness: 0.5 })); pack.position.set(-0.18, 0.15, 0); g.add(pack);
    const eng = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.12, 14), std(0x2b2f36, { metalness: 0.5 })); eng.rotation.x = Math.PI / 2; eng.position.set(-0.18, 0.12, 0.12); g.add(eng);
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.55, 12), std(0x3a3f47, { roughness: 0.6 })); tube.rotation.z = Math.PI / 2 - 0.15; tube.position.set(0.17, 0.12, 0); g.add(tube);
    const noz = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.04, 0.08, 12), std(0xf28c28)); noz.rotation.z = Math.PI / 2 - 0.15; noz.position.set(0.46, 0.08, 0); g.add(noz);
  } else if (kind === 'flamer') { // tank + wand flamethrower
    for (const z of [-0.07, 0.07]) { const t = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.3, 14), std(0xb03a2e, { metalness: 0.5, roughness: 0.4 })); t.position.set(-0.22, 0.16, z); g.add(t); const c = new THREE.Mesh(new THREE.SphereGeometry(0.065, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), t.material); c.position.set(-0.22, 0.31, z); g.add(c); }
    const wand = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.5, 10), std(0x5a6068, { metalness: 0.8, roughness: 0.3 })); wand.rotation.z = Math.PI / 2; wand.position.set(0.12, 0.14, 0); g.add(wand);
    const hose = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.015, 6, 14, Math.PI), std(0x1c1f24)); hose.position.set(-0.12, 0.14, 0); hose.rotation.z = Math.PI; g.add(hose);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.1, 0.04), std(0x1c1f24)); grip.position.set(0.02, 0.08, 0); g.add(grip);
    const pilot = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.09, 10), std(0x5fc8ff, { emissive: 0x2a8aff, emissiveIntensity: 1.4 })); pilot.rotation.z = -Math.PI / 2; pilot.position.set(0.41, 0.14, 0); g.add(pilot);
  } else if (kind === 'coil') { // tesla coil gun
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 0.1), std(0x3a4250, { metalness: 0.7, roughness: 0.35 })); body.position.set(-0.05, 0.14, 0); g.add(body);
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.32, 8), std(0xd08a3a, { metalness: 0.9, roughness: 0.25 })); rod.rotation.z = Math.PI / 2; rod.position.set(0.22, 0.14, 0); g.add(rod);
    for (let i = 0; i < 5; i++) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.012, 6, 16), std(0xd08a3a, { metalness: 0.9, roughness: 0.25 })); r.rotation.y = Math.PI / 2; r.position.set(0.1 + i * 0.05, 0.14, 0); g.add(r); }
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.05, 14, 10), std(0x9ff0ff, { emissive: 0x4fd8ff, emissiveIntensity: 1.6, roughness: 0.1 })); orb.position.set(0.4, 0.14, 0); g.add(orb);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.13, 0.05), std(0x1c1f24)); grip.position.set(-0.12, 0.05, 0); grip.rotation.z = 0.2; g.add(grip);
  } else if (kind === 'bubble') { // bubble shield: a soap-bubble orb
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.24, 32, 20), std(0x8fe9ff, { transparent: true, opacity: 0.55, roughness: 0.05, metalness: 0.1, emissive: 0x1a6a8a, emissiveIntensity: 0.6 })); m.position.y = 0.3; g.add(m);
    const hl = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 8), std(0xffffff, { emissive: 0xffffff, emissiveIntensity: 1 })); hl.scale.set(1, 0.6, 0.4); hl.position.set(-0.1, 0.42, 0.14); g.add(hl);
  } else if (kind === 'garagedoor') { // roll-up garage door in a frame; child DOOR slides up
    const frameM = std(0x6b6f76, { metalness: 0.4, roughness: 0.6 });
    for (const x of [-1.35, 1.35]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2.5, 0.3), frameM); p.position.set(x, 1.25, 0); g.add(p); }
    const top = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.4, 0.4), frameM); top.position.set(0, 2.6, 0); g.add(top);
    const door = new THREE.Group(); door.name = 'DOOR'; g.add(door);
    for (let i = 0; i < 8; i++) { const s = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.29, 0.08), std(i % 2 ? 0xc9ccd1 : 0xbfc3c9, { metalness: 0.55, roughness: 0.45 })); s.position.set(0, 0.155 + i * 0.3, 0); door.add(s); }
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.08, 0.09), std(0xf2c200)); stripe.position.set(0, 0.06, 0.005); door.add(stripe);
    const hnd = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.05, 0.06), std(0x2b2f36)); hnd.position.set(0, 0.45, 0.07); door.add(hnd);
  }
  return g;
}
async function procJob(spec) {
  const id = 'proc:' + spec.proc;
  if (!cache.has(id)) cache.set(id, { scene: procModel(spec.proc), animations: [] });
  return _job({ ...spec, url: id });
}

// Contact sheet: items [{src, rect:[x,y,w,h], label, scale}] laid out in a labelled grid on a checker/ground backdrop.
async function sheetJob(spec) {
  const imgs = {};
  for (const it of spec.items) if (!imgs[it.src]) { const im = new Image(); im.src = it.src; await im.decode(); imgs[it.src] = im; }
  const cw = spec.cellW || 200, ch = spec.cellH || 200, cols = spec.cols || 10, rows = Math.ceil(spec.items.length / cols);
  const c = document.createElement('canvas'); c.width = cols * cw; c.height = rows * ch + (spec.title ? 40 : 0); const g = c.getContext('2d');
  g.fillStyle = spec.bg || '#6f7d63'; g.fillRect(0, 0, c.width, c.height);
  const y0 = spec.title ? 40 : 0;
  if (spec.title) { g.fillStyle = '#fff'; g.font = 'bold 22px sans-serif'; g.fillText(spec.title, 12, 28); }
  spec.items.forEach((it, i) => {
    const x = (i % cols) * cw, y = y0 + Math.floor(i / cols) * ch;
    g.fillStyle = (Math.floor(i / cols) + i) % 2 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'; g.fillRect(x, y, cw, ch);
    const [sx, sy, sw, sh] = it.rect; const k = Math.min((cw - 8) / sw, (ch - 26) / sh, it.maxScale || 1.5);
    g.drawImage(imgs[it.src], sx, sy, sw, sh, x + (cw - sw * k) / 2, y + 4 + (ch - 26 - sh * k) / 2, sw * k, sh * k);
    g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect(x, y + ch - 20, cw, 20); g.fillStyle = '#fff'; g.font = '12px sans-serif'; g.fillText(it.label, x + 4, y + ch - 6, cw - 8);
  });
  return { data: c.toDataURL('image/png'), meta: { w: c.width, h: c.height } };
}
window.DBG = false; window.ISO = { job: jobEntry, ready: true };
