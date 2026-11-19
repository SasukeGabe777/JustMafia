'use strict';
// Tune Buzz (key `tune`): name that tune, with songs the players bring.
//
//   submit  Everyone adds songs from their phone (search, or paste a Spotify link). The submitter
//           hears the 30-second preview and picks WHICH few seconds the room will hear.
//   card    "Song 3 of 8: Ana's pick" (3.5 s).
//   guess   The TV plays the clip; each replay is longer (and the points tick down). Phones type
//           the title (+ the artist for a bonus). The submitter sits this one out.
//   reveal  Art, title and artist; the song plays on. Everyone but the submitter rates how hard
//           it was: 1 🍼 Too easy … 5 🔥 Impossible.
//   score   Guessers: speed points × the room's average difficulty. The submitter: the sweet
//           spot pays (some but not all got it), plus the same difficulty multiplier.
//
// Song lookup is in box/songs.js (Spotify search when keys are set, else iTunes; free 30 s
// previews from iTunes or Deezer). Bots pick from BOT_SONGS below (no network in tests; on the
// live server their previews are looked up in the background).
const LIB = require('../songs');
// Per-game gear (JustGold shop): each player's buzzer rides along in who() (TV chips) and view().gear (phone).
const GEARS = require('../../public/shared/gear');

const opt = (pairs) => pairs.map(([value, label]) => ({ value, label }));
const fields = [
  { key: 'songs', label: 'Songs per player', options: opt([[1, '1 song each'], [2, '2 songs each'], [3, '3 songs each']]) },
  { key: 'clip', label: 'First listen', options: opt([[2, '2 seconds'], [4, '4 seconds'], [6, '6 seconds']]) },
  { key: 'time', label: 'Time to guess', options: opt([[20, '20 seconds'], [30, '30 seconds'], [45, '45 seconds']]) },
];
const defaults = { songs: 2, clip: 4, time: 30 };

const SUBMIT_MS = 180000, CARD_MS = 3500, LEAD_MS = 1200, REVEAL_MS = 15000, MIN_REVEAL_MS = 7000, SCORE_MS = 8000;
const LISTENS = 3, MAX_SONGS = 16, MAX_TRIES = 6, MAX_GUESS = 80, GUESS_GAP_MS = 400;
const SINGER_TRIES = 3;
const TOP = 300, BOTTOM = 100, ARTIST_BONUS = 50, SWEET = 150, EASY = 50;
const PREVIEW_S = 30;
const RATES = [
  { n: 1, icon: '🍼', label: 'Too easy' }, { n: 2, icon: '🙂', label: 'Easy' }, { n: 3, icon: '🤔', label: 'Tricky' },
  { n: 4, icon: '😰', label: 'Hard' }, { n: 5, icon: '🔥', label: 'Impossible' },
];
// What the bots bring (title + artist only: the live server finds a preview for each).
const BOT_SONGS = [
  ['Bohemian Rhapsody', 'Queen'], ['Billie Jean', 'Michael Jackson'], ['Hey Ya!', 'OutKast'], ['Mr. Brightside', 'The Killers'],
  ['Dancing Queen', 'ABBA'], ['Shake It Off', 'Taylor Swift'], ['Uptown Funk (feat. Bruno Mars)', 'Mark Ronson'], ['Rolling in the Deep', 'Adele'],
  ['Smells Like Teen Spirit', 'Nirvana'], ["Don't Stop Believin'", 'Journey'], ['Africa', 'Toto'], ['Happy', 'Pharrell Williams'],
  ['bad guy', 'Billie Eilish'], ['Blinding Lights', 'The Weeknd'], ['Wannabe', 'Spice Girls'], ['Sweet Caroline', 'Neil Diamond'],
  ["Livin' on a Prayer", 'Bon Jovi'], ['Toxic', 'Britney Spears'], ['Crazy in Love (feat. Jay-Z)', 'Beyoncé'], ['Take on Me', 'a-ha'],
  ['Wonderwall', 'Oasis'], ['Levitating', 'Dua Lipa'], ['Seven Nation Army', 'The White Stripes'], ['I Wanna Dance with Somebody', 'Whitney Houston'],
].map(([title, artist], i) => ({ id: 'bot:' + i, title, artist, album: '', art: null, preview: null, explicit: false, source: 'bot' }));

