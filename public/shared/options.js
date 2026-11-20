// Shared between server (require) and browser (window.MT_OPTIONS).
(function (root) {
  const OPTIONS = {
    colors: ['#e74c3c', '#e67e22', '#f1c40f', '#2ecc71', '#1abc9c', '#3498db', '#2c5fd6', '#9b59b6', '#e84393', '#795548', '#7f8c8d', '#ecf0f1'],
    skins: ['#ffe0c4', '#f3c9a0', '#d9a273', '#b07a4f', '#8a5634', '#5c3a21'],
    hats: ['none', 'top', 'cap', 'crown', 'beanie', 'party', 'bow', 'cowboy', 'chef'],
    hatLabels: { none: 'None', top: 'Top hat', cap: 'Cap', crown: 'Crown', beanie: 'Beanie', party: 'Party', bow: 'Bow', cowboy: 'Cowboy', chef: 'Chef' },
    hair: ['short', 'long', 'curly', 'bob', 'mohawk', 'bald'],
    hairColor: ['#241b18', '#543626', '#976332', '#e5c16e', '#ba593c', '#d3d0c8', '#713f95'],
    facialHair: ['none', 'moustache', 'beard'],
    eyes: ['#342b25', '#416f91', '#477849', '#89817a'],
    face: ['round', 'oval', 'square'],
    // Face markings only; mood lives in `expression` (saved 'serious' migrates there).
    features: ['none', 'freckles', 'rosyCheeks'],
    expression: ['smile', 'grin', 'neutral', 'serious', 'surprised', 'sad', 'angry', 'wink', 'sleepy', 'smirk'],
    outfit: ['shirt', 'jacket', 'overalls', 'dress'],
    pants: ['#2d2f3a', '#355879', '#765439', '#e3d7bb'],
    shoes: ['#33251d', '#151821', '#f3eee0', '#9b4141'],
    accessory: ['none', 'glasses', 'earring', 'scarf'],
    nameColor: ['#ffffff', '#ffe066', '#a6e5ff', '#ffb9db', '#b1f0ba'],
  };
  OPTIONS.hair = ['short', 'long', 'curly', 'bob', 'mohawk', 'bald', 'buzzCut', 'sidePart', 'messy', 'slickedBack', 'undercut', 'medium', 'wavy', 'ponytail', 'bun', 'braids', 'afro'];
  OPTIONS.hair.push('royalBraids','windswept','silverCrest');
  OPTIONS.hairColor.push('#b33b38', '#969b9d', '#eeeeea', '#35648f', '#39a9ad', '#48905b', '#d079a6');
  OPTIONS.outfit.push('peasant', 'traveler', 'villager', 'tunic', 'worker', 'merchant', 'scholar', 'farmer', 'knight', 'noble', 'assassin', 'royalGuard', 'plagueDoctor', 'wizard', 'executioner', 'sheriff', 'alchemist', 'jester', 'mafiaSuit', 'detectiveCoat', 'ghostHunter', 'storyteller');
  OPTIONS.shoeStyles = ['simple', 'leatherBoots', 'tallBoots', 'sandals', 'armoredBoots', 'nobleShoes'];
  OPTIONS.hats.push('hood', 'helmet', 'wizardHat', 'wideBrim', 'plagueHat', 'bandana', 'jesterHat', 'flowerCrown');
  OPTIONS.hats.push('executionerHood'); // achievement reward: save someone as the Executioner
  OPTIONS.accessory.push('eyepatch', 'backpack', 'satchel', 'monocle', 'amulet');
  OPTIONS.nameplate = ['plain', 'scroll', 'veteran', 'mafiaBoss'];
  OPTIONS.houseDecor = ['none', 'flowers', 'banner', 'lanterns', 'heraldry'];
  OPTIONS.effect = ['none', 'fireflies', 'embers'];
  // Cosmetics wave 2 (shop) and Season 1: Blood Moon (battle-pass exclusives, marked in cosmetics.js PASS).
  OPTIONS.hats.push('halo', 'pirate', 'samurai', 'antlers', 'catEars', 'vikingHelm', 'beret', 'pumpkin', 'bloodCrown');
  OPTIONS.accessory.push('cape', 'wings', 'mask', 'goldChain', 'pipe', 'rose', 'batWings');
  OPTIONS.effect.push('sparkles', 'snow', 'hearts', 'shadow', 'bloodMist', 'lightning');
  OPTIONS.nameplate.push('neon', 'royal', 'bloodMoon', 'gilded');
  OPTIONS.outfit.push('pirateCoat', 'samuraiArmor', 'royalRobe', 'cyber', 'vampire', 'bloodKnight');
  // Themes v2: world cosmetics, earned by playing games in each world (cosmetics.js WORLD_REWARDS).
  OPTIONS.hats.push('spaceHelmet', 'elfCirclet', 'dragonHorns', 'furHat', 'cubeHelm', 'featherCap', 'fedora');
  OPTIONS.outfit.push('spaceSuit', 'dragonScale', 'rogueLeathers', 'tuxedo', 'fedJacket', 'parka', 'blockArmor', 'denimJacket', 'trenchCoat');
  OPTIONS.accessory.push('fairyWings', 'torch', 'shades', 'badge', 'diceBag', 'wristwatch');
  // Player homes (separate from the character): twelve building styles, wall and
  // roof paint, doors, windows and free yard decorations. Shop decor (houseDecor)
  // stays a catalog unlock. Pure presentation; chosen in the lobby, locked at start.
  OPTIONS.houseStyle = ['cottage', 'tavern', 'bakery', 'smithy', 'apothecary', 'library', 'chapel', 'tailor', 'watchtower', 'windmill', 'farmhouse', 'manor'];
  OPTIONS.FREE_HOUSE_STYLES = OPTIONS.houseStyle.length; // the first 12 are free; later ones are shop items
  OPTIONS.houseStyle.push('darkMansion', 'modernHouse', 'rspOffice');
  OPTIONS.houseColor = ['#eadcb9', '#c4674f', '#d39a55', '#e3c15c', '#9fbe86', '#6ea89b', '#8db2d8', '#5f7aa6', '#a88bc6', '#d996ae', '#8b6a50', '#9c9b95'];
  OPTIONS.roofColor = ['theme', '#8a3b2f', '#4c5a6e', '#3f6b4a', '#6a4a7a', '#2f4f80', '#7a5a3a', '#b08a3e', '#5a7f8f', '#3a3a42'];
  OPTIONS.doorStyle = ['plank', 'arched', 'double', 'painted', 'round', 'iron'];
  OPTIONS.windowStyle = ['classic', 'shuttered', 'round', 'stained', 'planters', 'tall'];
  OPTIONS.yard = ['none', 'fence', 'flowerbed', 'mailbox', 'pumpkins', 'birdhouse', 'well', 'laundry'];
  // Single source of truth for saved appearance fields: avatar field -> option list.
  // The server (game.js, profiles.js) validates against this map and the phone
  // creator (creator-config.js) lays it out. To add a customization: add its
  // list above, one line here, and one entry in public/creator-config.js.
  // Update 8: farewell animations (shop items) that play over your body when you die.
  OPTIONS.deathAnim = ['none', 'petals', 'fireflies', 'letter', 'candle', 'lantern', 'starfall', 'ascend', 'ectoplasm', 'soulChains'];
  // The afterlife: how your ghost looks on the big screen (classic is free; the rest are shop
  // items or ghost achievements), and the High Roller line (unlocked by betting).
  OPTIONS.ghostSkin = ['classic', 'sheet', 'chains', 'royalGhost', 'wisp', 'shadowEyes', 'oracle'];
  OPTIONS.hats.push('dealerVisor', 'highRoller');
  OPTIONS.effect.push('goldRain');
  // Live reactions (tap on the phone, they float over your character on the TV). The first
  // pack is free; the others are shop cosmetics. A player equips one pack.
  OPTIONS.reactions = ['rxClassic', 'rxSpooky', 'rxRoyal', 'rxParty', 'rxDetective', 'rxLove', 'rxBloodMoon', 'rxCasino'];
  OPTIONS.REACTION_PACKS = {
    rxClassic: ['😱', '🤨', '🙏', '😂', '👍', '😡'],
    rxSpooky: ['👻', '💀', '🕯️', '🦇', '🎃', '⚰️'],
    rxRoyal: ['👑', '💎', '🍷', '🎩', '🗡️', '🛡️'],
    rxParty: ['🎉', '🥳', '🍕', '🎈', '🕺', '🤪'],
    rxDetective: ['🔍', '🕵️', '🧐', '📝', '🔦', '🚨'],
    rxLove: ['❤️', '😍', '💔', '😘', '🌹', '🥺'],
    rxBloodMoon: ['🩸', '🌕', '🦇', '🗡️', '⚰️', '🌹'], // Season 1 pass reward
    rxCasino: ['🎲', '🃏', '💰', '🎰', '🍀', '💸'], // High Roller tier 1: make your first bet
  };
  // ----- Shop seasons & theme sets (public/shared/shop-season.js, docs/justgold.md) -----
  // Limited-time event items (sold only while their event runs, public/shared/seasons.js) and the
  // new pieces of the themed outfit sets. They are not on the play-to-reveal shelf (cosmetics.js
  // STOCKABLE skips everything listed in OPTIONS.SPECIAL); the shop sells them in Event and Sets.
  OPTIONS.SPECIAL = {};
  const special = (list, values) => { OPTIONS[list].push(...values); (OPTIONS.SPECIAL[list] = OPTIONS.SPECIAL[list] || []).push(...values); };
  // Harvest Fest · Frostival · Sweetheart Week · Spring Bloom · Summer Splash · Spooky Season
  special('hats', ['pumpkinCap', 'strawHat', 'snowBeanie', 'reindeerBand', 'heartBoppers', 'bunnyEars', 'gardenHat', 'bucketHat', 'witchHat', 'devilHorns']);
  special('outfit', ['cosySweater', 'flannel', 'uglySweater', 'cupidCardigan', 'gardener', 'hawaiian', 'lifeguard', 'skeleton', 'mummy']);
  special('accessory', ['autumnScarf', 'ciderMug', 'candyCane', 'earmuffs', 'loveLetter', 'heartShades', 'cupidWings', 'bouquet', 'butterflyWings', 'snorkel', 'surfboard', 'icePop', 'treatBucket']);
  special('shoeStyles', ['iceSkates', 'wellies', 'flipFlops']);
  special('effect', ['fallingLeaves', 'aurora', 'rosePetals', 'butterflies', 'bubbles', 'ghostly', 'batSwarm']);
  special('nameplate', ['harvestMoon', 'frosted', 'sweetheart', 'blossom', 'surf', 'haunted']);
  // Theme sets (Wild West, Secret Agent, Head Chef, Great Detective, High Stakes, Last Survivor, Space Cadet, Paparazzi)
  special('hats', ['trilby', 'deerstalker', 'ufoHat']);
  special('outfit', ['secretAgent', 'chefCoat', 'inverness', 'dealerVest', 'survivor', 'photoVest']);
  special('accessory', ['lasso', 'nightShades', 'woodenSpoon', 'magnifier', 'cardFan', 'rayGun', 'camera']);
  special('shoeStyles', ['spurBoots']);
  special('effect', ['luckyDice', 'orbit']);
  Object.assign(OPTIONS.hatLabels, { pumpkinCap: 'Pumpkin Knit Cap', strawHat: 'Harvest Straw Hat', snowBeanie: 'Snowflake Beanie', reindeerBand: 'Reindeer Antlers', heartBoppers: 'Heart Boppers', bunnyEars: 'Bunny Ears', gardenHat: 'Garden Sun Hat', bucketHat: 'Bucket Hat', witchHat: 'Witch Hat', devilHorns: 'Little Horns', trilby: 'Agent Trilby', deerstalker: 'Deerstalker', ufoHat: 'Saucer Hat' });
  // ----- Events v2: the half-month event calendar (public/shared/seasons.js) -----
  // Limited-time items for every other kind of event (drawn in public/avatar-events.js; nameplates in
  // public/shop/shop.css and public/town.js). Labels: EVENT_LABELS below.
  special('hats', ['starTiara', 'tasselCap', 'plumeHeaddress', 'neonVisor', 'cloverHat', 'leafCrown', 'paperFlower', 'dinoHood', 'octopusHat', 'sparklerCrown', 'alienBoppers', 'starCirclet', 'propellerCap', 'robotHelm', 'captainHat', 'wolfEars', 'rangerHat', 'gumdropCrown']);
  special('outfit', ['sequinSuit', 'silkJacket', 'harlequin', 'glowJacket', 'luckyVest', 'planterApron', 'fiestaShirt', 'dinoOnesie', 'wetsuit', 'bandJacket', 'flightSuit', 'stargazerCloak', 'varsityJacket', 'roboSuit', 'deckhand', 'hunterCoat', 'campVest', 'gingerbreadSuit']);
  special('accessory', ['partyHorn', 'starGlasses', 'paperLantern', 'paperFan', 'carnivalMask', 'beads', 'glowSticks', 'shutterShades', 'potOfGold', 'rainbowScarf', 'seedling', 'wateringCan', 'maracas', 'pinata', 'dinoTail', 'fossilBone', 'airTank', 'trident',
    'sparkler', 'snareDrum', 'jetpack', 'pocketPlanet', 'telescope', 'starPendant', 'giantPencil', 'shinyApple', 'bigWrench', 'laserVisor', 'cutlass', 'spyglass', 'crimsonCape', 'moonLantern', 'marshmallow', 'campLantern', 'lollipop', 'peppermintScarf']);
  special('shoeStyles', ['glitterShoes', 'silkSlippers', 'lightUpKicks', 'buckleShoes', 'gardenClogs', 'dinoFeet', 'flippers', 'bandBoots', 'moonBoots', 'sneakers', 'mechBoots', 'buccaneerBoots', 'hikingBoots']);
  special('effect', ['confetti', 'skyLanterns', 'streamers', 'neonRings', 'luckyClovers', 'seedPuffs', 'paperFlags', 'pterodactyls', 'jellyfish', 'fireworkBursts', 'miniRockets', 'shootingStars', 'paperPlanes', 'gears', 'seagulls', 'redMoon', 'campSparks', 'sprinkles']);
  special('nameplate', ['midnight', 'lanternGlow', 'carnival', 'synthwave', 'shamrock', 'evergreen', 'fiesta', 'fossil', 'abyss', 'skyburst', 'galaxy', 'stardust', 'chalkboard', 'circuit', 'treasure', 'crimson', 'campfire', 'icing']);
  const EVENT_LABELS = {
    starTiara: 'Countdown Tiara', tasselCap: 'Lucky Tassel Cap', plumeHeaddress: 'Carnival Plumes', neonVisor: 'Neon Visor', cloverHat: 'Clover Top Hat', leafCrown: 'Leafy Crown', paperFlower: 'Giant Paper Flower', dinoHood: 'Dino Hood', octopusHat: 'Octopus Hat',
    sparklerCrown: 'Sparkler Crown', alienBoppers: 'Alien Boppers', starCirclet: 'Star Circlet', propellerCap: 'Propeller Cap', robotHelm: 'Robot Helm', captainHat: 'Captain’s Bicorne', wolfEars: 'Werewolf Ears', rangerHat: 'Ranger Hat', gumdropCrown: 'Gumdrop Crown',
    sequinSuit: 'Sequin Party Suit', silkJacket: 'Silk Lantern Jacket', harlequin: 'Harlequin Suit', glowJacket: 'Glow Jacket', luckyVest: 'Lucky Green Vest', planterApron: 'Planter’s Apron', fiestaShirt: 'Embroidered Fiesta Shirt', dinoOnesie: 'Dino Onesie', wetsuit: 'Deep Dive Wetsuit',
    bandJacket: 'Marching Band Jacket', flightSuit: 'Mission Flight Suit', stargazerCloak: 'Stargazer Cloak', varsityJacket: 'Varsity Jacket', roboSuit: 'Robo Suit', deckhand: 'Deckhand Stripes', hunterCoat: 'Moon Hunter Coat', campVest: 'Camp Vest', gingerbreadSuit: 'Gingerbread Suit',
    partyHorn: 'Party Horn', starGlasses: 'Star Glasses', paperLantern: 'Paper Lantern', paperFan: 'Paper Fan', carnivalMask: 'Feathered Mask', beads: 'Parade Beads', glowSticks: 'Glow Sticks', shutterShades: 'Shutter Shades', potOfGold: 'Pot of Gold', rainbowScarf: 'Rainbow Scarf',
    seedling: 'Potted Seedling', wateringCan: 'Watering Can', maracas: 'Maracas', pinata: 'Mini Piñata', dinoTail: 'Dino Tail', fossilBone: 'Fossil Bone', airTank: 'Air Tank', trident: 'Sea Trident', sparkler: 'Sparkler', snareDrum: 'Snare Drum', jetpack: 'Jetpack', pocketPlanet: 'Pocket Planet',
    telescope: 'Telescope', starPendant: 'Star Pendant', giantPencil: 'Giant Pencil', shinyApple: 'Shiny Apple', bigWrench: 'Big Wrench', laserVisor: 'Laser Visor', cutlass: 'Toy Cutlass', spyglass: 'Spyglass', crimsonCape: 'Crimson Cape', moonLantern: 'Moon Lantern', marshmallow: 'Toasted Marshmallow',
    campLantern: 'Camp Lantern', lollipop: 'Giant Lollipop', peppermintScarf: 'Peppermint Scarf',
    glitterShoes: 'Glitter Shoes', silkSlippers: 'Silk Slippers', lightUpKicks: 'Light-Up Kicks', buckleShoes: 'Buckle Shoes', gardenClogs: 'Garden Clogs', dinoFeet: 'Dino Feet', flippers: 'Flippers', bandBoots: 'Band Boots', moonBoots: 'Moon Boots', sneakers: 'Fresh Sneakers',
    mechBoots: 'Mech Boots', buccaneerBoots: 'Buccaneer Boots', hikingBoots: 'Hiking Boots',
    confetti: 'Confetti Pop', skyLanterns: 'Sky Lanterns', streamers: 'Parade Streamers', neonRings: 'Neon Rings', luckyClovers: 'Lucky Clovers', seedPuffs: 'Dandelion Seeds', paperFlags: 'Paper Flags', pterodactyls: 'Tiny Pterodactyls', jellyfish: 'Glow Jellies',
    fireworkBursts: 'Fireworks', miniRockets: 'Mini Rockets', shootingStars: 'Shooting Stars', paperPlanes: 'Paper Planes', gears: 'Spinning Gears', seagulls: 'Seagulls', redMoon: 'Red Moon Rising', campSparks: 'Campfire Sparks', sprinkles: 'Sprinkle Shower',
    midnight: 'Midnight', lanternGlow: 'Lantern Glow', carnival: 'Carnival', synthwave: 'Synthwave', shamrock: 'Shamrock', evergreen: 'Evergreen', fiesta: 'Fiesta', fossil: 'Fossil', abyss: 'The Abyss', skyburst: 'Skyburst', galaxy: 'Galaxy', stardust: 'Stardust',
    chalkboard: 'Chalkboard', circuit: 'Circuit Board', treasure: 'Treasure Map', crimson: 'Crimson Moon', campfire: 'Campfire', icing: 'Sugar Icing',
  };
  // Body type (free): the character is drawn clearly female or male (public/avatar.js drawSmooth).
  OPTIONS.body = ['male', 'female'];
  // Looks saved before body types existed: long hairstyles or a dress read as female.
  OPTIONS.inferBody = (av) => (av && OPTIONS.body.includes(av.body) ? av.body : av && (['long', 'wavy', 'braids', 'bob', 'ponytail', 'bun', 'royalBraids', 'medium'].includes(av.hair) || av.outfit === 'dress') ? 'female' : 'male');
  OPTIONS.AVATAR_FIELDS = {
    color: 'colors', skin: 'skins', hat: 'hats', hair: 'hair', hairColor: 'hairColor', facialHair: 'facialHair', eyes: 'eyes', face: 'face',
    features: 'features', expression: 'expression', outfit: 'outfit', pants: 'pants', shoes: 'shoes', shoeStyle: 'shoeStyles', accessory: 'accessory',
    nameColor: 'nameColor', nameplate: 'nameplate', effect: 'effect', deathAnim: 'deathAnim', reactions: 'reactions', ghostSkin: 'ghostSkin',
    body: 'body',
  };
  // Same idea for a player's house design (player.homeLook / profile.home).
  // Legacy saves kept houseStyle/houseColor/houseDecor on the avatar; see LEGACY_HOME.
  OPTIONS.HOME_FIELDS = { style: 'houseStyle', wall: 'houseColor', roof: 'roofColor', door: 'doorStyle', windows: 'windowStyle', yard: 'yard', decor: 'houseDecor' };
  OPTIONS.LEGACY_HOME = { style: 'houseStyle', wall: 'houseColor', decor: 'houseDecor' };
  OPTIONS.MAX_RESIDENTS = 4; // owner + 3 guests per house
  const colors = {
    '#e74c3c':'Red', '#e67e22':'Orange', '#f1c40f':'Gold', '#2ecc71':'Green', '#1abc9c':'Teal', '#3498db':'Sky Blue', '#2c5fd6':'Royal Blue', '#9b59b6':'Purple', '#e84393':'Pink', '#795548':'Brown', '#7f8c8d':'Gray', '#ecf0f1':'White',
    '#ffe0c4':'Porcelain', '#f3c9a0':'Fair', '#d9a273':'Warm Beige', '#b07a4f':'Tan', '#8a5634':'Brown', '#5c3a21':'Deep Brown',
    '#241b18':'Black', '#543626':'Dark Brown', '#976332':'Light Brown', '#e5c16e':'Blonde', '#ba593c':'Auburn', '#d3d0c8':'Platinum', '#713f95':'Purple', '#b33b38':'Red', '#969b9d':'Gray', '#eeeeea':'White', '#35648f':'Blue', '#39a9ad':'Cyan', '#48905b':'Green', '#d079a6':'Pink',
    '#342b25':'Brown', '#416f91':'Blue', '#477849':'Green', '#89817a':'Gray', '#2d2f3a':'Charcoal', '#355879':'Denim', '#765439':'Brown', '#e3d7bb':'Linen', '#33251d':'Leather', '#151821':'Black', '#f3eee0':'Ivory', '#9b4141':'Burgundy', '#ffffff':'White', '#ffe066':'Gold', '#a6e5ff':'Ice Blue', '#ffb9db':'Rose', '#b1f0ba':'Mint',
    '#eadcb9':'Cream', '#c4674f':'Brick', '#d39a55':'Ochre', '#e3c15c':'Mustard', '#9fbe86':'Sage', '#6ea89b':'Seafoam', '#8db2d8':'Cornflower', '#5f7aa6':'Slate Blue', '#a88bc6':'Lavender', '#d996ae':'Blush', '#8b6a50':'Walnut', '#9c9b95':'Fieldstone',
    theme:'Theme default', '#8a3b2f':'Terracotta', '#4c5a6e':'Slate', '#3f6b4a':'Moss', '#6a4a7a':'Plum', '#2f4f80':'Navy', '#7a5a3a':'Thatch', '#b08a3e':'Straw', '#5a7f8f':'Teal Slate', '#3a3a42':'Charcoal Tile' };
  OPTIONS.labels = { ...colors, male: 'Male', female: 'Female', buzzCut:'Buzz Cut', sidePart:'Side Part', slickedBack:'Slicked Back', royalGuard:'Royal Guard', plagueDoctor:'Plague Doctor', mafiaSuit:'Mafia Suit', detectiveCoat:'Detective Coat', ghostHunter:'Ghost Hunter', shoeStyle:'Shoes', leatherBoots:'Leather Boots', tallBoots:'Tall Boots', armoredBoots:'Armored Boots', nobleShoes:'Noble Shoes', wizardHat:'Wizard Hat', wideBrim:'Wide-Brim Hat', plagueHat:'Plague Doctor Hat', jesterHat:'Jester Hat', flowerCrown:'Flower Crown', mafiaBoss:'Mafia Champion', houseStyle:'Home', houseColor:'Home color', rosyCheeks:'Rosy Cheeks', houseDecor:'Home decor', executionerHood:'Hood of Mercy', darkMansion:'Dark Mansion', modernHouse:'Modern House', rspOffice:'RSP Supply Office',
    halo:'Halo', pirate:'Pirate Hat', samurai:'Samurai Kabuto', antlers:'Antlers', catEars:'Cat Ears', vikingHelm:'Viking Helm', beret:'Beret', pumpkin:'Pumpkin Head', bloodCrown:'Blood Moon Crown',
    cape:'Royal Cape', wings:'Angel Wings', mask:'Masquerade Mask', goldChain:'Gold Chain', pipe:'Pipe', rose:'Rose', batWings:'Bat Wings',
    sparkles:'Sparkles', snow:'Snowfall', hearts:'Hearts', shadow:'Shadow Aura', bloodMist:'Blood Mist', lightning:'Storm',
    neon:'Neon', royal:'Royal', bloodMoon:'Blood Moon', gilded:'Gilded',
    spaceHelmet:'Space Helmet', elfCirclet:'Elven Circlet', dragonHorns:'Dragon Horns', furHat:'Fur Trapper Hat', cubeHelm:'Cube Helm', featherCap:'Feathered Cap', fedora:'Fedora',
    spaceSuit:'Space Suit', dragonScale:'Dragon-Scale Mail', rogueLeathers:'Rogue Leathers', tuxedo:'Tuxedo', fedJacket:'Bureau Jacket', parka:'Parka', blockArmor:'Block Armor', denimJacket:'Denim Jacket', trenchCoat:'Trench Coat',
    fairyWings:'Fairy Wings', torch:'Torch', shades:'Agent Shades', badge:'Federal Badge', diceBag:'Dice Bag', wristwatch:'Wristwatch',
    pirateCoat:'Pirate Coat', samuraiArmor:'Samurai Armor', royalRobe:'Royal Robe', cyber:'Cyber Suit', vampire:'Vampire Count', bloodKnight:'Blood Knight',
    rxClassic:'Classic Reactions', rxSpooky:'Spooky Reactions', rxRoyal:'Royal Reactions', rxParty:'Party Reactions', rxDetective:'Detective Reactions', rxLove:'Sweetheart Reactions', rxBloodMoon:'Blood Moon Reactions', rxCasino:'Casino Reactions',
    classic:'Classic Ghost', sheet:'Bedsheet Ghost', chains:'Chained Spirit', royalGhost:'Royal Phantom', wisp:'Will-o’-Wisp', shadowEyes:'Shadow Wraith', oracle:'The Oracle', ghostSkin:'Ghost',
    dealerVisor:'Dealer’s Visor', highRoller:'High Roller Top Hat', goldRain:'Jackpot Rain', ectoplasm:'Ectoplasm', soulChains:'Breaking Chains',
    cosySweater:'Cosy Sweater', flannel:'Flannel Shirt', uglySweater:'Ugly Sweater', cupidCardigan:'Cupid’s Cardigan', gardener:'Garden Overalls', hawaiian:'Hawaiian Shirt', lifeguard:'Lifeguard Tee', skeleton:'Skeleton Suit', mummy:'Mummy Wraps',
    autumnScarf:'Autumn Scarf', ciderMug:'Hot Cider', candyCane:'Candy Cane', earmuffs:'Fluffy Earmuffs', loveLetter:'Love Letter', heartShades:'Heart Shades', cupidWings:'Cupid Wings', bouquet:'Spring Bouquet', butterflyWings:'Butterfly Wings', snorkel:'Snorkel Mask', surfboard:'Surfboard', icePop:'Ice Lolly', treatBucket:'Treat Bucket',
    iceSkates:'Ice Skates', wellies:'Rain Wellies', flipFlops:'Flip-Flops', fallingLeaves:'Falling Leaves', aurora:'Northern Lights', rosePetals:'Rose Petal Shower', butterflies:'Butterflies', bubbles:'Beach Bubbles', ghostly:'Ghost Friends', batSwarm:'Bat Swarm',
    harvestMoon:'Harvest Moon', frosted:'Frosted', sweetheart:'Sweetheart', blossom:'Blossom', surf:'Surf’s Up', haunted:'Haunted',
    secretAgent:'Agent Suit', chefCoat:'Chef’s Whites', inverness:'Inverness Coat', dealerVest:'Dealer’s Vest', survivor:'Survivor Gear', photoVest:'Photographer’s Vest',
    lasso:'Lasso', nightShades:'Night-Vision Shades', woodenSpoon:'Wooden Spoon', magnifier:'Magnifying Glass', cardFan:'Fan of Aces', rayGun:'Ray Gun', camera:'Camera', spurBoots:'Spur Boots', luckyDice:'Lucky Dice', orbit:'Orbiting Planets',
    deathAnim:'Farewell', petals:'Rose Petals', fireflies:'Fireflies', letter:'A Last Letter', candle:'Candlelight', lantern:'Sky Lantern', starfall:'Falling Stars', ascend:'Spirit Rises' };
  Object.assign(OPTIONS.labels, EVENT_LABELS); // events v2 (above)
  OPTIONS.label = (value) => OPTIONS.labels[value] || OPTIONS.hatLabels[value] || String(value).replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase());
  if (typeof module !== 'undefined' && module.exports) module.exports = OPTIONS;
  else root.MT_OPTIONS = OPTIONS;
})(typeof window !== 'undefined' ? window : globalThis);
