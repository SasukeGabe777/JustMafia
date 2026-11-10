'use strict';
const clean = (text, max) => String(text || '').replace(/[<>\u0000-\u001f]/g, '').trim().slice(0, max);
module.exports = function install(Room) {
  Room.prototype.canCast = function (p) {
    if (!p || p.left || p.spectator || this.hasStatus(p, 'silenced')) return false;
    const temporary = this.statuses(p).find((s) => s.type === 'temporaryRevival');
    if (temporary && temporary.data.canVote === false) return false;
    return p.alive || this.settings.ghostVotes && (!p.ghostVoteUsed || p.ghostBallotPhase === this.phaseId && !!(this.votes || {})[p.id]);
  };
  Room.prototype.gameVoters = function () { return this.inGame().filter((p) => this.canCast(p)); };
  Room.prototype.sendGhost = function (p, text) {
    if (!this.settings.ghostChat || p.alive || p.spectator || p.left || this.paused || this.hasStatus(p,'silenced') || !['morning', 'discussion', 'voting', 'night', 'accusation', 'defense'].includes(this.phase)) return { ok: false, error: 'Ghost chat is unavailable.' };
    text = clean(text, 160);
    if (!text || (p.ghostSent || 0) >= 10 || this.now() - (p.ghostAt ?? -Infinity) < this.ms(1.5)) return { ok: false, error: 'Ghost chat is cooling down.' };
    p.ghostAt = this.now(); p.ghostSent = (p.ghostSent || 0) + 1;
    this.ghostLog.push({ id: ++this.eventSeq, fromId: p.id, name: p.name, text, day: this.day });
    this.ghostLog = this.ghostLog.slice(-100); this.audit('ghost.message', { actorId: p.id, text }); this.sync(); return { ok: true };
  };
  Room.prototype.requestWhisper = function (p, targetId) {
    const target = this.players.get(targetId);
    if (!this.settings.whispers || this.phase !== 'discussion' || !this.canSpeak(p) || !this.canSpeak(target) || p.id === targetId || p.whispersUsed >= this.settings.whispersPerDay || this.now() - p.whisperAt < this.ms(3)) return { ok: false, error: 'Whisper request unavailable.' };
    if (this.settings.whisperTeam === 'townOnly' && this.team(p) !== 'town' || this.settings.whisperTeam === 'mafiaOnly' && this.team(p) !== 'mafia') return { ok: false, error: 'Your alignment cannot initiate whispers in this setup.' };
    if (this.huddles.some((h) => ['pending', 'active'].includes(h.state) && h.expiresAt > this.now() && h.phaseId === this.phaseId && [p.id, targetId].some((id) => [h.fromId, h.toId].includes(id)))) return { ok: false, error: 'One participant already has a whisper pending.' };
    p.whispersUsed++; p.whisperAt = this.now();
    const h = { id: ++this.effectSeq, fromId: p.id, toId: targetId, day: this.day, phaseId: this.phaseId, expiresAt: this.now() + this.ms(30), state: 'pending', messages: [] };
    this.huddles.push(h); this.audit('whisper.request', { actorId: p.id, targetId, huddleId: h.id });
    this.later(this.ms(30), () => { if (h.state === 'pending') { h.state = 'expired'; this.sync(); } }); this.sync(); return { ok: true };
  };
  Room.prototype.replyWhisper = function (p, id, accept) {
    const h = this.huddles.find((h) => h.id === id), from = h && this.players.get(h.fromId);
    if (!h || h.toId !== p.id || h.state !== 'pending' || h.expiresAt <= this.now() || h.phaseId !== this.phaseId || this.phase !== 'discussion' || !this.canSpeak(p) || !this.canSpeak(from)) return { ok: false, error: 'This request is no longer available.' };
    h.state = accept ? 'active' : 'declined'; h.expiresAt = this.now() + this.ms(30);
    if (accept) this.later(this.ms(30), () => { if (h.state === 'active') { h.state = 'expired'; this.sync(); } });
    this.audit('whisper.reply', { actorId: p.id, huddleId: h.id, state: h.state }); this.sync(); return { ok: true };
  };
  Room.prototype.sendWhisper = function (p, id, text) {
    const h = this.huddles.find((h) => h.id === id), partner = h && this.players.get(h.fromId === p.id ? h.toId : h.fromId);
    if (!h || ![h.fromId, h.toId].includes(p.id) || h.state !== 'active' || h.phaseId !== this.phaseId || h.expiresAt <= this.now() || this.phase !== 'discussion' || !this.canSpeak(p) || !this.canSpeak(partner)) return { ok: false, error: 'Whisper session has closed.' };
    if (h.messages.filter((m) => m.fromId === p.id).length >= 3 || this.now() - (p.messageAt ?? -Infinity) < this.ms(1)) return { ok: false, error: 'Message limit or cooldown reached.' };
    text = clean(text, this.settings.whisperLength); if (!text) return { ok: false, error: 'Write a short message.' };
    p.messageAt = this.now(); h.messages.push({ fromId: p.id, text, at: this.now() });
    this.audit('whisper.message', { actorId: p.id, targetId: partner.id, huddleId: id, ...(this.settings.judgeReadsWhispers ? { text } : {}) }); this.sync(); return { ok: true };
  };
  Room.prototype.nominate = function (p, targetId) {
    const target = this.players.get(targetId);
    if (this.settings.votingMode !== 'nomination' || this.phase !== 'discussion' || !this.canSpeak(p) || !target || !target.alive || target.spectator || target.left || targetId === p.id || p.nominations >= this.settings.nominationsPerDay || this.nomination || this.now() - this.nominationAt < this.ms(this.settings.nominationCooldown) || !this.settings.repeatNominations && this.nominatedToday.includes(targetId)) return { ok: false, error: 'This nomination is unavailable.' };
    p.nominations++;
    this.nomination = { id: ++this.effectSeq, accuserId: p.id, targetId, seconds: [], state: 'pending', remaining: this.endsAt ? this.endsAt - this.now() : null };
    const id = this.nomination.id; this.audit('nomination.requested', { actorId: p.id, targetId });
    if (!this.settings.nominationSecondsRequired) this.acceptNomination();
    else this.later(this.ms(this.settings.nominationSeconds), () => { if (this.nomination && this.nomination.id === id && this.nomination.state === 'pending') { this.nomination = null; this.sync(); } });
    this.sync(); return { ok: true };
  };
  Room.prototype.secondNomination = function (p) {
    const n = this.nomination;
    if (!n || n.state !== 'pending' || this.phase !== 'discussion' || !this.canSpeak(p) || p.id === n.accuserId || n.seconds.includes(p.id)) return { ok: false, error: 'You cannot second this nomination.' };
    n.seconds.push(p.id); if (n.seconds.length >= this.settings.nominationSecondsRequired) this.acceptNomination(); this.sync(); return { ok: true };
  };
  Room.prototype.acceptNomination = function () {
    const n = this.nomination; if (!n) return;
    n.state = 'active'; this.nominationAt = this.now(); this.nominatedToday.push(n.targetId);
    this.narrate('nomination', { accuser: this.nameOf(n.accuserId), name: this.nameOf(n.targetId) });
    this.appendStories([{ scene: 'nomination', targetId: n.targetId, title: `${this.nameOf(n.accuserId)} accuses ${this.nameOf(n.targetId)}`, sub: 'The accuser has the floor.' }]);
    this.setPhase('accusation', this.ms(this.settings.accusationSeconds));
  };
  const advance = Room.prototype.advance;
  Room.prototype.advance = function () {
    if (this.judgeVacant) return;
    if (this.phase === 'accusation') { this.narrate('defense', { name: this.nameOf(this.nomination.targetId) }); return this.setPhase('defense', this.ms(this.settings.defenseSeconds)); }
    if (this.phase === 'defense') return this.startVoting();
    if (this.phase === 'execution' && this.nomination && !this.winner && !this.settings.nominationEndsDiscussion) {
      const remaining = this.nomination.remaining; this.nomination = null; return this.setPhase('discussion', remaining == null ? null : Math.max(this.ms(5), remaining));
    }
    return advance.call(this);
  };
  const targets = Room.prototype.voteTargets;
  Room.prototype.voteTargets = function (p) { return this.nomination && this.nomination.state === 'active' && !this.emergency ? this.alive().filter((x) => x.id === this.nomination.targetId).map((x) => x.id) : targets.call(this, p); };
  const vote = Room.prototype.vote;
  Room.prototype.vote = function (p, targetId, options) {
    const ghost = !p.alive, result = vote.call(this, p, targetId, options);
    if (result && ghost && targetId != null) {
      const first = !p.ghostVoteUsed; p.ghostVoteUsed = true; p.ghostBallotPhase = this.phaseId;
      if (first) { this.audit('ghost.vote', { actorId: p.id, targetId }); this.appendStories([{ scene: 'ghostVote', title: 'A VOICE FROM BEYOND', sub: 'A ghost joins this ballot.' }]); }
      this.sync();
    }
    return result;
  };
  const start = Room.prototype.startGame;
  Room.prototype.startGame = function () { this.ghostLog = []; this.huddles = []; this.nominationAt = -Infinity; this.nominatedToday = []; return start.call(this); };
  const night = Room.prototype.startNight;
  Room.prototype.startNight = function () { this.nomination = null; this.nominatedToday = []; this.nominationAt = -Infinity; for (const p of this.list()) { p.whispersUsed = 0; p.nominations = 0; p.ghostSent = 0; } return night.call(this); };
  const view = Room.prototype.playerView;
  Room.prototype.playerView = function (p) {
    const v = view.call(this, p); if (p.spectator) return v;
    v.ghost = !p.alive ? { voteEnabled: this.settings.ghostVotes, voteUsed: p.ghostVoteUsed, chatEnabled: this.settings.ghostChat, messages: this.settings.ghostChat ? this.ghostLog : [] } : null;
    v.social = { canWhisper: this.settings.whispers && this.phase === 'discussion' && this.canSpeak(p), whispersLeft: Math.max(0, this.settings.whispersPerDay - p.whispersUsed), judgeReadsWhispers: this.settings.judgeReadsWhispers,
      sessions: (this.huddles || []).filter((h) => [h.fromId, h.toId].includes(p.id) && h.phaseId === this.phaseId && h.expiresAt > this.now()).map((h) => ({ ...h })),
      canNominate: this.settings.votingMode === 'nomination' && this.phase === 'discussion' && this.canSpeak(p) && p.nominations < this.settings.nominationsPerDay };
    if (v.voting) { v.voting.canSkip = v.voting.canSkip || !!this.nomination; v.voting.ghost = !p.alive; } return v;
  };
};
