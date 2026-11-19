'use strict';
// One room code (and one QR) for the whole night.
//
// A group keeps the same code from game to game: box games switch inside their room, JustMafia
// is reached through the bridge (mafia-bridge.js) and its TV shows the box room's code. So
// every QR encodes one universal address, /j/CODE, and the server sends the phone to wherever
// that code's group is right now:
//   - a box room → its phone page (/box/play, or /ducks/play, /kingdoms/play for the big games).
//     While the group is away in JustMafia, the box phone page forwards the phone there
//     (joined with its name), so a late joiner lands in the Mafia game too.
//   - a JustMafia room → /play?room=CODE.
// /join?code=CODE (or ?room=) works the same way.
//
// The title screen (public/hub.js) uses the host API below: when this TV already has a live
// room, picking any game switches that room (same code, every phone follows) instead of making
// a new one. Both calls are authenticated with the room's host key (the TV's localStorage).
const express = require('express');
const { GAMES, EXTERNAL } = require('./box');

const STANDALONE = ['ducks', 'kingdoms']; // big box games with their own address
const clean = (c) => String(c || '').trim().toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
const defOf = (k) => (typeof k === 'string' ? (Object.prototype.hasOwnProperty.call(GAMES, k) ? GAMES[k] : Object.prototype.hasOwnProperty.call(EXTERNAL, k) ? EXTERNAL[k] : null) : null);
const boxPhone = (key, code) => (STANDALONE.includes(key) ? `/${key}/play?room=${code}` : `/box/play?room=${code}`);
const boxTv = (key) => (STANDALONE.includes(key) ? `/${key}?resume=1` : `/box/tv?game=${encodeURIComponent(key)}&resume=1`);
const MAFIA_TV = '/mafia?resume=1';
const isOpen = (phase) => phase === 'lobby' || phase === 'gameover';

