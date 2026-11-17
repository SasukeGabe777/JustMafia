'use strict';
// Blanks: a late-night talk-show / comedy-club band in Eb. Swinging piano, walking bass,
// ride cymbal and a cheeky muted trumpet; a rimshot for every punchline.
(function () {
  const S = (window.BOX.scores = window.BOX.scores || {});
  const tracks = {
    pno: { type: 'piano', mode: 'chord', center: 62, n: 4, rootless: true, vol: 0.42, pan: -0.18 },
    tp: { type: 'mute', vol: 0.5, pan: 0.2 },
    sax: { type: 'sax', vol: 0.4, pan: -0.1 },
    org: { type: 'organ', mode: 'chord', center: 64, n: 4, vol: 0.2, trem: 0.3, tremHz: 6 },
    bass: { type: 'upright', mode: 'bass', oct: 2 },
    stab: { type: 'brass', mode: 'chord', center: 66, n: 4, vol: 0.32 },
    dr: { type: 'drums', kit: 'jazz' },
  };
  const A = 'Ebmaj7 C7 | Fm7 Bb7 | Gm7 C7 | Fm7 Bb7 | Ebmaj7 Eb7 | Abmaj7 Db7 | Gm7 C7b9 | Fm7 Bb7';
  const B = 'Abmaj7 | Abm6 | Gm7 | C7 | Fm7 | Bb7 | Ebmaj7 | Bb7sus4';
  const tune = 'g5 - bb5 - . g5 e5 - | f5 - - - d5 - bb4 - | f5 - g5 - . f5 e5 - | eb5 - - - . . . . | g5 - bb5 - . db6 c6 - | c6 - - - b5 - ab5 - | g5 - f5 - e5 - db5 - | d5 - - - f5 - ab5 -';
  const tuneB = 'c6 - - - eb6 - c6 - | cb6 - - - ab5 - - - | bb5 - - - g5 - d5 - | e5 - - - g5 - bb5 - | ab5 - - - f5 - c5 - | d5 - - - - - . . | g5 - - - bb5 - d6 - | c6 - - - bb5 - - -';
  const swing = { k: 'g.......g.......', r: 'x...x.x.x...x.x.', h: '....x.......x...', s: '......g.......g.' };
  S.blanks = {
    name: 'Blanks',
    cues: {
      title: {
        bpm: 132, swing: 0.64, tracks,
        sections: {
          I: { bars: 4, chords: 'Bb7 | Bb7 | Bb7 | Bb7', stab: 'X-.X-.X-........|X-.X-.X-........|X-.X-.X-........|X-----------....', bass: '1 . . . . . . . | 1 . . . . . . . | 1 . . . . . . . | 1 - - - 5 - - -', dr: { s: 'X..X..X.........|X..X..X.........|X..X..X.........|X.......xxxxXXXX', y: 'x...............' } },
          A: { bars: 8, chords: A, pno: 'x-.....x-.......', bass: 'walk', tp: tune, dr: swing },
          B: { bars: 8, chords: B, pno: 'x-.....x-.......', org: true, bass: 'walk', sax: tuneB, dr: swing },
          A2: { bars: 8, chords: A, pno: 'x-.....x-.......', bass: 'walk', tp: tune, sax: { p: tune, oct: -1, vol: 0.3 }, stab: '................|................|................|....x.x.........|................|................|................|X.X.............', dr: { ...swing, y: 'x...............' } },
        },
        form: ['I', 'A', 'B', 'A2'], loop: 1,
      },
      lobby: { from: 'title', bpm: 120, form: ['A', 'B'], loop: 0, mute: ['stab'], tracks: { tp: { vol: 0.38 } } },
      intro: { from: 'title', bpm: 136 },
      // Picking a card: noodling piano trio.
      think: {
        bpm: 112, swing: 0.62,
        tracks: { pno: tracks.pno, mel: { type: 'piano', vol: 0.42, pan: 0.15 }, bass: tracks.bass, dr: { ...tracks.dr, vol: 0.55 } },
        sections: {
          A: { bars: 8, chords: 'Ebmaj7 | Cm7 | Fm7 | Bb7 | Gm7 | C7 | Fm7 | Bb7', pno: '..x-......x-....', bass: 'walk', mel: '. . g5 - bb5 - d6 - | c6 - - - g5 - eb5 - | . . ab5 - c6 - eb6 - | d6 - - - . . . . | . . bb5 - d6 - f6 - | e6 - - - c6 - g5 - | ab5 - g5 - f5 - eb5 - | d5 - - - . . . .', dr: { k: 'g.......g.......', br: 'x.x.x.x.x.x.x.x.', h: '....x.......x...' } },
        },
        form: ['A'], loop: 0,
      },
      play: { from: 'title', bpm: 124, form: ['A', 'B'], loop: 0, sections: { A: { tp: { p: tune, vol: 0.35 } } } },
      // The judge chooses: a drum-and-bass vamp.
      tense: {
        bpm: 140, swing: 0.6,
        tracks: { bass: tracks.bass, stab: tracks.stab, pno: tracks.pno, dr: tracks.dr, clk: { type: 'drums', vol: 0.5 } },
        sections: {
          A: { bars: 4, chords: 'Cm7 | F7 | Cm7 | F7', bass: 'walk', pno: '..x...x...x...x.', clk: { tick: 'x...x...x...x...' }, dr: { r: 'x...x.x.x...x.x.', t1: 'x.......x.......', h: '....x.......x...' } },
          B: { bars: 4, chords: 'Fm7 | Bb7 | Ebmaj7 | Bb7', bass: 'walk', stab: '..x.............|..x.............|..x.............|..x...x...x...x.', pno: '..x...x...x...x.', clk: { tick: 'x.x.x.x.x.x.x.x.' }, dr: { r: 'x...x.x.x...x.x.', s: '..............gg', h: '....x.......x...' } },
        },
        form: ['A', 'B'], loop: 0,
      },
      reveal: {
        bpm: 126, swing: 0.62,
        tracks: { stab: { ...tracks.stab, vol: 0.42 }, pno: tracks.pno, tp: tracks.tp, bass: tracks.bass, dr: tracks.dr },
        sections: { R: { bars: 4, chords: 'Ebmaj7 | Cm7 F7 | Bb7 | Ebmaj7', stab: 'X--.....x.X.....|................|X---------------|X---------------', pno: 'x-.....x-.......', tp: 'g5 bb5 eb6 - - - . . | c6 - - - a5 - - - | ab5 - - - f5 - d5 - | eb5 - - - - - - -', bass: 'walk', dr: { ...swing, y: 'x...............' } } },
        form: ['R'], loop: 0,
      },
      finale: { from: 'title', bpm: 136, transpose: 2, form: ['I', 'A2', 'B', 'A2'] },
    },
    stingers: {
      win: { bpm: 140, swing: 0.62, tracks: { s: { type: 'brass', mode: 'chord', center: 67, n: 4 }, t: { type: 'mute' }, d: { type: 'drums', kit: 'jazz' } }, chords: 'Bb7 | Ebmaj7', bars: 2, parts: { t: 'f5 g5 bb5 d6 - c6 - bb5 | g5 - - - - - - -', s: '................|X---------------', d: { s: '....x.......x...|X...............', y: '................|x...............' } } },
      winner: { bpm: 140, tracks: { t: { type: 'mute' } }, parts: { t: 'bb4 eb5 g5 bb5 - - . .' } },
      random: { bpm: 110, tracks: { t: { type: 'mute' } }, parts: { t: 'g5 - f#5 - f5 - - -' } },
    },
    fx: { win: 'win', gavel: 'rimshot' },
    sfx: { win: 'win', drum: 'roll', shrug: 'random' },
  };
})();
