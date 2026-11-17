'use strict';
// JustFunny: a watch party. Players take turns (random order) putting a YouTube video on the
// big screen from their phone. While it plays, everyone rates how funny it is and can vote to
// skip; enough skip votes and it cuts to the next person's video. At the end everyone votes
// for the funniest video, shown with its YouTube thumbnail.
//
// Search: with YOUTUBE_API_KEY set, phones search YouTube inside the game (safe search on).
// Without a key, phones open YouTube's own search and paste the link back. Either way the
// server checks the video can be embedded (YouTube oEmbed) before it goes on the TV.
const opt = (pairs) => pairs.map(([value, label]) => ({ value, label }));
const fields = [
  { key: 'turns', label: 'Videos per player', options: opt([[1, '1 each'], [2, '2 each'], [3, '3 each']]) },
  { key: 'maxVideos', label: 'Most videos in a game', options: opt([[8, '8 videos'], [12, '12 videos'], [20, '20 videos'], [40, '40 videos']]) },
  { key: 'maxSeconds', label: 'Longest a video can play', options: opt([[60, '1 minute'], [90, '1½ minutes'], [120, '2 minutes'], [180, '3 minutes']]) },
  { key: 'skip', label: 'Votes needed to skip', options: opt([[0.34, 'A third of the room'], [0.5, 'Half the room'], [0.67, 'Two thirds of the room']]) },
  { key: 'pickSeconds', label: 'Time to pick a video', options: opt([[45, '45 seconds'], [60, '1 minute'], [90, '1½ minutes']]) },
  { key: 'safe', label: 'YouTube safe search', options: opt([[true, 'On'], [false, 'Off']]) },
];
const defaults = { turns: 1, maxVideos: 12, maxSeconds: 90, skip: 0.5, pickSeconds: 60, safe: true };
const RATE = ['😐', '🙂', '😄', '😂', '🤣'];
const SCORE_SECONDS = 6, VOTE_SECONDS = 40, GRACE_SECONDS = 4;

