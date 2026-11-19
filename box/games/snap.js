'use strict';
// JustSnap: SNAP! magazine needs photos for the next issue. Margo Flash, its eccentric editor,
// hands out an assignment; everyone runs around with their phone camera and sends a photo; the
// photos go up on the TV (anonymous until the reveal) and the room votes or guesses.
//
// Modes (setting `mode`; 'mixed' throws in a different one every round):
//   hunt       Photo Hunt: a prompt ("something that looks like a face") -> gallery -> vote.
//   scavenger  Scavenger Race: four items; snap each; the first to snap an item gets a speed
//              bonus; the room flags doubtful ones (a majority of flags rejects it).
//   closeup    Close-Up Mystery: an extreme close-up + what it is; the others pick the answer
//              from a list (the real one mixed with other players' answers). The photographer
//              scores when some, but not all, get it.
//   colour     Colour Match: fill the frame with the colour on the TV. The phone measures the
//              colours (an 8x8 grid) and the server scores how close they are; plus a style vote.
//   selfie     Selfie Faces: everyone gets a different secret prompt and acts it in a selfie; the
//              others guess which prompt each selfie was.
//   giants     Tiny Giants: forced perspective (make something small look huge) -> vote.
//   caption    Caption This: everyone snaps; everyone captions someone else's photo; vote.
//   change     Spot the Change: snap a scene, change one thing, snap it again and mark the spot;
//              the others tap where they think the change is.
//   alphabet   Alphabet Hunt: something that starts with the letter, and its name; vote + flags.
//   recreate   Team Recreate: teams stage the described scene; one photo per team; vote.
//
// PHOTOS (the important part): phones send a JPEG/PNG/WebP (and a small thumbnail) as binary
// over the socket (`player:act` { op: 'photo', round, slot, img, thumb, ... }). They are checked
// (magic bytes, size), kept in memory in this game only (never on disk), and served by
// box/index.js at /box/photo/<room>/<random id> (?t=1 = the thumbnail) with no-store headers.
// They are freed when the round ends (except the round's best photo, kept for the final
// gallery), and the whole store goes away with the game (a new game, the lobby, a closed room).
// Every phone input is validated; timers use room.after; results() lists ids best-first.
const crypto = require('crypto');
const GEARS = require('../../public/shared/gear');
const C = require('./snap-prompts');
const ART = require('./snap-art');

const opt = (pairs) => pairs.map(([value, label]) => ({ value, label }));
const MODES = {
  hunt: { name: 'Photo Hunt', icon: '🔍', after: 'vote', fav: true },
  scavenger: { name: 'Scavenger Race', icon: '🧺', after: 'vote', flags: true, time: 1.5 },
  closeup: { name: 'Close-Up Mystery', icon: '🔬', after: 'guess', text: 'answer' },
  colour: { name: 'Colour Match', icon: '🎨', after: 'vote', fav: true, grid: true },
  selfie: { name: 'Selfie Faces', icon: '🤳', after: 'guess', selfie: true },
  giants: { name: 'Tiny Giants', icon: '🦖', after: 'vote', fav: true },
  caption: { name: 'Caption This', icon: '💬', after: 'write', fav: true },
  change: { name: 'Spot the Change', icon: '🕵️', after: 'guess', time: 1.5 },
  alphabet: { name: 'Alphabet Hunt', icon: '🔤', after: 'vote', fav: true, flags: true, text: 'name' },
  recreate: { name: 'Team Recreate', icon: '🎬', after: 'vote', fav: true, team: true, time: 1.25 },
};
const MODE_KEYS = Object.keys(MODES);
const fields = [
  { key: 'mode', label: 'Assignment', options: opt([['mixed', '🎲 Mixed (a new mode every round)'], ...MODE_KEYS.map((k) => [k, `${MODES[k].icon} ${MODES[k].name}`])]) },
  { key: 'rounds', label: 'Rounds', options: opt([[3, '3 rounds (quick)'], [5, '5 rounds'], [7, '7 rounds'], [10, '10 rounds']]) },
  { key: 'seconds', label: 'Time to shoot', options: opt([[60, '60 seconds'], [90, '90 seconds'], [120, '2 minutes']]) },
  { key: 'approve', label: 'Host approves photos', options: opt([['off', 'No, show them'], ['on', 'Yes, host checks first']]) },
];
const defaults = { mode: 'mixed', rounds: 5, seconds: 90, approve: 'off' };

// ---- photo limits (the phone aims well under these: ~1024 px, ≤ ~250 KB) ----
const LIMITS = {
  full: 700 * 1024, // one photo
  thumb: 120 * 1024, // its thumbnail
  min: 64, // anything smaller is not a photo
  room: 48 * 1024 * 1024, // everything this game holds at once
  gapMs: 1000, // between two uploads from one player
  perMinute: 24, // uploads per player per minute
  keep: 12, // best photos of the night kept for the final gallery
};
const BRIEF_MS = 7000, REVIEW_MS = 25000, WRITE_MS = 50000, WARN_MS = 10000;
const HIT_R = 0.14; // Spot the Change: how close a tap must be (fraction of the picture)
const PTS = { filed: 50, vote: 100, cover: 150, item: 100, speed: [75, 50, 25], fullSet: 100, guess: 100, sweet: 75, actor: 60, finder: 60, captionPhoto: 50, colour: 3, colourBest: 100, colourVote: 60 };

// Margo Flash's lines during the game (copied into the intro's `story` so they are pre-voiced).
const MARGO = {
  hunt: 'Photo hunt! Find it, frame it, and bring it back to me.',
  scavenger: 'Scavenger race! Every item on the list, and the fastest camera wins.',
  closeup: 'Close-up mystery! Get so close that nobody knows what it is.',
  colour: 'Colour match! Find me that exact colour, and fill the frame.',
  selfie: 'Selfie faces! Check your phone for your secret mood, and act it out.',
  giants: 'Tiny giants! Play with perspective. Make small things huge!',
  caption: 'Caption this! Snap something that is begging for a caption.',
  change: 'Spot the change! Snap a scene, change one thing, and snap it again.',
  alphabet: 'Alphabet hunt! It must start with the letter on the screen.',
  recreate: 'Team shoot! Get together and recreate the scene. Make it art!',
  snap: ['Go, go, go! The magazine prints at midnight!', 'Shoot first, think later, darlings!', 'Find the light, darling. Always find the light.'],
  warn: 'Ten seconds! Send me what you have!',
  review: 'One moment. The host is checking the photos.',
  vote: ['The gallery is open. Vote for your favourite, but not your own!', 'Which one makes the cover? You decide.'],
  flags: 'Check every photo. If one is not the real thing, flag it!',
  guess: 'Now, what are we looking at? Make your guesses!',
  find: 'Find what changed! Tap the spot.',
  write: 'Write a caption for the photo on your phone. Make me laugh!',
  great: ['Stunning. Simply stunning.', 'That one is going on the cover!', 'I have seen things tonight. Wonderful things.'],
  none: 'No photos? My readers will riot!',
  last: 'Last assignment of the night. Make it unforgettable!',
  over: 'That is a wrap! The new issue goes to print. You were magnificent, darlings.',
};

