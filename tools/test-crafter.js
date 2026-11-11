'use strict';
// The Crafter: search (once a night, once a day), craft from recipes, use tools.
const assert = require('node:assert/strict');
const { Room } = require('../game');
const { VirtualClock } = require('../clock');
const K = require('../public/shared/crafting');

let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log(`  ✓ ${name}`); };
function game(roles, extra = {}) {
  const clock = new VirtualClock(), room = new Room('CRAFT', null, { clock, seed: 7 });
  const P = {};
  for (const name of Object.keys(roles)) { const p = room.join({ name }).player; p.sockets = 1; P[name] = p; }
  const counts = {}; for (const r of Object.values(roles)) if (r !== 'villager') counts[r] = (counts[r] || 0) + 1;
  room.updateSettings({ roleSelection: 'manual', autoMafia: false, roleCounts: counts, minPlayers: 3, botsAuto: false, skipCinematics: true, revealRoleOnDeath: true, ...extra });
  room.updateSettings({ forcedRoles: Object.fromEntries(Object.entries(roles).map(([n, r]) => [P[n].id, r])) });
  assert(room.hostAction({ type: 'start' }).ok); room.advance();
  assert.equal(room.phase, 'night');
  return { room, P };
}
const toMorning = (room) => { room.advance(); room.advance(); };
const toPhase = (room, phase) => { for (let i = 0; i < 12 && room.phase !== phase; i++) room.advance(); assert.equal(room.phase, phase); };
const give = (p, materials) => { p.craft.materials = { ...materials }; };
const note = (p, re) => p.notes.find((n) => re.test(n.text));
const ROLES = { Cr: 'crafter', Ma: 'mafia', Doc: 'doctor', V1: 'villager', V2: 'villager', V3: 'villager', V4: 'villager' };

test('Search: one material each night and one each day; the workshop shows it', () => {
  const { room, P } = game(ROLES);
  const r = room.crafterAction(P.Cr, { op: 'search' }); assert(r.ok && K.MATERIALS[r.found]);
  assert.match(room.crafterAction(P.Cr, { op: 'search' }).error, /already searched tonight/);
  assert.equal(room.playerView(P.Cr).crafter.materials[r.found], 1);
  assert.equal(room.playerView(P.Cr).crafter.canSearch, false);
  toMorning(room); toPhase(room, 'discussion');
  assert(room.crafterAction(P.Cr, { op: 'search' }).ok, 'a day search');
  assert.match(room.crafterAction(P.Cr, { op: 'search' }).error, /already searched today/);
  assert.equal(room.playerView(P.V1).crafter, undefined, 'only the Crafter sees a workshop');
  assert.equal(room.crafterAction(P.V1, { op: 'search' }).ok, false);
});

test('Craft: needs every ingredient, spends them, tools stack', () => {
  const { room, P } = game(ROLES);
  give(P.Cr, { wood: 2, stone: 1, iron: 1 });
  assert(room.crafterAction(P.Cr, { op: 'craft', recipe: 'pickaxe' }).ok);
  assert.deepEqual(P.Cr.craft.materials, { wood: 1, stone: 0, iron: 0 }); assert.equal(P.Cr.craft.tools.pickaxe, 1);
  assert.match(room.crafterAction(P.Cr, { op: 'craft', recipe: 'pickaxe' }).error, /Not enough materials/);
  assert.equal(room.crafterAction(P.Cr, { op: 'craft', recipe: 'bogus' }).ok, false);
});

