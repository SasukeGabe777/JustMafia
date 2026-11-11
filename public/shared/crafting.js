// The Crafter's materials, recipes and tools (shared: the server enforces them, the phone
// shows them). All names and art are this game's own.
//   - Search for a material once each night and once each day (one random find).
//   - Craft any time you're alive, if you have the ingredients. Tools stack.
//   - Use a tool when its time comes; each use spends one tool.
(function (root) {
  const MATERIALS = {
    wood: { name: 'Wood', icon: '🪵', weight: 30 },
    stone: { name: 'Stone', icon: '🪨', weight: 25 },
    iron: { name: 'Iron', icon: '⛓️', weight: 18 },
    glass: { name: 'Glass', icon: '🔷', weight: 15 },
    string: { name: 'String', icon: '🧵', weight: 12 },
  };
  // when: 'night' = used at night (resolves at dawn) · 'day' = during discussion or voting.
  // target: 'others' = pick a player · 'self' = no target.
  const RECIPES = {
    pickaxe: { name: 'Pickaxe', icon: '⛏️', needs: { wood: 1, stone: 1, iron: 1 }, when: 'night', target: 'others',
      text: 'Break a window at night and see who really lives there: their TRUE role at dawn. No disguise, frame or cover story fools it.' },
    lantern: { name: 'Lantern', icon: '🏮', needs: { glass: 1, string: 1 }, when: 'night', target: 'self',
      text: 'Hang it by your door tonight: at dawn you learn everyone who visited your house.' },
    magnifier: { name: 'Magnifying Glass', icon: '🔍', needs: { glass: 1, iron: 1 }, when: 'night', target: 'self',
      text: 'Keep your eyes open all night: at dawn you learn every visit that happened (who went to whose house).' },
    sword: { name: 'Sword', icon: '🗡️', needs: { wood: 1, iron: 2 }, when: 'day', target: 'others',
      text: 'During the day, strike one player down on the spot. Nobody learns who held the sword.' },
  };
  const DAY_SEARCH = ['morning', 'discussion', 'voting'];
  const DAY_USE = ['discussion', 'voting'];
  function canCraft(materials, recipe) { const r = RECIPES[recipe]; return !!r && Object.entries(r.needs).every(([m, n]) => (materials[m] || 0) >= n); }
  // A weighted random material (rng returns [0, 1)).
  function findMaterial(rng) {
    const list = Object.entries(MATERIALS), total = list.reduce((t, [, m]) => t + m.weight, 0);
    let x = rng() * total;
    for (const [id, m] of list) { if ((x -= m.weight) < 0) return id; }
    return list[0][0];
  }
  const API = { MATERIALS, RECIPES, DAY_SEARCH, DAY_USE, canCraft, findMaterial };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.MT_CRAFTING = API;
})(typeof window !== 'undefined' ? window : globalThis);
