'use strict';
// Start a new JustGameBox game with every piece the other games have (docs/game-kit.md):
//   node tools/new-game.js <key> "<Name>" [--type cards|guess|create|friends|action] [--icon 🎲]
// Creates the rules module, TV + phone screens with a designed lobby, its stylesheet, a title
// screen, an intro cutscene, a soundtrack (from scores/_template.js), a test file; and registers
// it in box/index.js, tv.html, play.html, the main menu, the "next game" lists and Party Mode.
// Then make it yours: rules, art, words, music. `node tools/test-box-kit.js` checks nothing is missing.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const args = process.argv.slice(2);
const key = args[0], name = args[1];
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const icon = opt('icon', '🎲');
// The category (public/categories.js): its main-menu shelf and its Party Mode group.
const CAT_ALIASES = { money: 'cards', casino: 'cards', bluff: 'friends', know: 'friends', vote: 'friends', creative: 'create', draw: 'create', battle: 'action', coop: 'action', story: 'action' };
const type = CAT_ALIASES[opt('type', 'create')] || opt('type', 'create');
const CAT_NAME = { cards: 'Cards', guess: 'Guessing', create: 'Creative', friends: 'Party', action: 'Action' }[type];
if (!CAT_NAME) { console.log('--type must be one of cards, guess, create, friends, action'); process.exit(1); }
if (!key || !/^[a-z][a-z0-9]{2,15}$/.test(key) || !name) {
  console.log('Usage: node tools/new-game.js <key> "<Name>" [--type cards|guess|create|friends|action] [--icon 🎲]\n  key: 3–16 lowercase letters/digits, e.g. trivia');
  process.exit(1);
}
const P = (p) => path.join(ROOT, p);
const exists = (p) => fs.existsSync(P(p));
if (exists(`box/games/${key}.js`)) { console.log(`A game called "${key}" already exists.`); process.exit(1); }
const write = (p, s) => { fs.mkdirSync(path.dirname(P(p)), { recursive: true }); fs.writeFileSync(P(p), s); console.log('  + ' + p); };
// Insert after an anchor (keeps the file's line endings).
function insert(p, anchor, text, { before = false } = {}) {
  let s = fs.readFileSync(P(p), 'utf8'); const crlf = s.includes('\r\n'); s = s.split('\r\n').join('\n');
  const i = s.indexOf(anchor); if (i < 0) throw new Error(`${p}: anchor not found: ${anchor}`);
  const at = before ? i : i + anchor.length;
  s = s.slice(0, at) + text + s.slice(at);
  if (crlf) s = s.split('\n').join('\r\n'); fs.writeFileSync(P(p), s); console.log('  ~ ' + p);
}
const js = (s) => JSON.stringify(s);

