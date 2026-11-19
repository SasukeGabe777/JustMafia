'use strict';
// YesChef (internal key `pizza`, it began as JustPizza): the YesChef food court, where five
// owners compete for the best cooks in town. A customer comes to the counter and shows (or tells)
// the dish they want; then it's hidden and everyone rebuilds it from memory on their phone. The
// closest dish earns the biggest tip.
//
// Kitchens (setting `kitchen`; 'surprise' picks one per game, 'court' a different one per order):
//   pizza   Pizzeria Pina, Nonna Pina: crust, sauce, cheese, toppings painted onto 8 slices.
//           Placement is compared under every turn and flip of the pie.
//   taco    El Cohete taco truck, Tía Lupe: shell, filling, salsa, toppings on each of 3 tacos.
//           The tacos on the plate can be in any order.
//   sushi   Ren's Sushi Bar, Chef Ren: wrap, rice, filling, toppings on each of 8 pieces (two rows
//           of four). The board can be turned around (piece i <-> piece 7-i).
//   burger  Buck's Burger Joint, Big Buck: bun, then layers stacked bottom to top. ORDER MATTERS.
//   sundae  Coco's Sundae Stand, Coco Sprinkles: cone/cup/bowl, scoops stacked in order, sauce,
//           and a set of toppings.
// A dish: { <row>: value, ..., top: { <topping>: slot mask }, stack: [layer, ...] } (only the
// parts its kitchen has). match() (0..100) adds up the rows (each its own weight), the toppings
// (kinds, amounts and placement, best over the kitchen's symmetries) and the stack (which layers
// and their order). Deterministic, no randomness.
//
// Modes (setting `mode`, the same for every kitchen; the `halves` twist is named by the kitchen):
//   classic  Classic Order: the customer shows the dish for a few seconds.
//   rush     Lunch Rush: twice the orders, small and quick; serving early earns a speed tip.
//   halves   Half & Half / Mix & Match / Rainbow Roll / Tower Burger / Mega Sundae.
//   phone    Phone Order: no picture, the customer reads the order out in words.
//   flash    Flash Order: a glimpse of two seconds, and more on it.
//   chef     Head Chef: one player sees the ticket on their phone and describes it out loud;
//            everyone else builds. The head chef earns the cooks' average. It rotates.
//   mixed    A different mode every round.
// Every phone input is validated; timers use room.after; results() lists ids best-first.
const GEARS = require('../../public/shared/gear');

const opt = (pairs) => pairs.map(([value, label]) => ({ value, label }));
const MODES = {
  classic: { name: 'Classic Order', icon: '🍽️', peek: 6000, build: 1, tops: [2, 3], place: ['whole', 'whole', 'half'], stack: [4, 5], scoops: [2, 3], sprinkle: [1, 2] },
  rush: { name: 'Lunch Rush', icon: '⏱️', peek: 3500, build: 0.5, tops: [1, 2], place: ['whole', 'whole', 'whole', 'half'], speed: true, stack: [3, 4], scoops: [1, 2], sprinkle: [1, 1] },
  halves: { name: 'Half & Half', icon: '🌗', peek: 7000, build: 1, sections: true, stack: [7, 8], scoops: [4, 4], sprinkle: [3, 4] },
  phone: { name: 'Phone Order', icon: '☎️', peek: 9500, build: 1, tops: [2, 3], place: ['whole', 'half', 'half'], words: true, stack: [4, 5], scoops: [2, 3], sprinkle: [2, 2] },
  flash: { name: 'Flash Order', icon: '⚡', peek: 2200, build: 1, tops: [4, 5], place: ['whole', 'half', 'half'], stack: [5, 6], scoops: [3, 3], sprinkle: [3, 3] },
  chef: { name: 'Head Chef', icon: '🧑‍🍳', peek: 4000, build: 1.25, tops: [3, 4], place: ['whole', 'half', 'half'], chef: true, stack: [5, 6], scoops: [3, 3], sprinkle: [2, 3] },
};
const MODE_KEYS = Object.keys(MODES);

