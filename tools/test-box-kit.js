'use strict';
// The JustGameBox GAME KIT check: every small game must have every piece the others have
// (see docs/game-kit.md). Adding a game without one of them fails this test.
//   node tools/test-box-kit.js
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { VirtualClock } = require('../clock');
const { BoxRoom } = require('../box/room');
const { GAMES } = require('../box');

const ROOT = path.join(__dirname, '..');
const read = (p) => { try { return fs.readFileSync(path.join(ROOT, p), 'utf8'); } catch { return null; } };
const BIG = new Set(['ducks', 'kingdoms']); // big games have their own pages and their own pattern
const tvHtml = read('public/box/tv.html'), playHtml = read('public/box/play.html'), hub = read('public/hub.html');
const tvJs = read('public/box/tv.js'), playJs = read('public/box/play.js'), party = read('public/party/party.js');
const hasScores = fs.existsSync(path.join(ROOT, 'public/box/scores'));

let passed = 0, failed = 0;
const problems = [];
function check(key, what, ok) { if (ok) passed++; else { failed++; problems.push(`${key}: ${what}`); } }

for (const [key, def] of Object.entries(GAMES)) {
  if (BIG.has(key)) continue;
  // ---- the rules module ----
  for (const f of ['key', 'name', 'min', 'fields', 'defaults', 'create']) check(key, `module exports ${f}`, def[f] != null);
  check(key, 'module key matches its registry name', def.key === key);
  check(key, 'has an intro cutscene (show flag: true for game shows, { facts: false } for the rest)', !!def.show);
  let game = null;
  try { const room = new BoxRoom('KIT', def, { clock: new VirtualClock(), seed: 1 }); room.addBots(Math.max(3, def.min)); game = def.create(room, { ...def.defaults }); } catch (e) { check(key, 'creates a game: ' + e.message, false); }
  if (game) {
    check(key, 'game.results() for party points', typeof game.results === 'function');
    for (const m of ['start', 'act', 'tv', 'view']) check(key, `game.${m}()`, typeof game[m] === 'function');
  }
  // ---- the screens ----
  const client = read(`public/box/games/${key}.js`) || '';
  check(key, 'client file public/box/games/<key>.js', !!client);
  check(key, 'registers BOX.games.<key>', new RegExp(`BOX\\.games\\.${key}\\s*=|BOX\\.games\\[['"]${key}['"]\\]\\s*=`).test(client));
  check(key, 'TV renderer tv()', /\btv\s*[:(]/.test(client));
  check(key, 'phone renderer phone()', /\bphone\s*[:(]/.test(client));
  check(key, 'designed lobby: lobbyTv()', /lobbyTv/.test(client));
  check(key, 'phone screens update in place (BOX.morph)', /BOX\.morph|morph\(/.test(client));
  check(key, 'haptics at key moments (ctx.haptic / ctx.vibrate)', /\.haptic\(|\.vibrate\(/.test(client));
  check(key, 'how-to-play text (how: [...])', /\bhow\s*:\s*\[/.test(client));
  check(key, 'own stylesheet public/box/games/<key>.css', read(`public/box/games/${key}.css`) != null);
  // ---- title screen and intro ----
  check(key, 'title screen public/box/titles/<key>.js registers BOX.titles.<key>', new RegExp(`BOX\\.titles\\.${key}\\b|titles\\[['"]${key}['"]\\]`).test(read(`public/box/titles/${key}.js`) || ''));
  check(key, 'intro cutscene public/box/intros/<key>.js', /BOX\.intros|intros\s*\[|intros\./.test(read(`public/box/intros/${key}.js`) || ''));
  // ---- wiring ----
  check(key, 'TV page loads the game script', tvHtml.includes(`/box/games/${key}.js`));
  check(key, 'TV page loads the game stylesheet', tvHtml.includes(`/box/games/${key}.css`));
  check(key, 'TV page loads the title screen', tvHtml.includes(`/box/titles/${key}.js`));
  check(key, 'phone page loads the game script', playHtml.includes(`/box/games/${key}.js`));
  check(key, 'phone page loads the game stylesheet', playHtml.includes(`/box/games/${key}.css`));
  check(key, 'main menu tile (data-game)', hub.includes(`data-game="${key}"`));
  // The ideal crowd: in the module (best: [lo, hi]) and on the tile (data-best), and they agree.
  check(key, 'ideal player count best: [lo, hi] in the module', Array.isArray(def.best) && def.best.length === 2 && def.best[0] >= def.min && def.best[0] <= def.best[1]);
  check(key, 'main menu tile data-best matches the module', Array.isArray(def.best) && hub.includes(`data-game="${key}" data-best="${def.best[0]}-${def.best[1]}"`));
  check(key, 'in the "Pick the next game" lists (TV and phone)', tvJs.includes(`'${key}'`) && playJs.includes(`'${key}'`));
  check(key, 'in Party Mode (public/party/party.js)', party.includes(`'${key}'`));
  if (hasScores) check(key, 'soundtrack public/box/scores/<key>.js', read(`public/box/scores/${key}.js`) != null);
  // ---- unlockables ----
  check(key, 'a tile marked data-lock belongs to a locked game (and the other way round)', hub.includes(`data-lock="${key}"`) === !!def.locked);
  if (def.locked) {
    check(key, 'locked games have an unlock hint (locked.how)', !!def.locked.how);
    check(key, 'locked games are listed in public/unlocks.js', (read('public/unlocks.js') || '').includes(`${key}:`));
    check(key, 'locked games have an unlock rule in box/room.js', /UNLOCK_RULES/.test(read('box/room.js')) && (read('box/room.js') || '').includes(`${key}:`));
  }
}

if (problems.length) { console.log('\nMissing game-kit pieces:\n  ' + problems.join('\n  ')); }
assert.equal(failed, 0, `${failed} game-kit pieces missing (see docs/game-kit.md)`);
console.log(`\nGame kit: all ${passed} checks passed for ${Object.keys(GAMES).filter((k) => !BIG.has(k)).length} games.`);