// ---- helpers ----
const MAGIC = [
  ['image/jpeg', (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff],
  ['image/png', (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a],
  ['image/webp', (b) => b.length > 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP'],
];
// A Buffer from what a socket can carry (Buffer, ArrayBuffer, a typed array), or null.
function toBuf(x) {
  if (Buffer.isBuffer(x)) return x;
  if (x instanceof ArrayBuffer) return Buffer.from(x);
  if (ArrayBuffer.isView(x)) return Buffer.from(x.buffer, x.byteOffset, x.byteLength);
  return null;
}
// The image type from its first bytes (JPEG, PNG, WebP only), or null.
function sniff(buf) { if (!buf || buf.length < 12) return null; for (const [t, ok] of MAGIC) if (ok(buf)) return t; return null; }
function checkImage(x, max) {
  const buf = toBuf(x);
  if (!buf) return { error: 'No photo arrived. Try again.' };
  if (buf.length < LIMITS.min) return { error: 'That file is empty.' };
  if (buf.length > max) return { error: 'That photo is too big. Try again (it is shrunk automatically).' };
  const type = sniff(buf); if (!type) return { error: 'That is not a photo (JPEG, PNG or WebP only).' };
  return { buf: Buffer.from(buf), type }; // a copy: never hold on to a socket's larger frame
}
const newId = () => crypto.randomBytes(12).toString('base64url');
const norm = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/^(a|an|the|my|some|our)\s+/, '').replace(/[^a-z0-9 ]+/g, '').replace(/\s+/g, ' ').trim();
const cleanStr = (s, max) => (typeof s === 'string' ? s.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : '');
// sRGB -> CIE Lab (D65), for the colour score.
function lab([r, g, b]) {
  const f = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const R = f(r), G = f(g), B = f(b);
  const X = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047, Y = R * 0.2126 + G * 0.7152 + B * 0.0722, Z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const h = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * h(Y) - 16, 500 * (h(X) - h(Y)), 200 * (h(Y) - h(Z))];
}
// How well an 8x8 colour grid (192 numbers) matches a colour, 0..100: the best 60% of cells count.
function colourScore(grid, hex) {
  if (!Array.isArray(grid) || grid.length !== 192 || !grid.every((v) => Number.isFinite(v) && v >= 0 && v <= 255)) return null;
  const T = lab(ART.rgb(hex)), cells = [];
  for (let i = 0; i < 64; i++) { const L = lab([grid[i * 3], grid[i * 3 + 1], grid[i * 3 + 2]]); const d = Math.hypot(L[0] - T[0], L[1] - T[1], L[2] - T[2]); cells.push(Math.max(0, 1 - d / 55)); }
  cells.sort((a, b) => b - a);
  const top = cells.slice(0, 38);
  return Math.round((100 * top.reduce((a, v) => a + v, 0)) / top.length);
}

class Game {
  constructor(room, s) {
    this.room = room;
    const pick = (f, v) => (f.options.some((o) => String(o.value) === String(v)) ? f.options.find((o) => String(o.value) === String(v)).value : defaults[f.key]);
    this.s = {}; for (const f of fields) this.s[f.key] = pick(f, s ? s[f.key] : undefined);
    this.phase = 'intro'; this.round = 0; this.total = this.s.rounds;
    this.R = null; this.points = new Map(); this.stats = new Map(); this.timer = null; this.warnT = null; this.endsAt = 0;
    this.photos = new Map(); this.bytes = 0; this.uploads = new Map(); this.best = []; this.final = null;
    this.margo = null; this.margoSeq = 0; this.lastMode = null; this.used = {}; this.history = [];
  }
  now() { return this.room.now(); }
  rng() { return this.room.rng(); }
  pickOf(a) { return a[Math.floor(this.rng() * a.length) % a.length]; }
  shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(this.rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  // A prompt from a list that hasn't come up this game (until the list runs out).
  fresh(key, list, n = 1) {
    const used = (this.used[key] = this.used[key] || new Set());
    let pool = list.filter((x) => !used.has(x)); if (pool.length < n) { used.clear(); pool = list.slice(); }
    const out = this.shuffle(pool).slice(0, n); for (const x of out) used.add(x); return out;
  }
  setTimer(ms, fn) { this.room.cancel(this.timer); this.endsAt = this.now() + ms; this.timer = this.room.after(Math.max(0, ms), fn); }
  stat(id) { let s = this.stats.get(id); if (!s) { s = { filed: 0, votes: 0, covers: 0, correct: 0, fast: null, best: 0 }; this.stats.set(id, s); } return s; }
  add(id, n) { if (n && this.room.get(id)) this.points.set(id, (this.points.get(id) || 0) + n); }
  active() { return this.room.list().filter((p) => p.bot || p.sockets > 0); }
  pub(id) { const p = this.room.get(id); return p ? { id, name: p.name, avatar: p.avatar, color: p.color, bot: !!p.bot, gear: GEARS.gearSet(p, 'snap') } : { id, name: '—', avatar: '👻', color: '#888' }; }
  say(text) { if (text) this.margo = { text, key: ++this.margoSeq, at: this.now() }; }
  line(k) { const v = MARGO[k]; return Array.isArray(v) ? this.pickOf(v) : v; }
  url(id, thumb) { return `/box/photo/${encodeURIComponent(this.room.code)}/${id}${thumb ? '?t=1' : ''}`; }
  isVip(p) { const v = this.room.vip(); return !!(v && p && v.id === p.id); }

  start() { for (const p of this.room.list()) { this.points.set(p.id, 0); this.stat(p.id); } this.nextRound(); }
  joined(p) { if (!this.points.has(p.id)) this.points.set(p.id, 0); this.stat(p.id); }
  left(p) {
    // Someone who leaves takes their photos of this round with them (unless it is already scored).
    if (this.R && (this.phase === 'snap' || this.phase === 'review')) for (const rec of [...this.photos.values()]) if (rec.round === this.round && rec.owner === p.id) this.drop(rec.id);
    this.checkDone();
  }

  // ---------------- the photo store ----------------
  // Store a photo for a slot (a new one replaces the old one in the same slot).
  store({ owner, team = null, slot, type, buf, ttype = null, thumb = null, bot = false, text = '', mark = null, grid = null }) {
    const R = this.R, key = (team ? 'team:' + team : owner) + '|' + slot;
    const old = R.slotMap.get(key); if (old) this.drop(old);
    const auto = bot || this.s.approve !== 'on' || this.isVip(this.room.get(owner)); // the host's own photos need no OK
    const rec = { id: newId(), round: this.round, owner, team, slot, key, type, buf, ttype: ttype || type, thumb: thumb || buf, bytes: buf.length + (thumb && thumb !== buf ? thumb.length : 0), at: this.now(), bot, text, mark, grid, ok: auto ? true : null, hidden: false, keep: false };
    this.photos.set(rec.id, rec); this.bytes += rec.bytes; R.slotMap.set(key, rec.id);
    return rec;
  }
  // Forget a photo: its bytes are freed and its URL answers 404 from now on.
  drop(id) {
    const rec = this.photos.get(id); if (!rec) return;
    this.photos.delete(id); this.bytes -= rec.bytes; rec.buf = rec.thumb = null;
    if (this.R && this.R.slotMap.get(rec.key) === id) this.R.slotMap.delete(rec.key);
  }
  // Free every photo of a finished round except the ones kept for the final gallery.
  freeRound(n) { for (const rec of [...this.photos.values()]) if (rec.round === n && !rec.keep) this.drop(rec.id); }
  freeAll(keepBest = true) { for (const rec of [...this.photos.values()]) if (!(keepBest && rec.keep)) this.drop(rec.id); }
  // For the /box/photo route: { type, body } or null (unknown, hidden, rejected or freed).
  servePhoto(id, thumb) {
    const rec = typeof id === 'string' ? this.photos.get(id) : null;
    if (!rec || rec.hidden || rec.ok === false || !rec.buf) return null;
    return thumb ? { type: rec.ttype, body: rec.thumb } : { type: rec.type, body: rec.buf };
  }
  photoBytes() { return this.bytes; }
  wall() { return Date.now(); } // the upload rate limit runs on real time (tests replace it)
  rate(p) {
    const now = this.wall(), list = (this.uploads.get(p.id) || []).filter((t) => now - t < 60000);
    this.uploads.set(p.id, list);
    if (list.length && now - list[list.length - 1] < LIMITS.gapMs) return 'One moment…';
    if (list.length >= LIMITS.perMinute) return 'That is a lot of photos! Wait a moment.';
    list.push(now); return null;
  }

  // ---------------- rounds ----------------
  modeFor() {
    const n = this.active().length;
    if (this.s.mode !== 'mixed') return this.s.mode;
    const recent = this.history.slice(-3).map((h) => h.mode);
    let pool = MODE_KEYS.filter((k) => !recent.includes(k) && !(k === 'recreate' && n < 4));
    if (!pool.length) pool = ['hunt'];
    return this.pickOf(pool);
  }
  slotsOf(R) {
    if (R.mode === 'scavenger') return R.items.map((t, i) => ({ slot: 'i' + i, label: t }));
    if (R.mode === 'change') return [{ slot: 'a', label: 'Before' }, { slot: 'b', label: 'After', mark: true }];
    if (R.mode === 'recreate') return [{ slot: 'team', label: 'Your team’s photo' }];
    return [{ slot: 'main', label: R.mode === 'selfie' ? 'Your selfie' : 'Your photo', text: MODES[R.mode].text || null }];
  }
  nextRound() {
    if (this.R) { this.freeRound(this.R.n); }
    if (this.round >= this.total) return this.end();
    this.round++;
    const mode = this.modeFor(); this.lastMode = mode;
    const R = this.R = { n: this.round, mode, slotMap: new Map(), entries: [], votes: new Map(), flags: new Map(), done: new Set(), guesses: new Map(), assign: new Map(), captions: new Map(), rows: null, teams: null, teamOf: new Map(), secret: new Map() };
    if (mode === 'hunt') R.prompt = this.fresh('hunt', C.HUNT)[0];
    else if (mode === 'giants') R.prompt = this.fresh('giants', C.GIANTS)[0];
    else if (mode === 'scavenger') { R.items = this.fresh('scav', C.SCAVENGER, 4); R.prompt = 'Snap every item on the list. First to snap one gets a speed bonus!'; }
    else if (mode === 'closeup') R.prompt = this.fresh('closeup', C.CLOSEUP)[0];
    else if (mode === 'colour') { R.colour = this.fresh('colour', C.COLOURS)[0]; R.prompt = `Fill the frame with ${R.colour.name}`; }
    else if (mode === 'selfie') { R.prompt = 'Take a selfie acting out your SECRET prompt (on your phone)'; this.dealSecrets(); }
    else if (mode === 'caption') R.prompt = this.fresh('caption', C.CAPTION)[0];
    else if (mode === 'change') R.prompt = this.fresh('change', C.CHANGE)[0];
    else if (mode === 'alphabet') { R.letter = this.fresh('letter', C.LETTERS)[0]; R.prompt = `Something that starts with the letter ${R.letter}`; }
    else if (mode === 'recreate') { R.scene = this.fresh('scene', C.SCENES)[0]; R.prompt = R.scene; this.makeTeams(); }
    R.slots = this.slotsOf(R);
    this.phase = 'brief';
    this.say(this.round === this.total && this.total > 1 ? this.line('last') : this.line(mode));
    this.room.fx('brief', { mode });
    this.setTimer(BRIEF_MS, () => this.snapPhase());
  }
  dealSecrets() {
    const R = this.R, list = this.shuffle(C.SELFIE);
    this.active().forEach((p, i) => R.secret.set(p.id, list[i % list.length]));
  }
  secretOf(id) { const R = this.R; if (!R.secret.has(id)) { const used = new Set(R.secret.values()); R.secret.set(id, this.pickOf(C.SELFIE.filter((x) => !used.has(x)).concat(C.SELFIE).slice(0, 40))); } return R.secret.get(id); }
  makeTeams() {
    const R = this.R, ps = this.shuffle(this.active()), n = ps.length < 4 ? ps.length : Math.ceil(ps.length / 3);
    R.teams = Array.from({ length: Math.max(1, Math.min(n, C.TEAMS.length)) }, (_, i) => ({ id: 't' + i, ...C.TEAMS[i], members: [] }));
    ps.forEach((p, i) => { const t = R.teams[i % R.teams.length]; t.members.push(p.id); R.teamOf.set(p.id, t.id); });
  }
  snapMs() { return Math.round(this.s.seconds * 1000 * (MODES[this.R.mode].time || 1)); }
  snapPhase() {
    const R = this.R; if (!R || this.phase !== 'brief') return;
    this.phase = 'snap'; R.snapAt = this.now();
    this.say(this.line('snap'));
    this.room.fx('snap');
    const ms = this.snapMs();
    this.setTimer(ms, () => this.endSnap());
    this.room.cancel(this.warnT); this.warnT = this.room.after(Math.max(0, ms - WARN_MS), () => { if (this.R === R && this.phase === 'snap') { this.say(this.line('warn')); this.room.fx('warn'); } });
    this.botsSnap(ms);
  }
  // Who has to send what this round: units (a player, or a team) and their slots.
  units() {
    const R = this.R;
    if (R.mode === 'recreate') return R.teams.filter((t) => t.members.some((id) => { const p = this.room.get(id); return p && (p.bot || p.sockets > 0); })).map((t) => ({ key: 'team:' + t.id, team: t.id, bot: t.members.every((id) => { const p = this.room.get(id); return !p || p.bot; }) }));
    return this.active().map((p) => ({ key: p.id, id: p.id, bot: !!p.bot }));
  }
  filled(unitKey) { return this.R.slots.filter((s) => this.R.slotMap.has(unitKey + '|' + s.slot)).length; }
  checkDone() {
    const R = this.R; if (!R) return;
    if (this.phase === 'snap') {
      const u = this.units();
      if (u.length && u.every((x) => this.filled(x.key) === R.slots.length)) { this.room.cancel(this.warnT); this.setTimer(1500, () => this.endSnap()); }
    } else if (this.phase === 'review') {
      if (!this.pending().length) this.setTimer(600, () => this.afterReview());
    } else if (this.phase === 'write') {
      const w = this.active().filter((p) => R.assign.has(p.id));
      if (w.every((p) => R.captions.has(p.id))) this.setTimer(900, () => this.toVote());
    } else if (this.phase === 'vote' || this.phase === 'guess') {
      const v = this.voters();
      if (v.length && v.every((p) => this.doneVoting(p.id))) this.setTimer(1200, () => this.reveal());
      else if (!v.length) this.setTimer(1200, () => this.reveal());
    }
  }
  pending() { return [...this.photos.values()].filter((r) => r.round === this.round && r.ok === null && !r.hidden); }
  endSnap() {
    const R = this.R; if (!R || this.phase !== 'snap') return;
    this.room.cancel(this.warnT);
    if (this.s.approve === 'on' && this.pending().length) {
      this.phase = 'review'; this.say(this.line('review')); this.room.fx('review');
      this.setTimer(REVIEW_MS, () => this.afterReview());
      return;
    }
    this.afterReview();
  }
  afterReview() {
    const R = this.R; if (!R || (this.phase !== 'snap' && this.phase !== 'review')) return;
    for (const rec of this.pending()) { rec.ok = false; this.drop(rec.id); } // not approved in time: not shown
    this.buildEntries();
    const M = MODES[R.mode];
    if (!R.entries.length && R.mode !== 'caption') return this.reveal(true);
    if (M.after === 'write') return this.toWrite();
    if (M.after === 'guess') return this.toGuess();
    return this.toVote();
  }
  okPhoto(key, slot) { const id = this.R.slotMap.get(key + '|' + slot), rec = id && this.photos.get(id); return rec && rec.ok === true && !rec.hidden ? rec : null; }
  buildEntries() {
    const R = this.R, E = [];
    const add = (e) => { e.eid = 'e' + crypto.randomBytes(4).toString('hex'); E.push(e); };
    if (R.mode === 'recreate') for (const t of R.teams) { const rec = this.okPhoto('team:' + t.id, 'team'); if (rec) add({ owner: rec.owner, team: t.id, photos: [rec.id], at: rec.at }); }
    else for (const p of this.room.list()) {
      if (R.mode === 'change') { const a = this.okPhoto(p.id, 'a'), b = this.okPhoto(p.id, 'b'); if (a && b && b.mark) add({ owner: p.id, photos: [a.id, b.id], mark: b.mark, at: b.at }); continue; }
      for (const s of R.slots) { const rec = this.okPhoto(p.id, s.slot); if (rec) add({ owner: p.id, photos: [rec.id], text: rec.text || '', item: R.mode === 'scavenger' ? Number(s.slot.slice(1)) : null, at: rec.at, grid: rec.grid }); }
    }
    R.entries = R.mode === 'scavenger' ? this.shuffle(E).sort((a, b) => a.item - b.item) : this.shuffle(E);
    R.entries.forEach((e, i) => { e.n = i + 1; });
    if (R.mode === 'closeup') for (const e of R.entries) this.makeOptions(e, R.entries.map((x) => x.text), C.DECOYS, 4);
    if (R.mode === 'selfie') for (const e of R.entries) { e.text = this.secretOf(e.owner); this.makeOptions(e, [...R.secret.values()], C.SELFIE, 5); }
    if (R.mode === 'colour') for (const e of R.entries) e.match = colourScore(e.grid, R.colour.hex) || 0;
  }
  // Multiple choice: the right answer and decoys (other players' answers first, then the bank).
  makeOptions(e, mine, bank, n) {
    const right = e.text, seen = new Set([norm(right)]), opts = [right];
    for (const x of [...this.shuffle(mine), ...this.shuffle(bank)]) { if (opts.length >= n) break; const k = norm(x); if (!k || seen.has(k)) continue; seen.add(k); opts.push(x); }
    e.options = this.shuffle(opts); e.answer = e.options.indexOf(right);
  }
  entry(eid) { return this.R && this.R.entries.find((e) => e.eid === eid); }
  // Is this entry the player's own (their photo, their team's, or their caption)?
  own(e, id) { return e.owner === id || (e.team && this.R.teamOf.get(id) === e.team) || e.writer === id; }

  // ---------------- Caption This: everyone captions someone else's photo ----------------
  toWrite() {
    const R = this.R, photos = R.entries.slice(), writers = this.shuffle(this.active());
    R.capPhotos = photos;
    if (!photos.length) return this.reveal(true);
    // Deal photos round-robin, never your own.
    const count = new Map(photos.map((e) => [e.eid, 0]));
    // Photographers caption in a ring (each the next one's photo), so every photo gets a caption.
    const ring = writers.filter((w) => photos.some((e) => e.owner === w.id));
    if (ring.length >= 2) ring.forEach((w, i) => { const e = photos.find((x) => x.owner === ring[(i + 1) % ring.length].id); R.assign.set(w.id, e.eid); count.set(e.eid, count.get(e.eid) + 1); });
    for (const w of writers) {
      if (R.assign.has(w.id)) continue;
      const can = photos.filter((e) => e.owner !== w.id).sort((a, b) => count.get(a.eid) - count.get(b.eid));
      if (!can.length) continue;
      const least = can.filter((e) => count.get(e.eid) === count.get(can[0].eid)), e = this.pickOf(least);
      R.assign.set(w.id, e.eid); count.set(e.eid, count.get(e.eid) + 1);
    }
    if (!R.assign.size) return this.reveal(true);
    this.phase = 'write'; this.say(this.line('write')); this.room.fx('write');
    this.setTimer(WRITE_MS, () => this.toVote());
    for (const p of this.room.list()) if (p.bot && R.assign.has(p.id)) this.room.after(4000 + this.rng() * 20000, () => { if (this.R === R && this.phase === 'write' && !R.captions.has(p.id)) { R.captions.set(p.id, this.pickOf(C.BOT_CAPTIONS)); this.checkDone(); } });
  }
  toVote() {
    const R = this.R; if (!R || !['write', 'snap', 'review'].includes(this.phase)) return;
    if (this.phase === 'write') {
      const E = [];
      for (const [w, text] of R.captions) { const ph = R.capPhotos.find((e) => e.eid === R.assign.get(w)); if (ph && this.photos.has(ph.photos[0])) E.push({ eid: 'e' + crypto.randomBytes(4).toString('hex'), owner: ph.owner, writer: w, photos: ph.photos, text, at: ph.at }); }
      R.entries = this.shuffle(E); R.entries.forEach((e, i) => { e.n = i + 1; });
      if (!R.entries.length) return this.reveal(true);
    }
    this.phase = 'vote'; R.votes = new Map(); R.flags = new Map(); R.done = new Set();
    const M = MODES[R.mode];
    this.say(M.fav ? this.line('vote') : this.line('flags'));
    this.room.fx('gallery');
    const n = R.entries.length;
    this.setTimer(Math.max(25000, Math.min(60000, 20000 + n * 2500)), () => this.reveal());
    this.botsVote();
    this.checkDone();
  }
  toGuess() {
    const R = this.R; if (!R || !['snap', 'review'].includes(this.phase)) return;
    this.phase = 'guess'; R.guesses = new Map(); R.done = new Set();
    this.say(R.mode === 'change' ? this.line('find') : this.line('guess'));
    this.room.fx('gallery');
    const n = R.entries.length;
    this.setTimer(R.mode === 'change' ? Math.max(30000, Math.min(100000, 15000 + n * 12000)) : Math.max(25000, Math.min(90000, 15000 + n * 9000)), () => this.reveal());
    this.botsGuess();
    this.checkDone();
  }
  // Who votes or guesses: players here who have at least one entry that isn't theirs.
  voters() { const R = this.R; return this.active().filter((p) => R.entries.some((e) => !this.own(e, p.id))); }
  doneVoting(id) {
    const R = this.R, M = MODES[R.mode];
    if (this.phase === 'guess') { const g = R.guesses.get(id); return R.entries.every((e) => this.own(e, id) || (g && g.has(e.eid))); }
    return R.done.has(id) || (M.fav && !M.flags && R.votes.has(id));
  }

  // ---------------- bots ----------------
  botSeed() { return Math.floor(this.rng() * 2147483647); }
  botsSnap(ms) {
    const R = this.R;
    for (const u of this.units()) {
      if (!u.bot) continue;
      const owner = u.id || (R.teams.find((t) => 'team:' + t.id === u.key) || { members: [] }).members[0]; if (!owner) continue;
      const seed = this.botSeed(), skill = 0.45 + this.rng() * 0.5;
      const at = (k) => ms * (0.12 + k * (0.5 + this.rng() * 0.25));
      const go = (slot, k, make) => this.room.after(at(k), () => { if (this.R !== R || this.phase !== 'snap' || !this.room.get(owner)) return; const m = make(); const buf = Buffer.from(m.svg); this.store({ owner, team: u.team || null, slot, type: 'image/svg+xml', buf, bot: true, text: m.text || '', mark: m.mark || null, grid: m.grid || null }); this.room.fx('sent'); this.checkDone(); });
      if (R.mode === 'change') { const pair = ART.changePair(seed); go('a', 0.2, () => ({ svg: pair.a })); go('b', 0.6, () => ({ svg: pair.b, mark: pair.mark })); continue; }
      if (R.mode === 'scavenger') { R.slots.forEach((s, i) => { if (this.rng() < skill + 0.25) go(s.slot, 0.15 + i * 0.2, () => ({ svg: ART.scene(seed + i) })); }); continue; }
      go(R.slots[0].slot, 0.3 + this.rng() * 0.5, () => {
        if (R.mode === 'selfie') return { svg: ART.selfie(seed) };
        if (R.mode === 'closeup') return { svg: ART.closeup(seed), text: this.pickOf(C.DECOYS) };
        if (R.mode === 'colour') return ART.colour(seed, R.colour.hex, skill);
        if (R.mode === 'alphabet') return { svg: ART.scene(seed), text: this.pickOf(C.WORDS[R.letter] || ['thing']) };
        return { svg: ART.scene(seed) };
      });
    }
  }
  botsVote() {
    const R = this.R, M = MODES[R.mode];
    for (const p of this.room.list()) {
      if (!p.bot) continue;
      this.room.after(3000 + this.rng() * 14000, () => {
        if (this.R !== R || this.phase !== 'vote') return;
        const others = R.entries.filter((e) => !this.own(e, p.id));
        if (M.flags) for (const e of others) if (this.rng() < 0.08) this.flag(p, e.eid, true);
        if (M.fav && others.length) R.votes.set(p.id, this.pickOf(others).eid);
        R.done.add(p.id); this.checkDone();
      });
    }
  }
  botsGuess() {
    const R = this.R;
    for (const p of this.room.list()) {
      if (!p.bot) continue;
      this.room.after(4000 + this.rng() * 16000, () => {
        if (this.R !== R || this.phase !== 'guess') return;
        const g = R.guesses.get(p.id) || new Map(); R.guesses.set(p.id, g);
        for (const e of R.entries) {
          if (this.own(e, p.id)) continue;
          const right = this.rng() < 0.55;
          if (R.mode === 'change') g.set(e.eid, right ? { x: e.mark.x + (this.rng() - 0.5) * 0.08, y: e.mark.y + (this.rng() - 0.5) * 0.08 } : { x: this.rng(), y: this.rng() });
          else g.set(e.eid, right ? e.answer : Math.floor(this.rng() * e.options.length));
        }
        this.checkDone();
      });
    }
  }

  // ---------------- moves ----------------
  flag(p, eid, on) {
    const R = this.R, e = this.entry(eid);
    if (!e) return { ok: false, error: 'That photo is gone.' };
    if (this.own(e, p.id)) return { ok: false, error: 'You can’t flag your own photo.' };
    const s = R.flags.get(p.id) || new Set(); R.flags.set(p.id, s);
    if (on) s.add(eid); else s.delete(eid);
    return { ok: true };
  }
  // Hide a photo (the host: TV ⚙ or the host's phone). id = a photo id or an entry id.
  hide(id) {
    const R = this.R; if (typeof id !== 'string') return { ok: false, error: 'Which photo?' };
    let ids = [];
    const e = R && R.entries.find((x) => x.eid === id);
    if (e) ids = e.photos.slice();
    else if (this.photos.has(id)) { ids = [id]; const rec = this.photos.get(id); if (R && rec.round === R.n) for (const x of R.entries) if (x.photos.includes(id)) ids.push(...x.photos); }
    else { const b = this.best.find((x) => x.pid === id); if (b) ids = [id]; }
    if (!ids.length) return { ok: false, error: 'That photo is gone.' };
    ids = [...new Set(ids)];
    for (const pid of ids) {
      const rec = this.photos.get(pid); if (rec) { rec.hidden = true; this.drop(pid); }
      this.best = this.best.filter((b) => b.pid !== pid);
    }
    if (R) {
      const gone = R.entries.filter((x) => x.photos.some((pid) => ids.includes(pid)));
      if (this.phase === 'vote' || this.phase === 'guess') {
        R.entries = R.entries.filter((x) => !gone.includes(x));
        for (const [v, eid] of [...R.votes]) if (gone.some((x) => x.eid === eid)) R.votes.delete(v);
        for (const s of R.flags.values()) for (const x of gone) s.delete(x.eid);
        for (const g of R.guesses.values()) for (const x of gone) g.delete(x.eid);
        this.checkDone();
      } else for (const x of gone) x.hidden = true;
      if (R.rows) for (const row of R.rows) if (row.photos.some((pid) => ids.includes(pid))) row.hidden = true;
    }
    this.room.fx('hidden');
    return { ok: true, hidden: ids.length };
  }
  review(id, ok) {
    const rec = this.photos.get(id);
    if (!rec || rec.round !== this.round || rec.ok !== null) return { ok: false, error: 'Already decided.' };
    if (ok) rec.ok = true; else { rec.ok = false; this.drop(id); }
    this.checkDone();
    return { ok: true };
  }
  reviewAll() { for (const rec of this.pending()) rec.ok = true; this.checkDone(); return { ok: true }; }
  hostAct(msg) {
    if (msg.type === 'snapHide') return this.hide(msg.id);
    if (msg.type === 'snapOk') return this.review(String(msg.id || ''), msg.ok !== false);
    if (msg.type === 'snapOkAll') return this.reviewAll();
    return { ok: false, error: 'Unknown action.' };
  }

  act(p, m) {
    m = m || {};
    const R = this.R;
    if (m.op === 'hide' || m.op === 'review' || m.op === 'reviewAll') {
      if (!this.isVip(p)) return { ok: false, error: 'Only the host can do that.' };
      if (m.op === 'hide') return this.hide(String(m.id || ''));
      if (m.op === 'reviewAll') return this.reviewAll();
      return this.review(String(m.id || ''), m.ok !== false);
    }
    if (!R) return { ok: false, error: 'Not now.' };
    if (m.op === 'photo') return this.upload(p, m);
    if (m.op === 'caption') {
      if (this.phase !== 'write') return { ok: false, error: 'Not now.' };
      if (!R.assign.has(p.id)) return { ok: false, error: 'You have no photo to caption this round.' };
      const t = this.room.cleanText(cleanStr(m.text, 90)); if (t.length < 2) return { ok: false, error: 'Write a caption first.' };
      R.captions.set(p.id, t); this.checkDone(); return { ok: true };
    }
    if (m.op === 'vote') {
      if (this.phase !== 'vote' || !MODES[R.mode].fav) return { ok: false, error: 'Not now.' };
      const e = this.entry(m.entry); if (!e) return { ok: false, error: 'That photo is gone.' };
      if (this.own(e, p.id)) return { ok: false, error: 'No voting for your own!' };
      R.votes.set(p.id, e.eid); if (!MODES[R.mode].flags) R.done.add(p.id); this.checkDone(); return { ok: true };
    }
    if (m.op === 'flag') {
      if (this.phase !== 'vote' || !MODES[R.mode].flags) return { ok: false, error: 'Not now.' };
      const r = this.flag(p, m.entry, m.on !== false); return r;
    }
    if (m.op === 'done') {
      if (this.phase !== 'vote') return { ok: false, quiet: true };
      if (MODES[R.mode].fav && !R.votes.has(p.id) && R.entries.some((e) => !this.own(e, p.id))) return { ok: false, error: 'Pick your favourite first.' };
      R.done.add(p.id); this.checkDone(); return { ok: true };
    }
    if (m.op === 'guess') {
      if (this.phase !== 'guess') return { ok: false, error: 'Not now.' };
      const e = this.entry(m.entry); if (!e) return { ok: false, error: 'That photo is gone.' };
      if (this.own(e, p.id)) return { ok: false, error: 'That one is yours!' };
      let v;
      if (R.mode === 'change') { const x = Number(m.x), y = Number(m.y); if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x > 1 || y < 0 || y > 1) return { ok: false, error: 'Tap the photo.' }; v = { x, y }; }
      else { v = Number(m.choice); if (!Number.isInteger(v) || v < 0 || v >= e.options.length) return { ok: false, error: 'Pick an answer.' }; }
      const g = R.guesses.get(p.id) || new Map(); R.guesses.set(p.id, g);
      if (g.has(e.eid)) return { ok: false, error: 'You already answered that one.' };
      g.set(e.eid, v); this.checkDone(); return { ok: true };
    }
    return { ok: false, error: 'Unknown move.' };
  }
  upload(p, m) {
    const R = this.R;
    if (this.phase !== 'snap') return { ok: false, error: this.phase === 'brief' ? 'Wait for the go!' : 'Too late for this round!' };
    if (Number(m.round) !== R.n) return { ok: false, error: 'That was for another round.' };
    const slot = R.slots.find((s) => s.slot === m.slot); if (!slot) return { ok: false, error: 'Unknown photo slot.' };
    const team = R.mode === 'recreate' ? R.teamOf.get(p.id) : null;
    if (R.mode === 'recreate' && !team) return { ok: false, error: 'You joined mid-round: you’re on the next team shoot!' };
    const limited = this.rate(p); if (limited) return { ok: false, error: limited };
    const full = checkImage(m.img, LIMITS.full); if (full.error) return { ok: false, error: full.error };
    let th = null; if (m.thumb != null) { th = checkImage(m.thumb, LIMITS.thumb); if (th.error) return { ok: false, error: th.error }; }
    let text = '';
    if (slot.text) {
      text = this.room.cleanText(cleanStr(m.text, slot.text === 'name' ? 30 : 40));
      if (norm(text).length < 2) return { ok: false, error: slot.text === 'name' ? 'Type what it is.' : 'Type what it is (only the TV shows it, at the end).' };
      if (slot.text === 'name' && norm(text)[0] !== R.letter.toLowerCase()) return { ok: false, error: `That doesn’t start with ${R.letter}!` };
    }
    let mark = null;
    if (slot.mark) { const x = Number(m.mark && m.mark.x), y = Number(m.mark && m.mark.y); if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x > 1 || y < 0 || y > 1) return { ok: false, error: 'Tap where you changed something.' }; mark = { x, y }; }
    let grid = null;
    if (MODES[R.mode].grid) { grid = Array.isArray(m.grid) ? m.grid.map(Number) : null; if (colourScore(grid, R.colour.hex) == null) return { ok: false, error: 'Could not read the colours. Try again.' }; }
    const key = (team ? 'team:' + team : p.id) + '|' + slot.slot, old = R.slotMap.get(key), oldBytes = old && this.photos.get(old) ? this.photos.get(old).bytes : 0;
    const bytes = full.buf.length + (th ? th.buf.length : 0);
    if (this.bytes - oldBytes + bytes > LIMITS.room) return { ok: false, error: 'The darkroom is full! Ask the host to move on.' };
    const rec = this.store({ owner: p.id, team, slot: slot.slot, type: full.type, buf: full.buf, ttype: th ? th.type : null, thumb: th ? th.buf : null, text, mark, grid });
    const st = this.stat(p.id), secs = Math.round((rec.at - R.snapAt) / 100) / 10; if (st.fast == null || secs < st.fast) st.fast = secs;
    this.room.fx('sent');
    this.checkDone();
    return { ok: true, id: rec.id, pending: rec.ok === null };
  }

  // ---------------- the reveal and scoring ----------------
  reveal(empty = false) {
    const R = this.R; if (!R || this.phase === 'reveal' || this.phase === 'over') return;
    this.room.cancel(this.warnT);
    this.phase = 'reveal';
    const M = MODES[R.mode], gains = new Map(), notes = new Map();
    const give = (id, n, why) => { if (!n || !this.room.get(id)) return; this.add(id, n); gains.set(id, (gains.get(id) || 0) + n); const a = notes.get(id) || []; a.push(`+${n} ${why}`); notes.set(id, a); };
    const rows = [];
    const ownersOf = (e) => (e.team ? (R.teams.find((t) => t.id === e.team) || { members: [] }).members : [e.owner]);
    const voters = this.active().length;
    for (const e of R.entries) {
      const row = { eid: e.eid, n: e.n, owner: e.owner, team: e.team || null, writer: e.writer || null, photos: e.photos, at: e.at, text: e.text || '', item: e.item, mark: e.mark || null, votes: 0, voters: [], flags: 0, rejected: false, correct: 0, of: 0, gain: 0, match: e.match, hidden: !!e.hidden };
      rows.push(row);
    }
    const rowOf = (eid) => rows.find((r) => r.eid === eid);
    if (M.after === 'vote' || M.after === 'write') {
      for (const [v, eid] of R.votes) { const r = rowOf(eid); if (r && this.room.get(v)) { r.votes++; r.voters.push(v); } }
      if (M.flags) {
        for (const s of R.flags.values()) for (const eid of s) { const r = rowOf(eid); if (r) r.flags++; }
        for (const r of rows) { const judges = this.active().filter((p) => !this.own(R.entries.find((e) => e.eid === r.eid), p.id)).length; r.rejected = r.flags > 0 && r.flags * 2 > judges; if (r.rejected) { r.votes = 0; r.voters = []; } }
      }
      if (R.mode === 'scavenger') {
        R.items.forEach((_, i) => { rows.filter((r) => r.item === i && !r.rejected).sort((a, b) => a.at - b.at).forEach((r, k) => { r.speed = PTS.speed[k] || 0; r.rank = k + 1; }); });
        for (const r of rows) if (!r.rejected) { r.gain = PTS.item + (r.speed || 0); give(r.owner, r.gain, `${R.items[r.item]}${r.speed ? ' (speed bonus!)' : ''}`); }
        for (const p of this.room.list()) { const mine = rows.filter((r) => r.owner === p.id && !r.rejected); if (mine.length === R.items.length) { give(p.id, PTS.fullSet, 'the full set!'); } }
      } else {
        const top = Math.max(0, ...rows.map((r) => r.votes));
        for (const r of rows) {
          if (r.rejected) continue;
          r.cover = top > 0 && r.votes === top;
          const per = R.mode === 'colour' ? PTS.colourVote : PTS.vote;
          if (R.mode === 'caption') {
            give(r.writer, r.votes * PTS.vote + (r.cover ? PTS.cover : 0), `${r.votes} vote${r.votes === 1 ? '' : 's'} for your caption`);
            give(r.owner, r.votes * PTS.captionPhoto + (r.cover ? PTS.cover / 2 : 0), 'your photo got captioned');
            r.gain = r.votes * PTS.vote + (r.cover ? PTS.cover : 0);
          } else {
            const base = R.mode === 'colour' ? Math.round((r.match || 0) * PTS.colour) : PTS.filed;
            r.gain = base + r.votes * per + (r.cover ? PTS.cover : 0);
            for (const id of ownersOf(r)) give(id, r.gain, R.mode === 'colour' ? `${r.match}% colour match${r.votes ? `, ${r.votes} vote${r.votes === 1 ? '' : 's'}` : ''}` : `${r.votes} vote${r.votes === 1 ? '' : 's'}${r.cover ? ' and the cover!' : ''}`);
          }
        }
        if (R.mode === 'colour') { const best = Math.max(0, ...rows.map((r) => r.match || 0)); for (const r of rows) if (best > 0 && r.match === best) { r.bestMatch = true; r.gain += PTS.colourBest; give(r.owner, PTS.colourBest, 'closest colour!'); } }
      }
    } else if (M.after === 'guess') {
      for (const e of R.entries) {
        const row = rowOf(e.eid); row.options = e.options || null; row.answer = e.answer;
        const gs = this.active().filter((p) => !this.own(e, p.id));
        row.of = gs.length; row.got = [];
        for (const p of gs) {
          const g = R.guesses.get(p.id), v = g && g.get(e.eid); if (v == null) continue;
          const right = R.mode === 'change' ? Math.hypot(v.x - e.mark.x, v.y - e.mark.y) <= HIT_R : v === e.answer;
          if (right) { row.correct++; row.got.push(p.id); this.stat(p.id).correct++; give(p.id, PTS.guess, R.mode === 'change' ? `spotted #${e.n}` : `guessed #${e.n}`); }
          if (R.mode === 'change') { (row.taps = row.taps || []).push({ id: p.id, x: Math.round(v.x * 1000) / 1000, y: Math.round(v.y * 1000) / 1000, hit: right }); }
        }
        if (R.mode === 'selfie') row.gain = row.correct * PTS.actor;
        else row.gain = row.correct > 0 && row.correct < row.of ? row.correct * (R.mode === 'change' ? PTS.finder : PTS.sweet) : 0;
        if (row.gain) give(e.owner, row.gain, R.mode === 'selfie' ? `${row.correct} read your face` : `${row.correct} of ${row.of} got yours (the sweet spot!)`);
        row.cover = false;
      }
      const best = rows.slice().sort((a, b) => b.gain - a.gain || b.correct - a.correct)[0]; if (best && best.gain > 0) best.cover = true;
    }
    for (const r of rows) for (const id of r.team ? ownersOf(r) : [r.owner]) { const st = this.stat(id); st.filed++; st.votes += r.votes; if (r.cover) st.covers++; st.best = Math.max(st.best, r.gain); }
    rows.sort((a, b) => (b.cover ? 1 : 0) - (a.cover ? 1 : 0) || b.gain - a.gain || a.n - b.n);
    R.rows = rows; R.gains = gains; R.notes = notes; R.empty = empty || !rows.length;
    // The round's best photo goes into the final gallery.
    const keeper = rows.find((r) => !r.rejected && !r.hidden && r.photos.every((pid) => this.photos.has(pid)));
    if (keeper && this.best.length < LIMITS.keep) {
      const pid = keeper.photos[keeper.photos.length - 1], rec = this.photos.get(pid);
      rec.keep = true;
      this.best.push({ pid, owner: keeper.owner, team: keeper.team, round: R.n, mode: R.mode, prompt: R.mode === 'scavenger' ? R.items[keeper.item] : R.prompt, caption: R.mode === 'caption' ? keeper.text : '', writer: keeper.writer || null, votes: keeper.votes, bot: rec.bot });
    }
    this.history.push({ mode: R.mode, prompt: R.prompt, n: rows.length, best: keeper ? keeper.owner : null });
    this.say(R.empty ? this.line('none') : this.line('great'));
    this.room.fx('reveal');
    this.setTimer(Math.max(11000, Math.min(22000, 9000 + rows.length * 900)), () => this.nextRound());
  }
  end() {
    this.room.cancel(this.timer); this.room.cancel(this.warnT); this.phase = 'over'; this.endsAt = 0;
    this.freeAll(true);
    this.final = { standings: this.standings(), awards: this.awards() };
    this.say(this.line('over'));
    this.room.fx('win');
  }
  awards() {
    const ids = [...this.stats.keys()].filter((id) => this.room.get(id)), A = [];
    const best = (f, cmp, ok = () => true) => { let w = null; for (const id of ids) { const v = f(this.stat(id)); if (v == null || !ok(v)) continue; if (!w || cmp(v, w.v) < 0) w = { id, v }; } return w; };
    const add = (key, icon, title, w, txt) => { if (w) A.push({ key, icon, title, ...this.pub(w.id), text: txt(w.v) }); };
    add('cover', '📰', 'Cover Star', best((s) => s.covers, (a, b) => b - a, (v) => v > 0), (v) => `${v} cover${v === 1 ? '' : 's'}`);
    add('fans', '❤️', 'Crowd Favourite', best((s) => s.votes, (a, b) => b - a, (v) => v > 0), (v) => `${v} vote${v === 1 ? '' : 's'}`);
    add('eye', '👁️', 'Sharp Eye', best((s) => s.correct, (a, b) => b - a, (v) => v > 0), (v) => `${v} right guess${v === 1 ? '' : 'es'}`);
    add('fast', '⚡', 'Fastest Shutter', best((s) => s.fast, (a, b) => a - b), (v) => `a photo in ${v}s`);
    add('busy', '🎞️', 'Paparazzo', best((s) => s.filed, (a, b) => b - a, (v) => v > 1), (v) => `${v} photos filed`);
    return A;
  }
  highlights() {
    return this.best.slice(0, 3).map((b) => ({ icon: MODES[b.mode].icon, text: `${this.room.name(b.owner)}’s photo for “${b.prompt}”` }));
  }
  standings() {
    return [...this.points].filter(([id]) => this.room.get(id)).map(([id, pts]) => ({ ...this.pub(id), points: pts, covers: this.stat(id).covers }))
      .sort((a, b) => b.points - a.points || b.covers - a.covers || a.name.localeCompare(b.name));
  }
  results() { return this.phase === 'over' ? this.standings().map((r) => r.id) : []; }
  next() {
    if (this.phase === 'brief') return this.snapPhase();
    if (this.phase === 'snap') return this.endSnap();
    if (this.phase === 'review') return this.afterReview();
    if (this.phase === 'write') return this.toVote();
    if (this.phase === 'vote' || this.phase === 'guess') return this.reveal();
    if (this.phase === 'reveal') return this.nextRound();
  }

  // ---------------- screens ----------------
  modeInfo() { const R = this.R; if (!R) return null; const M = MODES[R.mode]; return { key: R.mode, name: M.name, icon: M.icon, prompt: R.prompt, items: R.items || null, letter: R.letter || null, colour: R.colour || null, scene: R.scene || null, teams: R.teams ? R.teams.map((t) => ({ id: t.id, name: t.name, color: t.color, members: t.members.filter((id) => this.room.get(id)).map((id) => this.pub(id)) })) : null, fav: !!M.fav, flags: !!M.flags, after: M.after }; }
  base() { return { phase: this.phase, round: this.round, of: this.total, endsIn: this.endsAt && this.phase !== 'over' ? Math.max(0, this.endsAt - this.now()) : 0, margo: this.margo, approve: this.s.approve === 'on', m: this.modeInfo() }; }
  progress() {
    const R = this.R; if (!R) return null;
    if (this.phase === 'snap' || this.phase === 'review' || this.phase === 'brief') {
      const need = R.slots.length;
      if (R.mode === 'recreate') return { need, teams: R.teams.map((t) => ({ id: t.id, done: this.filled('team:' + t.id) })), pending: this.pending().length };
      return { need, who: this.room.list().slice(0, 60).map((p) => ({ ...this.pub(p.id), done: this.filled(p.id), online: p.bot || p.sockets > 0 })), pending: this.pending().length };
    }
    if (this.phase === 'write') { const w = this.room.list().filter((p) => R.assign.has(p.id)); return { who: w.slice(0, 60).map((p) => ({ ...this.pub(p.id), done: R.captions.has(p.id) ? 1 : 0 })), need: 1 }; }
    if (this.phase === 'vote' || this.phase === 'guess') { const v = this.voters(); return { who: v.slice(0, 60).map((p) => ({ ...this.pub(p.id), done: this.doneVoting(p.id) ? 1 : 0 })), need: 1 }; }
    return null;
  }
  // The gallery as everyone sees it during voting/guessing: anonymous (no owners).
  gallery() {
    const R = this.R; if (!R || (this.phase !== 'vote' && this.phase !== 'guess')) return null;
    return R.entries.map((e) => ({ eid: e.eid, n: e.n, urls: e.photos.map((pid) => this.url(pid)), thumbs: e.photos.map((pid) => this.url(pid, true)), text: R.mode === 'closeup' || R.mode === 'selfie' ? '' : e.text || '', item: e.item != null ? R.items[e.item] : null, itemNo: e.item, options: e.options || null }));
  }
  rowsPub() {
    const R = this.R; if (!R || !R.rows) return null;
    return R.rows.map((r) => ({ ...r, owner: this.pub(r.owner), writer: r.writer ? this.pub(r.writer) : null, team: r.team ? (R.teams.find((t) => t.id === r.team) || null) : null, voters: r.voters.slice(0, 10).map((id) => this.pub(id)), got: (r.got || []).slice(0, 12).map((id) => this.pub(id)), urls: r.hidden ? [] : r.photos.map((pid) => (this.photos.has(pid) ? this.url(pid) : null)), photos: undefined, item: r.item != null ? R.items[r.item] : null, answerText: r.options ? r.options[r.answer] : r.text, taps: r.taps ? r.taps.slice(0, 30).map((t) => ({ ...t, ...this.pub(t.id) })) : null }));
  }
  bestPub() { return this.best.filter((b) => this.photos.has(b.pid)).map((b) => ({ pid: b.pid, url: this.url(b.pid), owner: this.pub(b.owner), writer: b.writer ? this.pub(b.writer) : null, round: b.round, mode: b.mode, icon: MODES[b.mode].icon, prompt: b.prompt, caption: b.caption, votes: b.votes })); }
  tv() {
    const st = this.standings();
    const o = { ...this.base(), progress: this.progress(), gallery: this.gallery(), votes: this.R && this.phase === 'vote' ? this.R.votes.size : 0, standings: st.slice(0, 10), players: st.length };
    if (this.s.approve === 'on' && (this.phase === 'snap' || this.phase === 'review')) o.review = this.pending().map((r) => ({ id: r.id, thumb: this.url(r.id, true) }));
    if (this.phase === 'reveal') { o.rows = this.rowsPub(); o.empty = this.R.empty; o.more = 0; }
    if (this.phase === 'over') { o.final = this.final; o.awards = this.final.awards; o.best = this.bestPub(); }
    return o;
  }
  view(p) {
    const R = this.R, st = this.standings(), i = st.findIndex((r) => r.id === p.id);
    const v = { ...this.base(), me: p.id, vip: this.isVip(p), points: this.points.get(p.id) || 0, rank: i + 1, ranked: st.length };
    if (this.phase === 'over') { v.final = this.final; v.best = this.bestPub().filter((b) => b.owner.id === p.id || (b.writer && b.writer.id === p.id)); return v; }
    if (!R) return v;
    if (R.mode === 'selfie') v.secret = this.secretOf(p.id);
    if (R.mode === 'recreate') { const t = R.teams.find((x) => x.id === R.teamOf.get(p.id)); v.team = t ? { id: t.id, name: t.name, color: t.color, members: t.members.filter((id) => this.room.get(id)).map((id) => this.pub(id)) } : null; }
    const unit = R.mode === 'recreate' ? (v.team ? 'team:' + v.team.id : null) : p.id;
    v.slots = R.slots.map((s) => { const id = unit && R.slotMap.get(unit + '|' + s.slot), rec = id && this.photos.get(id); return { slot: s.slot, label: s.label, text: s.text || null, mark: !!s.mark, done: !!rec, thumb: rec ? this.url(rec.id, true) : null, url: rec ? this.url(rec.id) : null, mine: rec ? rec.owner === p.id : false, by: rec ? this.room.name(rec.owner) : null, pending: rec ? rec.ok === null : false, saved: rec ? { text: rec.text, mark: rec.mark } : null }; });
    if (v.vip && this.s.approve === 'on' && (this.phase === 'snap' || this.phase === 'review')) v.review = this.pending().map((r) => ({ id: r.id, thumb: this.url(r.id, true), url: this.url(r.id) }));
    if (this.phase === 'write') { const e = R.capPhotos && R.capPhotos.find((x) => x.eid === R.assign.get(p.id)); v.capPhoto = e ? { url: this.url(e.photos[0]), thumb: this.url(e.photos[0], true) } : null; v.myCaption = R.captions.get(p.id) || null; }
    if (this.phase === 'vote' || this.phase === 'guess') {
      v.gallery = this.gallery().map((g) => ({ ...g, mine: this.own(this.entry(g.eid), p.id) }));
      v.myVote = R.votes.get(p.id) || null; v.myFlags = [...(R.flags.get(p.id) || [])]; v.done = this.doneVoting(p.id);
      const g = R.guesses.get(p.id); v.myGuesses = g ? Object.fromEntries(g) : {};
      if (v.vip) v.canHide = true;
    }
    if (this.phase === 'reveal' && R.rows) {
      v.gain = R.gains.get(p.id) || 0; v.notes = (R.notes.get(p.id) || []).slice(0, 6); v.empty = R.empty;
      const top = R.rows.find((r) => r.cover) || R.rows[0];
      v.top = top ? this.rowsPub().find((r) => r.eid === top.eid) : null;
      const mine = R.rows.filter((r) => r.owner === p.id || r.writer === p.id || (r.team && R.teamOf.get(p.id) === r.team));
      v.mine = mine.slice(0, 6).map((r) => ({ eid: r.eid, n: r.n, gain: r.gain, votes: r.votes, correct: r.correct, of: r.of, rejected: r.rejected, cover: !!r.cover, match: r.match, item: r.item != null ? R.items[r.item] : null }));
      if (v.vip) v.canHide = true;
    }
    return v;
  }
}

// Party Mode: settings that fit the players in the room and this game's minutes in the plan (box/party-fit.js).
const PF = require('../party-fit');
const estimate = (s) => 0.5 + (s.rounds * (s.seconds * 1.15 + 65)) / 60; // shooting + gallery + reveal per round
const partyFit = ({ minutes: M }) => {
  const { rounds, seconds } = PF.best({ rounds: [5, 7, 3, 10], seconds: [90, 60, 120] }, estimate, M);
  return { rounds, seconds, mode: 'mixed' };
};

module.exports = {
  key: 'snap', name: 'JustSnap', min: 2, best: [3, 10], howSteps: 6, fields, defaults, // best: the ideal crowd (Party Mode + the menu use it)
  show: { facts: false }, // intro cutscene before the game (public/box/intros/snap.js): SNAP! magazine's office
  partyFit, // Party Mode fits the settings to the crowd and the time
  create: (room, settings) => new Game(room, settings),
  _test: { MODES, LIMITS, MARGO, PTS, HIT_R, sniff, checkImage, colourScore, norm, estimate },
};
