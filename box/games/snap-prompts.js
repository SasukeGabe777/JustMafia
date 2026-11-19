'use strict';
// JustSnap content: the assignments Margo Flash hands out for each mode. All original.

// Photo Hunt: find it and frame it.
const HUNT = [
  'Something that looks like a face',
  'The most dramatic object in this room',
  'Something older than you',
  'Something that would make a terrible pillow',
  'A shoe that has seen things',
  'The most suspicious-looking plant',
  'Something that belongs in a museum',
  'The fanciest thing within ten steps of you',
  'Something that is definitely plotting against you',
  'A tiny thing that is secretly important',
  'The best texture you can find',
  'Something that looks delicious but is not food',
  'An object having a terrible day',
  'Something that could be a spaceship',
  'The loneliest object in the house',
  'A perfect circle',
  'Something with a secret',
  'The object that is most like you',
  'Two things that are clearly in love',
  'A shadow that looks like something else',
  'Something upside down that should not be',
  'The cosiest corner you can find',
  'The winner of a beauty contest for objects',
  'An everyday thing from a very strange angle',
  'Something that sparks joy',
  'A pattern that hurts your eyes (in a good way)',
  'The best reflection you can find',
  'Something way too big for its job',
  'Proof that someone was here earlier',
  'Something that would survive the end of the world',
];

// Tiny Giants: forced perspective.
const GIANTS = [
  'Make something tiny look ENORMOUS',
  'Make a person look tiny',
  'A giant monster attacks the city (any object can be the monster)',
  'Someone holding something impossible in one hand',
  'A tiny explorer on a huge adventure',
  'Something small towering over a person',
  'A friend standing somewhere they could never stand',
  'Make a cup look like a swimming pool',
  'An ordinary object as a skyscraper',
  'Someone being squished between two fingers',
];

// Scavenger Race: four of these each round.
const SCAVENGER = [
  'Something red', 'A spoon', 'Something with a number on it', 'Something soft', 'A key', 'Something round',
  'A plant or a leaf', 'Something with letters on it', 'A sock', 'Something that makes a sound', 'Something shiny',
  'Something with stripes', 'A remote control', 'Something older than ten years', 'Something blue', 'A book',
  'Something with wheels', 'A matching pair', 'Something heart-shaped (ish)', 'Something you can wear on your head',
  'A cup or a mug', 'A charging cable', 'Something with an animal on it', 'Something smaller than a coin',
  'Something that smells nice', 'Something yellow', 'A pen or a pencil', 'Something fluffy', 'Something with a button',
  'A pillow', 'Something made of wood', 'Something see-through', 'Something that bends', 'A clock (or anything that tells the time)',
  'Something green', 'A bottle', 'Something with a zip', 'Something with a face on it', 'Something sparkly', 'A hat',
];

// Close-Up Mystery: what to shoot, and wrong answers to mix in with the players' own.
const CLOSEUP = [
  'Snap an extreme close-up of something in this room',
  'Get so close that nobody can tell what it is',
  'A mystery close-up of something you touch every day',
  'A close-up of something soft, rough or bumpy',
];
const DECOYS = [
  'a toothbrush', 'a towel', 'a sock', 'the carpet', 'a sofa cushion', 'a phone case', 'a keyboard', 'a jumper sleeve',
  'a wooden table', 'a plant leaf', 'a lampshade', 'a hairbrush', 'a dog', 'an orange', 'a bread roll', 'a sponge',
  'a pillow', 'a curtain', 'the sole of a shoe', 'a bath mat', 'a remote control', 'the wall', 'a cereal box',
  'a bottle cap', 'a coin', 'jeans', 'a teddy bear', 'a doormat', 'a candle', 'a book cover', 'a fingertip', 'an ear',
];

// Colour Match: fill the frame with this colour.
const COLOURS = [
  { name: 'Tomato Red', hex: '#e63946' }, { name: 'Sunshine Yellow', hex: '#ffd23f' }, { name: 'Ocean Blue', hex: '#1f6fd1' },
  { name: 'Leaf Green', hex: '#3aa655' }, { name: 'Grape Purple', hex: '#7b3fb5' }, { name: 'Tangerine', hex: '#ff8c1a' },
  { name: 'Bubblegum Pink', hex: '#ff6fb5' }, { name: 'Sky Blue', hex: '#6ec6ff' }, { name: 'Chocolate Brown', hex: '#6b3e1f' },
  { name: 'Mint', hex: '#7fe0b4' }, { name: 'Teal', hex: '#11999e' }, { name: 'Lemon Lime', hex: '#c6e83a' },
];

