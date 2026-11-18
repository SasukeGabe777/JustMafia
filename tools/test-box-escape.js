'use strict';
// JustEscape rules: rooms, split evidence, every lock type, hints, the accusation, scoring.
//   node tools/test-box-escape.js
const assert = require('node:assert/strict');
const { VirtualClock } = require('../clock');
const { BoxRoom } = require('../box/room');
const def = require('../box/games/escape');
const { TRAITS } = require('../box/games/escape-rooms');
let passed = 0;
const test = (n, fn) => { fn(); passed++; console.log('  ✓ ' + n); };
const run = (c, room, until, max = 500000) => { let i = 0; while (!until() && c.step()) if (++i > max) throw new Error('never got there'); };
function setup(humans = 3, bots = 0, settings = {}, seed = 4) {
  const clock = new VirtualClock(), room = new BoxRoom('TEST', def, { clock, seed });
  const ps = []; for (let i = 0; i < humans; i++) { const p = room.join('P' + i).player; p.sockets = 1; ps.push(p); }
  room.addBots(bots); Object.assign(room.settings, settings);
  assert(room.start().ok);
  return { clock, room, ps, g: room.game };
}
const playing = (o) => { for (const p of o.ps) o.room.act(p, { op: 'ready' }); assert.equal(o.g.phase, 'play'); return o; };
const hands = (o, L) => o.ps.find((p) => p.id === o.g.handsOf(L));
// Solve a lock the honest way: work the answer out from the evidence the phones see.
function answerFrom(o, L) {
  const all = o.ps.flatMap((p) => o.g.view(p).cards.filter((c) => c.lock === L.id).concat(o.g.view(p).cards.filter((c) => c.lock === L.id).flatMap((c) => c.shared)));
  const part = (k) => all.filter((c) => c.part === k).map((c) => c.data);
  if (L.kind === 'cipher') { const map = new Map(part('legend').flatMap((d) => d.pairs)); return part('engraving')[0].seq.map((s) => map.get(s)).join(''); }
  if (L.kind === 'word') { const w = []; for (const d of part('tag')) for (const l of d.letters) w[l.pos - 1] = l.ch; return w.join(''); }
  if (L.kind === 'switches') {
    const panel = part('panel')[0].switches, pat = part('pattern')[0].rows, key = part('key')[0];
    const colourUp = new Map(pat.map((r) => [r.name || key.rows.find((k) => k.sym === r.sym).name, r.up]));
    return panel.map((s) => (colourUp.get(s.name) ? 1 : 0)).join('');
  }
  return null;
}

test('a whole case with bots: 1, 2 and 3 rooms; results() best-first', () => {
  for (const rooms of [1, 2, 3]) {
    const { clock, room, g } = setup(0, 5, { rooms, difficulty: 'climb' });
    run(clock, room, () => g.phase === 'over');
    assert.equal(g.history.length, rooms); assert.deepEqual(g.history.map((h) => h.diff), ['Easy', 'Medium', 'Hard'].slice(0, rooms));
    const r = g.results(); assert.equal(r.length, 5);
    const st = g.standings(); for (let i = 1; i < st.length; i++) assert(st[i - 1].points >= st[i].points);
  }
});

test('locks per difficulty, and every puzzle lock is split: the controls and the evidence go to different people', () => {
  for (const [d, n] of [['easy', 2], ['medium', 3], ['hard', 4]]) for (const players of [2, 3, 5, 8]) {
    const o = setup(players, 0, { difficulty: d }, players * 11);
    assert.equal(o.g.locks.length, n + 1, 'puzzle locks + the accusation');
    for (const L of o.g.locks.filter((x) => x.kind !== 'deduce')) {
      const h = o.g.handsOf(L); assert(h, 'someone has the controls');
      assert(L.roles.filter((r) => r.role === 'eyes').every((r) => r.id !== h), `${d}/${players}: ${L.kind} evidence is not on the controls phone`);
    }
    const holders = new Set(o.g.locks.flatMap((L) => L.roles.map((r) => r.id)));
    for (const p of o.ps) assert(holders.has(p.id), 'everyone has something to do');
  }
});

