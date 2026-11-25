'use strict';
// JustZombies: a top-down survival shooter played ON THE PHONE. Each phone runs its own area
// (zombies, bullets, pickups, XP) locally, so there is no input lag over LAN or online; the server
// only keeps the world: the grid of areas (looks generated from the room seed, see
// public/box/games/trash-world.js), which cell each player is in, their run stats (sanity-checked),
// the explored map and the kill feed for the TV, and the co-op areas.
//
// Co-op: when a player walks into a cell where another (human) player is, they share that area.
// The player who was there first is the area HOST: their phone keeps simulating the zombies and
// sends compact snapshots (~15 a second) through the server's live relay (socket 'player:live' ->
// game.live(p, msg) -> 'live' to the other phones). Guests send their position/aim and the hits
// their own bullets land; everyone draws everyone's shots. If the host walks out or drops, the next
// player in the area becomes host and carries on from the last snapshot.
const W = require('../../public/box/games/trash-world');
const S = require('../../public/box/games/trash-story');
const PL = require('../../public/box/games/trash-shop');
const AR = require('../../public/box/games/trash-arms');
const X = require('../../public/box/games/trash-extra');

const opt = (pairs) => pairs.map(([value, label]) => ({ value, label }));
const fields = [
  { key: 'mode', label: 'Mode', options: opt([['story', '📖 Regular: break the gates, find the key, beat the boss'], ['endless', '♾️ Endless: waves forever, no story'], ['score', '🏆 Score attack: timed, highest score wins'], ['garage', '🏚️ Garage Defense: explore, then hold your garage on horde nights']]) },
  { key: 'length', label: 'Run length (Endless / Score / Garage)', options: opt([['endless', '♾️ Endless (until everyone falls)'], ['w20', '🏁 Survive to wave 20'], ['m5', '⏱ 5 minutes'], ['m10', '⏱ 10 minutes'], ['m15', '⏱ 15 minutes'], ['m20', '⏱ 20 minutes'], ['m30', '⏱ 30 minutes']]) },
  { key: 'diff', label: 'Difficulty', options: opt([['chill', '🟢 Chill'], ['normal', '🟡 Normal'], ['hard', '🔴 Hard']]) },
  { key: 'aim', label: 'Auto-aim (touch)', options: opt([['on', '🎯 On: just move, it shoots the nearest'], ['off', '🕹️ Off: aim with the right stick']]) },
  { key: 'xp', label: 'Co-op XP', options: opt([['shared', '🤝 Shared in the same area'], ['own', '🙋 Your own kills only']]) },
];
const defaults = { mode: 'story', length: 'endless', diff: 'normal', aim: 'on', xp: 'shared' };
const PF = require('../party-fit');
const MINUTES = { m5: 5, m10: 10, m15: 15, m20: 20, m30: 30 };
// Party Mode: a timed Score attack. It lasts exactly the party plan's minutes for this game (start()
// reads them; the length option below is only the label), and the highest score wins.
const partyFit = ({ minutes: M }) => { const { length } = PF.best({ length: ['m10', 'm5', 'm15', 'm20'] }, (s) => 0.6 + MINUTES[s.length], M); return { mode: 'score', length }; };
const PINGS = { here: '📍 Over here!', health: '❤️ Need health!', boss: '☠️ Boss here!', help: '🆘 Come help!', place: '📣 Found a place!', go: '🧭 Let’s go here!' };
const SCORE_PENALTY = 0.15, SCORE_RESPAWN_MS = 5000, DOWN_MS = 40000;
const REVIVE_MS = 15000, TICK = 1000, ALL_DOWN_MS = 45000, FEED = 10, HOST_DROP_MS = 2500, EMPTY_MS = 3 * 60000;
const LIVE_KINDS = new Set(['snap', 'in', 'hit', 'grab', 'give', 'fx', 'need', 'tv']);
const BREAK_S = 30; // the break between waves (public/box/games/trash-sim.js): then the next wave starts by itself
const KF = 12, SPOT_LOW = 0.35, SPOT_HOLD = 4000, RECAP_MS = 9000, RECAP_EVERY = 4 * 60000, CARD_MS = 5500;
const key = (c) => c[0] + ',' + c[1];
const int = (v, lo, hi) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : lo; };

// The JustZombies part of a box profile (unlocks bought with scrap), made safe to use.
function metaFix(prof) {
  let M = prof.trash; if (!M || typeof M !== 'object') M = prof.trash = X.blankMeta();
  if (!Array.isArray(M.own)) M.own = []; if (!M.pick || typeof M.pick !== 'object') M.pick = { cls: null, wp: null, fit: null, tier: null };
  for (const k of ['scrap', 'earned', 'runs']) if (!Number.isFinite(M[k])) M[k] = 0;
  return M;
}

