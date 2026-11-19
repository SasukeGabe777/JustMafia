'use strict';
// STARTER SCORE for a new JustGameBox game. tools/new-game.js copies this file to
// public/box/scores/<key>.js and replaces undercover with the game's key.
//
// REQUIRED CUES (every game score has all of them; each loops seamlessly):
//   title   the game's title screen (its main theme)
//   lobby   the room lobby while players join (usually a lighter take on the theme)
//   intro   the game-show opening cutscene (ducked under the host's voice)
//   think   calm gameplay: guessing / writing / choosing
//   play    the main gameplay groove
//   tense   countdowns (the TV switches 'think' to 'tense' for the last 10 seconds)
//   reveal  answers / results being revealed
//   finale  game over: the winner and the final scores
// OPTIONAL: any extra cue a game's music(s) returns (e.g. 'action', 'story', 'lose'),
// stingers: { name: one-shot }, fx: { gameFxKind: stinger }, sfx: { sfxName: stinger },
// phaseCue(s) (when the game's client file has no music(s)).
// Format and tips: public/box/scores/README.md. Make it your own: change the key,
// chords, melodies, instruments and tempo so every game has its own sound.
(function () {
  const S = (window.BOX.scores = window.BOX.scores || {});
  const tracks = {
    keys: { type: 'epiano', mode: 'chord', center: 64, n: 4, vol: 0.5, pan: -0.18, trem: 0.25 },
    pad: { type: 'pad', mode: 'chord', center: 67, n: 4, vol: 0.28, cut: 1800 },
    bass: { type: 'bass', mode: 'bass', oct: 2 },
    lead: { type: 'fmkeys', ratio: 3, index: 1.4, vol: 0.5, pan: 0.12, dly: 0.16 },
    bell: { type: 'glock', vol: 0.18, pan: 0.3, oct: 1 },
    dr: { type: 'drums', kit: 'std' },
  };
  const A = 'Fmaj7 | Dm7 | Bbmaj7 | C7sus4 C7 | Fmaj7 | Am7 D7 | Gm7 | C7sus4 C7';
  const B = 'Bbmaj7 | C/Bb | Am7 | Dm7 | Gm7 | Am7 | Bbmaj7 | C7sus4 C7';
  const melA = '. a4 c5 f5 - e5 - c5 | d5 - - - . a4 c5 d5 | f5 - d5 bb4 - . a4 bb4 | c5 - - - - - . . | . a4 c5 f5 - e5 - g5 | a5 - g5 e5 c5 - f#5 - | g5 - f5 d5 - bb4 - d5 | e5 - - - g5 - bb5 -';
  const melB = 'a5 - - - g5 f5 - d5 | e5 - - - - - c5 d5 | e5 - - - d5 c5 - a4 | f5 - - - - - . . | d5 - bb4 - d5 - g5 - | e5 - c5 - e5 - a5 - | g5 - - - f5 - d5 - | e5 - - - - - . .';
  const groove = { k: 'x.....x...x.....', s: '....x.......x...', h: 'x.x.x.x.x.x.x.xo' };
  const fill = { k: 'x.....x...x.....|x.....x...x.x...', s: '....x.......x...|....x.....xgx.XX', h: 'x.x.x.x.x.x.x.xo|x.x.x.x.x.......' };
  S.undercover = {
    name: 'undercover',
    cues: {
      title: {
        bpm: 108, swing16: 0.54, tracks,
        sections: {
          I: { bars: 4, chords: 'Fmaj7 | Dm7 | Bbmaj7 | C7sus4 C7', pad: true, keys: 'x---..x-..x-.x--', bell: 'c5 . a4 . f4 . . . | d5 . a4 . f4 . . . | d5 . bb4 . f4 . . . | e5 . c5 . g4 . bb4 .', dr: { y: 'x...............|................|................|............x.x.' } },
          A: { bars: 8, chords: A, pad: true, keys: '..x-..x-..x-.x-.', bass: '1 - . 1 . 5 8 . | 1 - . 1 5 - 7 5', lead: melA, dr: { ...groove, y: 'x' + '.'.repeat(127) } },
          B: { bars: 8, chords: B, pad: true, keys: 'x--.x--.x--.x-x-', bass: '1 - - 5 1 - 5 . | 1 - . 1 5 - a .', lead: melB, bell: '. . . . . . . . | . . . . c6 . . .', dr: fill },
          A2: { bars: 8, chords: A, pad: true, keys: '..x-..x-..x-.x-.', bass: '1 - . 1 . 5 8 . | 1 - . 1 5 - 7 5', lead: melA, bell: melA, dr: { ...groove, sh: 'xgxgxgxgxgxgxgxg' } },
        },
        form: ['I', 'A', 'B', 'A2'], loop: 1,
      },
      lobby: { from: 'title', bpm: 100, tracks: { lead: { vol: 0.3 } }, form: ['A', 'B'], loop: 0,
        sections: { A: { lead: false, bell: '. . . . c5 . . . | . . . . a4 . . .', dr: { k: 'x.......x.......', s: '....g.......x...', h: '..x...x...x...x.' } }, B: { lead: melB, dr: { k: 'x.......x.......', s: '....x.......x...', sh: 'xgxgxgxgxgxgxgxg' } } } },
      intro: { from: 'title', bpm: 112, form: ['I', 'A', 'B', 'A2'] },
      think: {
        bpm: 90, swing16: 0.56,
        tracks: { keys: { type: 'epiano', mode: 'chord', center: 63, n: 4, vol: 0.45, trem: 0.3, pan: -0.2 }, arp: { type: 'marimba', mode: 'chord', center: 72, n: 4, vol: 0.32, pan: 0.25, dly: 0.2 }, bass: { type: 'bass', mode: 'bass', cut: 600 }, pad: { type: 'pad', mode: 'chord', center: 64, vol: 0.25, cut: 1400 }, dr: { type: 'drums', kit: 'lofi', vol: 0.6 } },
        sections: {
          A: { bars: 8, chords: 'Dm9 | G13 | Cmaj9 | Am9 | Dm9 | G13 | Ebmaj7 | G7sus4', keys: 'x---------x-----', arp: '1.2.3.4.3.2.4.3.', bass: '1 - - - - - 5 . | 1 - - . 5 - - .', pad: true, dr: { k: 'x.......x.x.....', s: '....g.......g...', h: '..x...x...x...x.' } },
          B: { bars: 8, chords: 'Fmaj7 | Em7 | Dm9 | Cmaj9 | Bbmaj7 | Am7 | Abmaj7 | G7sus4', keys: 'x-----x---x-----', arp: '4.3.2.1.2.3.4.2.', bass: '1 - - . 1 - 5 . | 1 - - - 5 - - .', pad: true, dr: { k: 'x.......x.x.....', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' } },
        },
        form: ['A', 'B'], loop: 0,
      },
      play: { from: 'think', bpm: 102, tracks: { lead: { type: 'fmkeys', ratio: 3, index: 1.2, vol: 0.4, dly: 0.2, pan: 0.1 } },
        sections: {
          A: { lead: 'd5 - f5 a5 - g5 - e5 | d5 - - - . . b4 d5 | e5 - g5 b5 - a5 - g5 | e5 - - - . . . . | d5 - f5 a5 - g5 - e5 | d5 - - - . . f5 g5 | g5 - - - f5 - eb5 - | d5 - - - . . . .', dr: { k: 'x.....x...x.....', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' } },
          B: { dr: { k: 'x.....x...x..x..', s: '....x.......x...', h: 'xxx.xxx.xxx.xxx.' } },
        } },
      tense: {
        bpm: 128,
        tracks: { sb: { type: 'synthbass', mode: 'bass', oct: 2, vol: 0.5 }, str: { type: 'strings', mode: 'chord', center: 62, n: 3, vol: 0.4, att: 0.02, rel: 0.1 }, pad: { type: 'pad', mode: 'chord', center: 60, vol: 0.25, cut: 1200 }, tk: { type: 'drums' }, dr: { type: 'drums', kit: 'std' }, lead: { type: 'brass', vol: 0.35 } },
        sections: {
          A: { bars: 8, chords: 'Dm | Dm | Bb | C | Dm | Dm | Bb | A7', sb: '1 1 8 1 1 8 1 5', str: 'x..x..x.x..x..x.', pad: true, tk: { tick: 'x.x.x.x.x.x.x.x.', tock: '' }, dr: { k: 'x...x...x...x...', s: '........x.......', t1: '..............xx' } },
          B: { bars: 8, chords: 'Gm | A7 | Dm | Bb | Gm | A7 | Bb | A7', sb: '1 1 8 1 1 8 1 5', str: 'x..x..x.x..x..x.', pad: true, lead: 'd5 - - - e5 - - - | f5 - - - e5 - - - | d5 - - - a4 - - - | bb4 - - - c5 - - - | d5 - - - e5 - - - | f5 - - - g5 - - - | a5 - - - g5 - f5 - | e5 - - - - - - -', tk: { tick: 'x.x.x.x.x.x.x.x.' }, dr: { k: 'x...x...x...x...', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' } },
        },
        form: ['A', 'B'], loop: 0,
      },
      reveal: {
        bpm: 110,
        tracks: { br: { type: 'brass', mode: 'chord', center: 66, n: 4, vol: 0.5 }, str: { type: 'strings', mode: 'chord', center: 64, n: 4, vol: 0.4 }, bass: { type: 'bass', mode: 'bass' }, tp: { type: 'timp', vol: 0.5 }, dr: { type: 'drums', kit: 'orch' } },
        sections: {
          R: { bars: 2, chords: 'C7sus4 | C7', str: 'x-------x-------', tp: 'c3 c3 c3 c3 c3 c3 c3 c3 | c3 c3 c3 c3 g2 g2 g2 g2', dr: { s: '2323434545656767|7878989899999999' } },
          H: { bars: 4, chords: 'F | Bb/F | F | C7', br: 'X-----x-x---x---', str: true, bass: '1 - - - 5 - 1 .', dr: { k: 'x.......x.......', y: 'x...............', s: '....x.......x...' } },
        },
        form: ['R', 'H'], loop: 1,
      },
      finale: { from: 'title', bpm: 114, transpose: 2, tracks: { br: { type: 'brass', mode: 'chord', center: 67, n: 3, vol: 0.38 } },
        sections: { A: { br: '....x.x.....x...' }, B: { br: 'x.......x.......' }, A2: { br: '....x.x.....x...' } } },
    },
    stingers: {
      win: { bpm: 120, tracks: { b: { type: 'brass', vol: 0.6 }, g: { type: 'glock', vol: 0.4 }, d: { type: 'drums', kit: 'orch' } }, bars: 2, parts: { b: 'c5+e5+g5 . c5+e5+g5 c5+f5+a5 - - c5+e5+g5 - | c5+e5+g5+c6 - - - - - - -', g: 'g5 . g5 a5 - - g5 - | c6 - - - - - - -', d: { s: 'x.x.x.....x.....', y: '................|x...............' } } },
      reveal: { bpm: 110, gain: 1, tracks: { b: { type: 'brass', vol: 0.55 }, d: { type: 'drums', kit: 'orch' } }, bars: 1, parts: { b: 'f4+a4+c5+f5 - - - - - - -', d: { k: 'x', y: 'x' } } },
      good: { bpm: 140, tracks: { g: { type: 'fmkeys', ratio: 3, index: 1.2 } }, bars: 1, parts: { g: 'c5 e5 g5 c6 - - - -' } },
      bad: { bpm: 100, tracks: { b: { type: 'mute' } }, bars: 1, parts: { b: 'e4 - eb4 - d4 - - -' } },
      round: { bpm: 120, tracks: { b: { type: 'pluck', dly: 0.3 } }, bars: 1, parts: { b: 'c5 g5 c6 . . . . .' } },
    },
    sfx: {},
  };
})();
