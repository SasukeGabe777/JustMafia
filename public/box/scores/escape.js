'use strict';
// JustEscape score: film-noir jazz in C minor for Hazel Finch's rainy city. A slow minor swing
// (walking upright bass, brushes, rootless piano, a muted trumpet melody with vibes answering),
// a sparse late-night bed under Hazel's story, a minor-blues investigating groove that tightens
// in the last seconds (tenseFrom: play), a timpani unmasking and a warm brass case-closed.
// Format and tips: public/box/scores/README.md.
(function () {
  const S = (window.BOX.scores = window.BOX.scores || {});
  const tracks = {
    pno: { type: 'piano', mode: 'chord', center: 60, n: 4, rootless: true, vol: 0.56, pan: -0.2 },
    tp: { type: 'mute', vol: 0.68, pan: 0.18, dly: 0.14 },
    vib: { type: 'vibes', vol: 0.52, pan: 0.28, dly: 0.12 },
    bass: { type: 'upright', mode: 'bass', oct: 2, vol: 1.15 },
    pad: { type: 'pad', mode: 'chord', center: 62, n: 4, vol: 0.16, cut: 1200 },
    dr: { type: 'drums', kit: 'jazz' },
  };
  const A = 'Cm9 | Fm9 | Dm7b5 G7b9 | Cm9 | Abmaj7 | Fm7 | Dm7b5 | G7b9';
  const B = 'Ebmaj7 | Abmaj7 | Dm7b5 | G7b9 | Cm7 | F7 | Abmaj7 | G7#9';
  const melA = 'g4 - - - c5 - eb5 - | d5 - - - c5 - . . | ab4 - - - f4 - g4 - | b4 - - - - - . . | g4 - c5 - eb5 - g5 - | f5 - - - eb5 - c5 - | ab4 - f4 - d4 - ab4 - | g4 - - - - - . .';
  const melB = 'bb4 - - - g4 - eb4 - | c5 - - - - - ab4 - | ab4 - f4 - d4 - ab4 - | g4 - - - b4 - d5 - | eb5 - - - c5 - g4 - | a4 - - - c5 - eb5 - | d5 - - - c5 - ab4 - | g4 - - - - - . .';
  const answer = '. . . . . . . . | . . . . g5 eb5 c5 . | . . . . . . . . | . . . . f5 d5 b4 . | . . . . . . . . | . . . . ab5 f5 c5 . | . . . . . . . . | . . . . d5 b4 g4 .';
  const brush = { k: 'g.......g.......', br: 'x.x.x.x.x.x.x.x.', h: '....x.......x...', s: '..........g.....' };
  const ride = { k: 'g.......g.......', r: 'x...x.x.x...x.x.', h: '....x.......x...', s: '......g...g.....' };
  const charleston = 'x-.....x-.......';
  // the investigating groove: a minor blues riff
  const BLUES = 'Cm7 | Cm7 | Cm7 | Cm7 | Fm7 | Fm7 | Cm7 | Cm7 | Ab7 | G7 | Cm7 | G7#9';
  const riff = 'c5 . eb5 f5 - gb5 g5 - | . . . . bb4 - c5 . | c5 . eb5 f5 - gb5 g5 - | eb5 - - - c5 - . . | f5 . ab5 bb5 - b5 c6 - | . . . . eb5 - f5 . | c5 . eb5 f5 - gb5 g5 - | . . . . . . . . | ab5 - - - gb5 - eb5 - | g5 - - - f5 - d5 - | c5 . eb5 f5 - gb5 g5 - | b4 - - - d5 - f5 -';
  S.escape = {
    name: 'escape',
    tenseFrom: ['play'],
    cues: {
      title: {
        bpm: 84, swing: 0.64, tracks,
        sections: {
          I: { bars: 4, chords: 'Abmaj7 | G7b9 | Abmaj7 | G7#9', pad: true, pno: 'x-------x-------', vib: 'eb6 - c6 - g5 - eb5 - | d5 - - - b4 - - - | eb6 - c6 - ab5 - eb5 - | f5 - - - . . . .', bass: '1 - - - 5 - - - | 1 - - - 5 - - .', dr: { br: 'x.x.x.x.x.x.x.x.', k: 'g...............' } },
          A: { bars: 8, chords: A, pno: charleston, bass: 'walk', tp: melA, dr: brush },
          B: { bars: 8, chords: B, pno: charleston, bass: 'walk', tp: melB, vib: answer, dr: { ...brush, s: '......g...g.....' } },
          A2: { bars: 8, chords: A, pno: charleston, bass: 'walk', tp: melA, vib: answer, pad: true, dr: ride },
        },
        form: ['I', 'A', 'B', 'A2'], loop: 1,
      },
      lobby: { from: 'title', bpm: 78, form: ['A', 'B'], loop: 0, sections: { A: { tp: false, vib: melA, dr: brush }, B: { tp: false, vib: melB, dr: brush } } },
      intro: { from: 'title', bpm: 86 },
      // Under Hazel's story: rain-on-the-window quiet, sparse piano and vibes.
      think: {
        bpm: 70, swing: 0.62,
        tracks: { pno: { type: 'piano', mode: 'chord', center: 60, n: 4, rootless: true, vol: 0.55, pan: -0.15 }, vib: { type: 'vibes', vol: 0.45, pan: 0.25, dly: 0.25 }, bass: { type: 'upright', mode: 'bass', oct: 2, vol: 1.2 }, pad: { type: 'pad', mode: 'chord', center: 62, n: 4, vol: 0.3, cut: 1000 }, dr: { type: 'drums', kit: 'jazz', vol: 0.7 } },
        sections: {
          A: { bars: 8, chords: 'Cm9 | Cm9 | Abmaj7 | Abmaj7 | Fm9 | Fm9 | Dm7b5 | G7b9', pno: 'x---------------', pad: true, bass: '1 - - - - - - - | 5 - - - - - - .', vib: '. . . . . . . . | . . g5 - - - . . | . . . . . . . . | . . eb5 - - - . . | . . . . . . . . | . . c6 - - - . . | . . . . . . . . | . . b5 - - - . .', dr: { br: 'x.x.x.x.x.x.x.x.', k: 'g...............' } },
        },
        form: ['A'], loop: 0,
      },
      // Investigating: a swung minor blues, sax riff and muted trumpet answers.
      play: {
        bpm: 104, swing: 0.62,
        tracks: { pno: tracks.pno, sax: { type: 'sax', vol: 0.55, pan: 0.15 }, tp: { type: 'mute', vol: 0.32, pan: -0.25, dly: 0.12 }, bass: tracks.bass, vib: { type: 'vibes', vol: 0.28, pan: 0.3 }, dr: { type: 'drums', kit: 'jazz' } },
        sections: {
          A: { bars: 12, chords: BLUES, pno: charleston, bass: 'walk', sax: riff, dr: ride },
          B: { bars: 12, chords: BLUES, pno: '..x...x...x...x.', bass: 'walk', tp: riff, vib: '. . . . . . . . | . . . . g5 . c6 . | . . . . . . . . | . . . . . . . .', dr: { ...ride, s: '....g..g....g..g' } },
        },
        form: ['A', 'B'], loop: 0,
      },
      // The last seconds: a ticking ostinato.
      tense: {
        bpm: 136, swing: 0.56,
        tracks: { ost: { type: 'upright', vol: 0.8 }, pno: { type: 'piano', mode: 'chord', center: 60, n: 3, vol: 0.36 }, tp: { type: 'mute', vol: 0.45 }, str: { type: 'strings', mode: 'chord', center: 64, n: 3, vol: 0.28, att: 0.02, rel: 0.1 }, dr: { type: 'drums', kit: 'jazz' }, clk: { type: 'drums', vol: 0.6 } },
        sections: {
          A: { bars: 4, chords: 'Cm | Db/C | Cm | Db/C', ost: 'c2 . g2 . c2 . db2 . | c2 . g2 . c2 . db2 .', pno: '..x...x...x...x.', clk: { tick: 'x...x...x...x...' }, dr: { r: 'x.x.x.x.x.x.x.x.', k: 'x.......x.......' } },
          B: { bars: 4, chords: 'Cm | Db/C | Fm | G7b9', ost: 'c2 . g2 . c2 . db2 . | c2 . g2 . c2 . db2 .', pno: '..x...x...x...x.', str: 'x.......x.......', tp: 'g5 - - - ab5 - - - | g5 - - - . . . . | ab5 - - - f5 - c5 - | b4 - - - d5 - f5 -', clk: { tick: 'x.x.x.x.x.x.x.x.' }, dr: { r: 'x.x.x.x.x.x.x.x.', t1: 'x...x...x...x...', k: 'x.......x.......', s: '....g..g....g..g' } },
        },
        form: ['A', 'B'], loop: 0,
      },
      // Unmasking the culprit.
      reveal: {
        bpm: 92,
        tracks: { str: { type: 'strings', mode: 'chord', center: 62, n: 4, vol: 0.4 }, br: { type: 'brass', mode: 'chord', center: 62, n: 4, vol: 0.42 }, bass: { type: 'upright', mode: 'bass', oct: 2 }, tp: { type: 'timp', vol: 0.5 }, vib: { type: 'vibes', vol: 0.35 }, dr: { type: 'drums', kit: 'orch' } },
        sections: {
          R: { bars: 2, chords: 'Dm7b5 | G7b9', str: 'x-------x-------', tp: 'g2 g2 g2 g2 g2 g2 g2 g2 | g2 g2 g2 g2 d2 d2 d2 d2', dr: { s: '2323434545656767|7878989899999999' } },
          H: { bars: 4, chords: 'Cm9 | Abmaj7 | Dm7b5 | G7#9', br: 'X-------x---x---', str: true, bass: '1 - - - 5 - - .', vib: 'g5 - eb5 - c5 - . . | ab5 - eb5 - c5 - . . | f5 - d5 - ab4 - . . | b4 - - - - - . .', dr: { k: 'x.......x.......', y: 'x...............' } },
        },
        form: ['R', 'H'], loop: 1,
      },
      // Case closed: the theme again, warmer, with brass.
      finale: { from: 'title', bpm: 90, tracks: { br: { type: 'brass', mode: 'chord', center: 64, n: 3, vol: 0.32 } },
        sections: { A: { br: '....x.x.....x...' }, B: { br: 'x.......x.......' }, A2: { br: '....x.x.....x...' } } },
    },
    stingers: {
      // A lock clicks open: a rim click, then a chime.
      unlock: { bpm: 140, tracks: { c: { type: 'drums', kit: 'jazz' }, g: { type: 'chime', vol: 0.5 }, v: { type: 'vibes', vol: 0.4 } }, bars: 1, parts: { c: { rim: 'x.x.............' }, g: '. . c6 - g6 - - -', v: '. . c5+eb5+g5 - - - - -' } },
      wrong: { bpm: 100, tracks: { b: { type: 'mute', vol: 0.55 }, u: { type: 'upright', vol: 0.7 } }, bars: 1, parts: { b: 'eb4 - d4 - db4 - - -', u: '. . . . c2 - - -' } },
      caught: { bpm: 112, tracks: { b: { type: 'brass', vol: 0.55 }, tp: { type: 'timp', vol: 0.5 }, g: { type: 'vibes', vol: 0.45 }, d: { type: 'drums', kit: 'orch' } }, bars: 2, parts: { b: 'ab4+c5+eb5 - . g4+b4+d5 - - c5+eb5+g5 - | c5+e5+g5+c6 - - - - - - -', tp: 'g2 . . g2 . . c2 - | c2 - - - - - - -', g: '. . . . . . . . | c6 - g5 - e5 - c5 -', d: { y: '............x...|x...............' } } },
      hint: { bpm: 110, tracks: { v: { type: 'vibes', vol: 0.4, dly: 0.25 } }, bars: 1, parts: { v: 'g5 c6 eb6 g6 - - - -' } },
      win: { bpm: 112, tracks: { b: { type: 'brass', vol: 0.55 }, g: { type: 'vibes', vol: 0.4 }, d: { type: 'drums', kit: 'orch' } }, bars: 2, parts: { b: 'g4+b4+d5 . g4+b4+d5 ab4+c5+eb5 - - g4+b4+d5 - | c5+e5+g5+c6 - - - - - - -', g: 'd6 b5 g5 d5 b5 d6 g6 - | c6 - - - - - - -', d: { s: 'x.x.x.....x.....', y: '................|x...............' } } },
      lose: { bpm: 80, tracks: { t: { type: 'mute', vol: 0.5 }, p: { type: 'piano', vol: 0.35 } }, bars: 1, parts: { t: 'g4 - f4 - eb4 - d4 -', p: '. . . . . . c3+g3+eb4 -' } },
    },
    fx: { opened: 'unlock', wrong: 'wrong', caught: 'caught', hint: 'hint', wrongAccuse: 'wrong' },
    sfx: { thunder: 'boom' },
  };
})();
