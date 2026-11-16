'use strict';
// Where Do You Stand?: a gentle get-to-know-you game for any group. A spectrum goes up on the
// TV ("🌅 Morning person ↔ Night owl 🌙"); everyone secretly drags a marker to where THEY stand
// (0–100). The reveal slides every dot onto one big line: clusters, the extremes and the room
// average. Points are light: +50 for landing within 10 of the room average, +25 each for the
// round's nearest-neighbour pair. Every 3rd round is READ A FRIEND: a spotlight player places
// themselves, everyone else guesses where (300/200/100 for the closest, +150 bullseye within 5),
// and the spotlight earns +50 per person who read them within 15. The payoff is the end screen:
// everyone's "twin tonight" (closest answers on average) and "opposite" (most different).
// Positions are never sent to the TV or other phones before the reveal. All content is original.

// A spectrum: [left emoji, left label, right label, right emoji, optional title].
const PACKS = {
  icebreaker: {
    label: 'Icebreaker',
    list: [
      ['🌅', 'Morning person', 'Night owl', '🌙'], ['🏖️', 'Beach holiday', 'Mountain cabin', '🏔️'], ['☕', 'Coffee', 'Tea', '🍵'],
      ['🐶', 'Dog person', 'Cat person', '🐱'], ['📅', 'Plan every detail', 'Totally spontaneous', '🎲'], ['📚', 'Read the book', 'Wait for the movie', '🎬'],
      ['🏙️', 'Big city buzz', 'Quiet countryside', '🌾'], ['🙅', 'Never', 'Always', '🍍', 'Pineapple on pizza'], ['⏰', 'Always early', 'Fashionably late', '🐢'],
      ['🏠', 'Cozy night in', 'Big night out', '🎉'], ['🍫', 'Sweet tooth', 'Savory all the way', '🥨'], ['☀️', 'Summer forever', 'Bring on winter', '❄️'],
      ['📵', 'Reply in 3 days', 'Reply in 3 seconds', '⚡'], ['🗺️', 'Follow the map', 'Follow my gut', '🧭'], ['🧳', 'Pack a week early', 'Pack 10 minutes before', '⏱️'],
      ['😶', 'Never in a million years', 'Hand me the mic', '🎤', 'Karaoke'], ['🥛', 'Mild, please', 'Make me cry', '🔥', 'Spicy food'], ['📝', 'To-do list for everything', 'What list?', '🌀'],
      ['🛋️', 'Weekend: total rest', 'Weekend: packed with plans', '🗓️'], ['🙈', 'No thanks', 'Front row, hands up', '🎢', 'Roller coasters'], ['📞', 'Call me', 'Text me', '💬'],
      ['🍳', 'Breakfast is sacred', 'Breakfast? Never heard of it', '🚫'], ['💡', 'Big ideas person', 'Details person', '🔍'], ['🧊', 'Ice in every drink', 'Room temperature everything', '🌡️'],
      ['🏃', 'Gym regular', 'Couch champion', '🛋️'], ['🌧️', 'Rainy days are cozy', 'Rainy days are gloomy', '😩'], ['🧰', 'Practical gifts', 'Surprise me!', '✨'],
      ['🍽️', 'Same dish every time', 'Order something new', '🆕'], ['📖', 'Fiction', 'Non-fiction', '📰'], ['🧩', 'Puzzles relax me', 'Puzzles stress me out', '😵'],
      ['🪟', 'Window seat', 'Aisle seat', '🚶'], ['🛏️', 'Make the bed every day', 'Why? I’ll sleep in it again', '😴'], ['🔁', 'Rewatch old favorites', 'Always something new', '🍿'],
      ['🗣️', 'Chatty on planes', 'Headphones on, do not disturb', '🎧'], ['🌱', 'Plant parent pro', 'I can’t keep a cactus alive', '🥀'], ['📸', 'Take all the photos', 'Live in the moment', '👀'],
      ['🍦', 'One small scoop', 'The biggest sundae', '🍨'], ['🎮', 'Video games', 'Board games', '🎲'], ['🧠', 'Trivia brain', 'I just guess and hope', '🤷'],
      ['✈️', 'Travel far away', 'Explore close to home', '🏡'], ['🥗', 'Healthy lunch', 'Whatever’s fastest', '🍔'], ['🔇', 'Silence while I work', 'Music always on', '🎶'],
      ['🧦', 'Matching socks, always', 'Any two socks will do', '🙃'], ['🐢', 'Slow and steady', 'Fast and furious', '🐇'],
    ],
  },
  friends: {
    label: 'Friends',
    list: [
      ['💤', 'First to leave the party', 'Last one standing', '🪩'], ['👀', 'Group chat lurker', 'Group chat narrator', '📢'], ['🤐', 'Vault for secrets', 'Spills the tea', '🫖'],
      ['🗺️', 'Road trip planner', 'Road trip DJ', '🎶'], ['🍜', 'Cook at home', 'Order in, always', '🛵'], ['😂', 'Laughs at everything', 'Tough crowd', '🗿'],
      ['🙋', 'First to say yes to plans', 'First to cancel plans', '🛌'], ['🤷', 'Spoilers? Who cares', 'Spoilers are unforgivable', '🚫'], ['🍕', 'Shares my food', 'Don’t touch my fries', '🍟'],
      ['🎤', 'Karaoke solo star', 'Enthusiastic backup dancer', '💃'], ['🧮', 'Splits the bill to the cent', 'Just round it up', '💸'], ['🌶️', 'Brutally honest', 'Kind little white lies', '😇'],
      ['🧭', 'Leader of the pack', 'Happy to follow along', '🐑'], ['😤', 'Sore loser', 'Good sport', '🤝'], ['🗓️', 'Plans a month ahead', '“Free in 10 minutes?”', '⚡'],
      ['👗', 'Dresses up for everything', 'Hoodie for every occasion', '🧥'], ['🙅', 'Phone away at dinner', 'Phone always on the table', '🤳'], ['🧳', 'Overpacker', 'One backpack for two weeks', '🎒'],
      ['🧱', 'Never cries at movies', 'Cries at commercials', '😭'], ['🕯️', 'Birthday: low-key', 'Birthday: a week-long festival', '🎆'], ['🧁', 'Bakes for friends', 'Brings store-bought (with love)', '🛒'],
      ['🕺', 'First on the dance floor', 'Dragged onto the dance floor', '🪑'], ['🎙️', 'Voice notes', 'Typed paragraphs', '⌨️'], ['🤔', 'Overthinks every text', 'Sends and forgets', '🚀'],
      ['👻', 'Horror movie fan', 'Hides behind a pillow', '🙈'], ['🧠', 'Remembers every inside joke', 'Needs the joke explained', '❓'], ['🏕️', 'Camping is magic', 'Camping is suffering', '🏨'],
      ['🏆', 'Ultra-competitive at game night', 'Just here for the snacks', '🍪'], ['🎈', 'Remembers every birthday', 'My phone reminds me', '🔔'], ['🛍️', 'Impulse buyer', 'Researches for weeks', '🔬'],
      ['💡', 'Gives advice', 'Gives a hug', '🫂'], ['🥞', 'Brunch person', 'Late-night snack person', '🌮'], ['🔁', 'Same 10 songs forever', 'New music every day', '📻'],
      ['🧹', 'Tidy roommate', 'Creative-chaos roommate', '🌪️'], ['✍️', 'Perfect punctuation', 'yolo typos lol', '🤪'], ['🚗', 'Backseat driver', 'Asleep before we leave the street', '😴'],
      ['🥳', 'Surprise parties: love them', 'Surprise parties: please no', '😬'], ['🏡', 'Always the host', 'Always the guest', '🚪'], ['🌙', 'Deep talks at 2 a.m.', 'Asleep by 11', '🛌'],
      ['🍷', 'Fancy restaurant', 'Food truck', '🚚'], ['🦸', 'Main character energy', 'Supporting character energy', '🎭'], ['🎀', 'Gifts wrapped perfectly', 'Gifts in the store bag', '🛍️'],
      ['🧩', 'Escape-room genius', 'Escape-room panicker', '😱'], ['🐌', 'Takes forever to order', 'Orders in two seconds', '⚡'],
    ],
  },
  family: {
    label: 'Family',
    list: [
      ['🥦', 'Veggies first', 'Veggies hidden under a napkin', '🙈'], ['🛁', 'Bubble bath', 'Quick shower', '🚿'], ['🦖', 'Dinosaurs', 'Unicorns', '🦄'],
      ['🎄', 'Decorate super early', 'Decorate the night before', '📆'], ['🧸', 'Keep every toy', 'Give them all away', '📦'], ['🍝', 'Twirl it', 'Cut it up', '🔪', 'Spaghetti'],
      ['😩', '“Are we there yet?”', 'Enjoy the ride', '🌄'], ['🌮', 'Tacos', 'Pizza', '🍕'], ['🏰', 'Castle', 'Spaceship', '🚀'],
      ['🐉', 'Dragons', 'Robots', '🤖'], ['🥛', 'Dunk the cookie', 'Never dunk', '🍪'], ['🎨', 'Messy art', 'Neat coloring inside the lines', '✏️'],
      ['🏊', 'Jump straight in', 'Toe in first… slowly', '🦶'], ['🌞', 'Up with the sun', 'Five more minutes', '😴'], ['🧹', 'Chores right away', 'Chores… later', '🦥'],
      ['🎠', 'Merry-go-round', 'Biggest ride in the park', '🎢'], ['🐕', 'Big fluffy dog', 'Tiny pocket dog', '🐩'], ['🍓', 'Fruit for dessert', 'Chocolate for dessert', '🍫'],
      ['📺', 'Cartoons', 'Nature shows', '🦁'], ['⬆️', 'Top bunk', 'Bottom bunk', '⬇️'], ['🧦', 'Socks on at home', 'Barefoot always', '👣'],
      ['🥞', 'Pancakes', 'Waffles', '🧇'], ['🌲', 'Forest walk', 'Day at the beach', '🏖️'], ['📜', 'Follow the rules exactly', 'Invent new rules', '🎲', 'Board games'],
      ['🎵', 'Sing in the car', 'Quiet car ride', '🤫'], ['🦸', 'Superhero', 'Wizard', '🧙'], ['🌳', 'Treehouse', 'Secret underground base', '🕳️'],
      ['🍦', 'Ice cream in a cone', 'Ice cream in a cup', '🥣'], ['🐱', 'Cat that ignores you', 'Dog that follows you everywhere', '🐶'], ['📚', 'Bedtime story', 'Bedtime song', '🎶'],
      ['🥪', 'Crusts on', 'Crusts off', '✂️'], ['🏆', 'Winning is everything', 'Just here for fun', '😄'], ['🎃', 'Spooky costume', 'Funny costume', '🤡'],
      ['⛄', 'Snowball fight outside', 'Hot chocolate inside', '☕'], ['🍎', 'Apple', 'Banana', '🍌'], ['🐠', 'Aquarium', 'Zoo', '🦒'],
      ['🔦', 'Nightlight, please', 'Not scared of anything', '😎'], ['🥄', 'Lick the bowl', 'Wait for the finished cake', '🎂'], ['🗺️', 'Explorer', 'Inventor', '⚙️'],
      ['🚲', 'Bike', 'Scooter', '🛴'], ['🌈', 'Rainbow sprinkles', 'Chocolate sprinkles', '🟫'], ['🤪', 'Silly faces in photos', 'Perfect smile', '😁'],
      ['🐢', 'Pet turtle', 'Pet parrot', '🦜'], ['🧩', '1,000-piece puzzle', '20-piece puzzle', '🙂'],
    ],
  },
  deep: {
    label: 'Deep Thoughts',
    list: [
      ['🧠', 'Follow my head', 'Follow my heart', '❤️'], ['🔮', 'Fate', 'Free will', '🕊️'], ['🌱', 'Roots: stay close to home', 'Wings: go far away', '🦅'],
      ['📜', 'Nostalgic', 'Future-focused', '🔭'], ['🤝', 'A few close friends', 'A big circle of friends', '🌐'], ['🧘', 'Calm under pressure', 'Feel everything at full volume', '🌋'],
      ['💬', 'Say what I feel', 'Keep it to myself', '🔒'], ['🎯', 'Know exactly what I want', 'Figuring it out as I go', '🌀'], ['🌊', 'Go with the flow', 'Steer the ship', '⚓'],
      ['🗝️', 'Money buys freedom', 'Money can’t buy happiness', '🌻'], ['📍', 'Happy where I am', 'Always chasing the next thing', '🏃'], ['🏛️', 'Would visit the past', 'Would visit the future', '🛸'],
      ['🌟', 'A little fame', 'Quiet happiness', '🍃'], ['🤩', 'Excited about new technology', 'Wary of new technology', '🧐'], ['🪨', 'Same person everywhere', 'A different me in every room', '🪞'],
      ['🦉', 'Old soul', 'Young at heart forever', '🎈'], ['🏝️', 'Recharge alone', 'Recharge with people', '🔋'], ['🕊️', 'Forgive and forget', 'Forgive but remember', '🐘'],
      ['🛋️', 'Comfort zone', 'Constant adventure', '🪂'], ['🤗', 'Trust easily', 'Trust is earned', '🛡️'], ['🎨', 'Creative soul', 'Logical mind', '📐'],
      ['🙏', 'Everything happens for a reason', 'Life is beautifully random', '🎲'], ['🎆', 'Live for today', 'Plan for tomorrow', '🏗️'], ['🗣️', 'Better at talking', 'Better at listening', '👂'],
      ['🏆', 'Ambition', 'Contentment', '☺️'], ['💌', 'Love shown in words', 'Love shown in actions', '🛠️'], ['🌍', 'Change the world', 'Make my little corner kinder', '🏡'],
      ['📣', 'Speak up right away', 'Think it over first', '🤔'], ['🍀', 'I make my own luck', 'Luck just finds me', '🌠'], ['📏', 'Follow the rules', 'Bend the rules', '🤸'],
      ['🎓', 'Learned most at school', 'Learned most from life', '🌄'], ['🌞', 'Optimist', 'Realist', '🔎'], ['💭', 'Daydreamer', 'Here and now', '🧷'],
      ['🎁', 'I love giving gifts', 'I love giving time', '⏰'], ['🙋', 'Ask for help easily', 'Figure it out alone', '🧗'], ['😂', 'My life is a comedy', 'My life is an epic adventure', '⚔️'],
      ['🗿', 'Want to be remembered', 'Happy to be a mystery', '🌫️'], ['🔬', 'Tiny details matter', 'Big-picture thinker', '🗺️'], ['📸', 'Best memories: already made', 'Best memories: still coming', '🌅'],
      ['🐚', 'Introvert', 'Extrovert', '📣'], ['🔁', 'Routine is comforting', 'Routine is a cage', '🦋'], ['🏡', 'Stability', 'Excitement', '🎢'],
      ['⚡', 'Fall for people fast', 'Warm up slowly', '🐢'], ['🧸', 'Childhood felt long', 'Childhood flew by', '💨'],
    ],
  },
};

