'use strict';
// Mafia Town game engine. All rules and hidden information live here.
// Clients only ever receive views filtered for what they're allowed to see:
//   hostView   -> the big screen (public information only)
//   judgeView  -> the Judge console (everything, for the person running the game)
//   playerView -> one phone (public info + that player's own secrets)
// Timers go through an injectable clock, so the same engine runs real games
// and thousands of headless simulations (see sim.js).

const crypto = require('crypto');
const narrator = require('./narrator');
const OPTIONS = require('./public/shared/options');
const R = require('./public/shared/roles');
const { THEMES } = require('./public/shared/themes');
const { RealClock } = require('./clock');
const { BotBrain, PERSONALITIES } = require('./bots');
const CONFIG = require('./public/shared/config');

const { ROLES, TELEPATH_MESSAGES } = R;

const DEFAULT_SETTINGS = {
  ...CONFIG.DEFAULTS,
  townName: 'Mafia Town',
  theme: 'medieval',
  narratorStyle: 'classic',
  narratorMode: 'ai',         // ai = the TV narrates | human = the Judge narrates in person
  revealMode: 'auto',         // auto = dawn plays itself | judge = the Judge reveals each event
  minPlayers: 4,
  maxPlayers: 100,
  autoMafia: true,            // Mafia count scales with the player count
  roleCounts: { mafia: 1, detective: 1, doctor: 1 },
  vigilanteShots: 1,
  doctorSelfProtect: true,
  nightSeconds: 45,
  discussionSeconds: 120,
  votingSeconds: 45,
  autoAdvance: true,          // false = the Judge opens and closes voting
  revealRoleOnDeath: true,
  allowSkip: true,
  tieRule: 'none',            // none | random
  majority: 'plurality',      // plurality | majority (more than half of all votes)
  anonymousVotes: false,
  mafiaWinAt: 'parity',       // parity | all
  telepathWhen: 'always',     // always | night | day
  ghostHaunts: true,
  botChatter: true,
  // test mode
  speed: 1,
  skipCinematics: false,
  botsAuto: true,
  puppetUses: 2,
  glitchUses: 1,
  harmonyGoal: 2,
  paparazziGoal: 2,
  forcedRoles: {},
};

const ENV_SPEED = Number(process.env.MT_SPEED) || 1; // test knob: >1 makes every phase faster
// Phase lengths that wait for the big screen's cinematics (see public/scenes.js).
const CINE_MS = { roleReveal: 14000, dawn: 8000, dawnEvent: 15200, morning: 8000, verdict: 7500, execution: 10800, noExecution: 4500 };

const HARD_MIN_PLAYERS = 3;
const HARD_MAX_PLAYERS = 100;
const HAUNT_COOLDOWN_MS = 4000;
const HAUNT_KINDS = ['boo', 'spin', 'wail'];
const TELEPATH_COOLDOWN_MS = 2500;
const TELEPATH_PER_PHASE = 8;

const BOT_NAMES = ['Ada', 'Benny', 'Clara', 'Dmitri', 'Edie', 'Felix', 'Gus', 'Hazel', 'Iggy', 'June', 'Kip', 'Lola', 'Milo', 'Nell', 'Otto', 'Pip', 'Quinn', 'Rosa', 'Sully', 'Tess', 'Ugo', 'Vera', 'Wes', 'Xena', 'Yuri', 'Zoe', 'Bruno', 'Cleo', 'Dot', 'Ezra', 'Fern', 'Gil', 'Hugo', 'Ivy', 'Jax', 'Kit', 'Luz', 'Mabel', 'Ned', 'Opal', 'Penn', 'Rex', 'Sage', 'Theo', 'Uma', 'Vic', 'Wren', 'Yara', 'Zeke', 'Arlo'];

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const int = (v, d) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : d; };

// Small seeded PRNG so simulations are reproducible.
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function sanitizeName(s) {
  return String(s || '').replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 14);
}

const NULL_IO = { to: () => ({ emit() {} }) };

class Room {
  constructor(code, io, opts = {}) {
    this.code = code;
    this.io = io || NULL_IO;
    this.clock = opts.clock || new RealClock();
    this.headless = !!opts.headless;
    this.profiles = opts.profiles || null;
    this.seeded = opts.seed != null;
    this.rng = this.seeded ? mulberry32(opts.seed) : Math.random;
    this.hostKey = crypto.randomBytes(12).toString('hex');
    this.judgeKey = this.hostKey;
    this.adminEpoch = 0;
    this.removalVotes = new Set();
    this.judgeVolunteers = new Set();
    this.players = new Map();
    this.settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
    this.joinBase = null;
    this.phase = 'lobby';
    this.phaseId = 0;
    this.day = 0;
    this.endsAt = null;
    this.timer = null;
    this.paused = false;
    this.remainingMs = null;
    this.night = null;
    this.votes = null;
    this.pending = null;
    this.lastTarget = {};
    this.winner = null;
    this.composition = null;
    this.narration = null;
    this.narrationSeq = 0;
    this.cinematic = null;
    this.cineSeq = 0;
    this.deathSeq = 0;
    this.accSeq = 0;
    this.accusations = [];
    this.voteHistory = [];
    this.telepathLog = [];
    this.log = [];
    this.stats = null;
    this.brains = new Map();
    this.syncQueued = false;
    this.startedAt = 0;
    this.lastActivity = Date.now();
    this.turn = 0; this.eventSeq = 0; this.effectSeq = 0; this.eventLog = []; this.scheduledEvents = [];
  }

  // ---------- helpers ----------
  now() { return this.clock.now(); }
  later(ms, fn) { return this.clock.set(fn, ms); }
  newId(n = 4) {
    if (!this.seeded) return crypto.randomBytes(n).toString('hex');
    let s = '';
    for (let i = 0; i < n * 2; i++) s += Math.floor(this.rng() * 16).toString(16);
    return s;
  }
  pick(a) { return a[Math.floor(this.rng() * a.length)]; }
  shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  list() { return [...this.players.values()]; }
  inGame() { return this.list().filter((p) => !p.spectator && !p.left && !p.isJudge); }
  alive() { return this.inGame().filter((p) => p.alive); }
  byToken(token) { return token ? this.list().find((p) => p.token === token) : null; }
  touch() { this.lastActivity = Date.now(); }
  role(p) { return ROLES[p.role] || ROLES.villager; }
  team(p) { return this.role(p).team; }
  speed() { return ENV_SPEED * (this.settings.speed || 1); }
  ms(seconds) { return (seconds * 1000) / this.speed(); }
  cine(key, extra = 0) { return this.settings.skipCinematics ? 400 / ENV_SPEED : (CINE_MS[key] + extra) / this.speed(); }

  addLog(text, hidden = false) {
    this.log.push({ day: this.day, phase: this.phase, text, hidden });
    if (this.log.length > 400) this.log.shift();
  }

  narrate(key, vars = {}) {
    this.narrationHistory = this.narrationHistory || {};
    const text = narrator.line(this.settings.narratorStyle, key, { town: this.settings.townName, theme: this.settings.theme, alive: this.alive().length, firstDeath: !!this.stats && this.stats.nightKills.length === 1, previous: this.narrationHistory[key], ...vars }, this.rng);
    this.narrationHistory[key] = text;
    this.narration = { id: ++this.narrationSeq, text, key, suggestion: this.settings.narratorMode === 'human' };
    this.addLog(this.narration.suggestion ? `💡 (suggested line) ${text}` : `📣 ${text}`);
  }

  rolePhrase(p) {
    const r = this.role(p);
    if (p.role === 'mafia') return 'a member of the Mafia';
    if (r.team === 'town' && p.role === 'villager') return 'a Villager';
    return `the ${r.name}`;
  }

  roleSuffix(p) {
    return this.settings.revealRoleOnDeath && p.role ? ` They were ${this.rolePhrase(p)}.` : '';
  }

  uniqueName(name, exceptId) {
    const taken = new Set(this.list().filter((p) => p.id !== exceptId).map((p) => p.name.toLowerCase()));
    if (!taken.has(name.toLowerCase())) return name;
    for (let i = 2; ; i++) {
      const n = `${name.slice(0, 12)}${i}`;
      if (!taken.has(n.toLowerCase())) return n;
    }
  }

