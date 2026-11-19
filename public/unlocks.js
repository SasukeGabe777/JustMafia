'use strict';
// Unlockable games. A locked game shows on the main menu with its unlock hint. Finishing a whole
// Party Mode opens every locked game for good on this TV (the server sends an 'unlock' cue).
// from: the game whose finish unlocks it ('party' = a whole Party Mode).
// Add more unlockables to LIST and to box/room.js UNLOCK_RULES. The main menu's ⚙ menu can
// unlock everything for testing.
(function () {
  const LIST = {
    zombie: { from: 'party', title: 'Zombie Survival', icon: '🧟', how: 'Finish a Party Mode to unlock it.' },
    plinko: { from: 'blackjack', title: 'JustDrop', icon: '🎯', how: 'Finish a game of Blackjack Night to unlock it.' },
    quickdraw: { from: 'president', title: "Quick Draw", icon: "⚡", how: "Finish a game of President to unlock it." },
    bomb: { from: 'truths', title: "Bomb Squad", icon: "💣", how: "Finish a game of Two Truths & a Lie to unlock it." },
    alien: { from: 'likely', title: "Alien Abduction", icon: "🛸", how: "Finish a game of Most Likely To… to unlock it." },
    tune: { from: 'funny', title: "Tune Buzz", icon: "🎵", how: "Finish a game of JustFunny to unlock it." },
    actout: { from: 'sketch', title: "Act It Out", icon: "🎭", how: "Finish a game of JustSketch Relay to unlock it." },
    debate: { from: 'spectrum', title: "Debate Club", icon: "🗣️", how: "Finish a game of Where Do You Stand? to unlock it." },
    trivia: { from: 'price', title: "Hot Take Trivia", icon: "🧠", how: "Finish a game of Price Panic to unlock it." },
    colormatch: { from: 'emoji', title: "Color Match", icon: "🎨", how: "Finish a game of Emoji Charades to unlock it." },
    memes: { from: 'blanks', title: "Meme Maker", icon: "🖼️", how: "Finish a game of JustBlanks to unlock it." },
    letters: { from: 'whosaid', title: "Letter Rush", icon: "🔤", how: "Finish a game of Who Said It? to unlock it." },
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
