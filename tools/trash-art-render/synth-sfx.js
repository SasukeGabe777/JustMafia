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
// the wild realms' ambience: wind (frozen: gusts of filtered noise), lava (a low roar with crackles and pops),
// birds (country: little chirps over a soft breeze); a cow (a one-shot moo: a sawtooth with a vowel filter)
function wind() { const L = SR * 4, n = L + FADE, nz = lowpass(noise(n, 41), 700), x = new Float32Array(n); for (let i = 0; i < n; i++) { const u = (i % L) / L; x[i] = nz[i] * (0.55 + 0.45 * Math.sin(2 * Math.PI * 2 * u) * Math.sin(2 * Math.PI * 3 * u + 1)); } return norm(seam(highpass(x, 120), FADE), 0.7); }
function lava() { const L = SR * 3, n = L + FADE, rum = lowpass(noise(n, 51), 160), cr = highpass(noise(n, 53), 1800), r = rng(55), x = new Float32Array(n); let pop = 0; for (let i = 0; i < n; i++) { if (r() < 6 / SR) pop = 1; pop *= 0.996; x[i] = rum[i] * 3 + cr[i] * (0.05 + pop * 0.9) * (r() < 0.3 ? 1 : 0.4); } return norm(seam(x, FADE), 0.7); }
function birds() { const L = SR * 4, n = L + FADE, br = lowpass(noise(n, 61), 500), r = rng(63), x = new Float32Array(n); for (let i = 0; i < n; i++) x[i] = br[i] * 0.6; for (let k = 0; k < 9; k++) { const t0 = Math.floor(r() * (L - SR * 0.4)), f0 = 2600 + r() * 1800, notes = 2 + Math.floor(r() * 3); for (let j = 0; j < notes; j++) { const s0 = t0 + j * Math.floor(SR * 0.09), len = Math.floor(SR * 0.07); for (let i = 0; i < len; i++) { const u = i / len, f = f0 * (1 + 0.25 * Math.sin(Math.PI * u)); x[s0 + i] += Math.sin(2 * Math.PI * f * i / SR) * Math.sin(Math.PI * u) * 0.35; } } } return norm(seam(x, FADE), 0.6); }
function moo() { const n = Math.round(SR * 1.3), x = new Float32Array(n); let ph = 0; for (let i = 0; i < n; i++) { const u = i / n, f = 115 + 25 * Math.sin(Math.PI * u) - 20 * u; ph += f / SR; const saw = 2 * (ph % 1) - 1; x[i] = saw * Math.min(1, u * 8) * Math.min(1, (1 - u) * 4); } const v = lowpass(lowpass(x, 700), 900); return norm(v, 0.8); }
const out = [['sfx.heli.rotor.loop', 'sfx/heli-rotor-loop.wav', rotor()], ['sfx.jet.loop', 'sfx/jet-loop.wav', jet()], ['sfx.wind.loop', 'sfx/wind-loop.wav', wind()], ['sfx.lava.loop', 'sfx/lava-loop.wav', lava()], ['sfx.birds.loop', 'sfx/birds-loop.wav', birds()], ['sfx.moo', 'sfx/moo.wav', moo(), false]];
const mf = path.join(DEST, 'manifest.json'), man = JSON.parse(fs.readFileSync(mf, 'utf8'));
for (const [id, file, x, isLoop] of out) {
  fs.writeFileSync(path.join(DEST, file), wav(x));
  man.sfx[id] = { file, seconds: +(x.length / SR).toFixed(2), loop: isLoop !== false, source: 'justzombies-synth' };
  console.log('wrote', file, (fs.statSync(path.join(DEST, file)).size / 1024).toFixed(0) + 'K');
}
fs.writeFileSync(mf, JSON.stringify(man, null, 1) + '\n');
