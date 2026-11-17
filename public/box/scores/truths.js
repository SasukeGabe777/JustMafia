'use strict';
// Two Truths and a Lie: noir detective jazz in C minor. A smoky tenor sax over a
// descending minor line cliché, rootless piano, walking upright bass and brushes;
// a harmon-muted trumpet answers in the bridge. Rain-on-the-window piano while people
// write, a ticking interrogation vamp for the vote, a brass "gotcha" for the reveal.
(function () {
  const S = (window.BOX.scores = window.BOX.scores || {});
  const tracks = {
    pno: { type: 'piano', mode: 'chord', center: 60, n: 4, rootless: true, vol: 0.42, pan: -0.15 },
    sax: { type: 'sax', vol: 0.5, pan: 0.15 },
    tp: { type: 'mute', vol: 0.45, pan: 0.25, dly: 0.15 },
    vib: { type: 'vibes', vol: 0.32, pan: 0.3 },
    bass: { type: 'upright', mode: 'bass', oct: 2 },
    dr: { type: 'drums', kit: 'jazz', vol: 0.65 },
  };
  const A = 'Cm | CmM7 | Cm7 | Cm6 | Abmaj7 | Fm9 | Dm7b5 | G7b9';
  const B = 'Ebmaj7 | Abmaj7 | Dm7b5 | G7b9 | Cm9 | F7 | Dm7b5 | G7#9';
  const theme = 'g4 - - - c5 - eb5 - | d5 - - - b4 - - - | bb4 - - - g4 - eb4 - | a4 - - - - - . . | c5 - - - eb5 - g5 - | ab5 - - - g5 - f5 - | f5 - - - d5 - ab4 - | b4 - - - g4 - - -';
  const bridge = 'g5 - - - bb5 - - - | c6 - - - g5 - - - | f5 - - - ab5 - - - | b5 - - - - - . . | eb5 - - - d5 - c5 - | a4 - - - c5 - eb5 - | d5 - - - ab4 - f4 - | b4 - - - bb4 - - -';
  const brush = { k: 'g.......g.......', br: 'x.x.x.x.x.x.x.x.', s: '....g.......g...', h: '....x.......x...' };
  S.truths = {
    name: 'Two Truths',
    cues: {
      title: {
        bpm: 70, swing: 0.64, tracks,
        sections: {
          I: { bars: 4, chords: 'Cm | Ab7 | Cm | G7#9', pno: 'x---------------', vib: 'c6 - - - - - - - | . . . . . . . . | eb6 - - - - - - - | . . . . . . . .', bass: '1 - - - - - - - | 1 - - - - - - - | 1 - - - - - - - | 1 - - - 5 - - -', dr: { br: 'x.x.x.x.x.x.x.x.', vn: 'x...............' } },
          A: { bars: 8, chords: A, pno: 'x-.....x-.......', bass: '1 - - - 5 - - - | 1 - - - 5 - 7 -', sax: theme, dr: brush },
          B: { bars: 8, chords: B, pno: 'x-.....x-.......', bass: 'walk', tp: bridge, dr: brush },
          A2: { bars: 8, chords: A, pno: 'x-.....x-.......', bass: 'walk', sax: theme, vib: '. . . . . . . . | . . . . . . . . | . . . . . . . . | c6 - - - - - - - | . . . . . . . . | . . . . . . . . | . . . . . . . . | g5 - - - - - - -', dr: { ...brush, r: 'x...x.x.x...x.x.' } },
        },
        form: ['I', 'A', 'B', 'A2'], loop: 1,
      },
      lobby: { from: 'title', bpm: 66, form: ['A', 'B'], loop: 0, tracks: { sax: { vol: 0.38 } } },
      intro: { from: 'title', bpm: 74 },
      // Writing: lonely piano in the rain.
      think: {
        bpm: 64, swing: 0.6,
        tracks: { pno: { type: 'piano', mode: 'chord', center: 58, n: 4, vol: 0.4 }, mel: { type: 'piano', vol: 0.45, pan: 0.15 }, bass: tracks.bass, rain: { type: 'drums', vol: 0.5 }, pad: { type: 'pad', mode: 'chord', center: 60, vol: 0.15, cut: 900 } },
        sections: {
          A: { bars: 8, chords: 'Cm9 | Abmaj7 | Fm9 | G7sus4 G7b9 | Cm9 | Ebmaj7 | Abmaj7 | Dm7b5 G7b9', pno: 'x-----------x---', pad: true, bass: '1 - - - - - - - | 1 - - - 5 - - -', mel: 'eb5 - d5 - c5 - g4 - | c5 - - - . . . . | ab4 - g4 - f4 - c5 - | b4 - - - . . . . | eb5 - d5 - c5 - g5 - | bb5 - - - . . . . | g5 - f5 - eb5 - c5 - | d5 - - - b4 - - -', rain: { vn: 'x...............' } },
        },
        form: ['A'], loop: 0,
      },
      // Grilling the suspect: a medium swing.
      play: { from: 'title', bpm: 96, form: ['A', 'B', 'A2'], loop: 0, tracks: { sax: { vol: 0.42 } }, sections: { A: { bass: 'walk', dr: { k: 'g.......g.......', r: 'x...x.x.x...x.x.', h: '....x.......x...' } } } },
      // The vote: an interrogation-room vamp.
      tense: {
        bpm: 104, swing: 0.6,
        tracks: { ost: { type: 'piano', vol: 0.5 }, bass: { type: 'upright', vol: 0.8 }, tp: tracks.tp, dr: tracks.dr, clk: { type: 'drums', vol: 0.65 } },
        sections: {
          A: { bars: 4, chords: 'Cm | Db/C | Cm | Db/C', ost: 'c4+g4 . . c4+g4 . . db4+ab4 . | c4+g4 . . c4+g4 . . db4+ab4 .', bass: 'c2 . . c2 . . db2 . | c2 . . c2 . . db2 .', clk: { tick: 'x...x...x...x...' }, dr: { t1: 'x.......x.......', r: 'x.x.x.x.x.x.x.x.' } },
          B: { bars: 4, chords: 'Cm | Db/C | Fm | G7#9', ost: 'c4+g4 . . c4+g4 . . db4+ab4 . | c4+g4 . . c4+g4 . . db4+ab4 . | f4+c5 . . f4+c5 . . ab4+eb5 . | g4+b4 . . g4+b4 . . ab4+db5 .', bass: 'c2 . . c2 . . db2 . | c2 . . c2 . . db2 . | f2 . . f2 . . ab2 . | g2 . . g2 . . db3 .', tp: 'c5 - - - db5 - - - | eb5 - - - db5 - c5 - | ab5 - - - g5 - f5 - | b4 - - - - - - -', clk: { tick: 'x.x.x.x.x.x.x.x.' }, dr: { t1: 'x...x...x...x...', r: 'x.x.x.x.x.x.x.x.', s: '..............gg' } },
        },
        form: ['A', 'B'], loop: 0,
      },
      reveal: {
        bpm: 80, swing: 0.62,
        tracks: { stab: { type: 'brass', mode: 'chord', center: 62, n: 4, vol: 0.45, bright: 0.8 }, pno: tracks.pno, sax: tracks.sax, bass: tracks.bass, dr: tracks.dr, orch: { type: 'drums', kit: 'orch' } },
        sections: {
          R: { bars: 4, chords: 'Abmaj7 | G7#9 | Cm9 | Cm9', stab: 'X-------........|X-------........|................|................', pno: '................|................|x---------------|x-------x-------', sax: '. . . . . . . . | . . . . . . . . | g5 - eb5 - c5 - d5 - | eb5 - - - - - - -', bass: '1 - - - - - - - | 1 - - - - - - - | 1 - - - 5 - - - | 1 - - - - - - -', orch: { y: 'x...............|x...............|................|................' }, dr: { br: '................|................|x.x.x.x.x.x.x.x.|x.x.x.x.x.x.x.x.' } },
        },
        form: ['R'], loop: 0,
      },
      finale: { from: 'title', bpm: 84, transpose: 2, form: ['A2', 'B', 'A2'], tracks: { stab: { type: 'brass', mode: 'chord', center: 64, n: 4, vol: 0.3 } }, sections: { B: { stab: 'x.......x.......' } } },
    },
    stingers: {
      gotcha: (X) => { X.chord('brass', ['g3', 'b3', 'f4', 'bb4'], 0, 0.9, 1, 0, { bright: 0.8 }); X.drum('y', 0, 0.6, 'orch'); X.drum('k', 0, 0.8, 'orch'); },
      fooled: { bpm: 100, tracks: { m: { type: 'mute' } }, parts: { m: 'c5 eb5 g5 bb5 a5 - - -' } },
      truth: (X) => { X.chord('vibes', ['c5', 'eb5', 'g5', 'd6'], 0, 1.2, 0.8, 0.04); },
      flip: (X) => { X.note('piano', 'g5', 0, 0.3, 0.6); X.drum('sn', 0, 0.6); },
      win: { bpm: 90, swing: 0.62, tracks: { s: { type: 'sax' }, p: { type: 'piano', mode: 'chord', center: 62, n: 4 } }, chords: 'Abmaj7 | Cm9', bars: 2, parts: { s: 'c5 eb5 g5 bb5 - c6 - - | g5 - - - - - - -', p: '................|x---------------' } },
    },
    fx: { win: 'win', flip: 'flip' },
    sfx: { drum: 'roll', gasp: 'gotcha', laugh: 'fooled', win: 'win', gavel: 'gavel' },
  };
})();
