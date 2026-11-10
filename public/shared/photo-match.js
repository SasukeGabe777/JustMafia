// Optional local color matching. This module never transmits or retains images.
(function (root) {
  const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  function nearest(color, palette) {
    return palette.reduce((best, hex) => {
      const distance = rgb(hex).reduce((sum, v, i) => sum + (v - color[i]) ** 2, 0);
      return distance < best.distance ? { hex, distance } : best;
    }, { hex: palette[0], distance: Infinity }).hex;
  }
  function sample(data, w, h, x, y) {
    const values = [[], [], []];
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const px = Math.max(0, Math.min(w - 1, Math.round(w * x) + dx));
      const py = Math.max(0, Math.min(h - 1, Math.round(h * y) + dy));
      const i = (py * w + px) * 4;
      if (data[i + 3] < 128) continue;
      values.forEach((a, k) => a.push(data[i + k]));
    }
    return values.map((a) => a.length ? a.sort((a, b) => a - b)[Math.floor(a.length / 2)] : 128);
  }
  const API = { nearest, sample };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.MT_PHOTO = API;
})(typeof window !== 'undefined' ? window : globalThis);