// ---------------- the files ----------------
write(`box/games/${key}.js`, `'use strict';
// ${name}: a JustGameBox game. Rules live here; the TV and phones get tv() and view(p).
// Starter rules (replace them): each round everyone taps a number 1–5; matching the room's most
// popular pick scores. Keep: results(), validation of every phone input, room.after timers.
const opt = (pairs) => pairs.map(([value, label]) => ({ value, label }));
const fields = [
  { key: 'rounds', label: 'Rounds', options: opt([[3, '3 rounds'], [5, '5 rounds'], [8, '8 rounds']]) },
  { key: 'seconds', label: 'Time to pick', options: opt([[15, '15 seconds'], [20, '20 seconds'], [30, '30 seconds']]) },
];
const defaults = { rounds: 5, seconds: 20 };
const REVEAL_MS = 6000;

class Game {
  constructor(room, s) { this.room = room; this.s = s; this.phase = 'pick'; this.round = 0; this.picks = new Map(); this.points = new Map(); this.endsAt = 0; this.timer = null; this.last = null; }
  setTimer(ms, fn) { this.room.cancel(this.timer); this.endsAt = this.room.now() + ms; this.timer = this.room.after(ms, fn); }
  start() { for (const p of this.room.list()) this.points.set(p.id, 0); this.nextRound(); }
  joined(p) { if (!this.points.has(p.id)) this.points.set(p.id, 0); }
  left() { this.maybeDone(); }
  nextRound() {
    if (this.round >= this.s.rounds) return this.end();
    this.round++; this.phase = 'pick'; this.picks = new Map(); this.room.fx('round');
    this.setTimer(this.s.seconds * 1000, () => this.reveal());
    for (const p of this.room.list()) if (p.bot) this.room.after(1500 + this.room.rng() * 4000, () => { if (this.phase === 'pick') { this.picks.set(p.id, 1 + Math.floor(this.room.rng() * 5)); this.maybeDone(); } });
  }
  maybeDone() { if (this.phase === 'pick' && this.room.list().filter((p) => p.bot || p.sockets > 0).every((p) => this.picks.has(p.id))) this.reveal(); }
  reveal() {
    if (this.phase !== 'pick') return;
    const tally = [0, 0, 0, 0, 0, 0]; for (const v of this.picks.values()) tally[v]++;
    const top = tally.indexOf(Math.max(...tally));
    for (const [id, v] of this.picks) if (v === top) this.points.set(id, (this.points.get(id) || 0) + 100);
    this.last = { top, tally: tally.slice(1) }; this.phase = 'reveal'; this.room.fx('reveal');
    this.setTimer(REVEAL_MS, () => this.nextRound());
  }
  end() { this.phase = 'over'; this.endsAt = 0; this.room.cancel(this.timer); this.room.fx('win'); }
  next() { if (this.phase === 'pick') this.reveal(); else if (this.phase === 'reveal') this.nextRound(); }
  standings() { return [...this.points].filter(([id]) => this.room.get(id)).map(([id, pts]) => ({ id, name: this.room.name(id), avatar: (this.room.get(id) || {}).avatar, points: pts })).sort((a, b) => b.points - a.points); }
  // TODO gear (JustGold shop): add this game's wearable slots (spot head/face/hand/chest/back, shapes from
  // public/wear-art.js) and items to public/shared/gear.js: players wear them automatically (BOX.face/body).
  // For an object slot (a skin, a card back…) copy
  // each player's gear into the per-player data, e.g. gear: require('../../public/shared/gear').gearSet(this.room.get(id), ${js(key)}),
  // and draw it on the TV with MT_GEAR.paint(${js(key)}, '<slot>', x.gear) (docs/game-kit.md, "Gear").
  // Party points: player ids best-first once the game is over.
  results() { return this.phase === 'over' ? this.standings().map((r) => r.id) : []; }
  act(p, m) {
    if (m.op === 'pick') {
      if (this.phase !== 'pick') return { ok: false, error: 'Not now.' };
      const v = Number(m.v); if (!Number.isInteger(v) || v < 1 || v > 5) return { ok: false, error: 'Pick 1 to 5.' };
      this.picks.set(p.id, v); this.maybeDone(); return { ok: true };
    }
    return { ok: false, error: 'Unknown move.' };
  }
  tv() { return { phase: this.phase, round: this.round, of: this.s.rounds, endsIn: this.endsAt ? Math.max(0, this.endsAt - this.room.now()) : 0, picked: this.picks.size, players: this.room.list().length, last: this.phase === 'reveal' ? this.last : null, standings: this.standings().slice(0, 10) }; }
  view(p) { return { ...this.tv(), mine: this.picks.get(p.id) || null, points: this.points.get(p.id) || 0 }; }
}

module.exports = {
  key: ${js(key)}, name: ${js(name)}, min: 2, best: [3, 10], fields, defaults, // best: the ideal crowd (Party Mode + the menu use it)
  show: { facts: false }, // intro cutscene before the game (public/box/intros/${key}.js)
  create: (room, settings) => new Game(room, settings),
};
`);