test('solo: one player holds everything and can still open every lock', () => {
  const o = playing(setup(1, 0, { difficulty: 'hard' }, 3));
  for (const L of o.g.locks) if (L.kind !== 'deduce') assert(L.roles.every((r) => r.id === o.ps[0].id));
});

test('cipher, word and switches open with the answer worked out from the phones; wrong answers cost a little', () => {
  for (const seed of [1, 2, 3, 4, 5]) for (const d of ['easy', 'hard']) {
    const o = playing(setup(4, 0, { difficulty: d, rooms: 3 }, seed));
    // The rooms have different lock kinds; walk through all three rooms by force-solving the others.
    for (let r = 0; r < 3 && o.g.phase !== 'over'; r++) {
      for (const L of o.g.locks.filter((x) => ['cipher', 'word', 'switches'].includes(x.kind))) {
        const h = hands(o, L), before = o.g.points.get(h.id) || 0;
        o.g.add(h.id, 50);
        const bad = L.kind === 'switches' ? L.answer.replace(/./, (c) => (c === '1' ? '0' : '1')) : L.kind === 'cipher' ? L.answer.replace(/./, (c) => String((Number(c) + 1) % 10)) : L.answer.slice(1) + L.answer[0];
        if (bad !== L.answer) { assert.equal(o.room.act(h, { op: 'answer', lock: L.id, value: bad }).right, false); assert.equal(o.g.points.get(h.id), before + 50 + def.PTS.wrong); }
        const a = answerFrom(o, L); assert.equal(a, L.answer, `${L.kind} can be worked out from the evidence`);
        assert.equal(o.room.act(h, { op: 'answer', lock: L.id, value: L.kind === 'word' ? a.toLowerCase() : a }).right, true);
        assert(L.solved);
      }
      for (const L of o.g.locks.filter((x) => x.kind !== 'deduce' && !x.solved)) o.g.solve(L, null);
      const F = o.g.final(); for (const p of o.ps) o.room.act(p, { op: 'vote', suspect: F.answer });
      assert.equal(o.g.phase, 'outro'); assert(o.g.outro.cleared);
      run(o.clock, o.room, () => o.g.phase === 'story' || o.g.phase === 'over'); if (o.g.phase === 'story') for (const p of o.ps) o.room.act(p, { op: 'ready' });
    }
  }
});

test('the clock: set the time from the photo (fixed by the note on medium/hard)', () => {
  for (const seed of [1, 2, 3, 4, 5, 6]) for (const d of ['easy', 'medium', 'hard']) {
    const o = playing(setup(3, 0, { difficulty: d, rooms: 3 }, seed));
    let L = null; for (let r = 0; r < 3 && !L; r++) { L = o.g.locks.find((x) => x.kind === 'dial'); if (!L) { o.g.next(); run(o.clock, o.room, () => o.g.phase !== 'outro'); if (o.g.phase === 'story') o.g.next(); } }
    if (!L || L.solved) continue;
    const photo = L.roles.find((r) => r.part === 'photo').data, note = L.roles.find((r) => r.part === 'note');
    let mins = (photo.h % 12) * 60 + photo.m;
    if (note) { const t = note.data.text, dh = Number(t.match(/is (\d) hour/)[1]), dm = Number((t.match(/and (\d+) minutes/) || [0, 0])[1]); mins += (/fast/.test(t) ? -1 : 1) * (dh * 60 + dm); mins = ((mins % 720) + 720) % 720; }
    const h = Math.floor(mins / 60) || 12, m = mins % 60;
    const who = hands(o, L);
    assert.equal(o.room.act(who, { op: 'answer', lock: L.id, value: { h: 13, m: 0 } }).ok, false);
    assert.equal(o.room.act(who, { op: 'answer', lock: L.id, value: { h, m: 7 } }).ok, false, 'five-minute steps');
    assert.equal(o.room.act(who, { op: 'answer', lock: L.id, value: { h, m } }).right, true, `${d}: ${note ? note.data.text : 'no note'} → ${h}:${m}`);
  }
});

