'use strict';
// JustFunny: links and clear errors, the no-dead-air queue, TV playback reports (playing,
// ended, can't play), live reactions and the laugh meter, the final vote, the best-of reel,
// awards and results(), on a virtual clock with a fake YouTube.
const assert = require('node:assert/strict');
const { VirtualClock } = require('../clock');
const { BoxRoom } = require('../box/room');
const def = require('../box/games/funny');
const T = def._test;

let passed = 0;
const tests = [];
const test = (name, fn) => tests.push([name, fn]);
const HOSTS = new Set(['www.youtube.com', 'www.googleapis.com', 'www.tiktok.com', 'vm.tiktok.com', 'vt.tiktok.com']);
const fetched = [];
// A fake web: one video blocks embedding, one is missing, the rest are fine.
const fake = async (url, opts = {}) => {
  fetched.push(url);
  if (/vm\.tiktok\.com/.test(url)) return { ok: false, status: 301, url, headers: { get: (h) => (h === 'location' ? 'https://www.tiktok.com/@someone/video/7301234567890123456?is_from_webapp=1' : null) } };
  const blocked = url.includes('BLOCKEDvid1'), missing = url.includes('MISSINGvid1');
  return { ok: !blocked && !missing, status: blocked ? 401 : missing ? 404 : 200, url, json: async () => ({ title: 'Video ' + (url.match(/v%3D([\w-]{11})/) || [0, '?'])[1], author_name: 'Someone', width: 480, height: 270 }) };
};
function make(bots, humans, settings = {}, seed = 5) {
  const clock = new VirtualClock(), r = new BoxRoom('TEST', def, { clock, seed });
  const ps = humans.map((n) => { const p = r.join(n).player; p.sockets = 1; return p; });
  if (bots) r.addBots(bots);
  Object.assign(r.settings, settings);
  assert(r.start().ok);
  r.game.fetch = fake; r.game.key = '';
  return { r, clock, g: r.game, ps };
}
const id = (n) => ('vid' + String(n).padStart(8, '0')).slice(0, 11);
const yt = (n) => `https://www.youtube.com/watch?v=${id(n)}`;
const until = (r, clock, cond, limit = 200000) => { let i = 0; while (!cond() && clock.step()) if (++i > limit) throw new Error('stuck in ' + r.game.phase); assert(cond(), 'never happened (phase ' + r.game.phase + ')'); };

test('Links: start times, share-sheet text, and a clear message for every link we can’t play', () => {
  assert.deepEqual(T.parseLink('https://youtu.be/abcdefghijk'), { src: 'youtube', id: 'abcdefghijk', vertical: false });
  assert.equal(T.parseLink('https://youtu.be/abcdefghijk?t=95').start, 95);
  assert.equal(T.parseLink('https://www.youtube.com/watch?v=abcdefghijk&t=1m35s').start, 95);
  assert.equal(T.parseLink('LOL watch this 😂 https://youtube.com/shorts/abcdefghijk?si=xyz').vertical, true, 'text around the link is fine');
  assert.equal(T.parseLink('https://vm.tiktok.com/ZMabc123/').short, 'https://vm.tiktok.com/ZMabc123/');
  assert.equal(T.parseLink('https://evil.example/vm.tiktok.com/abc'), null);
  const cases = {
    'https://www.youtube.com/playlist?list=PL123': /playlist/, 'https://www.youtube.com/@funnychannel': /channel/,
    'https://www.tiktok.com/@a/photo/7301234567890123456': /photo/, 'https://www.tiktok.com/@someone': /TikTok video link/,
    'https://www.instagram.com/someone/': /profile/, 'https://www.instagram.com/stories/someone/123/': /stories/,
    'https://x.com/a/status/1': /Only YouTube/, 'https://example.com/video.mp4': /isn’t a video/, 'hello there': /isn’t a video link/, '': /Paste/,
  };
  for (const [link, re] of Object.entries(cases)) assert.match(T.linkProblem(link), re, link);
  assert.equal(T.linkProblem('https://www.instagram.com/reel/C1a2B3c4D5e/'), null);
});

