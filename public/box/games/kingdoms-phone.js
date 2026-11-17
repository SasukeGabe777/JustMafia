'use strict';
// JustKingdoms phone: the seat picker (a round table) in the lobby, then five tabs while playing:
// 🏰 Kingdom (workers, next goal, build), ⚔️ Army (train, garrisons, send an army), 🗺️ Map (a pannable
// hex map kept alive across re-renders; tap a tile for a sheet of actions), 🤝 Allies (offers,
// alliance, monument, market, kingdoms) and 🔬 Research (three tracks, rocket). Live numbers
// (resources, countdowns, progress bars, red cost chips) are filled in by a ticker so the HTML only
// changes when something real changes, and identical repaints are skipped.
// The TV file (kingdoms-tv.js) defines the other fields of BOX.games.kingdoms; this only adds phone().
(function () {
  const { esc, mmss } = BOX;
  const RESK = ['food', 'wood', 'stone', 'gold', 'sci'];
  const RI = { food: '🌾', wood: '🪵', stone: '🪨', gold: '🪙', sci: '🔬' };
  const RN = { food: 'Food', wood: 'Wood', stone: 'Stone', gold: 'Gold', sci: 'Science' };
  const JOBK = ['farm', 'chop', 'quarry', 'mine', 'study'];
  const JOB_LOCK = { quarry: 'Age 2', mine: 'Age 3', study: 'Needs Library' };
  const ORDER = { attack: ['⚔️', 'Attack'], claim: ['🚩', 'Claim'], move: ['🚶', 'Move to'], reinforce: ['🛡️', 'Reinforce'], scout: ['🔭', 'Scout'], return: ['🏠', 'Returning home'] };
  const TRACKS = [['economy', '💰', 'Economy'], ['war', '⚔️', 'War'], ['science', '🔬', 'Science']];
  const T_COLOR = { p: '#9cc35a', f: '#3f7f3c', h: '#ad9268', g: '#d9b440', l: '#3f8fd4', m: '#80818c', r: '#cdb487' };
  const UNIT_NOTE = { peasant: 'Works your land', scout: 'Spies on a tile, never fights', settlers: 'Founds a new village', militia: 'Cheap defence', catapult: 'Smashes walls', guard: 'Elite: tough and strong' };
  const VILLAGE_UP = [null, { wood: 100, stone: 60 }, { wood: 180, stone: 120 }];
  const VILLAGE_WALL = [{ stone: 60 }, { stone: 110 }, { stone: 180 }];
  const WIN_HOW = { conquest: '⚔️ conquered the world', diplomacy: '🕊️ built the Peace Monument together', science: '🚀 launched a rocket to the stars', score: '👑 had the best Kingdom Score' };
  const DIRS = [[1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1]]; // edge i of a pointy hex faces DIRS[i]

  // ---------- phone state that survives re-renders ----------
  let tab = 'kingdom', sheet = null, nameDraft = null, techSel = null, kOpen = null, jobsLocal = null, jobsSeq = 0;
  let lastAlert = null, lastHtml = '', V = null, CTX = null, VIEW = null, recvAt = 0, ticker = 0;
  const qty = {}; // training quantity per unit
  const DET = {}; // which <details> are open (morph keeps the attribute in sync)
  const ENDS = {};
  let base = { res: {}, rates: {}, at: 0 };
  const market = { give: 'food', get: 'gold', n: 60 };

  const kName = (id) => { const k = V && V.kingdoms && V.kingdoms.find((x) => x.id === id); return k ? k.name : '?'; };
  const kOf = (id) => V && V.kingdoms && V.kingdoms.find((x) => x.id === id);
  const dot = (c) => `<i class="kp-dot" style="background:${esc(c || '#888')}"></i>`;
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
  const fmt = (n) => { n = Math.max(0, Math.floor(n)); return n >= 10000 ? (n / 1000).toFixed(n >= 100000 ? 0 : 1) + 'k' : String(n); };
  const rate = (r) => (r >= 0 ? '+' : '−') + Math.abs(r).toFixed(Math.abs(r) >= 10 ? 0 : 1);
  const key = (q, r) => q + ',' + r;
  const hexDist = (a, b) => (Math.abs(a.q - b.q) + Math.abs(a.q + a.r - b.q - b.r) + Math.abs(a.r - b.r)) / 2;
  const gameNow = () => (V ? V.now + (Date.now() - recvAt) : 0);
  // A countdown end time that stays put for the same thing, so identical renders stay identical.
  function endAt(k, endsIn) { const t = Date.now() + endsIn; const o = ENDS[k]; if (o && Math.abs(o - t) < 1500) return o; ENDS[k] = t; return t; }
  // Live bits are rendered with their current value too, so a morph never blanks them between ticks.
  const cd = (k, endsIn) => { if (endsIn == null) return ''; const e = endAt(k, endsIn); return `<span class="timer" data-ends="${e}">${mmss(e - Date.now())}</span>`; };
  const pctOf = (e, dur) => Math.max(0, Math.min(100, 100 * (1 - (e - Date.now()) / (Number(dur) || 1))));
  const bar = (k, endsIn, dur) => { if (endsIn == null) return '<div class="kp-bar"><i style="width:0%"></i></div>'; const e = endAt(k, endsIn); return `<div class="kp-bar"><i data-end="${e}" data-dur="${dur}" style="width:${pctOf(e, dur)}%"></i></div>`; };
  // Cost chips turn red live (the ticker compares them with your interpolated stock).
  const chips = (cost) => (cost ? Object.entries(cost).filter(([, n]) => n > 0).map(([r, n]) => `<span class="kp-c${resNow(r) < Math.ceil(n) ? ' miss' : ''}" data-need="${r}" data-amt="${Math.ceil(n)}">${RI[r]} ${fmt(Math.ceil(n))}</span>`).join('') : '');
  const resNow = (r) => Math.max(0, (base.res[r] || 0) + (base.rates[r] || 0) * (Date.now() - base.at) / 1000);
  const resB = (r) => `<b data-res="${r}">${fmt(resNow(r))}</b>`;
  const afford = (cost) => !cost || Object.entries(cost).every(([r, n]) => resNow(r) >= n);
  const stars = (lvl, max) => `<span class="kp-stars">${'★'.repeat(Math.min(lvl, max))}<i>${'★'.repeat(Math.max(0, max - lvl))}</i></span>`;
  const secs = (s) => (s >= 60 ? `${Math.floor(s / 60)}m ${Math.round(s % 60)}s` : `${Math.round(s)}s`);
  const isLock = (why) => !!why && /needs|only for|Research .* first/i.test(why) && !/Not enough/i.test(why);
  const CASTLE = ['🏰', '🛖', '🏘️', '🏰', '🏯', '🏰'];
  const ageInfo = (v, n) => ({ ...(v.defs.ages[n - 1] || { name: '' }), icon: CASTLE[n] || '🏰' });
  const J = (o) => esc(JSON.stringify(o));

  // ---------- the live ticker (4×/s): resources, bars, red chips ----------
  function tick() {
    const root = document.querySelector('.kp-root'); if (!root) return;
    for (const el of root.querySelectorAll('[data-res]')) { const t = fmt(resNow(el.dataset.res)); if (el.textContent !== t) el.textContent = t; }
    const now = Date.now();
    for (const el of root.querySelectorAll('[data-end]')) { const w = pctOf(Number(el.dataset.end), el.dataset.dur) + '%'; if (el.style.width !== w) el.style.width = w; }
    for (const el of root.querySelectorAll('.kp-c[data-need]')) el.classList.toggle('miss', resNow(el.dataset.need) < Number(el.dataset.amt));
    for (const el of root.querySelectorAll('[data-ends]')) { const t = mmss(Number(el.dataset.ends) - now); if (el.textContent !== t) el.textContent = t; }
    for (const el of root.querySelectorAll('[data-afford]')) { const c = JSON.parse(el.dataset.afford); el.disabled = !afford(c); }
  }

  // ---------- lobby: where are you sitting? ----------
  function lobbyHtml(v, view) {
    const myId = view.me.id, n = Math.max(2, v.tableSize || 2);
    const bySeat = {}; for (const s of v.seats) if (s.seat != null) bySeat[s.seat] = s;
    const R = 41; // % radius of the chair ring
    const chairs = [];
    for (let i = 0; i < n; i++) {
      const a = (-90 + 360 * (i + 0.5) / n) * Math.PI / 180, x = 50 + R * Math.cos(a), y = 50 + R * Math.sin(a), s = bySeat[i];
      const mine = s && s.id === myId;
      chairs.push(`<button class="kp-chair ${s ? 'taken' : 'free'} ${mine ? 'mine' : ''}" style="left:${x}%;top:${y}%;${s ? `--c:${esc(s.color)}` : ''}" data-seat="${i}" ${s && !mine ? 'disabled' : ''}>
        <span class="kp-chair-seat">${s ? esc((s.name || '?').replace(/ 🤖/, '').slice(0, 2)) : '🪑'}</span><span class="kp-chair-name">${s ? (mine ? 'You' : esc(s.name)) : 'Free'}</span></button>`);
    }
    const unseated = v.seats.filter((s) => s.seat == null);
    const me = v.seats.find((s) => s.id === myId);
    if (nameDraft == null) nameDraft = v.kingdomName;
    return `<div class="kp-lobby">
      <div class="kp-card kp-center"><h3>🪑 Where are you sitting?</h3><p class="kp-sub">Tap the chair where you really sit, as seen from above (the TV is at the top). Your neighbours on the couch will be your neighbours on the map.</p>
        <div class="kp-table-wrap"><div class="kp-tv">📺 TV</div><div class="kp-table"><span>👑</span></div>${chairs.join('')}</div>
        <p class="kp-sub">${me && me.seat != null ? '✅ You’re seated. Tap your chair again to stand up.' : '👆 Tap a free chair.'}</p>
        ${unseated.length ? `<p class="kp-sub small">Not seated yet: ${unseated.map((s) => `${dot(s.color)}${esc(s.id === myId ? 'You' : s.name)}`).join(' · ')}<br>(anyone without a chair fills the gaps in join order)</p>` : ''}
      </div>
      <div class="kp-card"><h3>🏰 Name your kingdom</h3><div class="kp-row"><input id="kp-name" maxlength="24" value="${esc(nameDraft)}" autocomplete="off"><button class="btn small" data-rename>Save</button></div>
        <p class="kp-sub small">Shown on the TV map next to your castle. Now: <b>${esc(v.kingdomName)}</b></p></div>
      <div class="kp-card kp-how"><h3>📜 How it works</h3><ul><li>🧑‍🌾 Put peasants to work: food, wood, stone, gold.</li><li>🏗️ Build, then climb 5 ages from Hamlet to Kingdom.</li><li>🗺️ Found villages, train an army, make friends (or enemies).</li><li>🏆 Win by conquest, a peace monument or a rocket!</li></ul></div>
    </div>`;
  }

  // ---------- header (always visible in play) ----------
  function headHtml(v) {
    const me = v.me, A = ageInfo(v, me.age);
    const resRow = RESK.map((r) => `<div class="kp-r ${(v.rates[r] || 0) < 0 ? 'neg' : ''}"><span>${RI[r]}</span>${resB(r)}<small>${rate(v.rates[r] || 0)}/s</small></div>`).join('');
    const banners = [];
    const C = v.council;
    if (C) banners.push(`<button class="kp-alert council ${C.mine ? '' : 'vote'}" data-sheet="${J({ kind: 'vote' })}">🗳️ <b>${esc(C.ask)}</b> ${C.mine ? `· you voted ${esc(kName(C.mine))} ✓` : '· <u>Tap to vote</u>'} <span class="kp-cd">${cd('council' + C.id, C.endsIn)}</span></button>`);
    if (v.progress && v.progress.peaceIn != null) banners.push(`<div class="kp-alert calm">🕊️ The world is at peace in ${cd('peacehold', v.progress.peaceIn)}! Anyone who leaves the alliance breaks it.</div>`);
    for (const a of v.incoming) banners.push(`<button class="kp-alert bad" data-center="${a.to.q},${a.to.r}">⚔️ <b>${esc(a.name)}</b> is attacking your ${a.capital ? 'capital' : 'land'} with ${a.n}! <span class="kp-cd">${cd('i' + a.id, a.endsIn)}</span></button>`);
    if (v.starving) banners.push('<button class="kp-alert bad" data-tab="kingdom">🍞 Your people are starving! Production is halved. Move workers to 🌾 Farm.</button>');
    if (me.vassalOf) banners.push(`<button class="kp-alert warn" data-tab="allies">⛓️ You are a vassal of <b>${esc(kName(me.vassalOf))}</b> (25% tribute)</button>`);
    if (v.peaceIn > 0) banners.push(`<div class="kp-alert calm">🕊️ Beginner’s peace: capitals are safe for ${cd('peace', v.peaceIn)}</div>`);
    const ev = v.events && v.events.current;
    if (ev) banners.push(`<div class="kp-alert calm">${esc(ev.icon)} ${esc(ev.text)}</div>`);
    const tags = [];
    if (me.underdog > 0) tags.push(`<span class="kp-tag good" title="You are behind: your people work harder">🔥 +${Math.round(me.underdog * 100)}%</span>`);
    if (me.sanction > 0) tags.push(`<span class="kp-tag bad" title="Council sanctions">⚖️ −30% ${cd('sanction', me.sanction)}</span>`);
    if (me.marked) tags.push('<span class="kp-tag bad" title="The world has united against you">🎯 Coalition</span>');
    if (me.bounty) tags.push(`<span class="kp-tag bad" title="Gold on your head">💰 ${me.bounty}</span>`);
    return `<div class="kp-head">
      <div class="kp-title">${dot(me.color)}<b>${esc(me.name)}</b><span class="kp-age">${A.icon} Age ${me.age}</span>${tags.join('')}<span class="kp-clock">⏳ ${cd('time', v.timeLeft)}</span></div>
      <div class="kp-res">${resRow}<div class="kp-r pop ${v.pop >= v.cap ? 'neg' : ''}"><span>👥</span><b>${v.pop}/${v.cap}</b><small>people</small></div></div>
      ${banners.join('')}</div>`;
  }

  // ---------- 🏰 Kingdom ----------
  function nextGoal(v) {
    const W = curWorkers(v), A = v.available, me = v.me;
    const bld = (b) => A.buildings.find((x) => x.b === b);
    const unit = (u) => A.units.find((x) => x.u === u);
    const btnBuild = (b) => { const B = bld(b); return B ? `<button class="btn small" data-op="${J({ op: 'build', b })}" data-ok="🏗️ ${esc(B.name)} added to the build queue">Build ${esc(B.name)}</button>` : ''; };
    if (v.incoming.length) return { icon: '🛡️', title: 'You’re under attack!', text: 'Soldiers at home defend your capital. Train some now.', extra: '<button class="btn small" data-tab="army">⚔️ Train soldiers</button>' };
    if (W.idle > 0) return { icon: '😴', title: `${plural(W.idle, 'peasant')} doing nothing`, text: 'Tap <b>+</b> on a job below, or let your steward decide. Food 🌾 and wood 🪵 come first.', extra: AUTO_BTN };
    if (v.starving || (v.rates.food || 0) < 0) return { icon: '🍞', title: 'Food is running out', text: 'Move a worker to 🌾 Farm (tap + next to Farm) or build a bigger Farm.', extra: btnBuild('farm') };
    const houses = bld('houses');
    if (v.pop >= v.cap) {
      if (houses && houses.lvl < houses.max && !v.queue.some((q) => q.b === 'houses')) return { icon: '🏠', title: 'Build Houses so you can grow', text: 'Your kingdom is full. Houses give room for 4 more people.', cost: houses.cost, extra: btnBuild('houses') };
      if (me.age >= 2) return { icon: '🛻', title: 'Found a new village', text: 'Villages give room for more people. Train Settlers, then tap a free tile next to your land on the 🗺️ Map.', extra: '<button class="btn small" data-tab="map">🗺️ Open the map</button>' };
    }
    const dg = decreeGoal(v, bld, unit, btnBuild); if (dg) return dg;
    const peasant = unit('peasant');
    if (v.peasants < 6 + me.age * 2 && v.pop < v.cap && peasant && v.training.filter((t) => t.u === 'peasant').length < 2) return { icon: '🧑‍🌾', title: 'Train more peasants', text: 'More workers means more of everything.', cost: peasant.cost, extra: `<button class="btn small" data-op="${J({ op: 'train', u: 'peasant', n: 1 })}" data-ok="🧑‍🌾 A peasant is on the way">Train a peasant</button>` };
    const age = A.age;
    if (age && v.queue.some((q) => q.b === 'castle')) return { icon: '⏳', title: `Age ${age.next} is on its way`, text: 'Your castle is growing. Meanwhile, build and train what you can.' };
    if (age && age.can) return { icon: CASTLE[age.next], title: `Advance to Age ${age.next}: ${esc(age.name)}`, text: 'You can afford it! A new age unlocks new buildings and units.', cost: age.cost, extra: `<button class="btn small green" data-op="${J({ op: 'age' })}" data-ok="${CASTLE[age.next]} Age ${age.next} is being built">Advance now</button>` };
    if (me.age >= 2 && me.villages === 0) return { icon: '🛻', title: 'Found your first village', text: 'Train Settlers (⚔️ Army), then tap a free tile next to your land on the 🗺️ Map and choose Claim.', extra: '<button class="btn small" data-tab="army">⚔️ Train Settlers</button>' };
    if (me.age >= 3 && !v.buildings.library && bld('library')) return { icon: '📚', title: 'Build a Library', text: 'It unlocks research and the 🔬 Study job.', cost: bld('library').cost, extra: btnBuild('library') };
    if (age) {
      const lack = Object.keys(age.missing || {}).map((r) => `${RI[r]} ${RN[r]}`);
      return { icon: CASTLE[age.next], title: `Save up for Age ${age.next}: ${esc(age.name)}`, text: lack.length ? `You still need more ${lack.join(', ')}. Put more workers on those jobs.` : 'Keep your workers busy.', cost: age.cost };
    }
    if (v.rocket) return { icon: '🚀', title: 'Build your rocket', text: 'Three stages, then launch to win!', extra: '<button class="btn small" data-tab="research">🚀 Rocket</button>' };
    return { icon: '👑', title: 'You rule a Kingdom!', text: 'Win by conquest, peace or science. Check the 🤝 Allies and 🔬 Research tabs.' };
  }
  // The active Royal Decree as the next goal, with the one button that moves it forward.
  const AUTO_BTN = `<button class="btn small green" data-op="${esc(JSON.stringify({ op: 'jobs', auto: true }))}" data-ok="⚖️ Workers sent where they’re needed">⚖️ Auto workers</button>`;
  function decreeGoal(v, bld, unit, btnBuild) {
    const Dc = v.decree; if (!Dc) return null;
    const A = v.available, age = A.age, me = v.me;
    const g = { icon: Dc.icon, title: esc(Dc.title), text: esc(Dc.hint), decree: Dc };
    const train = (u, n, label) => { const U = unit(u); return U ? `<button class="btn small" data-op="${J({ op: 'train', u, n })}" data-ok="${esc(U.icon)} Training ${n} ${esc(U.name)}" ${U.why && !/Not enough/.test(U.why) ? 'disabled' : ''}>${label}</button>` : ''; };
    const ageBtn = () => (age && v.queue.some((q) => q.b === 'castle') ? '<small class="kp-sub">⏳ Your castle is growing…</small>'
      : age && age.can ? `<button class="btn small green" data-op="${J({ op: 'age' })}" data-ok="${CASTLE[age.next]} Age ${age.next} is being built">${CASTLE[age.next]} Advance now</button>` : AUTO_BTN);
    switch (Dc.key) {
      case 'work': g.extra = AUTO_BTN; break;
      case 'houses': { const H = bld('houses'); g.cost = H && H.cost; g.extra = btnBuild('houses'); break; }
      case 'peasants': { const P = unit('peasant'); g.text += ` (${v.peasants}/6)`; g.cost = P && P.cost; g.extra = train('peasant', 1, '🧑‍🌾 Train a peasant'); break; }
      case 'age2': case 'age3': case 'age4': if (age) { g.cost = age.cost; g.extra = ageBtn(); } break;
      case 'village': {
        const has = v.units.some((t) => t.units.settlers > 0) || v.myArmies.some((a) => a.order === 'claim');
        g.extra = has ? `<button class="btn small green" data-targets="">🚩 Pick a tile to claim</button>` : train('settlers', 1, '🛻 Train Settlers'); break;
      }
      case 'army': { const best = ['guard', 'knight', 'archer', 'spear', 'militia'].map(unit).find((U) => U && !(U.why && !/Not enough/.test(U.why))); g.text += ` (${me.army}/6)`; if (best) { g.cost = Object.fromEntries(Object.entries(best.cost || {}).map(([r, n]) => [r, n * 3])); g.extra = train(best.u, 3, `${best.icon} Train 3 ${esc(best.name)}`); } break; }
      case 'library': { const L = bld('library'); g.cost = L && L.cost; g.extra = btnBuild('library'); break; }
      case 'friend': g.extra = '<button class="btn small" data-tab="allies">🤝 Open Allies</button>'; break;
      case 'path': g.extra = '<button class="btn small" data-tab="allies">🕊️ Allies</button> <button class="btn small" data-tab="research">🚀 Rocket</button>'; break;
      default:
    }
    return g;
  }
  function curWorkers(v) {
    if (!jobsLocal) return v.workers;
    const w = { ...jobsLocal }; w.idle = v.peasants - JOBK.reduce((a, j) => a + (w[j] || 0), 0); return w;
  }
  function scene(v) {
    const b = v.buildings, A = ageInfo(v, v.me.age);
    const built = Object.entries(v.defs.buildings).filter(([k]) => b[k] > 0).map(([k, B]) => `<span title="${esc(B.name)}">${B.icon}${b[k] > 1 ? `<sub>${b[k]}</sub>` : ''}</span>`).join('');
    const ppl = Math.min(12, v.peasants);
    return `<div class="kp-scene age${v.me.age}"><div class="kp-sky"></div><div class="kp-castle">${A.icon}</div><div class="kp-blds">${built || '<span class="kp-sub">no buildings yet</span>'}</div>
      <div class="kp-folk">${'🧑‍🌾'.repeat(ppl)}${v.peasants > 12 ? `<small>+${v.peasants - 12}</small>` : ''}</div><div class="kp-scene-cap">${A.icon} <b>${esc(A.name)}</b> · ${plural(v.me.land, 'tile')} · ${plural(v.me.villages, 'village')} · ⭐ ${v.me.score}</div></div>`;
  }
  function pageKingdom(v) {
    const W = curWorkers(v), g = nextGoal(v);
    const jobs = JOBK.map((j) => {
      const J0 = v.defs.jobs[j], open = v.jobsOpen[j], n = W[j] || 0;
      return `<div class="kp-job ${open ? '' : 'locked'}"><span class="kp-job-ic">${J0.icon}</span><div class="kp-job-t"><b>${esc(J0.name)}</b><small>${open ? `${RI[J0.res]} +${(v.perWorker[j] || 0).toFixed(2)}/s each` : '🔒 ' + JOB_LOCK[j]}</small></div>
        <div class="kp-step"><button data-job="${j}" data-d="-1" ${!open || n <= 0 ? 'disabled' : ''}>−</button><b>${n}</b><button data-job="${j}" data-d="1" ${!open || W.idle <= 0 ? 'disabled' : ''}>+</button></div></div>`;
    }).join('');
    const A = v.available, age = A.age;
    const ageCard = age ? (() => {
      const queued = v.queue.some((q) => q.b === 'castle');
      return `<div class="kp-bcard kp-agecard ${age.can ? 'can' : ''}"><div class="kp-bic">${CASTLE[age.next]}</div><div class="kp-bt"><b>Advance to Age ${age.next}: ${esc(age.name)}</b><small>Unlocks new buildings and units</small><div class="kp-cost">${chips(age.cost)} <span class="kp-time">⏱ ${secs(age.time || 0)}</span></div>
        ${age.why && !/Not enough/.test(age.why) ? `<small class="kp-why">${esc(age.why)}</small>` : ''}</div><button class="btn small green" data-op="${J({ op: 'age' })}" data-ok="Your castle is growing!" ${age.can && !queued ? '' : 'disabled'}>${queued ? 'Building…' : 'Advance'}</button></div>`;
    })() : '<div class="kp-card kp-center">👑 You reached the last age!</div>';
    const now = A.buildings.filter((B) => !isLock(B.why) || /needs the/.test(B.why)).filter((B) => !(B.lvl >= B.max && !B.can));
    const maxed = A.buildings.filter((B) => B.lvl >= B.max);
    const later = A.buildings.filter((B) => isLock(B.why) && !/needs the/.test(B.why) && B.lvl < B.max);
    const card = (B) => `<div class="kp-bcard ${B.can ? 'can' : ''}"><div class="kp-bic">${B.icon}</div><div class="kp-bt"><b>${esc(B.name)} ${stars(B.lvl, B.max)}</b><small>${esc(B.about)}</small>
      <div class="kp-cost">${chips(B.cost)} <span class="kp-time">⏱ ${secs(B.time || 0)}</span></div>${B.why && !/Not enough/.test(B.why) ? `<small class="kp-why">${esc(B.why)}</small>` : ''}</div>
      <button class="btn small" data-op="${J({ op: 'build', b: B.b })}" data-ok="🏗️ ${esc(B.name)} queued" ${B.can ? '' : 'disabled'}>${B.lvl ? 'Upgrade' : 'Build'}</button></div>`;
    const queue = v.queue.length ? v.queue.map((q, i) => `<div class="kp-qrow"><span>${q.b === 'castle' ? ageInfo(v, q.lvl).icon : (v.defs.buildings[q.b] || {}).icon || '🏗️'}</span><div class="kp-qt"><b>${esc(q.name)}${q.b !== 'castle' ? ` → Lv ${q.lvl}` : ''}</b>${i === 0 ? bar('q' + q.b + q.lvl, q.endsIn, q.dur) : '<small>waiting…</small>'}</div><span class="kp-cd">${i === 0 ? cd('q' + q.b + q.lvl, q.endsIn) : ''}</span><button class="kp-x" data-op="${J({ op: 'cancel', queue: 'build', i })}" data-ok="Cancelled (refunded)">✕</button></div>`).join('') : '<p class="kp-sub">Nothing is being built. Pick something below!</p>';
    const news = (v.alerts || []).slice(-5).reverse().map((a) => `<div class="kp-news ${a.kind}">${esc(a.text)}</div>`).join('');
    return `${scene(v)}
      <div class="kp-card kp-goal"><div class="kp-goal-ic">${g.icon}</div><div class="kp-goal-t"><small>${g.decree ? `📜 ROYAL DECREE ${g.decree.n} OF ${g.decree.of}` : 'NEXT GOAL'}</small><b>${g.title}</b><p>${g.text}</p>${g.cost ? `<div class="kp-cost">${chips(g.cost)}</div>` : ''}${g.decree ? `<div class="kp-reward">🎁 Reward: ${Object.entries(g.decree.reward).map(([r, n]) => `${RI[r]} ${n}`).join(' ')}</div>` : ''}<div class="kp-goal-btns">${g.extra || ''}</div></div></div>
      <div class="kp-card"><h3>🧑‍🌾 Workers <span class="kp-h-r">${W.idle > 0 ? `<b class="kp-idle">${W.idle} idle</b>` : `${v.peasants} busy`}</span><button class="kp-auto" data-op="${J({ op: 'jobs', auto: true })}" data-ok="⚖️ Workers sent where they’re needed">⚖️ Auto</button></h3>${jobs}
        <p class="kp-sub small">Each person eats 🌾. Food now: <b class="${(v.rates.food || 0) < 0 ? 'kp-neg' : 'kp-pos'}">${rate(v.rates.food || 0)}/s</b></p></div>
      <div class="kp-card"><h3>🏗️ Build queue <span class="kp-h-r">${v.queue.length}/3</span></h3>${queue}</div>
      <div class="kp-card"><h3>⬆️ Grow your castle</h3>${ageCard}</div>
      <div class="kp-card"><h3>🧱 Build</h3>${now.map(card).join('') || '<p class="kp-sub">Nothing new to build right now.</p>'}
        ${later.length ? `<details class="kp-more" data-det="later" ${DET.later ? 'open' : ''}><summary>🔒 Coming in later ages (${later.length})</summary>${later.map((B) => `<div class="kp-lock">${B.icon} <b>${esc(B.name)}</b> <small>${esc(B.why)}</small></div>`).join('')}</details>` : ''}
        ${maxed.length ? `<p class="kp-sub small">✅ Done: ${maxed.map((B) => B.icon + ' ' + esc(B.name)).join(' · ')}</p>` : ''}</div>
      ${news ? `<div class="kp-card"><h3>📜 Royal news</h3>${news}</div>` : ''}`;
  }

  // ---------- ⚔️ Army ----------
  const fighters = (u) => Object.entries(u || {}).reduce((a, [k, n]) => a + (k === 'scout' || k === 'settlers' ? 0 : n), 0);
  const unitChips = (v, units) => Object.entries(units || {}).filter(([, n]) => n > 0).map(([u, n]) => `<span class="kp-u">${(v.defs.units[u] || {}).icon || '?'} ${n}</span>`).join('') || '<span class="kp-sub">nobody</span>';
  const tileLabel = (v, t) => {
    if (!t) return 'a tile';
    const k = t.o ? kOf(t.o) : null, who = !t.o ? '' : t.o === v.me.id ? 'your ' : esc(k ? k.name : '?') + '’s ';
    const what = t.c ? 'capital' : t.v ? 'village' : (v.defs.terrain[t.t] || {}).name.toLowerCase();
    return `${who}${what} at ${t.q},${t.r}`;
  };
  function pageArmy(v) {
    const strong = (u) => { const d = v.defs.units[u.u] || {}; if (d.vs) return 'Strong vs ' + Object.entries(d.vs).map(([x, m]) => `${(v.defs.units[x] || {}).name}s ×${m}`).join(', '); return UNIT_NOTE[u.u] || ''; };
    const avail = v.available.units.filter((u) => !isLock(u.why)), locked = v.available.units.filter((u) => isLock(u.why));
    const tcard = (u) => {
      const n = qty[u.u] || 1, cost = {}; for (const r in u.cost || {}) cost[r] = u.cost[r] * n;
      return `<div class="kp-ucard"><div class="kp-uhead"><span class="kp-bic">${u.icon}</span><div><b>${esc(u.name)}</b><small>${esc(strong(u))}</small></div></div>
        <div class="kp-stats"><span>⚔️ ${u.atk}</span><span>🛡️ ${u.def}</span><span>👟 ${u.speed}s/hex</span><span>⏱ ${secs(u.time * n)}</span></div>
        <div class="kp-cost">${chips(cost)}</div>${u.why && !/Not enough (res|room)/.test(u.why) ? `<small class="kp-why">${esc(u.why)}</small>` : ''}
        <div class="kp-urow"><div class="kp-qty">${[1, 5, 10].map((x) => `<button class="${n === x ? 'on' : ''}" data-qty="${u.u}" data-n="${x}">${x}</button>`).join('')}</div>
        <button class="btn small" data-op="${J({ op: 'train', u: u.u, n })}" data-ok="${esc(u.icon)} Training ${n} ${esc(u.name)}" ${u.why && !/Not enough res/.test(u.why) ? 'disabled' : ''}>Train ${n}</button></div></div>`;
    };
    const training = v.training.length ? v.training.map((t, i) => `<div class="kp-qrow"><span>${(v.defs.units[t.u] || {}).icon}</span><div class="kp-qt"><b>${t.n} × ${esc(t.name)}</b>${i === 0 ? bar('t' + t.u + t.n + t.dur, t.endsIn, t.dur) : '<small>waiting…</small>'}</div><span class="kp-cd">${i === 0 ? cd('t' + t.u + t.n + t.dur, t.endsIn) : ''}</span><button class="kp-x" data-op="${J({ op: 'cancel', queue: 'train', i })}" data-ok="Cancelled (refunded)">✕</button></div>`).join('') : '<p class="kp-sub">Nobody in training.</p>';
    const gar = v.units.length ? v.units.map((t) => `<div class="kp-gar"><div><b>${t.capital ? '🏰 Capital' : t.v ? '🏠 Village' : '🚩 Land'}</b> <small class="kp-sub">${t.q},${t.r}</small><div>${unitChips(v, t.units)}</div></div><button class="btn small ghost" data-targets="${t.q},${t.r}">Send…</button></div>`).join('') : '<p class="kp-sub">No units at home. Train some below.</p>';
    const marching = v.myArmies.length ? v.myArmies.map((a) => { const T = tileAt(a.to.q, a.to.r), O = ORDER[a.order] || ['🚶', a.order]; return `<div class="kp-qrow"><span>${O[0]}</span><div class="kp-qt"><b>${O[1]} ${tileLabel(v, T || a.to)}</b><div>${unitChips(v, a.units)}</div>${bar('a' + a.id, a.endsIn, a.t1 - a.t0)}</div><span class="kp-cd">${cd('a' + a.id, a.endsIn)}</span></div>`; }).join('') : '<p class="kp-sub">No armies on the move.</p>';
    return `<div class="kp-card kp-center"><button class="btn big kp-sendbtn" data-targets="">🚩 Send an army…</button><p class="kp-sub small">Attack a neighbour, claim land with Settlers, scout, or help an ally. Units at home defend you.</p></div>
      <div class="kp-card"><h3>🏃 On the move</h3>${marching}</div>
      <div class="kp-card"><h3>🛡️ Your garrisons${v.units.some((t) => !t.capital && fighters(t.units)) ? `<button class="kp-auto" data-op="${J({ op: 'recall' })}" data-ok="🏠 Everyone is marching home">🏠 Recall all</button>` : ''}</h3>${gar}</div>
      <div class="kp-card"><h3>⏳ Training <span class="kp-h-r">${v.training.length}/5</span></h3>${training}</div>
      <div class="kp-card"><h3>🎯 Train units <span class="kp-h-r">👥 ${v.pop}/${v.cap}</span></h3>${v.pop >= v.cap ? '<div class="kp-sum warn">🏠 Your kingdom is full (' + v.pop + '/' + v.cap + ' people). Build Houses or found villages to make room.</div>' : ''}${avail.map(tcard).join('')}
        ${locked.length ? `<details class="kp-more" data-det="units" ${DET.units ? 'open' : ''}><summary>🔒 Locked units (${locked.length})</summary>${locked.map((u) => `<div class="kp-lock">${u.icon} <b>${esc(u.name)}</b> <small>⚔️${u.atk} 🛡️${u.def} · ${esc(u.why)}</small></div>`).join('')}</details>` : ''}</div>`;
  }

  // ---------- send-army sheets ----------
  function orderFor(v, T, units) {
    const only = Object.keys(units).filter((u) => units[u] > 0);
    const onlyScouts = only.length > 0 && only.every((u) => u === 'scout');
    const rel = T.o ? (kOf(T.o) || {}).rel : null;
    if (onlyScouts && T.o !== v.me.id) return 'scout';
    if (T.o === v.me.id) return 'move';
    if (T.o && rel === 'ally') return 'reinforce';
    if (!T.o && units.settlers) return 'claim';
    return 'attack';
  }
  function adjacentToMine(v, T) { return DIRS.some(([dq, dr]) => { const n = tileAt(T.q + dq, T.r + dr); return n && n.o === v.me.id; }); }
  function targetList(v) {
    const home = v.me.home, mine = [], enemy = [], free = [], ally = [];
    const hasSettlers = v.units.some((t) => t.units.settlers > 0);
    for (const t of v.world.tiles) {
      const pass = (v.defs.terrain[t.t] || {}).pass; if (!pass) continue;
      const d = hexDist(home, t), rel = t.o ? (kOf(t.o) || {}).rel : null;
      if (t.o === v.me.id) { if (t.c || t.v) mine.push([d, t]); }
      else if (!t.o) { if (adjacentToMine(v, t)) free.push([d, t]); }
      else if (rel === 'ally') { if (t.c || t.v) ally.push([d, t]); }
      else if (rel !== 'liege' && rel !== 'vassal' && (t.c || t.v || adjacentToMine(v, t))) enemy.push([d, t]);
    }
    const srt = (l) => l.sort((a, b) => a[0] - (a[1].c ? 3 : a[1].v ? 2 : 0) - b[0] + (b[1].c ? 3 : b[1].v ? 2 : 0)).slice(0, 8).map((x) => x[1]);
    const row = (t, label, extra) => `<button class="kp-trow" data-target="${t.q},${t.r}"><span class="kp-tic">${t.c ? '🏰' : t.v ? '🏠' : (v.defs.terrain[t.t] || {}).icon}</span><span class="kp-tt"><b>${label}</b><small>${extra}</small></span><span>›</span></button>`;
    const sec = [];
    const en = srt(enemy); if (en.length) sec.push(`<h4>⚔️ Enemies nearby</h4>${en.map((t) => { const k = kOf(t.o) || {}; return row(t, `${dot(k.color)}${esc(k.name)} · ${t.c ? 'capital' : t.v ? 'village' : 'land'}`, `${plural(hexDist(home, t), 'hex').replace('hexs', 'hexes')} away · garrison ≈ ${t.g}${t.w ? ` · 🧱 walls ${t.w}` : ''}`); }).join('')}`);
    const fr = srt(free); if (fr.length && v.me.age >= 2) sec.push(`<h4>🚩 Free land to claim ${hasSettlers ? '' : '<small>(needs Settlers)</small>'}</h4>${fr.map((t) => row(t, `${(v.defs.terrain[t.t] || {}).name}${t.x ? ' ✨ rich' : ''} at ${t.q},${t.r}`, `${plural(hexDist(home, t), 'hex').replace('hexs', 'hexes')} away`)).join('')}`);
    const al = srt(ally); if (al.length) sec.push(`<h4>🛡️ Allies to reinforce</h4>${al.map((t) => { const k = kOf(t.o) || {}; return row(t, `${dot(k.color)}${esc(k.name)} · ${t.c ? 'capital' : 'village'}`, `${plural(hexDist(home, t), 'hex').replace('hexs', 'hexes')} away`); }).join('')}`);
    const mi = srt(mine); if (mi.length > 1) sec.push(`<h4>🏠 Your own places</h4>${mi.map((t) => row(t, `Your ${t.c ? 'capital' : 'village'} at ${t.q},${t.r}`, `garrison ${t.g}`)).join('')}`);
    return sec.join('') || '<p class="kp-sub">No targets in sight yet. Grow your land!</p>';
  }
  function sendSheet(v) {
    const S = sheet, T = tileAt(S.to.q, S.to.r);
    if (!T) return '<p class="kp-sub">That tile is out of sight.</p>';
    const srcs = v.units.filter((t) => Object.values(t.units).some((n) => n > 0) && !(t.q === T.q && t.r === T.r));
    if (!srcs.length) return `<h3>No units to send</h3><p class="kp-sub">Train some units in the ⚔️ Army tab first.</p><button class="btn" data-tab="army">⚔️ Train units</button>`;
    if (!S.from || !srcs.some((t) => key(t.q, t.r) === S.from)) { const best = srcs.slice().sort((a, b) => hexDist(a, T) - hexDist(b, T) || fighters(b.units) - fighters(a.units))[0]; S.from = key(best.q, best.r); S.units = {}; }
    const F = srcs.find((t) => key(t.q, t.r) === S.from);
    const units = S.units = Object.fromEntries(Object.entries(S.units || {}).filter(([u, n]) => n > 0 && F.units[u]).map(([u, n]) => [u, Math.min(n, F.units[u])]));
    const steps = Object.entries(F.units).filter(([, n]) => n > 0).map(([u, have]) => { const d = v.defs.units[u] || {}, n = units[u] || 0; return `<div class="kp-job"><span class="kp-job-ic">${d.icon}</span><div class="kp-job-t"><b>${esc(d.name)}</b><small>${have} here · ⚔️${d.atk} 🛡️${d.def}</small></div>
      <div class="kp-step"><button data-su="${u}" data-d="-1" ${n <= 0 ? 'disabled' : ''}>−</button><b>${n}</b><button data-su="${u}" data-d="1" ${n >= have ? 'disabled' : ''}>+</button><button class="kp-all" data-su="${u}" data-d="all">All</button></div></div>`; }).join('');
    const total = Object.values(units).reduce((a, n) => a + n, 0);
    const order = orderFor(v, T, units), O = ORDER[order];
    let slow = 0; for (const u in units) if (units[u] > 0) slow = Math.max(slow, (v.defs.units[u] || {}).speed || 5);
    const eta = Math.round(hexDist(F, T) * slow * ((v.research.done || []).includes('logistics') ? 0.8 : 1));
    const warn = [];
    if (order === 'attack' && !fighters(units)) warn.push('Pick some soldiers: Scouts and Settlers can’t fight.');
    if (order === 'attack' && T.c && v.peaceIn > 0) warn.push('Capitals are protected during the beginner’s peace.');
    if (order === 'claim' && !adjacentToMine(v, T)) warn.push('Settlers can only claim a free tile next to your land.');
    if (order === 'scout' && T.o === v.me.id) warn.push('That’s your own land.');
    const k = T.o ? kOf(T.o) : null;
    const summary = total ? `${O[0]} <b>${O[1]} ${tileLabel(v, T)}</b> · arrives in about ${mmss(eta * 1000)}${order === 'attack' ? ` · their garrison ≈ ${T.g}${T.w ? ` behind 🧱 walls ${T.w}` : ''}` : ''}` : 'Pick who goes with the + buttons.';
    return `<h3>${O[0]} Send an army</h3>
      <div class="kp-target">${k ? dot(k.color) : ''}<b>To: ${tileLabel(v, T)}</b> <small>(${(v.defs.terrain[T.t] || {}).name})</small></div>
      ${srcs.length > 1 ? `<div class="kp-from"><small>From:</small>${srcs.map((t) => `<button class="${key(t.q, t.r) === S.from ? 'on' : ''}" data-from="${t.q},${t.r}">${t.capital ? '🏰' : '🏠'} ${t.q},${t.r} <small>(${Object.values(t.units).reduce((a, n) => a + n, 0)})</small></button>`).join('')}</div>` : ''}
      ${steps}
      <div class="kp-sum ${warn.length ? 'warn' : ''}">${summary}${warn.map((w) => `<div>⚠️ ${w}</div>`).join('')}</div>
      <button class="btn big ${order === 'attack' ? 'pink' : 'green'} kp-wide" data-send ${total && !warn.length ? '' : 'disabled'}>${O[0]} ${O[1] === 'Move to' ? 'Move' : O[1]}${total ? ` with ${total}` : ''}</button>`;
  }

  // ---------- 🗺️ Map (canvas kept alive) ----------
  const MAP = { cv: null, s: 26, cx: 0, cy: 0, centred: null, sel: null, tiles: new Map(), armies: [], sig: '', dirty: true, raf: 0, P: new Map(), drag: null, lastDraw: 0 };
  const tileAt = (q, r) => MAP.tiles.get(key(q, r));
  const hexXY = (q, r) => [Math.sqrt(3) * (q + r / 2), 1.5 * r];
  function pickHex(px, py) {
    const W = MAP.cv.clientWidth, H = MAP.cv.clientHeight;
    const x = (px - W / 2) / MAP.s + MAP.cx, y = (py - H / 2) / MAP.s + MAP.cy;
    let q = (Math.sqrt(3) / 3 * x - y / 3), r = 2 / 3 * y, s = -q - r;
    let rq = Math.round(q), rr = Math.round(r); const rs = Math.round(s);
    const dq = Math.abs(rq - q), dr = Math.abs(rr - r), ds = Math.abs(rs - s);
    if (dq > dr && dq > ds) rq = -rr - rs; else if (dr > ds) rr = -rq - rs;
    return tileAt(rq, rr);
  }
  function centreOn(q, r) { const [x, y] = hexXY(q, r); MAP.cx = x; MAP.cy = y; MAP.dirty = true; }
  function ensureMap() {
    if (MAP.cv) return MAP.cv;
    const cv = MAP.cv = document.createElement('canvas'); cv.className = 'kp-map';
    const pos = (e) => { const b = cv.getBoundingClientRect(); return { x: e.clientX - b.left, y: e.clientY - b.top }; };
    cv.addEventListener('pointerdown', (e) => {
      try { cv.setPointerCapture(e.pointerId); } catch { /* */ }
      MAP.P.set(e.pointerId, pos(e)); if (MAP.P.size === 1) MAP.drag = { moved: 0 };
    });
    cv.addEventListener('pointermove', (e) => {
      if (!MAP.P.has(e.pointerId)) return;
      const p = pos(e), old = MAP.P.get(e.pointerId);
      if (MAP.P.size === 1) { MAP.cx -= (p.x - old.x) / MAP.s; MAP.cy -= (p.y - old.y) / MAP.s; if (MAP.drag) MAP.drag.moved += Math.abs(p.x - old.x) + Math.abs(p.y - old.y); }
      else if (MAP.P.size === 2) {
        const [a, b] = [...MAP.P.entries()].map(([id, v]) => (id === e.pointerId ? p : v));
        const [a0, b0] = [...MAP.P.values()];
        const d1 = Math.hypot(a.x - b.x, a.y - b.y), d0 = Math.hypot(a0.x - b0.x, a0.y - b0.y);
        if (d0 > 10) zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, d1 / d0);
        if (MAP.drag) MAP.drag.moved += 99;
      }
      MAP.P.set(e.pointerId, p); MAP.dirty = true;
    });
    const up = (e) => {
      if (!MAP.P.has(e.pointerId)) return;
      const p = MAP.P.get(e.pointerId); MAP.P.delete(e.pointerId);
      if (!MAP.P.size && MAP.drag && MAP.drag.moved < 10 && e.type === 'pointerup') { const t = pickHex(p.x, p.y); if (t) { MAP.sel = { q: t.q, r: t.r }; sheet = { kind: 'tile', q: t.q, r: t.r }; MAP.dirty = true; if (CTX) { CTX.sfx('click'); CTX.redraw(); } } }
      if (!MAP.P.size) MAP.drag = null;
    };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    cv.addEventListener('wheel', (e) => { e.preventDefault(); const p = pos(e); zoomAt(p.x, p.y, e.deltaY < 0 ? 1.15 : 1 / 1.15); }, { passive: false });
    return cv;
  }
  function zoomAt(px, py, f) {
    const W = MAP.cv.clientWidth, H = MAP.cv.clientHeight, s0 = MAP.s, s1 = Math.max(12, Math.min(64, s0 * f));
    const wx = (px - W / 2) / s0 + MAP.cx, wy = (py - H / 2) / s0 + MAP.cy;
    MAP.s = s1; MAP.cx = wx - (px - W / 2) / s1; MAP.cy = wy - (py - H / 2) / s1; MAP.dirty = true;
  }
  function mapLoop() {
    cancelAnimationFrame(MAP.raf);
    const step = (t) => {
      if (!MAP.cv || !document.body.contains(MAP.cv)) { MAP.raf = 0; return; }
      if (MAP.dirty || (MAP.armies.length && t - MAP.lastDraw > 66)) { drawMap(); MAP.lastDraw = t; MAP.dirty = false; }
      MAP.raf = requestAnimationFrame(step);
    };
    MAP.raf = requestAnimationFrame(step);
  }
  function drawMap() {
    const cv = MAP.cv, dpr = Math.min(2, window.devicePixelRatio || 1), W = cv.clientWidth, H = cv.clientHeight;
    if (!W || !H) return;
    if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = '#16314a'; g.fillRect(0, 0, W, H);
    const s = MAP.s, sx = (q, r) => { const [x, y] = hexXY(q, r); return [(x - MAP.cx) * s + W / 2, (y - MAP.cy) * s + H / 2]; };
    const corner = (x, y, i, rr) => { const a = (60 * i - 30) * Math.PI / 180; return [x + rr * Math.cos(a), y + rr * Math.sin(a)]; };
    const hex = (x, y, rr) => { g.beginPath(); for (let i = 0; i < 6; i++) { const [cx, cy] = corner(x, y, i, rr); if (i) g.lineTo(cx, cy); else g.moveTo(cx, cy); } g.closePath(); };
    const col = (id) => { const k = kOf(id); return k ? k.color : '#999'; };
    const vis = [];
    for (const t of MAP.tiles.values()) { const [x, y] = sx(t.q, t.r); if (x < -s * 2 || y < -s * 2 || x > W + s * 2 || y > H + s * 2) continue; vis.push([t, x, y]); }
    for (const [t, x, y] of vis) {
      hex(x, y, s * 0.98); g.fillStyle = T_COLOR[t.t] || '#888'; g.fill();
      if (t.o) { g.fillStyle = col(t.o) + '66'; g.fill(); }
      if (t.x) { g.strokeStyle = 'rgba(255,230,140,0.55)'; g.lineWidth = 1.5; hex(x, y, s * 0.8); g.stroke(); }
    }
    // borders between different owners
    g.lineCap = 'round';
    for (const [t, x, y] of vis) {
      if (!t.o) continue;
      for (let i = 0; i < 6; i++) {
        const n = tileAt(t.q + DIRS[i][0], t.r + DIRS[i][1]); if (n && n.o === t.o) continue;
        const [x1, y1] = corner(x, y, i, s * 0.93), [x2, y2] = corner(x, y, i + 1, s * 0.93);
        g.strokeStyle = col(t.o); g.lineWidth = t.o === (V.me && V.me.id) ? 3.5 : 2.5; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
      }
    }
    g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const [t, x, y] of vis) {
      let ic = null, size = s * 0.8;
      if (t.c) { const k = kOf(t.c); ic = k ? ageInfo(V, k.age).icon : '🏰'; size = s * 1.05; } else if (t.v) ic = '🏠';
      else if (t.t === 'm') ic = '🏔️'; else if (t.t === 'r') ic = '🏛️'; else if (s >= 22) ic = { f: '🌲', g: '✨', l: '', h: '', p: '' }[t.t];
      if (ic) { g.globalAlpha = t.c || t.v || t.t === 'r' || t.t === 'm' ? 1 : 0.6; g.font = `${Math.round(size)}px serif`; g.fillText(ic, x, y - (t.c ? s * 0.08 : 0)); g.globalAlpha = 1; }
      if (t.c && s >= 18) { const k = kOf(t.c); if (k) { g.font = `bold ${Math.max(9, Math.round(s * 0.36))}px Fredoka, sans-serif`; g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,0.75)'; const nm = k.id === V.me.id ? 'You' : k.name.replace(/’s Kingdom|'s Kingdom/, ''); g.strokeText(nm, x, y + s * 0.72); g.fillStyle = '#fff'; g.fillText(nm, x, y + s * 0.72); } }
      if (t.g > 0 && s >= 16) { const bx = x + s * 0.5, by = y - s * 0.45, rr = Math.max(7, s * 0.3); g.beginPath(); g.arc(bx, by, rr, 0, 7); g.fillStyle = t.o ? col(t.o) : '#333'; g.fill(); g.lineWidth = 1.5; g.strokeStyle = '#fff'; g.stroke(); g.fillStyle = '#fff'; g.font = `bold ${Math.round(rr * 1.1)}px Fredoka, sans-serif`; g.fillText(t.g > 99 ? '99+' : t.g, bx, by + 0.5); }
    }
    if (MAP.sel) { const [x, y] = sx(MAP.sel.q, MAP.sel.r); hex(x, y, s * 0.95); g.strokeStyle = '#ffd23f'; g.lineWidth = 3.5; g.stroke(); }
    // armies on the move
    const now = gameNow();
    for (const a of MAP.armies) {
      const pts = []; for (let i = 0; i + 1 < (a.path || []).length; i += 2) pts.push(sx(a.path[i], a.path[i + 1]));
      if (pts.length < 2) continue;
      const f = Math.max(0, Math.min(1, (now - a.t0) / Math.max(1, a.t1 - a.t0))), seg = f * (pts.length - 1), i0 = Math.min(pts.length - 2, Math.floor(seg)), k = seg - i0;
      const px = pts[i0][0] + (pts[i0 + 1][0] - pts[i0][0]) * k, py = pts[i0][1] + (pts[i0 + 1][1] - pts[i0][1]) * k;
      const hostile = a.o !== V.me.id && a.order === 'attack';
      g.setLineDash([5, 5]); g.strokeStyle = hostile ? '#ff4d4d' : 'rgba(255,255,255,0.75)'; g.lineWidth = 2; g.beginPath(); g.moveTo(px, py); for (let j = i0 + 1; j < pts.length; j++) g.lineTo(pts[j][0], pts[j][1]); g.stroke(); g.setLineDash([]);
      const rr = Math.max(9, s * 0.38); g.beginPath(); g.arc(px, py, rr, 0, 7); g.fillStyle = a.o ? col(a.o) : '#222'; g.fill(); g.lineWidth = 2.5; g.strokeStyle = hostile ? '#ff4d4d' : '#fff'; g.stroke();
      g.fillStyle = '#fff'; g.font = `bold ${Math.round(rr * 0.95)}px Fredoka, sans-serif`; g.fillText(a.n, px, py + 0.5);
    }
  }
  function pageMap(v) {
    const legend = [['p', 'Plains 🌾'], ['f', 'Forest 🪵'], ['h', 'Hills 🪨'], ['g', 'Gold ✨'], ['l', 'Lake'], ['m', 'Mountain']].map(([t, n]) => `<span><i style="background:${T_COLOR[t]}"></i>${n}</span>`).join('');
    return `<div class="kp-mapwrap"><div id="kp-map-slot" data-keep></div>
      <div class="kp-mapbtns"><button data-zoom="1.3">＋</button><button data-zoom="0.77">－</button><button data-center="${v.me.home.q},${v.me.home.r}">🏰</button></div></div>
      <p class="kp-sub small kp-center">Drag to move · pinch to zoom · <b>tap a tile</b> for actions. Numbers = soldiers there.</p>
      <div class="kp-legend">${legend}<span><i style="background:${esc(v.me.color)}"></i>Your land</span></div>
      ${v.myArmies.length || v.incoming.length ? `<div class="kp-card"><h3>🏃 Armies</h3>${v.incoming.map((a) => `<button class="kp-trow bad" data-center="${a.to.q},${a.to.r}"><span class="kp-tic">⚔️</span><span class="kp-tt"><b>${esc(a.name)} → your ${a.capital ? 'capital' : 'land'}</b><small>${a.n} soldiers</small></span><span class="kp-cd">${cd('i' + a.id, a.endsIn)}</span></button>`).join('')}
        ${v.myArmies.map((a) => `<button class="kp-trow" data-center="${a.to.q},${a.to.r}"><span class="kp-tic">${(ORDER[a.order] || ['🚶'])[0]}</span><span class="kp-tt"><b>${(ORDER[a.order] || ['', a.order])[1]} ${a.to.q},${a.to.r}</b><small>${a.n} units</small></span><span class="kp-cd">${cd('a' + a.id, a.endsIn)}</span></button>`).join('')}</div>` : ''}`;
  }
  function tileSheet(v) {
    const T = tileAt(sheet.q, sheet.r); if (!T) return '<p class="kp-sub">Out of sight.</p>';
    const ter = v.defs.terrain[T.t] || {}, k = T.o ? kOf(T.o) : null, mine = T.o === v.me.id, rel = k ? k.rel : null;
    const lines = [];
    lines.push(`<div class="kp-tline">${k ? `${dot(k.color)}<b>${mine ? 'Your land' : esc(k.name)}</b> ${!mine && rel && rel !== 'other' ? `<span class="kp-rel ${rel}">${rel}</span>` : ''}` : '<b>Nobody’s land</b>'}</div>`);
    if (T.c) lines.push(`<div class="kp-tline">🏰 ${mine ? 'Your capital' : 'Capital'}${k ? ` · ${ageInfo(v, k.age).icon} Age ${k.age}` : ''}</div>`);
    if (T.v) lines.push(`<div class="kp-tline">🏠 Village level ${T.v}</div>`);
    if (T.w) lines.push(`<div class="kp-tline">🧱 Walls ${T.w}</div>`);
    if (ter.pass) lines.push(`<div class="kp-tline">🛡️ Garrison: <b>${T.g}</b>${T.u ? ` · ${unitChips(v, T.u)}${T.seen ? ` <small class="kp-sub">(scouted ${mmss(T.seen)} ago)</small>` : ''}` : ''}</div>`);
    const boost = { p: '🌾 Farm', f: '🪵 Chop', h: '🪨 Quarry', g: '🪙 Mine', r: '🔬 science' }[T.t];
    if (boost) lines.push(`<div class="kp-tline kp-sub">${T.x ? '✨ Rich heartland (counts double) · ' : ''}Owning it boosts ${boost}${T.t === 'r' ? ' (Ancient Ruins)' : ' workers'}.</div>`);
    if (!ter.pass) lines.push('<div class="kp-tline kp-sub">Armies can’t cross this.</div>');
    const acts = [];
    const hasSettlers = v.units.some((t) => t.units.settlers > 0), scoutAt = v.units.find((t) => t.units.scout > 0);
    if (ter.pass) {
      if (mine) {
        acts.push(`<button class="btn small" data-target="${T.q},${T.r}">🚶 Move army here</button>`);
        if (T.v && !T.c) {
          const masonry = (v.research.done || []).includes('masonry');
          const adj = (c) => { const o = { ...c }; if (masonry && o.stone) o.stone = Math.ceil(o.stone * 0.85); return o; };
          if (T.v < 3) acts.push(`<div class="kp-upg"><span>⬆️ Village Lv ${T.v + 1}</span><span class="kp-cost">${chips(adj(VILLAGE_UP[T.v]))}</span><button class="btn small" data-op="${J({ op: 'upgrade', at: [T.q, T.r], what: 'village' })}" data-ok="🏠 Village upgraded!">Upgrade</button></div>`);
          if (v.me.age >= 2) acts.push(`<div class="kp-upg"><span>🧱 Walls ${T.w + 1}</span><span class="kp-cost">${chips(adj(VILLAGE_WALL[Math.min(T.w, 2)]))}</span><button class="btn small" data-op="${J({ op: 'upgrade', at: [T.q, T.r], what: 'walls' })}" data-ok="🧱 Walls built!">Build</button></div>`);
        }
      } else if (!T.o) {
        if (adjacentToMine(v, T)) acts.push(hasSettlers ? `<button class="btn small green" data-op="${J({ op: 'claim', to: [T.q, T.r] })}" data-ok="🛻 Settlers are on their way!" data-close-after>🚩 Claim with Settlers</button>` : `<div class="kp-sub small">🚩 You could claim this: ${v.me.age >= 2 ? 'train Settlers in ⚔️ Army.' : 'Settlers arrive in Age 2.'}</div>`);
        else acts.push('<div class="kp-sub small">🚩 Too far to claim: Settlers can only claim tiles next to your land.</div>');
        acts.push(`<button class="btn small ghost" data-target="${T.q},${T.r}">⚔️ Send army…</button>`);
      } else if (rel === 'ally') {
        acts.push(`<button class="btn small green" data-target="${T.q},${T.r}">🛡️ Reinforce</button>`);
      } else if (rel === 'liege' || rel === 'vassal') {
        acts.push(`<div class="kp-sub small">${rel === 'liege' ? '⛓️ Your liege: you can’t attack them. Rebel in 🤝 Allies.' : '⛓️ Your vassal already pays you tribute.'}</div>`);
      } else {
        acts.push(`<button class="btn small pink" data-target="${T.q},${T.r}">⚔️ Attack</button>`);
        if (scoutAt) acts.push(`<button class="btn small ghost" data-op="${J({ op: 'march', from: [scoutAt.q, scoutAt.r], to: [T.q, T.r], units: { scout: 1 }, order: 'scout' })}" data-ok="🔭 Scout sent!" data-close-after>🔭 Scout</button>`);
        else acts.push('<span class="kp-sub small">🔭 Train a Scout to see their units.</span>');
        if (T.c && v.peaceIn > 0) acts.push(`<div class="kp-sub small">🕊️ Capitals are safe for ${cd('peace', v.peaceIn)}.</div>`);
      }
    }
    return `<h3>${ter.icon || ''} ${esc(ter.name || '')} <small class="kp-sub">${T.q},${T.r}</small></h3>${lines.join('')}<div class="kp-acts">${acts.join('')}</div>`;
  }

  // ---------- 🤝 Allies ----------
  // The Royal Council: one big button per kingdom, your vote highlighted, live tally.
  function councilHtml(v) {
    const C = v.council; if (!C) return '';
    const votes = Object.fromEntries((C.tally || []).map((t) => [t.id, t.n]));
    const list = v.kingdoms.filter((k) => k.id !== v.me.id).sort((a, b) => (votes[b.id] || 0) - (votes[a.id] || 0) || b.score - a.score);
    return `<h3>${esc(C.icon)} Royal Council <span class="kp-h-r">${cd('council' + C.id, C.endsIn)}</span></h3><p class="kp-ask"><b>${esc(C.ask)}</b><br><small class="kp-sub">${esc(C.text)} ${C.votes}/${C.of} voted.</small></p>
      <div class="kp-votes">${list.map((k) => `<button class="kp-vote ${C.mine === k.id ? 'on' : ''}" data-op="${J({ op: 'vote', to: k.id })}" data-ok="🗳️ You voted for ${esc(k.name)}" data-close-after>${dot(k.color)}<span class="kp-kt"><b>${k.avatar ? esc(k.avatar) + ' ' : ''}${esc(k.name)}</b><small>⭐ ${k.score}${k.rel && k.rel !== 'other' ? ' · ' + esc(k.rel) : ''}</small></span><em>${votes[k.id] ? '🗳️'.repeat(Math.min(5, votes[k.id])) + (votes[k.id] > 5 ? '+' : '') : ''}</em>${C.mine === k.id ? '<span class="kp-tick">✓</span>' : ''}</button>`).join('')}</div>`;
  }
  function pageAllies(v) {
    const D = v.diplomacy, me = v.me, out = [];
    if (v.council) out.push(`<div class="kp-card kp-council">${councilHtml(v)}</div>`);
    if (v.bounties && v.bounties.length) out.push(`<div class="kp-card"><h3>💰 Your bounties</h3>${v.bounties.map((b) => `<div class="kp-offer"><div>💰 <b>${b.gold}</b> 🪙 on <b>${esc(b.name)}</b> <small class="kp-cd">${cd('bo' + b.on, b.expiresIn)}</small></div></div>`).join('')}<p class="kp-sub small">Whoever takes one of their villages or their capital collects it. Unclaimed gold comes back.</p></div>`);
    if (D.in.length) out.push(`<div class="kp-card kp-offers"><h3>📨 Offers for you</h3>${D.in.map((o) => `<div class="kp-offer"><div>${dot((kOf(o.from) || {}).color)}<b>${esc(o.name)}</b> ${o.kind === 'ally' ? 'wants to be your <b>ally</b> 🤝' : `offers ${chips(o.give)} for ${chips(o.get)}`} <small class="kp-cd">${cd('o' + o.id, o.expiresIn)}</small></div>
      <div class="kp-row"><button class="btn small green" data-op="${J(o.kind === 'ally' ? { op: 'allyAnswer', id: o.id, from: o.from, yes: true } : { op: 'tradeAnswer', id: o.id, yes: true })}" data-ok="${o.kind === 'ally' ? '🤝 Allied!' : '⚖️ Trade done!'}">Accept</button><button class="btn small ghost" data-op="${J(o.kind === 'ally' ? { op: 'allyAnswer', id: o.id, from: o.from, yes: false } : { op: 'tradeAnswer', id: o.id, yes: false })}">Decline</button></div></div>`).join('')}</div>`);
    if (D.out.length) out.push(`<div class="kp-card"><h3>📤 Your offers</h3>${D.out.map((o) => `<div class="kp-offer"><div>${o.kind === 'ally' ? '🤝 Alliance' : `⚖️ ${chips(o.give)} for ${chips(o.get)}`} → <b>${esc(o.name)}</b> <small class="kp-cd">${cd('o' + o.id, o.expiresIn)}</small></div>${o.kind === 'trade' ? `<button class="btn small ghost" data-op="${J({ op: 'tradeAnswer', id: o.id })}" data-ok="Offer withdrawn">Withdraw</button>` : '<small class="kp-sub">waiting…</small>'}</div>`).join('')}</div>`);
    if (v.rebel) {
      const R = v.rebel, pct = Math.min(100, Math.round(100 * R.my / Math.max(1, R.need)));
      out.push(`<div class="kp-card kp-vassal"><h3>⛓️ You are a vassal</h3><p>${esc(R.liegeName)} takes 25% of what you make. Grow your army until it is stronger than their capital, then rebel!</p>
        <div class="kp-pbar"><i style="width:${pct}%"></i><span>Your power ${R.my} / their defence ${R.need}</span></div>
        <button class="btn pink kp-wide" data-op="${J({ op: 'rebel' })}" ${R.can ? '' : 'disabled'}>✊ Rebel! (${Math.round(R.chance * 100)}% chance)</button>${R.cooldown ? `<p class="kp-sub small">Try again in ${cd('rebelcd', R.cooldown)}</p>` : ''}</div>`);
    }
    const monumentOn = v.mode === 'any' || v.mode === 'diplomacy';
    if (D.alliance) {
      const A = D.alliance, pct = Math.min(100, Math.round(100 * A.monument / Math.max(1, A.need)));
      out.push(`<div class="kp-card kp-alliance"><h3>🤝 Your alliance</h3><div class="kp-members">${A.members.map((m) => `<span>${dot((kOf(m.id) || {}).color)}${esc(m.id === me.id ? 'You' : m.name)}</span>`).join('')}</div>
        ${monumentOn ? `<h4>🕊️ Peace Monument</h4><div class="kp-pbar gold"><i style="width:${pct}%"></i><span>${A.monument} / ${A.need} 🪙+🪨</span></div><p class="kp-sub small">When every free kingdom is in one alliance and the monument is done, you all win together.</p>
        ${me.age < (v.monumentAge || 4) ? `<p class="kp-why">🔒 You can add to the monument from Age ${v.monumentAge || 4}.</p>` : `<div class="kp-row wrap">${[[{ gold: 50 }, '50 🪙'], [{ stone: 50 }, '50 🪨'], [{ gold: 200 }, '200 🪙'], [{ stone: 200 }, '200 🪨']].map(([r, l]) => `<button class="btn small" data-op="${J({ op: 'monument', res: r })}" data-ok="🕊️ Thank you! The monument grows." data-afford="${J(r)}" ${afford(r) ? '' : 'disabled'}>Give ${l}</button>`).join('')}</div>`}` : ''}
        <button class="link kp-leave" data-op="${J({ op: 'leaveAlly' })}" data-confirm="Leave the alliance? You’ll be marked 🗡️ Traitor for 3 minutes and the monument loses 30%.">🗡️ Leave alliance</button></div>`);
    } else out.push(`<div class="kp-card kp-sub small">🤝 Allies can’t attack each other, see each other’s land, and can send soldiers to help. ${monumentOn ? 'Together they can build the 🕊️ Peace Monument.' : ''} Tap a kingdom below to propose.</div>`);
    if (D.market) {
      const out1 = Math.floor(market.n / D.market.rate);
      out.push(`<div class="kp-card"><h3>⚖️ Market <span class="kp-h-r">${D.market.rate}:1</span></h3>
        <div class="kp-mk"><small>Sell</small><div class="kp-pick">${['food', 'wood', 'stone', 'gold'].map((r) => `<button class="${market.give === r ? 'on' : ''}" data-mk="give" data-r="${r}">${RI[r]}</button>`).join('')}</div></div>
        <div class="kp-mk"><small>Buy</small><div class="kp-pick">${['food', 'wood', 'stone', 'gold'].map((r) => `<button class="${market.get === r ? 'on' : ''}" data-mk="get" data-r="${r}" ${r === market.give ? 'disabled' : ''}>${RI[r]}</button>`).join('')}</div></div>
        <div class="kp-row"><div class="kp-step"><button data-mkn="-30">−</button><b>${market.n}</b><button data-mkn="30">+</button></div><span>${RI[market.give]} ${market.n} → ${RI[market.get]} ${out1}</span></div>
        <button class="btn small kp-wide" data-op="${J({ op: 'market', give: market.give, get: market.get, n: market.n })}" data-ok="⚖️ Traded ${market.n} ${RI[market.give]} for ${out1} ${RI[market.get]}" ${market.give === market.get || out1 < 1 ? 'disabled' : ''}>Trade</button></div>`);
    }
    const others = v.kingdoms.filter((k) => k.id !== me.id).sort((a, b) => (a.rel === 'ally' ? -1 : 0) - (b.rel === 'ally' ? -1 : 0) || a.dist - b.dist);
    const relTxt = { ally: '🤝 ally', liege: '⛓️ your liege', vassal: '⛓️ your vassal', neighbour: '🏡 neighbour', other: '' };
    out.push(`<div class="kp-card"><h3>👑 Kingdoms <span class="kp-h-r">${others.length}</span></h3>${others.map((k) => {
      const open = kOpen === k.id, canAlly = k.rel !== 'ally' && !me.vassalOf && !k.vassalOf;
      return `<div class="kp-king ${open ? 'open' : ''}"><button class="kp-krow" data-kopen="${k.id}">${dot(k.color)}<span class="kp-kt"><b>${k.avatar ? esc(k.avatar) + ' ' : ''}${esc(k.name)}</b><small>${esc(k.owner || '')} · ${ageInfo(v, k.age).icon} Age ${k.age} · ⭐ ${k.score} · ${k.dist} hexes</small></span>
        <span class="kp-badges">${relTxt[k.rel] ? `<span class="kp-rel ${k.rel}">${relTxt[k.rel]}</span>` : ''}${k.traitor ? '<span class="kp-rel bad">🗡️ traitor</span>' : ''}${k.marked ? '<span class="kp-rel bad">🎯 coalition</span>' : ''}${k.bounty ? `<span class="kp-rel bad">💰 ${k.bounty}</span>` : ''}${k.vassalOf && k.rel !== 'vassal' ? '<span class="kp-rel">⛓️ vassal</span>' : ''}${k.msg ? `<span class="kp-bubble">${esc(k.msg.text)}</span>` : ''}</span></button>
        ${open ? `<div class="kp-kacts"><button class="btn small green" data-op="${J({ op: 'ally', to: k.id })}" data-ok="🤝 Proposal sent to ${esc(k.name)}" ${canAlly ? '' : 'disabled'}>🤝 Ally</button>
          <button class="btn small" data-sheet="${J({ kind: 'gift', to: k.id, res: {} })}" ${D.canGift ? '' : 'disabled'}>🎁 Gift</button>
          <button class="btn small" data-sheet="${J({ kind: 'trade', to: k.id, give: {}, get: {} })}">⚖️ Trade</button>
          <button class="btn small" data-sheet="${J({ kind: 'msg', to: k.id })}">💬 Say</button>
          <button class="btn small" data-sheet="${J({ kind: 'bounty', to: k.id, gold: 100 })}" ${k.rel === 'ally' ? 'disabled' : ''}>💰 Bounty</button>
          <button class="btn small ghost" data-center="${k.home.q},${k.home.r}">📍 Map</button>${D.canGift ? '' : '<small class="kp-sub">🎁 Gifts need a Market (Age 3).</small>'}</div>` : ''}</div>`;
    }).join('')}<button class="btn small ghost kp-wide" data-sheet="${J({ kind: 'msg', to: null })}">📣 Say something to everyone</button></div>`);
    return out.join('');
  }
  function resSteppers(obj, field, list = ['food', 'wood', 'stone', 'gold']) {
    return list.map((r) => `<div class="kp-job"><span class="kp-job-ic">${RI[r]}</span><div class="kp-job-t"><b>${RN[r]}</b>${field === 'res' || field === 'give' ? `<small>you have <b data-res="${r}"></b></small>` : ''}</div>
      <div class="kp-step"><button data-rs="${field}" data-r="${r}" data-d="-25" ${(obj[r] || 0) <= 0 ? 'disabled' : ''}>−</button><b>${obj[r] || 0}</b><button data-rs="${field}" data-r="${r}" data-d="25">+</button></div></div>`).join('');
  }
  function diploSheet(v) {
    const S = sheet, k = S.to ? kOf(S.to) : null, nm = k ? `${dot(k.color)}${esc(k.name)}` : 'everyone';
    if (S.kind === 'msg') return `<h3>💬 Say to ${nm}</h3><p class="kp-sub small">Shows up next to your castle on the TV.</p><div class="kp-presets">${Object.entries(v.presets).map(([p, t]) => `<button data-op="${J({ op: 'message', preset: p, to: S.to || undefined })}" data-ok="💬 Said!" data-close-after>${esc(t)}</button>`).join('')}</div>`;
    if (S.kind === 'vote') return v.council ? councilHtml(v) : '<h3>🗳️ The council has closed</h3><p class="kp-sub">Watch the TV for the result.</p>';
    if (S.kind === 'bounty') return `<h3>💰 Bounty on ${nm}</h3><p class="kp-sub small">Put gold on their head. Whoever takes one of their villages or their capital collects it all. Unclaimed after 5 minutes, it comes back to you. Everyone sees it on the TV!</p>
      <div class="kp-job"><span class="kp-job-ic">🪙</span><div class="kp-job-t"><b>Gold</b><small>you have ${resB('gold')}</small></div><div class="kp-step"><button data-bg="-50" ${S.gold <= 50 ? 'disabled' : ''}>−</button><b>${S.gold}</b><button data-bg="50">+</button></div></div>
      <button class="btn big pink kp-wide" data-op="${J({ op: 'bounty', to: S.to, gold: S.gold })}" data-ok="💰 Bounty posted!" data-close-after data-afford="${J({ gold: S.gold })}" ${afford({ gold: S.gold }) ? '' : 'disabled'}>💰 Post a ${S.gold}-gold bounty</button>`;
    if (S.kind === 'gift') { const tot = Object.values(S.res).reduce((a, n) => a + n, 0); return `<h3>🎁 Gift to ${nm}</h3>${resSteppers(S.res, 'res')}<button class="btn big green kp-wide" data-op="${J({ op: 'gift', to: S.to, res: S.res })}" data-ok="🎁 Gift sent!" data-close-after ${tot ? '' : 'disabled'}>Send gift</button>`; }
    if (S.kind === 'trade') {
      const g = Object.values(S.give).reduce((a, n) => a + n, 0), w = Object.values(S.get).reduce((a, n) => a + n, 0);
      return `<h3>⚖️ Trade with ${nm}</h3><h4>You give</h4>${resSteppers(S.give, 'give')}<h4>You get</h4>${resSteppers(S.get, 'get')}
        <p class="kp-sub small">${k && k.rel === 'neighbour' ? '🏡 Neighbours trade for free.' : 'Far-away trades lose 10% on the road.'} What you give is held until they answer (1 minute).</p>
        <button class="btn big green kp-wide" data-op="${J({ op: 'trade', to: S.to, give: S.give, get: S.get })}" data-ok="⚖️ Offer sent!" data-close-after ${g && w ? '' : 'disabled'}>Send offer</button>`;
    }
    return '';
  }

  // ---------- 🔬 Research ----------
  function pageResearch(v) {
    const R = v.research, techs = R.techs, out = [];
    if (R.current) out.push(`<div class="kp-card"><h3>🔬 Researching</h3><div class="kp-qrow"><span>${(techs.find((t) => t.key === R.current.tech) || {}).icon || '🔬'}</span><div class="kp-qt"><b>${esc(R.current.name)}</b>${bar('r' + R.current.tech, R.current.endsIn, R.current.dur)}</div><span class="kp-cd">${cd('r' + R.current.tech, R.current.endsIn)}</span><button class="kp-x" data-op="${J({ op: 'cancel', queue: 'research' })}" data-confirm="Cancel this research? You get half the science back.">✕</button></div></div>`);
    else if (!v.buildings.library) out.push('<div class="kp-card kp-goal"><div class="kp-goal-ic">📚</div><div><b>Research needs a Library</b><p>Reach Age 3 (Town) and build a Library. Then put peasants on 🔬 Study.</p></div></div>');
    else out.push('<div class="kp-card kp-sub">Pick a research below. Science 🔬 comes from peasants on the Study job.</div>');
    const rows = TRACKS.map(([tr, ic, nm]) => `<div class="kp-track"><h4>${ic} ${nm}</h4><div class="kp-techs">${techs.filter((t) => t.track === tr).sort((a, b) => a.tier - b.tier).map((t) => {
      const st = t.done ? 'done' : t.can ? 'can' : R.current && R.current.tech === t.key ? 'busy' : isLock(t.why) || /first/.test(t.why || '') ? 'locked' : 'wait';
      return `<button class="kp-tech ${st} ${techSel === t.key ? 'sel' : ''}" data-tech="${t.key}"><span class="kp-tech-ic">${t.done ? '✅' : st === 'locked' ? '🔒' : t.icon}</span><b>${esc(t.name)}</b><small>${t.done ? 'done' : st === 'busy' ? 'now…' : `🔬 ${t.cost.sci}`}</small></button>`;
    }).join('')}</div></div>`).join('');
    out.push(`<div class="kp-card">${rows}</div>`);
    const T = techs.find((t) => t.key === techSel);
    if (T) out.push(`<div class="kp-card kp-techinfo"><h3>${T.icon} ${esc(T.name)}</h3><p>${esc(T.about)}</p><div class="kp-cost">${chips(T.cost)} <span class="kp-time">⏱ ${secs(T.time)}</span></div>
      ${T.done ? '<p>✅ Already researched.</p>' : `${T.why && !/Not enough/.test(T.why) ? `<p class="kp-why">${esc(T.why)}</p>` : ''}<button class="btn kp-wide" data-op="${J({ op: 'research', tech: T.key })}" data-ok="🔬 Research started" ${T.can ? '' : 'disabled'}>Research</button>`}</div>`);
    if (v.rocket) {
      const K = v.rocket;
      out.push(`<div class="kp-card kp-rocket"><h3>🚀 The rocket <span class="kp-h-r">${K.stage}/3 stages</span></h3><div class="kp-stages">${[1, 2, 3].map((i) => `<span class="${i <= K.stage ? 'done' : K.building === i ? 'now' : ''}">${i <= K.stage ? '✅' : K.building === i ? '🔧' : '⬜'} Stage ${i}</span>`).join('')}</div>
        ${K.building ? `<p>Building stage ${K.building}… ${cd('rk' + K.building, K.endsIn)}</p>${bar('rk' + K.building, K.endsIn, 60000)}<p class="kp-sub small">Enemies can attack your capital to destroy it. Keep soldiers at home!</p>` : K.stage >= 3 ? '<p>🚀 Ready for launch!</p>' : `<div class="kp-cost">${chips(K.cost)}</div><button class="btn green kp-wide" data-op="${J({ op: 'rocket' })}" data-ok="🚀 Stage ${K.stage + 1} under construction!">Build stage ${K.stage + 1}</button>`}</div>`);
    } else if (v.mode === 'any' || v.mode === 'science') out.push('<div class="kp-card kp-sub small">🚀 <b>Science win:</b> reach Age 5, build an Observatory, research Rocketry, build the Launch Pad, then build 3 rocket stages. Launch = win!</div>');
    return out.join('');
  }

  // ---------- game over & spectator ----------
  function overHtml(v, view) {
    const myId = view.me.id, W = v.winner || { names: [], ids: [], mode: 'score' }, St = v.standings || [];
    const mine = St.find((s) => s.id === myId), won = W.ids.includes(myId);
    return `<div class="kp-over"><div class="kp-card kp-center"><div class="kp-crown">${won ? '👑' : '🏰'}</div><h2>${won ? 'You won!' : esc(W.names.join(' & ') || 'Nobody') + ' won'}</h2>
      <p>${esc(W.names.join(' & '))} ${WIN_HOW[W.mode] || ''}${W.reason === 'time' ? ' when time ran out' : ''}.</p>
      ${mine ? `<div class="kp-rank">#${mine.rank} <small>of ${St.length}</small></div><div class="kp-stats big"><span>⭐ ${mine.score}</span><span>${ageInfo(v, mine.age).icon} Age ${mine.age}</span><span>🗺️ ${mine.land} land</span><span>🏠 ${mine.villages}</span><span>🏰 ${mine.capitals}</span>${mine.vassalOf ? '<span>⛓️ vassal</span>' : ''}</div>` : ''}</div>
      ${(v.awards || []).length ? `<div class="kp-card"><h3>🏅 Awards</h3>${v.awards.map((a) => `<div class="kp-award ${a.id === myId ? 'me' : ''}"><b>${esc(a.title)}</b><span>${esc(a.name)}</span></div>`).join('')}</div>` : ''}
      <div class="kp-card"><h3>📜 Final standings</h3>${standings(St, myId)}</div></div>`;
  }
  const standings = (rows, myId) => rows.map((s, i) => `<div class="kp-stand ${s.id === myId ? 'me' : ''}"><span class="n">${s.rank || i + 1}</span>${dot(s.color)}<span class="kp-kt"><b>${esc(s.name)}</b><small>${esc(s.owner || '')}${s.vassalOf ? ' · ⛓️ vassal' : ''}</small></span><b>⭐ ${s.score}</b></div>`).join('');
  function spectatorHtml(v) {
    const rows = v.kingdoms.slice().sort((a, b) => b.score - a.score);
    return `<div class="kp-card kp-center"><div class="kp-crown">👀</div><h2>You’re watching</h2><p>This world is full, so you’re a royal spectator. Watch the TV and cheer!</p><p class="kp-sub">⏳ ${cd('time', v.timeLeft)} left</p></div>
      <div class="kp-card"><h3>👑 Kingdoms</h3>${standings(rows, null)}</div>
      <div class="kp-card"><h3>📜 News</h3>${(v.ticker || []).slice().reverse().map((t) => `<div class="kp-news">${esc(t.text)}</div>`).join('')}</div>`;
  }

  // ---------- alerts → toasts ----------
  function alerts(v) {
    const list = v.alerts || []; if (!list.length) return;
    const top = list[list.length - 1].id;
    if (lastAlert == null) { lastAlert = top; return; }
    const fresh = list.filter((a) => a.id > lastAlert); lastAlert = Math.max(lastAlert, top);
    if (!fresh.length) return;
    const bad = fresh.filter((a) => a.kind === 'bad'), pick = bad.length ? bad[bad.length - 1] : fresh[fresh.length - 1];
    CTX.toast(pick.text + (fresh.length > 1 ? ` (+${fresh.length - 1} more)` : ''));
    if (bad.length) { CTX.vibrate(/⚔️|🔥/.test(pick.text) ? [200, 80, 200] : 120); CTX.sfx('sting'); } else { CTX.sfx(pick.kind === 'good' ? 'bell' : 'click'); if (pick.kind === 'good') CTX.vibrate([20, 40, 30]); }
  }

  // ---------- events (one delegated listener) ----------
  async function run(b, msg) {
    if (b.dataset.confirm && !confirm(b.dataset.confirm)) return;
    b.disabled = true;
    const r = await CTX.act(msg);
    b.disabled = false;
    if (r && r.ok) {
      if (b.dataset.ok) CTX.toast(b.dataset.ok);
      CTX.sfx('click');
      if (b.hasAttribute('data-close-after')) sheet = null;
    }
    CTX.redraw();
  }
  function onClick(e) {
    const root = e.currentTarget.querySelector('.kp-root'); if (!root || !root.contains(e.target)) return;
    const b = e.target.closest('button,[data-close]'); if (!b || !V) return;
    const d = b.dataset;
    if (d.close !== undefined && b.hasAttribute('data-close')) { sheet = null; MAP.sel = null; MAP.dirty = true; return CTX.redraw(); }
    if (d.tab) { tab = d.tab; sheet = null; window.scrollTo(0, 0); return CTX.redraw(); }
    if (d.seat !== undefined) { const s = Number(d.seat); return run(b, { op: 'seat', seat: V.seat === s ? null : s }); }
    if (b.hasAttribute('data-rename')) { const i = document.getElementById('kp-name'); nameDraft = i ? i.value : nameDraft; if (i) i.blur(); return run(b, { op: 'rename', name: nameDraft }).then(() => { nameDraft = null; }); }
    if (d.op) return run(b, JSON.parse(d.op));
    if (d.job) {
      const W = curWorkers(V), n = (W[d.job] || 0) + Number(d.d);
      if (n < 0 || (Number(d.d) > 0 && W.idle <= 0)) return;
      jobsLocal = Object.fromEntries(JOBK.map((j) => [j, W[j] || 0])); jobsLocal[d.job] = n;
      const seq = ++jobsSeq; CTX.sfx('click'); CTX.redraw();
      return CTX.act({ op: 'jobs', ...jobsLocal }).then(() => { if (seq === jobsSeq) { jobsLocal = null; CTX.redraw(); } });
    }
    if (d.qty) { qty[d.qty] = Number(d.n); return CTX.redraw(); }
    if (d.targets !== undefined) { sheet = { kind: 'targets', from: d.targets || null }; return CTX.redraw(); }
    if (d.target) {
      const [q, r] = d.target.split(',').map(Number), from = sheet && sheet.kind === 'targets' ? sheet.from : null;
      sheet = { kind: 'send', to: { q, r }, from, units: {} }; MAP.sel = { q, r }; MAP.dirty = true; return CTX.redraw();
    }
    if (d.from) { sheet.from = d.from; sheet.units = {}; return CTX.redraw(); }
    if (d.su) {
      const F = V.units.find((t) => key(t.q, t.r) === sheet.from); if (!F) return;
      const have = F.units[d.su] || 0, cur = sheet.units[d.su] || 0;
      sheet.units[d.su] = d.d === 'all' ? (cur === have ? 0 : have) : Math.max(0, Math.min(have, cur + Number(d.d)));
      return CTX.redraw();
    }
    if (b.hasAttribute('data-send')) {
      const S = sheet, [fq, fr] = S.from.split(',').map(Number), units = Object.fromEntries(Object.entries(S.units).filter(([, n]) => n > 0));
      const T = tileAt(S.to.q, S.to.r), order = orderFor(V, T, units);
      b.disabled = true;
      return CTX.act({ op: 'march', from: [fq, fr], to: [S.to.q, S.to.r], units, order }).then((r) => {
        if (r && r.ok) { CTX.toast(`${ORDER[order][0]} Your army is on its way! Arrives in ${mmss(r.eta || 0)}`); CTX.sfx('whoosh'); CTX.vibrate(40); sheet = null; }
        CTX.redraw();
      });
    }
    if (d.center) { const [q, r] = d.center.split(',').map(Number); tab = 'map'; sheet = null; centreOn(q, r); MAP.sel = { q, r }; window.scrollTo(0, 0); return CTX.redraw(); }
    if (d.zoom) { if (MAP.cv) zoomAt(MAP.cv.clientWidth / 2, MAP.cv.clientHeight / 2, Number(d.zoom)); return; }
    if (d.tech) { techSel = techSel === d.tech ? null : d.tech; return CTX.redraw(); }
    if (d.kopen) { kOpen = kOpen === d.kopen ? null : d.kopen; return CTX.redraw(); }
    if (d.sheet) { sheet = JSON.parse(d.sheet); return CTX.redraw(); }
    if (d.rs) { const o = sheet[d.rs]; o[d.r] = Math.max(0, (o[d.r] || 0) + Number(d.d)); if (!o[d.r]) delete o[d.r]; return CTX.redraw(); }
    if (d.mk) { market[d.mk] = d.r; if (market.give === market.get) market.get = ['food', 'wood', 'stone', 'gold'].find((x) => x !== market.give); return CTX.redraw(); }
    if (d.bg) { sheet.gold = Math.max(50, (sheet.gold || 100) + Number(d.bg)); return CTX.redraw(); }
    if (d.mkn) { market.n = Math.max(30, market.n + Number(d.mkn)); return CTX.redraw(); }
  }

  // ---------- main ----------
  // Screens update in place (BOX.morph): buttons stay under the finger, no flicker, scroll stays put.
  // The map slot is data-keep, so the live canvas inside it survives every update.
  function paint(el, html) {
    let root = el.firstElementChild;
    if (!root || !root.classList.contains('kp-root') || el.children.length !== 1) { el.innerHTML = '<div class="kp-root"></div>'; root = el.firstElementChild; lastHtml = ''; }
    if (html === lastHtml) return false;
    lastHtml = html; BOX.morph(root, html); return true;
  }
  function phone(el, v, ctx, view) {
    CTX = ctx; VIEW = view;
    if (!el._kpBound) { el._kpBound = true; el.addEventListener('click', onClick); el.addEventListener('change', (e) => { if (e.target.id === 'kp-name') nameDraft = e.target.value; }); el.addEventListener('toggle', (e) => { const d = e.target; if (d && d.dataset && d.dataset.det) DET[d.dataset.det] = d.open; }, true); }
    if (!ticker) ticker = setInterval(tick, 250);
    if (!v) return;
    if (v !== V) { V = v; recvAt = Date.now(); if (v.res) base = { res: { ...v.res }, rates: { ...v.rates }, at: Date.now() }; }
    if (v.phase === 'lobby') { lastAlert = null; MAP.centred = null; paint(el, lobbyHtml(v, view)); tick(); return; }
    if (v.phase === 'over') { sheet = null; paint(el, overHtml(v, view)); tick(); return; }
    if (v.spectator || !v.me) { paint(el, spectatorHtml(v)); tick(); return; }
    // map data
    MAP.tiles = new Map(v.world.tiles.map((t) => [key(t.q, t.r), t]));
    const sig = v.world.tiles.map((t) => `${t.o || ''}${t.v}${t.w}${t.g}`).join('|') + (v.kingdoms.map((k) => k.age).join(''));
    if (sig !== MAP.sig) { MAP.sig = sig; MAP.dirty = true; }
    MAP.armies = v.armies || [];
    if (MAP.centred !== v.me.id) { MAP.centred = v.me.id; centreOn(v.me.home.q, v.me.home.r); }
    alerts(v);
    if (sheet && sheet.kind === 'tile' && !tileAt(sheet.q, sheet.r)) sheet = null;
    const pages = { kingdom: pageKingdom, army: pageArmy, map: pageMap, allies: pageAllies, research: pageResearch };
    const offers = v.diplomacy.in.length;
    const nav = [['kingdom', '🏰', 'Kingdom', curWorkers(v).idle > 0 ? '!' : ''], ['army', '⚔️', 'Army', v.incoming.length ? '!' : ''], ['map', '🗺️', 'Map', ''], ['allies', '🤝', 'Allies', offers ? String(offers) : v.council && !v.council.mine ? '🗳️' : ''], ['research', '🔬', 'Research', '']]
      .map(([k, i, l, badge]) => `<button class="${tab === k ? 'on' : ''}" data-tab="${k}"><span class="kp-nic">${i}</span>${l}${badge ? `<em>${badge}</em>` : ''}</button>`).join('');
    let sh = '';
    if (sheet) {
      if (sheet.kind === 'vote' && !v.council) sheet = null;
    }
    if (sheet) {
      const body = sheet.kind === 'tile' ? tileSheet(v) : sheet.kind === 'send' ? sendSheet(v) : sheet.kind === 'targets' ? `<h3>🚩 Where to?</h3>${targetList(v)}` : diploSheet(v);
      sh = `<div class="kp-sheet-bg" data-close></div><div class="kp-sheet"><button class="kp-sheet-x" data-close>✕</button>${body}</div>`;
    }
    const html = `${headHtml(v)}<div class="kp-page kp-p-${tab}">${(pages[tab] || pageKingdom)(v)}</div><nav class="kp-nav">${nav}</nav>${sh}`;
    paint(el, html);
    if (tab === 'map') {
      const slot = el.querySelector('#kp-map-slot'), cv = ensureMap();
      if (slot && cv.parentNode !== slot) { slot.appendChild(cv); MAP.dirty = true; }
      if (!MAP.raf) mapLoop();
      MAP.dirty = MAP.dirty || !!MAP.armies.length;
    }
    tick();
  }

  window.BOX.games.kingdoms = Object.assign(window.BOX.games.kingdoms || {}, { phone });
})();
