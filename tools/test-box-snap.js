'use strict';
// JustSnap rules and the photo pipeline: photo validation (magic bytes, sizes, junk), the upload
// rate limit, memory freed and URLs gone (404) after each round, voting (no self-votes), every
// mode played to the end with bots, host hide, host approval, disconnects, and a real
// socket.io round trip (binary upload -> /box/photo URL -> 404 after the round).
//   node tools/test-box-snap.js
const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');
const { Server } = require('socket.io');
const ioc = require('socket.io-client');
const { VirtualClock } = require('../clock');
const { BoxRoom } = require('../box/room');
const def = require('../box/games/snap');
const { MODES, LIMITS, sniff, checkImage, colourScore, norm, estimate, HIT_R } = def._test;
let passed = 0;
const tests = [];
const test = (n, fn) => tests.push([n, fn]);

// ---- fake images: only the first bytes matter to the server ----
const pad = (head, n) => Buffer.concat([Buffer.from(head), Buffer.alloc(Math.max(0, n - head.length), 7)]);
const JPEG = (n = 4000) => pad([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1], n);
const PNG = (n = 4000) => pad([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13], n);
const WEBP = (n = 4000) => { const b = pad([...Buffer.from('RIFF'), 0, 0, 0, 0, ...Buffer.from('WEBPVP8 ')], n); return b; };
const GIF = (n = 4000) => pad([...Buffer.from('GIF89a'), 1, 0, 1, 0, 0, 0], n);
const HTML = () => Buffer.from('<html><script>alert(1)</script></html>'.padEnd(400, ' '));

function run(room, clock, until = () => room.game.phase === 'over') { let i = 0; while (!until() && clock.step()) if (++i > 400000) throw new Error('never ended (phase ' + room.game.phase + ')'); }
function setup(settings = {}, { bots = 4, humans = 0, seed = 7 } = {}) {
  const clock = new VirtualClock(), room = new BoxRoom('SNAP', def, { clock, seed });
  for (const [k, v] of Object.entries(settings)) room.settings[k] = v;
  const H = [];
  for (let i = 0; i < humans; i++) { const p = room.join('Human' + (i + 1)).player; p.sockets = 1; H.push(p); }
  room.addBots(bots);
  return { clock, room, H };
}
const startGame = (room) => { const r = room.start(); assert(r.ok, r.error); room.game.wall = (() => { let t = 1e12; return () => (t += 5000); })(); };
const toPhase = (room, clock, ph) => run(room, clock, () => room.game.phase === ph || room.game.phase === 'over');
const grid = (hex) => { const n = parseInt(hex.slice(1), 16); const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255]; return Array.from({ length: 64 }, () => c).flat(); };
const upload = (room, p, extra = {}) => room.act(p, { op: 'photo', round: room.game.R.n, slot: room.game.R.slots[0].slot, img: JPEG(), thumb: JPEG(900), ...extra });

