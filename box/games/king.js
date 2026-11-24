'use strict';
// Kill the King (TRIAL): a court of schemers defends a castle from a goblin horde together, while
// each of them climbs (or tumbles down) the social ladder. Rules live here; the TV gets tv(), each
// phone view(p). Sir Bellow, the royal herald, announces everything (his lines are in HERALD and
// copied into public/box/intros/king.js `story` so they are pre-voiced).
//
// A round:
//   brief    the round's mission is announced
//   mission  60–90 s of co-op phone tasks (Mend the Wall, Light the Beacons, Ring the Bells, Man
//            the Gate). Every task adds DEFENCE; ghosts and haunted players count half.
//   repel    this round's defence against the wave. The kingdom's TARGET is the sum of the waves:
//            missing a wave only dents the walls; the kingdom falls only if the total defence is
//            below the target after the last round.
//   court    secret messages (1:1 or up to 3 people), presets or typed (filtered). The TV only
//            shows who is talking to whom. The Coup button, the Assassin's dagger, the Spy's
//            glass, the Fortune Teller's peek and the ghosts' Haunt live here.
//   dusk     the Assassin's attempt (only when there was one): a kill, or a clue about them.
//   coup     (when someone pressed Coup) everyone alive votes; YES from 60% of the living (the King
//            counts and always votes no) crowns the caller. Everyone who was below the caller moves
//            up one seat. A failed coup sends the caller to the bottom.
//   trial    (after a coup) the old King: SPARE (to the bottom of the ladder) or KILL (a ghost).
//   summon   the King summons one player and names a sentence: Kill, Demote or Reveal (or mercy).
//   hearing  everyone alive votes Aye / Nay. The King can offer voters a promotion for an AYE, the
//            accused can offer points for a NAY. Offers are binding: the game pays them when the
//            vote resolves. Accepting one pledges your vote; voting the other way breaks your oath
//            (a fine to the one you betrayed). Ties go to the King.
//   verdict  the votes, the deals and the sentence (Reveal shows the accused's sent messages).
//   pay      rank pay by tier (Crown 100, Nobles 60, Guild 35, Commons 15) plus a mission bonus.
// End: siege (did the kingdom hold?) → unmask (the secret roles) → over (standings, rivalries,
// trial feedback). If the kingdom falls, everyone keeps only a quarter of their points (the
// Turncloak keeps everything and gets a bonus).
// Ghosts (killed players) leave the ladder: no rank pay, no votes, half-strength missions, but
// they can still message, and Haunt one of the players who voted to kill them each round (steal
// 15 points and halve their next mission).
// Secret roles (dealt to some players): Assassin (a 50% kill every other round; a miss leaves a
// clue), Spy (each round, read the messages one player SENDS, without the recipients), Ghoul (when
// killed, picks one of their killers and drains half of that player's pay every round), Fortune
// Teller (once a game, sees one player's secret role), Turncloak (secretly paid by the goblins).
// Secrecy: tv() never carries message text (except a passed Reveal) or a secret role before the
// unmask; each phone gets only its own secrets (view). Every phone input is validated; timers use
// room.after; results() lists ids best-first once the game is over.
const PF = require('../party-fit');
const TEXT = require('../../public/box/filter');
const FEEDBACK = require('../trial-feedback');

const opt = (pairs) => pairs.map(([value, label]) => ({ value, label }));
const fields = [
  { key: 'rounds', label: 'Rounds', options: opt([[5, '5 rounds (about 25–30 min)'], [3, '3 rounds (shorter, about 15 min)']]) },
  { key: 'mission', label: 'Missions', options: opt([[45, '45 seconds'], [60, '60 seconds'], [75, '75 seconds'], [90, '90 seconds']]) },
  { key: 'court', label: 'Court (secret messages)', options: opt([[60, '1 minute'], [90, '90 seconds'], [120, '2 minutes']]) },
  { key: 'secrets', label: 'Secret roles', options: opt([['on', '🎭 On'], ['off', 'Off (a simpler first game)']]) },
];
const defaults = { rounds: 5, mission: 75, court: 90, secrets: 'on' };

// ---------- the social ladder ----------
const TITLES = [
  { k: 'king', name: 'King', icon: '👑' }, { k: 'knight', name: 'Knight', icon: '🛡️' }, { k: 'steward', name: 'Steward', icon: '📜' },
  { k: 'cook', name: 'Cook', icon: '🍲' }, { k: 'smith', name: 'Blacksmith', icon: '⚒️' }, { k: 'bard', name: 'Bard', icon: '🎻' },
  { k: 'jester', name: 'Jester', icon: '🃏' }, { k: 'groom', name: 'Stablehand', icon: '🐴' }, { k: 'gardener', name: 'Gardener', icon: '🌷' },
];
const PEASANT = { k: 'peasant', name: 'Peasant', icon: '🧺' };
const TIERS = [{ k: 'crown', name: 'Crown', pay: 100 }, { k: 'noble', name: 'Nobles', pay: 60 }, { k: 'guild', name: 'Guild', pay: 35 }, { k: 'commons', name: 'Commons', pay: 15 }];
// Seat i (0 = the King) of n living players.
const tierOf = (i, n) => (i === 0 ? 0 : i <= 2 ? 1 : i === n - 1 ? 3 : i <= 5 ? 2 : 3);
const titleOf = (i, n) => (i === 0 ? TITLES[0] : n >= 4 && i === n - 1 ? PEASANT : TITLES[i] || PEASANT);

// ---------- secret roles ----------
const SECRETS = {
  assassin: { name: 'Assassin', icon: '🗡️', blurb: 'Every other round, mark someone in court. Half the time they die at dusk; a miss leaves a clue about you.' },
  spy: { name: 'Spy', icon: '👁️', blurb: 'Each round, pick one player: you read every message they SEND (not who to, not the replies).' },
  ghoul: { name: 'Ghoul', icon: '💀', blurb: 'If you are killed, pick one of your killers: you drain half their pay every round until the end.' },
  seer: { name: 'Fortune Teller', icon: '🔮', blurb: 'Once a game, peek at one player’s secret role.' },
  turncloak: { name: 'Turncloak', icon: '👺', blurb: 'The goblins pay you. If the kingdom falls, you keep every point and get 150 more.' },
};
const SECRET_ORDER = ['assassin', 'spy', 'ghoul', 'seer', 'turncloak'];
const secretCount = (n) => (n <= 4 ? 2 : n <= 6 ? 3 : n <= 8 ? 4 : 5);
const LOYAL = { name: 'Loyal Subject', icon: '🕊️', blurb: 'No secret role. Climb the ladder the honest way… or not.' };

// ---------- missions ----------
const MISSIONS = {
  wall: { name: 'Mend the Wall', icon: '🧱', how: 'Tap the cracked stones on your phone before the goblins widen them.' },
  beacons: { name: 'Light the Beacons', icon: '🔥', how: 'Your phone asks for someone’s rune. Shout yours, ask for theirs, tap it!' },
  bells: { name: 'Ring the Bells', icon: '🔔', how: 'Ring together! Bells rung at the same moment count for much more. Count it in: three, two, one, RING!' },
  gate: { name: 'Man the Gate', icon: '🚪', how: 'Hold the winch with your partner. It only turns while you BOTH hold, and slips every few seconds: re-grip together!' },
};
const ORDER = { 5: ['wall', 'beacons', 'bells', 'gate', 'beacons'], 3: ['wall', 'beacons', 'bells'] };
const WAVE = { 5: [0.8, 0.9, 1.0, 1.05, 1.1], 3: [0.85, 1.0, 1.1] };
const PACE = 0.75; // defence a player should add per second (the waves assume it)
const RUNES = ['☀️', '🌙', '⭐', '👑', '🗝️', '🐟'];
const RUNE_NAMES = ['Sun', 'Moon', 'Star', 'Crown', 'Key', 'Fish'];

// ---------- numbers ----------
const MS = { brief: 7000, brief1: 11000, repel: 7500, dusk: 7000, coup: 22000, coupResult: 7000, trial: 20000, trialResult: 7000, summon: 25000, hearing: 40000, verdict: 9000, verdictSkip: 4500, pay: 9000, siege: 9000, unmask: 13000 };
const PTS = { acquit: 20, haunt: 15, oath: 20, assassin: 30, turncloak: 150, bonusCap: 25, bonusDiv: 3, fallKeep: 0.25 };
const ASSASSIN_ODDS = 0.5, ASSASSIN_EVERY = 2;
const GOLD_OFFERS = [10, 25, 50];
const MAX_MSG = 100, MSG_GAP = 600, MSG_CAP = 200, MAX_TO = 3;
const PRESETS = ['Vote with me and I’ll owe you one.', 'I’m with you.', 'Not this time.', 'Coup the King?', 'Spare me and I’ll repay you.', 'Who do you think the Assassin is?', 'Keep this between us.', 'Long live the King!', 'Watch your back.', 'Deal.'];
// Wall: a 3×3 of stones, two cracked at a time. Bells: rings within PEAL_MS make one peal.
const WALL_CELLS = 9, WALL_GAP = 200, WALL_MISS = 600, BEACON_LOCK = 2500, BELL_COOLDOWN = 1500, PEAL_MS = 700;
const GATE_TICK = 500, GATE_SLIP = 4000, GATE_REGRIP = 700, GATE_SHUFFLE = 20000;

