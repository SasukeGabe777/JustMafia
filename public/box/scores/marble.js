'use strict';
// JustMarble score: a cosy woodshop. Marimba and plucked strings over brushed drums and an
// upright bass in G, a bell "marble" motif that rolls down and up; it speeds up and gets
// tense as the timer runs out (tenseFrom: play), and rings out with a warm brass finale.
// Format and tips: public/box/scores/README.md.
(function () {
  const S = (window.BOX.scores = window.BOX.scores || {});
  const tracks = {
    mar: { type: 'marimba', mode: 'chord', center: 67, n: 4, vol: 0.42, pan: -0.15, dly: 0.12 },
    pad: { type: 'pad', mode: 'chord', center: 64, n: 4, vol: 0.2, cut: 1500 },
    bass: { type: 'bass', mode: 'bass', oct: 2, cut: 700 },
    lead: { type: 'pluck', vol: 0.5, pan: 0.12, dly: 0.18 },
    bell: { type: 'glock', vol: 0.2, pan: 0.3, oct: 1 },
    dr: { type: 'drums', kit: 'lofi', vol: 0.7 },
  };
  const A = 'Gmaj7 | Em7 | Cmaj7 | D7sus4 D7 | Gmaj7 | Bm7 E7 | Am7 | D7sus4 D7';
  const B = 'Cmaj7 | D/C | Bm7 | Em7 | Am7 | Bm7 | Cmaj7 | D7sus4 D7';
  // The marble motif: rolls down the chord, bounces, settles.
  const melA = 'd5 b4 g4 d4 - . g4 b4 | e5 - - - . . d5 e5 | g5 e5 c5 g4 - . c5 e5 | d5 - - - - - . . | d5 b4 g4 d4 - . g4 b4 | f#5 - e5 d5 b4 - g#4 - | a4 - c5 e5 - a5 - g5 | f#5 - - - a5 - c6 -';
  const melB = 'g5 - - - e5 c5 - g4 | a4 - - - - - f#4 a4 | b4 - d5 f#5 - e5 - d5 | e5 - - - - - . . | c5 - e5 - a5 - g5 - | f#5 - d5 - b4 - d5 - | e5 - - - g5 - c5 - | d5 - - - - - . .';
  const brush = { k: 'x.....x...x.....', s: '....g.......g...', h: 'x.x.x.x.x.x.x.x.' };
  S.marble = {
    name: 'marble',
    tenseFrom: ['play'],
    cues: {
      title: {
        bpm: 104, swing16: 0.56, tracks,
        sections: {
          I: { bars: 4, chords: 'Gmaj7 | Em7 | Cmaj7 | D7sus4 D7', pad: true, mar: 'x---..x-..x-.x--', bell: 'd6 b5 g5 d5 . . . . | e6 b5 g5 e5 . . . . | e6 c6 g5 e5 . . . . | f#5 . a5 . c6 . d6 .' },
          A: { bars: 8, chords: A, pad: true, mar: '..x-..x-..x-.x-.', bass: '1 - . 1 . 5 8 . | 1 - . 1 5 - 7 5', lead: melA, dr: { ...brush, y: 'x' + '.'.repeat(127) } },
          B: { bars: 8, chords: B, pad: true, mar: 'x--.x--.x--.x-x-', bass: '1 - - 5 1 - 5 . | 1 - . 1 5 - a .', lead: melB, bell: '. . . . . . . . | . . . . d6 . . .', dr: { ...brush, s: '....x.......x..g' } },
          A2: { bars: 8, chords: A, pad: true, mar: '..x-..x-..x-.x-.', bass: '1 - . 1 . 5 8 . | 1 - . 1 5 - 7 5', lead: melA, bell: melA, dr: { ...brush, sh: 'xgxgxgxgxgxgxgxg' } },
        },
        form: ['I', 'A', 'B', 'A2'], loop: 1,
      },
      lobby: { from: 'title', bpm: 96, tracks: { lead: { vol: 0.3 } }, form: ['A', 'B'], loop: 0,
        sections: { A: { lead: false, bell: '. . . . d5 . . . | . . . . b4 . . .', dr: { k: 'x.......x.......', s: '....g.......g...', h: '..x...x...x...x.' } }, B: { lead: melB, dr: { k: 'x.......x.......', s: '....g.......x...', sh: 'xgxgxgxgxgxgxgxg' } } } },
      intro: { from: 'title', bpm: 108, form: ['I', 'A', 'B', 'A2'] },
      // Lining up the phones: gentle and curious.
      think: {
        bpm: 88, swing16: 0.58,
        tracks: { mar: { type: 'marimba', mode: 'chord', center: 69, n: 4, vol: 0.34, pan: 0.2, dly: 0.2 }, keys: { type: 'epiano', mode: 'chord', center: 62, n: 4, vol: 0.32, trem: 0.3, pan: -0.2 }, bass: { type: 'bass', mode: 'bass', cut: 600 }, pad: { type: 'pad', mode: 'chord', center: 64, vol: 0.22, cut: 1300 }, dr: { type: 'drums', kit: 'lofi', vol: 0.5 } },
        sections: {
          A: { bars: 8, chords: 'Em9 | A13 | Dmaj9 | Bm9 | Em9 | A13 | Fmaj7 | A7sus4', keys: 'x---------x-----', mar: '1.2.3.4.3.2.4.3.', bass: '1 - - - - - 5 . | 1 - - . 5 - - .', pad: true, dr: { k: 'x.......x.x.....', s: '....g.......g...', h: '..x...x...x...x.' } },
          B: { bars: 8, chords: 'Gmaj7 | F#m7 | Em9 | Dmaj9 | Cmaj7 | Bm7 | Bbmaj7 | A7sus4', keys: 'x-----x---x-----', mar: '4.3.2.1.2.3.4.2.', bass: '1 - - . 1 - 5 . | 1 - - - 5 - - .', pad: true, dr: { k: 'x.......x.x.....', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' } },
        },
        form: ['A', 'B'], loop: 0,
      },
      // Rolling: a bouncy marimba groove with a plucked tune.
      play: { from: 'think', bpm: 112, tracks: { lead: { type: 'pluck', vol: 0.42, dly: 0.2, pan: 0.1 }, bell: { type: 'glock', vol: 0.16, pan: -0.3, oct: 1 } },
        sections: {
          A: { lead: 'e5 - g5 b5 - a5 - f#5 | e5 - - - . . c#5 e5 | f#5 - a5 c#6 - b5 - a5 | f#5 - - - . . . . | e5 - g5 b5 - a5 - f#5 | e5 - - - . . g5 a5 | a5 - - - g5 - f5 - | e5 - - - . . . .', bell: 'b5 . . . . . . . | . . . . e6 . . .', dr: { k: 'x.....x...x.....', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' } },
          B: { dr: { k: 'x.....x...x..x..', s: '....x.......x...', h: 'xxx.xxx.xxx.xxx.' } },
        } },
      tense: {
        bpm: 132,
        tracks: { sb: { type: 'synthbass', mode: 'bass', oct: 2, vol: 0.45 }, mar: { type: 'marimba', mode: 'chord', center: 64, n: 3, vol: 0.4 }, str: { type: 'strings', mode: 'chord', center: 62, n: 3, vol: 0.32, att: 0.02, rel: 0.1 }, tk: { type: 'drums' }, dr: { type: 'drums', kit: 'std' }, lead: { type: 'pluck', vol: 0.4 } },
        sections: {
          A: { bars: 8, chords: 'Em | Em | C | D | Em | Em | C | B7', sb: '1 1 8 1 1 8 1 5', mar: 'x.xx.xx.x.xx.xx.', str: 'x.......x.......', tk: { tick: 'x.x.x.x.x.x.x.x.', tock: '' }, dr: { k: 'x...x...x...x...', s: '........x.......', t1: '..............xx' } },
          B: { bars: 8, chords: 'Am | B7 | Em | C | Am | B7 | C | B7', sb: '1 1 8 1 1 8 1 5', mar: 'x.xx.xx.x.xx.xx.', str: 'x.......x.......', lead: 'e5 - - - f#5 - - - | g5 - - - f#5 - - - | e5 - - - b4 - - - | c5 - - - d5 - - - | e5 - - - f#5 - - - | g5 - - - a5 - - - | b5 - - - a5 - g5 - | f#5 - - - - - - -', tk: { tick: 'x.x.x.x.x.x.x.x.' }, dr: { k: 'x...x...x...x...', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' } },
        },
        form: ['A', 'B'], loop: 0,
      },
      reveal: {
        bpm: 104,
        tracks: { br: { type: 'brass', mode: 'chord', center: 66, n: 4, vol: 0.42 }, mar: { type: 'marimba', mode: 'chord', center: 71, n: 4, vol: 0.35 }, bass: { type: 'bass', mode: 'bass' }, tp: { type: 'timp', vol: 0.45 }, dr: { type: 'drums', kit: 'orch' } },
        sections: {
          R: { bars: 2, chords: 'D7sus4 | D7', mar: 'x.x.x.x.x.x.x.x.', tp: 'd3 d3 d3 d3 d3 d3 d3 d3 | d3 d3 d3 d3 a2 a2 a2 a2', dr: { s: '2323434545656767|7878989899999999' } },
          H: { bars: 4, chords: 'G | C/G | G | D7', br: 'X-----x-x---x---', mar: '1.2.3.4.3.2.1.2.', bass: '1 - - - 5 - 1 .', dr: { k: 'x.......x.......', y: 'x...............', s: '....x.......x...' } },
        },
        form: ['R', 'H'], loop: 1,
      },
      finale: { from: 'title', bpm: 110, transpose: 2, tracks: { br: { type: 'brass', mode: 'chord', center: 67, n: 3, vol: 0.34 } },
        sections: { A: { br: '....x.x.....x...' }, B: { br: 'x.......x.......' }, A2: { br: '....x.x.....x...' } } },
    },
    stingers: {
      win: { bpm: 120, tracks: { b: { type: 'brass', vol: 0.55 }, g: { type: 'glock', vol: 0.45 }, d: { type: 'drums', kit: 'orch' } }, bars: 2, parts: { b: 'g4+b4+d5 . g4+b4+d5 a4+c5+e5 - - g4+b4+d5 - | g4+b4+d5+g5 - - - - - - -', g: 'd6 b5 g5 d5 b5 d6 g6 - | g6 - - - - - - -', d: { s: 'x.x.x.....x.....', y: '................|x...............' } } },
      // A marble dropping into the cup.
      sink: { bpm: 150, tracks: { g: { type: 'glock', vol: 0.5 }, m: { type: 'marimba', vol: 0.5 } }, bars: 1, parts: { g: 'g6 d6 b5 g5 d5 - - -', m: '. . . . g3 - - -' } },
      pass: { bpm: 160, tracks: { m: { type: 'marimba', vol: 0.5 } }, bars: 1, parts: { m: 'g5 b5 d6 - . . . .' } },
      gem: { bpm: 150, tracks: { g: { type: 'glock', vol: 0.5 } }, bars: 1, parts: { g: 'e6 g6 b6 e7 - - - -' } },
      hole: { bpm: 110, tracks: { b: { type: 'mute' }, m: { type: 'marimba', vol: 0.4 } }, bars: 1, parts: { m: 'g4 e4 c4 g3 - - - -', b: '. . . . c2 - - -' } },
      good: { bpm: 140, tracks: { g: { type: 'fmkeys', ratio: 3, index: 1.2 } }, bars: 1, parts: { g: 'g5 b5 d6 g6 - - - -' } },
      bad: { bpm: 100, tracks: { b: { type: 'mute' } }, bars: 1, parts: { b: 'e4 - eb4 - d4 - - -' } },
      round: { bpm: 120, tracks: { b: { type: 'pluck', dly: 0.3 } }, bars: 1, parts: { b: 'g4 d5 g5 . . . . .' } },
    },
    // pass / hole / win play recorded sounds instead (onFx in public/box/games/marble.js)
    fx: { gem: 'gem', lineup: 'round' },
    sfx: {},
  };
})();
