'use strict';
// Tune Buzz rules (key `tune`): played to the end by bots on a virtual clock.  node tools/test-box-tune.js
// No network: songs.js gets a fake fetch that fails the test if anything tries to go online.
const assert = require('node:assert/strict');
const { VirtualClock } = require('../clock');
const { BoxRoom } = require('../box/room');
const def = require('../box/games/tune');
const LIB = require('../box/songs');
LIB._setFetch(() => { throw new Error('tests must not touch the network'); });

let passed = 0;
const tests = [];
const test = (n, fn) => tests.push([n, fn]);
const run = (clock, room, until, max = 400000) => { let i = 0; while (!until() && clock.step()) if (++i > max) throw new Error('never got there'); };
const C = def.constants;
// Jump the virtual clock forward (a no-op timer marks the moment).
const adv = (s, ms) => { const t = s.room.now() + ms; s.room.after(ms, () => {}); run(s.clock, s.room, () => s.room.now() >= t); };

// Songs the phones "found" (as if a search had returned them).
const SONGS = [
  { id: 'it:1', title: 'Mr. Brightside', artist: 'The Killers', album: 'Hot Fuss', art: 'https://x/1.jpg', preview: 'https://audio/1.m4a', source: 'itunes' },
  { id: 'it:2', title: 'Uptown Funk (feat. Bruno Mars)', artist: 'Mark Ronson', album: 'Uptown Special', art: null, preview: 'https://audio/2.m4a', source: 'itunes' },
  { id: 'it:3', title: "Don't Stop Me Now - Remastered 2011", artist: 'Queen', album: 'Jazz', art: null, preview: 'https://audio/3.m4a', source: 'itunes' },
  { id: 'it:4', title: 'Toxic', artist: 'Britney Spears', album: 'In the Zone', art: null, preview: 'https://audio/4.m4a', explicit: false, source: 'itunes' },
  { id: 'it:5', title: 'WAP (feat. Megan Thee Stallion)', artist: 'Cardi B', album: '', art: null, preview: 'https://audio/5.m4a', explicit: true, source: 'itunes' },
  { id: 'sp:nopreview', title: 'Silent Song', artist: 'Nobody', album: '', art: null, preview: null, source: 'spotify' },
];
const fresh = () => { LIB._reset(); for (const s of SONGS) LIB.remember({ ...s }); };

// A room with real phones (Ana, Bo) and bots. Phones count as online.
function setup(opts = {}) {
  fresh();
  const clock = new VirtualClock(), room = new BoxRoom('TEST', def, { clock, seed: opts.seed || 7 });
  const ana = room.join('Ana').player; ana.sockets = 1;
  const bo = opts.bo === false ? null : room.join('Bo').player; if (bo) bo.sockets = 1;
  room.addBots(opts.bots == null ? 2 : opts.bots);
  Object.assign(room.settings, opts.settings || {});
  assert(room.start().ok);
  return { clock, room, ana, bo, g: room.game };
}
const toPhase = (s, ph) => run(s.clock, s.room, () => s.g.phase === ph);
// Skip bots and humans to a song submitted by `who` (the humans add their songs first).
function playOne(s, songsByAna = ['it:1'], songsByBo = ['it:4']) {
  for (const id of songsByAna) assert(s.room.act(s.ana, { op: 'add', id, start: 5 }).ok, 'add ' + id);
  if (s.bo) for (const id of songsByBo) assert(s.room.act(s.bo, { op: 'add', id, start: 3 }).ok, 'add ' + id);
}

