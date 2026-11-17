'use strict';
// Tune Buzz: late-night radio synth-funk in E minor. A slap synth bass, clav chops, a vibes +
// FM-keys hook that hops like a needle on a record, brass answers in the B section and a funk
// kit. A lo-fi bed for thinking, a ticking countdown for LAST CALL, a horn-band reveal and a
// victory reprise. Stingers: the buzz-in "bzzt-ding", right / wrong, the round jingle and a
// finale fanfare. During clips the game plays its own music (public/box/games/tune.js), so
// music(s) returns null for 'card', 'clip' and 'tap'. Format: public/box/scores/README.md.
(function () {
  const S = (window.BOX.scores = window.BOX.scores || {});
  const tracks = {
    clav: { type: 'clav', mode: 'chord', center: 64, n: 3, vol: 0.3, pan: -0.25 },
    keys: { type: 'epiano', mode: 'chord', center: 62, n: 4, vol: 0.3, pan: 0.2, trem: 0.25 },
    pad: { type: 'pad', mode: 'chord', center: 66, n: 4, vol: 0.18, cut: 1600 },
    bass: { type: 'synthbass', mode: 'bass', oct: 2, vol: 0.85 },
    hook: { type: 'vibes', vol: 0.42, pan: 0.15, dly: 0.16 },
    fm: { type: 'fmkeys', ratio: 3, index: 1.3, vol: 0.26, pan: -0.1 },
    lead: { type: 'brass', vol: 0.34, pan: 0.1 },
    stab: { type: 'brass', mode: 'chord', center: 67, n: 4, vol: 0.28 },
    dr: { type: 'drums', kit: 'funk' },
  };
  const A = 'Em9 | A13 | Gmaj7 | F#7#9 | Em9 | A13 | Gmaj7 | F#7#9';
  const B = 'Cmaj7 | D6 | Bm7 | Em9 | Cmaj7 | D13 | Gmaj7 | B7#9';
  const hookA = 'b5 . g5 b5 - . d6 b5 | c#6 - b5 . a5 . f#5 . | g5 . b5 d6 - . f#6 d6 | e6 - - - d6 - c#6 a#5 | b5 . g5 b5 - . d6 b5 | c#6 - e6 . f#6 . e6 . | d6 - b5 - g5 - f#5 - | f#5 - - - . . . .';
  const leadB = 'e5 - - - g5 - a5 b5 | a5 - - - f#5 - - - | d5 - e5 f#5 - . g5 a5 | b5 - - - . . . . | e5 - - - g5 - a5 b5 | c#6 - - - a5 - f#5 - | g5 - - - b5 - d6 - | d#6 - - - - - . .';
  const funk = { k: 'x.....x...x..x..', s: '....x.......x...', h: 'x.x.x.x.x.x.x.xo' };
  const funk2 = { k: 'x.....x...x..x..', s: '....x..g....x.g.', h: 'xxoxxxoxxxoxxxox', tb: '..x...x...x...x.' };
  const chop = '.x.xx.x..x.x.xx.';
  const slap = '1 . 1 8 . 1 b7 5 | 1 . 1 8 . 5 b7 8';
  S.tune = {
    name: 'Tune Buzz',
    cues: {
      title: {
        bpm: 116, swing16: 0.54, tracks,
        sections: {
          I: { bars: 4, chords: 'Em9 | Em9 | Cmaj7 | B7#9', pad: true, hook: 'b5 . . . g5 . . . | e5 . . . b4 . . . | c6 . . . g5 . . . | f#5 - - - a5 - b5 -', dr: { h: '..x...x...x...x.', k: 'x...............|................|................|............x.x.' } },
          A: { bars: 8, chords: A, clav: chop, bass: slap, hook: hookA, dr: funk },
          B: { bars: 8, chords: B, clav: chop, keys: 'x...x...x...x...', bass: slap, lead: leadB, stab: '................|..........x.x...', dr: funk2 },
          A2: { bars: 8, chords: A, clav: chop, bass: slap, hook: hookA, fm: hookA, stab: 'x.......x.x.....|................', dr: funk2 },
        },
        form: ['I', 'A', 'B', 'A2'], loop: 1,
      },
      lobby: { from: 'title', bpm: 108, form: ['A', 'B'], loop: 0, mute: ['stab', 'lead', 'fm'], sections: { A: { dr: { k: 'x.......x.......', h: '..x...x...x...x.', s: '....g.......x...' } } } },
      intro: { from: 'title', bpm: 118, form: ['I', 'A2'], loop: 1 },
      // Thinking between clips: a lo-fi bed (vibes arpeggio, warm keys, brushed kit).
      think: {
        bpm: 88, swing16: 0.57,
        tracks: { ep: { type: 'epiano', mode: 'chord', center: 62, n: 4, vol: 0.32, trem: 0.3, pan: -0.2 }, arp: { type: 'vibes', mode: 'chord', center: 74, n: 4, vol: 0.24, pan: 0.25, dly: 0.2 }, bass: { type: 'bass', mode: 'bass', cut: 700 }, pad: { type: 'pad', mode: 'chord', center: 64, vol: 0.18, cut: 1200 }, dr: { type: 'drums', kit: 'lofi', vol: 0.6 } },
        sections: {
          A: { bars: 8, chords: 'Em9 | Cmaj9 | Am9 | B7sus4 | Em9 | Cmaj9 | Am9 | B7#9', ep: 'x---------x-----', arp: '1.2.3.4.3.2.4.3.', bass: '1 - - - - - 5 . | 1 - - . 5 - - .', pad: true, dr: { k: 'x.......x.x.....', s: '....g.......g...', h: '..x...x...x...x.' } },
          B: { bars: 8, chords: 'Gmaj7 | F#m7 | Em9 | Dmaj9 | Cmaj7 | Bm7 | Am9 | B7sus4', ep: 'x-----x---x-----', arp: '4.3.2.1.2.3.4.2.', bass: '1 - - . 1 - 5 . | 1 - - - 5 - - .', pad: true, dr: { k: 'x.......x.x.....', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' } },
        },
        form: ['A', 'B'], loop: 0,
      },
      play: { from: 'title', bpm: 120, form: ['A', 'B', 'A2'], loop: 0 },
      // LAST CALL: a pounding ostinato and a ticking clock.
      tense: {
        bpm: 132,
        tracks: { ost: { type: 'synthbass', vol: 0.75 }, stab: { ...tracks.stab, vol: 0.3 }, pad: { type: 'strings', mode: 'chord', center: 66, vol: 0.2 }, dr: { type: 'drums', kit: 'funk' }, clk: { type: 'drums' }, hook: { type: 'vibes', vol: 0.3 } },
        sections: {
          A: { bars: 4, chords: 'Em | Em | F/E | Em', ost: 'e2 e2 e3 e2 g2 e2 b2 e2', pad: true, clk: { tick: 'x.x.x.x.x.x.x.x.' }, dr: { k: 'x...x...x...x...', s: '....x.......x...', h: 'xxxxxxxxxxxxxxxx' } },
          B: { bars: 4, chords: 'C | B7 | C | B7#9', ost: 'c2 c2 c3 c2 b1 b1 b2 b1', stab: 'X.....x.....x...', pad: true, hook: 'e6 . . . d#6 . . . | e6 . . . f#6 . . . | g6 . . . f#6 . . . | d#6 - - - - - . .', clk: { tick: 'xxxxxxxxxxxxxxxx' }, dr: { k: 'x.x.x.x.x.x.x.x.', s: '....x.......x...', h: 'xxxxxxxxxxxxxxxx' } },
        },
        form: ['A', 'B'], loop: 0,
      },
      // Answers revealed: a drum fill, then a horn-band hit.
      reveal: {
        bpm: 112,
        tracks: { br: { type: 'brass', mode: 'chord', center: 67, n: 4, vol: 0.45 }, clav: tracks.clav, bass: { type: 'synthbass', mode: 'bass', oct: 2, vol: 0.8 }, hook: { type: 'vibes', vol: 0.35 }, dr: { type: 'drums', kit: 'funk' } },
        sections: {
          R: { bars: 1, chords: 'B7#9', br: 'x-----------x---', dr: { s: '..x.x.xxxxxxXXXX', k: 'x...........x...' } },
          H: { bars: 4, chords: 'Em9 | A13 | Cmaj7 | B7#9', br: 'X-----x-x---x---', clav: chop, bass: slap, hook: 'b5 . d6 . e6 - - - | c#6 . b5 . a5 - - - | g5 . b5 . e6 - - - | d#6 - - - f#6 - - -', dr: funk },
        },
        form: ['R', 'H'], loop: 1,
      },
      finale: { from: 'title', bpm: 120, transpose: 2, tracks: { br: { type: 'brass', mode: 'chord', center: 67, n: 3, vol: 0.36 } }, form: ['A2', 'B', 'A2'], loop: 0,
        sections: { A2: { br: '....x.x.....x...' }, B: { br: 'x.......x.......' } } },
    },
    stingers: {
      // The buzz-in: a short game-show "bzzt" and a bright bell.
      buzz: (X) => { X.tone({ at: 0, dur: 0.16, f0: 196, wave: 'sawtooth', vol: 0.18, lp: 1800 }); X.tone({ at: 0, dur: 0.16, f0: 233, wave: 'square', vol: 0.08, lp: 1500 }); X.note('chime', 'e6', 0.14, 0.5, 0.6); },
      right: { bpm: 150, tracks: { v: { type: 'vibes', vol: 0.5 }, g: { type: 'glock', vol: 0.3 } }, bars: 1, parts: { v: 'e5 g5 b5 e6 - - - -', g: '. . . e6 - - - -' } },
      wrong: (X) => { X.tone({ at: 0, dur: 0.45, f0: 110, wave: 'sawtooth', vol: 0.2, lp: 900 }); X.tone({ at: 0, dur: 0.45, f0: 116, wave: 'square', vol: 0.1, lp: 700 }); },
      round: { bpm: 128, tracks: { v: { type: 'vibes', vol: 0.5, dly: 0.25 }, b: { type: 'synthbass', vol: 0.6 }, d: { type: 'drums', kit: 'funk' } }, bars: 1, parts: { v: 'e5 b5 e6 g6 - - . .', b: 'e2 . e3 . e2 - - -', d: { k: 'x.....x.........', s: '....x...x.x.X...', y: 'x...............' } } },
      finale: { bpm: 112, tracks: { b: { type: 'brass', vol: 0.6 }, d: { type: 'drums', kit: 'orch' }, g: { type: 'glock', vol: 0.35 } }, bars: 2, parts: { b: 'e4+g4+b4 . e4+g4+b4 e4+a4+c#5 - - e4+g4+b4+e5 - | f#4+a#4+c#5+e5 - - - - - - -', g: 'b5 . b5 c#6 - - e6 - | f#6 - - - - - - -', d: { s: 'x.x.x.....x.....', y: '................|x...............' } } },
      reveal: { bpm: 112, gain: 1, tracks: { b: { type: 'brass', vol: 0.55 }, d: { type: 'drums', kit: 'funk' } }, bars: 1, parts: { b: 'e4+g4+b4+d5 - - - - - - -', d: { k: 'x', y: 'x' } } },
      nobody: { bpm: 90, tracks: { b: { type: 'mute', vol: 1 } }, bars: 2, parts: { b: 'g4 - f#4 - f4 - - - | e4 - - - - - - -' } },
      tick: (X) => { X.drum('wb', 0, 0.9); X.drum('tick', 0, 1); X.note('glock', 'e6', 0, 0.2, 0.4); },
      win: { bpm: 120, tracks: { b: { type: 'brass', vol: 0.6 }, v: { type: 'vibes', vol: 0.4 }, d: { type: 'drums', kit: 'funk' } }, bars: 2, parts: { b: 'e4+g4+b4 . e4+g4+b4 f#4+a4+c#5 - - g4+b4+d5 - | e4+g4+b4+e5 - - - - - - -', v: 'b5 . b5 c#6 - - d6 - | e6 - - - - - - -', d: { s: 'x.x.x.....x.....', y: '................|x...............' } } },
    },
    fx: { buzz: 'buzz', right: 'right', wrong: 'wrong', lockout: 'wrong', round: 'round', finale: 'finale', reveal: 'reveal', nobody: 'nobody', last: 'tick', win: 'win' },
    sfx: {},
  };
})();
