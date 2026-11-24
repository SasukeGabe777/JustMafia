'use strict';
// Kill the King intro: dusk over the castle. The camera drifts down from the stars to a horde of
// goblin torches on the hills, then into the throne room: torches flare, the empty throne glints,
// the KILL THE KING banner unfurls (with its TRIAL ribbon), and Sir Bellow, the pompous royal
// herald (crimson and gold tabard, a feathered cap, a magnificent moustache, a scroll), announces
// the game. In the roll call every courtier's portrait hangs on a heraldic banner.
// Sir Bellow is the in-game character too (public/box/games/king.js draws him with host.draw and
// speaks his lines). His in-game lines are listed in `story` (copied from box/games/king.js,
// HERALD) so tools/voice-gen.js pre-voices them. Engine + API: public/box/show.js ('cast' mode).
(function () {
  const ST = BOX.studio, { lerp, ss, ease, easeOut, rng, OUT, TAU } = ST.util, { rr, text } = ST.draw;
  const ROYAL = '"Cinzel Decorative", "Cinzel", serif', HAND = '"MedievalSharp", "Cinzel", serif', BOLD = '"Lilita One", sans-serif';
  try { if (document.fonts) for (const f of ['40px "Cinzel Decorative"', '40px "MedievalSharp"', '40px "Lilita One"']) document.fonts.load(f); } catch { /* fine */ }
  const R = rng(1215);
  const GOLD = '#e0b84a', CRIMSON = '#8e1b2e', PLUM = '#2a1b3d', PARCH = '#f4e6c4', STONE = '#8a7f92';
  const FLOOR = 860, HERALD = [1360, 860, 0.95];
  const stars = Array.from({ length: 90 }, () => [R() * 1920, R() * 600, 0.6 + R() * 1.8, R() * 6]);
  const torches = Array.from({ length: 46 }, () => [R(), R(), R() * 6]);

  function fire(g, x, y, z, t) {
    g.save(); g.translate(x, y); g.scale(z, z); g.globalCompositeOperation = 'lighter';
    const gr = g.createRadialGradient(0, -10, 4, 0, -10, 80); gr.addColorStop(0, 'rgba(255,220,120,0.85)'); gr.addColorStop(1, 'rgba(255,90,30,0)'); g.fillStyle = gr; g.beginPath(); g.arc(0, -10, 80, 0, TAU); g.fill();
    g.fillStyle = '#ffb02e'; g.beginPath(); g.moveTo(-14, 0); g.quadraticCurveTo(-10 + Math.sin(t * 9) * 4, -30, 0, -48 - Math.sin(t * 7) * 6); g.quadraticCurveTo(10, -26, 14, 0); g.fill();
    g.restore();
  }
  // Outside: the night sky, the hills full of goblin torches, the castle.
  function outside(g, s, o = {}) {
    let gr = g.createLinearGradient(0, -300, 0, 1080); gr.addColorStop(0, '#120a26'); gr.addColorStop(0.6, '#5a2550'); gr.addColorStop(1, '#d9774a'); g.fillStyle = gr; g.fillRect(-600, -300, 3120, 1700);
    for (const [x, y, r, p] of stars) { g.globalAlpha = 0.4 + 0.4 * Math.sin(s.t * 1.4 + p); g.fillStyle = '#fff6d8'; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }
    g.globalAlpha = 1;
    g.fillStyle = '#f6e7b8'; g.beginPath(); g.arc(1500, 200, 70, 0, TAU); g.fill();
    g.fillStyle = '#3a1f3e'; g.beginPath(); g.moveTo(-600, 760); for (let x = -600; x <= 2520; x += 40) g.lineTo(x, 720 - Math.sin(x / 300) * 60 - Math.sin(x / 90) * 12); g.lineTo(2520, 1400); g.lineTo(-600, 1400); g.fill();
    // goblin torches swarming on the hills (right)
    for (const [a, b, p] of torches) { const x = 1050 + a * 1100 + Math.sin(s.t * 0.7 + p) * 10, y = 700 + b * 140; g.fillStyle = '#ffb02e'; g.globalAlpha = 0.6 + 0.4 * Math.sin(s.t * 6 + p); g.beginPath(); g.arc(x, y, 5, 0, TAU); g.fill(); }
    g.globalAlpha = 1;
    // the castle silhouette (left)
    g.fillStyle = '#1d1028'; g.strokeStyle = OUT; g.lineWidth = 4;
    for (const [x, w, h] of [[120, 140, 520], [330, 180, 640], [560, 140, 500]]) { g.fillRect(x, 900 - h, w, h); for (let i = 0; i < 4; i++) g.fillRect(x + i * w / 4 + 4, 900 - h - 28, w / 4 - 10, 28); g.fillStyle = '#ffcf6a'; g.fillRect(x + w / 2 - 10, 900 - h + 80, 20, 34); g.fillStyle = '#1d1028'; }
    g.fillRect(0, 560, 760, 400);
    g.fillStyle = '#120a1c'; g.fillRect(-600, 900, 3120, 600);
  }
  // Inside: the throne room.
  function hall(g, s, o = {}) {
    const lit = o.lights == null ? 1 : o.lights;
    let gr = g.createLinearGradient(0, -300, 0, FLOOR); gr.addColorStop(0, '#2a1b3d'); gr.addColorStop(1, '#1a0f28'); g.fillStyle = gr; g.fillRect(-600, -300, 3120, FLOOR + 300);
    g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 3;
    for (let y = -300, r = 0; y < FLOOR; y += 64, r++) for (let x = -600 + (r % 2) * 64; x < 2520; x += 128) g.strokeRect(x, y, 128, 64);
    gr = g.createLinearGradient(0, FLOOR, 0, 1400); gr.addColorStop(0, '#3b2a22'); gr.addColorStop(1, '#140c09'); g.fillStyle = gr; g.fillRect(-600, FLOOR, 3120, 700);
    g.fillStyle = CRIMSON; g.beginPath(); g.moveTo(880, FLOOR); g.lineTo(1040, FLOOR); g.lineTo(1260, 1400); g.lineTo(660, 1400); g.closePath(); g.fill();
    // banners
    for (const x of [220, 1580]) { g.fillStyle = '#6a1a50'; g.beginPath(); g.moveTo(x, 40); g.lineTo(x + 150, 40); g.lineTo(x + 150, 520); g.lineTo(x + 75, 470); g.lineTo(x, 520); g.closePath(); g.fill(); g.lineWidth = 5; g.strokeStyle = GOLD; g.stroke(); s.emoji('👑', x + 75, 230, 80); }
    // the throne
    g.fillStyle = '#d4a63a'; g.strokeStyle = OUT; g.lineWidth = 7;
    g.beginPath(); g.moveTo(820, FLOOR); g.lineTo(820, FLOOR - 460); g.quadraticCurveTo(960, FLOOR - 580, 1100, FLOOR - 460); g.lineTo(1100, FLOOR); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = CRIMSON; g.beginPath(); g.moveTo(860, FLOOR - 70); g.lineTo(860, FLOOR - 420); g.quadraticCurveTo(960, FLOOR - 500, 1060, FLOOR - 420); g.lineTo(1060, FLOOR - 70); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#d4a63a'; g.fillRect(800, FLOOR - 170, 320, 46); g.strokeRect(800, FLOOR - 170, 320, 46);
    s.emoji('👑', 960, FLOOR - 560 + Math.sin(s.t * 2) * 6, 70);
    // torches
    for (const x of [560, 1360]) { g.fillStyle = '#4a2c18'; g.fillRect(x - 8, 330, 16, 80); if (lit > 0.05) fire(g, x, 330, lit, s.t + x); }
    // the logo banner over the throne
    if (o.logo !== 0) { g.save(); g.translate(960, 150); g.scale(0.72, 0.72 * Math.max(0.05, o.logo == null ? 1 : o.logo)); logo(g, s, 1); g.restore(); }
    if (o.host !== false) s.host(HERALD[0], HERALD[1], HERALD[2]);
    if (lit < 1) { g.fillStyle = `rgba(4,2,10,${(1 - lit) * 0.8})`; g.fillRect(-600, -300, 3120, 1700); }
    const v = g.createRadialGradient(960, 540, 500, 960, 540, 1300); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.55)'); g.fillStyle = v; g.fillRect(-600, -300, 3120, 1700);
  }
  // The logo: a crimson banner, a dagger through a crown, "KILL THE KING", and the TRIAL ribbon.
  function logo(g, s, lit) {
    g.fillStyle = CRIMSON; g.strokeStyle = OUT; g.lineWidth = 8;
    g.beginPath(); g.moveTo(-430, -130); g.lineTo(430, -130); g.lineTo(400, 0); g.lineTo(430, 130); g.lineTo(-430, 130); g.lineTo(-400, 0); g.closePath(); g.fill(); g.stroke();
    g.lineWidth = 4; g.strokeStyle = GOLD; g.strokeRect(-380, -105, 760, 210);
    text(g, 'KILL THE', 0, -50, 64, PARCH, { font: ROYAL, stroke: OUT, lw: 10 });
    g.save(); g.shadowColor = GOLD; g.shadowBlur = 24 * lit; text(g, 'KING', 0, 42, 116, GOLD, { font: ROYAL, stroke: OUT, lw: 12 }); g.restore();
    // the TRIAL ribbon across the corner
    g.save(); g.translate(360, -120); g.rotate(0.35); g.fillStyle = '#ffd23f'; rr(g, -110, -28, 220, 56, 8); g.fill(); g.lineWidth = 5; g.strokeStyle = OUT; g.stroke(); text(g, 'TRIAL', 0, 2, 40, '#2a160c', { font: BOLD }); g.restore();
  }
  // Roll call: every courtier's portrait on a hanging heraldic banner.
  function roll(g, s, F, u, per, o) {
    s.cam(960, 540, 1);
    hall(g, s, { host: false, logo: 0, lights: 0.8 });
    g.fillStyle = 'rgba(10,4,20,0.5)'; g.fillRect(-600, -300, 3120, 1700);
    text(g, 'THE COURT ASSEMBLES', 960, 100, 64, GOLD, { font: ROYAL, stroke: OUT, lw: 12 });
    const n = F.length, cols = n <= 5 ? n : Math.ceil(n / 2), rows = Math.ceil(n / cols), cw = Math.min(330, 1720 / Math.max(1, cols));
    F.forEach((c, i) => {
      const k = (u - i * per) / 420; if (k <= 0) return;
      const col = i % cols, row = Math.floor(i / cols), rowN = row === rows - 1 ? n - row * cols : cols;
      const x = 960 + (col - (rowN - 1) / 2) * cw, y = (rows > 1 ? 200 : 300) + row * 400, e = easeOut(Math.min(1, k)), w = Math.min(230, cw * 0.78), h = w * 1.45;
      g.save(); g.translate(x, lerp(y - 500, y, e)); g.rotate(Math.sin(s.t * 1.5 + i) * 0.03);
      g.fillStyle = c.color || CRIMSON; g.strokeStyle = OUT; g.lineWidth = 6;
      g.beginPath(); g.moveTo(-w / 2, 0); g.lineTo(w / 2, 0); g.lineTo(w / 2, h); g.lineTo(0, h - 40); g.lineTo(-w / 2, h); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = GOLD; g.fillRect(-w / 2 - 14, -8, w + 28, 14);
      g.fillStyle = PARCH; g.beginPath(); g.arc(0, w * 0.55, w * 0.38, 0, TAU); g.fill(); g.lineWidth = 4; g.stroke();
      s.face(c, 0, w * 0.55, w * 0.5);
      text(g, c.name, 0, h - 70, 30, PARCH, { font: BOLD, stroke: OUT, lw: 6, max: w - 16 });
      g.restore();
    });
    if (o.more && u > n * per - 1200) text(g, '…and ' + o.more + ' more courtiers!', 960, 1010, 44, PARCH, { font: BOLD, stroke: OUT, lw: 8 });
  }

  // Sir Bellow: the shared host character plus a feathered floppy cap and a rolled scroll.
  const look = { skin: '#f0bf98', skinShade: '#cf9572', suit: '#9e1f35', suit2: '#6e1222', sleeve: '#b52a40', lapel: '#e0b84a', shirt: '#f4e6c4', cuff: '#e0b84a', tie: 'none', hair: 'curly', hairColor: '#7a4a22', hairShade: '#5a3416', brow: '#5a3416', mustache: '#6a3c1a', glasses: null, prop: null, grin: true };
  let base = null;
  function bellowDraw(g, a) {
    if (!base) base = ST.makeHost(look);
    base(g, a);
    const sway = Math.sin(a.t * 0.9 + a.seed) * 4, bounce = a.talk ? -Math.abs(Math.sin(a.t * 6.2)) * 4 : Math.sin(a.t * 1.6) * 1.5;
    g.save(); g.translate(sway, bounce); g.translate(0, -215); g.rotate(Math.sin(a.t * 1.7 + a.seed) * 0.035 + (a.talk ? Math.sin(a.t * 5.1) * 0.045 : 0)); g.translate(0, 215);
    // the cap: a plum floppy beret with a gold band and a long white plume
    g.strokeStyle = OUT; g.lineWidth = 6; g.lineJoin = 'round';
    g.fillStyle = '#5a1a6a'; g.beginPath(); g.ellipse(6, -372, 96, 40, -0.08, 0, TAU); g.fill(); g.stroke();
    g.fillStyle = GOLD; g.beginPath(); g.ellipse(0, -352, 74, 14, 0, 0, TAU); g.fill(); g.stroke();
    g.fillStyle = '#fffaf0'; g.beginPath(); g.moveTo(40, -380); g.quadraticCurveTo(150, -470, 190, -400); g.quadraticCurveTo(150, -430, 60, -366); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = CRIMSON; g.beginPath(); g.arc(40, -366, 12, 0, TAU); g.fill(); g.stroke();
    g.restore();
  }

  BOX.intros = BOX.intros || {};
  BOX.intros.king = {
    title: 'Kill the King',
    // How to play (box/howto.js): one card per step (module howSteps = 8). Sir Bellow explains it.
    tutorial: [
      { icon: '🧪', title: 'A trial game', text: 'Kill the King is brand new and still being tested. Play it, then tell us what you think at the end!', say: 'Hear ye! This game is a trial, brand new and still being tested. Play it, and tell us what you think at the end.' },
      { icon: '🏰', title: 'Defend the kingdom', text: 'Each round starts with a MISSION on your phone. Together, reach the defence target by the end, or the goblins loot everyone’s points.', phone: 'Do the mission on your phone.', say: 'Each round starts with a mission on your phone. Together, you must reach the defence target by the end, or the goblins loot everyone’s points.' },
      { icon: '🪜', title: 'The social ladder', text: 'Everyone has a rank. Rank pays every round: Crown 100, Nobles 60, Guild 35, Commons 15. Climb it!', say: 'Everyone has a rank on the social ladder, and rank pays every round. The higher you are, the richer you get.' },
      { icon: '💌', title: 'Court', text: 'Send secret messages and make deals. The TV only shows who is whispering to whom, never what.', phone: 'Use the Messages tab.', say: 'In court, send secret messages and make deals. The screen only shows who whispers to whom, never what they say.' },
      { icon: '⚔️', title: 'Coup!', text: 'Anyone can call a COUP. With YES from 60% of the living, they take the throne. Fail, and they drop to the bottom.', say: 'Anyone can call a coup. If enough of the living say yes, they take the throne. If not, down to the bottom they go.' },
      { icon: '⚖️', title: 'Judgement', text: 'The King summons someone to KILL, DEMOTE or REVEAL their messages. Everyone votes, and deals for votes are binding.', phone: 'Vote aye or nay.', say: 'Then the King summons someone, to be killed, demoted, or have their messages read out. Everyone votes, and deals for votes are binding.' },
      { icon: '👻', title: 'Ghosts', text: 'The dead become ghosts: half-strength missions, no rank, and they can HAUNT whoever voted to kill them.', say: 'The dead become ghosts. They still work at half strength, and they can haunt whoever voted to kill them.' },
      { icon: '🎭', title: 'Secret roles', text: 'Some of you hold a secret: Assassin, Spy, Ghoul, Fortune Teller or Turncloak. Tap your role card to peek. Most points wins!', phone: 'Tap your role card to peek, secretly.', say: 'And some of you hold a secret role. Peek at your phone, quietly. Most points at the end wins the kingdom.' },
    ],
    // Every line Sir Bellow says during the game, copied character for character from box/games/king.js (HERALD).
    story: [
      'Hear ye! The goblin horde marches on the kingdom. Round one begins!',
      'A new day dawns, and the goblins return!',
      'Another round, my lords and ladies. To your posts!',
      'The final round! Hold the walls one last time!',
      'Mend the wall! The stones are cracking!',
      'Light the beacons! Call out your runes!',
      'Ring the bells, all together now!',
      'Man the gate! Grip the winch with your partner!',
      'The wave is repelled! Huzzah!',
      'The goblins scatter! Well defended!',
      'The walls are dented! We fell short this time.',
      'A breach! The goblins chip away at the walls.',
      'To court! Whisper your schemes, but trust no one.',
      'The court is in session. Make your deals.',
      'Alas! A body is found in the castle. The Assassin strikes!',
      'An attempt on a life, foiled! The Assassin left a clue behind.',
      'A coup! Someone dares to reach for the crown!',
      'The coup succeeds! Long live the new King!',
      'The coup is crushed! The traitor is cast down.',
      'What of the old King? Spare them, or end them?',
      'The old King is spared, and sent to muck out the stables.',
      'The old King is no more. Their ghost will remember this.',
      'The King calls a judgement! Who will be summoned?',
      'The King shows mercy today. No one is summoned.',
      'The accused stands before the court. Cast your votes!',
      'Aye or nay! The court decides.',
      'The sentence stands! So it is decreed.',
      'The court says nay! The accused walks free.',
      'Payday! Every rank collects its due.',
      'The treasury pays out. Rank has its rewards.',
      'The kingdom stands! The goblins flee into the hills!',
      'The walls have fallen! The goblins loot the treasury!',
      'And now, the secrets of the court are revealed!',
      'That concludes the reign. Long live whoever is left!',
    ],
    theme: { accent: GOLD, accent2: CRIMSON, accent3: '#9be36b', ink: PARCH, panel: 'rgba(22,13,36,0.92)', fade: '#0d0716', confetti: [GOLD, CRIMSON, PARCH, '#9be36b', '#8fc6ff'] },
    host: {
      name: 'Sir Bellow',
      voice: { kokoro: 'bm_george', cb: 'hype', orpheus: 'leo', speed: 1.0, like: /george|ryan|thomas|daniel|uk english male|british|male/i, accent: /en-GB/i, pitch: 0.9, rate: 1.0 },
      look,
      draw: bellowDraw,
    },
    lines: {
      welcome: 'Hear ye, hear ye! I am Sir Bellow, herald of the realm. The goblins are coming, and someone in this court wants the crown.',
      roll: 'Presenting the noble court!',
      more: '…and {n} more courtiers!',
      others: 'And the rest of you rabble, welcome!',
      play: 'Take your posts! Long live the King… for now.',
    },
    stage: hall, logo, roll,
    podium() { /* no podium: Sir Bellow stands on the throne-room floor */ },
    hostCam: { x: 1300, y: 600, z: 1.5 },
    castOpening: [
      // Night over the hills: goblin torches swarm toward the castle.
      { ms: 2800, sfx: [[100, 'wind'], [1200, 'drum']],
        draw(g, s) { const k = s.k; s.cam(lerp(1300, 900, ease(k)), lerp(380, 560, ease(k)), lerp(1.6, 1.0, ease(k))); outside(g, s); } },
      // Inside: the torches flare, the banner unfurls over the throne.
      { ms: 2800, sfx: [[300, 'creak'], [1100, 'swell']],
        draw(g, s) { const k = s.k; s.cam(960, lerp(200, 420, ease(k)), lerp(2.0, 1.1, ease(k))); hall(g, s, { host: false, lights: ss(0, 0.4, k), logo: ss(0.35, 0.85, k) }); } },
      // Sir Bellow clears his throat.
      { ms: 3200, sfx: [[0, 'join']], pose: [[400, 'wave', 1600]], say: 'welcome', sayAt: 350,
        draw(g, s) { const k = s.k; s.cam(lerp(1060, 1240, ease(k)), lerp(560, 600, ease(k)), lerp(1.05, 1.4, ease(k))); hall(g, s, {}); } },
    ],
  };
})();
