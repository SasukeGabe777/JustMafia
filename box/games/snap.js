'use strict';
// JustSnap: a JustGameBox game. Rules live here; the TV and phones get tv() and view(p).
// Starter rules (replace them): each round everyone taps a number 1–5; matching the room's most
// popular pick scores. Keep: results(), validation of every phone input, room.after timers.
const opt = (pairs) => pairs.map(([value, label]) => ({ value, label }));
const fields = [
  { key: 'rounds', label: 'Rounds', options: opt([[3, '3 rounds'], [5, '5 rounds'], [8, '8 rounds']]) },
  { key: 'seconds', label: 'Time to pick', options: opt([[15, '15 seconds'], [20, '20 seconds'], [30, '30 seconds']]) },
];
const defaults = { rounds: 5, seconds: 20 };
// Party Mode: settings that fit the players here and this game's minutes in the plan (box/party-fit.js).
// Estimate the minutes for a choice of options; PF.best picks the options closest to the target.
const PF = require('../party-fit');
const partyFit = ({ minutes: M }) => {
  const seconds = M <= 7 ? 15 : 20;
  const { rounds } = PF.best({ rounds: [5, 3, 8] }, (s) => 0.5 + s.rounds * (seconds + 10) / 60, M);
  return { rounds, seconds };
};
const REVEAL_MS = 6000;

class Game {
  constructor(room, s) { this.room = room; this.s = s; this.phase = 'pick'; this.round = 0; this.picks = new Map(); this.points = new Map(); this.endsAt = 0; this.timer = null; this.last = null; }
  setTimer(ms, fn) { this.room.cancel(this.timer); this.endsAt = this.room.now() + ms; this.timer = this.room.after(ms, fn); }
  start() { for (const p of this.room.list()) this.points.set(p.id, 0); this.nextRound(); }
  joined(p) { if (!this.points.has(p.id)) this.points.set(p.id, 0); }
  left() { this.maybeDone(); }
  nextRound() {
    if (this.round >= this.s.rounds) return this.end();
    this.round++; this.phase = 'pick'; this.picks = new Map(); this.room.fx('round');
    this.setTimer(this.s.seconds * 1000, () => this.reveal());
    for (const p of this.room.list()) if (p.bot) this.room.after(1500 + this.room.rng() * 4000, () => { if (this.phase === 'pick') { this.picks.set(p.id, 1 + Math.floor(this.room.rng() * 5)); this.maybeDone(); } });
  }
  maybeDone() { if (this.phase === 'pick' && this.room.list().filter((p) => p.bot || p.sockets > 0).every((p) => this.picks.has(p.id))) this.reveal(); }
  reveal() {
    if (this.phase !== 'pick') return;
    const tally = [0, 0, 0, 0, 0, 0]; for (const v of this.picks.values()) tally[v]++;
    const top = tally.indexOf(Math.max(...tally));
    for (const [id, v] of this.picks) if (v === top) this.points.set(id, (this.points.get(id) || 0) + 100);
    this.last = { top, tally: tally.slice(1) }; this.phase = 'reveal'; this.room.fx('reveal');
    this.setTimer(REVEAL_MS, () => this.nextRound());
  }
  end() { this.phase = 'over'; this.endsAt = 0; this.room.cancel(this.timer); this.room.fx('win'); }
  next() { if (this.phase === 'pick') this.reveal(); else if (this.phase === 'reveal') this.nextRound(); }
  standings() { return [...this.points].filter(([id]) => this.room.get(id)).map(([id, pts]) => ({ id, name: this.room.name(id), avatar: (this.room.get(id) || {}).avatar, points: pts })).sort((a, b) => b.points - a.points); }
  // TODO gear (JustGold shop): add this game's wearable slots (spot head/face/hand/chest/back, shapes from
  // public/wear-art.js) and items to public/shared/gear.js: players wear them automatically (BOX.face/body).
  // For an object slot (a skin, a card back…) copy
  // each player's gear into the per-player data, e.g. gear: require('../../public/shared/gear').gearSet(this.room.get(id), "snap"),
  // and draw it on the TV with MT_GEAR.paint("snap", '<slot>', x.gear) (docs/game-kit.md, "Gear").
  // Party points: player ids best-first once the game is over.
  results() { return this.phase === 'over' ? this.standings().map((r) => r.id) : []; }
  act(p, m) {
    if (m.op === 'pick') {
      if (this.phase !== 'pick') return { ok: false, error: 'Not now.' };
      const v = Number(m.v); if (!Number.isInteger(v) || v < 1 || v > 5) return { ok: false, error: 'Pick 1 to 5.' };
      this.picks.set(p.id, v); this.maybeDone(); return { ok: true };
    }
    return { ok: false, error: 'Unknown move.' };
  }
  tv() { return { phase: this.phase, round: this.round, of: this.s.rounds, endsIn: this.endsAt ? Math.max(0, this.endsAt - this.room.now()) : 0, picked: this.picks.size, players: this.room.list().length, last: this.phase === 'reveal' ? this.last : null, standings: this.standings().slice(0, 10) }; }
  view(p) { return { ...this.tv(), mine: this.picks.get(p.id) || null, points: this.points.get(p.id) || 0 }; }
}

module.exports = {
  key: "snap", name: "JustSnap", min: 2, best: [3, 10], fields, defaults, // best: the ideal crowd (Party Mode + the menu use it)
  show: { facts: false }, // intro cutscene before the game (public/box/intros/snap.js)
  partyFit, // Party Mode fits the settings to the crowd and the time
  create: (room, settings) => new Game(room, settings),
};
