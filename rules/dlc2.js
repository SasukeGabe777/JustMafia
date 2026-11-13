'use strict';
// DLC 1, part 2: the Mathematician, the Gamer, the Zombie (and its horde) and the Priest.
//
//   Mathematician (Town)  each night picks two players and solves a math problem on the phone
//                         (two tries). Solved: at dawn, how many of the two are a threat (0/1/2).
//   Gamer (Town)          each night plays one run of Night Flight (an original tap-to-fly game).
//                         The score unlocks a power on one player: 5+ Shield, 12+ Scan (Mafia or
//                         not), 25+ High Score (exact role).
//   Zombie (Neutral)      Patient Zero. The horde bites one non-Zombie each night; the bitten turn
//                         at the end of the next night unless cured. Wins when Zombies are at least
//                         half of the living and no Mafia or killer is left.
//   Priest (Town)         comes with the Zombie. Blesses one player a night: stops a bite, cures the
//                         bitten, and once per game cures a full Zombie. Otherwise learns Zombie or not.
// Everything is decided here on the server; phones only send choices (and a game score, capped).
const R = require('../public/shared/roles');
const { ROLES } = R;

const GAME = { shield: 5, scan: 12, high: 25 }; // Night Flight score needed for each power
const POWERS = [['high', 'High Score: learn their exact role'], ['scan', 'Scan: learn if they are Mafia'], ['shield', 'Shield: protect them from one attack tonight']];
const KILLERS = ['serialKiller', 'headhunter'];

// A math problem for night `level` (1 = warm-up, 5 = hard).
function problem(rng, level) {
  const r = (a, b) => a + Math.floor(rng() * (b - a + 1));
  const kinds = level <= 1 ? ['add', 'sub'] : level === 2 ? ['add', 'mul', 'sub'] : level === 3 ? ['mul', 'seq', 'alg', 'mix'] : ['alg', 'seq', 'mix', 'sq', 'mul2'];
  switch (kinds[Math.floor(rng() * kinds.length)]) {
    case 'add': { const a = r(14, 89), b = r(13, 79); return { q: `${a} + ${b}`, a: a + b }; }
    case 'sub': { const a = r(45, 160), b = r(12, 44); return { q: `${a} − ${b}`, a: a - b }; }
    case 'mul': { const a = r(6, 19), b = r(3, 12); return { q: `${a} × ${b}`, a: a * b }; }
    case 'mul2': { const a = r(12, 29), b = r(11, 19); return { q: `${a} × ${b}`, a: a * b }; }
    case 'mix': { const a = r(3, 12), b = r(3, 9), c = r(5, 49); return { q: `${a} × ${b} + ${c}`, a: a * b + c }; }
    case 'sq': { const a = r(11, 24); return { q: `${a}²`, a: a * a }; }
    case 'alg': { const x = r(2, 15), m = r(2, 9), c = r(1, 30); return { q: `${m}x + ${c} = ${m * x + c}   x = ?`, a: x }; }
    default: { // sequences: arithmetic, doubling or square numbers
      const kind = r(0, 2);
      if (kind === 0) { const s = r(1, 12), d = r(3, 11); return { q: `${[0, 1, 2, 3].map((i) => s + i * d).join(', ')}, ?`, a: s + 4 * d }; }
      if (kind === 1) { const s = r(2, 7); return { q: `${[0, 1, 2, 3].map((i) => s * 2 ** i).join(', ')}, ?`, a: s * 16 }; }
      const c = r(0, 9); return { q: `${[1, 2, 3, 4].map((i) => i * i + c).join(', ')}, ?`, a: 25 + c };
    }
  }
}

