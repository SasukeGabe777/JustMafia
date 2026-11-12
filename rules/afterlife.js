'use strict';
// The afterlife: things to do once you're dead, none of which can leak secrets to the living.
//   - Ghost predictions: who gets voted out today, who dies tonight. Right guesses earn gold
//     (in games that pay) and a Ghost Oracle award in the credits.
//   - A Chill (once per game): a ghost spooks one living player. Their house flickers on the
//     TV and their phone shivers. Harmless, but everyone will talk about it.
//   - The Medium's spirit line: a living Medium chooses which ghosts may talk to them (up to
//     two); each chosen ghost may whisper one word from a fixed list per day and per night.
//     Ghosts can't reach anyone else.
//   - Mafia ghosts: once per game, a dead Mafia member can shroud a day's ballot in mist, so
//     the vote reveal hides who voted for whom.
//   - Bets: ghosts with a saved character put their own gold on the game against each other
//     (who wins, or who gets voted out today). The gold is held until the bet settles.
//   - Ghost stats count toward the afterlife achievements (ghost looks, High Roller tier 1).
const { AFTERLIFE } = require('../public/shared/cosmetics');

const DAY = ['morning', 'discussion', 'voting'];
const OVER = ['lobby', 'gameover', 'draft', 'roleReveal'];