test('the dark maze: the lantern moves step by step; walls bump (and send you back on hard)', () => {
  const o = playing(setup(2, 0, { difficulty: 'hard', rooms: 3 }, 8));
  o.g.next(); run(o.clock, o.room, () => o.g.phase === 'story'); o.g.next(); // the train has a maze
  const L = o.g.locks.find((x) => x.kind === 'maze'); assert(L);
  const M = L.maze, who = hands(o, L), other = o.ps.find((p) => p !== who);
  assert.equal(o.room.act(other, { op: 'move', lock: L.id, dir: 'right' }).ok, false, 'only the lantern holder moves');
  assert.equal(o.room.act(who, { op: 'move', lock: L.id, dir: 'sideways' }).ok, false);
  assert.equal(o.room.act(who, { op: 'move', lock: L.id, dir: 'up' }).bump, true, 'off the top edge is a bump');
  // Follow the map (as the map holder would say it).
  for (let i = 0; i < 200 && !L.solved; i++) {
    const d = o.g.mazeDist(M.walls, M.n, M.exit), x = M.pos % M.n, y = Math.floor(M.pos / M.n);
    const dir = Object.entries({ up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }).find(([, [dx, dy]]) => { const nx = x + dx, ny = y + dy; return nx >= 0 && ny >= 0 && nx < M.n && ny < M.n && !M.walls[ny * M.n + nx] && d[ny * M.n + nx] === d[M.pos] - 1; })[0];
    o.room.act(who, { op: 'move', lock: L.id, dir });
  }
  assert(L.solved, 'the exit opens the lock');
});

test('the accusation: the clues always point to exactly one suspect; a wrong pick costs a minute', () => {
  const fits = (s, text) => {
    const m = text.match(/^The culprit(?:’s coat)? (wore|did not wear|wore no hat|wore a hat|was not carrying|was carrying|was not|was) ?(.*)$/);
    if (/wore no hat/.test(text)) return s.hat === 'no hat'; if (/wore a hat$/.test(text)) return s.hat !== 'no hat';
    const [, verb, v] = m;
    if (/coat/.test(text)) return verb === 'was' ? s.coat === v : s.coat !== v;
    if (verb === 'wore') return s.hat === v; if (verb === 'did not wear') return s.hat !== v;
    if (verb === 'was carrying') return s.item === v; return s.item !== v;
  };
  for (let seed = 1; seed <= 40; seed++) for (const d of ['easy', 'medium', 'hard']) {
    const o = setup(4, 0, { difficulty: d }, seed), F = o.g.final();
    const clues = [...F.hold.values()].flat();
    assert(clues.length >= 4 || clues.length >= F.clues.length);
    const left = F.suspects.filter((s) => clues.every((c) => fits(s, c)));
    assert.equal(left.length, 1, `${d}/${seed}: ${clues.join(' | ')}`); assert.equal(left[0].id, F.answer);
    for (const s of F.suspects) for (const k of ['hat', 'coat', 'item']) assert(TRAITS[k].includes(s[k]));
  }
  const o = playing(setup(3, 0, {}, 5)), F = o.g.final();
  assert.equal(o.room.act(o.ps[0], { op: 'vote', suspect: F.answer }).ok, false, 'not before the locks are open');
  for (const L of o.g.locks.filter((x) => x.kind !== 'deduce')) o.g.solve(L, null);
  const wrong = F.suspects.find((s) => s.id !== F.answer), before = o.g.endsAt;
  for (const p of o.ps) o.room.act(p, { op: 'vote', suspect: wrong.id });
  assert.equal(o.g.phase, 'play'); assert.equal(before - o.g.endsAt, 60000); assert.equal(F.votes.size, 0, 'votes reset');
  assert.equal(o.room.act(o.ps[0], { op: 'vote', suspect: 999 }).ok, false);
  for (const p of o.ps) o.room.act(p, { op: 'vote', suspect: F.answer });
  assert.equal(o.g.phase, 'outro'); assert(o.g.outro.cleared);
});

