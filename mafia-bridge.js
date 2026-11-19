'use strict';
// JustMafia ⇄ JustGameBox. JustMafia has its own rooms, socket namespace and pages; this
// bridge moves a whole group between the two without anyone typing a code or a name:
//
//  - Mafia → box ("🎮 Play another game" on the Mafia TV): a box room is made for the
//    picked game, keeping the town's code (or, when this town came from a box room, that room
//    switches game; a linked town's TV shows the box room's code, see one-code.js), the TV
//    goes to the box TV and every phone to /box/play?room=CODE&name=NAME&auto=1.
//  - box → Mafia (JustMafia picked in a box room, or reached in a Party Mode lineup): a Mafia
//    room is made and linked to the box room (BoxRoom.goExternal). Its TV and phones follow
//    `away` in their box state to /mafia?resume=1 and /play?room=CODE&autojoin=1&name=NAME.
//  - Back: when a linked game ends, its finishing order (winners first) is kept. In Party
//    Mode the TV counts down and everyone returns by itself; otherwise the TV has a "Back to
//    the party" button. On return the box room gets the result (BoxRoom.externalResult:
//    party points by name) and the lineup carries on.
//
// Nothing here changes JustMafia's rules: a linked room only gets its sync() observed.
const RETURN_MS = 30000; // Party Mode: the "Back to the party" countdown after a Mafia game
const PENDING_MS = 30 * 60 * 1000; // phones that missed the move are sent on when they reconnect
const STANDALONE = ['ducks', 'kingdoms']; // big box games with their own address

const norm = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
const boxTvUrl = (game) => (STANDALONE.includes(game) ? `/${game}?resume=1` : `/box/tv?game=${encodeURIComponent(game)}&resume=1`);

