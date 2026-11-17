'use strict';
/* =====================================================================================
   JustGameBox AUDIO ENGINE (public/box/audio.js) -> window.BOX.audio
   =====================================================================================
   Every note is synthesized in the browser with Web Audio (no audio files, no downloads).
   The TV page and the main menu play music; phones never load this file.

   SIGNAL FLOW
     instrument voices -> track strip (gain, filters, tremolo, pan, reverb/delay sends)
       -> cue bus (crossfades) -> music bus (volume x duck) -> master
     stingers -> sfx bus -> master
     master: rumble high-pass -> glue compressor -> limiter -> soft clipper (never > 0.98)
     -> volume -> speakers. One generated-impulse reverb and one tempo-synced ping-pong delay
     are shared by everything.

   INSTRUMENTS (track `type`)
     live synths   pad (detuned supersaw, slow filter motion), strings, choir, brass, mute
                   (harmon trumpet), sax, organ, bass (sub + mid), synthbass (funk), sub808,
                   tuba, lead, flute, whistle, clarinet, sine (theremin), fmkeys, pluck, clav
     sampled       piano, honky, epiano, vibes, marimba, glock, celesta, musicbox, kalimba,
     (rendered     chime, cbell, timp, and Karplus-Strong strings: guitar, nylon, harpsi,
      once, cached) pizz, banjo, harp, lute, upright
     drums         type 'drums' with a kit: std, funk, jazz, lofi, 808, orch, world
                   pieces: k s c h o r y t1 t2 t3 sh tb cb wb rim sn br hb tk fd vn tick tock
                   cg bg tri sw (see KITS below)

   SCORES live in public/box/scores/<key>.js (loaded on demand). See scores/README.md for
   the score format (cues, sections, tracks, patterns, stingers).

   API
     BOX.audio.music(cue, scoreKey)  crossfade to a cue (on the next bar). null = fade out.
     BOX.audio.stinger(name, scoreKey)   one-shot (score stinger or a built-in one)
     BOX.audio.fx(scoreKey, kind)    play the score's stinger for a game fx kind -> true if it did
     BOX.audio.sfx(name)             the current score's restyled version of an SFX name -> bool
     BOX.audio.duck(on)              lower the music under the narrator
     BOX.audio.stop(fade)            stop the music
     BOX.audio.need(key, cb)         load a score file
     BOX.audio.settings / set(kind, value) / mute(on)   master, music, sfx (0..1), mute
                                     remembered in localStorage 'box.audio'
     BOX.audio.panel(anchor)         the 🔊 sound settings popover
     BOX.audio.render(key, cue, bars) offline render (OfflineAudioContext) -> peak/RMS stats
     BOX.sfx(name) is wrapped: the current score can restyle any SFX name (score.sfx map);
     anything it doesn't restyle plays the old sfx.js sound.

   REAL TRACKS: list files in public/audio/manifest.json, e.g.
     { "price": { "title": "title.mp3", "think": "think.ogg", "stinger:win": "win.mp3" } }
   and put them in public/audio/price/. A listed file replaces the synthesized cue.
   ===================================================================================== */
