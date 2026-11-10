'use strict';
// Server-only governance. Credentials never appear in any public/phone view.
const crypto = require('crypto');
const DISASTERS = ['hurricane', 'flood', 'meteor'];
module.exports = function install(Room) {
  Room.prototype.withdrawChoices = function (id) {
    for (const choices of [this.night && this.night.actions, this.night && this.night.mafiaVotes, this.votes, this.voteLocks]) {
      if (!choices) continue;
      delete choices[id];
      for (const [actor, target] of Object.entries(choices)) if (target === id) delete choices[actor];
    }
    if (this.pending && this.pending.eliminatedId === id) this.pending.eliminatedId = null;
  };
  Room.prototype.eligibleVoters = function () {
    return this.list().filter((p) => !p.isBot && !p.isJudge && !p.left && p.sockets > 0);
  };
  Room.prototype.governanceView = function (p) {
    const eligible = this.eligibleVoters();
    return {
      judgeId: this.judgeParticipantId || null, vacant: !!this.judgeVacant,
      announcement: this.judgeAnnouncement || null,
      eligible: eligible.length, required: Math.ceil(eligible.length * 0.8),
      approvals: eligible.filter((x) => this.removalVotes.has(x.id)).length,
      supported: !!p && this.removalVotes.has(p.id),
      canVote: !!p && eligible.includes(p) && !this.judgeVacant,
      volunteered: !!p && this.judgeVolunteers.has(p.id),
      canVolunteer: !!p && eligible.includes(p) && !p.judgeRetired,
    };
  };
  Room.prototype.appointJudge = function (p, reason) {
    if (!p || p.isBot || p.left || p.sockets <= 0) return { ok: false, error: 'Choose a connected human participant.' };
    const previous = this.players.get(this.judgeParticipantId);
    if (previous) { previous.isJudge = false; previous.spectator = true; previous.judgeRetired = true; }
    // Anyone who sees secrets must forfeit their normal player seat for this game.
    if (this.phase !== 'lobby' && p.alive && !p.spectator) this.kill(p, 'judgeAppointment');
    p.isJudge = true; p.spectator = true;
    // End role-specific phone subscriptions too, including psychic and Mafia feeds.
    p.role = null; p.investigations = []; p.notes = []; p.privateScene = null; p.ghostMessage = null;
    delete this.settings.forcedRoles[p.id];
    this.judgeParticipantId = p.id;
    this.io.to(this.judgeChannel()).emit('judge:revoked');
    this.judgeKey = crypto.randomBytes(24).toString('hex');
    this.adminEpoch++;
    this.judgeVacant = false;
    this.removalVotes.clear(); this.judgeVolunteers.clear(); this.disasterPreview = null;
    this.judgeAnnouncement = `${p.name} is the Judge of ${this.settings.townName}. ${reason}`;
    this.addLog(this.judgeAnnouncement);
    if (!['lobby', 'gameover'].includes(this.phase)) this.afterJudgeChange();
    this.sync();
    return { ok: true };
  };
  Room.prototype.randomJudge = function () {
    if (this.phase !== 'lobby') return { ok: false, error: 'Random Judge selection is only available before gameplay.' };
    const candidates = this.eligibleVoters().filter((p) => !p.judgeRetired);
    if (!candidates.length) return { ok: false, error: 'A connected human must join first.' };
    return this.appointJudge(this.pick(candidates), 'Selected at random.');
  };
  Room.prototype.voteRemoveJudge = function (p) {
    if (!this.governanceView(p).canVote) return { ok: false, error: 'Only connected human participants may vote.' };
    this.removalVotes.add(p.id);
    this.checkJudgeRemoval(); this.sync();
    return { ok: true };
  };
  Room.prototype.checkJudgeRemoval = function () {
    if (this.judgeVacant || !this.removalVotes.size) return;
    const v = this.governanceView();
    if (!v.eligible || v.approvals < v.required) return;
    this.pause(); // works for both timed and open-ended phases
    this.judgeVacant = true;
    const old = this.players.get(this.judgeParticipantId);
    if (old) { old.isJudge = false; old.spectator = true; old.judgeRetired = true; }
    this.judgeParticipantId = null;
    this.io.to(this.judgeChannel()).emit('judge:revoked');
    this.judgeKey = crypto.randomBytes(24).toString('hex'); this.adminEpoch++;
    this.disasterPreview = null;
    this.judgeAnnouncement = `The Judge of ${this.settings.townName} was removed. Gameplay is paused. Volunteer in phone Settings to continue as Judge.`;
    this.addLog(this.judgeAnnouncement);
    this.sync();
    this.chooseReplacement();
  };
  Room.prototype.volunteerJudge = function (p, confirmed) {
    if (!confirmed || !this.eligibleVoters().includes(p) || p.judgeRetired) return { ok: false, error: 'Confirm that you will leave your player seat to access secrets.' };
    this.judgeVolunteers.add(p.id);
    this.chooseReplacement(); this.sync();
    return { ok: true };
  };
  Room.prototype.chooseReplacement = function () {
    if (!this.judgeVacant) return;
    const candidates = this.eligibleVoters().filter((p) => this.judgeVolunteers.has(p.id) && !p.judgeRetired);
    // Prefer observers and dead players; active volunteers explicitly forfeit their seat.
    const observers = candidates.filter((p) => p.spectator || !p.alive);
    if (candidates.length) this.appointJudge(this.pick(observers.length ? observers : candidates), 'Replacement appointed; use Resume when ready.');
  };
  Room.prototype.disaster = function ({ id, disaster, preview, confirmation }) {
    const p = this.players.get(id);
    if (['lobby', 'gameover'].includes(this.phase) || !p || !p.alive || p.spectator || p.left || !DISASTERS.includes(disaster)) return { ok: false, error: 'Choose a living player and a valid disaster during a game.' };
    if (preview) {
      this.disasterPreview = { id, disaster, nonce: crypto.randomBytes(16).toString('hex'), epoch: this.adminEpoch, phaseId: this.phaseId, expires: this.now() + 60000 };
      return { ok: true, confirmation: this.disasterPreview.nonce, name: p.name, disaster };
    }
    const d = this.disasterPreview;
    if (!d || confirmation !== d.nonce || id !== d.id || disaster !== d.disaster || d.epoch !== this.adminEpoch || d.phaseId !== this.phaseId || this.now() > d.expires) return { ok: false, error: 'Preview the event, then explicitly confirm this elimination.' };
    this.disasterPreview = null;
    // Pause while the intervention plays, so phase timers cannot consume its reveal.
    this.pause();
    this.kill(p, `judge:${disaster}`);
    this.winner = this.checkWinner();
    this.setCinematic({ type: 'disaster', scene: disaster, targetId: p.id });
    this.addLog(`Judge intervention: ${p.name} eliminated by ${disaster}.`);
    this.sync(); return { ok: true };
  };
};