const opt = (pairs) => pairs.map(([value, label]) => ({ value, label }));
const fields = [
  { key: 'pack', label: 'Spectrum pack', options: opt([['icebreaker', 'Icebreaker (strangers & work)'], ['friends', 'Friends'], ['family', 'Family'], ['deep', 'Deep Thoughts (still kind)'], ['mix', 'Mix of everything']]) },
  { key: 'rounds', label: 'Rounds', options: opt([[8, '8 rounds'], [12, '12 rounds'], [16, '16 rounds']]) },
  { key: 'seconds', label: 'Time to place', options: opt([[15, '15 seconds'], [20, '20 seconds'], [30, '30 seconds']]) },
  { key: 'names', label: 'Names on dots', options: opt([['on', 'Show names'], ['off', 'Dots only (shy mode)']]) },
];
const defaults = { pack: 'icebreaker', rounds: 12, seconds: 20, names: 'on' };
const INTRO_MS = 3500, READ_INTRO_MS = 5500, REVEAL_MS = 9500, READ_REVEAL_MS = 12000, LAST_BONUS_MS = 2000, ALLIN_MS = 900, DROP_MS = 3000;
const PTS = { avg: 50, neighbour: 25, read: [300, 200, 100], bullseye: 150, book: 50 };
const NEAR_AVG = 10, BULLSEYE = 5, OPEN = 15, TRAITS = 4;
const isRead = (n) => n % 3 === 0;
const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const specOf = (t) => ({ le: t[0], l: t[1], r: t[2], re: t[3], t: t[4] || '' });
const specText = (sp) => `${sp.t ? sp.t + ': ' : ''}${sp.l} ↔ ${sp.r}`;
const clamp = (x) => Math.max(0, Math.min(100, Math.round(x)));
// Which end a position leans to: used for cluster callouts.
const sideOf = (sp, x) => (x <= 35 ? sp.l : x >= 65 ? sp.r : null);

