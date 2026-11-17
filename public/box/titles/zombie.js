'use strict';
// Zombie Survival title screen: a suburb at dusk the moment it all went wrong. Cartoon shamblers
// stagger along the street from both sides, fog rolls in, a rescue chopper sweeps its searchlight
// over the rooftops, and every so often lightning flashes and a survivor sprints past with
// the whole horde in pursuit. Art: public/box/games/zombie-art.js.
(function () {
  BOX.titles = BOX.titles || {};
  BOX.titles.zombie = {
    logo: '<span class="a">ZOMBIE</span><span class="b">SURVIVAL</span>',
    tagline: 'Six days. One horde. Pick your moves, grab the right gear, and try to make the last chopper out.',
    start: '🧟 Open the safehouse',
    meta: '1–100 players · 10–20 min',
    font: "'Black Ops One', 'Bungee', sans-serif",
    theme: { card: 'rgba(10, 14, 8, 0.9)', ink: '#f4f1e6', muted: '#c9d4b0', accent: '#9dff5a', button: '#9dff5a', buttonInk: '#10140a', border: '#9dff5a' },
    css: `.bt-zombie .bt-logo { line-height: .9; display: flex; flex-direction: column; align-items: center; }
      .bt-zombie .bt-logo .a { font-size: 1.25em; color: #9dff5a; letter-spacing: .04em; text-shadow: 0 6px 0 #1d3a0e, 0 0 40px rgba(157,255,90,.5); animation: btZbWob 3.4s ease-in-out infinite; display: inline-block; }
      .bt-zombie .bt-logo .b { font-size: .5em; color: #141414; background: #ffd34a; padding: .06em .5em; letter-spacing: .32em; margin-top: .14em; box-shadow: 0 5px 0 #8a6a00; transform: rotate(-2deg); }
      @keyframes btZbWob { 0%,100% { transform: rotate(-2deg) skewX(0); } 50% { transform: rotate(1.5deg) skewX(-3deg) translateY(-3px); } }
      .bt-zombie .bt-card { border-radius: 18px; box-shadow: 0 0 0 4px #10140a, 0 16px 0 rgba(0,0,0,.5), 0 0 80px rgba(157,255,90,.25); background-image: linear-gradient(rgba(10,14,8,.9), rgba(10,14,8,.9)); position: relative; }
      .bt-zombie .bt-card::before { content: ''; position: absolute; left: 18px; right: 18px; top: -8px; height: 10px; border-radius: 5px; background: repeating-linear-gradient(-45deg, #ffd34a 0 14px, #1a1a1a 14px 28px); }
      .bt-zombie .bt-tag { font-family: 'Special Elite', monospace; }
      .bt-zombie .bt-go { font-family: 'Black Ops One', sans-serif; box-shadow: 0 7px 0 #3a6a12; }`,
    init() { return { last: 0 }; },
    draw(g, W, H, t) {
      const Z = BOX.zombieArt; if (!Z) return;
      const sc = Math.max(W / 1920, H / 1080);
      g.save(); g.translate((W - 1920 * sc) / 2, (H - 1080 * sc) / 2); g.scale(sc, sc);
      Z.backdrop(g, 'streets', t, { dark: 0.3 });
      // the chopper sweeps across now and then
      const ck = (t % 18) / 18, cx = -400 + ck * 2800;
      if (ck < 0.95) Z.chopper(g, cx, 230 + Math.sin(t) * 16, 0.45, t, { light: true, lightX: Math.sin(t * 0.6) * 260 });
      // shamblers along the street
      for (let i = 0; i < 8; i++) {
        const dir = i % 2 ? 1 : -1, sp = 30 + (i % 3) * 8, span = 2600;
        const x = dir > 0 ? ((t * sp + i * 640) % span) - 340 : 1920 - (((t * sp + i * 640) % span) - 340);
        Z.zombie(g, x, 1000 + (i % 3) * 26, 0.8 + (i % 3) * 0.08, t, { seed: i, dir, speed: 2.6 });
      }
      // the chase: a survivor sprints by with a little horde behind
      const cyc = 11, k = (t % cyc) / cyc;
      if (k < 0.55) {
        const x = -200 + (k / 0.55) * 2500, av = ['🦊', '🐼', '🐸', '🦄', '🐯'][Math.floor(t / cyc) % 5];
        Z.survivor(g, x, 1050, 1.1, t, { avatar: av, color: '#ff8a4d', pose: 'run' });
        for (let j = 0; j < 3; j++) Z.zombie(g, x - 260 - j * 150, 1060 - (j % 2) * 20, 0.95, t, { seed: j + 9, dir: 1, speed: 5 });
        Z.text(g, '!!!', x + 20, 790, 54, '#ffd34a', { stroke: '#120d1c', lw: 10 });
      }
      Z.fog(g, t, 0.22, 1000);
      // lightning
      const fl = t % 9; if (fl > 8.6 && fl < 8.75 || fl > 8.85 && fl < 8.9) { g.fillStyle = 'rgba(220,230,255,0.35)'; g.fillRect(-200, -200, 2400, 1500); }
      Z.vignette(g, 0.6);
      g.restore();
    },
  };
})();
