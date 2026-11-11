// Shop catalog, gold rewards and achievements. Shared by the server (prices,
// ownership, rewards are enforced there) and the phone (shop display).
//
// To add shop items:
//   - a new value in an existing list (options.js) becomes a paid item
//     automatically once it is past that field's free count (FIELDS below);
//   - a new kind of item: add its option list + one FIELDS line + a CATEGORY;
//   - optional: PRICES['field:value'] for a custom price, DESCRIPTIONS for text.
(function (root) {
  const O = typeof module !== 'undefined' && module.exports ? require('./options') : root.MT_OPTIONS;
  // field -> [option list, how many are free from the start]
  // field -> [option list, how many are free]. Most items are earned now: new players start with
  // a small free set (profiles created earlier keep everything they already had).
  const FIELDS = { hair: ['hair', 6], outfit: ['outfit', 4], hat: ['hats', 3], shoeStyle: ['shoeStyles', 2], accessory: ['accessory', 2], nameplate: ['nameplate', 1], houseDecor: ['houseDecor', 1], effect: ['effect', 1], houseStyle: ['houseStyle', 4] };
  if (O.deathAnim) FIELDS.deathAnim = ['deathAnim', 1];
  if (O.reactions) FIELDS.reactions = ['reactions', 1];
  // Shop sections. `target` says what equipping changes: the character or the house.
  const CATEGORIES = [
    { id: 'clothing', label: 'Clothing', icon: '👕', fields: ['outfit', 'shoeStyle'], target: 'avatar' },
    { id: 'accessories', label: 'Hats & Gear', icon: '🎩', fields: ['hat', 'accessory'], target: 'avatar' },
    { id: 'hair', label: 'Hairstyles', icon: '💇', fields: ['hair'], target: 'avatar' },
    { id: 'house', label: 'House', icon: '🏠', fields: ['houseStyle', 'houseDecor'], target: 'home' },
    { id: 'flair', label: 'Flair', icon: '✨', fields: ['nameplate', 'effect', 'reactions'], target: 'avatar' },
    { id: 'animations', label: 'Farewells', icon: '🕯', fields: ['deathAnim'], target: 'avatar' },
  ];
  // Where an equipped item lives: avatar field, or house design field (HOME_FIELDS key).
  const SLOT = { houseStyle: { target: 'home', key: 'style' }, houseDecor: { target: 'home', key: 'decor' } };
  const slotOf = (field) => SLOT[field] || { target: 'avatar', key: field };
  const PRICES = { 'houseStyle:darkMansion': 140, 'houseStyle:modernHouse': 120, 'houseStyle:rspOffice': 160,
    'deathAnim:petals': 90, 'deathAnim:fireflies': 110, 'deathAnim:letter': 80, 'deathAnim:candle': 100, 'deathAnim:lantern': 120, 'deathAnim:starfall': 150, 'deathAnim:ascend': 200 };
  const DESCRIPTIONS = {
    'houseStyle:darkMansion': 'A towering, gloomy mansion with iron gates and a single candle in the attic. Fits the darkest secrets.',
    'houseStyle:modernHouse': 'Clean lines, big windows and a flat roof. The most futuristic address in town.',
    'houseStyle:rspOffice': 'A tidy yellow-and-blue corporate branch office, courtesy of RSP Supply.',
    'hat:executionerHood': 'A crimson executioner’s hood trimmed in gold, worn only by those who gave their life on the gallows to save another. Earned by saving someone as the Executioner.',
    'outfit:plagueDoctor': 'The beaked coat of a healer who has seen too much. Earned by saving ten players.',
    'outfit:detectiveCoat': 'A long coat with deep pockets for clues. Earned by identifying five Mafia.',
    'outfit:jester': 'Bells, stripes and zero regrets. Earned by winning as the Jester.',
    'nameplate:mafiaBoss': 'A gold-trimmed nameplate for proven bosses. Earned by winning five Mafia games.',
    'outfit:ghostHunter': 'Gear for someone who has survived it all. Earned by surviving ten games.',
    // Farewells: how you go out. Plays over your body on the big screen when you die (it never reveals who did it).
    'hat:bloodCrown': 'A crown of dark iron and a single blood-red gem. Season 1 pass, tier 6.',
    'effect:bloodMist': 'A red mist curls around your feet. Season 1 pass, tier 3.',
    'nameplate:bloodMoon': 'A nameplate the color of the Blood Moon. Season 1 pass, tier 9.',
    'accessory:batWings': 'Leathery wings that twitch when you walk. Season 1 pass, tier 12.',
    'outfit:vampire': 'High collar, crimson lining, never seen in daylight. Season 1 pass, tier 15.',
    'effect:lightning': 'A storm follows you, and sometimes it strikes. Season 1 pass, tier 17.',
    'nameplate:gilded': 'Solid gold. For those who finished what they started. Season 1 pass, tier 18.',
    'outfit:bloodKnight': 'Armor forged under the Blood Moon. The Season 1 grand prize, tier 20.',
    'deathAnim:none': 'No farewell. You go quietly.',
    'deathAnim:petals': 'Rose petals drift down and settle around you.',
    'deathAnim:fireflies': 'Fireflies rise from where you fell and drift into the night.',
    'deathAnim:letter': 'A sealed letter flutters down beside you. What did it say? Nobody will ever know.',
    'deathAnim:candle': 'A candle burns beside you, gutters, and goes out.',
    'deathAnim:lantern': 'A paper sky lantern lifts from your side and floats away.',
    'reactions:rxSpooky': 'Reactions for the brave: 👻 💀 🕯️ 🦇 🎃 ⚰️ float over your head on the big screen.',
    'reactions:rxRoyal': 'React like royalty: 👑 💎 🍷 🎩 🗡️ 🛡️.',
    'reactions:rxParty': 'Turn every vote into a party: 🎉 🥳 🍕 🎈 🕺 🤪.',
    'reactions:rxDetective': 'For the sleuths: 🔍 🕵️ 🧐 📝 🔦 🚨.',
    'reactions:rxLove': 'Wear your heart on your sleeve: ❤️ 😍 💔 😘 🌹 🥺.',
    'deathAnim:starfall': 'The sky answers: falling stars streak overhead.',
    'deathAnim:ascend': 'Your spirit rises from your body, glowing, and fades into the light.',
  };
  const KIND = { hair: 'hairstyle', outfit: 'outfit', hat: 'hat', shoeStyle: 'pair of shoes', accessory: 'accessory', nameplate: 'nameplate', houseDecor: 'house decoration', effect: 'cosmetic effect', houseStyle: 'house design', deathAnim: 'farewell animation' };
  const ACHIEVEMENTS = { mafiaWins5: { label: 'Win five Mafia games', stat: 'mafiaWins', count: 5 }, saves10: { label: 'Save ten players', stat: 'saves', count: 10 }, jesterWin: { label: 'Win as Jester', stat: 'jesterWins', count: 1 }, investigations5: { label: 'Identify five Mafia', stat: 'correctInvestigations', count: 5 }, survive10: { label: 'Survive ten games', stat: 'survived', count: 10 }, executionerSave: { label: 'Save someone as the Executioner', stat: 'executionerSaves', count: 1 } };
  const GATES = { 'hat:executionerHood': 'executionerSave', 'outfit:plagueDoctor': 'saves10', 'outfit:detectiveCoat': 'investigations5', 'outfit:jester': 'jesterWin', 'nameplate:mafiaBoss': 'mafiaWins5', 'outfit:ghostHunter': 'survive10' };
  // ----- Season 1: Blood Moon (battle pass) -----
  // Buy the pass with gold; every game earns pass XP (pass or not); each tier pays gold or
  // unlocks a pass-exclusive cosmetic. Buying later grants every tier already reached.
  const SEASON = {
    id: 's1', name: 'Season 1: Blood Moon', cost: 150, tiers: 20, xpPerTier: 100,
    xp: { completed: 40, won: 25, survived: 10, challenge: 60 },
    rewards: { 1: { gold: 20 }, 2: { gold: 20 }, 3: { item: 'effect:bloodMist' }, 4: { gold: 30 }, 5: { gold: 30 }, 6: { item: 'hat:bloodCrown' }, 7: { gold: 30 }, 8: { gold: 40 },
      9: { item: 'nameplate:bloodMoon' }, 10: { gold: 40 }, 11: { gold: 40 }, 12: { item: 'accessory:batWings' }, 13: { gold: 50 }, 14: { gold: 50 }, 15: { item: 'outfit:vampire' },
      16: { gold: 50 }, 17: { item: 'effect:lightning' }, 18: { item: 'nameplate:gilded' }, 19: { gold: 60 }, 20: { item: 'outfit:bloodKnight' } },
  };
  const PASS = Object.fromEntries(Object.entries(SEASON.rewards).filter(([, r]) => r.item).map(([tier, r]) => [r.item, Number(tier)]));
  // Weekly challenges: three per week (chosen from this pool by the week number), paid once each.
  const CHALLENGES = {
    play3: { label: 'Play 3 games', stat: 'games', count: 3, gold: 40 },
    play5: { label: 'Play 5 games', stat: 'games', count: 5, gold: 60 },
    win2: { label: 'Win 2 games', stat: 'wins', count: 2, gold: 60 },
    survive2: { label: 'Survive to the end of 2 games', stat: 'survived', count: 2, gold: 40 },
    save1: { label: 'Save someone from an attack', stat: 'saves', count: 1, gold: 50 },
    catch1: { label: 'Catch a Mafia member with an investigation', stat: 'correctInvestigations', count: 1, gold: 50 },
    mafiaWin1: { label: 'Win as the Mafia', stat: 'mafiaWins', count: 1, gold: 70 },
    abilities5: { label: 'Use your role’s ability 5 times', stat: 'abilities', count: 5, gold: 40 },
  };
  const weekKey = (date = new Date()) => { const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())); const day = d.getUTCDay() || 7; d.setUTCDate(d.getUTCDate() + 4 - day); const y = d.getUTCFullYear(); return `${y}-W${String(Math.ceil(((d - Date.UTC(y, 0, 1)) / 864e5 + 1) / 7)).padStart(2, '0')}`; };
  function weeklyChallenges(week) {
    const keys = Object.keys(CHALLENGES), out = [];
    let h = 0; for (const ch of week) h = (Math.imul(h, 31) + ch.charCodeAt(0)) >>> 0;
    // 32-bit integer math (a plain multiply loses the low bits) and a hard stop, so this can never spin.
    for (let guard = 0; out.length < 3 && guard < 200; guard++) { h = (Math.imul(h ^ (h >>> 15), 2246822507) + 12345) >>> 0; const k = keys[(h >>> 8) % keys.length]; if (!out.includes(k)) out.push(k); }
    for (const k of keys) if (out.length < 3 && !out.includes(k)) out.push(k);
    return out;
  }
  // Seasonal events the Judge can switch on (see rules/events.js).
  const EVENTS = {
    none: { name: 'No event' },
    bloodMoon: { name: '🌕 Blood Moon', xpMultiplier: 2, desc: 'Every third night the moon turns red and the Mafia strike twice. Double season XP.' },
  };

  // ----- Worlds (Themes v2): cosmetics earned by finishing games in each world -----
  // First game there unlocks the first item, the third game the second. Never sold.
  const WORLD_NAMES = { space: 'Space Station', fantasy: 'Fantasy Realm', dragons: 'Dragon Peaks', dungeon: 'Dungeon Crawl', spies: 'Secret Agents', fbi: 'Federal Investigation', snow: 'Snowy Village', blocky: 'Block World', tabletop: 'Tabletop Quest', realistic: 'Realistic', noir: 'Noir' };
  const WORLD_REWARDS = {
    space: [{ item: 'hat:spaceHelmet', games: 1 }, { item: 'outfit:spaceSuit', games: 3 }],
    fantasy: [{ item: 'hat:elfCirclet', games: 1 }, { item: 'accessory:fairyWings', games: 3 }],
    dragons: [{ item: 'hat:dragonHorns', games: 1 }, { item: 'outfit:dragonScale', games: 3 }],
    dungeon: [{ item: 'accessory:torch', games: 1 }, { item: 'outfit:rogueLeathers', games: 3 }],
    spies: [{ item: 'accessory:shades', games: 1 }, { item: 'outfit:tuxedo', games: 3 }],
    fbi: [{ item: 'accessory:badge', games: 1 }, { item: 'outfit:fedJacket', games: 3 }],
    snow: [{ item: 'hat:furHat', games: 1 }, { item: 'outfit:parka', games: 3 }],
    blocky: [{ item: 'hat:cubeHelm', games: 1 }, { item: 'outfit:blockArmor', games: 3 }],
    tabletop: [{ item: 'accessory:diceBag', games: 1 }, { item: 'hat:featherCap', games: 3 }],
    realistic: [{ item: 'accessory:wristwatch', games: 1 }, { item: 'outfit:denimJacket', games: 3 }],
    noir: [{ item: 'hat:fedora', games: 1 }, { item: 'outfit:trenchCoat', games: 3 }],
  };
  const WORLD_ITEM = Object.fromEntries(Object.entries(WORLD_REWARDS).flatMap(([world, list]) => list.map((r) => [r.item, { world, games: r.games }])));

  const CATALOG = Object.entries(FIELDS).flatMap(([field, [list, free]]) => (O[list] || []).map((value, index) => {
    const id = field + ':' + value, gated = GATES[id] || null, passTier = PASS[id] || null, earned = WORLD_ITEM[id] || null;
    const cost = index < free || gated || passTier || earned ? 0 : PRICES[id] != null ? PRICES[id] : field === 'outfit' ? 70 + (index - free) * 8 : 25 + (index - free) * 10;
    const category = (CATEGORIES.find((c) => c.fields.includes(field)) || {}).id || 'flair';
    return { id, field, value, name: O.label(value), cost, achievement: gated, pass: passTier ? SEASON.id : null, passTier, free: index < free, category,
      world: earned ? earned.world : null, worldGames: earned ? earned.games : null,
      description: earned ? `Earned by finishing ${earned.games === 1 ? 'a game' : earned.games + ' games'} in the ${WORLD_NAMES[earned.world]} world.` : DESCRIPTIONS[id] || `A ${O.label(value).toLowerCase()} ${KIND[field] || 'item'}${index < free ? ' (free for everyone).' : ' for your ' + (slotOf(field).target === 'home' ? 'house.' : 'townsfolk.')}` };
  }));
  // ----- Shop stock: what each player can buy grows as they play -----
  // Gold items (not free, not pass/world/achievement rewards) start hidden. A new player sees
  // a small starter stock; finishing games, winning and visiting new worlds put more on the
  // shelves (cheapest first, a mix of kinds). Hidden items cannot be bought.
  const STOCK = { starterPerField: 2, finished: 1, won: 1, newWorld: 2 };
  const STOCKABLE = CATALOG.filter((i) => !i.free && !i.pass && !i.world && !i.achievement && i.cost > 0);
  const stockOrder = (a, b) => a.cost - b.cost || CATALOG.indexOf(a) - CATALOG.indexOf(b);
  const STARTER_STOCK = Object.keys(FIELDS).flatMap((f) => STOCKABLE.filter((i) => i.field === f).sort(stockOrder).slice(0, STOCK.starterPerField).map((i) => i.id));
  // The next n hidden items to reveal: the cheapest of each kind in turn, so a reveal mixes
  // clothes, hats, house designs, flair... (deterministic, so tests and players can predict it).
  function nextStock(stock, n) {
    const have = new Set(stock), out = [];
    const byField = Object.keys(FIELDS).map((f) => STOCKABLE.filter((i) => i.field === f && !have.has(i.id)).sort(stockOrder)).filter((l) => l.length);
    const start = have.size % Math.max(1, byField.length);
    for (let round = 0; out.length < n && byField.some((l) => l.length); round++) {
      for (let k = 0; k < byField.length && out.length < n; k++) { const l = byField[(start + k) % byField.length]; if (l.length) out.push(l.shift().id); }
    }
    return out;
  }

  // ----- Fate Tokens ✦: a second currency for one-time Fate Cards (not cosmetics) -----
  // Earned by winning, finishing weekly challenges and visiting new worlds (or traded for
  // gold). Cards bend which role you get; each is spent only if it actually takes effect.
  const FATE = {
    starter: 2, exchangeGold: 120, perWin: 1, perChallenge: 1, perNewWorld: 1,
    cards: {
      wish: { name: 'Role Wish', icon: '🎯', cost: 2, text: 'Before the game, wish for a role. If that role is in the game, it is dealt to you. Spent only if it comes true.' },
      team: { name: 'Team Wish', icon: '⚖️', cost: 1, text: 'Before the game, lean toward the Town or the Mafia. You are dealt a role from that side if the game has a free one. Spent only if it comes true.' },
      reroll: { name: 'Reroll', icon: '🔄', cost: 1, text: 'While you look at your dealt role, swap it once for a different role on the same team.' },
    },
  };

  // Gold rewards per completed game, calculated and paid by the server once per game.
  // Every value is configurable here. Per-category caps and maxPerGame stop players
  // from farming repeated actions; games with bots, forced roles, sped-up clocks,
  // skipped cinematics, fewer than 3 people, or shorter than minimumGameMs pay nothing.
  const REWARDS = {
    completed: 8,          // finished the game
    victory: 12,           // your side won
    neutralVictory: 8,     // extra for a neutral (Jester, Serial Killer, ...) win
    survived: 3,           // alive at the end
    ability: 2, abilityCap: 3,             // role-specific actions used (counted up to the cap)
    objective: 5, objectiveCap: 2,         // objectives completed
    investigation: 3, investigationCap: 3, // correct investigations
    save: 4, saveCap: 2,                   // helping teammates: saves/protections that mattered
    achievement: 10,                       // each achievement unlocked by this game
    maxPerGame: 60, minimumGameMs: 60000,
  };
  const API = { FIELDS, CATEGORIES, CATALOG, ACHIEVEMENTS, REWARDS, slotOf, PRICES, DESCRIPTIONS, SEASON, PASS, CHALLENGES, weekKey, weeklyChallenges, EVENTS, WORLD_REWARDS, WORLD_ITEM, WORLD_NAMES, STOCK, STOCKABLE, STARTER_STOCK, nextStock, FATE };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.MT_COSMETICS = API;
})(typeof window !== 'undefined' ? window : globalThis);