// ---------------- the kitchens ----------------
const list = (a) => (a.length < 2 ? a[0] || '' : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]);
const W8 = 0xff;
const KITCHENS = {
  pizza: {
    name: 'Pizzeria Pina', place: 'pizzeria', icon: '🍕', owner: 'Nonna Pina', dish: 'pizza', dishes: 'pizzas',
    modes: { halves: ['Half & Half', '🌗'] },
    rows: [
      { key: 'crust', opts: ['thin', 'classic', 'deep'], def: 'classic', w: 0.08, near: 0.4, pick: ['thin', 'classic', 'deep'] },
      { key: 'sauce', opts: ['tomato', 'white', 'pesto', 'bbq', 'none'], def: 'none', w: 0.12, pick: ['tomato', 'tomato', 'tomato', 'white', 'pesto', 'bbq', 'none'] },
      { key: 'cheese', opts: [0, 1, 2], def: 0, w: 0.1, num: 0.5, pick: [1, 1, 1, 2, 2, 0] },
    ],
    slots: 8, sym: 'ring', wTop: 0.7,
    tops: ['pepperoni', 'mushroom', 'pepper', 'olive', 'onion', 'pineapple', 'ham', 'basil', 'jalapeno', 'sausage'],
    at: { whole: [W8], half: [0x0f, 0xf0], quarter: [0x03, 0x0c, 0x30, 0xc0] },
    names: { thin: 'thin crust', classic: 'classic crust', deep: 'deep dish', tomato: 'tomato sauce', white: 'white garlic sauce', pesto: 'pesto', bbq: 'barbecue sauce', none: 'no sauce', pepperoni: 'pepperoni', mushroom: 'mushrooms', pepper: 'green peppers', olive: 'black olives', onion: 'red onion', pineapple: 'pineapple', ham: 'ham', basil: 'basil', jalapeno: 'jalapeños', sausage: 'sausage' },
  },
  taco: {
    name: 'El Cohete', place: 'taco truck', icon: '🌮', owner: 'Tía Lupe', dish: 'taco plate', dishes: 'taco plates',
    modes: { halves: ['Mix & Match', '🎨'], rush: ['Taco Rush', '⏱️'] },
    rows: [
      { key: 'shell', opts: ['corn', 'flour', 'crunchy'], def: 'corn', w: 0.08, pick: ['corn', 'corn', 'flour', 'crunchy'] },
      { key: 'filling', opts: ['asada', 'chicken', 'pastor', 'fish', 'beans'], def: 'beans', w: 0.12, pick: ['asada', 'chicken', 'pastor', 'fish', 'beans'] },
      { key: 'salsa', opts: ['verde', 'roja', 'mango', 'none'], def: 'none', w: 0.1, pick: ['verde', 'roja', 'roja', 'mango', 'none'] },
    ],
    slots: 3, sym: 'perm', wTop: 0.7,
    tops: ['onion', 'cilantro', 'lime', 'pineapple', 'queso', 'lettuce', 'pico', 'avocado', 'radish', 'jalapeno'],
    at: { whole: [7], half: [3, 4], quarter: [1, 2, 4] },
    names: { corn: 'corn tortillas', flour: 'flour tortillas', crunchy: 'crunchy shells', asada: 'carne asada', chicken: 'grilled chicken', pastor: 'al pastor', fish: 'crispy fish', beans: 'black beans', verde: 'salsa verde', roja: 'salsa roja', mango: 'mango salsa', none: 'no salsa', onion: 'onion', cilantro: 'cilantro', lime: 'lime', pineapple: 'pineapple', queso: 'queso fresco', lettuce: 'lettuce', pico: 'pico de gallo', avocado: 'avocado', radish: 'radish', jalapeno: 'jalapeños' },
  },
  sushi: {
    name: 'Ren’s Sushi Bar', place: 'sushi bar', icon: '🍣', owner: 'Chef Ren', dish: 'roll', dishes: 'rolls',
    modes: { halves: ['Rainbow Roll', '🌈'], rush: ['Conveyor Rush', '⏱️'] },
    rows: [
      { key: 'wrap', opts: ['nori', 'soy', 'cucumber'], def: 'nori', w: 0.08, pick: ['nori', 'nori', 'soy', 'cucumber'] },
      { key: 'rice', opts: ['white', 'brown', 'black'], def: 'white', w: 0.07, pick: ['white', 'white', 'brown', 'black'] },
      { key: 'filling', opts: ['salmon', 'tuna', 'crab', 'shrimp', 'veggie'], def: 'veggie', w: 0.15, pick: ['salmon', 'tuna', 'crab', 'shrimp', 'veggie'] },
    ],
    slots: 8, sym: 'line', wTop: 0.7,
    tops: ['roe', 'sesame', 'scallion', 'mayo', 'eel', 'avocado', 'crunch', 'jalapeno', 'lemon', 'chili'],
    at: { whole: [W8], half: [0x0f, 0xf0], quarter: [0x03, 0x0c, 0x30, 0xc0], alt: [0x55, 0xaa] },
    names: { nori: 'nori seaweed', soy: 'pink soy paper', cucumber: 'cucumber wrap', white: 'white rice', brown: 'brown rice', black: 'black rice', salmon: 'salmon', tuna: 'tuna', crab: 'crab', shrimp: 'shrimp tempura', veggie: 'cucumber and avocado', roe: 'orange roe', sesame: 'sesame seeds', scallion: 'scallions', mayo: 'spicy mayo', eel: 'eel sauce', avocado: 'avocado slices', crunch: 'tempura crunch', jalapeno: 'jalapeño', lemon: 'lemon', chili: 'chili threads' },
  },
  burger: {
    name: 'Buck’s Burger Joint', place: 'burger joint', icon: '🍔', owner: 'Big Buck', dish: 'burger', dishes: 'burgers',
    modes: { halves: ['Tower Burger', '🗼'], rush: ['Drive-Thru Rush', '⏱️'] },
    rows: [{ key: 'bun', opts: ['sesame', 'brioche', 'pretzel', 'lettuce'], def: 'sesame', w: 0.12, pick: ['sesame', 'sesame', 'brioche', 'pretzel', 'lettuce'] }],
    stack: ['patty', 'cheese', 'bacon', 'lettuce', 'tomato', 'onion', 'pickle', 'egg', 'ketchup', 'mustard'], maxStack: 10, wStack: 0.88,
    names: { sesame: 'sesame bun', brioche: 'brioche bun', pretzel: 'pretzel bun', lettuce: 'lettuce', patty: 'patty', cheese: 'cheese', bacon: 'bacon', tomato: 'tomato', onion: 'onion', pickle: 'pickles', egg: 'fried egg', ketchup: 'ketchup', mustard: 'mustard' },
  },
  sundae: {
    name: 'Coco’s Sundae Stand', place: 'sundae stand', icon: '🍨', owner: 'Coco Sprinkles', dish: 'sundae', dishes: 'sundaes',
    modes: { halves: ['Mega Sundae', '🏔️'], rush: ['Heat Wave', '🌡️'] },
    rows: [
      { key: 'vessel', opts: ['cone', 'cup', 'bowl'], def: 'cup', w: 0.08, pick: ['cone', 'cup', 'bowl'] },
      { key: 'sauce', opts: ['fudge', 'caramel', 'berry', 'none'], def: 'none', w: 0.12, pick: ['fudge', 'caramel', 'berry', 'none'] },
    ],
    stack: ['vanilla', 'chocolate', 'strawberry', 'mint', 'mango', 'blueberry'], maxStack: 4, wStack: 0.45,
    slots: 1, sym: 'one', wTop: 0.35,
    tops: ['whip', 'cherry', 'sprinkles', 'nuts', 'wafer', 'banana', 'gummies', 'cookie', 'marshmallow', 'chips'],
    names: { cone: 'waffle cone', cup: 'glass cup', bowl: 'waffle bowl', fudge: 'hot fudge', caramel: 'caramel sauce', berry: 'berry sauce', none: 'no sauce', vanilla: 'vanilla', chocolate: 'chocolate', strawberry: 'strawberry', mint: 'mint chip', mango: 'mango', blueberry: 'blueberry', whip: 'whipped cream', cherry: 'a cherry', sprinkles: 'sprinkles', nuts: 'nuts', wafer: 'a wafer', banana: 'banana slices', gummies: 'gummy bears', cookie: 'cookie crumbs', marshmallow: 'marshmallows', chips: 'chocolate chips' },
  },
};
const KITCHEN_KEYS = Object.keys(KITCHENS);
for (const [k, K] of Object.entries(KITCHENS)) K.key = k;
const kOf = (x) => KITCHENS[x && typeof x === 'object' ? x.k : x] || KITCHENS.pizza;
const modeName = (K, mode) => (K.modes[mode] || [MODES[mode].name])[0];
const modeIcon = (K, mode) => (mode === 'classic' ? K.icon : (K.modes[mode] || [null, MODES[mode].icon])[1]);

const fields = [
  { key: 'kitchen', label: 'Kitchen', options: opt([['surprise', '🎲 Surprise me (a random kitchen)'], ['court', '🔀 Food court (a new kitchen each order)'], ['pizza', '🍕 Pizzeria (Nonna Pina)'], ['taco', '🌮 Taco Truck (Tía Lupe)'], ['sushi', '🍣 Sushi Bar (Chef Ren)'], ['burger', '🍔 Burger Joint (Big Buck)'], ['sundae', '🍨 Sundae Stand (Coco)']]) },
  { key: 'mode', label: 'Kitchen mode', options: opt([['classic', '🍽️ Classic Order'], ['rush', '⏱️ Lunch Rush'], ['halves', '🌗 Special (Half & Half, Rainbow Roll…)'], ['phone', '☎️ Phone Order'], ['flash', '⚡ Flash Order'], ['chef', '🧑‍🍳 Head Chef'], ['mixed', '🎲 Mixed (a new mode each order)']]) },
  { key: 'rounds', label: 'Orders', options: opt([[3, '3 orders'], [5, '5 orders'], [8, '8 orders']]) },
  { key: 'seconds', label: 'Time to build', options: opt([[30, '30 seconds'], [45, '45 seconds'], [60, '60 seconds']]) },
];
const defaults = { kitchen: 'surprise', mode: 'mixed', rounds: 5, seconds: 45 };

