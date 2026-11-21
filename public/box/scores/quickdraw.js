'use strict';
// QUICK DRAW soundtrack: a spaghetti-western score in A minor. A lonesome whistle over a
// galloping nylon guitar and woodblock hoofbeats, mariachi-style brass for the B section, a
// honky-tonk chicken shuffle for counting, a heartbeat standoff for the duels, a tick-tock for
// the lantern and a full-tilt stampede. Format: public/box/scores/README.md.
// Cues: title, lobby, intro, think (Chicken Run), play (challenge cards), tense (the Lantern),
// standoff (DRAW!), race (Stampede), reveal (results), finale. Copycat plays in silence.
(function () {
  const S = (window.BOX.scores = window.BOX.scores || {});
  const tracks = {
    gtr: { type: 'nylon', mode: 'chord', center: 60, n: 4, vol: 0.5, pan: -0.25, strum: 0.012 },
    bass: { type: 'upright', mode: 'bass', oct: 2, vol: 0.65 },
    lead: { type: 'whistle', vol: 0.5, pan: 0.1, dly: 0.22, rev: 0.4 },
    br: { type: 'brass', vol: 0.42, pan: 0.15 },
    bell: { type: 'cbell', vol: 0.28, pan: 0.3 },
    dr: { type: 'drums', kit: 'std', vol: 0.7 },
  };
  const gallop = 'x.xxx.xxx.xxx.xx';
  const melA = 'a4 - - e5 - - a5 - | g5 - - - - - . . | f5 - - e5 - d5 - c5 | d5 - - - - - . . | c5 - - b4 - a4 - g4 | a4 - - - f4 - - - | e4 - - - g#4 - b4 - | e5 - - - - - . .';
  const melB = 'd5 - f5 - a5 - - - | e5 - - - - - . . | d5 - f5 - a5 - g5 f5 | e5 - - - - - . . | a5 - - - g5 f5 e5 - | f5 - - - e5 d5 c5 - | b4 - - - c5 - d5 - | e5 - - - - - . .';
  S.quickdraw = {
    name: 'Quick Draw',
    cues: {
      title: {
        bpm: 126, tracks,
        sections: {
          I: { bars: 4, chords: 'Am | Am | G | E7', gtr: 'x-----------x-x-', lead: 'e5 - - - - - - - | a5 - - - - - - - | g5 - - - f5 - e5 - | e5 - - - - - - -', bell: 'a5 - - - - - - - | . . . . . . . . | g5 - - - - - - - | e5 - - - - - - -', dr: { wb: '................|................|................|x.xxx.xxx.xxx.xx' } },
          A: { bars: 8, chords: 'Am | Am | G | G | F | F | E7 | E7', gtr: 'x.xx.xx.x.xx.xx.', bass: '1 . . 5 1 . . 5', lead: melA, dr: { k: 'x.......x.......', s: '....x.......x...', wb: gallop } },
          B: { bars: 8, chords: 'Dm | Am | Dm | E7 | Am | F | E7 | Am', gtr: 'x.xx.xx.x.xx.xx.', bass: '1 . . 5 1 . 5 .', br: melB, bell: '. . . . . . . . | a5 - - - - - - - | . . . . . . . . | e5 - - - - - - -', dr: { k: 'x.......x.......', s: '....x.......x.x.', wb: gallop, cb: 'x...x...x...x...' } },
        },
        form: ['I', 'A', 'B', 'A'], loop: 1,
      },
      lobby: { from: 'title', bpm: 112, tracks: { lead: { vol: 0.32 }, br: { vol: 0.3 } }, form: ['A', 'B'], loop: 0,
        sections: { A: { dr: { k: 'x.......x.......', wb: 'x...x.x.x...x.x.' } }, B: { dr: { k: 'x.......x.......', s: '....g.......x...', wb: 'x...x.x.x...x.x.' } } } },
      intro: { from: 'title', bpm: 132, form: ['I', 'A', 'B'] },
      play: { from: 'title', bpm: 138, form: ['A', 'B'], loop: 0 },
      think: {
        bpm: 128, swing16: 0.58,
        tracks: { pno: { type: 'honky', mode: 'chord', center: 64, n: 3, vol: 0.5, pan: -0.2 }, tuba: { type: 'tuba', mode: 'bass', oct: 2, vol: 0.6 }, lead: { type: 'clav', vol: 0.42, pan: 0.2 }, dr: { type: 'drums', kit: 'std', vol: 0.6 } },
        sections: {
          A: { bars: 8, chords: 'C | C | G7 | G7 | F | C | G7 | C', pno: '..x...x...x...x.', tuba: '1 . 5 . 1 . 5 .',
            lead: 'g4 c5 e5 g5 - e5 c5 - | a5 g5 e5 c5 - - . . | g4 b4 d5 f5 - d5 b4 - | g5 f5 d5 b4 - - . . | a4 c5 f5 a5 - f5 c5 - | g5 e5 c5 e5 - - . . | d5 - b4 - g4 - b4 d5 | c5 - - - - - . .',
            dr: { k: 'x.......x.......', s: '....x.......x...', wb2: '..x...x...x...x.' } },
          B: { bars: 8, chords: 'F | F | C | C | D7 | D7 | G7 | G7', pno: '..x...x...x.x.x.', tuba: '1 . 5 . 1 . 5 .',
            lead: 'a4 - c5 - f5 - - - | e5 f5 e5 c5 - - . . | g4 - c5 - e5 - - - | d5 e5 d5 c5 - - . . | f#4 - a4 - d5 - - - | c5 d5 c5 a4 - - . . | b4 - d5 - g5 - f5 - | d5 - b4 - g4 - . .',
            dr: { k: 'x.......x.......', s: '....x.......x...', wb2: '..x...x...x...x.', cb: 'x...............' } },
        },
        form: ['A', 'B'], loop: 0,
      },
      tense: {
        bpm: 104,
        tracks: { str: { type: 'strings', mode: 'chord', center: 57, n: 3, vol: 0.38, att: 0.02, rel: 0.12 }, pad: { type: 'pad', mode: 'chord', center: 60, vol: 0.22, cut: 1100 }, bass: { type: 'upright', mode: 'bass', oct: 2, vol: 0.55 }, lead: { type: 'whistle', vol: 0.38, dly: 0.3, rev: 0.5 }, tk: { type: 'drums', vol: 0.6 }, dr: { type: 'drums', kit: 'std', vol: 0.5 } },
        sections: {
          A: { bars: 8, chords: 'Am | Am | F | E7 | Am | Am | Bb | E7', str: 'x.x.x.x.x.x.x.x.', pad: true, bass: '1 . . . 1 . . .', tk: { tick: 'x...x...x...x...', tock: '..x...x...x...x.' }, dr: { hb: 'x..x............' },
            lead: 'e5 - - - - - - - | . . . . . . . . | f5 - - - - - - - | e5 - - - g#5 - - - | a5 - - - - - - - | . . . . . . . . | bb5 - - - a5 - - - | g#5 - - - - - - -' },
        },
        form: ['A'], loop: 0,
      },
      standoff: {
        bpm: 70,
        tracks: { pad: { type: 'pad', mode: 'chord', center: 57, n: 3, vol: 0.26, cut: 900 }, lead: { type: 'whistle', vol: 0.42, dly: 0.35, rev: 0.6 }, gtr: { type: 'nylon', mode: 'chord', center: 55, n: 4, vol: 0.32, pan: -0.3 }, bell: { type: 'cbell', vol: 0.26, rev: 0.6 }, dr: { type: 'drums', kit: 'std', vol: 0.7 } },
        sections: {
          A: { bars: 8, chords: 'Am | Am | Dm | Am | Am | Am | E7 | E7', pad: true, gtr: '1.......3.......',
            lead: 'e5 - - - - - - - | - - - - . . . . | f5 - - - e5 - d5 - | e5 - - - - - . . | . . . . . . . . | a5 - - - g5 - e5 - | f5 - - - e5 - - - | e5 - - - - - . .',
            bell: 'a4 - - - - - - - | . . . . . . . . | . . . . . . . . | . . . . . . . . | a4 - - - - - - - | . . . . . . . . | . . . . . . . . | . . . . . . . .',
            dr: { hb: 'x..x............' } },
        },
        form: ['A'], loop: 0,
      },
      race: {
        bpm: 168,
        tracks: { banjo: { type: 'banjo', mode: 'chord', center: 62, n: 3, vol: 0.42, pan: -0.25 }, bass: { type: 'upright', mode: 'bass', oct: 2, vol: 0.62 }, br: { type: 'brass', vol: 0.46, pan: 0.15 }, dr: { type: 'drums', kit: 'std', vol: 0.75 } },
        sections: {
          A: { bars: 8, chords: 'Am | Am | G | G | F | G | Am | Am', banjo: gallop, bass: '1 1 5 5 1 1 5 5',
            br: 'a4 - c5 - e5 - a5 - | g5 - e5 - c5 - e5 - | d5 - b4 - g4 - b4 - | d5 - g5 - - - . . | c5 - f5 - a5 - c6 - | b5 - g5 - d5 - b4 - | a4 - c5 - e5 - a5 - | a5 - - - - - . .',
            dr: { k: 'x...x...x...x...', s: '....x.......x...', wb: gallop, h: 'x.x.x.x.x.x.x.x.' } },
          B: { bars: 4, chords: 'F | G | E7 | E7', banjo: gallop, bass: '1 1 5 5 1 1 5 5', br: 'f5 - - - a5 - - - | g5 - - - b5 - - - | g#5 - - - b5 - - - | e6 - - - - - . .',
            dr: { k: 'x...x...x...x...', s: '....x.......xxxx', wb: gallop, cb: 'x.x.x.x.x.x.x.x.' } },
        },
        form: ['A', 'B'], loop: 0,
      },
      reveal: {
        bpm: 110,
        tracks: { br: { type: 'brass', mode: 'chord', center: 64, n: 4, vol: 0.5 }, str: { type: 'strings', mode: 'chord', center: 62, n: 4, vol: 0.38 }, gtr: { type: 'nylon', mode: 'chord', center: 60, n: 4, vol: 0.4 }, bass: { type: 'upright', mode: 'bass' }, tp: { type: 'timp', vol: 0.5 }, dr: { type: 'drums', kit: 'orch' } },
        sections: {
          R: { bars: 2, chords: 'E7 | E7', str: 'x-------x-------', tp: 'e2 e2 e2 e2 e2 e2 e2 e2 | e2 e2 e2 e2 b2 b2 b2 b2', dr: { s: '2323434545656767|7878989899999999' } },
          H: { bars: 4, chords: 'A | D/A | A | E7', br: 'X-----x-x---x---', gtr: 'x.xx.xx.x.xx.xx.', str: true, bass: '1 - - - 5 - 1 .', dr: { k: 'x.......x.......', y: 'x...............', s: '....x.......x...', wb: gallop } },
        },
        form: ['R', 'H'], loop: 1,
      },
      finale: { from: 'title', bpm: 132, tracks: { brx: { type: 'brass', mode: 'chord', center: 66, n: 3, vol: 0.36 } },
        sections: { A: { brx: '....x.x.....x...' }, B: { brx: 'x.......x.......' } }, form: ['A', 'B'], loop: 0 },
    },
    stingers: {
      // the DRAW! signal: a church bell clang and a gunshot echo down the street
      draw: (X) => { X.note('cbell', 'e6', 0, 1.4, 1); X.note('cbell', 'b5', 0, 1.4, 0.7); X.noise({ at: 0, dur: 0.28, f0: 2400, vol: 0.55 }); X.tone({ at: 0, dur: 0.35, f0: 90, f1: 38, vol: 0.5 }); X.noise({ at: 0.28, dur: 0.8, f0: 700, vol: 0.14 }); },
      // just the bell: the TV fires a recorded gunshot over it (games/quickdraw.js)
      drawBell: (X) => { X.note('cbell', 'e6', 0, 1.4, 0.8); X.note('cbell', 'b5', 0, 1.4, 0.55); },
      beat: (X) => { X.drum('k', 0, 1, 'world'); X.drum('t1', 0, 0.6); },
      gallop: { bpm: 160, tracks: { b: { type: 'brass', vol: 0.6 }, d: { type: 'drums', kit: 'std' } }, bars: 1, parts: { b: 'e5 e5 e5 a5 - - - -', d: { wb: gallop, k: 'x.......x.......' } } },
      bad: (X) => { X.tone({ dur: 0.7, f0: 700, f1: 160, wave: 'sawtooth', vol: 0.22, lp: 1600 }); X.drum('wb2', 0.7, 1); },
      good: { bpm: 150, tracks: { g: { type: 'banjo', vol: 0.6 } }, bars: 1, parts: { g: 'a4 c#5 e5 a5 - - - -' } },
      round: { bpm: 130, tracks: { b: { type: 'brass', vol: 0.5 }, w: { type: 'whistle', vol: 0.4 }, d: { type: 'drums', kit: 'std' } }, bars: 1, parts: { b: 'a4+e5 . . . a4+e5+a5 - - -', w: '. . e6 - a6 - - -', d: { wb: 'x.xx', y: 'x' } } },
      reveal: { bpm: 110, gain: 1, tracks: { b: { type: 'brass', vol: 0.55 }, d: { type: 'drums', kit: 'orch' } }, bars: 1, parts: { b: 'a4+c#5+e5+a5 - - - - - - -', d: { k: 'x', y: 'x' } } },
      win: { bpm: 120, tracks: { b: { type: 'brass', vol: 0.6 }, w: { type: 'whistle', vol: 0.45 }, d: { type: 'drums', kit: 'orch' } }, bars: 2, parts: { b: 'a4+c#5+e5 . a4+c#5+e5 a4+d5+f#5 - - a4+c#5+e5 - | a4+c#5+e5+a5 - - - - - - -', w: 'e5 . e5 f#5 - - e5 - | a5 - - - - - - -', d: { s: 'x.x.x.....x.....', y: '................|x...............' } } },
    },
    fx: { intro: 'round', result: 'reveal', win: 'win', false: 'bad', duelDone: 'good' }, // finish: a recorded whinny (onFx in games/quickdraw.js)
    sfx: {},
  };
})();
