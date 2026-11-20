// Seasonal events for the whole box (shared by the server and the pages).
//
// A new event every half month, all year, with no gaps: the 1st–15th and the 16th–end of every
// month (UTC). Each window has one kind of event: the real holiday that falls in it where there is
// one (New Year, Valentine's, St Patrick's, Easter time, Earth Day, …) and an original box event
// where there isn't (Neon Nights, Dino Days, Robot Rumble, Blood Moon, …). The calendar is a rule,
// not a list, so it works for any year. An event gives the box a theme (colours, a name, an icon,
// the title screen's animated background: public/hub-events.js), its own event challenges and
// season-pass track (box/progress.js, public/shared/challenges.js) and limited-time shop items
// and a full themed set that can only be bought while it runs (public/shared/shop-season.js).
// Items bought during an event stay owned; the same kind (and the same items) returns every year.
//
//   KINDS: { kind: { name, icon, blurb, holiday (the real day it marks, or null: an original box
//            event), theme: { a, b, c } (accent colours), slot (0..23: which half month) } }
//   CALENDAR: [kind × 24]: CALENDAR[month * 2 + (day > 15 ? 1 : 0)]
//   ITEMS: { kind: [catalog ids sold only while that kind of event runs] }
//   SET_ITEMS: { kind: [the event's full themed set: one piece per look field] }
//   seasonAt(now)                    -> the event running at that time (always one)
//   currentSeason(now = clock())     -> the running event (null only for an unknown kind)
//   nextSeason(now = clock())        -> the next one to start (for "coming soon")
//   nextOfKind(kind, now)            -> the next time that kind of event starts
//   seasonById('harvest-2026')       -> that event (or null): ids are `<kind>-<year it starts>`
//   isSeasonId(id)                   -> true for a real event id
//   seasonsBetween(from, to)         -> every event that overlaps [from, to)
//   daysLeft(season, now)            -> whole days until it ends
//   SEASONS: the events from last year to two years ahead (a convenience list; use the functions).
//   clock(): Date.now(), except on a page opened with ?eventDate=YYYY-MM-DD (testing only: the
//            pages pretend it is that date, so the hub background and banners can be previewed).
//
//   season = { id, kind, name, icon, blurb, holiday, start: 'YYYY-MM-DD', end: 'YYYY-MM-DD'
//              (inclusive, UTC), theme: { a, b, c }, items: [ids], set: [ids], challenges: [] }
(function (root) {
  // The kinds of event, in calendar order (two per month). `holiday: null` = an original event.
  const KINDS = {
    newyear: { name: 'New Year Countdown', icon: '🎊', holiday: 'New Year', blurb: 'Confetti, glitter and a countdown to midnight.', theme: { a: '#ffd25a', b: '#1a1640', c: '#f4f1ff' } },
    lantern: { name: 'Lantern Festival', icon: '🏮', holiday: 'Lunar New Year time', blurb: 'Paper lanterns float up into a warm night sky.', theme: { a: '#ff4a3a', b: '#5a0d14', c: '#ffd27a' } },
    hearts: { name: 'Sweetheart Week', icon: '💘', holiday: 'Valentine’s Day', blurb: 'Pink, red and very extra.', theme: { a: '#ff5c8a', b: '#7a1035', c: '#ffd0de' } },
    carnival: { name: 'Carnival', icon: '🎭', holiday: 'Carnival season', blurb: 'Masks, feathers, beads and a parade through every game.', theme: { a: '#b45cff', b: '#1f4a2a', c: '#ffd23f' } },
    neon: { name: 'Neon Nights', icon: '🌃', holiday: null, blurb: 'The box after dark: glow sticks, light-up shoes and a synth beat.', theme: { a: '#ff3ad1', b: '#120a2b', c: '#3ae8ff' } },
    clover: { name: 'Lucky Clover', icon: '☘️', holiday: 'St Patrick’s Day', blurb: 'Four-leaf clovers, rainbows and a pot of gold at the end.', theme: { a: '#2ecc71', b: '#0f4a2a', c: '#ffd25a' } },
    bloom: { name: 'Spring Bloom', icon: '🌸', holiday: 'Easter time', blurb: 'Blossom, bunnies, painted eggs and spring cleaning.', theme: { a: '#ff9ed2', b: '#3f8f3a', c: '#fff4b0' } },
    earth: { name: 'Green Earth', icon: '🌍', holiday: 'Earth Day', blurb: 'Plant a seed, water it, watch the box turn green.', theme: { a: '#7ad04a', b: '#1d5a6a', c: '#e8ffc8' } },
    fiesta: { name: 'Fiesta Flowers', icon: '🪅', holiday: 'May flower festivals', blurb: 'Paper flowers, maracas and bright banners everywhere.', theme: { a: '#ff5a9a', b: '#0f6a7a', c: '#ffe14a' } },
    dino: { name: 'Dino Days', icon: '🦖', holiday: null, blurb: 'The dinosaurs are back, and they want to play.', theme: { a: '#8ad04a', b: '#3a2a14', c: '#ffb04a' } },
    deepsea: { name: 'Deep Sea', icon: '🐙', holiday: 'World Ocean Day', blurb: 'Dive down where the jellyfish glow.', theme: { a: '#3ae8d0', b: '#0a1f4a', c: '#b8f4ff' } },
    summer: { name: 'Summer Splash', icon: '🏖️', holiday: 'the summer solstice', blurb: 'Beach towels, shades and too much sunscreen.', theme: { a: '#2ec4ff', b: '#ff9f1a', c: '#fff6c8' } },
    fireworks: { name: 'Firework Fest', icon: '🎇', holiday: 'summer fireworks nights', blurb: 'Sparklers, marching bands and a sky full of fireworks.', theme: { a: '#ff4a5a', b: '#101a4a', c: '#ffe680' } },
    space: { name: 'Space Week', icon: '🚀', holiday: 'Moon landing day', blurb: 'Rockets, moon boots and one small step for the box.', theme: { a: '#8a7aff', b: '#0c0f2e', c: '#ffb04a' } },
    meteor: { name: 'Meteor Shower', icon: '☄️', holiday: 'the August meteor shower', blurb: 'Lie back, look up and make a wish on every shooting star.', theme: { a: '#7ab8ff', b: '#0d0a30', c: '#ffffff' } },
    school: { name: 'Back to School', icon: '🎒', holiday: 'back to school', blurb: 'Fresh pencils, new sneakers and paper planes in class.', theme: { a: '#ffcf3f', b: '#1f3f7a', c: '#ff6a4a' } },
    robot: { name: 'Robot Rumble', icon: '🤖', holiday: null, blurb: 'Beep boop. The robots have taken over the box.', theme: { a: '#4ae0ff', b: '#1c2333', c: '#ff8a3a' } },
    pirate: { name: 'Pirate Week', icon: '🏴‍☠️', holiday: 'Talk Like a Pirate Day', blurb: 'Hoist the sails and bury your treasure. Arr.', theme: { a: '#e0b24a', b: '#0f2a3a', c: '#f4e6c0' } },
    bloodmoon: { name: 'Blood Moon', icon: '🌕', holiday: null, blurb: 'The moon turns red, the bats come out and the wolves howl.', theme: { a: '#ff3a4a', b: '#1a0408', c: '#ffb0a0' } },
    spooky: { name: 'Spooky Season', icon: '🎃', holiday: 'Halloween', blurb: 'Ghosts, ghouls and haunted games.', theme: { a: '#ff7a1a', b: '#2a1240', c: '#b6ff5c' } },
    campfire: { name: 'Campfire Nights', icon: '🏕️', holiday: null, blurb: 'Toast a marshmallow and tell a story under the stars.', theme: { a: '#ff9a3a', b: '#14202a', c: '#ffe0a0' } },
    harvest: { name: 'Harvest Fest', icon: '🍂', holiday: 'Thanksgiving', blurb: 'Pumpkins, cider and cosy sweaters all over the box.', theme: { a: '#e8862a', b: '#7a2e12', c: '#ffd27a' } },
    gingerbread: { name: 'Gingerbread Town', icon: '🍪', holiday: null, blurb: 'Gumdrops, icing and a whole town made of cookies.', theme: { a: '#d9904a', b: '#4a2414', c: '#ffe8f0' } },
    frost: { name: 'Frostival', icon: '❄️', holiday: 'the winter holidays', blurb: 'Snow on every game, gifts in the shop.', theme: { a: '#7ad0ff', b: '#1d3a7a', c: '#ffffff' } },
  };
  // Half month -> kind: Jan 1–15, Jan 16–31, Feb 1–15, Feb 16–end, …, Dec 16–31.
  const CALENDAR = ['newyear', 'lantern', 'hearts', 'carnival', 'neon', 'clover', 'bloom', 'earth', 'fiesta', 'dino', 'deepsea', 'summer',
    'fireworks', 'space', 'meteor', 'school', 'robot', 'pirate', 'bloodmoon', 'spooky', 'campfire', 'harvest', 'gingerbread', 'frost'];
  CALENDAR.forEach((k, i) => { KINDS[k].slot = i; });

  // Limited-time shop items of each kind of event (public/shared/cosmetics.js ids). The same ids come
  // back every year the event runs again, and owners keep them (public/shared/shop-season.js).
  const ITEMS = {
    harvest: ['hat:pumpkinCap', 'hat:strawHat', 'outfit:cosySweater', 'outfit:flannel', 'accessory:autumnScarf', 'accessory:ciderMug', 'effect:fallingLeaves', 'nameplate:harvestMoon'],
    frost: ['hat:snowBeanie', 'hat:reindeerBand', 'outfit:uglySweater', 'accessory:candyCane', 'accessory:earmuffs', 'shoeStyle:iceSkates', 'effect:aurora', 'nameplate:frosted'],
    hearts: ['hat:heartBoppers', 'outfit:cupidCardigan', 'accessory:loveLetter', 'accessory:heartShades', 'accessory:cupidWings', 'effect:rosePetals', 'nameplate:sweetheart'],
    bloom: ['hat:bunnyEars', 'hat:gardenHat', 'outfit:gardener', 'accessory:bouquet', 'accessory:butterflyWings', 'shoeStyle:wellies', 'effect:butterflies', 'nameplate:blossom'],
    summer: ['hat:bucketHat', 'outfit:hawaiian', 'outfit:lifeguard', 'accessory:snorkel', 'accessory:surfboard', 'accessory:icePop', 'shoeStyle:flipFlops', 'effect:bubbles', 'nameplate:surf'],
    spooky: ['hat:witchHat', 'hat:devilHorns', 'outfit:skeleton', 'outfit:mummy', 'accessory:treatBucket', 'effect:ghostly', 'effect:batSwarm', 'nameplate:haunted'],
    // The half-month calendar (events v2): every other kind's own items.
    newyear: ['hat:starTiara', 'outfit:sequinSuit', 'accessory:partyHorn', 'accessory:starGlasses', 'shoeStyle:glitterShoes', 'effect:confetti', 'nameplate:midnight'],
    lantern: ['hat:tasselCap', 'outfit:silkJacket', 'accessory:paperLantern', 'accessory:paperFan', 'shoeStyle:silkSlippers', 'effect:skyLanterns', 'nameplate:lanternGlow'],
    carnival: ['hat:plumeHeaddress', 'outfit:harlequin', 'accessory:carnivalMask', 'accessory:beads', 'effect:streamers', 'nameplate:carnival'],
    neon: ['hat:neonVisor', 'outfit:glowJacket', 'accessory:glowSticks', 'accessory:shutterShades', 'shoeStyle:lightUpKicks', 'effect:neonRings', 'nameplate:synthwave'],
    clover: ['hat:cloverHat', 'outfit:luckyVest', 'accessory:potOfGold', 'accessory:rainbowScarf', 'shoeStyle:buckleShoes', 'effect:luckyClovers', 'nameplate:shamrock'],
    earth: ['hat:leafCrown', 'outfit:planterApron', 'accessory:seedling', 'accessory:wateringCan', 'shoeStyle:gardenClogs', 'effect:seedPuffs', 'nameplate:evergreen'],
    fiesta: ['hat:paperFlower', 'outfit:fiestaShirt', 'accessory:maracas', 'accessory:pinata', 'effect:paperFlags', 'nameplate:fiesta'],
    dino: ['hat:dinoHood', 'outfit:dinoOnesie', 'accessory:dinoTail', 'accessory:fossilBone', 'shoeStyle:dinoFeet', 'effect:pterodactyls', 'nameplate:fossil'],
    deepsea: ['hat:octopusHat', 'outfit:wetsuit', 'accessory:airTank', 'accessory:trident', 'shoeStyle:flippers', 'effect:jellyfish', 'nameplate:abyss'],
    fireworks: ['hat:sparklerCrown', 'outfit:bandJacket', 'accessory:sparkler', 'accessory:snareDrum', 'shoeStyle:bandBoots', 'effect:fireworkBursts', 'nameplate:skyburst'],
    space: ['hat:alienBoppers', 'outfit:flightSuit', 'accessory:jetpack', 'accessory:pocketPlanet', 'shoeStyle:moonBoots', 'effect:miniRockets', 'nameplate:galaxy'],
    meteor: ['hat:starCirclet', 'outfit:stargazerCloak', 'accessory:telescope', 'accessory:starPendant', 'effect:shootingStars', 'nameplate:stardust'],
    school: ['hat:propellerCap', 'outfit:varsityJacket', 'accessory:giantPencil', 'accessory:shinyApple', 'shoeStyle:sneakers', 'effect:paperPlanes', 'nameplate:chalkboard'],
    robot: ['hat:robotHelm', 'outfit:roboSuit', 'accessory:bigWrench', 'accessory:laserVisor', 'shoeStyle:mechBoots', 'effect:gears', 'nameplate:circuit'],
    pirate: ['hat:captainHat', 'outfit:deckhand', 'accessory:cutlass', 'accessory:spyglass', 'shoeStyle:buccaneerBoots', 'effect:seagulls', 'nameplate:treasure'],
    bloodmoon: ['hat:wolfEars', 'outfit:hunterCoat', 'accessory:crimsonCape', 'accessory:moonLantern', 'effect:redMoon', 'nameplate:crimson'],
    campfire: ['hat:rangerHat', 'outfit:campVest', 'accessory:marshmallow', 'accessory:campLantern', 'shoeStyle:hikingBoots', 'effect:campSparks', 'nameplate:campfire'],
    gingerbread: ['hat:gumdropCrown', 'outfit:gingerbreadSuit', 'accessory:lollipop', 'accessory:peppermintScarf', 'effect:sprinkles', 'nameplate:icing'],
  };
  // Each event's full themed set (sold as a bundle in the shop while the event runs; wearing all of
  // it pays a set bonus while that event runs: public/shared/shop-season.js EVENT_SETS).
  const SET_ITEMS = {
    newyear: ['hat:starTiara', 'outfit:sequinSuit', 'accessory:starGlasses', 'shoeStyle:glitterShoes', 'effect:confetti'],
    lantern: ['hat:tasselCap', 'outfit:silkJacket', 'accessory:paperLantern', 'shoeStyle:silkSlippers', 'effect:skyLanterns'],
    hearts: ['hat:heartBoppers', 'outfit:cupidCardigan', 'accessory:cupidWings', 'effect:rosePetals'],
    carnival: ['hat:plumeHeaddress', 'outfit:harlequin', 'accessory:carnivalMask', 'effect:streamers'],
    neon: ['hat:neonVisor', 'outfit:glowJacket', 'accessory:glowSticks', 'shoeStyle:lightUpKicks', 'effect:neonRings'],
    clover: ['hat:cloverHat', 'outfit:luckyVest', 'accessory:potOfGold', 'shoeStyle:buckleShoes', 'effect:luckyClovers'],
    bloom: ['hat:bunnyEars', 'outfit:gardener', 'accessory:butterflyWings', 'shoeStyle:wellies', 'effect:butterflies'],
    earth: ['hat:leafCrown', 'outfit:planterApron', 'accessory:wateringCan', 'shoeStyle:gardenClogs', 'effect:seedPuffs'],
    fiesta: ['hat:paperFlower', 'outfit:fiestaShirt', 'accessory:maracas', 'effect:paperFlags'],
    dino: ['hat:dinoHood', 'outfit:dinoOnesie', 'accessory:dinoTail', 'shoeStyle:dinoFeet', 'effect:pterodactyls'],
    deepsea: ['hat:octopusHat', 'outfit:wetsuit', 'accessory:airTank', 'shoeStyle:flippers', 'effect:jellyfish'],
    summer: ['hat:bucketHat', 'outfit:hawaiian', 'accessory:snorkel', 'shoeStyle:flipFlops', 'effect:bubbles'],
    fireworks: ['hat:sparklerCrown', 'outfit:bandJacket', 'accessory:sparkler', 'shoeStyle:bandBoots', 'effect:fireworkBursts'],
    space: ['hat:alienBoppers', 'outfit:flightSuit', 'accessory:jetpack', 'shoeStyle:moonBoots', 'effect:miniRockets'],
    meteor: ['hat:starCirclet', 'outfit:stargazerCloak', 'accessory:telescope', 'effect:shootingStars'],
    school: ['hat:propellerCap', 'outfit:varsityJacket', 'accessory:giantPencil', 'shoeStyle:sneakers', 'effect:paperPlanes'],
    robot: ['hat:robotHelm', 'outfit:roboSuit', 'accessory:bigWrench', 'shoeStyle:mechBoots', 'effect:gears'],
    pirate: ['hat:captainHat', 'outfit:deckhand', 'accessory:cutlass', 'shoeStyle:buccaneerBoots', 'effect:seagulls'],
    bloodmoon: ['hat:wolfEars', 'outfit:hunterCoat', 'accessory:crimsonCape', 'effect:redMoon'],
    spooky: ['hat:witchHat', 'outfit:skeleton', 'accessory:treatBucket', 'effect:ghostly'],
    campfire: ['hat:rangerHat', 'outfit:campVest', 'accessory:marshmallow', 'shoeStyle:hikingBoots', 'effect:campSparks'],
    harvest: ['hat:pumpkinCap', 'outfit:cosySweater', 'accessory:autumnScarf', 'effect:fallingLeaves'],
    gingerbread: ['hat:gumdropCrown', 'outfit:gingerbreadSuit', 'accessory:lollipop', 'effect:sprinkles'],
    frost: ['hat:snowBeanie', 'outfit:uglySweater', 'accessory:earmuffs', 'shoeStyle:iceSkates', 'effect:aurora'],
  };

  const DAY = 86400000;
  const pad = (n) => String(n).padStart(2, '0');
  const ymd = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`; // m: 0..11
  const t0 = (d) => Date.parse(d + 'T00:00:00Z'), t1 = (d) => Date.parse(d + 'T00:00:00Z') + DAY;
  const monthDays = (y, m) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const cache = new Map();
  // The event in one half month: year, month 0..11, half 0 (1st–15th) or 1 (16th–end).
  function build(y, m, half) {
    const key = y * 24 + m * 2 + half;
    if (cache.has(key)) return cache.get(key);
    const kind = CALENDAR[m * 2 + half], K = KINDS[kind];
    const s = { id: `${kind}-${y}`, kind, name: K.name, icon: K.icon, blurb: K.blurb, holiday: K.holiday, start: ymd(y, m, half ? 16 : 1), end: ymd(y, m, half ? monthDays(y, m) : 15),
      theme: { ...K.theme }, items: ITEMS[kind].slice(), set: SET_ITEMS[kind].slice(), challenges: [] };
    if (cache.size > 400) cache.clear();
    cache.set(key, s);
    return s;
  }
  const slotOf = (now) => { const d = new Date(now); return { y: d.getUTCFullYear(), m: d.getUTCMonth(), half: d.getUTCDate() > 15 ? 1 : 0 }; };
  const step = ({ y, m, half }, n) => { let i = y * 24 + m * 2 + half + n; const yy = Math.floor(i / 24); i -= yy * 24; return { y: yy, m: Math.floor(i / 2), half: i % 2 }; };
  function seasonAt(now) { if (!Number.isFinite(now)) return null; const { y, m, half } = slotOf(now); return build(y, m, half); }

  // Testing only: ?eventDate=YYYY-MM-DD on a page makes it pretend to be that date (noon UTC, and
  // the clock keeps running from there), so every event's look can be previewed. Never on the server.
  let offset = 0;
  try {
    const q = typeof location !== 'undefined' && location.search ? new URLSearchParams(location.search).get('eventDate') : null;
    if (q && /^\d{4}-\d{2}-\d{2}$/.test(q) && Number.isFinite(t0(q))) offset = t0(q) + DAY / 2 - Date.now();
  } catch (e) { offset = 0; }
  const clock = () => Date.now() + offset;

  function currentSeason(now = clock()) { return seasonAt(now); }
  function nextSeason(now = clock()) { const s = slotOf(now), n = step(s, 1); return build(n.y, n.m, n.half); }
  function nextOfKind(kind, now = clock()) {
    if (!KINDS[kind]) return null;
    const s = slotOf(now);
    for (let i = 1; i <= 24; i++) { const n = step(s, i); if (CALENDAR[n.m * 2 + n.half] === kind) return build(n.y, n.m, n.half); }
    return null;
  }
  function seasonById(id) {
    const m = /^([a-z]+)-(\d{4})$/.exec(String(id || '')); if (!m || !KINDS[m[1]]) return null;
    const slot = KINDS[m[1]].slot; return build(Number(m[2]), Math.floor(slot / 2), slot % 2);
  }
  const isSeasonId = (id) => !!seasonById(id);
  function seasonsBetween(from, to) {
    const out = []; let s = slotOf(from);
    for (let i = 0; i < 24 * 6; i++) { const e = build(s.y, s.m, s.half); if (t0(e.start) >= to) break; if (t1(e.end) > from) out.push(e); s = step(s, 1); }
    return out;
  }
  function daysLeft(s, now = clock()) { return s ? Math.max(0, Math.ceil((t1(s.end) - now) / DAY)) : 0; }
  // A convenience list (last year to two years ahead). The functions above work for any date.
  const Y = new Date().getUTCFullYear();
  const SEASONS = seasonsBetween(Date.UTC(Y - 1, 0, 1), Date.UTC(Y + 3, 0, 1));
  const kindOf = (seasonId) => { const s = seasonById(seasonId); return s ? s.kind : null; };

  const API = { KINDS, CALENDAR, ITEMS, SET_ITEMS, SEASONS, seasonAt, currentSeason, nextSeason, nextOfKind, seasonById, isSeasonId, kindOf, seasonsBetween, daysLeft, clock };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (root) root.MT_SEASONS = API;
})(typeof window !== 'undefined' ? window : null);
