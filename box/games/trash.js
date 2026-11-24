'use strict';
// TrashZombies: a top-down survival shooter played ON THE PHONE. Each phone runs its own area
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

const opt = (pairs) => pairs.map(([value, label]) => ({ value, label }));
const fields = [
  { key: 'mode', label: 'Mode', options: opt([['story', '📖 Regular: break the gates, find the key, beat the boss'], ['endless', '♾️ Endless: waves forever, no story']]) },
  { key: 'length', label: 'Run length (Endless)', options: opt([['endless', '♾️ Endless (until everyone falls)'], ['w20', '🏁 Survive to wave 20'], ['m5', '⏱ 5 minutes'], ['m10', '⏱ 10 minutes'], ['m15', '⏱ 15 minutes'], ['m20', '⏱ 20 minutes'], ['m30', '⏱ 30 minutes']]) },
  { key: 'diff', label: 'Difficulty', options: opt([['chill', '🟢 Chill'], ['normal', '🟡 Normal'], ['hard', '🔴 Hard']]) },
  { key: 'aim', label: 'Auto-aim (touch)', options: opt([['on', '🎯 On: just move, it shoots the nearest'], ['off', '🕹️ Off: aim with the right stick']]) },
  { key: 'xp', label: 'Co-op XP', options: opt([['shared', '🤝 Shared in the same area'], ['own', '🙋 Your own kills only']]) },
];
const defaults = { mode: 'story', length: 'endless', diff: 'normal', aim: 'on', xp: 'shared' };
const PF = require('../party-fit');
const MINUTES = { m5: 5, m10: 10, m15: 15, m20: 20, m30: 30 };
// Party Mode: Endless with a fixed time (the plan's minutes, rounded to an option), then the results.
// (A Regular story run takes 20-35 minutes: too long for a party slot.)
const partyFit = ({ minutes: M }) => { const { length } = PF.best({ length: ['m10', 'm5', 'm15', 'm20'] }, (s) => 0.6 + MINUTES[s.length], M); return { mode: 'endless', length }; };
const REVIVE_MS = 15000, TICK = 1000, ALL_DOWN_MS = 45000, FEED = 10, HOST_DROP_MS = 2500, EMPTY_MS = 3 * 60000;
const LIVE_KINDS = new Set(['snap', 'in', 'hit', 'grab', 'give', 'fx', 'need']);
const key = (c) => c[0] + ',' + c[1];
const int = (v, lo, hi) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : lo; };

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
  }
  get isStory() { return this.s.mode === 'story'; }
  // ---------------- life cycle ----------------
  start() {
    this.startedAt = this.room.now();
    const m = MINUTES[this.s.length]; if (m) this.endsAt = this.startedAt + m * 60000;
    for (const p of this.room.list()) this.newRun(p, true);
    if (this.isStory) {
      this.endsAt = 0; // Regular mode ends with the boss (or everyone down), not the clock
      this.plan = S.plan(this.seed, this.homes); this.plan.homes = this.homes.map((h) => h.slice());
      this.story = { tier: 0, keys: [], maps: 0, taken: {}, doorFound: false, doorOpen: false, beats: [], finds: [] };
      this.beat('start');
    }
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
      st.tier++;
      const look = (() => { for (let y = 0; y < W.GRID; y++) for (let x = 0; x < W.GRID; x++) if (S.tierAt(this.plan, x, y) === st.tier) return W.biomeOf(this.seed, x, y); return W.HOME; })();
      this.news('⛓️', `The chains on the ${look.name} gate snapped! Ring ${st.tier} is open.`); this.room.fx('tzunlock', { tier: st.tier }); this.beat('tier' + st.tier); this.soon();
    }
  }
  locked(x, y) { return !!(this.story && S.tierAt(this.plan, x, y) > this.story.tier); }
  joined(p) { if (this.phase === 'play' && !this.runs.has(p.id)) this.newRun(p, true); }
  left(p) { const id = p && p.id ? p.id : p; this.leaveArea(id); }
  tick() {
    this.room.cancel(this.timer);
    if (this.phase !== 'play') return;
    const now = this.room.now();
    for (const p of this.room.list()) if (p.bot) this.botStep(p, now);
    // An area host whose phone dropped: the next player in the area takes over.
    for (const [k, A] of this.areas) {
      const h = this.room.get(A.host);
      if (!h || (h.sockets <= 0 && !h.bot)) { if (!A.dropAt) A.dropAt = now; else if (now - A.dropAt > HOST_DROP_MS) { const next = A.members.find((id) => id !== A.host && (this.room.get(id) || {}).sockets > 0); if (next) { A.host = next; A.dropAt = 0; this.tellArea(k, { t: 'host' }); } } } else A.dropAt = 0;
    }
    if (this.endsAt && now >= this.endsAt) return this.end('time');
    if (this.story) {
      this.storyCheck();
      const runs = this.humans().map((p) => this.runs.get(p.id)).filter(Boolean);
      if (runs.length && runs.every((R) => R.state === 'dead')) return this.end('lost');
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
    this.room.fx('win');
  }
  next() { if (this.phase === 'play') this.end('host'); }
  results() { return this.phase === 'over' ? this.standings().map((r) => r.id) : []; }

  // ---------------- runs ----------------
  newRun(p, first = false, keep = false) {
    const old = this.runs.get(p.id);
    if (keep && old) { // Regular mode: back in at your own garage with your build
      Object.assign(old, { state: 'play', cell: old.home.slice(), hp: old.mhp, at: this.room.now(), lastSt: this.room.now(), reviveAt: 0, areas: old.areas + 1, comeback: (old.comeback || 0) + 1 });
      this.leaveArea(p.id); this.joinArea(p.id, key(old.cell)); this.room.fx('tzgarage', { id: p.id, x: old.cell[0], y: old.cell[1] });
      this.news('🔁', `${this.room.name(p.id)} is back in the fight`, p.id); return old;
    }
    if (old) { this.keepBest(old); this.leaveArea(p.id); }
    const taken = [...this.runs.values()].filter((R) => R.id !== p.id && R.state !== 'dead').map((R) => R.cell);
    // Regular mode: late arrivals start in one of the garages the story was planned around (never behind a gate)
    const cell = this.plan ? this.plan.homes[(this.runs.size + (old ? old.run : 0)) % this.plan.homes.length].slice() : W.spawnCell(this.seed, taken, (old ? old.run : 0) + this.runs.size);
    if (!this.homes.some((h) => h[0] === cell[0] && h[1] === cell[1])) this.homes.push(cell.slice());
    const R = {
      id: p.id, bot: !!p.bot, run: (old ? old.run : 0) + 1, cell: cell.slice(), home: cell.slice(), state: 'play', wave: 1, areas: 1, lvl: 1, xp: 0, kills: 0, hp: 100, mhp: 100,
      ab: {}, eq: {}, hearts: 0, bank: old ? (old.bank || 0) + old.kills : 0, choosing: false, at: this.room.now(), lastSt: this.room.now(), best: old ? old.best : null, lastPick: null, danger: false, deaths: old ? old.deaths : 0,
    };
    if (p.bot) Object.assign(R, { nextAt: this.room.now() + 4000 + this.room.rng() * 3000, fate: 0.04 + this.room.rng() * 0.05 });
    this.runs.set(p.id, R);
    this.explore(cell, p.id); this.joinArea(p.id, key(cell));
    this.room.fx('tzgarage', { id: p.id, x: cell[0], y: cell[1] });
    this.news(first ? '🚪' : '🔁', first ? `${this.room.name(p.id)} rolls up the garage door` : `${this.room.name(p.id)} is back for another run`, p.id);
    return R;
  }
  keepBest(R) {
    const cur = { wave: R.wave, kills: R.kills, lvl: R.lvl, ab: { ...R.ab } };
    if (!R.best || cur.wave > R.best.wave || (cur.wave === R.best.wave && cur.kills > R.best.kills)) R.best = cur;
  }
  explore(cell, by) { const k = key(cell); if (!this.explored.has(k)) this.explored.set(k, { by, at: this.room.now() }); }
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
  // The relay: the host's snapshots go to the guests; a guest's input/hits go to the host.
  live(p, m) {
    if (this.phase !== 'play' || !p || !m || typeof m !== 'object' || !LIVE_KINDS.has(m.t)) return false;
    const now = this.room.now();
    const L = p._tzLive || (p._tzLive = { at: now, n: 0 });
    if (now - L.at > 1000) { L.at = now; L.n = 0; }
    if (++L.n > 60) return false; // at most 60 messages a second per phone
    let size = 0; try { size = JSON.stringify(m).length; } catch { return false; }
    if (size > 16000) return false;
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
      if (this.story) { if (this.room.now() < (R.reviveAt || 0)) return { ok: false, error: 'Catch your breath a moment…' }; this.newRun(p, false, true); return { ok: true }; }
      this.newRun(p); return { ok: true };
    }
    if (m.op === 'st') return this.status(p, R, m);
    if (m.op === 'enter') return this.enter(p, R, m);
    if (m.op === 'ev') return this.event(p, R, m);
    if (m.op === 'find') return this.find(p, R, m);
    if (m.op === 'door') return this.openDoor(p, R);
    return { ok: false, error: 'Unknown move.' };
  }
  // Status ping (~1 a second): checked loosely (it's a party game, but numbers stay believable).
  status(p, R, m) {
    if (R.state === 'dead') return { ok: true, quiet: true };
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
    R.choosing = !!m.ch; R.danger = R.hp > 0 && R.hp / R.mhp < 0.3;
    if (this.story) this.storyCheck();
    if (before !== R.lvl + ':' + R.wave + ':' + (R.danger ? 1 : 0) + ':' + R.choosing) this.soon();
    return { ok: true, quiet: true };
  }
  areaKills(R) { return R.wave * 20; } // co-op shared XP: levels can come from friends' kills too
  enter(p, R, m) {
    if (R.state === 'dead') return { ok: false, error: 'You’re down.' };
    const x = Number(m.x), y = Number(m.y);
    if (!W.inGrid(x, y)) return { ok: false, error: 'That’s the edge of town.' };
    if (Math.abs(x - R.cell[0]) + Math.abs(y - R.cell[1]) !== 1) return { ok: false, error: 'Too far away.' };
    if (!W.roadBetween(this.seed, R.cell, [x, y])) return { ok: false, error: 'No road that way.' };
    if (this.locked(x, y)) return { ok: false, error: `🔒 That gate is chained: ${Math.max(0, this.need(S.tierAt(this.plan, x, y)) - this.teamKills())} more zombies to break through.` };
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
    } else if (k === 'clear') {
      const w = int(m.wave, 1, 999); if (w % 5 === 0 || w >= 10) this.news('🧹', `${p.name} cleared wave ${w}`, p.id); this.room.fx('tzclear', { id: p.id });
      if (this.s.length === 'w20' && w >= 20) { this.news('🏁', `${p.name} survived wave 20!`, p.id); this.keepBest(R); this.end('w20'); return { ok: true }; }
    } else if (k === 'victory') {
      if (!this.story || !this.story.doorOpen) return { ok: false, error: 'Not yet.' };
      this.story.won = { by: p.id, at: this.room.now() }; this.news('🏆', `${p.name} took down ${S.BOSSES[this.plan.boss].name}!`, p.id); this.beat('win'); this.keepBest(R); this.end('win'); return { ok: true };
    } else if (k === 'heart') { R.hearts = Math.max(0, (R.hearts || 0) - 1); this.news('💖', `${p.name} used a Spare Heart`, p.id); this.room.fx('tzhurt', { id: p.id });
    } else if (k === 'boss') { this.news('🗑️', `A Dumpster Brute crawls out near ${p.name}!`, p.id); this.room.fx('tzboss', { id: p.id }); }
    else if (k === 'down') { this.news('💫', `${p.name} used a Spare Lunchbox`, p.id); this.room.fx('tzhurt', { id: p.id }); }
    else if (k === 'hurt') { this.room.fx('tzhurt', { id: p.id }); }
    else if (k === 'dead') {
      if (R.state === 'dead') return { ok: true };
      R.state = 'dead'; R.hp = 0; R.deaths++; R.deadAt = this.room.now(); this.keepBest(R); this.leaveArea(p.id);
      if (this.story) { R.reviveAt = this.room.now() + REVIVE_MS; if (this.humans().every((h) => !this.runs.get(h.id) || this.runs.get(h.id).state === 'dead')) { this.news('💀', `${p.name} fell. Nobody is left standing…`, p.id); this.room.fx('tzdead', { id: p.id }); this.end('lost'); return { ok: true }; } }
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
    if (F.kind === 'key') { this.story.keys.push(id); this.beat(this.story.keys.length >= 3 ? 'keys' : 'key'); }
    else if (F.kind === 'map') { this.story.maps++; this.beat('map' + Math.min(2, this.story.maps)); }
    else if (F.kind === 'token') R.hearts = (R.hearts || 0) + 1;
    else R.eq[id] = 1;
    this.news(F.icon, `${p.name} found ${F.name}!`, p.id); this.room.fx('tzfind', { id: p.id, find: id }); this.soon();
    return { ok: true, find: id };
  }
  openDoor(p, R) {
    const st = this.story; if (!st) return { ok: false, error: 'No door in Endless.' };
    if (R.cell[0] !== this.plan.door[0] || R.cell[1] !== this.plan.door[1]) return { ok: false, error: 'The door isn’t here.' };
    if (st.keys.length < 3) return { ok: false, error: `The door needs the whole key: ${st.keys.length}/3 pieces.` };
    if (st.doorOpen) return { ok: true, boss: this.plan.boss };
    st.doorOpen = true; st.doorFound = true; st.openedAt = this.room.now();
    const B = S.BOSSES[this.plan.boss]; this.news(B.icon, `${p.name} opened the door. ${B.name} wakes up!`, p.id); this.room.fx('tzdoor', { id: p.id }); this.beat('open'); this.soon();
    return { ok: true, boss: this.plan.boss };
  }
  storyTv() {
    const st = this.story; if (!st) return null; const P = this.plan, B = S.BOSSES[P.boss];
    return { tier: st.tier, max: S.MAX_TIER, needs: [1, 2, 3, 4].map((t) => this.need(t)), kills: this.teamKills(), keys: st.keys.length, maps: st.maps, tiers: P.tiers,
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
    if (now < R.nextAt) { R.kills += 1 + Math.floor(this.room.rng() * (1 + R.wave / 3)); R.hp = Math.max(1, Math.min(R.mhp, R.hp - Math.floor(this.room.rng() * 6) + 2)); return; }
    // wave cleared: level up, maybe die, walk on
    R.lvl += 1 + (this.room.rng() < 0.4 ? 1 : 0);
    const owned = R.ab, ids = W.offer(this.room.rng, owned); const id = ids[0];
    if (id && W.levelsFromAbilities(owned) < R.lvl - 1) { owned[id] = (owned[id] || 0) + 1; R.lastPick = id; }
    const hard = this.s.diff === 'hard' ? 1.6 : this.s.diff === 'chill' ? 0.6 : 1;
    if (this.room.rng() < R.fate * R.wave * 0.35 * hard) { R.state = 'dead'; R.hp = 0; R.deadAt = now; R.deaths++; this.keepBest(R); this.news('💀', `${p.name} fell on wave ${R.wave}`, p.id); this.room.fx('tzdead', { id: p.id }); return; }
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => [R.cell[0] + dx, R.cell[1] + dy]).filter(([x, y]) => W.roadBetween(this.seed, R.cell, [x, y]) && !this.locked(x, y));
    if (this.story) this.storyCheck();
    if (dirs.length) R.cell = dirs[Math.floor(this.room.rng() * dirs.length)]; R.areas++; R.wave++; this.explore(R.cell, p.id);
    R.hp = R.mhp = 100 + 25 * (owned.hp || 0);
    R.nextAt = now + 14000 + this.room.rng() * 14000;
  }

  // ---------------- screens ----------------
  standings() {
    return this.room.list().filter((p) => this.runs.has(p.id)).map((p) => {
      const R = this.runs.get(p.id), cur = { wave: R.wave, kills: R.kills, lvl: R.lvl, ab: R.ab };
      const b = R.best && (R.best.wave > cur.wave || (R.best.wave === cur.wave && R.best.kills > cur.kills)) ? R.best : cur;
      return { id: p.id, name: p.name, avatar: p.avatar, color: p.color, wave: b.wave, kills: b.kills, lvl: b.lvl, build: Object.entries(b.ab || {}).sort((a, c) => c[1] - a[1]).slice(0, 6), runs: R.run, eq: Object.keys(R.eq || {}) };
    }).sort((a, b) => b.wave - a.wave || b.kills - a.kills || b.lvl - a.lvl);
  }
  people() {
    return this.room.list().filter((p) => this.runs.has(p.id)).map((p) => {
      const R = this.runs.get(p.id);
      return { id: p.id, name: p.name, avatar: p.avatar, color: p.color, bot: !!p.bot, x: R.cell[0], y: R.cell[1], state: R.state, wave: R.wave, lvl: R.lvl, kills: R.kills, hp: R.hp, mhp: R.mhp, danger: R.danger, ch: R.choosing, pick: R.lastPick, run: R.run,
        ab: Object.entries(R.ab).sort((a, c) => c[1] - a[1]).slice(0, 5).map(([id]) => id) };
    });
  }
  tv() {
    return {
      phase: this.phase, seed: this.seed, grid: W.GRID, homes: this.homes, explored: [...this.explored].map(([k, v]) => [...k.split(',').map(Number), v.by]),
      players: this.people(), feed: this.feed.slice(-8), endsIn: this.endsAt ? Math.max(0, this.endsAt - this.room.now()) : 0, length: this.s.length, diff: this.s.diff,
      coop: [...this.areas].filter(([, A]) => A.members.length > 1).map(([k, A]) => ({ k, host: A.host, members: A.members.slice() })),
      standings: this.standings().slice(0, 12), why: this.overWhy, mode: this.s.mode, story: this.storyTv(),
    };
  }
  view(p) {
    const R = this.runs.get(p.id), A = this.areaOf(p.id);
    return {
      phase: this.phase, seed: this.seed, grid: W.GRID, homes: this.homes, explored: [...this.explored.keys()].map((k) => k.split(',').map(Number)),
      players: this.people().filter((x) => x.id !== p.id).map(({ id, name, color, avatar, x, y, state, wave, lvl, hp, mhp, bot }) => ({ id, name, color, avatar, x, y, state, wave, lvl, hp, mhp, bot })),
      me: R ? { id: p.id, run: R.run, cell: R.cell, home: R.home, state: R.state, wave: R.wave, lvl: R.lvl, xp: R.xp, kills: R.kills, hp: R.hp, mhp: R.mhp, ab: R.ab, eq: R.eq || {}, hearts: R.hearts || 0, best: R.best, deaths: R.deaths, comeback: R.comeback || 0 } : null,
      area: A ? { k: A.k, host: A.host, members: A.members.slice() } : null,
      settings: { diff: this.s.diff, aim: this.s.aim, xp: this.s.xp, length: this.s.length, mode: this.s.mode }, endsIn: this.endsAt ? Math.max(0, this.endsAt - this.room.now()) : 0,
      feed: this.feed.slice(-4), standings: this.phase === 'over' ? this.standings() : null, why: this.overWhy, mode: this.s.mode, story: this.storyView(p),
    };
  }
}

module.exports = {
  key: 'trash', name: 'TrashZombies', min: 1, best: [1, 4], fields, defaults,
  show: { facts: false }, // intro cutscene before the game (public/box/intros/trash.js)
  difficulty: { key: 'diff', values: { easy: 'chill', medium: 'normal', hard: 'hard' } },
  practice: false, // a run is its own warm-up: the first waves are gentle
  dropIn: true, // late arrivals jump straight in: they roll up their own garage door somewhere on the map
  partyFit,
  create: (room, settings) => new Game(room, settings),
};
