'use strict';
// Act It Out prompts: all original. `family` is for all ages; `party` is grown-up but still
// clean (awkward moments, nights out, office life). A prompt is 'Shown text|other answer|…':
// everything after a | is also accepted as a correct guess (the fuzzy matcher handles typos,
// plurals, verb forms and common synonyms on top of that).
const CATS = {
  movie: { icon: '🎬', label: 'Movie title' },
  action: { icon: '🏃', label: 'Action' },
  animal: { icon: '🐾', label: 'Animal' },
  job: { icon: '💼', label: 'Job' },
  disaster: { icon: '💥', label: 'Everyday disaster' },
  emotion: { icon: '😮', label: 'Feeling' },
  sport: { icon: '⚽', label: 'Sport or game' },
  awkward: { icon: '😬', label: 'Awkward moment' },
};

const family = {
  movie: [
    'The Haunted Toaster', 'Attack of the Giant Hamster', 'Grandma Goes to Space', 'The Last Pancake', 'Revenge of the Lawn Gnomes',
    'Snowman on Vacation', 'The Dog Who Could Fly', 'Pirates of the Bathtub', 'Night of the Sneezing Dragon', 'The Invisible Babysitter',
    'Robot Learns to Dance', 'The Great Cookie Heist', 'Escape from the Ball Pit', 'Ninja Chefs', 'The Shrinking Teacher',
    'Dinosaur Prom', 'Mystery of the Missing Sock', 'Cowboys versus Penguins', 'The Upside-Down Wedding', 'Space Llamas',
    'Bigfoot Goes Shopping', 'The Ice Cream Volcano', 'Return of the Rubber Duck', 'The Very Loud Library', 'Wizard School Dropout',
    'Planet of the Puppies', 'The Sleepwalking Knight', 'Zombie Ballet', 'Detective Hamster', 'The Runaway Bus',
    'Mermaid in the Swimming Pool', 'The Clumsy Superhero', 'Alien Birthday Party', 'Monster Under the Fridge', 'The Vampire Dentist',
    'The Pizza That Ate the City', 'Kung Fu Kittens', 'Lost in the Car Wash', 'The Magic Shopping Cart', 'Captain Spaghetti',
    'Goldfish on the Run', 'The Ghost Who Was Afraid of the Dark',
  ],
  action: [
    'Brushing a lion’s teeth|brushing lion teeth', 'Walking a very big dog|walking a dog|dog walking', 'Building a sandcastle', 'Juggling', 'Changing a flat tire|flat tyre',
    'Riding a unicycle', 'Washing an elephant', 'Flipping pancakes', 'Climbing a mountain', 'Making a snow angel',
    'Blowing up a balloon', 'Painting a fence', 'Knitting a scarf|knitting', 'Catching a fish', 'Wrapping a present',
    'Ironing a shirt|ironing', 'Milking a cow', 'Taking a selfie', 'Carrying a wedding cake', 'Doing a magic trick|magic trick',
    'Walking on a tightrope|tightrope walking', 'Rowing a boat', 'Building a snowman', 'Eating spaghetti', 'Hailing a taxi',
    'Making a pizza', 'Picking apples', 'Planting a tree', 'Opening a stuck jar|opening a jar', 'Making popcorn',
    'Feeding the ducks|feeding ducks', 'Directing traffic', 'Climbing a ladder', 'Mopping the floor|mopping', 'Playing the drums|drumming',
    'Playing the violin', 'Conducting an orchestra', 'Sneaking past a sleeping dog', 'Rocking a baby to sleep', 'Brushing a horse',
    'Washing the car|car wash', 'Peeling a banana', 'Chopping onions', 'Taking a bubble bath|taking a bath', 'Doing the laundry|laundry',
    'Blowing out birthday candles', 'Sewing on a button|sewing', 'Flying a kite', 'Reading a scary book', 'Shoveling snow|shovelling snow',
    'Setting up a tent|pitching a tent', 'Watering the plants|watering plants', 'Baking a cake', 'Brushing your teeth', 'Putting on tight jeans',
  ],
  animal: [
    'Penguin', 'Kangaroo', 'Octopus', 'Flamingo', 'Sloth', 'Gorilla', 'Giraffe', 'Crab', 'Snake', 'Elephant',
    'Peacock', 'Chicken|hen', 'Frog', 'Shark', 'Owl', 'Bat', 'Squirrel', 'Turtle|tortoise', 'Jellyfish', 'Dolphin',
    'Rabbit|bunny', 'Horse', 'Cat', 'Dog', 'Lion', 'Monkey', 'Bear', 'Crocodile|alligator', 'Bee', 'Butterfly',
    'Spider', 'Duck', 'Seal', 'Ostrich', 'Camel', 'Hedgehog', 'Woodpecker', 'Cheetah', 'Pig', 'Goat',
    'Moose', 'Walrus', 'Hamster', 'Snail', 'Eagle', 'T. rex|t rex|tyrannosaurus|dinosaur',
  ],
  job: [
    'Dentist', 'Firefighter', 'Lifeguard', 'Chef|cook', 'Mail carrier|postman|mailman|postal worker', 'Pilot', 'Astronaut', 'Hairdresser|barber|hair stylist', 'Magician',
    'Police officer|policeman|cop', 'Teacher', 'Doctor', 'Farmer', 'Plumber', 'Waiter|waitress|server', 'Photographer', 'Painter|artist',
    'Construction worker|builder', 'Zookeeper', 'Clown', 'Detective', 'Librarian', 'Scientist', 'Taxi driver|cab driver', 'Ballet dancer|ballerina',
    'Opera singer', 'Rock star', 'Judge', 'Lumberjack', 'Window cleaner|window washer', 'Surgeon', 'Weather reporter|weatherman|weather forecaster',
    'Tour guide', 'Gardener', 'Mechanic', 'Pizza delivery driver|pizza delivery', 'Bus driver', 'Referee', 'Mime', 'Lion tamer',
  ],
  disaster: [
    'Stepping on a toy brick|stepping on lego', 'Dropping your phone in the toilet|phone in the toilet', 'Locked out of the house|locked out', 'Burning the toast|burnt toast', 'Spilling coffee on yourself|spilling coffee',
    'Missing the bus', 'Ice cream falling off the cone|dropping ice cream', 'Gum stuck in your hair', 'Stubbing your toe', 'Umbrella blowing inside out|umbrella inside out',
    'Tripping on the stairs|falling down the stairs', 'Forgetting your homework', 'Phone battery dying|dead phone', 'A bird pooping on your head|bird poop', 'Sitting on wet paint',
    'Brain freeze', 'A bee in the car', 'Losing your car keys|lost keys', 'Ripping your pants|ripped pants', 'Stuck in a revolving door',
    'Waking up late|oversleeping|overslept', 'Running out of toilet paper', 'Shopping bag breaking|bag breaking', 'Caught in the rain', 'A spider on your pillow',
    'Hiccups that won’t stop|hiccups', 'Biting your tongue', 'Stuck in an elevator|stuck in a lift', 'Slipping on a banana peel', 'Kite stuck in a tree',
    'Sour milk', 'Splashed by a car|splashed by a puddle', 'Tangled headphones|tangled earphones', 'Sunburn', 'Car alarm going off|car alarm',
    'Stuck in a traffic jam|traffic jam', 'Paper cut', 'Burning your tongue on hot soup|hot soup', 'Shampoo in your eyes|soap in your eyes', 'Sneezing in a quiet room',
  ],
  emotion: [
    'Embarrassed', 'Jealous', 'Terrified', 'Excited', 'Bored', 'Grumpy', 'Confused', 'Proud', 'Nervous', 'Surprised',
    'Disgusted', 'Lonely', 'Sleepy', 'Furious', 'Heartbroken', 'In love', 'Hungry', 'Guilty', 'Shy', 'Relieved',
    'Overjoyed', 'Impatient', 'Suspicious', 'Ticklish', 'Dizzy',
  ],
  sport: [
    'Surfing', 'Bowling', 'Karate', 'Golf', 'Fishing', 'Skateboarding', 'Ice skating', 'Skiing', 'Boxing', 'Archery',
    'Yoga', 'Basketball', 'Tennis', 'Swimming', 'Weightlifting|lifting weights', 'Fencing', 'Rock climbing', 'Horse riding|horseback riding', 'Baseball', 'Hula hoop|hula hooping',
    'Limbo', 'Tug of war', 'Hopscotch', 'Jump rope|skipping rope|skipping', 'Sumo wrestling|sumo', 'Bungee jumping', 'Gymnastics', 'Hide and seek', 'Musical chairs', 'Scuba diving',
    'Table tennis|ping pong', 'Badminton',
  ],
};

