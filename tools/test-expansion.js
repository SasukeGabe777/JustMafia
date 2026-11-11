'use strict';
const assert = require('node:assert/strict');
const { Room } = require('../game');
const { VirtualClock } = require('../clock');
const R = require('../public/shared/roles');
const O = require('../public/shared/options');
const L = require('../public/shared/layout');
const PHOTO = require('../public/shared/photo-match');
const { simulateGame } = require('../sim');
let passed = 0;
function test(name, fn) { fn(); passed++; console.log(`  ✓ ${name}`); }
function game(roles, settings = {}) {
  const clock = new VirtualClock(), room = new Room('TEST', null, { clock, headless: true, seed: 99 });
  const counts = {}; roles.forEach((r) => { if (r !== 'villager') counts[r] = (counts[r] || 0) + 1; });
  room.updateSettings({ minPlayers: 3, maxPlayers: 100, autoMafia: false, roleCounts: counts, botsAuto: false, ...settings });
  room.addBots(roles.length); const p = room.list();
  room.updateSettings({ forcedRoles: Object.fromEntries(p.map((x, i) => [x.id, roles[i]])) });
  assert.equal(room.startGame().ok, true); room.advance(); return { room, p, clock };
}
function day(room) { room.advance(); room.advance(); room.advance(); assert.equal(room.phase, 'discussion'); }
test('Local photo helper matches palette colors and ignores transparent pixels', () => {
  assert.equal(PHOTO.nearest([36, 27, 24], O.hairColor), '#241b18');
  const pixels = new Uint8ClampedArray(16 * 16 * 4);
  for (let i = 0; i < pixels.length; i += 4) { pixels[i] = 36; pixels[i + 1] = 27; pixels[i + 2] = 24; pixels[i + 3] = 255; }
  assert.deepEqual(PHOTO.sample(pixels, 16, 16, 0.5, 0.5), [36, 27, 24]);
  pixels.fill(0); assert.deepEqual(PHOTO.sample(pixels, 16, 16, 0.5, 0.5), [128, 128, 128]);
});