  sanitizeAvatar(a) {
    a = a || {};
    // Missing values: these get a random pick so bots and old saves stay varied;
    // the rest use the first option. Older saves stored the mood in `features`.
    const RANDOM = ['color', 'skin', 'houseStyle', 'houseColor'];
    const avatar = {};
    for (const [key, list] of Object.entries(OPTIONS.AVATAR_FIELDS)) {
      const choices = OPTIONS[list];
      avatar[key] = choices.includes(a[key]) ? a[key]
        : key === 'expression' && a.features === 'serious' ? 'serious'
        : RANDOM.includes(key) ? this.pick(choices) : choices[0];
    }
    return avatar;
  }

  // House design (separate from the character). Missing style/wall get a random
  // pick so towns stay varied; legacy saves stored style/wall/decor on the avatar.
  sanitizeHome(h, legacyAvatar) {
    h = h && typeof h === 'object' ? h : {}; const legacy = legacyAvatar || {};
    const home = {};
    for (const [key, list] of Object.entries(OPTIONS.HOME_FIELDS)) {
      const choices = OPTIONS[list], old = OPTIONS.LEGACY_HOME[key] && legacy[OPTIONS.LEGACY_HOME[key]];
      home[key] = choices.includes(h[key]) ? h[key] : choices.includes(old) ? old : ['style', 'wall'].includes(key) ? this.pick(choices) : choices[0];
    }
    return home;
  }

  // ---------- homes: ownership and residents ----------
  // p.house is the player's plot AND their seat number ("PLAYER 3"), so it stays
  // unique. A player either lives on their own plot or with another owner
  // (p.livesWith). Only owners have a house drawn; signs list the residents.
  ownerOfHome(p) { const o = p.livesWith && this.players.get(p.livesWith); return o && !o.left && !o.livesWith ? o : null; }
  homeSlot(p) { const o = this.ownerOfHome(p); return o ? o.house : p.house; }
  residentsOf(owner) { return this.list().filter((x) => x !== owner && x.livesWith === owner.id && !x.left); }
  claimHome(p, claim = {}) {
    if (this.phase !== 'lobby' || p.left) return { ok: false, error: 'Homes can only change in the lobby.' };
    if (claim.with != null) {
      const owner = this.players.get(String(claim.with));
      if (!owner || owner === p || owner.left || owner.livesWith || owner.spectator) return { ok: false, error: 'That house is not available.' };
      if (this.residentsOf(owner).length + 1 >= OPTIONS.MAX_RESIDENTS) return { ok: false, error: 'That house is full.' };
      for (const guest of this.residentsOf(p)) guest.livesWith = null; // your own guests go home
      p.livesWith = owner.id;
    } else if (claim.plot != null) {
      const n = Number(claim.plot);
      if (!Number.isInteger(n) || n < 0 || n >= HARD_MAX_PLAYERS || this.list().some((x) => x !== p && x.house === n)) return { ok: false, error: 'That plot is taken.' };
      p.house = n; p.livesWith = null;
    } else p.livesWith = null;
    this.sync();
    return { ok: true };
  }
  // Plots nobody holds, up to one past the current town edge (shown as "empty plots").
  freePlots() {
    const used = new Set(this.list().map((x) => x.house)), edge = Math.min(HARD_MAX_PLAYERS, Math.max(0, ...used) + 2);
    return Array.from({ length: edge }, (_, i) => i).filter((i) => !used.has(i));
  }

  reindexHouses() {
    // House slots are identity-bound; removals never move another owner.
    // Anyone living with a removed or departed owner moves back to their own plot.
    for (const p of this.list()) if (p.livesWith && !this.ownerOfHome(p)) p.livesWith = null;
  }

  resetPlayer(p) {
    Object.assign(p, {
      alive: true, role: null, originalRole: null, spectator: false, investigations: [], notes: [],
      diedDay: null, deathCause: null, deathOrder: null, shotsLeft: 0, telepathSent: 0, telepathAt: -Infinity, won: null,
      abilityUses: 0, ghostDay: -1, ghostMessage: null, photos: 0, photoPending: null,
      harmony: 0, objective: null, privateScene: null,
      statuses: [], actionUses: {}, actionDays: {}, copiedAbility: null, stolenAbilities: [],
      houseState: 'normal', ghostVoteUsed: false, whispersUsed: 0, whisperAt: -Infinity, whispers: [],
      ghostChat: [], nominations: 0, ashes: false, potions: { midas: 0, volatile: 0 },
      mimicUsed: false, mimicActed: false, metrics: { abilities: 0, saves: 0, correctInvestigations: 0, objectives: 0 }, savedTargets: [],
    });
  }

  // ---------- lobby ----------
  join({ name, avatar, home } = {}) {
    name = sanitizeName(name);
    if (!name) return { error: 'Please enter a name.' };
    if (this.players.size >= clamp(this.settings.maxPlayers, HARD_MIN_PLAYERS, HARD_MAX_PLAYERS)) return { error: 'This town is full.' };
    const p = {
      id: this.newId(4),
      token: crypto.randomBytes(16).toString('hex'),
      name: this.uniqueName(name),
      avatar: this.sanitizeAvatar(avatar),
      homeLook: this.sanitizeHome(home, avatar),
      livesWith: null,
      house: Array.from({ length: HARD_MAX_PLAYERS }, (_, i) => i).find((i) => !this.list().some((x) => x.house === i)),
      sockets: 0,
      isBot: false,
      personality: null,
      left: false,
      hauntAt: 0,
    };
    this.resetPlayer(p);
    p.spectator = this.phase !== 'lobby';
    this.players.set(p.id, p);
    this.touch();
    this.sync();
    return { player: p };
  }

  updateProfile(p, { name, avatar, home } = {}) {
    if (this.phase !== 'lobby' || p.left) return false;
    if (avatar) p.avatar = this.sanitizeAvatar(avatar);
    if (home && typeof home === 'object') p.homeLook = this.sanitizeHome({ ...p.homeLook, ...home });
    if (name != null && this.phase === 'lobby') {
      const n = sanitizeName(name);
      if (n) p.name = this.uniqueName(n, p.id);
    }
    this.sync();
  }

  addBots(n, personality) {
    if (this.phase !== 'lobby') return { ok: false, error: 'Bots can only join in the lobby.' };
    const used = new Set(this.list().map((p) => p.name));
    const free = BOT_NAMES.filter((b) => !used.has(b));
    const max = clamp(this.settings.maxPlayers, HARD_MIN_PLAYERS, HARD_MAX_PLAYERS);
    for (let i = 0; i < n && this.players.size < max; i++) {
      const base = free[i] || `Bot${this.players.size + 1}`;
      const { player } = this.join({
        name: base,
        avatar: { color: this.pick(OPTIONS.colors), skin: this.pick(OPTIONS.skins), hat: this.pick(OPTIONS.hats) },
      });
      if (!player) break;
      player.isBot = true;
      player.token = null;
      const brain = new BotBrain(this.rng, personality);
      player.personality = brain.personality;
    }
    this.sync();
    return { ok: true };
  }

  removeBots() {
    if (this.phase !== 'lobby') return { ok: false, error: 'Only in the lobby.' };
    for (const p of this.list()) if (p.isBot) this.players.delete(p.id);
    this.reindexHouses();
    this.sync();
    return { ok: true };
  }

  kick(id) {
    const p = this.players.get(id);
    if (!p) return;
    if (!p.isBot && (this.removalVotes.size || p.isJudge)) return;
    this.io.to(this.playerChannel(p)).emit('player:kicked');
    if (this.phase === 'lobby' || p.spectator) {
      this.players.delete(id);
      delete this.settings.forcedRoles[id];
      this.reindexHouses();
    } else {
      p.left = true;
      if (p.alive) this.kill(p, 'left');
      this.addLog(`${p.name} left the game.`);
      this.afterJudgeChange();
    }
    this.sync();
  }

  // ---------- setup ----------
  setupFor(n) {
    return R.buildRoleList(this.settings, n);
  }

