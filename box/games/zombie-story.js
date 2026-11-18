'use strict';
// Zombie Survival: the story, the items, the story flags and every scenario (all original writing).
//
// The story runs over six days, one chapter each: the outbreak in the suburbs, the mall, the
// hospital, the highway, the farm, and the last night on a waterfront rooftop where the
// rescue comes. Each scene is a scenario with 3–5 options.
//
// HOW A FATE IS DECIDED (box/games/zombie.js does the sums; there are no per-person dice):
//   Your result in a scene depends only on the option you picked, what you carry, your
//   condition (fine / hurt / bitten) and the story FLAGS you earned earlier. Two people with
//   the same history who pick the same option always get the same result.
//   Results, best to worst: safe → hurt → bitten → dead.
//
// OPTION FIELDS
//   k, icon, label          id, emoji and the short label on the phone
//   anim                    how the TV acts it out: run climb fight hide sneak drive search hold decoy talk swim rest
//   danger                  0 calm · 1 risky · 2 dangerous · 3 deadly. The default result by difficulty:
//                              forgiving: safe safe hurt hurt · normal: safe safe hurt bitten · brutal: safe safe bitten dead
//                           ('risky' looks safe, but it is the likeliest to get a bad twist)
//                           (the group, the crowd and freezing move it a step)
//   outcomes: [rules]       what changes the default for YOU (see RULES below)
//   help: { item: 'safe' }  shorthand: carrying the item, you do no worse than that result (it gets
//                           used if it has uses: bullets, swings…). The best item you carry counts.
//   need: 'item'            only possible with that item
//   gain: 'item' | [..]     picked up when you come through (a list: the first one you don't have yet)
//   setFlag: 'flag'         a story flag you earn when you come through (any result but dead)
//   badFlag: 'flag'         a flag you earn when it goes wrong but you live (hurt or bitten)
//   heal                    cures an injury (and a bad ankle) · cure: cures a bite
//   role                    group dynamics, see the scenario's `group`
//   crowd                   + noisy when most of the group picks it (one step worse), − safety in numbers
//                           (one step better with a third of the group or more, at least two people)
//   hero                    bonus points for coming through it
//   ok / bad                what happened, after the names ("Ana and Ben … ok." / "… bad.")
// RULES (option.outcomes), checked for each person:
//   { if: COND, result: 'safe'|'hurt'|'bitten'|'dead', line, use, gain, setFlag }
//        an absolute verdict. The first matching `result` rule wins and nothing else counts.
//   { if: COND, shift: +1 | -1, line }   one step worse/better than the default. Every matching
//                                         shift counts (they stack), on top of `help`.
//   { if: COND, line }                    no change, just the reason the TV gives.
//   COND: { has: 'item' } · { flag: 'flag' } · { hurt: true } · { bitten: true } · { not: COND }
//         · { all: [COND…] } · { any: [COND…] }
//   line: what happened, after the names: "Ana and Ben " + line. A line with {who} is a sentence of
//         its own, with the names in place of {who} ("Because {who} left the door open…").
// SCENARIO `group` (optional; it depends on what everyone picked, so it's deterministic too)
//   { type: 'hold', need: 0.34, ok, bad }: the door holds if at least `need` of the survivors pick a
//      role 'hold' option (min 1). Held: role 'run' one step better. Not held: run and hold one step worse.
//   { type: 'cover', ok, bad, none: 1 }: if anyone picks a role 'cover' option, every other option is
//      one step better; if nobody does, `none` steps worse (default 1).
//   { type: 'vote', ok: { k: line }, gift: { k: item } }: the most-picked option wins; a winner
//      with a gift hands it to everyone who voted for it and came through.
// Each option also gets one room-wide twist per scene (seeded once for everybody): mostly none,
// sometimes it goes a step better or worse than it looked. Item caps and story verdicts beat it.
const ITEMS = {
  gun: { icon: '🔫', name: 'Pistol', uses: 3, unit: 'bullets', hint: 'Fights and last stands. Shots run out.' },
  medkit: { icon: '🩹', name: 'Medkit', uses: 1, hint: 'Cures a bite, or patches you up if you get hurt twice.' },
  rope: { icon: '🪢', name: 'Rope', hint: 'Climbs, gaps and long drops.' },
  flashlight: { icon: '🔦', name: 'Flashlight', hint: 'Anywhere dark. Basements, tunnels, cellars at night…' },
  bat: { icon: '🏏', name: 'Bat', uses: 3, unit: 'swings', hint: 'Close fights, and doors that need holding.' },
  keys: { icon: '🔑', name: 'Car keys', hint: 'Anything with an engine… if it has fuel.' },
  firecrackers: { icon: '🧨', name: 'Firecrackers', uses: 1, hint: 'A bang draws them away. One use.' },
  radio: { icon: '📻', name: 'Radio', hint: 'Someone out there might be listening.' },
};

// Story flags: things you did that the story remembers. `bad` ones come back to bite you.
const FLAGS = {
  helped_neighbor: { icon: '🤝', label: 'Saved Mrs. Delgado next door' },
  left_door_open: { icon: '🚪', label: 'Left Hank’s shutter open', bad: true },
  knows_back_route: { icon: '🗺️', label: 'Knows the back routes' },
  marked_by_horde: { icon: '🩸', label: 'The horde knows your scent', bad: true },
  has_dog: { icon: '🐕', label: 'Biscuit the dog tags along' },
  saved_tess: { icon: '🧸', label: 'Saved Tess from the toy store' },
  has_map: { icon: '🧭', label: 'Has a road map' },
  vaccinated: { icon: '💉', label: 'Took Dr. Okafor’s shot' },
  fuel_siphoned: { icon: '⛽', label: 'Carrying a can of fuel' },
  befriended_ranger: { icon: '🧢', label: 'Ranger Dot owes you one' },
  injured_leg: { icon: '🦵', label: 'Bad ankle', bad: true },
};

const CHAPTERS = [
  { key: 'outbreak', day: 1, name: 'The Outbreak', loc: 'streets', place: 'the suburbs', line: 'Day one. It started as a rumor on the evening news. By sundown, Maple Heights stopped answering its phones.' },
  { key: 'mall', day: 2, name: 'Galleria Mall', loc: 'mall', place: 'the mall', line: 'Day two. The mall was supposed to be a shelter. The muzak is still playing. So is everyone who stayed.' },
  { key: 'hospital', day: 3, name: 'Mercy Hill Hospital', loc: 'hospital', place: 'the hospital', line: 'Day three. Hospitals have medicine. Hospitals also have patients. Visiting hours are over.' },
  { key: 'highway', day: 4, name: 'Route 9', loc: 'highway', place: 'the highway', line: 'Day four. The radio says the coast is still safe. Forty miles of jammed highway stand in the way.' },
  { key: 'farm', day: 5, name: 'Hollow Creek Farm', loc: 'farm', place: 'the farm', line: 'Day five. A farmhouse, a barn and miles of corn. Quiet out here. Suspiciously quiet.' },
  { key: 'rescue', day: 6, name: 'The Last Night', loc: 'rescue', place: 'the last night', line: 'Day six. A voice on the radio: one last flight leaves the harbor rooftop at dawn. Be on it.' },
];

const o = (k, icon, label, anim, danger, extra = {}) => ({ k, icon, label, anim, danger, ...extra });
const has = (k) => ({ has: k }), flag = (f) => ({ flag: f }), not = (c) => ({ not: c });

// Lines shared by several scenes.
const DARK = {
  light: { if: has('flashlight'), result: 'safe', line: 'clicked on a flashlight, caught them in the beam and slipped past' },
  dog: { if: flag('has_dog'), result: 'hurt', line: 'had no light, but Biscuit growled a warning in the dark. A scrape, nothing worse' },
  none: { if: not(has('flashlight')), result: 'bitten', line: 'had no light. They never saw it coming' },
};
const SCENT = { if: flag('marked_by_horde'), shift: 1, line: 'The horde had {who}’s scent since day one, and found them again' };
const ANKLE = { if: flag('injured_leg'), shift: 1, line: '{who}’s bad ankle gave out at the worst moment' };
// The last night remembers day one.
const FINALE = (neighbor) => [
  { if: flag('helped_neighbor'), result: 'safe', line: neighbor },
  { if: flag('left_door_open'), shift: 1, line: 'Because {who} left Hank’s shutter open on day one, the horde followed them all the way here' },
  SCENT,
];