// Accepts a YouTube link or id: youtu.be/ID, watch?v=ID, shorts/ID, embed/ID, live/ID or a bare 11-char id.
function videoId(input) {
  const s = String(input || '').trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s;
  const m = s.match(/(?:youtu\.be\/|[?&]v=|\/shorts\/|\/embed\/|\/live\/|\/v\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}
const thumb = (id) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
// Any supported short-form or YouTube link → { src, id, vertical } (or a short link to resolve first).
function parseLink(input) {
  const s = String(input || '').trim();
  let m;
  if ((m = s.match(/tiktok\.com\/@[^/?#]+\/video\/(\d{8,25})/)) || (m = s.match(/tiktok\.com\/(?:embed\/v2|player\/v1|v)\/(\d{8,25})/))) return { src: 'tiktok', id: m[1], vertical: true };
  // Short links: rebuild the address ourselves so the server only ever asks TikTok.
  if ((m = s.match(/^(?:https?:\/\/)?(vm|vt)\.tiktok\.com\/([A-Za-z0-9]+)/))) return { src: 'tiktok', short: `https://${m[1]}.tiktok.com/${m[2]}/` };
  if ((m = s.match(/^(?:https?:\/\/)?(?:www\.)?tiktok\.com\/t\/([A-Za-z0-9]+)/))) return { src: 'tiktok', short: `https://www.tiktok.com/t/${m[1]}/` };
  if ((m = s.match(/instagram\.com\/(?:[^/]+\/)?(?:reel|reels|p|tv)\/([A-Za-z0-9_-]{5,40})/))) return { src: 'instagram', id: m[1], vertical: true };
  if (/\/shorts\//.test(s)) { const id = videoId(s); return id ? { src: 'youtube', id, vertical: true } : null; }
  const id = videoId(s);
  return id ? { src: 'youtube', id, vertical: false } : null;
}
const SRC_NAME = { youtube: 'YouTube', tiktok: 'TikTok', instagram: 'Instagram' };
const clean = (s, n = 100) => String(s || '').replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, n);

class Funny {
  constructor(room, settings, deps = {}) {
    this.room = room; this.s = settings;
    this.fetch = deps.fetch || (typeof fetch === 'function' ? fetch : null);
    this.key = deps.apiKey !== undefined ? deps.apiKey : process.env.YOUTUBE_API_KEY || '';
    this.phase = 'pick'; this.order = []; this.turn = -1; this.videos = []; this.queued = new Map(); this.cur = null;
    this.endsAt = 0; this.timer = null; this.points = new Map(); this.finalVotes = new Map(); this.retry = new Set();
    this.vol = 80; this.muted = false; // TV volume, set from the host's phone
  }
  setTimer(ms, fn) { this.room.cancel(this.timer); this.endsAt = this.room.now() + ms; this.timer = this.room.after(ms, fn); }
  humans() { return this.room.list().filter((p) => !p.bot); }
  start() {
    for (const p of this.room.list()) this.points.set(p.id, 0);
    // Random order; every person gets `turns` turns (bots watch and vote but don't pick).
    const ids = this.humans().map((p) => p.id), r = this.room.rng;
    for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; }
    for (let t = 0; t < this.s.turns; t++) this.order.push(...ids);
    this.order = this.order.slice(0, this.s.maxVideos);
    this.nextTurn();
  }
  joined(p) {
    this.points.set(p.id, this.points.get(p.id) || 0);
    if (!p.bot && this.phase !== 'final' && this.phase !== 'over' && this.order.length < this.s.maxVideos) this.order.push(p.id); // late joiners get a turn at the end
  }
  left(p) { if (this.phase === 'pick' && this.picker === p.id) this.nextTurn(); }

  nextTurn() {
    this.turn++;
    this.cur = null;
    while (this.turn < this.order.length && !this.room.get(this.order[this.turn])) this.turn++;
    if (this.turn >= this.order.length) return this.finalVote();
    const by = this.order[this.turn];
    const q = this.queued.get(by);
    if (q) { this.queued.delete(by); return this.play(by, q); }
    this.phase = 'pick'; this.picker = by;
    this.room.fx('gavel');
    this.setTimer(this.s.pickSeconds * 1000, () => { if (this.phase === 'pick' && this.picker === by) this.nextTurn(); });
  }
  play(by, v) {
    this.phase = 'play'; this.picker = by;
    this.cur = { by, ...v, started: this.room.now(), skips: new Set(), ratings: new Map(), reactions: 0 };
    this.room.fx('start');
    this.setTimer(this.s.maxSeconds * 1000, () => this.finish('time'));
    // Bots watch along: they rate it, and some get bored and vote to skip.
    const c = this.cur, taste = this.room.rng();
    for (const b of this.room.list()) if (b.bot && b.id !== by) {
      this.room.after(3000 + this.room.rng() * 6000, () => { if (this.cur === c && this.phase === 'play') { c.ratings.set(b.id, Math.max(1, Math.min(5, Math.round(1 + taste * 4 + (this.room.rng() - 0.5) * 2)))); this.room.fx('react', { e: RATE[c.ratings.get(b.id) - 1] }); } });
      if (this.room.rng() > taste) this.room.after(8000 + this.room.rng() * 20000, () => { if (this.cur === c && this.phase === 'play') { c.skips.add(b.id); this.checkSkip(); } });
    }
  }
  eligible() { return this.room.list().filter((p) => this.cur && p.id !== this.cur.by && (p.bot || p.sockets > 0)); }
  skipNeed() { return Math.max(1, Math.ceil(this.eligible().length * this.s.skip)); }
  checkSkip() { if (this.phase === 'play' && this.cur.skips.size >= this.skipNeed() && this.room.now() - this.cur.started > GRACE_SECONDS * 1000) this.finish('skipped'); }
  finish(why) {
    if (this.phase !== 'play') return;
    const c = this.cur, vals = [...c.ratings.values()];
    const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    const watched = Math.round((this.room.now() - c.started) / 1000);
    const pts = Math.round(avg * 10) + (why === 'skipped' ? 0 : 10); // funny + held the room
    this.points.set(c.by, (this.points.get(c.by) || 0) + pts);
    this.videos.push({ n: this.videos.length + 1, id: c.id, src: c.src, thumb: c.thumb, vertical: c.vertical, title: c.title, by: c.by, avg: Math.round(avg * 10) / 10, votes: vals.length, watched, why, pts });
    this.phase = 'score'; this.last = this.videos[this.videos.length - 1];
    this.room.fx(why === 'skipped' ? 'boo' : avg >= 4 ? 'cheer' : 'chime');
    this.setTimer(SCORE_SECONDS * 1000, () => this.nextTurn());
  }
  finalVote() {
    if (this.videos.length < 2) return this.end();
    this.phase = 'final'; this.finalVotes = new Map();
    this.room.fx('gavel');
    this.setTimer(VOTE_SECONDS * 1000, () => this.end());
    for (const p of this.room.list()) if (p.bot) this.room.after(2000 + this.room.rng() * 8000, () => { if (this.phase !== 'final') return; const opts = this.videos.filter((v) => v.by !== p.id); this.finalVotes.set(p.id, opts[Math.floor(this.room.rng() * opts.length)].n); this.maybeAllVoted(); });
  }
  maybeAllVoted() { if (this.room.list().filter((p) => p.bot || p.sockets > 0).every((p) => this.finalVotes.has(p.id))) this.end(); }
  end() {
    if (this.phase === 'over') return;
    const tally = new Map(); for (const n of this.finalVotes.values()) tally.set(n, (tally.get(n) || 0) + 1);
    for (const v of this.videos) { v.final = tally.get(v.n) || 0; this.points.set(v.by, (this.points.get(v.by) || 0) + v.final * 15); }
    this.ranked = this.videos.slice().sort((a, b) => b.final - a.final || b.avg - a.avg);
    this.phase = 'over'; this.endsAt = 0; this.room.cancel(this.timer); this.room.fx('win');
  }
  next() { if (this.phase === 'pick') this.nextTurn(); else if (this.phase === 'play') this.finish('skipped'); else if (this.phase === 'score') { this.room.cancel(this.timer); this.nextTurn(); } else if (this.phase === 'final') this.end(); }
  // The TV reports when a video ends or can't be played.
  hostAct(m) {
    if (m.type !== 'video' || this.phase !== 'play' || !this.cur || m.id !== this.cur.id) return { ok: false };
    if (m.ev === 'ended') this.finish('ended');
    else if (m.ev === 'error') {
      // Can't play on the TV: that person picks again (once).
      const by = this.cur.by; this.phase = 'pick'; this.cur = null;
      if (!this.retry.has(by)) { this.retry.add(by); this.picker = by; this.cantPlay = by; this.setTimer(this.s.pickSeconds * 1000, () => { if (this.phase === 'pick' && this.picker === by) this.nextTurn(); }); }
      else this.nextTurn();
    }
    return { ok: true };
  }

  // ---- phone actions ----
  act(p, m) {
    if (m.op === 'rate') {
      if (this.phase !== 'play' || p.id === this.cur.by) return { ok: false, error: 'Not now.' };
      const v = Math.round(Number(m.v)); if (v < 1 || v > 5) return { ok: false, error: 'Rate 1–5.' };
      this.cur.ratings.set(p.id, v); this.cur.reactions++; this.room.fx('react', { e: RATE[v - 1] });
      return { ok: true };
    }
    if (m.op === 'skip') {
      if (this.phase !== 'play' || p.id === this.cur.by) return { ok: false, error: 'Not now.' };
      if (m.on === false) this.cur.skips.delete(p.id); else this.cur.skips.add(p.id);
      this.checkSkip(); return { ok: true };
    }
    if (m.op === 'final') {
      if (this.phase !== 'final') return { ok: false, error: 'Not now.' };
      const v = this.videos.find((x) => x.n === Number(m.n)); if (!v) return { ok: false, error: 'Pick a video.' };
      if (v.by === p.id) return { ok: false, error: 'You can’t vote for your own video!' };
      this.finalVotes.set(p.id, v.n); this.maybeAllVoted(); return { ok: true };
    }
    if (m.op === 'vol') {
      // The host, or whoever's video is on, controls the TV volume.
      const vip = this.room.vip && this.room.vip();
      if (!(vip && vip.id === p.id) && !(this.cur && this.cur.by === p.id)) return { ok: false, error: 'Only the host or the video’s owner can change the volume.' };
      if (m.mute != null) this.muted = !!m.mute;
      if (m.d) { this.vol = Math.max(0, Math.min(100, this.vol + Math.sign(Number(m.d)) * 10)); this.muted = false; }
      return { ok: true };
    }
    if (m.op === 'unqueue') { this.queued.delete(p.id); return { ok: true }; }
    return { ok: false, error: 'Unknown move.' };
  }
  // Picking and searching talk to YouTube, so they answer later.
  async actAsync(p, m) {
    if (m.op === 'search') return this.search(String(m.q || '').slice(0, 80), !!m.shorts);
    if (m.op === 'pick') {
      let link = parseLink(m.url || m.id);
      if (link && link.short) { const real = await this.resolve(link.short); link = real ? parseLink(real) : null; }
      if (!link || !link.id) return { ok: false, error: 'Paste a YouTube, YouTube Shorts, TikTok or Instagram Reel link.' };
      const id = link.id;
      const mine = this.order.slice(Math.max(0, this.turn)).includes(p.id);
      if (!mine) return { ok: false, error: 'You don’t have a turn left.' };
      const info = await this.check(link);
      if (!info.ok) return info;
      const v = { src: link.src, id, vertical: link.vertical || !!info.vertical, title: clean(info.title || m.title || `${SRC_NAME[link.src]} video`), channel: clean(info.channel || '', 40), thumb: info.thumb || (link.src === 'youtube' ? thumb(id) : null) };
      if (this.phase === 'pick' && this.picker === p.id) { this.room.cancel(this.timer); this.cantPlay = null; this.play(p.id, v); }
      else this.queued.set(p.id, v);
      this.room.sync();
      return { ok: true, queued: !(this.phase === 'play' && this.cur && this.cur.by === p.id), title: v.title };
    }
    return { ok: false, error: 'Unknown move.' };
  }
  async getJson(url, ms = 4000) {
    if (!this.fetch) return { status: 0 };
    const ctl = typeof AbortController === 'function' ? new AbortController() : null;
    const t = ctl && setTimeout(() => ctl.abort(), ms);
    try { const r = await this.fetch(url, ctl ? { signal: ctl.signal } : undefined); const body = r.ok ? await r.json() : null; return { status: r.status, body }; }
    catch { return { status: 0 }; } finally { if (t) clearTimeout(t); }
  }
  // oEmbed: 401/403 = the owner turned embedding off; 404 = no such video. Network trouble: allow it.
  async resolve(url) { // vm.tiktok.com short links redirect to the full video address
    if (!this.fetch) return null;
    try { const r = await this.fetch(url, { redirect: 'follow' }); return r.url || null; } catch { return null; }
  }
  async check(link) {
    if (link.src === 'tiktok') {
      const r = await this.getJson(`https://www.tiktok.com/oembed?url=${encodeURIComponent('https://www.tiktok.com/@tiktok/video/' + link.id)}`);
      return { ok: true, title: r.body && r.body.title, channel: r.body && r.body.author_name, thumb: r.body && r.body.thumbnail_url, vertical: true };
    }
    if (link.src === 'instagram') return { ok: true, title: 'Instagram Reel', vertical: true }; // Instagram shares no details without a Facebook app token
    const id = link.id;
    const r = await this.getJson(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent('https://www.youtube.com/watch?v=' + id)}`);
    if (r.status === 401 || r.status === 403) return { ok: false, error: 'That video can’t be played on the TV (its owner blocks it). Pick another.' };
    if (r.body && r.body.thumbnail_url) r.body.thumb = r.body.thumbnail_url;
    if (r.status === 404 || r.status === 400) return { ok: false, error: 'Couldn’t find that video. Check the link.' };
    return { ok: true, title: r.body && r.body.title, channel: r.body && r.body.author_name, thumb: thumb(id), vertical: link.vertical || (r.body && r.body.height > r.body.width) };
  }
  async search(q, shorts) {
    if (!this.key) return { ok: false, noKey: true, error: 'In-game search needs a YouTube API key. Use “Search on YouTube” and paste the link.' };
    if (!q.trim()) return { ok: true, results: [] };
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoEmbeddable=true&maxResults=12${shorts ? '&videoDuration=short' : ''}&safeSearch=${this.s.safe ? 'strict' : 'none'}&q=${encodeURIComponent(q)}&key=${encodeURIComponent(this.key)}`;
    const r = await this.getJson(url, 6000);
    if (!r.body) return { ok: false, error: 'YouTube search isn’t answering right now. Try pasting a link.' };
    return { ok: true, results: (r.body.items || []).filter((x) => x.id && x.id.videoId).map((x) => ({ src: 'youtube', id: x.id.videoId, title: clean(x.snippet.title), channel: clean(x.snippet.channelTitle, 40), thumb: thumb(x.id.videoId) })) };
  }

  standings() { return [...this.points].filter(([id]) => this.room.get(id)).map(([id, pts]) => ({ id, name: this.room.name(id), points: pts })).sort((a, b) => b.points - a.points); }
  curView() {
    const c = this.cur; if (!c) return null;
    const vals = [...c.ratings.values()];
    return { id: c.id, src: c.src, vertical: c.vertical, thumb: c.thumb, title: c.title, channel: c.channel, by: this.room.name(c.by), avg: vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : 0, votes: vals.length, skips: c.skips.size, need: this.skipNeed(), elapsed: this.room.now() - c.started, max: this.s.maxSeconds * 1000 };
  }
  tv() {
    return {
      phase: this.phase, endsIn: this.endsAt ? Math.max(0, this.endsAt - this.room.now()) : 0, n: this.turn + 1, of: this.order.length,
      picker: this.picker ? this.room.name(this.picker) : null, cantPlay: this.cantPlay ? this.room.name(this.cantPlay) : null,
      upNext: this.order.slice(this.turn + 1, this.turn + 4).map((id) => ({ name: this.room.name(id), ready: this.queued.has(id) })),
      cur: this.phase === 'play' ? this.curView() : null, last: this.phase === 'score' ? this.last && { ...this.last, by: this.room.name(this.last.by) } : null,
      videos: this.phase === 'final' || this.phase === 'over' ? (this.ranked || this.videos).map((v) => ({ ...v, by: this.room.name(v.by) })) : [],
      finalVoted: this.finalVotes.size, standings: this.standings().slice(0, 10), rate: RATE, vol: this.vol, muted: this.muted,
    };
  }
  view(p) {
    const st = this.standings(), left = this.order.slice(this.turn + 1).indexOf(p.id);
    const c = this.cur;
    return {
      phase: this.phase, endsIn: this.endsAt ? Math.max(0, this.endsAt - this.room.now()) : 0, n: this.turn + 1, of: this.order.length,
      myTurn: this.phase === 'pick' && this.picker === p.id, picker: this.picker ? this.room.name(this.picker) : null, cantPlay: this.cantPlay === p.id,
      turnsAway: this.order.slice(Math.max(0, this.turn)).includes(p.id) ? (this.picker === p.id ? 0 : left + 1) : null, queued: this.queued.get(p.id) || null,
      search: !!this.key, cur: this.phase === 'play' ? { ...this.curView(), mine: c.by === p.id, myRating: c.ratings.get(p.id) || 0, mySkip: c.skips.has(p.id) } : null,
      last: this.phase === 'score' ? this.last && { ...this.last, mine: this.last.by === p.id, by: this.room.name(this.last.by) } : null,
      videos: this.phase === 'final' || this.phase === 'over' ? (this.ranked || this.videos).map((v) => ({ n: v.n, id: v.id, title: v.title, by: this.room.name(v.by), mine: v.by === p.id, src: v.src, thumb: v.thumb, avg: v.avg, final: v.final })) : [],
      myFinal: this.finalVotes.get(p.id) || null, rate: RATE, vol: this.vol, muted: this.muted,
      points: this.points.get(p.id) || 0, rank: st.findIndex((x) => x.id === p.id) + 1, of2: st.length, final: this.phase === 'over' ? st.slice(0, 10) : null,
    };
  }
}

module.exports = {
  key: 'funny', name: 'JustFunny', min: 2, fields, defaults,
  create: (room, settings) => new Funny(room, settings),
  _test: { videoId, parseLink, Funny, thumb },
};
