'use strict';
// The JustGold shop (/shop): one character and one wallet for every JustGameBox game.
// Data and rules live on the server (/box socket: account:wallet, shop:state, shop:buy,
// shop:equip, shop:look; see docs/justgold.md). This page only shows them, previews items on
// your character (try-on) and sends your choices. ?mock=1 (or no server) runs an offline preview.
(function () {
  const O = window.MT_OPTIONS, C = window.MT_COSMETICS, GEAR = window.MT_GEAR || { GEAR: [], GAMES_WITH_GEAR: [] };
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const params = new URLSearchParams(location.search);
  const hap = (k) => { try { window.HAPTIC && window.HAPTIC.play(k); } catch (e) { /* none */ } };
  const TAU = Math.PI * 2;
  const COIN = '<svg class="coin" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10.5" fill="#ffd23f" stroke="#7a4a00" stroke-width="2"/><circle cx="12" cy="12" r="7" fill="none" stroke="#e8a800" stroke-width="1.6"/><path d="M8 8.5a5 5 0 0 1 4-2" stroke="#fff6c0" stroke-width="1.6" fill="none" stroke-linecap="round"/><text x="12" y="15.4" font-size="7.6" font-weight="900" text-anchor="middle" fill="#7a4a00" font-family="Lilita One,Arial,sans-serif">JG</text></svg>';

  // ---------- where we came from (?back=, same-origin paths only) ----------
  function safeBack(v) {
    if (typeof v !== 'string' || !/^\/(?![/\\])/.test(v) || v.length > 500) return '/box/play';
    try { const u = new URL(v, location.origin); return u.origin === location.origin && u.pathname !== '/shop' && u.pathname !== '/shop/' ? u.pathname + u.search + u.hash : '/box/play'; } catch (e) { return '/box/play'; }
  }
  $('#back').href = safeBack(params.get('back'));

  // ---------- the games (names, icons; art in /art/tiles/<key>.svg) ----------
  const GAMES = { mafia: ['JustMafia', '🔪'], ducks: ['JustRaiseDucks', '🦆'], kingdoms: ['JustKingdoms', '🏰'], president: ['President', '👑'], blanks: ['JustBlanks', '🃏'], blackjack: ['Blackjack Night', '♠️'], bid: ['JustBid', '📦'], price: ['Price Panic', '💸'], emoji: ['Emoji Charades', '😜'], truths: ['Two Truths & a Lie', '🤥'], likely: ['Most Likely To…', '🏆'], whosaid: ['Who Said It?', '🕵️'], spectrum: ['Where Do You Stand?', '🧭'], sketch: ['JustSketch Relay', '✏️'], funny: ['JustFunny', '😂'], plinko: ['JustDrop', '🎯'], trivia: ['Hot Take Trivia', '🧠'], colormatch: ['Color Match', '🎨'], memes: ['Meme Maker', '🖼️'], letters: ['Letter Rush', '🔤'], summon: ['JustSummon', '⚔️'], quickdraw: ['Quick Draw', '⚡'], bomb: ['Bomb Squad', '💣'], alien: ['Alien Abduction', '🛸'], tune: ['Tune Buzz', '🎵'], actout: ['Act It Out', '🎭'], debate: ['Debate Club', '🗣️'], marble: ['JustMarble', '🔮'], escape: ['JustEscape', '🗝️'], zombie: ['Zombie Survival', '🧟'] };
  const gameName = (k) => (GAMES[k] ? GAMES[k][0] : String(k));
  const gameIcon = (k) => (GAMES[k] ? GAMES[k][1] : '🎮');

  // ---------- sections ----------
  const SECTIONS = [
    { id: 'character', icon: '👤', label: 'Character', subs: [['outfit', '👕', 'Outfits'], ['hat', '🎩', 'Hats'], ['hair', '💇', 'Hair'], ['accessory', '🕶️', 'Extras'], ['shoeStyle', '👟', 'Shoes'], ['colours', '🎨', 'Colours & face']] },
    { id: 'flair', icon: '✨', label: 'Flair', subs: [['nameplate', '🏷️', 'Nameplates'], ['effect', '🌟', 'Effects']] },
    { id: 'gear', icon: '🎮', label: 'Game gear' },
    { id: 'mafia', icon: '🔪', label: 'JustMafia', subs: [['houseStyle', '🏠', 'Houses'], ['houseDecor', '🏮', 'Decor'], ['deathAnim', '🕯️', 'Farewells'], ['reactions', '😱', 'Reactions'], ['ghostSkin', '👻', 'Ghosts']] },
    { id: 'wardrobe', icon: '🎒', label: 'Wardrobe' },
    { id: 'earn', icon: '🪙', label: 'Earn JG' },
  ];
  const FREE_FIELDS = ['skin', 'hairColor', 'color', 'eyes', 'expression', 'pants', 'shoes', 'face', 'features', 'facialHair', 'nameColor'];
  const HOME = { houseStyle: 'style', houseDecor: 'decor' };
  const HEAD_FIELDS = new Set(['hat', 'hair', 'expression', 'face', 'facialHair', 'features']);
  const BACK_ACC = new Set(['cape', 'wings', 'batWings', 'fairyWings', 'backpack', 'satchel', 'torch', 'rose', 'wristwatch', 'diceBag', 'badge', 'goldChain', 'amulet', 'scarf']);

  // ---------- account storage ----------
  const getJSON = (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } };
  const setJSON = (k, v) => { try { if (v) localStorage.setItem(k, JSON.stringify(v)); else localStorage.removeItem(k); } catch (e) { /* private mode */ } };
  const getProf = () => { const p = getJSON('box.profile'); return p && typeof p.id === 'string' && typeof p.token === 'string' ? { id: p.id, token: p.token } : null; };
  const setProf = (p) => setJSON('box.profile', p ? { id: String(p.id), token: String(p.token) } : null);
  const getMafia = () => { const p = getJSON('mt.profile'); return p && typeof p.id === 'string' && typeof p.token === 'string' ? { id: p.id, token: p.token } : null; };

  // ---------- the API: the /box socket, or an offline mock with the same shapes ----------
  function socketApi() {
    const socket = window.io('/box', { transports: ['websocket', 'polling'] });
    let up = false;
    socket.on('connect', () => { up = true; $('#offline').hidden = true; if (S.waiting) { S.waiting = false; boot(); } });
    socket.on('disconnect', () => { up = false; const o = $('#offline'); o.textContent = 'Reconnecting… your changes are saved once you’re back online.'; o.hidden = false; });
    const call = (ev, msg, ms = 8000) => new Promise((res) => {
      let done = false;
      const t = setTimeout(() => { if (!done) { done = true; res({ ok: false, error: 'No answer from the server. Check your connection.', timeout: true }); } }, ms);
      socket.emit(ev, msg, (r) => { if (done) return; done = true; clearTimeout(t); res(r && typeof r === 'object' ? r : { ok: false, error: 'No answer from the server.' }); });
    });
    const auth = () => getProf();
    return {
      live: true, connected: () => up,
      create: (name) => call('profile:create', { name }),
      login: (name, pin) => call('profile:login', { name, pin }),
      wallet: () => call('account:wallet', { auth: auth(), mafia: getMafia() }),
      state: () => call('shop:state', { auth: auth() }),
      buy: (itemId) => call('shop:buy', { auth: auth(), itemId }),
      equip: (itemId, on) => call('shop:equip', { auth: auth(), itemId, on }),
      look: (look) => call('shop:look', { auth: auth(), look }),
    };
  }
  function mockApi() {
    const stock = new Set(C.STARTER_STOCK.concat(C.nextStock(C.STARTER_STOCK, 14)));
    const m = { name: 'You', gold: 340, earned: 410, spent: 70, owned: new Set(C.CATALOG.filter((i) => i.free).map((i) => i.id).concat(['hat:beret', 'gear:marble:cherry'])), gear: { marble: { skin: 'gear:marble:cherry' } },
      look: { color: '#e84393', skin: '#d9a273', hat: 'beret', hair: 'ponytail', hairColor: '#ba593c', facialHair: 'none', eyes: '#416f91', face: 'round', features: 'rosyCheeks', expression: 'grin', outfit: 'shirt', pants: '#2d2f3a', shoes: '#151821', shoeStyle: 'simple', accessory: 'none', nameColor: '#ffffff', nameplate: 'plain', effect: 'none', deathAnim: 'none', reactions: 'rxClassic', ghostSkin: 'classic' },
      home: { style: 'cottage', decor: 'none' }, lookSaved: true,
      ledger: [{ at: Date.now() - 3.6e6, delta: 14, reason: 'JustMarble: cleared the maze', balance: 340 }, { at: Date.now() - 7.2e6, delta: -70, reason: 'Bought Beret', balance: 326 }, { at: Date.now() - 9e6, delta: 25, reason: 'Party Mode finale', balance: 396 }, { at: Date.now() - 1e7, delta: 9, reason: 'Blackjack Night: top half', balance: 371 }] };
    const section = { outfit: 'character', shoeStyle: 'character', hat: 'character', accessory: 'character', hair: 'character', nameplate: 'flair', effect: 'flair', houseStyle: 'mafia', houseDecor: 'mafia', deathAnim: 'mafia', reactions: 'mafia', ghostSkin: 'mafia' };
    const lock = (i) => (m.owned.has(i.id) || i.free ? null : i.pass ? 'Season pass reward (in JustMafia)' : i.world ? 'A JustMafia world reward' : i.achievement ? (C.ACHIEVEMENTS[i.achievement] || {}).label || 'Earn its achievement' : i.requires && !m.owned.has(i.requires) ? 'Own the tier below first' : C.STOCKABLE.some((x) => x.id === i.id) && !stock.has(i.id) ? 'Not on the shelf yet: every game you finish reveals more' : null);
    const state = () => ({ ok: true, name: m.name, claimed: false, gold: m.gold, earned: m.earned, spent: m.spent, look: { ...m.look }, lookSaved: m.lookSaved, home: { ...m.home }, owned: [...m.owned], gear: JSON.parse(JSON.stringify(m.gear)),
      catalog: C.CATALOG.filter((i) => section[i.field]).map((i) => ({ id: i.id, field: i.field, value: i.value, name: i.name, cost: i.cost, free: !!i.free, section: section[i.field], category: i.category, description: i.description, owned: m.owned.has(i.id) || !!i.free, lock: lock(i) })),
      gearCatalog: GEAR.GEAR.map((g) => ({ ...g, owned: m.owned.has(g.id), equipped: !!(m.gear[g.game] && m.gear[g.game][g.slot] === g.id) })),
      ledger: m.ledger.slice(0, 20), busy: params.get('mock') === 'busy',
      earn: { note: 'Every finished game pays JustGold to everyone with an account who played it (2+ people, 90 s+). Longer games pay more.', base: { play: 4, top: 3, win: 5 }, examples: [{ label: 'A 10-minute game, you played', jg: 3 }, { label: 'A 10-minute game, top half', jg: 6 }, { label: 'A 10-minute game, you won', jg: 10 }, { label: 'A 30-minute game, you won', jg: 30 }], party: { label: 'Finish a whole Party Mode: everyone +25, and +40 / +25 / +15 for the top 3. The fastest way to earn.' }, mafia: 'JustMafia: 4–30 JG a game, weekly challenges and the season pass.' } });
    const wait = (v) => new Promise((r) => setTimeout(() => r(v), 120));
    const busy = () => params.get('mock') === 'busy';
    return {
      live: false, connected: () => true,
      create: (name) => wait({ ok: true, id: 'mock', token: 'mock', profile: { name } }),
      login: () => wait({ ok: false, error: 'Signing in needs the game server.' }),
      wallet: () => wait({ ok: true, wallet: { id: 'mock-wallet', token: 'mock' } }),
      state: () => wait(state()),
      buy: (id) => {
        if (busy()) return wait({ ok: false, busy: true, error: 'You can shop after this game.', state: state() });
        const it = C.CATALOG.find((i) => i.id === id) || GEAR.GEAR.find((g) => g.id === id);
        if (!it) return wait({ ok: false, error: 'Unknown item.' });
        if (m.owned.has(id)) return wait({ ok: false, error: 'You already have it.', state: state() });
        if (it.field && lock(it)) return wait({ ok: false, error: lock(it), state: state() });
        if (m.gold < it.cost) return wait({ ok: false, error: `Not enough JustGold: ${it.name} costs ${it.cost} JG.`, state: state() });
        m.gold -= it.cost; m.spent += it.cost; m.owned.add(id); m.ledger.unshift({ at: Date.now(), delta: -it.cost, reason: 'Bought ' + it.name, balance: m.gold });
        return wait({ ok: true, state: state() });
      },
      equip: (id, on) => {
        if (busy()) return wait({ ok: false, busy: true, error: 'You can shop after this game.', state: state() });
        const g = GEAR.GEAR.find((x) => x.id === id);
        if (g) { if (!m.owned.has(id)) return wait({ ok: false, error: 'Buy this item first.' }); const sl = m.gear[g.game] || (m.gear[g.game] = {}); if (on) sl[g.slot] = id; else if (sl[g.slot] === id) delete sl[g.slot]; return wait({ ok: true, state: state() }); }
        const it = C.CATALOG.find((i) => i.id === id); if (!it) return wait({ ok: false, error: 'Unknown item.' });
        if (!it.free && !m.owned.has(id)) return wait({ ok: false, error: 'Buy this item first.' });
        const list = O[O.AVATAR_FIELDS[it.field] || O.HOME_FIELDS[HOME[it.field]]] || [];
        if (HOME[it.field]) m.home[HOME[it.field]] = on ? it.value : list[0]; else m.look[it.field] = on ? it.value : list[0];
        return wait({ ok: true, state: state() });
      },
      look: (look) => { if (busy()) return wait({ ok: false, busy: true, error: 'You can shop after this game.', state: state() }); for (const k of FREE_FIELDS) if (look && typeof look[k] === 'string' && (O[O.AVATAR_FIELDS[k]] || []).includes(look[k])) m.look[k] = look[k]; m.lookSaved = true; return wait({ ok: true, state: state() }); },
    };
  }
  const wantMock = params.has('mock') || typeof window.io !== 'function';
  let API = wantMock ? mockApi() : socketApi();

  // ---------- state ----------
  const S = { st: null, tab: 'character', sub: { character: 'outfit', flair: 'nameplate', mafia: 'houseStyle' }, game: null, sel: null, edits: {}, saving: 0, pending: false, say: '', waiting: false, keeperJump: 0, startLook: null };
  const items = () => {
    const st = S.st; if (!st) return [];
    const cat = (st.catalog || []).map((i) => ({ ...i, kind: 'item' }));
    const gear = (st.gearCatalog || []).map((g) => ({ ...g, kind: 'gear', owned: !!g.owned }));
    return cat.concat(gear, gearDefaults());
  };
  function gearDefaults() {
    const st = S.st; if (!st) return [];
    return (GEAR.GAMES_WITH_GEAR || []).map((s) => ({ id: `gear-default:${s.game}:${s.slot}`, kind: 'gear', isDefault: true, game: s.game, slot: s.slot, name: s.default.name, icon: s.default.icon, desc: s.default.desc, cost: 0, owned: true, value: 'classic', where: s.where,
      equipped: !(st.gear && st.gear[s.game] && st.gear[s.game][s.slot]) }));
  }
  let ITEMS = [];
  const byId = (id) => ITEMS.find((i) => i.id === id) || null;
  const look = () => ({ ...(S.st ? S.st.look : {}), ...S.edits });
  const wearing = (i) => {
    if (!i || !S.st) return false;
    if (i.kind === 'gear') return !!i.equipped;
    if (HOME[i.field]) return ((S.st.home || {})[HOME[i.field]] || (O[O.HOME_FIELDS[HOME[i.field]]] || [])[0]) === i.value;
    return look()[i.field] === i.value;
  };
  // What the stage shows: your look with the item you're trying on.
  function previewLook() {
    const l = look(), i = byId(S.sel);
    if (i && i.kind === 'item' && !HOME[i.field]) l[i.field] = i.value;
    return l;
  }

  // ---------- JG balance pill ----------
  let shownGold = null, goldAnim = 0;
  function setGold(n, fromEl) {
    const el = $('#jg'); el.hidden = false;
    const old = shownGold;
    if (old == null || old === n) { shownGold = n; el.innerHTML = `${COIN}<span id="jg-n">${n}</span><small>JG</small>`; el.setAttribute('aria-label', `${n} JustGold`); return; }
    shownGold = n; el.setAttribute('aria-label', `${n} JustGold`);
    if (!$('#jg-n')) el.innerHTML = `${COIN}<span id="jg-n">${old}</span><small>JG</small>`;
    el.classList.remove('spend', 'gain'); void el.offsetWidth; el.classList.add(n < old ? 'spend' : 'gain');
    const fly = document.createElement('div'); fly.className = 'jg-fly' + (n < old ? ' minus' : ''); fly.textContent = (n > old ? '+' : '−') + Math.abs(n - old) + ' JG';
    const r = el.getBoundingClientRect(); fly.style.left = Math.round(r.left + 8) + 'px'; fly.style.top = Math.round(r.bottom + 2) + 'px';
    document.body.appendChild(fly); setTimeout(() => fly.remove(), 1200);
    const t0 = performance.now(), dur = 700, id = ++goldAnim;
    const step = (now) => { if (id !== goldAnim) return; const k = Math.min(1, (now - t0) / dur), v = Math.round(old + (n - old) * (1 - Math.pow(1 - k, 3))); const s = $('#jg-n'); if (s) s.textContent = v; if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }

  let toastT = 0;
  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 2600); }

  // ---------- the keeper's lines ----------
  const PITCH = {
    outfit: ['Feel that fabric! The {name} looks great in every game.', 'The {name}: sharp, comfy and very you.', 'Walk onto the big screen in the {name} and every head turns.'],
    hat: ['The {name} frames your face beautifully.', 'Try the {name}. The silhouette alone wins games.', 'A {name}! Tip it at the other players. Very classy.'],
    hair: ['The {name}. Fresh, bold, unforgettable.', 'With the {name}, everyone knows it’s you.'],
    accessory: ['The {name} is the finishing touch.', 'Nobody forgets a {name}.'],
    shoeStyle: ['The {name}: quick on your feet, quicker to the buzzer.', 'Good shoes win races. The {name} are the best I have.'],
    nameplate: ['Your name in {name} style, on every big screen.', 'The {name} nameplate: they’ll read your name twice.'],
    effect: ['{name}! Watch it swirl around you.', 'With {name} you glow in every lobby.'],
    houseStyle: ['A {name} for your plot in JustMafia. The neighbours will be so jealous.'],
    houseDecor: ['A little {name} makes any JustMafia house a home.'],
    deathAnim: ['If the worst happens in JustMafia, go out in style: {name}.', 'A farewell to remember: {name}. Even the Mafia will feel bad.'],
    reactions: ['Six new reactions to float over your head in JustMafia.'],
    ghostSkin: ['Haunt JustMafia in style: the {name}.'],
    gear: ['The {name} for {game}. {desc}'],
  };
  const pick = (list, id) => { let h = 0; for (const ch of id) h = (Math.imul(h, 31) + ch.charCodeAt(0)) >>> 0; return list[h % list.length]; };
  function pitchOf(i) {
    const gold = S.st ? S.st.gold : 0;
    const base = pick(PITCH[i.kind === 'gear' ? 'gear' : i.field] || PITCH.accessory, i.id).replace('{name}', i.name).replace('{game}', gameName(i.game)).replace('{desc}', i.desc || '');
    if (i.kind === 'gear' && i.isDefault) return `The ${i.name}: ${gameName(i.game)}’s own look. Free for everyone.`;
    if (wearing(i)) return base + ' And you’re wearing it. Looking good!';
    if (i.owned) return base + ' It’s yours already: tap Wear!';
    if (i.lock) return `Ah, the ${i.name}! You can try it on, but it’s not for sale yet. ${i.lock.replace(/^./, (c) => c.toUpperCase())}.`;
    if (gold < i.cost) return `${base} It’s ${i.cost} JG and you have ${gold}. A few more games and it’s yours!`;
    return `${base} Only ${i.cost} JG.`;
  }
  const HELLO = ['Welcome in! Tap anything to try it on.', 'Have a look around! Everything here works in every game.', 'Try anything on. Trying is free!'];
  function say(text) { const b = $('#bubble'); if (b.textContent === text) return; b.innerHTML = '<span>' + esc(text) + '</span>'; b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); }

  // ---------- drawing helpers ----------
  function fit(cv) {
    const d = Math.min(2, window.devicePixelRatio || 1), w = cv.clientWidth || 100, h = cv.clientHeight || 74;
    if (cv.width !== Math.round(w * d) || cv.height !== Math.round(h * d)) { cv.width = Math.round(w * d); cv.height = Math.round(h * d); }
    const g = cv.getContext('2d'); g.setTransform(d, 0, 0, d, 0, 0); g.clearRect(0, 0, w, h); return [g, w, h];
  }
  const ink = '#2b1f3d';
  function drawHead(g, w, h, l, t = 0.4) { const s = Math.min(h / 58, w / 46); MTArt.drawCharacter(g, w / 2, h + 22 * s, l, { scale: s, t }); }
  function drawBody(g, w, h, l, t = 0.4) { const s = Math.min((h - 6) / 84, w / 40); MTArt.drawCharacter(g, w / 2, h - 3, l, { scale: s, t }); }
  // Game gear: a round token painted with the item's colours, pattern and emblem.
  function drawToken(g, x, y, r, it, t = 0) {
    const p = (it && it.paint) || {}, a = p.a || '#8a7fb0', b = p.b || '#4a3f70', c = p.c || '#ffffff';
    g.save();
    if (p.glow) { g.shadowColor = a; g.shadowBlur = r * 0.6; }
    const gr = g.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r); gr.addColorStop(0, c); gr.addColorStop(0.25, a); gr.addColorStop(1, b);
    g.beginPath(); g.arc(x, y, r, 0, TAU); g.fillStyle = gr; g.fill(); g.shadowBlur = 0;
    g.save(); g.beginPath(); g.arc(x, y, r, 0, TAU); g.clip(); g.globalAlpha = 0.55; g.fillStyle = b; g.strokeStyle = c;
    const pat = p.pattern || 'plain';
    if (pat === 'stripes') for (let i = -4; i <= 4; i++) { g.save(); g.translate(x, y); g.rotate(-0.6); g.fillRect(i * r * 0.45, -r * 1.5, r * 0.2, r * 3); g.restore(); }
    else if (pat === 'dots') for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) { g.beginPath(); g.arc(x + i * r * 0.45 + (j % 2) * r * 0.22, y + j * r * 0.42, r * 0.1, 0, TAU); g.fillStyle = c; g.fill(); }
    else if (pat === 'swirl') { g.lineWidth = r * 0.14; g.beginPath(); for (let k = 0; k < 60; k++) { const a2 = k * 0.22 + t, rad = k / 60 * r; g.lineTo(x + Math.cos(a2) * rad, y + Math.sin(a2) * rad); } g.stroke(); }
    else if (pat === 'stars') for (let k = 0; k < 6; k++) { const sx = x + Math.cos(k * 2.4) * r * 0.55, sy = y + Math.sin(k * 2.4) * r * 0.55; g.fillStyle = c; g.beginPath(); for (let q = 0; q < 10; q++) { const an = -Math.PI / 2 + q * Math.PI / 5, rr = q % 2 ? r * 0.05 : r * 0.13; g.lineTo(sx + Math.cos(an) * rr, sy + Math.sin(an) * rr); } g.fill(); }
    else if (pat === 'check') for (let i = -3; i < 3; i++) for (let j = -3; j < 3; j++) if ((i + j) & 1) g.fillRect(x + i * r * 0.36, y + j * r * 0.36, r * 0.36, r * 0.36);
    else if (pat === 'flame') { g.fillStyle = c; for (let k = 0; k < 5; k++) { const fx = x - r + k * r * 0.5; g.beginPath(); g.moveTo(fx, y + r); g.quadraticCurveTo(fx - r * 0.2, y, fx + r * 0.25, y - r * 0.6 - Math.sin(t * 4 + k) * r * 0.1); g.quadraticCurveTo(fx + r * 0.5, y, fx + r * 0.5, y + r); g.fill(); } }
    else if (pat === 'wave') { g.lineWidth = r * 0.12; for (let k = -2; k <= 2; k++) { g.beginPath(); for (let q = -10; q <= 10; q++) g.lineTo(x + q * r * 0.1, y + k * r * 0.4 + Math.sin(q * 0.8 + t * 2) * r * 0.1); g.stroke(); } }
    g.restore();
    if (p.pens) p.pens.forEach((pc, k) => { const an = -Math.PI / 2 + (k - 1.5) * 0.5; g.beginPath(); g.arc(x + Math.cos(an) * r * 0.6, y + Math.sin(an) * r * 0.6 + r * 0.15, r * 0.17, 0, TAU); g.fillStyle = pc; g.fill(); g.lineWidth = Math.max(1, r * 0.05); g.strokeStyle = ink; g.stroke(); });
    g.beginPath(); g.arc(x, y, r, 0, TAU); g.lineWidth = Math.max(2, r * 0.1); g.strokeStyle = ink; g.stroke();
    g.beginPath(); g.arc(x, y, r * 0.86, Math.PI * 1.1, Math.PI * 1.5); g.lineWidth = Math.max(1, r * 0.06); g.strokeStyle = 'rgba(255,255,255,0.6)'; g.stroke();
    const icon = p.icon || (it && it.icon); if (icon && !p.pens) { g.font = `${Math.round(r * 0.95)}px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(icon, x, y + r * 0.06); }
    g.restore();
  }
  // JustMafia houses, in the shop's smooth style (the town itself draws them in JustMafia's own style).
  const HOUSES = {
    cottage: ['#eadcb9', '#c4674f', 'tri'], tavern: ['#d39a55', '#7a3a2a', 'tri', 'sign'], bakery: ['#f3e2c8', '#d06a4a', 'tri', 'awning'], smithy: ['#9c9b95', '#4c5a6e', 'tri', 'chimney'],
    apothecary: ['#9fbe86', '#3f6b4a', 'tri', 'bottle'], library: ['#e3d7bb', '#2f4f80', 'flat', 'columns'], chapel: ['#f2efe8', '#6a4a7a', 'steeple'], tailor: ['#d996ae', '#7a3a5a', 'tri', 'awning'],
    watchtower: ['#b0a898', '#5a4a3a', 'tower'], windmill: ['#eadcb9', '#8a3b2f', 'tri', 'mill'], farmhouse: ['#c4674f', '#3a3a42', 'barn'], manor: ['#e8e0cc', '#2f4f80', 'wide'],
    darkMansion: ['#4a3a5a', '#1e1628', 'tower', 'candle'], modernHouse: ['#f4f4f4', '#3a3a42', 'flat', 'glass'], rspOffice: ['#ffd21f', '#1f4fa8', 'flat', 'rsp'],
  };
  function drawHouse(g, x, y, s, style, decor, t = 0) {
    const [wall, roof, shape, extra] = HOUSES[style] || HOUSES.cottage, W = (shape === 'wide' ? 70 : shape === 'tower' ? 34 : 54) * s, H = (shape === 'tower' ? 62 : 40) * s;
    const L = x - W / 2, top = y - H;
    g.save(); g.lineJoin = 'round'; g.lineWidth = 2.2 * s; g.strokeStyle = ink;
    const box = (bx, by, bw, bh, c) => { g.beginPath(); g.rect(bx, by, bw, bh); g.fillStyle = c; g.fill(); g.stroke(); };
    const lg = (c) => { const gr = g.createLinearGradient(0, top, 0, y); gr.addColorStop(0, MTArt.shade(c, 0.12)); gr.addColorStop(1, MTArt.shade(c, -0.12)); return gr; };
    if (extra === 'chimney') { box(L + W * 0.7, top - 26 * s, 8 * s, 20 * s, '#7a6a5a'); for (let k = 0; k < 3; k++) { const p = (t * 0.4 + k / 3) % 1; g.beginPath(); g.arc(L + W * 0.74 + Math.sin(t + k) * 3 * s, top - 30 * s - p * 20 * s, (3 + p * 4) * s, 0, TAU); g.fillStyle = `rgba(230,230,240,${0.7 * (1 - p)})`; g.fill(); } }
    box(L, top, W, H, lg(wall));
    g.beginPath();
    if (shape === 'flat') { g.rect(L - 3 * s, top - 6 * s, W + 6 * s, 7 * s); }
    else if (shape === 'steeple') { g.moveTo(L - 4 * s, top); g.lineTo(x, top - 22 * s); g.lineTo(L + W + 4 * s, top); g.closePath(); g.moveTo(x - 6 * s, top - 18 * s); g.lineTo(x, top - 46 * s); g.lineTo(x + 6 * s, top - 18 * s); }
    else if (shape === 'tower') { g.moveTo(L - 5 * s, top); g.lineTo(x, top - 26 * s); g.lineTo(L + W + 5 * s, top); g.closePath(); }
    else if (shape === 'barn') { g.moveTo(L - 4 * s, top); g.lineTo(L + 6 * s, top - 14 * s); g.lineTo(x, top - 22 * s); g.lineTo(L + W - 6 * s, top - 14 * s); g.lineTo(L + W + 4 * s, top); g.closePath(); }
    else if (shape === 'wide') { g.moveTo(L - 4 * s, top); g.lineTo(L + W * 0.25, top - 20 * s); g.lineTo(L + W * 0.5, top - 8 * s); g.lineTo(L + W * 0.75, top - 20 * s); g.lineTo(L + W + 4 * s, top); g.closePath(); }
    else { g.moveTo(L - 5 * s, top + 2 * s); g.lineTo(x, top - 24 * s); g.lineTo(L + W + 5 * s, top + 2 * s); g.closePath(); }
    g.fillStyle = lg(roof); g.fill(); g.stroke();
    if (shape === 'steeple') { g.beginPath(); g.moveTo(x, top - 50 * s); g.lineTo(x, top - 58 * s); g.moveTo(x - 3 * s, top - 54 * s); g.lineTo(x + 3 * s, top - 54 * s); g.stroke(); }
    // door + windows
    const dw = 12 * s, dh = 18 * s; g.beginPath(); g.moveTo(x - dw / 2, y); g.lineTo(x - dw / 2, y - dh + dw / 2); g.arc(x, y - dh + dw / 2, dw / 2, Math.PI, 0); g.lineTo(x + dw / 2, y); g.fillStyle = style === 'darkMansion' ? '#2a1a1a' : '#8a5a34'; g.fill(); g.stroke();
    const win = (wx, wy, ww, wh, lit) => { g.beginPath(); g.rect(wx, wy, ww, wh); g.fillStyle = lit ? '#ffe48a' : '#bfe8ff'; g.fill(); g.stroke(); g.beginPath(); g.moveTo(wx + ww / 2, wy); g.lineTo(wx + ww / 2, wy + wh); g.lineWidth = 1.2 * s; g.stroke(); g.lineWidth = 2.2 * s; };
    if (extra === 'glass') { win(L + 4 * s, top + 6 * s, W * 0.36, H - 14 * s, false); win(L + W * 0.62, top + 6 * s, W * 0.32, H * 0.4, false); }
    else { win(L + 6 * s, top + 10 * s, 10 * s, 10 * s, style === 'darkMansion' || style === 'tavern'); win(L + W - 16 * s, top + 10 * s, 10 * s, 10 * s, style === 'darkMansion' && Math.sin(t * 2) > 0); if (shape === 'tower') win(x - 5 * s, top + 4 * s, 10 * s, 9 * s, true); }
    if (extra === 'sign') { g.beginPath(); g.rect(L + W - 4 * s, top + 22 * s, 14 * s, 9 * s); g.fillStyle = '#d6af53'; g.fill(); g.stroke(); }
    if (extra === 'awning') { for (let k = 0; k < 5; k++) { g.beginPath(); g.rect(L + k * W / 5, top + 2 * s, W / 5, 6 * s); g.fillStyle = k % 2 ? '#fff8ef' : roof; g.fill(); g.stroke(); } }
    if (extra === 'columns') for (let k = 0; k < 4; k++) if (k !== 1 && k !== 2) box(L + 3 * s + k * (W - 10 * s) / 3, top + 4 * s, 4 * s, H - 4 * s, '#fff8ef');
    if (extra === 'mill') { g.save(); g.translate(x, top - 10 * s); g.rotate(t * 0.8); for (let k = 0; k < 4; k++) { g.rotate(Math.PI / 2); g.beginPath(); g.rect(-3 * s, 2 * s, 6 * s, 24 * s); g.fillStyle = '#f2ead6'; g.fill(); g.stroke(); } g.restore(); g.beginPath(); g.arc(x, top - 10 * s, 3 * s, 0, TAU); g.fillStyle = ink; g.fill(); }
    if (extra === 'bottle') { g.beginPath(); g.arc(L + W - 10 * s, y - 6 * s, 4 * s, 0, TAU); g.fillStyle = '#7ad08a'; g.fill(); g.stroke(); }
    if (extra === 'candle') { g.beginPath(); g.arc(x, top - 14 * s, 2.5 * s, 0, TAU); g.fillStyle = '#ffd35c'; g.fill(); }
    if (extra === 'rsp') { g.beginPath(); g.rect(L + 6 * s, top + 24 * s, W - 12 * s, 6 * s); g.fillStyle = '#1f4fa8'; g.fill(); g.stroke(); }
    // decor
    if (decor === 'flowers') for (let k = 0; k < 6; k++) { g.beginPath(); g.arc(L + 4 * s + k * (W - 8 * s) / 5, y - 2 * s, 3 * s, 0, TAU); g.fillStyle = ['#ff8cc6', '#ffd23f', '#ff5a5f'][k % 3]; g.fill(); g.lineWidth = 1.2 * s; g.stroke(); }
    if (decor === 'banner') { g.lineWidth = 1.6 * s; g.beginPath(); g.moveTo(L + 6 * s, top + 26 * s); g.lineTo(L + 6 * s, top + 40 * s); g.lineTo(L + 10 * s, top + 36 * s); g.lineTo(L + 14 * s, top + 40 * s); g.lineTo(L + 14 * s, top + 26 * s); g.closePath(); g.fillStyle = '#c0283c'; g.fill(); g.stroke(); }
    if (decor === 'lanterns') for (const lx of [L - 2 * s, L + W + 2 * s]) { g.beginPath(); g.arc(lx, top + 16 * s, 4 * s, 0, TAU); const gl = g.createRadialGradient(lx, top + 16 * s, 0, lx, top + 16 * s, 10 * s); gl.addColorStop(0, 'rgba(255,220,120,0.7)'); gl.addColorStop(1, 'rgba(255,220,120,0)'); g.fillStyle = gl; g.fillRect(lx - 10 * s, top + 6 * s, 20 * s, 20 * s); g.fillStyle = '#ff9a3a'; g.fill(); g.lineWidth = 1.4 * s; g.stroke(); }
    if (decor === 'heraldry') { g.beginPath(); g.moveTo(x - 7 * s, top + 4 * s); g.lineTo(x + 7 * s, top + 4 * s); g.lineTo(x + 7 * s, top + 12 * s); g.quadraticCurveTo(x, top + 20 * s, x - 7 * s, top + 12 * s); g.closePath(); g.fillStyle = '#2f4f80'; g.fill(); g.lineWidth = 1.6 * s; g.stroke(); g.beginPath(); g.arc(x, top + 10 * s, 2.4 * s, 0, TAU); g.fillStyle = '#ffd23f'; g.fill(); }
    g.restore();
  }
  function drawDeath(g, cx, y, s, l, kind, t) {
    g.save(); g.translate(cx, y); g.rotate(-Math.PI / 2); g.translate(-cx, -y);
    MTArt.drawCharacter(g, cx + 2 * s, y + 18 * s, l, { scale: 0.62 * s * 1.6, dead: true }); g.restore();
    if (window.MT_FAREWELL) window.MT_FAREWELL.draw(g, kind, cx, y, s * 1.4, t % 6, { avatar: l, once: false });
  }
  // Paint one item card's picture.
  function paintCard(cv, i) {
    const [g, w, h] = fit(cv), l = look();
    if (i.kind === 'gear') { drawToken(g, w / 2, h / 2 + 2, Math.min(w, h) * 0.38, i, 0.6); return; }
    const L = { ...l, [i.field]: i.value };
    switch (i.field) {
      case 'houseStyle': drawHouse(g, w / 2, h - 6, h / 95, i.value, (S.st.home || {}).decor, 1); return;
      case 'houseDecor': drawHouse(g, w / 2, h - 6, h / 95, (S.st.home || {}).style || 'cottage', i.value, 1); return;
      case 'deathAnim': g.fillStyle = '#1d2236'; g.fillRect(0, 0, w, h); drawDeath(g, w / 2, h * 0.86, h / 100, l, i.value, 2.2); return;
      case 'ghostSkin': g.fillStyle = '#1d2236'; g.fillRect(0, 0, w, h); MTArt.drawGhost(g, w / 2, h - 6, { ...l, ghostSkin: i.value }, { scale: h / 80, t: 1.2, glow: true }); return;
      case 'effect': drawBody(g, w, h, L, 1.7); return;
      default: if (HEAD_FIELDS.has(i.field) || (i.field === 'accessory' && !BACK_ACC.has(i.value))) drawHead(g, w, h, L); else drawBody(g, w, h, L);
    }
  }

  // ---------- the stage (animated) ----------
  let raf = 0;
  function stageFrame(now) {
    raf = requestAnimationFrame(stageFrame);
    if (document.hidden || !S.st) return;
    const cv = $('#stage-cv'), [g, w, h] = fit(cv), t = now / 1000, l = previewLook(), i = byId(S.sel);
    const wide = w > 520, floorY = h * 0.86, counterTop = h * 0.7;
    const cx = w * (wide ? 0.4 : 0.36);
    // the shop floor
    g.fillStyle = 'rgba(120,30,80,0.28)'; g.fillRect(0, floorY - 6, w, h);
    // the keeper behind his counter (right)
    const kx = w * 0.82, ks = Math.min((h - 60) / 120, w / 220), jump = Math.max(0, S.keeperJump - t) > 0 ? Math.abs(Math.sin((S.keeperJump - t) * 9)) * 10 : 0;
    MTArt.drawCharacter(g, kx, counterTop + 20 * ks, { color: '#ffd23f', skin: '#f3c9a0', hair: 'curly', hairColor: '#241b18', outfit: 'merchant', hat: 'top', accessory: 'monocle', facialHair: 'moustache', expression: jump ? 'grin' : 'smile', pants: '#2d2f3a' }, { scale: ks, t: t + 3, facing: -0.6, jump, seed: 2 });
    g.save(); g.lineWidth = 3; g.strokeStyle = ink; g.lineJoin = 'round';
    const cl = w * 0.64; const cg = g.createLinearGradient(0, counterTop, 0, h); cg.addColorStop(0, '#b06a3a'); cg.addColorStop(1, '#6a3418');
    g.beginPath(); g.rect(cl, counterTop, w - cl + 4, h - counterTop + 4); g.fillStyle = cg; g.fill(); g.stroke();
    g.beginPath(); g.rect(cl - 6, counterTop - 9, w - cl + 12, 11); const gg = g.createLinearGradient(0, counterTop - 9, 0, counterTop + 2); gg.addColorStop(0, '#ffe37a'); gg.addColorStop(1, '#e0a400'); g.fillStyle = gg; g.fill(); g.stroke();
    g.restore();
    const s = Math.max(1.2, Math.min((floorY - 48) / 76, w / 95));
    // a showcase for what you're trying on
    if (i && i.kind === 'item' && HOME[i.field]) {
      const home = { ...(S.st.home || {}) }; home[HOME[i.field]] = i.value;
      drawHouse(g, cx - 6, floorY - 4, s * 0.78, home.style || 'cottage', home.decor, t);
    }
    // the golden pedestal
    g.save(); g.lineWidth = 3; g.strokeStyle = ink; g.beginPath(); g.ellipse(cx, floorY, 30 * s * 0.75, 8 * s * 0.6, 0, 0, TAU);
    const pg = g.createRadialGradient(cx, floorY - 4, 2, cx, floorY, 30 * s); pg.addColorStop(0, '#fff2a8'); pg.addColorStop(1, '#e0a400'); g.fillStyle = pg; g.fill(); g.stroke(); g.restore();
    if (i && i.kind === 'item' && i.field === 'deathAnim') drawDeath(g, cx, floorY - 2, s, l, i.value, t);
    else if (i && i.kind === 'item' && HOME[i.field]) MTArt.drawCharacter(g, cx + 34 * s * 0.5, floorY + 2, l, { scale: s * 0.6, t });
    else MTArt.drawCharacter(g, cx, floorY - 2, l, { scale: s, t, seed: 1, jump: S.happy && S.happy > t ? Math.abs(Math.sin((S.happy - t) * 8)) * 8 * s : 0 });
    if (i && i.kind === 'item' && i.field === 'ghostSkin') MTArt.drawGhost(g, w * (wide ? 0.6 : 0.6), floorY - 6, { ...l, ghostSkin: i.value }, { scale: s * 0.62, t, glow: true });
    if (i && i.kind === 'item' && i.field === 'reactions') {
      const pack = (O.REACTION_PACKS || {})[i.value] || [];
      g.save(); g.textAlign = 'center'; g.textBaseline = 'middle';
      pack.forEach((e, k) => { const p = (t * 0.35 + k / pack.length) % 1; g.globalAlpha = p < 0.8 ? 1 : (1 - p) * 5; g.font = `${Math.round(16 * s * 0.7 * (0.8 + p * 0.4))}px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif`; g.fillText(e, cx + Math.sin(k * 2.1 + t) * 26 * s * 0.6, floorY - 70 * s - p * 40); });
      g.restore();
    }
    if (i && i.kind === 'gear') {
      const gx = w * (wide ? 0.62 : 0.6), gy = floorY - 34 * s * 0.8 + Math.sin(t * 2) * 4;
      g.save(); g.fillStyle = 'rgba(0,0,0,0.2)'; g.beginPath(); g.ellipse(gx, floorY, 18 * s * 0.6, 4 * s * 0.6, 0, 0, TAU); g.fill(); g.restore();
      drawToken(g, gx, gy, 17 * s * 0.75, i, t);
    }
  }

  // ---------- render ----------
  const sectionOf = (i) => (i.kind === 'gear' ? 'gear' : i.section);
  function cardHTML(i) {
    const own = i.owned, wear = wearing(i), poor = !own && !i.lock && S.st.gold < i.cost;
    const badge = wear ? '<em class="badge eq">✓ On</em>' : own ? (i.free || i.isDefault ? '<em class="badge own">Free</em>' : '<em class="badge own">Owned</em>') : i.lock ? '<em class="badge lock">🔒</em>' : `<em class="badge${poor ? ' poor' : ''}">${COIN}${i.cost}</em>`;
    let art = '<canvas aria-hidden="true"></canvas>';
    if (i.field === 'reactions') art = `<div class="emo" aria-hidden="true">${((O.REACTION_PACKS || {})[i.value] || []).map((e) => `<span>${esc(e)}</span>`).join('')}</div>`;
    if (i.field === 'nameplate') art = `<div class="np" aria-hidden="true"><span class="np-${esc(i.value)}" style="color:${esc(look().nameColor || '#fff')}">${esc(S.st.name || 'You')}</span></div>`;
    return `<button class="card${i.id === S.sel ? ' sel' : ''}${i.lock && !own ? ' locked' : ''}${wear ? ' wearing' : ''}" data-item="${esc(i.id)}" aria-pressed="${i.id === S.sel}" aria-label="${esc(i.name)}">${art}<b>${esc(i.name)}</b>${badge}</button>`;
  }
  // Wearing first, then owned, then what you can buy (cheapest first), then locked.
  const rank = (i) => (wearing(i) ? 0 : i.owned ? 1 : i.lock ? 3 : 2);
  const sorted = (list) => list.slice().sort((a, b) => rank(a) - rank(b) || (rank(a) === 2 ? a.cost - b.cost : 0));
  function render() {
    if (!S.st) return;
    ITEMS = items();
    const st = S.st;
    document.body.classList.toggle('is-busy', !!st.busy);
    $('#busy').hidden = !st.busy;
    setGold(st.gold);
    // tabs
    $('#tabs').innerHTML = SECTIONS.map((s) => `<button class="tab${s.id === S.tab ? ' on' : ''}" role="tab" aria-selected="${s.id === S.tab}" data-tab="${s.id}"><span aria-hidden="true">${s.icon}</span>${esc(s.label)}</button>`).join('');
    const sec = SECTIONS.find((s) => s.id === S.tab);
    const subs = sec.subs ? sec.subs : null;
    $('#subs').hidden = !subs && !(S.tab === 'gear' && S.game);
    if (subs) {
      $('#subs').innerHTML = subs.map(([k, ic, lb]) => { const n = k === 'colours' ? '' : ITEMS.filter((i) => i.field === k && i.owned).length; return `<button class="chip${S.sub[S.tab] === k ? ' on' : ''}" data-sub="${k}">${ic} ${esc(lb)}${n !== '' ? ` <small>${n}</small>` : ''}</button>`; }).join('');
    } else if (S.tab === 'gear' && S.game) $('#subs').innerHTML = '<button class="chip on" data-games="1">‹ All games</button>';
    // shelf
    const shelf = $('#shelf'); let html = '';
    if (S.tab === 'character' && S.sub.character === 'colours') html = coloursHTML();
    else if (S.tab === 'character' || S.tab === 'flair' || S.tab === 'mafia') {
      const field = S.sub[S.tab], list = sorted(ITEMS.filter((i) => i.kind === 'item' && i.field === field));
      if (S.tab === 'mafia') html += '<p class="note">🔪 These are for <b>JustMafia</b>: your house, how you go out, your reactions and your ghost. 🎟 <b>Season pass & ✦ Fate live in JustMafia</b> (Season & unlocks).</p>';
      if (S.tab === 'flair') html += '<p class="note">✨ Flair shows in <b>every game</b>: your nameplate on the big screen and an effect around your character.</p>';
      html += list.length ? `<div class="grid">${list.map(cardHTML).join('')}</div>` : '<p class="empty">Nothing here yet.</p>';
    } else if (S.tab === 'gear') html = gearHTML();
    else if (S.tab === 'wardrobe') html = wardrobeHTML();
    else if (S.tab === 'earn') html = earnHTML();
    shelf.innerHTML = html;
    requestAnimationFrame(paintShelf);
    for (const nav of [$('#tabs'), $('#subs')]) { const on = nav.querySelector('.on'); if (!on) continue; const nr = nav.getBoundingClientRect(), r = on.getBoundingClientRect(); if (r.left < nr.left || r.right > nr.right) nav.scrollLeft += r.left - nr.left - 14; }
    renderStageText(); renderAct();
  }
  function paintShelf() {
    for (const b of document.querySelectorAll('#shelf [data-item]')) { const cv = b.querySelector('canvas'), i = byId(b.dataset.item); if (cv && i) try { paintCard(cv, i); } catch (e) { /* skip */ } }
    for (const b of document.querySelectorAll('#shelf [data-opt]')) { const cv = b.querySelector('canvas'); if (!cv) continue; const [g, w, h] = fit(cv); drawHead(g, w, h, { ...look(), [b.dataset.field]: b.dataset.opt }); }
  }
  function coloursHTML() {
    const l = look();
    const sw = (field, label) => `<h3 class="sec-h">${esc(label)}</h3><div class="swatches">${(O[O.AVATAR_FIELDS[field]] || []).map((c) => `<button class="sw${l[field] === c ? ' on' : ''}" style="background:${esc(c)}" data-field="${field}" data-val="${esc(c)}" aria-label="${esc(O.label(c))}" aria-pressed="${l[field] === c}"></button>`).join('')}</div>`;
    const op = (field, label) => `<h3 class="sec-h">${esc(label)}</h3><div class="opts">${(O[O.AVATAR_FIELDS[field]] || []).map((v) => `<button class="opt${l[field] === v ? ' on' : ''}" data-field="${field}" data-val="${esc(v)}" data-opt="${esc(v)}" aria-pressed="${l[field] === v}"><canvas aria-hidden="true"></canvas>${esc(O.label(v))}</button>`).join('')}</div>`;
    return '<p class="note">🎨 Colours and faces are <b>free</b>. Tap to change; it saves by itself.</p>' + sw('skin', 'Skin') + op('expression', 'Expression') + sw('hairColor', 'Hair colour') + sw('eyes', 'Eyes') + sw('color', 'Clothes colour') + sw('pants', 'Trousers') + sw('shoes', 'Shoe colour') + op('face', 'Face shape') + op('facialHair', 'Facial hair') + op('features', 'Freckles & cheeks') + sw('nameColor', 'Name colour');
  }
  function gearHTML() {
    const games = (GEAR.GAMES_WITH_GEAR || []).map((s) => s.game).filter((g, k, a) => a.indexOf(g) === k);
    if (!S.game || !games.includes(S.game)) {
      return '<p class="note">🎮 Gear is <b>per game</b>: a marble skin in JustMarble, a card back in President, a phone theme in the party games… Pick a game.</p><div class="games">' + games.map((k) => {
        const list = ITEMS.filter((i) => i.kind === 'gear' && i.game === k && !i.isDefault), have = list.filter((i) => i.owned).length;
        const slot = (GEAR.GAMES_WITH_GEAR.find((s) => s.game === k) || {}).label || 'Gear';
        return `<button class="game" data-game="${esc(k)}"><img src="/art/tiles/${encodeURIComponent(k)}.svg" alt="" loading="lazy"><span class="gi">${esc(gameIcon(k))} ${esc(gameName(k))}<small>${esc(slot)}</small></span><span class="count${have ? ' has' : ''}">${have}/${list.length}</span></button>`;
      }).join('') + '</div>';
    }
    const k = S.game, slots = GEAR.GAMES_WITH_GEAR.filter((s) => s.game === k);
    return `<div class="gear-head"><img src="/art/tiles/${encodeURIComponent(k)}.svg" alt=""><div><h3>${esc(gameIcon(k))} ${esc(gameName(k))}</h3><p>${slots.map((s) => esc(s.label) + (s.where === 'phone' ? ' · on your phone' : ' · on the big screen')).join(' · ')}</p></div></div>` +
      slots.map((s) => `<div class="grid">${sorted(ITEMS.filter((i) => i.kind === 'gear' && i.game === k && i.slot === s.slot)).map(cardHTML).join('')}</div>`).join('');
  }
  function wardrobeHTML() {
    const mine = ITEMS.filter((i) => i.owned && !i.free && !i.isDefault);
    if (!mine.length) return '<p class="empty">🎒 Your wardrobe is empty.<br>Buy something and it lives here, ready to wear in any game.</p>';
    const groups = [['character', '👤 Character'], ['flair', '✨ Flair'], ['gear', '🎮 Game gear'], ['mafia', '🔪 JustMafia']];
    return '<p class="note">🎒 Everything you own. Tap to try it on, then <b>Wear</b>.</p>' + groups.map(([k, lb]) => { const l = mine.filter((i) => sectionOf(i) === k); return l.length ? `<h3 class="sec-h">${lb} <small>${l.length}</small></h3><div class="grid">${sorted(l).map(cardHTML).join('')}</div>` : ''; }).join('');
  }
  function earnHTML() {
    const e = S.st.earn || {}, st = S.st, b = e.base || {};
    const ex = (e.examples || []).map((x) => `<div class="row"><span>${esc(x.label)}</span><b>${COIN} ${esc(x.jg)}</b></div>`).join('');
    const led = (st.ledger || []).map((x) => `<li><span>${esc(x.reason)}</span><small>${esc(new Date(x.at).toLocaleDateString())}</small><b class="${x.delta < 0 ? 'minus' : ''}">${x.delta > 0 ? '+' : ''}${esc(x.delta)}</b></li>`).join('');
    return `<div class="totals"><div><b>${esc(st.gold)}</b><small>JG now</small></div><div><b>${esc(st.earned || 0)}</b><small>earned</small></div><div><b>${esc(st.spent || 0)}</b><small>spent</small></div></div>
      <p class="note">🪙 ${esc(e.note || 'Every finished game pays JustGold.')}</p>
      <div class="earn">${b.play != null ? `<div class="row"><span>🎮 Play a game</span><b>+${esc(b.play)}</b></div><div class="row"><span>🥈 Finish in the top half</span><b>+${esc(b.top)}</b></div><div class="row"><span>🏆 Win it</span><b>+${esc(b.win)}</b></div>` : ''}${ex}
      ${e.party ? `<div class="row party"><span>🎉 ${esc(e.party.label)}</span></div>` : ''}${e.mafia ? `<div class="row"><span>🔪 ${esc(e.mafia)}</span></div>` : ''}</div>
      <h3 class="sec-h">📜 Your ledger <small>where every coin came from</small></h3>${led ? `<ul class="ledger">${led}</ul>` : '<p class="empty">No JustGold yet. Finish a game with friends to earn some!</p>'}`;
  }
  function renderStageText() {
    const st = S.st, i = byId(S.sel), l = look();
    const tag = $('#tag');
    if (i) { tag.hidden = false; tag.innerHTML = `${wearing(i) ? 'Wearing' : i.owned ? 'Yours' : 'Trying on'}<b>${esc(i.name)}</b>`; }
    else if (!st.lookSaved) { tag.hidden = false; tag.innerHTML = 'This is you!<b>Make it yours</b>'; }
    else tag.hidden = true;
    const plate = $('#plate'), np = i && i.field === 'nameplate' ? i.value : l.nameplate || 'plain';
    plate.className = 'plate np-' + (O.nameplate.includes(np) ? np : 'plain');
    plate.style.color = /^#[0-9a-f]{6}$/i.test(l.nameColor || '') ? l.nameColor : '#fff';
    plate.textContent = st.name || 'You';
    say(i ? pitchOf(i) : S.say || (st.busy ? 'Busy playing? Have a look around. I’ll hold everything for you.' : pick(HELLO, String(st.name || 'x'))));
  }
  function renderAct() {
    const a = $('#act'), st = S.st, i = byId(S.sel);
    let html = '';
    if (i) {
      const wear = wearing(i), left = st.gold - i.cost;
      let sub = '', btns = '';
      if (st.busy) { sub = '<small class="warn">You can shop after this game.</small>'; btns = '<button class="btn" disabled>🔒 After this game</button>'; }
      else if (wear) { sub = '<small>You’re wearing it in every game.</small>'; btns = i.isDefault || (i.kind === 'item' && (O[O.AVATAR_FIELDS[i.field]] || O[O.HOME_FIELDS[HOME[i.field]]] || [])[0] === i.value) ? '<button class="btn ghost" data-act="close">Done</button>' : '<button class="btn ghost" data-act="off">Take off</button>'; }
      else if (i.owned) { sub = `<small>${i.free || i.isDefault ? 'Free for everyone.' : 'In your wardrobe.'}</small>`; btns = '<button class="btn" data-act="wear">👕 Wear</button>'; }
      else if (i.lock) { sub = `<small class="warn">🔒 ${esc(i.lock)}</small>`; btns = '<button class="btn ghost" data-act="close">OK</button>'; }
      else if (left < 0) { sub = `<small class="warn">${COIN} ${esc(i.cost)} JG · you need ${esc(-left)} more</small>`; btns = '<button class="btn gold" data-act="earn">🪙 Earn JG</button>'; }
      else { sub = `<small>${COIN} ${esc(i.cost)} JG · you’d have <b>${esc(left)}</b> left</small>`; btns = `<button class="btn gold" data-act="buy">Buy ${COIN} ${esc(i.cost)}</button>`; }
      html = `<div class="what"><b>${esc(i.name)}</b>${sub}</div>${btns}`;
    } else if (!st.lookSaved && !st.busy) html = '<div class="what"><b>This is you!</b><small>Pick colours, a face and clothes. Then save.</small></div><button class="btn" data-act="save">✓ Save my character</button>';
    else if (S.saving || S.pending) html = '<div class="what"><b>Saving your look…</b><small>It shows in every game.</small></div>';
    a.innerHTML = html; a.classList.toggle('off', !html);
    a.querySelectorAll('button').forEach((b) => { if (S.inflight && b.dataset.act !== 'close') b.disabled = true; });
  }

  // ---------- actions ----------
  function applyState(st) { if (st && typeof st === 'object' && Array.isArray(st.catalog)) { S.st = st; } }
  async function refresh() { const r = await API.state(); if (r.ok) { applyState(r); render(); } return r; }
  async function doBuy(i) {
    if (S.inflight) return; S.inflight = true; renderAct();
    const r = await API.buy(i.id); S.inflight = false;
    if (r.state) applyState(r.state);
    if (!r.ok) { hap('error'); toast(r.error || 'Could not buy that.'); if (r.busy && S.st) S.st.busy = true; render(); return; }
    hap('success'); S.keeperJump = performance.now() / 1000 + 1; S.happy = performance.now() / 1000 + 0.9;
    const w = await API.equip(i.id, true); if (w.state) applyState(w.state);
    ITEMS = items();
    S.say = `Thank you! The ${i.name} is yours, and you’re wearing it.`;
    toast(`🎉 ${i.name} is yours!`);
    render();
  }
  async function doEquip(i, on) {
    if (S.inflight) return; S.inflight = true; renderAct();
    let id = i.id;
    if (i.isDefault) { const cur = S.st.gear && S.st.gear[i.game] && S.st.gear[i.game][i.slot]; if (!cur) { S.inflight = false; render(); return; } id = cur; on = false; }
    const r = await API.equip(id, on); S.inflight = false;
    if (r.state) applyState(r.state);
    if (!r.ok) { hap('error'); toast(r.error || 'Could not change that.'); render(); return; }
    hap(on ? 'success' : 'select'); if (on) S.happy = performance.now() / 1000 + 0.7;
    toast(on ? `👕 Wearing the ${i.name}` : `Took off the ${i.name}`);
    render();
  }
  let saveT = 0;
  function editLook(field, val) {
    if (!S.st || S.st.busy) { toast('You can change your look after this game.'); return; }
    if (!FREE_FIELDS.includes(field) || !(O[O.AVATAR_FIELDS[field]] || []).includes(val)) return;
    S.edits[field] = val; S.sel = null; S.pending = true; hap('select');
    render();
    clearTimeout(saveT); saveT = setTimeout(saveLook, 700);
  }
  async function saveLook(force) {
    if (!S.st) return;
    if (!Object.keys(S.edits).length && !force) { S.pending = false; renderAct(); return; }
    const sent = { ...S.edits }, full = { ...S.st.look, ...sent };
    S.saving++; S.pending = false; renderAct();
    const r = await API.look(full); S.saving--;
    if (r.state) applyState(r.state);
    for (const k of Object.keys(sent)) if (S.edits[k] === sent[k]) delete S.edits[k];
    if (!r.ok) { toast(r.error || 'Could not save your look.'); S.edits = {}; }
    else if (force) { hap('win'); toast('✓ Saved! That’s you in every game.'); S.happy = performance.now() / 1000 + 1; }
    render();
  }
  function select(id) {
    S.sel = S.sel === id ? null : id; S.say = '';
    const i = byId(S.sel); hap('tap');
    if (i && i.kind === 'item' && i.field === 'effect') S.happy = 0;
    render();
    if (i && window.innerWidth < 760) { const st = $('#stage'); if (st.getBoundingClientRect().bottom < 60) window.scrollTo({ top: 0, behavior: 'smooth' }); }
  }

  // ---------- events (delegated) ----------
  $('#tabs').addEventListener('click', (e) => { const b = e.target.closest('[data-tab]'); if (!b) return; S.tab = b.dataset.tab; if (S.tab !== 'gear') S.game = null; S.sel = null; hap('tap'); render(); });
  $('#subs').addEventListener('click', (e) => { const b = e.target.closest('[data-sub],[data-games]'); if (!b) return; if (b.dataset.games) S.game = null; else S.sub[S.tab] = b.dataset.sub; S.sel = null; hap('tap'); render(); });
  $('#shelf').addEventListener('click', (e) => {
    const it = e.target.closest('[data-item]'); if (it) return select(it.dataset.item);
    const gm = e.target.closest('[data-game]'); if (gm) { S.game = gm.dataset.game; S.sel = null; hap('tap'); render(); window.scrollTo({ top: 0 }); return; }
    const c = e.target.closest('[data-field]'); if (c) editLook(c.dataset.field, c.dataset.val);
  });
  $('#act').addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]'); if (!b || b.disabled) return; const i = byId(S.sel);
    const a = b.dataset.act;
    if (a === 'buy' && i) doBuy(i);
    else if (a === 'wear' && i) doEquip(i, true);
    else if (a === 'off' && i) doEquip(i, false);
    else if (a === 'earn') { S.tab = 'earn'; S.sel = null; render(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
    else if (a === 'save') saveLook(true);
    else if (a === 'close') { S.sel = null; render(); }
  });
  window.addEventListener('resize', () => { if (S.st) requestAnimationFrame(paintShelf); });

  // ---------- start: make your character (or sign in) ----------
  const randLook = () => { const r = (a) => a[Math.floor(Math.random() * a.length)]; return { color: r(O.colors.slice(0, 11)), skin: r(O.skins), hair: r(O.hair.slice(0, 5)), hairColor: r(O.hairColor.slice(0, 7)), eyes: r(O.eyes), expression: r(['smile', 'grin', 'wink', 'smirk']), outfit: r(O.outfit.slice(0, 4)), hat: r(['none', 'cap', 'top']), pants: r(O.pants), shoes: r(O.shoes), face: 'round', features: r(['none', 'freckles', 'rosyCheeks']), facialHair: 'none', accessory: 'none' }; };
  let startRaf = 0;
  function showStart(mode = 'new', err = '') {
    $('#left').hidden = true; $('#right').hidden = true; $('#act').classList.add('off'); $('#jg').hidden = true;
    const box = $('#start'); box.hidden = false; box.className = 'start';
    if (!S.startLook) S.startLook = randLook();
    let name = ''; try { name = localStorage.getItem('box.name') || ''; } catch (e) { /* private */ }
    box.innerHTML = mode === 'login'
      ? `<h1>Welcome <span>back!</span></h1><p class="muted">Sign in with the name and PIN you saved in 🏆 My profile.</p>
         <label for="s-name">Name</label><input id="s-name" maxlength="14" autocomplete="off" value="${esc(name)}">
         <label for="s-pin">PIN</label><input id="s-pin" inputmode="numeric" maxlength="6" type="password" autocomplete="off">
         <button class="btn" id="s-go">Sign in</button><p class="err" id="s-err">${esc(err)}</p><button class="link" id="s-swap">New here? Make a character</button>`
      : `<h1>Make your <span>character</span></h1><p class="muted">One character for every JustGameBox game. Earn <b>JustGold</b> by playing, spend it here.</p>
         <div class="hero"><canvas id="s-cv"></canvas><button class="btn sm ghost shuffle" id="s-shuffle">🎲 Shuffle</button></div>
         <label for="s-name">Your name</label><input id="s-name" maxlength="14" autocomplete="nickname" placeholder="Name" value="${esc(name)}">
         <button class="btn" id="s-go">Let’s go! ✨</button><p class="err" id="s-err">${esc(err)}</p><button class="link" id="s-swap">Already have a profile? Sign in</button>`;
    cancelAnimationFrame(startRaf);
    const cv = $('#s-cv');
    if (cv) { const frame = (now) => { startRaf = requestAnimationFrame(frame); if (!cv.isConnected) return cancelAnimationFrame(startRaf); const [g, w, h] = fit(cv); const s = (h - 24) / 84; MTArt.drawCharacter(g, w / 2, h - 12, S.startLook, { scale: s, t: now / 1000 }); }; startRaf = requestAnimationFrame(frame); }
    const sh = $('#s-shuffle'); if (sh) sh.onclick = () => { S.startLook = randLook(); hap('select'); };
    $('#s-swap').onclick = () => showStart(mode === 'login' ? 'new' : 'login');
    const go = $('#s-go'), err$ = $('#s-err');
    const submit = async () => {
      const nm = $('#s-name').value.replace(/[<>&"]/g, '').replace(/\s+/g, ' ').trim().slice(0, 14);
      if (!nm) { err$.textContent = 'Type your name first.'; hap('error'); return; }
      go.disabled = true; err$.textContent = '';
      let r;
      if (mode === 'login') {
        const pin = $('#s-pin').value.trim();
        if (!/^\d{4,6}$/.test(pin)) { go.disabled = false; err$.textContent = 'The PIN is 4 to 6 digits.'; hap('error'); return; }
        r = await API.login(nm, pin);
      } else r = await API.create(nm);
      go.disabled = false;
      if (!r.ok || !r.id || !r.token) { err$.textContent = r.error || 'That didn’t work. Try again.'; hap('error'); return; }
      if (API.live) setProf(r); try { localStorage.setItem('box.name', nm); } catch (e) { /* private */ }
      hap('success'); S.fresh = mode !== 'login'; boot();
    };
    go.onclick = submit;
    box.querySelectorAll('input').forEach((inp) => inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); }));
  }

  // ---------- boot ----------
  let pollT = 0;
  async function boot() {
    if (!window.MTArt) { document.body.innerHTML = '<p style="padding:20px">Could not load the character art. Refresh the page.</p>'; return; }
    if (API.live && !API.connected()) {
      S.waiting = true;
      setTimeout(() => { if (S.waiting && !S.st) { S.waiting = false; API = mockApi(); const o = $('#offline'); o.textContent = 'Offline preview: you can look around, but nothing is saved.'; o.hidden = false; boot(); } }, 5000);
      return;
    }
    if (!getProf() && API.live) return showStart();
    let r = await API.state();
    if (!r.ok && r.noWallet) { const w = await API.wallet(); if (API.live && w.ok && w.wallet) setJSON('mt.profile', { id: w.wallet.id, token: w.wallet.token }); r = await API.state(); }
    else if (r.ok && API.live) { const w = await API.wallet(); if (w.ok && w.wallet) setJSON('mt.profile', { id: w.wallet.id, token: w.wallet.token }); }
    if (!r.ok) {
      if (r.timeout) { const o = $('#offline'); o.textContent = r.error; o.hidden = false; return; }
      if (API.live) { setProf(null); return showStart('new', /character|profile/i.test(r.error || '') ? '' : r.error || ''); }
    }
    applyState(r);
    // A brand-new character starts with the look from the start screen (colours are free).
    if (S.fresh && S.startLook && !S.st.lookSaved) { for (const k of FREE_FIELDS) if (S.startLook[k]) S.edits[k] = S.startLook[k]; S.sub.character = 'colours'; }
    S.fresh = false;
    $('#start').hidden = true; $('#left').hidden = false; $('#right').hidden = false;
    render();
    if (!raf) raf = requestAnimationFrame(stageFrame);
    clearInterval(pollT);
    pollT = setInterval(() => { if (S.st && S.st.busy && !S.inflight) refresh(); }, 10000);
  }
  window.addEventListener('pageshow', (e) => { if (e.persisted && S.st) refresh(); });
  if (API.live) { /* boot runs on connect */ S.waiting = true; setTimeout(() => { if (S.waiting) { S.waiting = false; boot(); } }, 50); } else boot();
  window.JG_SHOP = { state: () => S, select, render };
})();
