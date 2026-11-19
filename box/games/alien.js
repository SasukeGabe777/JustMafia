'use strict';
// Alien Abduction: a quick hidden-role game aboard the starship Biscuit, limping home to Earth.
// A few crew members are secretly ALIENS (the Gloop) wearing crew disguises.
//
// Each round (a "shift"):
//   1. EMERGENCY: one ship system (🫧 Oxygen, 🔥 Engines, 🛡️ Shields) breaks. It has 2–4
//      repair stations. Everyone alive secretly picks a station; aliens may SABOTAGE instead
//      of fixing. Each player learns who worked beside them at their own station.
//   2. REPORT: the TV shows how many sabotages hit the system, but not where or by whom.
//      No sabotage: a clean repair, the ship JUMPS one step closer to home and the system
//      heals 1. Each sabotage costs the system 1 HP (at most 2 per round) and stops the jump
//      (a big crew of 8+ aboard shrugs off one: it takes 2 to stop the jump).
//   3. DISCUSS (timer): talk out loud; phones post quick claims to the TV ("I was at…",
//      "I suspect…", "Sabotage hit…", "I scanned…").
//   4. VOTE: bubble-pod someone off the ship, or skip. Ties and skips eject nobody. The
//      pod's scanner announces whether they were an alien.
// Special roles: the SCANNER checks one person per shift (the MIMIC alien reads as crew), the
// ENGINEER sees how many sabotages hit each station. Ejected players become GHOSTS: crew
// ghosts patch systems (every 2 patches heal 1 HP) and every ghost may whisper a suspect.
// The crew wins by reaching home (`trip` jumps) or ejecting every alien. The aliens win by
// breaking a system (0 HP), matching the crew's numbers, or when the fuel runs out
// (trip + 2 shifts). results(): the winning side first, then by contribution (⭐).
const opt = (pairs) => pairs.map(([value, label]) => ({ value, label }));
const fields = [
  { key: 'trip', label: 'Trip home', options: opt([[3, 'Short hop: 3 jumps'], [4, 'Standard: 4 jumps'], [5, 'Long haul: 5 jumps']]) },
  { key: 'aliens', label: 'Aliens aboard', options: opt([['auto', 'Auto (by crew size)'], [1, '1 alien'], [2, '2 aliens'], [3, '3 aliens']]) },
  { key: 'talk', label: 'Discussion time', options: opt([[30, '30 seconds'], [45, '45 seconds'], [60, '60 seconds'], [90, '90 seconds']]) },
  { key: 'specials', label: 'Special roles', options: opt([[true, 'On: Scanner, Engineer, Mimic'], [false, 'Off: crew and aliens only']]) },
];
const defaults = { trip: 4, aliens: 'auto', talk: 45, specials: true };

const ROLES_MS = 8000, EMERG_MS = 4500, SHIFT_MS = 20000, REPORT_MS = 9000, VOTE_MS = 25000, EJECT_MS = 7500;
const HP_MAX = 3, DMG_CAP = 2, SAY_GAP_MS = 2500, SAY_MAX = 6, CLAIMS_KEPT = 10;
const PTS = { fix: 50, clean: 50, sabotage: 100, ejectAlien: 150, ejectCrew: 100, scanAlien: 100, abduct: 100, patch: 25, whisper: 25, survive: 100, win: 300 };

const SYSTEMS = {
  oxygen: { name: 'Oxygen', icon: '🫧', room: 'Air Garden' },
  engines: { name: 'Engines', icon: '🔥', room: 'Engine Room' },
  shields: { name: 'Shields', icon: '🛡️', room: 'Shield Dome' },
};
const SYS_KEYS = Object.keys(SYSTEMS);
// Emergencies (all original): a title, a line, and up to four repair stations [icon, label].
const EMERGENCIES = {
  oxygen: [
    { title: 'Oxygen leak!', text: 'Something is hissing in the Air Garden. The bubbles are escaping!', stations: [['🩹', 'Patch the vent'], ['🌿', 'Water the air plants'], ['🌀', 'Spin the big fan'], ['🧽', 'Scrub the filter']] },
    { title: 'The air plants are wilting!', text: 'The moss that makes our air looks very, very sad.', stations: [['🎶', 'Sing to the moss'], ['💡', 'Fix the grow lights'], ['💧', 'Unclog the sprinklers'], ['🪴', 'Repot the giant fern']] },
    { title: 'Bubble pump jammed!', text: 'The air bubbler went clunk. Breathe slowly, everybody.', stations: [['🔧', 'Unjam the pump'], ['🫙', 'Swap the air tanks'], ['🧯', 'Vent the stinky gas'], ['📟', 'Reset the air meter']] },
  ],
  engines: [
    { title: 'Engine stall!', text: 'The engines coughed, sputtered and went quiet.', stations: [['🔥', 'Relight the burner'], ['⛽', 'Pump the star fuel'], ['🔩', 'Tighten the big bolts'], ['🎛️', 'Reset the throttle']] },
    { title: 'Fuel goo overflow!', text: 'Purple fuel goo is bubbling out of every pipe.', stations: [['🪣', 'Mop up the goo'], ['🔧', 'Close the valves'], ['🧲', 'Realign the magnets'], ['🌡️', 'Cool the fuel tank']] },
    { title: 'The hamster drive stopped!', text: 'Our backup power is one very large space hamster. He is on strike.', stations: [['🥕', 'Bring him a snack'], ['🎵', 'Play his favorite song'], ['🛞', 'Oil the wheel'], ['🛏️', 'Fluff his bed']] },
  ],
  shields: [
    { title: 'Meteor shower!', text: 'Space rocks incoming! The shield dome is flickering.', stations: [['🛡️', 'Boost the dome'], ['🔭', 'Track the meteors'], ['🧱', 'Patch the dents'], ['🔋', 'Swap the batteries']] },
    { title: 'Space jelly on the dome!', text: 'A giant space jellyfish is hugging the ship. It is very sticky.', stations: [['🧴', 'Unstick the tentacles'], ['📡', 'Play it whale songs'], ['🔦', 'Shine the big light'], ['🧤', 'Gently push it off']] },
    { title: 'Static storm!', text: 'Crackling space static is scrambling the shields.', stations: [['📡', 'Re-aim the antenna'], ['⚡', 'Ground the sparks'], ['🖥️', 'Reboot the computer'], ['🧶', 'Untangle the cables']] },
  ],
};
const ROLE_INFO = {
  crew: { name: 'Crew', icon: '🧑‍🚀', side: 'crew' },
  scanner: { name: 'Scanner', icon: '🔬', side: 'crew' },
  engineer: { name: 'Engineer', icon: '🔧', side: 'crew' },
  alien: { name: 'Alien', icon: '👽', side: 'aliens' },
  mimic: { name: 'Alien Mimic', icon: '🎭', side: 'aliens' },
};
const isAlien = (role) => role === 'alien' || role === 'mimic';
const SAY_KINDS = ['where', 'sus', 'clear', 'scan', 'sab'];

