'use strict';
// JustGameBox lifetime profiles: a phone keeps { id, token } in localStorage and the server
// keeps the stats, trophies and titles. Same storage approach as JustMafia's ProfileStore
// (../profiles.js): one JSON file under .data/ (git-ignored), written atomically, or memory
// only when there is no filename (tests, MT_PROFILE_STORE=memory). Tokens are never stored,
// only a SHA-256 verifier. A name + password (optional, "Save your stuff") lets the same profile
// move to a new phone. Passwords are hashed with scrypt + a salt; the old 4–6 digit PINs are
// simply numeric passwords and still sign in.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const digest = (token) => crypto.createHash('sha256').update(token).digest('hex');
const MAX_DEVICES = 8, MAX_NIGHTS = 12, MAX_ROOMS = 30;
const GUESSING = ['price', 'emoji', 'tune', 'quickdraw', 'colormatch', 'trivia'];
const CARDS = ['president', 'blackjack', 'bid', 'plinko', 'blanks'];
const BLUFF = ['truths', 'likely', 'debate', 'alien', 'bomb', 'whosaid'];

// The trophy case. test(stats) → earned? Each trophy can be worn as a title next to your name.
const TROPHIES = [
  { id: 'firstGame', icon: '🎟️', name: 'Welcome to the Box', title: 'Newcomer', how: 'Finish your first game.', test: (s) => s.games >= 1 },
  { id: 'firstWin', icon: '🥇', name: 'First Victory', title: 'Winner', how: 'Win any game.', test: (s) => s.wins >= 1 },
  { id: 'wins10', icon: '🏆', name: 'Ten Time Champ', title: 'Champ', how: 'Win 10 games.', test: (s) => s.wins >= 10 },
  { id: 'wins50', icon: '💎', name: 'Unstoppable', title: 'the Unstoppable', how: 'Win 50 games.', test: (s) => s.wins >= 50 },
  { id: 'games25', icon: '🎮', name: 'Regular', title: 'Regular', how: 'Play 25 games.', test: (s) => s.games >= 25 },
  { id: 'games100', icon: '📦', name: 'Box Legend', title: 'Box Legend', how: 'Play 100 games.', test: (s) => s.games >= 100 },
  { id: 'explorer', icon: '🧭', name: 'Explorer', title: 'the Explorer', how: 'Play 10 different games.', test: (s) => Object.keys(s.byGame).length >= 10 },
  { id: 'allRounder', icon: '🎯', name: 'All-Rounder', title: 'All-Rounder', how: 'Win 5 different games.', test: (s) => Object.values(s.byGame).filter((g) => g.won > 0).length >= 5 },
  { id: 'mindReader', icon: '🔮', name: 'Mind Reader', title: 'Mind Reader', how: 'A first win in every guessing game (Price Panic, Emoji Charades, Tune Buzz, Quick Draw, Color Match, Hot Take Trivia).', test: (s) => GUESSING.every((k) => s.byGame[k] && s.byGame[k].won > 0) },
  { id: 'cardShark', icon: '🃏', name: 'Card Shark', title: 'Card Shark', how: 'Win 3 card or casino games.', test: (s) => CARDS.reduce((n, k) => n + ((s.byGame[k] && s.byGame[k].won) || 0), 0) >= 3 },
  { id: 'smoothTalker', icon: '🤥', name: 'Smooth Talker', title: 'Smooth Talker', how: 'Win 3 bluffing or voting games.', test: (s) => BLUFF.reduce((n, k) => n + ((s.byGame[k] && s.byGame[k].won) || 0), 0) >= 3 },
  { id: 'survivor', icon: '🧟', name: 'Survivor', title: 'the Survivor', how: 'Survive Zombie Survival.', test: (s) => s.survived >= 1 },
  { id: 'partyWin', icon: '🎉', name: 'Party Animal', title: 'Party Animal', how: 'Win a Party Mode.', test: (s) => s.partyWins >= 1 },
  { id: 'partyWin3', icon: '👑', name: 'Party Royalty', title: 'Party Royalty', how: 'Win 3 Party Modes.', test: (s) => s.partyWins >= 3 },
  { id: 'nights5', icon: '🌙', name: 'Night Owl', title: 'Night Owl', how: 'Play on 5 different nights.', test: (s) => s.nights >= 5 },
  { id: 'points100', icon: '💰', name: 'Point Hoarder', title: 'Point Hoarder', how: 'Earn 100 lifetime party points.', test: (s) => s.partyPts >= 100 },
  { id: 'points500', icon: '🏦', name: 'Point Tycoon', title: 'Tycoon', how: 'Earn 500 lifetime party points.', test: (s) => s.partyPts >= 500 },
  { id: 'crowdPleaser', icon: '📣', name: 'Crowd Pleaser', title: 'Crowd Favourite', how: 'Be voted the audience favourite.', test: (s) => s.audienceFavs >= 1 },
  { id: 'podium10', icon: '🥉', name: 'Podium Regular', title: 'Podium Regular', how: 'Finish in the top 3 ten times.', test: (s) => s.podiums >= 10 },
];
const TROPHY = Object.fromEntries(TROPHIES.map((t) => [t.id, t]));

