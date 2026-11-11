'use strict';
const TACTICS = { suggest: 'Consider {player}.', agree: 'I agree with the leading target.', wait: 'Wait. Let us coordinate.', cover: 'Keep our cover identities consistent.', avoid: 'Avoid {player} tonight.' };
module.exports = function install(Room) {
  Room.prototype.mafiaView = function (p) {
    if (!p.alive || p.spectator || p.left || this.team(p) !== 'mafia') return null;
    const picks = this.phase === 'night' ? this.teamPicks('mafia') : [];
    const totals = {}; for (const pick of picks) totals[pick.targetId] = (totals[pick.targetId] || 0) + 1;
    return { canVote: this.phase === 'night' && !this.paused, choice: (this.night && this.night.mafiaVotes || {})[p.id] || null,
      targets: this.alive().filter((x) => this.team(x) !== 'mafia').map((x) => x.id), picks, totals,
      ties: this.settings.mafiaTie, decision: this.settings.mafiaDecision, bluffs: this.mafiaBluffs || [],
      // Which roles are in this game (e.g. after the card draft), never who holds them.
      rolesInGame: Object.entries(this.composition || {}).map(([role, count]) => ({ role, count, team: (require('../public/shared/roles').ROLES[role] || {}).team })),
      messages: (this.mafiaChat || []).filter((m) => m.day === this.day), tactics: TACTICS, messagesLeft: Math.max(0, 6 - (p.mafiaSent || 0)) };
  };
  Room.prototype.voteMafia = function (p, targetId) {
    const v = this.mafiaView(p);
    if (!v || !v.canVote || !v.targets.includes(targetId)) return { ok: false, error: 'Choose an eligible target during the night.' };
    this.night.mafiaVotes[p.id] = targetId;
    if ((this.nightDef(p) || {}).teamKill) this.night.actions[p.id] = targetId;
    this.audit('mafia.vote', { actorId: p.id, targetId }); this.sync(); return { ok: true };
  };
  Room.prototype.sendMafia = function (p, msg = {}) {
    const v = this.mafiaView(p), template = TACTICS[msg.tactic];
    if (!v || !v.canVote || !template || !v.messagesLeft || this.now() - (p.mafiaAt ?? -Infinity) < this.ms(1.5)) return { ok: false, error: 'Coordination is unavailable or cooling down.' };
    if (template.includes('{player}') && !v.targets.includes(msg.targetId)) return { ok: false, error: 'Choose an eligible target.' };
    p.mafiaSent = (p.mafiaSent || 0) + 1; p.mafiaAt = this.now();
    const message = { id: ++this.eventSeq, fromId: p.id, day: this.day, text: template.replace('{player}', this.nameOf(msg.targetId)) };
    this.mafiaChat.push(message); this.audit('mafia.message', { message }); this.sync(); return { ok: true };
  };
  Room.prototype.resolveMafiaChoice = function (picks) {
    const leader = picks.find((m) => m.leader), counts = {};
    for (const m of picks) counts[m.targetId] = (counts[m.targetId] || 0) + 1;
    const best = Math.max(...Object.values(counts)), top = Object.keys(counts).filter((id) => counts[id] === best).sort();
    let targetId = top.length === 1 ? top[0] : leader && top.includes(leader.targetId) ? leader.targetId : this.settings.mafiaTie === 'random' ? this.pick(top) : null;
    if (this.settings.mafiaDecision === 'legacy') targetId = leader ? leader.targetId : this.pick(top);
    if (!targetId) { this.audit('mafia.noKill', { reason: 'tied vote', picks }); return null; }
    return { targetId, actorId: (leader && leader.targetId === targetId ? leader : picks.find((m) => m.targetId === targetId)).id };
  };
  Room.prototype.resolveExtraTargets = function (picks, primary) {
    const counts = {}; for (const p of picks) if (p.targetId !== primary) counts[p.targetId] = (counts[p.targetId] || 0) + 1;
    const out = [];
    while (Object.keys(counts).length && out.length < this.settings.mafiaExtraKills) {
      const max = Math.max(...Object.values(counts)), tied = Object.keys(counts).filter((k) => counts[k] === max).sort();
      if (tied.length > 1 && this.settings.mafiaTie !== 'random') break;
      const chosen = tied.length === 1 ? tied[0] : this.pick(tied); out.push(chosen); delete counts[chosen];
    }
    return out;
  };
};