write(`public/box/games/${key}.js`, `'use strict';
// ${name}: TV and phone screens, the designed lobby, haptics. Make it look like its own game:
// see public/box/titles/${key}.js for its style, and the other games for the quality bar.
(function () {
  const { esc, timer } = BOX;
  const av = (r) => esc(r.avatar || '🙂');
  BOX.games[${js(key)}] = {
    name: ${js(name)}, icon: ${js(icon)},
    about: 'One line that sells the game.',
    how: ['Step one.', 'Step two.', 'How you win.'],
    fx: { start: 'start', round: 'pop', reveal: 'chime', win: 'win' },
    // The lobby, designed as part of the game. Keep #code, img#qr, #settings selects, #roster .chip, #add-bots, #start.
    lobbyTv(el, L) {
      if (!el.querySelector('.ng-lobby')) {
        el.innerHTML = \`<div class="ng-lobby"><h1 class="ng-title">${icon} \${esc(${js(name)})}</h1>
          <div class="ng-join"><img id="qr" alt="QR code to join"><div>Room code</div><div class="ng-code" id="code"></div></div>
          <div class="ng-settings" id="settings"></div><div class="ng-roster" id="roster"></div>
          <div class="ng-err" id="lobby-err"></div><button class="btn big" id="start">Start ▶</button>
          <div><button class="link" id="add-bots">+ 5 test bots</button> <button class="link" id="pick">🎮 Another game</button></div></div>\`;
        el.querySelector('#start').onclick = async () => { const r = await L.start(); el.querySelector('#lobby-err').textContent = r && r.ok ? '' : (r && r.error) || ''; };
        el.querySelector('#add-bots').onclick = () => L.bots(5);
        el.querySelector('#pick').onclick = () => L.pick();
      }
      el.querySelector('#code').textContent = L.code;
      const q = el.querySelector('#qr'); if (q.dataset.u !== L.qr) { q.src = L.qr; q.dataset.u = L.qr; }
      const set = el.querySelector('#settings'), sig = JSON.stringify(L.settings);
      if (set.dataset.sig !== sig && !set.contains(document.activeElement)) {
        set.dataset.sig = sig;
        set.innerHTML = L.fields.map((f) => \`<label>\${esc(f.label)}<select data-set="\${esc(f.key)}">\${f.options.map((o) => \`<option value="\${esc(String(o.value))}" \${String(L.settings[f.key]) === String(o.value) ? 'selected' : ''}>\${esc(o.label)}</option>\`).join('')}</select></label>\`).join('');
        for (const s of set.querySelectorAll('[data-set]')) s.onchange = () => L.set(s.dataset.set, s.value);
      }
      BOX.morph(el.querySelector('#roster'), L.players.map((p) => \`<span class="chip">\${av(p)} \${esc(p.name)}</span>\`).join('') || '<span class="muted">Scan the code to join!</span>');
    },
    tv(el, s) {
      if (!s) return;
      if (s.phase === 'over') return BOX.morph(el, \`<div class="ng-tv"><h2>🏆 \${esc((s.standings[0] || {}).name || '')} wins!</h2>\${BOX.board(s.standings, (r) => r.points, ' pts')}</div>\`);
      const body = s.phase === 'reveal' && s.last
        ? \`<h2>The room picked \${s.last.top}!</h2><div class="ng-bars">\${s.last.tally.map((n, i) => \`<div><b>\${i + 1}</b><i style="height:\${n * 20 + 6}px"></i>\${n}</div>\`).join('')}</div>\`
        : \`<h2>Pick a number on your phone!</h2><p>\${s.picked} of \${s.players} picked · \${timer(s.endsIn)}</p>\`;
      BOX.morph(el, \`<div class="ng-tv"><div class="ng-round">Round \${s.round} of \${s.of}</div>\${body}</div>\`);
    },
    phone(el, v, ctx) {
      if (!v) return;
      if (v.phase === 'over') return BOX.morph(el, \`<div class="card-box ng-ph"><h3>Game over!</h3><p>You scored \${v.points} points.</p></div>\`);
      if (v.phase === 'reveal') return BOX.morph(el, \`<div class="card-box ng-ph"><h3>\${v.mine === (v.last && v.last.top) ? '🎉 You matched the room!' : 'Not this time!'}</h3></div>\`);
      BOX.morph(el, \`<div class="card-box ng-ph"><h3>Pick a number</h3><div class="ng-picks">\${[1, 2, 3, 4, 5].map((n) => \`<button class="btn \${v.mine === n ? 'green' : ''}" data-n="\${n}">\${n}</button>\`).join('')}</div><p class="muted">\${timer(v.endsIn)}</p></div>\`);
      for (const b of el.querySelectorAll('[data-n]')) b.onclick = async () => { const r = await ctx.act({ op: 'pick', v: Number(b.dataset.n) }); if (r.ok) ctx.haptic('select'); };
    },
  };
})();
`);