const SCENARIOS = [
  // ================= DAY 1 · THE OUTBREAK (suburban streets) =================
  { id: 'hardware', ch: 'outbreak', first: 1, title: 'The Hardware Store',
    text: 'The shutter of Hank’s Hardware is jammed half open and the lights still buzz. You’ve got ten seconds inside before the moaning reaches the corner. Grab ONE thing.',
    options: [
      o('medkit', '🩹', 'The first-aid kit', 'search', 0, { gain: 'medkit', ok: 'snatched the first-aid kit off the wall', bad: 'got grabbed by the guy in the paint aisle' }),
      o('gun', '🔫', 'The pistol behind the counter', 'search', 1, { gain: 'gun', ok: 'vaulted the counter and came back armed', bad: 'found Hank still behind the counter. Hank was not friendly' }),
      o('rope', '🪢', 'A coil of climbing rope', 'search', 0, { gain: 'rope', ok: 'slung a coil of rope over one shoulder', bad: 'tripped over the rope display' }),
      o('bat', '🏏', 'A sturdy bat', 'search', 0, { gain: 'bat', ok: 'picked a bat and gave it a practice swing', bad: 'swung too early and the whole shelf came down' }),
      o('flashlight', '🔦', 'The big flashlight', 'search', 0, { gain: 'flashlight', ok: 'clicked on a flashlight the size of a baguette', bad: 'got cornered in the dark storeroom' }),
    ] },
  { id: 'neighbor', ch: 'outbreak', first: 2, title: 'Mrs. Delgado Next Door',
    text: 'Back on the street, Mrs. Delgado is hammering on her kitchen window next door. Shamblers are rounding the corner. And Hank’s shutter is still wide open behind you.',
    options: [
      o('delgado', '🤝', 'Get Mrs. Delgado out', 'run', 2, { help: { gun: 'safe', bat: 'safe' }, setFlag: 'helped_neighbor', hero: 40, ok: 'pulled Mrs. Delgado out through her kitchen window. “My son flies rescue,” she said. “I won’t forget this”', bad: 'got Mrs. Delgado out, but not cleanly' }),
      o('shutter', '🚪', 'Pull Hank’s shutter down', 'hold', 1, { help: { bat: 'safe', rope: 'safe' }, ok: 'hauled Hank’s shutter down and wedged it shut', bad: 'got the shutter down with a shambler’s arm under it' }),
      o('run', '🏃', 'Just run', 'run', 0, { setFlag: 'left_door_open', ok: 'ran for it, leaving Hank’s shutter wide open behind them', bad: 'ran for it, but not fast enough' }),
    ] },
  { id: 'icecream', ch: 'outbreak', title: 'The Ice-Cream Truck',
    text: 'An abandoned ice-cream truck is stuck on repeat, blasting its jingle. Every shambler in the neighborhood is shuffling toward it… and toward you.',
    group: { type: 'cover', ok: 'The jingle rolled downhill and the horde waddled after it!', bad: 'Nobody moved the truck, and the jingle kept calling them closer.' },
    options: [
      o('push', '🍦', 'Push the truck downhill', 'decoy', 2, { role: 'cover', hero: 60, ok: 'shoved the truck downhill, jingle and all', bad: 'got caught between the truck and its biggest fans' }),
      o('roof', '🚏', 'Climb the bus shelter', 'climb', 2, { help: { rope: 'safe' }, ok: 'scrambled onto the bus-shelter roof', bad: 'slipped off the bus-shelter roof' }),
      o('yards', '🏡', 'Cut through backyards', 'run', 1, { crowd: 1, setFlag: 'knows_back_route', ok: 'hopped fences all the way to the next street, learning every shortcut', bad: 'landed in the wrong backyard' }),
      o('fight', '🏏', 'Stand and fight', 'fight', 3, { help: { gun: 'safe', bat: 'hurt' }, ok: 'held the sidewalk like a pro', bad: 'got swarmed by a very sticky crowd' }),
    ] },
  { id: 'pemberton', ch: 'outbreak', title: 'Mr. Pemberton’s House',
    text: 'You’re hiding in old Mr. Pemberton’s living room when a dozen shamblers start pounding on the front door. The hinges are already complaining.',
    group: { type: 'hold', need: 0.34, ok: 'The front door held!', bad: 'The front door gave way!' },
    options: [
      o('hold', '🚪', 'Hold the door', 'hold', 1, { role: 'hold', hero: 30, help: { bat: 'safe' }, ok: 'leaned on the door until the pounding stopped', bad: 'got knocked flat when the door flew open' }),
      o('back', '🏃', 'Run out the back', 'run', 1, { role: 'run', ok: 'slipped out the back past the garden gnomes', bad: 'ran straight into a second group in the garden' }),
      o('attic', '🔦', 'Hide in the attic', 'hide', 2, { help: { flashlight: 'safe' }, ok: 'curled up behind the Christmas decorations', bad: 'stepped right through the attic floor in the dark' }),
      o('window', '🔫', 'Fight from the window', 'fight', 3, { help: { gun: 'safe', bat: 'hurt' }, ok: 'drove them back from the window', bad: 'leaned a little too far out of the window' }),
    ] },
  { id: 'bus', ch: 'outbreak', title: 'The Evacuation Bus',
    text: 'A yellow school bus marked EVAC idles at the end of the street. The driver is honking like crazy. So are a lot of other things.',
    options: [
      o('bus', '🚌', 'Pile onto the bus', 'run', 2, { crowd: -1, ok: 'piled onto the bus and waved out the back window', bad: 'missed the bus by one very long arm' }),
      o('bikes', '🚲', 'Grab the kids’ bikes', 'run', 1, { badFlag: 'injured_leg', ok: 'pedaled away ringing the little bells', bad: 'crashed a bike with training wheels and twisted an ankle' }),
      o('wait', '⏳', 'Wait for the next one', 'hide', 2, { ok: 'waited it out behind a hedge', bad: 'waited for a bus that never came' }),
      o('drive', '🔑', 'Take the neighbor’s car', 'drive', 0, { need: 'keys', ok: 'drove off with the radio on', bad: 'stalled the car at the worst moment' }),
    ] },
  { id: 'garage', ch: 'outbreak', title: 'The Garage Sale',
    text: 'Somebody’s garage sale was interrupted forever. Everything’s 25¢. Nobody’s collecting. But something under the tarp is breathing.',
    options: [
      o('fire', '🧨', 'The box of firecrackers', 'search', 0, { gain: 'firecrackers', ok: 'pocketed a box of fireworks', bad: 'lifted the tarp. Wrong tarp' }),
      o('radio', '📻', 'The old radio', 'search', 0, { gain: 'radio', ok: 'tucked an old radio under one arm', bad: 'turned the radio on at full volume' }),
      o('keys', '🔑', 'The car keys on the hook', 'search', 1, { gain: 'keys', ok: 'grabbed a jangling set of car keys', bad: 'reached into the garage. The garage reached back' }),
      o('bat', '🏏', 'The bat in the bucket', 'search', 0, { gain: 'bat', ok: 'pulled a bat out of the bucket of sporting goods', bad: 'got cornered by the folding tables' }),
    ] },
  { id: 'manhole', ch: 'outbreak', title: 'The Shortcut',
    text: 'Main Street is packed with shamblers. Your options for getting across town are all bad, in different ways.',
    options: [
      o('sewer', '🕳️', 'Down the manhole', 'sneak', 2, { help: { flashlight: 'safe' }, setFlag: 'knows_back_route', ok: 'came up three blocks away, smelling terrible, with the tunnels memorised', bad: 'met something in the sewer that was even worse' }),
      o('rooftops', '🏠', 'Over the rooftops', 'climb', 2, { help: { rope: 'safe' }, badFlag: 'injured_leg', ok: 'leapt roof to roof like an action hero', bad: 'misjudged the jump between garages and landed on an ankle' }),
      o('street', '🏃', 'Sprint down Main Street', 'run', 1, { crowd: 1, setFlag: 'marked_by_horde', ok: 'sprinted the length of Main Street with every eye on them', bad: 'drew every eye on Main Street' }),
      o('dumpster', '🗑️', 'Hide in a dumpster', 'hide', 1, { ok: 'waited it out in a dumpster. Gross, but alive', bad: 'got discovered by a curious nose' }),
    ] },
  { id: 'dog', ch: 'outbreak', title: 'A Very Good Boy',
    text: 'A golden retriever trots up with a leash in its mouth, wagging furiously, and starts pulling you toward an alley. His tag says BISCUIT.',
    options: [
      o('follow', '🐕', 'Follow the dog', 'run', 1, { gain: ['medkit', 'flashlight', 'firecrackers'], setFlag: 'has_dog', ok: 'followed Biscuit to a stash of supplies. Now Biscuit follows them', bad: 'followed the dog into a dead end' }),
      o('pet', '🤗', 'Stop and pet the dog', 'rest', 0, { heal: true, ok: 'took a moment to pet a very good boy and felt better', bad: 'got so distracted petting the dog that they didn’t hear the footsteps' }),
      o('shush', '🤫', 'Shush it and hide', 'hide', 1, { ok: 'hid until the street was clear', bad: 'got found when the dog barked happily at them' }),
    ] },
  { id: 'cruiser', ch: 'outbreak', title: 'The Abandoned Police Car',
    text: 'A police cruiser sits in the middle of the road, door open, lights still spinning. The trunk is unlocked. The neighborhood is waking up.',
    group: { type: 'cover', ok: 'The siren wailed and the horde turned to follow it!', bad: 'Without a distraction, the horde closed in on the car.' },
    options: [
      o('trunk', '🔫', 'Search the trunk', 'search', 1, { gain: 'gun', ok: 'found a spare pistol in the trunk', bad: 'had their head in the trunk at the wrong time' }),
      o('radio', '📻', 'Take the car radio', 'search', 0, { gain: 'radio', ok: 'yanked the radio out of the dashboard', bad: 'got tangled in the radio cord' }),
      o('siren', '🚨', 'Lure them with the siren', 'decoy', 2, { role: 'cover', hero: 50, setFlag: 'marked_by_horde', ok: 'led the horde away with the siren howling. They won’t forget that noise', bad: 'turned on the siren and got mobbed by the audience' }),
      o('hide', '🫣', 'Hide under the car', 'hide', 1, { ok: 'lay flat under the car until it passed', bad: 'got their ankle grabbed under the car' }),
    ] },

  // ================= DAY 2 · GALLERIA MALL =================
  { id: 'sporting', ch: 'mall', title: 'Sporting Goods',
    text: 'The sporting goods store is wrecked, but not empty. Ropes on the climbing wall, lights in the camping aisle, maps at the register, and something trying on shoes in the back.',
    options: [
      o('rope', '🪢', 'Climbing-wall rope', 'climb', 1, { gain: 'rope', help: { rope: 'safe' }, ok: 'climbed the wall and cut down a rope', bad: 'fell off the climbing wall' }),
      o('bat', '🏏', 'A bat from the rack', 'search', 0, { gain: 'bat', ok: 'chose a bat from the rack', bad: 'got jumped in the baseball aisle' }),
      o('light', '🔦', 'Camping lantern', 'search', 0, { gain: 'flashlight', ok: 'grabbed a lantern from the camping aisle', bad: 'found a tent that was already occupied' }),
      o('map', '🧭', 'Road maps at the register', 'search', 0, { setFlag: 'has_map', ok: 'folded a road map of the whole county into a pocket', bad: 'got cornered at the register' }),
      o('fire', '🧨', 'Party-store fireworks', 'search', 1, { gain: 'firecrackers', ok: 'raided the party store next door', bad: 'popped a balloon and everyone heard it' }),
    ] },
  { id: 'escalator', ch: 'mall', title: 'The Escalator',
    text: 'The way out is one floor down, but the escalator is jammed solid with shamblers riding it up and down, forever confused.',
    options: [
      o('slide', '🛝', 'Slide down the handrail', 'run', 2, { crowd: 1, ok: 'slid down the handrail like a pro skater', bad: 'slid down the handrail straight into the crowd' }),
      o('service', '🚪', 'Find the service stairs', 'sneak', 3, { outcomes: [{ if: flag('knows_back_route'), result: 'safe', line: 'knew how back routes work since day one, and found the service stairs in a minute' }], ok: 'found the service stairs', bad: 'got lost in the service corridors' }),
      o('fountain', '⛲', 'Jump into the fountain', 'swim', 1, { ok: 'cannonballed into the fountain and swam for it', bad: 'belly-flopped into the fountain' }),
      o('shoot', '🔫', 'Clear a path', 'fight', 3, { help: { gun: 'safe', bat: 'hurt' }, ok: 'cleared a path down the escalator', bad: 'tried to fight the whole escalator' }),
    ] },
  { id: 'mannequins', ch: 'mall', title: 'Department Store',
    text: 'The department store is dim and full of mannequins. Most of them are mannequins. A couple of them just blinked.',
    options: [
      o('pose', '🧍', 'Freeze and strike a pose', 'hide', 1, { outcomes: [SCENT], ok: 'struck a pose so convincing a shambler walked right past', bad: 'sneezed mid-pose' }),
      o('tiptoe', '🦶', 'Tiptoe through', 'sneak', 2, { help: { flashlight: 'safe' }, ok: 'tiptoed through the perfume counters', bad: 'tiptoed into the arms of a fake mannequin' }),
      o('sprint', '🏃', 'Sprint for the exit', 'run', 2, { outcomes: [ANKLE], ok: 'sprinted out past menswear', bad: 'knocked over a whole row of mannequins and one of them bit back' }),
      o('rack', '🧥', 'Shove a clothes rack', 'fight', 2, { help: { bat: 'safe' }, ok: 'bowled them over with a rack of winter coats', bad: 'got tangled in a rack of scarves' }),
    ] },
  { id: 'shutter', ch: 'mall', title: 'The Security Shutter',
    text: 'The mall’s security shutter is stuck halfway. Someone has to crank it down by hand while the horde pours in from the parking lot.',
    group: { type: 'hold', need: 0.3, ok: 'The shutter slammed down just in time!', bad: 'The shutter jammed and the horde poured under it!' },
    options: [
      o('crank', '⚙️', 'Crank the shutter', 'hold', 1, { role: 'hold', hero: 30, help: { bat: 'safe' }, ok: 'cranked until their arms burned', bad: 'got pulled under the shutter' }),
      o('dock', '🏃', 'Run for the loading dock', 'run', 1, { role: 'run', outcomes: [{ if: flag('marked_by_horde'), result: 'bitten', line: 'ran for the dock, but the horde had their scent from Main Street and was waiting there' }], ok: 'made it out through the loading dock', bad: 'found the loading dock busy' }),
      o('booth', '📸', 'Hide in the photo booth', 'hide', 2, { ok: 'hid in the photo booth and got some great pictures', bad: 'got found when the photo booth flash went off' }),
    ] },
  { id: 'arcade', ch: 'mall', title: 'The Arcade',
    text: 'The arcade machines are still on, beeping and flashing. Shamblers can’t resist bright lights. Neither, apparently, can some of you.',
    group: { type: 'cover', ok: 'The arcade lit up and the horde crowded around the machines!', bad: 'Nobody made a scene, and the horde wandered your way.' },
    options: [
      o('play', '🕹️', 'Crank the loudest machine', 'decoy', 2, { role: 'cover', hero: 60, help: { firecrackers: 'safe' }, ok: 'set a high score while the horde watched', bad: 'got a game over. The real kind' }),
      o('slip', '🚪', 'Slip out the back', 'sneak', 2, { outcomes: [{ if: flag('knows_back_route'), result: 'safe', line: 'knew the back way out, like on day one' }], ok: 'slipped out the back while the lights flashed', bad: 'found the back door locked' }),
      o('balls', '🟡', 'Hide in the ball pit', 'hide', 1, { ok: 'vanished into the ball pit', bad: 'discovered the ball pit was already taken' }),
      o('prizes', '🎟️', 'Raid the prize counter', 'search', 1, { gain: ['firecrackers', 'flashlight'], ok: 'cashed in 10,000 imaginary tickets', bad: 'got stuck behind the prize counter' }),
    ] },
  { id: 'walkie', ch: 'mall', title: 'The Toy Store Walkie',
    text: 'A walkie-talkie on the floor crackles: “Hello? It’s Tess. I’m nine. I’m locked in the toy store and they’re outside the window.”',
    options: [
      o('rescue', '🦸', 'Go and get her out', 'run', 2, { hero: 60, gain: 'radio', setFlag: 'saved_tess', help: { gun: 'safe', bat: 'safe' }, ok: 'broke into the toy store and led Tess out', bad: 'got Tess out, but got cornered in the plush aisle' }),
      o('guide', '📻', 'Talk her out by radio', 'talk', 1, { hero: 25, setFlag: 'saved_tess', help: { radio: 'safe' }, ok: 'talked Tess through the air vents to safety', bad: 'got Tess out but led the shamblers to their own hiding spot' }),
      o('leave', '🚶', 'Keep moving', 'sneak', 0, { ok: 'kept moving and tried not to think about it', bad: 'kept moving. Into trouble' }),
    ] },
  { id: 'skylight', ch: 'mall', title: 'Through the Skylight',
    text: 'Every exit is blocked. The only way out is up, through the big glass skylight in the food court, two stories above the tables.',
    options: [
      o('pipe', '🪜', 'Climb the drainpipe', 'climb', 2, { help: { rope: 'safe' }, outcomes: [ANKLE], ok: 'shimmied up the drainpipe to the roof', bad: 'found out the drainpipe was decorative' }),
      o('boost', '🤝', 'Boost each other up', 'climb', 2, { crowd: -1, ok: 'formed a human ladder and climbed out together', bad: 'were at the bottom of the human ladder' }),
      o('stay', '🛌', 'Spend the night in the bedding store', 'rest', 1, { heal: true, outcomes: [{ if: flag('has_dog'), result: 'safe', line: 'slept soundly while Biscuit kept watch at the door' }], ok: 'slept in a showroom bed and woke up feeling better', bad: 'woke up to company' }),
    ] },
  { id: 'garage2', ch: 'mall', title: 'The Parking Garage',
    text: 'The parking garage is pitch dark and full of cars, and every car alarm is one bump away from going off.',
    options: [
      o('drive', '🔑', 'Drive out', 'drive', 0, { need: 'keys', ok: 'found the matching car and drove out the exit ramp', bad: 'set off every alarm on level 2' }),
      o('cart', '🛺', 'Steal the security golf cart', 'drive', 1, { ok: 'escaped at a thrilling twelve miles an hour', bad: 'discovered golf carts don’t go very fast' }),
      o('sneak', '🔦', 'Sneak along the wall', 'sneak', 2, { outcomes: [DARK.light, DARK.dog], ok: 'crept out along the wall in the dark', bad: 'bumped a minivan in the dark. WEE-OO WEE-OO' }),
      o('alarm', '🚨', 'Set off alarms on purpose', 'decoy', 2, { hero: 40, outcomes: [SCENT], ok: 'played the car alarms like a symphony and escaped in the chaos', bad: 'got caught in the middle of their own symphony' }),
    ] },

  // ================= DAY 3 · MERCY HILL HOSPITAL =================
  { id: 'pharmacy', ch: 'hospital', title: 'The Pharmacy',
    text: 'The hospital pharmacy! Shelves of supplies, a fridge humming with something labeled EXPERIMENTAL, and a locker that says SECURITY.',
    options: [
      o('meds', '🩹', 'Grab medkits', 'search', 0, { gain: 'medkit', ok: 'stuffed their bag with bandages', bad: 'knocked over a tower of pill bottles' }),
      o('fridge', '🧪', 'The experimental fridge', 'search', 2, { cure: true, heal: true, ok: 'drank something glowing and felt amazing', bad: 'opened the fridge and something inside opened its eyes' }),
      o('locker', '🔫', 'Break open the locker', 'search', 1, { gain: 'gun', ok: 'pried the locker open and found a pistol', bad: 'made too much noise prying the locker' }),
      o('watch', '👀', 'Keep watch at the door', 'hold', 0, { hero: 20, ok: 'kept a sharp eye on the hallway', bad: 'blinked at the wrong moment' }),
    ] },
  { id: 'morgue', ch: 'hospital', title: 'The Basement',
    text: 'The only way out is through the basement. The lights are dead. Something down there is humming a tune. You can hear it. You can’t see it.',
    options: [
      o('light', '🔦', 'Cross the dark basement', 'sneak', 2, { outcomes: [DARK.light, DARK.dog, DARK.none], ok: 'crossed the basement', bad: 'walked into the hummer’s dance floor' }),
      o('tunnel', '🚇', 'The service tunnel', 'sneak', 3, { outcomes: [{ if: flag('knows_back_route'), result: 'safe', line: 'knew their way around tunnels since the sewers on day one, and walked out the far end' }, DARK.light], ok: 'followed the service tunnel out', bad: 'got lost in the service tunnel' }),
      o('chute', '🧺', 'Up the laundry chute', 'climb', 2, { help: { rope: 'safe' }, ok: 'climbed up the laundry chute covered in towels', bad: 'got stuck halfway up the laundry chute' }),
      o('cart', '🛒', 'Hide in a laundry cart', 'hide', 2, { ok: 'rode a laundry cart right past them', bad: 'was in the cart that got pushed the wrong way' }),
    ] },
  { id: 'wardc', ch: 'hospital', title: 'Ward C',
    text: 'Ward C is full of patients who are definitely not patients anymore. The corridor is long, the floors are freshly waxed, and there are wheelchairs.',
    options: [
      o('wheel', '♿', 'Wheelchair race', 'drive', 2, { crowd: 1, outcomes: [{ if: flag('injured_leg'), result: 'safe', line: 'had a bad ankle, which doesn’t matter one bit in a wheelchair. Won the race' }], ok: 'won the wheelchair race down Ward C', bad: 'spun out on the waxed floor' }),
      o('gurney', '🛏️', 'Gurney battering ram', 'fight', 2, { crowd: -1, help: { bat: 'safe' }, ok: 'plowed through Ward C on a speeding gurney', bad: 'fell off the back of the gurney' }),
      o('vent', '🌀', 'Crawl through the vents', 'sneak', 2, { help: { flashlight: 'safe' }, ok: 'crawled through the ceiling vents', bad: 'crashed through a ceiling tile onto a nurse’s station' }),
      o('alarm', '🔔', 'Pull the fire alarm', 'decoy', 2, { hero: 40, outcomes: [SCENT], ok: 'pulled the alarm and the sprinklers sent everything into chaos', bad: 'pulled the alarm and stood right under it' }),
    ] },
  { id: 'elevator', ch: 'hospital', title: 'The Elevator Doors',
    text: 'You’ve made it into the service elevator, but the doors won’t close: arms keep reaching in. Someone has to push them back.',
    group: { type: 'hold', need: 0.34, ok: 'The doors slid shut!', bad: 'The doors stayed open and they piled in!' },
    options: [
      o('push', '🚪', 'Push them back', 'hold', 1, { role: 'hold', hero: 30, help: { bat: 'safe' }, ok: 'pushed back the grabby hands', bad: 'got grabbed by the grabby hands' }),
      o('hatch', '🪜', 'Climb out the roof hatch', 'climb', 1, { role: 'run', help: { rope: 'safe' }, outcomes: [ANKLE], ok: 'climbed out through the roof hatch', bad: 'got stuck in the roof hatch' }),
      o('corner', '🫣', 'Hide in the corner', 'hide', 2, { ok: 'pressed into the corner and stayed very small', bad: 'learned there is nowhere to hide in an elevator' }),
    ] },
  { id: 'nurses', ch: 'hospital', title: 'The Nurses’ Station',
    text: 'An abandoned nurses’ station. Supplies everywhere, a working radio, and ambulance keys on a hook marked BAY 2.',
    options: [
      o('meds', '🩹', 'Medkit', 'search', 0, { gain: 'medkit', ok: 'took a medkit from the emergency cabinet', bad: 'got cornered behind the desk' }),
      o('keys', '🔑', 'Ambulance keys', 'search', 1, { gain: 'keys', ok: 'grabbed the ambulance keys', bad: 'reached for the keys and something grabbed back' }),
      o('radio', '📻', 'The radio', 'search', 0, { gain: 'radio', ok: 'unplugged the nurses’ radio', bad: 'got caught by the crackling radio' }),
      o('rest', '🛋️', 'Rest in the staff room', 'rest', 1, { heal: true, ok: 'napped on the staff-room couch', bad: 'found out the staff room was full' }),
    ] },
  { id: 'ambulance', ch: 'hospital', title: 'The Ambulance Bay',
    text: 'An ambulance sits in the bay with the back doors open. The gate is closing and the parking lot is filling with shamblers.',
    options: [
      o('drive', '🚑', 'Drive the ambulance', 'drive', 0, { need: 'keys', ok: 'drove the ambulance out with the lights flashing', bad: 'took the gate with them' }),
      o('push', '💪', 'Push it to roll-start', 'hold', 2, { crowd: -1, ok: 'pushed the ambulance until the engine coughed to life', bad: 'pushed too slowly' }),
      o('fence', '🏃', 'Sneak along the fence', 'sneak', 2, { outcomes: [{ if: flag('knows_back_route'), result: 'safe', line: 'spotted the gap in the fence, the way they learned to on day one' }], ok: 'crept along the fence and slipped out', bad: 'climbed the fence at the wrong spot' }),
      o('back', '🙈', 'Hop in the back and hope', 'hide', 2, { ok: 'hid in the back of the ambulance until it was clear', bad: 'shared the back of the ambulance with a former patient' }),
    ] },
  { id: 'doctor', ch: 'hospital', title: 'Dr. Okafor’s Offer',
    text: 'A tired doctor in a hazmat suit offers a shot of a brand-new, totally untested vaccine. “It might help,” she says. “It might also make you very itchy.”',
    group: { type: 'vote', ok: { shot: 'Dr. Okafor nodded. “Brave. Let me know about the itching.”', help: 'Dr. Okafor shared her supplies with everyone who helped.', no: 'Dr. Okafor shrugged and went back to her lab.' }, gift: { help: 'medkit' } },
    options: [
      o('shot', '💉', 'Take the shot', 'rest', 1, { cure: true, setFlag: 'vaccinated', outcomes: [{ if: flag('saved_tess'), result: 'safe', gain: 'medkit', line: 'were hugged by Tess, Dr. Okafor’s daughter. The doctor gave them the shot AND her best medkit' }], ok: 'took the shot like a champ', bad: 'had a VERY bad reaction to the shot' }),
      o('help', '🤝', 'Help her carry supplies', 'search', 1, { hero: 30, outcomes: [{ if: flag('saved_tess'), result: 'safe', gain: 'medkit', line: 'were recognised: “You saved my Tess!” Dr. Okafor pressed a medkit into their hands' }], ok: 'helped Dr. Okafor haul her supplies', bad: 'dropped a box right in front of the patients' }),
      o('no', '🙅', 'No thanks', 'sneak', 0, { ok: 'politely declined and moved on', bad: 'declined and walked into trouble' }),
    ] },
  { id: 'stairs', ch: 'hospital', title: 'Twelve Floors of Stairs',
    text: 'The stairwell goes down twelve floors. You can hear them coming up from the bottom, one slow step at a time.',
    options: [
      o('race', '🏃', 'Race them down', 'run', 2, { outcomes: [ANKLE], ok: 'raced down twelve floors and out the side door', bad: 'met them on floor four' }),
      o('banister', '🛝', 'Slide the banister', 'run', 2, { badFlag: 'injured_leg', ok: 'slid down the banister in record time', bad: 'flew off the banister on a corner and landed badly' }),
      o('window', '🪟', 'Window-washer platform', 'climb', 2, { help: { rope: 'safe' }, ok: 'rode the window-washer platform down the outside', bad: 'found the platform’s cables a little frayed' }),
      o('wait', '⏳', 'Wait for a gap', 'hide', 1, { outcomes: [SCENT], ok: 'waited on the landing for the perfect moment', bad: 'waited a little too long' }),
    ] },

  // ================= DAY 4 · ROUTE 9 (highway) =================
  { id: 'gas', ch: 'highway', title: 'The Gas Station',
    text: 'A gas station minimart, lights flickering. The doors slide open with a cheerful ding-dong that echoes across the empty highway.',
    options: [
      o('keys', '🔑', 'Keys from the tow truck', 'search', 1, { gain: 'keys', ok: 'grabbed the tow truck keys', bad: 'found the tow-truck driver still on shift' }),
      o('fuel', '⛽', 'Siphon a can of fuel', 'search', 1, { setFlag: 'fuel_siphoned', ok: 'filled a jerry can at the pumps. Yuck, but useful', bad: 'got a mouthful of gasoline and company' }),
      o('light', '🔦', 'Flashlight and batteries', 'search', 0, { gain: 'flashlight', ok: 'took a flashlight and a fistful of batteries', bad: 'triggered the ding-dong one too many times' }),
      o('gun', '🔫', 'Check behind the register', 'search', 1, { gain: 'gun', ok: 'found the clerk’s pistol under the register', bad: 'checked behind the register. Someone was already there' }),
      o('snacks', '🍫', 'Eat everything', 'rest', 0, { heal: true, ok: 'ate a whole aisle of snacks and felt much better', bad: 'got so busy snacking they didn’t look up' }),
    ] },
  { id: 'gridlock', ch: 'highway', title: 'Gridlock',
    text: 'Six lanes of abandoned cars, bumper to bumper, as far as you can see. Some of the drivers are still in them. They’re not driving.',
    options: [
      o('roofs', '🚗', 'Hop from roof to roof', 'climb', 2, { crowd: 1, outcomes: [ANKLE], ok: 'hopped car roof to car roof for a mile', bad: 'landed on a sunroof' }),
      o('under', '🐍', 'Crawl under the trucks', 'sneak', 2, { help: { flashlight: 'safe' }, ok: 'crawled under the trucks unseen', bad: 'crawled under a truck that wasn’t empty' }),
      o('shoulder', '🔑', 'Drive the shoulder', 'drive', 0, { need: 'keys', ok: 'drove along the shoulder past the whole jam', bad: 'got wedged between a guardrail and a bus' }),
      o('horns', '📯', 'Honk every horn to distract', 'decoy', 2, { hero: 40, outcomes: [SCENT], ok: 'honked a symphony and slipped away in the chaos', bad: 'honked one horn too many' }),
    ] },
  { id: 'bridge', ch: 'highway', title: 'The Broken Bridge',
    text: 'The bridge over Copper River has a big gap in the middle. The water below is cold and fast. Behind you: the moaning gets louder.',
    options: [
      o('rope', '🪢', 'Rope across the gap', 'climb', 3, { help: { rope: 'safe' }, ok: 'swung across the gap on a rope', bad: 'tried to cross the gap without enough rope' }),
      o('swim', '🌊', 'Swim the river', 'swim', 2, { ok: 'swam the river and crawled out on the far bank', bad: 'got swept downstream' }),
      o('long', '🗺️', 'Walk the long way around', 'run', 2, { outcomes: [{ if: flag('has_map'), result: 'safe', line: 'unfolded the map from the mall and found a shallow ford a mile downstream' }], ok: 'took the long way around and made it by nightfall', bad: 'took the long way into a very long line of shamblers' }),
      o('barge', '⛴️', 'Jump onto a passing barge', 'run', 3, { badFlag: 'injured_leg', ok: 'jumped and landed on a drifting barge', bad: 'jumped, hit the barge’s edge hard and twisted an ankle' }),
    ] },
  { id: 'toll', ch: 'highway', title: 'The Toll Booth',
    text: 'The toll booth barrier is down and the booth is surrounded. Someone needs to hold the barrier up while everyone else dashes through.',
    group: { type: 'hold', need: 0.3, ok: 'The barrier held up long enough!', bad: 'The barrier came crashing down!' },
    options: [
      o('hold', '🚧', 'Hold the barrier up', 'hold', 1, { role: 'hold', hero: 30, help: { bat: 'safe' }, ok: 'held the barrier up with everything they had', bad: 'got caught under the barrier' }),
      o('dash', '🏃', 'Dash through', 'run', 1, { role: 'run', outcomes: [ANKLE], ok: 'dashed through the toll booth', bad: 'didn’t have exact change' }),
      o('booth', '🫣', 'Hide in the booth', 'hide', 2, { ok: 'hid in the toll booth and counted coins', bad: 'found the toll collector still collecting' }),
    ] },
  { id: 'convoy', ch: 'highway', title: 'The Abandoned Convoy',
    text: 'A line of army trucks, abandoned in a hurry. Crates in the back, a radio in the cab, and a lot of very confused soldiers who didn’t make it.',
    options: [
      o('crate', '🔫', 'Open the crates', 'search', 1, { gain: 'gun', ok: 'pried open a crate and armed up', bad: 'opened the crate that wasn’t supplies' }),
      o('radio', '📻', 'Take the field radio', 'search', 0, { gain: 'radio', ok: 'took the field radio from the cab', bad: 'got trapped in the cab' }),
      o('medic', '🩹', 'The medic’s bag', 'search', 1, { gain: 'medkit', ok: 'found the medic’s bag', bad: 'found the medic' }),
      o('watch', '🔭', 'Stand guard on the truck', 'hold', 0, { hero: 20, ok: 'stood guard on the truck roof', bad: 'stood guard and got outflanked' }),
    ] },
  { id: 'hitchhiker', ch: 'highway', title: 'The Hitchhiker',
    text: 'A park ranger waves you down. She seems friendly. She also has a suspicious bandage on her arm and won’t stop saying “I’m fine.”',
    group: { type: 'vote', ok: { ride: 'It was ketchup! Ranger Dot shared her first-aid kit and swore to repay you.', leave: 'You left the ranger behind. She waved sadly. Probably fine.', check: 'A closer look settled it: just a paper cut. Ranger Dot tipped her hat.' }, gift: { ride: 'medkit' } },
    options: [
      o('ride', '👍', 'Give her a ride', 'talk', 1, { setFlag: 'befriended_ranger', outcomes: [{ if: flag('vaccinated'), result: 'safe', line: 'shrugged at the bandage: they had Dr. Okafor’s shot in their arm. Ranger Dot was impressed' }], ok: 'made a new friend: Ranger Dot', bad: 'learned the bandage wasn’t ketchup' }),
      o('check', '🔍', 'Check the bandage first', 'talk', 0, { ok: 'checked the bandage and made sure everyone stayed safe', bad: 'got a little too close checking' }),
      o('leave', '👋', 'Leave her behind', 'sneak', 0, { ok: 'drove on and didn’t look back', bad: 'left her behind and ran into trouble anyway' }),
    ] },
  { id: 'tunnel', ch: 'highway', title: 'The Tunnel',
    text: 'The highway disappears into a long, pitch-black tunnel. It’s the fastest way to the coast. Echoes inside sound like a lot of shuffling feet.',
    options: [
      o('walk', '🔦', 'Walk it in the dark', 'sneak', 2, { outcomes: [DARK.light, DARK.dog, DARK.none], ok: 'walked the tunnel in a careful line', bad: 'walked into the shuffling in the dark' }),
      o('drive', '🔑', 'Drive it fast', 'drive', 0, { need: 'keys', ok: 'floored it through the tunnel with the headlights blazing', bad: 'hit a stalled car in the dark' }),
      o('hill', '⛰️', 'Go over the hill', 'climb', 2, { outcomes: [{ if: flag('has_map'), result: 'safe', line: 'followed the hiking trail marked on their map, right over the hill' }, ANKLE], ok: 'hiked over the hill instead', bad: 'met the hill’s other hikers' }),
      o('camp', '⛺', 'Camp until morning', 'rest', 1, { heal: true, ok: 'camped until morning and woke up rested', bad: 'camped right next to the tunnel exit' }),
    ] },
  { id: 'billboard', ch: 'highway', title: 'Night on the Highway',
    text: 'Night falls fast on Route 9. A giant billboard for Captain Crunchy Fries towers over the road with a catwalk at the top.',
    options: [
      o('billboard', '🪧', 'Sleep on the billboard', 'climb', 1, { heal: true, help: { rope: 'safe' }, ok: 'slept under Captain Crunchy’s friendly smile', bad: 'rolled over in their sleep' }),
      o('car', '🚙', 'Sleep in a locked car', 'hide', 2, { outcomes: [{ if: has('keys'), result: 'safe', line: 'found the car their keys fit, locked every door and slept like a log' }], ok: 'slept in a locked car with the seats down', bad: 'found the car unlocked. From the outside' }),
      o('walk', '🌙', 'Keep walking in the dark', 'run', 2, { help: { flashlight: 'safe' }, ok: 'walked all night and gained ground', bad: 'walked into something in the dark' }),
    ] },

  // ================= DAY 5 · HOLLOW CREEK FARM =================
  { id: 'barn', ch: 'farm', title: 'The Barn',
    text: 'A big red barn with the doors wide open. The hayloft, the tool wall, a tractor with keys on the seat. Somewhere, a goat is screaming.',
    options: [
      o('rope', '🪢', 'Hayloft rope', 'climb', 1, { gain: 'rope', ok: 'climbed into the hayloft for a coil of rope', bad: 'fell out of the hayloft into the hay. And company' }),
      o('keys', '🔑', 'Tractor keys', 'search', 1, { gain: 'keys', ok: 'pocketed the tractor keys', bad: 'got cornered at the tractor' }),
      o('lantern', '🔦', 'Barn lantern', 'search', 0, { gain: 'flashlight', ok: 'lit an old barn lantern', bad: 'knocked over a pile of buckets' }),
      o('goat', '🐐', 'Rescue the goat', 'run', 1, { hero: 30, ok: 'rescued the goat. The goat did not say thank you', bad: 'was not prepared for the goat' }),
    ] },
  { id: 'maze', ch: 'farm', title: 'The Corn Maze',
    text: 'The only way to the creek is through the Hollow Creek Corn Maze, open since 1987. Rustling on every side. A sign says FUN FOR ALL AGES.',
    options: [
      o('scarecrow', '👉', 'Follow the scarecrow’s arm', 'sneak', 2, { outcomes: [{ if: flag('befriended_ranger'), result: 'safe', line: 'had Ranger Dot along. “I mapped this maze in ’92. Left at the scarecrow.”' }], ok: 'followed the pointing scarecrow to the exit', bad: 'followed the scarecrow. It was pointing at itself' }),
      o('tower', '🗼', 'Climb the lookout tower', 'climb', 2, { help: { rope: 'safe' }, ok: 'climbed the tower and spotted the way out', bad: 'climbed a tower with a missing rung' }),
      o('together', '🤝', 'Hold hands and stay together', 'sneak', 2, { crowd: -1, ok: 'held hands and walked out as a team', bad: 'lost their grip in the rustling' }),
      o('straight', '🌽', 'Run straight through the corn', 'run', 2, { crowd: 1, outcomes: [{ if: flag('has_map'), result: 'safe', line: 'checked the map, ran due east and burst out by the creek' }, ANKLE], ok: 'flattened a path straight through the corn', bad: 'ran straight into the middle of the maze party' }),
    ] },
  { id: 'tractor', ch: 'farm', title: 'The Tractor',
    text: 'A horde crests the hill and stumbles down toward the farm. An old tractor is hitched to a hay wagon. It’s not fast. Neither are they.',
    options: [
      o('drive', '🚜', 'Drive the tractor', 'drive', 2, { need: 'keys', outcomes: [{ if: flag('fuel_siphoned'), result: 'safe', line: 'poured in the fuel they siphoned back on Route 9 and drove off at a stately eight miles an hour' }, { if: not(flag('fuel_siphoned')), line: 'turned the key. Empty tank. Nobody had thought about fuel' }], ok: 'drove off at a stately eight miles an hour', bad: 'flooded the engine' }),
      o('wagon', '🌾', 'Ride on the hay wagon', 'hide', 2, { crowd: -1, ok: 'rode away lying in the hay', bad: 'fell off the back of the wagon' }),
      o('silo', '🏗️', 'Hide in the silo', 'hide', 2, { outcomes: [SCENT], ok: 'climbed into the silo and waited', bad: 'learned the silo had one door' }),
      o('fight', '🏏', 'Hold the yard', 'fight', 3, { help: { gun: 'safe', bat: 'hurt' }, ok: 'held the farmyard against the horde', bad: 'got overrun in the farmyard' }),
    ] },
  { id: 'farmhouse', ch: 'farm', title: 'The Farmhouse',
    text: 'You’re inside the farmhouse when the windows start rattling. The storm cellar is out back. The boards and nails are by the fireplace.',
    group: { type: 'hold', need: 0.34, ok: 'The boards held!', bad: 'The windows burst in!' },
    options: [
      o('board', '🔨', 'Board up the windows', 'hold', 1, { role: 'hold', hero: 30, help: { bat: 'safe' }, ok: 'hammered boards over every window', bad: 'hit their thumb at the worst moment' }),
      o('cellar', '🏃', 'Run for the storm cellar', 'run', 1, { role: 'run', outcomes: [ANKLE], ok: 'made it to the storm cellar', bad: 'found the cellar door stuck' }),
      o('attic', '🔦', 'Hide in the attic', 'hide', 2, { help: { flashlight: 'safe' }, ok: 'hid in the attic with the family photos', bad: 'found the attic already had a resident' }),
    ] },
  { id: 'cellar', ch: 'farm', title: 'The Root Cellar',
    text: 'Night on the farm. You’re sheltering in the root cellar when the hatch creaks shut. Something is down here with you, in the pitch dark.',
    options: [
      o('face', '🔦', 'Find it before it finds you', 'sneak', 2, { outcomes: [DARK.light, DARK.dog, DARK.none], ok: 'found it first', bad: 'found it second' }),
      o('hatch', '🪜', 'Scramble back up the hatch', 'climb', 2, { outcomes: [ANKLE], ok: 'shoved the hatch open and rolled out into the moonlight', bad: 'couldn’t find the ladder in the dark' }),
      o('still', '🫣', 'Hold your breath in a corner', 'hide', 2, { outcomes: [SCENT], ok: 'held their breath until it shuffled past', bad: 'held their breath until they couldn’t' }),
      o('fire', '🧨', 'Light a firecracker', 'decoy', 0, { need: 'firecrackers', ok: 'lit a firecracker: the flash showed everything and the bang sent it running', bad: 'lit the firecracker. It was a dud' }),
    ] },
  { id: 'chickens', ch: 'farm', title: 'Release the Chickens',
    text: 'Fact: shamblers cannot resist chasing chickens. There are forty chickens in the coop. There are about forty shamblers in the yard.',
    group: { type: 'cover', ok: 'The chickens burst out and the horde chased them in circles!', bad: 'The coop stayed shut and the horde came for you instead.' },
    options: [
      o('coop', '🐔', 'Open the coop', 'decoy', 2, { role: 'cover', hero: 50, ok: 'unleashed a feathery storm', bad: 'got trampled by forty chickens and their fans' }),
      o('eggs', '🥚', 'Grab the eggs', 'search', 1, { heal: true, ok: 'collected eggs and cooked breakfast', bad: 'got caught in the coop' }),
      o('windmill', '🌬️', 'Climb the windmill', 'climb', 2, { help: { rope: 'safe' }, ok: 'climbed the windmill and watched the chaos', bad: 'got clipped by a windmill blade' }),
      o('run', '🏃', 'Run for the creek', 'run', 1, { outcomes: [ANKLE], ok: 'ran for the creek', bad: 'ran into the yard at the wrong time' }),
    ] },
  { id: 'well', ch: 'farm', title: 'The Old Well',
    text: 'Everyone is exhausted and thirsty. There’s an old stone well, a water trough of questionable quality, and a shamble of footsteps in the field.',
    options: [
      o('rope', '🪢', 'Lower a bucket on a rope', 'rest', 0, { need: 'rope', heal: true, ok: 'drew cold, clean water from the well', bad: 'leaned over the well too far' }),
      o('trough', '🐄', 'Drink from the trough', 'rest', 1, { ok: 'drank from the trough and lived to regret nothing', bad: 'drank from the trough. Bad idea' }),
      o('share', '💧', 'Share your water bottle', 'talk', 1, { hero: 30, outcomes: [{ if: flag('befriended_ranger'), result: 'safe', line: 'shared their water with Ranger Dot, who shared her trail mix. Nobody even heard the footsteps' }], ok: 'shared their last water and made everyone smile', bad: 'got caught passing the bottle around' }),
      o('watch', '👀', 'Keep watch', 'hold', 1, { help: { flashlight: 'safe' }, ok: 'kept watch on the field', bad: 'looked the wrong way' }),
    ] },
  { id: 'scarecrow', ch: 'farm', title: 'The Scarecrow',
    text: 'The scarecrow in the cornfield turns its head. Slowly. It was definitely facing the other way a second ago.',
    options: [
      o('fight', '🏏', 'Take it on', 'fight', 2, { help: { gun: 'safe', bat: 'safe' }, ok: 'knocked the scarecrow’s hat clean off', bad: 'underestimated the scarecrow' }),
      o('run', '🏃', 'Run!', 'run', 1, { outcomes: [ANKLE], ok: 'ran and didn’t look back', bad: 'looked back' }),
      o('still', '🧍', 'Stand perfectly still', 'hide', 2, { outcomes: [{ if: flag('has_dog'), result: 'safe', line: 'stood still while Biscuit barked the scarecrow back into the corn. Good boy' }], ok: 'stood so still the scarecrow lost interest', bad: 'blinked first' }),
      o('fire', '🧨', 'Throw a firecracker', 'decoy', 0, { need: 'firecrackers', ok: 'threw a firecracker and the scarecrow chased the bang', bad: 'threw the firecracker the wrong way' }),
    ] },
  { id: 'pumpkins', ch: 'farm', title: 'The Pumpkin Patch',
    text: 'A horde is shambling up the hill toward the farm, right through a field of giant pumpkins. You are at the top of the hill.',
    options: [
      o('roll', '🎃', 'Roll pumpkins at them', 'fight', 2, { crowd: -1, ok: 'bowled a perfect strike with a giant pumpkin', bad: 'got squashed by their own pumpkin' }),
      o('lantern', '🕯️', 'Carve a decoy lantern', 'decoy', 2, { hero: 40, help: { flashlight: 'safe' }, ok: 'carved a spooky decoy that fooled the whole horde', bad: 'spent too long on the eyebrows' }),
      o('sneak', '🌾', 'Sneak through the patch', 'sneak', 1, { outcomes: [SCENT], ok: 'crawled between the pumpkins unnoticed', bad: 'hid behind a pumpkin that was a little too small' }),
    ] },

  // ================= ANY CHAPTER =================
  { id: 'watch', ch: 'any', title: 'Night Watch',
    text: 'Night falls. You’ve found a corner to sleep in, but someone has to keep watch while the others rest.',
    group: { type: 'cover', none: 2, ok: 'The lookouts spotted them coming and woke everyone in time!', bad: 'Nobody kept watch. Bad night.' },
    options: [
      o('watch', '👁️', 'Keep watch', 'hold', 1, { role: 'cover', hero: 30, help: { flashlight: 'safe', gun: 'safe' }, ok: 'kept watch all night', bad: 'fell asleep on watch' }),
      o('sleep', '😴', 'Get some sleep', 'rest', 1, { heal: true, outcomes: [{ if: flag('has_dog'), result: 'safe', line: 'slept with Biscuit across the doorway. He barked at the first footstep' }], ok: 'slept like a baby', bad: 'woke up to a very bad alarm clock' }),
      o('scavenge', '🔦', 'Scavenge in the dark', 'search', 2, { gain: ['medkit', 'firecrackers', 'flashlight', 'gun'], outcomes: [DARK.light], ok: 'sneaked out and came back with supplies', bad: 'scavenged a little too far' }),
    ] },
  { id: 'drop', ch: 'any', title: 'The Supply Drop',
    text: 'A crate on a parachute drifts down and lands across the open square. Everyone sees it. Including them.',
    options: [
      o('race', '📦', 'Race for the crate', 'run', 2, { crowd: 1, gain: ['medkit', 'gun', 'firecrackers', 'radio'], outcomes: [ANKLE], ok: 'won the race to the crate', bad: 'lost the race to the crate' }),
      o('cover', '🔫', 'Cover the others', 'fight', 2, { help: { gun: 'safe' }, hero: 30, ok: 'covered the runners from a doorway', bad: 'stepped out of cover' }),
      o('stay', '🫣', 'Stay hidden', 'hide', 0, { ok: 'stayed hidden and stayed alive', bad: 'stayed hidden. Not hidden enough' }),
    ] },
  { id: 'cans', ch: 'any', title: 'The Tower of Cans',
    text: 'Everybody freezes. A cat has just knocked over a tower of empty cans. CLANG. CLANG. Clang. clang. Every head in the area turns your way.',
    options: [
      o('freeze', '🧊', 'Stay frozen', 'hide', 1, { outcomes: [SCENT], ok: 'stayed frozen like a statue', bad: 'held their breath until they couldn’t' }),
      o('run', '🏃', 'Blame the cat and run', 'run', 1, { crowd: 1, outcomes: [ANKLE], ok: 'pointed at the cat and ran', bad: 'tripped over the cat' }),
      o('cat', '🐈', 'Catch the cat', 'search', 1, { hero: 20, ok: 'caught the cat and it purred', bad: 'chased the cat right into the crowd' }),
    ] },
  { id: 'fog', ch: 'any', title: 'The Fog',
    text: 'A thick fog rolls in. You can’t see your own hand. You can hear shuffling, close by, on every side.',
    options: [
      o('hands', '🤝', 'Hold hands in a line', 'sneak', 2, { crowd: -1, ok: 'walked through the fog holding hands', bad: 'let go for one second' }),
      o('light', '🔦', 'Shine a light ahead', 'sneak', 2, { help: { flashlight: 'safe' }, ok: 'lit a path through the fog', bad: 'lit themselves up for everyone to see' }),
      o('wait', '⏳', 'Wait for it to lift', 'hide', 1, { outcomes: [{ if: flag('has_dog'), result: 'safe', line: 'waited with Biscuit, whose nose works fine in fog' }], ok: 'waited for the fog to lift', bad: 'waited, and something found them first' }),
    ] },
  { id: 'dancer', ch: 'any', title: 'The Dancer',
    text: 'A shambler with headphones still on is blocking the way, swaying to music only it can hear. It looks… happy?',
    options: [
      o('dance', '💃', 'Dance past it', 'sneak', 1, { outcomes: [ANKLE], ok: 'danced right past it to the beat', bad: 'missed a step' }),
      o('unplug', '🎧', 'Unplug its headphones', 'fight', 2, { help: { bat: 'safe' }, ok: 'unplugged the headphones and it wandered off sulking', bad: 'interrupted its favorite song' }),
      o('around', '↩️', 'Go the long way around', 'run', 1, { outcomes: [{ if: flag('knows_back_route'), result: 'safe', line: 'knew a back way around, like always' }], ok: 'took the long way around', bad: 'took the long way around into a crowd' }),
    ] },
  { id: 'trader', ch: 'any', title: 'The Shopping-Cart Trader',
    text: 'A cheerful old trader pushes a rattling shopping cart full of supplies. “Everything’s free,” he says, “if you help me push it up the hill.”',
    options: [
      o('push', '🛒', 'Help push the cart', 'hold', 1, { crowd: -1, gain: ['medkit', 'rope', 'firecrackers', 'radio', 'keys'], ok: 'pushed the cart uphill and got paid in supplies', bad: 'lost their grip on the hill' }),
      o('look', '🔦', 'Stand lookout', 'hold', 1, { help: { flashlight: 'safe' }, hero: 20, ok: 'kept lookout while the cart rolled', bad: 'looked out right into trouble' }),
      o('pass', '🚶', 'Politely move on', 'sneak', 0, { ok: 'politely moved on', bad: 'moved on into trouble' }),
    ] },

  // ================= DAY 6 · THE LAST NIGHT (rescue) =================
  { id: 'beacon', ch: 'rescue', title: 'The Rescue Frequency',
    text: 'A crackle on the airwaves: the pilot needs a signal to find the right rooftop. The building is surrounded and the stairwell is filling up.',
    group: { type: 'cover', ok: 'The pilot heard you! “Hold tight, I see your building!”', bad: 'Nobody reached the pilot. The rotors faded into the distance… for now.' },
    options: [
      o('radio', '📻', 'Radio the pilot', 'talk', 0, { need: 'radio', role: 'cover', hero: 50, ok: 'guided the pilot in by radio', bad: 'got jumped mid-call' }),
      o('cb', '📡', 'Shout into the lobby CB', 'talk', 3, { role: 'cover', hero: 50, outcomes: [{ if: flag('helped_neighbor'), result: 'safe', line: 'remembered Mrs. Delgado from day one. “My son flies rescue.” They called his name, and Captain Delgado answered' }], ok: 'got through on the lobby CB', bad: 'shouted into a dead CB while the lobby filled up' }),
      o('flare', '🧨', 'Light up the sky', 'decoy', 1, { need: 'firecrackers', role: 'cover', hero: 40, ok: 'painted the sky with fireworks', bad: 'lit the fuse a little too close' }),
      o('stairs', '🏏', 'Block the stairwell', 'fight', 3, { help: { gun: 'safe', bat: 'hurt' }, ok: 'blocked the stairwell with furniture and fury', bad: 'got pulled into the stairwell' }),
      o('roof', '🧗', 'Climb to the roof', 'climb', 2, { help: { rope: 'safe' }, outcomes: [ANKLE], ok: 'reached the roof and waited for dawn', bad: 'slipped on the fire escape' }),
    ] },
  { id: 'roofdoor', ch: 'rescue', title: 'The Roof Door',
    text: 'You’re on the roof. The metal door to the stairwell is the only way up, and it is shaking on its hinges. Dawn is still an hour away.',
    group: { type: 'hold', need: 0.34, ok: 'The roof door held until dawn!', bad: 'The roof door burst open!' },
    options: [
      o('hold', '🚪', 'Brace the door', 'hold', 1, { role: 'hold', hero: 40, help: { bat: 'safe' }, ok: 'braced the roof door with their back', bad: 'got knocked over when the door burst open' }),
      o('edge', '🏃', 'Get to the far edge', 'run', 1, { role: 'run', outcomes: [SCENT], ok: 'ran to the far edge of the roof', bad: 'ran out of roof' }),
      o('vent', '🫣', 'Hide behind the AC unit', 'hide', 2, { outcomes: [{ if: flag('has_dog'), result: 'hurt', line: 'hid behind the AC unit while Biscuit held the shamblers at bay. A scratch, nothing worse' }], ok: 'hid behind a humming AC unit', bad: 'found the AC unit’s other hider' }),
    ] },
  { id: 'harbor', ch: 'rescue', title: 'The Harbor Supplies',
    text: 'One last stop before the rooftop: a harbor patrol shed with its door hanging open. Supplies for the final stretch, and footsteps on the dock.',
    options: [
      o('flare', '🧨', 'Signal flares', 'search', 0, { gain: 'firecrackers', ok: 'took a handful of signal flares', bad: 'got trapped in the shed' }),
      o('rope', '🪢', 'Mooring rope', 'search', 0, { gain: 'rope', ok: 'coiled up a long mooring rope', bad: 'got tangled in the mooring rope' }),
      o('meds', '🩹', 'The patrol medkit', 'search', 1, { gain: 'medkit', ok: 'took the patrol medkit', bad: 'reached for the medkit and got a surprise' }),
      o('rest', '🧘', 'Catch your breath', 'rest', 0, { heal: true, ok: 'caught their breath on the pier', bad: 'rested a moment too long' }),
    ] },

  // ----- finals: the rescue itself (one per game). They all remember day one. -----
  { id: 'chopper', ch: 'rescue', final: true, title: 'The Last Chopper',
    text: 'DAWN. The helicopter drops out of the clouds and hovers over the roof, rope ladder swinging. The roof door bursts open. This is it. Everyone has to get aboard. NOW.',
    group: { type: 'cover', ok: 'The rear guard held the roof long enough!', bad: 'Nobody held the roof. It’s a scramble!' },
    options: [
      o('ladder', '🪜', 'Climb the rope ladder', 'climb', 2, { help: { rope: 'safe' }, outcomes: [...FINALE('saved Mrs. Delgado on day one. Her son was flying the chopper: “Mom said to save you a seat”'), ANKLE], ok: 'climbed the swinging ladder into the chopper', bad: 'lost their grip on the ladder' }),
      o('guard', '🔫', 'Hold off the horde', 'fight', 3, { role: 'cover', hero: 80, help: { gun: 'safe', bat: 'hurt' }, outcomes: [{ if: flag('befriended_ranger'), result: 'safe', line: 'held the roof shoulder to shoulder with Ranger Dot, then leapt aboard together' }, ...FINALE('held the roof until Captain Delgado, Mrs. Delgado’s son, hauled them in: “Mom told me about you”')], ok: 'held off the horde and leapt aboard at the last second', bad: 'held off the horde so the others could escape' }),
      o('jump', '🦘', 'Jump for the skid', 'run', 3, { outcomes: [...FINALE('jumped, and Captain Delgado caught their wrist: “Mom said you’d come”'), ANKLE], ok: 'leapt for the landing skid and got hauled inside', bad: 'jumped for the skid and missed' }),
      o('flare', '🧨', 'Fire flares to clear the roof', 'decoy', 1, { need: 'firecrackers', hero: 40, outcomes: FINALE('cleared the roof with flares while Mrs. Delgado’s son held the chopper steady for them'), ok: 'cleared the roof with flares and strolled aboard', bad: 'set the flares off in their pocket' }),
    ] },
  { id: 'boat', ch: 'rescue', final: true, title: 'The Last Boat',
    text: 'DAWN. The rescue boat pulls up to the pier below, horn blaring. Thirty feet down. A horde between you and the dock.',
    group: { type: 'hold', need: 0.25, ok: 'The rear guard kept the pier gate shut!', bad: 'The pier gate burst open behind them!' },
    options: [
      o('rope', '🪢', 'Rappel down the wall', 'climb', 2, { role: 'run', help: { rope: 'safe' }, outcomes: [...FINALE('rappelled down to Captain Delgado’s boat. “Mom said you’d be the one with the rope”'), ANKLE], ok: 'rappelled down to the pier and jumped aboard', bad: 'ran out of wall' }),
      o('gate', '🚪', 'Hold the pier gate', 'hold', 2, { role: 'hold', hero: 80, help: { gun: 'safe', bat: 'hurt' }, outcomes: [{ if: flag('befriended_ranger'), result: 'safe', line: 'held the gate with Ranger Dot, and she pulled them aboard as the boat pulled away' }, ...FINALE('held the gate until Captain Delgado, Mrs. Delgado’s son, threw them a line')], ok: 'held the pier gate and dove aboard as the boat pulled away', bad: 'held the gate so the others could make it' }),
      o('dive', '🌊', 'Dive into the harbor', 'swim', 2, { role: 'run', outcomes: FINALE('dove in, and Captain Delgado fished them out himself: “Mom said to look for you”'), ok: 'dove off the roof and swam to the boat', bad: 'dove off the roof into very cold water' }),
      o('stairs', '🏃', 'Sprint down the stairs', 'run', 3, { role: 'run', crowd: 1, help: { gun: 'hurt' }, outcomes: [{ if: flag('knows_back_route'), result: 'safe', line: 'took the back stairs, of course, and strolled out onto the pier' }, ...FINALE('sprinted out to the pier, where Mrs. Delgado’s son was holding the boat for them'), ANKLE], ok: 'sprinted down eight floors and out to the pier', bad: 'met the welcoming party on floor two' }),
    ] },
  { id: 'cargo', ch: 'rescue', final: true, title: 'The Cargo Plane',
    text: 'DAWN. A cargo plane touches down on the highway beside the harbor, ramp down, engines screaming. It won’t stop for long. The whole city seems to be running at it.',
    options: [
      o('drive', '🔑', 'Drive up the ramp', 'drive', 1, { need: 'keys', outcomes: [{ if: flag('fuel_siphoned'), result: 'safe', line: 'had fuel to spare from Route 9 and drove straight up the ramp' }, ...FINALE('drove up the ramp, waved aboard by Mrs. Delgado’s son')], ok: 'drove straight up the cargo ramp', bad: 'ran out of fuel ten feet from the ramp' }),
      o('sprint', '🏃', 'Sprint for the ramp', 'run', 3, { crowd: -1, outcomes: [...FINALE('sprinted for the ramp, and Captain Delgado held the plane ten more seconds: “Mom said wait for you”'), ANKLE], ok: 'sprinted up the ramp as it lifted', bad: 'got caught on the runway' }),
      o('cover', '🔫', 'Cover the runners', 'fight', 3, { hero: 80, help: { gun: 'safe', bat: 'hurt' }, outcomes: [{ if: flag('befriended_ranger'), result: 'safe', line: 'covered the runners beside Ranger Dot and dove in as the ramp closed' }, ...FINALE('covered the runners until Mrs. Delgado’s son pulled them aboard')], ok: 'covered the runners and dove in as the ramp closed', bad: 'covered the runners to the very end' }),
      o('wave', '🔦', 'Signal the pilot to wait', 'talk', 2, { help: { flashlight: 'safe', radio: 'safe' }, outcomes: FINALE('signalled the pilot. It was Mrs. Delgado’s son, and he waited'), ok: 'signalled the pilot to wait just ten more seconds', bad: 'signalled the pilot, who did not wait' }),
    ] },
];

