'use strict';
// Emoji Charades content: the secret answers (original list) and the emoji keyboard.
//
// ANSWERS: one per line, "Answer | difficulty 1-3 | a hand-written emoji clue (bots use it;
// "│" = word break) | optional alternate answers separated by ;".
// KEYBOARD: one emoji per line with search words. The phone keyboard (public/box/games/emoji.js)
// carries an identical copy of KEYBOARD_TEXT; tools/test-box-emoji.js checks they match.

const CATEGORIES = [
  { key: 'movies', label: 'Movies & TV', icon: '🎬' },
  { key: 'animals', label: 'Animals', icon: '🐾' },
  { key: 'food', label: 'Food & Drink', icon: '🍔' },
  { key: 'jobs', label: 'Jobs', icon: '👷' },
  { key: 'places', label: 'Places', icon: '🗺️' },
  { key: 'phrases', label: 'Sayings & Phrases', icon: '💬' },
  { key: 'sports', label: 'Sports & Games', icon: '🏆' },
  { key: 'party', label: 'Party Stuff', icon: '🎉' },
];

const ANSWER_TEXT = {
  movies: `
The Lion King | 1 | 🦁 👑
Finding Nemo | 1 | 🔍 🐠
Jaws | 1 | 🦈 👄
Titanic | 1 | 🚢 ❄️ 💔
Frozen | 1 | ❄️ ⛄ 👸
Star Wars | 1 | ⭐ ⚔️
Harry Potter | 1 | 🧙 👓 ⚡
Toy Story | 1 | 🧸 📖
Jurassic Park | 1 | 🦖 🏝️ 🎢
Ghostbusters | 1 | 👻 🚫
Spider-Man | 1 | 🕷️ 👨 | spiderman; spider man
Batman | 1 | 🦇 👨 | the batman
Back to the Future | 2 | ⬅️ 🚗 ⏰
Pirates of the Caribbean | 2 | 🏴‍☠️ 🏝️ 🚢
The Wizard of Oz | 2 | 🧙 🌪️ 👠
Beauty and the Beast | 2 | 👸 🌹 👹 | beauty & the beast
Shrek | 1 | 👹 🧅
Home Alone | 1 | 🏠 👦 🎄
Up | 2 | 🎈 🏠 ⬆️
Cars | 1 | 🏎️ 🚗
Inside Out | 2 | 🧠 😡 😭 😊
Ratatouille | 2 | 🐭 👩‍🍳 🍝
Monsters, Inc. | 2 | 👹 🚪 😱 | monsters inc; monsters incorporated
The Little Mermaid | 1 | 🧜 🌊
Aladdin | 1 | 🧞 🏜️ ✨
Snow White | 1 | ❄️ 🍎 👸 | snow white and the seven dwarfs
Cinderella | 1 | 👸 👠 🎃
Kung Fu Panda | 1 | 🐼 🥋
Jumanji | 2 | 🎲 🐘 🌴
Top Gun | 2 | 🔝 🔫 ✈️
Squid Game | 1 | 🦑 🎮
Stranger Things | 2 | 🔦 👦 🚲 👹
The Simpsons | 2 | 🍩 📺 👨 | simpsons
Breaking Bad | 3 | 🧪 👨 😈
Game of Thrones | 2 | 👑 🪑 🐉 ⚔️
The Godfather | 3 | 👴 🔫 🌹 | godfather
Star Trek | 3 | ⭐ 🚀 👽
Mission: Impossible | 3 | 🕵️ 💣 🚫 | mission impossible
Men in Black | 2 | 👨 🕶️ 👽 | mib
The Matrix | 3 | 💻 🕶️ 💊 | matrix
Fast and Furious | 2 | 🏎️ 💨 😡 | fast & furious; the fast and the furious
Avatar | 2 | 👽 🌲
Ice Age | 2 | ❄️ 🐘 ⏳
Planet of the Apes | 2 | 🌍 🦍
Night at the Museum | 2 | 🌃 🦖 🗿
The Hunger Games | 2 | 🏹 🔥 🎯 | hunger games
Charlie and the Chocolate Factory | 2 | 👦 🍫 🎟️ | willy wonka
Snakes on a Plane | 1 | 🐍 ✈️
Free Willy | 1 | 🆓 🐳
The Karate Kid | 2 | 🥋 👦 | karate kid
Rocky | 2 | 🥊 🏆
Coco | 2 | 💀 🎸 🎶
Moana | 2 | 🌊 🏝️ 🛶
Sharknado | 2 | 🦈 🌪️
Dumbo | 1 | 🐘 👂 ✈️
Bambi | 1 | 🦌
`,
  animals: `
Starfish | 1 | ⭐ 🐟 | sea star
Catfish | 1 | 🐱 🐟
Seahorse | 1 | 🌊 🐴 | sea horse
Polar Bear | 1 | ❄️ 🐻
Penguin | 1 | 🐧
Kangaroo | 1 | 🦘
Panda | 1 | 🐼 | giant panda
Octopus | 1 | 🐙
Goldfish | 1 | 🥇 🐟
Swordfish | 1 | 🗡️ 🐟
Bumblebee | 1 | 🐝 | bumble bee
Hamster | 1 | 🐹
Owl | 1 | 🦉
Unicorn | 1 | 🦄
Ladybug | 1 | 👩 🐛 | ladybird
Hedgehog | 2 | 🌲 🐷
Jellyfish | 2 | 🌊 🍬 🐟
Dragonfly | 2 | 🐉 ✈️
Sloth | 2 | 😴 🐌 🌲
Peacock | 2 | 🦜 ✨ 🌈
Bulldog | 2 | 🐮 🐶
Mosquito | 2 | 💉 🐛 🌙
Woodpecker | 2 | 🌲 🐦 🔨
Rattlesnake | 2 | 🐍 🔔
Bullfrog | 2 | 🐮 🐸
Killer Whale | 2 | 💀 🐳 | orca
Flying Squirrel | 2 | ✈️ 🐿️
Mountain Goat | 2 | 🏔️ 🐐
Pufferfish | 2 | 🎈 🐟 | blowfish; puffer fish
Guinea Pig | 2 | 🧪 🐷
Chameleon | 2 | 🦎 🌈
Hummingbird | 3 | 🎶 🐦 | humming bird
Silkworm | 3 | 👗 🐛 | silk worm
Honey Badger | 3 | 🍯 😡
Vampire Bat | 2 | 🧛 🦇
Sea Lion | 2 | 🌊 🦁
`,
  food: `
Hot Dog | 1 | 🔥 🐶 | hotdog
Pancakes | 1 | 🥞 | pancake
Popcorn | 1 | 🍿
Birthday Cake | 1 | 🎂
Fish and Chips | 1 | 🐟 🍟 | fish & chips; fish n chips
French Toast | 1 | 🥐 🍞
Cheeseburger | 1 | 🧀 🍔 | cheese burger
Banana Split | 1 | 🍌 ✂️
Apple Pie | 1 | 🍎 🥧
Hot Chocolate | 1 | 🔥 🍫 ☕ | hot cocoa
Fried Chicken | 1 | 🔥 🐔
Corn Dog | 1 | 🌽 🐶 | corndog
Pineapple Pizza | 1 | 🍍 🍕 | hawaiian pizza
Sushi | 1 | 🍣
Tacos | 1 | 🌮 | taco
Lemonade | 1 | 🍋 🥤
Garlic Bread | 1 | 🧄 🍞
Coffee | 1 | ☕
Toast | 1 | 🍞 🔥
Spaghetti and Meatballs | 2 | 🍝 ➕ 🐮 ⚽ | spaghetti & meatballs
Mac and Cheese | 2 | 🍝 🧀 | macaroni and cheese; mac n cheese; mac & cheese
Peanut Butter and Jelly | 2 | 🥜 🍞 🍇 | pb&j; pbj; peanut butter & jelly
Ice Cream Sundae | 2 | 🍦 🍒 | sundae
Chocolate Chip Cookie | 2 | 🍫 🍪 | chocolate chip cookies
Guacamole | 2 | 🥑 🧅 🌶️ | guac
Scrambled Eggs | 2 | 🥚 🌀 | scrambled egg
Breakfast in Bed | 2 | 🍳 🛏️
Strawberry Milkshake | 2 | 🍓 🥛 🌪️ | strawberry shake
Chicken Noodle Soup | 2 | 🐔 🍜
Cotton Candy | 2 | ☁️ 🍬 | candy floss
Gingerbread Man | 2 | 🍪 👨 🎄 | gingerbread
Candy Cane | 2 | 🍬 🎄
Pumpkin Pie | 2 | 🎃 🥧
Pickle | 2 | 🥒 🧂 | pickles
Sweet and Sour Chicken | 3 | 🍬 🍋 🐔 | sweet & sour chicken
Fortune Cookie | 3 | 🔮 🍪
`,
  jobs: `
Chef | 1 | 👩‍🍳 | cook
Doctor | 1 | 👨‍⚕️
Astronaut | 1 | 👩‍🚀
Firefighter | 1 | 👨‍🚒 | fireman; firefighters
Teacher | 1 | 👩‍🏫
Farmer | 1 | 👨‍🌾
Pilot | 1 | 👨‍✈️
Police Officer | 1 | 👮 | cop; policeman; police
Dentist | 1 | 🦷 👨‍⚕️
Clown | 1 | 🤡
Fisherman | 1 | 🎣 🚢 | fisher
Taxi Driver | 1 | 🚕 👨 | cab driver
Scientist | 1 | 🧪 🔬 | chemist
Pirate | 1 | 🏴‍☠️ 🦜
Mail Carrier | 2 | ✉️ 🏃 | mailman; postman; mail man
Plumber | 2 | 🚽 🔧
Magician | 2 | 🎩 🐰 ✨
Lifeguard | 2 | 🏖️ 🏊 🆘
DJ | 2 | 🎧 🎶 🎉 | disc jockey; deejay
Detective | 2 | 🕵️ 🔍
Lumberjack | 2 | 🪓 🌲
Barber | 2 | 💈 ✂️ | hairdresser
Banker | 2 | 🏦 💰
Photographer | 2 | 📷 👩
Zookeeper | 2 | 🦁 🔑 | zoo keeper
Beekeeper | 2 | 🐝 🔑 🍯 | bee keeper
Personal Trainer | 2 | 🏋️ 💪 | fitness trainer
Babysitter | 2 | 👶 🪑 | nanny; baby sitter
Ninja | 2 | 🥋 🤫 🗡️
Secret Agent | 2 | 🤫 🕵️ | spy
Archaeologist | 3 | 🦕 💀 🏜️
Surgeon | 3 | 🔪 💉 🏥
Weather Forecaster | 3 | 🌧️ ☀️ 📺 | weatherman; meteorologist; weather man
Tattoo Artist | 3 | 💉 🎨 💪
Rock Star | 2 | 🤘 🎸 ⭐ | rockstar
`,
  places: `
Paris | 1 | 🗼 🥐
New York | 1 | 🗽 🍎 | new york city; nyc
Hawaii | 1 | 🏝️ 🌋 🏄
Japan | 1 | 🗻 🍣 ⛩️
Italy | 1 | 🍕 🍝
Mexico | 1 | 🌮 🌵
Australia | 1 | 🦘 🐨
The Moon | 1 | 🌙 🚀 | moon
Hospital | 1 | 🏥
Library | 1 | 📚 🤫
Zoo | 1 | 🦁 🐘 🦒
Beach | 1 | 🏖️
Haunted House | 1 | 👻 🏠
Movie Theater | 1 | 🎬 🍿 | cinema; movie theatre
Gym | 1 | 🏋️ 💪
Castle | 1 | 🏰
Volcano | 1 | 🌋
Amusement Park | 1 | 🎢 🎡 🎠 | theme park; fun fair
Farm | 1 | 🐮 🐷 🐔
Egypt | 2 | 🐪 🏜️ ⚱️
Las Vegas | 2 | 🎰 💰 🎲 | vegas
Hollywood | 2 | 🎬 ⭐
London | 2 | 💂 ☔ 👑
Antarctica | 2 | 🐧 ❄️ 🌍
Desert Island | 2 | 🏜️ 🏝️
Airport | 2 | ✈️ 🎟️ ⏰
Bowling Alley | 2 | 🎳 🛣️
Water Park | 2 | 💧 🎢 🏊 | waterpark
North Pole | 2 | 🎅 ⛄ ⬆️
Rainforest | 2 | 🌧️ 🌲 🦜 | jungle; rain forest
Space Station | 2 | 🚀 🏠 ⭐
Disneyland | 2 | 🐭 🏰 🎢 | disney world; disneyworld
Mount Everest | 2 | 🏔️ 🧗 | everest
Grand Canyon | 3 | 🏜️ ⬇️ 🧭
The Bermuda Triangle | 3 | 🚢 ✈️ ❓ 🌊 | bermuda triangle
`,
  phrases: `
Piece of Cake | 1 | 🍰 | a piece of cake
Time Flies | 1 | ⏰ ✈️ | time flies when you're having fun
Couch Potato | 1 | 🛋️ 🥔
Night Owl | 1 | 🌙 🦉
Brainstorm | 1 | 🧠 🌪️ | brain storm
Heartbreak | 1 | 💔 | broken heart
Hot Potato | 1 | 🔥 🥔
Happy Birthday | 1 | 😊 🎂
Top Secret | 1 | 🔝 🤫
Rock and Roll | 1 | 🤘 🎸 | rock n roll; rock & roll
Sweet Dreams | 1 | 🍬 💭 😴
Show Me the Money | 2 | 👀 💰
Raining Cats and Dogs | 2 | 🌧️ 🐱 🐶 | it's raining cats and dogs
Break a Leg | 2 | 💥 🦵
Spill the Tea | 2 | 🍵 💦 🗣️
Cold Feet | 2 | 🥶 👣
Under the Weather | 2 | ⬇️ ☁️ 🤒
When Pigs Fly | 2 | 🐷 ✈️
Busy as a Bee | 2 | 🐝 🏃 | busy bee
Elephant in the Room | 2 | 🐘 🏠
Break the Ice | 2 | 🔨 ❄️
Head in the Clouds | 2 | 🧠 ☁️
Over the Moon | 2 | ⬆️ 🌙 😊
Cool as a Cucumber | 2 | 😎 🥒
Love at First Sight | 2 | ❤️ 1️⃣ 👀
Lost in Space | 2 | 🧭 ❌ 🚀
Big Brother | 2 | 👀 👦
Beauty Sleep | 2 | 👸 😴
Once in a Blue Moon | 3 | 1️⃣ 💙 🌙
Let the Cat Out of the Bag | 3 | 🐱 👜 ➡️
Butterflies in My Stomach | 3 | 🦋 🤢 | butterflies in your stomach; butterflies in the stomach
Bite the Bullet | 3 | 👄 🔫
Don't Cry Over Spilled Milk | 3 | 😭 🥛 💦 | cry over spilled milk; crying over spilt milk; dont cry over spilt milk
Money Doesn't Grow on Trees | 3 | 💵 🚫 🌲 | money doesnt grow on trees
The Early Bird Gets the Worm | 3 | ⏰ 🐦 🐛 | early bird gets the worm; the early bird catches the worm
Kill Two Birds with One Stone | 3 | 2️⃣ 🐦 1️⃣ 🗿 | two birds one stone
Practice Makes Perfect | 3 | 🔁 💯
I'll Be Back | 3 | 🤖 ↩️ | i will be back
`,
  sports: `
Soccer | 1 | ⚽ | football
Basketball | 1 | 🏀
Tennis | 1 | 🎾
Golf | 1 | ⛳
Bowling | 1 | 🎳
Boxing | 1 | 🥊
Skiing | 1 | 🎿 | ski
Surfing | 1 | 🏄 🌊 | surf
Ice Hockey | 1 | 🏒 ❄️ | hockey
Baseball | 1 | ⚾
Table Tennis | 1 | 🏓 | ping pong
Swimming | 1 | 🏊 | swim
Skateboarding | 1 | 🛹 | skating
Snowboarding | 1 | 🏂
Darts | 1 | 🎯 | dart
Fishing | 1 | 🎣
Cycling | 1 | 🚴 | biking; bike racing
Karate | 1 | 🥋
Archery | 2 | 🏹 🎯
Fencing | 2 | 🤺
Horse Racing | 2 | 🐴 🏁
Figure Skating | 2 | ⛸️ 💃 | ice skating
Rock Climbing | 2 | 🗿 🧗 | climbing
Gymnastics | 2 | 🤸
Weightlifting | 2 | 🏋️ | weight lifting; powerlifting
Marathon | 2 | 🏃 🏁
Sumo Wrestling | 2 | 🍚 💪 🥋 | sumo
Chess | 2 | ♟️ 👑
Tug of War | 2 | 💪 ⬅️ ➡️
Dodgeball | 2 | 🏐 💨 😱 | dodge ball
Rugby | 2 | 🏉
The Olympics | 2 | 🥇 🌍 🔥 | olympics; olympic games
Super Bowl | 2 | 🏈 🏆 | superbowl
Water Polo | 3 | 💧 🏐 🏊
Synchronized Swimming | 3 | 🏊 💃 🎶 | artistic swimming
Bungee Jumping | 3 | ⬇️ 😱 ↩️ | bungee jump
`,
  party: `
Balloon | 1 | 🎈 | balloons
Birthday Candles | 1 | 🎂 🕯️
Confetti | 1 | 🎊
Karaoke | 1 | 🎤 🎶
Dance Floor | 1 | 💃 🕺
Party Hat | 1 | 🥳 🎩
Fireworks | 1 | 🎆
Pool Party | 1 | 🏊 🎉
Board Games | 1 | 🎲 ♟️ | board game
Cupcakes | 1 | 🧁 | cupcake
Sleepover | 1 | 😴 🛏️ 🍿 | slumber party; sleep over
Hide and Seek | 1 | 🙈 🔍 | hide-and-seek; hide & seek
Cake | 1 | 🎂
Pizza Delivery | 2 | 🍕 🚗 🚪
Disco Ball | 2 | 🕺 ✨ ⚽ | mirror ball
Musical Chairs | 2 | 🎶 🪑
Charades | 2 | 🎭 🤫
Truth or Dare | 2 | ✅ ❓ 😈
Gift Wrap | 2 | 🎁 📦 | wrapping paper; gift wrapping
Photo Booth | 2 | 📷 🤪 🚪
Bouncy Castle | 2 | 🏰 🦘 | bounce house
Surprise Party | 2 | 😱 🎉
Costume Party | 2 | 🧛 🧙 🎉 | fancy dress party; costume
Glow Sticks | 2 | ✨ 🌃 | glow stick
Pillow Fight | 2 | 🛏️ ⚔️
Dance-Off | 2 | 💃 ⚔️ 🕺 | dance off; danceoff
Thank You Card | 2 | 🙏 ✉️ | thank you note; thank-you card
Goodie Bag | 2 | 🍬 👜 | goody bag; party bag
Treasure Hunt | 2 | 🗺️ 💎 🔍 | scavenger hunt
Piñata | 2 | 🐴 🍬 🔨 | pinata
Limbo | 3 | ⬇️ 🕺
Party Crasher | 3 | 🚫 🎟️ 🎉 | gatecrasher; party pooper
Spin the Bottle | 3 | 🌀 🍺 😘
Conga Line | 3 | 💃 🚂 🎶
`,
};

