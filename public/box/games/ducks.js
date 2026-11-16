'use strict';
// JustRaiseDucks screens. TV: Duck Valley (every player's farm, live), then the side-scrolling
// race with a following camera, then the podium. Phone: your duck and farm (Train, Feed,
// Farm, Race, Style), farm events, and a cheer button on race day.
(function () {
  const { esc, timer } = BOX;
  const A = () => window.DUCK_ART;
  const SK = { run: ['🏃', 'Run', 'Hurdle Dash'], swim: ['🌊', 'Swim', 'Paddle Power'], fly: ['🪽', 'Fly', 'Sky Rings'], climb: ['🧗', 'Climb', 'Cliff Climb'], stamina: ['💪', 'Stamina', 'Bug Snack'] };
  const SEC = { track: ['🏃', 'Track', 'run'], pond: ['🌊', 'Pond', 'swim'], cliff: ['🧗', 'Cliff', 'climb'], gap: ['🪽', 'Ravine', 'fly'] };
  const HAT_NAME = { none: 'No hat', cap: 'Cap', tophat: 'Top hat', crown: 'Crown', flower: 'Flower', shades: 'Shades', bow: 'Bow', viking: 'Viking', pirate: 'Pirate', party: 'Party', chef: 'Chef', headband: 'Headband' };
  const course = (c) => (c ? `<div class="dk-legs">${c.sections.map((s) => `<span class="leg ${s}">${SEC[s][0]} ${SEC[s][1]}</span>`).join('<span class="arrow">→</span>')}</div>` : '');
  const weatherChip = (c, W) => (c && W ? `<span class="dk-weather">${W[c.weather].icon} ${W[c.weather].label}${c.wind ? (c.wind > 0 ? ' (tailwind)' : ' (headwind)') : ''}</span>` : '');
  const bar = (v, cls = '') => `<div class="bar ${cls}"><i style="width:${Math.max(0, Math.min(100, v))}%"></i></div>`;

  // ---------- TV state kept between updates (canvases keep animating) ----------
  const tvw = { mode: null, farms: [], fxBy: {}, born: {}, raf: 0, spot: 0, spotAt: 0, raceN: 0 };
  function loop(canvas, draw) {
    cancelAnimationFrame(tvw.raf);
    const step = () => { if (!document.body.contains(canvas)) return; const W = canvas.clientWidth, H = canvas.clientHeight; if (canvas.width !== W) canvas.width = W; if (canvas.height !== H) canvas.height = H; draw(canvas.getContext('2d'), W, H, performance.now() / 1000); tvw.raf = requestAnimationFrame(step); };
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
    race.ducks = Object.fromEntries(s.farms.map((f) => [f.id, f]));
    race.place = Object.fromEntries(R.results.map((r) => [r.id, r]));
    race.lanes = Object.fromEntries(R.tracks.map((tr, i) => [tr.id, i]));
    loop(canvas, drawRace);
  }
  const say = (text) => { race.msgs.push({ text, at: performance.now() }); if (race.msgs.length > 4) race.msgs.shift(); };
  function posAt(tr, simT) { const i = simT / race.R.sample, a = Math.floor(i); if (a >= tr.s.length - 1) return tr.s[tr.s.length - 1] / 10; return (tr.s[a] + (tr.s[a + 1] - tr.s[a]) * (i - a)) / 10; }
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
    // ducks: back lanes first
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
      const mode = done ? 'stand' : ev.includes('trip') ? 'stand' : gr.mode;
      art.drawDuck(g, x, y, sc, d.color, d.hat, now + lane * 0.37, mode);
      g.textAlign = 'center';
      if (ev.length) { g.font = `${22 * sc}px sans-serif`; g.fillText(ev.includes('trip') ? '💫' : ev.includes('slip') ? '😱' : ev.includes('boost') ? '⚡' : '😮‍💨', x, y - 34 * sc); }
      else if (tired) { g.font = `${14 * sc}px sans-serif`; g.fillText('💦', x - 18 * sc, y - 26 * sc); }
      if (labelled.has(p.id) || done && race.place[p.id].place <= 3) {
        g.font = `600 ${13 * sc}px Fredoka, sans-serif`; const label = (done ? ['🥇', '🥈', '🥉'][race.place[p.id].place - 1] || '#' + race.place[p.id].place : '') + ' ' + (d.name || '');
        const tw = g.measureText(label).width + 10; g.fillStyle = 'rgba(0,0,0,.55)'; const ly = y - (52 + (lane % 3) * 18) * sc; g.fillRect(x - tw / 2, ly, tw, 17 * sc); g.fillStyle = '#fff'; g.fillText(label, x, ly + 13 * sc);
      }
      g.textAlign = 'left';
      // cheers from phones float above that duck
      for (const c of race.cheers) if (c.id === p.id) { const age = (performance.now() - c.at) / 1000; if (age < 1.5) { g.globalAlpha = 1 - age / 1.5; g.font = `${18 * sc}px sans-serif`; g.fillText('📣', x + Math.sin(age * 8 + c.at) * 10, y - 60 * sc - age * 40); g.globalAlpha = 1; } }
      // commentary from events and finishes
      for (const [t, k] of p.tr.ev) { const key = p.id + t + k; if (t <= simT && !race.seenEv.has(key)) { race.seenEv.add(key); if (k === 'boost' ? labelled.has(p.id) && Math.random() < 0.5 : k !== 'tired' ? labelled.has(p.id) || R.tracks.length <= 12 : p.id === race.leader) say(`${d.name} ${k === 'trip' ? 'trips on a hurdle!' : k === 'slip' ? 'slips down the cliff!' : k === 'boost' ? 'catches a boost! ⚡' : 'is running out of steam…'}`); } }
      if (done && !race.finished.has(p.id)) { race.finished.add(p.id); const pl = race.place[p.id].place; if (pl === 1) { say(`🏆 ${d.name} WINS the ${R.name}!`); BOX.sfx('cheer'); } else if (pl <= 3) say(`${['', '🥈', '🥉'][pl - 1]} ${d.name} takes ${pl === 2 ? 'second' : 'third'}!`); }
    }
    if (lead && e > R.intro && lead.x < G.L && race.leader !== lead.id) { if (race.leader) say(`${(race.ducks[lead.id] || {}).name} takes the lead!`); race.leader = lead.id; }
    // minimap
    const mx = 20, mw = W - 40, my = 14;
    g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(mx - 6, my - 6, mw + 12, 30);
    for (const s of G.secs) { g.fillStyle = art.SEC_COLORS[s.type]; g.fillRect(mx + (s.a / G.L) * mw, my, ((s.b - s.a) / G.L) * mw, 18); }
    for (const p of pos) { const d = race.ducks[p.id] || {}; g.fillStyle = (art.PAL[d.color] || art.PAL.sunny)[0]; g.beginPath(); g.arc(mx + Math.min(1, p.x / G.L) * mw, my + 9, 5, 0, Math.PI * 2); g.fill(); }
    // commentary
    g.font = '600 22px Fredoka, sans-serif';
    race.msgs.filter((m) => performance.now() - m.at < 6000).slice(-3).forEach((m, i, arr) => { const y = H - 20 - (arr.length - 1 - i) * 34, tw = g.measureText(m.text).width + 24; g.fillStyle = 'rgba(20,10,40,.75)'; g.fillRect(16, y - 26, tw, 32); g.fillStyle = '#fff'; g.fillText(m.text, 28, y - 4); });
    // countdown / intro card
    if (e < R.intro) {
      g.fillStyle = 'rgba(10,5,30,.45)'; g.fillRect(0, 0, W, H); g.textAlign = 'center'; g.fillStyle = '#fff';
      g.font = '700 54px Fredoka, sans-serif'; g.fillText(R.name + (R.final ? ' (double points!)' : ''), W / 2, H * 0.32);
      const left = Math.ceil((R.intro - e) / 1000);
      if (left <= 3) { g.font = '800 150px Fredoka, sans-serif'; g.fillStyle = '#ffd23f'; g.fillText(String(left), W / 2, H * 0.62); if (race.beep !== left) { race.beep = left; BOX.sfx('tick'); } }
      g.textAlign = 'left';
    } else if (!race.go) { race.go = true; BOX.sfx('start'); say('QUACK! And they’re off!'); }
  }

  // ---------- Duck Valley on the TV ----------
  function drawValley(g, W, H, now) { A().drawValley(g, W, H, tvw.farms, now, tvw.fxBy, tvw.born, tvw.weather); }
  function spotlight(s) {
    if (!s.farms.length) return '';
    if (Date.now() - tvw.spotAt > 7000) { tvw.spot = (tvw.spot + 1) % s.farms.length; tvw.spotAt = Date.now(); }
    const f = s.farms.slice().sort((a, b) => a.plot - b.plot)[tvw.spot % s.farms.length];
    const L = f.levels;
    return `<div class="dk-spot"><img src="${A().duckImg(f.color, f.hat)}" alt=""><div><b>${esc(f.name)}</b><div class="muted">${esc(f.owner)}’s farm · ${A().MOOD(f.mood)}</div>
      ${Object.entries(SK).map(([k, [ic]]) => `<div class="dk-mini"><span>${ic}</span>${bar(L[k] * 4)}<b>${L[k]}</b></div>`).join('')}
      <div class="muted">${f.wins ? '🏆×' + f.wins + ' · ' : ''}${f.badges ? '🏅×' + f.badges + ' · ' : ''}${Object.values(f.buildings).reduce((a, b) => a + b, 0)} upgrades</div></div></div>`;
  }

  // ---------- phone ----------
  let tab = 'train', petFx = 0;
  function header(v) {
    const d = v.duck;
    return `<div class="dk-me"><button class="dk-pet" id="dk-pet" title="Pet your duck"><img src="${A().duckImg(d.color, d.hat)}" alt="Your duck">${Date.now() - petFx < 900 ? '<span class="hearts">❤️</span>' : ''}</button>
      <div class="dk-mestats"><b>${esc(d.name)}</b><div class="muted">#${v.rank || '-'} of ${v.of} · ${d.points} pts · 🪙 <b>${d.coins}</b></div>
      <div class="dk-bars"><span>⚡</span>${bar(d.energy)}<span>${d.energy}</span><span>${A().MOOD(d.mood)}</span>${bar(d.mood, 'mood')}<span>${d.mood}</span></div>
      <div class="dk-lvls">${Object.entries(SK).map(([k, [ic]]) => `<span>${ic}${d.levels[k]}</span>`).join('')}</div></div></div>`;
  }
  function eventCard(v) {
    const e = v.event; if (!e) return '';
    return `<div class="card-box dk-event"><b>${{ fox: '🦊', gift: '🎁', trader: '🛒', storm: '🌧️', duckling: '🐣' }[e.kind]} ${esc(e.text)}</b> <span class="muted">${timer(e.endsIn)}</span><div class="pr-btns">${e.choices.map(([k, l]) => `<button class="btn" data-ev="${k}">${esc(l)}</button>`).join('')}</div></div>`;
  }

  BOX.games.ducks = {
    name: 'JustRaiseDucks', icon: '🦆',
    about: 'Everyone gets a farm in Duck Valley. Raise a racing duck with phone mini-games, then race the whole valley on the big screen.',
    how: [
      'Join and a new farm appears in Duck Valley on the big screen. Your duck lives there.',
      'Train five skills with mini-games: Run 🏃, Swim 🌊, Fly 🪽, Climb 🧗 and Stamina 💪.',
      'Coins buy food, farm buildings (train faster), decorations, hats and race-day gear.',
      'Keep your duck happy (pet it, feed it treats): happy ducks learn faster, grumpy ducks slack off.',
      'Every few minutes everyone races an obstacle course: hurdles, ponds, cliffs and ravines. The next course and weather are shown in advance.',
      'Pick a race tactic, predict the winner for coins, and cheer from your phone during the race!',
    ],
    fx: { raceDone: 'cheer', levelUp: 'pop', win: 'win', farm: 'join', build: 'click', badge: 'chime', event: 'knock', pet: 'pop' },
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
          el.innerHTML = `<div class="dk-racehead"><span class="dk-rname">🏁 ${esc(s.lastRace.name)}</span><span class="muted">Race ${s.lastRace.n} of ${s.races}</span>${weatherChip(s.lastRace, s.weather)}</div><canvas class="dk-race" id="dk-race"></canvas>`;
          setupRace(s, el.querySelector('#dk-race'));
        }
        return;
      }
      if (s.phase === 'results') {
        tvw.mode = 'results';
        const top = s.lastRace.results.slice(0, 10), F = Object.fromEntries(s.farms.map((d) => [d.id, d]));
        const pod = [1, 0, 2].map((i) => top[i]).filter(Boolean);
        el.innerHTML = `<div class="banner">🏁 ${esc(s.lastRace.name)}: results</div><div class="dk-podium">${pod.map((r) => { const d = F[r.id] || {}; return `<div class="pod p${r.place}"><img src="${A().duckImg(d.color, d.hat)}" alt=""><b>${esc(d.name)}</b><span class="muted">${esc(d.owner)}</span><div class="step">${['🥇', '🥈', '🥉'][r.place - 1]} +${r.pts} pts</div></div>`; }).join('')}</div>
          <div class="dk-res">${top.map((r) => `<div class="row"><span>${r.place}.</span><span>${esc((F[r.id] || {}).name)} <span class="muted">(${esc((F[r.id] || {}).owner)})</span></span><span class="muted">${r.time.toFixed(1)}s</span><b>+${r.pts} pts · +${r.coins}🪙</b></div>`).join('')}</div>
          <p class="muted" style="text-align:center">${s.race >= s.races ? 'The season is over! Final standings next…' : 'Back to the farms in ' + timer(s.endsIn)}</p>`;
        return;
      }
      if (s.phase === 'over') {
        tvw.mode = 'over';
        const w = s.standings[0], d = w && s.farms.find((x) => x.id === w.id);
        el.innerHTML = `<div class="final">${d ? `<img class="dk-champ" src="${A().duckImg(d.color, 'crown')}" alt="">` : ''}<div class="muted">Champion of Duck Valley</div><h2>${esc(w ? w.duck : '')}</h2><p>raised by ${esc(w ? w.owner : '')} · ${w ? w.points : 0} points</p>
          <div class="dk-awards">${(s.awards || []).map((a) => `<div class="panel"><b>${esc(a.title)}</b><div>${esc(a.duck)}</div><div class="muted">${esc(a.owner)}</div></div>`).join('')}</div>
          ${BOX.board(s.standings.map((x) => ({ name: x.duck + ' (' + x.owner + ')', points: x.points })), (r) => r.points, ' pts')}</div>`;
        return;
      }
      // Training: Duck Valley.
      tvw.farms = s.farms; tvw.weather = s.course && s.course.weather;
      if (tvw.mode !== 'valley') {
        tvw.mode = 'valley';
        for (const f of s.farms) if (!(f.id in tvw.born)) tvw.born[f.id] = 0;
        el.innerHTML = `<div class="dk-hudrow"><div id="dk-next"></div><div class="dk-count"><div class="muted">Race starts in</div><span id="dk-timer"></span></div></div>
          <div class="dk-wrap"><canvas class="dk-valley" id="dk-valley"></canvas><aside class="dk-side"><div class="panel" id="dk-spot"></div><div class="panel"><h3>Standings</h3><div id="dk-stand"></div></div><div class="panel"><h3>Valley news</h3><div id="dk-news" class="dk-news"></div></div></aside></div>`;
        loop(el.querySelector('#dk-valley'), drawValley);
      }
      for (const f of s.farms) if (!(f.id in tvw.born)) tvw.born[f.id] = performance.now();
      el.querySelector('#dk-next').innerHTML = `<div class="muted">Next race (${s.race + 1} of ${s.races}) · ${s.farms.length} farm${s.farms.length === 1 ? '' : 's'}</div><div class="dk-rname">${esc(s.course.name)}${s.course.final ? ' <span class="dk-x2">×2 points</span>' : ''} ${weatherChip(s.course, s.weather)}</div>${course(s.course)}`;
      el.querySelector('#dk-timer').innerHTML = timer(s.endsIn);
      el.querySelector('#dk-spot').innerHTML = spotlight(s);
      el.querySelector('#dk-stand').innerHTML = s.race ? BOX.board(s.standings.map((x) => ({ name: x.duck, points: x.points })), (r) => r.points, ' pts') : '<p class="muted">No races yet. Train hard!</p>';
      el.querySelector('#dk-news').innerHTML = s.ticker.slice().reverse().map((t) => `<div class="n-${t.kind}">${esc(t.text)}</div>`).join('');
    },

    phone(el, v, ctx) {
      if (!v) return;
      const d = v.duck;
      if (v.newBadge) { ctx.toast(`${v.badges[v.newBadge][0]} Badge: ${v.badges[v.newBadge][1]}! +${v.badges[v.newBadge][2]} coins`); ctx.vibrate(100); }
      if (v.eventMsg) ctx.toast(v.eventMsg);
      if (v.questDone) { ctx.toast('📜 Quest done: ' + v.questDone + '!'); ctx.sfx('chime'); }
      if (v.phase === 'over') {
        el.innerHTML = `<div class="card-box" style="text-align:center"><img src="${A().duckImg(d.color, d.hat)}" width="120" alt=""><h3>Season over!</h3><p>${esc(d.name)} finished <b>#${v.rank}</b> of ${v.of} with ${d.points} points.</p></div>
          ${v.awards && v.awards.length ? `<div class="card-box">${v.awards.map((a) => `<div>${esc(a.title)}: <b>${esc(a.duck)}</b> (${esc(a.owner)})</div>`).join('')}</div>` : ''}<div class="card-box">${BOX.board(v.final.map((x) => ({ name: x.duck, points: x.points })), (r) => r.points, ' pts')}</div>`;
        return;
      }
      if (v.phase === 'race') {
        el.innerHTML = `${header(v)}<div class="card-box" style="text-align:center"><h3>🏁 Race time! Watch the big screen!</h3><p class="muted">Tactic: ${v.tactics[d.tactic][0]} ${v.tactics[d.tactic][1]}${d.gear.length ? ' · Gear: ' + d.gear.map((g) => v.gear ? v.gear[g].icon : '').join(' ') : ''}</p><button class="btn big pink dk-cheer" id="dk-cheer">📣 CHEER!</button><p class="muted">Every tap shows on the big screen above your duck.</p></div>`;
        el.querySelector('#dk-cheer').onclick = () => { ctx.act({ op: 'cheer' }); ctx.vibrate(30); };
        return;
      }
      if (v.phase === 'results') {
        const l = d.last;
        el.innerHTML = `${header(v)}<div class="card-box" style="text-align:center"><h3>${l ? (l.place <= 3 ? ['🥇', '🥈', '🥉'][l.place - 1] + ' ' : '') + 'You finished #' + l.place + ' of ' + l.of : 'Race over'}</h3>${l ? `<p>+${l.pts} points · +${l.coins} 🪙</p><p class="muted">${l.trips ? '💫 Tripped ' + l.trips + '× · ' : ''}${l.slips ? '😱 Slipped ' + l.slips + '× · ' : ''}${l.tired ? '😮‍💨 Ran out of stamina' : 'Stamina held up'}</p>` : ''}${v.rivalWon != null ? `<p>⚔️ Rival: ${v.rivalWon ? 'you beat them! +15 coins' : 'they beat you this time.'}</p>` : ''}${v.predictWon != null ? `<p>🔮 Prediction: ${v.predictWon ? '+' + v.predictWon + ' coins!' : 'no luck this time.'}</p>` : ''}</div>`;
        return;
      }
      const tabs = `<div class="dk-tabs">${[['train', '🏋️', 'Train'], ['feed', '🍎', 'Feed'], ['farm', '🏡', 'Farm'], ['race', '🏁', 'Race'], ['style', '🎨', 'Style']].map(([k, i, l]) => `<button class="${tab === k ? 'on' : ''}" data-tab="${k}"><span>${i}</span>${l}</button>`).join('')}</div>`;
      const next = `<div class="card-box dk-nextbox"><div><b>${esc(v.course.name)}</b>${v.course.final ? ' <span class="dk-x2">×2</span>' : ''} in ${timer(v.endsIn)} ${weatherChip(v.course, v.weather)}</div>${course(v.course)}</div>`;
      let body = '';
      if (tab === 'train') {
        const needs = [...new Set(v.course.sections.map((s) => SEC[s][2]))];
        const quests = v.quests && v.quests.length ? `<div class="card-box dk-quests"><b>📜 Quests</b>${v.quests.map((q) => `<div class="q ${q.done ? 'done' : ''}"><span>${q.done ? '✅' : '⬜'} ${esc(q.text)}</span><span class="muted">${q.done ? 'done' : q.have + '/' + q.n} · 🪙${q.reward}</span></div>`).join('')}${v.rival ? `<div class="q rival">⚔️ Rival: <b>${esc(v.rival.name)}</b> <span class="muted">(${esc(v.rival.owner)}) · beat them next race for 🪙15</span></div>` : ''}</div>` : '';
        body = `${quests}${v.napLeft ? `<div class="big-status">💤 Napping… ${timer(v.napLeft)}</div>` : ''}<div class="dk-train">${Object.entries(SK).map(([k, [icon, label, game]]) => { const p = d.progress[k]; return `<button class="dk-tb ${needs.includes(k) || k === 'stamina' ? 'need' : ''}" data-train="${k}" ${v.napLeft || d.energy < v.trainCost ? 'disabled' : ''}><span class="i">${icon}</span><b>${label} · Lv ${d.levels[k]}</b><span class="muted">${game}</span>${bar(p ? Math.round((p.have / p.need) * 100) : 100)}</button>`; }).join('')}
          <button class="dk-tb" id="dk-nap" ${v.napLeft ? 'disabled' : ''}><span class="i">💤</span><b>Nap</b><span class="muted">${v.napSeconds}s, free energy</span></button></div>
          <p class="muted" style="text-align:center">Training costs ${v.trainCost} ⚡ · ✨ = skills the next course needs.</p>`;
      } else if (tab === 'feed') {
        body = `<div class="dk-shop">${Object.entries(v.food).map(([k, it]) => `<button class="dk-item" data-feed="${k}" ${d.coins < it.cost ? 'disabled' : ''}><span class="i">${it.icon}</span><span><b>${esc(it.label)}</b><br><span class="muted">${esc(it.about)}</span></span><span class="cost">🪙 ${it.cost}</span></button>`).join('')}</div>`;
      } else if (tab === 'farm') {
        body = `<h3>Buildings</h3><div class="dk-shop">${Object.entries(v.buildings).map(([k, b]) => { const lvl = d.buildings[k], cost = v.buildCost[lvl]; return `<button class="dk-item" data-build="${k}" ${lvl >= 3 || d.coins < cost ? 'disabled' : ''}><span class="i">${b.icon}</span><span><b>${esc(b.label)} ${'★'.repeat(lvl)}${'☆'.repeat(3 - lvl)}</b><br><span class="muted">${esc(b.about)}</span></span><span class="cost">${lvl >= 3 ? 'MAX' : '🪙 ' + cost}</span></button>`; }).join('')}</div>
          <h3>Decorations</h3><div class="dk-decor">${Object.entries(v.decor).map(([k, [ic, label, cost]]) => `<button data-decor="${k}" class="${d.decor.includes(k) ? 'on' : ''}" ${d.decor.includes(k) || d.coins < cost ? 'disabled' : ''}><span>${ic}</span><small>${esc(label)}<br>${d.decor.includes(k) ? '✓' : '🪙' + cost}</small></button>`).join('')}</div>
          <h3>Badges (${d.badges.length}/${Object.keys(v.badges).length})</h3><div class="dk-badges">${Object.entries(v.badges).map(([k, [ic, label, c]]) => `<span class="${d.badges.includes(k) ? 'got' : ''}" title="${esc(label)}">${ic}<small>${esc(label)}${c ? ' · ' + c + '🪙' : ''}</small></span>`).join('')}</div>`;
      } else if (tab === 'race') {
        const W = v.weather[v.course.weather];
        body = `<div class="card-box"><b>${W.icon} ${W.label}:</b> <span class="muted">${esc(W.about)}</span><p class="muted" style="margin:6px 0 0">Course: ${v.course.sections.map((s) => SEC[s][0] + ' ' + SEC[s][1] + ' needs ' + SK[SEC[s][2]][1]).join(' · ')}.</p></div>
          <h3>Tactic</h3><div class="dk-tactics">${Object.entries(v.tactics).map(([k, [ic, l, about]]) => `<button data-tactic="${k}" class="${d.tactic === k ? 'on' : ''}"><span>${ic}</span><b>${l}</b><small>${esc(about)}</small></button>`).join('')}</div>
          ${v.gear ? `<h3>Race-day gear <span class="muted" style="font-size:14px">(used up after the race)</span></h3><div class="dk-shop">${Object.entries(v.gear).map(([k, it]) => `<button class="dk-item ${d.gear.includes(k) ? 'on' : ''}" data-gear="${k}" ${d.gear.includes(k) || d.coins < it.cost ? 'disabled' : ''}><span class="i">${it.icon}</span><span><b>${esc(it.label)}</b><br><span class="muted">${esc(it.about)}</span></span><span class="cost">${d.gear.includes(k) ? 'Packed ✓' : '🪙 ' + it.cost}</span></button>`).join('')}</div>` : ''}
          ${v.predictions ? `<h3>🔮 Predict the winner</h3><p class="muted">Winner pays 30 coins, top 3 pays 10.</p><select id="dk-predict" class="dk-select"><option value="">Pick a duck…</option>${v.rivals.map((r) => `<option value="${esc(r.id)}" ${d.predict === r.id ? 'selected' : ''}>${esc(r.duck)} (${esc(r.owner)})</option>`).join('')}</select>` : ''}`;
      } else {
        body = `<div class="card-box"><label class="muted">Duck name</label><input id="dk-name" class="dk-select" maxlength="18" value="${esc(d.name)}"></div>
          <div class="card-box"><h3>Color</h3><div class="dk-swatches">${v.colors.map((c) => `<button data-color="${c}" class="${d.color === c ? 'on' : ''}"><img src="${A().duckImg(c, 'none')}" alt="${c}"></button>`).join('')}</div></div>
          <div class="card-box"><h3>Hats <span class="muted" style="font-size:14px">🪙 ${v.hatCost} each</span></h3><div class="dk-swatches">${v.hats.map((h) => `<button data-hat="${h}" class="${d.hat === h ? 'on' : ''}"><img src="${A().duckImg(d.color, h)}" alt=""><small>${HAT_NAME[h]}${d.hats.includes(h) ? '' : ' · 🪙' + v.hatCost}</small></button>`).join('')}</div></div>`;
      }
      el.innerHTML = `${header(v)}${eventCard(v)}${next}${tabs}${body}`;
      el.querySelector('#dk-pet').onclick = async () => { const r = await ctx.act({ op: 'pet' }); if (r.ok) { petFx = Date.now(); ctx.sfx('pop'); ctx.vibrate(20); ctx.redraw(); } };
      for (const b of el.querySelectorAll('[data-ev]')) b.onclick = () => ctx.act({ op: 'event', choice: b.dataset.ev });
      for (const b of el.querySelectorAll('[data-tab]')) b.onclick = () => { tab = b.dataset.tab; ctx.redraw(); };
      for (const b of el.querySelectorAll('[data-train]')) b.onclick = async () => {
        const r = await ctx.act({ op: 'train', stat: b.dataset.train });
        if (r.ok) window.DUCK_MINI.play(r.game, r.seconds, d, (score, show) => ctx.act({ op: 'score', score }).then(show));
      };
      const nap = el.querySelector('#dk-nap'); if (nap) nap.onclick = () => ctx.act({ op: 'nap' });
      for (const b of el.querySelectorAll('[data-feed]')) b.onclick = async () => { if ((await ctx.act({ op: 'feed', item: b.dataset.feed })).ok) { ctx.sfx('chime'); ctx.toast('Yum! 🦆'); } };
      for (const b of el.querySelectorAll('[data-build]')) b.onclick = async () => { if ((await ctx.act({ op: 'build', item: b.dataset.build })).ok) { ctx.sfx('click'); ctx.toast('Built! Look at your farm on the big screen 🏡'); } };
      for (const b of el.querySelectorAll('[data-decor]')) b.onclick = () => ctx.act({ op: 'decor', item: b.dataset.decor });
      for (const b of el.querySelectorAll('[data-gear]')) b.onclick = () => ctx.act({ op: 'gear', item: b.dataset.gear });
      for (const b of el.querySelectorAll('[data-tactic]')) b.onclick = () => ctx.act({ op: 'tactic', tactic: b.dataset.tactic });
      const pr = el.querySelector('#dk-predict'); if (pr) pr.onchange = () => { if (pr.value) ctx.act({ op: 'predict', id: pr.value }); };
      for (const b of el.querySelectorAll('[data-color]')) b.onclick = () => ctx.act({ op: 'style', color: b.dataset.color });
      for (const b of el.querySelectorAll('[data-hat]')) b.onclick = () => { const h = b.dataset.hat; if (d.hats.includes(h)) ctx.act({ op: 'style', hat: h }); else if (confirm(`Buy the ${HAT_NAME[h]} for ${v.hatCost} coins?`)) ctx.act({ op: 'hat', hat: h }); };
      const nm = el.querySelector('#dk-name'); if (nm) { nm.onchange = () => ctx.act({ op: 'style', name: nm.value }); nm.onkeydown = (e) => { if (e.key === 'Enter') nm.blur(); }; }
    },
  };
})();
