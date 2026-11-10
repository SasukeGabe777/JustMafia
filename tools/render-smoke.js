'use strict';
// Headless smoke test for the big-screen renderer: runs town.js against a
// stub canvas and feeds it real host states from a live game, stepping the
// animation each time. Catches runtime errors without needing a browser.
const path = require('path');
const fs = require('fs');
const vm = require('vm');
const { spawn } = require('child_process');
const { io } = require('socket.io-client');

const anyFn = new Proxy(function () {}, {
  get: (t, k) => (k === Symbol.toPrimitive ? () => 0 : anyFn),
  apply: () => anyFn,
});
const ctxStub = new Proxy({}, {
  get: (t, k) => (k in t ? t[k] : k === 'measureText' ? () => ({ width: 50 }) : k === 'getImageData' ? () => ({ data: new Uint8ClampedArray(64) }) : typeof k === 'string' && k.startsWith('create') ? () => ({ addColorStop() {} }) : () => {}),
  set: (t, k, v) => { t[k] = v; return true; },
});
const makeCanvas = () => ({ getContext: () => ctxStub, style: {}, width: 0, height: 0 });

const rafQueue = [];
const sandbox = {
  window: { innerWidth: 1920, innerHeight: 1080, devicePixelRatio: 1, addEventListener() {} },
  location: { search: '' },
  URLSearchParams,
  document: { createElement: makeCanvas },
  performance: { now: () => Date.now() },
  requestAnimationFrame: (fn) => rafQueue.push(fn),
  SFX: { play() {}, music() {} },
  console,
  Math, Date, JSON,
};
sandbox.window.SFX = sandbox.SFX;
vm.createContext(sandbox);
for (const f of ['shared/options.js', 'shared/roles.js', 'shared/themes.js', 'shared/layout.js', 'avatar.js', 'character-art.js', 'world-art.js', 'pixel.js', 'cinema.js', 'scenes.js', 'town.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'public', f), 'utf8').replace('typeof window !== \'undefined\' ? window : globalThis', 'window'), sandbox, { filename: f });
}
// options.js assigns to window.MT_OPTIONS; town.js reads window.*
const town = new sandbox.window.Town(makeCanvas());
let frames = 0;
let t = 0;
function pump(n) {
  for (let i = 0; i < n; i++) {
    const fns = rafQueue.splice(0);
    t += 16;
    fns.forEach((fn) => fn(t));
    frames++;
  }
}