write(`public/box/games/${key}.css`, `/* ${name}: its own look (TV body.g-${key}, phone body.g-${key}). Match its title screen. */
.ng-lobby { display: grid; gap: 14px; justify-items: center; padding: 24px; text-align: center; }
.ng-title { font-size: 64px; margin: 0; }
.ng-join img { width: 220px; background: #fff; padding: 8px; border-radius: 12px; }
.ng-code { font-size: 64px; font-weight: 700; letter-spacing: 0.15em; color: var(--yellow); }
.ng-settings { display: flex; gap: 12px; flex-wrap: wrap; justify-content: center; }
.ng-settings label { display: flex; flex-direction: column; gap: 4px; }
.ng-roster { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; }
.ng-tv { text-align: center; padding: 30px; } .ng-tv h2 { font-size: 56px; }
.ng-round { font-size: 22px; color: var(--muted); }
.ng-bars { display: flex; gap: 24px; justify-content: center; align-items: flex-end; font-size: 28px; }
.ng-bars i { display: block; width: 60px; background: var(--yellow); border-radius: 8px 8px 0 0; margin: 6px auto; }
.ng-ph { text-align: center; } .ng-picks { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin: 12px 0; }
.ng-picks .btn { font-size: 28px; padding: 14px 0; }
`);

write(`public/box/titles/${key}.js`, `'use strict';
// ${name} title screen (format: public/box/title.js). Draw a scene that sets the game's style.
(function () {
  BOX.titles[${js(key)}] = {
    logo: ${js(name)}, tagline: 'One line that sells the game.', start: '▶ Start a room', meta: '2–100 players · 10–20 min',
    font: "'Lilita One', sans-serif",
    theme: { card: 'rgba(20, 10, 48, 0.84)', button: '#ffd23f', buttonInk: '#2a1650', border: '#ff4f9a' },
    init(W, H) { return { dots: Array.from({ length: 40 }, () => ({ x: Math.random() * W, y: Math.random() * H, r: 4 + Math.random() * 10, v: 10 + Math.random() * 30 })) }; },
    draw(g, W, H, t, S) {
      const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#2a0b4d'); bg.addColorStop(1, '#12052a'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
      g.font = '40px serif'; g.textAlign = 'center';
      for (const d of S.dots) { d.y -= d.v / 60; if (d.y < -20) d.y = H + 20; g.globalAlpha = 0.5; g.fillText(${js(icon)}, d.x, d.y); }
      g.globalAlpha = 1;
    },
  };
})();
`);

write(`public/box/intros/${key}.js`, `'use strict';
// ${name} intro cutscene (format: the API comment at the top of public/box/show.js).
(function () {
  BOX.intros = BOX.intros || {};
  BOX.intros[${js(key)}] = {
    theme: { accent: '#ffd23f', accent2: '#ff4f9a', accent3: '#3ee6ff' },
    host: null, // or { name, voice, look } for a host with lines
    lines: { roll: 'Here’s tonight’s cast!', play: 'Let’s play {title}!' },
    stage(g) { g.fillStyle = '#1b1240'; g.fillRect(-600, -300, 3120, 1700); g.font = '220px serif'; g.textAlign = 'center'; g.fillText(${js(icon)}, 960, 620); },
  };
})();
`);