class Game {
  constructor(room, s) {
    this.room = room; this.s = s; this.phase = 'play';
    this.seed = Math.floor(room.rng() * 2147483647) + 1;
    this.runs = new Map(); // player id -> run
    this.areas = new Map(); // "x,y" -> { host, members: [ids] } (humans only)
    this.explored = new Map(); // "x,y" -> { by, at }
    this.homes = []; // garage cells ([x, y]), they keep the home look for good
    this.feed = []; this.fseq = 0;
    this.outbox = []; // live messages when there is no socket server (tests)
    this.startedAt = 0; this.endsAt = 0; this.timer = null; this.flushT = null; this.overWhy = '';
    this.allDownSince = 0;
    this.plan = null; this.story = null; this.beatSeq = 0; // Regular mode (trash-story.js)
    this.found = new Map(); // "x,y" -> { type, by } places the team has discovered (shops, merchants, the crucible)
    this.pings = []; this.pseq = 0; this.stashes = new Map(); // call-outs on the map; hidden stashes revealed by maps
    // phase 3: the TV (kill feed, highlight moments + recap, boss intro cards, the spotlight)
    this.kfeed = []; this.kseq = 0; this.moments = []; this.mseq = 0; this.recap = null; this.recapSeq = 0; this.lastRecapAt = 0; this.bossCard = null; this.cardSeq = 0;
    this.spot = null; // { id, why, since }: the player in trouble the TV follows (their phone streams a view)
    // helpers: players who are down or out, and people watching on a phone
    this.helpers = new Map(); this.poll = null; this.pollSeq = 0; this.lastPollAt = 0; this.nextEv = null; this.evSeq = 0; this.leaderHitAt = 0;
    this.weather = { k: 'clear', n: 0, until: 0 }; this.survivors = new Map(); // survivor id ("x,y") -> { state: 'escort'|'safe'|'lost', by }
    this.gd = null; this.party = false; this.giftSeq = 0;
    // area locks (every mode): blocks open as the team's zombie kills rise (trash-story.js locks());
    // opened = block indexes that are open for good; chests = loot chests opened ("x,y" -> { took: [ids] })
    this.lockPlan = null; this.opened = new Set(); this.chests = new Map(); this.noLocks = false;
  }
  get isStory() { return this.s.mode === 'story'; }
  get isScore() { return this.s.mode === 'score'; }
  get isGarage() { return this.s.mode === 'garage'; }
  get ranked() { return this.isScore || this.isGarage; } // score decides the standings
  // ---------------- life cycle ----------------
  start() {
    this.startedAt = this.room.now();
    let m = MINUTES[this.s.length];
    if (this.isScore) { m = m || 10; const pm = this.room.partyMode; if (pm && pm.plan && pm.defs && pm.defs[pm.index] === this.room.def && !this.room.practice && pm.plan.trash) m = pm.plan.trash; } // party: exactly the plan's minutes
    if (m) { this.endsAt = this.startedAt + m * 60000; this.minutes = m; }
    // Party Mode: everyone starts equal (no unlocks, no loadouts) and nobody earns scrap.
    const pm = this.room.partyMode; this.party = !!(pm && pm.defs && pm.defs[pm.index] === this.room.def && !this.room.practice);
    this.weather = { k: 'clear', n: 0, until: this.startedAt + X.WX.firstMs }; this.lastRecapAt = this.lastPollAt = this.startedAt;
    if (this.isGarage) this.gd = { night: 0, phase: 'explore', next: X.GARAGE.every, hope: X.GARAGE.hope, endsAt: 0, ready: new Set(), done: new Set(), broke: [], survived: 0 };
    for (const p of this.room.list()) this.newRun(p, true);
    if (this.isStory) {
      this.endsAt = 0; // Regular mode ends with the boss (or everyone down), not the clock
      this.plan = S.plan(this.seed, this.homes); this.plan.homes = this.homes.map((h) => h.slice());
      this.story = { tier: 0, keys: [], maps: 0, taken: {}, doorFound: false, doorOpen: false, beats: [], finds: [] };
      this.beat('start');
    }
    this.makeLocks(); this.lockCheck(true);
    this.tick();
  }
  // ---------------- Regular mode ----------------
  humans() { return this.room.list().filter((p) => !p.bot); }
  teamKills() { let n = 0; for (const R of this.runs.values()) n += R.kills + (R.bank || 0); return n; }
  need(tier) { return S.need(tier, Math.max(1, this.humans().length)); }
  beat(k, extra) { const text = S.BEATS[k]; if (!text) return; this.story.beats.push({ n: ++this.beatSeq, k, text, extra: extra || null }); if (this.story.beats.length > 4) this.story.beats.shift(); this.news('📻', 'Radio: ' + text.split('. ')[0].replace(/\.$/, '') + '.'); }
  storyCheck() {
    const st = this.story; if (!st || this.phase !== 'play') return;
    const k = this.teamKills();
    while (st.tier < S.MAX_TIER && k >= this.need(st.tier + 1)) {
      st.tier++; this.beat('tier' + st.tier); this.soon(); // the radio's next beat (the gates themselves: lockCheck)
    }
  }
  // ---------------- area locks (every mode) ----------------
  makeLocks() {
    const old = this.lockPlan, homes = this.plan ? this.plan.homes : this.homes;
    let L = S.locks(this.seed, homes, { mode: this.s.mode, party: this.party, fixed: old ? old.fixed : undefined });
    if (old) L = { ...L, req: L.req.map((v, i) => Math.min(v, old.req[i])) }; // a new garage: nothing that was easier gets harder
    this.lockPlan = L;
  }
  reqAt(x, y) { const L = this.lockPlan; if (!L || !W.inGrid(x, y)) return 0; return S.lockNeed(L.req[y * W.GRID + x], this.humans().length); }
  locked(x, y) { if (this.noLocks || !this.lockPlan || !W.inGrid(x, y)) return false; const i = y * W.GRID + x; return !this.opened.has(i) && this.teamKills() < this.reqAt(x, y); }
  // what a special block is, as far as the team knows (the lair stays a mystery until the maps or the door)
  kindShown(i) {
    const L = this.lockPlan, k = L && L.kind[i]; if (!k) return null; const c = (i % W.GRID) + ',' + Math.floor(i / W.GRID);
    if (k === 'lair') return this.story && (this.story.doorFound || this.story.maps >= 2) ? 'lair' : '?';
    return this.explored.has(c) || this.found.has(c) ? k : '?';
  }
  // newly opened blocks: the news (specials by name), the unlock sound; quiet = the ones open from the start
  lockCheck(quiet) {
    const L = this.lockPlan; if (!L || (this.phase !== 'play' && !quiet)) return;
    const kills = this.teamKills(), N = W.GRID, now = [];
    for (let i = 0; i < N * N; i++) if (!this.opened.has(i) && kills >= this.reqAt(i % N, Math.floor(i / N))) { this.opened.add(i); now.push(i); }
    if (quiet || !now.length) return;
    let plain = 0;
    for (const i of now) {
      const k = this.kindShown(i), c = (i % N) + ',' + Math.floor(i / N), pl = PL.placeAt(this.seed, i % N, Math.floor(i / N), this.homes), Sp = S.SPECIAL[k];
      if (!L.kind[i]) { plain++; continue; }
      this.news(k === 'shop' && pl ? PL.PLACES[pl].icon : Sp ? Sp.icon : '⭐', `🔓 The big gate is open: ${k === 'shop' && pl ? 'the ' + PL.PLACES[pl].name : Sp ? Sp.name : 'a special area'}${this.explored.has(c) ? '' : ' (somewhere out there)'}! Expect tough zombies.`);
    }
    if (plain) this.news('🔓', `${plain} more block${plain > 1 ? 's' : ''} of town opened up (${kills} team kills)`);
    this.room.fx('tzunlock', { n: now.length }); this.soon();
  }
  lockView() {
    const L = this.lockPlan; if (!L) return null; const N = W.GRID, req = [], kind = [];
    for (let i = 0; i < N * N; i++) { req.push(this.opened.has(i) ? 0 : this.reqAt(i % N, Math.floor(i / N))); kind.push(this.kindShown(i)); }
    return { req, kind, kills: this.teamKills() };
  }
  // a loot chest in a loot stash or a zombie den (every player opens it once)
  chest(p, R, m) {
    const L = this.lockPlan, k = key(R.cell), kind = L && L.kind[R.cell[1] * W.GRID + R.cell[0]];
    if (m.cell != null && String(m.cell) !== k) return { ok: false, error: 'That chest isn’t here.' };
    if (kind !== 'vault' && kind !== 'den') return { ok: false, error: 'No chest here.' };
    if (R.state !== 'play') return { ok: false, error: 'You’re down.' };
    const C = this.chests.get(k) || { took: [] }; if (C.took.includes(p.id)) return { ok: false, error: 'You already emptied this chest.' };
    C.took.push(p.id); this.chests.set(k, C);
    const big = kind === 'vault', cash = Math.round((big ? 140 : 80) * (1 + 0.1 * Math.max(0, R.wave - 1))), PK = ['shield', 'minigun', 'rockets', 'raygun', 'freeze', 'snack', 'xp2', 'nuke'];
    const loot = []; for (let i = 0; i < (big ? 3 : 2); i++) loot.push(PK[Math.floor(this.room.rng() * PK.length)]);
    this.news(big ? '💎' : '🧟', `${p.name} cracked open the ${big ? 'loot stash' : 'den'} chest (+$${cash})`, p.id); this.room.fx('tzchest', { id: p.id, kind });
    this.moment('chest', p, cash, `${p.name} cracked open a ${big ? 'loot stash' : 'zombie den'} chest`); this.soon();
    return { ok: true, cash, loot, weapon: big };
  }
  joined(p) { if (this.phase === 'play' && !this.runs.has(p.id)) this.newRun(p, true); }
  left(p) { const id = p && p.id ? p.id : p; this.leaveArea(id); }
  tick() {
    this.room.cancel(this.timer);
    if (this.phase !== 'play') return;
    const now = this.room.now();
    for (const p of this.room.list()) if (p.bot) this.botStep(p, now);
    for (const R of this.runs.values()) if (R.state === 'down' && now - R.downAt > DOWN_MS) { R.state = 'dead'; R.deadAt = now; R.reviveAt = now + REVIVE_MS; }
    this.pings = this.pings.filter((q) => now - q.at < 30000);
    this.phase3(now); if (this.phase !== 'play') return;
    // An area host whose phone dropped: the next player in the area takes over.
    for (const [k, A] of this.areas) {
      const h = this.room.get(A.host);
      if (!h || (h.sockets <= 0 && !h.bot)) { if (!A.dropAt) A.dropAt = now; else if (now - A.dropAt > HOST_DROP_MS) { const next = A.members.find((id) => id !== A.host && (this.room.get(id) || {}).sockets > 0); if (next) { A.host = next; A.dropAt = 0; this.tellArea(k, { t: 'host' }); } } } else A.dropAt = 0;
    }
    if (this.endsAt && now >= this.endsAt) return this.end('time');
    this.lockCheck();
    if (this.story) {
      this.storyCheck();
      const runs = this.humans().map((p) => this.runs.get(p.id)).filter(Boolean);
      if (runs.length && runs.every((R) => R.state === 'dead' || R.state === 'down')) return this.end('lost');
    }
    // Endless (and wave 20): when everyone is down for a while, the night is over.
    const humans = this.room.list().filter((p) => !p.bot), alive = [...this.runs.values()].some((R) => R.state !== 'dead' && (!R.bot || !humans.length));
    if (!alive && this.runs.size) { if (!this.allDownSince) this.allDownSince = now; else if (now - this.allDownSince > (humans.length ? ALL_DOWN_MS : 8000)) return this.end('down'); } else this.allDownSince = 0;
    // Nobody's phone connected for a few minutes (everyone left, or only bots): wrap up.
    if (!humans.some((p) => p.sockets > 0)) { if (!this.emptySince) this.emptySince = now; else if (now - this.emptySince > EMPTY_MS) return this.end('empty'); } else this.emptySince = 0;
    this.timer = this.room.after(TICK, () => this.tick());
  }
  end(why = 'host') {
    if (this.phase === 'over') return;
    this.phase = 'over'; this.overWhy = why; this.endsAt = 0;
    this.room.cancel(this.timer); this.room.cancel(this.flushT);
    for (const R of this.runs.values()) this.keepBest(R);
    this.spot = null; if (this.poll) this.closePoll();
    this.payScrap(why);
    this.room.fx('win');
  }
  // ---------------- unlocks: scrap at the end of the night (kept on the profile; never in Party Mode) ----------------
  metaOf(p) { const prof = p && p.profileId && this.room.profiles && typeof this.room.profiles.get === 'function' ? this.room.profiles.get(p.profileId) : null; return prof ? metaFix(prof) : null; }
  loadOf(p) {
    if (this.party || !p || p.bot) return null; const M = this.metaOf(p); if (!M) return null;
    const L = {}; for (const k of ['cls', 'wp', 'fit', 'tier']) L[k] = X.pickOk(M, k, M.pick[k]) ? M.pick[k] || null : null;
    L.classes = M.own.filter((id) => id.startsWith('cls:')).map((id) => id.slice(4)).filter((c) => AR.CLASSES[c]);
    return L;
  }
  payScrap(why) {
    if (this.party) return;
    for (const p of this.humans()) {
      const R = this.runs.get(p.id); if (!R || R.scrap != null) continue;
      const kills = R.kills + (R.bank || 0), wave = Math.max(R.wave, (R.best && R.best.wave) || 0);
      const n = X.scrapFor({ kills, wave, rescues: R.rescues || 0, nights: R.nights || 0, won: why === 'win' || why === 'w20', tier: R.load && R.load.tier });
      R.scrap = n; const prof = p.profileId && this.room.profiles && this.room.profiles.get(p.profileId); if (!prof) { R.scrapGuest = true; continue; }
      const M = metaFix(prof); M.scrap += n; M.earned += n; M.runs++; M.best = Math.max(M.best || 0, wave);
      try { if (this.room.profiles.saveSoon) this.room.profiles.saveSoon(); } catch (e) { console.error('[trash scrap]', e.message); }
      this.news('🔩', `${p.name} hauled home ${n} scrap`, p.id);
    }
  }
  // ---------------- phase 3, once a second ----------------
  phase3(now) {
    // gameplay weather: clear for a bit, then it turns every few minutes (every phone shows the banner)
    if (now >= this.weather.until) { const L = ['rain', 'fog', 'heat', 'clear'].filter((k) => k !== this.weather.k); this.setWeather(L[Math.floor(this.room.rng() * L.length)], now); }
    // helpers regain energy while they're down or out (the audience regains it as it goes, see helperOf)
    for (const R of this.runs.values()) if (!R.bot && (R.state === 'dead' || R.state === 'down')) this.energy('p:' + R.id, now);
    this.pollStep(now); this.spotStep(now); if (this.gd) this.garageStep(now);
    if (this.phase !== 'play') return;
    if (this.recap && now - this.recap.at > RECAP_MS) this.recap = null;
    if (!this.recap && now - this.lastRecapAt > RECAP_EVERY && this.moments.some((m) => m.at > this.lastRecapAt)) this.makeRecap('⭐ Best moment so far', now);
  }
  setWeather(k, now = this.room.now()) {
    if (!X.WEATHER[k]) return false; const was = this.weather.k;
    this.weather = { k, n: this.weather.n + 1, until: now + X.WX.everyMs };
    if (k !== was) { const Wd = X.WEATHER[k]; this.news(Wd.icon, k === 'clear' ? 'The weather clears up.' : `${Wd.name}! ${Wd.tip}.`); this.room.fx('tzweather', { k }); this.soon(); }
    return true;
  }
  // ---------------- the TV: kill feed, moments, the recap, boss cards ----------------
  killNews(p, R, kf) {
    let n = 0, boss = null, elite = 0; const types = {};
    for (const e of kf.slice(0, 20)) { if (!Array.isArray(e)) continue; const t = Object.keys(W.ZOMBIES)[int(e[0], 0, 99)], c = int(e[1], 0, 200); if (!t || !c) continue; n += c; if (e[2]) elite += c; if (W.ZOMBIES[t].boss) boss = t; else types[t] = (types[t] || 0) + c; }
    if (!n) return;
    const top = Object.entries(types).sort((a, b) => b[1] - a[1])[0];
    const text = boss ? `took down ${boss === 'final' && this.plan ? S.BOSSES[this.plan.boss].name : W.ZOMBIES[boss].name}!` : `✖ ${n} zombie${n > 1 ? 's' : ''}${top && top[1] > 1 && top[0] !== 'walker' ? ` (${top[1]} ${W.ZOMBIES[top[0]].name}s)` : ''}${elite ? ' · ⭐ elite' : ''}`;
    this.kfeed.push({ n: ++this.kseq, id: p.id, name: p.name, color: p.color, icon: boss ? '☠️' : n >= 5 ? '💥' : '🔫', text, at: this.room.now(), big: !!boss || n >= 6 });
    if (this.kfeed.length > KF) this.kfeed.shift();
  }
  moment(kind, p, value, text) {
    const m = { n: ++this.mseq, kind, id: p ? p.id : null, name: p ? p.name : '', color: p ? p.color : '#fff', avatar: p ? p.avatar : '', value: value || 0, text, wave: p && this.runs.get(p.id) ? this.runs.get(p.id).wave : 0, at: this.room.now() };
    m.w = X.momentWeight(m); this.moments.push(m); if (this.moments.length > 30) this.moments.shift(); return m;
  }
  makeRecap(title, now = this.room.now()) {
    const since = this.lastRecapAt, L = this.moments.filter((m) => m.at > since); if (!L.length) return null;
    const best = L.slice().sort((a, b) => b.w - a.w || b.at - a.at)[0], R = best.id && this.runs.get(best.id);
    const top = this.standings()[0];
    this.recap = { n: ++this.recapSeq, at: now, title, m: best, stats: { kills: R ? R.kills : 0, wave: R ? R.wave : 0, lvl: R ? R.lvl : 0, score: R ? R.score || 0 : 0, cls: R ? R.cls || null : null }, lead: top ? { name: top.name, score: top.score, kills: top.kills } : null, count: L.length };
    this.lastRecapAt = now; this.lastRecap = this.recap; this.room.fx('tzrecap', { n: this.recap.n }); this.soon(); return this.recap;
  }
  card(key, by, kind) {
    const B = kind === 'final' ? S.BOSSES[key] : W.ZOMBIES[key] || {}, F = S.BOSSES[key] || {};
    this.bossCard = { n: ++this.cardSeq, key, kind, name: B.name || F.name || 'Boss', icon: F.icon || (key === 'boss' ? '🗑️' : '☠️'), desc: F.desc || (key === 'boss' ? 'A walking dumpster. It charges.' : ''), by: by ? this.room.name(by) : '', at: this.room.now() };
    this.room.fx('tzcard', { n: this.bossCard.n, key });
  }
  // ---------------- the spotlight: the TV follows whoever is in trouble ----------------
  spotStep(now) {
    const cand = this.humans().map((p) => this.runs.get(p.id)).filter((R) => R && (R.state === 'down' || (R.state === 'play' && R.hp > 0 && R.mhp && R.hp / R.mhp < SPOT_LOW))).map((R) => ({ R, s: R.state === 'down' ? -1 : R.hp / R.mhp }));
    cand.sort((a, b) => a.s - b.s);
    const cur = this.spot && this.runs.get(this.spot.id), still = cur && (cur.state === 'down' || (cur.state === 'play' && cur.hp > 0 && cur.hp / cur.mhp < 0.5));
    let next = null;
    if (still && now - this.spot.since < SPOT_HOLD) next = this.spot.id; // hold on a moment (no flicker)
    else if (cand.length) next = cand[0].R.id; else if (still) next = this.spot.id;
    if ((next || null) !== (this.spot ? this.spot.id : null)) {
      if (this.spot) this.send(this.spot.id, { t: 'spot', on: false });
      this.spot = next ? { id: next, since: now } : null;
      if (next) this.send(next, { t: 'spot', on: true });
      this.soon();
    }
    if (this.spot) { const R = this.runs.get(this.spot.id); this.spot.why = R.state === 'down' ? 'down' : 'low'; }
  }
  // ---------------- helpers: energy, supply crates, the event vote, hordes at the leader ----------------
  energy(hid, now = this.room.now(), regen = true) {
    let H = this.helpers.get(hid); if (!H) { H = { e: X.HELP.start, at: now, crateAt: -1e9, hordeAt: -1e9, voted: 0 }; this.helpers.set(hid, H); }
    if (regen) H.e = Math.min(X.HELP.max, H.e + (X.HELP.regen * Math.max(0, now - H.at)) / 1000); H.at = now;
    return H;
  }
  helperState(hid, now = this.room.now()) {
    const H = this.helpers.get(hid) || { e: X.HELP.start, crateAt: -1e9, hordeAt: -1e9, voted: 0 };
    return { e: Math.floor(H.e), max: X.HELP.max, crateIn: Math.max(0, H.crateAt + X.HELP.crate.cd - now), hordeIn: Math.max(0, H.hordeAt + X.HELP.horde.cd - now), voted: this.poll && H.voted === this.poll.id ? H.vote || true : null };
  }
  leader() { if (!this.isScore) return null; const L = this.standings().filter((r) => { const R = this.runs.get(r.id); return R && R.state === 'play'; }); return L[0] || null; }
  // who: { hid, name, id (player id or null), color }. Players help only while down or out.
  help(who, m) {
    const now = this.room.now(), k = String(m.k || '');
    if (this.phase !== 'play') return { ok: false, error: 'The night is over.' };
    const regen = !who.id || ['dead', 'down'].includes((this.runs.get(who.id) || {}).state);
    if (who.id && !regen) return { ok: false, error: 'Helpers are players who are down or out (or watching).' };
    const H = this.energy(who.hid, now, regen), C = X.HELP;
    if (k === 'state') return { ok: true, quiet: true, me: this.helperState(who.hid, now) };
    if (k === 'crate') {
      const T = this.runs.get(String(m.to || '')), tp = T && this.room.get(T.id);
      if (!T || !tp || tp.bot || T.state !== 'play' || T.id === who.id) return { ok: false, error: 'Pick a teammate who is still fighting.' };
      if (now - H.crateAt < C.crate.cd) return { ok: false, error: `Next crate in ${Math.ceil((H.crateAt + C.crate.cd - now) / 1000)} s.` };
      if (H.e < C.crate.cost) return { ok: false, error: `A crate needs ${C.crate.cost} ⚡ energy.` };
      H.e -= C.crate.cost; H.crateAt = now; this.gift(T, { kind: 'crate', from: who.name });
      this.news('📦', `${who.name} dropped a supply crate near ${tp.name}`, who.id); this.room.fx('tzcrate', { to: T.id });
    } else if (k === 'vote') {
      const P = this.poll; if (!P) return { ok: false, error: 'No vote right now.' };
      if (!P.opts.includes(String(m.ev))) return { ok: false, error: 'Pick one of the events.' };
      if (H.voted === P.id) return { ok: false, error: 'You already voted.' };
      if (H.e < C.vote.cost) return { ok: false, error: `A vote needs ${C.vote.cost} ⚡ energy.` };
      H.e -= C.vote.cost; H.voted = P.id; H.vote = String(m.ev); P.votes.set(who.hid, String(m.ev));
    } else if (k === 'horde') {
      if (!this.isScore) return { ok: false, error: 'Hordes can only be sent in Score attack.' };
      const L = this.leader(); if (!L || L.id === who.id) return { ok: false, error: 'Nobody to send them at.' };
      if (now - H.hordeAt < C.horde.cd) return { ok: false, error: `Next horde in ${Math.ceil((H.hordeAt + C.horde.cd - now) / 1000)} s.` };
      if (now - this.leaderHitAt < C.horde.leaderCd) return { ok: false, error: `${L.name} just got one. Wait ${Math.ceil((this.leaderHitAt + C.horde.leaderCd - now) / 1000)} s.` };
      if (H.e < C.horde.cost) return { ok: false, error: `A horde needs ${C.horde.cost} ⚡ energy.` };
      const T = this.runs.get(L.id); H.e -= C.horde.cost; H.hordeAt = now; this.leaderHitAt = now;
      this.gift(T, { kind: 'horde', from: who.name, cnt: X.sentHorde(T.wave) });
      this.news('🧟', `${who.name} sent a horde after the leader, ${L.name}!`, who.id); this.room.fx('tzsent', { to: T.id });
    } else return { ok: false, error: 'Unknown helper move.' };
    this.soon();
    return { ok: true, me: this.helperState(who.hid, now) };
  }
  gift(T, g) { T.gifts = (T.gifts || []).concat({ n: ++this.giftSeq, ...g }).slice(-6); }
  pollStep(now) {
    if (this.poll && now >= this.poll.endsAt) this.closePoll(now);
    if (this.poll || now - this.lastPollAt < X.HELP.pollEvery) return;
    if (!this.helperCount()) return;
    const L = Object.keys(X.VOTE_EVENTS); for (let i = L.length - 1; i > 0; i--) { const j = Math.floor(this.room.rng() * (i + 1)); [L[i], L[j]] = [L[j], L[i]]; }
    this.poll = { id: ++this.pollSeq, opts: L.slice(0, 3), votes: new Map(), endsAt: now + X.HELP.pollMs }; this.lastPollAt = now;
    this.news('🗳️', 'Helpers: vote on the next area event!'); this.soon();
  }
  closePoll(now = this.room.now()) {
    const P = this.poll; this.poll = null; if (!P) return null;
    const c = {}; for (const v of P.votes.values()) c[v] = (c[v] || 0) + 1; const top = P.opts.slice().sort((a, b) => (c[b] || 0) - (c[a] || 0))[0];
    if (!c[top]) return null;
    this.nextEv = { n: ++this.evSeq, k: top, votes: c[top] }; const E = X.VOTE_EVENTS[top];
    this.news('🗳️', `The helpers voted: next up, a ${E.name}! ${E.icon}`); this.room.fx('tzvote', { k: top }); this.soon(); void now;
    return this.nextEv;
  }
  helperCount() { let n = 0; for (const R of this.runs.values()) if (!R.bot && (R.state === 'dead' || R.state === 'down')) n++; return n + (this.room.audienceCount ? this.room.audienceCount() : 0); }
  pollView(hid) { const P = this.poll; if (!P) return null; const c = {}; for (const v of P.votes.values()) c[v] = (c[v] || 0) + 1; return { id: P.id, opts: P.opts, counts: c, endsIn: Math.max(0, P.endsAt - this.room.now()), mine: hid && (this.helpers.get(hid) || {}).voted === P.id ? (this.helpers.get(hid) || {}).vote : null }; }
  audienceAct(a, m) { return this.help({ hid: 'a:' + a.id, name: a.name, id: null, color: a.color }, m || {}); }
  audienceView() {
    const L = this.leader();
    return { mode: this.s.mode, phase: this.phase, players: this.people().filter((x) => !x.bot).map(({ id, name, color, avatar, state, hp, mhp, score, wave }) => ({ id, name, color, avatar, state, hp, mhp, score, wave })), poll: this.pollView(null), leader: L ? { id: L.id, name: L.name } : null, costs: { crate: X.HELP.crate.cost, vote: X.HELP.vote.cost, horde: X.HELP.horde.cost }, weather: this.weather.k, garage: this.garageTv() };
  }
  // ---------------- survivors ----------------
  survivorOf(cell) { return X.survivorAt(this.seed, cell[0], cell[1], this.homes, PL.placeAt); }
  escort(p, R, m) {
    const k = String(m.cell || ''); if (k !== key(R.cell)) return { ok: false, error: 'They’re not here.' };
    const S0 = this.survivorOf(R.cell); if (!S0) return { ok: false, error: 'Nobody hiding here.' };
    const st = this.survivors.get(k); if (st) return { ok: false, error: st.state === 'escort' ? `${this.room.name(st.by)} is already bringing them in.` : 'Not here any more.' };
    if ([...this.survivors.values()].some((x) => x.state === 'escort' && x.by === p.id)) return { ok: false, error: 'You’re already escorting someone.' };
    this.survivors.set(k, { state: 'escort', by: p.id, name: S0.name, at: this.room.now() });
    this.news('🧍', `${p.name} found ${S0.name} hiding: bring them to a shop or the clinic!`, p.id); this.soon();
    return { ok: true, name: S0.name };
  }
  rescue(p, R) {
    const e = [...this.survivors.entries()].find(([, x]) => x.state === 'escort' && x.by === p.id); if (!e) return { ok: false, error: 'You’re not escorting anyone.' };
    const type = PL.placeAt(this.seed, R.cell[0], R.cell[1], this.homes); if (!type || !PL.PLACES[type]) return { ok: false, error: 'Bring them to a shop or the clinic.' };
    e[1].state = 'safe'; e[1].at = this.room.now(); R.rescues = (R.rescues || 0) + 1;
    const mul = (type === 'clinic' ? X.SURV_REWARD.clinic : 1) * (R.cls === 'courier' ? 2 : 1), cash = Math.round(X.SURV_REWARD.cash * mul * (1 + 0.08 * R.wave)), score = Math.round(X.SURV_REWARD.score * mul);
    const P = PL.PLACES[type]; this.news('🎉', `${p.name} brought ${e[1].name} safe to the ${P.name} (+$${cash})`, p.id); this.room.fx('tzrescue', { id: p.id });
    this.moment('rescue', p, 1, `${p.name} brought ${e[1].name} to safety at the ${P.name}`); this.soon();
    return { ok: true, cash, score, clinic: type === 'clinic' };
  }
  survivorLost(p) {
    const e = [...this.survivors.entries()].find(([, x]) => x.state === 'escort' && x.by === p.id); if (!e) return { ok: true, quiet: true };
    e[1].state = 'lost'; this.news('💔', `The zombies got ${e[1].name}…`, p.id); this.soon(); return { ok: true };
  }
  // ---------------- Garage Defense: horde nights ----------------
  garageStep(now) {
    const G = this.gd;
    if (G.phase === 'build' && now >= G.endsAt) this.startHorde(now);
    else if (G.phase === 'horde') {
      for (const p of this.room.list()) { if (!p.bot) continue; const R = this.runs.get(p.id); if (R && R.state === 'play' && !G.done.has(p.id) && now - G.at > 15000 + (W.hash(this.seed, p.id, G.night) % 20000)) this.hordeEnd(p, R, { ok: this.room.rng() > 0.08 * G.night * (this.s.diff === 'hard' ? 1.5 : 1), door: 0.5 }); }
      const live = this.garageCrew(); if (now >= G.endsAt || (live.length && live.every((p) => G.done.has(p.id))) || !live.length) this.endHorde(now);
    }
  }
  garageCrew() { return this.room.list().filter((p) => { const R = this.runs.get(p.id); return R && R.state !== 'dead'; }); }
  startBuild(now = this.room.now()) {
    const G = this.gd; if (!G || G.phase !== 'explore') return false;
    G.night++; G.phase = 'build'; G.at = now; G.endsAt = now + X.GARAGE.buildMs; G.ready = new Set(); G.done = new Set(); G.broke = [];
    for (const p of this.room.list()) { const R = this.runs.get(p.id); if (!R) continue; this.leaveArea(p.id); R.cell = R.home.slice(); if (R.state !== 'dead') R.state = 'play'; this.joinArea(p.id, key(R.cell)); }
    this.news('🌙', `HORDE NIGHT ${G.night}! Everyone back to your garage: build your defenses!`); this.room.fx('tzhorde', { night: G.night, phase: 'build' }); this.soon();
    return true;
  }
  startHorde(now = this.room.now()) {
    const G = this.gd; if (!G || G.phase !== 'build') return false;
    G.phase = 'horde'; G.at = now; G.endsAt = now + X.GARAGE.hordeMs;
    this.news('🧟', `Night ${G.night}: THE HORDE IS HERE! Hold your garage!`); this.room.fx('tzhorde', { night: G.night, phase: 'horde' }); this.card('boss', null, 'horde'); this.bossCard.name = 'The Horde · Night ' + G.night; this.bossCard.icon = '🧟'; this.bossCard.desc = 'Hold the garage door. Don’t let them through!'; this.soon();
    return true;
  }
  ready(p) { const G = this.gd; if (!G || G.phase !== 'build') return { ok: false, error: 'Not building right now.' }; G.ready.add(p.id); const crew = this.humans().filter((h) => (this.runs.get(h.id) || {}).state !== 'dead'); if (crew.every((h) => G.ready.has(h.id))) this.startHorde(); this.soon(); return { ok: true }; }
  hordeEnd(p, R, m) {
    const G = this.gd; if (!G || G.phase !== 'horde') return { ok: false, error: 'No horde right now.' };
    if (G.done.has(p.id)) return { ok: true, quiet: true }; G.done.add(p.id);
    if (m.ok === false) { G.broke.push(p.id); G.hope = Math.max(0, G.hope - 1); this.news('💥', `${p.name}'s garage door broke! The town loses hope (${'❤️'.repeat(G.hope) || '0'} left)`, p.id); this.room.fx('tzbroke', { id: p.id }); }
    else { R.nights = (R.nights || 0) + 1; this.news('🏚️', `${p.name} held the garage through night ${G.night}!`, p.id); this.moment('horde', p, G.night, `${p.name} held the garage through horde night ${G.night}`); }
    if (G.hope <= 0) { this.end('overrun'); return { ok: true }; }
    const crew = this.garageCrew(); if (crew.length && crew.every((q) => G.done.has(q.id))) this.endHorde();
    this.soon(); return { ok: true, bonus: m.ok === false ? 0 : X.hordeBonus(G.night, Number(m.door) || 0) };
  }
  endHorde(now = this.room.now()) {
    const G = this.gd; if (!G || G.phase !== 'horde') return false;
    G.phase = 'explore'; G.next += X.GARAGE.every; G.endsAt = 0; if (!G.broke.length) G.survived++;
    this.news('🌅', G.broke.length ? `Night ${G.night} is over. ${G.broke.length} garage${G.broke.length > 1 ? 's' : ''} fell.` : `Dawn! Every garage held through night ${G.night}.`); this.room.fx('tzdawn', { night: G.night });
    this.makeRecap(`🌅 Night ${G.night} highlights`, now); this.soon();
    return true;
  }
  garageTv() { const G = this.gd; return G ? { night: G.night, phase: G.phase, next: G.next, hope: G.hope, max: X.GARAGE.hope, endsIn: G.endsAt ? Math.max(0, G.endsAt - this.room.now()) : 0, ready: [...G.ready], done: [...G.done], broke: G.broke.slice(), survived: G.survived } : null; }
  next() { if (this.phase === 'play') this.end('host'); }
  results() { return this.phase === 'over' ? this.standings().map((r) => r.id) : []; }

