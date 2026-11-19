'use strict';
// JustSnap intro: SNAP! magazine's office, the night before the deadline. Camera flashes light the
// dark room; the neon SNAP! sign over the wall of old covers buzzes on; then Margo Flash, the
// editor (silver hair with a pink streak, huge red glasses, a black turtleneck, her beret and the
// camera she never takes off) needs photographers for the next issue. In the roll call every
// player's portrait is pinned up on the cover wall with a flash.
// Margo is the in-game character too (public/box/games/snap.js draws her with host.draw and speaks
// her lines). Her in-game lines are listed in `story` (copied from box/games/snap.js, MARGO) so
// tools/voice-gen.js pre-voices them.
// Engine + API: public/box/show.js ('cast' mode).
(function () {
  const ST = BOX.studio, { lerp, ss, ease, easeOut, rng, OUT, TAU } = ST.util, { rr, text } = ST.draw;
  const SERIF = '"Abril Fatface", Georgia, serif', BOLD = '"Bungee", "Lilita One", sans-serif', HAND = '"Permanent Marker", cursive';
  try { if (document.fonts) for (const f of ['40px "Abril Fatface"', '40px "Bungee"', '40px "Permanent Marker"']) document.fonts.load(f); } catch { /* fine */ }
  const R = rng(1977);
  const INK = '#16141c', PINK = '#ff2e63', GOLD = '#ffcc33', PAPER = '#f7f3ea', CYAN = '#2ec4d6';
  const DESK_Y = 820, MARGO = [960, 832, 1.0];
  const COVERS = Array.from({ length: 14 }, (_, i) => ({ c: [PINK, GOLD, CYAN, '#7b3fb5', '#3aa655', '#ff8c1a'][i % 6], r: (R() - 0.5) * 0.12, e: ['🌵', '🐶', '🍩', '🎈', '🌻', '🦆', '😎', '🍉', '🎸', '🐙', '🌈', '🪐', '🍦', '🐱'][i] }));
  const DUST = Array.from({ length: 40 }, () => [R() * 1920, R() * 1080, 1 + R() * 2.5, 8 + R() * 20, R() * TAU]);

  function wall(g, lit) {
    let gr = g.createLinearGradient(0, -300, 0, 1000); gr.addColorStop(0, '#2b2233'); gr.addColorStop(1, '#17131d'); g.fillStyle = gr; g.fillRect(-600, -300, 3120, 1700);
    g.fillStyle = 'rgba(255,255,255,0.03)'; for (let x = -600; x < 2520; x += 60) g.fillRect(x, -300, 26, 1700);
    gr = g.createRadialGradient(960, 360, 60, 960, 360, 1100); gr.addColorStop(0, `rgba(255,120,170,${0.22 * lit})`); gr.addColorStop(1, 'rgba(255,120,170,0)'); g.fillStyle = gr; g.fillRect(-600, -300, 3120, 1700);
  }
  // A magazine cover pinned to the wall.
  function cover(g, x, y, w, c, rot, emoji, s) {
    const h = w * 1.3;
    g.save(); g.translate(x, y); g.rotate(rot);
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(-w / 2 + 8, -h / 2 + 10, w, h);
    g.fillStyle = c; g.fillRect(-w / 2, -h / 2, w, h); g.lineWidth = 4; g.strokeStyle = OUT; g.strokeRect(-w / 2, -h / 2, w, h);
    text(g, 'SNAP!', 0, -h / 2 + w * 0.17, w * 0.26, PAPER, { font: SERIF, stroke: OUT, lw: 5 });
    if (emoji) s.emoji(emoji, 0, h * 0.08, w * 0.5);
    g.fillStyle = 'rgba(255,255,255,0.85)'; g.fillRect(-w * 0.38, h * 0.34, w * 0.5, 6); g.fillRect(-w * 0.38, h * 0.4, w * 0.34, 6);
    g.fillStyle = '#c9a06a'; g.beginPath(); g.arc(0, -h / 2 + 6, 8, 0, TAU); g.fill(); g.lineWidth = 2; g.stroke();
    g.restore();
  }
  function coverWall(g, s) {
    const xs = [170, 360, 1560, 1750], ys = [150, 440];
    let i = 0;
    for (const y of ys) for (const x of xs) { const C = COVERS[i++ % COVERS.length]; cover(g, x, y, 150, C.c, C.r, C.e, s); }
  }
  // The neon SNAP! sign.
  function logo(g, s, lit) {
    lit = Math.max(0, Math.min(1, lit));
    rr(g, -330, -120, 660, 240, 26); g.fillStyle = 'rgba(14,10,18,0.94)'; g.fill(); g.lineWidth = 6; g.strokeStyle = '#3a3044'; g.stroke();
    g.font = `140px ${SERIF}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
    g.lineWidth = 6; g.strokeStyle = 'rgba(120,100,120,0.6)'; g.strokeText('SNAP!', 0, 8);
    if (lit > 0) { g.save(); g.globalAlpha = lit; g.shadowColor = PINK; g.shadowBlur = 40; g.strokeStyle = PINK; g.lineWidth = 8; g.strokeText('SNAP!', 0, 8); g.shadowBlur = 14; g.fillStyle = '#fff0f4'; g.fillText('SNAP!', 0, 8); g.restore(); }
    g.save(); g.globalAlpha = 0.4 + 0.6 * lit; text(g, 'THE MAGAZINE OF EVERYTHING', 0, 92, 24, GOLD, { font: BOLD }); g.restore();
  }
  function lamp(g, x, lit) {
    g.strokeStyle = '#0c0a10'; g.lineWidth = 4; g.beginPath(); g.moveTo(x, -300); g.lineTo(x, 30); g.stroke();
    g.fillStyle = INK; g.beginPath(); g.moveTo(x - 80, 120); g.lineTo(x - 34, 20); g.lineTo(x + 34, 20); g.lineTo(x + 80, 120); g.closePath(); g.fill(); g.lineWidth = 5; g.strokeStyle = PINK; g.stroke();
    if (lit > 0) { g.save(); g.globalCompositeOperation = 'lighter'; const gr = g.createLinearGradient(0, 120, 0, 840); gr.addColorStop(0, `rgba(255,236,200,${0.22 * lit})`); gr.addColorStop(1, 'rgba(255,236,200,0)'); g.fillStyle = gr; g.beginPath(); g.moveTo(x - 70, 120); g.lineTo(x + 70, 120); g.lineTo(x + 260, 840); g.lineTo(x - 260, 840); g.closePath(); g.fill(); g.restore(); }
  }
  // The editor's desk: a lightbox with slides, a pile of prints, a coffee, a red phone.
  function desk(g, s) {
    let gr = g.createLinearGradient(0, DESK_Y, 0, DESK_Y + 46); gr.addColorStop(0, '#3a3044'); gr.addColorStop(1, '#241d2c'); g.fillStyle = gr; g.fillRect(-600, DESK_Y, 3120, 46);
    g.lineWidth = 5; g.strokeStyle = OUT; g.strokeRect(-600, DESK_Y, 3120, 46);
    gr = g.createLinearGradient(0, DESK_Y + 46, 0, 1200); gr.addColorStop(0, '#1f1a26'); gr.addColorStop(1, '#0e0c12'); g.fillStyle = gr; g.fillRect(-600, DESK_Y + 46, 3120, 500);
    g.fillStyle = PINK; g.fillRect(-600, DESK_Y + 60, 3120, 10);
    // lightbox with slides
    g.fillStyle = '#fffdf0'; rr(g, 420, DESK_Y - 30, 300, 34, 6); g.fill(); g.lineWidth = 4; g.strokeStyle = OUT; g.stroke();
    g.save(); g.globalCompositeOperation = 'lighter'; const lb = g.createRadialGradient(570, DESK_Y - 20, 10, 570, DESK_Y - 40, 220); lb.addColorStop(0, 'rgba(255,255,230,0.35)'); lb.addColorStop(1, 'rgba(255,255,230,0)'); g.fillStyle = lb; g.fillRect(350, DESK_Y - 260, 440, 280); g.restore();
    for (let i = 0; i < 5; i++) { g.fillStyle = ['#ff8fb1', '#6ec6ff', '#ffd36e', '#8fe3b0', '#c3a6ff'][i]; g.fillRect(440 + i * 56, DESK_Y - 26, 44, 26); g.lineWidth = 2; g.strokeStyle = OUT; g.strokeRect(440 + i * 56, DESK_Y - 26, 44, 26); }
    // a pile of prints
    for (let i = 0; i < 5; i++) { g.save(); g.translate(1300 + i * 6, DESK_Y - 10 - i * 7); g.rotate((i - 2) * 0.09); g.fillStyle = '#fbf8f1'; g.fillRect(-70, -20, 140, 22); g.lineWidth = 2; g.strokeStyle = OUT; g.strokeRect(-70, -20, 140, 22); g.restore(); }
    // coffee
    g.fillStyle = PAPER; rr(g, 1480, DESK_Y - 70, 60, 70, 10); g.fill(); g.lineWidth = 4; g.strokeStyle = OUT; g.stroke(); g.fillStyle = PINK; g.fillRect(1480, DESK_Y - 46, 60, 14);
    g.beginPath(); g.arc(1546, DESK_Y - 38, 16, -1.2, 1.2); g.lineWidth = 6; g.stroke();
    for (let i = 0; i < 3; i++) { g.strokeStyle = `rgba(255,255,255,${0.25 + 0.15 * Math.sin(s.t * 2 + i)})`; g.lineWidth = 3; g.beginPath(); g.moveTo(1498 + i * 12, DESK_Y - 80); g.quadraticCurveTo(1490 + i * 12 + Math.sin(s.t * 2 + i) * 8, DESK_Y - 110, 1500 + i * 12, DESK_Y - 140); g.stroke(); }
  }
  function dust(g, s) { g.fillStyle = 'rgba(255,240,250,0.3)'; for (const [x, y, r, v, p] of DUST) { const yy = (y + s.t * v) % 1080, xx = x + Math.sin(s.t + p) * 20; g.beginPath(); g.arc(xx, yy, r, 0, TAU); g.fill(); } }
  function flash(g, k) { if (k <= 0) return; g.fillStyle = `rgba(255,255,245,${Math.min(1, k)})`; g.fillRect(-600, -300, 3120, 1700); }
  function stage(g, s, o = {}) {
    const lit = o.lights == null ? 1 : o.lights;
    wall(g, lit);
    coverWall(g, s);
    g.save(); g.translate(960, 230); g.scale(0.72, 0.72); logo(g, s, o.logo == null ? 1 : o.logo); g.restore();
    for (const x of [620, 1300]) lamp(g, x, lit);
    if (o.host !== false) s.host(MARGO[0], MARGO[1], MARGO[2]);
    desk(g, s);
    if (o.extra) o.extra(g, s);
    dust(g, s);
    if (lit < 1) { g.fillStyle = `rgba(6,4,10,${(1 - lit) * 0.8})`; g.fillRect(-600, -300, 3120, 1700); }
    const v = g.createRadialGradient(960, 540, 520, 960, 540, 1300); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.55)'); g.fillStyle = v; g.fillRect(-600, -300, 3120, 1700);
  }

  // ---- the roll call: every photographer's portrait pinned up as an instant photo, with a flash ----
  function roll(g, s, F, u, per, o) {
    s.cam(960, 540, 1);
    wall(g, 1);
    text(g, 'TONIGHT’S PHOTOGRAPHERS', 960, 110, 70, PAPER, { font: SERIF, stroke: OUT, lw: 12 });
    const n = F.length, cols = n <= 6 ? n : Math.ceil(n / 2), rows = Math.ceil(n / cols), tw = Math.min(320, 1720 / Math.max(1, cols));
    F.forEach((c, i) => {
      const k = (u - i * per) / 360; if (k <= 0) return;
      const col = i % cols, row = Math.floor(i / cols), rowN = row === rows - 1 ? n - row * cols : cols;
      const x = 960 + (col - (rowN - 1) / 2) * tw, y = (rows > 1 ? 380 : 560) + row * 400, w = Math.min(250, tw * 0.82), h = w * 1.2, e = easeOut(Math.min(1, k));
      const rot = ((i * 37) % 9 - 4) * 0.02;
      g.save(); g.translate(x, lerp(y + 80, y, e)); g.rotate(rot); g.globalAlpha = Math.min(1, k * 2);
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(-w / 2 + 8, -h / 2 + 10, w, h);
      g.fillStyle = '#fbf8f1'; g.fillRect(-w / 2, -h / 2, w, h);
      const pw = w * 0.86, py = -h / 2 + w * 0.07;
      const gr = g.createLinearGradient(0, py, 0, py + pw); gr.addColorStop(0, c.color || PINK); gr.addColorStop(1, INK); g.fillStyle = gr; g.fillRect(-pw / 2, py, pw, pw);
      s.face(c, 0, py + pw * 0.52, pw * 0.62);
      const dev = Math.max(0, 1 - (u - i * per) / 900); g.fillStyle = `rgba(30,20,24,${dev * 0.85})`; g.fillRect(-pw / 2, py, pw, pw);
      text(g, c.name, 0, py + pw + (h - pw - w * 0.07) * 0.5, 34, INK, { font: HAND, max: w - 16 });
      g.fillStyle = PINK; g.beginPath(); g.arc(0, -h / 2 + 4, 10, 0, TAU); g.fill(); g.lineWidth = 3; g.strokeStyle = OUT; g.stroke();
      g.restore();
      const fk = (u - i * per) / 220; if (fk > 0 && fk < 1) { const fr = g.createRadialGradient(x, y, 0, x, y, 340); fr.addColorStop(0, `rgba(255,255,245,${0.8 * (1 - fk)})`); fr.addColorStop(1, 'rgba(255,255,245,0)'); g.fillStyle = fr; g.fillRect(x - 340, y - 340, 680, 680); }
    });
    if (o.more && u > n * per - 1200) text(g, '…and ' + o.more + ' more photographers on the job', 960, 1020, 44, GOLD, { font: SERIF, stroke: OUT, lw: 8 });
  }

  // Margo Flash: silver bob with a pink streak, huge red glasses, a black turtleneck; host.draw =
  // the shared character + her black beret and the camera on its strap.
  const look = { skin: '#f0c4a0', skinShade: '#d49c78', suit: '#1d1b22', suit2: '#111015', sleeve: '#24222a', lapel: '#1d1b22', shirt: '#1d1b22', cuff: PINK, tie: 'none', hair: 'curly', hairColor: '#e4e0ea', hairShade: '#b8b2c2', streak: PINK, brow: '#9a94a4', glasses: PINK, grin: true, prop: null };
  let base = null;
  function margoDraw(g, a) {
    if (!base) base = ST.makeHost(look);
    // the camera hangs on its strap (drawn first: the strap goes behind her arms)
    const sway = Math.sin(a.t * 0.9 + a.seed) * 4, bounce = a.talk ? -Math.abs(Math.sin(a.t * 6.2)) * 4 : Math.sin(a.t * 1.6) * 1.5;
    base(g, a);
    g.save(); g.translate(sway * 0.6, bounce * 0.6);
    g.strokeStyle = PINK; g.lineWidth = 7; g.beginPath(); g.moveTo(-46, -262); g.quadraticCurveTo(-30, -190, -6, -168); g.moveTo(46, -262); g.quadraticCurveTo(30, -190, 6, -168); g.stroke();
    g.lineWidth = 4; g.strokeStyle = OUT;
    g.fillStyle = '#2b2b33'; rr(g, -14, -186, 28, 12, 4); g.fill(); g.stroke();
    g.fillStyle = '#f4f1ea'; rr(g, -50, -176, 100, 62, 12); g.fill(); g.stroke();
    g.fillStyle = PINK; g.fillRect(-50, -158, 100, 10);
    g.fillStyle = INK; g.beginPath(); g.arc(0, -145, 24, 0, TAU); g.fill();
    g.fillStyle = '#2a6f9a'; g.beginPath(); g.arc(0, -145, 15, 0, TAU); g.fill(); g.fillStyle = 'rgba(255,255,255,0.8)'; g.beginPath(); g.arc(-5, -150, 4, 0, TAU); g.fill();
    g.restore();
    // the beret, tilted, moving with her head
    g.save(); g.translate(sway, bounce); g.translate(0, -215); g.rotate(Math.sin(a.t * 1.7 + a.seed) * 0.035 + (a.talk ? Math.sin(a.t * 5.1) * 0.045 : 0)); g.translate(0, 215);
    g.fillStyle = '#16141c'; g.lineWidth = 5; g.strokeStyle = OUT;
    g.beginPath(); g.ellipse(-8, -366, 74, 26, -0.16, 0, TAU); g.fill(); g.stroke();
    g.beginPath(); g.ellipse(-4, -376, 58, 22, -0.16, Math.PI, TAU); g.fill();
    g.strokeStyle = '#16141c'; g.lineWidth = 6; g.beginPath(); g.moveTo(-6, -394); g.lineTo(-2, -408); g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.12)'; g.beginPath(); g.ellipse(-30, -372, 26, 7, -0.2, 0, TAU); g.fill();
    g.restore();
  }

  BOX.intros = BOX.intros || {};
  BOX.intros.snap = {
    title: 'JustSnap',
    // How to play (box/howto.js): one card per step (module howSteps = 6). Margo explains it.
    tutorial: [
      { icon: '📰', title: 'The assignment', text: 'Margo gives an assignment on the TV: something to find, a colour, a letter, a face to pull.', phone: 'Read the assignment on the TV and your phone.', say: 'Every round I give you an assignment. Something to find, a colour, a letter, or a face to pull.' },
      { icon: '📸', title: 'Go and shoot it', text: 'Run around and take a photo with your phone: tap Take photo, check the preview, then Send. Only this room’s TV gets it.', phone: 'Tap 📸 Take photo, then ✅ Send.', say: 'Then run! Take the photo with your phone, check it, and send it to me. Only this room sees it.' },
      { icon: '🖼️', title: 'The gallery', text: 'The photos go up on the TV with numbers and no names. Vote for your favourite, never your own, or guess what each one is.', phone: 'Vote or guess on your phone.', say: 'Your photos go up on the wall with numbers, and no names. Vote for your favourite, but never your own. Or guess what each one is.' },
      { icon: '🎲', title: 'Ten kinds of shoot', text: 'Photo Hunt, Scavenger Race, Close-Up Mystery, Colour Match, Selfie Faces, Tiny Giants, Caption This, Spot the Change, Alphabet Hunt and Team Recreate.', say: 'Every round is different. Hunts, races, mystery close-ups, colours, selfies, tiny giants, captions, spot the change, the alphabet, and team shoots.' },
      { icon: '🙈', title: 'The host is in charge', text: 'The host can hide any photo, and can choose to check every photo before the room sees it.', phone: 'Keep it friendly: the host can hide any photo.', say: 'Keep it friendly, darlings. The host can hide any photo.' },
      { icon: '⭐', title: 'Stars and the cover', text: 'Votes, right guesses and speed earn stars. The best photo of every round goes in the final issue. Most stars wins.', say: 'Votes, good guesses and speed earn you stars. The best photo of every round goes in my magazine. Most stars wins!' },
    ],
    // Every line Margo says during the game, copied character for character from box/games/snap.js (MARGO).
    story: [
      'Photo hunt! Find it, frame it, and bring it back to me.',
      'Scavenger race! Every item on the list, and the fastest camera wins.',
      'Close-up mystery! Get so close that nobody knows what it is.',
      'Colour match! Find me that exact colour, and fill the frame.',
      'Selfie faces! Check your phone for your secret mood, and act it out.',
      'Tiny giants! Play with perspective. Make small things huge!',
      'Caption this! Snap something that is begging for a caption.',
      'Spot the change! Snap a scene, change one thing, and snap it again.',
      'Alphabet hunt! It must start with the letter on the screen.',
      'Team shoot! Get together and recreate the scene. Make it art!',
      'Go, go, go! The magazine prints at midnight!',
      'Shoot first, think later, darlings!',
      'Find the light, darling. Always find the light.',
      'Ten seconds! Send me what you have!',
      'One moment. The host is checking the photos.',
      'The gallery is open. Vote for your favourite, but not your own!',
      'Which one makes the cover? You decide.',
      'Check every photo. If one is not the real thing, flag it!',
      'Now, what are we looking at? Make your guesses!',
      'Find what changed! Tap the spot.',
      'Write a caption for the photo on your phone. Make me laugh!',
      'Stunning. Simply stunning.',
      'That one is going on the cover!',
      'I have seen things tonight. Wonderful things.',
      'No photos? My readers will riot!',
      'Last assignment of the night. Make it unforgettable!',
      'That is a wrap! The new issue goes to print. You were magnificent, darlings.',
    ],
    theme: { accent: GOLD, accent2: PINK, accent3: CYAN, ink: PAPER, panel: 'rgba(22,20,28,0.92)', fade: '#0e0c12', confetti: [PINK, GOLD, CYAN, PAPER, '#7b3fb5'] },
    host: {
      name: 'Margo Flash',
      voice: { kokoro: 'af_nicole', speed: 1.05, like: /female|zira|aria|jenny|samantha|sonia|libby/i, accent: /en-US|en-GB/i, pitch: 1.0, rate: 1.05 },
      look,
      draw: margoDraw,
    },
    lines: {
      welcome: 'Darlings! Margo Flash, editor of SNAP! magazine. The next issue prints at midnight and I have no photos. None! You are my photographers now.',
      roll: 'Let me see my photographers.',
      more: '…and {n} more photographers on the job.',
      others: 'And the rest of you: charge your phones!',
      play: 'Cameras ready? Here is your first assignment.',
    },
    stage, logo, roll,
    podium() { /* no podium: Margo stands behind her desk */ },
    hostCam: { x: 960, y: 560, z: 1.5 },
    castOpening: [
      // Darkness, then camera flashes light the office in bursts.
      { ms: 2600, sfx: [[200, 'shutter'], [900, 'shutter'], [1500, 'shutter'], [2100, 'swell']],
        draw(g, s) {
          const k = s.k, T = s.T;
          s.cam(960, 500, lerp(1.6, 1.3, ease(k)));
          stage(g, s, { host: false, lights: 0.08, logo: 0 });
          for (const at of [200, 900, 1500, 2100]) { const d = (T - at) / 260; if (d > 0 && d < 1) flash(g, 0.85 * (1 - d)); }
        } },
      // The neon sign buzzes on over the wall of covers.
      { ms: 2800, sfx: [[300, 'click'], [900, 'click']],
        draw(g, s) {
          const k = s.k, sign = k < 0.2 ? 0 : k < 0.3 ? (Math.sin(k * 260) > 0 ? 0.9 : 0.1) : k < 0.36 ? 0.3 : 1;
          s.cam(960, lerp(260, 430, ease(k)), lerp(2.0, 1.15, ease(k)));
          stage(g, s, { host: false, logo: sign, lights: 0.25 + 0.75 * ss(0.35, 0.8, k) });
        } },
      // Margo Flash greets her new photographers.
      { ms: 3200, sfx: [[0, 'join']], pose: [[500, 'wave', 1500]], say: 'welcome', sayAt: 350, fit: 7000,
        draw(g, s) {
          const k = s.k;
          s.cam(960, lerp(560, 600, ease(k)), lerp(1.05, 1.45, ease(k)));
          stage(g, s, {});
        } },
    ],
  };
})();