// Lines the narrator reads on the TV between scenes.
const BITE_LINES = ['A fever sets in…', 'The bite is turning green…', 'Bad news travels slowly…'];
const DEATH_FLAVOR = ['is a ghost now', 'joins the spooky side', 'will haunt this place'];

// FAMILY MODE (the TV's room-wide Family setting): the same story, told gentler. The pistol is
// a foam blaster, nobody "didn't make it", and the few grisly lines get a goofier version.
// Only the words change: ids, danger, items, flags and rules stay exactly the same.
const FAMILY = {
  items: { gun: { name: 'Foam blaster', unit: 'foam darts' } },
  chapters: {
    mall: 'Day two. The mall was supposed to be a shelter. The muzak is still playing. The shamblers seem to like it.',
    hospital: 'Day three. Hospitals have medicine. Hospitals also have shamblers in paper gowns. Visiting hours are over.',
  },
  scenes: {
    hardware: { opts: { gun: { label: 'The foam blaster behind the counter', ok: 'vaulted the counter and came back with a foam blaster', bad: 'found Hank still behind the counter. Hank wanted a very slimy hug' } } },
    icecream: { opts: { fight: { label: 'Stand your ground' } } },
    cruiser: { opts: { trunk: { ok: 'found a spare foam blaster in the trunk' } } },
    pemberton: { opts: { attic: { ok: 'curled up behind the boxes of holiday decorations' }, window: { label: 'Shoo them from the window', ok: 'shooed them back from the window' } } },
    mannequins: { opts: { sprint: { bad: 'knocked over a whole row of mannequins and one of them hugged back' } } },
    arcade: { opts: { play: { bad: 'got a game over and a slimy high-five' } } },
    pharmacy: { opts: { meds: { bad: 'knocked over a tower of bandage boxes' }, fridge: { label: 'The antidote fridge', ok: 'gulped a glowing antidote smoothie and felt amazing', bad: 'opened the fridge and something inside waved hello' }, locker: { ok: 'pried the locker open and found a foam blaster' } } },
    gas: { opts: { gun: { ok: 'found the clerk’s foam blaster under the register' } } },
    gridlock: { text: 'Six lanes of abandoned cars, bumper to bumper, as far as you can see. A few shamblers are still sitting in them, gripping the wheels and going nowhere.' },
    convoy: { text: 'A line of army trucks, abandoned in a hurry. Crates in the back, a radio in the cab, and a lot of very confused shamblers in camouflage.', opts: { crate: { ok: 'pried open a crate and found a foam blaster' } } },
    hitchhiker: { opts: { ride: { bad: 'learned the bandage was not ketchup after all' } } },
    chopper: { opts: { guard: { bad: 'held off the horde so everyone else could climb aboard' } } },
    boat: { opts: { gate: { bad: 'held the gate so everyone else could make it' } } },
    cargo: { opts: { cover: { bad: 'covered the runners right up to the end' } } },
  },
  biteLines: ['A fever sets in…', 'Somebody is looking a little green…', 'Bad news travels slowly…'],
};

// The story to tell: the normal one, or (family) a copy with the gentler lines swapped in.
function story(family) {
  if (!family) return { ITEMS, FLAGS, CHAPTERS, SCENARIOS, BITE_LINES };
  const items = {};
  for (const [k, it] of Object.entries(ITEMS)) items[k] = { ...it, ...(FAMILY.items[k] || {}) };
  const chapters = CHAPTERS.map((c) => (FAMILY.chapters[c.key] ? { ...c, line: FAMILY.chapters[c.key] } : c));
  const scenarios = SCENARIOS.map((s) => {
    const f = FAMILY.scenes[s.id]; if (!f) return s;
    return { ...s, ...(f.text ? { text: f.text } : {}), options: s.options.map((op) => (f.opts && f.opts[op.k] ? { ...op, ...f.opts[op.k] } : op)) };
  });
  return { ITEMS: items, FLAGS, CHAPTERS: chapters, SCENARIOS: scenarios, BITE_LINES: FAMILY.biteLines };
}

module.exports = { ITEMS, FLAGS, CHAPTERS, SCENARIOS, BITE_LINES, DEATH_FLAVOR, FAMILY, story };