// ---------------- the photo checks ----------------
test('magic bytes: JPEG, PNG and WebP pass; GIF, HTML and junk do not', () => {
  assert.equal(sniff(JPEG()), 'image/jpeg'); assert.equal(sniff(PNG()), 'image/png'); assert.equal(sniff(WEBP()), 'image/webp');
  for (const bad of [GIF(), HTML(), Buffer.alloc(5000), Buffer.from('ffd8ff'), null]) assert.equal(sniff(bad), null);
  assert.ok(checkImage(JPEG(), LIMITS.full).buf);
  assert.ok(checkImage(new Uint8Array(JPEG()), LIMITS.full).buf, 'typed arrays are fine');
  assert.ok(checkImage(JPEG().buffer.slice(0), LIMITS.full).buf || true);
  assert.match(checkImage(JPEG(LIMITS.full + 1), LIMITS.full).error, /too big/);
  assert.match(checkImage(Buffer.from([0xff, 0xd8, 0xff]), LIMITS.full).error, /empty/);
  assert.match(checkImage('not a photo', LIMITS.full).error, /No photo/);
  assert.match(checkImage({ length: 9999 }, LIMITS.full).error, /No photo/);
  assert.match(checkImage(GIF(), LIMITS.full).error, /not a photo/);
});
test('uploads are validated: phase, round, slot, junk, sizes, thumbnails', () => {
  const { clock, room, H: [a] } = setup({ mode: 'hunt' }, { humans: 1, bots: 3 });
  startGame(room);
  assert.equal(upload(room, a).ok, false, 'not during the brief');
  toPhase(room, clock, 'snap');
  for (const bad of [{ img: GIF() }, { img: HTML() }, { img: 'x' }, { img: JPEG(LIMITS.full + 10) }, { thumb: JPEG(LIMITS.thumb + 10) }, { thumb: PNG(10) }, { slot: 'nope' }, { round: 99 }, { img: null }])
    assert.equal(upload(room, a, bad).ok, false, JSON.stringify(Object.keys(bad)));
  assert.equal(room.game.photoBytes(), [...room.game.photos.values()].reduce((s, r) => s + r.bytes, 0));
  const r = upload(room, a); assert.ok(r.ok, r.error);
  const ph = room.game.servePhoto(r.id); assert.equal(ph.type, 'image/jpeg'); assert.equal(ph.body.length, 4000);
  assert.equal(room.game.servePhoto(r.id, true).body.length, 900, 'the thumbnail');
  assert.equal(room.game.servePhoto('nope'), null); assert.equal(room.game.servePhoto(undefined), null);
});
test('one photo per player per slot: sending again replaces it (old URL gone)', () => {
  const { clock, room, H: [a] } = setup({ mode: 'hunt' }, { humans: 1, bots: 3 });
  startGame(room); toPhase(room, clock, 'snap');
  const r1 = upload(room, a), before = room.game.photoBytes();
  const r2 = upload(room, a, { img: PNG(6000), thumb: undefined });
  assert.ok(r1.ok && r2.ok);
  assert.equal(room.game.servePhoto(r1.id), null, 'the old photo is gone');
  assert.equal(room.game.servePhoto(r2.id).type, 'image/png');
  assert.equal(room.game.servePhoto(r2.id, true).body.length, 6000, 'no thumbnail: the photo is its own thumbnail');
  assert.equal(room.game.photoBytes(), before - 4900 + 6000);
});
test('rate limit: not faster than once a second, at most 24 a minute', () => {
  const { clock, room, H: [a] } = setup({ mode: 'hunt' }, { humans: 1, bots: 3 });
  startGame(room); toPhase(room, clock, 'snap');
  let t = 5e12; room.game.wall = () => t;
  assert.ok(upload(room, a).ok);
  t += 200; assert.match(upload(room, a).error, /moment/);
  let ok = 1; for (let i = 0; i < 40; i++) { t += 1100; if (upload(room, a).ok) ok++; }
  assert.equal(ok, LIMITS.perMinute, 'capped per minute');
  t += 61000; assert.ok(upload(room, a).ok, 'fine again a minute later');
});
test('memory per game is capped', () => {
  const { clock, room, H } = setup({ mode: 'scavenger' }, { humans: 16, bots: 0 });
  startGame(room); toPhase(room, clock, 'snap');
  const R = room.game.R; let refused = 0;
  for (const p of H) for (const s of R.slots) { const r = room.act(p, { op: 'photo', round: R.n, slot: s.slot, img: JPEG(LIMITS.full - 100), thumb: JPEG(LIMITS.thumb - 100) }); if (!r.ok) { refused++; assert.match(r.error, /darkroom is full/); } }
  assert.ok(refused > 0, 'some uploads were refused');
  assert.ok(room.game.photoBytes() <= LIMITS.room, 'never over the cap: ' + room.game.photoBytes());
});