  // ---------------- runs ----------------
  newRun(p, first = false, keep = false) {
    const old = this.runs.get(p.id);
    if (keep && old) { // Regular mode: back in at your own garage with your build
      if (this.isScore) { const pen = Math.max(200, Math.round(old.score * SCORE_PENALTY)); old.score = Math.max(0, old.score - pen); old.penalty = (old.penalty || 0) + pen; this.news('💸', `${this.room.name(p.id)} lost ${pen} points for falling`, p.id); }
      Object.assign(old, { state: 'play', cell: old.home.slice(), hp: old.mhp, at: this.room.now(), lastSt: this.room.now(), reviveAt: 0, areas: old.areas + 1, comeback: (old.comeback || 0) + 1 });
      this.leaveArea(p.id); this.joinArea(p.id, key(old.cell)); this.room.fx('tzgarage', { id: p.id, x: old.cell[0], y: old.cell[1] });
      this.news('🔁', `${this.room.name(p.id)} is back in the fight`, p.id); return old;
    }
    if (old) { this.keepBest(old); this.leaveArea(p.id); }
    const taken = [...this.runs.values()].filter((R) => R.id !== p.id && R.state !== 'dead').map((R) => R.cell);
    // Regular mode: late arrivals start in one of the garages the story was planned around (never behind a gate)
    const cell = this.plan ? this.plan.homes[(this.runs.size + (old ? old.run : 0)) % this.plan.homes.length].slice() : W.spawnCell(this.seed, taken, (old ? old.run : 0) + this.runs.size);
    if (!this.homes.some((h) => h[0] === cell[0] && h[1] === cell[1])) { this.homes.push(cell.slice()); if (this.lockPlan && !this.plan) { this.makeLocks(); this.lockCheck(true); } } // a late garage opens up its street
    const R = {
      id: p.id, bot: !!p.bot, run: (old ? old.run : 0) + 1, cell: cell.slice(), home: cell.slice(), state: 'play', wave: 1, areas: 1, lvl: 1, xp: 0, kills: 0, hp: 100, mhp: 100,
      ab: {}, eq: {}, hearts: 0, score: 0, streak: 0, maps: 0, mapWaves: [], stash: [], bank: old ? (old.bank || 0) + old.kills : 0, choosing: false, at: this.room.now(), lastSt: this.room.now(), best: old ? old.best : null, lastPick: null, danger: false, deaths: old ? old.deaths : 0,
      load: this.loadOf(p), rescues: old ? old.rescues || 0 : 0, nights: old ? old.nights || 0 : 0, gifts: [],
    };
    if (p.bot) Object.assign(R, { nextAt: this.room.now() + 4000 + this.room.rng() * 3000, fate: 0.04 + this.room.rng() * 0.05 });
    this.runs.set(p.id, R);
    this.explore(cell, p.id); this.joinArea(p.id, key(cell));
    this.room.fx('tzgarage', { id: p.id, x: cell[0], y: cell[1] });
    this.news(first ? '🚪' : '🔁', first ? `${this.room.name(p.id)} rolls up the garage door` : `${this.room.name(p.id)} is back for another run`, p.id);
    return R;
  }
  keepBest(R) {
    const cur = { wave: R.wave, kills: R.kills, lvl: R.lvl, ab: { ...R.ab }, score: R.score || 0 };
    if (!R.best || (this.ranked ? cur.score > (R.best.score || 0) : cur.wave > R.best.wave || (cur.wave === R.best.wave && cur.kills > R.best.kills))) R.best = cur;
  }
  explore(cell, by) {
    const k = key(cell); if (!this.explored.has(k)) this.explored.set(k, { by, at: this.room.now() });
    // a specialised place in this block: the whole team sees it from now on
    const type = PL.placeAt(this.seed, cell[0], cell[1], this.homes); if (type && !this.found.has(k) && !(this.plan && key(this.plan.door) === k)) this.discover(k, type, by);
  }
  discover(k, type, by, how) {
    if (this.found.has(k)) return false; const P = PL.PLACES[type]; this.found.set(k, { type, by, at: this.room.now() });
    const p = this.room.get(by); if (p && !p.bot) { this.news(P.icon, `${p.name} ${how || 'found'} a ${P.name}`, by); this.room.fx('tzplace', { id: by, type, k }); }
    return true;
  }
  // ---------------- call-outs ----------------
  ping(p, R, m) {
    const k = String(m.k || ''); if (!PINGS[k]) return { ok: false, error: 'Unknown call-out.' };
    const now = this.room.now(); if (R.pingAt != null && now - R.pingAt < 1500) return { ok: false, error: 'Easy on the megaphone!' }; R.pingAt = now;
    let x = R.cell[0], y = R.cell[1];
    if (k === 'go' || k === 'place') { const c = String(m.cell || ''); if (!this.found.has(c) && !this.explored.has(c)) return { ok: false, error: 'Nobody has found that place yet.' }; [x, y] = c.split(',').map(Number); }
    const q = { n: ++this.pseq, id: p.id, k, x, y, at: now, place: (this.found.get(x + ',' + y) || {}).type || null };
    this.pings.push(q); if (this.pings.length > 8) this.pings.shift();
    const P = q.place && PL.PLACES[q.place]; this.news('📣', `${p.name}: ${PINGS[k]}${P ? ' ' + P.icon + ' ' + P.name : ''}`, p.id); this.room.fx('tzping', { id: p.id, k }); this.soon();
    return { ok: true };
  }
  // A boss dropped a map: its finder picks where it leads (revealed for the whole team, with a call-out).
  mapOptions(R) {
    const d = W.roadDist(this.seed, [R.cell]), out = [], N = W.GRID, places = PL.places(this.seed);
    const nearest = (types) => { let best = null, bd = Infinity; for (const [k, t] of Object.entries(places)) { if (!types.includes(t) || this.found.has(k) || this.homes.some((h) => key(h) === k)) continue; const [x, y] = k.split(',').map(Number), dd = d[y * N + x]; if (dd < bd) { bd = dd; best = k; } } return best; };
    for (const [what, types] of [['forge', ['forge']], ['master', ['master']], ['gunsmith', ['gunsmith', 'tinker']], ['clinic', ['clinic']], ['armor', ['armor']], ['market', ['market']]]) { const k = nearest(types); if (k) out.push({ what, k, type: places[k] }); }
    if (this.story && !(this.story.maps >= 2 || this.story.doorFound)) out.push({ what: 'door', k: null });
    out.push({ what: 'stash', k: null });
    return out;
  }
  reveal(p, R, m) {
    if (!(R.maps > 0)) return { ok: false, error: 'You have no map to read.' };
    const what = String(m.what || ''), o = this.mapOptions(R).find((x) => x.what === what); if (!o) return { ok: false, error: 'That map leads nowhere now.' };
    R.maps--;
    let k = o.k;
    if (what === 'door') { const st = this.story; st.maps = Math.max(st.maps + 1, 1); this.beat('map' + Math.min(2, st.maps)); k = st.maps >= 2 ? key(this.plan.door) : key(this.plan.hint); }
    else if (what === 'stash') { const r = W.rng(W.hash(this.seed, 'stash', p.id, R.maps, this.stashes.size)); let c; for (let i = 0; i < 40; i++) { c = [Math.floor(r() * W.GRID), Math.floor(r() * W.GRID)]; if (!this.explored.has(key(c)) && !this.locked(c[0], c[1])) break; } k = key(c); this.stashes.set(k, { by: p.id, cash: 60 + 15 * R.wave, took: [] }); this.news('💰', `${p.name}'s map shows a hidden stash!`, p.id); }
    else this.discover(k, o.type, p.id, 'mapped the way to');
    const [x, y] = k.split(',').map(Number);
    this.pings.push({ n: ++this.pseq, id: p.id, k: 'go', x, y, at: this.room.now(), place: o.type || (what === 'stash' ? 'stash' : what === 'door' ? 'door' : null) });
    this.room.fx('tzmap', { id: p.id, what }); this.soon();
    return { ok: true, k, what };
  }
  stash(p, R) {
    const k = key(R.cell), s = this.stashes.get(k); if (!s) return { ok: false, error: 'No stash here.' };
    if (s.took.includes(p.id)) return { ok: false, error: 'You already emptied it.' };
    s.took.push(p.id); this.news('💰', `${p.name} dug up a stash`, p.id); return { ok: true, cash: s.cash };
  }
  // A teammate stood by you long enough: back up.
  revive(p, R, m) {
    const T = this.runs.get(String(m.id || '')); if (!T || T.id === p.id) return { ok: false, error: 'Nobody to revive.' };
    if (T.state !== 'down') return { ok: false, error: 'They’re not down.' };
    if (R.state !== 'play' || key(T.cell) !== key(R.cell)) return { ok: false, error: 'You need to be right there.' };
    T.state = 'play'; T.revives = (T.revives || 0) + 1; this.send(T.id, { t: 'revived', by: p.id, area: key(T.cell) });
    this.news('🤝', `${p.name} got ${this.room.name(T.id)} back on their feet`, p.id); this.room.fx('tzrevive', { id: T.id }); this.soon();
    return { ok: true };
  }
  news(icon, text, id) { this.feed.push({ n: ++this.fseq, icon, text, id: id || null, at: this.room.now() }); if (this.feed.length > FEED) this.feed.shift(); }
  // Screens update at most every ~150 ms for a burst of reports (the status pings are quiet).
  soon() { if (this.flushT == null) this.flushT = this.room.after(150, () => { this.flushT = null; }); }

