'use strict';
// JustBid content: every item, collection set and locker theme here is original.
// Values are in "base dollars" (tuned for a $2,000 starting bankroll); the game scales them
// with the starting-cash setting. Each item has a clue: what you'd see in the half-open
// locker (a silhouette + a label). Clues can mislead: a box labeled VINTAGE may hold junk.
//
// Row: [emoji, name, rarity, lo, hi, set|null, themes (space-separated, 'any' = filler
//       that can turn up anywhere), clue ('<emoji> text'), jackpot?]
// Rarity: J junk, C common, G good, R rare, E epic, L legendary.

const RARITIES = [
  { key: 'J', label: 'Junk', color: '#9a9aa8' },
  { key: 'C', label: 'Common', color: '#f4f1ff' },
  { key: 'G', label: 'Good', color: '#2ee68a' },
  { key: 'R', label: 'Rare', color: '#3ea8ff' },
  { key: 'E', label: 'Epic', color: '#b46cff' },
  { key: 'L', label: 'LEGENDARY', color: '#ffc93f' },
];

const SETS = {
  sports: { label: 'Sports Shrine', icon: '🏆', bonus: 400 },
  music: { label: 'Rock Legend', icon: '🎸', bonus: 600 },
  toys: { label: 'Retro Toys', icon: '🧸', bonus: 500 },
  art: { label: 'Art Gallery', icon: '🎨', bonus: 800 },
  tools: { label: 'Workshop', icon: '🧰', bonus: 300 },
  tech: { label: 'Gadget Museum', icon: '🕹️', bonus: 500 },
  kitchen: { label: 'Chef’s Kitchen', icon: '🍳', bonus: 300 },
  camping: { label: 'Great Outdoors', icon: '🏕️', bonus: 300 },
  film: { label: 'Movie Magic', icon: '🎬', bonus: 600 },
  pirate: { label: 'Pirate Hoard', icon: '🏴‍☠️', bonus: 700 },
  antiques: { label: 'Antique Parlor', icon: '🕰️', bonus: 600 },
  office: { label: 'Corner Office', icon: '💼', bonus: 300 },
  treasure: { label: 'Treasure Vault', icon: '💎', bonus: 1000 },
};

