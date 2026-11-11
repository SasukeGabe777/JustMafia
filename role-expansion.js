'use strict';
const { GHOST_WORDS } = require('./public/shared/roles');

module.exports = function install(Room) {
  // The one visit list every visit-reading role uses (Lookout, Investigator, Paparazzi,
  // Crafter tools): who actually went to whose house tonight. A team kill counts as the one
  // Mafia member who carried it out; blocked players stayed home; acting on yourself
  // (a Doctor healing themselves, a Veteran on alert, a Crafter's lantern) is not a visit.
  Room.prototype.computeVisits = function (alive, acts, blocked, attacks, definitions) {
    const nightDef = (p) => definitions ? definitions.get(p.id) : this.nightDef(p);
    const visits = [];
    for (const p of alive) {
      const def = nightDef(p), targetId = acts[p.id];
      if (!def || !targetId || targetId === 'pass' || targetId === p.id || (blocked.has(p.id) && def.kind !== 'block') || def.kind === 'kill' || def.kind === 'shoot' || def.teamKill) continue;
      visits.push({ actorId: p.id, targetId, kind: def.kind });
    }
    for (const a of attacks) if (a.actorId && a.actorId !== a.targetId && !visits.some((v) => v.actorId === a.actorId && v.targetId === a.targetId)) visits.push({ actorId: a.actorId, targetId: a.targetId, kind: 'attack' });
    return visits;
  };
  Room.prototype.resolveObservations = function (alive, acts, blocked, attacks, definitions) {
    const nightDef = (p) => definitions ? definitions.get(p.id) : this.nightDef(p);
    const visits = this.computeVisits(alive, acts, blocked, attacks, definitions);
    this.night.visits = visits; // Judge-only; public views receive only redacted clues.
    for (const p of alive) {
      const def = nightDef(p), target = this.players.get(acts[p.id]);
      if (!def || !target) continue;
      if (def.kind === 'spy') {
        if (!blocked.has(p.id)) this.consumeAbility(p,'spy');
        if (!blocked.has(p.id)) this.stats.expansion.spyChecks++;
        const count = visits.filter((v) => v.targetId === target.id && v.actorId !== p.id).length;
        const departed = visits.some((v) => v.actorId === target.id);
        const truth = `${count === 0 ? 'Nobody else visited' : count === 1 ? 'One visitor arrived' : 'Multiple visitors arrived'}.${departed ? ' Someone departed this house.' : ''}`;
        const clue = blocked.has(p.id) ? null : this.information(p, target, truth, 'activity', ['Nobody else visited.', 'One visitor arrived.', 'Multiple visitors arrived.'].filter((s) => s !== truth));
        p.investigations.push({ night: this.day, targetId: target.id, name: target.name, blocked: blocked.has(p.id), clue: blocked.has(p.id) ? null : clue, reveal: 'activity' });
        this.addLog(`${p.name} spied on ${target.name}: ${blocked.has(p.id) ? 'blocked' : clue}`, true);
      }
      if (['investigate', 'spy'].includes(def.kind)) {
        p.privateScene = { id: `${this.day}:${p.id}`, scene: def.kind === 'spy' ? 'watcher' : 'investigation', targetId: target.id, night: this.day };
      }
      const went = visits.find((v) => v.actorId === target.id);
      if (def.kind === 'photo' && !blocked.has(p.id) && went) {
        this.consumeAbility(p,'photo');
        p.photoPending = { targetId: target.id, text: `${target.name} was photographed at ${this.nameOf(went.targetId)}'s house last night.` };
      }
    }
  };
  Room.prototype.recordStory = function (story) {
    this.publicStories = (this.publicStories || []).concat({ day: this.day, ...story }).slice(-30);
    return story;
  };
  Room.prototype.publishPhotos = function () {
    const stories = [];
    for (const p of this.inGame()) if (p.photoPending) {
      const photo = p.photoPending; p.photoPending = null; p.photos++;
      this.stats.expansion.photosPublished++;
      // Do not identify the photographer or their role.
      stories.push(this.recordStory({ scene: 'photograph', targetId: photo.targetId, title: 'NIGHT SNAPSHOT', sub: photo.text }));
      this.addLog(`A photograph was published: ${photo.text}`);
    }
    return stories;
  };
  Room.prototype.assignObjectives = function () {
    for (const p of this.alive().filter((p) => p.role === 'conductor')) {
      const voters = this.shuffle(this.alive().filter((x) => x.id !== p.id).map((x) => x.id));
      p.objective = voters.length >= 2 ? { day: this.day, voters: voters.slice(0, 2), complete: false } : null;
    }
  };
  Room.prototype.updateHarmony = function (entries) {
    const stories = [], ballots = Object.fromEntries(entries.map((e) => [e.voterId, e.targetId]));
    for (const p of this.alive().filter((p) => p.role === 'conductor')) {
      const o = p.objective;
      if (!o || o.day !== this.day || o.complete) continue;
      const [a, b] = o.voters;
      if (!ballots[a] || ballots[a] === 'skip' || ballots[a] !== ballots[b]) continue;
      o.complete = true; p.harmony++; this.harmonyTotal = (this.harmonyTotal || 0) + 1;
      p.metrics.objectives++;
      this.stats.expansion.harmonyObjectives++;
      this.addLog('A secret voting objective was completed. Harmony grows.');
      if (p.harmony < this.settings.harmonyGoal) continue;
      const candidates = this.alive().filter((x) => this.team(x) === 'town' && x.id !== p.id && !(this.confirmedTown || []).includes(x.id));
      if (!candidates.length) continue;
      const innocent = this.pick(candidates);
      p.harmony = 0; this.confirmedTown = (this.confirmedTown || []).concat(innocent.id);
      this.stats.expansion.blessings++;
      stories.push(this.recordStory({ scene: 'blessing', targetId: innocent.id, title: 'TOWN BLESSING', sub: `${innocent.name} is confirmed Town.` }));
    }
    return stories;
  };
  Room.prototype.abilityView = function (p) {
    const open = !this.paused && !this.judgeVacant && !p.left && !p.spectator && !this.hasStatus(p, 'silenced');
    const day = ['discussion', 'voting'].includes(this.phase);
    const cfg = this.ruleConfig(p), available = this.abilityAvailable(p,p.role), left = cfg.uses ? Math.max(0,cfg.uses - (p.actionUses[p.role] || 0)) : '∞';
    if (p.role === 'ghostwriter') return { kind: 'ghostwriter', canUse: open && available && !p.alive && ['morning', 'discussion', 'voting'].includes(this.phase) && p.ghostDay !== this.day, words: GHOST_WORDS, pending: !!p.ghostMessage };
    if (p.role === 'puppetMaster') return { kind: 'puppetMaster', canUse: open && available && p.alive && this.phase === 'voting' && !this.settings.anonymousVotes, left };
    if (p.role === 'glitch') return { kind: 'glitch', canUse: open && available && p.alive && day && !(this.glitchUntil > this.now()), left };
    if (p.role === 'conductor') return { kind: 'conductor', objective: p.objective, harmony: p.harmony, goal: this.settings.harmonyGoal };
    if (p.role === 'paparazzi') return { kind: 'paparazzi', photos: p.photos, goal: this.settings.paparazziGoal };
    return null;
  };
  Room.prototype.dayAbility = function (p, msg = {}) {
    const a = this.abilityView(p);
    if (!a || !a.canUse) return { ok: false, error: 'That ability is unavailable right now.' };
    if (a.kind === 'ghostwriter') {
      const tokens = msg.tokens;
      const bank = GHOST_WORDS.concat(this.list().map((x) => `PLAYER ${x.house + 1}`));
      if (!Array.isArray(tokens) || !tokens.length || tokens.length > 3 || tokens.some((t) => !bank.includes(t))) return { ok: false, error: 'Choose one to three approved words.' };
      p.ghostMessage = tokens.join(' '); p.ghostDay = this.day;
      this.addLog(`Ghostwriter queued a clue.`, true);
    } else if (a.kind === 'puppetMaster') {
      const victim = this.alive().find((x) => x.id === msg.victimId && x.id !== p.id && this.canCast(x));
      const target = this.alive().find((x) => x.id === msg.targetId);
      if (!victim || !target || victim.id === target.id || !this.voteTargets(victim).includes(target.id) || this.voteLocks[victim.id]) return { ok: false, error: 'Choose an eligible voter and a target on this ballot.' };
      this.votes[victim.id] = target.id; this.voteLocks[victim.id] = target.id; p.abilityUses++;
      this.stats.expansion.redirectedVotes++;
      this.addLog(`${p.name} redirected ${victim.name}'s ballot to ${target.name}.`, true);
      if (this.alive().every((x) => this.votes[x.id])) this.finishSoon(2500);
    } else if (a.kind === 'glitch') {
      p.abilityUses++; this.glitchUntil = this.now() + 30000;
      this.stats.expansion.glitches++;
      this.addLog('The public display was corrupted for 30 seconds.');
      const until = this.glitchUntil;
      this.later(30000, () => { if (this.glitchUntil === until) { this.glitchUntil = 0; this.sync(); } });
    }
    this.consumeAbility(p,a.kind); this.sync(); return { ok: true };
  };
  Room.prototype.publishGhosts = function () {
    const stories = [];
    for (const p of this.inGame()) if (!p.alive && p.role === 'ghostwriter' && p.ghostMessage) {
      stories.push(this.recordStory({ scene: 'beyond', title: 'MESSAGE FROM BEYOND', sub: p.ghostMessage }));
      this.addLog(`Message from beyond: ${p.ghostMessage}`); p.ghostMessage = null;
      this.stats.expansion.ghostMessages++;
    }
    if (stories.length) { this.storyHoldUntil = this.now() + this.ms(stories.length * 6.5 + 0.5); this.setCinematic({ type: 'stories', stories }); }
  };
  Room.prototype.scheduleRoleBots = function (now) {
    if (!this.settings.botsAuto && !now) return;
    const phaseId = this.phaseId;
    for (const p of this.inGame().filter((p) => p.isBot)) {
      const v = this.playerView(p), a = v.ability;
      if (!a || !a.canUse) continue;
      // Decisions use the same private phone view as a human participant.
      const targets = v.players.filter((x) => x.alive && x.id !== p.id);
      this.later(now ? 50 : this.ms(3), () => {
        if (this.phaseId !== phaseId || this.paused) return;
        if (a.kind === 'ghostwriter' && targets.length) this.dayAbility(p, { tokens: ['WATCH', `PLAYER ${this.pick(targets).house + 1}`] });
        if (a.kind === 'glitch') this.dayAbility(p);
        if (a.kind === 'puppetMaster' && targets.length >= 2) this.dayAbility(p, { victimId: targets[0].id, targetId: targets[1].id });
      });
    }
  };
};
