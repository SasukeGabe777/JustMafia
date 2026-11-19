'use strict';
// JustFunny: a watch party. Players take turns putting a video (YouTube, Shorts, TikTok or an
// Instagram Reel) on the big screen from their phone. While it plays, everyone rates how funny
// it is, throws live reactions (they float up the TV and fill the laugh meter) and can vote to
// skip. Nobody waits on a slow picker: a video that is already lined up plays first. At the end
// everyone votes for the funniest video, and a best-of reel counts down the winners, each clip
// starting just before the biggest laugh it got.
//
// Search: with YOUTUBE_API_KEY set, phones search YouTube inside the game (safe search on).
// Without a key, phones open the app's own search and paste the link back. Either way the
// server checks the video can be embedded (oEmbed) before it goes on the TV. The server only
// ever fetches fixed addresses on youtube.com, googleapis.com and tiktok.com.
const opt = (pairs) => pairs.map(([value, label]) => ({ value, label }));
const fields = [
  { key: 'turns', label: 'Videos per player', options: opt([[1, '1 each'], [2, '2 each'], [3, '3 each']]) },
  { key: 'maxVideos', label: 'Most videos in a game', options: opt([[8, '8 videos'], [12, '12 videos'], [20, '20 videos'], [40, '40 videos']]) },
  { key: 'maxSeconds', label: 'Longest a video can play', options: opt([[60, '1 minute'], [90, '1½ minutes'], [120, '2 minutes'], [180, '3 minutes']]) },
  { key: 'skip', label: 'Votes needed to skip', options: opt([[0.34, 'A third of the room'], [0.5, 'Half the room'], [0.67, 'Two thirds of the room']]) },
  { key: 'pickSeconds', label: 'Time to pick a video', options: opt([[45, '45 seconds'], [60, '1 minute'], [90, '1½ minutes']]) },
  { key: 'reel', label: 'Best-of reel at the end', options: opt([[3, 'Top 3 moments'], [5, 'Top 5 moments'], [0, 'No reel']]) },
  { key: 'safe', label: 'YouTube safe search', options: opt([[true, 'On'], [false, 'Off']]) },
];
const defaults = { turns: 1, maxVideos: 12, maxSeconds: 90, skip: 0.5, pickSeconds: 60, reel: 3, safe: true };
const RATE = ['😐', '🙂', '😄', '😂', '🤣'];
const REACTS = ['😂', '💀', '😱', '👏', '🔥', '🥴'];
const SCORE_SECONDS = 5, VOTE_SECONDS = 40, GRACE_SECONDS = 4;
const LOAD_GRACE_MS = 8000; // before the TV says "playing", allow this long for the video to load
const END_GRACE_MS = 4000; // a video that should have ended by now has ended, even if the TV never said so
const JUMP_AFTER_MS = 15000; // a picker still searching after this long lets a ready video go first
const REACT_GAP_MS = 300, FX_PER_SECOND = 8, HEAT_WINDOW_MS = 6000;
const REEL_INTRO_MS = 3500, CLIP_MS = 12000, CARD_MS = 6000, PEAK_WINDOW_S = 6, PEAK_LEAD_S = 3;
const CANT_PLAY = {
  2: 'the link was broken', 5: 'the TV’s browser can’t play that video', 100: 'it was removed or made private',
  101: 'its owner doesn’t allow it on other sites', 150: 'its owner doesn’t allow it on other sites',
  stall: 'it wouldn’t start on the TV', offline: 'the TV can’t reach the video site',
};