// The customers who come to each counter (drawn on the TV from these looks; `hs` hair style).
const CUSTOMERS = {
  pizza: [
    { id: 'gus', name: 'Gus', job: 'the firefighter', skin: '#e0a67a', shirt: '#d6452f', hat: 'helmet', hair: '#3a2416' },
    { id: 'dot', name: 'Dot', job: 'the marathon runner', skin: '#8d5a3b', shirt: '#2fb3a4', hat: 'band', hair: '#1d120b', hs: 'top' },
    { id: 'ted', name: 'Grandpa Ted', job: 'the retired sailor', skin: '#f0c4a0', shirt: '#2c4f8a', hat: 'sailor', hair: '#e9e4dc', beard: true },
    { id: 'kiki', name: 'Kiki', job: 'the skateboarder', skin: '#c98d62', shirt: '#9b5de5', hat: 'cap', hair: '#ff5fa2', hs: 'long' },
    { id: 'lou', name: 'Big Lou', job: 'the trucker', skin: '#b5784f', shirt: '#4a7a3a', hat: 'trucker', hair: '#2a1a10', beard: true },
    { id: 'mia', name: 'Little Mia', job: 'who just won her football match', skin: '#f2c9a5', shirt: '#ffb703', hat: 'bows', hair: '#7a3e1d', kid: true },
    { id: 'hugo', name: 'Professor Hugo', job: 'the astronomer', skin: '#d7a07a', shirt: '#6b4fa0', hat: 'none', hair: '#8a8a8a', glasses: true, hs: 'sides' },
    { id: 'daisy', name: 'Officer Daisy', job: 'on her lunch break', skin: '#6e4630', shirt: '#2a3f6e', hat: 'police', hair: '#1b0f08' },
    { id: 'biscuit', name: 'Biscuit', job: 'a very good dog', dog: true, skin: '#c8924f', shirt: '#e63946', hat: 'none', hair: '#8a5a2b' },
  ],
  taco: [
    { id: 'sol', name: 'Sol', job: 'the surfer, still wet', skin: '#c98d62', shirt: '#2ec4b6', hat: 'none', hair: '#f2d16b', hs: 'long' },
    { id: 'rita', name: 'Coach Rita', job: 'the volleyball coach', skin: '#a8714c', shirt: '#ff6b35', hat: 'cap', hair: '#2a1a10' },
    { id: 'zeke', name: 'Zeke', job: 'the street musician', skin: '#6e4630', shirt: '#6a4c93', hat: 'beanie', hair: '#1b0f08', beard: true },
    { id: 'nora', name: 'Dr. Nora', job: 'off a long night shift', skin: '#f0c4a0', shirt: '#5fa8d3', hat: 'none', hair: '#7a3e1d', glasses: true, hs: 'top' },
    { id: 'bo', name: 'Bo', job: 'the bridge builder', skin: '#d7a07a', shirt: '#f4a259', hat: 'hardhat', hair: '#3a2416', beard: true },
    { id: 'pip', name: 'Little Pip', job: 'with birthday money', skin: '#8d5a3b', shirt: '#ef476f', hat: 'crown', hair: '#1d120b', kid: true },
  ],
  sushi: [
    { id: 'grace', name: 'Captain Grace', job: 'the airline pilot', skin: '#6e4630', shirt: '#f1f1f1', hat: 'pilot', hair: '#1b0f08' },
    { id: 'mo', name: 'Mo', job: 'the gamer, between levels', skin: '#c98d62', shirt: '#3a86ff', hat: 'phones', hair: '#2a1a10' },
    { id: 'ines', name: 'Inès', job: 'the painter', skin: '#f2c9a5', shirt: '#e76f51', hat: 'beret', hair: '#4a2a14', hs: 'long' },
    { id: 'yuki', name: 'Yuki', job: 'the snowboarder', skin: '#f0cfa8', shirt: '#00b4d8', hat: 'beanie', hair: '#1a1a22' },
    { id: 'reggie', name: 'Sir Reggie', job: 'the knight from the school play', skin: '#e0a67a', shirt: '#8d99ae', hat: 'crown', hair: '#c2a15a', kid: true },
    { id: 'ola', name: 'Grandma Ola', job: 'the ferry captain', skin: '#8d5a3b', shirt: '#2c4f8a', hat: 'sailor', hair: '#e9e4dc', glasses: true },
  ],
  burger: [
    { id: 'hank', name: 'Hank', job: 'the rancher', skin: '#e0a67a', shirt: '#a3483a', hat: 'cowboy', hair: '#6b4a2a', beard: true },
    { id: 'tess', name: 'Tess', job: 'the race-car mechanic', skin: '#a8714c', shirt: '#264653', hat: 'cap', hair: '#1d120b', hs: 'long' },
    { id: 'rex', name: 'Rex', job: 'the wrestler', skin: '#d7a07a', shirt: '#e63946', hat: 'band', hair: '#2a1a10' },
    { id: 'june', name: 'Grandma June', job: 'the bowling champion', skin: '#f0c4a0', shirt: '#9b5de5', hat: 'none', hair: '#e9e4dc', glasses: true, hs: 'top' },
    { id: 'max', name: 'Max', job: 'after football practice', skin: '#6e4630', shirt: '#2a9d8f', hat: 'none', hair: '#1b0f08', kid: true },
    { id: 'noodle', name: 'Noodle', job: 'a very hungry dog', dog: true, skin: '#e8d8c0', shirt: '#3a86ff', hat: 'none', hair: '#3a2416' },
  ],
  sundae: [
    { id: 'lulu', name: 'Lulu', job: 'with a wobbly tooth', skin: '#f2c9a5', shirt: '#ff70a6', hat: 'bows', hair: '#e9b04a', kid: true },
    { id: 'pat', name: 'Pat', job: 'the lifeguard', skin: '#c98d62', shirt: '#ef233c', hat: 'band', hair: '#f2d16b', hs: 'long' },
    { id: 'bloom', name: 'Mr. Bloom', job: 'the gardener', skin: '#8d5a3b', shirt: '#6a994e', hat: 'sunhat', hair: '#3a2416', beard: true },
    { id: 'kofi', name: 'DJ Kofi', job: 'on his way to a gig', skin: '#6e4630', shirt: '#7209b7', hat: 'phones', hair: '#1b0f08' },
    { id: 'pia', name: 'Princess Pia', job: 'from the birthday party next door', skin: '#a8714c', shirt: '#ffafcc', hat: 'crown', hair: '#2a1a10', kid: true },
    { id: 'ted2', name: 'Uncle Ted', job: 'the ice-cream critic', skin: '#f0c4a0', shirt: '#457b9d', hat: 'beret', hair: '#8a8a8a', glasses: true, beard: true },
  ],
};
// What each owner says during the game (copied into the intro's owner `story` lists so they are pre-voiced).
const LINES = {
  pizza: {
    first: 'Here comes our first customer. Look closely, my darlings!',
    look: ['Eyes on the order. Remember everything!', 'Look, look! Crust, sauce, cheese, toppings.', 'Another hungry customer. Watch carefully!'],
    phone: 'The phone is ringing! Listen carefully.',
    flash: 'Blink and you miss it!',
    rush: 'Lunch rush! Fast, fast, fast!',
    chef: 'One of you has the ticket. Read it out loud, and do not show your phone!',
    chefBuild: 'Listen to your head chef, and build it!',
    build: ['Now make it! From memory!', 'Quick, quick, before the oven gets cold!', 'To your stations! Make it just like the order.'],
    great: ['Perfetto! Just like my mamma made.', 'Bellissimo! The customer is so happy.'],
    ok: ['Not bad, not bad. A little more love next time.', 'Close! The customer will still pay.'],
    bad: ['Mamma mia! What is this?', 'Oh no. That customer will not come back.'],
    last: 'Last order of the night. Make it beautiful!',
    over: 'We close the shop. Grazie, my cooks, you did beautifully!',
  },
  taco: {
    first: 'Our first customer! Watch the plate, mis amigos!',
    look: ['Look! Shell, filling, salsa, and what goes on each taco.', 'Eyes on the plate. Every taco counts!', 'Here comes another hungry one. Watch closely!'],
    phone: 'The truck phone is ringing! Listen!',
    flash: 'Quick look! Faster than a hot tortilla!',
    rush: 'Taco rush! The line goes around the block!',
    chef: 'One of you has the ticket. Read it out loud, no peeking!',
    chefBuild: 'Listen to your head chef and fill those tacos!',
    build: ['Now build it! From memory!', 'To the griddle! Go, go, go!', 'Three tacos, just like the order!'],
    great: ['Perfecto! That plate is a work of art!', 'Wow! The customer is dancing!'],
    ok: ['Close! A little more salsa in your heart next time.', 'Not bad! They will still leave a tip.'],
    bad: ['Ay, no! What happened to my tacos?', 'Oh dear. That customer is going to the burger joint.'],
    last: 'Last plate before the truck closes. Make it shine!',
    over: 'The grill is off! Gracias, my cooks. What a night!',
  },
  sushi: {
    first: 'Our first guest. Watch carefully. Every piece matters.',
    look: ['Look closely. The wrap, the rice, the filling, every piece.', 'Breathe. Watch. Remember.', 'A new guest. Eyes on the board.'],
    phone: 'A phone order. Listen with your whole heart.',
    flash: 'A single glimpse. Like a falling leaf.',
    rush: 'The conveyor is speeding up. Stay calm, move fast.',
    chef: 'One of you holds the ticket. Speak clearly. Do not show it.',
    chefBuild: 'Listen to your head chef. Then roll.',
    build: ['Now, roll it. From memory.', 'To your boards. Precise and calm.', 'Eight pieces. Make every one count.'],
    great: ['Beautiful. Like a poem on a plate.', 'Perfect balance. The guest bows to you.'],
    ok: ['Good. Not perfect. Tomorrow, better.', 'Close. The guest is pleased enough.'],
    bad: ['Hmm. The fish is crying.', 'That roll has lost its way.'],
    last: 'Last order of the evening. Make it your finest.',
    over: 'The knives are clean. Thank you, my cooks. Well rolled.',
  },
  burger: {
    first: 'Order up! Here comes our first customer, folks!',
    look: ['Watch that stack! Bottom to top, it all counts.', 'Eyes on the burger! What goes where?', 'Another hungry customer! Look sharp!'],
    phone: 'Drive-thru speaker! Listen up!',
    flash: 'Blink and that burger is gone!',
    rush: 'Drive-thru rush! Flip it fast!',
    chef: 'One of you has the ticket. Holler it out, but keep that phone hidden!',
    chefBuild: 'Listen to your head chef and stack it up!',
    build: ['Now build it! Bottom bun up!', 'Fire up the grill! Go, go, go!', 'Stack it just like the order, partner!'],
    great: ['Now that is a burger! Order up!', 'Hoo-wee! Best burger this side of the food court!'],
    ok: ['Not bad! Maybe watch that stack a little closer.', 'Close enough! They are still munching.'],
    bad: ['Whoa! That is not a burger, that is a sandwich mystery!', 'Yikes! That one fell apart before the table.'],
    last: 'Last call at the grill! Make it a big one!',
    over: 'Grill is off, lights are low. Great flipping tonight, cooks!',
  },
  sundae: {
    first: 'First customer! Ooh, look at that sundae!',
    look: ['Watch it! The scoops go in order, bottom to top!', 'Eyes on the sundae! Cone, scoops, sauce, toppings!', 'Another sweet tooth! Look closely!'],
    phone: 'Ring ring! A sundae order by phone! Listen!',
    flash: 'Quick, before it melts!',
    rush: 'Heat wave! Everybody wants ice cream right now!',
    chef: 'One of you has the ticket! Read it out, but no peeking!',
    chefBuild: 'Listen to your head chef and scoop it up!',
    build: ['Now scoop it! From memory!', 'Grab your scoops! Go, go, go!', 'Make it just like the order, sweeties!'],
    great: ['Sweet perfection! Look at that smile!', 'Ooh, sprinkles of joy! Perfect!'],
    ok: ['Pretty sweet! A little melty, but nice.', 'Close! They are still licking the spoon.'],
    bad: ['Oh no, brain freeze! What is that?', 'Uh oh. That sundae melted all over the floor.'],
    last: 'Last scoop of the night! Make it magical!',
    over: 'The freezer is closed! Thanks, sweeties, you were cool!',
  },
};
const REVEAL_MS = 9000, RUSH_REVEAL_MS = 6500, WALK_MS = 1600;
const BEST_BONUS = 150;

