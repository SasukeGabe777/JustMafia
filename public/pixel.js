// Pixel-art pipeline: the big screen draws its world into a small buffer,
// snaps every pixel to a cozy hand-picked palette (so soft edges become crisp
// pixel clusters), then upscales it with nearest-neighbor.
(function () {
  // Warm, farming-sim-ish ramps (dark -> light), hue-shifted like hand pixel art.
  const BASE = [
    // greens
    '#14261c', '#1e3a2a', '#2d5a32', '#3f7a3a', '#5a9a42', '#7cbf5a', '#a6d86a', '#d0ef8e',
    // wood / earth
    '#24160f', '#3a2418', '#4a2e1e', '#6b4428', '#8f5e34', '#b57d46', '#d9a66a', '#f0d29a', '#fbecc6',
    // stone / greys
    '#0c0c14', '#14141e', '#26283a', '#3a3d52', '#565a70', '#7a7f94', '#a3a8b8', '#cfd3dc', '#f4f2ea', '#ffffff',
    // water / sky
    '#0a1630', '#10203f', '#1d3a6a', '#2e5c99', '#4a87c9', '#74b4e6', '#b2e0f7',
    // night
    '#06070f', '#0a0c1e', '#141a3a', '#20294f', '#2f3b6a', '#4a5a8a',
    // reds
    '#2a0a0e', '#3a0e14', '#6e1a22', '#a8282e', '#d64438', '#f07858', '#ffb39a',
    // oranges / yellows
    '#4a2008', '#7a3a10', '#b8621a', '#e8962a', '#f5c518', '#ffe066', '#fff4c0',
    // purples
    '#1a0e26', '#2a1638', '#4a2660', '#6e3a8a', '#9a5ab8', '#c890e0', '#ecc8f4',
    // pinks
    '#5a1a3a', '#8a2a5a', '#c4507e', '#ff8fb1', '#ffc8da',
    // skin
    '#ffe0c4', '#f3c9a0', '#d9a273', '#a8714b', '#6b4430', '#4a2c1e',
    // teal
    '#0a2626', '#0f3a3a', '#1a6a6a', '#2aa198', '#5ad6c4', '#a8f0e0',
    // magic / sci-fi glows
    '#30fff0', '#4dff9a', '#d080ff', '#ff3434', '#ff7a20',
  ];

  const hexRgb = (h) => {
    if (typeof h !== 'string') return null;
    const m = h.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (m) {
      let s = m[1];
      if (s.length === 3) s = s.split('').map((c) => c + c).join('');
      const n = parseInt(s, 16);
      return [n >> 16, (n >> 8) & 255, n & 255];
    }
    const r = h.match(/rgba?\(([^)]+)\)/);
    if (r) { const p = r[1].split(',').map(Number); return [p[0], p[1], p[2]]; }
    return null;
  };

  // extra: colors that must survive exactly (theme + avatar colors).
  // tints: [[r,g,b], alpha] overlays (night) whose blended versions join the palette.
  function buildPalette(extra = [], tints = []) {
    const seen = new Set();
    const cols = [];
    const add = (c) => {
      if (!c) return;
      const k = (c[0] << 16) | (c[1] << 8) | c[2];
      if (seen.has(k)) return;
      seen.add(k); cols.push(c);
    };
    BASE.concat(extra).forEach((h) => add(hexRgb(h)));
    const base = cols.slice();
    for (const [rgb, a] of tints) {
      for (const c of base) add([0, 1, 2].map((i) => Math.round(c[i] * (1 - a) + rgb[i] * a)));
    }
    return cols;
  }

  // 15-bit lookup table: (r>>3, g>>3, b>>3) -> packed ABGR palette color.
  function buildLut(palette) {
    const lut = new Uint32Array(32768);
    const n = palette.length;
    const pr = new Float32Array(n), pg = new Float32Array(n), pb = new Float32Array(n);
    palette.forEach((c, i) => { pr[i] = c[0]; pg[i] = c[1]; pb[i] = c[2]; });
    for (let key = 0; key < 32768; key++) {
      const r = ((key >> 10) & 31) * 8 + 4, g = ((key >> 5) & 31) * 8 + 4, b = (key & 31) * 8 + 4;
      let best = 0, bd = Infinity;
      for (let i = 0; i < n; i++) {
        // "redmean" weighted distance: closer to how eyes judge color
        const rm = (r + pr[i]) / 2;
        const dr = r - pr[i], dg = g - pg[i], db = b - pb[i];
        const d = (2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db;
        if (d < bd) { bd = d; best = i; }
      }
      lut[key] = (255 << 24) | (pb[best] << 16) | (pg[best] << 8) | pr[best];
    }
    return lut;
  }

  function snap(ctx, w, h, lut) {
    const img = ctx.getImageData(0, 0, w, h);
    const px = new Uint32Array(img.data.buffer);
    for (let i = 0; i < px.length; i++) {
      const v = px[i];
      px[i] = lut[((v & 0xf8) << 7) | ((v >> 6) & 0x3e0) | ((v >> 19) & 0x1f)];
    }
    ctx.putImageData(img, 0, 0);
  }

  window.MTPixel = { BASE, hexRgb, buildPalette, buildLut, snap };
})();
