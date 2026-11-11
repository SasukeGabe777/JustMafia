'use strict';
// Fate Cards in a room: Role Wish and Team Wish (set in the lobby, honored when cards are
// dealt) and Reroll (during the role reveal). The profile store owns the cards; a card is
// spent only when it actually takes effect.
const R = require('../public/shared/roles');
const { FATE } = require('../public/shared/cosmetics');
const { ROLES } = R;
// Roles a Reroll never lands on: they need pairs or setup at deal time.
const NO_REROLL = new Set(['telepath', 'impostor', 'headhunter', 'mafia', 'villager']);

module.exports = function install(Room) {
  const cards = (room, p) => (room.profiles && p.profileId ? (room.profiles.view(p.profileId) || {}).fateCards || {} : {});

  // Lobby: wish for a role or a team (one wish per player; replace or clear any time before Start).
  Room.prototype.setWish = function (p, { type, value } = {}) {
    if (this.phase !== 'lobby') return { ok: false, error: 'Wishes are made in the lobby, before the game starts.' };
    this.wishes = this.wishes || {};
    if (!type) { delete this.wishes[p.id]; this.sync(); return { ok: true }; }
    if (type === 'role' && !(cards(this, p).wish > 0)) return { ok: false, error: 'You need a Role Wish card (Shop → Fate).' };
    if (type === 'team' && !(cards(this, p).team > 0)) return { ok: false, error: 'You need a Team Wish card (Shop → Fate).' };
    if (type === 'role' && (!ROLES[value] || value === 'villager')) return { ok: false, error: 'Choose a role to wish for.' };
    if (type === 'team' && !['town', 'mafia'].includes(value)) return { ok: false, error: 'Choose Town or Mafia.' };
    if (!['role', 'team'].includes(type)) return { ok: false, error: 'Unknown wish.' };
    this.wishes[p.id] = { type, value };
    this.sync();
    return { ok: true };
  };

  // Dealing: honor wishes (in a fair random order) before shuffling the rest.
  Room.prototype.applyWishes = function (free, pool) {
    const wishes = this.wishes || {}, granted = [];
    for (const p of this.shuffle(free.filter((x) => wishes[x.id]))) {
      const w = wishes[p.id];
      const idx = w.type === 'role' ? pool.indexOf(w.value) : pool.findIndex((r) => (ROLES[r] || {}).team === w.value);
      if (idx < 0) continue;
      p.role = pool[idx]; pool.splice(idx, 1); free.splice(free.indexOf(p), 1);
      granted.push({ p, card: w.type === 'role' ? 'wish' : 'team' });
    }
    this.wishes = {};
    for (const { p, card } of granted) {
      if (this.profiles && p.profileId) this.profiles.useFate(p.profileId, card);
      p.notes.push({ day: 0, text: `✦ Your ${FATE.cards[card].name} came true.` });
    }
    return granted;
  };

  // Reroll: during the role reveal, swap your role for another on the same team.
  Room.prototype.rerollRole = function (p) {
    if (this.phase !== 'roleReveal') return { ok: false, error: 'Reroll while you look at your dealt role.' };
    if (p.rerolled) return { ok: false, error: 'You already rerolled this game.' };
    if (!(cards(this, p).reroll > 0)) return { ok: false, error: 'You need a Reroll card (Shop → Fate).' };
    const team = (ROLES[p.role] || {}).team, n = this.inGame().length;
    const D = require('../public/shared/draft');
    const options = Object.keys(ROLES).filter((k) => k !== p.role && !NO_REROLL.has(k) && ROLES[k].team === team && (!D.META[k] || n >= D.META[k].min)
      && !(ROLES[k].max && (this.composition[k] || 0) >= ROLES[k].max) && !(team === 'mafia' && ROLES[p.role].night && ROLES[p.role].night.kind === 'kill' && !(ROLES[k].night && ROLES[k].night.teamKill)));
    if (!options.length) return { ok: false, error: 'No other role on your team fits this game.' };
    const next = this.pick(options), was = p.role;
    this.composition[was] = Math.max(0, (this.composition[was] || 1) - 1); if (!this.composition[was]) delete this.composition[was];
    this.composition[next] = (this.composition[next] || 0) + 1;
    p.role = next; p.originalRole = next; p.rerolled = true; p.flipped = false;
    if (next === 'vigilante') p.shotsLeft = Math.max(1, Number(this.settings.vigilanteShots) || 1);
    if (this.profiles && p.profileId) this.profiles.useFate(p.profileId, 'reroll');
    p.notes.push({ day: 0, text: `🔄 Fate rerolled your role: you are now the ${ROLES[next].name}.` });
    this.audit('fate.reroll', { actorId: p.id, from: was, to: next });
    this.sync();
    return { ok: true, role: next };
  };

  const playerView = Room.prototype.playerView;
  Room.prototype.playerView = function (p) {
    const v = playerView.call(this, p);
    if (!p.spectator && ['lobby', 'roleReveal'].includes(this.phase) && this.profiles && p.profileId) {
      const c = cards(this, p);
      v.fate = { cards: { wish: c.wish || 0, team: c.team || 0, reroll: c.reroll || 0 }, wish: (this.wishes || {})[p.id] || null, canReroll: this.phase === 'roleReveal' && !p.rerolled && (c.reroll || 0) > 0 };
    }
    return v;
  };
};
