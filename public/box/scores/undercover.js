'use strict';
// JustUndercover: late-night spy jazz in E minor. A twangy guitar riff over a walking upright
// bass and brushed jazz drums, a muted trumpet answering, vibes for the clues. Clue time is a
// soft, ticking vibes groove; the vote is tense strings and a heartbeat kick; the verdict is a
// brass stab; the finale is the theme, a tone up.
// Cues: title lobby intro think play tense reveal finale (public/box/scores/README.md).
(function () {
  const S = (window.BOX.scores = window.BOX.scores || {});
  const tracks = {
    gtr: { type: 'guitar', vol: 0.42, pan: -0.18, dly: 0.18, rev: 0.25 },
    keys: { type: 'vibes', mode: 'chord', center: 64, n: 4, vol: 0.32, pan: 0.2, trem: 0.3 },
    bass: { type: 'upright', mode: 'bass', oct: 2, vol: 0.62 },
    lead: { type: 'mute', vol: 0.4, pan: 0.12, vib: 5, dly: 0.14 },
    pad: { type: 'strings', mode: 'chord', center: 60, n: 4, vol: 0.18, cut: 1600 },
    dr: { type: 'drums', kit: 'jazz', vol: 0.7 },
  };
  // The riff: E, F#, G, F#, the chromatic spy line.
  const riff = 'e3 . e3 f#3 . g3 . f#3 | e3 . e3 f#3 . g3 . f#3 | e3 . e3 f#3 . g3 . a3 | g3 . f#3 . e3 . d#3 .';
  const A = 'Em | Em | C | B7 | Em | Em | Am6 | B7';
  const B = 'Am7 | D7 | Gmaj7 | Cmaj7 | F#m7b5 | B7 | Em | B7';
  const melA = 'b4 - - - . e5 d5 b4 | g4 - - - . . . . | c5 - - b4 a4 - g4 - | f#4 - - - . . b4 - | e5 - - - . g5 f#5 e5 | d#5 - - - . . . . | c5 - e5 - a5 - g5 - | f#5 - - - - - . .';
  const melB = 'a4 - c5 - e5 - g5 - | f#5 - - - d5 - . . | g5 - f#5 - d5 - b4 - | e5 - - - . . . . | a4 - c5 - e5 - f#5 - | d#5 - - - b4 - . . | e5 - g5 - b5 - g5 - | f#5 - - - - - . .';
  const swing = { k: 'x.......x.......', s: '....g.......g...', h: 'x..xx..xx..xx..x', r: 'x...x...x...x...' };
  const fill = { k: 'x.......x.......|x.......x...x.x.', s: '....g.......g...|....x.....x.x.XX', h: 'x..xx..xx..xx..x|x..xx..xx.......', r: 'x...x...x...x...' };
  S.undercover = {
    name: 'undercover',
    cues: {
      title: {
        bpm: 126, swing16: 0.58, tracks,
        sections: {
          I: { bars: 4, chords: 'Em | Em | Em | B7', gtr: riff, bass: '1 . 1 . 1 . 5 . | 1 . 1 . 1 . 7 .', dr: { r: 'x...x...x...x...', k: 'x...............' } },
          A: { bars: 8, chords: A, gtr: riff, keys: '..x...x...x...x.', bass: 'walk', lead: melA, dr: swing },
          B: { bars: 8, chords: B, keys: 'x--.x--.x--.x-x-', pad: true, bass: 'walk', lead: melB, dr: fill },
          A2: { bars: 8, chords: A, gtr: riff, keys: '..x...x...x...x.', pad: true, bass: 'walk', lead: melA, dr: { ...swing, cg: '..x...x...x..x..' } },
        },
        form: ['I', 'A', 'B', 'A2'], loop: 1,
      },
      lobby: { from: 'title', bpm: 112, tracks: { lead: { vol: 0.28 } }, form: ['A', 'B'], loop: 0,
        sections: { A: { lead: false, dr: { k: 'x.......x.......', r: 'x...x...x...x...', h: '..x...x...x...x.' } }, B: { lead: melB, dr: { k: 'x.......x.......', s: '....g.......g...', r: 'x..xx..xx..xx..x' } } } },
      intro: { from: 'title', bpm: 120, form: ['I', 'A', 'B', 'A2'] },
      think: {
        bpm: 92, swing16: 0.56,
        tracks: { keys: { type: 'vibes', mode: 'chord', center: 64, n: 4, vol: 0.42, trem: 0.35, pan: -0.15 }, arp: { type: 'celesta', mode: 'chord', center: 76, n: 4, vol: 0.22, pan: 0.25, dly: 0.25 }, bass: { type: 'upright', mode: 'bass', vol: 0.55 }, pad: { type: 'pad', mode: 'chord', center: 60, vol: 0.2, cut: 1200 }, dr: { type: 'drums', kit: 'jazz', vol: 0.55 } },
        sections: {
          A: { bars: 8, chords: 'Em9 | Cmaj7 | Am9 | B7 | Em9 | Cmaj7 | Am9 | B7', keys: 'x-------..x-----', arp: '1.2.3.4.3.2.4.3.', bass: '1 - - . 5 - - . | 1 - - - 5 - 7 .', pad: true, dr: { tick: 'x.x.x.x.x.x.x.x.', r: 'x...x...x...x...', k: 'x.......x.......' } },
          B: { bars: 8, chords: 'Am7 | D7 | Gmaj7 | Cmaj7 | Am7 | B7 | Em9 | B7', keys: 'x-----x---x-----', arp: '4.3.2.1.2.3.4.2.', bass: '1 - - . 1 - 5 . | 1 - - - 5 - - .', pad: true, dr: { tick: 'x.x.x.x.x.x.x.x.', r: 'x..xx..xx..xx..x', k: 'x.......x.......' } },
        },
        form: ['A', 'B'], loop: 0,
      },
      play: { from: 'title', bpm: 132, form: ['A', 'B', 'A2'], loop: 0 },
      tense: {
        bpm: 128,
        tracks: { sb: { type: 'synthbass', mode: 'bass', oct: 2, vol: 0.5 }, str: { type: 'strings', mode: 'chord', center: 62, n: 3, vol: 0.4, att: 0.02, rel: 0.1 }, pad: { type: 'pad', mode: 'chord', center: 60, vol: 0.22, cut: 1100 }, tk: { type: 'drums' }, dr: { type: 'drums', kit: 'std' }, lead: { type: 'mute', vol: 0.32 } },
        sections: {
          A: { bars: 8, chords: 'Em | Em | C | B7 | Em | Em | C | B7', sb: '1 1 8 1 1 8 1 b7', str: 'x..x..x.x..x..x.', pad: true, tk: { tick: 'x.x.x.x.x.x.x.x.', tock: '' }, dr: { k: 'x...x...x...x...', s: '........x.......', t1: '..............xx' } },
          B: { bars: 8, chords: 'Am | B7 | Em | C | Am | B7 | C | B7', sb: '1 1 8 1 1 8 1 5', str: 'x..x..x.x..x..x.', pad: true, lead: 'e5 - - - f#5 - - - | g5 - - - f#5 - - - | e5 - - - b4 - - - | c5 - - - d#5 - - - | e5 - - - f#5 - - - | g5 - - - a5 - - - | b5 - - - a5 - g5 - | f#5 - - - - - - -', tk: { tick: 'x.x.x.x.x.x.x.x.' }, dr: { k: 'x...x...x...x...', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' } },
        },
        form: ['A', 'B'], loop: 0,
      },
      reveal: {
        bpm: 108,
        tracks: { br: { type: 'brass', mode: 'chord', center: 64, n: 4, vol: 0.5 }, str: { type: 'strings', mode: 'chord', center: 62, n: 4, vol: 0.4 }, bass: { type: 'upright', mode: 'bass' }, tp: { type: 'timp', vol: 0.5 }, dr: { type: 'drums', kit: 'orch' } },
        sections: {
          R: { bars: 2, chords: 'B7sus4 | B7', str: 'x-------x-------', tp: 'b2 b2 b2 b2 b2 b2 b2 b2 | b2 b2 b2 b2 e2 e2 e2 e2', dr: { s: '2323434545656767|7878989899999999' } },
          H: { bars: 4, chords: 'Em | C | Am6 | B7', br: 'X-----x-x---x---', str: true, bass: '1 - - - 5 - 1 .', dr: { k: 'x.......x.......', y: 'x...............', s: '....x.......x...' } },
        },
        form: ['R', 'H'], loop: 1,
      },
      finale: { from: 'title', bpm: 128, transpose: 2, tracks: { br: { type: 'brass', mode: 'chord', center: 66, n: 3, vol: 0.36 } },
        sections: { A: { br: '....x.x.....x...' }, B: { br: 'x.......x.......' }, A2: { br: '....x.x.....x...' } } },
    },
    stingers: {
      win: { bpm: 120, tracks: { b: { type: 'brass', vol: 0.6 }, g: { type: 'vibes', vol: 0.4 }, d: { type: 'drums', kit: 'orch' } }, bars: 2, parts: { b: 'e4+g4+b4 . e4+g4+b4 f#4+a4+c5 - - e4+g4+b4+e5 - | e4+g4+b4+e5 - - - - - - -', g: 'e5 g5 b5 e6 - - - - | . . . . . . . .', d: { k: 'x...x.......x...|x...............', y: '................|x...............' } } },
      caught: { bpm: 110, gain: 1, tracks: { b: { type: 'brass', vol: 0.6 }, d: { type: 'drums', kit: 'orch' } }, bars: 1, parts: { b: 'e4+g4+b4+e5 - - - - - - -', d: { k: 'x', y: 'x' } } },
      innocent: { bpm: 96, gain: 1, tracks: { b: { type: 'brass', vol: 0.55 }, t: { type: 'timp', vol: 0.5 } }, bars: 1, parts: { b: 'g4 - f#4 - f4 - e4 -', t: 'e2 . . . . . e2 .' } },
      clue: { bpm: 140, tracks: { g: { type: 'vibes' } }, bars: 1, parts: { g: 'b5 e6 . . . . . .' } },
    },
    fx: { caught: 'caught', innocent: 'innocent', clue: 'clue' },
    sfx: {},
  };
})();