  startGame() {
    for (const p of this.list()) if (p.left) this.players.delete(p.id);
    const players = this.list().filter((p) => !p.isJudge && !p.judgeRetired);
    const min = clamp(this.settings.minPlayers, HARD_MIN_PLAYERS, HARD_MAX_PLAYERS);
    if (players.length < min) return { ok: false, error: `Need at least ${min} players.` };
    const setup = this.setupFor(players.length);
    if (setup.errors.length) return { ok: false, error: setup.errors[0] };

    players.forEach((p) => this.resetPlayer(p));
    this.reindexHouses();

    // Forced roles first (test mode), then shuffle the rest.
    const pool = setup.roles.slice();
    const forced = this.settings.forcedRoles || {};
    const free = [];
    for (const p of players) {
      const want = forced[p.id];
      const idx = want ? pool.indexOf(want) : -1;
      if (idx >= 0) { p.role = pool[idx]; pool.splice(idx, 1); } else free.push(p);
    }
    this.shuffle(pool);
    free.forEach((p, i) => { p.role = pool[i]; });
    this.brains = new Map();
    for (const p of players) {
      p.originalRole = p.role;
      if (p.role === 'vigilante') p.shotsLeft = clamp(int(this.settings.vigilanteShots, 1), 1, 10);
      if (p.isBot) this.brains.set(p.id, new BotBrain(this.rng, p.personality));
    }

    this.composition = {};
    for (const r of setup.roles) this.composition[r] = (this.composition[r] || 0) + 1;
    Object.assign(this, {
      day: 0, winner: null, lastTarget: {}, deathSeq: 0, pending: null, reveal: null, votes: null, night: null,
      accusations: [], voteHistory: [], telepathLog: [], log: [], startedAt: this.now(),
      publicStories: [], confirmedTown: [], harmonyTotal: 0, glitchUntil: 0,
      storyHoldUntil: 0, storySeq:0, narrationHistory: {},
      turn: 0, eventLog: [], eventSeq: 0, scheduledEvents: [], mafiaChat: [], mafiaBluffs: [],
      pendingRevivals: [], emergency: null, nomination: null, storyTerminal: false, hustledDay: null, shortenedDiscussion: null,
      gameId: crypto.randomUUID(), rewarded: false, progressionNotice: null,
    });
    this.stats = {
      nightKills: [], lynches: [], saves: 0, guards: 0, immune: 0, blocks: 0, shots: [], investigations: [],
      noLynchDays: 0, ties: 0, skipVotes: 0, totalVotes: 0, promotions: 0,
      expansion: { spyChecks: 0, ghostMessages: 0, redirectedVotes: 0, photosPublished: 0, harmonyObjectives: 0, blessings: 0, glitches: 0 },
    };
    this.addLog(`Game started with ${players.length} players: ${Object.entries(this.composition).map(([r, c]) => `${c} ${ROLES[r].name}`).join(', ')}.`, true);
    for (const p of players) this.addLog(`${p.name} is ${ROLES[p.role].name}.`, true);
    this.narrate('start', { count: players.length });
    this.setCinematic({ type: 'start' });
    this.setPhase('roleReveal', this.cine('roleReveal'));
    return { ok: true };
  }

  // ---------- phase machine ----------
  setPhase(phase, ms) {
    if (this.settings.narratorMode === 'human') ms = null;
    if (this.settings.narratorMode === 'human') ms = null;
    this.clock.clear(this.timer);
    this.timer = null;
    this.phase = phase;
    this.turn++; this.expireStatuses();
    if (['discussion', 'voting'].includes(phase)) this.publishGhosts();
    this.processScheduled();
    if (this.storyTerminal && this.winner && ms && this.settings.narratorMode !== 'human') ms = this.ms(12);
    if (['lobby', 'gameover'].includes(phase)) this.glitchUntil = 0;
    if (ms && this.storyHoldUntil > this.now()) ms = Math.max(ms, this.storyHoldUntil - this.now());
    this.phaseId++;
    this.paused = false;
    this.remainingMs = null;
    if (ms) {
      this.endsAt = this.now() + ms;
      this.timer = this.later(ms, () => this.advance());
    } else {
      this.endsAt = null;
    }
    for (const p of this.list()) p.telepathSent = 0;
    this.touch();
    this.scheduleBots();
    this.sync();
  }

  setCinematic(c) {
    if (c.type === 'stories') c = { ...c,stories:c.stories.map((s) => s.cueId ? s : { ...s,cueId:'story-' + (this.storySeq = (this.storySeq || 0)+1) }) };
    this.cinematicTurn = this.turn;
    this.cinematic = { id: ++this.cineSeq, ...c };
  }

  // Shorten the current phase (e.g. everyone has acted).
  finishSoon(ms) {
    if (this.paused || this.settings.narratorMode === 'human') return;
    ms /= this.speed();
    if (this.storyHoldUntil > this.now()) ms = Math.max(ms, this.storyHoldUntil - this.now());
    if (this.endsAt && this.endsAt - this.now() <= ms) return;
    if (!this.endsAt && this.phase === 'voting' && !this.settings.autoAdvance) return; // Judge closes voting
    this.clock.clear(this.timer);
    this.endsAt = this.now() + ms;
    this.timer = this.later(ms, () => this.advance());
    this.sync();
  }

  advance() {
    if (this.judgeVacant) return;
    if (this.winner && this.cinematic && this.cinematic.type === 'disaster') return this.endGame();
    this.clock.clear(this.timer);
    this.timer = null;
    this.endsAt = null;
    switch (this.phase) {
      case 'roleReveal': return this.startNight();
      case 'night': return this.resolveNight();
      case 'dawn': return this.startMorning();
      case 'morning': return this.winner ? this.endGame() : this.startDiscussion();
      case 'discussion': return this.startVoting();
      case 'voting': return this.resolveVotes();
      case 'verdict': return this.startExecution();
      case 'execution': return this.winner ? this.endGame() : this.startNight();
      default: return undefined;
    }
  }

  // ---------- night ----------
  nightDef(p) {
    const def = this.role(p).night;
    if (!def) return null;
    if (def.limited && p.shotsLeft <= 0) return null;
    return def;
  }

  startNight() {
    this.day += 1;
    this.night = { actions: {}, order: [], mafiaVotes: {}, metadata: {}, variants: {} };
    for (const p of this.list()) p.mafiaSent = 0;
    this.votes = null;
    this.voteLocks = {};
    this.accusations = [];
    this.promoteIfNeeded();
    this.narrate('night');
    this.setPhase('night', this.ms(this.settings.nightSeconds));
  }

  // If every Mafia killer is gone, a surviving Mafia member takes over.
  promoteIfNeeded() {
    if (this.settings.mafiaDecision !== 'legacy') return;
    const fam = this.alive().filter((p) => this.team(p) === 'mafia');
    if (!fam.length || fam.some((p) => R.isKillerRole(p.role))) return;
    const p = this.pick(fam);
    p.notes.push({ day: this.day, text: `With the family's killers gone, you (${this.role(p).name}) now do the killing.` });
    this.addLog(`${p.name} was promoted from ${this.role(p).name} to Mafia.`, true);
    p.role = 'mafia';
    if (this.stats) this.stats.promotions++;
  }

  nightTargets(p) {
    const alive = this.alive();
    const def = this.nightDef(p);
    if (!def) return alive.filter((x) => x.id !== p.id).map((x) => x.id); // dummy prompt
    let t;
    if (def.targets === 'nonTeam') t = alive.filter((x) => this.team(x) !== this.team(p));
    else if (def.targets === 'any') t = alive.filter((x) => x.id !== p.id || p.role !== 'doctor' || this.settings.doctorSelfProtect);
    else t = alive.filter((x) => x.id !== p.id);
    if (def.noRepeat && this.lastTarget[p.id]) t = t.filter((x) => x.id !== this.lastTarget[p.id]);
    return t.map((x) => x.id);
  }

