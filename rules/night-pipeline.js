'use strict';
const R = require('../public/shared/roles');
const ORDER = ['collect', 'blocks', 'statuses', 'protection', 'specials', 'teamKill', 'attacks', 'information', 'observations', 'outcomes'];
const stages = {
  collect(c) {
    const r = c.room;
    c.alive = r.alive().sort((a, b) => a.id.localeCompare(b.id));
    c.acts = r.night.actions; c.blocked = new Set(); c.healed = new Set(); c.guards = new Map();
    c.attacks = []; c.events = []; c.deaths = new Map(); c.blockedAttempts = [];
    c.defs = new Map(c.alive.map((p) => [p.id, r.nightDef(p)]));
    c.definition = (p) => c.defs.get(p.id);
    c.kind = (p) => (c.definition(p) || {}).kind;
    c.did = (p) => !!c.acts[p.id] && c.acts[p.id] !== 'pass';
    c.effective = (p) => c.did(p) && !c.blocked.has(p.id);
    c.actions = c.alive.filter((p) => c.definition(p) && c.did(p)).map((p) => ({ actorId: p.id, role: p.role, ability: c.kind(p), targetId: c.acts[p.id], phase: r.phase, teamAction: !!c.definition(p).teamKill, metadata: (r.night.metadata || {})[p.id] || {} }));
    r.night.resolution = { order: ORDER, actions: c.actions, outcomes: [] };
    for (const action of c.actions) r.audit('action.collected', { action });
  },
  blocks(c) {
    const r = c.room;
    for (const p of c.alive) if (c.kind(p) === 'block' && c.did(p)) {
      c.blocked.add(c.acts[p.id]); r.stats.blocks++; r.consumeAbility(p, 'block');
      r.audit('action.block', { actorId: p.id, targetId: c.acts[p.id] });
      r.addLog(`${p.name} blocked ${r.nameOf(c.acts[p.id])}.`, true);
    }
    for (const p of c.alive) if (c.did(p) && c.blocked.has(p.id) && c.kind(p) !== 'block') p.notes.push({ day: r.day, text: 'Someone distracted you last night. Your ability failed.' });
  },
  statuses(c) {
    const r = c.room;
    for (const action of c.actions) {
      const handler = (r.nightHandlers || {})[action.ability];
      if (handler && handler.stage === 'statuses' && !c.blocked.has(action.actorId)) handler.run.call(r, action, c);
    }
    if (r.lastingEffects) r.lastingEffects(c);
  },
  protection(c) {
    const r = c.room, last = {};
    for (const p of c.alive) {
      const kind = c.kind(p);
      if (r.hasStatus(p, 'protected')) c.healed.add(p.id);
      if (c.acts[p.id] && ['heal', 'guard'].includes(kind)) last[p.id] = c.acts[p.id];
      if (!c.effective(p)) continue;
      if (kind === 'heal') c.healed.add(c.acts[p.id]);
      if (kind === 'guard' && !c.guards.has(c.acts[p.id])) c.guards.set(c.acts[p.id], p.id);
      if (['heal', 'guard'].includes(kind)) { r.consumeAbility(p, kind); r.audit('action.protection', { actorId: p.id, targetId: c.acts[p.id], ability: kind }); }
    }
    r.lastTarget = last;
  },
  specials(c) {
    const r = c.room;
    for (const action of c.actions) {
      const handler = (r.nightHandlers || {})[action.ability];
      if (handler && handler.stage !== 'statuses' && handler.stage !== 'information' && !c.blocked.has(action.actorId)) handler.run.call(r, action, c);
    }
  },
  teamKill(c) {
    const r = c.room, all = r.teamPicks('mafia'), picks = all.filter((p) => !c.blocked.has(p.id));
    if (r.night && r.night.festival) return; // Daily Surprises: festival night, no Mafia kill
    if (all.length && !picks.length) c.blockedAttempts.push({ type: 'blocked', targetId: all[0].targetId, by: 'mafia' });
    if (picks.length) {
      let chosen;
      if (r.resolveMafiaChoice) chosen = r.resolveMafiaChoice(picks);
      else {
        const leader = picks.find((p) => p.leader), counts = {};
        for (const p of picks) counts[p.targetId] = (counts[p.targetId] || 0) + 1;
        const max = Math.max(...Object.values(counts));
        const targetId = leader ? leader.targetId : r.pick(Object.keys(counts).filter((k) => counts[k] === max).sort());
        chosen = { targetId, actorId: (leader || picks.find((p) => p.targetId === targetId)).id };
      }
      if (chosen) {
        c.attacks.push({ by: 'mafia', ...chosen });
        r.audit('mafia.target', { picks, ...chosen });
        if (r.resolveExtraTargets) for (const targetId of r.resolveExtraTargets(picks, chosen.targetId)) c.attacks.push({ by: 'mafia', actorId: chosen.actorId, targetId });
      }
    }
  },
  attacks(c) {
    const r = c.room;
    for (const p of c.alive) {
      const kind = c.kind(p), def = c.definition(p);
      if (c.did(p) && c.blocked.has(p.id) && (kind === 'shoot' || (kind === 'kill' && !def.teamKill))) c.blockedAttempts.push({ type: 'blocked', targetId: c.acts[p.id], by: p.role });
      if (!c.effective(p)) continue;
      if (kind === 'kill' && !def.teamKill) { c.attacks.push({ by: p.role, targetId: c.acts[p.id], actorId: p.id }); r.consumeAbility(p, kind); }
      if (kind === 'shoot') { p.shotsLeft--; r.consumeAbility(p, kind); c.attacks.push({ by: 'vigilante', targetId: c.acts[p.id], actorId: p.id }); }
    }
    const used = new Set();
    for (const attack of c.attacks) {
      const p = r.players.get(attack.targetId);
      if (!p || !p.alive || p.spectator || p.left || c.deaths.has(p.id)) continue;
      const guardId = c.guards.get(p.id), guard = r.players.get(guardId);
      let outcome;
      if (guard && !used.has(guardId) && !c.deaths.has(guardId)) {
        used.add(guardId); r.stats.guards++;
        if (!c.healed.has(guardId)) c.deaths.set(guardId, 'guarding');
        c.events.push({ type: 'guarded', targetId: p.id, guardId, guardDied: !c.healed.has(guardId) }); outcome = 'guarded';
      } else if (c.healed.has(p.id)) { r.stats.saves++; c.events.push({ type: 'saved', targetId: p.id }); outcome = 'protected';
        for (const doctor of c.alive.filter((x) => c.kind(x) === 'heal' && c.effective(x) && c.acts[x.id] === p.id)) { const key = r.day + ':' + p.id; if (!doctor.savedTargets.includes(key)) { doctor.savedTargets.push(key); doctor.metrics.saves++; } }
      }
      else if (r.role(p).nightImmune) { r.stats.immune++; c.events.push({ type: 'saved', targetId: p.id, immune: true }); outcome = 'immune'; }
      else { c.deaths.set(p.id, attack.by); c.events.push({ type: 'kill', targetId: p.id }); outcome = 'killed'; }
      r.audit('attack.resolved', { ...attack, outcome });
      r.addLog(`${p.name}: ${outcome} (${attack.by}).`, true);
      if (attack.by === 'vigilante') {
        r.stats.shots.push({ targetTeam: r.team(p), killed: c.deaths.get(p.id) === 'vigilante' });
        const shooter = r.players.get(attack.actorId);
        if (shooter && c.deaths.get(p.id) === 'vigilante' && r.team(p) === 'town' && shooter.shotsLeft > 0) { shooter.shotsLeft = 0; shooter.notes.push({ day: r.day, text: '🎯 You killed one of your own. The guilt is too much: you put your gun away for good.' }); }
      }
    }
  },
  information(c) {
    const r = c.room;
    // Handlers that need to know how the night went (who visited whom, who was attacked).
    for (const action of c.actions) {
      const handler = (r.nightHandlers || {})[action.ability];
      if (handler && handler.stage === 'information' && !c.blocked.has(action.actorId)) handler.run.call(r, action, c);
    }
    for (const p of c.alive) {
      const def = c.definition(p), target = r.players.get(c.acts[p.id]);
      if (!def || def.kind !== 'investigate' || !c.did(p) || !target) continue;
      const entry = { night: r.day, targetId: target.id, name: target.name, reveal: def.reveal };
      if (c.blocked.has(p.id)) p.investigations.push({ ...entry, blocked: true });
      else {
        const shown = r.shownRole ? r.shownRole(target) : target.role; // a disguised Headhunter shows their fake role
        // The Impostor's cover story only fools role readings; yes/no checks see the Mafia member.
        const truth = def.reveal === 'role' ? shown : def.reveal === 'killedTonight' ? r.killedTonight(target, c) : R.investigate(target.role === 'impostor' ? 'impostor' : shown, def.reveal);
        const result = r.information(p, target, truth, def.reveal === 'role' ? 'role' : 'boolean');
        // The Sorcerer reads two fates: the true one and a decoy from this game (order shuffled).
        const options = p.role === 'sorcerer' && def.reveal === 'role' ? r.sorcererOptions(result) : null;
        p.investigations.push({ ...entry, result, ...(options ? { options } : {}) }); r.consumeAbility(p, 'investigate');
        if (p.role === 'hunter' && r.team(target) !== 'mafia') target.notes.push({ day: r.day, text: '🏹 You woke with a chill: someone from the Mafia hunted you last night. They know who you are.' });
        if (r.team(target) === 'mafia' && (result === true || typeof result === 'string' && R.ROLES[result] && R.ROLES[result].team === 'mafia')) p.metrics.correctInvestigations++;
        r.stats.investigations.push({ role: p.role, found: typeof result === 'boolean' ? result : R.ROLES[result].team !== 'town', truth: r.team(target) !== 'town' });
      }
    }
  },
  observations(c) { c.room.resolveObservations(c.alive, c.acts, c.blocked, c.attacks, c.defs); },
  outcomes(c) {
    const r = c.room;
    r.pending = { deaths: [...c.deaths].map(([id, cause]) => ({ id, cause })), events: c.events };
    r.night.resolution.outcomes = c.events;
    r.night.resolution.blocked = [...c.blocked];
    r.night.resolution.protected = [...c.healed];
    r.audit('resolution.summary', { actions: c.actions, blocked: [...c.blocked], protected: [...c.healed], attacks: c.attacks, outcomes: c.events });
    const events = c.events.map((e) => e.type === 'guarded' ? { type: e.type, targetId: e.targetId, guardDied: e.guardDied } : { type: e.type === 'kill' && c.attacks.filter((a) => a.targetId === e.targetId).length > 1 ? 'multiKill' : e.type, targetId: e.targetId });
    // AI narrator: each single kill gets a story location (scene + lore line at dawn).
    // Manual modes (human narrator, or the Judge revealing events by hand) stay classic.
    // Story context (public facts only) for each death: the TV scene and the narrator use it.
    r.pending.stories = {};
    for (const e of events) if (e.type === 'kill' || e.type === 'multiKill') { const S = r.storyContext ? r.storyContext(r.players.get(e.targetId), { deaths: c.deaths.size }) : null; if (S) { e.story = S; r.pending.stories[e.targetId] = S; } }
    r.pending.places = {};
    if (r.settings.revealMode !== 'judge') for (const e of events) if (e.type === 'kill') { const where = r.deathPlace(r.players.get(e.targetId)); if (where) { Object.assign(e, where); r.pending.places[e.targetId] = where; } }
    if (r.settings.revealMode === 'judge') {
      r.reveal = { events: events.map((e) => ({ ...e, played: false })), blocked: c.blockedAttempts.map((e) => ({ ...e, played: false })), quietPlayed: false };
      r.setPhase('dawn', null);
    } else {
      r.reveal = null; r.setCinematic({ type: 'night', events });
      r.setPhase('dawn', c.events.length ? r.cine('dawnEvent', (c.events.length - 1) * 16200) : r.cine('dawn'));
    }
    for (const p of c.alive) if (p.copiedAbility && p.copiedAbility.expiresDay === r.day) p.copiedAbility = null;
  },
};
function resolve(room) {
  const context = { room };
  for (const stage of ORDER) { room.audit('resolution.stage', { stage }); stages[stage](context); }
  return context;
}
module.exports = { ORDER, resolve };
