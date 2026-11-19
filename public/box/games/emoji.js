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
  // Update a region in place (BOX.morph): only changed text/attributes are touched, so buttons stay
  // under fingers and animations already running are never restarted.
  const put = (node, html) => { if (node && node.__h !== html) { BOX.morph(node, html); node.__h = html; } };
  const av = (x) => (x && x.avatar ? esc(x.avatar) + ' ' : '');
  // Players as their JustGameBox character (public/box/portrait.js), or their emoji without one.
  const face = (o, n, opt) => (BOX.face ? BOX.face(o, n, opt) : esc((o && o.avatar) || '🙂'));
  const pic0 = (o, n, opt) => (BOX.hasLook && BOX.hasLook(o) ? face(o, n, opt) : '');
  const fboard = (rows, val, label = '') => `<div class="board">${rows.map((r, i) => `<div class="row"><span class="n">${i + 1}</span><span class="em-rn">${face(r, 30, { cls: 'em-rf' })} ${esc(r.name)}</span><b>${esc(val(r))}${label}</b></div>`).join('')}</div>`;
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
    root.innerHTML = '<div class="em-top"><div class="em-round"></div><div class="em-status"></div><div class="em-clock"></div></div><div class="em-body"><section class="em-stages"></section><aside class="em-side"><h3>🏆 Scores</h3><div class="em-board"></div><div class="em-ticker"></div></aside></div><div class="em-over" hidden></div><div class="em-flash"></div>';
    el.appendChild(root);
    const q = (s) => root.querySelector(s);
    T = { el, root, round: q('.em-round'), status: q('.em-status'), clock: q('.em-clock'), body: q('.em-body'), stages: q('.em-stages'), board: q('.em-board'), ticker: q('.em-ticker'), over: q('.em-over'), flash: q('.em-flash'), nodes: new Map(), seenTick: new Set() };
    return T;
  }
  function tvStage(t, st, phase) {
    let n = t.nodes.get(st.id);
    if (!n) {
      const root = h('div', 'em-stage');
      root.innerHTML = '<div class="em-bub"><div class="em-sh"></div><div class="em-clue"></div><div class="em-hint"></div><div class="em-sf"></div></div><div class="em-who"></div>';
      n = { root, sh: root.querySelector('.em-sh'), clue: root.querySelector('.em-clue'), hint: root.querySelector('.em-hint'), sf: root.querySelector('.em-sf'), who: root.querySelector('.em-who') };
      t.nodes.set(st.id, n);
    }
    n.root.style.setProperty('--gc', st.color || '#ff4f9a');
    n.root.classList.toggle('revealed', phase === 'reveal');
    n.root.classList.toggle('left', !!st.left);
    put(n.sh, st.cat ? `<span class="em-cat">${st.cat.icon} ${esc(st.cat.label)}</span>${stars(st.diff)}` : '');
    const mood = phase === 'reveal' ? (st.result && st.result.first ? '🥳' : '🙈') : '';
    // The Clue Giver on stage: their character, full body (cheering or sheepish at the reveal).
    const giver = { name: st.giver, avatar: st.avatar }, fig = BOX.body && BOX.hasLook && BOX.hasLook(giver)
      ? BOX.body(giver, 150, { mood: phase === 'reveal' ? (st.result && st.result.first ? 'grin' : 'surprised') : phase === 'clue' ? 'smile' : 'smirk', cls: 'em-fig' }) + (mood ? `<i class="em-figmood">${mood}</i>` : '') : '';
    put(n.who, `<span class="em-face ${fig ? 'has-fig' : ''}">${fig || esc(mood || st.avatar || '😜')}</span><span class="em-wn"><b>${esc(st.giver)}</b><small>${phase === 'pick' ? 'is picking a secret… 🤫' : phase === 'clue' ? 'is the Clue Giver 🎨' : 'gave the clue'}</small></span>`);
    clueRow(n.clue, st.clue);
    n.clue.dataset.wait = phase === 'pick' ? (st.picked ? '🔒 Secret locked in…' : '🤫 Choosing a secret…') : st.left ? '😢 The Clue Giver left' : '🤔 Thinking of emojis…';
    put(n.hint, phase === 'clue' ? hintHtml(st.hint) : '');
    let sf = '';
    if (phase === 'reveal' && st.answer) {
      const r = st.result;
      sf = `<div class="em-drumline">🥁</div><div class="em-answer">${esc(st.answer)}</div><div class="em-res">${r.first ? `⚡ ${pic0(r.first, 30, { cls: 'em-rf', mood: 'grin' })}<b>${esc(r.first.name)}</b> got it first (${r.first.s}s) · ${st.solved}/${st.of} solved` : '😶 Nobody got it!'}${r.giverPts ? ` · 🎨 ${esc(st.giver)} +${r.giverPts}` : ''}</div>`;
    } else if (phase === 'clue') {
      const pct = st.of ? Math.round(100 * st.solved / st.of) : 0;
      sf = `<div class="em-progress"><div class="em-bar"><i style="width:${pct}%"></i></div><span><b>${st.solved}</b>/${st.of} solved</span></div>${st.firsts.length ? `<div class="em-firsts">${st.firsts.map((nm, i) => `<span>${medal[i]} ${pic0({ name: nm }, 26, { cls: 'em-rf', mood: 'grin' })}${esc(nm)}</span>`).join('')}</div>` : ''}`;
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
    if (b.dataset.e) { const e = b.dataset.e; ctx.act({ op: 'emoji', e }).then((r) => { if (r && r.ok) remember(e); }); haptic(ctx, 'tap'); return; }
    if (b.dataset.cat) { kbCat = b.dataset.cat; search = ''; if (P.search) P.search.value = ''; drawGrid(); return; }
    if (b.dataset.pick != null) { ctx.act({ op: 'pick', i: Number(b.dataset.pick) }).then((r) => { if (r && r.ok) { ctx.sfx('click'); haptic(ctx, 'select'); } }); return; }
    const a = b.dataset.a;
    if (a === 'sep') ctx.act({ op: 'sep' });
    else if (a === 'undo') { ctx.act({ op: 'undo' }); haptic(ctx, 'tap'); }
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
    if (r.result === 'correct') { ctx.sfx('chime'); haptic(ctx, 'success'); ctx.toast(`✅ ${r.answer}! +${r.pts}`); }
    else if (r.result === 'close') { ctx.sfx('heartbeat'); haptic(ctx, 'warn'); ctx.toast('🔥 So close! Keep going…'); bump('close'); }
    else { haptic(ctx, 'error'); bump('nope'); }
  }
  // Haptics (ctx.haptic on new phones; a plain vibration otherwise).
  function haptic(ctx, kind) { try { if (ctx.haptic) ctx.haptic(kind); else ctx.vibrate(kind === 'tap' ? 10 : 40); } catch { /* no vibration */ } }
  // One buzz per moment: each channel buzzes when its key changes (the game's end resets them).
  let felt = {};
  const feel = (ctx, chan, key, kind) => { if (felt[chan] === key) return; felt[chan] = key; haptic(ctx, kind); };
  function bump(cls) { const bar = P && P.root.querySelector('.em-guessbar'); if (!bar) return; bar.classList.remove('close', 'nope'); void bar.offsetWidth; bar.classList.add(cls); }

  function phoneMode(p, mode, v) {
    if (p.mode === mode) return;
    p.mode = mode; p.grid = p.tabs = p.search = p.guess = null;
    const m = p.main;
    if (mode === 'clue-giver') {
      m.innerHTML = `<div class="em-secret"></div><div class="em-clue em-myclue" data-wait="Tap emojis below to build your clue"></div>
        <div class="em-tools"><button data-a="sep" title="Word break">│ New word</button><button data-a="undo">⌫ Undo</button><button data-a="hint">💡 Hint −${v.hintCost}</button></div>
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
      m.innerHTML = `<div class="em-mini"></div><div class="em-guessbar"><textarea class="em-guess" rows="1" maxlength="40" placeholder="Type your guess…" autocomplete="off" enterkeyhint="send"></textarea><button class="em-send" data-a="guess">Send ➤</button></div><div class="em-done"></div><div class="em-feed"></div>`;
      p.mini = m.querySelector('.em-mini'); p.guess = m.querySelector('.em-guess'); p.feed = m.querySelector('.em-feed'); p.done = m.querySelector('.em-done'); p.bar = m.querySelector('.em-guessbar');
      p.guess.value = draft;
      p.guess.oninput = () => { draft = p.guess.value.replace(/\n/g, ''); if (p.guess.value !== draft) p.guess.value = draft; };
      p.guess.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); sendGuess(); } };
    } else m.innerHTML = '<div class="em-simple"></div>';
    p.simple = m.querySelector('.em-simple');
  }

  // ================= TV lobby: the settings are an emoji keyboard =================
  // Each setting is a row of keys; the chosen key is pressed in (yellow). The real <select>s
  // stay in #settings (visually hidden) for keyboards, screen readers and the tests.
  const LOOK = {
    seconds: { ic: '⏱️', lab: 'Time to guess', keys: { 60: ['⚡', '60s'], 90: ['⏳', '90s'], 120: ['🐢', '2 min'] } },
    turns: { ic: '🎨', lab: 'Clues each', keys: { 1: ['☝️', '1'], 2: ['✌️', '2'], 3: ['🤟', '3'] } },
    maxRounds: { ic: '🔁', lab: 'Most rounds', keys: { 5: ['', '5'], 8: ['', '8'], 12: ['', '12'], 20: ['', '20'] } },
    stages: { ic: '🎤', lab: 'Clue givers at once', keys: { auto: ['🤖', 'Auto'], 1: ['', '1'], 2: ['', '2'], 3: ['', '3'] } },
    difficulty: { ic: '⭐', lab: 'Difficulty', keys: { mix: ['🎲', 'Mixed'], easy: ['', '★'], medium: ['', '★★'], hard: ['', '★★★'] } },
    family: { ic: '👪', lab: 'Answers', keys: { false: ['😜', 'Everything'], true: ['👪', 'Family'] } },
    ticker: { ic: '❌', lab: 'Wrong guesses on TV', keys: { true: ['👀', 'Show'], false: ['🙈', 'Hide'] } },
    showIntro: { ic: '🎬', lab: 'Intro cutscene', keys: { true: ['🎬', 'On'], false: ['⏩', 'Skip'] } },
    category: { ic: '🗂️', lab: 'Categories', wide: true },
  };
  const ORDER = ['category', 'seconds', 'difficulty', 'turns', 'maxRounds', 'stages', 'family', 'ticker', 'showIntro'];
  function keyFace(f, o) {
    const L = LOOK[f.key], k = L && L.keys && L.keys[String(o.value)];
    if (k) return `${k[0] ? `<span class="e">${k[0]}</span>` : ''}<span>${esc(k[1])}</span>`;
    const m = String(o.label).match(/^(\p{Extended_Pictographic}️?)\s*(.*)$/u); // "🎬 Movies & TV" -> sticker + short label
    if (m) return `<span class="e">${m[1]}</span><span>${esc(m[2].replace(/ & .*| and .*/, ''))}</span>`;
    if (f.key === 'category') return `<span class="e">✨</span><span>${esc(o.label.replace(/ categories/i, ''))}</span>`;
    return `<span>${esc(o.label)}</span>`;
  }
  function lobbyTv(el, L) {
    el.__L = L;
    if (!el.__eml) {
      el.__eml = true;
      el.innerHTML = `<div class="eml">
        <div class="eml-head"><div class="eml-logo"><span class="a"><i>E</i><i>m</i><i class="o">😜</i><i>j</i><i>i</i></span><span class="b">Charades</span></div>
          <div class="eml-bubble">Say it with <b>emojis only!</b> 🤫 ➡️ 😂</div></div>
        <section class="eml-kb"><div class="eml-kbtop"><span>⌨️ Settings keyboard</span><small>Tap a key to change it</small></div><div class="eml-rows" id="eml-keys"></div><div id="settings" class="eml-sr"></div></section>
        <aside class="eml-join"><div class="eml-jt">📱 Join on your phone!</div><img id="qr" alt="QR code to join"><div class="eml-url" id="eml-url"></div>
          <div class="eml-codecap">Room code</div><div class="eml-code" id="code"></div>
          <div class="eml-vip" id="eml-vip"></div><div class="err" id="lobby-err"></div>
          <button class="eml-start" id="start">🎉 Start the party</button>
          <div class="eml-links"><button id="add-bots">+ 5 test bots</button><button id="rm-bots">remove bots</button><button id="eml-pick">🎮 Other game</button></div></aside>
        <section class="eml-hill"><div class="eml-count" id="eml-count"></div><div class="eml-roster" id="roster"></div></section>
        <div class="eml-party" id="eml-party"></div></div>`;
      const $ = (s) => el.querySelector(s);
      $('#start').onclick = async () => { const r = await el.__L.start(); $('#lobby-err').textContent = r && r.ok ? '' : (r && r.error) || ''; };
      $('#add-bots').onclick = () => el.__L.bots(5);
      $('#rm-bots').onclick = () => el.__L.removeBots();
      $('#eml-pick').onclick = () => el.__L.pick();
      el.addEventListener('click', (e) => {
        const k = e.target.closest('[data-k]');
        if (k) {
          for (const b of k.parentNode.querySelectorAll('.eml-key')) b.classList.toggle('on', b === k);
          const s = el.querySelector(`select[data-set="${k.dataset.k}"]`); if (s) s.value = k.dataset.v;
          el.__L.set(k.dataset.k, k.dataset.v); BOX.sfx('pop'); return;
        }
        const c = e.target.closest('[data-kick]');
        if (c && confirm('Remove this player?')) el.__L.kick(c.dataset.kick);
      });
    }
    const $ = (s) => el.querySelector(s);
    // Room code + QR
    if ($('#code').textContent !== L.code) $('#code').innerHTML = [...L.code].map((c) => `<span>${esc(c)}</span>`).join('');
    if ($('#qr').dataset.u !== L.joinUrl) { $('#qr').src = L.qr; $('#qr').dataset.u = L.joinUrl; }
    $('#eml-url').textContent = L.joinUrl.replace(/^https?:\/\//, '');
    const n = L.players.length;
    $('#start').disabled = n < L.min;
    $('#eml-vip').innerHTML = L.vip ? `👑 <b>${esc(L.vip)}</b> can start from their phone` : n < L.min ? `Need ${L.min - n} more player${L.min - n === 1 ? '' : 's'}…` : 'The first to join is the host 👑';
    put($('#eml-count'), `${n}<small>player${n === 1 ? '' : 's'}</small>`);
    // Settings keys + hidden selects
    const fields = ORDER.map((k) => L.fields.find((f) => f.key === k)).filter(Boolean).concat(L.fields.filter((f) => !ORDER.includes(f.key)));
    put($('#eml-keys'), fields.map((f) => {
      const lk = LOOK[f.key] || {}, cur = String(L.settings[f.key]);
      return `<div class="eml-row ${lk.wide ? 'wide' : ''}"><div class="eml-lab"><span class="ic">${lk.ic || '⚙️'}</span>${esc(lk.lab || f.label)}</div>
        <div class="eml-keys ${f.key === 'category' ? 'cats' : ''}">${f.options.map((o) => `<button class="eml-key ${String(o.value) === cur ? 'on' : ''}" data-k="${esc(f.key)}" data-v="${esc(String(o.value))}" title="${esc(o.label)}">${keyFace(f, o)}</button>`).join('')}</div></div>`;
    }).join(''));
    const box = $('#settings'), sig = L.fields.map((f) => f.key + ':' + f.options.map((o) => o.value).join('|')).join(';');
    if (box.__sig !== sig) { box.__sig = sig; box.innerHTML = L.fields.map((f) => `<label>${esc(f.label)}<select data-set="${esc(f.key)}">${f.options.map((o) => `<option value="${esc(String(o.value))}">${esc(o.label)}</option>`).join('')}</select></label>`).join(''); }
    for (const s of box.querySelectorAll('select[data-set]')) {
      if (document.activeElement !== s) s.value = String(L.settings[s.dataset.set]);
      s.onchange = () => { s.blur(); el.__L.set(s.dataset.set, s.value); };
    }
    // Players pop in as bouncing emoji faces on the candy hill
    const r = $('#roster');
    r.classList.toggle('many', n > 14 && n <= 30); r.classList.toggle('lots', n > 30);
    put(r, n ? L.players.map((p, i) => `<span class="chip ${p.online ? '' : 'off'} ${p.name === L.vip ? 'vip' : ''}" id="eml-p-${esc(p.id)}" data-kick="${esc(p.id)}" title="Click to remove" style="--c:${esc(p.color || '#2a0a55')};--d:${((i * 0.17) % 1.3).toFixed(2)}s"><span class="f">${face(p, 74)}</span><b>${esc(p.name)}</b></span>`).join('')
      : '<div class="eml-empty">Scan the code and pop in! <span>👇</span><span>😜</span><span>🤩</span></div>');
    put($('#eml-party'), L.lineupHtml || '');
  }

  BOX.games.emoji = {
    // Soundtrack cue per phase (public/box/scores/<key>.js); the TV turns the last 10 s of 'think' tense.
    music: (s) => ({ pick: 'think', clue: 'play', reveal: 'reveal', over: 'finale' }[s.phase] || 'play'),
    name: 'Emoji Charades', icon: '🤔', lobbyTv,
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
        const won = w && w.points;
        put(t.over, `<div class="em-end"><div class="em-champ"><div class="f ${won && BOX.hasLook && BOX.hasLook(w) ? 'has-fig' : ''}">${won ? (BOX.hasLook && BOX.hasLook(w) ? BOX.body(w, 230, { mood: 'grin' }) : esc(w.avatar || '😎')) : '🤷'}</div><div class="cap">${won ? 'EMOJI CHAMPION' : 'NOBODY CRACKED A CLUE'}</div><h2>${won ? esc(w.name) : 'Tough crowd!'}</h2>${won ? `<div class="pts">${w.points} points</div>` : ''}</div>${awardsHtml(s.awards)}
          <div class="em-endgrid"><div><h3>🏆 Final scores</h3>${fboard(s.standings, (r) => r.points, ' pts')}</div>${s.history && s.history.some((x) => x.clue) ? `<div class="em-hist"><h3>🔁 Clue replay</h3>${s.history.filter((x) => x.clue).slice(-7).map((x) => `<div class="row"><span class="c">${esc(x.clue || '…')}</span><span>= <b>${esc(x.answer)}</b> <span class="muted">by ${esc(x.giver)}</span></span></div>`).join('')}</div>` : ''}</div></div>`);
        return;
      }
      put(t.round, s.lastRound ? `<span class="em-final">🏁 FINAL ROUND · ×${s.mult} points</span>` : `Round <b>${s.round}</b>/${s.total}`);
      const givers = s.stages.map((x) => x.giver);
      const who = givers.length > 1 ? givers.slice(0, -1).map(esc).join(', ') + ' & ' + esc(givers[givers.length - 1]) : esc(givers[0] || '');
      put(t.status, s.phase === 'pick' ? `🤫 ${who} ${givers.length > 1 ? 'are' : 'is'} picking a secret…` : s.phase === 'clue' ? '📱 Type your guesses!' : s.stages.length > 1 ? 'The answers were…' : 'The answer was…');
      clock(t.clock, s.phase === 'reveal' ? 0 : s.endsIn);
      t.stages.className = 'em-stages n' + Math.max(1, s.stages.length);
      const keep = new Set(s.stages.map((x) => x.id));
      for (const [id, n] of t.nodes) if (!keep.has(id)) { n.root.remove(); t.nodes.delete(id); }
      s.stages.forEach((st, i) => { const node = tvStage(t, st, s.phase); if (t.stages.children[i] !== node) t.stages.insertBefore(node, t.stages.children[i] || null); });
      put(t.board, fboard(s.standings, (r) => r.points, ''));
      const fresh = (k) => { const f = !t.seenTick.has(k); t.seenTick.add(k); return f; };
      put(t.ticker, s.phase === 'clue' && s.ticker.length ? `<h3>Not quite…</h3>${s.ticker.slice().reverse().map((x) => `<div class="em-tk ${fresh(x.k) ? 'in' : ''}">❌ ${esc(x.text)}</div>`).join('')}` : '');
    },

    phone(el, v, ctx) {
      // JustGold gear: this game's phone theme, a frame and badge over your screen (public/shared/gear.js).
      if (window.MT_GEAR) window.MT_GEAR.phoneTheme(el, arguments[3], 'emoji');
      if (!v) return;
      const p = phoneRoot(el, ctx); p.v = v;
      put(p.pts, `🏅 ${v.points} pts · #${v.rank || '-'}${v.lastRound ? ` <span class="em-final sm">🏁 Final ×${v.mult}</span>` : v.round ? ` <span class="muted">· round ${v.round}/${v.total}</span>` : ''}`);
      clock(p.clk, v.phase === 'reveal' || v.phase === 'over' ? 0 : v.endsIn);
      if (v.round !== lastRound) { lastRound = v.round; draft = ''; if (p.guess) p.guess.value = ''; }
      const g = v.giver;
      if (v.phase === 'over') {
        phoneMode(p, 'over', v);
        feel(ctx, 'over', 'over', v.rank === 1 && v.points > 0 ? 'win' : 'success');
        put(p.simple, `<div class="em-overcard"><div class="em-place">${v.rank === 1 && v.points > 0 ? '🏆' : v.rank === 2 ? '🥈' : v.rank === 3 ? '🥉' : '😎'}</div><h3>${v.rank === 1 && v.points > 0 ? 'Emoji Champion!' : `You finished #${v.rank} of ${v.of}`}</h3><p>${v.points} points</p></div>${awardsHtml(v.awards)}<div class="card-box">${BOX.board(withAv(v.final), (r) => r.points, '')}</div>`);
        return;
      }
      if (felt.over) felt = {}; // a new game started
      if (v.phase === 'pick') {
        if (g && g.options) {
          phoneMode(p, 'pick', v);
          feel(ctx, 'turn', v.round + ':' + g.n, 'turn');
          put(p.simple, `<div class="em-you">🎨 You’re the Clue Giver!</div><p class="em-sub">Pick your secret. Only you can see this.</p>
            <div class="em-opts">${g.options.map((o, i) => `<button class="em-opt" data-pick="${i}"><span class="c">${o.icon} ${esc(o.cat)} ${stars(o.diff)}</span><span class="t">${esc(o.text)}</span></button>`).join('')}</div>`);
          return;
        }
        phoneMode(p, 'wait', v);
        const others = v.stages.filter((x) => !g || x.n !== g.n);
        put(p.simple, g ? `<div class="em-you">🎨 You’re the Clue Giver!</div><div class="em-secret"><div class="muted">🤫 Your secret</div><div class="em-secretbig">${esc(g.answer)}</div><div class="muted">Get your emoji fingers ready…</div></div>`
          : `<div class="em-waitcard"><div class="big">🤫</div><h3>${others.map((x) => esc(x.giver)).join(' & ')} ${others.length > 1 ? 'are' : 'is'} picking a secret…</h3><p>Get ready to guess! Watch the big screen.</p></div>`);
        return;
      }
      if (v.phase === 'reveal') {
        phoneMode(p, 'reveal', v);
        feel(ctx, 'reveal', v.round, v.roundPts > 0 ? 'success' : 'select');
        put(p.simple, `<div class="em-roundpts ${v.roundPts > 0 ? 'up' : ''}">${v.roundPts > 0 ? `+${v.roundPts} this round 🎉` : v.roundPts < 0 ? `${v.roundPts} this round` : 'No points this round'}</div>
          ${v.stages.map((x) => `<div class="card-box em-rev"><div class="muted">${esc(x.giver)}’s clue ${x.cat ? `· ${x.cat.icon} ${esc(x.cat.label)}` : ''}</div><div class="em-revclue">${x.clue.map((c) => esc(c.e)).join('') || '…'}</div><div class="em-secretbig">${esc(x.answer || '')}</div><div class="muted">${x.result && x.result.first ? `⚡ ${esc(x.result.first.name)} got it first · ${x.solved}/${x.of} solved` : 'Nobody got it!'}${x.mine ? ' · ✅ you got it' : ''}</div></div>`).join('')}`);
        return;
      }
      // Clue phase
      if (g && !g.left) {
        phoneMode(p, 'clue-giver', v);
        feel(ctx, 'go', v.round + ':' + g.n, 'select');
        if (g.solved && felt.solved !== v.round + ':' + g.solved) { felt.solved = v.round + ':' + g.solved; haptic(ctx, 'select'); } // someone cracked your clue
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
      put(p.done, open ? '' : '<div class="em-donecard">🎉 You got it!<small>Sit back and watch the others squirm.</small></div>');
      put(p.feed, v.guesses.length ? v.guesses.slice().reverse().map((q) => `<div class="em-fg ${q.r}">${q.r === 'correct' ? '✅' : q.r === 'close' ? '🔥' : '✗'} ${esc(q.text)}${q.r === 'close' ? ' <small>so close!</small>' : q.r === 'correct' ? ` <small>+${q.pts}</small>` : ''}</div>`).join('') : '<p class="em-tip">Unlimited guesses. Small typos are OK! 👌</p>');
    },
  };
  BOX.games.emoji._kb = KEYBOARD_TEXT; // for tools/test-box-emoji.js
})();
