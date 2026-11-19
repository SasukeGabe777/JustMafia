'use strict';
// Meme Maker: a JustGameBox caption game. Each round every phone gets a meme TEMPLATE (original
// cartoon art drawn in code: public/box/games/memes.js) and writes its captions. The TV parades
// everyone's memes one by one, then the room votes for the funniest (never your own).
// Round types: Free Caption, Same Template Different Jokes, Prompted (caption a situation),
// Remix (start a meme, then finish someone else's half-finished one), and a final
// Meme of the Night showdown between the night's best. Big rooms (13+ memes) get a phone-only
// semi-final first, so the TV only parades the finalists. The game ends with a gallery and awards.
const GEARS = require('../../public/shared/gear'); // shop gear: the frame around your memes (slot memes/frame)
const opt = (pairs) => pairs.map(([value, label]) => ({ value, label }));
const fields = [
  { key: 'rounds', label: 'Rounds', options: opt([[2, '2 rounds (quick)'], [3, '3 rounds'], [4, '4 rounds'], [5, '5 rounds']]) },
  { key: 'seconds', label: 'Time to caption', options: opt([[60, '60 seconds'], [90, '90 seconds'], [120, '2 minutes']]) },
  { key: 'content', label: 'Content', options: opt([['family', 'Family-friendly (strict filter)'], ['party', 'Party (swear filter on)'], ['uncut', 'Uncut (slurs still blocked)']]) },
  { key: 'theme', label: 'Situations (Prompted round + idea chips)', options: opt([['everyday', '😂 Everyday life'], ['holiday', '🎄 Holiday (winter, spooky, summer)'], ['office', '💼 Office-safe'], ['classics', '🎬 Classics (no pop culture)'], ['travel', '🌍 Travel & world'], ['mix', '🎲 Mix of everything']]) },
];
const defaults = { rounds: 3, seconds: 90, content: 'family', theme: 'everyday' };

// Templates: [id, name, slot labels]. The client draws each id; the slot count must match.
const TEMPLATES = [
  ['fine', 'This Is Fine', ['Top text', 'Bottom text']],
  ['buttons', 'Two Buttons', ['Left button', 'Right button', 'The sweaty one']],
  ['whowins', 'Who Would Win?', ['Left fighter', 'Right fighter']],
  ['brain', 'Growing Brain', ['Small brain', 'Bigger brain', 'Glowing brain', 'Cosmic brain']],
  ['catplate', 'Cat vs Dinner', ['Top text', 'Bottom text']],
  ['lookback', 'Looking Back', ['The distraction', 'The one looking back', 'Their partner']],
  ['nahyeah', 'Nah / Yeah', ['Nah…', 'Yeah!']],
  ['galaxy', 'Galaxy Chart', ['Dim idea', 'Bright idea', 'Galaxy idea']],
  ['shook', 'Shook Face', ['Top text', 'Bottom text']],
  ['pointing', 'Pointing Pair', ['Left twin', 'Right twin', 'Top text']],
  ['expect', 'Expectation vs Reality', ['Expectation', 'Reality']],
  ['temple', 'Big Brain Move', ['Top text', 'Bottom text']],
  ['shark', 'Sneaky Shark', ['The swimmer', 'The shark']],
  ['dragon', 'Boss Fight', ['The tiny knight', 'The dragon']],
  ['chart', 'Number Go Up', ['Top text', 'Bottom text']],
  ['awake', '3 AM Brain', ['The thought', 'Bottom text']],
  ['ghost', 'Unbothered Cat', ['The ghost', 'The cat']],
  ['potato', 'Couch Potato', ['Top text', 'Bottom text']],
  ['exit', 'The Exit', ['Straight on', 'The exit', 'The car']],
  ['scroll', 'Ancient Scroll', ['The scroll says', 'Bottom text']],
  ['balloon', 'Just Out of Reach', ['The kid', 'The balloon']],
  ['robot', 'Robot Studies Humans', ['Top text', 'Bottom text']],
  ['fridge', 'Midnight Fridge', ['Top text', 'Bottom text']],
  ['cactus', 'Cactus Hug', ['The hugger', 'The cactus']],
  ['snail', 'Snail Race', ['The snail', 'The sleepy cheetah']],
  ['mirror', 'Mirror Mirror', ['Me', 'My reflection']],
  ['ufo', 'Beam Me Up', ['The UFO', 'The cow', 'Bottom text']],
  ['toast', 'Butter Side Down', ['Top text', 'Bottom text']],
  ['duckboss', 'Duck in Charge', ['Top text', 'Bottom text']],
  ['scale', 'Unfair Scale', ['Light side', 'Heavy side', 'Top text']],
  ['volcano', 'Picnic Volcano', ['Top text', 'Bottom text']],
  ['trophy', 'Participation Trophy', ['Top text', 'Bottom text']],
  ['ship', 'Sinking Ship', ['Top text', 'Bottom text']],
  ['snowman', 'Summer Snowman', ['Top text', 'Bottom text']],
].map(([id, name, slots]) => ({ id, name, slots }));
const TPL = new Map(TEMPLATES.map((t) => [t.id, t]));