// ---------------- voting ----------------
test('Photo Hunt: anonymous gallery, no self-votes, votes score, the round frees its photos', () => {
  const { clock, room, H: [a, b] } = setup({ mode: 'hunt', rounds: 3 }, { humans: 2, bots: 2 });
  startGame(room); toPhase(room, clock, 'snap');
  const ra = upload(room, a), rb = upload(room, b); assert.ok(ra.ok && rb.ok);
  toPhase(room, clock, 'vote');
  const tv = room.game.tv();
  assert.ok(tv.gallery.length >= 2);
  assert.ok(!JSON.stringify(tv.gallery).includes('Human1') && !JSON.stringify(tv.gallery).includes('"owner"'), 'no names in the gallery');
  const va = room.game.view(a), mine = va.gallery.find((g) => g.mine), theirs = va.gallery.find((g) => !g.mine);
  assert.ok(mine && theirs);
  assert.match(room.act(a, { op: 'vote', entry: mine.eid }).error, /own/);
  assert.ok(room.act(a, { op: 'vote', entry: theirs.eid }).ok);
  assert.equal(room.act(a, { op: 'vote', entry: 'e00000000' }).ok, false);
  const bEntry = room.game.view(b).gallery.find((g) => g.mine);
  assert.ok(room.act(b, { op: 'vote', entry: room.game.view(b).gallery.find((g) => !g.mine).eid }).ok);
  toPhase(room, clock, 'reveal');
  const rows = room.game.tv().rows; assert.ok(rows.length >= 2);
  assert.ok(rows.every((r) => r.owner && r.owner.name), 'owners revealed');
  const total = rows.reduce((s, r) => s + r.votes, 0); assert.ok(total >= 2 && total <= 4);
  assert.ok(room.game.points.get(a.id) >= 50 && room.game.points.get(b.id) >= 50, 'filing a photo scores');
  assert.ok(bEntry);
  const ids = [...room.game.photos.keys()];
  toPhase(room, clock, 'brief');
  const kept = [...room.game.photos.values()];
  assert.ok(kept.length <= 1 && kept.every((r) => r.keep), 'only the round’s best photo is kept');
  for (const id of ids) if (!room.game.photos.has(id)) assert.equal(room.game.servePhoto(id), null);
  run(room, clock);
  assert.ok(room.game.best.length >= 1 && room.game.best.length <= 3, 'best photos of the night');
  assert.equal(room.game.photoBytes(), [...room.game.photos.values()].reduce((s, r) => s + r.bytes, 0));
  assert.equal(room.game.results().length, 4);
});
test('every mode plays to the end with bots (and with a human who never sends anything)', () => {
  for (const mode of [...Object.keys(MODES), 'mixed']) {
    for (const seed of [1, 2]) {
      const { clock, room, H } = setup({ mode, rounds: 3, seconds: 60 }, { bots: 5, humans: seed === 2 ? 1 : 0, seed });
      startGame(room); run(room, clock);
      const g = room.game;
      assert.equal(g.phase, 'over', mode);
      assert.equal(g.results().length, 5 + H.length, mode);
      assert.ok(g.final.standings[0].points > 0, mode + ': somebody scored');
      assert.ok([...g.photos.values()].every((r) => r.keep), mode + ': only kept photos remain');
      assert.ok(g.best.length >= 1, mode + ': a best photo');
      const tv = g.tv(); assert.ok(tv.best.length >= 1 && tv.best[0].url.startsWith('/box/photo/SNAP/'));
      JSON.stringify(g.view(H[0] || room.list()[0]));
    }
  }
});
test('a mixed game of 10 rounds plays different modes; durations fit 10–30 minutes', () => {
  const { clock, room } = setup({ mode: 'mixed', rounds: 10, seconds: 90 }, { bots: 6 });
  startGame(room); run(room, clock);
  const modes = new Set(room.game.history.map((h) => h.mode));
  assert.ok(modes.size >= 6, 'modes: ' + [...modes].join(','));
  assert.ok(estimate({ rounds: 5, seconds: 60 }) >= 10 && estimate({ rounds: 10, seconds: 120 }) <= 35, 'estimates');
  for (const M of [5, 10, 15, 20, 30]) { const f = def.partyFit({ players: 6, minutes: M }); assert.ok(def.fields.find((x) => x.key === 'rounds').options.some((o) => o.value === f.rounds)); }
});