function createBridge({ io, rooms, box, createMafiaRoom, returnMs = RETURN_MS }) {
  const links = new Map(); // mafia code → { box, over, results: [[names]], returnAt, timer }
  const pending = new Map(); // mafia code → { code (box room), at }

  const boxOf = (L) => (L ? box.get(L.box) : null);
  const inParty = (b) => !!(b && b.partyMode && b.partyMode.phase !== 'done');
  function info(room) {
    const L = links.get(room.code), b = boxOf(L);
    if (!L || !b) return null;
    return { box: b.code, party: inParty(b), game: b.def.key, over: !!L.over, results: L.results.length, returnAt: L.returnAt, now: Date.now() };
  }
  const tell = (room) => io.to(room.hostChannel()).emit('host:boxLink', info(room));

  // Finishing order for party points: winners first, then survivors, then everyone else.
  function finishOrder(room) {
    const ps = (typeof room.inGame === 'function' ? room.inGame() : room.list()).filter((p) => !p.isBot && !p.left);
    return ps.map((p, i) => ({ p, i })).sort((a, b) => (b.p.won ? 1 : 0) - (a.p.won ? 1 : 0) || (b.p.alive ? 1 : 0) - (a.p.alive ? 1 : 0) || a.i - b.i).map((x) => x.p.name);
  }
  // Mafia names → box player ids (same name, ignoring case; Mafia may have added " 2").
  function idsFor(b, names) {
    const people = b.list().filter((p) => !p.bot), used = new Set(), out = [];
    for (const n of names) {
      const k = norm(n), q = people.find((p) => !used.has(p.id) && norm(p.name) === k) || people.find((p) => !used.has(p.id) && k.replace(/ \d+$/, '') === norm(p.name));
      if (q) { used.add(q.id); out.push(q.id); }
    }
    return out;
  }

  // Watch a linked town for the end of its game (its own code is untouched).
  function watch(room) {
    if (room.__bridged) return;
    room.__bridged = true;
    const orig = room.sync.bind(room);
    room.sync = function () { orig(); try { check(room); } catch (e) { console.error('[bridge] check failed:', e); } };
  }
  function check(room) {
    const L = links.get(room.code); if (!L) return;
    if (room.phase === 'gameover' && room.winner) {
      if (L.over) return;
      L.over = true; L.results.push(finishOrder(room));
      if (inParty(boxOf(L))) { L.returnAt = Date.now() + returnMs; clearTimeout(L.timer); L.timer = setTimeout(() => back(room), returnMs); if (L.timer.unref) L.timer.unref(); }
      tell(room);
    } else if (L.over) {
      L.over = false; L.returnAt = null; clearTimeout(L.timer); tell(room);
    }
  }

  // Send the TV and every phone in this town to a box room.
  function move(room, b, hostKey) {
    const game = b.def.key;
    io.to(room.hostChannel()).emit('host:goto', { url: boxTvUrl(game), box: { code: b.code, hostKey, game } });
    for (const p of room.list()) {
      if (p.isBot || p.left) continue;
      io.to(room.playerChannel(p)).emit('mt:goto', { url: `/box/play?room=${encodeURIComponent(b.code)}&name=${encodeURIComponent(p.name)}&auto=1` });
    }
    pending.set(room.code, { code: b.code, at: Date.now() });
  }

  // Everyone back to the box room this town came from (with the results so far).
  function back(room, gameKey) {
    const L = links.get(room.code), b = boxOf(L);
    if (!L) return { ok: false, error: 'This town is not part of a party.' };
    clearTimeout(L.timer);
    if (!b) { links.delete(room.code); tell(room); return { ok: false, error: 'The party room has closed.' }; }
    for (const names of L.results) b.externalResult('mafia', 'JustMafia', idsFor(b, names));
    if (!L.results.length) b.externalBack();
    links.delete(room.code);
    if (gameKey) { const sw = b.switchGame(box.GAMES[gameKey]); if (!sw.ok) console.warn('[bridge] switch after Mafia failed:', sw.error); }
    move(room, b, b.hostKey);
    return { ok: true, code: b.code, hostKey: b.hostKey };
  }

  return {
    links,
    info,
    // The Mafia TV picked a box game.
    toBox(room, gameKey, unlocks) {
      if (!gameKey || !box.GAMES[gameKey]) return { ok: false, error: 'Unknown game.' };
      if (links.has(room.code)) return back(room, gameKey);
      // One code for the night: the new box room keeps this town's code (and its QR).
      const r = box.createRoom(gameKey, { unlocks, code: room.code });
      if (!r.ok) return r;
      move(room, r.room, r.hostKey);
      return { ok: true, code: r.code, hostKey: r.hostKey };
    },
    back: (room) => back(room),
    // The box room is wanted back (the title screen picked another game while the group is in
    // JustMafia): everyone returns with the results so far, unless a Mafia game is running.
    recall(b) {
      for (const [code, L] of links) {
        if (L.box !== b.code) continue;
        const room = rooms.get(code);
        if (!room) { links.delete(code); continue; }
        if (!['lobby', 'gameover'].includes(room.phase)) return { ok: false, error: 'A JustMafia game is running. Finish it first (or go back to its lobby).' };
        return back(room);
      }
      if (b.away) b.externalBack();
      return { ok: true, code: b.code, hostKey: b.hostKey };
    },
    // A box room hands over to JustMafia: a fresh town, linked to it.
    fromBox(b) {
      const room = createMafiaRoom();
      links.set(room.code, { box: b.code, over: false, results: [], returnAt: null, timer: null });
      watch(room);
      return { ok: true, code: room.code, hostKey: room.hostKey };
    },
    hostAttached(socket, room) { pending.delete(room.code); socket.emit('host:boxLink', info(room)); },
    // A phone that was offline during the move goes on when it reconnects.
    playerAttached(socket, room, p) {
      const P = pending.get(room.code);
      if (!P || Date.now() - P.at > PENDING_MS || !box.get(P.code)) return;
      socket.emit('mt:goto', { url: `/box/play?room=${encodeURIComponent(P.code)}&name=${encodeURIComponent(p.name)}&auto=1` });
    },
  };
}

module.exports = { createBridge, RETURN_MS };
