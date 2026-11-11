'use strict';
// DLC 1: ten roles built on the existing night pipeline and day abilities.
//   Town:  Medium (séance: a dead player's role), Lookout (who visited someone),
//          Veteran (alert: visitors die, attacks fail), Trapper (trap: protect + learn
//          the attacker), Cupid (bound pair: heartbreak), Eavesdropper (hears Mafia
//          messages, no names), Town Crier (one anonymous TV proclamation a day).
//   Mafia: Framer (target looks Mafia tonight), Janitor (once: a victim's role stays
//          hidden), Impostor (always looks like a Town role).
// Installs last: it wraps kill/views/shownRole from the modules before it.
const { ROLES } = require('../public/shared/roles');

const CRIER_WORDS = ['IS SAFE', 'IS SUSPICIOUS', 'IS LYING', 'TELLS THE TRUTH', 'IS IN DANGER'];
const IMPOSTOR_COVERS = ['villager', 'doctor', 'detective', 'sheriff', 'bodyguard'];

module.exports = function install(Room) {
  const roleName = (r) => (ROLES[r] || {}).name || r;

  // ---------- night abilities ----------
  Object.assign(Room.prototype.nightHandlers, {
    // Framer: tonight, investigations see the target as Mafia.
    frame: { stage: 'statuses', run(a) { (this.night.framed = this.night.framed || new Set()).add(a.targetId); } },
    // Trapper: the trap protects the house tonight; the attacker is caught later (information stage).
    trap: { stage: 'statuses', run(a, c) { c.healed.add(a.targetId); (c.traps = c.traps || new Map()).set(a.targetId, a.actorId); } },
    // Veteran on alert: attacks on them fail, and everyone who visits them dies.
    alert: { run(a, c) {
      const vet = this.players.get(a.actorId); this.consumeAbility(vet, 'alert'); c.healed.add(vet.id);
      for (const v of c.actions.filter((x) => x.targetId === vet.id && x.actorId !== vet.id)) {
        const visitor = this.players.get(v.actorId);
        if (!visitor || !visitor.alive || c.deaths.has(visitor.id)) continue;
        c.deaths.set(visitor.id, 'veteran'); c.events.push({ type: 'kill', targetId: visitor.id });
        this.addLog(`${visitor.name} visited the Veteran on alert and died.`, true);
      }
      vet.notes.push({ day: this.day, text: 'You stood guard all night with your weapon ready.' });
    } },
    // Janitor: if this target dies tonight, their role stays hidden (marked when they die).
    clean: { run(a) { (this.night.cleaned = this.night.cleaned || new Map()).set(a.targetId, a.actorId); this.consumeAbility(this.players.get(a.actorId), 'clean'); } },
    // Cupid: a bond. Both learn of it; if one dies, so does the other.
    link: { run(a) {
      const cupid = this.players.get(a.actorId), t = this.players.get(a.targetId);
      if (!t || !t.alive || cupid.lover) return;
      this.consumeAbility(cupid, 'link'); cupid.lover = t.id; t.lover = cupid.id;
      cupid.notes.push({ day: this.day, text: `💘 You and ${t.name} are bound. If one of you dies, the other dies of a broken heart.` });
      t.notes.push({ day: this.day, text: `💘 Cupid has bound you to ${cupid.name}. If one of you dies, the other dies of a broken heart.` });
    } },
    // Medium: a dead player's exact role.
    seance: { stage: 'information', run(a) {
      const p = this.players.get(a.actorId), t = this.players.get(a.targetId);
      if (!t || t.alive) return;
      const result = this.information(p, t, t.originalRole || t.role, 'role');
      p.investigations.push({ night: this.day, targetId: t.id, name: t.name, reveal: 'role', result });
      this.consumeAbility(p, 'seance');
    } },
    // Lookout: who used an ability on the watched player tonight.
    watch: { stage: 'information', run(a, c) {
      const p = this.players.get(a.actorId), t = this.players.get(a.targetId); if (!t) return;
      const names = [...new Set(c.actions.filter((x) => x.targetId === t.id && x.actorId !== p.id).map((x) => this.nameOf(x.actorId)))];
      p.notes.push({ day: this.day, text: `👀 ${t.name}'s visitors last night: ${names.length ? names.join(', ') : 'nobody'}.` });
      this.consumeAbility(p, 'watch');
    } },
  });

  // The trap's catch runs after attacks resolve: an attack on the trapped house reveals the attacker to the Trapper.
  const resolveNight = Room.prototype.resolveNight;
  Room.prototype.resolveNight = function () {
    const c = resolveNight.call(this);
    if (c && c.traps) for (const [targetId, trapperId] of c.traps) {
      const trapper = this.players.get(trapperId), target = this.players.get(targetId);
      const attacks = (c.attacks || []).filter((x) => x.targetId === targetId && x.actorId);
      if (!trapper) continue;
      trapper.notes.push({ day: this.day, text: attacks.length ? `🪤 Your trap at ${target.name}'s house caught ${[...new Set(attacks.map((x) => this.nameOf(x.actorId)))].join(' and ')} trying to attack!` : `🪤 Your trap at ${target.name}'s house stayed empty.` });
    }
    return c;
  };

  // Targets: the Medium talks to the dead; the Veteran's alert is on themselves.
  const nightTargets = Room.prototype.nightTargets;
  Room.prototype.nightTargets = function (p) {
    const def = this.nightDef(p);
    if (def && def.targets === 'dead') return this.inGame().filter((x) => !x.alive && x.id !== p.id).map((x) => x.id);
    if (def && def.targets === 'self') return [p.id];
    if (def && def.kind === 'link' && p.lover) return [];
    return nightTargets.call(this, p);
  };

  // What investigations see: a framed target looks like Mafia tonight; the Impostor
  // always looks like their Town cover.
  const shownRole = Room.prototype.shownRole || ((p) => p.role);
  Room.prototype.shownRole = function (p) {
    if (this.night && this.night.framed && this.night.framed.has(p.id)) return 'mafia';
    if (p.role === 'impostor') return p.impostorCover || 'villager';
    return shownRole.call(this, p);
  };

  // Deal: each Impostor gets a Town cover.
  const startGame = Room.prototype.startGame;
  Room.prototype.startGame = function () {
    const r = startGame.call(this);
    if (r && r.ok) for (const p of this.inGame()) {
      p.lover = null; p.cleaned = false; p.crierDay = -1;
      if (p.role === 'impostor') { p.impostorCover = this.pick(IMPOSTOR_COVERS); p.notes.push({ day: 0, text: `🎭 To investigators, you look like the ${roleName(p.impostorCover)}.` }); }
    }
    this.heartbreaks = [];
    return r;
  };

  // Deaths: the Janitor's clean-up, and heartbreak for Cupid's pair.
  const kill = Room.prototype.kill;
  Room.prototype.kill = function (p, cause) {
    const wasAlive = p.alive;
    if (wasAlive && cause !== 'vote' && this.night && this.night.cleaned && this.night.cleaned.has(p.id)) {
      p.cleaned = true;
      const janitor = this.players.get(this.night.cleaned.get(p.id));
      if (janitor) janitor.notes.push({ day: this.day, text: `🧹 You cleaned up after ${p.name}. Only you know: they were the ${roleName(p.role)}.` });
    }
    kill.call(this, p, cause);
    if (!wasAlive || p.alive) return;
    const lover = p.lover && this.players.get(p.lover);
    if (lover && lover.alive && cause !== 'left') {
      this.heartbreaks = (this.heartbreaks || []).concat(lover.name);
      this.kill(lover, 'heartbreak');
    }
  };
  // A cleaned role stays hidden until the game is over.
  const revealedRole = Room.prototype.revealedRole;
  Room.prototype.revealedRole = function (p) { return p.cleaned && this.phase !== 'gameover' ? null : revealedRole.call(this, p); };
  const roleSuffix = Room.prototype.roleSuffix;
  Room.prototype.roleSuffix = function (p) { return p.cleaned ? ' Someone cleaned up. Nobody knows what they were.' : roleSuffix.call(this, p); };
  // Heartbreak is announced right after the death that caused it.
  const appendHeartbreak = function () {
    if (!this.heartbreaks || !this.heartbreaks.length || !this.narration) return;
    this.narration.text += ` 💔 ${this.heartbreaks.join(' and ')} died of a broken heart.`;
    this.heartbreaks = [];
  };
  for (const fn of ['startMorning', 'startExecution']) {
    const original = Room.prototype[fn];
    Room.prototype[fn] = function (...args) { const r = original.apply(this, args); appendHeartbreak.call(this); return r; };
  }

  // Town Crier: one anonymous proclamation per day, during discussion.
  const dayAbility = Room.prototype.dayAbility;
  Room.prototype.dayAbility = function (p, msg = {}) {
    if (p && p.role === 'crier' && msg.op === 'crier') {
      if (!p.alive || this.phase !== 'discussion' || this.paused) return { ok: false, error: 'You can proclaim during the discussion.' };
      if (p.crierDay === this.day) return { ok: false, error: 'You already proclaimed today.' };
      const t = this.players.get(String(msg.targetId || '')), word = CRIER_WORDS.includes(msg.word) ? msg.word : null;
      if (!t || !t.alive || t.spectator || !word) return { ok: false, error: 'Choose a living player and a proclamation.' };
      p.crierDay = this.day;
      this.narration = { id: ++this.narrationSeq, text: `📯 Hear ye, hear ye! The Town Crier proclaims: ${t.name} ${word}!`, key: 'crier', custom: true };
      this.addLog(`📯 ${p.name} (Town Crier) proclaimed: ${t.name} ${word}.`, true);
      this.audit('crier', { actorId: p.id, targetId: t.id, word });
      this.sync(); return { ok: true };
    }
    return dayAbility.call(this, p, msg);
  };

  // Phones: the Eavesdropper's overheard messages, the Crier's button, Cupid's bond.
  const playerView = Room.prototype.playerView;
  Room.prototype.playerView = function (p) {
    const v = playerView.call(this, p);
    if (p.spectator || !p.alive || ['lobby', 'draft', 'gameover'].includes(this.phase)) return v;
    if (p.role === 'eavesdropper') v.eavesdrop = (this.mafiaChat || []).filter((m) => m.day === this.day).slice(-8).map((m) => m.text);
    if (p.role === 'crier') v.crier = { canUse: this.phase === 'discussion' && p.crierDay !== this.day && !this.paused, used: p.crierDay === this.day, words: CRIER_WORDS, targets: this.alive().filter((x) => x.id !== p.id).map((x) => x.id) };
    if (p.lover) { const l = this.players.get(p.lover); if (l) v.lover = { name: l.name, alive: l.alive }; }
    return v;
  };
};
