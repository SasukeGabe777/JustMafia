'use strict';
// JustRaiseDucks screens. TV: Duck Valley (every player's farm, live, with the season road,
// standings and a race-day hype moment), the themed side-scrolling race (zooming camera,
// commentary, live standings, slow motion for photo finishes), the results with highlights,
// and the season finale. Phone: hatch an egg, then your farm up top (tap to pet), one coach
// card with the obvious next step, and four tabs: Train, Shop, Race, My duck.
(function () {
  const { esc, timer } = BOX;
  const A = () => window.DUCK_ART;
  // A quiet recorded sound effect on the TV (public/audio/sfx/ducks/, credits.json there). Phones have no BOX.audio.
  const clip = (p, o) => { try { return !!(BOX.audio && BOX.audio.clip && BOX.audio.clip('ducks/' + p + '.ogg', o)); } catch { return false; } };
  const SK = { run: ['🏃', 'Run', 'Hurdle Dash', '#ff8c42'], swim: ['🌊', 'Swim', 'Paddle Power', '#3ec1ff'], fly: ['🪽', 'Fly', 'Sky Rings', '#b388ff'], climb: ['🧗', 'Climb', 'Cliff Climb', '#c49a6c'], stamina: ['💪', 'Stamina', 'Bug Snack', '#2ee6a6'], smarts: ['🧠', 'Smarts', 'Lily Path', '#b48ee0'] };
  const GAME = { run: 'hurdles', swim: 'paddle', fly: 'rings', climb: 'climb', stamina: 'bugs', smarts: 'maze' };
  const SEC = { track: ['🏃', 'Track', 'run'], pond: ['🌊', 'Pond', 'swim'], cliff: ['🧗', 'Cliff', 'climb'], gap: ['🪽', 'Ravine', 'fly'], maze: ['🧠', 'Maze', 'smarts'] };
  const SEC_LEN = { track: 48, pond: 36, cliff: 26, gap: 32, maze: 34 }; // fallback; the server sends its own (secLen / sections)
  const VAR_ICON = { hurdles: '🚧', logs: '🪵', mud: '🟤', sand: '🏖️', ice: '🧊', calm: '💧', lily: '🪷', waves: '🌊', rapids: '💨', icy: '🧊', rock: '🪨', clouds: '☁️', canyon: '🏜️',
    lava: '🌋', ash: '🌫️', roots: '🌿', roof: '🏠', puddles: '💦', cactus: '🌵', dunes: '🏜️', cloudpath: '☁️', gumdrops: '🍬', taffy: '🍭', hay: '🌾',
    hotspring: '♨️', murky: '🪵', fountain: '⛲', oasis: '🌴', skylake: '💎', choco: '🍫', foggy: '🌫️',
    basalt: '🌋', mudbank: '🟤', wall: '🧱', waterfall: '💦', sandstone: '🪨', floating: '🪨', candycane: '🍬', barn: '🏚️',
    lavapit: '🔥', bog: '🐸', street: '🏙️', gorge: '🌿', sky: '🕊️', cotton: '🍥', fogpit: '🌫️',
    bridge: '🌉', river: '🏞️', vines: '🌿', haystack: '🌾', hedge: '🌳', sandcastle: '🏰', icecave: '🧊', slot: '🏜️', lavatubes: '🌋', reeds: '🌾', alley: '🧱', temple: '🛕', cloudmaze: '☁️', licorice: '🍬', corn: '🌽' };
  const HAT_NAME = { none: 'No hat', cap: 'Cap', tophat: 'Top hat', crown: 'Crown', flower: 'Flower', shades: 'Shades', bow: 'Bow', viking: 'Viking', pirate: 'Pirate', party: 'Party', chef: 'Chef', headband: 'Headband' };
  const typeOf = (s) => s.type || s;
  const PERK_ICON = { burst: '🚀', webbed: '🦶', feather: '🪶', grip: '🧲', lungs: '🫁', lucky: '🍀', nimble: '🦘', closer: '🏁' };
  const MEDAL = ['🥇', '🥈', '🥉'];
  const ord = (n) => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th');
  const course = (c) => (c ? `<div class="dk-legs">${c.sections.map((s) => `<span class="leg ${typeOf(s)}">${SEC[typeOf(s)][0]} ${SEC[typeOf(s)][1]}${s.v ? ' ' + (VAR_ICON[s.v] || '') : ''}</span>`).join('<span class="arrow">→</span>')}</div>` : '');
  // The next race's featured skills (every race features two; the final, all of them).
  const focus = (c) => (c && c.featured && c.featured.length ? `<span class="dk-focus">${c.featured.length > 2 ? '<span class="f">⭐ Every skill</span>' : c.featured.map((k) => `<span class="f">${SK[k][0]} ${SK[k][1]}</span>`).join('')}</span>` : '');
  const focusText = (c) => (c && c.featured && c.featured.length ? (c.featured.length > 2 ? 'every skill' : c.featured.map((k) => SK[k][0] + ' ' + SK[k][1]).join(' · ')) : '');
  const weatherChip = (c, W) => (c && W ? `<span class="dk-weather">${W[c.weather].icon} ${W[c.weather].label}${c.wind ? (c.wind > 0 ? ' (tailwind)' : ' (headwind)') : ''}</span>` : '');
  const bar = (v, cls = '') => `<div class="bar ${cls}"><i style="width:${Math.max(0, Math.min(100, v))}%"></i></div>`;
  // The farmer: the player's own character (BOX.face / BOX.body, cached face images on the
  // canvases), or their emoji when they have none. Wild ducks have no farmer.
  const hasChar = (x) => !!(x && x.id && !x.wild && BOX.hasLook && BOX.hasLook(x));
  const who = (x, n = 28) => (hasChar(x) && BOX.face ? BOX.face(x, n) + ' ' : `${x.avatar ? esc(x.avatar) + ' ' : ''}`);
  const farmerOf = (id, d) => ({ id, name: (d && d.owner) || undefined, avatar: d && d.avatar, wild: d && d.wild });
  const FACES = new Map();
  function faceImg(x, px) {
    if (!hasChar(x) || !BOX.faceUrl) return null;
    const k = x.id + '|' + px; let e = FACES.get(k);
    if (!e) { const u = BOX.faceUrl(x, px); if (!u) return null; if (FACES.size > 200) FACES.clear(); e = Object.assign(new Image(), { src: u }); FACES.set(k, e); }
    return e.complete && e.naturalWidth ? e : null;
  }
  const road = (ladder, race) => (ladder ? `<div class="dk-road">${ladder.map((l) => `<span class="${l.done ? 'done' : ''} ${l.n === race + 1 ? 'cur' : ''} ${l.final ? 'fin' : ''}" title="${esc(l.label)}">${l.done ? '✓' : l.icon}</span>`).join('<i></i>')}</div>` : '');

  // ---------- TV state kept between updates (canvases keep animating) ----------
  const tvw = { mode: null, farms: [], fxBy: {}, born: {}, raf: 0, spot: 0, spotAt: 0, raceN: 0 };
  function loop(canvas, draw, key = 'raf') {
    cancelAnimationFrame(tvw[key]);
    const step = () => { if (!document.body.contains(canvas)) return; const W = canvas.clientWidth, H = canvas.clientHeight; if (canvas.width !== W) canvas.width = W; if (canvas.height !== H) canvas.height = H; draw(canvas.getContext('2d'), W, H, performance.now() / 1000); tvw[key] = requestAnimationFrame(step); };
    step();
  }

  // ---------- the race on the TV ----------
  // The server simulates the race (box/games/ducks.js simulate): each duck's position every 0.5 s,
  // its moments (hurdle crashes and clipped bars, cliff slips, ice skids, boosts, running out of
  // steam) and its levels. The TV plays it back at about real speed (R.pace) and animates the body
  // from that: a waddle whose feet stay planted (the gait moves with the distance covered, so
  // nothing slides), a jump over the hurdle in the duck's own lane (or a crash into it), steps up
  // the cliff ledges, a dive or a belly flop into the pond and paddling feet under the water, and
  // wingbeats across the ravine at a height set by the duck's Fly level. Training shows: a better
  // runner takes longer strides and jumps higher, a swimmer dives clean, a flyer glides high.
  const race = { R: null };
  const SK_I = { run: 0, swim: 1, fly: 2, climb: 3, stamina: 4, smarts: 5 };
  const TAU = Math.PI * 2;
  const sm = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));
  // Particles (dust, mud, sand, snow, splashes, pebbles, sweat): one fixed pool, reused.
  const PN = 420, PRT = { x: new Float32Array(PN), y: new Float32Array(PN), vx: new Float32Array(PN), vy: new Float32Array(PN), life: new Float32Array(PN), max: new Float32Array(PN), r: new Float32Array(PN), c: new Uint8Array(PN), grav: new Float32Array(PN), i: 0 };
  const PCOL = ['rgba(214,190,150,', 'rgba(110,74,40,', 'rgba(238,214,160,', 'rgba(255,255,255,', 'rgba(190,230,255,', 'rgba(120,110,100,', 'rgba(150,210,255,', 'rgba(95,88,88,', 'rgba(255,160,205,', 'rgba(255,215,64,'];
  const DUST = 0, MUD = 1, SAND = 2, SNOW = 3, SPLASH = 4, PEBBLE = 5, SWEAT = 6, GOLD = 9;
  function puff(x, y, vx, vy, life, r, c, grav) { const i = (PRT.i = (PRT.i + 1) % PN); PRT.x[i] = x; PRT.y[i] = y; PRT.vx[i] = vx; PRT.vy[i] = vy; PRT.life[i] = life; PRT.max[i] = life; PRT.r[i] = r; PRT.c[i] = c; PRT.grav[i] = grav; }
  function burst(x, y, n, c, spread, up, r, grav, life = 0.6) { for (let k = 0; k < n; k++) puff(x + (Math.random() - 0.5) * 0.4, y, (Math.random() - 0.5) * spread, -up * (0.4 + Math.random() * 0.8), life * (0.6 + Math.random() * 0.6), r * (0.6 + Math.random() * 0.8), c, grav); }
  function drawParticles(g, dt, cam, PX) {
    for (let i = 0; i < PN; i++) {
      if (PRT.life[i] <= 0) continue;
      PRT.life[i] -= dt; PRT.vy[i] += PRT.grav[i] * dt; PRT.x[i] += PRT.vx[i] * dt; PRT.y[i] += PRT.vy[i] * dt;
      const a = Math.max(0, PRT.life[i] / PRT.max[i]), c = PRT.c[i];
      g.fillStyle = PCOL[c] + (c === SPLASH || c === SWEAT || c === GOLD ? 0.85 * a : 0.55 * a).toFixed(2) + ')';
      const r = c === DUST || c === SAND || c === SNOW ? PRT.r[i] * (1.6 - a * 0.6) : PRT.r[i];
      g.beginPath(); g.arc((PRT.x[i] - cam) * PX, PRT.y[i], r, 0, TAU); g.fill();
    }
  }
  function setupRace(s, canvas) {
    const R = s.lastRace, art = A();
    race.R = R; race.G = art.raceGeometry(R);
    race.start = Date.now() + s.endsIn - (R.intro + R.run + 6000);
    race.pace = R.pace || { k: 1, tw: 1e9, k2: 1, tail: 0 };
    race.stop = R.tripStop || 1.2;
    race.simT = wallSim(Math.max(0, (Date.now() - race.start - R.intro) / 1000)); race.last = performance.now(); race.slowUsed = 0; race.rate = 1;
    race.photo = R.margin != null && R.margin < 0.6 && R.results.length > 1;
    race.cam = -6; race.span = 60; race.leader = null; race.msgs = []; race.cheers = []; race.cheerSaid = 0; race.finished = new Set(); race.beep = 0; race.go = false;
    race.flags = {}; race.leaderSec = -1; race.leadAt = 0; race.neckAt = 0; race.rank = {}; race.moved = {}; race.banner = null; race.confetti = []; race.firstDoneAt = 0; race.clipSaid = 0; race.splashAt = 0;
    race.ducks = { ...(R.wild || {}), ...Object.fromEntries(s.farms.map((f) => [f.id, f])) };
    race.place = Object.fromEntries(R.results.map((r) => [r.id, r]));
    race.hurdles = (R.hurdles || []).map((h) => ({ x: h.x != null ? h.x : h, log: !!h.log, k: h.k || (h.log ? 'log' : 'hurdle') }));
    race.forks = R.forks || []; race.wrongStop = R.wrongStop || 2.6; race.thinkStop = R.thinkStop || 0.9; race.mazeSaid = 0;
    race.LANES = Math.min(10, R.tracks.length);
    race.knock = new Float64Array(race.LANES * Math.max(1, race.hurdles.length)).fill(-1);
    race.runners = R.tracks.map((tr, i) => runner(R, tr, i));
    race.byX = race.runners.slice();
    race.byLane = Array.from({ length: race.LANES }, () => []); for (const r of race.runners) race.byLane[r.lane].push(r);
    race.P = art.racePose(); race.TH = art.THEME[R.theme] || art.THEME.meadow;
    PRT.life.fill(0);
    if (Date.now() - race.start < 2500) clip('crowd', { vol: 0.16 }); // the crowd settles in as the race intro starts
    loop(canvas, drawRace);
  }
  // One duck's playback: its path as time/position knots (the samples, plus the exact moment it hits
  // a fence and the exact moment it crosses the line), its jump outcomes and its animation state.
  function runner(R, tr, i) {
    const T = [], X = [], stop = race.stop, nh = race.hurdles.length;
    const hout = new Int8Array(nh), reach = new Float32Array(nh);
    for (let j = 0; j < tr.s.length; j++) { T.push(j * R.sample); X.push(tr.s[j] / 10); }
    const fin = race.place[tr.id] && race.place[tr.id].time;
    if (fin && T.length > 1) T[T.length - 1] = Math.max(T[T.length - 2] + 0.01, fin);
    for (const e of tr.ev) {
      if ((e[1] !== 'trip' && e[1] !== 'clip') || e[2] == null || !race.hurdles[e[2]]) continue;
      hout[e[2]] = e[1] === 'trip' ? 2 : 1;
      if (e[1] === 'trip') { // the duck reaches the fence at e[0] and stays there until it gets up
        const hx = race.hurdles[e[2]].x;
        let k = 0; while (k < T.length && T[k] < e[0]) k++;
        T.splice(k, 0, e[0]); X.splice(k, 0, hx);
        for (let m = k + 1; m < T.length && T[m] < e[0] + stop; m++) X[m] = hx;
      }
    }
    // maze forks: a wrong turn or a think holds the duck at the fork (like a crash at a fence)
    const fev = [];
    for (const e of tr.ev) {
      if ((e[1] !== 'wrong' && e[1] !== 'think' && e[1] !== 'short') || e[2] == null || race.forks[e[2]] == null) continue;
      fev.push({ t: e[0], k: e[1], h: e[2], said: false });
      if (e[1] === 'short') continue;
      const fx = race.forks[e[2]], stop = e[1] === 'wrong' ? race.wrongStop : race.thinkStop;
      let k = 0; while (k < T.length && T[k] < e[0]) k++;
      T.splice(k, 0, e[0]); X.splice(k, 0, fx);
      for (let m = k + 1; m < T.length && T[m] < e[0] + stop; m++) X[m] = fx;
    }
    const tiredEv = tr.ev.find((e) => e[1] === 'tired');
    return {
      id: tr.id, tr, i, lane: i % race.LANES, lv: tr.lv || [3, 3, 3, 3, 3, 3], fev, icon: null, pxv: null, T: Float64Array.from(T), X: Float64Array.from(X), ki: 0,
      hout, reach, tiredAt: tiredEv ? tiredEv[0] : Infinity, x: 0, px: null, vx: 0, gait: (i * 0.37) % 1, paddle: 0, flap: (i * 0.21) % 1,
      q: [0, 0.5], evi: 0, wet: false, landed: -1, sx: -999, by: 0, lab: false, done: false, sec: null, hi: 0,
    };
  }
  const say = (text, big) => { race.msgs.push({ text, at: performance.now(), big }); if (race.msgs.length > 5) race.msgs.shift(); };
  const nm = (id) => (race.ducks[id] || {}).name || '?';
  // Race clock: simulated seconds at e real seconds after GO (the winner crosses at pace.tw).
  function wallSim(e) { const P = race.pace; return e <= P.tw ? e * P.k : P.tw * P.k + (e - P.tw) * P.k2; }
  function posAt(r, simT) {
    const T = r.T, X = r.X;
    if (simT < T[r.ki]) r.ki = 0;
    while (r.ki < T.length - 2 && T[r.ki + 1] <= simT) r.ki++;
    const a = r.ki; if (simT >= T[T.length - 1]) { r.vx = 0; return X[X.length - 1]; }
    const dt = T[a + 1] - T[a]; r.vx = dt > 0 ? (X[a + 1] - X[a]) / dt : 0;
    return X[a] + (X[a + 1] - X[a]) * Math.min(1, Math.max(0, (simT - T[a]) / (dt || 1)));
  }
  const EV_ICON = { trip: 'dizzy', slip: 'alert', skid: 'swirl', boost: 'bolt' }; // drawn art (DUCK_ART.drawIcon), not emoji
  const EV_TEXT = { gulp: 'swallows a mouthful of water! 💦', dip: 'dips into the ravine and flaps back up! 🪽', trip: 'crashes into the fence! 💥', clip: 'clips the bar and stumbles!', slip: 'slips back down the cliff!', skid: 'spins out on the ice!', boost: 'catches a boost! ⚡', tired: 'is running out of steam…', short: 'takes the shortcut! 💡', wrong: 'takes a wrong turn! ↩️', think: 'stops to think… 🤔' };
  // the crash at a fence says what the fence was in this world
  const TRIP_TEXT = { lava: 'skids to a stop at the lava! 🔥', cactus: 'gets prickled by a cactus! 🌵', chimney: 'bonks into a chimney! 💥', root: 'trips on a root! 💥', gumdrop: 'bounces off a gumdrop! 🍬', hay: 'crashes into a hay bale! 💥', log: 'trips over a log! 💥' };
  const WEAK_SAY = { track: '🐢 {n} can’t run well and plods along…', pond: '🐢 {n} can’t swim well and paddles slowly!', cliff: '🐢 {n} isn’t much of a climber: slow going up the wall!', gap: '🐢 {n} can barely fly: flap, flap, FLAP!', maze: '🐢 {n} isn’t very smart: which way now?' };
  const SEC_SAY = { track: '🏃 {n} is back on the track!', pond: '🌊 {n} hits the water first!', cliff: '🧗 {n} starts up the cliff!', gap: '🪽 {n} leaps over the ravine!', maze: '🧠 {n} leads into the maze!' };
  function rrect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }

  // Where a duck is and how it moves this frame: sets the pose (race.P) and returns nothing; the
  // body's screen position goes into r.sx / r.by, its height above the ground into r.air.
  function poseRunner(r, F) {
    const art = F.art, G = F.G, P = race.P, R = race.R, lv = r.lv, U = F.U, hs = F.hs, YK = F.YK, PX = F.PX, simT = F.simT;
    const run = Math.min(14, lv[0]), swim = Math.min(14, lv[1]), fly = Math.min(14, lv[2]), climb = Math.min(14, lv[3]);
    const ground = (m) => F.feet - art.groundH(G, m) * YK; // ground (px) under x = m in this duck's lane
    let x = r.x;
    const s = art.secAt(G, Math.min(x, G.L - 0.001)), tired = simT >= r.tiredAt && !r.done;
    P.lean = 0; P.rot = 0; P.sx = 1; P.sy = 1; P.legs = true; P.wing = 0; P.flap = 0; P.farWing = false; P.eyes = tired ? 'tired' : ''; P.beak = tired ? 0.5 + 0.5 * Math.sin(F.now * 9) : 0; P.hx = 0; P.hy = tired ? 2 : 0;
    P.t1 = 0; P.t2 = 0; P.flip = false;
    const dm = r.px == null ? 0 : x - r.px; // metres moved since the last frame
    let lift = 0, mode = 'walk', xv = x; // xv: where the body is drawn (a crash pushes it back from the fence)
    r.air = 0;
    // ---- finished: a little celebration (top 3) or a rest
    if (r.done) {
      mode = 'stand';
      const pl = race.place[r.id] ? race.place[r.id].place : 9;
      if (pl <= 3) { P.wing = 0.7; P.flap = Math.sin(F.now * 12 + r.i); P.beak = 0.6; lift = Math.max(0, Math.sin(F.now * 6 + r.i)) * 5; }
      else { P.eyes = 'tired'; P.beak = 0.3 + 0.3 * Math.sin(F.now * 7); }
    }
    // ---- a moment in progress: an ice skid or a slip down the cliff
    let evNow = null, evAge = 0;
    for (const e of r.tr.ev) { if (e[0] > simT) break; const age = simT - e[0]; if ((e[1] === 'skid' && age < 0.8) || (e[1] === 'slip' && age < 0.9) || ((e[1] === 'gulp' || e[1] === 'dip') && age < 1.0)) { evNow = e[1]; evAge = age; } }
    // ---- hurdles in this duck's lane
    let jumpH = -1, crash = -1;
    if (!r.done && s.type === 'track' && race.hurdles.length) {
      while (r.hi < race.hurdles.length - 1 && race.hurdles[r.hi].x + 3 < x) r.hi++;
      const H = race.hurdles[r.hi];
      if (H && x > H.x - 4 && x < H.x + 3) {
        const out = r.hout[r.hi];
        if (!r.reach[r.hi]) r.reach[r.hi] = Math.max(1.1, Math.min(2.3, Math.max(2.6, r.vx) * 0.3)) + 0.03 * run;
        const reach = r.reach[r.hi], t0 = H.x - reach, t1 = H.x + reach, kn = r.lane * race.hurdles.length + r.hi;
        if (out === 2) { // a crash: up too low, into the fence, flat on its back, dazed, then over
          const te = trip(r, r.hi);
          if (te != null && simT >= te && simT < te + race.stop) { crash = (simT - te) / race.stop; if (race.knock[kn] < 0) race.knock[kn] = simT; }
          else if (x >= t0 - 0.7 && x < t0) { mode = 'crouch'; P.sy = 1 - 0.12 * sm((x - t0 + 0.7) / 0.7); P.sx = 2 - P.sy; lift = -(1 - P.sy) * 25; }
          else if (x >= t0 && x <= H.x && (te == null || simT < te)) { const u = (x - t0) / reach; lift = 12 * Math.sin(u * Math.PI * 0.5); mode = 'air'; xv = x - sm(u) * (13 * U) / PX; P.lean = -0.25; P.wing = 0.4; }
        } else {
          if (x >= t0 - 0.7 && x < t0) { mode = 'crouch'; P.sy = 1 - 0.14 * sm((x - t0 + 0.7) / 0.7); P.sx = 2 - P.sy; lift = -(1 - P.sy) * 25; }
          else if (x >= t0 && x <= t1) {
            const u = (x - t0) / (t1 - t0), peak = out === 1 ? 19 : 25 + 1.05 * run;
            lift = peak * 4 * u * (1 - u); mode = 'air'; jumpH = r.hi; P.lean = (u - 0.5) * (out === 1 ? 0.9 : 0.6); P.wing = 0.55 + 0.25 * Math.sin(u * 6);
            if (out === 1 && u > 0.45 && race.knock[kn] < 0) { race.knock[kn] = simT; if (r.lab) clip('trip', { vol: 0.07, gap: 300 }); }
          } else if (x > t1 && x < t1 + (out === 1 ? 1.8 : 0.6)) {
            const u = (x - t1) / (out === 1 ? 1.8 : 0.6);
            if (r.landed !== r.hi) { r.landed = r.hi; burst(x, F.feet, 5, s.v === 'mud' ? MUD : s.v === 'sand' ? SAND : DUST, 2.5, 50, 4 * F.zoom, 30); }
            if (out === 1) { P.lean = 0.45 * (1 - u); P.wing = 0.8 * (1 - u); P.flap = Math.sin(F.now * 22) * (1 - u); P.beak = 0.8 * (1 - u); P.sy = 1 - 0.1 * (1 - u); P.sx = 2 - P.sy; }
            else { P.sy = 1 - 0.13 * Math.sin(u * Math.PI); P.sx = 2 - P.sy; }
          }
        }
      }
    }
    const feetSink = s.type === 'track' && (s.v === 'mud' || s.v === 'taffy') ? 3 : 0;
    // ---- the maze: at each fork a shortcut (a hop and a bright idea, then a burst of speed), a think
    // (it stops at the signpost and scratches its head) or a wrong turn: it turns round, waddles off
    // down the dead-end path, finds the wall (!), turns again and walks back to the fork. The server
    // holds the duck at the fork for that time; the body is moved here and the feet follow below.
    let gdm = dm, mdy = 0; r.icon = null;
    if (!r.done && s.type === 'maze' && mode === 'walk' && crash < 0) {
      let fe = null;
      for (const q of r.fev) { if (q.t > simT) break; const dur = q.k === 'wrong' ? race.wrongStop : q.k === 'think' ? race.thinkStop : 1.4; if (simT < q.t + dur) fe = q; }
      if (fe) {
        const fxm = race.forks[fe.h], dur = fe.k === 'wrong' ? race.wrongStop : fe.k === 'think' ? race.thinkStop : 1.4, u = (simT - fe.t) / dur;
        if (fe.k === 'wrong') {
          const D = 2.4, out = u < 0.2 ? 0 : u < 0.5 ? sm((u - 0.2) / 0.3) : u < 0.7 ? 1 : 1 - sm((u - 0.7) / 0.3);
          xv = fxm - D * out; mdy = -F.dz * 0.7 * out;
          P.flip = u > 0.16 && u < 0.66;
          if (u < 0.2) { mode = 'stand'; P.hx = Math.sin(u * 40) * 1.2; r.icon = 'question'; }
          else if (u < 0.5) r.icon = 'question';
          else if (u < 0.7) { mode = 'stand'; P.hx = Math.sin(F.now * 22) * 1.6; P.beak = 0.7; P.wing = 0.5; P.flap = Math.sin(F.now * 18) * 0.5; r.icon = 'exclaim'; if (u < 0.6) { P.sy = 1 - 0.08 * Math.sin(((u - 0.5) / 0.1) * Math.PI); P.sx = 2 - P.sy; } }
          if (u >= 0.5 && !fe.said) { fe.said = true; if (r === race.byX[0] || (r.lab && performance.now() - race.mazeSaid > 2500)) { race.mazeSaid = performance.now(); say(`🧱 ${nm(r.id)} hits a dead end and doubles back!`); } }
          gdm = Math.abs(xv - (r.pxv == null ? xv : r.pxv));
        } else if (fe.k === 'think') {
          mode = 'stand'; P.wing = 0.95; P.flap = 0.28 * Math.sin(F.now * 16); P.hy = -1; P.hx = 1.2; P.lean = -0.1; P.flip = u > 0.38 && u < 0.62; r.icon = 'question';
        } else {
          if (u < 0.22) { const k2 = u / 0.22; lift = 10 * Math.sin(k2 * Math.PI); mode = 'air'; P.wing = 0.75; P.flap = Math.sin(F.now * 22); P.beak = 0.6; }
          if (u < 0.9) r.icon = 'bulb';
          if (F.particles && Math.random() < 0.5) puff(x - 0.5, F.feet - 8 - Math.random() * 18, -1.2, -10, 0.55, 2.6 * F.zoom, GOLD, 0);
        }
      }
    }
    // ---- the crash itself
    if (crash >= 0) {
      const H = race.hurdles[r.hi], back = (13 * U) / PX;
      mode = 'crash'; P.legs = true;
      if (crash < 0.12) { const u = crash / 0.12; xv = H.x - back - (5 * U / PX) * Math.sin(u * Math.PI * 0.5); P.lean = -0.5 * u; P.sx = 1 - 0.15 * Math.sin(u * Math.PI); P.sy = 2 - P.sx; P.wing = 0.9; P.eyes = 'shut'; lift = 6 * (1 - u); }
      else if (crash < 0.42) { const u = sm((crash - 0.12) / 0.3); xv = H.x - back - 5 * U / PX - (4 * U / PX) * u; P.rot = -1.75 * u; lift = 4 * Math.sin(u * Math.PI) - 4 * u; P.eyes = 'dizzy'; P.wing = 0.6; P.flap = Math.sin(F.now * 24) * 0.6; P.f1x = -6 + Math.sin(F.now * 26) * 3; P.f1y = 16 - 4 * u; P.f2x = 4 + Math.cos(F.now * 26) * 3; P.f2y = 16 - 4 * u; P.t1 = -0.6; P.t2 = 0.4; }
      else if (crash < 0.75) { const u = sm((crash - 0.42) / 0.33); xv = H.x - back - 9 * U / PX; P.rot = -1.75 + 1.5 * u; lift = -4 + 4 * u; P.eyes = 'dizzy'; P.hx = Math.sin(F.now * 7) * 1.5; if (u > 0.4) { P.f1x = -6; P.f2x = 4; P.f1y = 17; P.f2y = 17; } }
      else { const u = (crash - 0.75) / 0.25; xv = H.x - back - 9 * U / PX + (back + 9 * U / PX) * sm(u); P.rot = -0.25 * (1 - u); lift = 13 * Math.sin(u * Math.PI); P.wing = 0.7; P.flap = Math.sin(F.now * 20); P.f1x = -3; P.f1y = 13; P.f2x = 4; P.f2y = 12; P.t1 = 0.7; P.t2 = 0.7; }
      if (P.rot < -0.3 && !(P.f1y === 17)) { P.f1x = -7 + Math.sin(F.now * 26) * 3; P.f2x = 3 + Math.cos(F.now * 26) * 3; P.f1y = 15; P.f2y = 15; }
      const gy = ground(xv);
      r.sx = (xv - F.cam) * PX; r.by = gy - 18 * U - lift * hs - (P.rot < -0.6 ? 6 * U * Math.min(1, -P.rot) : 0); r.gy = gy; r.air = lift;
      r.px = x; return;
    }
    // ---- the pond: dive (good swimmers) or belly flop, paddle, hop out
    if (!r.done && s.type === 'pond' && mode === 'walk') {
      const wy = F.feet + 0.6 * YK, ent = x - s.a, ex = s.b - x, diver = swim >= 5;
      let sink = 3 + (swim < 3 ? 2 : 0), bodyLift = 0;
      r.paddle += Math.max(0, dm) * PX / U / (9 + 0.5 * swim);
      const pa = r.paddle * TAU;
      P.f1x = -4 + 6 * Math.cos(pa); P.f1y = 15 + 3 * Math.sin(pa); P.f2x = 3 + 6 * Math.cos(pa + Math.PI); P.f2y = 15 + 3 * Math.sin(pa + Math.PI); P.t1 = 0.6 * Math.cos(pa); P.t2 = 0.6 * Math.cos(pa + Math.PI);
      P.lean = -0.06 + Math.sin(F.now * 3 + r.i) * 0.03; mode = 'swim';
      if (ent < 2.4) {
        const e2 = ent / 2.4;
        if (diver) {
          if (e2 < 0.35) { const u = e2 / 0.35; bodyLift = 16 * Math.sin(u * Math.PI * 0.85); P.lean = 1.1 * u; P.wing = 0.7; P.f1x = -10; P.f1y = 12; P.f2x = -8; P.f2y = 13; P.t1 = 1.2; P.t2 = 1.2; }
          else if (e2 < 0.7) { const u = (e2 - 0.35) / 0.35; sink = 3 + 20 * Math.sin(u * Math.PI); P.lean = 1.1 - 1.4 * u; }
          else { const u = (e2 - 0.7) / 0.3; P.lean = -0.3 * (1 - u); sink = 3 - 4 * Math.sin(u * Math.PI); }
        } else {
          if (e2 < 0.4) { const u = e2 / 0.4; bodyLift = 11 * Math.sin(u * Math.PI); P.lean = -0.25 + 0.35 * u; P.wing = 0.9; P.flap = Math.sin(F.now * 18); P.f1x = -6; P.f1y = 16; P.f2x = 5; P.f2y = 17; }
          else if (e2 < 0.6) { const u = (e2 - 0.4) / 0.2; P.sy = 1 - 0.25 * Math.sin(u * Math.PI); P.sx = 1 + 0.18 * Math.sin(u * Math.PI); P.eyes = 'shut'; P.wing = 0.5; }
        }
        if (!r.wet && e2 >= (diver ? 0.36 : 0.42)) {
          r.wet = true; const big = diver ? 9 : 18;
          burst(x, wy - 2, big, SPLASH, diver ? 2.5 : 5, diver ? 260 : 340, (diver ? 3 : 4) * F.zoom, 700, 0.9);
          if (r.lab || r === race.byX[0]) { if (performance.now() - race.splashAt > 350) { race.splashAt = performance.now(); clip('splash', { vol: diver ? 0.14 : 0.22, pan: Math.max(-0.6, Math.min(0.6, r.sx / F.W - 0.5)) }); } }
          if (r === race.byX[0] && !race.flags['pond' + s.a]) { race.flags['pond' + s.a] = true; say(diver ? `🌊 ${nm(r.id)} dives into the pond!` : `🌊 ${nm(r.id)} belly-flops into the pond! SPLASH!`); }
        }
      } else r.wet = true;
      if (ex < 1.3) { // hop out onto the bank
        const u = 1 - ex / 1.3; bodyLift = 14 * Math.sin(u * Math.PI); sink = 3 * (1 - u); P.lean = -0.3 + 0.5 * u; P.f1x = -7; P.f1y = 14; P.f2x = -3; P.f2y = 15; P.t1 = 1; P.t2 = 1; mode = 'hop';
        if (u > 0.2 && Math.random() < 0.3) puff(x - 0.3, wy - 12 * U, (Math.random() - 0.5) * 0.4, 10, 0.5, 2 * F.zoom, SPLASH, 400);
      }
      if (swim < 4 && ent >= 2.4 && ex >= 1.3) { P.wing = 0.35; P.flap = Math.sin(F.now * 15 + r.i); if (Math.random() < 0.25) puff(x - 0.2, wy - 4, -0.8, 60, 0.4, 2.5 * F.zoom, SPLASH, 500); } // a weak swimmer flaps and splashes
      if (dm > 0 && ent >= 2.4 && Math.random() < 0.15) puff(x - (16 * U) / PX, wy, -0.3, 30, 0.45, 2 * F.zoom, SPLASH, 300);
      if (evNow === 'gulp') { const u = evAge / 1.0, dunk = Math.sin(Math.min(1, u * 1.6) * Math.PI); sink += 16 * dunk; P.eyes = 'shut'; P.beak = 0.8; P.wing = 0.8; P.flap = Math.sin(F.now * 24); P.lean = -0.2; if (Math.random() < 0.5) puff(x + (Math.random() - 0.5) * 0.6, wy - 6, (Math.random() - 0.5) * 0.6, 40 + Math.random() * 40, 0.5, 2.2 * F.zoom, SPLASH, -60); }
      const bob = (s.v === 'waves' ? 2.5 : 1) * Math.sin(F.now * 3.2 + r.i);
      r.sx = (x - F.cam) * PX; r.wy = wy; r.gy = wy; r.by = wy - 12 * U + sink * U + bob - bodyLift * hs; r.air = bodyLift; r.swim = ent >= 0.84 && ex >= 0.4 && bodyLift < 6;
      r.px = x; return;
    }
    r.swim = false; r.wet = false;
    // ---- the ravine: take off from the rim, flap (or glide) across at a height set by Fly, land
    if (!r.done && s.type === 'gap' && mode === 'walk') {
      const RIM = art.rimOf ? art.rimOf(s) : 1.3, a0 = s.a + RIM - 0.4, a1 = s.b - RIM + 0.4;
      if (x > a0 && x < a1) {
        const u = (x - a0) / (a1 - a0), su = Math.sin(Math.PI * u), A2 = -2.4 + 0.6 * fly;
        let alt = A2 * su + 1.3 * Math.pow(su, 0.45);
        // a dip: a weak flyer drops toward the bottom, flaps like mad and climbs back (the server holds it)
        const dipU = evNow === 'dip' ? evAge / 1.0 : -1;
        if (dipU >= 0) { alt -= 3.2 * Math.sin(Math.min(1, dipU) * Math.PI); if (s.v === 'river' && dipU > 0.35 && dipU < 0.6 && Math.random() < 0.6) puff(x, F.feet + 70, (Math.random() - 0.5) * 2, 80, 0.5, 3 * F.zoom, SPLASH, 400); }
        const dAlt = (A2 * Math.PI * Math.cos(Math.PI * u)) / (a1 - a0);
        const hz = 2 + 0.32 * Math.max(0, 10 - fly) + (tired ? 0.6 : 0);
        r.flap += F.simDt * hz;
        const glide = fly >= 6 && u > 0.3 && u < 0.72 && dipU < 0;
        P.wing = glide ? 0.55 : 0.4; P.flap = glide ? 0.12 * Math.sin(F.now * 3) : Math.sin(r.flap * TAU); P.farWing = true;
        P.lean = Math.max(-0.5, Math.min(0.5, -Math.atan((dAlt * YK * 1.5) / PX) * 0.8)); P.legs = true;
        P.f1x = -10; P.f1y = 12; P.f2x = -7; P.f2y = 13; P.t1 = 1.3; P.t2 = 1.15;
        if (fly < 3 || dipU >= 0) { P.beak = 0.7; P.eyes = 'shut'; } // working hard
        if (dipU >= 0) { r.flap += F.simDt * 6; P.flap = Math.sin(r.flap * TAU); P.wing = 0.9; }
        mode = 'fly';
        const gy = F.feet; // the rim height
        r.sx = (x - F.cam) * PX; r.by = gy - 18 * U - alt * YK * 1.5; r.gy = null; r.air = 30;
        r.landed = -2; r.px = x; return;
      }
      if (x >= a1 && r.landed === -2) { r.landed = -3; burst(x, F.feet, 6, DUST, 2.5, 60, 4 * F.zoom, 30); }
    }
    // ---- walking, running, climbing: planted feet on the real ground
    const climbing = s.type === 'cliff';
    let A2 = climbing ? 5 + 0.4 * climb : 7 + 0.5 * run;
    if (s.type === 'track' && s.v === 'mud') A2 *= 0.62; else if (s.type === 'track' && s.v === 'sand') A2 *= 0.85; else if (s.type === 'track' && s.v === 'ice') A2 *= 1.1;
    if (tired) A2 *= 0.8;
    const beta = 0.55, D = A2 / beta;
    const moving = gdm > 1e-4 && mode !== 'stand';
    if (moving && mode !== 'air') r.gait = (r.gait + (gdm * PX) / U / D) % 1;
    const gB = ground(xv), gF = ground(xv + (7 * U) / PX), gR = ground(xv - (7 * U) / PX);
    const slope = Math.atan2(gR - gF, 14 * U); // + uphill
    const bodyG = Math.min(gB, (gB * 2 + gF + gR) / 4);
    const bob = moving && mode === 'walk' ? -(1.1 + 0.07 * run) * (0.5 - 0.5 * Math.cos(r.gait * 2 * TAU)) : 0;
    if (mode === 'walk' || mode === 'crouch' || mode === 'stand') {
      if (mode === 'walk' && moving) {
        P.lean += 0.1 + 0.06 * Math.sin(r.gait * TAU) - slope * 0.85;
        const contact = 0.5 + 0.5 * Math.cos(r.gait * 2 * TAU);
        P.sy *= 1 - 0.05 * contact; P.sx *= 1 + 0.035 * contact;
        P.wing = climbing && slope > 0.4 ? (climb < 5 ? 0.6 : 0.3) : 0.12; P.flap = climbing && slope > 0.4 ? Math.sin(F.now * (climb < 5 ? 18 : 9)) : Math.sin(r.gait * 2 * TAU) * 0.2;
      } else if (mode !== 'crouch') P.lean += -slope * 0.5;
      for (let k = 0; k < 2; k++) {
        const hip = k ? 3 : -4;
        let fx, lf = 0, toe = 0;
        if (moving && mode === 'walk') {
          const q = (r.gait + k * 0.5) % 1;
          if (q < beta) fx = hip + A2 / 2 - (A2 * q) / beta;
          else { const u = (q - beta) / (1 - beta); fx = hip - A2 / 2 + A2 * sm(u); lf = (climbing ? 6 : 3.5 + 0.3 * run) * Math.sin(Math.PI * u); toe = 0.7 * Math.sin(Math.PI * u); }
          if (q < r.q[k] && !climbing && F.particles) { // a footfall: a little dust (or mud, sand, snow)
            const LD = window.DUCK_LANDS, c = LD && LD.DUSTOF[s.v] != null ? LD.DUSTOF[s.v] : s.v === 'mud' ? MUD : s.v === 'sand' ? SAND : s.v === 'ice' || R.theme === 'snow' ? SNOW : DUST;
            if (c === MUD || Math.random() < 0.6) puff(xv + ((P.flip ? -fx : fx) * U) / PX, F.feet - 2, -0.4 - Math.random() * 0.6, -(c === MUD ? 70 : 25) - Math.random() * 25, c === MUD ? 0.5 : 0.55, (c === MUD ? 2.6 : 3.2) * F.zoom, c, c === MUD ? 500 : -10);
          }
          r.q[k] = q;
        } else fx = mode === 'crouch' ? hip * 0.6 : hip;
        const gy = ground(xv + (fx * U) / PX);
        const fy = (gy - (bodyG - 18 * U)) / U - lf + feetSink;
        if (k) { P.f2x = fx; P.f2y = fy; P.t2 = toe - (gR - gF) / (14 * U) * 0.6; } else { P.f1x = fx; P.f1y = fy; P.t1 = toe - (gR - gF) / (14 * U) * 0.6; }
      }
      // On a climbing wall: body up against the rock, wings reaching up one after the other (hand over
      // hand), feet pushing; a weak climber wobbles and puffs, a strong one scrambles up.
      const wall = climbing && art.cliffWalls ? art.cliffWalls(s).find((w) => xv >= w.a - 0.15 && xv <= w.b + 0.1) : null;
      if (wall && evNow !== 'slip' && !r.done) {
        const reach = r.gait * 2 * TAU;
        P.rot = -1.05; P.lean = 0; P.wing = 0.95; P.flap = Math.sin(reach); P.farWing = true; P.beak = climb < 4 ? 0.6 : 0.2; P.eyes = climb < 3 ? 'shut' : '';
        P.f1x = 6 + 4 * Math.sin(reach); P.f1y = 14 + 4 * Math.cos(reach); P.f2x = 6 - 4 * Math.sin(reach); P.f2y = 14 - 4 * Math.cos(reach); P.t1 = -0.8; P.t2 = -0.8;
        if (climb < 4) P.hx = Math.sin(F.now * 20) * 1.2;
        if (moving && Math.random() < (climb < 4 ? 0.2 : 0.06)) puff(xv + 0.2, bodyG - 6, (Math.random() - 0.5), 20, 0.5, 2 * F.zoom, PEBBLE, 500);
        r.gait = (r.gait + F.simDt * (1.2 + 0.12 * climb)) % 1;
        xv -= 0.35; // hug the face
      }
      if (evNow === 'slip') { // sliding back down the rock: belly to the wall, feet scrabbling
        P.lean = -0.9; P.wing = 0.9; P.flap = Math.sin(F.now * 26); P.eyes = 'shut'; P.beak = 1;
        P.f1x = 4 + Math.sin(F.now * 30) * 4; P.f2x = 8 + Math.cos(F.now * 30) * 4; P.f1y = 12; P.f2y = 10;
        if (Math.random() < 0.4) puff(xv + 0.3, gB - 4, (Math.random() - 0.5) * 2, 30, 0.6, 2.5 * F.zoom, PEBBLE, 600);
        if (evAge < 0.03) clip('trip', { vol: 0.12, gap: 500 });
      }
      if (evNow === 'skid') { P.rot = sm(evAge / 0.8) * TAU; P.f1x = -10; P.f2x = 10; P.f1y = 16; P.f2y = 16; P.wing = 0.8; P.flap = Math.sin(F.now * 20); if (Math.random() < 0.5) puff(xv, F.feet - 2, (Math.random() - 0.5) * 3, -20, 0.5, 3 * F.zoom, SNOW, 0); }
    } else if (mode === 'air') {
      P.f1x = -3; P.f1y = 13; P.f2x = 3; P.f2y = 12.5; P.t1 = 0.9; P.t2 = 0.8; P.farWing = P.wing > 0.3;
    }
    if (tired && moving && Math.random() < 0.04) puff(xv - 0.2, bodyG - 34 * U, -0.4, -40, 0.6, 2 * F.zoom, SWEAT, 300);
    r.sx = (xv - F.cam) * PX; r.gy = bodyG + mdy; r.by = bodyG + mdy - 18 * U + bob * U - lift * hs; r.air = lift;
    r.px = x; r.pxv = xv;
  }
  function trip(r, h) { for (const e of r.tr.ev) if (e[1] === 'trip' && e[2] === h) return e[0]; return null; }

  function drawRace(g, W, H, now) {
    const R = race.R, G = race.G, art = A(), pnow = performance.now();
    const e = Date.now() - race.start;
    // The race clock: about real time, slowed down near a photo finish (and never far behind the wall clock).
    const dt = Math.min(0.1, (pnow - race.last) / 1000); race.last = pnow;
    const prevSim = race.simT;
    if (e < R.intro) race.simT = 0;
    else {
      const es = (e - R.intro) / 1000, wall = wallSim(es), kNow = es <= race.pace.tw ? race.pace.k : race.pace.k2;
      const slow = race.photo && race.leadX > G.L - 7 && !race.finished.size && race.slowUsed < 2.6;
      race.rate += ((slow ? 0.3 : 1) - race.rate) * 0.15;
      race.slowUsed += dt * (1 - race.rate);
      race.simT = Math.min(wall, Math.max(wall - 3 * kNow, race.simT + dt * kNow * race.rate));
    }
    const simT = race.simT, simDt = Math.max(0, simT - prevSim);
    for (const r of race.runners) { r.x = posAt(r, simT); r.done = r.x >= G.L; }
    const byX = race.byX;
    byX.sort((a, b) => b.x - a.x || race.place[a.id].time - race.place[b.id].time);
    const lead = byX[0]; race.leadX = lead.x;
    let unfinished = 0; for (const r of byX) if (!r.done) unfinished++;
    for (let i = 0; i < byX.length; i++) byX[i].lab = i < 6;
    // Camera: frame the leading pack, zoom in when it's tight, hold on the line for the podium.
    let span, target;
    if (race.finished.size && (race.finished.size < 3 || pnow - race.firstDoneAt < 2500) && unfinished) { span = 40; target = G.L - span * 0.72; }
    else {
      let n = 0, hi = null, lo = 0;
      for (const r of byX) { if (unfinished && r.done) continue; if (hi == null) hi = r.x; lo = r.x; if (++n >= 4) break; }
      span = Math.max(30, Math.min(54, hi - lo + 22));
      if (race.rate < 0.9) span = 26;
      target = hi - span * 0.68;
    }
    race.span += (span - race.span) * 0.03;
    const PX = W / race.span;
    target = Math.max(-5, Math.min(G.L - race.span * 0.8, target));
    race.cam += (target - race.cam) * 0.08;
    const LANES = race.LANES, dz = (LANES <= 6 ? 12 : 9) * Math.min(1.3, W / 1600), band = dz * LANES;
    const VPX = W / 66, YK = VPX * 0.9, base = art.drawRaceWorld(g, W, H, R, G, race.cam, PX, now, VPX, band, LANES);
    const zoom = Math.max(0.9, Math.min(1.35, PX / (W / 44)));
    const F = { art, G, simT, simDt, now, PX, YK, cam: race.cam, W, zoom, U: 1, hs: 1, feet: 0, particles: true, dz };
    const nh = race.hurdles.length, TH = race.TH;
    // lanes from the back to the front: the lane's hurdles, then its ducks
    for (let lane = LANES - 1; lane >= 0; lane--) {
      const feet = base + 8 - (lane + 0.5) * dz, hs = Math.max(0.7, 1.8 - lane * 0.04) * Math.min(1.3, W / 1600) * zoom;
      for (let h = 0; h < nh; h++) {
        const Hd = race.hurdles[h], x = (Hd.x - race.cam) * PX; if (x < -60 || x > W + 60) continue;
        const kt = race.knock[lane * nh + h];
        art.drawHurdle(g, x, feet + dz * 0.4, hs, dz * 0.8, Hd.k, kt < 0 ? 0 : Math.min(1, (simT - kt) / 0.28), now);
      }
      for (const r of race.byLane[lane]) {
        const d = race.ducks[r.id] || {}, stage = d.stage == null ? 2 : Math.max(0, d.stage);
        F.hs = hs; F.U = hs * (stage <= 0 ? 0.62 : stage === 1 ? 0.82 : 1); F.feet = feet;
        const sx0 = (Math.min(r.x, G.L) - race.cam) * PX;
        if (sx0 < -120 || sx0 > W + 120) { r.px = r.x; r.sx = -999; continue; }
        if (r.done) r.x = Math.min(r.x, G.L) + Math.min(5, (race.place[r.id].place - 1) * 0.6) + 1.2;
        poseRunner(r, F);
        const U = F.U, x = r.sx, y = r.by;
        // shadow on the ground (none over the ravine; ripples on the water)
        if (r.gy != null && !r.swim) { const k = Math.max(0.35, 1 - r.air / 45); g.fillStyle = 'rgba(0,0,0,' + (0.22 * k).toFixed(2) + ')'; g.beginPath(); g.ellipse(x, r.gy + 1, 15 * U * k, 3.6 * U * k, 0, 0, TAU); g.fill(); }
        if (r.swim) { // the wake behind and rings around the duck
          const wy = r.wy, rip = (now * 1.6 + r.i * 0.3) % 1;
          g.strokeStyle = 'rgba(255,255,255,' + (0.5 * (1 - rip)).toFixed(2) + ')'; g.lineWidth = 2; g.beginPath(); g.ellipse(x, wy + 2, (22 + rip * 16) * U, (3 + rip * 2) * U, 0, 0, TAU); g.stroke();
          if (r.vx > 0.3) { g.strokeStyle = 'rgba(255,255,255,.45)'; g.lineWidth = 2; g.beginPath(); g.moveTo(x - 16 * U, wy); g.lineTo(x - 52 * U, wy - 5 * U); g.moveTo(x - 16 * U, wy + 1); g.lineTo(x - 52 * U, wy + 6 * U); g.stroke(); }
        }
        art.drawRacer(g, x, y, F.hs, d.color, d.hat, stage, race.P);
        if (r.swim) { // the water in front of the body: the paddling feet show through it
          const ws = art.secAt(G, Math.min(r.x, G.L - 0.01)), LD = window.DUCK_LANDS;
          g.fillStyle = (LD && LD.WATER[ws.v]) || TH.water; g.globalAlpha = 0.62; g.fillRect(x - 30 * U, r.wy + 1, 60 * U, Math.min(24 * U, 44)); g.globalAlpha = 1;
          g.fillStyle = 'rgba(255,255,255,.55)'; g.fillRect(x - 26 * U, r.wy, 52 * U, 1.6);
        }
        const sec = art.secAt(G, Math.min(r.x, G.L - 0.01));
        if (sec.type === 'track' && sec.v === 'mud' && r.air < 2 && !r.done) { g.fillStyle = '#6b4a2b'; g.beginPath(); g.ellipse(x, r.gy + 1, 15 * U, 3.4 * U, 0, 0, TAU); g.fill(); }
        // the moment's icon over the head, the cheer megaphones, the name tag
        let evk = null; for (const ev of r.tr.ev) { if (ev[0] > simT) break; if (simT - ev[0] < 1.2 && EV_ICON[ev[1]]) evk = ev[1]; }
        const sc = F.hs;
        if (r.icon) art.drawIcon(g, r.icon, x + (race.P.flip ? -1 : 1) * 30 * sc, y - 30 * sc, 30 * sc, now); // the maze: ? ! and the bright idea
        else if (evk && EV_ICON[evk]) art.drawIcon(g, EV_ICON[evk], x, y - 38 * sc, 26 * sc, now);
        else if (simT >= r.tiredAt && !r.done) art.drawIcon(g, 'sweat', x - 20 * sc, y - 30 * sc, 18 * sc, now);
        if (r.lab || (r.done && race.place[r.id].place <= 3)) {
          g.textAlign = 'center'; g.font = `600 ${Math.min(20, 12 * sc)}px Fredoka, sans-serif`;
          const fim = faceImg(farmerOf(r.id, d), 64);
          const label = (r.done ? MEDAL[race.place[r.id].place - 1] || '#' + race.place[r.id].place : '') + ' ' + (d.avatar && !fim ? d.avatar + ' ' : '') + (d.name || '') + (d.wild ? ' 🌿' : '');
          const fh = Math.min(26, 16 * sc), fw = fim ? fh * 1.5 : 0, tw = g.measureText(label).width + 12 + fw * 0.8, ly = y - (50 + (lane % 3) * 16) * sc - r.air * 0;
          g.fillStyle = d.wild ? 'rgba(40,70,30,.75)' : 'rgba(0,0,0,.62)'; rrect(g, x - tw / 2, ly, tw, fh, 6); g.fill(); g.fillStyle = '#fff'; g.fillText(label, x + fw * 0.4, ly + fh * 0.76);
          if (fim) g.drawImage(fim, x - tw / 2 + 1, ly + fh - fw * 0.92, fw, fw);
          g.textAlign = 'left';
        }
        for (const c of race.cheers) if (c.id === r.id) { const age = (pnow - c.at) / 1000; if (age < 1.5) { g.globalAlpha = 1 - age / 1.5; art.drawIcon(g, 'megaphone', x + Math.sin(age * 8 + c.at) * 10, y - 64 * sc - age * 40, 24 * sc, age); g.globalAlpha = 1; } }
      }
    }
    drawParticles(g, dt * (race.rate < 0.9 ? 0.4 : 1), race.cam, PX);
    art.drawRaceWeather(g, W, H, R, now);
    // the race's moments as they happen: commentary and the sounds, in sync with the animation
    for (const r of race.runners) {
      const ev = r.tr.ev, d = race.ducks[r.id] || {};
      while (r.evi < ev.length && ev[r.evi][0] <= simT) {
        const [, k] = ev[r.evi++]; if (simT - ev[r.evi - 1][0] > 2) continue; // skipped ahead: stay quiet
        const pan = Math.max(-0.6, Math.min(0.6, r.sx / W - 0.5));
        if (k === 'trip') { const hk = race.hurdles[ev[r.evi - 1][2]]; clip('trip', { vol: r.lab ? 0.2 : 0.1, gap: 250, pan }); if (r.lab || R.tracks.length <= 12) say(`${d.name} ${(hk && TRIP_TEXT[hk.k]) || EV_TEXT.trip}`); burst(r.x, r.gy || base, 8, DUST, 3, 80, 4.5 * zoom, 40); }
        else if (k === 'clip') { if (r.lab && pnow - race.clipSaid > 2500) { race.clipSaid = pnow; say(`${d.name} ${EV_TEXT.clip}`); } }
        else if (k === 'slip') { if (r.lab || R.tracks.length <= 12) say(`${d.name} ${EV_TEXT.slip}`); }
        else if (k === 'skid') { clip('trip', { vol: 0.1, gap: 500, pan }); if (r.lab || R.tracks.length <= 12) say(`${d.name} ${EV_TEXT.skid}`); }
        else if (k === 'boost') { if (r.lab && Math.random() < 0.5) say(`${d.name} ${EV_TEXT.boost}`); }
        else if (k === 'short') { if (r.lab) clip('maze', { vol: 0.1, rate: 1.25, gap: 350, pan }); if ((r === race.byX[0] || r.lab) && pnow - race.mazeSaid > 1800) { race.mazeSaid = pnow; say(`💡 ${d.name} ${EV_TEXT.short}`); } }
        else if (k === 'wrong') { if (r.lab) clip('maze', { vol: 0.11, rate: 0.7, gap: 350, pan }); if ((r.lab || R.tracks.length <= 12) && pnow - race.mazeSaid > 1500) { race.mazeSaid = pnow; say(`↩️ ${d.name} ${EV_TEXT.wrong}`); } }
        else if (k === 'think') { if (r === race.byX[0] && pnow - race.mazeSaid > 3500) { race.mazeSaid = pnow; say(`🤔 ${d.name} ${EV_TEXT.think}`); } }
        else if (k === 'gulp' || k === 'dip') { if (k === 'gulp') clip('splash', { vol: r.lab ? 0.16 : 0.08, gap: 400, pan }); if ((r.lab || R.tracks.length <= 12) && pnow - (race.mishapSaid || 0) > 1800) { race.mishapSaid = pnow; say(`${d.name} ${EV_TEXT[k]}`); } }
        // a duck reaching the part of the course its weakest skill is for: the commentary says so
        // (one line at a time, so a big field doesn't flood the ticker)
        else if (k === 'weak') { const sec = G.secs[ev[r.evi - 1][2]]; if (sec && WEAK_SAY[sec.type] && (r.lab || R.tracks.length <= 8) && pnow - (race.weakSaid || 0) > 2600) { race.weakSaid = pnow; say(WEAK_SAY[sec.type].replace('{n}', d.name)); } }
        else if (k === 'tired') { if (r === race.byX[0] || (r.lab && pnow - (race.tiredSaid || 0) > 6000)) { race.tiredSaid = pnow; say(`${d.name} ${EV_TEXT.tired}`); } }
      }
      if (r.done && !race.finished.has(r.id)) {
        race.finished.add(r.id); const pl = race.place[r.id].place;
        if (pl === 1) {
          race.firstDoneAt = pnow; BOX.sfx('cheer'); BOX.sfx('win');
          if (race.photo) clip('camera', { vol: 0.28, jitter: 0 }); // the photo-finish camera
          const second = R.results[1] && race.ducks[R.results[1].id];
          race.banner = { at: pnow, text: `🏆 ${d.name} WINS!`, sub: race.photo && second ? `📸 Photo finish: ahead of ${second.name} by ${R.margin.toFixed(2)}s` : d.wild ? 'A wild duck takes it!' : (d.owner ? 'Raised by ' + d.owner : '') };
          say(race.photo && second ? `📸 PHOTO FINISH! ${d.name} beats ${second.name} by a beak!` : `🏆 ${d.name} WINS the ${R.name}!`, true);
          for (let i = 0; i < 140; i++) race.confetti.push({ x: Math.random() * W, y: -Math.random() * H * 0.5, vy: 120 + Math.random() * 160, vx: (Math.random() - 0.5) * 60, c: ['#ffd23f', '#ff4f9a', '#3ec1ff', '#2ee6a6', '#fff'][i % 5], r: Math.random() * 6 });
        } else if (pl <= 3) say(`${['', '🥈', '🥉'][pl - 1]} ${d.name} takes ${pl === 2 ? 'second' : 'third'}!`);
      }
    }
    // Commentary from the race state: lead changes, sections, the first hurdle, neck and neck, halfway, final stretch.
    const b = byX[1] && !byX[1].done ? byX[1] : null;
    if (e > R.intro && !lead.done) {
      if (race.leader !== lead.id) {
        if (race.leader && pnow - race.leadAt > 900) say(`${(race.ducks[lead.id] || {}).wild ? '🌿 Wild duck ' : ''}${nm(lead.id)} takes the lead!`);
        race.leader = lead.id; race.leadAt = pnow;
      }
      const si = G.secs.indexOf(art.secAt(G, lead.x));
      if (si > 0 && si !== race.leaderSec && G.secs[si].type !== 'pond') say(SEC_SAY[G.secs[si].type].replace('{n}', nm(lead.id)));
      race.leaderSec = si;
      if (!race.flags.hurdle && race.hurdles.length && lead.x > race.hurdles[0].x + 1) { race.flags.hurdle = true; if (!lead.hout[0]) say(`🚧 ${nm(lead.id)} sails over the first hurdle!`); }
      if (b && lead.x - b.x < 0.8 && pnow - race.neckAt > 6000 && pnow - race.leadAt > 1500) { race.neckAt = pnow; say(`⚔️ ${nm(lead.id)} and ${nm(b.id)} are neck and neck!`); }
      if (!race.flags.half && lead.x > G.L / 2) { race.flags.half = true; say(`Halfway! ${nm(lead.id)} leads${b ? ' by ' + Math.max(0.1, lead.x - b.x).toFixed(1) + ' m' : ''}.`); }
      if (!race.flags.stretch && lead.x > G.L - 14) { race.flags.stretch = true; say(race.photo ? '🏁 Final stretch… this is going to be CLOSE!' : '🏁 Final stretch!', true); if (race.photo) BOX.sfx('drum'); }
    }
    // Live standings with ▲ ▼ when ducks pass each other.
    const nTop = Math.min(8, byX.length);
    for (let i = 0; i < nTop; i++) { const p = byX[i], was = race.rank[p.id]; if (was != null && was !== i && e > R.intro + 1500) race.moved[p.id] = { up: was > i, at: pnow }; }
    for (let i = 0; i < byX.length; i++) race.rank[byX[i].id] = i;
    const bw = 270, bx = W - bw - 16, by = 52, rh = 28;
    g.fillStyle = 'rgba(15,8,35,.72)'; rrect(g, bx, by, bw, 34 + nTop * rh, 12); g.fill();
    g.font = '700 15px Fredoka, sans-serif'; g.fillStyle = '#ffd23f'; g.fillText(R.final ? 'GRAND FINAL · LIVE' : 'LIVE STANDINGS', bx + 12, by + 22);
    for (let i = 0; i < nTop; i++) {
      const p = byX[i], d = race.ducks[p.id] || {}, yy = by + 48 + i * rh, mv = race.moved[p.id];
      if (i === 0) { g.fillStyle = 'rgba(255,210,63,.18)'; g.fillRect(bx + 4, yy - 19, bw - 8, rh - 2); }
      g.fillStyle = (art.PAL[d.color] || art.PAL.sunny)[0]; g.beginPath(); g.arc(bx + 34, yy - 6, 7, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#fff'; g.font = '700 15px Fredoka, sans-serif'; g.fillText(String(i + 1), bx + 10, yy);
      const fim = faceImg(farmerOf(p.id, d), 48);
      if (fim) g.drawImage(fim, bx + 44, yy - 21, 26, 26);
      g.font = '600 15px Fredoka, sans-serif'; g.fillText(`${d.avatar && !fim ? d.avatar + ' ' : ''}${(d.name || '').slice(0, 16)}${d.wild ? ' 🌿' : ''}`, bx + (fim ? 74 : 48), yy, bw - (fim ? 146 : 120));
      g.textAlign = 'right'; g.fillStyle = p.done ? '#ffd23f' : 'rgba(255,255,255,.7)'; g.font = '600 13px Fredoka, sans-serif';
      g.fillText(p.done ? (MEDAL[race.place[p.id].place - 1] || 'FIN') : e < R.intro ? '' : i === 0 ? 'leader' : lead.x - p.x < 0.05 ? 'level' : '-' + (lead.x - p.x).toFixed(1) + 'm', bx + bw - 26, yy);
      if (mv && pnow - mv.at < 1600) { g.fillStyle = mv.up ? '#5be37a' : '#ff6a5c'; g.fillText(mv.up ? '▲' : '▼', bx + bw - 8, yy); }
      g.textAlign = 'left';
    }
    // minimap with every duck
    const mx = 20, mw = W - bw - 70, my = 14;
    g.fillStyle = 'rgba(0,0,0,.45)'; rrect(g, mx - 6, my - 6, mw + 12, 30, 8); g.fill();
    for (const s of G.secs) { g.fillStyle = art.SEC_COLORS[s.type]; g.fillRect(mx + (s.a / G.L) * mw, my, ((s.b - s.a) / G.L) * mw, 18); }
    g.fillStyle = '#fff'; g.fillRect(mx + mw - 3, my - 3, 3, 24);
    for (let i = byX.length - 1; i >= 0; i--) { const p = byX[i], d = race.ducks[p.id] || {}; g.fillStyle = (art.PAL[d.color] || art.PAL.sunny)[0]; g.strokeStyle = 'rgba(0,0,0,.5)'; g.lineWidth = 1.5; g.beginPath(); g.arc(mx + Math.min(1, p.x / G.L) * mw, my + 9, p === lead ? 7 : 5, 0, Math.PI * 2); g.fill(); g.stroke(); }
    // the rest of the field, sped up once the winner is home
    if (e > R.intro && (e - R.intro) / 1000 > race.pace.tw + 0.3 && race.pace.k2 > race.pace.k * 1.6 && unfinished) { g.font = '700 20px Fredoka, sans-serif'; g.fillStyle = 'rgba(255,255,255,.85)'; g.textAlign = 'center'; g.fillText('⏩ the rest of the field comes home…', W / 2, 70); g.textAlign = 'left'; }
    // cinematic bars in slow motion
    if (race.rate < 0.9) { const k = (1 - race.rate) / 0.7, hb = H * 0.08 * k; g.fillStyle = '#000'; g.fillRect(0, 0, W, hb); g.fillRect(0, H - hb, W, hb); g.globalAlpha = k; g.fillStyle = '#ffd23f'; g.font = '800 28px Fredoka, sans-serif'; g.textAlign = 'center'; g.fillText('📸 PHOTO FINISH', W / 2, hb - 14 > 20 ? hb - 14 : 40); g.textAlign = 'left'; g.globalAlpha = 1; if (!race.flags.whoosh) { race.flags.whoosh = true; BOX.sfx('whoosh'); } }
    // commentary: the newest line big, two older ones above it
    const live = race.msgs.filter((m) => pnow - m.at < 5500).slice(-3);
    g.textAlign = 'center';
    live.forEach((m, i) => {
      const newest = i === live.length - 1, size = newest ? (m.big ? 34 : 28) : 20, yy = H - 40 - (live.length - 1 - i) * 40 - (newest ? 0 : 10);
      g.font = `700 ${size}px Fredoka, sans-serif`; const tw = g.measureText(m.text).width + 36;
      const fade = Math.min(1, (5500 - (pnow - m.at)) / 600); g.globalAlpha = (newest ? 1 : 0.7) * fade;
      g.fillStyle = newest ? 'rgba(20,10,40,.86)' : 'rgba(20,10,40,.6)'; rrect(g, W / 2 - tw / 2, yy - size - 8, tw, size + 18, 12); g.fill();
      g.fillStyle = newest && m.big ? '#ffd23f' : '#fff'; g.fillText(m.text, W / 2, yy);
    });
    g.globalAlpha = 1; g.textAlign = 'left';
    // winner banner and confetti
    if (race.banner && pnow - race.banner.at < 3800) {
      const a = Math.min(1, (pnow - race.banner.at) / 250), s = 0.8 + 0.2 * a;
      g.save(); g.translate(W / 2, H * 0.3); g.scale(s, s); g.globalAlpha = Math.min(1, (3800 - (pnow - race.banner.at)) / 500);
      g.textAlign = 'center'; g.font = '800 64px Fredoka, sans-serif'; g.lineWidth = 10; g.strokeStyle = 'rgba(40,20,6,.85)'; g.strokeText(race.banner.text, 0, 0); g.fillStyle = '#ffd23f'; g.fillText(race.banner.text, 0, 0);
      if (race.banner.sub) { g.font = '700 26px Fredoka, sans-serif'; g.lineWidth = 6; g.strokeText(race.banner.sub, 0, 44); g.fillStyle = '#fff'; g.fillText(race.banner.sub, 0, 44); }
      g.restore();
    }
    if (race.confetti.length) { for (const c of race.confetti) { c.y += c.vy * dt; c.x += c.vx * dt; c.r += dt * 6; g.fillStyle = c.c; g.save(); g.translate(c.x, c.y); g.rotate(c.r); g.fillRect(-5, -3, 10, 6); g.restore(); } race.confetti = race.confetti.filter((c) => c.y < H + 20); }
    // the intro: race name, favorites and the countdown
    if (e < R.intro) {
      g.fillStyle = R.theme === 'night' ? 'rgba(0,0,10,.55)' : 'rgba(10,5,30,.5)'; g.fillRect(0, 0, W, H); g.textAlign = 'center'; g.fillStyle = '#fff';
      g.font = '700 28px Fredoka, sans-serif'; g.fillText(`${R.themeName || ''} · race ${R.n}${R.final ? ' · DOUBLE POINTS' : ''}`, W / 2, H * 0.17);
      g.font = '800 60px Fredoka, sans-serif'; g.fillStyle = R.final ? '#ffd23f' : '#fff'; g.fillText((R.final ? '🏆 ' : '') + R.name, W / 2, H * 0.27);
      const fav = (R.favorites || []).filter((id) => race.ducks[id]);
      if (fav.length) {
        g.font = '700 22px Fredoka, sans-serif'; g.fillStyle = '#ffeccd'; g.fillText('THE FAVORITES', W / 2, H * 0.36);
        fav.forEach((id, i) => {
          const d = race.ducks[id], cx = W / 2 + (i - (fav.length - 1) / 2) * 220, fm = farmerOf(id, d);
          // the farmer stands behind their duck (their own character)
          const drew = hasChar(fm) && BOX.drawChar && BOX.drawChar(g, cx + 46, H * 0.47 + 26, fm, { scale: 1.45, t: now + i, facing: -0.6, game: 'ducks' });
          art.drawDuck(g, drew ? cx - 22 : cx, H * 0.47, 2.2, d.color, d.hat, now + i, 'stand', false, d.stage == null ? 2 : Math.max(0, d.stage));
          g.font = '700 20px Fredoka, sans-serif'; g.fillStyle = '#fff'; g.fillText(`${i + 1}. ${d.avatar && !drew ? d.avatar + ' ' : ''}${d.name}`, cx, H * 0.47 + 50);
        });
      }
      const left = Math.ceil((R.intro - e) / 1000);
      if (left <= 3) { g.font = '800 140px Fredoka, sans-serif'; g.fillStyle = '#ffd23f'; g.fillText(String(left), W / 2, H * 0.8); if (race.beep !== left) { race.beep = left; BOX.sfx('tick'); } }
      g.textAlign = 'left';
    } else if (!race.go) { race.go = true; BOX.sfx('start'); clip('quack', { vol: 0.24, delay: 0.2 }); say('QUACK! And they’re off!', true); }
  }

  // ---------- Duck Valley on the TV ----------
  function drawValley(g, W, H, now) {
    A().drawValley(g, W, H, tvw.farms, now, tvw.fxBy, tvw.born, tvw.weather);
    // now and then a duck on one of the farms quacks, softly, from its side of the valley
    const t = performance.now();
    if (!tvw.quackAt) tvw.quackAt = t + 12000;
    else if (t > tvw.quackAt) { tvw.quackAt = t + 22000 + Math.random() * 26000; if (tvw.farms.some((f) => f.stage >= 0)) clip('quack', { vol: 0.07 + Math.random() * 0.05, pan: Math.random() * 1.2 - 0.6, rate: 0.95 + Math.random() * 0.15 }); }
  }
  function spotlight(s) {
    const farms = s.farms.filter((f) => f.stage >= 0);
    if (!farms.length) return '<p class="muted">Eggs are about to hatch…</p>';
    if (Date.now() - tvw.spotAt > 7000) { tvw.spot = (tvw.spot + 1) % farms.length; tvw.spotAt = Date.now(); }
    const f = farms.slice().sort((a, b) => a.plot - b.plot)[tvw.spot % farms.length];
    const L = f.levels;
    return `<div class="dk-spot"><img src="${A().duckImg(f.color, f.hat, 'stand', f.stage)}" alt=""><div><b>${esc(f.name)}</b><div class="muted">${who(f)}${esc(f.owner)} · ${esc(f.stageName)} ${A().MOOD(f.mood)}</div>
      ${Object.entries(SK).map(([k, [ic]]) => `<div class="dk-mini"><span>${ic}</span>${bar(L[k] * 4)}<b>${L[k]}</b></div>`).join('')}
      ${f.perks && f.perks.length ? `<div class="dk-perkicons">${f.perks.map((k) => (PERK_ICON[k] || '')).join(' ')}</div>` : ''}${f.streak > 2 ? `<div>🔥 streak ×${f.streak}</div>` : ''}<div class="muted">${f.trophies.length ? '🏆×' + f.trophies.length + ' · ' : ''}${f.badges ? '🏅×' + f.badges + ' · ' : ''}${Object.values(f.buildings).reduce((a, b) => a + b, 0)} upgrades</div></div></div>`;
  }
  const duckPic = (d, hat, stage) => `<img src="${A().duckImg(d.color, hat || d.hat, 'stand', stage != null ? stage : d.stage == null ? 2 : Math.max(0, d.stage))}" alt="">`;

  // ---------- phone ----------
  let tab = 'train', shopCat = 'food';
  const petFx = [];
  const hero = { canvas: null, farm: null, raf: 0 };
  function heroCanvas() {
    if (!hero.canvas) {
      hero.canvas = document.createElement('canvas'); hero.canvas.className = 'dk-herocv';
      let lastDraw = 0;
      const step = (t = 0) => {
        const c = hero.canvas;
        // ~24 fps is plenty for the farm; pause entirely while a mini-game is open.
        if (t - lastDraw < 40 || document.querySelector('.dk-over') || document.hidden) { hero.raf = requestAnimationFrame(step); return; }
        lastDraw = t;
        if (document.body.contains(c) && hero.farm) {
          const W = c.clientWidth, H = c.clientHeight, dpr = Math.min(2, window.devicePixelRatio || 1);
          if (W < 40 || H < 40) { hero.raf = requestAnimationFrame(step); return; } // hidden or not laid out yet
          if (c.width !== Math.round(W * dpr) || c.height !== Math.round(H * dpr)) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); }
          const g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
          g.fillStyle = '#5fb04a'; g.fillRect(0, 0, W, H);
          A().drawFarm(g, { ...hero.farm, owner: '' }, -W * 0.03, -H * 0.03, W * 1.06, H * 1.06, performance.now() / 1000, petFx);
        }
        hero.raf = requestAnimationFrame(step);
      };
      step();
    }
    return hero.canvas;
  }
  let hatching = null, petted = false, sheet = null, questsOpen = false, lastPet = 0;
  // The farm picture with only what matters on it: name, stage, coins; energy and mood underneath.
  function heroHtml(v) {
    const d = v.duck, st = d.stage >= 0 ? v.stages[d.stage] : null;
    return `<div class="dk-hero"><div id="dk-hero-slot" data-keep></div>
      <div class="dk-hero-top"><span class="pill name">${esc(d.name)} <small>${st ? esc(st.label) : '🥚'}</small></span>${v.streak ? `<span class="pill streak">🔥 ×${v.streak}</span>` : ''}<span class="pill coins">🪙 ${d.coins}</span></div>
      ${petted ? '' : '<div class="dk-tap">👆 tap to pet</div>'}
      <div class="dk-hero-meters"><div title="Energy">⚡${bar(d.energy, d.energy < 20 ? 'low' : '')}</div><div title="Mood">${A().MOOD(d.mood)}${bar(d.mood, 'mood')}</div></div></div>`;
  }
  // The phone's live race card: your duck's own run, in step with the TV (the same playback
  // numbers), with what it is doing right now: jumping, crashing, swimming, climbing, flying.
  const liveRace = { key: null, start: 0, raf: 0, buzzed: -1 };
  const LIVE_EV = { gulp: '💦 Gulped some water!', dip: '🪽 Dipped down, flapping back up!', weak: '🐢 This is your weakest part…', trip: '💥 Crashed into a fence!', clip: '😬 Clipped a hurdle!', slip: '🪨 Slipped down the cliff!', skid: '🧊 Spun out on the ice!', boost: '⚡ Caught a boost!', short: '💡 Took the shortcut!', wrong: '↩️ Wrong turn! Doubling back…', think: '🤔 Which way…?' };
  function liveHtml(L) {
    let acc = 0; const segs = L.sections.map((s) => { const t = typeOf(s), len = (L.secLen || SEC_LEN)[t]; const h = `<span class="leg ${t}" style="left:${(acc / L.length) * 100}%;width:${(len / L.length) * 100}%">${SEC[t][0]}</span>`; acc += len; return h; }).join('');
    return `<div class="dk-live" id="dk-live"><div class="dk-livebar">${segs}<i class="dk-livedot" id="dk-livedot"></i></div><div class="dk-livetxt" id="dk-livetxt">Lining up…</div></div>`;
  }
  function startLive(L, endsIn, key, ctx) {
    if (liveRace.key !== key) { liveRace.key = key; liveRace.start = Date.now() + endsIn - (L.intro + L.run + L.outro); liveRace.buzzed = -1; }
    cancelAnimationFrame(liveRace.raf);
    const P = L.pace || { k: 1, tw: 1e9, k2: 1 }, secLen = L.secLen || SEC_LEN;
    let acc = 0; const bounds = L.sections.map((s) => { const t = typeOf(s), a = acc; acc += secLen[t]; return { t, v: s.v, a, b: acc }; });
    const tick = () => {
      const dot = document.getElementById('dk-livedot'), txt = document.getElementById('dk-livetxt');
      if (!dot || !txt) return;
      const e = (Date.now() - liveRace.start - L.intro) / 1000;
      const t = e <= 0 ? 0 : e <= P.tw ? e * P.k : P.tw * P.k + (e - P.tw) * P.k2;
      const i = t / L.sample, a = Math.floor(i), s = L.s;
      const x = a >= s.length - 1 ? s[s.length - 1] / 10 : (s[a] + (s[a + 1] - s[a]) * (i - a)) / 10;
      dot.style.left = Math.min(100, (x / L.length) * 100) + '%';
      let msg;
      if (e <= 0) msg = `Lining up… ${Math.max(1, Math.ceil(-e))}`;
      else if (t >= L.time) msg = `🏁 Finished! ${ord(L.place)} of ${L.of}`;
      else {
        let ev = null, evI = -1; L.ev.forEach((q, j) => { if (q[0] <= t && t - q[0] < (q[1] === 'wrong' ? 2.4 : 1.4) && LIVE_EV[q[1]]) { ev = q[1]; evI = j; } });
        if (ev) { msg = LIVE_EV[ev]; if ((ev === 'trip' || ev === 'slip' || ev === 'wrong') && liveRace.buzzed !== evI) { liveRace.buzzed = evI; ctx.vibrate(120); } }
        else {
          const B = bounds.find((q) => x < q.b) || bounds[bounds.length - 1];
          const hurdle = (L.hurdles || []).some((h) => Math.abs((h.x != null ? h.x : h) - x) < 2.5);
          msg = B.t === 'pond' ? '🌊 Swimming' : B.t === 'cliff' ? '🧗 Climbing the cliff' : B.t === 'gap' ? '🪽 Flying over the ravine' : B.t === 'maze' ? '🧠 Finding the way through the maze' : hurdle ? '🚧 Jumping the hurdles' : B.v === 'mud' ? '🟤 Slogging through the mud' : B.v === 'ice' ? '🧊 Running on ice' : '🏃 Running';
          if (L.ev.some((q) => q[1] === 'tired' && q[0] <= t)) msg += ' · 😮‍💨 tired';
        }
      }
      if (txt.textContent !== msg) txt.textContent = msg;
      liveRace.raf = requestAnimationFrame(tick);
    };
    tick();
  }
  // Which skill helps most for the next race: the course's biggest share against your level.
  function coachSkill(v, d) {
    const share = { run: 0, swim: 0, fly: 0, climb: 0, stamina: 0, smarts: 0 }; let tot = 0;
    const LEN = v.sections ? (t) => (v.sections[t] || { len: SEC_LEN[t] }).len : (t) => SEC_LEN[t];
    for (const s of v.course.sections) { const t = typeOf(s); share[SEC[t][2]] += LEN(t); tot += LEN(t); }
    for (const k in share) share[k] /= tot || 1;
    share.stamina = 0.1 + 0.025 * v.course.sections.length;
    let best = 'run', bs = -1;
    for (const k of Object.keys(SK)) { const sc = share[k] / (1 + d.levels[k]); if (sc > bs) { bs = sc; best = k; } }
    return { skill: best, share: Math.round(share[best] * 100) };
  }
  // One card, one obvious next step.
  function coachHtml(v, d) {
    const cheapest = v.trainCost;
    const spin = v.canSpin ? '<button class="dk-spinchip" data-spin>🎡<small>Free spin</small></button>' : '';
    const proj = v.projected && v.projected.of > 1 && v.projected.place ? `<span class="dk-proj">Projected ${ord(v.projected.place)} of ${v.projected.of}</span>` : '';
    let main;
    if (v.napLeft) main = `<div class="dk-coach-main nap"><span class="ic">😴</span><span><b>${esc(d.name)} is napping</b><small>Wakes up in <span class="dk-napleft">${Math.ceil(v.napLeft / 1000)}s</span> with +${v.napGain || 35} ⚡. Training opens then.</small></span></div>`;
    else if (v.hype) main = `<div class="dk-coach-main hype"><span class="ic">🏁</span><span><b>Race in ${timer(v.endsIn)}!</b><small>Last call: pick your tactic</small></span>${proj}</div><div class="dk-qtac">${Object.entries(v.tactics).map(([k, [ic, l]]) => `<button data-qtactic="${k}" class="${d.tactic === k ? 'on' : ''}">${ic} ${esc(l)}</button>`).join('')}</div>`;
    else if (d.energy < cheapest) {
      main = `<div class="dk-coach-main"><span class="ic">🥱</span><span><b>Your duck is tired</b><small>Feed it below, or it falls asleep for a nap by itself</small></span></div>`;
    } else {
      const c = coachSkill(v, d), [ic, label, , color] = SK[c.skill];
      const why = c.skill === 'stamina' ? 'Keeps your duck fast to the finish' : `${c.share}% of the next race · Lv ${d.levels[c.skill]}`;
      main = `<button class="dk-coach-go" data-coach-train="${c.skill}" style="--c:${color}"><span class="ic">${ic}</span><span><b>Train ${label}</b><small>${why}</small></span><span class="go">▶</span></button>${proj ? `<div class="dk-coach-sub">${proj}</div>` : ''}`;
    }
    return `<div class="dk-coach ${v.hype ? 'hype' : ''}"><div class="dk-coach-body">${main}</div>${spin}</div>`;
  }
  // Skill sheet: what the run is about, one Play button. After the run you may Risk it for double XP.
  function sheetHtml(v, d) {
    const k = sheet, [icon, label, game, color] = SK[k], best = typeof v.bests[k] === 'number' ? v.bests[k] : 0;
    return `<div class="dk-sheet-bg" data-close></div><div class="dk-sheet" style="--c:${color}">
      <div class="dk-sheet-head"><span class="big">${icon}</span><div><b>${label} · Lv ${d.levels[k]}${v.gene && v.gene.skill === k ? ' 🧬' : ''}</b><div class="muted">${game}</div></div><button class="link" data-close aria-label="Close">✕</button></div>
      <p class="dk-diffinfo">⭐ target ${v.target || 16}${best ? ` · best ${best}` : ''} · ⚡${v.trainCost} energy<br><small>After the run: 🎲 <b>Risk it</b> on one very hard round to double your XP… or keep it safe.</small></p>
      <button class="btn big green dk-play" data-play ${d.energy < v.trainCost ? 'disabled' : ''}>▶ Play</button>
      <p class="muted dk-streakline">${v.streak ? `🔥 Streak ×${v.streak}: hit ⭐ again for +${Math.min(6, v.streak + 1) * 5}% XP` : 'Hit the ⭐ target to start a streak (up to +30% XP).'}</p></div>`;
  }
  function perkModal(v) {
    return `<div class="dk-perks"><h2>🌱 Your duck grew up!</h2><p class="muted">Pick a perk. It stays for the whole season.</p>${v.perkChoice.map((p) => `<button class="dk-perk" data-perk="${p.key}"><span>${p.icon}</span><b>${esc(p.label)}</b><small>${esc(p.about)}</small></button>`).join('')}</div>`;
  }
  // Lucky Spin: a wheel drawn on top of the page (outside the re-rendered body).
  function spinWheel(v, ctx) {
    if (document.querySelector('.dk-wheel-ov')) return;
    const ov = document.createElement('div'); ov.className = 'dk-wheel-ov';
    const n = v.spinTable.length, seg = 360 / n;
    const cols = ['#ff4f9a', '#ffd23f', '#3ec1ff', '#2ee6a6', '#b388ff', '#ff8c42', '#7bc96f', '#f25f5c', '#c49a6c'];
    const grad = v.spinTable.map((_, i) => `${cols[i % cols.length]} ${i * seg}deg ${(i + 1) * seg}deg`).join(',');
    ov.innerHTML = `<div class="dk-wheel-box"><h2>🎡 Lucky Spin</h2><div class="dk-wheel-wrap"><div class="dk-pointer">▼</div><div class="dk-wheel" style="background:conic-gradient(${grad})">${v.spinTable.map((x, i) => `<span style="transform:rotate(${i * seg + seg / 2}deg) translateY(var(--r))">${x.icon}</span>`).join('')}</div></div><p class="dk-prize">Spinning…</p></div>`;
    document.body.appendChild(ov);
    ctx.sfx('shuffle');
    ctx.act({ op: 'spin' }).then((r) => {
      if (!r.ok) { ov.remove(); return; }
      const wheel = ov.querySelector('.dk-wheel');
      const to = 360 * 5 + (360 - (r.index * seg + seg / 2));
      requestAnimationFrame(() => { wheel.style.transform = `rotate(${to}deg)`; });
      setTimeout(() => { ov.querySelector('.dk-prize').innerHTML = `${r.icon} <b>${esc(r.prize)}</b><br><button class="btn big">Collect</button>`; ctx.sfx('win'); ctx.vibrate(80); ov.querySelector('button').onclick = () => ov.remove(); }, 3300);
    });
    ov.addEventListener('click', (e) => { if (e.target === ov && ov.querySelector('.dk-prize button')) ov.remove(); });
  }
  // ---------- the automatic nap ----------
  // A duck that runs out of energy falls asleep by itself (no button): a pop-up says so, with a
  // sleeping duck and a countdown until it wakes. It waits while a mini-game's result card is up,
  // can be closed (the coach card keeps counting down) and a toast says when the duck wakes up.
  const nap = { was: false, end: 0, total: 1, gain: 35, name: '', color: 'sunny', hat: 'none', stage: 2, pending: false, el: null, raf: 0, tick: 0 };
  function napSync(v, d, ctx) {
    const asleep = v.phase === 'training' && v.napLeft > 0;
    if (asleep) {
      nap.end = Date.now() + v.napLeft; nap.total = v.napTotal || 15000; nap.gain = v.napGain || 35;
      Object.assign(nap, { name: d.name, color: d.color, hat: d.hat, stage: Math.max(0, d.stage) });
      if (!nap.was) { nap.was = true; nap.pending = true; ctx.vibrate(80); }
      if (!nap.tick) nap.tick = setInterval(napTick, 250);
      napTick();
    } else if (nap.was) {
      nap.was = false; nap.pending = false; napClose();
      if (v.phase === 'training') { ctx.toast(`☀️ ${d.name} woke up! +${nap.gain} ⚡`); ctx.sfx('chime'); }
    }
    if (!asleep && nap.tick) { clearInterval(nap.tick); nap.tick = 0; }
  }
  function napTick() {
    const left = Math.max(0, nap.end - Date.now()), txt = left > 0 ? Math.ceil(left / 1000) + 's' : 'waking up…';
    for (const e of document.querySelectorAll('.dk-napleft')) if (e.textContent !== txt) e.textContent = txt;
    if (nap.pending && !document.querySelector('.dk-over')) { nap.pending = false; napOpen(); }
    if (nap.el) { const b = nap.el.querySelector('.dk-napbar i'); if (b) b.style.width = Math.round(100 * (1 - left / nap.total)) + '%'; }
  }
  function napOpen() {
    napClose();
    const ov = document.createElement('div'); ov.className = 'dk-napov';
    ov.innerHTML = `<div class="dk-napcard"><canvas width="520" height="300"></canvas><h2>😴 ${esc(nap.name)} is exhausted and needs a nap</h2>
      <p class="dk-napcount">Wakes up in <b class="dk-napleft">${Math.ceil(Math.max(0, nap.end - Date.now()) / 1000)}s</b></p><div class="dk-napbar"><i></i></div>
      <p class="muted">No training until it wakes up (+${nap.gain} ⚡). You can still feed it, pet it and shop.</p><button class="btn big">OK, let it sleep 💤</button></div>`;
    document.body.appendChild(ov); nap.el = ov;
    ov.querySelector('button').onclick = napClose;
    const cv = ov.querySelector('canvas'), g = cv.getContext('2d'), art = A();
    const draw = () => {
      if (!nap.el || !document.body.contains(cv)) return;
      const t = performance.now() / 1000, W = cv.width, H = cv.height;
      const sk = g.createLinearGradient(0, 0, 0, H); sk.addColorStop(0, '#2b2160'); sk.addColorStop(1, '#5a4a9a'); g.fillStyle = sk; g.fillRect(0, 0, W, H);
      g.fillStyle = '#fff'; for (let i = 0; i < 30; i++) { g.globalAlpha = 0.3 + 0.6 * Math.abs(Math.sin(t * 1.3 + i)); g.fillRect((i * 97) % W, (i * 41) % (H * 0.5), 2, 2); } g.globalAlpha = 1;
      g.fillStyle = '#fdf6d0'; g.beginPath(); g.arc(W * 0.83, H * 0.2, 26, 0, Math.PI * 2); g.fill(); g.fillStyle = '#2b2160'; g.beginPath(); g.arc(W * 0.83 + 11, H * 0.2 - 7, 23, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#4f8f3a'; g.fillRect(0, H * 0.78, W, H); g.fillStyle = '#c99a5b'; g.beginPath(); g.ellipse(W / 2, H * 0.8, 120, 30, 0, 0, Math.PI * 2); g.fill(); // the nest
      g.strokeStyle = '#a0753f'; g.lineWidth = 4; for (let i = 0; i < 9; i++) { g.beginPath(); g.arc(W / 2 - 100 + i * 25, H * 0.8 + 4, 18, Math.PI * 1.1, Math.PI * 1.9); g.stroke(); }
      const br = 1 + Math.sin(t * 2.2) * 0.04; // breathing
      g.save(); g.translate(W / 2, H * 0.72); g.scale(1, br); art.drawDuck(g, 0, 0, 3.2, nap.color, nap.hat, t, 'sleep', false, nap.stage); g.restore();
      art.drawIcon(g, 'zzz', W / 2 + 70, H * 0.36, 90, t);
      nap.raf = requestAnimationFrame(draw);
    };
    draw();
  }
  function napClose() { cancelAnimationFrame(nap.raf); if (nap.el) nap.el.remove(); nap.el = null; }
  // The race has started: the training page is closed until the podium is over.
  const lockLine = '<div class="dk-lock">🏁 Race in progress: training opens after the race</div>';

  function eventCard(v) {
    const e = v.event; if (!e) return '';
    return `<div class="card-box dk-event"><b>${{ fox: '🦊', gift: '🎁', trader: '🛒', storm: '🌧️', duckling: '🐣' }[e.kind]} ${esc(e.text)}</b> <span class="muted">${timer(e.endsIn)}</span><div class="pr-btns">${e.choices.map(([k, l]) => `<button class="btn" data-ev="${k}">${esc(l)}</button>`).join('')}</div></div>`;
  }
  const ring = (lvl, pct, color) => `<div class="dk-ring" style="background:conic-gradient(${color} ${pct}%, rgba(255,255,255,.12) 0)"><span>${lvl}</span></div>`;
  const shopItem = (icon, title, about, price, attrs, state = '') => `<button class="dk-card2 ${state}" ${attrs}><span class="ic">${icon}</span><b>${esc(title)}</b><small>${esc(about)}</small><span class="price">${price}</span></button>`;

  function pageTrain(v, d) {
    const needs = [...new Set(v.course.sections.map((s) => SEC[typeOf(s)][2]))];
    const done = (v.quests || []).filter((q) => q.done).length;
    const quests = v.quests && v.quests.length ? `<div class="card-box dk-quests ${questsOpen ? 'open' : ''}"><button class="dk-qhead" data-quests><b>📜 Quests ${done}/${v.quests.length}</b>${v.rival ? `<span class="muted">⚔️ ${esc(v.rival.name)}</span>` : ''}<span>${questsOpen ? '▲' : '▼'}</span></button>
      ${questsOpen ? v.quests.map((q) => `<div class="q ${q.done ? 'done' : ''}"><span>${q.done ? '✅' : '⬜'} ${esc(q.text)}</span><span class="muted">${q.done ? 'done' : q.have + '/' + q.n} · 🪙${q.reward}</span></div>`).join('') + (v.rival ? `<div class="q rival">⚔️ Beat <b>${esc(v.rival.name)}</b> <span class="muted">(${esc(v.rival.owner)})</span> next race for 🪙15</div>` : '') : ''}</div>` : '';
    const wk = v.weakest && v.weakest.skill;
    return `${coachHtml(v, d)}${weakHint(v.weakest, 'train')}${foodRow(v, d)}
      <div class="dk-skillgrid">${Object.entries(SK).map(([k, [icon, label, game, color]]) => { const p = d.progress[k], pct = p ? Math.round((p.have / p.need) * 100) : 100; return `<button class="dk-skill ${needs.includes(k) ? 'need' : ''} ${wk === k ? 'weak' : ''}" style="--c:${color}" data-sheet="${k}" ${v.napLeft ? 'disabled' : ''}>${ring(d.levels[k], pct, color)}<span class="t"><b>${icon} ${label}${v.gene && v.gene.skill === k ? ' 🧬' : ''}</b><small>${game}</small></span>${needs.includes(k) ? '<i class="needmark" title="On the next course">🏁</i>' : ''}</button>`; }).join('')}</div>
      ${quests}${sheet ? sheetHtml(v, d) : ''}`;
  }
  // The weakest skill (the server picks it: clearly behind the others): one short, friendly line.
  const WEAK_WHY = { run: 'Every track is slow going', swim: 'Your duck paddles slowly in every pond', fly: 'Your duck flaps and dips over every ravine', climb: 'Your duck slips on every climbing wall', stamina: 'Your duck runs out of steam at the end of every race', smarts: 'Your duck gets lost in every maze' };
  function weakHint(w, where) {
    if (!w || !SK[w.skill]) return '';
    const [ic, label] = SK[w.skill];
    return `<div class="dk-weakhint"><span class="ic">${ic}</span><span><b>${where === 'race' ? 'What slowed you down' : 'Your weakest skill'}: ${label} (Lv ${w.level})</b><small>${WEAK_WHY[w.skill]}. A duck needs every skill: train ${label}!</small></span></div>`;
  }
  // Food, right on the training page: three sizes with their price and how many are in the pantry.
  // A tap feeds one (from the pantry first, else it buys one); a full duck saves it for later.
  function foodRow(v, d) {
    const pan = v.pantry || {};
    return `<div class="dk-foodrow"><span class="lbl">🍽️<small>Food</small></span>${Object.entries(v.food).map(([k, f]) => { const n = pan[k] || 0, can = n > 0 || d.coins >= f.cost; return `<button class="dk-food ${n ? 'have' : ''}" data-feed="${k}" ${can ? '' : 'disabled'} aria-label="${esc(f.label)}: +${f.energy} energy, ${f.cost} coins${n ? ', ' + n + ' in the pantry' : ''}"><span class="fi">${f.icon}</span><span class="fn"><b>${esc(f.short || f.label)}</b><small>+${f.energy}⚡</small></span><span class="fp">🪙${f.cost}${n ? `<i>×${n}</i>` : ''}</span></button>`; }).join('')}</div>`;
  }
  function pageShop(v, d) {
    const cats = [['food', '🍎 Food'], ['farm', '🏡 Farm'], ['decor', '🌷 Decor'], ...(v.gear ? [['gear', '🎒 Gear']] : []), ['hats', '🎩 Hats']];
    let items = '';
    if (shopCat === 'food') items = Object.entries(v.food).map(([k, it]) => { const n = (v.pantry || {})[k] || 0; return shopItem(it.icon, it.label, it.about + (n ? ` · ${n} in the pantry` : ''), `🪙 ${it.cost}`, `data-feed="${k}" ${n || d.coins >= it.cost ? '' : 'disabled'}`); }).join('');
    if (shopCat === 'farm') items = Object.entries(v.buildings).map(([k, b]) => { const lvl = d.buildings[k], cost = v.buildCost[lvl]; return shopItem(b.icon, `${b.label} ${'★'.repeat(lvl)}${'☆'.repeat(3 - lvl)}`, b.about, lvl >= 3 ? 'MAX' : (lvl ? 'Upgrade ' : 'Build ') + '🪙' + cost, `data-build="${k}" ${lvl >= 3 || d.coins < cost ? 'disabled' : ''}`, lvl >= 3 ? 'owned' : ''); }).join('');
    if (shopCat === 'decor') items = Object.entries(v.decor).map(([k, [ic, label, cost]]) => shopItem(ic, label, 'Shows on your farm · +5 mood', d.decor.includes(k) ? 'Placed ✓' : '🪙 ' + cost, `data-decor="${k}" ${d.decor.includes(k) || d.coins < cost ? 'disabled' : ''}`, d.decor.includes(k) ? 'owned' : '')).join('');
    if (shopCat === 'gear' && v.gear) items = Object.entries(v.gear).map(([k, it]) => shopItem(it.icon, it.label, it.about, d.gear.includes(k) ? 'Packed ✓' : '🪙 ' + it.cost, `data-gear="${k}" ${d.gear.includes(k) || d.coins < it.cost ? 'disabled' : ''}`, d.gear.includes(k) ? 'owned' : '')).join('');
    if (shopCat === 'hats') items = v.hats.filter((h) => h !== 'none').map((h) => `<button class="dk-card2 hat ${d.hat === h ? 'owned' : ''}" data-hat="${h}"><img src="${A().duckImg(d.color, h, 'stand', Math.max(0, d.stage))}" alt=""><b>${HAT_NAME[h]}</b><span class="price">${d.hat === h ? 'Wearing' : d.hats.includes(h) ? 'Wear' : '🪙 ' + v.hatCost}</span></button>`).join('');
    return `<div class="dk-chips">${cats.map(([k, l]) => `<button class="${shopCat === k ? 'on' : ''}" data-cat="${k}">${l}</button>`).join('')}</div><div class="dk-shopgrid">${items}</div>`;
  }
  function pageRace(v, d) {
    const W = v.weather[v.course.weather], c = v.course;
    return `<div class="card-box dk-racecard theme-${c.theme}"><div class="muted">${c.leagueIcon || ''} ${esc(c.leagueName || '')} · race ${c.n} of ${v.races}${c.final ? ' · <b class="dk-x2">×2 points</b>' : ''}</div><h3>${esc(c.name)}</h3><p>Featuring: ${focus(c)}</p>
        <div class="dk-racemeta"><span>📍 ${esc(c.themeName || '')}</span><span>${W.icon} ${W.label}</span><span>⏱ ${timer(v.endsIn)}</span></div>
        ${course(c)}
        <details class="dk-notes"><summary>What’s on the course?</summary><p>${W.icon} ${esc(W.about)}</p>${[...new Set(c.sections.map((s) => s.v))].map((k) => `<p>${VAR_ICON[k] || ''} ${esc((v.variants || {})[k] || '')}</p>`).join('')}</details>
        ${road(v.ladder, c.n - 1)}
        ${v.projected && v.projected.of > 1 && v.projected.place ? `<div class="dk-projcard">📈 Projected <b>${ord(v.projected.place)}</b> of ${v.projected.of}${v.projected.place > 1 ? ' · train the 🏁 skills to climb' : ' · you’re the favorite!'}</div>` : ''}</div>
      <h3>Tactic</h3><div class="dk-tactics">${Object.entries(v.tactics).map(([k, [ic, l, about]]) => `<button data-tactic="${k}" class="${d.tactic === k ? 'on' : ''}"><span>${ic}</span><b>${l}</b><small>${esc(about)}</small></button>`).join('')}</div>
      ${v.gear ? `<div class="dk-line"><span>🎒 ${d.gear.length ? d.gear.map((g) => v.gear[g].icon + ' ' + esc(v.gear[g].label)).join(' · ') : 'No race gear packed'}</span><button class="link" data-goshop="gear">Shop →</button></div>` : ''}
      ${v.predictions ? `<h3>🔮 Predict the winner</h3><p class="muted">Winner pays 30 coins, top 3 pays 10.</p><select id="dk-predict" class="dk-select"><option value="">Pick a duck…</option>${v.rivals.map((r) => `<option value="${esc(r.id)}" ${d.predict === r.id ? 'selected' : ''}>${esc(r.duck)} (${esc(r.owner)})</option>`).join('')}</select>` : ''}
      ${v.trophies.length ? `<h3>🏆 Trophy shelf</h3><div class="dk-trophies">${v.trophies.map((t) => `<span title="${esc(v.leagues[t.league].label)}">${['🏆', '🥈', '🥉'][t.place - 1]}<small>${esc(v.leagues[t.league].label)}</small></span>`).join('')}</div>` : ''}`;
  }
  function pageDuck(v, d) {
    const total = Object.values(d.levels).reduce((a, b) => a + b, 0), nextSt = d.stage >= 0 ? v.stages[d.stage + 1] : null, curSt = v.stages[Math.max(0, d.stage)];
    const growPct = nextSt ? Math.round(((total - curSt.from) / (nextSt.from - curSt.from)) * 100) : 100;
    const icons = ['🐣', '🐥', '🦆', '👑'];
    return `<div class="card-box dk-grow"><div class="dk-stages">${v.stages.map((s, i) => `<span class="${i < d.stage ? 'done' : i === d.stage ? 'cur' : ''}"><b>${icons[i] || '🦆'}</b><small>${esc(s.label)}</small></span>`).join('<i></i>')}</div>
        ${nextSt ? `<div class="dk-statrow"><span>Growing</span>${bar(growPct)}<b>${total}/${nextSt.from}</b></div><p class="muted">${nextSt.from - total} more skill levels until it grows into a ${esc(nextSt.label.toLowerCase())} and learns a new perk.</p>` : '<p class="muted">Fully grown. A true champion!</p>'}
        <div class="dk-perklist">${v.perks.length ? v.perks.map((p) => `<span>${p.icon} <b>${esc(p.label)}</b> <small>${esc(p.about)}</small></span>`).join('') : '<span class="muted">No perks yet. You get one each time your duck grows up.</span>'}</div></div>
      <div class="card-box"><h3>Skills</h3>${Object.entries(SK).map(([k, [ic, label, , color]]) => `<div class="dk-statrow"><span>${ic} ${label}</span><div class="bar"><i style="width:${Math.min(100, d.levels[k] * 4)}%;background:${color}"></i></div><b>Lv ${d.levels[k]}</b></div>`).join('')}${v.gene ? `<p class="muted">🧬 ${esc(v.gene.label)}: ${esc(v.gene.about)} (+25% ${SK[v.gene.skill][1]} XP)</p>` : ''}</div>
      <div class="card-box"><label class="muted">Duck name</label><input id="dk-name" class="dk-select" maxlength="18" value="${esc(d.name)}"></div>
      <div class="card-box"><h3>Color</h3><div class="dk-swatches">${v.colors.map((c) => `<button data-color="${c}" class="${d.color === c ? 'on' : ''}"><img src="${A().duckImg(c, 'none', 'stand', Math.max(0, d.stage))}" alt="${c}"></button>`).join('')}</div></div>
      ${v.neighbors.length ? `<div class="card-box"><h3>🎁 Send a gift</h3><p class="muted">5 coins: their duck gets +15 energy and you both feel good.${v.giftIn ? ' Next gift in ' + timer(v.giftIn) : ''}</p><div class="dk-gifts">${v.neighbors.slice(0, 30).map((n) => `<button data-gift="${esc(n.id)}" ${v.giftIn || d.coins < 5 ? 'disabled' : ''}>${hasChar(n) ? who(n, 26) : '🎁 '}${esc(n.owner)}</button>`).join('')}</div></div>` : ''}
      <div class="card-box"><h3>Badges (${d.badges.length}/${Object.keys(v.badges).length})</h3><div class="dk-badges">${Object.entries(v.badges).map(([k, [ic, label, c]]) => `<span class="${d.badges.includes(k) ? 'got' : ''}" title="${esc(label)}">${ic}<small>${esc(label)}${c ? ' · ' + c + '🪙' : ''}</small></span>`).join('')}</div></div>`;
  }
  function eggPicker(v) {
    return `<div class="dk-eggs"><p class="dk-in">You’re in! 🎉 Your farm just appeared on the big screen.</p><h2>Choose your egg 🥚</h2><p class="muted">Every egg hatches into a duckling with a natural talent.</p>
      <div class="dk-eggrow">${v.eggs.map((e, i) => `<button class="dk-egg ${hatching === i ? 'hatching' : ''}" data-hatch="${i}" ${hatching != null ? 'disabled' : ''}><img src="${A().eggImg(e.color, e.spots)}" alt=""><b>${esc(e.label)}</b><small>${esc(e.about)}</small><span class="muted">${SK[e.skill][0]} +25% ${SK[e.skill][1]}</span></button>`).join('')}</div></div>`;
  }
  // Results on the phone: your place, the season, what's next.
  function resultsCard(v, d) {
    const l = d.last, nextL = v.ladder && v.ladder[v.race];
    return `<div class="card-box dk-myres ${l && l.place <= 3 ? 'podium' : ''}"><div class="dk-bigplace">${l ? (l.place <= 3 ? MEDAL[l.place - 1] : '#' + l.place) : '🏁'}</div><h3>${l ? `You finished ${ord(l.place)} of ${l.of}` : 'Race over'}</h3>
      ${l ? `<p class="dk-gain"><b>+${l.pts}</b> points · <b>+${l.coins}</b> 🪙${l.place <= 3 ? ' · a trophy for your farm!' : ''}</p><p class="muted">${l.trips ? '💫 Tripped ' + l.trips + '× · ' : ''}${l.slips ? '😱 Slipped ' + l.slips + '× · ' : ''}${l.shortcuts ? '💡 ' + l.shortcuts + ' shortcut' + (l.shortcuts === 1 ? '' : 's') + ' · ' : ''}${l.wrongs ? '↩️ ' + l.wrongs + ' wrong turn' + (l.wrongs === 1 ? '' : 's') + ' (train 🧠 Smarts) · ' : ''}${l.gulps ? '💦 Gulped water ' + l.gulps + '× · ' : ''}${l.dips ? '🪽 Dipped ' + l.dips + '× · ' : ''}${l.tired ? '😮‍💨 Ran out of stamina (train 💪 Stamina)' : '💪 Stamina held up'}</p>${weakHint(l.weak, 'race')}` : ''}
      ${v.rivalWon != null ? `<p>⚔️ Rival: ${v.rivalWon ? 'you beat them! +15 coins' : 'they beat you this time.'}</p>` : ''}${v.predictWon != null ? `<p>🔮 Prediction: ${v.predictWon ? '+' + v.predictWon + ' coins!' : 'no luck this time.'}</p>` : ''}</div>
      <div class="card-box dk-seasonline"><div><b>Season: ${ord(v.rank || 1)} of ${v.of}</b> · ${d.points} pts${v.leader ? `<div class="muted">${v.leader.points - d.points} behind ${esc(v.leader.duck)}</div>` : v.race ? '<div class="muted">You lead the valley! 👑</div>' : ''}</div>${nextL ? `<div class="dk-nextup">Next<br><b>${nextL.icon}</b></div>` : '<div class="dk-nextup">🏆<br>Finale!</div>'}</div>
      ${road(v.ladder, v.race)}`;
  }
  // The season recap when it's all over.
  function seasonCard(v, d) {
    const s = v.season || {}, won = (v.awards || []).filter((a) => a.id === (v.myId || ''));
    const stat = (ic, val, lbl) => `<div><b>${ic} ${val}</b><small>${lbl}</small></div>`;
    return `<div class="card-box dk-recap ${s.rank === 1 ? 'champ' : ''}"><img src="${A().duckImg(d.color, s.rank === 1 ? 'crown' : d.hat, 'stand', Math.max(0, d.stage))}" width="130" alt="">
      <div class="muted">Season over</div><h2>${s.rank === 1 ? '🏆 Champion of Duck Valley!' : `You finished ${ord(s.rank || v.rank)}`}</h2><p>${esc(d.name)} · ${esc(s.stage || '')} · ${s.points != null ? s.points : d.points} points</p>
      <div class="dk-recapgrid">${stat('🏁', (s.history || []).map((p) => (p <= 3 ? MEDAL[p - 1] : p)).join(' ') || '-', 'Race finishes')}${stat('🥇', s.wins || 0, 'Wins')}${stat('🏆', s.podiums || 0, 'Podiums')}${stat('🏋️', s.trained || 0, 'Training runs')}${stat('🎯', s.bestScore || 0, 'Best score')}${stat('⭐', s.level || 0, 'Total level')}${stat('🔥', s.bestStreak || 0, 'Best streak')}${stat('🏅', s.badges || 0, 'Badges')}</div>
      ${won.map((a) => `<p class="dk-award">${esc(a.title)}!</p>`).join('')}</div>`;
  }
  function practiceRow() { return `<div class="dk-practice"><span class="muted">🎮 Practice while you wait (no energy, no XP):</span><div>${Object.entries(SK).map(([k, [ic, label]]) => `<button data-practice="${k}" aria-label="Practice ${label}">${ic}</button>`).join('')}</div></div>`; }
  function practice(k, d) {
    const run = () => window.DUCK_MINI.play(GAME[k], 20, { ...d, stage: Math.max(0, d.stage) }, (score, show) => show({ ok: true, practice: true, score }), { speed: 0.8, target: 12, again: run });
    run();
  }

  // ---------- the game's own title screen (TV) ----------
  function titleScreen(el, { start, back, resume, code }) {
    el.innerHTML = `<div class="dk-title"><canvas id="dk-title-cv"></canvas>
      <div class="dk-title-card">
        <div class="dk-logo"><span class="a">Just</span><span class="b">Raise</span><span class="c">Ducks</span></div>
        <p class="dk-tagline">Hatch a duckling. Raise it on your farm. Race the whole valley.</p>
        ${resume ? `<button class="dk-go" id="dk-resume">▶ Continue valley ${esc(code || '')}</button><br>` : ''}<button class="dk-go ${resume ? 'alt' : ''}" id="dk-go">🥚 Start a new valley</button>
        <button class="dk-how-btn" id="dk-how-btn">How to play</button>
        <ol class="dk-how" id="dk-how" hidden>${BOX.games.ducks.how.map((h) => `<li>${esc(h)}</li>`).join('')}</ol>
        <p class="dk-fine">Open this on the TV. Everyone plays on their phone. 1–100 players.</p>
        <button class="dk-back" id="dk-back">◀ Back to JustGameBox</button>
      </div></div>`;
    el.querySelector('#dk-go').onclick = start;
    const rs = el.querySelector('#dk-resume'); if (rs) rs.onclick = resume;
    el.querySelector('#dk-back').onclick = back;
    el.querySelector('#dk-how-btn').onclick = () => { const h = el.querySelector('#dk-how'); h.hidden = !h.hidden; };
    const cv = el.querySelector('#dk-title-cv'), art = A();
    const parade = [['sunny', 'crown'], ['mallard', 'cap'], ['bubblegum', 'bow'], ['snow', 'tophat'], ['sky', 'party'], ['ember', 'viking'], ['mint', 'flower']];
    loop(cv, (g, W, H, t) => {
      const sky = g.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#5ec2ff'); sky.addColorStop(1, '#c9f0ff'); g.fillStyle = sky; g.fillRect(0, 0, W, H);
      g.fillStyle = '#ffe066'; g.beginPath(); g.arc(W * 0.82, H * 0.18, 60, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(255,224,102,.25)'; g.beginPath(); g.arc(W * 0.82, H * 0.18, 90 + Math.sin(t * 2) * 6, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(255,255,255,.9)';
      for (let i = 0; i < 6; i++) { const cx = ((i * 330 + t * 18) % (W + 300)) - 150, cy = 60 + (i % 3) * 55; g.beginPath(); g.arc(cx, cy, 30, 0, 7); g.arc(cx + 32, cy - 10, 26, 0, 7); g.arc(cx + 62, cy, 28, 0, 7); g.fill(); }
      const hill = (col, base, amp, f, off) => { g.fillStyle = col; g.beginPath(); g.moveTo(0, H); for (let x = 0; x <= W; x += 16) g.lineTo(x, base + Math.sin(x / f + off) * amp); g.lineTo(W, H); g.fill(); };
      hill('#8fd47e', H * 0.58, 30, 210, 1); hill('#6cc26a', H * 0.68, 22, 160, 3);
      g.fillStyle = '#3b9be8'; g.beginPath(); g.ellipse(W * 0.2, H * 0.84, W * 0.16, H * 0.07, 0, 0, 7); g.fill();
      g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = 3; g.beginPath(); g.ellipse(W * 0.2, H * 0.84, W * 0.1, H * 0.035, 0, 0.3 + Math.sin(t) * 0.2, 2.2); g.stroke();
      g.strokeStyle = '#3d8b37'; g.lineWidth = 4; for (let i = 0; i < 7; i++) { const rx = W * 0.05 + i * 14; g.beginPath(); g.moveTo(rx, H * 0.86); g.quadraticCurveTo(rx + 6, H * 0.8, rx + Math.sin(t + i) * 4, H * 0.74); g.stroke(); }
      art.drawDuck(g, W * 0.22 + Math.sin(t * 0.6) * W * 0.06, H * 0.83, 2, 'snow', 'none', t, 'swim', Math.cos(t * 0.6) < 0, 2);
      parade.forEach(([c, h], i) => { const x = ((t * 70 + i * 150) % (W + 300)) - 150; art.drawDuck(g, x, H * 0.92 - (i % 2) * 10, 1.8, c, h, t + i, 'run', false, i === 3 ? 0 : 2); });
      art.drawDuck(g, ((t * 120) % (W + 400)) - 200, H * 0.3 + Math.sin(t * 2) * 20, 1.5, 'lilac', 'shades', t, 'fly', false, 2);
      g.fillStyle = '#c99a5b'; g.beginPath(); g.ellipse(W * 0.86, H * 0.86, 48, 14, 0, 0, 7); g.fill();
      art.drawEgg(g, W * 0.86, H * 0.8, 2.2, '#f2c14e', '#c47f17', t, (Math.sin(t * 1.3) > 0.6) ? 1 : 0);
    }, 'titleRaf');
  }

  BOX.games.ducks = {
    // Soundtrack cue per phase (public/box/scores/<key>.js); the TV turns the last 10 s of 'think' tense.
    music: (s) => ({ lobby: 'lobby', training: 'think', race: 'play', results: 'reveal', over: 'finale' }[s.phase] || 'lobby'),
    standalone: true, title: titleScreen,
    name: 'JustRaiseDucks', icon: '🦆',
    about: 'Everyone gets a farm in Duck Valley. Hatch a duckling, raise it with phone mini-games, and race up the leagues on the big screen.',
    how: [
      'Join and a farm appears in Duck Valley on the big screen. Pick an egg: each duckling hatches with a natural talent.',
      'Train Run 🏃, Swim 🌊, Fly 🪽, Climb 🧗, Stamina 💪 and Smarts 🧠 with mini-games. Your duckling grows up as it levels.',
      'After a run you can 🎲 Risk it: one very hard round with a goal. Make it and your XP doubles; miss it and your duck falls over and keeps only half.',
      'Training costs energy. When your duck runs out it falls asleep by itself for a short nap, then it’s ready again. Food (seeds, corn or a feast bowl, right on the training page) tops it up.',
      'Spend coins in the shop: food, farm buildings, decorations, race gear and hats. It all shows on your farm.',
      'Every few minutes the valley races a themed obstacle course in one of 14 worlds (meadow, volcano, swamp, city rooftops, jungle, desert, sky islands, candy land, a haunted farm and more). Smart ducks find the shortcut through the maze. Training stops while the race is on.',
      'Climb from the Rookie Cup to the Grand Championship. Top 3 win trophies for your farm.',
      'Pick a tactic, predict the winner, finish quests, beat your rival, and cheer from your phone!',
    ],
    fx: { raceDone: 'cheer', levelUp: 'pop', win: 'win', farm: 'join', build: 'click', badge: 'chime', event: 'knock', pet: 'pop', hatch: 'flip', grow: 'chime', spin: 'shuffle', gift: 'chime', hype: 'drum', riskWin: 'chime' },
    onFx(f) {
      if (f.kind === 'cheer') {
        race.cheers = race.cheers || []; race.cheers.push({ id: f.who, at: performance.now() }); if (race.cheers.length > 60) race.cheers.shift();
        if (race.R && tvw.mode === 'race') clip('cheer', { vol: 0.12, gap: 3000 }); // the stands cheer along (a megaphone pops up over the duck)
        const n = race.cheers.filter((c) => c.id === f.who && performance.now() - c.at < 2000).length;
        if (race.R && n >= 5 && performance.now() - (race.cheerSaid || 0) > 5000) { race.cheerSaid = performance.now(); say(`📣 The crowd is roaring for ${nm(f.who)}!`); }
        return;
      }
      const w = f.who; if (!w) return;
      if (f.kind === 'farm') { tvw.born[w] = performance.now(); return; }
      (tvw.fxBy[w] = tvw.fxBy[w] || []).push({ kind: f.kind, at: performance.now(), item: f.item });
      if (tvw.fxBy[w].length > 4) tvw.fxBy[w].shift();
      // the feeder pops the food out and the duck pecks at it (soft clicks); a risked run that failed: a thud
      if (f.kind === 'eat' && tvw.mode !== 'race') for (let i = 0; i < 4; i++) clip('maze', { vol: 0.035, delay: 1.5 + i * 0.42, rate: 1.5 + Math.random() * 0.3, pan: 0, gap: 0 });
      if (f.kind === 'tumble' && tvw.mode !== 'race') clip('trip', { vol: 0.12, delay: 0.8 });
    },

    tv(el, s) {
      if (!s) return;
      document.body.classList.toggle('dk-racing', s.phase === 'race');
      if (s.phase === 'race') {
        if (tvw.mode !== 'race' || tvw.raceN !== s.lastRace.n) {
          tvw.mode = 'race'; tvw.raceN = s.lastRace.n;
          const L = (s.leagues || [])[s.lastRace.league] || {};
          el.innerHTML = `<div class="dk-racehead"><span class="dk-rname">${L.icon || '🏁'} ${esc(s.lastRace.name)}</span><span class="muted">📍 ${esc(s.lastRace.themeName || '')} · race ${s.lastRace.n} of ${s.races}</span>${weatherChip(s.lastRace, s.weather)}</div><canvas class="dk-race" id="dk-race"></canvas>`;
          setupRace(s, el.querySelector('#dk-race'));
        }
        return;
      }
      if (s.phase === 'results') {
        const key = 'results' + s.lastRace.n;
        if (tvw.mode === key) return; tvw.mode = key;
        const R = s.lastRace, top = R.results.slice(0, 8), F = { ...(R.wild || {}), ...Object.fromEntries(s.farms.map((d) => [d.id, d])) };
        const pod = [1, 0, 2].map((i) => top[i]).filter(Boolean);
        const mv = R.moves || {};
        const arrow = (id) => { const m = mv[id]; if (!m || R.n === 1) return ''; const k = m[0] - m[1]; return k > 0 ? `<i class="up">▲${k}</i>` : k < 0 ? `<i class="down">▼${-k}</i>` : '<i>–</i>'; };
        el.innerHTML = `<div class="dk-results"><div class="banner">🏁 ${esc(R.name)}: results</div>
          ${R.highlights && R.highlights.length ? `<div class="dk-high">${R.highlights.map((h) => `<span>${h.icon} ${esc(h.text)}</span>`).join('')}</div>` : ''}
          <div class="dk-podium">${pod.map((r) => { const d = F[r.id] || {}; return `<div class="pod p${r.place}">${duckPic(d)}<b>${esc(d.name)}</b><span class="muted">${d.wild ? '🌿 wild duck' : who(d) + esc(d.owner)}</span><div class="step">${MEDAL[r.place - 1]}${r.wild ? '' : ' +' + r.pts + ' pts'}</div></div>`; }).join('')}</div>
          <div class="dk-rescols"><div class="dk-res">${top.map((r) => { const d = F[r.id] || {}; return `<div class="row ${r.wild ? 'wild' : ''}"><span>${r.place}.</span><span>${esc(d.name)} <span class="muted">(${d.wild ? 'wild' : esc(d.owner)})</span></span><span class="muted">${r.time.toFixed(1)}s</span><b>${r.wild ? '—' : '+' + r.pts + ' pts'}</b></div>`; }).join('')}</div>
          <div class="dk-season panel"><h3>Season after race ${R.n} of ${s.races}</h3>${s.standings.slice(0, 8).map((x, i) => `<div class="row"><span>${i + 1}.</span><span>${who(x)}${esc(x.duck)}</span><b>${x.points}</b>${arrow(x.id)}</div>`).join('')}</div></div>
          <p class="muted" style="text-align:center">${s.race >= s.races ? '🏆 The season is over! The finale is next…' : 'Back to the farms in ' + timer(s.endsIn)}</p></div>`;
        return;
      }
      if (s.phase === 'over') {
        if (tvw.mode === 'over') return; tvw.mode = 'over';
        const st = s.standings, F = Object.fromEntries(s.farms.map((x) => [x.id, x]));
        const pod = [1, 0, 2].map((i) => st[i]).filter(Boolean);
        el.innerHTML = `<div class="final dk-finale"><div class="dk-confetti">${Array.from({ length: 40 }, (_, i) => `<i style="left:${(i * 37) % 100}%;animation-delay:${(i % 10) * 0.35}s;background:${['#ffd23f', '#ff4f9a', '#3ec1ff', '#2ee6a6', '#fff'][i % 5]}"></i>`).join('')}</div>
          <div class="muted">The season finale</div><h2>🏆 Champion of Duck Valley</h2>
          <div class="dk-podium season">${pod.map((x) => { const d = F[x.id] || {}, i = st.indexOf(x); return `<div class="pod p${i + 1}"><div class="dk-pair">${hasChar(x) && BOX.body ? BOX.body(x, i === 0 ? 150 : 120, { mood: i === 0 ? 'grin' : undefined, cls: 'dk-farmer' }) : ''}${duckPic(d, i === 0 ? 'crown' : null, i === 0 ? 3 : null)}</div><b>${esc(x.duck)}</b><span class="muted">${who(x)}${esc(x.owner)}</span><div class="step">${MEDAL[i]} ${x.points} pts${x.wins ? ' · ' + x.wins + ' win' + (x.wins === 1 ? '' : 's') : ''}</div></div>`; }).join('')}</div>
          <div class="dk-awards">${(s.awards || []).map((a) => `<div class="panel"><b>${esc(a.title)}</b><div>${esc(a.duck)}</div><div class="muted">${who(a)}${esc(a.owner)}</div></div>`).join('')}</div>
          ${st.length > 3 ? BOX.board(st.slice(3).map((x) => ({ name: x.duck + ' (' + x.owner + ')', points: x.points })), (r) => r.points, ' pts').replace(/<span class="n">(\d+)<\/span>/g, (m, n) => `<span class="n">${Number(n) + 3}</span>`) : ''}</div>`;
        return;
      }
      tvw.farms = s.farms; tvw.weather = s.course && s.course.weather;
      if (tvw.mode !== 'valley' || !el.querySelector('#dk-valley')) {
        tvw.mode = 'valley';
        for (const f of s.farms) if (!(f.id in tvw.born)) tvw.born[f.id] = 0;
        el.innerHTML = `<div class="dk-hudrow"><div id="dk-next"></div><div class="dk-count"><div class="muted">Race starts in</div><span id="dk-timer"></span></div></div>
          <div class="dk-wrap"><canvas class="dk-valley" id="dk-valley"></canvas><div id="dk-board" class="dk-board"></div><div id="dk-hype" class="dk-hype" hidden></div><aside class="dk-side"><div class="panel" id="dk-spot"></div><div class="panel"><h3>Standings</h3><div id="dk-stand"></div></div><div class="panel"><h3>Valley news</h3><div id="dk-news" class="dk-news"></div></div></aside></div>`;
        loop(el.querySelector('#dk-valley'), drawValley);
      }
      for (const f of s.farms) if (!(f.id in tvw.born)) tvw.born[f.id] = performance.now();
      el.querySelector('.dk-wrap').classList.toggle('lobby', s.phase === 'lobby');
      el.classList.toggle('dk-lobby', s.phase === 'lobby'); el.classList.add('dk-host');
      const hype = el.querySelector('#dk-hype'), board = el.querySelector('#dk-board');
      if (s.phase === 'lobby') {
        const hatched = s.farms.filter((f) => f.stage >= 0).length;
        el.querySelector('#dk-next').innerHTML = `<div class="muted">Welcome to</div><div class="dk-rname">🦆 Duck Valley</div><div class="muted">${s.farms.length ? `${s.farms.length} farm${s.farms.length === 1 ? '' : 's'} · ${hatched} hatched · scan the code to claim yours!` : 'Scan the code: every player gets a farm here.'}</div>`;
        el.querySelector('#dk-timer').innerHTML = '<span class="dk-wait">Waiting for the host…</span>';
        hype.hidden = true; board.innerHTML = '';
        return;
      }
      const c = s.course;
      el.querySelector('#dk-next').innerHTML = `<div class="muted">${c.leagueIcon || ''} ${esc(c.leagueName || '')} · race ${s.race + 1} of ${s.races} · 📍 ${esc(c.themeName || '')} · ${s.farms.length} farm${s.farms.length === 1 ? '' : 's'}</div><div class="dk-rname">${esc(c.name)}${c.final ? ' <span class="dk-x2">×2 points</span>' : ''} ${weatherChip(c, s.weather)}</div><div class="dk-nextfocus">Featuring ${focus(c)}</div>${course(c)}${road(s.ladder, s.race)}`;
      el.querySelector('#dk-timer').innerHTML = timer(s.endsIn);
      el.querySelector('#dk-timer').classList.toggle('hot', !!s.hype);
      el.querySelector('#dk-spot').innerHTML = spotlight(s);
      el.querySelector('#dk-stand').innerHTML = s.race ? BOX.board(s.standings.map((x) => ({ name: x.duck, points: x.points })), (r) => r.points, ' pts') : '<p class="muted">No races yet. Train hard!</p>';
      el.querySelector('#dk-news').innerHTML = s.ticker.slice().reverse().map((t) => `<div class="n-${t.kind}">${esc(t.text)}</div>`).join('');
      // the season so far (top 5), always in view on the big screen
      const strong = s.farms.filter((f) => f.stage >= 0).sort((a, b) => b.total - a.total).slice(0, 5);
      board.innerHTML = s.race ? `<div class="bh">🏆 Season · ${s.race}/${s.races}</div>${s.standings.slice(0, 5).map((x, i) => `<div class="r ${i === 0 ? 'lead' : ''}"><b>${i + 1}</b><span>${who(x)}${esc(x.duck)}</span><em>${x.points}</em></div>`).join('')}` : `<div class="bh">⭐ Strongest ducks</div>${strong.map((f, i) => `<div class="r ${i === 0 ? 'lead' : ''}"><b>${i + 1}</b><span>${who(f)}${esc(f.name)}</span><em>Lv ${f.total}</em></div>`).join('')}`;
      // race-day hype: the last 15 seconds
      hype.hidden = !s.hype;
      if (s.hype) {
        const F = Object.fromEntries(s.farms.map((x) => [x.id, x]));
        const fav = (s.favorites || []).map((id) => F[id]).filter(Boolean);
        hype.innerHTML = `<div class="hk">${c.final ? '🏆 GRAND FINAL' : '🏁 RACE DAY'}</div><div class="hn">${esc(c.name)} starts in ${timer(s.endsIn)}</div><div class="hfocus">${esc(c.themeName || '')} · ${esc(focusText(c))}</div>${fav.length ? `<div class="hf">${fav.map((f, i) => `<span>${duckPic(f)}<b>${i + 1}. ${who(f)}${esc(f.name)}</b></span>`).join('')}</div><div class="muted">The favorites · pick your tactic on your phone!</div>` : ''}`;
      }
    },

    phone(el, v, ctx, full) {
      // JustGold gear: this game's phone theme, a frame and badge over your screen (public/shared/gear.js).
      if (window.MT_GEAR) window.MT_GEAR.phoneTheme(el, full, 'ducks');
      if (!v) return;
      const put = (html) => BOX.morph(el, html);
      const d = v.duck;
      // The race starts: a mini-game in progress stops right away (its score so far still counts).
      if (v.phase !== 'training' && v.phase !== 'lobby' && window.DUCK_MINI && window.DUCK_MINI.active()) window.DUCK_MINI.stop(v.phase === 'race' ? '🏁 The race is starting!' : 'Training is closed.');
      napSync(v, d, ctx);
      hero.farm = { ...d, eggColor: v.eggs ? v.eggs[0].color : null };
      if (v.newBadge) { ctx.toast(`${v.badges[v.newBadge][0]} Badge: ${v.badges[v.newBadge][1]}! +${v.badges[v.newBadge][2]} coins`); ctx.vibrate(100); }
      if (v.eventMsg) ctx.toast(v.eventMsg);
      if (v.questDone) { ctx.toast('📜 Quest done: ' + v.questDone + '!'); ctx.sfx('chime'); }
      if (v.grew) { ctx.toast(`🌱 Your duck grew into a ${v.grew.toLowerCase()}!`); ctx.sfx('win'); ctx.vibrate(150); }
      const on = (sel, fn) => { for (const b of el.querySelectorAll(sel)) b.onclick = () => fn(b); };
      const mount = () => {
        const slot = el.querySelector('#dk-hero-slot'); if (slot && !slot.contains(heroCanvas())) slot.appendChild(heroCanvas());
        const h = el.querySelector('.dk-hero');
        if (h) h.onclick = async (e) => {
          if (e.target.closest('button')) return;
          const heart = () => { petFx.push({ kind: 'pet', at: performance.now() }); if (petFx.length > 4) petFx.shift(); ctx.sfx('pop'); ctx.vibrate(20); };
          // The duck only gets happier every few seconds; in between, a heart is all you get (no error).
          if (v.phase !== 'training' || Date.now() - lastPet < 8200) { heart(); return; }
          lastPet = Date.now(); heart();
          const r = await ctx.act({ op: 'pet' }); if (r.ok) petted = true;
        };
      };
      if (v.phase === 'over') {
        v.myId = full && full.me ? full.me.id : null;
        put(`${seasonCard(v, d)}${v.awards && v.awards.length ? `<div class="card-box">${v.awards.map((a) => `<div>${esc(a.title)}: <b>${esc(a.duck)}</b> (${esc(a.owner)})</div>`).join('')}</div>` : ''}<div class="card-box"><h3>Final standings</h3>${BOX.board(v.final.map((x) => ({ name: x.duck, points: x.points })), (r) => r.points, ' pts')}</div>`);
        return;
      }
      if (v.eggs) {
        put(eggPicker(v));
        for (const b of el.querySelectorAll('[data-hatch]')) b.onclick = () => { if (hatching != null) return; hatching = Number(b.dataset.hatch); b.classList.add('hatching'); ctx.sfx('flip'); ctx.vibrate(60); setTimeout(async () => { const r = await ctx.act({ op: 'hatch', pick: Number(b.dataset.hatch) }); hatching = null; if (r.ok) { ctx.toast('🐣 It hatched! Say hi to your duckling.'); ctx.sfx('win'); } }, 900); };
        return;
      }
      if (v.phase === 'lobby') {
        put(`${heroHtml(v)}<div class="card-box dk-lobbycard"><h3>🏡 Your farm is on the big screen!</h3><div class="dk-steps"><span><b>🏋️</b>Train skills with mini-games</span><span><b>🛒</b>Spend coins on your farm</span><span><b>🏁</b>Race the valley on the TV</span></div>${practiceRow()}<p class="muted">The game starts when the host presses Start.</p></div>
          <div class="card-box"><label class="muted">Name your duck</label><input id="dk-name" class="dk-select" maxlength="18" value="${esc(d.name)}"></div>
          <div class="card-box"><h3>Pick a color</h3><div class="dk-swatches">${v.colors.map((c) => `<button data-color="${c}" class="${d.color === c ? 'on' : ''}"><img src="${A().duckImg(c, d.hat, 'stand', Math.max(0, d.stage))}" alt="${c}"></button>`).join('')}</div></div>
          ${v.gene ? `<div class="card-box">🧬 <b>${esc(v.gene.label)}</b>: ${esc(v.gene.about)} <span class="muted">(+25% ${SK[v.gene.skill][1]} XP)</span></div>` : ''}`);
        mount();
        on('[data-color]', (b) => ctx.act({ op: 'style', color: b.dataset.color }));
        on('[data-practice]', (b) => practice(b.dataset.practice, d));
        const nm2 = el.querySelector('#dk-name'); if (nm2) { nm2.onchange = () => ctx.act({ op: 'style', name: nm2.value }); nm2.onkeydown = (e) => { if (e.key === 'Enter') nm2.blur(); }; }
        return;
      }
      if (v.phase === 'race') {
        put(`${heroHtml(v)}${lockLine}<div class="card-box dk-racenow"><div class="muted">${v.course.leagueIcon || '🏁'} ${esc(v.course.name)}</div><h3>🏁 They’re racing! Watch the big screen</h3>${v.live ? liveHtml(v.live) : ''}<p class="muted">${v.tactics[d.tactic][0]} ${v.tactics[d.tactic][1]}${d.gear.length && v.gear ? ' · ' + d.gear.map((g) => v.gear[g].icon).join(' ') : ''}</p><button class="btn big pink dk-cheer" id="dk-cheer">📣 CHEER!</button><p class="muted">Every tap shows above your duck on the big screen.</p></div>`);
        mount();
        if (v.live) startLive(v.live, v.endsIn, v.race, ctx);
        const ch = el.querySelector('#dk-cheer'); ch.onclick = () => { ctx.act({ op: 'cheer' }); ctx.vibrate(25); ch.classList.remove('bump'); void ch.offsetWidth; ch.classList.add('bump'); };
        return;
      }
      if (v.phase === 'results') { put(`${heroHtml(v)}${lockLine}${resultsCard(v, d)}`); mount(); return; }
      if (v.giftFrom) { ctx.toast(`🎁 ${v.giftFrom} sent your duck some seeds! +15 energy`); ctx.sfx('chime'); }
      if (v.perkChoice) {
        put(`${heroHtml(v)}${perkModal(v)}`); mount();
        for (const b of el.querySelectorAll('[data-perk]')) b.onclick = async () => { if ((await ctx.act({ op: 'perk', key: b.dataset.perk })).ok) { ctx.sfx('win'); ctx.toast('Perk learned!'); } };
        return;
      }
      const pages = { train: pageTrain, shop: pageShop, race: pageRace, duck: pageDuck };
      const c = v.course;
      const next = `<div class="dk-nextbar ${v.hype ? 'hype' : ''} ${c.final ? 'final' : ''}"><span>${c.final ? '🏆 Grand Final' : (c.leagueIcon || '🏁') + ' Race ' + c.n + '/' + v.races} <b class="dk-nt">${timer(v.endsIn)}</b></span><span class="muted">${v.race ? `${ord(v.rank || 1)} · ${d.points} pts` : 'Season starts'}</span></div>`;
      put(`<div class="dk-phone">${heroHtml(v)}${eventCard(v)}${next}<div class="dk-page">${(pages[tab] || pageTrain)(v, d)}</div>
        <nav class="dk-nav">${[['train', '🏋️', 'Train'], ['shop', '🛒', 'Shop'], ['race', '🏁', 'Race'], ['duck', '🦆', 'My duck']].map(([k, i, l]) => `<button class="${tab === k ? 'on' : ''}" data-tab="${k}"><span>${i}</span>${l}</button>`).join('')}</nav></div>`);
      mount();
      const me = { ...d, stage: Math.max(0, d.stage) }, send = (score, show) => ctx.act({ op: 'score', score }).then(show);
      // Risk it!: the server starts one very hard round with its goal (or says why not).
      const riskIt = async () => {
        const r = await ctx.act({ op: 'risk' });
        if (!r.ok) { ctx.toast(r.error || 'No risk this time: you keep your XP.'); return; }
        window.DUCK_MINI.play(r.game, r.seconds, me, send, { speed: r.speed, goal: r.goal, cancel: () => ctx.act({ op: 'cancel' }) });
      };
      const keep = () => ctx.act({ op: 'keep' });
      const play = async (stat) => {
        const r = await ctx.act({ op: 'train', stat });
        ctx.redraw();
        if (!r.ok) { if (r.error) ctx.toast(r.error); return; }
        window.DUCK_MINI.play(r.game, r.seconds, me, send, { speed: r.speed, assist: r.assist, first: r.first, target: r.target, best: r.best, again: () => play(stat), cancel: () => ctx.act({ op: 'cancel' }), riskIt, keep });
      };
      on('[data-ev]', (b) => ctx.act({ op: 'event', choice: b.dataset.ev }));
      on('[data-tab]', (b) => { if (tab === b.dataset.tab) return; tab = b.dataset.tab; sheet = null; ctx.redraw(); window.scrollTo(0, 0); });
      on('[data-cat]', (b) => { shopCat = b.dataset.cat; ctx.redraw(); });
      on('[data-goshop]', (b) => { tab = 'shop'; shopCat = b.dataset.goshop; ctx.redraw(); window.scrollTo(0, 0); });
      on('[data-sheet]', (b) => { sheet = b.dataset.sheet; ctx.redraw(); });
      on('[data-coach-train]', (b) => { sheet = b.dataset.coachTrain; ctx.redraw(); });
      on('[data-close]', () => { sheet = null; ctx.redraw(); });
      on('[data-play]', (b) => { if (!sheet) return; const stat = sheet; sheet = null; b.disabled = true; play(stat); });
      on('[data-spin]', () => spinWheel(v, ctx));
      on('[data-quests]', () => { questsOpen = !questsOpen; ctx.redraw(); });
      on('[data-gift]', async (b) => { if ((await ctx.act({ op: 'gift', to: b.dataset.gift })).ok) { ctx.toast('🎁 Gift sent!'); ctx.sfx('chime'); } });
      on('[data-feed]', async (b) => {
        const item = b.dataset.feed, r = await ctx.act({ op: 'feed', item }), f = v.food[item];
        if (!r.ok) { if (r.error) ctx.toast(r.error); return; }
        if (r.stored) { ctx.toast(`${f.icon} ${d.name} is full: saved for later (×${r.have} in the pantry)`); ctx.sfx('click'); return; }
        ctx.sfx('chime'); ctx.vibrate(15); petFx.push({ kind: 'eat', at: performance.now(), item }); if (petFx.length > 4) petFx.shift();
      });
      on('[data-build]', async (b) => { if ((await ctx.act({ op: 'build', item: b.dataset.build })).ok) { ctx.sfx('click'); petFx.push({ kind: 'build', at: performance.now() }); ctx.toast('Built! It’s on your farm 🏡'); } });
      on('[data-decor]', async (b) => { if ((await ctx.act({ op: 'decor', item: b.dataset.decor })).ok) { ctx.sfx('chime'); ctx.toast('Placed on your farm 🌷'); } });
      on('[data-gear]', async (b) => { if ((await ctx.act({ op: 'gear', item: b.dataset.gear })).ok) ctx.toast('Packed for race day 🎒'); });
      on('[data-tactic]', (b) => ctx.act({ op: 'tactic', tactic: b.dataset.tactic }));
      on('[data-qtactic]', (b) => { ctx.act({ op: 'tactic', tactic: b.dataset.qtactic }); ctx.vibrate(15); });
      on('[data-color]', (b) => ctx.act({ op: 'style', color: b.dataset.color }));
      on('[data-hat]', (b) => { const h = b.dataset.hat; if (d.hats.includes(h)) ctx.act({ op: 'style', hat: d.hat === h ? 'none' : h }); else if (confirm(`Buy the ${HAT_NAME[h]} for ${v.hatCost} coins?`)) ctx.act({ op: 'hat', hat: h }); });
      const pr = el.querySelector('#dk-predict'); if (pr) pr.onchange = () => { if (pr.value) ctx.act({ op: 'predict', id: pr.value }); };
      const nmi = el.querySelector('#dk-name'); if (nmi) { nmi.onchange = () => ctx.act({ op: 'style', name: nmi.value }); nmi.onkeydown = (e) => { if (e.key === 'Enter') nmi.blur(); }; }
    },
  };
})();
