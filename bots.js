'use strict';
// Bot players for testing and balancing. A bot only ever sees the same
// filtered view a phone would get (room.playerView), so it cannot cheat.
// It keeps a private "suspicion" score for every other player, updated from
// public events (votes, accusations, revealed roles) and its own private
// information (investigations, Mafia teammates, Telepath messages).

const { ROLES, TELEPATH_MESSAGES } = require('./public/shared/roles');

const PERSONALITIES = {
  analyst:    { label: 'Analyst',    noise: 8,  skipBias: 12, bandwagon: 0.4, talk: 0.6, bluff: 0.15 },
  aggressive: { label: 'Aggressive', noise: 14, skipBias: -20, bandwagon: 0.3, talk: 0.9, bluff: 0.3 },
  cautious:   { label: 'Cautious',   noise: 6,  skipBias: 28, bandwagon: 0.6, talk: 0.3, bluff: 0.05 },
  follower:   { label: 'Follower',   noise: 10, skipBias: 6,  bandwagon: 1.4, talk: 0.25, bluff: 0.1 },
  chaotic:    { label: 'Chaotic',    noise: 55, skipBias: 0,  bandwagon: 0.1, talk: 0.7, bluff: 0.4 },
};
const PERSONALITY_IDS = Object.keys(PERSONALITIES);

class BotBrain {
  constructor(rng, personality) {
    this.rng = rng;
    this.personality = PERSONALITIES[personality] ? personality : PERSONALITY_IDS[Math.floor(rng() * PERSONALITY_IDS.length)];
    this.p = PERSONALITIES[this.personality];
    this.sus = {};          // playerId -> suspicion (higher = more likely evil)
    this.threat = {};       // for evil bots: playerId -> how dangerous they are to us
    this.seenVotes = 0;     // lastVotes id already processed
    this.seenAcc = new Set();
    this.seenTele = 0;
    this.seenInv = 0;
    this.claimed = new Set(); // findings we've already announced
    this.deadSeen = new Set();
  }

  r(a = 0, b = 1) { return a + this.rng() * (b - a); }
  pick(a) { return a[Math.floor(this.rng() * a.length)]; }
  add(map, id, v) { map[id] = (map[id] || 0) + v; }

  evil(v) { return ROLES[v.role] && ROLES[v.role].team === 'mafia'; }

  // Update memory from everything visible in this view.
  observe(v) {
    const me = v.you.id;
    const byId = new Map(v.players.map((x) => [x.id, x]));
    if (v.teammates) for (const t of v.teammates) this.sus[t.id] = -1000;
    if (v.telepath && v.telepath.partner) this.sus[v.telepath.partner.id] = -500;

    const inv = v.investigations || [];
    for (const i of inv.slice(this.seenInv)) {
      if (i.blocked) continue;
      if (i.reveal === 'activity') { if (/Multiple/.test(i.clue || '')) this.add(this.sus, i.targetId, 6); continue; }
        const guilty = i.reveal === 'role' ? ROLES[i.result] && ROLES[i.result].team !== 'town' : i.result;
        this.add(this.sus, i.targetId, guilty ? 220 : -70);
    }
    this.seenInv = inv.length;
    for (const id of (v.presentation || {}).confirmedTown || []) this.sus[id] = -500;

    // Revealed deaths: re-judge the people who voted for them.
    if (v.voteHistory) {
      for (const p of v.players) {
        if (p.alive || !p.role || this.deadSeen.has(p.id)) continue;
        this.deadSeen.add(p.id);
        const team = ROLES[p.role] && ROLES[p.role].team;
        for (const day of v.voteHistory) {
          for (const e of day.votes) {
            if (e.targetId !== p.id || e.voterId === me) continue;
            this.add(this.sus, e.voterId, team === 'town' ? 9 : -7);
          }
        }
      }
    }

    for (const a of v.accusations || []) {
      if (this.seenAcc.has(a.id) || a.fromId === me) continue;
      this.seenAcc.add(a.id);
      const cred = Math.max(0.15, Math.min(1, 1 - (this.sus[a.fromId] || 0) / 120));
      if (a.kind === 'claim') this.add(this.sus, a.targetId, (a.verdict === 'evil' ? 55 : -35) * cred);
      else this.add(this.sus, a.targetId, 7 * cred);
      // Evil bots remember who is hunting them.
      if (this.evil(v) && v.teammates && (a.targetId === me || v.teammates.some((t) => t.id === a.targetId))) {
        this.add(this.threat, a.fromId, a.kind === 'claim' ? 80 : 15);
      }
      if (a.kind === 'claim') this.add(this.threat, a.fromId, 40);
    }

    const log = v.telepath ? v.telepath.log : [];
    for (const m of log.slice(this.seenTele)) {
      if (m.fromId === me) continue;
      const def = TELEPATH_MESSAGES.find((d) => d.id === m.msgId);
      if (def && def.sus && m.targetId) this.add(this.sus, m.targetId, def.sus);
    }
    this.seenTele = log.length;
    void byId;
  }

  score(id, v) {
    const base = this.sus[id] || 0;
    const acc = (v.accusations || []).filter((a) => a.targetId === id).length;
    return base + acc * 8 * this.p.bandwagon + this.r(-1, 1) * this.p.noise;
  }

  best(ids, scoreFn) {
    let top = null, topS = -Infinity;
    for (const id of ids) { const s = scoreFn(id); if (s > topS) { topS = s; top = id; } }
    return { id: top, score: topS };
  }