  // ---------------- co-op areas ----------------
  joinArea(id, k) {
    const p = this.room.get(id); if (!p || p.bot) return null;
    let A = this.areas.get(k);
    if (!A) { A = { host: id, members: [id], dropAt: 0 }; this.areas.set(k, A); } else if (!A.members.includes(id)) A.members.push(id);
    if (A.members.length > 1) this.tellArea(k, { t: 'area' });
    return A;
  }
  leaveArea(id) {
    for (const [k, A] of this.areas) {
      const i = A.members.indexOf(id); if (i < 0) continue;
      A.members.splice(i, 1);
      if (!A.members.length) { this.areas.delete(k); continue; }
      if (A.host === id) A.host = A.members.find((m) => (this.room.get(m) || {}).sockets > 0) || A.members[0];
      this.tellArea(k, { t: 'host' });
    }
  }
  areaOf(id) { const R = this.runs.get(id); if (!R) return null; const k = key(R.cell), A = this.areas.get(k); return A && A.members.includes(id) ? { k, ...A } : null; }
  tellArea(k, msg) { const A = this.areas.get(k); if (!A) return; for (const m of A.members) this.send(m, { ...msg, area: k, host: A.host, members: A.members.slice() }); }
  send(id, data) {
    const nsp = this.room.nsp;
    if (nsp) nsp.to('pl:' + this.room.code + ':' + id).emit('live', data);
    else { this.outbox.push({ to: id, data }); if (this.outbox.length > 300) this.outbox.shift(); }
  }
  sendTv(data) { const nsp = this.room.nsp; if (nsp) nsp.to('host:' + this.room.code).emit('live', data); else { this.outbox.push({ to: 'tv', data }); if (this.outbox.length > 300) this.outbox.shift(); } }
  // The relay: the host's snapshots go to the guests; a guest's input/hits go to the host.
  live(p, m) {
    if (this.phase !== 'play' || !p || !m || typeof m !== 'object' || !LIVE_KINDS.has(m.t)) return false;
    const now = this.room.now();
    const L = p._tzLive || (p._tzLive = { at: now, n: 0 });
    if (now - L.at > 1000) { L.at = now; L.n = 0; }
    if (++L.n > 60) return false; // at most 60 messages a second per phone
    let size = 0; try { size = JSON.stringify(m).length; } catch { return false; }
    if (size > 16000) return false;
    if (m.t === 'tv') { if (!this.spot || this.spot.id !== p.id) return false; this.sendTv({ ...m, from: p.id, at: now }); return true; }
    const A = this.areaOf(p.id); if (!A || A.members.length < 2) return false;
    const out = { ...m, from: p.id, area: A.k };
    if (A.host === p.id) {
      const to = typeof m.to === 'string' && A.members.includes(m.to) ? [m.to] : A.members.filter((id) => id !== p.id);
      for (const id of to) this.send(id, out);
    } else this.send(A.host, out);
    return true;
  }

