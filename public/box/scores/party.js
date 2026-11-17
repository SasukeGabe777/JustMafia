'use strict';
// Party Mode: the shuffle (a spinning slot-machine drive), the standings board between
// games (a marching-band pop strut) and the champion finale (a big E-major anthem).
(function () {
  const S = (window.BOX.scores = window.BOX.scores || {});
  S.party = {
    name: 'Party Mode',
    alias: { title: 'board', lobby: 'board', play: 'board', intro: 'shuffle' },
    cues: {
      // The lineup being shuffled and dealt.
      shuffle: {
        bpm: 132,
        tracks: {
          arp: { type: 'pluck', mode: 'chord', center: 69, n: 4, vol: 0.34, pan: 0.2, dly: 0.12, dec: 0.18 },
          ep: { type: 'epiano', mode: 'chord', center: 62, n: 4, vol: 0.32, pan: -0.2 },
          bass: { type: 'synthbass', mode: 'bass', vol: 0.46 },
          lead: { type: 'lead', wave: 'square', uni: true, cut: 2800, vol: 0.3, dly: 0.12 },
          str: { type: 'strings', mode: 'chord', center: 66, n: 4, vol: 0.22, att: 0.4 },
          dr: { type: 'drums', kit: 'std' },
        },
        sections: {
          A: { bars: 8, chords: 'Am | F | C | G | Am | F | Dm | E7', arp: '1234321212343212', ep: 'x-..x-..x-..x-..', bass: '1 1 8 1 1 8 1 5', dr: { k: 'x...x...x...x...', c: '....x.......x...', h: 'xxxxxxxxxxxxxxxx', sw: '................|................|................|................|................|................|................|x...............' } },
          B: { bars: 8, chords: 'F | G | Em | Am | F | G | E7sus4 | E7', arp: '1234321212343212', str: true, bass: '1 1 8 1 1 8 1 5', lead: 'c6 - - - a5 - c6 - | d6 - - - b5 - - - | g5 - - - b5 - e6 - | c6 - - - - - . . | a5 - - - c6 - f6 - | d6 - - - g6 - - - | e6 - - - - - - - | g#5 - - - b5 - d6 -', dr: { k: 'x...x...x...x...', c: '....x.......x...', h: 'x.x.x.x.x.x.x.x.', o: '..x...x...x...x.' } },
        },
        form: ['A', 'B'], loop: 0,
      },
      // Between games: the standings board.
      board: {
        bpm: 108,
        tracks: {
          br: { type: 'brass', vol: 0.4, bright: 1.15 }, tb: { type: 'brass', mode: 'chord', center: 60, n: 3, vol: 0.28, bright: 0.8 },
          glock: { type: 'glock', vol: 0.3, pan: 0.3, oct: 1 }, tuba: { type: 'tuba', mode: 'bass', res: 4, vol: 0.55 },
          str: { type: 'strings', mode: 'chord', center: 65, n: 4, vol: 0.2 }, dr: { type: 'drums', kit: 'orch' }, cym: { type: 'drums', kit: 'std', vol: 0.5 },
        },
        sections: {
          A: { bars: 8, chords: 'F | C/E | Dm | Bb | F | C | Bb C | F', tuba: '1 5 1 5', tb: '..x...x...x...x.', br: 'c5 - f5 - a5 - c6 - | g5 - - - e5 - c5 - | d5 - f5 - a5 - d6 - | d6 - - - bb5 - - - | a5 - c6 - f6 - a5 - | g5 - - - - - . . | bb5 - - - c6 - - - | f5 - - - - - . .', dr: { k: 'x.......x.......', s: 'x..gx.g.x..gxggg' }, cym: { h: '....x.......x...' } },
          B: { bars: 8, chords: 'Bb | F/A | Gm | C | Bb | F/A | G7 | C7', tuba: '1 5 1 5', str: true, tb: '..x...x...x...x.', glock: 'd5 - - - f5 - - - | c5 - - - f5 - - - | bb4 - - - d5 - - - | c5 - - - e5 - - - | d5 - - - f5 - bb5 - | a5 - - - c6 - - - | b5 - - - d6 - - - | e6 - - - c6 - bb5 -', dr: { k: 'x.......x.......', s: 'x..gx.g.x..gxggg' }, cym: { h: '....x.......x...' } },
        },
        form: ['A', 'B'], loop: 0,
      },
      // The champion is crowned.
      finale: {
        bpm: 120,
        tracks: {
          br: { type: 'brass', vol: 0.42, bright: 1.2 }, br2: { type: 'brass', vol: 0.3, oct: -1 },
          choir: { type: 'choir', mode: 'chord', center: 66, n: 3, vol: 0.28 }, str: { type: 'strings', mode: 'chord', center: 64, n: 4, vol: 0.3 },
          ep: { type: 'epiano', mode: 'chord', center: 62, n: 4, vol: 0.3 }, bass: { type: 'synthbass', mode: 'bass', vol: 0.45 },
          glock: { type: 'glock', vol: 0.22, oct: 1 }, timp: { type: 'timp', vol: 0.45 }, dr: { type: 'drums', kit: 'std' },
        },
        sections: {
          I: { bars: 2, chords: 'B7sus4 | B7', timp: 'b2 b2 b2 b2 b2 b2 b2 b2 | b2 b2 b2 b2 b2 b2 b2 b2', str: true, dr: { s: '3344556677889999|9999999999999999' } },
          A: { bars: 8, chords: 'E | B/D# | C#m | A | E | B | A B | E', str: true, ep: '..x-..x-..x-.x-.', bass: '1 . 1 8 . 1 5 .', br: 'b4 - e5 - g#5 - b5 - | b5 - - - f#5 - - - | g#5 - - - e5 - c#5 - | c#6 - - - - - . . | b5 - g#5 - e5 - b5 - | d#6 - - - - - b5 - | c#6 - - - d#6 - - - | e6 - - - - - . .', br2: 'b4 - e5 - g#5 - b5 - | b5 - - - f#5 - - - | g#5 - - - e5 - c#5 - | c#6 - - - - - . .', dr: { k: 'x...x...x...x...', s: '....x.......x...', h: '..x...x...x...x.', y: 'x' + '.'.repeat(127) } },
          B: { bars: 8, chords: 'A | B | G#m | C#m | A | B | C#m B/D# | E', str: true, choir: true, ep: 'x--.x--.x--.x-x-', bass: '1 - . 1 5 - 8 .', glock: 'c#6 - - - e6 - - - | d#6 - - - f#6 - - - | g#6 - - - - - . . | e6 - - - - - . . | c#6 - - - e6 - a6 - | f#6 - - - b6 - - - | g#6 - - - f#6 - - - | e6 - - - - - . .', br: '. . . . . . . . | . . . . . . . . | . . . . . . . . | . . . . . . . . | a5 - - - c#6 - e6 - | f#6 - - - - - . . | e6 - - - d#6 - - - | e6 - - - - - . .', dr: { k: 'x...x...x...x...', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' } },
        },
        form: ['I', 'A', 'B'], loop: 1,
      },
    },
    stingers: {
      next: { bpm: 120, tracks: { b: { type: 'brass', bright: 1.15 }, d: { type: 'drums', kit: 'orch' } }, parts: { b: 'c5 f5 a5 c6 - - - -', d: { s: 'x.x.x.x.x.......' } } },
    },
    sfx: {},
  };
})();
