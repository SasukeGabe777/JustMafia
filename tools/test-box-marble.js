'use strict';
// JustMarble rules: mazes, hand-offs, holes, gems, bots and scoring.  node tools/test-box-marble.js
const assert = require('node:assert/strict');
const { VirtualClock } = require('../clock');
const { BoxRoom } = require('../box/room');
const def = require('../box/games/marble');
let passed = 0;
const test = (n, fn) => { fn(); passed++; console.log('  ✓ ' + n); };
const run = (clock, room, until = () => room.game.phase === 'over') => { let i = 0; while (!until() && clock.step()) if (++i > 200000) throw new Error('never ended'); };
function humans(n, bots = 0, settings = {}, seed = 1) {
  const clock = new VirtualClock(), room = new BoxRoom('TEST', def, { clock, seed });
  const ps = []; for (let i = 0; i < n; i++) { const p = room.join('P' + i).player; p.sockets = 1; ps.push(p); }
  room.addBots(bots); for (const [k, v] of Object.entries(settings)) room.settings[k] = v;
  assert(room.start().ok); return { clock, room, ps, g: room.game };
}
const N = 1, E = 2, S = 4, W = 8;

test('bots play a whole game; results() lists everyone best-first', () => {
  const clock = new VirtualClock(), room = new BoxRoom('TEST', def, { clock, seed: 1 });
  room.addBots(6); assert(room.start().ok);
  run(clock, room);
  const r = room.game.results(); assert.equal(r.length, 6);
  assert(room.game.cleared >= 1, 'bots clear mazes');
  const st = room.game.standings(); for (let i = 1; i < st.length; i++) assert(st[i - 1].points >= st[i].points);
});

test('the maze is one connected labyrinth with matching walls, across every board', () => {
  for (const n of [1, 2, 3, 4, 5, 7, 9, 12]) for (const size of ['small', 'medium', 'large']) {
    const { g } = humans(0, n, { size }, n * 7);
    const B = g.board, L = def.layout(n);
    assert.equal(B.rows, L.rows); assert.equal(B.cols, L.cols); assert(B.rows * B.cols >= n);
    for (let c = 0; c < B.cells.length; c++) {
      const x = c % B.gw, y = Math.floor(c / B.gw), t = B.tileOf(x, y);
      if (t >= n) { assert.equal(B.cells[c], -1, 'empty slots have no maze'); continue; }
      for (const [bit, dx, dy, back] of [[N, 0, -1, S], [E, 1, 0, W], [S, 0, 1, N], [W, -1, 0, E]]) {
        if (!(B.cells[c] & bit)) continue;
        const d = (y + dy) * B.gw + x + dx; assert(x + dx >= 0 && y + dy >= 0 && x + dx < B.gw && y + dy < B.gh, 'no gap in the outer wall');
        assert(B.cells[d] >= 0 && B.cells[d] & back, 'a gap is open from both sides');
      }
    }
    const dist = g.bfs(B.cells, B.gw, B.gh, B.start);
    for (let c = 0; c < B.cells.length; c++) if (B.cells[c] >= 0) assert(dist[c] >= 0, 'every cell can be reached');
    assert.equal(B.tileOf(B.start % B.gw, Math.floor(B.start / B.gw)), 0, 'the marble starts on the first board');
    if (n > 1) assert.notEqual(B.tileOf(B.finish % B.gw, Math.floor(B.finish / B.gw)), 0, 'the goal is on another board');
    assert.equal(B.path[0], B.start); assert.equal(B.path[B.path.length - 1], B.finish);
  }
});

test('more than 12 players: 12 boards, the rest spot (and swap in next round)', () => {
  const { clock, room, g } = humans(0, 15, { rounds: 3 });
  assert.equal(g.board.owners.length, 12); assert.equal(g.spotters.length, 3);
  const first = new Set(g.spotters);
  run(clock, room, () => g.round === 2 && g.phase === 'lineup');
  assert(g.spotters.every((id) => !first.has(id)), 'last round’s spotters get a board');
});

test('lineup: the round starts when every player on a board taps ready', () => {
  const { g, ps } = humans(3, 0);
  assert.equal(g.phase, 'lineup');
  g.act(ps[0], { op: 'ready' }); g.act(ps[1], { op: 'ready' }); assert.equal(g.phase, 'lineup');
  g.act(ps[2], { op: 'ready' }); assert.equal(g.phase, 'roll');
  assert.equal(g.marble.holder, g.board.owners[0]);
});

function rolling(n = 3, settings = {}, seed = 3) {
  const h = humans(n, 0, settings, seed); for (const p of h.ps) h.g.act(p, { op: 'ready' }); assert.equal(h.g.phase, 'roll'); return h;
}
const byId = (h, id) => h.ps.find((p) => p.id === id);
const local = (g, gx, gy) => { const o = g.tileOrigin(g.marble.tile); return { x: gx - o.x0, y: gy - o.y0 }; };

test('phone input is validated: only the holder, the right seq, real positions', () => {
  const h = rolling(); const { g } = h, holder = byId(h, g.marble.holder), other = h.ps.find((p) => p !== holder);
  const seq = g.marble.seq;
  for (const bad of [{ op: 'nope' }, {}, { op: 'mv', seq, x: 'a', y: 1 }, { op: 'mv', seq, x: 99, y: 1 }, { op: 'pass', seq, x: 1, y: 1, side: 'Q' }]) assert.equal(g.act(holder, bad).ok, false, JSON.stringify(bad));
  const before = { x: g.marble.x, y: g.marble.y };
  assert.equal(g.act(other, { op: 'mv', seq, x: 1, y: 1 }).stale, true, 'not your marble: ignored');
  assert.equal(g.act(holder, { op: 'mv', seq: seq + 5, x: 1, y: 1 }).stale, true, 'an old seq is ignored');
  assert.deepEqual({ x: g.marble.x, y: g.marble.y }, before);
  assert.equal(g.act(holder, { op: 'mv', seq, x: 1.5, y: 1.5 }).ok, true);
  assert.equal(g.act(holder, { op: 'finish', seq, x: 1.5, y: 1.5 }).ok, false, 'not at the goal');
  assert.equal(g.act(holder, { op: 'gem', seq, id: 9999, x: 1, y: 1 }).ok, false);
});

