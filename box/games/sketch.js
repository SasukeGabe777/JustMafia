'use strict';
// JustSketch Relay: a drawing-telephone party game. Players sit in rings of 4–8. Everyone
// starts a "book" with a secret prompt and DRAWS it on their phone; the books pass around the
// ring: the next player sees only the drawing and GUESSES it, the next sees only that guess and
// DRAWS it, and so on. Then the TV reveals the books entry by entry, everyone votes for the
// funniest entry (×100 points), and books whose final guess still matches the prompt pay +50
// to everyone who worked on them. All prompts are original.
const opt = (pairs) => pairs.map(([value, label]) => ({ value, label }));
const fields = [
  { key: 'ringSize', label: 'Players per ring', options: opt([[4, 'About 4 per ring'], [6, 'About 6 per ring'], [8, 'About 8 per ring']]) },
  { key: 'prompts', label: 'Starting prompts', options: opt([['deck', 'Secret prompts from the deck'], ['write', 'Everyone writes their own']]) },
  { key: 'pack', label: 'Prompt pack', options: opt([['mix', '🎲 A bit of everything'], ['classic', '🎨 Silly scenes'], ['easy', '✏️ Easy to draw (great for non-artists)'], ['food', '🍕 Food fight'], ['fantasy', '🐉 Myths & monsters'], ['everyday', '🏠 Everyday chaos'], ['holiday', '🎄 Holiday (winter, spooky, summer)'], ['office', '💼 Office-safe'], ['classics', '🎬 Classics (no pop culture)'], ['travel', '🌍 Travel & world']]) },
  { key: 'drawSeconds', label: 'Time to draw', options: opt([[45, '45 seconds'], [60, '60 seconds'], [90, '90 seconds']]) },
  { key: 'guessSeconds', label: 'Time to guess', options: opt([[20, '20 seconds'], [30, '30 seconds'], [45, '45 seconds']]) },
  { key: 'showBooks', label: 'Books revealed on the TV', options: opt([[3, 'Up to 3 books'], [6, 'Up to 6 books'], [0, 'Every book']]) },
];
const defaults = { ringSize: 6, prompts: 'deck', pack: 'mix', drawSeconds: 60, guessSeconds: 30, showBooks: 6 };

// Colours 0–7 and 9–12 (8 is the eraser), 5 brush sizes; a fill is a one-point stroke with f: 1.
const COLORS = [0, 1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12], ERASER = 8, MAX_COLOR = 12, SIZES = 5, MAX_STROKES = 400, MAX_POINTS = 8000, MAX_FILLS = 40;
// Gear (JustGold shop): a pen set adds a few extra colours to that player's palette. Those
// strokes carry the colour itself ('#rrggbb') instead of a palette number; only the colours of
// the pen set the player has equipped are accepted.
const GEARS = require('../../public/shared/gear');
const pensOf = (p) => { const pt = GEARS.paint('sketch', 'pens', GEARS.gearOf(p, 'sketch', 'pens')); return pt && Array.isArray(pt.pens) ? pt.pens.map((c) => c.toLowerCase()) : []; };
const LAST_CALL_DRAW = 20, LAST_CALL_GUESS = 12; // when only a few are left, the rest of the room doesn't wait long
const REACTS = ['😂', '🤣', '😱', '🔥', '👏', '🤯'], REACT_GAP_MS = 350, FX_PER_SECOND = 8;
const WRITE_SECONDS = 35, GRACE_MS = 1200, PASS_MS = 2500, ENTRY_DRAW_MS = 3600, ENTRY_TEXT_MS = 2600, FINAL_MS = 5000;
const VOTE_SECONDS = 15, RESULTS_MS = 4500, VOTE_POINTS = 100, CHAIN_BONUS = 50;
const AUTO_GUESS = '???';
const REVEAL = new Set(['show', 'final', 'vote', 'results']);
const clean = (s, n = 60) => String(s == null ? '' : s).replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, n);

