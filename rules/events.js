'use strict';
// Seasonal events the Judge can switch on for a game (settings.event).
//   bloodMoon: every third night the moon turns red and the Mafia strike twice
//   (a second victim even if they all agreed on one). Season XP is doubled (profiles.js).
module.exports = function install(Room) {
  const startNight = Room.prototype.startNight;
  Room.prototype.startNight = function () {
    startNight.call(this);
    if (this.phase !== 'night' || !this.night) return;
    if (this.settings.event === 'surprises') return this.nightSurprise();
    if (this.settings.event !== 'bloodMoon' || this.day % 3 !== 0) return;
    this.night.bloodMoon = true;
    this.narration = { id: ++this.narrationSeq, text: '🌕 The moon rises blood red over the town. Tonight, the Mafia will strike twice.', key: 'bloodMoon', custom: true };
    this.addLog('🌕 Blood Moon: the Mafia kill twice tonight.');
    this.sync();
  };
  // Daily Surprises: from night 2, about half the nights bring one twist (never the same twice in a row).
  const SURPRISES = {
    fog: { text: '🌫 A thick fog rolls into {town}. Tonight, nobody can see who goes where.', log: '🌫 Fog: visit information is hidden tonight.' },
    festival: { text: '🎉 It’s festival night in {town}! Lanterns everywhere, music till dawn. Even the Mafia won’t risk a kill tonight.', log: '🎉 Festival: no Mafia kill tonight.' },
    bloodMoon: { text: '🌕 The moon rises blood red over {town}. Tonight, the Mafia will strike twice.', log: '🌕 Blood Moon: the Mafia kill twice tonight.' },
  };
  Room.prototype.nightSurprise = function () {
    if (this.day < 2 || this.rng() < 0.5) { this.lastSurprise = null; return; }
    const options = Object.keys(SURPRISES).filter((k) => k !== this.lastSurprise);
    const kind = this.pick(options); this.lastSurprise = kind;
    this.night[kind] = true; this.night.surprise = kind;
    this.narration = { id: ++this.narrationSeq, text: SURPRISES[kind].text.replace('{town}', this.settings.townName), key: 'surprise', custom: true };
    this.addLog(SURPRISES[kind].log);
    this.sync();
  };
  // Fog: nobody's visits can be seen (Lookout, Investigator, Paparazzi, Crafter's lantern and glass).
  const computeVisits = Room.prototype.computeVisits;
  Room.prototype.computeVisits = function (...args) { return this.night && this.night.fog ? [] : computeVisits.apply(this, args); };
  const resolveExtraTargets = Room.prototype.resolveExtraTargets;
  Room.prototype.resolveExtraTargets = function (picks, primary) {
    const out = resolveExtraTargets.call(this, picks, primary);
    if (!this.night || !this.night.bloodMoon) return out;
    // One more victim than usual: another Mafia pick if there is one, else a random non-Mafia.
    const others = [...new Set(picks.map((p) => p.targetId))].filter((id) => id !== primary && !out.includes(id));
    const pool = others.length ? others : this.alive().filter((x) => this.team(x) !== 'mafia' && x.id !== primary && !out.includes(x.id)).map((x) => x.id);
    if (pool.length) out.push(this.pick(pool));
    return out;
  };
};
