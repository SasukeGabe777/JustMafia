'use strict';
const { ROLES } = require('../public/shared/roles');
const C = require('../public/shared/config');
module.exports = function install(Room) {
  Room.prototype.startingFact = function (p, kind) {
    const others = this.inGame().filter((x) => x.id !== p.id);
    let players, text, falseText;
    if (kind === 'neighborEvil') {
      const ordered = this.inGame().sort((a, b) => a.house - b.house), i = ordered.indexOf(p);
      players = [ordered[(i + ordered.length - 1) % ordered.length], ordered[(i + 1) % ordered.length]];
      if (players.some((x) => this.team(x) === 'mafia' || x.role === 'serialKiller')) { text = 'At least one of these neighbors is Evil.'; falseText = 'Both of these neighbors are Town.'; } else players = null;
    } else if (kind === 'teamPair') {
      const friends = this.shuffle(others.filter((x) => this.team(x) === this.team(p))), enemies = others.filter((x) => this.team(x) !== this.team(p));
      if (this.team(p) !== 'neutral' && friends.length >= 2 && enemies.length) { players = this.shuffle([friends[0], friends[1], this.pick(enemies)]); text = 'Exactly two of these three players are on your team.'; falseText = 'None of these three players are on your team.'; }
    } else if (kind === 'infoTrio') {
      const info = (x) => ['investigate', 'spy'].includes((ROLES[x.role].night || {}).kind);
      const investigators = others.filter(info), rest = this.shuffle(others.filter((x) => !info(x)));
      if (investigators.length && rest.length >= 2) { players = this.shuffle([this.pick(investigators), rest[0], rest[1]]); text = 'Exactly one of these players has an information role.'; falseText = 'None of these players has an information role.'; }
    }
    if (!players) {
      const towns = others.filter((x) => this.team(x) === 'town'); if (!towns.length) return null;
      const first = this.pick(towns); players = this.shuffle([first, ...this.shuffle(others.filter((x) => x !== first)).slice(0, 2)]);
      text = 'At least one of these players is Town.'; falseText = 'None of these players is Town.';
    }
    const delivered = this.information(p, null, text, 'statement', [falseText]);
    const fact = { text: delivered, players: players.map((x) => ({ id: x.id, name: x.name })) };
    this.audit('starting.fact', { actorId: p.id, trueStatement: text, deliveredStatement: delivered, players: players.map((x) => x.id), template: kind }); return fact;
  };
  const start = Room.prototype.startGame;
  Room.prototype.startGame = function () {
    const result = start.call(this); if (!result.ok) return result;
    const assigned = new Set(this.inGame().map((p) => p.role));
    this.mafiaBluffs = this.shuffle(Object.keys(ROLES).filter((r) => ROLES[r].team === 'town' && !assigned.has(r))).slice(0, this.settings.mafiaBluffs);
    this.audit('mafia.bluffs', { roles: this.mafiaBluffs });
    for (const p of this.inGame()) {
      if (p.role === 'vigilante') p.shotsLeft = this.ruleConfig(p).uses || Number.MAX_SAFE_INTEGER;
      for (const status of (this.startStatuses || {})[p.id] || []) this.addStatus(p, status.type, status);
      const cfg = this.ruleConfig(p); p.startingInfo = cfg.startingInfo === 'none' ? null : this.startingFact(p, cfg.startingInfo);
    }
    return result;
  };
  const didWin = Room.prototype.didWin;
  Room.prototype.didWin = function (p) {
    if (p.role === 'jester' && this.ruleConfig(p).behavior !== 'classic' && p.alive && p.mimicUsed && p.mimicActed) return true;
    return didWin.call(this, p);
  };
  const view = Room.prototype.playerView;
  Room.prototype.playerView = function (p) {
    const v = view.call(this, p);
    if (!p.spectator) {
      v.startingInfo = p.startingInfo || null;
      v.special = { canAct: this.phase === 'night' && p.alive && !this.paused,
        mimic: p.role === 'jester' && this.ruleConfig(p).behavior !== 'classic' && !p.mimicUsed,
        eligibleCopies: p.role === 'jester' ? C.COPYABLE : [],
        interrupt: p.role === 'storymaker' && this.abilityAvailable(p, 'interrupt'),
        variant: (this.night && this.night.variants || {})[p.id] || 'primary',
        variants: (p.role === 'alchemist' ? [{ id: 'midas', label: `Midas (${this.ruleConfig(p).midasUses - p.potions.midas} left)` }, { id: 'volatile', label: `Volatile (${this.ruleConfig(p).volatileUses - p.potions.volatile} left)` }] : [{ id: 'primary', label: 'Your role ability' }]).concat(p.stolenAbilities.filter((a) => a.remaining !== 0).map((a) => ({ id: a.id, label: `Stolen ${ROLES[a.role].name} (${a.remaining == null ? 'unlimited' : a.remaining} uses)` }))),
        bomb: (this.nightDef(p) || {}).kind === 'bomb' ? { min: this.ruleConfig(p).minDelay || 3, max: this.ruleConfig(p).maxDelay || 12 } : null,
      };
      if (p.role === 'jester') v.roleBlurb = this.ruleConfig(p).behavior === 'classic' ? ROLES.jester.blurb : `Jester mode: ${this.ruleConfig(p).behavior}. Copy one eligible active ability and use it. Survive until game end to win independently.${this.ruleConfig(p).behavior === 'hybrid' ? ' You also win if voted out.' : ' Being voted out does not win in Mimic mode.'}`;
    }
    return v;
  };
  const host = Room.prototype.hostAction;
  Room.prototype.hostAction = function (msg = {}) {
    if (msg.type === 'status') {
      const p = this.players.get(msg.id);
      if (!p || !C.STATUS[msg.status]) return { ok: false, error: 'Choose a player and a recognized status.' };
      if (msg.clear) { p.statuses = p.statuses.filter((s) => s.type !== msg.status); if (this.startStatuses) this.startStatuses[p.id] = ((this.startStatuses || {})[p.id] || []).filter((s) => s.type !== msg.status); this.audit('status.cleared', { targetId: p.id, type: msg.status }); }
      else {
        const status = { type: msg.status, turns: Math.min(30, Math.max(1, Number(msg.turns) || 4)), source: 'judge' };
        if (this.phase === 'lobby') { this.startStatuses = this.startStatuses || {}; this.startStatuses[p.id] = ((this.startStatuses || {})[p.id] || []).filter((s) => s.type !== msg.status).concat(status); }
        this.addStatus(p, msg.status, status);
      }
      this.sync(); return { ok: true };
    }
    if (msg.type === 'misinformation') {
      const p = this.players.get(msg.id);
      if (!p || !(typeof msg.result === 'boolean' || ROLES[msg.result])) return { ok: false, error: 'Choose a legal result.' };
      this.informationOverrides = this.informationOverrides || {}; this.informationOverrides[p.id] = { result: msg.result };
      this.audit('information.judgeChoice', { actorId: p.id, result: msg.result }); return { ok: true };
    }
    if (msg.type === 'resetRoleConfig' && this.phase === 'lobby') { delete this.settings.roleConfig[msg.role]; this.sync(); return { ok: true }; }
    if (msg.type === 'resetAllSettings' && this.phase === 'lobby') { this.settings = JSON.parse(JSON.stringify(require('../game').DEFAULT_SETTINGS)); this.startStatuses = {}; this.sync(); return { ok: true }; }
    return host.call(this, msg);
  };
};