const ROWS = [
  // ---- Filler that can turn up in any locker ----
  ['🧦', 'Bag of single socks', 'J', 1, 5, null, 'any', '🛍️ a bulging garbage bag'],
  ['📰', 'Stack of old newspapers', 'J', 2, 8, null, 'any', '📰 a tall paper stack tied with string'],
  ['🪣', 'Bucket of mystery screws', 'J', 3, 12, 'tools', 'any', '🪣 a heavy bucket that rattles'],
  ['🧴', 'Crate of half-used lotions', 'J', 1, 4, null, 'any', '🧴 a crate of bottles'],
  ['🎄', 'Ball of tangled holiday lights', 'J', 2, 10, null, 'any', '📦 a box labeled XMAS - FRAGILE'],
  ['🪑', 'Wobbly folding chair', 'J', 4, 15, null, 'any', '🪑 a folded chair against the wall'],
  ['📦', 'Box full of empty boxes', 'J', 1, 3, null, 'any', '📦 a box labeled VINTAGE'],
  ['🛞', 'Bald spare tire', 'J', 5, 20, null, 'any', '🛞 something round and rubbery'],
  ['🖼️', 'Motel-room seascape print', 'C', 15, 45, null, 'any', '🖼️ a framed picture facing the wall'],
  ['📚', 'Encyclopedias (minus volume K)', 'C', 15, 50, null, 'any', '📚 rows of matching books'],
  ['🧳', 'Hard-shell suitcase', 'C', 25, 70, null, 'any', '🧳 a locked suitcase'],
  ['🧰', 'Toolbox of rusty wrenches', 'C', 25, 80, 'tools', 'any', '🧰 a red metal box'],
  ['🪚', 'Wall of old hand saws', 'C', 15, 50, 'tools', 'any', '🪚 jagged shapes on a pegboard'],
  ['🚲', 'Kid’s bike with flat tires', 'C', 20, 60, null, 'any', '🚲 two wheels poking out'],
  ['🪞', 'Big gold-painted mirror', 'G', 60, 180, 'antiques', 'any', '🪞 something tall wrapped in a blanket'],
  ['💍', 'Diamond ring hidden in a sock', 'R', 250, 700, 'treasure', 'any', '🧦 one sock that is oddly heavy'],

  // ---- Grandma's Attic ----
  ['🧶', 'Basket of unfinished knitting', 'J', 2, 8, null, 'attic', '🧶 a basket of yarn'],
  ['🍬', 'Tin of extremely old candies', 'J', 1, 3, null, 'attic', '🥫 a round tin with a tartan lid'],
  ['📽️', 'Slide projector, no slides', 'C', 20, 55, null, 'attic', '📽️ a beige boxy machine'],
  ['🫖', 'Rose-pattern tea set', 'C', 25, 70, 'antiques', 'attic kitchen', '🫖 a box labeled GOOD CHINA'],
  ['💌', 'Bundle of love letters', 'C', 10, 40, null, 'attic', '💌 a ribbon-tied bundle'],
  ['🔨', 'Grandpa’s woodworking planes', 'G', 60, 150, 'tools', 'attic', '🔨 a wooden case with brass latches'],
  ['🕰️', 'Hand-carved cuckoo clock', 'G', 90, 220, 'antiques', 'attic', '🕰️ something ticking (still!)'],
  ['🪡', 'Treadle sewing machine', 'G', 120, 260, 'antiques', 'attic', '🪡 a heavy iron thing with a wheel'],
  ['🎩', 'Silk top hat in its box', 'G', 70, 160, 'antiques', 'attic', '🎩 a tall hatbox'],
  ['🫙', 'Jar of old silver coins', 'R', 250, 600, 'treasure', 'attic vault', '🫙 a jar that clinks'],
  ['📻', 'Wooden valve radio', 'R', 220, 520, 'antiques', 'attic', '📻 a wooden box with knobs'],
  ['👑', 'Costume tiara (the stones are real!)', 'E', 700, 1500, 'treasure', 'attic', '👑 something sparkly in a hatbox'],
  ['🖼️', 'Dusty painting by a forgotten master', 'L', 3000, 7000, 'art', 'attic art', '🖼️ a frame under a dust sheet', true],

  // ---- Sports Fanatic ----
  ['🏀', 'Net bag of flat basketballs', 'J', 2, 8, null, 'sports', '🏀 a net bag of balls'],
  ['🏆', 'Shelf of participation trophies', 'J', 2, 10, null, 'sports', '🏆 a shelf of shiny trophies'],
  ['🧢', 'Stack of team caps', 'C', 15, 50, 'sports', 'sports', '🧢 a stack of caps'],
  ['🏒', 'Taped-up hockey sticks', 'C', 20, 60, 'sports', 'sports', '🏒 long sticks in a bin'],
  ['🥊', 'Cracked boxing gloves', 'C', 15, 45, 'sports', 'sports', '🥊 a pair of puffy gloves'],
  ['🏋️', 'Rusty weight set', 'C', 30, 80, null, 'sports', '🏋️ something VERY heavy'],
  ['⛳', 'Vintage wooden golf clubs', 'G', 80, 220, 'sports', 'sports', '⛳ a golf bag'],
  ['🎳', 'Monogrammed bowling ball', 'G', 50, 120, 'sports', 'sports', '🎳 a round bowling bag'],
  ['🚴', 'Carbon racing bike frame', 'G', 120, 260, 'sports', 'sports camping', '🚲 a skinny bike frame'],
  ['🏏', 'Team-signed cricket bat', 'R', 250, 600, 'sports', 'sports', '🏏 a bat in a display case'],
  ['⚾', 'Signed championship baseball', 'R', 300, 750, 'sports', 'sports vault', '⚾ a tiny glass cube'],
  ['👟', 'Game-worn sneakers', 'E', 700, 1600, 'sports', 'sports', '👟 a shoebox in a plastic sleeve'],
  ['🏅', 'Real gold medal from a world final', 'L', 2500, 6000, 'sports', 'sports vault', '🏅 a velvet case', true],

  // ---- Gadget Hoarder ----
  ['🔌', 'Tangle of mystery chargers', 'J', 1, 6, null, 'gadget', '🔌 a bin of cables'],
  ['📟', 'Pager collection', 'J', 3, 12, 'tech', 'gadget office', '📟 a tray of little plastic gadgets'],
  ['🖨️', 'Printer that only prints stripes', 'J', 2, 12, null, 'gadget office', '🖨️ a big beige box'],
  ['📱', 'Drawer of cracked phones', 'J', 4, 15, null, 'gadget', '📱 a drawer full of phones'],
  ['📼', 'VCR with a tape still stuck inside', 'C', 10, 35, 'tech', 'gadget', '📼 a flat black machine'],
  ['💻', 'Old laptop (it boots!)', 'C', 30, 90, 'tech', 'gadget', '💻 a laptop bag'],
  ['🎧', 'Studio headphones', 'G', 60, 180, 'tech', 'gadget band', '🎧 a padded case'],
  ['📷', 'Film camera with three lenses', 'G', 90, 240, 'tech', 'gadget art', '📷 a camera bag'],
  ['🎮', 'Boxed retro game console', 'G', 120, 300, 'tech', 'gadget toys', '🎮 a box with controllers on it'],
  ['🚁', 'Camera drone in a hard case', 'R', 200, 500, 'tech', 'gadget', '🚁 a hard case with propellers'],
  ['🕹️', 'Working arcade cabinet', 'R', 400, 900, 'tech', 'gadget toys', '🕹️ a tall cabinet under a tarp'],
  ['🤖', 'Prototype robot dog', 'E', 700, 1500, 'tech', 'gadget', '🤖 a box with paws drawn on it'],
  ['💾', 'Sealed first-run home computer', 'L', 2500, 5500, 'tech', 'gadget vault', '💾 a shrink-wrapped box', true],

  // ---- Movie Props ----
  ['🎞️', 'Empty film canisters', 'J', 2, 10, 'film', 'movie', '🎞️ a stack of film canisters'],
  ['🌴', 'Plastic palm tree', 'J', 5, 15, null, 'movie', '🌴 something leafy and plastic'],
  ['🪧', 'Fake storefront sign', 'C', 20, 60, 'film', 'movie', '🪧 a big painted sign'],
  ['🧟', 'Rubber zombie mask', 'C', 15, 50, 'film', 'movie', '🎭 a box of masks'],
  ['🗡️', 'Foam castle sword', 'C', 15, 45, 'film', 'movie', '🗡️ a sword-shaped bundle'],
  ['🎬', 'Clapperboard from a famous flop', 'C', 25, 70, 'film', 'movie', '🎬 a black-and-white slate'],
  ['📜', 'Script covered in coffee rings', 'C', 20, 60, 'film', 'movie', '📜 a stack of paper with coffee rings'],
  ['🪐', 'Spaceship model on a stand', 'G', 120, 300, 'film', 'movie toys', '🪐 a model on a stand'],
  ['👗', 'Red-carpet gown', 'G', 100, 260, 'film', 'movie', '👗 a garment bag'],
  ['🎥', 'Hand-crank movie camera', 'R', 300, 700, 'film', 'movie', '🎥 a heavy camera on a tripod'],
  ['🦖', 'Animatronic dinosaur head', 'R', 400, 900, 'film', 'movie', '🦖 something with TEETH under a sheet'],
  ['🦸', 'Screen-worn superhero cape', 'E', 800, 1800, 'film', 'movie', '🦸 a flat box marked HERO - DO NOT TOUCH'],
  ['🏆', 'Little gold film-award statue', 'L', 3000, 7000, 'film', 'movie vault', '🗿 a small heavy figure wrapped in tape', true],

  // ---- Garage Band ----
  ['🎸', 'Guitar-shaped cardboard cutout', 'J', 2, 8, null, 'band', '🎸 something guitar-shaped under a sheet'],
  ['📀', 'Box of unsold demo CDs', 'J', 1, 5, null, 'band', '💿 a box labeled DEMOS!!!'],
  ['👕', 'Shirts from a tour nobody went to', 'J', 3, 12, null, 'band', '👕 a crate of black T-shirts'],
  ['🪇', 'Bag of maracas', 'J', 1, 6, null, 'band', '🪇 a bag that rattles'],
  ['🥁', 'Drum kit with one cymbal', 'C', 40, 90, 'music', 'band', '🥁 a pile of drums'],
  ['🎹', 'Keyboard with sticky keys', 'C', 30, 80, 'music', 'band', '🎹 a long flat case'],
  ['🎤', 'Microphone in a velvet box', 'G', 60, 160, 'music', 'band', '🎤 a small velvet box'],
  ['🔊', 'Giant amp (goes up past 10)', 'G', 90, 220, 'music', 'band', '🔊 a speaker cabinet'],
  ['🎷', 'Dented saxophone', 'G', 100, 250, 'music', 'band', '🎷 a curvy case'],
  ['🎸', 'Sunburst electric guitar', 'G', 120, 300, 'music', 'band', '🎸 a guitar case covered in stickers'],
  ['💿', 'Crate of rare vinyl pressings', 'R', 300, 700, 'music', 'band attic', '💿 a crate of records'],
  ['🎻', 'Violin with a 1700s maker’s label', 'E', 800, 2000, 'music', 'band attic', '🎻 a small coffin-shaped case'],
  ['🎸', 'Guitar signed by a rock legend', 'L', 2500, 6000, 'music', 'band vault', '🎸 a guitar in a glass case', true],

  // ---- Old Toy Shop ----
  ['🧩', 'Puzzles with missing pieces', 'J', 1, 5, null, 'toys', '🧩 a stack of puzzle boxes'],
  ['🎲', 'Board games, all the pieces mixed', 'J', 2, 10, null, 'toys', '🎲 a tower of board games'],
  ['🪁', 'Tangled kites', 'J', 2, 8, null, 'toys camping', '🪁 a bundle of sticks and fabric'],
  ['🧸', 'Patched-up teddy bear', 'C', 10, 40, 'toys', 'toys attic', '🧸 a fuzzy ear poking out'],
  ['🪀', 'Yo-yo collection', 'C', 20, 50, 'toys', 'toys', '🪀 a tackle box of round things'],
  ['🪆', 'Painted nesting dolls', 'C', 20, 55, 'toys', 'toys', '🪆 a round wooden figure'],
  ['🚂', 'Model train set', 'G', 100, 260, 'toys', 'toys', '🚂 a long box with tracks'],
  ['🤖', 'Wind-up tin robot', 'G', 80, 200, 'toys', 'toys', '🤖 a little tin box'],
  ['🏎️', 'Die-cast cars in display cases', 'G', 70, 180, 'toys', 'toys', '🏎️ a case of tiny cars'],
  ['🐴', 'Carved rocking horse', 'R', 220, 500, 'toys', 'toys attic', '🐴 something with a mane'],
  ['🃏', 'Binder of trading cards', 'R', 300, 800, 'toys', 'toys', '🃏 a fat binder'],
  ['🏰', 'Victorian dollhouse mansion', 'E', 600, 1400, 'toys', 'toys', '🏰 a big house-shaped box'],
  ['✨', 'Holographic first-print monster card', 'L', 2500, 6000, 'toys', 'toys vault', '🃏 one card in a hard plastic case', true],

  // ---- Fancy Furniture ----
  ['🗄️', 'Particle-board dresser', 'J', 5, 20, null, 'furniture', '🗄️ a dresser (light as a feather)'],
  ['🫘', 'Leaking bean bag', 'J', 1, 5, null, 'furniture', '🫘 a big squishy lump'],
  ['🏺', 'Gift-shop "antique" vase', 'J', 3, 12, null, 'furniture attic', '🏺 a vase wrapped in newspaper'],
  ['🗿', 'Concrete garden statue', 'C', 30, 80, null, 'furniture', '🗿 a stone head'],
  ['🛋️', 'Puffy leather armchair', 'C', 40, 90, 'antiques', 'furniture', '🪑 a puffy armchair'],
  ['🛏️', 'Brass bed frame', 'G', 90, 220, 'antiques', 'furniture', '🛏️ shiny poles in a bundle'],
  ['🕯️', 'Silver candelabra', 'G', 80, 200, 'antiques', 'furniture', '🕯️ something branchy and silver'],
  ['🪵', 'Hand-carved blanket chest', 'G', 120, 260, 'antiques', 'furniture', '🪵 a heavy wooden chest'],
  ['🛋️', 'Velvet fainting couch', 'G', 150, 300, 'antiques', 'furniture', '🛋️ a long curvy shape under a sheet'],
  ['🪑', 'Set of mid-century chairs', 'R', 300, 700, 'antiques', 'furniture office', '🪑 chairs with skinny legs'],
  ['💡', 'Stained-glass table lamp', 'R', 250, 600, 'antiques', 'furniture', '💡 a lamp with a colorful glass shade'],
  ['🪟', 'Church stained-glass window', 'R', 250, 550, 'art', 'furniture art', '🪟 a big flat pane wrapped in quilts'],
  ['⏳', 'Grandfather clock that still chimes', 'E', 700, 1500, 'antiques', 'furniture attic', '⏳ something very tall that chimes'],
  ['🏺', 'Museum-grade dynasty vase', 'L', 3000, 6500, 'antiques', 'furniture vault', '🏺 a vase in a padded crate', true],

  // ---- Camping Gear ----
  ['🔦', 'Box of dead flashlights', 'J', 1, 6, null, 'camping', '🔦 a box of flashlights'],
  ['🧻', 'Emergency toilet paper', 'J', 1, 3, null, 'camping', '📦 a box labeled EMERGENCY'],
  ['⛺', 'Tent with mystery holes', 'C', 15, 40, 'camping', 'camping', '⛺ a rolled-up tent'],
  ['🎒', 'Hiking backpack', 'C', 20, 60, 'camping', 'camping', '🎒 a stuffed backpack'],
  ['🎣', 'Fishing rods and a lucky lure', 'C', 25, 70, 'camping', 'camping', '🎣 a bundle of rods'],
  ['🔥', 'Dented camp stove', 'C', 20, 55, 'camping', 'camping kitchen', '🔥 a dented metal case'],
  ['🛷', 'Wooden sled', 'C', 25, 70, null, 'camping toys', '🛷 curved runners'],
  ['🪓', 'Forged hatchet', 'G', 50, 120, 'tools', 'camping', '🪓 a wooden handle sticking out'],
  ['🧭', 'Brass compass', 'G', 60, 150, 'camping', 'camping pirate', '🧭 a small brass case'],
  ['🛶', 'Cedar canoe', 'G', 150, 320, 'camping', 'camping', '🛶 something long and pointy'],
  ['🔭', 'Brass telescope on a tripod', 'R', 250, 600, 'camping', 'camping', '🔭 a long tube on a tripod'],
  ['📡', 'Satellite phone in a rugged case', 'R', 220, 480, 'tech', 'camping gadget', '📡 a rugged black case'],
  ['🚩', 'Summit flag from a famous climb', 'E', 700, 1500, 'camping', 'camping', '🚩 a folded flag in a frame'],
  ['🦴', 'Dinosaur fossil found on a hike', 'L', 2500, 5500, 'camping', 'camping vault', '🪨 a rock wrapped in a towel', true],

  // ---- Abandoned Art Studio ----
  ['🎨', 'Dried-up paint tubes', 'J', 1, 5, null, 'art', '🎨 a bin of paint tubes'],
  ['⬜', 'Stack of blank canvases', 'J', 3, 12, null, 'art', '🖼️ a stack of canvases'],
  ['🎭', 'Pair of theatre masks', 'C', 15, 45, 'art', 'art movie', '🎭 two faces on a wall hook'],
  ['🖌️', 'Paint-splattered easel', 'C', 20, 55, 'art', 'art', '🖼️ a wooden A-frame'],
  ['🌀', 'Abstract painting (upside down?)', 'C', 25, 80, 'art', 'art', '🖼️ a big canvas facing the wall'],
  ['🐱', 'Clay bust of the artist’s cat', 'G', 60, 160, 'art', 'art', '🗿 a lumpy head on a pedestal'],
  ['📒', 'Sketchbooks full of doodles', 'G', 50, 140, 'art', 'art', '📒 a pile of sketchbooks'],
  ['🔷', 'Mosaic tabletop', 'G', 80, 200, 'art', 'art furniture', '🔷 a heavy tiled circle'],
  ['🏞️', 'Signed landscape painting', 'R', 300, 700, 'art', 'art attic', '🖼️ a gilded frame wrapped in plastic'],
  ['💡', 'Neon sign art piece', 'R', 250, 600, 'art', 'art', '💡 glass tubes in a crate'],
  ['🫙', 'Jar of real gold leaf', 'R', 200, 450, 'art', 'art', '🫙 a tiny jar that shimmers'],
  ['🗽', 'Marble sculpture', 'E', 800, 1700, 'art', 'art vault', '🗿 something white and heavy'],
  ['🌻', 'Early work by a now-famous painter', 'L', 3000, 7000, 'art', 'art vault', '🌻 a small canvas in a pillowcase', true],

  // ---- Collector's Vault ----
  ['🔐', 'Safe full of… old paperwork', 'J', 5, 15, null, 'vault office', '🔐 a heavy safe'],
  ['🧳', 'Empty display cases', 'J', 3, 10, null, 'vault', '🧳 glass cases (empty?)'],
  ['🧸', 'Limited-edition designer bear', 'G', 100, 250, 'toys', 'vault toys', '🧸 a bear in a glass box'],
  ['📜', 'Signed historic letter', 'R', 400, 900, 'treasure', 'vault office', '📜 a document in a sleeve'],
  ['🍾', 'Very old bottle of wine', 'R', 300, 750, 'treasure', 'vault kitchen', '🍾 a dusty bottle in a crate'],
  ['🗡️', 'Jeweled ceremonial dagger', 'R', 350, 800, 'treasure', 'vault pirate', '🗡️ a jeweled handle'],
  ['📕', 'First-edition novel', 'R', 300, 700, 'treasure', 'vault attic', '📕 a book in a plastic sleeve'],
  ['💿', 'Framed platinum record', 'E', 700, 1500, 'music', 'vault band', '💿 a framed shiny disc'],
  ['💎', 'Pouch of loose gemstones', 'E', 800, 1800, 'treasure', 'vault', '💎 a velvet pouch'],
  ['⌚', 'Luxury wristwatch', 'E', 900, 2200, 'treasure', 'vault', '⌚ a small leather case'],
  ['🪙', 'Gold coin collection', 'E', 900, 2000, 'treasure', 'vault', '🪙 a heavy wooden coin tray'],
  ['🚗', 'Rusty classic sports car', 'L', 2500, 6000, 'treasure', 'vault', '🚗 a car-shaped tarp'],
  ['🥚', 'Jeweled royal egg', 'L', 3000, 8000, 'treasure', 'vault', '🥚 an egg-shaped velvet box', true],

  // ---- Kitchen Chaos ----
  ['🥫', 'Expired canned beans', 'J', 1, 3, null, 'kitchen', '🥫 a pyramid of cans'],
  ['🫙', 'Jars of pickles (from 2004)', 'J', 1, 4, null, 'kitchen', '🫙 rows of jars'],
  ['🍽️', 'Mismatched plates', 'J', 2, 8, null, 'kitchen', '🍽️ a stack of plates'],
  ['🧇', 'Waffle iron', 'C', 10, 35, 'kitchen', 'kitchen', '🧇 a hinged gadget'],
  ['🍹', '80s blender', 'C', 15, 45, 'kitchen', 'kitchen', '🍹 a box with a smoothie on it'],
  ['🍳', 'Cast-iron pan', 'C', 20, 60, 'kitchen', 'kitchen camping', '🍳 a heavy black pan'],
  ['⛲', 'Chocolate fountain', 'C', 20, 60, 'kitchen', 'kitchen', '⛲ a tiered metal tower'],
  ['🍴', 'Silverware in a wooden chest', 'G', 80, 200, 'kitchen', 'kitchen attic', '🍴 a wooden canteen box'],
  ['🔪', 'Chef’s knife roll', 'G', 70, 160, 'kitchen', 'kitchen', '🔪 a rolled-up leather pouch'],
  ['🥘', 'Copper pot set', 'G', 120, 260, 'kitchen', 'kitchen', '🥘 a stack of shiny pots'],
  ['🥣', 'Retro mint stand mixer', 'G', 100, 240, 'kitchen', 'kitchen', '🥣 a mint-green appliance'],
  ['☕', 'Chrome espresso machine', 'R', 250, 600, 'kitchen', 'kitchen office', '☕ a shiny chrome machine'],
  ['📒', 'Famous chef’s handwritten recipes', 'E', 600, 1400, 'kitchen', 'kitchen', '📒 a greasy notebook'],
  ['🧂', 'Solid-silver royal salt cellar', 'L', 2000, 4500, 'kitchen', 'kitchen vault', '🧂 a tiny, very heavy dish', true],

  // ---- Office Clear-out ----
  ['📎', 'Ten thousand paper clips', 'J', 1, 4, null, 'office', '📎 a box that jingles'],
  ['🗂️', 'Cabinet of old tax forms', 'J', 3, 10, null, 'office', '🗄️ a filing cabinet'],
  ['🖥️', 'Pile of beige monitors', 'J', 2, 8, null, 'office gadget', '🖥️ a pile of beige screens'],
  ['🪴', 'Plastic office ficus', 'J', 1, 5, null, 'office', '🪴 a suspiciously perfect plant'],
  ['📠', 'Fax machine', 'C', 10, 30, 'office', 'office', '📠 a beeping box'],
  ['🎯', 'Break-room dartboard', 'C', 10, 30, null, 'office sports', '🎯 a round board full of holes'],
  ['💺', 'Ergonomic office chair', 'C', 30, 80, 'office', 'office', '💺 a chair with lots of levers'],
  ['☎️', 'Rotary phone', 'C', 20, 60, 'office', 'office attic', '☎️ a coiled cord poking out'],
  ['🖊️', 'Fancy fountain pens', 'G', 60, 160, 'office', 'office', '🖊️ a slim velvet case'],
  ['🗃️', 'Executive desk set', 'G', 70, 180, 'office', 'office', '🗂️ a leather desk blotter'],
  ['⌨️', 'Antique typewriter', 'G', 100, 240, 'office', 'office attic', '⌨️ a heavy machine with round keys'],
  ['🗄️', 'Library card catalog', 'R', 250, 550, 'office', 'office furniture', '🗃️ a cabinet with lots of tiny drawers'],
  ['💼', 'Briefcase (code taped to the bottom)', 'R', 200, 500, 'office', 'office', '💼 a locked briefcase'],
  ['📃', 'Founding charter of a famous company', 'E', 700, 1600, 'office', 'office vault', '📃 a framed document'],
  ['🗺️', 'Original blueprints of a city landmark', 'L', 2000, 5000, 'office', 'office vault', '📐 a tube of rolled-up plans', true],

  // ---- Pirate's Basement ----
  ['🏴', 'Homemade skull-and-bones flag', 'J', 3, 12, 'pirate', 'pirate', '🏴 a folded black flag'],
  ['🦿', 'Peg leg (size 9)', 'J', 2, 8, 'pirate', 'pirate', '🦿 a wooden leg'],
  ['🖍️', 'Treasure map (in crayon)', 'J', 1, 5, null, 'pirate', '🗺️ a rolled-up map'],
  ['💀', 'Plastic skull candle', 'J', 1, 6, null, 'pirate', '💀 a grinning skull'],
  ['🍫', 'Chest of chocolate coins', 'J', 2, 8, null, 'pirate', '💰 a TREASURE CHEST!'],
  ['🦜', 'Stuffed parrot (it talks?)', 'C', 15, 45, 'pirate', 'pirate', '🦜 a cage under a blanket'],
  ['🪝', 'Polished hook hand', 'C', 15, 40, 'pirate', 'pirate', '🪝 something hooked'],
  ['🍾', 'Message in a bottle', 'C', 10, 40, 'pirate', 'pirate', '🍾 a bottle with paper inside'],
  ['☸️', 'Ship’s wheel', 'G', 120, 260, 'pirate', 'pirate', '☸️ a big wooden wheel'],
  ['🔭', 'Brass spyglass', 'G', 70, 160, 'pirate', 'pirate', '🔭 a brass tube'],
  ['⚓', 'Barnacled ship’s anchor', 'G', 90, 200, 'pirate', 'pirate', '⚓ something VERY heavy and rusty'],
  ['🧭', 'Real 1700s sea chart', 'R', 300, 700, 'pirate', 'pirate', '📜 a map in a leather tube'],
  ['👝', 'Pouch of real doubloons', 'R', 400, 900, 'pirate', 'pirate', '👝 a tiny salty pouch'],
  ['🎩', 'Captain’s jeweled tricorn hat', 'E', 800, 1800, 'pirate', 'pirate', '🎩 a three-cornered hatbox'],
  ['🔴', 'Cursed ruby (probably fine)', 'L', 3000, 7000, 'pirate', 'pirate vault', '🔴 something red glinting in a jar', true],
];