test('Pickaxe: break a window at night, learn the true role at dawn (one use)', () => {
  const { room, P } = game(ROLES);
  give(P.Cr, { wood: 1, stone: 1, iron: 1 }); room.crafterAction(P.Cr, { op: 'craft', recipe: 'pickaxe' });
  assert(room.crafterAction(P.Cr, { op: 'use', tool: 'pickaxe', targetId: P.Ma.id }).ok);
  assert.equal(room.playerView(P.Cr).crafter.armed, 'pickaxe');
  room.voteMafia(P.Ma, P.V1.id);
  toMorning(room);
  assert(note(P.Cr, /broke Ma's window\. Inside: the Mafia/));
  assert.equal(P.Cr.investigations.at(-1).result, 'mafia');
  assert.equal(P.Cr.craft.tools.pickaxe, 0, 'spent');
});

test('The Pickaxe sees through disguises: an Impostor shows as the Impostor', () => {
  const { room, P } = game({ ...ROLES, Imp: 'impostor' });
  give(P.Cr, { wood: 1, stone: 1, iron: 1 }); room.crafterAction(P.Cr, { op: 'craft', recipe: 'pickaxe' });
  room.crafterAction(P.Cr, { op: 'use', tool: 'pickaxe', targetId: P.Imp.id });
  room.voteMafia(P.Ma, P.V1.id); room.voteMafia(P.Imp, P.V1.id); toMorning(room);
  assert(note(P.Cr, /broke Imp's window. Inside: the Impostor/), JSON.stringify(P.Cr.notes));
});

test('Lantern shows your visitors; the Magnifying Glass shows every visit', () => {
  const { room, P } = game(ROLES);
  give(P.Cr, { glass: 2, string: 1, iron: 1 });
  room.crafterAction(P.Cr, { op: 'craft', recipe: 'lantern' });
  assert(room.crafterAction(P.Cr, { op: 'use', tool: 'lantern' }).ok);
  room.voteMafia(P.Ma, P.Cr.id); room.nightAction(P.Doc, P.Cr.id);
  toMorning(room);
  assert(note(P.Cr, /Visitors at your door: (Ma, Doc|Doc, Ma)/), JSON.stringify(P.Cr.notes));
  assert(P.Cr.alive, 'the Doctor saved them');
  for (let i = 0; i < 12 && room.phase !== 'night'; i++) room.advance();
  if (!P.Cr.alive || room.phase !== 'night') return;
  room.crafterAction(P.Cr, { op: 'craft', recipe: 'magnifier' });
  assert(room.crafterAction(P.Cr, { op: 'use', tool: 'magnifier' }).ok);
  room.voteMafia(P.Ma, P.V2.id); room.nightAction(P.Doc, P.V3.id);
  toMorning(room);
  const seen = note(P.Cr, /magnifying glass/); assert(seen); assert.match(seen.text, /Ma → V2/); assert.match(seen.text, /Doc → V3/);
});

test('A blocked Crafter keeps the tool; night tools only work at night', () => {
  const { room, P } = game({ ...ROLES, Rb: 'roleblocker' });
  give(P.Cr, { wood: 1, stone: 1, iron: 1 }); room.crafterAction(P.Cr, { op: 'craft', recipe: 'pickaxe' });
  room.crafterAction(P.Cr, { op: 'use', tool: 'pickaxe', targetId: P.Ma.id });
  room.nightAction(P.Rb, P.Cr.id); room.voteMafia(P.Ma, P.V1.id); room.voteMafia(P.Rb, P.V1.id);
  toMorning(room);
  assert.equal(P.Cr.craft.tools.pickaxe, 1, 'not spent when blocked');
  toPhase(room, 'discussion');
  assert.match(room.crafterAction(P.Cr, { op: 'use', tool: 'pickaxe', targetId: P.Ma.id }).error, /used at night/);
});

test('Sword: one anonymous kill during the day; not at night', () => {
  const { room, P } = game(ROLES);
  give(P.Cr, { wood: 1, iron: 2 }); room.crafterAction(P.Cr, { op: 'craft', recipe: 'sword' });
  assert.match(room.crafterAction(P.Cr, { op: 'use', tool: 'sword', targetId: P.Ma.id }).error, /during the day/);
  room.voteMafia(P.Ma, P.V1.id); toMorning(room); toPhase(room, 'discussion');
  assert(room.crafterAction(P.Cr, { op: 'use', tool: 'sword', targetId: P.Ma.id }).ok);
  assert(!P.Ma.alive); assert.equal(P.Cr.craft.tools.sword, 0);
  assert.match(room.narration.text, /Ma/); assert.doesNotMatch(room.narration.text, /Cr\b/, 'the Crafter stays anonymous');
  assert.equal(room.winner, 'town');
});

test('Bot Crafters search, craft and use tools on their own', () => {
  const { room, P } = game(ROLES);
  P.Cr.isBot = true; give(P.Cr, { wood: 1, stone: 1, iron: 1 });
  room.voteMafia(P.Ma, P.V1.id); toMorning(room);
  for (let i = 0; i < 12 && room.phase !== 'night'; i++) room.advance();
  assert(P.Cr.craft.finds.length >= 1, 'searched');
  assert(P.Cr.craft.tools.pickaxe === 1 || room.night.metadata && room.night.metadata[P.Cr.id], 'crafted and/or armed a tool');
});

console.log(`All ${passed} Crafter tests passed.`);