// ~120 original, family-friendly prompts.
const PROMPTS = [
  'a penguin at a job interview', 'a cat on a skateboard', 'a giraffe stuck in an elevator', 'a dragon doing the dishes',
  'a snowman on a sunny beach', 'a robot walking a dog', 'a shark at the dentist', 'a cowboy riding a snail',
  'a wizard who lost his hat', 'grandma on a jet ski', 'a pizza with legs running away', 'a ghost doing yoga',
  'an octopus playing the drums', 'a banana wearing a superhero cape', 'a cloud crying rain', 'a hamster driving a race car',
  'an alien at a birthday party', 'a volcano sneezing', 'a frog on a lily pad throne', 'a burger in a bubble bath',
  'a knight scared of a tiny spider', 'a pirate with a rubber duck parrot', 'a dinosaur on a tricycle', 'a lighthouse wearing sunglasses',
  'a bee directing traffic', 'a vampire at the beach', 'a sloth winning a race', 'a toaster launching toast into space',
  'a mermaid stuck in a fishbowl', 'a bear stealing a picnic basket', 'a chef chasing a runaway chicken', 'a unicorn stuck in traffic',
  'a tiny house on a turtle’s back', 'the moon eating a cookie', 'a cactus giving a hug', 'a llama in a business suit',
  'a teacher on a pogo stick', 'a snail delivering the mail', 'an elephant hiding behind a lamp post', 'a monster under the bed reading a book',
  'a sandwich with way too many layers', 'a pigeon stealing french fries', 'a baby wearing a crown', 'a duck with an umbrella in the rain',
  'a superhero doing laundry', 'a broccoli bodybuilder', 'a king on a trampoline', 'a fish riding a bicycle',
  'a haunted vending machine', 'a tornado made of spaghetti', 'a dog doing its taxes', 'a koala DJ',
  'a sleepy sun in a nightcap', 'a carrot hiding from a rabbit', 'a mummy unravelling on the dance floor', 'an owl librarian',
  'a skeleton playing the xylophone', 'a submarine in a bathtub', 'a squirrel with a treasure map', 'a giant sneezing on a village',
  'a hot dog in a sleeping bag', 'a raccoon at a fancy restaurant', 'a castle made of pancakes', 'a pencil drawing itself',
  'a cow jumping over the moon', 'a dentist with a giant toothbrush', 'a gorilla at a tea party', 'a balloon escaping a party',
  'a caterpillar trying on shoes', 'a spaceship at a drive-thru', 'a polar bear with a sunburn', 'a family photo of potatoes',
  'a lion getting a haircut', 'a ninja tiptoeing past a sleeping cat', 'a waterfall of chocolate milk', 'a goat climbing a ladder',
  'a phone that needs a nap', 'a dragon roasting marshmallows', 'a crab with a tiny umbrella', 'a magician pulling a cat out of a hat',
  'a jellyfish at a disco', 'a lost sock on an adventure', 'an astronaut planting flowers on Mars', 'a puppy jumping into a pile of leaves',
  'a tree wearing a scarf', 'a whale in a swimming pool', 'a mouse lifting a giant cheese', 'a train made of sausages',
  'a grumpy cloud over one house', 'a queen bee on her throne', 'a kangaroo with a very full pocket', 'a turtle racing a rocket',
  'a ladybug with a backpack', 'a knight riding a goose', 'a sleepwalking zombie', 'a bowling ball with stage fright',
  'a camel at the North Pole', 'a pineapple in a tuxedo', 'a door that opens onto the ocean', 'a snowball fight between penguins',
  'a fox sneaking through a library', 'a time traveller late for school', 'a robot in love with a toaster', 'the tooth fairy with a wheelbarrow',
  'a bat hanging from a ceiling fan', 'a bunny singing into a carrot microphone', 'a crocodile at the hairdresser', 'a spider knitting a sweater',
  'a rainbow used as a slide', 'a horse in pajamas', 'a pizza delivery to the moon', 'a goldfish with a jetpack',
  'a hedgehog getting a hug', 'a ninja grandma', 'a mountain with a headache', 'a cupcake volcano',
  'a parrot that won’t stop talking', 'an ice cream cone melting in the sun', 'a mole popping up on a golf course', 'a dog walking its human',
  'a scarecrow scared of a crow', 'a sock puppet show', 'a hippo on a tightrope', 'a snail in a race car',
];
// Simple things anyone can draw in a few lines.
const EASY = [
  'a happy sun', 'a house on fire', 'a snail', 'a rainy day', 'a birthday cake', 'a fish in a bowl', 'a broken heart', 'a rocket ship',
  'a sleeping cat', 'a very tall tree', 'a slice of pizza', 'a snowman', 'a smiling flower', 'a boat on big waves', 'an angry cloud', 'a ghost',
  'a full moon', 'a spider on its web', 'a hot air balloon', 'a crying baby', 'a light bulb', 'a ladder to the clouds', 'a tiny mouse', 'a giant foot',
  'a stack of books', 'a smiling tooth', 'a robot', 'a pair of sunglasses', 'a mountain', 'a bouncing ball', 'a melting candle', 'a key',
  'a treasure chest', 'a crown', 'a sad banana', 'a kite', 'a lollipop', 'a traffic light', 'an umbrella', 'a worm in an apple',
];
const FOOD = [
  'a taco on vacation', 'a donut doing a cartwheel', 'an egg telling a joke', 'a watermelon with a sunburn', 'a muffin in a top hat', 'cheese escaping a mousetrap',
  'soup that is way too hot', 'a cookie hiding from a glass of milk', 'a pancake flip gone wrong', 'a lemon making a sour face', 'popcorn exploding out of a pot', 'a sandwich on a diet',
  'a pepper breathing fire', 'jelly wobbling on a plate', 'a sushi roll on a skateboard', 'a carrot at the gym', 'french fries waiting in line for ketchup', 'a pear doing ballet',
  'a cupcake with far too many candles', 'a burrito taking a nap', 'a grumpy onion', 'a coconut falling on someone’s head', 'a chili pepper in a hot tub', 'an avocado that lost its pit',
  'a milkshake giving someone brain freeze', 'a hot dog running a marathon', 'a pretzel tied in a knot', 'noodles slurped by a giant', 'a wedding cake collapsing', 'a pie in the face',
  'one lonely pea on a big plate', 'a broccoli tree house', 'a strawberry wearing sunglasses', 'a pineapple at the hairdresser', 'a banana slipping on a banana peel', 'a meatball rolling down a hill',
];
const FANTASY = [
  'a dragon afraid of the dark', 'a witch with a broken broom', 'a unicorn at the car wash', 'a troll under a tiny bridge', 'a genie stuck in a teapot', 'a fairy with a leaf blower',
  'a werewolf at the barber', 'a zombie learning to knit', 'a mermaid riding a bicycle', 'a giant tripping over a castle', 'a wizard duel with spoons', 'a haunted bathtub',
  'a phoenix rising from a toaster', 'an elf on a ladder', 'a sea monster in a puddle', 'a vampire afraid of garlic bread', 'a ghost who is scared of people', 'a knight with a pool noodle sword',
  'a crystal ball with bad news', 'a goblin selling hats', 'a cyclops at the eye doctor', 'a magic carpet in a traffic jam', 'a pumpkin carriage with a flat tire', 'a skeleton walking a skeleton dog',
  'a sphinx asking a riddle', 'a talking mirror', 'a haunted house for sale', 'a centaur on roller skates', 'a yeti building a sandcastle', 'a frog prince waiting for a kiss',
  'a baby dragon hatching', 'a magic spell going wrong', 'a castle in the clouds', 'a pirate ghost ship', 'a robot knight', 'an alien learning to dance',
];
const EVERYDAY = [
  'missing the bus', 'stepping on a toy brick', 'a cat sitting on a laptop', 'a phone at 1% battery', 'fighting over the last slice of pizza', 'a sock lost in the dryer',
  'burning the toast', 'a traffic jam', 'a dog eating homework', 'a grocery bag ripping open', 'a sneeze in a quiet library', 'tangled headphones',
  'looking for the glasses on your head', 'an umbrella blown inside out', 'waking up late', 'a crowded elevator', 'a kid too scared to go down the slide', 'brain freeze',
  'a very long queue', 'a printer eating the paper', 'a toddler tantrum in a shop', 'spilled coffee on a white shirt', 'stuck in a revolving door', 'a mosquito at night',
  'a group photo where someone blinks', 'a selfie with a seagull', 'an empty fridge', 'a hair dryer disaster', 'a bicycle with a flat tire', 'a cat ignoring its fancy new bed',
  'a wave knocking down a sandcastle', 'a monday morning', 'an alarm clock thrown across the room', 'a shopping cart with a wobbly wheel', 'a wet dog shaking off water', 'running out of toilet paper',
];
// Seasonal fun: winter, spooky season and summer (no specific religious holidays).
const HOLIDAY = [
  'a snowman losing its carrot nose', 'a penguin ice skating', 'a mitten that lost its partner', 'a sled racing down a hill', 'a cozy cabin in a blizzard', 'a polar bear sipping hot cocoa',
  'a snowflake looking in a mirror', 'an igloo with a front porch', 'a scarf that is way too long', 'a gift box that is wiggling', 'a cat tangled in string lights', 'a gingerbread house with a moat',
  'a reindeer in ear muffs', 'a snow angel', 'a frozen pond with a hockey goal', 'fireworks over a sleepy town', 'a party hat on a dog', 'a countdown clock at midnight',
  'a jack-o’-lantern with braces', 'a ghost trick-or-treating', 'a black cat on a pumpkin', 'a bat wearing a bow tie', 'a witch hat blowing away', 'a candy bucket overflowing',
  'a costume parade of pets', 'a friendly monster handing out candy', 'a haunted treehouse', 'a scarecrow at a harvest fair', 'a pile of autumn leaves with feet sticking out', 'a pumpkin patch at sunset',
  'a sandcastle with a drawbridge', 'a beach ball bouncing off a seagull', 'an ice pop melting on a hot day', 'a crab building a sandcastle', 'a beach umbrella flying away', 'a flamingo pool float',
  'a picnic invaded by ants', 'a camping tent in the rain', 'a hammock between two palm trees', 'a sunflower taller than a house', 'a kid jumping through a sprinkler', 'a lemonade stand run by a dog',
  'a kite stuck in a tree', 'a birthday cake shaped like a castle', 'a piñata running away', 'a garden full of spring flowers', 'a snowball rolling into a giant snowball', 'a surfing grandpa',
];
const OFFICE = [
  'a printer with a paper jam', 'a coffee mug that never empties', 'a desk buried in sticky notes', 'a very long meeting', 'a stapler with sharp teeth', 'a cat joining a video call',
  'an office chair race', 'a robot running a meeting', 'a water cooler gossip session', 'an email flying out of a laptop', 'a calendar with no free days', 'a pie chart made of real pie',
  'a team high-five', 'a desk plant taking over the office', 'an elevator stuck between floors', 'a presentation with upside-down slides', 'a boss who is a golden retriever', 'a paperclip with big dreams',
  'a filing cabinet exploding with papers', 'someone talking while on mute', 'a lunch stolen from the office fridge', 'a whiteboard covered in arrows', 'a keyboard missing its spacebar', 'a deadline chasing a worker',
  'a spinning office chair', 'a fire drill with everyone in a line', 'a laptop with a sunburn', 'a goldfish employee of the month', 'a tower of donuts in the break room', 'a coffee machine taking a break',
  'a nap under the desk', 'a desk made of pizza boxes', 'a mouse cursor chasing a real mouse', 'a meeting held on a rollercoaster', 'a cactus in a tie', 'an inbox overflowing like a bathtub',
  'a superhero commuting by bus', 'a name badge on a llama', 'a pencil holder full of carrots', 'a team photo where everyone is a duck', 'a briefcase with legs', 'a promotion cake with one candle',
];
// Timeless scenes: no characters, brands, films or famous people.
const CLASSICS = [
  'a lighthouse in a storm', 'a windmill on a hill', 'a hot cup of tea', 'a sailboat at sunset', 'a bowl of fruit', 'a grandfather clock striking midnight',
  'a cuckoo clock bird popping out', 'a teapot pouring itself', 'a cottage with a smoking chimney', 'a horse and cart', 'a rowboat on a calm lake', 'a hen sitting on eggs',
  'a farmer milking a cow', 'a steam train crossing a bridge', 'a bird building a nest', 'a well in a village square', 'a candle in a window', 'a swing hanging from an oak tree',
  'a fisherman with a tiny fish', 'a juggler at a fair', 'a tightrope walker', 'a strongman lifting a barbell', 'an old map with an X', 'a message in a bottle',
  'a pocket watch', 'a hot air balloon over fields', 'a bicycle built for two', 'a kite festival', 'a spinning top', 'a rocking horse',
  'a band playing in a park', 'a castle with a moat', 'a treasure buried on an island', 'a ship in a bottle', 'a parade with a marching drum', 'a quilt on a washing line',
  'a beehive on a branch', 'a fox and a crow', 'a tortoise beating a hare', 'a goose laying a golden egg', 'a cat chasing a ball of yarn', 'a scarecrow guarding a cornfield',
  'a carousel horse', 'a picnic by a river', 'a snail climbing a fence',
];
const TRAVEL = [
  'a suitcase that won’t close', 'a passport with a goofy photo', 'a plane full of animals', 'a camel at a desert oasis', 'a gondola on a canal', 'a pyramid in the sand',
  'a tall tower with a flag on top', 'a cable car up a mountain', 'a tourist with a giant camera', 'a map blowing away in the wind', 'a train racing through mountains', 'a lost luggage carousel',
  'a postcard from the moon', 'a tuk-tuk zooming through a city', 'a hiker at the top of a mountain', 'a rainforest with a hidden waterfall', 'a glacier with a penguin family', 'a desert with a lonely cactus',
  'a market stall full of spices', 'a street food cart', 'a ferry crossing the sea', 'a road trip in a tiny car', 'a kangaroo crossing sign', 'a jungle bridge made of rope',
  'a canoe on a jungle river', 'a palm tree on a tiny island', 'a hotel room with a bad view', 'a hammock on a beach hut', 'a snowy mountain village', 'a lighthouse on a rocky coast',
  'a safari jeep and a giraffe', 'a hot air balloon over canyons', 'a family taking a selfie at a landmark', 'a scuba diver meeting a turtle', 'a night market with lanterns', 'a sleeper train bunk',
  'a backpack covered in patches', 'a compass pointing the wrong way', 'an airport security line', 'a plane meal that looks strange', 'a volcano on the horizon', 'a houseboat',
  'a mountain goat on a cliff', 'a rice terrace on a hillside', 'a city skyline at night',
];
const PACKS = { classic: PROMPTS, easy: EASY, food: FOOD, fantasy: FANTASY, everyday: EVERYDAY, holiday: HOLIDAY, office: OFFICE, classics: CLASSICS, travel: TRAVEL };
PACKS.mix = [...new Set(Object.values(PACKS).flat())];
// Family Mode (room.family) skips the few prompts that are a little scary or toilet-humour for young kids.
const NOT_FAMILY = new Set(['a house on fire', 'a sleepwalking zombie', 'a zombie learning to knit', 'running out of toilet paper', 'a coconut falling on someone’s head']);
const familyPool = (list) => list.filter((p) => !NOT_FAMILY.has(p));
// Silly guesses for test bots.
const BOT_GUESSES = [
  'my uncle at a wedding', 'a potato', 'spaghetti', 'a confused lamp', 'modern art', 'a very angry egg', 'abstract feelings',
  'a horse? maybe?', 'the internet', 'my homework', 'a sad cloud', 'a dancing broom', 'soup', 'a wizard in trouble', 'tuesday',
  'a haunted sock', 'a tiny boat', 'grandpa’s car', 'a dinosaur sneezing', 'a lost balloon', 'a banana party', 'my cat at 3am',
  'an earthquake', 'a weird bird', 'a pancake tower', 'a disco ball', 'a chicken with a plan', 'a spooky tree',
  'a monster eating noodles', 'a fish wearing shoes', 'bubbles', 'my dentist', 'a UFO', 'a slice of cake', 'a sleepy dragon',
  'a pile of laundry', 'a squid on vacation', 'a lightbulb idea', 'the floor is lava', 'a snake in a hat',
];