test('hints: from Hazel, two per lock, cost the team; can be turned off', () => {
  const o = playing(setup(3, 0, {}, 6)), L = o.g.locks[0], holder = o.ps.find((p) => o.g.holders(L).includes(p.id));
  assert(o.room.act(holder, { op: 'hint', lock: L.id }).ok); assert(o.room.act(holder, { op: 'hint', lock: L.id }).ok);
  assert.equal(o.room.act(holder, { op: 'hint', lock: L.id }).ok, false); assert.equal(L.hintText.length, 2); assert.equal(o.g.hints, 2);
  const off = playing(setup(2, 0, { hints: 'off' }, 6));
  assert.equal(off.room.act(off.ps[0], { op: 'hint', lock: off.g.locks[0].id }).ok, false);
});

test('bots read their evidence out; a player who drops out is covered after a while', () => {
  const o = playing(setup(1, 3, { difficulty: 'medium' }, 9));
  const v = o.g.view(o.ps[0]);
  for (const c of v.cards) for (const s of c.shared) assert(s.from.bot && s.data, 'bot evidence is shown to the team');
  o.ps[0].sockets = 0;
  run(o.clock, o.room, () => o.g.phase !== 'play');
  assert.equal(o.g.phase, 'outro', 'the room still gets solved');
});

test('running out of time: Hazel finishes the room, the case goes on', () => {
  const o = playing(setup(2, 0, { rooms: 2 }, 3));
  run(o.clock, o.room, () => o.g.phase === 'outro');
  assert.equal(o.g.outro.cleared, false); assert.equal(o.g.history[0].stars, 0);
  run(o.clock, o.room, () => o.g.phase === 'story'); assert.equal(o.g.ri, 1);
});

test('views: each phone sees only its own evidence; input checks', () => {
  const o = playing(setup(3, 0, { difficulty: 'hard' }, 2));
  for (const p of o.ps) for (const c of o.g.view(p).cards) assert(o.g.lockById(c.lock).roles.some((r) => r.id === p.id && r.part === c.part));
  const L = o.g.locks.find((x) => x.kind === 'cipher') || o.g.locks[0], h = hands(o, L), other = o.ps.find((p) => p !== h);
  for (const bad of [{}, { op: 'nope' }, { op: 'answer', lock: 99, value: '1' }, { op: 'answer', lock: L.id, value: '1' }]) assert.equal(o.room.act(h, bad).ok, false);
  assert.equal(o.room.act(other, { op: 'answer', lock: L.id, value: L.answer }).ok, false, 'only the controls phone enters answers');
  assert(JSON.stringify(o.g.tv()).length < 30000);
  assert(!JSON.stringify(o.g.tv()).includes('"answer"'), 'the TV state never carries an answer while playing');
});

test('every line Hazel says is in the intro file’s story list (so it has a recorded voice clip)', () => {
  const fs = require('fs'), path = require('path'), vm = require('vm');
  const { ROOMS, LINES } = require('../box/games/escape-rooms');
  // Read the intro's `story: [ ... ]` array (plain strings) without running the drawing code.
  const src = fs.readFileSync(path.join(__dirname, '../public/box/intros/escape.js'), 'utf8'), at = src.indexOf('story: [');
  assert(at > 0, 'the intro has a story list');
  let depth = 0, end = at + 7; for (; end < src.length; end++) { if (src[end] === '[') depth++; if (src[end] === ']' && --depth === 0) break; }
  const story = new Set(vm.runInNewContext(src.slice(at + 7, end + 1)));
  for (const R of ROOMS) for (const k of ['intro', 'solved', 'failed', 'epilogue']) assert(story.has(R[k]), R.key + '.' + k);
  for (const t of Object.values(LINES)) assert(story.has(t), t);
});

console.log(`\n${passed} JustEscape tests passed.`);
