'use strict';
const { REWARDS } = require('../public/shared/cosmetics');
// End-of-game gold. The server decides eligibility and amounts (profiles.award),
// pays each profile once per game id, and gives each phone only its own result.
module.exports = function install(Room) {
  // Why a finished game pays nothing (anti-farming); null when it is eligible.
  Room.prototype.rewardBlocker = function (players) {
    const humans = new Set(players.filter((p) => !p.isBot && p.profileId).map((p) => p.profileId));
    const minMs = process.env.MT_REWARD_MIN_MS != null ? Number(process.env.MT_REWARD_MIN_MS) : REWARDS.minimumGameMs; // tests only
    if (players.some((p) => p.isBot)) return 'Games with test bots don’t pay gold.';
    if (humans.size < 3) return 'Gold needs at least 3 players on their own phones.';
    if (Object.keys(this.settings.forcedRoles).length) return 'Games with hand-picked roles don’t pay gold.';
    if (this.settings.speed !== 1 || this.settings.skipCinematics) return 'Sped-up games don’t pay gold.';
    if (this.now() - this.startedAt < minMs) return `Games shorter than ${Math.round(minMs / 1000)} seconds don’t pay gold.`;
    return null;
  };
  Room.prototype.settleProgression = function () {
    if (!this.profiles || this.rewarded) return;
    this.rewarded = true;
    const players = this.inGame(), blocker = this.rewardBlocker(players);
    this.rewardResults = {};
    this.progressionNotice = blocker ? 'Practice game: no gold this time. ' + blocker : 'Gold paid to everyone’s pouch.';
    for (const p of players) {
      if (!p.profileId || p.isBot) continue;
      const paid = blocker ? null : this.profiles.award(p.profileId, this.gameId, { won: p.won, alive: p.alive, role: p.originalRole, team: this.team(p), metrics: p.metrics, event: this.settings.event, theme: this.settings.theme });
      const balance = (this.profiles.view(p.profileId) || {}).coins || 0;
      this.rewardResults[p.id] = paid
        ? { gameId: this.gameId, eligible: true, coins: paid.coins, before: paid.before, after: paid.after, lines: paid.lines, capped: paid.capped, world: paid.world || null }
        : { gameId: this.gameId, eligible: false, reason: blocker || 'Already rewarded.', coins: 0, before: balance, after: balance, lines: [] };
    }
    this.sync();
  };
  const end = Room.prototype.endGame;
  Room.prototype.endGame = function () { if (this.phase === 'gameover') return; end.call(this); this.settleProgression(); };
  const view = Room.prototype.playerView;
  Room.prototype.playerView = function (p) {
    const v = view.call(this, p);
    v.progression = this.profiles && p.profileId ? this.profiles.view(p.profileId) : null;
    if (this.phase === 'gameover') { v.progressionNotice = this.progressionNotice; v.reward = (this.rewardResults || {})[p.id] || null; }
    return v;
  };
};
