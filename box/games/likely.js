'use strict';
// Most Likely To…: a fast party vote. A prompt goes up on the TV ("Who’s most likely to…
// survive a zombie apocalypse?"); everyone votes for a player on their phone, then predicts
// who the room will pick. The winner earns the TITLE (fame, not points). Points: +100 if your
// vote matched the room, +150 for a correct prediction. Every 5th prompt is a HOT SEAT (one
// player, "Would they actually…?" yes/no) and some are DOUBLE TROUBLE (pick two people).
// With anonymous voting the TV only ever shows totals; tallies are never sent before the reveal.
// Most Likely To… prompt packs (all original). Each pack has:
//   classic: finishes "Who’s most likely to …?"            (title: "Most likely to …")
//   pair:    finishes "Which TWO are most likely to …?"     (title: "Most likely to … (with X)")
//   hot:     finishes "Would <name> actually …?"            (title: "Would actually …")
const PACKS = {
  classic: {
    label: 'Classic',
    classic: [
      'survive a zombie apocalypse', 'become famous for something ridiculous', 'cry at a commercial', 'forget their own birthday',
      'accidentally start a cult and end up running it', 'win a game show', 'get lost in their own neighborhood', 'adopt ten cats',
      'talk their way out of a speeding ticket', 'eat something off the floor', 'become a millionaire', 'lose their phone while holding it',
      'laugh at the worst possible moment', 'befriend a celebrity', 'start a business from their garage', 'binge an entire series in one night',
      'sleep through an earthquake', 'trip over absolutely nothing', 'show up to the wrong party', 'run for president',
      'survive a week in the wilderness', 'text the wrong person something embarrassing', 'still be awake at 4 a.m.', 'have a secret talent nobody knows about',
      'become a viral meme', 'be late to their own wedding', 'spend all their money on snacks', 'talk to animals like they’re people',
      'win a staring contest against a cat', 'get banned from an all-you-can-eat buffet', 'know all the words to every song', 'pack three suitcases for a weekend trip',
      'accidentally start a trend', 'write a bestselling novel', 'volunteer first for anything', 'spoil the ending of a movie',
      'end up on a cooking show', 'sing loudly in the shower', 'lose at rock-paper-scissors five times in a row', 'move to a tiny island',
      'still have their very first toy', 'fall asleep at a party', 'have a 12-step skincare routine', 'overthink a one-word text',
      'become a professional wrestler', 'laugh at their own joke before the punchline', 'be mistaken for a celebrity', 'take 200 photos of the same sunset',
      'go skydiving on a whim', 'forget why they walked into a room', 'bake a cake for no reason at all', 'cheat at board games',
      'make best friends with a stranger in an elevator', 'accidentally set off a fire alarm', 'give their car a name', 'win an argument with a lamppost',
      'get a tattoo they instantly regret', 'be the last one to leave the party', 'own a pet snake', 'become a superhero’s sidekick',
      'read the manual before building furniture', 'go viral for a dance move', 'secretly be royalty', 'remember everyone’s birthday',
    ],
    pair: [
      'start a band together', 'get lost on a road trip together', 'open a restaurant together', 'get stuck in an elevator together',
      'win a three-legged race', 'pull off a movie-style heist', 'go viral with a dance duet', 'start a podcast nobody listens to',
      'become roommates and fight over dishes', 'solve a mystery together', 'get banned from the same arcade', 'survive a desert island together',
      'win a reality show as a team', 'open a very weird museum together',
    ],
    hot: [
      'eat a bug for $100', 'go a whole week without their phone', 'sing karaoke solo in front of strangers', 'go skydiving',
      'shave their head for charity', 'move to another country tomorrow', 'spend a night alone in a haunted house', 'give up coffee for a month',
      'eat the same meal every day for a month', 'go on a reality show', 'swim with sharks', 'camp alone in the woods for a weekend',
      'give a speech in a packed stadium', 'read a 1,000-page book', 'wake up at 5 a.m. every day for a year',
    ],
  },
  wild: {
    label: 'Wild',
    classic: [
      'send a risky text at 2 a.m.', 'get kicked out of a karaoke bar', 'ghost the group chat for a month', 'flirt their way to a free dessert',
      'sneak snacks into a fancy restaurant', 'start a dance-off with total strangers', 'crash a wedding and give a speech', 'fake an accent for an entire vacation',
      'dye their hair a wild color on a dare', 'get a matching tattoo with a stranger', 'accidentally like an ex’s photo from ten years ago', 'order a pizza to a park bench',
      'lie about their age to get a discount', 'marry someone they met on vacation', 'start a food fight', 'get stuck in a revolving door',
      'go to a party in pajamas', 'fall asleep in a movie theater and snore', 'jump on stage at an open mic uninvited', 'bribe a bouncer with candy',
      'eat dessert first, every single time', 'get recognized from an embarrassing video', 'sing the wrong lyrics with total confidence', 'cancel plans by inventing a sick pet',
      'join a flash mob', 'take a selfie with a police horse', 'ride a mechanical bull and lose badly', 'get roasted at their own birthday',
      'start a rumor and forget it was them', 'have a secret alter ego', 'reply-all to the entire company by accident', 'stage-dive at a concert',
      'own way too many sunglasses', 'challenge a stranger to arm wrestling', 'get a speeding ticket on a scooter', 'sneak into the VIP section',
      'serenade someone in public', 'adopt a dramatic stage name', 'spend a whole paycheck in one weekend', 'throw a party just to show off a new couch',
      'slide into a celebrity’s DMs', 'cry at their own karaoke performance', 'win a hot-sauce challenge and instantly regret it', 'get lost on the way home from a party',
      'bring a pet to a party uninvited', 'go on a reality dating show', 'send a voice memo longer than five minutes', 'take a nap during their own party',
      'pretend to know a song they’ve never heard', 'jump into a pool fully clothed', 'rent a limo to go to the grocery store', 'secretly be an amazing salsa dancer',
      'go on a road trip with zero plan', 'volunteer for a magic trick and ruin it', 'laugh during a very serious moment', 'get backstage by pretending to be staff',
      'hide in the bathroom at a party', 'eat a whole cake alone and call it a “tasting”', 'get a parking ticket on day one with a new car', 'accidentally start a mosh pit',
      'get asked to leave a museum for touching the art', 'make a dramatic exit from a party', 'live-stream something they really shouldn’t', 'win a limbo contest at a wedding',
    ],
    pair: [
      'get kicked out of a club together', 'elope in Las Vegas', 'start a karaoke rivalry', 'take a spontaneous trip to another country',
      'get matching tattoos', 'crash a wedding together', 'become a famous prank duo', 'end up in a viral fail video',
      'stay out until sunrise', 'run off to join the circus', 'start a rival group chat', 'get lost at a music festival together',
    ],
    hot: [
      'text their ex right now', 'dye their hair neon green', 'do stand-up at an open mic', 'go on a blind date picked by this room',
      'let this room post one photo on their socials', 'jump into a freezing lake', 'eat the world’s hottest pepper', 'get a tattoo of a cartoon character',
      'propose on a stadium jumbotron', 'crash a stranger’s party', 'wear a costume to work for a whole week', 'quit their job to travel the world',
      'sing on a busy street for tips', 'let a stranger cut their hair', 'show this room their screen time',
    ],
  },
  work: {
    label: 'Work-safe',
    classic: [
      'reply-all by accident', 'schedule a meeting that could have been an email', 'become CEO one day', 'bring homemade cookies to the office',
      'secretly nap under their desk', 'have 87 browser tabs open', 'forget to unmute on a call', 'win the office chili cook-off',
      'microwave fish in the break room', 'know everyone’s coffee order', 'say “let’s circle back” unironically', 'show up to a video call in pajama pants',
      'organize the office party', 'accidentally share their screen at the worst time', 'have a perfectly empty inbox', 'have 4,000 unread emails',
      'take credit for snacks someone else brought', 'fix the printer with one well-placed kick', 'post in the wrong channel', 'start a company book club',
      'stay late just to finish a spreadsheet', 'color-code their entire calendar', 'talk about their weekend for an hour on Monday', 'nail a presentation with no slides',
      'have a desk full of plants', 'be first in line for free pizza', 'turn every meeting into a brainstorm', 'bring a label maker to work',
      'quit to start a food truck', 'become the office DJ', 'win employee of the month every month', 'accidentally call the boss “Mom”',
      'lead the fire drill like a pro', 'have a secret snack drawer', 'forget their badge every single day', 'make a pun in a serious meeting',
      'build a spreadsheet for their personal life', 'type with two fingers but impossibly fast', 'decorate their desk for every holiday', 'write an email that’s way too long',
      'get caught singing in the elevator', 'have the most dramatic out-of-office message', 'adopt the office plant everyone forgot', 'start a fantasy league for something weird',
      'laugh way too loud on a call', 'know where all the good pens are hidden', 'invent a brand-new buzzword', 'survive a nine-hour meeting marathon',
      'go viral on a professional networking site', 'bring their pet to every video call', 'arrive exactly on time, every time', 'finish the crossword during a meeting',
      'run the company from a beach someday', 'give everyone on the team a nickname', 'still know how to use a fax machine', 'make the perfect slide deck',
      'send an emoji to the CEO', 'remember everyone’s kids’ names', 'get lost inside the office building', 'volunteer to take the notes',
      'carry a spare phone charger for everyone', 'negotiate a four-day work week', 'lock themselves out of the building',
    ],
    pair: [
      'co-found a startup', 'get stuck in the longest meeting ever', 'become the office power duo', 'win team-building trivia night',
      'take over the break room', 'accidentally delete the shared drive', 'plan the best office party ever', 'get caught gossiping on a hot mic',
      'start a desk-plant empire', 'run the company together one day', 'win the office bake-off', 'invent a secret team handshake',
    ],
    hot: [
      'quit on the spot after a lottery win', 'present without any slides', 'answer work emails on vacation', 'take a pay cut for a four-day week',
      'dress up for costume day', 'eat lunch at their desk every day', 'be first on the dance floor at the office party', 'show up to a 7 a.m. meeting voluntarily',
      'say yes to being boss for a day', 'move their desk right next to the printer', 'lead a karaoke night with the team', 'keep their camera on for every call',
      'take the stairs to the top floor every day', 'volunteer to run the fire drill', 'give up meetings forever',
    ],
  },
  family: {
    label: 'Family',
    classic: [
      'eat the last cookie and blame the dog', 'tell the cheesiest joke at dinner', 'win family board-game night', 'get lost at the zoo',
      'fall asleep on the couch first', 'build the best blanket fort', 'sing along to every song in the car', 'bring home a stray puppy',
      'make the messiest sandwich', 'become a famous chef', 'find the best hiding spot in hide-and-seek', 'become an astronaut',
      'talk to their stuffed animals', 'burn the toast', 'dance in the grocery store', 'win a spelling bee',
      'forget their shoes at the beach', 'make friends with a squirrel', 'eat dessert for breakfast', 'have the loudest sneeze',
      'secretly be a superhero', 'build a robot', 'laugh so hard milk comes out their nose', 'tell a ghost story that scares everyone',
      'know every dinosaur’s name', 'win a pie-eating contest', 'get the hiccups at the worst time', 'decorate the whole house for a holiday',
      'wake up first on a holiday morning', 'lose a sock every single day', 'invent a new ice-cream flavor', 'become a zookeeper',
      'make an erupting volcano for the science fair', 'spot a shooting star', 'find a four-leaf clover', 'dress their pet in a costume',
      'get their head stuck in a fence', 'tell the same story three times', 'win at charades', 'go on an adventure in the backyard',
      'become a famous video creator', 'cry at a cartoon', 'eat all their vegetables without complaining', 'build the tallest block tower',
      'win at rock-paper-scissors', 'talk in their sleep', 'draw a masterpiece for the fridge', 'run a lemonade stand that makes a fortune',
      'become an amazing magician', 'get lost in a corn maze', 'trip over the dog', 'remember everyone’s favorite color',
      'race to the car to call shotgun', 'make up a song about breakfast', 'have the biggest sticker collection', 'become a pirate',
      'do a cartwheel on the lawn', 'read under the covers with a flashlight', 'win an Olympic gold medal', 'bake cookies for the neighbors',
      'fall asleep on a car ride', 'make the funniest face', 'find buried treasure at the beach',
    ],
    pair: [
      'build the biggest sandcastle', 'get into trouble at a sleepover', 'win the egg-and-spoon race', 'start a lemonade empire',
      'go on a treasure hunt', 'build a treehouse', 'eat a whole pizza between them', 'get lost at the theme park',
      'put on a puppet show', 'bake a giant cake', 'start a secret club', 'become a superhero team',
    ],
    hot: [
      'eat broccoli ice cream', 'go a whole day without screens', 'sleep in a tent in the backyard', 'ride the scariest roller coaster',
      'hold a snake', 'jump into a leaf pile in their nicest clothes', 'eat pickles dipped in chocolate', 'perform in a talent show',
      'clean their room without being asked', 'give away their favorite toy', 'go a week without dessert', 'dance in front of the whole school',
      'pet a stingray at the aquarium', 'wear socks with sandals in public', 'try a food they’ve never heard of',
    ],
  },
};

