'use strict';
// JustGameBox socket server (namespace /box): every box game shares the same room code,
// QR join, lobby settings, bots and reconnection — the way JustMafia works.
const path = require('path');
const { BoxRoom } = require('./room');

const GAMES = {
  president: require('./games/president'),
  blackjack: require('./games/blackjack'),
  ducks: require('./games/ducks'),
  blanks: require('./games/blanks'),
  truths: require('./games/truths'),
};

function installBox(app, io, { takenElsewhere = () => false } = {}) {
  const pub = path.join(__dirname, '..', 'public', 'box');
  app.get('/box/tv', (req, res) => res.sendFile(path.join(pub, 'tv.html')));
  app.get('/box/play', (req, res) => res.sendFile(path.join(pub, 'play.html')));
  // Big games get their own address, like JustMafia's /mafia.
  app.get('/ducks', (req, res) => res.sendFile(path.join(pub, 'tv.html')));
  app.get('/ducks/play', (req, res) => res.sendFile(path.join(pub, 'play.html')));

  const nsp = io.of('/box');
  const rooms = new Map();
  const find = (code) => rooms.get(String(code || '').trim().toUpperCase());
  const newCode = () => {
    const L = 'ABCDEFGHJKMNPQRSTUVWXYZ';
    let c;
    do c = Array.from({ length: 4 }, () => L[Math.floor(Math.random() * L.length)]).join(''); while (rooms.has(c) || takenElsewhere(c));
    return c;
  };

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
      for (const ch of socket.rooms) if (ch !== socket.id) socket.leave(ch);
      socket.data = {};
    };
    const ctx = () => { const room = rooms.get(socket.data.code); return { room, p: room && socket.data.playerId ? room.get(socket.data.playerId) : null }; };

    socket.on('host:create', (msg, cb) => {
      const def = GAMES[msg.game]; if (!def) return reply(cb, { ok: false, error: 'Unknown game.' });
      const room = new BoxRoom(newCode(), def, { nsp });
      rooms.set(room.code, room);
      detach(); socket.data = { code: room.code, host: true }; socket.join('host:' + room.code);
      reply(cb, { ok: true, code: room.code, hostKey: room.hostKey, game: def.key });
      room.sync();
    });
    socket.on('host:resume', (msg, cb) => {
      const room = find(msg.code);
      if (!room || room.hostKey !== msg.hostKey) return reply(cb, { ok: false });
      detach(); socket.data = { code: room.code, host: true }; socket.join('host:' + room.code);
      reply(cb, { ok: true, code: room.code, game: room.def.key }); room.sync();
    });
    socket.on('host:action', (msg, cb) => {
      const { room } = ctx();
      if (!room || !socket.data.host) return reply(cb, { ok: false, error: 'Only the big screen can do that.' });
      reply(cb, room.hostAction(msg));
    });

    socket.on('room:check', (msg, cb) => {
      const room = find(msg.code);
      reply(cb, room ? { ok: true, code: room.code, game: room.def.key, title: room.def.name } : { ok: false, error: 'Room not found. Check the code on the big screen.' });
    });
    socket.on('player:join', (msg, cb) => {
      const room = find(msg.code);
      if (!room) return reply(cb, { ok: false, error: 'Room not found. Check the code on the big screen.' });
      const r = room.join(msg.name, typeof msg.token === 'string' ? msg.token : null);
      if (!r.ok) return reply(cb, r);
      detach(); socket.data = { code: room.code, playerId: r.player.id }; socket.join('pl:' + room.code + ':' + r.player.id);
      r.player.sockets++;
      reply(cb, { ok: true, code: room.code, id: r.player.id, token: r.player.token, game: room.def.key, back: !!r.back });
      room.sync();
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
      reply(cb, room.vipAction(p, String(msg.type || '')));
    });
    socket.on('player:leave', (_m, cb) => { const { room, p } = ctx(); if (room && p) { detach(); room.remove(p.id); } reply(cb, { ok: true }); });
    socket.on('disconnect', () => { const { room, p } = ctx(); if (p) { p.sockets = Math.max(0, p.sockets - 1); room.sync(); } });
  });

  setInterval(() => {
    const cutoff = Date.now() - 6 * 60 * 60 * 1000;
    for (const [code, room] of rooms) if (room.lastActivity < cutoff) { room.destroy(); rooms.delete(code); }
  }, 10 * 60 * 1000).unref();

  return { has: (code) => rooms.has(String(code || '').toUpperCase()), rooms, GAMES };
}

module.exports = { installBox, GAMES };