// The emoji keyboard. Each line: the emoji, then search words.
const KEYBOARD_TEXT = {
  faces: `
😀 grin happy smile
😂 laugh tears lol funny joke
🤣 rofl laugh rolling
😊 blush happy smile nice
😍 love heart eyes crush
🥰 love adore hearts
😘 kiss love
😎 cool sunglasses
🤓 nerd geek smart glasses
🤔 think thinking hmm question
🤨 suspicious doubt eyebrow
😐 neutral meh blank
🙄 eyeroll bored whatever
😴 sleep tired zzz asleep
🤤 drool hungry yum
😷 sick mask doctor
🤒 sick fever ill thermometer
🤢 nausea gross sick green
🤮 vomit sick puke
🥵 hot heat sweat
🥶 cold freeze frozen winter
🤯 mind blown explode shock
🥳 party celebrate birthday
😱 scream scared horror fear
😭 cry sob sad tears
😡 angry mad rage
🤬 swear curse angry
😈 devil evil horns
👿 imp devil angry
💀 skull dead death skeleton
☠️ pirate skull crossbones poison
👻 ghost boo spooky halloween
👽 alien ufo space
🤖 robot machine ai
💩 poop
🤡 clown circus
👹 ogre monster beast
🎃 pumpkin halloween lantern
😺 cat smile
🙈 monkey see hide
🙉 monkey hear
🙊 monkey speak secret
😇 angel halo innocent
🤠 cowboy hat western
🤫 shush quiet secret
🤐 zip mouth secret silent
😬 grimace awkward
😏 smirk sly
🥺 pleading puppy eyes please
😳 flushed embarrassed shock
🤑 money rich dollar
🤪 crazy zany silly
😜 wink tongue silly
🤧 sneeze cold tissue
😵 dizzy
🧐 monocle detective inspect
🗣️ speak talk shout gossip
`,
  people: `
👶 baby child
👧 girl
👦 boy kid
👩 woman lady
👨 man guy
👵 grandma old woman granny
👴 grandpa old man
👮 police cop officer law
🕵️ detective spy sleuth
💂 guard soldier
👷 builder construction worker
🤴 prince royal
👸 princess queen royal
🧙 wizard magic witch mage
🧚 fairy magic
🧛 vampire dracula
🧟 zombie undead
🧜 mermaid sea
🦸 superhero hero
🦹 villain supervillain
🧞 genie wish lamp
🎅 santa christmas
🤶 mrs claus christmas
👩‍🍳 chef cook kitchen
👨‍⚕️ doctor health nurse
👩‍🚀 astronaut space
👨‍🚒 firefighter fireman
👩‍🏫 teacher school
👨‍🌾 farmer farm
👩‍🎤 singer rock star
👨‍🎨 artist painter
👩‍💻 coder programmer computer
👨‍✈️ pilot plane captain
👰 bride wedding
🤵 groom tuxedo wedding
🤰 pregnant mom mother
💃 dance dancer woman salsa
🕺 dance disco man
🏃 run runner
🚶 walk
🧘 yoga meditate
🏊 swim swimmer pool
🏄 surf surfer
🧗 climb climber
🤷 shrug dunno
🙋 raise hand hi
🤦 facepalm
🙏 pray please thanks
👋 wave hello bye hi
👍 thumbs up yes good like
👎 thumbs down no bad
👏 clap applause
💪 strong muscle flex arm
✌️ peace victory two
🤞 fingers crossed luck
🤘 rock metal horns
🤝 handshake deal
👀 eyes look see watch
👂 ear hear listen
👃 nose smell
👄 mouth lips kiss
🦷 tooth teeth dentist
🦵 leg kick
🧠 brain smart mind
👣 footprints feet walk
`,
  animals: `
🐶 dog puppy
🐱 cat kitten
🐭 mouse rat
🐹 hamster
🐰 rabbit bunny
🦊 fox
🐻 bear
🐼 panda
🐨 koala
🐯 tiger
🦁 lion king
🐮 cow bull
🐷 pig hog
🐸 frog toad
🐵 monkey
🦍 gorilla ape
🐔 chicken hen
🐧 penguin
🐦 bird
🦅 eagle
🦉 owl
🦆 duck
🦇 bat
🐺 wolf
🐴 horse pony
🦄 unicorn
🐉 dragon
🐝 bee honey
🐛 bug caterpillar worm
🦋 butterfly
🐌 snail slow
🐞 ladybug beetle
🕷️ spider
🕸️ web spider
🦂 scorpion
🐢 turtle tortoise slow
🐍 snake
🦎 lizard
🦖 dinosaur trex rex
🦕 dinosaur sauropod
🐙 octopus
🦑 squid
🦀 crab
🦞 lobster
🐠 fish tropical
🐟 fish
🐬 dolphin
🐳 whale
🦈 shark jaws
🐊 crocodile alligator
🐘 elephant
🦒 giraffe
🦓 zebra
🦘 kangaroo
🐪 camel desert
🦩 flamingo
🦜 parrot
🐑 sheep lamb
🐐 goat
🦌 deer reindeer
🐿️ squirrel
🌲 tree forest pine
🌴 palm tree tropical
🌵 cactus desert
🌻 sunflower flower
🌹 rose flower love
🍀 clover luck lucky
🍁 leaf autumn fall maple
🌸 blossom spring flower
`,
  food: `
🍎 apple
🍌 banana
🍇 grapes grape
🍓 strawberry
🍉 watermelon melon
🍊 orange
🍋 lemon sour
🍒 cherry
🍑 peach
🍍 pineapple
🥥 coconut
🥑 avocado
🥕 carrot
🌽 corn
🌶️ pepper chili hot spicy
🥒 cucumber pickle
🥦 broccoli vegetable
🍄 mushroom
🥔 potato
🧅 onion
🧄 garlic
🍞 bread toast loaf
🥐 croissant french
🥞 pancakes breakfast
🧇 waffle
🧀 cheese
🥚 egg
🍳 fried egg cooking pan breakfast
🥓 bacon
🍔 burger hamburger
🍟 fries chips
🍕 pizza
🌭 hotdog sausage
🥪 sandwich
🌮 taco mexican
🌯 burrito wrap
🍝 spaghetti pasta noodles
🍜 ramen noodles soup
🍣 sushi japanese
🍤 shrimp prawn
🍚 rice bowl
🥧 pie
🍦 ice cream
🍩 donut doughnut
🍪 cookie biscuit
🎂 birthday cake
🍰 cake slice
🧁 cupcake muffin
🍫 chocolate
🍬 candy sweet
🍭 lollipop
🍿 popcorn movie
🥜 peanut nut
🍯 honey
🧂 salt
🥛 milk
☕ coffee tea hot
🍵 tea green
🍺 beer
🍷 wine
🍸 cocktail martini
🥤 soda drink cup
🧃 juice box
🍽️ plate dinner meal
🍴 fork knife eat
`,
  travel: `
🚗 car drive
🚕 taxi cab
🚌 bus
🚓 police car
🚑 ambulance
🚒 fire truck engine
🏎️ race car fast
🚲 bike bicycle
🛵 scooter
🏍️ motorcycle
🚂 train locomotive steam
🚇 subway metro
✈️ plane airplane fly flight
🚁 helicopter
🚀 rocket space launch
🛸 ufo flying saucer alien
⛵ sailboat boat sail
🚢 ship cruise boat
🛶 canoe boat
⚓ anchor
🗺️ map
🧭 compass direction
🏔️ mountain snow
🌋 volcano
🏝️ island beach
🏖️ beach umbrella vacation
🏜️ desert
🏕️ camping tent
🏠 house home
🏰 castle
🗼 tower tokyo paris
🗽 statue liberty
🗿 moai statue stone rock face
🗻 fuji mountain
⛩️ shrine gate
🎡 ferris wheel fair
🎢 roller coaster
🎠 carousel
⛲ fountain
🏥 hospital
🏫 school
🏦 bank money
🏨 hotel
🏪 store shop
🏟️ stadium
⛪ church
🌍 earth world globe
🌎 america world
🌏 asia world
🌙 moon night
☀️ sun sunny
⭐ star
🌟 glowing star
⚡ lightning electric thunder
🌈 rainbow
☁️ cloud
🌧️ rain
❄️ snow snowflake winter ice
⛄ snowman
🌊 wave ocean sea water
🔥 fire hot lit
💧 water drop
🌪️ tornado storm wind
☔ umbrella rain
🌅 sunrise
🌃 night city
🏙️ city skyline
🚦 traffic light
⛽ fuel gas
🛣️ highway road
🚧 construction
`,
  objects: `
📱 phone mobile
💻 laptop computer
⌨️ keyboard
🖥️ desktop computer
📺 tv television
📷 camera photo
🎥 movie camera film
📞 telephone call
⏰ alarm clock time
⌛ hourglass time
💡 idea light bulb
🔦 flashlight torch
🕯️ candle
🔍 search magnifier find look
💰 money bag
💵 dollar cash
💎 diamond gem jewel
💍 ring wedding engagement
👑 crown king queen royal
🎩 top hat magic
👓 glasses
🕶️ sunglasses cool
👔 shirt tie
👗 dress
👠 heel shoe
👟 sneaker shoe
🧦 socks
🧤 gloves
🧣 scarf
🎒 backpack school
👜 handbag purse bag
☂️ umbrella
🔑 key
🗝️ old key
🔒 lock
🚪 door
🛏️ bed sleep
🛋️ couch sofa
🪑 chair seat
🚽 toilet bathroom
🛁 bath tub
🧸 teddy bear toy
🎁 gift present
🎈 balloon
📚 books library read
📖 book read story
✏️ pencil write
✂️ scissors cut
📌 pin
📎 paperclip
🔨 hammer tool
🔧 wrench tool
🪓 axe
🔪 knife
🗡️ dagger sword
⚔️ swords battle fight
🛡️ shield
🏹 bow arrow archer
🔫 water gun pistol
💣 bomb
🧨 firecracker dynamite
🔮 crystal ball fortune magic
🧪 test tube science lab
🔬 microscope science
🔭 telescope stars
💊 pill medicine
💉 syringe needle vaccine
🧲 magnet
⚙️ gear
🧹 broom sweep witch
🧻 toilet paper
⚱️ urn
💈 barber pole
📦 box package
✉️ envelope mail letter
📅 calendar date
`,
  activities: `
⚽ soccer football ball
🏀 basketball
🏈 football
⚾ baseball
🎾 tennis
🏐 volleyball
🏉 rugby
🎱 pool billiards
🏓 ping pong
🏸 badminton
🏒 hockey
⛳ golf
🥊 boxing glove
🥋 karate martial arts judo
🎿 ski skiing
🏂 snowboard
⛸️ ice skate
🛹 skateboard
🏋️ weightlifting gym lift
🤸 cartwheel gymnastics
🤺 fencing
🏇 horse racing jockey
🚴 cycling biker
🏆 trophy win champion cup
🥇 gold medal first winner
🥈 silver second
🥉 bronze third
🏅 medal
🎯 target dart bullseye
🎳 bowling
🎮 video game controller gaming
🕹️ joystick arcade
🎰 slot machine casino jackpot
🎲 dice game board
♟️ chess pawn
🃏 joker card
🧩 puzzle jigsaw
🎨 art paint palette
🎭 theater drama masks
🎤 microphone sing karaoke
🎧 headphones music
🎼 music score
🎵 note music song
🎶 notes music song
🎹 piano keyboard
🎸 guitar rock
🥁 drum
🎺 trumpet
🎻 violin
🎷 saxophone jazz
🎬 clapper film movie action
🎪 circus tent
🎉 party popper celebrate
🎊 confetti
🎆 fireworks
🎄 christmas tree
🪁 kite
🎣 fishing rod
🎟️ ticket admission
🏁 finish flag race
`,
  symbols: `
❤️ heart love red
💔 broken heart heartbreak
💕 two hearts love
💙 blue heart
💘 cupid arrow love
💯 hundred perfect
💤 sleep zzz
💥 boom explosion crash
💫 dizzy star
💦 sweat water splash
💨 dash wind fast
💬 speech talk chat
💭 thought think dream
❓ question what
❗ exclamation important
⚠️ warning
🚫 no prohibited forbidden ban
⛔ no entry stop
✅ check yes done correct
❌ cross no wrong
➕ plus add and
➖ minus
✖️ multiply times
➗ divide
♾️ infinity forever
💲 dollar money
🔝 top
🆕 new
🆓 free
🆒 cool
🆘 sos help
🔄 repeat again cycle
⏩ fast forward
⏪ rewind back
⏸️ pause
▶️ play start
⏹️ stop
⬆️ up
⬇️ down
⬅️ left back
➡️ right forward next
↩️ return back
🔁 repeat loop
1️⃣ one 1 first
2️⃣ two 2 second
3️⃣ three 3
🔟 ten 10
🔤 abc letters alphabet
♻️ recycle
☮️ peace
☯️ yin yang balance
✨ sparkle magic shiny
🔔 bell ring
🔕 silent mute
🔊 loud speaker sound
📍 location pin place
🏳️ white flag surrender
🏴‍☠️ pirate flag
🚩 red flag
⏳ hourglass waiting
🌀 cyclone spiral swirl
`,
};

