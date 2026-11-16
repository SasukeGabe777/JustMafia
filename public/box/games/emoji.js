'use strict';
// Emoji Charades screens. TV: one big "stage" per Clue Giver with the emoji clue popping in
// live, hints, how many have solved it, an anonymous ticker of wrong guesses, then the reveal.
// Phone: the giver's searchable emoji keyboard, or the guess box for everyone else.
// Both screens keep their DOM between updates (only changed parts are redrawn), so emoji
// animations, the keyboard's scroll position and what you are typing are never interrupted.
(function () {
  const { esc, timer } = BOX;
  const SEP = '│';

  // ---- The emoji keyboard: an exact copy of KEYBOARD_TEXT in box/games/emoji-content.js ----
  /*KB-START*/
const KEYBOARD_TEXT = {
  faces: `
😀 grin happy smile
😂 laugh tears lol funny joke
🤣 rofl laugh rolling
😊 blush happy smile nice
😍 love heart eyes crush
🥰 love adore hearts
😘 kiss love
😎 cool sunglasses
🤓 nerd geek smart glasses
🤔 think thinking hmm question
🤨 suspicious doubt eyebrow
😐 neutral meh blank
🙄 eyeroll bored whatever
😴 sleep tired zzz asleep
🤤 drool hungry yum
😷 sick mask doctor
🤒 sick fever ill thermometer
🤢 nausea gross sick green
🤮 vomit sick puke
🥵 hot heat sweat
🥶 cold freeze frozen winter
🤯 mind blown explode shock
🥳 party celebrate birthday
😱 scream scared horror fear
😭 cry sob sad tears
😡 angry mad rage
🤬 swear curse angry
😈 devil evil horns
👿 imp devil angry
💀 skull dead death skeleton
☠️ pirate skull crossbones poison
👻 ghost boo spooky halloween
👽 alien ufo space
🤖 robot machine ai
💩 poop
🤡 clown circus
👹 ogre monster beast
🎃 pumpkin halloween lantern
😺 cat smile
🙈 monkey see hide
🙉 monkey hear
🙊 monkey speak secret
😇 angel halo innocent
🤠 cowboy hat western
🤫 shush quiet secret
🤐 zip mouth secret silent
😬 grimace awkward
😏 smirk sly
🥺 pleading puppy eyes please
😳 flushed embarrassed shock
🤑 money rich dollar
🤪 crazy zany silly
😜 wink tongue silly
🤧 sneeze cold tissue
😵 dizzy
🧐 monocle detective inspect
🗣️ speak talk shout gossip
`,
  people: `
👶 baby child
👧 girl
👦 boy kid
👩 woman lady
👨 man guy
👵 grandma old woman granny
👴 grandpa old man
👮 police cop officer law
🕵️ detective spy sleuth
💂 guard soldier
👷 builder construction worker
🤴 prince royal
👸 princess queen royal
🧙 wizard magic witch mage
🧚 fairy magic
🧛 vampire dracula
🧟 zombie undead
🧜 mermaid sea
🦸 superhero hero
🦹 villain supervillain
🧞 genie wish lamp
🎅 santa christmas
🤶 mrs claus christmas
👩‍🍳 chef cook kitchen
👨‍⚕️ doctor health nurse
👩‍🚀 astronaut space
👨‍🚒 firefighter fireman
👩‍🏫 teacher school
👨‍🌾 farmer farm
👩‍🎤 singer rock star
👨‍🎨 artist painter
👩‍💻 coder programmer computer
👨‍✈️ pilot plane captain
👰 bride wedding
🤵 groom tuxedo wedding
🤰 pregnant mom mother
💃 dance dancer woman salsa
🕺 dance disco man
🏃 run runner
🚶 walk
🧘 yoga meditate
🏊 swim swimmer pool
🏄 surf surfer
🧗 climb climber
🤷 shrug dunno
🙋 raise hand hi
🤦 facepalm
🙏 pray please thanks
👋 wave hello bye hi
👍 thumbs up yes good like
👎 thumbs down no bad
👏 clap applause
💪 strong muscle flex arm
✌️ peace victory two
🤞 fingers crossed luck
🤘 rock metal horns
🤝 handshake deal
👀 eyes look see watch
👂 ear hear listen
👃 nose smell
👄 mouth lips kiss
🦷 tooth teeth dentist
🦵 leg kick
🧠 brain smart mind
👣 footprints feet walk
`,
  animals: `
🐶 dog puppy
🐱 cat kitten
🐭 mouse rat
🐹 hamster
🐰 rabbit bunny
🦊 fox
🐻 bear
🐼 panda
🐨 koala
🐯 tiger
🦁 lion king
🐮 cow bull
🐷 pig hog
🐸 frog toad
🐵 monkey
🦍 gorilla ape
🐔 chicken hen
🐧 penguin
🐦 bird
🦅 eagle
🦉 owl
🦆 duck
🦇 bat
🐺 wolf
🐴 horse pony
🦄 unicorn
🐉 dragon
🐝 bee honey
🐛 bug caterpillar worm
🦋 butterfly
🐌 snail slow
🐞 ladybug beetle
🕷️ spider
🕸️ web spider
🦂 scorpion
🐢 turtle tortoise slow
🐍 snake
🦎 lizard
🦖 dinosaur trex rex
🦕 dinosaur sauropod
🐙 octopus
🦑 squid
🦀 crab
🦞 lobster
🐠 fish tropical
🐟 fish
🐬 dolphin
🐳 whale
🦈 shark jaws
🐊 crocodile alligator
🐘 elephant
🦒 giraffe
🦓 zebra
🦘 kangaroo
🐪 camel desert
🦩 flamingo
🦜 parrot
🐑 sheep lamb
🐐 goat
🦌 deer reindeer
🐿️ squirrel
🌲 tree forest pine
🌴 palm tree tropical
🌵 cactus desert
🌻 sunflower flower
🌹 rose flower love
🍀 clover luck lucky
🍁 leaf autumn fall maple
🌸 blossom spring flower
`,
  food: `
🍎 apple
🍌 banana
🍇 grapes grape
🍓 strawberry
🍉 watermelon melon
🍊 orange
🍋 lemon sour
🍒 cherry
🍑 peach
🍍 pineapple
🥥 coconut
🥑 avocado
🥕 carrot
🌽 corn
🌶️ pepper chili hot spicy
🥒 cucumber pickle
🥦 broccoli vegetable
🍄 mushroom
🥔 potato
🧅 onion
🧄 garlic
🍞 bread toast loaf
🥐 croissant french
🥞 pancakes breakfast
🧇 waffle
🧀 cheese
🥚 egg
🍳 fried egg cooking pan breakfast
🥓 bacon
🍔 burger hamburger
🍟 fries chips
🍕 pizza
🌭 hotdog sausage
🥪 sandwich
🌮 taco mexican
🌯 burrito wrap
🍝 spaghetti pasta noodles
🍜 ramen noodles soup
🍣 sushi japanese
🍤 shrimp prawn
🍚 rice bowl
🥧 pie
🍦 ice cream
🍩 donut doughnut
🍪 cookie biscuit
🎂 birthday cake
🍰 cake slice
🧁 cupcake muffin
🍫 chocolate
🍬 candy sweet
🍭 lollipop
🍿 popcorn movie
🥜 peanut nut
🍯 honey
🧂 salt
🥛 milk
☕ coffee tea hot
🍵 tea green
🍺 beer
🍷 wine
🍸 cocktail martini
🥤 soda drink cup
🧃 juice box
🍽️ plate dinner meal
🍴 fork knife eat
`,
  travel: `
🚗 car drive
🚕 taxi cab
🚌 bus
🚓 police car
🚑 ambulance
🚒 fire truck engine
🏎️ race car fast
🚲 bike bicycle
🛵 scooter
🏍️ motorcycle
🚂 train locomotive steam
🚇 subway metro
✈️ plane airplane fly flight
🚁 helicopter
🚀 rocket space launch
🛸 ufo flying saucer alien
⛵ sailboat boat sail
🚢 ship cruise boat
🛶 canoe boat
⚓ anchor
🗺️ map
🧭 compass direction
🏔️ mountain snow
🌋 volcano
🏝️ island beach
🏖️ beach umbrella vacation
🏜️ desert
🏕️ camping tent
🏠 house home
🏰 castle
🗼 tower tokyo paris
🗽 statue liberty
🗿 moai statue stone rock face
🗻 fuji mountain
⛩️ shrine gate
🎡 ferris wheel fair
🎢 roller coaster
🎠 carousel
⛲ fountain
🏥 hospital
🏫 school
🏦 bank money
🏨 hotel
🏪 store shop
🏟️ stadium
⛪ church
🌍 earth world globe
🌎 america world
🌏 asia world
🌙 moon night
☀️ sun sunny
⭐ star
🌟 glowing star
⚡ lightning electric thunder
🌈 rainbow
☁️ cloud
🌧️ rain
❄️ snow snowflake winter ice
⛄ snowman
🌊 wave ocean sea water
🔥 fire hot lit
💧 water drop
🌪️ tornado storm wind
☔ umbrella rain
🌅 sunrise
🌃 night city
🏙️ city skyline
🚦 traffic light
⛽ fuel gas
🛣️ highway road
🚧 construction
`,
  objects: `
📱 phone mobile
💻 laptop computer
⌨️ keyboard
🖥️ desktop computer
📺 tv television
📷 camera photo
🎥 movie camera film
📞 telephone call
⏰ alarm clock time
⌛ hourglass time
💡 idea light bulb
🔦 flashlight torch
🕯️ candle
🔍 search magnifier find look
💰 money bag
💵 dollar cash
💎 diamond gem jewel
💍 ring wedding engagement
👑 crown king queen royal
🎩 top hat magic
👓 glasses
🕶️ sunglasses cool
👔 shirt tie
👗 dress
👠 heel shoe
👟 sneaker shoe
🧦 socks
🧤 gloves
🧣 scarf
🎒 backpack school
👜 handbag purse bag
☂️ umbrella
🔑 key
🗝️ old key
🔒 lock
🚪 door
🛏️ bed sleep
🛋️ couch sofa
🪑 chair seat
🚽 toilet bathroom
🛁 bath tub
🧸 teddy bear toy
🎁 gift present
🎈 balloon
📚 books library read
📖 book read story
✏️ pencil write
✂️ scissors cut
📌 pin
📎 paperclip
🔨 hammer tool
🔧 wrench tool
🪓 axe
🔪 knife
🗡️ dagger sword
⚔️ swords battle fight
🛡️ shield
🏹 bow arrow archer
🔫 water gun pistol
💣 bomb
🧨 firecracker dynamite
🔮 crystal ball fortune magic
🧪 test tube science lab
🔬 microscope science
🔭 telescope stars
💊 pill medicine
💉 syringe needle vaccine
🧲 magnet
⚙️ gear
🧹 broom sweep witch
🧻 toilet paper
⚱️ urn
💈 barber pole
📦 box package
✉️ envelope mail letter
📅 calendar date
`,
  activities: `
⚽ soccer football ball
🏀 basketball
🏈 football
⚾ baseball
🎾 tennis
🏐 volleyball
🏉 rugby
🎱 pool billiards
🏓 ping pong
🏸 badminton
🏒 hockey
⛳ golf
🥊 boxing glove
🥋 karate martial arts judo
🎿 ski skiing
🏂 snowboard
⛸️ ice skate
🛹 skateboard
🏋️ weightlifting gym lift
🤸 cartwheel gymnastics
🤺 fencing
🏇 horse racing jockey
🚴 cycling biker
🏆 trophy win champion cup
🥇 gold medal first winner
🥈 silver second
🥉 bronze third
🏅 medal
🎯 target dart bullseye
🎳 bowling
🎮 video game controller gaming
🕹️ joystick arcade
🎰 slot machine casino jackpot
🎲 dice game board
♟️ chess pawn
🃏 joker card
🧩 puzzle jigsaw
🎨 art paint palette
🎭 theater drama masks
🎤 microphone sing karaoke
🎧 headphones music
🎼 music score
🎵 note music song
🎶 notes music song
🎹 piano keyboard
🎸 guitar rock
🥁 drum
🎺 trumpet
🎻 violin
🎷 saxophone jazz
🎬 clapper film movie action
🎪 circus tent
🎉 party popper celebrate
🎊 confetti
🎆 fireworks
🎄 christmas tree
🪁 kite
🎣 fishing rod
🎟️ ticket admission
🏁 finish flag race
`,
  symbols: `
❤️ heart love red
💔 broken heart heartbreak
💕 two hearts love
💙 blue heart
💘 cupid arrow love
💯 hundred perfect
💤 sleep zzz
💥 boom explosion crash
💫 dizzy star
💦 sweat water splash
💨 dash wind fast
💬 speech talk chat
💭 thought think dream
❓ question what
❗ exclamation important
⚠️ warning
🚫 no prohibited forbidden ban
⛔ no entry stop
✅ check yes done correct
❌ cross no wrong
➕ plus add and
➖ minus
✖️ multiply times
➗ divide
♾️ infinity forever
💲 dollar money
🔝 top
🆕 new
🆓 free
🆒 cool
🆘 sos help
🔄 repeat again cycle
⏩ fast forward
⏪ rewind back
⏸️ pause
▶️ play start
⏹️ stop
⬆️ up
⬇️ down
⬅️ left back
➡️ right forward next
↩️ return back
🔁 repeat loop
1️⃣ one 1 first
2️⃣ two 2 second
3️⃣ three 3
🔟 ten 10
🔤 abc letters alphabet
♻️ recycle
☮️ peace
☯️ yin yang balance
✨ sparkle magic shiny
🔔 bell ring
🔕 silent mute
🔊 loud speaker sound
📍 location pin place
🏳️ white flag surrender
🏴‍☠️ pirate flag
🚩 red flag
⏳ hourglass waiting
🌀 cyclone spiral swirl
`,
};
const KB_CATS = [
  { key: 'faces', label: 'Faces', icon: '😀' },
  { key: 'people', label: 'People', icon: '🧑' },
  { key: 'animals', label: 'Nature', icon: '🐶' },
  { key: 'food', label: 'Food', icon: '🍔' },
  { key: 'travel', label: 'Places', icon: '✈️' },
  { key: 'objects', label: 'Objects', icon: '💡' },
  { key: 'activities', label: 'Activities', icon: '⚽' },
  { key: 'symbols', label: 'Symbols', icon: '❤️' },
];
  /*KB-END*/

  const KB = {};
  for (const [cat, block] of Object.entries(KEYBOARD_TEXT)) KB[cat] = block.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => { const i = l.indexOf(' '); return { e: l.slice(0, i), tags: l.slice(i + 1).trim().split(/\s+/), cat }; });
  const ALL = Object.values(KB).flat();

  // ---- Small DOM helpers ----
  const h = (tag, cls, html) => { const n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; };
  const put = (node, html) => { if (node && node.__h !== html) { node.innerHTML = html; node.__h = html; } };
  const clock = (node, endsIn) => {
    if (!endsIn) { if (node.__e) { node.innerHTML = ''; node.__e = 0; } return; }
    const ends = Date.now() + endsIn;
    if (!node.__e || Math.abs(node.__e - ends) > 1500) { node.__e = ends; node.innerHTML = '⏱ ' + timer(endsIn); }
    node.classList.toggle('low', endsIn < 10500);
  };
  // Adds new emojis with a pop and fades out undone ones (keyed by their server sequence number).
  function clueRow(node, clue) {
    const want = new Set(clue.map((c) => String(c.k)));
    for (const child of [...node.children]) if (!child.classList.contains('gone') && !want.has(child.dataset.k)) { child.classList.add('gone'); setTimeout(() => child.remove(), 420); }
    const have = new Set([...node.children].filter((c) => !c.classList.contains('gone')).map((c) => c.dataset.k));
    for (const c of clue) {
      if (have.has(String(c.k))) continue;
      const s = h('span', 'em-e pop' + (c.e === SEP ? ' sep' : ''), null); s.dataset.k = String(c.k); s.textContent = c.e; node.appendChild(s);
    }
    node.classList.toggle('has', clue.length > 0);
  }
  const stars = (d) => `<span class="em-stars">${'★'.repeat(d)}${'☆'.repeat(Math.max(0, 3 - d))}</span>`;
  const hintHtml = (pat) => (pat ? `<div class="em-pattern">${pat.map((w) => `<span class="w">${[...w].map((ch) => (ch === '_' ? '<i></i>' : /[A-Z0-9]/.test(ch) ? `<i class="l">${esc(ch)}</i>` : `<b>${esc(ch)}</b>`)).join('')}</span>`).join('')}</div><div class="em-hintcap">${pat.length} word${pat.length === 1 ? '' : 's'}</div>` : '');
  const medal = ['🥇', '🥈', '🥉'];
  const awardsHtml = (list) => (list && list.length ? `<div class="em-awards">${list.map((a) => `<div class="em-award"><div class="ic">${a.icon}</div><div class="t">${esc(a.title)}</div><div class="nm">${esc(a.name)}</div><div class="muted">${esc(a.detail)}</div></div>`).join('')}</div>` : '');

  // ================= TV =================
  let T = null;
  function tvRoot(el) {
    if (T && T.el === el && el.contains(T.root)) return T;
    el.innerHTML = '';
    const root = h('div', 'em-tv');
    root.innerHTML = '<div class="em-top"><div class="em-round"></div><div class="em-status"></div><div class="em-clock"></div></div><div class="em-body"><section class="em-stages"></section><aside class="em-side panel"><h3>Score</h3><div class="em-board"></div><div class="em-ticker"></div></aside></div><div class="em-over" hidden></div><div class="em-flash"></div>';
    el.appendChild(root);
    const q = (s) => root.querySelector(s);
    T = { el, root, round: q('.em-round'), status: q('.em-status'), clock: q('.em-clock'), body: q('.em-body'), stages: q('.em-stages'), board: q('.em-board'), ticker: q('.em-ticker'), over: q('.em-over'), flash: q('.em-flash'), nodes: new Map(), seenTick: new Set() };
    return T;
  }
  function tvStage(t, st, phase) {
    let n = t.nodes.get(st.id);
    if (!n) {
      const root = h('div', 'em-stage');
      root.innerHTML = '<div class="em-sh"></div><div class="em-clue"></div><div class="em-hint"></div><div class="em-sf"></div>';
      n = { root, sh: root.querySelector('.em-sh'), clue: root.querySelector('.em-clue'), hint: root.querySelector('.em-hint'), sf: root.querySelector('.em-sf') };
      t.nodes.set(st.id, n);
    }
    n.root.style.setProperty('--gc', st.color || '#ffd23f');
    n.root.classList.toggle('revealed', phase === 'reveal');
    n.root.classList.toggle('left', !!st.left);
    put(n.sh, `<span class="em-giver"><span class="dot"></span>${esc(st.giver)}</span>${st.cat ? `<span class="em-cat">${st.cat.icon} ${esc(st.cat.label)}</span>${stars(st.diff)}` : ''}`);
    clueRow(n.clue, st.clue);
    n.clue.dataset.wait = phase === 'pick' ? (st.picked ? '🔒 Secret locked in…' : '🤫 Choosing a secret…') : st.left ? '😢 The Clue Giver left' : '🤔 Thinking of emojis…';
    put(n.hint, phase === 'clue' ? hintHtml(st.hint) : '');
    let sf = '';
    if (phase === 'reveal' && st.answer) {
      const r = st.result;
      sf = `<div class="em-answer">${esc(st.answer)}</div><div class="em-res">${r.first ? `⚡ <b>${esc(r.first.name)}</b> got it first (${r.first.s}s) · ${st.solved}/${st.of} solved` : '😶 Nobody got it!'}${r.giverPts ? ` · 🎨 ${esc(st.giver)} +${r.giverPts}` : ''}</div>`;
    } else if (phase === 'clue') {
      const pct = st.of ? Math.round(100 * st.solved / st.of) : 0;
      sf = `<div class="em-progress"><div class="em-bar"><i style="width:${pct}%"></i></div><span><b>${st.solved}</b>/${st.of} solved</span></div>${st.firsts.length ? `<div class="em-firsts">${st.firsts.map((nm, i) => `<span>${medal[i]} ${esc(nm)}</span>`).join('')}</div>` : ''}`;
    }
    put(n.sf, sf);
    return n.root;
  }

  // ================= Phone =================
  let P = null, kbCat = 'faces', search = '', draft = '', kbScroll = {}, lastRound = 0;
  let recent = []; try { recent = JSON.parse(localStorage.getItem('em.recent') || '[]').filter((e) => ALL.some((k) => k.e === e)).slice(0, 32); } catch { recent = []; }
  const remember = (e) => { recent = [e, ...recent.filter((x) => x !== e)].slice(0, 32); try { localStorage.setItem('em.recent', JSON.stringify(recent)); } catch { /* private */ } };
  function kbList() {
    const q = search.toLowerCase().trim();
    if (q) {
      const terms = q.split(/\s+/);
      return ALL.filter((k) => terms.every((w) => k.e === w || k.tags.some((t) => t.startsWith(w)) || k.cat.startsWith(w))).slice(0, 160);
    }
    if (kbCat === 'recent') return recent.map((e) => ALL.find((k) => k.e === e)).filter(Boolean);
    return KB[kbCat] || [];
  }
  function drawGrid() {
    if (!P || !P.grid) return;
    const key = search ? 'q:' + search : kbCat, list = kbList();
    if (P.grid.dataset.key === key && P.grid.__n === list.length) return;
    P.grid.dataset.key = key; P.grid.__n = list.length;
    P.grid.innerHTML = list.length ? list.map((k) => `<button class="em-key" data-e="${esc(k.e)}" title="${esc(k.tags.join(' '))}">${k.e}</button>`).join('')
      : `<div class="em-none">${kbCat === 'recent' && !search ? 'Emojis you use show up here.' : 'No emoji for that. Try another word!'}</div>`;
    P.grid.scrollTop = kbScroll[key] || 0;
    for (const b of P.tabs.querySelectorAll('[data-cat]')) b.classList.toggle('on', !search && b.dataset.cat === kbCat);
  }
  function phoneRoot(el, ctx) {
    if (P && P.el === el && el.contains(P.root)) { P.ctx = ctx; return P; }
    el.innerHTML = '';
    const root = h('div', 'em-ph');
    root.innerHTML = '<div class="em-me"><span class="em-pts"></span><span class="em-clk"></span></div><div class="em-main"></div>';
    el.appendChild(root);
    P = { el, root, ctx, pts: root.querySelector('.em-pts'), clk: root.querySelector('.em-clk'), main: root.querySelector('.em-main'), mode: null };
    root.addEventListener('click', onTap);
    return P;
  }
  function onTap(ev) {
    const b = ev.target.closest('button'); if (!b || !P || b.disabled) return;
    const ctx = P.ctx;
    if (b.dataset.e) { const e = b.dataset.e; ctx.act({ op: 'emoji', e }).then((r) => { if (r && r.ok) remember(e); }); ctx.vibrate(10); return; }
    if (b.dataset.cat) { kbCat = b.dataset.cat; search = ''; if (P.search) P.search.value = ''; drawGrid(); return; }
    if (b.dataset.pick != null) { ctx.act({ op: 'pick', i: Number(b.dataset.pick) }).then((r) => { if (r && r.ok) { ctx.sfx('click'); ctx.vibrate(30); } }); return; }
    const a = b.dataset.a;
    if (a === 'sep') ctx.act({ op: 'sep' });
    else if (a === 'undo') { ctx.act({ op: 'undo' }); ctx.vibrate(15); }
    else if (a === 'hint') { if (confirm(`Give everyone a hint? It costs you ${P.v ? P.v.hintCost : 75} points.`)) ctx.act({ op: 'hint' }); }
    else if (a === 'guess') sendGuess();
    else if (a === 'clearq') { search = ''; if (P.search) { P.search.value = ''; } drawGrid(); }
  }
  async function sendGuess() {
    if (!P || !P.guess) return;
    const text = P.guess.value.replace(/\s+/g, ' ').trim(); if (!text) return;
    const ctx = P.ctx;
    P.guess.value = ''; draft = '';
    const r = await ctx.act({ op: 'guess', text });
    if (!r || !r.ok) { if (P.guess && !P.guess.value) { P.guess.value = text; draft = text; } return; }
    if (r.result === 'correct') { ctx.sfx('chime'); ctx.vibrate(120); ctx.toast(`✅ ${r.answer}! +${r.pts}`); }
    else if (r.result === 'close') { ctx.sfx('heartbeat'); ctx.vibrate(60); ctx.toast('🔥 So close! Keep going…'); bump('close'); }
    else bump('nope');
  }
  function bump(cls) { const bar = P && P.root.querySelector('.em-guessbar'); if (!bar) return; bar.classList.remove('close', 'nope'); void bar.offsetWidth; bar.classList.add(cls); }

  function phoneMode(p, mode, v) {
    if (p.mode === mode) return;
    p.mode = mode; p.grid = p.tabs = p.search = p.guess = null;
    const m = p.main;
    if (mode === 'clue-giver') {
      m.innerHTML = `<div class="em-secret"></div><div class="em-clue em-myclue" data-wait="Tap emojis below to build your clue"></div>
        <div class="em-tools"><button class="btn small ghost" data-a="sep" title="Word break">│ Word</button><button class="btn small ghost" data-a="undo">⌫ Undo</button><button class="btn small ghost" data-a="hint">💡 Hint −${v.hintCost}</button></div>
        <div class="em-kb"><div class="em-tabs">${[{ key: 'recent', icon: '🕘' }, ...KB_CATS].map((c) => `<button data-cat="${c.key}" title="${esc(c.label || 'Recent')}">${c.icon}</button>`).join('')}</div>
        <div class="em-searchrow"><textarea class="em-search" rows="1" maxlength="30" placeholder="🔍 Search: king, rain, fast…" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="search"></textarea><button class="em-x" data-a="clearq" aria-label="Clear search">✕</button></div>
        <div class="em-grid"></div></div>`;
      p.secret = m.querySelector('.em-secret'); p.myclue = m.querySelector('.em-myclue'); p.tools = m.querySelector('.em-tools');
      p.tabs = m.querySelector('.em-tabs'); p.search = m.querySelector('.em-search'); p.grid = m.querySelector('.em-grid');
      p.search.value = search;
      p.search.oninput = () => { search = p.search.value.replace(/\n/g, ''); if (/\n/.test(p.search.value)) { p.search.value = search; p.search.blur(); } drawGrid(); };
      p.grid.onscroll = () => { kbScroll[p.grid.dataset.key] = p.grid.scrollTop; };
      if (!recent.length && kbCat === 'recent') kbCat = 'faces';
      drawGrid();
    } else if (mode === 'clue-guesser') {
      m.innerHTML = `<div class="em-mini"></div><div class="em-guessbar"><textarea class="em-guess" rows="1" maxlength="40" placeholder="Type your guess…" autocomplete="off" enterkeyhint="send"></textarea><button class="btn green" data-a="guess">Guess</button></div><div class="em-done"></div><div class="em-feed"></div>`;
      p.mini = m.querySelector('.em-mini'); p.guess = m.querySelector('.em-guess'); p.feed = m.querySelector('.em-feed'); p.done = m.querySelector('.em-done'); p.bar = m.querySelector('.em-guessbar');
      p.guess.value = draft;
      p.guess.oninput = () => { draft = p.guess.value.replace(/\n/g, ''); if (p.guess.value !== draft) p.guess.value = draft; };
      p.guess.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); sendGuess(); } };
    } else m.innerHTML = '<div class="em-simple"></div>';
    p.simple = m.querySelector('.em-simple');
  }

  BOX.games.emoji = {
    name: 'Emoji Charades', icon: '🤔',
    about: 'Say it with emojis only! The Clue Giver taps out a secret on their phone, one emoji at a time. Everyone races to guess it.',
    how: [
      'Each round a Clue Giver secretly picks a movie, animal, food, place, saying… from three choices.',
      'They spell it out using ONLY emojis from the keyboard on their phone. Each one pops up on the big screen.',
      'Everyone else types guesses on their phone, as many as you like. Small typos are fine! “🔥 So close” means you’re nearly there.',
      'First right answer scores the most. Fewer emojis = bigger points. The Clue Giver scores for everyone who gets it.',
      'Stuck? Hints show the number of words, then the first letters.',
    ],
    fx: { shuffle: 'shuffle', pick: 'click', go: 'whoosh', emoji: 'pop', sep: 'click', undo: 'poof', hint: 'unlock', first: 'cheer', correct: 'chime', reveal: 'reveal', boo: 'shrug', poof: 'poof', win: 'win' },
    onFx(f) {
      if (f.kind !== 'first' || !T || !T.flash) return;
      const n = h('div', 'em-flashmsg', `⚡ <b>${esc(f.name)}</b> got it!`); T.flash.appendChild(n); setTimeout(() => n.remove(), 2600);
    },

    tv(el, s) {
      if (!s) return;
      const t = tvRoot(el);
      const over = s.phase === 'over';
      t.body.hidden = over; t.over.hidden = !over;
      if (over) {
        const w = s.standings[0];
        put(t.round, ''); put(t.status, ''); clock(t.clock, 0);
        put(t.over, `<div class="final"><div class="crown">🤔</div><div class="muted">Emoji Champion</div><h2>${esc(w ? w.name : '')}</h2>${awardsHtml(s.awards)}
          <div class="em-endgrid"><div>${BOX.board(s.standings, (r) => r.points, ' pts')}</div>${s.history && s.history.some((x) => x.clue) ? `<div class="em-hist"><h3>Clue replay</h3>${s.history.filter((x) => x.clue).slice(-8).map((x) => `<div class="row"><span class="c">${esc(x.clue || '…')}</span><span>= <b>${esc(x.answer)}</b> <span class="muted">by ${esc(x.giver)}</span></span></div>`).join('')}</div>` : ''}</div></div>`);
        return;
      }
      put(t.round, `Round <b>${s.round}</b>/${s.total}`);
      const givers = s.stages.map((x) => x.giver);
      const who = givers.length > 1 ? givers.slice(0, -1).map(esc).join(', ') + ' & ' + esc(givers[givers.length - 1]) : esc(givers[0] || '');
      put(t.status, s.phase === 'pick' ? `🤫 ${who} ${givers.length > 1 ? 'are' : 'is'} choosing a secret…` : s.phase === 'clue' ? '📱 Guess on your phone!' : s.stages.length > 1 ? 'The answers were…' : 'The answer was…');
      clock(t.clock, s.phase === 'reveal' ? 0 : s.endsIn);
      t.stages.className = 'em-stages n' + Math.max(1, s.stages.length);
      const keep = new Set(s.stages.map((x) => x.id));
      for (const [id, n] of t.nodes) if (!keep.has(id)) { n.root.remove(); t.nodes.delete(id); }
      s.stages.forEach((st, i) => { const node = tvStage(t, st, s.phase); if (t.stages.children[i] !== node) t.stages.insertBefore(node, t.stages.children[i] || null); });
      put(t.board, BOX.board(s.standings, (r) => r.points, ''));
      const fresh = (k) => { const f = !t.seenTick.has(k); t.seenTick.add(k); return f; };
      put(t.ticker, s.phase === 'clue' && s.ticker.length ? `<h3>Not quite…</h3>${s.ticker.slice().reverse().map((x) => `<div class="em-tk ${fresh(x.k) ? 'in' : ''}">❌ ${esc(x.text)}</div>`).join('')}` : '');
    },

    phone(el, v, ctx) {
      if (!v) return;
      const p = phoneRoot(el, ctx); p.v = v;
      put(p.pts, `🏅 ${v.points} pts · #${v.rank || '-'}${v.round ? ` <span class="muted">· round ${v.round}/${v.total}</span>` : ''}`);
      clock(p.clk, v.phase === 'reveal' || v.phase === 'over' ? 0 : v.endsIn);
      if (v.round !== lastRound) { lastRound = v.round; draft = ''; if (p.guess) p.guess.value = ''; }
      const g = v.giver;
      if (v.phase === 'over') {
        phoneMode(p, 'over', v);
        put(p.simple, `<div class="card-box" style="text-align:center"><h3>Game over!</h3><p>You finished <b>#${v.rank}</b> with ${v.points} points.</p></div>${awardsHtml(v.awards)}<div class="card-box">${BOX.board(v.final, (r) => r.points, '')}</div>`);
        return;
      }
      if (v.phase === 'pick') {
        if (g && g.options) {
          phoneMode(p, 'pick', v);
          put(p.simple, `<div class="em-you">🎨 You’re the Clue Giver!</div><p class="muted" style="text-align:center">Pick your secret. Only you can see this.</p>
            <div class="em-opts">${g.options.map((o, i) => `<button class="em-opt" data-pick="${i}"><span class="c">${o.icon} ${esc(o.cat)} ${stars(o.diff)}</span><span class="t">${esc(o.text)}</span></button>`).join('')}</div>`);
          return;
        }
        phoneMode(p, 'wait', v);
        const others = v.stages.filter((x) => !g || x.n !== g.n);
        put(p.simple, g ? `<div class="em-you">🎨 You’re the Clue Giver!</div><div class="card-box" style="text-align:center"><div class="muted">Your secret</div><div class="em-secretbig">${esc(g.answer)}</div><p class="muted">Get your emoji fingers ready…</p></div>`
          : `<div class="big-status">🤫 ${others.map((x) => esc(x.giver)).join(' & ')} ${others.length > 1 ? 'are' : 'is'} picking a secret…</div><p class="muted" style="text-align:center">Get ready to guess! Watch the big screen.</p>`);
        return;
      }
      if (v.phase === 'reveal') {
        phoneMode(p, 'reveal', v);
        put(p.simple, `<div class="em-roundpts ${v.roundPts > 0 ? 'up' : ''}">${v.roundPts > 0 ? `+${v.roundPts} this round 🎉` : v.roundPts < 0 ? `${v.roundPts} this round` : 'No points this round'}</div>
          ${v.stages.map((x) => `<div class="card-box em-rev"><div class="muted">${esc(x.giver)}’s clue ${x.cat ? `· ${x.cat.icon} ${esc(x.cat.label)}` : ''}</div><div class="em-revclue">${x.clue.map((c) => esc(c.e)).join('') || '…'}</div><div class="em-secretbig">${esc(x.answer || '')}</div><div class="muted">${x.result && x.result.first ? `⚡ ${esc(x.result.first.name)} got it first · ${x.solved}/${x.of} solved` : 'Nobody got it!'}${x.mine ? ' · ✅ you got it' : ''}</div></div>`).join('')}`);
        return;
      }
      // Clue phase
      if (g && !g.left) {
        phoneMode(p, 'clue-giver', v);
        put(p.secret, `<div><span class="muted">🤫 Your secret</span> <span class="em-cat">${g.catIcon} ${esc(g.cat)}</span> ${stars(g.diff)}</div><div class="em-secretbig">${esc(g.answer)}</div><div class="muted">Only emojis! <b>${g.solved}</b>/${g.of} have got it · ${g.clue.length}/${g.max}</div>`);
        clueRow(p.myclue, g.clue);
        const [sep, undo, hint] = p.tools.querySelectorAll('button');
        sep.disabled = !g.clue.length || g.clue[g.clue.length - 1].e === SEP || g.clue.length >= g.max; undo.disabled = !g.clue.length; hint.disabled = !g.canHint;
        drawGrid();
        return;
      }
      phoneMode(p, 'clue-guesser', v);
      const solvedIds = new Set(v.stages.filter((x) => x.mine).map((x) => x.n));
      const myRight = (n) => { const x = v.guesses.find((q) => q.r === 'correct' && q.stage === n); return x ? x.text : ''; };
      put(p.mini, v.stages.map((x) => `<div class="em-ministage ${x.mine ? 'solved' : ''}" style="--gc:${esc(x.color)}"><div class="hd"><span><span class="dot"></span>${esc(x.giver)}${x.cat ? ` · ${x.cat.icon} ${esc(x.cat.label)}` : ''}</span><span class="muted">${x.solved}/${x.of}</span></div>
        <div class="em-miniclue">${x.left ? '😢 Giver left' : x.clue.map((c) => `<span class="${c.e === SEP ? 'sep' : ''}">${esc(c.e)}</span>`).join('') || '<span class="muted wait">🤔 waiting for emojis…</span>'}</div>
        ${x.mine ? `<div class="em-got">✅ You got it: <b>${esc(myRight(x.n))}</b></div>` : x.hint ? hintHtml(x.hint) : ''}</div>`).join(''));
      const open = v.stages.filter((x) => !x.left && !solvedIds.has(x.n)).length;
      p.bar.hidden = !open;
      put(p.done, open ? '' : '<div class="big-status">🎉 You got it! Sit back and watch the others squirm.</div>');
      put(p.feed, v.guesses.length ? v.guesses.slice().reverse().map((q) => `<div class="em-fg ${q.r}">${q.r === 'correct' ? '✅' : q.r === 'close' ? '🔥' : '✗'} ${esc(q.text)}${q.r === 'close' ? ' <small>so close!</small>' : q.r === 'correct' ? ` <small>+${q.pts}</small>` : ''}</div>`).join('') : '<p class="muted" style="text-align:center">Unlimited guesses. Small typos are OK!</p>');
    },
  };
  BOX.games.emoji._kb = KEYBOARD_TEXT; // for tools/test-box-emoji.js
})();
