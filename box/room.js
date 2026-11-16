'use strict';
// JustGameBox: one room = one party playing one of the box's games.
// The room owns joining, reconnection, bots, settings, timers and syncing; the game
// module owns the rules. The TV only ever receives game.tv() (public information)
// and each phone only game.view(player) (that player's private information).
const crypto = require('crypto');
const { RealClock } = require('../clock');

const BOT_NAMES = ['Ace', 'Bluff', 'Clover', 'Dice', 'Echo', 'Fizz', 'Gizmo', 'Hex', 'Inky', 'Jinx', 'Kip', 'Lucky', 'Mango', 'Nova', 'Ozzy', 'Pip', 'Quill', 'Rook', 'Sly', 'Tango', 'Ufo', 'Vex', 'Wren', 'Yuki', 'Zed'];
const COLORS = ['#ff5a5f', '#ffb400', '#00a699', '#7b61ff', '#ff7ac6', '#3ec1ff', '#8bd346', '#ff8c42', '#b388ff', '#2ee6a6', '#f25f5c', '#ffd23f'];
const MAX_PLAYERS = 100;

const cleanName = (s) => String(s || '').replace(/[\u0000-\u001f<>&"]/g, '').replace(/\s+/g, ' ').trim().slice(0, 14);

class BoxRoom {
  constructor(code, game, { nsp = null, clock = new RealClock(), seed = null } = {}) {
    this.code = code;
    this.def = game; // the game module (rules, defaults, settings fields)
    this.nsp = nsp;
    this.clock = clock;
    this.hostKey = crypto.randomBytes(6).toString('hex');
    this.players = new Map();
    this.phase = 'lobby'; // lobby → game (the game itself tracks rounds and the end)
    this.settings = { ...game.defaults };
    this.game = null;
    this.timers = new Set();
    this.seq = 0;
    this.fxSeq = 0;
    this.fxLog = [];
    this.lastActivity = Date.now();
    let s = (seed == null ? crypto.randomBytes(4).readUInt32LE(0) : seed) >>> 0 || 1;
    this.rng = () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s >>>= 0; s ^= s << 5; s >>>= 0; return s / 4294967296; };
    this.pending = false;
    // Games with a live lobby (JustRaiseDucks) exist from the start: farms appear as people join.
    if (game.liveLobby) this.game = game.create(this, this.settings);
  }

  now() { return this.clock.now(); }
  // Jackbox-style host: the first person (not a bot) who joined and is still here.
  vip() { for (const p of this.players.values()) if (!p.bot) return p; return null; }
  // What the host's phone may do: start from the lobby, or play again when the game is over.
  vipAction(p, type) {
    const v = this.vip();
    if (!v || v.id !== p.id) return { ok: false, error: 'Only the host can do that.' };
    if (type === 'start' && this.phase === 'lobby') return this.start();
    if (type === 'again' && this.game && this.game.phase === 'over') return this.hostAction({ type: 'again' });
    if (type === 'lobby' && this.game && this.game.phase === 'over') return this.hostAction({ type: 'lobby' });
    return { ok: false, error: 'Not now.' };
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

  join(name, token) {
    this.lastActivity = Date.now();
    if (token) { const back = this.list().find((p) => p.token === token); if (back) return { ok: true, player: back, back: true }; }
    name = cleanName(name);
    if (!name) return { ok: false, error: 'Type a name first.' };
    if (this.players.size >= MAX_PLAYERS) return { ok: false, error: `This room is full (${MAX_PLAYERS} players).` };
    if (this.list().some((p) => p.name.toLowerCase() === name.toLowerCase())) return { ok: false, error: 'Someone already has that name.' };
    const p = { id: 'p' + (++this.seq), name, token: crypto.randomBytes(8).toString('hex'), bot: false, sockets: 0, color: COLORS[this.seq % COLORS.length] };
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
      const p = { id: 'p' + (++this.seq), name, token: null, bot: true, sockets: 1, color: COLORS[this.seq % COLORS.length] };
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
        for (const f of this.def.fields || []) {
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
      case 'next': if (!this.game || !this.game.next) return { ok: false }; this.game.next(); this.sync(); return { ok: true };
      case 'lobby': this.resetLobby(); this.sync(); return { ok: true };
      default: // game-specific TV reports (e.g. JustFunny: a video ended)
        if (this.game && this.game.hostAct) { const r = this.game.hostAct(msg) || { ok: true }; this.sync(); return r; }
        return { ok: false, error: 'Unknown action.' };
    }
  }

  resetLobby() {
    this.clearTimers(); this.phase = 'lobby';
    this.game = this.def.liveLobby ? this.def.create(this, this.settings) : null;
    if (this.game) for (const p of this.players.values()) if (this.game.joined) this.game.joined(p);
  }
  start() {
    if (this.phase !== 'lobby') return { ok: false, error: 'The game is already running.' };
    if (this.players.size < this.def.min) return { ok: false, error: `${this.def.name} needs at least ${this.def.min} players (bots count).` };
    this.clearTimers();
    if (this.def.liveLobby && this.game) this.game.s = { ...this.settings }; // the lobby world carries on into the game
    else this.game = this.def.create(this, { ...this.settings });
    this.phase = 'game';
    this.fx('start');
    this.game.start();
    this.sync();
    return { ok: true };
  }

  act(p, msg) {
    this.lastActivity = Date.now();
    if (!this.game || !this.game.act) return { ok: false, error: 'The game has not started yet.' };
    const r = this.game.act(p, msg || {}) || { ok: true };
    this.sync();
    return r;
  }

  tvState() {
    return {
      code: this.code, game: this.def.key, title: this.def.name, phase: this.phase, settings: this.settings,
      fields: this.def.fields || [], min: this.def.min, max: MAX_PLAYERS, fx: this.fxLog, live: !!this.def.liveLobby,
      vip: this.vip() ? this.vip().name : null,
      players: this.list().map((p) => ({ id: p.id, name: p.name, bot: p.bot, color: p.color, online: p.bot || p.sockets > 0 })),
      state: this.game ? this.game.tv() : null,
    };
  }
  playerState(p) {
    return {
      code: this.code, game: this.def.key, title: this.def.name, phase: this.phase,
      me: { id: p.id, name: p.name, color: p.color }, count: this.players.size, min: this.def.min, live: !!this.def.liveLobby,
      vip: !!this.vip() && this.vip().id === p.id, vipName: this.vip() ? this.vip().name : null,
      state: this.game ? this.game.view(p) : null,
    };
  }

  // Coalesce: many changes in one tick send one update per screen.
  sync() {
    if (!this.nsp || this.pending) return;
    this.pending = true;
    setImmediate(() => { this.pending = false; this.flush(); });
  }
  flush() {
    if (!this.nsp) return;
    this.nsp.to('host:' + this.code).emit('tv', this.tvState());
    for (const p of this.players.values()) if (!p.bot && p.sockets > 0) this.nsp.to('pl:' + this.code + ':' + p.id).emit('me', this.playerState(p));
  }

  destroy() { this.clearTimers(); this.game = null; }
}

module.exports = { BoxRoom, MAX_PLAYERS, cleanName };
