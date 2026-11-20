'use strict';
// The recorded JustMafia narrator (public/shared/narration-say.js, public/host.js, tools/voice-gen.js):
//  - its clip key is the same as the box voice's (public/box/voice.js keyOf, with the cb preset);
//  - every line the narrator can pick has a spoken form with no placeholders left in it;
//  - a real game's narration carries `say` clips with no player names or numbers in them;
//  - once JustMafia clips are rendered, every spoken piece of every world has a clip;
//  - box name lines are spoken as their name-free lead (show.js nameless()).
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const SAY = require('../public/shared/narration-say');
const N = require('../box/narration');
const { collect } = require('./voice-lines-mafia');

let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log('  ok  ' + name); };

test('narrator clip keys match the box voice keys', () => {
  const E = N.engine();
  for (const V of [{ kokoro: 'bm_george', speed: 1, cb: 'narrator' }, { kokoro: 'am_puck', speed: 1.05, cb: 'hype' }, { kokoro: 'am_puck', speed: 1.05 }]) {
    for (const t of ['The votes are in...', '“Quoted” 🎉 line,  with   spaces.']) assert.equal(SAY.keyOf(t, V), E.keyOf(t, V), JSON.stringify(V) + ' ' + t);
  }
  assert.notEqual(E.keyOf('x', { kokoro: 'am_puck', speed: 1 }), E.keyOf('x', { kokoro: 'am_puck', speed: 1, cb: 'hype' }), 'the preset is part of the key');
});

test('every narrator line has a clean spoken form', () => {
  const L = collect();
  assert(L.length > 500, 'collected ' + L.length);
  for (const l of L) {
    assert(!/[{}]/.test(l.t), 'placeholder left: ' + l.t);
    assert(/[A-Za-z]/.test(l.t), 'empty line from ' + l.from);
    assert(!/\b(someone|they|them)\s+(someone|they|them)\b/i.test(l.t), 'doubled pronoun: ' + l.t);
    assert(!/\bthe the\b/i.test(l.t), 'the the: ' + l.t);
  }
  const groups = new Set(L.map((l) => l.g));
  assert.deepEqual([...groups].sort(), ['mafia-af_nova', 'mafia-am_onyx', 'mafia-bf_emma', 'mafia-bm_george']);
});

test('spoken forms: names become someone/they, numbers are left out, roles are their own clip', () => {
  assert.deepEqual(SAY.sayOf('A scream at dawn. {name} will not be joining us today.{role} {alive} remain.'), ['A scream at dawn. Someone will not be joining us today.']);
  assert.deepEqual(SAY.sayOf('{name} ran.', { caption: true }), ['They ran.']);
  assert.deepEqual(SAY.sayOf('{name} are gone.{role}', { plural: true }), ['They are gone.']);
  assert.deepEqual(SAY.sayOf('Someone followed {name} home last night.'), ['Someone followed a neighbor home last night.']);
  assert.deepEqual(SAY.sayOf('🌫 A thick fog rolls into {town}. Tonight, nobody can see who goes where.'), ['A thick fog rolls into the town. Tonight, nobody can see who goes where.']);
  assert.equal(SAY.roleSay('the Med-Bay Surgeon (Doctor)'), 'They were the Med-Bay Surgeon.');
});

test('a real game sends name-free spoken clips with its narration', () => {
  const { Room } = require('../game');
  const room = new Room('VOICE', { emit() {} }, { speed: 1 });
  room.settings.townName = 'Zelda Springs'; room.settings.revealRoleOnDeath = true;
  room.narrate('kill', { name: 'Zelda', role: room.roleSuffix ? ' They were the Doctor.' : '', alive: 7 });
  const n = room.narration;
  assert(Array.isArray(n.say) && n.say.length >= 1, 'say clips');
  for (const s of n.say) assert(!/Zelda|\d/.test(s), 'no name or number spoken: ' + s);
  assert.match(n.text, /Zelda/, 'the screen still shows the name');
  assert.equal(n.say[n.say.length - 1], 'They were the Doctor.', 'role reveal clip last');
});

test('when the narrator clips are rendered, every spoken piece has one', () => {
  const mf = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'public', 'audio', 'voice', 'manifest.json'), 'utf8'));
  if (!Object.keys(mf.games || {}).some((g) => g.startsWith('mafia-'))) { console.log('      (no JustMafia clips rendered yet: skipped)'); return; }
  const missing = collect().filter((l) => !mf.clips[l.h]);
  assert.deepEqual(missing.slice(0, 20).map((l) => `${l.g} ${l.from}: ${l.t}`), [], missing.length + ' narrator lines without a clip (npm run voices -- mafia)');
});

test('box name lines are spoken as their name-free lead', () => {
  const nl = N.engine().nameless;
  assert.equal(nl('Give it up for {name}'), 'Give it up for…');
  assert.equal(nl('Let\'s meet our contestants! First up, {name}'), 'Let\'s meet our contestants! First up…');
  assert.equal(nl('…and {n} more high rollers!'), '…and more high rollers!');
  assert.equal(nl('{name}'), '');
});

console.log(`narration voice: ${passed} passed`);
