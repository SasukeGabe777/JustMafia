// Profile progression for the whole box (shared by the server and the pages): player levels,
// daily and weekly challenges, event (season) challenges and the box-wide season pass track.
// The rules that apply them live in box/progress.js; this file only holds definitions and pure
// functions so the phones can show the same numbers the server uses.
//
//   levelOf(xp)                 -> { level, into, need, total }   (level 1..∞, gentle curve)
//   levelReward(level)          -> { gold, item?, title? }         (paid when you reach it)
//   badgeOf(level)              -> { name, color, icon }           (the badge next to your name)
//   dayKey(now) / weekKey(now)  -> 'YYYY-MM-DD' / 'YYYY-Www' (UTC: a new day starts at 00:00 UTC)
//   dailyIds(day, rerolls)      -> 3 challenge ids (deterministic per day)
//   weeklyIds(week)             -> 5 challenge ids (deterministic per week)
//   challenge(id, period)       -> { id, icon, label, count, xp, gold, stat, arg }
//   eventChallenges(seasonId)   -> 3 event challenges for that season
//   passTrack(season, catalogHas) -> [{ tier, free, premium }] (season items on the premium track)
(function (root) {
  const DAY = 86400000;
  // ---------- levels ----------
  // XP to go from level L to L+1: 100, 120, 140, … then flat at 600 (level 26+), so it never stops.
  const LEVEL = { base: 100, step: 20, max: 600 };
  const needFor = (L) => Math.min(LEVEL.max, LEVEL.base + LEVEL.step * (L - 1));
  function levelOf(xp) {
    let level = 1, left = Math.max(0, Math.floor(Number(xp) || 0));
    while (left >= needFor(level) && level < 100000) { left -= needFor(level); level++; }
    return { level, into: left, need: needFor(level), total: Math.max(0, Math.floor(Number(xp) || 0)) };
  }
  // Badge colours by level band (shown next to the name everywhere).
  const BADGES = [
    { min: 1, name: 'Bronze', color: '#c98b4f', icon: '🥉' },
    { min: 10, name: 'Silver', color: '#b8c4d6', icon: '🥈' },
    { min: 20, name: 'Gold', color: '#ffcf3f', icon: '🥇' },
    { min: 30, name: 'Platinum', color: '#7fe3d6', icon: '💠' },
    { min: 50, name: 'Diamond', color: '#8ab8ff', icon: '💎' },
    { min: 75, name: 'Mythic', color: '#d58bff', icon: '🔮' },
    { min: 100, name: 'Legend', color: '#ff7a59', icon: '👑' },
  ];
  const badgeOf = (level) => BADGES.filter((b) => level >= b.min).pop() || BADGES[0];
  // Titles you can wear (from the 🏆 My profile sheet), earned every 10 levels.
  const LEVEL_TITLES = { 5: 'Rookie', 10: 'Regular', 20: 'Veteran', 30: 'Elite', 40: 'Champion', 50: 'Master', 75: 'Grandmaster', 100: 'Legend of the Box' };
  // Every 5th level gives an item (the first of these you don't own yet; gold if you own them all).
  const LEVEL_ITEMS = ['effect:fireflies', 'hat:crown', 'nameplate:veteran', 'effect:sparkles', 'nameplate:neon', 'effect:snow', 'nameplate:royal', 'effect:hearts', 'effect:shadow'];
  function levelReward(level) {
    const r = { gold: Math.min(40, 5 + level) };
    if (level % 5 === 0) r.item = true; // which item: box/progress.js picks the first unowned of LEVEL_ITEMS
    if (LEVEL_TITLES[level]) r.title = LEVEL_TITLES[level];
    return r;
  }

  // ---------- XP for finishing games ----------
  // Box games: play + top half + win, scaled by how long the game ran (like JustGold, ×0.6–2.5).
  // JustMafia: finished / won / survived (× the Judge's event multiplier). Party Mode: a finale bonus.
  const XP = {
    box: { play: 20, top: 8, win: 15, coop: 14 },
    mafia: { completed: 40, won: 25, survived: 10 },
    party: { all: 50, places: [30, 20, 10] },
  };
  const scaleOf = (ms) => Math.max(0.6, Math.min(2.5, (Number(ms) || 0) / (12 * 60 * 1000)));
  const COOP = ['escape', 'bomb', 'marble'];
  function boxXp(game, place, of, ms) {
    let n = XP.box.play;
    if (COOP.includes(game)) n += XP.box.coop;
    else { if (place && place <= Math.ceil(of / 2)) n += XP.box.top; if (place === 1 && of > 1) n += XP.box.win; }
    return Math.max(5, Math.round(n * scaleOf(ms)));
  }
  const partyXp = (place) => XP.party.all + (XP.party.places[place - 1] || 0);
  const mafiaXp = (won, alive, mult = 1) => Math.round((XP.mafia.completed + (won ? XP.mafia.won : 0) + (alive ? XP.mafia.survived : 0)) * (mult || 1));

  // ---------- game names and groups (for challenge labels) ----------
  const GAMES = {
    president: ['President', '👑'], blackjack: ['Blackjack Night', '🃏'], ducks: ['JustRaiseDucks', '🦆'], blanks: ['JustBlanks', '📝'], truths: ['Two Truths & a Lie', '🤥'],
    funny: ['JustFunny', '😂'], sketch: ['JustSketch Relay', '✏️'], whosaid: ['Who Said It?', '💬'], price: ['Price Panic', '💸'], emoji: ['Emoji Charades', '🎭'],
    likely: ['Most Likely To…', '👉'], spectrum: ['Where Do You Stand?', '📏'], bid: ['JustBid', '🔨'], kingdoms: ['JustKingdoms', '🏰'], zombie: ['Zombie Survival', '🧟'],
    undercover: ['JustUndercover', '🕵️'], snap: ['JustSnap', '📸'], pizza: ['JustPizza', '🍕'], escape: ['JustEscape', '🔐'], marble: ['JustMarble', '🔮'],
    debate: ['Debate Club', '🗣️'], actout: ['Act It Out', '🎭'], tune: ['Tune Buzz', '🎵'], alien: ['Alien Abduction', '🛸'], bomb: ['Bomb Squad', '💣'],
    quickdraw: ['Quick Draw', '⚡'], summon: ['JustSummon', '🕯️'], letters: ['Letter Rush', '🔤'], memes: ['Meme Maker', '🖼️'], colormatch: ['Color Match', '🎨'],
    trivia: ['Hot Take Trivia', '🧠'], plinko: ['JustDrop', '🎯'], mafia: ['JustMafia', '🔪'],
  };
  const gameName = (k) => (GAMES[k] ? GAMES[k][0] : k);
  const GROUPS = {
    cards: ['president', 'blackjack', 'bid', 'plinko', 'blanks'],
    guess: ['price', 'emoji', 'tune', 'quickdraw', 'colormatch', 'trivia'],
    bluff: ['truths', 'likely', 'debate', 'alien', 'whosaid', 'undercover', 'spectrum'],
    create: ['sketch', 'memes', 'funny', 'snap', 'actout', 'letters', 'blanks'],
    coop: ['escape', 'bomb', 'marble', 'pizza', 'zombie'],
  };
  // "Game of the day": always-unlocked games that fit an evening (not the big ones).
  const SPOTLIGHT = ['president', 'blackjack', 'blanks', 'truths', 'funny', 'sketch', 'whosaid', 'price', 'emoji', 'likely', 'spectrum', 'bid', 'undercover', 'snap', 'pizza', 'escape', 'marble'];

  // ---------- the challenge pool ----------
  // stat: what counts (box/progress.js counts it from each finished game). d / w: the count for a
  // daily / weekly version (null: not offered then). slot: easy | mid | hard (how they are mixed).
  // Rewards scale with the count: xp/gold are per daily or weekly version.
  const POOL = [
    { id: 'games', icon: '🎮', text: 'Finish {n} games of any kind', stat: 'games', d: 2, w: 10, slot: 'easy' },
    { id: 'distinct', icon: '🧭', text: 'Play {n} different games', stat: 'distinct', d: 3, w: 6, slot: 'easy' },
    { id: 'top3', icon: '🥉', text: 'Land in the top 3 of {n} games', stat: 'top3', d: 2, w: 8, slot: 'easy' },
    { id: 'gold', icon: '🪙', text: 'Earn {n} JustGold from games', stat: 'gold', d: 25, w: 150, slot: 'easy' },
    { id: 'cards', icon: '🃏', text: 'Play {n} card or casino games', stat: 'group', arg: 'cards', d: 2, w: 5, slot: 'easy' },
    { id: 'guess', icon: '🔮', text: 'Play {n} guessing games', stat: 'group', arg: 'guess', d: 2, w: 5, slot: 'easy' },
    { id: 'bluff', icon: '🤥', text: 'Play {n} bluffing or voting games', stat: 'group', arg: 'bluff', d: 2, w: 5, slot: 'easy' },
    { id: 'create', icon: '🎨', text: 'Play {n} drawing or creative games', stat: 'group', arg: 'create', d: 2, w: 5, slot: 'easy' },
    { id: 'coop', icon: '🤝', text: 'Play {n} team-up games', stat: 'group', arg: 'coop', d: 1, w: 3, slot: 'easy' },
    { id: 'wins', icon: '🏆', text: 'Win {n} games', stat: 'wins', d: 1, w: 4, slot: 'mid' },
    { id: 'party', icon: '🎉', text: 'Play a whole Party Mode', textN: 'Play {n} whole Party Modes', stat: 'party', d: 1, w: 2, slot: 'mid' },
    { id: 'hands', icon: '🂡', text: 'Win {n} hands at Blackjack Night', stat: 'tag', arg: 'hands', d: 4, w: 15, slot: 'mid' },
    { id: 'bjWin', icon: '♠️', text: 'Win a game of Blackjack Night', textN: 'Win {n} games of Blackjack Night', stat: 'win', arg: 'blackjack', d: 1, w: 2, slot: 'hard' },
    { id: 'cover', icon: '📸', text: 'Get a photo on the cover in JustSnap', textN: 'Get {n} covers in JustSnap', stat: 'tag', arg: 'cover', d: 1, w: 3, slot: 'mid' },
    { id: 'mole', icon: '🕵️', text: 'Catch the mole in JustUndercover', textN: 'Catch the mole {n} times in JustUndercover', stat: 'tag', arg: 'mole', d: 1, w: 3, slot: 'mid' },
    { id: 'zsurvive', icon: '🧟', text: 'Survive Zombie Survival', textN: 'Survive Zombie Survival {n} times', stat: 'tag', arg: 'zsurvive', d: null, w: 2, slot: 'hard' },
    { id: 'mafia', icon: '🔪', text: 'Play a game of JustMafia', textN: 'Play {n} games of JustMafia', stat: 'play', arg: 'mafia', d: 1, w: 3, slot: 'mid' },
    { id: 'mafiaSurvive', icon: '🌙', text: 'Survive to the end of a JustMafia game', textN: 'Survive to the end of {n} JustMafia games', stat: 'mafiaSurvive', d: 1, w: 2, slot: 'mid' },
    { id: 'mafiaWin', icon: '⚖️', text: 'Win a game of JustMafia', textN: 'Win {n} games of JustMafia', stat: 'win', arg: 'mafia', d: 1, w: 2, slot: 'hard' },
    { id: 'asMafia', icon: '🩸', text: 'Win as the Mafia', stat: 'asMafia', d: null, w: 1, slot: 'hard' },
    { id: 'saves', icon: '🛡️', text: 'Save someone from an attack in JustMafia', stat: 'mafiaMetric', arg: 'saves', d: null, w: 1, slot: 'hard' },
    { id: 'catch', icon: '🔍', text: 'Catch a Mafia member with an investigation', stat: 'mafiaMetric', arg: 'correctInvestigations', d: null, w: 1, slot: 'hard' },
    { id: 'abilities', icon: '✨', text: 'Use your JustMafia role’s ability {n} times', stat: 'mafiaMetric', arg: 'abilities', d: 3, w: 8, slot: 'mid' },
    { id: 'partyTop3', icon: '🎊', text: 'Finish a Party Mode in the top 3', stat: 'partyTop3', d: null, w: 1, slot: 'hard' },
    { id: 'winStreak', icon: '🔥', text: 'Win {n} games', stat: 'wins', d: null, w: 8, slot: 'hard' },
    { id: 'marathon', icon: '🏃', text: 'Finish {n} games of any kind', stat: 'games', d: null, w: 20, slot: 'hard' },
    { id: 'explorer', icon: '🗺️', text: 'Play {n} different games', stat: 'distinct', d: null, w: 10, slot: 'hard' },
  ];
  // "Game of the day": play (daily) or win (weekly) one particular game.
  for (const k of SPOTLIGHT) {
    POOL.push({ id: 'play:' + k, icon: GAMES[k][1], text: `Play a game of ${GAMES[k][0]}`, textN: `Play {n} games of ${GAMES[k][0]}`, stat: 'play', arg: k, d: 1, w: 3, slot: 'spot' });
  }
  const BY_ID = Object.fromEntries(POOL.map((c) => [c.id, c]));
  // Rewards by slot and period.
  const REWARD = {
    daily: { easy: { xp: 60, gold: 10 }, mid: { xp: 90, gold: 15 }, hard: { xp: 120, gold: 20 }, spot: { xp: 70, gold: 10 } },
    weekly: { easy: { xp: 200, gold: 40 }, mid: { xp: 260, gold: 50 }, hard: { xp: 350, gold: 75 }, spot: { xp: 220, gold: 40 } },
  };
  function challenge(id, period) {
    const c = BY_ID[id]; if (!c) return null;
    const n = period === 'weekly' ? c.w : c.d; if (n == null) return null;
    const r = REWARD[period][c.slot];
    return { id, icon: c.icon, label: (n > 1 && c.textN ? c.textN : c.text).replace('{n}', n), count: n, xp: r.xp, gold: r.gold, stat: c.stat, arg: c.arg || null, slot: c.slot };
  }

  // ---------- deterministic picks ----------
  const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0; h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0; return (h ^ (h >>> 13)) >>> 0; };
  // The k-th candidate of a slot for a key (a stable shuffle of that slot's pool).
  function nthOf(key, slot, period, k) {
    const list = POOL.filter((c) => c.slot === slot && (period === 'weekly' ? c.w != null : c.d != null)).map((c) => c.id);
    return list.slice().sort((a, b) => hash(key + ':' + a) - hash(key + ':' + b))[k % list.length];
  }
  // A new day starts at 00:00 UTC (the same moment for every phone and the server).
  const dayKey = (now = Date.now()) => new Date(now).toISOString().slice(0, 10);
  const weekKey = (now = Date.now()) => { const date = new Date(now), d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())); const day = d.getUTCDay() || 7; d.setUTCDate(d.getUTCDate() + 4 - day); const y = d.getUTCFullYear(); return `${y}-W${String(Math.ceil(((d - Date.UTC(y, 0, 1)) / DAY + 1) / 7)).padStart(2, '0')}`; };
  const DAILY_SLOTS = ['easy', 'mid', 'spot'], WEEKLY_SLOTS = ['easy', 'easy', 'mid', 'mid', 'hard'];
  function pick(key, slots, period) {
    const out = [];
    slots.forEach((slot) => { for (let k = 0; k < 40; k++) { const id = nthOf(key, slot, period, k); if (!out.includes(id)) { out.push(id); break; } } });
    return out;
  }
  const dailyIds = (day) => pick('d:' + day, DAILY_SLOTS, 'daily');
  const weeklyIds = (week) => pick('w:' + week, WEEKLY_SLOTS, 'weekly');
  // A reroll swaps one challenge for the next one of the same slot that isn't on the list.
  function rerollId(key, period, id, list) {
    const c = BY_ID[id]; if (!c) return null;
    for (let k = 0; k < 60; k++) { const n = nthOf((period === 'weekly' ? 'w:' : 'd:') + key, c.slot, period, k + 1 + list.length * 7); if (n && !list.includes(n)) return n; }
    return null;
  }
  const REROLLS_PER_DAY = 1;

  // ---------- event (season) challenges: 2–3 special ones per season ----------
  const EVENT_CHALLENGES = {
    'harvest-2026': [
      { id: 'ev:harvest:games', icon: '🍂', label: 'Play 12 games during Harvest Fest', stat: 'games', count: 12, xp: 500, gold: 80 },
      { id: 'ev:harvest:distinct', icon: '🥧', label: 'Try 6 different games', stat: 'distinct', count: 6, xp: 400, gold: 60 },
      { id: 'ev:harvest:party', icon: '🎃', label: 'Finish 2 Party Modes', stat: 'party', count: 2, xp: 500, gold: 80 },
    ],
    'frost-2026': [
      { id: 'ev:frost:games', icon: '❄️', label: 'Play 15 games during Frostival', stat: 'games', count: 15, xp: 500, gold: 80 },
      { id: 'ev:frost:wins', icon: '🎁', label: 'Win 5 games', stat: 'wins', count: 5, xp: 500, gold: 80 },
      { id: 'ev:frost:coop', icon: '⛄', label: 'Play 4 team-up games', stat: 'group', arg: 'coop', count: 4, xp: 400, gold: 60 },
    ],
    'hearts-2027': [
      { id: 'ev:hearts:games', icon: '💘', label: 'Play 10 games during Sweetheart Week', stat: 'games', count: 10, xp: 450, gold: 70 },
      { id: 'ev:hearts:bluff', icon: '💌', label: 'Play 5 bluffing or voting games', stat: 'group', arg: 'bluff', count: 5, xp: 400, gold: 60 },
    ],
    'bloom-2027': [
      { id: 'ev:bloom:games', icon: '🌸', label: 'Play 15 games during Spring Bloom', stat: 'games', count: 15, xp: 500, gold: 80 },
      { id: 'ev:bloom:create', icon: '🌷', label: 'Play 6 drawing or creative games', stat: 'group', arg: 'create', count: 6, xp: 450, gold: 70 },
      { id: 'ev:bloom:top3', icon: '🐝', label: 'Finish in the top 3 eight times', stat: 'top3', count: 8, xp: 450, gold: 70 },
    ],
    'summer-2027': [
      { id: 'ev:summer:games', icon: '🏖️', label: 'Play 20 games during Summer Splash', stat: 'games', count: 20, xp: 600, gold: 100 },
      { id: 'ev:summer:distinct', icon: '🌊', label: 'Try 10 different games', stat: 'distinct', count: 10, xp: 500, gold: 80 },
      { id: 'ev:summer:party', icon: '🍹', label: 'Finish 3 Party Modes', stat: 'party', count: 3, xp: 600, gold: 100 },
    ],
    'spooky-2027': [
      { id: 'ev:spooky:games', icon: '🎃', label: 'Play 15 games during Spooky Season', stat: 'games', count: 15, xp: 500, gold: 80 },
      { id: 'ev:spooky:mafia', icon: '🔪', label: 'Play 3 games of JustMafia', stat: 'play', arg: 'mafia', count: 3, xp: 450, gold: 70 },
      { id: 'ev:spooky:zombie', icon: '🧟', label: 'Survive Zombie Survival', stat: 'tag', arg: 'zsurvive', count: 1, xp: 450, gold: 70 },
    ],
  };
  // Any season without its own list gets these three.
  const eventChallenges = (seasonId) => (EVENT_CHALLENGES[seasonId] || [
    { id: `ev:${seasonId}:games`, icon: '🎪', label: 'Play 12 games during the event', stat: 'games', count: 12, xp: 500, gold: 80 },
    { id: `ev:${seasonId}:wins`, icon: '🏆', label: 'Win 4 games', stat: 'wins', count: 4, xp: 450, gold: 70 },
    { id: `ev:${seasonId}:distinct`, icon: '🧭', label: 'Try 6 different games', stat: 'distinct', count: 6, xp: 400, gold: 60 },
  ]).map((c) => ({ ...c, arg: c.arg || null }));

  // ---------- the season pass (one per seasonal event, public/shared/seasons.js) ----------
  // Season XP = every bit of XP earned while the event runs. Free track: JustGold every other
  // tier and a title at the end. Premium track (bought with JustGold): JustGold on every tier and
  // the event's limited items (season.items; until the shop fills them, a few existing items).
  const PASS = { tiers: 25, xpPerTier: 120, cost: 195 };
  const FALLBACK_ITEMS = ['effect:bloodMist', 'hat:bloodCrown', 'nameplate:bloodMoon', 'accessory:batWings', 'reactions:rxBloodMoon', 'outfit:vampire', 'effect:lightning', 'outfit:bloodKnight'];
  // catalogHas(id) -> is that item real? Missing ids are skipped (the tier pays JustGold instead).
  function passTrack(season, catalogHas = () => true) {
    const items = ((season && Array.isArray(season.items) && season.items.length ? season.items : FALLBACK_ITEMS) || []).filter((id) => typeof id === 'string' && catalogHas(id)).slice(0, 12);
    // Spread the items over the premium track, the best (last) one at the final tier.
    const at = {};
    items.forEach((id, i) => {
      let t = items.length === 1 ? PASS.tiers : Math.round(3 + (i * (PASS.tiers - 3)) / (items.length - 1));
      t = Math.min(PASS.tiers, Math.max(1, t)); while (at[t] && t > 1) t--; if (!at[t]) at[t] = id;
    });
    const out = [];
    for (let t = 1; t <= PASS.tiers; t++) {
      const free = t === PASS.tiers ? { title: (season ? season.name : 'Season') + ' Hero' } : t % 2 === 0 ? { gold: 10 + Math.floor(t / 5) * 5 } : t % 5 === 0 ? { gold: 20 } : null;
      const premium = at[t] ? { item: at[t] } : { gold: 15 + Math.floor(t / 5) * 5 };
      out.push({ tier: t, free, premium });
    }
    return out;
  }

  const API = { LEVEL, needFor, levelOf, BADGES, badgeOf, LEVEL_TITLES, LEVEL_ITEMS, levelReward, XP, scaleOf, boxXp, partyXp, mafiaXp, GAMES, gameName, GROUPS, SPOTLIGHT, POOL, BY_ID, REWARD, challenge,
    dayKey, weekKey, dailyIds, weeklyIds, rerollId, REROLLS_PER_DAY, EVENT_CHALLENGES, eventChallenges, PASS, FALLBACK_ITEMS, passTrack, hash };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (root) root.MT_CHALLENGES = API;
})(typeof window !== 'undefined' ? window : null);