// Every scene x outcome x theme, played to the end, with nothing else going on.
function sceneSweep() {
  const W = sandbox.window;
  let n = 0, errs = 0;
  for (const population of [4, 10, 25, 50]) {
  const players = Array.from({ length: population }, (_, i) => ({ id: 'p' + i, name: 'P' + i, house: i, alive: true, connected: true, avatar: { color: '#e74c3c', skin: '#f3c9a0', hat: 'none', hair: 'curly', hairColor: '#ba593c', facialHair: 'beard', eyes: '#416f91', face: 'square', outfit: 'overalls', pants: '#355879', shoes: '#f3eee0', accessory: 'glasses' },
    // Every home option appears; every 5th player (not the cinematic victim p2) lives with the previous player.
    homeLook: Object.fromEntries(Object.entries(W.MT_OPTIONS.HOME_FIELDS).map(([k, list], j) => [k, W.MT_OPTIONS[list][(i + j) % W.MT_OPTIONS[list].length]])),
    livesWith: i % 5 === 4 ? 'p' + (i - 1) : null, home: i % 5 === 4 ? i - 1 : i }));
  for (const theme of W.MT_THEMES.THEME_ORDER) {
    const t = new W.Town(makeCanvas());
    t.applyState({ phase: 'night', theme, players, accusations: [] });
    for (const [id, sc] of Object.entries(W.MT_SCENES)) {
      for (const outcome of sc.outcomes ? Object.keys(sc.outcomes) : [undefined]) {
        try {
          for (const step of [...sc.steps,...(sc.outcomes && sc.outcomes[outcome] ? sc.outcomes[outcome].steps : [])]) if (typeof t.cinema['a_' + step[1]] !== 'function') throw new Error('Unknown timeline action: ' + step[1]);
          if (id === 'execution') t.chars.get('p2').deathPending = true;
          if (!t.cinema.play(id, { victimId: 'p2', outcome, title: 'T', sub: 'S', mood: 'triumph' })) throw new Error(`scene ${id} did not start`);
          if (id === 'murder') {
            for (let i = 0; i < 140; i++) t.update(1 / 30);
            const resident = t.cinema.actors.get('victim');
            if (outcome !== 'blocked' && (!resident || resident.avatar.hair !== 'curly' || resident.avatar.outfit !== 'overalls')) throw new Error('cinematic lost the player customization');
            if (t.cinema.actors.get('assassin').avatar) throw new Error('attacker exposed a player avatar');
          }
          for (let i = 0; i < 30 * 30 && t.cinema.active; i++) { t.update(1 / 30); if (i % 3 === 0) t.draw(); } // scenes run up to ~21s
          if (t.cinema.active) throw new Error(`scene ${id}/${outcome} never ended`);
          if (t.cineDark != null || t.held.size || t.cinema.environment || t.cinema.snapshot) throw new Error(`scene ${id}/${outcome} left the town in a cinematic state`);
          n++;
        } catch (e) { errs++; console.error(theme, id, outcome, e); }
      }
    }
  }
  }
  const queued = new W.Town(makeCanvas());
  queued.applyState({ phase: 'discussion', theme: 'space', players: Array.from({ length: 100 }, (_, i) => ({ id: 'p' + i, name: 'P' + i, house: i, alive: true, avatar: { color: '#e74c3c', skin: '#f3c9a0' } })), accusations: [] });
  queued.playCinematic({ type: 'stories', stories: [{ scene: 'photograph', targetId: 'p2', title: 'Snapshot' }, { scene: 'beyond', sub: 'WATCH' }, { scene: 'blessing', targetId: 'p4', title: 'Blessing' }] });
  for (let i = 0; i < 21 * 30; i++) { queued.update(1 / 30); if (i % 3 === 0) queued.draw(); }
  if (queued.cinema.active || queued.cinema.queue.length || queued.held.size) { errs++; console.error('Role cinematic sequence did not finish cleanly'); }
  const disaster = { id: 90, type: 'disaster', scene: 'meteor', targetId: 'p2' };
  queued.applyState({ ...queued.state, cinematic: disaster, players: queued.state.players.map((p) => p.id === 'p2' ? { ...p, alive: false } : p) });
  if (!queued.chars.get('p2').deathPending) { errs++; console.error('Disaster revealed the death before its climax'); }
  queued.playCinematic(disaster); queued.update(5);
  if (!queued.chars.get('p2').alive) { errs++; console.error('Disaster victim collapsed too soon'); }
  queued.update(2);
  if (queued.chars.get('p2').alive || queued.chars.get('p2').deathPending) { errs++; console.error('Disaster climax did not release the visual death'); }
  queued.update(5);
  queued.applyState({ ...queued.state, presentation: { glitchUntil: 31000 }, serverNow: 1000 });
  if (!queued.isCorrupted()) { errs++; console.error('Glitch did not start'); }
  const avatars = JSON.stringify([...queued.chars.values()].map((c) => c.avatar)); queued.draw(); queued.update(31); queued.draw();
  if (queued.isCorrupted() || JSON.stringify([...queued.chars.values()].map((c) => c.avatar)) !== avatars) { errs++; console.error('Glitch changed avatars permanently'); }
  // Execution secrecy in the renderer: with anonymous votes no figure wears a player's
  // look; with public votes the mob is exactly the voters; the interrupter is always masked.
  {
    const mk = () => { const g = new W.Town(makeCanvas()); g.applyState({ phase: 'execution', theme: 'medieval', players: Array.from({ length: 8 }, (_, i) => ({ id: 'p' + i, name: 'P' + i, house: i, alive: true, avatar: { color: W.MT_OPTIONS.colors[i], skin: W.MT_OPTIONS.skins[i % 6], hair: W.MT_OPTIONS.hair[i], hat: 'none' } })), accusations: [] }); return g; };
    const looks = (g) => [...g.cinema.actors.values()].filter((a) => a.kind === 'resident' && a.id !== 'victim' && a.id !== 'guard' && !a.id.startsWith('def')).map((a) => a.avatar);
    const playerColors = new Set(Array.from({ length: 8 }, (_, i) => W.MT_OPTIONS.colors[i]));
    const run = (bind, check) => { try { const g = mk(); g.cinema.play('execution', { victimId: 'p2', ...bind }); for (let i = 0; i < 6.5 * 30; i++) g.update(1 / 30); check(g); for (let i = 0; i < 30 * 30 && g.cinema.active; i++) g.update(1 / 30); if (g.held.size) throw new Error('held after scene'); n++; } catch (e) { errs++; console.error('execution secrecy', bind.outcome, e); } };
    run({ outcome: 'executed', mob: null, mobCount: 5 }, (g) => { const l = looks(g); if (l.length < 3 || l.some((a) => playerColors.has(a.color) || a.skin !== '#2b2a30')) throw new Error('anonymous mob shows a player look'); });
    run({ outcome: 'executed', mob: ['p1', 'p4', 'p5'], defenders: ['p6'] }, (g) => { const l = looks(g).map((a) => a.color).sort(); const want = ['p1', 'p4', 'p5'].map((id) => W.MT_OPTIONS.colors[+id.slice(1)]).sort(); if (JSON.stringify(l) !== JSON.stringify(want)) throw new Error('public mob is not exactly the voters: ' + l); if (!g.cinema.actors.get('def0')) throw new Error('defender missing'); });
    run({ outcome: 'interrupted', mob: null, mobCount: 4 }, (g) => { const m = g.cinema.actors.get('masked'); if (!m || playerColors.has(m.avatar.color) || m.avatar.skin !== '#2b2a30') throw new Error('interrupter is not anonymous'); });
    run({ outcome: 'swapped', mob: null, mobCount: 4, guardId: 'p7', guardName: 'P7' }, (g) => { const gd = g.cinema.actors.get('guard'); if (!gd || gd.avatar.color !== W.MT_OPTIONS.colors[7]) throw new Error('bodyguard who dies should be shown'); });
    // A TV joining or reconnecting mid-execution doesn't replay it from the start.
    try {
      const fresh = mk(); fresh.state.serverNow = 1000; fresh.playCinematic({ id: 50, type: 'execution', outcome: 'executed', targetId: 'p2', condemnedId: 'p2', at: 0, mob: null, mobCount: 4 });
      if (!fresh.cinema.active) throw new Error('on-time execution should play');
      const late = mk(); late.chars.get('p2').deathPending = true; late.state.serverNow = 12000; late.playCinematic({ id: 51, type: 'execution', outcome: 'executed', targetId: 'p2', condemnedId: 'p2', at: 0, mob: null, mobCount: 4 });
      if (late.cinema.active || late.chars.get('p2').deathPending) throw new Error('late join replayed the execution');
      n++;
    } catch (e) { errs++; console.error('execution reconnect', e); }
  }
  // Every theme's game-over path for each winner (themed team names, e.g. RSP Supply).
  for (const theme of W.MT_THEMES.THEME_ORDER) for (const winner of ['mafia', 'town', 'jester', 'draw']) {
    try {
      const g = new W.Town(makeCanvas());
      g.applyState({ phase: 'gameover', theme, winner, players: Array.from({ length: 6 }, (_, i) => ({ id: 'p' + i, name: 'P' + i, house: i, alive: i > 1, avatar: { color: '#e74c3c', skin: '#f3c9a0' } })), accusations: [] });
      g.playCinematic({ id: 7, type: 'gameover', winner });
      for (let i = 0; i < 12 * 30 && g.cinema.active; i++) { g.update(1 / 30); if (i % 3 === 0) g.draw(); }
      n++;
    } catch (e) { errs++; console.error('gameover', theme, winner, e); }
  }
  console.log(`scene sweep: ${n} scene runs, errors: ${errs}`);
  return errs;
}
const sweepErrors = process.env.MT_RENDER_LIVE_ONLY === '1' ? 0 : sceneSweep();
// Sweep instances are advanced explicitly. Only the live town participates in
// the requestAnimationFrame loop; retain its first scheduled callback.
rafQueue.splice(1);

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const emit = (s, ev, d) => new Promise((r) => s.emit(ev, d, r));

