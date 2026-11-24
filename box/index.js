'use strict';
// JustGameBox socket server (namespace /box): every box game shares the same room code,
// QR join, lobby settings, bots and reconnection — the way JustMafia works.
const path = require('path');
const { BoxRoom, REACTIONS } = require('./room');
const { BoxProfileStore } = require('./profiles');

const GAMES = {
  president: require('./games/president'),
  blackjack: require('./games/blackjack'),
  ducks: require('./games/ducks'),
  blanks: require('./games/blanks'),
  truths: require('./games/truths'),
  funny: require('./games/funny'),
  sketch: require('./games/sketch'),
  whosaid: require('./games/whosaid'),
  price: require('./games/price'),
  emoji: require('./games/emoji'),
  likely: require('./games/likely'),
  spectrum: require('./games/spectrum'),
  bid: require('./games/bid'),
  kingdoms: require('./games/kingdoms'),
  zombie: require('./games/zombie'),
  pitch: require('./games/pitch'),
  king: require('./games/king'),
  undercover: require('./games/undercover'),
  snap: require('./games/snap'),
  pizza: require('./games/pizza'),
  escape: require('./games/escape'),
  marble: require('./games/marble'),
  debate: require('./games/debate'),
  actout: require('./games/actout'),
  tune: require('./games/tune'),
  alien: require('./games/alien'),
  bomb: require('./games/bomb'),
  quickdraw: require('./games/quickdraw'),
  summon: require('./games/summon'),
  letters: require('./games/letters'),
  memes: require('./games/memes'),
  colormatch: require('./games/colormatch'),
  trivia: require('./games/trivia'),
  plinko: require('./games/plinko'),
};

// Every small game opens with its own intro cutscene (box/show.js, 'cast' mode); the game
// shows (Price Panic, JustBid) set `show: true` themselves for the contestant-fact opening.
for (const k of ['president', 'blackjack', 'blanks', 'truths', 'whosaid', 'emoji', 'likely', 'spectrum', 'sketch', 'funny', 'zombie']) if (!GAMES[k].show) GAMES[k].show = { facts: false };

// Games that live outside the box (their own server code and pages). A box room hands
// everyone over to them and gets the result back: see BoxRoom.goExternal / externalResult.
// `external.<key>(boxRoom, def)` (an installBox option) opens the game → { ok, code, hostKey }.
const EXTERNAL = {
  mafia: { key: 'mafia', name: 'JustMafia', icon: '🔪', min: 5, best: [8, 20], external: true },
};
const defOf = (k) => (typeof k === 'string' ? (Object.prototype.hasOwnProperty.call(GAMES, k) ? GAMES[k] : Object.prototype.hasOwnProperty.call(EXTERNAL, k) ? EXTERNAL[k] : null) : null);

// Lifetime profiles for box games: .data/box-profiles.json (git-ignored; DATA_DIR moves it, see
// data-dir.js), like JustMafia's profiles.json; MT_PROFILE_STORE=memory keeps them in memory (tests).
const defaultProfiles = () => new BoxProfileStore(process.env.MT_PROFILE_STORE === 'memory' ? null : path.join(require('../data-dir').DATA_DIR, 'box-profiles.json'));

