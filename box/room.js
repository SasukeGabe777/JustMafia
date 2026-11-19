'use strict';
// JustGameBox: one room = one party playing one of the box's games.
// The room owns joining, reconnection, bots, settings, timers and syncing; the game
// module owns the rules. The TV only ever receives game.tv() (public information)
// and each phone only game.view(player) (that player's private information).
const crypto = require('crypto');
const { RealClock } = require('../clock');
const { Show, SHOW_FIELD, CAST_FIELD } = require('./show');
const TEXT = require('../public/box/filter');
const { buildRecap, personalRecap } = require('./recap');

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
const BOARD_DELAY = 12000, BOARD_MS = 15000, MAX_LINEUP = 20;
// Party Mode intros ("🎬 Intros" in the setup; the host can change it mid-party):
//  'play'  each game opens with its intro cutscene and how-to steps (as a single game does);
//  'break' the next game's cutscene plays on the TV during the standings break (after BREAK_STAND_MS
//          of standings), so the game starts straight away; the first game's plays as the party starts;
//  'skip'  a short title card (CARD_MS) and straight in. The how-to steps stay on the phones' ❓.
const INTRO_MODES = ['play', 'break', 'skip'], BREAK_STAND_MS = 8000;
const PF = require('./party-fit');
const { CAST_OPEN_MS, CAST_PER_MS, CAST_OUTRO_MS, CAST_MAX } = require('./show');
// Unlockable games (module `locked: { how }`): finishing a whole Party Mode opens every one of
// them. The TV remembers unlocks (public/unlocks.js) and sends them when it creates a room.
const partyFinished = (room) => !!(room.partyMode && room.partyMode.phase === 'done' && room.played.length >= 1);
const playedGame = (key) => (room) => room.played.some((g) => g.game === key);
const UNLOCK_RULES = {
  zombie: { title: 'Zombie Survival', test: partyFinished },
  plinko: { title: 'JustDrop', test: playedGame('blackjack') }, // finish a casino game (Blackjack Night)
  quickdraw: { title: "Quick Draw", test: playedGame('president') },
  bomb: { title: "Bomb Squad", test: playedGame('truths') },
  alien: { title: "Alien Abduction", test: playedGame('likely') },
  tune: { title: "Tune Buzz", test: playedGame('funny') },
  actout: { title: "Act It Out", test: playedGame('sketch') },
  debate: { title: "Debate Club", test: playedGame('spectrum') },
  trivia: { title: "Hot Take Trivia", test: playedGame('price') },
  colormatch: { title: "Color Match", test: playedGame('emoji') },
  memes: { title: "Meme Maker", test: playedGame('blanks') },
  letters: { title: "Letter Rush", test: playedGame('whosaid') },
};

