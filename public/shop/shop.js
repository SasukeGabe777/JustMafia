'use strict';
// The JustGold shop (/shop): one character and one wallet for every JustGameBox game.
// Data and rules live on the server (/box socket: account:wallet, shop:state, shop:buy,
// shop:equip, shop:look; see docs/justgold.md). This page only shows them, previews items on
// your character (try-on) and sends your choices. ?mock=1 (or no server) runs an offline preview.
(function () {
  const O = window.MT_OPTIONS, C = window.MT_COSMETICS, GEAR = window.MT_GEAR || { GEAR: [], GAMES_WITH_GEAR: [] };
  const SSN = window.MT_SHOP_SEASON || null; // event items, daily deals, theme sets (public/shared/shop-season.js)
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
  const GAMES = { mafia: ['JustMafia', '🔪'], ducks: ['JustRaiseDucks', '🦆'], kingdoms: ['JustKingdoms', '🏰'], president: ['President', '👑'], blanks: ['JustBlanks', '🃏'], blackjack: ['Blackjack Night', '♠️'], bid: ['JustBid', '📦'], price: ['Price Panic', '💸'], emoji: ['Emoji Charades', '😜'], truths: ['Two Truths & a Lie', '🤥'], likely: ['Most Likely To…', '🏆'], whosaid: ['Who Said It?', '🕵️'], spectrum: ['Where Do You Stand?', '🧭'], sketch: ['JustSketch Relay', '✏️'], funny: ['JustFunny', '😂'], plinko: ['JustDrop', '🎯'], trivia: ['Hot Take Trivia', '🧠'], colormatch: ['Color Match', '🎨'], memes: ['Meme Maker', '🖼️'], letters: ['Letter Rush', '🔤'], summon: ['JustSummon', '⚔️'], quickdraw: ['Quick Draw', '⚡'], bomb: ['Bomb Squad', '💣'], alien: ['Alien Abduction', '🛸'], tune: ['Tune Buzz', '🎵'], actout: ['Act It Out', '🎭'], debate: ['Debate Club', '🗣️'], marble: ['JustMarble', '🔮'], escape: ['JustEscape', '🗝️'], zombie: ['Zombie Survival', '🧟'], pizza: ['Pizza', '🍕'], undercover: ['JustUndercover', '🕵️'] };
  const gameName = (k) => (GAMES[k] ? GAMES[k][0] : String(k));
  const gameIcon = (k) => (GAMES[k] ? GAMES[k][1] : '🎮');

  // ---------- sections ----------
  const SECTIONS = [
    { id: 'character', icon: '👤', label: 'Character', subs: [['body', '🧍', 'Body'], ['outfit', '👕', 'Outfits'], ['hat', '🎩', 'Hats'], ['hair', '💇', 'Hair'], ['accessory', '🕶️', 'Extras'], ['shoeStyle', '👟', 'Shoes'], ['colours', '🎨', 'Colours & face']] },
    { id: 'flair', icon: '✨', label: 'Flair', subs: [['nameplate', '🏷️', 'Nameplates'], ['effect', '🌟', 'Effects']] },
    { id: 'gear', icon: '🎮', label: 'Games' },
    { id: 'wardrobe', icon: '🎒', label: 'Wardrobe' },
    { id: 'earn', icon: '🪙', label: 'Earn JG' },
  ];
  // JustMafia is one of the games (Games → JustMafia): its own shelves.
  const MAFIA_SUBS = [['houseStyle', '🏠', 'Houses'], ['houseDecor', '🏮', 'Decor'], ['deathAnim', '🕯️', 'Farewells'], ['reactions', '😱', 'Reactions'], ['ghostSkin', '👻', 'Ghosts']];
  const FREE_FIELDS = ['body', 'skin', 'hairColor', 'color', 'eyes', 'expression', 'pants', 'shoes', 'face', 'features', 'facialHair', 'nameColor'];
  const HOME = { houseStyle: 'style', houseDecor: 'decor' };
  const HEAD_FIELDS = new Set(['hat', 'hair', 'expression', 'face', 'facialHair', 'features']);
  const BACK_ACC = new Set(['cape', 'wings', 'batWings', 'fairyWings', 'backpack', 'satchel', 'torch', 'rose', 'wristwatch', 'diceBag', 'badge', 'goldChain', 'amulet', 'scarf',
    'autumnScarf', 'ciderMug', 'candyCane', 'loveLetter', 'cupidWings', 'bouquet', 'butterflyWings', 'surfboard', 'icePop', 'treatBucket', 'lasso', 'woodenSpoon', 'magnifier', 'cardFan', 'rayGun', 'camera']);

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
      live: true, connected: () => up, socket,
      create: (name) => call('profile:create', { name }),
      login: (name, password) => call('profile:login', { name, password }),
      wallet: () => call('account:wallet', { auth: auth(), mafia: getMafia() }),
      state: () => call('shop:state', { auth: auth() }),
      buy: (itemId) => call('shop:buy', { auth: auth(), itemId }),
      equip: (itemId, on) => call('shop:equip', { auth: auth(), itemId, on }),
      look: (look) => call('shop:look', { auth: auth(), look }),
      bundle: (setId, wear) => call('shop:bundle', { auth: auth(), setId, wear }),
      wearSet: (setId) => call('shop:wearSet', { auth: auth(), setId }),
    };
  }
  function mockApi() {
    const stock = new Set(C.STARTER_STOCK.concat(C.nextStock(C.STARTER_STOCK, 14)));
    // ?mock=1&now=2027-02-10 previews another day (another event, other deals).
    const NOW = params.get('now') && !isNaN(Date.parse(params.get('now') + 'T12:00:00Z')) ? Date.parse(params.get('now') + 'T12:00:00Z') : null, now = () => NOW || Date.now();
    const sale = (id) => { if (!SSN) return {}; const pr = SSN.priceOf(id, now()) || {}; return { price: pr.cost, pct: pr.pct || 0, limited: SSN.limitedInfo(id, now()), set: SSN.SET_OF[id] || null }; };
    const onShelf = (i) => stock.has(i.id) || (SSN && (SSN.isDeal(i.id, now()) || SSN.SET_OF[i.id]));
    const m = { name: 'You', gold: 520, earned: 590, spent: 70, owned: new Set(C.CATALOG.filter((i) => i.free).map((i) => i.id).concat(['hat:beret', 'gear:marble:cherry', 'hat:cowboy', 'outfit:sheriff', 'hat:chef'])), gear: { marble: { skin: 'gear:marble:cherry' } },
      look: { body: 'female', color: '#e84393', skin: '#d9a273', hat: 'beret', hair: 'ponytail', hairColor: '#ba593c', facialHair: 'none', eyes: '#416f91', face: 'round', features: 'rosyCheeks', expression: 'grin', outfit: 'shirt', pants: '#2d2f3a', shoes: '#151821', shoeStyle: 'simple', accessory: 'none', nameColor: '#ffffff', nameplate: 'plain', effect: 'none', deathAnim: 'none', reactions: 'rxClassic', ghostSkin: 'classic' },
      home: { style: 'cottage', decor: 'none' }, lookSaved: true,
      ledger: [{ at: Date.now() - 3.6e6, delta: 14, reason: 'JustMarble: cleared the maze', balance: 340 }, { at: Date.now() - 7.2e6, delta: -70, reason: 'Bought Beret', balance: 326 }, { at: Date.now() - 9e6, delta: 25, reason: 'Party Mode finale', balance: 396 }, { at: Date.now() - 1e7, delta: 9, reason: 'Blackjack Night: top half', balance: 371 }] };
    const section = { outfit: 'character', shoeStyle: 'character', hat: 'character', accessory: 'character', hair: 'character', nameplate: 'flair', effect: 'flair', houseStyle: 'mafia', houseDecor: 'mafia', deathAnim: 'mafia', reactions: 'mafia', ghostSkin: 'mafia' };
    const lock = (i) => (m.owned.has(i.id) || i.free ? null : i.pass ? 'Season pass reward (in JustMafia)' : i.world ? 'A JustMafia world reward' : i.achievement ? (C.ACHIEVEMENTS[i.achievement] || {}).label || 'Earn its achievement' : i.requires && !m.owned.has(i.requires) ? 'Own the tier below first' : SSN && SSN.limitedLock(i.id, now()) ? SSN.limitedLock(i.id, now()) : C.STOCKABLE.some((x) => x.id === i.id) && !onShelf(i) ? 'Not on the shelf yet: every game you finish reveals more' : null);
    const state = () => ({ ok: true, name: m.name, claimed: false, gold: m.gold, earned: m.earned, spent: m.spent, look: { ...m.look }, lookSaved: m.lookSaved, home: { ...m.home }, owned: [...m.owned], gear: JSON.parse(JSON.stringify(m.gear)),
      catalog: C.CATALOG.filter((i) => section[i.field]).map((i) => ({ id: i.id, field: i.field, value: i.value, name: i.name, cost: i.cost, free: !!i.free, section: section[i.field], category: i.category, description: i.description, owned: m.owned.has(i.id) || !!i.free, lock: lock(i), ...sale(i.id) })),
      gearCatalog: GEAR.GEAR.map((g) => ({ ...g, owned: m.owned.has(g.id), equipped: !!(m.gear[g.game] && m.gear[g.game][g.slot] === g.id), ...sale(g.id) })),
      ledger: m.ledger.slice(0, 20), busy: params.get('mock') === 'busy', ...(SSN ? SSN.shopExtras(now(), m.owned, m.look) : {}),
      earn: { note: 'Every finished game pays JustGold to everyone with an account who played it (2+ people, 90 s+). Longer games pay more.', base: { play: 4, top: 3, win: 5 }, examples: [{ label: 'A 10-minute game, you played', jg: 3 }, { label: 'A 10-minute game, top half', jg: 6 }, { label: 'A 10-minute game, you won', jg: 10 }, { label: 'A 30-minute game, you won', jg: 30 }], party: { label: 'Finish a whole Party Mode: everyone +25, and +40 / +25 / +15 for the top 3. The fastest way to earn.' }, mafia: 'JustMafia: 4–30 JG a game, weekly challenges and the season pass.', sets: 'Wear a whole theme set (Shop → Sets) in its own game: +5% JustGold there (at least 1, at most 3 a game).' } });
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
        const cost = SSN ? SSN.priceOf(id, now()).cost : it.cost;
        if (m.gold < cost) return wait({ ok: false, error: `Not enough JustGold: ${it.name} costs ${cost} JG.`, state: state() });
        m.gold -= cost; m.spent += cost; m.owned.add(id); m.ledger.unshift({ at: Date.now(), delta: -cost, reason: 'Bought ' + it.name, balance: m.gold });
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
      bundle: (setId, wear) => {
        if (busy()) return wait({ ok: false, busy: true, error: 'You can shop after this game.', state: state() });
        const s = SSN && SSN.setById(setId); if (!s) return wait({ ok: false, error: 'Unknown set.' });
        const b = SSN.bundleOf(setId, m.owned, now());
        if (b.missing.length) { if (m.gold < b.price) return wait({ ok: false, error: `Not enough JustGold: the rest of the ${s.name} set costs ${b.price} JG.`, state: state() }); m.gold -= b.price; m.spent += b.price; b.missing.forEach((id) => m.owned.add(id)); m.ledger.unshift({ at: Date.now(), delta: -b.price, reason: `${s.icon} ${s.name} set`, balance: m.gold }); }
        if (wear) for (const id of s.items) { const it = C.CATALOG.find((i) => i.id === id); if (it) m.look[it.field] = it.value; }
        return wait({ ok: true, items: b.missing, state: state() });
      },
      wearSet: (setId) => { const s = SSN && SSN.setById(setId); if (!s) return wait({ ok: false, error: 'Unknown set.' }); if (s.items.some((id) => !m.owned.has(id))) return wait({ ok: false, error: 'Get the whole set first.', state: state() }); for (const id of s.items) { const it = C.CATALOG.find((i) => i.id === id); m.look[it.field] = it.value; } return wait({ ok: true, state: state() }); },
      look: (look) => { if (busy()) return wait({ ok: false, busy: true, error: 'You can shop after this game.', state: state() }); for (const k of FREE_FIELDS) if (look && typeof look[k] === 'string' && (O[O.AVATAR_FIELDS[k]] || []).includes(look[k])) m.look[k] = look[k]; m.lookSaved = true; return wait({ ok: true, state: state() }); },
    };
  }
  const wantMock = params.has('mock') || typeof window.io !== 'function';
  let API = wantMock ? mockApi() : socketApi();

  // ---------- state ----------
  const START_GAME = (() => { const g = params.get('game'); return g && Object.prototype.hasOwnProperty.call(GAMES, g) ? g : null; })();
  const S = { st: null, trySet: null, tab: START_GAME ? 'gear' : params.get('tab') || 'auto', sub: { character: 'body', flair: 'nameplate', mafia: 'houseStyle' }, game: START_GAME, sel: null, edits: {}, saving: 0, pending: false, say: '', waiting: false, keeperJump: 0, startLook: null };
  const items = () => {
    const st = S.st; if (!st) return [];
    const cat = (st.catalog || []).map((i) => ({ ...i, kind: 'item' }));
    const gear = (st.gearCatalog || []).map((g) => ({ ...g, kind: 'gear', owned: !!g.owned }));
    return cat.concat(gear, gearDefaults());
  };
  function gearDefaults() {
    const st = S.st; if (!st) return [];
    return (GEAR.GAMES_WITH_GEAR || []).map((s) => ({ id: `gear-default:${s.game}:${s.slot}`, kind: 'gear', isDefault: true, game: s.game, slot: s.slot, spot: s.spot || null, name: s.default.name, icon: s.default.icon, desc: s.default.desc, cost: 0, owned: true, value: 'classic', where: s.where,
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
    const ts = !i && S.trySet && setOf(S.trySet); if (ts) for (const id of ts.items) { const p = byId(id); if (p) l[p.field] = p.value; }
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
    const cost = priceNow(i), lim = i.limited && i.limited.onSale ? ` Limited time: only during ${i.limited.name}, ${i.limited.daysLeft} day${i.limited.daysLeft === 1 ? '' : 's'} left!` : '', deal = i.pct ? ` Today’s deal: ${i.pct}% off!` : '';
    if (gold < cost) return `${base}${lim}${deal} It’s ${cost} JG and you have ${gold}. A few more games and it’s yours!`;
    return `${base}${lim}${deal} Only ${cost} JG.`;
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
  function drawHead(g, w, h, l, t = 0.4, wear) { const s = Math.min(h / 50, w / 46); MTArt.drawCharacter(g, w / 2, h + 24 * s, l, { scale: s, t, wear }); }
  function drawBody(g, w, h, l, t = 0.4, wear) { const s = Math.min((h - 6) / 84, w / 44); MTArt.drawCharacter(g, w / 2, h - 3, l, { scale: s, t, wear }); }
  function drawBust(g, w, h, l, t = 0.4, wear) { const s = Math.min(h / 56, w / 48); MTArt.drawCharacter(g, w / 2, h + 10 * s, l, { scale: s, t, wear }); }
  // Game gear worn on the character: the game's equipped wearables, with `tryId` swapped in.
  function wearFor(game, tryItem) {
    if (!game || !GEAR.wearOf) return [];
    const set = {}; const eq = (S.st && S.st.gear && S.st.gear[game]) || {};
    for (const [slot, id] of Object.entries(eq)) { const it = (GEAR.BY_ID && GEAR.BY_ID.get(id)) || null; if (it) set[slot] = it.value; }
    if (tryItem && tryItem.kind === 'gear' && tryItem.game === game) set[tryItem.slot] = tryItem.isDefault ? 'classic' : tryItem.value;
    return GEAR.wearOf(game, set);
  }
  // The game's tile art as a backdrop when you try on gear for it.
  const tileImgs = new Map();
  function tileImg(game) { if (!tileImgs.has(game)) { const im = new Image(); im.src = '/art/tiles/' + encodeURIComponent(game) + '.svg'; tileImgs.set(game, im); } const im = tileImgs.get(game); return im.complete && im.naturalWidth ? im : null; }
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
  // Game gear that isn't worn: draw the real object (a bidding paddle, a card back, a chip stack…)
  // in the item's colours, pattern and emblem, so what you tap is what you get in the game.
  // Balls (marble skins, JustDrop balls) stay balls.
  function paintFill(g, path, cx, cy, r, p, t) {
    const a = p.a || '#8a7fb0', b = p.b || '#4a3f70', c = p.c || '#ffffff';
    g.save();
    if (p.glow) { g.shadowColor = a; g.shadowBlur = r * 0.5; }
    const gr = g.createLinearGradient(cx - r, cy - r, cx + r, cy + r); gr.addColorStop(0, c); gr.addColorStop(0.22, a); gr.addColorStop(1, b);
    g.fillStyle = gr; g.fill(path); g.shadowBlur = 0;
    g.save(); g.clip(path); g.globalAlpha = 0.5; g.fillStyle = b; g.strokeStyle = c;
    const pat = p.pattern || 'plain', x = cx, y = cy;
    if (pat === 'stripes') for (let i = -5; i <= 5; i++) { g.save(); g.translate(x, y); g.rotate(-0.6); g.fillRect(i * r * 0.4, -r * 2, r * 0.18, r * 4); g.restore(); }
    else if (pat === 'dots') { g.fillStyle = c; for (let i = -3; i <= 3; i++) for (let j = -3; j <= 3; j++) { g.beginPath(); g.arc(x + i * r * 0.4 + (j % 2) * r * 0.2, y + j * r * 0.38, r * 0.09, 0, TAU); g.fill(); } }
    else if (pat === 'swirl') { g.lineWidth = r * 0.12; g.beginPath(); for (let k = 0; k < 70; k++) { const a2 = k * 0.22 + t, rad = k / 70 * r * 1.2; g.lineTo(x + Math.cos(a2) * rad, y + Math.sin(a2) * rad); } g.stroke(); }
    else if (pat === 'stars') { g.fillStyle = c; for (let k = 0; k < 8; k++) { const sx = x + Math.cos(k * 2.4) * r * 0.6, sy = y + Math.sin(k * 2.4) * r * 0.7; g.beginPath(); for (let q = 0; q < 10; q++) { const an = -Math.PI / 2 + q * Math.PI / 5, rr = q % 2 ? r * 0.05 : r * 0.12; g.lineTo(sx + Math.cos(an) * rr, sy + Math.sin(an) * rr); } g.fill(); } }
    else if (pat === 'check') for (let i = -4; i < 4; i++) for (let j = -4; j < 4; j++) if ((i + j) & 1) g.fillRect(x + i * r * 0.32, y + j * r * 0.32, r * 0.32, r * 0.32);
    else if (pat === 'flame') { g.fillStyle = c; for (let k = 0; k < 6; k++) { const fx = x - r * 1.2 + k * r * 0.48; g.beginPath(); g.moveTo(fx, y + r * 1.2); g.quadraticCurveTo(fx - r * 0.2, y + r * 0.2, fx + r * 0.25, y - r * 0.5 - Math.sin(t * 4 + k) * r * 0.1); g.quadraticCurveTo(fx + r * 0.5, y + r * 0.2, fx + r * 0.5, y + r * 1.2); g.fill(); } }
    else if (pat === 'wave') { g.lineWidth = r * 0.1; for (let k = -3; k <= 3; k++) { g.beginPath(); for (let q = -14; q <= 14; q++) g.lineTo(x + q * r * 0.1, y + k * r * 0.36 + Math.sin(q * 0.8 + t * 2) * r * 0.08); g.stroke(); } }
    g.restore();
    g.lineWidth = Math.max(2, r * 0.07); g.strokeStyle = ink; g.stroke(path);
    g.restore();
  }
  const rrect = (x, y, w, h, r) => { const p = new Path2D(); if (p.roundRect) p.roundRect(x, y, w, h, r); else p.rect(x, y, w, h); return p; };
  function emblem(g, it, x, y, size) {
    const p = (it && it.paint) || {}, icon = p.icon || (it && it.icon); if (!icon) return;
    g.save(); g.font = `${Math.round(size)}px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(icon, x, y); g.restore();
  }
  const OBJECTS = {
    // JustBid: a wooden handle and a round paddle face with a bidder number.
    paddle(g, x, y, r, it, p, t) {
      g.save(); g.translate(x, y); g.rotate(-0.18);
      const hp = rrect(-r * 0.1, r * 0.05, r * 0.2, r * 0.95, r * 0.08);
      g.fillStyle = '#8a5a2b'; g.fill(hp); g.lineWidth = Math.max(2, r * 0.07); g.strokeStyle = ink; g.stroke(hp);
      const face = new Path2D(); face.ellipse(0, -r * 0.32, r * 0.62, r * 0.66, 0, 0, TAU);
      paintFill(g, face, 0, -r * 0.32, r * 0.66, p, t);
      const disc = new Path2D(); disc.ellipse(0, -r * 0.32, r * 0.34, r * 0.34, 0, 0, TAU);
      g.fillStyle = 'rgba(255,255,255,0.92)'; g.fill(disc); g.lineWidth = Math.max(1.5, r * 0.04); g.strokeStyle = ink; g.stroke(disc);
      g.fillStyle = ink; g.font = `900 ${Math.round(r * 0.4)}px system-ui,sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('7', 0, -r * 0.3);
      g.restore();
    },
    // President: two card backs, fanned.
    cardBack(g, x, y, r, it, p, t) {
      for (const [dx, rot] of [[-r * 0.22, -0.16], [r * 0.2, 0.12]]) {
        g.save(); g.translate(x + dx, y); g.rotate(rot);
        const w = r * 1.05, h = r * 1.5, card = rrect(-w / 2, -h / 2, w, h, r * 0.12);
        g.fillStyle = '#fffaf0'; g.fill(card); g.lineWidth = Math.max(2, r * 0.06); g.strokeStyle = ink; g.stroke(card);
        const inner = rrect(-w / 2 + r * 0.09, -h / 2 + r * 0.09, w - r * 0.18, h - r * 0.18, r * 0.07);
        paintFill(g, inner, 0, 0, r * 0.75, p, t);
        g.restore();
      }
      emblem(g, it, x + r * 0.2, y, r * 0.5);
    },
    // Blackjack: a stack of casino chips with edge spots.
    chips(g, x, y, r, it, p, t) {
      const a = p.a || '#c0392b', c = p.c || '#ffffff';
      for (let k = 3; k >= 0; k--) {
        const cy = y + r * 0.45 - k * r * 0.22;
        const side = rrect(x - r * 0.8, cy - r * 0.02, r * 1.6, r * 0.24, r * 0.1);
        g.fillStyle = k ? (p.b || '#7a1f16') : a; g.fill(side); g.lineWidth = Math.max(1.5, r * 0.05); g.strokeStyle = ink; g.stroke(side);
        g.fillStyle = c; for (let s = -2; s <= 2; s++) g.fillRect(x + s * r * 0.32 - r * 0.06, cy + r * 0.03, r * 0.12, r * 0.14);
      }
      const top = new Path2D(); top.ellipse(x, y - r * 0.24, r * 0.8, r * 0.34, 0, 0, TAU);
      paintFill(g, top, x, y - r * 0.24, r * 0.8, p, t);
      const ring = new Path2D(); ring.ellipse(x, y - r * 0.24, r * 0.5, r * 0.2, 0, 0, TAU);
      g.lineWidth = Math.max(2, r * 0.08); g.setLineDash([r * 0.16, r * 0.12]); g.strokeStyle = c; g.stroke(ring); g.setLineDash([]);
      emblem(g, it, x, y - r * 0.25, r * 0.34);
    },
    // Tune Buzz: a game-show buzzer (a dome on a base).
    buzzer(g, x, y, r, it, p, t) {
      const base = rrect(x - r * 0.85, y + r * 0.1, r * 1.7, r * 0.55, r * 0.16);
      g.fillStyle = '#2d2f3a'; g.fill(base); g.lineWidth = Math.max(2, r * 0.07); g.strokeStyle = ink; g.stroke(base);
      g.fillStyle = '#55586a'; g.fillRect(x - r * 0.7, y + r * 0.18, r * 1.4, r * 0.08);
      const dome = new Path2D(); dome.ellipse(x, y + r * 0.12, r * 0.62, r * 0.6, 0, Math.PI, TAU); dome.closePath();
      paintFill(g, dome, x, y - r * 0.2, r * 0.62, p, t);
      g.save(); g.globalAlpha = 0.55; g.fillStyle = '#fff'; g.beginPath(); g.ellipse(x - r * 0.24, y - r * 0.22, r * 0.14, r * 0.08, -0.5, 0, TAU); g.fill(); g.restore();
      emblem(g, it, x, y - r * 0.12, r * 0.36);
    },
    // JustSketch: a box of coloured pencils.
    pens(g, x, y, r, it, p) {
      const cols = (p.pens && p.pens.length ? p.pens : [p.a || '#e74c3c', p.b || '#3498db', p.c || '#f1c40f', '#2ecc71']).slice(0, 6), n = cols.length;
      cols.forEach((col, k) => {
        const px = x - r * 0.75 + (k + 0.5) * (r * 1.5 / n), top = y - r * 0.75 + (k % 2) * r * 0.12, pw = r * 1.5 / n * 0.7;
        g.fillStyle = col; g.fillRect(px - pw / 2, top + r * 0.22, pw, r * 0.9);
        g.fillStyle = '#f3d7a0'; g.beginPath(); g.moveTo(px - pw / 2, top + r * 0.22); g.lineTo(px, top - r * 0.08); g.lineTo(px + pw / 2, top + r * 0.22); g.closePath(); g.fill();
        g.fillStyle = col; g.beginPath(); g.moveTo(px - pw * 0.18, top + r * 0.02); g.lineTo(px, top - r * 0.08); g.lineTo(px + pw * 0.18, top + r * 0.02); g.closePath(); g.fill();
        g.lineWidth = Math.max(1, r * 0.03); g.strokeStyle = ink; g.strokeRect(px - pw / 2, top + r * 0.22, pw, r * 0.9);
      });
      const box = rrect(x - r * 0.9, y + r * 0.2, r * 1.8, r * 0.6, r * 0.08);
      paintFill(g, box, x, y + r * 0.5, r * 0.9, { ...p, a: p.a || '#3b5bdb', b: p.b || '#1f2f7a', pattern: p.pattern || 'plain' }, 0);
      g.fillStyle = '#fff'; g.font = `900 ${Math.round(r * 0.22)}px system-ui,sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(cols.length + ' COLOURS', x, y + r * 0.5);
    },
    // JustSummon: a flag on a pole.
    banner(g, x, y, r, it, p, t) {
      g.fillStyle = '#6b4a2b'; g.fillRect(x - r * 0.72, y - r * 0.95, r * 0.1, r * 1.9); g.lineWidth = Math.max(1.5, r * 0.05); g.strokeStyle = ink; g.strokeRect(x - r * 0.72, y - r * 0.95, r * 0.1, r * 1.9);
      g.fillStyle = '#e8c35a'; g.beginPath(); g.arc(x - r * 0.67, y - r * 0.98, r * 0.09, 0, TAU); g.fill(); g.stroke();
      const flag = new Path2D(), w = Math.sin(t * 3) * r * 0.06;
      flag.moveTo(x - r * 0.62, y - r * 0.88); flag.quadraticCurveTo(x, y - r * 0.98 + w, x + r * 0.8, y - r * 0.84);
      flag.lineTo(x + r * 0.62, y - r * 0.3); flag.lineTo(x + r * 0.8, y + r * 0.22); flag.quadraticCurveTo(x, y + r * 0.12 - w, x - r * 0.62, y + r * 0.22); flag.closePath();
      paintFill(g, flag, x + r * 0.08, y - r * 0.33, r * 0.75, p, t);
      emblem(g, it, x + r * 0.05, y - r * 0.33, r * 0.5);
    },
    // Meme Maker: a picture frame around a little meme.
    frame(g, x, y, r, it, p, t) {
      const outer = new Path2D(); outer.rect(x - r * 0.9, y - r * 0.75, r * 1.8, r * 1.5); outer.rect(x - r * 0.62, y - r * 0.48, r * 1.24, r * 0.96);
      const sky = g.createLinearGradient(0, y - r * 0.48, 0, y + r * 0.48); sky.addColorStop(0, '#8fd3ff'); sky.addColorStop(1, '#ffe6a8');
      g.fillStyle = sky; g.fillRect(x - r * 0.62, y - r * 0.48, r * 1.24, r * 0.96);
      g.font = `${Math.round(r * 0.5)}px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('😹', x, y + r * 0.05);
      g.fillStyle = '#fff'; g.strokeStyle = ink; g.lineWidth = Math.max(1, r * 0.04); g.font = `900 ${Math.round(r * 0.17)}px Impact,system-ui,sans-serif`; g.strokeText('WHEN THE', x, y - r * 0.33); g.fillText('WHEN THE', x, y - r * 0.33);
      g.save(); g.beginPath(); g.fillStyle = 'transparent'; g.restore();
      const ring = new Path2D(); ring.rect(x - r * 0.9, y - r * 0.75, r * 1.8, r * 1.5); ring.rect(x - r * 0.62, y - r * 0.48, r * 1.24, r * 0.96);
      g.save(); g.beginPath(); g.rect(x - r * 0.9, y - r * 0.75, r * 1.8, r * 1.5); g.rect(x + r * 0.62, y - r * 0.48, -r * 1.24, r * 0.96); g.clip();
      paintFill(g, ring, x, y, r * 0.9, p, t); g.restore();
      g.lineWidth = Math.max(2, r * 0.06); g.strokeStyle = ink; g.strokeRect(x - r * 0.9, y - r * 0.75, r * 1.8, r * 1.5); g.strokeRect(x - r * 0.62, y - r * 0.48, r * 1.24, r * 0.96);
      emblem(g, it, x + r * 0.76, y - r * 0.62, r * 0.28);
    },
    // Color Match: an easel with a framed canvas.
    easel(g, x, y, r, it, p, t) {
      g.strokeStyle = '#7a5230'; g.lineWidth = r * 0.1; g.lineCap = 'round';
      g.beginPath(); g.moveTo(x - r * 0.55, y + r * 0.95); g.lineTo(x - r * 0.1, y - r * 0.9); g.moveTo(x + r * 0.55, y + r * 0.95); g.lineTo(x + r * 0.1, y - r * 0.9); g.moveTo(x, y - r * 0.9); g.lineTo(x, y + r * 0.95); g.stroke();
      const ring = new Path2D(); ring.rect(x - r * 0.72, y - r * 0.7, r * 1.44, r * 1.1);
      paintFill(g, ring, x, y - r * 0.15, r * 0.72, p, t);
      g.fillStyle = '#fffaf0'; g.fillRect(x - r * 0.54, y - r * 0.52, r * 1.08, r * 0.74);
      const blob = g.createRadialGradient(x - r * 0.1, y - r * 0.2, r * 0.05, x, y - r * 0.15, r * 0.4); blob.addColorStop(0, '#ff8a5c'); blob.addColorStop(1, '#7a4dff');
      g.fillStyle = blob; g.beginPath(); g.arc(x, y - r * 0.15, r * 0.28, 0, TAU); g.fill();
      g.lineWidth = Math.max(1.5, r * 0.04); g.strokeStyle = ink; g.strokeRect(x - r * 0.54, y - r * 0.52, r * 1.08, r * 0.74);
      g.fillStyle = '#7a5230'; g.fillRect(x - r * 0.8, y + r * 0.4, r * 1.6, r * 0.1);
    },
    // Hot Take Trivia: a quiz podium with a light strip.
    podium(g, x, y, r, it, p, t) {
      const body = new Path2D(); body.moveTo(x - r * 0.7, y - r * 0.4); body.lineTo(x + r * 0.7, y - r * 0.4); body.lineTo(x + r * 0.55, y + r * 0.95); body.lineTo(x - r * 0.55, y + r * 0.95); body.closePath();
      g.fillStyle = '#2b2440'; g.fill(body); g.lineWidth = Math.max(2, r * 0.06); g.strokeStyle = ink; g.stroke(body);
      const top = rrect(x - r * 0.85, y - r * 0.62, r * 1.7, r * 0.28, r * 0.08);
      paintFill(g, top, x, y - r * 0.48, r * 0.85, p, t);
      const strip = rrect(x - r * 0.55, y - r * 0.15, r * 1.1, r * 0.5, r * 0.1);
      paintFill(g, strip, x, y + r * 0.1, r * 0.55, { ...p, glow: true }, t);
      for (let k = 0; k < 5; k++) { const on = Math.sin(t * 5 + k) > 0; g.fillStyle = on ? (p.c || '#fff') : 'rgba(255,255,255,0.3)'; g.beginPath(); g.arc(x - r * 0.4 + k * r * 0.2, y + r * 0.62, r * 0.06, 0, TAU); g.fill(); }
      emblem(g, it, x, y + r * 0.1, r * 0.3);
    },
    // JustKingdoms: a heraldic shield.
    crest(g, x, y, r, it, p, t) {
      const sh = new Path2D(); sh.moveTo(x - r * 0.75, y - r * 0.8); sh.lineTo(x + r * 0.75, y - r * 0.8); sh.lineTo(x + r * 0.75, y - r * 0.05);
      sh.quadraticCurveTo(x + r * 0.7, y + r * 0.65, x, y + r * 0.95); sh.quadraticCurveTo(x - r * 0.7, y + r * 0.65, x - r * 0.75, y - r * 0.05); sh.closePath();
      paintFill(g, sh, x, y, r * 0.85, p, t);
      g.save(); g.clip(sh); g.lineWidth = r * 0.1; g.strokeStyle = 'rgba(255,255,255,0.35)'; g.stroke(sh); g.restore();
      emblem(g, it, x, y + r * 0.02, r * 0.7);
    },
  };
  function drawObject(g, x, y, r, it, t = 0) {
    const fn = it && OBJECTS[it.slot];
    if (!fn) return drawToken(g, x, y, r * 0.95, it, t); // marble skins, JustDrop balls: real balls
    // The free defaults look like what the game shows without gear; crests get a heraldic shield.
    const DEF = { paddle: { a: '#d9b27a', b: '#8a5a2b', c: '#f6e2bf' }, cardBack: { a: '#b0243a', b: '#5a0f1e', c: '#e8a0a8', pattern: 'check' }, chips: { a: '#c0392b', b: '#7a1f16' }, buzzer: { a: '#e8323c', b: '#8a1010' }, banner: { a: '#d8d4c8', b: '#8a8578' }, frame: { a: '#f4f4f4', b: '#cfcfcf' }, easel: { a: '#ffffff', b: '#d8d2c4' }, podium: { a: '#ffd23a', b: '#c99a00' }, crest: { a: '#e9dcb8', b: '#a8884f', c: '#fff8e6' } };
    const base = it.slot === 'crest' ? DEF.crest : {};
    const p = it.isDefault ? (DEF[it.slot] || {}) : { ...base, ...((it && it.paint) || {}) };
    g.save(); fn(g, x, y, r, it, p, t); g.restore();
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
    if (i.kind === 'gear') {
      if (i.spot) { const wear = wearFor(i.game, i); if (i.spot === 'head' || i.spot === 'face') drawHead(g, w, h, l, 0.4, wear); else if (i.spot === 'back') drawBody(g, w, h, l, 0.4, wear); else drawBust(g, w, h, l, 0.4, wear); return; }
      drawObject(g, w / 2, h / 2 + 2, Math.min(w, h) * 0.4, i, 0.6); return;
    }
    const L = { ...l, [i.field]: i.value };
    switch (i.field) {
      case 'houseStyle': drawHouse(g, w / 2, h - 6, h / 95, i.value, (S.st.home || {}).decor, 1); return;
      case 'houseDecor': drawHouse(g, w / 2, h - 6, h / 95, (S.st.home || {}).style || 'cottage', i.value, 1); return;
      case 'deathAnim': g.fillStyle = '#1d2236'; g.fillRect(0, 0, w, h); drawDeath(g, w / 2, h * 0.86, h / 100, l, i.value, 2.2); return;
      case 'ghostSkin': g.fillStyle = '#1d2236'; g.fillRect(0, 0, w, h); MTArt.drawGhost(g, w / 2, h - 6, { ...l, ghostSkin: i.value }, { scale: h / 92, t: 1.2, glow: true }); return;
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
    const s = Math.max(1.2, Math.min((floorY - 60) / 84, w / 95));
    // Gear for one game: that game's picture behind you, and you wearing its gear.
    const gearGame = i && i.kind === 'gear' ? i.game : S.tab === 'gear' && S.game && S.game !== 'mafia' ? S.game : null;
    const wear = gearGame ? wearFor(gearGame, i) : [];
    if (gearGame) { const im = tileImg(gearGame); if (im) { const top = 50, bh = floorY - top - 4, bw = Math.min(w * 0.62, bh * 1.5), bx = Math.max(6, cx - bw / 2), sc = Math.max(bw / 400, bh / 240), iw = 400 * sc, ih = 240 * sc; g.save(); g.beginPath(); if (g.roundRect) g.roundRect(bx, top, bw, bh, 16); else g.rect(bx, top, bw, bh); g.clip(); g.globalAlpha = 0.85; g.drawImage(im, bx + (bw - iw) / 2, top + (bh - ih) / 2, iw, ih); g.restore(); g.save(); g.lineWidth = 3; g.strokeStyle = ink; g.beginPath(); if (g.roundRect) g.roundRect(bx, top, bw, bh, 16); else g.rect(bx, top, bw, bh); g.stroke(); g.restore(); } }
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
    else MTArt.drawCharacter(g, cx, floorY - 2, l, { scale: s, t, seed: 1, wear, jump: S.happy && S.happy > t ? Math.abs(Math.sin((S.happy - t) * 8)) * 8 * s : 0 });
    if (i && i.kind === 'item' && i.field === 'ghostSkin') MTArt.drawGhost(g, w * (wide ? 0.6 : 0.6), floorY - 6, { ...l, ghostSkin: i.value }, { scale: s * 0.62, t, glow: true });
    if (i && i.kind === 'item' && i.field === 'reactions') {
      const pack = (O.REACTION_PACKS || {})[i.value] || [];
      g.save(); g.textAlign = 'center'; g.textBaseline = 'middle';
      pack.forEach((e, k) => { const p = (t * 0.35 + k / pack.length) % 1; g.globalAlpha = p < 0.8 ? 1 : (1 - p) * 5; g.font = `${Math.round(16 * s * 0.7 * (0.8 + p * 0.4))}px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif`; g.fillText(e, cx + Math.sin(k * 2.1 + t) * 26 * s * 0.6, floorY - 70 * s - p * 40); });
      g.restore();
    }
    if (i && i.kind === 'gear' && !i.spot) {
      const gx = w * (wide ? 0.62 : 0.6), gy = floorY - 34 * s * 0.8 + Math.sin(t * 2) * 4;
      g.save(); g.fillStyle = 'rgba(0,0,0,0.2)'; g.beginPath(); g.ellipse(gx, floorY, 18 * s * 0.6, 4 * s * 0.6, 0, 0, TAU); g.fill(); g.restore();
      drawObject(g, gx, gy, 22 * s * 0.75, i, t);
    }
  }

  // ---------- render ----------
  const sectionOf = (i) => (i.kind === 'gear' ? 'gear' : i.section);
  function cardHTML(i) {
    const own = i.owned, wear = wearing(i), cost = priceNow(i), poor = !own && !i.lock && S.st.gold < cost;
    const badge = wear ? '<em class="badge eq">✓ On</em>' : own ? (i.free || i.isDefault ? '<em class="badge own">Free</em>' : '<em class="badge own">Owned</em>') : i.lock ? '<em class="badge lock">🔒</em>' : `<em class="badge${poor ? ' poor' : ''}${i.pct ? ' deal' : ''}">${COIN}${cost}${i.pct ? `<s>${esc(i.cost)}</s>` : ''}</em>`;
    const rib = ribbon(i);
    let art = '<canvas aria-hidden="true"></canvas>';
    if (i.field === 'reactions') art = `<div class="emo" aria-hidden="true">${((O.REACTION_PACKS || {})[i.value] || []).map((e) => `<span>${esc(e)}</span>`).join('')}</div>`;
    if (i.field === 'nameplate') art = `<div class="np" aria-hidden="true"><span class="np-${esc(i.value)}" style="color:${esc(look().nameColor || '#fff')}">${esc(S.st.name || 'You')}</span></div>`;
    return `<button class="card${i.id === S.sel ? ' sel' : ''}${i.lock && !own ? ' locked' : ''}${wear ? ' wearing' : ''}${i.limited ? ' limited' : ''}" data-item="${esc(i.id)}" aria-pressed="${i.id === S.sel}" aria-label="${esc(i.name)}">${art}<b>${esc(i.name)}</b>${badge}${rib}</button>`;
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
    const TABS = tabsNow();
    if (S.tab === 'auto') S.tab = st.event && st.lookSaved ? 'event' : 'character';
    if (!TABS.some((s) => s.id === S.tab)) S.tab = 'character';
    const ev = st.event, evStyle = ev ? ` style="--ev-a:${esc(ev.theme.a)};--ev-b:${esc(ev.theme.b)};--ev-c:${esc(ev.theme.c)}"` : '';
    $('#tabs').innerHTML = TABS.map((s) => `<button class="tab${s.id === S.tab ? ' on' : ''}${s.id === 'event' ? ' ev' : ''}" role="tab" aria-selected="${s.id === S.tab}" data-tab="${s.id}"${s.id === 'event' ? evStyle : ''}><span aria-hidden="true">${s.icon}</span>${esc(s.label)}${s.dot ? '<i class="dot"></i>' : ''}</button>`).join('');
    const sec = TABS.find((s) => s.id === S.tab);
    const subs = sec.subs ? sec.subs : null;
    $('#subs').hidden = !subs && !(S.tab === 'gear' && S.game);
    const mafiaChips = () => MAFIA_SUBS.map(([k, ic, lb]) => { const n = ITEMS.filter((i) => i.field === k && i.owned).length; return `<button class="chip${S.sub.mafia === k ? ' on' : ''}" data-msub="${k}">${ic} ${esc(lb)} <small>${n}</small></button>`; }).join('');
    if (subs) {
      $('#subs').innerHTML = subs.map(([k, ic, lb]) => { const n = k === 'colours' || k === 'body' ? '' : ITEMS.filter((i) => i.field === k && i.owned).length; return `<button class="chip${S.sub[S.tab] === k ? ' on' : ''}" data-sub="${k}">${ic} ${esc(lb)}${n !== '' ? ` <small>${n}</small>` : ''}</button>`; }).join('');
    } else if (S.tab === 'gear' && S.game) $('#subs').innerHTML = '<button class="chip" data-games="1">‹ All games</button>' + (S.game === 'mafia' ? mafiaChips() : `<button class="chip on">${esc(gameIcon(S.game))} ${esc(gameName(S.game))}</button>`);
    // shelf
    const shelf = $('#shelf'); let html = '';
    if (S.tab === 'character' && S.sub.character === 'colours') html = coloursHTML();
    else if (S.tab === 'character' && S.sub.character === 'body') html = bodyHTML();
    else if (S.tab === 'character' || S.tab === 'flair' || (S.tab === 'gear' && S.game === 'mafia')) {
      const key = S.tab === 'gear' ? 'mafia' : S.tab, field = S.sub[key], list = sorted(ITEMS.filter((i) => i.kind === 'item' && i.field === field));
      if (key === 'mafia') html += `<div class="gear-head"><img src="/art/tiles/mafia.svg" alt="" onerror="this.style.visibility='hidden'"><div><h3>🔪 JustMafia</h3><p>Your house in town, how you go out, your reactions and your ghost.</p></div></div>`;
      if (key === 'mafia') html += '<p class="note">🔪 These are for <b>JustMafia</b>: your house, how you go out, your reactions and your ghost. 🎟 <b>Season pass & ✦ Fate live in JustMafia</b> (Season & unlocks).</p>';
      if (S.tab === 'flair') html += '<p class="note">✨ Flair shows in <b>every game</b>: your nameplate on the big screen and an effect around your character.</p>';
      html += list.length ? `<div class="grid">${list.map(cardHTML).join('')}</div>` : '<p class="empty">Nothing here yet.</p>';
    } else if (S.tab === 'gear') html = gearHTML();
    else if (S.tab === 'event') html = eventHTML();
    else if (S.tab === 'deals') html = dealsHTML();
    else if (S.tab === 'sets') html = setsHTML();
    else if (S.tab === 'wardrobe') html = wardrobeHTML();
    else if (S.tab === 'earn') html = earnHTML();
    shelf.innerHTML = html;
    requestAnimationFrame(paintShelf);
    for (const nav of [$('#tabs'), $('#subs')]) { const on = nav.querySelector('.on'); if (!on) continue; const nr = nav.getBoundingClientRect(), r = on.getBoundingClientRect(); if (r.left < nr.left || r.right > nr.right) nav.scrollLeft += r.left - nr.left - 14; }
    renderStageText(); renderAct();
  }
  function paintShelf() {
    for (const b of document.querySelectorAll('#shelf [data-item]')) { const cv = b.querySelector('canvas'), i = byId(b.dataset.item); if (cv && i) try { paintCard(cv, i); } catch (e) { /* skip */ } }
    for (const b of document.querySelectorAll('#shelf [data-setcv]')) { const cv = b.querySelector('canvas') || b, s = setOf(b.dataset.setcv); if (!s) continue; const [g, w, h] = fit(cv), L = { ...look() }; for (const id of s.items) { const p = byId(id); if (p) L[p.field] = p.value; } drawBody(g, w, h, L, 1.2); }
    for (const b of document.querySelectorAll('#shelf [data-opt]')) { const cv = b.querySelector('canvas'); if (!cv) continue; const [g, w, h] = fit(cv), L = { ...look(), [b.dataset.field]: b.dataset.opt }; if (b.dataset.full) { if (b.dataset.field === 'body') Object.assign(L, bodyHair(L, b.dataset.opt)); drawBody(g, w, h, L); } else drawHead(g, w, h, L); }
  }
  // Body type: female or male (free), the first choice for a new character.
  function bodyHTML() {
    const l = look(), cur = l.body || (O.inferBody ? O.inferBody(l) : 'male');
    return '<p class="note">🧍 Pick your body. It shows in <b>every game</b>, and everything you wear fits it. Free to change.</p><div class="bodies">' +
      (O.body || ['male', 'female']).slice().reverse().map((v) => `<button class="opt body-opt${cur === v ? ' on' : ''}" data-field="body" data-val="${esc(v)}" data-opt="${esc(v)}" data-full="1" aria-pressed="${cur === v}"><canvas aria-hidden="true"></canvas>${esc(O.label(v))}</button>`).join('') + '</div>';
  }
  function coloursHTML() {
    const l = look();
    const sw = (field, label) => `<h3 class="sec-h">${esc(label)}</h3><div class="swatches">${(O[O.AVATAR_FIELDS[field]] || []).map((c) => `<button class="sw${l[field] === c ? ' on' : ''}" style="background:${esc(c)}" data-field="${field}" data-val="${esc(c)}" aria-label="${esc(O.label(c))}" aria-pressed="${l[field] === c}"></button>`).join('')}</div>`;
    const op = (field, label) => `<h3 class="sec-h">${esc(label)}</h3><div class="opts">${(O[O.AVATAR_FIELDS[field]] || []).map((v) => `<button class="opt${l[field] === v ? ' on' : ''}" data-field="${field}" data-val="${esc(v)}" data-opt="${esc(v)}" aria-pressed="${l[field] === v}"><canvas aria-hidden="true"></canvas>${esc(O.label(v))}</button>`).join('')}</div>`;
    return '<p class="note">🎨 Colours and faces are <b>free</b>. Tap to change; it saves by itself.</p>' + sw('skin', 'Skin') + op('expression', 'Expression') + sw('hairColor', 'Hair colour') + sw('eyes', 'Eyes') + sw('color', 'Clothes colour') + sw('pants', 'Trousers') + sw('shoes', 'Shoe colour') + op('face', 'Face shape') + op('facialHair', 'Facial hair') + op('features', 'Freckles & cheeks') + sw('nameColor', 'Name colour');
  }
  function gearHTML() {
    const games = (GEAR.GAMES_WITH_GEAR || []).map((s) => s.game).filter((g, k, a) => a.indexOf(g) === k);
    if (!S.game || !(games.includes(S.game) || S.game === 'mafia')) {
      const mafiaList = ITEMS.filter((i) => i.kind === 'item' && i.section === 'mafia' && !i.free), mafiaHave = mafiaList.filter((i) => i.owned).length;
      const mafiaTile = `<button class="game" data-game="mafia"><img src="/art/tiles/mafia.svg" alt="" loading="lazy" onerror="this.style.visibility='hidden'"><span class="gi">🔪 JustMafia<small>Houses · Farewells · Ghosts</small></span><span class="count${mafiaHave ? ' has' : ''}">${mafiaHave}/${mafiaList.length}</span></button>`;
      return '<p class="note">🎮 Gear is <b>per game</b>: your character wears it in that game: a cowboy hat in Quick Draw, a dealer visor at Blackjack, a chef’s hat in the kitchen… plus a few things for the game itself, like marble skins. Pick a game.</p><div class="games">' + mafiaTile + games.map((k) => {
        const list = ITEMS.filter((i) => i.kind === 'gear' && i.game === k && !i.isDefault), have = list.filter((i) => i.owned).length;
        const slot = GEAR.GAMES_WITH_GEAR.filter((s) => s.game === k).map((s) => s.label).slice(0, 3).join(' · ') || 'Gear';
        return `<button class="game" data-game="${esc(k)}"><img src="/art/tiles/${encodeURIComponent(k)}.svg" alt="" loading="lazy" onerror="this.style.visibility='hidden'"><span class="gi">${esc(gameIcon(k))} ${esc(gameName(k))}<small>${esc(slot)}</small></span><span class="count${have ? ' has' : ''}">${have}/${list.length}</span></button>`;
      }).join('') + '</div>';
    }
    const k = S.game, slots = GEAR.GAMES_WITH_GEAR.filter((s) => s.game === k);
    return `<div class="gear-head"><img src="/art/tiles/${encodeURIComponent(k)}.svg" alt="" onerror="this.style.visibility='hidden'"><div><h3>${esc(gameIcon(k))} ${esc(gameName(k))}</h3><p>Your character wears these in ${esc(gameName(k))}.</p></div></div>` +
      slots.map((s) => `<h3 class="sec-h">${esc(s.label)} <small>${s.spot ? 'worn by you' : 'in the game'}</small></h3><div class="grid">${sorted(ITEMS.filter((i) => i.kind === 'gear' && i.game === k && i.slot === s.slot)).map(cardHTML).join('')}</div>`).join('');
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
      ${e.party ? `<div class="row party"><span>🎉 ${esc(e.party.label)}</span></div>` : ''}${e.sets ? `<div class="row"><span>🧩 ${esc(e.sets)}</span></div>` : ''}${e.mafia ? `<div class="row"><span>🔪 ${esc(e.mafia)}</span></div>` : ''}</div>
      <h3 class="sec-h">📜 Your ledger <small>where every coin came from</small></h3>${led ? `<ul class="ledger">${led}</ul>` : '<p class="empty">No JustGold yet. Finish a game with friends to earn some!</p>'}`;
  }
  function renderStageText() {
    const st = S.st, i = byId(S.sel), l = look();
    const tag = $('#tag');
    if (i) { tag.hidden = false; tag.innerHTML = `${wearing(i) ? 'Wearing' : i.owned ? 'Yours' : 'Trying on'}<b>${esc(i.name)}</b>`; }
    else if (S.trySet && setOf(S.trySet)) { const ts = setOf(S.trySet); tag.hidden = false; tag.innerHTML = `${ts.worn ? 'Wearing' : 'Trying on'}<b>${esc(ts.icon)} ${esc(ts.name)}</b>`; }
    else if (!st.lookSaved) { tag.hidden = false; tag.innerHTML = 'This is you!<b>Make it yours</b>'; }
    else tag.hidden = true;
    const plate = $('#plate'), np = i && i.field === 'nameplate' ? i.value : l.nameplate || 'plain';
    plate.className = 'plate np-' + (O.nameplate.includes(np) ? np : 'plain');
    plate.style.color = /^#[0-9a-f]{6}$/i.test(l.nameColor || '') ? l.nameColor : '#fff';
    const ws = !i && !S.trySet && (st.sets || []).find((x) => x.worn);
    plate.textContent = (ws ? ws.icon + ' ' : '') + (st.name || 'You');
    plate.classList.toggle('set-on', !!ws); if (ws) plate.style.setProperty('--set', ws.color || '#ffd23f');
    say(i ? pitchOf(i) : S.trySet && setOf(S.trySet) ? setPitch(setOf(S.trySet)) : S.say || (st.busy ? 'Busy playing? Have a look around. I’ll hold everything for you.' : pick(HELLO, String(st.name || 'x'))));
  }
  function renderAct() {
    const a = $('#act'), st = S.st, i = byId(S.sel);
    let html = '';
    if (i) {
      const wear = wearing(i), cost = priceNow(i), left = st.gold - cost;
      let sub = '', btns = '';
      if (st.busy) { sub = '<small class="warn">You can shop after this game.</small>'; btns = '<button class="btn" disabled>🔒 After this game</button>'; }
      else if (wear) { sub = '<small>You’re wearing it in every game.</small>'; btns = i.isDefault || (i.kind === 'item' && (O[O.AVATAR_FIELDS[i.field]] || O[O.HOME_FIELDS[HOME[i.field]]] || [])[0] === i.value) ? '<button class="btn ghost" data-act="close">Done</button>' : '<button class="btn ghost" data-act="off">Take off</button>'; }
      else if (i.owned) { sub = `<small>${i.free || i.isDefault ? 'Free for everyone.' : 'In your wardrobe.'}</small>`; btns = '<button class="btn" data-act="wear">👕 Wear</button>'; }
      else if (i.lock) { sub = `<small class="warn">🔒 ${esc(i.lock)}</small>`; btns = '<button class="btn ghost" data-act="close">OK</button>'; }
      else if (left < 0) { sub = `<small class="warn">${COIN} ${esc(cost)} JG · you need ${esc(-left)} more</small>`; btns = '<button class="btn gold" data-act="earn">🪙 Earn JG</button>'; }
      else { sub = `<small>${i.pct ? `<s>${esc(i.cost)}</s> ` : ''}${COIN} ${esc(cost)} JG${i.pct ? ` (−${esc(i.pct)}% today)` : ''}${i.limited ? ` · ⏳ ${esc(i.limited.daysLeft)} day${i.limited.daysLeft === 1 ? '' : 's'} left` : ''} · you’d have <b>${esc(left)}</b> left</small>`; btns = `<button class="btn gold" data-act="buy">Buy ${COIN} ${esc(cost)}</button>`; }
      html = `<div class="what"><b>${esc(i.name)}</b>${sub}</div>${btns}`;
    } else if (S.trySet && setOf(S.trySet)) {
      const s = setOf(S.trySet), b = s.bundle || { missing: [], price: 0 }, left = st.gold - b.price;
      if (st.busy) html = `<div class="what"><b>${esc(s.icon)} ${esc(s.name)}</b><small class="warn">You can shop after this game.</small></div><button class="btn" disabled>🔒 After this game</button>`;
      else if (s.worn) html = `<div class="what"><b>${esc(s.icon)} ${esc(s.name)} ✓</b><small>Wearing the whole set: +${esc(st.setRules.bonusPct)}% JG in ${esc(gameName(s.game))}.</small></div><button class="btn ghost" data-act="close">Done</button>`;
      else if (!b.missing.length) html = `<div class="what"><b>${esc(s.icon)} ${esc(s.name)}</b><small>You own every piece.</small></div><button class="btn" data-setwear="${esc(s.id)}">👕 Wear set</button>`;
      else if (left < 0) html = `<div class="what"><b>${esc(s.icon)} ${esc(s.name)}</b><small class="warn">${COIN} ${esc(b.price)} JG for the rest · you need ${esc(-left)} more</small></div><button class="btn gold" data-act="earn">🪙 Earn JG</button>`;
      else html = `<div class="what"><b>${esc(s.icon)} ${esc(s.name)}</b><small><s>${esc(b.full)}</s> ${COIN} ${esc(b.price)} JG for ${b.missing.length} piece${b.missing.length > 1 ? 's' : ''} (−${esc(b.pct)}%)</small></div><button class="btn gold" data-setbuy="${esc(s.id)}">Buy set ${COIN} ${esc(b.price)}</button>`;
    } else if (!st.lookSaved && !st.busy) html = '<div class="what"><b>This is you!</b><small>Pick colours, a face and clothes. Then save.</small></div><button class="btn" data-act="save">✓ Save my character</button>';
    else if (S.saving || S.pending) html = '<div class="what"><b>Saving your look…</b><small>It shows in every game.</small></div>';
    a.innerHTML = html; a.classList.toggle('off', !html);
    a.querySelectorAll('button').forEach((b) => { if (S.inflight && b.dataset.act !== 'close') b.disabled = true; });
  }

  // ---------- shop seasons, daily deals and theme sets (public/shared/shop-season.js) ----------
  // Tabs: the running event first (in its colours), today's deals, then the usual shelves, and Sets.
  function tabsNow() {
    const st = S.st, ev = st && st.event, out = [];
    if (ev) out.push({ id: 'event', icon: ev.icon, label: ev.name, dot: ITEMS.some((i) => i.limited && i.limited.onSale && !i.owned) });
    if (st && st.deals) out.push({ id: 'deals', icon: '🏷️', label: 'Deals' });
    out.push(...SECTIONS.slice(0, 3));
    if (st && st.sets) out.push({ id: 'sets', icon: '🧩', label: 'Sets' });
    return out.concat(SECTIONS.slice(3));
  }
  const priceNow = (i) => (i && i.price != null ? i.price : i ? i.cost : 0);
  const setOf = (id) => ((S.st && S.st.sets) || []).find((s) => s.id === id) || null;
  const serverNow = () => Date.now() + (S.clockSkew || 0);
  function untilText(t) {
    const ms = Math.max(0, t - serverNow()), h = Math.floor(ms / 3.6e6), m = Math.floor(ms / 6e4) % 60, d = Math.ceil(ms / 864e5); // whole days, like the LIMITED ribbons
    return d >= 2 ? `${d} days` : h >= 1 ? `${h} h ${m} min` : `${Math.max(1, m)} min`;
  }
  const until = (t, pre = '') => `<span data-until="${esc(t)}" data-pre="${esc(pre)}">${esc(pre + untilText(t))}</span>`;
  setInterval(() => { for (const el of document.querySelectorAll('[data-until]')) el.textContent = el.dataset.pre + untilText(+el.dataset.until); }, 20000);
  // Little corner ribbons: LIMITED (event), today's discount, the set a piece belongs to.
  function ribbon(i) {
    if (i.limited && i.limited.onSale) return `<span class="rib lim">⏳ ${esc(i.limited.daysLeft)}d</span>`;
    if (i.limited && !i.owned) return `<span class="rib lim off">${esc(i.limited.icon)}</span>`;
    if (i.pct && !i.owned) return `<span class="rib deal">−${esc(i.pct)}%</span>`;
    if (i.set && !S.inSetCard) { const s = setOf(i.set); return s ? `<span class="rib rset" title="${esc(s.name)} set">${esc(s.icon)}</span>` : ''; }
    return '';
  }
  const setPitch = (s) => s ? `The ${s.name} set! ${s.blurb} Wear all ${s.total} pieces in ${gameName(s.game)} and earn +${S.st.setRules.bonusPct}% JustGold there.` : '';
  // Event: the running event's banner, its limited items, and what comes next.
  function eventHTML() {
    const ev = S.st.event; if (!ev) return '<p class="empty">No event right now.</p>';
    const list = sorted(ITEMS.filter((i) => i.limited && i.limited.onSale)), have = list.filter((i) => i.owned).length, nx = S.st.nextEvent;
    return `<div class="ev-banner" style="--ev-a:${esc(ev.theme.a)};--ev-b:${esc(ev.theme.b)};--ev-c:${esc(ev.theme.c)}"><span class="ev-ic" aria-hidden="true">${esc(ev.icon)}</span><div><h3>${esc(ev.name)}</h3><p>${esc(ev.blurb)}</p>` +
      `<div class="ev-meta"><em class="pill lim">LIMITED · ${until(ev.endsAt, '')} left</em><em class="pill">${have}/${list.length} collected</em></div></div></div>` +
      '<p class="note">⏳ <b>Limited time:</b> these are sold only while the event runs. Everything you buy stays yours, and they come back next year.</p>' +
      (list.length ? `<div class="grid">${list.map(cardHTML).join('')}</div>` : '<p class="empty">Nothing here yet.</p>') +
      (nx ? `<p class="note soon">${esc(nx.icon)} Next: <b>${esc(nx.name)}</b> in ${esc(nx.daysUntil)} day${nx.daysUntil === 1 ? '' : 's'}, with its own limited items.</p>` : '');
  }
  // Deals: six items for everyone today (two of them discounted) and the week's spotlight set.
  function dealsHTML() {
    const d = S.st.deals, list = d.items.map((x) => byId(x.id)).filter(Boolean), sp = setOf(d.spotlight.set), ev = S.st.event, nx = S.st.nextEvent;
    const hot = list.filter((i) => i.pct), rest = list.filter((i) => !i.pct);
    return `<div class="deal-head"><div><h3>🏷️ Daily deals</h3><p>The same for everyone · new items in ${until(d.endsAt)}</p></div><span class="clock" aria-hidden="true">⏰</span></div>` +
      (hot.length ? `<h3 class="sec-h">🔥 On sale today <small>these prices end at midnight (UTC)</small></h3><div class="grid deals">${hot.map(cardHTML).join('')}</div>` : '') +
      `<h3 class="sec-h">✨ Featured <small>for everyone today, shelf or not</small></h3><div class="grid">${rest.map(cardHTML).join('')}</div>` +
      (sp ? `<h3 class="sec-h">🌟 Weekly spotlight <small>new set in ${until(d.spotlight.endsAt)}</small></h3>${setCardHTML(sp)}` : '') +
      (ev ? `<button class="ev-mini" data-jump="event" style="--ev-a:${esc(ev.theme.a)};--ev-b:${esc(ev.theme.b)};--ev-c:${esc(ev.theme.c)}">${esc(ev.icon)} <b>${esc(ev.name)}</b> is on: limited items, ${esc(ev.daysLeft)} day${ev.daysLeft === 1 ? '' : 's'} left ›</button>` : nx ? `<p class="note soon">${esc(nx.icon)} Next event: <b>${esc(nx.name)}</b> in ${esc(nx.daysUntil)} days.</p>` : '');
  }
  // One theme set: who wears it, progress, the pieces, the bundle and the bonus.
  function setCardHTML(s) {
    const b = s.bundle || { missing: [], price: 0, full: 0, pct: 0 }, pieces = s.items.map(byId).filter(Boolean), done = !b.missing.length, R = S.st.setRules;
    const btn = S.st.busy ? '' : s.worn ? '<em class="pill ok">✓ Wearing</em>' : done ? `<button class="btn sm" data-setwear="${esc(s.id)}">👕 Wear set</button>` : `<button class="btn sm gold" data-setbuy="${esc(s.id)}"${S.st.gold < b.price ? ' disabled' : ''}>Buy the rest ${COIN} ${esc(b.price)}</button>`;
    return `<section class="set${s.worn ? ' worn' : ''}${s.spotlight ? ' spot' : ''}${S.trySet === s.id ? ' trying' : ''}" style="--set:${esc(s.color || '#ffd23f')}">` +
      `<button class="set-fig" data-settry="${esc(s.id)}" data-setcv="${esc(s.id)}" aria-label="Try on the ${esc(s.name)} set"><canvas aria-hidden="true"></canvas><small>${S.trySet === s.id ? 'Trying on' : 'Try on'}</small></button>` +
      `<div class="set-info"><h4>${esc(s.icon)} ${esc(s.name)}${s.spotlight ? ' <em class="pill spot">🌟 Spotlight −' + esc(b.pct || R.spotlightOff) + '%</em>' : ''}</h4><p>${esc(s.blurb)}</p>` +
      `<div class="prog" role="progressbar" aria-valuemin="0" aria-valuemax="${s.total}" aria-valuenow="${s.have}"><i style="width:${Math.round(100 * s.have / s.total)}%"></i><span>${s.have}/${s.total} owned</span></div>` +
      `<p class="bonus">🎁 Full set: +${esc(R.bonusPct)}% JG in ${esc(gameIcon(s.game))} ${esc(gameName(s.game))} and a ${esc(s.icon)} nameplate</p>` +
      `<div class="set-buy">${done ? '' : `<span class="was"><s>${esc(b.full)}</s> −${esc(b.pct)}%</span>`}${btn}</div></div>` +
      `<div class="grid set-grid">${pieceCards(pieces)}</div></section>`;
  }
  const pieceCards = (list) => { S.inSetCard = true; try { return list.map(cardHTML).join(''); } finally { S.inSetCard = false; } };
  function setsHTML() {
    const sets = (S.st.sets || []).slice().sort((a, b) => (b.worn - a.worn) || (b.spotlight - a.spotlight) || (b.have / b.total - a.have / a.total));
    return `<p class="note">🧩 <b>Theme sets</b>: a whole outfit for a game world. Every piece works in every game. Buy the pieces you’re missing together for ${esc(S.st.setRules.bundleOff)}% off, and wear the full set in its game for <b>+${esc(S.st.setRules.bonusPct)}% JustGold</b> (up to ${esc(S.st.setRules.bonusCap)} a game).</p>` + sets.map(setCardHTML).join('');
  }
  async function doBundle(setId) {
    const s = setOf(setId); if (!s || S.inflight) return; S.inflight = true; renderAct();
    const r = await API.bundle(setId, true); S.inflight = false;
    if (r.state) applyState(r.state);
    if (!r.ok) { hap('error'); toast(r.error || 'Could not buy that set.'); render(); return; }
    hap('success'); S.keeperJump = performance.now() / 1000 + 1; S.happy = performance.now() / 1000 + 0.9; S.trySet = null; S.sel = null;
    S.say = `The ${s.name} set is yours, and you’re wearing it! +${S.st.setRules.bonusPct}% JustGold in ${gameName(s.game)}.`;
    toast(`🎉 ${s.icon} ${s.name} set complete!`); render();
  }
  async function doWearSet(setId) {
    const s = setOf(setId); if (!s || S.inflight) return; S.inflight = true; renderAct();
    const r = await API.wearSet(setId); S.inflight = false;
    if (r.state) applyState(r.state);
    if (!r.ok) { hap('error'); toast(r.error || 'Could not change that.'); render(); return; }
    hap('success'); S.happy = performance.now() / 1000 + 0.7; S.trySet = null; toast(`👕 Wearing the ${s.name} set`); render();
  }

  // ---------- actions ----------
  function applyState(st) { if (st && typeof st === 'object' && Array.isArray(st.catalog)) { S.st = st; if (typeof st.now === 'number') S.clockSkew = st.now - Date.now(); } }
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
    if (field === 'body') { const swap = bodyHair(look(), val); if (swap.hair) { const it = ITEMS.find((x) => x.kind === 'item' && x.field === 'hair' && x.value === swap.hair); if (it && (it.owned || it.free)) setTimeout(() => doEquip(it, true), 750); } }
    render();
    clearTimeout(saveT); saveT = setTimeout(saveLook, 700);
  }
  // A new body type starts with that body's usual hair (only between the free short and long styles).
  function bodyHair(l, body) { return body === 'female' && ['short', 'buzzCut'].includes(l.hair || 'short') ? { hair: 'long' } : body === 'male' && l.hair === 'long' ? { hair: 'short' } : {}; }
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
    S.sel = S.sel === id ? null : id; S.say = ''; S.trySet = null;
    const i = byId(S.sel); hap('tap');
    if (i && i.kind === 'item' && i.field === 'effect') S.happy = 0;
    render();
    if (i && window.innerWidth < 760) { const st = $('#stage'); if (st.getBoundingClientRect().bottom < 60) window.scrollTo({ top: 0, behavior: 'smooth' }); }
  }

  // ---------- events (delegated) ----------
  $('#tabs').addEventListener('click', (e) => { const b = e.target.closest('[data-tab]'); if (!b) return; S.tab = b.dataset.tab; S.trySet = null; if (S.tab !== 'gear') S.game = null; S.sel = null; hap('tap'); render(); });
  $('#subs').addEventListener('click', (e) => { const b = e.target.closest('[data-sub],[data-games],[data-msub]'); if (!b) return; if (b.dataset.games) S.game = null; else if (b.dataset.msub) S.sub.mafia = b.dataset.msub; else S.sub[S.tab] = b.dataset.sub; S.sel = null; hap('tap'); render(); });
  $('#shelf').addEventListener('click', (e) => {
    const sb = e.target.closest('[data-setbuy]'); if (sb) return doBundle(sb.dataset.setbuy);
    const sw = e.target.closest('[data-setwear]'); if (sw) return doWearSet(sw.dataset.setwear);
    const tr = e.target.closest('[data-settry]'); if (tr) { S.trySet = S.trySet === tr.dataset.settry ? null : tr.dataset.settry; S.sel = null; S.say = S.trySet ? setPitch(setOf(S.trySet)) : ''; hap('tap'); render(); if (S.trySet && window.innerWidth < 760) window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    const jump = e.target.closest('[data-jump]'); if (jump) { S.tab = jump.dataset.jump; S.sel = null; S.trySet = null; hap('tap'); render(); window.scrollTo({ top: 0 }); return; }
    const it = e.target.closest('[data-item]'); if (it) return select(it.dataset.item);
    const gm = e.target.closest('[data-game]'); if (gm) { S.game = gm.dataset.game; S.sel = null; hap('tap'); render(); window.scrollTo({ top: 0 }); return; }
    const c = e.target.closest('[data-field]'); if (c) editLook(c.dataset.field, c.dataset.val);
  });
  $('#act').addEventListener('click', (e) => {
    const sb = e.target.closest('[data-setbuy]'); if (sb && !sb.disabled) return doBundle(sb.dataset.setbuy);
    const sw = e.target.closest('[data-setwear]'); if (sw && !sw.disabled) return doWearSet(sw.dataset.setwear);
    const b = e.target.closest('[data-act]'); if (!b || b.disabled) return; const i = byId(S.sel);
    const a = b.dataset.act;
    if (a === 'buy' && i) doBuy(i);
    else if (a === 'wear' && i) doEquip(i, true);
    else if (a === 'off' && i) doEquip(i, false);
    else if (a === 'earn') { S.tab = 'earn'; S.sel = null; render(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
    else if (a === 'save') saveLook(true);
    else if (a === 'close') { S.sel = null; S.trySet = null; render(); }
  });
  window.addEventListener('resize', () => { if (S.st) requestAnimationFrame(paintShelf); });

  // ---------- start: make your character (or sign in) ----------
  const randLook = () => { const r = (a) => a[Math.floor(Math.random() * a.length)], body = r(['female', 'male']); return { body, color: r(O.colors.slice(0, 11)), skin: r(O.skins), hair: body === 'female' ? r(['long', 'bob', 'curly']) : r(['short', 'curly', 'mohawk']), hairColor: r(O.hairColor.slice(0, 7)), eyes: r(O.eyes), expression: r(['smile', 'grin', 'wink', 'smirk']), outfit: r(O.outfit.slice(0, 4)), hat: r(['none', 'cap', 'top']), pants: r(O.pants), shoes: r(O.shoes), face: 'round', features: r(['none', 'freckles', 'rosyCheeks']), facialHair: 'none', accessory: 'none' }; };
  let startRaf = 0;
  function showStart(mode = 'new', err = '') {
    $('#left').hidden = true; $('#right').hidden = true; $('#act').classList.add('off'); $('#jg').hidden = true;
    const box = $('#start'); box.hidden = false; box.className = 'start';
    if (!S.startLook) S.startLook = randLook();
    let name = ''; try { name = localStorage.getItem('box.name') || ''; } catch (e) { /* private */ }
    box.innerHTML = mode === 'login'
      ? `<h1>Welcome <span>back!</span></h1><p class="muted">Sign in with the name and password you saved. Your JustGold, character, items and stats come with you.</p>
         <form id="s-form" autocomplete="on"><label for="s-name">Name</label><input id="s-name" maxlength="14" autocomplete="username" autocapitalize="words" spellcheck="false" value="${esc(name)}">
         <label for="s-pin">Password</label><div class="pw-row"><input id="s-pin" type="password" maxlength="64" autocomplete="current-password" autocapitalize="off" spellcheck="false"><button type="button" class="btn sm ghost" id="s-eye" aria-label="Show password">Show</button></div>
         <button class="btn" id="s-go" type="submit">Sign in</button></form><p class="err" id="s-err">${esc(err)}</p><button class="link" id="s-swap">New here? Make a character</button>`
      : `<h1>Make your <span>character</span></h1><p class="muted">One character for every JustGameBox game. Earn <b>JustGold</b> by playing, spend it here.</p>
         <div class="hero"><canvas id="s-cv"></canvas><button class="btn sm ghost shuffle" id="s-shuffle">🎲 Shuffle</button></div>
         <label for="s-name">Your name</label><input id="s-name" maxlength="14" autocomplete="nickname" placeholder="Name" value="${esc(name)}">
         <button class="btn" id="s-go">Let’s go! ✨</button><p class="err" id="s-err">${esc(err)}</p><button class="link" id="s-swap">Saved your stuff before? Sign in</button>`;
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
        const pw = $('#s-pin').value;
        if (pw.length < 4) { go.disabled = false; err$.textContent = 'Type your password (4+ characters).'; hap('error'); return; }
        r = await API.login(nm, pw);
      } else r = await API.create(nm);
      go.disabled = false;
      if (!r.ok || !r.id || !r.token) { err$.textContent = r.error || 'That didn’t work. Try again.'; hap('error'); return; }
      if (API.live) setProf(r); try { localStorage.setItem('box.name', nm); } catch (e) { /* private */ }
      hap('success'); S.fresh = mode !== 'login'; boot();
    };
    const form = $('#s-form');
    if (form) form.onsubmit = (e) => { e.preventDefault(); submit(); }; // Enter submits too
    else { go.onclick = submit; box.querySelectorAll('input').forEach((inp) => inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); })); }
    const eye = $('#s-eye'); if (eye) eye.onclick = () => { const i = $('#s-pin'), show = i.type === 'password'; i.type = show ? 'text' : 'password'; eye.textContent = show ? 'Hide' : 'Show'; eye.setAttribute('aria-label', show ? 'Hide password' : 'Show password'); };
  }

  // ---------- "Save your stuff": name + password (public/account-ui.js) ----------
  // A banner over the character while the account is not saved; "Saved as NAME ✓" once it is.
  let acct = null;
  function accountBar() {
    const el = $('#acct'); if (!el) return;
    if (!API.live || !window.JGAccount) { el.innerHTML = ''; return; }
    if (!acct) acct = JGAccount.create({ socket: API.socket, haptic: hap, toast, onChange: (kind) => {
      if (kind === 'signout' || kind === 'signin') { S.edits = {}; S.sel = null; }
      if (kind === 'signout') { S.st = null; showStart('login'); return; }
      if (kind === 'signin') { boot(); return; }
      accountBar();
    } });
    acct.banner(el);
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
    accountBar();
    if (!raf) raf = requestAnimationFrame(stageFrame);
    clearInterval(pollT);
    pollT = setInterval(() => { if (S.st && S.st.busy && !S.inflight) refresh(); }, 10000);
  }
  window.addEventListener('pageshow', (e) => { if (e.persisted && S.st) refresh(); });
  if (API.live) { /* boot runs on connect */ S.waiting = true; setTimeout(() => { if (S.waiting) { S.waiting = false; boot(); } }, 50); } else boot();
  window.JG_SHOP = { state: () => S, select, render, account: () => acct };
})();