test('passing through a gap hands the marble to the neighbour; a wall refuses', () => {
  const h = rolling(3, {}, 5); const { g } = h, B = g.board;
  // Find a gap on the first board's edge into another board.
  let gap = null;
  for (let c = 0; c < B.cells.length && !gap; c++) {
    const x = c % B.gw, y = Math.floor(c / B.gw); if (B.tileOf(x, y) !== 0) continue;
    if (B.cells[c] & E && B.tileOf(x + 1, y) === 1) gap = { c, x, y };
  }
  assert(gap, 'boards 0 and 1 share a gap');
  const holder = byId(h, g.marble.holder), seq = g.marble.seq;
  // A wall: the same edge at a row with no gap (if any).
  const wallY = [...Array(B.ch).keys()].find((y) => !(B.cells[y * B.gw + B.cw - 1] & E));
  if (wallY != null) assert.equal(g.act(holder, { op: 'pass', seq, side: 'E', x: B.cw + 0.1, y: wallY + 0.5 }).ok, false);
  const l = local(g, B.cw + 0.1, gap.y + 0.5);
  const r = g.act(holder, { op: 'pass', seq, side: 'E', ...l, vx: 2, vy: 0 });
  assert.equal(r.ok, true);
  assert.equal(g.marble.holder, B.owners[1]); assert.equal(g.marble.seq, seq + 1); assert.equal(g.marble.tile, 1);
  const v = g.view(byId(h, B.owners[1])); assert(v.marble && v.holderIsMe, 'the neighbour’s phone gets the marble');
  assert(v.marble.x > 0 && v.marble.x < 1, 'it lands just inside their left edge');
  assert.equal(g.view(holder).marble, null, 'and it leaves the first phone');
});

test('holes cost points and send the marble back to where it came on', () => {
  const h = rolling(2, { holes: 'lots' }, 11);
  const { g } = h, B = g.board; g.mod = def.MODS[1];
  const hole = B.holes.find((o) => B.tileOf(o.c % B.gw, Math.floor(o.c / B.gw)) === g.marble.tile);
  if (!hole) return; // (no hole on the first board in this maze)
  const holder = byId(h, g.marble.holder); g.add(holder.id, 100);
  const entry = { ...g.marble.entry }, seq = g.marble.seq, l = local(g, hole.x, hole.y);
  g.act(holder, { op: 'mv', seq, ...l });
  assert.equal(g.act(holder, { op: 'hole', seq, id: hole.id, ...l }).ok, true);
  assert.equal(g.points.get(holder.id), 100 + def.PTS.hole); assert.equal(g.stat(holder.id).drops, 1);
  assert.equal(g.marble.x, entry.x); assert.equal(g.marble.seq, seq + 1);
});

test('gems: +25 once; reaching the goal clears the maze and scores the team', () => {
  const h = rolling(1, { holes: 'off' }, 2); const { g } = h, B = g.board, p = h.ps[0];
  const gem = B.gems[0]; let seq = g.marble.seq;
  assert.equal(g.act(p, { op: 'gem', seq, id: gem.id, x: gem.x, y: gem.y }).ok, true);
  assert.equal(g.points.get(p.id), def.PTS.gem);
  assert.equal(g.act(p, { op: 'gem', seq, id: gem.id, x: gem.x, y: gem.y }).ok, false, 'only once');
  const fx = (B.finish % B.gw) + 0.5, fy = Math.floor(B.finish / B.gw) + 0.5;
  assert.equal(g.act(p, { op: 'finish', seq, x: fx, y: fy }).ok, true);
  assert.equal(g.phase, 'result'); assert.equal(g.last.won, true); assert.equal(g.cleared, 1);
  assert(g.points.get(p.id) >= def.PTS.gem + def.PTS.clear + def.PTS.sink);
});

test('time runs out: points for how close the team got, then the next maze', () => {
  const h = rolling(2, { seconds: 90 }); const { g, clock, room } = h;
  run(clock, room, () => g.phase === 'result');
  assert.equal(g.last.won, false); run(clock, room, () => g.phase === 'lineup' || g.phase === 'over'); assert.equal(g.round, 2);
});

test('a player who drops out mid-roll: the marble rolls on by itself', () => {
  const h = rolling(2, { holes: 'off' }, 4); const { g, clock, room } = h;
  for (const p of h.ps) p.sockets = 0;
  run(clock, room, () => g.phase !== 'roll');
  assert.equal(g.last.won, true, 'it reached the goal');
});

test('views: each phone gets only its own piece; the TV hides walls until the reveal', () => {
  const h = rolling(4, {}, 6); const { g } = h;
  for (const p of h.ps) { const v = g.view(p); assert.equal(v.cells.length, g.board.cw * g.board.ch); assert(v.tile >= 0); }
  const tv = g.tv(); assert.equal(tv.board.reveal, false); assert.equal(tv.board.path, null); assert.equal(tv.board.holes, null);
  assert.equal(JSON.stringify(g.view(h.ps[0])).length < 4000, true);
});

console.log(`\n${passed} JustMarble tests passed.`);
