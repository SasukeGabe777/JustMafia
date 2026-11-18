'use strict';
// JustEscape: the case of the Magpie. Detective Hazel Finch narrates; each room is one chapter.
// Every line Hazel says out loud is static (so it can be pre-voiced): the intro file lists them
// in `story` (public/box/intros/escape.js copies STORY lines).
//
// A room: its name and set (the TV draws `scene`), Hazel's lines, the props each kind of lock
// uses there, the words for word locks, and the suspects for the final accusation.
const ROOMS = [
  {
    key: 'study', name: 'The Clockmaker’s Study', icon: '🕰️', scene: 'study',
    intro: 'Thank goodness you came. I am Detective Hazel Finch. My old friend Elias Vane, the clockmaker, has vanished, and his study was locked from the inside. His Golden Gear is gone too. Each of you is holding a different piece of the evidence. Talk to each other, open every lock, and tell me who did it.',
    solved: 'Splendid work! A magpie feather, tucked inside the clock. Our thief works for someone called the Magpie, and here is a ticket for the Midnight Express.',
    epilogue: 'The Golden Gear is back where it belongs, and Elias was hiding safe in the clock tower all along. But the Magpie is still out there. Case closed, for tonight.',
    failed: 'Time is up! I picked the last lock myself. We found the culprit, but the Magpie’s trail went cold for a while.',
    props: {
      cipher: { name: 'The wall safe', icon: '🔐', eyes: ['Elias’s journal', 'The safe door'], hands: 'The safe keypad' },
      dial: { name: 'The grandfather clock', icon: '🕰️', eyes: ['An old photograph', 'A note in the margin'], hands: 'The clock hands' },
      switches: { name: 'The music box', icon: '🎶', eyes: ['The tune card', 'The pin diagram'], hands: 'The music box pins' },
      word: { name: 'The gear drawer', icon: '⚙️', eyes: ['Gear tags'], hands: 'The letter lock' },
      maze: { name: 'The trapdoor cellar', icon: '🕯️', eyes: ['Elias’s cellar map'], hands: 'The lantern (you)' },
    },
    words: { 5: ['GEARS', 'CHIME', 'SPOOL'], 6: ['SPRING', 'CUCKOO', 'BRONZE'], 7: ['TICKING', 'BALANCE', 'WINDING'] },
    kinds: ['cipher', 'dial', 'word', 'switches'],
    suspects: [['Ada Pell', 'housekeeper'], ['Tobias Wren', 'apprentice'], ['Lord Ashby', 'collector'], ['Nell Quarry', 'rival clockmaker'], ['Doctor Fenwick', 'neighbour'], ['Silas Moor', 'delivery man']],
  },
  {
    key: 'train', name: 'The Midnight Express', icon: '🚂', scene: 'train',
    intro: 'All aboard the Midnight Express. The Magpie’s crew struck again: the Duchess’s blue diamond was swapped for glass somewhere in Car Seven. The train reaches the border at dawn. Search the carriage, open every lock, and find the swapper before we arrive.',
    solved: 'The real diamond! And a lighthouse key, stamped Gull Point. The Magpie is hiding by the sea.',
    epilogue: 'The diamond is back with the Duchess, and the swapper is in handcuffs. The Magpie slipped off at the last station, though. Another night, my friends.',
    failed: 'We are pulling into the station! I cracked the last lock just in time, but the Magpie’s crew got a head start.',
    props: {
      cipher: { name: 'The luggage trunk', icon: '🧳', eyes: ['A coded luggage tag', 'The trunk’s brass plate'], hands: 'The trunk lock' },
      dial: { name: 'The station clock', icon: '🕛', eyes: ['A crumpled timetable', 'A conductor’s note'], hands: 'The clock hands' },
      switches: { name: 'The signal levers', icon: '🚦', eyes: ['The signal card', 'The rail diagram'], hands: 'The lever frame' },
      word: { name: 'The torn telegram', icon: '📜', eyes: ['Telegram scraps'], hands: 'The cabin door lock' },
      maze: { name: 'The dark baggage car', icon: '🔦', eyes: ['The baggage plan'], hands: 'The torch (you)' },
    },
    words: { 5: ['STEAM', 'TRACK', 'COACH'], 6: ['TICKET', 'SIGNAL', 'ENGINE'], 7: ['STATION', 'WHISTLE', 'CABOOSE'] },
    kinds: ['maze', 'cipher', 'word', 'switches'],
    suspects: [['Conductor Baines', 'conductor'], ['Madame Rousseau', 'fortune teller'], ['Captain Hale', 'retired sailor'], ['Ivy Locke', 'singer'], ['Mr. Pratt', 'salesman'], ['Lady Thorne', 'heiress']],
  },
  {
    key: 'lighthouse', name: 'The Lighthouse at Gull Point', icon: '🗼', scene: 'lighthouse',
    intro: 'Gull Point lighthouse. The storm is rolling in, and the Magpie is somewhere inside with everything they ever stole. This is the hardest lock of my career, and I cannot open it alone. Light the lamp, open the vault, and unmask the Magpie at last.',
    solved: 'The lamp is lit and the vault is open! Every stolen treasure, right here.',
    epilogue: 'The Magpie is caught at last, the treasures go home, and Elias wants to build you all a clock. Case closed. You are the finest detectives I have ever worked with.',
    failed: 'The storm hit and I forced the vault myself. We caught the Magpie, but only just. Next time, let us be quicker.',
    props: {
      cipher: { name: 'The lamp room hatch', icon: '💡', eyes: ['The keeper’s logbook', 'The hatch carvings'], hands: 'The hatch dials' },
      dial: { name: 'The tide clock', icon: '🌊', eyes: ['A tide chart', 'A water-stained note'], hands: 'The tide clock hands' },
      switches: { name: 'The lens shutters', icon: '🔆', eyes: ['The ship’s light code', 'The shutter wiring'], hands: 'The shutter switches' },
      word: { name: 'The vault door', icon: '🗝️', eyes: ['Logbook pages'], hands: 'The vault letters' },
      maze: { name: 'The spiral stairs in the dark', icon: '🌀', eyes: ['The keeper’s floor plan'], hands: 'The candle (you)' },
    },
    words: { 5: ['OCEAN', 'STORM', 'CLIFF'], 6: ['BEACON', 'HARBOR', 'ANCHOR'], 7: ['LANTERN', 'SEAGULL', 'COMPASS'] },
    kinds: ['maze', 'switches', 'cipher', 'dial'],
    suspects: [['Keeper Morrow', 'lighthouse keeper'], ['Finn Doyle', 'ferryman'], ['Doctor Salt', 'naturalist'], ['Rosa Delgado', 'painter'], ['Old Gideon', 'fisherman'], ['Mabel Crisp', 'reporter']],
  },
];