// ---------- fuzzy matching (is this guess "the same thing"?) ----------
const STOP = new Set('a an the of on in at with and to is are was my his her their your our its some for from by into onto this that it who which very one'.split(' '));
const stem = (w) => (w.length > 5 && w.endsWith('ing') ? w.slice(0, -3) : w.length > 4 && w.endsWith('es') ? w.slice(0, -2) : w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : w);
const words = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((w) => w && !STOP.has(w)).map(stem);
function lev1(a, b) { // edit distance ≤ 1?
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, d = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++d > 1) return false;
    if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; }
  }
  return d + (a.length - i) + (b.length - j) <= 1;
}
const wordEq = (a, b) => a === b || (Math.min(a.length, b.length) >= 4 && (a.startsWith(b) || b.startsWith(a))) || (Math.min(a.length, b.length) >= 5 && lev1(a, b));
// Dice similarity over content words: 1 = same idea, 0 = nothing in common.
function similarity(x, y) {
  const a = words(x), b = words(y);
  if (!a.length || !b.length) return 0;
  const used = new Array(b.length).fill(false); let common = 0;
  for (const w of a) { const k = b.findIndex((v, i) => !used[i] && wordEq(w, v)); if (k >= 0) { used[k] = true; common++; } }
  return (2 * common) / (a.length + b.length);
}
const matches = (x, y) => similarity(x, y) >= 0.5;

