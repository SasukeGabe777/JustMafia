'use strict';
// Act It Out score: an old-time theatre in Bb. The title is a swinging vaudeville show tune
// (honky-tonk piano, clarinet, upright bass, brushes); the acting music is a tiptoeing pizzicato
// "mime" waltz-ish shuffle that leaves room for people to shout; the countdown speeds the
// pizzicato up under tremolo strings; reveals are brass + timpani fanfares; the finale is
// the show tune's big-band reprise a whole step up.
(function () {
  const S = (window.BOX.scores = window.BOX.scores || {});
  const show = {
    piano: { type: 'honky', mode: 'chord', center: 62, n: 4, vol: 0.42, pan: -0.15 },
    bass: { type: 'upright', mode: 'bass', oct: 2, vol: 0.8 },
    clar: { type: 'clarinet', vol: 0.42, pan: 0.15, rev: 0.2 },
    bells: { type: 'glock', vol: 0.16, pan: 0.3, oct: 1 },
    br: { type: 'brass', mode: 'chord', center: 65, n: 3, vol: 0.3 },
    dr: { type: 'drums', kit: 'jazz', vol: 0.8 },
  };
  const A = 'Bb6 | G7 | Cm7 | F7 | Bb6 Bb7 | Eb6 Ebm6 | Bb/F G7 | Cm7 F7';
  const B = 'D7 | D7 | G7 | G7 | C7 | C7 | F7 | Cm7 F7';
  const melA = 'd5 - f5 - g5 f5 d5 bb4 | b4 - d5 - g5 - f5 - | eb5 - - c5 eb5 - g5 - | f5 - - - . . c5 d5 | f5 - d5 - bb5 - ab5 - | g5 - eb5 - gb5 - eb5 - | d5 - f5 - e5 - g5 - | f5 - - - . c5 d5 eb5';
  const melB = 'f#5 - a5 - c6 - a5 - | f#5 - d5 - e5 f#5 a5 - | g5 - - b4 d5 - f5 - | g5 - - - . . f5 g5 | e5 - g5 - bb5 - g5 - | e5 - c5 - d5 e5 g5 - | f5 - - a4 c5 - eb5 - | f5 - - - . . . .';
  const swing = { k: 'x.......x.......', s: '....x.......x...', h: 'x..xx..xx..xx..x', rim: '..........g.....' };
  S.actout = {
    name: 'Act It Out',
    cues: {
      title: {
        bpm: 132, swing: 0.62, tracks: show,
        sections: {
          I: { bars: 4, chords: 'Bb6 | G7 | Cm7 F7 | Bb6', br: 'X.......x..x....', piano: 'x.x.x.x.x.x.x.x.', bass: '1 - 5 - 1 - 5 -', bells: 'd6 . bb5 . f5 . . . | b5 . g5 . d5 . . . | c6 . g5 . a5 . f5 . | bb5 - - - . . . .', dr: { k: 'x...............', y: 'x...............|................|................|x...............', s: '..............xx' } },
          A: { bars: 8, chords: A, piano: '.x.x.x.x.x.x.x.x', bass: '1 . 5 . 8 . 5 .', clar: melA, dr: swing },
          B: { bars: 8, chords: B, piano: 'x..x..x.x..x..x.', bass: 'walk', clar: melB, br: '....x.......x...', dr: { ...swing, h: 'xxxxxxxxxxxxxxxx', c: 'x...............' } },
          A2: { bars: 8, chords: A, piano: '.x.x.x.x.x.x.x.x', bass: 'walk', clar: melA, bells: melA, br: 'x.......x..x....', dr: { ...swing, s: '....x..g....x.g.' } },
        },
        form: ['I', 'A', 'B', 'A2'], loop: 1,
      },
      lobby: { from: 'title', bpm: 120, tracks: { clar: { vol: 0.3 }, br: { vol: 0.18 } }, form: ['A', 'B'], loop: 0,
        sections: { A: { clar: false, bells: '. . d6 . . . bb5 . | . . f5 . . . . .', dr: { k: 'x.......x.......', s: '....g.......g...', h: 'x..xx..xx..xx..x' } }, B: { br: false } } },
      intro: { from: 'title', bpm: 136, form: ['I', 'A', 'B', 'A2'] },
      // Acting: a tiptoeing pizzicato shuffle, sparse so the room can shout guesses over it.
      think: {
        bpm: 104, swing: 0.6,
        tracks: { pz: { type: 'pizz', mode: 'chord', center: 64, n: 3, vol: 0.6, pan: -0.2 }, bass: { type: 'upright', mode: 'bass', oct: 2, vol: 0.7 }, clar: { type: 'clarinet', vol: 0.3, pan: 0.2, rev: 0.25 }, tk: { type: 'drums', kit: 'world', vol: 0.5 }, dr: { type: 'drums', kit: 'jazz', vol: 0.5 } },
        sections: {
          A: { bars: 8, chords: 'Gm | Gm/F | Eb | D7 | Gm | Gm/F | Cm6 | D7', pz: '1.3.2.3.1.3.2.3.', bass: '1 . . . 5 . . . | 1 . . . 5 . 7 .', tk: { wb: 'x...x...x...x...', wb2: '..x.......x.....' }, dr: { h: '....x.......x...' } },
          B: { bars: 8, chords: 'Eb | Bb/D | Cm | D7 | Eb | Bb/D | Am7b5 | D7', pz: '3.2.1.2.3.2.1.2.', bass: '1 . . . 5 . . . | 1 . . . 5 . a .', clar: 'g4 - - - . . bb4 - | a4 - - - . . . . | g4 - eb4 - g4 - c5 - | d5 - - - . . . . | eb5 - - - d5 - c5 - | bb4 - - - . . . . | c5 - a4 - c5 - eb5 - | d5 - - - - - . .', tk: { wb: 'x...x...x...x...' }, dr: { h: '....x.......x...', s: '..............g.' } },
        },
        form: ['A', 'B'], loop: 0,
      },
      play: { from: 'think', bpm: 116, tracks: { pn: { type: 'honky', mode: 'chord', center: 62, n: 4, vol: 0.32, pan: 0.2 } },
        sections: { A: { pn: '.x...x...x...x..', dr: { k: 'x.......x.......', s: '....x.......x...', h: 'x.xxx.xxx.xxx.xx' } }, B: { pn: 'x..x..x.x..x..x.', dr: { k: 'x.......x.......', s: '....x.......x...', h: 'x.xxx.xxx.xxx.xx' } } } },
      // The last ten seconds: faster pizzicato under tremolo strings and a ticking clock.
      tense: {
        bpm: 140,
        tracks: { pz: { type: 'pizz', mode: 'chord', center: 64, n: 3, vol: 0.2 }, str: { type: 'strings', mode: 'chord', center: 60, n: 3, vol: 0.13, trem: 0.6 }, bass: { type: 'upright', mode: 'bass', oct: 2, vol: 0.35 }, tk: { type: 'drums', vol: 0.3 }, dr: { type: 'drums', kit: 'orch', vol: 0.3 } },
        sections: {
          A: { bars: 8, chords: 'Gm | Ab | Gm | D7 | Gm | Ab | Eb | D7', pz: '1212323212123232', str: true, bass: '1 1 1 1 1 1 5 5', tk: { tick: 'x.x.x.x.x.x.x.x.' }, dr: { k: 'x...x...x...x...', t1: '..............xx' } },
          B: { bars: 8, chords: 'Cm | D7 | Gm | Eb | Cm | D7 | Eb | D7', pz: '3232121232321212', str: true, bass: '1 1 1 1 1 1 5 5', tk: { tick: 'x.x.x.x.x.x.x.x.', tock: '..x...x...x...x.' }, dr: { k: 'x...x...x...x...', s: '....x.......x...' } },
        },
        form: ['A', 'B'], loop: 0,
      },
      // Reveal + applause: a curtain-call fanfare.
      reveal: {
        bpm: 118,
        tracks: { br: { type: 'brass', mode: 'chord', center: 66, n: 4, vol: 0.34 }, str: { type: 'strings', mode: 'chord', center: 64, n: 4, vol: 0.24 }, bass: { type: 'upright', mode: 'bass', vol: 0.6 }, tp: { type: 'timp', vol: 0.38 }, gl: { type: 'glock', vol: 0.18 }, dr: { type: 'drums', kit: 'orch', vol: 0.7 } },
        sections: {
          R: { bars: 2, chords: 'F7sus4 | F7', str: 'x-------x-------', tp: 'f2 f2 f2 f2 f2 f2 f2 f2 | f2 f2 f2 f2 c3 c3 c3 c3', dr: { s: '2323434545656767|7878989899999999' } },
          H: { bars: 4, chords: 'Bb | Eb/Bb | Bb | F7', br: 'X-----x-x---x---', str: true, bass: '1 - - - 5 - 1 .', gl: 'd6 . f6 . bb6 - - - | . . . . . . . .', dr: { k: 'x.......x.......', y: 'x...............', s: '....x.......x...' } },
          C: { bars: 4, chords: 'Eb | Bb/D | Cm7 F7 | Bb', br: 'x---x---x-x-x---', str: true, bass: '1 - 5 - 1 - 5 -', dr: { k: 'x.......x.......', s: '....x.......x...', sh: 'xgxgxgxgxgxgxgxg' } },
        },
        form: ['R', 'H', 'C'], loop: 1,
      },
      finale: { from: 'title', bpm: 138, transpose: 2, tracks: { br: { vol: 0.42 } },
        sections: { A: { br: '....x.x.....x...' }, B: { br: 'x.......x.x.....' }, A2: { br: 'x..x..x.....x...' } } },
    },
    stingers: {
      win: { bpm: 126, tracks: { b: { type: 'brass', vol: 0.6 }, g: { type: 'glock', vol: 0.4 }, d: { type: 'drums', kit: 'orch' } }, bars: 2, parts: { b: 'bb4+d5+f5 . bb4+d5+f5 c5+eb5+g5 - - d5+f5+bb5 - | d5+f5+bb5+d6 - - - - - - -', g: 'f5 . f5 g5 - - bb5 - | d6 - - - - - - -', d: { s: 'x.x.x.....x.....', y: '................|x...............' } } },
      reveal: { bpm: 118, gain: 1, tracks: { b: { type: 'brass', vol: 0.55 }, d: { type: 'drums', kit: 'orch' } }, bars: 1, parts: { b: 'bb4+d5+f5+bb5 - - - - - - -', d: { k: 'x', y: 'x' } } },
      good: { bpm: 150, tracks: { g: { type: 'glock', vol: 0.5 }, c: { type: 'clarinet', vol: 0.4 } }, bars: 1, parts: { g: 'f5 bb5 d6 f6 - - - -', c: 'bb4 d5 f5 bb5 - - - -' } },
      bad: { bpm: 96, tracks: { b: { type: 'mute' } }, bars: 1, parts: { b: 'e4 - eb4 - d4 - - -' } },
      round: { bpm: 132, tracks: { p: { type: 'honky', vol: 0.5 }, d: { type: 'drums', kit: 'jazz' } }, bars: 1, parts: { p: 'f4+bb4+d5 . . f4+bb4+d5 . . . .', d: { s: 'x..x............', y: 'x...............' } } },
      action: { bpm: 140, tracks: { d: { type: 'drums', kit: 'orch' }, b: { type: 'brass', vol: 0.5 } }, bars: 1, parts: { d: { s: 'xxxxxxxxxxxxx...', y: '............x...' }, b: '. . . . . . bb4+f5+bb5 -' } },
      freeze: { bpm: 120, tracks: { g: { type: 'chime', vol: 0.5 } }, bars: 1, parts: { g: 'f6 . c6 . . . . .' } },
    },
    fx: { cast: 'round', final: 'win', action: 'action', got: 'good', nobody: 'bad', reveal: 'reveal', pose: 'freeze', win: 'win' },
    sfx: {},
  };
})();
