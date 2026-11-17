'use strict';
// Color Match soundtrack: a Paris paint-studio musette. The theme is a jazzy waltz in G (accordion
// organ "oom-pah-pah", upright bass, clarinet tune, glockenspiel sparkles) for Hugo Hue's studio.
// Gameplay drops into a calm lo-fi 4/4 for mixing (marimba + Rhodes), a ticking pizzicato countdown,
// a drum-roll reveal with a brass "ta-da", and the waltz again, brighter, for the Gallery finale.
// Cues: title lobby intro think play tense reveal finale. Phase mapping: music(s) in
// public/box/games/colormatch.js (intro/look -> play, pick -> think (tense at 10 s), reveal, over).
(function () {
  const S = (window.BOX.scores = window.BOX.scores || {});
  // ---- the waltz (3/4: 12 sixteenths a bar, 6 eighths) ----
  const waltz = {
    acc: { type: 'organ', mode: 'chord', center: 66, n: 3, vol: 0.32, pan: -0.15, trem: 0.35 },
    bass: { type: 'upright', mode: 'bass', oct: 2, vol: 0.8 },
    lead: { type: 'clarinet', vol: 0.42, pan: 0.12, dly: 0.12, vib: 0.5 },
    bell: { type: 'glock', vol: 0.16, pan: 0.3 },
    pad: { type: 'strings', mode: 'chord', center: 62, n: 4, vol: 0.16, cut: 1600 },
    dr: { type: 'drums', kit: 'jazz', vol: 0.7 },
  };
  const WA = 'Gmaj7 | E7 | Am7 | D7 | Bm7 | E7 | Am7 | D7';
  const WB = 'Cmaj7 | Cm6 | Bm7 | E7 | Am7 | D7 | G6 | D7';
  const melA = 'd5 - g5 - b5 - | b5 - g#5 - e5 - | c6 - - - a5 - | f#5 - - - d5 . | d5 - f#5 - a5 - | g#5 - - - b5 - | a5 - g5 - e5 - | f#5 - - - . .';
  const melB = 'e5 - g5 - b5 - | eb5 - g5 - a5 - | d5 - f#5 - a5 - | g#5 - - - . e5 | a5 - c6 - e6 - | d6 - c6 - a5 - | b5 - - - g5 - | a5 - - - . .';
  const oompah = '....x...x...', oom = { k: 'x...........', h: '....x...x...', sh: '..g...g...g.' };
  // ---- the mixing groove (4/4) ----
  const mixTracks = {
    keys: { type: 'epiano', mode: 'chord', center: 64, n: 4, vol: 0.42, trem: 0.3, pan: -0.2 },
    arp: { type: 'marimba', mode: 'chord', center: 72, n: 4, vol: 0.3, pan: 0.25, dly: 0.22 },
    bass: { type: 'bass', mode: 'bass', cut: 650 },
    pad: { type: 'pad', mode: 'chord', center: 64, vol: 0.22, cut: 1300 },
    dr: { type: 'drums', kit: 'lofi', vol: 0.6 },
  };
  S.colormatch = {
    name: 'Color Match',
    cues: {
      title: {
        bpm: 168, beats: 3, steps: 4, swing: 0.56, tracks: waltz,
        sections: {
          I: { bars: 4, chords: 'Gmaj7 | Gmaj7 | Am7 | D7', acc: oompah, bass: '1 . . . . . | 5 . . . . .', bell: 'b5 . d6 . g6 . | f#6 . d6 . b5 . | c6 . e6 . a6 . | f#6 . . . . .', dr: { k: 'x...........', h: '....x...x...' } },
          A: { bars: 8, chords: WA, acc: oompah, bass: '1 . . . . . | 5 . . . . .', lead: melA, dr: oom },
          B: { bars: 8, chords: WB, acc: oompah, pad: true, bass: '1 . . . 5 . | 1 . . . a .', lead: melB, bell: '. . . . . . | . . . . . . | . . . . . . | e6 . . . . .', dr: { ...oom, sn: '..........g.' } },
          A2: { bars: 8, chords: WA, acc: oompah, pad: true, bass: '1 . . . 5 . | 1 . 3 . 5 .', lead: melA, bell: melA, dr: { ...oom, y: 'x' + '.'.repeat(95) } },
        },
        form: ['I', 'A', 'B', 'A2'], loop: 1,
      },
      lobby: { from: 'title', bpm: 150, form: ['A', 'B'], loop: 0,
        sections: { A: { lead: false, bell: '. . b5 . . . | . . g#5 . . . | . . c6 . . . | . . a5 . . .' }, B: { lead: melB, bell: false } } },
      intro: { from: 'title', bpm: 176, form: ['I', 'A', 'A2'], loop: 1 },
      think: {
        bpm: 86, swing16: 0.57, tracks: mixTracks,
        sections: {
          A: { bars: 8, chords: 'Cmaj9 | Am9 | Fmaj9 | G13 | Em9 | A7 | Dm9 | G7sus4', keys: 'x---------x-----', arp: '1.3.2.4.3.1.4.2.', bass: '1 - - - - - 5 . | 1 - - . 5 - - .', pad: true, dr: { k: 'x.......x.x.....', s: '....g.......g...', h: '..x...x...x...x.' } },
          B: { bars: 8, chords: 'Fmaj9 | Em7 | Am9 | Gm9 C9 | Fmaj9 | E7 | Am9 | Dm9 G13', keys: 'x-----x---x-----', arp: '4.2.3.1.2.4.3.1.', bass: '1 - - . 1 - 5 . | 1 - - - 5 - - .', pad: true, dr: { k: 'x.......x.x.....', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' } },
        },
        form: ['A', 'B'], loop: 0,
      },
      play: { from: 'think', bpm: 104,
        tracks: { lead: { type: 'kalimba', vol: 0.42, dly: 0.2, pan: 0.15 }, bell: { type: 'glock', vol: 0.15, pan: -0.3 } },
        sections: {
          A: { lead: 'e5 g5 b5 - a5 g5 e5 - | c5 e5 a5 - g5 e5 c5 - | a4 c5 f5 - e5 c5 a4 - | b4 d5 g5 - f5 d5 b4 - | g5 - e5 - b4 - g5 - | c#5 - e5 - g5 - a5 - | f5 - d5 - a4 - c5 - | d5 - - - . . . .', bell: '. . . . . . . c6 | . . . . . . . . ', dr: { k: 'x.....x...x.....', s: '....x.......x...', h: 'x.x.x.x.x.x.x.xo' } },
          B: { dr: { k: 'x.....x...x..x..', s: '....x.......x...', h: 'xxx.xxx.xxx.xxx.' } },
        } },
      tense: {
        bpm: 132,
        tracks: { pz: { type: 'pizz', mode: 'chord', center: 64, n: 3, vol: 0.45 }, str: { type: 'strings', mode: 'chord', center: 60, n: 3, vol: 0.32, att: 0.03, rel: 0.12 }, sb: { type: 'synthbass', mode: 'bass', oct: 2, vol: 0.45 }, tk: { type: 'drums' }, dr: { type: 'drums', kit: 'std', vol: 0.8 }, lead: { type: 'clarinet', vol: 0.32 } },
        sections: {
          A: { bars: 8, chords: 'Em | Em | C | B7 | Em | Em | Am | B7', pz: 'x.x.x.x.x.x.x.x.', sb: '1 1 8 1 1 8 1 5', str: 'x---------------', tk: { tick: 'x...x...x...x...', tock: '..x...x...x...x.' }, dr: { k: 'x.......x.......', t1: '..............xx' } },
          B: { bars: 8, chords: 'Am | B7 | Em | C | Am | B7 | C | B7', pz: 'x.x.x.x.x.x.x.x.', sb: '1 1 8 1 1 8 1 5', str: 'x-------x-------', lead: 'e5 - - - f#5 - - - | g5 - - - f#5 - - - | e5 - - - b4 - - - | c5 - - - e5 - - - | a5 - - - g5 - - - | f#5 - - - d#5 - - - | e5 - - - g5 - - - | f#5 - - - - - - -', tk: { tick: 'x.x.x.x.x.x.x.x.' }, dr: { k: 'x...x...x...x...', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' } },
        },
        form: ['A', 'B'], loop: 0,
      },
      reveal: {
        bpm: 112,
        tracks: { br: { type: 'brass', mode: 'chord', center: 67, n: 4, vol: 0.46 }, str: { type: 'strings', mode: 'chord', center: 64, n: 4, vol: 0.36 }, bass: { type: 'upright', mode: 'bass' }, gl: { type: 'glock', vol: 0.2 }, tp: { type: 'timp', vol: 0.45 }, dr: { type: 'drums', kit: 'orch' } },
        sections: {
          R: { bars: 2, chords: 'D7sus4 | D7', str: 'x-------x-------', tp: 'd3 d3 d3 d3 d3 d3 d3 d3 | d3 d3 d3 d3 a2 a2 a2 a2', dr: { s: '2323434545656767|7878989899999999' } },
          H: { bars: 4, chords: 'G | C/G | G | D7', br: 'X-----x-x---x---', str: true, bass: '1 - - - 5 - 1 .', gl: 'g6 . d6 . b5 . g5 . | . . . . . . . . | b6 . g6 . d6 . b5 . | . . . . . . . .', dr: { k: 'x.......x.......', y: 'x...............', s: '....x.......x...' } },
          H2: { bars: 4, chords: 'Em | C | Am7 | D7', br: '....x.x.....x...', str: true, bass: '1 - 5 - 1 - 5 -', dr: { k: 'x.......x.......', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' } },
        },
        form: ['R', 'H', 'H2'], loop: 1,
      },
      finale: { from: 'title', bpm: 180, transpose: 2,
        tracks: { br: { type: 'brass', mode: 'chord', center: 67, n: 3, vol: 0.34 } },
        sections: { A: { br: '....x...x...' }, B: { br: 'x...........' }, A2: { br: '....x...x...' } } },
    },
    stingers: {
      win: { bpm: 120, tracks: { b: { type: 'brass', vol: 0.6 }, g: { type: 'glock', vol: 0.4 }, d: { type: 'drums', kit: 'orch' } }, bars: 2, parts: { b: 'g4+b4+d5 . g4+b4+d5 a4+c5+e5 - - b4+d5+g5 - | b4+d5+g5+b5 - - - - - - -', g: 'd6 . d6 e6 - - g6 - | g6 - - - - - - -', d: { s: 'x.x.x.....x.....', y: '................|x...............' } } },
      reveal: { bpm: 112, gain: 1, tracks: { b: { type: 'brass', vol: 0.5 }, g: { type: 'glock', vol: 0.3 }, d: { type: 'drums', kit: 'orch' } }, bars: 1, parts: { b: 'g4+b4+d5+g5 - - - - - - -', g: 'g5 b5 d6 g6 - - - -', d: { k: 'x', y: 'x' } } },
      good: { bpm: 150, tracks: { g: { type: 'glock', vol: 0.5 }, k: { type: 'kalimba', vol: 0.4 } }, bars: 1, parts: { g: 'g5 b5 d6 g6 b6 - - -', k: 'g4 . d5 . g5 - - -' } },
      bad: { bpm: 100, tracks: { b: { type: 'mute' } }, bars: 1, parts: { b: 'e4 - eb4 - d4 - - -' } },
      round: { bpm: 130, tracks: { b: { type: 'pluck', dly: 0.3 }, g: { type: 'glock', vol: 0.25 } }, bars: 1, parts: { b: 'd5 g5 b5 d6 . . . .', g: '. . . . g6 . . .' } },
      flash: { bpm: 160, tracks: { g: { type: 'chime', vol: 0.4 }, s: { type: 'strings', vol: 0.3 } }, bars: 1, parts: { g: 'c6 e6 g6 c7 - - - -', s: 'c5+e5+g5 - - - - - - -' } },
    },
    fx: { round: 'round', look: 'flash', reveal: 'reveal', perfect: 'good', win: 'win' },
    sfx: {},
  };
})();