function createOneCode({ box, rooms, bridge }) {
  const getBridge = typeof bridge === 'function' ? bridge : () => bridge;
  const mafiaRoom = (code) => rooms.get(clean(code)) || null;

  // Where is this code's group right now? (Public: no secrets.)
  function where(code) {
    code = clean(code);
    if (code.length !== 4) return null;
    const b = box.get(code);
    if (b) return { kind: 'box', code: b.code, game: b.def.key, title: b.def.name, phone: boxPhone(b.def.key, b.code), away: b.away ? { game: b.away.game, title: b.away.title, code: b.away.code } : null };
    const m = mafiaRoom(code);
    if (m) {
      const L = getBridge() && getBridge().links.get(m.code);
      return { kind: 'mafia', code: m.code, game: 'mafia', title: 'JustMafia', phone: `/play?room=${m.code}`, box: L && box.get(L.box) ? L.box : null };
    }
    return null;
  }
  // The phone page for a code (an unknown code opens the join form with it filled in).
  const phoneUrl = (code) => { const w = where(code); return w ? w.phone : `/box/play${clean(code) ? '?room=' + clean(code) : ''}`; };

  const humans = (list) => list.filter((p) => !p.bot && !p.isBot && !p.left);
  // The TV's live room, checked with its host key: { kind, code, game, title, players, online, tv, box?, mafia? }.
  function hostRoom({ box: bh, mafia: mh } = {}) {
    const b = bh && typeof bh === 'object' ? box.get(bh.code) : null;
    if (b && b.hostKey === bh.hostKey) {
      const ps = humans(b.list());
      const out = { ok: true, kind: 'box', code: b.code, game: b.def.key, title: b.def.name, players: ps.length, online: ps.filter((p) => p.sockets > 0).length, phase: b.phase, party: !!(b.partyMode && b.partyMode.phase !== 'done'), box: { code: b.code, hostKey: b.hostKey, game: b.def.key }, tv: boxTv(b.def.key) };
      if (b.away && b.away.hostKey && mafiaRoom(b.away.code)) {
        const m = mafiaRoom(b.away.code), mp = humans(m.list());
        Object.assign(out, { away: { game: b.away.game, title: b.away.title }, mafia: { code: m.code, hostKey: b.away.hostKey }, tv: MAFIA_TV, online: Math.max(out.online, mp.filter((p) => p.sockets > 0).length) });
      }
      return out;
    }
    const m = mh && typeof mh === 'object' ? mafiaRoom(mh.code) : null;
    if (m && m.hostKey === mh.hostKey) {
      const L = getBridge() && getBridge().links.get(m.code), lb = L && box.get(L.box);
      // A town that belongs to a box room is that room's (the TV has its box key too).
      if (lb && (!bh || bh.code !== lb.code)) return { ok: false, gone: !!bh };
      const ps = humans(m.list());
      return { ok: true, kind: 'mafia', code: m.code, game: 'mafia', title: 'JustMafia', players: ps.length, online: ps.filter((p) => p.sockets > 0).length, phase: m.phase, mafia: { code: m.code, hostKey: m.hostKey }, tv: MAFIA_TV };
    }
    return { ok: false, gone: !!(bh || mh) };
  }

  // Party Mode lineup (box games first; JustMafia comes later), like host:create.
  function lineupOf(party) {
    if (!party || !Array.isArray(party.games)) return null;
    let defs = party.games.slice(0, 20).map(defOf).filter(Boolean);
    defs = [...defs.filter((d) => !d.external), ...defs.filter((d) => d.external)];
    return defs;
  }

  // Switch the TV's live room to another game (or start a Party Mode in it). Everyone connected
  // follows; the code stays the same. → { ok, tv, box?, mafia? } for the TV to remember and open.
  function pick(msg = {}) {
    const unlocks = Array.isArray(msg.unlocks) ? msg.unlocks.slice(0, 40) : [];
    const lineup = lineupOf(msg.party);
    if (lineup && !lineup.length) return { ok: false, error: 'Pick some games.' };
    if (lineup && lineup[0].external) return { ok: false, error: 'Add at least one more game to the party.' };
    const def = lineup ? lineup[0] : defOf(msg.game);
    if (!def) return { ok: false, error: 'Unknown game.' };
    const live = hostRoom(msg);
    if (!live.ok) return { ok: false, gone: true, error: 'That room has closed. Start a new one.' };

    // A JustMafia town of its own (no box room yet): it becomes a box room with the SAME code.
    if (live.kind === 'mafia') {
      const m = mafiaRoom(live.code);
      if (def.external && !lineup) return { ok: true, tv: MAFIA_TV, mafia: live.mafia };
      if (!isOpen(m.phase)) return { ok: false, error: 'A JustMafia game is running. Finish it first (or go back to its lobby).' };
      const r = getBridge().toBox(m, def.key, unlocks);
      if (!r.ok) return r;
      const b = box.get(r.code);
      if (lineup) { const pr = startParty(b, lineup, msg.party); if (!pr.ok) return pr; if (pr.mafia) return pr; }
      return { ok: true, tv: boxTv(b.def.key), box: { code: b.code, hostKey: b.hostKey, game: b.def.key } };
    }

    const b = box.get(live.code);
    b.setUnlocks(unlocks);
    // The group is over in JustMafia right now.
    if (b.away) {
      if (def.external && !lineup) return { ok: true, tv: MAFIA_TV, mafia: live.mafia || null, box: live.box };
      const rc = getBridge().recall(b);
      if (!rc.ok) return rc;
    } else if (!lineup && def.key === b.def.key) {
      return { ok: true, tv: boxTv(b.def.key), box: live.box }; // already on it: just go back to the room
    }
    if (b.isLocked(def)) return { ok: false, error: `🔒 ${def.name} is locked. ${(def.locked && def.locked.how) || ''}`.trim(), locked: true };
    if (lineup) return startParty(b, lineup, msg.party);
    // A single game picked on the title screen ends any Party Mode lineup (the points stay).
    endParty(b);
    return switchTo(b, def);
  }
  function endParty(b) { if (b.partyMode) { b.cancel(b.partyMode.timer); b.partyMode = null; } }
  function switchTo(b, def) {
    // A game left running on the TV is stopped: the host picked another one.
    if (b.phase !== 'lobby' && !(b.game && b.game.phase === 'over')) b.hostAction({ type: 'lobby' });
    const sw = b.switchGame(def);
    if (!sw.ok) return sw;
    if (sw.external) return { ok: true, tv: MAFIA_TV, mafia: { code: b.away.code, hostKey: b.away.hostKey }, box: { code: b.code, hostKey: b.hostKey, game: b.def.key } };
    return { ok: true, tv: boxTv(def.key), box: { code: b.code, hostKey: b.hostKey, game: def.key } };
  }
  function startParty(b, lineup, party) {
    endParty(b);
    const sp = b.setParty(lineup, party && party.minutes, party && party.flow);
    if (!sp.ok) return sp;
    return switchTo(b, b.partyMode.defs[0]);
  }

  return { where, phoneUrl, hostRoom, pick };
}

// Routes: /j/CODE, /join?code=CODE, /api/where?code=, and the title screen's host calls.
function installOneCode(app, opts) {
  const one = createOneCode(opts);
  app.get(['/j', '/j/:code'], (req, res) => res.redirect(302, one.phoneUrl(req.params.code || req.query.code || req.query.room)));
  // /join with no code: the box join form, which takes any code (a JustMafia code goes on to /play).
  app.get('/join', (req, res) => res.redirect(302, one.phoneUrl(req.query.code || req.query.room)));
  app.get('/api/where', (req, res) => { const w = one.where(req.query.code); res.json(w ? { ok: true, ...w } : { ok: false, error: 'Room not found. Check the code on the big screen.' }); });
  const json = express.json({ limit: '16kb' });
  const body = (req) => (req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {});
  app.post('/api/host/room', json, (req, res) => { try { res.json(one.hostRoom(body(req))); } catch (e) { console.error('[one-code] room failed:', e); res.json({ ok: false }); } });
  app.post('/api/host/pick', json, (req, res) => { try { res.json(one.pick(body(req))); } catch (e) { console.error('[one-code] pick failed:', e); res.json({ ok: false, error: 'Something went wrong. Please try again.' }); } });
  return one;
}

module.exports = { createOneCode, installOneCode, boxPhone, boxTv };