const opt = (pairs) => pairs.map(([value, label]) => ({ value, label }));
const fields = [
  { key: 'pack', label: 'Prompt pack', options: opt([['classic', 'Classic'], ['wild', 'Wild (cheeky but clean)'], ['work', 'Work-safe'], ['family', 'Family'], ['mix', 'Mix of everything']]) },
  { key: 'rounds', label: 'Number of prompts', options: opt([[10, '10 prompts'], [15, '15 prompts'], [20, '20 prompts'], [30, '30 prompts']]) },
  { key: 'voteSeconds', label: 'Time to vote', options: opt([[15, '15 seconds'], [20, '20 seconds'], [30, '30 seconds']]) },
  { key: 'selfVote', label: 'Vote for yourself', options: opt([[false, 'Not allowed'], [true, 'Allowed']]) },
  { key: 'reveal', label: 'Votes on the TV', options: opt([['anon', 'Anonymous (totals only)'], ['public', 'Public (who voted for whom)']]) },
];
const defaults = { pack: 'classic', rounds: 15, voteSeconds: 20, selfVote: false, reveal: 'anon' };
const INTRO_MS = 3500, BONUS_INTRO_MS = 5500, DRUM_MS = 3000, REVEAL_MS = 9000, FINAL_REVEAL_MS = 10000;
const MATCH = 100, PREDICT = 150, SEAT_SELF = 100;
const TV_TOP = 6; // the TV shows the top vote-getters only
const kindOf = (n) => (n % 5 === 0 ? 'hot' : n % 5 === 3 ? 'pair' : 'classic');

