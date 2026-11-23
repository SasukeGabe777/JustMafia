'use strict';
// JustPitch content: every product, book, scandal, cue card, quote, question and caller is
// original. Family-friendly by default; entries marked p: 1 are "party" (grown-up but still clean)
// and only dealt with the Party pack or the mixed pack outside Family mode.
// Topic: { n: name, l: one line that sets it up }.  Card: [text] or [text, 1] (party).

// ---------------- the five modes ----------------
const MODES = {
  focus: { icon: '🗣️', name: 'Focus Group', role: 'moderator', visual: 'The prototype', visuals: 1,
    pitch: 'Run the focus group: ask the panel what they think, keep them on track, and make the product sound like a hit.',
    sab: 'Feed the moderator lines to read out and topics to steer toward. Wake up panelists in the audience!',
    vote: 'Who ran the better focus group?', short: 'Moderate a fake focus group' },
  deck: { icon: '📊', name: 'The Big Presentation', role: 'founder', visual: 'Slide', visuals: 3,
    pitch: 'Pitch your product to the investors. Explain every slide like you made it on purpose.',
    sab: 'You drew the slides. Flip to the next one whenever it hurts most, and send cue cards.',
    vote: 'Who would you invest in?', short: 'Pitch a product off slides you never saw' },
  book: { icon: '📚', name: 'Buy My Book', role: 'author', visual: 'The cover', visuals: 1,
    pitch: 'Sell your book. Read every quote from it out loud, then defend it.',
    sab: 'You drew the cover. Now send “quotes from the book” the author has to read and defend.',
    vote: 'Rate the books: 1 to 5 stars', short: 'Sell an absurd book you didn’t write' },
  press: { icon: '🎙️', name: 'Press Conference', role: 'spokesperson', visual: 'Exhibit A', visuals: 1,
    pitch: 'Face the press about your scandal. Answer every question. Stay calm. Blame nobody (or everybody).',
    sab: 'Pick which reporter question comes next. The audience can send in questions too.',
    vote: 'Who handled the press better?', short: 'Survive a press conference about a silly scandal' },
  tv: { icon: '📺', name: 'Late-Night Infomercial', role: 'host', visual: 'The product shot', visuals: 1,
    pitch: 'Sell the gadget live on late-night TV. Do every demo. Take every call. Keep smiling.',
    sab: 'Send demo instructions, put callers on the air and slash (or hike) the price.',
    vote: 'Whose gadget would you buy?', short: 'Sell a gadget on late-night TV' },
};
const MODE_KEYS = Object.keys(MODES);