  nightAction(p, targetId, { force = false } = {}) {
    if ((this.paused && !force) || this.judgeVacant) return false;
    if (this.phase !== 'night' || !p.alive || p.spectator || p.left || !this.night) return false;
    const def = this.nightDef(p);
    const ok = (targetId === 'pass' && def && def.optional) || this.nightTargets(p).includes(targetId);
    if (!ok) return false;
    if (!(p.id in this.night.actions)) this.night.order.push(p.id);
    this.night.actions[p.id] = targetId;
    if (def && def.teamKill) this.night.mafiaVotes[p.id] = targetId;
    if (force) this.addLog(`Judge set ${p.name}'s night action → ${this.nameOf(targetId)}.`, true);
    this.touch();
    this.sync();
    if (this.nightComplete()) this.finishSoon(1500);
    return true;
  }

  nameOf(id) {
    if (id === 'pass') return 'nobody';
    if (id === 'skip') return 'skip';
    const p = this.players.get(id);
    return p ? p.name : '?';
  }

  // Each alive Mafia-team killer's pick, with the Godfather flagged.
  teamPicks(team) {
    if (this.settings.mafiaDecision !== 'legacy') return this.alive().filter((p) => this.team(p) === team && (this.night.mafiaVotes || {})[p.id]).map((p) => ({ id: p.id, targetId: this.night.mafiaVotes[p.id], leader: p.role === 'godfather' }));
    return this.alive()
      .filter((p) => this.team(p) === team && R.isKillerRole(p.role) && this.role(p).night.teamKill && this.night.actions[p.id])
      .map((p) => ({ id: p.id, targetId: this.night.actions[p.id], leader: !!this.role(p).night.leader }));
  }

  nightActors() {
    return this.alive().filter((p) => this.nightDef(p));
  }

  // Night ends early once every power role has acted and each team agrees.
  nightComplete() {
    if (this.settings.mafiaDecision !== 'legacy') return false; // keep the full coordination window
    if (!this.nightActors().every((p) => this.night.actions[p.id])) return false;
    const picks = this.teamPicks('mafia');
    return picks.some((m) => m.leader) || new Set(picks.map((m) => m.targetId)).size <= 1;
  }

  // Resolves all night actions at once, in priority order:
  //   1. blocks  2. heals + guards  3. kills + shots  4. investigations
  // Ties are broken by the room's seeded random generator, so a simulation
  // with the same seed always plays out the same way.
  resolveNight() { return require('./rules/night-pipeline').resolve(this); }

  startMorning() {
    const { deaths = [], events = [] } = this.pending || {};
    this.pending = null;
    const victims = [];
    for (const d of deaths) {
      const p = this.players.get(d.id);
      if (p && p.alive) { this.kill(p, d.cause); victims.push(p); this.stats.nightKills.push({ role: p.role, team: this.team(p), by: d.cause }); }
    }
    if (victims.length) {
      const names = victims.map((v) => v.name);
      const name = names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
      let role = '';
      if (this.settings.revealRoleOnDeath) {
        role = victims.length === 1 ? this.roleSuffix(victims[0]) : ' ' + victims.map((v) => `${v.name} was ${this.rolePhrase(v)}.`).join(' ');
      }
      this.narrate(victims.length > 1 ? 'multiKill' : 'kill', { name, role, alive: this.alive().length, count: victims.length });
    } else {
      const saved = events.find((e) => e.type === 'saved' || e.type === 'guarded');
      if (saved && this.players.get(saved.targetId)) this.narrate('saved', { name: this.players.get(saved.targetId).name });
      else this.narrate('quiet');
    }
    const stories = this.publishPhotos();
    if (stories.length) this.appendStories(stories);
    this.winner = this.checkWinner();
    this.setPhase('morning', this.cine('morning', stories.length * 6500));
  }

  // ---------- day ----------
  startDiscussion() {
    this.assignObjectives();
    this.narrate('discussion');
    this.setPhase('discussion', this.settings.autoAdvance ? this.ms(this.settings.discussionSeconds) : null);
  }

  startVoting() {
    this.votes = {};
    this.voteLocks = {};
    this.narrate('voting');
    this.setPhase('voting', this.settings.autoAdvance ? this.ms(this.settings.votingSeconds) : null);
  }

  voteTargets(p) {
    return this.alive().filter((x) => x.id !== p.id).map((x) => x.id);
  }

  vote(p, targetId, { force = false } = {}) {
    if ((this.paused && !force) || this.judgeVacant) return false;
    if (this.phase !== 'voting' || !this.canCast(p) || !this.votes) return false;
    if (targetId === null && force) { delete this.votes[p.id]; this.sync(); return true; }
    const valid = (targetId === 'skip' && (this.settings.allowSkip || !!this.nomination)) || this.voteTargets(p).includes(targetId);
    if (!valid) return false;
    if (!force && this.voteLocks && this.voteLocks[p.id] && targetId !== this.voteLocks[p.id]) return false;
    this.votes[p.id] = targetId;
    if (force) this.addLog(`Judge set ${p.name}'s vote → ${this.nameOf(targetId)}.`, true);
    this.touch();
    this.sync();
    if (!this.settings.ghostVotes && this.alive().filter((p) => this.canCast(p)).every((x) => this.votes[x.id])) this.finishSoon(2500);
    return true;
  }

  resolveVotes() {
    const alive = this.alive();
    const entries = this.shuffle(this.inGame().filter((p) => !this.hasStatus(p, 'silenced') && (p.alive || this.settings.ghostVotes && p.ghostBallotPhase === this.phaseId) && this.votes && this.votes[p.id]).map((p) => ({ voterId: p.id, targetId: this.votes[p.id], weight: p.alive ? this.role(p).voteWeight || 1 : 1 })));
    const counts = new Map();
    let skips = 0;
    let total = 0;
    for (const e of entries) {
      total += e.weight;
      if (e.targetId === 'skip') skips += e.weight;
      else counts.set(e.targetId, (counts.get(e.targetId) || 0) + e.weight);
    }
    let best = 0;
    let tops = [];
    for (const [k, v] of counts) {
      if (v > best) { best = v; tops = [k]; } else if (v === best) tops.push(k);
    }
    tops.sort();
    let eliminatedId = null;
    let tie = false;
    if (tops.length === 1 && best > skips) eliminatedId = tops[0];
    else if (tops.length > 1 && best > skips && this.settings.tieRule === 'random') eliminatedId = this.pick(tops);
    else if (tops.length > 1 || (tops.length === 1 && best === skips)) tie = true;
    if (eliminatedId && this.settings.majority === 'majority' && best * 2 <= this.gameVoters().reduce((s, p) => s + (p.alive ? this.role(p).voteWeight || 1 : this.votes && this.votes[p.id] ? 1 : 0), 0)) {
      eliminatedId = null;
      tie = false;
    }
    this.stats.totalVotes += entries.length;
    this.stats.skipVotes += entries.filter((e) => e.targetId === 'skip').length;
    if (!eliminatedId) { this.stats.noLynchDays++; if (tie) this.stats.ties++; }

    this.voteHistory.push({ day: this.day, votes: entries.map(({ voterId, targetId }) => ({ voterId, targetId })), eliminatedId });
    this.pending = { eliminatedId, tie, votes: best };
    this.addLog(`Votes: ${entries.map((e) => `${this.nameOf(e.voterId)}→${this.nameOf(e.targetId)}${e.weight > 1 ? `(x${e.weight})` : ''}`).join(', ') || 'none'}.`, true);
    this.narrate('votesIn');
    const shown = this.settings.anonymousVotes ? entries.map((e) => ({ voterId: null, targetId: e.targetId })) : entries.map(({ voterId, targetId }) => ({ voterId, targetId }));
    const followups = this.updateHarmony(entries);
    this.setCinematic({ type: 'votes', votes: shown, eliminatedId, tie, anonymous: this.settings.anonymousVotes, followups });
    this.setPhase('verdict', this.cine('verdict', followups.length * 6500));
  }