  // ---------------- phone input ----------------
  act(p, m) {
    const R = this.runs.get(p.id);
    if (m.op === 'end') {
      const vip = this.room.vip();
      if (this.phase !== 'play') return { ok: false, error: 'It’s already over.' };
      if (!vip || vip.id !== p.id) return { ok: false, error: 'Only the host can end the night.' };
      this.end('host'); return { ok: true };
    }
    if (this.phase !== 'play') return { ok: false, error: 'The night is over.' };
    if (!R) { this.newRun(p, true); return { ok: true }; }
    if (m.op === 'respawn') {
      if (R.state !== 'dead') return { ok: false, error: 'You’re still standing!' };
      if (this.story || this.isScore || this.isGarage) { if (this.room.now() < (R.reviveAt || 0)) return { ok: false, error: 'Catch your breath a moment…' }; this.newRun(p, false, true); return { ok: true }; }
      this.newRun(p); return { ok: true };
    }
    if (m.op === 'st') return this.status(p, R, m);
    if (m.op === 'enter') return this.enter(p, R, m);
    if (m.op === 'ev') return this.event(p, R, m);
    if (m.op === 'find') return this.find(p, R, m);
    if (m.op === 'door') return this.openDoor(p, R);
    if (m.op === 'ping') return this.ping(p, R, m);
    if (m.op === 'reveal') return this.reveal(p, R, m);
    if (m.op === 'stash') return this.stash(p, R);
    if (m.op === 'revive') return this.revive(p, R, m);
    if (m.op === 'maps') return { ok: true, options: this.mapOptions(R) };
    if (m.op === 'help') return this.help({ hid: 'p:' + p.id, name: p.name, id: p.id, color: p.color }, m);
    if (m.op === 'chest') return this.chest(p, R, m);
    if (m.op === 'escort') return this.escort(p, R, m);
    if (m.op === 'rescue') return this.rescue(p, R);
    if (m.op === 'ready') return this.ready(p);
    if (m.op === 'hordeend') return this.hordeEnd(p, R, m);
    return { ok: false, error: 'Unknown move.' };
  }
  // Status ping (~1 a second): checked loosely (it's a party game, but numbers stay believable).
  status(p, R, m) {
    if (R.state === 'dead' || R.state === 'down') return { ok: true, quiet: true };
    const now = this.room.now(), dt = Math.max(0.2, (now - R.lastSt) / 1000); R.lastSt = now;
    const before = R.lvl + ':' + R.wave + ':' + (R.danger ? 1 : 0) + ':' + R.choosing;
    R.kills = Math.max(R.kills, int(m.kills, 0, R.kills + Math.ceil(80 * dt) + 40));
    R.lvl = Math.max(R.lvl, int(m.lvl, 1, Math.min(R.lvl + 3, W.limits.level(R.kills + this.areaKills(R)))));
    R.mhp = int(m.mhp, 50, W.limits.hp(R.lvl)); R.hp = int(m.hp, 0, R.mhp);
    R.xp = int(m.xp, 0, 9999);
    const maxWave = Math.max(R.areas, ...[...this.runs.values()].filter((o) => o.id !== R.id && key(o.cell) === key(R.cell)).map((o) => o.wave)) + 1;
    R.wave = Math.max(R.wave, int(m.wave, 1, maxWave));
    if (m.ab && typeof m.ab === 'object') {
      const ab = {}; let total = 0;
      for (const [id, n] of Object.entries(m.ab)) { const A = W.AB[id]; if (!A) continue; const t = int(n, 0, 9999); if (t && total + t <= R.lvl - 1) { ab[id] = t; total += t; } }
      R.ab = ab;
    }
    // score: it can only climb so fast (kills x the best multiplier, plus the bonuses)
    if (m.score != null) { const top = R.score + Math.ceil((3000 + 400 * R.wave) * dt) + 6000; R.score = Math.max(R.score, int(m.score, 0, top)); }
    R.streak = int(m.mult, 1, 12);
    if (Array.isArray(m.wp)) R.wp = m.wp.slice(0, AR.SLOTS + 1).filter((w) => Array.isArray(w) && AR.WEAPONS[w[0]]).map((w) => [w[0], int(w[1], 1, 10), int(w[2], 1, 3)]);
    R.choosing = !!m.ch; R.danger = R.hp > 0 && R.hp / R.mhp < 0.3;
    if (Array.isArray(m.kf) && m.kf.length) { this.killNews(p, R, m.kf); this.soon(); }
    if (R.streak >= 6 && R.streak > (R.bestStreak || 0)) { R.bestStreak = R.streak; this.moment('streak', p, R.streak, `${p.name} hit a ×${R.streak} kill streak`); }
    if (m.gdoor != null) R.door = int(m.gdoor, 0, 99999);
    if (m.veh != null) R.veh = typeof m.veh === 'string' && X.VEHICLES[m.veh] ? m.veh : null;
    R.brk = m.brk != null && m.brk >= 0 ? int(m.brk, 0, BREAK_S) : -1;
    if (this.gd && this.gd.phase === 'explore' && R.wave >= this.gd.next) this.startBuild();
    if (this.story) this.storyCheck();
    this.lockCheck();
    if (before !== R.lvl + ':' + R.wave + ':' + (R.danger ? 1 : 0) + ':' + R.choosing) this.soon();
    return { ok: true, quiet: true };
  }
  areaKills(R) { return R.wave * 20; } // co-op shared XP: levels can come from friends' kills too
  enter(p, R, m) {
    if (R.state === 'dead') return { ok: false, error: 'You’re down.' };
    if (this.gd && this.gd.phase !== 'explore') return { ok: false, error: '🌙 Horde night: hold your garage!' };
    const x = Number(m.x), y = Number(m.y);
    if (!W.inGrid(x, y)) return { ok: false, error: 'That’s the edge of town.' };
    if (Math.abs(x - R.cell[0]) + Math.abs(y - R.cell[1]) !== 1) return { ok: false, error: 'Too far away.' };
    if (!W.roadBetween(this.seed, R.cell, [x, y])) return { ok: false, error: 'No road that way.' };
    if (this.locked(x, y)) { const sp = this.lockPlan.kind[y * W.GRID + x]; return { ok: false, error: `🔒 That gate is locked: ${this.teamKills()} / ${this.reqAt(x, y)} team kills${sp ? ' (a special area: tough zombies inside)' : ''}. Try another road.` }; }
    this.leaveArea(p.id);
    const fresh = !this.explored.has(key([x, y]));
    R.cell = [x, y]; R.areas++; this.explore(R.cell, p.id);
    const A = this.joinArea(p.id, key(R.cell));
    const here = this.room.list().filter((o) => o.id !== p.id && this.runs.get(o.id) && key(this.runs.get(o.id).cell) === key(R.cell) && this.runs.get(o.id).state !== 'dead');
    const look = this.homes.some((h) => h[0] === x && h[1] === y) ? W.HOME : W.biomeOf(this.seed, x, y);
    if (A && A.members.length > 1) { this.news('🤝', `${p.name} joined ${A.members.filter((id) => id !== p.id).map((id) => this.room.name(id)).join(' & ')} at the ${look.name}`, p.id); this.room.fx('tzcoop', { id: p.id }); }
    else if (here.length) this.news('🤝', `${p.name} ran into ${here.map((o) => o.name).join(' & ')} at the ${look.name}`, p.id);
    else if (fresh) this.news(look.icon, `${p.name} found the ${look.name}`, p.id);
    if (this.story && this.plan.door[0] === x && this.plan.door[1] === y && !this.story.doorFound) { this.story.doorFound = true; const D = S.DOORS.find((d) => d.key === this.plan.doorLook); this.news(D.icon, `${p.name} found the boss door: the ${D.name}!`, p.id); this.room.fx('tzdoorfound', { id: p.id }); this.beat('door'); }
    this.soon();
    return { ok: true, area: A ? { k: key(R.cell), host: A.host, members: A.members.slice() } : null };
  }
  event(p, R, m) {
    const k = String(m.k || '');
    if (k === 'pick') {
      const A = W.AB[m.id]; if (!A) return { ok: false, error: 'Unknown ability.' };
      R.lastPick = A.id; this.news(A.icon, `${p.name} picked ${A.name}`, p.id); this.room.fx('tzpick', { id: p.id, ab: A.id });
    } else if (k === 'pickup') {
      const P = W.PK[m.id]; if (!P) return { ok: false, error: 'Unknown pickup.' };
      this.room.fx('tzpickup', { id: p.id, pk: P.id }); if (P.id === 'nuke') this.news(P.icon, `${p.name} called Garbage Day!`, p.id);
    } else if (k === 'wave') { // the break ran out: the next wave started where they stand (not a new area)
      const now = this.room.now(); if (R.clearAt == null || now - R.clearAt < (BREAK_S - 6) * 1000) return { ok: false, error: 'Too soon.' };
      R.clearAt = null; R.areas++; R.brk = -1; return { ok: true, quiet: true };
    } else if (k === 'clear') {
      R.clearAt = this.room.now();
      const w = int(m.wave, 1, 999); if (w % 5 === 0 || w >= 10) this.news('🧹', `${p.name} cleared wave ${w}`, p.id); this.room.fx('tzclear', { id: p.id });
      if (this.s.length === 'w20' && w >= 20) { this.news('🏁', `${p.name} survived wave 20!`, p.id); this.keepBest(R); this.end('w20'); return { ok: true }; }
    } else if (k === 'victory') {
      if (!this.story || !this.story.doorOpen) return { ok: false, error: 'Not yet.' };
      this.story.won = { by: p.id, at: this.room.now() }; this.news('🏆', `${p.name} took down ${S.BOSSES[this.plan.boss].name}!`, p.id); this.beat('win'); this.keepBest(R); this.end('win'); return { ok: true };
    } else if (k === 'downed') {
      if (R.state !== 'play') return { ok: true };
      const mates = this.humans().filter((h) => h.id !== p.id && (this.runs.get(h.id) || {}).state === 'play');
      if (!this.story || !mates.length) return { ok: false, error: 'Nobody to revive you.' };
      R.state = 'down'; R.downAt = this.room.now(); R.hp = 0; this.news('🆘', `${p.name} is down! Get to them!`, p.id); this.room.fx('tzdown', { id: p.id });
      if (this.humans().every((h) => { const q = this.runs.get(h.id); return !q || q.state === 'dead' || q.state === 'down'; })) { this.end('lost'); return { ok: true }; }
    } else if (k === 'buy') { return { ok: true, quiet: true };
    } else if (k === 'class') {
      const C = AR.CLASSES[m.id]; if (!C) return { ok: false, error: 'Unknown class.' }; if (R.cls) return { ok: true, quiet: true };
      if (C.locked && !(R.load && (R.load.classes || []).includes(m.id))) return { ok: false, error: 'Unlock that class with scrap first.' };
      R.cls = m.id; this.news(C.icon, `${p.name} rolls out as the ${C.name}`, p.id);
    } else if (k === 'combo') {
      const C = AR.COMBOS.find((c) => c.id === m.id); if (!C) return { ok: false, error: 'Unknown combo.' }; R.combos = R.combos || []; if (R.combos.includes(C.id)) return { ok: true, quiet: true };
      R.combos.push(C.id); this.news('🧪', `${p.name} discovered a combo: ${C.icon} ${C.name}!`, p.id); this.room.fx('tzcombo', { id: p.id, combo: C.id });
    } else if (k === 'weapon') {
      const Wd = AR.WEAPONS[m.id]; if (!Wd) return { ok: false, error: 'Unknown weapon.' }; this.news(Wd.icon, `${p.name} picked up a ${Wd.names[0]}`, p.id); return { ok: true, quiet: true };
    } else if (k === 'upgrade') {
      const Wd = AR.WEAPONS[m.id], lv = int(m.lv, 1, 10); if (!Wd) return { ok: false, error: 'Unknown weapon.' }; if (lv === 5 || lv === 8 || lv === 10) this.news('🛠️', `${p.name}'s ${AR.wname(m.id, int(m.tier, 1, 3))} hit level ${lv}`, p.id); return { ok: true, quiet: true };
    } else if (k === 'evolve') {
      const Wd = AR.WEAPONS[m.id], tier = int(m.tier, 2, 3); if (!Wd) return { ok: false, error: 'Unknown weapon.' };
      this.news('✨', `${p.name} evolved a weapon into the ${AR.wname(m.id, tier)}${tier >= 3 ? ' (FULLY EVOLVED!)' : ''}`, p.id); this.room.fx('tzevolve', { id: p.id, x: R.cell[0], y: R.cell[1], tier });
    } else if (k === 'mapgot') {
      const w = int(m.wave, 1, 999); if (w % 5 !== 0 || R.mapWaves.includes(w) || w > R.wave + 1) return { ok: false, error: 'No map here.' };
      R.mapWaves.push(w); R.maps++; this.news('🗺️', `${p.name} pulled a map off the boss`, p.id); this.soon(); return { ok: true, options: this.mapOptions(R) };
    } else if (k === 'heart') { R.hearts = Math.max(0, (R.hearts || 0) - 1); this.news('💖', `${p.name} used a Spare Heart`, p.id); this.room.fx('tzhurt', { id: p.id });
    } else if (k === 'boss') { const mb = W.ZOMBIES[m.id] && W.ZOMBIES[m.id].mini ? m.id : 'boss'; this.news(mb === 'boss' ? '🗑️' : (S.BOSSES[mb] || {}).icon || '☠️', `${mb === 'boss' ? 'A Dumpster Brute' : W.ZOMBIES[mb].name} crawls out near ${p.name}!`, p.id); this.room.fx('tzboss', { id: p.id, key: mb }); this.card(mb, p.id, 'mini');
    } else if (k === 'bossdown') { const b = String(m.id || 'boss'), final = b === 'final' && this.plan, nm2 = final ? S.BOSSES[this.plan.boss].name : (W.ZOMBIES[b] || W.ZOMBIES.boss).name; this.moment(final ? 'final' : 'boss', p, 1, `${p.name} took down ${nm2}`); this.kfeed.push({ n: ++this.kseq, id: p.id, name: p.name, color: p.color, icon: '☠️', text: `took down ${nm2}!`, at: this.room.now(), big: true }); if (this.kfeed.length > KF) this.kfeed.shift();
    } else if (k === 'multi') { const n = int(m.n, 2, 99); if (n < 4) return { ok: true, quiet: true }; const prev = this.moments.find((x) => x.kind === 'multi' && x.id === p.id && this.room.now() - x.at < 3000); if (prev) { if (n > prev.value) { prev.value = n; prev.w = X.momentWeight(prev); prev.text = `${p.name} took out ${n} zombies at once`; } } else this.moment('multi', p, n, `${p.name} took out ${n} zombies at once`); return { ok: true, quiet: true };
    } else if (k === 'survlost') { return this.survivorLost(p);
    } else if (k === 'ride') { const V = X.VEHICLES[m.id]; if (!V) return { ok: false, error: 'Unknown ride.' }; if (m.id === 'gtruck') this.news(V.icon, `${p.name} is driving a Garbage Truck!`, p.id); return { ok: true, quiet: m.id !== 'gtruck' };
    } else if (k === 'build') { const B = X.BUILD[m.id]; if (!B) return { ok: false, error: 'Unknown build.' }; R.built = (R.built || 0) + 1; return { ok: true, quiet: true }; }
    else if (k === 'down') { this.news('💫', `${p.name} used a Spare Lunchbox`, p.id); this.room.fx('tzhurt', { id: p.id }); }
    else if (k === 'hurt') { this.room.fx('tzhurt', { id: p.id }); }
    else if (k === 'dead') {
      if (R.state === 'dead') return { ok: true };
      this.survivorLost(p);
      R.state = 'dead'; R.hp = 0; R.deaths++; R.deadAt = this.room.now(); this.keepBest(R); this.leaveArea(p.id);
      if (this.isScore || this.isGarage) { R.reviveAt = this.room.now() + SCORE_RESPAWN_MS; this.news('💀', `${p.name} fell (back in a moment${this.isScore ? ', minus points' : ''})`, p.id); this.room.fx('tzdead', { id: p.id }); this.soon(); return { ok: true }; }
      if (this.story) { R.reviveAt = this.room.now() + REVIVE_MS; if (this.humans().every((h) => !this.runs.get(h.id) || ['dead', 'down'].includes(this.runs.get(h.id).state))) { this.news('💀', `${p.name} fell. Nobody is left standing…`, p.id); this.room.fx('tzdead', { id: p.id }); this.end('lost'); return { ok: true }; } }
      this.news('💀', `${p.name} fell on wave ${R.wave} (level ${R.lvl}, ${R.kills} kills)`, p.id); this.room.fx('tzdead', { id: p.id });
    } else return { ok: false, error: 'Unknown event.' };
    this.soon();
    return { ok: true };
  }