const ITEMS = ROWS.map(([emoji, name, r, lo, hi, set, themes, clue, jackpot], id) => {
  const sp = clue.indexOf(' ');
  return { id, emoji, name, r, lo, hi, set: set || null, themes: themes.split(' '), clue: { icon: clue.slice(0, sp), text: clue.slice(sp + 1) }, jackpot: !!jackpot };
});

// Rarity weights: how likely each slot in a locker is to be Junk … Legendary.
const W_DEFAULT = { J: 28, C: 34, G: 23, R: 10, E: 4, L: 1 };
const decoy = (s) => { const sp = s.indexOf(' '); return { icon: s.slice(0, sp), text: s.slice(sp + 1) }; };

const THEMES = [
  { key: 'attic', name: 'Grandma’s Attic', icon: '👵', door: '#b5653a', decoys: ['📦 a box labeled HEIRLOOMS', '🧥 a rack of old coats'] },
  { key: 'sports', name: 'Sports Fanatic', icon: '🏆', door: '#2f7fd1', decoys: ['📦 a box labeled SIGNED STUFF', '🏟️ a folded stadium banner'] },
  { key: 'gadget', name: 'Gadget Hoarder', icon: '📱', door: '#3a8f7f', decoys: ['📦 a box labeled NEW IN BOX', '🔋 a crate of batteries'] },
  { key: 'movie', name: 'Movie Props', icon: '🎬', door: '#8a3ab5', decoys: ['📦 a crate stamped PROPERTY OF THE STUDIO', '💡 big studio lights'] },
  { key: 'band', name: 'Garage Band', icon: '🎸', door: '#c23b4a', decoys: ['📦 a box labeled ROYALTIES', '🎚️ a tangle of cables and pedals'] },
  { key: 'toys', name: 'Old Toy Shop', icon: '🧸', door: '#d68a1e', decoys: ['📦 a box labeled MINT CONDITION', '🎈 a bag of deflated balloons'] },
  { key: 'furniture', name: 'Fancy Furniture', icon: '🛋️', door: '#7a5c3a', decoys: ['🛋️ a lump under a fancy sheet', '📦 a crate stamped ESTATE SALE'] },
  { key: 'camping', name: 'Camping Gear', icon: '🏕️', door: '#4c7a32', decoys: ['📦 a box labeled SURVIVAL', '🪵 a pile of firewood'] },
  { key: 'art', name: 'Abandoned Art Studio', icon: '🎨', door: '#c2477e', decoys: ['🖼️ a frame wrapped in brown paper', '📦 a box labeled MY BEST WORK'] },
  { key: 'kitchen', name: 'Kitchen Chaos', icon: '🍳', door: '#cf5d2e', decoys: ['📦 a box labeled GRANDMA’S SECRET RECIPES', '🍲 a stack of pots and pans'] },
  { key: 'office', name: 'Office Clear-out', icon: '🗄️', door: '#56607a', decoys: ['📦 a box labeled CONFIDENTIAL', '🗄️ a cabinet with a broken lock'] },
  { key: 'pirate', name: 'Pirate’s Basement', icon: '🏴‍☠️', door: '#3b3b55', decoys: ['📦 a box labeled DEFINITELY NOT TREASURE', '🦜 a feather trail on the floor'] },
  // Special themes: the Vault is rare and pricey (Premium lockers); Mystery has no clues at all.
  { key: 'vault', name: 'Collector’s Vault', icon: '💎', door: '#2b5d8f', special: true, w: { J: 6, C: 14, G: 30, R: 30, E: 15, L: 5 }, decoys: ['🔐 a locked strongbox', '📦 a crate stamped INSURED'] },
  { key: 'mystery', name: 'Mystery Locker', icon: '❓', door: '#444', special: true, noClues: true, decoys: [] },
].map((t) => ({ w: W_DEFAULT, ...t, decoys: t.decoys.map(decoy) }));

module.exports = { ITEMS, THEMES, SETS, RARITIES, W_DEFAULT };
