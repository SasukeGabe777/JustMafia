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
    features: ['smile', 'freckles', 'serious'],
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
  OPTIONS.accessory.push('eyepatch', 'backpack', 'satchel', 'monocle', 'amulet');
  OPTIONS.nameplate = ['plain', 'scroll', 'veteran', 'mafiaBoss'];
  OPTIONS.houseDecor = ['none', 'flowers', 'banner', 'lanterns', 'heraldry'];
  OPTIONS.effect = ['none', 'fireflies', 'embers'];
  // Player homes: twelve free building styles and twelve wall paints. Pure
  // presentation, chosen in the lobby and locked at start with the avatar.
  OPTIONS.houseStyle = ['cottage', 'tavern', 'bakery', 'smithy', 'apothecary', 'library', 'chapel', 'tailor', 'watchtower', 'windmill', 'farmhouse', 'manor'];
  OPTIONS.houseColor = ['#eadcb9', '#c4674f', '#d39a55', '#e3c15c', '#9fbe86', '#6ea89b', '#8db2d8', '#5f7aa6', '#a88bc6', '#d996ae', '#8b6a50', '#9c9b95'];
  const colors = {
    '#e74c3c':'Red', '#e67e22':'Orange', '#f1c40f':'Gold', '#2ecc71':'Green', '#1abc9c':'Teal', '#3498db':'Sky Blue', '#2c5fd6':'Royal Blue', '#9b59b6':'Purple', '#e84393':'Pink', '#795548':'Brown', '#7f8c8d':'Gray', '#ecf0f1':'White',
    '#ffe0c4':'Porcelain', '#f3c9a0':'Fair', '#d9a273':'Warm Beige', '#b07a4f':'Tan', '#8a5634':'Brown', '#5c3a21':'Deep Brown',
    '#241b18':'Black', '#543626':'Dark Brown', '#976332':'Light Brown', '#e5c16e':'Blonde', '#ba593c':'Auburn', '#d3d0c8':'Platinum', '#713f95':'Purple', '#b33b38':'Red', '#969b9d':'Gray', '#eeeeea':'White', '#35648f':'Blue', '#39a9ad':'Cyan', '#48905b':'Green', '#d079a6':'Pink',
    '#342b25':'Brown', '#416f91':'Blue', '#477849':'Green', '#89817a':'Gray', '#2d2f3a':'Charcoal', '#355879':'Denim', '#765439':'Brown', '#e3d7bb':'Linen', '#33251d':'Leather', '#151821':'Black', '#f3eee0':'Ivory', '#9b4141':'Burgundy', '#ffffff':'White', '#ffe066':'Gold', '#a6e5ff':'Ice Blue', '#ffb9db':'Rose', '#b1f0ba':'Mint',
    '#eadcb9':'Cream', '#c4674f':'Brick', '#d39a55':'Ochre', '#e3c15c':'Mustard', '#9fbe86':'Sage', '#6ea89b':'Seafoam', '#8db2d8':'Cornflower', '#5f7aa6':'Slate Blue', '#a88bc6':'Lavender', '#d996ae':'Blush', '#8b6a50':'Walnut', '#9c9b95':'Fieldstone' };
  OPTIONS.labels = { ...colors, buzzCut:'Buzz Cut', sidePart:'Side Part', slickedBack:'Slicked Back', royalGuard:'Royal Guard', plagueDoctor:'Plague Doctor', mafiaSuit:'Mafia Suit', detectiveCoat:'Detective Coat', ghostHunter:'Ghost Hunter', shoeStyle:'Shoes', leatherBoots:'Leather Boots', tallBoots:'Tall Boots', armoredBoots:'Armored Boots', nobleShoes:'Noble Shoes', wizardHat:'Wizard Hat', wideBrim:'Wide-Brim Hat', plagueHat:'Plague Doctor Hat', jesterHat:'Jester Hat', flowerCrown:'Flower Crown', mafiaBoss:'Mafia Champion', houseStyle:'Home', houseColor:'Home color' };
  OPTIONS.label = (value) => OPTIONS.labels[value] || OPTIONS.hatLabels[value] || String(value).replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase());
  if (typeof module !== 'undefined' && module.exports) module.exports = OPTIONS;
  else root.MT_OPTIONS = OPTIONS;
})(typeof window !== 'undefined' ? window : globalThis);