const party = {
  movie: [
    'The Accountant Who Danced', 'Revenge of the Group Chat', 'Honeymoon in a Tent', 'Brunch of the Living Dead', 'Karaoke Kings',
    'My Boss Is a Vampire', 'The Awkward Reunion', 'Speed Dating with Ghosts', 'Night Shift at the Wax Museum', 'Ten Cats and a Wedding',
    'Lost in the Mall Parking Lot', 'The Office Plant Strikes Back', 'Mother-in-Law from Mars', 'The Last Slice of Pizza', 'Gym Membership of Doom',
  ],
  action: [
    'Singing karaoke badly|bad karaoke|karaoke', 'Slow dancing at a wedding|slow dance', 'Assembling flat-pack furniture|building furniture', 'Parallel parking', 'Doing your taxes|taxes',
    'Pretending to know about wine|wine tasting', 'Sneaking in late at night|sneaking in late', 'Working from home in pajamas|working from home', 'Hiding from the neighbor|hiding from the neighbour', 'Taking a group photo',
    'Leading a conga line|conga line', 'Splitting the bill', 'Giving a wedding toast|wedding speech', 'Microwaving fish at the office', 'Laughing at the boss’s joke',
    'Online shopping at midnight|online shopping', 'Unclogging a sink', 'Trying to fold a fitted sheet|folding a fitted sheet', 'Pretending to work when the boss walks by', 'Carrying all the groceries in one trip',
  ],
  awkward: [
    'Waving at someone who wasn’t waving at you', 'Hitting reply all by accident|reply all', 'Forgetting someone’s name', 'Calling your teacher Mom', 'Walking into a glass door',
    'Talking while on mute|on mute', 'Tripping on a first date', 'Texting the wrong person', 'Showing up to the wrong party', 'Seeing your ex at the supermarket|seeing your ex',
    'Caught singing in the car', 'Falling asleep in a meeting', 'Spilling juice on a white couch', 'Accidentally liking an old photo', 'Your card getting declined|card declined',
    'Being the only one in costume', 'Hugging someone who wanted a handshake|hug or handshake', 'Saying “you too” when the waiter says enjoy your meal|you too', 'Lost in a giant furniture store', 'Forgetting your lines on stage',
    'Locked out in your bathrobe',
  ],
  job: [
    'Wedding planner', 'Bouncer', 'Personal trainer', 'Life coach', 'DJ|disc jockey', 'Stunt double|stuntman', 'Reality TV star', 'Influencer',
    'Bartender', 'Accountant', 'Fortune teller', 'Lawyer', 'Wedding singer', 'Cat sitter', 'Air traffic controller',
  ],
  emotion: ['Hangry', 'Starstruck', 'Smug', 'Awkward', 'Sore after the gym|sore', 'Food coma'],
};

