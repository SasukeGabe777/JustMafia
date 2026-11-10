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
  // field -> [option list, how many are free from the start]
  const FIELDS = { hair: ['hair', 17], outfit: ['outfit', 12], hat: ['hats', 9], shoeStyle: ['shoeStyles', 4], accessory: ['accessory', 6], nameplate: ['nameplate', 1], houseDecor: ['houseDecor', 1], effect: ['effect', 1], houseStyle: ['houseStyle', 12] };
  if (O.deathAnim) FIELDS.deathAnim = ['deathAnim', 1];
  // Shop sections. `target` says what equipping changes: the character or the house.
  const CATEGORIES = [
    { id: 'clothing', label: 'Clothing', icon: '👕', fields: ['outfit', 'shoeStyle'], target: 'avatar' },
    { id: 'accessories', label: 'Hats & Gear', icon: '🎩', fields: ['hat', 'accessory'], target: 'avatar' },
    { id: 'hair', label: 'Hairstyles', icon: '💇', fields: ['hair'], target: 'avatar' },
    { id: 'house', label: 'House', icon: '🏠', fields: ['houseStyle', 'houseDecor'], target: 'home' },
    { id: 'flair', label: 'Flair', icon: '✨', fields: ['nameplate', 'effect'], target: 'avatar' },
    { id: 'animations', label: 'Animations', icon: '🎬', fields: ['deathAnim'], target: 'avatar' },
  ];
  // Where an equipped item lives: avatar field, or house design field (HOME_FIELDS key).
  const SLOT = { houseStyle: { target: 'home', key: 'style' }, houseDecor: { target: 'home', key: 'decor' } };
  const slotOf = (field) => SLOT[field] || { target: 'avatar', key: field };
  const PRICES = { 'houseStyle:darkMansion': 140, 'houseStyle:modernHouse': 120, 'houseStyle:rspOffice': 160 };
  const DESCRIPTIONS = {
    'houseStyle:darkMansion': 'A towering, gloomy mansion with iron gates and a single candle in the attic. Fits the darkest secrets.',
    'houseStyle:modernHouse': 'Clean lines, big windows and a flat roof. The most futuristic address in town.',
    'houseStyle:rspOffice': 'A tidy yellow-and-blue corporate branch office, courtesy of RSP Supply.',
    'outfit:plagueDoctor': 'The beaked coat of a healer who has seen too much. Earned by saving ten players.',
    'outfit:detectiveCoat': 'A long coat with deep pockets for clues. Earned by identifying five Mafia.',
    'outfit:jester': 'Bells, stripes and zero regrets. Earned by winning as the Jester.',
    'nameplate:mafiaBoss': 'A gold-trimmed nameplate for proven bosses. Earned by winning five Mafia games.',
    'outfit:ghostHunter': 'Gear for someone who has survived it all. Earned by surviving ten games.',
  };
  const KIND = { hair: 'hairstyle', outfit: 'outfit', hat: 'hat', shoeStyle: 'pair of shoes', accessory: 'accessory', nameplate: 'nameplate', houseDecor: 'house decoration', effect: 'cosmetic effect', houseStyle: 'house design', deathAnim: 'farewell animation' };
  const ACHIEVEMENTS = { mafiaWins5: { label: 'Win five Mafia games', stat: 'mafiaWins', count: 5 }, saves10: { label: 'Save ten players', stat: 'saves', count: 10 }, jesterWin: { label: 'Win as Jester', stat: 'jesterWins', count: 1 }, investigations5: { label: 'Identify five Mafia', stat: 'correctInvestigations', count: 5 }, survive10: { label: 'Survive ten games', stat: 'survived', count: 10 } };
  const GATES = { 'outfit:plagueDoctor': 'saves10', 'outfit:detectiveCoat': 'investigations5', 'outfit:jester': 'jesterWin', 'nameplate:mafiaBoss': 'mafiaWins5', 'outfit:ghostHunter': 'survive10' };
  const CATALOG = Object.entries(FIELDS).flatMap(([field, [list, free]]) => (O[list] || []).map((value, index) => {
    const id = field + ':' + value, gated = GATES[id] || null;
    const cost = index < free || gated ? 0 : PRICES[id] != null ? PRICES[id] : field === 'outfit' ? 70 + (index - free) * 8 : 25 + (index - free) * 10;
    const category = (CATEGORIES.find((c) => c.fields.includes(field)) || {}).id || 'flair';
    return { id, field, value, name: O.label(value), cost, achievement: gated, free: index < free, category,
      description: DESCRIPTIONS[id] || `A ${O.label(value).toLowerCase()} ${KIND[field] || 'item'}${index < free ? ' (free for everyone).' : ' for your ' + (slotOf(field).target === 'home' ? 'house.' : 'townsfolk.')}` };
  }));
  // Gold rewards per completed game. Values are configurable; caps stop farming.
  const REWARDS = { completed: 8, victory: 12, survived: 3, neutralVictory: 8, ability: 2, abilityCap: 3, objective: 5, objectiveCap: 2, investigation: 3, investigationCap: 3, save: 4, saveCap: 2, maxPerGame: 45, minimumGameMs: 60000 };
  const API = { FIELDS, CATEGORIES, CATALOG, ACHIEVEMENTS, REWARDS, slotOf, PRICES, DESCRIPTIONS };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.MT_COSMETICS = API;
})(typeof window !== 'undefined' ? window : globalThis);