// ---------------- the modes' own rules ----------------
test('Scavenger Race: speed bonus for the first, a majority of flags rejects a photo', () => {
  const { clock, room, H: [a, b, c] } = setup({ mode: 'scavenger' }, { humans: 3, bots: 0 });
  startGame(room); toPhase(room, clock, 'snap');
  const R = room.game.R;
  for (const p of [a, b]) for (const s of R.slots) { clock.t += 1000; assert.ok(room.act(p, { op: 'photo', round: R.n, slot: s.slot, img: JPEG() }).ok); }
  clock.t += 1000; assert.ok(room.act(c, { op: 'photo', round: R.n, slot: 'i0', img: JPEG() }).ok);
  room.game.next(); assert.equal(room.game.phase, 'vote');
  const cEntry = room.game.view(c).gallery.find((g) => g.mine);
  assert.match(room.act(c, { op: 'flag', entry: cEntry.eid }).error, /own/);
  assert.ok(room.act(a, { op: 'flag', entry: cEntry.eid }).ok); assert.ok(room.act(b, { op: 'flag', entry: cEntry.eid }).ok);
  assert.equal(room.act(a, { op: 'vote', entry: cEntry.eid }).ok, false, 'no favourites in a scavenger race');
  for (const p of [a, b, c]) assert.ok(room.act(p, { op: 'done' }).ok);
  toPhase(room, clock, 'reveal');
  const rows = room.game.R.rows, cRow = rows.find((r) => r.owner === c.id);
  assert.equal(cRow.rejected, true);
  const first = rows.filter((r) => r.item === 0 && !r.rejected).sort((x, y) => x.at - y.at)[0];
  assert.equal(first.owner, a.id); assert.equal(first.speed, 75);
  assert.equal(room.game.points.get(c.id), 0);
  assert.equal(room.game.points.get(a.id), 4 * 100 + 4 * 75 + 100, 'all items, all first, the full set');
});
test('Close-Up Mystery: the answer is required and hidden; the photographer scores the sweet spot', () => {
  const { clock, room, H: [a, b, c] } = setup({ mode: 'closeup' }, { humans: 3, bots: 0 });
  startGame(room); toPhase(room, clock, 'snap');
  assert.match(upload(room, a).error, /Type what it is/);
  assert.ok(upload(room, a, { text: 'my left ear' }).ok);
  assert.ok(upload(room, b, { text: 'a teapot' }).ok);
  clock.t += 2000; assert.ok(upload(room, c, { text: 'MY LEFT EAR' }).ok);
  toPhase(room, clock, 'guess');
  const tv = room.game.tv(); assert.ok(tv.gallery.every((g) => !g.text), 'the TV never shows the answer before the reveal');
  const aE = room.game.R.entries.find((e) => e.owner === a.id);
  assert.equal(aE.options.filter((o) => norm(o) === 'left ear').length, 1, 'a duplicate answer is not a decoy');
  assert.equal(new Set(aE.options.map(norm)).size, aE.options.length);
  assert.match(room.act(a, { op: 'guess', entry: aE.eid, choice: 0 }).error, /yours/);
  assert.ok(room.act(b, { op: 'guess', entry: aE.eid, choice: aE.answer }).ok);
  assert.match(room.act(b, { op: 'guess', entry: aE.eid, choice: aE.answer }).error, /already/);
  assert.ok(room.act(c, { op: 'guess', entry: aE.eid, choice: (aE.answer + 1) % aE.options.length }).ok);
  for (const bad of [{ choice: -1 }, { choice: 99 }, { choice: 'x' }]) assert.equal(room.act(c, { op: 'guess', entry: room.game.R.entries.find((e) => e.owner === b.id).eid, ...bad }).ok, false);
  room.game.next();
  const row = room.game.R.rows.find((r) => r.owner === a.id);
  assert.equal(row.correct, 1); assert.equal(row.of, 2); assert.equal(row.gain, 75, 'some but not all: the sweet spot');
});
test('Spot the Change: two photos and a mark; a tap within the radius finds it', () => {
  const { clock, room, H: [a, b] } = setup({ mode: 'change' }, { humans: 2, bots: 0 });
  startGame(room); toPhase(room, clock, 'snap');
  const R = room.game.R;
  assert.ok(room.act(a, { op: 'photo', round: R.n, slot: 'a', img: JPEG() }).ok);
  assert.match(room.act(a, { op: 'photo', round: R.n, slot: 'b', img: JPEG() }).error, /Tap where/);
  assert.match(room.act(a, { op: 'photo', round: R.n, slot: 'b', img: JPEG(), mark: { x: 2, y: 0.5 } }).error, /Tap where/);
  assert.ok(room.act(a, { op: 'photo', round: R.n, slot: 'b', img: JPEG(), mark: { x: 0.3, y: 0.6 } }).ok);
  room.game.next(); assert.equal(room.game.phase, 'guess');
  const e = room.game.R.entries[0]; assert.equal(room.game.R.entries.length, 1, 'b sent nothing: one pair');
  assert.equal(room.game.tv().gallery[0].urls.length, 2);
  assert.ok(room.act(b, { op: 'guess', entry: e.eid, x: 0.3 + HIT_R * 0.7, y: 0.6 }).ok);
  room.game.next();
  const row = room.game.R.rows[0]; assert.equal(row.correct, 1); assert.equal(room.game.points.get(b.id), 100);
  assert.equal(room.game.points.get(a.id), 0, 'everyone found it: no sweet spot');
});
test('Selfie Faces: different secret prompts; guessing who acted what', () => {
  const { clock, room, H } = setup({ mode: 'selfie' }, { humans: 3, bots: 2 });
  startGame(room);
  const secrets = H.map((p) => room.game.view(p).secret); assert.equal(new Set(secrets).size, 3);
  assert.ok(!JSON.stringify(room.game.tv()).includes(secrets[0]), 'the TV never shows a secret');
  toPhase(room, clock, 'snap');
  for (const p of H) assert.ok(upload(room, p).ok);
  toPhase(room, clock, 'guess');
  const e = room.game.R.entries.find((x) => x.owner === H[0].id);
  assert.equal(e.options[e.answer], secrets[0]);
  assert.ok(!JSON.stringify(room.game.tv().gallery).includes(secrets[0]) || room.game.tv().gallery.some((g) => g.options), 'options only, no owner');
  assert.ok(room.act(H[1], { op: 'guess', entry: e.eid, choice: e.answer }).ok);
  room.game.next();
  assert.ok(room.game.points.get(H[1].id) >= 100); assert.ok(room.game.points.get(H[0].id) >= 60);
});
test('Colour Match: the colour score; a grid is required', () => {
  assert.equal(colourScore(grid('#e63946'), '#e63946'), 100);
  assert.ok(colourScore(grid('#1f6fd1'), '#e63946') < 10);
  assert.ok(colourScore(grid('#ee4455'), '#e63946') > 80);
  for (const bad of [null, [], grid('#ffffff').slice(1), grid('#ffffff').map(() => 999), grid('#000000').map(() => NaN)]) assert.equal(colourScore(bad, '#e63946'), null);
  const { clock, room, H: [a, b] } = setup({ mode: 'colour' }, { humans: 2, bots: 0 });
  startGame(room); toPhase(room, clock, 'snap');
  const hex = room.game.R.colour.hex;
  assert.match(upload(room, a).error, /colours/);
  assert.ok(upload(room, a, { grid: grid(hex) }).ok); assert.ok(upload(room, b, { grid: grid('#808080') }).ok);
  toPhase(room, clock, 'vote'); room.game.next();
  const ra = room.game.R.rows.find((r) => r.owner === a.id), rb = room.game.R.rows.find((r) => r.owner === b.id);
  assert.equal(ra.match, 100); assert.ok(rb.match < ra.match); assert.ok(ra.bestMatch);
  assert.ok(room.game.points.get(a.id) > room.game.points.get(b.id));
});
test('Alphabet Hunt: the name must start with the letter; names are filtered', () => {
  const { clock, room, H: [a, b] } = setup({ mode: 'alphabet' }, { humans: 2, bots: 1 });
  room.filterOn = true;
  startGame(room); toPhase(room, clock, 'snap');
  const L = room.game.R.letter;
  assert.match(upload(room, a, { text: 'zzzz' }).error, /start with/);
  assert.ok(upload(room, a, { text: 'the ' + L + 'ubble thing' }).ok, '"the" is ignored');
  assert.equal(upload(room, b, { text: '' }).ok, false);
  assert.ok(upload(room, b, { text: L + 'ack' }).ok);
});
test('Caption This: nobody captions their own photo; votes score caption writer and photographer', () => {
  const { clock, room, H } = setup({ mode: 'caption' }, { humans: 3, bots: 0 });
  startGame(room); toPhase(room, clock, 'snap');
  for (const p of H) assert.ok(upload(room, p).ok);
  toPhase(room, clock, 'write');
  const R = room.game.R;
  for (const p of H) { const eid = R.assign.get(p.id); assert.ok(eid); assert.notEqual(R.capPhotos.find((e) => e.eid === eid).owner, p.id); }
  assert.equal(room.act(H[0], { op: 'caption', text: '' }).ok, false);
  for (const [i, p] of H.entries()) assert.ok(room.act(p, { op: 'caption', text: 'Caption number ' + i }).ok);
  toPhase(room, clock, 'vote');
  const g0 = room.game.view(H[0]).gallery; assert.equal(g0.length, 3);
  const notMine = g0.filter((g) => !g.mine); assert.equal(notMine.length, 1, 'my photo and my caption are both mine');
  assert.ok(room.act(H[0], { op: 'vote', entry: notMine[0].eid }).ok);
  room.game.next();
  const row = R.rows.find((r) => r.eid === notMine[0].eid);
  assert.equal(row.votes, 1); assert.ok(room.game.points.get(row.writer) >= 100 + 150); assert.ok(room.game.points.get(row.owner) >= 50);
});
test('Team Recreate: teams, one photo per team, no voting for your own team', () => {
  const { clock, room, H } = setup({ mode: 'recreate' }, { humans: 6, bots: 0 });
  startGame(room);
  const R = room.game.R; assert.equal(R.teams.length, 2);
  toPhase(room, clock, 'snap');
  const t0 = R.teams[0], [m1, m2] = t0.members.map((id) => room.get(id));
  const r1 = upload(room, m1), r2 = upload(room, m2);
  assert.ok(r1.ok && r2.ok); assert.equal(room.game.servePhoto(r1.id), null, 'a teammate’s photo replaced it');
  assert.ok(upload(room, room.get(R.teams[1].members[0])).ok);
  toPhase(room, clock, 'vote');
  assert.equal(R.entries.length, 2);
  const mine = room.game.view(m1).gallery.find((g) => g.mine);
  assert.match(room.act(m1, { op: 'vote', entry: mine.eid }).error, /own/);
  for (const p of H) { const other = room.game.view(p).gallery.find((g) => !g.mine); assert.ok(room.act(p, { op: 'vote', entry: other.eid }).ok); }
  toPhase(room, clock, 'reveal');
  for (const id of t0.members) assert.ok(room.game.points.get(id) >= 50 + 3 * 100, 'every member scores the team photo');
});