  find(p, R, m) {
    if (!this.story) return { ok: false, error: 'No finds in Endless.' };
    const x = Number(m.x), y = Number(m.y), k = x + ',' + y, id = this.plan.finds[k];
    if (R.state === 'dead' || R.cell[0] !== x || R.cell[1] !== y) return { ok: false, error: 'You’re not there.' };
    if (!id) return { ok: false, error: 'Nothing here.' };
    if (this.story.taken[k]) return { ok: false, error: 'Someone already looted this.' };
    const F = S.FINDS[id]; this.story.taken[k] = p.id; this.story.finds.push({ id, by: p.id });
    // the chest holds a little loot too (a key chest a bit more)
    const cash = Math.round((F.kind === 'key' ? 40 : 15) * (1 + 0.08 * Math.max(0, R.wave - 1)));
    if (F.kind === 'key') { this.story.keys.push(id); this.beat(this.story.keys.length >= 3 ? 'keys' : 'key'); this.moment('key', p, 1, `${p.name} pulled ${F.name} out of a chest (${this.story.keys.length}/3)`); }
    else if (F.kind === 'map') { this.story.maps++; this.beat('map' + Math.min(2, this.story.maps)); }
    else if (F.kind === 'token') R.hearts = (R.hearts || 0) + 1;
    else R.eq[id] = 1;
    this.news(F.icon, `${p.name} opened a chest: ${F.name}!`, p.id); this.room.fx('tzfind', { id: p.id, find: id }); this.soon();
    return { ok: true, find: id, cash };
  }
  openDoor(p, R) {
    const st = this.story; if (!st) return { ok: false, error: 'No door in Endless.' };
    if (R.cell[0] !== this.plan.door[0] || R.cell[1] !== this.plan.door[1]) return { ok: false, error: 'The door isn’t here.' };
    if (st.keys.length < 3) return { ok: false, error: `The door needs the whole key: ${st.keys.length}/3 pieces.` };
    if (st.doorOpen) return { ok: true, boss: this.plan.boss };
    st.doorOpen = true; st.doorFound = true; st.openedAt = this.room.now(); this.card(this.plan.boss, p.id, 'final');
    const B = S.BOSSES[this.plan.boss]; this.news(B.icon, `${p.name} opened the door. ${B.name} wakes up!`, p.id); this.room.fx('tzdoor', { id: p.id }); this.beat('open'); this.soon();
    return { ok: true, boss: this.plan.boss };
  }
  storyTv() {
    const st = this.story; if (!st) return null; const P = this.plan, B = S.BOSSES[P.boss];
    return { tier: st.tier, max: S.MAX_TIER, needs: [1, 2, 3, 4].map((t) => this.need(t)), kills: this.teamKills(), keys: st.keys.length, maps: st.maps,
      door: st.maps >= 2 || st.doorFound ? P.door : null, hint: st.maps >= 1 && !(st.maps >= 2 || st.doorFound) ? P.hint : null, doorLook: P.doorLook, doorOpen: st.doorOpen,
      boss: st.doorFound ? { key: P.boss, name: B.name, icon: B.icon } : null, finds: st.finds.slice(), beats: st.beats.slice(-3), won: st.won || null, time: (st.won ? st.won.at : this.room.now()) - this.startedAt };
  }
  storyView(p) {
    const st = this.story; if (!st) return null;
    const R = this.runs.get(p.id);
    return { ...this.storyTv(), plan: { finds: this.plan.finds, door: this.plan.door, boss: this.plan.boss, doorLook: this.plan.doorLook }, taken: Object.keys(st.taken), reviveIn: R && R.state === 'dead' ? Math.max(0, (R.reviveAt || 0) - this.room.now()) : 0 };
  }