// ---------------- what gets pitched ----------------
const TOPICS = {
  focus: [
    { n: 'Gravy-Flavoured Toothpaste', l: 'for people who miss dinner' }, { n: 'The Silent Alarm Clock', l: 'it wakes you up by staring at you' },
    { n: 'Square Grapes', l: 'they stack, they don’t roll' }, { n: 'Pillow Shoes', l: 'sleep anywhere, walk nowhere' },
    { n: 'Pre-Chewed Gum', l: 'all the flavour, none of the effort' }, { n: 'The Umbrella Hat Deluxe', l: 'now with a second umbrella' },
    { n: 'Bread-Scented Candles', l: 'your living room, now a bakery' }, { n: 'Decaf Water', l: 'water, but calmer' },
    { n: 'The Self-Folding Map', l: 'it folds itself. Usually wrong.' }, { n: 'Spicy Ice Cubes', l: 'keeps your drink cold and your mouth hot' },
    { n: 'Glow-in-the-Dark Soup', l: 'never lose your dinner again' }, { n: 'Pebble Pal 2', l: 'the pet pebble now has opinions' },
    { n: 'Cereal for Dinner Cereal', l: 'it’s cereal, but formal' }, { n: 'Sock Matchmaker', l: 'an app for lonely socks' },
    { n: 'Invisible Ink Birthday Cards', l: 'the thought is what counts' }, { n: 'Breakfast Pizza Lip Balm', l: 'kiss like a brunch' },
    { n: 'The Inflatable Office Chair', l: 'every meeting is a pool party' }, { n: 'Cloud in a Jar', l: 'bring your own weather indoors' },
    { n: 'Talking Plant Pots', l: 'they tell you when they’re thirsty. Loudly.' }, { n: 'Backwards Clock', l: 'for people who are always early' },
    { n: 'Edible Phone Case', l: 'a snack for emergencies' }, { n: 'Sandwich Sunglasses', l: 'shade for your lunch' },
    { n: 'Extreme Sport Knitting', l: 'knitting, but on a mountain bike' }, { n: 'One-Size-Fits-Nobody Hat', l: 'a bold fashion statement' },
    { n: 'Lasagna Mattress', l: 'layers of comfort', p: 1 }, { n: 'Divorce Cake', l: 'for celebrating the end of something', p: 1 },
    { n: 'Office Nap Pods', l: 'tell your boss you’re in a meeting', p: 1 }, { n: 'Group Chat Translator', l: 'tells you what your friends actually meant', p: 1 },
  ],
  deck: [
    { n: 'SnoozeSpoon', l: 'a spoon that sings lullabies to your cereal' }, { n: 'DuckRide', l: 'a ride-share app for ducks, by ducks' },
    { n: 'The Smart Brick', l: 'a brick with wi-fi' }, { n: 'NapStream', l: 'stream your favourite naps' },
    { n: 'GrandmaCloud', l: 'grandma’s advice, available 24/7' }, { n: 'Puddle Insurance', l: 'for when you step in one' },
    { n: 'The Hamster Power Grid', l: 'clean energy, very small wheels' }, { n: 'Subscription Socks', l: 'one left sock a month' },
    { n: 'MoodToast', l: 'a toaster that burns your feelings into the bread' }, { n: 'Rent-a-Cheerleader', l: 'someone cheers for you all day' },
    { n: 'The Blockchain Sandwich', l: 'every bite is on the ledger' }, { n: 'Good Boy Network', l: 'a professional network for dogs' },
    { n: 'Treadmill Desk Bed', l: 'work, walk and sleep at once' }, { n: 'Pocket Volcano', l: 'a portable volcano, for warmth' },
    { n: 'Ghost Delivery Co.', l: 'packages delivered by friendly ghosts' }, { n: 'The Weather Remote', l: 'change the weather like a TV channel' },
    { n: 'Influencer Pigeons', l: 'birds with a following' }, { n: 'Fork 2.0', l: 'it’s a fork with a second fork' },
    { n: 'TimeShare for Hammocks', l: 'own one week a year in a hammock' }, { n: 'The Emotional Support Cactus', l: 'it listens. Do not hug.' },
    { n: 'Moon Parking', l: 'parking spaces on the moon, cheap' }, { n: 'Robot Butler Lite', l: 'it carries one grape at a time' },
    { n: 'Snack Drone', l: 'it drops snacks on your head' }, { n: 'Silent Disco Library', l: 'dance among the books, quietly' },
    { n: 'Meeting Escape Button', l: 'press it, fake an emergency', p: 1 }, { n: 'Reply-All Insurance', l: 'for the email you regret', p: 1 },
    { n: 'Hangover Hammock', l: 'gently rocks your regrets away', p: 1 }, { n: 'Ex Detector', l: 'beeps when someone you dated is nearby', p: 1 },
  ],
  book: [
    { n: 'Whispering to Toasters', l: 'a memoir by a retired appliance therapist' }, { n: 'My Year as a Lighthouse', l: 'an autobiography (by a lighthouse)' },
    { n: 'The Pigeon Who Knew Too Much', l: 'a thriller in 400 chapters' }, { n: 'Cooking With Only Spoons', l: 'a cookbook with no knives allowed' },
    { n: 'A Hundred Shades of Beige', l: 'a deep dive into very calm colours' }, { n: 'Socks: The Untold Story', l: 'where do they go? A true account' },
    { n: 'How I Lost to a Goose', l: 'a sports memoir' }, { n: 'Clouds I Have Known', l: 'a coffee-table book of 600 grey photos' },
    { n: 'The Art of Waiting in Line', l: 'a self-help classic' }, { n: 'Diary of a Haunted Fridge', l: 'every midnight snack, from the fridge’s side' },
    { n: 'Hamster CEO', l: 'the rise of a small business leader' }, { n: 'Unboxing My Feelings', l: 'a poetry collection about cardboard' },
    { n: 'Yelling at the Ocean', l: 'a travel book' }, { n: 'The Last Crouton', l: 'a salad survival story' },
    { n: 'Bees Are Just Flying Cats', l: 'a nature book with one big theory' }, { n: 'I Married a Mannequin', l: 'a love story' },
    { n: 'Napping for Champions', l: 'the athlete’s guide to rest' }, { n: 'Grandpa’s Secret Kazoo', l: 'a family saga' },
    { n: 'Soup: A Love Letter', l: 'every page smells like soup' }, { n: 'The Accidental Astronaut', l: 'I only wanted a nap in the capsule' },
    { n: 'Talking to My Plants (And What They Said Back)', l: 'a gardening memoir' }, { n: 'My Cat Is My Landlord', l: 'a tale of rent and treats' },
    { n: 'The Gym Is Lava', l: 'a fitness book for people who hate fitness' }, { n: 'Confessions of a Parking Meter', l: 'a gritty city tale' },
    { n: 'Brunch Is a State of Mind', l: 'a philosophy book', p: 1 }, { n: 'I Replied All', l: 'a memoir of workplace survival', p: 1 },
    { n: 'Dating Advice From My Goldfish', l: 'he has three-second relationships', p: 1 }, { n: 'Tax Returns: The Musical', l: 'a romance', p: 1 },
  ],
  press: [
    { n: 'The Mayor of Puddlewick', l: 'the new town statue looks exactly like a potato' }, { n: 'Head of the Pickle Board', l: 'pickles were found to be cucumbers in disguise' },
    { n: 'CEO of Snugglebear Toys', l: 'the new teddy bear growls at bedtime' }, { n: 'Captain of the Cruise Ship', l: 'the ship went in a circle for a week' },
    { n: 'Zoo Director', l: 'the penguins escaped to a water park' }, { n: 'Principal of Sunnyvale School', l: 'the school cafeteria served only gravy for a month' },
    { n: 'Pop Star “Glitter Jones”', l: 'caught lip-syncing to a kazoo' }, { n: 'Head Chef at Le Fancy', l: 'the soup of the day was just hot water' },
    { n: 'Chief Weather Forecaster', l: 'predicted sunshine during the worst storm in history' }, { n: 'Coach of the Mighty Moths', l: 'the team ran the wrong way for a whole game' },
    { n: 'President of the Moon Base', l: 'the moon base is just a tent in a car park' }, { n: 'Owner of the Bouncy Castle Hotel', l: 'guests keep bouncing out of bed' },
    { n: 'Mayor of Snowdrift', l: 'the town snowman won the election' }, { n: 'Museum Director', l: 'the famous painting is a poster from a gift shop' },
    { n: 'Theme Park CEO', l: 'the new rollercoaster only goes up' }, { n: 'Head of the Library', l: 'every book was returned with the last page missing' },
    { n: 'Royal Baker', l: 'the giant birthday cake was mostly cardboard' }, { n: 'Airport Manager', l: 'all luggage went to the same small island' },
    { n: 'Superhero “Captain Nap”', l: 'slept through the entire alien invasion' }, { n: 'Director of the Talent Show', l: 'every act was the same juggling dog' },
    { n: 'CEO of SmartFridge', l: 'the fridges locked everyone out of their snacks' }, { n: 'Head Gardener at the Palace', l: 'the hedge maze has no exit' },
    { n: 'Pet Influencer Manager', l: 'the famous cat has been a dog in a costume' }, { n: 'Tech CEO', l: 'the new phone is a calculator with a sticker', p: 1 },
    { n: 'Reality Show Host', l: 'the island was a hotel pool the whole time', p: 1 }, { n: 'Wedding Planner to the Stars', l: 'booked two weddings in the same barn', p: 1 },
  ],
  tv: [
    { n: 'The Sock-Bot 3000', l: 'it folds socks. And sometimes homework.' }, { n: 'The Spaghetti Straightener', l: 'perfectly straight pasta, every time' },
    { n: 'Banana Armour', l: 'never bruise a banana again' }, { n: 'The Couch Potato Peeler', l: 'peel potatoes without leaving the couch' },
    { n: 'Instant Hole', l: 'just add a shovel' }, { n: 'The Cat Mop', l: 'slippers for your cat that clean the floor' },
    { n: 'The Hug-o-Matic', l: 'a hug machine with three settings' }, { n: 'Ab-Blaster Pro', l: 'get fit by watching it work out' },
    { n: 'The Egg Cuber', l: 'square eggs for square toast' }, { n: 'Pocket Fog', l: 'instant mystery in any room' },
    { n: 'The Shower Piano', l: 'play while you wash' }, { n: 'Pebble Grooming Kit', l: 'for the pet pebble that has everything' },
    { n: 'The Whisper Amplifier', l: 'secrets, but loud' }, { n: 'Glove Hat', l: 'a hat for your hands, or gloves for your head' },
    { n: 'Bubble Wrap Pyjamas', l: 'pop yourself to sleep' }, { n: 'The Toast Cannon', l: 'breakfast from across the room' },
    { n: 'Snore-Be-Gone Duck', l: 'a rubber duck that quacks when you snore' }, { n: 'The Forever Balloon', l: 'it never comes down. Ever.' },
    { n: 'Doorbell Doorbell', l: 'a doorbell for your doorbell' }, { n: 'Personal Rain Cloud', l: 'water your plants as you walk' },
    { n: 'Noodle Umbrella', l: 'keeps the rain out of your soup' }, { n: 'The Backwards Bicycle', l: 'see where you’ve been' },
    { n: 'Instant Dad Jokes Spray', l: 'one spray, one terrible joke' }, { n: 'The Couch With Seatbelts', l: 'for exciting movie nights' },
    { n: 'Hangover Helmet', l: 'cool, dark and very quiet', p: 1 }, { n: 'The Excuse Generator', l: 'never be late again (on paper)', p: 1 },
  ],
};

