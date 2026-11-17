'use strict';
// JustGameBox main menu: the house theme. Bright D-major party funk, 116 bpm: electric
// piano, brass + glockenspiel hook, slap synth bass, four-on-the-floor with claps.
(function () {
  const S = (window.BOX.scores = window.BOX.scores || {});
  const tracks = {
    ep: { type: 'epiano', mode: 'chord', center: 64, n: 4, vol: 0.42, pan: -0.2, trem: 0.2 },
    hook: { type: 'brass', vol: 0.4, bright: 1.15, pan: 0.1 },
    glock: { type: 'glock', vol: 0.2, pan: 0.3, oct: 1 },
    sax: { type: 'sax', vol: 0.38, pan: -0.15 },
    str: { type: 'strings', mode: 'chord', center: 67, n: 4, vol: 0.22, att: 0.5 },
    bass: { type: 'synthbass', mode: 'bass', oct: 2, vol: 0.48, q: 5 },
    stab: { type: 'brass', mode: 'chord', center: 66, n: 4, vol: 0.3 },
    dr: { type: 'drums', kit: 'funk' },
  };
  const A = 'Dmaj7 | Bm7 | Gmaj7 | A7sus4 A7 | Dmaj7 | F#7 | Bm7 E7 | Gmaj7 A7';
  const B = 'Gmaj7 | F#m7 | Em7 | Dmaj7 | Gmaj7 | F#m7 | Em7 | A7sus4';
  const hook = 'a4 d5 . f#5 . a5 - c#6 | b5 - a5 f#5 - d5 - . | g5 . b5 . d6 - f#5 - | e5 - - - . c#5 e5 g5 | a4 d5 . f#5 . a5 - d6 | c#6 - a#5 f#5 - e5 - . | d5 - f#5 - g#5 - b5 - | a5 - - - g5 - e5 -';
  const tuneB = 'b5 - - - a5 - f#5 - | a5 - - - e5 - c#5 - | d5 - - - e5 - g5 - | f#5 - - - - - . . | b5 - - - d6 - b5 - | c#6 - - - a5 - f#5 - | g5 - - - b5 - d6 - | e6 - - - - - . .';
  const four = { k: 'x...x...x...x...', c: '....x.......x...', h: '..x...x...x...x.', sh: 'xgxgxgxgxgxgxgxg' };
  S.menu = {
    name: 'JustGameBox',
    cues: {
      title: {
        bpm: 116, swing16: 0.54, tracks,
        sections: {
          I: { bars: 4, chords: 'Gmaj7 | A/G | F#m7 | Bm7', ep: 'x--.x--.x--.x-x-', str: true, glock: 'd5 . f#5 . a5 . . . | c#5 . e5 . a5 . . . | c#5 . e5 . a5 . . . | d5 . f#5 . b5 . . .', dr: { k: 'x.......x.......', h: '..x...x...x...x.', c: '................|................|................|....x...x.x.xxxx' } },
          A: { bars: 8, chords: A, ep: '..x-..x-..x-.x-.', bass: '1 . 1 8 . 1 5 7', hook, dr: four },
          B: { bars: 8, chords: B, ep: 'x--.x--.x--.x-x-', str: true, bass: '1 - . 1 5 - 8 .', sax: tuneB, stab: '................|................|................|..............x.', dr: { ...four, o: '..............x.' } },
          A2: { bars: 8, chords: A, ep: '..x-..x-..x-.x-.', str: true, bass: '1 . 1 8 . 1 5 7', hook, glock: hook, dr: { ...four, h: 'x.x.x.x.x.x.x.x.', y: 'x' + '.'.repeat(127) } },
        },
        form: ['I', 'A', 'B', 'A2'], loop: 1,
      },
      lobby: { from: 'title', bpm: 108, form: ['A', 'B'], loop: 0, sections: { A: { hook: false, glock: { p: hook, vol: 0.7 } } } },
    },
    stingers: {
      open: { bpm: 140, tracks: { g: { type: 'glock' }, b: { type: 'brass', mode: 'chord', center: 66, n: 4 } }, chords: 'Dmaj7', parts: { g: 'a5 d6 f#6 a6 - - - -', b: '........X-------' } },
    },
    sfx: { start: 'open' },
  };
})();