test('fuzzy matching: case, punctuation, feat., brackets, "the", small typos', () => {
  const ok = (g, t, a = '') => assert(def.matchTitle(g, t, a), `"${g}" should match "${t}"`);
  const no = (g, t, a = '') => assert(!def.matchTitle(g, t, a), `"${g}" should NOT match "${t}"`);
  ok('mr brightside', 'Mr. Brightside'); ok('MR. BRIGHTSIDE!!', 'Mr. Brightside'); ok('mr brightsid', 'Mr. Brightside'); ok('brightside', 'Mr. Brightside');
  ok('uptown funk', 'Uptown Funk (feat. Bruno Mars)'); ok('uptown funk feat bruno mars', 'Uptown Funk (feat. Bruno Mars)');
  ok('dont stop me now', "Don't Stop Me Now - Remastered 2011"); ok('Don’t stop me now', "Don't Stop Me Now - Remastered 2011");
  ok('i cant get no satisfaction', "(I Can't Get No) Satisfaction"); ok('satisfaction', "(I Can't Get No) Satisfaction");
  ok('beatles hey jude', 'Hey Jude', 'The Beatles'); ok('hey jude by the beatles', 'Hey Jude', 'The Beatles'); ok('the beatles - hey jude', 'Hey Jude', 'The Beatles');
  ok('Beyonce crazy in love', 'Crazy in Love (feat. Jay-Z)', 'Beyoncé'); ok('rock and roll', 'Rock & Roll'); ok('Sigur Ros', 'Sigur Rós');
  ok('the scientist', 'The Scientist'); ok('scientist', 'The Scientist');
  no('tox', 'Toxic'); no('hi', 'Hey'); no('mr', 'Mr. Brightside'); no('uptown', 'Uptown Funk'); no('stop', "Don't Stop Me Now");
  no('the killers', 'Mr. Brightside', 'The Killers'); no('', 'Toxic');
  assert(def.matchArtist('the killers', 'The Killers') && def.matchArtist('killers', 'The Killers') && def.matchArtist('brittney spears', 'Britney Spears'));
  assert(def.matchArtist('mark ronson', 'Mark Ronson, Bruno Mars') && def.matchArtist('toxic by britney spears', 'Britney Spears'));
  assert(!def.matchArtist('queen', 'The Killers') && !def.matchArtist('a', 'a-ha'));
});

test('bots play a whole game; results() lists everyone best-first', () => {
  fresh();
  const clock = new VirtualClock(), room = new BoxRoom('TEST', def, { clock, seed: 1 });
  room.addBots(5); assert(room.start().ok);
  const g = room.game;
  assert.equal(g.phase, 'submit');
  assert.deepEqual(g.results(), [], 'no results before the end');
  run(clock, room, () => g.phase === 'over');
  assert.equal(g.history.length, 10, '5 bots × 2 songs');
  const res = g.results(), st = g.standings();
  assert.equal(res.length, 5);
  assert.deepEqual(res, st.map((r) => r.id));
  for (let i = 1; i < st.length; i++) assert(st[i - 1].points >= st[i].points);
  assert(st[0].points > 0, 'somebody scored');
  assert(g.final.awards.ear, 'awards are given');
  assert(g.highlights().length >= 1);
});

test('a whole game with 4 players takes roughly 4 to 10 minutes', () => {
  for (const time of [20, 45]) {
    fresh();
    const clock = new VirtualClock(), room = new BoxRoom('TEST', def, { clock, seed: 3 });
    room.addBots(4); room.settings.time = time; assert(room.start().ok);
    const t0 = clock.now();
    run(clock, room, () => room.game.phase === 'over');
    const min = (clock.now() - t0) / 60000;
    assert(min > 2.5 && min < 11, `${time}s guesses took ${min.toFixed(1)} min`);
  }
});

test('submitting: validated ids, quota, start point, duplicates, family filter, removing', () => {
  const s = setup({ settings: { songs: 1, clip: 4 } }), { room, ana, bo, g } = s;
  const bad = [{ op: 'add' }, { op: 'add', id: 3, start: 1 }, { op: 'add', id: 'it:999', start: 1 }, { op: 'add', id: 'x'.repeat(65), start: 1 },
    { op: 'add', id: 'sp:nopreview', start: 1 }, { op: 'add', id: 'it:1', start: -1 }, { op: 'add', id: 'it:1', start: 27 }, { op: 'add', id: 'it:1', start: 'soon' }, { op: 'add', id: 'it:1' }];
  for (const m of bad) assert.equal(room.act(ana, m).ok, false, JSON.stringify(m));
  assert(room.act(ana, { op: 'add', id: 'it:1', start: 26 }).ok, 'start up to 30 - clip');
  assert.equal(room.act(ana, { op: 'add', id: 'it:2', start: 1 }).ok, false, 'quota of 1');
  assert.equal(room.act(bo, { op: 'add', id: 'it:1', start: 1 }).ok, false, 'someone already added it');
  room.filterOn = true;
  assert.equal(room.act(bo, { op: 'add', id: 'it:5', start: 1 }).ok, false, 'explicit songs are refused with the filter on');
  room.filterOn = false;
  const key = g.mine(ana.id)[0].key;
  assert.equal(room.act(bo, { op: 'remove', key }).ok, false, 'only your own songs');
  assert(room.act(ana, { op: 'remove', key }).ok);
  assert.equal(g.mine(ana.id).length, 0);
  assert(room.act(ana, { op: 'add', id: 'it:2', start: 0 }).ok);
  assert.equal(room.act(ana, { op: 'guess', text: 'x' }).ok, false, 'no guessing while songs come in');
  // The phone sees its own songs; the TV only counts.
  assert.equal(g.view(ana).mine[0].title, 'Uptown Funk (feat. Bruno Mars)');
  assert(!JSON.stringify(g.tv()).includes('Uptown'));
});