// Sir Bellow's lines (no names: they are pre-voiced; the TV shows the details).
const HERALD = {
  first: 'Hear ye! The goblin horde marches on the kingdom. Round one begins!',
  round: ['A new day dawns, and the goblins return!', 'Another round, my lords and ladies. To your posts!'],
  last: 'The final round! Hold the walls one last time!',
  wall: 'Mend the wall! The stones are cracking!',
  beacons: 'Light the beacons! Call out your runes!',
  bells: 'Ring the bells, all together now!',
  gate: 'Man the gate! Grip the winch with your partner!',
  repelled: ['The wave is repelled! Huzzah!', 'The goblins scatter! Well defended!'],
  breached: ['The walls are dented! We fell short this time.', 'A breach! The goblins chip away at the walls.'],
  court: ['To court! Whisper your schemes, but trust no one.', 'The court is in session. Make your deals.'],
  dead: 'Alas! A body is found in the castle. The Assassin strikes!',
  missed: 'An attempt on a life, foiled! The Assassin left a clue behind.',
  coup: 'A coup! Someone dares to reach for the crown!',
  coupWin: 'The coup succeeds! Long live the new King!',
  coupFail: 'The coup is crushed! The traitor is cast down.',
  trial: 'What of the old King? Spare them, or end them?',
  spared: 'The old King is spared, and sent to muck out the stables.',
  executed: 'The old King is no more. Their ghost will remember this.',
  summon: 'The King calls a judgement! Who will be summoned?',
  mercy: 'The King shows mercy today. No one is summoned.',
  hearing: ['The accused stands before the court. Cast your votes!', 'Aye or nay! The court decides.'],
  passed: 'The sentence stands! So it is decreed.',
  failed: 'The court says nay! The accused walks free.',
  pay: ['Payday! Every rank collects its due.', 'The treasury pays out. Rank has its rewards.'],
  survive: 'The kingdom stands! The goblins flee into the hills!',
  fall: 'The walls have fallen! The goblins loot the treasury!',
  unmask: 'And now, the secrets of the court are revealed!',
  over: 'That concludes the reign. Long live whoever is left!',
};