  // ---------------- bots (they play a rough run on the server, for the TV map and tests) ----------------
  botStep(p, now) {
    const R = this.runs.get(p.id); if (!R) return;
    if (R.state === 'dead') { if (now - R.deadAt > 9000) this.newRun(p, false, !!this.story); return; }
    if (now < R.nextAt) { const k0 = R.kills; R.kills += 1 + Math.floor(this.room.rng() * (1 + R.wave / 3)); R.score = (R.score || 0) + (R.kills - k0) * 12 * (1 + Math.floor(R.wave / 4)); R.hp = Math.max(1, Math.min(R.mhp, R.hp - Math.floor(this.room.rng() * 6) + 2)); return; }
    // wave cleared: level up, maybe die, walk on
    R.lvl += 1 + (this.room.rng() < 0.4 ? 1 : 0);
    const owned = R.ab, ids = W.offer(this.room.rng, owned); const id = ids[0];
    if (id && W.levelsFromAbilities(owned) < R.lvl - 1) { owned[id] = (owned[id] || 0) + 1; R.lastPick = id; }
    const hard = this.s.diff === 'hard' ? 1.6 : this.s.diff === 'chill' ? 0.6 : 1;
    if (this.room.rng() < R.fate * R.wave * 0.35 * hard) { R.state = 'dead'; R.hp = 0; R.deadAt = now; R.deaths++; this.keepBest(R); this.news('💀', `${p.name} fell on wave ${R.wave}`, p.id); this.room.fx('tzdead', { id: p.id }); return; }
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => [R.cell[0] + dx, R.cell[1] + dy]).filter(([x, y]) => W.roadBetween(this.seed, R.cell, [x, y]) && !this.locked(x, y));
    if (this.story) this.storyCheck();
    if (this.gd && this.gd.phase !== 'explore') { R.nextAt = now + 3000; return; }
    if (dirs.length) R.cell = dirs[Math.floor(this.room.rng() * dirs.length)]; R.areas++; R.wave++; this.explore(R.cell, p.id);
    if (this.gd && this.gd.phase === 'explore' && !this.humans().length && R.wave >= this.gd.next) this.startBuild();
    R.hp = R.mhp = 100 + 25 * (owned.hp || 0);
    R.nextAt = now + 14000 + this.room.rng() * 14000;
  }

  // ---------------- screens ----------------
  standings() {
    return this.room.list().filter((p) => this.runs.has(p.id)).map((p) => {
      const R = this.runs.get(p.id), cur = { wave: R.wave, kills: R.kills, lvl: R.lvl, ab: R.ab };
      const b = R.best && (R.best.wave > cur.wave || (R.best.wave === cur.wave && R.best.kills > cur.kills)) ? R.best : cur;
      const score = this.ranked ? Math.max(R.score || 0, (R.best && R.best.score) || 0) : R.score || 0;
      return { id: p.id, name: p.name, avatar: p.avatar, color: p.color, wave: b.wave, kills: b.kills, lvl: b.lvl, score, build: Object.entries(b.ab || {}).sort((a, c) => c[1] - a[1]).slice(0, 6), runs: R.run, eq: Object.keys(R.eq || {}), cls: R.cls || null, wp: R.wp || [], combos: (R.combos || []).length, scrap: R.scrap == null ? null : R.scrap, rescues: R.rescues || 0, nights: R.nights || 0 };
    }).sort((a, b) => (this.ranked ? b.score - a.score : 0) || b.wave - a.wave || b.kills - a.kills || b.lvl - a.lvl);
  }
  people() {
    return this.room.list().filter((p) => this.runs.has(p.id)).map((p) => {
      const R = this.runs.get(p.id);
      return { id: p.id, name: p.name, avatar: p.avatar, color: p.color, bot: !!p.bot, x: R.cell[0], y: R.cell[1], state: R.state, wave: R.wave, lvl: R.lvl, kills: R.kills, score: R.score || 0, streak: R.streak || 1, cls: R.cls || null, wp: R.wp || [], hp: R.hp, mhp: R.mhp, danger: R.danger, ch: R.choosing, pick: R.lastPick, run: R.run, veh: R.veh || null, fit: R.load ? R.load.fit : null, brk: R.state === 'play' && R.brk != null && R.brk >= 0 ? R.brk : -1,
        ab: Object.entries(R.ab).sort((a, c) => c[1] - a[1]).slice(0, 5).map(([id]) => id) };
    });
  }
  tv() {
    return {
      phase: this.phase, seed: this.seed, grid: W.GRID, homes: this.homes, explored: [...this.explored].map(([k, v]) => [...k.split(',').map(Number), v.by]),
      players: this.people(), feed: this.feed.slice(-8), endsIn: this.endsAt ? Math.max(0, this.endsAt - this.room.now()) : 0, length: this.s.length, diff: this.s.diff,
      coop: [...this.areas].filter(([, A]) => A.members.length > 1).map(([k, A]) => ({ k, host: A.host, members: A.members.slice() })),
      standings: this.standings().slice(0, 12), why: this.overWhy, mode: this.s.mode, story: this.storyTv(), minutes: this.minutes || 0,
      found: [...this.found].map(([k, f]) => [k, f.type]), pings: this.pings.map((q) => ({ ...q, name: this.room.name(q.id) })),
      kfeed: this.kfeed.slice(-8), spot: this.spotTv(), card: this.bossCard && this.room.now() - this.bossCard.at < CARD_MS ? { ...this.bossCard, ago: this.room.now() - this.bossCard.at } : null,
      recap: this.recap ? { ...this.recap, ago: this.room.now() - this.recap.at } : null, weather: this.weatherView(), garage: this.garageTv(), poll: this.pollView(null), helpers: this.helperCount(), party: this.party,
      rescued: [...this.survivors.values()].filter((x) => x.state === 'safe').length, locks: this.lockView(),
    };
  }
  spotTv() { const S0 = this.spot; if (!S0) return null; const R = this.runs.get(S0.id), p = this.room.get(S0.id); if (!R || !p) return null; return { id: S0.id, name: p.name, color: p.color, why: S0.why || 'low', hp: R.hp, mhp: R.mhp, x: R.cell[0], y: R.cell[1], wave: R.wave }; }
  weatherView() { const Wd = X.WEATHER[this.weather.k]; return { k: this.weather.k, n: this.weather.n, icon: Wd.icon, name: Wd.name, tip: Wd.tip }; }
  view(p) {
    const R = this.runs.get(p.id), A = this.areaOf(p.id);
    return {
      phase: this.phase, seed: this.seed, grid: W.GRID, homes: this.homes, explored: [...this.explored.keys()].map((k) => k.split(',').map(Number)),
      players: this.people().filter((x) => x.id !== p.id).map(({ id, name, color, avatar, x, y, state, wave, lvl, hp, mhp, bot, score }) => ({ id, name, color, avatar, x, y, state, wave, lvl, hp, mhp, bot, score })),
      found: [...this.found].map(([k, f]) => [k, f.type]), pings: this.pings.map((q) => ({ ...q, name: this.room.name(q.id) })), stashes: [...this.stashes].filter(([, s]) => !s.took.includes(p.id)).map(([k]) => k),
      me: R ? { id: p.id, run: R.run, cell: R.cell, home: R.home, state: R.state, wave: R.wave, lvl: R.lvl, xp: R.xp, kills: R.kills, hp: R.hp, mhp: R.mhp, ab: R.ab, eq: R.eq || {}, hearts: R.hearts || 0, best: R.best, deaths: R.deaths, comeback: R.comeback || 0, score: R.score || 0, maps: R.maps || 0, cls: R.cls || null, reviveIn: R.state === 'dead' ? Math.max(0, (R.reviveAt || 0) - this.room.now()) : 0,
        load: R.load || null, gifts: R.gifts || [], spot: !!(this.spot && this.spot.id === p.id), rescues: R.rescues || 0, nights: R.nights || 0, scrap: R.scrap == null ? null : R.scrap, scrapGuest: !!R.scrapGuest,
        helper: R.state === 'dead' || R.state === 'down' ? this.helperState('p:' + p.id) : null } : null,
      party: this.party, weather: this.weatherView(), garage: this.garageTv(), nextEv: this.nextEv, poll: R && (R.state === 'dead' || R.state === 'down') ? this.pollView('p:' + p.id) : null, leader: (() => { const L = this.leader(); return L ? { id: L.id, name: L.name } : null; })(),
      surv: [...this.survivors.entries()].map(([k, x]) => [k, x.state, x.by]), locks: this.lockView(), chests: [...this.chests].filter(([, c]) => c.took.includes(p.id)).map(([k]) => k),
      area: A ? { k: A.k, host: A.host, members: A.members.slice() } : null,
      settings: { diff: this.s.diff, aim: this.s.aim, xp: this.s.xp, length: this.s.length, mode: this.s.mode }, endsIn: this.endsAt ? Math.max(0, this.endsAt - this.room.now()) : 0,
      feed: this.feed.slice(-4), standings: this.phase === 'over' ? this.standings() : null, why: this.overWhy, mode: this.s.mode, story: this.storyView(p),
    };
  }
}

