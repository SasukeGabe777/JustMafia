'use strict';
// Alien Abduction title screen: deep space, purple nebulae and a ringed planet. The starship
// Biscuit cruises past with its crew waving from the windows, while a Gloop saucer shadows it;
// every few seconds its tractor beam snags a floating astronaut and reels them up, and a little
// goo-green alien peeks out of the Air Garden. Art: BOX.alienArt in public/box/games/alien.js.
(function () {
  BOX.titles = BOX.titles || {};
  const CREW = [['🦊', '#ff8a4d'], ['🐼', '#5ae0ff'], ['🐸', '#ffd23f'], ['🦄', '#ff5aa0'], ['🐯', '#b388ff'], ['🐧', '#36d6c3']];
  BOX.titles.alien = {
    logo: '<span class="a">ALIEN</span><span class="b">ABDUCTION</span>',
    tagline: 'The starship Biscuit is heading home. Somebody aboard is not who they say they are.',
    start: '🚀 Board the ship',
    meta: '4–100 players · 8–12 min',
    font: "'Righteous', 'Lilita One', sans-serif",
    theme: { card: 'rgba(14, 7, 38, 0.88)', ink: '#f4efff', muted: '#c9bde8', accent: '#7dff6a', button: '#7dff6a', buttonInk: '#10200a', border: '#7dff6a' },
    css: `.bt-alien .bt-logo { line-height: .9; display: flex; flex-direction: column; align-items: center; }
      .bt-alien .bt-logo .a { font-size: 1.3em; color: #7dff6a; letter-spacing: .08em; text-shadow: 0 6px 0 #1d5a1a, 0 0 46px rgba(125,255,106,.6); animation: btAaWob 3s ease-in-out infinite; display: inline-block; }
      .bt-alien .bt-logo .b { font-size: .52em; color: #fff3df; letter-spacing: .34em; margin-top: .16em; text-shadow: 0 4px 0 #1d1036; }
      @keyframes btAaWob { 0%,100% { transform: translateY(0) skewX(0); } 50% { transform: translateY(-5px) skewX(-5deg); } }
      .bt-alien .bt-card { border-radius: 26px; box-shadow: 0 0 0 4px #1d1036, 0 16px 0 rgba(0,0,0,.5), 0 0 90px rgba(125,255,106,.25); position: relative; }
      .bt-alien .bt-card::before { content: '🛸'; position: absolute; top: -34px; left: 50%; transform: translateX(-50%); font-size: 48px; animation: btAaHover 2.4s ease-in-out infinite; }
      @keyframes btAaHover { 50% { transform: translateX(-50%) translateY(-8px) rotate(-6deg); } }
      .bt-alien .bt-go { font-family: 'Righteous', sans-serif; box-shadow: 0 7px 0 #2f8a2a, 0 0 30px rgba(125,255,106,.35); }`,
    init() { return {}; },
    draw(g, W, H, t) {
      const A = BOX.alienArt; if (!A) { g.fillStyle = '#05021a'; g.fillRect(0, 0, W, H); return; }
      const sc = Math.max(W / 1920, H / 1080);
      g.save(); g.translate((W - 1920 * sc) / 2, (H - 1080 * sc) / 2); g.scale(sc, sc);
      A.space(g, t, { speed: 50 });
      // the Biscuit cruises along the bottom, under the title card
      const cyc = 24, k = ((t + 9) % cyc) / cyc, x = -800 + k * 3500, y = 935;
      const crew = CREW.map(([avatar, color], i) => ({ avatar, color, room: ['engines', 'oxygen', 'shields'][i % 3], pose: i % 2 ? 'wave' : 'idle' }));
      A.ship(g, x, y, 0.5, t, { crew, hp: { oxygen: 3, engines: 3, shields: 2 } });
      // the Gloop saucer prowls the left side: every 9 s its beam reels up a floating astronaut
      const sx = 300 + Math.sin(t * 0.5) * 60, sy = 250 + Math.sin(t * 1.3) * 24;
      const bc = (t % 9) / 9, beam = bc > 0.3 && bc < 0.8;
      A.saucer(g, sx, sy, 0.6, t, { beam: beam ? 1 : 0, beamLen: 560 });
      if (bc > 0.25 && bc < 0.8) { const lift = A.util.ease((bc - 0.3) / 0.45), [av, col] = CREW[Math.floor(t / 9) % CREW.length]; A.astro(g, sx, 800 - lift * 420, 0.5, t, { avatar: av, color: col, pose: 'float', ph: 1, alpha: 1 - A.util.clamp((lift - 0.85) / 0.15) }); }
      else A.gloop(g, 1660, 760 + Math.sin(t * 1.1) * 30, 0.6, t, { ph: 2, wave: true });
      // drifting space junk
      for (let i = 0; i < 4; i++) { const jx = ((t * 30 + i * 520) % 2300) - 200, jy = 140 + i * 210; g.save(); g.translate(jx, jy); g.rotate(t * (0.3 + i * 0.1)); A.emoji(g, ['🛰️', '☄️', '🪐', '🌟'][i], 0, 0, 48); g.restore(); }
      const vg = g.createRadialGradient(960, 540, 300, 960, 540, 1150); vg.addColorStop(0, 'rgba(5,2,26,0)'); vg.addColorStop(1, 'rgba(5,2,26,0.7)'); g.fillStyle = vg; g.fillRect(-200, -200, 2320, 1480);
      g.restore();
    },
  };
})();