// Situations: the Prompted round's prompt and the idea chips on the phone.
const SITUATIONS = [
  'When the WiFi drops', 'Me on a Monday morning', 'When the group chat goes quiet', 'When someone says “quick question”',
  'Me at the buffet', 'When the microwave beeps', 'My plants when I forget them', 'When the song gets to the good part',
  'Me pretending to understand', 'When the delivery is “out for delivery”', 'Me at 3% battery', 'When the teacher says “pop quiz”',
  'Me trying to wake up', 'When you hear your name in another room', 'When the game update is 40 GB', 'Me after one push-up',
  'The dog when I say “walk”', 'When the leftovers are gone', 'Me reading the instructions after', 'When autocorrect strikes',
  'My brain at bedtime', 'When the elevator doors almost close', 'Me choosing a movie for an hour', 'When the cat knocks something off',
  'Me in group projects', 'When someone spoils the ending', 'When it’s finally Friday', 'Me waiting for the toast',
  'My bank account on payday', 'When the pizza arrives', 'Me trying to fold a fitted sheet', 'When the printer works first try',
  'Me in the snack aisle', 'When the alarm goes off', 'When you step on a toy brick', 'My face when the bill comes',
  'Me explaining a meme', 'When the sun comes out for 5 minutes', 'When your sock gets wet', 'Me saying “one more episode”',
];
const PARTY_SITUATIONS = [
  'When the ex texts “hey”', 'Me at the party at 9:01 pm', 'When the boss says “got a minute?”', 'Me after “just one drink”',
  'When someone else pays', 'My excuses for skipping the gym', 'When the date shows up 40 minutes late', 'Me on payday vs three days later',
  'When the landlord calls', 'Me at the wedding open bar', 'When the karaoke machine comes out', 'My search history at 2 am',
];
// Themed situation packs (all family-safe). The 'theme' setting picks one; 'everyday' is the original list.
const THEMES = {
  holiday: [
    'When it snows on a school day', 'Me untangling last year’s lights', 'When the gift is socks again', 'Me after the third holiday dinner',
    'When the snowman melts overnight', 'Me hearing the first winter song of the year', 'When the wrapping paper runs out', 'Me guessing what’s in the box',
    'When it’s too cold to leave the blanket', 'Me at the New Year’s countdown', 'My resolutions by the second week', 'When the hot cocoa is still too hot',
    'When someone says “just one more cookie”', 'Me shoveling snow', 'When the sled goes faster than planned', 'Me in five layers of winter clothes',
    'When the costume store is sold out', 'Me checking my candy haul', 'When the haunted house actor jumps out', 'My jack-o’-lantern vs the picture online',
    'When someone takes the good candy', 'Me pretending I wasn’t scared', 'When the leaf pile has a surprise inside', 'The cat in a pumpkin costume',
    'When summer break finally starts', 'Me after one hour at the beach', 'When the ice pop melts faster than you eat it', 'Me forgetting the sunscreen',
    'When the pool is colder than expected', 'Me at the summer barbecue', 'When the ice cream truck drives past', 'Me fighting a beach umbrella in the wind',
    'When the fireworks start and the dog hides', 'Me on the last day of vacation', 'When a seagull steals your snack', 'Me setting up a tent for the first time',
    'When the birthday candles won’t blow out', 'Me trying to keep a surprise party secret', 'When the holiday photo needs one more try', 'Me eating leftovers for a week',
    'When the decorations are still up in spring', 'Me finding a gift I hid and forgot', 'When the snow day gets cancelled', 'Me waiting for the sun to come back',
  ],
  office: [
    'When the meeting could have been an email', 'Me on mute talking for five minutes', 'When someone replies-all', 'Me at the office birthday cake',
    'When the printer says “paper jam” with no paper jam', 'Me looking busy when the manager walks past', 'When the coffee machine is broken', 'Me opening 47 browser tabs',
    'When the WiFi password is on a sticky note somewhere', 'Me pretending to take notes', 'When it’s 4:59 on Friday', 'When someone microwaves fish',
    'Me after one more spreadsheet', 'When the video call freezes on your worst face', 'Me finding free snacks in the break room', 'When the elevator stops at every floor',
    'Me “circling back” for the third time', 'When the new chair is actually comfy', 'Me remembering the email I forgot to send', 'When the fire drill is during lunch',
    'When someone took my stapler', 'Me naming the final file “final_final_v3”', 'When the office plant is thriving', 'Me after a meeting about meetings',
    'When your calendar has no breaks', 'Me explaining a chart I don’t understand', 'When the vending machine eats your coins', 'When the boss joins the group chat',
    'Me at the team-building activity', 'When the computer needs an update right now', 'Me walking into the wrong meeting room', 'When the out-of-office reply kicks in',
    'Me when someone says “let’s take this offline”', 'When the password must be changed again', 'Me on my lunch break', 'When the team actually finishes early',
    'Me after the first coffee', 'When someone shares the wrong screen', 'When the keyboard is sticky', 'Me hearing “any questions?” at the end',
  ],
  classics: [
    'When the cookie jar is empty', 'Me trying to whistle', 'When the kite gets stuck in a tree', 'Me waiting for the kettle to boil',
    'When the cat sits in the sunny spot', 'Me at the top of the slide', 'When the ice cream drips on your hand', 'Me trying to catch a bubble',
    'When the bread lands butter side down', 'Me trying to skip a stone', 'When the umbrella turns inside out', 'Me chasing a runaway balloon',
    'When the dog hears the doorbell', 'Me hearing thunder', 'When the last puzzle piece is missing', 'Me finding money in an old coat',
    'When the swing goes really high', 'Me after a big lunch', 'When the duck follows you home', 'Me trying to open a jar',
    'When the clock strikes midnight', 'Me picking the slowest checkout line', 'When the rainbow appears', 'Me on the first warm day of the year',
    'When the sandcastle gets knocked down', 'Me trying to sneak a snack', 'When the soup is too hot', 'Me looking for my glasses',
    'When the birds sing at 5 am', 'Me after climbing the stairs', 'When the garden finally grows a tomato', 'Me winning at checkers',
    'When the bus pulls away just as you arrive', 'Me remembering the name too late', 'When the hiccups won’t stop', 'Me building a blanket fort',
    'When the chair squeaks in a quiet room', 'Me telling a joke and forgetting the end', 'When the pencil breaks during a test', 'Me trying to fold a map',
  ],
  travel: [
    'When the suitcase is two pounds overweight', 'Me at airport security', 'When the flight is delayed again', 'Me trying to speak the local language',
    'When the hotel room looks nothing like the photos', 'Me after a twelve-hour flight', 'When the luggage comes out first', 'Me looking at the map upside down',
    'When the seat neighbour falls asleep on you', 'Me ordering by pointing at pictures', 'When the train leaves without you', 'Me trying the local spicy food',
    'When the souvenir costs more than the trip', 'Me taking 300 photos of one view', 'When the guidebook says “a short walk”', 'Me on the road trip snack run',
    'When someone asks “are we there yet?”', 'Me finding the perfect street food', 'When the hostel bunk squeaks', 'Me packing the night before',
    'When the GPS says “turn around”', 'Me trying to fit the umbrella in a tiny bag', 'When the beach is actually rocks', 'Me after hiking up the mountain',
    'When the camel won’t move', 'Me pretending I know how the currency works', 'When the plane food arrives', 'Me reading the menu in three languages',
    'When the tour guide walks really fast', 'Me trying to stay awake on the jet lag day', 'When the passport photo is at the worst angle', 'Me sending postcards home',
    'When the window seat has no window', 'Me unpacking after the trip', 'When you find a hidden café', 'Me seeing a famous landmark in real life',
    'When the hotel breakfast has pancakes', 'Me back home missing the holiday', 'When the ferry is bumpier than expected', 'Me forgetting the phone charger',
  ],
};
THEMES.everyday = SITUATIONS;
// Bots draw from these (and anyone stuck can be inspired by them on the phone).
const BOT_LINES = [
  'ME', 'ALSO ME', 'MY LAST TWO BRAIN CELLS', 'THE GROUP CHAT', 'ONE MORE SNACK', 'MONDAY', 'HOMEWORK', 'A NAP',
  'MY BANK ACCOUNT', 'THE WIFI', 'MY CAT', 'MY PLANS', 'THE DISHES', 'FIVE MORE MINUTES', 'MY DIET', 'PIZZA',
  'WHEN THE SNACKS ARRIVE', 'NOBODY:', 'ABSOLUTELY NOBODY:', 'ME AT 3 AM', 'THE ALARM', 'LEFTOVER CAKE',
  'MY CHARGER', 'THAT ONE SOCK', 'MY SLEEP SCHEDULE', 'THE MICROWAVE', 'THE TV REMOTE', 'MY SELF CONTROL',
  'GROWN-UP STUFF', 'BUYING MORE PLANTS', 'WATERING THE PLANTS', 'WHEN THE BUS IS LATE', 'IT’S FINE',
  'EVERYTHING IS FINE', 'TECHNICALLY CORRECT', 'NOT TODAY', 'BIG MOOD', 'WORTH IT', 'I REGRET NOTHING',
  'I REGRET EVERYTHING', 'WHEN THE TOAST POPS', 'MY TO-DO LIST', 'THE LAUNDRY PILE', 'GRANDMA’S COOKING',
  'THE DOG', 'THE NEIGHBOUR’S DOG', 'SAYING “ON MY WAY”', 'STILL IN BED', 'WEEKEND ME', 'WEEKDAY ME',
  'MY HOT TAKE', 'THE BOSS LEVEL', 'TUTORIAL LEVEL', 'SPEEDRUNNING BREAKFAST', 'ONE SINGLE GRAPE',
];