  startExecution() {
    const { eliminatedId, tie, votes } = this.pending || {};
    this.pending = null;
    const p = eliminatedId && this.players.get(eliminatedId);
    if (p && p.alive) {
      this.kill(p, 'vote');
      this.stats.lynches.push({ role: p.role, team: this.team(p) });
      if (p.role === 'jester' && this.ruleConfig(p).behavior !== 'mimic') {
        this.winner = 'jester';
        this.jesterId = p.id;
        this.narrate('jesterWin', { name: p.name });
      } else {
        this.narrate('eliminated', { name: p.name, role: this.roleSuffix(p), votes });
      }
    } else {
      this.narrate(tie ? 'tie' : 'noElim');
    }
    if (this.winner !== 'jester') this.winner = this.checkWinner();
    if (p) this.setCinematic({ type: 'execution', targetId: p.id });
    this.setPhase('execution', p ? this.cine('execution') : this.cine('noExecution'));
  }

  kill(p, cause) {
    if (String(cause).startsWith('judge') || cause === 'left') this.withdrawChoices(p.id);
    p.alive = false;
    p.diedDay = this.day;
    p.deathCause = cause;
    p.deathOrder = ++this.deathSeq;
  }

  revive(p) {
    p.ghostMessage = null;
    p.alive = true;
    p.diedDay = null;
    p.deathCause = null;
    p.deathOrder = null;
  }

  // Returns 'town' | 'mafia' | 'serialKiller' | 'draw' | null.
  checkWinner() {
    const alive = this.alive();
    const mafia = alive.filter((p) => this.team(p) === 'mafia').length;
    const sk = alive.filter((p) => p.role === 'serialKiller').length;
    const others = alive.length - mafia - sk;
    if (!alive.length) return 'draw';
    if (mafia === 0 && sk === 0) return 'town';
    const mafiaWins = this.settings.mafiaWinAt === 'all' ? others === 0 : mafia >= others;
    if (sk === 0 && mafiaWins) return 'mafia';
    if (mafia === 0 && others <= 1) return 'serialKiller';
    if (others === 0) return mafia > sk ? 'mafia' : 'serialKiller';
    if (this.day > this.inGame().length + 5) return 'draw'; // safety net
    return null;
  }

  // Did this player win?
  didWin(p) {
    const w = this.winner;
    if (p.role === 'paparazzi') return !!w && p.alive && p.photos >= this.settings.paparazziGoal;
    if (!w || w === 'draw') return false;
    if (w === 'jester') return p.id === this.jesterId;
    if (w === 'serialKiller') return p.role === 'serialKiller';
    return this.team(p) === w;
  }

  endGame() {
    this.clock.clear(this.timer);
    for (const p of this.inGame()) p.won = this.didWin(p);
    const key = { mafia: 'mafiaWin', town: 'townWin', serialKiller: 'skWin', draw: 'draw' }[this.winner];
    if (key) this.narrate(key);
    this.addLog(`Game over: ${R.WINNERS[this.winner] ? R.WINNERS[this.winner].name : this.winner} won on day ${this.day}.`);
    this.setCinematic({ type: 'gameover', winner: this.winner });
    this.setPhase('gameover', null);
  }

  resetToLobby() {
    this.clock.clear(this.timer);
    for (const p of this.list()) if (p.left) this.players.delete(p.id);
    for (const p of this.list()) this.resetPlayer(p);
    for (const p of this.list()) { if (p.isJudge) p.spectator = true; p.judgeRetired = false; }
    this.publicStories = []; this.confirmedTown = []; this.harmonyTotal = 0; this.glitchUntil = 0;
    this.storyHoldUntil = 0; this.narrationHistory = {};
    this.reindexHouses();
    Object.assign(this, { day: 0, winner: null, jesterId: null, pending: null, reveal: null, votes: null, night: null, composition: null, narration: null, cinematic: null, accusations: [], voteHistory: [], telepathLog: [] });
    this.setPhase('lobby', null);
  }

  // ---------- Judge controls ----------
  pause() {
    if (this.paused) return;
    this.remainingMs = this.endsAt ? Math.max(0, this.endsAt - this.now()) : null;
    this.clock.clear(this.timer);
    this.timer = null;
    this.endsAt = null;
    this.paused = true;
    this.sync();
  }

  resume() {
    if (!this.paused || this.judgeVacant) return;
    const ms = this.remainingMs;
    this.paused = false;
    this.remainingMs = null;
    this.endsAt = ms == null ? null : this.now() + Math.max(1, ms);
    this.timer = ms == null ? null : this.later(Math.max(1, ms), () => this.advance());
    this.scheduleBots();
    this.sync();
  }

  extend(sec) {
    if (this.paused) this.remainingMs += sec * 1000;
    else if (this.endsAt) {
      this.clock.clear(this.timer);
      this.endsAt += sec * 1000;
      this.timer = this.later(this.endsAt - this.now(), () => this.advance());
    }
    this.sync();
  }

  // After a Judge kill/revive/kick mid-game, the game may now be decided.
  afterJudgeChange() {
    this.winner = this.checkWinner();
    if (this.winner && !['dawn', 'morning', 'verdict', 'execution', 'gameover', 'lobby'].includes(this.phase)) this.endGame();
  }

  override(msg) {
    const p = this.players.get(msg.id);
    if (!p) return { ok: false, error: 'No such player.' };
    switch (msg.op) {
      case 'kill':
        if (this.phase === 'lobby' || !p.alive) return { ok: false, error: 'They are not alive in a game.' };
        this.kill(p, 'judge');
        this.addLog(`Judge eliminated ${p.name}.`);
        this.narrate('judgeKill', { name: p.name, role: this.roleSuffix(p) });
        this.afterJudgeChange();
        break;
      case 'revive':
        if (this.phase === 'lobby' || p.alive || p.left) return { ok: false, error: 'They are not a ghost.' };
        this.revive(p);
        this.addLog(`Judge revived ${p.name}.`);
        this.narrate('revive', { name: p.name });
        this.afterJudgeChange();
        break;
      case 'setRole': {
        const role = msg.role || null;
        if (role && !ROLES[role]) return { ok: false, error: 'Unknown role.' };
        if (this.phase === 'lobby') {
          if (role) this.settings.forcedRoles[p.id] = role; else delete this.settings.forcedRoles[p.id];
        } else {
          if (!role) return { ok: false, error: 'Pick a role.' };
          this.addLog(`Judge changed ${p.name} from ${this.role(p).name} to ${ROLES[role].name}.`, true);
          this.withdrawChoices(p.id); p.copiedAbility = null;
          p.role = role;
          if ((this.confirmedTown || []).includes(p.id)) { this.confirmedTown = this.confirmedTown.filter((id) => id !== p.id); this.addLog(`Judge role change invalidated the previous blessing for ${p.name}.`); }
          if (role === 'vigilante' && p.shotsLeft <= 0) p.shotsLeft = clamp(int(this.settings.vigilanteShots, 1), 1, 10);
          this.afterJudgeChange();
        }
        break;
      }
      case 'setAction':
        if (!this.nightAction(p, msg.targetId, { force: true })) return { ok: false, error: 'Not a valid night action right now.' };
        break;
      case 'setVote':
        if (!this.vote(p, msg.targetId == null ? null : msg.targetId, { force: true })) return { ok: false, error: 'Not a valid vote right now.' };
        break;
      default:
        return { ok: false, error: 'Unknown override.' };
    }
    this.sync();
    return { ok: true };
  }

  // Judge reveal mode: play one dawn event (or all of them, or the quiet night).
  judgeReveal({ index, which = 'events', all } = {}) {
    if (this.phase !== 'dawn' || !this.reveal) return { ok: false, error: 'Nothing waiting to be revealed.' };
    const R2 = this.reveal;
    if (all) {
      R2.events.forEach((e) => { e.played = true; });
      this.setCinematic({ type: 'night', events: R2.events.map(({ played, ...e }) => e) });
    } else if (which === 'quiet') {
      R2.quietPlayed = true;
      this.setCinematic({ type: 'night', events: [] });
    } else {
      const list = which === 'blocked' ? R2.blocked : R2.events;
      const e = list[int(index, -1)];
      if (!e) return { ok: false, error: 'No such event.' };
      e.played = true;
      if (which === 'blocked') this.setCinematic({ type: 'scene', scene: 'murder', outcome: 'blocked', targetId: e.targetId });
      else this.setCinematic({ type: 'night', events: [{ type: e.type, targetId: e.targetId, ...(e.type === 'guarded' ? { guardDied: e.guardDied } : {}) }] });
    }
    this.addLog(`🎬 Judge revealed ${all ? 'all dawn events' : which === 'quiet' ? 'a quiet night' : `a ${which === 'blocked' ? 'blocked attempt' : 'dawn event'}`}.`, true);
    this.sync();
    return { ok: true };
  }

