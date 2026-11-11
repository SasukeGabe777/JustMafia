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
      if (!a.targetId) continue; // a plain remark, nobody named
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
      // Mafia support: silence or frame whoever is most dangerous to the family.
      case 'silence':
      case 'frame':
        return this.best(T, (id) => (this.threat[id] || 0) + (def.kind === 'frame' ? this.score(id, v) * 0.5 : 0) + this.r(0, 25)).id;
      case 'clean': { const lead = (a.teamPicks || [])[0]; return lead && T.includes(lead.targetId) ? lead.targetId : 'pass'; }
      // Town specials: protect the people who claimed, watch the suspects, talk to the newest ghost.
      case 'trap': { const c = this.claimers(v).filter((id) => T.includes(id)); return c.length ? this.pick(c) : this.rng() < 0.5 ? 'pass' : this.best(T, (id) => -(this.sus[id] || 0) + this.r(0, 40)).id; }
      case 'alert': return (v.accusations || []).some((x) => x.targetId === v.you.id) || this.rng() < 0.2 ? T[0] : 'pass';
      case 'link': return this.best(T, (id) => -(this.sus[id] || 0) + this.r(0, 30)).id;
      case 'watch': return this.best(T, (id) => this.score(id, v)).id;
      case 'seance': return T[T.length - 1];
      case 'mark': return this.best(T, (id) => this.score(id, v) + this.r(0, 20)).id;
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

  // ---------- talking (speech bubbles on the TV, the "Town talk" feed on phones) ----------
  // Bots can't really discuss, so they think out loud: they react to deaths, defend
  // themselves, share (or fake) findings, point at voting patterns and explain their votes.
  // Each call returns the most relevant thing not said yet: { targetId?, kind, verdict?, text }.
  nameOf(v, id) { return (v.players.find((p) => p.id === id) || {}).name || 'someone'; }
  voice(lines) { // personality flavor on top of the content
    const tag = { analyst: ['Logically: ', 'Data says: ', ''], aggressive: ['Listen! ', 'Wake up, people. ', ''], cautious: ['Maybe... ', 'I could be wrong... ', ''], follower: ['Agreed with the others: ', 'Like they said: ', ''], chaotic: ['Plot twist: ', 'Hear me out. ', ''] }[this.personality] || [''];
    const t = this.pick(lines);
    return this.rng() < 0.35 ? this.pick(tag) + t : t; // keep capitals: lines often start with a name
  }
  roleWord(v) { return (ROLES[v.role] || {}).name || 'Villager'; }
  chatter(v, mode = 'discussion') {
    this.observe(v);
    if (mode === 'discussion' && this.rng() > Math.max(0.35, this.p.talk)) return null;
    const me = v.you.id, alive = v.players.filter((p) => p.alive && p.id !== me);
    if (!alive.length) return null;
    const evil = this.evil(v), mates = new Set((v.teammates || []).map((t) => t.id));
    this.said = this.said || new Set();
    const once = (key) => { if (this.said.has(key)) return false; this.said.add(key); return true; };

    // 1. Someone just died: react (once per death).
    const dead = v.players.filter((p) => !p.alive && p.id !== me); // each death is mourned once, when first noticed
    for (const d of dead) if (once('death:' + d.id) && this.rng() < 0.45 + this.p.talk * 0.3) {
      const accusers = [...new Set((v.accusations || []).filter((a) => a.targetId === d.id && a.fromId !== me).map((a) => a.fromId))].filter((id) => alive.some((p) => p.id === id) && !mates.has(id));
      const r = d.role && ROLES[d.role];
      if (accusers.length && !evil) { const t = accusers[0]; return { targetId: t, kind: 'accuse', text: this.voice([`${d.name} is gone, and ${this.nameOf(v, t)} was the one pushing on them. Odd.`, `RIP ${d.name}. ${this.nameOf(v, t)}, you went after them hard yesterday. Why?`]) }; }
      const lines = r ? (r.team === 'town'
        ? [`We lost ${d.name}, our ${r.name}. The Mafia knew exactly who to hit.`, `${d.name} was the ${r.name}... that hurts. Somebody leaked it.`, `Not ${d.name}! We needed that ${r.name}.`, `${d.name} gone. Who knew they were the ${r.name}?`, `That's a real loss. ${d.name} was helping us.`]
        : evil ? [`${d.name}... well. Let's not lose our heads.`, `So ${d.name} was the ${r.name}. Didn't see that one coming.`, `One down. Let's make sure it's not a fluke.`]
          : [`${d.name} was the ${r.name}? Good riddance.`, `Got one! ${d.name} was the ${r.name}.`, `Told you ${d.name} was off.`, `That's one less ${r.name} to worry about.`, `Nice work, town. Who's next on the list?`])
        : [`${d.name}... I didn't see that coming.`, `Another empty chair. ${d.name}, rest easy.`, `Who would want ${d.name} gone? Think about it.`];
      return { kind: 'say', text: this.voice(lines) };
    }

    // 2. I've been accused: defend myself.
    const onMe = (v.accusations || []).filter((a) => a.targetId === me && a.fromId !== me && !this.said.has('def:' + a.id));
    if (onMe.length) {
      const a = onMe[onMe.length - 1]; this.said.add('def:' + a.id);
      const who = this.nameOf(v, a.fromId), role = this.roleWord(v);
      if (evil) return { targetId: a.fromId, kind: 'accuse', text: this.voice([`Me? I'm a plain Villager. ${who} is deflecting.`, `Funny, ${who}. I was about to say the same about you.`, `If you vote me you're wasting a day. Look at ${who}.`]) };
      const soft = v.role === 'villager' ? 'just a Villager' : this.rng() < 0.5 ? `the ${role}, and I can prove it` : 'on your side';
      return { targetId: a.fromId, kind: 'claim', verdict: 'good', text: this.voice([`I'm ${soft}. ${who}, why me?`, `Wrong person, ${who}. I'm ${soft}.`, `Vote me and you lose a friend. I'm ${soft}.`]) };
    }

    // 3. Fresh findings (information roles): share them. Mafia sometimes fake one.
    const role = this.roleWord(v);
    const inv = (v.investigations || []).filter((i) => !i.blocked && !this.claimed.has(i.targetId) && alive.some((p) => p.id === i.targetId));
    for (const i of inv) {
      const guilty = i.options ? i.options.every((k) => ROLES[k] && ROLES[k].team !== 'town') : i.reveal === 'role' ? ROLES[i.result] && ROLES[i.result].team !== 'town' : i.result;
      const unsure = i.options && !guilty && i.options.some((k) => ROLES[k] && ROLES[k].team !== 'town');
      this.claimed.add(i.targetId);
      if (guilty) return { targetId: i.targetId, kind: 'claim', verdict: 'evil', text: this.voice([`I'm the ${role}. ${i.name} is guilty. Vote them!`, `${role} here. Checked ${i.name} last night: not one of us.`]) };
      if (unsure) return { targetId: i.targetId, kind: 'accuse', text: this.voice([`My reading on ${i.name} came back mixed. Keep an eye on them.`]) };
      if (this.rng() < 0.6) return { targetId: i.targetId, kind: 'claim', verdict: 'good', text: this.voice([`I checked ${i.name}. They're clean.`, `${i.name} is fine, I looked into it.`]) };
    }
    if (evil && this.rng() < this.p.bluff * 0.6 && once('fakeclaim:' + v.day)) {
      const town = alive.filter((p) => !mates.has(p.id)); if (town.length) {
        const t = this.best(town.map((p) => p.id), (id) => (this.threat[id] || 0) + this.score(id, v)).id;
        return { targetId: t, kind: 'claim', verdict: 'evil', text: this.voice([`I'm the Detective. ${this.nameOf(v, t)} is Mafia.`, `Investigated ${this.nameOf(v, t)}. Guilty. Sorry.`]) };
      }
    }

    // 4. Voting patterns: who voted out a Town member?
    if (v.voteHistory && !evil) for (const d of v.players.filter((p) => !p.alive && p.role && ROLES[p.role] && ROLES[p.role].team === 'town')) {
      for (const day of v.voteHistory) for (const e of day.votes || []) {
        if (e.targetId !== d.id || e.voterId === me || !alive.some((p) => p.id === e.voterId) || !once(`vote:${e.voterId}:${d.id}`)) continue;
        return { targetId: e.voterId, kind: 'accuse', text: this.voice([`${this.nameOf(v, e.voterId)} voted out ${d.name}, and ${d.name} was Town. Explain that.`, `Remember who voted ${d.name}? ${this.nameOf(v, e.voterId)} did.`]) };
      }
    }

    // 5. Mafia: steer the town toward whoever hunts us, or join the crowd.
    if (evil) {
      const town = alive.filter((p) => !mates.has(p.id)); if (!town.length) return null;
      const t = this.best(town.map((p) => p.id), (id) => (this.threat[id] || 0) + this.score(id, v)).id;
      if (!once(`push:${t}:${v.day}`)) return mode === 'opener' ? { kind: 'say', text: this.voice(['Quiet night for me. Anyone see anything?', 'Let us not rush this vote.']) } : null;
      return { targetId: t, kind: 'accuse', text: this.voice([`${this.nameOf(v, t)} is way too comfortable.`, `Something about ${this.nameOf(v, t)}'s story doesn't add up.`, `I'm watching ${this.nameOf(v, t)}. Too many questions, no answers.`]) };
    }

    // 6. Jester: wants to be voted out.
    if (v.role === 'jester' && once('jest:' + v.day)) {
      const t = this.pick(alive);
      return { targetId: t.id, kind: 'accuse', text: this.pick([`Honestly? Vote me. I dare you.`, `${t.name} is DEFINITELY Mafia. Or me. Could be me.`, `I have a confession... nah. Or do I?`]) };
    }

    // 7. Town suspicion with a reason.
    const b = this.best(alive.map((p) => p.id), (id) => this.score(id, v));
    if (b.score >= 10 && once(`sus:${b.id}:${v.day}`)) {
      const n = this.nameOf(v, b.id), why = (v.accusations || []).filter((a) => a.targetId === b.id).length > 1 ? 'everyone is talking about them' : 'their story keeps changing';
      return { targetId: b.id, kind: 'accuse', text: this.voice([`I suspect ${n}: ${why}.`, `${n} is acting shady. ${why.charAt(0).toUpperCase() + why.slice(1)}.`, `Let's look hard at ${n}.`]) };
    }
    if (mode === 'opener' && once('open:' + v.day)) return { kind: 'say', text: this.voice(v.day <= 1 ? ['No info yet. Watch who rushes the vote.', 'First day. Let\'s hear everyone before we vote.', 'Quiet players worry me. Speak up!'] : ['Another day, fewer of us. Think about who benefits.', 'Let\'s use what we learned last night.', 'Who has been the loudest without saying anything?']) };
    return null;
  }

  // Why I voted the way I did (said right after voting).
  explain(v, targetId) {
    if (!targetId || this.rng() > Math.max(0.3, this.p.talk)) return null;
    if (targetId === 'skip') return { kind: 'say', text: this.voice(['Skipping. Not enough to go on.', 'I won\'t vote blind. Skip.']) };
    const n = this.nameOf(v, targetId), claimEvil = (v.accusations || []).some((a) => a.targetId === targetId && a.kind === 'claim' && a.verdict === 'evil');
    return { targetId, kind: 'accuse', text: this.voice(claimEvil ? [`Voting ${n}. A claim said guilty and I believe it.`, `${n}. The evidence is right there.`] : [`Voting ${n}. Gut feeling.`, `${n}, you never answered the question.`, `My vote is on ${n}.`]) };
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
