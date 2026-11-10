'use strict';
const { REWARDS } = require('../public/shared/cosmetics');
module.exports = function install(Room) {
  Room.prototype.settleProgression = function () {
    if (!this.profiles || this.rewarded) return;
    this.rewarded = true;
    const players = this.inGame(), identities = new Set(players.filter((p) => !p.isBot && p.profileId).map((p) => p.profileId));
    const eligible = identities.size >= 3 && !players.some((p) => p.isBot) && !Object.keys(this.settings.forcedRoles).length && this.settings.speed === 1 && !this.settings.skipCinematics && this.now() - this.startedAt >= REWARDS.minimumGameMs;
    this.progressionNotice = eligible ? 'Rewards saved to server profiles.' : 'Practice/short game: no coin rewards. Normal human games award at completion.';
    if (eligible) for (const p of players) this.profiles.award(p.profileId, this.gameId, { won: p.won, alive: p.alive, role: p.originalRole, team: this.team(p), metrics: p.metrics });
    this.sync();
  };
  const end = Room.prototype.endGame;
  Room.prototype.endGame = function () { if (this.phase === 'gameover') return; end.call(this); this.settleProgression(); };
  const view = Room.prototype.playerView;
  Room.prototype.playerView = function (p) { const v = view.call(this, p); v.progression = this.profiles && p.profileId ? this.profiles.view(p.profileId) : null; if (this.phase === 'gameover') v.progressionNotice = this.progressionNotice; return v; };
};