  updateSettings(s = {}) {
    this.configureRules(s || {});
    const S = this.settings;
    const lobby = this.phase === 'lobby';
    if (s.townName != null) S.townName = String(s.townName).replace(/[<>]/g, '').trim().slice(0, 24) || DEFAULT_SETTINGS.townName;
    if (s.theme != null && THEMES[s.theme] && lobby) { // the theme locks once the game starts
      const oldDefault = THEMES[S.theme] && THEMES[S.theme].townName;
      S.theme = s.theme;
      if (s.townName == null && (S.townName === oldDefault || S.townName === DEFAULT_SETTINGS.townName)) S.townName = THEMES[s.theme].townName;
    }
    if (s.narratorStyle != null && narrator.STYLES.includes(s.narratorStyle)) S.narratorStyle = s.narratorStyle;
    if (s.revealMode != null && ['auto', 'judge'].includes(s.revealMode)) S.revealMode = s.revealMode;
    if (s.narratorMode != null && ['ai', 'human'].includes(s.narratorMode) && s.narratorMode !== S.narratorMode) {
      S.narratorMode = s.narratorMode;
      if (this.narration && !this.narration.custom) this.narration = { ...this.narration, id: ++this.narrationSeq, suggestion: S.narratorMode === 'human' };
      // A human Judge paces the game: manual phases and hand-picked reveals,
      // unless this same update says otherwise.
      if (S.narratorMode === 'human') {
        this.clock.clear(this.timer); this.timer = null; this.endsAt = null;
        if (s.autoAdvance == null) S.autoAdvance = false;
        if (s.revealMode == null) S.revealMode = 'judge';
      }
    }
    if (lobby) {
      for (const k of ['puppetUses', 'glitchUses', 'harmonyGoal', 'paparazziGoal']) if (s[k] != null) S[k] = clamp(int(s[k], DEFAULT_SETTINGS[k]), 1, 10);
      if (s.minPlayers != null) S.minPlayers = clamp(int(s.minPlayers, 4), HARD_MIN_PLAYERS, HARD_MAX_PLAYERS);
      if (s.maxPlayers != null) S.maxPlayers = clamp(int(s.maxPlayers, 40), HARD_MIN_PLAYERS, HARD_MAX_PLAYERS);
      if (S.minPlayers > S.maxPlayers) S.minPlayers = S.maxPlayers;
      if (s.roleCounts && typeof s.roleCounts === 'object') { // full replacement
        S.roleCounts = {};
        for (const [k, v] of Object.entries(s.roleCounts)) if (ROLES[k] && k !== 'villager') S.roleCounts[k] = clamp(int(v, 0), 0, 50);
      }
      // Older single-role switches.
      if (s.mafiaCount != null) { const m = clamp(int(s.mafiaCount, 0), 0, 50); S.autoMafia = m === 0; if (m) S.roleCounts.mafia = m; }
      for (const k of ['detective', 'doctor']) if (s[k] != null) S.roleCounts[k] = s[k] ? Math.max(1, S.roleCounts[k] || 0) : 0;
      if (s.vigilanteShots != null) S.vigilanteShots = clamp(int(s.vigilanteShots, 1), 1, 10);
      if (s.forcedRoles && typeof s.forcedRoles === 'object') {
        S.forcedRoles = {};
        for (const [id, role] of Object.entries(s.forcedRoles)) if (this.players.has(id) && ROLES[role]) S.forcedRoles[id] = role;
      }
    }
    for (const k of ['autoMafia', 'autoAdvance', 'revealRoleOnDeath', 'allowSkip', 'anonymousVotes', 'doctorSelfProtect', 'ghostHaunts', 'botChatter', 'skipCinematics', 'botsAuto']) if (s[k] != null) S[k] = !!s[k];
    if (s.nightSeconds != null) S.nightSeconds = clamp(int(s.nightSeconds, 45), 5, 600);
    if (s.discussionSeconds != null) S.discussionSeconds = clamp(int(s.discussionSeconds, 120), 5, 3600);
    if (s.votingSeconds != null) S.votingSeconds = clamp(int(s.votingSeconds, 45), 5, 600);
    if (s.tieRule != null && ['none', 'random'].includes(s.tieRule)) S.tieRule = s.tieRule;
    if (s.majority != null && ['plurality', 'majority'].includes(s.majority)) S.majority = s.majority;
    if (s.mafiaWinAt != null && ['parity', 'all'].includes(s.mafiaWinAt)) S.mafiaWinAt = s.mafiaWinAt;
    if (s.telepathWhen != null && ['always', 'night', 'day'].includes(s.telepathWhen)) S.telepathWhen = s.telepathWhen;
    if (s.speed != null) S.speed = clamp(Number(s.speed) || 1, 0.25, 50);
    this.sync();
  }

  applyPreset(id) {
    const pr = R.PRESETS[id];
    if (!pr) return { ok: false, error: 'Unknown preset.' };
    if (this.phase !== 'lobby') return { ok: false, error: 'Presets can only be loaded in the lobby.' };
    this.updateSettings({ ...JSON.parse(JSON.stringify(CONFIG.DEFAULTS)), ...pr.settings });
    return { ok: true };
  }

  hostAction(msg = {}) {
    this.touch();
    switch (msg.type) {
      case 'randomJudge': return this.randomJudge();
      case 'disaster': return this.disaster(msg);
      case 'start': return this.phase === 'lobby' ? this.startGame() : { ok: false, error: 'Game already running.' };
      case 'pause': this.pause(); break;
      case 'resume': this.resume(); break;
      case 'skip': if (!['lobby', 'gameover'].includes(this.phase)) this.advance(); break;
      case 'openVoting': if (this.phase !== 'discussion') return { ok: false, error: 'Voting opens after discussion.' }; this.advance(); break;
      case 'closeVoting': if (this.phase !== 'voting') return { ok: false, error: 'Voting is not open.' }; this.advance(); break;
      case 'extend': this.extend(clamp(int(msg.seconds, 30), 5, 600)); break;
      case 'lobby': this.resetToLobby(); break;
      case 'kick': this.kick(msg.id); break;
      case 'settings': this.updateSettings(msg.settings); break;
      case 'preset': return this.applyPreset(msg.id);
      case 'addBots': return this.addBots(clamp(int(msg.count, 1), 1, HARD_MAX_PLAYERS), msg.personality);
      case 'removeBots': return this.removeBots();
      case 'override': return this.override(msg);
      case 'personality': {
        const p = this.players.get(msg.id);
        if (!p || !p.isBot || !PERSONALITIES[msg.personality]) return { ok: false, error: 'Not a bot.' };
        p.personality = msg.personality;
        if (this.brains.has(p.id)) { this.brains.get(p.id).personality = msg.personality; this.brains.get(p.id).p = PERSONALITIES[msg.personality]; }
        this.sync();
        break;
      }
      case 'botsActNow': this.scheduleBots(true); break;
      case 'reveal': return this.judgeReveal(msg);
      case 'say': {
        const text = String(msg.text || '').replace(/[<>]/g, '').trim().slice(0, 240);
        if (!text) return { ok: false, error: 'Nothing to say.' };
        this.narration = { id: ++this.narrationSeq, text, key: 'judge', custom: true };
        this.addLog(`📣 (Judge) ${text}`);
        this.sync();
        break;
      }
      case 'joinBase': this.joinBase = msg.url ? String(msg.url).trim().replace(/\/+$/, '').slice(0, 200) : null; this.sync(); break;
      default: return { ok: false, error: 'Unknown action' };
    }
    return { ok: true };
  }