// Main-menu art: a starter picture to replace with a real illustration (docs/game-kit.md, "Tile art").
write(`public/art/tiles/${key}.svg`, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 240" preserveAspectRatio="xMidYMid slice">
  <!-- STARTER ART for ${name}: replace with an original illustration (no text), subject inside x 90-310, y 55-185. -->
  <defs><radialGradient id="${key}-bg" cx="50%" cy="55%" r="70%"><stop offset="0" stop-color="#8b5cff"/><stop offset="1" stop-color="#1b1030"/></radialGradient></defs>
  <rect width="400" height="240" fill="url(#${key}-bg)"/>
  <circle cx="200" cy="120" r="58" fill="#ffd23f" stroke="#1b1030" stroke-width="5"/>
  <circle cx="182" cy="104" r="16" fill="#fff" opacity="0.5"/>
</svg>
`);
if (exists('public/box/scores/_template.js')) write(`public/box/scores/${key}.js`, fs.readFileSync(P('public/box/scores/_template.js'), 'utf8').split('__KEY__').join(key));

write(`tools/test-box-${key}.js`, `'use strict';
// ${name} rules: played to the end by bots on a virtual clock.  node tools/test-box-${key}.js
const assert = require('node:assert/strict');
const { VirtualClock } = require('../clock');
const { BoxRoom } = require('../box/room');
const def = require('../box/games/${key}');
let passed = 0;
const test = (n, fn) => { fn(); passed++; console.log('  ✓ ' + n); };
test('bots play a whole game; results() lists everyone best-first', () => {
  const clock = new VirtualClock(), room = new BoxRoom('TEST', def, { clock, seed: 1 });
  room.addBots(6); assert(room.start().ok);
  let i = 0; while (room.game.phase !== 'over' && clock.step()) if (++i > 100000) throw new Error('never ended');
  assert.equal(room.game.results().length, 6);
});
test('phone input is validated', () => {
  const room = new BoxRoom('TEST', def, { clock: new VirtualClock() }); const p = room.join('Ana').player; room.addBots(2); room.start();
  for (const bad of [{ op: 'pick', v: 9 }, { op: 'pick', v: 'x' }, { op: 'nope' }, {}]) assert.equal(room.act(p, bad).ok, false);
});
console.log(\`\\n\${passed} ${name} tests passed.\`);
`);

// ---------------- registration ----------------
insert('box/index.js', "  zombie: require('./games/zombie'),", `\n  ${key}: require('./games/${key}'),`);
insert('public/box/tv.html', '  <script src="/box/titles/zombie.js"></script>', `\n  <script src="/box/titles/${key}.js"></script>`);
insert('public/box/tv.html', '  <script src="/box/games/zombie.js"></script>', `\n  <script src="/box/games/${key}.js"></script>`);
insert('public/box/tv.html', '  <link rel="stylesheet" href="/box/games/zombie.css">', `\n  <link rel="stylesheet" href="/box/games/${key}.css">`);
insert('public/box/play.html', '  <script src="/box/games/zombie.js"></script>', `\n  <script src="/box/games/${key}.js"></script>`);
insert('public/box/play.html', '  <link rel="stylesheet" href="/box/games/zombie.css">', `\n  <link rel="stylesheet" href="/box/games/${key}.css">`);
insert('public/box/tv.js', "'funny', 'zombie',", ` '${key}',`);
insert('public/box/play.js', "'funny', 'zombie',", ` '${key}',`);
insert('public/hub.html', '      <a class="tile live zombie"', `      <a class="tile live ${key}" href="/box/tv?game=${key}" data-game="${key}" data-best="3-10" data-type="${type}">
        <div class="art" aria-hidden="true"><img class="art-img" src="/art/tiles/${key}.svg" alt="" onerror="this.remove()"><span class="icon">${icon}</span></div>
        <div class="info"><h2>${name}</h2><p>One line that sells the game.</p>
          <div class="meta"><span>👥 2–100 · best 3–10</span><span>⏱ 10–20 min</span><span>${icon} ${CAT_NAME}</span></div></div>
      </a>\n`, { before: true });
// Party Mode picks the game up from its tile (data-type); FALLBACK below is only its name card.
insert('public/party/party.js', "    zombie: ['🧟', 'Zombie Survival', 2, 100, 20],", ` ${key}: [${js(icon)}, ${js(name)}, 2, 100, 15],`);
const pkg = JSON.parse(fs.readFileSync(P('package.json'), 'utf8'));
pkg.scripts.test = pkg.scripts.test.replace('node tools/test-box-party.js', `node tools/test-box-${key}.js && node tools/test-box-party.js`);
fs.writeFileSync(P('package.json'), JSON.stringify(pkg, null, 2) + '\n'); console.log('  ~ package.json');

console.log(`\n${name} is set up. Next: node tools/test-box-${key}.js && node tools/test-box-kit.js, restart the server,\nthen design it (docs/game-kit.md lists everything a game needs).`);
