'use strict';
// Unlockable games. A locked game shows on the main menu with its unlock hint. Finishing a whole
// Party Mode opens every locked game for good on this TV (the server sends an 'unlock' cue).
// Add more unlockables to LIST and to box/room.js UNLOCK_RULES. The main menu's ⚙ menu can
// unlock everything for testing.
(function () {
  const LIST = {
    zombie: { title: 'Zombie Survival', icon: '🧟', how: 'Finish a Party Mode to unlock it.' },
  };
  const KEY = 'box.unlocks', SEEN = 'box.unlocksSeen';
  const read = (k) => { try { const v = JSON.parse(localStorage.getItem(k) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; } };
  const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
  window.UNLOCKS = {
    LIST,
    all: () => read(KEY).filter((k) => LIST[k]),
    has: (key) => !LIST[key] || read(KEY).includes(key),
    isLockable: (key) => !!LIST[key],
    // Returns true the first time a game is unlocked.
    add(key) { if (!LIST[key]) return false; const l = read(KEY); if (l.includes(key)) return false; l.push(key); write(KEY, l); return true; },
    // Unlocked but its unlock animation not shown on the main menu yet.
    fresh: () => read(KEY).filter((k) => LIST[k] && !read(SEEN).includes(k)),
    // Testing: open everything, or lock it all again.
    unlockAll() { write(KEY, Object.keys(LIST)); },
    lockAll() { write(KEY, []); write(SEEN, []); },
    seen(key) { const s = read(SEEN); if (!s.includes(key)) { s.push(key); write(SEEN, s); } },
  };
})();