class Spectrum {
  constructor(room, settings) {
    this.room = room; this.s = settings;
    this.phase = 'intro'; this.n = 0; this.r = null; this.endsAt = 0; this.timer = null;
    this.scores = new Map(); this.stats = new Map(); this.answers = new Map(); this.traits = new Map(); this.spotted = new Set();
    this.specs = []; this.deck = []; this.final = null;
  }
  shuffle(a) { const r = this.room.rng; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  setTimer(ms, fn) { this.room.cancel(this.timer); this.endsAt = this.room.now() + ms; this.timer = this.room.after(ms, fn); }
  stopTimer() { this.room.cancel(this.timer); this.timer = null; }
  namesOn() { return this.s.names !== 'off'; }
  seat(p) {
    if (this.scores.has(p.id)) return;
    this.scores.set(p.id, 0); this.answers.set(p.id, new Map());
    this.stats.set(p.id, { nearAvg: 0, neighbours: 0, guessErr: 0, guessN: 0, bonus: 0, spotN: 0, spotGuessers: 0, spotReaders: 0 });
    // Bots get a hidden personality (a few traits + how scattered they are + how well they read people),
    // so their answers are consistent and twins/opposites mean something.
    const rng = this.room.rng;
    this.traits.set(p.id, { t: Array.from({ length: TRAITS }, () => rng()), noise: 6 + rng() * 14, read: 6 + rng() * 26 });
  }
  start() {
    const keys = this.s.pack === 'mix' || !PACKS[this.s.pack] ? Object.keys(PACKS) : [this.s.pack];
    this.deck = this.shuffle(keys.flatMap((k) => PACKS[k].list.slice()));
    for (const p of this.room.list()) this.seat(p);
    this.nextRound();
  }
  joined(p) { this.seat(p); } // plays from the next round
  left(p) {
    const r = this.r; if (!r || this.phase === 'over') return;
    r.ids = r.ids.filter((id) => id !== p.id);
    if (r.spot === p.id) {
      if (this.phase === 'intro') {
        if (r.ids.length >= 2) this.setSpot(this.pickSpot(r.ids)); else { r.kind = 'normal'; r.spot = null; }
      } else if (this.phase === 'spot') { r.left = true; this.toNormal(); return; }
    }
    if (this.phase === 'place' || this.phase === 'guess') this.maybeAllIn();
  }
  draw() { if (!this.deck.length) this.deck = this.shuffle(Object.values(PACKS).flatMap((pk) => pk.list.slice())); return specOf(this.deck.pop()); }
  pickSpot(ids) {
    const here = ids.filter((id) => this.room.get(id));
    let pool = here.filter((id) => !this.spotted.has(id));
    if (!pool.length) { for (const id of here) this.spotted.delete(id); pool = here; }
    const humans = pool.filter((id) => !this.room.get(id).bot);
    if (humans.length) pool = humans; // real people get the spotlight first
    const id = pool[Math.floor(this.room.rng() * pool.length)];
    this.spotted.add(id);
    return id;
  }
  setSpot(id) { const p = this.room.get(id), r = this.r; r.spot = id; r.spotName = p ? p.name : '—'; r.spotColor = p ? p.color : '#888'; }

  nextRound() {
    if (this.n >= this.s.rounds) return this.finish();
    this.n++;
    const ids = this.room.list().map((p) => p.id);
    const spec = this.draw(); this.specs[this.n] = spec;
    this.r = { n: this.n, kind: isRead(this.n) && ids.length >= 2 ? 'read' : 'normal', spec, ids, pos: new Map(), guesses: new Map(), spot: null, spotPos: null, result: null, gained: new Map(), soon: false };
    if (this.r.kind === 'read') this.setSpot(this.pickSpot(ids));
    this.phase = 'intro';
    this.room.fx(this.r.kind === 'read' ? 'bonus' : 'round');
    this.setTimer(this.r.kind === 'read' ? READ_INTRO_MS : INTRO_MS, () => this.open());
  }
  open() {
    if (this.phase !== 'intro') return;
    const r = this.r, ms = this.s.seconds * 1000;
    if (r.kind === 'read') {
      this.phase = 'spot'; this.room.fx('spot');
      this.setTimer(ms, () => this.endSpot());
      const p = this.room.get(r.spot);
      if (p && p.bot) this.room.after(1500 + this.room.rng() * 3000, () => this.botPlace(p, r.n, 'spot'));
      return;
    }
    this.openPlace();
  }
  openPlace() {
    const r = this.r, ms = this.s.seconds * 1000;
    this.phase = 'place'; r.soon = false; this.room.fx('open');
    this.setTimer(ms, () => this.closePlace());
    const span = Math.max(2000, Math.min(ms * 0.6, 9000));
    for (const id of r.ids) { const p = this.room.get(id); if (p && p.bot) this.room.after(1200 + this.room.rng() * span, () => this.botPlace(p, r.n, 'place')); }
  }
  // The spotlight never locked in (or left): this round becomes a normal round for everyone.
  toNormal() {
    const r = this.r;
    r.kind = 'normal'; r.dozed = !r.left; r.spot = null; r.spotPos = null; r.pos.clear();
    this.room.fx('dozed');
    this.openPlace();
  }
  endSpot() {
    if (this.phase !== 'spot') return;
    const r = this.r;
    if (r.spotPos == null) return this.toNormal();
    this.phase = 'guess'; r.soon = false; this.room.fx('open');
    const ms = this.s.seconds * 1000;
    this.setTimer(ms, () => this.closeGuess());
    const span = Math.max(2000, Math.min(ms * 0.6, 9000));
    for (const id of r.ids) { const p = this.room.get(id); if (p && p.bot && id !== r.spot) this.room.after(1200 + this.room.rng() * span, () => this.botGuess(p, r.n)); }
    this.maybeAllIn();
  }
  waitingFor() {
    const r = this.r; if (!r) return [];
    if (this.phase === 'place') return r.ids.filter((id) => this.room.get(id) && !r.pos.has(id));
    if (this.phase === 'guess') return r.ids.filter((id) => id !== r.spot && this.room.get(id) && !r.guesses.has(id));
    if (this.phase === 'spot') return r.spotPos == null && r.spot ? [r.spot] : [];
    return [];
  }
  maybeAllIn() {
    const r = this.r;
    if (!r || r.soon || (this.phase !== 'place' && this.phase !== 'guess')) return;
    if (this.waitingFor().length) return;
    const any = this.phase === 'place' ? r.pos.size : r.guesses.size;
    if (!any && this.phase === 'place') return; // nobody left to wait for: the timer handles it
    r.soon = true; this.room.fx('allin');
    this.setTimer(ALLIN_MS, () => (this.phase === 'place' ? this.closePlace() : this.closeGuess()));
  }

  act(p, m) {
    const r = this.r;
    if (this.phase === 'over') return { ok: false, error: 'The game is over.' };
    if (!r || !this.scores.has(p.id) || !r.ids.includes(p.id)) return { ok: false, error: 'You’re in from the next round! 🎟️' };
    if (m.op !== 'place' && m.op !== 'guess') return { ok: false, error: 'Unknown move.' };
    if (typeof m.pos !== 'number' || !Number.isFinite(m.pos) || m.pos < 0 || m.pos > 100) return { ok: false, error: 'Drag the marker somewhere on the line.' };
    const pos = clamp(m.pos);
    if (m.op === 'place') {
      if (this.phase === 'spot') {
        if (p.id !== r.spot) return { ok: false, error: 'Wait for the spotlight to place themselves.' };
        r.spotPos = pos; r.spotAt = this.room.now();
        this.room.fx('lock');
        this.setTimer(ALLIN_MS, () => this.endSpot());
        return { ok: true };
      }
      if (this.phase !== 'place') return { ok: false, error: 'Placing isn’t open right now.' };
      const fresh = !r.pos.has(p.id);
      r.pos.set(p.id, pos);
      if (fresh && r.pos.size <= 20) this.room.fx('lock');
      this.maybeAllIn();
      return { ok: true };
    }
    if (this.phase !== 'guess') return { ok: false, error: 'Guessing isn’t open right now.' };
    if (p.id === r.spot) return { ok: false, error: 'You’re the spotlight! Keep a poker face. 😌' };
    const fresh = !r.guesses.has(p.id);
    r.guesses.set(p.id, { pos, at: this.room.now() });
    if (fresh && r.guesses.size <= 20) this.room.fx('lock');
    this.maybeAllIn();
    return { ok: true };
  }

  // ---- bots: consistent personalities (so twins are real) with a little noise ----
  botOpinion(p, spec) {
    const tr = this.traits.get(p.id); if (!tr) return 50;
    const h = hash(spec.l + '|' + spec.r), axis = h % TRAITS, flip = (h >> 3) & 1;
    const base = (flip ? 1 - tr.t[axis] : tr.t[axis]) * 100;
    return clamp(base + (this.room.rng() + this.room.rng() - 1) * tr.noise * 2);
  }
  botPlace(p, n, phase) {
    const r = this.r;
    if (!r || r.n !== n || this.phase !== phase || !this.room.get(p.id)) return;
    if (phase === 'place' && r.pos.has(p.id)) return;
    this.act(p, { op: 'place', pos: this.botOpinion(p, r.spec) });
  }
  botGuess(p, n) {
    const r = this.r;
    if (!r || r.n !== n || this.phase !== 'guess' || r.guesses.has(p.id) || !this.room.get(p.id) || r.spotPos == null) return;
    const tr = this.traits.get(p.id) || { read: 20 };
    this.act(p, { op: 'guess', pos: clamp(r.spotPos + (this.room.rng() + this.room.rng() - 1) * tr.read) });
  }

  add(id, pts) {
    if (!this.scores.has(id) || !pts) return;
    this.scores.set(id, this.scores.get(id) + pts);
    this.r.gained.set(id, (this.r.gained.get(id) || 0) + pts);
  }
  record(id, pos) { const a = this.answers.get(id); if (a) a.set(this.r.n, pos); }

  closePlace() {
    if (this.phase !== 'place') return;
    this.stopTimer();
    const r = this.r;
    const dots = [...r.pos].filter(([id]) => this.room.get(id)).map(([id, pos]) => ({ id, pos }));
    for (const d of dots) this.record(d.id, d.pos);
    const sorted = dots.slice().sort((a, b) => a.pos - b.pos || r.ids.indexOf(a.id) - r.ids.indexOf(b.id));
    const count = sorted.length;
    const avg = count ? sorted.reduce((s, d) => s + d.pos, 0) / count : null;
    const nearAvg = new Set();
    if (count >= 2) for (const d of sorted) if (Math.abs(d.pos - avg) <= NEAR_AVG) { nearAvg.add(d.id); this.add(d.id, PTS.avg); this.stats.get(d.id).nearAvg++; }
    // Nearest neighbours: the two players placed closest together (ties: a random one of them).
    let pair = null;
    if (count >= 2) {
      let best = Infinity, cands = [];
      for (let i = 1; i < count; i++) { const g = sorted[i].pos - sorted[i - 1].pos; if (g < best) { best = g; cands = [i]; } else if (g === best) cands.push(i); }
      const i = cands[Math.floor(this.room.rng() * cands.length)];
      pair = { a: sorted[i - 1].id, b: sorted[i].id, gap: best };
      for (const id of [pair.a, pair.b]) { this.add(id, PTS.neighbour); this.stats.get(id).neighbours++; }
    }
    // The biggest cluster: the 12-point window holding the most dots.
    let cluster = null;
    const need = count <= 4 ? 2 : count <= 8 ? 3 : Math.max(3, Math.ceil(count * 0.15));
    if (count >= 2) {
      let bi = 0, bj = 0;
      for (let i = 0, j = 0; i < count; i++) { while (sorted[i].pos - sorted[j].pos > 12) j++; if (i - j > bj - bi) { bi = j; bj = i; } }
      const size = bj - bi + 1;
      if (size >= need) {
        const from = sorted[bi].pos, to = sorted[bj].pos, center = Math.round((from + to) / 2);
        cluster = { from, to, count: size, center, side: sideOf(r.spec, center), all: size === count };
      }
    }
    const lo = sorted[0], hi = sorted[count - 1];
    const extremes = count >= 2 && hi.pos - lo.pos >= 20 ? { lo: { id: lo.id, pos: lo.pos }, hi: { id: hi.id, pos: hi.pos } } : null;
    r.result = { kind: 'normal', count, avg: avg == null ? null : Math.round(avg), dots: sorted, nearAvg, pair, cluster, extremes, dozed: !!r.dozed, left: !!r.left };
    this.phase = 'reveal'; this.room.fx('reveal', { count });
    if (cluster && cluster.count >= 3) { const n = r.n; this.room.after(2600, () => { if (this.r && this.r.n === n && this.phase === 'reveal') this.room.fx('cluster'); }); }
    this.setTimer(REVEAL_MS + (this.n >= this.s.rounds ? LAST_BONUS_MS : 0), () => this.nextRound());
  }
  closeGuess() {
    if (this.phase !== 'guess') return;
    this.stopTimer();
    const r = this.r, target = r.spotPos;
    if (this.answers.has(r.spot)) this.record(r.spot, target);
    const list = [...r.guesses].filter(([id]) => this.room.get(id)).map(([id, g]) => ({ id, pos: g.pos, err: Math.abs(g.pos - target), at: g.at }))
      .sort((a, b) => a.err - b.err || a.at - b.at);
    let prev = null;
    list.forEach((g, i) => {
      g.pts = prev && prev.err === g.err ? prev.pts : PTS.read[i] || 0;
      g.bull = g.err <= BULLSEYE;
      const st = this.stats.get(g.id); st.guessErr += g.err; st.guessN++;
      const pts = g.pts + (g.bull ? PTS.bullseye : 0);
      this.add(g.id, pts); st.bonus += pts;
      prev = g;
    });
    const readers = list.filter((g) => g.err <= OPEN).length;
    const sst = this.stats.get(r.spot);
    if (sst) { sst.spotN++; sst.spotGuessers += list.length; sst.spotReaders += readers; }
    this.add(r.spot, readers * PTS.book);
    const avgGuess = list.length ? Math.round(list.reduce((s, g) => s + g.pos, 0) / list.length) : null;
    r.result = { kind: 'read', target, guesses: list, readers, count: list.length, avgGuess };
    this.phase = 'reveal'; this.room.fx('drum');
    const n = r.n;
    this.room.after(DROP_MS, () => { if (this.r && this.r.n === n && this.phase === 'reveal') this.room.fx(list.some((g) => g.bull) ? 'bullseye' : 'drop'); });
    this.setTimer(READ_REVEAL_MS + (this.n >= this.s.rounds ? LAST_BONUS_MS : 0), () => this.nextRound());
  }
  finish() { this.stopTimer(); this.phase = 'over'; this.endsAt = 0; this.final = this.makeFinal(); this.room.fx('win'); }
  next() {
    if (this.phase === 'intro') { this.stopTimer(); this.open(); }
    else if (this.phase === 'place') this.closePlace();
    else if (this.phase === 'spot') { this.stopTimer(); this.endSpot(); }
    else if (this.phase === 'guess') this.closeGuess();
    else if (this.phase === 'reveal') { this.stopTimer(); this.nextRound(); }
  }

  // ---- the end: twins, opposites and awards ----
  makeFinal() {
    const ppl = this.room.list().filter((p) => this.scores.has(p.id));
    const N = ppl.length, R = this.n;
    const vec = ppl.map((p) => { const a = this.answers.get(p.id); const v = new Array(R + 1).fill(NaN); for (const [n, x] of a) v[n] = x; return v; });
    const answered = vec.map((v) => v.filter((x) => !Number.isNaN(x)).length);
    const common = Array.from({ length: N }, () => new Int16Array(N)), diff = Array.from({ length: N }, () => new Float64Array(N).fill(NaN));
    for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
      let c = 0, s = 0; const a = vec[i], b = vec[j];
      for (let n = 1; n <= R; n++) if (!Number.isNaN(a[n]) && !Number.isNaN(b[n])) { c++; s += Math.abs(a[n] - b[n]); }
      common[i][j] = common[j][i] = c;
      if (c) diff[i][j] = diff[j][i] = s / c;
    }
    const pub = (i) => ({ id: ppl[i].id, name: ppl[i].name, color: ppl[i].color, bot: !!ppl[i].bot });
    const pct = (d) => Math.max(0, Math.round(100 - d));
    // A conversation starter: the spectrum two people agreed on most (or differed on most).
    const about = (i, j, most) => {
      let best = null;
      for (let n = 1; n <= R; n++) {
        const a = vec[i][n], b = vec[j][n]; if (Number.isNaN(a) || Number.isNaN(b)) continue;
        const d = Math.abs(a - b);
        if (!best || (most ? d > best.d : d < best.d)) best = { n, d, me: a, them: b };
      }
      return best ? { spec: this.specs[best.n], me: best.me, them: best.them } : null;
    };
    const per = new Map(), twinOf = new Array(N).fill(-1), oppOf = new Array(N).fill(-1);
    for (let i = 0; i < N; i++) {
      if (!answered[i]) continue;
      let maxC = 0; for (let j = 0; j < N; j++) if (j !== i && common[i][j] > maxC) maxC = common[i][j];
      if (!maxC) continue;
      const min = Math.max(1, Math.ceil(maxC * 0.6));
      let t = -1, o = -1;
      for (let j = 0; j < N; j++) {
        if (j === i || common[i][j] < min) continue;
        if (t < 0 || diff[i][j] < diff[i][t]) t = j;
        if (o < 0 || diff[i][j] > diff[i][o]) o = j;
      }
      twinOf[i] = t; oppOf[i] = o;
      per.set(ppl[i].id, {
        twin: t >= 0 ? { ...pub(t), pct: pct(diff[i][t]), shared: common[i][t], about: about(i, t, false), mutual: twinOf[t] === i } : null,
        opp: o >= 0 && o !== t ? { ...pub(o), pct: pct(diff[i][o]), shared: common[i][o], about: about(i, o, true) } : null,
      });
    }
    // mutual flags need everyone's twin first
    for (let i = 0; i < N; i++) { const m = per.get(ppl[i].id); if (m && m.twin) m.twin.mutual = twinOf[twinOf[i]] === i; }
    // Unique twin pairs for the TV grid (a mutual pair shows once), most alike first.
    const seen = new Set(), pairs = [];
    for (let i = 0; i < N; i++) {
      const t = twinOf[i]; if (t < 0) continue;
      const k = i < t ? i + ':' + t : t + ':' + i; if (seen.has(k)) continue; seen.add(k);
      pairs.push({ a: pub(i), b: pub(t), pct: pct(diff[i][t]), mutual: twinOf[t] === i, shared: common[i][t], about: about(i, t, false) });
    }
    pairs.sort((x, y) => y.pct - x.pct || Number(y.mutual) - Number(x.mutual) || y.shared - x.shared);
    // Most unique: furthest from everyone on average.
    let unique = null;
    for (let i = 0; i < N; i++) {
      let s = 0, c = 0; for (let j = 0; j < N; j++) if (j !== i && !Number.isNaN(diff[i][j])) { s += diff[i][j]; c++; }
      if (c >= 2 && answered[i] >= 2) { const v = s / c; if (!unique || v > unique.v) unique = { i, v }; }
    }
    // Mind Reader: smallest average error when guessing the spotlight. Open Book: easiest to read.
    let mind = null, book = null;
    for (let i = 0; i < N; i++) {
      const st = this.stats.get(ppl[i].id);
      if (st.guessN) { const v = st.guessErr / st.guessN; if (!mind || v < mind.v || (v === mind.v && st.guessN > mind.n)) mind = { i, v, n: st.guessN }; }
      if (st.spotGuessers) { const v = st.spotReaders / st.spotGuessers; if (v > 0 && (!book || v > book.v || (v === book.v && st.spotReaders > book.n))) book = { i, v, n: st.spotReaders, of: st.spotGuessers }; }
    }
    return {
      per, pairs, players: N,
      unique: unique ? { ...pub(unique.i), pct: pct(unique.v) } : null,
      mind: mind ? { ...pub(mind.i), err: Math.round(mind.v), guesses: mind.n } : null,
      book: book ? { ...pub(book.i), readers: book.n, of: book.of } : null,
    };
  }

