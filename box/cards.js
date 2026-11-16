'use strict';
// Standard playing cards for the box's games. A card is a short string: rank + suit
// ('AS', '10H', 'QD'); extra decks add a copy tag ('7C~2') so every card id is unique.
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const SUITS = ['S', 'H', 'D', 'C'];
const SUIT_ICON = { S: '♠', H: '♥', D: '♦', C: '♣' };
const PLURAL = { A: 'Aces', 2: 'Twos', 3: 'Threes', 4: 'Fours', 5: 'Fives', 6: 'Sixes', 7: 'Sevens', 8: 'Eights', 9: 'Nines', 10: 'Tens', J: 'Jacks', Q: 'Queens', K: 'Kings' };

const deck = (copies = 1) => { const d = []; for (let c = 0; c < copies; c++) for (const s of SUITS) for (const r of RANKS) d.push(c ? `${r}${s}~${c}` : r + s); return d; };
const shuffle = (arr, rng) => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };
const base = (card) => card.replace(/~\d+$/, '');
const rankOf = (card) => base(card).slice(0, -1);
const suitOf = (card) => base(card).slice(-1);
const rankIndex = (card) => RANKS.indexOf(rankOf(card)); // 0 (A) … 12 (K)

module.exports = { RANKS, SUITS, SUIT_ICON, PLURAL, deck, shuffle, base, rankOf, suitOf, rankIndex };
