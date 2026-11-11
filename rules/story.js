'use strict';
// Story context for a death: the public facts that make it personal, so the TV scene
// and the narrator can tell *this* death differently from the last one.
//
// Only public information is ever used: who lives together (house signs), how many
// remain, deaths so far, gallows defenders (they chose to be seen), and, only when
// votes are public, whom the victim voted for and whether the town nearly hanged them.
// Never roles, never night actions, never anything a phone keeps secret.

module.exports = function install(Room) {
  // deaths: how many die in the same moment (night victims are applied at dawn).
  Room.prototype.storyContext = function (p, { deaths = 1, execution = false } = {}) {
    if (!p) return null;
    const S = {};
    const players = this.inGame(), alive = players.filter((x) => x.alive);
    const aliveAfter = Math.max(0, alive.length - (execution ? 0 : deaths) - (execution && p.alive ? 1 : 0));
    S.alive = aliveAfter;
    if (players.filter((x) => !x.alive && x.id !== p.id).length === 0) S.first = true;
    if (aliveAfter > 0 && aliveAfter <= 5) S.late = true;
    // A housemate who will wake up to it (house signs show who lives together).
    const home = this.homeSlot(p);
    const mate = alive.find((x) => x.id !== p.id && this.homeSlot(x) === home);
    if (mate) S.roommate = mate.name;
    // Yesterday at the gallows: defenders are public by their own choice.
    // (Night N follows day N-1's vote; an execution on day N looks back at day N-1 too.)
    const day = this.day - 1;
    const ex = (this.eventLog || []).filter((e) => e.kind === 'execution.resolved' && e.day === day).pop();
    if (ex && (ex.defenders || []).includes(p.id)) { const c = this.players.get(ex.condemnedId); if (c && c.id !== p.id) S.defended = c.name; }
    // Votes (only when the town sees who voted for whom).
    if (!this.settings.anonymousVotes) {
      const vote = (this.voteHistory || []).filter((v) => v.day === day).pop();
      if (vote && !execution) {
        const mine = vote.votes.find((v) => v.voterId === p.id);
        const t = mine && mine.targetId !== 'skip' && this.players.get(mine.targetId);
        if (t && t.id !== p.id) S.accused = t.name;
        const against = vote.votes.filter((v) => v.targetId === p.id).length;
        if (against >= 2 && vote.eliminatedId !== p.id) S.nearly = true;
      }
    }
    // They had already survived an attack (the protection scene was public).
    if ((this.eventLog || []).some((e) => e.kind === 'resolution.summary' && e.day < this.day && (e.outcomes || []).some((o) => (o.type === 'saved' || o.type === 'guarded') && o.targetId === p.id))) S.survived = true;
    return S;
  };

  // One extra sentence for the dawn narration (the most personal fact wins).
  Room.prototype.storySentence = function (S) {
    if (!S) return '';
    if (S.roommate) return `${S.roommate} found them at dawn.`;
    if (S.defended) return `Only yesterday, they stood up for ${S.defended} at the gallows.`;
    if (S.nearly) return 'The town nearly hanged them yesterday. Someone decided not to wait.';
    if (S.accused) return `Yesterday they had accused ${S.accused}. Was that why?`;
    if (S.survived) return 'They had escaped death once before. Not twice.';
    return '';
  };
};