module.exports = function install(Room) {
  const isGhost = (p) => p && !p.alive && !p.spectator && !p.left && !p.isJudge;
  const bump = (room, p, stat, n = 1) => { if (room.profiles && p.profileId && !p.isBot) room.profiles.bumpStat(p.profileId, stat, n); };

  const resetPlayer = Room.prototype.resetPlayer;
  Room.prototype.resetPlayer = function (p) {
    const r = resetPlayer.call(this, p);
    Object.assign(p, { oracle: { vote: null, night: null, correct: 0, total: 0, log: [] }, chillUsed: false, chill: null, shroudUsed: false, spirits: [], spiritLog: [], whisperKey: null, ghostCounted: false });
    return r;
  };

  // ----- start / end: bets never outlive a game -----
  const startGame = Room.prototype.startGame;
  Room.prototype.startGame = function () {
    this.refundWagers('The game was reset');
    this.wagers = []; this.wagerSeq = 0; this.shroudDay = null; this.oracleNight = null;
    return startGame.call(this);
  };
  const resetToLobby = Room.prototype.resetToLobby;
  Room.prototype.resetToLobby = function () { this.refundWagers('The game ended early'); return resetToLobby.call(this); };

  // ----- becoming a ghost -----
  const kill = Room.prototype.kill;
  Room.prototype.kill = function (p, cause) {
    const r = kill.call(this, p, cause);
    if (cause !== 'left' && !p.ghostCounted && !p.spectator) { p.ghostCounted = true; bump(this, p, 'ghosts'); }
    return r;
  };

  // ----- the ballot can be shrouded by a Mafia ghost -----
  Room.prototype.votesAnonymous = function () { return !!this.settings.anonymousVotes || (this.shroudDay != null && this.shroudDay === this.day); };

  // ----- predictions -----
  Room.prototype.ghostPredict = function (p, kind, targetId) {
    if (!isGhost(p) || OVER.includes(this.phase)) return { ok: false, error: 'Only ghosts can make predictions during a game.' };
    const target = targetId === 'none' ? 'none' : this.alive().some((x) => x.id === targetId) ? targetId : null;
    if (!target) return { ok: false, error: 'Pick a living player, or Nobody.' };
    if (kind === 'vote') {
      if (!DAY.includes(this.phase)) return { ok: false, error: 'Vote predictions open in the morning and close when the votes are counted.' };
      p.oracle.vote = { day: this.day, targetId: target };
    } else if (kind === 'night') {
      if (this.phase === 'dawn') return { ok: false, error: 'Tonight is already over.' };
      p.oracle.night = { night: this.phase === 'night' ? this.day : this.day + 1, targetId: target };
    } else return { ok: false, error: 'Unknown prediction.' };
    this.sync(); return { ok: true };
  };
  const score = (room, p, ok, text) => {
    p.oracle.total++; if (ok) { p.oracle.correct++; p.metrics.oracle = (p.metrics.oracle || 0) + 1; bump(room, p, 'oracleCorrect'); }
    p.oracle.log.unshift({ ok, text }); p.oracle.log.length = Math.min(p.oracle.log.length, 4);
  };
  const resolveVotes = Room.prototype.resolveVotes;
  Room.prototype.resolveVotes = function () {
    const r = resolveVotes.call(this);
    const out = (this.pending && this.pending.eliminatedId) || 'none', day = this.day;
    for (const p of this.inGame()) {
      const pick = p.oracle && p.oracle.vote;
      if (!pick || pick.day !== day) continue;
      p.oracle.vote = null;
      score(this, p, pick.targetId === out, `Day ${day} vote: you said ${pick.targetId === 'none' ? 'nobody' : this.nameOf(pick.targetId)}${pick.targetId === out ? ' ✔' : `, it was ${out === 'none' ? 'nobody' : this.nameOf(out)}`}`);
    }
    this.settleVoteWagers(out);
    return r;
  };
  const startNight = Room.prototype.startNight;
  Room.prototype.startNight = function () {
    const r = startNight.call(this);
    this.oracleNight = { night: this.day, alive: this.alive().map((p) => p.id) };
    return r;
  };
  const setPhase = Room.prototype.setPhase;
  Room.prototype.setPhase = function (phase, ms) {
    if (this.oracleNight && phase !== 'night') {
      const o = this.oracleNight; this.oracleNight = null;
      const died = o.alive.filter((id) => { const x = this.players.get(id); return x && !x.alive && x.deathCause !== 'left'; });
      for (const p of this.inGame()) {
        const pick = p.oracle && p.oracle.night;
        if (!pick || pick.night !== o.night) continue;
        p.oracle.night = null;
        const ok = pick.targetId === 'none' ? !died.length : died.includes(pick.targetId);
        score(this, p, ok, `Night ${o.night}: you said ${pick.targetId === 'none' ? 'nobody' : this.nameOf(pick.targetId)}${ok ? ' ✔' : `, ${died.length ? died.map((id) => this.nameOf(id)).join(' & ') : 'nobody'} died`}`);
      }
    }
    const r = setPhase.call(this, phase, ms);
    if (['discussion', 'night'].includes(phase)) this.botGhosts(phase);
    return r;
  };
  // Bot ghosts join in: they predict the day's most accused (or a random player) and whisper to a Medium who calls them.
  Room.prototype.botGhosts = function (phase) {
    const alive = this.alive(); if (!alive.length) return;
    for (const b of this.inGame().filter((x) => x.isBot && isGhost(x))) {
      const accused = (this.accusations || []).filter((a) => a.day === this.day && a.targetId).map((a) => a.targetId).filter((id) => alive.some((x) => x.id === id));
      const guess = accused.length && this.rng() < 0.6 ? accused[accused.length - 1] : this.pick(alive).id;
      if (phase === 'discussion') b.oracle.vote = { day: this.day, targetId: guess };
      else b.oracle.night = { night: this.day, targetId: this.rng() < 0.15 ? 'none' : this.pick(alive).id };
      if (this.mediumFor(b)) this.ghostWhisper(b, this.pick(AFTERLIFE.words), true);
    }
  };

  // ----- a Chill, once per game -----
  Room.prototype.ghostChill = function (p, targetId) {
    if (!isGhost(p) || OVER.includes(this.phase)) return { ok: false, error: 'Only ghosts can send a Chill.' };
    if (!this.settings.ghostHaunts) return { ok: false, error: 'Haunting is turned off for this game.' };
    if (p.chillUsed) return { ok: false, error: 'You already sent your Chill this game.' };
    const t = this.players.get(targetId);
    if (!t || !t.alive || t.spectator) return { ok: false, error: 'Pick a living player.' };
    p.chillUsed = true;
    t.chill = { id: ++this.eventSeq };
    bump(this, p, 'chills');
    this.addLog(`👻 ${p.name} sent a Chill to ${t.name}.`, true);
    if (this.io) this.io.to(this.hostChannel()).emit('host:chill', { ghostId: p.id, targetId: t.id });
    this.sync(); return { ok: true };
  };

  // ----- the Medium's spirit line -----
  const mediums = (room) => room.alive().filter((m) => m.role === 'medium');
  Room.prototype.mediumFor = function (g) { return mediums(this).find((m) => (m.spirits || []).includes(g.id)) || null; };
  Room.prototype.spiritLine = function (m, ghostId, on) {
    if (!m.alive || m.role !== 'medium' || OVER.includes(this.phase)) return { ok: false, error: 'Only a living Medium can call on spirits.' };
    const g = this.players.get(ghostId);
    if (on) {
      if (!isGhost(g)) return { ok: false, error: 'You can only call on the dead.' };
      if (m.spirits.includes(g.id)) return { ok: true };
      if (m.spirits.length >= AFTERLIFE.maxSpirits) return { ok: false, error: `You can hold ${AFTERLIFE.maxSpirits} spirits at once. Release one first.` };
      m.spirits.push(g.id);
    } else m.spirits = m.spirits.filter((id) => id !== ghostId);
    this.sync(); return { ok: true };
  };
  Room.prototype.ghostWhisper = function (g, word, quiet) {
    if (!isGhost(g) || OVER.includes(this.phase)) return { ok: false, error: 'Only ghosts can whisper.' };
    const m = this.mediumFor(g);
    if (!m) return { ok: false, error: 'No Medium has called on you. Only a Medium can hear the dead.' };
    if (!AFTERLIFE.words.includes(word)) return { ok: false, error: 'Pick one of the spirit words.' };
    const key = `${this.day}:${this.phase === 'night' ? 'n' : 'd'}`;
    if (g.whisperKey === key) return { ok: false, error: this.phase === 'night' ? 'One word per night. Try again in the morning.' : 'One word per day. Try again tonight.' };
    g.whisperKey = key;
    m.spiritLog.unshift({ id: ++this.eventSeq, fromId: g.id, name: g.name, word, day: this.day, night: this.phase === 'night' });
    m.spiritLog.length = Math.min(m.spiritLog.length, 8);
    this.audit && this.audit('ghost.whisper', { actorId: g.id, targetId: m.id, word });
    if (!quiet) this.sync();
    return { ok: true };
  };

  // ----- a Mafia ghost shrouds the ballot -----
  Room.prototype.ghostShroud = function (p) {
    if (!isGhost(p) || this.team(p) !== 'mafia') return { ok: false, error: 'Only a Mafia ghost can do that.' };
    if (p.shroudUsed) return { ok: false, error: 'You already shrouded a ballot this game.' };
    if (!DAY.includes(this.phase)) return { ok: false, error: 'The mist can only roll in before the votes are counted.' };
    if (this.shroudDay === this.day) return { ok: false, error: 'Today’s ballot is already shrouded.' };
    p.shroudUsed = true; this.shroudDay = this.day;
    this.narration = { id: ++this.narrationSeq, text: '🌫 A cold mist rolls over the ballot box. Today, nobody will see who voted for whom.', key: 'shroud', custom: true };
    this.addLog(`🌫 ${p.name} (a Mafia ghost) shrouded day ${this.day}'s ballot.`, true);
    this.sync(); return { ok: true };
  };

  // ----- bets between ghosts -----
  Room.prototype.refundWagers = function (why) {
    for (const w of this.wagers || []) {
      if (!['open', 'taken'].includes(w.status)) continue;
      this.payBack(w, why); w.status = 'refunded';
    }
  };
  Room.prototype.payBack = function (w, why) {
    const P = this.profiles; if (!P) return;
    P.escrow(w.fromProfile, w.stake, `Bet refunded: ${why}`);
    if (w.takerProfile) P.escrow(w.takerProfile, w.stake, `Bet refunded: ${why}`);
  };
  const describe = (room, w) => w.kind === 'winner' ? `${w.pick === 'town' ? 'the Town' : 'the Mafia'} wins the game` : `${room.nameOf(w.pick)} is voted out on day ${w.day}`;
  Room.prototype.offerWager = function (p, { kind, pick, stake }) {
    if (!isGhost(p) || OVER.includes(this.phase)) return { ok: false, error: 'Ghosts bet during the game.' };
    if (!this.profiles || !p.profileId || p.isBot) return { ok: false, error: 'Betting needs a saved character with a gold pouch.' };
    stake = Number(stake);
    if (!AFTERLIFE.stakes.includes(stake)) return { ok: false, error: 'Pick a stake.' };
    if ((this.wagers || []).filter((w) => w.fromId === p.id && w.status === 'open').length >= 3) return { ok: false, error: 'You have 3 open bets. Wait for someone to take one, or cancel one.' };
    if (kind === 'winner') { if (!['town', 'mafia'].includes(pick)) return { ok: false, error: 'Bet on the Town or the Mafia.' }; }
    else if (kind === 'vote') {
      if (!DAY.includes(this.phase)) return { ok: false, error: 'Vote bets are made before today’s votes are counted.' };
      if (!this.alive().some((x) => x.id === pick)) return { ok: false, error: 'Pick a living player.' };
    } else return { ok: false, error: 'Unknown bet.' };
    if (!this.profiles.escrow(p.profileId, -stake, 'Bet placed')) return { ok: false, error: `Not enough gold: you have ${this.profiles.coins(p.profileId)}.` };
    const w = { id: ++this.wagerSeq, kind, pick, stake, day: this.day, fromId: p.id, fromName: p.name, fromProfile: p.profileId, takerId: null, takerName: null, takerProfile: null, status: 'open', winnerId: null };
    w.text = describe(this, w);
    this.wagers.push(w); bump(this, p, 'bets');
    this.addLog(`🎲 ${p.name} bet ${stake} gold that ${w.text}.`, true);
    this.sync(); return { ok: true, id: w.id };
  };
  Room.prototype.takeWager = function (p, id) {
    const w = (this.wagers || []).find((x) => x.id === Number(id));
    if (!w || w.status !== 'open') return { ok: false, error: 'That bet is no longer open.' };
    if (!isGhost(p) || !this.profiles || !p.profileId || p.isBot) return { ok: false, error: 'Taking a bet needs a ghost with a saved character.' };
    if (w.fromProfile === p.profileId) return { ok: false, error: 'You can’t take your own bet.' };
    if (!this.profiles.escrow(p.profileId, -w.stake, 'Bet taken')) return { ok: false, error: `Not enough gold: this bet is ${w.stake}, you have ${this.profiles.coins(p.profileId)}.` };
    Object.assign(w, { takerId: p.id, takerName: p.name, takerProfile: p.profileId, status: 'taken' });
    bump(this, p, 'bets');
    this.addLog(`🎲 ${p.name} took ${w.fromName}'s bet (${w.stake} gold): ${w.text}.`, true);
    this.sync(); return { ok: true };
  };
  Room.prototype.cancelWager = function (p, id) {
    const w = (this.wagers || []).find((x) => x.id === Number(id));
    if (!w || w.fromId !== p.id || w.status !== 'open') return { ok: false, error: 'You can only cancel your own open bets.' };
    this.payBack(w, 'cancelled'); w.status = 'refunded'; this.sync(); return { ok: true };
  };
  Room.prototype.settleWager = function (w, offererWins) {
    if (w.status === 'open') { this.payBack(w, 'nobody took it'); w.status = 'refunded'; return; }
    if (w.status !== 'taken') return;
    const win = offererWins ? { id: w.fromId, name: w.fromName, profile: w.fromProfile } : { id: w.takerId, name: w.takerName, profile: w.takerProfile };
    const lose = offererWins ? w.takerName : w.fromName;
    if (this.profiles) this.profiles.escrow(win.profile, w.stake * 2, `Won a bet against ${lose}`);
    w.status = 'settled'; w.winnerId = win.id; w.winnerName = win.name;
    this.addLog(`🎲 ${win.name} won ${w.stake * 2} gold from a bet against ${lose} (${w.text}).`, true);
  };
  Room.prototype.settleVoteWagers = function (out) {
    for (const w of this.wagers || []) if (w.kind === 'vote' && w.day === this.day && ['open', 'taken'].includes(w.status)) this.settleWager(w, w.pick === out);
  };
  const endGame = Room.prototype.endGame;
  Room.prototype.endGame = function () {
    const before = this.phase, r = endGame.call(this);
    if (before !== 'gameover' && this.phase === 'gameover') {
      for (const w of this.wagers || []) {
        if (!['open', 'taken'].includes(w.status)) continue;
        if (w.kind === 'winner' && w.status === 'taken' && ['town', 'mafia'].includes(this.winner)) this.settleWager(w, w.pick === this.winner);
        else { this.payBack(w, w.status === 'open' ? 'nobody took it' : 'nobody won it'); w.status = 'refunded'; }
      }
      this.sync();
    }
    return r;
  };

  // ----- what each phone sees -----
  const playerView = Room.prototype.playerView;
  Room.prototype.playerView = function (p) {
    const v = playerView.call(this, p);
    if (p.spectator || this.phase === 'lobby' || !p.oracle) return v;
    const name = (id) => this.nameOf(id);
    if (isGhost(p)) {
      const m = this.mediumFor(p), wagers = (this.wagers || []).filter((w) => w.status !== 'refunded' || w.fromId === p.id || w.takerId === p.id).slice(-10);
      const key = `${this.day}:${this.phase === 'night' ? 'n' : 'd'}`;
      v.afterlife = {
        oracle: { vote: p.oracle.vote && p.oracle.vote.day === this.day ? p.oracle.vote.targetId : null, voteOpen: DAY.includes(this.phase), night: p.oracle.night ? p.oracle.night.targetId : null, nightOpen: this.phase !== 'dawn', correct: p.oracle.correct, total: p.oracle.total, log: p.oracle.log },
        chill: this.settings.ghostHaunts ? { used: p.chillUsed } : null,
        shroud: this.team(p) === 'mafia' ? { used: p.shroudUsed, open: DAY.includes(this.phase) && this.shroudDay !== this.day } : null,
        spirit: m ? { mediumName: m.name, sent: p.whisperKey === key } : null,
        words: AFTERLIFE.words, stakes: AFTERLIFE.stakes,
        betting: !!(this.profiles && p.profileId && !p.isBot), gold: this.profiles && p.profileId ? this.profiles.coins(p.profileId) : 0,
        canVoteBet: DAY.includes(this.phase),
        wagers: wagers.map((w) => ({ id: w.id, kind: w.kind, text: w.text, stake: w.stake, status: w.status, fromName: w.fromName, takerName: w.takerName, winnerName: w.winnerName || null, mine: w.fromId === p.id, took: w.takerId === p.id, canTake: w.status === 'open' && w.fromProfile !== p.profileId })),
      };
    } else if (p.alive) {
      if (p.chill) v.chill = p.chill;
      if (p.role === 'medium' && !OVER.includes(this.phase)) {
        v.spiritCircle = { max: AFTERLIFE.maxSpirits, invited: p.spirits.slice(), ghosts: this.inGame().filter(isGhost).map((g) => ({ id: g.id, name: g.name })), log: p.spiritLog.map((x) => ({ ...x, name: name(x.fromId) })) };
      }
    }
    return v;
  };
};