// Accepts a YouTube link or id: youtu.be/ID, watch?v=ID, shorts/ID, embed/ID, live/ID or a bare 11-char id.
function videoId(input) {
  const s = String(input || '').trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s;
  const m = s.match(/(?:youtu\.be\/|[?&]v=|\/shorts\/|\/embed\/|\/live\/|\/v\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}
const thumb = (id) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
// "?t=95", "&t=1m35s", "&start=95" → 95 (seconds into the video).
function startTime(s) {
  const m = String(s || '').match(/[?&#](?:t|start)=(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?(?:&|$|#)/);
  if (!m) return 0;
  const t = (Number(m[1]) || 0) * 3600 + (Number(m[2]) || 0) * 60 + (Number(m[3]) || 0);
  return t > 0 && t < 36000 ? t : 0;
}
// Share sheets paste "Look at this! https://…": use the first web address in the text.
const firstUrl = (s) => { const m = String(s || '').match(/https?:\/\/[^\s<>"']+/); return m ? m[0] : String(s || '').trim(); };
// Any supported short-form or YouTube link → { src, id, vertical[, start] } (or a short link to resolve first).
function parseLink(input) {
  const s = firstUrl(input);
  let m;
  if ((m = s.match(/tiktok\.com\/@[^/?#]+\/video\/(\d{8,25})/)) || (m = s.match(/tiktok\.com\/(?:embed\/v2|player\/v1|v)\/(\d{8,25})/))) return { src: 'tiktok', id: m[1], vertical: true };
  // Short links: rebuild the address ourselves so the server only ever asks TikTok.
  if ((m = s.match(/^(?:https?:\/\/)?(vm|vt)\.tiktok\.com\/([A-Za-z0-9]+)/))) return { src: 'tiktok', short: `https://${m[1]}.tiktok.com/${m[2]}/` };
  if ((m = s.match(/^(?:https?:\/\/)?(?:www\.)?tiktok\.com\/t\/([A-Za-z0-9]+)/))) return { src: 'tiktok', short: `https://www.tiktok.com/t/${m[1]}/` };
  if ((m = s.match(/instagram\.com\/(?:[^/]+\/)?(?:reel|reels|p|tv)\/([A-Za-z0-9_-]{5,40})/))) return { src: 'instagram', id: m[1], vertical: true };
  const id = videoId(s);
  if (!id) return null;
  const out = { src: 'youtube', id, vertical: /\/shorts\//.test(s) };
  const t = startTime(s); if (t) out.start = t;
  return out;
}
// Links we recognise but can't play: say exactly what to do instead.
function linkProblem(input) {
  const s = firstUrl(input).toLowerCase();
  if (!s) return 'Paste a video link first.';
  if (parseLink(s)) return null;
  if (/youtube\.com\/(playlist|feed|results)|[?&]list=/.test(s)) return 'That’s a playlist or search page. Open one video, tap Share → Copy link, and paste that.';
  if (/youtube\.com\/(@|channel\/|c\/|user\/)/.test(s)) return 'That’s a YouTube channel. Open one of its videos and share that instead.';
  if (/tiktok\.com\/@[^/]+\/photo\//.test(s)) return 'That TikTok is a photo slideshow: only videos can play on the TV.';
  if (/tiktok\.com/.test(s)) return 'That’s not a TikTok video link. Open the video, tap Share → Copy link, and paste that.';
  if (/instagram\.com\/stories\//.test(s)) return 'Instagram stories can’t be shown. Pick a Reel instead.';
  if (/instagram\.com/.test(s)) return 'That’s an Instagram profile, not a Reel. Open the Reel, tap ⋯ → Copy link.';
  if (/(facebook\.com|fb\.watch|twitter\.com|x\.com|snapchat\.com|twitch\.tv|vimeo\.com|reddit\.com)/.test(s)) return 'Only YouTube, Shorts, TikTok and Instagram Reels can play on the TV.';
  if (/^https?:\/\//.test(s)) return 'That link isn’t a video we can play. Use YouTube, Shorts, TikTok or an Instagram Reel.';
  return 'That isn’t a video link. In the app, tap Share → Copy link, then paste it here.';
}
const SRC_NAME = { youtube: 'YouTube', tiktok: 'TikTok', instagram: 'Instagram' };
const clean = (s, n = 100) => String(s || '').replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, n);
const avgOf = (vals) => (vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0);
const round1 = (x) => Math.round(x * 10) / 10;

class Funny {
  constructor(room, settings, deps = {}) {
    this.room = room; this.s = { ...defaults, ...settings };
    this.fetch = deps.fetch || (typeof fetch === 'function' ? fetch : null);
    this.key = deps.apiKey !== undefined ? deps.apiKey : process.env.YOUTUBE_API_KEY || '';
    this.phase = 'pick'; this.order = []; this.turn = -1; this.videos = []; this.queued = new Map(); this.cur = null;
    this.endsAt = 0; this.timer = null; this.points = new Map(); this.finalVotes = new Map(); this.retry = new Set(); this.deferred = new Set();
    this.vol = 80; this.muted = false; // TV volume, set from the host's phone
    this.cantPlay = null; this.jumped = null; this.pickStart = 0; this.picker = null; this.last = null;
    this.sent = new Map(); this.fxWin = { t: 0, n: 0 }; this.ranked = null; this.reel = null; this.awards = [];
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
    if (!p.bot && !this.closed() && this.order.length < this.s.maxVideos) this.order.push(p.id); // late joiners get a turn at the end
  }
  left(p) {
    this.queued.delete(p.id);
    if (this.phase === 'pick' && this.picker === p.id) this.nextTurn();
    else if (this.phase === 'play') this.checkSkip();
    else if (this.phase === 'final') this.maybeAllVoted();
  }
  closed() { return this.phase === 'final' || this.phase === 'reel' || this.phase === 'over'; }

  // ---------- whose turn ----------
  // The slice of the order still to come (in the pick phase it starts with the picker).
  ahead() { return this.order.slice(this.phase === 'pick' ? Math.max(0, this.turn) : this.turn + 1); }
  turnsLeft(id) { return this.closed() ? 0 : this.ahead().filter((x) => x === id).length; }
  turnsAway(id) { if (this.closed()) return null; const i = this.ahead().indexOf(id); return i < 0 ? null : this.phase === 'pick' ? i : i + 1; }
  // Move the first ready (queued) player after the current turn into the current slot.
  pullReady() {
    for (let j = this.turn + 1; j < this.order.length; j++) {
      const id = this.order[j];
      if (this.queued.has(id) && this.room.get(id)) { this.order.splice(j, 1); this.order.splice(this.turn, 0, id); return id; }
    }
    return null;
  }
  nextTurn() {
    this.room.cancel(this.timer);
    this.turn++; this.cur = null;
    while (this.turn < this.order.length && !this.room.get(this.order[this.turn])) this.turn++;
    if (this.turn >= this.order.length) return this.finalVote();
    let by = this.order[this.turn];
    // No dead air: if this player hasn't lined anything up, a later player who has goes first.
    if (!this.queued.has(by)) { const ready = this.pullReady(); if (ready) { this.jumped = by; by = ready; } }
    const q = this.queued.get(by);
    if (q) { this.queued.delete(by); return this.play(by, q); }
    this.phase = 'pick'; this.picker = by; this.pickStart = this.room.now();
    if (this.jumped === by) this.jumped = null;
    this.room.fx('gavel');
    this.setTimer(this.s.pickSeconds * 1000, () => this.pickTimeout(by));
    const turn = this.turn;
    this.room.after(JUMP_AFTER_MS, () => { if (this.phase === 'pick' && this.picker === by && this.turn === turn) this.maybeJump(); });
  }
  // Still searching after a while, and someone else is ready? Their video plays first; the picker goes next.
  maybeJump() {
    if (this.phase !== 'pick' || this.room.now() - this.pickStart < JUMP_AFTER_MS) return;
    const by = this.picker, ready = this.pullReady(); if (!ready) return;
    this.jumped = by;
    const q = this.queued.get(ready); this.queued.delete(ready);
    this.play(ready, q);
  }
  pickTimeout(by) {
    if (this.phase !== 'pick' || this.picker !== by) return;
    if (!this.deferred.has(by)) { this.deferred.add(by); this.order.push(by); } // we come back to them once, at the end
    if (this.cantPlay && this.cantPlay.by === by) this.cantPlay = null;
    this.nextTurn();
  }

  // ---------- a video on the TV ----------
  play(by, v) {
    this.phase = 'play'; this.picker = by;
    if (this.cantPlay && this.cantPlay.by === by) this.cantPlay = null;
    if (this.jumped === by) this.jumped = null;
    this.cur = { by, ...v, started: this.room.now(), playAt: 0, skips: new Set(), ratings: new Map(), rx: [], reacts: 0, lastReact: new Map() };
    this.room.fx('start', { src: v.src });
    this.setTimer(this.s.maxSeconds * 1000 + LOAD_GRACE_MS, () => this.finish('time'));
    // Bots watch along: they rate it, react a little, and some get bored and vote to skip.
    const c = this.cur, taste = this.room.rng();
    for (const b of this.room.list()) if (b.bot && b.id !== by) {
      this.room.after(3000 + this.room.rng() * 6000, () => { if (this.cur === c && this.phase === 'play') this.rate(b, Math.max(1, Math.min(5, Math.round(1 + taste * 4 + (this.room.rng() - 0.5) * 2)))); });
      if (taste > 0.5) this.room.after(5000 + this.room.rng() * 25000, () => { if (this.cur === c && this.phase === 'play') this.react(b, Math.floor(this.room.rng() * REACTS.length)); });
      if (this.room.rng() > taste) this.room.after(8000 + this.room.rng() * 20000, () => { if (this.cur === c && this.phase === 'play') { c.skips.add(b.id); this.checkSkip(); } });
    }
  }
  eligible() { return this.room.list().filter((p) => this.cur && p.id !== this.cur.by && (p.bot || p.sockets > 0)); }
  skipNeed() { return Math.max(1, Math.ceil(this.eligible().length * this.s.skip)); }
  checkSkip() { if (this.phase === 'play' && this.cur.skips.size >= this.skipNeed() && this.room.now() - this.cur.started > GRACE_SECONDS * 1000) this.finish('skipped'); }
  // A reaction cue for the TV, at most a few a second for the whole room (the counts still count).
  fxReact(e, p) {
    const now = this.room.now();
    if (now - this.fxWin.t >= 1000) this.fxWin = { t: now, n: 0 };
    if (++this.fxWin.n <= FX_PER_SECOND) this.room.fx('react', { e, pid: p ? p.id : null }); // pid: the TV pops the reaction over that friend on the couch
  }
  // Every rating tap and reaction is a "laugh": it fills the meter and marks the funniest moment.
  laugh(p) {
    const c = this.cur, now = this.room.now(), last = c.lastReact.get(p.id) || -1e9;
    if (now - last < REACT_GAP_MS) return false;
    c.lastReact.set(p.id, now);
    if (c.rx.length < 3000) c.rx.push(now);
    c.reacts++; this.sent.set(p.id, (this.sent.get(p.id) || 0) + 1);
    return true;
  }
  rate(p, v) { this.cur.ratings.set(p.id, v); if (this.laugh(p)) this.fxReact(RATE[v - 1], p); }
  react(p, i) { if (!this.laugh(p)) return false; this.fxReact(REACTS[i], p); return true; }
  heat() {
    const c = this.cur; if (!c) return 0;
    const since = this.room.now() - HEAT_WINDOW_MS; let n = 0;
    for (let i = c.rx.length - 1; i >= 0 && c.rx[i] >= since; i--) n++;
    return Math.min(100, Math.round((n / Math.max(1, this.eligible().length)) * 55));
  }
  // The 6 seconds with the most laughs → where the best-of clip starts (a moment before).
  peakOf(c, base) {
    const t = c.rx.map((x) => (x - base) / 1000).filter((x) => x >= 0).sort((a, b) => a - b);
    if (!t.length) return null;
    let best = 0, at = t[0];
    for (let i = 0, j = 0; i < t.length; i++) { while (t[i] - t[j] > PEAK_WINDOW_S) j++; if (i - j + 1 > best) { best = i - j + 1; at = t[j]; } }
    return { at: Math.max(0, Math.floor(at - PEAK_LEAD_S)), n: best };
  }
  finish(why) {
    if (this.phase !== 'play') return;
    const c = this.cur, vals = [...c.ratings.values()], avg = avgOf(vals);
    const base = c.playAt || c.started, watched = Math.max(0, Math.round((this.room.now() - base) / 1000));
    const pts = Math.round(avg * 10) + (why === 'skipped' ? 0 : 10); // funny + held the room
    this.points.set(c.by, (this.points.get(c.by) || 0) + pts);
    const peak = this.peakOf(c, base);
    this.videos.push({ n: this.videos.length + 1, key: c.key, id: c.id, src: c.src, thumb: c.thumb, vertical: c.vertical, title: c.title, channel: c.channel, by: c.by, avg: round1(avg), votes: vals.length, watched, why, pts, reacts: c.reacts, start: c.start || 0, peak: peak ? peak.at : null, peakN: peak ? peak.n : 0 });
    this.phase = 'score'; this.last = this.videos[this.videos.length - 1];
    this.room.fx(why === 'skipped' ? 'boo' : avg >= 4 ? 'cheer' : 'chime');
    this.setTimer(SCORE_SECONDS * 1000, () => this.nextTurn());
  }
  // The TV couldn't play it: that person gets one more go (right after the next ready video).
  cantPlayNow(code) {
    const by = this.cur.by;
    this.cantPlay = { by, why: CANT_PLAY[code] || 'it wouldn’t play on the TV' };
    this.cur = null; this.room.fx('shrug');
    if (!this.retry.has(by)) { this.retry.add(by); this.order.splice(this.turn + 1, 0, by); }
    this.nextTurn();
  }

  // ---------- the end of the night ----------
  finalVote() {
    this.cur = null; this.picker = null;
    if (this.videos.length < 2) { this.ranked = this.videos.slice(); for (const v of this.ranked) v.final = 0; this.giveAwards(); return this.startReel(); }
    this.phase = 'final'; this.finalVotes = new Map();
    this.room.fx('ballot');
    this.setTimer(VOTE_SECONDS * 1000, () => this.closeVote());
    for (const p of this.room.list()) if (p.bot) this.room.after(2000 + this.room.rng() * 8000, () => {
      if (this.phase !== 'final' || !this.room.get(p.id)) return;
      // Bots lean towards the videos the room laughed at most.
      const opts = this.videos.filter((v) => v.by !== p.id); if (!opts.length) return;
      const w = opts.map((v) => 1 + v.avg * v.avg + v.reacts / 4); let x = this.room.rng() * w.reduce((a, b) => a + b, 0), k = 0;
      while (k < opts.length - 1 && (x -= w[k]) > 0) k++;
      this.finalVotes.set(p.id, opts[k].n); this.maybeAllVoted();
    });
  }
  voters() { return this.room.list().filter((p) => (p.bot || p.sockets > 0) && this.videos.some((v) => v.by !== p.id)); }
  maybeAllVoted() { if (this.phase === 'final' && this.voters().every((p) => this.finalVotes.has(p.id))) this.closeVote(); }
  closeVote() {
    if (this.phase !== 'final') return;
    const tally = new Map(); for (const n of this.finalVotes.values()) tally.set(n, (tally.get(n) || 0) + 1);
    for (const v of this.videos) { v.final = tally.get(v.n) || 0; this.points.set(v.by, (this.points.get(v.by) || 0) + v.final * 15); }
    this.ranked = this.videos.slice().sort((a, b) => b.final - a.final || b.avg - a.avg || b.reacts - a.reacts);
    this.giveAwards();
    this.startReel();
  }
  end() { if (this.phase === 'final') this.closeVote(); else if (this.phase !== 'over') this.over(); }
  giveAwards() {
    const A = [], name = (id) => this.room.name(id);
    const rated = this.videos.filter((v) => v.votes > 0).sort((a, b) => b.avg - a.avg || b.votes - a.votes);
    if (rated[0]) A.push({ key: 'crowd', icon: '🤣', title: 'Crowd Pleaser', id: rated[0].by, detail: `“${rated[0].title}” rated ${rated[0].avg} / 5` });
    const loud = this.videos.slice().sort((a, b) => b.reacts - a.reacts)[0];
    if (loud && loud.reacts >= 3) A.push({ key: 'riot', icon: '💥', title: 'Laugh Riot', id: loud.by, detail: `${loud.reacts} reactions on one video` });
    let hype = null; for (const [id, n] of this.sent) if (this.room.get(id) && n >= 5 && (!hype || n > hype.n)) hype = { id, n };
    if (hype) A.push({ key: 'hype', icon: '📣', title: 'Hype Machine', id: hype.id, detail: `sent ${hype.n} reactions` });
    const brave = this.videos.filter((v) => v.why === 'skipped').sort((a, b) => a.watched - b.watched)[0];
    if (brave) A.push({ key: 'brave', icon: '🫣', title: 'Bold Choice', id: brave.by, detail: `skipped after ${brave.watched}s. Respect.` });
    this.awards = A.filter((a) => this.room.get(a.id)).map((a) => ({ ...a, name: name(a.id) }));
  }
  startReel() {
    const top = (this.ranked || []).slice(0, this.s.reel || 0);
    if (!top.length) return this.over();
    // A countdown: last place first, the winner last.
    const clips = top.map((v, i) => ({ v, rank: i + 1 })).reverse();
    this.phase = 'reel'; this.reel = { clips, at: -1 };
    this.room.fx('drum');
    this.setTimer(REEL_INTRO_MS, () => this.nextClip());
  }
  clipFrom(v) { return v.src === 'youtube' ? (v.peak != null ? v.start + v.peak : v.start) : 0; }
  nextClip() {
    if (this.phase !== 'reel') return;
    const r = this.reel; r.at++;
    if (r.at >= r.clips.length) return this.over();
    const c = r.clips[r.at];
    this.room.fx(c.rank === 1 ? 'cheer' : 'reveal');
    this.setTimer(c.v.src === 'instagram' ? CARD_MS : CLIP_MS, () => this.nextClip());
  }
  over() {
    if (!this.ranked) { this.ranked = this.videos.slice(); this.giveAwards(); }
    this.phase = 'over'; this.endsAt = 0; this.room.cancel(this.timer); this.cur = null; this.room.fx('win');
  }
  results() { return this.standings().map((r) => r.id); }
  next() {
    if (this.phase === 'pick') this.pickTimeout(this.picker);
    else if (this.phase === 'play') this.finish('skipped');
    else if (this.phase === 'score') this.nextTurn();
    else if (this.phase === 'final') this.closeVote();
    else if (this.phase === 'reel') this.nextClip();
  }
  // The TV reports what its player is doing: playing (with the length), ended, or can't play.
  hostAct(m) {
    if (m.type !== 'video') return { ok: false, error: 'Unknown action.' };
    if (this.phase !== 'play' || !this.cur || String(m.id) !== this.cur.id) return { ok: false };
    const c = this.cur;
    if (m.ev === 'playing') {
      if (c.playAt) return { ok: true };
      c.playAt = this.room.now();
      // The time limit counts from when it really started; a shorter video ends on its own.
      const max = this.s.maxSeconds * 1000, dur = Number(m.dur);
      let ms = max, why = 'time';
      if (Number.isFinite(dur) && dur > 0) { const left = (dur - (c.start || 0)) * 1000 + END_GRACE_MS; if (left > 2000 && left < max) { ms = left; why = 'ended'; } }
      this.setTimer(ms, () => this.finish(why));
    } else if (m.ev === 'ended') this.finish('ended');
    else if (m.ev === 'error') this.cantPlayNow(String(m.code == null ? '' : m.code).slice(0, 12));
    else return { ok: false };
    return { ok: true };
  }

  // ---------- phone actions ----------
  act(p, m) {
    const c = this.cur, watching = this.phase === 'play' && c && p.id !== c.by;
    if (m.op === 'rate') {
      if (!watching) return { ok: false, error: 'Not now.' };
      const v = Math.round(Number(m.v)); if (!(v >= 1 && v <= 5)) return { ok: false, error: 'Rate 1–5.' };
      this.rate(p, v); return { ok: true };
    }
    if (m.op === 'react') {
      if (!watching) return { ok: false, error: this.phase === 'play' ? 'Let the others react to your video!' : 'Not now.' };
      const i = Number(m.e); if (!Number.isInteger(i) || i < 0 || i >= REACTS.length) return { ok: false, error: 'Pick a reaction.' };
      return this.react(p, i) ? { ok: true } : { ok: true, quiet: true };
    }
    if (m.op === 'skip') {
      if (!watching) return { ok: false, error: 'Not now.' };
      if (m.on === false) c.skips.delete(p.id); else c.skips.add(p.id);
      this.checkSkip(); return { ok: true };
    }
    if (m.op === 'done') { // "it's over": for videos the TV can't see end (Instagram) or that drag on
      if (this.phase !== 'play' || !c) return { ok: false, error: 'Nothing is playing.' };
      const vip = this.room.vip();
      if (c.by !== p.id && !(vip && vip.id === p.id)) return { ok: false, error: 'Only the host or the video’s owner can end it.' };
      this.finish('ended'); return { ok: true };
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
      if (!(vip && vip.id === p.id) && !(c && c.by === p.id)) return { ok: false, error: 'Only the host or the video’s owner can change the volume.' };
      if (m.mute != null) this.muted = !!m.mute;
      if (m.d) { this.vol = Math.max(0, Math.min(100, this.vol + Math.sign(Number(m.d) || 0) * 10)); this.muted = false; }
      return { ok: true };
    }
    if (m.op === 'skipReel') {
      const vip = this.room.vip();
      if (this.phase !== 'reel') return { ok: false, error: 'Not now.' };
      if (!(vip && vip.id === p.id)) return { ok: false, error: 'Only the host can skip the reel.' };
      this.over(); return { ok: true };
    }
    if (m.op === 'unqueue') { this.queued.delete(p.id); return { ok: true }; }
    return { ok: false, error: 'Unknown move.' };
  }
  // Picking and searching talk to YouTube/TikTok, so they answer later.
  async actAsync(p, m) {
    if (m.op === 'search') return this.search(clean(m.q, 80), !!m.shorts);
    if (m.op === 'pick') {
      if (this.closed()) return { ok: false, error: 'Picking is over for tonight.' };
      if (!this.turnsLeft(p.id)) return { ok: false, error: 'You don’t have a turn left.' };
      const raw = String(m.url || m.id || '').slice(0, 600);
      const problem = linkProblem(raw); if (problem) return { ok: false, error: problem };
      let link = parseLink(raw);
      if (link && link.short) {
        const real = await this.resolve(link.short); link = real ? parseLink(real) : null;
        if (!link || !link.id) return { ok: false, error: 'Couldn’t open that TikTok short link. Open the video in TikTok, tap Share → Copy link, and try again.' };
      }
      if (!link || !link.id) return { ok: false, error: 'That isn’t a video link. In the app, tap Share → Copy link, then paste it here.' };
      const key = link.src + ':' + link.id;
      if (this.videos.some((v) => v.key === key) || (this.cur && this.cur.key === key)) return { ok: false, error: 'That one already played tonight. Pick something new!' };
      for (const [id, q] of this.queued) if (id !== p.id && q.key === key) return { ok: false, error: 'Someone already lined that one up! Pick another.' };
      const info = await this.check(link);
      if (!info.ok) return info;
      // Things may have moved on while we were checking.
      if (!this.room.get(p.id) || this.closed()) return { ok: false, error: 'Too late: picking is over.' };
      if (!this.turnsLeft(p.id)) return { ok: false, error: 'You don’t have a turn left.' };
      const v = { key, src: link.src, id: link.id, start: link.start || 0, vertical: link.vertical || !!info.vertical, title: clean(info.title || m.title || `${SRC_NAME[link.src]} video`), channel: clean(info.channel || '', 40), thumb: info.thumb || (link.src === 'youtube' ? thumb(link.id) : null) };
      if (this.phase === 'pick' && this.picker === p.id) { this.room.cancel(this.timer); this.play(p.id, v); this.room.sync(); return { ok: true, queued: false, title: v.title }; }
      this.queued.set(p.id, v);
      this.maybeJump(); // the current picker has been searching a while: this one can go first
      this.room.sync();
      return { ok: true, queued: !(this.phase === 'play' && this.cur && this.cur.by === p.id && this.cur.key === key), title: v.title };
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
  // vm.tiktok.com short links redirect to the full video address. We read where it points
  // instead of following it, so the server never fetches anything but TikTok.
  async resolve(url) {
    if (!this.fetch) return null;
    const ctl = typeof AbortController === 'function' ? new AbortController() : null;
    const t = ctl && setTimeout(() => ctl.abort(), 4000);
    try {
      const r = await this.fetch(url, { redirect: 'manual', ...(ctl ? { signal: ctl.signal } : {}) });
      const loc = r.headers && typeof r.headers.get === 'function' ? r.headers.get('location') : null;
      if (loc) return new URL(loc, url).href;
      return r.url && r.url !== url ? r.url : null;
    } catch { return null; } finally { if (t) clearTimeout(t); }
  }
  // oEmbed: 401/403 = the owner turned embedding off; 404 = no such video. Network trouble: allow it.
  async check(link) {
    if (link.src === 'tiktok') {
      const r = await this.getJson(`https://www.tiktok.com/oembed?url=${encodeURIComponent('https://www.tiktok.com/@tiktok/video/' + link.id)}`);
      if (r.status === 400 || r.status === 404) return { ok: false, error: 'Couldn’t find that TikTok. It may be private or deleted.' };
      return { ok: true, title: r.body && r.body.title, channel: r.body && r.body.author_name, thumb: r.body && /^https:\/\//.test(r.body.thumbnail_url || '') ? r.body.thumbnail_url : null, vertical: true };
    }
    if (link.src === 'instagram') return { ok: true, title: 'Instagram Reel', vertical: true }; // Instagram shares no details without a Facebook app token
    const id = link.id;
    const r = await this.getJson(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent('https://www.youtube.com/watch?v=' + id)}`);
    if (r.status === 401 || r.status === 403) return { ok: false, error: 'That video can’t be played on the TV (its owner blocks it). Pick another.' };
    if (r.status === 404 || r.status === 400) return { ok: false, error: 'Couldn’t find that video. It may be private or deleted.' };
    return { ok: true, title: r.body && r.body.title, channel: r.body && r.body.author_name, thumb: thumb(id), vertical: link.vertical || !!(r.body && r.body.height > r.body.width) };
  }
  async search(q, shorts) {
    if (!this.key) return { ok: false, noKey: true, error: 'In-game search needs a YouTube API key. Use the search buttons and paste the link.' };
    if (!q.trim()) return { ok: true, results: [] };
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoEmbeddable=true&maxResults=12${shorts ? '&videoDuration=short' : ''}&safeSearch=${this.s.safe ? 'strict' : 'none'}&q=${encodeURIComponent(q)}&key=${encodeURIComponent(this.key)}`;
    const r = await this.getJson(url, 6000);
    if (r.status === 403 || r.status === 429) return { ok: false, error: 'YouTube search is used up for today. Use the search buttons and paste a link.' };
    if (!r.body) return { ok: false, error: 'YouTube search isn’t answering right now. Try pasting a link.' };
    const played = new Set(this.videos.map((v) => v.key));
    return { ok: true, results: (r.body.items || []).filter((x) => x.id && x.id.videoId && /^[A-Za-z0-9_-]{11}$/.test(x.id.videoId)).map((x) => ({ src: 'youtube', id: x.id.videoId, title: clean(x.snippet && x.snippet.title), channel: clean(x.snippet && x.snippet.channelTitle, 40), thumb: thumb(x.id.videoId), played: played.has('youtube:' + x.id.videoId) })) };
  }

  // ---------- screens ----------
  standings() { return [...this.points].filter(([id]) => this.room.get(id)).map(([id, pts]) => ({ id, name: this.room.name(id), points: pts })).sort((a, b) => b.points - a.points); }
  queueView() {
    if (this.closed()) return { list: [], more: 0 };
    const up = this.ahead().filter((id) => this.room.get(id)), list = [];
    up.forEach((id, i) => { if (list.length < 8) list.push({ name: this.room.name(id), ready: this.queued.has(id), now: this.phase === 'pick' && i === 0 }); });
    return { list, more: Math.max(0, up.length - list.length) };
  }
  curView() {
    const c = this.cur; if (!c) return null;
    const vals = [...c.ratings.values()];
    return { id: c.id, src: c.src, start: c.start || 0, vertical: c.vertical, thumb: c.thumb, title: c.title, channel: c.channel, by: this.room.name(c.by), avg: round1(avgOf(vals)), votes: vals.length, skips: c.skips.size, need: this.skipNeed(), elapsed: this.room.now() - (c.playAt || c.started), max: this.s.maxSeconds * 1000, playing: !!c.playAt, heat: this.heat(), reacts: c.reacts };
  }
  pubVideo(v, p) { const o = { n: v.n, id: v.id, src: v.src, thumb: v.thumb, vertical: v.vertical, title: v.title, channel: v.channel, by: this.room.name(v.by), avg: v.avg, votes: v.votes, why: v.why, pts: v.pts, reacts: v.reacts, final: v.final }; if (p) o.mine = v.by === p.id; return o; }
  reelView() {
    const r = this.reel; if (!r || this.phase !== 'reel') return null;
    const c = r.at >= 0 ? r.clips[r.at] : null;
    return { at: r.at, of: r.clips.length, clip: c ? { ...this.pubVideo(c.v), rank: c.rank, from: this.clipFrom(c.v), peakN: c.v.peakN } : null };
  }
  endsIn() { return this.endsAt ? Math.max(0, this.endsAt - this.room.now()) : 0; }
  tv() {
    const showList = this.phase === 'final' || this.phase === 'over';
    return {
      phase: this.phase, endsIn: this.endsIn(), n: this.turn + 1, of: this.order.length, played: this.videos.length,
      picker: this.picker ? this.room.name(this.picker) : null, picking: this.phase === 'pick' ? this.room.now() - this.pickStart : 0,
      cantPlay: this.cantPlay && this.phase === 'pick' && this.picker === this.cantPlay.by ? { name: this.room.name(this.cantPlay.by), why: this.cantPlay.why } : null,
      upNext: this.queueView().list.slice(this.phase === 'pick' ? 1 : 0, this.phase === 'pick' ? 4 : 3), queue: this.queueView(),
      cur: this.phase === 'play' ? this.curView() : null, last: this.phase === 'score' && this.last ? this.pubVideo(this.last) : null,
      videos: showList ? (this.phase === 'over' ? this.ranked : this.videos).map((v) => this.pubVideo(v)) : [],
      finalVoted: this.finalVotes.size, voters: this.phase === 'final' ? this.voters().length : 0,
      waiting: this.phase === 'final' ? this.voters().filter((p) => !p.bot && !this.finalVotes.has(p.id)).slice(0, 12).map((p) => p.name) : [],
      reel: this.reelView(), awards: this.phase === 'over' ? this.awards : [],
      standings: this.standings().slice(0, 10), rate: RATE, reacts: REACTS, vol: this.vol, muted: this.muted,
    };
  }
  view(p) {
    const st = this.standings(), c = this.cur;
    return {
      phase: this.phase, endsIn: this.endsIn(), n: this.turn + 1, of: this.order.length, played: this.videos.length,
      myTurn: this.phase === 'pick' && this.picker === p.id, picker: this.picker ? this.room.name(this.picker) : null,
      cantPlay: this.cantPlay && this.cantPlay.by === p.id ? this.cantPlay.why : null, jumped: this.jumped === p.id,
      turnsAway: this.turnsAway(p.id), queued: this.queued.get(p.id) || null, upNext: this.queueView().list.slice(0, 4),
      search: !!this.key, cur: this.phase === 'play' && c ? { ...this.curView(), mine: c.by === p.id, myRating: c.ratings.get(p.id) || 0, mySkip: c.skips.has(p.id) } : null,
      last: this.phase === 'score' && this.last ? this.pubVideo(this.last, p) : null,
      videos: this.phase === 'final' || this.phase === 'over' ? (this.phase === 'over' ? this.ranked : this.videos).map((v) => this.pubVideo(v, p)) : [],
      myFinal: this.finalVotes.get(p.id) || null, finalVoted: this.finalVotes.size, voters: this.phase === 'final' ? this.voters().length : 0,
      reel: this.reelView(), awards: this.phase === 'over' ? this.awards.filter((a) => a.id === p.id) : [],
      rate: RATE, reacts: REACTS, vol: this.vol, muted: this.muted,
      points: this.points.get(p.id) || 0, rank: st.findIndex((x) => x.id === p.id) + 1, of2: st.length, final: this.phase === 'over' ? st.slice(0, 10) : null,
    };
  }
}

// Party Mode: settings that fit the players in the room and this game's minutes in the plan (box/party-fit.js).
const PF = require('../party-fit');
const partyFit = ({ players: P, minutes: M }) => {
  const maxSeconds = M <= 7 ? 60 : M >= 18 ? 120 : 90, per = (maxSeconds / 60) * 0.8 + 0.6;
  const { maxVideos, turns } = PF.best({ maxVideos: [12, 8, 20, 40], turns: [1, 2, 3] }, (s) => 1 + Math.min(s.maxVideos, s.turns * P) * per, M);
  return { maxVideos, turns, maxSeconds, pickSeconds: M <= 7 ? 45 : 60, reel: M <= 7 ? 0 : 3 };
};

module.exports = {
  partyFit,
  key: 'funny', name: 'JustFunny', min: 2, best: [3, 12], fields, defaults,
  create: (room, settings) => new Funny(room, settings),
  _test: { videoId, parseLink, linkProblem, startTime, Funny, thumb, REACTS, CLIP_MS },
};
