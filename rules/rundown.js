'use strict';
// "Rundown of the game": the full story of who did what, built from the Judge-only
// event log and vote history. Only available once the game is over (when secrets no
// longer matter), and only when someone asks for it (TV or Judge button).
const R = require('../public/shared/roles');
const { THEMES } = require('../public/shared/themes');

module.exports = function install(Room) {
  Room.prototype.rundown = function () {
    if (this.phase !== 'gameover') return { ok: false, error: 'The rundown is available once the game is over.' };
    const theme = this.settings.theme, byId = (id) => this.players.get(id);
    const roleOf = (p) => p && (p.originalRole || p.role);
    const roleName = (p) => { const r = roleOf(p); return r ? ((THEMES[theme] && THEMES[theme].roleNames && THEMES[theme].roleNames[r]) || (R.ROLES[r] || {}).name || r) : '?'; };
    const who = (id) => { const p = byId(id); return p ? `${p.name} (${roleName(p)})` : 'someone who left'; };
    const name = (id) => (byId(id) || {}).name || 'someone';
    const VERB = { heal: 'protected', guard: 'stood guard over', investigate: 'investigated', spy: 'spied on', block: 'distracted', shoot: 'shot at', silence: 'silenced', bomb: 'planted a bomb at', photo: 'photographed', hustle: 'hustled', midas: 'used gold on', interrupt: 'interrupted the night for', mark: 'marked for death' };
    const chapters = [], log = this.eventLog || [];
    const days = Math.max(this.day, ...this.voteHistory.map((v) => v.day), 0);
    // Deaths the night/vote logs don't tell (Judge removals, players leaving, explosions...).
    const OTHER = { judge: 'was removed by the Judge', left: 'left the game', explosion: 'was caught in an explosion', ash: 'turned to ash', headhunter: 'was taken by the Headhunter' };
    const otherDeaths = (d, nightKilled) => this.inGame().filter((p) => !p.alive && p.diedDay === d && p.deathCause !== 'vote' && !nightKilled.has(p.id))
      .sort((a, b) => a.deathOrder - b.deathOrder).map((p) => `☠️ ${who(p.id)} ${OTHER[p.deathCause] || 'died'}.`);
    for (let d = 0; d <= days; d++) {
      // Night d: everyone's actions and what came of them.
      const night = log.filter((e) => e.kind === 'resolution.summary' && e.day === d).pop();
      if (night) {
        const lines = [], blocked = new Set(night.blocked || []);
        const team = (night.actions || []).filter((a) => a.teamAction && a.ability === 'kill');
        if (team.length) { const targets = [...new Set(team.map((a) => a.targetId))]; lines.push(`🔪 The Mafia (${[...new Set(team.map((a) => name(a.actorId)))].join(', ')}) went after ${targets.map(name).join(' and ')}.`); }
        for (const a of night.actions || []) {
          if (a.teamAction && a.ability === 'kill') continue;
          const v = a.ability === 'kill' ? 'attacked' : VERB[a.ability] || 'used their ability on';
          lines.push(`${a.ability === 'heal' || a.ability === 'guard' ? '🛡' : a.ability === 'investigate' || a.ability === 'spy' ? '🔍' : a.ability === 'block' ? '🛑' : a.ability === 'kill' || a.ability === 'shoot' ? '🗡' : '✨'} ${who(a.actorId)} ${v} ${a.targetId === a.actorId ? 'themselves' : name(a.targetId)}${blocked.has(a.actorId) ? ', but was distracted and it failed' : ''}.`);
        }
        for (const e of night.outcomes || []) {
          if (e.type === 'kill') lines.push(`💀 ${name(e.targetId)} was killed.`);
          else if (e.type === 'saved') lines.push(`✅ ${name(e.targetId)} was attacked but survived${e.immune ? ' (immune)' : ' (protected)'}.`);
          else if (e.type === 'guarded') lines.push(`🛡 ${name(e.targetId)} was saved by a bodyguard${e.guardDied ? ', who died in their place' : ''}.`);
        }
        if (!lines.length) lines.push('A quiet night. Nobody acted.');
        chapters.push({ title: `Night ${d}`, lines });
      }
      // Day d: the votes, and what happened at the gallows.
      const vote = this.voteHistory.filter((v) => v.day === d).pop();
      const extra = otherDeaths(d, new Set(((night && night.outcomes) || []).filter((e) => e.type === 'kill').map((e) => e.targetId)));
      if (!vote && extra.length) chapters.push({ title: d ? `Day ${d}` : 'Before the first night', lines: extra });
      if (vote) {
        const lines = [], tally = {};
        for (const v of vote.votes) (tally[v.targetId] = tally[v.targetId] || []).push(name(v.voterId));
        for (const [target, voters] of Object.entries(tally).sort((a, b) => b[1].length - a[1].length)) lines.push(`🗳 ${target === 'skip' ? 'Skip' : name(target)}: ${voters.length} vote${voters.length > 1 ? 's' : ''} (${voters.join(', ')})`);
        const ex = log.filter((e) => e.kind === 'execution.resolved' && e.day === d).pop();
        if (!vote.eliminatedId) lines.push('No one was voted out.');
        else if (ex && ex.interrupterId) lines.push(`🛑 ${who(ex.interrupterId)} secretly interrupted the execution of ${who(ex.condemnedId)}.`);
        else if (ex && ex.executionerId) lines.push(`🪓 ${name(ex.executionerId)} revealed themselves as the Executioner and died so ${who(ex.condemnedId)} could live.`);
        else if (ex && ex.guardId) lines.push(`🛡 ${who(ex.guardId)} took the place of ${who(ex.condemnedId)} at the gallows.`);
        else lines.push(`⚖️ ${who(vote.eliminatedId)} was executed.`);
        if (ex && ex.defenders && ex.defenders.length) lines.push(`🙅 Defended by ${ex.defenders.map(name).join(', ')}.`);
        if (ex && ex.lastWords) lines.push(`🪦 Last words: “${[ex.lastWords.name, ex.lastWords.word].filter(Boolean).join(' … ')}”`);
        lines.push(...extra);
        chapters.push({ title: `Day ${d}`, lines });
      }
    }
    // Who was who, and a few fun awards.
    const everyone = this.inGame();
    const cast = everyone.map((p) => ({ name: p.name, role: roleName(p), team: (R.ROLES[roleOf(p)] || {}).team || 'town', alive: p.alive, won: !!p.won }));
    const top = (key, label, emoji) => { const best = everyone.filter((p) => (p.metrics || {})[key] > 0).sort((a, b) => b.metrics[key] - a.metrics[key])[0]; return best ? { emoji, label, name: best.name, detail: `${best.metrics[key]}` } : null; };
    const sneaky = everyone.filter((p) => (R.ROLES[roleOf(p)] || {}).team === 'mafia' && p.alive)[0];
    const awards = [top('saves', 'Lifesaver', '💖'), top('correctInvestigations', 'Sharpest Detective', '🔍'), top('executionerSaves', 'Mercy at the Gallows', '🪓'), top('abilities', 'Busiest Night Owl', '🦉'),
      sneaky ? { emoji: '🕶', label: 'Never Caught', name: sneaky.name, detail: roleName(sneaky) } : null].filter(Boolean);
    const W = R.WINNERS[this.winner] || R.WINNERS.draw;
    return { ok: true, rundown: { winner: this.winner, headline: this.winner === 'draw' ? 'Nobody won.' : `${this.winner === 'mafia' && THEMES[theme] && THEMES[theme].teamNames ? THEMES[theme].teamNames.mafia : W.name} won!`, chapters, cast, awards } };
  };
};
