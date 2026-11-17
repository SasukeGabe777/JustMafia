'use strict';
// Tune Buzz (key `tune`): TV and phone screens, the designed lobby, haptics, and the music the
// TV plays for every clip. Look: a neon late-night radio studio (see public/box/titles/tune.js):
// deep violet, hot pink, cyan and gold, Monoton + Bungee, a live equaliser on the big screen.
//
// ALL MUSIC IS ORIGINAL AND MADE IN CODE (BOX.audio, public/box/audio.js):
//   Which game?        a few bars of a JustGameBox soundtrack (public/box/scores/<game>.js, title cue)
//   Guess the vibe     STYLES below: a generated melody over a style's chords, groove and band
//   Instrument ID      a generated phrase played solo on one instrument (INSTR below)
//   Higher or lower    two notes, or two beats
//   Finish the melody  a phrase, then three endings (one resolves home; one clashes; one hangs)
//   Rhythm tap         a count-in, then 12 beats of groove to tap along with
// The server (box/games/tune.js) sends the seed and the timing; the TV plays it on its speakers.
(function () {
  const { esc, mmss } = BOX;
  const TAU = Math.PI * 2;
  const LETTERS = ['A', 'B', 'C', 'D'];

  // =========================================================================== MUSIC
  const rngOf = (seed) => { let a = seed >>> 0 || 1; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  const pickR = (r, a) => a[Math.floor(r() * a.length)];
  const AI = () => BOX.audio && BOX.audio._internals;
  const NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
  function chordOf(sym) { try { return AI().parseChord(sym, 0); } catch { return AI().parseChord('C', 0); } }
  function voicing(sym, center, n, prev) { return AI().voiceChord(chordOf(sym), prev || null, { center, n: n || 3 }); }
  const MAJ = [0, 2, 4, 5, 7, 9, 11], MIN = [0, 2, 3, 5, 7, 8, 10], HMIN = [0, 2, 3, 5, 7, 8, 11];
  function scaleIn(root, ivs, lo, hi) { const out = []; for (let m = lo; m <= hi; m++) if (ivs.includes((((m - root) % 12) + 12) % 12)) out.push(m); return out; }
  const nearest = (list, m) => list.reduce((b, x) => (Math.abs(x - m) < Math.abs(b - m) ? x : b), list[0]);

  // A melody over a chord list: chord tones on the beat, scale steps between, home at the end.
  // rhythms: strings of note lengths in 8ths ('r2' = a rest); returns [[step16, midi, steps16, vel]].
  function melody(r, { chords, root, scale, center, rhythms, barSteps, range = [-7, 9], leap = 0.25, end = true }) {
    const notes = [], sc = scaleIn(root, scale, center + range[0], center + range[1]);
    let prev = nearest(sc, center + Math.round((r() - 0.5) * 4));
    chords.forEach((sym, bar) => {
      const c = chordOf(sym.split(' ')[0]), tones = sc.filter((m) => c.ivs.some((iv) => (((m - c.root - iv) % 12) + 12) % 12 === 0));
      let pos = 0;
      const toks = pickR(r, rhythms).split(' ');
      toks.forEach((tk, i) => {
        const rest = tk[0] === 'r', len = Number(rest ? tk.slice(1) : tk) * 2;
        if (!rest) {
          let m;
          const lastOne = end && bar === chords.length - 1 && i === toks.length - 1;
          if (lastOne) m = nearest(sc.filter((x) => (((x - root) % 12) + 12) % 12 === 0), prev);
          else if (pos % 4 === 0 && tones.length) m = r() < leap ? pickR(r, tones) : nearest(tones.filter((x) => x !== prev).length ? tones.filter((x) => x !== prev) : tones, prev + (r() < 0.5 ? -2 : 2));
          else { const k = sc.indexOf(nearest(sc, prev)); m = sc[Math.max(0, Math.min(sc.length - 1, k + pickR(r, [-2, -1, -1, 1, 1, 2])))]; }
          notes.push([bar * barSteps + pos, m, len, pos % 4 === 0 ? 0.82 : 0.68]); prev = m;
        }
        pos += len;
      });
    });
    return notes;
  }
  const BASS_DEG = { 1: 0, 3: 'third', 5: 7, 6: 9, 7: 10, 8: 12 };
  // Plays one arrangement into X from time t0 for `secs` seconds (patterns repeat to fill it).
  // arr: { bpm, beats, chords[], lead{type,center,vel,notes}, comp{type,center,n,pat,vel}, arp{…}, bass{type,pat}, drums{kit,…pieces}, fx(X,t,bar) }
  function playArr(X, arr, t0, secs) {
    const st = 60 / arr.bpm / 4, barSteps = (arr.beats || 4) * 4, barDur = barSteps * st;
    const nBars = Math.max(1, Math.floor((secs + 0.3) / barDur)), loopLen = arr.chords.length;
    let prevV = null, prevA = null;
    const swing = (s) => (arr.swing && s % 2 === 1 ? st * arr.swing : 0);
    for (let b = 0; b < nBars; b++) {
      const sym = arr.chords[b % loopLen], tb = t0 + b * barDur;
      if (tb - t0 > secs + 0.05) break;
      const last = b === nBars - 1;
      if (arr.comp) {
        const v = prevV = voicing(sym, arr.comp.center, arr.comp.n || 3, prevV), pat = arr.comp.pat;
        for (let s = 0; s < barSteps; s++) {
          const ch = pat[s % pat.length]; if (ch !== 'x' && ch !== 'X') continue;
          let len = 1; while (s + len < barSteps && pat[(s + len) % pat.length] === '-') len++;
          X.chord(arr.comp.type, v, tb + s * st + swing(s), len * st * 0.95, (ch === 'X' ? 1 : 0.8) * (arr.comp.vel || 0.45), arr.comp.strum || 0);
        }
      }
      if (arr.arp) {
        const v = prevA = voicing(sym, arr.arp.center, 4, prevA), pat = arr.arp.pat;
        for (let s = 0; s < barSteps; s++) { const ch = pat[s % pat.length]; if (!/[1-9]/.test(ch)) continue; X.note(arr.arp.type, v[(Number(ch) - 1) % v.length], tb + s * st + swing(s), st * 2.2, arr.arp.vel || 0.4); }
      }
      if (arr.bass) {
        const c = chordOf(sym.split('/')[0]), base = 36 + ((c.root - 36) % 12 + 12) % 12, toks = arr.bass.pat.split(' ');
        toks.forEach((tk, i) => {
          if (tk === '.' || tk === '-') return;
          let len = 1; while (toks[i + len] === '-') len++;
          const d = BASS_DEG[tk]; const iv = d === 'third' ? (c.ivs.includes(3) ? 3 : 4) : d || 0;
          X.note(arr.bass.type, base + iv + (arr.bass.oct || 0) * 12, tb + i * 2 * st, len * 2 * st * 0.9, arr.bass.vel || 0.6);
        });
      }
      if (arr.drums) for (const [pc, pat] of Object.entries(arr.drums)) {
        if (pc === 'kit') continue;
        for (let s = 0; s < barSteps; s++) { const ch = pat[s % pat.length]; if (ch === '.') continue; X.drum(pc, tb + s * st + swing(s), ch === 'X' ? 0.95 : ch === 'g' ? 0.32 : 0.62, arr.drums.kit || 'std'); }
      }
      if (arr.fx) arr.fx(X, tb, b, barDur);
      if (last && arr.drums && arr.drums.kit !== 'none') X.drum('y', tb + barDur, 0.5, arr.drums.kit || 'std');
    }
    if (arr.lead && arr.lead.notes) {
      const totalSteps = nBars * barSteps, loopSteps = loopLen * barSteps;
      for (let off = 0; off < totalSteps; off += loopSteps) for (const [s, m, len, vel] of arr.lead.notes) {
        if (off + s >= totalSteps) break;
        X.note(arr.lead.type, m, t0 + (off + s) * st + swing(s), Math.max(0.08, len * st * (arr.lead.legato || 0.92)), vel * (arr.lead.vel || 0.8));
      }
    }
    return nBars * barDur;
  }

  // "Guess the vibe": every style the server can pick (box/games/tune.js VIBES).
  const STYLES = {
    spooky: (r) => ({ bpm: 92, beats: 3, chords: ['Dm', 'Gm', 'A7', 'Dm'], key: [62, HMIN],
      lead: { type: 'sine', center: 74, rhythms: ['4 2', '2 2 2', '3 1 2', '6'], vel: 0.7, legato: 1 },
      comp: { type: 'organ', center: 58, n: 3, pat: 'x-----------', vel: 0.35 }, arp: { type: 'harpsi', center: 66, pat: '..1.2.3.2.3.', vel: 0.32 },
      bass: { type: 'upright', pat: '1 - - . 5 .' }, drums: { kit: 'orch', k: 'x...........' },
      fx: (X, t, b, bd) => { if (b % 2 === 1) X.note('chime', 'g#6', t + bd * 0.7, 1.2, 0.35); } }),
    beach: (r) => ({ bpm: 116, chords: ['F', 'Bb', 'C7', 'F'], key: [65, MAJ],
      lead: { type: 'marimba', center: 77, rhythms: ['1 1 2 1 1 2', '2 1 1 2 2', '1 2 1 2 2', '3 3 2'], vel: 0.85 },
      comp: { type: 'nylon', center: 62, n: 4, pat: '..x-..x-..x-.x-.', vel: 0.4, strum: 0.012 },
      bass: { type: 'upright', pat: '1 . 5 . 1 5 8 .' }, drums: { kit: 'world', sh: 'x.x.x.x.x.x.x.x.', cg: '..x...x...x.x.x.', k: 'x.....x.x.......' } }),
    space: (r) => ({ bpm: 72, chords: ['Cmaj7', 'D/C', 'Cmaj7', 'Bm7'], key: [60, [0, 2, 4, 6, 7, 9, 11]],
      lead: { type: 'sine', center: 79, rhythms: ['4 4', '6 2', '8', '2 6'], vel: 0.6, legato: 1 },
      comp: { type: 'pad', center: 64, n: 4, pat: 'x---------------', vel: 0.35 }, arp: { type: 'celesta', center: 84, pat: '1.2.3.4.3.2.1.2.', vel: 0.28 },
      bass: { type: 'sub808', pat: '1 - - - - - - -', vel: 0.5 },
      fx: (X, t, b, bd) => X.tone({ at: t + bd * 0.5, dur: 1.4, f0: 300 + b * 120, f1: 1800, wave: 'sine', vol: 0.05 }) }),
    western: (r) => ({ bpm: 108, chords: ['G', 'C', 'G', 'D7'], key: [67, MAJ],
      lead: { type: 'whistle', center: 79, rhythms: ['3 1 2 2', '2 2 4', '1 1 2 2 2', '6 2'], vel: 0.75 },
      comp: { type: 'guitar', center: 59, n: 3, pat: '....x-......x-..', vel: 0.45, strum: 0.015 },
      bass: { type: 'upright', pat: '1 . . . 5 . . .' }, drums: { kit: 'world', wb: 'x...x...x...x...', wb2: '..x...x...x...x.' } }),
    royal: (r) => ({ bpm: 104, chords: ['Bb', 'Eb', 'F', 'Bb'], key: [58, MAJ],
      lead: { type: 'brass', center: 70, rhythms: ['3 1 2 2', '2 1 1 4', '1 1 1 1 2 2', '3 1 4'], vel: 0.8, leap: 0.6 },
      comp: { type: 'strings', center: 65, n: 4, pat: 'x-------x-------', vel: 0.35 },
      bass: { type: 'bass', pat: '1 . . . 5 . . .' }, drums: { kit: 'orch', s: 'x.xxx.x.x.xxx.x.', k: 'x.......x.......' } }),
    circus: (r) => ({ bpm: 150, chords: ['C', 'G7', 'G7', 'C'], key: [60, MAJ],
      lead: { type: 'organ', center: 76, rhythms: ['1 1 1 1 1 1 2', '2 1 1 2 2', '1 1 2 1 1 2'], vel: 0.6 },
      comp: { type: 'organ', center: 62, n: 3, pat: '....x.......x...', vel: 0.32 },
      bass: { type: 'tuba', pat: '1 . . . 5 . . .', vel: 0.75 }, drums: { kit: 'orch', k: 'x.......x.......', s: '....x.......x...' } }),
    lullaby: (r) => ({ bpm: 76, beats: 3, chords: ['F', 'Bb', 'C', 'F'], key: [65, MAJ],
      lead: { type: 'musicbox', center: 79, rhythms: ['2 2 2', '4 2', '2 4', '6'], vel: 0.8 },
      arp: { type: 'harp', center: 60, pat: '1...2...3...', vel: 0.4 } }),
    chase: (r) => ({ bpm: 160, chords: ['Em', 'Em', 'C', 'D'], key: [64, MIN],
      lead: { type: 'brass', center: 76, rhythms: ['1 1 1 1 2 2', '2 2 1 1 2', '1 1 2 1 1 2', '4 4'], vel: 0.65 },
      comp: { type: 'strings', center: 64, n: 3, pat: 'x..x..x.x..x..x.', vel: 0.4 },
      bass: { type: 'synthbass', pat: '1 1 1 1 1 1 8 1', vel: 0.55 }, drums: { kit: 'std', k: 'x...x...x...x...', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' } }),
    underwater: (r) => ({ bpm: 84, chords: ['Ebmaj7', 'Cm7', 'Abmaj7', 'Bb7'], key: [63, MAJ],
      lead: { type: 'vibes', center: 75, rhythms: ['2 2 4', '3 1 4', '2 2 2 2', '4 4'], vel: 0.8 },
      comp: { type: 'pad', center: 63, n: 4, pat: 'x---------------', vel: 0.28 }, arp: { type: 'harp', center: 72, pat: '1.2.3.4.4.3.2.1.', vel: 0.28 },
      bass: { type: 'upright', pat: '1 . . 5 . . 1 .' },
      fx: (X, t, b, bd) => { for (let i = 0; i < 3; i++) X.tone({ at: t + bd * (0.2 + i * 0.27), dur: 0.12, f0: 500 + i * 160, f1: 1300 + i * 200, wave: 'sine', vol: 0.06 }); } }),
    jungle: (r) => ({ bpm: 112, chords: ['Am', 'G', 'Am', 'Em'], key: [69, [0, 3, 5, 7, 10]],
      lead: { type: 'flute', center: 76, rhythms: ['1 1 2 1 1 2', '2 1 1 4', '1 1 1 1 4'], vel: 0.75 },
      comp: { type: 'marimba', center: 64, n: 3, pat: 'x.x...x.x.x...x.', vel: 0.38 },
      bass: { type: 'upright', pat: '1 . . 1 5 . . .' }, drums: { kit: 'world', k: 'x.....x...x.....', cg: '..x.x...x.x.x...', bg: 'x..x..x...x..x..', sh: 'xgxgxgxgxgxgxgxg' } }),
    rainy: (r) => ({ bpm: 70, swing: 0.3, chords: ['Cm7', 'Fm7', 'Cm7', 'G7'], key: [60, [0, 3, 5, 6, 7, 10]],
      lead: { type: 'piano', center: 72, rhythms: ['3 1 2 2', '2 2 4', '4 2 2', '1 1 2 4'], vel: 0.75 },
      comp: { type: 'epiano', center: 60, n: 4, pat: 'x-----x---------', vel: 0.35 },
      bass: { type: 'upright', pat: '1 - 5 - 1 - 5 -' }, drums: { kit: 'jazz', k: 'x.......x.......', r: 'x..xx..xx..xx..x' },
      fx: (X, t, b, bd) => X.noise({ at: t, dur: bd, f0: 5000, type: 'highpass', vol: 0.025 }) }),
    spy: (r) => ({ bpm: 126, chords: ['Em', 'EmM7', 'Em7', 'C'], key: [64, MIN],
      lead: { type: 'guitar', center: 64, rhythms: ['1 1 1 1 2 2', '2 1 1 2 2', '3 1 4', 'r2 1 1 2 2'], vel: 0.8 },
      comp: { type: 'brass', center: 67, n: 3, pat: '..........x.....', vel: 0.4 },
      bass: { type: 'upright', pat: '1 . 1 . 5 . 7 .' }, drums: { kit: 'jazz', r: 'x.x.x.x.x.x.x.x.', s: '....x.......x...', k: 'x.......x.......' } }),
    arcade: (r) => ({ bpm: 140, chords: ['C', 'Am', 'F', 'G'], key: [60, MAJ],
      lead: { type: 'lead', center: 79, rhythms: ['1 1 1 1 1 1 1 1', '2 1 1 2 2', '1 1 2 1 1 2'], vel: 0.5 },
      arp: { type: 'pluck', center: 72, pat: '1234123412341234', vel: 0.3 },
      bass: { type: 'synthbass', pat: '1 8 1 8 1 8 1 8', vel: 0.5 }, drums: { kit: '808', k: 'x...x...x...x...', s: '....x.......x...', h: '..x...x...x...x.' } }),
    fairy: (r) => ({ bpm: 92, beats: 3, chords: ['Dmaj7', 'Gmaj7', 'Em7', 'A'], key: [62, [0, 2, 4, 6, 7, 9, 11]],
      lead: { type: 'celesta', center: 84, rhythms: ['2 2 2', '1 1 2 2', '4 2', '1 1 1 1 2'], vel: 0.8 },
      comp: { type: 'strings', center: 62, n: 3, pat: 'x-----------', vel: 0.25 }, arp: { type: 'harp', center: 67, pat: '1.2.3.4.3.2.', vel: 0.32 },
      drums: { kit: 'world', tri: 'x...........' } }),
  };
  function buildStyle(id, seed) {
    const r = rngOf(seed), f = STYLES[id] || STYLES.beach, a = f(r), barSteps = (a.beats || 4) * 4;
    a.lead.notes = melody(r, { chords: a.chords, root: a.key[0], scale: a.key[1], center: a.lead.center, rhythms: a.lead.rhythms, barSteps, leap: a.lead.leap || 0.3 });
    return a;
  }
  // "Instrument ID": one phrase, solo. center = where the instrument sounds most like itself.
  const INSTR = {
    piano: { type: 'piano', center: 72 }, trumpet: { type: 'brass', center: 70 }, sax: { type: 'sax', center: 65 }, strings: { type: 'strings', center: 74 },
    guitar: { type: 'nylon', center: 62 }, banjo: { type: 'banjo', center: 67 }, organ: { type: 'organ', center: 70 }, musicbox: { type: 'musicbox', center: 84 },
    marimba: { type: 'marimba', center: 72 }, flute: { type: 'flute', center: 79 }, choir: { type: 'choir', center: 67 }, harp: { type: 'harp', center: 72 },
    whistle: { type: 'whistle', center: 81 }, tuba: { type: 'tuba', center: 46 },
  };
  function playInstrument(X, id, seed, t0) {
    const r = rngOf(seed), I = INSTR[id] || INSTR.piano, root = I.center - 2 + Math.floor(r() * 5), keyRoot = root - (((root - 60) % 12) + 12) % 12 + [0, 2, 5, 7][Math.floor(r() * 4)];
    const kr = NAMES[((keyRoot % 12) + 12) % 12];
    const chords = [kr, NAMES[(keyRoot + 7) % 12] + '7'];
    const notes = melody(r, { chords, root: keyRoot, scale: MAJ, center: I.center, rhythms: ['2 1 1 2 2', '3 1 2 2', '1 1 1 1 4', '2 2 2 2'], barSteps: 16, range: [-6, 8] });
    // one more bar home
    notes.push([32, nearest(scaleIn(keyRoot, [0], I.center - 7, I.center + 9), notes[notes.length - 1][1]), 8, 0.8]);
    const st = 60 / 92 / 4;
    for (const [s, m, len, vel] of notes) X.note(I.type, m, t0 + s * st, len * st * 0.95, vel * 0.85);
  }
  // "Higher or lower": two notes, or two beats.
  function playHL(X, c, t0) {
    if (c.mode === 'pitch') { X.note('piano', c.a, t0, 1.3, 0.85); X.note('piano', c.b, t0 + 2.0, 1.5, 0.85); return; }
    const beat = (bpm, from, until) => { const d = 60 / bpm; let i = 0; for (let t = from; t < until - 0.05; t += d, i++) { X.drum('k', t, 0.8, 'std'); X.drum(i % 2 ? 's' : 'h', t, i % 2 ? 0.45 : 0.5, 'std'); X.drum('cb', t, i % 4 ? 0.3 : 0.6, 'std'); } };
    beat(c.a, t0, t0 + 3.0); beat(c.b, t0 + 3.4, t0 + 6.5);
  }
  // "Finish the melody": a 2-bar phrase, then [bar 2 + ending] three times. Ending kinds:
  // 'home' (resolves to the tonic over I), 'clash' (lands a semitone off, over a far chord),
  // 'hang' (stops on the leading tone over V: unfinished).
  const FIN_BPM = 120, FIN_SEG = 4.6, FIN_START = 4.6;
  function finishPlan(c) {
    const r = rngOf(c.seed), root = 57 + Math.floor(r() * 8), kn = (n) => NAMES[((n % 12) + 12) % 12];
    const I = kn(root), IV = kn(root + 5), V7 = kn(root + 7) + '7';
    const phrase = melody(r, { chords: [I, IV + ' ' + V7].map((x) => x.split(' ')[0]), root, scale: MAJ, center: root + 12, rhythms: ['2 1 1 2 2', '1 1 2 2 2', '3 1 2 2'], barSteps: 16, end: false });
    const sc = scaleIn(root, MAJ, root + 4, root + 24), home = root + 12, lead7 = root + 11;
    const kinds = ['clash', 'hang']; if (r() < 0.5) kinds.reverse(); kinds.splice(c.right, 0, 'home');
    const endings = kinds.map((k) => {
      if (k === 'home') return { k, chord: I, notes: [[0, nearest(sc, home + 4), 2], [2, nearest(sc, home + 2), 2], [4, home, 4]] };
      if (k === 'clash') return { k, chord: kn(root + 6), notes: [[0, home + 5, 2], [2, home + 3, 2], [4, home + 1, 4]] };
      return { k, chord: V7, notes: [[0, nearest(sc, home + 2), 2], [2, nearest(sc, home + 7) - 12 + 12, 2], [4, lead7, 4]] };
    });
    return { root, chords: [I, V7], phrase, endings };
  }
  function playFinish(X, c, t0) {
    const P = finishPlan(c), st = 60 / FIN_BPM / 4, bar = 16 * st;
    const barChords = (sym, t, len) => { X.chord('epiano', voicing(sym, 60, 4), t, len, 0.4); const ch = chordOf(sym); X.note('bass', 36 + ((ch.root - 36) % 12 + 12) % 12, t, len, 0.55); };
    const lead = (notes, t, off) => { for (const [s, m, len, vel] of notes) X.note('fmkeys', m, t + (s - off) * st, len * st * 0.92, (vel || 0.8) * 0.85, { ratio: 3, index: 1.2 }); };
    // the phrase
    barChords(P.chords[0], t0, bar); barChords(P.chords[1], t0 + bar, bar);
    lead(P.phrase, t0, 0);
    const bar2 = P.phrase.filter((n) => n[0] >= 16);
    P.endings.forEach((e, i) => {
      const ts = t0 + FIN_START + i * FIN_SEG;
      X.note('glock', [84, 86, 88][i], ts - 0.35, 0.25, 0.35);
      barChords(P.chords[1], ts, bar); lead(bar2, ts, 16);
      barChords(e.chord, ts + bar, bar * 0.95);
      for (const [s, m, len] of e.notes) X.note('fmkeys', m, ts + bar + s * 2 * st, len * 2 * st * 0.95, 0.8, { ratio: 3, index: 1.2 });
    });
  }
  // "Rhythm tap": 4 count-in clicks, then 12 beats of groove (a kick on every beat).
  function playRhythm(X, c, t0) {
    const b = 60 / c.bpm, r = rngOf(c.seed);
    for (let i = 0; i < 4; i++) { X.drum('wb', t0 + i * b, i === 0 ? 0.95 : 0.75, 'std'); X.note('glock', i === 3 ? 'g6' : 'c6', t0 + i * b, 0.15, 0.4); }
    const s0 = t0 + 4 * b, prog = { funk: ['Em7', 'A7'], rock: ['A', 'G', 'D', 'A'], disco: ['Dm7', 'G7', 'Cmaj7', 'A7'], march: ['C', 'G', 'C', 'G'] }[c.style] || ['C', 'G'];
    const bassLine = { funk: '1 . 8 . . 1 7 8', rock: '1 1 1 1 1 1 1 1', disco: '1 8 1 8 1 8 1 8', march: '1 . 5 . 1 . 5 .' }[c.style];
    for (let i = 0; i < 12; i++) {
      const t = s0 + i * b; X.drum('k', t, 1, 'std'); if (i % 2) X.drum('s', t, 0.7, 'std');
      X.drum('h', t + b / 2, 0.4, 'std'); X.drum('h', t, 0.3, 'std');
      if (i % 4 === 0) {
        const sym = prog[(i / 4) % prog.length], ch = chordOf(sym), base = 36 + ((ch.root - 36) % 12 + 12) % 12;
        X.chord(c.style === 'rock' ? 'guitar' : 'clav', voicing(sym, 62, 3), t, b * 0.4, 0.4); X.chord('clav', voicing(sym, 62, 3), t + b * 2.5, b * 0.3, 0.3);
        bassLine.split(' ').forEach((tk, k) => { if (tk === '.') return; X.note('synthbass', base + (BASS_DEG[tk] || 0), t + k * b / 2, b * 0.42, 0.5); });
      }
    }
    X.drum('y', s0 + 12 * b, 0.8, 'std'); X.drum('k', s0 + 12 * b, 1, 'std');
    void r;
  }
  // A few bars of another game's title theme ("Which game?"): played as a one-shot stinger.
  function gameClip(key, sec, maxSecs) {
    const sc = BOX.scores[key]; if (!sc || !sc.cues || !sc.cues.title) return null;
    const cue = sc.cues.title, section = (cue.sections && (cue.sections[sec] || cue.sections.A)) || null; if (!section) return null;
    const barDur = (cue.beats || 4) * 60 / cue.bpm, bars = Math.max(1, Math.min(section.bars || 8, Math.floor(maxSecs / barDur)));
    const name = `_g_${key}_${sec}_${bars}`;
    BOX.scores.tune.stingers[name] = { ...cue, gain: 1, form: ['S'], loop: 0, sections: { S: { ...section, bars } } };
    return name;
  }
  // The TV plays a clip. Every note is first recorded (times in seconds from the clip's start),
  // then sent to the engine in 4-second chunks as one-shot stingers (a stinger's channel only
  // lives 8 s). Each chunk re-aims at the clip's start on the page clock, so nothing drifts.
  function recorder(g = 1) {
    const evs = [];
    const X = {
      t: 0,
      // the engine caps velocity at 1.2, so louder notes are stacked (they add up in phase)
      note(type, m, at = 0, dur = 0.3, vel = 0.8, o = {}) { const v = vel * g, k = Math.max(1, Math.ceil(v / 1.2)); evs.push({ at, play: (Y, a) => { for (let i = 0; i < k; i++) Y.note(type, m, a, dur, v / k, o); } }); },
      chord(type, ms, at = 0, dur = 0.5, vel = 0.8, strum = 0, o = {}) { ms.forEach((m, i) => X.note(type, m, at + i * strum, dur, vel, o)); },
      drum(p, at = 0, vel = 0.8, kit = 'std') { evs.push({ at, play: (Y, a) => Y.drum(p, a, Math.min(1, vel * g), kit) }); },
      tone(o) { evs.push({ at: o.at || 0, play: (Y, a) => Y.tone({ ...o, vol: (o.vol || 0.2) * g, at: a }) }); },
      noise(o) { evs.push({ at: o.at || 0, play: (Y, a) => Y.noise({ ...o, vol: (o.vol || 0.3) * g, at: a }) }); },
    };
    return { X, evs };
  }
  // Loudness matching (measured with BOX.audio.render): every clip lands near the music level.
  const STYLE_GAIN = { spooky: 0.8, beach: 0.55, space: 1.9, western: 2.2, royal: 0.6, circus: 0.5, lullaby: 2.5, chase: 0.65, underwater: 1.7, jungle: 0.55, rainy: 1.2, spy: 1.1, arcade: 0.5, fairy: 1.7 };
  const INST_GAIN = { piano: 2.3, trumpet: 5, sax: 4, strings: 5, guitar: 2.8, banjo: 5, organ: 5, musicbox: 1.6, marimba: 1.4, flute: 2.3, choir: 2.2, harp: 4.5, whistle: 3.2, tuba: 1.8 };
  const clipGain = (c) => (c.type === 'vibe' ? STYLE_GAIN[c.style] || 1 : c.type === 'inst' ? INST_GAIN[c.inst] || 1.8 : c.type === 'hl' ? (c.mode === 'pitch' ? 3.5 : 0.65) : c.type === 'finish' ? 1.25 : c.type === 'rhythm' ? 0.8 : 1);
  function renderClip(X, c) {
    if (c.type === 'vibe') playArr(X, buildStyle(c.style, c.seed), 0, c.dur / 1000 - 0.6);
    else if (c.type === 'inst') playInstrument(X, c.inst, c.seed, 0);
    else if (c.type === 'hl') playHL(X, c, 0);
    else if (c.type === 'finish') playFinish(X, c, 0);
    else if (c.type === 'rhythm') playRhythm(X, c, 0);
  }
  let clipTimers = [], played = '';
  function playClip(c, delay) {
    const AU = BOX.audio; if (!AU || !BOX.scores.tune) return;
    for (const h of clipTimers) clearTimeout(h); clipTimers = [];
    const startPerf = performance.now() + Math.max(0, delay * 1000);
    if (c.type === 'game') {
      AU.need(c.key, () => { const name = gameClip(c.key, c.sec, c.dur / 1000 - 0.4); if (name) clipTimers.push(setTimeout(() => AU.stinger(name, 'tune'), Math.max(0, startPerf - performance.now() - 20))); });
      return;
    }
    const { X, evs } = recorder(clipGain(c));
    try { renderClip(X, c); } catch (e) { console.error(e); return; }
    const total = evs.reduce((m, e) => Math.max(m, e.at), 0), CH = 4;
    for (let k = 0; k * CH <= total; k++) {
      const chunk = evs.filter((e) => e.at >= k * CH && e.at < (k + 1) * CH); if (!chunk.length) continue;
      const fire = () => {
        BOX.scores.tune.stingers._clip = (Y) => { const base = (startPerf - performance.now() - 20) / 1000; for (const e of chunk) { const a = base + e.at; if (a > -0.03) e.play(Y, Math.max(0, a)); } };
        AU.stinger('_clip', 'tune');
      };
      const wait = startPerf + k * CH * 1000 - 350 - performance.now();
      if (wait <= 0) fire(); else clipTimers.push(setTimeout(fire, wait));
    }
  }

  // =========================================================================== TV
  // What the equaliser shows (local performance.now() times).
  const live = { start: 0, end: 0, bpm: 110, type: '', beat0: 0, beatMs: 0, beats: 0, count: 4, round: 0, phase: '', flash: [], first: '' };
  function eqLoop(cv) {
    if (cv.__run) return; cv.__run = true;
    const bars = 48, hts = new Float32Array(bars), peaks = new Float32Array(bars);
    const step = () => {
      if (!document.body.contains(cv)) { cv.__run = false; return; }
      const dpr = Math.min(2, window.devicePixelRatio || 1), W = cv.clientWidth, H = cv.clientHeight;
      if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
      const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
      const now = performance.now(), t = now / 1000;
      const on = now >= live.start && now <= live.end, beatLen = live.beatMs || 60000 / (live.bpm || 110);
      const ph = ((now - (live.beat0 || live.start)) / beatLen) % 1, pulse = on ? Math.pow(1 - (ph < 0 ? ph + 1 : ph), 3) : 0;
      // stage
      let gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#1a0638'); gr.addColorStop(0.65, '#0c0322'); gr.addColorStop(1, '#05010f'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
      for (const [k, c] of [[0, '255,61,139'], [1, '56,232,255'], [2, '255,210,63']]) {
        const x = W * (0.5 + 0.42 * Math.sin(t * (0.3 + k * 0.07) + k * 2.1)), a = 0.08 + (on ? 0.1 * pulse + 0.05 : 0);
        gr = g.createLinearGradient(x, 0, W / 2, H); gr.addColorStop(0, `rgba(${c},${a})`); gr.addColorStop(1, `rgba(${c},0)`);
        g.fillStyle = gr; g.beginPath(); g.moveTo(x - 30, 0); g.lineTo(x + 30, 0); g.lineTo(W / 2 + W * 0.35, H); g.lineTo(W / 2 - W * 0.35, H); g.closePath(); g.fill();
      }
      // floor grid
      g.strokeStyle = 'rgba(255,61,139,0.16)'; g.lineWidth = 1.5; const hz = H * 0.72;
      for (let i = -12; i <= 12; i++) { g.beginPath(); g.moveTo(W / 2 + i * 30, hz); g.lineTo(W / 2 + i * W * 0.12, H); g.stroke(); }
      for (let k = 0; k < 7; k++) { const y = hz + (H - hz) * Math.pow(k / 6, 1.7) + ((t * 30) % 12) * (k / 6); g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
      // equaliser
      const bw = W * 0.86 / bars, x0 = W * 0.07, base = hz;
      for (let i = 0; i < bars; i++) {
        const f = i / bars, shape = 0.55 + 0.45 * Math.sin(f * 5.3 + 1) * Math.sin(f * 2.1 + t * 0.7);
        const noise = 0.5 + 0.5 * Math.sin(t * (6 + (i % 7)) + i * 1.7) * Math.sin(t * (3.1 + (i % 5) * 0.6) + i);
        const target = on ? (0.22 + 0.55 * shape * noise + 0.3 * pulse * (1 - Math.abs(f - 0.3))) : 0.04 + 0.03 * (0.5 + 0.5 * Math.sin(t * 1.5 + i * 0.5));
        hts[i] += (target - hts[i]) * (target > hts[i] ? 0.45 : 0.12);
        peaks[i] = Math.max(peaks[i] - 0.006, hts[i]);
        const h = hts[i] * H * 0.6, x = x0 + i * bw, hue = 320 - f * 150;
        const segs = Math.max(1, Math.floor(h / 10));
        for (let s = 0; s < segs; s++) { g.fillStyle = `hsla(${hue - s * 1.5},100%,${55 + s * 0.6}%,${0.9})`; g.fillRect(x + 2, base - (s + 1) * 10 + 2, bw - 4, 7); }
        g.fillStyle = `hsla(${hue},100%,80%,0.95)`; g.fillRect(x + 2, base - peaks[i] * H * 0.6 - 6, bw - 4, 3);
        // reflection
        g.fillStyle = `hsla(${hue},100%,60%,0.14)`; g.fillRect(x + 2, base + 4, bw - 4, h * 0.35);
      }
      // rhythm: the big beat ring and the count
      if (live.type === 'rhythm' && live.beatMs && now > live.beat0 - live.count * live.beatMs - 400 && now < live.beat0 + live.beats * live.beatMs + 1200) {
        const k = (now - live.beat0) / live.beatMs, idx = Math.floor(k), fr = k - idx;
        const cx = W / 2, cy = H * 0.38, R = Math.min(W, H) * 0.17, beatPulse = Math.pow(1 - fr, 4);
        g.save(); g.shadowColor = '#ff3d8b'; g.shadowBlur = 40 * beatPulse;
        g.strokeStyle = idx < 0 ? '#ffd23f' : '#38e8ff'; g.lineWidth = 10 + 16 * beatPulse; g.beginPath(); g.arc(cx, cy, R * (1 + 0.18 * beatPulse), 0, TAU); g.stroke(); g.restore();
        g.fillStyle = `rgba(255,61,139,${0.25 * beatPulse})`; g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.fill();
        g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff';
        const label = idx < 0 ? String(live.count + idx + 1) : idx < live.beats ? 'TAP!' : '🎉';
        g.font = `${Math.round(R * (idx < 0 ? 0.95 : 0.55))}px Bungee, sans-serif`; g.fillText(label, cx, cy + 4);
        // progress dots
        for (let i = 0; i < live.beats; i++) { const dx = cx + (i - (live.beats - 1) / 2) * 34; g.fillStyle = i < idx ? '#38e8ff' : i === idx ? '#ffd23f' : 'rgba(255,255,255,0.18)'; g.beginPath(); g.arc(dx, cy + R + 50, i === idx ? 11 : 8, 0, TAU); g.fill(); }
      }
      // Finish the melody: light the ending that is playing.
      if (live.type === 'finish') {
        const sec = (now - live.start) / 1000, seg = sec >= FIN_START ? Math.floor((sec - FIN_START) / FIN_SEG) : -1, inSeg = seg >= 0 && seg < 3 && sec - FIN_START - seg * FIN_SEG < 4.1;
        const root = cv.closest('.tb-stage');
        if (root) for (const el of root.querySelectorAll('[data-seg]')) el.classList.toggle('playing', inSeg && Number(el.dataset.seg) === seg && now <= live.end);
        const lab = root && root.querySelector('#tb-nowplay');
        if (lab) { const txt = now < live.start ? '' : sec < FIN_START ? '🎼 The tune…' : inSeg ? `▶ Ending ${seg + 1}` : now <= live.end ? '…' : ''; if (lab.textContent !== txt) lab.textContent = txt; }
      }
      // Higher or lower: which sound is on.
      if (live.type === 'hl') {
        const sec = (now - live.start) / 1000, mid = live.mode === 'pitch' ? 2.0 : 3.4, lab = cv.closest('.tb-stage') && cv.closest('.tb-stage').querySelector('#tb-nowplay');
        if (lab) { const txt = now < live.start || now > live.end ? '' : sec < mid ? (live.mode === 'pitch' ? '🎵 Note 1' : '🥁 Beat 1') : (live.mode === 'pitch' ? '🎵 Note 2' : '🥁 Beat 2'); if (lab.textContent !== txt) lab.textContent = txt; }
      }
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  const ends = {};
  const timer = (key, endsIn) => { if (!endsIn) return ''; if (!ends[key]) ends[key] = Date.now() + endsIn; return `<span class="timer" data-ends="${ends[key]}">${mmss(ends[key] - Date.now())}</span>`; };
  const av = (x) => esc((x && x.avatar) || '🙂');
  const chip = (x, extra = '', cls = '') => `<span class="tb-chip ${cls}" style="--c:${esc(x.color || '#ff3d8b')}"><i>${av(x)}</i>${esc(x.name)}${extra}</span>`;
  function choicesHtml(c, s, opts = {}) {
    const last = s.last, tot = last ? Object.values(last.tally).reduce((a, b) => a + b, 0) : 0;
    return `<div class="tb-choices n${c.choices.length} ${last ? 'rev' : ''}">${c.choices.map((ch, i) => {
      const right = last && ch.id === last.ans, n = last ? last.tally[ch.id] || 0 : 0;
      return `<div class="tb-choice k${i} ${right ? 'right' : last ? 'wrong' : ''}" ${c.type === 'finish' ? `data-seg="${i}"` : ''} style="animation-delay:${0.08 * i}s"><b class="tb-l">${LETTERS[i]}</b><span class="tb-ic">${esc(ch.icon)}</span><span class="tb-lab">${esc(ch.label)}</span>${last ? `<span class="tb-n">${n}${tot ? `<small>${Math.round((n / tot) * 100)}%</small>` : ''}</span>` : ''}${right ? '<span class="tb-tick">✓</span>' : ''}</div>`;
    }).join('')}</div>${opts.foot || ''}`;
  }
  function tvRhythmReveal(s) {
    const L = s.last;
    return `<div class="tb-head in"><span class="tb-badge">🥁 RHYTHM TAP</span><h2>${L.best ? `${av(L.best)} ${esc(L.best.name)} kept the best time!` : 'Nobody found the beat!'}</h2></div>
      <div class="tb-rrows">${L.rows.map((r, i) => `<div class="tb-rrow" style="animation-delay:${0.1 * i}s;--c:${esc(r.color)}"><span class="nm">${av(r)} ${esc(r.name)}</span><span class="dots">${r.marks.map((m) => `<i class="m${m}"></i>`).join('')}</span><span class="acc"><span style="width:${r.acc}%"></span></span><b>${r.acc}%</b><em>+${r.gain}</em></div>`).join('')}${L.more ? `<div class="muted">+${L.more} more drummers</div>` : ''}</div>`;
  }
  function tvOver(s) {
    const f = s.final || { standings: s.standings, awards: {} }, st = f.standings, pod = [st[1], st[0], st[2]];
    const AW = [['ear', '👂', 'Golden Ear', (a) => `${a.value} right answer${a.value === 1 ? '' : 's'}`], ['finger', '⚡', 'Fastest Finger', (a) => `buzzed right in ${(a.value / 1000).toFixed(1)} s`],
      ['metronome', '🥁', 'Human Metronome', (a) => `${a.value}% rhythm accuracy`], ['first', '🔔', 'First on the Buzzer', (a) => `${a.value} first buzz${a.value === 1 ? '' : 'es'}`], ['trigger', '💥', 'Trigger Happy', (a) => `${a.value} wrong buzzes`]];
    return `<div class="tb-over"><h1 class="tb-win">🏆 ${st[0] ? `${av(st[0])} ${esc(st[0].name)}` : ''} <span>tops the charts!</span></h1>
      <div class="tb-podium">${pod.map((r, i) => (r ? `<div class="tb-pod p${[2, 1, 3][i]}" style="--c:${esc(r.color)}"><div class="av">${av(r)}</div><div class="nm">${esc(r.name)}</div><div class="pts">${r.points}</div><div class="blk">${[2, 1, 3][i]}</div></div>` : '<div></div>')).join('')}</div>
      <div class="tb-awards">${AW.filter(([k]) => f.awards[k]).map(([k, ic, lab, txt], i) => `<div class="tb-award" style="animation-delay:${0.5 + i * 0.3}s"><div class="ic">${ic}</div><div class="lb">${lab}</div><div class="nm">${f.awards[k].names.map(esc).join(', ')}</div><div class="muted">${txt(f.awards[k])}</div></div>`).join('')}</div>
      <div class="tb-final-board">${BOX.board(st.slice(0, 10).map((r) => ({ ...r, name: (r.avatar ? r.avatar + ' ' : '') + r.name })), (r) => r.points, ' pts')}</div></div>`;
  }
  function tv(el, s) {
    if (!s) return;
    if (s.phase === 'over') { live.end = 0; BOX.morph(el, `<div class="tb-root over" id="tb-over">${tvOver(s)}</div>`); return; }
    const c = s.clip || {};
    // Schedule the clip once per round, on the server's clock.
    if (c.play && c.atIn != null && (s.phase === 'clip' || s.phase === 'tap')) {
      const k = s.round + ':' + c.type;
      if (played !== k) {
        played = k; const now = performance.now();
        live.start = now + c.atIn; live.end = now + c.endIn; live.type = c.type; live.mode = c.mode; live.round = s.round;
        live.bpm = c.play.bpm || (c.type === 'game' ? 120 : c.type === 'finish' ? FIN_BPM : 110);
        if (c.type === 'rhythm') { live.beat0 = now + c.beatIn; live.beatMs = c.beatMs; live.beats = c.beats; live.count = c.count; } else { live.beat0 = live.start; live.beatMs = 0; }
        playClip(c.play, c.atIn / 1000);
      }
    }
    if (s.phase === 'card' && c.play && c.play.type === 'game' && BOX.audio) BOX.audio.need(c.play.key);
    const top = `<div class="tb-top"><span class="tb-round">ROUND <b>${s.round}</b> / ${s.of}</span><span class="tb-type">${esc(c.icon || '')} ${esc((c.title || '').toUpperCase())}</span>${s.mult > 1 ? '<span class="tb-x2">🌟 GRAND FINALE · DOUBLE POINTS</span>' : ''}</div>`;
    let over = '';
    if (s.phase === 'card') {
      over = `<div class="tb-card"><div class="tb-card-ic">${esc(c.icon || '🎵')}</div><div class="tb-card-n">ROUND ${s.round}</div><h1>${esc(c.title || '')}</h1><p>${esc(c.ask || '')}</p>
        ${c.type === 'rhythm' ? '<p class="tb-hint">Get your thumb on the big pad. Tap on every beat after the count-in!</p>' : '<p class="tb-hint">🔔 Buzz in early for a speed bonus. A wrong buzz locks you out!</p>'}</div>`;
    } else if (s.phase === 'clip' || s.phase === 'last') {
      const buzz = s.buzzed.length ? `<div class="tb-buzzes">${s.buzzed.map((b) => chip(b, b.locked ? ' 🔒' : b.answered ? ' ✔' : ' 🔔', b.locked ? 'locked' : 'buzz')).join('')}</div>` : '';
      const head = s.phase === 'clip'
        ? `<div class="tb-head"><span class="tb-live">● ON AIR</span><h2>${esc(c.ask)}</h2><div class="tb-now" id="tb-nowplay"></div></div>`
        : `<div class="tb-head"><span class="tb-last">⏰ LAST CALL ${timer('l' + s.round, s.endsIn)}</span><h2>${esc(c.ask)}</h2><div class="tb-sub">${s.answered} of ${s.players} answered · no speed bonus now</div></div>`;
      over = `${head}${choicesHtml(c, s)}${buzz}${s.phase === 'last' && s.waiting && s.waiting.length ? `<div class="tb-wait">Still thinking: ${s.waiting.map(esc).join(', ')}</div>` : ''}`;
    } else if (s.phase === 'tap') {
      over = `<div class="tb-head"><span class="tb-live">● ON AIR</span><h2>Tap along on your phone!</h2><div class="tb-sub">${c.bpm || ''} BPM · ${c.beats || 12} beats after the count-in</div></div>`;
    } else if (s.phase === 'reveal' && s.last) {
      if (s.last.rhythm) over = tvRhythmReveal(s);
      else {
        const L = s.last;
        over = `<div class="tb-head in"><span class="tb-badge">IT WAS…</span><h2 class="tb-ans">${esc(L.answer.icon)} ${esc(L.answer.label)}</h2>
          ${L.first ? `<div class="tb-first">⚡ First to buzz right: ${chip(L.first)}</div>` : ''}</div>
          ${choicesHtml(c, s)}
          <div class="tb-gets">${L.right.length ? L.right.map((r) => chip(r, ` <b>+${r.gain}</b>${r.buzz ? ' ⚡' : ''}`, 'got')).join('') + (L.rightCount > L.right.length ? `<span class="muted">+${L.rightCount - L.right.length} more</span>` : '') : '<span class="tb-none">Nobody got it! 😱</span>'}
          ${L.lockouts.length ? `<span class="tb-locks">🔒 ${L.lockouts.map((x) => esc(x.name)).join(', ')}</span>` : ''}</div>
          ${s.next ? `<div class="tb-next">Up next: ${esc(s.next)}</div>` : ''}`;
      }
    }
    const side = `<aside class="tb-side"><h3>📻 The Charts</h3>${s.standings.map((r, i) => `<div class="tb-srow ${i === 0 && r.points ? 'top' : ''}"><span class="n">${i + 1}</span><span class="nm">${av(r)} ${esc(r.name)}</span><b>${r.points}</b></div>`).join('')}</aside>`;
    BOX.morph(el, `<div class="tb-root" id="tb-game">${top}<div class="tb-main"><section class="tb-stage"><canvas class="tb-eq" data-keep></canvas><div class="tb-o ph-${s.phase} t-${esc(c.type || '')}" id="tb-o-${s.round}-${s.phase}">${over}</div></section>${side}</div></div>`);
    const cv = el.querySelector('.tb-eq'); if (cv) eqLoop(cv);
  }

  // =========================================================================== LOBBY
  const DESK = {
    rounds: { lab: 'SET LENGTH', ic: '🎚️', opts: { 12: '12', 16: '16', 20: '20' }, sub: 'rounds' },
    seconds: { lab: 'LAST CALL', ic: '⏰', opts: { 8: '8s', 10: '10s', 15: '15s' }, sub: 'to answer' },
    mix: { lab: 'ROUND MIX', ic: '🎛️', opts: { all: 'Everything', quiz: 'No tapping' }, sub: '' },
    showIntro: { lab: 'THE OPENING', ic: '🎬', opts: { true: 'Play it', false: 'Skip it' }, sub: 'intro cutscene' },
  };
  function lobbyTv(el, L) {
    el.__L = L;
    if (!el.__tbl) {
      el.__tbl = true;
      el.innerHTML = `<div class="tbl">
        <canvas class="tbl-cv"></canvas>
        <header class="tbl-head"><div class="tbl-onair">● ON AIR</div><div class="tbl-logo"><span class="a">TUNE</span><span class="b">BUZZ</span></div><div class="tbl-tag">The music quiz where every song is one of ours</div></header>
        <section class="tbl-desk"><div class="tbl-dh">🎛️ MIXING DESK <small>tap to change</small></div><div id="tbl-faders" class="tbl-faders"></div><div id="settings" class="tbl-sr"></div></section>
        <aside class="tbl-join"><div class="tbl-jt">🎧 CALL IN ON YOUR PHONE</div><img id="qr" alt="QR code to join"><div class="tbl-url" id="tbl-url"></div>
          <div class="tbl-cc">ROOM CODE</div><div class="tbl-code" id="code"></div><div class="tbl-vip" id="tbl-vip"></div><div class="err" id="lobby-err"></div>
          <button class="tbl-start" id="start">🔴 Go on air</button>
          <div class="tbl-links"><button id="add-bots">+ 5 test bots</button><button id="tbl-rm">remove bots</button><button id="tbl-pick">🎮 Other game</button></div></aside>
        <section class="tbl-crowd"><div class="tbl-ch"><b id="tbl-n">0</b> CALLERS ON THE LINE</div><div class="tbl-roster" id="roster"></div></section>
        <div class="tbl-party" id="tbl-party"></div></div>`;
      const $ = (q) => el.querySelector(q);
      $('#start').onclick = async () => { const r = await el.__L.start(); $('#lobby-err').textContent = r && r.ok ? '' : (r && r.error) || ''; };
      $('#add-bots').onclick = () => el.__L.bots(5);
      $('#tbl-rm').onclick = () => el.__L.removeBots && el.__L.removeBots();
      $('#tbl-pick').onclick = () => el.__L.pick();
      el.addEventListener('click', (e) => {
        const k = e.target.closest('[data-k]');
        if (k) { const s = el.querySelector(`select[data-set="${k.dataset.k}"]`); if (s) s.value = k.dataset.v; el.__L.set(k.dataset.k, k.dataset.v); BOX.sfx('pop'); return; }
        const c = e.target.closest('[data-kick]'); if (c && el.__L.kick && confirm('Remove this player?')) el.__L.kick(c.dataset.kick);
      });
      lobbyScene($('.tbl-cv'));
    }
    const $ = (q) => el.querySelector(q);
    if ($('#code').textContent !== L.code) $('#code').textContent = L.code;
    const ju = L.joinUrl || L.qr;
    if ($('#qr').dataset.u !== ju) { $('#qr').src = L.qr; $('#qr').dataset.u = ju; }
    $('#tbl-url').textContent = (L.joinUrl || '').replace(/^https?:\/\//, '');
    const n = L.players.length;
    $('#start').disabled = n < L.min;
    $('#tbl-n').textContent = n;
    $('#tbl-vip').innerHTML = L.vip ? `👑 <b>${esc(L.vip)}</b> can start from their phone` : n < L.min ? `${L.min - n} more caller${L.min - n === 1 ? '' : 's'} needed…` : 'The first caller hosts 👑';
    const fh = L.fields.map((f) => {
      const D = DESK[f.key] || { lab: f.label.toUpperCase(), ic: '🎚️', opts: {} }, cur = String(L.settings[f.key]);
      const i = Math.max(0, f.options.findIndex((o) => String(o.value) === cur)), pct = f.options.length > 1 ? (i / (f.options.length - 1)) * 100 : 50;
      return `<div class="tbl-ch-strip"><div class="tbl-fl">${D.ic} ${esc(D.lab)}</div><div class="tbl-rail"><span class="tbl-knob" style="left:${pct}%"></span></div>
        <div class="tbl-opts">${f.options.map((o) => `<button class="tbl-opt ${String(o.value) === cur ? 'on' : ''}" data-k="${esc(f.key)}" data-v="${esc(String(o.value))}" title="${esc(o.label)}">${esc(D.opts[String(o.value)] || o.label)}</button>`).join('')}</div>${D.sub ? `<div class="tbl-sub">${esc(D.sub)}</div>` : ''}</div>`;
    }).join('');
    const fd = $('#tbl-faders'); if (fd.__h !== fh) { fd.__h = fh; BOX.morph(fd, fh); }
    const box = $('#settings'), sig = L.fields.map((f) => f.key + ':' + f.options.map((o) => o.value).join('|')).join(';');
    if (box.__sig !== sig) { box.__sig = sig; box.innerHTML = L.fields.map((f) => `<label>${esc(f.label)}<select data-set="${esc(f.key)}">${f.options.map((o) => `<option value="${esc(String(o.value))}">${esc(o.label)}</option>`).join('')}</select></label>`).join(''); }
    for (const s of box.querySelectorAll('select[data-set]')) { if (document.activeElement !== s) s.value = String(L.settings[s.dataset.set]); s.onchange = () => { s.blur(); el.__L.set(s.dataset.set, s.value); }; }
    const rh = n ? L.players.map((p, i) => `<span class="chip ${p.online ? '' : 'off'} ${p.name === L.vip ? 'vip' : ''}" data-kick="${esc(p.id)}" title="Click to remove" style="--c:${esc(p.color || '#ff3d8b')};--d:${((i * 0.17) % 1.6).toFixed(2)}s"><span class="vin"><span class="lbl">${esc(p.avatar || '🙂')}</span></span><b>${esc(p.name)}</b></span>`).join('')
      : '<div class="tbl-empty">📞 The lines are open… scan the code to call in!</div>';
    const r = $('#roster'); r.classList.toggle('many', n > 12); if (r.__h !== rh) { r.__h = rh; BOX.morph(r, rh); }
    const lp = $('#tbl-party'), lh = L.lineupHtml || ''; if (lp.__h !== lh) { lp.__h = lh; lp.innerHTML = lh; }
  }
  // The lobby backdrop: a slow equaliser skyline and drifting notes.
  function lobbyScene(cv) {
    const notes = Array.from({ length: 22 }, () => ({ x: Math.random(), y: Math.random(), v: 0.02 + Math.random() * 0.04, e: ['🎵', '🎶', '🎧', '🎤', '🎸', '🥁'][Math.floor(Math.random() * 6)], s: 18 + Math.random() * 22 }));
    const f = () => {
      if (!document.body.contains(cv)) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1), W = cv.clientWidth, H = cv.clientHeight;
      if (cv.width !== Math.round(W * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
      const g = cv.getContext('2d'), t = performance.now() / 1000; g.setTransform(dpr, 0, 0, dpr, 0, 0);
      const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#1b0640'); gr.addColorStop(1, '#07021a'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
      const n = 64, bw = W / n;
      for (let i = 0; i < n; i++) { const h = H * (0.08 + 0.12 * (0.5 + 0.5 * Math.sin(t * 1.3 + i * 0.45) * Math.sin(t * 0.7 + i * 0.13))); g.fillStyle = `hsla(${320 - (i / n) * 150},100%,60%,0.22)`; g.fillRect(i * bw + 1, H - h, bw - 2, h); }
      g.textAlign = 'center';
      for (const p of notes) { p.y -= p.v / 60; if (p.y < -0.05) { p.y = 1.05; p.x = Math.random(); } g.globalAlpha = 0.28; g.font = `${p.s}px serif`; g.fillText(p.e, p.x * W + Math.sin(t + p.y * 9) * 14, p.y * H); }
      g.globalAlpha = 1;
      requestAnimationFrame(f);
    };
    requestAnimationFrame(f);
  }

  // =========================================================================== PHONE
  // Clock sync for rhythm rounds: a few round trips, keep the fastest.
  const clock = { off: null, busy: false, round: -1 };
  async function syncClock(ctx) {
    if (clock.busy) return; clock.busy = true;
    const samples = [];
    for (let i = 0; i < 6; i++) {
      const t0 = Date.now(); let r = null; try { r = await ctx.act({ op: 'sync' }); } catch { /* offline */ }
      const t1 = Date.now(); if (r && r.ok && typeof r.now === 'number') samples.push({ rtt: t1 - t0, off: r.now - (t0 + t1) / 2 });
    }
    samples.sort((a, b) => a.rtt - b.rtt);
    if (samples.length) clock.off = samples[0].off;
    clock.busy = false;
  }
  function haptic(ctx, kind) { try { if (ctx.haptic) ctx.haptic(kind); else if (ctx.vibrate) ctx.vibrate(kind === 'tap' ? 10 : 40); } catch { /* none */ } }
  let felt = {};
  const feel = (ctx, chan, key, kind) => { if (felt[chan] === key) return; felt[chan] = key; haptic(ctx, kind); };
  let redrawT = 0;
  const redrawAt = (ctx, ms) => { clearTimeout(redrawT); if (ms > 0 && ms < 30000) redrawT = setTimeout(() => ctx.redraw && ctx.redraw(), ms + 30); };
  // The rhythm pad keeps its own beat display (a timer, not the shell's re-renders).
  const pad = { round: -1, beat0: 0, beatMs: 0, beats: 0, count: 4, hits: [], last: '', raf: 0 };
  function padLoop(el) {
    cancelAnimationFrame(pad.raf);
    const f = () => {
      const box = el.querySelector('#tb-pad'); if (!box) return;
      const now = Date.now() + (clock.off || 0), k = (now - pad.beat0) / pad.beatMs, idx = Math.floor(k), fr = k - idx;
      const big = box.querySelector('.big'), ring = box.querySelector('.ring');
      const txt = idx < -pad.count ? 'Get ready…' : idx < 0 ? String(pad.count + idx + 1) : idx < pad.beats ? (pad.last || 'TAP!') : 'Done! 🎉';
      if (big && big.textContent !== txt) big.textContent = txt;
      if (ring) { const p = idx >= -pad.count && idx < pad.beats ? Math.pow(1 - fr, 3) : 0; ring.style.transform = `scale(${1 + 0.12 * p})`; ring.style.opacity = String(0.35 + 0.65 * p); }
      if (idx < pad.beats + 2) pad.raf = requestAnimationFrame(f);
    };
    pad.raf = requestAnimationFrame(f);
  }
  function choiceBtns(c, cls, pickedId) {
    return `<div class="tbp-choices ${cls}">${c.choices.map((ch, i) => `<button class="tbp-ch k${i} ${pickedId === ch.id ? 'sel' : ''}" data-id="${esc(ch.id)}"><b>${LETTERS[i]}</b><span class="ic">${esc(ch.icon)}</span><span class="lb">${esc(ch.label)}</span></button>`).join('')}</div>`;
  }
  function bindChoices(el, ctx) {
    for (const b of el.querySelectorAll('[data-id]')) b.onclick = async () => {
      haptic(ctx, 'select');
      const r = await ctx.act({ op: 'pick', id: b.dataset.id });
      if (r && r.ok) { if (r.right === true) { haptic(ctx, 'success'); ctx.sfx && ctx.sfx('chime'); } else if (r.right === false) haptic(ctx, 'error'); }
    };
  }
  function phone(el, v, ctx, full) {
    if (!v) return;
    const at = (full && full._at) || Date.now();
    const head = `<div class="tbp-head"><span>🎧 <b>${v.points}</b> pts${v.rank ? ` · #${v.rank}` : ''}</span><span>${v.mult > 1 ? '🌟 x2 FINALE' : `Round ${v.round}/${v.of}`}</span></div>`;
    const paint = (html, key) => BOX.morph(el, `<div class="tbp" id="tbp-${esc(key)}">${head}${html}</div>`);
    if (v.phase === 'over') {
      const f = v.final || { awards: {}, standings: [] };
      feel(ctx, 'over', 1, v.rank === 1 ? 'win' : 'success');
      const mine = Object.entries({ ear: '👂 Golden Ear', finger: '⚡ Fastest Finger', metronome: '🥁 Human Metronome', first: '🔔 First on the Buzzer', trigger: '💥 Trigger Happy' }).filter(([k]) => f.awards[k] && full && full.me && f.awards[k].names.includes(full.me.name)).map(([, l]) => l);
      paint(`<div class="tbp-card tbp-end"><div class="tbp-place">${v.rank === 1 ? '🏆' : v.rank === 2 ? '🥈' : v.rank === 3 ? '🥉' : '🎧'}</div><h2>#${v.rank} of ${v.ofPlayers}</h2><p class="tbp-big">${v.points} points</p>${mine.length ? `<div class="tbp-awards">${mine.map((m) => `<span>${m}</span>`).join('')}</div>` : ''}</div>
        <div class="tbp-card">${BOX.board(f.standings.slice(0, 8), (r) => r.points, ' pts')}</div>`, 'over');
      return;
    }
    if (felt.over) felt = {};
    const c = v.clip || {}, key = v.round + '-' + v.phase;
    if (c.type === 'rhythm' && clock.round !== v.round) { clock.round = v.round; syncClock(ctx); }
    if (v.phase === 'card') {
      feel(ctx, 'card', v.round, 'turn');
      paint(`<div class="tbp-card tbp-intro"><div class="tbp-ic">${esc(c.icon || '🎵')}</div><div class="tbp-rn">ROUND ${v.round}</div><h2>${esc(c.title || '')}</h2><p>${esc(c.ask || '')}</p>
        <p class="tbp-tip">${c.type === 'rhythm' ? '👆 Tap the big pad on every beat. Steady wins!' : '🔔 Buzz early for a speed bonus. Wrong buzz = locked out!'}</p></div>`, key);
      return;
    }
    if (v.phase === 'tap') {
      if (pad.round !== v.round) { pad.round = v.round; pad.hits = []; pad.last = ''; }
      const off = clock.off != null ? clock.off : (v.now - at);
      pad.beatMs = c.beatMs; pad.beats = c.beats; pad.count = c.count || 4;
      // beat0 above is in server time: (local receive time + ms until the first beat) + offset
      pad.beat0 = (at + off) + (c.beatIn || 0);
      feel(ctx, 'tap', v.round, 'turn');
      paint(`<div class="tbp-sync">${clock.off == null ? '⏱️ syncing…' : '⏱️ clock synced'}</div><div class="tbp-pad" id="tb-pad" data-keep><div class="ring"></div><div class="big">Get ready…</div><div class="small">Tap on every beat</div></div>`, key);
      const p = el.querySelector('#tb-pad');
      if (p && !p.__bound) {
        p.__bound = true; p.innerHTML = '<div class="ring"></div><div class="big">Get ready…</div><div class="small">Tap on every beat</div>';
        p.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          const t = Date.now() + (clock.off != null ? clock.off : 0), k = (t - pad.beat0) / pad.beatMs, i = Math.round(k);
          if (i >= 0 && i < pad.beats) { const d = Math.abs(k - i) * pad.beatMs; pad.last = d <= 50 ? 'PERFECT!' : d <= 100 ? 'GREAT' : d <= 170 ? 'OK' : 'MISS'; }
          p.classList.remove('hit'); void p.offsetWidth; p.classList.add('hit');
          haptic(ctx, 'tap');
          ctx.act({ op: 'tap', t: Math.round(t) });
        });
      }
      padLoop(el);
      return;
    }
    if (v.phase === 'clip' || v.phase === 'last') {
      const b = v.buzz, m = v.mine;
      if (m) {
        if (v.phase === 'clip' && m.buzz) feel(ctx, 'res' + v.round, 1, m.right ? 'success' : 'error');
        const ch = c.choices.find((x) => x.id === m.id) || {};
        paint(`<div class="tbp-card tbp-locked ${m.buzz ? (m.right ? 'good' : 'bad') : ''}"><div class="tbp-ic">${m.buzz ? (m.right ? '⚡' : '🔒') : '📨'}</div>
          <h2>${m.buzz ? (m.right ? `Right! +${m.gain}` : 'Wrong buzz!') : 'Answer locked in'}</h2><p>You said <b>${esc(ch.icon || '')} ${esc(ch.label || '')}</b></p>${m.buzz && !m.right ? `<p class="muted">−${-m.gain} and you’re out for this clip.</p>` : m.first ? '<p class="tbp-gold">🔔 FIRST RIGHT BUZZ!</p>' : '<p class="muted">Eyes on the big screen…</p>'}</div>`, key + '-m');
        return;
      }
      if (b && b.locked) {
        feel(ctx, 'lock' + v.round, 1, 'warn');
        paint(`<div class="tbp-card tbp-locked bad"><div class="tbp-ic">🔒</div><h2>${b.timeout ? 'Too slow!' : 'Locked out'}</h2><p class="muted">You buzzed but didn’t answer in time. Back next clip!</p></div>`, key + '-lk');
        return;
      }
      if (b && b.open) {
        feel(ctx, 'buzz' + v.round, 1, 'buzz');
        paint(`<div class="tbp-buzzed"><div class="tbp-bt">🔔 YOU BUZZED! Pick fast:</div><div class="tbp-bar"><span style="animation-duration:${Math.max(200, b.pickIn)}ms"></span></div></div>${choiceBtns(c, 'quick')}`, key + '-b');
        bindChoices(el, ctx); return;
      }
      if (v.phase === 'last') {
        feel(ctx, 'last' + v.round, 1, 'select');
        paint(`<div class="tbp-lc">⏰ LAST CALL · ${timer('pl' + v.round, v.endsIn)}<small>No speed bonus now. Wrong answers cost nothing.</small></div><div class="tbp-ask">${esc(c.ask)}</div>${choiceBtns(c, '')}`, key);
        bindChoices(el, ctx); return;
      }
      // the clip is playing: the BUZZER
      const openAt = at + (c.buzzIn || 0), wait = openAt - Date.now(), open = wait <= 0;
      if (!open) redrawAt(ctx, wait);
      paint(`<div class="tbp-ask">${esc(c.ask)}</div><div class="tbp-hint">${open ? 'Know it? BUZZ!' : c.type === 'finish' ? '🎧 Listen to the endings…' : c.type === 'hl' ? '🎧 Wait for the second sound…' : '🎧 Listen…'}</div>
        <button class="tbp-buzz ${open ? 'open' : ''}" id="tbp-buzz" ${open ? '' : 'disabled'}><span>BUZZ</span></button>
        <div class="tbp-legend">${c.choices.map((ch, i) => `<span class="k${i}"><b>${LETTERS[i]}</b> ${esc(ch.icon)} ${esc(ch.label)}</span>`).join('')}</div>`, key + (open ? '-o' : '-w'));
      const bb = el.querySelector('#tbp-buzz');
      if (bb) bb.onclick = async () => { haptic(ctx, 'buzz'); const r = await ctx.act({ op: 'buzz' }); if (r && r.ok) ctx.sfx && ctx.sfx('pop'); };
      return;
    }
    if (v.phase === 'reveal' && v.last) {
      const L = v.last, m = v.mine;
      if (L.rhythm) {
        const g = m ? m.gain : 0;
        feel(ctx, 'rev' + v.round, 1, g >= 300 ? 'success' : g > 0 ? 'select' : 'error');
        paint(`<div class="tbp-card tbp-res ${g > 0 ? 'good' : 'bad'}"><div class="tbp-ic">🥁</div><h2>${m && m.acc != null ? `${m.acc}% on the beat` : 'You sat this one out'}</h2>
          ${m && m.marks ? `<div class="tbp-dots">${m.marks.map((x) => `<i class="m${x}"></i>`).join('')}</div>` : ''}<p class="tbp-big">+${g}</p>${m && m.perfect ? `<p class="muted">${m.perfect} perfect hit${m.perfect === 1 ? '' : 's'}</p>` : ''}</div>`, key);
        return;
      }
      const right = m && m.right, gain = m ? m.gain : 0;
      feel(ctx, 'rev' + v.round, 1, right ? 'success' : m ? 'error' : 'warn');
      paint(`<div class="tbp-card tbp-res ${right ? 'good' : 'bad'}"><div class="tbp-ic">${right ? '🎉' : m ? '😬' : '🤐'}</div><h2>${right ? 'You got it!' : m ? 'Not this time' : 'No answer'}</h2>
        <p>It was <b>${esc(L.answer.icon)} ${esc(L.answer.label)}</b></p><p class="tbp-big ${gain < 0 ? 'neg' : ''}">${gain > 0 ? '+' + gain : gain < 0 ? '−' + -gain : '+0'}</p>${m && m.first ? '<p class="tbp-gold">🔔 First right buzz!</p>' : ''}</div>`, key);
      return;
    }
    paint('<div class="tbp-card"><h2>Next track coming up…</h2></div>', key);
  }

  BOX.games.tune = {
    name: 'Tune Buzz', icon: '🎵', lobbyTv,
    // Music: silence while a clip or the beat plays (the clip IS the music); a soft groove otherwise.
    music: (s) => { const m = { card: null, clip: null, tap: null, last: 'think', reveal: 'reveal', over: 'finale' }; return s.phase in m ? m[s.phase] : 'play'; },
    about: 'A music quiz on the big screen: name the game from its soundtrack, guess the vibe, spot the instrument, finish the melody and tap the beat. Buzz in first!',
    how: [
      'Music plays on the TV. Every clip is original: JustGameBox soundtracks and tunes made on the spot.',
      'Rounds: Which game?, Guess the vibe, Instrument ID, Higher or lower, Finish the melody and Rhythm tap.',
      'Know it? Hit BUZZ, then pick within 5 seconds: +100, up to +200 for speed, +100 if you’re the first right buzz.',
      'A wrong buzz costs 50 and locks you out for that clip. Not sure? Wait for LAST CALL: +100, no risk.',
      'Rhythm tap: tap the big pad on every beat after the count-in. Up to +400 for steady timing.',
      'The last round is the Grand Finale: double points. Top of the charts wins!',
    ],
    fx: { round: 'pop', finale: 'sting', buzz: 'buzz', right: 'chime', wrong: 'buzzer', lockout: 'buzzer', last: 'tick', reveal: 'reveal', nobody: 'shrug', win: 'win' },
    onFx(f) { if (f.kind === 'buzz') live.flash.push(performance.now()); },
    tv, phone,
    _test: { STYLES, INSTR, buildStyle, finishPlan, melody, rngOf, recorder, renderClip, clipGain },
  };
})();
