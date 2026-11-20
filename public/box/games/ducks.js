'use strict';
// JustRaiseDucks screens. TV: Duck Valley (every player's farm, live, with the season road,
// standings and a race-day hype moment), the themed side-scrolling race (zooming camera,
// commentary, live standings, slow motion for photo finishes), the results with highlights,
// and the season finale. Phone: hatch an egg, then your farm up top (tap to pet), one coach
// card with the obvious next step, and four tabs: Train, Shop, Race, My duck.
(function () {
  const { esc, timer } = BOX;
  const A = () => window.DUCK_ART;
  const SK = { run: ['🏃', 'Run', 'Hurdle Dash', '#ff8c42'], swim: ['🌊', 'Swim', 'Paddle Power', '#3ec1ff'], fly: ['🪽', 'Fly', 'Sky Rings', '#b388ff'], climb: ['🧗', 'Climb', 'Cliff Climb', '#c49a6c'], stamina: ['💪', 'Stamina', 'Bug Snack', '#2ee6a6'] };
  const GAME = { run: 'hurdles', swim: 'paddle', fly: 'rings', climb: 'climb', stamina: 'bugs' };
  const SEC = { track: ['🏃', 'Track', 'run'], pond: ['🌊', 'Pond', 'swim'], cliff: ['🧗', 'Cliff', 'climb'], gap: ['🪽', 'Ravine', 'fly'] };
  const SEC_LEN = { track: 80, pond: 60, cliff: 40, gap: 50 };
  const VAR_ICON = { hurdles: '🚧', logs: '🪵', mud: '🟤', sand: '🏖️', ice: '🧊', calm: '💧', lily: '🪷', waves: '🌊', rapids: '💨', icy: '🧊', rock: '🪨', clouds: '☁️', canyon: '🏜️' };
  const HAT_NAME = { none: 'No hat', cap: 'Cap', tophat: 'Top hat', crown: 'Crown', flower: 'Flower', shades: 'Shades', bow: 'Bow', viking: 'Viking', pirate: 'Pirate', party: 'Party', chef: 'Chef', headband: 'Headband' };
  const typeOf = (s) => s.type || s;
  const PERK_ICON = { burst: '🚀', webbed: '🦶', feather: '🪶', grip: '🧲', lungs: '🫁', lucky: '🍀', nimble: '🦘', closer: '🏁' };
  const MEDAL = ['🥇', '🥈', '🥉'];
  const ord = (n) => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th');
  const course = (c) => (c ? `<div class="dk-legs">${c.sections.map((s) => `<span class="leg ${typeOf(s)}">${SEC[typeOf(s)][0]} ${SEC[typeOf(s)][1]}${s.v ? ' ' + (VAR_ICON[s.v] || '') : ''}</span>`).join('<span class="arrow">→</span>')}</div>` : '');
  const weatherChip = (c, W) => (c && W ? `<span class="dk-weather">${W[c.weather].icon} ${W[c.weather].label}${c.wind ? (c.wind > 0 ? ' (tailwind)' : ' (headwind)') : ''}</span>` : '');
  const bar = (v, cls = '') => `<div class="bar ${cls}"><i style="width:${Math.max(0, Math.min(100, v))}%"></i></div>`;
  // The farmer: the player's own character (BOX.face / BOX.body, cached face images on the
  // canvases), or their emoji when they have none. Wild ducks have no farmer.
  const hasChar = (x) => !!(x && x.id && !x.wild && BOX.hasLook && BOX.hasLook(x));
  const who = (x, n = 28) => (hasChar(x) && BOX.face ? BOX.face(x, n) + ' ' : `${x.avatar ? esc(x.avatar) + ' ' : ''}`);
  const farmerOf = (id, d) => ({ id, name: (d && d.owner) || undefined, avatar: d && d.avatar, wild: d && d.wild });
  const FACES = new Map();
  function faceImg(x, px) {
    if (!hasChar(x) || !BOX.faceUrl) return null;
    const k = x.id + '|' + px; let e = FACES.get(k);
    if (!e) { const u = BOX.faceUrl(x, px); if (!u) return null; if (FACES.size > 200) FACES.clear(); e = Object.assign(new Image(), { src: u }); FACES.set(k, e); }
    return e.complete && e.naturalWidth ? e : null;
  }
  const road = (ladder, race) => (ladder ? `<div class="dk-road">${ladder.map((l) => `<span class="${l.done ? 'done' : ''} ${l.n === race + 1 ? 'cur' : ''} ${l.final ? 'fin' : ''}" title="${esc(l.label)}">${l.done ? '✓' : l.icon}</span>`).join('<i></i>')}</div>` : '');

  // ---------- TV state kept between updates (canvases keep animating) ----------
  const tvw = { mode: null, farms: [], fxBy: {}, born: {}, raf: 0, spot: 0, spotAt: 0, raceN: 0 };
  function loop(canvas, draw, key = 'raf') {
    cancelAnimationFrame(tvw[key]);
    const step = () => { if (!document.body.contains(canvas)) return; const W = canvas.clientWidth, H = canvas.clientHeight; if (canvas.width !== W) canvas.width = W; if (canvas.height !== H) canvas.height = H; draw(canvas.getContext('2d'), W, H, performance.now() / 1000); tvw[key] = requestAnimationFrame(step); };
    step();
  }

  // ---------- the race on the TV ----------
  const race = { R: null };
  function setupRace(s, canvas) {
    const R = s.lastRace;
    race.R = R; race.G = A().raceGeometry(R);
    race.start = Date.now() + s.endsIn - (R.intro + R.run + 6000);
    const times = R.results.map((r) => r.time);
    race.k = Math.max(times[0] / ((R.run / 1000) * 0.78), times[times.length - 1] / ((R.run / 1000) * 0.97));
    race.simT = Math.max(0, (Date.now() - race.start - R.intro) / 1000) * race.k; race.last = performance.now(); race.slowUsed = 0; race.rate = 1;
    race.photo = R.margin != null && R.margin < 0.6 && R.results.length > 1;
    race.cam = -6; race.span = 60; race.leader = null; race.msgs = []; race.cheers = []; race.cheerSaid = 0; race.seenEv = new Set(); race.finished = new Set(); race.beep = 0; race.go = false;
    race.flags = {}; race.leaderSec = -1; race.leadAt = 0; race.neckAt = 0; race.rank = {}; race.moved = {}; race.banner = null; race.confetti = []; race.firstDoneAt = 0;
    race.ducks = { ...(R.wild || {}), ...Object.fromEntries(s.farms.map((f) => [f.id, f])) };
    race.place = Object.fromEntries(R.results.map((r) => [r.id, r]));
    race.lanes = Object.fromEntries(R.tracks.map((tr, i) => [tr.id, i]));
    loop(canvas, drawRace);
  }
  const say = (text, big) => { race.msgs.push({ text, at: performance.now(), big }); if (race.msgs.length > 5) race.msgs.shift(); };
  const nm = (id) => (race.ducks[id] || {}).name || '?';
  function posAt(tr, simT) { const i = simT / race.R.sample, a = Math.floor(i); if (a >= tr.s.length - 1) return tr.s[tr.s.length - 1] / 10; return (tr.s[a] + (tr.s[a + 1] - tr.s[a]) * (i - a)) / 10; }
  const EV_ICON = { trip: 'dizzy', slip: 'alert', skid: 'swirl', boost: 'bolt' }; // drawn art (DUCK_ART.drawIcon), not emoji
  const EV_TEXT = { trip: 'trips over a jump!', slip: 'slips down the cliff!', skid: 'skids on the ice!', boost: 'catches a boost! ⚡', tired: 'is running out of steam…' };
  const SEC_SAY = { track: '🏃 {n} is back on the track!', pond: '🌊 {n} splashes into the pond first!', cliff: '🧗 {n} starts up the cliff!', gap: '🪽 {n} leaps over the ravine!' };
  function rrect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  function drawRace(g, W, H, now) {
    const R = race.R, G = race.G, art = A(), pnow = performance.now();
    const e = Date.now() - race.start;
    // The race clock: real time, slowed down near a photo finish (and never far behind the wall clock).
    const dt = Math.min(0.1, (pnow - race.last) / 1000); race.last = pnow;
    if (e < R.intro) race.simT = 0;
    else {
      const wall = ((e - R.intro) / 1000) * race.k;
      const slow = race.photo && race.leadX > G.L - 7 && !race.finished.size && race.slowUsed < 2.6;
      race.rate += ((slow ? 0.3 : 1) - race.rate) * 0.15;
      race.slowUsed += dt * (1 - race.rate);
      race.simT = Math.min(wall, Math.max(wall - 3 * race.k, race.simT + dt * race.k * race.rate));
    }
    const simT = race.simT;
    const pos = R.tracks.map((tr) => ({ id: tr.id, x: posAt(tr, simT), tr }));
    const byX = pos.slice().sort((a, b) => b.x - a.x || race.place[a.id].time - race.place[b.id].time);
    const lead = byX[0]; race.leadX = lead.x;
    const unfinished = byX.filter((p) => p.x < G.L);
    // Camera: frame the leading pack, zoom in when it's tight, hold on the line for the podium.
    let span, target;
    if (race.finished.size && (race.finished.size < 3 || pnow - race.firstDoneAt < 2500) && unfinished.length) { span = 42; target = G.L - span * 0.72; }
    else {
      const pack = (unfinished.length ? unfinished : byX).slice(0, 4), hi = pack[0].x, lo = pack[pack.length - 1].x;
      span = Math.max(44, Math.min(74, hi - lo + 28));
      if (race.rate < 0.9) span = 34;
      target = hi - span * 0.7;
    }
    race.span += (span - race.span) * 0.03;
    const PX = W / race.span;
    target = Math.max(-6, Math.min(G.L - race.span * 0.82, target));
    race.cam += (target - race.cam) * 0.08;
    const VPX = W / 66, base = art.drawRaceWorld(g, W, H, R, G, race.cam, PX, now, VPX);
    const LANES = Math.min(10, R.tracks.length), order = pos.slice().sort((a, b) => (race.lanes[b.id] % LANES) - (race.lanes[a.id] % LANES));
    const labelled = new Set(byX.slice(0, 6).map((p) => p.id));
    const zoom = Math.max(0.9, Math.min(1.35, PX / (W / 60)));
    for (const p of order) {
      const d = race.ducks[p.id] || {}, lane = race.lanes[p.id] % LANES, done = p.x >= G.L;
      const x = (Math.min(p.x, G.L) + (done ? Math.min(6, (race.place[p.id].place - 1) * 0.5) : 0) - race.cam) * PX;
      if (x < -80 || x > W + 80) continue;
      const gr = art.groundAt(G, Math.min(p.x, G.L - 0.01));
      const ev = p.tr.ev.filter(([t]) => t <= simT && simT - t < 1.2).map(([, k]) => k);
      const tired = p.tr.ev.some(([t, k]) => k === 'tired' && t <= simT) && !done;
      const y = base - gr.h * VPX * 0.9 - lane * 7 * zoom + (gr.type === 'pond' ? 8 : -18) * zoom;
      const sc = Math.max(0.6, 1.25 - lane * 0.04) * Math.min(1.3, W / 1400) * zoom;
      const mode = done ? 'stand' : ev.includes('trip') || ev.includes('skid') ? 'stand' : gr.mode;
      art.drawDuck(g, x, y, sc, d.color, d.hat, (now + lane * 0.37) * (race.rate < 0.9 ? 0.35 : 1), mode, false, d.stage == null ? 2 : Math.max(0, d.stage));
      g.textAlign = 'center';
      const evk = ev.find((k) => k !== 'tired');
      if (evk && EV_ICON[evk]) art.drawIcon(g, EV_ICON[evk], x, y - 42 * sc, 26 * sc, now);
      else if (tired) art.drawIcon(g, 'sweat', x - 20 * sc, y - 30 * sc, 18 * sc, now);
      if (labelled.has(p.id) || (done && race.place[p.id].place <= 3)) {
        g.font = `600 ${Math.min(20, 13 * sc)}px Fredoka, sans-serif`;
        const fim = faceImg(farmerOf(p.id, d), 64);
        const label = (done ? MEDAL[race.place[p.id].place - 1] || '#' + race.place[p.id].place : '') + ' ' + (d.avatar && !fim ? d.avatar + ' ' : '') + (d.name || '') + (d.wild ? ' 🌿' : '');
        const fh = Math.min(26, 17 * sc), fw = fim ? fh * 1.5 : 0, tw = g.measureText(label).width + 12 + fw * 0.8, ly = y - (52 + (lane % 3) * 18) * sc;
        g.fillStyle = d.wild ? 'rgba(40,70,30,.75)' : 'rgba(0,0,0,.62)'; rrect(g, x - tw / 2, ly, tw, fh, 6); g.fill(); g.fillStyle = '#fff'; g.fillText(label, x + fw * 0.4, ly + fh * 0.76);
        if (fim) g.drawImage(fim, x - tw / 2 + 1, ly + fh - fw * 0.92, fw, fw);
      }
      g.textAlign = 'left';
      for (const c of race.cheers) if (c.id === p.id) { const age = (pnow - c.at) / 1000; if (age < 1.5) { g.globalAlpha = 1 - age / 1.5; art.drawIcon(g, 'megaphone', x + Math.sin(age * 8 + c.at) * 10, y - 66 * sc - age * 40, 24 * sc, age); g.globalAlpha = 1; } }
      for (const [t, k] of p.tr.ev) {
        const key = p.id + t + k; if (t > simT || race.seenEv.has(key)) continue;
        race.seenEv.add(key);
        const show = k === 'boost' ? labelled.has(p.id) && Math.random() < 0.5 : k === 'tired' ? p.id === race.leader : labelled.has(p.id) || R.tracks.length <= 12;
        if (show) say(`${d.name} ${EV_TEXT[k]}`);
      }
      if (done && !race.finished.has(p.id)) {
        race.finished.add(p.id); const pl = race.place[p.id].place;
        if (pl === 1) {
          race.firstDoneAt = pnow; BOX.sfx('cheer'); BOX.sfx('win');
          const second = R.results[1] && race.ducks[R.results[1].id];
          race.banner = { at: pnow, text: `🏆 ${d.name} WINS!`, sub: race.photo && second ? `📸 Photo finish: ahead of ${second.name} by ${R.margin.toFixed(2)}s` : d.wild ? 'A wild duck takes it!' : (d.owner ? 'Raised by ' + d.owner : '') };
          say(race.photo && second ? `📸 PHOTO FINISH! ${d.name} beats ${second.name} by a beak!` : `🏆 ${d.name} WINS the ${R.name}!`, true);
          for (let i = 0; i < 140; i++) race.confetti.push({ x: Math.random() * W, y: -Math.random() * H * 0.5, vy: 120 + Math.random() * 160, vx: (Math.random() - 0.5) * 60, c: ['#ffd23f', '#ff4f9a', '#3ec1ff', '#2ee6a6', '#fff'][i % 5], r: Math.random() * 6 });
        } else if (pl <= 3) say(`${['', '🥈', '🥉'][pl - 1]} ${d.name} takes ${pl === 2 ? 'second' : 'third'}!`);
      }
    }
    // Commentary from the race state: lead changes, sections, neck and neck, halfway, final stretch.
    if (e > R.intro && lead.x < G.L) {
      if (race.leader !== lead.id) {
        if (race.leader && pnow - race.leadAt > 900) say(`${(race.ducks[lead.id] || {}).wild ? '🌿 Wild duck ' : ''}${nm(lead.id)} takes the lead!`);
        race.leader = lead.id; race.leadAt = pnow;
      }
      const si = G.secs.findIndex((q) => lead.x >= q.a && lead.x < q.b);
      if (si > 0 && si !== race.leaderSec) say(SEC_SAY[G.secs[si].type].replace('{n}', nm(lead.id)));
      race.leaderSec = si;
      const b = unfinished[1];
      if (b && lead.x - b.x < 0.8 && pnow - race.neckAt > 6000 && pnow - race.leadAt > 1500) { race.neckAt = pnow; say(`⚔️ ${nm(lead.id)} and ${nm(b.id)} are neck and neck!`); }
      if (!race.flags.half && lead.x > G.L / 2) { race.flags.half = true; say(`Halfway! ${nm(lead.id)} leads${b ? ' by ' + Math.max(0.1, lead.x - b.x).toFixed(1) + ' m' : ''}.`); }
      if (!race.flags.stretch && lead.x > G.L - 18) { race.flags.stretch = true; say(race.photo ? '🏁 Final stretch… this is going to be CLOSE!' : '🏁 Final stretch!', true); if (race.photo) BOX.sfx('drum'); }
    }
    // Live standings with ▲ ▼ when ducks pass each other.
    const top = byX.slice(0, 8);
    top.forEach((p, i) => { const was = race.rank[p.id]; if (was != null && was !== i && e > R.intro + 1500) race.moved[p.id] = { up: was > i, at: pnow }; });
    byX.forEach((p, i) => { race.rank[p.id] = i; });
    const bw = 270, bx = W - bw - 16, by = 52, rh = 28;
    g.fillStyle = 'rgba(15,8,35,.72)'; rrect(g, bx, by, bw, 34 + top.length * rh, 12); g.fill();
    g.font = '700 15px Fredoka, sans-serif'; g.fillStyle = '#ffd23f'; g.fillText(R.final ? 'GRAND FINAL · LIVE' : 'LIVE STANDINGS', bx + 12, by + 22);
    top.forEach((p, i) => {
      const d = race.ducks[p.id] || {}, yy = by + 48 + i * rh, done = p.x >= G.L, mv = race.moved[p.id];
      if (i === 0) { g.fillStyle = 'rgba(255,210,63,.18)'; g.fillRect(bx + 4, yy - 19, bw - 8, rh - 2); }
      g.fillStyle = (art.PAL[d.color] || art.PAL.sunny)[0]; g.beginPath(); g.arc(bx + 34, yy - 6, 7, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#fff'; g.font = '700 15px Fredoka, sans-serif'; g.fillText(String(i + 1), bx + 10, yy);
      const fim = faceImg(farmerOf(p.id, d), 48);
      if (fim) g.drawImage(fim, bx + 44, yy - 21, 26, 26);
      g.font = '600 15px Fredoka, sans-serif'; g.fillText(`${d.avatar && !fim ? d.avatar + ' ' : ''}${(d.name || '').slice(0, 16)}${d.wild ? ' 🌿' : ''}`, bx + (fim ? 74 : 48), yy, bw - (fim ? 146 : 120));
      g.textAlign = 'right'; g.fillStyle = done ? '#ffd23f' : 'rgba(255,255,255,.7)'; g.font = '600 13px Fredoka, sans-serif';
      g.fillText(done ? (MEDAL[race.place[p.id].place - 1] || 'FIN') : e < R.intro ? '' : i === 0 ? 'leader' : lead.x - p.x < 0.05 ? 'level' : '-' + (lead.x - p.x).toFixed(1) + 'm', bx + bw - 26, yy);
      if (mv && pnow - mv.at < 1600) { g.fillStyle = mv.up ? '#5be37a' : '#ff6a5c'; g.fillText(mv.up ? '▲' : '▼', bx + bw - 8, yy); }
      g.textAlign = 'left';
    });
    // minimap with every duck
    const mx = 20, mw = W - bw - 70, my = 14;
    g.fillStyle = 'rgba(0,0,0,.45)'; rrect(g, mx - 6, my - 6, mw + 12, 30, 8); g.fill();
    for (const s of G.secs) { g.fillStyle = art.SEC_COLORS[s.type]; g.fillRect(mx + (s.a / G.L) * mw, my, ((s.b - s.a) / G.L) * mw, 18); }
    g.fillStyle = '#fff'; g.fillRect(mx + mw - 3, my - 3, 3, 24);
    for (const p of byX.slice().reverse()) { const d = race.ducks[p.id] || {}; g.fillStyle = (art.PAL[d.color] || art.PAL.sunny)[0]; g.strokeStyle = 'rgba(0,0,0,.5)'; g.lineWidth = 1.5; g.beginPath(); g.arc(mx + Math.min(1, p.x / G.L) * mw, my + 9, p.id === lead.id ? 7 : 5, 0, Math.PI * 2); g.fill(); g.stroke(); }
    // cinematic bars in slow motion
    if (race.rate < 0.9) { const k = (1 - race.rate) / 0.7, hb = H * 0.08 * k; g.fillStyle = '#000'; g.fillRect(0, 0, W, hb); g.fillRect(0, H - hb, W, hb); g.globalAlpha = k; g.fillStyle = '#ffd23f'; g.font = '800 28px Fredoka, sans-serif'; g.textAlign = 'center'; g.fillText('📸 PHOTO FINISH', W / 2, hb - 14 > 20 ? hb - 14 : 40); g.textAlign = 'left'; g.globalAlpha = 1; if (!race.flags.whoosh) { race.flags.whoosh = true; BOX.sfx('whoosh'); } }
    // commentary: the newest line big, two older ones above it
    const live = race.msgs.filter((m) => pnow - m.at < 5500).slice(-3);
    g.textAlign = 'center';
    live.forEach((m, i) => {
      const newest = i === live.length - 1, size = newest ? (m.big ? 34 : 28) : 20, yy = H - 64 - (live.length - 1 - i) * 40 - (newest ? 0 : 10);
      g.font = `700 ${size}px Fredoka, sans-serif`; const tw = g.measureText(m.text).width + 36;
      const fade = Math.min(1, (5500 - (pnow - m.at)) / 600); g.globalAlpha = (newest ? 1 : 0.7) * fade;
      g.fillStyle = newest ? 'rgba(20,10,40,.86)' : 'rgba(20,10,40,.6)'; rrect(g, W / 2 - tw / 2, yy - size - 8, tw, size + 18, 12); g.fill();
      g.fillStyle = newest && m.big ? '#ffd23f' : '#fff'; g.fillText(m.text, W / 2, yy);
    });
    g.globalAlpha = 1; g.textAlign = 'left';
    // winner banner and confetti
    if (race.banner && pnow - race.banner.at < 3800) {
      const a = Math.min(1, (pnow - race.banner.at) / 250), s = 0.8 + 0.2 * a;
      g.save(); g.translate(W / 2, H * 0.3); g.scale(s, s); g.globalAlpha = Math.min(1, (3800 - (pnow - race.banner.at)) / 500);
      g.textAlign = 'center'; g.font = '800 64px Fredoka, sans-serif'; g.lineWidth = 10; g.strokeStyle = 'rgba(40,20,6,.85)'; g.strokeText(race.banner.text, 0, 0); g.fillStyle = '#ffd23f'; g.fillText(race.banner.text, 0, 0);
      if (race.banner.sub) { g.font = '700 26px Fredoka, sans-serif'; g.lineWidth = 6; g.strokeText(race.banner.sub, 0, 44); g.fillStyle = '#fff'; g.fillText(race.banner.sub, 0, 44); }
      g.restore();
    }
    if (race.confetti.length) { for (const c of race.confetti) { c.y += c.vy * dt; c.x += c.vx * dt; c.r += dt * 6; g.fillStyle = c.c; g.save(); g.translate(c.x, c.y); g.rotate(c.r); g.fillRect(-5, -3, 10, 6); g.restore(); } race.confetti = race.confetti.filter((c) => c.y < H + 20); }
    // the intro: race name, favorites and the countdown
    if (e < R.intro) {
      g.fillStyle = R.theme === 'night' ? 'rgba(0,0,10,.55)' : 'rgba(10,5,30,.5)'; g.fillRect(0, 0, W, H); g.textAlign = 'center'; g.fillStyle = '#fff';
      g.font = '700 28px Fredoka, sans-serif'; g.fillText(`${R.themeName || ''} · race ${R.n}${R.final ? ' · DOUBLE POINTS' : ''}`, W / 2, H * 0.17);
      g.font = '800 60px Fredoka, sans-serif'; g.fillStyle = R.final ? '#ffd23f' : '#fff'; g.fillText((R.final ? '🏆 ' : '') + R.name, W / 2, H * 0.27);
      const fav = (R.favorites || []).filter((id) => race.ducks[id]);
      if (fav.length) {
        g.font = '700 22px Fredoka, sans-serif'; g.fillStyle = '#ffeccd'; g.fillText('THE FAVORITES', W / 2, H * 0.36);
        fav.forEach((id, i) => {
          const d = race.ducks[id], cx = W / 2 + (i - (fav.length - 1) / 2) * 220, fm = farmerOf(id, d);
          // the farmer stands behind their duck (their own character)
          const drew = hasChar(fm) && BOX.drawChar && BOX.drawChar(g, cx + 46, H * 0.47 + 26, fm, { scale: 1.45, t: now + i, facing: -0.6, game: 'ducks' });
          art.drawDuck(g, drew ? cx - 22 : cx, H * 0.47, 2.2, d.color, d.hat, now + i, 'stand', false, d.stage == null ? 2 : Math.max(0, d.stage));
          g.font = '700 20px Fredoka, sans-serif'; g.fillStyle = '#fff'; g.fillText(`${i + 1}. ${d.avatar && !drew ? d.avatar + ' ' : ''}${d.name}`, cx, H * 0.47 + 50);
        });
      }
      const left = Math.ceil((R.intro - e) / 1000);
      if (left <= 3) { g.font = '800 140px Fredoka, sans-serif'; g.fillStyle = '#ffd23f'; g.fillText(String(left), W / 2, H * 0.8); if (race.beep !== left) { race.beep = left; BOX.sfx('tick'); } }
      g.textAlign = 'left';
    } else if (!race.go) { race.go = true; BOX.sfx('start'); say('QUACK! And they’re off!', true); }
  }

  // ---------- Duck Valley on the TV ----------
  function drawValley(g, W, H, now) { A().drawValley(g, W, H, tvw.farms, now, tvw.fxBy, tvw.born, tvw.weather); }
  function spotlight(s) {
    const farms = s.farms.filter((f) => f.stage >= 0);
    if (!farms.length) return '<p class="muted">Eggs are about to hatch…</p>';
    if (Date.now() - tvw.spotAt > 7000) { tvw.spot = (tvw.spot + 1) % farms.length; tvw.spotAt = Date.now(); }
    const f = farms.slice().sort((a, b) => a.plot - b.plot)[tvw.spot % farms.length];
    const L = f.levels;
    return `<div class="dk-spot"><img src="${A().duckImg(f.color, f.hat, 'stand', f.stage)}" alt=""><div><b>${esc(f.name)}</b><div class="muted">${who(f)}${esc(f.owner)} · ${esc(f.stageName)} ${A().MOOD(f.mood)}</div>
      ${Object.entries(SK).map(([k, [ic]]) => `<div class="dk-mini"><span>${ic}</span>${bar(L[k] * 4)}<b>${L[k]}</b></div>`).join('')}
      ${f.perks && f.perks.length ? `<div class="dk-perkicons">${f.perks.map((k) => (PERK_ICON[k] || '')).join(' ')}</div>` : ''}${f.streak > 2 ? `<div>🔥 streak ×${f.streak}</div>` : ''}<div class="muted">${f.trophies.length ? '🏆×' + f.trophies.length + ' · ' : ''}${f.badges ? '🏅×' + f.badges + ' · ' : ''}${Object.values(f.buildings).reduce((a, b) => a + b, 0)} upgrades</div></div></div>`;
  }
  const duckPic = (d, hat, stage) => `<img src="${A().duckImg(d.color, hat || d.hat, 'stand', stage != null ? stage : d.stage == null ? 2 : Math.max(0, d.stage))}" alt="">`;

  // ---------- phone ----------
  let tab = 'train', shopCat = 'food';
  const petFx = [];
  const hero = { canvas: null, farm: null, raf: 0 };
  function heroCanvas() {
    if (!hero.canvas) {
      hero.canvas = document.createElement('canvas'); hero.canvas.className = 'dk-herocv';
      let lastDraw = 0;
      const step = (t = 0) => {
        const c = hero.canvas;
        // ~24 fps is plenty for the farm; pause entirely while a mini-game is open.
        if (t - lastDraw < 40 || document.querySelector('.dk-over') || document.hidden) { hero.raf = requestAnimationFrame(step); return; }
        lastDraw = t;
        if (document.body.contains(c) && hero.farm) {
          const W = c.clientWidth, H = c.clientHeight, dpr = Math.min(2, window.devicePixelRatio || 1);
          if (W < 40 || H < 40) { hero.raf = requestAnimationFrame(step); return; } // hidden or not laid out yet
          if (c.width !== Math.round(W * dpr) || c.height !== Math.round(H * dpr)) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); }
          const g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
          g.fillStyle = '#5fb04a'; g.fillRect(0, 0, W, H);
          A().drawFarm(g, { ...hero.farm, owner: '' }, -W * 0.03, -H * 0.03, W * 1.06, H * 1.06, performance.now() / 1000, petFx);
        }
        hero.raf = requestAnimationFrame(step);
      };
      step();
    }
    return hero.canvas;
  }
  let hatching = null, petted = false, sheet = null, questsOpen = false, sheetDiff = 'medium', lastPet = 0;
  // The farm picture with only what matters on it: name, stage, coins; energy and mood underneath.
  function heroHtml(v) {
    const d = v.duck, st = d.stage >= 0 ? v.stages[d.stage] : null;
    return `<div class="dk-hero"><div id="dk-hero-slot" data-keep></div>
      <div class="dk-hero-top"><span class="pill name">${esc(d.name)} <small>${st ? esc(st.label) : '🥚'}</small></span>${v.streak ? `<span class="pill streak">🔥 ×${v.streak}</span>` : ''}<span class="pill coins">🪙 ${d.coins}</span></div>
      ${petted ? '' : '<div class="dk-tap">👆 tap to pet</div>'}
      <div class="dk-hero-meters"><div title="Energy">⚡${bar(d.energy, d.energy < 20 ? 'low' : '')}</div><div title="Mood">${A().MOOD(d.mood)}${bar(d.mood, 'mood')}</div></div></div>`;
  }
  // Which skill helps most for the next race: the course's biggest share against your level.
  function coachSkill(v, d) {
    const share = { run: 0, swim: 0, fly: 0, climb: 0, stamina: 0 }; let tot = 0;
    for (const s of v.course.sections) { const t = typeOf(s); share[SEC[t][2]] += SEC_LEN[t]; tot += SEC_LEN[t]; }
    for (const k in share) share[k] /= tot || 1;
    share.stamina = 0.1 + 0.025 * v.course.sections.length;
    let best = 'run', bs = -1;
    for (const k of Object.keys(SK)) { const sc = share[k] / (1 + d.levels[k]); if (sc > bs) { bs = sc; best = k; } }
    return { skill: best, share: Math.round(share[best] * 100) };
  }
  // One card, one obvious next step.
  function coachHtml(v, d) {
    const cheapest = Math.min(...Object.values(v.diffs).map((x) => x.cost));
    const spin = v.canSpin ? '<button class="dk-spinchip" data-spin>🎡<small>Free spin</small></button>' : '';
    const proj = v.projected && v.projected.of > 1 && v.projected.place ? `<span class="dk-proj">Projected ${ord(v.projected.place)} of ${v.projected.of}</span>` : '';
    let main;
    if (v.napLeft) main = `<div class="dk-coach-main"><span class="ic">💤</span><span><b>Napping…</b><small>Wakes up in ${timer(v.napLeft)} with more energy</small></span></div>`;
    else if (v.hype) main = `<div class="dk-coach-main hype"><span class="ic">🏁</span><span><b>Race in ${timer(v.endsIn)}!</b><small>Last call: pick your tactic</small></span>${proj}</div><div class="dk-qtac">${Object.entries(v.tactics).map(([k, [ic, l]]) => `<button data-qtactic="${k}" class="${d.tactic === k ? 'on' : ''}">${ic} ${esc(l)}</button>`).join('')}</div>`;
    else if (d.energy < cheapest) {
      const food = d.coins >= v.food.corn.cost ? 'corn' : d.coins >= v.food.seeds.cost ? 'seeds' : null;
      main = `<div class="dk-coach-main"><span class="ic">😴</span><span><b>Your duck is tired</b><small>Feed it or take a free nap</small></span></div><div class="dk-qtac">${food ? `<button data-feed="${food}">${v.food[food].icon} ${esc(v.food[food].label)} · 🪙${v.food[food].cost}</button>` : ''}<button data-coach="nap">💤 Nap · free</button></div>`;
    } else {
      const c = coachSkill(v, d), [ic, label, , color] = SK[c.skill];
      const why = c.skill === 'stamina' ? 'Keeps your duck fast to the finish' : `${c.share}% of the next race · Lv ${d.levels[c.skill]}`;
      main = `<button class="dk-coach-go" data-coach-train="${c.skill}" style="--c:${color}"><span class="ic">${ic}</span><span><b>Train ${label}</b><small>${why}</small></span><span class="go">▶</span></button>${proj ? `<div class="dk-coach-sub">${proj}</div>` : ''}`;
    }
    return `<div class="dk-coach ${v.hype ? 'hype' : ''}"><div class="dk-coach-body">${main}</div>${spin}</div>`;
  }
  // Skill sheet: one row to choose Easy, Medium or Hard, one line about it, one Play button.
  function sheetHtml(v, d) {
    const k = sheet, [icon, label, game, color] = SK[k], best = v.bests[k] || {};
    const D = v.diffs[sheetDiff];
    const segs = Object.entries(v.diffs).map(([dk, x]) => `<button class="dk-diff ${sheetDiff === dk ? 'on' : ''} ${dk}" data-diff="${dk}" ${d.energy < x.cost ? 'disabled' : ''}><span class="dn">${x.icon} ${x.label}</span><span class="dc">⚡${x.cost}</span></button>`).join('');
    return `<div class="dk-sheet-bg" data-close></div><div class="dk-sheet" style="--c:${color}">
      <div class="dk-sheet-head"><span class="big">${icon}</span><div><b>${label} · Lv ${d.levels[k]}${v.gene && v.gene.skill === k ? ' 🧬' : ''}</b><div class="muted">${game}</div></div><button class="link" data-close aria-label="Close">✕</button></div>
      <div class="dk-diffs">${segs}</div>
      <p class="dk-diffinfo"><b>×${D.mult} XP</b> · ⭐ target ${D.target}${best[sheetDiff] ? ` · best ${best[sheetDiff]}` : ''}<br><small>${esc(D.about)}</small></p>
      <button class="btn big green dk-play" data-play ${d.energy < D.cost ? 'disabled' : ''}>▶ Play ${D.label}</button>
      <p class="muted dk-streakline">${v.streak ? `🔥 Streak ×${v.streak}: hit ⭐ again for +${Math.min(6, v.streak + 1) * 5}% XP` : 'Hit the ⭐ target to start a streak (up to +30% XP).'}</p></div>`;
  }
  function perkModal(v) {
    return `<div class="dk-perks"><h2>🌱 Your duck grew up!</h2><p class="muted">Pick a perk. It stays for the whole season.</p>${v.perkChoice.map((p) => `<button class="dk-perk" data-perk="${p.key}"><span>${p.icon}</span><b>${esc(p.label)}</b><small>${esc(p.about)}</small></button>`).join('')}</div>`;
  }
  // Lucky Spin: a wheel drawn on top of the page (outside the re-rendered body).
  function spinWheel(v, ctx) {
    if (document.querySelector('.dk-wheel-ov')) return;
    const ov = document.createElement('div'); ov.className = 'dk-wheel-ov';
    const n = v.spinTable.length, seg = 360 / n;
    const cols = ['#ff4f9a', '#ffd23f', '#3ec1ff', '#2ee6a6', '#b388ff', '#ff8c42', '#7bc96f', '#f25f5c', '#c49a6c'];
    const grad = v.spinTable.map((_, i) => `${cols[i % cols.length]} ${i * seg}deg ${(i + 1) * seg}deg`).join(',');
    ov.innerHTML = `<div class="dk-wheel-box"><h2>🎡 Lucky Spin</h2><div class="dk-wheel-wrap"><div class="dk-pointer">▼</div><div class="dk-wheel" style="background:conic-gradient(${grad})">${v.spinTable.map((x, i) => `<span style="transform:rotate(${i * seg + seg / 2}deg) translateY(var(--r))">${x.icon}</span>`).join('')}</div></div><p class="dk-prize">Spinning…</p></div>`;
    document.body.appendChild(ov);
    ctx.sfx('shuffle');
    ctx.act({ op: 'spin' }).then((r) => {
      if (!r.ok) { ov.remove(); return; }
      const wheel = ov.querySelector('.dk-wheel');
      const to = 360 * 5 + (360 - (r.index * seg + seg / 2));
      requestAnimationFrame(() => { wheel.style.transform = `rotate(${to}deg)`; });
      setTimeout(() => { ov.querySelector('.dk-prize').innerHTML = `${r.icon} <b>${esc(r.prize)}</b><br><button class="btn big">Collect</button>`; ctx.sfx('win'); ctx.vibrate(80); ov.querySelector('button').onclick = () => ov.remove(); }, 3300);
    });
    ov.addEventListener('click', (e) => { if (e.target === ov && ov.querySelector('.dk-prize button')) ov.remove(); });
  }
  function eventCard(v) {
    const e = v.event; if (!e) return '';
    return `<div class="card-box dk-event"><b>${{ fox: '🦊', gift: '🎁', trader: '🛒', storm: '🌧️', duckling: '🐣' }[e.kind]} ${esc(e.text)}</b> <span class="muted">${timer(e.endsIn)}</span><div class="pr-btns">${e.choices.map(([k, l]) => `<button class="btn" data-ev="${k}">${esc(l)}</button>`).join('')}</div></div>`;
  }
  const ring = (lvl, pct, color) => `<div class="dk-ring" style="background:conic-gradient(${color} ${pct}%, rgba(255,255,255,.12) 0)"><span>${lvl}</span></div>`;
  const shopItem = (icon, title, about, price, attrs, state = '') => `<button class="dk-card2 ${state}" ${attrs}><span class="ic">${icon}</span><b>${esc(title)}</b><small>${esc(about)}</small><span class="price">${price}</span></button>`;

  function pageTrain(v, d) {
    const needs = [...new Set(v.course.sections.map((s) => SEC[typeOf(s)][2]))];
    const done = (v.quests || []).filter((q) => q.done).length;
    const quests = v.quests && v.quests.length ? `<div class="card-box dk-quests ${questsOpen ? 'open' : ''}"><button class="dk-qhead" data-quests><b>📜 Quests ${done}/${v.quests.length}</b>${v.rival ? `<span class="muted">⚔️ ${esc(v.rival.name)}</span>` : ''}<span>${questsOpen ? '▲' : '▼'}</span></button>
      ${questsOpen ? v.quests.map((q) => `<div class="q ${q.done ? 'done' : ''}"><span>${q.done ? '✅' : '⬜'} ${esc(q.text)}</span><span class="muted">${q.done ? 'done' : q.have + '/' + q.n} · 🪙${q.reward}</span></div>`).join('') + (v.rival ? `<div class="q rival">⚔️ Beat <b>${esc(v.rival.name)}</b> <span class="muted">(${esc(v.rival.owner)})</span> next race for 🪙15</div>` : '') : ''}</div>` : '';
    return `${coachHtml(v, d)}
      <div class="dk-skillgrid">${Object.entries(SK).map(([k, [icon, label, game, color]]) => { const p = d.progress[k], pct = p ? Math.round((p.have / p.need) * 100) : 100; return `<button class="dk-skill ${needs.includes(k) ? 'need' : ''}" style="--c:${color}" data-sheet="${k}" ${v.napLeft ? 'disabled' : ''}>${ring(d.levels[k], pct, color)}<span class="t"><b>${icon} ${label}${v.gene && v.gene.skill === k ? ' 🧬' : ''}</b><small>${game}</small></span>${needs.includes(k) ? '<i class="needmark" title="On the next course">🏁</i>' : ''}</button>`; }).join('')}
        <button class="dk-skill nap" id="dk-nap" ${v.napLeft ? 'disabled' : ''}><div class="dk-ring" style="background:#3b2a6b"><span>💤</span></div><span class="t"><b>Nap</b><small>${v.napSeconds}s · free ⚡</small></span></button></div>
      ${quests}${sheet ? sheetHtml(v, d) : ''}`;
  }
  function pageShop(v, d) {
    const cats = [['food', '🍎 Food'], ['farm', '🏡 Farm'], ['decor', '🌷 Decor'], ...(v.gear ? [['gear', '🎒 Gear']] : []), ['hats', '🎩 Hats']];
    let items = '';
    if (shopCat === 'food') items = Object.entries(v.food).map(([k, it]) => shopItem(it.icon, it.label, it.about, `🪙 ${it.cost}`, `data-feed="${k}" ${d.coins < it.cost ? 'disabled' : ''}`)).join('');
    if (shopCat === 'farm') items = Object.entries(v.buildings).map(([k, b]) => { const lvl = d.buildings[k], cost = v.buildCost[lvl]; return shopItem(b.icon, `${b.label} ${'★'.repeat(lvl)}${'☆'.repeat(3 - lvl)}`, b.about, lvl >= 3 ? 'MAX' : (lvl ? 'Upgrade ' : 'Build ') + '🪙' + cost, `data-build="${k}" ${lvl >= 3 || d.coins < cost ? 'disabled' : ''}`, lvl >= 3 ? 'owned' : ''); }).join('');
    if (shopCat === 'decor') items = Object.entries(v.decor).map(([k, [ic, label, cost]]) => shopItem(ic, label, 'Shows on your farm · +5 mood', d.decor.includes(k) ? 'Placed ✓' : '🪙 ' + cost, `data-decor="${k}" ${d.decor.includes(k) || d.coins < cost ? 'disabled' : ''}`, d.decor.includes(k) ? 'owned' : '')).join('');
    if (shopCat === 'gear' && v.gear) items = Object.entries(v.gear).map(([k, it]) => shopItem(it.icon, it.label, it.about, d.gear.includes(k) ? 'Packed ✓' : '🪙 ' + it.cost, `data-gear="${k}" ${d.gear.includes(k) || d.coins < it.cost ? 'disabled' : ''}`, d.gear.includes(k) ? 'owned' : '')).join('');
    if (shopCat === 'hats') items = v.hats.filter((h) => h !== 'none').map((h) => `<button class="dk-card2 hat ${d.hat === h ? 'owned' : ''}" data-hat="${h}"><img src="${A().duckImg(d.color, h, 'stand', Math.max(0, d.stage))}" alt=""><b>${HAT_NAME[h]}</b><span class="price">${d.hat === h ? 'Wearing' : d.hats.includes(h) ? 'Wear' : '🪙 ' + v.hatCost}</span></button>`).join('');
    return `<div class="dk-chips">${cats.map(([k, l]) => `<button class="${shopCat === k ? 'on' : ''}" data-cat="${k}">${l}</button>`).join('')}</div><div class="dk-shopgrid">${items}</div>`;
  }
  function pageRace(v, d) {
    const W = v.weather[v.course.weather], c = v.course;
    return `<div class="card-box dk-racecard theme-${c.theme}"><div class="muted">${c.leagueIcon || ''} ${esc(c.leagueName || '')} · race ${c.n} of ${v.races}${c.final ? ' · <b class="dk-x2">×2 points</b>' : ''}</div><h3>${esc(c.name)}</h3>
        <div class="dk-racemeta"><span>📍 ${esc(c.themeName || '')}</span><span>${W.icon} ${W.label}</span><span>⏱ ${timer(v.endsIn)}</span></div>
        ${course(c)}
        <details class="dk-notes"><summary>What’s on the course?</summary><p>${W.icon} ${esc(W.about)}</p>${[...new Set(c.sections.map((s) => s.v))].map((k) => `<p>${VAR_ICON[k] || ''} ${esc((v.variants || {})[k] || '')}</p>`).join('')}</details>
        ${road(v.ladder, c.n - 1)}
        ${v.projected && v.projected.of > 1 && v.projected.place ? `<div class="dk-projcard">📈 Projected <b>${ord(v.projected.place)}</b> of ${v.projected.of}${v.projected.place > 1 ? ' · train the 🏁 skills to climb' : ' · you’re the favorite!'}</div>` : ''}</div>
      <h3>Tactic</h3><div class="dk-tactics">${Object.entries(v.tactics).map(([k, [ic, l, about]]) => `<button data-tactic="${k}" class="${d.tactic === k ? 'on' : ''}"><span>${ic}</span><b>${l}</b><small>${esc(about)}</small></button>`).join('')}</div>
      ${v.gear ? `<div class="dk-line"><span>🎒 ${d.gear.length ? d.gear.map((g) => v.gear[g].icon + ' ' + esc(v.gear[g].label)).join(' · ') : 'No race gear packed'}</span><button class="link" data-goshop="gear">Shop →</button></div>` : ''}
      ${v.predictions ? `<h3>🔮 Predict the winner</h3><p class="muted">Winner pays 30 coins, top 3 pays 10.</p><select id="dk-predict" class="dk-select"><option value="">Pick a duck…</option>${v.rivals.map((r) => `<option value="${esc(r.id)}" ${d.predict === r.id ? 'selected' : ''}>${esc(r.duck)} (${esc(r.owner)})</option>`).join('')}</select>` : ''}
      ${v.trophies.length ? `<h3>🏆 Trophy shelf</h3><div class="dk-trophies">${v.trophies.map((t) => `<span title="${esc(v.leagues[t.league].label)}">${['🏆', '🥈', '🥉'][t.place - 1]}<small>${esc(v.leagues[t.league].label)}</small></span>`).join('')}</div>` : ''}`;
  }
  function pageDuck(v, d) {
    const total = Object.values(d.levels).reduce((a, b) => a + b, 0), nextSt = d.stage >= 0 ? v.stages[d.stage + 1] : null, curSt = v.stages[Math.max(0, d.stage)];
    const growPct = nextSt ? Math.round(((total - curSt.from) / (nextSt.from - curSt.from)) * 100) : 100;
    const icons = ['🐣', '🐥', '🦆', '👑'];
    return `<div class="card-box dk-grow"><div class="dk-stages">${v.stages.map((s, i) => `<span class="${i < d.stage ? 'done' : i === d.stage ? 'cur' : ''}"><b>${icons[i] || '🦆'}</b><small>${esc(s.label)}</small></span>`).join('<i></i>')}</div>
        ${nextSt ? `<div class="dk-statrow"><span>Growing</span>${bar(growPct)}<b>${total}/${nextSt.from}</b></div><p class="muted">${nextSt.from - total} more skill levels until it grows into a ${esc(nextSt.label.toLowerCase())} and learns a new perk.</p>` : '<p class="muted">Fully grown. A true champion!</p>'}
        <div class="dk-perklist">${v.perks.length ? v.perks.map((p) => `<span>${p.icon} <b>${esc(p.label)}</b> <small>${esc(p.about)}</small></span>`).join('') : '<span class="muted">No perks yet. You get one each time your duck grows up.</span>'}</div></div>
      <div class="card-box"><h3>Skills</h3>${Object.entries(SK).map(([k, [ic, label, , color]]) => `<div class="dk-statrow"><span>${ic} ${label}</span><div class="bar"><i style="width:${Math.min(100, d.levels[k] * 4)}%;background:${color}"></i></div><b>Lv ${d.levels[k]}</b></div>`).join('')}${v.gene ? `<p class="muted">🧬 ${esc(v.gene.label)}: ${esc(v.gene.about)} (+25% ${SK[v.gene.skill][1]} XP)</p>` : ''}</div>
      <div class="card-box"><label class="muted">Duck name</label><input id="dk-name" class="dk-select" maxlength="18" value="${esc(d.name)}"></div>
      <div class="card-box"><h3>Color</h3><div class="dk-swatches">${v.colors.map((c) => `<button data-color="${c}" class="${d.color === c ? 'on' : ''}"><img src="${A().duckImg(c, 'none', 'stand', Math.max(0, d.stage))}" alt="${c}"></button>`).join('')}</div></div>
      ${v.neighbors.length ? `<div class="card-box"><h3>🎁 Send a gift</h3><p class="muted">5 coins: their duck gets +15 energy and you both feel good.${v.giftIn ? ' Next gift in ' + timer(v.giftIn) : ''}</p><div class="dk-gifts">${v.neighbors.slice(0, 30).map((n) => `<button data-gift="${esc(n.id)}" ${v.giftIn || d.coins < 5 ? 'disabled' : ''}>${hasChar(n) ? who(n, 26) : '🎁 '}${esc(n.owner)}</button>`).join('')}</div></div>` : ''}
      <div class="card-box"><h3>Badges (${d.badges.length}/${Object.keys(v.badges).length})</h3><div class="dk-badges">${Object.entries(v.badges).map(([k, [ic, label, c]]) => `<span class="${d.badges.includes(k) ? 'got' : ''}" title="${esc(label)}">${ic}<small>${esc(label)}${c ? ' · ' + c + '🪙' : ''}</small></span>`).join('')}</div></div>`;
  }
  function eggPicker(v) {
    return `<div class="dk-eggs"><p class="dk-in">You’re in! 🎉 Your farm just appeared on the big screen.</p><h2>Choose your egg 🥚</h2><p class="muted">Every egg hatches into a duckling with a natural talent.</p>
      <div class="dk-eggrow">${v.eggs.map((e, i) => `<button class="dk-egg ${hatching === i ? 'hatching' : ''}" data-hatch="${i}" ${hatching != null ? 'disabled' : ''}><img src="${A().eggImg(e.color, e.spots)}" alt=""><b>${esc(e.label)}</b><small>${esc(e.about)}</small><span class="muted">${SK[e.skill][0]} +25% ${SK[e.skill][1]}</span></button>`).join('')}</div></div>`;
  }
  // Results on the phone: your place, the season, what's next.
  function resultsCard(v, d) {
    const l = d.last, nextL = v.ladder && v.ladder[v.race];
    return `<div class="card-box dk-myres ${l && l.place <= 3 ? 'podium' : ''}"><div class="dk-bigplace">${l ? (l.place <= 3 ? MEDAL[l.place - 1] : '#' + l.place) : '🏁'}</div><h3>${l ? `You finished ${ord(l.place)} of ${l.of}` : 'Race over'}</h3>
      ${l ? `<p class="dk-gain"><b>+${l.pts}</b> points · <b>+${l.coins}</b> 🪙${l.place <= 3 ? ' · a trophy for your farm!' : ''}</p><p class="muted">${l.trips ? '💫 Tripped ' + l.trips + '× · ' : ''}${l.slips ? '😱 Slipped ' + l.slips + '× · ' : ''}${l.tired ? '😮‍💨 Ran out of stamina (train 💪 Stamina)' : '💪 Stamina held up'}</p>` : ''}
      ${v.rivalWon != null ? `<p>⚔️ Rival: ${v.rivalWon ? 'you beat them! +15 coins' : 'they beat you this time.'}</p>` : ''}${v.predictWon != null ? `<p>🔮 Prediction: ${v.predictWon ? '+' + v.predictWon + ' coins!' : 'no luck this time.'}</p>` : ''}</div>
      <div class="card-box dk-seasonline"><div><b>Season: ${ord(v.rank || 1)} of ${v.of}</b> · ${d.points} pts${v.leader ? `<div class="muted">${v.leader.points - d.points} behind ${esc(v.leader.duck)}</div>` : v.race ? '<div class="muted">You lead the valley! 👑</div>' : ''}</div>${nextL ? `<div class="dk-nextup">Next<br><b>${nextL.icon}</b></div>` : '<div class="dk-nextup">🏆<br>Finale!</div>'}</div>
      ${road(v.ladder, v.race)}`;
  }
  // The season recap when it's all over.
  function seasonCard(v, d) {
    const s = v.season || {}, won = (v.awards || []).filter((a) => a.id === (v.myId || ''));
    const stat = (ic, val, lbl) => `<div><b>${ic} ${val}</b><small>${lbl}</small></div>`;
    return `<div class="card-box dk-recap ${s.rank === 1 ? 'champ' : ''}"><img src="${A().duckImg(d.color, s.rank === 1 ? 'crown' : d.hat, 'stand', Math.max(0, d.stage))}" width="130" alt="">
      <div class="muted">Season over</div><h2>${s.rank === 1 ? '🏆 Champion of Duck Valley!' : `You finished ${ord(s.rank || v.rank)}`}</h2><p>${esc(d.name)} · ${esc(s.stage || '')} · ${s.points != null ? s.points : d.points} points</p>
      <div class="dk-recapgrid">${stat('🏁', (s.history || []).map((p) => (p <= 3 ? MEDAL[p - 1] : p)).join(' ') || '-', 'Race finishes')}${stat('🥇', s.wins || 0, 'Wins')}${stat('🏆', s.podiums || 0, 'Podiums')}${stat('🏋️', s.trained || 0, 'Training runs')}${stat('🎯', s.bestScore || 0, 'Best score')}${stat('⭐', s.level || 0, 'Total level')}${stat('🔥', s.bestStreak || 0, 'Best streak')}${stat('🏅', s.badges || 0, 'Badges')}</div>
      ${won.map((a) => `<p class="dk-award">${esc(a.title)}!</p>`).join('')}</div>`;
  }
  function practiceRow() { return `<div class="dk-practice"><span class="muted">🎮 Practice while you wait (no energy, no XP):</span><div>${Object.entries(SK).map(([k, [ic, label]]) => `<button data-practice="${k}" aria-label="Practice ${label}">${ic}</button>`).join('')}</div></div>`; }
  function practice(k, d) {
    const run = () => window.DUCK_MINI.play(GAME[k], 20, { ...d, stage: Math.max(0, d.stage) }, (score, show) => show({ ok: true, practice: true, score }), { speed: 0.8, target: 12, diff: 'easy', again: run });
    run();
  }

  // ---------- the game's own title screen (TV) ----------
  function titleScreen(el, { start, back, resume, code }) {
    el.innerHTML = `<div class="dk-title"><canvas id="dk-title-cv"></canvas>
      <div class="dk-title-card">
        <div class="dk-logo"><span class="a">Just</span><span class="b">Raise</span><span class="c">Ducks</span></div>
        <p class="dk-tagline">Hatch a duckling. Raise it on your farm. Race the whole valley.</p>
        ${resume ? `<button class="dk-go" id="dk-resume">▶ Continue valley ${esc(code || '')}</button><br>` : ''}<button class="dk-go ${resume ? 'alt' : ''}" id="dk-go">🥚 Start a new valley</button>
        <button class="dk-how-btn" id="dk-how-btn">How to play</button>
        <ol class="dk-how" id="dk-how" hidden>${BOX.games.ducks.how.map((h) => `<li>${esc(h)}</li>`).join('')}</ol>
        <p class="dk-fine">Open this on the TV. Everyone plays on their phone. 1–100 players.</p>
        <button class="dk-back" id="dk-back">◀ Back to JustGameBox</button>
      </div></div>`;
    el.querySelector('#dk-go').onclick = start;
    const rs = el.querySelector('#dk-resume'); if (rs) rs.onclick = resume;
    el.querySelector('#dk-back').onclick = back;
    el.querySelector('#dk-how-btn').onclick = () => { const h = el.querySelector('#dk-how'); h.hidden = !h.hidden; };
    const cv = el.querySelector('#dk-title-cv'), art = A();
    const parade = [['sunny', 'crown'], ['mallard', 'cap'], ['bubblegum', 'bow'], ['snow', 'tophat'], ['sky', 'party'], ['ember', 'viking'], ['mint', 'flower']];
    loop(cv, (g, W, H, t) => {
      const sky = g.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#5ec2ff'); sky.addColorStop(1, '#c9f0ff'); g.fillStyle = sky; g.fillRect(0, 0, W, H);
      g.fillStyle = '#ffe066'; g.beginPath(); g.arc(W * 0.82, H * 0.18, 60, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(255,224,102,.25)'; g.beginPath(); g.arc(W * 0.82, H * 0.18, 90 + Math.sin(t * 2) * 6, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(255,255,255,.9)';
      for (let i = 0; i < 6; i++) { const cx = ((i * 330 + t * 18) % (W + 300)) - 150, cy = 60 + (i % 3) * 55; g.beginPath(); g.arc(cx, cy, 30, 0, 7); g.arc(cx + 32, cy - 10, 26, 0, 7); g.arc(cx + 62, cy, 28, 0, 7); g.fill(); }
      const hill = (col, base, amp, f, off) => { g.fillStyle = col; g.beginPath(); g.moveTo(0, H); for (let x = 0; x <= W; x += 16) g.lineTo(x, base + Math.sin(x / f + off) * amp); g.lineTo(W, H); g.fill(); };
      hill('#8fd47e', H * 0.58, 30, 210, 1); hill('#6cc26a', H * 0.68, 22, 160, 3);
      g.fillStyle = '#3b9be8'; g.beginPath(); g.ellipse(W * 0.2, H * 0.84, W * 0.16, H * 0.07, 0, 0, 7); g.fill();
      g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = 3; g.beginPath(); g.ellipse(W * 0.2, H * 0.84, W * 0.1, H * 0.035, 0, 0.3 + Math.sin(t) * 0.2, 2.2); g.stroke();
      g.strokeStyle = '#3d8b37'; g.lineWidth = 4; for (let i = 0; i < 7; i++) { const rx = W * 0.05 + i * 14; g.beginPath(); g.moveTo(rx, H * 0.86); g.quadraticCurveTo(rx + 6, H * 0.8, rx + Math.sin(t + i) * 4, H * 0.74); g.stroke(); }
      art.drawDuck(g, W * 0.22 + Math.sin(t * 0.6) * W * 0.06, H * 0.83, 2, 'snow', 'none', t, 'swim', Math.cos(t * 0.6) < 0, 2);
      parade.forEach(([c, h], i) => { const x = ((t * 70 + i * 150) % (W + 300)) - 150; art.drawDuck(g, x, H * 0.92 - (i % 2) * 10, 1.8, c, h, t + i, 'run', false, i === 3 ? 0 : 2); });
      art.drawDuck(g, ((t * 120) % (W + 400)) - 200, H * 0.3 + Math.sin(t * 2) * 20, 1.5, 'lilac', 'shades', t, 'fly', false, 2);
      g.fillStyle = '#c99a5b'; g.beginPath(); g.ellipse(W * 0.86, H * 0.86, 48, 14, 0, 0, 7); g.fill();
      art.drawEgg(g, W * 0.86, H * 0.8, 2.2, '#f2c14e', '#c47f17', t, (Math.sin(t * 1.3) > 0.6) ? 1 : 0);
    }, 'titleRaf');
  }

  BOX.games.ducks = {
    // Soundtrack cue per phase (public/box/scores/<key>.js); the TV turns the last 10 s of 'think' tense.
    music: (s) => ({ lobby: 'lobby', training: 'think', race: 'play', results: 'reveal', over: 'finale' }[s.phase] || 'lobby'),
    standalone: true, title: titleScreen,
    name: 'JustRaiseDucks', icon: '🦆',
    about: 'Everyone gets a farm in Duck Valley. Hatch a duckling, raise it with phone mini-games, and race up the leagues on the big screen.',
    how: [
      'Join and a farm appears in Duck Valley on the big screen. Pick an egg: each duckling hatches with a natural talent.',
      'Train Run 🏃, Swim 🌊, Fly 🪽, Climb 🧗 and Stamina 💪 with mini-games. Your duckling grows up as it levels.',
      'Spend coins in the shop: food, farm buildings, decorations, race gear and hats. It all shows on your farm.',
      'Every few minutes the valley races a themed obstacle course (meadow, beach, forest, snow, canyon, night). Wild ducks join small races.',
      'Climb from the Rookie Cup to the Grand Championship. Top 3 win trophies for your farm.',
      'Pick a tactic, predict the winner, finish quests, beat your rival, and cheer from your phone!',
    ],
    fx: { raceDone: 'cheer', levelUp: 'pop', win: 'win', farm: 'join', build: 'click', badge: 'chime', event: 'knock', pet: 'pop', hatch: 'flip', grow: 'chime', spin: 'shuffle', gift: 'chime', hype: 'drum' },
    onFx(f) {
      if (f.kind === 'cheer') {
        race.cheers = race.cheers || []; race.cheers.push({ id: f.who, at: performance.now() }); if (race.cheers.length > 60) race.cheers.shift();
        const n = race.cheers.filter((c) => c.id === f.who && performance.now() - c.at < 2000).length;
        if (race.R && n >= 5 && performance.now() - (race.cheerSaid || 0) > 5000) { race.cheerSaid = performance.now(); say(`📣 The crowd is roaring for ${nm(f.who)}!`); }
        return;
      }
      const w = f.who; if (!w) return;
      if (f.kind === 'farm') { tvw.born[w] = performance.now(); return; }
      (tvw.fxBy[w] = tvw.fxBy[w] || []).push({ kind: f.kind, at: performance.now() });
      if (tvw.fxBy[w].length > 4) tvw.fxBy[w].shift();
    },

    tv(el, s) {
      if (!s) return;
      document.body.classList.toggle('dk-racing', s.phase === 'race');
      if (s.phase === 'race') {
        if (tvw.mode !== 'race' || tvw.raceN !== s.lastRace.n) {
          tvw.mode = 'race'; tvw.raceN = s.lastRace.n;
          const L = (s.leagues || [])[s.lastRace.league] || {};
          el.innerHTML = `<div class="dk-racehead"><span class="dk-rname">${L.icon || '🏁'} ${esc(s.lastRace.name)}</span><span class="muted">📍 ${esc(s.lastRace.themeName || '')} · race ${s.lastRace.n} of ${s.races}</span>${weatherChip(s.lastRace, s.weather)}</div><canvas class="dk-race" id="dk-race"></canvas>`;
          setupRace(s, el.querySelector('#dk-race'));
        }
        return;
      }
      if (s.phase === 'results') {
        const key = 'results' + s.lastRace.n;
        if (tvw.mode === key) return; tvw.mode = key;
        const R = s.lastRace, top = R.results.slice(0, 8), F = { ...(R.wild || {}), ...Object.fromEntries(s.farms.map((d) => [d.id, d])) };
        const pod = [1, 0, 2].map((i) => top[i]).filter(Boolean);
        const mv = R.moves || {};
        const arrow = (id) => { const m = mv[id]; if (!m || R.n === 1) return ''; const k = m[0] - m[1]; return k > 0 ? `<i class="up">▲${k}</i>` : k < 0 ? `<i class="down">▼${-k}</i>` : '<i>–</i>'; };
        el.innerHTML = `<div class="dk-results"><div class="banner">🏁 ${esc(R.name)}: results</div>
          ${R.highlights && R.highlights.length ? `<div class="dk-high">${R.highlights.map((h) => `<span>${h.icon} ${esc(h.text)}</span>`).join('')}</div>` : ''}
          <div class="dk-podium">${pod.map((r) => { const d = F[r.id] || {}; return `<div class="pod p${r.place}">${duckPic(d)}<b>${esc(d.name)}</b><span class="muted">${d.wild ? '🌿 wild duck' : who(d) + esc(d.owner)}</span><div class="step">${MEDAL[r.place - 1]}${r.wild ? '' : ' +' + r.pts + ' pts'}</div></div>`; }).join('')}</div>
          <div class="dk-rescols"><div class="dk-res">${top.map((r) => { const d = F[r.id] || {}; return `<div class="row ${r.wild ? 'wild' : ''}"><span>${r.place}.</span><span>${esc(d.name)} <span class="muted">(${d.wild ? 'wild' : esc(d.owner)})</span></span><span class="muted">${r.time.toFixed(1)}s</span><b>${r.wild ? '—' : '+' + r.pts + ' pts'}</b></div>`; }).join('')}</div>
          <div class="dk-season panel"><h3>Season after race ${R.n} of ${s.races}</h3>${s.standings.slice(0, 8).map((x, i) => `<div class="row"><span>${i + 1}.</span><span>${who(x)}${esc(x.duck)}</span><b>${x.points}</b>${arrow(x.id)}</div>`).join('')}</div></div>
          <p class="muted" style="text-align:center">${s.race >= s.races ? '🏆 The season is over! The finale is next…' : 'Back to the farms in ' + timer(s.endsIn)}</p></div>`;
        return;
      }
      if (s.phase === 'over') {
        if (tvw.mode === 'over') return; tvw.mode = 'over';
        const st = s.standings, F = Object.fromEntries(s.farms.map((x) => [x.id, x]));
        const pod = [1, 0, 2].map((i) => st[i]).filter(Boolean);
        el.innerHTML = `<div class="final dk-finale"><div class="dk-confetti">${Array.from({ length: 40 }, (_, i) => `<i style="left:${(i * 37) % 100}%;animation-delay:${(i % 10) * 0.35}s;background:${['#ffd23f', '#ff4f9a', '#3ec1ff', '#2ee6a6', '#fff'][i % 5]}"></i>`).join('')}</div>
          <div class="muted">The season finale</div><h2>🏆 Champion of Duck Valley</h2>
          <div class="dk-podium season">${pod.map((x) => { const d = F[x.id] || {}, i = st.indexOf(x); return `<div class="pod p${i + 1}"><div class="dk-pair">${hasChar(x) && BOX.body ? BOX.body(x, i === 0 ? 150 : 120, { mood: i === 0 ? 'grin' : undefined, cls: 'dk-farmer' }) : ''}${duckPic(d, i === 0 ? 'crown' : null, i === 0 ? 3 : null)}</div><b>${esc(x.duck)}</b><span class="muted">${who(x)}${esc(x.owner)}</span><div class="step">${MEDAL[i]} ${x.points} pts${x.wins ? ' · ' + x.wins + ' win' + (x.wins === 1 ? '' : 's') : ''}</div></div>`; }).join('')}</div>
          <div class="dk-awards">${(s.awards || []).map((a) => `<div class="panel"><b>${esc(a.title)}</b><div>${esc(a.duck)}</div><div class="muted">${who(a)}${esc(a.owner)}</div></div>`).join('')}</div>
          ${st.length > 3 ? BOX.board(st.slice(3).map((x) => ({ name: x.duck + ' (' + x.owner + ')', points: x.points })), (r) => r.points, ' pts').replace(/<span class="n">(\d+)<\/span>/g, (m, n) => `<span class="n">${Number(n) + 3}</span>`) : ''}</div>`;
        return;
      }
      tvw.farms = s.farms; tvw.weather = s.course && s.course.weather;
      if (tvw.mode !== 'valley' || !el.querySelector('#dk-valley')) {
        tvw.mode = 'valley';
        for (const f of s.farms) if (!(f.id in tvw.born)) tvw.born[f.id] = 0;
        el.innerHTML = `<div class="dk-hudrow"><div id="dk-next"></div><div class="dk-count"><div class="muted">Race starts in</div><span id="dk-timer"></span></div></div>
          <div class="dk-wrap"><canvas class="dk-valley" id="dk-valley"></canvas><div id="dk-board" class="dk-board"></div><div id="dk-hype" class="dk-hype" hidden></div><aside class="dk-side"><div class="panel" id="dk-spot"></div><div class="panel"><h3>Standings</h3><div id="dk-stand"></div></div><div class="panel"><h3>Valley news</h3><div id="dk-news" class="dk-news"></div></div></aside></div>`;
        loop(el.querySelector('#dk-valley'), drawValley);
      }
      for (const f of s.farms) if (!(f.id in tvw.born)) tvw.born[f.id] = performance.now();
      el.querySelector('.dk-wrap').classList.toggle('lobby', s.phase === 'lobby');
      el.classList.toggle('dk-lobby', s.phase === 'lobby'); el.classList.add('dk-host');
      const hype = el.querySelector('#dk-hype'), board = el.querySelector('#dk-board');
      if (s.phase === 'lobby') {
        const hatched = s.farms.filter((f) => f.stage >= 0).length;
        el.querySelector('#dk-next').innerHTML = `<div class="muted">Welcome to</div><div class="dk-rname">🦆 Duck Valley</div><div class="muted">${s.farms.length ? `${s.farms.length} farm${s.farms.length === 1 ? '' : 's'} · ${hatched} hatched · scan the code to claim yours!` : 'Scan the code: every player gets a farm here.'}</div>`;
        el.querySelector('#dk-timer').innerHTML = '<span class="dk-wait">Waiting for the host…</span>';
        hype.hidden = true; board.innerHTML = '';
        return;
      }
      const c = s.course;
      el.querySelector('#dk-next').innerHTML = `<div class="muted">${c.leagueIcon || ''} ${esc(c.leagueName || '')} · race ${s.race + 1} of ${s.races} · 📍 ${esc(c.themeName || '')} · ${s.farms.length} farm${s.farms.length === 1 ? '' : 's'}</div><div class="dk-rname">${esc(c.name)}${c.final ? ' <span class="dk-x2">×2 points</span>' : ''} ${weatherChip(c, s.weather)}</div>${course(c)}${road(s.ladder, s.race)}`;
      el.querySelector('#dk-timer').innerHTML = timer(s.endsIn);
      el.querySelector('#dk-timer').classList.toggle('hot', !!s.hype);
      el.querySelector('#dk-spot').innerHTML = spotlight(s);
      el.querySelector('#dk-stand').innerHTML = s.race ? BOX.board(s.standings.map((x) => ({ name: x.duck, points: x.points })), (r) => r.points, ' pts') : '<p class="muted">No races yet. Train hard!</p>';
      el.querySelector('#dk-news').innerHTML = s.ticker.slice().reverse().map((t) => `<div class="n-${t.kind}">${esc(t.text)}</div>`).join('');
      // the season so far (top 5), always in view on the big screen
      const strong = s.farms.filter((f) => f.stage >= 0).sort((a, b) => b.total - a.total).slice(0, 5);
      board.innerHTML = s.race ? `<div class="bh">🏆 Season · ${s.race}/${s.races}</div>${s.standings.slice(0, 5).map((x, i) => `<div class="r ${i === 0 ? 'lead' : ''}"><b>${i + 1}</b><span>${who(x)}${esc(x.duck)}</span><em>${x.points}</em></div>`).join('')}` : `<div class="bh">⭐ Strongest ducks</div>${strong.map((f, i) => `<div class="r ${i === 0 ? 'lead' : ''}"><b>${i + 1}</b><span>${who(f)}${esc(f.name)}</span><em>Lv ${f.total}</em></div>`).join('')}`;
      // race-day hype: the last 15 seconds
      hype.hidden = !s.hype;
      if (s.hype) {
        const F = Object.fromEntries(s.farms.map((x) => [x.id, x]));
        const fav = (s.favorites || []).map((id) => F[id]).filter(Boolean);
        hype.innerHTML = `<div class="hk">${c.final ? '🏆 GRAND FINAL' : '🏁 RACE DAY'}</div><div class="hn">${esc(c.name)} starts in ${timer(s.endsIn)}</div>${fav.length ? `<div class="hf">${fav.map((f, i) => `<span>${duckPic(f)}<b>${i + 1}. ${who(f)}${esc(f.name)}</b></span>`).join('')}</div><div class="muted">The favorites · pick your tactic on your phone!</div>` : ''}`;
      }
    },

    phone(el, v, ctx, full) {
      // JustGold gear: this game's phone theme, a frame and badge over your screen (public/shared/gear.js).
      if (window.MT_GEAR) window.MT_GEAR.phoneTheme(el, full, 'ducks');
      if (!v) return;
      const put = (html) => BOX.morph(el, html);
      const d = v.duck;
      hero.farm = { ...d, eggColor: v.eggs ? v.eggs[0].color : null };
      if (v.newBadge) { ctx.toast(`${v.badges[v.newBadge][0]} Badge: ${v.badges[v.newBadge][1]}! +${v.badges[v.newBadge][2]} coins`); ctx.vibrate(100); }
      if (v.eventMsg) ctx.toast(v.eventMsg);
      if (v.questDone) { ctx.toast('📜 Quest done: ' + v.questDone + '!'); ctx.sfx('chime'); }
      if (v.grew) { ctx.toast(`🌱 Your duck grew into a ${v.grew.toLowerCase()}!`); ctx.sfx('win'); ctx.vibrate(150); }
      const on = (sel, fn) => { for (const b of el.querySelectorAll(sel)) b.onclick = () => fn(b); };
      const mount = () => {
        const slot = el.querySelector('#dk-hero-slot'); if (slot && !slot.contains(heroCanvas())) slot.appendChild(heroCanvas());
        const h = el.querySelector('.dk-hero');
        if (h) h.onclick = async (e) => {
          if (e.target.closest('button')) return;
          const heart = () => { petFx.push({ kind: 'pet', at: performance.now() }); if (petFx.length > 4) petFx.shift(); ctx.sfx('pop'); ctx.vibrate(20); };
          // The duck only gets happier every few seconds; in between, a heart is all you get (no error).
          if (v.phase !== 'training' || Date.now() - lastPet < 8200) { heart(); return; }
          lastPet = Date.now(); heart();
          const r = await ctx.act({ op: 'pet' }); if (r.ok) petted = true;
        };
      };
      if (v.phase === 'over') {
        v.myId = full && full.me ? full.me.id : null;
        put(`${seasonCard(v, d)}${v.awards && v.awards.length ? `<div class="card-box">${v.awards.map((a) => `<div>${esc(a.title)}: <b>${esc(a.duck)}</b> (${esc(a.owner)})</div>`).join('')}</div>` : ''}<div class="card-box"><h3>Final standings</h3>${BOX.board(v.final.map((x) => ({ name: x.duck, points: x.points })), (r) => r.points, ' pts')}</div>`);
        return;
      }
      if (v.eggs) {
        put(eggPicker(v));
        for (const b of el.querySelectorAll('[data-hatch]')) b.onclick = () => { if (hatching != null) return; hatching = Number(b.dataset.hatch); b.classList.add('hatching'); ctx.sfx('flip'); ctx.vibrate(60); setTimeout(async () => { const r = await ctx.act({ op: 'hatch', pick: Number(b.dataset.hatch) }); hatching = null; if (r.ok) { ctx.toast('🐣 It hatched! Say hi to your duckling.'); ctx.sfx('win'); } }, 900); };
        return;
      }
      if (v.phase === 'lobby') {
        put(`${heroHtml(v)}<div class="card-box dk-lobbycard"><h3>🏡 Your farm is on the big screen!</h3><div class="dk-steps"><span><b>🏋️</b>Train skills with mini-games</span><span><b>🛒</b>Spend coins on your farm</span><span><b>🏁</b>Race the valley on the TV</span></div>${practiceRow()}<p class="muted">The game starts when the host presses Start.</p></div>
          <div class="card-box"><label class="muted">Name your duck</label><input id="dk-name" class="dk-select" maxlength="18" value="${esc(d.name)}"></div>
          <div class="card-box"><h3>Pick a color</h3><div class="dk-swatches">${v.colors.map((c) => `<button data-color="${c}" class="${d.color === c ? 'on' : ''}"><img src="${A().duckImg(c, d.hat, 'stand', Math.max(0, d.stage))}" alt="${c}"></button>`).join('')}</div></div>
          ${v.gene ? `<div class="card-box">🧬 <b>${esc(v.gene.label)}</b>: ${esc(v.gene.about)} <span class="muted">(+25% ${SK[v.gene.skill][1]} XP)</span></div>` : ''}`);
        mount();
        on('[data-color]', (b) => ctx.act({ op: 'style', color: b.dataset.color }));
        on('[data-practice]', (b) => practice(b.dataset.practice, d));
        const nm2 = el.querySelector('#dk-name'); if (nm2) { nm2.onchange = () => ctx.act({ op: 'style', name: nm2.value }); nm2.onkeydown = (e) => { if (e.key === 'Enter') nm2.blur(); }; }
        return;
      }
      if (v.phase === 'race') {
        put(`${heroHtml(v)}<div class="card-box dk-racenow"><div class="muted">${v.course.leagueIcon || '🏁'} ${esc(v.course.name)}</div><h3>🏁 They’re racing! Watch the big screen</h3><p class="muted">${v.tactics[d.tactic][0]} ${v.tactics[d.tactic][1]}${d.gear.length && v.gear ? ' · ' + d.gear.map((g) => v.gear[g].icon).join(' ') : ''}</p><button class="btn big pink dk-cheer" id="dk-cheer">📣 CHEER!</button><p class="muted">Every tap shows above your duck on the big screen.</p></div>`);
        mount();
        const ch = el.querySelector('#dk-cheer'); ch.onclick = () => { ctx.act({ op: 'cheer' }); ctx.vibrate(25); ch.classList.remove('bump'); void ch.offsetWidth; ch.classList.add('bump'); };
        return;
      }
      if (v.phase === 'results') { put(`${heroHtml(v)}${resultsCard(v, d)}`); mount(); return; }
      if (v.giftFrom) { ctx.toast(`🎁 ${v.giftFrom} sent your duck some seeds! +15 energy`); ctx.sfx('chime'); }
      if (v.perkChoice) {
        put(`${heroHtml(v)}${perkModal(v)}`); mount();
        for (const b of el.querySelectorAll('[data-perk]')) b.onclick = async () => { if ((await ctx.act({ op: 'perk', key: b.dataset.perk })).ok) { ctx.sfx('win'); ctx.toast('Perk learned!'); } };
        return;
      }
      const pages = { train: pageTrain, shop: pageShop, race: pageRace, duck: pageDuck };
      const c = v.course;
      const next = `<div class="dk-nextbar ${v.hype ? 'hype' : ''} ${c.final ? 'final' : ''}"><span>${c.final ? '🏆 Grand Final' : (c.leagueIcon || '🏁') + ' Race ' + c.n + '/' + v.races} <b class="dk-nt">${timer(v.endsIn)}</b></span><span class="muted">${v.race ? `${ord(v.rank || 1)} · ${d.points} pts` : 'Season starts'}</span></div>`;
      put(`<div class="dk-phone">${heroHtml(v)}${eventCard(v)}${next}<div class="dk-page">${(pages[tab] || pageTrain)(v, d)}</div>
        <nav class="dk-nav">${[['train', '🏋️', 'Train'], ['shop', '🛒', 'Shop'], ['race', '🏁', 'Race'], ['duck', '🦆', 'My duck']].map(([k, i, l]) => `<button class="${tab === k ? 'on' : ''}" data-tab="${k}"><span>${i}</span>${l}</button>`).join('')}</nav></div>`);
      mount();
      const play = async (stat, diff) => {
        const r = await ctx.act({ op: 'train', stat, diff });
        ctx.redraw();
        if (r.ok) window.DUCK_MINI.play(r.game, r.seconds, { ...d, stage: Math.max(0, d.stage) }, (score, show) => ctx.act({ op: 'score', score }).then(show), { speed: r.speed, target: r.target, best: r.best, diff: r.diff, again: () => play(stat, diff) });
      };
      on('[data-ev]', (b) => ctx.act({ op: 'event', choice: b.dataset.ev }));
      on('[data-tab]', (b) => { if (tab === b.dataset.tab) return; tab = b.dataset.tab; sheet = null; ctx.redraw(); window.scrollTo(0, 0); });
      on('[data-cat]', (b) => { shopCat = b.dataset.cat; ctx.redraw(); });
      on('[data-goshop]', (b) => { tab = 'shop'; shopCat = b.dataset.goshop; ctx.redraw(); window.scrollTo(0, 0); });
      on('[data-sheet]', (b) => { sheet = b.dataset.sheet; ctx.redraw(); });
      on('[data-coach-train]', (b) => { sheet = b.dataset.coachTrain; ctx.redraw(); });
      on('[data-close]', () => { sheet = null; ctx.redraw(); });
      on('[data-diff]', (b) => { if (sheetDiff === b.dataset.diff) return; sheetDiff = b.dataset.diff; ctx.vibrate(8); ctx.redraw(); });
      on('[data-play]', (b) => { if (!sheet) return; const stat = sheet; sheet = null; b.disabled = true; play(stat, sheetDiff); });
      on('[data-spin]', () => spinWheel(v, ctx));
      on('[data-quests]', () => { questsOpen = !questsOpen; ctx.redraw(); });
      on('[data-gift]', async (b) => { if ((await ctx.act({ op: 'gift', to: b.dataset.gift })).ok) { ctx.toast('🎁 Gift sent!'); ctx.sfx('chime'); } });
      const nap = el.querySelector('#dk-nap'); if (nap) nap.onclick = () => ctx.act({ op: 'nap' });
      on('[data-coach="nap"]', () => ctx.act({ op: 'nap' }));
      on('[data-feed]', async (b) => { if ((await ctx.act({ op: 'feed', item: b.dataset.feed })).ok) { ctx.sfx('chime'); petFx.push({ kind: 'eat', at: performance.now() }); } });
      on('[data-build]', async (b) => { if ((await ctx.act({ op: 'build', item: b.dataset.build })).ok) { ctx.sfx('click'); petFx.push({ kind: 'build', at: performance.now() }); ctx.toast('Built! It’s on your farm 🏡'); } });
      on('[data-decor]', async (b) => { if ((await ctx.act({ op: 'decor', item: b.dataset.decor })).ok) { ctx.sfx('chime'); ctx.toast('Placed on your farm 🌷'); } });
      on('[data-gear]', async (b) => { if ((await ctx.act({ op: 'gear', item: b.dataset.gear })).ok) ctx.toast('Packed for race day 🎒'); });
      on('[data-tactic]', (b) => ctx.act({ op: 'tactic', tactic: b.dataset.tactic }));
      on('[data-qtactic]', (b) => { ctx.act({ op: 'tactic', tactic: b.dataset.qtactic }); ctx.vibrate(15); });
      on('[data-color]', (b) => ctx.act({ op: 'style', color: b.dataset.color }));
      on('[data-hat]', (b) => { const h = b.dataset.hat; if (d.hats.includes(h)) ctx.act({ op: 'style', hat: d.hat === h ? 'none' : h }); else if (confirm(`Buy the ${HAT_NAME[h]} for ${v.hatCost} coins?`)) ctx.act({ op: 'hat', hat: h }); });
      const pr = el.querySelector('#dk-predict'); if (pr) pr.onchange = () => { if (pr.value) ctx.act({ op: 'predict', id: pr.value }); };
      const nmi = el.querySelector('#dk-name'); if (nmi) { nmi.onchange = () => ctx.act({ op: 'style', name: nmi.value }); nmi.onkeydown = (e) => { if (e.key === 'Enter') nmi.blur(); }; }
    },
  };
})();
