'use strict';
// JustSnap: the bots' "photos". Bots can't hold a camera, so each one gets a small generated SVG
// picture (a little room with things on a table, a cartoon selfie, a blurry close-up texture),
// served from the same photo URLs as the players' real photos. Seeded, so tests are repeatable.
// Plain shapes and system-font emoji only: no scripts, no external resources.

const W = 800, H = 600;
const r1 = (n) => Math.round(n * 10) / 10;
function rng(seed) { let s = (seed >>> 0) || 1; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }
const pick = (r, a) => a[Math.floor(r() * a.length) % a.length];
const hex2 = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
const rgb = (h) => { const n = parseInt(String(h).slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const mix = (a, b, k) => { const A = rgb(a), B = rgb(b); return '#' + [0, 1, 2].map((i) => hex2(A[i] + (B[i] - A[i]) * k)).join(''); };

const WALLS = ['#e9dcc5', '#c9d8e6', '#d9e7cf', '#f0d4d0', '#d8d0ea', '#efe3b8', '#bfd9d6'];
const WOODS = ['#8a5a34', '#a8744a', '#6e4428', '#b98a5e'];
const THINGS = ['🪴', '☕', '🧸', '👟', '🎸', '🍌', '🕰️', '📚', '🧦', '🥫', '🎈', '🍩', '🦆', '🧢', '🍎', '🕯️', '🎲', '🧃', '🥨', '🪀'];
const SUBJECTS = ['🧸', '🪴', '🎸', '🕰️', '🦆', '👟', '🍍', '🎩', '🛼', '🧁', '🪑', '🎺', '🐙', '🌵'];
const FACES = ['😲', '😂', '😬', '🤢', '😍', '🤔', '😱', '😴', '😤', '🥹', '😎', '🤪', '😇', '😭'];

const filters = (id) => `<defs><radialGradient id="v${id}" cx="50%" cy="48%" r="75%"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".55"/></radialGradient>
  <filter id="g${id}" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="1" seed="${id % 97}"/><feColorMatrix values="0 0 0 0 .5  0 0 0 0 .5  0 0 0 0 .5  0 0 0 .09 0"/><feComposite in2="SourceGraphic" operator="in"/></filter>
  <linearGradient id="l${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".28"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>`;
const finish = (id) => `<rect width="${W}" height="${H}" fill="url(#l${id})"/><rect width="${W}" height="${H}" filter="url(#g${id})"/><rect width="${W}" height="${H}" fill="url(#v${id})"/>`;
const svg = (body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${body}</svg>`;
const emoji = (e, x, y, px, rot = 0) => `<text x="${r1(x)}" y="${r1(y)}" font-size="${r1(px)}" text-anchor="middle" dominant-baseline="central" transform="rotate(${r1(rot)} ${r1(x)} ${r1(y)})" font-family="Segoe UI Emoji, Apple Color Emoji, Noto Color Emoji, sans-serif">${e}</text>`;

// A room: wall, window or picture, a table, things on it. `objs` lets Spot the Change edit one.
function sceneParts(seed, o = {}) {
  const r = rng(seed);
  const wall = o.wall || pick(r, WALLS), wood = pick(r, WOODS), deco = r() < 0.5 ? 'window' : 'frame';
  const objs = [];
  const n = 3 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) objs.push({ e: pick(r, THINGS), x: 150 + (i + 0.5) * (500 / n) + (r() - 0.5) * 40, y: 372 - r() * 10, px: 70 + r() * 40, rot: (r() - 0.5) * 16 });
  const subject = o.subject === false ? null : { e: o.subject || pick(r, SUBJECTS), x: 400 + (r() - 0.5) * 120, y: 270, px: 190 + r() * 50, rot: (r() - 0.5) * 10 };
  return { r, wall, wood, deco, objs, subject, sun: r() * 0.4 };
}
function sceneSvg(P, id, tint) {
  const wall = tint ? mix(P.wall, tint, 0.78) : P.wall, wallD = mix(wall, '#000000', 0.18);
  let s = filters(id);
  s += `<rect width="${W}" height="${H}" fill="${wall}"/><rect y="0" width="${W}" height="380" fill="url(#l${id})" opacity=".5"/>`;
  if (P.deco === 'window') s += `<rect x="520" y="60" width="200" height="170" rx="6" fill="#bfe6ff" stroke="${wallD}" stroke-width="10"/><path d="M620 60 V230 M520 145 H720" stroke="${wallD}" stroke-width="8"/><circle cx="680" cy="100" r="20" fill="#fff6c8" opacity="${0.6 + P.sun}"/>`;
  else s += `<rect x="90" y="70" width="170" height="130" fill="${mix(wall, '#ffffff', 0.5)}" stroke="#5b3a22" stroke-width="10"/><path d="M110 180 L160 120 L195 160 L215 140 L245 180Z" fill="${mix(wall, '#2d6a4f', 0.6)}"/>`;
  s += `<rect x="0" y="420" width="${W}" height="180" fill="${tint ? mix(P.wood, tint, 0.55) : P.wood}"/><path d="M0 470 H800 M0 530 H800" stroke="rgba(0,0,0,.15)" stroke-width="3"/>`;
  s += `<rect x="110" y="390" width="580" height="34" rx="6" fill="${mix(P.wood, '#ffffff', 0.15)}" stroke="rgba(0,0,0,.35)" stroke-width="3"/><rect x="140" y="424" width="22" height="150" fill="${mix(P.wood, '#000000', 0.2)}"/><rect x="638" y="424" width="22" height="150" fill="${mix(P.wood, '#000000', 0.2)}"/>`;
  for (const ob of P.objs) if (!ob.gone) s += `<ellipse cx="${r1(ob.x)}" cy="${r1(ob.y + ob.px * 0.42)}" rx="${r1(ob.px * 0.4)}" ry="8" fill="rgba(0,0,0,.22)"/>` + emoji(ob.e, ob.x, ob.y, ob.px, ob.rot);
  if (P.subject) s += `<ellipse cx="${r1(P.subject.x)}" cy="390" rx="${r1(P.subject.px * 0.38)}" ry="12" fill="rgba(0,0,0,.25)"/>` + emoji(P.subject.e, P.subject.x, P.subject.y, P.subject.px, P.subject.rot);
  return svg(s + finish(id));
}

// A photo for a prompt (Photo Hunt, Tiny Giants, Alphabet, Caption, Recreate, Scavenger).
function scene(seed, o = {}) { return sceneSvg(sceneParts(seed, o), seed % 100000, o.tint); }

// Colour Match: the room washed in (roughly) that colour; also the 8x8 colour grid the phones send.
function colour(seed, hex, skill = 0.7) {
  const r = rng(seed ^ 0x5eed);
  const tint = mix(hex, pick(r, ['#ffffff', '#000000', '#808080', '#d0b080']), (1 - skill) * 0.55);
  const P = sceneParts(seed, { subject: false });
  const grid = [];
  const T = rgb(tint), Wl = rgb(mix(P.wall, tint, 0.78)), Fl = rgb(mix(P.wood, tint, 0.55));
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { const c = y < 5 ? Wl : Fl, k = 0.15 + r() * 0.2; grid.push(...c.map((v, i) => Math.round(v * (1 - k) + T[i] * k + (r() - 0.5) * 20))); }
  return { svg: sceneSvg(P, seed % 100000, tint), grid: grid.map((v) => Math.max(0, Math.min(255, v))) };
}

// Selfie Faces: a big cartoon face pulling an expression, arm's-length framing.
function selfie(seed) {
  const r = rng(seed), id = seed % 100000;
  const bg = pick(r, WALLS), f = pick(r, FACES);
  let s = filters(id) + `<rect width="${W}" height="${H}" fill="${bg}"/><circle cx="${r1(200 + r() * 400)}" cy="120" r="160" fill="#fff" opacity=".25"/>`;
  s += `<path d="M180 600 Q200 470 400 460 Q600 470 620 600Z" fill="${pick(r, ['#3a6ea5', '#c0392b', '#2d8a3e', '#7b3fb5', '#333'])}"/>`;
  s += emoji(f, 400 + (r() - 0.5) * 40, 300, 330, (r() - 0.5) * 14);
  return svg(s + finish(id));
}

// Close-Up Mystery: a blurry, zoomed-in texture.
function closeup(seed) {
  const r = rng(seed), id = seed % 100000;
  const a = pick(r, ['#c0392b', '#e9b064', '#3a6ea5', '#6b3e1f', '#2d8a3e', '#d8d0ea', '#f0c4a0']), b = mix(a, pick(r, ['#ffffff', '#000000']), 0.35);
  const kind = Math.floor(r() * 3);
  let s = `<defs><filter id="b${id}"><feGaussianBlur stdDeviation="${r1(3 + r() * 5)}"/></filter></defs>` + filters(id) + `<rect width="${W}" height="${H}" fill="${a}"/><g filter="url(#b${id})">`;
  if (kind === 0) for (let i = 0; i < 26; i++) s += `<rect x="${i * 34 - 40}" y="-50" width="16" height="700" fill="${b}" transform="rotate(${r1(14 + r() * 4)} 400 300)"/>`;
  else if (kind === 1) for (let i = 0; i < 70; i++) s += `<circle cx="${r1(r() * W)}" cy="${r1(r() * H)}" r="${r1(8 + r() * 34)}" fill="${i % 2 ? b : mix(a, '#ffffff', 0.2)}"/>`;
  else for (let i = 0; i < 40; i++) s += `<path d="M${r1(r() * W)} ${r1(r() * H)} q ${r1(60 + r() * 80)} ${r1(-40 + r() * 80)} ${r1(140 + r() * 100)} 0" stroke="${b}" stroke-width="${r1(6 + r() * 12)}" fill="none" stroke-linecap="round"/>`;
  return svg(s + '</g>' + finish(id));
}

// Spot the Change: the same room twice, one thing changed. mark = where (0..1 of the picture).
function changePair(seed) {
  const P = sceneParts(seed, { subject: false }), r = rng(seed ^ 0xc4a6e), id = seed % 100000;
  const a = sceneSvg(P, id);
  const i = Math.floor(r() * P.objs.length), ob = P.objs[i], how = Math.floor(r() * 3);
  const mark = { x: ob.x / W, y: ob.y / H };
  if (how === 0) ob.gone = true;
  else if (how === 1) ob.e = pick(r, THINGS.filter((e) => e !== ob.e));
  else { ob.rot += 180; }
  return { a, b: sceneSvg(P, id + 1), mark };
}

module.exports = { scene, colour, selfie, closeup, changePair, rgb, W, H };
