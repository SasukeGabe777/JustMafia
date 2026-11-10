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
          for (let i = 0; i < 20 * 30 && t.cinema.active; i++) { t.update(1 / 30); if (i % 3 === 0) t.draw(); }
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
