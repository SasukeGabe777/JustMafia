'use strict';
// Two Truths & a Lie intro: a detective's office at night. Rain runs down the window while a
// neon sign flickers outside, a lamp swings over the desk, a case file falls open and types
// "THREE STATEMENTS. ONE LIE.", and three suspects stand in the lineup until one gets stamped
// LIE. The narrator is Inspector Gray, a trench-coated silhouette with a magnifying glass.
// Cast mode: opening, roll call of tonight's suspects, "Let the interrogation begin!".
// Engine + API: public/box/show.js.
(function () {
  const ST = BOX.studio, { lerp, ss, ease, easeOut, rng, TAU } = ST.util, { rr, text } = ST.draw;
  const BO = '"Black Ops One", "Bungee", sans-serif', TW = '"Special Elite", "Courier New", monospace';
  const CREAM = '#f3ead2', BRASS = '#c9a24a', RED = '#ff4b3e', INK = '#1a1408';
  const R = rng(1977);
  const DROPS = Array.from({ length: 70 }, () => [R() * 520, R() * 700, 300 + R() * 300, 20 + R() * 30]);
  try { if (document.fonts) { document.fonts.load('40px "Black Ops One"'); document.fonts.load('40px "Special Elite"'); } } catch { /* fine */ }
  let bricks = null;
  function brickWall() { // drawn once, reused every frame
    if (bricks) return bricks;
    bricks = document.createElement('canvas'); bricks.width = 1920; bricks.height = 1080;
    const b = bricks.getContext('2d'), r = rng(9); b.fillStyle = '#060910'; b.fillRect(0, 0, 1920, 1080);
    for (let row = 0, y = 0; y < 1080; row++, y += 44) for (let x = (row % 2) * -54; x < 1920; x += 108) { b.fillStyle = `hsl(222 28% ${10 + r() * 5}%)`; b.fillRect(x + 3, y + 3, 102, 38); }
    return bricks;
  }
  function stage(g, s, o = {}) {
    const t = s.t;
    g.drawImage(brickWall(), 0, 0); g.fillStyle = '#060910'; g.fillRect(-600, -300, 600, 1700); g.fillRect(1920, -300, 600, 1700); g.fillRect(-600, -300, 3120, 300); g.fillRect(-600, 1080, 3120, 400);
    // the window: rain and a neon sign outside
    const wx = 110, wy = 150, ww = 520, wh = 560;
    g.save(); rr(g, wx, wy, ww, wh, 6); g.clip();
    let gr = g.createLinearGradient(0, wy, 0, wy + wh); gr.addColorStop(0, '#0b1830'); gr.addColorStop(1, '#16284a'); g.fillStyle = gr; g.fillRect(wx, wy, ww, wh);
    const flick = Math.sin(t * 13) > -0.7 && (t % 5) > 0.3 ? 1 : 0.25;
    g.globalAlpha = 0.5 + 0.5 * flick; text(g, 'HOTEL', wx + 260, wy + 140, 64, '#ff6a8a', { font: BO, stroke: 'rgba(255,90,140,0.35)', lw: 18 }); g.globalAlpha = 1;
    for (let i = 0; i < 6; i++) { g.fillStyle = i % 2 ? '#0e1c38' : '#12244a'; g.fillRect(wx + i * 90, wy + 300 + (i % 3) * 30, 70, 400); g.fillStyle = 'rgba(255,220,140,0.5)'; for (let k = 0; k < 4; k++) if ((i + k) % 3) g.fillRect(wx + i * 90 + 14 + (k % 2) * 28, wy + 330 + (i % 3) * 30 + Math.floor(k / 2) * 46, 16, 22); }
    g.strokeStyle = 'rgba(170,200,255,0.45)'; g.lineWidth = 2;
    for (const [x, y0, v, l] of DROPS) { const y = wy + ((y0 + t * v) % (wh + 60)) - 30; g.beginPath(); g.moveTo(wx + x, y); g.lineTo(wx + x - 4, y + l); g.stroke(); }
    if (o.flash) { g.fillStyle = `rgba(220,235,255,${o.flash})`; g.fillRect(wx, wy, ww, wh); }
    g.restore();
    g.lineWidth = 18; g.strokeStyle = '#2a1c10'; g.strokeRect(wx, wy, ww, wh); g.lineWidth = 10; g.beginPath(); g.moveTo(wx + ww / 2, wy); g.lineTo(wx + ww / 2, wy + wh); g.moveTo(wx, wy + wh / 2); g.lineTo(wx + ww, wy + wh / 2); g.stroke();
    // the lineup wall on the right with height lines
    const lx = 1180, ly = 120, lw = 700, lh = 640;
    g.fillStyle = '#2a3550'; g.fillRect(lx, ly, lw, lh);
    g.strokeStyle = 'rgba(200,214,240,0.4)'; g.lineWidth = 3; g.fillStyle = 'rgba(200,214,240,0.7)'; g.font = `26px ${TW}`; g.textAlign = 'right'; g.textBaseline = 'middle';
    for (let k = 1; k < 9; k++) { const y = ly + lh - k * 70; g.beginPath(); g.moveTo(lx, y); g.lineTo(lx + lw - 70, y); g.stroke(); g.fillText((3 + k * 0.5).toFixed(1) + "'", lx + lw - 10, y); }
    g.fillStyle = BRASS; g.fillRect(lx, ly + lh, lw, 12);
    if (!o.bare) suspects(g, s, lx, ly + lh, o.stamp || 0);
    // the floor and the desk
    gr = g.createLinearGradient(0, 760, 0, 1080); gr.addColorStop(0, '#1a1208'); gr.addColorStop(1, '#0a0704'); g.fillStyle = gr; g.fillRect(-600, 772, 3120, 700);
    if (o.host !== false) s.hostAt(960, 820, 0.95);
    else if (!o.bare) desk(g, 960, 820, 0.95, t);
    // the swinging lamp
    lamp(g, t, o.lamp == null ? 1 : o.lamp);
    if (o.lights != null && o.lights < 1) { g.fillStyle = `rgba(2,3,8,${(1 - o.lights) * 0.9})`; g.fillRect(-600, -300, 3120, 1700); }
    if (o.logo !== 0) { g.save(); g.translate(960, 250); logo(g, s, o.logo == null ? 1 : o.logo); g.restore(); }
  }
  function lamp(g, t, lit) {
    const a = Math.sin(t * 0.9) * 0.06;
    g.save(); g.translate(960, -20); g.rotate(a);
    if (lit > 0) { const gr = g.createLinearGradient(0, 120, 0, 1000); gr.addColorStop(0, `rgba(255,226,150,${0.32 * lit})`); gr.addColorStop(1, 'rgba(255,226,150,0)'); g.fillStyle = gr; g.beginPath(); g.moveTo(-70, 120); g.lineTo(70, 120); g.lineTo(620, 1100); g.lineTo(-620, 1100); g.closePath(); g.fill(); }
    g.strokeStyle = '#222'; g.lineWidth = 5; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, 70); g.stroke();
    g.fillStyle = '#1f4a36'; g.beginPath(); g.moveTo(-30, 70); g.lineTo(30, 70); g.lineTo(84, 124); g.lineTo(-84, 124); g.closePath(); g.fill();
    g.fillStyle = BRASS; g.fillRect(-86, 120, 172, 8); g.fillStyle = lit > 0 ? '#fff3c4' : '#555'; g.beginPath(); g.ellipse(0, 130, 30, 12, 0, 0, Math.PI); g.fill();
    g.restore();
  }
  function suspects(g, s, x0, floorY, stamp) {
    for (let i = 0; i < 3; i++) {
      const x = x0 + 130 + i * 210, h = [1, 0.9, 1.06][i], head = floorY - 360 * h, lit = stamp > 0 && i === 1;
      g.fillStyle = lit ? '#3a4766' : '#121a2e';
      g.beginPath(); g.moveTo(x - 90, floorY); g.lineTo(x - 84, head + 120); g.quadraticCurveTo(x - 76, head + 66, x, head + 64); g.quadraticCurveTo(x + 76, head + 66, x + 84, head + 120); g.lineTo(x + 90, floorY); g.closePath(); g.fill();
      g.beginPath(); g.arc(x, head, 50, 0, TAU); g.fill();
      const look = Math.sin(s.t * 3 + i * 1.7) > 0.3 ? 7 : Math.sin(s.t * 3 + i * 1.7) < -0.3 ? -7 : 0;
      g.fillStyle = lit ? '#fff' : 'rgba(255,255,255,0.25)'; g.beginPath(); g.arc(x - 16 + look, head - 4, 7, 0, TAU); g.arc(x + 16 + look, head - 4, 7, 0, TAU); g.fill();
      g.fillStyle = CREAM; g.fillRect(x - 40, head + 150, 80, 50); text(g, String(i + 1), x, head + 176, 34, INK, { font: BO });
      if (lit) { const k = easeOut(Math.min(1, stamp)), sc = 1 + (1 - k) * 1.5; g.save(); g.translate(x, head - 120); g.rotate(-0.15); g.scale(sc, sc); g.globalAlpha = k; g.fillStyle = 'rgba(8,12,22,0.8)'; g.fillRect(-110, -44, 220, 88); g.strokeStyle = RED; g.lineWidth = 8; g.strokeRect(-110, -44, 220, 88); text(g, 'LIE!', 0, 4, 64, RED, { font: BO }); g.restore(); g.globalAlpha = 1; }
    }
  }
  function desk(g, x, y, sc, t) {
    g.save(); g.translate(x, y); g.scale(sc, sc);
    g.fillStyle = '#4a3020'; g.fillRect(-420, 0, 840, 260); g.fillStyle = '#6a4630'; g.fillRect(-440, -16, 880, 26);
    g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 3; for (let k = 40; k < 260; k += 46) { g.beginPath(); g.moveTo(-420, k); g.lineTo(420, k); g.stroke(); }
    // case file, mug, magnifier on top
    g.save(); g.translate(-230, -26); g.rotate(-0.06); g.fillStyle = '#d9b26a'; g.fillRect(-110, -14, 220, 22); g.fillStyle = '#c99d55'; g.fillRect(-90, -24, 70, 12); g.restore();
    g.fillStyle = '#e9e2cf'; rr(g, 250, -70, 60, 60, 8); g.fill(); g.strokeStyle = '#e9e2cf'; g.lineWidth = 8; g.beginPath(); g.arc(316, -40, 16, -1.2, 1.2); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.3)'; g.lineWidth = 3; for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(270 + k * 10, -80); g.quadraticCurveTo(262 + k * 10 + Math.sin(t * 2 + k) * 8, -110, 274 + k * 10, -140); g.stroke(); }
    g.restore();
  }
  function logo(g, s, lit) {
    const k = Math.min(1, lit);
    g.save(); g.globalAlpha = Math.min(1, k * 1.4);
    text(g, 'TWO TRUTHS', 0, -40, 120, CREAM, { font: BO, stroke: '#000', lw: 16 });
    text(g, '&', -250, 70, 80, BRASS, { font: BO, stroke: '#000', lw: 10 });
    const st = ss(0.4, 1, k), sc = 1 + (1 - st) * 1.6;
    g.save(); g.translate(60, 74); g.rotate(-0.12); g.scale(sc, sc); g.globalAlpha = st;
    g.fillStyle = 'rgba(8,12,22,0.75)'; rr(g, -190, -62, 380, 124, 14); g.fill(); g.strokeStyle = RED; g.lineWidth = 12; rr(g, -190, -62, 380, 124, 14); g.stroke();
    text(g, 'A LIE', 0, 6, 96, RED, { font: BO }); g.restore();
    g.restore(); g.globalAlpha = 1;
  }
  // The case file: falls open, then types the setup.
  function caseFile(g, s, T) {
    const open = ease(ss(150, 700, T));
    g.save(); g.translate(960, 560); g.rotate(-0.03);
    g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(-640, -330, 1300, 700);
    g.fillStyle = '#c99d55'; rr(g, -650, -350, 1300, 700, 16); g.fill();
    g.fillStyle = '#f3ead2'; g.fillRect(-600, -310, 1200 * (0.5 + 0.5 * open), 620);
    g.strokeStyle = 'rgba(60,90,160,0.18)'; g.lineWidth = 2; for (let y = -250; y < 300; y += 46) { g.beginPath(); g.moveTo(-600, y); g.lineTo(-600 + 1200 * (0.5 + 0.5 * open), y); g.stroke(); }
    if (open < 1) { g.fillStyle = '#e2bf78'; g.save(); g.scale(1 - open, 1); rr(g, 0, -350, 650, 700, 16); g.fill(); g.restore(); }
    text(g, 'CASE FILE  No. 2T1L', -560 + 300, -250, 34, RED, { font: BO, align: 'center' });
    const lines = ['THREE STATEMENTS.', 'ONE LIE.', 'FIND IT.'];
    let c = Math.max(0, Math.floor((T - 600) / 55));
    lines.forEach((l, i) => { const n = Math.min(l.length, c); c -= l.length + 4; if (n > 0) text(g, l.slice(0, n), -540, -120 + i * 120, 92, INK, { font: TW, align: 'left' }); });
    const st = ss(1900, 2100, T); if (st > 0) { g.save(); g.translate(400, 210); g.rotate(-0.18); g.scale(1 + (1 - st) * 1.4, 1 + (1 - st) * 1.4); g.globalAlpha = st; g.strokeStyle = RED; g.lineWidth = 10; rr(g, -190, -60, 380, 120, 12); g.stroke(); text(g, 'CLASSIFIED', 0, 4, 52, RED, { font: BO }); g.restore(); g.globalAlpha = 1; }
    g.restore();
  }


  // Roll call layout: one or two rows of slots across the 1920x1080 world.
  function slots(n, w) { const cols = n <= 6 ? n : Math.ceil(n / 2), rows = Math.ceil(n / Math.max(1, cols)), tw = Math.min(w, 1640 / Math.max(1, cols)); return (i) => { const r = Math.floor(i / cols), rowN = r === rows - 1 ? n - r * cols : cols; return { x: 960 + ((i % cols) - (rowN - 1) / 2) * tw, row: r, rows, tw }; }; }

  function roll(g, s, F, u, per, o) {
    s.cam(960, 540, 1); g.drawImage(brickWall(), 0, 0);
    text(g, 'TONIGHT’S SUSPECTS', 960, 110, 80, CREAM, { font: BO, stroke: '#000', lw: 12 });
    const at = slots(F.length, 240), rows = at(0).rows, top = 190, h = rows > 1 ? 420 : 760;
    for (let r = 0; r < rows; r++) {
      const y0 = top + r * (h + 20); g.fillStyle = '#2a3550'; g.fillRect(80, y0, 1760, h);
      g.strokeStyle = 'rgba(200,214,240,0.35)'; g.lineWidth = 3; for (let y = y0 + h - 60; y > y0; y -= 60) { g.beginPath(); g.moveTo(80, y); g.lineTo(1840, y); g.stroke(); }
      g.fillStyle = BRASS; g.fillRect(80, y0 + h, 1760, 10);
    }
    F.forEach((c, i) => {
      const k = easeOut((u - i * per) / 450); if (k <= 0) return;
      const p = at(i), fy = top + p.row * (h + 20) + h, sc = Math.min(1, p.tw / 240) * (rows > 1 ? 0.9 : 1.2), x = lerp(-200, p.x, k);
      g.save(); g.globalCompositeOperation = 'lighter'; const gr = g.createLinearGradient(x, fy - h, x, fy); gr.addColorStop(0, 'rgba(255,236,180,0.05)'); gr.addColorStop(1, 'rgba(255,236,180,0.28)'); g.fillStyle = gr; g.beginPath(); g.moveTo(x - 30, fy - h); g.lineTo(x + 30, fy - h); g.lineTo(x + 120 * sc, fy); g.lineTo(x - 120 * sc, fy); g.fill(); g.restore();
      g.save(); g.translate(x, fy); g.scale(sc, sc);
      g.fillStyle = '#3a4766'; g.beginPath(); g.moveTo(-86, 0); g.lineTo(-80, -190); g.quadraticCurveTo(0, -236, 80, -190); g.lineTo(86, 0); g.closePath(); g.fill();
      g.beginPath(); g.arc(0, -272, 58, 0, TAU); g.fill();
      s.face(c, 0, -272, 84);
      g.fillStyle = CREAM; g.fillRect(-90, -110, 180, 76); text(g, String(i + 1), 0, -90, 30, INK, { font: BO }); text(g, c.name, 0, -54, 30, INK, { font: TW, max: 168 });
      g.restore();
    });
    if (o.more && u > F.length * per - 1400) text(g, '…and ' + o.more + ' more in the lineup', 960, 1040, 50, BRASS, { font: TW });

  }
  BOX.intros.truths = {
    title: 'Two Truths & a Lie',
    // How to play (box/howto.js): one card per step, 5 steps (module howSteps).
    tutorial: [
      { icon: '🕵️', title: 'The statement', text: 'Everyone files three statements about themselves: two truths and one lie. Make that lie believable.', phone: 'Type three statements, mark the LIE, then tap File my statement.', say: 'Every suspect files three statements. Two are true. One is a lie. Make it a good one.' },
      { icon: '📂', title: 'The hot seat', text: 'One by one, each suspect’s three statements go up on the big screen, shuffled.' },
      { icon: '🗣️', title: 'Interrogate', text: 'Grill the suspect out loud. Ask questions, watch them sweat. Then everyone votes for the lie.', phone: 'Tap the statement you think is the lie.' },
      { icon: '✅', title: 'Scoring', text: 'Spot the lie: +1 point. In the hot seat: +1 for every person you fool, up to 5 a turn.' },
      { icon: '🏆', title: 'Case closed', text: 'Most points wins. Then the awards: the most believable lie and the truth nobody believed.', say: 'Most points wins. And at the end, we open the files on the best lies of the night.' },
    ],
    theme: { accent: '#c9a24a', accent2: '#ff4b3e', accent3: '#f3ead2', ink: '#f3ead2', fade: '#04060c', rim: '#c9a24a', floor1: '#1a1208', floor2: '#0a0704', disc1: '#2a1c10', disc2: '#0a0704',
      spots: ['255,226,150', '255,226,150', '255,226,150', '255,226,150'], confetti: ['#f3ead2', '#c9a24a', '#ff4b3e', '#ffffff', '#56d98a'] },
    host: {
      name: 'Inspector Gray',
      voice: { kokoro: 'am_onyx', speed: 0.93, like: /guy|george|ryan|brian|daniel|male/i, accent: /en-(GB|US)/i, pitch: 0.75, rate: 0.98 },
      // A trench-coated silhouette in a fedora, holding a magnifying glass.
      draw(g, a) {
        const blink = 1 - a.blink * 0.9, point = a.pose === 'point' || a.pose === 'pointL' || a.pose === 'wave' || a.pose === 'cheer';
        g.fillStyle = '#8a6a44'; g.beginPath(); g.moveTo(-130, 10); g.lineTo(-112, -170); g.quadraticCurveTo(0, -220, 112, -170); g.lineTo(130, 10); g.closePath(); g.fill();
        g.fillStyle = '#6e5234'; g.beginPath(); g.moveTo(-60, -196); g.lineTo(0, -90); g.lineTo(60, -196); g.lineTo(30, -204); g.lineTo(0, -150); g.lineTo(-30, -204); g.closePath(); g.fill();
        g.fillStyle = '#2a2a2a'; g.beginPath(); g.moveTo(-26, -200); g.lineTo(0, -140); g.lineTo(26, -200); g.fill();
        g.fillStyle = '#b8936a'; g.beginPath(); g.moveTo(-70, -200); g.lineTo(-44, -228); g.lineTo(-20, -200); g.fill(); g.beginPath(); g.moveTo(70, -200); g.lineTo(44, -228); g.lineTo(20, -200); g.fill();
        g.fillStyle = '#d9a982'; g.beginPath(); g.arc(0, -270, 58, 0, TAU); g.fill();
        g.fillStyle = 'rgba(0,0,0,0.12)'; g.beginPath(); g.arc(14, -262, 54, -0.6, 1.8); g.fill();
        g.fillStyle = '#1a1408'; g.save(); g.translate(0, -276); g.scale(1, blink); g.beginPath(); g.ellipse(-20 + a.look * 4, 0, 6, 7, 0, 0, TAU); g.ellipse(20 + a.look * 4, 0, 6, 7, 0, 0, TAU); g.fill(); g.restore();
        g.strokeStyle = '#3a2a1a'; g.lineWidth = 6; g.lineCap = 'round'; g.beginPath(); g.moveTo(-34, -298); g.lineTo(-8, -292); g.moveTo(34, -298); g.lineTo(8, -292); g.stroke();
        g.fillStyle = '#5a2a1a'; g.beginPath(); g.ellipse(0, -238, 16, 3 + a.mouth * 11, 0, 0, TAU); g.fill();
        g.fillStyle = '#2b2b2b'; g.beginPath(); g.ellipse(0, -318, 104, 18, 0, 0, TAU); g.fill();
        rr(g, -58, -380, 116, 66, 22); g.fill(); g.fillStyle = '#7a1a14'; g.fillRect(-58, -334, 116, 14);
        // arms: one holds the magnifier up while talking or pointing
        g.lineCap = 'round'; g.strokeStyle = '#8a6a44'; g.lineWidth = 40;
        const hx = point ? -190 : -100, hy = point ? -250 : -40;
        g.beginPath(); g.moveTo(-104, -160); g.quadraticCurveTo(-150, -100, hx, hy); g.stroke();
        g.beginPath(); g.moveTo(104, -160); g.lineTo(120, -30); g.stroke();
        g.fillStyle = '#d9a982'; g.beginPath(); g.arc(hx, hy, 20, 0, TAU); g.fill();
        g.strokeStyle = '#3b2716'; g.lineWidth = 12; g.beginPath(); g.moveTo(hx, hy); g.lineTo(hx - 34, hy - 40); g.stroke();
        g.strokeStyle = BRASS; g.lineWidth = 10; g.beginPath(); g.arc(hx - 56, hy - 66, 36, 0, TAU); g.stroke();
        g.fillStyle = 'rgba(200,230,255,0.25)'; g.fill();
      },
    },
    lines: {
      welcome: 'Three statements. One lie. And somebody in this room is a very good liar.',
      roll: 'Tonight’s suspects.', more: '…and {n} more in the lineup.',
      play: 'Let the interrogation begin!',
      meet: 'Bring in the suspects.', joke: 'I never trust a man with two truths.', banter: ['Keep your stories straight.'],
      first: 'Suspect number one, {name}', intros: ['Next in the lineup, {name}', 'Step forward, {name}'], last: 'And finally, {name}', noFact: 'no comment.', others: 'And the rest of the usual suspects.',
    },
    stage, logo, roll,
    podium(g, s, x, y, sc) { desk(g, x, y, sc, s.t); },
    hostCam: { x: 960, y: 560, z: 1.7 },
    castOpening: [
      { ms: 2500, sfx: [[0, 'night'], [900, 'thunder']],
        draw(g, s) { s.cam(lerp(420, 520, ease(s.k)), 440, lerp(2.1, 1.7, ease(s.k))); stage(g, s, { host: false, logo: 0, lamp: 0.4, lights: 0.55 + 0.45 * ss(0, 900, s.T), flash: s.T > 900 && s.T < 1150 ? 0.7 : 0 }); } },
      { ms: 2300, sfx: [[0, 'whoosh'], [600, 'tension'], [1900, 'gavel']], say: 'welcome', sayAt: 80, fit: 4300,
        draw(g, s) { s.cam(960, 540, 1); stage(g, s, { logo: 0, lights: 0.5 }); g.fillStyle = 'rgba(2,3,8,0.45)'; g.fillRect(-600, -300, 3120, 1700); caseFile(g, s, s.T); } },
      { ms: 2400, sfx: [[1100, 'sting']], pose: [[0, 'point', 1400]],
        draw(g, s) { const k = ease(s.T / 2000); s.cam(lerp(1530, 960, k), lerp(470, 540, k), lerp(1.6, 1, k)); stage(g, s, { stamp: ss(900, 1250, s.T) * 1.0, logo: ss(1300, 2000, s.T) }); } },
    ],
  };
})();
