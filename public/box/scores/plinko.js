'use strict';
// JustDrop: a disco-casino arcade groove in C minor. Four-on-the-floor funk kit, slap
// synth bass, clavinet chops, brass stabs and a glockenspiel hook that "bounces" down like a
// ball through pegs. A spacey bossa for aiming and drawing, a pounding countdown for the
// last seconds, a horn-section payout for the results, and a big-band finale.
// Stingers: peg ticks (random pitches), slot coins, the jackpot fanfare, a sad-trombone bust.
(function () {
  const S = (window.BOX.scores = window.BOX.scores || {});
  const tracks = {
    clav: { type: 'clav', mode: 'chord', center: 64, n: 3, vol: 0.32, pan: -0.25 },
    keys: { type: 'epiano', mode: 'chord', center: 62, n: 4, vol: 0.3, pan: 0.2, trem: 0.2 },
    bass: { type: 'synthbass', mode: 'bass', oct: 2, vol: 0.85 },
    hook: { type: 'glock', vol: 0.42, pan: 0.15, dly: 0.14 },
    lead: { type: 'brass', vol: 0.36, pan: 0.1 },
    stab: { type: 'brass', mode: 'chord', center: 67, n: 4, vol: 0.3 },
    pad: { type: 'strings', mode: 'chord', center: 67, n: 4, vol: 0.18 },
    dr: { type: 'drums', kit: 'funk' },
  };
  const A = 'Cm9 | Fm9 | Abmaj7 | G7#9 | Cm9 | Fm9 | Dbmaj7 | G7sus4 G7';
  const B = 'Abmaj7 | Bbsus4 Bb | Gm7 | Cm9 | Abmaj7 | Bb13 | Ebmaj7 | G7#9';
  // the "bouncing ball" hook: a run that tumbles down and lands
  const hookA = 'g6 . eb6 . c6 . g5 . | ab5 . c6 eb6 - . . . | c6 . ab5 . f5 . eb5 . | d5 - - - . . g5 b5 | g6 . eb6 . c6 . g5 . | ab5 . c6 f6 - . . . | f5 . ab5 . db6 . f6 . | d6 - - - b5 - - -';
  const leadB = 'eb5 - - - c5 - eb5 f5 | g5 - - - . . . . | f5 - d5 - bb4 - d5 f5 | g5 - - - eb5 - - - | eb5 - - - c5 - eb5 f5 | ab5 - - - g5 - f5 - | g5 - - - bb5 - - - | b5 - - - - - . .';
  const disco = { k: 'x...x...x...x...', s: '....x.......x...', h: '..x...x...x...x.', o: '..o...o...o...o.', c: '....x.......x...' };
  const disco2 = { ...disco, h: 'xxoxxxoxxxoxxxox', s: '....x..g....x.g.', tb: '..x...x...x...x.' };
  const clavChop = '.x.xx.x..x.x.xx.';
  const slap = '1 . 1 8 . 1 b7 5 | 1 . 1 8 . 5 b7 8';
  S.plinko = {
    name: 'JustDrop',
    cues: {
      title: {
        bpm: 116, swing16: 0.54, tracks,
        sections: {
          I: { bars: 4, chords: 'Cm9 | Cm9 | Abmaj7 | G7#9', pad: true, hook: 'g6 . eb6 . c6 . g5 . | eb5 . c5 . g4 . . . | ab5 . f5 . c5 . ab4 . | b4 - - - d5 - g5 -', dr: { h: '..x...x...x...x.', k: 'x.......x.......' }, bass: '1 - - - - - - - | 1 - - - - - 5 .' },
          A: { bars: 8, chords: A, clav: clavChop, bass: slap, hook: hookA, dr: disco },
          B: { bars: 8, chords: B, clav: clavChop, keys: 'x...x...x...x...', bass: slap, lead: leadB, stab: '................|..........x.x...', dr: disco2 },
          A2: { bars: 8, chords: A, clav: clavChop, bass: slap, hook: hookA, lead: { p: hookA, vol: 0.18, oct: -1 }, stab: 'x.......x.x.....|................', dr: disco2 },
        },
        form: ['I', 'A', 'B', 'A2'], loop: 1,
      },
      lobby: { from: 'title', bpm: 108, form: ['A', 'B'], loop: 0, mute: ['stab', 'lead'], sections: { A: { dr: { k: 'x...x...x...x...', h: '..x...x...x...x.' } } } },
      intro: { from: 'title', bpm: 118, form: ['I', 'A2'], loop: 1 },
      // Aiming and drawing: a spacey arcade bossa with marimba and a soft pad.
      think: {
        bpm: 104,
        tracks: { mar: { type: 'marimba', mode: 'chord', center: 64, n: 3, vol: 0.38, pan: -0.2 }, ep: { type: 'epiano', mode: 'chord', center: 62, n: 4, vol: 0.3, trem: 0.3 }, bass: { type: 'bass', mode: 'bass', oct: 2 }, gl: { type: 'glock', vol: 0.28, pan: 0.25, dly: 0.2 }, pad: { type: 'pad', mode: 'chord', center: 66, vol: 0.16, cut: 1500 }, dr: { type: 'drums', kit: 'lofi', vol: 0.7 } },
        sections: {
          A: { bars: 8, chords: 'Cm9 | Abmaj9 | Fm9 | G7sus4 | Cm9 | Abmaj9 | Dbmaj7 | G7#9', mar: 'x..x..x...x..x..', ep: true, pad: true, bass: '1 - - 5 1 - - 5', gl: 'g6 . . . . . eb6 . | . . c6 . . . . . | ab5 . . . . . c6 . | d6 . . . . . . . | g6 . . . . . eb6 . | . . c6 . . . . . | f6 . . . . . db6 . | b5 . . . . . . .', dr: { k: 'x.....x...x.....', rim: '...x..x....x..x.', sh: 'xxxxxxxxxxxxxxxx' } },
        },
        form: ['A'], loop: 0,
      },
      play: { from: 'title', bpm: 122, form: ['A', 'B', 'A2'], loop: 0 },
      // The last seconds: a pounding minor ostinato with a ticking clock.
      tense: {
        bpm: 132,
        tracks: { ost: { type: 'synthbass', vol: 0.8 }, stab: { ...tracks.stab, vol: 0.32 }, pad: { type: 'strings', mode: 'chord', center: 66, vol: 0.2 }, dr: { type: 'drums', kit: 'funk' }, clk: { type: 'drums', vol: 0.6 } },
        sections: {
          A: { bars: 4, chords: 'Cm | Cm | Db/C | Cm', ost: 'c2 c2 c3 c2 eb3 c2 g2 c2', pad: true, clk: { tick: 'x.x.x.x.x.x.x.x.' }, dr: { k: 'x...x...x...x...', s: '....x.......x...', h: 'xxxxxxxxxxxxxxxx' } },
          B: { bars: 4, chords: 'Ab | G7 | Ab | G7#9', ost: 'ab1 ab1 ab2 ab1 g1 g1 g2 g1', stab: 'X.....x.....x...', pad: true, clk: { tick: 'xxxxxxxxxxxxxxxx' }, dr: { k: 'x.x.x.x.x.x.x.x.', s: '....x.......x.xx', h: 'xxxxxxxxxxxxxxxx' } },
        },
        form: ['A', 'B'], loop: 0,
      },
      // The payout: a horn-section shout over the groove.
      reveal: {
        bpm: 120,
        tracks: { stab: { ...tracks.stab, vol: 0.4 }, clav: tracks.clav, bass: tracks.bass, hook: tracks.hook, lead: tracks.lead, dr: { type: 'drums', kit: 'funk' }, orch: { type: 'drums', kit: 'orch' } },
        sections: {
          R: { bars: 2, chords: 'G7sus4 | G7#9', orch: { s: '3434545656767878|8989999999999999' }, bass: '1 - - - 1 - - - | 1 - - - 5 - - -' },
          H: { bars: 4, chords: 'Cm9 | Fm9 | Abmaj7 | G7#9', stab: 'X--.....x.X.....', clav: clavChop, bass: slap, lead: 'g5 - c6 - eb6 - d6 c6 | ab5 - - - . . . . | c6 eb6 g6 - f6 eb6 c6 - | b5 - - - d6 - - -', dr: disco2, orch: { y: 'x...............|................|................|................' } },
        },
        form: ['R', 'H'], loop: 1,
      },
      finale: { from: 'title', bpm: 120, transpose: 3, form: ['I', 'A2', 'B', 'A2'], sections: { A2: { stab: 'x...x.x.....x...' }, B: { stab: 'x.......x.......' } } },
    },
    stingers: {
      // one peg tick: a random bright note so a cascade sounds like a pinball machine
      peg: (X) => { const n = ['c6', 'eb6', 'g6', 'bb6', 'c7', 'd6', 'f6'][Math.floor(Math.random() * 7)]; X.note('glock', n, 0, 0.12, 0.45); },
      bumper: (X) => { X.note('fmkeys', 'g4', 0, 0.12, 0.6, { ratio: 2, index: 3 }); X.drum('tk', 0, 0.4); },
      slot: (X) => { X.note('fmkeys', 'b5', 0, 0.08, 1, { ratio: 3, index: 1 }); X.note('fmkeys', 'e6', 0.08, 0.3, 1, { ratio: 3, index: 1 }); X.note('chime', 'e7', 0.08, 0.4, 0.6); X.drum('sh', 0, 0.7); },
      special: (X) => { X.note('vibes', 'c6', 0, 0.2, 0.7); X.note('vibes', 'g6', 0.09, 0.4, 0.7); X.note('chime', 'c7', 0.18, 0.6, 0.5); },
      star: (X) => { for (let i = 0; i < 6; i++) X.note('celesta', ['c6', 'e6', 'g6', 'c7', 'e7', 'g7'][i], i * 0.05, 0.4, 0.5); },
      jackpot: { bpm: 150, tracks: { s: { type: 'brass', mode: 'chord', center: 68, n: 4 }, g: { type: 'glock' }, d: { type: 'drums', kit: 'orch' } }, chords: 'Abmaj7 | Bb | Cmaj9', bars: 3, parts: { s: 'x.x.x.x.........|x.x.x.x.........|X---------------', g: 'c6 eb6 g6 c7 eb7 g7 c8 - | - - - - - - - - | e7 g7 c8 - - - - -', d: { s: '3456789999999999|9999999999999999|................', y: '................|................|X...............' } } },
      bust: { bpm: 90, tracks: { m: { type: 'mute', vol: 0.8 } }, parts: { m: 'g4 - f#4 - f4 - - - | e4 - - - - - - -' }, bars: 2 },
      trick: { bpm: 140, tracks: { s: { type: 'brass', mode: 'chord', center: 66, n: 4 }, d: { type: 'drums', kit: 'funk' } }, chords: 'Eb | F | G', bars: 3, parts: { s: 'X--.............|X--.............|X---------------', d: { s: 'x...............|x...............|x.x.x.xxxxxxxxxx', y: '................|................|X...............' } } },
      release: (X) => { X.noise({ dur: 0.7, f0: 300, f1: 4000, q: 1.4, vol: 0.25, att: 0.6 }); X.note('glock', 'g6', 0.6, 0.3, 0.6); },
      roundUp: { bpm: 130, tracks: { s: { type: 'brass', mode: 'chord', center: 66, n: 4 }, d: { type: 'drums', kit: 'funk' } }, chords: 'G7#9 | Cm9', bars: 2, parts: { s: '..x...x.X-------|................', d: { k: 'x.......x.......|x...............', s: '....x...x.x.x.x.|X...............' } } },
      sudden: (X) => { X.drum('hb', 0, 1); X.drum('hb', 0.6, 1); X.tone({ at: 0, dur: 1.4, f0: 90, f1: 60, wave: 'sawtooth', vol: 0.1, lp: 800 }); },
      win: { bpm: 126, tracks: { s: { type: 'brass', mode: 'chord', center: 67, n: 4 }, v: { type: 'glock' }, d: { type: 'drums', kit: 'funk' } }, chords: 'Abmaj9 | Bb13 | Cmaj9', bars: 3, parts: { s: '..x-..X-------..|..x-..X-------..|X---------------', v: 'c6 eb6 g6 c7 - - - - | d6 f6 bb6 d7 - - - - | e7 - - - - - - -', d: { s: '..x...X.........|..x...X.........|X...............', k: 'x...x...x...x...|x...x...x...x...|x...............' } } },
    },
    fx: { round: 'roundUp', drop: 'release', trick: 'trick', sudden: 'sudden', suddenWin: 'win', win: 'win', aim: 'special', draw: 'special' },
    sfx: { win: 'win', cheer: 'trick', chime: 'special', pop: 'slot' },
  };
})();
