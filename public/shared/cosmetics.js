// Shop catalog, gold rewards and achievements. Shared by the server (prices,
// ownership, rewards are enforced there) and the phone (shop display).
//
// To add shop items:
//   - a new value in an existing list (options.js) becomes a paid item
//     automatically once it is past that field's free count (FIELDS below);
//   - a new kind of item: add its option list + one FIELDS line + a CATEGORY;
//   - optional: PRICES['field:value'] for a custom price, DESCRIPTIONS for text.
(function (root) {
  const O = typeof module !== 'undefined' && module.exports ? require('./options') : root.MT_OPTIONS;
  // Economy dials. Every gold reward (games, challenges, season tiers, achievements) is paid
  // at goldRate, and every gold price (items, the season pass, Fate Token trades) is charged
  // at priceRate. The numbers written below are the base values before these dials.
  const ECONOMY = { goldRate: 0.5, priceRate: 1.3 };
  const price = (n) => Math.round(n * ECONOMY.priceRate / 5) * 5;
  const pay = (n) => Math.max(1, Math.round(n * ECONOMY.goldRate));
  // field -> [option list, how many are free from the start]
  // field -> [option list, how many are free]. Most items are earned now: new players start with
  // a small free set (profiles created earlier keep everything they already had).
  const FIELDS = { hair: ['hair', 6], outfit: ['outfit', 4], hat: ['hats', 3], shoeStyle: ['shoeStyles', 2], accessory: ['accessory', 2], nameplate: ['nameplate', 1], houseDecor: ['houseDecor', 1], effect: ['effect', 1], houseStyle: ['houseStyle', 4] };
  if (O.deathAnim) FIELDS.deathAnim = ['deathAnim', 1];
  if (O.reactions) FIELDS.reactions = ['reactions', 1];
  if (O.ghostSkin) FIELDS.ghostSkin = ['ghostSkin', 1];
  // Shop sections. `target` says what equipping changes: the character or the house.
  const CATEGORIES = [
    { id: 'clothing', label: 'Clothing', icon: '👕', fields: ['outfit', 'shoeStyle'], target: 'avatar' },
    { id: 'accessories', label: 'Hats & Gear', icon: '🎩', fields: ['hat', 'accessory'], target: 'avatar' },
    { id: 'hair', label: 'Hairstyles', icon: '💇', fields: ['hair'], target: 'avatar' },
    { id: 'house', label: 'House', icon: '🏠', fields: ['houseStyle', 'houseDecor'], target: 'home' },
    { id: 'flair', label: 'Flair', icon: '✨', fields: ['nameplate', 'effect', 'reactions'], target: 'avatar' },
    { id: 'animations', label: 'Farewells', icon: '🕯', fields: ['deathAnim'], target: 'avatar' },
    { id: 'afterlife', label: 'Ghosts', icon: '👻', fields: ['ghostSkin'], target: 'avatar', goals: true },
  ];
  // The High Roller line: tier 1 is earned by making (or taking) your first bet; each higher
  // tier is a better version you can buy with gold once you own the tier below it.
  const LADDER = { 'reactions:rxCasino': { tier: 1 }, 'hat:dealerVisor': { tier: 2, requires: 'reactions:rxCasino' }, 'hat:highRoller': { tier: 3, requires: 'hat:dealerVisor' }, 'effect:goldRain': { tier: 4, requires: 'hat:highRoller' } };
  // Where an equipped item lives: avatar field, or house design field (HOME_FIELDS key).
  const SLOT = { houseStyle: { target: 'home', key: 'style' }, houseDecor: { target: 'home', key: 'decor' } };
  const slotOf = (field) => SLOT[field] || { target: 'avatar', key: field };
  const PRICES = { 'houseStyle:darkMansion': 140, 'houseStyle:modernHouse': 120,
    'deathAnim:petals': 90, 'deathAnim:fireflies': 110, 'deathAnim:letter': 80, 'deathAnim:candle': 100, 'deathAnim:lantern': 120, 'deathAnim:starfall': 150, 'deathAnim:ascend': 200,
    'deathAnim:ectoplasm': 110, 'deathAnim:soulChains': 130, 'ghostSkin:sheet': 45, 'ghostSkin:chains': 75, 'ghostSkin:royalGhost': 160,
    'hat:dealerVisor': 120, 'hat:highRoller': 250, 'effect:goldRain': 400 };
  const DESCRIPTIONS = {
    'houseStyle:darkMansion': 'A towering, gloomy mansion with iron gates and a single candle in the attic. Fits the darkest secrets.',
    'houseStyle:modernHouse': 'Clean lines, big windows and a flat roof. The most futuristic address in town.',
    'hat:executionerHood': 'A crimson executioner’s hood trimmed in gold, worn only by those who gave their life on the gallows to save another. Earned by saving someone as the Executioner.',
    'outfit:plagueDoctor': 'The beaked coat of a healer who has seen too much. Earned by saving ten players.',
    'outfit:detectiveCoat': 'A long coat with deep pockets for clues. Earned by identifying five Mafia.',
    'outfit:jester': 'Bells, stripes and zero regrets. Earned by winning as the Jester.',
    'nameplate:mafiaBoss': 'A gold-trimmed nameplate for proven bosses. Earned by winning five Mafia games.',
    'outfit:ghostHunter': 'Gear for someone who has survived it all. Earned by surviving ten games.',
    // Farewells: how you go out. Plays over your body on the big screen when you die (it never reveals who did it).
    'hat:bloodCrown': 'A crown of dark iron and a single blood-red gem. Season 1 pass, tier 6.',
    'effect:bloodMist': 'A red mist curls around your feet. Season 1 pass, tier 3.',
    'nameplate:bloodMoon': 'A nameplate the color of the Blood Moon. Season 1 pass, tier 9.',
    'accessory:batWings': 'Leathery wings that twitch when you walk. Season 1 pass, tier 12.',
    'outfit:vampire': 'High collar, crimson lining, never seen in daylight. Season 1 pass, tier 15.',
    'effect:lightning': 'A storm follows you, and sometimes it strikes. Season 1 pass, tier 17.',
    'nameplate:gilded': 'Solid gold. For those who finished what they started. Season 1 pass, tier 18.',
    'outfit:bloodKnight': 'Armor forged under the Blood Moon. The Season 1 grand prize, tier 20.',
    'deathAnim:none': 'No farewell. You go quietly.',
    'deathAnim:petals': 'Rose petals drift down and settle around you.',
    'deathAnim:fireflies': 'Fireflies rise from where you fell and drift into the night.',
    'deathAnim:letter': 'A sealed letter flutters down beside you. What did it say? Nobody will ever know.',
    'deathAnim:candle': 'A candle burns beside you, gutters, and goes out.',
    'deathAnim:lantern': 'A paper sky lantern lifts from your side and floats away.',
    'reactions:rxSpooky': 'Reactions for the brave: 👻 💀 🕯️ 🦇 🎃 ⚰️ float over your head on the big screen.',
    'reactions:rxRoyal': 'React like royalty: 👑 💎 🍷 🎩 🗡️ 🛡️.',
    'reactions:rxParty': 'Turn every vote into a party: 🎉 🥳 🍕 🎈 🕺 🤪.',
    'reactions:rxDetective': 'For the sleuths: 🔍 🕵️ 🧐 📝 🔦 🚨.',
    'reactions:rxBloodMoon': 'Season 1 pass exclusive: 🩸 🌕 🦇 🗡️ ⚰️ 🌹 under a red moon.',
    'reactions:rxLove': 'Wear your heart on your sleeve: ❤️ 😍 💔 😘 🌹 🥺.',
    'deathAnim:starfall': 'The sky answers: falling stars streak overhead.',
    'deathAnim:ectoplasm': 'Green ectoplasm bursts from where you fell, and your ghost pulls itself out of the goo.',
    'deathAnim:soulChains': 'Spectral chains wrap around you, then shatter: your soul breaks free and rises as a ghost.',
    'ghostSkin:classic': 'The classic white ghost. Free for everyone.',
    'ghostSkin:sheet': 'A bedsheet with two eye holes and a striped hem. Timeless. Slightly cheap. Very spooky.',
    'ghostSkin:chains': 'Rattling chains and a heavy padlock. Everyone hears you coming.',
    'ghostSkin:royalGhost': 'A golden phantom with a crown and a flowing cape. Haunt like royalty.',
    'ghostSkin:wisp': 'A flickering blue flame with eyes. Earned the first time you become a ghost.',
    'ghostSkin:shadowEyes': 'A dark wraith with burning red eyes. Earned by sending 3 Chills.',
    'ghostSkin:oracle': 'A violet seer with a third eye and a crystal ball. Earned by making 5 right ghost predictions.',
    'reactions:rxCasino': 'High Roller tier 1: 🎲 🃏 💰 🎰 🍀 💸. Earned by making or taking your first bet.',
    'hat:dealerVisor': 'High Roller tier 2: a green dealer’s visor with a card tucked in the band. Own the Casino Reactions first.',
    'hat:highRoller': 'High Roller tier 3: a gold-banded top hat with an ace and diamond studs. Own the Dealer’s Visor first.',
    'effect:goldRain': 'High Roller tier 4: gold coins rain around you wherever you go. Own the High Roller Top Hat first.',
    'deathAnim:ascend': 'Your spirit rises from your body, glowing, and fades into the light.',
  };
  // ----- Shop seasons & theme sets (public/shared/shop-season.js) -----
  // Event items (sold only while their event runs) and theme-set pieces: base prices and words.
  // They are `special`: never on the play-to-reveal shelf (see STOCKABLE below).
  Object.assign(PRICES, {
    'hat:pumpkinCap': 60, 'hat:strawHat': 70, 'outfit:cosySweater': 90, 'outfit:flannel': 80, 'accessory:autumnScarf': 50, 'accessory:ciderMug': 45, 'effect:fallingLeaves': 110, 'nameplate:harvestMoon': 60,
    'hat:snowBeanie': 60, 'hat:reindeerBand': 80, 'outfit:uglySweater': 90, 'accessory:candyCane': 45, 'accessory:earmuffs': 50, 'shoeStyle:iceSkates': 80, 'effect:aurora': 120, 'nameplate:frosted': 60,
    'hat:heartBoppers': 55, 'outfit:cupidCardigan': 85, 'accessory:loveLetter': 40, 'accessory:heartShades': 55, 'accessory:cupidWings': 100, 'effect:rosePetals': 100, 'nameplate:sweetheart': 60,
    'hat:bunnyEars': 55, 'hat:gardenHat': 70, 'outfit:gardener': 85, 'accessory:bouquet': 45, 'accessory:butterflyWings': 100, 'shoeStyle:wellies': 60, 'effect:butterflies': 110, 'nameplate:blossom': 60,
    'hat:bucketHat': 55, 'outfit:hawaiian': 80, 'outfit:lifeguard': 75, 'accessory:snorkel': 60, 'accessory:surfboard': 110, 'accessory:icePop': 40, 'shoeStyle:flipFlops': 40, 'effect:bubbles': 100, 'nameplate:surf': 60,
    'hat:witchHat': 75, 'hat:devilHorns': 55, 'outfit:skeleton': 90, 'outfit:mummy': 90, 'accessory:treatBucket': 45, 'effect:ghostly': 120, 'effect:batSwarm': 110, 'nameplate:haunted': 60,
    'accessory:lasso': 50, 'shoeStyle:spurBoots': 70, 'hat:trilby': 70, 'outfit:secretAgent': 100, 'accessory:nightShades': 70, 'outfit:chefCoat': 80, 'accessory:woodenSpoon': 35,
    'hat:deerstalker': 70, 'outfit:inverness': 100, 'accessory:magnifier': 50, 'outfit:dealerVest': 90, 'accessory:cardFan': 50, 'effect:luckyDice': 100, 'outfit:survivor': 90,
    'hat:ufoHat': 70, 'accessory:rayGun': 60, 'effect:orbit': 110, 'outfit:photoVest': 85, 'accessory:camera': 60,
  });
  Object.assign(DESCRIPTIONS, {
    'hat:pumpkinCap': 'A chunky orange knit cap with a curly green stem. Harvest Fest only.',
    'hat:strawHat': 'A wide straw hat with an autumn-leaf band, for long afternoons at the cider press.',
    'outfit:cosySweater': 'A thick cable-knit sweater with a maple leaf on the front. Smells like cinnamon.',
    'outfit:flannel': 'Red check flannel, sleeves rolled up. Ready to carve pumpkins.',
    'accessory:autumnScarf': 'A long striped scarf in rust, mustard and cream, wrapped twice.',
    'accessory:ciderMug': 'A steaming mug of hot apple cider. Careful, it’s hot.',
    'effect:fallingLeaves': 'Red and golden leaves drift down around you.',
    'nameplate:harvestMoon': 'Your name under a big orange harvest moon.',
    'hat:snowBeanie': 'A white-and-blue beanie with a snowflake and a giant pom-pom. Frostival only.',
    'hat:reindeerBand': 'A headband with fuzzy antlers, holly and two jingling bells.',
    'outfit:uglySweater': 'Zigzags, snowflakes and a reindeer. Proudly, gloriously ugly.',
    'accessory:candyCane': 'A giant peppermint candy cane. Do not lick it in front of the others.',
    'accessory:earmuffs': 'Big fluffy earmuffs. You can still hear the votes. Sadly.',
    'shoeStyle:iceSkates': 'White skates with silver blades. Glide into every lobby.',
    'effect:aurora': 'Green and violet northern lights ripple behind you.',
    'nameplate:frosted': 'An icy nameplate with frost creeping in at the corners.',
    'hat:heartBoppers': 'A headband with two springy hearts that bob when you move. Sweetheart Week only.',
    'outfit:cupidCardigan': 'A soft pink cardigan with heart buttons and a heart on the pocket.',
    'accessory:loveLetter': 'A pink envelope sealed with a heart. Who is it for?',
    'accessory:heartShades': 'Heart-shaped sunglasses with red lenses. Love is blind.',
    'accessory:cupidWings': 'Little pink-tipped wings. You still can’t fly, but you look like you could.',
    'effect:rosePetals': 'Red rose petals swirl down around you.',
    'nameplate:sweetheart': 'Your name in pink, with a little heart.',
    'hat:bunnyEars': 'Soft white bunny ears with pink insides. Spring Bloom only.',
    'hat:gardenHat': 'A wide sun hat with a band of fresh flowers.',
    'outfit:gardener': 'Pastel garden overalls with a trowel in the pocket and a flower on the bib.',
    'accessory:bouquet': 'A bunch of tulips and daisies, freshly picked.',
    'accessory:butterflyWings': 'Bright orange-and-blue butterfly wings that flutter as you walk.',
    'shoeStyle:wellies': 'Yellow rain wellies for jumping in puddles.',
    'effect:butterflies': 'Little butterflies flutter in loops around you.',
    'nameplate:blossom': 'A nameplate covered in cherry blossom.',
    'hat:bucketHat': 'A floppy bucket hat with a palm-leaf print. Summer Splash only.',
    'outfit:hawaiian': 'A loud Hawaiian shirt with hibiscus flowers. Very loud.',
    'outfit:lifeguard': 'A red lifeguard tee with a white cross. Everyone feels safer.',
    'accessory:snorkel': 'A diving mask with a snorkel. For deep, deep strategies.',
    'accessory:surfboard': 'A striped surfboard on your back. Hang ten.',
    'accessory:icePop': 'A dripping rainbow ice lolly. Eat it quick.',
    'shoeStyle:flipFlops': 'Bright flip-flops. Flip. Flop.',
    'effect:bubbles': 'Shiny soap bubbles float up around you.',
    'nameplate:surf': 'An ocean-wave nameplate with a little sun.',
    'hat:witchHat': 'A tall crooked witch hat with a purple band and a buckle. Spooky Season only.',
    'hat:devilHorns': 'Two little red horns. Mischief guaranteed.',
    'outfit:skeleton': 'A black suit with glow-in-the-dark bones. Spine-chilling.',
    'outfit:mummy': 'Wrapped from head to toe (well, neck to toe) in old bandages.',
    'accessory:treatBucket': 'A jack-o’-lantern bucket full of sweets.',
    'effect:ghostly': 'Two friendly little ghosts float around you.',
    'effect:batSwarm': 'A swarm of tiny bats circles over your head.',
    'nameplate:haunted': 'A dark purple nameplate with drips of green goo.',
    'accessory:lasso': 'A coiled rope, ready to twirl. Part of the Wild West set.',
    'shoeStyle:spurBoots': 'Brown boots with silver spurs that jingle. Part of the Wild West set.',
    'hat:trilby': 'A short-brimmed black trilby with a thin band. Part of the Secret Agent set.',
    'outfit:secretAgent': 'A black suit, white shirt and a skinny tie. Part of the Secret Agent set.',
    'accessory:nightShades': 'Shades that glow green in the dark. Part of the Secret Agent set.',
    'outfit:chefCoat': 'Double-breasted chef’s whites with a red neckerchief. Part of the Head Chef set.',
    'accessory:woodenSpoon': 'A trusty wooden spoon for tasting (and pointing). Part of the Head Chef set.',
    'hat:deerstalker': 'A tweed cap with flaps front and back. Part of the Great Detective set.',
    'outfit:inverness': 'A check coat with a short cape over the shoulders. Part of the Great Detective set.',
    'accessory:magnifier': 'A brass magnifying glass. Part of the Great Detective set.',
    'outfit:dealerVest': 'White shirt, red waistcoat and a black bow tie. Part of the High Stakes set.',
    'accessory:cardFan': 'Four aces, fanned out. Part of the High Stakes set.',
    'effect:luckyDice': 'A pair of dice tumble around you, always landing on sixes. Part of the High Stakes set.',
    'outfit:survivor': 'A khaki vest full of pockets, straps and a torch. Part of the Last Survivor set.',
    'hat:ufoHat': 'A tiny flying saucer with blinking lights. Part of the Space Cadet set.',
    'accessory:rayGun': 'A chunky toy ray gun with a glowing tip. Part of the Space Cadet set.',
    'effect:orbit': 'Little planets orbit around you. Part of the Space Cadet set.',
    'outfit:photoVest': 'A sand-coloured vest with a pocket for every lens. Part of the Paparazzi set.',
    'accessory:camera': 'A big camera, held up and ready to snap. Part of the Paparazzi set.',
  });
  // ----- Events v2: the half-month event calendar (public/shared/seasons.js ITEMS) -----
  // Base prices (before ECONOMY.priceRate) and words for every other kind of event's limited items.
  const EVENT_PRICE = { hat: 65, outfit: 90, accessory: 55, shoeStyle: 60, effect: 110, nameplate: 60 };
  const EVENT_WORDS = {
    // New Year Countdown
    'hat:starTiara': 'A silver tiara of little gold stars that twinkle at midnight.', 'outfit:sequinSuit': 'A gold sequin party suit with a black bow tie. Catches every light in the room.',
    'accessory:partyHorn': 'A curly party blower. Toot it when the clock strikes twelve.', 'accessory:starGlasses': 'Big gold star-shaped party glasses.', 'shoeStyle:glitterShoes': 'Shoes covered in gold glitter. They leave a sparkle.',
    'effect:confetti': 'Gold, pink and silver confetti pops over your head.', 'nameplate:midnight': 'A midnight-blue nameplate with a gold glitter edge.',
    // Lantern Festival
    'hat:tasselCap': 'A round red silk cap with gold trim and a swinging lucky tassel.', 'outfit:silkJacket': 'A red silk jacket with gold knot buttons and cloud trim.',
    'accessory:paperLantern': 'A glowing red paper lantern on a little stick.', 'accessory:paperFan': 'A folding paper fan painted with blossom.', 'shoeStyle:silkSlippers': 'Soft embroidered silk slippers.',
    'effect:skyLanterns': 'Little glowing lanterns float up around you.', 'nameplate:lanternGlow': 'A warm red nameplate lit like a paper lantern.',
    // Carnival
    'hat:plumeHeaddress': 'A towering fan of purple, green and gold feathers. Parade-ready.', 'outfit:harlequin': 'A diamond-patterned harlequin suit with a ruffled collar.',
    'accessory:carnivalMask': 'A glittering half mask with a feather on the side. Who is that?', 'accessory:beads': 'Strings of bright parade beads.', 'effect:streamers': 'Curly streamers twirl around you.',
    'nameplate:carnival': 'A purple, green and gold nameplate for the parade.',
    // Neon Nights
    'hat:neonVisor': 'A glowing pink-and-cyan visor for the night shift.', 'outfit:glowJacket': 'A dark jacket with glowing neon piping.', 'accessory:glowSticks': 'Two glow sticks. Wave them about.',
    'accessory:shutterShades': 'Slatted party shades in hot pink.', 'shoeStyle:lightUpKicks': 'Sneakers that flash with every step.', 'effect:neonRings': 'Glowing neon rings pulse around you.',
    'nameplate:synthwave': 'A synthwave sunset with a neon grid.',
    // Lucky Clover
    'hat:cloverHat': 'A small green top hat with a buckle and a four-leaf clover.', 'outfit:luckyVest': 'A green waistcoat with gold buttons and a clover pin.', 'accessory:potOfGold': 'A little black pot overflowing with gold coins.',
    'accessory:rainbowScarf': 'A long scarf in every colour of the rainbow.', 'shoeStyle:buckleShoes': 'Shiny black shoes with big gold buckles.', 'effect:luckyClovers': 'Four-leaf clovers drift down around you. Lucky!',
    'nameplate:shamrock': 'A green nameplate with a gold clover.',
    // Green Earth
    'hat:leafCrown': 'A crown of fresh green leaves.', 'outfit:planterApron': 'A canvas planter’s apron with a seedling on the pocket.', 'accessory:seedling': 'A tiny seedling in a clay pot. Look after it.',
    'accessory:wateringCan': 'A little green watering can, always dripping.', 'shoeStyle:gardenClogs': 'Muddy green garden clogs.', 'effect:seedPuffs': 'Dandelion seeds float past on the breeze.',
    'nameplate:evergreen': 'A deep green nameplate with a pine tree.',
    // Fiesta Flowers
    'hat:paperFlower': 'A giant tissue-paper flower clipped on the side of your head.', 'outfit:fiestaShirt': 'A white shirt with bright embroidered flowers.', 'accessory:maracas': 'A pair of painted maracas. Shake shake.',
    'accessory:pinata': 'A little star-shaped piñata on a string.', 'effect:paperFlags': 'A string of cut-paper flags flutters over your head.', 'nameplate:fiesta': 'A bright striped nameplate for the party.',
    // Dino Days
    'hat:dinoHood': 'A green dinosaur hood with soft spikes and big eyes.', 'outfit:dinoOnesie': 'A cosy dino onesie with a cream belly.', 'accessory:dinoTail': 'A swishing dinosaur tail.',
    'accessory:fossilBone': 'A big fossil bone, freshly dug up.', 'shoeStyle:dinoFeet': 'Three-toed dino slippers. Stomp stomp.', 'effect:pterodactyls': 'Two tiny pterodactyls circle over your head.',
    'nameplate:fossil': 'A sandstone nameplate with a fossil print.',
    // Deep Sea
    'hat:octopusHat': 'A friendly purple octopus sitting on your head.', 'outfit:wetsuit': 'A black and teal wetsuit, zipped up.', 'accessory:airTank': 'A yellow diving air tank on your back.',
    'accessory:trident': 'A golden sea trident.', 'shoeStyle:flippers': 'Long blue flippers. Walking is hard.', 'effect:jellyfish': 'Glowing jellyfish drift around you.', 'nameplate:abyss': 'A deep blue nameplate with glowing bubbles.',
    // Firework Fest
    'hat:sparklerCrown': 'A crown of crackling sparklers.', 'outfit:bandJacket': 'A red marching band jacket with gold braid.', 'accessory:sparkler': 'A fizzing sparkler. Write your name in the air.',
    'accessory:snareDrum': 'A marching snare drum with two sticks.', 'shoeStyle:bandBoots': 'Tall white band boots with gold tassels.', 'effect:fireworkBursts': 'Little fireworks burst over your head.',
    'nameplate:skyburst': 'A night-sky nameplate with a firework burst.',
    // Space Week
    'hat:alienBoppers': 'A headband with two glowing antenna balls.', 'outfit:flightSuit': 'An orange mission flight suit covered in patches.', 'accessory:jetpack': 'A jetpack with two little flames. It doesn’t fly.',
    'accessory:pocketPlanet': 'A tiny ringed planet that floats over your hand.', 'shoeStyle:moonBoots': 'Big puffy white moon boots.', 'effect:miniRockets': 'Two mini rockets loop around you.',
    'nameplate:galaxy': 'A swirling purple galaxy nameplate.',
    // Meteor Shower
    'hat:starCirclet': 'A silver circlet with a glowing star.', 'outfit:stargazerCloak': 'A long midnight cloak stitched with constellations.', 'accessory:telescope': 'A brass telescope for spotting shooting stars.',
    'accessory:starPendant': 'A glowing star on a silver chain.', 'effect:shootingStars': 'Shooting stars streak past behind you.', 'nameplate:stardust': 'A dark nameplate dusted with stars.',
    // Back to School
    'hat:propellerCap': 'A bright cap with a spinning propeller on top.', 'outfit:varsityJacket': 'A varsity jacket with a big letter patch and striped cuffs.', 'accessory:giantPencil': 'A giant yellow pencil. Sharp!',
    'accessory:shinyApple': 'A shiny red apple for the teacher (or for you).', 'shoeStyle:sneakers': 'Fresh white sneakers with coloured laces.', 'effect:paperPlanes': 'Paper planes loop around your head.',
    'nameplate:chalkboard': 'A chalkboard nameplate with a wooden frame.',
    // Robot Rumble
    'hat:robotHelm': 'A shiny robot helmet with bolts and a blinking antenna.', 'outfit:roboSuit': 'A metal robot suit with a panel of blinking buttons.', 'accessory:bigWrench': 'A huge silver wrench. Fixes anything.',
    'accessory:laserVisor': 'A red scanning visor. Beep.', 'shoeStyle:mechBoots': 'Heavy metal mech boots.', 'effect:gears': 'Golden gears spin around you.', 'nameplate:circuit': 'A green circuit-board nameplate.',
    // Pirate Week
    'hat:captainHat': 'A black captain’s bicorne with gold trim and a white feather.', 'outfit:deckhand': 'A striped deckhand shirt with a red sash.', 'accessory:cutlass': 'A curved toy cutlass. En garde!',
    'accessory:spyglass': 'A brass spyglass for spotting treasure islands.', 'shoeStyle:buccaneerBoots': 'Tall black boots with folded cuffs.', 'effect:seagulls': 'Two seagulls circle over your head.',
    'nameplate:treasure': 'An old treasure map nameplate. X marks the spot.',
    // Blood Moon
    'hat:wolfEars': 'Furry werewolf ears. Is that a howl?', 'outfit:hunterCoat': 'A long dark red hunter’s coat with silver buckles.', 'accessory:crimsonCape': 'A tall-collared crimson cape that sweeps behind you.',
    'accessory:moonLantern': 'An iron lantern with a red moon glowing inside.', 'effect:redMoon': 'A blood-red moon rises behind you, with bats.', 'nameplate:crimson': 'A crimson nameplate under a red moon.',
    // Campfire Nights
    'hat:rangerHat': 'A wide ranger hat with a leather band.', 'outfit:campVest': 'A puffy camp vest covered in badges.', 'accessory:marshmallow': 'A marshmallow on a stick, toasted golden.',
    'accessory:campLantern': 'A camping lantern with a warm glow.', 'shoeStyle:hikingBoots': 'Sturdy hiking boots with red laces.', 'effect:campSparks': 'Campfire sparks float up around you.',
    'nameplate:campfire': 'A dark wooden nameplate with a little campfire.',
    // Gingerbread Town
    'hat:gumdropCrown': 'A crown made of gumdrops and icing.', 'outfit:gingerbreadSuit': 'A gingerbread suit with icing squiggles and gumdrop buttons.', 'accessory:lollipop': 'A giant swirly lollipop.',
    'accessory:peppermintScarf': 'A red-and-white peppermint striped scarf.', 'effect:sprinkles': 'Rainbow sprinkles shower down around you.', 'nameplate:icing': 'A pink iced-cookie nameplate with sprinkles.',
  };
  for (const [id, words] of Object.entries(EVENT_WORDS)) { if (PRICES[id] == null) PRICES[id] = EVENT_PRICE[id.split(':')[0]] || 60; DESCRIPTIONS[id] = words; }
  Object.assign(PRICES, { 'effect:fireworkBursts': 120, 'effect:redMoon': 120, 'accessory:jetpack': 100, 'accessory:crimsonCape': 95, 'accessory:dinoTail': 80, 'accessory:airTank': 75, 'hat:plumeHeaddress': 80, 'hat:octopusHat': 80, 'outfit:stargazerCloak': 100 });
  const SPECIAL_IDS = new Set(Object.entries(FIELDS).flatMap(([f, [list]]) => ((O.SPECIAL || {})[list] || []).map((v) => f + ':' + v)));
  const KIND = { ghostSkin: 'ghost look', hair: 'hairstyle', outfit: 'outfit', hat: 'hat', shoeStyle: 'pair of shoes', accessory: 'accessory', nameplate: 'nameplate', houseDecor: 'house decoration', effect: 'cosmetic effect', houseStyle: 'house design', deathAnim: 'farewell animation' };
  const ACHIEVEMENTS = { mafiaWins5: { label: 'Win five Mafia games', stat: 'mafiaWins', count: 5 }, saves10: { label: 'Save ten players', stat: 'saves', count: 10 }, jesterWin: { label: 'Win as Jester', stat: 'jesterWins', count: 1 }, investigations5: { label: 'Identify five Mafia', stat: 'correctInvestigations', count: 5 }, survive10: { label: 'Survive ten games', stat: 'survived', count: 10 }, executionerSave: { label: 'Save someone as the Executioner', stat: 'executionerSaves', count: 1 },
    // The afterlife and betting (counted as they happen, in any game).
    firstGhost: { label: 'Become a ghost', stat: 'ghosts', count: 1 },
    restlessSpirit: { label: 'Send 3 Chills as a ghost', stat: 'chills', count: 3 },
    ghostOracle: { label: 'Make 5 right ghost predictions', stat: 'oracleCorrect', count: 5 },
    firstBet: { label: 'Make or take your first bet', stat: 'bets', count: 1 } };
  const GATES = { 'hat:executionerHood': 'executionerSave', 'outfit:plagueDoctor': 'saves10', 'outfit:detectiveCoat': 'investigations5', 'outfit:jester': 'jesterWin', 'nameplate:mafiaBoss': 'mafiaWins5', 'outfit:ghostHunter': 'survive10', 'ghostSkin:wisp': 'firstGhost', 'ghostSkin:shadowEyes': 'restlessSpirit', 'ghostSkin:oracle': 'ghostOracle', 'reactions:rxCasino': 'firstBet' };
  // ----- Season 1: Blood Moon (battle pass) -----
  // Buy the pass with gold; every game earns pass XP (pass or not); each tier pays gold or
  // unlocks a pass-exclusive cosmetic. Buying later grants every tier already reached.
  const SEASON = {
    id: 's1', name: 'Season 1: Blood Moon', cost: 150, tiers: 20, xpPerTier: 100,
    xp: { completed: 40, won: 25, survived: 10, challenge: 60 },
    rewards: { 1: { gold: 20 }, 2: { gold: 20 }, 3: { item: 'effect:bloodMist' }, 4: { gold: 30 }, 5: { gold: 30 }, 6: { item: 'hat:bloodCrown' }, 7: { gold: 30 }, 8: { gold: 40 },
      9: { item: 'nameplate:bloodMoon' }, 10: { gold: 40 }, 11: { gold: 40 }, 12: { item: 'accessory:batWings' }, 13: { item: 'reactions:rxBloodMoon' }, 14: { gold: 50 }, 15: { item: 'outfit:vampire' },
      16: { gold: 50 }, 17: { item: 'effect:lightning' }, 18: { item: 'nameplate:gilded' }, 19: { gold: 60 }, 20: { item: 'outfit:bloodKnight' } },
  };
  const PASS = Object.fromEntries(Object.entries(SEASON.rewards).filter(([, r]) => r.item).map(([tier, r]) => [r.item, Number(tier)]));
  // Weekly challenges: three per week (chosen from this pool by the week number), paid once each.
  const CHALLENGES = {
    play3: { label: 'Play 3 games', stat: 'games', count: 3, gold: 40 },
    play5: { label: 'Play 5 games', stat: 'games', count: 5, gold: 60 },
    win2: { label: 'Win 2 games', stat: 'wins', count: 2, gold: 60 },
    survive2: { label: 'Survive to the end of 2 games', stat: 'survived', count: 2, gold: 40 },
    save1: { label: 'Save someone from an attack', stat: 'saves', count: 1, gold: 50 },
    catch1: { label: 'Catch a Mafia member with an investigation', stat: 'correctInvestigations', count: 1, gold: 50 },
    mafiaWin1: { label: 'Win as the Mafia', stat: 'mafiaWins', count: 1, gold: 70 },
    abilities5: { label: 'Use your role’s ability 5 times', stat: 'abilities', count: 5, gold: 40 },
  };
  const weekKey = (date = new Date()) => { const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())); const day = d.getUTCDay() || 7; d.setUTCDate(d.getUTCDate() + 4 - day); const y = d.getUTCFullYear(); return `${y}-W${String(Math.ceil(((d - Date.UTC(y, 0, 1)) / 864e5 + 1) / 7)).padStart(2, '0')}`; };
  function weeklyChallenges(week) {
    const keys = Object.keys(CHALLENGES), out = [];
    let h = 0; for (const ch of week) h = (Math.imul(h, 31) + ch.charCodeAt(0)) >>> 0;
    // 32-bit integer math (a plain multiply loses the low bits) and a hard stop, so this can never spin.
    for (let guard = 0; out.length < 3 && guard < 200; guard++) { h = (Math.imul(h ^ (h >>> 15), 2246822507) + 12345) >>> 0; const k = keys[(h >>> 8) % keys.length]; if (!out.includes(k)) out.push(k); }
    for (const k of keys) if (out.length < 3 && !out.includes(k)) out.push(k);
    return out;
  }
  // Seasonal events the Judge can switch on (see rules/events.js).
  const EVENTS = {
    none: { name: 'No event' },
    bloodMoon: { name: '🌕 Blood Moon', xpMultiplier: 2, desc: 'Every third night the moon turns red and the Mafia strike twice. Double season XP.' },
    surprises: { name: '🎲 Daily Surprises', xpMultiplier: 1.5, desc: 'Some nights bring a twist: Fog (watchers see nothing), a Festival (no Mafia kill) or a Blood Moon (two kills). 1.5× season XP.' },
  };

  // ----- Worlds (Themes v2): cosmetics earned by finishing games in each world -----
  // First game there unlocks the first item, the third game the second. Never sold.
  const WORLD_NAMES = { space: 'Space Station', fantasy: 'Fantasy Realm', dragons: 'Dragon Peaks', dungeon: 'Dungeon Crawl', spies: 'Secret Agents', fbi: 'Federal Investigation', snow: 'Snowy Village', blocky: 'Block World', tabletop: 'Tabletop Quest', realistic: 'Realistic', noir: 'Noir' };
  const WORLD_REWARDS = {
    space: [{ item: 'hat:spaceHelmet', games: 1 }, { item: 'outfit:spaceSuit', games: 3 }],
    fantasy: [{ item: 'hat:elfCirclet', games: 1 }, { item: 'accessory:fairyWings', games: 3 }],
    dragons: [{ item: 'hat:dragonHorns', games: 1 }, { item: 'outfit:dragonScale', games: 3 }],
    dungeon: [{ item: 'accessory:torch', games: 1 }, { item: 'outfit:rogueLeathers', games: 3 }],
    spies: [{ item: 'accessory:shades', games: 1 }, { item: 'outfit:tuxedo', games: 3 }],
    fbi: [{ item: 'accessory:badge', games: 1 }, { item: 'outfit:fedJacket', games: 3 }],
    snow: [{ item: 'hat:furHat', games: 1 }, { item: 'outfit:parka', games: 3 }],
    blocky: [{ item: 'hat:cubeHelm', games: 1 }, { item: 'outfit:blockArmor', games: 3 }],
    tabletop: [{ item: 'accessory:diceBag', games: 1 }, { item: 'hat:featherCap', games: 3 }],
    realistic: [{ item: 'accessory:wristwatch', games: 1 }, { item: 'outfit:denimJacket', games: 3 }],
    noir: [{ item: 'hat:fedora', games: 1 }, { item: 'outfit:trenchCoat', games: 3 }],
  };
  const WORLD_ITEM = Object.fromEntries(Object.entries(WORLD_REWARDS).flatMap(([world, list]) => list.map((r) => [r.item, { world, games: r.games }])));

  // ----- Pets (docs/justgold.md "Pets") -----
  // One little animated friend on your shoulder (avatar field `pet`, MTArt.drawPet). Pets are
  // `special` (OPTIONS.SPECIAL.pets): always for sale in the shop's Pets section, never on the shelf.
  const PETS = {
    chick: { rarity: 'common', price: 60, icon: '🐤', desc: 'A round little chick that peeps, hops and flaps its tiny wings.' },
    snail: { rarity: 'common', price: 60, icon: '🐌', desc: 'Slow, steady and very shiny. Its eyestalks wiggle when it thinks.' },
    hamster: { rarity: 'common', price: 70, icon: '🐹', desc: 'Cheeks full of snacks, always. Twitches its nose at every vote.' },
    frog: { rarity: 'common', price: 75, icon: '🐸', desc: 'A happy green frog with a puffy throat and a big grin. Ribbit.' },
    bunny: { rarity: 'rare', price: 100, icon: '🐰', desc: 'A soft white bunny whose long ears flick at every sound.' },
    kitten: { rarity: 'rare', price: 110, icon: '🐱', desc: 'A striped tabby kitten with a curly tail. Purrs on your shoulder.' },
    puppy: { rarity: 'rare', price: 110, icon: '🐶', desc: 'Floppy ears, a waggy tail and the tip of a pink tongue.' },
    bat: { rarity: 'rare', price: 120, icon: '🦇', desc: 'A fuzzy pocket bat with huge ears. It stretches its wings now and then.' },
    parrot: { rarity: 'rare', price: 130, icon: '🦜', desc: 'A bright parrot that bobs its head and ruffles its feathers. Says nothing. Knows everything.' },
    owl: { rarity: 'rare', price: 140, icon: '🦉', desc: 'A wise little owl with big round eyes. It turns its head to see everyone.' },
    fox: { rarity: 'epic', price: 170, icon: '🦊', desc: 'A tiny fire-orange fox curled on your shoulder, swishing its bushy tail.' },
    octopus: { rarity: 'epic', price: 190, icon: '🐙', desc: 'A purple octopus hugging your shoulder with six wiggly arms.' },
    axolotl: { rarity: 'epic', price: 200, icon: '🦎', desc: 'A pink axolotl with frilly gills that wave like it’s underwater.' },
    wispling: { rarity: 'epic', price: 240, icon: '👻', desc: 'A friendly little glowing spirit that floats beside you and never stops smiling.' },
    droneBot: { rarity: 'legendary', price: 300, icon: '🤖', desc: 'A hovering robot buddy with a spinning rotor, a blinking antenna and a screen face.' },
    dragonling: { rarity: 'legendary', price: 380, icon: '🐲', desc: 'A baby dragon with little wings and a spiky tail. Sometimes it puffs a tiny cloud of smoke.' },
  };
  const PET_RARITY = { common: { label: 'Common', color: '#9ad17a' }, rare: { label: 'Rare', color: '#5ab8ff' }, epic: { label: 'Epic', color: '#c77dff' }, legendary: { label: 'Legendary', color: '#ffc83d' } };
  FIELDS.pet = ['pets', 1];
  for (const v of (O.SPECIAL || {}).pets || []) SPECIAL_IDS.add('pet:' + v);
  CATEGORIES.push({ id: 'pets', label: 'Pets', icon: '🐾', fields: ['pet'], target: 'avatar' });
  KIND.pet = 'pet';
  for (const [v, p] of Object.entries(PETS)) { PRICES['pet:' + v] = p.price; DESCRIPTIONS['pet:' + v] = p.desc; }
  DESCRIPTIONS['pet:none'] = 'No pet: your shoulders are free.';
  const CATALOG = Object.entries(FIELDS).flatMap(([field, [list, free]]) => (O[list] || []).map((value, index) => {
    const id = field + ':' + value, gated = GATES[id] || null, passTier = PASS[id] || null, earned = WORLD_ITEM[id] || null;
    const cost = index < free || gated || passTier || earned ? 0 : PRICES[id] != null ? PRICES[id] : field === 'outfit' ? 70 + (index - free) * 8 : 25 + (index - free) * 10;
    const ladder = LADDER[id] || null, category = (CATEGORIES.find((c) => c.fields.includes(field)) || {}).id || 'flair';
    return { id, field, value, name: O.label(value), cost, special: SPECIAL_IDS.has(id), achievement: gated, pass: passTier ? SEASON.id : null, passTier, free: index < free, category, requires: ladder && ladder.requires || null, ladderTier: ladder ? ladder.tier : null,
      world: earned ? earned.world : null, worldGames: earned ? earned.games : null,
      description: earned ? `Earned by finishing ${earned.games === 1 ? 'a game' : earned.games + ' games'} in the ${WORLD_NAMES[earned.world]} world.` : DESCRIPTIONS[id] || `A ${O.label(value).toLowerCase()} ${KIND[field] || 'item'}${index < free ? ' (free for everyone).' : ' for your ' + (slotOf(field).target === 'home' ? 'house.' : 'townsfolk.')}` };
  }));
  for (const i of CATALOG) if (i.cost > 0) i.cost = price(i.cost);
  // ----- Shop stock: what each player can buy grows as they play -----
  // Gold items (not free, not pass/world/achievement rewards) start hidden. A new player sees
  // a small starter stock; finishing games, winning and visiting new worlds put more on the
  // shelves (cheapest first, a mix of kinds). Hidden items cannot be bought.
  const STOCK = { starterPerField: 2, finished: 1, won: 1, newWorld: 2 };
  const STOCKABLE = CATALOG.filter((i) => !i.special && !i.free && !i.pass && !i.world && !i.achievement && !i.requires && i.cost > 0);
  const stockOrder = (a, b) => a.cost - b.cost || CATALOG.indexOf(a) - CATALOG.indexOf(b);
  const STARTER_STOCK = Object.keys(FIELDS).flatMap((f) => STOCKABLE.filter((i) => i.field === f).sort(stockOrder).slice(0, STOCK.starterPerField).map((i) => i.id));
  // The next n hidden items to reveal: the cheapest of each kind in turn, so a reveal mixes
  // clothes, hats, house designs, flair... (deterministic, so tests and players can predict it).
  function nextStock(stock, n) {
    const have = new Set(stock), out = [];
    const byField = Object.keys(FIELDS).map((f) => STOCKABLE.filter((i) => i.field === f && !have.has(i.id)).sort(stockOrder)).filter((l) => l.length);
    const start = have.size % Math.max(1, byField.length);
    for (let round = 0; out.length < n && byField.some((l) => l.length); round++) {
      for (let k = 0; k < byField.length && out.length < n; k++) { const l = byField[(start + k) % byField.length]; if (l.length) out.push(l.shift().id); }
    }
    return out;
  }

  // ----- Fate Tokens ✦: a second currency for one-time Fate Cards (not cosmetics) -----
  // Earned by winning, finishing weekly challenges and visiting new worlds (or traded for
  // gold). Cards bend which role you get; each is spent only if it actually takes effect.
  const FATE = {
    starter: 2, exchangeGold: 120, perWin: 1, perChallenge: 1, perNewWorld: 1,
    cards: {
      wish: { name: 'Role Wish', icon: '🎯', cost: 2, text: 'Before the game, wish for a role. If that role is in the game, it is dealt to you. Spent only if it comes true.' },
      team: { name: 'Team Wish', icon: '⚖️', cost: 1, text: 'Before the game, lean toward the Town or the Mafia. You are dealt a role from that side if the game has a free one. Spent only if it comes true.' },
      reroll: { name: 'Reroll', icon: '🔄', cost: 1, text: 'While you look at your dealt role, swap it once for a different role on the same team.' },
    },
  };

  // Gold rewards per completed game, calculated and paid by the server once per game.
  // Every value is configurable here. Per-category caps and maxPerGame stop players
  // from farming repeated actions; games with bots, forced roles, sped-up clocks,
  // skipped cinematics, fewer than 3 people, or shorter than minimumGameMs pay nothing.
  const REWARDS = {
    completed: 8,          // finished the game
    victory: 12,           // your side won
    neutralVictory: 8,     // extra for a neutral (Jester, Serial Killer, ...) win
    survived: 3,           // alive at the end
    ability: 2, abilityCap: 3,             // role-specific actions used (counted up to the cap)
    objective: 5, objectiveCap: 2,         // objectives completed
    investigation: 3, investigationCap: 3, // correct investigations
    save: 4, saveCap: 2,                   // helping teammates: saves/protections that mattered
    achievement: 10,                       // each achievement unlocked by this game
    oracle: 5, oracleCap: 4,               // right ghost predictions
    spiritBonus: 5,                        // your side won after you died
    maxPerGame: 60, minimumGameMs: 60000,
  };
  // The afterlife: what ghosts can do (see rules/afterlife.js).
  const AFTERLIFE = {
    words: ['Trust', 'Liar', 'Danger', 'Watch', 'Protect', 'Wrong', 'Right', 'Quiet', 'Loud', 'Soon', 'Mafia', 'Innocent'],
    stakes: [10, 25, 50, 100], maxSpirits: 2,
  };
  SEASON.cost = price(SEASON.cost);
  for (const r of Object.values(SEASON.rewards)) if (r.gold) r.gold = pay(r.gold);
  for (const c of Object.values(CHALLENGES)) c.gold = pay(c.gold);
  FATE.exchangeGold = price(FATE.exchangeGold);
  for (const k of ['completed', 'victory', 'neutralVictory', 'survived', 'ability', 'objective', 'investigation', 'save', 'achievement', 'oracle', 'spiritBonus', 'maxPerGame']) REWARDS[k] = pay(REWARDS[k]);
  const API = { PETS, PET_RARITY, ECONOMY, AFTERLIFE, LADDER, FIELDS, CATEGORIES, CATALOG, ACHIEVEMENTS, REWARDS, slotOf, PRICES, DESCRIPTIONS, SEASON, PASS, CHALLENGES, weekKey, weeklyChallenges, EVENTS, WORLD_REWARDS, WORLD_ITEM, WORLD_NAMES, STOCK, STOCKABLE, STARTER_STOCK, nextStock, FATE };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.MT_COSMETICS = API;
})(typeof window !== 'undefined' ? window : globalThis);
