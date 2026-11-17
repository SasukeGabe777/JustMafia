'use strict';
// Bomb Squad soundtrack: a twangy E-minor spy-surf theme (reverb guitar, combo organ, upright
// bass, brushed kit) over a ticking clock. Defusing grooves on a pulsing synth bass with a
// tick-tock that never stops; the last ten seconds double-time it. Original composition.
//   title  the main theme · lobby  a laid-back take · intro  the theme, punchier
//   think  defusing (the main bomb groove) · play  the briefing · tense  the last ten seconds
//   reveal drumroll then the verdict · finale  the mission report
(function () {
  const S = (window.BOX.scores = window.BOX.scores || {});
  const tracks = {
    gtr: { type: 'guitar', vol: 0.5, pan: 0.15, dly: 0.22, rev: 0.3 },
    org: { type: 'organ', mode: 'chord', center: 62, n: 3, vol: 0.22, pan: -0.2 },
    bass: { type: 'upright', mode: 'bass', oct: 2, vol: 0.6 },
    vib: { type: 'vibes', vol: 0.22, pan: 0.3, oct: 1 },
    tk: { type: 'drums', vol: 0.45 },
    dr: { type: 'drums', kit: 'jazz' },
  };
  const A = 'Em | Em | Cmaj7 | B7 | Em | Em | Am7 | B7sus4 B7';
  const B = 'Am7 | D7 | Gmaj7 | Cmaj7 | Am7 | B7 | Em | B7';
  const melA = 'e4 . g4 . a4 bb4 b4 . | e5 - d5 b4 - . . . | c5 - b4 a4 - g4 - . | f#4 - - - b4 - - . | e4 . g4 . a4 bb4 b4 . | g5 - f#5 e5 - b4 - . | c5 - e5 - a4 - c5 - | b4 - - - d#5 - f#5 -';
  const melB = 'a4 - c5 e5 - d5 - c5 | d5 - - - f#5 - - . | g5 - f#5 d5 - b4 - . | e5 - - - - - . . | c5 - e5 a5 - g5 - e5 | f#5 - d#5 - b4 - a4 - | g4 - b4 e5 - - g5 - | f#5 - - - - - . .';
  const tick = { tick: 'x...x...x...x...', tock: '..x...x...x...x.' };
  const swing = { k: 'x.......x.x.....', s: '....x.......x...', h: 'x.x.x.x.x.x.x.xo' };
  S.bomb = {
    name: 'bomb',
    cues: {
      title: {
        bpm: 124, swing16: 0.53, tracks,
        sections: {
          I: { bars: 4, chords: 'Em | Em | Em | B7', org: true, bass: '1 . . 1 . . 5 . | 1 . . 1 5 . b7 .', tk: tick, gtr: 'e3 . . e3 . . e3 . | e3 . . e3 . . g3 bb3 | e3 . . e3 . . e3 . | b3 - - - d#4 - f#4 -', dr: { y: 'x...............|................|................|............x.x.' } },
          A: { bars: 8, chords: A, org: '..x...x...x...x.', bass: '1 . . 1 5 . 8 . | 1 . 5 . b7 . 5 .', gtr: melA, tk: tick, dr: swing },
          B: { bars: 8, chords: B, org: 'x---..x-x---..x-', bass: '1 - . 5 1 - 5 . | 1 . 3 . 5 . a .', gtr: melB, vib: '. . . . e5 . . . | . . . . b4 . . .', tk: tick, dr: { k: 'x.......x.x.....', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.', r: 'x...x...x...x...' } },
          A2: { bars: 8, chords: A, org: '..x...x...x...x.', bass: '1 . . 1 5 . 8 . | 1 . 5 . b7 . 5 .', gtr: melA, vib: melA, tk: tick, dr: { ...swing, sh: 'xgxgxgxgxgxgxgxg' } },
        },
        form: ['I', 'A', 'B', 'A2'], loop: 1,
      },
      lobby: { from: 'title', bpm: 112, tracks: { gtr: { vol: 0.32 } }, form: ['A', 'B'], loop: 0,
        sections: { A: { gtr: false, vib: '. . . . e5 . . . | . . . . g5 . . . | . . . . e5 . . . | . . . . f#5 . . .', dr: { k: 'x.......x.......', s: '....g.......x...', h: '..x...x...x...x.' } }, B: { dr: { k: 'x.......x.......', s: '....x.......x...', h: '..x...x...x...x.' } } } },
      intro: { from: 'title', bpm: 128, form: ['I', 'A', 'B', 'A2'] },
      think: {
        bpm: 112,
        tracks: { sb: { type: 'synthbass', mode: 'bass', oct: 2, vol: 0.5, cut: 900 }, pad: { type: 'pad', mode: 'chord', center: 64, n: 3, vol: 0.22, cut: 1300 }, mar: { type: 'marimba', mode: 'chord', center: 72, n: 3, vol: 0.28, pan: 0.25, dly: 0.25 }, pl: { type: 'pluck', vol: 0.3, pan: -0.25, dly: 0.3 }, tk: { type: 'drums', vol: 0.55 }, dr: { type: 'drums', kit: 'lofi', vol: 0.6 } },
        sections: {
          A: { bars: 8, chords: 'Em | Em | Cmaj7 | Cmaj7 | Am7 | Am7 | B7sus4 | B7', sb: '1 1 1 1 1 1 5 1', pad: true, mar: '1.2.3...1.2.3...', tk: tick, dr: { k: 'x.......x.......', h: '..x...x...x...x.' } },
          B: { bars: 8, chords: 'Em | Em | Cmaj7 | Cmaj7 | Am7 | Am7 | B7sus4 | B7', sb: '1 1 1 1 1 1 5 1', pad: true, mar: '3.2.1...3.2.1.2.', pl: 'e5 . . . g5 . . . | b5 . . . . . . . | e5 . . . g5 . . . | b5 . a5 . g5 . . . | a5 . . . c6 . . . | e6 . . . . . . . | d#6 . . . c6 . . . | b5 . . . . . . .', tk: tick, dr: { k: 'x.......x.x.....', s: '....g.......x...', h: 'x.x.x.x.x.x.x.x.' } },
        },
        form: ['A', 'B'], loop: 0,
      },
      play: { from: 'think', bpm: 118, tracks: { br: { type: 'brass', mode: 'chord', center: 64, n: 3, vol: 0.32 } },
        sections: { A: { br: 'x.......x.......', dr: { k: 'x...x...x...x...', s: '........x.......', h: 'x.x.x.x.x.x.x.x.' } }, B: { br: 'x.....x.........', dr: { k: 'x...x...x...x...', s: '....x.......xxxx', h: 'x.x.x.x.x.x.x.x.' } } } },
      tense: {
        bpm: 150,
        tracks: { sb: { type: 'synthbass', mode: 'bass', oct: 2, vol: 0.55 }, str: { type: 'strings', mode: 'chord', center: 64, n: 3, vol: 0.38, att: 0.02, rel: 0.1 }, tk: { type: 'drums', vol: 0.6 }, dr: { type: 'drums', kit: 'std' }, lead: { type: 'lead', vol: 0.28 } },
        sections: {
          A: { bars: 8, chords: 'Em | Em | C | C | Am | Am | B7 | B7', sb: '1 1 1 1 1 1 1 1', str: 'x.xx.xx.x.xx.xx.', tk: { tick: 'x.x.x.x.x.x.x.x.', tock: '.x.x.x.x.x.x.x.x' }, dr: { k: 'x...x...x...x...', s: '....x.......x...', t1: '..............xx' } },
          B: { bars: 8, chords: 'Em | Em | C | C | Am | Am | B7 | B7', sb: '1 1 1 1 1 1 1 1', str: 'x.xx.xx.x.xx.xx.', lead: 'b5 - b5 - b5 - c6 b5 | b5 - - - - - . . | c6 - c6 - c6 - d6 c6 | c6 - - - - - . . | a5 - a5 - a5 - b5 a5 | a5 - - - - - . . | b5 - a5 - g5 - f#5 - | d#5 - - - - - . .', tk: { tick: 'xxxxxxxxxxxxxxxx' }, dr: { k: 'x...x...x...x...', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' } },
        },
        form: ['A', 'B'], loop: 0,
      },
      reveal: {
        bpm: 108,
        tracks: { br: { type: 'brass', mode: 'chord', center: 66, n: 4, vol: 0.5 }, str: { type: 'strings', mode: 'chord', center: 64, n: 4, vol: 0.4 }, bass: { type: 'bass', mode: 'bass' }, tp: { type: 'timp', vol: 0.5 }, dr: { type: 'drums', kit: 'orch' } },
        sections: {
          R: { bars: 2, chords: 'B7sus4 | B7', str: 'x-------x-------', tp: 'b2 b2 b2 b2 b2 b2 b2 b2 | b2 b2 b2 b2 f#2 f#2 f#2 f#2', dr: { s: '2323434545656767|7878989899999999' } },
          H: { bars: 4, chords: 'E | A/E | E | B7', br: 'X-----x-x---x---', str: true, bass: '1 - - - 5 - 1 .', dr: { k: 'x.......x.......', y: 'x...............', s: '....x.......x...' } },
        },
        form: ['R', 'H'], loop: 1,
      },
      finale: { from: 'title', bpm: 126, tracks: { br: { type: 'brass', mode: 'chord', center: 66, n: 3, vol: 0.36 } },
        sections: { A: { br: '....x.x.....x...' }, B: { br: 'x.......x.......' }, A2: { br: '....x.x.....x...' } } },
    },
    stingers: {
      win: { bpm: 120, tracks: { b: { type: 'brass', vol: 0.6 }, g: { type: 'glock', vol: 0.4 }, d: { type: 'drums', kit: 'orch' } }, bars: 2, parts: { b: 'e4+g#4+b4 . e4+g#4+b4 f#4+a4+c#5 - - e4+g#4+b4 - | e4+g#4+b4+e5 - - - - - - -', g: 'b5 . b5 c#6 - - b5 - | e6 - - - - - - -', d: { s: 'x.x.x.....x.....', y: '................|x...............' } } },
      defused: { bpm: 132, tracks: { b: { type: 'brass', vol: 0.55 }, v: { type: 'vibes', vol: 0.4 }, d: { type: 'drums', kit: 'orch' } }, bars: 1, parts: { b: 'b4+e5 . b4+e5 . e5+g#5+b5 - - -', v: 'e6 g#6 b6 e7 - - - -', d: { s: 'x.x.x...', y: '....x...' } } },
      strike: { bpm: 140, tracks: { b: { type: 'brass', vol: 0.6 } }, bars: 1, parts: { b: 'bb3 - a3 - - - . .' } },
      solve: { bpm: 150, tracks: { g: { type: 'vibes', vol: 0.55 } }, bars: 1, parts: { g: 'b5 e6 - - . . . .' } },
      radio: { bpm: 160, tracks: { s: { type: 'fmkeys', ratio: 2, index: 2.2, vol: 0.55 } }, bars: 1, parts: { s: 'a5 . a5 . a5 . . .' } },
      round: { bpm: 120, tracks: { b: { type: 'brass', vol: 0.5 }, d: { type: 'drums', kit: 'orch' } }, bars: 1, parts: { b: 'e4+b4 . e4+b4 . g4+d5 - - -', d: { s: 'x.x.x...' } } },
    },
    fx: { defused: 'defused', strike: 'strike', solve: 'solve', radio: 'radio', round: 'round' },
    sfx: {},
  };
})();
