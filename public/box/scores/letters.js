'use strict';
// Letter Rush soundtrack: a bouncy, slightly nerdy pop-quiz groove in G major. Marimba and
// pizzicato for the scribbling, a clav riff, a whistle hook, woodblock "pencil taps" and a
// ticking clock under the writing race. Format: public/box/scores/README.md.
(function () {
  const S = (window.BOX.scores = window.BOX.scores || {});
  const tracks = {
    mar: { type: 'marimba', mode: 'chord', center: 67, n: 3, vol: 0.42, pan: -0.22 },
    pz: { type: 'pizz', mode: 'chord', center: 60, n: 3, vol: 0.32, pan: 0.25 },
    pad: { type: 'pad', mode: 'chord', center: 64, n: 4, vol: 0.2, cut: 1600 },
    bass: { type: 'upright', mode: 'bass', oct: 2, vol: 0.8 },
    lead: { type: 'whistle', vol: 0.34, pan: 0.1, dly: 0.14, vib: 0.3 },
    bell: { type: 'glock', vol: 0.16, pan: 0.32, oct: 1 },
    dr: { type: 'drums', kit: 'funk' },
  };
  const A = 'G | Em7 | Cmaj7 | D7sus4 D7 | G | B7 | Em7 A7 | Am7 D7';
  const B = 'Cmaj7 | Bm7 | Am7 | G | Cmaj7 | Bm7 E7 | Am7 | D7sus4 D7';
  const hookA = 'd5 . g5 . b5 a5 g5 . | e5 - - - . . d5 e5 | g5 . e5 . c5 - b4 . | a4 - - - . . d5 . | d5 . g5 . b5 a5 g5 . | f#5 - - - . d#5 f#5 a5 | g5 - e5 - c#5 - e5 g5 | f#5 - - - . . . .';
  const hookB = 'e5 - g5 - c6 - b5 - | a5 - f#5 - d5 - . . | c5 - e5 - a5 - g5 - | b4 - d5 - g5 - . . | e5 - g5 - c6 - b5 a5 | g#5 - - - b5 - . . | a5 - - - g5 f#5 e5 d5 | c5 - - - a4 - - -';
  const tap = { k: 'x.....x...x.....', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.', wb: '..x...x...x..x..' };
  const tapFill = { k: 'x.....x...x.....|x.....x...x.x.x.', s: '....x.......x...|....x.....g.x.XX', h: 'x.x.x.x.x.x.x.x.|x.x.x.x.x.......', wb: '..x...x...x..x..|..x...x.xxxx....' };
  S.letters = {
    name: 'Letter Rush',
    cues: {
      title: {
        bpm: 124, swing16: 0.54, tracks,
        sections: {
          I: { bars: 4, chords: 'G | Em7 | Cmaj7 | D7sus4 D7', pad: true, mar: 'x..x..x...x.x...', bell: 'g5 . d5 . b4 . d5 . | e5 . b4 . g4 . b4 . | e5 . c5 . g4 . c5 . | f#5 . d5 . a4 . c5 .', dr: { wb: 'x...x...x...x...', y: 'x...............|................|................|............x.x.' } },
          A: { bars: 8, chords: A, pad: true, mar: '..x...x...x..x..', pz: 'x...x...x...x...', bass: '1 - 5 - 1 - 5 a | 1 - 5 - 8 - 5 a', lead: hookA, dr: { ...tap, y: 'x' + '.'.repeat(127) } },
          B: { bars: 8, chords: B, pad: true, mar: 'x.x.x.x.x.x.x.x.', pz: '..x...x...x...x.', bass: '1 - 5 - 1 5 8 a | 1 - 3 - 5 - a .', lead: hookB, dr: tapFill },
          A2: { bars: 8, chords: A, pad: true, mar: '..x...x...x..x..', pz: 'x...x...x...x...', bass: '1 - 5 - 1 - 5 a | 1 - 5 - 8 - 5 a', lead: hookA, bell: hookA, dr: { ...tap, sh: 'xgxgxgxgxgxgxgxg' } },
        },
        form: ['I', 'A', 'B', 'A2'], loop: 1,
      },
      lobby: { from: 'title', bpm: 112, tracks: { lead: { vol: 0.24 } }, form: ['A', 'B'], loop: 0,
        sections: { A: { lead: false, bell: '. . . . g5 . . . | . . . . e5 . . .', dr: { k: 'x.......x.......', s: '....g.......x...', wb: '..x...x...x...x.' } }, B: { lead: hookB, dr: { k: 'x.......x.......', s: '....x.......x...', sh: 'xgxgxgxgxgxgxgxg' } } } },
      intro: { from: 'title', bpm: 126, form: ['I', 'A', 'B', 'A2'] },
      // The writing race: a ticking clock under marimba arpeggios.
      think: {
        bpm: 104, swing16: 0.55,
        tracks: { arp: { type: 'marimba', mode: 'chord', center: 72, n: 4, vol: 0.34, pan: 0.2, dly: 0.18 }, pz: { type: 'pizz', mode: 'chord', center: 60, n: 3, vol: 0.28, pan: -0.25 }, bass: { type: 'upright', mode: 'bass', oct: 2 }, pad: { type: 'pad', mode: 'chord', center: 64, vol: 0.18, cut: 1300 }, tk: { type: 'drums' }, dr: { type: 'drums', kit: 'lofi', vol: 0.6 } },
        sections: {
          A: { bars: 8, chords: 'G | Cmaj7 | Am7 | D7 | G | Cmaj7 | Am7 | D7sus4 D7', arp: '1.2.3.4.3.2.4.3.', pz: 'x.......x.......', bass: '1 - - 5 1 - - 5 | 1 - - 5 8 - 5 .', pad: true, tk: { tick: 'x...x...x...x...', tock: '..x...x...x...x.' }, dr: { k: 'x.......x.x.....', s: '....g.......g...' } },
          B: { bars: 8, chords: 'Em7 | Cmaj7 | G | D | Em7 | Cmaj7 | Am7 | D7', arp: '4.3.2.1.2.3.4.2.', pz: 'x...x...x...x...', bass: '1 - - 5 1 - 5 . | 1 - - - 5 - a .', pad: true, tk: { tick: 'x...x...x...x...', tock: '..x...x...x...x.' }, dr: { k: 'x.......x.x.....', s: '....x.......x...', h: '..x...x...x...x.' } },
        },
        form: ['A', 'B'], loop: 0,
      },
      // The review: the hook over a lighter groove.
      play: { from: 'title', bpm: 116, tracks: { lead: { type: 'clav', vol: 0.3 } }, form: ['A', 'B'], loop: 0,
        sections: { A: { lead: 'g4 . b4 d5 . b4 g4 . | e4 . g4 b4 . g4 e4 . | c5 . e5 g5 . e5 c5 . | d5 . c5 a4 . f#4 . . | g4 . b4 d5 . b4 g4 . | b4 . d#5 f#5 . d#5 b4 . | e5 . c#5 a4 . g4 . . | a4 . c5 d5 . . . .', bell: false } } },
      tense: {
        bpm: 140,
        tracks: { sb: { type: 'synthbass', mode: 'bass', oct: 2, vol: 0.5 }, mar: { type: 'marimba', mode: 'chord', center: 70, n: 3, vol: 0.4 }, pz: { type: 'pizz', mode: 'chord', center: 60, n: 3, vol: 0.35 }, tk: { type: 'drums' }, dr: { type: 'drums', kit: 'std' }, lead: { type: 'whistle', vol: 0.3 } },
        sections: {
          A: { bars: 8, chords: 'Em | Em | C | D | Em | Em | C | B7', sb: '1 1 8 1 1 8 1 5', mar: 'x.xx.xx.x.xx.xx.', pz: 'x..x..x.x..x..x.', tk: { tick: 'x.x.x.x.x.x.x.x.', tock: '.x.x.x.x.x.x.x.x' }, dr: { k: 'x...x...x...x...', s: '........x.......', t1: '..............xx' } },
          B: { bars: 8, chords: 'Am | B7 | Em | C | Am | B7 | C | B7', sb: '1 1 8 1 1 8 1 5', mar: 'x.xx.xx.x.xx.xx.', lead: 'e5 - - - f#5 - - - | g5 - - - f#5 - - - | e5 - - - b4 - - - | c5 - - - d5 - - - | e5 - - - f#5 - - - | g5 - - - a5 - - - | b5 - - - a5 - g5 - | f#5 - - - - - - -', tk: { tick: 'x.x.x.x.x.x.x.x.', tock: '.x.x.x.x.x.x.x.x' }, dr: { k: 'x...x...x...x...', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' } },
        },
        form: ['A', 'B'], loop: 0,
      },
      reveal: {
        bpm: 118,
        tracks: { br: { type: 'brass', mode: 'chord', center: 66, n: 4, vol: 0.42 }, mar: { type: 'marimba', mode: 'chord', center: 72, n: 3, vol: 0.38 }, bass: { type: 'upright', mode: 'bass' }, tp: { type: 'timp', vol: 0.45 }, dr: { type: 'drums', kit: 'funk' } },
        sections: {
          R: { bars: 2, chords: 'D7sus4 | D7', mar: 'x.x.x.x.x.x.x.x.', tp: 'd3 d3 d3 d3 d3 d3 d3 d3 | d3 d3 d3 d3 a2 a2 a2 a2', dr: { s: '2323434545656767|7878989899999999' } },
          H: { bars: 4, chords: 'G | C/G | G | D7', br: 'X-----x-x---x---', mar: '..x...x...x..x..', bass: '1 - 5 - 1 - 5 a', dr: { k: 'x.....x...x.....', y: 'x...............', s: '....x.......x...', wb: '..x...x...x..x..' } },
        },
        form: ['R', 'H'], loop: 1,
      },
      finale: { from: 'title', bpm: 128, transpose: 2, tracks: { br: { type: 'brass', mode: 'chord', center: 67, n: 3, vol: 0.34 } },
        sections: { A: { br: '....x.x.....x...' }, B: { br: 'x.......x.......' }, A2: { br: '....x.x.....x...' } } },
    },
    stingers: {
      win: { bpm: 128, tracks: { b: { type: 'brass', vol: 0.55 }, g: { type: 'marimba', vol: 0.45 }, d: { type: 'drums', kit: 'orch' } }, bars: 2, parts: { b: 'g4+b4+d5 . g4+b4+d5 g4+c5+e5 - - g4+b4+d5 - | g4+b4+d5+g5 - - - - - - -', g: 'd5 . d5 e5 - - d5 - | g5 - - - - - - -', d: { s: 'x.x.x.....x.....', y: '................|x...............' } } },
      roll: { bpm: 150, tracks: { m: { type: 'marimba', vol: 0.5 }, d: { type: 'drums', kit: 'funk' } }, bars: 2, parts: { m: 'g4 b4 d5 g5 b4 d5 g5 b5 | d6 - - - . . . .', d: { wb: 'xxxxxxxxxxxxxxxx|x...............' } } },
      good: { bpm: 140, tracks: { g: { type: 'marimba' } }, bars: 1, parts: { g: 'g5 b5 d6 g6 - - - -' } },
      bad: { bpm: 100, tracks: { b: { type: 'mute' } }, bars: 1, parts: { b: 'e4 - eb4 - d4 - - -' } },
      gavel: { bpm: 110, tracks: { t: { type: 'timp', vol: 0.6 }, b: { type: 'brass', vol: 0.45 } }, bars: 1, parts: { t: 'g2 . g2 . . . . .', b: '. . . . g3+d4+g4 - - -' } },
      round: { bpm: 120, tracks: { b: { type: 'pluck', dly: 0.3 } }, bars: 1, parts: { b: 'g5 d6 g6 . . . . .' } },
    },
    fx: { scores: 'round', win: 'win' }, // verdict: a recorded gavel (onFx in games/letters.js), 'gavel' is its fallback
    sfx: {},
  };
})();
