'use strict';
// JustRaiseDucks screens. TV: Duck Valley (every player's farm, live), the themed
// side-scrolling race with a following camera, then the podium. Phone: hatch an egg, then
// your own farm up top (tap to pet), and four tabs: Train, Shop, Race, My duck.
(function () {
  const { esc, timer } = BOX;
  const A = () => window.DUCK_ART;
  const SK = { run: ['🏃', 'Run', 'Hurdle Dash', '#ff8c42'], swim: ['🌊', 'Swim', 'Paddle Power', '#3ec1ff'], fly: ['🪽', 'Fly', 'Sky Rings', '#b388ff'], climb: ['🧗', 'Climb', 'Cliff Climb', '#c49a6c'], stamina: ['💪', 'Stamina', 'Bug Snack', '#2ee6a6'] };
  const SEC = { track: ['🏃', 'Track', 'run'], pond: ['🌊', 'Pond', 'swim'], cliff: ['🧗', 'Cliff', 'climb'], gap: ['🪽', 'Ravine', 'fly'] };
  const VAR_ICON = { hurdles: '🚧', logs: '🪵', mud: '🟤', sand: '🏖️', ice: '🧊', calm: '💧', lily: '🪷', waves: '🌊', rapids: '💨', icy: '🧊', rock: '🪨', clouds: '☁️', canyon: '🏜️' };
  const HAT_NAME = { none: 'No hat', cap: 'Cap', tophat: 'Top hat', crown: 'Crown', flower: 'Flower', shades: 'Shades', bow: 'Bow', viking: 'Viking', pirate: 'Pirate', party: 'Party', chef: 'Chef', headband: 'Headband' };
  const typeOf = (s) => s.type || s;
  const PERK_ICON = { burst: '🚀', webbed: '🦶', feather: '🪶', grip: '🧲', lungs: '🫁', lucky: '🍀', nimble: '🦘', closer: '🏁' };
  const course = (c) => (c ? `<div class="dk-legs">${c.sections.map((s) => `<span class="leg ${typeOf(s)}">${SEC[typeOf(s)][0]} ${SEC[typeOf(s)][1]}${s.v ? ' ' + (VAR_ICON[s.v] || '') : ''}</span>`).join('<span class="arrow">→</span>')}</div>` : '');
  const weatherChip = (c, W) => (c && W ? `<span class="dk-weather">${W[c.weather].icon} ${W[c.weather].label}${c.wind ? (c.wind > 0 ? ' (tailwind)' : ' (headwind)') : ''}</span>` : '');
  const bar = (v, cls = '') => `<div class="bar ${cls}"><i style="width:${Math.max(0, Math.min(100, v))}%"></i></div>`;

  // ---------- TV state kept between updates (canvases keep animating) ----------
  const tvw = { mode: null, farms: [], fxBy: {}, born: {}, raf: 0, spot: 0, spotAt: 0, raceN: 0 };
  function loop(canvas, draw, key = 'raf') {
    cancelAnimationFrame(tvw[key]);
    const step = () => { if (!document.body.contains(canvas)) return; const W = canvas.clientWidth, H = canvas.clientHeight; if (canvas.width !== W) canvas.width = W; if (canvas.height !== H) canvas.height = H; draw(canvas.getContext('2d'), W, H, performance.now() / 1000); tvw[key] = requestAnimationFrame(step); };
    step();
  }

  // ---------- the race on the TV ----------
  const race = { R: null, G: null, start: 0, k: 1, cam: 0, leader: null, msgs: [], cheers: [], seenEv: new Set(), finished: new Set(), ducks: {} };
  function setupRace(s, canvas) {
    const R = s.lastRace;
    race.R = R; race.G = A().raceGeometry(R);
    race.start = Date.now() + s.endsIn - (R.intro + R.run + 6000);
    const times = R.results.map((r) => r.time);
    race.k = Math.max(times[0] / ((R.run / 1000) * 0.78), times[times.length - 1] / ((R.run / 1000) * 0.97));
    race.cam = -6; race.leader = null; race.msgs = []; race.cheers = []; race.seenEv = new Set(); race.finished = new Set(); race.beep = 0; race.go = false;
    race.ducks = { ...(R.wild || {}), ...Object.fromEntries(s.farms.map((f) => [f.id, f])) };
    race.place = Object.fromEntries(R.results.map((r) => [r.id, r]));
    race.lanes = Object.fromEntries(R.tracks.map((tr, i) => [tr.id, i]));
    loop(canvas, drawRace);
  }
  const say = (text) => { race.msgs.push({ text, at: performance.now() }); if (race.msgs.length > 4) race.msgs.shift(); };
  function posAt(tr, simT) { const i = simT / race.R.sample, a = Math.floor(i); if (a >= tr.s.length - 1) return tr.s[tr.s.length - 1] / 10; return (tr.s[a] + (tr.s[a + 1] - tr.s[a]) * (i - a)) / 10; }
  const EV_ICON = { trip: '💫', slip: '😱', skid: '🌀', boost: '⚡', tired: '😮‍💨' };
  const EV_TEXT = { trip: 'trips over a jump!', slip: 'slips down the cliff!', skid: 'skids on the ice!', boost: 'catches a boost! ⚡', tired: 'is running out of steam…' };
  function drawRace(g, W, H, now) {
    const R = race.R, G = race.G, art = A();
    const e = Date.now() - race.start, simT = Math.max(0, (e - R.intro) / 1000) * race.k;
    const PX = W / 70;
    const pos = R.tracks.map((tr) => ({ id: tr.id, x: posAt(tr, simT), tr }));
    const lead = pos.reduce((a, b) => (b.x > a.x ? b : a), pos[0]);
    const unfinished = pos.filter((p) => p.x < G.L).sort((a, b) => b.x - a.x);
    const focus = lead.x < G.L ? lead.x : unfinished.length ? unfinished[Math.floor(unfinished.length / 3)].x : G.L;
    const target = Math.max(-6, Math.min(G.L - (W * 0.8) / PX, focus - (W * 0.62) / PX));
    race.cam += (target - race.cam) * 0.08;
    const base = art.drawRaceWorld(g, W, H, R, G, race.cam, PX, now);
    const night = R.theme === 'night';
    const LANES = Math.min(10, R.tracks.length), order = pos.slice().sort((a, b) => (race.lanes[b.id] % LANES) - (race.lanes[a.id] % LANES));
    const labelled = new Set(pos.slice().sort((a, b) => b.x - a.x).slice(0, 6).map((p) => p.id));
    for (const p of order) {
      const d = race.ducks[p.id] || {}, lane = race.lanes[p.id] % LANES, done = p.x >= G.L;
      const x = (Math.min(p.x, G.L) + (done ? Math.min(6, (race.place[p.id].place - 1) * 0.5) : 0) - race.cam) * PX;
      if (x < -60 || x > W + 60) continue;
      const gr = art.groundAt(G, Math.min(p.x, G.L - 0.01));
      const ev = p.tr.ev.filter(([t]) => t <= simT && simT - t < 1.2).map(([, k]) => k);
      const tired = p.tr.ev.some(([t, k]) => k === 'tired' && t <= simT) && !done;
      const y = base - gr.h * PX * 0.9 - lane * 7 + (gr.type === 'pond' ? 8 : -18);
      const sc = Math.max(0.6, 1.25 - lane * 0.04) * Math.min(1.3, W / 1400);
      const mode = done ? 'stand' : ev.includes('trip') || ev.includes('skid') ? 'stand' : gr.mode;
      art.drawDuck(g, x, y, sc, d.color, d.hat, now + lane * 0.37, mode, false, d.stage == null ? 2 : Math.max(0, d.stage));
      g.textAlign = 'center';
      const evk = ev.find((k) => k !== 'tired');
      if (evk) { g.font = `${22 * sc}px sans-serif`; g.fillText(EV_ICON[evk], x, y - 34 * sc); }
      else if (tired) { g.font = `${14 * sc}px sans-serif`; g.fillText('💦', x - 18 * sc, y - 26 * sc); }
      if (labelled.has(p.id) || (done && race.place[p.id].place <= 3)) {
        g.font = `600 ${13 * sc}px Fredoka, sans-serif`;
        const label = (done ? ['🥇', '🥈', '🥉'][race.place[p.id].place - 1] || '#' + race.place[p.id].place : '') + ' ' + (d.name || '') + (d.wild ? ' 🌿' : '');
        const tw = g.measureText(label).width + 10, ly = y - (52 + (lane % 3) * 18) * sc;
        g.fillStyle = d.wild ? 'rgba(40,70,30,.7)' : 'rgba(0,0,0,.6)'; g.fillRect(x - tw / 2, ly, tw, 17 * sc); g.fillStyle = '#fff'; g.fillText(label, x, ly + 13 * sc);
      }
      g.textAlign = 'left';
      for (const c of race.cheers) if (c.id === p.id) { const age = (performance.now() - c.at) / 1000; if (age < 1.5) { g.globalAlpha = 1 - age / 1.5; g.font = `${18 * sc}px sans-serif`; g.fillText('📣', x + Math.sin(age * 8 + c.at) * 10, y - 60 * sc - age * 40); g.globalAlpha = 1; } }
      for (const [t, k] of p.tr.ev) {
        const key = p.id + t + k; if (t > simT || race.seenEv.has(key)) continue;
        race.seenEv.add(key);
        const show = k === 'boost' ? labelled.has(p.id) && Math.random() < 0.5 : k === 'tired' ? p.id === race.leader : labelled.has(p.id) || R.tracks.length <= 12;
        if (show) say(`${d.name} ${EV_TEXT[k]}`);
      }
      if (done && !race.finished.has(p.id)) { race.finished.add(p.id); const pl = race.place[p.id].place; if (pl === 1) { say(`🏆 ${d.name} WINS the ${R.name}!`); BOX.sfx('cheer'); } else if (pl <= 3) say(`${['', '🥈', '🥉'][pl - 1]} ${d.name} takes ${pl === 2 ? 'second' : 'third'}!`); }
    }
    if (lead && e > R.intro && lead.x < G.L && race.leader !== lead.id) { if (race.leader) say(`${(race.ducks[lead.id] || {}).name} takes the lead!`); race.leader = lead.id; }
    // minimap with every duck
    const mx = 20, mw = W - 40, my = 14;
    g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(mx - 6, my - 6, mw + 12, 30);
    for (const s of G.secs) { g.fillStyle = art.SEC_COLORS[s.type]; g.fillRect(mx + (s.a / G.L) * mw, my, ((s.b - s.a) / G.L) * mw, 18); }
    for (const p of pos) { const d = race.ducks[p.id] || {}; g.fillStyle = (art.PAL[d.color] || art.PAL.sunny)[0]; g.beginPath(); g.arc(mx + Math.min(1, p.x / G.L) * mw, my + 9, 5, 0, Math.PI * 2); g.fill(); }
    // live top 5
    const top5 = pos.slice().sort((a, b) => b.x - a.x || (race.place[a.id].time - race.place[b.id].time)).slice(0, 5);
    g.fillStyle = 'rgba(15,8,35,.7)'; g.fillRect(W - 230, 46, 214, 24 + top5.length * 24);
    g.font = '700 15px Fredoka, sans-serif'; g.fillStyle = '#ffd23f'; g.fillText('LEADERS', W - 218, 64);
    top5.forEach((p, i) => { const d = race.ducks[p.id] || {}; g.fillStyle = '#fff'; g.font = '600 15px Fredoka, sans-serif'; g.fillText(`${i + 1}. ${(d.name || '').slice(0, 18)}${d.wild ? ' 🌿' : ''}`, W - 218, 88 + i * 24); });
    // commentary
    g.font = '600 22px Fredoka, sans-serif';
    race.msgs.filter((m) => performance.now() - m.at < 6000).slice(-3).forEach((m, i, arr) => { const y = H - 20 - (arr.length - 1 - i) * 34, tw = g.measureText(m.text).width + 24; g.fillStyle = 'rgba(20,10,40,.78)'; g.fillRect(16, y - 26, tw, 32); g.fillStyle = '#fff'; g.fillText(m.text, 28, y - 4); });
    if (e < R.intro) {
      g.fillStyle = night ? 'rgba(0,0,10,.5)' : 'rgba(10,5,30,.45)'; g.fillRect(0, 0, W, H); g.textAlign = 'center'; g.fillStyle = '#fff';
      g.font = '700 30px Fredoka, sans-serif'; g.fillText((R.themeName || '') + (R.final ? ' · double points!' : ''), W / 2, H * 0.22);
      g.font = '700 58px Fredoka, sans-serif'; g.fillText(R.name, W / 2, H * 0.34);
      const left = Math.ceil((R.intro - e) / 1000);
      if (left <= 3) { g.font = '800 150px Fredoka, sans-serif'; g.fillStyle = '#ffd23f'; g.fillText(String(left), W / 2, H * 0.64); if (race.beep !== left) { race.beep = left; BOX.sfx('tick'); } }
      g.textAlign = 'left';
    } else if (!race.go) { race.go = true; BOX.sfx('start'); say('QUACK! And they’re off!'); }
  }

  // ---------- Duck Valley on the TV ----------
  function drawValley(g, W, H, now) { A().drawValley(g, W, H, tvw.farms, now, tvw.fxBy, tvw.born, tvw.weather); }
  function spotlight(s) {
    const farms = s.farms.filter((f) => f.stage >= 0);
    if (!farms.length) return '<p class="muted">Eggs are about to hatch…</p>';
    if (Date.now() - tvw.spotAt > 7000) { tvw.spot = (tvw.spot + 1) % farms.length; tvw.spotAt = Date.now(); }
    const f = farms.slice().sort((a, b) => a.plot - b.plot)[tvw.spot % farms.length];
    const L = f.levels;
    return `<div class="dk-spot"><img src="${A().duckImg(f.color, f.hat, 'stand', f.stage)}" alt=""><div><b>${esc(f.name)}</b><div class="muted">${esc(f.owner)} · ${esc(f.stageName)} ${A().MOOD(f.mood)}</div>
      ${Object.entries(SK).map(([k, [ic]]) => `<div class="dk-mini"><span>${ic}</span>${bar(L[k] * 4)}<b>${L[k]}</b></div>`).join('')}
      ${f.perks && f.perks.length ? `<div class="dk-perkicons">${f.perks.map((k) => (PERK_ICON[k] || '')).join(' ')}</div>` : ''}${f.streak > 2 ? `<div>🔥 streak ×${f.streak}</div>` : ''}<div class="muted">${f.trophies.length ? '🏆×' + f.trophies.length + ' · ' : ''}${f.badges ? '🏅×' + f.badges + ' · ' : ''}${Object.values(f.buildings).reduce((a, b) => a + b, 0)} upgrades</div></div></div>`;
  }

  // ---------- phone ----------
  let tab = 'train', shopCat = 'food';
  const petFx = [];
  const hero = { canvas: null, farm: null, raf: 0 };
  function heroCanvas() {
    if (!hero.canvas) {
      hero.canvas = document.createElement('canvas'); hero.canvas.className = 'dk-herocv';
      const step = () => {
        const c = hero.canvas;
        if (document.body.contains(c) && hero.farm) {
          const W = c.clientWidth, H = c.clientHeight, dpr = Math.min(2, window.devicePixelRatio || 1);
          if (c.width !== Math.round(W * dpr)) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); }
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
  let petted = false, sheet = null, questsOpen = false, sheetDiff = 'medium';
  // The farm picture with only what matters on it: name, stage, coins; energy and mood underneath.
  function heroHtml(v) {
    const d = v.duck, st = d.stage >= 0 ? v.stages[d.stage] : null;
    return `<div class="dk-hero"><div id="dk-hero-slot"></div>
      <div class="dk-hero-top"><span class="pill name">${esc(d.name)} <small>${st ? esc(st.label) : '🥚'}</small></span><span class="pill coins">🪙 ${d.coins}</span></div>
      ${petted ? '' : '<div class="dk-tap">👆 tap your duck to pet it</div>'}</div>
      <div class="dk-meters"><div><span>⚡ Energy</span>${bar(d.energy)}</div><div><span>${A().MOOD(d.mood)} Mood</span>${bar(d.mood, 'mood')}</div></div>`;
  }
  // Skill sheet: choose Easy, Medium or Hard before playing.
  function sheetHtml(v, d) {
    const k = sheet, [icon, label, game, color] = SK[k], best = v.bests[k] || {};
    const cards = Object.entries(v.diffs).map(([dk, D]) => `<button class="dk-diff ${sheetDiff === dk ? 'on' : ''} ${dk}" data-diff="${dk}" ${d.energy < D.cost ? 'disabled' : ''}>
      <span class="dn">${D.icon} ${D.label}</span><span class="dx">×${D.mult} XP</span><span class="dc">⚡ ${D.cost}</span><span class="dt">⭐ ${D.target}${best[dk] ? ' · best ' + best[dk] : ''}</span><small>${esc(D.about)}</small></button>`).join('');
    const D = v.diffs[sheetDiff];
    return `<div class="dk-sheet-bg" data-close></div><div class="dk-sheet" style="--c:${color}">
      <div class="dk-sheet-head"><span class="big">${icon}</span><div><b>${label} · Lv ${d.levels[k]}${v.gene && v.gene.skill === k ? ' 🧬' : ''}</b><div class="muted">${game}</div></div><button class="link" data-close>✕</button></div>
      <div class="dk-diffs">${cards}</div>
      <button class="btn big green dk-play" data-play ${d.energy < D.cost ? 'disabled' : ''}>Play ${D.label} (⚡ ${D.cost})</button>
      ${v.streak ? `<p class="muted" style="text-align:center">🔥 Streak ×${v.streak}: hit the ⭐ target again for +${Math.min(6, v.streak + 1) * 5}% XP</p>` : '<p class="muted" style="text-align:center">Hit the ⭐ target to start a streak (up to +30% XP).</p>'}</div>`;
  }
  function perkModal(v) {
    return `<div class="dk-perks"><h2>🌱 Your duck grew up!</h2><p class="muted">Pick a perk. It stays for the whole season.</p>${v.perkChoice.map((p) => `<button class="dk-perk" data-perk="${p.key}"><span>${p.icon}</span><b>${esc(p.label)}</b><small>${esc(p.about)}</small></button>`).join('')}</div>`;
  }
  // Lucky Spin: a wheel drawn on top of the page (outside the re-rendered body).
  function spinWheel(v, ctx) {
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
    const quests = v.quests && v.quests.length ? `<div class="card-box dk-quests ${questsOpen ? 'open' : ''}"><button class="dk-qhead" data-quests><b>📜 Quests ${done}/${v.quests.length}</b>${v.rival ? `<span class="muted">⚔️ rival: ${esc(v.rival.name)}</span>` : ''}<span>${questsOpen ? '▲' : '▼'}</span></button>
      ${questsOpen ? v.quests.map((q) => `<div class="q ${q.done ? 'done' : ''}"><span>${q.done ? '✅' : '⬜'} ${esc(q.text)}</span><span class="muted">${q.done ? 'done' : q.have + '/' + q.n} · 🪙${q.reward}</span></div>`).join('') + (v.rival ? `<div class="q rival">⚔️ Beat <b>${esc(v.rival.name)}</b> <span class="muted">(${esc(v.rival.owner)})</span> next race for 🪙15</div>` : '') : ''}</div>` : '';
    const top = `<div class="dk-actions">${v.canSpin ? '<button class="dk-spinbtn" data-spin>🎡 Lucky Spin <small>free!</small></button>' : '<span class="dk-spinbtn used">🎡 spun · next after the race</span>'}${v.streak ? `<span class="dk-streak">🔥 ×${v.streak}</span>` : ''}</div>`;
    return `${top}${v.napLeft ? `<div class="big-status">💤 Napping… ${timer(v.napLeft)}</div>` : ''}
      <div class="dk-skillgrid">${Object.entries(SK).map(([k, [icon, label, game, color]]) => { const p = d.progress[k], pct = p ? Math.round((p.have / p.need) * 100) : 100; return `<button class="dk-skill ${needs.includes(k) || k === 'stamina' ? 'need' : ''}" style="--c:${color}" data-sheet="${k}" ${v.napLeft ? 'disabled' : ''}>${ring(d.levels[k], pct, color)}<span class="t"><b>${icon} ${label}${v.gene && v.gene.skill === k ? ' 🧬' : ''}</b><small>${game}</small></span></button>`; }).join('')}
        <button class="dk-skill nap" id="dk-nap" ${v.napLeft ? 'disabled' : ''}><div class="dk-ring" style="background:#3b2a6b"><span>💤</span></div><span class="t"><b>Nap</b><small>${v.napSeconds}s · free ⚡</small></span></button></div>
      <p class="muted dk-hint">✨ = needed for the next course${v.gene ? ' · 🧬 = natural talent' : ''}</p>${quests}${sheet ? sheetHtml(v, d) : ''}`;
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
    return `<div class="card-box dk-racecard theme-${c.theme}"><div class="muted">${c.leagueIcon || ''} ${esc(c.leagueName || '')} · race ${c.n} of ${v.races}</div><h3>${esc(c.name)}</h3><div>📍 ${esc(c.themeName || '')} · ${W.icon} ${W.label} <span class="muted">(${esc(W.about)})</span></div>
        <div class="dk-seclist">${c.sections.map((s) => `<div><span class="leg ${typeOf(s)}">${SEC[typeOf(s)][0]} ${SEC[typeOf(s)][1]}</span> ${VAR_ICON[s.v] || ''} <span class="muted">${esc((v.variants || {})[s.v] || '')}</span></div>`).join('')}</div>
        <div class="muted">Starts in ${timer(v.endsIn)}</div></div>
      <h3>Tactic</h3><div class="dk-tactics">${Object.entries(v.tactics).map(([k, [ic, l, about]]) => `<button data-tactic="${k}" class="${d.tactic === k ? 'on' : ''}"><span>${ic}</span><b>${l}</b><small>${esc(about)}</small></button>`).join('')}</div>
      ${v.gear ? `<h3>Packed for race day</h3><p class="muted">${d.gear.length ? d.gear.map((g) => v.gear[g].icon + ' ' + v.gear[g].label).join(' · ') : 'Nothing yet.'} <button class="link" data-goshop="gear">Shop gear →</button></p>` : ''}
      ${v.predictions ? `<h3>🔮 Predict the winner</h3><p class="muted">Winner pays 30 coins, top 3 pays 10.</p><select id="dk-predict" class="dk-select"><option value="">Pick a duck…</option>${v.rivals.map((r) => `<option value="${esc(r.id)}" ${d.predict === r.id ? 'selected' : ''}>${esc(r.duck)} (${esc(r.owner)})</option>`).join('')}</select>` : ''}
      <h3>🏆 Trophy shelf</h3><div class="dk-trophies">${v.trophies.length ? v.trophies.map((t) => `<span title="${esc(v.leagues[t.league].label)}">${['🏆', '🥈', '🥉'][t.place - 1]}<small>${esc(v.leagues[t.league].label)}</small></span>`).join('') : '<span class="muted">Finish top 3 to win a trophy.</span>'}</div>`;
  }
  function pageDuck(v, d) {
    const total = Object.values(d.levels).reduce((a, b) => a + b, 0), nextSt = d.stage >= 0 ? v.stages[d.stage + 1] : null, curSt = v.stages[Math.max(0, d.stage)];
    const growPct = nextSt ? Math.round(((total - curSt.from) / (nextSt.from - curSt.from)) * 100) : 100;
    return `<div class="card-box"><label class="muted">Duck name</label><input id="dk-name" class="dk-select" maxlength="18" value="${esc(d.name)}"></div>
      <div class="card-box"><h3>🌱 ${esc(curSt.label)}</h3>${nextSt ? `<div class="dk-statrow"><span>Growing</span>${bar(growPct)}<b>${total}/${nextSt.from}</b></div><p class="muted">${nextSt.from - total} more skill levels until it grows into a ${esc(nextSt.label.toLowerCase())} (and you pick a new perk).</p>` : '<p class="muted">Fully grown. A true champion!</p>'}
        <div class="dk-perklist">${v.perks.length ? v.perks.map((p) => `<span>${p.icon} <b>${esc(p.label)}</b> <small>${esc(p.about)}</small></span>`).join('') : '<span class="muted">No perks yet. You get one each time your duck grows up.</span>'}</div></div>
      ${v.gene ? `<div class="card-box">🧬 <b>${esc(v.gene.label)}</b>: ${esc(v.gene.about)} <span class="muted">(+25% ${SK[v.gene.skill][1]} XP)</span></div>` : ''}
      ${v.neighbors.length ? `<div class="card-box"><h3>🎁 Send a gift</h3><p class="muted">5 coins: their duck gets +15 energy and you both feel good.${v.giftIn ? ' Next gift in ' + timer(v.giftIn) : ''}</p><div class="dk-gifts">${v.neighbors.slice(0, 30).map((n) => `<button data-gift="${esc(n.id)}" ${v.giftIn || d.coins < 5 ? 'disabled' : ''}>🎁 ${esc(n.owner)}</button>`).join('')}</div></div>` : ''}
      <div class="card-box"><h3>Skills</h3>${Object.entries(SK).map(([k, [ic, label, , color]]) => `<div class="dk-statrow"><span>${ic} ${label}</span><div class="bar"><i style="width:${Math.min(100, d.levels[k] * 4)}%;background:${color}"></i></div><b>Lv ${d.levels[k]}</b></div>`).join('')}</div>
      <div class="card-box"><h3>Color</h3><div class="dk-swatches">${v.colors.map((c) => `<button data-color="${c}" class="${d.color === c ? 'on' : ''}"><img src="${A().duckImg(c, 'none', 'stand', Math.max(0, d.stage))}" alt="${c}"></button>`).join('')}</div></div>
      <div class="card-box"><h3>Badges (${d.badges.length}/${Object.keys(v.badges).length})</h3><div class="dk-badges">${Object.entries(v.badges).map(([k, [ic, label, c]]) => `<span class="${d.badges.includes(k) ? 'got' : ''}" title="${esc(label)}">${ic}<small>${esc(label)}${c ? ' · ' + c + '🪙' : ''}</small></span>`).join('')}</div></div>`;
  }
  function eggPicker(v) {
    return `<div class="dk-eggs"><p class="dk-in">You’re in! 🎉 Your farm just appeared on the big screen.</p><h2>Choose your egg 🥚</h2><p class="muted">Every egg hatches into a duckling with a natural talent.</p>
      <div class="dk-eggrow">${v.eggs.map((e, i) => `<button class="dk-egg" data-hatch="${i}"><img src="${A().eggImg(e.color, e.spots)}" alt=""><b>${esc(e.label)}</b><small>${esc(e.about)}</small><span class="muted">${SK[e.skill][0]} +25% ${SK[e.skill][1]}</span></button>`).join('')}</div></div>`;
  }

  BOX.games.ducks = {
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
    fx: { raceDone: 'cheer', levelUp: 'pop', win: 'win', farm: 'join', build: 'click', badge: 'chime', event: 'knock', pet: 'pop', hatch: 'flip', grow: 'chime', spin: 'shuffle', gift: 'chime' },
    onFx(f) {
      if (f.kind === 'cheer') { race.cheers.push({ id: f.id, at: performance.now() }); if (race.cheers.length > 60) race.cheers.shift(); return; }
      if (!f.id) return;
      if (f.kind === 'farm') { tvw.born[f.id] = performance.now(); return; }
      (tvw.fxBy[f.id] = tvw.fxBy[f.id] || []).push({ kind: f.kind, at: performance.now() });
      if (tvw.fxBy[f.id].length > 4) tvw.fxBy[f.id].shift();
    },

    tv(el, s) {
      if (!s) return;
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
        tvw.mode = 'results';
        const top = s.lastRace.results.slice(0, 10), F = { ...(s.lastRace.wild || {}), ...Object.fromEntries(s.farms.map((d) => [d.id, d])) };
        const pod = [1, 0, 2].map((i) => top[i]).filter(Boolean);
        el.innerHTML = `<div class="banner">🏁 ${esc(s.lastRace.name)}: results</div><div class="dk-podium">${pod.map((r) => { const d = F[r.id] || {}; return `<div class="pod p${r.place}"><img src="${A().duckImg(d.color, d.hat, 'stand', d.stage == null ? 2 : Math.max(0, d.stage))}" alt=""><b>${esc(d.name)}</b><span class="muted">${d.wild ? '🌿 wild duck' : esc(d.owner)}</span><div class="step">${['🥇', '🥈', '🥉'][r.place - 1]}${r.wild ? '' : ' +' + r.pts + ' pts'}</div></div>`; }).join('')}</div>
          <div class="dk-res">${top.map((r) => { const d = F[r.id] || {}; return `<div class="row ${r.wild ? 'wild' : ''}"><span>${r.place}.</span><span>${esc(d.name)} <span class="muted">(${d.wild ? 'wild' : esc(d.owner)})</span></span><span class="muted">${r.time.toFixed(1)}s</span><b>${r.wild ? '—' : '+' + r.pts + ' pts · +' + r.coins + '🪙'}</b></div>`; }).join('')}</div>
          <p class="muted" style="text-align:center">${s.race >= s.races ? 'The season is over! Final standings next…' : 'Back to the farms in ' + timer(s.endsIn)}</p>`;
        return;
      }
      if (s.phase === 'over') {
        tvw.mode = 'over';
        const w = s.standings[0], d = w && s.farms.find((x) => x.id === w.id);
        el.innerHTML = `<div class="final">${d ? `<img class="dk-champ" src="${A().duckImg(d.color, 'crown', 'stand', 3)}" alt="">` : ''}<div class="muted">Champion of Duck Valley</div><h2>${esc(w ? w.duck : '')}</h2><p>raised by ${esc(w ? w.owner : '')} · ${w ? w.points : 0} points</p>
          <div class="dk-awards">${(s.awards || []).map((a) => `<div class="panel"><b>${esc(a.title)}</b><div>${esc(a.duck)}</div><div class="muted">${esc(a.owner)}</div></div>`).join('')}</div>
          ${BOX.board(s.standings.map((x) => ({ name: x.duck + ' (' + x.owner + ')', points: x.points })), (r) => r.points, ' pts')}</div>`;
        return;
      }
      tvw.farms = s.farms; tvw.weather = s.course && s.course.weather;
      if (tvw.mode !== 'valley' || !el.querySelector('#dk-valley')) {
        tvw.mode = 'valley';
        for (const f of s.farms) if (!(f.id in tvw.born)) tvw.born[f.id] = 0;
        el.innerHTML = `<div class="dk-hudrow"><div id="dk-next"></div><div class="dk-count"><div class="muted">Race starts in</div><span id="dk-timer"></span></div></div>
          <div class="dk-wrap"><canvas class="dk-valley" id="dk-valley"></canvas><aside class="dk-side"><div class="panel" id="dk-spot"></div><div class="panel"><h3>Standings</h3><div id="dk-stand"></div></div><div class="panel"><h3>Valley news</h3><div id="dk-news" class="dk-news"></div></div></aside></div>`;
        loop(el.querySelector('#dk-valley'), drawValley);
      }
      for (const f of s.farms) if (!(f.id in tvw.born)) tvw.born[f.id] = performance.now();
      el.querySelector('.dk-wrap').classList.toggle('lobby', s.phase === 'lobby');
      if (s.phase === 'lobby') {
        const hatched = s.farms.filter((f) => f.stage >= 0).length;
        el.querySelector('#dk-next').innerHTML = `<div class="muted">Welcome to</div><div class="dk-rname">🦆 Duck Valley</div><div class="muted">${s.farms.length ? `${s.farms.length} farm${s.farms.length === 1 ? '' : 's'} · ${hatched} hatched · scan the code to claim yours!` : 'Scan the code: every player gets a farm here.'}</div>`;
        el.querySelector('#dk-timer').innerHTML = '<span class="dk-wait">Waiting for the host…</span>';
        return;
      }
      const c = s.course;
      el.querySelector('#dk-next').innerHTML = `<div class="muted">${c.leagueIcon || ''} ${esc(c.leagueName || '')} · race ${s.race + 1} of ${s.races} · 📍 ${esc(c.themeName || '')} · ${s.farms.length} farm${s.farms.length === 1 ? '' : 's'}</div><div class="dk-rname">${esc(c.name)}${c.final ? ' <span class="dk-x2">×2 points</span>' : ''} ${weatherChip(c, s.weather)}</div>${course(c)}`;
      el.querySelector('#dk-timer').innerHTML = timer(s.endsIn);
      el.querySelector('#dk-spot').innerHTML = spotlight(s);
      el.querySelector('#dk-stand').innerHTML = s.race ? BOX.board(s.standings.map((x) => ({ name: x.duck, points: x.points })), (r) => r.points, ' pts') : '<p class="muted">No races yet. Train hard!</p>';
      el.querySelector('#dk-news').innerHTML = s.ticker.slice().reverse().map((t) => `<div class="n-${t.kind}">${esc(t.text)}</div>`).join('');
    },

    phone(el, v, ctx) {
      if (!v) return;
      const d = v.duck;
      hero.farm = { ...d, eggColor: v.eggs ? v.eggs[0].color : null };
      if (v.newBadge) { ctx.toast(`${v.badges[v.newBadge][0]} Badge: ${v.badges[v.newBadge][1]}! +${v.badges[v.newBadge][2]} coins`); ctx.vibrate(100); }
      if (v.eventMsg) ctx.toast(v.eventMsg);
      if (v.questDone) { ctx.toast('📜 Quest done: ' + v.questDone + '!'); ctx.sfx('chime'); }
      if (v.grew) { ctx.toast(`🌱 Your duck grew into a ${v.grew.toLowerCase()}!`); ctx.sfx('win'); ctx.vibrate(150); }
      const mount = () => {
        const slot = el.querySelector('#dk-hero-slot'); if (slot) slot.appendChild(heroCanvas());
        const h = el.querySelector('.dk-hero');
        if (h) h.onclick = async (e) => { if (e.target.closest('button')) return; const r = await ctx.act({ op: 'pet' }); if (r.ok) { petted = true; petFx.push({ kind: 'pet', at: performance.now() }); if (petFx.length > 4) petFx.shift(); ctx.sfx('pop'); ctx.vibrate(20); } };
      };
      if (v.phase === 'over') {
        el.innerHTML = `<div class="card-box" style="text-align:center"><img src="${A().duckImg(d.color, d.hat, 'stand', Math.max(0, d.stage))}" width="120" alt=""><h3>Season over!</h3><p>${esc(d.name)} finished <b>#${v.rank}</b> of ${v.of} with ${d.points} points and ${v.trophies.length} troph${v.trophies.length === 1 ? 'y' : 'ies'}.</p></div>
          ${v.awards && v.awards.length ? `<div class="card-box">${v.awards.map((a) => `<div>${esc(a.title)}: <b>${esc(a.duck)}</b> (${esc(a.owner)})</div>`).join('')}</div>` : ''}<div class="card-box">${BOX.board(v.final.map((x) => ({ name: x.duck, points: x.points })), (r) => r.points, ' pts')}</div>`;
        return;
      }
      if (v.eggs) {
        el.innerHTML = eggPicker(v);
        for (const b of el.querySelectorAll('[data-hatch]')) b.onclick = () => { b.classList.add('hatching'); ctx.sfx('flip'); ctx.vibrate(60); setTimeout(async () => { const r = await ctx.act({ op: 'hatch', pick: Number(b.dataset.hatch) }); if (r.ok) { ctx.toast('🐣 It hatched! Say hi to your duckling.'); ctx.sfx('win'); } }, 900); };
        return;
      }
      if (v.phase === 'lobby') {
        el.innerHTML = `${heroHtml(v)}<div class="card-box dk-lobbycard"><h3>🏡 Your farm is on the big screen!</h3><p class="muted">Get your duck ready while everyone joins. ${ctx && v.duck ? '' : ''}The game starts when the host presses Start.</p></div>
          <div class="card-box"><label class="muted">Name your duck</label><input id="dk-name" class="dk-select" maxlength="18" value="${esc(d.name)}"></div>
          <div class="card-box"><h3>Pick a color</h3><div class="dk-swatches">${v.colors.map((c) => `<button data-color="${c}" class="${d.color === c ? 'on' : ''}"><img src="${A().duckImg(c, d.hat, 'stand', Math.max(0, d.stage))}" alt="${c}"></button>`).join('')}</div></div>
          ${v.gene ? `<div class="card-box">🧬 <b>${esc(v.gene.label)}</b>: ${esc(v.gene.about)} <span class="muted">(+25% ${SK[v.gene.skill][1]} XP)</span></div>` : ''}`;
        mount();
        for (const b of el.querySelectorAll('[data-color]')) b.onclick = () => ctx.act({ op: 'style', color: b.dataset.color });
        const nm = el.querySelector('#dk-name'); if (nm) { nm.onchange = () => ctx.act({ op: 'style', name: nm.value }); nm.onkeydown = (e) => { if (e.key === 'Enter') nm.blur(); }; }
        return;
      }
      if (v.phase === 'race') {
        el.innerHTML = `${heroHtml(v)}<div class="card-box" style="text-align:center"><h3>🏁 Race time! Watch the big screen!</h3><p class="muted">Tactic: ${v.tactics[d.tactic][0]} ${v.tactics[d.tactic][1]}${d.gear.length && v.gear ? ' · Gear: ' + d.gear.map((g) => v.gear[g].icon).join(' ') : ''}</p><button class="btn big pink dk-cheer" id="dk-cheer">📣 CHEER!</button><p class="muted">Every tap shows above your duck on the big screen.</p></div>`;
        mount(); el.querySelector('#dk-cheer').onclick = () => { ctx.act({ op: 'cheer' }); ctx.vibrate(30); };
        return;
      }
      if (v.phase === 'results') {
        const l = d.last;
        el.innerHTML = `${heroHtml(v)}<div class="card-box" style="text-align:center"><h3>${l ? (l.place <= 3 ? ['🏆', '🥈', '🥉'][l.place - 1] + ' ' : '') + 'You finished #' + l.place + ' of ' + l.of : 'Race over'}</h3>${l ? `<p>+${l.pts} points · +${l.coins} 🪙${l.place <= 3 ? ' · a trophy for your farm!' : ''}</p><p class="muted">${l.trips ? '💫 Tripped ' + l.trips + '× · ' : ''}${l.slips ? '😱 Slipped ' + l.slips + '× · ' : ''}${l.tired ? '😮‍💨 Ran out of stamina' : 'Stamina held up'}</p>` : ''}${v.rivalWon != null ? `<p>⚔️ Rival: ${v.rivalWon ? 'you beat them! +15 coins' : 'they beat you this time.'}</p>` : ''}${v.predictWon != null ? `<p>🔮 Prediction: ${v.predictWon ? '+' + v.predictWon + ' coins!' : 'no luck this time.'}</p>` : ''}</div>`;
        mount(); return;
      }
      if (v.giftFrom) { ctx.toast(`🎁 ${v.giftFrom} sent your duck some seeds! +15 energy`); ctx.sfx('chime'); }
      if (v.perkChoice) {
        el.innerHTML = `${heroHtml(v)}${perkModal(v)}`; mount();
        for (const b of el.querySelectorAll('[data-perk]')) b.onclick = async () => { if ((await ctx.act({ op: 'perk', key: b.dataset.perk })).ok) { ctx.sfx('win'); ctx.toast('Perk learned!'); } };
        return;
      }
      const pages = { train: pageTrain, shop: pageShop, race: pageRace, duck: pageDuck };
      const next = `<div class="dk-nextbar"><span>${v.course.leagueIcon || '🏁'} <b>${esc(v.course.name)}</b> <span class="muted">· #${v.rank || '-'} · ${d.points} pts</span></span><span>${weatherChip(v.course, v.weather)} ⏱ ${timer(v.endsIn)}</span></div>`;
      el.innerHTML = `<div class="dk-phone">${heroHtml(v)}${eventCard(v)}${next}<div class="dk-page">${(pages[tab] || pageTrain)(v, d)}</div>
        <nav class="dk-nav">${[['train', '🏋️', 'Train'], ['shop', '🛒', 'Shop'], ['race', '🏁', 'Race'], ['duck', '🦆', 'My duck']].map(([k, i, l]) => `<button class="${tab === k ? 'on' : ''}" data-tab="${k}"><span>${i}</span>${l}</button>`).join('')}</nav></div>`;
      mount();
      const on = (sel, fn) => { for (const b of el.querySelectorAll(sel)) b.onclick = () => fn(b); };
      on('[data-ev]', (b) => ctx.act({ op: 'event', choice: b.dataset.ev }));
      on('[data-tab]', (b) => { tab = b.dataset.tab; ctx.redraw(); window.scrollTo(0, 0); });
      on('[data-cat]', (b) => { shopCat = b.dataset.cat; ctx.redraw(); });
      on('[data-goshop]', (b) => { tab = 'shop'; shopCat = b.dataset.goshop; ctx.redraw(); });
      on('[data-sheet]', (b) => { sheet = b.dataset.sheet; ctx.redraw(); });
      on('[data-close]', () => { sheet = null; ctx.redraw(); });
      on('[data-diff]', (b) => { sheetDiff = b.dataset.diff; ctx.redraw(); });
      on('[data-play]', async () => {
        const stat = sheet; sheet = null;
        const r = await ctx.act({ op: 'train', stat, diff: sheetDiff });
        ctx.redraw();
        if (r.ok) window.DUCK_MINI.play(r.game, r.seconds, { ...d, stage: Math.max(0, d.stage) }, (score, show) => ctx.act({ op: 'score', score }).then(show), { speed: r.speed, target: r.target, best: r.best, diff: r.diff });
      });
      on('[data-spin]', () => spinWheel(v, ctx));
      on('[data-quests]', () => { questsOpen = !questsOpen; ctx.redraw(); });
      on('[data-gift]', async (b) => { if ((await ctx.act({ op: 'gift', to: b.dataset.gift })).ok) { ctx.toast('🎁 Gift sent!'); ctx.sfx('chime'); } });
      const nap = el.querySelector('#dk-nap'); if (nap) nap.onclick = () => ctx.act({ op: 'nap' });
      on('[data-feed]', async (b) => { if ((await ctx.act({ op: 'feed', item: b.dataset.feed })).ok) { ctx.sfx('chime'); petFx.push({ kind: 'eat', at: performance.now() }); } });
      on('[data-build]', async (b) => { if ((await ctx.act({ op: 'build', item: b.dataset.build })).ok) { ctx.sfx('click'); petFx.push({ kind: 'build', at: performance.now() }); ctx.toast('Built! It’s on your farm 🏡'); } });
      on('[data-decor]', async (b) => { if ((await ctx.act({ op: 'decor', item: b.dataset.decor })).ok) { ctx.sfx('chime'); ctx.toast('Placed on your farm 🌷'); } });
      on('[data-gear]', async (b) => { if ((await ctx.act({ op: 'gear', item: b.dataset.gear })).ok) ctx.toast('Packed for race day 🎒'); });
      on('[data-tactic]', (b) => ctx.act({ op: 'tactic', tactic: b.dataset.tactic }));
      on('[data-color]', (b) => ctx.act({ op: 'style', color: b.dataset.color }));
      on('[data-hat]', (b) => { const h = b.dataset.hat; if (d.hats.includes(h)) ctx.act({ op: 'style', hat: d.hat === h ? 'none' : h }); else if (confirm(`Buy the ${HAT_NAME[h]} for ${v.hatCost} coins?`)) ctx.act({ op: 'hat', hat: h }); });
      const pr = el.querySelector('#dk-predict'); if (pr) pr.onchange = () => { if (pr.value) ctx.act({ op: 'predict', id: pr.value }); };
      const nm = el.querySelector('#dk-name'); if (nm) { nm.onchange = () => ctx.act({ op: 'style', name: nm.value }); nm.onkeydown = (e) => { if (e.key === 'Enter') nm.blur(); }; }
    },
  };
})();
