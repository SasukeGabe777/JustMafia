// Themes v2: what makes each world feel different and alive (presentation only).
//   - the map: ground texture, trees, pond style, landmark set pieces, small layout shifts
//   - the living world: creatures, traffic, weather and sky, drawn every frame
//   - building touches (snow caps, block roofs, ink outlines, realistic shading)
//   - a whole-screen look (Noir is black and white with film grain)
// The classic look (Medieval Village "Mafia Town", Small Town) and RSP Supply are untouched:
// every function below does nothing for a theme without an entry in WORLDS.
(function () {
  const TAU = Math.PI * 2;
  const L = window.MT_LAYOUT;
  if (!L) return; // pages without the town map (e.g. the art gallery) don't need worlds
  const { W, H, CX, CY, ROAD } = L;
  const shade = (window.MTArt && window.MTArt.shade) || ((c) => c);

  // ---------- per-world settings ----------
  const WORLDS = {
    space: { layout: { pond: { dy: -20, rx: 95, ry: 58 }, cem: { dx: -10, dy: 20 } }, ground: 'regolith', tree: 'crystal', pond: 'coolant', pieces: ['launchPad', 'radarDish', 'solarArray', 'crater'], ambient: ['stars', 'drones', 'shuttle'] },
    fantasy: { layout: { pond: { dy: 10, rx: 112, ry: 68 }, cem: { dy: -25 } }, ground: 'meadow', tree: 'mushroom', pond: 'moonwell', pieces: ['fairyRing', 'portal', 'crystalTree', 'fairyRing'], ambient: ['wisps', 'butterflies'] },
    dragons: { layout: { pond: { dx: 20, rx: 90, ry: 55 }, cem: { dy: 25 } }, ground: 'scorched', tree: 'charred', pond: 'lava', pieces: ['volcano', 'nest', 'bones', 'lavaRocks'], ambient: ['embers', 'dragons'] },
    dungeon: { layout: { pond: { dx: -15, rx: 88, ry: 60 }, cem: { dx: -10, dy: -20 } }, ground: 'flagstone', tree: 'stalagmite', pond: 'murk', pieces: ['runeCircle', 'chest', 'skeleton', 'pillars'], ambient: ['torches', 'bats', 'motes'] },
    spies: { layout: { pond: { rx: 110, ry: 52 }, cem: { dy: 15 } }, ground: 'lawn', tree: null, pond: null, pieces: ['helipad', 'dish', 'sedans', 'crates'], ambient: ['traffic', 'helicopter'] },
    fbi: { layout: { pond: { dy: 20, rx: 100, ry: 55 }, cem: { dy: -15 } }, ground: 'lawn', tree: null, pond: null, pieces: ['vans', 'tape', 'tents', 'crates'], ambient: ['police', 'helicopter'] },
    snow: { layout: { pond: { dx: 10, dy: 10, rx: 112, ry: 66 }, cem: { dy: 20 } }, ground: 'snow', tree: 'snowPine', pond: 'ice', pieces: ['skiHill', 'snowman', 'sled', 'snowman'], ambient: ['reindeer', 'aurora', 'snowfall'] },
    blocky: { layout: { pond: { rx: 100, ry: 64 }, cem: { dx: -15 } }, ground: 'blocks', tree: 'cubeTree', pond: 'blockWater', pieces: ['cliff', 'mine', 'crops', 'torchPosts'], ambient: ['cubeClouds', 'woolies'] },
    tabletop: { layout: { pond: { dy: -15, rx: 112, ry: 68 }, cem: { dy: 25 } }, ground: 'parchment', tree: 'inkTree', pond: 'inkWater', pieces: ['compass', 'seaSerpent', 'diceTower', 'xMarks'], ambient: ['bigDie', 'inkBirds'], overlay: 'parchment' },
    realistic: { layout: { pond: { rx: 108, ry: 66 }, cem: { dy: -10 } }, ground: 'realGrass', tree: 'realTree', pond: 'realWater', pieces: ['parking', 'picnic', 'powerLines', 'playground'], ambient: ['cloudShadows', 'traffic', 'birds'], overlay: 'lens' },
    noir: { layout: { pond: { dy: 15, rx: 95, ry: 55 }, cem: { dy: 10 } }, ground: 'wetStreet', tree: 'bareTree', pond: null, pieces: ['billboard', 'tracks', 'newsstand', 'sedans'], ambient: ['headlights', 'rain'], filter: 'grayscale(1) contrast(1.25) brightness(0.92)', overlay: 'grain' },
  };
  const world = (theme) => WORLDS[theme] || null;

  // ---------- small drawing helpers ----------
  const rect = (ctx, c, x, y, w, h) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };
  const circle = (ctx, c, x, y, r) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); };
  const oval = (ctx, c, x, y, rx, ry, rot = 0) => { ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, TAU); ctx.fill(); };
  const poly = (ctx, c, pts) => { ctx.fillStyle = c; ctx.beginPath(); pts.forEach(([a, b], i) => (i ? ctx.lineTo(a, b) : ctx.moveTo(a, b))); ctx.closePath(); ctx.fill(); };
  const line = (ctx, c, w, pts) => { ctx.strokeStyle = c; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.beginPath(); pts.forEach(([a, b], i) => (i ? ctx.lineTo(a, b) : ctx.moveTo(a, b))); ctx.stroke(); };
  const onRoad = (a) => ({ x: CX + Math.cos(a) * ROAD.rx, y: CY + Math.sin(a) * ROAD.ry });

  // ---------- ground ----------
  // Returns true when the default grass tufts should be skipped (the texture replaces them).
  function paintGround(ctx, theme, pal, rng) {
    const w = world(theme); if (!w) return false;
    switch (w.ground) {
      case 'snow':
        for (let i = 0; i < 220; i++) oval(ctx, rng() > 0.5 ? 'rgba(170,195,225,0.22)' : 'rgba(255,255,255,0.5)', rng() * W, rng() * H, 30 + rng() * 90, 8 + rng() * 22, rng() * 0.4 - 0.2);
        for (let i = 0; i < 600; i++) rect(ctx, 'rgba(255,255,255,0.9)', rng() * W, rng() * H, 2, 2);
        for (let i = 0; i < 40; i++) { const x = rng() * W, y = rng() * H; for (let k = 0; k < 6; k++) oval(ctx, 'rgba(120,150,190,0.18)', x + k * 9, y + (k % 2) * 6, 3, 2); } // footprints
        return true;
      case 'blocks': {
        const S = 24;
        for (let y = 0; y < H; y += S) for (let x = 0; x < W; x += S) {
          const v = rng();
          rect(ctx, v < 0.08 ? shade(pal.grass, -0.12) : v < 0.16 ? shade(pal.grass, 0.08) : pal.grass, x, y, S, S);
          if (v > 0.985) rect(ctx, '#e8e04a', x + 8, y + 8, 6, 6); // a flower block
        }
        ctx.strokeStyle = 'rgba(0,0,0,0.07)'; ctx.lineWidth = 1;
        for (let x = 0; x < W; x += S) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
        for (let y = 0; y < H; y += S) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
        return true;
      }
      case 'parchment': {
        for (let i = 0; i < 90; i++) oval(ctx, rng() > 0.5 ? 'rgba(160,120,60,0.08)' : 'rgba(255,250,230,0.2)', rng() * W, rng() * H, 40 + rng() * 140, 20 + rng() * 70, rng() * 3);
        ctx.strokeStyle = 'rgba(110,80,40,0.13)'; ctx.lineWidth = 1.2; // hex grid, like a battle map
        const R = 34, hx = R * Math.sqrt(3);
        for (let row = 0; row * R * 1.5 < H + R; row++) for (let col = 0; col * hx < W + hx; col++) {
          const x = col * hx + (row % 2 ? hx / 2 : 0), y = row * R * 1.5;
          ctx.beginPath(); for (let k = 0; k < 6; k++) { const a = Math.PI / 6 + k * Math.PI / 3; ctx.lineTo(x + Math.cos(a) * R, y + Math.sin(a) * R); } ctx.closePath(); ctx.stroke();
        }
        for (let i = 0; i < 20; i++) oval(ctx, 'rgba(120,80,30,0.1)', rng() * W, rng() * H, 6 + rng() * 14, 4 + rng() * 9); // tea stains
        return true;
      }
      case 'realGrass':
        for (let i = 0; i < 2600; i++) oval(ctx, ['rgba(20,50,10,0.10)', 'rgba(140,170,80,0.10)', 'rgba(60,90,30,0.12)', 'rgba(190,200,120,0.06)'][i % 4], rng() * W, rng() * H, 3 + rng() * 26, 2 + rng() * 10, rng() * 3);
        for (let i = 0; i < 1800; i++) { const x = rng() * W, y = rng() * H; line(ctx, i % 3 ? 'rgba(30,70,20,0.35)' : 'rgba(150,180,90,0.35)', 1, [[x, y], [x + rng() * 3 - 1.5, y - 4 - rng() * 4]]); }
        for (let y = 0; y < H; y += 60) rect(ctx, 'rgba(255,255,255,0.025)', 0, y, W, 30); // mown stripes
        return true;
      case 'wetStreet':
        for (let i = 0; i < 300; i++) oval(ctx, rng() > 0.6 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.12)', rng() * W, rng() * H, 10 + rng() * 60, 3 + rng() * 10, rng() * 0.3);
        for (let y = 0; y < H; y += 48) for (let x = (y / 48) % 2 ? 0 : 48; x < W; x += 96) rect(ctx, 'rgba(0,0,0,0.08)', x, y, 46, 46); // paving
        return true;
      case 'regolith':
        for (let i = 0; i < 500; i++) circle(ctx, rng() > 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.1)', rng() * W, rng() * H, 1 + rng() * 4);
        for (let i = 0; i < 26; i++) { const x = rng() * W, y = rng() * H, r = 10 + rng() * 26; oval(ctx, 'rgba(0,0,0,0.18)', x, y, r, r * 0.5); oval(ctx, 'rgba(255,255,255,0.05)', x - r * 0.15, y - r * 0.1, r * 0.75, r * 0.32); }
        return true;
      case 'scorched':
        for (let i = 0; i < 90; i++) oval(ctx, 'rgba(40,20,10,0.16)', rng() * W, rng() * H, 30 + rng() * 80, 12 + rng() * 30, rng() * 3);
        for (let i = 0; i < 50; i++) { const x = rng() * W, y = rng() * H; line(ctx, 'rgba(255,120,40,0.35)', 2, [[x, y], [x + 14 - rng() * 28, y + 8], [x + 20 - rng() * 40, y + 18]]); } // glowing cracks
        return false;
      case 'meadow':
        for (let i = 0; i < 160; i++) circle(ctx, ['rgba(255,170,230,0.6)', 'rgba(190,160,255,0.6)', 'rgba(255,255,190,0.7)'][i % 3], rng() * W, rng() * H, 2 + rng() * 2);
        return false;
      case 'flagstone':
        for (let y = 0; y < H; y += 40) for (let x = (y / 40) % 2 ? -30 : 0; x < W; x += 60) { rect(ctx, rng() > 0.5 ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.04)', x + 2, y + 2, 56, 36); }
        ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 2;
        for (let y = 0; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
        return true;
      default: return false; // 'lawn': the classic grass
    }
  }

  // ---------- trees ----------
  // Drawn at (0,0) already translated and scaled. Returns true when handled.
  function drawTree(ctx, theme, t, pal) {
    const w = world(theme); if (!w || !w.tree) return false;
    oval(ctx, 'rgba(0,0,0,0.2)', 4, 2, 24, 7);
    switch (w.tree) {
      case 'snowPine':
        rect(ctx, '#5a3a24', -4, -16, 8, 16);
        for (let i = 0; i < 3; i++) { poly(ctx, shade(pal.tree, -0.1 + i * 0.05), [[-26 + i * 5, -14 - i * 15], [26 - i * 5, -14 - i * 15], [0, -44 - i * 15]]); poly(ctx, '#f4f8fc', [[-14 + i * 4, -30 - i * 15], [14 - i * 4, -30 - i * 15], [0, -44 - i * 15]]); }
        return true;
      case 'cubeTree':
        rect(ctx, '#6b4a2b', -6, -30, 12, 30); rect(ctx, '#5a3d22', 2, -30, 4, 30);
        rect(ctx, pal.tree, -24, -64, 48, 36); rect(ctx, shade(pal.tree, 0.12), -24, -64, 48, 8); rect(ctx, shade(pal.tree, -0.15), 8, -56, 16, 28); rect(ctx, shade(pal.tree, 0.08), -14, -78, 28, 16);
        return true;
      case 'inkTree':
        ctx.strokeStyle = '#4a3420'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -24); ctx.stroke();
        ctx.fillStyle = 'rgba(90,122,58,0.35)'; ctx.beginPath(); ctx.arc(0, -40, 20, 0, TAU); ctx.fill(); ctx.stroke();
        for (let i = -12; i <= 12; i += 6) { ctx.beginPath(); ctx.moveTo(i - 4, -30); ctx.lineTo(i + 4, -46); ctx.stroke(); } // hatching
        return true;
      case 'realTree': {
        rect(ctx, '#4a3626', -4, -28, 8, 28);
        const g = ctx.createRadialGradient(-8, -54, 4, 0, -44, 34); g.addColorStop(0, shade(pal.tree, 0.35)); g.addColorStop(0.6, pal.tree); g.addColorStop(1, shade(pal.tree, -0.35));
        ctx.fillStyle = g; for (const [x, y, r] of [[0, -44, 26], [-14, -36, 17], [15, -36, 16], [-6, -60, 16], [9, -58, 14]]) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); }
        return true;
      }
      case 'bareTree':
        line(ctx, '#151515', 5, [[0, 0], [0, -40]]); line(ctx, '#151515', 3, [[0, -26], [14, -46], [22, -50]]); line(ctx, '#151515', 3, [[0, -34], [-16, -52]]); line(ctx, '#151515', 2, [[0, -40], [4, -60]]);
        return true;
      case 'crystal':
        poly(ctx, 'rgba(110,240,210,0.85)', [[-10, 0], [-14, -30], [-4, -52], [6, -30], [2, 0]]); poly(ctx, 'rgba(140,200,255,0.85)', [[2, 0], [8, -26], [16, -40], [18, -12], [12, 0]]);
        poly(ctx, 'rgba(255,255,255,0.5)', [[-8, -10], [-10, -30], [-5, -44], [-4, -12]]);
        return true;
      case 'charred':
        line(ctx, '#2a1810', 6, [[0, 0], [0, -38]]); line(ctx, '#2a1810', 3, [[0, -22], [12, -36]]); line(ctx, '#2a1810', 3, [[0, -30], [-12, -44]]);
        circle(ctx, 'rgba(255,120,40,0.7)', 2, -12, 2); circle(ctx, 'rgba(255,170,60,0.6)', -1, -30, 1.5);
        return true;
      case 'mushroom':
        rect(ctx, '#efe6d6', -5, -26, 10, 26); oval(ctx, '#8a5ad8', 0, -30, 26, 16); oval(ctx, '#b48af0', -4, -34, 14, 7);
        for (const [x, y] of [[-12, -30], [8, -36], [14, -28], [-2, -40]]) circle(ctx, '#fff6ff', x, y, 2.5);
        return true;
      case 'stalagmite':
        poly(ctx, '#5a5562', [[-16, 0], [-4, -54], [6, -20], [16, 0]]); poly(ctx, '#6e6874', [[-12, 0], [-4, -54], [-2, 0]]); poly(ctx, '#4a4550', [[6, 0], [12, -30], [20, 0]]);
        return true;
    }
    return false;
  }

  // ---------- the pond (or what replaces it) ----------
  function paintPond(ctx, theme, pal, P) {
    const w = world(theme); if (!w || !w.pond) return false;
    oval(ctx, pal.grassDark, P.x, P.y, P.rx + 8, P.ry + 7);
    switch (w.pond) {
      case 'lava': {
        const g = ctx.createRadialGradient(P.x, P.y, 4, P.x, P.y, P.rx); g.addColorStop(0, '#ffe08a'); g.addColorStop(0.45, '#ff7a1a'); g.addColorStop(1, '#a3220a');
        oval(ctx, '#2a1208', P.x, P.y, P.rx + 4, P.ry + 4); ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(P.x, P.y, P.rx, P.ry, 0, 0, TAU); ctx.fill();
        for (let i = 0; i < 8; i++) oval(ctx, 'rgba(50,20,10,0.6)', P.x - P.rx * 0.6 + i * P.rx * 0.17, P.y + Math.sin(i * 2) * P.ry * 0.4, 12, 5, i); // crust
        return true;
      }
      case 'ice':
        oval(ctx, '#cfeaf7', P.x, P.y, P.rx, P.ry); oval(ctx, 'rgba(255,255,255,0.55)', P.x - 26, P.y - 16, P.rx * 0.5, P.ry * 0.25, -0.2);
        line(ctx, 'rgba(120,160,190,0.6)', 1.5, [[P.x - 40, P.y + 10], [P.x - 10, P.y - 6], [P.x + 18, P.y + 14], [P.x + 50, P.y - 2]]);
        ctx.strokeStyle = 'rgba(150,180,210,0.5)'; ctx.lineWidth = 1.5; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(P.x + 20 - i * 30, P.y + 8, 18, 6, 0.3, 0, TAU); ctx.stroke(); } // skate marks
        return true;
      case 'coolant':
        oval(ctx, '#20263a', P.x, P.y, P.rx + 6, P.ry + 6); oval(ctx, '#38e0d0', P.x, P.y, P.rx, P.ry); oval(ctx, 'rgba(255,255,255,0.35)', P.x - 20, P.y - 14, P.rx * 0.4, 8);
        ctx.strokeStyle = '#8a93a8'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(P.x, P.y, P.rx + 6, P.ry + 6, 0, 0, TAU); ctx.stroke();
        return true;
      case 'moonwell':
        oval(ctx, '#5fb7e8', P.x, P.y, P.rx, P.ry); oval(ctx, 'rgba(220,200,255,0.55)', P.x, P.y, P.rx * 0.55, P.ry * 0.5);
        for (let i = 0; i < 10; i++) circle(ctx, 'rgba(255,255,255,0.8)', P.x + Math.cos(i) * P.rx * 0.7, P.y + Math.sin(i * 1.7) * P.ry * 0.6, 2);
        return true;
      case 'murk':
        oval(ctx, '#2e4a44', P.x, P.y, P.rx, P.ry); for (let i = 0; i < 6; i++) circle(ctx, 'rgba(120,200,120,0.35)', P.x - 30 + i * 12, P.y + Math.sin(i) * 14, 4);
        return true;
      case 'blockWater': {
        const S = 24;
        for (let y = P.y - P.ry; y < P.y + P.ry; y += S) for (let x = P.x - P.rx; x < P.x + P.rx; x += S) if (((x + S / 2 - P.x) / P.rx) ** 2 + ((y + S / 2 - P.y) / P.ry) ** 2 < 1) rect(ctx, (x / S + y / S) % 2 ? pal.water : shade(pal.water, 0.08), x, y, S, S);
        return true;
      }
      case 'inkWater':
        oval(ctx, pal.water, P.x, P.y, P.rx, P.ry); ctx.strokeStyle = '#3a2a18'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(P.x, P.y, P.rx, P.ry, 0, 0, TAU); ctx.stroke();
        for (let i = 0; i < 6; i++) { const x = P.x - 50 + (i % 3) * 40, y = P.y - 18 + Math.floor(i / 3) * 26; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 6, y - 6, x + 12, y); ctx.quadraticCurveTo(x + 18, y + 6, x + 24, y); ctx.stroke(); }
        return true;
      case 'realWater': {
        const g = ctx.createLinearGradient(P.x, P.y - P.ry, P.x, P.y + P.ry); g.addColorStop(0, '#5f93a8'); g.addColorStop(1, '#2a4f60');
        ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(P.x, P.y, P.rx, P.ry, 0, 0, TAU); ctx.fill();
        oval(ctx, 'rgba(255,255,255,0.2)', P.x - 26, P.y - 18, P.rx * 0.45, 7, -0.15); oval(ctx, 'rgba(70,90,50,0.6)', P.x + P.rx * 0.6, P.y + 10, 16, 6);
        return true;
      }
    }
    return false;
  }

  // ---------- landmark set pieces (painted into the map at free spots) ----------
  const SPOTS = [[170, 120], [1750, 120], [160, 1000], [1760, 1000], [960, 1010], [470, 1000], [1450, 1000], [470, 110], [1450, 110]];
  const PIECES = {
    launchPad(ctx, x, y) { oval(ctx, '#3a4258', x, y, 60, 22); oval(ctx, '#55607a', x, y, 50, 17); rect(ctx, '#d7dcea', x - 9, y - 90, 18, 84); poly(ctx, '#ff5a5a', [[x - 9, y - 90], [x, y - 112], [x + 9, y - 90]]); poly(ctx, '#8f7bff', [[x - 9, y - 20], [x - 22, y - 4], [x - 9, y - 6]]); poly(ctx, '#8f7bff', [[x + 9, y - 20], [x + 22, y - 4], [x + 9, y - 6]]); circle(ctx, '#4fb3ff', x, y - 62, 4); rect(ctx, '#7a83a8', x + 20, y - 70, 4, 66); },
    radarDish(ctx, x, y) { rect(ctx, '#7a83a8', x - 3, y - 30, 6, 30); ctx.save(); ctx.translate(x, y - 34); ctx.rotate(-0.5); oval(ctx, '#d7dcea', 0, 0, 26, 12); oval(ctx, '#b9c1da', 0, 2, 20, 7); ctx.restore(); line(ctx, '#7a83a8', 2, [[x, y - 34], [x + 10, y - 50]]); circle(ctx, '#ff5a5a', x + 10, y - 51, 3); },
    solarArray(ctx, x, y) { for (let i = 0; i < 3; i++) { rect(ctx, '#2a3a6a', x - 50 + i * 36, y - 20, 32, 18); for (let k = 1; k < 4; k++) rect(ctx, '#4f6fb0', x - 50 + i * 36 + k * 8, y - 20, 1, 18); rect(ctx, '#7a83a8', x - 36 + i * 36, y - 2, 3, 6); } },
    crater(ctx, x, y) { oval(ctx, 'rgba(0,0,0,0.25)', x, y, 46, 18); oval(ctx, 'rgba(255,255,255,0.08)', x - 4, y - 3, 36, 12); },
    fairyRing(ctx, x, y) { for (let i = 0; i < 9; i++) { const a = i / 9 * TAU, px = x + Math.cos(a) * 36, py = y + Math.sin(a) * 14; rect(ctx, '#efe6d6', px - 2, py - 7, 4, 7); oval(ctx, i % 2 ? '#e05a8a' : '#8a5ad8', px, py - 8, 7, 4); } },
    portal(ctx, x, y) { ctx.strokeStyle = '#8a8496'; ctx.lineWidth = 9; ctx.beginPath(); ctx.ellipse(x, y - 34, 22, 34, 0, Math.PI, 0); ctx.stroke(); rect(ctx, '#8a8496', x - 27, y - 34, 9, 34); rect(ctx, '#8a8496', x + 18, y - 34, 9, 34); oval(ctx, 'rgba(160,110,255,0.55)', x, y - 30, 16, 28); },
    crystalTree(ctx, x, y) { rect(ctx, '#6b4a8a', x - 4, y - 30, 8, 30); for (const [dx, dy, c] of [[0, -50, '#9fe8ff'], [-14, -40, '#d0a0ff'], [14, -42, '#a0ffd8']]) poly(ctx, c, [[x + dx, y + dy - 18], [x + dx + 8, y + dy], [x + dx, y + dy + 10], [x + dx - 8, y + dy]]); },
    volcano(ctx, x, y) { poly(ctx, '#4a2a1e', [[x - 90, y], [x - 24, y - 100], [x + 24, y - 100], [x + 90, y]]); poly(ctx, '#5e3626', [[x - 90, y], [x - 24, y - 100], [x, y - 100], [x - 30, y]]); oval(ctx, '#ff7a1a', x, y - 100, 24, 7); line(ctx, '#ff7a1a', 6, [[x + 6, y - 96], [x + 18, y - 60], [x + 10, y - 30], [x + 22, y]]); line(ctx, '#ffd36b', 2, [[x + 6, y - 96], [x + 18, y - 60]]); },
    nest(ctx, x, y) { oval(ctx, '#5a3a20', x, y, 40, 14); oval(ctx, '#3a2414', x, y - 2, 30, 9); for (const [dx, c] of [[-12, '#d8c890'], [2, '#a8d0a0'], [15, '#e0b0a0']]) oval(ctx, c, x + dx, y - 8, 7, 10); },
    bones(ctx, x, y) { line(ctx, '#e9e2cf', 4, [[x - 40, y], [x + 40, y - 6]]); for (let i = 0; i < 5; i++) line(ctx, '#e9e2cf', 3, [[x - 26 + i * 12, y - 2], [x - 30 + i * 12, y - 22 - (i % 2) * 6]]); oval(ctx, '#e9e2cf', x + 46, y - 8, 12, 9); },
    lavaRocks(ctx, x, y) { for (let i = 0; i < 4; i++) { poly(ctx, '#3a2a24', [[x - 30 + i * 18, y], [x - 24 + i * 18, y - 18 - (i % 2) * 8], [x - 14 + i * 18, y]]); circle(ctx, 'rgba(255,120,40,0.8)', x - 22 + i * 18, y - 4, 2); } },
    runeCircle(ctx, x, y) { ctx.strokeStyle = 'rgba(125,255,106,0.5)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(x, y, 46, 18, 0, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.ellipse(x, y, 34, 13, 0, 0, TAU); ctx.stroke(); for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; rect(ctx, 'rgba(125,255,106,0.7)', x + Math.cos(a) * 40 - 2, y + Math.sin(a) * 15 - 2, 4, 4); } },
    chest(ctx, x, y) { rect(ctx, '#6a4424', x - 16, y - 16, 32, 16); rect(ctx, '#7a5434', x - 16, y - 24, 32, 9); rect(ctx, '#d4af37', x - 16, y - 16, 32, 2); rect(ctx, '#d4af37', x - 2, y - 18, 4, 6); },
    skeleton(ctx, x, y) { oval(ctx, '#e9e2cf', x - 20, y - 4, 7, 6); line(ctx, '#e9e2cf', 3, [[x - 13, y - 3], [x + 14, y - 1]]); for (let i = 0; i < 3; i++) line(ctx, '#e9e2cf', 2, [[x - 6 + i * 6, y - 6], [x - 6 + i * 6, y + 4]]); line(ctx, '#e9e2cf', 2, [[x + 14, y - 1], [x + 26, y - 6]]); line(ctx, '#e9e2cf', 2, [[x + 14, y - 1], [x + 26, y + 4]]); },
    pillars(ctx, x, y) { for (const dx of [-30, 30]) { rect(ctx, '#7d7784', x + dx - 9, y - 70, 18, 70); rect(ctx, '#8b8592', x + dx - 12, y - 74, 24, 6); rect(ctx, '#59535f', x + dx + 3, y - 70, 6, 70); } },
    helipad(ctx, x, y) { oval(ctx, '#3a4048', x, y, 54, 22); ctx.strokeStyle = '#e6eaec'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(x, y, 44, 17, 0, 0, TAU); ctx.stroke(); line(ctx, '#e6eaec', 4, [[x - 12, y - 8], [x - 12, y + 8]]); line(ctx, '#e6eaec', 4, [[x + 12, y - 8], [x + 12, y + 8]]); line(ctx, '#e6eaec', 4, [[x - 12, y], [x + 12, y]]); },
    dish(ctx, x, y) { PIECES.radarDish(ctx, x, y); },
    sedans(ctx, x, y) { car(ctx, x - 30, y, 1, '#1f2b38'); car(ctx, x + 32, y + 4, 1, '#3a3f45'); },
    crates(ctx, x, y) { for (const [dx, dy] of [[-18, 0], [4, 0], [-7, -18]]) { rect(ctx, '#7a5a34', x + dx, y + dy - 18, 20, 18); rect(ctx, '#5a3e22', x + dx, y + dy - 18, 20, 2); line(ctx, '#5a3e22', 1.5, [[x + dx, y + dy - 18], [x + dx + 20, y + dy]]); } },
    vans(ctx, x, y) { car(ctx, x - 34, y, 1.25, '#e6e6e6'); car(ctx, x + 36, y + 4, 1, '#1d3557'); },
    tape(ctx, x, y) { for (const dx of [-50, 50]) rect(ctx, '#3a3a3a', x + dx - 2, y - 26, 4, 26); line(ctx, '#ffd21f', 4, [[x - 50, y - 22], [x, y - 16], [x + 50, y - 22]]); for (let i = -40; i < 44; i += 14) rect(ctx, '#111', x + i, y - 21 + Math.abs(i) * 0.1, 6, 3); },
    tents(ctx, x, y) { for (const dx of [-24, 0, 24]) { poly(ctx, '#ffd21f', [[x + dx - 6, y], [x + dx, y - 12], [x + dx + 6, y]]); } ctx.fillStyle = '#111'; ctx.font = '700 8px monospace'; ctx.textAlign = 'center'; ctx.fillText('1', x - 24, y - 2); ctx.fillText('2', x, y - 2); ctx.fillText('3', x + 24, y - 2); },
    skiHill(ctx, x, y) { poly(ctx, '#f4f8fc', [[x - 110, y], [x - 10, y - 90], [x + 110, y]]); poly(ctx, '#dbe6f0', [[x - 10, y - 90], [x + 110, y], [x + 20, y]]); line(ctx, 'rgba(120,150,190,0.5)', 2, [[x - 20, y - 76], [x - 40, y - 40], [x - 10, y - 20], [x - 30, y]]); for (const dx of [-70, 60, 85]) { rect(ctx, '#5a3a24', x + dx - 2, y - 12, 4, 12); poly(ctx, '#2f5d4a', [[x + dx - 10, y - 10], [x + dx, y - 34], [x + dx + 10, y - 10]]); } },
    snowman(ctx, x, y) { circle(ctx, '#ffffff', x, y - 12, 14); circle(ctx, '#f4f8fc', x, y - 34, 10); circle(ctx, '#111', x - 3, y - 36, 1.5); circle(ctx, '#111', x + 3, y - 36, 1.5); poly(ctx, '#ff8a2a', [[x, y - 34], [x + 9, y - 32], [x, y - 31]]); rect(ctx, '#c0392b', x - 9, y - 26, 18, 3); line(ctx, '#5a3a24', 2, [[x - 12, y - 18], [x - 24, y - 26]]); line(ctx, '#5a3a24', 2, [[x + 12, y - 18], [x + 24, y - 26]]); },
    sled(ctx, x, y) { rect(ctx, '#a8321e', x - 18, y - 8, 36, 6); line(ctx, '#5a3a24', 2, [[x - 20, y], [x + 18, y], [x + 22, y - 5]]); },
    cliff(ctx, x, y) { for (let i = 0; i < 5; i++) for (let k = 0; k <= i; k++) { const bx = x - 60 + k * 24 + (4 - i) * 12, by = y - 24 - i * 24; rect(ctx, i > 2 ? '#7a7a7a' : '#8a6a44', bx, by + (4 - i) * 0, 24, 24); rect(ctx, 'rgba(0,0,0,0.12)', bx, by + 20, 24, 4); } },
    mine(ctx, x, y) { rect(ctx, '#7a7a7a', x - 36, y - 48, 72, 48); rect(ctx, '#222', x - 16, y - 32, 32, 32); rect(ctx, '#6b4a2b', x - 20, y - 36, 40, 6); rect(ctx, '#6b4a2b', x - 20, y - 36, 6, 36); rect(ctx, '#6b4a2b', x + 14, y - 36, 6, 36); for (let i = 0; i < 4; i++) rect(ctx, '#5a5a5a', x - 36 + i * 18, y - 48, 18, 4); },
    crops(ctx, x, y) { for (let r = 0; r < 3; r++) for (let c = 0; c < 6; c++) { rect(ctx, '#6b4a2b', x - 72 + c * 24, y - 72 + r * 24, 24, 24); rect(ctx, (r + c) % 3 ? '#8ac43a' : '#d8c43a', x - 66 + c * 24, y - 70 + r * 24, 12, 12); } },
    torchPosts(ctx, x, y) { for (const dx of [-30, 30]) { rect(ctx, '#6b4a2b', x + dx - 3, y - 26, 6, 26); rect(ctx, '#ffb000', x + dx - 4, y - 32, 8, 7); } },
    compass(ctx, x, y) { ctx.strokeStyle = '#4a3420'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y - 30, 30, 0, TAU); ctx.stroke(); poly(ctx, '#8a3a2a', [[x, y - 64], [x + 6, y - 30], [x, y - 24], [x - 6, y - 30]]); poly(ctx, '#4a3420', [[x, y + 4], [x + 6, y - 30], [x, y - 36], [x - 6, y - 30]]); poly(ctx, '#4a3420', [[x - 34, y - 30], [x, y - 36], [x + 34, y - 30], [x, y - 24]]); ctx.fillStyle = '#4a3420'; ctx.font = '700 12px serif'; ctx.textAlign = 'center'; ctx.fillText('N', x, y - 68); },
    seaSerpent(ctx, x, y) { ctx.strokeStyle = '#2a4a3a'; ctx.lineWidth = 4; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(x - 40 + i * 30, y - 6, 12, Math.PI, 0); ctx.stroke(); } oval(ctx, '#3a6a4a', x + 50, y - 16, 10, 7); circle(ctx, '#111', x + 54, y - 18, 1.5); ctx.fillStyle = '#4a3420'; ctx.font = 'italic 11px serif'; ctx.textAlign = 'center'; ctx.fillText('here be monsters', x, y + 16); },
    diceTower(ctx, x, y) { rect(ctx, '#6a4424', x - 18, y - 70, 36, 70); rect(ctx, '#7a5434', x - 22, y - 76, 44, 8); for (let i = 0; i < 3; i++) rect(ctx, '#3a2414', x - 10, y - 60 + i * 16, 20, 4); die(ctx, x + 34, y - 8, 9, 0.3, '#c0392b', '6'); },
    xMarks(ctx, x, y) { line(ctx, '#8a3a2a', 4, [[x - 10, y - 10], [x + 10, y + 10]]); line(ctx, '#8a3a2a', 4, [[x + 10, y - 10], [x - 10, y + 10]]); ctx.setLineDash([6, 6]); line(ctx, '#8a3a2a', 2, [[x - 90, y + 20], [x - 50, y - 20], [x - 14, y]]); ctx.setLineDash([]); },
    parking(ctx, x, y) { rect(ctx, '#4a4846', x - 80, y - 40, 160, 46); for (let i = 0; i < 5; i++) rect(ctx, '#e6e1d8', x - 78 + i * 38, y - 40, 2, 30); car(ctx, x - 40, y - 8, 1, '#8a1f1f'); car(ctx, x + 36, y - 8, 1, '#2a4f7a'); },
    picnic(ctx, x, y) { rect(ctx, '#7a5434', x - 22, y - 16, 44, 7); rect(ctx, '#6a4424', x - 26, y - 6, 52, 4); rect(ctx, '#6a4424', x - 26, y - 24, 52, 4); oval(ctx, 'rgba(0,0,0,0.2)', x, y + 2, 30, 6); },
    powerLines(ctx, x, y) { for (const dx of [-70, 70]) { rect(ctx, '#4a3626', x + dx - 3, y - 80, 6, 80); rect(ctx, '#4a3626', x + dx - 14, y - 74, 28, 4); } ctx.strokeStyle = '#222'; ctx.lineWidth = 1; for (const o of [-12, 0, 12]) { ctx.beginPath(); ctx.moveTo(x - 70 + o, y - 74); ctx.quadraticCurveTo(x, y - 54, x + 70 + o, y - 74); ctx.stroke(); } },
    playground(ctx, x, y) { line(ctx, '#c0392b', 4, [[x - 30, y], [x - 20, y - 40], [x + 20, y - 40], [x + 30, y]]); line(ctx, '#888', 1.5, [[x - 8, y - 40], [x - 8, y - 14]]); line(ctx, '#888', 1.5, [[x + 8, y - 40], [x + 8, y - 14]]); rect(ctx, '#333', x - 12, y - 14, 24, 3); },
    billboard(ctx, x, y) { rect(ctx, '#333', x - 3, y - 40, 6, 40); rect(ctx, '#ddd', x - 60, y - 96, 120, 58); rect(ctx, '#222', x - 56, y - 92, 112, 50); ctx.fillStyle = '#eee'; ctx.font = '700 15px serif'; ctx.textAlign = 'center'; ctx.fillText('LUCKY STRIKE', x, y - 70); ctx.font = 'italic 11px serif'; ctx.fillText('the city never sleeps', x, y - 52); },
    tracks(ctx, x, y) { for (let i = -100; i < 100; i += 12) rect(ctx, '#3a3a3a', x + i, y - 14, 6, 28); rect(ctx, '#777', x - 104, y - 8, 208, 3); rect(ctx, '#777', x - 104, y + 6, 208, 3); },
    newsstand(ctx, x, y) { rect(ctx, '#2a2a2a', x - 24, y - 40, 48, 40); rect(ctx, '#555', x - 28, y - 46, 56, 8); for (let i = 0; i < 4; i++) rect(ctx, '#ddd', x - 20 + i * 10, y - 30, 8, 12); },
  };
  // Little reusable props.
  function car(ctx, x, y, s, color, lights) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    oval(ctx, 'rgba(0,0,0,0.25)', 0, 3, 24, 5); rect(ctx, color, -22, -12, 44, 12); rect(ctx, shade(color, -0.25), -14, -20, 26, 9); rect(ctx, '#9fc4d8', -11, -18, 9, 6); rect(ctx, '#9fc4d8', 1, -18, 9, 6);
    circle(ctx, '#151515', -13, 0, 5); circle(ctx, '#151515', 13, 0, 5);
    if (lights) { rect(ctx, lights[0], -24, -10, 4, 4); rect(ctx, lights[1] || lights[0], 20, -10, 4, 4); }
    ctx.restore();
  }
  function die(ctx, x, y, r, rot, color, num) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
    poly(ctx, color, Array.from({ length: 6 }, (_, k) => [Math.cos(k * Math.PI / 3 + Math.PI / 6) * r, Math.sin(k * Math.PI / 3 + Math.PI / 6) * r]));
    ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = Math.max(1, r / 10); ctx.beginPath(); ctx.moveTo(0, -r); ctx.lineTo(-r * 0.86, r * 0.5); ctx.lineTo(r * 0.86, r * 0.5); ctx.closePath(); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.font = `700 ${Math.round(r * 0.75)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(num, 0, r * 0.1);
    ctx.restore();
  }
  function paintSetPieces(ctx, theme, pal, ok) {
    const w = world(theme); if (!w) return;
    let k = 0;
    for (const [x, y] of SPOTS) {
      if (k >= w.pieces.length) break;
      if (!ok(x, y - 30, 50)) continue;
      const fn = PIECES[w.pieces[k]]; if (fn) fn(ctx, x, y, pal);
      k++;
    }
  }

  // ---------- the living world (drawn every frame) ----------
  // layer: 'ground' (under houses/people: shadows, cars), 'sky' (over everything, under the
  // night tint: dragons, drones, birds), 'weather' (over the night tint: snow, rain, aurora).
  function drawAmbient(town, ctx, layer) {
    const w = world(town.themeId); if (!w) return;
    const t = town.time, dark = town.cineDark != null ? town.cineDark : town.dark || 0;
    for (const kind of w.ambient) { const fn = AMBIENT[kind]; if (fn && fn[layer]) fn[layer](ctx, t, dark, town); }
  }
  const seededList = (n, seed, fn) => { const rng = L.seeded(seed); return Array.from({ length: n }, () => fn(rng)); };
  const STARS = seededList(160, 11, (r) => [r() * W, r() * H, r() * 6]);
  const MOTES = seededList(60, 12, (r) => [r() * W, r() * H, r() * 6]);
  const AMBIENT = {
    stars: { ground(ctx, t) { for (const [x, y, p] of STARS) { const a = 0.25 + 0.35 * Math.sin(t * 2 + p); if (a > 0.1) rect(ctx, `rgba(200,230,255,${a})`, x, y, 2, 2); } } },
    drones: { sky(ctx, t) {
      for (let i = 0; i < 4; i++) {
        const x = CX + Math.sin(t * 0.17 + i * 1.7) * (520 + i * 70), y = CY - 60 + Math.sin(t * 0.29 + i) * 300;
        oval(ctx, 'rgba(0,0,0,0.25)', x + 10, y + 60, 12, 4);
        rect(ctx, '#c4cbe0', x - 8, y - 3, 16, 6); rect(ctx, '#7a83a8', x - 14, y - 6, 6, 2); rect(ctx, '#7a83a8', x + 8, y - 6, 6, 2);
        circle(ctx, Math.sin(t * 6 + i) > 0 ? '#ff4040' : '#40ff90', x, y + 4, 2);
      }
    } },
    shuttle: { sky(ctx, t) {
      const cyc = (t % 40) / 40; if (cyc > 0.35) return;
      const x = -200 + cyc / 0.35 * (W + 400), y = 160 + Math.sin(cyc * 6) * 30;
      for (let i = 1; i < 10; i++) circle(ctx, `rgba(120,240,255,${0.35 - i * 0.03})`, x - i * 16, y + 2, 6 - i * 0.4);
      poly(ctx, '#e4e8f3', [[x - 40, y - 8], [x + 30, y - 8], [x + 52, y], [x + 30, y + 8], [x - 40, y + 8]]); poly(ctx, '#8f7bff', [[x - 30, y - 8], [x - 44, y - 22], [x - 14, y - 8]]); rect(ctx, '#4fb3ff', x + 18, y - 5, 12, 5);
    } },
    wisps: { weather(ctx, t, dark) {
      for (let i = 0; i < 46; i++) {
        const x = (i * 211 + Math.sin(t * 0.4 + i) * 60) % W, y = (i * 97 + Math.cos(t * 0.33 + i * 2) * 40) % H, a = (0.35 + 0.4 * Math.sin(t * 3 + i)) * (0.5 + dark);
        if (a < 0.05) continue; const g = ctx.createRadialGradient(x, y, 0, x, y, 9); g.addColorStop(0, `rgba(230,200,255,${a})`); g.addColorStop(1, 'rgba(230,200,255,0)'); ctx.fillStyle = g; ctx.fillRect(x - 9, y - 9, 18, 18);
      }
    } },
    butterflies: { sky(ctx, t) {
      for (let i = 0; i < 6; i++) { const x = CX + Math.sin(t * 0.3 + i * 2) * 700, y = CY + Math.cos(t * 0.23 + i) * 380, f = Math.abs(Math.sin(t * 12 + i)) * 6 + 1; oval(ctx, ['#ff9ad8', '#9ad8ff', '#ffe08a'][i % 3], x - f / 2, y, f, 4); oval(ctx, ['#ff9ad8', '#9ad8ff', '#ffe08a'][i % 3], x + f / 2, y, f, 4); }
    } },
    embers: { weather(ctx, t) {
      for (let i = 0; i < 70; i++) { const x = (i * 271 + Math.sin(t + i) * 30) % W, y = H - ((t * (20 + (i % 5) * 8) + i * 53) % (H + 40)); rect(ctx, i % 3 ? 'rgba(255,140,40,0.75)' : 'rgba(255,220,120,0.8)', x, y, 3, 3); }
    } },
    dragons: {
      ground(ctx, t) { for (let i = 0; i < 3; i++) { const d = dragonPos(t, i); oval(ctx, 'rgba(0,0,0,0.16)', d.x + 30, d.y + 230, 70 * d.s, 18 * d.s); } },
      sky(ctx, t) { for (let i = 0; i < 3; i++) drawDragon(ctx, dragonPos(t, i), t, i); },
    },
    torches: { weather(ctx, t, dark) {
      for (const [x, y] of [[300, 360], [620, 360], [1300, 360], [1620, 360], [300, 680], [1620, 680], [CX - 230, CY], [CX + 230, CY]]) {
        rect(ctx, '#4a3426', x - 2, y - 26, 4, 26); const f = 1 + Math.sin(t * 13 + x) * 0.15;
        oval(ctx, '#ff9a2a', x, y - 30, 4 * f, 7 * f); oval(ctx, '#ffe08a', x, y - 29, 2, 3);
        if (dark > 0.2) { const g = ctx.createRadialGradient(x, y - 28, 0, x, y - 28, 70); g.addColorStop(0, `rgba(255,170,60,${0.25 * dark})`); g.addColorStop(1, 'rgba(255,170,60,0)'); ctx.fillStyle = g; ctx.fillRect(x - 70, y - 98, 140, 140); }
      }
    } },
    bats: { sky(ctx, t) {
      for (let i = 0; i < 8; i++) { const x = CX + Math.sin(t * 0.5 + i * 1.3) * 760 + Math.sin(t * 3 + i) * 20, y = 300 + Math.sin(t * 0.7 + i * 2) * 260, f = Math.sin(t * 18 + i) * 6; poly(ctx, '#1a1620', [[x - 12, y - f], [x - 4, y], [x, y - 3], [x + 4, y], [x + 12, y - f], [x, y + 3]]); }
    } },
    motes: { weather(ctx, t) { for (const [x, y, p] of MOTES) rect(ctx, `rgba(220,210,180,${0.15 + 0.15 * Math.sin(t + p)})`, (x + Math.sin(t * 0.2 + p) * 20) % W, (y + t * 4) % H, 2, 2); } },
    traffic: { ground(ctx, t) { for (let i = 0; i < 3; i++) { const a = t * 0.06 + i * 2.1, p = onRoad(a); car(ctx, p.x, p.y + 4, 0.8, ['#8a1f1f', '#2a4f7a', '#d0d0c8'][i], null); } } },
    police: { ground(ctx, t) { for (let i = 0; i < 2; i++) { const a = -t * 0.07 + i * Math.PI, p = onRoad(a), on = Math.sin(t * 14) > 0; car(ctx, p.x, p.y + 4, 0.85, '#f4f4f4', [on ? '#ff2a2a' : '#2a6aff', on ? '#2a6aff' : '#ff2a2a']); rect(ctx, '#111', p.x - 6, p.y - 6, 12, 3); } } },
    helicopter: {
      ground(ctx, t) { const h = heliPos(t); ctx.save(); ctx.globalAlpha = 0.18; oval(ctx, '#fffbe0', h.x + 40, h.y + 200, 70, 26); ctx.restore(); oval(ctx, 'rgba(0,0,0,0.15)', h.x + 20, h.y + 120, 26, 7); },
      sky(ctx, t) { const h = heliPos(t); rect(ctx, '#2c3e50', h.x - 18, h.y - 7, 36, 14); rect(ctx, '#2c3e50', h.x + 16, h.y - 3, 28, 4); rect(ctx, '#9fc4d8', h.x - 14, h.y - 5, 10, 7); const r = (t * 40) % TAU; line(ctx, '#111', 2, [[h.x - Math.cos(r) * 34, h.y - 12 - Math.sin(r) * 4], [h.x + Math.cos(r) * 34, h.y - 12 + Math.sin(r) * 4]]); circle(ctx, Math.sin(t * 5) > 0 ? '#ff3030' : '#300', h.x + 44, h.y - 2, 2); },
    },
    reindeer: { ground(ctx, t) {
      for (let i = 0; i < 2; i++) {
        const a = t * 0.03 + i * 3, x = CX + Math.cos(a) * 880, y = CY + Math.sin(a) * 440, dir = Math.sin(a) > 0 ? -1 : 1, step = Math.sin(t * 6 + i) * 2;
        ctx.save(); ctx.translate(x, y); ctx.scale(dir, 1);
        oval(ctx, 'rgba(0,0,0,0.15)', 0, 2, 18, 4); rect(ctx, '#7a5434', -14, -20, 26, 10); for (const lx of [-12, -4, 4, 10]) rect(ctx, '#5a3a24', lx, -10, 3, 10 + (lx % 8 ? step : -step));
        rect(ctx, '#7a5434', 10, -30, 6, 12); rect(ctx, '#7a5434', 12, -34, 10, 7); circle(ctx, i ? '#d03030' : '#2a1a10', 22, -31, 2);
        line(ctx, '#d8c8a0', 1.5, [[14, -34], [12, -44], [8, -48]]); line(ctx, '#d8c8a0', 1.5, [[16, -34], [20, -44], [24, -47]]);
        ctx.restore();
      }
    } },
    aurora: { weather(ctx, t, dark) {
      if (dark < 0.25) return;
      for (let b = 0; b < 3; b++) {
        ctx.beginPath(); for (let x = 0; x <= W; x += 40) ctx.lineTo(x, 70 + b * 40 + Math.sin(x / 210 + t * 0.4 + b) * 30);
        for (let x = W; x >= 0; x -= 40) ctx.lineTo(x, 150 + b * 40 + Math.sin(x / 190 + t * 0.5 + b * 2) * 34);
        ctx.closePath(); ctx.fillStyle = `rgba(${b === 1 ? '140,90,255' : '80,255,170'},${0.16 * dark})`; ctx.fill();
      }
    } },
    snowfall: { weather(ctx, t) {
      for (let i = 0; i < 260; i++) { const x = ((i * 137) % W + Math.sin(t * 0.8 + i) * 18 + t * 12) % W, y = (i * 59 + t * (30 + (i % 7) * 7)) % H; rect(ctx, 'rgba(255,255,255,0.85)', x, y, i % 4 ? 2 : 3, i % 4 ? 2 : 3); }
    } },
    cubeClouds: { sky(ctx, t) {
      for (let i = 0; i < 5; i++) { const x = ((t * 14 + i * 470) % (W + 400)) - 200, y = 90 + i * 34; for (const [dx, dy, w] of [[0, 0, 120], [24, -16, 72], [-24, 8, 48]]) rect(ctx, 'rgba(255,255,255,0.55)', x + dx, y + dy, w, 20); }
    } },
    woolies: { ground(ctx, t) {
      for (let i = 0; i < 4; i++) {
        const seg = Math.floor(t / 3 + i * 7), phase = (t / 3 + i * 7) % 1, r = L.seeded(seg * 13 + i), r2 = L.seeded(seg * 13 + i + 1);
        const ax = 220 + r() * 1480, ay = 330 + r() * 420, bx = 220 + r2() * 1480, by = 330 + r2() * 420;
        const walk = phase < 0.6 ? phase / 0.6 : 1, x = ax + (bx - ax) * walk * 0.2, y = ay + (by - ay) * walk * 0.2, dir = bx > ax ? 1 : -1, hop = phase < 0.6 ? Math.abs(Math.sin(phase * 30)) * 2 : 0;
        ctx.save(); ctx.translate(x, y - hop); ctx.scale(dir, 1);
        oval(ctx, 'rgba(0,0,0,0.15)', 0, hop + 2, 16, 4); rect(ctx, '#ececec', -14, -20, 26, 16); rect(ctx, '#d0d0d0', -14, -8, 26, 4); rect(ctx, '#ececec', 10, -24, 10, 10); rect(ctx, '#c49a7a', 14, -20, 6, 6); rect(ctx, '#111', 17, -22, 2, 2);
        for (const lx of [-12, -4, 4, 10]) rect(ctx, '#c49a7a', lx, -4, 3, 6);
        ctx.restore();
      }
    } },
    bigDie: { sky(ctx, t) {
      const cyc = (t % 28) / 28; if (cyc > 0.3) return;
      const p = cyc / 0.3, x = -80 + p * (W + 160), y = 980 - Math.abs(Math.sin(p * 9)) * 90 * (1 - p * 0.6);
      oval(ctx, 'rgba(60,40,20,0.2)', x, 990, 34, 8); die(ctx, x, y, 34, p * 18, '#8a1f2a', p > 0.92 ? '20' : String(1 + Math.floor((p * 40) % 20)));
    } },
    inkBirds: { sky(ctx, t) { for (let i = 0; i < 6; i++) { const x = (t * 30 + i * 330) % (W + 100) - 50, y = 140 + i * 30 + Math.sin(t + i) * 10, f = Math.sin(t * 8 + i) * 5; line(ctx, '#4a3420', 2, [[x - 9, y - f], [x, y], [x + 9, y - f]]); } } },
    cloudShadows: { ground(ctx, t) { for (let i = 0; i < 4; i++) { const x = ((t * 10 + i * 560) % (W + 600)) - 300, y = 200 + i * 220; oval(ctx, 'rgba(0,0,0,0.07)', x, y, 260, 90); } } },
    birds: { sky(ctx, t) { for (let i = 0; i < 7; i++) { const x = ((t * 42 + i * 18) % (W + 200)) - 100 + i * 14, y = 160 + (i % 3) * 12 + Math.abs(i - 3) * 10, f = Math.sin(t * 9 + i) * 4; line(ctx, '#222', 1.6, [[x - 6, y - f], [x, y], [x + 6, y - f]]); } } },
    headlights: { ground(ctx, t, dark) {
      for (let i = 0; i < 3; i++) {
        const a = t * 0.05 + i * 2.1, p = onRoad(a), q = onRoad(a + 0.02), dir = Math.atan2(q.y - p.y, q.x - p.x);
        ctx.save(); ctx.globalAlpha = 0.25 + 0.4 * dark; ctx.translate(p.x, p.y); ctx.rotate(dir); const g = ctx.createLinearGradient(0, 0, 140, 0); g.addColorStop(0, 'rgba(255,250,220,0.7)'); g.addColorStop(1, 'rgba(255,250,220,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(10, -4); ctx.lineTo(140, -34); ctx.lineTo(140, 34); ctx.lineTo(10, 4); ctx.closePath(); ctx.fill(); ctx.restore();
        car(ctx, p.x, p.y + 4, 0.8, '#1a1a1a', ['#fff6d0']);
      }
    } },
    rain: { weather(ctx, t) {
      ctx.strokeStyle = 'rgba(220,220,230,0.35)'; ctx.lineWidth = 1.2; ctx.beginPath();
      for (let i = 0; i < 340; i++) { const x = ((i * 113) % W + t * 120) % W, y = (i * 71 + t * 900) % H; ctx.moveTo(x, y); ctx.lineTo(x - 6, y + 22); }
      ctx.stroke();
      for (let i = 0; i < 24; i++) { const p = (t * 1.3 + i * 0.37) % 1, x = (i * 397) % W, y = (i * 211) % H; ctx.strokeStyle = `rgba(230,230,240,${0.4 * (1 - p)})`; ctx.beginPath(); ctx.ellipse(x, y, 3 + p * 12, 1 + p * 4, 0, 0, TAU); ctx.stroke(); }
      if ((t % 23) < 0.12) { ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(-20, -20, W + 40, H + 40); } // lightning
    } },
  };
  function dragonPos(t, i) { const s = 0.9 + i * 0.25; return { x: CX + Math.sin(t * 0.11 + i * 2.1) * 900, y: 260 + Math.sin(t * 0.19 + i * 1.3) * 160 + i * 60, s, dir: Math.cos(t * 0.11 + i * 2.1) >= 0 ? 1 : -1 }; }
  function heliPos(t) { return { x: CX + Math.cos(t * 0.09) * 640, y: CY - 120 + Math.sin(t * 0.09) * 260 }; }
  function drawDragon(ctx, d, t, i) {
    const flap = Math.sin(t * 5 + i * 2), body = ['#7a1f12', '#2a5a3a', '#3a2a6a'][i % 3], wing = ['#a8321e', '#3a7a4a', '#5a4a9a'][i % 3];
    ctx.save(); ctx.translate(d.x, d.y); ctx.scale(d.dir * d.s, d.s);
    poly(ctx, wing, [[-6, -6], [-40, -40 - flap * 26], [-10, -8]]); // far wing
    ctx.strokeStyle = body; ctx.lineWidth = 8; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-26, 0); ctx.quadraticCurveTo(-56, 6 + flap * 4, -76, -6); ctx.stroke(); // tail
    oval(ctx, body, 0, 0, 30, 11); oval(ctx, shade(body, 0.2), 4, 3, 22, 5);
    ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(24, -4); ctx.lineTo(38, -16); ctx.stroke(); // neck
    oval(ctx, body, 44, -18, 11, 7); poly(ctx, '#e9e2cf', [[40, -24], [36, -34], [44, -26]]); circle(ctx, '#ffd36b', 47, -20, 2);
    poly(ctx, wing, [[0, -8], [10, -50 - flap * 30], [26, -10]]); poly(ctx, shade(wing, -0.2), [[6, -8], [10, -50 - flap * 30], [14, -8]]);
    if ((t + i * 5) % 17 < 1.4) { for (let k = 0; k < 7; k++) circle(ctx, k % 2 ? 'rgba(255,200,60,0.85)' : 'rgba(255,110,30,0.8)', 56 + k * 10, -16 + Math.sin(t * 30 + k) * 4, 6 - k * 0.5); } // fire breath
    ctx.restore();
  }

  // ---------- buildings ----------
  // Replaces the roof in worlds with their own roof shape (returns true when drawn).
  function roof(kit, theme) {
    const { r, w, height, roof: c } = kit;
    if (theme === 'blocky') { // a stepped roof of blocks
      for (let i = 0; i < 4; i++) { const ww = w + 8 - i * 18; if (ww <= 6) break; r(shade(c, i % 2 ? -0.1 : 0.05), -ww / 2, -height - 8 - i * 8, ww, 8); r('rgba(0,0,0,0.15)', -ww / 2, -height - 1 - i * 8, ww, 1); }
      return true;
    }
    return false;
  }
  function buildingExtra(kit, theme) {
    const { ctx, r, polygon, w, height, top } = kit, eave = -height + 2;
    if (theme === 'snow') {
      if (top < eave - 4) polygon('#f4f8fc', [[-w / 2 - 5, eave - 2], [-w / 2 + 8, top - 2], [w / 2 - 8, top - 2], [w / 2 + 5, eave - 2], [w / 2 - 2, eave - 8], [-w / 2 + 2, eave - 8]]);
      else r('#f4f8fc', -w / 2 - 6, -height - 12, w + 12, 6);
      for (let x = -w / 2; x < w / 2; x += 8) r('rgba(220,240,255,0.95)', x, eave + 3, 2, 4 + (Math.abs(x) % 5)); // icicles
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(-w / 2 + 6, 1, 14, 5, 0, 0, TAU); ctx.ellipse(w / 2 - 4, 1, 12, 4, 0, 0, TAU); ctx.fill();
    } else if (theme === 'tabletop') {
      ctx.strokeStyle = 'rgba(58,40,22,0.85)'; ctx.lineWidth = 1.6; ctx.strokeRect(-w / 2, -height, w, height);
      for (let x = w / 2 - 12; x < w / 2; x += 3) { ctx.beginPath(); ctx.moveTo(x, -height); ctx.lineTo(x + 3, -height + 8); ctx.stroke(); }
    } else if (theme === 'realistic') {
      const g = ctx.createLinearGradient(-w / 2, 0, w / 2, 0); g.addColorStop(0, 'rgba(255,240,210,0.16)'); g.addColorStop(0.6, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,20,0.22)');
      ctx.fillStyle = g; ctx.fillRect(-w / 2, -height, w, height);
      const v = ctx.createLinearGradient(0, -height, 0, 0); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.18)'); ctx.fillStyle = v; ctx.fillRect(-w / 2, -height, w, height);
    } else if (theme === 'blocky') {
      ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 1;
      for (let y = -height; y < 0; y += 12) { ctx.beginPath(); ctx.moveTo(-w / 2, y); ctx.lineTo(w / 2, y); ctx.stroke(); }
      for (let x = -w / 2; x < w / 2; x += 12) { ctx.beginPath(); ctx.moveTo(x, -height); ctx.lineTo(x, 0); ctx.stroke(); }
    }
  }

  // ---------- whole screen ----------
  const screenFilter = (theme) => (world(theme) || {}).filter || null;
  function drawScreenOverlay(scr, theme, t, w0, h0) {
    const w = world(theme); if (!w || !w.overlay) return;
    if (w.overlay === 'grain') {
      for (let i = 0; i < 260; i++) { const v = Math.random(); scr.fillStyle = v > 0.5 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)'; scr.fillRect(Math.random() * w0, Math.random() * h0, 2, 2); }
      if (Math.random() < 0.05) { scr.fillStyle = 'rgba(255,255,255,0.05)'; scr.fillRect(Math.random() * w0, 0, 1.5, h0); } // film scratch
    }
    const edge = w.overlay === 'parchment' ? '70,45,15' : w.overlay === 'lens' ? '10,8,6' : '0,0,0', a = w.overlay === 'parchment' ? 0.42 : w.overlay === 'lens' ? 0.32 : 0.55;
    const g = scr.createRadialGradient(w0 / 2, h0 / 2, h0 * 0.35, w0 / 2, h0 / 2, h0 * 0.95); g.addColorStop(0, `rgba(${edge},0)`); g.addColorStop(1, `rgba(${edge},${a})`);
    scr.fillStyle = g; scr.fillRect(0, 0, w0, h0);
    if (w.overlay === 'lens') { const s = scr.createRadialGradient(w0 * 0.82, h0 * 0.08, 0, w0 * 0.82, h0 * 0.08, h0 * 0.6); s.addColorStop(0, 'rgba(255,236,200,0.16)'); s.addColorStop(1, 'rgba(255,236,200,0)'); scr.fillStyle = s; scr.fillRect(0, 0, w0, h0); }
  }

  window.MT_THEME_WORLD = { WORLDS, world, variant: (theme) => (world(theme) || {}).layout || null, paintGround, drawTree, paintPond, paintSetPieces, drawAmbient, roof, buildingExtra, screenFilter, drawScreenOverlay, car, die };
})();