const PLANS = { 2: ['free', 'prompt'], 3: ['free', 'prompt', 'remix'], 4: ['free', 'same', 'prompt', 'remix'], 5: ['free', 'same', 'prompt', 'remix', 'free'] };
const KINDS = {
  free: { name: 'Free Caption', blurb: 'Your own template. Make it funny.', shuffle: true },
  same: { name: 'Same Template, Different Jokes', blurb: 'Everyone gets the SAME template. Who wins it?', shuffle: false },
  prompt: { name: 'Prompted', blurb: 'Caption the situation on the screen.', shuffle: true },
  remix: { name: 'Remix', blurb: 'Start a meme… then finish someone else’s!', shuffle: false },
  final: { name: 'Meme of the Night', blurb: 'The best memes of the night, one last vote.', shuffle: false },
};
const CAP_MAX = 60, SEMI_AT = 12, FINALISTS = 8, BALLOT = 6, MOTN_MAX = 6;
const INTRO_MS = 4500, PASS_MS = 3500, RESULT_MS = 9000, HURRY_MS = 20000;

// ---------- input cleaning and the profanity filter ----------
const clean = (s, max = CAP_MAX) => String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f-\u009f­​-‏‪-‮⁠-⁯﻿<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
const SLURS = ['nigg', 'fag', 'retard', 'chink', 'kike', 'tranny', 'dyke', 'coon', 'wetback'];
const STRONG = ['fuck', 'fck', 'fuk', 'fuq', 'sht', 'shit', 'bitch', 'cunt', 'dick', 'cock', 'pussy', 'asshole', 'arsehole', 'bastard', 'whore', 'slut', 'twat', 'wank', 'prick', 'bollock', 'motherf', 'dildo', 'jizz', 'cum', 'porn', 'tits', 'boner'];
const MILD = ['damn', 'hell', 'crap', 'piss', 'sexy', 'sex', 'boob', 'butt', 'arse', 'ass', 'bloody', 'sucks', 'balls', 'nude', 'naked', 'drunk', 'stfu', 'wtf', 'omfg'];
const ANYWHERE = new Set(['nigg', 'fuck', 'cunt', 'motherf', 'shit', 'wank', 'jizz']); // matched inside longer words too
const LEET = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', 8: 'b', '@': 'a', $: 's', '!': 'i', '|': 'i', '+': 't' };
const norm = (w) => w.toLowerCase().replace(/[013457@$!|+8]/g, (c) => LEET[c] || c).replace(/[^a-z]/g, '').replace(/(.)\1{2,}/g, '$1$1');
const hit = (w, roots, exact) => roots.some((r) => (!exact && ANYWHERE.has(r) ? w.includes(r) : new RegExp(`^${r}(s|es|ed|er|ers|ing|in|y|ie|ies|head|heads|face|hole|holes)?$`).test(w)));
const GRAWLIX = '#@$%&!*';
function filterText(text, level) {
  if (level === 'off') return text;
  const roots = level === 'family' ? [...SLURS, ...STRONG, ...MILD] : level === 'party' ? [...SLURS, ...STRONG] : SLURS;
  return text.replace(/[\p{L}\p{N}@$!|+*]+/gu, (word) => {
    const w = norm(word); if (!w) return word;
    // stretched spellings (fuuuck) are checked with repeats squashed too
    return hit(w, roots) || hit(w.replace(/(.)\1+/g, '$1'), roots, true) ? Array.from(word, (_, i) => GRAWLIX[i % GRAWLIX.length]).join('') : word;
  });
}

