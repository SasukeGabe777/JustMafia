'use strict';
// JustZombies: ONE merged gun (shared by the phones, the TV and the tests; Node: module.exports; browser: window.TZGUN).
// You start with your base gun (the pistol) and every other weapon you pick up is MERGED into it as a part: the
// pistol + a rocket launcher is a Pistol Rocket Gun; add a shotgun and it's a Scatter Rocket Gun, and so on. Each
// part adds its trait (pellets, rate, piercing, burning, chain lightning, a grenade / rail / hubcap every few
// shots, a bayonet...), traits stack, and each part keeps its own level (the merchants) and tier (the crucible):
// the merged gun scales with every part. Weapon slots: 2 to start (the base gun + 1 part), up to 5 with the
// Gun Rack ability. Notable pairs have their own names and tricks (the old weapon combos).
//   TZGUN.slots(ab)                 -> how many slots (base gun included): 2..5
//   TZGUN.merge(parts)              -> the merged traits (see TRAITS)
//   TZGUN.name(parts, base, combos) -> the gun's name
//   TZGUN.TRAITS / ADJ / NOUN / COMBO_NAMES
(function (root, factory) {
  const M = factory(typeof require === 'function' ? require('./trash-arms') : root.TZR);
  if (typeof module === 'object' && module.exports) module.exports = M; else root.TZGUN = M;
})(typeof self !== 'undefined' ? self : this, function (R) {
  const SLOTS0 = 2, SLOTS_MAX = 5;
  const slots = (ab) => Math.min(SLOTS_MAX, SLOTS0 + Math.min(SLOTS_MAX - SLOTS0, (ab && ab.mount) || 0));
  // a part's strength: 1 at level 1 tier 1, ~2.2 at level 10 tier 3 (gentle: parts stack, no runaway)
  const g = (p) => 1 + 0.06 * ((p.lv || 1) - 1) + 0.35 * ((p.tier || 1) - 1);
  // what each part adds (what: the one-line on its loadout card)
  const TRAITS = {
    shotgun: { what: 'Spread pellets', fx: (t, p) => { const k = g(p); t.pellets += 2 + (p.tier - 1); t.pelletDmg *= 0.5 + 0.06 * k; t.dmg *= 1 + 0.06 * k; } },
    smg: { what: 'Fires way faster', fx: (t, p) => { const k = g(p); t.rate *= 1.36 + 0.08 * k; t.dmg *= 0.9 + 0.03 * k; } },
    nailgun: { what: 'Nails pierce through', fx: (t, p) => { const k = g(p); t.pierce += 1 + (p.tier >= 3 ? 1 : 0); t.rate *= 1.04 + 0.02 * k; t.dmg *= 1 + 0.05 * k; } },
    crossbow: { what: 'Fast bolts that pierce', fx: (t, p) => { const k = g(p); t.pierce += 1 + p.tier; t.bspeed *= 1.3; t.dmg *= 1.05 + 0.05 * k; } },
    rail: { what: 'A rail beam every 6th shot', fx: (t, p) => { t.every.push({ kind: 'rail', n: 6, k: g(p), tier: p.tier }); t.dmg *= 1.04; } },
    launcher: { what: 'A grenade every 4th shot', fx: (t, p) => { t.every.push({ kind: 'grenade', n: 4, k: g(p), tier: p.tier }); t.dmg *= 1.04; } },
    flamer: { what: 'Rounds set zombies on fire', fx: (t, p) => { t.burn += 1 + p.tier; t.flame = true; t.dmg *= 1.08 + 0.04 * g(p); } },
    coil: { what: 'Hits chain lightning', fx: (t, p) => { t.zap += 1 + p.tier; t.zapDmg = Math.max(t.zapDmg, 0.35 + 0.08 * g(p)); } },
    blower: { what: 'Hits knock them flying', fx: (t, p) => { t.knock *= 1.5 + 0.3 * g(p); t.bspeed *= 1.1; t.dmg *= 1.12 + 0.04 * g(p); } },
    hubcap: { what: 'A boomerang hubcap every 8th shot', fx: (t, p) => { t.every.push({ kind: 'hubcap', n: 8, k: g(p), tier: p.tier }); t.dmg *= 1.03; } },
    bat: { what: 'A bayonet swipe up close', fx: (t, p) => { t.melee.push({ id: 'bat', k: g(p), tier: p.tier }); } },
    saw: { what: 'A buzzing blade up close', fx: (t, p) => { t.melee.push({ id: 'saw', k: g(p), tier: p.tier }); } },
  };
  // the merged traits of a set of parts (the base gun's own level and tier scale the whole gun elsewhere: R.power)
  function merge(parts) {
    const t = { rate: 1, dmg: 1, pellets: 0, pelletDmg: 1, pierce: 0, bspeed: 1, burn: 0, flame: false, zap: 0, zapDmg: 0, knock: 1, every: [], melee: [], parts: (parts || []).length };
    for (const p of parts || []) { const T = TRAITS[p.id]; if (T) T.fx(t, { lv: p.lv || 1, tier: p.tier || 1 }); }
    return t;
  }
  // names: one part -> "Pistol Rocket Gun"; more -> the other parts as words in front of the main part's noun
  const ADJ = { shotgun: 'Scatter', smg: 'Rattle', nailgun: 'Nail', crossbow: 'Bolt', rail: 'Rail', launcher: 'Rocket', flamer: 'Flame', coil: 'Chain', blower: 'Gust', hubcap: 'Disc', bat: 'Bayonet', saw: 'Buzz' };
  const NOUN = { shotgun: 'Scattergun', smg: 'Rattler', nailgun: 'Nailer', crossbow: 'Crossbow', rail: 'Rail Rifle', launcher: 'Rocket Gun', flamer: 'Flamer', coil: 'Coil Gun', blower: 'Blaster', hubcap: 'Disc Gun', bat: 'Bat-Gun', saw: 'Saw-Gun' };
  // notable pairs (the old combos book, now parts of one gun): a name of their own (their tricks stay in trash-fight.js)
  const COMBO_NAMES = { firetornado: 'Fire Tornado', arcnails: 'Arc Nailer', boombolts: 'Boom-Bolt Bow', pinball: 'Pinball Scatter', luckyrattle: 'Lucky Rattler', hubstorm: 'Hubcap Storm', spikebat: 'Spiked Bat-Gun', railstorm: 'Thunder Rail', sawfire: 'Hot Saw' };
  const rank = (p) => (p.tier || 1) * 100 + (p.lv || 1);
  function name(parts, base, combos) {
    parts = (parts || []).filter((p) => NOUN[p.id]); base = base || { lv: 1, tier: 1 };
    const finish = base.tier >= 3 ? 'Golden ' : base.tier === 2 ? 'Chrome ' : '';
    if (!parts.length) return R ? R.wname('pistol', base.tier || 1) : 'Pistol';
    const C = R && combos ? R.COMBOS.find((c) => combos.has ? combos.has(c.id) : combos.includes(c.id)) : null;
    const wIn = C ? C.need.filter((n) => n.startsWith('w:')).map((n) => n.slice(2)) : [];
    if (C && COMBO_NAMES[C.id] && wIn.length && wIn.every((id) => parts.some((p) => p.id === id))) {
      const rest = parts.filter((p) => !wIn.includes(p.id)).sort((a, b) => rank(b) - rank(a)).slice(0, 2).map((p) => ADJ[p.id]);
      return finish + (rest.length ? rest.join('-') + ' ' : '') + COMBO_NAMES[C.id] + (wIn.length < 2 ? ' Pistol' : '');
    }
    if (parts.length === 1) return finish + 'Pistol ' + NOUN[parts[0].id];
    const L = parts.slice().sort((a, b) => rank(b) - rank(a)), main = L[0], adj = L.slice(1, 3).map((p) => ADJ[p.id]);
    return finish + adj.join('-') + ' ' + NOUN[main.id];
  }
  return { SLOTS0, SLOTS_MAX, slots, TRAITS, merge, name, ADJ, NOUN, COMBO_NAMES, strength: g };
});