test('everyone in: the music starts; the host can skip the wait; nobody added anything ends it', () => {
  const s = setup({ settings: { songs: 1 } });
  playOne(s);
  run(s.clock, s.room, () => s.g.phase !== 'submit');
  assert.equal(s.g.phase, 'card');
  assert.equal(s.g.list.length, 4);
  const t = setup({ settings: { songs: 2 } });
  assert(t.room.act(t.ana, { op: 'add', id: 'it:1', start: 1 }).ok);
  t.g.next();
  assert.equal(t.g.phase, 'card', 'the host started with what we have');
  fresh();
  const clock = new VirtualClock(), room = new BoxRoom('TEST', def, { clock, seed: 2 });
  const a = room.join('A').player, b = room.join('B').player; a.sockets = 1; b.sockets = 1;
  assert(room.start().ok); room.game.next(); assert.equal(room.game.phase, 'submit', 'nothing to play yet');
  run(clock, room, () => room.game.phase === 'over');
  assert(room.game.final.empty);
});

test('the playlist takes turns between players and stops at 16 songs', () => {
  fresh();
  const clock = new VirtualClock(), room = new BoxRoom('TEST', def, { clock, seed: 5 });
  room.addBots(10); room.settings.songs = 3; assert(room.start().ok);
  run(clock, room, () => room.game.phase !== 'submit');
  const L = room.game.list;
  assert.equal(L.length, C.MAX_SONGS);
  const firsts = L.slice(0, 10).map((e) => e.by);
  assert.equal(new Set(firsts).size, 10, 'everyone gets a song in before anyone gets a second');
});

test('guessing: the submitter sits out, speed sets the points, 6 tries, artist bonus, too-long text', () => {
  const s = setup({ bots: 0, settings: { songs: 1, time: 30 } }), { room, ana, bo, g } = s;
  playOne(s);
  toPhase(s, 'card');
  const e = g.cur.e, me = e.by === ana.id ? ana : bo, other = me === ana ? bo : ana;
  assert.equal(room.act(other, { op: 'guess', text: e.song.title }).ok, false, 'not during the title card');
  toPhase(s, 'guess');
  assert.equal(room.act(me, { op: 'guess', text: e.song.title }).ok, false, 'no guessing your own song');
  assert.equal(room.act(other, { op: 'guess', text: 'x'.repeat(C.MAX_GUESS + 1) }).ok, false, 'too long');
  assert.equal(room.act(other, { op: 'guess', text: '   ' }).ok, false, 'empty');
  assert.equal(room.act(other, { op: 'guess', text: 42 }).ok, false, 'not text');
  // The phone never sees the answer while guessing; the TV gets what to play.
  const v = JSON.stringify(g.view(other));
  assert(!v.includes(e.song.title) && !v.includes(e.song.preview) && !v.includes(e.song.artist));
  assert(JSON.stringify(g.view(me)).includes(e.song.title), 'the submitter sees their own song');
  const tv = g.tv(); assert.equal(tv.clipInfo.play.preview, e.song.preview); assert.equal(tv.clipInfo.listens.length, 3);
  assert(!JSON.stringify(tv).includes(e.song.title), 'the TV doesn’t show the title yet');
  const ls = tv.clipInfo.listens; assert(ls[1].len > ls[0].len && ls[1].atIn > ls[0].atIn, 'each listen is longer');
  // a wrong guess, then the artist (+50), then the title
  adv(s, 5000);
  let r = room.act(other, { op: 'guess', text: 'definitely not it' }); assert(r.ok && r.right === false);
  adv(s, 1000);
  r = room.act(other, { op: 'guess', text: e.song.artist }); assert(r.ok && r.artist === true && r.right === false);
  assert.equal(g.points.get(other.id), C.ARTIST_BONUS);
  adv(s, 1000);
  const worth = g.worth();
  r = room.act(other, { op: 'guess', text: e.song.title.toLowerCase() });
  assert(r.ok && r.right, 'right title');
  assert.equal(r.base, worth); assert(worth < C.TOP && worth > C.BOTTOM, 'faster = more points: ' + worth);
  assert.equal(room.act(other, { op: 'guess', text: e.song.title }).ok, false, 'already got it');
  assert.equal(g.phase, 'reveal', 'everyone who could guess got it: straight to the reveal');
  // Out of tries: a fresh song
  const t = setup({ bots: 0, settings: { songs: 1 } }); playOne(t); toPhase(t, 'guess');
  const g2 = t.g, o2 = g2.cur.e.by === t.ana.id ? t.bo : t.ana;
  for (let i = 0; i < C.MAX_TRIES; i++) { adv(t, 500); assert(t.room.act(o2, { op: 'guess', text: 'nope ' + i }).ok); }
  assert.equal(g2.phase, 'reveal', 'out of tries ends it for them');
});