const KB_CATS = [
  { key: 'faces', label: 'Faces', icon: '😀' },
  { key: 'people', label: 'People', icon: '🧑' },
  { key: 'animals', label: 'Nature', icon: '🐶' },
  { key: 'food', label: 'Food', icon: '🍔' },
  { key: 'travel', label: 'Places', icon: '✈️' },
  { key: 'objects', label: 'Objects', icon: '💡' },
  { key: 'activities', label: 'Activities', icon: '⚽' },
  { key: 'symbols', label: 'Symbols', icon: '❤️' },
];

function parseKeyboard(text) {
  const out = {};
  for (const [cat, block] of Object.entries(text)) {
    out[cat] = block.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => { const i = l.indexOf(' '); return { e: l.slice(0, i), tags: l.slice(i + 1).trim().split(/\s+/) }; });
  }
  return out;
}
const KEYBOARD = parseKeyboard(KEYBOARD_TEXT);
const ALLOWED = new Set(); for (const list of Object.values(KEYBOARD)) for (const k of list) ALLOWED.add(k.e);
const SEPARATOR = '│';

const ANSWERS = [];
for (const c of CATEGORIES) {
  for (const line of ANSWER_TEXT[c.key].split('\n')) {
    if (!line.trim()) continue;
    const [text, d, clue, alts] = line.split('|').map((x) => x.trim());
    ANSWERS.push({ id: c.key + ':' + ANSWERS.length, cat: c.key, text, diff: Math.max(1, Math.min(3, Number(d) || 2)), clue: clue ? clue.split(/\s+/).filter(Boolean) : [], alts: alts ? alts.split(';').map((x) => x.trim()).filter(Boolean) : [] });
  }
}

module.exports = { CATEGORIES, ANSWERS, KEYBOARD_TEXT, KEYBOARD, KB_CATS, ALLOWED, SEPARATOR, parseKeyboard };
