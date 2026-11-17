'use strict';
// Letter Rush categories: all original. Each theme has a family list (all ages) and a party
// list (grown-up silliness, still clean). Theme rounds draw every category from one theme.
const THEMES = {
  food: {
    name: 'Food & Drink', icon: '🍕',
    family: ['A fruit', 'A vegetable', 'A pizza topping', 'Something you put on toast', 'A breakfast food', 'A type of candy', 'An ice cream flavor',
      'A sandwich filling', 'Something you eat with a spoon', 'Something crunchy', 'A drink', 'Something you cook on a grill', 'A snack food', 'Something sour',
      'A food that is usually red', 'A dessert', 'Something you dip food in', 'A soup', 'A kind of pasta', 'Something in a lunchbox', 'Something sold at a bakery',
      'A food you eat with your hands', 'Something you bring to a picnic', 'A spice or herb', 'Something you sprinkle on food', 'A food at a fair', 'Something served at a birthday party'],
    party: ['A food you’d eat at 2 a.m.', 'Something you should never put in a smoothie', 'A fancy-sounding dish', 'A terrible ice cream flavor',
      'Something you’d sneak into a movie theater', 'A food that’s fun to say', 'A food that ruins a first date', 'A guilty-pleasure snack', 'Something at an all-you-can-eat buffet'],
  },
  screen: {
    name: 'Movies & TV', icon: '🎬',
    family: ['A cartoon character', 'A movie with an animal in it', 'A superhero', 'A TV show', 'A movie villain', 'Something in a movie theater',
      'A wizard, witch or magician', 'A one-word movie title', 'A kids’ show', 'A sidekick', 'A princess or prince', 'A robot from a movie or show', 'A movie set in space',
      'Something you see in cartoons', 'Something on a game show', 'An animated movie', 'A famous monster', 'A talking animal character', 'A sequel', 'A holiday movie',
      'A character who wears a hat', 'A movie with a song you know'],
    party: ['A show you’d binge in one weekend', 'A movie that made you cry', 'Something that happens on reality TV', 'A title for a terrible sequel',
      'A celebrity you’d invite to dinner', 'Something you yell at the TV', 'A movie that’s better than the book', 'A famous catchphrase', 'A made-up action movie title'],
  },
  animals: {
    name: 'Animals', icon: '🐾',
    family: ['An animal', 'A bird', 'A sea creature', 'An insect or bug', 'A pet', 'A farm animal', 'A dog breed', 'An animal at the zoo', 'Something with wings',
      'An animal with stripes or spots', 'A jungle animal', 'Something that lives in a pond', 'A baby animal', 'An animal sound', 'Something with a shell', 'A reptile',
      'An animal that comes out at night', 'An animal faster than you', 'A name for a cat', 'A name for a dog', 'An animal that lives in the cold', 'Something with a tail',
      'A mythical creature'],
    party: ['An animal that would be a bad roommate', 'An animal you could beat in a race', 'A great name for a goldfish', 'An animal that would make a great boss',
      'Something a raccoon would steal', 'An animal with main-character energy', 'An animal you’d want as a team mascot', 'A pet that would ruin your couch'],
  },
  home: {
    name: 'Around the House', icon: '🏠',
    family: ['Something in a kitchen', 'Something in a bathroom', 'Something in a bedroom', 'Something in a garage', 'A piece of furniture', 'A household chore',
      'Something in a junk drawer', 'Something that plugs into the wall', 'Something in a fridge', 'A cleaning tool', 'Something on a desk', 'Something under the couch cushions',
      'A kitchen gadget', 'Something with a lid', 'Something in a backyard', 'Something with buttons', 'Something you can fold', 'A room in a house', 'Something on a bookshelf',
      'A noise you hear at night', 'Something in a toolbox', 'Something you keep in a closet'],
    party: ['An excuse for not doing the dishes', 'Something you hide when guests come over', 'Something in a messy car', 'A weird thing to keep in the freezer',
      'Something your landlord wouldn’t like', 'A terrible housewarming gift', 'Something you lose every single day', 'Something you’d grab if the house were on fire'],
  },
  places: {
    name: 'Places & Travel', icon: '🗺️',
    family: ['A country', 'A city', 'A US state', 'A vacation spot', 'Something in an airport', 'A tourist attraction', 'A body of water', 'A place in town',
      'Something you pack in a suitcase', 'A kind of store', 'Something at the beach', 'Something at a campsite', 'A capital city', 'A place where you have to be quiet',
      'Something you can ride', 'A vehicle', 'Something at an amusement park', 'A famous building or landmark', 'Something in a hotel room', 'A place with lots of stairs',
      'Something on a map', 'A language'],
    party: ['A terrible honeymoon destination', 'A place you should never take a first date', 'Something in a hotel lost and found', 'A place to hide from your problems',
      'Something that goes wrong on a road trip', 'A souvenir nobody wants', 'Somewhere you’d go if you won the lottery', 'Something you always overpack'],
  },
  sports: {
    name: 'Sports & Games', icon: '🏆',
    family: ['A sport', 'A board game', 'A card game', 'Something you throw', 'Something with a ball', 'An Olympic event', 'A playground game', 'Something you wear for sports',
      'A team name or mascot', 'Something you kick', 'A water activity', 'Something at a gym', 'Something a referee says', 'A video game', 'A winter activity', 'A dance move',
      'Something you do at a sleepover', 'A hobby', 'Something in a toy box', 'A party game', 'A prize you win at a fair', 'A trick on a skateboard or bike'],
    party: ['A sport that should be in the Olympics', 'A ridiculous trophy', 'A victory celebration move', 'Something you yell at a sports game', 'An excuse for losing',
      'A sport you’d be worst at', 'A rule you’d add to a board game', 'A terrible team name'],
  },
  music: {
    name: 'Music', icon: '🎵',
    family: ['A musical instrument', 'A song title', 'A singer or band', 'A type of music', 'Something at a concert', 'Something you hear in the morning', 'Something loud',
      'A holiday song', 'A sound effect', 'A dance', 'Something in a marching band', 'A song from a movie', 'A famous musician', 'Something that makes noise',
      'Something quiet', 'A word that rhymes with “go”', 'A word that rhymes with “day”', 'A word in a song chorus'],
    party: ['A karaoke song you’d crush', 'A band name for this group', 'A song to play at a wedding', 'A song that gets stuck in your head', 'A terrible boy band name',
      'Something a rock star demands backstage', 'A breakup song', 'An instrument you’d play badly'],
  },
  people: {
    name: 'People & Jobs', icon: '🧑‍🍳',
    family: ['A job', 'A boy’s name', 'A girl’s name', 'A famous person', 'Someone who works in a hospital', 'Someone who works in a school', 'A relative',
      'A historical figure', 'Someone who wears a uniform', 'A famous inventor', 'A nickname', 'Someone at a wedding', 'A royal title', 'A job that needs a special hat',
      'A job you can do from home', 'A fairy tale character', 'A famous athlete', 'Someone who works at night', 'Something a doctor says', 'Something a teacher says',
      'Someone you’d call for help'],
    party: ['A job you’d be terrible at', 'A celebrity’s first name', 'Something your mom always says', 'A name for a pirate', 'A reason to call your best friend',
      'A villain’s first name', 'A name for a robot butler', 'Something a toddler would say'],
  },
  nature: {
    name: 'Nature & Science', icon: '🌿',
    family: ['A flower', 'A tree', 'Something in the sky', 'Something in space', 'A type of weather', 'Something in a forest', 'A planet or star', 'A rock or gem',
      'Something that grows', 'Something hot', 'Something cold', 'A color', 'Something green', 'Something blue', 'Something round', 'Something in the ocean',
      'Something that melts', 'A natural disaster', 'A chemical element', 'A body part', 'Something you see on a hike', 'Something that glows', 'A shape'],
    party: ['A name for a new planet', 'A weird thing to find on a hike', 'Something that smells amazing', 'Something that smells terrible', 'A weather word for your mood',
      'Something sticky', 'Something you’d bring to Mars', 'Something secretly a little scary'],
  },
  school: {
    name: 'School & Words', icon: '📚',
    family: ['A school subject', 'Something in a backpack', 'Something in a classroom', 'A word with double letters', 'A three-letter word', 'A word that describes a person',
      'A compound word', 'An action word', 'Something you read', 'A book title', 'A famous author', 'Something in a library', 'Something you write with',
      'A word that means “big”', 'A word that means “happy”', 'A word to describe food', 'Something on a test', 'A word ending in “-ing”', 'A school club or team',
      'Something in the cafeteria', 'A science word', 'A math word'],
    party: ['A creative excuse for late homework', 'A word you can’t spell without checking', 'A fancy word that sounds smart', 'A made-up word everyone should use',
      'Something you doodle in a meeting', 'Something you got in trouble for', 'A title for your autobiography', 'A class they teach at clown college'],
  },
  stuff: {
    name: 'Things & Stuff', icon: '🧸',
    family: ['A toy', 'Something soft', 'Something sharp', 'Something heavy', 'Something people collect', 'Something made of wood', 'Something made of metal',
      'Something with wheels', 'Something you wear on your head', 'Something you wear on your feet', 'Something in a wallet or purse', 'A piece of clothing',
      'Something with a zipper', 'Something you can open', 'Something shiny', 'Something that bounces', 'Something you can break', 'Something that fits in your pocket',
      'Something you can inflate', 'Something with a screen', 'A gift idea', 'Something with strings'],
    party: ['Something to bring to a deserted island', 'The worst birthday gift', 'Something to put in a time capsule', 'A useless invention', 'Something sold at a yard sale',
      'Something in a magician’s hat', 'Something you’d protect with your life', 'Something you’d buy with play money'],
  },
  life: {
    name: 'Everyday Life', icon: '☕',
    family: ['A reason to be late', 'Something you do in the morning', 'A way to say hello', 'Something that makes you laugh', 'Something to do on a rainy day', 'A holiday',
      'Something you do on the weekend', 'A gift for a grandparent', 'Something that’s hard to do', 'Something you say when surprised', 'Something people are afraid of',
      'A reason to celebrate', 'Something people wait in line for', 'A New Year’s resolution', 'Something you do before bed', 'A birthday party theme',
      'A way to get around town', 'Something expensive', 'Something that is free', 'Something you do when you’re bored', 'A compliment', 'Something you say to a baby'],
    party: ['An excuse for not texting back', 'A sign you’re getting old', 'Something you’d never say on a first date', 'A bad reason to quit your job', 'A reason to call in sick',
      'Something you do when no one is watching', 'A secret talent', 'Something overrated', 'A dramatic way to leave a party', 'A terrible password',
      'Something you say to win an argument', 'Something you pretend to understand'],
  },
};

// Flat list: { t: text, th: theme key, p: party? }
const CATS = [];
for (const [th, T] of Object.entries(THEMES)) {
  for (const t of T.family) CATS.push({ t, th, p: false });
  for (const t of T.party) CATS.push({ t, th, p: true });
}

module.exports = { THEMES, CATS };
