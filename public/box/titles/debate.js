'use strict';
// Debate Club title screen: the hall of an old debating society. Navy panelled walls, arched
// windows, a brass chandelier and sweeping spotlights. A blue podium and a red podium face off
// while speech bubbles fly ("Cereal IS soup!" "Objection!"), the crowd throws claps and the odd
// tomato, and a giant gavel slams down on its block to call the house to order.
(function () {
  const TAU = Math.PI * 2;
  const clamp01 = (x) => Math.min(1, Math.max(0, x));
  const easeOut = (x) => 1 - Math.pow(1 - clamp01(x), 3);
  const BLUE = ['YES!', 'Cereal IS soup!', 'Exhibit A!', 'Nine out of ten agree!', 'Think of the pets!', 'Facts!'];
  const RED = ['NO!', 'Objection!', 'Prove it!', 'Says who?', 'Preposterous!', 'Rebuttal!'];
  const SLAM = 3.6; // seconds between gavel slams
  function rr(g, x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r); }
  function panelWall(W, H) {
    const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(W)); c.height = Math.max(1, Math.round(H));
    const x = c.getContext('2d');
    let gr = x.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#0a1028'); gr.addColorStop(0.55, '#1a2552'); gr.addColorStop(1, '#0d1430');
    x.fillStyle = gr; x.fillRect(0, 0, W, H);
    // pilasters
    const n = Math.max(6, Math.round(W / 220));
    for (let i = 0; i <= n; i++) { const px = (i / n) * W; x.fillStyle = 'rgba(255,255,255,0.035)'; x.fillRect(px - 14, 0, 28, H); x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(px + 14, 0, 4, H); }
    // arched windows
    for (const wx of [W * 0.07, W * 0.93]) {
      const ww = Math.min(170, W * 0.1), wh = H * 0.42, top = H * 0.08;
      x.save(); x.beginPath(); x.moveTo(wx - ww / 2, top + wh); x.lineTo(wx - ww / 2, top + ww / 2); x.arc(wx, top + ww / 2, ww / 2, Math.PI, 0); x.lineTo(wx + ww / 2, top + wh); x.closePath();
      const wg = x.createLinearGradient(0, top, 0, top + wh); wg.addColorStop(0, '#2b4a8a'); wg.addColorStop(1, '#0f1d40'); x.fillStyle = wg; x.fill();
      x.lineWidth = 10; x.strokeStyle = '#5b3520'; x.stroke(); x.clip();
      x.strokeStyle = '#5b3520'; x.lineWidth = 5; x.beginPath(); x.moveTo(wx, top); x.lineTo(wx, top + wh); for (let k = 1; k < 4; k++) { x.moveTo(wx - ww / 2, top + (wh * k) / 4); x.lineTo(wx + ww / 2, top + (wh * k) / 4); } x.stroke();
      x.fillStyle = 'rgba(255,250,220,0.85)'; x.beginPath(); x.arc(wx + ww * 0.18, top + ww * 0.42, ww * 0.12, 0, TAU); x.fill(); // the moon
      x.restore();
    }
    // wood wainscoting
    const wy = H * 0.6;
    gr = x.createLinearGradient(0, wy, 0, H); gr.addColorStop(0, '#6b3e22'); gr.addColorStop(1, '#3a2112');
    x.fillStyle = gr; x.fillRect(0, wy, W, H - wy);
    x.fillStyle = '#f2b84b'; x.fillRect(0, wy - 6, W, 8);
    x.strokeStyle = 'rgba(0,0,0,0.3)'; x.lineWidth = 3;
    const pw = Math.max(120, W / 12);
    for (let px = 20; px < W; px += pw) { rr(x, px, wy + 24, pw - 30, H * 0.16, 8); x.stroke(); }
    // the stage floor
    const fy = H * 0.82;
    gr = x.createLinearGradient(0, fy, 0, H); gr.addColorStop(0, '#8c5530'); gr.addColorStop(1, '#4a2814');
    x.fillStyle = gr; x.fillRect(0, fy, W, H - fy);
    x.strokeStyle = 'rgba(0,0,0,0.22)'; x.lineWidth = 2; x.beginPath();
    for (let i = -20; i <= 20; i++) { x.moveTo(W / 2 + i * 60, fy); x.lineTo(W / 2 + i * 200, H); } x.stroke();
    x.fillStyle = '#f2b84b'; x.fillRect(0, fy - 4, W, 5);
    return c;
  }
  function chandelier(g, x, y, s, t) {
    const sw = Math.sin(t * 0.8) * 0.04;
    g.save(); g.translate(x, 0); g.rotate(sw);
    g.strokeStyle = '#c99a3a'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, y); g.stroke();
    g.translate(0, y); g.scale(s, s);
    g.fillStyle = '#e8b04a'; g.beginPath(); g.ellipse(0, 0, 70, 14, 0, 0, TAU); g.fill();
    for (let i = -3; i <= 3; i++) {
      const lx = i * 22, ly = -6 - Math.cos(i * 0.5) * 6;
      g.fillStyle = '#fff5d6'; g.fillRect(lx - 3, ly - 18, 6, 16);
      const fl = 0.7 + 0.3 * Math.sin(t * 9 + i);
      g.fillStyle = `rgba(255,210,110,${fl})`; g.beginPath(); g.ellipse(lx, ly - 24, 4, 7, 0, 0, TAU); g.fill();
      const gl = g.createRadialGradient(lx, ly - 24, 0, lx, ly - 24, 40); gl.addColorStop(0, 'rgba(255,210,110,0.25)'); gl.addColorStop(1, 'rgba(255,210,110,0)'); g.fillStyle = gl; g.fillRect(lx - 40, ly - 64, 80, 80);
    }
    g.restore();
  }
  function spot(g, x0, y0, ang, len, wid, a) {
    g.save(); g.translate(x0, y0); g.rotate(ang);
    const gr = g.createLinearGradient(0, 0, 0, len); gr.addColorStop(0, `rgba(255,240,200,${a})`); gr.addColorStop(1, 'rgba(255,240,200,0)');
    g.fillStyle = gr; g.beginPath(); g.moveTo(-8, 0); g.lineTo(8, 0); g.lineTo(wid, len); g.lineTo(-wid, len); g.closePath(); g.fill(); g.restore();
  }
  function podium(g, x, base, sc, col, dark, label, emoji, t, jump, talk, dir) {
    g.save(); g.translate(x, base); g.scale(sc, sc);
    // the debater (behind the desk)
    const bob = Math.sin(t * (talk ? 9 : 2)) * (talk ? 5 : 2) - jump * 26;
    g.save(); g.translate(0, -250 + bob);
    g.fillStyle = col; rr(g, -50, 40, 100, 90, 34); g.fill();
    g.fillStyle = '#fff'; g.beginPath(); g.moveTo(-14, 40); g.lineTo(0, 66); g.lineTo(14, 40); g.closePath(); g.fill();
    g.fillStyle = dark; g.beginPath(); g.moveTo(0, 48); g.lineTo(-9, 62); g.lineTo(0, 90); g.lineTo(9, 62); g.closePath(); g.fill();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(0, 0, 54, 0, TAU); g.fill();
    g.lineWidth = 6; g.strokeStyle = col; g.stroke();
    g.font = '72px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(emoji, 0, 4);
    // a pointing arm while talking
    if (talk) { g.strokeStyle = col; g.lineWidth = 16; g.lineCap = 'round'; const k = Math.sin(t * 7) * 0.3; g.beginPath(); g.moveTo(40 * dir, 70); g.lineTo((90 + 10 * k) * dir, 30 - 30 * k); g.stroke(); }
    g.restore();
    // the desk
    g.fillStyle = '#6b3e22'; g.beginPath(); g.moveTo(-110, -110); g.lineTo(110, -110); g.lineTo(124, 0); g.lineTo(-124, 0); g.closePath(); g.fill();
    const dg = g.createLinearGradient(0, -110, 0, 0); dg.addColorStop(0, '#9a5e34'); dg.addColorStop(1, '#4a2814'); g.fillStyle = dg; g.fill();
    g.fillStyle = '#f2b84b'; rr(g, -122, -124, 244, 18, 6); g.fill();
    g.fillStyle = col; rr(g, -80, -86, 160, 50, 10); g.fill();
    g.fillStyle = '#fff'; g.font = '34px Bungee, "Lilita One", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(label, 0, -60);
    g.fillStyle = col; g.fillRect(-124, -8, 248, 8);
    // microphone
    g.strokeStyle = '#333'; g.lineWidth = 5; g.beginPath(); g.moveTo(60 * dir, -124); g.quadraticCurveTo(70 * dir, -170, 40 * dir, -190); g.stroke();
    g.fillStyle = '#222'; g.beginPath(); g.ellipse(36 * dir, -196, 10, 14, 0.4, 0, TAU); g.fill();
    g.restore();
  }
  function bubble(g, x, y, text, k, side, px) {
    if (k <= 0) return;
    const s = easeOut(k * 3) * (k > 0.85 ? 1 - (k - 0.85) / 0.15 : 1);
    g.save(); g.translate(x, y); g.scale(s, s); g.globalAlpha = Math.min(1, s * 1.4);
    g.font = `${px}px Bungee, "Lilita One", sans-serif`; const w = g.measureText(text).width + px * 1.2, h = px * 1.9;
    g.fillStyle = '#fff'; rr(g, -w / 2, -h / 2, w, h, h / 2); g.fill();
    g.beginPath(); g.moveTo(-side * w * 0.2, h / 2 - 4); g.lineTo(-side * w * 0.38, h / 2 + px * 0.9); g.lineTo(-side * w * 0.05, h / 2 - 4); g.closePath(); g.fill();
    g.fillStyle = side < 0 ? '#2f6fe0' : '#e03042'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 0, 2);
    g.restore();
  }
  function gavel(g, x, y, s, a) {
    g.save(); g.translate(x, y); g.scale(s, s);
    // sound block
    g.fillStyle = '#4a2814'; g.beginPath(); g.ellipse(0, 18, 70, 18, 0, 0, TAU); g.fill();
    g.fillStyle = '#8c5530'; g.beginPath(); g.ellipse(0, 6, 70, 18, 0, 0, TAU); g.fill();
    g.fillStyle = '#f2b84b'; g.fillRect(-70, 4, 140, 6);
    // the gavel, hinged at the end of the handle
    g.save(); g.translate(110, -10); g.rotate(-a);
    g.fillStyle = '#6b3e22'; rr(g, -150, -7, 150, 14, 7); g.fill();
    g.save(); g.translate(-150, 0);
    g.fillStyle = '#7a4826'; rr(g, -26, -40, 52, 80, 10); g.fill();
    g.fillStyle = '#f2b84b'; g.fillRect(-26, -30, 52, 8); g.fillRect(-26, 22, 52, 8);
    g.fillStyle = 'rgba(255,255,255,0.15)'; g.fillRect(-20, -38, 10, 76);
    g.restore(); g.restore();
    g.restore();
  }
  BOX.titles.debate = {
    logo: '<span class="gv">🔨</span><span class="a">Debate</span><span class="b">Club</span>',
    tagline: 'Is cereal a soup? Argue a silly side, survive the tomatoes and win the crowd.',
    start: '🔨 Call the house to order',
    meta: '3–14 players · 10–15 min',
    font: "'Bungee', sans-serif",
    theme: { card: 'rgba(16, 22, 52, 0.9)', ink: '#fff3dc', muted: '#e6d6b8', accent: '#ffd77a', button: '#f2b84b', buttonInk: '#24160c', border: '#f2b84b' },
    css: `.bt-debate .bt-logo { position: relative; padding-top: .3em; line-height: .9; }
      .bt-debate .bt-logo .gv { position: absolute; left: 50%; top: -.18em; font-size: .5em; transform-origin: 80% 80%; animation: dbtBang 3.6s ease-in-out infinite; text-shadow: none; }
      .bt-debate .bt-logo .a { display: block; font-size: .8em; color: #fff3dc; text-shadow: 0 6px 0 #3a2112, 0 0 30px rgba(63,140,255,.5); }
      .bt-debate .bt-logo .b { display: inline-block; margin-top: .06em; padding: .02em .35em .08em; font-size: .9em; color: #24160c; background: linear-gradient(180deg, #ffe6a6, #e7a63a); border-radius: .18em; box-shadow: 0 .08em 0 #7a4d12; text-shadow: none; transform: rotate(-3deg); }
      @keyframes dbtBang { 0%, 78%, 100% { transform: translateX(-50%) rotate(0); } 84% { transform: translateX(-50%) rotate(-45deg); } 90% { transform: translateX(-50%) rotate(14deg); } 95% { transform: translateX(-50%) rotate(0); } }
      .bt-debate .bt-card { box-shadow: 0 18px 0 rgba(0,0,0,.35), 0 0 0 4px #5b3520, 0 0 70px rgba(242,184,75,.25); border-width: 6px; }
      .bt-debate .bt-go { font-family: 'Bungee', sans-serif; font-size: clamp(20px, 2vw, 28px); background: linear-gradient(180deg, #ffd98a, #f2b84b); box-shadow: 0 7px 0 #7a4d12; }`,
    init(W, H) {
      const crowd = Array.from({ length: Math.ceil(W / 46) + 2 }, (_, i) => ({ x: i * 46 - 20 + Math.random() * 14, r: 22 + Math.random() * 10, c: ['#2a1a3a', '#1f1530', '#32213f', '#241732'][i % 4], ph: Math.random() * TAU }));
      return { wall: panelWall(W, H), crowd, fly: [], next: 0.8 };
    },
    draw(g, W, H, t, S) {
      g.drawImage(S.wall, 0, 0, W, H);
      const sc = Math.min(1.1, Math.max(0.5, H / 900));
      // spotlights from the ceiling
      g.save(); g.globalCompositeOperation = 'lighter';
      spot(g, W * 0.3, -20, 0.5 + Math.sin(t * 0.5) * 0.25, H * 1.2, 160, 0.16);
      spot(g, W * 0.7, -20, -0.5 - Math.sin(t * 0.6 + 1) * 0.25, H * 1.2, 160, 0.16);
      g.restore();
      chandelier(g, W / 2, H * 0.07, sc, t);
      // the house: which side is talking, gavel slams
      const cyc = t % SLAM, round = Math.floor(t / SLAM);
      // the gavel rises, hangs, then slams down exactly as the cycle wraps (cyc = 0 is the hit)
      const ang = cyc > SLAM - 0.12 ? 0.55 * (1 - (cyc - (SLAM - 0.12)) / 0.12) : cyc > SLAM - 1.1 ? easeOut((cyc - (SLAM - 1.1)) / 0.7) * 0.55 : cyc < 0.2 ? -0.06 * Math.sin((cyc / 0.2) * Math.PI) : 0;
      const hit = t > 1 && cyc < 0.25 ? 1 : 0;
      const since = cyc < 0.6 ? cyc : 99; // seconds since the last slam
      const jump = since < 0.4 ? Math.sin((since / 0.4) * Math.PI) : 0;
      const speaker = round % 2; // 0 = blue talks, 1 = red talks (between slams)
      const base = H * 0.86;
      const lx = Math.max(W * 0.13, 150 * sc), rx = W - lx;
      const blueEmoji = ['🦊', '🐼', '🦉', '🐸'][Math.floor(round / 2) % 4], redEmoji = ['🐯', '🐙', '🦄', '🐵'][Math.floor(round / 2) % 4];
      podium(g, lx, base, sc, '#3f8cff', '#1b4fa8', round % 4 < 2 ? 'YES' : 'FOR', blueEmoji, t, jump, speaker === 0 && since > 0.5, 1);
      podium(g, rx, base, sc, '#ff4d5e', '#a3202e', round % 4 < 2 ? 'NO' : 'AGAINST', redEmoji, t, jump, speaker === 1 && since > 0.5, -1);
      // speech bubbles
      const bk = clamp01((cyc - 0.6) / 2.6);
      if (bk > 0 && bk < 1) {
        if (speaker === 0) bubble(g, lx + 120 * sc, base - 400 * sc, BLUE[round % BLUE.length], bk, -1, 30 * sc);
        else bubble(g, rx - 120 * sc, base - 400 * sc, RED[round % RED.length], bk, 1, 30 * sc);
      }
      // flying claps and tomatoes from the crowd
      if (t > S.next) {
        S.next = t + 0.25 + Math.random() * 0.5;
        const tom = Math.random() < 0.18, tx = speaker === 0 ? lx : rx;
        S.fly.push({ x: Math.random() * W, y: H + 10, tx: tx + (Math.random() - 0.5) * 120 * sc, ty: base - 300 * sc, born: t, life: tom ? 1.1 : 2.4, tom, e: tom ? '🍅' : ['👏', '😂', '🤔', '👏'][Math.floor(Math.random() * 4)] });
      }
      g.textAlign = 'center'; g.textBaseline = 'middle';
      S.fly = S.fly.filter((f) => t - f.born < f.life + 0.5);
      for (const f of S.fly) {
        const k = (t - f.born) / f.life;
        if (f.tom) {
          if (k < 1) { const x = f.x + (f.tx - f.x) * k, y = f.y + (f.ty - f.y) * k - Math.sin(k * Math.PI) * H * 0.35; g.font = `${40 * sc}px "Segoe UI Emoji","Apple Color Emoji",sans-serif`; g.save(); g.translate(x, y); g.rotate(k * 8); g.fillText('🍅', 0, 0); g.restore(); }
          else { const s = clamp01((t - f.born - f.life) / 0.5); g.fillStyle = `rgba(220,40,50,${0.85 * (1 - s)})`; g.beginPath(); for (let i = 0; i < 9; i++) { const a = (i / 9) * TAU, r = (18 + (i % 2) * 14) * sc * (1 + s * 0.4); g.lineTo(f.tx + Math.cos(a) * r, f.ty + Math.sin(a) * r * 0.7); } g.closePath(); g.fill(); }
        } else {
          const y = f.y - k * H * 0.55, a = k < 0.15 ? k / 0.15 : 1 - Math.max(0, (k - 0.7) / 0.3);
          g.globalAlpha = Math.max(0, a); g.font = `${34 * sc}px "Segoe UI Emoji","Apple Color Emoji",sans-serif`; g.fillText(f.e, f.x + Math.sin(k * 6 + f.born) * 20, y); g.globalAlpha = 1;
        }
      }
      // the crowd (backs of heads) along the bottom
      for (const c of S.crowd) {
        const hop = Math.max(0, Math.sin(t * 3 + c.ph)) * 6 + (since < 0.5 ? jump * 10 : 0);
        g.fillStyle = c.c; g.beginPath(); g.arc(c.x, H - c.r * 0.6 - hop, c.r, 0, TAU); g.fill();
        g.beginPath(); g.ellipse(c.x, H + c.r * 0.6 - hop, c.r * 1.5, c.r * 1.1, 0, 0, TAU); g.fill();
      }
      // the gavel on its block, in front of the crowd, and its shockwave
      const gx = W / 2 - 70 * sc, gy = H - 118 * sc;
      if (since < 0.6 && t > 1) { const k = since / 0.6; g.save(); g.strokeStyle = `rgba(255,215,122,${0.8 * (1 - k)})`; g.lineWidth = 8 * (1 - k) + 2; g.beginPath(); g.ellipse(gx, gy + 10 * sc, 90 * sc + k * 520 * sc, 22 * sc + k * 110 * sc, 0, 0, TAU); g.stroke(); g.restore(); }
      gavel(g, gx, gy, sc * 1.25, ang);
      if (hit && since < 0.15) { g.fillStyle = 'rgba(255,240,200,0.08)'; g.fillRect(0, 0, W, H); }
    },
  };
})();
