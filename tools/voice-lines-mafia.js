'use strict';
// Every line the JustMafia narrator can SAY, per world voice (used by tools/voice-gen.js).
//
// The narrator's templates (narrator.js, theme narration in public/shared/theme-text.js) and the
// cutscene captions (public/scenes.js) are turned into their spoken form by
// public/shared/narration-say.js (no player names, no numbers), plus one "They were the X." line
// per role and world. Each world's narrator voice says them.
// collect() -> [{ g: 'mafia-<voice>', t: spoken text, V: voice spec, from }]
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const narrator = require('../narrator');
const SAY = require('../public/shared/narration-say');
const T = require('../public/shared/themes');
const R = require('../public/shared/roles');

const { SURPRISES } = require('../rules/events');

const SKIP_THEMES = new Set([]); // themes that are not voiced (none)
// Fixed spoken lines (they must match the `say` text in public/host.js and rules/afterlife.js).
const EXTRA = ['A cold mist rolls over the ballot box. Today, nobody will see who voted for whom.', 'This is how loud I will be.', 'Welcome to town. Night is falling. Trust no one.'];

function captions() {
  const w = {};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'public', 'scenes.js'), 'utf8'), { window: w });
  const out = new Set();
  (function walk(x) {
    if (Array.isArray(x)) {
      if (typeof x[1] === 'string' && /caption/i.test(x[1]) && x[2] && typeof x[2] === 'object') {
        const a = x[2];
        [].concat(a.lines || [], a.text || []).forEach((s) => out.add(s));
        (a.beats || []).forEach((b) => [].concat(b[1]).forEach((s) => out.add(s)));
      }
      x.forEach(walk);
    } else if (x && typeof x === 'object') Object.values(x).forEach(walk);
  })(w.MT_SCENES);
  return [...out];
}

// The same phrase as game.js rolePhrase().
function rolePhrase(theme, role) {
  const r = R.ROLES[role];
  if (role === 'mafia') return `a member of ${T.teamName(theme, 'mafia', 'the Mafia')}`;
  if (r.team === 'town' && role === 'villager') return `a ${T.roleName(theme, 'villager', 'Villager')}`;
  const name = T.roleName(theme, role, r.name);
  return /^the /i.test(name) ? name : `the ${name}`;
}

function collect() {
  const keys = new Set();
  for (const st of narrator.STYLES) Object.keys(narrator.LINES[st]).forEach((k) => keys.add(k));
  for (const th of Object.values(T.THEMES)) Object.keys(th.narration || {}).forEach((k) => keys.add(k));
  const caps = captions();
  const out = [], seen = new Set();
  const add = (theme, t, from) => {
    const V = SAY.voiceFor(theme), h = SAY.keyOf(t, V);
    if (!t || seen.has(h)) return; seen.add(h);
    out.push({ g: 'mafia-' + V.kokoro, t, V, h, from });
  };
  for (const theme of Object.keys(T.THEMES)) {
    if (SKIP_THEMES.has(theme)) continue;
    for (const style of narrator.STYLES) {
      for (const key of keys) {
        const banks = [narrator.bank(style, key, { theme }), narrator.bank(style, key, { theme, firstDeath: true }), narrator.bank(style, key, { theme, alive: 3 })];
        for (const b of banks) for (const tpl of b) for (const s of SAY.sayOf(tpl, { plural: key === 'multiKill' })) add(theme, s, key);
      }
    }
    for (const tpl of caps) for (const s of SAY.sayOf(tpl, { caption: true })) add(theme, s, 'caption');
    for (const role of Object.keys(R.ROLES)) add(theme, SAY.roleSay(rolePhrase(theme, role)), 'role');
    // Narration set outside narrator.js (rules/events.js surprises, rules/afterlife.js), and the
    // Host controls voice test (public/host.js).
    for (const s of Object.values(SURPRISES)) for (const x of SAY.sayOf(s.text)) add(theme, x, 'surprise');
    for (const t of EXTRA) add(theme, t, 'extra');
  }
  return out;
}

module.exports = { collect, captions, rolePhrase };
if (require.main === module) {
  const L = collect();
  const by = {};
  for (const l of L) by[l.g] = (by[l.g] || 0) + 1;
  if (process.argv.includes('--list')) for (const l of L) console.log(l.g.padEnd(16), l.from.padEnd(12), l.t);
  console.log(by, L.length, 'lines,', L.reduce((a, l) => a + l.t.length, 0), 'characters');
}