(async () => {
  const PORT = 3998;
  const server = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], { env: { ...process.env, PORT: String(PORT), MT_SPEED: '25' }, stdio: 'ignore' });
  await wait(800);
  const host = io(`http://localhost:${PORT}`, { transports: ['websocket'] });
  let state = null, lastCine = 0, errors = 0, phases = new Set();
  host.on('host:state', (st) => {
    state = st;
    phases.add(st.phase);
    try {
      town.applyState(st);
      if (st.cinematic && st.cinematic.id !== lastCine) { lastCine = st.cinematic.id; town.playCinematic(st.cinematic); }
      // Network frequency must not multiply the render frame rate. The frame
      // loop below supplies animation independently, as requestAnimationFrame does.
      pump(1);
    } catch (e) { errors++; console.error(e); }
  });
  await emit(host, 'host:create', {});
  await emit(host, 'host:action', { type: 'settings', settings: { maxPlayers: 100, theme: process.env.THEME || 'smalltown' } });
  await emit(host, 'host:action', { type: 'preset', id: 'chaos' });
  await emit(host, 'host:action', { type: 'addBots', count: Number(process.env.BOTS) || 14 });
  await emit(host, 'host:action', { type: 'start' });
  const t0 = Date.now();
  while ((!state || state.phase !== 'gameover') && Date.now() - t0 < 90000) {
    await wait(50);
    try {
      pump(3);
      const ghost = state && state.players.find((p) => !p.alive);
      const alive = state && state.players.find((p) => p.alive);
      if (ghost && alive) for (const kind of ['boo', 'spin', 'wail']) town.haunt({ ghostId: ghost.id, kind, targetId: alive.id });
    } catch (e) { errors++; console.error(e); break; }
  }
  pump(300);
  await emit(host, 'host:action', { type: 'lobby' });
  const resetDeadline = Date.now()+5000;
  while (state.phase !== 'lobby' && Date.now()<resetDeadline) await wait(25);
  pump(60);
  host.close();
  server.kill();
  console.log(`frames: ${frames}, phases seen: ${[...phases].join(', ')}, errors: ${errors}`);
  process.exit(errors || sweepErrors || state.phase !== 'lobby' ? 1 : 0);
})();
