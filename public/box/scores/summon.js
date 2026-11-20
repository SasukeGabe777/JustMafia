'use strict';
// JustSummon soundtrack: an epic cartoon war score in D minor. War drums (orchestral toms and
// timpani), marching strings, a brass call-to-arms theme and a choir pad.
//   title   the theme: horn call, then the full army march
//   lobby   the march at rest (drums low, no lead)
//   intro   the theme with a bigger drum intro (the cutscene)
//   think   the war drums before the charge (ready phase)
//   play    the battle: driving string ostinato + brass theme
//   tense   a fortress is low or the FINAL CHARGE: faster, choir and pounding toms
//   reveal  fanfare; finale  the victory march in D major
// Stingers: summon, clash, basehit, tier, keepdown, meteor, rally, surge, win (+ good/bad/round).
(function () {
  const S = (window.BOX.scores = window.BOX.scores || {});
  const tracks = {
    str: { type: 'strings', mode: 'chord', center: 62, n: 4, vol: 0.4, pan: -0.15 },
    choir: { type: 'choir', mode: 'chord', center: 65, n: 3, vol: 0.22, cut: 2200 },
    bass: { type: 'bass', mode: 'bass', oct: 2, vol: 0.55 },
    horn: { type: 'brass', vol: 0.45, pan: 0.1, rev: 0.25 },
    flute: { type: 'flute', vol: 0.25, pan: 0.3, dly: 0.12 },
    tp: { type: 'timp', vol: 0.5 },
    dr: { type: 'drums', kit: 'orch' },
  };
  const A = 'Dm | Bb | F | C | Dm | Bb | Gm | A7';
  const B = 'Gm | Dm | Bb | F | Gm | Dm | Eb | A7';
  const call = 'd4 - - a4 - - d5 - | f5 - e5 d5 c5 - - - | . . . . . . . . | . . . . . . . .';
  const themeA = 'd5 - - a4 d5 - f5 - | e5 - d5 - c5 - - - | f5 - - c5 f5 - a5 - | g5 - f5 - e5 - - - | d5 - - a4 d5 - f5 - | g5 - f5 - d5 - bb4 - | bb4 - c5 - d5 - g5 - | e5 - - - c#5 - - -';
  const themeB = 'bb4 - d5 - g5 - - - | a5 - g5 f5 - - a4 - | bb4 - d5 - f5 - - - | a5 - c6 - a5 - - - | g5 - - bb5 a5 - g5 - | f5 - - a5 g5 - f5 - | eb5 - g5 - bb5 - g5 - | a5 - - - c#6 - - -';
  const march = { k: 'x.......x.x.....', s: '....x.......x..x', t1: '..............x.', y: 'x' + '.'.repeat(127) };
  S.summon = {
    name: 'summon',
    cues: {
      title: {
        bpm: 104, tracks,
        sections: {
          I: { bars: 4, chords: 'Dm | Dm | Bb | A7', choir: true, horn: call, tp: 'd3 . . . d3 . d3 . | d3 . . . d3 . d3 . | bb2 . . . bb2 . bb2 . | a2 . a2 . a2 a2 a2 a2', dr: { y: 'x...............|................|................|............x.x.' } },
          A: { bars: 8, chords: A, str: 'x.x.x.xxx.x.x.xx', choir: true, bass: '1 . 1 1 5 . 1 . | 1 . 1 1 5 . 8 .', horn: themeA, dr: march },
          B: { bars: 8, chords: B, str: 'x--.x--.x--.x-x-', choir: true, bass: '1 - - 5 1 - 5 . | 1 - . 1 5 - 1 .', horn: themeB, flute: themeB, dr: { k: 'x.......x.......', s: '....x.......x...', t1: 'x.x.....x.x.....', t2: '......x.......xx' } },
          A2: { bars: 8, chords: A, str: 'x.x.x.xxx.x.x.xx', choir: true, bass: '1 . 1 1 5 . 1 . | 1 . 1 1 5 . 8 .', horn: themeA, flute: themeA, tp: 'd3 . . . . . . . | a2 . . . . . . .', dr: { ...march, t2: '..x...x...x...x.' } },
        },
        form: ['I', 'A', 'B', 'A2'], loop: 1,
      },
      lobby: { from: 'title', bpm: 96, tracks: { horn: { vol: 0.3 }, choir: { vol: 0.15 } }, form: ['A', 'B'], loop: 0,
        sections: { A: { horn: false, flute: themeA, dr: { k: 'x.......x.......', t1: '......x.......x.' } }, B: { horn: false, dr: { k: 'x.......x.......', s: '....g.......g...' } } } },
      intro: { from: 'title', bpm: 108, form: ['I', 'A', 'B', 'A2'] },
      think: {
        bpm: 100,
        tracks: { str: { type: 'strings', mode: 'chord', center: 57, n: 3, vol: 0.32, att: 0.03 }, bass: { type: 'bass', mode: 'bass', oct: 2, vol: 0.5 }, tp: { type: 'timp', vol: 0.55 }, dr: { type: 'drums', kit: 'orch' }, choir: { type: 'choir', mode: 'chord', center: 62, n: 3, vol: 0.18 } },
        sections: {
          A: { bars: 4, chords: 'Dm | Dm | Bb | A', str: 'x..x..x.x..x..x.', bass: '1 . . 1 . . 1 .', tp: 'd3 . . d3 . . d3 d3 | d3 . . d3 . . d3 d3 | bb2 . . bb2 . . bb2 bb2 | a2 . a2 . a2 a2 a2 a2', dr: { k: 'x..x..x.x..x..x.', t1: '..x...x...x...x.', t2: '...........x..xx' } },
          B: { bars: 4, chords: 'Dm | Dm | Bb | A7', str: 'xxxxxxxxxxxxxxxx', choir: true, bass: '1 1 1 1 1 1 1 1', tp: 'd3 d3 d3 d3 d3 d3 d3 d3 | d3 d3 d3 d3 d3 d3 d3 d3 | bb2 bb2 bb2 bb2 bb2 bb2 bb2 bb2 | a2 a2 a2 a2 a2 a2 a2 a2', dr: { k: 'x.x.x.x.x.x.x.x.', t1: 'x.x.x.x.x.x.x.x.', t2: '.x.x.x.x.x.x.x.x', y: '...............x' } },
        },
        form: ['A', 'B'], loop: 0,
      },
      play: {
        bpm: 124, tracks,
        sections: {
          A: { bars: 8, chords: A, str: 'x.xxx.xxx.xxx.xx', bass: '1 1 1 1 5 5 1 1', horn: themeA, dr: { k: 'x.....x.x.......', s: '....x.......x...', t1: '..x.......x.....', y: 'x' + '.'.repeat(127) } },
          B: { bars: 8, chords: B, str: 'x.xxx.xxx.xxx.xx', choir: true, bass: '1 1 1 1 5 5 1 1', flute: themeB, dr: { k: 'x.....x.x.....x.', s: '....x.......x.xx', t2: 'x...x...x...x...' } },
          C: { bars: 8, chords: 'Dm | C | Bb | A | Dm | C | Bb A | Dm', str: 'xxxxxxxxxxxxxxxx', choir: true, bass: '1 . 1 . 1 . 1 .', horn: 'a4 - d5 - f5 - a5 - | g5 - - - e5 - c5 - | f5 - - - d5 - bb4 - | c#5 - - - e5 - a5 - | a5 - - - f5 - d5 - | g5 - - - e5 - c5 - | d5 - bb4 - e5 - c#5 - | d5 - - - - - - -', dr: { k: 'x.x.x.x.x.x.x.x.', s: '....x.......x...', t1: 'x...x...x...x...', y: 'x' + '.'.repeat(63) } },
        },
        form: ['A', 'B', 'A', 'C'], loop: 0,
      },
      tense: {
        bpm: 138,
        tracks: { str: { type: 'strings', mode: 'chord', center: 60, n: 3, vol: 0.4, att: 0.01, rel: 0.08 }, sb: { type: 'synthbass', mode: 'bass', oct: 2, vol: 0.45 }, choir: { type: 'choir', mode: 'chord', center: 64, n: 3, vol: 0.3 }, horn: { type: 'brass', vol: 0.4 }, tp: { type: 'timp', vol: 0.55 }, dr: { type: 'drums', kit: 'orch' } },
        sections: {
          A: { bars: 8, chords: 'Dm | Dm | Bb | C | Dm | Dm | Eb | A7', str: 'x.xx.xx.x.xx.xx.', sb: '1 1 8 1 1 8 1 5', choir: true, tp: 'd3 . d3 . d3 . d3 d3', dr: { k: 'x...x...x...x...', t1: '..x...x...x...x.', t2: '...x...x...x..xx' } },
          B: { bars: 8, chords: 'Gm | A7 | Dm | Bb | Gm | A7 | Bb | A7', str: 'x.xx.xx.x.xx.xx.', sb: '1 1 8 1 1 8 1 5', choir: true, horn: 'd5 - - - e5 - - - | f5 - - - e5 - - - | d5 - - - a4 - - - | bb4 - - - c5 - - - | d5 - - - e5 - - - | f5 - - - g5 - - - | a5 - - - g5 - f5 - | e5 - - - c#5 - - -', dr: { k: 'x.x.x.x.x.x.x.x.', s: '....x.......x...', t1: 'x.x.x.x.x.x.x.x.', y: 'x' + '.'.repeat(63) } },
        },
        form: ['A', 'B'], loop: 0,
      },
      reveal: {
        bpm: 110,
        tracks: { br: { type: 'brass', mode: 'chord', center: 66, n: 4, vol: 0.5 }, str: { type: 'strings', mode: 'chord', center: 64, n: 4, vol: 0.4 }, bass: { type: 'bass', mode: 'bass' }, tp: { type: 'timp', vol: 0.5 }, dr: { type: 'drums', kit: 'orch' } },
        sections: {
          R: { bars: 2, chords: 'A7sus4 | A7', str: 'x-------x-------', tp: 'a2 a2 a2 a2 a2 a2 a2 a2 | a2 a2 a2 a2 e2 e2 e2 e2', dr: { s: '2323434545656767|7878989899999999' } },
          H: { bars: 4, chords: 'D | G/D | D | A7', br: 'X-----x-x---x---', str: true, bass: '1 - - - 5 - 1 .', dr: { k: 'x.......x.......', y: 'x...............', s: '....x.......x...' } },
        },
        form: ['R', 'H'], loop: 1,
      },
      finale: {
        bpm: 112,
        tracks: { ...tracks, br: { type: 'brass', mode: 'chord', center: 66, n: 3, vol: 0.35 } },
        sections: {
          A: { bars: 8, chords: 'D | G | Bm | A | D | G | Em A | D', str: 'x.x.x.xxx.x.x.xx', choir: true, bass: '1 . 1 1 5 . 1 . | 1 . 1 1 5 . 8 .', horn: 'd5 - - a4 d5 - f#5 - | g5 - f#5 - e5 - - - | f#5 - - d5 f#5 - b5 - | a5 - - - e5 - - - | d5 - - a4 d5 - f#5 - | g5 - b5 - d6 - b5 - | a5 - g5 - e5 - c#5 - | d5 - - - - - - -', br: '....x.x.....x...', dr: { ...march, y: 'x...............' } },
          B: { bars: 8, chords: 'G | D | Em | A | G | D | Em A | D', str: true, choir: true, bass: '1 - - 5 1 - 5 .', flute: 'b5 - a5 - g5 - f#5 - | a5 - - - f#5 - d5 - | e5 - g5 - b5 - g5 - | a5 - - - - - - - | b5 - a5 - g5 - f#5 - | a5 - d6 - a5 - f#5 - | g5 - e5 - c#5 - e5 - | d5 - - - - - - -', br: 'x.......x.......', dr: { k: 'x.......x.......', s: '....x.......x...', t1: 'x.x.....x.x.....' } },
        },
        form: ['A', 'B', 'A'], loop: 0,
      },
    },
    stingers: {
      summon: { bpm: 160, gain: 0.5, tracks: { b: { type: 'brass', vol: 0.4 }, d: { type: 'drums', kit: 'orch' } }, bars: 1, parts: { b: 'd5 a5 - - . . . .', d: { t1: 'x...............' } } },
      clash: { bpm: 140, gain: 0.7, tracks: { d: { type: 'drums', kit: 'orch' }, b: { type: 'brass', vol: 0.45 } }, bars: 1, parts: { d: { k: 'x...............', y: 'x...............', s: 'x...............' }, b: 'd5+f5+a5 - . . . . . .' } },
      basehit: { bpm: 100, gain: 0.8, tracks: { t: { type: 'timp', vol: 0.7 }, b: { type: 'tuba', vol: 0.5 }, d: { type: 'drums', kit: 'orch' } }, bars: 1, parts: { t: 'd2 . d2 . . . . .', b: 'd2 - - - . . . .', d: { k: 'x.......' } } },
      tier: { bpm: 120, tracks: { b: { type: 'brass', vol: 0.6 }, c: { type: 'choir', vol: 0.4 }, d: { type: 'drums', kit: 'orch' } }, bars: 2, parts: { b: 'd5 . d5 f5 a5 - - - | d5+f#5+a5+d6 - - - - - - -', c: '. . . . . . . . | d5+f#5+a5 - - - - - - -', d: { s: 'x.x.x...........', y: '................|x...............' } } },
      keepdown: { bpm: 90, tracks: { t: { type: 'timp', vol: 0.7 }, b: { type: 'brass', vol: 0.55 }, d: { type: 'drums', kit: 'orch' } }, bars: 2, parts: { t: 'a2 a2 a2 a2 d2 - - - | . . . . . . . .', b: '. . . . a3+c4+e4 - - - | bb3+d4+f4 - - - - - - -', d: { y: '........x.......', k: '........x.......' } } },
      meteor: { bpm: 120, tracks: { s: { type: 'strings', vol: 0.4 }, d: { type: 'drums', kit: 'orch' } }, bars: 1, parts: { s: 'a5 g5 f5 e5 d5 c5 bb4 a4', d: { t1: '..........x.x.xx', y: '...............x' } } },
      rally: { bpm: 112, tracks: { b: { type: 'brass', vol: 0.65, rev: 0.4 } }, bars: 2, parts: { b: 'a4 - - d5 - - f5 - | a5 - - - - - - -' } },
      surge: { bpm: 130, tracks: { b: { type: 'brass', vol: 0.6 }, d: { type: 'drums', kit: 'orch' } }, bars: 2, parts: { b: 'd5 d5 d5 f5 - d5 - a5 | d6 - - - - - - -', d: { t1: 'x.x.x.x.x.x.x.x.', y: '................|x...............' } } },
      win: { bpm: 120, tracks: { b: { type: 'brass', vol: 0.6 }, g: { type: 'glock', vol: 0.4 }, d: { type: 'drums', kit: 'orch' } }, bars: 2, parts: { b: 'd5+f#5+a5 . d5+f#5+a5 d5+g5+b5 - - d5+f#5+a5 - | d5+f#5+a5+d6 - - - - - - -', g: 'a5 . a5 b5 - - a5 - | d6 - - - - - - -', d: { s: 'x.x.x.....x.....', y: '................|x...............' } } },
      reveal: { bpm: 110, gain: 1, tracks: { b: { type: 'brass', vol: 0.55 }, d: { type: 'drums', kit: 'orch' } }, bars: 1, parts: { b: 'd4+f#4+a4+d5 - - - - - - -', d: { k: 'x', y: 'x' } } },
      good: { bpm: 140, tracks: { g: { type: 'brass', vol: 0.4 } }, bars: 1, parts: { g: 'd5 f#5 a5 d6 - - - -' } },
      bad: { bpm: 100, tracks: { b: { type: 'mute' } }, bars: 1, parts: { b: 'e4 - eb4 - d4 - - -' } },
      round: { bpm: 120, tracks: { t: { type: 'timp', vol: 0.6 } }, bars: 1, parts: { t: 'd3 . a2 . d3 - - -' } },
    },
    // charge: a recorded war horn in games/summon.js onFx instead
    fx: { ready: 'round', tier: 'tier', keepdown: 'keepdown', meteor: 'meteor', rally: 'rally', surge: 'surge', win: 'win' },
    sfx: {},
  };
})();