// ---------- drawings: compact strokes, validated ----------
// A drawing is [{ c: colour 0–12 (8 = eraser), s: size 0–4, p: [x0, y0, x1, y1, …] }] in a
// 0–1000 square. A paint-bucket fill is { c, s: 0, f: 1, p: [x, y] }.
function cleanStrokes(raw, pens = []) {
  if (!Array.isArray(raw)) return { error: 'That drawing didn’t arrive. Press Done again.' };
  if (raw.length > MAX_STROKES) return { error: `Too many strokes (max ${MAX_STROKES}).` };
  const out = []; let pts = 0, fills = 0;
  for (let s of raw) {
    if (!s || typeof s !== 'object') return { error: 'That drawing is broken.' };
    if (typeof s.c === 'string' && pens.includes(s.c.toLowerCase())) s = { ...s, c: s.c.toLowerCase() }; // an equipped gear pen
    else if (!Number.isInteger(s.c) || s.c < 0 || s.c > MAX_COLOR) return { error: 'Only the palette colours, please.' };
    if (!Number.isInteger(s.s) || s.s < 0 || s.s >= SIZES) return { error: 'Unknown brush size.' };
    if (s.f !== undefined && s.f !== 1) return { error: 'That drawing is broken.' };
    const p = s.p;
    if (!Array.isArray(p) || p.length < 2 || p.length % 2 || p.length > MAX_POINTS * 2) return { error: 'That drawing is broken.' };
    if (s.f === 1 && (p.length !== 2 || ++fills > MAX_FILLS)) return { error: p.length !== 2 ? 'That drawing is broken.' : `Too many fills (max ${MAX_FILLS}).` };
    pts += p.length / 2;
    if (pts > MAX_POINTS) return { error: 'That drawing is too detailed. Try fewer strokes.' };
    for (const n of p) if (!Number.isInteger(n) || n < 0 || n > 1000) return { error: 'That drawing is off the page.' };
    out.push(s.f === 1 ? { c: s.c, s: 0, f: 1, p: p.slice() } : { c: s.c, s: s.s, p: p.slice() });
  }
  return { strokes: out };
}