  // ----- decisions -----
  night(v) {
    this.observe(v);
    const a = v.action;
    if (!a || !a.targets.length) return null;
    const def = ROLES[v.role] && ROLES[v.role].night;
    const T = a.targets;
    if (!def || a.dummy) return this.pick(T);
    switch (def.kind) {
      case 'kill': {
        if (def.teamKill) {
          const lead = (a.teamPicks || []).find((tp) => tp.leader) || (a.teamPicks || [])[0];
          if (lead && T.includes(lead.targetId) && this.rng() < 0.9) return lead.targetId;
        }
        return this.best(T, (id) => (this.threat[id] || 0) - (this.sus[id] || 0) * 0.2 + this.r(0, 30)).id;
      }
      case 'block':
        return this.best(T, (id) => (this.threat[id] || 0) + this.r(0, 40)).id;
      case 'investigate': {
        const done = new Set((v.investigations || []).map((i) => i.targetId));
        const fresh = T.filter((id) => !done.has(id));
        return this.best(fresh.length ? fresh : T, (id) => (this.sus[id] || 0) + this.r(0, 25)).id;
      }
      case 'spy': return this.best(T, (id) => this.score(id, v)).id;
      case 'photo': {
        const active = this.claimers(v).filter((id) => T.includes(id));
        return this.pick(active.length ? active : T);
      }
      case 'heal':
      case 'guard': {
        const claimers = this.claimers(v).filter((id) => T.includes(id));
        if (claimers.length && this.rng() < 0.6) return this.pick(claimers);
        if (T.includes(v.you.id) && this.rng() < 0.3) return v.you.id;
        return this.best(T, (id) => -(this.sus[id] || 0) + this.r(0, 40)).id;
      }
      case 'shoot': {
        const b = this.best(T, (id) => this.score(id, v));
        return b.score >= 60 ? b.id : 'pass';
      }
      default:
        return this.pick(T);
    }
  }

  claimers(v) {
    return [...new Set((v.accusations || []).filter((a) => a.kind === 'claim').map((a) => a.fromId))]
      .filter((id) => v.players.some((p) => p.id === id && p.alive));
  }

  vote(v) {
    this.observe(v);
    const vt = v.voting;
    if (!vt) return null;
    const T = vt.targets;
    if (!T.length) return vt.canSkip ? 'skip' : null;
    if (v.role === 'jester') return this.rng() < 0.15 && vt.canSkip ? 'skip' : this.pick(T);
    if (this.evil(v)) {
      const mates = new Set((v.teammates || []).map((t) => t.id));
      const options = T.filter((id) => !mates.has(id));
      if (!options.length) return vt.canSkip ? 'skip' : this.pick(T);
      // Push the town's favorite suspect, or whoever is hunting us.
      return this.best(options, (id) => (this.threat[id] || 0) * 0.6 + this.score(id, v) * 0.7).id;
    }
    const b = this.best(T, (id) => this.score(id, v));
    if (vt.canSkip && b.score < this.p.skipBias) return 'skip';
    return b.id;
  }

  // Something to say in discussion (shown as a speech bubble on the TV).
  chatter(v) {
    this.observe(v);
    if (this.rng() > this.p.talk) return null;
    const alive = v.players.filter((p) => p.alive && p.id !== v.you.id);
    if (!alive.length) return null;
    const role = ROLES[v.role] || {};
    // Investigators reveal their findings.
    const found = (v.investigations || []).filter((i) => !i.blocked && (i.reveal === 'role' ? ROLES[i.result] && ROLES[i.result].team !== 'town' : i.result) && !this.claimed.has(i.targetId) && alive.some((p) => p.id === i.targetId));
    if (found.length) {
      const i = found[0];
      this.claimed.add(i.targetId);
      return { targetId: i.targetId, kind: 'claim', verdict: 'evil', text: `I'm the ${role.name}. ${i.name} is guilty!` };
    }
    if (v.role === 'jester') {
      const t = this.pick(alive);
      return { targetId: t.id, kind: 'accuse', text: this.pick([`${t.name} is DEFINITELY Mafia.`, `I'd vote me, honestly. Or ${t.name}.`, `Trust me, it's ${t.name}.`]) };
    }
    if (this.evil(v)) {
      const mates = new Set((v.teammates || []).map((t) => t.id));
      const town = alive.filter((p) => !mates.has(p.id));
      if (!town.length) return null;
      const t = this.best(town.map((p) => p.id), (id) => (this.threat[id] || 0) + this.score(id, v));
      const name = (alive.find((p) => p.id === t.id) || {}).name;
      if (this.rng() < this.p.bluff) return { targetId: t.id, kind: 'claim', verdict: 'evil', text: `I'm the Detective. ${name} is guilty!` };
      return { targetId: t.id, kind: 'accuse', text: `I don't trust ${name}.` };
    }
    const b = this.best(alive.map((p) => p.id), (id) => this.score(id, v));
    if (b.score < 10) return null;
    const name = (alive.find((p) => p.id === b.id) || {}).name;
    return { targetId: b.id, kind: 'accuse', text: this.pick([`I suspect ${name}.`, `${name} is acting shady.`, `Let's look at ${name}.`]) };
  }

  telepath(v) {
    this.observe(v);
    const tp = v.telepath;
    if (!tp || !tp.canSend || this.rng() > 0.6) return null;
    const alive = v.players.filter((p) => p.alive && p.id !== v.you.id && p.id !== (tp.partner && tp.partner.id));
    if (!alive.length) return null;
    const b = this.best(alive.map((p) => p.id), (id) => this.score(id, v));
    if (b.score > 15) return { msgId: 'suspect', targetId: b.id };
    const lo = this.best(alive.map((p) => p.id), (id) => -this.score(id, v));
    return { msgId: 'trust', targetId: lo.id };
  }
}

module.exports = { BotBrain, PERSONALITIES, PERSONALITY_IDS };