for (const n of [4, 10, 25, 50, 100]) test(`Stable, bounded, nonoverlapping ${n}-house layout`, () => {
  const hs = L.houses(n); assert.equal(hs.length, n); assert.deepEqual(hs, L.houses(100).slice(0, n));
  for (const h of hs) { assert(h.x - 40 * h.s >= 0 && h.x + 40 * h.s <= L.W); assert(h.y - 100 * h.s >= 90 && h.y <= L.H - 80); }
  hs.forEach((h, i) => hs.slice(i + 1).forEach((b) => assert(Math.abs(h.x - b.x) >= 80 * h.s + 5 || Math.abs(h.y - b.y) >= 100 * h.s + 5)));
});
test('House identity survives lobby removals, new arrivals and game start', () => {
  const room = new Room('TEST', null, { headless: true, seed: 1 }); room.updateSettings({ minPlayers: 3 });
  const ps = Array.from({ length: 6 }, (_, i) => room.join({ name: `P${i}` }).player);
  room.kick(ps[0].id); const old = ps.slice(1).map((p) => p.house);
  room.join({ name: 'newcomer' }); assert.deepEqual(ps.slice(1).map((p) => p.house), old);
  room.startGame(); assert.deepEqual(ps.slice(1).map((p) => p.house), old); room.destroy();
});
test('Every appearance option round-trips and locks at start; arbitrary fields rejected', () => {
  const { room, p } = game(['mafia', 'villager', 'villager', 'villager']);
  room.resetToLobby(); const avatar = {};
  for (const [k, v] of Object.entries(O)) if (Array.isArray(v)) avatar[k === 'colors' ? 'color' : k === 'skins' ? 'skin' : k === 'hats' ? 'hat' : k] = v[v.length - 1];
  avatar.role = 'mafia'; room.updateProfile(p[0], { name: 'Custom', avatar });
  assert.equal(p[0].avatar.hair, O.hair.at(-1)); assert.equal(p[0].avatar.facialHair, 'beard'); assert(!('role' in p[0].avatar));
  const expected = { ...p[0].avatar }; room.startGame(); room.updateProfile(p[0], { avatar: { hair: 'short' }, name: 'Changed' });
  assert.deepEqual(p[0].avatar, expected); assert.equal(p[0].name, 'Custom'); assert.deepEqual(room.hostView().players[0].avatar, expected);
  assert.deepEqual(room.playerView(p[0]).you.avatar, expected);
});
test('House design: every field saves per player, invalid input sanitized, random when unset, legacy avatar migrates, locked at start', () => {
  assert.equal(O.FREE_HOUSE_STYLES, 12); assert.equal(O.houseColor.length, 12);
  for (const list of Object.values(O.HOME_FIELDS)) assert(O[list].length >= 5, list);
  const { room, p } = game(['mafia', 'villager', 'villager', 'villager']);
  room.resetToLobby();
  for (const x of p) for (const [k, list] of Object.entries(O.HOME_FIELDS)) assert(O[list].includes(x.homeLook[k]), k);
  for (const [k, list] of Object.entries(O.HOME_FIELDS)) for (const v of O[list]) { room.updateProfile(p[0], { home: { [k]: v } }); assert.equal(p[0].homeLook[k], v); }
  room.updateProfile(p[0], { home: { style: 'tavern', wall: '#c4674f', roof: '#2f4f80', door: 'arched', windows: 'stained', yard: 'pumpkins' } });
  room.updateProfile(p[1], { home: { style: '<script>', wall: 'red;background:url(x)', door: 42 } });
  assert(O.houseStyle.includes(p[1].homeLook.style) && O.houseColor.includes(p[1].homeLook.wall) && O.doorStyle.includes(p[1].homeLook.door));
  assert.equal(p[2].homeLook.style === p[0].homeLook.style && p[2].homeLook.door === 'arched', false, 'houses are customized independently');
  const legacy = room.join({ name: 'Old', avatar: { houseStyle: 'windmill', houseColor: '#a88bc6' } }).player;
  assert.equal(legacy.homeLook.style, 'windmill'); assert.equal(legacy.homeLook.wall, '#a88bc6'); assert(!('houseStyle' in legacy.avatar));
  room.kick(legacy.id);
  const before = { ...p[0].homeLook }; room.startGame();
  room.updateProfile(p[0], { home: { style: 'bakery' } }); assert.deepEqual(p[0].homeLook, before);
  assert.deepEqual(room.hostView().players.find((x) => x.id === p[0].id).homeLook, before);
  assert.deepEqual(room.playerView(p[1]).players.find((x) => x.id === p[0].id).homeLook, before);
  room.destroy();
});
test('House ownership: claim empty plots, move in with an owner (max residents), guests return home when the owner leaves, lobby only', () => {
  const room = new Room('TEST', null, { headless: true, seed: 3 }); room.updateSettings({ minPlayers: 3 });
  const [a, b, c, d, e] = ['Ana', 'Ben', 'Cy', 'Di', 'Ed'].map((name) => room.join({ name }).player);
  // Moving in asks the owner first; here the owner says yes straight away.
  const ask = (p, o) => { const r = room.claimHome(p, { with: o.id }); return r.ok && r.pending ? room.respondMoveIn(o, p.id, true) : r; };
  assert.deepEqual([a, b, c, d, e].map((x) => room.homeSlot(x)), [0, 1, 2, 3, 4], 'everyone starts in their own house');
  // Claim an empty plot (gap after a removal), and reject taken plots.
  room.kick(c.id); assert(room.freePlots().includes(2));
  assert.equal(room.claimHome(e, { plot: 0 }).ok, false, 'plot taken');
  assert.equal(room.claimHome(e, { plot: 2 }).ok, true); assert.equal(e.house, 2); assert.equal(room.homeSlot(e), 2);
  // Move in with Ana; the sign data lists both; Ana stays the owner.
  assert.equal(ask(b, a).ok, true);
  assert.equal(room.homeSlot(b), a.house); assert.deepEqual(room.residentsOf(a).map((x) => x.name), ['Ben']);
  assert.equal(room.hostView().players.find((x) => x.id === b.id).livesWith, a.id);
  assert.equal(room.hostView().players.find((x) => x.id === b.id).home, a.house);
  assert.equal(ask(d, b).ok, false, 'cannot move in with a guest');
  assert.equal(ask(a, a).ok, false, 'cannot move in with yourself');
  // Capacity: owner + 3 guests.
  const f = room.join({ name: 'Fi' }).player, g = room.join({ name: 'Gus' }).player;
  assert.equal(ask(f, a).ok, true); assert.equal(ask(g, a).ok, true);
  assert.equal(ask(d, a).ok, false, 'house full');
  // Seat numbers ("PLAYER N") stay unique even when sharing a house.
  assert.equal(new Set(room.list().map((x) => x.house)).size, room.list().length);
  // The owner moving in elsewhere sends their guests home; so does the owner leaving.
  assert.equal(ask(a, d).ok, true);
  assert.equal(room.homeSlot(b), b.house); assert.equal(f.livesWith, null);
  assert.equal(ask(b, d).ok, true); room.kick(d.id);
  assert.equal(room.homeSlot(a), a.house); assert.equal(room.homeSlot(b), b.house);
  // Going back to your own house, then locked once the game starts.
  assert.equal(ask(e, a).ok, true); assert.equal(room.claimHome(e, { own: true }).ok, true); assert.equal(room.homeSlot(e), e.house);
  assert.equal(ask(b, a).ok, true); room.startGame();
  assert.equal(room.claimHome(b, { own: true }).ok, false); assert.equal(room.homeSlot(b), a.house, 'residency survives game start');
  room.destroy();
});
test('Expressions: every option saves, legacy "serious" migrates, invalid falls back, locked at start, public', () => {
  const { room, p } = game(['mafia', 'villager', 'villager', 'villager']);
  room.resetToLobby();
  for (const expression of O.expression) { room.updateProfile(p[0], { avatar: { ...p[0].avatar, expression } }); assert.equal(p[0].avatar.expression, expression); }
  room.updateProfile(p[1], { avatar: { ...p[1].avatar, expression: undefined, features: 'serious' } });
  assert.equal(p[1].avatar.expression, 'serious'); assert.equal(p[1].avatar.features, 'none');
  room.updateProfile(p[2], { avatar: { ...p[2].avatar, expression: 'evil<script>', features: 'freckles' } });
  assert.equal(p[2].avatar.expression, 'smile'); assert.equal(p[2].avatar.features, 'freckles');
  room.updateProfile(p[0], { avatar: { ...p[0].avatar, expression: 'wink' } }); room.startGame();
  room.updateProfile(p[0], { avatar: { ...p[0].avatar, expression: 'angry' } });
  assert.equal(p[0].avatar.expression, 'wink');
  assert.equal(room.hostView().players.find((x) => x.id === p[0].id).avatar.expression, 'wink');
  assert.equal(room.playerView(p[1]).players.find((x) => x.id === p[0].id).avatar.expression, 'wink');
  room.destroy();
});
test('Executions: interventions resolve on the server, mob identity follows vote visibility, per-player info, safe last words', () => {
  // roles: 0 mafia, 1 roleblocker (mafia), 2 bodyguard, 3..6 villagers; everyone votes out p[3]
  const setup = (settings = {}) => {
    const g = game(['mafia', 'roleblocker', 'bodyguard', 'villager', 'villager', 'villager', 'villager'], { revealRoleOnDeath: false, ...settings });
    day(g.room); g.room.advance(); assert.equal(g.room.phase, 'voting');
    for (const v of g.p) if (v !== g.p[3]) g.room.vote(v, g.p[3].id);
    g.room.advance(); assert.equal(g.room.phase, 'verdict'); return g;
  };
  const cue = (room) => room.hostView().cinematic;
  const leaks = (c, ids) => ids.some((id) => JSON.stringify(c).includes(id));

  // Different players see different options; the TV sees none of them.
  let { room, p } = setup();
  const o = (x) => room.playerView(x).verdict;
  assert(o(p[1]).canInterrupt && !o(p[1]).canProtect); assert(o(p[2]).canProtect && !o(p[2]).canInterrupt);
  assert(!o(p[4]).canInterrupt && !o(p[4]).canProtect && o(p[4]).canDefend);
  assert(o(p[3]).isCondemned && o(p[3]).lastWords && !o(p[3]).canDefend); assert.equal(o(p[4]).lastWords, null);
  assert(!('verdict' in room.hostView()));
  // Normal execution with public votes: real voters form the mob; defenders who chose to be seen; safe last words.
  room.intervene(p[4], 'defend'); room.intervene(p[5], 'defend');
  assert.equal(room.setLastWords(p[3], { word: 'I was framed by Ana' }).ok, false, 'free text refused');
  assert(room.setLastWords(p[3], { nameId: p[0].id, word: 'LIAR' }).ok);
  room.advance(); let c = cue(room);
  assert.equal(c.outcome, 'executed'); assert.equal(p[3].alive, false);
  assert.deepEqual(c.defenders.sort(), [p[4].id, p[5].id].sort()); assert.deepEqual(c.lastWords, { name: p[0].name, word: 'LIAR' });
  assert.deepEqual(c.mob.slice().sort(), p.filter((x) => x !== p[3]).map((x) => x.id).sort());
  room.destroy();

  // Anonymous votes: masked mob, no voter ids anywhere in the public cue.
  ({ room, p } = setup({ anonymousVotes: true })); room.advance(); c = cue(room);
  assert.equal(c.mob, null); assert(c.mobCount >= 3); assert(!leaks(c, p.filter((x) => x !== p[3]).map((x) => x.id)));
  room.destroy();

  // Role Blocker interrupts: nobody dies, the interrupter is never identified; once per game.
  ({ room, p } = setup());
  room.intervene(p[1], 'interrupt'); room.intervene(p[2], 'protect');
  room.advance(); c = cue(room);
  assert.equal(c.outcome, 'interrupted'); assert.equal(p[3].alive, true); assert.equal(p[2].alive, true, 'interruption wins over protection');
  assert(!leaks({ ...c, mob: null }, [p[1].id]), 'the interrupter is never identified (they may only appear as a public voter)');
  assert(!/roleblocker|Role Blocker/i.test(room.narration.text));
  assert.equal(p[1].interventionUsed.interrupt, true);
  room.advance(); assert.equal(room.phase, 'night');
  room.destroy();

  // Bodyguard takes the place: the Bodyguard dies, the condemned lives, no last words from the survivor.
  ({ room, p } = setup());
  room.intervene(p[2], 'protect'); room.setLastWords(p[3], { word: 'GOODBYE' });
  room.advance(); c = cue(room);
  assert.equal(c.outcome, 'swapped'); assert.equal(c.guardId, p[2].id); assert.equal(c.targetId, p[2].id); assert.equal(c.condemnedId, p[3].id);
  assert.equal(p[2].alive, false); assert.equal(p[3].alive, true); assert.equal(c.lastWords, null);
  room.destroy();

  // Interventions are opt-in per game (settings) and only for the right roles; skipping keeps the outcome.
  ({ room, p } = setup({ executionInterventions: false }));
  assert.equal(room.intervene(p[1], 'interrupt').ok, false);
  room.hostAction({ type: 'skip' }); assert.equal(room.phase, 'execution'); assert.equal(p[3].alive, false);
  room.hostAction({ type: 'skip' }); assert.equal(p[3].alive, false, 'skipping the scene never changes the outcome');
  room.destroy();
});
test('Executioner role: reveals themselves and dies in the condemned’s place; public by choice; once per game; earns the Hood of Mercy', () => {
  const C = require('../public/shared/cosmetics');
  const setup = () => {
    const g = game(['mafia', 'executioner', 'bodyguard', 'villager', 'villager', 'villager', 'villager'], { revealRoleOnDeath: false });
    day(g.room); g.room.advance();
    for (const v of g.p) if (v !== g.p[3]) g.room.vote(v, g.p[3].id);
    g.room.advance(); assert.equal(g.room.phase, 'verdict'); return g;
  };
  let { room, p } = setup();
  assert(room.playerView(p[1]).verdict.canSacrifice); assert(!room.playerView(p[4]).verdict.canSacrifice, 'only the Executioner');
  assert.equal(room.playerView(p[4]).players.find((x) => x.id === p[1].id).role, null, 'role secret before the reveal');
  room.intervene(p[1], 'sacrifice'); room.intervene(p[2], 'protect');
  room.advance(); const c = room.hostView().cinematic;
  assert.equal(c.outcome, 'executioner', 'the Executioner goes before the Bodyguard'); assert.equal(c.executionerId, p[1].id); assert.equal(c.condemnedId, p[3].id);
  assert.equal(p[1].alive, false); assert.equal(p[3].alive, true); assert.equal(p[2].alive, true);
  assert.equal(room.playerView(p[4]).players.find((x) => x.id === p[1].id).role, 'executioner', 'their role is public: they revealed it themselves');
  assert.equal(p[1].metrics.executionerSaves, 1); assert.equal(p[1].interventionUsed.sacrifice, true);
  room.destroy();
  // The Hood of Mercy is an achievement reward, unlocked by an eligible game where you saved someone.
  const item = C.CATALOG.find((i) => i.id === 'hat:executionerHood');
  assert(item && item.achievement === 'executionerSave' && item.cost === 0);
  const { ProfileStore } = require('../profiles'), store = new ProfileStore(null), id = store.create().id;
  assert.equal(store.buy(id, 'hat:executionerHood').ok, false, 'locked until earned');
  const r = store.award(id, 'g-exec', { won: false, alive: false, team: 'town', metrics: { executionerSaves: 1 } });
  assert(r.lines.some((l) => /Save someone as the Executioner/.test(l.label)));
  assert(store.buy(id, 'hat:executionerHood').ok); assert(store.equip(id, 'hat:executionerHood').ok); assert.equal(store.view(id).avatar.hat, 'executionerHood');
  // An interruption still beats everything.
  ({ room, p } = game(['mafia', 'roleblocker', 'executioner', 'villager', 'villager', 'villager', 'villager'], {}));
  day(room); room.advance(); for (const v of p) if (v !== p[3]) room.vote(v, p[3].id); room.advance();
  room.intervene(p[1], 'interrupt'); room.intervene(p[2], 'sacrifice'); room.advance();
  assert.equal(room.hostView().cinematic.outcome, 'interrupted'); assert.equal(p[2].alive, true); assert.notEqual(p[2].interventionUsed.sacrifice, true, 'an unused sacrifice is not spent');
  room.destroy();
});
test('End-of-game gold: server-calculated breakdown, winners vs losers, paid once, practice games explain why not', () => {
  const { ProfileStore } = require('../profiles'), C = require('../public/shared/cosmetics');
  const play = ({ bots = 0, minutes = 2 } = {}) => {
    const clock = new VirtualClock(), profiles = new ProfileStore(null);
    const room = new Room('GOLD', null, { clock, headless: true, seed: 11, profiles });
    room.updateSettings({ minPlayers: 3, botsAuto: false });
    const ps = ['Ana', 'Ben', 'Cy', 'Di'].map((name) => { const pl = room.join({ name }).player; pl.profileId = profiles.create().id; return pl; });
    if (bots) room.addBots(bots);
    assert(room.startGame().ok); clock.t += minutes * 60000;
    const mafia = room.inGame().filter((x) => room.team(x) === 'mafia');
    for (const m of mafia) room.override({ op: 'kill', id: m.id });
    assert.equal(room.phase, 'gameover'); assert.equal(room.winner, 'town');
    return { room, ps, profiles, mafia };
  };
  const { room, ps, profiles, mafia } = play();
  for (const p of ps) {
    const r = room.playerView(p).reward; assert(r && r.eligible, 'eligible reward for ' + p.name);
    const sum = r.lines.reduce((t, l) => t + l.amount, 0);
    assert.equal(r.coins, Math.min(sum, C.REWARDS.maxPerGame)); assert.equal(r.after - r.before, r.coins);
    assert.equal(profiles.view(p.profileId).coins, r.after, 'gold really paid');
    assert(r.lines.some((l) => l.key === 'completed'));
    const won = room.team(p) === 'town';
    assert.equal(r.lines.some((l) => l.key === 'victory'), won, 'victory line only for winners');
    assert.equal(r.lines.some((l) => l.key === 'survived'), !mafia.includes(p), 'survival line only for survivors');
    assert.deepEqual(room.hostView().reward, undefined, 'TV never receives private rewards');
  }
  const loser = ps.find((p) => room.team(p) === 'mafia'), winner = ps.find((p) => room.team(p) === 'town');
  if (loser && winner) assert(room.playerView(winner).reward.coins > room.playerView(loser).reward.coins);
  // Paid once: settling again (or replaying the same game id) pays nothing more.
  const before = ps.map((p) => profiles.view(p.profileId).coins);
  room.rewarded = false; room.settleProgression();
  assert.deepEqual(ps.map((p) => profiles.view(p.profileId).coins), before);
  assert.equal(profiles.award(ps[0].profileId, room.gameId, { won: true, alive: true, metrics: {} }), false);
  room.destroy();
  // Practice games pay nothing and say why.
  const withBots = play({ bots: 1 }); const rb = withBots.room.playerView(withBots.ps[0]).reward;
  assert.equal(rb.eligible, false); assert.equal(rb.coins, 0); assert.match(rb.reason, /bots/); withBots.room.destroy();
  const short = play({ minutes: 0 }); assert.match(short.room.playerView(short.ps[0]).reward.reason, /shorter than 60 seconds/); short.room.destroy();
  // Farming is capped: lots of repeated actions only count up to each cap and the per-game max.
  const big = new ProfileStore(null), id = big.create().id;
  const res = big.award(id, 'farm', { won: true, alive: true, team: 'neutral', metrics: { abilities: 99, objectives: 99, correctInvestigations: 99, saves: 99 } });
  const bonus = res.lines.filter((l) => l.key === 'challenge' || l.key === 'pass').reduce((t, l) => t + l.amount, 0); // weekly challenges pay on top of the cap
  assert.equal(res.coins - bonus, C.REWARDS.maxPerGame); assert.equal(res.capped, C.REWARDS.maxPerGame);
  assert.equal(res.lines.find((l) => l.key === 'abilities').amount, C.REWARDS.abilityCap * C.REWARDS.ability);
});
test('Move-in requests: the owner gets 20 seconds to say yes or no; declines, timeouts, cancels, bots and game start', () => {
  const clock = new VirtualClock(), room = new Room('MOVE', null, { clock, headless: true, seed: 5 });
  room.updateSettings({ minPlayers: 3 });
  const [ana, ben, cy] = ['Ana', 'Ben', 'Cy'].map((name) => room.join({ name }).player);
  // Asking does not move you in yet; the owner sees the request with a 20s deadline.
  const r = room.claimHome(ben, { with: ana.id }); assert(r.ok && r.pending);
  assert.equal(ben.livesWith, null);
  const asks = room.playerView(ana).moveAsks; assert.equal(asks.length, 1); assert.equal(asks[0].fromName, 'Ben'); assert.equal(asks[0].expiresAt - clock.now(), 20000);
  assert.equal(room.playerView(ben).you.moveStatus.state, 'pending'); assert.deepEqual(room.playerView(cy).moveAsks, [], 'only the owner is asked');
  // Yes -> moved in.
  assert(room.respondMoveIn(ana, ben.id, true).moved); assert.equal(ben.livesWith, ana.id); assert.equal(room.playerView(ben).you.moveStatus.state, 'accepted');
  // No -> stays home.
  room.claimHome(ben, { own: true }); room.claimHome(cy, { with: ana.id });
  room.respondMoveIn(ana, cy.id, false); assert.equal(cy.livesWith, null); assert.equal(room.playerView(cy).you.moveStatus.state, 'declined');
  // No answer within 20 seconds -> expires; a late answer does nothing.
  room.claimHome(cy, { with: ana.id }); clock.t += 19999; assert.equal(room.playerView(ana).moveAsks.length, 1);
  assert(clock.step()); assert.equal(room.playerView(cy).you.moveStatus.state, 'expired'); assert.deepEqual(room.playerView(ana).moveAsks, []);
  assert.equal(room.respondMoveIn(ana, cy.id, true).ok, false); assert.equal(cy.livesWith, null);
  // Only the asked owner can answer; asking someone else or cancelling replaces the request.
  room.claimHome(cy, { with: ana.id }); assert.equal(room.respondMoveIn(ben, cy.id, true).ok, false);
  room.claimHome(cy, { cancel: true }); assert.equal(room.playerView(cy).you.moveStatus.state, 'cancelled'); assert.deepEqual(room.playerView(ana).moveAsks, []);
  // Bots can't answer, so they accept.
  room.addBots(1); const bot = room.list().find((x) => x.isBot);
  assert(room.claimHome(cy, { with: bot.id }).moved); assert.equal(cy.livesWith, bot.id);
  // Unanswered requests end when the game starts; nothing about it changes the game rules.
  room.claimHome(ben, { with: ana.id }); assert.equal(room.playerView(ana).moveAsks.length, 1);
  assert(room.startGame().ok); assert.deepEqual(room.playerView(ana).moveAsks, []); assert.equal(ben.livesWith, null);
  assert.equal(room.respondMoveIn(ana, ben.id, true).ok, false);
  room.destroy();
});
test('AI narrator: night deaths get story locations with lore lines; manual narrator keeps the classic scene and text', () => {
  const seen = new Set();
  const LORE = { lake: /lake/i, hearth: /hearth/i, tavern: /tavern/i, field: /field|grass/i, chase: /home|door|followed/i };
  for (let seed = 1; seed <= 80; seed++) {
    const clock = new VirtualClock(), room = new Room('S' + seed, null, { clock, headless: true, seed });
    room.updateSettings({ minPlayers: 3, autoMafia: false, roleCounts: { mafia: 1 }, botsAuto: false, revealRoleOnDeath: true });
    room.addBots(5); const p = room.list();
    room.updateSettings({ forcedRoles: Object.fromEntries(p.map((x, i) => [x.id, i === 0 ? 'mafia' : 'villager'])) });
    room.startGame(); room.advance();
    room.nightAction(p[0], p[1].id); room.resolveNight();
    const e = room.cinematic.events.find((x) => x.targetId === p[1].id);
    assert(L.DEATH_PLACES.includes(e.place), 'kill has a place'); assert.notEqual(e.place, 'visit', 'only inspectors die at another house');
    seen.add(e.place);
    room.startMorning();
    if (LORE[e.place]) assert.match(room.narration.text, LORE[e.place]); else assert.match(room.narration.text, new RegExp(p[1].name));
    room.destroy();
  }
  for (const place of ['home', 'lake', 'hearth', 'tavern', 'field', 'chase']) assert(seen.has(place), 'location appears: ' + place);
  // Manual (human) narrator: no locations, classic murder, unchanged text.
  const { room, p } = game(['mafia', 'villager', 'villager', 'villager'], { narratorMode: 'human' });
  room.nightAction(p[0], p[1].id); room.resolveNight();
  const manualEvents = room.reveal ? room.reveal.events : room.cinematic.events; // human mode may queue for the Judge
  assert.equal(manualEvents.length, 1); assert(!('place' in manualEvents[0]));
  room.startMorning(); assert(!/lake|hearth|tavern|field/i.test(room.narration.text));
  room.destroy();
});
test('AI narrator: an inspector dies at the house they watched, only when roles are revealed; deterministic', () => {
  for (const reveal of [true, false]) {
    const { room, p } = game(['mafia', 'detective', 'villager', 'villager', 'villager'], { revealRoleOnDeath: reveal });
    room.updateProfile(p[3], {}); // p[3] is the watched house
    room.nightAction(p[1], p[3].id); room.nightAction(p[0], p[1].id); room.resolveNight();
    const e = room.cinematic.events.find((x) => x.targetId === p[1].id);
    if (reveal) {
      assert.equal(e.place, 'visit'); assert.equal(e.placeHouse, room.homeSlot(p[3])); assert.equal(e.placeName, p[3].name);
      room.startMorning(); assert(room.narration.text.includes(p[3].name), 'lore names whose house');
    } else assert.notEqual(e.place, 'visit', 'hidden roles never produce the revealing location');
    room.destroy();
  }
  const a = game(['mafia', 'villager', 'villager', 'villager']), b = game(['mafia', 'villager', 'villager', 'villager']);
  for (const g of [a, b]) { g.room.nightAction(g.p[0], g.p[2].id); g.room.resolveNight(); }
  assert.equal(a.room.cinematic.events[0].place, b.room.cinematic.events[0].place, 'same seed, same story');
  a.room.destroy(); b.room.destroy();
});
test('RSP Supply theme: selectable, yellow/blue, Tom Smith leads the takeover; the original Mafia theme is untouched', () => {
  const T = require('../public/shared/themes');
  assert(T.THEME_ORDER.includes('rsp')); const rsp = T.THEMES.rsp;
  const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  for (const w of rsp.palette.walls) { const [r, g, b] = rgb(w); assert(r > 200 && g > 180 && b < 190, 'yellow walls ' + w); }
  for (const w of rsp.palette.roofs) { const [r, g, b] = rgb(w); assert(b > r + 60 && b > g, 'blue roofs ' + w); }
  assert.equal(rsp.villain.name, 'Tom Smith'); assert.equal(T.teamName('rsp', 'mafia', 'The Mafia'), 'RSP Supply');
  assert.equal(T.roleName('rsp', 'godfather', 'Godfather'), 'Tom Smith, President (Godfather)'); assert.equal(T.roleTitle('rsp', 'godfather', 'Godfather'), 'Tom Smith, President'); // themed name + what it is
  assert.equal(T.roleName('medieval', 'godfather', 'Godfather'), 'Godfather'); assert.equal(T.teamName('smalltown', 'mafia', 'The Mafia'), 'The Mafia');
  // Every role and team name RSP renames is a real id, and each theme only uses its own data.
  for (const id of Object.keys(rsp.roleNames)) assert(R.ROLES[id], 'unknown role ' + id);
  // Full games: an RSP game narrates the takeover; a classic game never mentions it.
  for (const theme of ['rsp', 'medieval']) {
    const { room, p } = game(['mafia', 'villager', 'villager'], { theme, revealRoleOnDeath: true });
    const said = () => Object.values(room.narrationHistory).join(' | ');
    room.nightAction(p[0], p[1].id); room.resolveNight(); room.startMorning();
    for (let i = 0; i < 6 && room.phase !== 'gameover'; i++) room.advance();
    if (theme === 'rsp') {
      assert.equal(room.settings.townName, 'Supplyville');
      assert.match(said(), /RSP Supply/); assert.match(said(), /member of RSP Supply|RSP Supply now owns|absorbed into the RSP Supply|acquired by RSP Supply/);
    } else { assert.doesNotMatch(said(), /RSP|Tom Smith/); assert.match(said(), /Mafia/); }
    room.destroy();
  }
  // The theme locks at start like every other theme.
  const { room } = game(['mafia', 'villager', 'villager'], { theme: 'rsp' });
  room.updateSettings({ theme: 'medieval' }); assert.equal(room.settings.theme, 'rsp'); room.destroy();
});
test('Investigator visits exclude dummy prompts and own surveillance; only one Mafia visitor', () => {
  const { room, p } = game(['mafia', 'mafia', 'investigator', 'doctor', 'villager', 'villager', 'villager', 'villager']);
  room.nightAction(p[0], p[4].id); room.nightAction(p[1], p[4].id); room.nightAction(p[2], p[4].id);
  room.nightAction(p[3], p[4].id); room.nightAction(p[5], p[4].id); room.resolveNight();
  assert.match(p[2].investigations[0].clue, /Multiple/);
  assert.equal(room.night.visits.filter((v) => v.kind === 'attack').length, 1);
  assert(!room.night.visits.some((v) => v.actorId === p[5].id));
  assert(!JSON.stringify(room.hostView()).includes('Multiple visitors'));
  assert.equal(room.playerView(p[2]).privateScene.targetId, p[4].id); assert.equal(room.playerView(p[4]).privateScene, null);
});
test('Investigator nobody-visited clue, departure clue, and roleblock', () => {
  for (const block of [false, true]) {
    const { room, p } = game(['mafia', 'roleblocker', 'investigator', 'detective', 'villager', 'villager', 'villager']);
    room.nightAction(p[2], p[3].id); room.nightAction(p[3], p[4].id);
    if (block) room.nightAction(p[1], p[2].id);
    room.resolveNight(); const clue = p[2].investigations[0];
    if (block) { assert.equal(clue.blocked, true); assert.equal(clue.clue, null); }
    else assert.match(clue.clue, /Nobody else visited\. Someone departed/);
  }
});
test('Detective results and private cinematic never appear on other phones or TV', () => {
  const { room, p } = game(['mafia', 'detective', 'villager', 'villager']);
  room.nightAction(p[1], p[0].id); room.resolveNight();
  assert.equal(room.playerView(p[1]).investigations[0].result, true);
  assert.equal(room.playerView(p[0]).privateScene, null); assert(!room.hostView().privateScene);
});
test('Simultaneous attacks on one victim select the anonymous multiple-attacker cinematic', () => {
  for (const revealMode of ['auto', 'judge']) {
    const { room, p } = game(['mafia', 'vigilante', 'villager', 'villager', 'villager', 'villager'], { revealMode });
    room.nightAction(p[0], p[2].id); room.nightAction(p[1], p[2].id); room.resolveNight();
    if (revealMode === 'judge') room.judgeReveal({ all: true });
    assert.deepEqual(room.cinematic.events.map(({ story, ...e }) => e), [{ type: 'multiKill', targetId: p[2].id }]);
    assert.equal(room.pending.deaths.length, 1);
    assert(!JSON.stringify(room.cinematic).includes(p[0].id)); assert(!JSON.stringify(room.cinematic).includes(p[1].id));
  }
});
test('Ghostwriter only acts dead, fixed words, once per day, reveal at next boundary', () => {
  const { room, p } = game(['mafia', 'ghostwriter', 'villager', 'villager', 'villager']); day(room);
  assert.equal(room.dayAbility(p[1], { tokens: ['WATCH'] }).ok, false);
  room.kill(p[1], 'test');
  assert.equal(room.dayAbility(p[1], { tokens: ['MAFIA', 'free text'] }).ok, false);
  assert.equal(room.dayAbility(p[1], { tokens: ['WATCH', 'PLAYER 1'] }).ok, true);
  assert.equal(room.dayAbility(p[1], { tokens: ['SAFE'] }).ok, false);
  assert(!JSON.stringify(room.hostView()).includes('WATCH PLAYER 1'));
  room.startVoting(); assert.equal(room.cinematic.stories[0].sub, 'WATCH PLAYER 1');
  assert.equal(p[1].ghostMessage, null);
});
test('Puppet Master redirects real ballot privately and respects limits and public-vote rule', () => {
  const { room, p } = game(['mafia', 'puppetMaster', 'villager', 'villager', 'villager', 'villager'], { puppetUses: 1 }); day(room); room.startVoting();
  assert.equal(room.dayAbility(p[1], { victimId: p[2].id, targetId: p[3].id }).ok, true);
  assert.equal(room.playerView(p[2]).voting.choice, p[3].id); assert.equal(room.vote(p[2], p[4].id), false);
  assert.equal(room.dayAbility(p[1], { victimId: p[4].id, targetId: p[3].id }).ok, false);
  room.resolveVotes(); assert.equal(room.cinematic.votes.find((v) => v.voterId === p[2].id).targetId, p[3].id);
  assert(R.buildRoleList({ autoMafia: false, anonymousVotes: true, roleCounts: { mafia: 1, puppetMaster: 1 } }, 6).errors.length);
});
test('Paparazzi publishes only an effective action, hides identities and can co-win', () => {
  const { room, p } = game(['mafia', 'paparazzi', 'doctor', 'villager', 'villager'], { paparazziGoal: 1 });
  room.nightAction(p[1], p[2].id); room.nightAction(p[2], p[3].id); room.resolveNight(); room.startMorning();
  assert.equal(p[1].photos, 1); const story = room.cinematic.stories[0]; assert.equal(story.scene, 'photograph');
  assert(!JSON.stringify(story).includes(p[1].id)); assert(!JSON.stringify(story).includes('doctor'));
  room.winner = 'town'; assert.equal(room.didWin(p[1]), true); p[1].alive = false; assert.equal(room.didWin(p[1]), false);
});
test('Blocked and dummy actions produce no paparazzi photo', () => {
  const { room, p } = game(['mafia', 'roleblocker', 'paparazzi', 'doctor', 'villager', 'villager', 'villager']);
  room.nightAction(p[1], p[3].id); room.nightAction(p[2], p[3].id); room.nightAction(p[3], p[4].id); room.resolveNight(); room.startMorning();
  assert.equal(p[2].photos, 0);
});
test('Conductor objective uses actual ballots and blesses only confirmed Town', () => {
  const { room, p } = game(['mafia', 'conductor', 'villager', 'villager', 'villager'], { harmonyGoal: 1 }); day(room);
  const objective = p[1].objective; assert(objective.voters.length === 2); assert(!room.hostView().objective);
  room.startVoting(); const target = p.find((x) => !objective.voters.includes(x.id));
  for (const id of objective.voters) room.vote(room.players.get(id), target.id);
  room.resolveVotes(); assert.equal(room.harmonyTotal, 1); assert.equal(room.confirmedTown.length, 1);
  assert.equal(room.team(room.players.get(room.confirmedTown[0])), 'town'); assert.equal(room.cinematic.followups[0].scene, 'blessing');
});
test('Glitch lasts 30 seconds, is limited, and never changes names, avatars or votes', () => {
  const { room, p, clock } = game(['mafia', 'glitch', 'villager', 'villager', 'villager']); day(room); room.startVoting();
  room.vote(p[2], p[0].id); const before = JSON.stringify({ votes: room.votes, players: room.hostView().players });
  assert.equal(room.dayAbility(p[1]).ok, true); assert.equal(room.glitchUntil, clock.now() + 30000);
  assert.equal(room.dayAbility(p[1]).ok, false); assert.equal(JSON.stringify({ votes: room.votes, players: room.hostView().players }), before);
  room.pause(); while (clock.now() < room.glitchUntil) clock.step(); assert.equal(room.glitchUntil, 0);
});
test('Disaster requires matching, single-use, unexpired confirmation and preserves win checks', () => {
  for (const disaster of ['hurricane', 'flood', 'meteor']) {
    const { room, p } = game(['mafia', 'villager', 'villager', 'villager']);
    assert.equal(room.disaster({ id: p[0].id, disaster }).ok, false);
    const preview = room.disaster({ id: p[0].id, disaster, preview: true }); assert(p[0].alive);
    assert.equal(room.disaster({ id: p[1].id, disaster, confirmation: preview.confirmation }).ok, false);
    assert.equal(room.disaster({ id: p[0].id, disaster, confirmation: preview.confirmation }).ok, true);
    assert.equal(p[0].alive, false); assert.equal(room.winner, 'town'); assert.equal(room.paused, true);
    assert.equal(room.cinematic.scene, disaster); assert(room.log.some((l) => l.text.includes('Judge intervention')));
    assert.equal(room.disaster({ id: p[0].id, disaster, confirmation: preview.confirmation }).ok, false);
    room.advance(); assert.equal(room.phase, 'gameover');
  }
});
test('Disaster previews expire at a phase change', () => {
  const { room, p } = game(['mafia', 'villager', 'villager', 'villager']);
  const d = room.disaster({ id: p[1].id, disaster: 'meteor', preview: true }); room.advance();
  assert.equal(room.disaster({ id: p[1].id, disaster: 'meteor', confirmation: d.confirmation }).ok, false); assert(p[1].alive);
});
test('Intervention releases ballots locked toward a removed target', () => {
  const { room, p } = game(['mafia', 'puppetMaster', 'villager', 'villager', 'villager', 'villager']); day(room); room.startVoting();
  assert(room.dayAbility(p[1], { victimId: p[2].id, targetId: p[3].id }).ok);
  const preview = room.disaster({ id: p[3].id, disaster: 'flood', preview: true });
  assert(room.disaster({ id: p[3].id, disaster: 'flood', confirmation: preview.confirmation }).ok);
  assert.equal(room.votes[p[2].id], undefined); assert.equal(room.voteLocks[p[2].id], undefined);
  room.resume(); assert(room.vote(p[2], p[0].id));
});
test('Active-player Judge appointment withdraws their seat and pending night targets', () => {
  const { room, p } = game(['mafia', 'villager', 'villager', 'villager', 'villager']);
  room.nightAction(p[0], p[1].id); room.nightAction(p[1], p[2].id);
  p[1].isBot = false; p[1].sockets = 1;
  assert(room.appointJudge(p[1], 'Replacement.').ok);
  assert.equal(p[1].alive, false); assert.equal(p[1].role, null); assert(p[1].spectator);
  assert.equal(room.night.actions[p[0].id], undefined); assert.equal(room.night.actions[p[1].id], undefined);
  assert.equal(room.inGame().length, 4);
});
test('Random Judge is a connected human and receives no role', () => {
  const room = new Room('TEST', null, { headless: true, seed: 3 });
  for (let i = 0; i < 7; i++) { const p = room.join({ name: `P${i}` }).player; p.sockets = 1; }
  assert(room.randomJudge().ok); const judge = room.players.get(room.judgeParticipantId);
  assert(judge.isJudge && judge.spectator); assert.equal(room.startGame().ok, true); assert.equal(judge.role, null);
  assert.equal(room.inGame().length, 6); assert.equal(room.randomJudge().ok, false); room.destroy();
});
test('80% removal includes connected ghosts, counts once, pauses open-ended phase and rotates secrets', () => {
  const { room, p } = game(['mafia', 'villager', 'villager', 'villager', 'villager', 'villager']);
  for (const x of p) { x.isBot = false; x.sockets = 1; }
  room.settings.autoAdvance = false; day(room); room.kill(p[5], 'test');
  const oldKey = room.judgeKey;
  assert.equal(room.governanceView().required, 5); room.voteRemoveJudge(p[0]); room.voteRemoveJudge(p[0]);
  assert.equal(room.governanceView().approvals, 1);
  for (const x of p.slice(1, 4)) room.voteRemoveJudge(x);
  assert(!room.judgeVacant); room.voteRemoveJudge(p[5]);
  assert(room.judgeVacant && room.paused); assert.notEqual(room.judgeKey, oldKey);
  assert.equal(room.dayAbility(p[1]).ok, false); assert.equal(room.vote(p[1], p[2].id), false);
  assert.equal(room.volunteerJudge(p[5], false).ok, false); assert.equal(room.volunteerJudge(p[5], true).ok, true);
  assert.equal(room.judgeParticipantId, p[5].id); assert(room.paused); room.resume(); assert(!room.paused); assert.equal(room.endsAt, null);
});
test('Appointed and retired Judges lose role-specific phone feeds as well as admin access', () => {
  const { room, p } = game(['mafia', 'telepath', 'telepath', 'villager', 'villager', 'villager']);
  p[1].isBot = false; p[1].sockets = 1;
  assert(room.appointJudge(p[1], 'Test transfer.').ok); assert.equal(p[1].role, null);
  p[1].isJudge = false; p[1].judgeRetired = true; p[1].role = 'telepath';
  room.telepathLog.push({ text: 'A future private message.' });
  let view = room.playerView(p[1]); assert.equal(view.role, null); assert.equal(view.telepath, undefined); assert.deepEqual(view.notes, []);
  p[1].role = 'mafia'; view = room.playerView(p[1]); assert.equal(view.teammates, undefined);
});
test('Current connected electorate updates without publishing individual votes', () => {
  const { room, p } = game(['mafia', 'villager', 'villager', 'villager', 'villager']);
  for (const x of p) { x.isBot = false; x.sockets = 1; }
  p.slice(0, 3).forEach((x) => room.voteRemoveJudge(x)); assert(!room.judgeVacant);
  p[4].sockets = 0; room.checkJudgeRemoval(); assert(!room.judgeVacant); // 3/4 requires four
  p[3].sockets = 0; room.checkJudgeRemoval(); assert(room.judgeVacant);
  assert(!('votes' in room.governanceView())); assert(!('judgeKey' in room.hostView()));
});
test('Human mode switching preserves phase and secrets, waits for manual advance', () => {
  const { room, clock } = game(['mafia', 'villager', 'villager', 'villager']); const phaseId = room.phaseId;
  room.updateSettings({ narratorMode: 'human' }); assert.equal(room.phaseId, phaseId); assert.equal(room.endsAt, null); assert.equal(room.hostView().narration, null);
  room.advance(); assert.equal(room.phase, 'dawn'); assert.equal(room.endsAt, null);
  room.updateSettings({ narratorMode: 'ai' }); assert.equal(room.phase, 'dawn'); assert.equal(room.phaseId, phaseId + 1); room.destroy();
});
for (const n of [4, 10, 25, 50, 100]) test(`${n}-player simulation completes with shared engine`, () => {
  assert(!simulateGame({ players: n, seed: 2026 + n }).error);
});
test('Expanded roles complete deterministic bot simulations', () => {
  const settings = { autoMafia: false, roleCounts: { mafia: 2, roleblocker: 1, puppetMaster: 1, detective: 1, investigator: 1, ghostwriter: 1, paparazzi: 1, conductor: 1, glitch: 1, doctor: 1 }, harmonyGoal: 1, paparazziGoal: 1 };
  const a = simulateGame({ players: 20, settings, seed: 17 }), b = simulateGame({ players: 20, settings, seed: 17 });
  assert(!a.error, a.error); assert.deepEqual(a, b);
});
console.log(`All ${passed} expansion tests passed.`);
