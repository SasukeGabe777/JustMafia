'use strict';
// Career stats for every finished game (practice games included; gold has its own rules):
// history, per-role mastery, rivalries (who took you out, who you took out, who voted you)
// and awards from the credits. Also the TV's Hall of Fame for the players in the room.
const R = require('../public/shared/roles');

module.exports = function install(Room) {
  // Who killed whom this game: night kills (the actors whose kill/shot hit), day kills, the vote.
  Room.prototype.killMap = function () {
    const killers = new Map(); // victimId -> [killerIds]
    const add = (victim, killer) => { if (!victim || !killer || victim === killer) return; if (!killers.has(victim)) killers.set(victim, []); if (!killers.get(victim).includes(killer)) killers.get(victim).push(killer); };
    for (const e of this.eventLog || []) {
      if (e.kind === 'resolution.summary') {
        const died = new Set((e.outcomes || []).filter((o) => o.type === 'kill').map((o) => o.targetId));
        for (const a of e.actions || []) if (['kill', 'shoot'].includes(a.ability) && died.has(a.targetId)) add(a.targetId, a.actorId);
      }
      if (['crafter.sword', 'headhunter.strike', 'headhunter.execute'].includes(e.kind)) add(e.targetId, e.actorId);
    }
    return killers;
  };
  Room.prototype.recordCareers = function () {
    if (!this.profiles || this.careersRecorded === this.gameId) return;
    this.careersRecorded = this.gameId;
    const cr = this.credits ? this.credits() : null, killers = this.killMap(), everyone = this.inGame();
    const tag = (q) => ({ key: q.profileId ? 'p:' + q.profileId : 'n:' + q.name, name: q.name });
    for (const p of everyone) {
      if (!p.profileId || p.isBot) continue;
      const role = p.originalRole || p.role;
      const votedBy = [];
      for (const day of this.voteHistory || []) for (const v of day.votes || []) if (v.targetId === p.id && v.voterId !== p.id) { const q = this.players.get(v.voterId); if (q) votedBy.push(tag(q)); }
      this.profiles.recordGame(p.profileId, this.gameId, {
        at: Date.now(), theme: this.settings.theme, town: this.settings.townName, role, team: (R.ROLES[role] || {}).team || 'town', won: !!p.won, alive: !!p.alive, players: everyone.length,
        awards: cr ? cr.awards.filter((a) => a.id === p.id).map((a) => a.label) : [],
        killedBy: (killers.get(p.id) || []).map((id) => this.players.get(id)).filter(Boolean).map(tag),
        kills: [...killers.entries()].filter(([, ks]) => ks.includes(p.id)).map(([victim]) => this.players.get(victim)).filter(Boolean).map(tag),
        votedBy,
      });
    }
  };
  const end = Room.prototype.endGame;
  Room.prototype.endGame = function () { const before = this.phase; end.call(this); if (before !== 'gameover' && this.phase === 'gameover') this.recordCareers(); };

  // Hall of Fame (TV lobby): the players here, ranked by career wins.
  Room.prototype.hallOfFame = function () {
    if (!this.profiles) return [];
    return this.list().filter((p) => p.profileId && !p.isBot && !p.spectator).map((p) => {
      const c = (this.profiles.view(p.profileId) || {}).career; if (!c || !c.games) return null;
      return { name: p.name, games: c.games, wins: c.wins, mvps: (c.awards || {})['Most Valuable Player'] || 0, title: c.title || null };
    }).filter(Boolean).sort((a, b) => b.wins - a.wins || b.mvps - a.mvps || b.games - a.games).slice(0, 6);
  };
  const common = Room.prototype.common;
  Room.prototype.common = function () {
    const c = common.call(this);
    if (this.phase === 'lobby') c.hallOfFame = this.hallOfFame();
    return c;
  };
};