class Sketch {
  constructor(room, settings) {
    this.room = room; this.s = settings;
    this.phase = 'write'; this.books = []; this.rings = []; this.step = -1; this.steps = 0;
    this.tasks = new Map(); this.scores = new Map(); this.stats = new Map(); this.written = new Map(); this.rerolled = new Set();
    this.endsAt = 0; this.timer = null; this.ending = false; this.deck = [];
    this.show = []; this.showPos = -1; this.cur = null; this.entry = 0; this.votes = new Map(); this.awards = [];
    this.ver = 0; this.stCache = null;
    this.stepStart = 0; this.hurried = false; this.lastReact = new Map(); this.fxWin = { t: 0, n: 0 }; this.best = null;
  }
  shuffle(a) { const r = this.room.rng; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  setTimer(ms, fn, grace = 0) { this.room.cancel(this.timer); this.endsAt = this.room.now() + ms; this.timer = this.room.after(ms + grace, fn); }
  draw() {
    if (!this.deck.length) { const list = PACKS[this.s.pack] || PACKS.mix; this.deck = this.shuffle(this.room && this.room.family ? familyPool(list) : list.slice()); }
    return this.deck.pop();
  }
  add(id, pts) { if (!pts) return; this.scores.set(id, (this.scores.get(id) || 0) + pts); this.ver++; }
  stat(id) { if (!this.stats.has(id)) this.stats.set(id, { drawVotes: 0, guessVotes: 0, correct: 0, guesses: 0, chaos: 0, wild: null, draws: 0, drawMs: 0, ink: 0 }); return this.stats.get(id); }

  start() {
    const ids = this.shuffle(this.room.list().map((p) => p.id));
    for (const id of ids) { this.scores.set(id, 0); this.stat(id); }
    // Rings of roughly the chosen size (never smaller than 4 when there are several rings).
    const N = ids.length;
    let nR = Math.max(1, Math.round(N / this.s.ringSize));
    while (nR > 1 && Math.floor(N / nR) < 4) nR--;
    const base = Math.floor(N / nR), rem = N % nR;
    let at = 0;
    for (let r = 0; r < nR; r++) {
      const n = base + (r < rem ? 1 : 0), members = ids.slice(at, at + n); at += n;
      // Every book has to end on a guess: even rings go all the way round, odd rings stop one short.
      const ring = { n, members, steps: n % 2 ? n - 1 : n, books: [] };
      members.forEach((owner, pos) => {
        const book = { id: this.books.length, owner, ring: r, pos, entries: [null], tally: null, survived: false, scored: false, shown: false };
        this.books.push(book); ring.books.push(book);
      });
      this.rings.push(ring);
    }
    this.steps = Math.max(...this.rings.map((r) => r.steps));
    if (this.s.prompts === 'write') {
      this.phase = 'write';
      this.setTimer(WRITE_SECONDS * 1000, () => this.beginSteps(), GRACE_MS);
      for (const p of this.room.list()) if (p.bot) this.room.after(1500 + this.room.rng() * 8000, () => { if (this.phase === 'write') this.act(p, { op: 'prompt', text: this.draw() }); });
    } else this.beginSteps();
  }
  joined(p) { if (!this.scores.has(p.id)) { this.scores.set(p.id, 0); this.stat(p.id); this.ver++; } } // late joiners watch and vote
  left() { this.ver++; if (this.phase === 'step') this.checkDone(); else if (this.phase === 'write') this.checkWritten(); else if (this.phase === 'vote') this.checkVotes(); }

  // ---------- writing your own prompt ----------
  checkWritten() {
    if (this.phase !== 'write') return;
    const owners = this.books.map((b) => b.owner).filter((id) => this.room.get(id));
    if (owners.every((id) => this.written.has(id))) { this.room.cancel(this.timer); this.endsAt = this.room.now() + 800; this.timer = this.room.after(800, () => this.beginSteps()); }
  }
  beginSteps() {
    if (this.phase !== 'write' || this.step >= 0) return;
    for (const b of this.books) {
      const own = this.written.get(b.owner);
      b.entries[0] = { kind: 'prompt', by: b.owner, text: own || this.draw(), own: !!own };
    }
    this.nextStep();
  }

  // ---------- the relay ----------
  nextStep() {
    this.step++;
    if (this.step >= this.steps) return this.beginReveal();
    const kind = this.step % 2 === 0 ? 'draw' : 'guess';
    this.phase = 'step'; this.kind = kind; this.tasks = new Map(); this.ending = false; this.hurried = false; this.stepStart = this.room.now();
    for (const ring of this.rings) {
      if (this.step >= ring.steps) continue;
      ring.members.forEach((pid, i) => {
        const book = ring.books[(((i - this.step) % ring.n) + ring.n) % ring.n];
        this.tasks.set(pid, { book: book.id, idx: this.step + 1, kind, done: false });
      });
    }
    const secs = kind === 'draw' ? this.s.drawSeconds : this.s.guessSeconds;
    this.setTimer(secs * 1000, () => this.endStep(), GRACE_MS);
    this.room.fx(kind, { step: this.step + 1 });
    const step = this.step;
    if (secs > 20) this.room.after((secs - 10) * 1000, () => { if (this.phase === 'step' && this.step === step && !this.ending) this.room.fx('hurry'); });
    // Bots doodle and guess after a little "thinking".
    for (const [pid, t] of this.tasks) {
      const p = this.room.get(pid); if (!p || !p.bot) continue;
      const wait = 1500 + this.room.rng() * Math.min(secs * 500, kind === 'draw' ? 12000 : 7000);
      this.room.after(wait, () => {
        if (this.phase !== 'step' || this.step !== step || !this.room.get(pid)) return;
        if (t.kind === 'draw') this.act(p, { op: 'draw', strokes: this.scribble() });
        else {
          const src = this.books[t.book].entries[t.idx - 2];
          this.act(p, { op: 'guess', text: this.room.rng() < 0.35 && src ? src.text : BOT_GUESSES[Math.floor(this.room.rng() * BOT_GUESSES.length)] });
        }
      });
    }
  }
  scribble() {
    const r = this.room.rng, out = [], n = 2 + Math.floor(r() * 4);
    for (let i = 0; i < n; i++) {
      let x = 150 + Math.floor(r() * 700), y = 150 + Math.floor(r() * 700); const p = [x, y], k = 4 + Math.floor(r() * 12);
      for (let j = 0; j < k; j++) { x = Math.max(0, Math.min(1000, x + Math.floor((r() - 0.5) * 160))); y = Math.max(0, Math.min(1000, y + Math.floor((r() - 0.5) * 160))); p.push(x, y); }
      out.push({ c: COLORS[Math.floor(r() * COLORS.length)], s: Math.floor(r() * SIZES), p });
    }
    return out;
  }
  checkDone() {
    if (this.phase !== 'step' || this.ending) return;
    for (const [pid, t] of this.tasks) if (!t.done && this.room.get(pid)) return this.lastCall();
    this.ending = true; this.room.cancel(this.timer); this.endsAt = this.room.now() + 800;
    this.timer = this.room.after(800, () => this.endStep());
  }
  // Only a few players left (and plenty of time on the clock)? Last call: the room isn't kept waiting.
  lastCall() {
    if (this.phase !== 'step' || this.ending || this.hurried) return;
    let of = 0, left = 0;
    for (const [pid, t] of this.tasks) { if (!this.room.get(pid)) continue; of++; if (!t.done) left++; }
    if (of < 4 || !left || left > Math.max(1, Math.floor(of / 4))) return;
    const cap = (this.kind === 'draw' ? LAST_CALL_DRAW : LAST_CALL_GUESS) * 1000;
    if (this.endsAt - this.room.now() <= cap + 3000) return;
    this.hurried = true; this.setTimer(cap, () => this.endStep(), GRACE_MS);
    this.room.fx('hurry');
  }
  endStep() {
    if (this.phase !== 'step') return;
    // Missed it? An auto entry keeps the chain going.
    for (const [pid, t] of this.tasks) {
      if (t.done) continue;
      t.done = true;
      this.books[t.book].entries[t.idx] = t.kind === 'draw' ? { kind: 'draw', by: pid, strokes: [], auto: true } : { kind: 'guess', by: pid, text: AUTO_GUESS, auto: true };
    }
    if (this.step + 1 >= this.steps) return this.beginReveal();
    this.phase = 'pass'; this.room.fx('pass');
    this.setTimer(PASS_MS, () => this.nextStep());
  }

  // ---------- the reveal ----------
  beginReveal() {
    for (const b of this.books) {
      const last = b.entries[b.entries.length - 1];
      b.final = last && last.kind === 'guess' ? last : null;
      b.survived = !!(b.final && !b.final.auto && matches(b.entries[0].text, b.final.text));
      b.change = b.final ? 1 - similarity(b.entries[0].text, b.final.text) : 0;
      for (let j = 2; j < b.entries.length; j += 2) {
        const g = b.entries[j], src = b.entries[j - 2]; if (!g || !src) continue;
        const st = this.stat(g.by); st.guesses++;
        if (g.auto) continue;
        if (matches(src.text, g.text)) st.correct++;
        const d = 1 - similarity(src.text, g.text); st.chaos += d;
        if (!st.wild || d > st.wild.d) st.wild = { d, from: src.text, to: g.text };
      }
    }
    // Books with humans in them first (owners, then contributors), then the rest.
    const human = (id) => { const p = this.room.get(id); return p && !p.bot; };
    const tier = (b) => (human(b.owner) ? 0 : b.entries.some((e) => e && human(e.by)) ? 1 : 2);
    const order = this.shuffle(this.books.slice()).sort((a, b) => tier(a) - tier(b));
    const max = this.s.showBooks > 0 ? this.s.showBooks : order.length;
    this.show = order.slice(0, max).map((b) => b.id);
    this.showPos = -1; this.tasks = new Map();
    this.nextBook();
  }
  nextBook() {
    this.showPos++;
    if (this.showPos >= this.show.length) return this.finish();
    this.cur = this.books[this.show[this.showPos]]; this.cur.shown = true;
    this.entry = 0; this.phase = 'show'; this.votes = new Map();
    this.room.fx('book', { n: this.showPos + 1 });
    this.setTimer(ENTRY_TEXT_MS, () => this.advanceEntry());
  }
  advanceEntry() {
    if (this.phase !== 'show') return;
    this.entry++;
    if (this.entry >= this.cur.entries.length) return this.goFinal();
    const e = this.cur.entries[this.entry];
    this.room.fx(e.kind === 'draw' ? 'flip' : 'guessIn');
    this.setTimer(e.kind === 'draw' ? ENTRY_DRAW_MS : ENTRY_TEXT_MS, () => this.advanceEntry());
  }
  scoreBook(b) {
    if (b.scored) return; b.scored = true;
    if (!b.survived) return;
    for (const id of new Set(b.entries.filter(Boolean).map((e) => e.by))) this.add(id, CHAIN_BONUS);
  }
  goFinal() {
    this.entry = this.cur.entries.length - 1; this.phase = 'final';
    this.scoreBook(this.cur);
    this.room.fx(this.cur.survived ? 'survived' : 'chaos');
    this.setTimer(FINAL_MS, () => this.openVote());
  }
  votable(b, id) { return b.entries.map((e, i) => (i > 0 && e && !e.auto && e.by !== id ? i : -1)).filter((i) => i > 0); }
  openVote() {
    if (this.phase !== 'final') return;
    this.phase = 'vote'; this.votes = new Map(); this.room.fx('vote');
    this.setTimer(VOTE_SECONDS * 1000, () => this.closeVote());
    const b = this.cur;
    if (!this.room.list().some((p) => this.votable(b, p.id).length)) { this.setTimer(1500, () => this.closeVote()); return; }
    for (const p of this.room.list()) {
      if (!p.bot) continue;
      this.room.after(1200 + this.room.rng() * 7000, () => {
        if (this.phase !== 'vote' || this.cur !== b || !this.room.get(p.id)) return;
        const ok = this.votable(b, p.id); if (ok.length) this.act(p, { op: 'vote', entry: ok[Math.floor(this.room.rng() * ok.length)] });
      });
    }
  }
  checkVotes() {
    if (this.phase !== 'vote') return;
    const voters = this.room.list().filter((p) => this.votable(this.cur, p.id).length);
    if (voters.every((p) => this.votes.has(p.id))) this.closeVote();
  }
  closeVote() {
    if (this.phase !== 'vote') return;
    const b = this.cur, tally = b.entries.map(() => 0);
    for (const i of this.votes.values()) tally[i]++;
    tally.forEach((n, i) => {
      if (!n) return; const e = b.entries[i];
      this.add(e.by, n * VOTE_POINTS);
      const st = this.stat(e.by); if (e.kind === 'draw') st.drawVotes += n; else st.guessVotes += n;
    });
    const top = Math.max(0, ...tally);
    b.tally = tally; b.top = top ? tally.map((n, i) => (n === top ? i : -1)).filter((i) => i >= 0) : [];
    this.phase = 'results'; this.room.fx(top ? 'results' : 'shrug');
    this.setTimer(RESULTS_MS, () => this.nextBook());
  }
  finish() {
    for (const b of this.books) this.scoreBook(b); // unshown books still pay the chain bonus
    const pick = (val, min = 1) => {
      let best = null, bv = 0;
      for (const [id, st] of this.stats) {
        if (!this.room.get(id)) continue;
        const v = val(st);
        if (v >= min && (best == null || v > bv || (v === bv && (this.scores.get(id) || 0) > (this.scores.get(best) || 0)))) { best = id; bv = v; }
      }
      return best == null ? null : { id: best, v: bv };
    };
    const A = [];
    const art = pick((s) => s.drawVotes); if (art) A.push({ key: 'artist', icon: '🎨', title: 'Best Artist', id: art.id, detail: `${art.v} vote${art.v === 1 ? '' : 's'} on their drawings` });
    const gue = pick((s) => s.guessVotes); if (gue) A.push({ key: 'guesser', icon: '💬', title: 'Best Guesser', id: gue.id, detail: `${gue.v} vote${gue.v === 1 ? '' : 's'} on their guesses` });
    const cha = pick((s) => s.chaos, 0.01);
    if (cha) { const w = this.stats.get(cha.id).wild; A.push({ key: 'chaos', icon: '🌀', title: 'Chaos Agent', id: cha.id, detail: w ? `“${w.from}” → “${w.to}”` : 'Sent the books off the rails' }); }
    const mind = pick((s) => s.correct); if (mind) A.push({ key: 'mind', icon: '🔮', title: 'Mind Reader', id: mind.id, detail: `${mind.v} spot-on guess${mind.v === 1 ? '' : 'es'}` });
    // Fastest finisher (at least two drawings) and the most ink on the page.
    const minDraws = Math.min(2, Math.ceil(this.steps / 2));
    const fast = pick((s) => (s.draws >= minDraws ? 1e6 / (s.drawMs / s.draws + 1) : 0), 0.0001);
    if (fast) { const s = this.stats.get(fast.id); A.push({ key: 'speedy', icon: '⚡', title: 'Speed Sketcher', id: fast.id, detail: `done in ${Math.max(1, Math.round(s.drawMs / s.draws / 1000))}s a drawing, on average` }); }
    const ink = pick((s) => s.ink, 40);
    if (ink && (!fast || ink.id !== fast.id)) A.push({ key: 'detail', icon: '🖌️', title: 'Master of Detail', id: ink.id, detail: 'the most ink on the page' });
    this.awards = A.map((a) => ({ ...a, name: this.room.name(a.id) }));
    // Book of the night: the one whose entries got the most votes.
    let best = null, bv = 0;
    for (const b of this.books) { const v = (b.tally || []).reduce((x, y) => x + y, 0); if (v > bv) { best = b; bv = v; } }
    this.best = best ? { id: best.id, votes: bv } : null;
    this.phase = 'over'; this.endsAt = 0; this.room.cancel(this.timer); this.cur = null;
    this.room.fx('win');
  }

  results() { return this.standings().map((r) => r.id); }
  next() {
    const ph = this.phase;
    if (ph === 'write') { this.room.cancel(this.timer); this.beginSteps(); }
    else if (ph === 'step') { this.room.cancel(this.timer); this.endStep(); }
    else if (ph === 'pass') { this.room.cancel(this.timer); this.nextStep(); }
    else if (ph === 'show') { this.room.cancel(this.timer); this.goFinal(); }
    else if (ph === 'final') { this.room.cancel(this.timer); this.openVote(); }
    else if (ph === 'vote') { this.room.cancel(this.timer); this.closeVote(); }
    else if (ph === 'results') { this.room.cancel(this.timer); this.nextBook(); }
  }

  act(p, m) {
    m = m || {};
    if (m.op === 'prompt') {
      if (this.phase !== 'write') return { ok: false, error: 'Prompt writing is over.' };
      if (!this.books.some((b) => b.owner === p.id)) return { ok: false, error: 'You joined mid-game: you’ll vote on the books!' };
      const text = clean(m.text);
      if (text.length < 3) return { ok: false, error: 'Write a few words for someone to draw.' };
      this.written.set(p.id, text); this.checkWritten();
      return { ok: true };
    }
    const t = this.tasks.get(p.id);
    if (m.op === 'reroll') {
      if (this.phase !== 'step' || this.step !== 0 || !t || t.done) return { ok: false, error: 'Too late to change it.' };
      const first = this.books[t.book].entries[0];
      if (first.own) return { ok: false, error: 'You wrote this one yourself!' };
      if (this.rerolled.has(p.id)) return { ok: false, error: 'You already swapped your prompt.' };
      this.rerolled.add(p.id); first.text = this.draw();
      return { ok: true };
    }
    if (m.op === 'draw' || m.op === 'guess') {
      if (this.phase !== 'step') return { ok: false, error: 'Time’s up for that one.' };
      if (!t) return { ok: false, error: 'Nothing for you to do right now. Hang tight!' };
      if (t.done) return { ok: false, error: 'Already sent!' };
      if (t.kind !== m.op) return { ok: false, error: t.kind === 'draw' ? 'This step is for drawing.' : 'This step is for guessing.' };
      let entry;
      if (m.op === 'draw') {
        const r = cleanStrokes(m.strokes, pensOf(p)); if (r.error) return { ok: false, error: r.error };
        entry = { kind: 'draw', by: p.id, strokes: r.strokes };
        if (r.strokes.length) { const st = this.stat(p.id); st.draws++; st.drawMs += this.room.now() - this.stepStart; st.ink += r.strokes.reduce((n, s) => n + s.p.length / 2, 0); }
      }
      else { const text = clean(m.text); if (!text) return { ok: false, error: 'Type your guess first.' }; entry = { kind: 'guess', by: p.id, text }; }
      this.books[t.book].entries[t.idx] = entry; t.done = true;
      this.checkDone();
      return { ok: true };
    }
    if (m.op === 'react') { // live reactions while the books are revealed
      if (!REVEAL.has(this.phase)) return { ok: false, error: 'Reactions open when the books are revealed.' };
      const i = Number(m.e); if (!Number.isInteger(i) || i < 0 || i >= REACTS.length) return { ok: false, error: 'Pick a reaction.' };
      const now = this.room.now(); if (now - (this.lastReact.get(p.id) || -1e9) < REACT_GAP_MS) return { ok: true, quiet: true };
      this.lastReact.set(p.id, now);
      if (now - this.fxWin.t >= 1000) this.fxWin = { t: now, n: 0 };
      if (++this.fxWin.n <= FX_PER_SECOND) this.room.fx('react', { e: REACTS[i] });
      return { ok: true };
    }
    if (m.op === 'vote') {
      if (this.phase !== 'vote') return { ok: false, error: 'Voting isn’t open.' };
      const i = Number(m.entry);
      if (!this.votable(this.cur, p.id).includes(i)) return { ok: false, error: this.cur.entries[i] && this.cur.entries[i].by === p.id ? 'No voting for yourself!' : 'Pick one of the entries.' };
      this.votes.set(p.id, i); this.checkVotes();
      return { ok: true };
    }
    return { ok: false, error: 'Unknown move.' };
  }

  // ---------- screens ----------
  standings() {
    if (this.stCache && this.stCache.ver === this.ver) return this.stCache.rows;
    const rows = [...this.scores].filter(([id]) => this.room.get(id)).map(([id, pts]) => ({ id, name: this.room.name(id), points: pts })).sort((a, b) => b.points - a.points);
    this.stCache = { ver: this.ver, rows };
    return rows;
  }
  pubEntry(e) { return e ? { kind: e.kind, by: this.room.name(e.by), byId: e.by, text: e.kind === 'draw' ? null : e.text, strokes: e.kind === 'draw' ? e.strokes : null, auto: !!e.auto } : null; }
  pubBook(b, upto = b.entries.length) {
    return { id: b.id, owner: this.room.name(b.owner), ownerId: b.owner, entries: b.entries.slice(0, upto).map((e) => this.pubEntry(e)), total: b.entries.length };
  }
  endsIn() { return this.endsAt ? Math.max(0, this.endsAt - this.room.now()) : 0; }
  progress() {
    let done = 0, of = 0; const waiting = [];
    for (const [pid, t] of this.tasks) { if (!this.room.get(pid)) continue; of++; if (t.done) done++; else waiting.push(this.room.name(pid)); }
    return { done, of, waiting: waiting.slice(0, 30), more: Math.max(0, waiting.length - 30) };
  }
  tv() {
    const base = { phase: this.phase, endsIn: this.endsIn(), step: this.step + 1, steps: this.steps, rings: this.rings.length, standings: this.standings().slice(0, 10) };
    if (this.phase === 'write') {
      const owners = this.books.map((b) => b.owner).filter((id) => this.room.get(id));
      return { ...base, done: owners.filter((id) => this.written.has(id)).length, of: owners.length, waiting: owners.filter((id) => !this.written.has(id)).slice(0, 30).map((id) => this.room.name(id)) };
    }
    if (this.phase === 'step' || this.phase === 'pass') return { ...base, kind: this.kind, hurried: this.hurried, nextKind: this.step % 2 === 0 ? 'guess' : 'draw', ...this.progress() };
    if (this.cur) {
      const b = this.cur, upto = this.phase === 'show' ? this.entry + 1 : b.entries.length;
      return {
        ...base, n: this.showPos + 1, of: this.show.length, entry: this.entry, book: this.pubBook(b, upto),
        survived: this.phase !== 'show' ? b.survived : null, drift: this.phase !== 'show' ? Math.round((b.change || 0) * 100) : null, voted: this.phase === 'vote' ? this.votes.size : 0,
        voters: this.phase === 'vote' ? this.room.list().filter((p) => this.votable(b, p.id).length).length : 0,
        tally: this.phase === 'results' ? b.tally : null, top: this.phase === 'results' ? b.top : null,
      };
    }
    if (this.phase === 'over') {
      return {
        ...base, standings: this.standings().slice(0, 12), awards: this.awards,
        best: this.best ? { ...this.pubBook(this.books[this.best.id]), votes: this.best.votes, survived: this.books[this.best.id].survived } : null,
        gallery: this.books.map((b) => ({ id: b.id, owner: this.room.name(b.owner), prompt: b.entries[0] && b.entries[0].text, final: b.final ? b.final.text : '', survived: b.survived, shown: b.shown })),
      };
    }
    return base;
  }
  hostAct(m) {
    if (m.type !== 'sketchBook') return { ok: false, error: 'Unknown action.' };
    if (this.phase !== 'over') return { ok: false, error: 'The gallery opens at the end.' };
    const b = this.books[Number(m.book)];
    if (!b) return { ok: false, error: 'No such book.' };
    return { ok: true, book: { ...this.pubBook(b), survived: b.survived } };
  }
  view(p) {
    const st = this.standings(), rank = st.findIndex((x) => x.id === p.id) + 1;
    const base = { phase: this.phase, endsIn: this.endsIn(), step: this.step + 1, steps: this.steps, points: this.scores.get(p.id) || 0, rank, players: st.length, inGame: this.books.some((b) => b.owner === p.id), gear: GEARS.gearSet(p, 'sketch') }; // gear: the pen set for the sketchpad
    if (this.phase === 'write') return { ...base, wrote: this.written.get(p.id) || null };
    if (this.phase === 'step' || this.phase === 'pass') {
      const t = this.tasks.get(p.id), pr = this.progress();
      const v = { ...base, kind: this.kind, hurried: this.hurried, nextKind: this.step % 2 === 0 ? 'guess' : 'draw', done: pr.done, total: pr.of, task: null };
      if (t && this.phase === 'step') {
        const b = this.books[t.book], src = b.entries[t.idx - 1];
        v.task = { key: `${this.step}:${b.id}`, kind: t.kind, done: t.done, first: t.idx === 1, own: t.idx === 1 && !!src.own, canReroll: t.idx === 1 && !src.own && !this.rerolled.has(p.id) };
        if (t.kind === 'draw') v.task.text = src.text; else { v.task.strokes = src.strokes; v.task.blank = !!src.auto; }
      }
      return v;
    }
    if (this.cur) {
      const b = this.cur, v = { ...base, reacts: REACTS, n: this.showPos + 1, of: this.show.length, owner: this.room.name(b.owner), mine: b.owner === p.id, inBook: b.entries.some((e) => e && e.by === p.id) };
      if (this.phase === 'vote') { v.book = this.pubBook(b); v.can = this.votable(b, p.id); v.myVote = this.votes.has(p.id) ? this.votes.get(p.id) : null; }
      if (this.phase === 'results') { v.gain = b.entries.reduce((s, e, i) => s + (e && e.by === p.id ? (b.tally[i] || 0) : 0), 0); v.survived = b.survived; }
      if (this.phase === 'final') v.survived = b.survived;
      return v;
    }
    if (this.phase === 'over') {
      const mine = this.books.find((b) => b.owner === p.id);
      return { ...base, final: st.slice(0, 10), awards: this.awards.filter((a) => a.id === p.id), myBook: mine ? { prompt: mine.entries[0].text, final: mine.final ? mine.final.text : '', survived: mine.survived } : null };
    }
    return base;
  }
}

// Party Mode: settings that fit the players in the room and this game's minutes in the plan (box/party-fit.js).
const PF = require('../party-fit');
const partyFit = ({ players: P, minutes: M }) => {
  // A small group is one ring (everyone draws in everyone's book); a big group splits into rings that play at once.
  const fixed = P <= 5 ? [4] : P <= 7 ? [6] : P <= 8 ? [8] : [6, 4, 8];
  const s = PF.best({ ringSize: fixed, drawSeconds: [60, 45, 90], showBooks: [6, 3] }, (x) => {
    const ring = P <= 8 ? P : x.ringSize, guess = x.drawSeconds === 45 ? 20 : 30;
    return 1.5 + (ring - 1) * ((x.drawSeconds + guess) / 2 + 8) / 60 + Math.min(x.showBooks, P) * 0.2 * ring;
  }, M);
  return { ringSize: s.ringSize, drawSeconds: s.drawSeconds, guessSeconds: s.drawSeconds === 45 ? 20 : 30, showBooks: s.showBooks };
};

module.exports = {
  partyFit,
  key: 'sketch', name: 'JustSketch Relay', min: 3, best: [4, 10], fields, defaults,
  create: (room, settings) => new Sketch(room, settings),
  _test: { pensOf, similarity, matches, cleanStrokes, PROMPTS, PACKS, NOT_FAMILY, MAX_POINTS, MAX_STROKES, MAX_FILLS, REACTS },
};
