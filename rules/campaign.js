'use strict';
// Campaign mode (Judge toggle): the next five games are chapters of one story. The narrator
// opens each chapter with a recap, the houses of last chapter's victims stay scarred, and the
// TV keeps the score (Town vs Mafia). After chapter five the campaign crowns its winner.
const CHAPTERS = 5;

module.exports = function install(Room) {
  const score = (c) => c.results.reduce((s, r) => { s[r.winner === 'town' ? 'town' : r.winner === 'mafia' ? 'mafia' : 'other']++; return s; }, { town: 0, mafia: 0, other: 0 });
  const startGame = Room.prototype.startGame;
  Room.prototype.startGame = function () {
    if (!this.settings.campaign) { this.campaign = null; return startGame.call(this); }
    if (!this.campaign || this.campaign.results.length >= CHAPTERS) this.campaign = { chapter: 0, results: [] };
    const last = this.campaign.results[this.campaign.results.length - 1];
    const r = startGame.call(this);
    if (!r || !r.ok) return r;
    const c = this.campaign; c.chapter = c.results.length + 1;
    // The scars of the last chapter: its victims' houses stay damaged.
    if (last) for (const p of this.inGame()) if (last.fallen.includes(p.name)) p.houseState = 'damaged';
    const s = score(c), town = this.settings.townName;
    const recap = !last ? `Chapter 1 of ${CHAPTERS}. Our story begins in ${town}.`
      : `Chapter ${c.chapter} of ${CHAPTERS}. Last time, ${last.winner === 'town' ? 'the town held on' : last.winner === 'mafia' ? 'the Mafia took the streets' : 'nobody truly won'}${last.firstBlood ? `, and ${last.firstBlood} was the first to fall` : ''}. ${last.fallen.length ? 'Their houses still bear the scars. ' : ''}The score: Town ${s.town}, Mafia ${s.mafia}.`;
    this.campaignIntro = recap;
    this.narration = { id: ++this.narrationSeq, text: recap, key: 'campaign', custom: true };
    this.addLog(`📖 ${recap}`);
    this.sync();
    return r;
  };
  const endGame = Room.prototype.endGame;
  Room.prototype.endGame = function () {
    const before = this.phase;
    const r = endGame.call(this);
    if (before === 'gameover' || this.phase !== 'gameover' || !this.campaign || !this.settings.campaign) return r;
    const c = this.campaign, cr = this.credits ? this.credits() : null;
    const fallen = this.inGame().filter((p) => !p.alive && p.deathCause !== 'left').map((p) => p.name);
    c.results.push({ chapter: c.chapter, winner: this.winner, firstBlood: cr && (cr.awards.find((a) => a.label === 'First Blood') || {}).name || null, mvp: cr && (cr.awards.find((a) => a.label === 'Most Valuable Player') || {}).name || null, fallen });
    if (c.results.length >= CHAPTERS) {
      const s = score(c), champ = s.town > s.mafia ? 'the Town' : s.mafia > s.town ? 'the Mafia' : 'nobody: it ends in a tie';
      const mvps = {}; for (const x of c.results) if (x.mvp) mvps[x.mvp] = (mvps[x.mvp] || 0) + 1;
      const star = Object.entries(mvps).sort((a, b) => b[1] - a[1])[0];
      this.narration = { id: ++this.narrationSeq, text: `📖 The campaign is over. After ${CHAPTERS} chapters, ${champ} wins the story of ${this.settings.townName} (Town ${s.town}, Mafia ${s.mafia}).${star ? ` The legend of the campaign: ${star[0]}.` : ''}`, key: 'campaignEnd', custom: true };
    }
    this.sync();
    return r;
  };
  const common = Room.prototype.common;
  Room.prototype.common = function () {
    const out = common.call(this);
    if (this.settings.campaign && this.campaign) { const s = score(this.campaign); out.campaign = { chapter: this.campaign.chapter, total: CHAPTERS, town: s.town, mafia: s.mafia, done: this.campaign.results.length >= CHAPTERS }; }
    return out;
  };
};
