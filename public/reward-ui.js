// End-of-game reward scene (phone). The server already paid the gold; this shows
// it: your character, your pouch, coins flying in for each reason, and the new total.
(function () {
  const $ = (s) => document.querySelector(s);
  const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let raf = 0;

  function show(reward, { avatar, theme, onClose } = {}) {
    const box = $('#reward-scene'); if (!box || !reward) return;
    cancelAnimationFrame(raf);
    const lines = reward.lines || [];
    box.innerHTML = `<div class="reward-card">
      <h2>${reward.eligible ? 'Gold earned!' : 'Practice game'}</h2>
      <canvas class="reward-canvas" aria-label="Coins flying into your gold pouch"></canvas>
      <div class="reward-total"><b data-reward-shown>${reward.before}</b> gold <span data-reward-plus></span></div>
      ${reward.eligible ? `<ul class="list reward-lines">${lines.map((l, i) => `<li data-line="${i}" hidden><span>${esc(l.label)}</span><b>+${l.amount}</b></li>`).join('')}</ul>
        ${reward.capped ? `<p class="small muted" data-capped hidden>Capped at ${reward.capped} gold per game.</p>` : ''}`
        : `<p class="muted">No gold this time. ${esc(reward.reason || '')}</p>`}
      <button class="btn" data-reward-close>Continue</button></div>`;
    box.hidden = false; box.dataset.total = reward.coins; box.dataset.done = '';
    const cv = box.querySelector('canvas'), shown = box.querySelector('[data-reward-shown]');
    box.querySelector('[data-reward-close]').onclick = () => { cancelAnimationFrame(raf); box.hidden = true; if (onClose) onClose(); };

    // Timeline: one beat per breakdown line; each sends coins from the character to the pouch.
    const BEAT = 0.85, start = performance.now() / 1000, coins = [];
    let credited = reward.before, revealed = -1, bounce = 0;
    lines.forEach((l, i) => {
      const n = Math.min(10, Math.max(2, Math.round(l.amount / 2)));
      for (let k = 0; k < n; k++) coins.push({ t0: 0.7 + i * BEAT + k * 0.06, dur: 0.75, value: l.amount / n, line: i, landed: false, wob: Math.random() * 6 });
    });
    const scale = reward.coins && lines.length ? Math.min(1, reward.coins / lines.reduce((t, l) => t + l.amount, 0)) : 1; // honor the per-game cap
    const end = lines.length ? 0.7 + lines.length * BEAT + 1.0 : 0.8;
    const frame = () => {
      const t = performance.now() / 1000 - start;
      const dpr = Math.min(window.devicePixelRatio || 1, 3), w = cv.clientWidth || 320, h = cv.clientHeight || 180;
      if (cv.width !== Math.round(w * dpr)) { cv.width = w * dpr; cv.height = h * dpr; }
      const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.imageSmoothingEnabled = false; g.clearRect(0, 0, w, h);
      // floor + character on the left, pouch on the right (it bounces when coins land)
      g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(0, h * .86, w, 3);
      const cx = w * .26, px = w * .74, base = h * .86;
      MTArt.drawCharacter(g, cx, base, { ...(avatar || {}), expression: reward.eligible && reward.coins ? 'grin' : (avatar || {}).expression }, { scale: h / 95, theme, t, walking: false, jump: reward.eligible && t > end - 0.6 && t < end ? Math.sin((t - end + 0.6) / 0.6 * Math.PI) * 10 : 0 });
      bounce = Math.max(0, bounce - 0.08);
      window.MT_SHOP.drawPouch(g, px, base - bounce * 6, h / 42, 1);
      for (let i = 0; i < lines.length; i++) if (t >= 0.7 + i * BEAT && revealed < i) { revealed = i; const li = box.querySelector(`[data-line="${i}"]`); if (li) li.hidden = false; }
      for (const c of coins) {
        const p = (t - c.t0) / c.dur;
        if (p < 0) continue;
        if (p >= 1) { if (!c.landed) { c.landed = true; credited += c.value * scale; bounce = 1; } continue; }
        const x = cx + (px - cx) * p, y = base - h * .45 - Math.sin(p * Math.PI) * h * .35 + p * h * .28;
        window.MT_SHOP.drawCoin(g, x + Math.sin(p * 9 + c.wob) * 3, y, h / 70, t + c.wob);
      }
      const done = t >= end;
      const value = done ? reward.after : Math.min(reward.after, Math.round(credited));
      if (shown.textContent !== String(value)) shown.textContent = value;
      if (done) {
        box.querySelector('[data-reward-plus]').textContent = reward.coins ? `(+${reward.coins})` : '';
        const capped = box.querySelector('[data-capped]'); if (capped) capped.hidden = false;
        box.querySelectorAll('[data-line]').forEach((li) => { li.hidden = false; });
        box.dataset.done = '1';
      }
      if (!box.hidden && (!done || t < end + 0.7)) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
  }
  window.MT_REWARD = { show };
})();
