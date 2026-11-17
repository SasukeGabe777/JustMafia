'use strict';
// JustRaiseDucks: bright pastoral country/folk in G major. Fiddle melody, banjo rolls,
// boom-chick acoustic guitar, upright bass and a brushed train beat; a gentle farm tune
// for training, a hoedown for the races and a fiddle fanfare for the results.
(function () {
  const S = (window.BOX.scores = window.BOX.scores || {});
  const tracks = {
    fid: { type: 'strings', vol: 0.42, att: 0.04, cut: 4800, vib: 14, pan: 0.15 },
    banjo: { type: 'banjo', mode: 'chord', center: 70, n: 3, vol: 0.32, pan: 0.3 },
    gtr: { type: 'guitar', mode: 'chord', center: 60, n: 5, vol: 0.36, pan: -0.25, strum: 0.01 },
    bass: { type: 'upright', mode: 'bass', oct: 2 },
    wh: { type: 'whistle', vol: 0.38, pan: -0.1, dly: 0.15 },
    dr: { type: 'drums', kit: 'jazz', vol: 0.6 },
  };
  const A = 'G | G | C | G | G | Em | D7 | G';
  const B = 'C | G | Am | D | C | G/B | Am D7 | G';
  const tune = 'd5 - g5 a5 b5 - a5 g5 | b5 d6 - b5 a5 - g5 - | e5 - g5 - c6 - b5 a5 | g5 - - - d5 e5 f#5 - | g5 a5 b5 - d6 - b5 - | e6 - d6 b5 g5 - e5 - | d5 - f#5 - a5 - c6 - | b5 - g5 - - - . .';
  const tuneB = 'e5 - g5 - c6 - - - | b5 - - - g5 - - - | a5 - c6 - e6 - - - | d6 - - - - - . . | e6 - - - c6 - - - | d6 - - - b5 - - - | c6 - - - a5 - f#5 - | g5 - - - - - . .';
  const train = { k: 'x.......x.......', br: 'xgxgxgxgxgxgxgxg', s: '....x.......x...' };
  const boom = '..x...x...x...x.';
  S.ducks = {
    name: 'JustRaiseDucks',
    cues: {
      title: {
        bpm: 112, tracks,
        sections: {
          I: { bars: 4, chords: 'G | C | G | D7', banjo: '1231231231231231', bass: '1 . . . 5 . . .', dr: { br: '................|................|xgxgxgxgxgxgxgxg|xgxgxgxgxgxgXXXX' } },
          A: { bars: 8, chords: A, gtr: boom, bass: '1 . . . 5 . . .', fid: tune, dr: train },
          B: { bars: 8, chords: B, gtr: boom, banjo: '1231231231231231', bass: '1 . . . 5 . . .', wh: tuneB, dr: train },
          A2: { bars: 8, chords: A, gtr: boom, banjo: '1231231231231231', bass: '1 . . . 5 . . .', fid: tune, wh: { p: tune, vol: 0.2 }, dr: { ...train, cb: '' } },
        },
        form: ['I', 'A', 'B', 'A2'], loop: 1,
      },
      // The farm (lobby and between races).
      lobby: {
        bpm: 96,
        tracks: { pick: { type: 'nylon', mode: 'chord', center: 64, n: 4, vol: 0.4, pan: -0.2 }, fl: { type: 'flute', vol: 0.42, pan: 0.15, dly: 0.12 }, bass: { type: 'upright', mode: 'bass' }, harp: { type: 'harp', mode: 'chord', center: 72, n: 4, vol: 0.2, pan: 0.3 }, dr: { type: 'drums', vol: 0.45 } },
        sections: {
          A: { bars: 8, chords: 'G | D/F# | Em | C | G | D | C D | G', pick: '1.3.2.4.1.3.2.4.', bass: '1 - - - 5 - - -', fl: 'b4 - - - d5 - - - | a4 - - - d5 - f#5 - | g5 - - - e5 - b4 - | c5 - - - - - . . | d5 - g5 - b5 - - - | a5 - - - f#5 - d5 - | e5 - - - f#5 - - - | g5 - - - - - . .', dr: { sh: '..x...x...x...x.' } },
          B: { bars: 8, chords: 'C | G | Am | D | C | G | Am7 D7 | G', pick: '1.3.2.4.1.3.2.4.', harp: '1...2...3...4...', bass: '1 - - - 5 - - -', dr: { sh: '..x...x...x...x.', wb: 'x...............' } },
        },
        form: ['A', 'B'], loop: 0,
      },
      intro: { from: 'title', bpm: 116 },
      think: { from: 'lobby', bpm: 100 },
      // Race day: a hoedown.
      play: {
        bpm: 150, tracks: { ...tracks, roll: { type: 'banjo', mode: 'chord', center: 72, n: 3, vol: 0.3, pan: 0.3 } },
        sections: {
          A: { bars: 8, chords: 'G | G | C | G | G | G | D | G', roll: '1231231231231231', gtr: boom, bass: '1 . 5 . 1 . 5 .', fid: 'g5 a5 b5 g5 a5 b5 d6 b5 | g5 a5 b5 g5 a5 - g5 - | e5 g5 c6 e6 d6 c6 b5 a5 | g5 - b5 - d6 - - - | g5 a5 b5 g5 a5 b5 d6 b5 | e6 d6 b5 g5 a5 - g5 - | f#5 a5 d6 c6 b5 a5 f#5 a5 | g5 - - - - - . .', dr: { k: 'x.......x.......', s: '....x.......x...', br: 'xxxxxxxxxxxxxxxx' } },
          B: { bars: 8, chords: 'C | C | G | G | D | D | G | D7', roll: '3213213213213213', gtr: boom, bass: '1 . 5 . 1 . 5 .', wh: 'e5 - g5 - c6 - - - | e6 - d6 - c6 - - - | b5 - d6 - g6 - - - | d6 - - - b5 - - - | a5 - d6 - f#6 - - - | e6 - d6 - a5 - - - | b5 - - - g5 - - - | a5 - - - c6 - - -', dr: { k: 'x.......x.......', s: '....x.......x...', br: 'xxxxxxxxxxxxxxxx', cb: '..x...x...x...x.' } },
        },
        form: ['A', 'B'], loop: 0,
      },
      tense: { from: 'play', bpm: 164 },
      reveal: {
        bpm: 120,
        tracks: { fid: tracks.fid, banjo: tracks.banjo, gtr: tracks.gtr, bass: tracks.bass, dr: tracks.dr },
        sections: { R: { bars: 4, chords: 'C | G | D7 | G', banjo: '1231231231231231', gtr: boom, bass: '1 . . . 5 . . .', fid: 'c5 e5 g5 c6 - - e6 - | d6 - b5 - g5 - - - | a5 - c6 - f#6 - - - | g6 - - - - - - -', dr: train } },
        form: ['R'], loop: 0,
      },
      finale: { from: 'title', bpm: 118, transpose: 2, form: ['I', 'A2', 'B', 'A2'] },
    },
    stingers: {
      win: { bpm: 140, tracks: { f: { type: 'strings', att: 0.03, cut: 4800 }, b: { type: 'banjo', mode: 'chord', center: 70, n: 3 } }, chords: 'D7 | G', bars: 2, parts: { f: 'd5 f#5 a5 c6 b5 a5 f#5 a5 | g5 - - - - - - -', b: '1231231231231231|x---------------' } },
      levelUp: { bpm: 150, tracks: { b: { type: 'banjo' } }, parts: { b: 'g4 b4 d5 g5 - - . .' } },
      badge: (X) => { X.chord('glock', ['g6', 'b6', 'd7'], 0, 0.8, 0.6, 0.06); },
      hatch: (X) => { X.note('kalimba', 'd6', 0, 0.3, 0.7); X.note('kalimba', 'g6', 0.12, 0.6, 0.7); },
      grow: (X) => { X.chord('harp', ['g4', 'b4', 'd5', 'g5', 'b5'], 0, 1, 0.6, 0.05); },
      event: { bpm: 120, tracks: { f: { type: 'strings', att: 0.03, cut: 4800 } }, parts: { f: 'd5 g5 - - . . . .' } },
      raceDone: (X) => { X.chord('banjo', ['g4', 'b4', 'd5', 'g5'], 0, 0.8, 0.8, 0.02); X.drum('cb', 0, 0.6); },
    },
    fx: { raceDone: 'raceDone', levelUp: 'levelUp', win: 'win', badge: 'badge', hatch: 'hatch', grow: 'grow', event: 'event' },
    sfx: { win: 'win', drum: 'roll' },
  };
})();
