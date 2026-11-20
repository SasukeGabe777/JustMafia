// Shop seasons, rotating deals and theme sets for the JustGold shop (docs/justgold.md, "Seasons,
// deals and sets"). Shared by the server (prices and rules are enforced in profiles.js and
// box/gold.js) and the pages (the shop shows them; ?mock=1 computes the same thing offline).
// Load after options.js, cosmetics.js, gear.js and seasons.js.
//
//   Limited-time items: the `items` of each event in public/shared/seasons.js. Sold only while that
//     event runs (limitedInfo(id, now).onSale); owners keep them; the same ids return next year.
//   Daily deals: DEALS.count items picked for everyone by the UTC date (dailyDeals(now)), the first
//     DEALS.discounted of them 20–30% off. A deal can be bought that day even if it isn't on your
//     own play-to-reveal shelf yet (cosmetics.js STOCK), so the shelf still grows as you play.
//   Weekly spotlight: one theme set a week (spotlight(now)), its bundle SETS_RULES.spotlightOff off.
//   Theme sets: 3–4 pieces per game world (SETS) that work in every game. The Sets shelf sells every
//     piece (shelf or not) and the bundle: the pieces you're missing at SETS_RULES.bundleOff off.
//     Wearing a whole set pays +bonusPct% JustGold (at least 1, at most bonusCap) in its game.
(function (root) {
  const node = typeof module !== 'undefined' && module.exports;
  const C = node ? require('./cosmetics') : root.MT_COSMETICS;
  const G = node ? (() => { try { return require('./gear'); } catch (e) { return { GEAR: [] }; } })() : root.MT_GEAR || { GEAR: [] };
  const SEA = node ? require('./seasons') : root.MT_SEASONS || { SEASONS: [], ITEMS: {}, currentSeason: () => null };
  const DAY = 86400000, WEEK = 7 * DAY, MONDAY0 = Date.UTC(1970, 0, 5);
  const t0 = (d) => Date.parse(d + 'T00:00:00Z'), t1 = (d) => t0(d) + DAY;
  const CAT = new Map((C.CATALOG || []).map((i) => [i.id, i]));
  const GEAR = new Map((G.GEAR || []).map((g) => [g.id, g]));
  const itemOf = (id) => CAT.get(id) || GEAR.get(id) || null;
  const round5 = (n) => Math.max(5, Math.round(n / 5) * 5);

  // ---------- limited-time event items ----------
  const LIMITED = {}; // item id -> event kind
  for (const [kind, ids] of Object.entries(SEA.ITEMS || {})) for (const id of ids) LIMITED[id] = kind;
  const seasonView = (s, now) => s && { id: s.id, kind: s.kind || null, name: s.name, icon: s.icon, blurb: s.blurb, theme: { ...s.theme }, start: s.start, end: s.end,
    startsAt: t0(s.start), endsAt: t1(s.end), daysLeft: Math.max(0, Math.ceil((t1(s.end) - now) / DAY)), daysUntil: Math.max(0, Math.ceil((t0(s.start) - now) / DAY)), items: (s.items || []).slice() };
  // null for an everyday item; otherwise which event sells it and whether it is on sale now.
  function limitedInfo(id, now = Date.now()) {
    const kind = LIMITED[id]; if (!kind) return null;
    const cur = SEA.currentSeason(now), onSale = !!(cur && (cur.items || []).includes(id));
    const next = SEA.nextOfKind ? SEA.nextOfKind(kind, now) : ((SEA.SEASONS || []).filter((s) => s.kind === kind && t0(s.start) > now).sort((a, b) => t0(a.start) - t0(b.start))[0] || null);
    const any = (onSale ? cur : next) || ((SEA.KINDS || {})[kind]) || {};
    return { kind, name: any.name || kind, icon: any.icon || '🎉', onSale, daysLeft: onSale ? Math.max(0, Math.ceil((t1(cur.end) - now) / DAY)) : 0,
      endsAt: onSale ? t1(cur.end) : null, next: next ? { id: next.id, start: next.start, daysUntil: Math.max(0, Math.ceil((t0(next.start) - now) / DAY)) } : null };
  }
  function limitedLock(id, now) {
    const l = limitedInfo(id, now); if (!l || l.onSale) return null;
    return `Limited: sold during ${l.name}` + (l.next ? ` (back ${new Date(t0(l.next.start)).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })})` : '');
  }

  // ---------- theme sets ----------
  // Each piece sits in a different look field, so the whole set can be worn at once.
  const SETS = [
    { id: 'wildwest', name: 'Wild West', icon: '🤠', game: 'quickdraw', color: '#c9803a', items: ['hat:cowboy', 'outfit:sheriff', 'accessory:lasso', 'shoeStyle:spurBoots'], blurb: 'Hat, star, rope and spurs. High noon looks good on you.' },
    { id: 'spy', name: 'Secret Agent', icon: '🕵️', game: 'undercover', color: '#3a3f52', items: ['hat:trilby', 'outfit:secretAgent', 'accessory:nightShades', 'effect:shadow'], blurb: 'Black suit, glowing shades, a shadow that follows you.' },
    { id: 'chef', name: 'Head Chef', icon: '👨‍🍳', game: 'pizza', games: ['pizza', 'yeschef'], color: '#e8323c', items: ['hat:chef', 'outfit:chefCoat', 'accessory:woodenSpoon'], blurb: 'Whites, a tall hat and a spoon for tasting.' },
    { id: 'detective', name: 'Great Detective', icon: '🔍', game: 'escape', color: '#8a6a3a', items: ['hat:deerstalker', 'outfit:inverness', 'accessory:magnifier', 'shoeStyle:leatherBoots'], blurb: 'Elementary: cap, cape-coat and a magnifying glass.' },
    { id: 'casino', name: 'High Stakes', icon: '🎰', game: 'blackjack', color: '#1f7a4a', items: ['outfit:dealerVest', 'accessory:cardFan', 'effect:luckyDice', 'shoeStyle:nobleShoes'], blurb: 'A red waistcoat, four aces and dice that always roll sixes.' },
    { id: 'royal', name: 'Royal Court', icon: '👑', game: 'president', color: '#7a3ab0', items: ['hat:crown', 'outfit:royalRobe', 'accessory:cape', 'effect:sparkles'], blurb: 'Crown, robe, cape and a little sparkle. Bow, peasants.' },
    { id: 'survivor', name: 'Last Survivor', icon: '🧟', game: 'zombie', color: '#5a6a3a', items: ['hat:bandana', 'outfit:survivor', 'accessory:backpack', 'shoeStyle:tallBoots'], blurb: 'Packed, strapped and ready to run.' },
    { id: 'space', name: 'Space Cadet', icon: '🛸', game: 'alien', color: '#3a8aff', items: ['hat:ufoHat', 'outfit:cyber', 'accessory:rayGun', 'effect:orbit'], blurb: 'A saucer hat, a ray gun and your own little planets.' },
    { id: 'photo', name: 'Paparazzi', icon: '📸', game: 'snap', color: '#ff4f6d', items: ['hat:beret', 'outfit:photoVest', 'accessory:camera'], blurb: 'Beret, vest and the big camera. Say cheese.' },
    { id: 'pirate', name: 'Pirate Crew', icon: '🏴‍☠️', game: 'bid', color: '#5a1414', items: ['hat:pirate', 'outfit:pirateCoat', 'accessory:eyepatch'], blurb: 'Tricorn, coat and eyepatch, for bidding on buried treasure.' },
  ];
  const SETS_RULES = { bundleOff: 20, spotlightOff: 35, bonusPct: 5, bonusCap: 3 };
  const SET_OF = {}; for (const s of SETS) for (const id of s.items) SET_OF[id] = s.id;
  // ----- Events v2: every event's full themed set (public/shared/seasons.js SET_ITEMS) -----
  // One complete look per kind of event (hat, outfit, accessory, shoes when it has some, effect). The
  // bundle is sold only while that event runs (its pieces are limited items); owners keep the pieces
  // and can wear the set all year. Wearing all of it during its event: +bonusPct% JustGold in every game.
  const EVENT_SET_NAMES = { newyear: 'Midnight Sparkle', lantern: 'Lantern Light', hearts: 'Cupid’s Arrow', carnival: 'Parade Star', neon: 'Glow Up', clover: 'Pot of Luck', bloom: 'Garden Party',
    earth: 'Green Thumb', fiesta: 'Fiesta Time', dino: 'Dino Stomp', deepsea: 'Deep Diver', summer: 'Beach Day', fireworks: 'Big Bang Band', space: 'Mission Control', meteor: 'Stargazer',
    school: 'Class Act', robot: 'Mecha Mode', pirate: 'Captain’s Crew', bloodmoon: 'Moon Hunter', spooky: 'Trick or Treat', campfire: 'Happy Camper', harvest: 'Cosy Harvest', gingerbread: 'Sweet Tooth', frost: 'Snow Day' };
  const EVENT_SETS = Object.entries(SEA.SET_ITEMS || {}).map(([kind, items]) => {
    const K = (SEA.KINDS || {})[kind] || {};
    return { id: 'ev-' + kind, event: kind, name: EVENT_SET_NAMES[kind] || K.name || kind, icon: K.icon || '🎉', eventName: K.name || kind, color: (K.theme || {}).a || '#ffd23f', items: items.slice(),
      blurb: `The full ${K.name || kind} look, ${items.length} pieces. Wear it all during ${K.name || 'the event'} for bonus JustGold in every game.` };
  });
  const EVENT_SET_OF = {}; for (const s of EVENT_SETS) for (const id of s.items) EVENT_SET_OF[id] = s.id;
  const setById = (id) => SETS.find((s) => s.id === id) || EVENT_SETS.find((s) => s.id === id) || null;
  const gamesOf = (s) => s.games || (s.game ? [s.game] : []);
  // Is every piece of this set on the look? (look = the avatar object: { hat, outfit, … }).
  const wearsSet = (s, look) => !!look && s.items.every((id) => { const i = CAT.get(id); return i && look[i.field] === i.value; });
  const wornSets = (look) => SETS.filter((s) => wearsSet(s, look));
  // The set bonus for one game's payout: { set, extra } or null. Applied once per payout (the
  // payout itself is paid once per game), +bonusPct% rounded, at least 1 and at most bonusCap.
  function setBonus(game, look, amount, now = Date.now()) {
    const n = Math.floor(Number(amount) || 0); if (n <= 0 || !look) return null;
    const cur = SEA.currentSeason ? SEA.currentSeason(now) : null; // events v2: the running event's set pays in every game
    const s = wornSets(look).find((x) => gamesOf(x).includes(game)) || (cur ? EVENT_SETS.find((x) => x.event === cur.kind && wearsSet(x, look)) : null); if (!s) return null;
    return { set: s.id, icon: s.icon, name: s.name, extra: Math.min(SETS_RULES.bonusCap, Math.max(1, Math.round(n * SETS_RULES.bonusPct / 100))) };
  }

  // ---------- rotating deals (same for everyone, by the UTC date) ----------
  const DEALS = { count: 6, gear: 2, discounted: 2, pcts: [20, 25, 30] };
  const dayKey = (now = Date.now()) => new Date(now).toISOString().slice(0, 10);
  const weekNo = (now = Date.now()) => Math.floor((now - MONDAY0) / WEEK);
  const hash = (str) => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  const rng = (seed) => () => { seed = (seed + 0x6D2B79F5) >>> 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const SHOP_FIELDS = new Set(['outfit', 'shoeStyle', 'hat', 'accessory', 'hair', 'nameplate', 'effect', 'houseStyle', 'houseDecor', 'deathAnim', 'reactions', 'ghostSkin']);
  // What can be a deal: everyday gold items (no event items, set-only pieces, rewards or ladder tiers).
  const POOL_ITEMS = (C.CATALOG || []).filter((i) => SHOP_FIELDS.has(i.field) && i.cost > 0 && !i.free && !i.special && !i.pass && !i.world && !i.achievement && !i.requires);
  const POOL_GEAR = (G.GEAR || []).filter((g) => g.cost > 0);
  const pickN = (list, n, r) => { const a = list.slice(), out = []; while (out.length < n && a.length) out.push(a.splice(Math.floor(r() * a.length), 1)[0]); return out; };
  const dealCache = new Map();
  function dailyDeals(now = Date.now()) {
    const day = dayKey(now);
    if (!dealCache.has(day)) {
      const r = rng(hash('deals:' + day));
      const gear = pickN(POOL_GEAR, DEALS.gear, r), items = pickN(POOL_ITEMS, DEALS.count - gear.length, r);
      // A cloth or flair item and a game item are the two deals; the rest are featured at full price.
      const list = [items[0], gear[0], ...items.slice(1), ...gear.slice(1)].filter(Boolean).map((it, k) => ({ id: it.id, pct: k < DEALS.discounted ? DEALS.pcts[Math.floor(r() * DEALS.pcts.length)] : 0 }));
      if (dealCache.size > 8) dealCache.clear();
      dealCache.set(day, list);
    }
    return { day, endsAt: t1(day), items: dealCache.get(day).map((d) => ({ ...d })) };
  }
  const dealOf = (id, now) => dailyDeals(now).items.find((d) => d.id === id) || null;
  const isDeal = (id, now) => !!dealOf(id, now);
  function spotlight(now = Date.now()) {
    const w = weekNo(now), s = SETS[((hash('spot:' + w) % SETS.length) + SETS.length) % SETS.length];
    return { set: s.id, pct: SETS_RULES.spotlightOff, week: w, endsAt: MONDAY0 + (w + 1) * WEEK };
  }
  // What an item costs right now: { cost, base, pct } (pct > 0 on today's discounted deals).
  function priceOf(id, now = Date.now()) {
    const it = itemOf(id); if (!it) return null;
    const d = dealOf(id, now), pct = d ? d.pct : 0;
    return { base: it.cost, pct, cost: pct ? round5(it.cost * (1 - pct / 100)) : it.cost };
  }
  // The bundle: every piece you don't own yet, for one price (bundleOff off, or spotlightOff).
  function bundleOf(setId, owned, now = Date.now()) {
    const s = setById(setId); if (!s) return null;
    const have = owned instanceof Set ? owned : new Set(owned || []);
    const missing = s.items.filter((id) => { const i = CAT.get(id); return i && !i.free && !have.has(id); });
    const pct = spotlight(now).set === s.id ? SETS_RULES.spotlightOff : SETS_RULES.bundleOff;
    const full = missing.reduce((t, id) => t + CAT.get(id).cost, 0);
    const locked = s.event ? missing.map((id) => limitedLock(id, now)).find(Boolean) || null : null; // events v2: only while its event runs
    return { set: s.id, missing, full, pct, price: missing.length ? round5(full * (1 - pct / 100)) : 0, locked };
  }

  // Everything the shop page shows for these features (server: shopState; page: ?mock=1).
  function shopExtras(now = Date.now(), owned = [], look = null) {
    const have = owned instanceof Set ? owned : new Set(owned || []);
    const cur = SEA.currentSeason(now), next = SEA.nextSeason ? SEA.nextSeason(now) : null;
    const deals = dailyDeals(now), spot = spotlight(now);
    return {
      now, event: seasonView(cur, now), nextEvent: seasonView(next, now),
      deals: { day: deals.day, endsAt: deals.endsAt, items: deals.items.map((d) => ({ ...d, price: priceOf(d.id, now).cost })), spotlight: spot },
      sets: SETS.concat(EVENT_SETS.filter((s) => (cur && s.event === cur.kind) || s.items.some((id) => have.has(id)))).map((s) => ({ id: s.id, name: s.name, icon: s.icon, game: s.game || null, games: gamesOf(s), color: s.color, blurb: s.blurb, items: s.items.slice(),
        event: s.event || null, eventName: s.eventName || null, eventOn: !!(s.event && cur && cur.kind === s.event),
        have: s.items.filter((id) => have.has(id) || (CAT.get(id) || {}).free).length, total: s.items.length, worn: wearsSet(s, look), spotlight: spot.set === s.id, bundle: bundleOf(s.id, have, now) })),
      eventSet: cur ? 'ev-' + cur.kind : null,
      setRules: { ...SETS_RULES },
    };
  }

  const API = { LIMITED, SETS, SETS_RULES, SET_OF, EVENT_SETS, EVENT_SET_OF, EVENT_SET_NAMES, DEALS, limitedInfo, limitedLock, setById, wornSets, wearsSet, setBonus, dayKey, weekNo, dailyDeals, isDeal, dealOf, spotlight, priceOf, bundleOf, shopExtras, POOL_ITEMS, POOL_GEAR };
  if (node) module.exports = API; else root.MT_SHOP_SEASON = API;
})(typeof window !== 'undefined' ? window : globalThis);