(function () {
  const W = window;
  if (!W.BOX) W.BOX = { games: {} };
  const BOX = W.BOX;
  BOX.scores = BOX.scores || {};
  const rnd = Math.random;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const TAU = Math.PI * 2;

  // ---------------------------------------------------------------- notes and chords
  const PC = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
  function noteNum(tok) {
    const m = /^([a-gA-G])(#|b)?(-?\d)$/.exec(tok); if (!m) return null;
    return 12 * (Number(m[3]) + 1) + PC[m[1].toLowerCase()] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  }
  const QUAL = {
    '': [0, 4, 7], M: [0, 4, 7], maj: [0, 4, 7], m: [0, 3, 7], min: [0, 3, 7], 5: [0, 7], dim: [0, 3, 6], aug: [0, 4, 8], '+': [0, 4, 8],
    sus2: [0, 2, 7], sus4: [0, 5, 7], sus: [0, 5, 7], 6: [0, 4, 7, 9], m6: [0, 3, 7, 9], 69: [0, 4, 7, 9, 14], m69: [0, 3, 7, 9, 14],
    7: [0, 4, 7, 10], maj7: [0, 4, 7, 11], M7: [0, 4, 7, 11], m7: [0, 3, 7, 10], mM7: [0, 3, 7, 11], m7b5: [0, 3, 6, 10], dim7: [0, 3, 6, 9],
    '7sus4': [0, 5, 7, 10], '7sus': [0, 5, 7, 10], add9: [0, 4, 7, 14], madd9: [0, 3, 7, 14], 9: [0, 4, 7, 10, 14], maj9: [0, 4, 7, 11, 14],
    m9: [0, 3, 7, 10, 14], 11: [0, 7, 10, 14, 17], m11: [0, 3, 7, 10, 14, 17], 13: [0, 4, 7, 10, 14, 21], maj13: [0, 4, 7, 11, 14, 21],
    m13: [0, 3, 7, 10, 14, 21], '7b9': [0, 4, 7, 10, 13], '7#9': [0, 4, 7, 10, 15], '7#5': [0, 4, 8, 10], '7b13': [0, 4, 7, 10, 20],
    'maj7#11': [0, 4, 7, 11, 18], '9sus4': [0, 5, 7, 10, 14], '13sus4': [0, 5, 7, 10, 14, 21], 'm7#5': [0, 3, 8, 10], 'add11': [0, 4, 7, 17],
    'sus2add11': [0, 2, 7, 17], '7#11': [0, 4, 7, 10, 18], 'm9b5': [0, 3, 6, 10, 14],
  };
  const chordCache = new Map();
  function parseChord(sym, tr) {
    const k = sym + '@' + tr; if (chordCache.has(k)) return chordCache.get(k);
    const m = /^([A-G])(#|b)?([^/]*)(?:\/([A-G])(#|b)?)?$/.exec(sym);
    if (!m || !QUAL[m[3]]) throw new Error('Unknown chord: ' + sym);
    const pc = (L, a) => (((PC[L.toLowerCase()] + (a === '#' ? 1 : a === 'b' ? -1 : 0) + tr) % 12) + 12) % 12;
    const root = pc(m[1], m[2]);
    const c = { root, ivs: QUAL[m[3]], bass: m[4] ? pc(m[4], m[5]) : root, sym };
    chordCache.set(k, c); return c;
  }
  // 'Cmaj7 | Am7 . D7 | ...' -> one chord per step. '.' repeats the chord before it.
  function progression(str, bars, spb, tr) {
    const at = new Array(bars * spb).fill(null);
    if (!str) return at;
    const B = (Array.isArray(str) ? str.join('|') : str).split('|').map((b) => b.trim()).filter((b) => b.length);
    let last = null;
    for (let bar = 0; bar < bars; bar++) {
      const toks = B[bar % B.length].split(/\s+/);
      const per = spb / toks.length;
      toks.forEach((t, i) => {
        const c = t === '.' || t === '%' ? last : parseChord(t, tr); last = c;
        for (let s = Math.round(i * per); s < Math.round((i + 1) * per); s++) at[bar * spb + s] = c;
      });
    }
    return at;
  }
  const hasIv = (c, x) => c.ivs.some((i) => i % 12 === x);
  function degree(c, n) {
    switch (n) {
      case 1: return 0; case 2: return 2; case 4: return 5; case 6: return hasIv(c, 8) && !hasIv(c, 9) ? 8 : 9; case 8: return 12; case 9: return 14; case 11: return 17; case 13: return 21;
      case 3: return hasIv(c, 3) ? 3 : hasIv(c, 4) ? 4 : hasIv(c, 5) ? 5 : hasIv(c, 2) ? 2 : 4;
      case 5: return hasIv(c, 7) ? 7 : hasIv(c, 6) ? 6 : hasIv(c, 8) ? 8 : 7;
      case 7: return hasIv(c, 11) ? 11 : hasIv(c, 10) ? 10 : hasIv(c, 9) && hasIv(c, 6) ? 9 : 10;
      case 10: return degree(c, 3) + 12; case 12: return degree(c, 5) + 12;
      default: return 0;
    }
  }
  // Voice leading: pick the inversion (close or drop-2) nearest the last voicing, in range.
  function voiceChord(c, prev, o) {
    const n = o.n || 4, center = o.center || 62, lo = o.lo != null ? o.lo : center - 11, hi = o.hi != null ? o.hi : center + 13;
    const pri = (iv) => { const r = iv % 12; if (iv > 12) return 1.5; if (r === 3 || r === 4) return 0; if (r === 10 || r === 11) return 1; if (r === 9 && c.ivs.length > 3) return 1; if (r === 6 || r === 8 || r === 2 || r === 5 || r === 1) return 1.2; if (r === 7) return 3; return o.rootless ? 9 : 2.5; };
    let ivs = [...new Set(c.ivs)].sort((a, b) => pri(a) - pri(b));
    if (o.rootless && ivs.length > 3) ivs = ivs.filter((i) => i % 12 !== 0 || ivs.length <= n);
    let pcs = ivs.slice(0, n).map((i) => (c.root + i) % 12);
    for (let k = 0; pcs.length < n; k++) pcs.push(pcs[k % pcs.length]);
    pcs.sort((a, b) => a - b);
    let best = null, bestCost = Infinity;
    const tryV = (v) => {
      v = v.slice().sort((a, b) => a - b);
      let cost = 0;
      if (prev) for (const x of v) { let d = 99; for (const y of prev) d = Math.min(d, Math.abs(x - y)); cost += d; }
      const mean = v.reduce((a, b) => a + b, 0) / v.length;
      cost += Math.abs(mean - center) * (prev ? 0.35 : 1);
      for (const x of v) { if (x < lo) cost += (lo - x) * 3; if (x > hi) cost += (x - hi) * 3; }
      if (v.length > 1 && v[v.length - 1] - v[v.length - 2] === 1) cost += 6;
      for (let i = 1; i < v.length; i++) if (v[i] < 53 && v[i] - v[i - 1] < 5) cost += 4;
      if (cost < bestCost) { bestCost = cost; best = v; }
    };
    for (let r = 0; r < pcs.length; r++) {
      const seq = pcs.slice(r).concat(pcs.slice(0, r));
      for (let oct = Math.floor((lo - 14) / 12); oct <= Math.floor(hi / 12); oct++) {
        const v = []; let cur = oct * 12 + seq[0]; v.push(cur);
        for (let i = 1; i < seq.length; i++) { let x = Math.floor(cur / 12) * 12 + seq[i]; while (x <= cur) x += 12; v.push(x); cur = x; }
        if (v[0] < lo - 12 || v[v.length - 1] > hi + 12) continue;
        tryV(v);
        if (v.length >= 4 && o.drop !== false) { const d = v.slice(); d[d.length - 2] -= 12; tryV(d); }
      }
    }
    return best || pcs.map((p) => 60 + p);
  }

  // ---------------------------------------------------------------- compiler
  const DRUMVEL = { x: 0.75, X: 1, g: 0.32, o: 0.75, O: 1, f: 0.8 };
  for (let i = 1; i <= 9; i++) DRUMVEL[String(i)] = i / 10;
  const units = (p) => (Array.isArray(p) ? p.join('') : String(p)).replace(/[\s|]/g, '');
  const tokens = (p) => (Array.isArray(p) ? p.join(' | ') : String(p)).split(/[\s|]+/).filter(Boolean);
  // Built-in drum grooves (16 steps per bar unless named otherwise).
  const GROOVES = {
    four: { k: 'x...x...x...x...', c: '....x.......x...', h: '..x...x...x...x.', sh: 'xgxgxgxgxgxgxgxg' },
    pop: { k: 'x.....x.x.......', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' },
    funk: { k: 'x.....x...x..x..', s: '....X..g.g..X..g', h: 'x.xgx.xgx.xgx.xo' },
    halftime: { k: 'x.........x.....', s: '........X.......', h: 'x.x.x.x.x.x.x.x.' },
    swing: { k: 'g.......g.......', r: 'x...x.x.x...x.x.', h: '....x.......x...' },
    brush: { k: 'g.......g.......', br: 'x.x.x.x.x.x.x.x.', s: '....g.......g...', h: '....x.......x...' },
    bossa: { k: 'x..xx..xx..xx..x', rim: '..x..x....x..x..', sh: 'xgxgxgxgxgxgxgxg' },
    lofi: { k: 'x......x..x.....', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.', vn: 'x...............' },
    march: { k: 'x.......x.......', s: 'x..gx.g.x..gxggg', y: '' },
    shuffle: { k: 'x.......x.......', s: '....x.......x...', h: 'x..xx..xx..xx..x' },
    pulse: { k: 'x...x...x...x...' },
    waltz: { k: 'x...........', s: '....x...x...', h: 'x...x...x...' }, // beats 3
    jig: { k: 'x.....x.....', s: '...x.....x..', h: 'x.xx.xx.xx.x' }, // 6/8: beats 2, steps 6
  };
  function compileTrack(evs, tn, T, pat, C) {
    const mode = T.mode || (T.type === 'drums' ? 'drums' : 'notes');
    const res = T.res || (mode === 'drums' || mode === 'chord' ? 1 : 2);
    if (mode === 'drums') {
      if (typeof pat === 'string') pat = GROOVES[pat] || {};
      for (const [piece, str] of Object.entries(pat)) {
        const u = units(str); if (!u.length) continue;
        const cover = u.length * res;
        for (let base = 0; base < C.len; base += cover) for (let i = 0; i < u.length; i++) {
          const at = base + i * res, v = DRUMVEL[u[i]]; if (at >= C.len) break; if (v == null) continue;
          evs.push({ at, dur: res, tr: tn, drum: (u[i] === 'o' || u[i] === 'O') && piece === 'h' ? 'o' : piece, vel: v, flam: u[i] === 'f' });
        }
      }
      return;
    }
    if (mode === 'chord') {
      let prev = null, lastC = null, cur = null;
      const vf = (c) => { if (c !== lastC) { cur = voiceChord(c, prev, T); prev = cur; lastC = c; } return cur; };
      if (pat === true || pat === 'auto') {
        let s = 0;
        while (s < C.len) { const c = C.chordAt[s]; let e = s + 1; while (e < C.len && C.chordAt[e] === c) e++; if (c) evs.push({ at: s, dur: e - s, tr: tn, midi: vf(c), vel: T.vel || 0.7 }); s = e; }
        return;
      }
      const u = units(pat), cover = u.length * res;
      for (let base = 0; base < C.len; base += cover) for (let i = 0; i < u.length; i++) {
        const ch = u[i]; if (ch === '.' || ch === '-') continue;
        const at = base + i * res; if (at >= C.len) break;
        let d = 1; while (u[i + d] === '-') d++;
        const c = C.chordAt[at]; if (!c) continue;
        const v = vf(c);
        let midi, vel = 0.75;
        if (ch === 'x' || ch === 'X' || ch === 'g') { midi = v; vel = DRUMVEL[ch]; }
        else if (/[1-9]/.test(ch)) { const k = Number(ch) - 1; midi = [v[k % v.length] + 12 * Math.floor(k / v.length)]; }
        else continue;
        evs.push({ at, dur: Math.min(d * res, C.len - at), tr: tn, midi, vel });
      }
      return;
    }
    if (mode === 'bass') {
      const base = 12 * ((T.oct != null ? T.oct : 2) + 1);
      const rootM = (pc) => { let m = base + pc; if (m > base + 7) m -= 12; return m; };
      const nextChord = (at) => { const c = C.chordAt[at]; for (let s = at + 1; s < C.len; s++) if (C.chordAt[s] && C.chordAt[s] !== c) return C.chordAt[s]; return C.chordAt[0] || c; };
      if (pat === 'walk') {
        let last = null;
        for (let b = 0; b * C.steps < C.len; b++) {
          const at = b * C.steps, c = C.chordAt[at]; if (!c) continue;
          const startOfChord = at === 0 || C.chordAt[at - 1] !== c || (at % C.spb === 0 && (b / C.beats) % 2 === 0);
          const nb = at + C.steps < C.len ? C.chordAt[at + C.steps] : C.chordAt[0];
          let m;
          if (startOfChord || last == null) { m = rootM(c.bass); if (last != null && Math.abs(m + 12 - last) < Math.abs(m - last) && m + 12 <= base + 12) m += 12; }
          else if (nb && nb !== c) { const tgt = rootM(nb.bass); const t2 = Math.abs(tgt + 12 - last) < Math.abs(tgt - last) ? tgt + 12 : tgt; m = t2 + (last > t2 ? 1 : -1); }
          else {
            const opts = []; for (const d of [0, degree(c, 3), degree(c, 5), degree(c, 6), degree(c, 2)]) for (const o of [-12, 0, 12]) opts.push(rootM(c.root) + d + o);
            const tgt = nb ? rootM(nb.bass) : last; const dir = tgt >= last ? 1 : -1;
            const cands = opts.filter((x) => x !== last && (x - last) * dir >= 0 && Math.abs(x - last) <= 7);
            const pool = cands.length ? cands : opts.filter((x) => x !== last);
            m = pool.reduce((a, x) => (Math.abs(x - last) < Math.abs(a - last) ? x : a));
          }
          while (m < base - 6) m += 12; while (m > base + 14) m -= 12;
          evs.push({ at, dur: C.steps, tr: tn, midi: [m], vel: b % 2 ? 0.7 : 0.82 }); last = m;
        }
        return;
      }
      const tk = tokens(pat), cover = tk.length * res;
      for (let base0 = 0; base0 < C.len; base0 += cover) for (let i = 0; i < tk.length; i++) {
        const tok = tk[i]; if (tok === '.' || tok === 'r' || tok === '-') continue;
        const at = base0 + i * res; if (at >= C.len) break;
        let d = 1; while (tk[i + d] === '-') d++;
        const c = C.chordAt[at]; if (!c) continue;
        const m = /^(~?)([aAx]|[b#]?\d+)([',]*)([!?]*)$/.exec(tok); if (!m) continue;
        let midi, vel = /!/.test(m[4]) ? 1 : /\?/.test(m[4]) ? 0.45 : 0.8, dead = false;
        if (m[2] === 'a' || m[2] === 'A') { const nc = nextChord(at); midi = rootM(nc.bass) + (m[2] === 'a' ? -1 : 1); }
        else if (m[2] === 'x') { midi = rootM(c.root); vel = 0.3; dead = true; }
        else { const acc = m[2][0] === 'b' ? -1 : m[2][0] === '#' ? 1 : 0, n = Number(m[2].replace(/[b#]/, '')); midi = n === 1 && !acc ? rootM(c.bass) : rootM(c.root) + degree(c, n) + acc; }
        for (const q of m[3]) midi += q === "'" ? 12 : -12;
        evs.push({ at, dur: dead ? Math.min(1, d * res) : Math.min(d * res, C.len - at), tr: tn, midi: [midi], vel, dead });
      }
      return;
    }
    // notes
    const tk = tokens(pat), cover = tk.length * res;
    for (let base = 0; base < C.len; base += cover) for (let i = 0; i < tk.length; i++) {
      const tok = tk[i]; if (tok === '.' || tok === 'r' || tok === '-') continue;
      const at = base + i * res; if (at >= C.len) break;
      let d = 1; while (tk[i + d] === '-') d++;
      const m = /^(~?)([^!?]+)([!?]*)$/.exec(tok); if (!m) continue;
      const midi = m[2].split('+').map(noteNum).filter((x) => x != null).map((x) => x + C.tr);
      if (!midi.length) continue;
      evs.push({ at, dur: Math.min(d * res, C.len - at), tr: tn, midi, vel: /!/.test(m[3]) ? 1 : /\?/.test(m[3]) ? 0.45 : T.vel || 0.78, glide: !!m[1] });
    }
  }
  function compile(cue) {
    const beats = cue.beats || 4, steps = cue.steps || 4, spb = beats * steps, tr = cue.transpose || 0;
    const secs = {};
    for (const [name, S] of Object.entries(cue.sections || {})) {
      const bars = S.bars || 4, len = bars * spb;
      const C = { len, spb, steps, beats, tr, bars, chordAt: progression(S.chords, bars, spb, tr) };
      const evs = [];
      for (const [tn, T0] of Object.entries(cue.tracks || {})) {
        let pat = S[tn]; if (pat === undefined && cue.all) pat = cue.all[tn];
        if (pat == null || pat === false) continue;
        let T = T0;
        if (typeof pat === 'object' && !Array.isArray(pat) && pat.p !== undefined) { T = { ...T0, ...pat }; pat = pat.p; }
        try { compileTrack(evs, tn, T, pat, C); } catch (e) { console.error('[audio] ' + name + '/' + tn, e); }
      }
      evs.sort((a, b) => a.at - b.at);
      secs[name] = { name, bars, len, evs, vol: S.vol != null ? S.vol : 1 };
    }
    const form = (cue.form || Object.keys(secs)).filter((f) => secs[f]);
    return { bpm: cue.bpm || 100, beats, steps, spb, swing: cue.swing || 0.5, swing16: cue.swing16 || 0.5, secs, form, loop: cue.loop != null ? cue.loop : form.length > 1 ? 1 : 0, once: !!cue.once, tracks: cue.tracks || {}, cue };
  }
  // seconds from the start of a section to step s (swing moves the off-beats)
  function stepTime(C, s) {
    const beat = Math.floor(s / C.steps); let f = (s - beat * C.steps) / C.steps;
    if (C.swing !== 0.5 && C.steps % 2 === 0) f = f < 0.5 ? (f / 0.5) * C.swing : C.swing + ((f - 0.5) / 0.5) * (1 - C.swing);
    else if (C.swing16 !== 0.5 && C.steps === 4) { const q = f * 2, k = Math.floor(q), r = q - k; f = (k + (r < 0.5 ? (r / 0.5) * C.swing16 : C.swing16 + ((r - 0.5) / 0.5) * (1 - C.swing16))) / 2; }
    return (beat + f) * 60 / C.bpm;
  }

  // ---------------------------------------------------------------- DSP helpers (offline, JS)
  const SR_S = 32000, SR_D = 44100;
  function biq(a, type, f, q, sr) {
    const w = TAU * Math.min(f, sr * 0.45) / sr, cw = Math.cos(w), al = Math.sin(w) / (2 * q);
    let b0, b1, b2, a0, a1, a2;
    if (type === 'lp') { b0 = (1 - cw) / 2; b1 = 1 - cw; b2 = b0; } else if (type === 'hp') { b0 = (1 + cw) / 2; b1 = -(1 + cw); b2 = b0; } else { b0 = al; b1 = 0; b2 = -al; }
    a0 = 1 + al; a1 = -2 * cw; a2 = 1 - al;
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let i = 0; i < a.length; i++) { const x = a[i]; const y = (b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0; x2 = x1; x1 = x; y2 = y1; y1 = y; a[i] = y; }
    return a;
  }
  function norm(a, peak) { let m = 0; for (let i = 0; i < a.length; i++) m = Math.max(m, Math.abs(a[i])); if (m > 0) { const k = peak / m; for (let i = 0; i < a.length; i++) a[i] *= k; } return a; }
  function fadeTail(a, sr, sec) { const n = Math.min(a.length, Math.floor(sr * sec)); for (let i = 0; i < n; i++) a[a.length - 1 - i] *= i / n; return a; }
  // Additive: parts [ratio, amp, tau(s), detuneCents]
  function additive(f, parts, len) {
    const n = Math.floor(len * SR_S), out = new Float32Array(n);
    for (const [r, a, tau, dc] of parts) {
      const fr = f * r * (dc ? Math.pow(2, dc / 1200) : 1); if (fr >= SR_S * 0.45) continue;
      const w = TAU * fr / SR_S, cw = Math.cos(w), sw = Math.sin(w), dk = Math.exp(-1 / (tau * SR_S));
      let re = 1, im = 0, env = a; const m = Math.min(n, Math.ceil(tau * SR_S * 7));
      for (let i = 0; i < m; i++) { out[i] += im * env; const nr = re * cw - im * sw; im = re * sw + im * cw; re = nr; env *= dk; }
    }
    return out;
  }
  function click(out, amt, dec, lp) { const m = Math.floor(dec * SR_S * 5); let s = 0; for (let i = 0; i < m && i < out.length; i++) { s += lp * ((rnd() * 2 - 1) - s); out[i] += s * amt * Math.exp(-i / (dec * SR_S)); } return out; }
  // Karplus-Strong plucked string, tuned with a fractional allpass.
  function ks(f, o) {
    const SR = SR_S, n = Math.floor((o.len || 2.5) * SR), out = new Float32Array(n);
    const N = SR / f; let L = Math.floor(N - 0.5); let fr = N - 0.5 - L; if (fr < 0.15) { L -= 1; fr += 1; }
    const C = (1 - fr) / (1 + fr), S = Math.pow(0.001, N / ((o.t60 || 2) * SR));
    const buf = new Float32Array(L); let s = 0, mean = 0; const b = o.bright != null ? o.bright : 0.6;
    for (let i = 0; i < L; i++) { s += b * ((rnd() * 2 - 1) - s); buf[i] = s; mean += s; }
    mean /= L; const pk = Math.max(1, Math.round((o.pick || 0.13) * L)), tmp = Float32Array.from(buf, (x) => x - mean);
    for (let i = 0; i < L; i++) buf[i] = tmp[i] - 0.9 * tmp[(i - pk + L) % L];
    norm(buf, 1);
    let p = 0, prev = 0, ax = 0, ay = 0;
    for (let i = 0; i < n; i++) {
      const x = buf[p]; const avg = S * 0.5 * (x + prev); prev = x;
      const y = C * avg + ax - C * ay; ax = avg; ay = y;
      buf[p] = y; out[i] = x; if (++p === L) p = 0;
    }
    return out;
  }
  function addInto(a, b, k) { for (let i = 0; i < Math.min(a.length, b.length); i++) a[i] += b[i] * k; return a; }
  function trem(a, hz, depth) { for (let i = 0; i < a.length; i++) a[i] *= 1 - depth * (0.5 - 0.5 * Math.cos(TAU * hz * i / SR_S)); return a; }
  const lenFor = (m, lo, hi, a = 36, b = 96) => hi - (hi - lo) * clamp((m - a) / (b - a), 0, 1);

  // Sampled instruments: rendered once per pitch, then played as buffers.
  // gain: playback level; rel: damper time at note-off; ring: let it ring past note-off (x dur)
  const SAMPLED = {
    piano: { gain: 0.5, rel: 0.16, render(m, honky) {
      const f = mtof(m), len = lenFor(m, 1.2, 4.6), T = lenFor(m, 0.5, 3.6), parts = [], N = Math.min(14, Math.floor(7000 / f));
      for (let k = 1; k <= N; k++) { const r = k * Math.sqrt(1 + 0.0004 * k * k), a = (0.6 + 0.4 * Math.abs(Math.sin(Math.PI * k * 0.14))) / Math.pow(k, 1.25); parts.push([r, a * 0.55, T * 0.16 / Math.sqrt(k)], [r, a * 0.45, T / Math.pow(k, 0.65), honky ? 11 : 1.2]); }
      const out = click(additive(f, parts, len), 0.12, 0.003, 0.35); return fadeTail(norm(biq(out, 'lp', Math.min(12000, f * 18), 0.7, SR_S), 0.85), SR_S, 0.12);
    } },
    honky: { gain: 0.48, rel: 0.14, render(m) { return SAMPLED.piano.render(m, true); } },
    epiano: { gain: 0.5, rel: 0.2, render(m) {
      const f = mtof(m), len = lenFor(m, 1.4, 4), n = Math.floor(len * SR_S), out = new Float32Array(n), dec = lenFor(m, 0.6, 2.6), w = TAU * f / SR_S;
      for (let i = 0; i < n; i++) { const t = i / SR_S, I = 1.5 * Math.exp(-t / 0.22) + 0.22, ph = w * i; out[i] = (Math.sin(ph + I * Math.sin(ph)) * 0.85 + 0.3 * Math.exp(-t / 0.03) * Math.sin(ph * 7.1)) * Math.exp(-t / dec) * (1 - Math.exp(-t / 0.0015)); }
      return fadeTail(norm(out, 0.85), SR_S, 0.1);
    } },
    vibes: { gain: 0.42, rel: 0.4, render(m) { const f = mtof(m); return fadeTail(norm(trem(click(additive(f, [[1, 1, lenFor(m, 1, 2.8, 48)], [4, 0.2, 0.25], [10, 0.05, 0.07]], lenFor(m, 1.6, 3.6, 48)), 0.05, 0.002, 0.6), 4.6, 0.35), 0.85), SR_S, 0.2); } },
    marimba: { gain: 0.5, rel: 0.15, ring: 3, render(m) { const f = mtof(m); return fadeTail(norm(click(additive(f, [[1, 1, lenFor(m, 0.2, 0.9, 48)], [3.98, 0.3, 0.06], [9.2, 0.06, 0.02]], 1.4), 0.08, 0.002, 0.7), 0.85), SR_S, 0.1); } },
    glock: { gain: 0.32, rel: 0.6, ring: 4, render(m) { const f = mtof(m); return fadeTail(norm(additive(f, [[1, 1, 1.4], [2.76, 0.32, 0.3], [5.4, 0.14, 0.1], [8.93, 0.06, 0.05]], 2.2), 0.85), SR_S, 0.2); } },
    celesta: { gain: 0.36, rel: 0.5, ring: 3, render(m) { const f = mtof(m); return fadeTail(norm(additive(f, [[1, 1, 1.0], [2, 0.22, 0.25], [3, 0.1, 0.12], [4.02, 0.05, 0.07]], 1.8), 0.85), SR_S, 0.2); } },
    musicbox: { gain: 0.34, rel: 0.8, ring: 4, render(m) { const f = mtof(m); return fadeTail(norm(additive(f, [[1, 1, 1.3], [2.01, 0.15, 0.3], [3.02, 0.25, 0.18], [5.9, 0.08, 0.05]], 2), 0.85), SR_S, 0.2); } },
    kalimba: { gain: 0.42, rel: 0.4, ring: 3, render(m) { const f = mtof(m); return fadeTail(norm(click(additive(f, [[1, 1, 0.9], [5.42, 0.14, 0.05], [2.01, 0.05, 0.2]], 1.6), 0.05, 0.002, 0.5), 0.85), SR_S, 0.15); } },
    chime: { gain: 0.32, rel: 1.2, ring: 6, render(m) { const f = mtof(m); return fadeTail(norm(additive(f, [[1, 1, 3], [2.0, 0.5, 2], [2.76, 0.35, 1.5, 3], [4.16, 0.3, 1], [5.43, 0.22, 0.7], [6.79, 0.14, 0.45]], 4), 0.85), SR_S, 0.3); } },
    cbell: { gain: 0.3, rel: 1.5, ring: 6, render(m) { const f = mtof(m); return fadeTail(norm(additive(f, [[0.5, 0.6, 4], [1, 1, 3], [1.19, 0.7, 2.2], [1.5, 0.45, 1.6], [2, 0.6, 1.2], [2.5, 0.3, 0.8], [3, 0.25, 0.6], [4.07, 0.15, 0.4]], 4.5), 0.85), SR_S, 0.3); } },
    timp: { gain: 0.7, rel: 0.6, ring: 3, render(m) { const f = mtof(m); const a = additive(f, [[1, 1, 1.4], [1.5, 0.5, 0.9], [1.98, 0.35, 0.6], [2.44, 0.2, 0.4]], 2.6); return fadeTail(norm(click(a, 0.6, 0.012, 0.15), 0.85), SR_S, 0.2); } },
    guitar: { gain: 0.5, rel: 0.12, ring: 1.6, render(m) { const f = mtof(m); return fadeTail(norm(biq(ks(f, { bright: 0.55, t60: lenFor(m, 1.2, 3.5, 40, 84), pick: 0.14, len: lenFor(m, 1.5, 3.6, 40, 84) }), 'lp', 5200, 0.6, SR_S), 0.85), SR_S, 0.1); } },
    nylon: { gain: 0.52, rel: 0.12, ring: 1.6, render(m) { const f = mtof(m); return fadeTail(norm(biq(ks(f, { bright: 0.38, t60: lenFor(m, 1, 3, 40, 84), pick: 0.2, len: lenFor(m, 1.4, 3.2, 40, 84) }), 'lp', 3800, 0.6, SR_S), 0.85), SR_S, 0.1); } },
    harpsi: { gain: 0.36, rel: 0.08, ring: 1.4, render(m) { const f = mtof(m), o = { bright: 0.97, t60: lenFor(m, 0.9, 2.6, 40, 88), pick: 0.07, len: lenFor(m, 1.2, 2.8, 40, 88) }; const a = ks(f, o); addInto(a, ks(f * 2, { ...o, t60: o.t60 * 0.7 }), 0.35); return fadeTail(norm(click(a, 0.15, 0.002, 0.9), 0.85), SR_S, 0.08); } },
    pizz: { gain: 0.6, rel: 0.1, ring: 4, render(m) { const f = mtof(m); return fadeTail(norm(biq(ks(f, { bright: 0.42, t60: lenFor(m, 0.25, 0.7, 40, 90), pick: 0.22, len: 0.9 }), 'lp', 3000, 0.7, SR_S), 0.85), SR_S, 0.05); } },
    banjo: { gain: 0.42, rel: 0.1, ring: 2, render(m) { const f = mtof(m); return fadeTail(norm(biq(ks(f, { bright: 0.9, t60: lenFor(m, 0.5, 1.2, 40, 88), pick: 0.09, len: 1.3 }), 'bp', 1800, 0.5, SR_S), 0.85), SR_S, 0.05); } },
    harp: { gain: 0.5, rel: 0.4, ring: 3, render(m) { const f = mtof(m); return fadeTail(norm(ks(f, { bright: 0.5, t60: lenFor(m, 1.4, 4, 36, 96), pick: 0.3, len: lenFor(m, 1.8, 4, 36, 96) }), 0.85), SR_S, 0.15); } },
    lute: { gain: 0.5, rel: 0.12, ring: 1.6, render(m) { const f = mtof(m); return fadeTail(norm(biq(ks(f, { bright: 0.6, t60: lenFor(m, 0.8, 2.2, 40, 88), pick: 0.18, len: 2.3 }), 'lp', 4200, 0.8, SR_S), 0.85), SR_S, 0.08); } },
    upright: { gain: 0.95, rel: 0.1, render(m) { const f = mtof(m); const a = ks(f, { bright: 0.28, t60: 1.6, pick: 0.25, len: 2.2 }); addInto(a, additive(f, [[1, 0.9, 0.18]], 2.2), 1); return fadeTail(norm(biq(a, 'lp', 1400, 0.6, SR_S), 0.85), SR_S, 0.1); } },
  };
  const sampleCache = new Map();
  function sampleBuf(type, m) {
    const k = type + ':' + m; let b = sampleCache.get(k);
    if (b) { sampleCache.delete(k); sampleCache.set(k, b); return b; }
    const data = SAMPLED[type].render(m);
    b = new AudioBuffer({ length: data.length, sampleRate: SR_S, numberOfChannels: 1 }); b.copyToChannel(data, 0);
    sampleCache.set(k, b); if (sampleCache.size > 180) sampleCache.delete(sampleCache.keys().next().value);
    return b;
  }

  // ---------------------------------------------------------------- drum kits (rendered once)
  const DG = {
    kick(o) {
      const n = Math.floor((o.len || 0.6) * SR_D), a = new Float32Array(n); let ph = 0; const drive = o.drive || 1.4;
      for (let i = 0; i < n; i++) { const t = i / SR_D, f = o.f1 + (o.f0 - o.f1) * Math.exp(-t / (o.pd || 0.04)); ph += TAU * f / SR_D; a[i] = Math.tanh(Math.sin(ph) * Math.exp(-t / o.dec) * drive) / Math.tanh(drive); }
      const c = new Float32Array(Math.floor(0.02 * SR_D)); for (let i = 0; i < c.length; i++) c[i] = (rnd() * 2 - 1) * Math.exp(-i / (0.003 * SR_D)); biq(c, 'hp', 1200, 0.7, SR_D); addInto(a, c, o.click != null ? o.click : 0.3);
      if (o.lp) biq(a, 'lp', o.lp, 0.7, SR_D); return a;
    },
    snare(o) {
      const n = Math.floor((o.len || 0.4) * SR_D), a = new Float32Array(n), nz = new Float32Array(n);
      for (let i = 0; i < n; i++) { const t = i / SR_D; a[i] = (Math.sin(TAU * (o.tone || 185) * t) * Math.exp(-t / 0.055) * 0.55 + Math.sin(TAU * (o.tone || 185) * 1.8 * t) * Math.exp(-t / 0.035) * 0.25) * (o.body != null ? o.body : 1); nz[i] = (rnd() * 2 - 1) * Math.exp(-t / (o.dec || 0.16)) * (o.att ? Math.min(1, t / o.att) : 1); }
      biq(nz, 'hp', o.hp || 1200, 0.7, SR_D); if (o.lp) biq(nz, 'lp', o.lp, 0.7, SR_D); addInto(a, nz, o.noise || 0.85); return a;
    },
    clap() {
      const n = Math.floor(0.4 * SR_D), a = new Float32Array(n);
      for (let i = 0; i < n; i++) { const t = i / SR_D; let e = Math.exp(-t / 0.12) * 0.6; for (const o of [0, 0.011, 0.022]) if (t >= o) e += Math.exp(-(t - o) / 0.004); a[i] = (rnd() * 2 - 1) * e; }
      return biq(biq(a, 'bp', 1150, 1.1, SR_D), 'hp', 500, 0.7, SR_D);
    },
    metal(o) {
      const n = Math.floor((o.len || 0.3) * SR_D), a = new Float32Array(n), F = [205.3, 304.4, 369.6, 522.7, 540, 800].map((x) => x * (o.k || 1.6));
      for (let i = 0; i < n; i++) { const t = i / SR_D; let s = 0; for (const f of F) s += Math.sin(TAU * f * t) > 0 ? 1 : -1; a[i] = (s / 6 * (o.metal != null ? o.metal : 0.6) + (rnd() * 2 - 1) * (1 - (o.metal != null ? o.metal : 0.6))) * Math.exp(-t / o.dec) * (o.att ? Math.min(1, t / o.att) : 1); }
      biq(a, 'hp', o.hp || 7000, 0.7, SR_D); if (o.bp) biq(a, 'bp', o.bp, 0.8, SR_D); if (o.lp) biq(a, 'lp', o.lp, 0.7, SR_D);
      if (o.bell) addInto(a, Float32Array.from({ length: n }, (_, i) => Math.sin(TAU * o.bell * i / SR_D) * Math.exp(-i / (0.5 * SR_D)) * 0.15), 1);
      return a;
    },
    tom(o) { const n = Math.floor(0.6 * SR_D), a = new Float32Array(n); let ph = 0; for (let i = 0; i < n; i++) { const t = i / SR_D; ph += TAU * o.f * (1 + 0.4 * Math.exp(-t / 0.05)) / SR_D; a[i] = Math.sin(ph) * Math.exp(-t / (o.dec || 0.3)) + (rnd() * 2 - 1) * Math.exp(-t / 0.02) * 0.2; } return a; },
    noise(o) { const n = Math.floor((o.len || 0.2) * SR_D), a = new Float32Array(n); for (let i = 0; i < n; i++) { const t = i / SR_D; a[i] = (rnd() * 2 - 1) * (o.att ? Math.min(1, t / o.att) : 1) * Math.exp(-Math.max(0, t - (o.att || 0)) / o.dec); } if (o.hp) biq(a, 'hp', o.hp, 0.7, SR_D); if (o.bp) biq(a, 'bp', o.bp, o.q || 1, SR_D); if (o.lp) biq(a, 'lp', o.lp, 0.7, SR_D); return a; },
    tone(o) { const n = Math.floor((o.len || 0.3) * SR_D), a = new Float32Array(n); for (let i = 0; i < n; i++) { const t = i / SR_D; let s = 0; for (const [f, amp, d] of o.p) s += Math.sin(TAU * f * t) * amp * Math.exp(-t / d); a[i] = s; } if (o.nz) addInto(a, DG.noise({ len: 0.05, dec: 0.006, bp: o.nzf || 3000, q: 1.5 }), o.nz); if (o.sq) { for (let i = 0; i < n; i++) a[i] = Math.tanh(a[i] * o.sq); } if (o.bp) biq(a, 'bp', o.bp, 1.5, SR_D); return a; },
    heart() { const n = Math.floor(0.7 * SR_D), a = new Float32Array(n); for (const [o, f0, v] of [[0, 62, 1], [0.24, 54, 0.75]]) { let ph = 0; for (let i = Math.floor(o * SR_D); i < n; i++) { const t = i / SR_D - o; ph += TAU * (f0 * 0.7 + f0 * 0.3 * Math.exp(-t / 0.03)) / SR_D; a[i] += Math.sin(ph) * Math.exp(-t / 0.09) * v * Math.min(1, t / 0.006); } } return biq(a, 'lp', 400, 0.7, SR_D); },
    taiko(o) { const n = Math.floor(1.4 * SR_D), a = new Float32Array(n); let ph = 0; for (let i = 0; i < n; i++) { const t = i / SR_D; ph += TAU * (o.f * (1 + 0.6 * Math.exp(-t / 0.04))) / SR_D; a[i] = Math.tanh(1.6 * Math.sin(ph) * Math.exp(-t / o.dec)) + (rnd() * 2 - 1) * Math.exp(-t / 0.03) * 0.35; } return biq(a, 'lp', o.lp || 1600, 0.7, SR_D); },
    vinyl() { const n = Math.floor(2 * SR_D), a = new Float32Array(n); for (let i = 0; i < n; i++) a[i] = (rnd() * 2 - 1) * 0.05 + (rnd() < 0.0004 ? (rnd() * 2 - 1) * 0.9 : 0); return biq(biq(a, 'lp', 5000, 0.7, SR_D), 'hp', 700, 0.7, SR_D); },
    swell() { const n = Math.floor(1.6 * SR_D), a = new Float32Array(n); for (let i = 0; i < n; i++) { const k = i / n; a[i] = (rnd() * 2 - 1) * Math.pow(k, 3) * (k > 0.97 ? (1 - k) / 0.03 : 1); } return biq(a, 'hp', 3500, 0.7, SR_D); },
  };
  const P = (gen, o = {}, gain = 1) => ({ gen, o, gain });
  const STD = {
    k: P('kick', { f0: 155, f1: 50, dec: 0.3 }, 1), s: P('snare', { tone: 190, dec: 0.17 }, 0.6), c: P('clap', {}, 0.55),
    h: P('metal', { dec: 0.04, len: 0.12 }, 0.28), o: P('metal', { dec: 0.28, len: 0.6 }, 0.25), r: P('metal', { dec: 0.9, len: 2, hp: 3000, bp: 5500, metal: 0.45, bell: 3100, k: 1.2 }, 0.22),
    y: P('metal', { dec: 1.2, len: 2.6, hp: 2500, metal: 0.3, k: 1.1 }, 0.3), t1: P('tom', { f: 85, dec: 0.4 }, 0.6), t2: P('tom', { f: 120, dec: 0.32 }, 0.55), t3: P('tom', { f: 170, dec: 0.26 }, 0.5),
    sh: P('noise', { dec: 0.05, att: 0.015, hp: 5000, bp: 8000, len: 0.15 }, 0.25), tb: P('metal', { dec: 0.14, len: 0.3, hp: 6000, metal: 0.5, k: 4.5 }, 0.22),
    cb: P('tone', { p: [[587, 1, 0.12], [845, 0.8, 0.09]], len: 0.4, sq: 2.5, bp: 800 }, 0.22), wb: P('tone', { p: [[1100, 1, 0.035], [2300, 0.3, 0.01]], nz: 0.3, len: 0.2 }, 0.4),
    wb2: P('tone', { p: [[760, 1, 0.04], [1700, 0.3, 0.01]], nz: 0.3, len: 0.2 }, 0.4),
    rim: P('tone', { p: [[1750, 0.7, 0.012], [420, 0.6, 0.025]], nz: 0.6, nzf: 3500, len: 0.12 }, 0.45), sn: P('noise', { dec: 0.012, bp: 2400, q: 2.5, len: 0.08 }, 0.7),
    br: P('noise', { dec: 0.12, att: 0.04, lp: 5000, hp: 1500, len: 0.3 }, 0.3), hb: P('heart', {}, 1), tk: P('taiko', { f: 70, dec: 0.6 }, 0.9), fd: P('taiko', { f: 115, dec: 0.25, lp: 2500 }, 0.55),
    vn: P('vinyl', {}, 0.4), tick: P('tone', { p: [[2800, 1, 0.012], [5600, 0.3, 0.006]], nz: 0.2, len: 0.06 }, 0.3), tock: P('tone', { p: [[1900, 1, 0.015], [3900, 0.3, 0.006]], nz: 0.2, len: 0.06 }, 0.3),
    cg: P('tom', { f: 210, dec: 0.15 }, 0.4), bg: P('tom', { f: 360, dec: 0.1 }, 0.35), tri: P('tone', { p: [[4200, 0.6, 1.2], [6100, 0.3, 0.9], [8300, 0.2, 0.6]], len: 1.8 }, 0.14), sw: P('swell', {}, 0.3),
  };
  const KITS = {
    std: STD,
    funk: { k: P('kick', { f0: 175, f1: 54, dec: 0.22, click: 0.4 }, 1), s: P('snare', { tone: 210, dec: 0.12, hp: 1800 }, 0.62), h: P('metal', { dec: 0.03, len: 0.1 }, 0.26) },
    jazz: { k: P('kick', { f0: 110, f1: 58, dec: 0.22, click: 0.1 }, 0.7), s: P('snare', { tone: 200, dec: 0.2, hp: 1500, lp: 6000, body: 0.6 }, 0.45), h: P('metal', { dec: 0.05, len: 0.15, lp: 9000 }, 0.2) },
    lofi: { k: P('kick', { f0: 130, f1: 48, dec: 0.3, lp: 2500, click: 0.1 }, 1), s: P('snare', { tone: 175, dec: 0.15, lp: 4200, hp: 900 }, 0.6), h: P('metal', { dec: 0.035, len: 0.1, lp: 8000, hp: 5000 }, 0.2), o: P('metal', { dec: 0.2, len: 0.5, lp: 8000 }, 0.18) },
    808: { k: P('kick', { f0: 120, f1: 46, dec: 0.75, len: 1.2, click: 0.15, drive: 2 }, 0.95), s: P('snare', { tone: 240, dec: 0.13, hp: 2000 }, 0.5), h: P('metal', { dec: 0.03, len: 0.1, metal: 0.8 }, 0.22) },
    orch: { k: P('kick', { f0: 70, f1: 40, dec: 0.9, len: 1.5, click: 0.05, lp: 900, drive: 1 }, 1), s: P('snare', { tone: 230, dec: 0.12, hp: 2200, body: 0.5 }, 0.5), y: P('metal', { dec: 1.6, len: 3, hp: 1800, metal: 0.25, k: 0.9 }, 0.32) },
    world: { k: P('taiko', { f: 62, dec: 0.7 }, 0.95), s: P('snare', { tone: 170, dec: 0.2, hp: 600, lp: 4000 }, 0.5), h: P('noise', { dec: 0.04, hp: 4000, len: 0.1 }, 0.2) },
  };
  const drumCache = new Map();
  function drumBuf(kit, piece) {
    const k = kit + ':' + piece; let b = drumCache.get(k);
    if (b !== undefined) return b;
    const spec = (KITS[kit] && KITS[kit][piece]) || STD[piece];
    if (!spec) { drumCache.set(k, null); return null; }
    const d = DG[spec.gen](spec.o); norm(d, 0.9);
    b = new AudioBuffer({ length: d.length, sampleRate: SR_D, numberOfChannels: 1 }); b.copyToChannel(d, 0);
    b.gain = spec.gain; drumCache.set(k, b); return b;
  }

  // ---------------------------------------------------------------- live synth voices
  // Each returns the time the voice is silent (for the voice count).
  const DEF = { // per-type mixer defaults
    pad: { vol: 0.5, rev: 0.4, hp: 170 }, strings: { vol: 0.55, rev: 0.35, hp: 110 }, choir: { vol: 0.55, rev: 0.45, hp: 150 }, brass: { vol: 0.5, rev: 0.22 }, mute: { vol: 0.5, rev: 0.25, dly: 0.12 }, sax: { vol: 0.5, rev: 0.25 },
    organ: { vol: 0.45, rev: 0.2 }, bass: { vol: 0.7, rev: 0 }, synthbass: { vol: 0.6, rev: 0 }, sub808: { vol: 0.7, rev: 0 }, tuba: { vol: 0.65, rev: 0.08 },
    lead: { vol: 0.42, rev: 0.2, dly: 0.12 }, flute: { vol: 0.5, rev: 0.3, dly: 0.1 }, whistle: { vol: 0.45, rev: 0.3, dly: 0.15 }, clarinet: { vol: 0.5, rev: 0.25 }, sine: { vol: 0.45, rev: 0.4, dly: 0.2 },
    fmkeys: { vol: 0.5, rev: 0.25 }, pluck: { vol: 0.45, rev: 0.25, dly: 0.15 }, clav: { vol: 0.45, rev: 0.1, hp: 200 },
    piano: { vol: 0.55, rev: 0.22 }, honky: { vol: 0.55, rev: 0.15 }, epiano: { vol: 0.55, rev: 0.22 }, vibes: { vol: 0.5, rev: 0.3 }, marimba: { vol: 0.55, rev: 0.2 }, glock: { vol: 0.45, rev: 0.3 },
    celesta: { vol: 0.45, rev: 0.35 }, musicbox: { vol: 0.45, rev: 0.4 }, kalimba: { vol: 0.5, rev: 0.3 }, chime: { vol: 0.4, rev: 0.45 }, cbell: { vol: 0.4, rev: 0.5 }, timp: { vol: 0.6, rev: 0.3 },
    guitar: { vol: 0.5, rev: 0.2 }, nylon: { vol: 0.55, rev: 0.22 }, harpsi: { vol: 0.42, rev: 0.25, hp: 90 }, pizz: { vol: 0.6, rev: 0.3 }, banjo: { vol: 0.45, rev: 0.15 }, harp: { vol: 0.5, rev: 0.35 }, lute: { vol: 0.5, rev: 0.25 }, upright: { vol: 0.75, rev: 0.05 },
    drums: { vol: 0.75, rev: 0.08 },
  };
  function adsr(g, t, dur, peak, a, d, s, r) {
    a = Math.min(a, Math.max(0.003, dur * 0.85));
    const p = g.gain; p.setValueAtTime(0, t); p.linearRampToValueAtTime(peak, t + a);
    if (s !== 1) p.setTargetAtTime(peak * s, t + a, Math.max(0.01, d / 3));
    p.setTargetAtTime(0, t + Math.max(dur, a), Math.max(0.005, r / 4));
    return t + Math.max(dur, a) + r * 1.6;
  }
  // Vibrato as an automation curve on each oscillator's detune (no extra nodes per voice).
  function vib(c, t, dur, oscs, hz, cents, delay) {
    const len = dur - delay; if (len < 0.15 || !cents) return;
    const n = Math.min(1600, Math.ceil(len * 40) + 2), ph = rnd() * TAU; hz *= 0.95 + rnd() * 0.1;
    for (const o of oscs) {
      const base = o._det || 0, a = new Float32Array(n);
      for (let i = 0; i < n; i++) { const tt = (i / (n - 1)) * len; a[i] = base + cents * Math.min(1, tt / 0.35) * Math.sin(ph + TAU * hz * tt); }
      try { o.detune.setValueAtTime(base, t + delay); o.detune.setValueCurveAtTime(a, t + delay, len); } catch { /* overlapping automation */ }
    }
  }
  function mkOsc(c, type, f, t, det, end, dest) { const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t); if (det) o.detune.setValueAtTime(det, t); o._det = det || 0; o.connect(dest); o.start(t); o.stop(end); return o; }
  function filt(c, type, f, q) { const b = c.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q == null ? 0.7 : q; return b; }
  const SYNTH = {
    pad(c, T, out, f, t, dur, amp) {
      const g = c.createGain(), lp = filt(c, 'lowpass', 0, 0.6), cut = T.cut || 2200, att = T.att != null ? T.att : 0.9;
      lp.frequency.setValueAtTime(cut * 0.35, t); lp.frequency.linearRampToValueAtTime(cut, t + att * 1.3);
      lp.connect(g); g.connect(out);
      const end = adsr(g, t, dur, 0.06 * amp, att, 1, 1, T.rel != null ? T.rel : 1.4);
      if (dur > att * 1.3 + 1) lp.frequency.setTargetAtTime(cut * (0.6 + rnd() * 0.25), t + att * 1.3, dur * 0.5);
      for (const d of [-14, 0, 13]) mkOsc(c, T.wave || 'sawtooth', f, t, d + (rnd() - 0.5) * 6, end, lp);
      return end;
    },
    strings(c, T, out, f, t, dur, amp) {
      const g = c.createGain(), lp = filt(c, 'lowpass', T.cut || 3200, 0.6); lp.connect(g); g.connect(out);
      const end = adsr(g, t, dur, 0.075 * amp, T.att != null ? T.att : 0.28, 0.4, 0.85, T.rel != null ? T.rel : 0.45);
      const os = [-7, 7].map((d) => mkOsc(c, 'sawtooth', f, t, d, end, lp));
      vib(c, t, dur, os, 5.3, T.vib != null ? T.vib : 9, Math.min(0.4, dur * 0.5));
      return end;
    },
    choir(c, T, out, f, t, dur, amp) {
      const g = c.createGain(), bs = []; g.connect(out);
      for (const [ff, q, k] of [[700, 5, 1], [1150, 6, 0.55], [2600, 7, 0.22]]) { const b = filt(c, 'bandpass', ff * (T.formant || 1), q), bg = c.createGain(); bg.gain.value = k; b.connect(bg); bg.connect(g); bs.push(b); }
      const end = adsr(g, t, dur, 0.5 * amp, T.att != null ? T.att : 0.5, 1, 1, T.rel != null ? T.rel : 0.9);
      const os = [-9, 9].map((d) => { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = d; o._det = d; for (const b of bs) o.connect(b); o.start(t); o.stop(end); return o; });
      vib(c, t, dur, os, 5, 12, 0.3);
      return end;
    },
    brass(c, T, out, f, t, dur, amp) {
      const g = c.createGain(), lp = filt(c, 'lowpass', f * 1.5, 1.4), br = T.bright || 1; lp.connect(g); g.connect(out);
      lp.frequency.setValueAtTime(f * 1.2, t); lp.frequency.linearRampToValueAtTime(Math.min(14000, f * (3 + 6 * amp) * br), t + 0.05);
      lp.frequency.setTargetAtTime(Math.min(9000, f * 3.2 * br), t + 0.06, 0.15);
      const end = adsr(g, t, dur, 0.075 * amp, T.att != null ? T.att : 0.025, 0.3, 0.75, T.rel != null ? T.rel : 0.12);
      lp.frequency.setTargetAtTime(f * 1.2, t + dur, 0.05);
      const os = [-6, 5].map((d) => { const o = mkOsc(c, 'sawtooth', f, t, d - 30, end, lp); o._det = d; o.detune.linearRampToValueAtTime(d, t + 0.06); return o; });
      if (dur > 0.45) vib(c, t, dur, os, 5.4, 8, 0.35);
      return end;
    },
    mute(c, T, out, f, t, dur, amp) {
      const g = c.createGain(), bp = filt(c, 'bandpass', 1500, 2.2), hp = filt(c, 'highpass', 500); bp.connect(hp); hp.connect(g); g.connect(out);
      const end = adsr(g, t, dur, 0.24 * amp, 0.02, 0.3, 0.8, 0.09);
      const o = mkOsc(c, 'sawtooth', f, t, -25, end, bp); o._det = 0; o.detune.linearRampToValueAtTime(0, t + 0.05);
      vib(c, t, dur, [o], 5.6, 10, Math.min(0.3, dur * 0.5));
      return end;
    },
    sax(c, T, out, f, t, dur, amp) {
      const g = c.createGain(), lp = filt(c, 'lowpass', f * 2, 1.2), pk = filt(c, 'peaking', 1300, 1); pk.gain.value = 6; lp.connect(pk); pk.connect(g); g.connect(out);
      lp.frequency.setValueAtTime(f * 2, t); lp.frequency.linearRampToValueAtTime(Math.min(8000, f * (4 + 3 * amp)), t + 0.06); lp.frequency.setTargetAtTime(Math.min(6000, f * 3.5), t + 0.08, 0.2);
      const end = adsr(g, t, dur, 0.1 * amp, 0.035, 0.3, 0.8, 0.1);
      const o = mkOsc(c, 'sawtooth', f, t, -20, end, lp); o._det = 0; o.detune.linearRampToValueAtTime(0, t + 0.07);
      vib(c, t, dur, [o], 5.2, 13, Math.min(0.3, dur * 0.5));
      return end;
    },
    organ(c, T, out, f, t, dur, amp, E) {
      const g = c.createGain(); g.connect(out);
      const end = adsr(g, t, dur, 0.055 * amp, 0.008, 0.1, 1, 0.07);
      for (const d of [0, 4]) { const o = c.createOscillator(); o.setPeriodicWave(E.organWave()); o.frequency.value = f / 2; o.detune.value = d; o.connect(g); o.start(t); o.stop(end); }
      return end;
    },
    bass(c, T, out, f, t, dur, amp) {
      const g = c.createGain(), lp = filt(c, 'lowpass', T.cut || 800, 1), sg = c.createGain(); sg.gain.value = 0.4; lp.connect(sg); sg.connect(g); g.connect(out);
      lp.frequency.setValueAtTime((T.cut || 800) * 2.2, t); lp.frequency.setTargetAtTime(T.cut || 800, t + 0.01, 0.05);
      const end = adsr(g, t, dur, 0.3 * amp, 0.006, 0.4, 0.75, T.rel != null ? T.rel : 0.07);
      mkOsc(c, 'sine', f, t, 0, end, g); mkOsc(c, 'sawtooth', f, t, 0, end, lp);
      return end;
    },
    synthbass(c, T, out, f, t, dur, amp) {
      const g = c.createGain(), lp = filt(c, 'lowpass', f * 1.5, T.q || 7); lp.connect(g); g.connect(out);
      lp.frequency.setValueAtTime(f * 1.5, t); lp.frequency.linearRampToValueAtTime(Math.min(5000, f * (6 + 10 * amp)), t + 0.012); lp.frequency.setTargetAtTime(f * 2.5, t + 0.015, 0.07);
      const end = adsr(g, t, dur, 0.17 * amp, 0.004, 0.25, 0.6, 0.05);
      mkOsc(c, 'sawtooth', f, t, 0, end, lp); mkOsc(c, 'square', f, t, -8, end, lp);
      const sg = c.createGain(); sg.gain.value = 0.9; sg.connect(g); mkOsc(c, 'sine', f, t, 0, end, sg);
      return end;
    },
    sub808(c, T, out, f, t, dur, amp) {
      const g = c.createGain(); g.connect(out);
      const end = adsr(g, t, dur, 0.38 * amp, 0.003, 1.2, 0.6, 0.2);
      const o = mkOsc(c, 'sine', f * 1.5, t, 0, end, g); o.frequency.exponentialRampToValueAtTime(f, t + 0.035);
      return end;
    },
    tuba(c, T, out, f, t, dur, amp) {
      const g = c.createGain(), lp = filt(c, 'lowpass', f * 3, 1); lp.connect(g); g.connect(out);
      lp.frequency.setValueAtTime(f * 1.5, t); lp.frequency.linearRampToValueAtTime(f * 5, t + 0.05); lp.frequency.setTargetAtTime(f * 3, t + 0.06, 0.1);
      const end = adsr(g, t, dur, 0.2 * amp, 0.025, 0.3, 0.7, 0.08);
      mkOsc(c, 'sawtooth', f, t, 0, end, lp); const sg = c.createGain(); sg.gain.value = 0.6; sg.connect(g); mkOsc(c, 'sine', f, t, 0, end, sg);
      return end;
    },
    lead(c, T, out, f, t, dur, amp, E, gl) {
      const g = c.createGain(), lp = filt(c, 'lowpass', T.cut || 3500, T.q || 1); lp.connect(g); g.connect(out);
      const end = adsr(g, t, dur, 0.06 * amp, T.att != null ? T.att : 0.01, 0.3, 0.8, T.rel != null ? T.rel : 0.08);
      const os = (T.uni ? [-6, 6] : [0]).map((d) => { const o = mkOsc(c, T.wave || 'square', gl ? mtof(gl) : f, t, d, end, lp); if (gl) o.frequency.exponentialRampToValueAtTime(f, t + (T.glide || 0.07)); return o; });
      vib(c, t, dur, os, 5.5, T.vib != null ? T.vib : 10, 0.25);
      return end;
    },
    flute(c, T, out, f, t, dur, amp, E) {
      const g = c.createGain(); g.connect(out);
      const end = adsr(g, t, dur, 0.12 * amp, T.att != null ? T.att : 0.05, 0.3, 0.85, 0.12);
      const o1 = mkOsc(c, 'sine', f, t, 0, end, g); const tg = c.createGain(); tg.gain.value = 0.22; tg.connect(g); const o2 = mkOsc(c, 'triangle', f, t, 0, end, tg);
      vib(c, t, dur, [o1, o2], 5, T.vib != null ? T.vib : 12, 0.2);
      const n = c.createBufferSource(); n.buffer = E.noise(); const b = filt(c, 'bandpass', Math.min(9000, f * 2), 1.5), ng = c.createGain();
      ng.gain.setValueAtTime(0, t); ng.gain.linearRampToValueAtTime(0.5 * amp, t + 0.03); ng.gain.setTargetAtTime(0.06 * amp, t + 0.04, 0.05); ng.gain.setTargetAtTime(0, t + dur, 0.03);
      n.connect(b); b.connect(ng); ng.connect(g); n.start(t, rnd()); n.stop(end);
      return end;
    },
    whistle(c, T, out, f, t, dur, amp, E, gl) {
      const g = c.createGain(); g.connect(out);
      const end = adsr(g, t, dur, 0.1 * amp, 0.03, 0.3, 0.85, 0.1);
      const o = mkOsc(c, 'sine', gl ? mtof(gl) : f, t, 0, end, g); if (gl) o.frequency.exponentialRampToValueAtTime(f, t + 0.08);
      vib(c, t, dur, [o], 5.8, T.vib != null ? T.vib : 16, 0.15);
      return end;
    },
    clarinet(c, T, out, f, t, dur, amp) {
      const g = c.createGain(), lp = filt(c, 'lowpass', Math.min(6000, f * 5), 0.8); lp.connect(g); g.connect(out);
      const end = adsr(g, t, dur, 0.07 * amp, T.att != null ? T.att : 0.03, 0.2, 0.85, 0.08);
      const o = mkOsc(c, 'square', f, t, 0, end, lp); vib(c, t, dur, [o], 4.8, 6, 0.3);
      return end;
    },
    sine(c, T, out, f, t, dur, amp, E, gl) {
      const g = c.createGain(); g.connect(out);
      const end = adsr(g, t, dur, 0.11 * amp, T.att != null ? T.att : 0.08, 0.3, 0.9, T.rel != null ? T.rel : 0.3);
      const o = mkOsc(c, 'sine', gl ? mtof(gl) : f, t, 0, end, g); if (gl) o.frequency.exponentialRampToValueAtTime(f, t + (T.glide || 0.15));
      vib(c, t, dur, [o], T.vhz || 6, T.vib != null ? T.vib : 22, 0.1);
      return end;
    },
    fmkeys(c, T, out, f, t, dur, amp) {
      const g = c.createGain(); g.connect(out);
      const end = adsr(g, t, dur, 0.13 * amp, 0.003, T.dec || 0.5, T.sus != null ? T.sus : 0.25, T.rel != null ? T.rel : 0.2);
      const car = mkOsc(c, 'sine', f, t, 0, end, g), mg = c.createGain();
      mg.gain.setValueAtTime(f * (T.index || 2.2) * amp, t); mg.gain.setTargetAtTime(f * 0.25, t + 0.005, 0.12);
      const mod = c.createOscillator(); mod.frequency.value = f * (T.ratio || 2); mod.connect(mg); mg.connect(car.frequency); mod.start(t); mod.stop(end);
      return end;
    },
    pluck(c, T, out, f, t, dur, amp) {
      const g = c.createGain(), lp = filt(c, 'lowpass', f, T.q || 2); lp.connect(g); g.connect(out);
      lp.frequency.setValueAtTime(Math.min(12000, f * (T.open || 10)), t); lp.frequency.setTargetAtTime(f * 1.3, t + 0.005, T.fdec || 0.09);
      const end = adsr(g, t, dur, 0.1 * amp, 0.002, T.dec || 0.35, T.sus || 0.0, T.rel || 0.12);
      mkOsc(c, 'sawtooth', f, t, -5, end, lp); mkOsc(c, 'sawtooth', f, t, 5, end, lp);
      return end;
    },
    clav(c, T, out, f, t, dur, amp) {
      const g = c.createGain(), lp = filt(c, 'lowpass', f * 3, 4); lp.connect(g); g.connect(out);
      lp.frequency.setValueAtTime(Math.min(9000, f * 12), t); lp.frequency.setTargetAtTime(f * 3, t + 0.003, 0.05);
      const end = adsr(g, t, Math.min(dur, 0.35), 0.11 * amp, 0.001, 0.2, 0.35, 0.03);
      mkOsc(c, 'square', f, t, 0, end, lp); mkOsc(c, 'sawtooth', f * 2, t, 3, end, lp);
      return end;
    },
  };

  // ---------------------------------------------------------------- reverb IR
  function makeIR(c, sec = 2.6, pre = 0.018) {
    const sr = c.sampleRate, n = Math.floor(sec * sr), b = c.createBuffer(2, n, sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch); let lp = 0;
      for (let i = Math.floor(pre * sr); i < n; i++) {
        const t = i / sr, k = clamp(0.85 - t * 0.28, 0.12, 0.85); lp += k * ((rnd() * 2 - 1) - lp);
        d[i] = lp * Math.exp(-t * 6.9 / (sec * 0.82));
      }
      for (const [ms, a] of [[11, 0.5], [19, 0.35], [27, 0.3], [41, 0.22], [53, 0.16]]) { const i = Math.floor((pre + ms / 1000 + ch * 0.0031) * sr); if (i < n) d[i] += a * (ch ? -1 : 1); }
    }
    return b;
  }

  // ---------------------------------------------------------------- the engine
  function Engine(ctx, opt = {}) {
    const E = this; E.ctx = ctx; E.offline = !!opt.offline; E.active = []; E.maxActive = 0; E.players = new Set();
    const c = ctx, G = (v = 1) => { const g = c.createGain(); g.gain.value = v; return g; };
    E.masterIn = G(0.62);
    const hp = filt(c, 'highpass', 28, 0.7);
    const comp = c.createDynamicsCompressor(); comp.threshold.value = -16; comp.knee.value = 8; comp.ratio.value = 3; comp.attack.value = 0.012; comp.release.value = 0.22;
    const lim = c.createDynamicsCompressor(); lim.threshold.value = -3; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.002; lim.release.value = 0.09;
    const trim = G(0.82);
    const clip = c.createWaveShaper(); const curve = new Float32Array(2049);
    for (let i = 0; i < curve.length; i++) { const x = (i / 1024) - 1, ax = Math.abs(x) * 1.3; curve[i] = Math.sign(x) * (ax < 0.7 ? ax : 0.7 + 0.28 * Math.tanh((ax - 0.7) / 0.28)); }
    clip.curve = curve;
    E.vol = G(1);
    E.masterIn.connect(hp); hp.connect(comp); comp.connect(lim); lim.connect(trim); trim.connect(clip); clip.connect(E.vol);
    if (opt.analyse) {
      const m = c.createChannelMerger(4), s1 = c.createChannelSplitter(2), s2 = c.createChannelSplitter(2);
      E.vol.connect(s1); s1.connect(m, 0, 0); s1.connect(m, 1, 1); E.masterIn.connect(s2); s2.connect(m, 0, 2); s2.connect(m, 1, 3);
      c.destination.channelInterpretation = 'discrete'; m.connect(c.destination);
    } else E.vol.connect(c.destination);
    // shared reverb + ping-pong delay
    E.verb = c.createConvolver(); E.verb.buffer = makeIR(c); const vr = G(0.9); E.verb.connect(vr); vr.connect(E.masterIn);
    const dIn = G(1), dL = c.createDelay(2), dR = c.createDelay(2), fb = G(0.34), fb2 = G(0.34), mg = c.createChannelMerger(2), dhp = filt(c, 'highpass', 350), dlp = filt(c, 'lowpass', 3800), dOut = G(0.7);
    dL.delayTime.value = 0.375; dR.delayTime.value = 0.375;
    dIn.connect(dL); dL.connect(fb); fb.connect(dR); dR.connect(fb2); fb2.connect(dL); dL.connect(mg, 0, 0); dR.connect(mg, 0, 1); mg.connect(dhp); dhp.connect(dlp); dlp.connect(dOut); dOut.connect(E.masterIn);
    const dv = G(0.15); dlp.connect(dv); dv.connect(E.verb);
    E.setDelay = (sec) => { const t = c.currentTime; for (const d of [dL, dR]) d.delayTime.setTargetAtTime(clamp(sec, 0.05, 1.9), t, 0.05); };
    // buses: music (volume x duck) and sfx
    const bus = (lvl) => { const b = { dry: G(lvl), rev: G(lvl), dly: G(lvl) }; b.dry.connect(E.masterIn); b.rev.connect(E.verb); b.dly.connect(dIn); return b; };
    E.music = bus(1); E.sfx = bus(1);
    E.level = (b, v, ramp = 0.08) => { const t = c.currentTime; for (const g of [b.dry, b.rev, b.dly]) { g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value, t); g.gain.linearRampToValueAtTime(v, t + ramp); } };
    let nb = null; E.noise = () => { if (!nb) { nb = c.createBuffer(1, c.sampleRate * 2, c.sampleRate); const d = nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = rnd() * 2 - 1; } return nb; };
    let ow = null; E.organWave = () => { if (!ow) { const re = new Float32Array(17), im = new Float32Array(17); [[1, 0.55], [2, 1], [3, 0.55], [4, 0.6], [6, 0.35], [8, 0.4], [10, 0.12], [16, 0.15]].forEach(([h, a]) => { im[h] = a; }); ow = c.createPeriodicWave(re, im); } return ow; };
  }
  Engine.prototype.cueBus = function (dest, fadeIn, t) {
    const c = this.ctx, b = {}; for (const k of ['dry', 'rev', 'dly']) { b[k] = c.createGain(); b[k].gain.setValueAtTime(fadeIn ? 0 : 1, t); if (fadeIn) b[k].gain.linearRampToValueAtTime(1, t + fadeIn); b[k].connect(dest[k]); }
    return b;
  };
  Engine.prototype.strip = function (T, b) {
    const c = this.ctx, d = DEF[T.type] || {}, nodes = [];
    const pick = (k, dv) => (T[k] != null ? T[k] : d[k] != null ? d[k] : dv);
    const g = c.createGain(); g.gain.value = pick('vol', 0.55); nodes.push(g);
    let n = g;
    const hpf = pick('hp', 0); if (hpf) { const f = filt(c, 'highpass', hpf); n.connect(f); n = f; nodes.push(f); }
    if (T.lp) { const f = filt(c, 'lowpass', T.lp); n.connect(f); n = f; nodes.push(f); }
    if (T.trem) { const tg = c.createGain(), l = c.createOscillator(), lg = c.createGain(); tg.gain.value = 1 - T.trem / 2; l.frequency.value = T.tremHz || 4.5; lg.gain.value = T.trem / 2; l.connect(lg); lg.connect(tg.gain); l.start(); n.connect(tg); n = tg; nodes.push(tg, l, lg); }
    const pan = c.createStereoPanner(); pan.pan.value = pick('pan', 0); n.connect(pan); pan.connect(b.dry); nodes.push(pan);
    const rv = pick('rev', 0.2); if (rv) { const s = c.createGain(); s.gain.value = rv; pan.connect(s); s.connect(b.rev); nodes.push(s); }
    const dl = pick('dly', 0); if (dl) { const s = c.createGain(); s.gain.value = dl; pan.connect(s); s.connect(b.dly); nodes.push(s); }
    return { input: g, nodes };
  };
  const MAXV = 60;
  Engine.prototype.room = function (prio) {
    const now = this.offline ? (this._now || 0) : this.ctx.currentTime;
    if (this.active.length > 16) this.active = this.active.filter((e) => e > now);
    return !!prio || this.active.length < MAXV;
  };
  Engine.prototype.add = function (end) { this.active.push(end); if (this.active.length > this.maxActive) this.maxActive = this.active.length; };
  Engine.prototype.voice = function (T, strip, midi, t, dur, vel, gl) {
    const c = this.ctx, out = strip.input, amp = Math.pow(clamp(vel, 0.05, 1.2), 1.4), type = T.type;
    const S = SAMPLED[type];
    if (S) {
      const b = sampleBuf(type, midi), src = c.createBufferSource(), g = c.createGain(); src.buffer = b;
      if (T.detune) src.detune.value = T.detune;
      const pk = amp * S.gain; g.gain.setValueAtTime(pk, t);
      const off = t + dur * (T.ring != null ? T.ring : S.ring || 1), rel = T.rel != null ? T.rel : S.rel;
      let end = t + b.duration;
      if (off < end) { g.gain.setValueAtTime(pk, off); g.gain.setTargetAtTime(0, off, rel / 4); end = Math.min(end, off + rel * 1.5); }
      if (!this.room(T.prio)) return; this.add(end);
      src.connect(g); g.connect(out); src.start(t); src.stop(end + 0.02);
      return end;
    }
    const fn = SYNTH[type]; if (!fn) return;
    if (!this.room(T.prio)) return;
    const end = fn(c, T, out, mtof(midi), t, Math.max(0.02, dur), amp, this, gl);
    this.add(end);
    return end;
  };
  Engine.prototype.drum = function (kit, piece, t, vel, out) {
    const b = drumBuf(kit || 'std', piece); if (!b) return;
    const c = this.ctx, src = c.createBufferSource(), g = c.createGain(); src.buffer = b;
    g.gain.value = b.gain * Math.pow(clamp(vel, 0.05, 1.2), 1.3);
    src.connect(g); g.connect(out); src.start(t);
    this.add(t + b.duration);
  };

  // ---------------------------------------------------------------- player (one cue)
  function Player(E, comp, dest, t0, fadeIn) {
    this.E = E; this.C = comp; this.t0 = t0; this.fi = 0; this.secStart = t0; this.ei = 0; this.stopAt = Infinity; this.done = false;
    this.bus = E.cueBus(dest, fadeIn, t0); this.strips = {}; this.trk = {}; this.last = {};
    for (const [n, T] of Object.entries(comp.tracks)) { this.trk[n] = T; this.strips[n] = E.strip(T, this.bus); }
    this.barDur = comp.beats * 60 / comp.bpm; this.beatDur = 60 / comp.bpm;
  }
  Player.prototype.pump = function (until) {
    const C = this.C, E = this.E;
    until = Math.min(until, this.stopAt);
    for (let guard = 0; guard < 64 && !this.done; guard++) {
      const sec = C.secs[C.form[this.fi]];
      while (this.ei < sec.evs.length) {
        const ev = sec.evs[this.ei], t = this.secStart + stepTime(C, ev.at);
        if (t >= until) return;
        this.ei++;
        try { this.fire(ev, t, this.secStart + stepTime(C, ev.at + ev.dur), sec.vol); } catch (e) { if (!this.err) { this.err = 1; console.error(e); } }
      }
      const end = this.secStart + sec.bars * this.barDur;
      if (end >= until) return;
      this.secStart = end; this.ei = 0; this.fi++;
      if (this.fi >= C.form.length) { if (C.once) { this.done = true; this.endAt = end; return; } this.fi = Math.min(C.loop, C.form.length - 1); }
    }
  };
  Player.prototype.fire = function (ev, t, tEnd, svol) {
    const T = this.trk[ev.tr], st = this.strips[ev.tr]; if (!T || !st) return;
    const E = this.E, h = T.human != null ? T.human : ev.drum ? 0.003 : 0.007;
    t = Math.max(t + (rnd() * 2 - 1) * h, this.E.offline ? 0 : this.E.ctx.currentTime);
    const vel = ev.vel * (1 + (rnd() - 0.5) * 0.12) * svol;
    if (ev.drum) { E.drum(T.kit, ev.drum, t, vel, st.input); if (ev.flam) E.drum(T.kit, ev.drum, t + 0.022, vel * 0.6, st.input); return; }
    const dur = Math.max(0.03, (tEnd - t) * (T.len != null ? T.len : ev.dead ? 0.3 : 0.92));
    const sh = T.mode === 'bass' ? 0 : 12 * (T.oct || 0);
    const strum = T.strum || 0;
    ev.midi.forEach((m, i) => {
      const k = strum ? i : 0;
      E.voice(T, st, m + sh, t + k * strum, dur - k * strum, vel * (T.mode === 'chord' && ev.midi.length > 2 ? 0.8 : 1), ev.glide ? this.last[ev.tr] : null);
    });
    this.last[ev.tr] = ev.midi[ev.midi.length - 1] + sh;
  };
  Player.prototype.nextBar = function (after) { return this.t0 + Math.ceil((after - this.t0) / this.barDur - 1e-6) * this.barDur; };
  Player.prototype.nextBeat = function (after) { return this.t0 + Math.ceil((after - this.t0) / this.beatDur - 1e-6) * this.beatDur; };
  Player.prototype.stop = function (t, fade) {
    if (this.stopping) return; this.stopping = true; this.stopAt = t;
    const c = this.E.ctx;
    for (const g of Object.values(this.bus)) { g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value || 1, t); g.gain.linearRampToValueAtTime(0, t + fade); }
    const ms = (t - c.currentTime + fade + 4) * 1000;
    if (!this.E.offline) setTimeout(() => this.dispose(), ms);
  };
  Player.prototype.dispose = function () {
    this.done = true; this.E.players.delete(this);
    for (const s of Object.values(this.strips)) for (const n of s.nodes) { try { if (n.stop) n.stop(); n.disconnect(); } catch { /* gone */ } }
    for (const g of Object.values(this.bus)) try { g.disconnect(); } catch { /* gone */ }
  };

  // ---------------------------------------------------------------- built-in stingers
  // X: { t, note(type, midi|'c5', at, dur, vel, opts), chord(type, [..], at, dur, vel, strum), drum(piece, at, vel, kit), noise({..}), tone({..}) }
  const STING = {
    cash(X) { X.drum('cb', 0, 0.5); X.noise({ at: 0, dur: 0.18, f0: 3000, type: 'highpass', vol: 0.25 }); X.note('chime', 'e7', 0.08, 0.6, 0.7); X.note('chime', 'g#7', 0.08, 0.6, 0.6); X.note('glock', 'e6', 0.1, 0.4, 0.8); X.drum('sh', 0.25, 0.8); X.drum('sh', 0.3, 0.6); },
    coin(X) { X.note('fmkeys', 'b5', 0, 0.08, 0.8, { ratio: 3, index: 1 }); X.note('fmkeys', 'e6', 0.08, 0.35, 0.8, { ratio: 3, index: 1 }); },
    gavel(X) { for (const a of [0, 0.3]) { X.drum('wb2', a, 1); X.tone({ at: a, dur: 0.15, f0: 180, f1: 90, vol: 0.5 }); X.noise({ at: a, dur: 0.06, f0: 900, q: 2, vol: 0.35 }); } },
    heartbeat(X) { X.drum('hb', 0, 1); },
    groan(X) { X.tone({ at: 0, dur: 1.6, f0: 110, f1: 78, wave: 'sawtooth', vol: 0.09, lp: 600 }); X.tone({ at: 0.05, dur: 1.5, f0: 117, f1: 83, wave: 'sawtooth', vol: 0.07, lp: 500 }); X.noise({ dur: 1.4, f0: 420, q: 3, vol: 0.12 }); },
    roll(X) { for (let i = 0; i < 24; i++) X.drum('s', i * 0.055, 0.25 + i * 0.025, 'orch'); X.drum('y', 24 * 0.055, 1, 'orch'); X.drum('k', 24 * 0.055, 0.9, 'orch'); },
    rimshot(X) { X.drum('t2', 0, 0.7); X.drum('t1', 0.14, 0.8); X.drum('k', 0.3, 0.8); X.drum('y', 0.3, 0.6); },
    tick(X) { X.drum('tick', 0, 0.9); }, tock(X) { X.drum('tock', 0, 0.9); },
    whoosh(X) { X.noise({ dur: 0.55, f0: 400, f1: 3200, q: 1.2, vol: 0.3, att: 0.25 }); },
    riser(X) { X.noise({ dur: 1.4, f0: 300, f1: 6000, q: 2, vol: 0.25, att: 1.3 }); X.tone({ dur: 1.4, f0: 200, f1: 800, wave: 'sawtooth', vol: 0.03, att: 1.3, lp: 3000 }); },
    impact(X) { X.drum('k', 0, 1, '808'); X.drum('tk', 0, 0.9); X.drum('y', 0, 0.7, 'orch'); X.noise({ dur: 1.2, f0: 200, type: 'lowpass', vol: 0.35 }); },
    boom(X) { X.drum('tk', 0, 1); X.tone({ dur: 1.6, f0: 70, f1: 34, vol: 0.5 }); X.noise({ dur: 1.4, f0: 160, type: 'lowpass', vol: 0.4 }); },
    ding(X) { X.note('chime', 'a6', 0, 0.8, 0.8); },
    buzzer(X) { X.tone({ dur: 0.55, f0: 110, wave: 'sawtooth', vol: 0.12, lp: 1200 }); X.tone({ dur: 0.55, f0: 116, wave: 'square', vol: 0.06, lp: 1200 }); },
    chips(X) { for (let i = 0; i < 7; i++) X.tone({ at: i * 0.035 + rnd() * 0.02, dur: 0.05, f0: 3200 + rnd() * 2400, wave: 'triangle', vol: 0.05 }); },
    knock(X) { for (const a of [0, 0.2, 0.4]) X.drum('wb2', a, 0.9); },
    cymbal(X) { X.drum('y', 0, 1, 'orch'); },
    swell(X) { X.drum('sw', 0, 1); },
    crowd(X) { X.noise({ dur: 1.8, f0: 1400, q: 0.8, vol: 0.18, att: 0.15 }); for (let i = 0; i < 10; i++) X.drum('c', 0.1 + i * 0.13 + rnd() * 0.05, 0.3 + rnd() * 0.3); },
  };

  // ---------------------------------------------------------------- score lookup
  const FALLBACK = { lobby: ['title'], intro: ['title', 'play'], think: ['play'], play: ['think'], tense: ['play', 'think'], reveal: ['play', 'think'], finale: ['win', 'title'], win: ['finale', 'title'], board: ['lobby', 'title'], shuffle: ['play', 'title'], lose: ['tense', 'reveal'], story: ['think', 'intro'] };
  function mergeCue(base, d) {
    const out = { ...base, ...d, tracks: { ...base.tracks }, sections: { ...base.sections }, all: { ...(base.all || {}), ...(d.all || {}) } };
    for (const [k, v] of Object.entries(d.tracks || {})) { if (v === null) delete out.tracks[k]; else out.tracks[k] = { ...(base.tracks[k] || {}), ...v }; }
    for (const [k, v] of Object.entries(d.sections || {})) out.sections[k] = { ...(base.sections[k] || {}), ...v };
    for (const k of d.mute || []) delete out.tracks[k];
    out.transpose = (base.transpose || 0) + (d.transpose || 0);
    delete out.from; delete out.mute;
    return out;
  }
  const specCache = new Map(), compCache = new Map();
  function spec(score, name, depth = 0) {
    const raw = score.cues && score.cues[name]; if (!raw || depth > 6) return null;
    if (!raw.from) return raw;
    const base = spec(score, raw.from, depth + 1); return base ? mergeCue(base, raw) : null;
  }
  function resolve(key, name) {
    const sc = BOX.scores[key] || BOX.scores.generic;
    if (!sc) return null;
    const look = (s, n) => (s.cues && s.cues[n] ? n : null);
    let found = look(sc, name) || (sc.alias && sc.alias[name] && look(sc, sc.alias[name]));
    if (!found) for (const f of FALLBACK[name] || []) if ((found = look(sc, f))) break;
    let owner = sc;
    if (!found && BOX.scores.generic && sc !== BOX.scores.generic) { owner = BOX.scores.generic; found = look(owner, name) || look(owner, 'play'); }
    if (!found) return null;
    const ck = (owner === sc ? key : 'generic') + '/' + found;
    if (!compCache.has(ck)) { try { const s = spec(owner, found); compCache.set(ck, s ? compile(s) : null); } catch (e) { console.error('[audio] cue ' + ck, e); compCache.set(ck, null); } }
    return compCache.get(ck) ? { key: ck, comp: compCache.get(ck) } : null;
  }
  function stingerSpec(key, name) {
    const sc = BOX.scores[key];
    const s = sc && sc.stingers && sc.stingers[name];
    if (s) return { key: key + '#' + name, s };
    if (STING[name]) return { key: '#' + name, s: STING[name] };
    return null;
  }
  function stingerComp(found) {
    if (typeof found.s === 'function') return found.s;
    if (!compCache.has(found.key)) { try { const g = found.s.gain != null ? found.s.gain : 3, tracks = {};
      for (const [k, T] of Object.entries(found.s.tracks || {})) tracks[k] = { ...T, vol: ((T.vol != null ? T.vol : (DEF[T.type] || {}).vol) || 0.55) * (T.type === 'drums' ? Math.min(1, g) : g), prio: true };
      compCache.set(found.key, compile({ once: true, form: ['S'], ...found.s, tracks, sections: found.s.sections || { S: { bars: found.s.bars || 1, chords: found.s.chords, ...(found.s.parts || {}) } } })); } catch (e) { console.error('[audio] stinger ' + found.key, e); compCache.set(found.key, null); } }
    return compCache.get(found.key);
  }
  // Pre-render the sampled pitches a cue uses, a few per tick, before they are needed.
  function prewarm(comp) {
    const todo = [];
    for (const sec of Object.values(comp.secs)) for (const ev of sec.evs) { const T = comp.tracks[ev.tr]; if (ev.midi && T && SAMPLED[T.type]) for (const m of ev.midi) { const mm = m + (T.mode === 'bass' ? 0 : 12 * (T.oct || 0)); const k = T.type + ':' + mm; if (!sampleCache.has(k) && !todo.some((x) => x[2] === k)) todo.push([T.type, mm, k]); } }
    const step = () => { const t0 = performance.now(); while (todo.length && performance.now() - t0 < 8) { const [ty, m] = todo.shift(); sampleBuf(ty, m); } if (todo.length) setTimeout(step, 16); };
    setTimeout(step, 0);
  }

  // ---------------------------------------------------------------- settings
  const SKEY = 'box.audio';
  const settings = (() => { const d = { master: 0.9, music: 0.7, sfx: 0.9, mute: false }; try { return { ...d, ...JSON.parse(localStorage.getItem(SKEY) || '{}') }; } catch { return d; } })();
  const saveSettings = () => { try { localStorage.setItem(SKEY, JSON.stringify(settings)); } catch { /* private mode */ } };

  // ---------------------------------------------------------------- the live engine
  let E = null, cur = null, want = null, unlocked = false, duckOn = false, timer = 0, manifest = null, curScore = null;
  const loading = new Map();
  function getCtx() {
    try { if (W.SFX && W.SFX.unlock) { const c = W.SFX.unlock(); if (c) return c; } } catch { /* fall through */ }
    const AC = W.AudioContext || W.webkitAudioContext; return AC ? new AC() : null;
  }
  function ensure() {
    if (E) { if (E.ctx.state === 'suspended') E.ctx.resume().catch(() => {}); return E; }
    const active = unlocked || (navigator.userActivation && navigator.userActivation.hasBeenActive);
    if (!active) return null;
    const c = getCtx(); if (!c) return null;
    E = new Engine(c); applyLevels(true);
    timer = setInterval(tick, 40);
    document.addEventListener('visibilitychange', tick);
    return E;
  }
  function applyLevels(now) {
    try { if (W.SFX) { W.SFX.setVolume(settings.sfx * settings.master); W.SFX.enabled = !settings.mute; } } catch { /* none */ }
    if (!E) return;
    const t = E.ctx.currentTime, r = now ? 0.01 : 0.15;
    E.vol.gain.setTargetAtTime(settings.mute ? 0 : settings.master, t, r / 3);
    E.level(E.music, settings.music * (duckOn ? 0.32 : 1), duckOn ? 0.18 : 0.7);
    E.level(E.sfx, settings.sfx, 0.05);
    for (const a of fileEls) a.el.volume = settings.mute ? 0 : clamp(settings.master * settings.music * (duckOn ? 0.32 : 1) * a.gain, 0, 1);
  }
  function tick() {
    if (!E || E.ctx.state !== 'running') return;
    const ahead = document.hidden ? 1.8 : 0.3, until = E.ctx.currentTime + ahead;
    for (const p of [...E.players]) { p.pump(until); if (p.done && p.endAt != null && E.ctx.currentTime > p.endAt + 6) p.dispose(); }
  }
  // file overrides (public/audio/manifest.json)
  const fileEls = new Set();
  function loadManifest() {
    if (manifest) return manifest;
    manifest = fetch('/audio/manifest.json', { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : {})).catch(() => ({})).then((m) => (manifest = m || {}, manifest));
    return manifest;
  }
  function fileFor(key, name) {
    const m = manifest && !(manifest instanceof Promise) ? manifest[key] : null; if (!m) return null;
    let f = Array.isArray(m) ? m.find((x) => String(x).replace(/\.[a-z0-9]+$/i, '') === name) : m[name];
    if (!f) return null; if (typeof f === 'string') f = { file: f };
    return { url: '/audio/' + encodeURIComponent(key) + '/' + f.file.split('/').map(encodeURIComponent).join('/'), loop: f.loop !== false, gain: f.gain || 1 };
  }
  function FilePlayer(info) {
    const el = new Audio(info.url); el.loop = info.loop; el.preload = 'auto';
    this.a = { el, gain: info.gain }; fileEls.add(this.a); applyLevels();
    el.play().catch(() => {}); this.stopping = false;
  }
  FilePlayer.prototype.stop = function (t, fade) {
    if (this.stopping) return; this.stopping = true; const a = this.a, v0 = a.el.volume, t0 = performance.now(); fileEls.delete(a);
    const step = () => { const k = (performance.now() - t0) / (fade * 1000); if (k >= 1) { a.el.pause(); a.el.src = ''; return; } a.el.volume = v0 * (1 - k); requestAnimationFrame(step); };
    step();
  };

  function startMusic() {
    if (!want) return;
    const w = want;
    if (!BOX.scores[w.key] && loading.get(w.key) !== 'missing') { need(w.key, startMusic); return; }
    if (!BOX.scores.generic && loading.get('generic') !== 'missing') { need('generic', startMusic); return; }
    if (manifest instanceof Promise || !manifest) { loadManifest().then(startMusic); return; }
    if (!ensure() || E.ctx.state !== 'running') return;
    const id = w.key + '/' + w.cue;
    if (cur && cur.id === id && !cur.p.stopping) return;
    const now = E.ctx.currentTime;
    const file = fileFor(w.key, w.cue);
    const r = file ? null : resolve(w.key, w.cue);
    if (!file && !r) return;
    if (cur && cur.rid && r && cur.rid === r.key && !cur.p.stopping) { cur.id = id; return; }
    let t = now + 0.05;
    if (cur && !cur.p.stopping) {
      if (cur.p.nextBar && r) { const nb = cur.p.nextBar(now + 0.12); t = nb - now <= 2.4 ? nb : cur.p.nextBeat(now + 0.12); }
      cur.p.stop(t, w.fade != null ? w.fade : 1.6);
    }
    if (file) { cur = { id, p: new FilePlayer(file) }; return; }
    E.setDelay(60 / r.comp.bpm * 0.75);
    const p = new Player(E, r.comp, E.music, t, 0.04); E.players.add(p);
    prewarm(r.comp); p.pump(now + 0.3);
    cur = { id, rid: r.key, p };
  }
  function need(key, cb) {
    if (BOX.scores[key]) { if (cb) cb(); return; }
    if (!loading.has(key)) {
      loading.set(key, []);
      const s = document.createElement('script'); s.src = '/box/scores/' + key + '.js'; s.async = true;
      s.onload = () => { const l = loading.get(key); loading.set(key, BOX.scores[key] ? 'ok' : 'missing'); if (Array.isArray(l)) l.forEach((f) => f()); };
      s.onerror = () => { const l = loading.get(key); loading.set(key, 'missing'); if (Array.isArray(l)) l.forEach((f) => f()); };
      document.head.appendChild(s);
    }
    const l = loading.get(key); if (cb) { if (Array.isArray(l)) l.push(cb); else cb(); }
  }
  function playStinger(key, name) {
    key = key || curScore || 'generic';
    if (!ensure() || E.ctx.state !== 'running' || settings.mute) return false;
    const fl = fileFor(key, 'stinger:' + name);
    if (fl) { const a = new Audio(fl.url); a.volume = clamp(settings.master * settings.sfx * fl.gain, 0, 1); a.play().catch(() => {}); return true; }
    const found = stingerSpec(key, name); if (!found) return false;
    const comp = stingerComp(found); if (!comp) return false;
    const t = E.ctx.currentTime + 0.02;
    if (typeof comp === 'function') {
      const b = E.cueBus(E.sfx, 0, t), st = E.strip({ type: 'x', vol: 0.9, rev: 0.22 }, b);
      try { comp(makeX(E, st, t)); } catch (e) { console.error(e); }
      setTimeout(() => { for (const n of st.nodes) try { n.disconnect(); } catch { /* */ } for (const g of Object.values(b)) try { g.disconnect(); } catch { /* */ } }, 8000);
    } else { const p = new Player(E, comp, E.sfx, t, 0); E.players.add(p); p.pump(t + 0.3); if (found.s.duck) { duckFor(found.s.duck); } }
    return true;
  }
  let duckT = 0;
  function duckFor(ms) { api.duck(true); clearTimeout(duckT); duckT = setTimeout(() => api.duck(false), ms); }
  function makeX(E, st, t0) {
    const c = E.ctx, out = st.input;
    const X = {
      t: t0, m: noteNum,
      note(type, m, at = 0, dur = 0.3, vel = 0.8, o = {}) { E.voice({ type, prio: true, ...o }, st, typeof m === 'string' ? noteNum(m) : m, t0 + at, dur, vel); },
      chord(type, ms, at = 0, dur = 0.5, vel = 0.8, strum = 0, o = {}) { ms.forEach((m, i) => X.note(type, m, at + i * strum, dur, vel, o)); },
      drum(piece, at = 0, vel = 0.8, kit = 'std') { E.drum(kit, piece, t0 + at, vel, out); },
      noise({ at = 0, dur = 0.3, f0 = 1000, f1, q = 1, type = 'bandpass', vol = 0.3, att = 0.005 } = {}) {
        const t = t0 + at, s = c.createBufferSource(); s.buffer = E.noise(); const f = filt(c, type, f0, q), g = c.createGain();
        if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + att); g.gain.setTargetAtTime(0, t + Math.max(att, dur * 0.6), dur * 0.15);
        s.connect(f); f.connect(g); g.connect(out); s.start(t, rnd()); s.stop(t + dur + 0.3);
      },
      tone({ at = 0, dur = 0.3, f0 = 440, f1, wave = 'sine', vol = 0.2, att = 0.005, lp } = {}) {
        const t = t0 + at, o = c.createOscillator(), g = c.createGain(); o.type = wave; o.frequency.setValueAtTime(f0, t); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + att); g.gain.setTargetAtTime(0, t + Math.max(att, dur * 0.7), dur * 0.1);
        let n = o; if (lp) { const f = filt(c, 'lowpass', lp); o.connect(f); n = f; } n.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.3);
      },
    };
    return X;
  }

  // ---------------------------------------------------------------- UI: sound panel
  let panelEl = null;
  function css() {
    if (document.getElementById('ba-css')) return;
    const s = document.createElement('style'); s.id = 'ba-css';
    s.textContent = `.ba-panel{position:fixed;z-index:9999;width:260px;padding:14px 16px;border-radius:16px;background:#1d1440;color:#fff;border:2px solid rgba(255,255,255,.22);box-shadow:0 14px 34px rgba(0,0,0,.55);font:600 15px/1.3 Fredoka,Nunito,system-ui,sans-serif}
.ba-panel h4{margin:0 0 10px;font-size:17px}.ba-panel label{display:flex;align-items:center;gap:10px;margin:8px 0}.ba-panel label span{width:74px}.ba-panel input[type=range]{flex:1;accent-color:#ffd23f}
.ba-panel button{font:inherit;margin-top:8px;width:100%;padding:9px;border:0;border-radius:12px;background:rgba(255,255,255,.12);color:#fff;cursor:pointer}.ba-panel button.on{background:#ff4f6a}
.ba-btn{font-size:20px;line-height:1;padding:6px 9px;border-radius:12px;border:2px solid rgba(255,255,255,.2);background:rgba(0,0,0,.3);color:#fff;cursor:pointer}`;
    document.head.appendChild(s);
  }
  // The natural live narrator voice (public/box/voice.js): only on pages that load it.
  function liveRow() {
    const V = BOX.voice; if (!V || typeof V.setLive !== 'function') return '';
    const st = V.liveStatus(), note = { unsupported: 'needs WebGPU (Chrome or Edge)', loading: 'downloading…', failed: 'could not load', ready: 'ready' }[st] || '';
    return `<button data-live class="${V.live ? 'on' : ''}" ${st === 'unsupported' ? 'disabled' : ''} title="Reads names and fun facts with the same natural voices as the rest of the show">🎙️ Natural live voice (downloads ~160 MB once): <b>${V.live ? 'ON' : 'OFF'}</b>${note ? `<br><small>${note}</small>` : ''}</button>`;
  }
  function panel(anchor) {
    css();
    if (panelEl) { panelEl.remove(); panelEl = null; return; }
    const p = panelEl = document.createElement('div'); p.className = 'ba-panel';
    const row = (k, label) => `<label><span>${label}</span><input type="range" min="0" max="100" value="${Math.round(settings[k] * 100)}" data-k="${k}"></label>`;
    p.innerHTML = `<h4>🔊 Sound</h4>${row('music', '🎵 Music')}${row('sfx', '✨ Effects')}${row('master', '🔈 Master')}<button data-mute class="${settings.mute ? 'on' : ''}">${settings.mute ? '🔇 Muted (tap to unmute)' : '🔇 Mute everything'}</button>${liveRow()}`;
    document.body.appendChild(p);
    const r = anchor && anchor.getBoundingClientRect ? anchor.getBoundingClientRect() : null;
    if (r) { p.style.top = Math.min(innerHeight - p.offsetHeight - 8, r.bottom + 8) + 'px'; p.style.left = clamp(r.right - 260, 8, innerWidth - 268) + 'px'; } else { p.style.right = '16px'; p.style.bottom = '16px'; }
    for (const i of p.querySelectorAll('input')) i.oninput = () => api.set(i.dataset.k, i.value / 100);
    const bindLive = () => { const lv = p.querySelector('[data-live]'); if (lv) lv.onclick = () => { BOX.voice.setLive(!BOX.voice.live); lv.outerHTML = liveRow(); bindLive(); }; };
    bindLive();
    p.querySelector('[data-mute]').onclick = (e) => { api.mute(!settings.mute); e.target.className = settings.mute ? 'on' : ''; e.target.textContent = settings.mute ? '🔇 Muted (tap to unmute)' : '🔇 Mute everything'; };
    setTimeout(() => { const off = (e) => { if (!panelEl) return document.removeEventListener('pointerdown', off, true); if (!p.contains(e.target) && e.target !== anchor) { p.remove(); panelEl = null; document.removeEventListener('pointerdown', off, true); } }; document.addEventListener('pointerdown', off, true); }, 0);
  }

  // ---------------------------------------------------------------- offline render check
  async function render(key, name, bars = 8, o = {}) {
    if (key !== 'generic') await new Promise((r) => need(key, r));
    await new Promise((r) => need('generic', r));
    let comp, stingFn = null, label = key + '/' + name;
    if (o.stinger) { const f = stingerSpec(key, name); if (!f) return { label, error: 'missing' }; comp = stingerComp(f); if (typeof comp === 'function') { stingFn = comp; comp = null; } }
    else { const r = resolve(key, name); if (!r) return { label, error: 'missing' }; comp = r.comp; label = key + '/' + name + (r.key !== key + '/' + name ? ' -> ' + r.key : ''); }
    const sr = o.sr || 44100, barDur = comp ? comp.beats * 60 / comp.bpm : 1;
    const len = comp ? (o.stinger ? Object.values(comp.secs).reduce((a, s) => a + s.bars, 0) * barDur + 3 : bars * barDur + 2.5) : 4;
    const oc = new OfflineAudioContext(4, Math.ceil(len * sr), sr);
    const EO = new Engine(oc, { offline: true, analyse: true });
    if (stingFn) { const b = EO.cueBus(EO.sfx, 0, 0.05), st = EO.strip({ type: 'x', vol: 0.9, rev: 0.22 }, b); stingFn(makeX(EO, st, 0.05)); }
    else {
      const p = new Player(EO, comp, o.stinger ? EO.sfx : EO.music, 0.05, 0);
      const endT = o.stinger ? len : bars * barDur + 0.05;
      for (let t = 0; t < endT; t += 0.25) { EO._now = t; p.pump(Math.min(endT, t + 0.3)); }
    }
    const t0 = performance.now(); const buf = await oc.startRendering(); const ms = performance.now() - t0;
    const st = (chs) => { let pk = 0, ss = 0, clip = 0, n = 0; for (const ch of chs) { const d = buf.getChannelData(ch); for (let i = 0; i < d.length; i++) { const a = Math.abs(d[i]); if (a > pk) pk = a; if (a >= 0.985) clip++; ss += d[i] * d[i]; n++; } } return { pk, rms: Math.sqrt(ss / n), clip }; };
    const out = st([0, 1]), pre = st([2, 3]); const db = (x) => (x > 0 ? Math.round(20 * Math.log10(x) * 10) / 10 : -120);
    return { label, seconds: Math.round(len * 10) / 10, peakDb: db(out.pk), rmsDb: db(out.rms), clipped: out.clip, prePeakDb: db(pre.pk), preRmsDb: db(pre.rms), renderMs: Math.round(ms), speed: Math.round(len * 1000 / ms * 10) / 10, maxVoices: EO.maxActive };
  }

  // ---------------------------------------------------------------- public API
  const api = {
    get ready() { return !!E && E.ctx.state === 'running'; },
    get settings() { return { ...settings }; },
    get current() { return cur ? cur.id : null; },
    unlock() { unlocked = true; const e = ensure(); if (e && e.ctx.state !== 'running') e.ctx.resume().then(startMusic).catch(() => {}); else startMusic(); },
    use(key) { curScore = key; need(key); },
    need,
    music(name, key, o = {}) {
      key = key || curScore || 'generic'; curScore = key;
      if (!name) { want = null; if (cur && E) { cur.p.stop(E.ctx.currentTime + 0.02, o.fade || 1.4); cur = null; } return; }
      want = { cue: name, key, fade: o.fade }; startMusic();
    },
    stop(fade = 1.4) { api.music(null, null, { fade }); },
    stinger(name, key) { try { return playStinger(key, name); } catch (e) { console.error(e); return false; } },
    fx(key, kind) { const sc = BOX.scores[key]; const n = sc && sc.fx && sc.fx[kind]; return n ? api.stinger(n, key) : false; },
    sfx(name) { const sc = BOX.scores[curScore]; const n = sc && sc.sfx && sc.sfx[name]; return n ? api.stinger(n, curScore) : false; },
    duck(on) { if (duckOn === !!on) return; duckOn = !!on; applyLevels(); },
    set(kind, v) { if (!(kind in settings)) return; settings[kind] = kind === 'mute' ? !!v : clamp(Number(v) || 0, 0, 1); saveSettings(); applyLevels(); },
    mute(on) { api.set('mute', on); },
    panel,
    button() { css(); const b = document.createElement('button'); b.className = 'ba-btn'; b.title = 'Sound'; b.textContent = '🔊'; b.onclick = (e) => { e.stopPropagation(); panel(b); }; return b; },
    render,
    cues(key) { const sc = BOX.scores[key]; return sc ? Object.keys(sc.cues || {}) : []; },
    stingers(key) { const sc = BOX.scores[key]; return sc ? Object.keys(sc.stingers || {}) : Object.keys(STING); },
    builtins: Object.keys(STING),
    _internals: { compile, parseChord, voiceChord, noteNum, progression, resolve },
  };
  BOX.audio = api;
  // BOX.sfx: let the current score restyle sound effects; the old sfx.js sound is the fallback.
  if (typeof BOX.sfx === 'function' && !BOX.sfx._audio) { const old = BOX.sfx; BOX.sfx = (n) => { let done = false; try { done = api.sfx(n); } catch { /* none */ } if (!done) old(n); }; BOX.sfx._audio = true; }
  // Browsers only allow sound after a click or key press.
  const gesture = () => api.unlock();
  for (const ev of ['pointerdown', 'keydown', 'touchend']) W.addEventListener(ev, gesture, { capture: true, passive: true });
})();
