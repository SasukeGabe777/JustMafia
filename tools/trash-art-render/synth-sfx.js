'use strict';
// node tools/trash-art-render/synth-sfx.js <public/box/games/trash-assets>
// Our own synthesized loops for JustZombies (no samples; released CC0 with the rest): the helicopter
// rotor (filtered noise chopped at the blade rate + a low thump) and the jetpack (a roaring hiss with a
// rumble). Seamless: every modulation runs a whole number of cycles over the loop and the noise is
// cross-faded at the seam. Written as 16-bit mono WAV and added to manifest.json "sfx".
const fs = require('fs'), path = require('path');
const DEST = process.argv[2] || path.join(__dirname, '..', '..', 'public', 'box', 'games', 'trash-assets');
const SR = 22050;
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
// one-pole low / high pass over a buffer (run twice round the loop so the seam has no start-up)
function lowpass(x, fc) { const a = Math.exp(-2 * Math.PI * fc / SR); let y = 0; const out = new Float32Array(x.length); for (let pass = 0; pass < 2; pass++) for (let i = 0; i < x.length; i++) { y = (1 - a) * x[i] + a * y; out[i] = y; } return out; }
function highpass(x, fc) { const l = lowpass(x, fc); return x.map((v, i) => v - l[i]); }
function noise(n, seed) { const r = rng(seed), x = new Float32Array(n); for (let i = 0; i < n; i++) x[i] = r() * 2 - 1; return x; }
function seam(x, fade) { const n = x.length, out = x.slice(); for (let i = 0; i < fade; i++) { const u = i / fade; out[i] = x[i] * u + x[n - fade + i] * (1 - u); } return out.slice(0, n - fade); }
function norm(x, peak) { let m = 0; for (const v of x) m = Math.max(m, Math.abs(v)); return x.map((v) => (v / (m || 1)) * peak); }
function wav(x) {
  const n = x.length, b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVE', 8); b.write('fmt ', 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(SR, 24); b.writeUInt32LE(SR * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(x[i] * 32767))), 44 + i * 2);
  return b;
}
const FADE = Math.round(SR * 0.08);
// the rotor: 2 s, blades at 13 chops a second (26 over the loop), a whoosh + a low thump on each chop
function rotor() {
  const n = SR * 2 + FADE, nz = lowpass(noise(n, 7), 900), low = lowpass(noise(n, 11), 140), x = new Float32Array(n), L = SR * 2;
  for (let i = 0; i < n; i++) { const ph = ((i % L) / L) * 26 % 1, env = Math.exp(-ph * 9) * 0.9 + 0.12, thump = Math.sin(2 * Math.PI * 52 * (i / SR)) * Math.exp(-ph * 14);
    x[i] = nz[i] * env * 1.6 + low[i] * 2.2 * (0.6 + env) + thump * 0.35; }
  return norm(seam(highpass(x, 40), FADE), 0.85);
}
// the jetpack: 1.5 s of roaring hiss with a flutter and a rumble
function jet() {
  const n = Math.round(SR * 1.5) + FADE, L = Math.round(SR * 1.5), hiss = highpass(lowpass(noise(n, 23), 5200), 700), rum = lowpass(noise(n, 31), 180), x = new Float32Array(n);
  for (let i = 0; i < n; i++) { const fl = 0.8 + 0.2 * Math.sin(2 * Math.PI * 9 * ((i % L) / L)); x[i] = hiss[i] * 0.9 * fl + rum[i] * 3.2; }
  return norm(seam(x, FADE), 0.8);
}
const out = [['sfx.heli.rotor.loop', 'sfx/heli-rotor-loop.wav', rotor()], ['sfx.jet.loop', 'sfx/jet-loop.wav', jet()]];
const mf = path.join(DEST, 'manifest.json'), man = JSON.parse(fs.readFileSync(mf, 'utf8'));
for (const [id, file, x] of out) {
  fs.writeFileSync(path.join(DEST, file), wav(x));
  man.sfx[id] = { file, seconds: +(x.length / SR).toFixed(2), loop: true, source: 'justzombies-synth' };
  console.log('wrote', file, (fs.statSync(path.join(DEST, file)).size / 1024).toFixed(0) + 'K');
}
fs.writeFileSync(mf, JSON.stringify(man, null, 1) + '\n');
