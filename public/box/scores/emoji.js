'use strict';
// Emoji Charades: bouncy bubble-pop in E major, 124 bpm. Bubbly FM keys, marimba,
// a soft two-oscillator square lead, plucky synth bass, claps on a four-on-the-floor,
// glockenspiel sparkles.
(function () {
  const S = (window.BOX.scores = window.BOX.scores || {});
  const tracks = {
    keys: { type: 'fmkeys', mode: 'chord', center: 66, n: 4, ratio: 1, index: 1.6, vol: 0.4, pan: -0.2 },
    mar: { type: 'marimba', mode: 'chord', center: 74, n: 4, vol: 0.35, pan: 0.3 },
    lead: { type: 'lead', wave: 'square', uni: true, cut: 2600, vol: 0.34, pan: 0.05, dly: 0.14 },
    bub: { type: 'fmkeys', ratio: 2, index: 2.5, vol: 0.32, pan: 0.25, dly: 0.2, oct: 1 },
    glock: { type: 'glock', vol: 0.2, pan: -0.3, oct: 1 },
    bass: { type: 'synthbass', mode: 'bass', oct: 2, vol: 0.45, q: 5 },
    pad: { type: 'pad', mode: 'chord', center: 68, vol: 0.18, cut: 2400 },
    dr: { type: 'drums', kit: 'std' },
  };
  const A = 'Emaj7 | G#m7 | Amaj7 | B7sus4 B7 | Emaj7 | G#7 | C#m7 | A B';
  const B = 'Amaj7 | B | G#m7 | C#m7 | F#m7 | B | Emaj7 | B7';
  const hook = 'b4 e5 . g#5 . b5 . g#5 | f#5 . d#5 . b4 . d#5 . | e5 a5 . c#6 . e6 . c#6 | b5 - - - a5 . f#5 . | b4 e5 . g#5 . b5 . g#5 | c6 . d#6 . c6 . g#5 . | g#5 . e5 . c#5 . e5 . | f#5 - e5 - d#5 - - -';
  const hookB = 'c#6 - - - b5 - a5 - | f#5 - - - - - . . | d#6 - - - c#6 - b5 - | g#5 - - - - - . . | a5 - c#6 - e6 - c#6 - | d#6 - - - f#6 - - - | e6 - - - b5 - g#5 - | a5 - - - f#5 - - -';
  const four = { k: 'x...x...x...x...', c: '....x.......x...', h: '..x...x...x...x.', sh: 'xgxgxgxgxgxgxgxg' };
  S.emoji = {
    name: 'Emoji Charades',
    tenseFrom: ['play'], // timed 'play' phases also turn tense in their last 10 s
    cues: {
      title: {
        bpm: 124, tracks,
        sections: {
          I: { bars: 4, chords: 'Emaj7 | C#m7 | Amaj7 | B7sus4', mar: '1.2.3.4.3.2.1.2.', bub: '. . . . . . . . | . . . . . . . . | . . . . . . . . | b5 . b5 . b5 . e6 .', dr: { k: 'x.......x.......', c: '................|................|................|....x...x.x.xxxx' } },
          A: { bars: 8, chords: A, keys: '..x...x...x...x.', bass: '1 . 1 8 . 1 5 .', lead: hook, pad: true, dr: four },
          B: { bars: 8, chords: B, keys: 'x..x..x...x..x..', mar: '1.2.3.4.3.2.1.2.', bass: '1 . . 1 . 1 5 8', bub: hookB, dr: { ...four, o: '..............x.' } },
          A2: { bars: 8, chords: A, keys: '..x...x...x...x.', bass: '1 . 1 8 . 1 5 .', lead: hook, glock: hook, pad: true, dr: { ...four, h: 'x.x.x.x.x.x.x.x.' } },
        },
        form: ['I', 'A', 'B', 'A2'], loop: 1,
      },
      lobby: { from: 'title', bpm: 116, form: ['A', 'B'], loop: 0, sections: { A: { lead: false, bub: { p: hook, vol: 0.6 }, dr: { k: 'x.......x.......', c: '....x.......x...', sh: 'xgxgxgxgxgxgxgxg' } } } },
      intro: { from: 'title', bpm: 126 },
      // Picking a secret: tiptoe bubbles.
      think: {
        bpm: 104,
        tracks: { mar: { ...tracks.mar, vol: 0.4 }, keys: tracks.keys, bass: { type: 'bass', mode: 'bass', cut: 500 }, bub: tracks.bub, dr: { type: 'drums', vol: 0.55 } },
        sections: {
          A: { bars: 8, chords: 'Amaj7 | G#m7 | F#m7 | Esus4 E | Amaj7 | G#m7 | F#m9 | B7sus4', mar: '1.3.2.4.1.3.2.4.', keys: 'x-------........', bass: '1 - - - 5 - - - | 1 - - - . . . .', bub: '. . c#6 . . . e6 . | . . b5 . . . d#6 . | . . a5 . . . c#6 . | . . g#5 . . . b5 . | . . c#6 . . . e6 . | . . b5 . . . d#6 . | . . g#5 . . . a5 . | f#5 - - - . . . .', dr: { k: 'x.......x.......', sh: '..x...x...x...x.', wb: '......x.......x.' } },
        },
        form: ['A'], loop: 0,
      },
      play: { from: 'title', bpm: 120, form: ['A', 'B'], loop: 0, sections: { A: { lead: false, mar: '1.2.3.4.3.2.1.2.', bub: '. . . . b5 . . . | . . . . d#6 . . . | . . . . c#6 . . . | . . . . f#6 . . .' } } },
      // Clock running out: pop-chase.
      tense: {
        bpm: 140,
        tracks: { bass: tracks.bass, pl: { type: 'pluck', mode: 'chord', center: 68, n: 3, vol: 0.32, dly: 0.12 }, lead: tracks.lead, dr: tracks.dr, clk: { type: 'drums', vol: 0.6 } },
        sections: {
          A: { bars: 4, chords: 'C#m | A | E | B', bass: '1 1 1 1 1 1 1 1', pl: 'x.x.x.x.x.x.x.x.', clk: { tick: 'x...x...x...x...' }, dr: { k: 'x...x...x...x...', c: '....x.......x...', h: 'xxxxxxxxxxxxxxxx' } },
          B: { bars: 4, chords: 'C#m | A | F#m | B7', bass: '1 1 1 1 1 1 1 1', pl: 'x.x.x.x.x.x.x.x.', lead: 'g#5 - - - e5 - - - | a5 - - - c#6 - - - | c#6 - - - a5 - - - | b5 - - - d#6 - - -', clk: { tick: 'x.x.x.x.x.x.x.x.' }, dr: { k: 'x...x...x...x...', c: '....x.......x...', h: 'xxxxxxxxxxxxxxxx', t3: '............xxxx|' } },
        },
        form: ['A', 'B'], loop: 0,
      },
      reveal: {
        bpm: 120,
        tracks: { keys: tracks.keys, glock: { type: 'glock', vol: 0.35 }, bass: tracks.bass, pad: tracks.pad, dr: tracks.dr },
        sections: {
          R: { bars: 4, chords: 'Amaj7 | B | C#m7 | B7sus4 B7', keys: 'x--.x--.x--.x-x-', pad: true, bass: '1 . 1 8 . 1 5 .', glock: 'e6 g#6 b6 - - - . . | f#6 b6 d#7 - - - . . | e6 g#6 c#7 - - - . . | b6 - - - a6 - - -', dr: { k: 'x...x...x...x...', c: '....x.......x...', h: '..x...x...x...x.' } },
        },
        form: ['R'], loop: 0,
      },
      finale: { from: 'title', bpm: 126, transpose: 1, form: ['I', 'A2', 'B', 'A2'] },
    },
    stingers: {
      correct: { bpm: 150, tracks: { b: { type: 'fmkeys', ratio: 2, index: 2 } }, parts: { b: 'e5 g#5 b5 e6 - - - -' } },
      first: { bpm: 150, tracks: { b: { type: 'fmkeys', ratio: 2, index: 2 }, g: { type: 'glock' } }, parts: { b: 'e5 g#5 b5 e6 g#6 - - -', g: '. . . . e7 - - -' } },
      pop: (X) => { X.tone({ dur: 0.08, f0: 600 + Math.random() * 300, f1: 1500, vol: 0.12 }); },
      boo: { bpm: 110, tracks: { l: { type: 'lead', wave: 'square', cut: 1500 } }, parts: { l: 'g4 - f#4 - f4 - - -' } },
      win: { bpm: 128, tracks: { l: { type: 'lead', wave: 'square', uni: true, cut: 3000 }, k: { type: 'fmkeys', mode: 'chord', center: 68, n: 4 }, d: { type: 'drums' } }, chords: 'A B | E', bars: 2, parts: { l: 'b4 e5 . g#5 . b5 . e6 | - - - - - - - -', k: 'x.x.x.x.x.x.x.x.|X---------------', d: { c: 'x.x.x.x.xxxxxxxx|x...............', y: '................|x...............' } } },
    },
    fx: { correct: 'correct', first: 'first', emoji: 'pop', boo: 'boo', win: 'win' },
    sfx: { win: 'win', drum: 'roll' },
  };
})();
