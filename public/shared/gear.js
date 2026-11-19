// Per-game gear for the JustGold shop (docs/justgold.md). Shared by the server (prices,
// ownership, what a room player wears) and the pages (shop display, game renderers).
//
// Each item: { id: 'gear:<game>:<name>', game, slot, name, value, cost, desc, icon, paint, where }.
//   - `value` is what the room hands to the game: p.gear = { <game>: { <slot>: value } }.
//   - `paint` is the simple data a renderer turns into visuals (see PAINT below). Renderers ask
//     for it with paint(game, slot, value); it is null for the free default, so a game simply
//     keeps its normal look when nothing (or something unknown) is equipped.
//   - `where`: 'tv' (everyone sees it on the big screen) or 'phone' (your own phone screen).
// The free default of every slot is implied (GAMES_WITH_GEAR[i].default, value 'classic').
//
// PAINT (every field optional, all plain data):
//   a, b, c  : '#rrggbb' main colour, second colour, highlight/trim
//   pattern  : one of PATTERNS
//   icon     : a short emoji drawn as an emblem
//   glow     : true for a glowing / shiny finish
//   pens     : ['#rrggbb', …] extra colours (JustSketch pen sets)
//
// To add gear for a new game: add a SLOTS line and its items below, then copy the player's gear
// into the game's tv()/view() player data on the server (gear: gearSet(p, '<game>')) and use
// paint() in the game's renderer. Games without a TV effect use the 'theme' slot, which
// phoneTheme() draws as a frame around that game's phone screen.
(function (root) {
  const PATTERNS = ['plain', 'stripes', 'dots', 'swirl', 'stars', 'check', 'flame', 'wave'];

  // game -> slots. where: 'tv' = visible to everyone, 'phone' = your phone (the phone theme).
  const SLOTS = [
    { game: 'marble', slot: 'skin', label: 'Marble skin', where: 'tv', default: { name: 'Steel Shooter', icon: '⚪', desc: 'The trusty steel marble.' } },
    { game: 'plinko', slot: 'ball', label: 'Drop ball', where: 'tv', default: { name: 'Player Colour', icon: '🔴', desc: 'A ball in your own colour.' } },
    { game: 'quickdraw', slot: 'hat', label: 'Duelling hat', where: 'tv', default: { name: 'Trail Hat', icon: '🤠', desc: 'Dusty, honest, brown.' } },
    { game: 'president', slot: 'cardBack', label: 'Card back', where: 'tv', default: { name: 'Royal Velvet', icon: '🂠', desc: 'The court’s own red velvet back.' } },
    { game: 'blackjack', slot: 'chips', label: 'Chip set', where: 'tv', default: { name: 'House Chips', icon: '🪙', desc: 'The lounge’s standard chips.' } },
    { game: 'bid', slot: 'paddle', label: 'Bidding paddle', where: 'tv', default: { name: 'Plain Paddle', icon: '🏓', desc: 'A plain wooden paddle with your number.' } },
    { game: 'tune', slot: 'buzzer', label: 'Buzzer', where: 'tv', default: { name: 'Studio Red', icon: '🔴', desc: 'The classic big red buzzer.' } },
    { game: 'sketch', slot: 'pens', label: 'Pen set', where: 'phone', default: { name: 'Basic Box', icon: '🖍️', desc: 'The 12 colours every sketchbook has.' } },
    { game: 'summon', slot: 'banner', label: 'Castle banner', where: 'tv', default: { name: 'Plain Standard', icon: '🚩', desc: 'Your side’s plain flag.' } },
    { game: 'zombie', slot: 'bandana', label: 'Survivor bandana', where: 'tv', default: { name: 'Red Rag', icon: '🧣', desc: 'A torn red rag, tied tight.' } },
    { game: 'escape', slot: 'magnifier', label: 'Magnifier', where: 'tv', default: { name: 'Brass Lens', icon: '🔍', desc: 'A detective’s standard brass glass.' } },
    { game: 'memes', slot: 'frame', label: 'Meme frame', where: 'tv', default: { name: 'No Frame', icon: '🖼️', desc: 'Just the meme.' } },
    { game: 'letters', slot: 'pencil', label: 'Pencil', where: 'tv', default: { name: 'Yellow No. 2', icon: '✏️', desc: 'The pencil from every desk drawer.' } },
    { game: 'colormatch', slot: 'easel', label: 'Gallery frame', where: 'tv', default: { name: 'Studio Card', icon: '🎨', desc: 'A plain white card around your mix.' } },
    { game: 'trivia', slot: 'podium', label: 'Podium lights', where: 'tv', default: { name: 'Studio Lights', icon: '💡', desc: 'Your own colour, lit up.' } },
    { game: 'kingdoms', slot: 'crest', label: 'Kingdom crest', where: 'tv', default: { name: 'Bare Shield', icon: '🛡️', desc: 'A castle with no emblem yet.' } },
    // Games whose gear is a phone theme: a frame and badge around that game's phone screen.
    { game: 'blanks', slot: 'theme', label: 'Phone theme', where: 'phone', default: { name: 'Stage Lights', icon: '📱', desc: 'The game’s own look.' } },
    { game: 'truths', slot: 'theme', label: 'Phone theme', where: 'phone', default: { name: 'Case File', icon: '📱', desc: 'The game’s own look.' } },
    { game: 'funny', slot: 'theme', label: 'Phone theme', where: 'phone', default: { name: 'Couch Mode', icon: '📱', desc: 'The game’s own look.' } },
    { game: 'whosaid', slot: 'theme', label: 'Phone theme', where: 'phone', default: { name: 'Quiet Night', icon: '📱', desc: 'The game’s own look.' } },
    { game: 'price', slot: 'theme', label: 'Phone theme', where: 'phone', default: { name: 'Shelf Tag', icon: '📱', desc: 'The game’s own look.' } },
    { game: 'emoji', slot: 'theme', label: 'Phone theme', where: 'phone', default: { name: 'Plain Keys', icon: '📱', desc: 'The game’s own look.' } },
    { game: 'likely', slot: 'theme', label: 'Phone theme', where: 'phone', default: { name: 'Ballot Box', icon: '📱', desc: 'The game’s own look.' } },
    { game: 'spectrum', slot: 'theme', label: 'Phone theme', where: 'phone', default: { name: 'Middle Ground', icon: '📱', desc: 'The game’s own look.' } },
    { game: 'debate', slot: 'theme', label: 'Phone theme', where: 'phone', default: { name: 'Lectern', icon: '📱', desc: 'The game’s own look.' } },
    { game: 'actout', slot: 'theme', label: 'Phone theme', where: 'phone', default: { name: 'House Lights', icon: '📱', desc: 'The game’s own look.' } },
    { game: 'alien', slot: 'theme', label: 'Phone theme', where: 'phone', default: { name: 'Crew Issue', icon: '📱', desc: 'The game’s own look.' } },
    { game: 'bomb', slot: 'theme', label: 'Phone theme', where: 'phone', default: { name: 'Field Manual', icon: '📱', desc: 'The game’s own look.' } },
    { game: 'ducks', slot: 'theme', label: 'Phone theme', where: 'phone', default: { name: 'Farmhouse', icon: '📱', desc: 'The game’s own look.' } },
  ];

  // [game, slot, value, name, cost, icon, paint, desc]
  const RAW = [
    // JustMarble: the marble wears the skin of whoever's board it is rolling on.
    ['marble', 'skin', 'cherry', 'Cherry Fizz', 50, '🍒', { a: '#e8323c', b: '#ff9aa8', c: '#fff4f4', pattern: 'swirl' }, 'A fizzy red swirl. Rolls like it’s late for something.'],
    ['marble', 'skin', 'tiger', 'Tiger Eye', 90, '🐯', { a: '#d1861a', b: '#4a2508', c: '#ffe0a0', pattern: 'stripes' }, 'Amber glass with dark bands. Purrs on the corners.'],
    ['marble', 'skin', 'galaxy', 'Pocket Galaxy', 140, '🌌', { a: '#2a1d6b', b: '#8a5cff', c: '#ffffff', pattern: 'stars' }, 'A whole night sky, shrunk down to marble size.'],
    ['marble', 'skin', 'lava', 'Molten Core', 200, '🌋', { a: '#ff5a1f', b: '#3a0a00', c: '#ffd23a', pattern: 'flame', glow: true }, 'Glowing lava glass. The maze walls feel the heat.'],
    ['marble', 'skin', 'pearl', 'Ghost Pearl', 280, '🫧', { a: '#dff1ff', b: '#9fd8ff', c: '#ffffff', pattern: 'wave', glow: true }, 'A shimmering pearl that leaves a faint glow wherever it rolls.'],
    // JustDrop: your ball on the peg board.
    ['plinko', 'ball', 'clover', 'Lucky Clover', 45, '🍀', { a: '#2fb85a', b: '#c8f7a8', c: '#ffffff', pattern: 'dots' }, 'Green and spotted. Can’t hurt, right?'],
    ['plinko', 'ball', 'beach', 'Beach Ball', 70, '🏖️', { a: '#ff4d6d', b: '#ffd23a', c: '#3aa0ff', pattern: 'stripes' }, 'Red, yellow and blue panels. Smells like sunscreen.'],
    ['plinko', 'ball', 'disco', 'Disco Ball', 120, '🪩', { a: '#c9d3e6', b: '#6c7a96', c: '#ffffff', pattern: 'check', glow: true }, 'A mirror-tiled ball. Every bounce is a party.'],
    ['plinko', 'ball', 'comet', 'Comet', 170, '☄️', { a: '#5ad1ff', b: '#1a3a8a', c: '#e8fbff', pattern: 'flame', glow: true }, 'An icy comet with a blazing tail.'],
    ['plinko', 'ball', 'jackpot', 'Jackpot Gold', 250, '🪙', { a: '#ffcc33', b: '#b07a00', c: '#fff6c8', pattern: 'plain', glow: true }, 'Solid gold, polished to a shine. The pegs ring when it hits.'],
    // Quick Draw: the hat on your duellist.
    ['quickdraw', 'hat', 'sheriff', 'Midnight Sheriff', 60, '⭐', { a: '#2a2320', b: '#c9a14a', c: '#4a3c34', icon: '⭐' }, 'Black felt and a brass star on the band.'],
    ['quickdraw', 'hat', 'rose', 'Desert Rose', 90, '🌹', { a: '#e88aa8', b: '#8a1c3a', c: '#ffd0de', icon: '🌹' }, 'A dusty-pink hat with a rose tucked in the band.'],
    ['quickdraw', 'hat', 'rattler', 'Rattler Band', 120, '🐍', { a: '#7a5a34', b: '#e0c060', c: '#a07a48', pattern: 'stripes' }, 'A leather hat with a diamond-back band. Rattles when you draw.'],
    ['quickdraw', 'hat', 'cactus', 'Cactus Crown', 160, '🌵', { a: '#3f8f3a', b: '#f2d03b', c: '#8ad07a', icon: '🌵' }, 'Green as a saguaro, with a little flower on top.'],
    ['quickdraw', 'hat', 'golden', 'Golden Spur', 260, '🏆', { a: '#ffcc33', b: '#7a4a00', c: '#fff2a8', glow: true }, 'A gleaming gold hat for the fastest hand in the west.'],
    // President: the back of your cards on the royal table.
    ['president', 'cardBack', 'lattice', 'Midnight Lattice', 50, '🔷', { a: '#1d2b6b', b: '#6f8cff', pattern: 'check' }, 'Deep blue with a criss-cross lattice.'],
    ['president', 'cardBack', 'koi', 'Koi Pond', 100, '🐟', { a: '#0f7a7a', b: '#ff8a3a', pattern: 'wave', icon: '🐟' }, 'Teal ripples with a lazy orange koi.'],
    ['president', 'cardBack', 'starry', 'Starry Crest', 150, '✨', { a: '#2a1450', b: '#ffd23a', pattern: 'stars' }, 'Violet night scattered with gold stars.'],
    ['president', 'cardBack', 'gilded', 'Gilded Throne', 280, '👑', { a: '#b07a00', b: '#fff2a8', pattern: 'stripes', icon: '👑', glow: true }, 'Gold leaf and a little crown. The court bows.'],
    // Blackjack Night: your chips on the felt.
    ['blackjack', 'chips', 'mint', 'Mint Julep', 45, '🌿', { a: '#3fbf8a', b: '#e8fff4' }, 'Cool mint chips with white edge spots.'],
    ['blackjack', 'chips', 'neon', 'Neon Night', 100, '🌃', { a: '#ff3fb4', b: '#3ff0ff', glow: true }, 'Hot pink chips that glow like the signs.'],
    ['blackjack', 'chips', 'pearl', 'Black Pearl', 170, '⚫', { a: '#1a1a22', b: '#e8e2ff' }, 'Jet-black chips with pearl inlay.'],
    ['blackjack', 'chips', 'gold', 'High Roller Gold', 260, '💰', { a: '#ffcc33', b: '#7a4a00', glow: true }, 'Heavy gold chips. The dealer notices.'],
    // JustBid: the paddle you raise on the TV.
    ['bid', 'paddle', 'lucky', 'Lucky Horseshoe', 55, '🧲', { a: '#2f8f5a', b: '#ffffff', icon: '🍀' }, 'A green paddle with a four-leaf clover.'],
    ['bid', 'paddle', 'flamingo', 'Flamingo Flash', 85, '🦩', { a: '#ff7ab6', b: '#ffffff', icon: '🦩' }, 'Bright pink, impossible to miss in the crowd.'],
    ['bid', 'paddle', 'map', 'Treasure Map', 140, '🗺️', { a: '#e8cf8a', b: '#7a4a1a', pattern: 'dots', icon: '❌' }, 'Old parchment. X marks the bid.'],
    ['bid', 'paddle', 'diamond', 'Diamond Hands', 230, '💎', { a: '#7ad8ff', b: '#ffffff', pattern: 'check', icon: '💎', glow: true }, 'A cut-crystal paddle. Never sells.'],
    // Tune Buzz: your buzzer on the TV and phone.
    ['tune', 'buzzer', 'bubble', 'Bubblegum', 40, '🍬', { a: '#ff7ad1', b: '#ffd0f0' }, 'Pink, sweet and very poppable.'],
    ['tune', 'buzzer', 'lime', 'Laser Lime', 90, '🟢', { a: '#9dff3a', b: '#2a5a00', glow: true }, 'A lime-green laser button.'],
    ['tune', 'buzzer', 'vinyl', 'Vinyl Spin', 150, '💿', { a: '#1a1a1a', b: '#ff3a5a', pattern: 'swirl' }, 'A spinning record with a red label.'],
    ['tune', 'buzzer', 'goldmic', 'Golden Mic', 240, '🎤', { a: '#ffcc33', b: '#fff2a8', icon: '🎤', glow: true }, 'Gold, glowing, chart-topping.'],
    // JustSketch: extra pen colours on your sketchpad (your drawings show them on the TV).
    ['sketch', 'pens', 'sunset', 'Sunset Markers', 50, '🌅', { a: '#ff6b6b', b: '#ffa94d', pens: ['#ff6b6b', '#ffa94d', '#ffd43b', '#e64980'] }, 'Four warm markers: coral, tangerine, sun and rose.'],
    ['sketch', 'pens', 'pastel', 'Pastel Chalk', 80, '🧁', { a: '#ffc9de', b: '#b9e6ff', pens: ['#ffc9de', '#b9e6ff', '#c8f7c5', '#e5d4ff'] }, 'Soft chalky pastels for cute doodles.'],
    ['sketch', 'pens', 'ocean', 'Deep Sea Inks', 110, '🐙', { a: '#0b7285', b: '#3bc9db', pens: ['#0b7285', '#1864ab', '#3bc9db', '#63e6be'] }, 'Teals and blues from the bottom of the sea.'],
    ['sketch', 'pens', 'neon', 'Highlighter Pack', 150, '🖍️', { a: '#e8ff3a', b: '#ff3ad1', pens: ['#e8ff3a', '#3aff8a', '#ff3ad1', '#3ad8ff'] }, 'Four blinding highlighters.'],
    ['sketch', 'pens', 'metal', 'Metallic Gels', 220, '✨', { a: '#d4af37', b: '#c0c0c0', pens: ['#d4af37', '#c0c0c0', '#b87333', '#8a6dd8'] }, 'Gold, silver, copper and violet gel pens.'],
    // JustSummon: the banner over your side of the war table and your troops' pennants.
    ['summon', 'banner', 'lion', 'Lion Rampant', 70, '🦁', { a: '#d4a017', b: '#7a1010', icon: '🦁' }, 'A golden lion on deep red.'],
    ['summon', 'banner', 'owl', 'Moon Owl', 90, '🦉', { a: '#3a3a8a', b: '#e8e8ff', icon: '🦉', pattern: 'stars' }, 'A wise owl under the stars.'],
    ['summon', 'banner', 'eagle', 'Storm Eagle', 130, '🦅', { a: '#2a6a9a', b: '#ffffff', icon: '🦅', pattern: 'stripes' }, 'An eagle riding the thunderheads.'],
    ['summon', 'banner', 'dragon', 'Dragonflame', 220, '🐉', { a: '#1a1a1a', b: '#ff5a1f', icon: '🐉', pattern: 'flame', glow: true }, 'A black banner with a fire-breathing dragon.'],
    // Zombie Survival: the bandana on your survivor.
    ['zombie', 'bandana', 'camo', 'Camo Rag', 50, '🪖', { a: '#5a6a3a', b: '#2f3a20', pattern: 'dots' }, 'Woodland camo. The zombies won’t see you (they will).'],
    ['zombie', 'bandana', 'polka', 'Lucky Polka', 70, '🔵', { a: '#2a6aff', b: '#ffffff', pattern: 'dots' }, 'Blue with white dots. Cheerful in a crisis.'],
    ['zombie', 'bandana', 'hazard', 'Hazard Stripe', 120, '⚠️', { a: '#ffd23a', b: '#1a1a1a', pattern: 'stripes' }, 'Yellow and black. Caution: survivor.'],
    ['zombie', 'bandana', 'glow', 'Glow Stick', 200, '🧪', { a: '#7aff3a', b: '#e8ffd0', glow: true }, 'A glowing green bandana. Great for night runs.'],
    // JustEscape: the magnifier on your evidence card and on the case board.
    ['escape', 'magnifier', 'silver', 'Silver Loupe', 50, '🥈', { a: '#c8ccd6', b: '#5a6070' }, 'A polished silver loupe.'],
    ['escape', 'magnifier', 'ruby', 'Ruby Lens', 110, '❤️', { a: '#c81e3a', b: '#ffd0d8' }, 'Red-tinted glass. Spots blood (ketchup) at a glance.'],
    ['escape', 'magnifier', 'ebony', 'Midnight Ebony', 160, '🌙', { a: '#2a1a12', b: '#c9a14a' }, 'Dark wood and brass. Very serious.'],
    ['escape', 'magnifier', 'gold', 'Golden Eye', 250, '🌟', { a: '#ffcc33', b: '#fff6c8', glow: true }, 'A gold-rimmed glass that gleams when you find a clue.'],
    // Meme Maker: a frame around your memes in the parade and the gallery.
    ['memes', 'frame', 'polaroid', 'Instant Photo', 50, '📷', { a: '#ffffff', b: '#e8e2d0' }, 'A white instant-photo border.'],
    ['memes', 'frame', 'comic', 'Comic Burst', 80, '💥', { a: '#ffd23a', b: '#1a1a1a', pattern: 'dots' }, 'Halftone yellow with a heavy ink line.'],
    ['memes', 'frame', 'neon', 'Neon Tube', 120, '💡', { a: '#ff3ad1', b: '#3ad8ff', glow: true }, 'Buzzing pink and blue neon.'],
    ['memes', 'frame', 'gold', 'Museum Gold', 200, '🖼️', { a: '#d4a017', b: '#7a4a00', pattern: 'stripes', glow: true }, 'An ornate gold frame. Instantly priceless.'],
    // Letter Rush: your pencil on the TV's writing race.
    ['letters', 'pencil', 'ruby', 'Ruby Red', 40, '🔴', { a: '#e8323c', b: '#ffd0d0' }, 'A red pencil for confident answers.'],
    ['letters', 'pencil', 'sky', 'Sky Blue', 60, '🔵', { a: '#3a9aff', b: '#d0e8ff' }, 'A calm blue pencil.'],
    ['letters', 'pencil', 'rainbow', 'Rainbow Lead', 140, '🌈', { a: '#ff5a5a', b: '#5a8aff', c: '#ffd23a', pattern: 'stripes' }, 'Every colour, swirled down the barrel.'],
    ['letters', 'pencil', 'quill', 'Golden Quill', 220, '🪶', { a: '#ffcc33', b: '#7a4a00', glow: true }, 'Fancy. Writes the same, feels faster.'],
    // Color Match: the frame around your mix on the reveal.
    ['colormatch', 'easel', 'oak', 'Oak Frame', 45, '🪵', { a: '#a0703a', b: '#5a3a1a' }, 'A warm wooden frame.'],
    ['colormatch', 'easel', 'splatter', 'Paint Splatter', 90, '🎨', { a: '#ff5a8a', b: '#3ad8ff', c: '#ffd23a', pattern: 'dots' }, 'Speckled with every colour you missed.'],
    ['colormatch', 'easel', 'marble', 'Gallery Marble', 140, '🏛️', { a: '#f2efe8', b: '#9a958a', pattern: 'swirl' }, 'Veined white marble, like a real museum.'],
    ['colormatch', 'easel', 'gold', 'Masterpiece Gold', 230, '🏆', { a: '#ffcc33', b: '#7a4a00', glow: true }, 'For mixes that belong on a wall.'],
    // Hot Take Trivia: your contestant light.
    ['trivia', 'podium', 'ice', 'Ice Cold', 45, '🧊', { a: '#7ad8ff', b: '#e8fbff' }, 'A frosty blue light.'],
    ['trivia', 'podium', 'ember', 'Ember', 80, '🔥', { a: '#ff5a1f', b: '#ffd23a', glow: true }, 'Smouldering orange. Your takes are hot.'],
    ['trivia', 'podium', 'ultra', 'Ultraviolet', 130, '🔮', { a: '#8a3aff', b: '#ff3ad1', glow: true }, 'Purple black-light glow.'],
    ['trivia', 'podium', 'champ', 'Champion Gold', 220, '🏅', { a: '#ffcc33', b: '#fff2a8', glow: true, icon: '👑' }, 'A gold light and a little crown.'],
    // JustKingdoms: an emblem on your castles and army banners.
    ['kingdoms', 'crest', 'stag', 'Silver Stag', 70, '🦌', { icon: '🦌' }, 'A proud stag on your castle walls.'],
    ['kingdoms', 'crest', 'rose', 'Wild Rose', 90, '🌹', { icon: '🌹' }, 'A rose for a kingdom that blooms.'],
    ['kingdoms', 'crest', 'wolf', 'Iron Wolf', 150, '🐺', { icon: '🐺' }, 'A howling wolf. The neighbours get nervous.'],
    ['kingdoms', 'crest', 'sun', 'Golden Sun', 240, '☀️', { icon: '☀️', glow: true }, 'A blazing sun over every tower.'],
  ];
  // Phone themes: [game, value, name, cost, icon, a, b, pattern, desc]
  const THEMES = [
    ['blanks', 'grape', 'Grape Soda', 40, '🍇', '#7a3aff', '#ff9a3a', 'dots', 'Fizzy purple with an orange pop.'],
    ['blanks', 'candy', 'Candy Stripe', 80, '🍭', '#ff5a8a', '#fff0f5', 'stripes', 'Pink and white, like the answer cards.'],
    ['blanks', 'gold', 'Marquee Gold', 150, '🌟', '#ffcc33', '#ff6a1a', 'stars', 'Stage lights, all for you.'],
    ['truths', 'noir', 'Film Noir', 40, '🎞️', '#2a2a2a', '#e8e2d0', 'stripes', 'Black, white and suspicious.'],
    ['truths', 'polygraph', 'Polygraph', 80, '📈', '#3aff8a', '#0a2a1a', 'wave', 'A green needle that never lies.'],
    ['truths', 'evidence', 'Evidence Red', 150, '🔴', '#c81e3a', '#ffd23a', 'check', 'Red string and yellow tape.'],
    ['funny', 'popcorn', 'Popcorn', 40, '🍿', '#ffd23a', '#e8323c', 'stripes', 'Red-striped tub, buttery yellow.'],
    ['funny', 'retro', 'Retro TV', 80, '📺', '#3ad8ff', '#ff3ad1', 'wave', 'Scan lines and static colours.'],
    ['funny', 'premiere', 'Red Carpet', 150, '🎬', '#c81e3a', '#ffcc33', 'stars', 'Premiere night.'],
    ['whosaid', 'aurora', 'Aurora', 40, '🌌', '#3affb4', '#7a3aff', 'wave', 'Green and violet sky ribbons.'],
    ['whosaid', 'moon', 'Moonbeam', 80, '🌙', '#f2e8a0', '#2a2a6a', 'stars', 'Soft moonlight on indigo.'],
    ['whosaid', 'firefly', 'Fireflies', 150, '✨', '#d8ff3a', '#1a2a1a', 'dots', 'Little lights blinking in the dark.'],
    ['price', 'coupon', 'Coupon Clipper', 40, '✂️', '#3a9a5a', '#fff8d0', 'dots', 'Dashed lines and savings.'],
    ['price', 'sale', 'Clearance Red', 80, '🏷️', '#e8323c', '#ffffff', 'stripes', 'EVERYTHING MUST GO.'],
    ['price', 'luxury', 'Luxury Aisle', 150, '💎', '#1a1a2a', '#d4af37', 'check', 'Black velvet and gold tags.'],
    ['emoji', 'sunny', 'Sunny Side', 40, '🌞', '#ffd23a', '#ff8a3a', 'dots', 'A warm yellow keyboard.'],
    ['emoji', 'cosmic', 'Cosmic', 80, '🪐', '#3a1a8a', '#3ad8ff', 'stars', 'Emoji from outer space.'],
    ['emoji', 'rainbow', 'Rainbow Keys', 150, '🌈', '#ff5a5a', '#5a8aff', 'stripes', 'Every colour of the key row.'],
    ['likely', 'ballot', 'Ballot Blue', 40, '🗳️', '#2a5aff', '#ffffff', 'check', 'Official-looking. Totally fair.'],
    ['likely', 'gossip', 'Gossip Pink', 80, '💅', '#ff5ab4', '#ffe0f0', 'dots', 'Did you hear?'],
    ['likely', 'crown', 'Title Holder', 150, '👑', '#ffcc33', '#7a3aff', 'stars', 'For the most likely to win.'],
    ['spectrum', 'sunrise', 'Sunrise Scale', 40, '🌅', '#ff7a3a', '#3a8aff', 'wave', 'Warm on one end, cool on the other.'],
    ['spectrum', 'mint', 'Mint Mode', 80, '🌿', '#3affb4', '#0a3a2a', 'stripes', 'Fresh and balanced.'],
    ['spectrum', 'prism', 'Prism', 150, '🔺', '#ff3ad1', '#3ad8ff', 'stars', 'All the colours in between.'],
    ['debate', 'chalk', 'Chalkboard', 40, '📝', '#2a4a3a', '#f2f2e8', 'plain', 'Green slate and white chalk.'],
    ['debate', 'gavel', 'Mahogany', 80, '🔨', '#6a2a1a', '#d4a017', 'stripes', 'Polished wood and brass.'],
    ['debate', 'thunder', 'Thunder Round', 150, '⚡', '#3a3aff', '#ffd23a', 'flame', 'For arguments with real voltage.'],
    ['actout', 'velvet', 'Velvet Seats', 40, '💺', '#8a1a3a', '#ffcc33', 'plain', 'The best seats in the house.'],
    ['actout', 'spot', 'Spotlight', 80, '🔦', '#fff6c8', '#2a1a3a', 'dots', 'All eyes on you.'],
    ['actout', 'opening', 'Opening Night', 150, '🎭', '#7a1aff', '#ffcc33', 'stars', 'Bravo! Encore!'],
    ['alien', 'goo', 'Gloop Goo', 40, '🟢', '#7aff3a', '#2a0a4a', 'dots', 'Slimy and proud.'],
    ['alien', 'radar', 'Radar Sweep', 80, '📡', '#3aff8a', '#0a1a0a', 'wave', 'Ping. Ping. Ping.'],
    ['alien', 'nebula', 'Nebula', 150, '🌠', '#ff3ad1', '#3a1a8a', 'stars', 'Pink clouds of stardust.'],
    ['bomb', 'hazard', 'Hazard Tape', 40, '🚧', '#ffd23a', '#1a1a1a', 'stripes', 'Do not cross.'],
    ['bomb', 'circuit', 'Circuit Board', 80, '🔌', '#1a7a3a', '#ffcc33', 'check', 'Green board, gold traces.'],
    ['bomb', 'redwire', 'Red Wire', 150, '✂️', '#e8323c', '#3a8aff', 'flame', 'Always cut the red one. (Don’t.)'],
    ['ducks', 'pond', 'Lily Pond', 40, '🪷', '#3ab4a0', '#ffd0e0', 'wave', 'Cool water and pink lilies.'],
    ['ducks', 'harvest', 'Harvest Barn', 80, '🌾', '#c8402a', '#ffd23a', 'check', 'Red barn, golden hay.'],
    ['ducks', 'champion', 'Race Champion', 150, '🏁', '#1a1a1a', '#ffffff', 'check', 'A chequered flag for the fastest farm.'],
  ];
  for (const [game, value, name, cost, icon, a, b, pattern, desc] of THEMES) RAW.push([game, 'theme', value, name, cost, icon, { a, b, pattern, icon }, desc]);

  const slotInfo = (game, slot) => SLOTS.find((s) => s.game === game && s.slot === slot) || null;
  const GEAR = RAW.map(([game, slot, value, name, cost, icon, paint, desc]) => ({
    id: 'gear:' + game + ':' + value, game, slot, name, value, cost, desc, icon, paint: Object.freeze(paint), where: (slotInfo(game, slot) || {}).where || 'phone',
  }));
  const BY_ID = new Map(GEAR.map((g) => [g.id, g]));
  const GAMES_WITH_GEAR = SLOTS.map((s) => ({ game: s.game, slot: s.slot, label: s.label, where: s.where, default: { name: s.default.name, value: 'classic', icon: s.default.icon, desc: s.default.desc } }));
  const slotsOf = (game) => SLOTS.filter((s) => s.game === game).map((s) => s.slot);
  const itemOf = (game, slot, value) => (typeof value === 'string' ? GEAR.find((g) => g.game === game && g.slot === slot && (g.value === value || g.id === value)) || null : null);

  // What a player has equipped for one game slot: a valid value, or 'classic' (the free default).
  // Reads p.gear defensively: { <game>: { <slot>: value } } (also accepts { <game>: value } or an
  // item id), so a missing, old or tampered p.gear just means the default look.
  function gearOf(p, game, slot) {
    const all = p && p.gear && typeof p.gear === 'object' ? p.gear : null;
    let v = all && Object.prototype.hasOwnProperty.call(all, game) ? all[game] : null;
    if (v && typeof v === 'object') v = Object.prototype.hasOwnProperty.call(v, slot) ? v[slot] : null;
    const it = itemOf(game, slot || (slotsOf(game)[0]), v);
    return it ? it.value : 'classic';
  }
  // Every slot of one game for a player: { <slot>: value }. This is what game servers copy into
  // their tv()/view() player data (`gear: gearSet(room.get(id), '<game>')`).
  function gearSet(p, game) { const o = {}; for (const s of slotsOf(game)) o[s] = gearOf(p, game, s); return o; }
  // The paint a renderer uses, or null for the default look. `v` may be a value, an item id, or
  // a gearSet object ({ <slot>: value }).
  function paint(game, slot, v) {
    if (v && typeof v === 'object') v = v[slot];
    const it = itemOf(game, slot, v); return it ? it.paint : null;
  }
  // Phone theme: a coloured frame and a badge drawn over a game's phone screen (pointer-events
  // off, so taps go through). Call it at the start of a game's phone(el, state, ctx, view): it
  // runs after the render (a microtask), and the game's next render removes it again, so it never
  // leaks into another game. `view.me.gear` is the player's gear from the room.
  function phoneTheme(el, view, game) {
    if (!el || typeof document === 'undefined') return;
    const me = view && view.me;
    const pt = paint(game, 'theme', gearOf(me, game, 'theme'));
    Promise.resolve().then(() => {
      const old = el.querySelector(':scope > #gear-theme'); if (old) old.remove();
      if (!pt) return;
      const w = document.createElement('div'); w.id = 'gear-theme'; w.setAttribute('aria-hidden', 'true');
      w.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:40';
      const d = document.createElement('div');
      const bg = { stripes: `repeating-linear-gradient(45deg, ${pt.a} 0 10px, ${pt.b} 10px 20px)`, check: `repeating-conic-gradient(${pt.a} 0 25%, ${pt.b} 0 50%) 0 0 / 16px 16px`, dots: `radial-gradient(circle, ${pt.b} 30%, ${pt.a} 32%) 0 0 / 12px 12px`, wave: `linear-gradient(90deg, ${pt.a}, ${pt.b}, ${pt.a})`, stars: `linear-gradient(135deg, ${pt.a}, ${pt.b})`, flame: `linear-gradient(0deg, ${pt.a}, ${pt.b})` }[pt.pattern] || `linear-gradient(135deg, ${pt.a}, ${pt.b})`;
      // The frame: the pattern painted on a box, with its middle masked out (only the 6px edge shows).
      d.style.cssText = 'position:absolute;inset:0;border:6px solid transparent;border-radius:14px;'
        + `background:${bg} border-box;-webkit-mask:linear-gradient(#000 0 0) padding-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask:linear-gradient(#000 0 0) padding-box exclude,linear-gradient(#000 0 0)`;
      const b = document.createElement('div');
      b.textContent = pt.icon || '';
      b.style.cssText = `position:absolute;right:10px;bottom:10px;width:34px;height:34px;border-radius:50%;display:grid;place-items:center;font-size:18px;background:${pt.a};box-shadow:0 0 0 3px ${pt.b},0 2px 8px #0006;opacity:.92`;
      w.appendChild(d); w.appendChild(b); el.appendChild(w);
    });
  }

  const API = { PATTERNS, GEAR, GAMES_WITH_GEAR, SLOTS: GAMES_WITH_GEAR, BY_ID, gearOf, gearSet, paint, slotsOf, itemOf, phoneTheme };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.MT_GEAR = API;
})(typeof window !== 'undefined' ? window : globalThis);
