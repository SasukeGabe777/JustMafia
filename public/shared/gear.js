// Per-game gear for the JustGold shop (docs/justgold.md). Shared by the server (prices,
// ownership, what a room player wears) and the pages (shop display, game renderers).
//
// Each item: { id: 'gear:<game>:<name>', game, slot, spot, name, value, cost, desc, icon, paint, where }.
//   - `value` is what the room hands to the game: p.gear = { <game>: { <slot>: value } }.
//   - `spot`: where a WEARABLE sits on your character in that game: 'head' | 'face' | 'hand' |
//     'chest' | 'back'. null for an OBJECT slot (a marble skin, a card back, chips…).
//     Wearables are drawn on the JustGameBox character by public/wear-art.js (paint.shape) through
//     MTArt.drawCharacter(…, { wear: MT_GEAR.wearOf(game, gear) }); BOX.face / BOX.body /
//     BOX.drawChar (public/box/portrait.js) do that for you. A worn spot replaces the player's own
//     hat (head) or extra (face/hand/chest/back) in that game only.
//   - `paint` is plain data: a, b, c colours ('#rrggbb'), pattern, icon, glow, pens (JustSketch),
//     and for wearables shape (a key of MTArt.WEAR) and d (a shape variant).
//     Renderers ask for it with paint(game, slot, value); it is null for the free default, so a
//     game keeps its normal look when nothing (or something unknown) is equipped.
// The free default of every slot is implied (value 'classic'): no wearable, or the game's own object.
//
// To add gear for a new game: add SLOTS lines (at least one wearable spot) and items below. The
// TV/phone pages read every player's gear from the room roster, so BOX.face(p) shows it with no
// server work; object slots are copied into the game's data on the server (gear: gearSet(p, '<game>')).
(function (root) {
  const PATTERNS = ['plain', 'stripes', 'dots', 'swirl', 'stars', 'check', 'flame', 'wave'];
  const SPOTS = ['head', 'face', 'hand', 'chest', 'back'];
  const OWN = (what) => ({ name: 'Your own look', icon: '🙂', desc: `No game ${what}: you wear your own character.` });

  // game -> slots. spot: where it sits on the character (null = an object in the game).
  const SLOTS = [
    { game: 'marble', slot: 'skin', label: 'Marble skin', spot: null, default: { name: 'Steel Shooter', icon: '⚪', desc: 'The trusty steel marble.' } },
    { game: 'marble', slot: 'hat', label: 'Explorer hat', spot: 'head', default: OWN('hat') },
    { game: 'plinko', slot: 'ball', label: 'Drop ball', spot: null, default: { name: 'Player Colour', icon: '🔴', desc: 'A ball in your own colour.' } },
    { game: 'plinko', slot: 'cap', label: 'Lucky hat', spot: 'head', default: OWN('hat') },
    { game: 'quickdraw', slot: 'hat', label: 'Cowboy hat', spot: 'head', default: OWN('hat') },
    { game: 'quickdraw', slot: 'badge', label: 'Badge', spot: 'chest', default: OWN('badge') },
    { game: 'quickdraw', slot: 'hand', label: 'Lasso', spot: 'hand', default: OWN('prop') },
    { game: 'president', slot: 'cardBack', label: 'Card back', spot: null, default: { name: 'Royal Velvet', icon: '🂠', desc: 'The court’s own red velvet back.' } },
    { game: 'president', slot: 'crown', label: 'Crown', spot: 'head', default: OWN('crown') },
    { game: 'president', slot: 'cape', label: 'Royal cape', spot: 'back', default: OWN('cape') },
    { game: 'blackjack', slot: 'chips', label: 'Chip set', spot: null, default: { name: 'House Chips', icon: '🪙', desc: 'The lounge’s standard chips.' } },
    { game: 'blackjack', slot: 'visor', label: 'Visor', spot: 'head', default: OWN('visor') },
    { game: 'blackjack', slot: 'shades', label: 'Shades', spot: 'face', default: OWN('shades') },
    { game: 'blackjack', slot: 'tie', label: 'Bow tie', spot: 'chest', default: OWN('tie') },
    { game: 'bid', slot: 'paddle', label: 'Bidding paddle', spot: null, default: { name: 'Plain Paddle', icon: '🏓', desc: 'A plain wooden paddle with your number.' } },
    { game: 'bid', slot: 'hat', label: 'Auction hat', spot: 'head', default: OWN('hat') },
    { game: 'bid', slot: 'monocle', label: 'Monocle', spot: 'face', default: OWN('monocle') },
    { game: 'bid', slot: 'gavel', label: 'Gavel', spot: 'hand', default: OWN('gavel') },
    { game: 'tune', slot: 'buzzer', label: 'Buzzer', spot: null, default: { name: 'Studio Red', icon: '🔴', desc: 'The classic big red buzzer.' } },
    { game: 'tune', slot: 'phones', label: 'Headphones', spot: 'head', default: OWN('headphones') },
    { game: 'tune', slot: 'mic', label: 'Microphone', spot: 'hand', default: OWN('mic') },
    { game: 'sketch', slot: 'pens', label: 'Pen set', spot: null, where: 'phone', default: { name: 'Basic Box', icon: '🖍️', desc: 'The 12 colours every sketchbook has.' } },
    { game: 'sketch', slot: 'beret', label: 'Artist beret', spot: 'head', default: OWN('beret') },
    { game: 'sketch', slot: 'brush', label: 'Brush', spot: 'hand', default: OWN('brush') },
    { game: 'summon', slot: 'banner', label: 'Castle banner', spot: null, default: { name: 'Plain Standard', icon: '🚩', desc: 'Your side’s plain flag.' } },
    { game: 'summon', slot: 'helm', label: 'War helm', spot: 'head', default: OWN('helm') },
    { game: 'summon', slot: 'staff', label: 'Summoner’s staff', spot: 'hand', default: OWN('staff') },
    { game: 'summon', slot: 'cape', label: 'War cape', spot: 'back', default: OWN('cape') },
    { game: 'zombie', slot: 'bandana', label: 'Survivor bandana', spot: 'head', default: OWN('bandana') },
    { game: 'zombie', slot: 'mask', label: 'Mask', spot: 'face', default: OWN('mask') },
    { game: 'zombie', slot: 'weapon', label: 'Trusty tool', spot: 'hand', default: OWN('tool') },
    { game: 'zombie', slot: 'pack', label: 'Pack', spot: 'back', default: OWN('pack') },
    { game: 'escape', slot: 'magnifier', label: 'Magnifier', spot: 'hand', default: OWN('magnifier') },
    { game: 'escape', slot: 'cap', label: 'Detective hat', spot: 'head', default: OWN('hat') },
    { game: 'escape', slot: 'pipe', label: 'Pipe', spot: 'face', default: OWN('pipe') },
    { game: 'memes', slot: 'frame', label: 'Meme frame', spot: null, default: { name: 'No Frame', icon: '🖼️', desc: 'Just the meme.' } },
    { game: 'memes', slot: 'shades', label: 'Meme shades', spot: 'face', default: OWN('shades') },
    { game: 'memes', slot: 'cap', label: 'Cap', spot: 'head', default: OWN('cap') },
    { game: 'letters', slot: 'pencil', label: 'Pencil', spot: 'hand', default: OWN('pencil') },
    { game: 'letters', slot: 'band', label: 'Thinking cap', spot: 'head', default: OWN('hat') },
    { game: 'colormatch', slot: 'easel', label: 'Gallery frame', spot: null, default: { name: 'Studio Card', icon: '🎨', desc: 'A plain white card around your mix.' } },
    { game: 'colormatch', slot: 'beret', label: 'Beret', spot: 'head', default: OWN('beret') },
    { game: 'colormatch', slot: 'apron', label: 'Smock', spot: 'chest', default: OWN('smock') },
    { game: 'colormatch', slot: 'palette', label: 'Palette', spot: 'hand', default: OWN('palette') },
    { game: 'trivia', slot: 'podium', label: 'Podium lights', spot: null, default: { name: 'Studio Lights', icon: '💡', desc: 'Your own colour, lit up.' } },
    { game: 'trivia', slot: 'cap', label: 'Brainy hat', spot: 'head', default: OWN('hat') },
    { game: 'trivia', slot: 'specs', label: 'Specs', spot: 'face', default: OWN('specs') },
    { game: 'trivia', slot: 'medal', label: 'Medal', spot: 'chest', default: OWN('medal') },
    { game: 'kingdoms', slot: 'crest', label: 'Kingdom crest', spot: null, default: { name: 'Bare Shield', icon: '🛡️', desc: 'A castle with no emblem yet.' } },
    { game: 'kingdoms', slot: 'helm', label: 'Helm', spot: 'head', default: OWN('helm') },
    { game: 'kingdoms', slot: 'arms', label: 'Arms', spot: 'hand', default: OWN('arms') },
    { game: 'blanks', slot: 'hat', label: 'Show hat', spot: 'head', default: OWN('hat') },
    { game: 'blanks', slot: 'shades', label: 'Shades', spot: 'face', default: OWN('shades') },
    { game: 'blanks', slot: 'cards', label: 'Answer cards', spot: 'hand', default: OWN('cards') },
    { game: 'truths', slot: 'hat', label: 'Hat', spot: 'head', default: OWN('hat') },
    { game: 'truths', slot: 'disguise', label: 'Disguise', spot: 'face', default: OWN('disguise') },
    { game: 'truths', slot: 'file', label: 'Case file', spot: 'hand', default: OWN('file') },
    { game: 'funny', slot: 'hat', label: 'Silly hat', spot: 'head', default: OWN('hat') },
    { game: 'funny', slot: 'face', label: 'Funny face', spot: 'face', default: OWN('face') },
    { game: 'funny', slot: 'prop', label: 'Prop', spot: 'hand', default: OWN('prop') },
    { game: 'whosaid', slot: 'cap', label: 'Cap', spot: 'head', default: OWN('cap') },
    { game: 'whosaid', slot: 'mask', label: 'Mask', spot: 'face', default: OWN('mask') },
    { game: 'whosaid', slot: 'prop', label: 'Gossip prop', spot: 'hand', default: OWN('prop') },
    { game: 'price', slot: 'cap', label: 'Store hat', spot: 'head', default: OWN('hat') },
    { game: 'price', slot: 'tag', label: 'Name tag', spot: 'chest', default: OWN('tag') },
    { game: 'price', slot: 'tool', label: 'Shopping gear', spot: 'hand', default: OWN('gear') },
    { game: 'emoji', slot: 'boppers', label: 'Head boppers', spot: 'head', default: OWN('boppers') },
    { game: 'emoji', slot: 'glasses', label: 'Glasses', spot: 'face', default: OWN('glasses') },
    { game: 'emoji', slot: 'phone', label: 'Phone', spot: 'hand', default: OWN('phone') },
    { game: 'likely', slot: 'tiara', label: 'Tiara', spot: 'head', default: OWN('tiara') },
    { game: 'likely', slot: 'sash', label: 'Sash', spot: 'chest', default: OWN('sash') },
    { game: 'likely', slot: 'trophy', label: 'Trophy', spot: 'hand', default: OWN('trophy') },
    { game: 'spectrum', slot: 'cap', label: 'Rally cap', spot: 'head', default: OWN('cap') },
    { game: 'spectrum', slot: 'sign', label: 'Sign', spot: 'hand', default: OWN('sign') },
    { game: 'spectrum', slot: 'pin', label: 'Button pin', spot: 'chest', default: OWN('pin') },
    { game: 'debate', slot: 'wig', label: 'Wig', spot: 'head', default: OWN('wig') },
    { game: 'debate', slot: 'tie', label: 'Tie', spot: 'chest', default: OWN('tie') },
    { game: 'debate', slot: 'hand', label: 'Gavel or mic', spot: 'hand', default: OWN('prop') },
    { game: 'actout', slot: 'hat', label: 'Stage hat', spot: 'head', default: OWN('hat') },
    { game: 'actout', slot: 'mask', label: 'Theatre mask', spot: 'face', default: OWN('mask') },
    { game: 'actout', slot: 'prop', label: 'Megaphone', spot: 'hand', default: OWN('prop') },
    { game: 'alien', slot: 'antennae', label: 'Space hat', spot: 'head', default: OWN('hat') },
    { game: 'alien', slot: 'goggles', label: 'Goggles', spot: 'face', default: OWN('goggles') },
    { game: 'alien', slot: 'ray', label: 'Ray gun', spot: 'hand', default: OWN('ray gun') },
    { game: 'alien', slot: 'pack', label: 'Jetpack', spot: 'back', default: OWN('jetpack') },
    { game: 'bomb', slot: 'hardhat', label: 'Hard hat', spot: 'head', default: OWN('hat') },
    { game: 'bomb', slot: 'goggles', label: 'Goggles', spot: 'face', default: OWN('goggles') },
    { game: 'bomb', slot: 'tool', label: 'Tool', spot: 'hand', default: OWN('tool') },
    { game: 'bomb', slot: 'vest', label: 'Blast vest', spot: 'chest', default: OWN('vest') },
    { game: 'ducks', slot: 'hat', label: 'Farm hat', spot: 'head', default: OWN('hat') },
    { game: 'ducks', slot: 'tool', label: 'Farm tool', spot: 'hand', default: OWN('tool') },
    { game: 'pizza', slot: 'hat', label: 'Chef hat', spot: 'head', default: OWN('hat') },
    { game: 'pizza', slot: 'apron', label: 'Apron', spot: 'chest', default: OWN('apron') },
    { game: 'pizza', slot: 'tool', label: 'Kitchen tool', spot: 'hand', default: OWN('tool') },
    { game: 'undercover', slot: 'hat', label: 'Agent hat', spot: 'head', default: OWN('hat') },
    { game: 'undercover', slot: 'shades', label: 'Disguise', spot: 'face', default: OWN('disguise') },
    { game: 'undercover', slot: 'gadget', label: 'Spy gadget', spot: 'hand', default: OWN('gadget') },
    { game: 'undercover', slot: 'tie', label: 'Agency tie', spot: 'chest', default: OWN('tie') },
    { game: 'snap', slot: 'camera', label: 'Camera', spot: 'hand', default: OWN('camera') },
    { game: 'snap', slot: 'hat', label: 'Photographer hat', spot: 'head', default: OWN('hat') },
    { game: 'snap', slot: 'pass', label: 'Press pass', spot: 'chest', default: OWN('press pass') },
    { game: 'snap', slot: 'shades', label: 'Shades', spot: 'face', default: OWN('shades') },
    { game: 'pitch', slot: 'mic', label: 'Microphone', spot: 'hand', default: OWN('mic') },
    { game: 'pitch', slot: 'tie', label: 'Tie', spot: 'chest', default: OWN('tie') },
    { game: 'pitch', slot: 'hat', label: 'Stage hat', spot: 'head', default: OWN('hat') },
    { game: 'pitch', slot: 'shades', label: 'Shades', spot: 'face', default: OWN('shades') },
    { game: 'king', slot: 'hat', label: 'Court hat', spot: 'head', default: OWN('hat') },
    { game: 'king', slot: 'hand', label: 'Court prop', spot: 'hand', default: OWN('prop') },
    { game: 'king', slot: 'cloak', label: 'Cloak', spot: 'back', default: OWN('cloak') },
    { game: 'trash', slot: 'hat', label: 'Scavenger hat', spot: 'head', default: OWN('hat') },
    { game: 'trash', slot: 'mask', label: 'Face gear', spot: 'face', default: OWN('face gear') },
    { game: 'trash', slot: 'pack', label: 'Back gear', spot: 'back', default: OWN('back gear') },
  ];

  // [game, slot, value, name, cost, icon, paint, desc]
  const RAW = [
    // JustMarble: the marble wears the skin of whoever's board it is rolling on; you wear the hat.
    ['marble', 'skin', 'cherry', 'Cherry Fizz', 50, '🍒', { a: '#e8323c', b: '#ff9aa8', c: '#fff4f4', pattern: 'swirl' }, 'A fizzy red swirl. Rolls like it’s late for something.'],
    ['marble', 'skin', 'tiger', 'Tiger Eye', 90, '🐯', { a: '#d1861a', b: '#4a2508', c: '#ffe0a0', pattern: 'stripes' }, 'Amber glass with dark bands. Purrs on the corners.'],
    ['marble', 'skin', 'galaxy', 'Pocket Galaxy', 140, '🌌', { a: '#2a1d6b', b: '#8a5cff', c: '#ffffff', pattern: 'stars' }, 'A whole night sky, shrunk down to marble size.'],
    ['marble', 'skin', 'lava', 'Molten Core', 200, '🌋', { a: '#ff5a1f', b: '#3a0a00', c: '#ffd23a', pattern: 'flame', glow: true }, 'Glowing lava glass. The maze walls feel the heat.'],
    ['marble', 'skin', 'pearl', 'Ghost Pearl', 280, '🫧', { a: '#dff1ff', b: '#9fd8ff', c: '#ffffff', pattern: 'wave', glow: true }, 'A shimmering pearl that leaves a faint glow wherever it rolls.'],
    ['marble', 'hat', 'miner', 'Miner’s Lamp', 60, '⛑️', { shape: 'hardhat', a: '#f2c12e', b: '#2b1f3d', c: '#fff6a8', d: 'lamp' }, 'A hard hat with a lamp, for the darkest corners of the maze.'],
    ['marble', 'hat', 'explorer', 'Maze Explorer', 100, '🧭', { shape: 'pith', a: '#d9c48f', b: '#6b4a2a' }, 'A pith helmet for charting every twist.'],
    ['marble', 'hat', 'wizard', 'Maze Wizard', 170, '🧙', { shape: 'wizard', a: '#5a3ab0', b: '#ffd23f', c: '#ffe680' }, 'Starry and pointy. The marble obeys (mostly).'],
    // JustDrop: your ball on the peg board, and a lucky hat on you.
    ['plinko', 'ball', 'clover', 'Lucky Clover', 45, '🍀', { a: '#2fb85a', b: '#c8f7a8', c: '#ffffff', pattern: 'dots' }, 'Green and spotted. Can’t hurt, right?'],
    ['plinko', 'ball', 'beach', 'Beach Ball', 70, '🏖️', { a: '#ff4d6d', b: '#ffd23a', c: '#3aa0ff', pattern: 'stripes' }, 'Red, yellow and blue panels. Smells like sunscreen.'],
    ['plinko', 'ball', 'disco', 'Disco Ball', 120, '🪩', { a: '#c9d3e6', b: '#6c7a96', c: '#ffffff', pattern: 'check', glow: true }, 'A mirror-tiled ball. Every bounce is a party.'],
    ['plinko', 'ball', 'comet', 'Comet', 170, '☄️', { a: '#5ad1ff', b: '#1a3a8a', c: '#e8fbff', pattern: 'flame', glow: true }, 'An icy comet with a blazing tail.'],
    ['plinko', 'ball', 'jackpot', 'Jackpot Gold', 250, '🪙', { a: '#ffcc33', b: '#b07a00', c: '#fff6c8', pattern: 'plain', glow: true }, 'Solid gold, polished to a shine. The pegs ring when it hits.'],
    ['plinko', 'cap', 'lucky', 'Lucky Backwards Cap', 50, '🧢', { shape: 'cap', a: '#2fb85a', b: '#ffffff', d: 'back' }, 'Worn backwards for luck. Science.'],
    ['plinko', 'cap', 'propeller', 'Prize Propeller', 90, '🌀', { shape: 'propeller', a: '#ff4d6d', b: '#ffd23a', c: '#3aa0ff' }, 'Spins faster the closer you get to the jackpot.'],
    ['plinko', 'cap', 'showman', 'Showman’s Topper', 170, '🎩', { shape: 'tophat', a: '#2a1d6b', b: '#ffcc33', c: '#fff6c8', d: 'glitter' }, 'A sparkly top hat for a game-show legend.'],
    // Quick Draw: your duellist's cowboy hat, badge and lasso.
    ['quickdraw', 'hat', 'sheriff', 'Midnight Sheriff', 60, '⭐', { shape: 'cowboy', a: '#2a2320', b: '#c9a14a', c: '#ffd23f', d: 'star', icon: '⭐' }, 'Black felt and a brass star on the band.'],
    ['quickdraw', 'hat', 'rose', 'Desert Rose', 90, '🌹', { shape: 'cowboy', a: '#e88aa8', b: '#8a1c3a', c: '#d0263c', d: 'rose', icon: '🌹' }, 'A dusty-pink hat with a rose tucked in the band.'],
    ['quickdraw', 'hat', 'rattler', 'Rattler Band', 120, '🐍', { shape: 'cowboy', a: '#7a5a34', b: '#3a2a14', c: '#e0c060', d: 'snake', pattern: 'stripes' }, 'A leather hat with a diamond-back band. Rattles when you draw.'],
    ['quickdraw', 'hat', 'cactus', 'Cactus Crown', 160, '🌵', { shape: 'cowboy', a: '#3f8f3a', b: '#2a5a24', c: '#f2d03b', d: 'cactus', icon: '🌵' }, 'Green as a saguaro, with a little flower on top.'],
    ['quickdraw', 'hat', 'golden', 'Golden Spur', 260, '🏆', { shape: 'cowboy', a: '#ffcc33', b: '#7a4a00', c: '#fff2a8', d: 'star', glow: true }, 'A gleaming gold hat for the fastest hand in the west.'],
    ['quickdraw', 'badge', 'tin', 'Tin Star', 50, '⭐', { shape: 'starBadge', a: '#c8ccd6', c: '#5a6070' }, 'Deputy’s tin star. It’s a start.'],
    ['quickdraw', 'badge', 'marshal', 'Marshal’s Star', 140, '🌟', { shape: 'starBadge', a: '#ffcc33', c: '#b8322c', glow: true }, 'Gold, polished, and feared across three counties.'],
    ['quickdraw', 'hand', 'lasso', 'Lucky Lasso', 80, '🪢', { shape: 'lasso', a: '#c9a36a' }, 'A coiled rope. Mostly for twirling at the other duellist.'],
    // President: the back of your cards, your crown and your cape at the royal table.
    ['president', 'cardBack', 'lattice', 'Midnight Lattice', 50, '🔷', { a: '#1d2b6b', b: '#6f8cff', pattern: 'check' }, 'Deep blue with a criss-cross lattice.'],
    ['president', 'cardBack', 'koi', 'Koi Pond', 100, '🐟', { a: '#0f7a7a', b: '#ff8a3a', pattern: 'wave', icon: '🐟' }, 'Teal ripples with a lazy orange koi.'],
    ['president', 'cardBack', 'starry', 'Starry Crest', 150, '✨', { a: '#2a1450', b: '#ffd23a', pattern: 'stars' }, 'Violet night scattered with gold stars.'],
    ['president', 'cardBack', 'gilded', 'Gilded Throne', 280, '👑', { a: '#b07a00', b: '#fff2a8', pattern: 'stripes', icon: '👑', glow: true }, 'Gold leaf and a little crown. The court bows.'],
    ['president', 'crown', 'paper', 'Paper Crown', 40, '📄', { shape: 'crown', a: '#ffe27a', b: '#e8323c', d: 'paper' }, 'Folded at the table. Still counts.'],
    ['president', 'crown', 'gold', 'Gold Crown', 140, '👑', { shape: 'crown', a: '#ffd84a', b: '#e74c3c', c: '#3ee6ff' }, 'Heavy is the head. Also shiny.'],
    ['president', 'crown', 'imperial', 'Imperial Crown', 260, '💎', { shape: 'crown', a: '#ffd84a', b: '#8a3aff', c: '#ffffff', d: 'imperial', glow: true }, 'Tall, jewelled and topped with a cross. Presidents only.'],
    ['president', 'cape', 'velvet', 'Velvet Cape', 120, '🧣', { shape: 'cape', a: '#a3243a', b: '#7a1a2a', c: '#d6af53' }, 'Red velvet with a gold collar.'],
    ['president', 'cape', 'ermine', 'Ermine Robe', 200, '🤍', { shape: 'cape', a: '#5a2a8a', b: '#f2ead6', c: '#ffd84a' }, 'Royal purple trimmed with spotted white fur.'],
    // Blackjack Night: chips on the felt, and the look of a card shark.
    ['blackjack', 'chips', 'mint', 'Mint Julep', 45, '🌿', { a: '#3fbf8a', b: '#e8fff4' }, 'Cool mint chips with white edge spots.'],
    ['blackjack', 'chips', 'neon', 'Neon Night', 100, '🌃', { a: '#ff3fb4', b: '#3ff0ff', glow: true }, 'Hot pink chips that glow like the signs.'],
    ['blackjack', 'chips', 'pearl', 'Black Pearl', 170, '⚫', { a: '#1a1a22', b: '#e8e2ff' }, 'Jet-black chips with pearl inlay.'],
    ['blackjack', 'chips', 'gold', 'High Roller Gold', 260, '💰', { a: '#ffcc33', b: '#7a4a00', glow: true }, 'Heavy gold chips. The dealer notices.'],
    ['blackjack', 'visor', 'dealer', 'Dealer’s Visor', 60, '🟩', { shape: 'visor', a: '#2fa060', b: '#1f7a4a', c: '#c0283c' }, 'Green see-through visor with an ace tucked in.'],
    ['blackjack', 'shades', 'shark', 'Card-Shark Shades', 90, '🕶️', { shape: 'shades', a: '#101014', b: '#2b1f3d' }, 'Nobody can read your eyes. Or your bust.'],
    ['blackjack', 'shades', 'aviator', 'Gold Aviators', 180, '😎', { shape: 'shades', a: '#3a2a10', b: '#ffcc33', d: 'aviator' }, 'Gold-rimmed aviators. Very high roller.'],
    ['blackjack', 'tie', 'bowtie', 'Red Bow Tie', 50, '🎀', { shape: 'bowtie', a: '#c0283c', b: '#8a1a2a' }, 'A crisp red bow tie for the felt.'],
    ['blackjack', 'tie', 'velvet', 'Velvet Bow Tie', 110, '🖤', { shape: 'bowtie', a: '#2a1a3a', b: '#ffcc33' }, 'Black velvet with a gold knot.'],
    // JustBid: your paddle on the TV, and the auction-house look.
    ['bid', 'paddle', 'lucky', 'Lucky Horseshoe', 55, '🧲', { a: '#2f8f5a', b: '#ffffff', icon: '🍀' }, 'A green paddle with a four-leaf clover.'],
    ['bid', 'paddle', 'flamingo', 'Flamingo Flash', 85, '🦩', { a: '#ff7ab6', b: '#ffffff', icon: '🦩' }, 'Bright pink, impossible to miss in the crowd.'],
    ['bid', 'paddle', 'map', 'Treasure Map', 140, '🗺️', { a: '#e8cf8a', b: '#7a4a1a', pattern: 'dots', icon: '❌' }, 'Old parchment. X marks the bid.'],
    ['bid', 'paddle', 'diamond', 'Diamond Hands', 230, '💎', { a: '#7ad8ff', b: '#ffffff', pattern: 'check', icon: '💎', glow: true }, 'A cut-crystal paddle. Never sells.'],
    ['bid', 'hat', 'boater', 'Auctioneer’s Boater', 70, '👒', { shape: 'straw', a: '#e8cf8a', b: '#c0283c', d: 'boater' }, 'A straw boater with a red band. Going once…'],
    ['bid', 'monocle', 'brass', 'Collector’s Monocle', 110, '🧐', { shape: 'monocle', a: '#d1b574' }, 'For inspecting the fine print on a mystery box.'],
    ['bid', 'gavel', 'oak', 'Oak Gavel', 60, '🔨', { shape: 'gavel', a: '#8a5a34', b: '#5a3a20' }, 'SOLD! (to you, in your head).'],
    ['bid', 'gavel', 'gold', 'Golden Gavel', 200, '🏆', { shape: 'gavel', a: '#ffcc33', b: '#7a4a00', glow: true }, 'A gold gavel for the biggest spender.'],
    // Tune Buzz: your buzzer, your headphones and your mic.
    ['tune', 'buzzer', 'bubble', 'Bubblegum', 40, '🍬', { a: '#ff7ad1', b: '#ffd0f0' }, 'Pink, sweet and very poppable.'],
    ['tune', 'buzzer', 'lime', 'Laser Lime', 90, '🟢', { a: '#9dff3a', b: '#2a5a00', glow: true }, 'A lime-green laser button.'],
    ['tune', 'buzzer', 'vinyl', 'Vinyl Spin', 150, '💿', { a: '#1a1a1a', b: '#ff3a5a', pattern: 'swirl' }, 'A spinning record with a red label.'],
    ['tune', 'buzzer', 'goldmic', 'Golden Mic', 240, '🎤', { a: '#ffcc33', b: '#fff2a8', icon: '🎤', glow: true }, 'Gold, glowing, chart-topping.'],
    ['tune', 'phones', 'studio', 'Studio Cans', 60, '🎧', { shape: 'headphones', a: '#2a2a34', b: '#ff3a5a' }, 'Big black studio headphones. You hear the song first.'],
    ['tune', 'phones', 'neon', 'Neon Cans', 120, '💚', { shape: 'headphones', a: '#3af0a0', b: '#ff3ad1', glow: true }, 'Glowing headphones for the club round.'],
    ['tune', 'phones', 'gold', 'Gold Record Cans', 220, '📀', { shape: 'headphones', a: '#ffcc33', b: '#7a4a00', glow: true }, 'Gold-plated. Certified platinum.'],
    ['tune', 'mic', 'retro', 'Retro Mic', 90, '🎙️', { shape: 'mic', a: '#c4ccd2', b: '#2a2a34' }, 'A chrome mic from the golden age of radio.'],
    ['tune', 'mic', 'diamond', 'Diamond Mic', 250, '💎', { shape: 'mic', a: '#bfefff', b: '#ffcc33', glow: true }, 'Encrusted. Every note sparkles.'],
    // JustSketch: extra pen colours (your drawings show them), a beret and a brush.
    ['sketch', 'pens', 'sunset', 'Sunset Markers', 50, '🌅', { a: '#ff6b6b', b: '#ffa94d', pens: ['#ff6b6b', '#ffa94d', '#ffd43b', '#e64980'] }, 'Four warm markers: coral, tangerine, sun and rose.'],
    ['sketch', 'pens', 'pastel', 'Pastel Chalk', 80, '🧁', { a: '#ffc9de', b: '#b9e6ff', pens: ['#ffc9de', '#b9e6ff', '#c8f7c5', '#e5d4ff'] }, 'Soft chalky pastels for cute doodles.'],
    ['sketch', 'pens', 'ocean', 'Deep Sea Inks', 110, '🐙', { a: '#0b7285', b: '#3bc9db', pens: ['#0b7285', '#1864ab', '#3bc9db', '#63e6be'] }, 'Teals and blues from the bottom of the sea.'],
    ['sketch', 'pens', 'neon', 'Highlighter Pack', 150, '🖍️', { a: '#e8ff3a', b: '#ff3ad1', pens: ['#e8ff3a', '#3aff8a', '#ff3ad1', '#3ad8ff'] }, 'Four blinding highlighters.'],
    ['sketch', 'pens', 'metal', 'Metallic Gels', 220, '✨', { a: '#d4af37', b: '#c0c0c0', pens: ['#d4af37', '#c0c0c0', '#b87333', '#8a6dd8'] }, 'Gold, silver, copper and violet gel pens.'],
    ['sketch', 'beret', 'red', 'Red Beret', 50, '🔴', { shape: 'beret', a: '#c0283c' }, 'Instantly 40% more artistic.'],
    ['sketch', 'beret', 'splat', 'Paint-Splat Beret', 120, '🎨', { shape: 'beret', a: '#2a2a52', b: '#ff5a8a', d: 'splat' }, 'Spattered with every colour of the relay.'],
    ['sketch', 'brush', 'fine', 'Fine Brush', 70, '🖌️', { shape: 'brush', a: '#c9a36a', b: '#e8323c' }, 'A fine-tip brush dipped in red.'],
    ['sketch', 'brush', 'gold', 'Golden Brush', 200, '✨', { shape: 'brush', a: '#ffcc33', b: '#8a3aff', glow: true }, 'For masterpieces only (stick figures count).'],
    // JustSummon: your banner over the war table, plus your summoner's helm, staff and cape.
    ['summon', 'banner', 'lion', 'Lion Rampant', 70, '🦁', { a: '#d4a017', b: '#7a1010', icon: '🦁' }, 'A golden lion on deep red.'],
    ['summon', 'banner', 'owl', 'Moon Owl', 90, '🦉', { a: '#3a3a8a', b: '#e8e8ff', icon: '🦉', pattern: 'stars' }, 'A wise owl under the stars.'],
    ['summon', 'banner', 'eagle', 'Storm Eagle', 130, '🦅', { a: '#2a6a9a', b: '#ffffff', icon: '🦅', pattern: 'stripes' }, 'An eagle riding the thunderheads.'],
    ['summon', 'banner', 'dragon', 'Dragonflame', 220, '🐉', { a: '#1a1a1a', b: '#ff5a1f', icon: '🐉', pattern: 'flame', glow: true }, 'A black banner with a fire-breathing dragon.'],
    ['summon', 'helm', 'horned', 'Horned Helm', 90, '🐂', { shape: 'helm', a: '#9aa6ae', b: '#efe6cc', d: 'horned' }, 'Steel and two big horns. Charge!'],
    ['summon', 'helm', 'mage', 'Battle Mage Hat', 140, '🧙', { shape: 'wizard', a: '#3d4f8a', b: '#c1aa75', c: '#ffd35c' }, 'A starry hat that hums with summoning power.'],
    ['summon', 'helm', 'bone', 'Bone Crown', 220, '💀', { shape: 'crown', a: '#efe6cc', b: '#8a1a2a', c: '#e8323c', d: 'bone', glow: true }, 'A crown of bone for the necro-summoner.'],
    ['summon', 'staff', 'oak', 'Oak Staff', 80, '🪄', { shape: 'staff', a: '#8a5a34', c: '#7ad8ff' }, 'Gnarled oak with a blue crystal.'],
    ['summon', 'staff', 'crystal', 'Crystal Staff', 200, '🔮', { shape: 'staff', a: '#3a2a5a', c: '#ff5ad1', glow: true }, 'A glowing pink crystal. The troops march faster (they don’t).'],
    ['summon', 'cape', 'war', 'War Cape', 160, '🦇', { shape: 'cape', a: '#2a2a34', b: '#7a1010', c: '#c4ccd2' }, 'A dark cape with a steel clasp.'],
    // Zombie Survival: the bandana, mask, trusty tool and pack on your survivor.
    ['zombie', 'bandana', 'camo', 'Camo Rag', 50, '🪖', { shape: 'bandana', a: '#5a6a3a', b: '#2f3a20', d: 'camo', pattern: 'dots' }, 'Woodland camo. The zombies won’t see you (they will).'],
    ['zombie', 'bandana', 'polka', 'Lucky Polka', 70, '🔵', { shape: 'bandana', a: '#2a6aff', b: '#ffffff', d: 'dots', pattern: 'dots' }, 'Blue with white dots. Cheerful in a crisis.'],
    ['zombie', 'bandana', 'hazard', 'Hazard Stripe', 120, '⚠️', { shape: 'bandana', a: '#ffd23a', b: '#1a1a1a', d: 'stripes', pattern: 'stripes' }, 'Yellow and black. Caution: survivor.'],
    ['zombie', 'bandana', 'glow', 'Glow Stick', 200, '🧪', { shape: 'bandana', a: '#7aff3a', b: '#e8ffd0', d: 'dots', glow: true }, 'A glowing green bandana. Great for night runs.'],
    ['zombie', 'mask', 'hockey', 'Hockey Mask', 120, '🏒', { shape: 'hockey', a: '#f2efe8', b: '#c0283c' }, 'Classic. Terrifying. Breathable.'],
    ['zombie', 'mask', 'gas', 'Gas Mask', 160, '😷', { shape: 'gasMask', a: '#5a6a4a', b: '#2a2a2a' }, 'Filters out the zombie smell (mostly).'],
    ['zombie', 'weapon', 'flashlight', 'Flashlight', 60, '🔦', { shape: 'flashlight', a: '#3a3a44', c: '#fff6a8' }, 'Lights up the dark. Attracts moths and zombies.'],
    ['zombie', 'weapon', 'bat', 'Baseball Bat', 70, '🏏', { shape: 'bat', a: '#c9a36a', b: '#2a2a34' }, 'A trusty wooden bat with taped grip.'],
    ['zombie', 'weapon', 'pan', 'Frying Pan', 90, '🍳', { shape: 'pan', a: '#3a3a44', b: '#5a3a20' }, 'Breakfast and self-defence in one.'],
    ['zombie', 'weapon', 'spiked', 'Spiked Bat', 150, '⚔️', { shape: 'bat', a: '#8a6a44', b: '#c0283c', d: 'nails' }, 'The upgraded bat. Hardware store special.'],
    ['zombie', 'pack', 'survival', 'Survival Pack', 110, '🎒', { shape: 'backpack', a: '#5a6a3a', b: '#3a4a2a', c: '#c0392b' }, 'Bedroll, beans, batteries. Ready to run.'],
    // JustEscape: your detective's magnifier, hat and pipe.
    ['escape', 'magnifier', 'silver', 'Silver Loupe', 50, '🥈', { shape: 'magnifier', a: '#c8ccd6', b: '#5a6070' }, 'A polished silver loupe.'],
    ['escape', 'magnifier', 'ruby', 'Ruby Lens', 110, '❤️', { shape: 'magnifier', a: '#c81e3a', b: '#ffd0d8' }, 'Red-tinted glass. Spots blood (ketchup) at a glance.'],
    ['escape', 'magnifier', 'ebony', 'Midnight Ebony', 160, '🌙', { shape: 'magnifier', a: '#c9a14a', b: '#2a1a12' }, 'Dark wood and brass. Very serious.'],
    ['escape', 'magnifier', 'gold', 'Golden Eye', 250, '🌟', { shape: 'magnifier', a: '#ffcc33', b: '#7a4a00', glow: true }, 'A gold-rimmed glass that gleams when you find a clue.'],
    ['escape', 'cap', 'deerstalker', 'Deerstalker', 90, '🕵️', { shape: 'deerstalker', a: '#a8865a', b: '#5a3a20', c: '#5a3a20' }, 'Elementary. The classic detective cap.'],
    ['escape', 'cap', 'fedora', 'Gumshoe Fedora', 130, '🎩', { shape: 'fedora', a: '#4a4a52', b: '#1a1a1a' }, 'A grey fedora for rainy-night cases.'],
    ['escape', 'pipe', 'bubble', 'Bubble Pipe', 60, '🫧', { shape: 'bubblePipe', a: '#8a5a34', b: '#bfefff' }, 'Blows thinking bubbles while you work.'],
    // Meme Maker: a frame around your memes, and meme-lord shades.
    ['memes', 'frame', 'polaroid', 'Instant Photo', 50, '📷', { a: '#ffffff', b: '#e8e2d0' }, 'A white instant-photo border.'],
    ['memes', 'frame', 'comic', 'Comic Burst', 80, '💥', { a: '#ffd23a', b: '#1a1a1a', pattern: 'dots' }, 'Halftone yellow with a heavy ink line.'],
    ['memes', 'frame', 'neon', 'Neon Tube', 120, '💡', { a: '#ff3ad1', b: '#3ad8ff', glow: true }, 'Buzzing pink and blue neon.'],
    ['memes', 'frame', 'gold', 'Museum Gold', 200, '🖼️', { a: '#d4a017', b: '#7a4a00', pattern: 'stripes', glow: true }, 'An ornate gold frame. Instantly priceless.'],
    ['memes', 'shades', '3d', '3D Glasses', 50, '👓', { shape: 'glasses3d', a: '#ffffff' }, 'Red, blue and extremely immersive.'],
    ['memes', 'shades', 'pixel', 'Deal-With-It Shades', 120, '😎', { shape: 'pixelShades', a: '#101014' }, 'They drop in from the top of the screen. Probably.'],
    ['memes', 'cap', 'back', 'Meme Lord Cap', 60, '🧢', { shape: 'cap', a: '#ff3ad1', b: '#ffd23a', d: 'back' }, 'A backwards cap for posting at 3 a.m.'],
    // Letter Rush: your pencil (in your hand) and a thinking cap.
    ['letters', 'pencil', 'ruby', 'Ruby Red', 40, '🔴', { shape: 'pencil', a: '#e8323c', b: '#ffd0d0' }, 'A red pencil for confident answers.'],
    ['letters', 'pencil', 'sky', 'Sky Blue', 60, '🔵', { shape: 'pencil', a: '#3a9aff', b: '#d0e8ff' }, 'A calm blue pencil.'],
    ['letters', 'pencil', 'rainbow', 'Rainbow Lead', 140, '🌈', { shape: 'pencil', a: '#ff5a5a', b: '#5a8aff', c: '#ffd23a', pattern: 'stripes' }, 'Every colour, swirled down the barrel.'],
    ['letters', 'pencil', 'quill', 'Golden Quill', 220, '🪶', { shape: 'pencil', a: '#ffcc33', b: '#7a4a00', d: 'quill', glow: true }, 'Fancy. Writes the same, feels faster.'],
    ['letters', 'band', 'sweat', 'Speed Sweatband', 50, '💦', { shape: 'sweatband', a: '#ff5a5a', b: '#ffffff' }, 'For when the clock is ticking.'],
    ['letters', 'band', 'grad', 'Thinking Cap', 120, '🎓', { shape: 'gradcap', a: '#2a2a3a', c: '#ffcc33' }, 'A mortarboard. Every word you think of is a big word.'],
    // Color Match: the frame around your mix, plus your painter's look.
    ['colormatch', 'easel', 'oak', 'Oak Frame', 45, '🪵', { a: '#a0703a', b: '#5a3a1a' }, 'A warm wooden frame.'],
    ['colormatch', 'easel', 'splatter', 'Paint Splatter', 90, '🎨', { a: '#ff5a8a', b: '#3ad8ff', c: '#ffd23a', pattern: 'dots' }, 'Speckled with every colour you missed.'],
    ['colormatch', 'easel', 'marble', 'Gallery Marble', 140, '🏛️', { a: '#f2efe8', b: '#9a958a', pattern: 'swirl' }, 'Veined white marble, like a real museum.'],
    ['colormatch', 'easel', 'gold', 'Masterpiece Gold', 230, '🏆', { a: '#ffcc33', b: '#7a4a00', glow: true }, 'For mixes that belong on a wall.'],
    ['colormatch', 'beret', 'artist', 'Artist Beret', 50, '🎨', { shape: 'beret', a: '#3a3a52', b: '#ffd23a', d: 'splat' }, 'Black beret, one tiny splat.'],
    ['colormatch', 'apron', 'splat', 'Painter’s Smock', 90, '🧑‍🎨', { shape: 'apron', a: '#f2efe8', b: '#9a958a', d: 'splat' }, 'A white smock covered in happy accidents.'],
    ['colormatch', 'palette', 'wood', 'Wooden Palette', 80, '🎨', { shape: 'palette', a: '#c9a36a', b: '#9b59b6' }, 'Every primary colour, ready to mix.'],
    ['colormatch', 'palette', 'rainbow', 'Prism Palette', 170, '🌈', { shape: 'palette', a: '#f2efe8', b: '#ff3ad1', glow: true }, 'A glowing white palette for perfect matches.'],
    // Hot Take Trivia: your contestant light, and a brainy look.
    ['trivia', 'podium', 'ice', 'Ice Cold', 45, '🧊', { a: '#7ad8ff', b: '#e8fbff' }, 'A frosty blue light.'],
    ['trivia', 'podium', 'ember', 'Ember', 80, '🔥', { a: '#ff5a1f', b: '#ffd23a', glow: true }, 'Smouldering orange. Your takes are hot.'],
    ['trivia', 'podium', 'ultra', 'Ultraviolet', 130, '🔮', { a: '#8a3aff', b: '#ff3ad1', glow: true }, 'Purple black-light glow.'],
    ['trivia', 'podium', 'champ', 'Champion Gold', 220, '🏅', { a: '#ffcc33', b: '#fff2a8', glow: true, icon: '👑' }, 'A gold light and a little crown.'],
    ['trivia', 'cap', 'grad', 'Graduation Cap', 70, '🎓', { shape: 'gradcap', a: '#1d2b6b', c: '#ffd23f' }, 'You studied for this. Allegedly.'],
    ['trivia', 'cap', 'laurel', 'Laurel Wreath', 180, '🌿', { shape: 'laurel', a: '#3f8f3a', c: '#ffcc33', glow: true }, 'For the undisputed know-it-all.'],
    ['trivia', 'specs', 'smart', 'Smart Specs', 50, '🤓', { shape: 'specs', a: '#2b1f3d' }, 'Thick frames. Thicker facts.'],
    ['trivia', 'medal', 'gold', 'Quiz Medal', 140, '🥇', { shape: 'medal', a: '#ffcc33', b: '#2a6aff' }, 'A gold medal on a blue ribbon.'],
    // JustKingdoms: an emblem on your castles, and your ruler's helm and arms.
    ['kingdoms', 'crest', 'stag', 'Silver Stag', 70, '🦌', { icon: '🦌' }, 'A proud stag on your castle walls.'],
    ['kingdoms', 'crest', 'rose', 'Wild Rose', 90, '🌹', { icon: '🌹' }, 'A rose for a kingdom that blooms.'],
    ['kingdoms', 'crest', 'wolf', 'Iron Wolf', 150, '🐺', { icon: '🐺' }, 'A howling wolf. The neighbours get nervous.'],
    ['kingdoms', 'crest', 'sun', 'Golden Sun', 240, '☀️', { icon: '☀️', glow: true }, 'A blazing sun over every tower.'],
    ['kingdoms', 'helm', 'iron', 'Iron Helm', 70, '⛑️', { shape: 'helm', a: '#a6b2b6', b: '#5a6070' }, 'A plain steel helm. Keeps the arrows out.'],
    ['kingdoms', 'helm', 'plume', 'Plumed Helm', 130, '🪶', { shape: 'helm', a: '#c4ccd2', b: '#d6af53', c: '#c0283c', d: 'plume' }, 'Polished steel with a red plume.'],
    ['kingdoms', 'helm', 'crown', 'King’s Crown', 200, '👑', { shape: 'crown', a: '#ffd84a', b: '#c0283c', c: '#3ee6ff', glow: true }, 'All the land you see is yours.'],
    ['kingdoms', 'arms', 'sword', 'Steel Sword', 90, '🗡️', { shape: 'sword', a: '#d4dade', b: '#d6af53' }, 'A knight’s sword, raised for the realm.'],
    ['kingdoms', 'arms', 'flag', 'Kingdom Flag', 120, '🚩', { shape: 'flag', a: '#2a6aff', b: '#ffd23f', c: '#ffd23f' }, 'Plant it on every hill you take.'],
    // JustBlanks: show-night hat, shades and your answer cards.
    ['blanks', 'hat', 'party', 'Party Hat', 40, '🥳', { shape: 'party', a: '#9b59b6', b: '#ffd23f', c: '#ff4f9a' }, 'It’s a party. The blanks are the guests.'],
    ['blanks', 'hat', 'tophat', 'Showbiz Top Hat', 120, '🎩', { shape: 'tophat', a: '#1e1e24', b: '#ff4f9a', c: '#ffffff', d: 'glitter' }, 'Sparkly top hat for a big-night answer.'],
    ['blanks', 'shades', 'star', 'Star Shades', 80, '🌟', { shape: 'starGlasses', a: '#ffd23f', b: '#2b1f3d' }, 'You’re the star tonight.'],
    ['blanks', 'cards', 'cue', 'Answer Cards', 60, '🃏', { shape: 'cards', a: '#ff5a8a', b: '#2b1f3d' }, 'A fan of cards, all your best answers.'],
    // Two Truths & a Lie: an investigator's hat, a disguise and a case file.
    ['truths', 'hat', 'noir', 'Noir Fedora', 80, '🎩', { shape: 'fedora', a: '#2a2a2e', b: '#8a1f1f' }, 'Black and white and suspicious all over.'],
    ['truths', 'disguise', 'groucho', 'Nose & Glasses', 60, '🥸', { shape: 'groucho' }, 'The world’s most convincing disguise.'],
    ['truths', 'disguise', 'domino', 'Mystery Mask', 120, '🎭', { shape: 'domino', a: '#2a1a3a', b: '#d6af53' }, 'Nobody will guess which one is the lie.'],
    ['truths', 'file', 'case', 'Case File', 90, '📁', { shape: 'file', a: '#e0b24a', b: '#2b1f3d' }, 'Three facts. One is lying. It’s all in here.'],
    // JustFunny: silly hats, a funny face and a prop.
    ['funny', 'hat', 'propeller', 'Propeller Beanie', 60, '🌀', { shape: 'propeller', a: '#3a9aff', b: '#ffd23f', c: '#e8323c' }, 'Spins when you’re funny. Spins a lot.'],
    ['funny', 'face', 'clown', 'Clown Nose', 40, '🔴', { shape: 'clownNose', a: '#e8323c' }, 'Honk honk.'],
    ['funny', 'face', 'star', 'Showtime Shades', 90, '🤩', { shape: 'starGlasses', a: '#ff3ad1', b: '#2b1f3d' }, 'Big pink star glasses for the comedy hour.'],
    ['funny', 'prop', 'popcorn', 'Popcorn Tub', 70, '🍿', { shape: 'popcorn', a: '#e8323c' }, 'For enjoying everyone else’s jokes.'],
    ['funny', 'prop', 'chicken', 'Rubber Chicken', 150, '🐔', { shape: 'chicken', a: '#ffe066', b: '#ff9a2a' }, 'The funniest object ever made. Squeak.'],
    // Who Said It?: a newsboy cap, a masquerade mask and gossip props.
    ['whosaid', 'cap', 'newsboy', 'Newsboy Cap', 70, '🧢', { shape: 'newsboy', a: '#6a5a4a', b: '#3a2a1a' }, 'Extra, extra! Read all about who said it.'],
    ['whosaid', 'mask', 'masquerade', 'Masquerade Mask', 110, '🎭', { shape: 'domino', a: '#7a1aff', b: '#ffcc33' }, 'Anonymous. Mysterious. Probably said it.'],
    ['whosaid', 'prop', 'quill', 'Gossip Quill', 60, '🪶', { shape: 'pencil', a: '#ff7ab6', b: '#7a1aff', d: 'quill' }, 'Writes down everything everyone said.'],
    ['whosaid', 'prop', 'megaphone', 'Rumour Megaphone', 150, '📣', { shape: 'megaphone', a: '#ff5a1f', b: '#2b1f3d' }, 'For telling the whole room.'],
    // Price Panic: the store crew look.
    ['price', 'cap', 'clerk', 'Store Clerk Cap', 50, '🧢', { shape: 'cap', a: '#e8323c', b: '#ffffff', c: '#ffd23a' }, 'Red cap with the store logo. Clean-up on aisle five!'],
    ['price', 'cap', 'crown', 'Bargain Crown', 180, '👑', { shape: 'crown', a: '#ffcc33', b: '#e8323c', d: 'paper', glow: true }, 'For the monarch of deals.'],
    ['price', 'tag', 'name', 'Staff Name Tag', 40, '🏷️', { shape: 'nameTag', a: '#e8323c' }, 'Hi! My name is… (it’s you).'],
    ['price', 'tool', 'basket', 'Shopping Basket', 80, '🧺', { shape: 'basket', a: '#c0283c' }, 'Full of things you can’t guess the price of.'],
    ['price', 'tool', 'scanner', 'Price Scanner', 130, '📟', { shape: 'scanner', a: '#2a2a34', c: '#ff3a3a' }, 'Beep. Still wrong. Beep.'],
    // Emoji Charades: boppers, heart glasses and your phone.
    ['emoji', 'boppers', 'hearts', 'Heart Boppers', 60, '💕', { shape: 'antennae', a: '#ff5a8a', b: '#ff5a8a', d: 'heart' }, 'Two bouncy hearts on a headband.'],
    ['emoji', 'boppers', 'stars', 'Star Boppers', 90, '⭐', { shape: 'antennae', a: '#ffd23f', b: '#ffd23f', d: 'star' }, 'Two bouncy stars. Very emoji.'],
    ['emoji', 'glasses', 'heart', 'Heart Glasses', 70, '😍', { shape: 'heartGlasses', a: '#ff3a6a', b: '#2b1f3d' }, 'Heart eyes, permanently.'],
    ['emoji', 'phone', 'phone', 'Emoji Phone', 120, '📱', { shape: 'phone', a: '#2a2a34', b: '#3ad8ff' }, 'Typing… typing… 😜'],
    // Most Likely To…: crowned the most likely.
    ['likely', 'tiara', 'tiara', 'Prom Tiara', 80, '👸', { shape: 'tiara', a: '#d4dade', b: '#ff5ab4' }, 'Most likely to wear a tiara.'],
    ['likely', 'sash', 'winner', 'Winner Sash', 60, '🎗️', { shape: 'sash', a: '#ff5ab4', c: '#ffffff' }, 'Officially voted most likely.'],
    ['likely', 'sash', 'gold', 'Gold Sash', 160, '🏅', { shape: 'sash', a: '#ffcc33', c: '#ffffff', glow: true }, 'Most likely to win everything.'],
    ['likely', 'trophy', 'trophy', 'Big Trophy', 200, '🏆', { shape: 'trophy', a: '#ffcc33', b: '#5a3a20', glow: true }, 'You were always most likely to get this.'],
    // Where Do You Stand?: a rally cap, a sign and a pin.
    ['spectrum', 'cap', 'rally', 'Rally Cap', 50, '🧢', { shape: 'cap', a: '#3a8aff', b: '#ffffff', c: '#ff7a3a' }, 'Pick a side and wear it proud.'],
    ['spectrum', 'sign', 'placard', 'Placard', 60, '🪧', { shape: 'sign', a: '#fff8e8', b: '#2b1f3d', c: '#ff7a3a' }, 'A hand-lettered sign. Its opinion is strong.'],
    ['spectrum', 'sign', 'neon', 'Neon Sign', 150, '💡', { shape: 'sign', a: '#2a1a3a', b: '#3ad8ff', c: '#ff3ad1', glow: true }, 'Glows on either end of the scale.'],
    ['spectrum', 'pin', 'button', 'Button Pin', 40, '🔘', { shape: 'pin', a: '#ff7a3a', b: '#3a8aff' }, 'Half orange, half blue. Very balanced.'],
    // Debate Club: the court look.
    ['debate', 'wig', 'judge', 'Judge’s Wig', 120, '👨‍⚖️', { shape: 'wig', a: '#f2efe8' }, 'Powdered, curled and extremely authoritative.'],
    ['debate', 'tie', 'power', 'Power Tie', 50, '👔', { shape: 'tie', a: '#c0283c', b: '#7a1a2a' }, 'Win the argument before you speak.'],
    ['debate', 'hand', 'gavel', 'Order Gavel', 80, '🔨', { shape: 'gavel', a: '#6a2a1a', b: '#d4a017' }, 'Order! Order!'],
    ['debate', 'hand', 'mic', 'Podium Mic', 140, '🎤', { shape: 'mic', a: '#2a2a34', b: '#c4ccd2' }, 'For your closing argument.'],
    // Act It Out: the theatre look.
    ['actout', 'hat', 'director', 'Director’s Beret', 60, '🎬', { shape: 'beret', a: '#1a1a1a' }, 'And… action!'],
    ['actout', 'hat', 'tophat', 'Stage Top Hat', 90, '🎩', { shape: 'tophat', a: '#2a1a3a', b: '#c0283c', c: '#ffcc33' }, 'Take a bow.'],
    ['actout', 'mask', 'drama', 'Comedy Mask', 130, '🎭', { shape: 'dramaMask', a: '#ffe6a0', b: '#ff7a9a' }, 'Smile for the people in the back row.'],
    ['actout', 'prop', 'megaphone', 'Director’s Megaphone', 100, '📣', { shape: 'megaphone', a: '#ffcc33', b: '#2b1f3d' }, 'Louder! With feeling!'],
    // Alien Abduction: the space crew look.
    ['alien', 'antennae', 'band', 'Antenna Band', 50, '👽', { shape: 'antennae', a: '#7aff3a', b: '#2a5a00' }, 'Bobbly green antennae. Take me to your leader.'],
    ['alien', 'antennae', 'bubble', 'Bubble Helmet', 160, '🫧', { shape: 'bubble', a: '#9fe8ff' }, 'A glass dome. Oxygen included.'],
    ['alien', 'goggles', 'star', 'Star Goggles', 80, '🥽', { shape: 'goggles', a: '#ff3ad1', b: '#c4ccd2' }, 'See the universe in pink.'],
    ['alien', 'ray', 'ray', 'Toy Ray Gun', 130, '🔫', { shape: 'raygun', a: '#ff5a1f', b: '#c4ccd2', c: '#7aff3a' }, 'Pew pew. Completely harmless.'],
    ['alien', 'pack', 'jet', 'Jetpack', 220, '🚀', { shape: 'jetpack', a: '#c4ccd2', b: '#e8323c' }, 'Twin rockets. Escape velocity guaranteed.'],
    // Bomb Squad: the defuser's kit.
    ['bomb', 'hardhat', 'hard', 'Hard Hat', 50, '⛑️', { shape: 'hardhat', a: '#ffb81c', b: '#2b1f3d' }, 'Safety first.'],
    ['bomb', 'goggles', 'safety', 'Safety Goggles', 60, '🥽', { shape: 'goggles', a: '#9fe8ff', b: '#ffd23a' }, 'Protect your eyes (and your dignity).'],
    ['bomb', 'tool', 'cutters', 'Wire Cutters', 90, '✂️', { shape: 'cutters', a: '#e8323c' }, 'Red wire or blue wire?'],
    ['bomb', 'vest', 'blast', 'Blast Vest', 170, '🦺', { shape: 'vest', a: '#3a4a5a', b: '#ffd23a' }, 'Padded, armoured, very brave.'],
    // JustRaiseDucks: life on the farm.
    ['ducks', 'hat', 'straw', 'Straw Hat', 50, '👒', { shape: 'straw', a: '#e8cf8a', b: '#c0392b' }, 'A wide straw hat for sunny days on the pond.'],
    ['ducks', 'hat', 'farmer', 'Farmer Cap', 70, '🧢', { shape: 'cap', a: '#3d7a3a', b: '#ffd23a', c: '#ffd23a' }, 'Green cap, sun on your neck, ducks at your feet.'],
    ['ducks', 'tool', 'duck', 'Rubber Duck', 90, '🦆', { shape: 'duck', a: '#ffd23a', b: '#ff8a1a' }, 'The farm’s mascot. Squeak.'],
    ['ducks', 'tool', 'fork', 'Pitchfork', 110, '🔱', { shape: 'pitchfork', a: '#8a5a34', b: '#c4ccd2' }, 'For hay, mostly. Not for ducks.'],
    // Pizza (the pizza game): the kitchen look.
    ['pizza', 'hat', 'chef', 'Chef’s Hat', 50, '👨‍🍳', { shape: 'chef', a: '#ffffff' }, 'A classic puffy chef’s hat.'],
    ['pizza', 'hat', 'tall', 'Grand Toque', 140, '🎩', { shape: 'chef', a: '#ffffff', b: '#e8323c', d: 'tall' }, 'Extra tall. Extra cheese.'],
    ['pizza', 'apron', 'red', 'Red Apron', 60, '🍅', { shape: 'apron', a: '#e8323c', b: '#b82a2a' }, 'Sauce-proof (sauce-coloured).'],
    ['pizza', 'apron', 'striped', 'Pizzeria Apron', 110, '🇮🇹', { shape: 'apron', a: '#ffffff', b: '#2fa060', d: 'stripes' }, 'Green stripes, white cotton, red sauce stains.'],
    ['pizza', 'tool', 'cutter', 'Pizza Cutter', 70, '🍕', { shape: 'pizzaCutter', a: '#e8323c' }, 'Eight slices, every time.'],
    ['pizza', 'tool', 'pin', 'Rolling Pin', 80, '🥖', { shape: 'rollingPin', a: '#d9b27a' }, 'For the perfect thin crust.'],
    ['pizza', 'tool', 'peel', 'Pizza Peel', 90, '🍕', { shape: 'peel', a: '#c9a36a', c: '#f2c14e' }, 'A wooden peel with a fresh pie on it.'],
    // YesChef world kitchens (the YesChef team's own block): one wearable per new kitchen, drawn by
    // public/wear-art.js (bandana, hachimaki, paperHat, iceScoop).
    ['pizza', 'hat', 'bandana', 'Taco Truck Bandana', 70, '🌮', { shape: 'bandana', a: '#e2453a', b: '#ffffff' }, 'Tía Lupe’s red polka dots. The griddle is hot!'],
    ['pizza', 'hat', 'hachimaki', 'Sushi Headband', 80, '🍣', { shape: 'hachimaki', a: '#24345e', b: '#ffffff' }, 'Indigo and white, tied tight. Eight perfect pieces.'],
    ['pizza', 'hat', 'paperhat', 'Diner Paper Hat', 60, '🍔', { shape: 'paperHat', a: '#ffffff', b: '#d62828', c: '#ffd23f' }, 'Big Buck’s grill-side classic. Order up!'],
    ['pizza', 'tool', 'scoop', 'Ice Cream Scoop', 110, '🍨', { shape: 'iceScoop', a: '#c4ccd2', b: '#ff9ab0', c: '#e0304a' }, 'Coco’s scoop, loaded with strawberry and a cherry.'],
    // JustUndercover: the agency look.
    ['king', 'hat', 'circlet', 'Pretender’s Circlet', 90, '👑', { shape: 'crown', a: '#d4dade', b: '#8e1b2e', c: '#3fd0ff' }, 'Not a crown. Not yet.'],
    ['king', 'hat', 'guard', 'Plumed Guard Helm', 140, '🪖', { shape: 'helm', a: '#c4ccd2', b: '#e0b84a', c: '#8e1b2e', d: 'plume' }, 'For knights who guard the throne, or eye it.'],
    ['king', 'hat', 'usurper', 'Usurper’s Crown', 240, '💎', { shape: 'crown', a: '#2a1b3d', b: '#e8424f', c: '#e0b84a', d: 'imperial', glow: true }, 'Taken, not given. Worn with a smirk.'],
    ['king', 'hand', 'dagger', 'Court Dagger', 110, '🗡️', { shape: 'sword', a: '#d4dade', b: '#8e1b2e' }, 'Strictly ceremonial. Strictly.'],
    ['king', 'hand', 'scepter', 'Royal Scepter', 180, '🪄', { shape: 'staff', a: '#e0b84a', c: '#e8424f', glow: true }, 'Point it at someone and say “summoned”.'],
    ['king', 'cloak', 'velvet', 'Courtier’s Cloak', 120, '🧣', { shape: 'cape', a: '#5a1a6a', b: '#3a0f46', c: '#e0b84a' }, 'Plum velvet for whispering in corridors.'],
    ['king', 'cloak', 'shroud', 'Ghostly Shroud', 160, '👻', { shape: 'cape', a: '#b7c7d8', b: '#7a8aa0', c: '#ffffff' }, 'For courtiers who came back to haunt.'],
    // TrashZombies: scavenged junk you wear while you blast through the town.
    ['trash', 'hat', 'hardhat', 'Dented Hard Hat', 60, '⛑️', { shape: 'hardhat', a: '#ff8c2e', b: '#2b1f1a', c: '#fff6a8', d: 'lamp' }, 'Found it in a dumpster. Still has a working lamp.'],
    ['trash', 'hat', 'rag', 'Hazard Bandana', 80, '⚠️', { shape: 'bandana', a: '#9cff3c', b: '#1a1a1a', d: 'stripes', pattern: 'stripes' }, 'Toxic green with black stripes. Very punk.'],
    ['trash', 'mask', 'smog', 'Smog Mask', 140, '😷', { shape: 'gasMask', a: '#6a7a5a', b: '#2a2a2a' }, 'Keeps out the landfill smell. Mostly.'],
    ['trash', 'mask', 'weld', 'Welder Goggles', 90, '🥽', { shape: 'goggles', a: '#9cff3c', b: '#5a5f66' }, 'Green-tinted. Every zombie glows a little.'],
    ['trash', 'pack', 'junk', 'Junk Backpack', 110, '🎒', { shape: 'backpack', a: '#7a8590', b: '#4a5058', c: '#ff8c2e' }, 'Stuffed with spare hubcaps and duct tape.'],
    ['trash', 'pack', 'rocket', 'Leaf-Blower Jetpack', 240, '🚀', { shape: 'jetpack', a: '#ff8c2e', b: '#c9ccd1', glow: true }, 'Two leaf blowers strapped together. It sort of flies.'],
    ['undercover', 'hat', 'fedora', 'Agent Fedora', 60, '🕵️', { shape: 'fedora', a: '#2a2d36', b: '#c8a24a' }, 'Brim down, collar up. Nobody saw you come in.'],
    ['undercover', 'hat', 'trilby', 'Night Trilby', 130, '🎩', { shape: 'fedora', a: '#5a1e2a', b: '#101014' }, 'A deep red trilby for the late-night briefings.'],
    ['undercover', 'shades', 'mirror', 'Mirror Shades', 80, '🕶️', { shape: 'shades', a: '#101014', b: '#8fd3ff', d: 'aviator' }, 'They can see themselves. They can’t see you.'],
    ['undercover', 'shades', 'nose', 'Perfect Disguise', 50, '🥸', { shape: 'groucho' }, 'Glasses, nose and moustache. Totally undetectable.'],
    ['undercover', 'gadget', 'file', 'Top Secret File', 70, '📁', { shape: 'file', a: '#c8323a', b: '#2b1f3d' }, 'Eyes only. Especially not the mole’s.'],
    ['undercover', 'gadget', 'phone', 'Spy Phone', 150, '📱', { shape: 'phone', a: '#1a1a22', b: '#3aff8a' }, 'Encrypted, scrambled and very shiny.'],
    ['undercover', 'gadget', 'lens', 'Pocket Lens', 90, '🔍', { shape: 'magnifier', a: '#c8a24a', b: '#3a2a14' }, 'For finding the tiny tell in every clue.'],
    ['undercover', 'tie', 'black', 'Agency Tie', 60, '👔', { shape: 'tie', a: '#101014', b: '#3a3a44' }, 'Black tie, black suit, black mood.'],
    // JustSnap (the photo game): SNAP! magazine's photographers.
    ['snap', 'camera', 'instant', 'Instant Camera', 70, '📸', { shape: 'camera', a: '#f4f1ea', b: '#ff4f6d', d: 'instant' }, 'Click, whirr, a little square photo. Very retro.'],
    ['snap', 'camera', 'film', 'Film Camera', 120, '📷', { shape: 'camera', a: '#2b2b33', b: '#9aa3b5', d: 'film' }, 'A proper camera with a proper lens.'],
    ['snap', 'camera', 'gold', 'Golden Shutter', 220, '🌟', { shape: 'camera', a: '#ffcc33', b: '#7a4a00', d: 'film', glow: true }, 'Its flash goes off all by itself. Cover photos only.'],
    ['snap', 'hat', 'beret', 'Gallery Beret', 60, '🎨', { shape: 'beret', a: '#1d1d24' }, 'Black beret. Every photo is now art.'],
    ['snap', 'hat', 'paparazzo', 'Paparazzo Cap', 90, '🧢', { shape: 'newsboy', a: '#6b5a4a', b: '#3a2e24' }, 'For waiting outside fancy restaurants.'],
    ['snap', 'pass', 'press', 'Press Pass', 50, '🪪', { shape: 'pressPass', a: '#ff4f6d', b: '#1d1d24' }, 'SNAP! magazine, staff photographer.'],
    ['snap', 'pass', 'vip', 'All-Access Pass', 140, '🎟️', { shape: 'pressPass', a: '#ffcc33', b: '#7b3fb5' }, 'Backstage, front row, the editor’s office.'],
    ['snap', 'shades', 'star', 'Red-Carpet Shades', 80, '🕶️', { shape: 'shades', a: '#101014', b: '#ffcc33', d: 'aviator' }, 'The flashes are blinding out there.'],
    // JustPitch: the keynote look.
    ['pitch', 'mic', 'keynote', 'Keynote Mic', 70, '🎤', { shape: 'mic', a: '#1d2560', b: '#d8dee9' }, 'For pitches that change the world (or at least the room).'],
    ['pitch', 'mic', 'gold', 'Golden Mic', 200, '🌟', { shape: 'mic', a: '#ffc83d', b: '#fff3c4', glow: true }, 'Investors can’t say no to a golden mic.'],
    ['pitch', 'tie', 'power', 'Pitch-Deck Tie', 50, '👔', { shape: 'tie', a: '#ff5a3c', b: '#a82a14' }, 'Bold, confident, slightly too long.'],
    ['pitch', 'tie', 'teal', 'Late-Night Tie', 90, '📺', { shape: 'tie', a: '#18d4c8', b: '#0a5e5a' }, 'Operators are standing by.'],
    ['pitch', 'hat', 'showman', 'Showman’s Top Hat', 110, '🎩', { shape: 'tophat', a: '#14163a', b: '#ff5a3c' }, 'Ladies and gentlemen, the product!'],
    ['pitch', 'hat', 'studio', 'Studio Headphones', 90, '🎧', { shape: 'headphones', a: '#18d4c8', b: '#14163a' }, 'Hear every cue from backstage.'],
    ['pitch', 'shades', 'visionary', 'Visionary Shades', 80, '🕶️', { shape: 'shades', a: '#14163a', b: '#18d4c8' }, 'You can see the future. It has slides.'],
    ['pitch', 'shades', 'spot', 'Spotlight Shades', 120, '😎', { shape: 'shades', a: '#ff5a3c', b: '#ffc83d', d: 'aviator' }, 'The stage lights are very bright up here.'],
  ];

  const slotInfo = (game, slot) => SLOTS.find((s) => s.game === game && s.slot === slot) || null;
  const GEAR = RAW.map(([game, slot, value, name, cost, icon, paint, desc]) => {
    const si = slotInfo(game, slot) || {};
    return { id: 'gear:' + game + ':' + value, game, slot, spot: si.spot || null, name, value, cost, desc, icon, paint: Object.freeze(paint), where: si.where || 'tv' };
  });
  const BY_ID = new Map(GEAR.map((g) => [g.id, g]));
  const GAMES_WITH_GEAR = SLOTS.map((s) => ({ game: s.game, slot: s.slot, label: s.label, spot: s.spot || null, where: s.where || 'tv', default: { name: s.default.name, value: 'classic', icon: s.default.icon, desc: s.default.desc } }));
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
  // The wearables to draw on a player's character in one game, for MTArt.drawCharacter's `wear`
  // option: [{ spot, shape, a, b, c, d, glow }]. `gear` is a gearSet ({ <slot>: value }) or a room
  // player's whole p.gear ({ <game>: { <slot>: value } }). Unknown or missing gear gives [].
  function wearOf(game, gear) {
    if (!gear || typeof gear !== 'object') return [];
    const set = gear[game] && typeof gear[game] === 'object' && !Array.isArray(gear[game]) ? gear[game] : gear;
    const out = [];
    for (const s of SLOTS) {
      if (s.game !== game || !s.spot || !Object.prototype.hasOwnProperty.call(set, s.slot)) continue;
      const it = itemOf(game, s.slot, set[s.slot]); if (!it || !it.paint.shape) continue;
      const p = it.paint; out.push({ spot: s.spot, shape: p.shape, a: p.a, b: p.b, c: p.c, d: p.d, glow: !!p.glow, id: it.id });
    }
    return out;
  }
  // Phone themes were replaced by wearables; kept so older game code calling it stays harmless.
  function phoneTheme(el) {
    if (!el || typeof document === 'undefined') return;
    Promise.resolve().then(() => { const old = el.querySelector(':scope > #gear-theme'); if (old) old.remove(); });
  }

  const API = { PATTERNS, SPOTS, GEAR, GAMES_WITH_GEAR, SLOTS: GAMES_WITH_GEAR, BY_ID, gearOf, gearSet, paint, wearOf, slotsOf, itemOf, phoneTheme };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.MT_GEAR = API;
})(typeof window !== 'undefined' ? window : globalThis);