// ---------- fuzzy matching ----------
// Case, accents, punctuation, "feat. …", (brackets), " - Remastered 2011", "&"/"and" and a
// leading "The" don't matter; small typos are forgiven (more for longer titles).
function base(s) {
  return String(s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[’‘`´]/g, "'").replace(/&/g, ' and ').replace(/\+/g, ' and ');
}
const tidy = (s) => s.replace(/'/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim().replace(/^the /, '');
const dropFeat = (s) => s.replace(/\s(?:feat\.?|ft\.?|featuring)\s.*$/, '');
// Every fair way to say a title: with and without brackets and dash tails.
function titleForms(title) {
  const b = base(title), out = new Set();
  out.add(tidy(dropFeat(b.replace(/\s*[([{][^)\]}]*[)\]}]/g, ' ').replace(/\s+-\s+.*$/, ''))));
  out.add(tidy(dropFeat(b.replace(/\s+-\s+.*$/, '').replace(/[()[\]{}]/g, ' '))));
  out.add(tidy(dropFeat(b.replace(/[()[\]{}]/g, ' '))));
  return [...out].filter(Boolean);
}
function artistForms(artist) {
  const b = base(artist), out = new Set([tidy(dropFeat(b))]);
  const first = b.split(/,| x | feat\.? | ft\.? | featuring | and (?=.)/)[0];
  if (first && first.trim().length >= 2) out.add(tidy(first));
  return [...out].filter((x) => x && x.length >= 2);
}
function lev(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]; let lo = i;
    for (let j = 1; j <= b.length; j++) { cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); if (cur[j] < lo) lo = cur[j]; }
    if (lo > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}
const tolerance = (n) => (n <= 3 ? 0 : n <= 6 ? 1 : n <= 12 ? 2 : 3);
function close(g, t) {
  if (!g || !t) return false;
  if (g === t) return true;
  const gs = g.replace(/ /g, ''), ts = t.replace(/ /g, '');
  if (gs === ts) return true;
  return lev(gs, ts, tolerance(ts.length)) <= tolerance(ts.length);
}
// What a guess could mean once an artist name (and "by") is taken out of it.
function guessForms(text, artist) {
  const g = tidy(dropFeat(base(text))), out = new Set([g]);
  for (const a of artistForms(artist)) {
    const re = new RegExp(`(^| )(by )?${a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}( |$)`);
    if (re.test(g)) out.add(tidy(g.replace(re, ' ').replace(/(^| )by( |$)/, ' ')));
  }
  for (const part of base(text).split(/\s+[-–—/|]\s+|\s+by\s+/)) out.add(tidy(dropFeat(part)));
  return [...out].filter(Boolean);
}
function matchTitle(text, title, artist) {
  const T = titleForms(title), G = guessForms(text, artist);
  if (G.some((g) => T.some((t) => close(g, t)))) return true;
  // The whole title inside a longer guess counts too ("shape of you ed sheeran"), for titles of 5+ letters.
  return G.some((g) => T.some((t) => t.replace(/ /g, '').length >= 5 && ` ${g} `.includes(` ${t} `)));
}
function matchArtist(text, artist) {
  const A = artistForms(artist), g = tidy(dropFeat(base(text)));
  const parts = [g, ...base(text).split(/\s+[-–—/|]\s+|\s+by\s+/).map((p) => tidy(p))];
  return parts.some((p) => A.some((a) => close(p, a))) || A.some((a) => a.length >= 4 && new RegExp(`(^| )${a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}( |$)`).test(g));
}
const round10 = (n) => Math.round(n / 10) * 10;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

class Game {
  constructor(room, s, deps = {}) {
    this.room = room;
    const pick = (v, list, d) => (list.includes(Number(v)) ? Number(v) : d);
    this.s = { songs: pick(s.songs, [1, 2, 3], 2), clip: pick(s.clip, [2, 4, 6], 4), time: pick(s.time, [20, 30, 45], 30) };
    this.lib = deps.lib || LIB;
    // The live server looks songs up on the internet; rules tests never do.
    this.live = deps.live != null ? !!deps.live : !!room.nsp;
    this.phase = 'submit'; this.endsAt = 0; this.timer = null;
    this.subs = new Map(); // player id -> [entry]
    this.seq = 0; this.list = []; this.idx = -1; this.cur = null; this.final = null;
    this.points = new Map(); this.stats = new Map(); this.lastGuess = new Map(); this.history = [];
  }
  rint(n) { return Math.floor(this.room.rng() * n); }
  shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = this.rint(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  setTimer(ms, fn) { this.room.cancel(this.timer); this.endsAt = this.room.now() + ms; this.timer = this.room.after(ms, fn); }
  stat(id) { let s = this.stats.get(id); if (!s) { s = { named: 0, fastest: null, dj: 0, artists: 0 }; this.stats.set(id, s); } return s; }
  add(id, n) { this.points.set(id, (this.points.get(id) || 0) + n); }
  active() { return this.room.list().filter((p) => p.bot || p.sockets > 0); }
  joined(p) { if (!this.points.has(p.id)) { this.points.set(p.id, 0); this.stat(p.id); } }
  left() { this.check(); }
  maxStart() { return PREVIEW_S - this.s.clip; }

  // ---------- submit ----------
  start() {
    for (const p of this.room.list()) this.joined(p);
    this.phase = 'submit';
    this.setTimer(SUBMIT_MS, () => this.startPlay());
    const pool = this.shuffle(BOT_SONGS);
    for (const p of this.room.list()) if (p.bot) {
      for (let k = 0; k < this.s.songs; k++) {
        this.room.after(1500 + this.rint(6000) + k * 2500, () => {
          if (this.phase !== 'submit') return;
          const used = new Set([...this.allEntries()].map((e) => e.song.id));
          const song = pool.find((x) => !used.has(x.id)); if (!song) return;
          this.addEntry(p, { ...song }, 2 + this.rint(Math.max(1, this.maxStart() - 6)));
        });
      }
    }
  }
  *allEntries() { for (const l of this.subs.values()) yield* l; }
  mine(id) { return this.subs.get(id) || []; }
  addSong(p, id, start) {
    if (this.phase !== 'submit') return { ok: false, error: 'Song requests are closed.' };
    if (typeof id !== 'string' || !id || id.length > 64) return { ok: false, error: 'Pick a song from the search results.' };
    const song = this.lib.get(id);
    if (!song) return { ok: false, error: 'Search again and pick a song from the list.' };
    if (!song.preview) return { ok: false, error: 'That song has no preview to play. Pick another!' };
    if (this.room.filterOn && song.explicit) return { ok: false, error: 'The family filter is on: pick a clean version (no 🅴).' };
    const st = Number(start);
    if (!Number.isFinite(st) || st < 0 || st > this.maxStart()) return { ok: false, error: `Pick a start between 0 and ${this.maxStart()} seconds.` };
    return this.addEntry(p, { id: song.id, title: song.title, artist: song.artist, album: song.album || '', art: song.art || null, preview: song.preview, explicit: !!song.explicit, source: song.previewFrom || song.source }, st);
  }
  addEntry(p, song, start) {
    const list = this.mine(p.id);
    if (list.length >= this.s.songs) return { ok: false, error: `You already added ${this.s.songs} song${this.s.songs === 1 ? '' : 's'}. Remove one to swap it.` };
    const key = (x) => titleForms(x.title)[0] + '|' + artistForms(x.artist)[0];
    for (const e of this.allEntries()) if (e.song.id === song.id || key(e.song) === key(song)) return { ok: false, error: e.by === p.id ? 'You already added that one!' : 'Someone already added that song! Pick another.' };
    const e = { key: 'e' + (++this.seq), by: p.id, song, start: Math.round(start * 10) / 10, at: this.room.now() };
    list.push(e); this.subs.set(p.id, list);
    this.room.fx('added', { id: p.id });
    if (this.live && !song.preview && song.source === 'bot') this.findBotPreview(e);
    this.check();
    return { ok: true, key: e.key };
  }
  // A bot's song: look up a preview (and album art) in the background.
  findBotPreview(e) {
    Promise.resolve().then(() => this.lib.resolveMeta(e.song.title, e.song.artist)).then((m) => {
      if (m && m.preview) { e.song.preview = m.preview; e.song.art = m.art || null; e.song.album = m.album || ''; e.song.source = m.source; e.song.ref = m.id; this.room.sync(); }
    }).catch(() => {});
  }
  removeSong(p, key) {
    if (this.phase !== 'submit') return { ok: false, error: 'Song requests are closed.' };
    const list = this.mine(p.id), i = list.findIndex((e) => e.key === key);
    if (i < 0) return { ok: false, error: 'That song isn’t on your list.' };
    list.splice(i, 1);
    return { ok: true };
  }
  submitDone() {
    const act = this.active();
    return act.length > 0 && act.every((p) => this.mine(p.id).length >= this.s.songs);
  }
  // The playlist: one song from each player in turn (shuffled), so nobody's songs bunch up.
  startPlay() {
    if (this.phase !== 'submit') return;
    const queues = this.shuffle([...this.subs.entries()].filter(([id]) => this.room.get(id)).map(([, l]) => l.filter((e) => !this.live || e.song.preview)));
    const out = [];
    for (let r = 0; out.length < MAX_SONGS; r++) { let any = false; for (const q of queues) if (q[r]) { any = true; if (out.length < MAX_SONGS) out.push(q[r]); } if (!any) break; }
    this.list = out;
    if (!out.length) return this.end(true);
    this.idx = -1;
    this.nextSong();
  }

  // ---------- one song ----------
  nextSong() {
    if (this.idx + 1 >= this.list.length) return this.end();
    this.idx++;
    const e = this.list[this.idx];
    this.cur = { e, got: new Map(), tries: new Map(), singerTries: new Map(), artist: new Set(), wrong: [], ratings: new Map(), result: null };
    this.phase = 'card';
    if (this.live) Promise.resolve().then(() => this.lib.refresh(e.song)).catch(() => {});
    this.room.fx('round');
    this.setTimer(CARD_MS, () => this.startGuess());
  }
  listens() {
    const c = this.cur, gap = (this.s.time * 1000) / LISTENS;
    return Array.from({ length: LISTENS }, (_, k) => ({ at: c.t0 + Math.round(k * gap), len: Math.round(Math.min(this.s.clip * (k + 1) * 1000, gap - 800)) }));
  }
  startGuess() {
    if (this.phase !== 'card') return;
    const c = this.cur, now = this.room.now();
    c.t0 = now + LEAD_MS; c.end = c.t0 + this.s.time * 1000;
    this.phase = 'guess'; this.room.fx('clip');
    this.setTimer(c.end - now, () => this.reveal());
    this.botsGuess();
    this.check();
  }
  worth(at = this.room.now()) { const c = this.cur; if (!c || c.t0 == null) return TOP; const f = clamp((at - c.t0) / (this.s.time * 1000), 0, 1); return round10(TOP - (TOP - BOTTOM) * f); }
  guessers() { const by = this.cur ? this.cur.e.by : null; return this.active().filter((p) => p.id !== by); }
  doneGuessing(id) { const c = this.cur; return c.got.has(id) || (c.tries.get(id) || 0) >= MAX_TRIES; }
  check() {
    if (this.phase === 'submit' && this.submitDone()) { if (!this.allIn) { this.allIn = true; this.setTimer(1500, () => this.startPlay()); } }
    else if (this.phase === 'guess' && this.guessers().every((p) => this.doneGuessing(p.id))) this.reveal();
    else if (this.phase === 'reveal') this.maybeScore();
  }
  // A guess: the song title (text) and/or the singer (singer, its own box on the phone for a
  // bonus). Title guesses use up the 6 tries; singer guesses have their own 3.
  guess(p, text, singer) {
    const c = this.cur, now = this.room.now();
    if (this.phase === 'card') return { ok: false, error: 'Wait for the music!' };
    if (this.phase !== 'guess' || !c) return { ok: false, error: 'No guessing right now.' };
    if (c.e.by === p.id) return { ok: false, error: 'That’s your song! No guessing your own 😉' };
    const clean = (x) => (typeof x === 'string' ? x.replace(/[\u0000-\u001f]/g, ' ').trim() : '');
    text = clean(text); singer = clean(singer);
    if (text.length > MAX_GUESS || singer.length > MAX_GUESS) return { ok: false, error: `Too long! ${MAX_GUESS} letters max.` };
    if (c.got.has(p.id)) text = ''; // already named the title: only the singer box is left
    if (c.artist.has(p.id)) singer = '';
    if (!text && !singer) return { ok: false, error: c.got.has(p.id) ? 'You already got it!' : 'Type the song title.' };
    const tries = c.tries.get(p.id) || 0, sTries = c.singerTries.get(p.id) || 0;
    if (text && tries >= MAX_TRIES) { if (!singer) return { ok: false, error: 'Out of guesses for this song.' }; text = ''; }
    if (singer && sTries >= SINGER_TRIES) { if (!text) return { ok: false, error: 'Out of singer guesses.' }; singer = ''; }
    const last = this.lastGuess.get(p.id) || 0;
    if (now - last < GUESS_GAP_MS) return { ok: false, error: 'Easy! One guess at a time.', quiet: true };
    this.lastGuess.set(p.id, now);
    const song = c.e.song, st = this.stat(p.id);
    let artist = false, singerWrong = false;
    const bonus = () => { c.artist.add(p.id); this.add(p.id, ARTIST_BONUS); st.artists++; artist = true; };
    if (singer) { c.singerTries.set(p.id, sTries + 1); if (matchArtist(singer, song.artist)) bonus(); else singerWrong = true; }
    if (!text) {
      if (artist) this.room.fx('artist', { id: p.id });
      this.check();
      return { ok: true, right: c.got.has(p.id), artist, singerWrong, singerLeft: SINGER_TRIES - (c.singerTries.get(p.id) || 0) };
    }
    c.tries.set(p.id, tries + 1);
    // The title box can name the singer too ("toxic by britney spears").
    if (!c.artist.has(p.id) && matchArtist(text, song.artist)) bonus();
    if (matchTitle(text, song.title, song.artist)) {
      const ms = Math.max(0, now - c.t0), pts = this.worth(now);
      c.got.set(p.id, { at: now, ms, base: pts, order: c.got.size + 1 });
      st.named++; if (st.fastest == null || ms < st.fastest) st.fastest = ms;
      this.room.fx('right', { id: p.id });
      this.check();
      return { ok: true, right: true, base: pts, artist, singerWrong, singerLeft: SINGER_TRIES - (c.singerTries.get(p.id) || 0) };
    }
    if (c.wrong.length < 40) c.wrong.push({ id: p.id, text: text.slice(0, 40) });
    if (artist) this.room.fx('artist', { id: p.id });
    this.check();
    return { ok: true, right: false, artist, singerWrong, left: MAX_TRIES - tries - 1, singerLeft: SINGER_TRIES - (c.singerTries.get(p.id) || 0) };
  }
  botsGuess() {
    const c = this.cur, T = this.s.time * 1000, others = BOT_SONGS.filter((x) => x.title !== c.e.song.title);
    for (const p of this.room.list()) {
      if (!p.bot || p.id === c.e.by) continue;
      const know = this.room.rng() < 0.6, when = 600 + this.room.rng() * T * 0.85;
      if (this.room.rng() < 0.5) this.room.after(c.t0 - this.room.now() + this.room.rng() * when, () => { if (this.phase === 'guess' && !c.got.has(p.id)) this.guess(p, others[this.rint(others.length)].title); });
      if (know) this.room.after(c.t0 - this.room.now() + when, () => {
        if (this.phase !== 'guess' || c.got.has(p.id)) return;
        let t = c.e.song.title.replace(/\s*\(.*\)/, '');
        if (this.room.rng() < 0.3 && t.length > 7) { const k = 1 + this.rint(t.length - 2); t = t.slice(0, k) + t.slice(k + 1); } // a typo
        if (this.room.rng() < 0.3) t += ' ' + c.e.song.artist;
        this.guess(p, this.room.rng() < 0.5 ? t.toLowerCase() : t);
      });
    }
  }
  reveal() {
    if (this.phase !== 'guess') return;
    const c = this.cur;
    this.phase = 'reveal'; c.revealAt = this.room.now();
    this.room.fx(c.got.size ? 'reveal' : 'nobody');
    this.setTimer(REVEAL_MS, () => this.score());
    this.room.after(MIN_REVEAL_MS + 20, () => this.maybeScore());
    const eligible = Math.max(1, this.guessers().length);
    for (const p of this.room.list()) if (p.bot && p.id !== c.e.by) {
      const f = c.got.size / eligible, guess = 1 + 4 * (1 - f) + (this.room.rng() - 0.5) * 2;
      this.room.after(1500 + this.room.rng() * 5000, () => { if (this.phase === 'reveal' && this.cur === c) this.rate(p, clamp(Math.round(guess), 1, 5)); });
    }
  }
  raters() { return this.guessers(); }
  rate(p, n) {
    const c = this.cur;
    if (this.phase !== 'reveal' || !c) return { ok: false, error: 'No rating right now.' };
    if (c.e.by === p.id) return { ok: false, error: 'You can’t rate your own song!' };
    if (typeof n !== 'number' || !Number.isInteger(n) || n < 1 || n > 5) return { ok: false, error: 'Rate it from 1 to 5.' };
    c.ratings.set(p.id, n);
    this.maybeScore();
    return { ok: true };
  }
  maybeScore() {
    const c = this.cur;
    if (this.phase !== 'reveal' || this.room.now() - c.revealAt < MIN_REVEAL_MS) return;
    if (this.raters().every((p) => c.ratings.has(p.id))) this.score();
  }
  // The difficulty: the room's average rating (1–5). Nobody rated? Then it follows how many got it.
  difficulty() {
    const c = this.cur, r = [...c.ratings.values()];
    if (r.length) return { d: Math.round((r.reduce((a, b) => a + b, 0) / r.length) * 10) / 10, auto: false, votes: r.length };
    const eligible = Math.max(1, this.guessers().length, c.got.size);
    return { d: Math.round((1 + 4 * (1 - c.got.size / eligible)) * 10) / 10, auto: true, votes: 0 };
  }
  // The submitter: the sweet spot (some got it, not everyone) pays the most.
  verdict(got, eligible) {
    if (!got) return { kind: 'nobody', mult: 0 };
    if (eligible >= 2 && got >= eligible) return { kind: 'easy', mult: EASY };
    return { kind: 'sweet', mult: SWEET };
  }
  score() {
    if (this.phase !== 'reveal') return;
    const c = this.cur, D = this.difficulty();
    const eligible = Math.max(c.got.size, this.guessers().length, c.tries.size);
    const rows = [...c.got].sort((a, b) => a[1].at - b[1].at).map(([id, g]) => {
      const total = round10(g.base * D.d); this.add(id, total);
      return { ...this.who(id), base: g.base, ms: g.ms, total, artist: c.artist.has(id) };
    });
    const v = this.verdict(c.got.size, eligible), dj = round10(v.mult * D.d);
    if (dj) { this.add(c.e.by, dj); this.stat(c.e.by).dj += dj; }
    c.result = { d: D.d, auto: D.auto, votes: D.votes, counts: [1, 2, 3, 4, 5].map((n) => [...c.ratings.values()].filter((x) => x === n).length), rows, got: c.got.size, eligible, dj: { ...this.who(c.e.by), kind: v.kind, mult: v.mult, pts: dj } };
    this.history.push({ title: c.e.song.title, artist: c.e.song.artist, by: c.e.by, d: D.d, got: c.got.size, eligible, fastest: rows[0] ? { id: rows[0].id, ms: rows[0].ms } : null });
    this.phase = 'score'; this.room.fx(v.kind === 'sweet' ? 'sweet' : 'score');
    this.setTimer(SCORE_MS, () => this.nextSong());
  }

  // ---------- the end ----------
  end(empty = false) {
    this.phase = 'over'; this.endsAt = 0; this.room.cancel(this.timer); this.cur = null;
    const ids = [...this.points.keys()].filter((id) => this.room.get(id));
    const top = (fn, low = false) => {
      let best = null, who = [];
      for (const id of ids) { const v = fn(this.stat(id)); if (v == null || (!low && v <= 0)) continue; if (best == null || (low ? v < best : v > best)) { best = v; who = [id]; } else if (v === best) who.push(id); }
      return who.length ? { names: who.slice(0, 3).map((id) => this.room.name(id)), value: best } : null;
    };
    const deep = this.history.filter((h) => h.got > 0).sort((a, b) => b.d - a.d)[0] || null;
    this.final = {
      empty, songs: this.history.length, standings: this.standings(),
      awards: {
        ear: top((s) => s.named),
        fast: top((s) => s.fastest, true),
        dj: top((s) => s.dj),
        deep: deep ? { title: deep.title, artist: deep.artist, name: this.room.name(deep.by), d: deep.d } : null,
      },
    };
    this.room.fx('win');
  }
  highlights() {
    const out = [];
    const fast = this.history.filter((h) => h.fastest).sort((a, b) => a.fastest.ms - b.fastest.ms)[0];
    if (fast) out.push({ icon: '⚡', text: `${this.room.name(fast.fastest.id)} named “${fast.title}” in ${(fast.fastest.ms / 1000).toFixed(1)} s` });
    const deep = this.final && this.final.awards.deep;
    if (deep) out.push({ icon: '🔥', text: `Deepest cut: “${deep.title}” from ${deep.name} (difficulty ${deep.d})` });
    return out;
  }
  next() {
    if (this.phase === 'submit') { if ([...this.allEntries()].length) { this.room.cancel(this.timer); this.startPlay(); } return; }
    if (this.phase === 'card') { this.room.cancel(this.timer); return this.startGuess(); }
    if (this.phase === 'guess') return this.reveal();
    if (this.phase === 'reveal') return this.score();
    if (this.phase === 'score') return this.nextSong();
  }
  who(id) { const p = this.room.get(id); return { id, name: this.room.name(id), avatar: p ? p.avatar : '🙂', color: p ? p.color : '#888', gear: GEARS.gearSet(p, 'tune') }; }
  standings() { return [...this.points].filter(([id]) => this.room.get(id)).map(([id, pts]) => ({ ...this.who(id), points: pts })).sort((a, b) => b.points - a.points || a.name.localeCompare(b.name)); }
  results() { return this.phase === 'over' ? this.standings().map((r) => r.id) : []; }

  act(p, m) {
    if (!m || typeof m !== 'object') return { ok: false, error: 'Unknown move.' };
    if (this.phase === 'over') return { ok: false, error: 'The game is over.' };
    if (!this.points.has(p.id)) this.joined(p);
    if (m.op === 'add') return this.addSong(p, m.id, m.start);
    if (m.op === 'remove') return this.removeSong(p, m.key);
    if (m.op === 'guess') return this.guess(p, m.text, m.singer);
    if (m.op === 'rate') return this.rate(p, m.n);
    return { ok: false, error: 'Unknown move.' };
  }
  // Searching takes a moment (the phone's player:async channel).
  async actAsync(p, m) {
    if (!m || typeof m !== 'object') return { ok: false, error: 'Unknown move.' };
    if (this.phase !== 'submit') return { ok: false, error: 'Song requests are closed.' };
    const pub = (s) => ({ id: s.id, title: s.title, artist: s.artist, album: s.album || '', art: s.art || null, preview: s.preview || null, explicit: !!s.explicit });
    if (m.op === 'search') {
      if (typeof m.q !== 'string') return { ok: false, error: 'Type a song or an artist.' };
      const q = m.q.trim();
      const r = this.lib.isLink(q) ? await this.lib.fromLink(q) : await this.lib.search(q);
      return r.ok ? { ok: true, results: r.results.map(pub), note: r.note || null, spotify: r.source === 'spotify' } : r;
    }
    if (m.op === 'pick') {
      if (typeof m.id !== 'string' || m.id.length > 64) return { ok: false, error: 'Pick a song from the list.' };
      const r = await this.lib.pick(m.id);
      return r.ok ? { ok: true, song: pub(r.song) } : r;
    }
    return { ok: false, error: 'Unknown move.' };
  }

  // ---------- screens ----------
  songPublic(s) { return { title: s.title, artist: s.artist, album: s.album || '', art: s.art || null, explicit: !!s.explicit }; }
  base() {
    const now = this.room.now();
    return { phase: this.phase, n: this.idx + 1, of: this.list.length, now, endsIn: this.endsAt ? Math.max(0, this.endsAt - now) : 0, clip: this.s.clip, time: this.s.time, quota: this.s.songs, maxStart: this.maxStart(), rates: RATES };
  }
  // The clip timing (relative to now) for the screens; only the TV gets what to play.
  clipInfo(tv) {
    const c = this.cur; if (!c || c.t0 == null) return null;
    const now = this.room.now();
    const out = { t0In: c.t0 - now, endIn: c.end - now, listens: this.listens().map((l) => ({ atIn: l.at - now, len: l.len })), worth: this.worth() };
    if (tv) out.play = { preview: c.e.song.preview, start: c.e.start };
    return out;
  }
  tv() {
    const st = this.standings().slice(0, 10), base = this.base(), c = this.cur;
    if (this.phase === 'submit') {
      const act = this.room.list();
      return { ...base, standings: st, total: [...this.allEntries()].length, players: act.map((p) => ({ ...this.who(p.id), n: this.mine(p.id).length, online: p.bot || p.sockets > 0 })).slice(0, 40) };
    }
    if (this.phase === 'over') return { ...base, standings: st, final: this.final };
    const by = this.who(c.e.by), live = this.guessers();
    const out = { ...base, standings: st, by, preview: c.e.song.preview, start: c.e.start };
    if (this.phase === 'card' || this.phase === 'guess') {
      out.clipInfo = this.clipInfo(true);
      out.got = [...c.got].sort((a, b) => a[1].at - b[1].at).map(([id, g]) => ({ ...this.who(id), base: g.base, ms: g.ms }));
      out.guessing = live.filter((p) => !this.doneGuessing(p.id)).map((p) => ({ ...this.who(p.id), tries: c.tries.get(p.id) || 0, artist: c.artist.has(p.id) })).slice(0, 24);
      out.eligible = live.length;
      return out;
    }
    out.song = this.songPublic(c.e.song);
    if (this.room.filterOn) { out.song.title = this.room.cleanText(out.song.title); out.song.artist = this.room.cleanText(out.song.artist); }
    out.got = [...c.got].sort((a, b) => a[1].at - b[1].at).map(([id, g]) => ({ ...this.who(id), base: g.base, ms: g.ms }));
    out.close = c.wrong.slice(-8).map((w) => ({ name: this.room.name(w.id), text: this.room.cleanText(w.text) }));
    out.rated = c.ratings.size; out.raters = this.raters().length; out.eligible = live.length;
    out.shownFor = c.revealAt != null ? this.room.now() - c.revealAt : 0;
    if (this.phase === 'score') out.result = c.result;
    return out;
  }
  view(p) {
    const base = this.base(), st = this.standings(), rank = st.findIndex((r) => r.id === p.id) + 1;
    const v = { ...base, me: p.id, gear: GEARS.gearSet(p, 'tune'), points: this.points.get(p.id) || 0, rank, ofPlayers: st.length };
    if (this.phase === 'submit') {
      v.mine = this.mine(p.id).map((e) => ({ key: e.key, start: e.start, ...this.songPublic(e.song) }));
      v.ready = this.active().filter((q) => this.mine(q.id).length >= this.s.songs).length; v.players = this.active().length;
      v.spotify = !!(this.lib.spotifyEnabled && this.lib.spotifyEnabled());
      return v;
    }
    if (this.phase === 'over') { v.final = this.final; return v; }
    const c = this.cur, mineSong = c.e.by === p.id;
    v.by = this.who(c.e.by); v.isMine = mineSong;
    if (mineSong || this.phase === 'reveal' || this.phase === 'score') v.song = this.songPublic(c.e.song);
    if (this.phase === 'card' || this.phase === 'guess') v.clipInfo = this.clipInfo(false);
    const g = c.got.get(p.id);
    v.my = { got: !!g, base: g ? g.base : 0, order: g ? g.order : 0, tries: c.tries.get(p.id) || 0, left: MAX_TRIES - (c.tries.get(p.id) || 0), artist: c.artist.has(p.id), singerLeft: SINGER_TRIES - (c.singerTries.get(p.id) || 0), rating: c.ratings.get(p.id) || 0 };
    v.gotCount = c.got.size; v.eligible = this.guessers().length;
    if (this.phase === 'score') {
      const r = c.result, row = r.rows.find((x) => x.id === p.id);
      v.result = { d: r.d, auto: r.auto, kind: r.dj.kind, mine: row ? row.total : mineSong ? r.dj.pts : 0, base: row ? row.base : 0, dj: mineSong ? r.dj : null };
    }
    return v;
  }
}

module.exports = {
  key: 'tune', name: 'Tune Buzz', min: 2, best: [3, 12], fields, defaults, howSteps: 6,
  show: { facts: false }, // intro cutscene before the game (public/box/intros/tune.js)
  locked: { how: 'Finish a game of JustFunny to unlock it.' }, // public/unlocks.js + UNLOCK_RULES in box/room.js
  create: (room, settings, deps) => new Game(room, settings, deps),
  BOT_SONGS, RATES, matchTitle, matchArtist, titleForms, constants: { TOP, BOTTOM, ARTIST_BONUS, SWEET, EASY, MAX_TRIES, MAX_SONGS, MAX_GUESS, SUBMIT_MS, LISTENS },
};