// ---------------- the score ----------------
const popc = (m) => { let n = 0; while (m) { n += m & 1; m >>>= 1; } return n; };
// Every way the slots can be read that is "the same dish" (pizza: turns + flips; taco plate:
// any order of the tacos; sushi board: either way round; sundae: one slot).
const SYMS = (() => {
  const perms = (a) => (a.length < 2 ? [a] : a.flatMap((x, i) => perms([...a.slice(0, i), ...a.slice(i + 1)]).map((p) => [x, ...p])));
  const ring = []; for (let f = 0; f < 2; f++) for (let r = 0; r < 8; r++) ring.push(Array.from({ length: 8 }, (_, i) => ((f ? 7 - i : i) + r) % 8));
  return { ring, line: [[0, 1, 2, 3, 4, 5, 6, 7], [7, 6, 5, 4, 3, 2, 1, 0]], perm: perms([0, 1, 2]), one: [[0]] };
})();
const remap = (m, p) => { let o = 0; for (let i = 0; i < p.length; i++) if (m & (1 << i)) o |= 1 << p[i]; return o; };
const rot = (m, r) => ((m << r) | (m >>> (8 - r))) & 0xff;
const flip = (m) => remap(m, SYMS.line[1]);

// A clean dish for kitchen k from anything a phone sends (null when it isn't a dish at all).
function clean(p, k = 'pizza') {
  if (!p || typeof p !== 'object' || Array.isArray(p)) return null;
  const K = kOf(k), out = {};
  for (const r of K.rows) out[r.key] = r.opts.includes(p[r.key]) ? p[r.key] : r.def;
  if (K.slots) {
    out.top = {}; const full = (1 << K.slots) - 1;
    const t = p.top && typeof p.top === 'object' && !Array.isArray(p.top) ? p.top : {};
    for (const x of K.tops) { const m = t[x]; if (Number.isInteger(m) && m > 0 && m <= full) out.top[x] = m; }
  }
  if (K.stack) out.stack = (Array.isArray(p.stack) ? p.stack : []).filter((x) => K.stack.includes(x)).slice(0, K.maxStack);
  return out;
}
// Toppings: which kinds, how many slots each, and where they sit (best over the symmetries).
function topScore(K, want, got) {
  const a0 = want.top || {}, b0 = got.top || {}, kinds = K.tops.filter((k) => a0[k] || b0[k]);
  if (!kinds.length) return 1;
  let place = 0;
  for (const p of SYMS[K.sym]) {
    let inter = 0, uni = 0;
    for (const k of kinds) { const a = a0[k] || 0, b = remap(b0[k] || 0, p); inter += popc(a & b); uni += popc(a | b); }
    place = Math.max(place, uni ? inter / uni : 1);
  }
  let amt = 0;
  for (const k of kinds) { const a = popc(a0[k] || 0), b = popc(b0[k] || 0); amt += Math.min(a, b) / Math.max(a, b); }
  return 0.55 * place + 0.45 * (amt / kinds.length);
}
// A stack (burger layers, sundae scoops): the same layers (as a bag) and the same order (longest
// common subsequence), both against the longer stack. Same layers in a different order < 1.
function stackScore(a, b) {
  a = a || []; b = b || [];
  const n = Math.max(a.length, b.length); if (!n) return 1;
  const cnt = new Map(); for (const x of a) cnt.set(x, (cnt.get(x) || 0) + 1);
  let same = 0; for (const x of b) if (cnt.get(x) > 0) { same++; cnt.set(x, cnt.get(x) - 1); }
  const L = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) L[i][j] = a[i - 1] === b[j - 1] ? L[i - 1][j - 1] + 1 : Math.max(L[i - 1][j], L[i][j - 1]);
  return 0.45 * (same / n) + 0.55 * (L[a.length][b.length] / n);
}
// How close `got` is to `want`, 0..100. An empty (missing) dish scores 0. The kitchen is want.k
// (or got.k, or pizza).
function match(want, got, k) {
  if (!want || !got) return 0;
  const K = kOf(k || want.k || got.k);
  let s = 0;
  for (const r of K.rows) {
    const a = want[r.key], b = got[r.key];
    if (r.num) s += r.w * Math.max(0, 1 - Math.abs((a || 0) - (b || 0)) * r.num);
    else if (a === b) s += r.w;
    else if (r.near && Math.abs(r.opts.indexOf(a) - r.opts.indexOf(b)) === 1) s += r.w * r.near;
  }
  if (K.slots) s += K.wTop * topScore(K, want, got);
  if (K.stack) s += K.wStack * stackScore(want.stack, got.stack);
  return Math.round(100 * s);
}