test('Picking: blocked, missing and repeated videos are refused with a reason; TikTok short links resolve without following them', async () => {
  const { g, ps } = make(2, ['Ann', 'Bo', 'Cy']);
  const picker = ps.find((p) => p.id === g.picker), other = ps.find((p) => p.id !== g.picker);
  assert.match((await g.actAsync(picker, { op: 'pick', url: 'https://youtu.be/BLOCKEDvid1' })).error, /owner blocks/);
  assert.match((await g.actAsync(picker, { op: 'pick', url: 'https://youtu.be/MISSINGvid1' })).error, /private or deleted/);
  assert.match((await g.actAsync(picker, { op: 'pick', url: 'https://www.youtube.com/@x' })).error, /channel/);
  const q = await g.actAsync(other, { op: 'pick', url: 'https://vm.tiktok.com/ZMabc123/' });
  assert(q.ok && q.queued, 'short link resolved and lined up');
  assert.equal(g.queued.get(other.id).id, '7301234567890123456');
  assert.match((await g.actAsync(picker, { op: 'pick', url: 'https://www.tiktok.com/@x/video/7301234567890123456' })).error, /already lined that one up/);
  assert((await g.actAsync(picker, { op: 'pick', url: yt(1) + '&t=30' })).ok);
  assert.equal(g.phase, 'play'); assert.equal(g.cur.start, 30);
  const third = ps.find((p) => p !== picker && p !== other);
  assert.match((await g.actAsync(third, { op: 'pick', url: yt(1) })).error, /already played/);
  for (const u of fetched) assert(HOSTS.has(new URL(u).host), 'the server only fetches fixed hosts: ' + u);
});

test('No dead air: a ready video plays before a player who is still looking, who then goes next', async () => {
  const { r, clock, g, ps } = make(0, ['Ann', 'Bo', 'Cy', 'Di'], { pickSeconds: 60 });
  const order = g.order.slice(), [first, second, third] = order.map((x) => r.get(x));
  assert.equal(g.picker, first.id);
  assert((await g.actAsync(third, { op: 'pick', url: yt(2) })).ok);
  assert.equal(g.phase, 'pick', 'the picker keeps their time at first');
  clock.t += 16000; until(r, clock, () => g.phase === 'play');
  assert.equal(g.cur.by, third.id, 'the ready video went first after 15 seconds');
  assert(r.playerState(first).state.jumped, 'the slow picker is told they’re next');
  assert.equal(r.playerState(first).state.turnsAway, 1);
  // The slow picker lines one up while it plays: it plays straight after.
  assert((await g.actAsync(first, { op: 'pick', url: yt(3) })).ok);
  g.next(); until(r, clock, () => g.phase === 'play');
  assert.equal(g.cur.by, first.id);
  // Someone who never picks is skipped, then gets one more chance at the end.
  g.next(); until(r, clock, () => g.phase === 'pick');
  assert.equal(g.picker, second.id);
  clock.t += 61000; until(r, clock, () => g.picker !== second.id);
  assert.equal(g.order[g.order.length - 1], second.id, 'came back to them at the end');
  void ps;
});

