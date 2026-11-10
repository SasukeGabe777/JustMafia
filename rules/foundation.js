'use strict';
const C = require('../public/shared/config');
const { ROLES } = require('../public/shared/roles');
const DAY = ['morning', 'discussion', 'accusation', 'defense', 'voting', 'verdict', 'execution'];
module.exports = function install(Room) {
  Room.prototype.configureRules = function (input = {}) {
    if (this.phase !== 'lobby') return;
    const enums = { storytellerMode: ['classic', 'assisted', 'human'], misinformation: ['invert', 'plausible', 'judge', 'assisted'], assistance: ['gentle', 'dramatic'], mafiaDecision: ['plurality', 'legacy'], mafiaTie: ['none', 'random'], whisperTeam: ['any', 'townOnly', 'mafiaOnly'], votingMode: ['classic', 'nomination'] };
    const numbers = { mafiaExtraKills: [0, 2], mafiaBluffs: [0, 3], whispersPerDay: [0, 10], whisperLength: [20, 240], accusationSeconds: [5, 120], defenseSeconds: [5, 120], nominationsPerDay: [1, 5], nominationCooldown: [0, 120], nominationSeconds: [5, 120], nominationSecondsRequired: [0, 10] };
    for (const [k, choices] of Object.entries(enums)) if (choices.includes(input[k])) this.settings[k] = input[k];
    for (const [k, bounds] of Object.entries(numbers)) if (input[k] != null && Number.isFinite(Number(input[k]))) this.settings[k] = Math.max(bounds[0], Math.min(bounds[1], Math.floor(Number(input[k]))));
    for (const k of ['ghostVotes', 'ghostChat', 'whispers', 'judgeReadsWhispers', 'repeatNominations', 'nominationEndsDiscussion']) if (typeof input[k] === 'boolean') this.settings[k] = input[k];
    if (input.roleConfig && typeof input.roleConfig === 'object') {
      const next = {}; for (const [role, settings] of Object.entries(input.roleConfig)) if (ROLES[role]) next[role] = C.normalize(role, settings);
      this.settings.roleConfig = next;
    }
  };
  Room.prototype.ruleConfig = function (p, role) {
    const key = role || p.role, cfg = C.normalize(key, this.settings.roleConfig && this.settings.roleConfig[key]);
    if (cfg.mode === 'standard' && key === 'vigilante') cfg.uses = this.settings.vigilanteShots;
    if (cfg.mode === 'standard' && key === 'puppetMaster') cfg.uses = this.settings.puppetUses;
    if (cfg.mode === 'standard' && key === 'glitch') cfg.uses = this.settings.glitchUses;
    return cfg;
  };
  Room.prototype.appendStories = function (stories) {
    const previous = this.cinematic;
    const merge = previous && previous.type === 'stories' && (this.cinematicTurn === this.turn || this.phase === 'morning' && this.cinematicTurn === this.turn - 1);
    this.setCinematic({ type: 'stories', stories: (merge ? previous.stories : []).concat(stories) });
    this.storyHoldUntil = Math.max(this.now(),this.storyHoldUntil || 0) + this.ms(stories.length * 12);
  };
  Room.prototype.audit = function (kind, data = {}, visibility = 'judge') {
    this.eventLog = this.eventLog || [];
    const entry = { id: ++this.eventSeq, day: this.day, phase: this.phase, turn: this.turn || 0, kind, visibility, ...data };
    this.eventLog.push(entry); return entry;
  };
  Room.prototype.statuses = function (p) {
    return (p.statuses || []).filter((s) => (s.expiresTurn == null || s.expiresTurn > this.turn) && (s.expiresDay == null || this.day < s.expiresDay) && (!C.STATUS[s.type].dayOnly || DAY.includes(this.phase)));
  };
  Room.prototype.hasStatus = function (p, type) { return this.statuses(p).some((s) => s.type === type); };
  Room.prototype.addStatus = function (p, type, options = {}) {
    const def = C.STATUS[type]; if (!def || !p || p.spectator) return false;
    const status = { id: ++this.effectSeq, type, source: options.source || 'judge', start: this.turn || 0,
      startDay: this.day, expiresTurn: options.turns ? (this.turn || 0) + Math.max(1, Math.min(30, options.turns)) : null,
      expiresDay: options.expiresDay == null ? null : options.expiresDay, visibility: def.visibility,
      data: options.data || {} };
    p.statuses = (p.statuses || []).filter((s) => s.type !== type || s.source !== status.source).concat(status);
    this.audit('status.applied', { targetId: p.id, status }); return true;
  };
  Room.prototype.visibleStatuses = function (p, owner = false) {
    return this.statuses(p).filter((s) => s.visibility === 'public' || (owner && s.visibility === 'owner')).map((s) => ({ type: s.type, label: C.STATUS[s.type].label }));
  };
  Room.prototype.expireStatuses = function () {
    for (const p of this.list()) p.statuses = (p.statuses || []).filter((s) => {
      const keep = (s.expiresTurn == null || s.expiresTurn > this.turn) && (s.expiresDay == null || this.day < s.expiresDay);
      if (!keep) this.audit('status.expired', { targetId: p.id, type: s.type }); return keep;
    });
  };
  Room.prototype.information = function (actor, target, truth, type = 'boolean', alternatives) {
    const corrupt = this.statuses(actor).filter((s) => C.STATUS[s.type].information);
    let delivered = truth, reason = null;
    if (corrupt.length) {
      const legal = alternatives || (type === 'role' ? Object.keys(ROLES).filter((r) => r !== truth) : [!truth]);
      const override = (this.informationOverrides || {})[actor.id];
      reason = corrupt.map((s) => s.type).join(', ');
      if (this.settings.misinformation === 'judge' && override && legal.includes(override.result)) { delivered = override.result; delete this.informationOverrides[actor.id]; }
      else if (type === 'boolean' && this.settings.misinformation === 'invert') delivered = !truth;
      else {
        // Assistance only selects among legal false results, never changes truth, teams or deaths.
        const options = type === 'role' && this.settings.storytellerMode === 'assisted' && this.settings.assistance === 'gentle'
          ? legal.filter((r) => ROLES[r].team === ROLES[truth].team) : legal;
        delivered = this.pick(options.length ? options : legal);
      }
    }
    this.audit('information', { actorId: actor.id, targetId: target && target.id, trueResult: truth, deliveredResult: delivered, reason, type });
    return delivered;
  };
  Room.prototype.scheduleEvent = function (type, targetId, delay, source, payload = {}) {
    const event = { id: ++this.effectSeq, type, source, targetId, createdTurn: this.turn,
      triggerTurn: this.turn + Math.max(1, delay), visibility: 'judge', payload, resolved: false };
    this.scheduledEvents.push(event); this.audit('event.scheduled', { event }); return event;
  };
  Room.prototype.processScheduled = function () {
    if (!DAY.includes(this.phase)) return [];
    const stories = [];
    for (const e of this.scheduledEvents || []) {
      if (e.resolved || e.triggerTurn > this.turn) continue;
      e.resolved = true;
      const handler = this.delayedHandlers && this.delayedHandlers[e.type];
      if (handler) { const story = handler.call(this, e); if (story) stories.push(story); }
      this.audit('event.resolved', { eventId: e.id, targetId: e.targetId, type: e.type });
    }
    if (stories.length) this.appendStories(stories);
    return stories;
  };
  Room.prototype.canSpeak = function (p) { return !!p && p.alive && !p.left && !p.spectator && !this.paused && !this.hasStatus(p, 'silenced'); };
  Room.prototype.abilityAvailable = function (p, kind) {
    const cfg = this.ruleConfig(p), key = kind || (this.nightDef(p) || {}).kind;
    const used = (p.actionUses || {})[key] || 0, last = (p.actionDays || {})[key];
    return this.day >= cfg.minDay && (!cfg.uses || used < cfg.uses) && (!cfg.cooldown || last == null || this.day - last > cfg.cooldown);
  };
  Room.prototype.consumeAbility = function (p, kind) {
    p.metrics.abilities++;
    if (p.copiedAbility) p.mimicActed = true;
    p.actionUses[kind] = (p.actionUses[kind] || 0) + 1; p.actionDays[kind] = this.day;
    if (p.copiedAbility && p.copiedAbility.kind === kind && p.copiedAbility.remaining != null) p.copiedAbility.remaining--;
    const stolen = (p.stolenAbilities || []).find((a) => a.id === ((this.night || {}).variants || {})[p.id]);
    if (stolen) { stolen.lastDay = this.day; if (stolen.remaining != null) stolen.remaining--; }
  };
};