class Likely {
  constructor(room, settings) {
    this.room = room; this.s = settings;
    this.phase = 'intro'; this.n = 0; this.r = null; this.endsAt = 0; this.timer = null;
    this.scores = new Map(); this.titles = new Map(); this.stats = new Map(); this.seated = new Map(); this.charm = new Map();
    this.decks = {}; this.last = null;
  }
  shuffle(a) { const r = this.room.rng; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  setTimer(ms, fn) { this.room.cancel(this.timer); this.endsAt = this.room.now() + ms; this.timer = this.room.after(ms, fn); }
  seat(p) {
    if (this.scores.has(p.id)) return;
    this.scores.set(p.id, 0); this.titles.set(p.id, []); this.stats.set(p.id, { matched: 0, foresaw: 0 }); this.seated.set(p.id, 0);
    this.charm.set(p.id, 0.4 + this.room.rng() * 2.2); // bots' hidden taste: some players just "feel" more likely
  }
  start() { for (const p of this.room.list()) this.seat(p); this.nextRound(); }
  joined(p) { this.seat(p); } // votes and can be voted for from the next prompt
  left(p) {
    const r = this.r; if (!r) return;
    r.ids = r.ids.filter((id) => id !== p.id);
    if (this.phase === 'intro' && r.seat === p.id) r.seat = r.ids.length ? this.pickSeat(r.ids) : null;
    if (this.phase === 'vote') { r.votes.delete(p.id); r.preds.delete(p.id); if (r.seat === p.id) { this.room.cancel(this.timer); this.close(); } else this.maybeAllIn(); }
  }

  draw(kind) {
    const packs = this.s.pack === 'mix' || !PACKS[this.s.pack] ? Object.keys(PACKS) : [this.s.pack];
    const k = packs.join() + ':' + kind;
    if (!this.decks[k] || !this.decks[k].length) this.decks[k] = this.shuffle(packs.flatMap((pk) => PACKS[pk][kind]));
    return this.decks[k].pop();
  }
  pickSeat(ids) {
    const fewest = Math.min(...ids.map((id) => this.seated.get(id) || 0));
    let pool = ids.filter((id) => (this.seated.get(id) || 0) === fewest);
    const humans = pool.filter((id) => !this.room.get(id).bot);
    if (humans.length && this.room.rng() < 0.75) pool = humans; // put real people on the spot more often
    const id = pool[Math.floor(this.room.rng() * pool.length)];
    this.seated.set(id, (this.seated.get(id) || 0) + 1);
    return id;
  }

  nextRound() {
    if (this.n >= this.s.rounds) return this.finish();
    this.n++;
    const ids = this.room.list().map((p) => p.id);
    const kind = kindOf(this.n);
    this.r = { n: this.n, kind, text: this.draw(kind), ids, votes: new Map(), preds: new Map(), skipped: new Set(), seat: null, result: null, gained: new Map() };
    if (kind === 'hot') this.r.seat = this.pickSeat(ids);
    this.phase = 'intro'; this.last = null;
    this.room.fx(kind === 'classic' ? 'prompt' : 'bonus', { kind });
    this.setTimer(kind === 'classic' ? INTRO_MS : BONUS_INTRO_MS, () => this.openVote());
  }
  openVote() {
    if (this.phase !== 'intro') return;
    this.phase = 'vote'; this.room.fx('open');
    this.setTimer(this.s.voteSeconds * 1000, () => this.close());
    const span = Math.max(2500, this.s.voteSeconds * 1000 * 0.65);
    for (const id of this.r.ids) { const p = this.room.get(id); if (p && p.bot) this.room.after(1200 + this.room.rng() * span, () => this.botMove(p, this.r.n)); }
  }

  // ---- who may vote, and for whom ----
  candidates(p) { return this.r.ids.filter((id) => this.room.get(id) && (this.s.selfVote || id !== p.id)); }
  voters() { return this.r.ids.filter((id) => this.room.get(id)); }
  validTarget(p, id, predicting = false) {
    if (typeof id !== 'string' || !this.room.get(id) || !this.r.ids.includes(id)) return 'Pick someone who’s playing this round.';
    if (id === p.id && !this.s.selfVote && !predicting) return 'No voting for yourself this game!';
    return null;
  }
  maybeAllIn() {
    if (this.phase !== 'vote') return;
    const all = this.voters();
    if (all.length && all.every((id) => this.r.votes.has(id) && (this.r.preds.has(id) || this.r.skipped.has(id)))) {
      this.room.fx('allin'); this.room.cancel(this.timer); this.endsAt = this.room.now() + 900; this.timer = this.room.after(900, () => this.close());
    }
  }

  act(p, m) {
    const r = this.r;
    if (!r || !this.scores.has(p.id)) return { ok: false, error: 'You’re in from the next prompt!' };
    if (m.op !== 'vote' && m.op !== 'predict' && m.op !== 'skip') return { ok: false, error: 'Unknown move.' };
    if (this.phase !== 'vote') return { ok: false, error: 'Voting isn’t open right now.' };
    if (!r.ids.includes(p.id)) return { ok: false, error: 'You’re in from the next prompt!' };
    if (m.op === 'skip') { r.skipped.add(p.id); this.maybeAllIn(); return { ok: true }; }
    if (r.kind === 'hot') {
      if (typeof m.yes !== 'boolean') return { ok: false, error: 'Tap YES or NO.' };
      (m.op === 'vote' ? r.votes : r.preds).set(p.id, m.yes);
    } else if (m.op === 'vote' && r.kind === 'pair') {
      const ids = Array.isArray(m.ids) ? m.ids : [];
      if (ids.length !== 2 || ids[0] === ids[1]) return { ok: false, error: 'Pick two different people.' };
      for (const id of ids) { const e = this.validTarget(p, id); if (e) return { ok: false, error: e }; }
      r.votes.set(p.id, ids.slice().sort());
    } else {
      const e = this.validTarget(p, m.id, m.op === 'predict'); if (e) return { ok: false, error: e };
      (m.op === 'vote' ? r.votes : r.preds).set(p.id, m.id);
    }
    this.maybeAllIn();
    return { ok: true };
  }

  // Bots: weighted random choices (each player has a hidden "charm" so the room leans somewhere).
  weighted(ids) {
    let total = 0; const w = ids.map((id) => { const x = Math.pow(this.charm.get(id) || 1, 2) * (0.6 + this.room.rng() * 0.8); total += x; return x; });
    let t = this.room.rng() * total;
    for (let i = 0; i < ids.length; i++) { t -= w[i]; if (t <= 0) return ids[i]; }
    return ids[ids.length - 1];
  }
  botMove(p, n) {
    const r = this.r;
    if (this.phase !== 'vote' || !r || r.n !== n || !this.room.get(p.id)) return;
    if (r.kind === 'hot') {
      if (r.lean == null) r.lean = 0.2 + this.room.rng() * 0.6; // how "yes" this prompt feels
      this.act(p, { op: 'vote', yes: this.room.rng() < r.lean });
      this.act(p, { op: 'predict', yes: this.room.rng() < r.lean });
      return;
    }
    const c = this.candidates(p); if (!c.length) return;
    if (r.kind === 'pair') {
      const a = this.weighted(c), rest = c.filter((id) => id !== a);
      if (!rest.length) { this.act(p, { op: 'skip' }); return; }
      this.act(p, { op: 'vote', ids: [a, this.weighted(rest)] });
    } else this.act(p, { op: 'vote', id: this.weighted(c) });
    if (this.room.rng() < 0.9) this.act(p, { op: 'predict', id: this.weighted(this.r.ids.filter((id) => this.room.get(id))) }); else this.act(p, { op: 'skip' });
  }

  add(id, pts, stat) {
    if (!this.scores.has(id)) return;
    this.scores.set(id, this.scores.get(id) + pts);
    this.r.gained.set(id, (this.r.gained.get(id) || 0) + pts);
    if (stat) this.stats.get(id)[stat]++;
  }
  giveTitle(id, text) { const t = this.titles.get(id); if (t) t.push(text); }

  close() {
    if (this.phase !== 'vote') return;
    const r = this.r, here = (id) => !!this.room.get(id);
    for (const [id] of r.votes) if (!here(id)) r.votes.delete(id);
    if (r.kind === 'hot') this.scoreHot(); else this.scoreVotes();
    this.phase = 'drum'; this.room.fx('drum');
    this.setTimer(DRUM_MS, () => this.reveal());
  }
  scoreVotes() {
    const r = this.r, count = new Map(), voters = new Map();
    for (const [vid, pick] of r.votes) for (const id of (Array.isArray(pick) ? pick : [pick])) {
      if (!this.room.get(id)) continue;
      count.set(id, (count.get(id) || 0) + 1);
      if (!voters.has(id)) voters.set(id, []); voters.get(id).push(vid);
    }
    const ranked = [...count].sort((a, b) => b[1] - a[1] || r.ids.indexOf(a[0]) - r.ids.indexOf(b[0]));
    let winners = [];
    if (ranked.length) {
      // classic: everyone tied for 1st shares the title. pair: the top two (plus anyone tied with 2nd).
      const cut = r.kind === 'pair' ? (ranked[1] || ranked[0])[1] : ranked[0][1];
      winners = ranked.filter(([, c]) => c >= cut).map(([id]) => id);
    }
    const win = new Set(winners);
    for (const [vid, pick] of r.votes) {
      if (Array.isArray(pick)) { const hits = pick.filter((id) => win.has(id)).length; if (hits) this.add(vid, hits * (MATCH / 2), hits === 2 ? 'matched' : null); }
      else if (win.has(pick)) this.add(vid, MATCH, 'matched');
    }
    for (const [vid, pick] of r.preds) if (win.has(pick)) this.add(vid, PREDICT, 'foresaw');
    const title = `Most likely to ${r.text}`;
    for (const id of winners) {
      const partners = winners.filter((x) => x !== id).map((x) => this.room.name(x));
      this.giveTitle(id, r.kind === 'pair' && partners.length ? `${title} (with ${partners.join(' & ')})` : title);
    }
    r.result = { kind: r.kind, winners, ranked, voters, total: r.votes.size, title };
  }
  scoreHot() {
    const r = this.r; let yes = 0, no = 0, seatSaid = null;
    for (const [vid, v] of r.votes) { if (vid === r.seat) { seatSaid = v; continue; } if (v) yes++; else no++; }
    const verdict = yes === no ? null : yes > no; // null = split room
    for (const [vid, v] of r.votes) {
      if (vid === r.seat) { if (verdict !== null && v === verdict) this.add(vid, SEAT_SELF, 'matched'); }
      else if (verdict !== null && v === verdict) this.add(vid, MATCH, 'matched');
    }
    for (const [vid, v] of r.preds) {
      if (vid === r.seat) { if (verdict !== null && v === verdict) this.add(vid, PREDICT, 'foresaw'); }
      else if (seatSaid !== null && v === seatSaid) this.add(vid, PREDICT, 'foresaw');
    }
    const title = `Would actually ${r.text}`;
    if (verdict === true && this.room.get(r.seat)) this.giveTitle(r.seat, title);
    r.result = { kind: 'hot', yes, no, verdict, seatSaid, title, winners: verdict === true ? [r.seat] : [], total: yes + no };
  }
  reveal() {
    if (this.phase !== 'drum') return;
    this.phase = 'reveal';
    const res = this.r.result;
    this.room.fx(res.kind === 'hot' ? (res.verdict === null ? 'split' : res.verdict ? 'yes' : 'no') : res.winners.length ? 'reveal' : 'none');
    const n = this.r.n;
    if (res.winners.length) this.room.after(res.kind === 'hot' ? 2000 : 2300, () => { if (this.r && this.r.n === n && this.phase === 'reveal') this.room.fx('crown'); });
    this.setTimer(this.n >= this.s.rounds ? FINAL_REVEAL_MS : REVEAL_MS, () => this.nextRound());
  }
  finish() { this.phase = 'over'; this.endsAt = 0; this.room.cancel(this.timer); this.timer = null; this.room.fx('win'); }
  next() {
    this.room.cancel(this.timer);
    if (this.phase === 'intro') this.openVote();
    else if (this.phase === 'vote') this.close();
    else if (this.phase === 'drum') this.reveal();
    else if (this.phase === 'reveal') this.nextRound();
  }

  // ---- public / private state ----
  pub(id) { const p = this.room.get(id); return p ? { id, name: p.name, color: p.color } : { id, name: '—', color: '#888' }; }
  standings() { return [...this.scores].filter(([id]) => this.room.get(id)).map(([id, pts]) => ({ id, name: this.room.name(id), color: this.room.get(id).color, points: pts, titles: this.titles.get(id).length })).sort((a, b) => b.points - a.points || b.titles - a.titles); }
  publicResult() {
    const r = this.r, res = r && r.result;
    if (!res || (this.phase !== 'reveal' && this.phase !== 'over')) return null;
    const anon = this.s.reveal !== 'public';
    if (res.kind === 'hot') {
      const out = { kind: 'hot', yes: res.yes, no: res.no, verdict: res.verdict, seatSaid: res.seatSaid, title: res.title, total: res.total };
      if (!anon) { out.yesBy = []; out.noBy = []; for (const [vid, v] of r.votes) if (vid !== r.seat) (v ? out.yesBy : out.noBy).push(this.room.name(vid)); }
      return out;
    }
    return {
      kind: res.kind, total: res.total, title: res.title, more: Math.max(0, res.ranked.length - TV_TOP),
      winners: res.winners.filter((id) => this.room.get(id)).map((id) => this.pub(id)),
      top: res.ranked.slice(0, Math.max(TV_TOP, res.winners.length)).map(([id, votes]) => ({ ...this.pub(id), votes, win: res.winners.includes(id), voters: anon ? undefined : (res.voters.get(id) || []).map((v) => this.room.name(v)) })),
    };
  }
  finalState() {
    if (this.phase !== 'over') return null;
    const st = this.standings();
    const hall = st.map((x) => ({ name: x.name, color: x.color, titles: this.titles.get(x.id) })).sort((a, b) => b.titles.length - a.titles.length);
    const best = (fn) => { let top = 0, who = []; for (const x of st) { const v = fn(x.id); if (v > top) { top = v; who = [x.name]; } else if (v === top && v > 0) who.push(x.name); } return top ? { names: who.slice(0, 4), value: top } : null; };
    const awards = {
      reader: best((id) => this.stats.get(id).matched),
      teller: best((id) => this.stats.get(id).foresaw),
      main: best((id) => this.titles.get(id).length),
      mystery: (() => { const z = st.filter((x) => !this.titles.get(x.id).length).map((x) => x.name); return z.length ? { names: z.slice(0, 6), more: Math.max(0, z.length - 6) } : null; })(),
    };
    return { hall: hall.slice(0, 24), hallMore: Math.max(0, hall.length - 24), awards, standings: st.slice(0, 12).map(({ id, ...x }) => x) };
  }
  common() {
    const r = this.r;
    return {
      phase: this.phase, endsIn: this.endsAt ? Math.max(0, this.endsAt - this.room.now()) : 0,
      n: this.n, total: this.s.rounds, kind: r ? r.kind : null, text: r ? r.text : '', seat: r && r.seat ? this.pub(r.seat) : null,
      anon: this.s.reveal !== 'public', selfVote: !!this.s.selfVote,
    };
  }
  tv() {
    const r = this.r, voting = this.phase === 'vote' && r;
    const voters = r ? this.voters() : [];
    return {
      ...this.common(),
      voted: r ? r.votes.size : 0, predicted: r ? r.preds.size : 0, of: voters.length,
      // who is still voting (names only, never what they picked); only for smaller rooms
      waiting: voting && voters.length <= 24 ? voters.filter((id) => !r.votes.has(id)).map((id) => this.room.name(id)) : null,
      result: this.publicResult(), final: this.finalState(),
      standings: this.standings().slice(0, 8).map(({ id, ...x }) => x),
    };
  }
  view(p) {
    const r = this.r, st = this.standings(), inRound = !!(r && r.ids.includes(p.id));
    const res = this.publicResult();
    let mine = null;
    if (res && r) {
      const g = r.gained.get(p.id) || 0;
      mine = { gained: g, won: (r.result.winners || []).includes(p.id), vote: r.votes.has(p.id) ? r.votes.get(p.id) : null, pred: r.preds.has(p.id) ? r.preds.get(p.id) : null };
      if (r.kind !== 'hot') { const win = new Set(r.result.winners); mine.matched = mine.vote != null && [].concat(mine.vote).some((id) => win.has(id)); mine.foresaw = mine.pred != null && win.has(mine.pred); }
      else { const v = r.result.verdict; mine.matched = mine.vote != null && v !== null && mine.vote === v; mine.foresaw = mine.pred != null && (p.id === r.seat ? v !== null && mine.pred === v : r.result.seatSaid !== null && mine.pred === r.result.seatSaid); }
    }
    return {
      ...this.common(), me: p.id, inRound, isSeat: !!(r && r.seat === p.id),
      choices: this.phase === 'vote' && inRound && r.kind !== 'hot' ? r.ids.filter((id) => this.room.get(id)).map((id) => this.pub(id)) : null,
      myVote: r && r.votes.has(p.id) ? r.votes.get(p.id) : null, myPred: r && r.preds.has(p.id) ? r.preds.get(p.id) : null, skipped: !!(r && r.skipped.has(p.id)),
      result: res ? { kind: res.kind, winners: res.winners, title: res.title, verdict: res.verdict, seatSaid: res.seatSaid, yes: res.yes, no: res.no, top: res.top ? res.top.slice(0, 3).map(({ voters, ...x }) => x) : null } : null, mine,
      points: this.scores.get(p.id) || 0, rank: st.findIndex((x) => x.id === p.id) + 1, of: st.length, myTitles: this.titles.get(p.id) || [],
      final: this.phase === 'over' ? { standings: st.slice(0, 10).map(({ id, ...x }) => x), awards: this.finalState().awards } : null,
    };
  }
}

module.exports = {
  key: 'likely', name: 'Most Likely To…', min: 3, fields, defaults,
  create: (room, settings) => new Likely(room, settings),
  _test: { PACKS, kindOf, MATCH, PREDICT },
};