// ---------------- the order in words (Phone Order, and the head chef's ticket) ----------------
const nm = (K, ks) => list(ks.map((x) => K.names[x] || x));
const NUMW = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
function describe(o) {
  const K = kOf(o), N = (x) => K.names[x] || x, secs = o.sections || [];
  if (K.key === 'pizza') {
    const base = `A ${N(o.crust)}, ${N(o.sauce)}, ${['no cheese', 'cheese', 'extra cheese'][o.cheese] || 'cheese'}`;
    if (!secs.length) return base + '. Nothing else on it.';
    const whole = secs.filter((s) => s.kind === 'whole'), halves = secs.filter((s) => s.kind === 'half'), quarters = secs.filter((s) => s.kind === 'quarter');
    const parts = [];
    if (whole.length) parts.push(`${nm(K, whole.flatMap((s) => s.kinds))} all over`);
    if (halves.length === 2) parts.push(`${nm(K, halves[0].kinds)} on one half and ${nm(K, halves[1].kinds)} on the other half`);
    else if (halves.length === 1) parts.push(`${nm(K, halves[0].kinds)} on just one half`);
    if (quarters.length) {
      const q = quarters.slice().sort((a, b) => a.at - b.at);
      parts.push(q.length === 1 ? `${nm(K, q[0].kinds)} on just one quarter` : `going around the pie, one quarter each: ${q.map((s) => nm(K, s.kinds)).join(', then ')}${q.length < 4 ? ', and the rest plain' : ''}`);
    }
    return `${base}: ${parts.join('; ')}.`;
  }
  if (K.key === 'taco') {
    const base = `Three ${N(o.shell)} with ${N(o.filling)} and ${N(o.salsa)}`;
    if (!secs.length) return base + '. Nothing else on them.';
    const whole = secs.filter((s) => s.kind === 'whole'), two = secs.filter((s) => s.kind === 'half' && s.mask === 3), one = secs.filter((s) => s.kind === 'half' && s.mask === 4), singles = secs.filter((s) => s.kind === 'quarter');
    const parts = [];
    if (whole.length) parts.push(`${nm(K, whole.flatMap((s) => s.kinds))} on all three tacos`);
    if (two.length && one.length) parts.push(`${nm(K, two[0].kinds)} on two tacos and ${nm(K, one[0].kinds)} on the other one`);
    else if (two.length) parts.push(`${nm(K, two[0].kinds)} on just two tacos`);
    else if (one.length) parts.push(`${nm(K, one[0].kinds)} on just one taco`);
    if (singles.length) parts.push(singles.length === 1 ? `${nm(K, singles[0].kinds)} on just one taco` : `then one each: ${singles.map((s) => nm(K, s.kinds)).join('; another with ')}${singles.length < 3 ? '; and one with nothing extra' : ''}`);
    return `${base}: ${parts.join('; ')}.`;
  }
  if (K.key === 'sushi') {
    const base = `A roll in ${N(o.wrap)} with ${N(o.rice)} and ${N(o.filling)} inside, eight pieces`;
    if (!secs.length) return base + '. Nothing on top.';
    const whole = secs.filter((s) => s.kind === 'whole'), halves = secs.filter((s) => s.kind === 'half'), alts = secs.filter((s) => s.kind === 'alt'), pairs = secs.filter((s) => s.kind === 'quarter');
    const parts = [];
    if (whole.length) parts.push(`${nm(K, whole.flatMap((s) => s.kinds))} on every piece`);
    if (halves.length === 2) parts.push(`${nm(K, halves[0].kinds)} on one row and ${nm(K, halves[1].kinds)} on the other row`);
    else if (halves.length === 1) parts.push(`${nm(K, halves[0].kinds)} on just one row of four`);
    if (alts.length === 2) parts.push(`then alternating, ${nm(K, alts[0].kinds)} and ${nm(K, alts[1].kinds)}, every other piece`);
    else if (alts.length === 1) parts.push(`${nm(K, alts[0].kinds)} on every other piece`);
    if (pairs.length) { const q = pairs.slice().sort((a, b) => a.at - b.at); parts.push(q.length === 1 ? `${nm(K, q[0].kinds)} on just two pieces side by side` : `then pairs along the board: ${q.map((s) => nm(K, s.kinds)).join(', then ')}${q.length < 4 ? ', and the rest plain' : ''}`); }
    return `${base}: ${parts.join('; ')}.`;
  }
  if (K.key === 'burger') {
    const st = o.stack || [];
    return `A ${N(o.bun)}, and from the bottom up: ${st.length ? list(st.map(N)) : 'nothing at all'}, then the top bun.`;
  }
  // sundae
  const st = o.stack || [], tops = K.tops.filter((x) => o.top && o.top[x]);
  const v = o.vessel === 'cup' ? 'A glass cup' : `A ${N(o.vessel)}`;
  return `${v} with ${NUMW[st.length] || st.length} scoop${st.length === 1 ? '' : 's'}${st.length > 1 ? ', bottom to top' : ''}: ${list(st.map(N))}; ${N(o.sauce)}${tops.length ? `; topped with ${nm(K, tops)}` : '; no toppings'}.`;
}

