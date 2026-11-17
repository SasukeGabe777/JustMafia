'use strict';
// Alien Abduction: a spooky-fun space-lounge score in E minor. A wobbly theremin lead (sine with
// heavy vibrato), twinkly celesta arpeggios, a rubbery synth bass and an 808 kit. The shift
// ticks like a ship's clock, the discussion bounces, the alarm wails, and the ending is either a
// bright G-major homecoming (crew) or a slow, gooey theremin lament (aliens).
// Phase → cue: music(s) in public/box/games/alien.js (roles→intro, emergency→alarm, shift/vote→think,
// report/eject→reveal, discuss→play, over→finale or lose).
(function () {
  const S = (window.BOX.scores = window.BOX.scores || {});
  const tracks = {
    pad: { type: 'pad', mode: 'chord', center: 60, n: 4, vol: 0.26, cut: 1500, att: 0.6, rel: 1.2 },
    cel: { type: 'celesta', mode: 'chord', center: 76, n: 4, vol: 0.26, pan: 0.25, dly: 0.25 },
    bass: { type: 'synthbass', mode: 'bass', oct: 2, vol: 0.42 },
    ther: { type: 'sine', vol: 0.4, vib: 34, vhz: 5.2, att: 0.06, rel: 0.4, dly: 0.25, rev: 0.45, pan: -0.1 },
    glock: { type: 'glock', vol: 0.2, pan: 0.3, dly: 0.2 },
    dr: { type: 'drums', kit: '808', vol: 0.75 },
  };
  const A = 'Em | Em/D | Cmaj7 | B7 | Em | G/D | Am7 | B7sus4 B7';
  const B = 'Cmaj7 | D | Bm7 | Em | Am7 | D7 | Gmaj7 | B7';
  const melA = 'e5 - - - g5 - b5 - | a5 - - - g5 f#5 g5 - | e5 - - - - - . . | d#5 - - - f#5 - b4 - | e5 - - - g5 - b5 - | d6 - - - c6 b5 a5 - | c6 - - - b5 - a5 - | b5 - - - - - . .';
  const melB = 'g5 . e5 . g5 a5 b5 . | a5 . f#5 . d5 - - . | f#5 . d5 . f#5 g5 a5 . | g5 - - - e5 - - . | c6 . a5 . c6 b5 a5 . | f#5 - - - d5 - - . | b5 . g5 . d5 . g5 . | f#5 - d#5 - b4 - - .';
  const arp = '1.2.3.4.3.2.4.3.';
  const groove = { k: 'x.....x...x.....', s: '....x.......x...', h: 'x.x.x.x.x.x.x.xo' };
  S.alien = {
    name: 'Alien Abduction',
    cues: {
      title: {
        bpm: 100, swing16: 0.54, tracks,
        sections: {
          I: { bars: 4, chords: 'Em | Em/D | Cmaj7 | B7', pad: true, cel: arp, bass: '1 - - - - - - - | 1 - - - - - - -', dr: { y: 'x...............|................|................|............x.x.' } },
          A: { bars: 8, chords: A, pad: true, cel: arp, bass: '1 - . 1 . 5 8 . | 1 - . 1 5 - 7 5', ther: melA, dr: { ...groove, y: 'x' + '.'.repeat(127) } },
          B: { bars: 8, chords: B, pad: true, cel: '4.3.2.1.2.3.4.2.', bass: '1 . 1 5 1 . 5 a | 1 . 1 5 8 . 5 .', glock: melB, dr: { k: 'x.....x...x..x..', s: '....x.......x...', h: 'xxx.xxx.xxx.xxx.' } },
          A2: { bars: 8, chords: A, pad: true, cel: arp, bass: '1 - . 1 . 5 8 . | 1 - . 1 5 - 7 5', ther: melA, glock: melA, dr: { ...groove, sh: 'xgxgxgxgxgxgxgxg' } },
        },
        form: ['I', 'A', 'B', 'A2'], loop: 1,
      },
      lobby: { from: 'title', bpm: 94, tracks: { ther: { vol: 0.28 } }, form: ['A', 'B'], loop: 0,
        sections: { A: { ther: false, glock: '. . . . e6 . . . | . . . . b5 . . .', dr: { k: 'x.......x.......', s: '....g.......x...', h: '..x...x...x...x.' } }, B: { glock: melB, dr: { k: 'x.......x.......', s: '....x.......x...', sh: 'xgxgxgxgxgxgxgxg' } } } },
      intro: { from: 'title', bpm: 104, form: ['I', 'A', 'B', 'A2'] },
      think: {
        bpm: 92,
        tracks: { pad: { type: 'pad', mode: 'chord', center: 59, n: 3, vol: 0.24, cut: 1100 }, cel: { type: 'celesta', mode: 'chord', center: 74, n: 4, vol: 0.24, dly: 0.3, pan: 0.2 }, bass: { type: 'synthbass', mode: 'bass', oct: 2, vol: 0.36, cut: 700 }, ther: { type: 'sine', vol: 0.26, vib: 40, vhz: 4.6, att: 0.3, rel: 0.8, rev: 0.5 }, tk: { type: 'drums', vol: 0.55 }, dr: { type: 'drums', kit: 'lofi', vol: 0.55 } },
        sections: {
          A: { bars: 8, chords: 'Em | Cmaj7 | Am7 | B7 | Em | Cmaj7 | Am7 | B7sus4 B7', pad: true, cel: '1...3...2...4...', bass: '1 . . 1 . . 5 . | 1 . . 1 . . 7 .', tk: { tick: 'x...x...x...x...', tock: '..x...x...x...x.' }, dr: { k: 'x.......x.......' } },
          B: { bars: 8, chords: 'Cmaj7 | B7 | Em | Em/D | Cmaj7 | Am7 | B7sus4 | B7', pad: true, cel: '1.2.3.4.3.2.1...', bass: '1 . . 1 . . 5 . | 1 . . 1 . . 5 .', ther: 'g5 - - - - - - - | f#5 - - - - - - - | e5 - - - - - - - | . . . . . . . . | e5 - - - - - - - | c5 - - - - - - - | b4 - - - - - - - | . . . . . . . .', tk: { tick: 'x...x...x...x...', tock: '..x...x...x...x.' }, dr: { k: 'x.......x.......', s: '............g...' } },
        },
        form: ['A', 'B'], loop: 0,
      },
      play: {
        bpm: 108, swing16: 0.56,
        tracks: { clav: { type: 'clav', mode: 'chord', center: 64, n: 3, vol: 0.32, pan: -0.2 }, bass: { type: 'synthbass', mode: 'bass', oct: 2, vol: 0.44 }, ther: { type: 'sine', vol: 0.32, vib: 30, dly: 0.2, rev: 0.4 }, glock: { type: 'glock', vol: 0.18, pan: 0.3 }, dr: { type: 'drums', kit: 'funk', vol: 0.7 } },
        sections: {
          A: { bars: 8, chords: 'Em7 | A7 | Em7 | A7 | Cmaj7 | B7 | Em7 | B7', clav: '..x.x..x..x.x..x', bass: '1 . 1 8 . 1 b7 . | 1 . 5 . 8 . 7 5', glock: '. . . . b5 . . . | . . . . c#6 . . .', dr: { k: 'x.....x...x.....', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' } },
          B: { bars: 8, chords: 'Em7 | A7 | Em7 | A7 | Cmaj7 | B7 | Em7 | B7', clav: '..x.x..x..x.x..x', bass: '1 . 1 8 . 1 b7 . | 1 . 5 . 8 . 7 5', ther: 'e5 - g5 - a5 - b5 - | c#6 - b5 - a5 - - - | g5 - e5 - g5 - a5 - | b5 - - - - - . . | c6 - b5 - a5 - g5 - | f#5 - - - d#5 - - - | e5 - g5 - b5 - e6 - | d#6 - - - - - . .', dr: { k: 'x.....x...x..x..', s: '....x.......x...', h: 'xxx.xxx.xxx.xxx.' } },
        },
        form: ['A', 'B'], loop: 0,
      },
      tense: {
        bpm: 132,
        tracks: { sb: { type: 'synthbass', mode: 'bass', oct: 2, vol: 0.3 }, str: { type: 'strings', mode: 'chord', center: 62, n: 3, vol: 0.24, att: 0.02, rel: 0.1 }, ther: { type: 'sine', vol: 0.24, vib: 45, vhz: 7 }, tk: { type: 'drums', vol: 0.6 }, dr: { type: 'drums', kit: '808', vol: 0.6 } },
        sections: {
          A: { bars: 8, chords: 'Em | Em | C | B7 | Em | Em | C | B7', sb: '1 1 8 1 1 8 1 5', str: 'x..x..x.x..x..x.', tk: { tick: 'x.x.x.x.x.x.x.x.' }, dr: { k: 'x...x...x...x...', s: '........x.......', t1: '..............xx' } },
          B: { bars: 8, chords: 'Am | B7 | Em | C | Am | B7 | C | B7', sb: '1 1 8 1 1 8 1 5', str: 'x..x..x.x..x..x.', ther: 'e6 - - - - - - - | d#6 - - - - - - - | e6 - - - - - - - | g6 - - - - - - - | a6 - - - - - - - | f#6 - - - - - - - | g6 - - - e6 - - - | d#6 - - - - - - -', tk: { tick: 'x.x.x.x.x.x.x.x.' }, dr: { k: 'x...x...x...x...', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' } },
        },
        form: ['A', 'B'], loop: 0,
      },
      alarm: {
        bpm: 140,
        tracks: { siren: { type: 'sine', vol: 0.26, vib: 10, glide: 0.3 }, br: { type: 'brass', mode: 'chord', center: 60, n: 3, vol: 0.28 }, sb: { type: 'synthbass', mode: 'bass', oct: 2, vol: 0.32 }, dr: { type: 'drums', kit: '808', vol: 0.7 } },
        sections: {
          A: { bars: 4, chords: 'Em | Em | F | Em', siren: 'b5 - - - ~e6 - - - | b5 - - - ~e6 - - - | c6 - - - ~f6 - - - | b5 - - - ~e6 - - -', br: 'X.....x.X.......', sb: '1 1 1 1 1 1 1 1', dr: { k: 'x...x...x...x...', s: '....x.......x...', h: 'xxxxxxxxxxxxxxxx' } },
        },
        form: ['A'], loop: 0,
      },
      reveal: {
        bpm: 112,
        tracks: { br: { type: 'brass', mode: 'chord', center: 64, n: 4, vol: 0.45 }, str: { type: 'strings', mode: 'chord', center: 64, n: 4, vol: 0.36 }, bass: { type: 'synthbass', mode: 'bass', vol: 0.4 }, ther: { type: 'sine', vol: 0.3, vib: 36 }, tp: { type: 'timp', vol: 0.5 }, dr: { type: 'drums', kit: 'orch' } },
        sections: {
          R: { bars: 2, chords: 'B7sus4 | B7', str: 'x-------x-------', ther: 'b4 - - - - - - - | ~b5 - - - - - - -', tp: 'b2 b2 b2 b2 b2 b2 b2 b2 | b2 b2 b2 b2 f#2 f#2 f#2 f#2', dr: { s: '2323434545656767|7878989899999999' } },
          H: { bars: 4, chords: 'Em | C | Am7 | B7', br: 'X-----x-x---x---', str: true, bass: '1 - - - 5 - 1 .', dr: { k: 'x.......x.......', y: 'x...............', s: '....x.......x...' } },
        },
        form: ['R', 'H'], loop: 1,
      },
      finale: {
        bpm: 116,
        tracks: { br: { type: 'brass', mode: 'chord', center: 67, n: 4, vol: 0.42 }, pad: { type: 'pad', mode: 'chord', center: 62, n: 4, vol: 0.24 }, bass: { type: 'synthbass', mode: 'bass', oct: 2, vol: 0.42 }, glock: { type: 'glock', vol: 0.3, dly: 0.2 }, ther: { type: 'sine', vol: 0.34, vib: 24, dly: 0.2 }, dr: { type: 'drums', kit: 'std' } },
        sections: {
          A: { bars: 8, chords: 'G | D/F# | Em | C | G | D/F# | C | D', br: 'x.....x...x.....', pad: true, bass: '1 - . 1 5 - 8 . | 1 - . 1 5 . 3 .', glock: 'g5 . b5 . d6 . g6 . | f#6 . d6 . a5 . f#5 . | e5 . g5 . b5 . e6 . | c6 . e6 . g6 . e6 .', ther: 'd6 - - - b5 - g5 - | a5 - - - f#5 - d5 - | e5 - g5 - b5 - d6 - | e6 - - - - - . . | d6 - - - b5 - g5 - | a5 - - - d6 - f#6 - | g6 - - - e6 - c6 - | d6 - - - - - . .', dr: { k: 'x.......x.......', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' } },
          B: { bars: 8, chords: 'C | D | Bm7 | Em | Am7 | D | G | G', br: 'X-------x.x.x...', pad: true, bass: '1 . 1 5 1 . 5 . | 1 . 1 5 8 . 5 .', glock: melB, dr: { k: 'x.....x...x.....', s: '....x.......x...', h: 'xxx.xxx.xxx.xxx.', y: 'x' + '.'.repeat(127) } },
        },
        form: ['A', 'B'], loop: 0,
      },
      lose: {
        bpm: 72,
        tracks: { pad: { type: 'pad', mode: 'chord', center: 55, n: 3, vol: 0.3, cut: 900, att: 1.5, rel: 2 }, ther: { type: 'sine', vol: 0.4, vib: 48, vhz: 4.2, att: 0.2, rel: 1, rev: 0.6, dly: 0.3 }, cel: { type: 'celesta', vol: 0.2, dly: 0.35 }, bass: { type: 'synthbass', mode: 'bass', oct: 2, vol: 0.36, cut: 500 }, dr: { type: 'drums', kit: 'lofi', vol: 0.5 } },
        sections: {
          A: { bars: 8, chords: 'Em | Cm | Em | B7 | Am | Cm | Em | B7', pad: true, bass: '1 - - - - - - - | 1 - - - - - - -', ther: 'b5 - - - ~g5 - - - | ~eb5 - - - - - - - | e5 - - - ~g5 - - - | f#5 - - - - - - - | e5 - - - ~c5 - - - | ~eb5 - - - - - - - | b4 - - - - - - - | . . . . . . . .', cel: '. . . . e6 . . . | . . . . eb6 . . .', dr: { k: 'x.......x.......', s: '........g.......' } },
        },
        form: ['A'], loop: 0,
      },
    },
    stingers: {
      win: { bpm: 120, tracks: { b: { type: 'brass', vol: 0.6 }, g: { type: 'glock', vol: 0.4 }, d: { type: 'drums', kit: 'orch' } }, bars: 2, parts: { b: 'g4+b4+d5 . g4+b4+d5 a4+c5+e5 - - b4+d5+g5 - | b4+d5+g5+b5 - - - - - - -', g: 'd6 . d6 e6 - - g6 - | b6 - - - - - - -', d: { s: 'x.x.x.....x.....', y: '................|x...............' } } },
      lose: { bpm: 80, tracks: { t: { type: 'sine', vol: 0.5, vib: 50 }, p: { type: 'pad', vol: 0.3 } }, bars: 2, parts: { t: 'b5 - - - ~g5 - - - | ~e5 - - - - - - -', p: 'e4+g4+b4 - - - - - - - | e4+g4+c5 - - - - - - -' } },
      reveal: { bpm: 110, gain: 1, tracks: { b: { type: 'brass', vol: 0.55 }, d: { type: 'drums', kit: 'orch' } }, bars: 1, parts: { b: 'e4+g4+b4+e5 - - - - - - -', d: { k: 'x', y: 'x' } } },
      good: { bpm: 140, tracks: { g: { type: 'celesta' }, s: { type: 'sine', vib: 20 } }, bars: 1, parts: { g: 'e5 g5 b5 e6 - - - -', s: '. . . . ~e6 - - -' } },
      bad: { bpm: 100, tracks: { b: { type: 'synthbass', vol: 0.6 }, s: { type: 'sine', vol: 0.4, vib: 60 } }, bars: 1, parts: { b: 'e3 - eb3 - d3 - - -', s: 'b5 - ~f5 - - - - -' } },
      round: { bpm: 120, tracks: { b: { type: 'pluck', dly: 0.3 } }, bars: 1, parts: { b: 'e5 b5 e6 . . . . .' } },
      alarm: { bpm: 140, tracks: { s: { type: 'sine', vol: 0.45, vib: 8 }, d: { type: 'drums', kit: '808' } }, bars: 1, parts: { s: 'b5 ~e6 - b5 ~e6 - - -', d: { k: 'x...x...x.......' } } },
    },
    fx: { alarm: 'alarm', sabotage: 'bad', jump: 'good', gotcha: 'win', oops: 'bad', roles: 'reveal', win: 'win', lose: 'lose' },
    sfx: {},
  };
})();