// Player-typed text for the screens: swear words and slurs covered.
// Games call room.cleanText(s), which filters when the TV turned on "Filter player text".
const cleanText = (s, strict = false) => TEXT.filter(s, { strict });
// Audience: people watching a running game (or a full/locked room). They get one compact
// shared state (not a per-person one), vote in polls and send reactions; "play next" ones
// join as players at the next lobby.
const MAX_AUDIENCE = 2000, FAV_BONUS = 3, FAV_MS = 20000, RECAP_AFTER_PARTY = 16000;
const cleanName = (s) => String(s || '').replace(/[\u0000-\u001f<>&"]/g, '').replace(/\s+/g, ' ').trim().slice(0, 14);

const GOLD = require('./gold');

class BoxRoom {
  constructor(code, game, { nsp = null, clock = new RealClock(), seed = null, shows = false, profiles = null, wallets = null } = {}) {
    this.wallets = wallets; // JustGold wallets (JustMafia's ProfileStore; docs/justgold.md) or null
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
    // Games played somewhere else (JustMafia has its own server and pages): the room hands
    // everyone over and waits. onExternal(def, room) → { ok, code, hostKey } is set by the
    // box server; `away` = { game, title, code, hostKey } while the party is over there.
    this.onExternal = null;
    this.away = null;
    this.filterOn = false; // the TV's "Filter player text" streamer option
    this.locked = false; // host locked the room: new joiners can only watch
    this.audience = new Map(); // audience id → { id, name, token, avatar, color, sockets, playNext, at }
    this.aseq = 0; this.poll = null; this.audSig = ''; this.audPending = false; this.reactAt = [];
    this.recap = null; // the end-of-night recap snapshot while the TV plays the reel
    this.profiles = profiles; // lifetime profiles (box/profiles.js) or null
    this.nightKey = code + ':' + this.hostKey; this.nightStart = null;
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
    if (type === 'partyNext' || type === 'partyPause' || type === 'partyAgain' || type === 'partyBoardNow') return this.hostAction({ type });
    if (type === 'bots') return this.hostAction({ type: 'addBots', count: 5 });
    if (type === 'nobots') return this.hostAction({ type: 'removeBots' });
    return { ok: false, error: 'Not now.' };
  }
  // Move everyone to another game, keeping the room code, players and party points.
  switchGame(def) {
    if (!def) return { ok: false, error: 'Unknown game.' };
    if (this.isLocked(def)) return { ok: false, error: `🔒 ${def.name} is locked. ${def.locked.how || ''}`.trim() };
    if (this.phase !== 'lobby' && !(this.game && this.game.phase === 'over')) return { ok: false, error: 'Finish this game first (or go back to the lobby).' };
    if (def.external) return this.goExternal(def);
    this.scoreParty();
    this.closePoll();
    this.clearTimers();
    this.away = null;
    if (this.partyMode) this.partyMode.ext = false;
    if (this.partyMode && this.partyMode.phase !== 'done') this.partyMode.phase = 'playing';
    this.def = def; this.settings = this.defaultSettings(def); this.phase = 'lobby'; this.show = null;
    this.partyFit(); // Party Mode: settings that suit this crowd and this game's slot in the plan
    this.game = def.liveLobby ? def.create(this, this.settings) : null;
    if (this.game && this.game.joined) for (const p of this.players.values()) this.game.joined(p);
    this.promoteAudience();
    this.fx('switch');
    this.sync();
    return { ok: true, game: def.key };
  }
  // ---- games played elsewhere (JustMafia) ----
  // Hand the whole room over: the TV and phones follow `away` (in their state) to the other
  // game. This room keeps its players and points, and waits in the lobby of its last game.
  goExternal(def) {
    if (typeof this.onExternal !== 'function') return { ok: false, error: `${def.name} can't be reached from here.` };
    let r; try { r = this.onExternal(def, this); } catch (e) { r = null; }
    if (!r || !r.ok) return r || { ok: false, error: `Could not open ${def.name}.` };
    this.scoreParty();
    this.closePoll();
    this.clearTimers();
    if (this.partyMode) this.partyMode.ext = false;
    if (this.partyMode && this.partyMode.phase !== 'done') this.partyMode.phase = 'playing';
    this.phase = 'lobby'; this.show = null;
    this.game = this.def.liveLobby ? this.def.create(this, this.settings) : null;
    if (this.game && this.game.joined) for (const p of this.players.values()) this.game.joined(p);
    this.away = { game: def.key, title: def.name, code: r.code, hostKey: r.hostKey || null, at: this.now() };
    this.fx('away', { game: def.key });
    this.sync();
    return { ok: true, game: def.key, external: true, code: r.code };
  }
  // The other game finished: award party points (players best first, like scoreParty) and
  // remember it as played. In Party Mode the lineup moves on: standings board, then the
  // next game (or the finale), exactly like a normal game end.
  externalResult(gameKey, title, orderedIds) {
    const order = [...new Set((Array.isArray(orderedIds) ? orderedIds : []).filter((id) => this.players.has(id)))];
    this.prevRank = new Map(this.partyBoard().map((r, i) => [r.id, i + 1])); this.lastGain = new Map();
    order.forEach((id, i) => { const r = this.partyRow(id), add = PARTY_POINTS[i] || 1; r.pts += add; r.games++; if (i === 0) r.wins++; this.lastGain.set(id, add); });
    const entry = { game: String(gameKey || 'external'), title: String(title || gameKey || 'Game'), winner: order[0] ? this.name(order[0]) : null, winnerId: order[0] || null, top: this.topOf(order), n: order.length, swing: this.swingNow() };
    this.played.push(entry);
    if (this.played.length > 40) this.played.shift();
    this.recordProfiles(entry.game, order, []);
    this.away = null;
    this.checkUnlocks();
    this.fx('back', { game: gameKey });
    if (this.partyMode && this.partyMode.phase === 'playing') { this.partyMode.ext = true; this.partyAfterGame(0); }
    this.sync();
    return { ok: true, awarded: order.length };
  }
  // Everyone came back without a finished game: in Party Mode the lineup moves on anyway.
  externalBack() {
    if (!this.away) return { ok: true };
    this.away = null;
    this.fx('back');
    const pm = this.partyMode;
    if (pm && pm.phase === 'playing' && pm.defs[pm.index] && pm.defs[pm.index].external) { pm.ext = true; this.partyAfterGame(0); }
    this.sync();
    return { ok: true };
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
    const extra = this.gameExtras(g, order);
    const entry = { game: this.def.key, title: this.def.name, winner: order[0] ? this.name(order[0]) : null, winnerId: order[0] || null, top: this.topOf(order), n: order.length, swing: this.swingNow(), ...extra.entry };
    this.played.push(entry);
    if (this.played.length > 40) this.played.shift();
    this.recordProfiles(this.def.key, order, extra.survivors);
    this.checkUnlocks();
    this.favouritePoll(entry, order);
    if (this.partyMode) this.partyAfterGame();
  }
  topOf(order) { return order.slice(0, 3).map((id) => { const p = this.players.get(id); return { id, name: p.name, avatar: p.avatar, color: p.color }; }); }
  // The biggest climb up the party standings in the game just scored (for the recap).
  swingNow() {
    let best = null;
    this.partyBoard().forEach((r, i) => { if (r.prevRank && r.prevRank - (i + 1) > 0 && (!best || r.prevRank - (i + 1) > best.by)) best = { id: r.id, name: r.name, from: r.prevRank, to: i + 1, by: r.prevRank - (i + 1) }; });
    return best;
  }
  // What a finished game can tell the recap: the gap between 1st and 2nd (from its standings),
  // its own awards, its highlights (optional game.highlights()), and who survived (Zombie Survival).
  gameExtras(g, order) {
    const entry = {}; let t = null;
    try { t = g.tv() || {}; } catch (e) { t = {}; }
    try {
      const st = [t.standings, t.final, t.ranking, t.top, t.scores].find((x) => Array.isArray(x) && x.length >= 2 && x[0] && typeof x[0] === 'object');
      const val = (r) => { for (const k of ['score', 'pts', 'points', 'total', 'chips', 'money', 'cash', 'bank', 'net', 'value']) if (typeof r[k] === 'number') return r[k]; return null; };
      if (st && val(st[0]) != null && val(st[1]) != null) {
        const a = st[0], b = st[1], nm = (r) => (this.players.has(r.id) ? this.name(r.id) : String(r.name || '?'));
        entry.gap = { a: nm(a), b: nm(b), top: val(a), diff: Math.abs(val(a) - val(b)) };
      }
    } catch (e) { /* no standings */ }
    try {
      const aw = Array.isArray(t.awards) ? t.awards : t.awards && Array.isArray(t.awards.awards) ? t.awards.awards : Array.isArray(g.awards) ? g.awards : null;
      if (aw) entry.awards = aw.filter((a) => a && this.players.has(a.id)).slice(0, 8).map((a) => ({ id: a.id, icon: String(a.icon || '🏅').slice(0, 8), title: String(a.title || a.name || 'Award').slice(0, 40) }));
    } catch (e) { /* none */ }
    try {
      const hl = typeof g.highlights === 'function' ? g.highlights() : Array.isArray(t.highlights) ? t.highlights : null;
      if (Array.isArray(hl)) entry.highlights = hl.filter(Boolean).slice(0, 3).map((h) => (typeof h === 'string' ? { icon: '✨', text: h.slice(0, 120) } : { icon: String(h.icon || '✨').slice(0, 8), text: String(h.text || '').slice(0, 120) })).filter((h) => h.text);
    } catch (e) { /* none */ }
    let survivors = [];
    try {
      if (typeof g.survivors === 'function') survivors = g.survivors() || [];
      else if (g.ppl instanceof Map) survivors = [...g.ppl.values()].filter((x) => x && x.alive && !x.npc).map((x) => x.id);
    } catch (e) { survivors = []; }
    return { entry, survivors: survivors.filter((id) => this.players.has(id)) };
  }
  // ---- lifetime profiles (box/profiles.js) ----
  recordProfiles(game, order, survivors) {
    if (game !== 'mafia') this.payGold(game, order);
    if (this.nightStart == null) this.nightStart = this.now();
    if (!this.profiles) return;
    const surv = new Set(survivors || []);
    order.forEach((id, i) => {
      const p = this.players.get(id); if (!p || !p.profileId) return;
      try { this.trophyNews(p, this.profiles.recordGame(p.profileId, { game, place: i + 1, of: order.length, pts: this.lastGain.get(id) || 0, survived: surv.has(id), room: this.nightKey })); } catch (e) { console.error('[box profiles]', e.message); }
    });
  }
  // ---- JustGold (box/gold.js): a finished game pays everyone with an account who played it ----
  payGold(game, order) {
    if (!this.wallets) return;
    const humans = this.list().filter((p) => !p.bot);
    const ms = this.gameStartAt != null ? this.now() - this.gameStartAt : 0;
    const why = humans.length < GOLD.MIN_HUMANS ? 'JustGold needs 2 or more people in the room' : ms < GOLD.MIN_MS ? 'That game was too short for JustGold' : null;
    order.forEach((id, i) => {
      const p = this.players.get(id); if (!p || p.bot || !p.wallet) return;
      if (why) { p.jg = { n: 0, why, at: this.now(), game }; return; }
      const { n, bonus } = GOLD.withSetBonus(game, GOLD.goldFor(game, i + 1, order.length, ms), p.look); // + a theme-set bonus in its game
      let paid = 0;
      try { paid = this.wallets.awardBox(p.wallet, this.code + ':' + (this.gameNo || 0) + ':' + game + ':' + this.hostKey, n, (this.def && this.def.key === game ? this.def.name : game) + (i === 0 ? ' · won' : ' · #' + (i + 1)) + (bonus ? ' · ' + bonus.icon + ' set +' + bonus.extra : '')); } catch (e) { console.error('[justgold]', e.message); }
      if (paid) { p.jg = { n: paid, at: this.now(), game, total: this.wallets.coins(p.wallet), set: bonus ? { icon: bonus.icon, name: bonus.name, extra: bonus.extra } : null }; this.fx('gold', { name: p.name, n: paid }); }
    });
  }
  partyGold() {
    const pm = this.partyMode; if (!this.wallets || !pm || pm.goldPaid) return;
    pm.goldPaid = true; pm.no = this.partyNo = (this.partyNo || 0) + 1;
    if (this.list().filter((p) => !p.bot).length < GOLD.MIN_HUMANS) return;
    this.partyBoard().forEach((r, i) => {
      const p = this.players.get(r.id); if (!p || p.bot || !p.wallet) return;
      const n = GOLD.partyGold(i + 1);
      let paid = 0; try { paid = this.wallets.awardBox(p.wallet, 'party:' + this.code + ':' + this.hostKey + ':' + (pm.no || 0), n, 'Party Mode finale · #' + (i + 1)); } catch (e) { console.error('[justgold]', e.message); }
      if (paid) { p.jg = { n: paid, at: this.now(), party: true, total: this.wallets.coins(p.wallet) }; this.fx('gold', { name: p.name, n: paid, party: true }); }
    });
  }
  // New trophies: a cue on the TV and a toast on that phone.
  trophyNews(p, list) {
    if (!list || !list.length) return;
    p.nightTrophies = [...(p.nightTrophies || []), ...list].slice(-12);
    for (const t of list) this.fx('trophy', { name: p.name, avatar: p.avatar, icon: t.icon, trophy: t.name });
    if (this.nsp) this.nsp.to('pl:' + this.code + ':' + p.id).emit('trophy', list);
  }
  partyProfiles() {
    if (!this.profiles) return;
    const board = this.partyBoard();
    board.forEach((r, i) => { const p = this.players.get(r.id); if (p && p.profileId) try { this.trophyNews(p, this.profiles.recordParty(p.profileId, { place: i + 1, of: board.length, room: this.nightKey })); } catch (e) { console.error('[box profiles]', e.message); } });
  }
  // A whole Party Mode just finished: lifetime party results, then the recap reel by itself.
  partyFinished() {
    this.partyGold();
    this.partyProfiles();
    if (!this.recap) this.after(RECAP_AFTER_PARTY, () => { if (this.partyMode && this.partyMode.phase === 'done' && !this.recap) this.startRecap(); });
  }
  // ---- end-of-night recap ----
  startRecap() {
    if (!this.played.length) return { ok: false, error: 'Play a game first, then there is a night to recap!' };
    this.recap = buildRecap(this); this.fx('recap'); this.sync(); this.syncAudience();
    return { ok: true };
  }
  stopRecap() { this.recap = null; this.sync(); this.syncAudience(); return { ok: true }; }

  // ---- audience ----
  audienceCount() { let n = 0; for (const a of this.audience.values()) if (a.sockets > 0) n++; return n; }
  // Who can't join as a player right now: a game running, the room full, or locked by the host.
  busy() {
    if (this.locked) return 'locked';
    if (this.players.size >= MAX_PLAYERS) return 'full';
    if (this.phase === 'show' || (this.phase === 'game' && !(this.game && this.game.phase === 'over'))) return 'running';
    return null;
  }
  joinAudience(name, token, avatar, playNext = false) {
    this.lastActivity = Date.now();
    if (token) { for (const a of this.audience.values()) if (a.token === token) return { ok: true, member: a, back: true }; }
    name = cleanName(name); if (!name) return { ok: false, error: 'Type a name first.' };
    if (this.audience.size >= MAX_AUDIENCE) return { ok: false, error: 'The audience is full!' };
    if (this.filterOn) name = cleanText(name);
    const a = { id: 'a' + (++this.aseq), name, token: crypto.randomBytes(8).toString('hex'), avatar: AVATARS.includes(avatar) ? avatar : AVATARS[this.aseq % AVATARS.length], color: COLORS[this.aseq % COLORS.length], sockets: 0, playNext: !!playNext, at: Date.now(), profileId: null };
    this.audience.set(a.id, a);
    this.syncAudience();
    return { ok: true, member: a };
  }
  removeAudience(id) { if (this.audience.delete(id)) { if (this.poll) this.poll.votes.delete(id); this.syncAudience(); } }
  setPlayNext(a, on) { a.playNext = !!on; if (on && this.phase === 'lobby') this.promoteAudience(); this.syncAudience(); return { ok: true, playNext: a.playNext }; }
  // The lobby is open: everyone who chose "play next" joins as a player (same token, so their
  // phone reconnects as a player). Their phones are told through their own audience channel.
  promoteAudience() {
    if (this.locked || this.phase !== 'lobby') return 0;
    let n = 0;
    for (const a of [...this.audience.values()]) {
      if (!a.playNext || this.players.size >= MAX_PLAYERS) continue;
      let name = a.name, k = 1;
      while (this.list().some((p) => p.name.toLowerCase() === name.toLowerCase()) && k < 50) name = cleanName(a.name.slice(0, 11) + ' ' + (++k));
      const p = { id: 'p' + (++this.seq), name, token: a.token, bot: false, sockets: 0, color: COLORS[this.seq % COLORS.length], avatar: a.avatar, profileId: a.profileId || null };
      this.players.set(p.id, p);
      if (this.game && this.game.joined) this.game.joined(p);
      this.audience.delete(a.id); if (this.poll) this.poll.votes.delete(a.id);
      if (this.nsp) this.nsp.to('aum:' + this.code + ':' + a.id).emit('promoted', { token: a.token, name });
      n++;
    }
    if (n) { this.fx('audJoin', { n }); this.sync(); this.syncAudience(); }
    return n;
  }
  // A poll for the audience. Games can run their own: room.openPoll({ q, options: [{ id, label,
  // avatar?, color? }], ms, onClose(result) }) → result = { winner: option|null, tied, votes, counts }.
  openPoll({ kind = 'game', q, options, ms = 20000, onClose = null } = {}) {
    if (!Array.isArray(options) || options.length < 2) return { ok: false, error: 'A poll needs 2+ options.' };
    this.closePoll();
    const id = (this.pollSeq = (this.pollSeq || 0) + 1);
    this.poll = { id, kind, q: String(q || 'Vote!').slice(0, 120), options: options.slice(0, 16).map((o) => ({ id: String(o.id), label: String(o.label || o.name || o.id).slice(0, 40), avatar: o.avatar || null, color: o.color || null })), endsAt: this.now() + ms, votes: new Map(), onClose };
    this.poll.timer = this.after(ms, () => this.closePoll(id));
    this.syncAudience();
    return { ok: true, id };
  }
  vote(a, optionId) {
    const P = this.poll; if (!P) return { ok: false, error: 'No vote right now.' };
    if (!P.options.some((o) => o.id === String(optionId))) return { ok: false, error: 'Pick one of the options.' };
    P.votes.set(a.id, String(optionId)); this.syncAudience();
    return { ok: true, poll: P.id };
  }
  pollCounts(P = this.poll) { const c = {}; if (P) { for (const o of P.options) c[o.id] = 0; for (const v of P.votes.values()) c[v] = (c[v] || 0) + 1; } return c; }
  closePoll(id) {
    const P = this.poll; if (!P || (id != null && P.id !== id)) return null;
    this.poll = null; this.cancel(P.timer);
    const counts = this.pollCounts(P), max = Math.max(0, ...Object.values(counts));
    const top = max > 0 ? P.options.filter((o) => counts[o.id] === max) : [];
    const result = { winner: top.length === 1 ? top[0] : null, tied: top.length > 1 ? top : [], votes: P.votes.size, counts, q: P.q };
    this.lastPoll = { id: P.id, q: P.q, winner: result.winner, votes: result.votes, at: this.now() };
    try { if (P.onClose) P.onClose(result); } catch (e) { console.error('[poll]', e); }
    this.syncAudience(); this.sync();
    return result;
  }
  // End of every game with an audience: "Who was your favourite?" The winner gets a small bonus.
  favouritePoll(entry, order) {
    if (!this.audienceCount() || order.length < 2) return;
    const opts = order.slice(0, 12).map((id) => { const p = this.players.get(id); return { id, label: p.name, avatar: p.avatar, color: p.color }; });
    this.openPoll({ kind: 'fav', q: 'Audience favourite in ' + entry.title + '?', options: opts, ms: FAV_MS, onClose: (res) => {
      const w = res.winner; const p = w && this.players.get(w.id); if (!p) return;
      const r = this.partyRow(p.id); r.pts += FAV_BONUS;
      entry.fav = { id: p.id, name: p.name, votes: res.counts[w.id] || 0 };
      this.fx('audFav', { name: p.name, avatar: p.avatar, bonus: FAV_BONUS });
      if (this.profiles && p.profileId) try { this.trophyNews(p, this.profiles.bump(p.profileId, 'audienceFavs', 1, FAV_BONUS, this.nightKey)); } catch (e) { /* ignore */ }
    } });
  }
  pollView() { const P = this.poll; return P ? { id: P.id, kind: P.kind, q: P.q, options: P.options, counts: this.pollCounts(P), votes: P.votes.size, endsIn: Math.max(0, P.endsAt - this.now()) } : null; }
  // The one state every audience phone gets (no per-person data, so 100+ watchers cost one message).
  audienceState() {
    const pm = this.partyMode, over = this.game && this.game.phase === 'over';
    return {
      code: this.code, game: this.def.key, title: this.def.name, phase: this.phase === 'game' && over ? 'over' : this.phase,
      players: this.players.size, audience: this.audienceCount(), locked: this.locked, busy: this.busy(),
      top: this.partyBoard().slice(0, 5).map((r) => ({ name: r.name, avatar: r.avatar, color: r.color, pts: r.pts })),
      poll: this.pollView(), lastPoll: this.lastPoll && this.now() - this.lastPoll.at < 15000 ? { q: this.lastPoll.q, winner: this.lastPoll.winner, votes: this.lastPoll.votes } : null,
      party: pm ? { index: pm.index, of: pm.defs.length, phase: pm.phase, next: pm.defs[pm.index + 1] ? pm.defs[pm.index + 1].key : null } : null,
      recap: this.recap ? { id: this.recap.id, champion: this.recap.champion, played: this.recap.played.map((g) => ({ game: g.game, title: g.title, winner: g.winner })) } : null,
    };
  }
  // Coalesced (at most ~4 a second) and only when something changed.
  syncAudience() {
    if (!this.nsp || this.audPending) return;
    this.audPending = true;
    const t = setTimeout(() => this.flushAudience(), 220);
    if (t.unref) t.unref();
  }
  flushAudience(force = false) {
    this.audPending = false; if (!this.nsp) return;
    const st = this.audienceState(), sig = JSON.stringify(st);
    if (sig === this.audSig && !force) return;
    this.audSig = sig;
    this.nsp.to('au:' + this.code).emit('aud', st);
    this.nsp.to('host:' + this.code).emit('aud', { audience: st.audience, poll: st.poll, lastPoll: st.lastPoll });
  }
  // Audience reactions reach the TV, but no more than a handful a second however big the crowd.
  audienceReactOk() {
    const now = Date.now(); this.reactAt = this.reactAt.filter((t) => now - t < 1000);
    if (this.reactAt.length >= 8) return false;
    this.reactAt.push(now); return true;
  }
  // Server-side text cleaning for games: room.cleanText(s).
  cleanText(s) { return this.filterOn ? cleanText(s) : s; }
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
  // flow 'auto': each game starts right after the standings; 'lobby': it waits in its lobby so the host can adjust settings.
  // opts (from the setup): intros 'play'|'break'|'skip'; each 'quick'|'standard'|'long'|'auto' (game
  // length); plan { key: minutes } (each game's minutes in the plan); players (the group size picked).
  setParty(defs, minutes, flow = 'auto', opts = {}) {
    defs = (defs || []).filter((d) => d && !this.isLocked(d)).slice(0, MAX_LINEUP);
    if (!defs.length) return { ok: false, error: 'Pick some games.' };
    opts = opts && typeof opts === 'object' ? opts : {};
    const total = Math.max(10, Math.min(600, Number(minutes) || 60));
    const each = ['quick', 'standard', 'long', 'auto'].includes(opts.each) ? opts.each : 'auto';
    const plan = {};
    for (const d of defs) {
      const m = Number(opts.plan && typeof opts.plan === 'object' ? opts.plan[d.key] : NaN);
      plan[d.key] = Number.isFinite(m) && m > 0 ? Math.max(3, Math.min(120, Math.round(m))) : PF.LENGTHS[each] || Math.max(5, Math.min(30, Math.round(total / defs.length)));
    }
    this.partyMode = { defs, index: 0, minutes: total, phase: 'playing', at: this.now(), startedAt: null, paused: false, timer: null, flow: flow === 'lobby' ? 'lobby' : 'auto',
      intros: INTRO_MODES.includes(opts.intros) ? opts.intros : 'play', each, plan, players: Math.max(0, Math.min(100, Number(opts.players) || 0)),
      fit: null, nextFit: null, preview: null, previewed: null };
    if (this.def === defs[0]) { this.settings = this.defaultSettings(this.def); this.partyFit(); }
    return { ok: true };
  }
  // ---- Party Mode: settings that fit the crowd and the time (box/party-fit.js) ----
  // The game's minutes in the plan, and how many will play (the room's players; before anyone
  // has joined, the group size picked in the setup).
  partyCtx(def) {
    const pm = this.partyMode;
    return { players: this.players.size || pm.players || 6, minutes: pm.plan[def.key] || 10 };
  }
  // The current party game's settings: fitted when the lineup reaches it (and again at Start with
  // the players actually here, unless the host changed them in the lobby).
  partyFit() {
    const pm = this.partyMode;
    if (!pm || pm.phase === 'done' || pm.defs[pm.index] !== this.def || this.def.external) return;
    const ctx = this.partyCtx(this.def), fit = PF.fitSettings(this.def, ctx);
    Object.assign(this.settings, fit.settings);
    pm.fit = { game: this.def.key, summary: fit.summary, minutes: ctx.minutes, players: ctx.players, touched: false };
  }
  // People joined or left in the lobby: the settings follow the crowd (until the host changes them).
  partyRefit() {
    const pm = this.partyMode;
    if (this.phase !== 'lobby' || !pm || !pm.fit || pm.fit.touched || pm.fit.game !== this.def.key || !this.players.size || pm.fit.players === this.players.size) return;
    const keep = this.settings.showIntro;
    this.settings = this.defaultSettings(this.def); if (keep !== undefined) this.settings.showIntro = keep;
    this.partyFit();
  }
  // The game after this one (skipping games that need more players than are here), or -1.
  partyNextIndex() {
    const pm = this.partyMode; let i = pm.index + 1;
    while (i < pm.defs.length && pm.defs[i].min > this.players.size) i++;
    return i < pm.defs.length ? i : -1;
  }
  setIntros(mode) {
    const pm = this.partyMode; if (!pm || !INTRO_MODES.includes(mode)) return { ok: false, error: 'Not now.' };
    pm.intros = mode;
    if (mode !== 'break' && pm.preview) { pm.preview.stop(); pm.preview = null; }
    this.sync(); return { ok: true, intros: mode };
  }
  // "Play them in the break": the next game's cutscene on the TV during the standings.
  partyPreview(def) {
    const pm = this.partyMode; if (!pm || pm.phase !== 'board' || pm.intros !== 'break' || pm.preview) return;
    if (!def || def.external || !this.hasShow(def)) return;
    pm.preview = new Show(this, { def, mode: 'cast', preview: true, noHowto: true, info: this.partyInfo(def, pm.nextFit), onDone: () => { if (pm.preview) pm.preview.over = true; } });
    pm.previewed = def.key;
    pm.preview.begin();
    this.fx('partyPreview', { game: def.key });
    this.sync();
  }
  previewMs() { return CAST_OPEN_MS + Math.min(CAST_MAX, this.players.size) * CAST_PER_MS + CAST_OUTRO_MS; }
  // What the TV says about a party game: "Game 3 of 6", its settings and its minutes in the plan.
  partyInfo(def, fit) {
    const pm = this.partyMode; if (!pm) return null;
    const i = pm.defs.indexOf(def);
    return { game: def.key, title: def.name, n: i + 1, of: pm.defs.length, last: i === pm.defs.length - 1, minutes: pm.plan[def.key] || null, summary: fit ? fit.summary : [] };
  }
  // A game just ended: let its end screen breathe, then the standings board, then the next game.
  partyAfterGame(delay = BOARD_DELAY) {
    const pm = this.partyMode; if (!pm || pm.phase !== 'playing') return;
    const last = pm.index >= pm.defs.length - 1;
    pm.phase = 'ending'; pm.at = this.now() + delay;
    this.cancel(pm.timer);
    pm.timer = pm.paused ? null : this.after(delay, () => this.partyToBoard());
  }
  // The end screen has had its moment: the standings board (or the finale after the last game).
  partyToBoard() {
    const pm = this.partyMode; if (!pm || pm.phase !== 'ending') return { ok: false, error: 'Not now.' };
    this.cancel(pm.timer); pm.timer = null;
    const last = pm.index >= pm.defs.length - 1;
    let boardMs = BOARD_MS;
    pm.nextFit = null; pm.nextInfo = null; pm.preview = null;
    if (!last) {
      // Up next: its settings for this crowd (shown on the board), and in "break" mode its intro.
      const ni = this.partyNextIndex(), nd = ni >= 0 ? pm.defs[ni] : null;
      if (nd) {
        pm.nextFit = nd.external ? null : PF.fitSettings(nd, this.partyCtx(nd));
        pm.nextInfo = this.partyInfo(nd, pm.nextFit);
        if (pm.intros === 'break' && !nd.external && this.hasShow(nd)) {
          boardMs = Math.max(BOARD_MS, BREAK_STAND_MS + this.previewMs() + 1200);
          pm.previewTimer = this.after(BREAK_STAND_MS, () => { pm.previewTimer = null; this.partyPreview(nd); });
        }
      }
    }
    pm.phase = last ? 'done' : 'board'; pm.at = this.now() + (last ? 0 : boardMs);
    if (last) { this.checkUnlocks(); this.partyFinished(); }
    this.fx(last ? 'partyDone' : 'partyBoard');
    if (!last && !pm.paused) pm.timer = this.after(boardMs, () => this.partyNext());
    this.sync();
    return { ok: true };
  }
  // On to the next game in the lineup (skipping any that need more players than are here).
  partyNext() {
    const pm = this.partyMode; if (!pm || pm.phase === 'done') return { ok: false, error: 'The party is over!' };
    if (this.phase === 'game' && this.game && this.game.phase !== 'over') return { ok: false, error: 'Finish this game first.' };
    this.cancel(pm.timer); pm.timer = null;
    // The break's intro is over (or cut short by "Next game now"): it still counts as played.
    if (pm.previewTimer) { this.cancel(pm.previewTimer); pm.previewTimer = null; }
    if (pm.preview) { pm.preview.stop(); pm.preview = null; }
    let i = pm.index + 1;
    while (i < pm.defs.length && pm.defs[i].min > this.players.size) i++;
    if (i >= pm.defs.length) { pm.phase = 'done'; pm.at = this.now(); this.checkUnlocks(); this.partyFinished(); this.sync(); return { ok: true, done: true }; }
    pm.index = i; pm.phase = 'playing'; pm.at = this.now();
    const sw = this.switchGame(pm.defs[i]); if (!sw.ok) return sw;
    if (sw.external) return sw; // played elsewhere: the room waits for its result
    if (pm.flow === 'lobby') { this.sync(); return { ok: true, lobby: true }; } // the host adjusts the settings, then presses Start
    const st = this.start();
    this.sync();
    return st;
  }
  partyPause(on) {
    const pm = this.partyMode; if (!pm) return { ok: false };
    pm.paused = on == null ? !pm.paused : !!on;
    if (pm.phase === 'board' || pm.phase === 'ending') {
      // Holding the countdown (end screen or standings); letting go gives 5 more seconds.
      this.cancel(pm.timer); pm.timer = null;
      const go = pm.phase === 'board' ? () => this.partyNext() : () => this.partyToBoard();
      // An intro playing in the break gets to finish first.
      const ms = pm.phase === 'board' && pm.preview && !pm.preview.over ? Math.max(5000, pm.preview.endsAt - this.now() + 1200) : 5000;
      if (!pm.paused) { pm.at = this.now() + ms; pm.timer = this.after(ms, go); }
    }
    this.sync(); return { ok: true, paused: pm.paused };
  }
  // The whole party again from the top, with fresh points.
  partyAgain() {
    const pm = this.partyMode; if (!pm) return { ok: false };
    if (this.phase === 'game' && this.game && this.game.phase !== 'over') return { ok: false, error: 'Finish this game first.' };
    this.cancel(pm.timer); this.party = new Map(); this.played = []; this.lastGain = new Map(); this.prevRank = new Map(); this.recap = null;
    if (pm.previewTimer) { this.cancel(pm.previewTimer); pm.previewTimer = null; }
    if (pm.preview) { pm.preview.stop(); pm.preview = null; }
    pm.index = 0; pm.phase = 'playing'; pm.at = this.now(); pm.startedAt = null; pm.paused = false; pm.goldPaid = false; pm.previewed = null; pm.nextFit = null; pm.nextInfo = null;
    const sw = this.switchGame(pm.defs[0]); if (!sw.ok) return sw;
    this.sync(); return { ok: true };
  }
  // tv: the big screen also gets the intro playing in the break (phones don't need it).
  partyState(tv = false) {
    const pm = this.partyMode; if (!pm) return null;
    const cur = pm.defs[pm.index];
    return { games: pm.defs.map((d) => d.key), titles: pm.defs.map((d) => d.name), index: pm.index, minutes: pm.minutes, phase: pm.phase, paused: pm.paused,
      in: Math.max(0, pm.at - this.now()), elapsed: pm.startedAt == null ? 0 : this.now() - pm.startedAt,
      next: pm.defs[pm.index + 1] ? pm.defs[pm.index + 1].key : null, boardMs: BOARD_MS, ext: !!pm.ext, flow: pm.flow,
      intros: pm.intros, each: pm.each, plan: pm.defs.map((d) => pm.plan[d.key] || null),
      // This game's chosen settings ("5 orders · 45 seconds"), and the next game's on the board.
      fit: pm.fit && cur && pm.fit.game === cur.key ? { summary: pm.fit.summary, minutes: pm.fit.minutes, players: pm.fit.players, touched: pm.fit.touched } : null,
      upNext: pm.phase === 'board' ? pm.nextInfo || null : null,
      preview: tv && pm.preview && !pm.preview.over && pm.phase === 'board' ? pm.preview.tv() : null };
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
    if (this.filterOn) name = cleanText(name);
    if (this.list().some((p) => p.name.toLowerCase() === name.toLowerCase())) return { ok: false, error: 'Someone already has that name.' };
    const p = { id: 'p' + (++this.seq), name, token: crypto.randomBytes(8).toString('hex'), bot: false, sockets: 0, color: COLORS[this.seq % COLORS.length], avatar: AVATARS.includes(avatar) ? avatar : AVATARS[this.seq % AVATARS.length] };
    this.players.set(p.id, p);
    if (this.game && this.game.joined) this.game.joined(p);
    this.partyRefit();
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
    this.partyRefit();
    this.sync();
    return added;
  }

  // The host removes someone (TV or host phone). Their phone is told, and the same phone or
  // account can't come straight back into this room (a fresh name on another phone still can).
  kick(id) {
    const p = this.players.get(id); if (!p) return { ok: false, error: 'That player already left.' };
    if (!p.bot) {
      this.kicked = this.kicked || { tokens: new Set(), profiles: new Set(), names: new Set() };
      this.kicked.names.add(p.name.toLowerCase());
      if (p.token) this.kicked.tokens.add(p.token);
      if (p.profileId) this.kicked.profiles.add(p.profileId);
      if (this.nsp) this.nsp.to('pl:' + this.code + ':' + p.id).emit('kicked', { room: this.code });
    }
    this.remove(id);
    return { ok: true, name: p.name };
  }
  isKicked(token, profileId, name) { const k = this.kicked; return !!(k && ((token && k.tokens.has(token)) || (profileId && k.profiles.has(profileId)) || (name && k.names.has(String(name).trim().toLowerCase())))); }

  remove(id) {
    const p = this.players.get(id); if (!p) return;
    this.players.delete(id);
    if (this.game && this.game.left) this.game.left(p);
    this.partyRefit();
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
        if (this.partyMode && this.partyMode.fit && this.phase === 'lobby') this.partyMode.fit.touched = true; // the host's choice stands
        this.sync(); return { ok: true, settings: this.settings };
      }
      case 'partyIntros': return this.setIntros(String(msg.mode || ''));
      case 'addBots': return { ok: true, added: this.addBots(Math.max(1, Math.min(50, Number(msg.count) || 5))) };
      case 'removeBots': for (const p of this.list()) if (p.bot) this.remove(p.id); return { ok: true };
      case 'kick': return this.kick(String(msg.id || ''));
      case 'start': return this.start();
      case 'again': this.resetLobby(); return this.start(); // every game: back to a fresh lobby, then start
      case 'next': if (this.phase === 'show' && this.show) { this.show.skip(); this.sync(); return { ok: true }; }
        if (!this.game || !this.game.next) return { ok: false }; this.game.next(); this.sync(); return { ok: true };
      case 'lobby': this.resetLobby(); this.sync(); return { ok: true };
      case 'partyNext': return this.partyNext();
      case 'partyPause': return this.partyPause(msg.on);
      case 'partyAgain': return this.partyAgain();
      case 'partyBoardNow': return this.partyToBoard();
      case 'recap': return this.startRecap();
      case 'recapClose': return this.stopRecap();
      case 'streamer': this.filterOn = !!msg.filter; this.sync(); return { ok: true, filter: this.filterOn };
      case 'lockRoom': this.locked = !!msg.on; if (!this.locked) this.promoteAudience(); this.sync(); this.syncAudience(); return { ok: true, locked: this.locked };
      default: // game-specific TV reports (e.g. JustFunny: a video ended)
        if (this.game && this.game.hostAct) { const r = this.game.hostAct(msg) || { ok: true }; this.sync(); return r; }
        return { ok: false, error: 'Unknown action.' };
    }
  }

  resetLobby() {
    this.scoreParty();
    this.closePoll();
    this.clearTimers(); this.show = null;
    if (this.partyMode && this.partyMode.phase !== 'done') this.partyMode.phase = 'playing'; // replaying this game: the board waits for its end
    this.phase = 'lobby';
    this.game = this.def.liveLobby ? this.def.create(this, this.settings) : null;
    if (this.game) for (const p of this.players.values()) if (this.game.joined) this.game.joined(p);
    this.promoteAudience();
  }
  start() {
    if (this.phase !== 'lobby') return { ok: false, error: 'The game is already running.' };
    if (this.players.size < this.def.min) return { ok: false, error: `${this.def.name} needs at least ${this.def.min} player${this.def.min === 1 ? '' : 's'} (bots count).` };
    this.clearTimers();
    const pm = this.partyMode, inParty = !!(pm && pm.phase !== 'done' && pm.defs[pm.index] === this.def);
    // Party Mode: fit the settings again to the players actually here (unless the host changed them).
    if (inParty) this.partyRefit();
    if (this.def.liveLobby && this.game) this.game.s = { ...this.settings }; // the lobby world carries on into the game
    else this.game = this.def.create(this, { ...this.settings });
    if (pm && pm.startedAt == null) pm.startedAt = this.now();
    if (this.hasShow() && this.settings.showIntro !== false) {
      const mode = inParty ? pm.intros : 'play';
      // "In the break": this game's intro already played during the standings.
      if (!(mode === 'break' && pm.previewed === this.def.key)) {
        const info = inParty ? this.partyInfo(this.def, pm.fit) : null;
        const opts = mode === 'skip' ? { mode: 'card', info } : mode === 'break' ? { mode: 'cast', noHowto: true, info } : { info };
        this.phase = 'show'; this.show = new Show(this, opts); this.fx('show'); this.show.begin(); this.sync();
        return { ok: true };
      }
    }
    this.beginGame();
    return { ok: true };
  }
  // After the show opening (or straight from start): the game itself begins.
  beginGame() {
    this.gameStartAt = this.now(); this.gameNo = (this.gameNo || 0) + 1;
    this.show = null; this.phase = 'game';
    this.fx('start');
    this.game.start();
    this.sync();
  }

  act(p, msg) {
    this.lastActivity = Date.now();
    if (this.phase === 'show' && this.show) {
      if (msg && msg.op === 'fact') { const r = this.show.submit(p, msg.text); this.sync(); return r; }
      if (msg && msg.op === 'gotit') { const r = this.show.gotit(p); this.sync(); return r; }
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
      vip: this.vip() ? this.vip().name : null, filterOn: this.filterOn, locked: this.locked,
      audience: { count: this.audienceCount(), poll: this.pollView() }, recap: this.recap,
      players: this.list().map((p) => ({ id: p.id, name: p.name, bot: p.bot, color: p.color, avatar: p.avatar, look: p.look || null, gear: p.gear || null, online: p.bot || p.sockets > 0, title: p.title || null })),
      party: this.partyBoard().slice(0, 24), played: this.played.slice(-24), partyMode: this.partyState(true), unlocks: [...this.unlocks], away: this.away,
      state: this.game && this.phase !== 'show' ? this.game.tv() : null, show: this.show ? this.show.tv() : null,
    };
  }
  playerState(p) {
    return {
      code: this.code, game: this.def.key, title: this.def.name, phase: this.phase,
      me: { id: p.id, name: p.name, color: p.color, avatar: p.avatar, look: p.look || null, gear: p.gear || null, title: p.title || null, profile: !!p.profileId, wallet: !!p.wallet },
      jg: p.jg || null,
      roster: this.rosterFor(p),
      audience: this.audienceCount(), recap: this.recap ? personalRecap(this, this.recap, p) : null,
      party: (() => { const b = this.partyBoard(), i = b.findIndex((r) => r.id === p.id); return { played: this.played.length, pts: i >= 0 ? b[i].pts : 0, wins: i >= 0 ? b[i].wins : 0, gain: i >= 0 ? b[i].gain : 0, rank: i + 1, of: b.length, top: b.slice(0, 5) }; })(),
      partyMode: this.partyState(), unlocks: [...this.unlocks], count: this.players.size,
      away: this.away ? { game: this.away.game, title: this.away.title, code: this.away.code, url: `/play?room=${encodeURIComponent(this.away.code)}&autojoin=1&name=${encodeURIComponent(p.name)}` } : null, min: this.def.min, live: !!this.def.liveLobby,
      vip: !!this.vip() && this.vip().id === p.id, vipName: this.vip() ? this.vip().name : null,
      kickList: this.vip() && this.vip().id === p.id ? this.list().filter((x) => x.id !== p.id).map((x) => ({ id: x.id, name: x.name, avatar: x.avatar, bot: !!x.bot, online: !!x.bot || x.sockets > 0 })) : null,
      state: this.game && this.phase !== 'show' ? this.game.view(p) : null, show: this.show ? this.show.view(p) : null,
    };
  }

  // Coalesce: many changes in one tick send one update per screen.
  sync() {
    if (!this.nsp || this.pending) return;
    this.pending = true;
    setImmediate(() => { this.pending = false; this.flush(); });
  }
  // Everyone's character and this game's gear, for the phones' BOX.face (sent only when it
  // changed since this player last got it; tvState().players already carries it for the TV).
  rosterInfo() {
    if (this._roster) return this._roster;
    const game = this.def.key;
    const list = this.list().filter((x) => x.look || x.bot).map((x) => ({ id: x.id, name: x.name, avatar: x.avatar, color: x.color, bot: !!x.bot, look: x.look || null, gear: x.gear && x.gear[game] ? { [game]: x.gear[game] } : null }));
    return (this._roster = { sig: JSON.stringify(list), list });
  }
  rosterFor(p) { const r = this.rosterInfo(); if (p.rosterSig === r.sig) return undefined; p.rosterSig = r.sig; return r.list; }

  flush() {
    this._roster = null;
    this.scoreParty();
    if (!this.nsp) return;
    this.nsp.to('host:' + this.code).emit('tv', this.tvState());
    for (const p of this.players.values()) if (!p.bot && p.sockets > 0) this.nsp.to('pl:' + this.code + ':' + p.id).emit('me', this.playerState(p));
    if (this.audience.size) this.syncAudience(); // watchers follow the game (coalesced, only on change)
  }

  destroy() { this.clearTimers(); this.game = null; this.poll = null; }
}

module.exports = { UNLOCK_RULES, BoxRoom, MAX_PLAYERS, MAX_AUDIENCE, FAV_BONUS, cleanName, cleanText, AVATARS, REACTIONS };
