'use strict';
// JustKingdoms: medieval epic in D dorian, mostly 6/8 (beats: 2, steps: 3 -> each step is
// an eighth note). Choir, strings, low horns, lute and harp, taiko and frame drums; a
// tavern jig with recorder for the lobby; war drums when time runs short; a D-major
// coronation for the finale.
(function () {
  const S = (window.BOX.scores = window.BOX.scores || {});
  const tracks = {
    choir: { type: 'choir', mode: 'chord', center: 62, n: 3, vol: 0.3 },
    str: { type: 'strings', mode: 'chord', center: 60, n: 4, vol: 0.32 },
    horn: { type: 'brass', res: 1, vol: 0.4, bright: 0.75, pan: -0.1 },
    low: { type: 'brass', mode: 'chord', center: 50, n: 3, vol: 0.3, bright: 0.6 },
    lute: { type: 'lute', mode: 'chord', center: 62, n: 4, vol: 0.4, pan: 0.25 },
    harp: { type: 'harp', mode: 'chord', center: 69, n: 4, vol: 0.28, pan: -0.3 },
    bass: { type: 'strings', mode: 'bass', res: 1, oct: 2, vol: 0.45, cut: 1400, hp: 35 },
    timp: { type: 'timp', res: 1, vol: 0.5 },
    dr: { type: 'drums', kit: 'world' },
  };
  const m68 = { beats: 2, steps: 3 };
  const A = 'Dm | C | Bb | C | Dm | G | Bb C | Dm';
  const B = 'Bb | F | C | Dm | Bb | F | Gm | A';
  const theme = 'd5 - - f5 - e5 | e5 - - c5 - - | d5 - - bb4 - c5 | c5 - - - - - | a5 - - f5 - d5 | b5 - - g5 - d5 | f5 - - g5 - - | d5 - - - - -';
  const themeB = 'f5 - - d5 - - | c5 - - a4 - - | e5 - - g5 - - | f5 - - - - - | d6 - - bb5 - - | a5 - - f5 - - | g5 - - bb5 - - | c#6 - - - - -';
  const march = { k: 'x.....x..x..', fd: '...x.....x..' };
  S.kingdoms = {
    name: 'JustKingdoms',
    cues: {
      title: {
        bpm: 60, ...m68, tracks,
        sections: {
          I: { bars: 4, chords: 'Dm | Dm | Bb | C', str: true, choir: '............|x-----------|x-----------|x-----------', harp: '123456123456', timp: 'd2 - - - - - | . . . . . . | d2 - - - - - | c3 - - c3 c3 c3', dr: { k: 'x...........' } },
          A: { bars: 8, chords: A, str: true, lute: '123432', bass: '1 - - 5 - -', horn: theme, dr: march },
          B: { bars: 8, chords: B, choir: true, str: { p: true, vol: 0.22 }, harp: '123456123456', bass: '1 - - 5 - -', horn: themeB, low: 'x-----------', dr: { ...march, y: 'x' + '.'.repeat(47) } },
          A2: { bars: 8, chords: A, choir: true, str: true, lute: '123432', bass: '1 - - 5 - -', horn: theme, low: 'x-----x-----', timp: 'd2 - - a2 - - | c3 - - - - - | bb2 - - - - - | c3 - - c3 - - | d2 - - a2 - - | g2 - - - - - | bb2 - - c3 - - | d2 - - - - -', dr: { k: 'x.....x..x..', fd: 'x..x..x..x..', tk: 'x...........' } },
        },
        form: ['I', 'A', 'B', 'A2'], loop: 1,
      },
      // The tavern: a jig with recorder and lute.
      lobby: {
        bpm: 104, ...m68,
        tracks: { rec: { type: 'flute', res: 1, vol: 0.42, pan: 0.15, vib: 6 }, lute: { ...tracks.lute, vol: 0.42 }, bass: { type: 'lute', mode: 'bass', res: 1, oct: 2, vol: 0.6 }, dr: { type: 'drums', kit: 'world', vol: 0.6 } },
        sections: {
          A: { bars: 8, chords: 'Dm | C | Dm | C | Dm | F | C | Dm', lute: 'x..x..', bass: '1 . . 5 . .', rec: 'a5 g5 f5 e5 f5 d5 | e5 d5 c5 e5 g5 e5 | a5 g5 f5 e5 f5 a5 | g5 - e5 c5 - - | d5 e5 f5 a5 g5 f5 | c6 a5 f5 c5 d5 e5 | g5 f5 e5 c5 d5 e5 | d5 - - - - -', dr: { fd: 'x..x..', tb: '.x..x.' } },
          B: { bars: 8, chords: 'F | C | Dm | Am | Bb | F | C | Dm', lute: 'x..x..', bass: '1 . . 5 . .', rec: 'c6 - a5 f5 - a5 | g5 - e5 c5 - e5 | f5 - d5 a4 - d5 | e5 - c5 a4 - - | d5 f5 bb5 d6 - bb5 | c6 - a5 f5 - c5 | e5 g5 c6 e5 - c5 | d5 - - - - -', dr: { fd: 'x..x..', tb: '.xx.xx' } },
        },
        form: ['A', 'B'], loop: 0,
      },
      intro: { from: 'title', bpm: 64 },
      think: { from: 'play', bpm: 54, mute: ['dr', 'horn'] },
      // Ruling the realm: strategic, steady.
      play: {
        bpm: 62, ...m68, tracks,
        sections: {
          A: { bars: 8, chords: 'Dm | Dm | C | C | Bb | Bb | C | A', lute: '123432', str: true, bass: '1 - - - - -', harp: '............|............|............|.......654321', dr: { k: 'x...........', fd: '......x..x..' } },
          B: { bars: 8, chords: 'Dm | G | Dm | G | Bb | F | Gm | A', lute: '123432', str: true, bass: '1 - - - - -', horn: 'a4 - - d5 - - | b4 - - - - - | a4 - - f5 - - | g5 - - - - - | f5 - - d5 - - | c5 - - a4 - - | bb4 - - d5 - - | c#5 - - - - -', choir: { p: true, vol: 0.18 }, dr: { k: 'x.....x.....', fd: '...x.....x..' } },
        },
        form: ['A', 'B'], loop: 0,
      },
      // Time running out / war: driving 4/4 drums.
      tense: {
        bpm: 132,
        tracks: { ost: { type: 'strings', mode: 'chord', center: 62, n: 2, att: 0.008, rel: 0.06, vol: 0.42, len: 0.6 }, low: tracks.low, choir: tracks.choir, tuba: { type: 'tuba', mode: 'bass', res: 4, vol: 0.5 }, dr: tracks.dr, orch: { type: 'drums', kit: 'orch' } },
        sections: {
          A: { bars: 4, chords: 'Dm | Bb | C | Dm', ost: '1212121212121212', tuba: '1 1 1 1', low: 'x---------------', dr: { k: 'x..x..x.x..x..x.', fd: '....x.......x...', tk: 'x...............' } },
          B: { bars: 4, chords: 'Gm | Bb | C | A', ost: '1212121212121212', tuba: '1 1 1 1', choir: true, low: 'x-------x-------', dr: { k: 'x..x..x.x..x..x.', fd: 'x.x.x.x.x.x.x.x.', tk: 'x.......x.......' }, orch: { y: '................|................|................|x...............' } },
        },
        form: ['A', 'B'], loop: 0,
      },
      reveal: {
        bpm: 64, ...m68,
        tracks: { horn: tracks.horn, low: tracks.low, str: tracks.str, choir: tracks.choir, timp: tracks.timp, dr: tracks.dr },
        sections: { R: { bars: 4, chords: 'Bb | C | Dm | Dm', horn: 'f5 - - d5 - f5 | g5 - - e5 - g5 | a5 - - - - - | a5 - - - - -', low: 'x-----x-----', str: true, choir: true, timp: 'bb2 - - - - - | c3 - - c3 c3 c3 | d2 - - - - - | . . . . . .', dr: { tk: 'x...........', k: 'x..x..' } } },
        form: ['R'], loop: 0,
      },
      // The coronation.
      finale: {
        bpm: 64, ...m68, tracks: { ...tracks, bell: { type: 'cbell', vol: 0.25 } },
        sections: {
          A: { bars: 8, chords: 'D | G | A | D | Bm | G | A | D', str: true, choir: true, lute: '123432', bass: '1 - - 5 - -', horn: 'd5 - - f#5 - a5 | b5 - - g5 - - | a5 - - c#6 - e6 | d6 - - - - - | f#5 - - b5 - d6 | d6 - - b5 - g5 | a5 - - e5 - c#5 | d5 - - - - -', bell: 'd5 - - - - - | . . . . . . | . . . . . . | . . . . . .', timp: 'd2 - - a2 - - | . . . . . . | a2 - - a2 - - | d2 - - - - -', dr: { k: 'x.....x..x..', fd: 'x..x..x..x..', y: 'x...........|............|............|............' } },
        },
        form: ['A'], loop: 0,
      },
    },
    stingers: {
      win: { bpm: 70, beats: 2, steps: 3, tracks: { h: { type: 'brass', res: 1, bright: 1.1 }, c: { type: 'choir', mode: 'chord', center: 62, n: 3 }, d: { type: 'drums', kit: 'orch' } }, chords: 'A | D', bars: 2, parts: { h: 'a4 - d5 e5 - f#5 | a5 - - - - -', c: '......|x-----', d: { y: '......|x.....', k: '......|x.....' } } },
      capture: (X) => { X.drum('tk', 0, 1); X.chord('brass', ['d3', 'a3', 'd4'], 0.02, 0.9, 0.9, 0, { bright: 0.7 }); },
      rebel: (X) => { X.note('brass', 'd4', 0, 0.3, 0.9, { bright: 0.6 }); X.note('brass', 'a4', 0.3, 1, 1, { bright: 0.6 }); X.drum('tk', 0.3, 0.8); },
      alliance: (X) => { X.chord('choir', ['d4', 'f#4', 'a4'], 0, 1.6, 0.8); X.chord('harp', ['d5', 'f#5', 'a5', 'd6'], 0, 1, 0.6, 0.06); },
      betray: (X) => { X.chord('strings', ['d4', 'eb4', 'a4'], 0, 1, 1, 0, { att: 0.01 }); X.drum('tk', 0, 0.7); },
      age: { bpm: 70, beats: 2, steps: 3, tracks: { h: { type: 'brass', res: 1, bright: 1 }, t: { type: 'timp', res: 1 } }, bars: 1, parts: { h: 'd5 - a4 d5 - f5', t: 'd2 - - a2 a2 a2' } },
      village: (X) => X.chord('lute', ['d4', 'a4', 'd5', 'f5'], 0, 0.8, 0.8, 0.02),
      bells: (X) => { X.note('cbell', 'd4', 0, 2.5, 0.8); X.note('cbell', 'a4', 0.4, 2, 0.6); },
    },
    fx: { win: 'win', capture: 'capture', rebel: 'rebel', coalition: 'rebel', alliance: 'alliance', betray: 'betray', age: 'age', village: 'village', council: 'bells', event: 'bells', vassal: 'gavel', councilResult: 'gavel', launch: 'boom' },
    sfx: { win: 'win', drum: 'roll', bell: 'bells' },
  };
})();