class Memes {
  constructor(room, s) {
    this.room = room; this.s = s;
    this.plan = (PLANS[s.rounds] || PLANS[3]).concat('final');
    this.phase = 'intro'; this.round = 0; this.kind = null; this.step = 1;
    this.scores = new Map(); this.stats = new Map(); this.cards = new Map();
    this.entries = []; this.shown = []; this.idx = 0; this.votes = new Map(); this.ballots = new Map(); this.semiVotes = new Map();
    this.all = []; this.last = null; this.awards = null; this.motn = null; this.seq = 0;
    this.endsAt = 0; this.timer = null; this.hurried = false; this.allIn = false; this.prompt = null; this.sameTpl = null;
    this.used = new Map(); this.situations = [];
  }
  shuffle(a) { const r = this.room.rng; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  pick(a) { return a[Math.floor(this.room.rng() * a.length) % a.length]; }
  // Family Mode on the TV (room.family) locks the content to Family: strict filter, no party situations.
  level() { return this.room && this.room.family ? 'family' : this.s.content === 'uncut' ? 'uncut' : this.s.content === 'party' ? 'party' : 'family'; }
  sitPool() {
    const theme = this.s.theme === 'mix' ? 'mix' : THEMES[this.s.theme] ? this.s.theme : 'everyday';
    const base = theme === 'mix' ? [...new Set(Object.values(THEMES).flat())] : THEMES[theme];
    return this.level() === 'family' || (theme !== 'everyday' && theme !== 'mix') ? base : base.concat(PARTY_SITUATIONS);
  }
  nextSituation() { if (!this.situations.length) this.situations = this.shuffle(this.sitPool().slice()); return this.situations.pop(); }
  setTimer(ms, fn) { this.room.cancel(this.timer); this.endsAt = this.room.now() + ms; this.timer = this.room.after(ms, fn); }
  endsIn() { return this.endsAt && this.phase !== 'over' ? Math.max(0, this.endsAt - this.room.now()) : 0; }
  active() { return this.room.list().filter((p) => p.bot || p.sockets > 0); }
  seat(p) {
    if (this.scores.has(p.id)) return;
    this.scores.set(p.id, 0);
    this.stats.set(p.id, { votes: 0, wins: 0, unan: 0, posts: 0, postMs: 0, ones: 0, remix: 0 });
  }
  start() { for (const p of this.room.list()) this.seat(p); this.nextRound(); }
  joined(p) { this.seat(p); if (this.phase === 'write' && this.kind !== 'final' && this.step === 1) this.deal(p.id); }
  left() { if (this.phase === 'write') this.maybeAllIn(); else if (this.phase === 'vote' || this.phase === 'semi') this.maybeAllVoted(); }

  // ---------- rounds ----------
  nextRound() {
    if (this.round >= this.plan.length) return this.finish();
    this.round++; this.kind = this.plan[this.round - 1]; this.step = 1;
    this.entries = []; this.shown = []; this.idx = 0; this.votes = new Map(); this.ballots = new Map(); this.semiVotes = new Map(); this.last = null; this.cards = new Map();
    this.prompt = this.kind === 'prompt' ? this.nextSituation() : null;
    this.sameTpl = this.kind === 'same' ? this.pick(TEMPLATES).id : null;
    if (this.kind === 'final') {
      this.entries = this.finalists();
      if (this.entries.length < 2) return this.finish();
    }
    this.phase = 'intro'; this.room.fx('round', { kind: this.kind });
    this.setTimer(INTRO_MS, () => (this.kind === 'final' ? this.startParade() : this.openWrite()));
  }
  freshTpl(id, not) {
    const used = this.used.get(id) || new Set();
    let pool = TEMPLATES.filter((t) => !used.has(t.id) && t.id !== not);
    if (!pool.length) { used.clear(); pool = TEMPLATES.filter((t) => t.id !== not); }
    const t = this.pick(pool); used.add(t.id); this.used.set(id, used); return t.id;
  }
  ideas() { return this.shuffle(this.sitPool().slice()).slice(0, 3); }
  deal(id) {
    if (this.cards.has(id) && this.step === 1) return;
    const tpl = this.sameTpl || this.freshTpl(id);
    this.cards.set(id, { tpl, caps: TPL.get(tpl).slots.map(() => ''), done: false, shuffled: false, ideas: this.ideas(), from: 0, upto: this.kind === 'remix' ? half(tpl) : TPL.get(tpl).slots.length, start: null });
  }
  writeMs() { const sec = Number(this.s.seconds) || 90; return this.kind === 'remix' ? Math.round(sec * (this.step === 1 ? 0.5 : 0.6)) * 1000 : sec * 1000; }
  openWrite() {
    this.phase = 'write'; this.hurried = false; this.allIn = false; this.writeAt = this.room.now();
    if (this.step === 1) for (const p of this.room.list()) this.deal(p.id);
    this.room.fx('write');
    this.setTimer(this.writeMs(), () => this.closeWrite());
    for (const p of this.room.list()) if (p.bot) this.room.after(2500 + this.room.rng() * Math.min(14000, this.writeMs() * 0.5), () => this.botWrite(p));
  }
  writers() { return this.active().filter((p) => this.cards.has(p.id)); }
  maybeAllIn() {
    if (this.phase !== 'write' || this.allIn) return;
    const need = this.writers(), done = need.filter((p) => this.cards.get(p.id).done).length;
    if (need.length && done === need.length) { this.allIn = true; this.setTimer(900, () => this.closeWrite()); return; }
    if (!this.hurried && need.length >= 3 && done >= Math.ceil(need.length * 2 / 3) && this.endsAt - this.room.now() > HURRY_MS + 2000) {
      this.hurried = true; this.setTimer(HURRY_MS, () => this.closeWrite()); this.room.fx('hurry');
    }
  }
  // A card counts when it was posted, or when time ran out with something typed in it.
  usable(c) { return c.done || c.caps.slice(c.from, c.upto).some((x) => x); }
  closeWrite() {
    if (this.phase !== 'write') return;
    this.allIn = false;
    if (this.kind === 'remix' && this.step === 1) return this.passRemix();
    const lvl = this.level();
    this.entries = [];
    for (const [id, c] of this.cards) {
      if (!this.room.get(id) || !this.usable(c)) continue;
      const caps = c.caps.map((x) => filterText(clean(x), lvl));
      const st = this.stats.get(id); if (st && c.doneAt) { st.posts++; st.postMs += c.doneAt; }
      this.entries.push({ id: 'm' + (++this.seq), tpl: c.tpl, caps, head: this.prompt ? this.prompt : '', by: id, co: c.start ? c.start.by : null, round: this.round, kind: this.kind, votes: 0, semi: 0, win: false, unan: false, chars: caps.join('').length });
    }
    if (!this.entries.length) { this.last = { none: true }; this.phase = 'result'; this.room.fx('none'); return this.setTimer(4000, () => this.nextRound()); }
    this.shuffle(this.entries);
    this.all.push(...this.entries);
    if (this.entries.length > SEMI_AT) return this.openSemi();
    this.startParade();
  }
  // Remix: the half-finished memes move on to someone else, who writes the rest.
  passRemix() {
    const starts = [];
    for (const [id, c] of this.cards) if (this.room.get(id) && c.caps.slice(0, c.upto).some((x) => x)) starts.push({ by: id, tpl: c.tpl, caps: c.caps.slice(0, c.upto).map((x) => filterText(clean(x), this.level())) });
    const finishers = this.shuffle(this.active().map((p) => p.id));
    this.shuffle(starts);
    const next = new Map();
    finishers.forEach((id, i) => {
      let st = null;
      if (starts.length) {
        for (let k = 0; k < starts.length; k++) { const c = starts[(i + k) % starts.length]; if (c.by !== id) { st = c; break; } }
      }
      if (!st) { // nobody else's start: the house starts one
        const tpl = this.freshTpl(id), n = half(tpl);
        st = { by: null, tpl, caps: Array.from({ length: n }, () => this.pick(BOT_LINES)) };
      }
      const all = TPL.get(st.tpl).slots.map((_, k) => st.caps[k] || '');
      next.set(id, { tpl: st.tpl, caps: all, done: false, shuffled: true, ideas: this.ideas(), from: st.caps.length, upto: all.length, start: { by: st.by } });
    });
    this.cards = next; this.step = 2; this.phase = 'pass'; this.room.fx('pass');
    this.setTimer(PASS_MS, () => this.openWrite());
  }

  // ---------- semi-final (big rooms): phones vote on small ballots ----------
  openSemi() {
    this.phase = 'semi'; this.semiVotes = new Map(); this.ballots = new Map(); this.allIn = false;
    const order = this.shuffle(this.entries.slice()); let at = 0;
    for (const p of this.active()) {
      const b = [];
      for (let k = 0; k < order.length && b.length < BALLOT; k++) { const m = order[(at + k) % order.length]; if (m.by !== p.id && m.co !== p.id) b.push(m.id); }
      at = (at + BALLOT) % order.length;
      if (b.length) this.ballots.set(p.id, b);
    }
    this.room.fx('semi');
    this.setTimer(35000, () => this.closeSemi());
    for (const p of this.room.list()) if (p.bot) this.room.after(2000 + this.room.rng() * 8000, () => { const b = this.ballots.get(p.id); if (this.phase === 'semi' && b && !this.semiVotes.has(p.id)) { this.semiVotes.set(p.id, this.pick(b)); this.maybeAllVoted(); } });
  }
  closeSemi() {
    if (this.phase !== 'semi') return;
    for (const mid of this.semiVotes.values()) { const m = this.entries.find((e) => e.id === mid); if (m) m.semi++; }
    for (const m of this.entries) if (m.semi) this.give(m, m.semi * 50, 'semi');
    const ranked = this.shuffle(this.entries.slice()).sort((a, b) => b.semi - a.semi);
    this.semiCut = ranked.length - FINALISTS;
    this.entries = ranked.slice(0, FINALISTS);
    this.shuffle(this.entries);
    this.startParade();
  }

  // ---------- the parade: one meme at a time on the TV ----------
  startParade() {
    this.phase = 'parade'; this.idx = 0; this.allIn = false;
    const n = this.entries.length, each = Math.max(3500, Math.min(6000, Math.round(34000 / Math.max(1, n))));
    const step = () => {
      this.idx++; this.room.fx('meme');
      if (this.idx < n) this.setTimer(each, step); else this.setTimer(each, () => this.openVote());
    };
    this.setTimer(800, step);
  }
  openVote() {
    this.phase = 'vote'; this.votes = new Map(); this.allIn = false; this.idx = this.entries.length;
    this.room.fx('vote');
    this.setTimer(Math.min(45000, 25000 + this.entries.length * 1500), () => this.decide());
    for (const p of this.room.list()) if (p.bot) this.room.after(1500 + this.room.rng() * 6000, () => {
      const opts = this.entries.filter((m) => this.canVote(p.id, m));
      if (opts.length && this.phase === 'vote' && !this.votes.has(p.id)) { this.votes.set(p.id, this.pick(opts).id); this.maybeAllVoted(); }
    });
    this.maybeAllVoted();
  }
  canVote(pid, m) { return m.by !== pid && m.co !== pid; }
  voters() {
    if (this.phase === 'semi') return this.active().filter((p) => this.ballots.has(p.id));
    return this.active().filter((p) => this.entries.some((m) => this.canVote(p.id, m)));
  }
  maybeAllVoted() {
    if ((this.phase !== 'vote' && this.phase !== 'semi') || this.allIn) return;
    const box = this.phase === 'semi' ? this.semiVotes : this.votes, v = this.voters();
    if (v.every((p) => box.has(p.id))) { this.allIn = true; this.setTimer(800, () => { this.allIn = false; this.phase === 'semi' ? this.closeSemi() : this.decide(); }); }
  }
  give(m, pts, why) {
    const add = (id, n) => { if (id && this.scores.has(id)) this.scores.set(id, this.scores.get(id) + n); };
    add(m.by, pts); add(m.co, Math.round(pts / 2));
    if (why === 'vote') for (const id of [m.by, m.co]) { const st = id && this.stats.get(id); if (st) { st.votes += pts / 100; if (m.kind === 'remix') st.remix += pts / 100; } }
  }
  // who(id) is only sent where the author is already public (results after the vote, gallery, awards,
  // Meme of the Night, who is still writing), so gear (the author's meme frame) never leaks authorship.
  who(id) { const p = this.room.get(id); return id ? { id, name: this.room.name(id), av: p && p.avatar ? String(p.avatar).slice(0, 8) : '', gear: GEARS.gearSet(p, 'memes') } : null; }
  decide() {
    if (this.phase !== 'vote') return;
    const final = this.kind === 'final';
    const count = new Map(); for (const mid of this.votes.values()) count.set(mid, (count.get(mid) || 0) + 1);
    const total = this.votes.size;
    for (const m of this.entries) { const n = count.get(m.id) || 0; if (!final) m.votes = n; m.fv = n; if (n) this.give(m, n * 100, final ? 'final' : 'vote'); if (!final && n === 1) { const st = this.stats.get(m.by); if (st) st.ones++; } }
    const top = Math.max(0, ...this.entries.map((m) => m.fv));
    const winners = top ? this.entries.filter((m) => m.fv === top) : [];
    const unan = winners.length === 1 && total >= 2 && top === total;
    for (const w of winners) {
      if (final) { this.give(w, 1000, 'motn'); w.motn = true; this.motn = w; }
      else { w.win = true; this.give(w, 250, 'win'); const st = this.stats.get(w.by); if (st) st.wins++; }
      if (unan) { w.unan = true; this.give(w, 500, 'unan'); const st = this.stats.get(w.by); if (st) st.unan++; }
    }
    const pub = (m) => ({ ...this.pub(m), by: this.who(m.by), co: this.who(m.co), votes: m.fv, win: winners.includes(m), unan: !!m.unan && winners.includes(m) });
    const all = this.entries.slice().sort((a, b) => b.fv - a.fv).map(pub);
    this.last = { winners: all.filter((a) => a.win), all: all.slice(0, 24), more: Math.max(0, all.length - 24), unan, total, final, cut: this.semiCut || 0 };
    this.semiCut = 0;
    this.phase = 'result'; this.room.fx(final ? 'motn' : 'reveal', { unan });
    this.setTimer(final ? RESULT_MS + 3000 : RESULT_MS, () => this.nextRound());
  }
  // The final showdown: each round's winner, topped up with the next best memes.
  finalists() {
    const out = [], seen = new Set();
    const add = (m) => { if (m && !seen.has(m.id) && out.length < MOTN_MAX) { seen.add(m.id); out.push(m); } };
    for (let r = 1; r < this.round; r++) add(this.all.filter((m) => m.round === r && m.win).sort((a, b) => b.votes - a.votes)[0]);
    for (const m of this.all.slice().sort((a, b) => b.votes - a.votes || b.semi - a.semi)) if (out.length < 3 && m.votes + m.semi > 0) add(m);
    return this.shuffle(out);
  }
  finish() {
    this.room.cancel(this.timer); this.timer = null;
    this.phase = 'over'; this.endsAt = 0; this.awards = this.makeAwards(); this.room.fx('win');
  }
  makeAwards() {
    const here = [...this.stats].filter(([id]) => this.room.get(id));
    const best = (val, min = 1) => { let top = null; for (const [id, st] of here) { const v = val(st); if (v == null || v < min) continue; if (!top || v > top.v) top = { id, v }; } return top; };
    const out = [];
    const push = (key, icon, title, blurb, t, text, meme) => { if (t) out.push({ key, icon, title, blurb, ...this.who(t.id), id: t.id, value: text(t.v), meme: meme ? this.pub(meme) : null }); };
    push('viral', '🚀', 'Viral', 'Most votes all night', best((s) => s.votes), (v) => `${v} vote${v === 1 ? '' : 's'}`);
    const fried = this.all.filter((m) => this.room.get(m.by)).sort((a, b) => b.chars - a.chars)[0];
    if (fried && fried.chars >= 12) push('fried', '🍟', 'Deep-Fried', 'Crammed the most words into one meme', { id: fried.by, v: fried.chars }, (v) => `${v} characters`, fried);
    push('unan', '🤝', 'Unanimous', 'Won a round with every single vote', best((s) => s.unan), (v) => `${v} clean sweep${v === 1 ? '' : 's'}`);
    push('remix', '🔁', 'Remix Royalty', 'Best at finishing (or starting) a remix', best((s) => s.remix), (v) => `${v} remix vote${v === 1 ? '' : 's'}`);
    push('speed', '⚡', 'Speed Poster', 'Fastest to post', best((s) => (s.posts >= 2 ? -s.postMs / s.posts : null), -Infinity), (v) => `${(-v / 1000).toFixed(0)}s average`);
    push('niche', '🧐', 'Niche Humor', 'Memes exactly one person got', best((s) => s.ones), (v) => `${v} single-vote meme${v === 1 ? '' : 's'}`);
    return out;
  }
  next() {
    this.room.cancel(this.timer);
    if (this.phase === 'intro') return this.kind === 'final' ? this.startParade() : this.openWrite();
    if (this.phase === 'write') return this.closeWrite();
    if (this.phase === 'pass') return this.openWrite();
    if (this.phase === 'semi') return this.closeSemi();
    if (this.phase === 'parade') return this.openVote();
    if (this.phase === 'vote') return this.decide();
    if (this.phase === 'result') return this.nextRound();
  }

  // ---------- phone moves ----------
  capsFrom(c, list) {
    if (!Array.isArray(list)) return null;
    const out = c.caps.slice();
    for (let i = c.from; i < c.upto; i++) out[i] = typeof list[i] === 'string' ? clean(list[i]) : '';
    return out;
  }
  act(p, m) {
    this.seat(p);
    m = m && typeof m === 'object' ? m : {};
    if (m.op === 'draft' || m.op === 'post') {
      if (this.phase !== 'write') return { ok: false, error: 'Captions are closed right now.' };
      const c = this.cards.get(p.id); if (!c) return { ok: false, error: 'You join in next round!' };
      if (c.done) return m.op === 'draft' ? { ok: true, quiet: true } : { ok: false, error: 'Already posted!' };
      if (m.tpl != null && m.tpl !== c.tpl) return { ok: false, error: 'That template changed. Check your screen.' };
      const caps = this.capsFrom(c, m.caps); if (!caps) return { ok: false, error: 'Write a caption first.' };
      c.caps = caps;
      if (m.op === 'draft') return { ok: true, quiet: true };
      if (!caps.slice(c.from, c.upto).some((x) => x)) return { ok: false, error: 'Write at least one caption!' };
      c.done = true; c.doneAt = this.room.now() - this.writeAt;
      this.room.fx('post', { id: p.id });
      this.maybeAllIn();
      return { ok: true };
    }
    if (m.op === 'shuffle') {
      if (this.phase !== 'write') return { ok: false, error: 'Not now.' };
      const c = this.cards.get(p.id); if (!c) return { ok: false, error: 'You join in next round!' };
      if (!KINDS[this.kind].shuffle || this.step !== 1) return { ok: false, error: 'No shuffling this round!' };
      if (c.shuffled) return { ok: false, error: 'One shuffle per round.' };
      if (c.done) return { ok: false, error: 'Already posted!' };
      const tpl = this.freshTpl(p.id, c.tpl);
      Object.assign(c, { tpl, caps: TPL.get(tpl).slots.map(() => ''), shuffled: true, ideas: this.ideas(), upto: TPL.get(tpl).slots.length });
      return { ok: true };
    }
    if (m.op === 'vote') {
      const id = typeof m.id === 'string' ? m.id.slice(0, 20) : '';
      if (this.phase === 'semi') {
        const b = this.ballots.get(p.id); if (!b) return { ok: false, error: 'No ballot for you this time.' };
        if (!b.includes(id)) return { ok: false, error: 'Pick a meme on your ballot.' };
        this.semiVotes.set(p.id, id); this.maybeAllVoted(); return { ok: true };
      }
      if (this.phase !== 'vote') return { ok: false, error: 'Voting is closed.' };
      const meme = this.entries.find((x) => x.id === id); if (!meme) return { ok: false, error: 'Pick a meme.' };
      if (!this.canVote(p.id, meme)) return { ok: false, error: 'You can’t vote for your own meme!' };
      this.votes.set(p.id, id); this.room.fx('ballot'); this.maybeAllVoted(); return { ok: true };
    }
    return { ok: false, error: 'Unknown move.' };
  }
  botWrite(p) {
    if (this.phase !== 'write' || !this.room.get(p.id)) return;
    const c = this.cards.get(p.id); if (!c || c.done) return;
    if (KINDS[this.kind].shuffle && this.step === 1 && this.room.rng() < 0.15) this.act(p, { op: 'shuffle' });
    const cc = this.cards.get(p.id), caps = cc.caps.slice();
    for (let i = cc.from; i < cc.upto; i++) caps[i] = this.room.rng() < 0.12 && i > cc.from ? '' : this.pick(BOT_LINES);
    this.act(p, { op: 'post', caps });
  }

  // ---------- state ----------
  pub(m) { return { id: m.id, tpl: m.tpl, caps: m.caps, head: m.head || '' }; }
  standings() {
    return [...this.scores].filter(([id]) => this.room.get(id))
      .map(([id, pts]) => ({ id, ...this.who(id), points: pts, votes: (this.stats.get(id) || {}).votes || 0 }))
      .sort((a, b) => b.points - a.points || b.votes - a.votes);
  }
  results() { return this.phase === 'over' ? this.standings().map((r) => r.id) : []; }
  gallery() {
    const pick = [], seen = new Set();
    const add = (m) => { if (m && !seen.has(m.id) && pick.length < 12) { seen.add(m.id); pick.push(m); } };
    add(this.motn); for (const m of this.all) if (m.win) add(m);
    for (const m of this.all.slice().sort((a, b) => b.votes - a.votes || b.semi - a.semi)) add(m);
    return pick.map((m) => ({ ...this.pub(m), by: this.who(m.by), co: this.who(m.co), votes: m.votes, win: m.win, motn: !!m.motn, unan: m.unan, round: m.round, kind: m.kind }));
  }
  common() {
    const K = KINDS[this.kind] || KINDS.free;
    return { phase: this.phase, round: this.round, rounds: this.plan.length, kind: this.kind, kindName: K.name, blurb: K.blurb, step: this.step, endsIn: this.endsIn(), hurry: this.hurried && this.phase === 'write', prompt: this.prompt, sameTpl: this.sameTpl, final: this.kind === 'final' };
  }
  tv() {
    const ph = this.phase, w = ph === 'write' ? this.writers() : [];
    const box = ph === 'semi' ? this.semiVotes : this.votes, v = ph === 'vote' || ph === 'semi' ? this.voters() : [];
    return {
      ...this.common(),
      table: w.slice(0, 40).map((p) => ({ ...this.who(p.id), done: this.cards.get(p.id).done })), tableMore: Math.max(0, w.length - 40),
      posted: w.filter((p) => this.cards.get(p.id).done).length, writers: w.length,
      wall: ph === 'semi' ? this.entries.slice(0, 40).map((m) => this.pub(m)) : null, total: this.entries.length,
      memes: ph === 'parade' ? this.entries.slice(0, this.idx).map((m) => this.pub(m)) : ph === 'vote' || (ph === 'intro' && this.kind === 'final') ? this.entries.map((m) => this.pub(m)) : [],
      voted: box.size, voters: v.length, notVoted: v.filter((p) => !box.has(p.id)).slice(0, 20).map((p) => this.room.name(p.id)),
      last: ph === 'result' ? this.last : null, standings: this.standings().slice(0, 12),
      awards: ph === 'over' ? this.awards : null, gallery: ph === 'over' ? this.gallery() : null,
      motn: ph === 'over' && this.motn ? { ...this.pub(this.motn), by: this.who(this.motn.by), co: this.who(this.motn.co) } : null,
    };
  }
  view(p) {
    const ph = this.phase, c = this.cards.get(p.id), st = this.standings(), w = ph === 'write' ? this.writers() : [];
    let ballot = [];
    if (ph === 'semi') ballot = (this.ballots.get(p.id) || []).map((id) => this.entries.find((m) => m.id === id)).filter(Boolean).map((m) => this.pub(m));
    else if (ph === 'vote') ballot = this.entries.map((m) => ({ ...this.pub(m), mine: !this.canVote(p.id, m) }));
    const mineR = ph === 'result' && this.last && this.last.all ? this.last.all.filter((a) => (a.by && a.by.name === this.room.name(p.id)) || (a.co && a.co.name === this.room.name(p.id))) : [];
    const myAll = this.all.filter((m) => m.by === p.id);
    return {
      ...this.common(), me: p.id,
      card: ph === 'write' && c ? { tpl: c.tpl, caps: c.caps, done: c.done, from: c.from, upto: c.upto, canShuffle: KINDS[this.kind].shuffle && this.step === 1 && !c.shuffled && !c.done, ideas: c.ideas, remix: !!c.start, starter: c.start && c.start.by ? this.room.name(c.start.by) : c.start ? 'The house' : null } : null,
      slots: c ? TPL.get(c.tpl).slots : null, tplName: c ? TPL.get(c.tpl).name : null,
      progress: { done: w.filter((x) => this.cards.get(x.id).done).length, of: w.length },
      ballot, myVote: ph === 'semi' ? this.semiVotes.get(p.id) || null : this.votes.get(p.id) || null, voted: ph === 'semi' ? this.semiVotes.size : this.votes.size,
      inFinal: ph === 'parade' || ph === 'vote' || ph === 'intro' ? this.entries.some((m) => m.by === p.id) : false,
      last: ph === 'result' ? { none: !!(this.last && this.last.none), winners: this.last && this.last.winners ? this.last.winners : [], unan: !!(this.last && this.last.unan), final: !!(this.last && this.last.final) } : null,
      myResult: mineR.length ? { votes: mineR.reduce((n, a) => n + a.votes, 0), win: mineR.some((a) => a.win), unan: mineR.some((a) => a.unan) } : null,
      points: this.scores.get(p.id) || 0, rank: st.findIndex((x) => x.id === p.id) + 1, of: st.length,
      final10: ph === 'over' ? st.slice(0, 10) : null,
      awards: ph === 'over' ? (this.awards || []).filter((a) => a.id === p.id).map((a) => ({ icon: a.icon, title: a.title, value: a.value })) : null,
      myBest: ph === 'over' && myAll.length ? this.pub(myAll.slice().sort((a, b) => b.votes - a.votes || (b.motn ? 1 : 0) - (a.motn ? 1 : 0))[0]) : null,
      stats: ph === 'over' ? { votes: (this.stats.get(p.id) || {}).votes || 0, wins: (this.stats.get(p.id) || {}).wins || 0, memes: myAll.length } : null,
    };
  }
}
// Remix: the starter writes the first half of the slots (at least one), the finisher the rest.
function half(tpl) { const n = TPL.get(tpl).slots.length; return Math.max(1, Math.floor(n / 2)); }

// Party Mode: settings that fit the players in the room and this game's minutes in the plan (box/party-fit.js).
const PF = require('../party-fit');
const partyFit = ({ players: P, minutes: M }) => {
  const s = PF.best({ rounds: [3, 2, 4, 5], seconds: [90, 60, 120] }, (x) => 0.5 + x.rounds * (x.seconds / 60 * 0.85 + 1.5 + 0.06 * Math.min(P, 20)), M);
  return { rounds: s.rounds, seconds: s.seconds };
};

module.exports = {
  partyFit,
  key: 'memes', name: 'Meme Maker', min: 3, best: [3, 12], fields, defaults,
  show: { facts: false }, // intro cutscene before the game (public/box/intros/memes.js)
  locked: { how: 'Finish a game of JustBlanks to unlock it.' }, // public/unlocks.js + UNLOCK_RULES in box/room.js
  create: (room, settings) => new Memes(room, settings),
  TEMPLATES, SITUATIONS, PARTY_SITUATIONS, THEMES, filterText, clean, // for tests
};
