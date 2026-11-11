// Town geometry shared by the big screen (town.js) and the Judge's
// clickable mini-map, so a house index means the same place on both.
(function (root) {
  const W = 1920, H = 1080, CX = 960, CY = 505;
  const RING = { rx: 830, ry: 335 };   // houses (up to 40)
  const ROAD = { rx: 745, ry: 265 };   // ring road
  const SQUARE_R = 205;
  const CEM = { x: 295, y: 395, w: 300, h: 220 };
  const POND = { x: 1560, y: 505, rx: 105, ry: 62 };
  const TAU = Math.PI * 2;

  function seeded(seed) {
    let s = seed >>> 0;
    return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  }

  // Append-only neighborhood slots. A population change never moves an existing slot.
  function houses(n) {
    const rng = seeded(7);
    const slots = [];
    const cols = [6, 5, 7, 4, 8, 3, 9, 2, 10, 1, 11, 0, 12];
    for (const rows of [[290, 810], [175, 925]]) {
      for (const col of cols) for (const y of rows) slots.push({ x: 96 + col * 144, y });
    }
    for (const col of [5, 6, 4, 7, 3, 8, 2, 9, 1, 10, 0, 11]) {
      for (const y of [290, 810, 175, 925]) slots.push({ x: 168 + col * 144, y });
    }
    return slots.slice(0, Math.max(0, Math.min(100, n))).map((p, k) => ({ ...p,
      t: Math.atan2(p.y - CY, p.x - CX), s: 0.72, wi: Math.floor(rng() * 64),
      ri: k, chimney: rng() > 0.4, shakeUntil: 0,
    }));
  }

  // Named camera spots.
  const SPOTS = {
    overview: { x: CX, y: H / 2, z: 1 },
    square: { x: CX, y: CY + 10, z: 1.75 },
    cemetery: { x: CEM.x + CEM.w / 2, y: CEM.y + CEM.h / 2 - 10, z: 2.1 },
    pond: { x: POND.x, y: POND.y, z: 2.2 },
    tavern: { x: 660, y: 630, z: 2.4 },
    hall: { x: 1280, y: 410, z: 2.4 },
    firepit: { x: 1280, y: 655, z: 2.4 },
  };

  // Story locations for AI-narrated deaths (Update 4). `at` is where the victim
  // stands; `water` is the lake's deep end. 'home' and 'visit' use houses instead.
  const PLACES = {
    lake: { at: { x: POND.x - POND.rx - 18, y: POND.y + 30 }, water: { x: POND.x - 30, y: POND.y + 6 }, camera: { x: POND.x - 60, y: POND.y, z: 2.4 } },
    hearth: { at: { x: 1238, y: 688 }, camera: { x: 1270, y: 650, z: 2.6 } },
    tavern: { at: { x: 712, y: 668 }, camera: { x: 680, y: 620, z: 2.5 } },
    field: { at: { x: 1780, y: 990 }, camera: { x: 1690, y: 905, z: 2.2 } },
  };
  const DEATH_PLACES = ['home', 'lake', 'hearth', 'tavern', 'field', 'chase', 'visit'];

  const API = { W, H, CX, CY, RING, ROAD, SQUARE_R, CEM, POND, TAU, seeded, houses, SPOTS, PLACES, DEATH_PLACES };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.MT_LAYOUT = API;
})(typeof window !== 'undefined' ? window : globalThis);