// JustGold (docs/justgold.md): 'wallets' is JustMafia's ProfileStore (gold, items, the look);
// walletBusy(walletId) says if that wallet is in a running JustMafia game (no shopping then).
function installBox(app, io, { takenElsewhere = () => false, elsewhere = () => null, external = {}, profiles = defaultProfiles(), wallets = null, walletBusy = () => false } = {}) {
  const pub = path.join(__dirname, '..', 'public', 'box');
  app.get('/box/tv', (req, res) => res.sendFile(path.join(pub, 'tv.html')));
  app.get('/box/play', (req, res) => res.sendFile(path.join(pub, 'play.html')));
  // Big games get their own address, like JustMafia's /mafia.
  app.get('/ducks', (req, res) => res.sendFile(path.join(pub, 'tv.html')));
  app.get('/ducks/play', (req, res) => res.sendFile(path.join(pub, 'play.html')));
  app.get('/kingdoms', (req, res) => res.sendFile(path.join(pub, 'tv.html')));
  app.get('/kingdoms/play', (req, res) => res.sendFile(path.join(pub, 'play.html')));

  // The JustGold balance for the main menu (hub.js): this device's account ({ auth }, box.profile)
  // or, without one, its JustMafia wallet ({ mafia }, mt.profile). Read-only; no balance, no error.
  app.post('/api/jg/balance', require('express').json({ limit: '4kb' }), (req, res) => {
    res.set('Cache-Control', 'no-store');
    const b = req.body && typeof req.body === 'object' ? req.body : {};
    if (!wallets) return res.json({ ok: false });
    let w = null, name = null, saved = false;
    try {
      const prof = profiles && b.auth && typeof b.auth === 'object' ? profiles.authenticate(b.auth) : null;
      if (prof) { name = prof.claimed || prof.name || null; saved = !!(prof.claimed && prof.password); w = profiles.walletOf(prof.id); if (w && !wallets.data.profiles[w]) w = null; }
      if (!w && b.mafia && typeof b.mafia === 'object') { const m = wallets.authenticate(b.mafia); if (m && (!prof || !profiles.ownerOfWallet(m.id))) w = m.id; }
    } catch (e) { w = null; }
    if (!w) return res.json({ ok: true, gold: null, name, saved });
    res.json({ ok: true, gold: wallets.coins(w), name, saved });
  });

  const nsp = io.of('/box');
  const rooms = new Map();
  // Photos taken in a game (JustSnap): kept in the running game's memory only, at an unguessable
  // per-room address, never cached. Gone (404) once the game frees them or the room closes.
  app.get('/box/photo/:code/:id', (req, res) => {
    const room = rooms.get(String(req.params.code || '').toUpperCase()), g = room && room.game;
    const id = String(req.params.id || '');
    const ph = /^[A-Za-z0-9_-]{8,40}$/.test(id) && g && typeof g.servePhoto === 'function' ? g.servePhoto(id, req.query.t === '1') : null;
    res.set({ 'Cache-Control': 'no-store, private', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'", 'Referrer-Policy': 'no-referrer' });
    if (!ph || !ph.body) return res.status(404).type('text/plain').send('Not found');
    res.type(ph.type).send(ph.body);
  });
  // Level and season-pass titles live on the wallet (box/progress.js); the account can wear them.
  if (profiles && wallets && typeof wallets.titlesOf === 'function') profiles.titlesOf = (accId) => { const w = profiles.walletOf(accId); return w && wallets.data.profiles[w] ? wallets.titlesOf(w) : []; };
  // ---------- JustGold helpers ----------
  const shared = { cos: require('../public/shared/cosmetics'), gear: (() => { try { return require('../public/shared/gear'); } catch (e) { return { GEAR: [] }; } })() };
  const GEAR_IDS = () => new Set((shared.gear.GEAR || []).map((g) => g.id));
  // Items the shared shop sells: the character (every game), flair, JustMafia's own things. The
  // season pass, Fate and world rewards stay inside JustMafia.
  const SHOP_FORBIDDEN = (itemId) => { const it = (shared.cos.CATALOG || []).find((i) => i.id === itemId); return it && (it.pass || it.world) ? { ok: false, error: 'That one is earned, not sold: a season pass tier or a JustMafia world.' } : null; };
  const BOX_FIELDS = { character: ['outfit', 'shoeStyle', 'hat', 'accessory', 'hair'], flair: ['nameplate', 'effect'], mafia: ['houseStyle', 'houseDecor', 'deathAnim', 'reactions', 'ghostSkin'] };
  BOX_FIELDS.pets = ['pet']; // Pets: one animated friend on your shoulder, every game (docs/justgold.md)
  const sectionOf = (field) => Object.keys(BOX_FIELDS).find((k) => BOX_FIELDS[k].includes(field)) || null;
  const STOCKABLE_IDS = new Set((shared.cos.STOCKABLE || []).map((x) => x.id));
  const { earnTable } = require('./gold');
  const SS = require('../public/shared/shop-season'); // event items, daily deals, theme sets
  function busyNow(accountId, w) {
    for (const r of rooms.values()) if ((r.phase === 'game' || r.phase === 'show') && r.game && r.game.phase !== 'over' && [...r.players.values()].some((p) => p.profileId === accountId && !p.bot)) return true;
    try { return !!walletBusy(w); } catch (e) { return false; }
  }
  function lockOf(p, i, owned, stock, now) {
    if (owned.has(i.id) || i.free) return null;
    const limited = SS.limitedLock(i.id, now); if (limited) return limited;
    if (SS.isDeal(i.id, now) || SS.SET_OF[i.id]) stock = new Set([...stock, i.id]); // deals and set pieces are on sale for everyone
    if (i.pass) return 'A season pass reward (🏆 My profile → Season)';
    if (i.world) return 'A JustMafia world reward';
    if (i.achievement && !(p.achievements || []).includes(i.achievement)) return ((shared.cos.ACHIEVEMENTS || {})[i.achievement] || {}).label || 'Earn its achievement first';
    if (i.requires && !owned.has(i.requires)) return 'Own the tier below first';
    if (STOCKABLE_IDS.has(i.id) && !stock.has(i.id)) return 'Not on the shelf yet: every game you finish reveals more';
    return null;
  }
  function shopState(prof, w) {
    const p = wallets.data.profiles[w], owned = new Set(p.owned || []), stock = new Set(p.stock || []), now = wallets.now();
    // Seasons, deals and sets: `price` is what it costs today (a deal may be cheaper than `cost`).
    const sale = (id) => { const pr = SS.priceOf(id, now) || {}; const lim = SS.limitedInfo(id, now); return { price: pr.cost, pct: pr.pct || 0, limited: lim, set: SS.SET_OF[id] || null }; };
    const catalog = (shared.cos.CATALOG || []).filter((i) => sectionOf(i.field)).map((i) => ({
      id: i.id, field: i.field, value: i.value, name: i.name, cost: i.cost, free: !!i.free, section: sectionOf(i.field), category: i.category, description: i.description || '',
      owned: owned.has(i.id) || !!i.free, lock: lockOf(p, i, owned, stock, now), ...sale(i.id),
    }));
    const gearCatalog = (shared.gear.GEAR || []).map((g) => ({ ...g, owned: owned.has(g.id), equipped: !!(p.gear && p.gear[g.game] && p.gear[g.game][g.slot] === g.id), ...sale(g.id) }));
    const look = wallets.validateAvatar(w, p.avatar || {});
    return { name: prof.name, claimed: !!prof.claimed, gold: p.coins, earned: p.goldEarned, spent: p.goldSpent, look, lookSaved: !!p.lookSaved, home: p.home || null, owned: [...owned], gear: p.gear || {}, catalog, gearCatalog, ledger: (p.ledger || []).slice(0, 20), earn: earnTable(), busy: busyNow(prof.id, w),
      ...SS.shopExtras(now, owned, look) };
  }
  // A room player wears their account's look and gear.
  function dressUp(p, room = null) {
    if (!wallets || !p || !p.profileId) return;
    const w = profiles.walletOf(p.profileId);
    if (!w || !wallets.data.profiles[w]) { p.wallet = null; p.look = null; p.gear = {}; p.level = null; return; }
    p.wallet = w; p.look = wallets.lookOf(w); p.gear = wallets.gearValues(w);
    try { p.level = typeof wallets.levelOf === 'function' ? wallets.levelOf(w) : null; } catch (e) { p.level = null; }
    // JustGold this seat earned tonight before it had a wallet (box/room.js claimPending).
    if (room && typeof room.claimPending === 'function') room.claimPending(p);
  }
  // After a purchase or a change: everyone wearing that account, in any room, updates.
  function redress(accountId) { for (const r of rooms.values()) { let hit = false; for (const p of r.players.values()) if (p.profileId === accountId) { dressUp(p, r); hit = true; } if (hit) r.sync(); } }
  const find = (code) => rooms.get(String(code || '').trim().toUpperCase());
  const newCode = () => {
    const L = 'ABCDEFGHJKMNPQRSTUVWXYZ';
    let c;
    do c = Array.from({ length: 4 }, () => L[Math.floor(Math.random() * L.length)]).join(''); while (rooms.has(c) || takenElsewhere(c));
    return c;
  };

  // Wire a room to the games outside the box.
  const wire = (room) => { room.onExternal = (def, r) => (typeof external[def.key] === 'function' ? external[def.key](r, def) : { ok: false, error: `${def.name} can't be reached from here.` }); return room; };
  // A room made from outside the box (JustMafia's "Play another game"): same as host:create.
  // `code`: keep a code the group already uses (JustMafia's town code), when no box room has it.
  function createRoom(gameKey, { unlocks, code } = {}) {
    const def = GAMES[gameKey]; if (!def) return { ok: false, error: 'Unknown game.' };
    const keep = typeof code === 'string' && /^[A-Z]{4}$/.test(code) && !rooms.has(code) ? code : null;
    const room = wire(new BoxRoom(keep || newCode(), def, { nsp, shows: true, profiles, wallets }));
    room.setUnlocks(unlocks);
    if (room.isLocked(def)) return { ok: false, error: `🔒 ${def.name} is locked. ${def.locked.how || ''}`.trim(), locked: true };
    rooms.set(room.code, room);
    return { ok: true, room, code: room.code, hostKey: room.hostKey, game: def.key };
  }

  nsp.on('connection', (socket) => {
    const rawOn = socket.on.bind(socket);
    socket.on = (event, handler) => rawOn(event, (...args) => {
      try { return handler(...args); } catch (e) {
        console.error(`[guard] box ${event} failed:`, e);
        const cb = args[args.length - 1]; if (typeof cb === 'function') try { cb({ ok: false, error: 'Something went wrong. Please try again.' }); } catch { /* gone */ }
      }
    });
    socket.use((packet, next) => { if (packet[1] == null || typeof packet[1] !== 'object' || Array.isArray(packet[1])) packet[1] = {}; next(); });
    const reply = (cb, d) => { if (typeof cb === 'function') cb(d); };
    socket.data = {};
    const detach = () => {
      const r = rooms.get(socket.data.code), p = r && socket.data.playerId && r.get(socket.data.playerId);
      if (p) p.sockets = Math.max(0, p.sockets - 1);
      const a = r && socket.data.audienceId && r.audience.get(socket.data.audienceId);
      if (a) { a.sockets = Math.max(0, a.sockets - 1); a.at = Date.now(); r.syncAudience(); }
      for (const ch of socket.rooms) if (ch !== socket.id) socket.leave(ch);
      socket.data = {};
    };
    const ctx = () => { const room = rooms.get(socket.data.code); return { room, p: room && socket.data.playerId ? room.get(socket.data.playerId) : null, a: room && socket.data.audienceId ? room.audience.get(socket.data.audienceId) : null }; };
    // A phone's lifetime profile ({ id, token } from its localStorage), or null.
    const profileOf = (auth) => (profiles && auth && typeof auth === 'object' ? profiles.authenticate(auth) : null);
    const linkProfile = (room, p, prof) => {
      if (!prof || !p) return;
      p.profileId = prof.id; p.title = profiles.titleOf(prof.id);
      dressUp(p, room);
      if (!prof.claimed) profiles.setName(prof.id, p.name);
    };
    const audienceReply = (room, a, back) => ({ ok: true, audience: true, code: room.code, id: a.id, token: a.token, name: a.name, avatar: a.avatar, playNext: a.playNext, game: room.def.key, back: !!back, state: room.audienceState() });
    const seatAudience = (room, a) => {
      detach(); socket.data = { code: room.code, audienceId: a.id }; socket.join('au:' + room.code); socket.join('aum:' + room.code + ':' + a.id);
      a.sockets++; a.at = Date.now(); room.syncAudience();
    };

    socket.on('host:create', (msg, cb) => {
      // Party Mode: msg.party = { games: [keys], minutes, flow, intros, each, plan, players } plays the lineup back to back.
      let lineup = msg.party && Array.isArray(msg.party.games) ? msg.party.games.map(defOf).filter(Boolean) : null;
      // The party starts in a box game; games played elsewhere (JustMafia) come later.
      if (lineup) lineup = [...lineup.filter((d) => !d.external), ...lineup.filter((d) => d.external)];
      if (lineup && lineup.length && lineup[0].external) return reply(cb, { ok: false, error: 'Add at least one more game to the party.' });
      const def = lineup && lineup.length ? lineup[0] : GAMES[msg.game]; if (!def) return reply(cb, { ok: false, error: 'Unknown game.' });
      const room = wire(new BoxRoom(newCode(), def, { nsp, shows: true, profiles, wallets }));
      room.setUnlocks(msg.unlocks);
      if (room.isLocked(def)) return reply(cb, { ok: false, error: `🔒 ${def.name} is locked. ${def.locked.how || ''}`.trim(), locked: true });
      room.setOnboard(msg.onboard); // { seen, auto }: practice rounds by default for games new to this TV and crowd
      if (lineup && lineup.length) room.setParty(lineup, msg.party.minutes, msg.party.flow, msg.party);
      rooms.set(room.code, room);
      detach(); socket.data = { code: room.code, host: true }; socket.join('host:' + room.code);
      reply(cb, { ok: true, code: room.code, hostKey: room.hostKey, game: def.key });
      room.sync();
    });
    socket.on('host:resume', (msg, cb) => {
      const room = find(msg.code);
      if (!room || room.hostKey !== msg.hostKey) return reply(cb, { ok: false });
      room.setUnlocks(msg.unlocks);
      detach(); socket.data = { code: room.code, host: true }; socket.join('host:' + room.code);
      reply(cb, { ok: true, code: room.code, game: room.def.key }); room.sync();
    });
    socket.on('host:action', (msg, cb) => {
      const { room } = ctx();
      if (!room || !socket.data.host) return reply(cb, { ok: false, error: 'Only the big screen can do that.' });
      if (msg.type === 'switch') return reply(cb, room.switchGame(defOf(msg.game)));
      reply(cb, room.hostAction(msg));
    });

    socket.on('room:check', (msg, cb) => {
      const room = find(msg.code);
      if (!room) { const url = elsewhere(String(msg.code || '').trim().toUpperCase()); return reply(cb, { ok: false, error: 'Room not found. Check the code on the big screen.', ...(url ? { url, elsewhere: true } : {}) }); }
      reply(cb, { ok: true, code: room.code, game: room.def.key, title: room.def.name, busy: room.busy(), players: room.players.size, audience: room.audienceCount(), away: room.away ? { game: room.away.game, title: room.away.title } : null });
    });
    // Join as a player, or as the audience: msg.mode = 'watch' (just watch) | 'next' (watch now,
    // play from the next game's lobby). Without a mode, a busy room (game running, full or
    // locked) answers { busy } so the phone can ask which one.
    socket.on('player:join', (msg, cb) => {
      const room = find(msg.code);
      if (!room) { const url = elsewhere(String(msg.code || '').trim().toUpperCase()); return reply(cb, { ok: false, error: 'Room not found. Check the code on the big screen.', ...(url ? { url, elsewhere: true } : {}) }); }
      const token = typeof msg.token === 'string' ? msg.token : null, avatar = typeof msg.avatar === 'string' ? msg.avatar : null;
      const prof = profileOf(msg.profile);
      if (room.isKicked(token, prof && prof.id, msg.name)) return reply(cb, { ok: false, kicked: true, error: 'The host removed you from this room.' });
      const back = token && room.list().find((p) => p.token === token);
      const backA = !back && token && [...room.audience.values()].find((a) => a.token === token);
      if (backA) { seatAudience(room, backA); if (prof) backA.profileId = prof.id; return reply(cb, audienceReply(room, backA, true)); }
      const mode = msg.mode === 'watch' || msg.mode === 'next' ? msg.mode : null, busy = room.busy();
      if (!back && (mode === 'watch' || (busy && mode === 'next'))) {
        const r = room.joinAudience(msg.name, null, avatar, mode === 'next');
        if (!r.ok) return reply(cb, r);
        if (prof) r.member.profileId = prof.id;
        seatAudience(room, r.member);
        return reply(cb, audienceReply(room, r.member, false));
      }
      if (!back && busy) return reply(cb, { ok: false, busy, error: busy === 'running' ? 'A game is running right now.' : busy === 'full' ? 'This room is full.' : 'The host locked this room.' });
      const r = room.join(msg.name, token, avatar);
      if (!r.ok) return reply(cb, r);
      detach(); socket.data = { code: room.code, playerId: r.player.id }; socket.join('pl:' + room.code + ':' + r.player.id);
      r.player.sockets++; r.player.rosterSig = null; // a new socket gets the room's characters again
      if (prof) linkProfile(room, r.player, prof);
      reply(cb, { ok: true, code: room.code, id: r.player.id, token: r.player.token, game: room.def.key, back: !!r.back });
      room.sync();
    });
    // ---- the audience ----
    socket.on('audience:vote', (msg, cb) => {
      const { room, a } = ctx(); if (!room || !a) return reply(cb, { ok: false, error: 'Join the audience first.' });
      reply(cb, room.vote(a, msg.option));
    });
    socket.on('audience:next', (msg, cb) => {
      const { room, a } = ctx(); if (!room || !a) return reply(cb, { ok: false });
      reply(cb, room.setPlayNext(a, msg.on !== false));
    });
    // ---- lifetime profiles (box/profiles.js) ----
    // Every call carries the phone's { id, token }; nothing is kept on the socket.
    const profileView = (prof) => profiles.view(prof.id);
    // ---------- JustGold: account <-> wallet, the shop ----------
    const walletOfAuth = (auth) => { const prof = profileOf(auth); const w = prof && wallets ? profiles.walletOf(prof.id) : null; return { prof, w: w && wallets.data.profiles[w] ? w : null }; };
    socket.on('account:wallet', (msg, cb) => {
      if (!wallets) return reply(cb, { ok: false, error: 'The shop is closed.' });
      const prof = profileOf(msg.auth); if (!prof) return reply(cb, { ok: false, error: 'Make your character first.' });
      let w = profiles.walletOf(prof.id); if (w && !wallets.data.profiles[w]) w = null;
      const mafia = msg.mafia && typeof msg.mafia === 'object' ? wallets.authenticate(msg.mafia) : null;
      if (w) return reply(cb, { ok: true, wallet: mafia && mafia.id === w ? { id: w, token: msg.mafia.token } : wallets.addDevice(w) });
      // First time: this phone's JustMafia profile (gold, items, look) becomes the account's wallet,
      // unless another account already has it; otherwise a fresh wallet.
      if (mafia && !profiles.ownerOfWallet(mafia.id)) { profiles.setWallet(prof.id, mafia.id); redress(prof.id); return reply(cb, { ok: true, wallet: { id: mafia.id, token: msg.mafia.token }, linked: true }); }
      const made = wallets.create(); profiles.setWallet(prof.id, made.id); redress(prof.id);
      reply(cb, { ok: true, wallet: { id: made.id, token: made.token }, created: true });
    });
    socket.on('shop:state', (msg, cb) => { const { prof, w } = walletOfAuth(msg.auth); if (!w) return reply(cb, { ok: false, error: prof ? 'No wallet yet.' : 'Make your character first.', noWallet: !!prof }); reply(cb, { ok: true, ...shopState(prof, w) }); });
    socket.on('shop:buy', (msg, cb) => shopDo(msg, cb, (w) => (GEAR_IDS().has(msg.itemId) ? wallets.buyGear(w, msg.itemId) : SHOP_FORBIDDEN(msg.itemId) || wallets.buy(w, msg.itemId))));
    socket.on('shop:equip', (msg, cb) => shopDo(msg, cb, (w) => (GEAR_IDS().has(msg.itemId) ? wallets.equipGear(w, msg.itemId, msg.on !== false) : wallets.equip(w, msg.itemId, msg.on !== false))));
    // Theme sets: buy the missing pieces as one bundle (and put the set on), or wear an owned set.
    socket.on('shop:bundle', (msg, cb) => shopDo({ ...msg, itemId: undefined }, cb, (w) => wallets.buySet(w, String((msg && msg.setId) || ''), !!(msg && msg.wear))));
    socket.on('shop:wearSet', (msg, cb) => shopDo({ ...msg, itemId: undefined }, cb, (w) => wallets.wearSet(w, String((msg && msg.setId) || ''))));
    socket.on('shop:look', (msg, cb) => shopDo(msg, cb, (w) => { wallets.select(w, msg.look && typeof msg.look === 'object' && !Array.isArray(msg.look) ? msg.look : {}); const p = wallets.data.profiles[w]; p.lookSaved = true; wallets.save(); return { ok: true }; }));
    function shopDo(msg, cb, fn) {
      const { prof, w } = walletOfAuth(msg.auth); if (!w) return reply(cb, { ok: false, error: 'Make your character first.' });
      if (typeof msg.itemId !== 'undefined' && typeof msg.itemId !== 'string') return reply(cb, { ok: false, error: 'Unknown item.' });
      if (busyNow(prof.id, w)) return reply(cb, { ok: false, error: 'You can shop after this game.', busy: true });
      const r = fn(w) || { ok: false };
      if (r.ok) redress(prof.id);
      reply(cb, { ok: !!r.ok, error: r.error, state: shopState(prof, w) });
    }
    // ---------- progression (box/progress.js): level, challenges, the season pass ----------
    const progressReply = (prof, w, extra = {}) => ({ ok: true, ...extra, progress: wallets.progressView(w), gold: wallets.coins(w), name: prof.claimed || prof.name, title: profiles.titleOf(prof.id) });
    const progressWallet = (msg, cb) => {
      if (!wallets || typeof wallets.progressView !== 'function') { reply(cb, { ok: false, error: 'Progress is off on this server.' }); return null; }
      const { prof, w } = walletOfAuth(msg.auth);
      if (!w) { reply(cb, { ok: false, noWallet: !!prof, error: prof ? 'Open the shop once to start your profile.' : 'Make your character first.' }); return null; }
      return { prof, w };
    };
    socket.on('progress:get', (msg, cb) => { const x = progressWallet(msg, cb); if (x) reply(cb, progressReply(x.prof, x.w)); });
    // Tests and screenshots only (MT_DEV_GRANTS=1): the running game "ran" `minutes` (default 10) and
    // skips ahead to its end, so the chest scene can be checked without waiting (tools/e2e-chest.js).
    if (process.env.MT_DEV_GRANTS === '1') socket.on('dev:finish', (msg, cb) => {
      const room = find(msg.code); if (!room || room.hostKey !== msg.hostKey) return reply(cb, { ok: false, error: 'No such room.' });
      if (room.phase === 'show' && room.show) room.show.skip();
      if (room.phase !== 'game' || !room.game) return reply(cb, { ok: false, error: 'No game running.' });
      room.gameStartAt = room.now() - Math.max(2, Math.min(120, Number(msg.minutes) || 10)) * 60000;
      for (let i = 0; i < 400 && room.game.phase !== 'over' && room.game.next; i++) room.game.next();
      room.sync(); reply(cb, { ok: room.game.phase === 'over' });
    });
    // Tests and screenshots only (MT_DEV_GRANTS=1, like JustMafia's dev:grant): XP / JustGold as if a game paid it.
    if (process.env.MT_DEV_GRANTS === '1') socket.on('dev:progress', (msg, cb) => {
      const x = progressWallet(msg, cb); if (!x) return;
      if (msg.gold) wallets.grant(x.w, msg.gold);
      const news = wallets.progressGame(x.w, { id: 'dev:' + Date.now() + ':' + Math.random(), game: typeof msg.game === 'string' ? msg.game : 'likely', kind: 'box', xp: Math.max(0, Math.min(100000, Number(msg.xp) || 0)), place: 1, of: 4, won: !!msg.won, tags: {} });
      for (const r of rooms.values()) { let hit = false; for (const p of r.players.values()) if (p.profileId === x.prof.id) { r.progressNews(p, news); hit = true; } if (hit) r.sync(); }
      reply(cb, progressReply(x.prof, x.w, { news }));
    });
    socket.on('progress:reroll', (msg, cb) => {
      const x = progressWallet(msg, cb); if (!x) return;
      const r = wallets.rerollChallenge(x.w, msg.period, msg.id);
      reply(cb, r.ok ? progressReply(x.prof, x.w, { replaced: r.replaced, id: r.id }) : { ok: false, error: r.error });
    });
    socket.on('progress:premium', (msg, cb) => {
      const x = progressWallet(msg, cb); if (!x) return;
      if (busyNow(x.prof.id, x.w)) return reply(cb, { ok: false, error: 'You can get the pass after this game.', busy: true });
      const r = wallets.buyPass(x.w);
      if (r.ok) redress(x.prof.id);
      reply(cb, r.ok ? progressReply(x.prof, x.w, { rewards: r.rewards }) : { ok: false, error: r.error });
    });
    socket.on('profile:create', (msg, cb) => {
      if (!profiles) return reply(cb, { ok: false, error: 'Profiles are off on this server.' });
      const now = Date.now(); if (now - (socket.data.lastProfile || 0) < 1500) return reply(cb, { ok: false, error: 'One moment…' });
      socket.data.lastProfile = now;
      const auth = profiles.create(typeof msg.name === 'string' ? msg.name : null);
      const { room, p } = ctx(); if (p) { linkProfile(room, p, profiles.get(auth.id)); room.sync(); }
      reply(cb, { ok: true, id: auth.id, token: auth.token, profile: profiles.view(auth.id) });
    });
    socket.on('profile:get', (msg, cb) => {
      const prof = profileOf(msg.auth); if (!prof) return reply(cb, { ok: false, error: 'Profile not found.' });
      const { room, p } = ctx(); if (p && p.profileId !== prof.id) { linkProfile(room, p, prof); room.sync(); }
      reply(cb, { ok: true, profile: profileView(prof) });
    });
    // "Save your stuff": a name + password (old clients send it as `pin`, a numeric password).
    const pwOf = (msg, k = 'password') => { const v = msg[k] != null ? msg[k] : k === 'password' ? msg.pin : null; return typeof v === 'string' || typeof v === 'number' ? String(v) : ''; };
    socket.on('profile:claim', (msg, cb) => {
      const prof = profileOf(msg.auth); if (!prof) return reply(cb, { ok: false, error: 'Profile not found.' });
      reply(cb, profiles.claim(prof.id, msg.name, pwOf(msg)));
    });
    socket.on('profile:login', (msg, cb) => {
      if (!profiles) return reply(cb, { ok: false, error: 'Profiles are off on this server.' });
      const r = profiles.login(msg.name, pwOf(msg));
      if (r.ok) { const { room, p } = ctx(); if (p) { linkProfile(room, p, profiles.get(r.id)); room.sync(); } }
      reply(cb, r);
    });
    socket.on('profile:password', (msg, cb) => {
      const prof = profileOf(msg.auth); if (!prof) return reply(cb, { ok: false, error: 'Profile not found.' });
      reply(cb, profiles.changePassword(prof.id, pwOf(msg, 'old'), pwOf(msg)));
    });
    // Sign out on this phone: the device token stops working; the saved account stays.
    socket.on('profile:logout', (msg, cb) => {
      const prof = profileOf(msg.auth); if (!prof) return reply(cb, { ok: true });
      if (!prof.claimed) return reply(cb, { ok: false, error: 'Save your stuff with a name and password first, or it would be lost.' });
      profiles.forgetDevice(msg.auth);
      reply(cb, { ok: true });
    });
    // A light look at the account for the "Save your stuff" prompts: saved or not, JustGold, games.
    // Without an account yet, the phone's JustMafia wallet (`mafia`) still shows its gold.
    socket.on('account:status', (msg, cb) => {
      const prof = profileOf(msg.auth);
      let w = prof && wallets ? profiles.walletOf(prof.id) : null; if (w && !wallets.data.profiles[w]) w = null;
      if (!w && wallets && msg.mafia && typeof msg.mafia === 'object') { const m = wallets.authenticate(msg.mafia); if (m && (!prof || !profiles.ownerOfWallet(m.id))) w = m.id; }
      const wp = w ? wallets.data.profiles[w] : null;
      reply(cb, { ok: true, account: !!prof, saved: !!(prof && prof.claimed && prof.password), name: prof ? prof.claimed || prof.name : null,
        gold: wp ? wp.coins || 0 : 0, games: (prof ? prof.stats.games : 0) + (wp ? (wp.stats && wp.stats.games) || 0 : 0) });
    });
    socket.on('profile:title', (msg, cb) => {
      const prof = profileOf(msg.auth); if (!prof) return reply(cb, { ok: false, error: 'Profile not found.' });
      const r = profiles.setTitle(prof.id, msg.title || null);
      if (r.ok) { for (const room of rooms.values()) for (const p of room.players.values()) if (p.profileId === prof.id) { p.title = profiles.titleOf(prof.id); room.sync(); } }
      reply(cb, r);
    });
    socket.on('player:act', (msg, cb) => {
      const { room, p } = ctx();
      if (!room || !p) return reply(cb, { ok: false, error: 'You are not in this room.' });
      reply(cb, room.act(p, msg));
    });
    // The host's phone (first to join) can start the game or play again.
    socket.on('player:host', (msg, cb) => {
      const { room, p } = ctx();
      if (!room || !p) return reply(cb, { ok: false, error: 'You are not in this room.' });
      const type = String(msg.type || '');
      if (type === 'switch') { const v = room.vip(); if (!v || v.id !== p.id) return reply(cb, { ok: false, error: 'Only the host can pick the next game.' }); return reply(cb, room.switchGame(defOf(msg.game))); }
      if (type === 'kick') {
        const v = room.vip(); if (!v || v.id !== p.id) return reply(cb, { ok: false, error: 'Only the host can remove players.' });
        if (String(msg.id) === p.id) return reply(cb, { ok: false, error: 'You can’t remove yourself. Use Leave instead.' });
        return reply(cb, room.kick(String(msg.id || '')));
      }
      reply(cb, room.vipAction(p, type));
    });
    // Emoji reactions float up on the TV (sent straight to the TV, not stored in the game).
    socket.on('player:react', (msg, cb) => {
      const { room, p, a } = ctx();
      if (!room || (!p && !a) || !REACTIONS.includes(msg.e)) return reply(cb, { ok: false });
      const now = Date.now(); if (now - (socket.data.lastReact || 0) < 600) return reply(cb, { ok: false });
      socket.data.lastReact = now;
      if (a) {
        if (!room.audienceReactOk()) return reply(cb, { ok: true, dropped: true });
        nsp.to('host:' + room.code).emit('react', { e: msg.e, name: a.name, avatar: a.avatar, color: a.color, audience: true });
        return reply(cb, { ok: true });
      }
      nsp.to('host:' + room.code).emit('react', { e: msg.e, name: p.name, avatar: p.avatar, color: p.color });
      reply(cb, { ok: true });
    });
    socket.on('player:avatar', (msg, cb) => { const { room, p } = ctx(); if (!room || !p) return reply(cb, { ok: false }); reply(cb, room.setAvatar(p, msg.avatar)); });
    // Moves that wait on the outside world (JustFunny: YouTube search and checking a video).
    socket.on('player:async', async (msg, cb) => {
      const { room, p } = ctx();
      if (!room || !p || !room.game || !room.game.actAsync) return reply(cb, { ok: false, error: 'Not now.' });
      const now = Date.now(); if (now - (socket.data.lastAsync || 0) < 700) return reply(cb, { ok: false, error: 'One moment…' });
      socket.data.lastAsync = now;
      try { reply(cb, await room.game.actAsync(p, msg)); } catch (e) { console.error('[guard] box async failed:', e); reply(cb, { ok: false, error: 'Something went wrong. Try again.' }); }
      room.sync();
    });
    socket.on('player:leave', (_m, cb) => { const { room, p, a } = ctx(); if (room && p) { detach(); room.remove(p.id); } else if (room && a) { detach(); room.removeAudience(a.id); } reply(cb, { ok: true }); });
    socket.on('disconnect', () => { const { room, p, a } = ctx(); if (p) { p.sockets = Math.max(0, p.sockets - 1); room.sync(); } if (a) { a.sockets = Math.max(0, a.sockets - 1); a.at = Date.now(); room.syncAudience(); } });
  });

  setInterval(() => {
    const cutoff = Date.now() - 6 * 60 * 60 * 1000;
    for (const [code, room] of rooms) if (room.lastActivity < cutoff) { room.destroy(); rooms.delete(code); }
    // Watchers who left more than 15 minutes ago are forgotten.
    const gone = Date.now() - 15 * 60 * 1000;
    for (const room of rooms.values()) for (const a of [...room.audience.values()]) if (a.sockets <= 0 && a.at < gone) room.removeAudience(a.id);
  }, 10 * 60 * 1000).unref();

  return { has: (code) => rooms.has(String(code || '').toUpperCase()), get: (code) => find(code), rooms, GAMES, createRoom, profiles };
}

module.exports = { installBox, GAMES, EXTERNAL };