test('TV reports: "playing" restarts the clock and a short video ends on its own; errors give the picker one more go', () => {
  const { r, clock, g, ps } = make(0, ['Ann', 'Bo']);
  const a = r.get(g.picker), b = ps.find((p) => p !== a);
  g.play(a.id, { key: 'youtube:' + id(4), src: 'youtube', id: id(4), title: 'x', start: 0 });
  clock.t += 3000;
  assert(r.hostAction({ type: 'video', ev: 'playing', id: id(4), dur: 20 }).ok);
  assert.equal(r.hostAction({ type: 'video', ev: 'playing', id: 'someoneelse' }).ok, false, 'reports about other videos are ignored');
  assert(g.endsAt - clock.now() <= 24000 && g.endsAt - clock.now() > 20000, 'ends at the video’s own length');
  until(r, clock, () => g.phase === 'score');
  assert.equal(g.videos[0].why, 'ended');
  until(r, clock, () => g.phase !== 'score');
  // b's video can't play on the TV: b picks again (once), with the reason.
  if (g.phase === 'pick') g.play(b.id, { key: 'youtube:' + id(5), src: 'youtube', id: id(5), title: 'y', start: 0 });
  else { g.cur.by = b.id; }
  const vid = g.cur.id;
  r.hostAction({ type: 'video', ev: 'error', id: vid, code: 150 });
  assert.equal(g.phase, 'pick'); assert.equal(g.picker, b.id);
  assert.match(r.playerState(b).state.cantPlay, /doesn’t allow/);
  assert.match(r.tvState().state.cantPlay.why, /doesn’t allow/);
  g.play(b.id, { key: 'youtube:' + id(6), src: 'youtube', id: id(6), title: 'z', start: 0 });
  r.hostAction({ type: 'video', ev: 'error', id: id(6), code: 'stall' });
  assert.notEqual(g.picker, b.id, 'second failure: moves on');
});

test('Reactions: rate-limited, never on your own video, fill the laugh meter, and mark the funniest moment', () => {
  const { r, clock, g, ps } = make(0, ['Ann', 'Bo', 'Cy', 'Di']);
  const owner = r.get(g.picker), fans = ps.filter((p) => p !== owner);
  g.play(owner.id, { key: 'youtube:' + id(7), src: 'youtube', id: id(7), title: 'cat', start: 10 });
  r.hostAction({ type: 'video', ev: 'playing', id: id(7), dur: 200 });
  assert.equal(r.act(owner, { op: 'react', e: 0 }).ok, false, 'not on your own video');
  assert.equal(r.act(fans[0], { op: 'react', e: 99 }).ok, false);
  assert.equal(r.act(fans[0], { op: 'react', e: '1; drop' }).ok, false);
  clock.t += 30000;
  for (let k = 0; k < 10; k++) { for (const f of fans) assert(r.act(f, { op: 'react', e: k % 6 }).ok); clock.t += 400; }
  assert.equal(g.cur.reacts, 30);
  for (const f of fans) { r.act(f, { op: 'react', e: 0 }); r.act(f, { op: 'react', e: 0 }); } // the second, at the same instant, is dropped
  assert.equal(g.cur.reacts, 33, 'spam inside 300 ms is ignored');
  const heat = r.tvState().state.cur.heat;
  assert(heat >= 90, 'the laugh meter is high: ' + heat);
  assert(r.tvState().state.cur.heat === heat);
  clock.t += 20000;
  assert.equal(r.tvState().state.cur.heat, 0, 'it cools off');
  assert.ok(g.room.fxLog.filter((f) => f.kind === 'react').length <= 30);
  r.act(owner, { op: 'done' });
  assert.equal(g.phase, 'score');
  const v = g.videos[0];
  assert(v.peak >= 25 && v.peak <= 32, 'the funniest moment is about 30 s in: ' + v.peak);
  assert.equal(g.clipFrom(v), 10 + v.peak, 'the reel clip starts there (plus the link’s own start time)');
});

test('Host controls: only the host or the owner can end a video, change the volume or skip the reel', () => {
  const { r, g, ps } = make(0, ['Ann', 'Bo', 'Cy']);
  const host = ps[0], owner = r.get(g.picker), guest = ps.find((p) => p !== host && p !== owner);
  g.play(owner.id, { key: 'instagram:abcde', src: 'instagram', id: 'abcde', title: 'reel', start: 0 });
  assert.equal(r.act(guest, { op: 'done' }).ok, false);
  assert.equal(r.act(guest, { op: 'vol', d: 1 }).ok, false);
  assert(r.act(owner, { op: 'vol', d: -1 }).ok); assert.equal(g.vol, 70);
  assert(r.act(host, { op: 'vol', mute: true }).ok); assert(g.muted);
  assert(r.act(host, { op: 'done' }).ok); assert.equal(g.phase, 'score');
  assert.equal(g.videos[0].why, 'ended');
});

