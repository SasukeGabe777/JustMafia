'use strict';
// Debate Club soundtrack: a pompous little parliament march in B-flat. Brass carries the tune
// over pizzicato strings, a tuba bass and timpani, with a snare that thinks it is very important.
// The prep and voting music ticks like the clock on the chamber wall; speeches get a soft, low
// bed so voices always win; SWAP SIDES gets a frantic G-minor chase; the verdict is a gavel and
// a fanfare.  Cues: title lobby intro think play tense reveal finale + speech, action.
(function () {
  const S = (window.BOX.scores = window.BOX.scores || {});
  const tracks = {
    br: { type: 'brass', vol: 0.42, pan: 0.08, rev: 0.25 },
    hrn: { type: 'brass', mode: 'chord', center: 62, n: 3, vol: 0.26, pan: -0.15, rev: 0.3 },
    pz: { type: 'pizz', mode: 'chord', center: 67, n: 3, vol: 0.4, pan: -0.25 },
    tuba: { type: 'tuba', mode: 'bass', oct: 2, vol: 0.55 },
    glk: { type: 'glock', vol: 0.18, pan: 0.3, oct: 1 },
    tp: { type: 'timp', vol: 0.45 },
    dr: { type: 'drums', kit: 'orch', vol: 0.8 },
  };
  const A = 'Bb | Eb/Bb | F7/A | Bb | Gm | Cm7 F7 | Bb/D Eb | F7sus4 F7';
  const B = 'Eb | Eb/F | Dm7 | Gm7 | Cm7 | F7 | Bb/D Gm7 | C7 F7';
  const melA = 'f4 - bb4 - d5 - bb4 . | eb5 - - d5 c5 - bb4 . | c5 - f5 - eb5 - c5 a4 | bb4 - - - f4 . f4 . | g4 - bb4 - d5 - g5 - | f5 - eb5 - c5 - a4 - | bb4 - d5 - eb5 - g5 - | f5 - - - - - . .';
  const melB = 'g5 . f5 . eb5 . d5 . | c5 - - - . . f5 . | f5 . eb5 . d5 . c5 . | bb4 - - - . . d5 . | eb5 - g5 - eb5 - c5 - | f5 - - - a4 - c5 - | d5 - bb4 - g4 - bb4 - | a4 - - - c5 - eb5 -';
  const march = { s: 'x..x..x.x.xxx.x.', k: 'x.......x.......', c: '' };
  const marchFill = { s: 'x..x..x.x.xxx.x.|x..x..x.xxxxXXXX', k: 'x.......x.......', y: 'x...............|................' };
  S.debate = {
    name: 'Debate Club',
    tenseFrom: [],
    cues: {
      title: {
        bpm: 116, swing16: 0.52, tracks,
        sections: {
          I: { bars: 4, chords: 'Bb | Bb | F7 | F7', tp: 'bb2 . . . bb2 . . . | bb2 . . . bb2 bb2 bb2 . | f2 . . . f2 . . . | f2 f2 f2 f2 f2 f2 f2 f2', hrn: 'X-------........', dr: { s: '................|..........x.x.x.|................|xxxxxxxxXXXXXXXX' } },
          A: { bars: 8, chords: A, br: melA, pz: 'x...x.x.x...x.x.', tuba: '1 . 5 . 1 . 5 .', tp: 'bb2 . . . . . . . | . . . . . . . .', dr: march },
          B: { bars: 8, chords: B, br: melB, hrn: 'x---....x---....', pz: '.x.x.x.x.x.x.x.x', tuba: '1 . 5 . 1 . 3 5', glk: '. . . . . . . . | . . . . f6 . . .', dr: marchFill },
          A2: { bars: 8, chords: A, br: melA, hrn: 'X-------x-------', pz: 'x...x.x.x...x.x.', tuba: '1 . 5 . 1 . 5 .', glk: melA, dr: { ...march, y: 'x' + '.'.repeat(127) } },
        },
        form: ['I', 'A', 'B', 'A2'], loop: 1,
      },
      lobby: { from: 'title', bpm: 104, tracks: { br: { vol: 0.28 }, dr: { vol: 0.55 } }, form: ['A', 'B'], loop: 0,
        sections: { A: { br: false, glk: '. . . . d6 . . . | . . . . bb5 . . .', dr: { k: 'x.......x.......', s: '....g.......g...' } }, B: { br: melB, dr: { k: 'x.......x.......', s: '....x.......x...' } } } },
      intro: { from: 'title', bpm: 120, form: ['I', 'A', 'B', 'A2'] },
      // the chamber clock: prep, the question vote, writing, the ballot
      think: {
        bpm: 96,
        tracks: { mar: { type: 'marimba', mode: 'chord', center: 70, n: 4, vol: 0.32, pan: 0.2, dly: 0.18 }, pz: { type: 'pizz', mode: 'chord', center: 62, n: 3, vol: 0.32, pan: -0.25 }, bass: { type: 'upright', mode: 'bass', vol: 0.5 }, pad: { type: 'strings', mode: 'chord', center: 64, n: 4, vol: 0.16, att: 0.4 }, tk: { type: 'drums', kit: 'orch', vol: 0.55 } },
        sections: {
          A: { bars: 8, chords: 'Gm | Eb | Cm | D7 | Gm | Eb | Am7b5 | D7', mar: '1.3.2.4.3.2.4.3.', pz: 'x.......x.......', bass: '1 . . . 5 . . .', pad: true, tk: { tick: 'x...x...x...x...', tock: '..x...x...x...x.' } },
          B: { bars: 8, chords: 'Cm | F7 | Bb | Eb | Am7b5 | D7 | Gm | D7sus4 D7', mar: '4.3.2.1.2.3.4.2.', pz: 'x...x...x...x...', bass: '1 . 5 . 1 . 5 .', pad: true, tk: { tick: 'x...x...x...x...', tock: '..x...x...x...x.', s: '..............g.' } },
        },
        form: ['A', 'B'], loop: 0,
      },
      // under the speeches: quiet and low, so the debaters are always heard
      speech: {
        bpm: 84,
        tracks: { pad: { type: 'pad', mode: 'chord', center: 60, n: 4, vol: 0.14, cut: 900, att: 0.8, rel: 1.2 }, bass: { type: 'upright', mode: 'bass', vol: 0.3, cut: 500 }, tk: { type: 'drums', kit: 'orch', vol: 0.25 } },
        sections: {
          A: { bars: 8, chords: 'Bbmaj7 | Gm7 | Ebmaj7 | F7sus4 | Bbmaj7 | Gm7 | Cm7 | F7sus4', pad: true, bass: '1 . . . . . 5 .', tk: { tick: 'x.......x.......' } },
        },
        form: ['A'], loop: 0,
      },
      play: { from: 'think', bpm: 104, tracks: { br: { type: 'brass', vol: 0.3, pan: 0.1 } },
        sections: { A: { br: 'g4 - bb4 - d5 - - - | eb5 - d5 - c5 - bb4 - | c5 - eb5 - g5 - - - | f#5 - - - d5 - - - | g4 - bb4 - d5 - - - | eb5 - g5 - f5 - eb5 - | c5 - eb5 - d5 - c5 - | d5 - - - . . . .' }, B: {} } },
      tense: {
        bpm: 132,
        tracks: { str: { type: 'strings', mode: 'chord', center: 62, n: 3, vol: 0.38, att: 0.02, rel: 0.1 }, sb: { type: 'tuba', mode: 'bass', oct: 2, vol: 0.5 }, tp: { type: 'timp', vol: 0.5 }, tk: { type: 'drums', kit: 'orch' }, br: { type: 'brass', vol: 0.3 } },
        sections: {
          A: { bars: 8, chords: 'Gm | Gm | Eb | D7 | Gm | Gm | Cm | D7', str: 'x.xx.xx.x.xx.xx.', sb: '1 1 8 1 1 8 1 5', tp: 'g2 . . . g2 . . . | d2 . . . d2 . d2 d2', tk: { tick: 'x.x.x.x.x.x.x.x.', s: '............x.x.' } },
          B: { bars: 8, chords: 'Cm | D7 | Gm | Eb | Cm | D7 | Eb | D7', str: 'x.xx.xx.x.xx.xx.', sb: '1 1 8 1 1 8 1 5', br: 'g4 - - - a4 - - - | bb4 - - - a4 - - - | g4 - - - d5 - - - | eb5 - - - d5 - - - | c5 - - - d5 - - - | eb5 - - - f#5 - - - | g5 - - - f#5 - eb5 - | d5 - - - - - - -', tk: { tick: 'x.x.x.x.x.x.x.x.', s: '....x.......x...' } },
        },
        form: ['A', 'B'], loop: 0,
      },
      // SWAP SIDES: a frantic chase
      action: {
        bpm: 148,
        tracks: { sb: { type: 'synthbass', mode: 'bass', oct: 2, vol: 0.5 }, br: { type: 'brass', mode: 'chord', center: 64, n: 3, vol: 0.4 }, lead: { type: 'brass', vol: 0.36 }, dr: { type: 'drums', kit: 'std' } },
        sections: {
          A: { bars: 4, chords: 'Gm | Gm | Eb | F', sb: '1 1 8 1 1 8 1 b7', br: 'X..x..x...x.x...', lead: 'g5 f5 d5 bb4 g4 bb4 d5 f5 | g5 - - - f#5 - - - | g5 f5 eb5 c5 g4 c5 eb5 g5 | f5 - - - a5 - - -', dr: { k: 'x...x...x...x...', s: '....x.......x.xx', h: 'xxxxxxxxxxxxxxxx' } },
        },
        form: ['A'], loop: 0,
      },
      reveal: {
        bpm: 112,
        tracks: { br: { type: 'brass', mode: 'chord', center: 66, n: 4, vol: 0.5 }, str: { type: 'strings', mode: 'chord', center: 64, n: 4, vol: 0.36 }, tuba: { type: 'tuba', mode: 'bass', oct: 2, vol: 0.5 }, tp: { type: 'timp', vol: 0.5 }, dr: { type: 'drums', kit: 'orch' } },
        sections: {
          R: { bars: 2, chords: 'F7sus4 | F7', str: 'x-------x-------', tp: 'f2 f2 f2 f2 f2 f2 f2 f2 | f2 f2 f2 f2 c2 c2 c2 c2', dr: { s: '2323434545656767|7878989899999999' } },
          H: { bars: 4, chords: 'Bb | Eb/Bb | Bb | F7', br: 'X-----x-x---x---', str: true, tuba: '1 - - - 5 - 1 .', dr: { k: 'x.......x.......', y: 'x...............', s: '....x.......x...' } },
        },
        form: ['R', 'H'], loop: 1,
      },
      finale: { from: 'title', bpm: 120, transpose: 2, tracks: { hrn: { vol: 0.34 } },
        sections: { A: { hrn: '....x.x.....x...', glk: melA }, B: { hrn: 'x.......x.......' }, A2: { hrn: 'X...x.x.X...x.x.' } } },
    },
    stingers: {
      order: { bpm: 100, gain: 1, tracks: { t: { type: 'timp', vol: 0.7 }, b: { type: 'brass', vol: 0.5 }, d: { type: 'drums', kit: 'orch' } }, bars: 1, parts: { t: 'bb2 . bb2 . . . . .', b: '. . . . bb3+d4+f4+bb4 - - -', d: { y: '........x.......' } } },
      verdict: { bpm: 110, gain: 1, tracks: { b: { type: 'brass', vol: 0.6 }, t: { type: 'timp', vol: 0.6 }, d: { type: 'drums', kit: 'orch' } }, bars: 2, parts: { t: 'bb2 . . . . . . . | . . . . . . . .', b: '. . bb4+d5+f5 . bb4+d5+f5 bb4+eb5+g5 - - | bb4+d5+f5+bb5 - - - - - - -', d: { k: 'x...............', y: 'x...............|x...............' } } },
      tie: { bpm: 100, tracks: { b: { type: 'mute' } }, bars: 1, parts: { b: 'f4 - e4 - eb4 - d4 -' } },
      swap: { bpm: 150, tracks: { b: { type: 'brass', vol: 0.5 }, d: { type: 'drums', kit: 'std' } }, bars: 1, parts: { b: 'g4 bb4 d5 g5 d5 bb4 g4 .', d: { s: 'xxxxxxxxXXXXXXXX' } } },
      hot: { bpm: 140, tracks: { b: { type: 'brass', vol: 0.55 }, d: { type: 'drums', kit: 'std' } }, bars: 1, parts: { b: 'g4+bb4+d5 . g4+bb4+d5 . a4+c5+eb5 - - -', d: { k: 'x.x.x...', s: '....X...' } } },
      win: { bpm: 120, tracks: { b: { type: 'brass', vol: 0.6 }, g: { type: 'glock', vol: 0.4 }, d: { type: 'drums', kit: 'orch' } }, bars: 2, parts: { b: 'bb4+d5+f5 . bb4+d5+f5 bb4+eb5+g5 - - bb4+d5+f5 - | bb4+d5+f5+bb5 - - - - - - -', g: 'f5 . f5 g5 - - f5 - | bb5 - - - - - - -', d: { s: 'x.x.x.....x.....', y: '................|x...............' } } },
      vote: { bpm: 120, tracks: { g: { type: 'marimba', vol: 0.5 } }, bars: 1, parts: { g: 'd5 g5 bb5 d6 . . . .' } },
      good: { bpm: 140, tracks: { g: { type: 'fmkeys', ratio: 3, index: 1.2 } }, bars: 1, parts: { g: 'bb4 d5 f5 bb5 - - - -' } },
      bad: { bpm: 100, tracks: { b: { type: 'mute' } }, bars: 1, parts: { b: 'e4 - eb4 - d4 - - -' } },
    },
    fx: { debate: 'order', court: 'order', gavel: 'verdict', tie: 'tie', swap: 'swap', hot: 'hot', win: 'win', vote: 'vote' },
    sfx: {},
  };
})();