class Alien {
  constructor(room, s) {
    this.room = room;
    this.s = {
      trip: [3, 4, 5].includes(Number(s.trip)) ? Number(s.trip) : 4,
      aliens: s.aliens === 'auto' || s.aliens == null ? 'auto' : Math.max(1, Math.min(3, Number(s.aliens) || 1)),
      talk: [30, 45, 60, 90].includes(Number(s.talk)) ? Number(s.talk) : 45,
      specials: !(s.specials === false || s.specials === 'false'),
    };
    this.home = this.s.trip; this.maxRounds = this.s.trip + 2;
    this.phase = 'roles'; this.round = 0; this.progress = 0;
    this.hpMax = HP_MAX; this.hp = { oxygen: HP_MAX, engines: HP_MAX, shields: HP_MAX };
    this.bank = { oxygen: 0, engines: 0, shields: 0 }; // ghost patches towards the next heal
    this.crew = new Map(); // id → { id, role, alive, gone, out, pts, stats }
    this.emergency = null; this.picks = new Map(); this.scans = new Map(); this.patches = new Map(); this.whispers = new Map(); this.beams = new Map();
    this.charges = 0; // abductions left for the alien team
    this.votes = new Map(); this.claims = []; this.said = new Map(); this.report = null; this.ejected = null;
    this.scanLog = []; // the scanner's private results [{ round, id, alien }]
    this.history = []; // per round: { round, sys, S, jumped, ejected }
    this.pending = null; // a win decided during the report, shown after it
    this.winner = null; this.reason = null;
    this.timer = null; this.endsAt = 0; this.used = new Set(); this.order = [];
    this.loud = new Map(); // player id → how dangerous their claims have been (alien bots aim the beam)
    this.mind = new Map(); // bot id → Map(target id → suspicion)
  }
  // ---- helpers ----
  get family() { return !(this.room && this.room.family === false); } // family-safe unless the room says otherwise
  rand(n) { return Math.floor(this.room.rng() * n); }
  pick(list) { return list[this.rand(list.length)]; }
  shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = this.rand(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  setTimer(ms, fn) { this.room.cancel(this.timer); this.endsAt = this.room.now() + ms; this.timer = this.room.after(ms, fn); }
  member(id) { return this.crew.get(id); }
  living() { return [...this.crew.values()].filter((c) => c.alive && !c.gone); }
  ghosts() { return [...this.crew.values()].filter((c) => !c.alive && !c.gone); }
  aliensAlive() { return this.living().filter((c) => isAlien(c.role)); }
  crewAlive() { return this.living().filter((c) => !isAlien(c.role)); }
  player(id) { return this.room.get(id); }
  present(c) { const p = this.player(c.id); return !!p && (p.bot || p.sockets > 0); }
  pub(id) { const p = this.player(id) || {}; return { id, name: p.name || '—', avatar: p.avatar || '🙂', color: p.color || '#9b8cff' }; }
  roleHas(role) { return [...this.crew.values()].some((c) => c.role === role); }
  add(c, k, n) { c.pts += n; c.stats[k] = (c.stats[k] || 0) + 1; }

  // ---- the voyage ----
  start() {
    const people = this.shuffle(this.room.list().slice()), n = people.length;
    const auto = n <= 5 ? 1 : n <= 8 ? 2 : n <= 12 ? 3 : Math.floor(n / 4);
    const want = this.s.aliens === 'auto' ? auto : this.s.aliens;
    const count = Math.max(1, Math.min(want, Math.floor((n - 1) / 2)));
    people.forEach((p, i) => this.crew.set(p.id, { id: p.id, role: i < count ? 'alien' : 'crew', alive: true, gone: false, out: null, pts: 0, stats: {} }));
    const crew = people.slice(count), aliens = people.slice(0, count);
    if (this.s.specials) {
      if (n >= 5 && crew.length >= 3) this.crew.get(crew[0].id).role = 'engineer';
      if (n >= 6 && crew.length >= 4) this.crew.get(crew[1].id).role = 'scanner';
      if (aliens.length >= 2 || n >= 7) this.crew.get(aliens[0].id).role = 'mimic';
    }
    this.aliensTotal = count;
    this.charges = n >= 5 && count === 1 ? 1 : 0; // a lone alien gets one abduction beam
    this.hpMax = n >= 9 ? HP_MAX + 1 : HP_MAX; // a big crew flies a sturdier ship
    this.hp = { oxygen: this.hpMax, engines: this.hpMax, shields: this.hpMax };
    this.order = this.shuffle(SYS_KEYS.slice());
    for (const c of this.crew.values()) if (this.player(c.id).bot) this.mind.set(c.id, new Map());
    this.phase = 'roles'; this.room.fx('roles');
    this.setTimer(ROLES_MS, () => this.newRound());
  }
  joined() { /* late arrivals watch as stowaways until the next game */ }
  left(p) {
    const c = this.member(p.id); if (!c || c.gone) return;
    c.gone = true; c.alive = false;
    if (this.phase === 'over') return;
    const w = this.check(); if (w && this.phase !== 'report' && this.phase !== 'eject') return this.end(w.side, w.reason);
    if (this.phase === 'shift') this.maybeShiftDone();
    if (this.phase === 'vote') this.maybeVoteDone();
  }
  blockAt() { return this.living().length >= 8 ? 2 : 1; } // sabotages needed to stop the jump
  stationsFor() { const n = this.living().length; return n <= 5 ? 2 : n <= 8 ? 3 : 4; }
  newRound() {
    if (this.phase === 'over') return;
    if (this.round >= this.maxRounds) return this.end('aliens', 'fuel');
    this.round++;
    const sys = this.order[(this.round - 1) % this.order.length];
    const pool = EMERGENCIES[sys].filter((e) => !this.used.has(e.title)), e = this.pick(pool.length ? pool : EMERGENCIES[sys]);
    this.used.add(e.title);
    const k = this.stationsFor();
    this.emergency = { sys, title: e.title, text: e.text, block: this.blockAt(), stations: e.stations.slice(0, k).map(([icon, label]) => ({ icon, label })) };
    this.picks = new Map(); this.scans = new Map(); this.patches = new Map(); this.whispers = new Map(); this.beams = new Map();
    this.votes = new Map(); this.claims = []; this.said = new Map(); this.report = null; this.ejected = null;
    this.phase = 'emergency'; this.room.fx('alarm', { sys });
    this.setTimer(EMERG_MS, () => this.beginShift());
  }
  beginShift() {
    if (this.phase !== 'emergency') return;
    this.phase = 'shift'; this.room.fx('shift');
    this.setTimer(SHIFT_MS, () => this.resolve());
    for (const c of this.crew.values()) if (!c.gone && this.player(c.id) && this.player(c.id).bot) this.room.after(1500 + this.room.rng() * 7000, () => this.botShift(c));
  }
  needsScan(c) { return c.role === 'scanner' && c.alive && this.living().length > 1; }
  maybeShiftDone() {
    if (this.phase !== 'shift') return;
    const waiting = this.living().filter((c) => this.present(c) && (!this.picks.has(c.id) || (this.needsScan(c) && !this.scans.has(c.id))));
    if (!waiting.length) this.resolve();
  }
  resolve() {
    if (this.phase !== 'shift') return;
    const E = this.emergency, sys = E.sys, st = E.stations.map(() => ({ ids: [], sab: 0 }));
    for (const c of this.living()) {
      const pk = this.picks.get(c.id); if (!pk) continue;
      st[pk.station].ids.push(c.id);
      if (pk.sab && isAlien(c.role)) { st[pk.station].sab++; this.add(c, 'sabotage', PTS.sabotage); } else if (!isAlien(c.role)) this.add(c, 'fix', PTS.fix);
    }
    const S = st.reduce((a, x) => a + x.sab, 0), before = { ...this.hp };
    const block = this.blockAt(), jumped = S < block, damage = Math.min(DMG_CAP, S);
    if (jumped) { this.progress++; for (const c of this.living()) { const pk = this.picks.get(c.id); if (pk && !isAlien(c.role)) this.add(c, 'clean', PTS.clean); } }
    if (!S) this.hp[sys] = Math.min(this.hpMax, this.hp[sys] + 1); else this.hp[sys] = Math.max(0, this.hp[sys] - damage);
    // crew ghosts' patches: every two on a system heal it by 1 (if it's still flying)
    const healed = {};
    for (const [id, k] of this.patches) {
      const c = this.member(id); if (!c || isAlien(c.role)) continue;
      this.add(c, 'patch', PTS.patch); this.bank[k]++;
      if (this.bank[k] >= 2 && this.hp[k] > 0 && this.hp[k] < this.hpMax) { this.bank[k] -= 2; this.hp[k]++; healed[k] = (healed[k] || 0) + 1; }
      else if (this.bank[k] > 2) this.bank[k] = 2;
    }
    // the scanner's result (the Mimic reads as crew)
    let scan = null;
    for (const [id, t] of this.scans) {
      const c = this.member(id), tc = this.member(t); if (!c || !tc || t === 'skip') continue;
      const alien = tc.role === 'alien';
      scan = { by: id, id: t, alien }; this.scanLog.push({ round: this.round, id: t, alien });
      if (alien) this.add(c, 'scanAlien', PTS.scanAlien);
    }
    // the abduction beam: the first alien who aimed it takes their target (once per charge)
    let abducted = null;
    if (this.charges > 0) for (const [id, t] of this.beams) {
      const a = this.member(id), v = this.member(t);
      if (!a || !a.alive || !v || !v.alive || v.gone || isAlien(v.role)) continue;
      v.alive = false; v.out = this.round; v.abducted = true; this.charges--; this.add(a, 'abduct', PTS.abduct);
      abducted = { ...this.pub(v.id) }; break;
    }
    // ghosts' whispers: crew ghosts pointing at a real alien earn a little
    for (const [id, t] of this.whispers) { const c = this.member(id), tc = this.member(t); if (c && tc && !isAlien(c.role) && isAlien(tc.role) && tc.alive) this.add(c, 'whisper', PTS.whisper); }
    const broke = SYS_KEYS.find((k) => this.hp[k] <= 0) || null;
    this.report = { sys, S, block, damage, jumped, before, healed, broke, abducted, stations: st.map((x, i) => ({ ...E.stations[i], ids: x.ids, sab: x.sab })), scan };
    this.history.push({ round: this.round, sys, S, jumped, abducted: abducted ? abducted.name : null });
    if (broke) this.pending = { side: 'aliens', reason: 'broken' };
    else if (this.progress >= this.home) this.pending = { side: 'crew', reason: 'home' };
    this.phase = 'report'; this.room.fx(S ? 'sabotage' : 'jump', { n: S });
    this.botsLearn();
    this.setTimer(REPORT_MS, () => this.afterReport());
  }
  afterReport() {
    if (this.phase !== 'report') return;
    if (this.pending) return this.end(this.pending.side, this.pending.reason);
    const w = this.check(); if (w) return this.end(w.side, w.reason);
    this.phase = 'discuss'; this.room.fx('discuss');
    const ms = this.s.talk * 1000;
    this.setTimer(ms, () => this.beginVote());
    for (const c of this.living()) if (this.player(c.id) && this.player(c.id).bot) this.botTalk(c, ms);
  }
  beginVote() {
    if (this.phase !== 'discuss') return;
    this.phase = 'vote'; this.votes = new Map(); this.room.fx('vote');
    this.setTimer(VOTE_MS, () => this.tally());
    for (const c of this.living()) if (this.player(c.id) && this.player(c.id).bot) this.room.after(2500 + this.room.rng() * 9000, () => this.botVote(c));
  }
  maybeVoteDone() {
    if (this.phase !== 'vote') return;
    if (this.living().filter((c) => this.present(c)).every((c) => this.votes.has(c.id))) this.tally();
  }
  tallyCounts() {
    const counts = new Map(); let skip = 0;
    for (const [id, t] of this.votes) { const c = this.member(id); if (!c || !c.alive) continue; if (t === 'skip') skip++; else counts.set(t, (counts.get(t) || 0) + 1); }
    return { counts, skip };
  }
  tally() {
    if (this.phase !== 'vote') return;
    const { counts, skip } = this.tallyCounts();
    const rows = [...counts].map(([id, n]) => ({ ...this.pub(id), n })).sort((a, b) => b.n - a.n);
    const top = rows[0], tie = rows.length > 1 && rows[1].n === (top && top.n);
    let out = null;
    if (top && top.n > skip && !tie) {
      const c = this.member(top.id);
      if (c && c.alive) {
        c.alive = false; c.out = this.round;
        const alien = isAlien(c.role);
        for (const [id, t] of this.votes) { const v = this.member(id); if (t !== top.id || !v) continue; if (alien && !isAlien(v.role)) this.add(v, 'ejectAlien', PTS.ejectAlien); if (!alien && isAlien(v.role)) this.add(v, 'ejectCrew', PTS.ejectCrew); }
        out = { ...this.pub(c.id), alien, n: top.n };
      }
    }
    this.ejected = { out, rows: rows.slice(0, 8), skip, tie: !!tie, why: out ? null : tie ? 'tie' : rows.length || skip ? 'skip' : 'none' };
    this.history[this.history.length - 1].ejected = out ? { name: out.name, alien: out.alien } : null;
    this.phase = 'eject'; this.room.fx(out ? (out.alien ? 'gotcha' : 'oops') : 'skip');
    this.setTimer(EJECT_MS, () => this.afterEject());
  }
  afterEject() {
    if (this.phase !== 'eject') return;
    const w = this.check(); if (w) return this.end(w.side, w.reason);
    this.newRound();
  }
  check() {
    const a = this.aliensAlive().length, c = this.crewAlive().length;
    if (!a) return { side: 'crew', reason: 'caught' };
    if (a >= c) return { side: 'aliens', reason: 'outnumber' };
    return null;
  }
  end(side, reason) {
    if (this.phase === 'over') return;
    this.room.cancel(this.timer); this.endsAt = 0;
    this.winner = side; this.reason = reason; this.phase = 'over';
    for (const c of this.crew.values()) {
      if (c.gone) continue;
      if ((isAlien(c.role) ? 'aliens' : 'crew') === side) this.add(c, 'win', PTS.win);
      if (c.alive) this.add(c, 'survive', PTS.survive);
    }
    this.room.fx(side === 'crew' ? 'win' : 'lose', { side });
  }
  next() {
    const f = { roles: () => this.newRound(), emergency: () => this.beginShift(), shift: () => this.resolve(), report: () => this.afterReport(), discuss: () => this.beginVote(), vote: () => this.tally(), eject: () => this.afterEject() }[this.phase];
    if (f) f();
  }

  // ---- phone input ----
  act(p, m) {
    const c = this.member(p.id);
    if (!m || typeof m.op !== 'string') return { ok: false, error: 'Unknown move.' };
    if (!c || c.gone) return { ok: false, error: 'You’re a stowaway this trip. Join the next game!' };
    switch (m.op) {
      case 'shift': {
        if (this.phase !== 'shift') return { ok: false, error: 'Not now.' };
        if (!c.alive) return { ok: false, error: 'Ghosts can’t hold a wrench.' };
        const i = Number(m.station);
        if (!Number.isInteger(i) || i < 0 || i >= this.emergency.stations.length) return { ok: false, error: 'Pick a station.' };
        const sab = m.sab === true;
        if (sab && !isAlien(c.role)) return { ok: false, error: 'Only aliens can sabotage.' };
        this.picks.set(c.id, { station: i, sab }); this.maybeShiftDone(); return { ok: true };
      }
      case 'scan': {
        if (this.phase !== 'shift') return { ok: false, error: 'Not now.' };
        if (c.role !== 'scanner' || !c.alive) return { ok: false, error: 'Only the Scanner can scan.' };
        if (m.id !== 'skip') { const t = this.member(m.id); if (!t || !t.alive || t.gone || t.id === c.id) return { ok: false, error: 'Scan someone else aboard.' }; }
        this.scans.set(c.id, m.id === 'skip' ? 'skip' : m.id); this.maybeShiftDone(); return { ok: true };
      }
      case 'abduct': {
        if (this.phase !== 'shift') return { ok: false, error: 'Not now.' };
        if (!isAlien(c.role) || !c.alive) return { ok: false, error: 'Only aliens have a tractor beam.' };
        if (m.id === 'skip' || m.id == null) { this.beams.delete(c.id); return { ok: true }; }
        if (this.charges <= 0) return { ok: false, error: 'The beam is out of charge.' };
        const t = this.member(m.id); if (!t || !t.alive || t.gone || t.id === c.id) return { ok: false, error: 'Beam up someone aboard.' };
        if (isAlien(t.role)) return { ok: false, error: 'That’s one of yours!' };
        this.beams.set(c.id, t.id); return { ok: true };
      }
      case 'patch': {
        if (this.phase !== 'shift') return { ok: false, error: 'Not now.' };
        if (c.alive) return { ok: false, error: 'Only ghosts do spooky chores.' };
        if (isAlien(c.role)) return { ok: false, error: 'Alien ghosts don’t fix things!' };
        if (!SYS_KEYS.includes(m.sys)) return { ok: false, error: 'Pick a system.' };
        this.patches.set(c.id, m.sys); return { ok: true };
      }
      case 'whisper': {
        if (this.phase !== 'shift') return { ok: false, error: 'Not now.' };
        if (c.alive) return { ok: false, error: 'Only ghosts can whisper.' };
        if (m.id === 'skip') { this.whispers.set(c.id, 'skip'); return { ok: true }; }
        const t = this.member(m.id); if (!t || !t.alive || t.gone) return { ok: false, error: 'Whisper about someone still aboard.' };
        this.whispers.set(c.id, t.id); return { ok: true };
      }
      case 'say': return this.say(c, m);
      case 'vote': {
        if (this.phase !== 'vote') return { ok: false, error: 'Not now.' };
        if (!c.alive) return { ok: false, error: 'Ghosts can’t vote.' };
        if (m.id !== 'skip') { const t = this.member(m.id); if (!t || !t.alive || t.gone) return { ok: false, error: 'Vote for someone aboard.' }; if (t.id === c.id) return { ok: false, error: 'You can’t vote for yourself.' }; }
        this.votes.set(c.id, m.id === 'skip' ? 'skip' : m.id); this.maybeVoteDone(); return { ok: true };
      }
      default: return { ok: false, error: 'Unknown move.' };
    }
  }
  // A quick claim posted to the TV during the discussion.
  //   sus / clear: a player · scan: a player + alien or crew · where: "I was at <station>" · sab: "Sabotage hit <station>"
  say(c, m) {
    if (this.phase !== 'discuss') return { ok: false, error: 'Claims are for the discussion.' };
    if (!c.alive) return { ok: false, error: 'Ghosts can’t talk. Whisper during the shift!' };
    if (!SAY_KINDS.includes(m.kind)) return { ok: false, error: 'Pick something to say.' };
    const s = this.said.get(c.id) || { n: 0, at: -1e9 };
    if (s.n >= SAY_MAX) return { ok: false, error: 'That’s enough talk this round!' };
    if (this.room.now() - s.at < SAY_GAP_MS) return { ok: false, error: 'Slow down!' };
    const claim = { by: c.id, kind: m.kind, at: this.room.now() };
    if (m.kind === 'where' || m.kind === 'sab') {
      const i = Number(m.station);
      if (!this.emergency || !Number.isInteger(i) || i < 0 || i >= this.emergency.stations.length) return { ok: false, error: 'Pick a station.' };
      claim.station = i;
    } else {
      const t = this.member(m.id);
      if (!t || !t.alive || t.gone || t.id === c.id) return { ok: false, error: 'Pick someone else aboard.' };
      claim.id = t.id;
      if (m.kind === 'scan') { if (typeof m.alien !== 'boolean') return { ok: false, error: 'Alien or crew?' }; claim.alien = m.alien; }
    }
    this.said.set(c.id, { n: s.n + 1, at: this.room.now() });
    this.claims.push(claim); if (this.claims.length > 40) this.claims.shift();
    { const t = claim.id && this.member(claim.id), w = claim.kind === 'scan' || claim.kind === 'sab' ? 2 : claim.kind === 'sus' && t && isAlien(t.role) ? 1 : 0; if (w) this.loud.set(c.id, (this.loud.get(c.id) || 0) + w); }
    this.room.fx('say', { kind: m.kind });
    this.botsHear(claim);
    return { ok: true };
  }

  // ---- bots: they play their role, reason from what they saw, and bluff ----
  sus(bot, id, d) { const m = this.mind.get(bot.id); if (!m || id === bot.id) return; m.set(id, (m.get(id) || 0) + d); }
  susOf(bot, id) { const m = this.mind.get(bot.id); return (m && m.get(id)) || 0; }
  stationOf(id) { const R = this.report; if (!R) return null; const i = R.stations.findIndex((s) => s.ids.includes(id)); return i < 0 ? null : i; }
  botShift(c) {
    if (this.phase !== 'shift' || c.gone) return;
    const E = this.emergency, k = E.stations.length;
    if (c.alive) {
      let sab = false;
      if (isAlien(c.role)) {
        const left = this.home - this.progress, mates = this.aliensAlive().length, block = this.blockAt();
        const behind = this.progress >= this.round - 1; // the crew is on schedule: time to act
        const want = left <= 1 ? 0.95 : (behind ? 0.6 : 0.35) * (this.living().length <= 5 ? 0.75 : 1); // a small crew notices everything
        sab = this.room.rng() < Math.min(0.95, (want * block) / Math.max(1, mates * 0.75)); // a pack spreads the risk around
        if (left <= 1 && block === 1) sab = true;
      }
      this.picks.set(c.id, { station: this.rand(k), sab });
      // the beam: once the crew starts talking, silence whoever knows too much
      if (isAlien(c.role) && this.charges > 0 && this.round >= 2 && ![...this.beams.keys()].length && this.room.rng() < 0.55) {
        const crew = this.living().filter((x) => !isAlien(x.role)); const loud = (x) => this.history.length ? this.loud.get(x.id) || 0 : 0;
        if (crew.length) { crew.sort((a, b) => loud(b) - loud(a)); this.beams.set(c.id, (loud(crew[0]) > 0 && this.room.rng() < 0.75 ? crew[0] : this.pick(crew)).id); }
      }
      if (c.role === 'scanner') {
        const known = new Set(this.scanLog.map((x) => x.id));
        const all = this.living().filter((x) => x.id !== c.id), cand = all.filter((x) => !known.has(x.id)), pool = cand.length ? cand : all;
        if (pool.length) { pool.sort((a, b) => this.susOf(c, b.id) - this.susOf(c, a.id)); this.scans.set(c.id, this.room.rng() < 0.6 ? pool[0].id : this.pick(pool).id); } else this.scans.set(c.id, 'skip');
      }
    } else {
      if (!isAlien(c.role)) { const low = SYS_KEYS.slice().sort((a, b) => this.hp[a] - this.hp[b]); this.patches.set(c.id, this.room.rng() < 0.7 ? low[0] : this.pick(SYS_KEYS)); }
      const others = this.living();
      if (others.length && this.room.rng() < 0.8) {
        let t;
        if (isAlien(c.role)) { const crew = others.filter((x) => !isAlien(x.role)); t = this.pick(crew.length ? crew : others); }
        else { others.sort((a, b) => this.susOf(c, b.id) - this.susOf(c, a.id)); t = this.room.rng() < 0.6 ? others[0] : this.pick(others); }
        this.whispers.set(c.id, t.id);
      }
    }
    this.maybeShiftDone();
  }
  // After the report: bots update what they believe from what they saw at their own station.
  botsLearn() {
    const R = this.report;
    for (const c of this.crew.values()) {
      if (!this.mind.has(c.id) || isAlien(c.role) || !c.alive) continue;
      const mine = this.stationOf(c.id), mates = mine == null ? [] : R.stations[mine].ids.filter((id) => id !== c.id);
      if (c.role === 'engineer' && mine != null) {
        const sab = R.stations[mine].sab; for (const id of mates) this.sus(c, id, sab ? (2.2 * sab) / mates.length : -0.4);
      }
      if (R.scan && R.scan.by === c.id) this.sus(c, R.scan.id, R.scan.alien ? 6 : -4);
      for (const o of this.living()) if (o.id !== c.id) this.sus(c, o.id, (R.S && !mates.includes(o.id) ? 0.08 : 0) + (this.room.rng() - 0.5) * 0.12);
    }
  }
  botsHear(cl) {
    const R = this.report;
    for (const c of this.crew.values()) {
      if (!this.mind.has(c.id) || isAlien(c.role) || cl.by === c.id || !c.alive) continue;
      const trust = Math.max(0.15, 1 - Math.max(0, this.susOf(c, cl.by)) / 2);
      const mine = this.stationOf(c.id), mates = mine == null || !R ? [] : R.stations[mine].ids;
      if (cl.kind === 'sus') { this.sus(c, cl.id, 0.3 * trust); if (cl.id === c.id) this.sus(c, cl.by, 0.5); }
      if (cl.kind === 'clear') this.sus(c, cl.id, -0.2 * trust);
      if (cl.kind === 'scan') {
        if (c.role === 'scanner') { this.sus(c, cl.by, 3); continue; } // I'm the real Scanner!
        const rivals = new Set(this.claims.filter((x) => x.kind === 'scan' && x.by !== cl.by).map((x) => x.by));
        if (rivals.size) { this.sus(c, cl.by, 0.6); for (const r of rivals) this.sus(c, r, 0.4); }
        this.sus(c, cl.id, (cl.alien ? 1.3 : -0.8) * trust);
        if (cl.id === c.id && cl.alien) this.sus(c, cl.by, 5); // I know I'm not an alien!
      }
      if (!R) continue;
      if (cl.kind === 'where') {
        // I was at that station and they weren't (or I saw them somewhere else): a liar!
        const truly = this.stationOf(cl.by);
        if ((mine === cl.station && truly !== mine) || (mine != null && truly === mine && cl.station !== mine)) this.sus(c, cl.by, 3);
        else if (this.sabClaimed(cl.station)) this.sus(c, cl.by, 0.5 * this.sabClaimed(cl.station));
      }
      if (cl.kind === 'sab') {
        if (c.role === 'engineer') { if (!R.stations[cl.station].sab) this.sus(c, cl.by, 2.5); continue; }
        if (mine === cl.station) for (const id of mates) { if (id !== c.id) this.sus(c, id, (1.1 * trust) / Math.max(1, mates.length - 1)); }
        for (const x of this.claims) if (x.kind === 'where' && x.station === cl.station && x.by !== c.id) this.sus(c, x.by, 0.5 * trust);
        if (!R.S) this.sus(c, cl.by, 3); // the TV said nothing was sabotaged
      }
    }
  }
  sabClaimed(k) { return this.claims.filter((x) => x.kind === 'sab' && x.station === k).length; }
  heat(id) { let h = 0; for (const cl of this.claims) { if (cl.id === id && cl.kind === 'sus') h += 1; if (cl.id === id && cl.kind === 'scan' && cl.alien) h += 2; if (cl.id === id && cl.kind === 'clear') h -= 0.5; } for (const t of this.votes.values()) if (t === id) h += 1; return h; }
  botTalk(c, ms) {
    const n = 1 + this.rand(3), plan = [];
    for (let i = 0; i < n; i++) plan.push(2500 + this.room.rng() * Math.max(2000, ms - 6000));
    plan.sort((a, b) => a - b).forEach((at, i) => this.room.after(at, () => { if (this.phase === 'discuss' && c.alive && !c.gone) this.botSay(c, i); }));
  }
  botSay(c, i) {
    const others = this.living().filter((x) => x.id !== c.id); if (!others.length) return;
    const R = this.report, said = (m) => this.say(c, m), mine = this.stationOf(c.id);
    const saidWhere = this.claims.some((x) => x.by === c.id && x.kind === 'where');
    const top = (list) => list.slice().sort((a, b) => this.susOf(c, b.id) - this.susOf(c, a.id))[0];
    if (!isAlien(c.role)) {
      if (c.role === 'scanner' && i === 0 && R && R.scan && R.scan.by === c.id && (R.scan.alien || this.room.rng() < 0.4) && this.member(R.scan.id).alive) return said({ kind: 'scan', id: R.scan.id, alien: R.scan.alien });
      if (c.role === 'engineer' && i === 0 && R && R.S) { const st = R.stations.map((s, k) => ({ k, s })).sort((a, b) => b.s.sab - a.s.sab)[0]; return said({ kind: 'sab', station: st.k }); }
      if (mine != null && !saidWhere && (this.claims.some((x) => x.kind === 'sab') || this.room.rng() < 0.45)) return said({ kind: 'where', station: mine });
      const t = top(others), v = this.susOf(c, t.id);
      if (v > 0.45) return said({ kind: 'sus', id: t.id });
      if (this.room.rng() < 0.35) { const low = others.slice().sort((a, b) => this.susOf(c, a.id) - this.susOf(c, b.id))[0]; return said({ kind: 'clear', id: low.id }); }
      return;
    }
    // aliens: blend in, point at a crew member, sometimes fake a scan or an engineer report
    const crew = others.filter((x) => !isAlien(x.role)), mates = others.filter((x) => isAlien(x.role));
    if (!crew.length) return;
    const mySab = !!(this.picks.get(c.id) || {}).sab, hotSt = R ? R.stations.findIndex((s, k) => this.sabClaimed(k)) : -1;
    if (mine != null && !saidWhere && (i === 0 || hotSt >= 0) && this.room.rng() < 0.75) {
      // tell the truth about where they were… unless that's the station everybody's looking at
      const lie = hotSt === mine && mySab && this.room.rng() < (R.stations[mine].ids.length <= 1 ? 0.6 : 0.2); // co-workers would catch a lie
      const opts = R.stations.map((s, k) => k).filter((k) => k !== mine);
      return said({ kind: 'where', station: lie && opts.length ? this.pick(opts) : mine });
    }
    const accuser = this.claims.filter((cl) => cl.id === c.id && (cl.kind === 'sus' || (cl.kind === 'scan' && cl.alien))).map((cl) => this.member(cl.by)).find((x) => x && x.alive && !isAlien(x.role));
    if (accuser && this.room.rng() < 0.7) return said(this.room.rng() < 0.3 && !this.claims.some((cl) => cl.kind === 'scan' && cl.by !== c.id) ? { kind: 'scan', id: accuser.id, alien: true } : { kind: 'sus', id: accuser.id });
    const r = this.room.rng();
    if (r < 0.15 && !this.claims.some((cl) => cl.kind === 'scan')) return said({ kind: 'scan', id: this.pick(crew).id, alien: true });
    if (r < 0.27 && mates.length) return said({ kind: 'clear', id: this.pick(mates).id });
    if (r < 0.45 && R && R.S && this.claims.filter((cl) => cl.kind === 'sab').length < 2) { const opts = R.stations.map((s, k) => k).filter((k) => k !== mine); if (opts.length) return said({ kind: 'sab', station: this.pick(opts) }); }
    const hot = crew.slice().sort((a, b) => this.heat(b.id) - this.heat(a.id))[0];
    return said({ kind: 'sus', id: (this.heat(hot.id) > 0 && this.room.rng() < 0.7 ? hot : this.pick(crew)).id });
  }
  botVote(c) {
    if (this.phase !== 'vote' || !c.alive || c.gone || this.votes.has(c.id)) return;
    const others = this.living().filter((x) => x.id !== c.id); if (!others.length) { this.votes.set(c.id, 'skip'); return this.maybeVoteDone(); }
    let choice = 'skip';
    if (!isAlien(c.role)) {
      const score = (x) => this.susOf(c, x.id) + 0.12 * this.heat(x.id) + this.room.rng() * 0.2;
      const best = others.slice().sort((a, b) => score(b) - score(a))[0], sb = score(best);
      // don't risk the crew's numbers on a hunch when it's close
      const margin = this.aliensAlive().length + 1 >= this.crewAlive().length ? 1.3 : this.round <= 1 ? 1.1 : 0.85;
      if (sb >= margin) choice = best.id; else if (sb >= 0.4 && this.room.rng() < 0.2) choice = best.id;
    } else {
      const crew = others.filter((x) => !isAlien(x.role)), mates = others.filter((x) => isAlien(x.role));
      const hotMate = mates.find((m) => this.heat(m.id) >= Math.max(3, this.living().length / 2));
      if (hotMate && this.room.rng() < 0.5) choice = hotMate.id; // throw a doomed partner under the bus
      else if (crew.length) { const hot = crew.slice().sort((a, b) => this.heat(b.id) - this.heat(a.id))[0]; choice = this.heat(hot.id) > 0 || this.room.rng() < 0.5 ? hot.id : this.pick(crew).id; }
    }
    this.votes.set(c.id, choice); this.maybeVoteDone();
  }

  // ---- screens ----
  standings() {
    const side = (c) => (isAlien(c.role) ? 'aliens' : 'crew');
    return [...this.crew.values()].filter((c) => this.player(c.id)).map((c) => ({ ...this.pub(c.id), pts: c.pts, points: c.pts, side: side(c), role: c.role, alive: c.alive && !c.gone, won: this.winner ? side(c) === this.winner : false }))
      .sort((a, b) => (b.won - a.won) || b.pts - a.pts || a.name.localeCompare(b.name));
  }
  // Party points: the winning side first, then contribution.
  results() { return this.phase === 'over' ? this.standings().map((r) => r.id) : []; }
  claimOut(cl) {
    const o = { ...this.pub(cl.by), kind: cl.kind };
    if (cl.id) o.target = this.pub(cl.id);
    if (cl.kind === 'scan') o.alien = cl.alien;
    if ((cl.kind === 'where' || cl.kind === 'sab') && this.emergency) o.station = this.emergency.stations[cl.station];
    return o;
  }
  tv() {
    const ph = this.phase, out = {
      phase: ph, round: this.round, maxRounds: this.maxRounds, home: this.home, progress: this.progress,
      endsIn: this.endsAt && ph !== 'over' ? Math.max(0, this.endsAt - this.room.now()) : 0,
      beam: this.charges, hp: { ...this.hp }, hpMax: this.hpMax, bank: { ...this.bank }, talk: this.s.talk, family: this.family,
      aliensTotal: this.aliensTotal || 0, aliensLeft: this.aliensAlive().length,
      specials: { scanner: this.roleHas('scanner'), engineer: this.roleHas('engineer'), mimic: this.roleHas('mimic') },
      crew: [...this.crew.values()].filter((c) => this.player(c.id)).map((c) => ({
        ...this.pub(c.id), alive: c.alive && !c.gone, ghost: !c.alive && !c.gone, gone: c.gone, out: c.out, abducted: !!c.abducted,
        alien: c.out != null || ph === 'over' ? isAlien(c.role) : null, role: ph === 'over' ? c.role : null,
        picked: ph === 'shift' && c.alive ? this.picks.has(c.id) : null, voted: ph === 'vote' && c.alive ? this.votes.has(c.id) : null,
      })),
      emergency: this.emergency ? { ...this.emergency, ...SYSTEMS[this.emergency.sys] } : null,
      history: this.history.slice(-8),
    };
    if (ph === 'shift') { const w = this.living().filter((c) => !this.picks.has(c.id)); out.shift = { picked: this.living().length - w.length, of: this.living().length, waiting: w.slice(0, 12).map((c) => this.pub(c.id).name), ghosts: this.patches.size + [...this.whispers.values()].filter((x) => x !== 'skip').length }; }
    if (this.report && (ph === 'report' || ph === 'discuss' || ph === 'vote' || ph === 'eject' || ph === 'over')) {
      const R = this.report;
      out.report = { abducted: R.abducted, sys: R.sys, S: R.S, block: R.block, damage: R.damage, jumped: R.jumped, healed: R.healed, broke: R.broke, before: R.before, stations: R.stations.map((s) => ({ icon: s.icon, label: s.label })) };
    }
    if (ph === 'discuss' || ph === 'vote') {
      out.claims = this.claims.slice(-CLAIMS_KEPT).map((cl) => this.claimOut(cl)).reverse();
      const w = new Map(); for (const t of this.whispers.values()) if (t !== 'skip' && this.member(t) && this.member(t).alive) w.set(t, (w.get(t) || 0) + 1);
      out.whispers = [...w].map(([id, n]) => ({ ...this.pub(id), n })).sort((a, b) => b.n - a.n).slice(0, 4);
    }
    if (ph === 'vote') { const w = this.living().filter((c) => !this.votes.has(c.id)); out.vote = { voted: this.living().length - w.length, of: this.living().length, waiting: w.slice(0, 12).map((c) => this.pub(c.id).name) }; }
    if (ph === 'eject' || (ph === 'over' && this.ejected && (this.reason === 'caught' || this.reason === 'outnumber'))) out.eject = this.ejected;
    if (ph === 'over') out.over = { winner: this.winner, reason: this.reason, standings: this.standings(), aliens: [...this.crew.values()].filter((c) => isAlien(c.role) && this.player(c.id)).map((c) => ({ ...this.pub(c.id), role: c.role, alive: c.alive && !c.gone })) };
    out.standings = this.standings().slice(0, 12).map((r) => ({ id: r.id, name: r.name, avatar: r.avatar, points: r.pts }));
    return out;
  }
  view(p) {
    const base = this.tv(), c = this.member(p.id);
    if (!c) return { ...base, me: null };
    const ri = ROLE_INFO[c.role], ph = this.phase;
    const me = { id: c.id, role: c.role, roleName: ri.name, roleIcon: ri.icon, side: ri.side, alive: c.alive && !c.gone, ghost: !c.alive && !c.gone, pts: c.pts };
    const out = { ...base, me, choices: this.living().filter((x) => x.id !== c.id).map((x) => this.pub(x.id)) };
    if (isAlien(c.role)) out.allies = [...this.crew.values()].filter((x) => x.id !== c.id && isAlien(x.role)).map((x) => ({ ...this.pub(x.id), role: x.role, alive: x.alive && !x.gone }));
    if (c.role === 'scanner') out.scanLog = this.scanLog.map((x) => ({ ...this.pub(x.id), round: x.round, alien: x.alien }));
    if (ph === 'shift' || ph === 'emergency') {
      out.mine = this.picks.get(c.id) || null; out.scanned = this.scans.get(c.id) || null;
      out.beamAt = this.beams.get(c.id) || null;
      out.patched = this.patches.get(c.id) || null; out.whispered = this.whispers.get(c.id) || null;
    }
    if (this.report && ph !== 'shift' && ph !== 'emergency') {
      const R = this.report, pk = [...R.stations.keys()].find((i) => R.stations[i].ids.includes(c.id));
      out.myStation = pk == null ? null : pk;
      out.mates = pk == null ? [] : R.stations[pk].ids.filter((id) => id !== c.id).map((id) => this.pub(id));
      if (c.role === 'engineer' && c.alive) out.breakdown = R.stations.map((s) => s.sab);
      if (c.role === 'scanner' && R.scan && R.scan.by === c.id) out.scan = { ...this.pub(R.scan.id), alien: R.scan.alien };
      if (isAlien(c.role)) out.mySab = R.stations.some((s) => s.ids.includes(c.id)) && !!(this.picks.get(c.id) || {}).sab;
    }
    if (ph === 'discuss') { const s = this.said.get(c.id) || { n: 0, at: -1e9 }; out.sayLeft = SAY_MAX - s.n; out.sayIn = Math.max(0, SAY_GAP_MS - (this.room.now() - s.at)); }
    if (ph === 'vote') out.myVote = this.votes.get(c.id) || null;
    if (ph === 'over') { const r = this.standings(), i = r.findIndex((x) => x.id === c.id); out.rank = i + 1; out.of = r.length; out.stats = { ...c.stats }; out.won = (isAlien(c.role) ? 'aliens' : 'crew') === this.winner; }
    return out;
  }
}

// Party Mode: settings that fit the players in the room and this game's minutes in the plan (box/party-fit.js).
const PF = require('../party-fit');
const partyFit = ({ players: P, minutes: M }) => {
  const s = PF.best({ trip: [4, 3, 5], talk: P >= 10 ? [60, 45, 90, 30] : [45, 30, 60, 90] }, (x) => 1.5 + x.trip * (x.talk + 70) / 60, M);
  return { trip: s.trip, talk: s.talk };
};

module.exports = {
  partyFit,
  key: 'alien', name: 'Alien Abduction', min: 4, best: [5, 12], howSteps: 6, fields, defaults,
  show: { facts: false }, // intro cutscene before the game (public/box/intros/alien.js)
  locked: { how: 'Finish a game of Most Likely To… to unlock it.' }, // public/unlocks.js + UNLOCK_RULES in box/room.js
  create: (room, settings) => new Alien(room, settings),
  _test: { EMERGENCIES, SYSTEMS, PTS, HP_MAX, ROLE_INFO },
};