const freshStats = () => ({ games: 0, wins: 0, podiums: 0, partyPts: 0, nights: 0, partiesPlayed: 0, partyWins: 0, bestParty: null, bestPlace: null, survived: 0, audienceFavs: 0, byGame: {} });
const cleanName = (s) => String(s || '').replace(/[\u0000-\u001f<>&"]/g, '').replace(/\s+/g, ' ').trim().slice(0, 14);
const PASSWORD_MIN = 4, PASSWORD_MAX = 64;
const validPassword = (pw) => typeof pw === 'string' && pw.length >= PASSWORD_MIN && pw.length <= PASSWORD_MAX && !/[\u0000-\u001f]/.test(pw);
const PASSWORD_RULE = `The password needs ${PASSWORD_MIN} to ${PASSWORD_MAX} characters.`;
const passHash = (pw, salt) => crypto.scryptSync(pw, salt, 32).toString('hex');
const newPassword = (pw) => { const salt = crypto.randomBytes(12).toString('hex'); return { salt, hash: passHash(pw, salt) }; };
const passMatches = (rec, pw) => !!rec && validPassword(pw) && crypto.timingSafeEqual(Buffer.from(rec.hash, 'hex'), Buffer.from(passHash(pw, rec.salt), 'hex'));

class BoxProfileStore {
  constructor(filename = null) {
    this.filename = filename;
    this.data = filename && fs.existsSync(filename) ? JSON.parse(fs.readFileSync(filename, 'utf8')) : { version: 1, profiles: {}, names: {} };
    if (this.data.version !== 1 || !this.data.profiles) throw new Error('Unsupported box profile store; preserve the file and migrate it before starting.');
    if (!this.data.names) this.data.names = {};
    for (const p of Object.values(this.data.profiles)) { p.stats = { ...freshStats(), ...(p.stats || {}) }; if (!Array.isArray(p.trophies)) p.trophies = []; if (!Array.isArray(p.nights)) p.nights = []; if (!Array.isArray(p.rooms)) p.rooms = [];
      // Older saves called the password a PIN (same scrypt hash): carry it over.
      if (p.pin && !p.password) p.password = p.pin;
      delete p.pin; }
    this.fails = new Map(); // name (or 'id:' + id) → { n, until }: password guessing slows down
    this.dirty = false;
  }
  // ---- storage ----
  save() {
    this.dirty = false;
    if (!this.filename) return;
    fs.mkdirSync(path.dirname(this.filename), { recursive: true });
    fs.writeFileSync(this.filename + '.tmp', JSON.stringify(this.data)); fs.renameSync(this.filename + '.tmp', this.filename);
  }
  // Many results at once (100 phones finishing a game) write the file once.
  saveSoon() { if (this.dirty) return; this.dirty = true; setImmediate(() => { if (this.dirty) { try { this.save(); } catch (e) { console.error('[box profiles] save failed:', e.message); } } }); }
  // ---- identity ----
  create(name) {
    const id = crypto.randomUUID(), token = crypto.randomBytes(32).toString('hex');
    this.data.profiles[id] = { id, verifiers: [digest(token)], name: cleanName(name) || null, claimed: null, password: null, created: Date.now(), stats: freshStats(), trophies: [], title: null, nights: [], rooms: [] };
    this.saveSoon();
    return { id, token };
  }
  get(id) { return typeof id === 'string' && Object.prototype.hasOwnProperty.call(this.data.profiles, id) ? this.data.profiles[id] : null; }
  authenticate(auth) {
    if (!auth || typeof auth !== 'object') return null;
    const p = this.get(auth.id);
    if (!p || typeof auth.token !== 'string' || !/^[a-f0-9]{64}$/.test(auth.token)) return null;
    const d = Buffer.from(digest(auth.token), 'hex');
    return p.verifiers.some((v) => crypto.timingSafeEqual(Buffer.from(v, 'hex'), d)) ? p : null;
  }
  // Save the profile under a name + password so another phone can sign in to it.
  // Once saved, the password only changes with changePassword (it needs the old one).
  claim(id, name, password) {
    const p = this.get(id); if (!p) return { ok: false, error: 'No profile.' };
    if (p.password) return { ok: false, error: 'Already saved as ' + p.claimed + '. Use “Change password” instead.' };
    name = cleanName(name); if (name.length < 2) return { ok: false, error: 'Pick a name (2+ letters).' };
    if (!validPassword(password)) return { ok: false, error: PASSWORD_RULE };
    const key = name.toLowerCase(), owner = this.data.names[key];
    if (owner && owner !== id) return { ok: false, error: 'That name is taken. Try another one.' };
    if (p.claimed && p.claimed.toLowerCase() !== key) delete this.data.names[p.claimed.toLowerCase()];
    p.password = newPassword(password); p.claimed = name; p.name = name; this.data.names[key] = id;
    this.save();
    return { ok: true, profile: this.view(id) };
  }
  // Sign in on a new phone: a fresh device token for the same profile.
  login(name, password) {
    const key = cleanName(name).toLowerCase(), now = Date.now();
    const f = this.fails.get(key); if (f && f.until > now) return { ok: false, error: 'Too many tries. Wait a minute and try again.' };
    const p = this.get(this.data.names[key]);
    const ok = p && passMatches(p.password, password);
    if (!ok) { this.failed(key, f, now); return { ok: false, error: 'That name and password don’t match.' }; }
    this.fails.delete(key);
    const token = crypto.randomBytes(32).toString('hex');
    p.verifiers.push(digest(token)); if (p.verifiers.length > MAX_DEVICES) p.verifiers.splice(0, p.verifiers.length - MAX_DEVICES);
    this.save();
    return { ok: true, id: p.id, token, profile: this.view(p.id) };
  }
  failed(key, f, now) { const n = ((f && f.n) || 0) + 1; this.fails.set(key, { n, until: n >= 5 ? now + 60000 : 0 }); if (this.fails.size > 5000) this.fails.clear(); }
  // A new password for a saved profile: needs the old one (wrong guesses slow down too).
  changePassword(id, oldPassword, password) {
    const p = this.get(id); if (!p) return { ok: false, error: 'No profile.' };
    if (!p.password) return { ok: false, error: 'Save your profile with a name and password first.' };
    const key = 'id:' + id, now = Date.now(), f = this.fails.get(key);
    if (f && f.until > now) return { ok: false, error: 'Too many tries. Wait a minute and try again.' };
    if (!passMatches(p.password, oldPassword)) { this.failed(key, f, now); return { ok: false, error: 'Your current password is not right.' }; }
    if (!validPassword(password)) return { ok: false, error: PASSWORD_RULE };
    this.fails.delete(key);
    p.password = newPassword(password); this.save();
    return { ok: true, profile: this.view(id) };
  }
  // Sign out on this phone: its token stops working (the profile and other phones keep going).
  forgetDevice(auth) {
    const p = this.authenticate(auth); if (!p) return false;
    const d = digest(auth.token); p.verifiers = p.verifiers.filter((v) => v !== d); this.save();
    return true;
  }
  // ---- JustGold (docs/justgold.md): the account's wallet is a JustMafia profile id ----
  walletOf(id) { const p = this.get(id); return p && typeof p.wallet === 'string' ? p.wallet : null; }
  setWallet(id, walletId) { const p = this.get(id); if (!p || typeof walletId !== 'string') return false; p.wallet = walletId; this.save(); return true; }
  // The account a wallet belongs to (so one JustMafia profile is never linked twice).
  ownerOfWallet(walletId) { for (const p of Object.values(this.data.profiles)) if (p.wallet === walletId) return p.id; return null; }
  setName(id, name) { const p = this.get(id); name = cleanName(name); if (p && name && !p.claimed) { p.name = name; this.saveSoon(); } }
  setTitle(id, trophyId) {
    const p = this.get(id); if (!p) return { ok: false, error: 'No profile.' };
    if (trophyId == null || trophyId === '') { p.title = null; this.saveSoon(); return { ok: true, profile: this.view(id) }; }
    if (!p.trophies.some((t) => t.id === trophyId)) return { ok: false, error: 'Earn that trophy first.' };
    p.title = trophyId; this.saveSoon();
    return { ok: true, profile: this.view(id) };
  }
  titleOf(id) { const p = this.get(id); return p && p.title && TROPHY[p.title] ? TROPHY[p.title].title : null; }
  // ---- results ----
  // One night = one box room. The first result in a room counts the night.
  night(p, roomKey, label) {
    if (!roomKey || p.rooms.includes(roomKey)) return p.nights.find((n) => n.room === roomKey) || null;
    p.rooms.push(roomKey); if (p.rooms.length > MAX_ROOMS) p.rooms.shift();
    p.stats.nights++;
    const n = { room: roomKey, at: Date.now(), label: label || null, games: 0, wins: 0, pts: 0, place: null };
    p.nights.push(n); if (p.nights.length > MAX_NIGHTS) p.nights.shift();
    return n;
  }
  // A finished game: { game, place (1 = won), of, pts (party points), survived, room }.
  recordGame(id, r) {
    const p = this.get(id); if (!p || !r || typeof r.game !== 'string') return [];
    const s = p.stats, g = s.byGame[r.game] || (s.byGame[r.game] = { played: 0, won: 0, best: null });
    s.games++; g.played++;
    const place = Number(r.place) || null;
    if (place === 1) { s.wins++; g.won++; }
    if (place && place <= 3 && (r.of || 0) >= 2) s.podiums++;
    if (place && (g.best == null || place < g.best)) g.best = place;
    if (place && (s.bestPlace == null || place < s.bestPlace)) s.bestPlace = place;
    s.partyPts += Math.max(0, Number(r.pts) || 0);
    if (r.survived) s.survived++;
    const n = this.night(p, r.room, r.label);
    if (n) { n.games++; if (place === 1) n.wins++; n.pts += Math.max(0, Number(r.pts) || 0); }
    this.saveSoon();
    return this.checkTrophies(p);
  }
  // Extra party points (e.g. the audience favourite bonus).
  bump(id, stat, n = 1, pts = 0, room = null) {
    const p = this.get(id); if (!p || !(stat in p.stats) || typeof p.stats[stat] !== 'number') return [];
    p.stats[stat] += n; p.stats.partyPts += pts;
    const night = room && p.nights.find((x) => x.room === room); if (night) night.pts += pts;
    this.saveSoon();
    return this.checkTrophies(p);
  }
  // A whole Party Mode finished: place on the final standings.
  recordParty(id, { place, of, room } = {}) {
    const p = this.get(id); if (!p) return [];
    p.stats.partiesPlayed++;
    if (place === 1 && of >= 2) p.stats.partyWins++;
    if (place && (p.stats.bestParty == null || place < p.stats.bestParty)) p.stats.bestParty = place;
    const night = room && p.nights.find((x) => x.room === room); if (night) night.place = place;
    this.saveSoon();
    return this.checkTrophies(p);
  }
  checkTrophies(p) {
    const have = new Set(p.trophies.map((t) => t.id)), out = [];
    for (const t of TROPHIES) {
      if (have.has(t.id)) continue;
      let ok = false; try { ok = t.test(p.stats); } catch { ok = false; }
      if (ok) { p.trophies.push({ id: t.id, at: Date.now() }); out.push({ id: t.id, icon: t.icon, name: t.name, title: t.title }); }
    }
    return out;
  }
  // What the phone shows: stats, the whole trophy case (earned or not) and recent nights.
  view(id) {
    const p = this.get(id); if (!p) return null;
    const got = new Map(p.trophies.map((t) => [t.id, t.at]));
    return {
      id: p.id, name: p.name, claimed: p.claimed, hasPassword: !!p.password, hasPin: !!p.password, created: p.created, title: p.title, titleText: this.titleOf(id),
      stats: { ...p.stats, byGame: Object.entries(p.stats.byGame).map(([game, g]) => ({ game, ...g })).sort((a, b) => b.played - a.played || b.won - a.won) },
      trophies: TROPHIES.map((t) => ({ id: t.id, icon: t.icon, name: t.name, title: t.title, how: t.how, earned: got.has(t.id), at: got.get(t.id) || null })),
      nights: p.nights.slice().reverse().map(({ room, ...n }) => n),
      storage: this.filename ? 'Saved on this game server' : 'Session-only storage',
    };
  }
}

module.exports = { BoxProfileStore, TROPHIES, GUESSING, PASSWORD_MIN, PASSWORD_MAX };
