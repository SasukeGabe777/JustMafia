'use strict';
// JustSketch Relay: playful pizzicato in F major. Plucked string chords and bass, a
// cheeky clarinet tune, celesta and glockenspiel doodles, woodblock ticks; a scurrying
// hurry-up when the pencils must go down.
(function () {
  const S = (window.BOX.scores = window.BOX.scores || {});
  const tracks = {
    pz: { type: 'pizz', mode: 'chord', center: 64, n: 3, vol: 0.5, pan: -0.2 },
    pbass: { type: 'pizz', mode: 'bass', oct: 2, vol: 0.8 },
    cl: { type: 'clarinet', vol: 0.5, pan: 0.15 },
    bsn: { type: 'clarinet', vol: 0.4, pan: -0.1, oct: -1 },
    cel: { type: 'celesta', vol: 0.32, pan: 0.3, oct: 1 },
    glock: { type: 'glock', vol: 0.22, pan: 0.3 },
    str: { type: 'strings', mode: 'chord', center: 65, n: 4, vol: 0.18, att: 0.6 },
    dr: { type: 'drums', vol: 0.6 },
  };
  const A = 'F | C/E | Dm | Bb | F/A | Gm7 | C7 | F';
  const B = 'Bb | C | Am | Dm | Gm | C7 | F | C7';
  const tune = 'c5 . a4 . f4 . a4 c5 | e5 . c5 . g4 . c5 e5 | f5 . d5 . a4 . d5 f5 | d5 - - - bb4 - . . | c5 . f5 . a5 . f5 . | bb5 - - - g5 - . . | e5 . g5 . bb5 . g5 e5 | f5 - - - . . . .';
  const tuneB = 'd5 - f5 - bb5 - - - | c5 - e5 - g5 - - - | c5 - e5 - a5 - - - | f5 - - - d5 - - - | bb4 - d5 - g5 - - - | e5 - g5 - c6 - bb5 - | a5 - - - c6 - a5 - | g5 - - - e5 - c5 -';
  const tip = { wb: 'x.......x.......', wb2: '....x.......x...' };
  S.sketch = {
    name: 'JustSketch Relay',
    cues: {
      title: {
        bpm: 108, tracks,
        sections: {
          I: { bars: 4, chords: 'F | Dm | Gm7 | C7', pz: 'x.x.x.x.x.x.x.x.', pbass: '1 . . . 5 . . .', cel: 'c5 . . . a4 . . . | d5 . . . a4 . . . | d5 . . . bb4 . . . | e5 . g5 . bb5 . c6 .', dr: tip },
          A: { bars: 8, chords: A, pz: '..x...x...x...x.', pbass: '1 . 5 . 1 . 5 .', cl: tune, dr: tip },
          B: { bars: 8, chords: B, pz: 'x.x.x.x.x.x.x.x.', pbass: '1 . 5 . 1 . 5 .', bsn: tuneB, glock: '. . . . . . . . | . . . . . . . . | . . . . e6 . . . | . . . . . . . . | . . . . . . . . | . . . . . . . . | . . . . f6 . . . | . . . . . . . .', str: true, dr: { ...tip, tri: 'x...............|................|................|................' } },
          A2: { bars: 8, chords: A, pz: '..x...x...x...x.', pbass: '1 . 5 . 1 . 5 .', cl: tune, cel: tune, dr: { ...tip, sh: '..x...x...x...x.' } },
        },
        form: ['I', 'A', 'B', 'A2'], loop: 1,
      },
      lobby: { from: 'title', bpm: 100, form: ['A', 'B'], loop: 0, sections: { A: { cl: { p: tune, vol: 0.38 } } } },
      intro: { from: 'title', bpm: 112 },
      // Writing / drawing: soft doodles.
      think: {
        bpm: 92,
        tracks: { cel: { type: 'celesta', mode: 'chord', center: 72, n: 4, vol: 0.32, pan: 0.25 }, pz: tracks.pz, pbass: tracks.pbass, str: tracks.str, cl: { ...tracks.cl, vol: 0.38 }, dr: { type: 'drums', vol: 0.4 } },
        sections: {
          A: { bars: 8, chords: 'Fmaj7 | Dm7 | Gm7 | C7 | Am7 | Dm7 | Gm7 | C7sus4', cel: '1.2.3.4.3.2.1.2.', pz: '....x.......x...', pbass: '1 - - - 5 - - -', str: true, dr: { wb: 'x...............' } },
          B: { bars: 8, chords: 'Bbmaj7 | Am7 | Gm7 | Fmaj7 | Bbmaj7 | Am7 | Gm7 | C7', cel: '1.2.3.4.3.2.1.2.', pz: '....x.......x...', pbass: '1 - - - 5 - - -', cl: 'd5 - - - f5 - - - | e5 - - - c5 - - - | bb4 - - - d5 - - - | a4 - - - - - . . | d5 - - - f5 - a5 - | g5 - - - e5 - - - | f5 - - - d5 - bb4 - | c5 - - - - - . .', dr: { wb: 'x...............' } },
        },
        form: ['A', 'B'], loop: 0,
      },
      play: { from: 'title', bpm: 104, form: ['A', 'B'], loop: 0, sections: { A: { cl: false, cel: { p: tune, vol: 0.6 } } } },
      // Hurry! scurrying pizzicato.
      tense: {
        bpm: 144,
        tracks: { pz: { type: 'pizz', mode: 'chord', center: 62, n: 3, vol: 0.5 }, pbass: tracks.pbass, cl: tracks.cl, dr: { type: 'drums', vol: 0.65 } },
        sections: {
          A: { bars: 4, chords: 'Dm | A7 | Dm | A7', pz: '1212121212121212', pbass: '1 . 5 . 1 . 5 .', dr: { wb: 'x.x.x.x.x.x.x.x.', wb2: '.x.x.x.x.x.x.x.x' } },
          B: { bars: 4, chords: 'Gm | Dm | E7 | A7', pz: '1212121212121212', pbass: '1 . 5 . 1 . 5 .', cl: 'd5 e5 f5 g5 a5 - - - | f5 g5 a5 bb5 a5 - - - | g#5 a5 b5 c6 d6 - b5 - | c#6 - - - a5 - - -', dr: { wb: 'x.x.x.x.x.x.x.x.', tick: 'x...x...x...x...' } },
        },
        form: ['A', 'B'], loop: 0,
      },
      // The books are shown.
      reveal: {
        bpm: 100,
        tracks: { pz: tracks.pz, pbass: tracks.pbass, cel: { type: 'celesta', vol: 0.4 }, cl: tracks.cl, str: tracks.str, dr: tracks.dr },
        sections: {
          R: { bars: 8, chords: 'F | Am | Bb | C7 | F | Am | Bb C7 | F', pz: '....x.......x...', pbass: '1 - - - 5 - - -', str: true, cel: 'a5 c6 f6 - - - . . | e6 - - - c6 - - - | d6 f6 bb6 - - - . . | g6 - - - e6 - - - | a5 c6 f6 - - - . . | e6 - - - c6 - - - | d6 - - - e6 - - - | f6 - - - - - . .', dr: { tri: 'x...............|................|................|................' } },
        },
        form: ['R'], loop: 0,
      },
      finale: { from: 'title', bpm: 112, transpose: 2, form: ['I', 'A2', 'B', 'A2'], tracks: { br: { type: 'brass', vol: 0.3, bright: 0.9 } }, sections: { A2: { br: '. . . . . . . . | . . . . . . . . | . . . . . . . . | d5 - - - bb4 - . . | . . . . . . . . | . . . . . . . . | . . . . . . . . | f5 - - - . . . .' } } },
    },
    stingers: {
      guess: { bpm: 140, tracks: { c: { type: 'celesta' } }, parts: { c: 'c6 f6 a6 - . . . .' } },
      book: { bpm: 110, tracks: { p: { type: 'pizz', mode: 'chord', center: 67, n: 4 }, c: { type: 'celesta' } }, chords: 'F', parts: { p: 'x.x.X-----------', c: '. . . . f6 - - -' } },
      survived: { bpm: 120, tracks: { c: { type: 'clarinet' }, g: { type: 'glock' } }, parts: { c: 'c5 f5 a5 c6 - - - -', g: '. . . . c7 - - -' } },
      chaos: { bpm: 140, tracks: { c: { type: 'clarinet' } }, parts: { c: 'c6 b5 bb5 a5 ab5 g5 - -' } },
      draw: { bpm: 120, tracks: { p: { type: 'pizz' } }, parts: { p: 'c5 f5 a5 c6 . . . .' } },
      win: { bpm: 112, tracks: { c: { type: 'clarinet' }, p: { type: 'pizz', mode: 'chord', center: 65, n: 4 }, g: { type: 'glock' } }, chords: 'C7 | F', bars: 2, parts: { c: 'e5 g5 bb5 c6 - bb5 g5 e5 | f5 - - - - - - -', p: 'x.x.x.x.x.x.x.x.|X---------------', g: '. . . . . . . . | f6 - - - - - - -' } },
    },
    fx: { guess: 'guess', book: 'book', survived: 'survived', chaos: 'chaos', draw: 'draw', win: 'win' },
    sfx: { win: 'win', drum: 'roll' },
  };
})();