// Selfie Faces: everyone acts out a different secret one.
const SELFIE = [
  'You just heard your own voice on a recording', 'You stepped on a toy brick', 'You just won the lottery',
  'Someone ate your leftovers', 'You smelled something mysterious', 'You remembered something embarrassing from years ago',
  'You are a cat who just knocked a glass off the table', 'You are trying very hard not to sneeze', 'Your phone is on 1%',
  'You saw a spider, and it saw you', 'You are a proud parent at a school play', 'You just bit into a lemon',
  'You are a villain revealing your evil plan', 'You are pretending to understand a joke', 'The pizza will be forty minutes late',
  'You are a pirate who just spotted treasure', 'You are a robot learning to smile', 'You hear the ice cream van',
  'You just woke up from a three-hour nap', 'You are a supermodel in a windstorm', 'Someone just said "we need to talk"',
  'You found money in an old coat', 'You are a ghost who is bad at scaring people', 'You are judging a baking contest',
  'You are a newsreader and the autocue just broke', 'You stubbed your toe but you have guests', 'You are an action hero in slow motion',
  'Your favourite song just came on', 'You are a detective who has it all figured out', 'You are a baby tasting food for the first time',
];

// Caption This: what to shoot, and the bots' captions.
const CAPTION = [
  'Snap something that is begging for a caption',
  'Snap a scene that looks like the middle of a story',
  'Snap an object that looks like it has feelings',
  'Stage the most dramatic photo you can in one minute',
];
const BOT_CAPTIONS = [
  'When the Wi-Fi drops for one second', 'Me pretending I did not hear the alarm', 'This is fine. Everything is fine.',
  'Day 47: they still suspect nothing', 'When someone says "quick question"', 'Living my best life, apparently',
  'The face of someone who ate the last biscuit', 'I came here to have a good time', 'Plot twist: it was the cat all along',
  'Not my proudest moment', 'Waiting for my coffee to kick in', 'Unpopular opinion incoming',
];

// Spot the Change: a hint for what to change.
const CHANGE = [
  'Snap a scene, move ONE small thing, then snap it again from the same spot',
  'Snap a scene, take ONE thing away, then snap it again from the same spot',
  'Snap a scene, add ONE sneaky thing, then snap it again from the same spot',
  'Snap a scene, swap ONE thing for something else, then snap it again from the same spot',
];

// Alphabet Hunt: letters that work around a house, and the bots' words.
const LETTERS = 'ABCDEFGHIKLMNOPRSTUW'.split('');
const WORDS = {
  A: ['apple', 'armchair', 'alarm clock'], B: ['book', 'banana', 'blanket'], C: ['cup', 'cushion', 'charger'], D: ['door', 'dice', 'duck'],
  E: ['egg', 'envelope', 'earphones'], F: ['fork', 'fridge', 'flower'], G: ['glass', 'glove', 'guitar'], H: ['hat', 'hairbrush', 'headphones'],
  I: ['ice cube', 'ironing board', 'ink pen'], K: ['key', 'kettle', 'keyboard'], L: ['lamp', 'lemon', 'laptop'], M: ['mug', 'mirror', 'magazine'],
  N: ['notebook', 'napkin', 'necklace'], O: ['orange', 'oven glove', 'onion'], P: ['pillow', 'plant', 'pen'], R: ['remote', 'rug', 'ruler'],
  S: ['sock', 'spoon', 'scissors'], T: ['towel', 'toothbrush', 'teapot'], U: ['umbrella', 'unicorn toy', 'USB stick'], W: ['watch', 'wallet', 'window'],
};

// Team Recreate: one scene, every team stages it.
const SCENES = [
  'A very serious band photo for an album nobody asked for',
  'A dramatic movie poster: one hero, one villain, one explosion (a cushion counts)',
  'A cooking show where everything has gone wrong',
  'A nature documentary: a rare creature spotted in the wild (the creature is one of you)',
  'A superhero team on their very first day',
  'An old-fashioned family portrait where nobody is allowed to smile',
  'A crime scene, and someone is clearly the suspect',
  'A fashion shoot using only things from the kitchen',
  'The moment a team wins the championship',
  'A spooky ghost photo that is definitely real',
  'A trading card for a sport that does not exist',
  'A wedding photo between two objects',
];
const TEAMS = [
  { name: 'Team Flash', color: '#ff4f6d' }, { name: 'Team Zoom', color: '#3fa7ff' }, { name: 'Team Focus', color: '#ffc43d' },
  { name: 'Team Shutter', color: '#4fd18b' }, { name: 'Team Lens', color: '#b07cff' }, { name: 'Team Pixel', color: '#ff8a3d' },
  { name: 'Team Tripod', color: '#2ed3c6' }, { name: 'Team Negative', color: '#e2e2e2' },
];

module.exports = { HUNT, GIANTS, SCAVENGER, CLOSEUP, DECOYS, COLOURS, SELFIE, CAPTION, BOT_CAPTIONS, CHANGE, LETTERS, WORDS, SCENES, TEAMS };
