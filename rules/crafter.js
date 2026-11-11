'use strict';
// The Crafter (Town). Searches for one material each night and once each day, crafts tools
// from a recipe book, and uses them:
//   Pickaxe (night)          break a window: learn the target's TRUE role at dawn (sees through disguises)
//   Lantern (night)          learn everyone who visited your house tonight
//   Magnifying Glass (night) learn every visit that happened tonight
//   Sword (day)              strike one player down on the spot (anonymously)
// Night tools ride on the Crafter's normal night action (kind 'craft'): tapping someone
// without a tool is just cover, like a Villager's tap. Everything is checked here.
const R = require('../public/shared/roles');
const K = require('../public/shared/crafting');
const { ROLES } = R;

module.exports = function install(Room) {
  const isCrafter = (p) => p && p.role === 'crafter';
  const running = (room) => !['lobby', 'draft', 'roleReveal', 'gameover'].includes(room.phase);
  const st = (p) => (p.craft = p.craft || { materials: {}, tools: {}, nightSearch: -1, daySearch: -1, finds: [] });

  // Night tools resolve with everything else at dawn (information stage: after attacks, so
  // the visits are complete). A roleblocked Crafter's tool is not spent.
  Object.assign(Room.prototype.nightHandlers, {
    craft: { stage: 'information', run(a, c) {
      const p = this.players.get(a.actorId), tool = (a.metadata || {}).tool, s = p && st(p);
      if (!p || !tool || !K.RECIPES[tool] || !(s.tools[tool] > 0)) return;
      s.tools[tool]--;
      if (tool === 'pickaxe') {
        const t = this.players.get(a.targetId); if (!t) return;
        const result = t.role; // the one check that sees through disguises, frames and cover roles (and is never corrupted)
        p.investigations.push({ night: this.day, targetId: t.id, name: t.name, reveal: 'role', result, by: 'pickaxe' });
        p.notes.push({ day: this.day, text: `⛏️ You broke ${t.name}'s window. Inside: the ${(ROLES[result] || {}).name || result}.` });
      } else if (tool === 'lantern') {
        const names = [...new Set(this.computeVisits(c.alive, c.acts, c.blocked, c.attacks, c.defs).filter((x) => x.targetId === p.id && x.actorId !== p.id).map((x) => this.nameOf(x.actorId)))];
        p.notes.push({ day: this.day, text: `🏮 Your lantern burned all night. Visitors at your door: ${names.length ? names.join(', ') : 'nobody'}.` });
      } else if (tool === 'magnifier') {
        const visits = this.computeVisits(c.alive, c.acts, c.blocked, c.attacks, c.defs).filter((x) => x.actorId !== p.id).map((x) => `${this.nameOf(x.actorId)} → ${this.nameOf(x.targetId)}`);
        p.notes.push({ day: this.day, text: `🔍 Through your magnifying glass you watched the whole night: ${visits.length ? [...new Set(visits)].join(', ') : 'nobody left their house'}.` });
      }
      this.audit('crafter.use', { actorId: p.id, tool, targetId: a.targetId });
    } },
  });

  const startGame = Room.prototype.startGame;
  Room.prototype.startGame = function () {
    const r = startGame.call(this);
    if (r && r.ok) for (const p of this.inGame().filter(isCrafter)) { p.craft = null; st(p); }
    return r;
  };

  const canSearch = (room, p) => {
    const s = st(p);
    if (room.phase === 'night') return s.nightSearch !== room.day;
    if (K.DAY_SEARCH.includes(room.phase)) return s.daySearch !== room.day;
    return false;
  };
  const toolReady = (room, p, tool) => {
    const r = K.RECIPES[tool], s = st(p);
    if (!r || !(s.tools[tool] > 0)) return false;
    return r.when === 'night' ? room.phase === 'night' && !!room.night : K.DAY_USE.includes(room.phase);
  };

  // The Crafter's private workshop view.
  Room.prototype.crafterView = function (p) {
    if (!isCrafter(p) || p.spectator || !p.alive || !running(this)) return null;
    const s = st(p), armed = this.phase === 'night' && this.night && ((this.night.metadata || {})[p.id] || {}).tool || null;
    return {
      materials: { ...s.materials }, tools: { ...s.tools }, finds: s.finds.slice(-4),
      canSearch: canSearch(this, p) && !this.paused, searchWhen: this.phase === 'night' ? 'tonight' : 'today',
      recipes: Object.keys(K.RECIPES).map((id) => ({ id, canCraft: K.canCraft(s.materials, id) })),
      ready: Object.keys(K.RECIPES).filter((id) => toolReady(this, p, id) && !this.paused),
      armed, armedTarget: armed ? this.night.actions[p.id] || null : null,
      targets: this.alive().filter((x) => x.id !== p.id).map((x) => x.id),
    };
  };
  const playerView = Room.prototype.playerView;
  Room.prototype.playerView = function (p) {
    const v = playerView.call(this, p);
    const c = this.crafterView(p); if (c) v.crafter = c;
    return v;
  };

  Room.prototype.crafterAction = function (p, msg = {}) {
    const fail = (error) => ({ ok: false, error });
    if (!isCrafter(p) || !p.alive || p.spectator || !running(this)) return fail('Only a living Crafter can do that.');
    if (this.paused) return fail('The game is paused.');
    const s = st(p), target = msg.targetId ? this.players.get(String(msg.targetId)) : null;
    const validTarget = target && target.alive && !target.spectator && !target.left && target.id !== p.id;
    switch (msg.op) {
      case 'search': {
        if (!canSearch(this, p)) return fail(this.phase === 'night' ? 'You already searched tonight.' : K.DAY_SEARCH.includes(this.phase) ? 'You already searched today.' : 'You can search at night and once during the day.');
        if (this.phase === 'night') s.nightSearch = this.day; else s.daySearch = this.day;
        const m = K.findMaterial(() => this.rng());
        s.materials[m] = (s.materials[m] || 0) + 1;
        s.finds.push({ day: this.day, material: m, night: this.phase === 'night' });
        this.audit('crafter.search', { actorId: p.id, material: m });
        this.touch(); this.sync();
        return { ok: true, found: m };
      }
      case 'craft': {
        const r = K.RECIPES[msg.recipe];
        if (!r) return fail('Unknown recipe.');
        if (!K.canCraft(s.materials, msg.recipe)) return fail(`Not enough materials for the ${r.name}.`);
        for (const [m, n] of Object.entries(r.needs)) s.materials[m] -= n;
        s.tools[msg.recipe] = (s.tools[msg.recipe] || 0) + 1;
        this.audit('crafter.craft', { actorId: p.id, recipe: msg.recipe });
        this.touch(); this.sync();
        return { ok: true, crafted: msg.recipe };
      }
      case 'use': {
        const tool = msg.tool, r = K.RECIPES[tool];
        if (!r) return fail('Unknown tool.');
        if (!(s.tools[tool] > 0)) return fail(`Craft a ${r.name} first.`);
        if (!toolReady(this, p, tool)) return fail(r.when === 'night' ? `The ${r.name} is used at night.` : `The ${r.name} is used during the day (discussion or voting).`);
        if (r.target === 'others' && !validTarget) return fail('Choose a living player.');
        if (r.when === 'night') { // ride on tonight's action: resolves at dawn
          this.night.metadata = this.night.metadata || {};
          this.night.metadata[p.id] = { tool };
          if (!(p.id in this.night.actions)) this.night.order.push(p.id);
          this.night.actions[p.id] = r.target === 'self' ? p.id : target.id;
          this.audit('crafter.arm', { actorId: p.id, tool, targetId: this.night.actions[p.id] });
        } else { // the sword: on the spot
          s.tools[tool]--;
          this.crafterStrike(p, target);
        }
        this.touch(); this.sync();
        return { ok: true };
      }
      case 'disarm':
        if (this.phase === 'night' && this.night && this.night.metadata) delete this.night.metadata[p.id];
        this.touch(); this.sync();
        return { ok: true };
      default: return fail('Unknown Crafter action.');
    }
  };

  // The sword: death on the spot during the day, with its own scene. The Crafter stays anonymous.
  Room.prototype.crafterStrike = function (p, target) {
    if (this.votes) { delete this.votes[target.id]; for (const [k, t] of Object.entries(this.votes)) if (t === target.id) delete this.votes[k]; }
    this.kill(target, 'crafter');
    const role = this.settings.revealRoleOnDeath ? ` ${this.roleSentence ? this.roleSentence(target) : `They were the ${ROLES[target.role].name}.`}` : '';
    this.narrate('crafterStrike', { name: target.name, role: role.startsWith(' ') ? role : ' ' + role });
    this.appendStories([{ scene: 'headhunt', targetId: target.id, title: 'A CRAFTED BLADE', sub: `${target.name}${role}` }]);
    this.addLog(`${p.name} (Crafter) struck down ${target.name} with a crafted sword.`, true);
    this.audit('crafter.sword', { actorId: p.id, targetId: target.id });
    this.winner = this.winner || this.checkWinner();
    if (this.winner) { this.storyTerminal = true; this.finishSoon(12000); }
  };

  // Bot Crafters: search whenever they can, craft what they can, and use night tools.
  const startNight = Room.prototype.startNight;
  Room.prototype.startNight = function () {
    startNight.call(this);
    if (this.phase !== 'night' || !this.night) return;
    for (const p of this.alive().filter((x) => isCrafter(x) && x.isBot)) {
      this.crafterAction(p, { op: 'search' });
      for (const id of ['magnifier', 'pickaxe', 'lantern']) if (K.canCraft(st(p).materials, id)) this.crafterAction(p, { op: 'craft', recipe: id });
      const tool = ['pickaxe', 'magnifier', 'lantern'].find((id) => st(p).tools[id] > 0);
      const targets = this.alive().filter((x) => x.id !== p.id);
      if (tool && targets.length) this.crafterAction(p, { op: 'use', tool, targetId: this.pick(targets).id });
    }
  };
};