class Game {
  constructor(room, s) {
    this.room = room;
    const pick = (f, v) => { const o = f.options.find((x) => String(x.value) === String(v)); return o ? o.value : defaults[f.key]; };
    this.s = {}; for (const f of fields) this.s[f.key] = pick(f, s ? s[f.key] : undefined);
    this.practice = !!(s && s.practice);
    this.phase = 'intro'; this.round = 0; this.P = new Map(); this.ladder = []; this.timer = null; this.timerFn = null; this.endsAt = 0;
    this.msgs = []; this.msgSeq = 0; this.flights = []; this.say_ = null; this.sayKey = 0; this.target = 0; this.waves = []; this.defTotal = 0; this.history = [];
    this.mis = null; this.J = null; this.coup = null; this.trialS = null; this.dusk = null; this.revealed = null; this.payRows = null; this.lastRepel = null;
    this.contracts = []; this.events = []; this.grudge = new Map(); this.clues = []; this.feedback = new Map(); this.final = null; this.pendingCoup = null; this.reigns = new Map();
    this.token = 0;
  }
  now() { return this.room.now(); }
  rng() { return this.room.rng(); }
  pickOf(a) { return a[Math.floor(this.rng() * a.length) % a.length]; }
  shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(this.rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  // One phase timer at a time; next() (the host's Skip) runs it straight away.
  setTimer(ms, fn) { this.room.cancel(this.timer); this.endsAt = this.now() + ms; this.timerFn = fn; this.timer = this.room.after(Math.max(0, ms), () => { this.timerFn = null; fn(); }); }
  stopTimer() { this.room.cancel(this.timer); this.timer = null; this.timerFn = null; this.endsAt = 0; }
  // Bot and tick timers: dropped when the phase (or round) moved on.
  later(ms, fn) { const tk = this.token; this.room.after(Math.max(0, ms), () => { if (tk === this.token) fn(); }); }
  go(phase) { this.phase = phase; this.token++; }
  say(k) { const v = HERALD[k]; const text = Array.isArray(v) ? this.pickOf(v) : v; if (text) this.say_ = { text, key: ++this.sayKey, k }; }
  active(p) { return !!p && (p.bot || p.sockets > 0); }
  pub(id) { const p = this.room.get(id); return p ? { id, name: p.name, avatar: p.avatar, color: p.color, bot: !!p.bot } : { id, name: '—', avatar: '👻', color: '#888' }; }
  name(id) { return this.room.name(id); }
  pl(id) { return this.P.get(id); }
  here(id) { return !!this.room.get(id) && this.P.has(id); }
  alive() { return this.ladder.filter((id) => this.here(id)); }
  living(id) { const x = this.pl(id); return !!x && !x.ghost && this.ladder.includes(id); }
  everyone() { return [...this.P.keys()].filter((id) => this.room.get(id)); }
  king() { return this.ladder[0] || null; }
  seat(id) { return this.ladder.indexOf(id); }
  eff(id) { const x = this.pl(id); return (x.ghost ? 0.5 : 1) * (x.haunted ? 0.5 : 1); }
  add(id, n) { const x = this.pl(id); if (!x || !n) return; x.points = Math.max(0, x.points + n); }
  grudgeOf(a, b) { const m = this.grudge.get(a); return (m && m.get(b)) || 0; }
  hate(a, b, n) { if (!a || !b || a === b) return; let m = this.grudge.get(a); if (!m) { m = new Map(); this.grudge.set(a, m); } m.set(b, (m.get(b) || 0) + n); }
  log(e) { this.events.push({ round: this.round, ...e }); }
  newPlayer(id) {
    return { id, ghost: false, secret: null, points: 0, units: 0, defence: 0, haunted: false, killers: new Set(), diedRound: 0, how: null,
      ghoulPick: null, ghoulCands: null, spyTarget: null, spyRound: 0, peek: null, assassinLast: -99, assassinTarget: null, hauntRound: 0,
      msgs: 0, lastMsgAt: -1e9, m: null, honored: 0, broken: 0, kingRounds: 0, climbed: 0 };
  }

  // ---------- setup ----------
  start() {
    const ids = this.room.list().map((p) => p.id);
    for (const id of ids) this.P.set(id, this.newPlayer(id));
    this.ladder = this.shuffle(ids);
    if (this.s.secrets !== 'off') {
      const k = Math.min(secretCount(ids.length), ids.length - 1, SECRET_ORDER.length);
      this.shuffle(ids).slice(0, k).forEach((id, i) => { this.pl(id).secret = SECRET_ORDER[i]; });
    }
    const n = ids.length, f = WAVE[this.s.rounds] || WAVE[5];
    this.waves = f.map((k) => Math.max(10, Math.round(this.s.mission * n * PACE * k / 5) * 5));
    this.target = this.waves.reduce((a, b) => a + b, 0);
    this.nextRound();
  }
  joined(p) {
    if (this.P.has(p.id) || this.phase === 'intro') return;
    this.P.set(p.id, this.newPlayer(p.id));
    if (!['siege', 'unmask', 'over'].includes(this.phase)) this.ladder.push(p.id);
    if (this.phase === 'mission' && this.mis) this.missionJoin(p.id);
  }
  left(p) {
    const x = this.pl(p.id); if (!x) return;
    const wasKing = this.king() === p.id;
    this.ladder = this.ladder.filter((id) => id !== p.id);
    if (this.mis && this.mis.key === 'gate') this.gateGroups();
    if (this.mis && this.mis.key === 'beacons') for (const id of this.everyone()) { const m = this.pl(id).m; if (m && m.ask === p.id) m.ask = this.beaconAsk(id); }
    if (this.coup && (this.coup.caller === p.id) && this.phase === 'coup') return this.endCoup();
    if (this.J && this.phase === 'summon' && wasKing) return this.toPay('mercy');
    if (this.J && this.phase === 'hearing' && (this.J.target === p.id || this.J.king === p.id)) { this.J.gone = true; return this.endHearing(); }
    if (this.alive().length < 2 && !['siege', 'unmask', 'over'].includes(this.phase)) return this.finale();
  }

  // ---------- a round ----------
  nextRound() {
    this.stopTimer();
    if (this.round >= this.s.rounds) return this.finale();
    this.round++;
    this.J = null; this.coup = null; this.trialS = null; this.dusk = null; this.revealed = null; this.payRows = null; this.pendingCoup = null; this.flights = [];
    const key = (ORDER[this.s.rounds] || ORDER[5])[this.round - 1] || 'beacons';
    this.mis = { key, wave: this.waves[this.round - 1], defence: 0 };
    this.go('brief');
    this.say(this.round === 1 ? 'first' : this.round === this.s.rounds ? 'last' : 'round');
    this.room.fx('round', { mission: key });
    this.setTimer(this.round === 1 ? MS.brief1 : MS.brief, () => this.startMission());
  }
  startMission() {
    const M = this.mis; if (!M) return;
    this.go('mission'); this.say(M.key); this.room.fx('mission', { mission: M.key });
    for (const id of this.everyone()) { const x = this.pl(id); x.units = 0; x.m = null; }
    M.peal = null; M.peals = []; M.groups = []; M.botRunes = {};
    for (const id of this.everyone()) this.missionJoin(id, true);
    if (M.key === 'beacons') for (const id of this.everyone()) this.pl(id).m.ask = this.beaconAsk(id);
    if (M.key === 'gate') { this.gateGroups(); this.gateTick(); }
    for (const id of this.everyone()) { const p = this.room.get(id); if (p && p.bot) this.botMission(id); }
    this.setTimer(this.s.mission * 1000, () => this.endMission());
  }
  missionJoin(id, quiet) {
    const M = this.mis, x = this.pl(id); if (!M || !x) return;
    if (M.key === 'wall') { const a = Math.floor(this.rng() * WALL_CELLS); let b = Math.floor(this.rng() * WALL_CELLS); if (b === a) b = (a + 4) % WALL_CELLS; x.m = { cracks: [a, b], last: -1e9, lock: 0 }; }
    else if (M.key === 'beacons') x.m = { rune: Math.floor(this.rng() * RUNES.length), ask: null, lock: 0, lit: 0 };
    else if (M.key === 'bells') x.m = { last: -1e9, rung: 0 };
    else if (M.key === 'gate') x.m = { hold: false, since: 0, slip: 0 };
    if (!quiet) { if (M.key === 'beacons') x.m.ask = this.beaconAsk(id); if (M.key === 'gate') this.gateGroups(); }
  }
  gain(id, n) { const x = this.pl(id); if (!x || this.phase !== 'mission') return 0; const g = n * this.eff(id); x.units += g; x.defence += g; this.mis.defence += g; return g; }
  endMission() {
    const M = this.mis; if (!M || this.phase !== 'mission') return;
    this.stopTimer();
    const defence = Math.round(M.defence), ok = defence >= M.wave;
    this.defTotal += defence;
    this.lastRepel = { round: this.round, wave: M.wave, defence, ok, total: this.defTotal, target: this.target,
      top: this.everyone().map((id) => ({ ...this.pub(id), units: Math.round(this.pl(id).units), ghost: this.pl(id).ghost })).sort((a, b) => b.units - a.units).slice(0, 12) };
    this.history.push({ round: this.round, mission: M.key, wave: M.wave, defence, ok });
    for (const id of this.everyone()) { const x = this.pl(id); x.haunted = false; if (x.m && x.m.hold) x.m.hold = false; }
    this.go('repel'); this.say(ok ? 'repelled' : 'breached'); this.room.fx(ok ? 'repelled' : 'breached');
    this.setTimer(MS.repel, () => this.startCourt());
  }

  // ---------- missions: moves ----------
  beaconAsk(id) {
    const others = this.everyone().filter((o) => o !== id && this.pl(o).m);
    if (!others.length) return null;
    const last = this.pl(id).m && this.pl(id).m.ask;
    const pool = others.length > 1 ? others.filter((o) => o !== last) : others;
    return this.pickOf(pool);
  }
  mend(id, cell) {
    const x = this.pl(id), m = x.m, now = this.now();
    if (now < m.lock || now - m.last < WALL_GAP) return { ok: false, quiet: true };
    m.last = now;
    const i = m.cracks.indexOf(cell);
    if (i < 0) { m.lock = now + WALL_MISS; return { ok: false, error: 'That stone was fine!', miss: true }; }
    this.gain(id, 1);
    let c; do c = Math.floor(this.rng() * WALL_CELLS); while (m.cracks.includes(c));
    m.cracks[i] = c;
    return { ok: true };
  }
  beacon(id, rune) {
    const x = this.pl(id), m = x.m, now = this.now();
    if (now < m.lock) return { ok: false, error: 'Smoke in your eyes! Wait a moment.' };
    const t = m.ask && this.pl(m.ask); if (!t || !t.m || !this.room.get(m.ask)) { m.ask = this.beaconAsk(id); return { ok: false, error: 'Ask someone else.' }; }
    if (t.m.rune !== rune) { m.lock = now + BEACON_LOCK; this.room.fx('smoke', { id }); return { ok: false, error: 'Wrong rune! The beacon smokes.', miss: true }; }
    this.gain(id, 4); this.gain(m.ask, 2); m.lit++;
    let r; do r = Math.floor(this.rng() * RUNES.length); while (r === t.m.rune);
    t.m.rune = r; m.ask = this.beaconAsk(id);
    this.room.fx('beacon', { id });
    return { ok: true };
  }
  ring(id) {
    const x = this.pl(id), m = x.m, now = this.now(), M = this.mis;
    if (now - m.last < BELL_COOLDOWN) return { ok: false, quiet: true };
    m.last = now; m.rung++;
    if (M.peal && now - M.peal.at <= PEAL_MS) M.peal.ringers.add(id);
    else {
      const peal = { at: now, ringers: new Set([id]) }; M.peal = peal;
      this.later(PEAL_MS + 50, () => this.closePeal(peal));
      for (const o of this.everyone()) { const p = this.room.get(o); if (p && p.bot && o !== id && this.botWorks(o) && this.rng() < 0.7) this.later(120 + this.rng() * 480, () => { if (M.peal === peal && this.phase === 'mission') this.ring(o); }); }
    }
    return { ok: true };
  }
  closePeal(peal) {
    const M = this.mis; if (!M || this.phase !== 'mission') return;
    const k = peal.ringers.size, each = 0.6 * Math.min(k, 6);
    for (const id of peal.ringers) this.gain(id, each);
    M.peals.push({ k, at: this.now() }); if (M.peals.length > 8) M.peals.shift();
    if (M.peal === peal) M.peal = null;
    this.room.fx('peal', { k });
  }
  gateGroups() {
    const M = this.mis; if (!M) return;
    const ids = this.shuffle(this.everyone().filter((id) => this.pl(id).m));
    const g = []; for (let i = 0; i < ids.length; i += 2) g.push(ids.slice(i, i + 2));
    if (g.length > 1 && g[g.length - 1].length === 1) g[g.length - 2].push(g.pop()[0]);
    M.groups = g; M.shuffledAt = this.now();
    for (const id of ids) { const m = this.pl(id).m; m.hold = false; }
  }
  gateTick() {
    const M = this.mis; if (!M || this.phase !== 'mission' || M.key !== 'gate') return;
    const now = this.now();
    if (now - M.shuffledAt >= GATE_SHUFFLE) { this.gateGroups(); this.room.fx('regroup'); }
    M.turning = [];
    for (const g of M.groups) {
      const ms = g.map((id) => this.pl(id)).filter((x) => x && x.m);
      for (const x of ms) if (x.m.hold && now - x.m.since >= GATE_SLIP) { x.m.hold = false; x.m.slip = now + GATE_REGRIP; }
      const turning = ms.length > 0 && ms.every((x) => x.m.hold);
      if (turning) for (const x of ms) this.gain(x.id, 0.5);
      M.turning.push(turning);
    }
    // bots grab when a partner holds (or start it now and then)
    for (const g of M.groups) for (const id of g) {
      const p = this.room.get(id), x = this.pl(id); if (!p || !p.bot || !x || !x.m || x.m.hold || now < x.m.slip || !this.botWorks(id)) continue;
      const mate = g.some((o) => o !== id && this.pl(o) && this.pl(o).m && this.pl(o).m.hold);
      if (this.rng() < (mate ? 0.8 : 0.35)) { x.m.hold = true; x.m.since = now; }
    }
    this.later(GATE_TICK, () => this.gateTick());
  }
  grip(id, on) {
    const m = this.pl(id).m, now = this.now();
    if (on) { if (m.hold) return { ok: true, quiet: true }; if (now < m.slip) return { ok: false, quiet: true }; m.hold = true; m.since = now; }
    else { if (!m.hold) return { ok: true, quiet: true }; m.hold = false; }
    return { ok: true };
  }
  // A Turncloak bot only pulls half its weight.
  botWorks(id) { const x = this.pl(id); return !(x && x.secret === 'turncloak' && this.rng() < 0.5); }
  botMission(id) {
    const M = this.mis, key = M.key;
    const loop = (lo, hi, fn) => { const step = () => { if (this.phase !== 'mission' || !this.here(id)) return; if (this.botWorks(id)) fn(); this.later(lo + this.rng() * (hi - lo), step); }; this.later(400 + this.rng() * 1200, step); };
    if (key === 'wall') loop(900, 1500, () => { const m = this.pl(id).m; if (m) this.mend(id, this.rng() < 0.94 ? m.cracks[0] : (m.cracks[0] + 1) % WALL_CELLS); });
    else if (key === 'beacons') loop(4000, 7000, () => { const m = this.pl(id).m; if (!m || !m.ask) return; const t = this.pl(m.ask); if (!t || !t.m) return; this.beacon(id, this.rng() < 0.85 ? t.m.rune : (t.m.rune + 1) % RUNES.length); });
    else if (key === 'bells') loop(2500, 5000, () => { if (!this.mis.peal) this.ring(id); });
  }

  // ---------- court ----------
  startCourt() {
    this.go('court'); this.say('court'); this.room.fx('court');
    for (const id of this.everyone()) { const x = this.pl(id); x.assassinTarget = null; }
    const ms = this.s.court * 1000;
    this.setTimer(ms, () => this.endCourt());
    for (const id of this.everyone()) { const p = this.room.get(id); if (p && p.bot) this.botCourt(id, ms); }
    this.ghoulBots();
  }
  botCourt(id, ms) {
    const x = this.pl(id), others = () => this.everyone().filter((o) => o !== id);
    const n = 1 + Math.floor(this.rng() * 2);
    for (let i = 0; i < n; i++) this.later(ms * (0.1 + this.rng() * 0.75), () => { const o = others(); if (o.length && this.phase === 'court') this.sendMsg(id, [this.pickOf(o)], this.pickOf(PRESETS)); });
    if (x.ghost) {
      this.later(ms * (0.2 + this.rng() * 0.5), () => { const c = this.hauntCands(id); if (c.length && this.rng() < 0.7) this.haunt(id, this.pickOf(c)); });
      return;
    }
    if (x.secret === 'assassin' && this.assassinReady(id) && this.rng() < 0.6) this.later(ms * (0.2 + this.rng() * 0.6), () => {
      const above = this.alive().filter((o) => o !== id && this.seat(o) < this.seat(id));
      const pool = this.rng() < 0.4 && this.king() !== id ? [this.king()] : above.length ? above : this.alive().filter((o) => o !== id);
      if (pool.length && this.phase === 'court') this.mark(id, this.pickOf(pool));
    });
    if (x.secret === 'spy') this.later(ms * (0.05 + this.rng() * 0.3), () => { const o = others(); if (o.length) this.spyOn(id, this.pickOf(o)); });
    if (x.secret === 'seer' && !x.peek && this.round >= 2) this.later(ms * 0.3, () => { const o = others(); if (o.length) this.peekAt(id, this.pickOf(o)); });
    // Now and then a bot below the throne reaches for it.
    if (this.round >= 2 && this.king() !== id && this.alive().length >= 3 && this.rng() < 0.12) this.later(ms * (0.35 + this.rng() * 0.5), () => { if (this.phase === 'court' && !this.pendingCoup && this.living(id) && this.king() !== id) this.callCoup(id); });
  }
  ghoulBots() { for (const id of this.everyone()) { const x = this.pl(id), p = this.room.get(id); if (p && p.bot && x.ghoulCands && !x.ghoulPick) this.later(1500 + this.rng() * 3000, () => { const c = (this.pl(id) || {}).ghoulCands; if (c && c.length && !this.pl(id).ghoulPick) this.ghoulChoose(id, this.pickOf(c)); }); } }
  canMessage() { return ['repel', 'court', 'dusk', 'coup', 'coupResult', 'trial', 'trialResult', 'summon', 'hearing', 'verdict', 'pay'].includes(this.phase); }
  sendMsg(from, to, text) {
    const x = this.pl(from); if (!x) return null;
    const m = { id: ++this.msgSeq, from, to: [...new Set(to)], text, round: this.round, at: this.now() };
    this.msgs.push(m); if (this.msgs.length > 2000) this.msgs.shift();
    x.msgs++; x.lastMsgAt = this.now();
    this.flights.push({ id: m.id, from, to: m.to.slice() }); if (this.flights.length > 12) this.flights.shift();
    this.room.fx('msg', { id: from });
    return m;
  }
  assassinReady(id) { const x = this.pl(id); return !!x && x.secret === 'assassin' && this.living(id) && this.round - x.assassinLast >= ASSASSIN_EVERY; }
  mark(id, target) { const x = this.pl(id); x.assassinTarget = target; return { ok: true }; }
  spyOn(id, target) { const x = this.pl(id); x.spyTarget = target; x.spyRound = this.round; return { ok: true }; }
  peekAt(id, target) { const x = this.pl(id), t = this.pl(target); x.peek = { id: target, secret: t.secret || 'loyal', round: this.round }; return { ok: true }; }
  hauntCands(id) { const x = this.pl(id); return x && x.ghost ? [...x.killers].filter((k) => this.here(k) && !this.pl(k).ghost) : []; }
  haunt(id, target) {
    const x = this.pl(id), t = this.pl(target);
    x.hauntRound = this.round; t.haunted = true;
    const n = Math.min(PTS.haunt, t.points); t.points -= n; x.points += n;
    this.log({ kind: 'haunt', by: id, on: target, n });
    this.room.fx('haunt', { id: target });
    return { ok: true };
  }
  ghoulChoose(id, target) { const x = this.pl(id); x.ghoulPick = target; x.ghoulCands = null; this.log({ kind: 'ghoul', by: id, on: target }); this.room.fx('ghoul'); return { ok: true }; }
  callCoup(id) {
    this.pendingCoup = id; this.log({ kind: 'coupCall', by: id, on: this.king() });
    this.room.fx('coupCall', { id });
    this.endCourt();
    return { ok: true };
  }
  endCourt() {
    if (this.phase !== 'court') return;
    this.stopTimer();
    // The Assassin's mark resolves at dusk.
    const a = this.everyone().find((id) => { const x = this.pl(id); return x.secret === 'assassin' && x.assassinTarget && this.assassinReady(id); });
    if (a) {
      const x = this.pl(a), t = x.assassinTarget; x.assassinTarget = null; x.assassinLast = this.round;
      if (this.living(t)) {
        const hit = this.rng() < ASSASSIN_ODDS;
        this.dusk = { target: t, hit, clue: null };
        if (hit) { this.kill(t, [a], 'assassin'); this.add(a, PTS.assassin); this.log({ kind: 'assassinated', by: a, on: t }); this.say('dead'); this.room.fx('assassinated', { id: t }); }
        else { this.dusk.clue = this.clueFor(a, t); this.clues.push(this.dusk.clue); this.log({ kind: 'assassinMiss', by: a, on: t }); this.say('missed'); this.room.fx('foiled', { id: t }); }
        this.go('dusk');
        return this.setTimer(MS.dusk, () => this.afterDusk());
      }
    }
    this.afterDusk();
  }
  // A clue about the Assassin after a failed attempt (each new one is different).
  clueFor(a, t) {
    const n = this.alive().length, s = this.seat(a), st = this.seat(t), nm = this.name(a);
    const opts = [];
    if (s >= 0) opts.push(`The Assassin sits among the ${TIERS[tierOf(s, n)].name}.`);
    if (s >= 0 && st >= 0) opts.push(`The Assassin sits ${s < st ? 'ABOVE' : 'BELOW'} their target on the ladder.`);
    opts.push(`The Assassin’s name has ${[...nm].length} letters.`);
    opts.push(`The Assassin’s name starts with “${[...nm][0].toUpperCase()}”.`);
    if (s >= 0) opts.push(`The Assassin is ${s % 2 === 0 ? 'an odd' : 'an even'}-numbered seat on the ladder.`);
    const fresh = opts.filter((o) => !this.clues.includes(o));
    return this.pickOf(fresh.length ? fresh : opts);
  }
  // A player dies: a ghost from now on (off the ladder). The Ghoul picks a killer to drain.
  kill(id, killers, how) {
    const x = this.pl(id); if (!x || x.ghost) return;
    const wasKing = this.king() === id;
    x.ghost = true; x.diedRound = this.round; x.how = how; x.spyTarget = null; x.assassinTarget = null;
    for (const k of killers) if (k !== id && this.P.has(k)) x.killers.add(k);
    this.ladder = this.ladder.filter((o) => o !== id);
    if (x.secret === 'ghoul') {
      const c = [...x.killers].filter((k) => this.here(k) && !this.pl(k).ghost);
      x.ghoulCands = c.length ? c : this.alive();
      if (!x.ghoulCands.length) x.ghoulCands = null; else this.ghoulBots();
    }
    if (wasKing && this.king()) this.room.fx('crowned', { id: this.king() });
    this.room.fx('ghost', { id });
  }
  afterDusk() {
    const c = this.pendingCoup;
    this.pendingCoup = null;
    if (c && this.living(c) && this.king() && this.king() !== c && this.alive().length >= 3) return this.startCoup(c);
    this.startSummon();
  }

  // ---------- coup ----------
  startCoup(caller) {
    const king = this.king(), voters = this.alive();
    this.coup = { caller, king, need: Math.ceil(voters.length * 0.6 - 1e-9), votes: new Map([[caller, true], [king, false]]), voters, result: null };
    this.hate(king, caller, 4);
    this.go('coup'); this.say('coup'); this.room.fx('coup', { id: caller });
    this.setTimer(MS.coup, () => this.endCoup());
    for (const id of voters) { const p = this.room.get(id); if (p && p.bot && id !== caller && id !== king) this.later(2000 + this.rng() * 12000, () => { if (this.phase === 'coup') this.coupVote(id, this.botCoupYes(id)); }); }
  }
  botCoupYes(id) { const C = this.coup, n = this.alive().length, s = this.seat(id); return this.grudgeOf(id, C.king) - this.grudgeOf(id, C.caller) + (s / Math.max(1, n - 1)) * 1.2 + (this.rng() - 0.5) * 2.2 > 0.35; }
  coupVote(id, yes) { const C = this.coup; C.votes.set(id, !!yes); this.room.fx('voted', { id }); if (C.voters.filter((v) => this.here(v)).every((v) => C.votes.has(v))) this.setTimer(900, () => this.endCoup()); return { ok: true }; }
  endCoup() {
    const C = this.coup; if (!C || this.phase !== 'coup') return;
    this.stopTimer();
    const yes = C.voters.filter((v) => C.votes.get(v) === true), no = C.voters.filter((v) => C.votes.get(v) !== true);
    const callerHere = this.living(C.caller), passed = callerHere && this.living(C.king) && yes.length >= C.need;
    C.result = { passed, yes, no };
    for (const v of no) this.hate(C.caller, v, 1);
    for (const v of yes) this.hate(C.king, v, 2);
    if (passed) {
      const from = this.seat(C.caller);
      this.ladder = [C.caller, ...this.ladder.filter((id) => id !== C.caller && id !== C.king)];
      this.pl(C.caller).climbed += from;
      this.log({ kind: 'coup', by: C.caller, on: C.king, passed: true });
      this.say('coupWin'); this.room.fx('crowned', { id: C.caller });
    } else {
      if (callerHere) { this.ladder = [...this.ladder.filter((id) => id !== C.caller), C.caller]; }
      this.log({ kind: 'coup', by: C.caller, on: C.king, passed: false });
      this.say('coupFail'); this.room.fx('coupFail', { id: C.caller });
    }
    this.go('coupResult');
    this.setTimer(MS.coupResult, () => (passed && this.here(C.king) ? this.startTrial() : this.startSummon()));
  }
  startTrial() {
    const C = this.coup, voters = this.alive();
    this.trialS = { old: C.king, votes: new Map(), voters, result: null };
    this.go('trial'); this.say('trial'); this.room.fx('trial', { id: C.king });
    this.setTimer(MS.trial, () => this.endTrial());
    for (const id of voters) { const p = this.room.get(id); if (p && p.bot) this.later(2000 + this.rng() * 10000, () => { if (this.phase === 'trial') this.trialVote(id, this.grudgeOf(id, C.king) + (this.rng() - 0.6) * 3 > 0.5); }); }
  }
  trialVote(id, kill) { const T = this.trialS; T.votes.set(id, !!kill); this.room.fx('voted', { id }); if (T.voters.filter((v) => this.here(v)).every((v) => T.votes.has(v))) this.setTimer(900, () => this.endTrial()); return { ok: true }; }
  endTrial() {
    const T = this.trialS; if (!T || this.phase !== 'trial') return;
    this.stopTimer();
    const kill = T.voters.filter((v) => T.votes.get(v) === true), spare = T.voters.filter((v) => T.votes.get(v) === false);
    const killed = kill.length > spare.length && this.here(T.old);
    T.result = { killed, kill, spare };
    if (killed) { this.kill(T.old, kill, 'coup'); this.log({ kind: 'executed', on: T.old, by: kill }); this.say('executed'); for (const v of kill) this.hate(T.old, v, 4); }
    else if (this.here(T.old)) { this.ladder.push(T.old); this.say('spared'); }
    this.room.fx(killed ? 'executed' : 'spared', { id: T.old });
    this.go('trialResult');
    this.setTimer(MS.trialResult, () => this.startSummon());
  }

  // ---------- judgement ----------
  startSummon() {
    const king = this.king();
    if (!king || this.alive().length < 2) return this.toPay();
    this.J = { king, target: null, sentence: null, votes: new Map(), offers: [], result: null, offerSeq: 0 };
    this.go('summon'); this.say('summon'); this.room.fx('summon');
    this.setTimer(MS.summon, () => this.toPay('mercy'));
    const p = this.room.get(king);
    if (p && p.bot) this.later(3000 + this.rng() * 6000, () => this.botSummon());
  }
  botSummon() {
    const J = this.J; if (!J || this.phase !== 'summon') return;
    const pool = this.alive().filter((id) => id !== J.king);
    if (!pool.length || this.rng() < 0.12) return this.toPay('mercy');
    const ranked = pool.map((id) => ({ id, s: this.grudgeOf(J.king, id) * 1.5 + (1 - this.seat(id) / this.ladder.length) + this.rng() * 1.5 })).sort((a, b) => b.s - a.s);
    const t = ranked[0].id, r = this.rng();
    const bottom = this.seat(t) === this.ladder.length - 1;
    const sentence = this.grudgeOf(J.king, t) >= 4 && r < 0.5 ? 'kill' : r < 0.2 ? 'kill' : r < 0.45 || bottom ? 'reveal' : 'demote';
    this.summon(J.king, t, sentence);
  }
  summon(king, target, sentence) {
    const J = this.J;
    J.target = target; J.sentence = sentence; J.votes = new Map([[king, 'aye'], [target, 'nay']]);
    this.hate(target, king, 3);
    this.go('hearing'); this.say('hearing'); this.room.fx('gavel', { id: target, sentence });
    this.setTimer(MS.hearing, () => this.endHearing());
    if (this.room.audienceCount && this.room.audienceCount() > 0) {
      const res = this.room.openPoll({ kind: 'king', q: `The gallery’s verdict: ${sentence === 'kill' ? 'kill' : sentence === 'demote' ? 'demote' : 'reveal the messages of'} ${this.name(target)}?`, options: [{ id: 'aye', label: '👍 Aye' }, { id: 'nay', label: '👎 Nay' }], ms: MS.hearing - 3000, onClose: (r) => { if (this.J === J && r.winner) J.gallery = r.winner.id; } });
      if (res && res.ok) J.galleryPoll = res.id;
    }
    // bots: the King and the accused make offers; voters vote (and sometimes take deals)
    const kp = this.room.get(king), tp = this.room.get(target);
    const voters = this.voters();
    if (kp && kp.bot) this.later(2500 + this.rng() * 4000, () => { for (const v of this.shuffle(voters).slice(0, 2)) if (this.canOffer(king, v)) this.offer(king, v, 0); });
    if (tp && tp.bot) this.later(2500 + this.rng() * 4000, () => { for (const v of this.shuffle(voters).slice(0, 2)) if (this.canOffer(target, v)) this.offer(target, v, this.pickOf(GOLD_OFFERS)); });
    for (const v of voters) { const p = this.room.get(v); if (p && p.bot) this.later(9000 + this.rng() * 20000, () => this.botVote(v)); }
  }
  voters() { const J = this.J; return J ? this.alive().filter((id) => id !== J.king && id !== J.target) : []; }
  botVote(id) {
    const J = this.J; if (!J || this.phase !== 'hearing' || J.votes.has(id) && !this.acceptedBy(id)) return;
    const acc = this.acceptedBy(id);
    let side;
    if (acc) side = this.rng() < 0.85 ? acc.side : acc.side === 'aye' ? 'nay' : 'aye';
    else side = this.grudgeOf(id, J.target) - this.grudgeOf(id, J.king) + (this.rng() - 0.45) * 2.4 > 0 ? 'aye' : 'nay';
    this.vote(id, side);
  }
  acceptedBy(id) { const J = this.J; return J ? J.offers.find((o) => o.to === id && o.accepted) || null : null; }
  canOffer(from, to) {
    const J = this.J; if (!J || this.phase !== 'hearing' || from === to) return false;
    if (from !== J.king && from !== J.target) return false;
    if (!this.voters().includes(to)) return false;
    if (J.offers.some((o) => o.from === from && o.to === to)) return false;
    if (from === J.king && this.seat(to) <= 1) return false; // the Knight can't rise any higher (the throne is not for sale)
    return true;
  }
  offer(from, to, amount) {
    const J = this.J, kind = from === J.king ? 'rank' : 'gold';
    const o = { id: ++J.offerSeq, from, to, kind, side: kind === 'rank' ? 'aye' : 'nay', amount: kind === 'gold' ? amount : 0, accepted: false, status: null };
    J.offers.push(o); this.room.fx('offer', { id: to });
    const p = this.room.get(to);
    if (p && p.bot) this.later(1500 + this.rng() * 3500, () => { if (this.J === J && this.phase === 'hearing' && !this.acceptedBy(to) && this.rng() < 0.6) this.accept(to, o.id); });
    return { ok: true, offer: o.id };
  }
  accept(id, offerId) {
    const J = this.J, o = J.offers.find((x) => x.id === offerId);
    o.accepted = true; J.votes.set(id, o.side);
    this.room.fx('deal', { id });
    return { ok: true };
  }
  vote(id, side) { const J = this.J; J.votes.set(id, side); this.room.fx('voted', { id }); this.checkVotes(); return { ok: true }; }
  checkVotes() { const J = this.J; if (this.phase !== 'hearing') return; const v = this.voters().filter((id) => this.active(this.room.get(id))); if (v.every((id) => J.votes.has(id))) this.setTimer(1500, () => this.endHearing()); }
  endHearing() {
    const J = this.J; if (!J || this.phase !== 'hearing') return;
    this.stopTimer();
    if (J.galleryPoll != null && this.room.poll && this.room.poll.id === J.galleryPoll) this.room.closePoll(J.galleryPoll);
    const voted = [...J.votes].filter(([id]) => this.here(id) && (this.living(id)));
    const aye = voted.filter(([, s]) => s === 'aye').map(([id]) => id), nay = voted.filter(([, s]) => s === 'nay').map(([id]) => id);
    const a = aye.length + (J.gallery === 'aye' ? 1 : 0), n = nay.length + (J.gallery === 'nay' ? 1 : 0);
    const passed = !J.gone && this.here(J.target) && this.living(J.target) && a >= n;
    J.result = { passed, aye, nay, tie: a === n, gallery: J.gallery || null, deals: [] };
    // The sentence first, then the deals (on the new ladder).
    if (passed) {
      if (J.sentence === 'kill') { this.kill(J.target, aye, 'judgement'); this.log({ kind: 'sentenced', on: J.target, by: aye, sentence: 'kill' }); }
      else if (J.sentence === 'demote') { this.ladder = [...this.ladder.filter((id) => id !== J.target), J.target]; this.log({ kind: 'sentenced', on: J.target, by: aye, sentence: 'demote' }); }
      else if (J.sentence === 'reveal') {
        const msgs = this.msgs.filter((m) => m.from === J.target && m.round >= this.round - 1).slice(-8);
        this.revealed = { id: J.target, msgs: msgs.map((m) => ({ to: m.to.map((t) => this.name(t)), text: m.text, round: m.round })) };
        this.log({ kind: 'sentenced', on: J.target, by: aye, sentence: 'reveal' });
      }
      for (const v of aye) this.hate(J.target, v, 2);
    } else if (this.here(J.target)) { this.add(J.target, PTS.acquit); for (const v of nay) this.hate(J.king, v, 1); }
    for (const o of J.offers) {
      if (!this.here(o.to)) { o.status = 'void'; continue; }
      const v = J.votes.get(o.to);
      if (v === o.side) {
        o.status = 'kept'; this.pl(o.to).honored++;
        if (o.kind === 'rank') { const i = this.seat(o.to); if (i >= 2) { [this.ladder[i - 1], this.ladder[i]] = [this.ladder[i], this.ladder[i - 1]]; this.pl(o.to).climbed++; } else o.status = 'kept-moot'; }
        else { const pay = Math.min(o.amount, this.pl(o.from).points); this.pl(o.from).points -= pay; this.add(o.to, pay); o.paid = pay; }
      } else if (o.accepted) {
        o.status = 'broken'; this.pl(o.to).broken++;
        const fine = Math.min(PTS.oath, this.pl(o.to).points); this.pl(o.to).points -= fine; this.add(o.from, fine); o.fine = fine;
        this.hate(o.from, o.to, 3);
      } else o.status = 'void';
      if (o.status !== 'void') { const c = { round: this.round, from: o.from, to: o.to, kind: o.kind, side: o.side, amount: o.amount, status: o.status }; this.contracts.push(c); J.result.deals.push(c); }
    }
    this.go('verdict'); this.say(passed ? 'passed' : 'failed');
    this.room.fx(passed ? 'passed' : 'acquitted', { id: J.target, sentence: J.sentence });
    this.setTimer(MS.verdict, () => this.toPay());
  }

  // ---------- pay ----------
  toPay(why) {
    if (why === 'mercy') { this.stopTimer(); this.say('mercy'); this.J = this.J ? { ...this.J, mercy: true } : { mercy: true }; this.go('verdict'); this.room.fx('mercy'); return this.setTimer(MS.verdictSkip, () => this.toPay()); }
    this.stopTimer();
    const n = this.ladder.length, rows = new Map();
    for (const id of this.everyone()) {
      const x = this.pl(id), s = this.seat(id), t = s >= 0 ? tierOf(s, n) : null;
      const pay = t == null ? 0 : TIERS[t].pay, bonus = Math.min(PTS.bonusCap, Math.round(x.units / PTS.bonusDiv));
      rows.set(id, { id, seat: s, tier: t, pay, bonus, drained: 0, fed: 0 });
      if (s === 0) { x.kingRounds++; this.reigns.set(id, (this.reigns.get(id) || 0) + 1); }
    }
    // The Ghoul drains half of its victim's pay this round.
    for (const id of this.everyone()) {
      const x = this.pl(id); if (!x.ghost || !x.ghoulPick || !rows.has(x.ghoulPick)) continue;
      const r = rows.get(x.ghoulPick), d = Math.floor((r.pay + r.bonus - r.drained) / 2);
      if (d > 0) { r.drained += d; rows.get(id).fed += d; }
    }
    for (const r of rows.values()) { r.total = r.pay + r.bonus - r.drained + r.fed; this.add(r.id, r.total); }
    this.payRows = [...rows.values()].map((r) => ({ ...this.pub(r.id), ...r }));
    this.go('pay'); this.say('pay'); this.room.fx('pay');
    this.setTimer(MS.pay, () => this.nextRound());
  }

  // ---------- the end ----------
  finale() {
    this.stopTimer();
    this.mis = null;
    const survived = this.defTotal >= this.target;
    const before = new Map(this.everyone().map((id) => [id, this.pl(id).points]));
    if (!survived) for (const id of this.everyone()) { const x = this.pl(id); if (x.secret === 'turncloak') x.points += PTS.turncloak; else x.points = Math.floor(x.points * PTS.fallKeep); }
    this.siege = { survived, total: this.defTotal, target: this.target, cut: survived ? [] : this.everyone().map((id) => ({ id, from: before.get(id), to: this.pl(id).points })) };
    this.go('siege'); this.say(survived ? 'survive' : 'fall'); this.room.fx(survived ? 'survive' : 'fall');
    this.setTimer(MS.siege, () => { this.go('unmask'); this.say('unmask'); this.room.fx('unmask'); this.setTimer(MS.unmask, () => this.end()); });
  }
  end() {
    this.stopTimer(); this.go('over');
    this.final = { standings: this.standings(), awards: this.awards(), rivalries: this.rivalries(), survived: this.siege ? this.siege.survived : this.defTotal >= this.target };
    this.say('over'); this.room.fx('win');
  }
  rivalries() {
    const R = [], N = (id) => this.name(id);
    for (const c of this.contracts.filter((c) => c.status === 'broken').slice(0, 3)) R.push({ icon: '💔', text: `${N(c.to)} broke an oath to ${N(c.from)} in round ${c.round}.` });
    for (const id of this.everyone()) { const x = this.pl(id); if (x.ghost && x.killers.size && x.how !== 'assassin') R.push({ icon: '🩸', text: `${N(id)}’s blood is on the hands of ${[...x.killers].map(N).slice(0, 4).join(', ')}.` }); }
    for (const e of this.events.filter((e) => e.kind === 'assassinated')) R.push({ icon: '🗡️', text: `${N(e.by)}, the Assassin, struck down ${N(e.on)} in round ${e.round}.` });
    for (const e of this.events.filter((e) => e.kind === 'coup')) R.push({ icon: e.passed ? '⚔️' : '🪤', text: e.passed ? `${N(e.by)} overthrew ${N(e.on)} in round ${e.round}.` : `${N(e.by)} tried to overthrow ${N(e.on)} in round ${e.round}, and failed.` });
    for (const id of this.everyone()) { const x = this.pl(id); if (x.ghoulPick) R.push({ icon: '💀', text: `The Ghoul ${N(id)} fed on ${N(x.ghoulPick)} until the end.` }); }
    const pairs = new Map();
    for (const m of this.msgs) for (const t of m.to) { const k = [m.from, t].sort().join('|'); pairs.set(k, (pairs.get(k) || 0) + 1); }
    const top = [...pairs].filter(([k]) => k.split('|').every((id) => this.room.get(id))).sort((a, b) => b[1] - a[1])[0];
    if (top && top[1] >= 3) { const [a, b] = top[0].split('|'); R.push({ icon: '💌', text: `Thickest as thieves: ${N(a)} and ${N(b)} (${top[1]} secret messages).` }); }
    return R.slice(0, 8);
  }
  awards() {
    const ids = this.everyone(), A = [];
    const best = (f) => { let w = null; for (const id of ids) { const v = f(this.pl(id), id); if (v > 0 && (!w || v > w.v)) w = { id, v }; } return w; };
    const add = (key, icon, title, w, txt) => { if (w) A.push({ key, icon, title, ...this.pub(w.id), text: txt(w.v) }); };
    add('reign', '👑', 'Longest Reign', best((x) => x.kingRounds), (v) => `${v} round${v === 1 ? '' : 's'} on the throne`);
    add('defender', '🛡️', 'Wall Warden', best((x) => Math.round(x.defence)), (v) => `${v} defence`);
    add('dealer', '🤝', 'Kingmaker', best((x) => x.honored), (v) => `${v} deal${v === 1 ? '' : 's'} honoured`);
    add('climber', '🪜', 'Social Climber', best((x) => x.climbed), (v) => `climbed ${v} seat${v === 1 ? '' : 's'}`);
    add('whisper', '💌', 'Chief Whisperer', best((x) => x.msgs), (v) => `${v} secret message${v === 1 ? '' : 's'}`);
    return A.slice(0, 5);
  }
  standings() {
    return this.everyone().map((id) => { const x = this.pl(id); return { ...this.pub(id), points: x.points, ghost: x.ghost, seat: this.seat(id) }; })
      .sort((a, b) => b.points - a.points || (a.seat < 0 ? 99 : a.seat) - (b.seat < 0 ? 99 : b.seat) || a.name.localeCompare(b.name));
  }
  results() { return this.phase === 'over' ? this.standings().map((r) => r.id) : []; }
  challengeEvents(id) { const x = this.pl(id); return x ? { king: x.kingRounds } : {}; }
  highlights() { return this.rivalries().slice(0, 3); }
  next() { if (this.phase === 'over') return; if (this.timerFn) { const f = this.timerFn; this.stopTimer(); f(); } }

  // ---------- moves ----------
  act(p, m) {
    m = m || {};
    const x = this.pl(p.id);
    if (m.op === 'feedback') return this.giveFeedback(p, m);
    if (!x) return { ok: false, error: 'You joined after the game started. Watch this one!' };
    const str = (v) => (typeof v === 'string' ? v : '');
    const target = str(m.target), T = target && this.P.has(target) && this.room.get(target) ? this.pl(target) : null;
    switch (m.op) {
      // missions
      case 'mend': {
        if (this.phase !== 'mission' || !this.mis || this.mis.key !== 'wall' || !x.m) return { ok: false, error: 'Not now.' };
        const c = Number(m.cell); if (!Number.isInteger(c) || c < 0 || c >= WALL_CELLS) return { ok: false, error: 'Tap a stone.' };
        return this.mend(p.id, c);
      }
      case 'rune': {
        if (this.phase !== 'mission' || !this.mis || this.mis.key !== 'beacons' || !x.m) return { ok: false, error: 'Not now.' };
        const r = Number(m.rune); if (!Number.isInteger(r) || r < 0 || r >= RUNES.length) return { ok: false, error: 'Tap a rune.' };
        return this.beacon(p.id, r);
      }
      case 'ring': {
        if (this.phase !== 'mission' || !this.mis || this.mis.key !== 'bells' || !x.m) return { ok: false, error: 'Not now.' };
        return this.ring(p.id);
      }
      case 'grip': {
        if (this.phase !== 'mission' || !this.mis || this.mis.key !== 'gate' || !x.m) return { ok: false, quiet: true };
        if (typeof m.on !== 'boolean') return { ok: false, error: 'Hold or let go.' };
        return this.grip(p.id, m.on);
      }
      // court
      case 'msg': {
        if (!this.canMessage()) return { ok: false, error: this.phase === 'mission' ? 'No time for gossip: defend the walls!' : 'The court is closed.' };
        if (!Array.isArray(m.to) || !m.to.length || m.to.length > MAX_TO) return { ok: false, error: `Pick 1 to ${MAX_TO} people.` };
        const to = [...new Set(m.to.map(String))];
        if (to.some((id) => id === p.id || !this.P.has(id) || !this.room.get(id))) return { ok: false, error: 'Pick people in this game.' };
        if (typeof m.text !== 'string') return { ok: false, error: 'Write a message.' };
        let text = m.text.replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim();
        if (!text) return { ok: false, error: 'Write a message.' };
        if ([...text].length > MAX_MSG) return { ok: false, error: `Keep it under ${MAX_MSG} characters.` };
        if (x.msgs >= MSG_CAP) return { ok: false, error: 'Your quill has run dry.' };
        if (this.now() - x.lastMsgAt < MSG_GAP) return { ok: false, error: 'Not so fast!' };
        text = TEXT.filter(text, { strict: !!(this.room.filterOn) });
        this.sendMsg(p.id, to, text); return { ok: true };
      }
      case 'coup': {
        if (this.phase !== 'court') return { ok: false, error: 'A coup can only start in court.' };
        if (!this.living(p.id)) return { ok: false, error: 'Ghosts can’t take the throne.' };
        if (this.king() === p.id) return { ok: false, error: 'You are already the King!' };
        if (this.alive().length < 3) return { ok: false, error: 'Too few people for a coup.' };
        if (this.pendingCoup) return { ok: false, error: 'A coup is already called.' };
        return this.callCoup(p.id);
      }
      case 'mark': {
        if (x.secret !== 'assassin') return { ok: false, error: 'Not your job.' };
        if (this.phase !== 'court') return { ok: false, error: 'Mark someone during court.' };
        if (!this.assassinReady(p.id)) return { ok: false, error: x.ghost ? 'Ghosts can’t hold a dagger.' : 'Your dagger is resting this round.' };
        if (m.target === null) { x.assassinTarget = null; return { ok: true }; }
        if (!T || target === p.id || !this.living(target)) return { ok: false, error: 'Pick a living player.' };
        return this.mark(p.id, target);
      }
      case 'spy': {
        if (x.secret !== 'spy') return { ok: false, error: 'Not your job.' };
        if (x.ghost) return { ok: false, error: 'Ghosts can’t spy.' };
        if (['siege', 'unmask', 'over'].includes(this.phase)) return { ok: false, error: 'Not now.' };
        if (x.spyRound === this.round && x.spyTarget) return { ok: false, error: 'You already chose this round.' };
        if (!T || target === p.id) return { ok: false, error: 'Pick another player.' };
        return this.spyOn(p.id, target);
      }
      case 'peek': {
        if (x.secret !== 'seer') return { ok: false, error: 'Not your job.' };
        if (x.ghost) return { ok: false, error: 'Ghosts can’t read fortunes.' };
        if (x.peek) return { ok: false, error: 'You already used your crystal ball.' };
        if (this.phase === 'mission' || ['siege', 'unmask', 'over'].includes(this.phase)) return { ok: false, error: 'Not now.' };
        if (!T || target === p.id) return { ok: false, error: 'Pick another player.' };
        return this.peekAt(p.id, target);
      }
      case 'haunt': {
        if (!x.ghost) return { ok: false, error: 'Only ghosts can haunt.' };
        if (this.phase !== 'court') return { ok: false, error: 'Haunt during court.' };
        if (x.hauntRound === this.round) return { ok: false, error: 'You already haunted someone this round.' };
        if (!T || !this.hauntCands(p.id).includes(target)) return { ok: false, error: 'You can only haunt someone who voted to kill you.' };
        return this.haunt(p.id, target);
      }
      case 'ghoul': {
        if (!x.ghost || x.secret !== 'ghoul' || !x.ghoulCands || x.ghoulPick) return { ok: false, error: 'Not now.' };
        if (!T || !x.ghoulCands.includes(target)) return { ok: false, error: 'Pick one of the names.' };
        return this.ghoulChoose(p.id, target);
      }
      // judgement
      case 'summon': {
        const J = this.J;
        if (this.phase !== 'summon' || !J || J.king !== p.id) return { ok: false, error: 'Only the King summons.' };
        if (m.mercy === true) { this.toPay('mercy'); return { ok: true }; }
        if (!['kill', 'demote', 'reveal'].includes(m.sentence)) return { ok: false, error: 'Pick a sentence.' };
        if (!T || target === p.id || !this.living(target)) return { ok: false, error: 'Summon a living subject.' };
        if (m.sentence === 'demote' && this.seat(target) === this.ladder.length - 1) return { ok: false, error: 'They are already at the bottom.' };
        this.summon(p.id, target, m.sentence); return { ok: true };
      }
      case 'offer': {
        const J = this.J;
        if (this.phase !== 'hearing' || !J) return { ok: false, error: 'No hearing right now.' };
        if (p.id !== J.king && p.id !== J.target) return { ok: false, error: 'Only the King and the accused can offer deals.' };
        if (!T || !this.canOffer(p.id, target)) return { ok: false, error: p.id === J.king && T && this.seat(target) === 1 ? 'The Knight can’t rise any higher.' : 'You can’t offer them a deal.' };
        let amount = 0;
        if (p.id === J.target) { amount = Number(m.amount); if (!GOLD_OFFERS.includes(amount)) return { ok: false, error: 'Offer 10, 25 or 50 points.' }; if (x.points < amount) return { ok: false, error: 'You don’t have that many points.' }; }
        return this.offer(p.id, target, amount);
      }
      case 'accept': {
        const J = this.J;
        if (this.phase !== 'hearing' || !J) return { ok: false, error: 'No hearing right now.' };
        const o = J.offers.find((y) => y.id === Number(m.offer) && y.to === p.id);
        if (!o) return { ok: false, error: 'That deal is not for you.' };
        if (this.acceptedBy(p.id)) return { ok: false, error: 'You already took a deal.' };
        return this.accept(p.id, o.id);
      }
      case 'vote': {
        if (this.phase === 'hearing') {
          if (!this.voters().includes(p.id)) return { ok: false, error: this.J && (p.id === this.J.king || p.id === this.J.target) ? 'Your vote is already cast.' : 'Ghosts can’t vote.' };
          if (m.side !== 'aye' && m.side !== 'nay') return { ok: false, error: 'Aye or nay?' };
          return this.vote(p.id, m.side);
        }
        if (this.phase === 'coup') {
          const C = this.coup;
          if (!C.voters.includes(p.id) || !this.living(p.id)) return { ok: false, error: 'Ghosts can’t vote.' };
          if (p.id === C.caller || p.id === C.king) return { ok: false, error: 'Your vote is already cast.' };
          if (typeof m.yes !== 'boolean') return { ok: false, error: 'Yes or no?' };
          return this.coupVote(p.id, m.yes);
        }
        if (this.phase === 'trial') {
          const Tr = this.trialS;
          if (!Tr.voters.includes(p.id) || !this.living(p.id)) return { ok: false, error: 'Ghosts can’t vote.' };
          if (typeof m.kill !== 'boolean') return { ok: false, error: 'Spare or kill?' };
          return this.trialVote(p.id, m.kill);
        }
        return { ok: false, error: 'No vote right now.' };
      }
    }
    return { ok: false, error: 'Unknown move.' };
  }
  giveFeedback(p, m) {
    if (!['over', 'unmask'].includes(this.phase)) return { ok: false, error: 'Feedback opens at the end of the game.' };
    if (m.rating !== 'up' && m.rating !== 'down') return { ok: false, error: 'Thumbs up or down?' };
    const note = FEEDBACK.cleanNote(m.note);
    const had = this.feedback.get(p.id);
    if (had && had.saved >= 3) return { ok: false, error: 'Thanks, we got it!' };
    const f = { rating: m.rating, note: TEXT.filter(note), saved: (had ? had.saved : 0) + 1 };
    this.feedback.set(p.id, f);
    if (!p.bot) FEEDBACK.save(this.room, { game: 'king', rating: f.rating, note: f.note, players: this.everyone().length, rounds: this.s.rounds, survived: !!(this.siege && this.siege.survived), practice: this.practice, update: f.saved > 1 });
    this.room.fx('feedback');
    return { ok: true };
  }

  // ---------- screens ----------
  ladderPub() { const n = this.ladder.length; return this.ladder.filter((id) => this.room.get(id)).map((id, i) => { const t = titleOf(i, n), k = tierOf(i, n); return { ...this.pub(id), seat: i, title: t.name, icon: t.icon, tier: TIERS[k].k, tierName: TIERS[k].name, pay: TIERS[k].pay, points: this.pl(id).points }; }); }
  ghostsPub() { return this.everyone().filter((id) => this.pl(id).ghost).map((id) => ({ ...this.pub(id), points: this.pl(id).points, round: this.pl(id).diedRound })); }
  missionPub() {
    const M = this.mis; if (!M) return null;
    const o = { key: M.key, name: MISSIONS[M.key].name, icon: MISSIONS[M.key].icon, how: MISSIONS[M.key].how, wave: M.wave, defence: Math.round(M.defence) };
    if (this.phase === 'mission') {
      if (M.key === 'beacons') o.shouts = this.everyone().filter((id) => { const p = this.room.get(id); return p && p.bot && this.pl(id).m; }).map((id) => ({ id, rune: this.pl(id).m.rune }));
      if (M.key === 'bells') o.peals = (M.peals || []).map((x) => x.k);
      if (M.key === 'gate') o.groups = (M.groups || []).map((g, i) => ({ ids: g.filter((id) => this.room.get(id)), turning: !!(M.turning && M.turning[i]) }));
    }
    return o;
  }
  courtPub() {
    const pairs = new Map();
    for (const m of this.msgs) if (m.round === this.round) for (const t of m.to) { const k = [m.from, t].sort().join('|'); pairs.set(k, (pairs.get(k) || 0) + 1); }
    return { pairs: [...pairs].map(([k, n]) => { const [a, b] = k.split('|'); return { a, b, n }; }).filter((x) => this.room.get(x.a) && this.room.get(x.b)).sort((a, b) => b.n - a.n).slice(0, 40),
      flights: this.flights.map((f) => ({ id: f.id, from: f.from, to: f.to[0] })), total: this.msgs.filter((m) => m.round === this.round).length, coupCalled: !!this.pendingCoup };
  }
  judgePub(full) {
    const J = this.J; if (!J) return null;
    if (J.mercy) return { mercy: true, king: J.king };
    const o = { king: J.king, target: J.target, sentence: J.sentence, voted: [...J.votes.keys()].filter((id) => id !== J.king && id !== J.target), voters: this.voters().length + 2, deals: J.offers.length };
    if (full && J.result) o.result = J.result;
    if (full && this.revealed && this.revealed.id === J.target) o.revealed = this.revealed;
    return o;
  }
  base() {
    const reveal = this.phase === 'unmask' || this.phase === 'over';
    return {
      phase: this.phase, round: this.round, of: this.s.rounds, trial: true, endsIn: this.endsAt && this.phase !== 'over' ? Math.max(0, this.endsAt - this.now()) : 0, herald: this.say_,
      tutor: this.round === 1 && !['siege', 'unmask', 'over'].includes(this.phase), practice: this.practice,
      kingdom: { target: this.target, total: this.defTotal + (this.phase === 'mission' && this.mis ? Math.round(this.mis.defence) : 0), waves: this.waves, history: this.history },
      ladder: this.ladderPub(), ghosts: this.ghostsPub(), mission: this.missionPub(), repel: this.phase === 'repel' ? this.lastRepel : null,
      court: ['court', 'dusk'].includes(this.phase) ? this.courtPub() : null,
      dusk: this.phase === 'dusk' && this.dusk ? { target: this.dusk.target, hit: this.dusk.hit, clue: this.dusk.clue } : null, clues: this.clues.slice(),
      coup: this.coup && ['coup', 'coupResult', 'trial', 'trialResult'].includes(this.phase) ? { caller: this.coup.caller, king: this.coup.king, need: this.coup.need, voted: [...this.coup.votes.keys()], voters: this.coup.voters.length, result: this.phase === 'coup' ? null : this.coup.result } : null,
      trial: this.trialS && ['trial', 'trialResult'].includes(this.phase) ? { old: this.trialS.old, voted: [...this.trialS.votes.keys()], voters: this.trialS.voters.length, result: this.phase === 'trialResult' ? this.trialS.result : null } : null,
      judge: ['summon', 'hearing', 'verdict'].includes(this.phase) ? this.judgePub(this.phase === 'verdict') : null,
      pay: this.phase === 'pay' ? this.payRows : null,
      siege: ['siege', 'unmask', 'over'].includes(this.phase) ? this.siege : null,
      secrets: reveal ? this.everyone().map((id) => ({ ...this.pub(id), secret: this.pl(id).secret || 'loyal' })) : null,
      feedback: reveal ? { up: [...this.feedback.values()].filter((f) => f.rating === 'up').length, down: [...this.feedback.values()].filter((f) => f.rating === 'down').length } : null,
    };
  }
  tv() {
    const st = this.standings();
    return { ...this.base(), standings: st.slice(0, 12), players: st.length, final: this.phase === 'over' ? this.final : null };
  }
  view(p) {
    const v = this.tv(), x = this.pl(p.id);
    v.me = p.id;
    if (!x) { v.spectator = true; return v; }
    const s = this.seat(p.id), n = this.ladder.length;
    v.mine = { ghost: x.ghost, seat: s, title: s >= 0 ? titleOf(s, n) : null, tier: s >= 0 ? TIERS[tierOf(s, n)] : null, points: x.points, haunted: x.haunted,
      secret: x.secret ? { k: x.secret, ...SECRETS[x.secret] } : { k: 'loyal', ...LOYAL } };
    const st = this.standings(); v.rank = st.findIndex((r) => r.id === p.id) + 1; v.ranked = st.length;
    // my mission
    if (this.phase === 'mission' && x.m && this.mis) {
      const M = this.mis, m = x.m, now = this.now();
      v.task = { key: M.key, units: Math.round(x.units), eff: this.eff(p.id) };
      if (M.key === 'wall') Object.assign(v.task, { cracks: m.cracks.slice(), lockIn: Math.max(0, m.lock - now) });
      if (M.key === 'beacons') Object.assign(v.task, { rune: m.rune, ask: m.ask ? this.pub(m.ask) : null, askBot: !!(m.ask && this.room.get(m.ask) && this.room.get(m.ask).bot), lockIn: Math.max(0, m.lock - now), lit: m.lit });
      if (M.key === 'bells') Object.assign(v.task, { coolIn: Math.max(0, m.last + BELL_COOLDOWN - now), rung: m.rung });
      if (M.key === 'gate') { const g = (M.groups || []).find((gg) => gg.includes(p.id)) || [p.id]; Object.assign(v.task, { hold: m.hold, slipIn: Math.max(0, m.slip - now), mates: g.filter((id) => id !== p.id).map((id) => ({ ...this.pub(id), hold: !!(this.pl(id) && this.pl(id).m && this.pl(id).m.hold) })), turning: !!(M.turning && M.turning[(M.groups || []).indexOf(g)]) }); }
    }
    // my messages (sent to me or by me), newest last
    v.inbox = this.msgs.filter((m) => m.from === p.id || m.to.includes(p.id)).slice(-60).map((m) => ({ id: m.id, from: m.from, to: m.to, text: m.text, round: m.round, mine: m.from === p.id }));
    v.canMsg = this.canMessage();
    v.people = this.everyone().filter((id) => id !== p.id).map((id) => ({ ...this.pub(id), ghost: this.pl(id).ghost, seat: this.seat(id) }));
    v.presets = PRESETS;
    // secret powers
    if (x.secret === 'assassin') v.assassin = { ready: this.assassinReady(p.id), target: x.assassinTarget, next: x.assassinLast + ASSASSIN_EVERY, odds: ASSASSIN_ODDS };
    if (x.secret === 'spy' && !x.ghost) v.spy = { target: x.spyRound === this.round ? x.spyTarget : null, msgs: x.spyRound === this.round && x.spyTarget ? this.msgs.filter((m) => m.from === x.spyTarget && m.round === this.round).map((m) => ({ id: m.id, text: m.text })) : [] };
    if (x.secret === 'seer') v.seer = { used: !!x.peek, peek: x.peek ? { ...this.pub(x.peek.id), secret: x.peek.secret, name2: (SECRETS[x.peek.secret] || LOYAL).name, icon: (SECRETS[x.peek.secret] || LOYAL).icon } : null };
    if (x.ghost) v.haunt = { cands: this.hauntCands(p.id).map((id) => this.pub(id)), used: x.hauntRound === this.round, can: this.phase === 'court' && x.hauntRound !== this.round };
    if (x.secret === 'ghoul' && x.ghost) v.ghoul = { cands: x.ghoulCands ? x.ghoulCands.map((id) => this.pub(id)) : null, pick: x.ghoulPick ? this.pub(x.ghoulPick) : null };
    if (x.ghost) v.killers = [...x.killers].filter((id) => x.how !== 'assassin').map((id) => this.pub(id));
    // judgement
    const J = this.J;
    if (J && !J.mercy && this.phase === 'hearing') {
      v.hearing = { myVote: J.votes.get(p.id) || null, voter: this.voters().includes(p.id), offersIn: J.offers.filter((o) => o.to === p.id).map((o) => ({ id: o.id, from: this.pub(o.from), kind: o.kind, side: o.side, amount: o.amount, accepted: o.accepted })),
        offersOut: J.offers.filter((o) => o.from === p.id).map((o) => ({ id: o.id, to: this.pub(o.to), kind: o.kind, amount: o.amount, accepted: o.accepted })),
        canOffer: (p.id === J.king || p.id === J.target) ? this.voters().filter((id) => this.canOffer(p.id, id)).map((id) => ({ ...this.pub(id), seat: this.seat(id) })) : [] };
    }
    if (this.phase === 'coup' && this.coup) v.coupVote = this.coup.votes.has(p.id) ? this.coup.votes.get(p.id) : null;
    if (this.phase === 'trial' && this.trialS) v.trialVote = this.trialS.votes.has(p.id) ? this.trialS.votes.get(p.id) : null;
    if (['unmask', 'over'].includes(this.phase)) v.myFeedback = this.feedback.has(p.id) ? { rating: this.feedback.get(p.id).rating } : null;
    return v;
  }
}

// Minutes for a set of options (Party Mode and the menu's estimate).
function estimate(s) { const per = 7 + s.mission + 7.5 + s.court + 3 + 8 + 18 + 32 + 9 + 9; return (s.rounds * per + 140 + 30) / 60; }
// Party Mode: Kill the King is a TRIAL game and is not dealt into Party Mode lineups automatically
// (the tile's data-trial; public/party/party.js). When the host adds it anyway (🎮 Another game), it
// fits the time: 3 rounds unless there is room for 5, shorter missions and court for short slots.
const partyFit = ({ minutes: M }) => {
  const b = PF.best({ rounds: [3, 5], mission: [60, 75, 45, 90], court: [90, 60, 120] }, estimate, M);
  return { rounds: b.rounds, mission: b.mission, court: b.court };
};
// The practice round: one short round to learn the phases (it ends at round 2 or after 3 minutes).
const practiceSettings = () => ({ rounds: 3, mission: 45, court: 60, secrets: 'on' });

module.exports = {
  key: 'king', name: 'Kill the King', min: 4, best: [5, 10], howSteps: 8, fields, defaults, trial: true,
  show: { facts: false }, // intro cutscene (public/box/intros/king.js): Sir Bellow, the royal herald
  partyFit, practiceSettings,
  create: (room, settings) => new Game(room, settings),
  _test: { TITLES, PEASANT, TIERS, tierOf, titleOf, SECRETS, SECRET_ORDER, secretCount, MISSIONS, ORDER, WAVE, PACE, RUNES, RUNE_NAMES, HERALD, PTS, MS, PRESETS, estimate, GOLD_OFFERS, ASSASSIN_ODDS, MAX_MSG },
};
