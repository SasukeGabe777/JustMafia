'use strict';
// Hot Take Trivia soundtrack: a brassy, funky quiz-show theme in A minor (clavinet, slap-ish
// bass, brass stabs, a bright synth lead and a game-show cowbell), a ticking marimba "think"
// bed, a driving countdown, a brass fanfare for the reveal and a big major-key finale.
// Format: public/box/scores/README.md. Cues are picked by music(s) in public/box/games/trivia.js.
(function () {
  const S = (window.BOX.scores = window.BOX.scores || {});
  const tracks = {
    clav: { type: 'clav', mode: 'chord', center: 62, n: 3, vol: 0.42, pan: -0.22 },
    brass: { type: 'brass', mode: 'chord', center: 67, n: 4, vol: 0.4, pan: 0.12 },
    pad: { type: 'pad', mode: 'chord', center: 64, n: 4, vol: 0.2, cut: 1600 },
    bass: { type: 'bass', mode: 'bass', oct: 2, vol: 0.9 },
    lead: { type: 'lead', vol: 0.34, pan: 0.1, dly: 0.14 },
    bell: { type: 'glock', vol: 0.16, pan: 0.3, oct: 1 },
    dr: { type: 'drums', kit: 'funk' },
  };
  const A = 'Am7 | D7 | Am7 | D7 | Fmaj7 | G7 | Am7 | E7sus4 E7';
  const B = 'Fmaj7 | G7 | Em7 | Am7 | Dm7 | G7 | Cmaj7 | E7';
  const melA = 'e5 - g5 a5 - g5 e5 d5 | f#5 - - - e5 d5 c5 a4 | e5 - g5 a5 - c6 b5 a5 | f#5 - - - . . a4 c5 | e5 - - c5 a4 - c5 e5 | d5 - - b4 g4 - b4 d5 | c5 - e5 a5 - g5 e5 c5 | b4 - - - g#4 - - -';
  const melB = 'a5 - - - g5 f5 e5 - | g5 - - - f5 e5 d5 - | e5 - - - d5 c5 b4 - | c5 - e5 - a5 - - - | f5 - - - e5 d5 c5 - | d5 - g5 - b5 - - - | c6 - - - b5 - g5 - | g#5 - - - - - . .';
  const groove = { k: 'x.....x...x..x..', s: '....x.......x...', h: 'x.x.x.x.x.x.x.xo', cb: '..x.......x.....' };
  const fill = { k: 'x.....x...x..x..|x.....x...x.x...', s: '....x.......x...|....x.....xgx.XX', h: 'x.x.x.x.x.x.x.xo|x.x.x.x.x.......', cb: '..x.......x.....' };
  S.trivia = {
    name: 'Hot Take Trivia',
    cues: {
      title: {
        bpm: 122, swing16: 0.53, tracks,
        sections: {
          I: { bars: 4, chords: 'Am7 | Am7 | Fmaj7 | E7', brass: 'X-......X-..X-..', pad: true, bass: '1 . . . . . 8 . | 1 . . . 5 . 8 .', bell: 'a5 . e5 . c5 . e5 . | a5 . e5 . c5 . e5 . | a5 . f5 . c5 . f5 . | g#5 . e5 . b4 . d5 .', dr: { k: 'x...............', y: 'x...............|................|................|............x.x.', s: '................|................|................|....x...x.x.XXXX' } },
          A: { bars: 8, chords: A, clav: '.x.x..x..x.x..x.', brass: '....X-......X-..', bass: '1 . 8 . 5 . 7 8 | 1 . 1 8 5 . 3 5', lead: melA, dr: { ...groove, y: 'x' + '.'.repeat(127) } },
          B: { bars: 8, chords: B, clav: 'x.x..x.x..x..x.x', pad: true, brass: 'X-..............', bass: '1 . . 5 8 . 5 . | 1 . 5 . 8 . 7 .', lead: melB, bell: '. . . . . . . . | . . . . e6 . . .', dr: fill },
          A2: { bars: 8, chords: A, clav: '.x.x..x..x.x..x.', brass: 'X-..X-......X-..', bass: '1 . 8 . 5 . 7 8 | 1 . 1 8 5 . 3 5', lead: melA, bell: melA, dr: { ...groove, sh: 'xgxgxgxgxgxgxgxg' } },
        },
        form: ['I', 'A', 'B', 'A2'], loop: 1,
      },
      lobby: { from: 'title', bpm: 112, tracks: { lead: { vol: 0.24 } }, form: ['A', 'B'], loop: 0,
        sections: { A: { lead: false, brass: false, bell: '. . . . e5 . . . | . . . . a5 . . .', dr: { k: 'x.......x.......', s: '....g.......x...', h: '..x...x...x...x.', cb: '..x.......x.....' } }, B: { lead: melB, brass: false, dr: { k: 'x.......x.......', s: '....x.......x...', sh: 'xgxgxgxgxgxgxgxg' } } } },
      intro: { from: 'title', bpm: 124, form: ['I', 'A', 'B', 'A2'] },
      think: {
        bpm: 96, swing16: 0.55,
        tracks: { mar: { type: 'marimba', mode: 'chord', center: 72, n: 4, vol: 0.34, pan: 0.25, dly: 0.18 }, piz: { type: 'pizz', mode: 'chord', center: 60, n: 3, vol: 0.32, pan: -0.25 }, bass: { type: 'upright', mode: 'bass', vol: 0.8 }, pad: { type: 'pad', mode: 'chord', center: 64, vol: 0.2, cut: 1300 }, tk: { type: 'drums', kit: 'std', vol: 0.5 }, dr: { type: 'drums', kit: 'lofi', vol: 0.55 } },
        sections: {
          A: { bars: 8, chords: 'Am9 | Fmaj7 | Dm9 | E7sus4 | Am9 | Fmaj7 | Bbmaj7 | E7', mar: '1.2.3.4.3.2.4.3.', piz: 'x...x...x...x.x.', bass: '1 . . 5 . . 8 . | 1 . . 5 . 3 5 .', pad: true, tk: { tick: 'x.......x.......', tock: '....x.......x...' }, dr: { k: 'x.......x.x.....', s: '....g.......g...' } },
          B: { bars: 8, chords: 'Dm9 | G13 | Cmaj9 | Fmaj7 | Dm9 | E7sus4 | Am9 | E7', mar: '4.3.2.1.2.3.4.2.', piz: 'x..x..x.x..x..x.', bass: '1 . . 5 8 . 5 . | 1 . 5 . 8 . 7 .', pad: true, tk: { tick: 'x.......x.......', tock: '....x.......x...' }, dr: { k: 'x.......x.x.....', s: '....x.......x...', h: '..x...x...x...x.' } },
        },
        form: ['A', 'B'], loop: 0,
      },
      play: { from: 'think', bpm: 108, tracks: { lead: { type: 'fmkeys', ratio: 3, index: 1.3, vol: 0.36, dly: 0.2, pan: 0.1 } },
        sections: {
          A: { lead: 'a4 - c5 e5 - d5 c5 - | a4 - - - . . c5 d5 | f5 - e5 d5 - c5 a4 - | b4 - - - . . . . | a4 - c5 e5 - g5 - e5 | a5 - - - g5 - e5 - | f5 - - - d5 - bb4 - | g#4 - - - . . . .', dr: { k: 'x.....x...x.....', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' } },
          B: { dr: { k: 'x.....x...x..x..', s: '....x.......x...', h: 'xxx.xxx.xxx.xxx.', cb: '..x.......x.....' } },
        } },
      tense: {
        bpm: 134,
        tracks: { sb: { type: 'synthbass', mode: 'bass', oct: 2, vol: 0.5 }, str: { type: 'strings', mode: 'chord', center: 64, n: 3, vol: 0.38, att: 0.02, rel: 0.1 }, pad: { type: 'pad', mode: 'chord', center: 60, vol: 0.22, cut: 1100 }, tk: { type: 'drums' }, dr: { type: 'drums', kit: 'std' }, lead: { type: 'brass', vol: 0.32 } },
        sections: {
          A: { bars: 8, chords: 'Am | Am | F | E | Am | Am | F | E7', sb: '1 1 8 1 1 8 1 5', str: 'x..x..x.x..x..x.', pad: true, tk: { tick: 'x.x.x.x.x.x.x.x.' }, dr: { k: 'x...x...x...x...', s: '........x.......', t1: '..............xx' } },
          B: { bars: 8, chords: 'Dm | E | Am | F | Dm | E | F | E7', sb: '1 1 8 1 1 8 1 5', str: 'x..x..x.x..x..x.', pad: true, lead: 'a4 - - - b4 - - - | c5 - - - b4 - - - | a4 - - - e4 - - - | f4 - - - a4 - - - | d5 - - - e5 - - - | f5 - - - e5 - - - | f5 - - - g5 - a5 - | g#5 - - - - - - -', tk: { tick: 'x.x.x.x.x.x.x.x.' }, dr: { k: 'x...x...x...x...', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' } },
        },
        form: ['A', 'B'], loop: 0,
      },
      reveal: {
        bpm: 116,
        tracks: { br: { type: 'brass', mode: 'chord', center: 67, n: 4, vol: 0.48 }, str: { type: 'strings', mode: 'chord', center: 64, n: 4, vol: 0.36 }, bass: { type: 'bass', mode: 'bass' }, tp: { type: 'timp', vol: 0.5 }, gl: { type: 'glock', vol: 0.2 }, dr: { type: 'drums', kit: 'orch' } },
        sections: {
          R: { bars: 2, chords: 'E7sus4 | E7', str: 'x-------x-------', tp: 'e3 e3 e3 e3 e3 e3 e3 e3 | e3 e3 e3 e3 b2 b2 b2 b2', dr: { s: '2323434545656767|7878989899999999' } },
          H: { bars: 4, chords: 'A | D/A | A | E7', br: 'X-----x-x---x---', str: true, bass: '1 - - - 5 - 1 .', gl: 'e6 . c#6 . a5 . . . | f#6 . d6 . a5 . . . | e6 . c#6 . a5 . e6 . | g#6 - - - b5 - - -', dr: { k: 'x.......x.......', y: 'x...............', s: '....x.......x...' } },
        },
        form: ['R', 'H'], loop: 1,
      },
      finale: { from: 'title', bpm: 126, transpose: 3, tracks: { br2: { type: 'brass', mode: 'chord', center: 70, n: 3, vol: 0.34 } },
        sections: { A: { br2: '....x.x.....x...' }, B: { br2: 'x.......x.......' }, A2: { br2: '....x.x.....x...' } } },
    },
    stingers: {
      win: { bpm: 124, tracks: { b: { type: 'brass', vol: 0.6 }, g: { type: 'glock', vol: 0.4 }, d: { type: 'drums', kit: 'orch' } }, bars: 2, parts: { b: 'a4+c#5+e5 . a4+c#5+e5 a4+d5+f#5 - - a4+c#5+e5 - | a4+c#5+e5+a5 - - - - - - -', g: 'e5 . e5 f#5 - - e5 - | a5 - - - - - - -', d: { s: 'x.x.x.....x.....', y: '................|x...............' } } },
      reveal: { bpm: 116, gain: 1, tracks: { b: { type: 'brass', vol: 0.55 }, d: { type: 'drums', kit: 'orch' } }, bars: 1, parts: { b: 'a4+c#5+e5+a5 - - - - - - -', d: { k: 'x', y: 'x' } } },
      good: { bpm: 150, tracks: { g: { type: 'fmkeys', ratio: 3, index: 1.2 }, c: { type: 'glock', vol: 0.3 } }, bars: 1, parts: { g: 'a4 c#5 e5 a5 - - - -', c: '. . . a6 - - - -' } },
      bad: { bpm: 100, tracks: { b: { type: 'mute' } }, bars: 1, parts: { b: 'e4 - eb4 - d4 - - -' } },
      round: { bpm: 128, tracks: { b: { type: 'pluck', dly: 0.3 }, d: { type: 'drums', kit: 'funk' } }, bars: 1, parts: { b: 'a4 e5 a5 . . . . .', d: { cb: 'x.x.............', k: 'x...............' } } },
      hot: { bpm: 132, tracks: { b: { type: 'brass', vol: 0.55 }, s: { type: 'strings', vol: 0.35 }, d: { type: 'drums', kit: 'orch' } }, bars: 2, parts: { b: 'e4 f4 f#4 g4 g#4 a4 bb4 b4 | e4+g#4+b4+e5 - - - - - - -', s: 'e5 - - - - - - - | e5+b5 - - - - - - -', d: { s: '2345678999999999|x...............', y: '................|x...............' } } },
      allin: { bpm: 110, tracks: { b: { type: 'brass', vol: 0.6 }, t: { type: 'timp', vol: 0.6 }, d: { type: 'drums', kit: 'orch' } }, bars: 2, parts: { b: 'a3+e4+a4 - - - . . . . | c4+e4+a4+c5 - - - - - - -', t: 'a2 a2 a2 a2 a2 a2 e2 e2 | a2 - - - - - - -', d: { y: 'x...............|x...............' } } },
    },
    fx: { question: 'round', hot: 'hot', allin: 'allin', reveal: 'reveal', nobody: 'bad', win: 'win' }, // seatRight / seatWrong: a recorded audience (onFx in games/trivia.js)
    sfx: {},
  };
})();