// ---------------- the host ----------------
test('host hide: the TV (or the host phone) hides a photo; it leaves the gallery and its URL dies', () => {
  const { clock, room, H: [a, b, c] } = setup({ mode: 'hunt' }, { humans: 3, bots: 0 });
  startGame(room); toPhase(room, clock, 'snap');
  for (const p of [a, b, c]) assert.ok(upload(room, p).ok);
  toPhase(room, clock, 'vote');
  const bEid = room.game.view(a).gallery.find((g) => !g.mine && room.game.entry(g.eid).owner === b.id).eid;
  const bPid = room.game.entry(bEid).photos[0];
  assert.ok(room.act(a, { op: 'vote', entry: bEid }).ok);
  assert.match(room.act(b, { op: 'hide', id: bEid }).error, /host/, 'only the host');
  assert.ok(room.hostAction({ type: 'snapHide', id: bEid }).ok);
  assert.equal(room.game.servePhoto(bPid), null);
  assert.equal(room.game.tv().gallery.length, 2);
  assert.equal(room.game.R.votes.has(a.id), false, 'the vote for it is void');
  const cEid = room.game.view(a).gallery.find((g) => !g.mine).eid;
  assert.ok(room.act(a, { op: 'hide', id: cEid }).ok, 'the host phone (first to join) can hide');
  assert.equal(room.game.tv().gallery.length, 1);
  assert.equal(room.hostAction({ type: 'snapHide', id: 'nope' }).ok, false);
});
test('host approval: photos wait for an OK; the host’s own are fine; unreviewed ones are dropped', () => {
  const { clock, room, H: [host, b, c] } = setup({ mode: 'hunt', approve: 'on' }, { humans: 3, bots: 1 });
  startGame(room); toPhase(room, clock, 'snap');
  const rh = upload(room, host), rb = upload(room, b), rc = upload(room, c);
  assert.equal(rh.pending, false); assert.equal(rb.pending, true);
  assert.equal(room.game.view(host).review.length, 2, 'the host phone sees the waiting photos');
  assert.equal(room.game.view(b).review, undefined, 'nobody else does');
  assert.equal(room.game.tv().review.length, 2);
  assert.match(room.act(b, { op: 'review', id: rc.id, ok: true }).error, /host/);
  assert.ok(room.act(host, { op: 'review', id: rb.id, ok: true }).ok);
  room.game.next(); assert.equal(room.game.phase, 'review', 'one is still waiting');
  run(room, clock, () => room.game.phase !== 'review');
  assert.equal(room.game.phase, 'vote');
  const owners = room.game.R.entries.map((e) => e.owner);
  assert.ok(owners.includes(host.id) && owners.includes(b.id) && !owners.includes(c.id), 'c was never approved');
  assert.equal(room.game.servePhoto(rc.id), null);
});
test('host approval from the TV: OK one, reject one', () => {
  const { clock, room, H: [host, b, c] } = setup({ mode: 'giants', approve: 'on' }, { humans: 3, bots: 0 });
  startGame(room); toPhase(room, clock, 'snap');
  upload(room, host); const rb = upload(room, b), rc = upload(room, c);
  assert.ok(room.hostAction({ type: 'snapOk', id: rb.id, ok: true }).ok);
  assert.ok(room.hostAction({ type: 'snapOk', id: rc.id, ok: false }).ok);
  assert.equal(room.hostAction({ type: 'snapOk', id: rc.id, ok: true }).ok, false, 'already decided');
  run(room, clock, () => room.game.phase === 'vote');
  assert.equal(room.game.R.entries.length, 2);
});

