'use strict';
// Price Panic: game-show funk with a big-band brass section. Key of Bb, 112 bpm.
// Clavinet + slap synth bass + funk kit + cowbell; a brass riff hook in unison octaves.
(function () {
  const S = (window.BOX.scores = window.BOX.scores || {});
  const tracks = {
    clav: { type: 'clav', mode: 'chord', center: 66, n: 3, vol: 0.42, pan: -0.25 },
    keys: { type: 'epiano', mode: 'chord', center: 62, n: 4, vol: 0.32, pan: 0.2, trem: 0.2 },
    hi: { type: 'brass', vol: 0.42, pan: 0.18, bright: 1.2 },
    lo: { type: 'brass', vol: 0.34, pan: -0.12, oct: -1 },
    sax: { type: 'sax', vol: 0.36, pan: 0.25, oct: -1 },
    bass: { type: 'synthbass', mode: 'bass', oct: 2, vol: 0.55 },
    stab: { type: 'brass', mode: 'chord', center: 68, n: 4, vol: 0.34 },
    dr: { type: 'drums', kit: 'funk' },
  };
  const A = 'Bb7 | Bb7 | Eb9 | Eb9 | Bb7 | G7#9 | Cm7 F7 | Bb7 F7';
  const B = 'Ebmaj7 | D7#9 | Gm7 | C9 | Cm7 | F13 | Bb7 | F7sus4 F7';
  const riff = 'f5 . f5 ab5 . bb5 - . | . ab5 f5 . eb5 f5 - . | g5 . g5 bb5 . db6 - . | . bb5 g5 . f5 eb5 - . | f5 . f5 ab5 . bb5 - d6 | - - b5 . bb5 g5 - . | c6 - bb5 g5 eb5 - f5 a5 | bb5 - - - . . . .';
  const bridge = 'g5 - - - bb5 - g5 . | f#5 - - - . . . . | g5 - - - f5 - d5 . | e5 - - - . . . . | eb5 - - - g5 - eb5 . | d5 - - - c5 - a4 . | bb4 - d5 - f5 - ab5 - | a5 - - - c6 - - -';
  const funk = { k: 'x..x..x...x..x..', s: '....X..g.g..X..g', h: 'x.x.x.x.x.x.x.xo' };
  const bassA = '1 . 1 x 7 . 5 8 | 1 . x 1 . 7 8 5';
  S.price = {
    name: 'Price Panic',
    cues: {
      title: {
        bpm: 112, swing16: 0.55, tracks,
        sections: {
          I: { bars: 4, chords: 'F7sus4 | F7sus4 | F7 | F7', stab: 'X-....X-..X-....|X-....X-..X-.X.X|X-....X-..X-....|X---------------', bass: '1 . . . . . 1 . | 1 . . . . . 8 .', dr: { k: 'x.....x...x.....', s: '....X.......X...|....X.......X...|....X.......X...|X.X.X.X.XXXXXXXX', h: 'x.x.x.x.x.x.x.x.', y: 'x...............' } },
          A: { bars: 8, chords: A, clav: 'x.xgx.x.xgx.x.xg', bass: bassA, hi: riff, lo: riff, dr: { ...funk, y: 'x' + '.'.repeat(127) } },
          B: { bars: 8, chords: B, keys: 'x--.x--.x--.x-x-', clav: '..x...x...x...x.', bass: '1 - . 1 5 - 8 . | 1 - . 5 8 . a .', sax: bridge, stab: '................|..............x.', dr: { ...funk, cb: '..x...x...x...x.' } },
          A2: { bars: 8, chords: A, clav: 'x.xgx.x.xgx.x.xg', keys: '....x.......x...', bass: bassA, hi: riff, lo: riff, sax: riff, dr: { ...funk, cb: 'x.x.x.x.x.x.x.x.', y: 'x' + '.'.repeat(127) } },
        },
        form: ['I', 'A', 'B', 'A2'], loop: 1,
      },
      lobby: { from: 'title', bpm: 104, form: ['A', 'B'], loop: 0,
        sections: { A: { hi: false, lo: false, keys: 'x--.x--.x--.x-x-', sax: '. . . . f5 - ab5 - | bb5 - - - . . . . | . . . . g5 - bb5 - | db6 - - - . . . . | . . . . f5 - ab5 - | b5 - - - bb5 - - - | g5 - - - f5 - a5 - | bb5 - - - . . . .', dr: { k: 'x.....x...x.....', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' } } } },
      intro: { from: 'title', bpm: 116 },
      think: {
        bpm: 96, swing16: 0.57,
        tracks: { keys: { type: 'epiano', mode: 'chord', center: 64, n: 4, vol: 0.45, trem: 0.3, pan: -0.15 }, vib: { type: 'vibes', vol: 0.4, pan: 0.2, dly: 0.15 }, bass: { type: 'bass', mode: 'bass', cut: 600 }, dr: { type: 'drums', kit: 'funk', vol: 0.55 } },
        sections: {
          A: { bars: 8, chords: 'Bbmaj9 | Gm9 | Ebmaj9 | F13 | Dm7 | Gm9 | Cm9 | F13', keys: 'x-----x---x-----', bass: '1 - - . 5 - 1 . | 1 - - - . . 5 .', vib: '. . d6 - c6 - bb5 - | a5 - - - . . . . | . . g5 - f5 - d5 - | eb5 - - - . . . . | . . f5 - e5 - d5 - | a5 - - - g5 - - - | . . eb5 - d5 - c5 - | d5 - - - c5 - - -', dr: { k: 'x.......x.x.....', s: '....g.......g...', sh: 'xgxgxgxgxgxgxgxg' } },
          B: { bars: 8, chords: 'Ebmaj7 | Edim7 | Bb/F | G7#9 | Cm9 | F13 | Bbmaj9 | F7sus4', keys: 'x-----x---x-----', bass: '1 - - . 5 - 1 . | 1 - - - . . 5 .', vib: 'g5 - - - bb5 - - - | g5 - - - . . . . | f5 - d5 - bb4 - - - | b4 - - - . . . . | eb5 - - - g5 - - - | a5 - - - c6 - - - | d6 - - - - - - - | . . . . . . . .', dr: { k: 'x.......x.x.....', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' } },
        },
        form: ['A', 'B'], loop: 0,
      },
      play: { from: 'title', bpm: 108, form: ['A', 'B'], loop: 0, sections: { A: { hi: false, lo: false, sax: false, keys: 'x--.x--.x--.x-x-' } } },
      tense: {
        bpm: 126,
        tracks: { sb: { type: 'synthbass', mode: 'bass', vol: 0.5 }, stab: { type: 'brass', mode: 'chord', center: 64, n: 4, vol: 0.4 }, clav: { type: 'clav', mode: 'chord', center: 62, n: 3, vol: 0.35 }, clk: { type: 'drums', vol: 0.7 }, dr: { type: 'drums', kit: 'funk' }, hi: { type: 'brass', vol: 0.35 } },
        sections: {
          A: { bars: 8, chords: 'Gm | Gm | Eb7 | D7#9 | Gm | Gm | Ab7 | D7#9', sb: '1 1 8 1 7 1 8 5', clav: 'x.x.x.x.x.x.x.x.', stab: 'X.....X.....X...', clk: { tick: 'x...x...x...x...', tock: '..x...x...x...x.' }, dr: { k: 'x...x...x...x...', s: '........X.......', h: '..x...x...x...x.' } },
          B: { bars: 8, chords: 'Cm | D7#9 | Gm | Eb7 | Cm | D7#9 | Gm | D7#9', sb: '1 1 8 1 7 1 8 5', clav: 'x.x.x.x.x.x.x.x.', hi: 'g5 - - - a5 - - - | bb5 - - - a5 - - - | g5 - - - d5 - - - | eb5 - - - f5 - - - | g5 - - - a5 - - - | bb5 - - - c6 - - - | d6 - - - c6 - bb5 - | a5 - - - f#5 - - -', clk: { tick: 'x.x.x.x.x.x.x.x.' }, dr: { k: 'x...x...x...x...', s: '....X.......X...', h: 'xxxxxxxxxxxxxxxx', t1: '................|................|................|............xxxx' } },
        },
        form: ['A', 'B'], loop: 0,
      },
      reveal: {
        bpm: 112,
        tracks: { stab: { type: 'brass', mode: 'chord', center: 67, n: 4, vol: 0.5 }, clav: tracks.clav, bass: tracks.bass, tp: { type: 'timp', vol: 0.45 }, dr: { type: 'drums', kit: 'funk' }, orch: { type: 'drums', kit: 'orch' } },
        sections: {
          R: { bars: 2, chords: 'F7sus4 | F7', tp: 'f2 f2 f2 f2 f2 f2 f2 f2 | f2 f2 f2 f2 c3 c3 c3 c3', orch: { s: '3434545656767878|8989999999999999' } },
          H: { bars: 4, chords: 'Bb7 | Eb9 | Bb7 | F7#9', stab: 'X--.....X-.X....', clav: 'x.xgx.x.xgx.x.xg', bass: bassA, dr: { ...funk, cb: 'x.x.x.x.x.x.x.x.' }, orch: { y: 'x...............|................|................|................' } },
        },
        form: ['R', 'H'], loop: 1,
      },
      finale: { from: 'title', bpm: 116, transpose: 2, form: ['I', 'A2', 'B', 'A2'] },
    },
    stingers: {
      win: { bpm: 132, tracks: { b: { type: 'brass' }, l: { type: 'brass', oct: -1 }, d: { type: 'drums', kit: 'funk' } }, bars: 2, parts: { b: 'f5 . f5 ab5 . bb5 - d6 | f6+d6+bb5 - - - - - - -', l: 'f5 . f5 ab5 . bb5 - d6 | f6 - - - - - - -', d: { s: 'X.X..X.X..X.X...|X...............', y: '................|x...............' } } },
      jackpot: { bpm: 140, gain: 1.6, tracks: { b: { type: 'brass', mode: 'chord', center: 70, n: 4 }, g: { type: 'glock', oct: 1 }, d: { type: 'drums', kit: 'orch' } }, chords: 'Bb | Eb/Bb | Bb', bars: 3, parts: { b: 'X.X.X...X-------|X.X.X...X-------|X---------------', g: 'bb5 d6 f6 bb6 - - - - | g5 bb5 eb6 g6 - - - - | bb6 - - - - - - -', d: { s: 'x.x.x...........|x.x.x...........|', y: 'x...............|x...............|x...............' } } },
      reveal: { bpm: 120, gain: 1.4, tracks: { b: { type: 'brass', mode: 'chord', center: 67, n: 4 }, d: { type: 'drums', kit: 'orch' } }, chords: 'Bb7', parts: { b: 'X-------........', d: { y: 'x' } } },
      bust: { bpm: 90, tracks: { m: { type: 'mute' } }, parts: { m: 'd5 - c#5 - c5 - b4 - - - - - . . . .' }, bars: 1 },
      item: { bpm: 120, tracks: { b: { type: 'brass' } }, parts: { b: 'f4 bb4 d5 f5 - - . .' } },
      lock: (X) => { X.drum('rim', 0, 0.9); X.note('fmkeys', 'f6', 0.04, 0.12, 0.6, { ratio: 3, index: 1 }); },
      sting: { bpm: 120, gain: 1.6, tracks: { b: { type: 'brass', mode: 'chord', center: 64, n: 4 } }, chords: 'D7#9', parts: { b: 'X---............' } },
      round: { bpm: 112, tracks: { c: { type: 'clav', mode: 'chord', center: 66, n: 3 }, b: { type: 'brass' } }, chords: 'Bb7', parts: { c: 'x.xgx.x.........', b: '. . . . f5 bb5 - -' } },
    },
    fx: { drop: 'reveal', jackpot: 'jackpot', bull: 'cash', bust: 'bust', item: 'item', lock: 'lock', hilo: 'sting', versus: 'sting', spree: 'riser', over: 'win' },
    sfx: { win: 'win', drum: 'roll', reveal: 'reveal', start: 'round', click: 'lock' },
  };
})();
