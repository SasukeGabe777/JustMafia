'use strict';
// End-of-game "movie credits": the cast (who was who and how their story ended), awards,
// the game in numbers, and a few highlights the TV replays as cinematics. Built only at
// game over (when secrets no longer matter) from the same records as the Rundown.
const R = require('../public/shared/roles');
const T = require('../public/shared/themes');

module.exports = function install(Room) {
  Room.prototype.credits = function () {
    if (this.phase !== 'gameover') return null;
    if (this.creditsCache && this.creditsCache.gameId === this.gameId) return this.creditsCache.data;
    const theme = this.settings.theme, everyone = this.inGame();
    const roleOf = (p) => p.originalRole || p.role;
    const roleName = (p) => T.roleName(theme, roleOf(p), (R.ROLES[roleOf(p)] || {}).name || roleOf(p));
    const teamOf = (p) => (R.ROLES[roleOf(p)] || {}).team || 'town';
    const log = this.eventLog || [], nights = log.filter((e) => e.kind === 'resolution.summary');
    const votes = this.voteHistory || [];
    const CAUSE = { mafia: 'taken by the Mafia', serialKiller: 'taken by the Serial Killer', vigilante: 'shot by a Vigilante', veteran: 'caught visiting a Veteran', vote: 'voted out', headhunter: 'taken by the Headhunter', crafter: 'struck by a crafted sword', heartbreak: 'died of a broken heart', explosion: 'caught in an explosion', ash: 'turned to ash', guarding: 'died guarding someone', judge: 'removed by the Judge', left: 'left the game' };
    const fate = (p) => p.alive ? (p.won ? 'Survived and won' : 'Survived') : `${CAUSE[p.deathCause] || 'died'}${p.diedDay != null ? (p.deathCause === 'vote' ? ` on day ${p.diedDay}` : ` on night ${p.diedDay}`) : ''}`;
    const cast = everyone.slice().sort((a, b) => (a.alive === b.alive ? (a.deathOrder || 0) - (b.deathOrder || 0) : a.alive ? 1 : -1))
      .map((p) => ({ id: p.id, name: p.name, avatar: p.avatar, role: roleOf(p), roleName: roleName(p), team: teamOf(p), alive: p.alive, won: !!p.won, fate: fate(p) }));

    // Counts from the records.
    const accused = {}, wrongVotes = {}, kills = {};
    for (const day of votes) for (const v of day.votes || []) {
      if (v.targetId === 'skip') continue;
      accused[v.targetId] = (accused[v.targetId] || 0) + 1;
      const t = this.players.get(v.targetId);
      if (t && teamOf(t) === 'town' && day.eliminatedId === v.targetId) wrongVotes[v.voterId] = (wrongVotes[v.voterId] || 0) + 1;
    }
    for (const n of nights) for (const a of n.actions || []) if ((a.ability === 'kill' || a.ability === 'shoot') && (n.outcomes || []).some((e) => e.type === 'kill' && e.targetId === a.targetId)) kills[a.actorId] = (kills[a.actorId] || 0) + 1;
    const top = (map, filter = () => true) => { const best = Object.entries(map).filter(([id, n]) => n > 0 && this.players.get(id) && filter(this.players.get(id))).sort((a, b) => b[1] - a[1])[0]; return best ? { p: this.players.get(best[0]), n: best[1] } : null; };
    const metric = (key) => top(Object.fromEntries(everyone.map((p) => [p.id, (p.metrics || {})[key] || 0])));
    // MVP: winners who did the most (saves, correct reads, kills for their side, surviving).
    const mvpScore = (p) => (p.won ? 10 : 0) + ((p.metrics || {}).saves || 0) * 4 + ((p.metrics || {}).correctInvestigations || 0) * 4 + (kills[p.id] || 0) * 3 + ((p.metrics || {}).abilities || 0) + (p.alive ? 3 : 0);
    const mvp = everyone.slice().sort((a, b) => mvpScore(b) - mvpScore(a))[0];
    const award = (emoji, label, x, detail) => (x ? { emoji, label, id: x.p.id, name: x.p.name, detail: detail(x) } : null);
    const firstDead = everyone.filter((p) => !p.alive && p.deathCause !== 'left').sort((a, b) => a.deathOrder - b.deathOrder)[0];
    const lastStanding = everyone.filter((p) => p.alive);
    const sneaky = everyone.filter((p) => teamOf(p) === 'mafia' && p.alive && !accused[p.id])[0];
    const awards = [
      mvp ? { emoji: '🏆', label: 'Most Valuable Player', id: mvp.id, name: mvp.name, detail: roleName(mvp) } : null,
      award('💖', 'Lifesaver', metric('saves'), (x) => `${x.n} save${x.n > 1 ? 's' : ''}`),
      award('🔍', 'Sharpest Mind', metric('correctInvestigations'), (x) => `${x.n} Mafia found`),
      award('🗡', 'Deadliest', top(kills), (x) => `${x.n} kill${x.n > 1 ? 's' : ''}`),
      award('😇', 'Innocent but Accused', top(accused, (p) => teamOf(p) === 'town'), (x) => `${x.n} votes against them`),
      award('🙈', 'Worst Vote', top(wrongVotes), (x) => `helped vote out ${x.n} Town member${x.n > 1 ? 's' : ''}`),
      sneaky ? { emoji: '🕶', label: 'Never Caught', id: sneaky.id, name: sneaky.name, detail: `${roleName(sneaky)}, never once voted for` } : null,
      firstDead ? { emoji: '🩸', label: 'First Blood', id: firstDead.id, name: firstDead.name, detail: fate(firstDead) } : null,
      lastStanding.length === 1 ? { emoji: '🧍', label: 'Last One Standing', id: lastStanding[0].id, name: lastStanding[0].name, detail: roleName(lastStanding[0]) } : null,
    ].filter(Boolean);

    const saves = nights.reduce((n, e) => n + (e.outcomes || []).filter((o) => o.type === 'saved' || o.type === 'guarded').length, 0);
    const nightKills = nights.reduce((n, e) => n + (e.outcomes || []).filter((o) => o.type === 'kill').length, 0);
    const mostAccused = top(accused);
    const stats = [
      `${this.day} day${this.day === 1 ? '' : 's'} and nights in ${this.settings.townName}`,
      `${nightKills} killed in the dark, ${votes.filter((v) => v.eliminatedId).length} voted out`,
      `${saves} life${saves === 1 ? '' : 's'} saved`,
      mostAccused ? `${mostAccused.p.name} drew ${mostAccused.n} vote${mostAccused.n > 1 ? 's' : ''}${teamOf(mostAccused.p) === 'town' ? ' and was innocent' : ' and was guilty'}` : null,
    ].filter(Boolean);

    // Highlights the TV replays: the first kill, the best save, the last kill.
    const kill = [], save = [];
    for (const n of nights) for (const o of n.outcomes || []) { const p = this.players.get(o.targetId); if (!p) continue; if (o.type === 'kill') kill.push({ type: 'kill', targetId: p.id, night: n.day, title: `Night ${n.day}: ${p.name} falls` }); if (o.type === 'saved' && !o.immune) save.push({ type: 'saved', targetId: p.id, night: n.day, title: `Night ${n.day}: ${p.name} is saved` }); }
    const highlights = [kill[0], save[0], kill.length > 1 ? kill[kill.length - 1] : null].filter(Boolean).slice(0, 3);

    const W = R.WINNERS[this.winner] || R.WINNERS.draw;
    const data = { winner: this.winner, title: this.winner === 'draw' ? 'Nobody won' : `${this.winner === 'mafia' ? T.teamName(theme, 'mafia', W.name) : W.name} won`, town: this.settings.townName, cast, awards, stats, highlights };
    this.creditsCache = { gameId: this.gameId, data };
    return data;
  };
  const common = Room.prototype.common;
  Room.prototype.common = function () {
    const c = common.call(this);
    if (this.phase === 'gameover') c.credits = this.credits();
    return c;
  };
};