// Flat lists: { text, answers, cat, party }
function flatten(src, isParty) {
  const out = [];
  for (const [cat, list] of Object.entries(src)) for (const raw of list) {
    const parts = raw.split('|').map((s) => s.trim()).filter(Boolean);
    out.push({ text: parts[0], answers: parts, cat, party: isParty });
  }
  return out;
}
const FAMILY = flatten(family, false), PARTY = flatten(party, true), ALL = FAMILY.concat(PARTY);

// "Act it as…" styles.
const STYLES = [
  { k: 'slow', icon: '🐢', label: 'in slow motion' },
  { k: 'robot', icon: '🤖', label: 'as a robot' },
  { k: 'doc', icon: '🎙️', label: 'like a nature documentary' },
  { k: 'soap', icon: '💔', label: 'as a dramatic soap opera' },
  { k: 'sleepy', icon: '😴', label: 'while very sleepy' },
  { k: 'opera', icon: '🎶', label: 'as a grand opera' },
  { k: 'cowboy', icon: '🤠', label: 'like a cowboy' },
  { k: 'underwater', icon: '🫧', label: 'underwater' },
  { k: 'toddler', icon: '👶', label: 'as a toddler' },
  { k: 'hurry', icon: '⏩', label: 'in a huge hurry' },
  { k: 'hero', icon: '🦸', label: 'like a superhero' },
  { k: 'villain', icon: '🦹', label: 'like a movie villain' },
  { k: 'tiny', icon: '🐭', label: 'as a tiny mouse' },
  { k: 'cold', icon: '🥶', label: 'while freezing cold' },
];

module.exports = { CATS, FAMILY, PARTY, ALL, STYLES };