// ---------------- the saboteur's cards ----------------
// General cue cards: every mode deals some.
const CUES = [
  ['Do the rest in an accent'], ['Sing the next sentence'], ['Introduce your co-founder (point at someone)'], ['Whisper for the next 10 seconds'],
  ['Mention your grandma'], ['Use a sports metaphor right now'], ['Reveal a secret feature'], ['Thank your mum'],
  ['Pretend the mic stopped working'], ['Say “synergy” three times'], ['Speak in slow motion'], ['Take a phone call from your boss'],
  ['Act like it’s freezing in here'], ['Bring up dinosaurs'], ['Do a little dance'], ['Point at the slide and gasp'],
  ['Give it a new name, mid-sentence'], ['Cry a little (happy tears)'], ['Compare it to a sandwich'], ['Mention your arch-enemy'],
  ['Make a promise you can’t keep'], ['Speak like a robot'], ['Tell a story about a horse'], ['Admit a tiny flaw'],
  ['Get the audience to chant its name'], ['Pause dramatically for five seconds'], ['Do a cartwheel (or describe one)'], ['Hug the nearest person'],
  ['Talk like a pirate'], ['Explain it to a five-year-old'], ['Start a countdown from 10'], ['Stand on one leg until the end'],
  ['Name-drop a famous squirrel'], ['Offer everyone a free sample'], ['Mention your ex', 1], ['Blame the intern', 1],
  ['Say what it costs, then double it'], ['Mention your terrible haircut'], ['Bring up taxes', 1], ['Say it cures boredom'],
];
// Mode cards. kind: what it is on the TV and the presenter's phone.
const MODE_CARDS = {
  focus: [
    // "script": read it to the panel; "steer": take the conversation there; "panel": a panelist (an audience phone) shouts it.
    ['script', 'Read to the panel: “Our lawyers say I can’t answer that.”'], ['script', 'Read to the panel: “Please stop licking the samples.”'],
    ['script', 'Read to the panel: “It was my idea. Mostly.”'], ['script', 'Read to the panel: “Raise your hand if you feel seen.”'],
    ['script', 'Read to the panel: “Who here has a nut allergy? Asking for legal.”'], ['script', 'Read to the panel: “Thank you. That was very brave.”'],
    ['script', 'Read to the panel: “We tested it on my uncle.”'], ['script', 'Read to the panel: “Can I get a group hug?”'],
    ['steer', 'Steer the panel to: their childhood pet'], ['steer', 'Steer the panel to: what they had for breakfast'],
    ['steer', 'Steer the panel to: pirates'], ['steer', 'Steer the panel to: their biggest fear'], ['steer', 'Steer the panel to: the moon landing'],
    ['steer', 'Steer the panel to: the perfect sandwich'], ['steer', 'Steer the panel to: their secret talent'], ['steer', 'Steer the panel to: a famous breakup', 1],
    ['panel', 'Does it come in beige?'], ['panel', 'My cousin made this in 2009.'], ['panel', 'Can I eat it?'], ['panel', 'Is this a cult?'],
    ['panel', 'I want my money back!'], ['panel', 'Why is it humming?'], ['panel', 'Will it get along with my cat?'], ['panel', 'I’m crying. Is that normal?'],
    ['panel', 'Is it gluten-free?'], ['panel', 'Who’s paying for lunch?'], ['panel', 'Can I speak to your manager?'], ['panel', 'I only came for the snacks.'],
  ],
  deck: [
    ['cue', 'The next slide is your favourite. Say why.'], ['cue', 'Explain the graph on this slide'], ['cue', 'Read the slide out loud, word for word (there are no words)'],
    ['cue', 'Say “as you can clearly see…”'], ['cue', 'Point out the hidden detail on this slide'], ['cue', 'Ask for 10 million, right now'],
    ['cue', 'Reveal your competitor: a goose'], ['cue', 'The investors look bored. Win them back!'], ['cue', 'Your laptop died. Keep going.'],
    ['cue', 'Announce a celebrity partner'], ['cue', 'Explain the logo’s deep meaning'], ['cue', 'Show them the product (mime it)'],
  ],
  book: [
    ['quote', '“Chapter one: the soup was watching me.”'], ['quote', '“I never trusted the ducks. And they never trusted me.”'],
    ['quote', '“She looked at me the way a toaster looks at bread.”'], ['quote', '“By page forty, the hamster was in charge.”'],
    ['quote', '“I had one rule: never nap on a Tuesday.”'], ['quote', '“The moon was full. So was I. Lasagna.”'],
    ['quote', '“It was a Tuesday. It was mostly a Tuesday.”'], ['quote', '“And that is why I can no longer enter any bowling alley.”'],
    ['quote', '“My mother always said: never wrestle a goose.”'], ['quote', '“I cried for three chapters. Then I had a snack.”'],
    ['quote', '“The butler did it. I am the butler.”'], ['quote', '“Every sock has a story. This is mine.”'],
    ['quote', '“I whispered to the toaster. The toaster whispered back.”'], ['quote', '“The twist: it was a dream. The other twist: the dream was a sandwich.”'],
    ['quote', '“Never trust a man with three umbrellas.”'], ['quote', '“I sneezed, and the empire fell.”'],
    ['quote', '“Love is like a shopping cart with one wobbly wheel.”'], ['quote', '“The pigeons held a meeting. I was not invited.”'],
    ['quote', '“I married her for her spreadsheet skills.”', 1], ['quote', '“The divorce was mostly about the thermostat.”', 1],
    ['quote', '“I fainted, beautifully.”'], ['quote', '“Chapter nine is just the word ‘soup’ for forty pages.”'],
    ['cue', 'Do a dramatic reading of the blurb on the back'], ['cue', 'Reveal there’s a sequel'], ['cue', 'Sign a copy for someone in the room'],
  ],
  press: [
    ['question', 'Is it true you knew about this all along?'], ['question', 'Who is really in charge here?'], ['question', 'Will you resign? Yes or no?'],
    ['question', 'Where were you on Tuesday night?'], ['question', 'Is that a real moustache?'], ['question', 'Why are you sweating?'],
    ['question', 'Can you explain Exhibit A?'], ['question', 'What do you say to the ducks you’ve upset?'], ['question', 'How do you sleep at night?'],
    ['question', 'Will there be a refund?'], ['question', 'Is your mother proud of you?'], ['question', 'Who leaked the photo?'],
    ['question', 'Did you write your own speech?'], ['question', 'Is it true the potato has a lawyer?'], ['question', 'Will you apologise to the nation?'],
    ['question', 'What’s in the suitcase?'], ['question', 'Why did your assistant just run away?'], ['question', 'Can you say that again, slower?'],
    ['question', 'Is this the worst week of your life?'], ['question', 'What’s your plan B?'], ['question', 'Is it true you dated the statue?', 1],
    ['cue', 'Your phone is ringing. Answer it.'], ['cue', 'Your assistant hands you a note. Read it, panic.'], ['cue', 'Announce a surprise new policy'],
  ],
  tv: [
    ['demo', 'Demonstrate it on your own face'], ['demo', 'It just broke. Keep selling.'], ['demo', 'Show how it works in slow motion'],
    ['demo', 'Use it to cook breakfast'], ['demo', 'Demonstrate it on a volunteer'], ['demo', 'Show what happens if you drop it'],
    ['demo', 'It’s waterproof. Prove it.'], ['demo', 'Show the “before” and “after”'], ['demo', 'It has a hidden setting. Find it!'],
    ['demo', 'Show how a pet would use it'], ['demo', 'Show it to the camera, very close'], ['demo', 'Juggle it'],
    ['caller', 'It turned my soup blue!'], ['caller', 'Mine ran away. Where did it go?'], ['caller', 'I bought nine. Is that too many?'],
    ['caller', 'My grandma uses it as a hat.'], ['caller', 'It keeps winking at me.'], ['caller', 'Can it fix my marriage?', 1],
    ['caller', 'It ate my homework. Thank you!'], ['caller', 'Does it work on Mondays?'], ['caller', 'My dog is now my boss. Is that a feature?'],
    ['caller', 'Is it legal in my country?'], ['caller', 'It made me cry, in a good way.'], ['caller', 'It started singing at 3am.'],
    ['price', 'NOW ONLY $1!'], ['price', 'NOW $9,999!'], ['price', 'FREE! (shipping: $400)'], ['price', 'BUY ONE, GET NINE!'],
    ['price', 'PAY IN BANANAS'], ['price', 'ONLY 3 PAYMENTS OF $3,333!'], ['price', '50% OFF THE SECOND HALF'], ['price', 'PRICELESS (literally)'],
  ],
};
// Big Presentation slide headings (the saboteur draws under them).
const SLIDE_HEADS = [
  ['The problem', 'Our product', 'The money'], ['Meet the team', 'How it works', 'World domination'], ['Our story', 'The prototype', 'Next year'],
  ['The market', 'Our secret sauce', 'Happy customers'], ['Before', 'After', 'Our mascot'], ['The idea', 'The science', 'The ask'],
  ['Customer #1', 'The big launch', 'Our competitors'], ['The vision', 'The logo', 'The exit plan'],
];
// Phrases the saboteur's hand can't make anything of but the presenter has to (Focus Group auto-prompts).
const PANEL_SHOUTS = [
  'Does it come with a warranty?', 'I have a question about the colour.', 'Why is it so loud?', 'Can it do my taxes?', 'I’m allergic to this.',
  'Is it vegan?', 'My dog loves it.', 'This changed my life!', 'I don’t get it.', 'Can I get one for my nan?', 'Can I touch it?', 'Is it dishwasher safe?',
  'I want three.', 'It reminds me of my uncle.', 'What does it smell like?', 'Will it be on TV?',
];
// Things bot presenters "say" (a speech bubble on the TV), so a room of bots still looks alive.
const BOT_LINES = [
  'Picture this…', 'As you can clearly see…', 'And that’s not even the best part!', 'Our customers LOVE it.', 'Studies show… things.',
  'I’m so glad you asked.', 'Let me be very clear.', 'This changes everything!', 'Trust me on this one.', 'Next slide, please!',
  'Moving on…', 'No further questions!', 'It’s basically magic.', 'We’re disrupting the industry.', 'Ha ha… yes. Exactly.',
];
// Questions bot audience members send in during a Press Conference.
const BOT_ASKS = ['Is it true about the goose?', 'Who is your tailor?', 'Will you run again?', 'What did the statue say?', 'Can we see the receipts?', 'Why the hat?'];
const REACTS = ['👏', '😂', '😬', '🔥', '🍅'];

module.exports = { MODES, MODE_KEYS, TOPICS, CUES, MODE_CARDS, SLIDE_HEADS, PANEL_SHOUTS, BOT_LINES, BOT_ASKS, REACTS };
