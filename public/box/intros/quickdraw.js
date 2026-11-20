'use strict';
// Quick Draw intro: dawn breaks over a dusty western town and a carved wooden QUICK DRAW sign
// swings into view; high noon, two gunslingers stand off, the bell rings and the screen flashes
// DRAW!; then Sheriff Sundown (big hat, bolo tie, a magnificent moustache) welcomes the posse.
// The roll call slaps a WANTED poster on the saloon wall for every player.
// Phones load this file too (for the How to play tutorial) without the intro engine, so nothing
// here touches BOX.studio: drawing only uses the engine's draw context `s` and BOX.qdArt, and
// only inside draw calls.
(function () {
  const TAU = Math.PI * 2;
  const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, k) => a + (b - a) * k;
  const ease = (k) => { k = clamp(k); return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; };
  const back = (k) => { k = clamp(k); const c = 2.2; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); };
  const POSTER = '"Abril Fatface", "Lilita One", serif', TYPE = '"Special Elite", "Courier New", monospace';
  const A = () => BOX.qdArt;
  function rr(g, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }

  function logo(g, s, lit) {
    const a = A(); const k = back(clamp(lit));
    g.save(); g.scale(k, k); g.rotate(Math.sin((s.t || 0) * 1.6) * 0.02 * (1 - clamp(lit)));
    g.strokeStyle = '#2a160a'; g.lineWidth = 10; g.beginPath(); g.moveTo(-250, -260); g.lineTo(-250, -120); g.moveTo(250, -260); g.lineTo(250, -120); g.stroke();
    rr(g, -380, -130, 760, 260, 26); const gr = g.createLinearGradient(0, -130, 0, 130); gr.addColorStop(0, '#9a6a3a'); gr.addColorStop(1, '#5e3818'); g.fillStyle = gr; g.fill();
    g.lineWidth = 12; g.strokeStyle = '#2a160a'; g.stroke();
    g.fillStyle = 'rgba(0,0,0,0.18)'; for (let y = -100; y < 120; y += 34) g.fillRect(-372, y, 744, 3);
    if (a) {
      a.text(g, 'QUICK', 0, -42, 104, '#fff4d6', { font: POSTER, stroke: '#2a160a', lw: 14 });
      a.text(g, 'DRAW', 0, 66, 124, '#f2b632', { font: POSTER, stroke: '#7a2a12', lw: 16, glow: 'rgba(255,200,80,0.6)' });
    }
    for (const x of [-340, 340]) { g.fillStyle = '#c9c9c9'; g.beginPath(); g.arc(x, -90, 10, 0, TAU); g.arc(x, 90, 10, 0, TAU); g.fill(); }
    g.restore();
  }
  // The town at 1920×1080. o: { pal, host, logo, duel: {draw, flash, lose}, lights }
  function stage(g, s, o = {}) {
    const a = A();
    g.fillStyle = '#c9824a'; g.fillRect(-600, -300, 3120, 1700);
    if (!a) return;
    g.fillStyle = '#2f1745'; g.fillRect(-600, -300, 3120, 900);
    a.scene(g, 1920, 1080, s.t, o.pal || 'sunset', { horizon: 0.55, signs: 0 });
    if (o.duel) {
      const d = o.duel;
      a.cowboy(g, 560, 1020, 520, 1, { arm: d.draw, flash: d.lose === 1 ? d.flash : 0, band: '#c0392b', fall: d.lose === 0 ? d.fall : 0, hat: !(d.lose === 0 && d.fall > 0) });
      a.cowboy(g, 1360, 1020, 520, -1, { arm: d.draw, flash: d.lose === 0 ? d.flash : 0, band: '#2f6b8a', fall: d.lose === 1 ? d.fall : 0, hat: !(d.lose === 1 && d.fall > 0) });
    }
    if (o.host !== false) s.hostAt(960, 940, 0.82);
    if (o.lights != null && o.lights < 1) { g.fillStyle = `rgba(10,4,0,${(1 - o.lights) * 0.85})`; g.fillRect(-600, -300, 3120, 1700); }
    if (o.logo) { g.save(); g.translate(960, 260); logo(g, s, o.logo); g.restore(); }
  }
  // Roll call: a WANTED poster for every player, slapped onto the saloon wall.
  function roll(g, s, F, u, per, o) {
    const a = A();
    s.cam(960, 540, 1);
    g.fillStyle = '#5a3418'; g.fillRect(-600, -300, 3120, 1700);
    for (let y = -300; y < 1400; y += 80) { g.fillStyle = (y / 80) % 2 ? '#6b3f1f' : '#5e3818'; g.fillRect(-600, y, 3120, 78); g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(-600, y + 76, 3120, 4); }
    if (a) a.text(g, 'TONIGHT’S POSSE', 960, 110, 92, '#f2b632', { font: POSTER, stroke: '#2a160a', lw: 14 });
    const n = F.length, cols = n <= 4 ? n : n <= 8 ? Math.ceil(n / 2) : Math.ceil(n / 3), rows = Math.ceil(n / Math.max(1, cols));
    const pw = Math.min(330, 1700 / Math.max(1, cols) - 30, (800 / Math.max(1, rows) - 26) / 1.3), ph = pw * 1.3;
    F.forEach((c, i) => {
      const k = (u - i * per) / 420; if (k <= 0) return;
      const col = i % cols, row = Math.floor(i / cols), rowN = row === rows - 1 ? n - row * cols : cols;
      const x = 960 + (col - (rowN - 1) / 2) * (pw + 30), y = 230 + (rows === 1 ? 160 : 0) + row * (ph + 26) + ph / 2;
      const sc = lerp(1.9, 1, back(k)), rot = (((i * 37) % 9) - 4) * 0.012;
      g.save(); g.translate(x, y); g.rotate(rot + (1 - clamp(k)) * 0.4); g.scale(sc, sc); g.globalAlpha = clamp(k * 2);
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(-pw / 2 + 10, -ph / 2 + 14, pw, ph);
      const gr = g.createRadialGradient(-pw * 0.2, -ph * 0.3, 10, 0, 0, ph * 0.8); gr.addColorStop(0, '#fbecc9'); gr.addColorStop(1, '#d9b678'); g.fillStyle = gr; g.fillRect(-pw / 2, -ph / 2, pw, ph);
      if (a) {
        a.text(g, 'WANTED', 0, -ph / 2 + pw * 0.15, pw * 0.2, '#3a1d0c', { font: POSTER });
        g.fillStyle = c.color || '#b8402a'; g.globalAlpha *= 0.35; g.fillRect(-pw * 0.32, -ph / 2 + pw * 0.28, pw * 0.64, pw * 0.56); g.globalAlpha = clamp(k * 2);
        g.strokeStyle = '#3a1d0c'; g.lineWidth = 4; g.strokeRect(-pw * 0.32, -ph / 2 + pw * 0.28, pw * 0.64, pw * 0.56);
        s.face(c, 0, -ph / 2 + pw * 0.56, pw * 0.42);
        a.text(g, c.name, 0, ph / 2 - pw * 0.36, pw * 0.14, '#3a1d0c', { font: POSTER, max: pw * 0.86 });
        a.text(g, `REWARD $${(((i * 7919 + 13) % 9) + 1) * 500}`, 0, ph / 2 - pw * 0.16, pw * 0.085, '#b8402a', { font: TYPE, max: pw * 0.86 });
      }
      g.fillStyle = '#888'; g.beginPath(); g.arc(0, -ph / 2 + 10, 7, 0, TAU); g.fill();
      g.restore();
    });
    if (o.more && u > n * per - 1200 && a) a.text(g, '…and ' + o.more + ' more gunslingers!', 960, 1030, 50, '#ffe2b0', { font: TYPE, stroke: '#2a160a', lw: 6 });
  }
  function duelShot(g, s) {
    const T = s.T, go = 1650;
    const draw = T > go ? clamp((T - go) / 140) : 0, flash = T > go && T < go + 280 ? 1 - (T - go) / 280 : 0, fall = T > go + 300 ? clamp((T - go - 300) / 500) * 0.3 : 0;
    s.cam(960, lerp(700, 640, ease(s.k)), lerp(1.25, 1.1, ease(s.k)));
    stage(g, s, { pal: 'noon', host: false, duel: { draw, flash, fall, lose: 1 } });
    const a = A(); if (!a) return;
    if (T < go) { const p = 1 + 0.03 * Math.sin(T / 110); g.save(); g.translate(960, 380); g.scale(p, p); a.text(g, 'STEADY…', 0, 0, 120, '#fff4d6', { font: POSTER, stroke: '#2a160a', lw: 14 }); g.restore(); }
    if (flash > 0) { g.fillStyle = `rgba(255,250,220,${flash * 0.85})`; g.fillRect(-600, -300, 3120, 1700); }
    if (T >= go) { const k = back((T - go) / 260); g.save(); g.translate(960, 380); g.scale(k, k); a.text(g, 'DRAW!', 0, 0, 240, '#ffd23f', { font: POSTER, stroke: '#3a1206', lw: 26, glow: 'rgba(255,200,80,0.8)' }); g.restore(); }
  }
  // Sheriff Sundown: a wide brown hat, a bolo tie, a sheriff's vest and a magnificent moustache.
  const look = { skin: '#d9a07a', skinShade: '#b97e58', suit: '#7a4a24', suit2: '#4a2a14', sleeve: '#f3dfb3', lapel: '#3a1d0c', shirt: '#f3dfb3', cuff: '#e2c58c', tie: 'bolo', tieColor: '#c0392b', hair: 'short', hairColor: '#5a3a20', hairShade: '#3a2414', brow: '#4a2a14', hat: '#5a3418', mustache: '#5a3a20', prop: 'mic', grin: true };

  BOX.intros = BOX.intros || {};
  BOX.intros.quickdraw = {
    title: 'Quick Draw',
    // How to play (box/howto.js): one card per step, 6 steps (module howSteps).
    tutorial: [
      { icon: '🔫', title: 'DRAW!', text: 'Wait for the signal, then tap first. Tap early and it’s a FALSE START: you lose the duel and 50 points.', phone: 'Tap the big pad the instant it says DRAW!', say: 'Howdy, partners! First up, the duel. Wait for the signal, then tap first. Tap too early, and that is a false start!' },
      { icon: '🏮', title: 'The Lantern', text: 'Tap ONLY when the lantern on the TV turns GREEN. Every decoy colour you tap is a false start.', phone: 'Eyes on the TV, thumb on the pad.' },
      { icon: '🐔', title: 'Chicken Run', text: 'Count the 🐔 chickens crossing Main Street. Ducks, turkeys and rabbits don’t count!', phone: 'Tap +1 for every 🐔, fix it with −1, then 🔒 Lock in.', say: 'Chicken Run. Count the chickens crossing Main Street. Ducks, turkeys and rabbits don’t count! Tap plus one for every chicken, fix it with minus one, then lock in.' },
      { icon: '🐎', title: 'Stampede', text: 'Shake your phone to gallop your horse to the finish line. No motion sensor? Mash the pad instead.', phone: 'Tap 📳 Allow shaking if asked, then SHAKE!' },
      { icon: '🥁', title: 'Copycat', text: 'Listen to the drum on the TV, then tap the same rhythm back. Two rhythms, each one longer.', phone: 'Tap the pad in time when it says YOUR TURN.' },
      { icon: '🏆', title: 'Winning', text: 'Every challenge pays by rank: 500 for 1st, down to 100. Podium streaks add a bonus, and the Final Showdown pays double!' },
    ],
    theme: { accent: '#f2b632', accent2: '#b8402a', accent3: '#3ec1ff', ink: '#fff4d6', fade: '#2a160a', confetti: ['#f2b632', '#b8402a', '#fff4d6', '#2f6b8a', '#8bd346'] },
    host: {
      name: 'Sheriff Sundown',
      voice: { kokoro: 'am_michael', cb: 'dry', orpheus: 'dan', speed: 1.0, like: /guy|davis|christopher|eric|andrew|brian|guy|male/i, accent: /en-US/i, pitch: 0.92, rate: 1.0 },
      look,
    },
    lines: {
      welcome: 'Howdy, partners! Welcome to Quick Draw, where the fastest thumb in the West takes it all!',
      roll: 'Here\'s tonight\'s posse!', more: '…and {n} more gunslingers!', others: 'And every other gunslinger in town!',
      play: 'Hands by your phones… and DRAW!',
    },
    stage, logo, roll,
    podiumGlyph: '★',
    hostCam: { x: 960, y: 700, z: 1.35 },
    castOpening: [
      { ms: 2500, sfx: [[100, 'wind'], [1500, 'swell']],
        draw(g, s) { const lit = clamp((s.T - 300) / 1500); s.cam(960, lerp(260, 480, ease(s.k)), lerp(1.5, 1.05, ease(s.k))); stage(g, s, { pal: 'morning', host: false, logo: lit, lights: 0.5 + 0.5 * lit }); } },
      { ms: 2900, sfx: [[0, 'heartbeat'], [800, 'heartbeat'], [1650, 'revolver']], draw: duelShot },
      { ms: 2700, sfx: [[0, 'whoosh'], [300, 'cheer']], pose: [[0, 'wave', 1500], [1600, 'point', 1000]], say: 'welcome', sayAt: 150, fit: 2700, crowd: [[200, 'cheer', 2000]],
        draw(g, s) { const k = ease(s.T / 1800); s.cam(960, lerp(520, 640, k), lerp(1, 1.3, k)); stage(g, s, { pal: 'sunset', logo: k < 0.5 ? 1 : 0 }); } },
    ],
  };
})();