  // ---- public / private state ----
  pub(id) { const p = this.room.get(id); return p ? { id, name: p.name, color: p.color } : { id, name: '—', color: '#888' }; }
  standings() { return [...this.scores].filter(([id]) => this.room.get(id)).map(([id, points]) => ({ id, name: this.room.name(id), color: this.room.get(id).color, points })).sort((a, b) => b.points - a.points); }
  endsIn() { return this.endsAt && this.phase !== 'over' ? Math.max(0, this.endsAt - this.room.now()) : 0; }
  common() {
    const r = this.r;
    return {
      phase: this.phase, endsIn: this.endsIn(), n: this.n, total: this.s.rounds, names: this.namesOn(),
      kind: r ? r.kind : null, spec: r ? r.spec : null, nextRead: this.n < this.s.rounds && isRead(this.n + 1),
      spot: r && r.kind === 'read' && r.spot ? { id: r.spot, name: r.spotName, color: r.spotColor } : null,
    };
  }
  // The reveal for the TV. Names are left off the dots in shy mode (the spotlight is always named).
  publicResult() {
    const r = this.r, res = r && r.result;
    if (!res || this.phase !== 'reveal') return null;
    const nm = this.namesOn(), dot = (id, pos) => { const p = this.pub(id); return { name: nm ? p.name : null, color: p.color, pos }; };
    if (res.kind === 'read') {
      return {
        kind: 'read', target: res.target, readers: res.readers, count: res.count, avgGuess: res.avgGuess,
        guesses: res.guesses.map((g) => ({ ...dot(g.id, g.pos), err: g.err, pts: g.pts, bull: g.bull })),
        top: res.guesses.filter((g) => g.pts > 0 || g.bull).slice(0, 5).map((g) => ({ ...dot(g.id, g.pos), err: g.err, pts: g.pts + (g.bull ? PTS.bullseye : 0), bull: g.bull })),
      };
    }
    const named = (x) => (x ? { name: nm ? this.room.name(x.id) : null, color: this.pub(x.id).color, pos: x.pos } : null);
    return {
      kind: 'normal', count: res.count, avg: res.avg, nearAvg: res.nearAvg.size, dozed: res.dozed, left: res.left,
      dots: res.dots.map((d) => dot(d.id, d.pos)),
      cluster: res.cluster, lo: res.extremes ? named(res.extremes.lo) : null, hi: res.extremes ? named(res.extremes.hi) : null,
      pair: res.pair ? { a: nm ? this.room.name(res.pair.a) : null, b: nm ? this.room.name(res.pair.b) : null, gap: res.pair.gap } : null,
    };
  }
  finalTv() {
    const f = this.final; if (!f) return null;
    const strip = (x) => (x ? { name: x.name, color: x.color } : null);
    const pairs = f.pairs.filter((x) => this.room.get(x.a.id) && this.room.get(x.b.id));
    return {
      players: f.players, more: Math.max(0, pairs.length - 24),
      pairs: pairs.slice(0, 24).map((x) => ({ a: strip(x.a), b: strip(x.b), pct: x.pct, mutual: x.mutual, about: x.about ? specText(x.about.spec) : null })),
      unique: f.unique && this.room.get(f.unique.id) ? { ...strip(f.unique), pct: f.unique.pct } : null,
      mind: f.mind && this.room.get(f.mind.id) ? { ...strip(f.mind), err: f.mind.err, guesses: f.mind.guesses } : null,
      book: f.book && this.room.get(f.book.id) ? { ...strip(f.book), readers: f.book.readers, of: f.book.of } : null,
    };
  }
  tv() {
    const r = this.r, wait = this.waitingFor();
    const of = !r ? 0 : this.phase === 'guess' ? r.ids.filter((id) => id !== r.spot && this.room.get(id)).length : r.ids.filter((id) => this.room.get(id)).length;
    const st = this.standings();
    return {
      ...this.common(),
      locked: !r ? 0 : this.phase === 'guess' ? r.guesses.size : this.phase === 'spot' ? (r.spotPos == null ? 0 : 1) : r.pos.size, of,
      // who we're still waiting for (names only, never where they stand); only for smaller rooms
      waiting: (this.phase === 'place' || this.phase === 'guess') && of <= 24 ? wait.map((id) => this.room.name(id)) : null,
      result: this.publicResult(), final: this.phase === 'over' ? this.finalTv() : null,
      standings: st.slice(0, this.phase === 'over' ? 10 : 8).map(({ id, ...x }) => x),
    };
  }
  myResult(p) {
    const r = this.r, res = r && r.result;
    if (!res || this.phase !== 'reveal') return null;
    const gained = r.gained.get(p.id) || 0;
    if (res.kind === 'read') {
      const i = res.guesses.findIndex((g) => g.id === p.id), g = res.guesses[i];
      return { kind: 'read', target: res.target, gained, isSpot: r.spot === p.id, readers: res.readers, count: res.count, avgGuess: res.avgGuess,
        guess: g ? g.pos : null, err: g ? g.err : null, rank: g ? i + 1 : null, pts: g ? g.pts : 0, bull: g ? g.bull : false };
    }
    const mine = res.dots.find((d) => d.id === p.id);
    let closest = null;
    if (mine) for (const d of res.dots) if (d.id !== p.id && (!closest || Math.abs(d.pos - mine.pos) < closest.gap)) closest = { id: d.id, gap: Math.abs(d.pos - mine.pos) };
    const pair = res.pair && (res.pair.a === p.id || res.pair.b === p.id) ? (res.pair.a === p.id ? res.pair.b : res.pair.a) : null;
    const nm = this.namesOn();
    return { kind: 'normal', avg: res.avg, count: res.count, gained, pos: mine ? mine.pos : null, nearAvg: res.nearAvg.has(p.id),
      neighbour: pair ? { name: nm ? this.room.name(pair) : null, gap: res.pair.gap } : null,
      closest: closest ? { name: nm ? this.room.name(closest.id) : null, color: this.pub(closest.id).color, gap: closest.gap } : null,
      lo: res.extremes ? res.extremes.lo.pos : null, hi: res.extremes ? res.extremes.hi.pos : null };
  }
  view(p) {
    const r = this.r, st = this.standings(), inRound = !!(r && r.ids.includes(p.id) && this.scores.has(p.id));
    const isSpot = !!(r && r.kind === 'read' && r.spot === p.id);
    let final = null;
    if (this.phase === 'over' && this.final) {
      const me = this.final.per.get(p.id) || { twin: null, opp: null };
      const strip = (x) => (x ? { name: x.name, color: x.color, pct: x.pct, mutual: x.mutual, shared: x.shared, about: x.about ? { ...x.about.spec, me: x.about.me, them: x.about.them } : null } : null);
      const aw = [];
      const f = this.final;
      if (f.pairs[0] && (f.pairs[0].a.id === p.id || f.pairs[0].b.id === p.id)) aw.push({ icon: '👯', title: 'Most Alike Pair' });
      if (f.unique && f.unique.id === p.id) aw.push({ icon: '🦄', title: 'Most Unique' });
      if (f.mind && f.mind.id === p.id) aw.push({ icon: '🔮', title: 'Mind Reader' });
      if (f.book && f.book.id === p.id) aw.push({ icon: '📖', title: 'Open Book' });
      final = { twin: strip(me.twin), opp: strip(me.opp), awards: aw, standings: st.slice(0, 10).map(({ id, ...x }) => x) };
    }
    return {
      ...this.common(), me: p.id, inRound, isSpot,
      myPos: r ? (isSpot ? r.spotPos : r.pos.has(p.id) ? r.pos.get(p.id) : null) : null,
      myGuess: r && r.guesses.has(p.id) ? r.guesses.get(p.id).pos : null,
      locked: r ? (this.phase === 'guess' ? r.guesses.size : r.pos.size) : 0,
      result: this.myResult(p), final,
      points: this.scores.get(p.id) || 0, rank: st.findIndex((x) => x.id === p.id) + 1, of: st.length,
    };
  }
}

module.exports = {
  key: 'spectrum', name: 'Where Do You Stand?', min: 3, fields, defaults,
  create: (room, settings) => new Spectrum(room, settings),
  _test: { PACKS, PTS, isRead, specText },
};