  // ---------- ghosts ----------
  haunt(p, kind, targetId) {
    if (!this.settings.ghostHaunts || p.alive || p.spectator || this.phase === 'lobby') return;
    if (!HAUNT_KINDS.includes(kind)) return;
    const now = Date.now();
    if (now - p.hauntAt < HAUNT_COOLDOWN_MS) return;
    if (kind === 'boo' && !this.alive().some((x) => x.id === targetId)) return;
    p.hauntAt = now;
    this.io.to(this.hostChannel()).emit('host:haunt', { ghostId: p.id, kind, targetId: kind === 'boo' ? targetId : null });
  }

  // ---------- Telepaths ----------
  telepathPartner(p) {
    if (p.role !== 'telepath') return null;
    return this.inGame().find((x) => x.role === 'telepath' && x.id !== p.id) || null;
  }

  telepathOpen() {
    const w = this.settings.telepathWhen;
    const night = ['night'].includes(this.phase);
    const day = ['morning', 'discussion', 'voting'].includes(this.phase);
    return w === 'always' ? night || day : w === 'night' ? night : day;
  }

  telepathCanSend(p) {
    return !this.paused && !this.judgeVacant && !this.hasStatus(p, 'silenced') && !p.spectator && !p.left && p.role === 'telepath' && p.alive && !!this.telepathPartner(p) && this.telepathPartner(p).alive && this.telepathOpen() && p.telepathSent < TELEPATH_PER_PHASE;
  }

  sendTelepath(p, { msgId, targetId } = {}) {
    if (!this.telepathCanSend(p)) return { ok: false, error: 'Your link is quiet right now.' };
    const def = TELEPATH_MESSAGES.find((m) => m.id === msgId);
    if (!def) return { ok: false, error: 'Unknown message.' };
    const now = this.now();
    if (now - p.telepathAt < TELEPATH_COOLDOWN_MS / this.speed()) return { ok: false, error: 'Slow down.' };
    let target = null;
    if (def.player) {
      target = this.inGame().find((x) => x.id === targetId);
      if (!target) return { ok: false, error: 'Pick a player.' };
    }
    p.telepathAt = now;
    p.telepathSent++;
    const text = def.text.replace('{player}', target ? target.name : '');
    this.telepathLog.push({ fromId: p.id, msgId, targetId: target ? target.id : null, text, day: this.day, phase: this.phase });
    if (this.telepathLog.length > 200) this.telepathLog.shift();
    this.addLog(`🔮 ${p.name}: ${text}`, true);
    this.sync();
    return { ok: true };
  }

  // ---------- bots ----------
  // Bots decide from their own playerView, exactly what a phone would show.
  scheduleBots(now = false) {
    if (!this.settings.botsAuto && !now) return;
    const phaseId = this.phaseId;
    const sp = this.speed();
    const later = (ms, fn) => this.later(now ? 50 : ms / sp, () => { if (this.phaseId === phaseId && !this.paused) fn(); });
    const r = (a, b) => a + this.rng() * (b - a);
    for (const p of this.alive().filter((x) => x.isBot)) {
      const brain = this.brains.get(p.id);
      if (!brain) continue;
      if (this.phase === 'night' && !this.night.actions[p.id]) {
        const delay = r(2000, Math.min(9000, this.settings.nightSeconds * 800));
        later(delay, () => {
          if (this.night.actions[p.id]) return;
          const t = brain.night(this.playerView(p));
          if (t) this.nightAction(p, t);
        });
        if (this.night.actions[p.id] === undefined && (this.nightDef(p) || {}).teamKill) {
          later(delay + r(1500, 3000), () => { // re-sync with the team if they disagree
            const mate = this.teamPicks('mafia').find((m) => m.id !== p.id && (m.leader || this.rng() < 0.7));
            if (mate && this.night.actions[p.id] !== mate.targetId) this.nightAction(p, mate.targetId);
          });
        }
      } else if (this.phase === 'voting' && !this.votes[p.id]) {
        later(r(3000, Math.min(14000, this.settings.votingSeconds * 800)), () => {
          if (this.votes[p.id]) return;
          const t = brain.vote(this.playerView(p));
          if (t) this.vote(p, t);
        });
      } else if (this.phase === 'discussion' && this.settings.botChatter) {
        later(r(1500, Math.min(30000, this.settings.discussionSeconds * 700)), () => {
          const said = brain.chatter(this.playerView(p));
          if (said) this.accuse(p, said);
        });
      }
      if (p.role === 'telepath' && this.telepathOpen()) {
        later(r(2000, 8000), () => {
          const m = brain.telepath(this.playerView(p));
          if (m) this.sendTelepath(p, m);
        });
      }
    }
    this.scheduleRoleBots(now);
  }

  // Public accusations (bots "talking" in discussion; shown on the big screen).
  accuse(p, { targetId, kind, verdict, text }) {
    if (!this.canSpeak(p) || this.phase !== 'discussion' || !this.players.get(targetId)) return;
    this.accusations.push({ id: ++this.accSeq, fromId: p.id, targetId, kind: kind === 'claim' ? 'claim' : 'accuse', verdict: verdict || null, text: String(text).slice(0, 80) });
    if (this.accusations.length > 60) this.accusations.shift();
    this.sync();
  }

  // ---------- views ----------
  hostChannel() { return `host:${this.code}`; }
  judgeChannel() { return `judge:${this.code}:${this.adminEpoch}`; }
  playerChannel(p) { return `pl:${this.code}:${p.id}`; }

  revealedRole(p) {
    if (this.phase === 'gameover') return p.role;
    if (!p.alive && this.settings.revealRoleOnDeath) return p.role;
    return null;
  }

  common() {
    return {
      code: this.code,
      phase: this.phase,
      votingMode: this.settings.votingMode,
      nomination: this.nomination ? { accuserId: this.nomination.accuserId, targetId: this.nomination.targetId, state: this.nomination.state, seconds: this.nomination.seconds.length, required: this.settings.nominationSecondsRequired } : null,
      emergency: !!this.emergency,
      shortenedDiscussion: this.shortenedDiscussion,
      day: this.day,
      endsAt: this.endsAt,
      paused: this.paused,
      remainingMs: this.remainingMs,
      serverNow: this.now(),
      townName: this.settings.townName,
      governance: this.governanceView(),
      presentation: { glitchUntil: this.glitchUntil || 0, harmony: this.harmonyTotal || 0, harmonyGoal: this.settings.harmonyGoal, confirmedTown: this.confirmedTown || [], stories: this.publicStories || [] },
      theme: this.settings.theme,
      narration: this.narration && (this.narration.suggestion || (this.settings.narratorMode === 'human' && !this.narration.custom)) ? null : this.narration,
      narratorMode: this.settings.narratorMode,
      winner: this.phase === 'gameover' ? this.winner : null,
      composition: this.composition,
      accusations: this.accusations.slice(-30),
      votingOpen: this.phase === 'voting',
      manualVoting: !this.settings.autoAdvance,
      allowSkip: this.settings.allowSkip,
    };
  }

  hostView() {
    return {
      ...this.common(),
      settings: { ...this.settings, forcedRoles: {}, roleConfig: {} },
      narratorStyles: narrator.STYLES,
      joinBase: this.joinBase,
      minPlayers: this.settings.minPlayers,
      maxPlayers: this.settings.maxPlayers,
      setupError: this.phase === 'lobby' ? (this.setupFor(Math.max(this.inGame().length, 1)).errors[0] || null) : null,
      cinematic: this.cinematic,
      players: this.list().map((p) => ({
        id: p.id,
        name: p.name,
        avatar: p.avatar,
        house: p.house,
        home: this.homeSlot(p),
        livesWith: this.ownerOfHome(p) ? p.livesWith : null,
        homeLook: p.homeLook,
        houseState: p.houseState,
        statuses: this.visibleStatuses(p),
        alive: p.alive,
        left: p.left,
        connected: p.isBot || p.sockets > 0,
        isBot: p.isBot,
        spectator: p.spectator,
        deathOrder: p.deathOrder,
        role: this.revealedRole(p),
        won: this.phase === 'gameover' ? p.won : null,
        hasVoted: this.phase === 'voting' ? !!(this.votes && this.votes[p.id]) : false,
      })),
    };
  }

