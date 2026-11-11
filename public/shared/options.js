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
  OPTIONS.deathAnim = ['none', 'petals', 'fireflies', 'letter', 'candle', 'lantern', 'starfall', 'ascend'];
  // Live reactions (tap on the phone, they float over your character on the TV). The first
  // pack is free; the others are shop cosmetics. A player equips one pack.
  OPTIONS.reactions = ['rxClassic', 'rxSpooky', 'rxRoyal', 'rxParty', 'rxDetective', 'rxLove'];
  OPTIONS.REACTION_PACKS = {
    rxClassic: ['😱', '🤨', '🙏', '😂', '👍', '😡'],
    rxSpooky: ['👻', '💀', '🕯️', '🦇', '🎃', '⚰️'],
    rxRoyal: ['👑', '💎', '🍷', '🎩', '🗡️', '🛡️'],
    rxParty: ['🎉', '🥳', '🍕', '🎈', '🕺', '🤪'],
    rxDetective: ['🔍', '🕵️', '🧐', '📝', '🔦', '🚨'],
    rxLove: ['❤️', '😍', '💔', '😘', '🌹', '🥺'],
  };
  OPTIONS.AVATAR_FIELDS = {
    color: 'colors', skin: 'skins', hat: 'hats', hair: 'hair', hairColor: 'hairColor', facialHair: 'facialHair', eyes: 'eyes', face: 'face',
    features: 'features', expression: 'expression', outfit: 'outfit', pants: 'pants', shoes: 'shoes', shoeStyle: 'shoeStyles', accessory: 'accessory',
    nameColor: 'nameColor', nameplate: 'nameplate', effect: 'effect', deathAnim: 'deathAnim', reactions: 'reactions',
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
  OPTIONS.labels = { ...colors, buzzCut:'Buzz Cut', sidePart:'Side Part', slickedBack:'Slicked Back', royalGuard:'Royal Guard', plagueDoctor:'Plague Doctor', mafiaSuit:'Mafia Suit', detectiveCoat:'Detective Coat', ghostHunter:'Ghost Hunter', shoeStyle:'Shoes', leatherBoots:'Leather Boots', tallBoots:'Tall Boots', armoredBoots:'Armored Boots', nobleShoes:'Noble Shoes', wizardHat:'Wizard Hat', wideBrim:'Wide-Brim Hat', plagueHat:'Plague Doctor Hat', jesterHat:'Jester Hat', flowerCrown:'Flower Crown', mafiaBoss:'Mafia Champion', houseStyle:'Home', houseColor:'Home color', rosyCheeks:'Rosy Cheeks', houseDecor:'Home decor', executionerHood:'Hood of Mercy', darkMansion:'Dark Mansion', modernHouse:'Modern House', rspOffice:'RSP Supply Office',
    halo:'Halo', pirate:'Pirate Hat', samurai:'Samurai Kabuto', antlers:'Antlers', catEars:'Cat Ears', vikingHelm:'Viking Helm', beret:'Beret', pumpkin:'Pumpkin Head', bloodCrown:'Blood Moon Crown',
    cape:'Royal Cape', wings:'Angel Wings', mask:'Masquerade Mask', goldChain:'Gold Chain', pipe:'Pipe', rose:'Rose', batWings:'Bat Wings',
    sparkles:'Sparkles', snow:'Snowfall', hearts:'Hearts', shadow:'Shadow Aura', bloodMist:'Blood Mist', lightning:'Storm',
    neon:'Neon', royal:'Royal', bloodMoon:'Blood Moon', gilded:'Gilded',
    spaceHelmet:'Space Helmet', elfCirclet:'Elven Circlet', dragonHorns:'Dragon Horns', furHat:'Fur Trapper Hat', cubeHelm:'Cube Helm', featherCap:'Feathered Cap', fedora:'Fedora',
    spaceSuit:'Space Suit', dragonScale:'Dragon-Scale Mail', rogueLeathers:'Rogue Leathers', tuxedo:'Tuxedo', fedJacket:'Bureau Jacket', parka:'Parka', blockArmor:'Block Armor', denimJacket:'Denim Jacket', trenchCoat:'Trench Coat',
    fairyWings:'Fairy Wings', torch:'Torch', shades:'Agent Shades', badge:'Federal Badge', diceBag:'Dice Bag', wristwatch:'Wristwatch',
    pirateCoat:'Pirate Coat', samuraiArmor:'Samurai Armor', royalRobe:'Royal Robe', cyber:'Cyber Suit', vampire:'Vampire Count', bloodKnight:'Blood Knight',
    rxClassic:'Classic Reactions', rxSpooky:'Spooky Reactions', rxRoyal:'Royal Reactions', rxParty:'Party Reactions', rxDetective:'Detective Reactions', rxLove:'Sweetheart Reactions',
    deathAnim:'Farewell', petals:'Rose Petals', fireflies:'Fireflies', letter:'A Last Letter', candle:'Candlelight', lantern:'Sky Lantern', starfall:'Falling Stars', ascend:'Spirit Rises' };
  OPTIONS.label = (value) => OPTIONS.labels[value] || OPTIONS.hatLabels[value] || String(value).replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase());
  if (typeof module !== 'undefined' && module.exports) module.exports = OPTIONS;
  else root.MT_OPTIONS = OPTIONS;
})(typeof window !== 'undefined' ? window : globalThis);
