'use strict';
// The Headhunter (neutral) and the Hunter (Mafia's detective).
//
// Headhunter: marks who they want dead (night action, or any time during the game).
// The mark shows on the Mafia's night screen as a vote from one of their own (it never
// counts toward the real kill). Each time the current mark dies (night kill, gallows,
// or the Headhunter's own strike) they gain a level; level N unlocks power N:
//   1 disguise · 2 puppet a Mafia vote · 3 one strike · 4 nightly role reveal ·
//   5 sees all roles · 6 one execution per day. Wins by being the last one standing.
// Hunter: a Mafia investigator (exact role); results are shared with the whole family.
const R = require('../public/shared/roles');
const { ROLES, HEADHUNTER_LEVELS } = R;

const STRIKE_PHASES = ['night', 'discussion', 'voting'];
const DAY_PHASES = ['discussion', 'voting'];
const NO_LEVEL_CAUSES = ['left']; // leaving the game is not a kill

module.exports = function install(Room) {
  const hh = (p) => (p.hh = p.hh || { kills: 0, mark: null, disguise: null, strikeUsed: false, puppetNight: -1, revealNight: -1, executeDay: -1 });
  const level = (p) => Math.min(6, hh(p).kills);
  const isHH = (p) => p && p.role === 'headhunter';
  const running = (room) => !['lobby', 'draft', 'roleReveal', 'gameover'].includes(room.phase);

  // What investigations see: a Headhunter at level 1+ can wear a fake role.
  // Level 0 passes as a plain Villager; from level 1 they pick any role to wear.
  Room.prototype.shownRole = function (p) {
    if (!isHH(p)) return p.role;
    if (level(p) >= 1 && p.hh && p.hh.disguise && ROLES[p.hh.disguise]) return p.hh.disguise;
    return 'villager';
  };

  Room.prototype.headhunterLevelUp = function (p, victim) {
    const s = hh(p);
    s.kills++; s.mark = null;
    const lv = level(p), info = HEADHUNTER_LEVELS[lv];
    p.notes.push({ day: this.day, text: `🎯 Your mark ${victim.name} is dead. ${s.kills <= 6 ? `LEVEL ${lv}: ${info.title}. ${info.text}` : 'Another head for the wall.'}` });
    this.addLog(`${p.name} (Headhunter) reached level ${lv}.`, true);
    this.audit('headhunter.level', { actorId: p.id, targetId: victim.id, level: lv });
  };

  // Count a kill when a Headhunter's mark dies (any death except leaving the game).
  const kill = Room.prototype.kill;
  Room.prototype.kill = function (p, cause) {
    const wasAlive = p.alive;
    kill.call(this, p, cause);
    if (!wasAlive || p.alive || NO_LEVEL_CAUSES.includes(cause)) return;
    for (const h of this.alive().filter((x) => isHH(x) && x.id !== p.id && x.hh && x.hh.mark === p.id)) this.headhunterLevelUp(h, p);
  };

  // The night mark is recorded the moment it's chosen, so the Mafia see it live.
  const nightAction = Room.prototype.nightAction;
  Room.prototype.nightAction = function (p, targetId, options = {}) {
    const locked = this.night && (this.night.hhLocked || {})[p.id] && (this.nightDef(p) || {}).teamKill;
    if (locked && !options.force) return false; // a puppeted Mafia vote can't be changed tonight
    const ok = nightAction.call(this, p, targetId, options);
    if (ok && isHH(p) && targetId !== 'pass') hh(p).mark = targetId;
    return ok;
  };
  const voteMafia = Room.prototype.voteMafia;
  Room.prototype.voteMafia = function (p, targetId) {
    if (this.night && (this.night.hhLocked || {})[p.id]) return { ok: false, error: 'Something compels your vote tonight. It cannot change.' };
    return voteMafia.call(this, p, targetId);
  };

  // A dealt Headhunter starts at level 0 with a fresh state.
  const startGame = Room.prototype.startGame;
  Room.prototype.startGame = function () {
    const r = startGame.call(this);
    if (r && r.ok) for (const p of this.inGame().filter(isHH)) { p.hh = null; hh(p); }
    return r;
  };

  // Each night every Headhunter borrows a random Mafia face for their fake vote.
  const startNight = Room.prototype.startNight;
  Room.prototype.startNight = function () {
    startNight.call(this);
    if (!this.night || this.phase !== 'night') return;
    this.night.hhFace = {}; this.night.hhLocked = {};
    const fam = this.alive().filter((x) => this.team(x) === 'mafia');
    for (const h of this.alive().filter(isHH)) if (fam.length) this.night.hhFace[h.id] = this.pick(fam).id;
    this.headhunterBots();
  };

  // Fake votes: shown to the Mafia exactly like a teammate's vote, never counted.
  Room.prototype.headhunterFakes = function () {
    if (this.phase !== 'night' || !this.night || !this.night.hhFace) return [];
    return this.alive().filter((h) => isHH(h) && h.hh && h.hh.mark && this.night.hhFace[h.id])
      .map((h) => ({ id: this.night.hhFace[h.id], targetId: h.hh.mark, leader: false }))
      .filter((f) => { const face = this.players.get(f.id), t = this.players.get(f.targetId); return face && face.alive && t && t.alive && this.team(t) !== 'mafia'; });
  };

  const mafiaView = Room.prototype.mafiaView;
  Room.prototype.mafiaView = function (p) {
    const v = mafiaView.call(this, p);
    if (!v) return v;
    // Hunter results, shared with the whole family.
    v.intel = this.inGame().filter((x) => x.role === 'hunter' && this.team(x) === 'mafia').flatMap((x) => (x.investigations || []).filter((i) => !i.blocked).map((i) => ({ night: i.night, name: i.name, role: i.result, by: x.name })));
    if (this.night && (this.night.hhLocked || {})[p.id]) v.compelled = true;
    const fakes = this.headhunterFakes().filter((f) => f.id !== p.id); // never show you a vote "you" didn't cast
    if (fakes.length) {
      v.picks = v.picks.concat(fakes.map(({ id, targetId }) => ({ id, targetId })));
      v.totals = { ...v.totals }; for (const f of fakes) v.totals[f.targetId] = (v.totals[f.targetId] || 0) + 1;
    }
    return v;
  };

  // A Headhunter's private view: level, mark, and what they can do right now.
  Room.prototype.headhunterView = function (p) {
    if (!isHH(p) || p.spectator || !p.alive || !running(this)) return null;
    const s = hh(p), lv = level(p), others = this.alive().filter((x) => x.id !== p.id);
    const night = this.phase === 'night' && !this.paused, day = DAY_PHASES.includes(this.phase) && !this.paused;
    return {
      level: lv, kills: s.kills, levels: HEADHUNTER_LEVELS, mark: s.mark && this.players.get(s.mark) && this.players.get(s.mark).alive ? s.mark : null,
      targets: others.map((x) => x.id), canMark: running(this),
      disguise: s.disguise, canDisguise: lv >= 1, disguises: lv >= 1 ? R.ROLE_ORDER.filter((k) => k !== 'headhunter') : [],
      canPuppet: lv >= 2 && night && s.puppetNight !== this.day && this.alive().some((x) => this.team(x) === 'mafia'),
      canStrike: lv >= 3 && !s.strikeUsed && STRIKE_PHASES.includes(this.phase) && !this.paused,
      canReveal: lv >= 4 && night && s.revealNight !== this.day,
      roles: lv >= 5 ? this.inGame().filter((x) => x.id !== p.id).map((x) => ({ id: x.id, name: x.name, role: x.role, alive: x.alive })) : null,
      canExecute: lv >= 6 && day && s.executeDay !== this.day,
    };
  };
  const playerView = Room.prototype.playerView;
  Room.prototype.playerView = function (p) {
    const v = playerView.call(this, p);
    const h = this.headhunterView(p); if (h) v.headhunter = h;
    // Mafia phones (and Mafia bots) see the fake votes among their team's picks.
    if (v.action && v.action.teamPicks && this.team(p) === 'mafia') v.action.teamPicks = v.action.teamPicks.concat(this.headhunterFakes().filter((f) => f.id !== p.id));
    return v;
  };

  // Death on the spot (strike or execution), with its own scene on the big screen.
  Room.prototype.headhunterKill = function (p, target, kind) {
    hh(p).mark = target.id; // the Headhunter's own kill always counts
    if (this.votes) { delete this.votes[target.id]; for (const [k, t] of Object.entries(this.votes)) if (t === target.id) delete this.votes[k]; }
    this.kill(target, 'headhunter');
    const role = this.settings.revealRoleOnDeath ? ` They were the ${ROLES[target.role].name}.` : '';
    this.narrate(kind === 'execute' ? 'hhExecute' : 'hhStrike', { name: target.name, role });
    this.appendStories([{ scene: kind === 'execute' ? 'headhuntExecution' : 'headhunt', targetId: target.id, title: kind === 'execute' ? 'THE HEADHUNTER’S VERDICT' : 'A HEAD IS TAKEN', sub: `${target.name}${role}` }]);
    this.addLog(`${p.name} (Headhunter) ${kind === 'execute' ? 'executed' : 'struck down'} ${target.name}.`, true);
    this.audit('headhunter.' + kind, { actorId: p.id, targetId: target.id });
    this.winner = this.winner || this.checkWinner();
    if (this.winner) { this.storyTerminal = true; this.finishSoon(12000); }
  };

  Room.prototype.headhunterAction = function (p, msg = {}) {
    const fail = (error) => ({ ok: false, error });
    if (!isHH(p) || !p.alive || p.spectator || !running(this)) return fail('Only a living Headhunter can do that.');
    if (this.paused) return fail('The game is paused.');
    const s = hh(p), lv = level(p), v = this.headhunterView(p);
    const target = msg.targetId ? this.players.get(String(msg.targetId)) : null;
    const validTarget = target && target.alive && !target.spectator && !target.left && target.id !== p.id;
    switch (msg.op) {
      case 'mark':
        if (!validTarget) return fail('Choose a living player.');
        s.mark = target.id;
        if (this.phase === 'night' && this.night) { if (!(p.id in this.night.actions)) this.night.order.push(p.id); this.night.actions[p.id] = target.id; }
        break;
      case 'disguise':
        if (lv < 1) return fail('Reach level 1 to disguise yourself.');
        if (msg.role !== null && (!ROLES[msg.role] || msg.role === 'headhunter')) return fail('Choose a role to wear.');
        s.disguise = msg.role || null;
        break;
      case 'puppet': {
        if (!v.canPuppet) return fail('Puppet is not available right now.');
        if (!validTarget || this.team(target) === 'mafia') return fail('Choose a living non-Mafia target.');
        const fam = this.alive().filter((x) => this.team(x) === 'mafia' && !this.night.hhLocked[x.id]);
        if (!fam.length) return fail('No Mafia vote is free to take.');
        const m = this.pick(fam);
        this.night.mafiaVotes[m.id] = target.id;
        if ((this.nightDef(m) || {}).teamKill) this.night.actions[m.id] = target.id;
        this.night.hhLocked[m.id] = true; s.puppetNight = this.day;
        m.notes.push({ day: this.day, text: 'Something took hold of your kill vote tonight. It cannot be changed.' });
        this.audit('headhunter.puppet', { actorId: p.id, targetId: target.id, puppetId: m.id });
        break;
      }
      case 'strike':
        if (!v.canStrike) return fail('Your strike is not available right now.');
        if (!validTarget) return fail('Choose a living player.');
        s.strikeUsed = true; this.headhunterKill(p, target, 'strike');
        break;
      case 'reveal': {
        if (!v.canReveal) return fail('Insight is available once a night.');
        if (!validTarget) return fail('Choose a living player.');
        s.revealNight = this.day;
        const result = this.information(p, target, target.role, 'role');
        p.investigations.push({ night: this.day, targetId: target.id, name: target.name, reveal: 'role', result });
        break;
      }
      case 'execute':
        if (!v.canExecute) return fail('You can execute once a day, during discussion or voting.');
        if (!validTarget) return fail('Choose a living player.');
        s.executeDay = this.day; this.headhunterKill(p, target, 'execute');
        break;
      default: return fail('Unknown Headhunter action.');
    }
    this.touch(); this.sync();
    return { ok: true };
  };

  // Bots: mark someone each night and use the strike now and then.
  Room.prototype.headhunterBots = function () {
    for (const b of this.alive().filter((x) => isHH(x) && x.isBot)) {
      const targets = this.alive().filter((x) => x.id !== b.id);
      if (!targets.length) continue;
      const t = this.pick(targets);
      this.later(this.ms(2 + this.rng() * 4), () => { if (this.phase === 'night' && b.alive) this.nightAction(b, t.id); });
      if (level(b) >= 3 && !hh(b).strikeUsed && this.rng() < 0.25) this.later(this.ms(6), () => { if (this.phase === 'night' && b.alive) { const v = this.alive().filter((x) => x.id !== b.id); if (v.length) this.headhunterAction(b, { op: 'strike', targetId: this.pick(v).id }); } });
    }
  };
};
