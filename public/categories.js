'use strict';
// The game categories, shared by the main menu shelves (hub.js) and Party Mode (party/party.js).
// Every small-game tile in hub.html says which one it belongs to with data-type="<k>".
// A new game only needs its tile: it lands on its shelf and in Party Mode automatically.
window.GAME_CATS = [
  { k: 'cards', name: 'Cards & Casino', icon: '🃏', c: '#18b06a', sub: 'Cards, chips and auctions' },
  { k: 'guess', name: 'Guess & Trivia', icon: '🎯', c: '#ff4f9a', sub: 'Prices, songs, emoji, quizzes' },
  { k: 'create', name: 'Create & Laugh', icon: '🎨', c: '#ff7134', sub: 'Draw, write, act, make memes' },
  { k: 'friends', name: 'Friends & Secrets', icon: '💬', c: '#8b5cff', sub: 'Bluff, vote and find out' },
  { k: 'action', name: 'Action & Teamwork', icon: '⚡', c: '#14b8dc', sub: 'Reflexes, battles and co-op' },
];
