'use strict';
// JustUndercover title screen (format: public/box/title.js). Draw a scene that sets the game's style.
(function () {
  BOX.titles["undercover"] = {
    logo: "JustUndercover", tagline: 'One line that sells the game.', start: '▶ Start a room', meta: '2–100 players · 10–20 min',
    font: "'Lilita One', sans-serif",
    theme: { card: 'rgba(20, 10, 48, 0.84)', button: '#ffd23f', buttonInk: '#2a1650', border: '#ff4f9a' },
    init(W, H) { return { dots: Array.from({ length: 40 }, () => ({ x: Math.random() * W, y: Math.random() * H, r: 4 + Math.random() * 10, v: 10 + Math.random() * 30 })) }; },
    draw(g, W, H, t, S) {
      const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#2a0b4d'); bg.addColorStop(1, '#12052a'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
      g.font = '40px serif'; g.textAlign = 'center';
      for (const d of S.dots) { d.y -= d.v / 60; if (d.y < -20) d.y = H + 20; g.globalAlpha = 0.5; g.fillText("🕵️", d.x, d.y); }
      g.globalAlpha = 1;
    },
  };
})();