module.exports = {
  key: 'trash', name: 'JustZombies', min: 1, best: [1, 4], fields, defaults,
  show: { facts: false }, // intro cutscene before the game (public/box/intros/trash.js)
  difficulty: { key: 'diff', values: { easy: 'chill', medium: 'normal', hard: 'hard' } },
  practice: false, // a run is its own warm-up: the first waves are gentle
  dropIn: true, // late arrivals jump straight in: they roll up their own garage door somewhere on the map
  partyFit,
  create: (room, settings) => new Game(room, settings),
  // Unlocks (scrap) work in the lobby and between games too: room.act(p, { op: 'meta', ... }).
  metaView(room, p) {
    const prof = p && p.profileId && room.profiles && typeof room.profiles.get === 'function' ? room.profiles.get(p.profileId) : null;
    if (!prof) return { guest: true, scrap: 0, own: [], pick: {} };
    const M = metaFix(prof); return { scrap: M.scrap, earned: M.earned, runs: M.runs, own: M.own.slice(), pick: { ...M.pick } };
  },
  metaAct(room, p, m) {
    const prof = p && !p.bot && p.profileId && room.profiles && typeof room.profiles.get === 'function' ? room.profiles.get(p.profileId) : null;
    if (!prof) return { ok: false, error: 'Make your character first (🛍️) to keep scrap and unlocks.' };
    const M = metaFix(prof), k = String(m.k || '');
    if (k === 'buy') {
      const U = X.UNLOCK[String(m.id || '')]; if (!U) return { ok: false, error: 'Unknown unlock.' };
      if (M.own.includes(U.id)) return { ok: false, error: 'You already have it.' };
      if (U.needs && !M.own.includes(U.needs)) return { ok: false, error: `Unlock ${X.UNLOCK[U.needs].name} first.` };
      if (M.scrap < U.cost) return { ok: false, error: `You need ${U.cost} scrap (you have ${M.scrap}).` };
      M.scrap -= U.cost; M.own.push(U.id); if (U.kind !== 'cls' && M.pick[U.kind] == null) M.pick[U.kind] = U.key;
    } else if (k === 'pick') {
      const slot = String(m.slot || ''); if (!['cls', 'wp', 'fit', 'tier'].includes(slot)) return { ok: false, error: 'Unknown slot.' };
      const v = m.id == null || m.id === '' ? null : String(m.id); if (!X.pickOk(M, slot, v)) return { ok: false, error: 'Unlock it first.' };
      M.pick[slot] = v;
    } else return { ok: false, error: 'Unknown move.' };
    try { if (room.profiles.saveSoon) room.profiles.saveSoon(); } catch (e) { console.error('[trash meta]', e.message); }
    return { ok: true, meta: module.exports.metaView(room, p) };
  },
};