  // Everything, for the Judge console. Never sent to the big screen or phones.
  judgeView() {
    const n = this.inGame().length;
    const setup = this.setupFor(Math.max(n, 1));
    const acts = (this.night && this.night.actions) || {};
    const actors = this.phase === 'night' ? this.nightActors() : [];
    return {
      ...this.hostView(),
      settings: this.settings,
      narration: this.narration,
      eventLog: this.eventLog.slice(-600),
      scheduledEvents: this.scheduledEvents,
      nightResolution: this.night && this.night.resolution,
      mafiaCoordination: { picks: this.night ? this.teamPicks('mafia') : [], messages: this.mafiaChat || [], bluffs: this.mafiaBluffs || [] },
      reveal: this.phase === 'dawn' ? this.reveal : null,
      judge: true,
      hostKeyHint: true,
      setup: { roles: setup.roles, errors: setup.errors, warnings: setup.warnings, count: n },
      presets: Object.fromEntries(Object.entries(R.PRESETS).map(([k, v]) => [k, { label: v.label, desc: v.desc }])),
      personalities: Object.fromEntries(Object.entries(PERSONALITIES).map(([k, v]) => [k, v.label])),
      progress: this.phase === 'night'
        ? { kind: 'night', done: actors.filter((p) => acts[p.id]).length, total: actors.length }
        : this.phase === 'voting' ? { kind: 'voting', done: Object.keys(this.votes || {}).length, total: this.alive().length } : null,
      tally: this.phase === 'voting' ? this.tally() : null,
      pending: this.pending,
      telepathLog: this.telepathLog,
      voteHistory: this.voteHistory,
      log: this.log.slice(-150),
      stats: this.stats,
      allPlayers: this.list().map((p) => ({
        id: p.id,
        name: p.name,
        role: p.role,
        originalRole: p.originalRole,
        forcedRole: this.settings.forcedRoles[p.id] || null,
        team: p.role ? this.team(p) : null,
        alive: p.alive,
        isBot: p.isBot,
        personality: p.personality,
        shotsLeft: p.shotsLeft,
        action: acts[p.id] || null,
        actsAtNight: this.phase === 'night' ? !!this.nightDef(p) && p.alive : false,
        vote: this.votes ? this.votes[p.id] || null : null,
        investigations: p.investigations,
        notes: p.notes,
        ability: this.abilityView(p),
        statuses: this.statuses(p),
        actionUses: p.actionUses,
        stolenAbilities: p.stolenAbilities,
        copiedAbility: p.copiedAbility,
        ghostVoteUsed: p.ghostVoteUsed,
        whispersUsed: p.whispersUsed,
        privateScene: p.privateScene,
        isJudge: !!p.isJudge,
        spectator: p.spectator,
        diedDay: p.diedDay,
        deathCause: p.deathCause,
      })),
    };
  }

  tally() {
    const t = {};
    for (const [voterId, targetId] of Object.entries(this.votes || {})) {
      const v = this.players.get(voterId);
      t[targetId] = (t[targetId] || 0) + ((v && v.alive && this.role(v).voteWeight) || 1);
    }
    return t;
  }

  playerView(p) {
    const r = p.spectator ? null : ROLES[p.role];
    const v = {
      ...this.common(),
      you: { id: p.id, name: p.name, avatar: p.avatar, alive: p.alive, spectator: p.spectator, left: p.left, house: p.house, home: this.homeSlot(p), livesWith: this.ownerOfHome(p) ? p.livesWith : null, homeLook: p.homeLook },
      freePlots: this.phase === 'lobby' ? this.freePlots() : [],
      governance: this.governanceView(p),
      isJudge: !!p.isJudge,
      privateScene: p.spectator ? null : p.privateScene,
      ability: p.spectator ? null : this.abilityView(p),
      role: p.spectator ? null : p.role,
      mafia: this.mafiaView(p),
      statuses: this.visibleStatuses(p, true),
      team: r ? r.team : null,
      won: this.phase === 'gameover' ? p.won : null,
      players: this.list().filter((x) => !x.spectator).map((x) => ({
        id: x.id, name: x.name, house: x.house, home: this.homeSlot(x), livesWith: this.ownerOfHome(x) ? x.livesWith : null, homeLook: x.homeLook, avatar: x.avatar, alive: x.alive, role: this.revealedRole(x), won: this.phase === 'gameover' ? x.won : null,
      })),
      lobbyCount: this.inGame().length,
      minPlayers: this.settings.minPlayers,
      notes: p.spectator ? [] : p.notes.filter((n) => n.day >= this.day - 1),
    };
    // Bots reason over the public vote record (players saw it on the big screen).
    if (p.isBot && !this.settings.anonymousVotes) v.voteHistory = this.voteHistory;
    if (r && r.knowsTeam && p.alive) v.teammates = this.inGame().filter((x) => x.id !== p.id && this.team(x) === r.team && this.role(x).knowsTeam).map((x) => ({ id: x.id, name: x.name, alive: x.alive, role: x.role }));
    if (!p.spectator && p.investigations.length) v.investigations = p.investigations;
    if (!p.spectator && p.role === 'vigilante') v.shotsLeft = p.shotsLeft;
    if (!p.spectator && p.role === 'telepath') {
      const partner = this.telepathPartner(p);
      v.telepath = {
        partner: partner ? { id: partner.id, name: partner.name, alive: partner.alive } : null,
        canSend: this.telepathCanSend(p),
        log: this.telepathLog,
      };
    }
    if (this.phase === 'night' && p.alive && !p.spectator && this.night) {
      const def = this.nightDef(p);
      v.action = { kind: def ? def.kind : null, reveal:def && def.reveal, dummy: !def, optional: !!(def && def.optional), targets: this.nightTargets(p), choice: this.night.actions[p.id] || null };
      if (def && def.teamKill) v.action.teamPicks = this.teamPicks(this.team(p)).filter((m) => m.id !== p.id);
      if (def && def.noRepeat) v.action.blocked = this.lastTarget[p.id] || null;
    }
    if (this.phase === 'voting' && this.canCast(p) && this.votes) {
      v.voting = {
        targets: this.voteTargets(p),
        choice: this.votes[p.id] || null,
        canSkip: this.settings.allowSkip,
        voted: Object.keys(this.votes).length,
        total: this.gameVoters().length,
      };
    }
    if (!p.alive && !p.spectator) v.hauntReadyAt = this.settings.ghostHaunts ? p.hauntAt + HAUNT_COOLDOWN_MS : null;
    return v;
  }

  // For analytics (see sim.js).
  report() {
    const players = this.inGame();
    return {
      n: players.length,
      winner: this.winner,
      days: this.day,
      durationMs: this.now() - this.startedAt,
      composition: this.composition,
      players: players.map((p) => ({ role: p.originalRole, finalRole: p.role, team: ROLES[p.originalRole].team, alive: p.alive, diedDay: p.diedDay, cause: p.deathCause, won: !!p.won, personality: p.personality })),
      stats: this.stats,
    };
  }

  // Coalesces state pushes; big rooms batch them a little more.
  sync() {
    if (this.headless || this.syncQueued) return;
    this.syncQueued = true;
    const flush = () => {
      this.syncQueued = false;
      this.io.to(this.hostChannel()).emit('host:state', this.hostView());
      this.io.to(this.judgeChannel()).emit('judge:state', this.judgeView());
      for (const p of this.list()) if (!p.isBot) this.io.to(this.playerChannel(p)).emit('player:state', this.playerView(p));
    };
    if (this.players.size > 30) setTimeout(flush, 120); else queueMicrotask(flush);
  }

  destroy() { this.clock.clear(this.timer); this.phaseId++; }
}

require('./governance')(Room);
require('./rules/foundation')(Room);
require('./rules/coordination')(Room);
require('./role-expansion')(Room);
require('./rules/special-roles')(Room);
require('./rules/storyteller')(Room);
require('./rules/social')(Room);
require('./rules/progression')(Room);
require('./rules/story-bots')(Room);
module.exports = { Room, DEFAULT_SETTINGS, HARD_MAX_PLAYERS };