class Game {
  constructor(room, s) {
    this.room = room;
    const pick = (f, v) => (f.options.some((o) => String(o.value) === String(v)) ? f.options.find((o) => String(o.value) === String(v)).value : defaults[f.key]);
    this.s = {}; for (const f of fields) this.s[f.key] = pick(f, s ? s[f.key] : undefined);
    this.phase = 'intro'; this.round = 0; this.total = this.s.mode === 'rush' ? this.s.rounds * 2 : this.s.rounds;
    this.c = null; this.points = new Map(); this.stats = new Map(); this.timer = null; this.endsAt = 0;
    this.nonna = null; this.nonnaSeq = 0; this.history = []; this.lastMode = null; this.chefTurn = 0; this.final = null;
    this.custBags = {}; this.courtBag = []; this.lastKitchen = null;
    // The kitchen for this game: chosen now, so the intro (played before start()) can show its owner.
    this.kitchen = this.s.kitchen === 'surprise' ? this.pickOf(KITCHEN_KEYS) : this.s.kitchen === 'court' ? null : this.s.kitchen;
  }
  now() { return this.room.now(); }
  rng() { return this.room.rng(); }
  ri(a, b) { return a + Math.floor(this.rng() * (b - a + 1)); }
  pickOf(a) { return a[Math.floor(this.rng() * a.length) % a.length]; }
  shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(this.rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  setTimer(ms, fn) { this.room.cancel(this.timer); this.endsAt = this.now() + ms; this.timer = this.room.after(Math.max(0, ms), fn); }
  stat(id) { let s = this.stats.get(id); if (!s) { s = { best: 0, perfect: 0, served: 0, fast: null, sum: 0, n: 0, chef: 0 }; this.stats.set(id, s); } return s; }
  active() { return this.room.list().filter((p) => p.bot || p.sockets > 0); }
  pub(id) { const p = this.room.get(id); return p ? { id, name: p.name, avatar: p.avatar, color: p.color, gear: GEARS.gearSet(p, 'pizza') } : { id, name: '—', avatar: '👻', color: '#888' }; }
  // The intro and how-to (box/show.js) show this game's kitchen and its owner ('court': all of them).
  showExtra() { return { kitchen: this.kitchen || 'court' }; }
  curKitchen() { return (this.c && this.c.kitchen) || this.kitchen || 'pizza'; }
  say(text, who) { if (text) this.nonna = { text, key: ++this.nonnaSeq, at: this.now(), who: who || this.curKitchen() }; }
  line(k, kit) { const v = LINES[kit || this.curKitchen()][k]; return Array.isArray(v) ? this.pickOf(v) : v; }

  start() { for (const p of this.room.list()) { this.points.set(p.id, 0); this.stat(p.id); } this.nextRound(); }
  joined(p) { if (!this.points.has(p.id)) this.points.set(p.id, 0); this.stat(p.id); }
  left() { this.checkDone(); }

  // ---------- orders ----------
  modeFor() {
    if (this.s.mode !== 'mixed') return this.s.mode === 'chef' && this.active().length < 2 ? 'phone' : this.s.mode;
    let pool = MODE_KEYS.filter((k) => k !== this.lastMode && !(k === 'chef' && this.active().length < 3));
    if (!pool.length) pool = ['classic'];
    return this.pickOf(pool);
  }
  kitchenFor() {
    if (this.kitchen) return this.kitchen;
    if (!this.courtBag.length) { this.courtBag = this.shuffle(KITCHEN_KEYS); if (this.courtBag[this.courtBag.length - 1] === this.lastKitchen) this.courtBag.unshift(this.courtBag.pop()); }
    return this.courtBag.pop();
  }
  makeOrder(mode, kit = this.curKitchen()) {
    const M = MODES[mode], K = KITCHENS[kit];
    const o = { k: kit, sections: [] };
    for (const r of K.rows) o[r.key] = this.pickOf(r.pick);
    if (K.slots && K.at) {
      o.top = {};
      const kinds = this.shuffle(K.tops);
      const add = (kind, mask, ks, at = 0) => { o.sections.push({ kind, mask, kinds: ks, at }); for (const x of ks) o.top[x] = (o.top[x] || 0) | mask; };
      if (M.sections) {
        if (kit === 'taco') { // Mix & Match: every taco its own toppings (sometimes one on all three too)
          if (this.rng() < 0.4) add('whole', 7, kinds.splice(0, 1));
          K.at.quarter.forEach((m, i) => add('quarter', m, kinds.splice(0, this.ri(1, 2)), i));
        } else if (kit === 'sushi' && this.rng() < 0.4) { // Rainbow Roll: alternating pieces
          if (this.rng() < 0.5) add('whole', W8, kinds.splice(0, 1));
          add('alt', K.at.alt[0], kinds.splice(0, 1)); add('alt', K.at.alt[1], kinds.splice(0, 1));
        } else if (this.rng() < 0.5) { // halves (rows of the sushi board): 1-2 toppings each side
          add('half', K.at.half[0], kinds.splice(0, this.ri(1, 2))); add('half', K.at.half[1], kinds.splice(0, this.ri(1, 2)));
        } else { // quarters (pairs of sushi pieces), sometimes with a topping all over too
          if (this.rng() < 0.35) add('whole', K.at.whole[0], kinds.splice(0, 1));
          K.at.quarter.forEach((m, i) => add('quarter', m, kinds.splice(0, 1), i));
        }
      } else {
        const n = this.ri(...M.tops); let halfSlot = 0, qSlot = 0;
        for (let i = 0; i < n; i++) {
          const x = kinds.pop(); let pl = this.pickOf(M.place);
          if (pl === 'half' && halfSlot > 1) pl = 'whole';
          if (pl === 'quarter' && qSlot >= K.at.quarter.length) pl = 'whole';
          if (pl === 'half' && kit === 'sushi' && halfSlot === 0 && this.rng() < 0.3) { add('alt', K.at.alt[0], [x]); halfSlot = 9; continue; }
          if (pl === 'whole') { const w = o.sections.find((s) => s.kind === 'whole'); if (w) { w.kinds.push(x); o.top[x] = K.at.whole[0]; } else add('whole', K.at.whole[0], [x]); }
          else if (pl === 'half') add('half', K.at.half[halfSlot++], [x]);
          else { add('quarter', K.at.quarter[qSlot], [x], qSlot); qSlot++; }
        }
      }
    }
    if (kit === 'burger') {
      const n = this.ri(...M.stack), patties = Math.min(3, Math.max(1, this.ri(1, n >= 6 ? 3 : 2)));
      const st = Array(patties).fill('patty');
      while (st.length < n) st.push(this.pickOf(K.stack.filter((x) => x !== 'patty')));
      o.stack = this.shuffle(st);
    }
    if (kit === 'sundae') {
      o.stack = Array.from({ length: this.ri(...M.scoops) }, () => this.pickOf(K.stack));
      o.top = {}; for (const x of this.shuffle(K.tops).slice(0, this.ri(...M.sprinkle))) o.top[x] = 1;
    }
    o.words = describe(o);
    return o;
  }
  nextCustomer(kit) {
    const bag = this.custBags[kit] || (this.custBags[kit] = []);
    if (!bag.length) bag.push(...this.shuffle(CUSTOMERS[kit].map((c) => c.id)));
    const id = bag.pop(); return CUSTOMERS[kit].find((c) => c.id === id);
  }

  // ---------- a round: order (memorize) -> build -> reveal ----------
  nextRound() {
    if (this.round >= this.total) return this.end();
    this.round++;
    const mode = this.modeFor(); this.lastMode = mode;
    const kit = this.kitchenFor(); this.lastKitchen = kit;
    const M = MODES[mode], order = this.makeOrder(mode, kit);
    let chef = null;
    if (M.chef) {
      const pool = this.active(); const humans = pool.filter((p) => !p.bot), lst = humans.length >= 2 ? humans : pool;
      chef = lst.length ? lst[this.chefTurn++ % lst.length].id : null;
    }
    const peek = M.peek;
    this.c = { id: this.round, mode, kitchen: kit, order, customer: this.nextCustomer(kit), chef, peek, showAt: this.now() + WALK_MS, drafts: new Map(), served: new Map(), rows: null, buildMs: 0 };
    this.phase = 'order';
    this.say(this.line(this.round === this.total && this.total > 1 ? 'last' : M.words ? 'phone' : mode === 'flash' ? 'flash' : mode === 'rush' && this.round <= 2 ? 'rush' : M.chef ? 'chef' : this.round === 1 ? 'first' : 'look'));
    this.room.fx('order', { mode, kitchen: kit });
    this.setTimer(WALK_MS + peek, () => this.build());
    const cid = this.c.id; this.room.after(WALK_MS, () => { if (this.c && this.c.id === cid) this.room.fx('shown'); }); // the TV gets the order once the customer reaches the counter
  }
  build() {
    const c = this.c; if (!c || this.phase !== 'order') return;
    this.phase = 'build';
    const M = MODES[c.mode];
    c.buildMs = Math.max(15000, Math.round(this.s.seconds * 1000 * M.build));
    c.buildAt = this.now(); c.endAt = c.buildAt + c.buildMs;
    this.say(this.line(M.chef ? 'chefBuild' : 'build'));
    this.room.fx('build');
    this.setTimer(c.buildMs, () => this.reveal());
    for (const p of this.room.list()) if (p.bot && p.id !== c.chef) this.botPlan(p);
  }
  // A bot remembers the order imperfectly, then serves at a random moment.
  botPlan(p) {
    const c = this.c, cid = c.id;
    let skill = 0.45 + ((String(p.id).length * 7 + String(p.name).length * 13) % 40) / 100; // 0.45–0.84, steady per bot
    if (c.mode === 'flash') skill -= 0.15; if (c.mode === 'chef' || c.mode === 'phone') skill -= 0.05;
    const pz = this.botMemory(c.order, skill);
    const at = c.buildMs * (0.3 + this.rng() * 0.6);
    this.room.after(at * 0.5, () => { if (this.c && this.c.id === cid && this.phase === 'build' && !c.served.has(p.id)) c.drafts.set(p.id, pz); });
    this.room.after(at, () => { if (this.c && this.c.id === cid && this.phase === 'build') this.serve(p, pz); });
  }
  botMemory(o, skill) {
    const K = kOf(o), miss = (k = 1) => this.rng() > skill + (1 - skill) * (1 - k);
    const pz = {};
    for (const r of K.rows) pz[r.key] = miss(0.55) ? this.pickOf(r.opts) : o[r.key];
    if (K.slots) {
      pz.top = {};
      const spots = K.at ? [...K.at.whole, ...K.at.half, ...K.at.quarter] : [1];
      for (const x of Object.keys(o.top || {})) {
        if (miss(0.4)) continue; // forgot it
        let m = o.top[x];
        if (K.at && miss(0.5)) m = this.pickOf(spots); // wrong place
        const xx = miss(0.3) ? this.pickOf(K.tops) : x; // mixed it up with another topping
        pz.top[xx] = (pz.top[xx] || 0) | m;
      }
    }
    if (K.stack) {
      const st = (o.stack || []).slice();
      if (st.length > 1 && miss(0.5)) { const i = this.ri(0, st.length - 2); [st[i], st[i + 1]] = [st[i + 1], st[i]]; } // two layers swapped
      if (st.length && miss(0.4)) st.splice(this.ri(0, st.length - 1), 1); // forgot one
      if (st.length && miss(0.3)) st[this.ri(0, st.length - 1)] = this.pickOf(K.stack); // mixed one up
      pz.stack = st;
    }
    return pz;
  }

  serve(p, pz) {
    const c = this.c; if (!c || this.phase !== 'build' || c.served.has(p.id) || p.id === c.chef) return false;
    c.drafts.set(p.id, pz); c.served.set(p.id, this.now());
    this.room.fx('serve', { id: p.id });
    this.checkDone();
    return true;
  }
  builders() { const c = this.c; return this.active().filter((p) => !c || p.id !== c.chef); }
  checkDone() {
    const c = this.c; if (!c || this.phase !== 'build') return;
    const b = this.builders();
    if (b.length && b.every((p) => c.served.has(p.id))) this.setTimer(900, () => this.reveal());
    else if (!b.length) this.setTimer(900, () => this.reveal());
  }
  reveal() {
    const c = this.c; if (!c || this.phase !== 'build') return;
    this.phase = 'reveal';
    const M = MODES[c.mode], rows = [];
    for (const [id, pz] of c.drafts) {
      if (id === c.chef || !this.room.get(id)) continue;
      const score = match(c.order, pz, c.kitchen), at = c.served.get(id);
      let tip = score * 10, speed = 0;
      if (M.speed && at != null && score >= 50) speed = Math.round(score * 3 * Math.max(0, (c.endAt - at) / c.buildMs));
      rows.push({ id, pizza: pz, score, tip, speed, served: at != null, secs: at != null ? Math.round((at - c.buildAt) / 100) / 10 : null });
    }
    // Cooks who never touched their phone this round: an empty plate.
    for (const p of this.builders()) if (!c.drafts.has(p.id)) rows.push({ id: p.id, pizza: null, score: 0, tip: 0, speed: 0, served: false, secs: null });
    rows.sort((a, b) => b.score - a.score || (a.secs == null ? 1e9 : a.secs) - (b.secs == null ? 1e9 : b.secs));
    const top = rows.length ? rows[0].score : 0;
    for (const r of rows) {
      r.best = top > 0 && r.score === top;
      r.gain = r.tip + r.speed + (r.best ? BEST_BONUS : 0);
      this.points.set(r.id, (this.points.get(r.id) || 0) + r.gain);
      const st = this.stat(r.id); st.best = Math.max(st.best, r.score); st.sum += r.score; st.n++;
      if (r.score >= 95) st.perfect++;
      if (r.served) { st.served++; if (st.fast == null || r.secs < st.fast) st.fast = r.secs; }
    }
    let chefRow = null;
    if (c.chef && this.room.get(c.chef)) {
      const cooked = rows.filter((r) => r.pizza), avg = cooked.length ? Math.round(cooked.reduce((a, r) => a + r.score, 0) / cooked.length) : 0;
      chefRow = { id: c.chef, avg, gain: avg * 8 };
      this.points.set(c.chef, (this.points.get(c.chef) || 0) + chefRow.gain); this.stat(c.chef).chef++;
    }
    c.rows = rows; c.chefRow = chefRow; c.top = top;
    const mood = top >= 85 ? 'great' : top >= 55 ? 'ok' : 'bad';
    c.mood = mood;
    this.say(this.line(mood));
    this.history.push({ mode: c.mode, kitchen: c.kitchen, top, best: rows[0] && rows[0].best ? rows[0].id : null, customer: c.customer.name });
    this.room.fx('reveal', { mood });
    this.setTimer(c.mode === 'rush' ? RUSH_REVEAL_MS : REVEAL_MS, () => this.nextRound());
  }
  end() {
    this.room.cancel(this.timer); this.phase = 'over'; this.endsAt = 0;
    const st = this.standings();
    this.final = { standings: st, awards: this.awards() };
    this.say(this.line('over', this.kitchen || 'pizza'), this.kitchen || 'pizza');
    this.room.fx('win');
  }
  awards() {
    const ids = [...this.stats.keys()].filter((id) => this.room.get(id)), A = [];
    const best = (f, cmp, ok = () => true) => { let w = null; for (const id of ids) { const v = f(this.stat(id)); if (v == null || !ok(v)) continue; if (!w || cmp(v, w.v) < 0) w = { id, v }; } return w; };
    const add = (key, icon, title, w, txt) => { if (w) A.push({ key, icon, title, ...this.pub(w.id), text: txt(w.v) }); };
    const K = KITCHENS[this.kitchen || 'pizza'], dish = this.kitchen ? K.dish : 'dish', dishes = this.kitchen ? K.dishes : 'dishes';
    add('best', '🏅', this.kitchen ? `Best ${dish[0].toUpperCase() + dish.slice(1)}` : 'Best Dish', best((s) => s.best, (a, b) => b - a, (v) => v > 0), (v) => `a ${v}% match`);
    add('perfect', '👌', 'Chef’s Kiss', best((s) => s.perfect, (a, b) => b - a, (v) => v > 0), (v) => `${v} near-perfect ${v === 1 ? dish : dishes}`);
    add('fast', '🛵', 'Fastest Hands', best((s) => s.fast, (a, b) => a - b), (v) => `served in ${v}s`);
    add('steady', '🎯', 'Steady Cook', best((s) => (s.n >= 2 ? Math.round(s.sum / s.n) : null), (a, b) => b - a), (v) => `${v}% average match`);
    return A;
  }
  standings() {
    return [...this.points].filter(([id]) => this.room.get(id)).map(([id, pts]) => ({ ...this.pub(id), points: pts, best: this.stat(id).best }))
      .sort((a, b) => b.points - a.points || b.best - a.best || a.name.localeCompare(b.name));
  }
  results() { return this.phase === 'over' ? this.standings().map((r) => r.id) : []; }
  next() {
    if (this.phase === 'order') return this.build();
    if (this.phase === 'build') return this.reveal();
    if (this.phase === 'reveal') return this.nextRound();
  }

  act(p, m) {
    m = m || {};
    const c = this.c;
    if (m.op === 'build' || m.op === 'serve') {
      if (this.phase !== 'build' || !c) return { ok: false, quiet: true };
      if (p.id === c.chef) return { ok: false, error: 'You’re the head chef: describe the order out loud!' };
      if (Number(m.round) && Number(m.round) !== c.id) return { ok: false, quiet: true };
      const pz = clean(m.dish || m.pizza, c.kitchen); if (!pz) return { ok: false, error: `That isn’t a ${KITCHENS[c.kitchen].dish}.` };
      if (c.served.has(p.id)) return { ok: false, quiet: true, served: true };
      if (m.op === 'build') { c.drafts.set(p.id, pz); return { ok: true, quiet: true }; }
      this.serve(p, pz); return { ok: true };
    }
    return { ok: false, error: 'Unknown move.' };
  }

  // ---------- screens ----------
  // The order as the screens draw it (no sections, no words).
  dishOf(o) { const K = kOf(o), d = { k: o.k }; for (const r of K.rows) d[r.key] = o[r.key]; if (o.top) d.top = o.top; if (o.stack) d.stack = o.stack; return d; }
  // Is the order on the TV right now? (The secret stays on the server until then.)
  tvOrder() {
    const c = this.c; if (!c) return { picture: false, words: false };
    if (this.phase === 'reveal') return { picture: true, words: true };
    const M = MODES[c.mode];
    if (this.phase === 'order') {
      if (M.chef) return { picture: false, words: false };
      return { picture: !M.words && this.now() >= c.showAt, words: !!M.words && this.now() >= c.showAt };
    }
    // build: only when the head chef can't describe it (a bot, or they left): then the ticket is read out.
    if (this.phase === 'build' && M.chef) { const ch = c.chef && this.room.get(c.chef); if (!ch || ch.bot || !(ch.sockets > 0)) return { picture: false, words: true }; }
    return { picture: false, words: false };
  }
  modeInfo(c) { const K = KITCHENS[c.kitchen]; return { mode: c.mode, modeName: modeName(K, c.mode), modeIcon: modeIcon(K, c.mode), kitchen: c.kitchen }; }
  cPub() {
    const c = this.c; if (!c) return null;
    const M = MODES[c.mode], vis = this.tvOrder();
    const o = { id: c.id, ...this.modeInfo(c), customer: c.customer, chef: c.chef ? this.pub(c.chef) : null, showIn: Math.max(0, c.showAt - this.now()), peek: c.peek, speed: !!M.speed };
    if (vis.picture) o.order = this.dishOf(c.order);
    if (vis.words) o.words = c.order.words;
    if (this.phase === 'build' || this.phase === 'reveal') {
      const b = this.builders();
      o.cooks = b.slice(0, 40).map((p) => ({ ...this.pub(p.id), served: c.served.has(p.id), busy: c.drafts.has(p.id) }));
      o.served = b.filter((p) => c.served.has(p.id)).length; o.of = b.length;
    }
    if (this.phase === 'reveal' && c.rows) {
      o.rows = c.rows.slice(0, 12).map((r) => ({ ...this.pub(r.id), pizza: r.pizza, score: r.score, gain: r.gain, speed: r.speed, best: r.best, secs: r.secs }));
      o.more = Math.max(0, c.rows.length - 12); o.mood = c.mood; o.top = c.top;
      o.chefRow = c.chefRow ? { ...this.pub(c.chefRow.id), avg: c.chefRow.avg, gain: c.chefRow.gain } : null;
    }
    return o;
  }
  base() { return { phase: this.phase, round: this.round, of: this.total, mode: this.s.mode, kitchen: this.curKitchen(), court: !this.kitchen, endsIn: this.endsAt && this.phase !== 'over' ? Math.max(0, this.endsAt - this.now()) : 0, nonna: this.nonna }; }
  tv() {
    const st = this.standings();
    return { ...this.base(), c: this.cPub(), standings: st.slice(0, 10), players: st.length, final: this.phase === 'over' ? this.final : null };
  }
  view(p) {
    const st = this.standings(), i = st.findIndex((r) => r.id === p.id), c = this.c;
    const v = { ...this.base(), me: p.id, points: this.points.get(p.id) || 0, rank: i + 1, ranked: st.length, final: this.phase === 'over' ? this.final : null };
    if (!c) return v;
    const M = MODES[c.mode];
    v.c = { id: c.id, ...this.modeInfo(c), customer: { name: c.customer.name, job: c.customer.job }, isChef: c.chef === p.id, chef: c.chef ? this.pub(c.chef) : null, speed: !!M.speed, buildMs: c.buildMs };
    if (c.chef === p.id && this.phase !== 'reveal') v.c.ticket = { ...this.dishOf(c.order), words: c.order.words };
    if (this.phase === 'build') {
      v.c.served = c.served.has(p.id); v.c.draft = c.drafts.get(p.id) || null;
      v.c.waiting = this.builders().filter((x) => !c.served.has(x.id)).length;
    }
    if (this.phase === 'reveal' && c.rows) {
      const r = c.rows.find((x) => x.id === p.id), place = c.rows.indexOf(r) + 1;
      v.c.order = { ...this.dishOf(c.order), words: c.order.words };
      v.c.mine = r ? { pizza: r.pizza, score: r.score, gain: r.gain, speed: r.speed, best: r.best, place, of: c.rows.length } : null;
      if (c.chefRow && c.chefRow.id === p.id) v.c.chefRow = { avg: c.chefRow.avg, gain: c.chefRow.gain };
    }
    return v;
  }
}

// Party Mode: settings that fit the players in the room and this game's minutes in the plan
// (box/party-fit.js). The kitchen is a surprise: a random one for each game.
const PF = require('../party-fit');
const partyFit = ({ players: P, minutes: M }) => {
  const seconds = M <= 7 ? 30 : M >= 16 ? 60 : 45;
  const { rounds } = PF.best({ rounds: [5, 3, 8] }, (s) => 0.5 + s.rounds * (seconds + 85) / 60, M);
  return { rounds, seconds, mode: P <= 1 ? 'classic' : 'mixed', kitchen: 'surprise' };
};

const PIZZA = KITCHENS.pizza;
module.exports = {
  partyFit,
  key: 'pizza', name: 'YesChef', min: 1, best: [3, 10], howSteps: 6, fields, defaults, // best: the ideal crowd (Party Mode + the menu use it)
  show: { facts: false, openMs: 14000 }, // intro cutscene (public/box/intros/pizza.js): the YesChef food court, then the kitchen's owner
  create: (room, settings) => new Game(room, settings),
  _test: { match, clean, describe, rot, flip, popc, stackScore, MODES, KITCHENS, KITCHEN_KEYS, CUSTOMERS, LINES, NONNA: LINES.pizza, TOPPINGS: PIZZA.tops, CRUSTS: PIZZA.rows[0].opts, SAUCES: PIZZA.rows[1].opts, WHOLE: 0xff, HALVES: PIZZA.at.half, QUARTERS: PIZZA.at.quarter, SYMS, modeName },
};
