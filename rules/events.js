'use strict';
// Seasonal events the Judge can switch on for a game (settings.event).
//   bloodMoon: every third night the moon turns red and the Mafia strike twice
//   (a second victim even if they all agreed on one). Season XP is doubled (profiles.js).
module.exports = function install(Room) {
  const startNight = Room.prototype.startNight;
  Room.prototype.startNight = function () {
    startNight.call(this);
    if (this.phase !== 'night' || !this.night || this.settings.event !== 'bloodMoon' || this.day % 3 !== 0) return;
    this.night.bloodMoon = true;
    this.narration = { id: ++this.narrationSeq, text: '🌕 The moon rises blood red over the town. Tonight, the Mafia will strike twice.', key: 'bloodMoon', custom: true };
    this.addLog('🌕 Blood Moon: the Mafia kill twice tonight.');
    this.sync();
  };
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
