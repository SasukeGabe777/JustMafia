'use strict';
// JustUndercover intro: the agency's briefing room, late at night. The camera finds a red light
// blinking on the world map ("a mole has slipped in"), the desk lamp clicks on, the JustUndercover
// sign lights up over the map, and Director Grey (silver hair, an eye patch, a black suit and a
// red tie) leans on his desk to brief his agents. In the roll call every agent's photo is pinned
// to the case board with a red string. Grey is the in-game character too (public/box/games/
// undercover.js draws him with host.draw and speaks his lines). His in-game lines are listed in
// `story` (copied from box/games/undercover.js, GREY) so tools/voice-gen.js pre-voices them.
// Engine + API: public/box/show.js ('cast' mode).
(function () {
  const ST = BOX.studio, { lerp, ss, ease, easeOut, rng, OUT, TAU } = ST.util, { rr, text } = ST.draw;
  const SIGN = '"Rubik Mono One", "Bungee", sans-serif', TYPE = '"Special Elite", "Courier New", monospace', BOLD = '"Lilita One", sans-serif';
  try { if (document.fonts) for (const f of ['40px "Rubik Mono One"', '40px "Special Elite"', '40px "Lilita One"']) document.fonts.load(f); } catch { /* fine */ }
  const R = rng(1947);
  const NAVY = '#111a2e', CYAN = '#5ff2ff', GOLD = '#f2c14e', RED = '#e2363f', MANILA = '#ecd9a6', PAPER = '#fbf7ec', WOOD = '#4a2e18', WOOD2 = '#2c1b0e';
  const DESK_Y = 790, GREY = [960, 800, 1.0];

  // ---- fixed decoration ----
  const dots = (() => { const a = []; const blobs = [[600, 300, 150, 120], [700, 470, 80, 130], [1010, 270, 170, 110], [990, 440, 80, 90], [1290, 340, 150, 120], [1370, 520, 80, 60]];
    for (const [cx, cy, rx, ry] of blobs) for (let i = 0; i < 140; i++) { const a2 = R() * TAU, r = Math.sqrt(R()); a.push([cx + Math.cos(a2) * rx * r, cy + Math.sin(a2) * ry * r]); } return a; })();
  const dust = Array.from({ length: 40 }, () => [R() * 1920, R() * 1080, 1 + R() * 2.5, 6 + R() * 18, R() * TAU]);
  const files = Array.from({ length: 5 }, (_, i) => [1270 + i * 6, DESK_Y - 14 - i * 12, (R() - 0.5) * 0.12]);

  function wall(g, s, lit) {
    let gr = g.createLinearGradient(0, -300, 0, 1000); gr.addColorStop(0, '#1b2a48'); gr.addColorStop(1, '#0b1222'); g.fillStyle = gr; g.fillRect(-600, -300, 3120, 1700);
    // wood panelling below, steel above
    for (let x = -600; x < 2520; x += 160) { g.fillStyle = (x / 160) % 2 ? '#142039' : '#16243f'; g.fillRect(x, -300, 160, 900); }
    gr = g.createLinearGradient(0, 600, 0, 900); gr.addColorStop(0, '#3a2414'); gr.addColorStop(1, '#22140a'); g.fillStyle = gr; g.fillRect(-600, 600, 3120, 600);
    g.fillStyle = '#5a3a20'; g.fillRect(-600, 596, 3120, 10);
    // light through the blinds, across the room
    g.save(); g.globalCompositeOperation = 'lighter'; g.translate(160, -100); g.rotate(-0.28);
    for (let i = 0; i < 12; i++) { g.fillStyle = `rgba(140,180,255,${0.045 * lit})`; g.fillRect(-200, i * 64, 900, 30); }
    g.restore();
  }
  function blinds(g, lit) {
    g.fillStyle = '#0a1020'; rr(g, 120, 120, 300, 400, 8); g.fill(); g.lineWidth = 6; g.strokeStyle = '#2b3a5c'; g.stroke();
    const gr = g.createLinearGradient(120, 120, 420, 520); gr.addColorStop(0, `rgba(170,200,255,${0.55 * lit + 0.15})`); gr.addColorStop(1, 'rgba(60,80,140,0.2)');
    for (let i = 0; i < 16; i++) { g.fillStyle = gr; g.fillRect(130, 130 + i * 24, 280, 14); }
    // the moon behind them
    g.fillStyle = `rgba(255,250,220,${0.5 * lit + 0.2})`; g.beginPath(); g.arc(340, 210, 40, 0, TAU); g.fill();
  }
  // The big world map screen behind the desk; the red light marks the mole.
  function mapScreen(g, s, o) {
    const on = o.screen == null ? 1 : o.screen;
    g.fillStyle = '#05080f'; rr(g, 470, 140, 980, 470, 18); g.fill(); g.lineWidth = 8; g.strokeStyle = '#2b3a5c'; g.stroke();
    g.save(); rr(g, 482, 152, 956, 446, 12); g.clip();
    const gr = g.createRadialGradient(960, 380, 40, 960, 380, 600); gr.addColorStop(0, `rgba(20,70,90,${0.9 * on})`); gr.addColorStop(1, `rgba(5,15,30,${on})`); g.fillStyle = gr; g.fillRect(470, 140, 980, 470);
    g.fillStyle = `rgba(95,242,255,${0.55 * on})`; for (const [x, y] of dots) g.fillRect(x, y, 4, 4);
    g.strokeStyle = `rgba(95,242,255,${0.12 * on})`; g.lineWidth = 2; for (let x = 500; x < 1450; x += 60) { g.beginPath(); g.moveTo(x, 150); g.lineTo(x, 600); g.stroke(); } for (let y = 170; y < 600; y += 60) { g.beginPath(); g.moveTo(480, y); g.lineTo(1440, y); g.stroke(); }
    // scan line
    const sy = 150 + ((s.t * 120) % 450); g.fillStyle = `rgba(95,242,255,${0.12 * on})`; g.fillRect(480, sy, 960, 14);
    // the blinking red dot (and its ring)
    const blink = 0.5 + 0.5 * Math.sin(s.t * 6), mx = 1030, my = 300;
    if (on > 0.2) { g.fillStyle = `rgba(255,70,80,${0.6 + 0.4 * blink})`; g.beginPath(); g.arc(mx, my, 11, 0, TAU); g.fill();
      g.strokeStyle = `rgba(255,70,80,${0.8 * (1 - (s.t % 1.2) / 1.2)})`; g.lineWidth = 4; g.beginPath(); g.arc(mx, my, 12 + ((s.t % 1.2) / 1.2) * 60, 0, TAU); g.stroke();
      text(g, 'MOLE DETECTED', mx + 30, my - 30, 26, `rgba(255,120,128,${0.6 + 0.4 * blink})`, { font: SIGN, align: 'left' }); }
    g.restore();
  }
  function lamp(g, s, lit) {
    // a green banker's lamp on the desk, left
    const x = 620, y = DESK_Y;
    g.fillStyle = '#c9a24a'; rr(g, x - 40, y - 14, 80, 14, 4); g.fill(); g.lineWidth = 4; g.strokeStyle = OUT; g.stroke();
    g.fillStyle = '#c9a24a'; g.fillRect(x - 5, y - 110, 10, 100); g.strokeRect(x - 5, y - 110, 10, 100);
    g.fillStyle = '#1f6b46'; g.beginPath(); g.moveTo(x - 90, y - 100); g.quadraticCurveTo(x, y - 160, x + 90, y - 100); g.closePath(); g.fill(); g.stroke();
    if (lit > 0) { g.save(); g.globalCompositeOperation = 'lighter'; const gr = g.createRadialGradient(x, y - 60, 10, x, y - 40, 360); gr.addColorStop(0, `rgba(255,220,140,${0.4 * lit})`); gr.addColorStop(1, 'rgba(255,220,140,0)'); g.fillStyle = gr; g.fillRect(x - 400, y - 400, 800, 600); g.restore(); }
  }
  function desk(g, s) {
    let gr = g.createLinearGradient(0, DESK_Y, 0, DESK_Y + 40); gr.addColorStop(0, '#6b4426'); gr.addColorStop(1, '#4a2e18'); g.fillStyle = gr; g.fillRect(-600, DESK_Y, 3120, 40);
    g.lineWidth = 5; g.strokeStyle = OUT; g.strokeRect(-600, DESK_Y, 3120, 40);
    gr = g.createLinearGradient(0, DESK_Y + 40, 0, 1200); gr.addColorStop(0, WOOD); gr.addColorStop(1, WOOD2); g.fillStyle = gr; g.fillRect(-600, DESK_Y + 40, 3120, 500);
    for (let x = -560; x < 2520; x += 300) { g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 3; rr(g, x, DESK_Y + 70, 260, 160, 10); g.stroke(); }
    // brass name plate
    g.fillStyle = GOLD; rr(g, 820, DESK_Y + 64, 280, 56, 8); g.fill(); g.lineWidth = 4; g.strokeStyle = '#4a3410'; g.stroke();
    text(g, 'DIRECTOR GREY', 960, DESK_Y + 93, 26, '#2a1806', { font: SIGN, max: 260 });
    // a red phone, a stack of TOP SECRET files, a globe
    g.fillStyle = '#b3141d'; rr(g, 1140, DESK_Y - 40, 90, 40, 10); g.fill(); g.lineWidth = 4; g.strokeStyle = OUT; g.stroke();
    g.beginPath(); g.ellipse(1185, DESK_Y - 48, 56, 14, 0, Math.PI, TAU); g.fill(); g.stroke();
    for (const [x, y, r] of files) { g.save(); g.translate(x + 80, y); g.rotate(r); g.fillStyle = MANILA; rr(g, -90, -12, 180, 24, 4); g.fill(); g.lineWidth = 3; g.strokeStyle = 'rgba(60,40,10,0.7)'; g.stroke(); g.restore(); }
    g.save(); g.translate(1350, DESK_Y - 80); g.rotate(-0.04); g.fillStyle = MANILA; rr(g, -90, -12, 180, 24, 4); g.fill(); text(g, 'TOP SECRET', 0, 0, 16, RED, { font: SIGN }); g.restore();
    const gx = 1560, gy = DESK_Y - 70; g.fillStyle = '#2f7bbf'; g.beginPath(); g.arc(gx, gy, 52, 0, TAU); g.fill(); g.lineWidth = 4; g.strokeStyle = OUT; g.stroke();
    g.fillStyle = '#4caf6a'; g.beginPath(); g.ellipse(gx - 14 + Math.sin(s.t * 0.6) * 10, gy - 10, 22, 30, 0.4, 0, TAU); g.fill(); g.beginPath(); g.ellipse(gx + 22 + Math.sin(s.t * 0.6) * 10, gy + 14, 14, 18, 0, 0, TAU); g.fill();
    g.strokeStyle = GOLD; g.lineWidth = 5; g.beginPath(); g.arc(gx, gy, 62, Math.PI * 0.6, Math.PI * 1.9); g.stroke(); g.fillStyle = GOLD; g.fillRect(gx - 30, DESK_Y - 8, 60, 8);
  }
  // The logo: "Just" in small caps over "UNDERCOVER", with a redaction bar sliding off it.
  function logo(g, s, lit) {
    lit = Math.max(0, Math.min(1, lit));
    rr(g, -360, -120, 720, 240, 20); g.fillStyle = 'rgba(5,8,15,0.94)'; g.fill(); g.lineWidth = 6; g.strokeStyle = '#2b3a5c'; g.stroke();
    g.globalAlpha = 0.3 + 0.7 * lit;
    text(g, 'JUST', 0, -58, 44, CYAN, { font: SIGN });
    g.save(); if (lit > 0) { g.shadowColor = GOLD; g.shadowBlur = 24 * lit; } text(g, 'UNDERCOVER', 0, 22, 84, GOLD, { font: SIGN, max: 660 }); g.restore();
    g.globalAlpha = 1;
    const bar = 1 - lit; if (bar > 0) { g.fillStyle = '#000'; g.fillRect(-330, -10, 660 * bar, 66); }
    text(g, 'CLASSIFIED · EYES ONLY', 0, 88, 20, RED, { font: TYPE });
  }
  function motes(g, s, k = 1) { g.fillStyle = 'rgba(200,220,255,0.35)'; for (const [x, y, r, v, p] of dust) { const yy = (y + s.t * v) % 1080, xx = x + Math.sin(s.t + p) * 16; g.globalAlpha = 0.4 * k; g.beginPath(); g.arc(xx, yy, r, 0, TAU); g.fill(); } g.globalAlpha = 1; }
  function stage(g, s, o = {}) {
    const lit = o.lights == null ? 1 : o.lights;
    wall(g, s, lit); blinds(g, lit); mapScreen(g, s, o);
    g.save(); g.translate(960, 70); g.scale(0.42, 0.42); logo(g, s, o.logo == null ? 1 : o.logo); g.restore();
    if (o.host !== false) s.host(GREY[0], GREY[1], GREY[2]);
    desk(g, s); lamp(g, s, lit);
    if (o.extra) o.extra(g, s);
    motes(g, s, lit);
    if (lit < 1) { g.fillStyle = `rgba(2,4,10,${(1 - lit) * 0.75})`; g.fillRect(-600, -300, 3120, 1700); }
    const v = g.createRadialGradient(960, 540, 520, 960, 540, 1300); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.55)'); g.fillStyle = v; g.fillRect(-600, -300, 3120, 1700);
  }

  // ---- the roll call: every agent's photo pinned to the case board, strung together in red ----
  function roll(g, s, F, u, per, o) {
    s.cam(960, 540, 1);
    let gr = g.createLinearGradient(0, 0, 0, 1080); gr.addColorStop(0, '#9a7448'); gr.addColorStop(1, '#7a5834'); g.fillStyle = gr; g.fillRect(-600, -300, 3120, 1700);
    g.fillStyle = 'rgba(0,0,0,0.12)'; for (let i = 0; i < 400; i++) { const x = (i * 97) % 1920, y = (i * 61) % 1080; g.fillRect(x, y, 3, 3); }
    g.lineWidth = 30; g.strokeStyle = '#4a3220'; g.strokeRect(-10, -10, 1940, 1100);
    text(g, 'THE AGENTS ON THIS CASE', 960, 100, 58, PAPER, { font: SIGN, stroke: '#2a1a0c', lw: 12 });
    const n = F.length, cols = n <= 5 ? n : Math.ceil(n / 2), rows = Math.ceil(n / cols), cw = Math.min(330, 1720 / Math.max(1, cols));
    const pos = F.map((c, i) => { const col = i % cols, row = Math.floor(i / cols), rowN = row === rows - 1 ? n - row * cols : cols; return [960 + (col - (rowN - 1) / 2) * cw, (rows > 1 ? 330 : 500) + row * 400, ((i * 37) % 9 - 4) * 0.02]; });
    // red string between the photos pinned so far
    g.strokeStyle = '#c8141f'; g.lineWidth = 4;
    for (let i = 1; i < n; i++) { if (u - i * per < 0) break; const [x0, y0] = pos[i - 1], [x1, y1] = pos[i], k = Math.min(1, (u - i * per) / 300); g.beginPath(); g.moveTo(x0, y0 - 120); g.quadraticCurveTo((x0 + x1) / 2, (y0 + y1) / 2 - 60, lerp(x0, x1, k), lerp(y0 - 120, y1 - 120, k)); g.stroke(); }
    F.forEach((c, i) => {
      const k = (u - i * per) / 360; if (k <= 0) return;
      const [x, y, rot] = pos[i], e = easeOut(Math.min(1, k)), w = Math.min(240, cw * 0.78), h = w * 1.22;
      g.save(); g.translate(x, lerp(y + 260, y, e)); g.rotate(rot); g.scale(lerp(1.4, 1, e), lerp(1.4, 1, e)); g.globalAlpha = Math.min(1, k * 2);
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(-w / 2 + 10, -h / 2 + 14, w, h);
      g.fillStyle = PAPER; g.fillRect(-w / 2, -h / 2, w, h);
      g.fillStyle = c.color || '#5ff2ff'; g.fillRect(-w / 2, -h / 2, w, 12);
      g.fillStyle = '#9fb2d6'; g.fillRect(-w / 2 + 14, -h / 2 + 24, w - 28, w - 28);
      s.face(c, 0, -h / 2 + 24 + (w - 28) / 2, (w - 28) * 0.62);
      text(g, c.name, 0, h / 2 - 34, 30, '#1b2236', { font: TYPE, max: w - 20 });
      g.fillStyle = '#b3141d'; g.beginPath(); g.arc(0, -h / 2 - 2, 12, 0, TAU); g.fill(); g.lineWidth = 3; g.strokeStyle = OUT; g.stroke();
      g.restore();
    });
    if (o.more && u > n * per - 1200) text(g, '…and ' + o.more + ' more agents on the case', 960, 1010, 42, PAPER, { font: BOLD, stroke: '#2a1a0c', lw: 8 });
  }

  // Director Grey: the shared character (silver hair, black suit, red tie, grey moustache) plus his eye patch.
  const look = { skin: '#e2ad86', skinShade: '#c08a64', suit: '#23262e', suit2: '#121419', sleeve: '#1d2027', lapel: '#30343e', shirt: '#f2f2f2', cuff: '#121419', tie: 'long', tieColor: '#b3141d', hair: 'short', hairColor: '#c3c7cf', hairShade: '#959aa5', brow: '#a3a8b2', mustache: '#b0b4bd', glasses: null, prop: null, grin: false };
  let base = null;
  function greyDraw(g, a) {
    if (!base) base = ST.makeHost(look);
    base(g, a);
    // the eye patch, moving with his head (the same sway, bounce and nod as the shared character)
    const sway = Math.sin(a.t * 0.9 + a.seed) * 4, bounce = a.talk ? -Math.abs(Math.sin(a.t * 6.2)) * 4 : Math.sin(a.t * 1.6) * 1.5;
    g.save(); g.translate(sway, bounce); g.translate(0, -215); g.rotate(Math.sin(a.t * 1.7 + a.seed) * 0.035 + (a.talk ? Math.sin(a.t * 5.1) * 0.045 : 0)); g.translate(0, 215);
    g.strokeStyle = '#0b0d12'; g.lineWidth = 5; g.lineCap = 'round';
    g.beginPath(); g.moveTo(-56, -306); g.lineTo(-30, -304); g.moveTo(-10, -312); g.quadraticCurveTo(20, -336, 52, -324); g.stroke();
    g.fillStyle = '#0b0d12'; g.beginPath(); g.ellipse(-21, -300, 19, 16, -0.1, 0, TAU); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.18)'; g.beginPath(); g.ellipse(-27, -306, 6, 3.5, -0.4, 0, TAU); g.fill();
    g.restore();
  }

  BOX.intros = BOX.intros || {};
  BOX.intros.undercover = {
    title: 'JustUndercover',
    // How to play (box/howto.js): one card per step (module howSteps = 6). Director Grey explains it.
    tutorial: [
      { icon: '🪪', title: 'Your agency ID', text: 'Every case, your phone holds your ID card. Hold it to peek at your secret password, and hide it from your neighbours.', phone: 'Hold your ID card to peek.', say: 'Every case, your phone holds your agency card. Hold it to peek at your secret password, and keep it hidden from your neighbours.' },
      { icon: '🕵️', title: 'The mole', text: 'The mole has a slightly different password, or none at all. In Word Clues, nobody knows if they are the mole!', say: 'But one of you is the mole. Their password is slightly different, or missing altogether. In word clues, even the mole does not know it is them.' },
      { icon: '💬', title: 'One-word clues', text: 'In turns, give ONE word that fits your password. Too obvious and the mole learns it. Too vague and you look guilty.', phone: 'Type one word on your turn.', say: 'In turns, give one word that fits your password. Too obvious, and the mole learns it. Too vague, and you look guilty.' },
      { icon: '✏️', title: 'Sketch Line', text: 'Everyone except the faker knows the word. Add ONE line each to the drawing on the TV, two laps round the room.', phone: 'On your turn, draw one line.', say: 'In sketch line, everyone except the faker knows the word. Add one line each to the drawing on the screen.' },
      { icon: '🗳️', title: 'Vote them out', text: 'Discuss, then vote. The most votes is stamped MOLE or AGENT. A caught mole can still win by naming the password!', phone: 'Tap who you think is the mole.', say: 'Then talk it over and vote. The most votes gets stamped, mole or agent. But a caught mole can still win by naming the password.' },
      { icon: '⭐', title: 'Points', text: 'Agents score for catching moles; moles score for slipping by. Modes: Blank Agent, Double Agents, Rival Words, Speed Round, Picture Clue.', say: 'Agents score for catching moles. Moles score for slipping by. Most points at the end of the night wins.' },
    ],
    // Every line Director Grey says during the game, copied character for character from box/games/undercover.js (GREY).
    story: [
      'New case, agents. Check your phones, and keep your card to yourself.',
      'A mole has slipped into the agency. Read your card, and trust no one.',
      'Another file on my desk. Peek at your card, quietly.',
      'Our first case. Somebody in this room is not who they say they are.',
      'Final case of the night. Make it count.',
      'One word each. Prove you know the password, without giving it away.',
      'Clues, please. Not too obvious, not too vague.',
      'One line each. The faker only knows the category, so draw carefully.',
      'No words this time. Draw your clue.',
      'Somebody here has no password at all. Watch for the bluffer.',
      'Two teams, two passwords. Find your partners.',
      'Speed round! Quick clues, no hesitating.',
      'Talk it over. Who sounds like they are bluffing?',
      'Discuss. Somebody here is guessing.',
      'Time to vote. Point your finger.',
      'Make your choice, agents.',
      'Pick your teammates. Who shares your password?',
      'Caught red-handed! That was the mole.',
      'Got them! The mole is unmasked.',
      'Oh dear. That was one of ours.',
      'Wrong agent. The mole is still among us.',
      'A split vote. Nobody leaves the room.',
      'One last chance, mole. Name the password.',
      'Clever. The mole cracked the password.',
      'Wrong password. Case closed.',
      'Wrong. Back to work, agents.',
      'The mole got away. We will get them next time.',
      'Case closed. Good work, agents.',
      'The teams are revealed. Let us see who found their partners.',
      'That is all for tonight, agents. The agency thanks you.',
    ],
    theme: { accent: GOLD, accent2: RED, accent3: CYAN, ink: PAPER, panel: 'rgba(8,12,24,0.92)', fade: '#05080f', confetti: [GOLD, RED, CYAN, PAPER, '#3d8bff'] },
    host: {
      name: 'Director Grey',
      voice: { kokoro: 'bm_daniel', cb: 'dry', orpheus: 'dan', speed: 1.0, like: /male|george|daniel|ryan|david|guy/i, accent: /en-GB|en-US/i, pitch: 0.92, rate: 0.98 },
      look,
      draw: greyDraw,
    },
    lines: {
      welcome: 'Good evening, agents. I am Director Grey. We have a problem: a mole has slipped into the agency.',
      roll: 'Let me see the agents on this case.',
      more: '…and {n} more agents on the case.',
      others: 'And the rest of you: eyes open.',
      play: 'Check your phones. The first case file is open.',
    },
    stage, logo, roll,
    podium() { /* no podium: Grey stands behind his desk */ },
    hostCam: { x: 960, y: 560, z: 1.5 },
    castOpening: [
      // In the dark, the map blinks red: a mole.
      { ms: 2600, sfx: [[200, 'eerie'], [1300, 'heartbeat']],
        draw(g, s) {
          const k = s.k;
          s.cam(lerp(1060, 1000, ease(k)), lerp(300, 330, ease(k)), lerp(2.8, 2.0, ease(k)));
          stage(g, s, { host: false, lights: 0.25, logo: 0, screen: 0.6 + 0.4 * ss(0, 0.5, k) });
        } },
      // The lamp clicks on; the sign's redaction bar slides away.
      { ms: 2800, sfx: [[350, 'click'], [1000, 'swell']],
        draw(g, s) {
          const k = s.k;
          s.cam(960, lerp(160, 380, ease(k)), lerp(2.2, 1.15, ease(k)));
          stage(g, s, { host: false, lights: 0.25 + 0.75 * ss(0.12, 0.3, k), logo: ss(0.35, 0.85, k) });
        } },
      // Director Grey leans on his desk.
      { ms: 3200, sfx: [[0, 'join']], pose: [[500, 'point', 1500]], say: 'welcome', sayAt: 350, fit: 6500,
        draw(g, s) {
          const k = s.k;
          s.cam(960, lerp(560, 600, ease(k)), lerp(1.05, 1.45, ease(k)));
          stage(g, s, {});
        } },
    ],
  };
})();