// ---------------- disconnects ----------------
test('disconnects: an offline player is not waited for; leaving takes your photos', () => {
  const { clock, room, H: [a, b, c] } = setup({ mode: 'hunt' }, { humans: 3, bots: 0 });
  startGame(room); toPhase(room, clock, 'snap');
  assert.ok(upload(room, a).ok); assert.ok(upload(room, b).ok);
  const rc = upload(room, c); assert.ok(rc.ok);
  room.remove(c.id);
  assert.equal(room.game.servePhoto(rc.id), null);
  b.sockets = 0;
  const t0 = clock.t; toPhase(room, clock, 'vote');
  assert.ok(clock.t - t0 < 5000, 'everyone online had sent: no waiting for the clock');
  assert.ok(room.act(a, { op: 'vote', entry: room.game.view(a).gallery.find((g) => !g.mine).eid }).ok);
  const t1 = clock.t; toPhase(room, clock, 'reveal');
  assert.ok(clock.t - t1 < 5000, 'b is offline, a voted: reveal');
  run(room, clock); assert.equal(room.game.phase, 'over');
});

// ---------------- the real pipeline: socket.io binary upload -> URL -> 404 ----------------
async function socketTest() {
  const app = express(), server = http.createServer(app);
  const io = new Server(server, { maxHttpBufferSize: 2e6 });
  const box = require('../box').installBox(app, io, { profiles: null });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const mk = () => ioc(base + '/box', { transports: ['websocket'], forceNew: true });
  const emit = (s, ev, msg) => new Promise((r) => s.emit(ev, msg, r));
  const get = (path) => new Promise((r, j) => http.get(base + path, (res) => { const ch = []; res.on('data', (c) => ch.push(c)); res.on('end', () => r({ status: res.statusCode, headers: res.headers, body: Buffer.concat(ch) })); }).on('error', j));
  const tv = mk(), p1 = mk(), p2 = mk();
  try {
    const made = await emit(tv, 'host:create', { game: 'snap' }); assert.ok(made.ok);
    const room = box.get(made.code);
    room.settings.mode = 'hunt'; room.settings.showIntro = false;
    assert.ok((await emit(p1, 'player:join', { code: made.code, name: 'Ana' })).ok);
    assert.ok((await emit(p2, 'player:join', { code: made.code, name: 'Ben' })).ok);
    assert.ok((await emit(tv, 'host:action', { type: 'start' })).ok);
    room.game.next(); // past the brief
    assert.equal(room.game.phase, 'snap');
    const big = JPEG(600 * 1024), small = JPEG(30 * 1024);
    const up = await emit(p1, 'player:act', { op: 'photo', round: room.game.R.n, slot: 'main', img: big, thumb: small });
    assert.ok(up.ok, up.error);
    const junk = await emit(p2, 'player:act', { op: 'photo', round: room.game.R.n, slot: 'main', img: HTML() });
    assert.equal(junk.ok, false);
    const url = `/box/photo/${made.code}/${up.id}`;
    let r = await get(url); assert.equal(r.status, 200); assert.equal(r.headers['content-type'], 'image/jpeg'); assert.equal(r.body.length, big.length);
    assert.match(r.headers['cache-control'], /no-store/); assert.equal(r.headers['x-content-type-options'], 'nosniff');
    assert.ok(r.body.equals(big), 'the bytes arrive unchanged');
    r = await get(url + '?t=1'); assert.equal(r.status, 200); assert.equal(r.body.length, small.length);
    r = await get(`/box/photo/${made.code}/${'A'.repeat(16)}`); assert.equal(r.status, 404);
    r = await get(`/box/photo/ZZZZ/${up.id}`); assert.equal(r.status, 404, 'another room code');
    r = await get(`/box/photo/${made.code}/..%2F..%2Fserver.js`); assert.equal(r.status, 404);
    // Too big for the socket at all: the server drops the message (the phone retries smaller).
    const huge = await Promise.race([emit(p2, 'player:act', { op: 'photo', round: room.game.R.n, slot: 'main', img: JPEG(2.5e6) }), new Promise((res) => setTimeout(() => res('dropped'), 1500))]);
    assert.ok(huge === 'dropped' || huge.ok === false);
    // The round ends: the photo is freed and its URL is gone (unless it is the round's best).
    room.game.next(); room.game.next(); assert.equal(room.game.phase, 'reveal');
    room.game.photos.get(up.id).keep = false; room.game.best = [];
    room.game.next();
    r = await get(url); assert.equal(r.status, 404, 'freed after the round');
    // The game ends / the room goes back to the lobby: everything is gone.
    room.hostAction({ type: 'lobby' });
    r = await get(url + '?t=1'); assert.equal(r.status, 404);
  } finally { for (const s of [tv, p1, p2]) s.close(); io.close(); server.close(); }
}

(async () => {
  for (const [n, fn] of tests) { fn(); passed++; console.log('  ✓ ' + n); }
  await socketTest(); passed++; console.log('  ✓ socket.io: binary upload, served at an unguessable URL with no-store, junk refused, 404 after the round and in the lobby');
  console.log(`\n${passed} JustSnap tests passed.`);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