// Lines Hazel says during play (also static, so they can be pre-voiced).
const LINES = {
  start: 'The clock is ticking. Read your evidence out loud, and listen to each other.',
  lock: 'Click! That lock is open.',
  wrong: 'Hmm, that is not it. Check the evidence again.',
  accuse: 'Every lock is open. Now, who did it? Share your clues and point to the culprit.',
  wrongAccuse: 'No. The evidence does not fit that person. Look again, carefully.',
  right: 'Got them! Well spotted, detectives.',
  hint: 'A hint, from one detective to another.',
  half: 'Half the time is gone. Keep going!',
  minute: 'One minute left!',
  closed: 'Case closed.',
};

// Suspect looks for the line-up (the TV draws them; the clues talk about them).
const TRAITS = {
  hat: ['a top hat', 'a beret', 'a flat cap', 'no hat'],
  coat: ['red', 'green', 'blue', 'yellow', 'grey'],
  item: ['a cane', 'an umbrella', 'a pipe', 'a book', 'a lantern'],
};
const SYMBOLS = ['☀', '☾', '★', '♠', '♣', '♥', '♦', '⚓', '✿', '♞', '☂', '✦'];
const COLORS = [['red', '#e8453c'], ['blue', '#3b7bf0'], ['green', '#2fb35a'], ['yellow', '#f5c518'], ['purple', '#9b59d0'], ['orange', '#f08a24'], ['white', '#f2efe6'], ['black', '#2a2a2a']];

module.exports = { ROOMS, LINES, TRAITS, SYMBOLS, COLORS };
