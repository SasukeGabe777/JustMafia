'use strict';
// Who Said It?: a get-to-know-you guessing game. A question goes up on the TV; everyone types
// an anonymous answer on their phone. Then answers are spotlighted one at a time and everyone
// else guesses who wrote it (from up to 4 names). Guess right: +100 (+50 if you were among the
// fastest third of correct guessers). Authors earn +50 for everyone they fool. Once per game a
// guesser can Double Down (double points, or -50 if wrong). Three right in a row: a fire bonus.
// All questions are original.
const FAMILY_SAFE = ['family', 'holiday', 'classics', 'travel']; // every question in these packs is fine for all ages
const opt = (pairs) => pairs.map(([value, label]) => ({ value, label }));
const fields = [
  { key: 'pack', label: 'Question pack', options: opt([['classic', 'Classic'], ['family', 'Family (all ages)'], ['work', 'Coworkers (safe for work)'], ['silly', 'Silly'], ['deep', 'Deep'], ['spicy', 'Spicy (but clean)'], ['holiday', '🎄 Holiday (winter, spooky, summer)'], ['classics', '🎬 Classics (no pop culture)'], ['travel', '🌍 Travel & world'], ['mix', 'Mix of everything']]) },
  { key: 'rounds', label: 'Rounds', options: opt([[3, '3 rounds'], [4, '4 rounds'], [6, '6 rounds']]) },
  { key: 'answerSeconds', label: 'Time to answer', options: opt([[45, '45 seconds'], [60, '60 seconds'], [90, '90 seconds']]) },
  { key: 'spotSeconds', label: 'Time to guess', options: opt([[15, '15 seconds'], [20, '20 seconds'], [30, '30 seconds']]) },
  { key: 'spots', label: 'Spotlights per round', options: opt([[4, '4 answers'], [6, '6 answers'], [10, '10 answers']]) },
  { key: 'custom', label: 'Host writes the last question', options: opt([['off', 'Off'], ['on', 'On']]) },
];
const defaults = { pack: 'classic', rounds: 4, answerSeconds: 60, spotSeconds: 20, spots: 6, custom: 'off' };
const REVEAL_SECONDS = 8, CUSTOM_SECONDS = 40, ANSWER_MAX = 80, QUESTION_MAX = 120;
const PTS = { right: 100, speed: 50, fooled: 50, ddWrong: -50, streak: 50 };
const clean = (s, max) => String(s || '').replace(/[\u0000-\u001f\u007f-\u009f\u200b\u200c\u200e\u200f\u202a-\u202e\u2066-\u2069<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);

const PACKS = {
  classic: [
    'What’s the worst job you’ve ever had?', 'What would you do with a free day and $500?', 'What’s a food you refuse to eat?',
    'Who was your first celebrity crush?', 'What’s the best gift you’ve ever received?', 'What’s your go-to karaoke song?',
    'What did you want to be when you grew up?', 'What’s the last thing you bought online?', 'What’s your most-used emoji?',
    'What’s a skill you wish you had?', 'Where would you teleport to right now?', 'What’s your comfort movie?',
    'What’s your dream car?', 'What’s the first thing you do in the morning?', 'What’s a hobby you picked up and then quit?',
    'What’s the best meal you’ve ever had?', 'What’s your favorite holiday, and why?', 'What’s a show you could rewatch forever?',
    'What’s the weirdest thing in your fridge right now?', 'What’s your hidden talent?', 'What was your favorite toy as a kid?',
    'What song has been stuck in your head lately?', 'What’s your perfect pizza order?', 'Who’s the most famous person you’ve met?',
    'What would your dream house have that normal houses don’t?', 'What’s your favorite smell?', 'What’s the best live show you’ve ever been to?',
    'What’s your coffee or tea order?', 'What’s your favorite board or card game?', 'What superpower would you pick?',
    'What subject were you best at in school?', 'What’s the most useless thing you own?', 'What’s your favorite way to spend a rainy day?',
    'What place would you go back to tomorrow?', 'What’s your usual fast food order?', 'What’s your favorite season, and why?',
    'What did you do last weekend?', 'What word or phrase do you say way too much?', 'What’s the best advice you’ve ever gotten?',
    'What’s your favorite animal, and why?', 'What was the first video game you got hooked on?', 'What’s your go-to snack at the movies?',
  ],
  spicy: [
    'What’s the pettiest thing you’ve ever done?', 'What’s your most embarrassing moment in public?', 'What’s a lie you told that got way out of hand?',
    'What’s the worst date you’ve been on (or heard about)?', 'What’s a trend you secretly loved?', 'What’s the most trouble you got into as a kid?',
    'What’s a hill you will die on?', 'What’s your most unpopular opinion?', 'What’s the cringiest thing you did to impress someone?',
    'What habit of yours annoys other people?', 'What’s the weirdest thing you’ve searched online lately?', 'What’s the worst haircut you’ve ever had?',
    'What’s something you pretend to like?', 'What’s the most money you’ve wasted on one thing?', 'What’s your worst cooking disaster?',
    'What’s a rule you always break?', 'What’s the dumbest way you’ve ever hurt yourself?', 'What’s the boldest thing you’ve said to a teacher or boss?',
    'What’s the most dramatic exit you’ve ever made?', 'What would your search history say about you this week?', 'What’s a talent you’d never put on a résumé?',
    'What’s the biggest exaggeration you’ve ever posted?', 'What’s the worst text you sent to the wrong person?', 'What guilty-pleasure song do you know every word to?',
    'What’s the worst gift you’ve ever given?', 'What’s the silliest thing you’ve cried about?', 'What’s your most irrational fear?',
    'What’s the strangest thing you do when nobody is watching?', 'What would you do if you were invisible for a day?', 'What’s the worst excuse you’ve used to cancel plans?',
    'What show would you be embarrassed to admit you binged?', 'What’s the most awkward thing that happened at a family dinner?', 'When did you get caught red-handed?',
    'What’s the most ridiculous argument you’ve ever had?', 'What’s the cheesiest pickup line you’ve used or heard?', 'What’s the weirdest thing you’ve eaten on a dare?',
    'What’s your worst habit when you’re home alone?', 'What did you do as a teenager that you hope everyone forgot?', 'What’s the sneakiest way you’ve ever skipped a line?',
    'Which celebrity would make you completely starstruck?', 'What’s the most childish thing you still do?', 'What’s a secret you kept from your parents for years?',
  ],
  deep: [
    'What moment changed the way you see the world?', 'What are you proud of that nobody knows about?', 'What’s a fear you’ve overcome?',
    'What do you want to be remembered for?', 'What’s the best decision you’ve ever made?', 'What would you tell your 12-year-old self?',
    'Who has influenced you the most?', 'What small thing makes your day better?', 'What’s a dream you haven’t given up on?',
    'When do you feel most like yourself?', 'What’s a lesson you learned the hard way?', 'What’s the kindest thing a stranger has done for you?',
    'What’s something you’ve changed your mind about?', 'What does your perfect day look like?', 'What’s a tradition you want to keep forever?',
    'What book, song or movie changed you?', 'What are you most grateful for right now?', 'What do you wish more people knew about you?',
    'What’s a risk you’re glad you took?', 'What’s a goal for your next five years?', 'What would you do if you knew you couldn’t fail?',
    'What’s a compliment you still remember?', 'What’s the hardest thing you’ve ever done?', 'What does home mean to you?',
    'What always makes you laugh, no matter what?', 'What would you do with your life if money didn’t matter?', 'What memory would you relive if you could?',
    'What quality do you admire most in your friends?', 'What’s a belief you hold that most people don’t?', 'What’s one thing you’d change about the world?',
    'What’s the bravest thing you’ve ever done?', 'What do you do when you need to recharge?', 'What’s a skill someone taught you that you still use?',
    'What would the title of your autobiography be?', 'Which year of your life would you revisit?', 'What makes you feel truly at peace?',
    'What mistake turned out to be a blessing?', 'What are you still learning about yourself?', 'Who do you wish you could thank, and for what?',
    'What’s a promise you’ve made to yourself?', 'What’s the best thing about getting older?', 'What would your younger self be most surprised by today?',
  ],
  silly: [
    'If you were a vegetable, which one would you be?', 'What would your wrestler name be?', 'What will you name your future goldfish?',
    'You can only eat one food forever. What is it?', 'What would you do if you woke up as a cat?', 'What’s the worst possible ice cream flavor?',
    'What’s the theme song of your life?', 'What would you name your pirate ship?', 'What’s your evil villain plan?',
    'What’s the worst superpower you can think of?', 'What would you bring to a deserted island?', 'If animals could talk, which would be the rudest?',
    'What would you yell if you won the lottery?', 'What weird thing would you sell in your own shop?', 'What’s your zombie apocalypse weapon?',
    'What would you haunt as a ghost?', 'What’s the dumbest invention you’d actually buy?', 'What would you name a newly discovered dinosaur?',
    'What would you do with a pet dragon on a Tuesday?', 'What new Olympic sport should exist?', 'You’re a sandwich. What’s in you?',
    'What’s the worst name for a hair salon?', 'If you were a kitchen appliance, which one would you be?', 'What would you call your robot butler?',
    'What’s the first thing you’d do on the Moon?', 'What’s the most useless thing to bring to a picnic?', 'What would be your catchphrase on a reality show?',
    'A goose is blocking your front door. What’s your plan?', 'What’s the worst thing to say on your first day at work?', 'What would your fortune cookie say?',
    'If you were a candle, what would you smell like?', 'What would you name your spaceship?', 'What’s the strangest thing you’d put on a pizza?',
    'What would your job be in a medieval village?', 'What’s a terrible slogan for toothpaste?', 'What’s the worst thing to hear from a pilot?',
    'What would your cereal mascot be?', 'If you had a tail, what would you do with it?', 'What secret would your pet tell about you?',
    'What’s the worst thing to find in your pocket?', 'What would your circus act be?', 'Invent a new holiday. What do people do on it?',
  ],
  family: [
    'What’s your favorite thing to do on a snow day?', 'If you could have any pet, real or made up, what would it be?', 'What’s the best birthday you’ve ever had?',
    'What’s your favorite family tradition?', 'What would you cook if you ran a restaurant for one day?', 'Which cartoon character are you most like?',
    'What’s the funniest thing a family member has ever said?', 'If you could shrink to the size of an ant, where would you explore?', 'What’s your favorite thing to build?',
    'What would you name a new crayon color?', 'What’s the best ride at any fair or theme park?', 'What would you do if you were the boss of the house for a day?',
    'What’s a game you could play for hours?', 'What’s the yummiest thing you’ve ever eaten at someone else’s house?', 'If our family were a band, what would we be called?',
    'What’s your favorite animal sound to imitate?', 'What would you put in a time capsule?', 'What’s the best present you’ve ever given someone?',
    'Which room in a castle would be yours?', 'What would you do with a magic paintbrush?', 'What’s your favorite thing about weekends?',
    'If you could invent a new sport, what would it be?', 'What’s the silliest dance move you know?', 'What would you say if you met a friendly alien?',
    'What’s your favorite breakfast?', 'What job would you want on a pirate ship?', 'What’s a smell that reminds you of home?',
    'If you could talk to one animal, which would it be?', 'What’s your favorite holiday treat?', 'What would your superhero costume look like?',
    'What’s the best thing to do on a long car ride?', 'What’s your favorite song to sing along to?', 'What would you plant in a magic garden?',
    'Where would you build the ultimate treehouse?', 'What’s something you’re really proud of learning?', 'What would you name a pet dinosaur?',
    'What toy would you bring to life?', 'What’s the best joke you know?', 'What’s your favorite thing to do at the beach or the pool?',
    'If you could fly for a day, where would you go?', 'What would your dream sandwich have in it?', 'What’s the coolest thing you’ve ever seen in nature?',
  ],
  work: [
    'What was your very first job?', 'What’s your go-to lunch on a busy day?', 'What’s the best piece of career advice you’ve gotten?',
    'What’s on your desk that doesn’t need to be there?', 'What would your job title be in a fantasy kingdom?', 'What’s your favorite way to unwind after work?',
    'What’s a skill you have that would surprise your coworkers?', 'What’s the best team outing you’ve ever been on?', 'If you could swap jobs with anyone for a day, who?',
    'What’s your most-used work phrase?', 'What’s your ideal office snack?', 'What’s a small win that made your week recently?',
    'What app could you not live without?', 'What would you do with an extra hour every day?', 'What’s your morning routine in three words?',
    'What was your dream job as a kid?', 'What’s the best conference or work trip you’ve been on?', 'What’s your favorite meeting-free activity?',
    'What would be your walk-up song at work?', 'What’s a hobby you’d love to turn into a job?', 'What’s your favorite thing about where you work?',
    'What’s the strangest job interview question you’ve been asked?', 'What’s your preferred way to take notes?', 'If the office had a mascot, what would it be?',
    'What’s a book or podcast you’d recommend to everyone here?', 'What’s your favorite way to celebrate finishing a big project?', 'Coffee, tea, or something else? Be specific.',
    'What was the best boss you ever had like?', 'What’s a tool or trick that saves you time?', 'What would your out-of-office message say if you were fully honest?',
    'Where would you hold the next team meeting if money were no object?', 'What’s your hidden talent at office parties?', 'What did you study (or almost study)?',
    'What’s one thing you’d add to the office?', 'What’s the most interesting place you’ve worked from?', 'What’s a work habit you’re trying to break?',
    'What’s the best compliment you’ve gotten at work?', 'What would you teach in a ten-minute class?', 'What’s your favorite day of the work week, and why?',
    'If you started a company tomorrow, what would it do?', 'What’s your go-to karaoke song for the holiday party?', 'What’s a skill you learned on the job that you use at home?',
  ],
  holiday: [
    'What’s the best snow creation you’ve ever made?', 'What’s the best costume you’ve ever worn?', 'What would your dream costume be if money were no object?',
    'What’s your favorite candy to find in a treat bag?', 'What’s the spookiest place you’ve ever been?', 'What’s your favorite cozy winter drink?',
    'What’s the best summer day you can remember?', 'What’s your go-to cookout food?', 'What’s your favorite thing to do on a hot summer night?',
    'What’s the best gift you ever made by hand?', 'How do you celebrate the start of a new year?', 'What’s a New Year’s resolution you actually kept?',
    'What would you carve into a pumpkin this year?', 'What’s the scariest story you know by heart?', 'What’s your favorite ice-cream flavor on a hot day?',
    'What would a holiday in your honor be called?', 'What’s a decoration you’d keep up all year if you could?', 'What’s your favorite winter sport or snow activity?',
    'What’s the most memorable thing you did over a school break?', 'What food tastes like the holidays to you?', 'What’s the best thing about long summer evenings?',
    'Sledding, skating, or staying inside with a blanket?', 'What’s a kind thing you love to do for others during the holidays?', 'What would you name a snowman?',
    'What’s the best thing to put on top of hot cocoa?', 'Beach, pool, or lake? Why?', 'What sound reminds you of summer?',
    'What’s your favorite way to cool off on a hot day?', 'What’s the funniest holiday mishap you’ve seen?', 'What’s a holiday food you could eat all year?',
    'What would you put in a winter survival kit?', 'What’s the best sandcastle feature you’ve ever built?', 'What’s the spookiest noise you’ve heard at night?',
    'What monster would you be at a costume party?', 'What’s your favorite thing about autumn leaves?', 'How do you stay warm on the coldest day of the year?',
    'What’s the best gift for someone who has everything?', 'What’s your favorite holiday song to sing along to?', 'What would your perfect snow-day menu be?',
    'What’s the best summer project you’ve ever had?', 'What’s the longest you’ve ever counted down to a holiday?', 'Fireworks: love them or cover your ears?',
    'What’s your favorite thing to grill?', 'What would you write in a card to your future self next year?', 'What’s the best gift-wrapping job you’ve ever done (or seen)?',
    'What’s a holiday tradition you’d love to start?', 'What’s your favorite picnic food?', 'What would you name a friendly ghost?',
  ],
  classics: [
    'What’s a chore you secretly enjoy?', 'What’s the best thing you’ve ever found on the ground?', 'What smell brings back a favorite memory?',
    'What’s your favorite word, and why?', 'What’s the oldest thing you own?', 'What’s something you always carry with you?',
    'What’s your favorite thing to cook from scratch?', 'What’s the best nickname you’ve ever had?', 'What would you name a boat?',
    'What’s your favorite kind of weather?', 'What’s a simple thing that always makes you smile?', 'What’s the most useful thing you know how to fix?',
    'What’s your favorite sandwich of all time?', 'What’s a skill an older relative or neighbor taught you?', 'What’s your favorite way to spend a quiet evening?',
    'What’s the nicest compliment a stranger ever gave you?', 'What’s your favorite card game to play at the kitchen table?', 'What’s the best thing to bring to a potluck?',
    'What’s your favorite thing about mornings?', 'What’s the most beautiful view you’ve ever seen?', 'What’s a sound you find relaxing?',
    'What’s the best handwritten note you’ve ever gotten?', 'If you ran a little shop, what would it sell?', 'What’s your favorite kind of bread?',
    'What’s something you’ve kept since you were little?', 'What would you do with a whole day of silence?', 'What’s your favorite thing to make with your hands?',
    'What’s your favorite flower or plant?', 'What’s the best way to cheer up a friend?', 'What would your signature dish be at a dinner party?',
    'What’s a rule you live by?', 'Early bird or night owl? Prove it.', 'What’s a small luxury you love?',
    'What’s the best thing you’ve ever grown (or tried to grow)?', 'What’s your favorite thing to collect?', 'What’s a proverb or saying you think is true?',
    'What’s your favorite room in your home, and why?', 'Which animal would make the best roommate?', 'What would you name a bakery?',
    'What’s your favorite thing to do on a long walk?', 'What’s the best soup?', 'What old-fashioned thing should make a comeback?',
    'What’s the most patient thing you’ve ever done?', 'What would you invent to make chores easier?', 'What’s your favorite game to play outdoors?',
    'What’s the best piece of furniture you’ve ever owned?', 'What’s your favorite pie?', 'What would you write on a sign in your front yard?',
  ],
  travel: [
    'What’s the farthest you’ve ever been from home?', 'What’s a place you’d love to visit someday?', 'Window seat or aisle seat? Defend it.',
    'What’s the best food you’ve tried on a trip?', 'What’s one thing you always forget to pack?', 'What’s your favorite souvenir?',
    'What natural wonder would you most like to see?', 'Mountains, beach, city, or countryside?', 'What’s a word in another language you love?',
    'What would you pack for a year on a desert island?', 'What’s your best travel tip?', 'What’s the longest journey you’ve ever taken?',
    'Which country’s food could you eat for a whole month?', 'What’s the funniest travel mix-up you’ve had?', 'What would your dream road-trip route be?',
    'Train, plane, boat, or car?', 'What’s a festival anywhere in the world you’d love to see?', 'If you could live in any city for a year, which one?',
    'What’s the best place you’ve ever stayed overnight?', 'What’s your favorite thing to do on the first day of a trip?', 'What’s something you learned from traveling?',
    'Which landmark would you most like to see in person?', 'What’s the most unusual food you’ve ever tried?', 'What would you name your own country?',
    'What’s the best way to pass the time on a long trip?', 'What’s a language you wish you could speak fluently?', 'What’s your must-have road-trip snack?',
    'If you could visit any place at any time in history, where and when?', 'What’s the coldest place you’ve ever been?', 'What’s the hottest place you’ve ever been?',
    'Planner or go-with-the-flow traveler?', 'What’s an animal you’d travel the world to see?', 'What’s the best view you’ve had from a plane, train, or car?',
    'What’s a place near home that more people should visit?', 'What would be the first stop on your trip around the world?', 'What’s something you bring back from every trip?',
    'What’s the best market you’ve ever wandered through?', 'What’s your dream vacation with no budget at all?', 'What’s the smallest town you’ve ever visited?',
    'Which ocean, sea, or lake would you dive into first?', 'If you gave a tour of your hometown, where would you start?', 'Would you rather explore outer space or the deep sea?',
    'What’s a travel habit you can’t break?', 'What’s the best meal you’ve eaten outdoors?', 'What’s a custom from another place you’d love to adopt?',
    'Where would you go to see the stars?', 'What’s your favorite way to get around a new city?', 'What postcard would you send from where you are right now?',
  ],
};
// Canned answers for test bots (made up, deliberately goofy).
const BOT_ANSWERS = [
  'Pizza, obviously', 'A llama farm', 'Probably take a nap', 'My cousin Steve', 'Socks with sandals', 'Juggling flaming pancakes',
  'Hiding from my problems', 'The Moon', 'A very confused goose', 'Tacos every single day', 'Dancing in the kitchen', 'I plead the fifth',
  'Buy a hot tub', 'Learn to yodel', 'Pineapple. Fight me.', 'A haunted toaster', 'Sleep for 14 hours', 'Karaoke until sunrise',
  'My grandma’s lasagna', 'Talk to my plants', 'Collect rubber ducks', 'Build a blanket fort', 'Scream into a pillow', 'Glitter. So much glitter.',
  'A tiny hat for my cat', 'Run away to join the circus', 'Beep boop (I am not a robot)', 'Cereal for dinner', 'A dramatic slow clap', 'The Macarena',
  'Moonwalk out of the room', 'Free snacks forever', 'Overthinking everything', 'A suspicious amount of cheese', 'Pretend to be busy', 'Sing to my dog',
  'A monster truck', 'Get lost in IKEA on purpose', 'Bubble wrap', 'Interpretive dance',
];

class WhoSaid {
  constructor(room, settings) {
    this.room = room; this.s = settings;
    this.phase = 'answer'; this.round = 0; this.question = null; this.custom = false;
    this.answers = new Map(); this.scores = new Map(); this.stats = new Map(); this.ddUsed = new Set(); this.spotted = new Map();
    this.queue = []; this.cur = null; this.spotN = 0; this.spotTotal = 0; this.wall = []; this.endsAt = 0; this.timer = null; this.awards = null; this.feed = [];
  }
  shuffle(a) { const r = this.room.rng; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  setTimer(ms, fn) { this.room.cancel(this.timer); this.endsAt = this.room.now() + ms; this.timer = this.room.after(ms, fn); }
  stopTimer() { this.room.cancel(this.timer); this.timer = null; }
  seat(p) {
    if (this.scores.has(p.id)) return;
    this.scores.set(p.id, 0);
    this.stats.set(p.id, { correct: 0, guesses: 0, fooled: 0, guessed: 0, fastMs: 0, fastN: 0, bluffs: 0, streak: 0, best: 0, fires: 0 });
  }
  add(id, pts) { this.scores.set(id, (this.scores.get(id) || 0) + pts); }
  host() { return this.room.vip(); }
  isCustomRound() { return this.s.custom === 'on' && this.round === this.s.rounds && !!this.host(); }

  // Room-wide Family Mode (TV setting): Classic/Silly/Deep/Spicy/Coworkers/Mix fall back to the family-safe
  // packs (Family + Holiday + Classics + Travel); a family-safe pick is kept as chosen.
  packKeys() {
    const pick = this.s.pack;
    if (this.room && this.room.family) return FAMILY_SAFE.includes(pick) ? [pick] : pick === 'mix' ? FAMILY_SAFE.slice() : ['family'];
    return pick === 'mix' || !PACKS[pick] ? Object.keys(PACKS) : [pick];
  }
  start() {
    this.pool = this.packKeys().flatMap((k) => PACKS[k]);
    this.deck = this.shuffle(this.pool.slice()); this.highlights = null;
    for (const p of this.room.list()) this.seat(p);
    this.nextRound();
  }
  joined(p) { this.seat(p); }
  left(p) {
    if (this.phase === 'custom' && !this.host()) { this.useQuestion(this.drawQuestion(), false); return; }
    if (this.phase === 'answer') this.maybeAllAnswered();
    else if (this.phase === 'spot') this.maybeAllGuessed();
  }
  drawQuestion() { if (!this.deck.length) this.deck = this.shuffle((this.pool || this.packKeys().flatMap((k) => PACKS[k])).slice()); return this.deck.pop(); }

  nextRound() {
    this.round++; this.answers = new Map(); this.cur = null; this.wall = []; this.queue = []; this.spotN = 0; this.spotTotal = 0;
    if (this.isCustomRound()) {
      this.phase = 'custom'; this.question = null; this.custom = true; this.room.fx('unlock');
      this.setTimer(CUSTOM_SECONDS * 1000, () => this.useQuestion(this.drawQuestion(), false));
      return;
    }
    this.useQuestion(this.drawQuestion(), false);
  }
  useQuestion(text, custom) {
    this.phase = 'answer'; this.question = text; this.custom = custom;
    this.room.fx('round');
    this.setTimer(this.s.answerSeconds * 1000, () => this.beginSpots());
    const q = Math.min(this.s.answerSeconds * 1000 * 0.5, 9000);
    for (const p of this.room.list()) if (p.bot) this.room.after(1500 + this.room.rng() * q, () => {
      if (this.phase === 'answer' && !this.answers.has(p.id)) this.act(p, { op: 'answer', text: BOT_ANSWERS[Math.floor(this.room.rng() * BOT_ANSWERS.length)] });
    });
  }
  maybeAllAnswered() {
    if (this.phase !== 'answer' || this.allInSoon) return;
    const list = this.room.list();
    if (list.length && list.every((p) => this.answers.has(p.id))) {
      this.allInSoon = true;
      this.setTimer(1500, () => { this.allInSoon = false; this.beginSpots(); });
    }
  }

  beginSpots() {
    this.allInSoon = false;
    if (this.phase !== 'answer') return;
    this.stopTimer();
    const ids = this.shuffle([...this.answers.keys()].filter((id) => this.room.get(id)));
    // Humans first (they typed their own), then whoever has been spotlighted least so far.
    ids.sort((a, b) => (Number(!!this.room.get(a).bot) - Number(!!this.room.get(b).bot)) || ((this.spotted.get(a) || 0) - (this.spotted.get(b) || 0)));
    this.queue = ids.slice(0, this.s.spots); this.spotTotal = this.queue.length;
    const chosen = new Set(this.queue);
    this.wall = this.shuffle(ids.filter((id) => !chosen.has(id))).map((id) => ({ name: this.room.name(id), text: this.answers.get(id).text }));
    this.nextSpot();
  }
  nextSpot() {
    this.stopTimer();
    let id = this.queue.shift();
    while (id && !this.room.get(id)) { this.wall.push({ name: this.room.name(id), text: (this.answers.get(id) || {}).text || '' }); id = this.queue.shift(); }
    if (!id) return this.endRound();
    this.spotted.set(id, (this.spotted.get(id) || 0) + 1);
    // The author plus up to 3 decoys, shuffled; names are snapshotted so a leaver can't break the round.
    const others = this.shuffle(this.room.list().filter((p) => p.id !== id)).slice(0, 3).map((p) => p.id);
    const opts = this.shuffle([id, ...others]);
    this.spotN++;
    this.cur = { id, text: this.answers.get(id).text, opts, names: opts.map((x) => this.room.name(x)), avs: opts.map((x) => { const q = this.room.get(x); return q && q.avatar ? String(q.avatar).slice(0, 8) : ''; }), votes: new Map(), at: this.room.now(), n: this.spotN, result: null };
    this.phase = 'spot'; this.room.fx('spot');
    this.setTimer(this.s.spotSeconds * 1000, () => this.reveal());
    const span = Math.min(this.s.spotSeconds * 1000 * 0.6, 8000);
    for (const p of this.room.list()) if (p.bot && p.id !== id) this.room.after(1200 + this.room.rng() * span, () => {
      if (this.phase !== 'spot' || this.cur.id === p.id || this.cur.votes.has(p.id)) return;
      this.act(p, { op: 'guess', pick: Math.floor(this.room.rng() * this.cur.opts.length), dd: !this.ddUsed.has(p.id) && this.room.rng() < 0.12 });
    });
  }
  voters() { return this.room.list().filter((p) => p.id !== this.cur.id); }
  maybeAllGuessed() {
    if (this.phase !== 'spot' || this.cur.soon) return;
    if (this.voters().every((p) => this.cur.votes.has(p.id))) { this.cur.soon = true; this.setTimer(700, () => this.reveal()); }
  }
  reveal() {
    if (this.phase !== 'spot') return;
    this.stopTimer();
    const c = this.cur, authorIdx = c.opts.indexOf(c.id);
    const right = [...c.votes].filter(([, v]) => v.pick === authorIdx).sort((a, b) => a[1].at - b[1].at);
    const fast = Math.ceil(right.length / 3);
    const gains = {}, tally = c.opts.map(() => 0);
    for (const v of c.votes.values()) tally[v.pick]++;
    let fooled = 0;
    for (const [pid, v] of c.votes) {
      const st = this.stats.get(pid); if (!st) continue;
      st.guesses++;
      const g = { right: v.pick === authorIdx, pts: 0, speed: false, dd: v.dd, fire: false };
      if (g.right) {
        const rank = right.findIndex(([id]) => id === pid);
        g.speed = rank < fast;
        g.pts = (PTS.right + (g.speed ? PTS.speed : 0)) * (v.dd ? 2 : 1);
        st.correct++; st.fastMs += v.at - c.at; st.fastN++; st.streak++; st.best = Math.max(st.best, st.streak);
        if (st.streak % 3 === 0) { g.fire = true; g.pts += PTS.streak; st.fires++; }
      } else {
        fooled++; st.streak = 0;
        if (v.dd) g.pts = PTS.ddWrong;
      }
      this.add(pid, g.pts); gains[pid] = g;
    }
    // Present but didn't guess: the streak is broken.
    for (const p of this.voters()) if (!c.votes.has(p.id)) { const st = this.stats.get(p.id); if (st) st.streak = 0; }
    const ast = this.stats.get(c.id);
    const bluff = c.votes.size > 0 && right.length === 0;
    if (ast) { ast.fooled += fooled; ast.guessed += right.length; if (bluff) ast.bluffs++; }
    this.add(c.id, fooled * PTS.fooled);
    c.result = { author: authorIdx, name: this.room.name(c.id), tally, fooled, right: right.length, voted: c.votes.size, bluff, authorPts: fooled * PTS.fooled,
      first: right.slice(0, 8).map(([id]) => this.room.name(id)), fires: Object.entries(gains).filter(([, g]) => g.fire).map(([id]) => this.room.name(id)).slice(0, 6) };
    c.gains = gains;
    this.phase = 'reveal'; this.room.fx('drum', { bluff, crowd: right.length > fooled });
    this.feed.push({ name: c.result.name, text: c.text, fooled, right: right.length, bluff }); if (this.feed.length > 6) this.feed.shift();
    (this.log = this.log || []).push({ id: c.id, text: c.text, fooled, right: right.length, voted: c.votes.size, round: this.round });
    this.setTimer(REVEAL_SECONDS * 1000, () => this.nextSpot());
  }
  endRound() {
    this.cur = null; this.phase = 'wall'; this.room.fx('wall');
    const ms = this.wall.length ? Math.min(16000, 7000 + this.wall.length * 150) : 5000;
    this.setTimer(ms, () => this.afterWall());
  }
  afterWall() {
    if (this.phase !== 'wall') return;
    if (this.round >= this.s.rounds) return this.finish();
    this.nextRound();
  }
  finish() {
    this.stopTimer(); this.phase = 'over'; this.endsAt = 0; this.cur = null;
    this.awards = this.makeAwards(); this.highlights = this.makeHighlights(); this.room.fx('win');
  }
  // The answers everyone will talk about on the way home: the best bluff and the dead giveaway.
  makeHighlights() {
    const rated = (this.log || []).filter((x) => x.voted >= 2);
    const pick = (score) => rated.slice().sort((a, b) => score(b) - score(a) || b.voted - a.voted)[0];
    const out = (x, kind) => (x ? { kind, text: x.text, ...this.who(x.id), fooled: x.fooled, right: x.right, voted: x.voted } : null);
    const bluff = pick((x) => x.fooled / x.voted), easy = pick((x) => x.right / x.voted);
    return {
      bluff: bluff && bluff.fooled / bluff.voted >= 0.5 ? out(bluff, 'bluff') : null,
      easy: easy && easy !== bluff && easy.right / easy.voted >= 0.6 ? out(easy, 'easy') : null,
    };
  }
  who(id) { const p = this.room.get(id); return { id, name: this.room.name(id), av: p && p.avatar ? String(p.avatar).slice(0, 8) : '' }; }
  // Best first, once the game is over (for the party scoreboard across games).
  results() { return this.standings().map((r) => r.id); }
  makeAwards() {
    const here = [...this.stats].filter(([id]) => this.room.get(id));
    const best = (val, min = 1) => { let top = null; for (const [id, st] of here) { const v = val(st); if (v == null || v < min) continue; if (!top || v > top.v) top = { id, v }; } return top; };
    const out = [];
    const push = (key, icon, title, blurb, t, text) => { if (t) out.push({ key, icon, title, blurb, ...this.who(t.id), id: t.id, value: text(t.v) }); };
    push('mind', '🔮', 'Mind Reader', 'Most correct guesses', best((s) => s.correct), (v) => `${v} correct`);
    push('mystery', '🕵️', 'Master of Mystery', 'Fooled the most people', best((s) => s.fooled), (v) => `fooled ${v}`);
    push('open', '📖', 'Open Book', 'Guessed the most often', best((s) => s.guessed), (v) => `guessed ${v}×`);
    push('fast', '⚡', 'Fastest Finger', 'Quickest right answers', best((s) => (s.fastN ? -s.fastMs / s.fastN : null), -Infinity), (v) => `${(-v / 1000).toFixed(1)}s avg`);
    push('bluff', '🎭', 'Bluff Champion', 'Nobody guessed them', best((s) => s.bluffs), (v) => `${v} bluff badge${v === 1 ? '' : 's'}`);
    push('fire', '🔥', 'On Fire', 'Longest guessing streak', best((s) => s.best, 3), (v) => `${v} in a row`);
    return out;
  }
  next() {
    if (this.phase === 'custom') this.useQuestion(this.drawQuestion(), false);
    else if (this.phase === 'answer') this.beginSpots();
    else if (this.phase === 'spot') this.reveal();
    else if (this.phase === 'reveal') this.nextSpot();
    else if (this.phase === 'wall') this.afterWall();
  }

  act(p, m) {
    if (!this.scores.has(p.id)) this.seat(p);
    m = m && typeof m === 'object' ? m : {};
    if (m.op === 'answer') {
      if (this.phase !== 'answer') return { ok: false, error: 'Answering time is over.' };
      const text = clean(typeof m.text === 'string' ? m.text : '', ANSWER_MAX);
      if (text.length < 1) return { ok: false, error: 'Type an answer first.' };
      const fresh = !this.answers.has(p.id);
      this.answers.set(p.id, { text, at: this.room.now() });
      if (fresh && this.answers.size <= 16) this.room.fx('in');
      this.maybeAllAnswered();
      return { ok: true };
    }
    if (m.op === 'question') {
      if (this.phase !== 'custom') return { ok: false, error: 'Not now.' };
      const h = this.host(); if (!h || h.id !== p.id) return { ok: false, error: 'Only the host writes this question.' };
      const text = clean(typeof m.text === 'string' ? m.text : '', QUESTION_MAX);
      if (text.length < 5) return { ok: false, error: 'Write a question (a few words).' };
      this.useQuestion(text, true);
      return { ok: true };
    }
    if (m.op === 'surprise') {
      if (this.phase !== 'custom') return { ok: false, error: 'Not now.' };
      const h = this.host(); if (!h || h.id !== p.id) return { ok: false, error: 'Only the host can do that.' };
      this.useQuestion(this.drawQuestion(), false);
      return { ok: true };
    }
    if (m.op === 'guess') {
      if (this.phase !== 'spot' || !this.cur) return { ok: false, error: 'Guessing isn’t open.' };
      if (p.id === this.cur.id) return { ok: false, error: 'That’s yours! Keep a poker face.' };
      if (this.cur.votes.has(p.id)) return { ok: false, error: 'Your guess is locked in.' };
      const k = Number(m.pick);
      if (!Number.isInteger(k) || k < 0 || k >= this.cur.opts.length) return { ok: false, error: 'Pick one of the names.' };
      const dd = m.dd === true;
      if (dd && this.ddUsed.has(p.id)) return { ok: false, error: 'You already used your Double Down.' };
      if (dd) this.ddUsed.add(p.id);
      this.cur.votes.set(p.id, { pick: k, at: this.room.now(), dd });
      this.maybeAllGuessed();
      return { ok: true };
    }
    return { ok: false, error: 'Unknown move.' };
  }

  standings() { return [...this.scores].filter(([id]) => this.room.get(id)).map(([id, pts]) => ({ id, ...this.who(id), points: pts, fire: (this.stats.get(id) || {}).streak >= 3, correct: (this.stats.get(id) || {}).correct || 0 })).sort((a, b) => b.points - a.points || b.correct - a.correct); }
  endsIn() { return this.endsAt && this.phase !== 'over' ? Math.max(0, this.endsAt - this.room.now()) : 0; }
  // Public spotlight: the answer and the names. Who wrote it only appears in the reveal.
  spotPublic() {
    const c = this.cur; if (!c) return null;
    return { text: c.text, names: c.names, avs: c.avs || [], ids: c.opts || [], n: c.n, total: this.spotTotal, voted: c.votes.size, of: this.voters().length, result: this.phase === 'reveal' ? c.result : null };
  }
  notGuessed() { return this.phase === 'spot' && this.cur ? this.voters().filter((p) => !this.cur.votes.has(p.id)).slice(0, 20).map((p) => p.name) : [];
  }
  tv() {
    const host = this.host();
    return {
      phase: this.phase, round: this.round, rounds: this.s.rounds, endsIn: this.endsIn(), question: this.question, custom: this.custom,
      host: host ? host.name : null, answered: this.answers.size, of: this.room.players.size,
      waiting: this.phase === 'answer' ? this.room.list().filter((p) => !this.answers.has(p.id)).map((p) => p.name).slice(0, 30) : [],
      spot: this.phase === 'spot' || this.phase === 'reveal' ? this.spotPublic() : null,
      wall: this.phase === 'wall' ? this.wall.slice(0, 48) : [], wallMore: this.phase === 'wall' ? Math.max(0, this.wall.length - 48) : 0,
      feed: this.feed.slice(-4), standings: this.standings().slice(0, this.phase === 'over' ? 10 : 12), awards: this.awards,
      notGuessed: this.notGuessed(), highlights: this.phase === 'over' ? this.highlights : null,
    };
  }
  view(p) {
    const st = this.standings(), c = this.cur, me = this.stats.get(p.id) || {}, mine = this.answers.get(p.id), host = this.host();
    let spot = null;
    if (c && (this.phase === 'spot' || this.phase === 'reveal')) {
      const v = c.votes.get(p.id);
      spot = { ...this.spotPublic(), mine: c.id === p.id, myPick: v ? v.pick : null, myDd: v ? v.dd : false, gain: c.gains ? c.gains[p.id] || null : null };
    }
    return {
      phase: this.phase, round: this.round, rounds: this.s.rounds, endsIn: this.endsIn(), question: this.question, custom: this.custom,
      isHost: !!host && host.id === p.id, host: host ? host.name : null,
      answered: !!mine, myAnswer: mine ? mine.text : null, max: ANSWER_MAX, qmax: QUESTION_MAX,
      spot, canDd: !this.ddUsed.has(p.id), streak: me.streak || 0,
      points: this.scores.get(p.id) || 0, rank: st.findIndex((x) => x.id === p.id) + 1, of: st.length,
      final: this.phase === 'over' ? st.slice(0, 10) : null, awards: this.phase === 'over' ? (this.awards || []).filter((a) => a.id === p.id).map((a) => ({ icon: a.icon, title: a.title, value: a.value })) : null,
      stats: this.phase === 'over' ? { correct: me.correct || 0, guesses: me.guesses || 0, fooled: me.fooled || 0, bluffs: me.bluffs || 0, best: me.best || 0 } : null,
    };
  }
}

module.exports = {
  key: 'whosaid', name: 'Who Said It?', min: 3, best: [4, 12], fields, defaults, PACKS, FAMILY_SAFE,
  create: (room, settings) => new WhoSaid(room, settings),
};
