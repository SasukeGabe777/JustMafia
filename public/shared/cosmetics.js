(function (root) {
  const O = typeof module !== 'undefined' && module.exports ? require('./options') : root.MT_OPTIONS;
  const FIELDS = { hair: ['hair', 17], outfit: ['outfit', 12], hat: ['hats', 9], shoeStyle: ['shoeStyles', 4], accessory: ['accessory', 6], nameplate: ['nameplate', 1], houseDecor: ['houseDecor', 1], effect: ['effect', 1] };
  const ACHIEVEMENTS = { mafiaWins5: { label: 'Win five Mafia games', stat: 'mafiaWins', count: 5 }, saves10: { label: 'Save ten players', stat: 'saves', count: 10 }, jesterWin: { label: 'Win as Jester', stat: 'jesterWins', count: 1 }, investigations5: { label: 'Identify five Mafia', stat: 'correctInvestigations', count: 5 }, survive10: { label: 'Survive ten games', stat: 'survived', count: 10 } };
  const GATES = { 'outfit:plagueDoctor': 'saves10', 'outfit:detectiveCoat': 'investigations5', 'outfit:jester': 'jesterWin', 'nameplate:mafiaBoss': 'mafiaWins5', 'outfit:ghostHunter': 'survive10' };
  const CATALOG = Object.entries(FIELDS).flatMap(([field, [list, free]]) => O[list].map((value, index) => ({ id: field + ':' + value, field, value, name: O.label(value), cost: index < free || GATES[field + ':' + value] ? 0 : field === 'outfit' ? 70 + (index - free) * 8 : 25 + (index - free) * 10, achievement: GATES[field + ':' + value] || null, free: index < free })));
  const REWARDS = { completed: 8, victory: 12, survived: 3, neutralVictory: 8, ability: 2, abilityCap: 3, objective: 5, objectiveCap: 2, investigation: 3, investigationCap: 3, maxPerGame: 45, minimumGameMs: 60000 };
  const API = { FIELDS, CATALOG, ACHIEVEMENTS, REWARDS };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.MT_COSMETICS = API;
})(typeof window !== 'undefined' ? window : globalThis);
