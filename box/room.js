'use strict';
// JustGameBox: one room = one party playing one of the box's games.
// The room owns joining, reconnection, bots, settings, timers and syncing; the game
// module owns the rules. The TV only ever receives game.tv() (public information)
// and each phone only game.view(player) (that player's private information).
const crypto = require('crypto');
const { RealClock } = require('../clock');
const { Show, SHOW_FIELD, CAST_FIELD } = require('./show');

const BOT_NAMES = ['Ace', 'Bluff', 'Clover', 'Dice', 'Echo', 'Fizz', 'Gizmo', 'Hex', 'Inky', 'Jinx', 'Kip', 'Lucky', 'Mango', 'Nova', 'Ozzy', 'Pip', 'Quill', 'Rook', 'Sly', 'Tango', 'Ufo', 'Vex', 'Wren', 'Yuki', 'Zed'];
const COLORS = ['#ff5a5f', '#ffb400', '#00a699', '#7b61ff', '#ff7ac6', '#3ec1ff', '#8bd346', '#ff8c42', '#b388ff', '#2ee6a6', '#f25f5c', '#ffd23f'];
const MAX_PLAYERS = 100;
// Avatars players pick when they join (shown on the TV and in every game that wants it).
const AVATARS = ['🦊', '🐸', '🐼', '🐙', '🦄', '🐯', '🐵', '🐧', '🦉', '🐢', '🦁', '🐨', '🐷', '🐰', '🐻', '🦖', '👽', '👻', '🎃', '🌵', '🍕', '🍩', '⭐', '🔥'];
// Quick reactions any phone can float up on the TV.
const REACTIONS = ['😂', '😮', '😍', '👏', '🔥', '😱', '💀', '🤔', '👎', '🎉'];
// Party points for finishing places in a game (everyone else who played gets 1).
const PARTY_POINTS = [10, 7, 5, 4, 3, 2];
// Party Mode: a shuffled lineup of games played back to back. After each game its end screen
// stays up for BOARD_DELAY, then the standings board (BOARD_MS), then the next game starts.
const BOARD_DELAY = 7000, BOARD_MS = 15000, MAX_LINEUP = 20;
// Unlockable games (module `locked: { how }`): finishing a whole Party Mode opens every one of
// them. The TV remembers unlocks (public/unlocks.js) and sends them when it creates a room.
const partyFinished = (room) => !!(room.partyMode && room.partyMode.phase === 'done' && room.played.length >= 1);
const UNLOCK_RULES = { zombie: { title: 'Zombie Survival', test: partyFinished } };

