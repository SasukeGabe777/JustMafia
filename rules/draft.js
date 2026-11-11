'use strict';
// Role Draft: the "Default" way to pick roles. After the host presses Start, everyone
// watches a deck shuffle, votes on which role cards go into this game, sees the cards
// go back into the deck, and is then dealt a secret card (the existing roleReveal phase).
// Server-authoritative: the server picks the cards, counts the votes, settles ties and
// deals the roles. Clients only animate. Manual mode never comes here.
//
// Stages (phase 'draft'):  deck → vote → result → collect → startGame() (roleReveal)
const D = require('../public/shared/draft');
const R = require('../public/shared/roles');

const STAGE_MS = { deck: 7000, result: 5500, collect: 5000 };
const ALL_READY_MS = 1500;   // once everyone locked in, the vote closes shortly after
const DEAL_EXTRA_MS = 16000; // a drafted game's role reveal waits longer for card flips

module.exports = function install(Room) {
  Room.prototype.draftMode = function () {
    // Test mode's forced roles need the manual setup, so they always skip the draft.
    return this.settings.roleSelection !== 'manual' && !Object.keys(this.settings.forcedRoles || {}).length;
  };

  Room.prototype.draftPlayers = function () { return this.inGame().filter((p) => !p.judgeRetired); };

  Room.prototype.startDraft = function () {
    for (const p of this.list()) if (p.left) this.players.delete(p.id);
    const players = this.draftPlayers();
    const min = Math.max(3, this.settings.minPlayers);
    if (players.length < min) return { ok: false, error: `Need at least ${min} players.` };
    const n = players.length;
    this.draftSeen = this.draftSeen || {}; // per-room memory so other roles get their turn
    const cards = D.candidates(n, this.settings, this.rng, this.draftSeen);
    for (const k of cards) this.draftSeen[k] = (this.draftSeen[k] || 0) + 1;
    this.draft = { id: (this.draft ? this.draft.id : 0) + 1, stage: 'deck', stageAt: this.now(), cards, picks: D.SCALE.winners(cards.length), ballots: {}, ready: {}, result: null, n };
    this.draftCounts = null;
    for (const p of this.list()) p.flipped = false;
    this.clearMoveRequests();
    this.addLog(`Role draft started: ${cards.map((k) => R.ROLES[k].name).join(', ')}.`);
    this.setPhase('draft', null);
    this.draftTimer(STAGE_MS.deck);
    return { ok: true };
  };

  // Draft stages run on their own timer, even when a human narrator paces the game.
  Room.prototype.draftTimer = function (ms) {
    this.clock.clear(this.timer);
    ms = this.settings.skipCinematics ? Math.min(ms, 400) : ms / this.speed();
    this.endsAt = this.now() + ms;
    this.timer = this.later(ms, () => this.advance());
    this.sync();
  };

  Room.prototype.draftStage = function (stage, ms) {
    this.draft.stage = stage; this.draft.stageAt = this.now();
    this.draftTimer(ms);
  };

  // Called by advance() (timer, or the host's "Next phase").
  Room.prototype.draftNext = function () {
    const d = this.draft;
    if (!d) return this.resetToLobby();
    if (d.stage === 'deck') {
      this.draftStage('vote', this.ms(this.settings.draftSeconds || 45));
      this.draftBots();
    } else if (d.stage === 'vote') {
      const ids = new Set(this.draftPlayers().map((p) => p.id)); // ballots of people who left don't count
      const ballots = Object.fromEntries(Object.entries(d.ballots).filter(([id]) => ids.has(id)));
      d.result = D.finalize({ cards: d.cards, ballots, n: ids.size, settings: this.settings, rng: this.rng });
      this.draftCounts = d.result.roleCounts;
      this.addLog(`Drafted roles: ${d.result.roles.map((k) => R.ROLES[k].name).join(', ') || 'none (classic setup)'}${d.result.tie ? ' (a tie was settled by a random draw)' : ''}.`);
      this.draftStage('result', STAGE_MS.result);
    } else if (d.stage === 'result') {
      this.draftStage('collect', STAGE_MS.collect);
    } else if (d.stage === 'collect') {
      const r = this.startGame();
      if (!r.ok) { // e.g. too many players left during the draft
        this.addLog(`The draft was cancelled: ${r.error}`);
        this.draft = null; this.draftCounts = null; this.resetToLobby();
        return r;
      }
      d.stage = 'deal'; d.stageAt = this.now();
      this.sync();
    }
    return { ok: true };
  };

  // A player toggles a vote for a card (up to `picks` cards), or locks in.
  Room.prototype.draftVote = function (p, { role, on, ready } = {}) {
    const d = this.draft;
    if (!d || this.phase !== 'draft' || d.stage !== 'vote') return { ok: false, error: 'Voting on roles is closed.' };
    if (!p || p.spectator || p.left || p.isJudge || p.judgeRetired) return { ok: false, error: 'Only players in this game can vote.' };
    if (d.ready[p.id]) return { ok: false, error: 'You already locked in your votes.' };
    const mine = d.ballots[p.id] || [];
    if (ready) {
      d.ready[p.id] = true;
    } else {
      if (!d.cards.includes(role)) return { ok: false, error: 'That card is not in this draft.' };
      const want = on == null ? !mine.includes(role) : !!on;
      if (want && !mine.includes(role)) {
        if (mine.length >= d.picks) return { ok: false, error: `You can vote for up to ${d.picks} cards. Remove one first.` };
        d.ballots[p.id] = [...mine, role];
      } else if (!want) d.ballots[p.id] = mine.filter((k) => k !== role);
    }
    this.touch();
    this.draftMaybeClose();
    this.sync();
    return { ok: true };
  };

  // Everyone who can vote has locked in: close the vote shortly.
  Room.prototype.draftMaybeClose = function () {
    const d = this.draft;
    if (!d || d.stage !== 'vote' || this.paused) return;
    const voters = this.draftPlayers().filter((p) => p.isBot || p.sockets > 0);
    if (voters.length && voters.every((p) => d.ready[p.id]) && this.endsAt - this.now() > ALL_READY_MS / this.speed()) this.draftTimer(ALL_READY_MS);
  };

  // Bots vote for a few random cards and lock in.
  Room.prototype.draftBots = function () {
    const d = this.draft, id = d.id;
    for (const p of this.draftPlayers().filter((x) => x.isBot)) {
      this.later((800 + this.rng() * 3500) / this.speed(), () => {
        if (!this.draft || this.draft.id !== id || this.draft.stage !== 'vote' || this.paused) return;
        const picks = d.cards.filter(() => this.rng() < 0.5).slice(0, d.picks);
        for (const role of picks) this.draftVote(p, { role, on: true });
        this.draftVote(p, { ready: true });
      });
    }
  };

  // Public draft state (same for the TV and every phone). Never contains anyone's role.
  Room.prototype.draftView = function (p) {
    const d = this.draft;
    if (!d || !['draft', 'roleReveal'].includes(this.phase)) return null;
    const tally = Object.fromEntries(d.cards.map((k) => [k, 0]));
    const ids = new Set(this.draftPlayers().map((x) => x.id));
    for (const [id, picks] of Object.entries(d.ballots)) if (ids.has(id)) for (const k of picks) tally[k]++;
    const voters = this.draftPlayers();
    const v = {
      id: d.id, stage: this.phase === 'roleReveal' ? 'deal' : d.stage, stageAt: d.stageAt, cards: d.cards, picks: d.picks, tally,
      voted: voters.filter((x) => (d.ballots[x.id] || []).length || d.ready[x.id]).length,
      ready: voters.filter((x) => d.ready[x.id]).length, total: voters.length,
      readyIds: voters.filter((x) => d.ready[x.id]).map((x) => x.id),
      result: d.result ? { roles: d.result.roles, tie: d.result.tie, fallback: d.result.fallback } : null,
    };
    if (this.phase === 'roleReveal') v.flippedIds = this.inGame().filter((x) => x.flipped).map((x) => x.id); // who has looked, never what
    if (p) { v.mine = d.ballots[p.id] || []; v.locked = !!d.ready[p.id]; }
    return v;
  };

  // Dealt card: the player flips their own card (only marks that they looked).
  Room.prototype.flipCard = function (p) {
    if (!p || this.phase !== 'roleReveal' || !p.role || p.spectator) return { ok: false };
    if (!p.flipped) {
      p.flipped = true;
      const waiting = this.inGame().filter((x) => !x.isBot && x.sockets > 0 && !x.flipped);
      if (this.draft && !waiting.length) this.finishSoon(3500); // everyone has seen their card
      this.sync();
    }
    return { ok: true };
  };

  Room.prototype.draftDealMs = function () { return DEAL_EXTRA_MS; };
};