test('rating: not your own song, 1 to 5 only; difficulty multiplies guessers; sweet spot pays the submitter', () => {
  // Ana, Bo and Cy: Ana's song, Bo gets it, Cy doesn't (the sweet spot).
  fresh();
  const clock = new VirtualClock(), room = new BoxRoom('TEST', def, { clock, seed: 9 });
  const [ana, bo, cy] = ['Ana', 'Bo', 'Cy'].map((n) => { const p = room.join(n).player; p.sockets = 1; return p; });
  room.settings.songs = 1; assert(room.start().ok);
  const g = room.game;
  assert(room.act(ana, { op: 'add', id: 'it:1', start: 4 }).ok);
  assert(room.act(bo, { op: 'add', id: 'it:2', start: 4 }).ok);
  assert(room.act(cy, { op: 'add', id: 'it:3', start: 4 }).ok);
  // Find Ana's song.
  run(clock, room, () => g.phase === 'guess' && g.cur.e.by === ana.id, 400000);
  assert.equal(room.act(ana, { op: 'rate', n: 3 }).ok, false, 'no rating while guessing');
  const before = { ana: g.points.get(ana.id), bo: g.points.get(bo.id), cy: g.points.get(cy.id) };
  const r = room.act(bo, { op: 'guess', text: 'mr brightside' }); assert(r.ok && r.right);
  for (let i = 0; i < C.MAX_TRIES; i++) { adv({ clock, room }, 500); room.act(cy, { op: 'guess', text: 'pass ' + i }); }
  assert.equal(g.phase, 'reveal');
  for (const bad of [0, 6, 2.5, '4', null]) assert.equal(room.act(bo, { op: 'rate', n: bad }).ok, false, 'rating ' + bad);
  assert.equal(room.act(ana, { op: 'rate', n: 1 }).ok, false, 'can’t rate your own song');
  assert(room.act(bo, { op: 'rate', n: 4 }).ok);
  assert(room.act(cy, { op: 'rate', n: 5 }).ok);
  assert.equal(g.phase, 'reveal', 'the reveal gets its moment');
  run(clock, room, () => g.phase === 'score');
  const res = g.cur.result;
  assert.equal(res.d, 4.5); assert.equal(res.auto, false);
  assert.equal(g.points.get(bo.id) - before.bo, Math.round((r.base * 4.5) / 10) * 10, 'speed points × difficulty');
  assert.equal(g.points.get(cy.id), before.cy);
  assert.equal(res.dj.kind, 'sweet');
  assert.equal(g.points.get(ana.id) - before.ana, Math.round((C.SWEET * 4.5) / 10) * 10, 'sweet spot × difficulty');
  // The submitter's verdicts.
  assert.deepEqual([g.verdict(0, 3).kind, g.verdict(3, 3).kind, g.verdict(2, 3).kind, g.verdict(1, 1).kind], ['nobody', 'easy', 'sweet', 'sweet']);
});

test('nobody rates: the difficulty follows how many got it', () => {
  const s = setup({ bots: 0, settings: { songs: 1 } }); playOne(s); toPhase(s, 'guess');
  const g = s.g, o = g.cur.e.by === s.ana.id ? s.bo : s.ana;
  run(s.clock, s.room, () => g.phase === 'score');
  assert.equal(g.cur.result.auto, true); assert.equal(g.cur.result.d, 5, 'nobody got it: as hard as it gets');
  assert.equal(g.cur.result.dj.pts, 0, 'nobody got it: no points for the submitter');
  void o;
});