const cleanName = (s) => String(s || '').replace(/[\u0000-\u001f<>&"]/g, '').replace(/\s+/g, ' ').trim().slice(0, 14);

class BoxRoom {
  constructor(code, game, { nsp = null, clock = new RealClock(), seed = null, shows = false } = {}) {
    this.shows = shows; // game-show openings (the live server turns them on; rules tests skip them)
    this.show = null;
    this.code = code;
    this.def = game; // the game module (rules, defaults, settings fields)
    this.nsp = nsp;
    this.clock = clock;
    this.hostKey = crypto.randomBytes(6).toString('hex');
    this.players = new Map();
    this.phase = 'lobby'; // lobby → game (the game itself tracks rounds and the end)
    this.settings = this.defaultSettings(game);
    this.game = null;
    this.timers = new Set();
    this.seq = 0;
    this.fxSeq = 0;
    this.fxLog = [];
    this.lastActivity = Date.now();
    let s = (seed == null ? crypto.randomBytes(4).readUInt32LE(0) : seed) >>> 0 || 1;
    this.rng = () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s >>>= 0; s ^= s << 5; s >>>= 0; return s / 4294967296; };
    this.pending = false;
    // One room lasts the whole night: games can be switched without anyone rejoining,
    // and party points add up across every game played.
    this.party = new Map(); // player id → { pts, wins, games }
    this.played = []; // [{ game, title, winner }]
    this.scored = null; // the game instance already scored
    this.unlocks = new Set(); // unlockable games this TV has opened
    this.partyMode = null; // Party Mode: { defs, index, minutes, phase: playing|ending|board|done, at, paused, timer }
    this.lastGain = new Map(); // points each player won in the last scored game (board animation)
    this.prevRank = new Map(); // rank before the last scored game
    // Games with a live lobby (JustRaiseDucks) exist from the start: farms appear as people join.
    if (game.liveLobby) this.game = game.create(this, this.settings);
  }

  now() { return this.clock.now(); }
  // Games with a game-show opening get an extra lobby setting to turn it off.
  hasShow(def = this.def) { return !!(this.shows && def.show); }
  fieldsOf() { return this.hasShow() ? [...(this.def.fields || []), this.def.show.facts === false ? CAST_FIELD : SHOW_FIELD] : this.def.fields || []; }
  defaultSettings(def) { return { ...def.defaults, ...(this.hasShow(def) ? { showIntro: true } : {}) }; }
  // Jackbox-style host: the first person (not a bot) who joined and is still here.
  vip() { for (const p of this.players.values()) if (!p.bot) return p; return null; }
  // What the host's phone may do: start from the lobby, or play again when the game is over.
  vipAction(p, type) {
    const v = this.vip();
    if (!v || v.id !== p.id) return { ok: false, error: 'Only the host can do that.' };
    if (type === 'start' && this.phase === 'lobby') return this.start();
    if (type === 'again' && this.game && this.game.phase === 'over') return this.hostAction({ type: 'again' });
    if (type === 'lobby' && this.phase !== 'lobby') return this.hostAction({ type: 'lobby' });
    if (type === 'next' && this.phase === 'show' && this.show) { this.show.skip(); this.sync(); return { ok: true }; }
    if (type === 'next' && this.phase === 'game' && this.game && this.game.phase !== 'over') return this.hostAction({ type: 'next' });
    if (type === 'partyNext' || type === 'partyPause' || type === 'partyAgain') return this.hostAction({ type });
    if (type === 'bots') return this.hostAction({ type: 'addBots', count: 5 });
    if (type === 'nobots') return this.hostAction({ type: 'removeBots' });
    return { ok: false, error: 'Not now.' };
  }
  // Move everyone to another game, keeping the room code, players and party points.
  switchGame(def) {
    if (!def) return { ok: false, error: 'Unknown game.' };
    if (this.isLocked(def)) return { ok: false, error: `🔒 ${def.name} is locked. ${def.locked.how || ''}`.trim() };
    if (this.phase !== 'lobby' && !(this.game && this.game.phase === 'over')) return { ok: false, error: 'Finish this game first (or go back to the lobby).' };
    this.scoreParty();
    this.clearTimers();
    if (this.partyMode && this.partyMode.phase !== 'done') this.partyMode.phase = 'playing';
    this.def = def; this.settings = this.defaultSettings(def); this.phase = 'lobby'; this.show = null;
    this.game = def.liveLobby ? def.create(this, this.settings) : null;
    if (this.game && this.game.joined) for (const p of this.players.values()) this.game.joined(p);
    this.fx('switch');
    this.sync();
    return { ok: true, game: def.key };
  }
  setAvatar(p, a) { if (!AVATARS.includes(a)) return { ok: false, error: 'Pick one of the avatars.' }; p.avatar = a; this.sync(); return { ok: true }; }

  // ---- party points across the night ----
  partyRow(id) { let r = this.party.get(id); if (!r) { r = { pts: 0, wins: 0, games: 0 }; this.party.set(id, r); } return r; }
  // Called whenever the screens update: a finished game pays out party points once.
  scoreParty() {
    const g = this.game;
    if (!g || this.phase !== 'game' || g.phase !== 'over' || this.scored === g) return;
    this.scored = g;
    let order = null;
    try { if (typeof g.results === 'function') order = g.results(); } catch (e) { order = null; }
    if (!Array.isArray(order) || !order.length) {
      // Fallback: a standings list with ids in the game's TV state.
      try { const t = g.tv() || {}; const st = t.standings || t.final || t.ranking; if (Array.isArray(st)) order = st.map((r) => r && r.id).filter(Boolean); } catch (e) { order = null; }
    }
    order = [...new Set((order || []).filter((id) => this.players.has(id)))];
    this.prevRank = new Map(this.partyBoard().map((r, i) => [r.id, i + 1])); this.lastGain = new Map();
    order.forEach((id, i) => { const r = this.partyRow(id), add = PARTY_POINTS[i] || 1; r.pts += add; r.games++; if (i === 0) r.wins++; this.lastGain.set(id, add); });
    this.played.push({ game: this.def.key, title: this.def.name, winner: order[0] ? this.name(order[0]) : null });
    if (this.played.length > 40) this.played.shift();
    this.checkUnlocks();
    if (this.partyMode) this.partyAfterGame();
  }
  // ---- unlockable games ----
  isLocked(def) { return !!(def && def.locked && !this.unlocks.has(def.key)); }
  setUnlocks(list) { if (Array.isArray(list)) for (const k of list) if (typeof k === 'string' && UNLOCK_RULES[k]) this.unlocks.add(k); }
  checkUnlocks() {
    for (const [key, rule] of Object.entries(UNLOCK_RULES)) {
      if (this.unlocks.has(key)) continue;
      let ok = false; try { ok = rule.test(this); } catch (e) { ok = false; }
      if (ok) { this.unlocks.add(key); this.fx('unlock', { key, title: rule.title }); }
    }
  }

  // ---- Party Mode ----
  setParty(defs, minutes) {
    defs = (defs || []).filter((d) => d && !this.isLocked(d)).slice(0, MAX_LINEUP);
    if (!defs.length) return { ok: false, error: 'Pick some games.' };
    this.partyMode = { defs, index: 0, minutes: Math.max(10, Math.min(600, Number(minutes) || 60)), phase: 'playing', at: this.now(), startedAt: null, paused: false, timer: null };
    return { ok: true };
  }
  // A game just ended: let its end screen breathe, then the standings board, then the next game.
  partyAfterGame() {
    const pm = this.partyMode; if (!pm || pm.phase !== 'playing') return;
    const last = pm.index >= pm.defs.length - 1;
    pm.phase = 'ending'; pm.at = this.now() + BOARD_DELAY;
    this.cancel(pm.timer);
    pm.timer = this.after(BOARD_DELAY, () => {
      if (!this.partyMode || pm.phase !== 'ending') return;
      pm.phase = last ? 'done' : 'board'; pm.at = this.now() + (last ? 0 : BOARD_MS);
      if (last) this.checkUnlocks();
      this.fx(last ? 'partyDone' : 'partyBoard');
      if (!last && !pm.paused) pm.timer = this.after(BOARD_MS, () => this.partyNext());
    });
  }
  // On to the next game in the lineup (skipping any that need more players than are here).
  partyNext() {
    const pm = this.partyMode; if (!pm || pm.phase === 'done') return { ok: false, error: 'The party is over!' };
    if (this.phase === 'game' && this.game && this.game.phase !== 'over') return { ok: false, error: 'Finish this game first.' };
    this.cancel(pm.timer); pm.timer = null;
    let i = pm.index + 1;
    while (i < pm.defs.length && pm.defs[i].min > this.players.size) i++;
    if (i >= pm.defs.length) { pm.phase = 'done'; pm.at = this.now(); this.checkUnlocks(); this.sync(); return { ok: true, done: true }; }
    pm.index = i; pm.phase = 'playing'; pm.at = this.now();
    const sw = this.switchGame(pm.defs[i]); if (!sw.ok) return sw;
    const st = this.start();
    this.sync();
    return st;
  }
  partyPause(on) {
    const pm = this.partyMode; if (!pm) return { ok: false };
    pm.paused = on == null ? !pm.paused : !!on;
    if (pm.phase === 'board') {
      this.cancel(pm.timer); pm.timer = null;
      if (!pm.paused) { pm.at = this.now() + 5000; pm.timer = this.after(5000, () => this.partyNext()); }
    }
    this.sync(); return { ok: true, paused: pm.paused };
  }
  // The whole party again from the top, with fresh points.
  partyAgain() {
    const pm = this.partyMode; if (!pm) return { ok: false };
    if (this.phase === 'game' && this.game && this.game.phase !== 'over') return { ok: false, error: 'Finish this game first.' };
    this.cancel(pm.timer); this.party = new Map(); this.played = []; this.lastGain = new Map(); this.prevRank = new Map();
    pm.index = 0; pm.phase = 'playing'; pm.at = this.now(); pm.startedAt = null; pm.paused = false;
    const sw = this.switchGame(pm.defs[0]); if (!sw.ok) return sw;
    this.sync(); return { ok: true };
  }
  partyState() {
    const pm = this.partyMode; if (!pm) return null;
    return { games: pm.defs.map((d) => d.key), titles: pm.defs.map((d) => d.name), index: pm.index, minutes: pm.minutes, phase: pm.phase, paused: pm.paused,
      in: Math.max(0, pm.at - this.now()), elapsed: pm.startedAt == null ? 0 : this.now() - pm.startedAt,
      next: pm.defs[pm.index + 1] ? pm.defs[pm.index + 1].key : null, boardMs: BOARD_MS };
  }
  partyBoard() {
    return [...this.party].filter(([id]) => this.players.has(id)).map(([id, r]) => { const p = this.players.get(id); return { id, name: p.name, avatar: p.avatar, color: p.color, bot: p.bot, pts: r.pts, wins: r.wins, games: r.games, gain: this.lastGain.get(id) || 0, prevRank: this.prevRank.get(id) || null }; })
      .sort((a, b) => b.pts - a.pts || b.wins - a.wins || a.name.localeCompare(b.name));
  }
  // Timers belong to the room: cleared on restart/destroy; each one re-syncs the screens.
  after(ms, fn) {
    const h = this.clock.set(() => { this.timers.delete(h); fn(); this.sync(); }, Math.max(0, ms));
    this.timers.add(h); return h;
  }
  cancel(h) { if (h != null) { this.clock.clear(h); this.timers.delete(h); } }
  clearTimers() { for (const h of this.timers) this.clock.clear(h); this.timers.clear(); }
  // A sound/animation cue for the big screen (the TV plays each new id once).
  fx(kind, data = {}) { this.fxLog.push({ ...data, who: data.id, kind, id: ++this.fxSeq }); /* a player id in data moves to `who`, so the cue's own id keeps counting up */ if (this.fxLog.length > 30) this.fxLog.shift(); }

  list() { return [...this.players.values()]; }
  get(id) { return this.players.get(id); }
  name(id) { const p = this.players.get(id); return p ? p.name : '—'; }

  join(name, token, avatar) {
    this.lastActivity = Date.now();
    if (token) { const back = this.list().find((p) => p.token === token); if (back) return { ok: true, player: back, back: true }; }
    name = cleanName(name);
    if (!name) return { ok: false, error: 'Type a name first.' };
    if (this.players.size >= MAX_PLAYERS) return { ok: false, error: `This room is full (${MAX_PLAYERS} players).` };
    if (this.list().some((p) => p.name.toLowerCase() === name.toLowerCase())) return { ok: false, error: 'Someone already has that name.' };
    const p = { id: 'p' + (++this.seq), name, token: crypto.randomBytes(8).toString('hex'), bot: false, sockets: 0, color: COLORS[this.seq % COLORS.length], avatar: AVATARS.includes(avatar) ? avatar : AVATARS[this.seq % AVATARS.length] };
    this.players.set(p.id, p);
    if (this.game && this.game.joined) this.game.joined(p);
    this.sync();
    return { ok: true, player: p };
  }

  addBots(n) {
    let added = 0;
    for (let i = 0; i < n && this.players.size < MAX_PLAYERS; i++) {
      let name, k = 0;
      do name = BOT_NAMES[(this.seq + k) % BOT_NAMES.length] + (k >= BOT_NAMES.length ? Math.floor(k / BOT_NAMES.length) + 1 : '') + ' 🤖'; while (this.list().some((p) => p.name === name) && ++k < 1000);
      const p = { id: 'p' + (++this.seq), name, token: null, bot: true, sockets: 1, color: COLORS[this.seq % COLORS.length], avatar: AVATARS[this.seq % AVATARS.length] };
      this.players.set(p.id, p); added++;
      if (this.game && this.game.joined) this.game.joined(p);
    }
    this.sync();
    return added;
  }

  remove(id) {
    const p = this.players.get(id); if (!p) return;
    this.players.delete(id);
    if (this.game && this.game.left) this.game.left(p);
    this.sync();
  }

  hostAction(msg = {}) {
    this.lastActivity = Date.now();
    switch (msg.type) {
      case 'settings': {
        for (const f of this.fieldsOf()) {
          if (!msg.settings || !(f.key in msg.settings)) continue;
          const v = msg.settings[f.key];
          if (f.options) { const o = f.options.find((x) => String(x.value) === String(v)); if (o) this.settings[f.key] = o.value; }
          else if (f.type === 'bool') this.settings[f.key] = v === true || v === 'true';
        }
        this.sync(); return { ok: true, settings: this.settings };
      }
      case 'addBots': return { ok: true, added: this.addBots(Math.max(1, Math.min(50, Number(msg.count) || 5))) };
      case 'removeBots': for (const p of this.list()) if (p.bot) this.remove(p.id); return { ok: true };
      case 'kick': this.remove(msg.id); return { ok: true };
      case 'start': return this.start();
      case 'again': this.resetLobby(); return this.start(); // every game: back to a fresh lobby, then start
      case 'next': if (this.phase === 'show' && this.show) { this.show.skip(); this.sync(); return { ok: true }; }
        if (!this.game || !this.game.next) return { ok: false }; this.game.next(); this.sync(); return { ok: true };
      case 'lobby': this.resetLobby(); this.sync(); return { ok: true };
      case 'partyNext': return this.partyNext();
      case 'partyPause': return this.partyPause(msg.on);
      case 'partyAgain': return this.partyAgain();
      default: // game-specific TV reports (e.g. JustFunny: a video ended)
        if (this.game && this.game.hostAct) { const r = this.game.hostAct(msg) || { ok: true }; this.sync(); return r; }
        return { ok: false, error: 'Unknown action.' };
    }
  }

  resetLobby() {
    this.scoreParty();
    this.clearTimers(); this.show = null;
    if (this.partyMode && this.partyMode.phase !== 'done') this.partyMode.phase = 'playing'; // replaying this game: the board waits for its end
    this.phase = 'lobby';
    this.game = this.def.liveLobby ? this.def.create(this, this.settings) : null;
    if (this.game) for (const p of this.players.values()) if (this.game.joined) this.game.joined(p);
  }
  start() {
    if (this.phase !== 'lobby') return { ok: false, error: 'The game is already running.' };
    if (this.players.size < this.def.min) return { ok: false, error: `${this.def.name} needs at least ${this.def.min} players (bots count).` };
    this.clearTimers();
    if (this.def.liveLobby && this.game) this.game.s = { ...this.settings }; // the lobby world carries on into the game
    else this.game = this.def.create(this, { ...this.settings });
    if (this.partyMode && this.partyMode.startedAt == null) this.partyMode.startedAt = this.now();
    if (this.hasShow() && this.settings.showIntro !== false) {
      this.phase = 'show'; this.show = new Show(this); this.fx('show'); this.show.begin(); this.sync();
      return { ok: true };
    }
    this.beginGame();
    return { ok: true };
  }
  // After the show opening (or straight from start): the game itself begins.
  beginGame() {
    this.show = null; this.phase = 'game';
    this.fx('start');
    this.game.start();
    this.sync();
  }

  act(p, msg) {
    this.lastActivity = Date.now();
    if (this.phase === 'show' && this.show) {
      if (msg && msg.op === 'fact') { const r = this.show.submit(p, msg.text); this.sync(); return r; }
      return { ok: false, error: 'The show is about to start!' };
    }
    if (!this.game || !this.game.act) return { ok: false, error: 'The game has not started yet.' };
    const r = this.game.act(p, msg || {}) || { ok: true };
    // A game can answer { quiet: true } when nothing changed (e.g. a rate-limited reaction),
    // so 100 phones spamming a button don't re-send every screen.
    if (r && r.quiet) { delete r.quiet; return r; }
    this.sync();
    return r;
  }

  tvState() {
    return {
      code: this.code, game: this.def.key, title: this.def.name, phase: this.phase, settings: this.settings,
      fields: this.fieldsOf(), min: this.def.min, max: MAX_PLAYERS, fx: this.fxLog, live: !!this.def.liveLobby,
      vip: this.vip() ? this.vip().name : null,
      players: this.list().map((p) => ({ id: p.id, name: p.name, bot: p.bot, color: p.color, avatar: p.avatar, online: p.bot || p.sockets > 0 })),
      party: this.partyBoard().slice(0, 24), played: this.played.slice(-24), partyMode: this.partyState(), unlocks: [...this.unlocks],
      state: this.game && this.phase !== 'show' ? this.game.tv() : null, show: this.show ? this.show.tv() : null,
    };
  }
  playerState(p) {
    return {
      code: this.code, game: this.def.key, title: this.def.name, phase: this.phase,
      me: { id: p.id, name: p.name, color: p.color, avatar: p.avatar },
      party: (() => { const b = this.partyBoard(), i = b.findIndex((r) => r.id === p.id); return { played: this.played.length, pts: i >= 0 ? b[i].pts : 0, wins: i >= 0 ? b[i].wins : 0, gain: i >= 0 ? b[i].gain : 0, rank: i + 1, of: b.length, top: b.slice(0, 5) }; })(),
      partyMode: this.partyState(), unlocks: [...this.unlocks], count: this.players.size, min: this.def.min, live: !!this.def.liveLobby,
      vip: !!this.vip() && this.vip().id === p.id, vipName: this.vip() ? this.vip().name : null,
      state: this.game && this.phase !== 'show' ? this.game.view(p) : null, show: this.show ? this.show.view(p) : null,
    };
  }

  // Coalesce: many changes in one tick send one update per screen.
  sync() {
    if (!this.nsp || this.pending) return;
    this.pending = true;
    setImmediate(() => { this.pending = false; this.flush(); });
  }
  flush() {
    this.scoreParty();
    if (!this.nsp) return;
    this.nsp.to('host:' + this.code).emit('tv', this.tvState());
    for (const p of this.players.values()) if (!p.bot && p.sockets > 0) this.nsp.to('pl:' + this.code + ':' + p.id).emit('me', this.playerState(p));
  }

  destroy() { this.clearTimers(); this.game = null; }
}

module.exports = { UNLOCK_RULES, BoxRoom, MAX_PLAYERS, cleanName, AVATARS, REACTIONS };
