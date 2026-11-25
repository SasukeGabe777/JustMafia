'use strict';
// JustZombies: the synth fallback score (recorded CC0 tracks play the main cues:
// public/audio/music/games/trash/music.json). Garage punk in E minor: a driving synth bass in
// eighths, a buzzy lead, fast straight drums; a darker, slower take for the waiting moments.
(function () {
  const S = (window.BOX.scores = window.BOX.scores || {});
  const tracks = {
    sb: { type: 'synthbass', mode: 'bass', oct: 2, vol: 0.55 },
    gtr: { type: 'brass', mode: 'chord', center: 59, n: 3, vol: 0.32, att: 0.005, rel: 0.06 },
    lead: { type: 'fmkeys', ratio: 2, index: 2.4, vol: 0.42, pan: 0.12, dly: 0.12 },
    pad: { type: 'pad', mode: 'chord', center: 64, n: 3, vol: 0.2, cut: 1400 },
    dr: { type: 'drums', kit: 'std' },
  };
  const A = 'Em | Em | C | D | Em | Em | C | B7';
  const B = 'C | D | Em | Em | C | D | B7 | B7';
  const melA = 'e5 - e5 g5 - e5 d5 - | e5 - - - . . b4 d5 | e5 - e5 g5 - a5 g5 - | f#5 - - - . . . . | e5 - e5 g5 - e5 d5 - | e5 - - - . . g5 a5 | b5 - a5 g5 - e5 - g5 | f#5 - - - d#5 - - -';
  const melB = 'g5 - - - a5 - g5 - | f#5 - - - d5 - - - | e5 - g5 - b5 - a5 g5 | e5 - - - . . . . | g5 - - - a5 - b5 - | a5 - - - f#5 - - - | d#5 - f#5 - b5 - a5 - | f#5 - - - - - . .';
  const punk = { k: 'x.......x.x.....', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' };
  const drive = { k: 'x...x...x.x.x...', s: '....x.......x..x', h: 'xxxxxxxxxxxxxxxx' };
  S.trash = {
    name: 'JustZombies',
    cues: {
      title: {
        bpm: 156, tracks,
        sections: {
          I: { bars: 4, chords: 'Em | Em | C | B7', sb: '1 1 1 1 1 1 1 1', pad: true, dr: { k: 'x.......x.......', h: '....x.......x...', y: 'x...............' } },
          A: { bars: 8, chords: A, sb: '1 1 1 1 1 1 8 1', gtr: 'x.x.x.x.x.x.x.x.', lead: melA, dr: punk },
          B: { bars: 8, chords: B, sb: '1 1 1 1 5 5 5 5', gtr: 'x-x-x-x-x-x-x-x-', lead: melB, dr: drive },
        },
        form: ['I', 'A', 'B', 'A'], loop: 1,
      },
      lobby: { from: 'title', bpm: 140, form: ['A', 'B'], loop: 0, sections: { A: { lead: false, dr: { k: 'x.......x.......', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' } } } },
      intro: { from: 'title', bpm: 132, form: ['I', 'A'], loop: 1, sections: { A: { lead: false } } },
      think: {
        bpm: 96, tracks: { sb: { type: 'synthbass', mode: 'bass', oct: 2, vol: 0.45, cut: 700 }, pad: { type: 'pad', mode: 'chord', center: 60, n: 4, vol: 0.3, cut: 1100 }, bell: { type: 'glock', vol: 0.14, oct: 1 }, dr: { type: 'drums', kit: 'lofi', vol: 0.6 } },
        sections: { A: { bars: 8, chords: 'Em | Cmaj7 | Am | B7 | Em | Cmaj7 | Am | B7', sb: '1 - - - 1 - 5 .', pad: true, bell: 'e5 . . . b4 . . . | . . . . . . . . | a4 . . . c5 . . . | . . . . d#5 . . .', dr: { k: 'x.......x.x.....', s: '....g.......g...', h: '..x...x...x...x.' } } },
        form: ['A'], loop: 0,
      },
      play: { from: 'title', bpm: 160, form: ['A', 'B'], loop: 0 },
      action: { from: 'title', bpm: 168, form: ['A', 'B'], loop: 0 },
      tense: {
        bpm: 172,
        tracks: { sb: { type: 'synthbass', mode: 'bass', oct: 2, vol: 0.55 }, str: { type: 'strings', mode: 'chord', center: 60, n: 3, vol: 0.4, att: 0.01, rel: 0.08 }, lead: { type: 'brass', vol: 0.35 }, dr: { type: 'drums', kit: 'std' } },
        sections: {
          A: { bars: 8, chords: 'Em | Em | F | F | Em | Em | F | B7', sb: '1 1 1 1 1 1 1 1', str: 'x..x..x.x..x..x.', dr: { k: 'x...x...x...x...', s: '....x.......x...', h: 'xxxxxxxxxxxxxxxx' } },
          B: { bars: 8, chords: 'Em | F | Em | F | C | B7 | C | B7', sb: '1 1 8 1 1 8 1 5', str: 'x..x..x.x..x..x.', lead: 'e5 - - - f5 - - - | e5 - - - f5 - - - | g5 - - - f5 - e5 - | d#5 - - - - - - -', dr: drive },
        },
        form: ['A', 'B'], loop: 0,
      },
      reveal: { from: 'title', bpm: 150, form: ['B'], loop: 0 },
      lose: {
        bpm: 70, tracks: { pad: { type: 'pad', mode: 'chord', center: 60, n: 4, vol: 0.35, cut: 900 }, bell: { type: 'glock', vol: 0.16 } },
        sections: { A: { bars: 8, chords: 'Em | Cmaj7 | Am | B7 | Em | Cmaj7 | Am6 | B7', pad: true, bell: 'e5 - - - d5 - b4 - | c5 - - - - - - - | a4 - - - c5 - e5 - | d#5 - - - - - - -' } },
        form: ['A'], loop: 0,
      },
      finale: { from: 'title', bpm: 148, transpose: 0, form: ['B', 'A'], loop: 0 },
    },
    stingers: {
      win: { bpm: 150, tracks: { b: { type: 'brass', vol: 0.55 }, d: { type: 'drums', kit: 'std' } }, bars: 2, parts: { b: 'e4+g4+b4 . e4+g4+b4 . d4+f#4+a4 - c4+e4+g4 - | e4+g4+b4+e5 - - - - - - -', d: { s: 'x.x.x.....x.....', y: '................|x...............' } } },
      lvl: { bpm: 170, tracks: { g: { type: 'fmkeys', ratio: 2, index: 2 } }, bars: 1, parts: { g: 'e5 g5 b5 e6 - - - -' } },
      reveal: { bpm: 140, tracks: { b: { type: 'brass', vol: 0.5 }, d: { type: 'drums', kit: 'std' } }, bars: 1, parts: { b: 'e4+b4+e5 - - - - - - -', d: { k: 'x', y: 'x' } } },
      good: { bpm: 160, tracks: { g: { type: 'fmkeys', ratio: 2, index: 1.6 } }, bars: 1, parts: { g: 'b4 e5 g5 b5 - - - -' } },
      bad: { bpm: 100, tracks: { b: { type: 'mute' } }, bars: 1, parts: { b: 'e4 - d#4 - d4 - - -' } },
      round: { bpm: 150, tracks: { b: { type: 'pluck', dly: 0.3 } }, bars: 1, parts: { b: 'e5 b5 e6 . . . . .' } },
    },
    sfx: {},
  };
})();