test('async search goes through songs.js and never reaches the network in tests', async () => {
  const s = setup({ settings: { songs: 1 } });
  const r = await s.g.actAsync(s.ana, { op: 'pick', id: 'it:1' });
  assert(r.ok && r.song.preview && r.song.title === 'Mr. Brightside');
  const bad = await s.g.actAsync(s.ana, { op: 'pick', id: 'nope' }); assert.equal(bad.ok, false);
  const nop = await s.g.actAsync(s.ana, { op: 'search', q: 'a' }); assert.equal(nop.ok, false, 'too short');
  const long = await s.g.actAsync(s.ana, { op: 'search', q: 'x'.repeat(81) }); assert.equal(long.ok, false, 'too long');
  const link = await s.g.actAsync(s.ana, { op: 'search', q: 'https://example.com/song' }); assert.equal(link.ok, false, 'only Spotify / Apple Music links');
  assert.deepEqual(LIB.parseLink('https://open.spotify.com/intl-de/track/3n3Ppam7vgaVa1iaRUc9Lp?si=abc'), { kind: 'spotify', id: '3n3Ppam7vgaVa1iaRUc9Lp' });
  assert.deepEqual(LIB.parseLink('spotify:track:3n3Ppam7vgaVa1iaRUc9Lp'), { kind: 'spotify', id: '3n3Ppam7vgaVa1iaRUc9Lp' });
  assert.equal(LIB.parseLink('https://evil.example/open.spotify.com/track/3n3Ppam7vgaVa1iaRUc9Lp'), null);
});

test('songs.js: search, link and preview matching with a fake network (results cached, previews required)', async () => {
  LIB._reset();
  const calls = [];
  LIB._setFetch(async (url) => {
    calls.push(url);
    if (url.startsWith('https://itunes.apple.com/search')) return { ok: true, json: async () => ({ results: [
      { trackId: 11, trackName: 'Mr. Brightside', artistName: 'The Killers', collectionName: 'Hot Fuss', artworkUrl100: 'https://img/100x100bb.jpg', previewUrl: 'https://audio/11.m4a' },
      { trackId: 12, trackName: 'No Preview', artistName: 'X', previewUrl: null },
    ] }) };
    if (url.startsWith('https://open.spotify.com/oembed')) return { ok: true, json: async () => ({ title: 'Mr. Brightside' }) };
    return { ok: false };
  });
  const r = await LIB.search('brightside');
  assert(r.ok && r.results.length === 1 && r.results[0].id === 'it:11' && r.results[0].art.includes('300x300bb'));
  const n = calls.length; await LIB.search('Brightside'); assert.equal(calls.length, n, 'cached');
  const l = await LIB.fromLink('https://open.spotify.com/track/3n3Ppam7vgaVa1iaRUc9Lp');
  assert(l.ok && l.results[0].title === 'Mr. Brightside');
  assert(calls.every((u) => !/Ana|Bo\b/.test(u)), 'nothing about players is sent');
  const m = await LIB.resolveMeta('Mr. Brightside', 'The Killers'); assert(m && m.preview);
  LIB._setFetch(() => { throw new Error('tests must not touch the network'); });
  const fail = await LIB.search('something else'); assert.equal(fail.ok, false, 'a failing network is a polite error');
});

test('late joiners and leavers do not break a round', () => {
  const s = setup({ settings: { songs: 1 } }); playOne(s);
  toPhase(s, 'guess');
  const cy = s.room.join('Cy').player; cy.sockets = 1;
  assert(s.room.act(cy, { op: 'guess', text: 'something' }).ok, 'a late joiner can guess');
  s.room.remove(cy.id);
  s.room.remove(s.bo.id);
  run(s.clock, s.room, () => s.g.phase === 'over');
  assert(!s.g.results().includes(s.bo.id), 'the leaver drops off the results');
  assert(s.g.results().includes(s.ana.id));
});

(async () => {
  for (const [n, fn] of tests) { await fn(); passed++; console.log('  ✓ ' + n); }
  console.log(`\n${passed} Tune Buzz tests passed.`);
})().catch((e) => { console.error(e); process.exit(1); });