test('20 people, 1 human picks: the night ends with a vote, a best-of reel counting down to #1, awards and results()', async () => {
  const { r, clock, g, ps } = make(18, ['Ann', 'Bo'], { turns: 2, reel: 3 });
  const [ann, bo] = ps;
  let n = 10;
  while (g.phase !== 'final' && g.phase !== 'reel' && g.phase !== 'over') {
    if (g.phase === 'pick') { const p = r.get(g.picker); assert((await g.actAsync(p, { op: 'pick', url: yt(n++) })).ok); }
    if (g.phase === 'play') { clock.t += 5000; r.hostAction({ type: 'video', ev: 'playing', id: g.cur.id, dur: 40 }); }
    clock.step();
  }
  assert.equal(g.videos.length, 4);
  assert(g.videos.every((v) => v.votes > 0), 'bots rated every video');
  assert.equal(g.phase, 'final');
  const s = r.playerState(ann).state;
  assert.equal(s.videos.length, 4); assert.equal(s.videos[0].final, undefined, 'no vote counts before the reveal');
  const theirs = g.videos.find((v) => v.by !== ann.id);
  assert(r.act(ann, { op: 'final', n: theirs.n }).ok);
  r.act(bo, { op: 'final', n: g.videos.find((v) => v.by !== bo.id).n });
  until(r, clock, () => g.phase === 'reel');
  const ranks = g.reel.clips.map((c) => c.rank);
  assert.deepEqual(ranks, [3, 2, 1], 'counts down to the winner');
  assert.equal(r.tvState().state.reel.clip, null, 'starts with an intro card');
  until(r, clock, () => g.reel.at === 0);
  assert.equal(r.tvState().state.reel.clip.rank, 3);
  assert.equal(r.act(bo, { op: 'skipReel' }).ok, false, 'only the host');
  assert(r.act(ann, { op: 'skipReel' }).ok);
  assert.equal(g.phase, 'over');
  const res = g.results();
  assert.equal(res.length, 20); assert.equal(new Set(res).size, 20);
  const pts = res.map((x) => g.points.get(x));
  assert.deepEqual(pts, pts.slice().sort((x, y) => y - x), 'best first');
  const tv = r.tvState().state;
  assert(tv.awards.length >= 1 && tv.awards.every((a) => a.name && a.icon));
  assert.equal(tv.videos[0].n, g.ranked[0].n);
  assert(JSON.stringify(r.tvState()).length < 60000);
});

test('Skip ahead walks every phase, including the reel, and nobody leaving stalls the vote', async () => {
  const { r, g, ps } = make(3, ['Ann', 'Bo']);
  const seen = new Set();
  for (let i = 0; g.phase !== 'over'; i++) {
    seen.add(g.phase);
    if (g.phase === 'pick') await g.actAsync(r.get(g.picker), { op: 'pick', url: yt(100 + i) });
    else assert(r.hostAction({ type: 'next' }).ok);
    if (i > 100) throw new Error('stuck in ' + g.phase);
  }
  for (const ph of ['pick', 'play', 'score', 'final', 'reel']) assert(seen.has(ph), 'saw ' + ph);
  void ps;
});

test('A player who only has their own videos to vote on doesn’t hold up the vote', async () => {
  const { r, clock, g } = make(1, ['Ann'], { turns: 2 });
  const ann = r.get(g.picker);
  for (let k = 0; k < 2; k++) { await g.actAsync(ann, { op: 'pick', url: yt(200 + k) }); r.act(ann, { op: 'done' }); until(r, clock, () => g.phase !== 'score'); }
  assert.equal(g.phase, 'final');
  const t0 = clock.now(); until(r, clock, () => g.phase !== 'final');
  assert(clock.now() - t0 < 15000, 'the bot voted; Ann (only her own videos) wasn’t waited for');
  until(r, clock, () => g.phase === 'over');
});

(async () => {
  for (const [name, fn] of tests) { await fn(); passed++; console.log(`  ✓ ${name}`); }
  console.log(`JustFunny: ${passed} tests passed.`);
})().catch((e) => { console.error(e); process.exit(1); });
