'use strict';
const path = require('path');
const os = require('os');
const http = require('http');
const express = require('express');
const QRCode = require('qrcode');
const { Server } = require('socket.io');
const { Worker } = require('worker_threads');
const { Room } = require('./game');
const { ProfileStore } = require('./profiles');
const OPTIONS = require('./public/shared/options');
const profiles = new ProfileStore(process.env.MT_PROFILE_STORE === 'memory' ? null : path.join(__dirname, '.data', 'profiles.json'));

const PORT = Number(process.env.PORT) || 3000;

// Pick the address phones on the same Wi-Fi can reach.
function lanAddress() {
  const candidates = [];
  for (const [name, addrs] of Object.entries(os.networkInterfaces())) {
    for (const a of addrs || []) {
      if (a.family !== 'IPv4' || a.internal) continue;
      let score = 0;
      if (a.address.startsWith('192.168.')) score += 3;
      else if (a.address.startsWith('10.')) score += 2;
      else if (/^172\.(1[6-9]|2\d|3[01])\./.test(a.address)) score += 1;
      if (/wi-?fi|wlan|ethernet|en\d/i.test(name)) score += 2;
      if (/vEthernet|virtual|vmware|vbox|hyper-v|wsl|docker|loopback|tailscale|zerotier|bluetooth/i.test(name)) score -= 10;
      candidates.push({ address: a.address, score });
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  return candidates.length ? candidates[0].address : 'localhost';
}

const BASE_URL = (process.env.PUBLIC_URL || `http://${lanAddress()}:${PORT}`).replace(/\/+$/, '');

const app = express();
const server = http.createServer(app);
// Compress game-state messages (~15 KB of JSON per phone update shrinks several-fold),
// which matters with 20+ phones sharing one Wi-Fi network.
const io = new Server(server, { pingInterval: 10000, pingTimeout: 20000, perMessageDeflate: { threshold: 1024 }, httpCompression: { threshold: 1024 } });
const rooms = new Map();

app.use(express.static(path.join(__dirname, 'public')));
app.get(['/play', '/join'], (req, res) => res.sendFile(path.join(__dirname, 'public', 'play.html')));
app.get('/judge', (req, res) => res.sendFile(path.join(__dirname, 'public', 'judge.html')));
app.get('/test', (req, res) => res.sendFile(path.join(__dirname, 'public', 'test.html')));
app.get('/preview', (req, res) => res.sendFile(path.join(__dirname, 'public', 'preview.html')));
app.get('/art', (req, res) => res.sendFile(path.join(__dirname, 'public', 'art-gallery.html')));
app.get('/api/info', (req, res) => res.json({ baseUrl: BASE_URL }));
app.get('/api/qr', async (req, res) => {
  const text = String(req.query.text || '').slice(0, 300);
  if (!text) return res.status(400).end();
  try {
    const png = await QRCode.toBuffer(text, { width: 520, margin: 1, errorCorrectionLevel: 'M' });
    res.type('png').set('Cache-Control', 'public, max-age=3600').send(png);
  } catch {
    res.status(400).end();
  }
});

function newCode() {
  const L = 'ABCDEFGHJKMNPQRSTUVWXYZ';
  let c;
  do c = Array.from({ length: 4 }, () => L[Math.floor(Math.random() * L.length)]).join('');
  while (rooms.has(c));
  return c;
}

const findRoom = (code) => rooms.get(String(code || '').trim().toUpperCase());
// Customizing and shopping are lobby-only: once a game starts, a profile seated in
// it can't buy, equip, or save look/house changes until the room is back in the lobby.
const CLOSED = 'The shop and customization reopen after this game, back in the lobby.';
const profileInGame = (profileId) => !!profileId && [...rooms.values()].some((r) => r.phase !== 'lobby' && r.list().some((p) => p.profileId === profileId && !p.left));
// Older phones sent the home inside the avatar (houseStyle/houseColor/houseDecor).
const legacyHome = (av) => { const h = {}; if (av && typeof av === 'object') for (const [k, old] of Object.entries(OPTIONS.LEGACY_HOME)) if (av[old] != null) h[k] = av[old]; return h; };

// Crash guards (live games must survive a bug): log instead of exiting the process.
process.on('uncaughtException', (e) => console.error('[guard] uncaught exception (game kept running):', e));
process.on('unhandledRejection', (e) => console.error('[guard] unhandled rejection (game kept running):', e));

io.on('connection', (socket) => {
  // Every handler is wrapped: an error in one action is logged and answered,
  // instead of crashing the server and ending everyone's game.
  const rawOn = socket.on.bind(socket);
  socket.on = (event, handler) => rawOn(event, (...args) => {
    try { return handler(...args); } catch (e) {
      console.error(`[guard] ${event} failed:`, e);
      const cb = args[args.length - 1]; if (typeof cb === 'function') try { cb({ ok: false, error: 'Something went wrong. Please try again.' }); } catch { /* client gone */ }
    }
  });
  // Normalize malformed packets before any handler dereferences their fields.
  socket.use((packet, next) => {
    if (packet[1] == null || (typeof packet[1] !== 'object' && typeof packet[1] !== 'function') || Array.isArray(packet[1])) packet[1] = {};
    next();
  });
  const reply = (cb, data) => { if (typeof cb === 'function') cb(data); };
  function detach() {
    const old = rooms.get(socket.data.code);
    const p = old && socket.data.kind === 'player' && old.players.get(socket.data.playerId);
    if (p) p.sockets = Math.max(0, p.sockets - 1);
    for (const channel of socket.rooms) if (channel !== socket.id && channel !== 'profile:' + socket.profileId) socket.leave(channel);
  }

  function attachHost(room) {
    detach();
    socket.data = { code: room.code, kind: 'host', adminEpoch: 0 };
    socket.join(room.hostChannel());
  }

  function attachPlayer(room, p) {
    detach();
    socket.data = { code: room.code, kind: 'player', playerId: p.id };
    socket.join(room.playerChannel(p));
    p.sockets += 1;
    room.checkJudgeRemoval(); room.chooseReplacement();
    room.sync();
  }

  function attachJudge(room) {
    detach();
    socket.data = { code: room.code, kind: 'judge', adminEpoch: room.adminEpoch };
    socket.join(room.judgeChannel());
  }

  function ctx() {
    const room = rooms.get(socket.data.code);
    if (!room) return {};
    if (socket.data.kind === 'judge' && (socket.data.adminEpoch !== room.adminEpoch || room.judgeVacant)) return {};
    if (socket.data.kind === 'host' || socket.data.kind === 'judge') return { room };
    const p = room.players.get(socket.data.playerId);
    return p ? { room, p } : { room };
  }

  socket.data = {};

  // ----- host -----
  socket.on('host:create', (_msg, cb) => {
    const room = new Room(newCode(), io, { profiles });
    rooms.set(room.code, room);
    attachHost(room);
    reply(cb, { ok: true, code: room.code, hostKey: room.hostKey });
    room.sync();
  });

  socket.on('host:resume', (msg = {}, cb) => {
    const room = findRoom(msg.code);
    if (!room || room.hostKey !== msg.hostKey) return reply(cb, { ok: false });
    attachHost(room);
    reply(cb, { ok: true, code: room.code });
    room.sync();
  });

  socket.on('host:action', (msg, cb) => {
    const { room } = ctx();
    if (!room || !['host', 'judge'].includes(socket.data.kind) || socket.data.adminEpoch !== room.adminEpoch || room.judgeVacant) return reply(cb, { ok: false, error: 'Judge access has expired.' });
    reply(cb, room.hostAction(msg || {}) || { ok: true });
  });

  // The game's rundown (who did what): TV or Judge, and only once the game is over.
  socket.on('room:rundown', (msg, cb) => {
    const { room } = ctx();
    if (!room || !['host', 'judge'].includes(socket.data.kind)) return reply(cb, { ok: false, error: 'Only the big screen or the Judge can show the rundown.' });
    const out = room.rundown();
    // The Judge can also put it up on the big screen (or close it there).
    if (out.ok && socket.data.kind === 'judge' && msg && msg.toTv != null) io.to(room.hostChannel()).emit('host:rundown', { show: !!msg.toTv, rundown: out.rundown });
    reply(cb, out);
  });

  // ----- Judge console (full information; authenticated with the host key) -----
  socket.on('judge:attach', (msg = {}, cb) => {
    const room = findRoom(msg.code);
    const p = room && room.byToken(msg.token);
    if (!room || room.judgeVacant || !(msg.hostKey === room.judgeKey || (p && p.id === room.judgeParticipantId && p.isJudge))) return reply(cb, { ok: false, error: 'Judge access has expired or credentials are invalid.' });
    attachJudge(room);
    reply(cb, { ok: true, code: room.code });
    room.sync();
  });

  // Judge scene controls: presentation only, relayed to the big screen.
  // They never change game state, and every field is validated.
  const SCENES = ['murder', 'investigation', 'watcher', 'peek', 'flee', 'visitor', 'emptyHouse', 'graveyard', 'square', 'quietNight', 'victory', 'hurricane', 'flood', 'meteor', 'introduction', 'protection', 'beyond', 'photograph', 'blessing',
    'death_lake', 'death_hearth', 'death_tavern', 'death_field', 'death_chase', 'headhunt', 'headhuntExecution'];
  const HOUSE_SCENES = ['murder', 'investigation', 'watcher', 'peek', 'flee', 'visitor', 'emptyHouse', 'hurricane', 'flood', 'meteor', 'protection',
    'death_lake', 'death_hearth', 'death_tavern', 'death_field', 'death_chase', 'headhunt', 'headhuntExecution'];
  SCENES.push('planting','explosion','crier','revival','ash','hustle','nomination','ghostVote','silence','emergencyVote');
  const OUTCOMES = ['kill', 'protected', 'guard', 'guardDies', 'blocked', 'failed', 'multiple'];
  const SPOTS = ['overview', 'square', 'cemetery', 'pond', 'tavern', 'hall', 'firepit'];
  const MOODS = ['tension', 'ominous', 'peace', 'eerie', 'triumph'];
  function judgeRelay(event, build) {
    socket.on(event, (msg = {}, cb) => {
      const { room } = ctx();
      if (!room || socket.data.kind !== 'judge') return reply(cb, { ok: false, error: 'Judge only.' });
      const out = build(msg || {}, room);
      if (!out) return reply(cb, { ok: false, error: 'Invalid request.' });
      io.to(room.hostChannel()).emit(out.event, out.data);
      reply(cb, { ok: true });
    });
  }
  const houseOf = (room, v) => {
    if (v == null || v === '') return null;
    const n = Number(v);
    // Only plots with a house on them (owners, not guests living elsewhere).
    return Number.isInteger(n) && room.list().some((p) => p.house === n && !p.spectator && !room.ownerOfHome(p)) ? n : null;
  };
  judgeRelay('judge:scene', (m, room) => {
    if (!SCENES.includes(m.scene)) return null;
    const house = houseOf(room, m.house);
    if (m.house != null && house == null) return null;
    if (HOUSE_SCENES.includes(m.scene) && house == null) return null;
    const outcome = OUTCOMES.includes(m.outcome) ? m.outcome : undefined;
    return { event: 'host:scene', data: { scene: m.scene, outcome, house, title: m.scene === 'victory' ? String(m.title || '').slice(0, 60) : undefined } };
  });
  judgeRelay('judge:camera', (m, room) => {
    if (m.spot != null) return SPOTS.includes(m.spot) ? { event: 'host:camera', data: { spot: m.spot } } : null;
    const house = houseOf(room, m.house);
    return house == null ? null : { event: 'host:camera', data: { house, zoom: Math.min(3.5, Math.max(1, Number(m.zoom) || 2.4)) } };
  });
  judgeRelay('judge:music', (m) => (m.mood == null || MOODS.includes(m.mood) ? { event: 'host:music', data: { mood: m.mood || null } } : null));
  judgeRelay('judge:stop', () => ({ event: 'host:stop', data: {} }));
  judgeRelay('judge:narration', (m) => (m.skip ? { event: 'host:narration', data: { skip: true } } : null));

  // Headless balance simulations, run in a worker thread.
  let simRunning = false;
  socket.on('judge:simulate', (msg = {}, cb) => {
    const { room } = ctx();
    if (!room || socket.data.kind !== 'judge') return reply(cb, { ok: false, error: 'Judge only.' });
    if (simRunning) return reply(cb, { ok: false, error: 'A simulation is already running.' });
    const players = [].concat(msg.players || 10).map((n) => Math.min(100, Math.max(3, parseInt(n, 10) || 10))).slice(0, 12);
    const games = Math.min(5000, Math.max(1, parseInt(msg.games, 10) || 100));
    const settings = { ...room.settings, forcedRoles: {}, ...(msg.settings || {}) };
    simRunning = true;
    const worker = new Worker(path.join(__dirname, 'sim-worker.js'), { workerData: { games, players, settings, personality: msg.personality || undefined } });
    const done = (r) => { simRunning = false; reply(cb, r); };
    worker.once('message', (result) => done({ ok: true, result }));
    worker.once('error', (e) => done({ ok: false, error: String(e && e.message) }));
  });

  // ----- players -----
  socket.on('profile:create', (_msg, cb) => { if (socket.profileId) return reply(cb, { ok: false, error: 'This connection already has a profile.' }); const p = profiles.create(); socket.profileId = p.id; socket.join('profile:' + p.id); reply(cb, { ok: true, ...p }); });
  socket.on('profile:resume', (msg = {}, cb) => { const p = profiles.authenticate(msg); if (!p) return reply(cb, { ok: false }); if (socket.profileId && socket.profileId !== p.id) socket.leave('profile:' + socket.profileId); socket.profileId = p.id; socket.join('profile:' + p.id); reply(cb, { ok: true, profile: profiles.view(p.id) }); });
  socket.on('profile:buy', (msg = {}, cb) => { if (profileInGame(socket.profileId)) return reply(cb, { ok: false, error: CLOSED }); const result = profiles.buy(socket.profileId, msg.itemId); reply(cb, result); if (result.ok) { io.to('profile:' + socket.profileId).emit('profile:state', profiles.view(socket.profileId)); const { room } = ctx(); if (room) room.sync(); } });
  // Character creator: save a look to the profile without being in a room. The
  // in-room avatar only changes through player:profile (lobby-only).
  socket.on('profile:avatar', (msg = {}, cb) => {
    if (!socket.profileId) return reply(cb, { ok: false, error: 'Profile not connected yet.' });
    if (profileInGame(socket.profileId)) return reply(cb, { ok: false, error: CLOSED });
    profiles.select(socket.profileId, msg.avatar && typeof msg.avatar === 'object' ? msg.avatar : {});
    reply(cb, { ok: true, profile: profiles.view(socket.profileId) });
  });
  // Inventory: equip/unequip an owned shop item on the saved character or house.
  // In a lobby it also applies to your seat, so the TV updates right away.
  socket.on('profile:equip', (msg = {}, cb) => {
    if (!socket.profileId) return reply(cb, { ok: false, error: 'Profile not connected yet.' });
    if (profileInGame(socket.profileId)) return reply(cb, { ok: false, error: CLOSED });
    const r = profiles.equip(socket.profileId, msg.itemId, msg.on !== false);
    if (!r.ok) return reply(cb, r);
    const { room, p } = ctx();
    if (p && room.phase === 'lobby' && p.profileId === socket.profileId) {
      if (r.target === 'home') room.updateProfile(p, { home: profiles.validateHome(p.profileId, r.profile.home) });
      else room.updateProfile(p, { avatar: profiles.validateAvatar(p.profileId, r.profile.avatar) });
    }
    io.to('profile:' + socket.profileId).emit('profile:state', r.profile);
    reply(cb, r);
  });
  // Tests only: grant gold when the server runs with MT_DEV_GRANTS=1.
  if (process.env.MT_DEV_GRANTS === '1') socket.on('dev:grant', (msg = {}, cb) => {
    if (!socket.profileId || !profiles.grant(socket.profileId, msg.amount)) return reply(cb, { ok: false });
    const view = profiles.view(socket.profileId); io.to('profile:' + socket.profileId).emit('profile:state', view); reply(cb, { ok: true, profile: view });
  });
  // House designer: save a home design to the profile without being in a room.
  socket.on('profile:home', (msg = {}, cb) => {
    if (!socket.profileId) return reply(cb, { ok: false, error: 'Profile not connected yet.' });
    if (profileInGame(socket.profileId)) return reply(cb, { ok: false, error: CLOSED });
    profiles.selectHome(socket.profileId, msg.home);
    reply(cb, { ok: true, profile: profiles.view(socket.profileId) });
  });
  socket.on('room:check', (msg = {}, cb) => {
    const room = findRoom(msg.code);
    reply(cb, room ? { ok: true, code: room.code, lobby: room.phase === 'lobby' } : { ok: false, error: 'Room not found. Check the code on the big screen.' });
  });
  socket.on('player:join', (msg = {}, cb) => {
    const room = findRoom(msg.code);
    if (!room) return reply(cb, { ok: false, error: 'Room not found. Check the code on the big screen.' });
    const existing = socket.profileId && room.list().find((p) => p.profileId === socket.profileId && !p.left);
    const r = existing ? { player: existing } : room.join({ name: msg.name, avatar: profiles.validateAvatar(socket.profileId, msg.avatar || {}), home: profiles.validateHome(socket.profileId, msg.home || legacyHome(msg.avatar)) });
    if (r.error) return reply(cb, { ok: false, error: r.error });
    if (socket.profileId) { r.player.profileId = socket.profileId; profiles.select(socket.profileId, r.player.avatar); profiles.selectHome(socket.profileId, r.player.homeLook); }
    attachPlayer(room, r.player);
    reply(cb, { ok: true, code: room.code, token: r.player.token, playerId: r.player.id });
  });

  socket.on('player:resume', (msg = {}, cb) => {
    const room = findRoom(msg.code);
    const p = room && room.byToken(msg.token);
    if (!p || p.left) return reply(cb, { ok: false });
    attachPlayer(room, p);
    reply(cb, { ok: true, code: room.code, playerId: p.id });
  });

  socket.on('player:profile', (msg = {}) => { const { room, p } = ctx(); if (p && room.phase === 'lobby') { room.updateProfile(p, { name: msg.name, avatar: profiles.validateAvatar(p.profileId, msg.avatar || p.avatar) }); if (p.profileId) profiles.select(p.profileId, p.avatar); } });
  // Your house: claim a plot / move in with someone, and/or change your house's design (lobby only).
  socket.on('player:home', (msg = {}, cb) => {
    const { room, p } = ctx();
    if (!p || room.phase !== 'lobby' || p.left) return reply(cb, { ok: false, error: 'Homes can only change in the lobby.' });
    let claimed = null;
    if (msg.claim && typeof msg.claim === 'object') { claimed = room.claimHome(p, msg.claim); if (!claimed.ok) return reply(cb, claimed); }
    if (msg.look && typeof msg.look === 'object') {
      room.updateProfile(p, { home: profiles.validateHome(p.profileId, msg.look) });
      if (p.profileId) profiles.selectHome(p.profileId, p.homeLook);
    }
    reply(cb, { ok: true, pending: !!(claimed && claimed.pending), moved: !!(claimed && claimed.moved) });
  });
  // A host answers a move-in request (yes/no) during setup.
  // Verdict window: intervene (interrupt / protect / defend / cancel) and last words.
  socket.on('player:intervene', (msg = {}, cb) => { const { room, p } = ctx(); reply(cb, p ? room.intervene(p, String(msg.kind || '')) : { ok: false }); });
  // Role draft: vote for a card (toggle) or lock in; then flip your own dealt card.
  socket.on('player:draftVote', (msg = {}, cb) => { const { room, p } = ctx(); reply(cb, p ? room.draftVote(p, { role: typeof msg.role === 'string' ? msg.role : null, on: typeof msg.on === 'boolean' ? msg.on : null, ready: msg.ready === true }) : { ok: false }); });
  // Headhunter powers (mark, disguise, puppet, strike, reveal, execute); the server checks level and timing.
  socket.on('player:headhunter', (msg = {}, cb) => { const { room, p } = ctx(); reply(cb, p ? room.headhunterAction(p, { op: String(msg.op || ''), targetId: msg.targetId ? String(msg.targetId) : null, role: msg.role == null ? null : String(msg.role) }) : { ok: false }); });
  socket.on('player:flip', (msg = {}, cb) => { const { room, p } = ctx(); reply(cb, p ? room.flipCard(p) : { ok: false }); });
  socket.on('player:lastWords', (msg = {}, cb) => { const { room, p } = ctx(); reply(cb, p ? room.setLastWords(p, { nameId: msg.nameId ? String(msg.nameId) : null, word: msg.word ? String(msg.word) : null }) : { ok: false }); });
  socket.on('player:moveReply', (msg = {}, cb) => {
    const { room, p } = ctx();
    if (!p || room.phase !== 'lobby') return reply(cb, { ok: false, error: 'Move-in requests are only answered during setup.' });
    reply(cb, room.respondMoveIn(p, msg.fromId, !!msg.accept));
  });
  socket.on('player:night', (msg = {}) => { const { room, p } = ctx(); if (p) room.nightAction(p, msg.targetId, { variant: msg.variant, delay: msg.delay }); });
  socket.on('player:vote', (msg = {}) => { const { room, p } = ctx(); if (p) room.vote(p, msg.targetId); });
  socket.on('player:haunt', (msg = {}) => { const { room, p } = ctx(); if (p) room.haunt(p, msg.kind, msg.targetId); });
  socket.on('player:telepath', (msg = {}, cb) => { const { room, p } = ctx(); reply(cb, p ? room.sendTelepath(p, msg) : { ok: false }); });
  socket.on('player:removeJudge', (_msg, cb) => { const { room, p } = ctx(); reply(cb, p ? room.voteRemoveJudge(p) : { ok: false }); });
  socket.on('player:volunteerJudge', (msg = {}, cb) => { const { room, p } = ctx(); reply(cb, p ? room.volunteerJudge(p, msg.confirmed === true) : { ok: false }); });
  socket.on('player:ability', (msg = {}, cb) => { const { room, p } = ctx(); reply(cb, p ? room.dayAbility(p, msg) : { ok: false }); });
  socket.on('player:mafiaVote', (msg = {}, cb) => { const { room, p } = ctx(); reply(cb, p ? room.voteMafia(p, msg.targetId) : { ok: false }); });
  socket.on('player:mafiaMessage', (msg = {}, cb) => { const { room, p } = ctx(); reply(cb, p ? room.sendMafia(p, msg) : { ok: false }); });
  socket.on('player:variant', (msg = {}, cb) => { const { room, p } = ctx(); reply(cb, p ? room.chooseVariant(p, msg.variant) : { ok: false }); });
  socket.on('player:special', (msg = {}, cb) => { const { room, p } = ctx(); reply(cb, p ? room.specialAction(p, msg) : { ok: false }); });
  socket.on('player:ghostChat', (msg = {}, cb) => { const { room, p } = ctx(); reply(cb, p ? room.sendGhost(p, msg.text) : { ok: false }); });
  socket.on('player:whisper', (msg = {}, cb) => { const { room, p } = ctx(); reply(cb, p ? msg.op === 'reply' ? room.replyWhisper(p, Number(msg.id), msg.accept === true) : msg.op === 'send' ? room.sendWhisper(p, Number(msg.id), msg.text) : room.requestWhisper(p, msg.targetId) : { ok: false }); });
  socket.on('player:nominate', (msg = {}, cb) => { const { room, p } = ctx(); reply(cb, p ? msg.second ? room.secondNomination(p) : room.nominate(p, msg.targetId) : { ok: false }); });

  socket.on('disconnect', () => {
    const { room, p } = ctx();
    if (p) { p.sockets = Math.max(0, p.sockets - 1); room.checkJudgeRemoval(); room.chooseReplacement(); room.sync(); }
  });
});

// Clean up abandoned rooms.
setInterval(() => {
  const cutoff = Date.now() - 6 * 60 * 60 * 1000;
  for (const [code, room] of rooms) {
    if (room.lastActivity < cutoff) { room.destroy(); rooms.delete(code); }
  }
}, 10 * 60 * 1000).unref();

server.listen(PORT, () => {
  console.log('\n  Mafia Town is running!\n');
  console.log(`  Big screen (open on the TV/computer):  http://localhost:${PORT}`);
  console.log(`  Phones join at:                        ${BASE_URL}/play`);
  console.log(`  Judge console:                         http://localhost:${PORT}/judge  (or ⚙ → Judge console)`);
  console.log(`  All-in-one test page (share on LAN):   ${BASE_URL}/test`);
  console.log('\n  Phones must be on the same Wi-Fi as this computer.');
  console.log('  Set PUBLIC_URL to override the join link (e.g. when using a tunnel).\n');
});