module.exports = function install(Room) {
  const living = (p) => p && p.alive && !p.left && !p.spectator;
  const isZ = (p) => p && p.role === 'zombie';
  const nightOn = (room) => room.phase === 'night' && !!room.night && !room.paused;
  const setAction = (room, p, targetId, meta) => {
    room.night.metadata = room.night.metadata || {};
    room.night.metadata[p.id] = meta;
    if (!(p.id in room.night.actions)) room.night.order.push(p.id);
    room.night.actions[p.id] = targetId;
  };
  // Is this player a threat to the Town, as the Mathematician's numbers see it?
  const threat = (room, t) => {
    if (isZ(t)) return true;
    const shown = room.shownRole ? room.shownRole(t) : t.role;
    if (KILLERS.includes(t.role) && shown === t.role) return true;
    return R.investigate(t.role === 'impostor' ? 'impostor' : shown, 'mafia');
  };

  // ---------- night handlers ----------
  Object.assign(Room.prototype.nightHandlers, {
    // The Priest blesses before any attack or bite lands.
    bless: { stage: 'statuses', run(a, c) {
      const p = this.players.get(a.actorId), t = this.players.get(a.targetId);
      if (!p || !t) return;
      (c.blessed = c.blessed || new Set()).add(t.id);
      // A blessing is full protection tonight: no attack or bite lands on them. (That is why a
      // Mafia member may pretend to be bitten: a free bodyguard, and the Priest can't tell.)
      if (!isZ(t)) c.healed.add(t.id);
      if (t.infected) {
        t.infected = null;
        t.notes.push({ day: this.day, text: '⛪ Someone blessed you in the night. The fever breaks: the bite is gone.' });
      }
      if (!isZ(t)) {
        t.notes.push({ day: this.day, text: '⛪ A blessing watched over your house tonight.' });
        p.notes.push({ day: this.day, text: `⛪ You blessed ${t.name}. They were safe from the dark tonight. (A blessing can't tell you whether they were really bitten.)` });
      } else if (isZ(t) && !p.exorcismUsed) {
        p.exorcismUsed = true;
        const back = t.zombieFrom && ROLES[t.zombieFrom] ? t.zombieFrom : 'villager';
        t.role = back; t.zombieFrom = null;
        t.notes.push({ day: this.day, text: `⛪ A blessing burns away the rot. You are human again: the ${ROLES[back].name}.` });
        p.notes.push({ day: this.day, text: `⛪ Your blessing found a Zombie in ${t.name}, and cured them. (Your one great cure is spent.)` });
        this.audit('priest.exorcism', { actorId: p.id, targetId: t.id, role: back });
      } else if (isZ(t)) {
        p.notes.push({ day: this.day, text: `⛪ The holy water hissed on ${t.name}'s door: they are a Zombie.` });
      }
    } },
    // The Gamer's power for tonight (decided by the score of their run).
    game: { stage: 'statuses', run(a, c) {
      const p = this.players.get(a.actorId), t = this.players.get(a.targetId), power = (a.metadata || {}).power;
      if (!p || !t || !power) return;
      if (power === 'shield') { c.healed.add(t.id); p.notes.push({ day: this.day, text: `🎮 Shield up! ${t.name} was protected tonight.` }); }
      else if (power === 'scan') {
        const shown = this.shownRole ? this.shownRole(t) : t.role;
        const result = this.information(p, t, R.investigate(t.role === 'impostor' ? 'impostor' : shown, 'mafia'), 'boolean');
        p.investigations.push({ night: this.day, targetId: t.id, name: t.name, reveal: 'mafia', result, by: 'gamer' });
      } else if (power === 'high') {
        const result = this.information(p, t, this.shownRole ? this.shownRole(t) : t.role, 'role');
        p.investigations.push({ night: this.day, targetId: t.id, name: t.name, reveal: 'role', result, by: 'gamer' });
      }
      this.audit('gamer.power', { actorId: p.id, targetId: t.id, power, score: (p.game || {}).score });
    } },
    // The Mathematician's proof.
    calc: { stage: 'information', run(a) {
      const p = this.players.get(a.actorId), m = a.metadata || {};
      const x = this.players.get(a.targetId), y = this.players.get(m.second);
      if (!p || !m.solved || !x || !y || x.id === y.id) return;
      const truth = [x, y].filter((t) => threat(this, t)).length;
      const n = this.information(p, x, truth, 'count', [0, 1, 2].filter((k) => k !== truth));
      p.notes.push({ day: this.day, text: `🧮 Proof complete: of ${x.name} and ${y.name}, ${n === 0 ? 'NEITHER is' : n === 1 ? 'exactly ONE is' : 'BOTH are'} a threat to the Town.` });
      this.audit('mathematician.proof', { actorId: p.id, ids: [x.id, y.id], result: n });
    } },
    // The horde's bite (resolved once a night, after attacks: the dead can't be bitten).
    bite: { stage: 'information', run(a, c) {
      if (c.biteDone) return; c.biteDone = true;
      const picks = c.actions.filter((x) => x.ability === 'bite' && !c.blocked.has(x.actorId) && isZ(this.players.get(x.actorId)));
      if (!picks.length) return;
      const horde = this.alive().filter(isZ), say = (text) => { for (const z of horde) z.notes.push({ day: this.day, text }); };
      // The bigger the horde, the more houses it breaks into: 1 bite, 2 from 3 Zombies, 3 from 5.
      const bites = this.biteCount(horde.length);
      const tally = new Map(); for (const x of picks) tally.set(x.targetId, (tally.get(x.targetId) || 0) + 1);
      const order = [...tally.keys()].sort((a, b) => tally.get(b) - tally.get(a) || picks.findIndex((x) => x.targetId === a) - picks.findIndex((x) => x.targetId === b));
      for (const targetId of order.slice(0, bites)) {
        const t = this.players.get(targetId);
        if (!t || !living(t) || c.deaths.has(t.id) || isZ(t)) continue;
        // The TV shows a break-in at a random house (any living player's, maybe even the real one).
        const decoy = this.pick(this.alive());
        if (decoy) c.events.push({ type: 'bite', targetId: decoy.id });
        const stopped = c.healed.has(t.id) || c.guards.has(t.id) || (c.blessed && c.blessed.has(t.id)) || (ROLES[t.role] || {}).nightImmune;
        if (stopped) { say(`🧟 The horde broke into ${t.name}'s house, but something stopped the bite.`); this.audit('zombie.bite', { targetId: t.id, stopped: true }); continue; }
        t.infected = { day: this.day };
        t.notes.push({ day: this.day, text: '🤒 Something broke your window and bit you in the dark. You feel feverish… Unless the Priest blesses you, you will TURN into a Zombie when the next night ends.' });
        say(`🧟 The horde bit ${t.name}. They turn when the next night ends, unless the Priest cures them.`);
        this.stats.bites = (this.stats.bites || 0) + 1;
        this.audit('zombie.bite', { targetId: t.id, stopped: false });
      }
    } },
  });

  // At the end of every night (after blessings), the bitten from an earlier night turn.
  const resolveNight = Room.prototype.resolveNight;
  Room.prototype.resolveNight = function () {
    const c = resolveNight.call(this);
    const dying = (c && c.deaths) || new Map();
    for (const p of this.alive()) if (p.infected && p.infected.day < this.day && !dying.has(p.id)) this.turnZombie(p);
    return c;
  };
  // How many bites the horde gets tonight.
  Room.prototype.biteCount = (zombies) => Math.max(1, Math.min(4, zombies)); // every Zombie bites (up to 4 a night)
  // The bitten turn: they join the horde (and leave their old team).
  Room.prototype.turnZombie = function (p) {
    p.zombieFrom = p.role; p.role = 'zombie'; p.infected = null;
    p.notes.push({ day: this.day, text: `🧟 The fever wins. You have TURNED: you are a Zombie now (you were the ${(ROLES[p.zombieFrom] || {}).name || p.zombieFrom}). You bite and win with the horde.` });
    this.zombieTurned = (this.zombieTurned || 0) + 1;
    this.stats.turned = (this.stats.turned || 0) + 1;
    this.audit('zombie.turn', { targetId: p.id, from: p.zombieFrom });
  };

  // Night targets: the horde bites anyone who isn't already a Zombie.
  const nightTargets = Room.prototype.nightTargets;
  Room.prototype.nightTargets = function (p) {
    const def = this.nightDef(p);
    if (def && def.targets === 'nonZombie') return this.alive().filter((x) => !isZ(x)).map((x) => x.id);
    return nightTargets.call(this, p);
  };

  // A new night: fresh problems and a fresh run; tell the town (anonymously) when someone turned.
  const startNight = Room.prototype.startNight;
  Room.prototype.startNight = function () {
    const turned = this.zombieTurned || 0; this.zombieTurned = 0;
    startNight.call(this);
    if (this.phase !== 'night' || !this.night) return;
    if (turned) this.narrate('zombieTurn', { count: turned });
    for (const p of this.alive()) {
      if (p.role === 'mathematician') p.math = { day: this.day, tries: 2, solved: false, problem: problem(() => this.rng(), Math.min(5, this.day)), pair: null };
      if (p.role === 'gamer') p.game = { day: this.day, started: null, score: null };
    }
    // Bots: a Mathematician solves 80% of the time; a Gamer scores like a so-so player.
    for (const p of this.alive().filter((x) => x.isBot)) {
      const others = this.alive().filter((x) => x.id !== p.id);
      if (others.length < 2) continue;
      if (p.role === 'mathematician' && this.rng() < 0.8) { const [x, y] = [this.pick(others), this.pick(others)]; if (x.id !== y.id) { p.math.solved = true; setAction(this, p, x.id, { solved: true, second: y.id }); } }
      if (p.role === 'gamer') {
        const roll = this.rng(), score = roll < 0.35 ? Math.floor(this.rng() * 5) : roll < 0.75 ? 5 + Math.floor(this.rng() * 7) : roll < 0.93 ? 12 + Math.floor(this.rng() * 13) : 25 + Math.floor(this.rng() * 10);
        p.game.score = score;
        const power = score >= GAME.high ? 'high' : score >= GAME.scan ? 'scan' : score >= GAME.shield ? 'shield' : null;
        if (power) setAction(this, p, (power === 'shield' ? this.pick(others.concat([p])) : this.pick(others)).id, { power });
      }
    }
  };

  // Phone actions: the Mathematician's answers, the Gamer's runs and powers.
  Room.prototype.dlc2Action = function (p, msg = {}) {
    const fail = (error) => ({ ok: false, error });
    if (!living(p)) return fail('Only the living can do that.');
    if (!nightOn(this)) return fail('That happens at night.');
    const pickTarget = (id, self) => { const t = id && this.players.get(String(id)); return t && living(t) && (self || t.id !== p.id) ? t : null; };
    if (p.role === 'mathematician' && msg.op === 'solve') {
      const m = p.math;
      if (!m || m.day !== this.day) return fail('No problem tonight.');
      if (m.solved) return fail('Already solved. The proof comes at dawn.');
      if (m.tries <= 0) return fail('Out of tries tonight.');
      const x = pickTarget(msg.a), y = pickTarget(msg.b);
      if (!x || !y || x.id === y.id) return fail('Pick two different living players.');
      const answer = Number(String(msg.answer).trim());
      if (!Number.isFinite(answer)) return fail('Type a number.');
      m.pair = [x.id, y.id];
      if (answer === m.problem.a) { m.solved = true; setAction(this, p, x.id, { solved: true, second: y.id }); this.touch(); this.sync(); return { ok: true, correct: true }; }
      m.tries--; m.last = { q: m.problem.q, wrong: answer };
      if (m.tries > 0) m.problem = problem(() => this.rng(), Math.min(5, this.day));
      this.touch(); this.sync();
      return { ok: true, correct: false, triesLeft: m.tries };
    }
    if (p.role === 'gamer') {
      const g = p.game;
      if (!g || g.day !== this.day) return fail('No game tonight.');
      if (msg.op === 'start') { if (g.started != null) return fail('One run per night.'); g.started = this.now(); this.sync(); return { ok: true }; }
      if (msg.op === 'score') {
        if (g.started == null) return fail('Start a run first.');
        if (g.score != null) return fail('Your run is over. Pick a power.');
        // A score can't beat the clock: about one gap every 1.1 seconds at most.
        const cap = Math.floor(Math.max(0, this.now() - g.started) / 1100) + 1;
        g.score = Math.max(0, Math.min(99, cap, Math.floor(Number(msg.score) || 0)));
        this.touch(); this.sync(); return { ok: true, score: g.score };
      }
      if (msg.op === 'power') {
        if (g.score == null) return fail('Play your run first.');
        const need = GAME[msg.power];
        if (!need) return fail('Unknown power.');
        if (g.score < need) return fail(`That needs a score of ${need}.`);
        const t = pickTarget(msg.targetId, msg.power === 'shield');
        if (!t) return fail('Pick a living player.');
        g.power = msg.power; setAction(this, p, t.id, { power: msg.power });
        this.touch(); this.sync(); return { ok: true };
      }
    }
    return fail('Nothing to do.');
  };

  // Private phone views.
  const playerView = Room.prototype.playerView;
  Room.prototype.playerView = function (p) {
    const v = playerView.call(this, p);
    if (!p || !living(p)) return v;
    const others = this.alive().filter((x) => x.id !== p.id).map((x) => ({ id: x.id, name: x.name }));
    if (p.role === 'mathematician' && p.math && p.math.day === this.day && this.phase === 'night') {
      const m = p.math;
      v.math = { problem: m.solved || m.tries <= 0 ? null : m.problem.q, tries: m.tries, solved: m.solved, pair: m.pair, last: m.last || null, level: Math.min(5, this.day), players: others };
    }
    if (p.role === 'gamer' && p.game && p.game.day === this.day && this.phase === 'night') {
      const g = p.game;
      v.gamer = { played: g.score != null, running: g.started != null && g.score == null, score: g.score, power: g.power || null, target: g.power ? this.night.actions[p.id] : null,
        powers: POWERS.map(([id, label]) => ({ id, label, need: GAME[id], open: g.score != null && g.score >= GAME[id] })), players: others, self: { id: p.id, name: p.name } };
    }
    if (p.infected) v.infected = { day: p.infected.day };
    if (isZ(p) && this.phase === 'night' && this.night) {
      const horde = this.alive().filter(isZ);
      v.horde = { bites: this.biteCount(horde.length), members: horde.map((z) => ({ id: z.id, name: z.name, me: z.id === p.id })), picks: horde.filter((z) => this.night.actions[z.id]).map((z) => ({ name: z.name, target: this.nameOf(this.night.actions[z.id]) })) };
    }
    if (p.role === 'priest') v.priest = { cureLeft: !p.exorcismUsed };
    return v;
  };

  // Winning: the horde wins at half the living with no Mafia or killer left; the Town can't win
  // while a Zombie walks.
  const checkWinner = Room.prototype.checkWinner;
  Room.prototype.checkWinner = function () {
    const alive = this.alive(), z = alive.filter(isZ).length;
    if (!z) return checkWinner.call(this);
    const mafia = alive.filter((p) => this.team(p) === 'mafia').length, killers = alive.filter((p) => KILLERS.includes(p.role)).length;
    if (z * 2 >= alive.length && z > mafia + killers) return 'zombie'; // half the living: the horde owns the vote
    const w = checkWinner.call(this);
    return w === 'town' ? null : w;
  };
  const didWin = Room.prototype.didWin;
  Room.prototype.didWin = function (p) {
    if (this.winner === 'zombie') return isZ(p) || (p.jesterWon === true);
    return didWin.call(this, p);
  };
  const endGame = Room.prototype.endGame;
  Room.prototype.endGame = function () {
    endGame.call(this);
    if (this.winner === 'zombie') this.narrate('zombieWin', { count: this.alive().filter(isZ).length });
  };

  // Bots play these roles like people would: the bitten ask the Priest for help, the Priest
  // blesses whoever said they were bitten, and a Priest who found a Zombie says so.
  const setPhase = Room.prototype.setPhase;
  Room.prototype.setPhase = function (phase, ms) {
    setPhase.call(this, phase, ms);
    if (phase !== 'discussion' || !this.settings.botsAuto) return;
    for (const p of this.alive().filter((x) => x.isBot)) {
      if (p.infected && !p.feverSaid) { p.feverSaid = true; this.accuse(p, { kind: 'say', text: 'I was bitten last night! Priest, please bless me tonight!' }); this.feverClaims = (this.feverClaims || []).concat(p.id); }
      if (p.role === 'priest') {
        const note = p.notes.slice().reverse().find((n) => n.day === this.day && /hissed|found a Zombie/.test(n.text));
        const z = note && this.alive().find((x) => note.text.includes(x.name) && isZ(x));
        if (z && !p.zombieCalled) { p.zombieCalled = true; this.accuse(p, { targetId: z.id, kind: 'claim', verdict: 'guilty', text: `My holy water hissed at ${z.name}'s door. ${z.name} is a Zombie!` }); for (const b of this.brains.values()) b.sus[z.id] = (b.sus[z.id] || 0) + 160; }
      }
    }
  };
  const startNightBots = Room.prototype.startNight;
  Room.prototype.startNight = function () {
    startNightBots.call(this);
    if (this.phase !== 'night' || !this.night) return;
    const claims = (this.feverClaims || []).map((id) => this.players.get(id)).filter((x) => x && living(x) && x.infected);
    this.feverClaims = [];
    for (const p of this.alive().filter((x) => x.isBot && x.role === 'priest')) {
      const t = claims.find((x) => x.id !== p.id && this.lastTarget[p.id] !== x.id);
      if (t) setAction(this, p, t.id, {});
    }
  };

  // Fresh state for every game.
  const resetPlayer = Room.prototype.resetPlayer;
  Room.prototype.resetPlayer = function (p) {
    resetPlayer.call(this, p);
    Object.assign(p, { infected: null, zombieFrom: null, exorcismUsed: false, math: null, game: null, feverSaid: false, zombieCalled: false });
  };
};
module.exports.problem = problem;
module.exports.GAME = GAME;
