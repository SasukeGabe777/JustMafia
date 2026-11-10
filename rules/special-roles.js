'use strict';
const { ROLES } = require('../public/shared/roles');
const C = require('../public/shared/config');
const clone = (v) => JSON.parse(JSON.stringify(v));
module.exports = function install(Room) {
  Room.prototype.activeAbilityConfig = function (p) {
    const variant = ((this.night || {}).variants || {})[p.id], stolen = p.stolenAbilities.find((a) => a.id === variant);
    return stolen ? stolen.restrictions : this.ruleConfig(p,p.copiedAbility ? p.copiedAbility.role : p.role);
  };
  Room.prototype.nightHandlers = {
    silence: { stage: 'statuses', run(a) {
      const p = this.players.get(a.actorId), target = this.players.get(a.targetId);
      if (!target || !target.alive) return;
      this.addStatus(target, 'silenced', { source: p.id, expiresDay: this.day + 1 }); this.consumeAbility(p, 'silence');
    } },
    bomb: { run(a) {
      const p = this.players.get(a.actorId), cfg = this.activeAbilityConfig(p), target = this.players.get(a.targetId);
      if (!target || !target.alive) return;
      const delay = Math.max(cfg.minDelay || 3, Math.min(cfg.maxDelay || 12, Number(a.metadata.delay) || cfg.minDelay || 3));
      this.scheduleEvent('explosion', target.id, delay, p.id); this.consumeAbility(p, 'bomb');
      p.notes.push({ day: this.day, text: `Fuse planted at ${target.name}'s home: at least ${delay} phase transitions.` });
      p.privateScene = { id: `plant:${this.day}:${p.id}`, scene: 'planting', targetId: target.id, night: this.day };
    } },
    hustle: { run(a) {
      const p = this.players.get(a.actorId), cfg = this.activeAbilityConfig(p);
      this.hustledDay = { day: this.day, fraction: cfg.fraction || 0.4, minSeconds: cfg.minSeconds || 15 };
      this.consumeAbility(p, 'hustle'); this.audit('hustler.shortened', { actorId: p.id, ...this.hustledDay });
    } },
    midas: { run(a) {
      const p = this.players.get(a.actorId), target = this.players.get(a.targetId);
      if (!target || !target.alive) return;
      this.addStatus(target, 'marked', { source: p.id, expiresDay: this.day + 1, data: { day: this.day } });
      p.potions.midas++; this.consumeAbility(p, 'midas');
    } },
    volatile: { run(a) {
      const p = this.players.get(a.actorId), target = this.players.get(a.targetId);
      if (!target || target.alive || target.ashes || target.id === p.id || this.team(target) !== 'mafia' || target.spectator || target.left) return;
      this.pendingRevivals = (this.pendingRevivals || []).concat({ targetId: target.id, source: p.id, canVote: this.ruleConfig(p).temporaryVoting });
      p.potions.volatile++; this.consumeAbility(p, 'volatile');
    } },
  };
  Room.prototype.delayedHandlers = {
    explosion(event) {
      const target = this.players.get(event.targetId); if (!target) return null;
      const alreadyDead = !target.alive; target.houseState = 'destroyed';
      if (target.alive && !target.spectator) this.kill(target, 'explosion');
      this.narrate('explosion', { name: target.name, empty: alreadyDead ? 'The house was already empty. The fuse did not care.' : 'One chair in the square is now empty.' });
      this.addLog(`${target.name}'s house exploded${alreadyDead ? ' after their death' : ''}.`);
      this.winner = this.winner || this.checkWinner(); this.storyTerminal = !!this.winner;
      return this.recordStory({ scene: 'explosion', targetId: target.id, title: 'THE FUSE HAS RUN OUT', sub: alreadyDead ? 'An empty house. An extremely committed bomb.' : `${target.name} was caught in the blast.` });
    },
  };
  const originalNightDef = Room.prototype.nightDef;
  Room.prototype.nightDef = function (p) {
    const variant = (this.night && this.night.variants || {})[p.id];
    const stolen = (p.stolenAbilities || []).find((a) => a.id === variant);
    const copied = p.copiedAbility;
    let def = stolen ? ROLES[stolen.role].night : copied ? ROLES[copied.role].night : originalNightDef.call(this, p);
    if (stolen && stolen.remaining === 0 || copied && copied.remaining === 0) return null;
    if (stolen || copied) def = def && { ...def, limited: false };
    if (p.role === 'alchemist' && !stolen) {
      const kind = variant === 'volatile' ? 'volatile' : 'midas', cfg = this.ruleConfig(p);
      if (p.potions[kind] >= cfg[kind + 'Uses']) return null;
      def = { kind, targets: kind === 'volatile' ? 'deadMafia' : 'others', optional: true };
    }
    if (!def) return null;
    const cfg = this.activeAbilityConfig(p);
    if (stolen && (this.day < cfg.minDay || stolen.lastDay != null && this.day - stolen.lastDay <= cfg.cooldown)) return null;
    if (!stolen && !copied && !def.teamKill && !this.abilityAvailable(p, def.kind)) return null;
    return { ...def, noRepeat: cfg.noRepeat == null ? def.noRepeat : cfg.noRepeat, targets: cfg.selfTarget && def.targets === 'others' ? 'any' : def.targets };
  };
  const originalTargets = Room.prototype.nightTargets;
  Room.prototype.nightTargets = function (p) {
    const def = this.nightDef(p);
    if (def && def.targets === 'deadMafia') return this.inGame().filter((x) => !x.alive && !x.ashes && x.id !== p.id && this.team(x) === 'mafia').map((x) => x.id);
    let targets = originalTargets.call(this, p);
    if (def && def.kind === 'heal' && !this.settings.doctorSelfProtect) targets = targets.filter((id) => id !== p.id);
    if (def && !this.activeAbilityConfig(p).selfTarget && def.targets === 'any' && !['hustle', 'interrupt'].includes(def.kind)) targets = targets.filter((id) => id !== p.id);
    return targets;
  };
  const originalAction = Room.prototype.nightAction;
  Room.prototype.nightAction = function (p, targetId, options = {}) {
    if (this.phase !== 'night' || this.paused && !options.force || !p.alive || p.spectator || p.left) return false;
    const previous = this.night.variants[p.id];
    if (options.variant) {
      const valid = options.variant === 'primary' || p.role === 'alchemist' && ['midas', 'volatile'].includes(options.variant) || (p.stolenAbilities || []).some((a) => a.id === options.variant && a.remaining !== 0);
      if (!valid) return false; this.night.variants[p.id] = options.variant;
    }
    const result = originalAction.call(this, p, targetId, options);
    if (result) this.night.metadata[p.id] = { delay: Math.max(3, Math.min(20, Math.floor(Number(options.delay) || 3))) };
    else this.night.variants[p.id] = previous;
    return result;
  };
  Room.prototype.chooseVariant = function (p, variant) {
    if (this.phase !== 'night' || !p.alive || p.spectator || this.paused) return { ok: false };
    const valid = variant === 'primary' || p.role === 'alchemist' && ['midas', 'volatile'].includes(variant) || p.stolenAbilities.some((a) => a.id === variant && a.remaining !== 0);
    if (!valid) return { ok: false, error: 'That ability is not yours.' };
    this.night.variants[p.id] = variant; delete this.night.actions[p.id]; this.sync(); return { ok: true };
  };
  Room.prototype.specialAction = function (p, msg = {}) {
    if (this.phase !== 'night' || !p.alive || p.spectator || p.left || this.paused) return { ok: false, error: 'This ability is unavailable.' };
    if (msg.op === 'mimic') {
      const cfg = this.ruleConfig(p);
      if (p.role !== 'jester' || cfg.behavior === 'classic' || p.mimicUsed || this.day < cfg.minDay || !C.COPYABLE.includes(msg.role)) return { ok: false, error: 'Choose an eligible active role once per game.' };
      p.mimicUsed = true; p.copiedAbility = { role: msg.role, kind: ROLES[msg.role].night.kind, originalOwner: null, remaining: 1, expiresDay: cfg.copyDuration === 'night' ? this.day : null };
      this.audit('jester.mimic', { actorId: p.id, ability: p.copiedAbility }); this.sync(); return { ok: true };
    }
    if (msg.op === 'interrupt' && p.role === 'storymaker' && this.abilityAvailable(p, 'interrupt') && !this.emergency) {
      this.consumeAbility(p, 'interrupt');
      this.emergency = { actorId: p.id, priorNight: this.night, remaining: this.endsAt ? Math.max(this.ms(5), this.endsAt - this.now()) : null, day: this.day };
      this.setCinematic({ type: 'stories', stories: [{ scene: 'crier', title: 'THE NARRATIVE HAS SHIFTED!', sub: 'AN IMMEDIATE VOTE MUST HAPPEN NOW!' }] });
      this.narrate('storymaker'); this.audit('emergency.started', { actorId: p.id });
      this.setPhase('emergencyIntro', this.ms(10)); return { ok: true };
    }
    return { ok: false, error: 'No available special action.' };
  };
  const kill = Room.prototype.kill;
  Room.prototype.kill = function (p, cause) {
    if (!p.alive) return;
    const mark = this.statuses(p).find((s) => s.type === 'marked');
    if (mark && mark.data.day === this.day && (cause === 'vote' || cause === 'explosion' || String(cause).startsWith('judge'))) {
      const recipient = this.alive().find((x) => this.team(x) === 'mafia' && x.id !== p.id);
      const def = ROLES[p.role] && ROLES[p.role].night;
      if (recipient && def && C.COPYABLE.includes(p.role)) {
        const cfg = this.ruleConfig(p), used = (p.actionUses || {})[def.kind] || 0;
        const remaining = def.kind === 'shoot' ? p.shotsLeft : cfg.uses ? Math.max(0, cfg.uses - used) : null;
        const stolen = { id: 'stolen-' + ++this.effectSeq, originalOwner: p.id, role: p.role, kind: def.kind, remaining, restrictions: clone(cfg) };
        recipient.stolenAbilities.push(stolen); this.audit('ability.stolen', { actorId: recipient.id, targetId: p.id, ability: stolen });
        const source = this.players.get(mark.source); if (source) source.metrics.objectives++;
        recipient.notes.push({ day: this.day, text: `Midas granted ${ROLES[p.role].name}'s active ability. Select it at night.` });
      }
    }
    if (this.emergency) this.withdrawChoices(p.id);
    kill.call(this, p, cause); p.statuses = []; p.copiedAbility = null;
  };
  const startNight = Room.prototype.startNight;
  Room.prototype.startNight = function () {
    const stories = [];
    for (const p of this.inGame()) if (p.alive && this.hasStatus(p, 'temporaryRevival')) {
      this.kill(p, 'ash'); p.ashes = true;
      stories.push({ scene: 'ash', targetId: p.id, title: 'BORROWED TIME', sub: `${p.name} turns to ash.` }); this.narrate('ash', { name: p.name });
    }
    if (stories.length && this.checkWinner()) {
      this.winner = this.checkWinner(); this.storyTerminal = true; this.setCinematic({ type:'stories',stories });
      return this.setPhase('ashFall',this.settings.narratorMode === 'human' ? null : this.ms(stories.length * 8));
    }
    startNight.call(this);
    if (stories.length) { this.setCinematic({ type: 'stories', stories }); this.storyHoldUntil = this.now() + this.ms(stories.length * 8); }
  };
  const startMorning = Room.prototype.startMorning;
  Room.prototype.startMorning = function () {
    const stories = [];
    for (const revival of this.pendingRevivals || []) {
      const p = this.players.get(revival.targetId);
      if (!p || p.alive || p.ashes || p.left) continue;
      this.revive(p); this.addStatus(p, 'temporaryRevival', { source: revival.source, data: { canVote: revival.canVote !== false } });
      this.narrate('volatile', { name:p.name });
      stories.push({ scene: 'revival', targetId: p.id, title: 'ONE MORE DAY', sub: `${p.name} returns on borrowed time.` });
      this.audit('volatile.revived', { targetId: p.id, source: revival.source });
    }
    this.pendingRevivals = []; startMorning.call(this); if (stories.length) this.appendStories(stories);
  };
  const startDiscussion = Room.prototype.startDiscussion;
  Room.prototype.startDiscussion = function () {
    if (this.hustledDay && this.hustledDay.day === this.day && !this.hustledDay.used) {
      this.hustledDay.used = true;
      this.shortenedDiscussion = Math.max(this.hustledDay.minSeconds, Math.round(this.settings.discussionSeconds * this.hustledDay.fraction));
      const normal = this.settings.discussionSeconds;
      this.settings.discussionSeconds = this.shortenedDiscussion; startDiscussion.call(this); this.settings.discussionSeconds = normal;
      this.narrate('hustler', { seconds: this.shortenedDiscussion });
      this.appendStories([{ scene: 'hustle', title: 'TIME IS RUNNING OUT', sub: `${this.shortenedDiscussion} seconds to discuss.` }]);
    } else startDiscussion.call(this);
  };
  const advance = Room.prototype.advance;
  Room.prototype.advance = function () {
    if (this.judgeVacant) return;
    if (this.storyTerminal && this.winner) { this.storyTerminal = false; return this.endGame(); }
    if (this.phase === 'emergencyIntro') return this.startVoting();
    if (this.phase === 'execution' && this.emergency && !this.winner) {
      const snapshot = this.emergency; this.emergency = null; this.night = snapshot.priorNight;
      this.audit('emergency.resumed'); return this.setPhase('night', snapshot.remaining);
    }
    return advance.call(this);
  };
};
