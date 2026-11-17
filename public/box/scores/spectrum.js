'use strict';
// Where Do You Stand?: warm sunrise acoustic chill in G major, 84 bpm. Strummed steel
// guitar, a finger-picked nylon arpeggio, soft piano, shaker and a gentle kick; a flute
// melody like morning light. A brighter strum when the clock runs down.
(function () {
  const S = (window.BOX.scores = window.BOX.scores || {});
  const tracks = {
    gtr: { type: 'guitar', mode: 'chord', center: 60, n: 5, vol: 0.38, pan: -0.25, strum: 0.014 },
    pick: { type: 'nylon', mode: 'chord', center: 67, n: 4, vol: 0.35, pan: 0.28 },
    pno: { type: 'piano', vol: 0.4, pan: 0.1 },
    fl: { type: 'flute', vol: 0.42, pan: 0.15, dly: 0.12 },
    bass: { type: 'bass', mode: 'bass', oct: 2, cut: 500, vol: 0.6 },
    pad: { type: 'pad', mode: 'chord', center: 64, vol: 0.18, cut: 1500 },
    dr: { type: 'drums', kit: 'lofi', vol: 0.55 },
  };
  const A = 'G | Cadd9 | Em7 | D/F# | C | G/B | Am7 | Dsus4 D';
  const B = 'Em | C | G | D | Em | C | Am7 | D';
  const tune = 'b4 - d5 - g5 - - - | e5 - - - d5 - - - | b4 - - - g4 - a4 - | a4 - - - - - . . | c5 - e5 - g5 - - - | d5 - - - b4 - - - | c5 - - - e5 - d5 - | d5 - - - - - . .';
  const tuneB = 'g5 - - - f#5 - e5 - | e5 - - - - - . . | d5 - - - b4 - d5 - | a5 - - - - - . . | g5 - - - f#5 - e5 - | e5 - - - g5 - - - | a5 - - - g5 - e5 - | f#5 - - - - - . .';
  const strum = 'x..x..x.x.x..x..';
  const soft = { k: 'x.......x.......', sh: 'xgxgxgxgxgxgxgxg', rim: '....x.......x...' };
  S.spectrum = {
    name: 'Where Do You Stand?',
    tenseFrom: ['play'], // timed 'play' phases also turn tense in their last 10 s
    cues: {
      title: {
        bpm: 84, swing16: 0.55, tracks,
        sections: {
          I: { bars: 4, chords: 'G | Cadd9 | G | Dsus4', pick: '1.2.3.4.2.3.1.4.', pad: true },
          A: { bars: 8, chords: A, gtr: strum, pick: '1...3...2...4...', bass: '1 - - - 5 - - . | 1 - - . 5 - 3 .', fl: tune, dr: soft },
          B: { bars: 8, chords: B, gtr: strum, pad: true, bass: '1 - - - 5 - - . | 1 - - . 5 - 3 .', pno: tuneB, dr: { ...soft, k: 'x.......x.x.....' } },
          A2: { bars: 8, chords: A, gtr: strum, pick: '1.2.3.4.2.3.1.4.', pad: true, bass: '1 - - - 5 - - . | 1 - - . 5 - 3 .', fl: tune, pno: { p: tune, oct: -1, vol: 0.25 }, dr: soft },
        },
        form: ['I', 'A', 'B', 'A2'], loop: 1,
      },
      lobby: { from: 'title', bpm: 80, form: ['A', 'B'], loop: 0, sections: { A: { fl: { p: tune, vol: 0.3 } } } },
      intro: { from: 'title', bpm: 88 },
      think: {
        bpm: 76,
        tracks: { pick: { ...tracks.pick, vol: 0.42 }, pno: { type: 'piano', mode: 'chord', center: 60, n: 4, vol: 0.3 }, pad: tracks.pad, bass: tracks.bass, dr: { ...tracks.dr, vol: 0.4 } },
        sections: {
          A: { bars: 8, chords: 'Cmaj7 | G/B | Am7 | Em7 | Cmaj7 | G/B | Am7 | D7sus4', pick: '1.2.3.4.2.3.1.4.', pno: 'x---------------', pad: true, bass: '1 - - - - - - - | 1 - - - 5 - - -', dr: { sh: '..x...x...x...x.' } },
        },
        form: ['A'], loop: 0,
      },
      play: { from: 'title', bpm: 86, form: ['A', 'B'], loop: 0, sections: { A: { fl: false, pno: { p: tune, vol: 0.32 } }, B: { pno: false } } },
      tense: {
        bpm: 112,
        tracks: { gtr: { ...tracks.gtr, vol: 0.42 }, pick: tracks.pick, bass: tracks.bass, fl: tracks.fl, dr: { type: 'drums', kit: 'std', vol: 0.6 }, clk: { type: 'drums', vol: 0.5 } },
        sections: {
          A: { bars: 4, chords: 'Em | C | G | D', gtr: 'x.x.x.x.x.x.x.x.', bass: '1 . 1 . 5 . 1 .', clk: { tick: 'x...x...x...x...' }, dr: { k: 'x...x...x...x...', sh: 'xxxxxxxxxxxxxxxx', s: '....x.......x...' } },
          B: { bars: 4, chords: 'Em | C | Am7 | D', gtr: 'x.x.x.x.x.x.x.x.', pick: '1234123412341234', bass: '1 . 1 . 5 . 1 .', fl: 'b5 - - - g5 - - - | e5 - - - g5 - - - | a5 - - - c6 - - - | a5 - - - f#5 - - -', clk: { tick: 'x.x.x.x.x.x.x.x.' }, dr: { k: 'x...x...x...x...', sh: 'xxxxxxxxxxxxxxxx', s: '....x.......x...' } },
        },
        form: ['A', 'B'], loop: 0,
      },
      reveal: {
        bpm: 84,
        tracks: { gtr: tracks.gtr, glock: { type: 'glock', vol: 0.3 }, pad: tracks.pad, bass: tracks.bass, dr: tracks.dr },
        sections: {
          R: { bars: 4, chords: 'Cadd9 | D | Em7 | G', gtr: 'x-----x-x-------', pad: true, bass: '1 - - - 5 - - -', glock: 'g5 b5 d6 - - - . . | a5 d6 f#6 - - - . . | b5 e6 g6 - - - . . | d6 g6 b6 - - - - -', dr: soft },
        },
        form: ['R'], loop: 0,
      },
      finale: { from: 'title', bpm: 90, transpose: 2, tracks: { str: { type: 'strings', mode: 'chord', center: 65, n: 4, vol: 0.22 } }, form: ['A2', 'B', 'A2'], all: { str: true } },
    },
    stingers: {
      bullseye: { bpm: 120, tracks: { g: { type: 'glock' }, p: { type: 'guitar', mode: 'chord', center: 64, n: 5, strum: 0.02 } }, chords: 'G', parts: { g: 'g5 b5 d6 g6 - - - -', p: 'x---------------' } },
      lock: (X) => X.note('nylon', 'd5', 0, 0.3, 0.7),
      reveal: (X) => { X.chord('guitar', ['g3', 'd4', 'g4', 'b4', 'd5', 'g5'], 0, 1.5, 0.8, 0.018); X.drum('sh', 0, 0.8); },
      dozed: { bpm: 90, tracks: { f: { type: 'flute' } }, parts: { f: 'd5 - c5 - b4 - - -' } },
      win: { bpm: 100, tracks: { f: { type: 'flute' }, g: { type: 'guitar', mode: 'chord', center: 62, n: 5, strum: 0.015 } }, chords: 'C D | G', bars: 2, parts: { f: 'e5 - f#5 - g5 - a5 - | b5 - - - - - - -', g: 'x-------x-------|x---------------' } },
    },
    fx: { bullseye: 'bullseye', lock: 'lock', reveal: 'reveal', dozed: 'dozed', win: 'win' },
    sfx: { win: 'win', drum: 'roll' },
  };
})();
