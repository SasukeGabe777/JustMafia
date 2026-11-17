'use strict';
// Who Said It?: mysterious late-night lo-fi in A minor. Dusty swung drums with vinyl
// crackle, a warm tremolo electric piano, a kalimba hook and a soft whistle; a quiet
// night-chase for the countdown, vibes for the reveal.
(function () {
  const S = (window.BOX.scores = window.BOX.scores || {});
  const tracks = {
    ep: { type: 'epiano', mode: 'chord', center: 60, n: 4, rootless: true, vol: 0.45, trem: 0.3, lp: 3800, pan: -0.15 },
    kal: { type: 'kalimba', vol: 0.5, pan: 0.2, dly: 0.2 },
    wh: { type: 'whistle', vol: 0.4, pan: 0.1, dly: 0.2 },
    bass: { type: 'bass', mode: 'bass', oct: 2, cut: 420, vol: 0.65 },
    pad: { type: 'pad', mode: 'chord', center: 64, n: 4, vol: 0.2, cut: 1200 },
    dr: { type: 'drums', kit: 'lofi', vol: 0.65 },
  };
  const A = 'Am9 | Dm9 | G13 | Cmaj9 | Fmaj7 | Bm7b5 E7b9 | Am9 | E7#9';
  const B = 'Fmaj7 | Em7 | Dm9 | Cmaj7 | Fmaj7 | E7 | Am9 | E7sus4';
  const hook = 'e5 - g5 - b5 - a5 - | . . f5 - e5 - c5 - | d5 - - - e5 - f5 - | e5 - - - - - . . | a5 - g5 - e5 - c5 - | d5 - - - g#5 - f5 - | e5 - - - b4 - c5 - | g#4 - - - g5 - - -';
  const whB = 'c6 - - - a5 - - - | b5 - - - g5 - - - | a5 - - - f5 - e5 - | e5 - - - - - . . | c6 - - - a5 - - - | g#5 - - - b5 - - - | c6 - - - b5 - a5 - | a5 - - - - - . .';
  const lofi = { k: 'x......x..x.....', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.', vn: 'x...............' };
  S.whosaid = {
    name: 'Who Said It?',
    cues: {
      title: {
        bpm: 78, swing16: 0.6, tracks,
        sections: {
          I: { bars: 4, chords: 'Am9 | Dm9 | Fmaj7 | E7#9', ep: 'x-------....x---', pad: true, dr: { vn: 'x...............' }, kal: '. . . . . . . . | . . . . . . . . | . . . . . . . . | . . . . e5 - b5 -' },
          A: { bars: 8, chords: A, ep: 'x------.x-..x---', bass: '1 - - - . . 5 . | 1 - - . 5 - 7 .', kal: hook, dr: lofi },
          B: { bars: 8, chords: B, ep: 'x------.x-..x---', bass: '1 - - - . . 5 . | 1 - - . 5 - 7 .', pad: true, wh: whB, dr: { ...lofi, o: '..............x.' } },
          A2: { bars: 8, chords: A, ep: 'x------.x-..x---', bass: '1 - - - . . 5 . | 1 - - . 5 - 7 .', kal: hook, wh: { p: hook, vol: 0.2, oct: 1 }, pad: true, dr: lofi },
        },
        form: ['I', 'A', 'B', 'A2'], loop: 1,
      },
      lobby: { from: 'title', bpm: 74, form: ['A', 'B'], loop: 0, sections: { A: { kal: { p: hook, vol: 0.35 } } } },
      intro: { from: 'title', bpm: 80 },
      think: {
        bpm: 74, swing16: 0.6,
        tracks: { ep: tracks.ep, arp: { type: 'kalimba', mode: 'chord', center: 72, n: 4, vol: 0.3, pan: 0.3, dly: 0.25 }, bass: tracks.bass, pad: tracks.pad, dr: { ...tracks.dr, vol: 0.5 } },
        sections: {
          A: { bars: 8, chords: 'Dm9 | G13 | Cmaj9 | Am9 | Dm9 | G13 | Fmaj7 | E7#9', ep: 'x-------x-------', arp: '1...3...2...4...', bass: '1 - - - - - 5 . | 1 - - - . . . .', pad: true, dr: { k: 'x.........x.....', s: '....g.......x...', h: '..x...x...x...x.', vn: 'x...............' } },
        },
        form: ['A'], loop: 0,
      },
      play: { from: 'title', bpm: 82, form: ['A', 'B'], loop: 0, sections: { A: { kal: false, arp: false } } },
      // Countdown: a quiet night chase.
      tense: {
        bpm: 96, swing16: 0.55,
        tracks: { ep: { ...tracks.ep, rootless: false, n: 3 }, sub: { type: 'sub808', mode: 'bass', oct: 1, vol: 0.5 }, pl: { type: 'pluck', mode: 'chord', center: 67, n: 3, vol: 0.3, dly: 0.3, dec: 0.18 }, dr: { type: 'drums', kit: 'lofi' }, clk: { type: 'drums', vol: 0.55 } },
        sections: {
          A: { bars: 4, chords: 'Am | Fmaj7 | Dm | E7', ep: 'x---------------', sub: '1 - - 1 - - 1 -', pl: '1.2.3.2.1.2.3.2.', dr: { k: 'x..x......x.....', s: '....x.......x...', h: 'xxxxxxxxxxxxxxxx' }, clk: { tick: 'x...x...x...x...' } },
          B: { bars: 4, chords: 'Am | Fmaj7 | Bm7b5 | E7#9', ep: 'x-------x-------', sub: '1 - - 1 - - 1 -', pl: '3.2.1.2.3.2.1.2.', dr: { k: 'x..x......x.....', s: '....x.......x..x', h: 'xxxxxxxxxxxxxxxx' }, clk: { tick: 'x.x.x.x.x.x.x.x.' } },
        },
        form: ['A', 'B'], loop: 0,
      },
      reveal: {
        bpm: 84, swing16: 0.58,
        tracks: { vib: { type: 'vibes', vol: 0.5, pan: 0.15 }, ep: tracks.ep, bass: tracks.bass, pad: tracks.pad, dr: tracks.dr },
        sections: {
          R: { bars: 4, chords: 'Fmaj9 | G13 | Em7 | Am9', ep: 'x---------------', pad: true, bass: '1 - - - - - - -', vib: 'a5 c6 e6 g6 - - - - | g5 b5 e6 f6 - - - - | g5 b5 d6 g6 - - - - | e6 - - - c6 - b5 -', dr: { k: 'x.......x.......', s: '....x.......x...', vn: 'x...............' } },
        },
        form: ['R'], loop: 0,
      },
      finale: { from: 'title', bpm: 82, transpose: 2, tracks: { str: { type: 'strings', mode: 'chord', center: 64, n: 4, vol: 0.22, att: 0.8 } }, form: ['I', 'A2', 'B', 'A2'], all: { str: true } },
    },
    stingers: {
      round: { bpm: 80, tracks: { k: { type: 'kalimba', dly: 0.3 } }, parts: { k: 'e5 g5 b5 e6 - - - -' } },
      reveal: (X) => { X.chord('vibes', ['a4', 'c5', 'e5', 'g5', 'b5'], 0, 1.4, 0.8, 0.05); X.drum('vn', 0, 0.6); },
      spot: (X) => { X.note('whistle', 'e5', 0, 0.4, 0.6); X.note('whistle', 'b5', 0.25, 0.6, 0.6); },
      win: { bpm: 90, tracks: { v: { type: 'vibes' }, e: { type: 'epiano', mode: 'chord', center: 62, n: 4 } }, chords: 'Fmaj9 | Cmaj9', bars: 2, parts: { v: 'a5 c6 e6 g6 - - - - | g6 - - - - - - -', e: 'x---------------|x---------------' } },
    },
    fx: { round: 'round', spot: 'spot', win: 'win' },
    sfx: { drum: 'roll', win: 'win', chime: 'reveal' },
  };
})();
