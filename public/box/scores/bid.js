'use strict';
// JustBid: an auction-house honky-tonk. Key of G, stride/ragtime two-beat.
// Honky-tonk piano (two detuned strings), tuba oom-pah, banjo off-beats, brushes;
// big-band brass for the reveals, a sneaky pizzicato prowl for the sealed bids.
(function () {
  const S = (window.BOX.scores = window.BOX.scores || {});
  // Recorded sound effects (public/audio/sfx/bid/, credits.json there), quiet, on the SFX bus.
  const clip = (f, o) => BOX.audio.clip('bid/' + f, o);
  const tracks = {
    pno: { type: 'honky', mode: 'chord', center: 66, n: 4, vol: 0.4, pan: -0.1 },
    mel: { type: 'honky', vol: 0.55, pan: 0.05 },
    tuba: { type: 'tuba', mode: 'bass', res: 4, oct: 2, vol: 0.6 },
    banjo: { type: 'banjo', mode: 'chord', center: 67, n: 3, vol: 0.38, pan: 0.3, strum: 0.012 },
    br: { type: 'brass', vol: 0.36, pan: -0.2 },
    stab: { type: 'brass', mode: 'chord', center: 66, n: 4, vol: 0.3 },
    dr: { type: 'drums', kit: 'jazz' },
  };
  const A = 'G | E7 | A7 | D7 | G | E7 | A7 D7 | G D7';
  const B = 'C | C#dim7 | G/D | E7 | A7 | D7 | G | D7';
  const melA = 'd5 e5 g5 b5 - a5 g5 e5 | g#5 - b5 - d6 - b5 g#5 | a5 g5 e5 c#5 - e5 g5 a5 | f#5 - - - a5 - f#5 d5 | d5 e5 g5 b5 - a5 g5 e5 | d6 - b5 g#5 - e5 - d5 | c#5 e5 a5 g5 f#5 a5 c6 a5 | g5 - - - . . d5 d#5';
  const melB = 'e5 - g5 - c6 - - - | c#6 - - - bb5 - g5 - | b5 - - - d5 - g5 - | g#5 - - - b5 - d6 - | c#6 - - - a5 - g5 - | f#5 - - - d5 - c5 - | b4 - d5 - g5 - b5 - | a5 - - - - - d5 d#5';
  const two = { k: 'x.......x.......', s: '....x.......x...', br: 'x.x.x.x.x.x.x.x.', h: '....x.......x...' };
  S.bid = {
    name: 'JustBid',
    cues: {
      title: {
        bpm: 132, tracks,
        sections: {
          I: { bars: 4, chords: 'D7 | D7 | Eb7 | D7', stab: 'X-......X-......|X-......X-..X-..|X-......X-......|X-------........', tuba: '1 . . . | 1 . . . | 1 . . . | 1 . 5 .', dr: { k: 'x.......x.......', s: '................|................|................|..........xxXxXX' } },
          A: { bars: 8, chords: A, pno: '....x-......x-..', tuba: '1 . 5 .', banjo: '..x...x...x...x.', mel: melA, dr: two },
          B: { bars: 8, chords: B, pno: '....x-......x-..', tuba: '1 . 5 .', banjo: '..x...x...x...x.', br: melB, mel: '. . . . . . . . | . . . . . . . . | . . . . g5 a5 b5 d6 | . . . . . . . . | . . . . e5 f#5 g5 a5 | . . . . . . . . | . . . . . . . . | . . . . . . . .', dr: { ...two, h: '..x...x...x...x.' } },
          A2: { bars: 8, chords: A, pno: '....x-......x-..', tuba: '1 . 5 .', banjo: '..x...x...x...x.', mel: melA, br: '. . . . . . . . | . . . . . . . . | . . . . . . . . | a4 - - - . . . . | . . . . . . . . | . . . . . . . . | . . . . . . . . | b4 - - - . . . .', stab: '................|................|................|................|................|................|................|X.X.............', dr: { ...two, cb: '' } },
        },
        form: ['I', 'A', 'B', 'A2'], loop: 1,
      },
      lobby: { from: 'title', bpm: 118, form: ['A', 'B'], loop: 0, mute: ['br', 'stab'], sections: { A: { mel: { p: melA, vol: 0.85 } }, B: { mel: melB } } },
      intro: { from: 'title', bpm: 136 },
      // Preview: a sneaky look inside the locker.
      think: {
        bpm: 104, swing: 0.62,
        tracks: { pz: { type: 'pizz', vol: 0.6 }, cl: { type: 'clarinet', vol: 0.5, pan: 0.2 }, bass: { type: 'upright', mode: 'bass', oct: 2 }, pno: { type: 'honky', mode: 'chord', center: 62, n: 3, vol: 0.28, pan: -0.25 }, dr: { type: 'drums', kit: 'jazz', vol: 0.6 } },
        sections: {
          A: { bars: 8, chords: 'Em | Em/D | C7 | B7 | Em | Em/D | Am6 | B7', bass: 'walk', pno: '....x.......x...', pz: 'e4 . g4 . b4 . e5 . | d4 . g4 . b4 . d5 . | c4 . e4 . g4 . bb4 . | b3 . d#4 . f#4 . a4 . | e4 . g4 . b4 . e5 . | d4 . g4 . b4 . d5 . | c4 . e4 . f#4 . a4 . | b3 . d#4 . f#4 . b4 .', dr: { k: 'g.......g.......', br: 'x.x.x.x.x.x.x.x.', h: '....x.......x...' } },
          B: { bars: 8, chords: 'Em | Em/D | C7 | B7 | Am7 | D7 | G | B7', bass: 'walk', pno: '....x.......x...', cl: '. . b4 - g4 - e4 - | f#4 - - - g4 - a4 - | g4 - e4 - c4 - e4 - | d#4 - - - . . . . | . . c5 - a4 - e4 - | f#4 - a4 - c5 - b4 - | b4 - - - d5 - b4 - | a4 - - - d#4 - - -', pz: 'e3 . . . . . . . | d3 . . . . . . . | c3 . . . . . . . | b2 . . . . . . .', dr: { k: 'g.......g.......', br: 'x.x.x.x.x.x.x.x.', h: '....x.......x...' } },
        },
        form: ['A', 'B'], loop: 0,
      },
      // The auction: fast bluegrass-ragtime with banjo rolls.
      play: {
        bpm: 150,
        tracks: { ...tracks, roll: { type: 'banjo', mode: 'chord', center: 70, n: 3, vol: 0.34, pan: 0.3 } },
        sections: {
          A: { bars: 8, chords: 'G | G | C | G | D7 | D7 | G | D7', roll: '1231231231231231', tuba: '1 . 5 .', pno: '....x.......x...', dr: two },
          B: { bars: 8, chords: 'C | C | G | E7 | A7 | D7 | G | G', roll: '3213213213213213', tuba: '1 . 5 .', pno: '....x.......x...', mel: 'e5 g5 c6 - b5 a5 g5 e5 | c5 - - - . . . . | d5 g5 b5 - a5 g5 e5 d5 | g#5 - - - e5 - - - | a5 - c#6 - e6 - c#6 - | d6 - - - c6 - a5 - | b5 - g5 - d5 - b4 - | g4 - - - . . . .', dr: { ...two, cb: '..x...x...x...x.' } },
        },
        form: ['A', 'B'], loop: 0,
      },
      // Sealed bids: a prowling minor-key tiptoe with a ticking clock.
      tense: {
        bpm: 116,
        tracks: { pz: { type: 'pizz', vol: 0.6 }, tuba: { type: 'tuba', mode: 'bass', res: 4, vol: 0.5 }, str: { type: 'strings', mode: 'chord', center: 60, n: 3, vol: 0.3, att: 0.5 }, clk: { type: 'drums', vol: 0.7 }, dr: { type: 'drums', kit: 'jazz', vol: 0.7 }, cl: { type: 'clarinet', vol: 0.45 } },
        sections: {
          A: { bars: 8, chords: 'Em | F/E | Em | F/E | Am | B7 | Em | B7', tuba: '1 . 5 .', str: true, pz: 'e4 . . e4 g4 . . . | f4 . . f4 a4 . . . | e4 . . e4 g4 . b4 . | a4 . . f4 e4 . . . | a4 . . c5 e5 . . . | d#5 . . b4 a4 . f#4 . | g4 . e4 . b4 . g4 . | f#4 . d#4 . b3 . . .', clk: { tick: 'x...x...x...x...', tock: '..x...x...x...x.' }, dr: { k: 'x.......x.......' } },
          B: { bars: 8, chords: 'Am | Em | Am | B7 | Am | Em | F | B7', tuba: '1 . 5 .', str: true, cl: 'a4 - - - c5 - e5 - | g5 - - - e5 - - - | a5 - - - g5 - e5 - | f#5 - - - d#5 - - - | e5 - - - c5 - a4 - | b4 - - - g4 - - - | a4 - - - c5 - - - | b4 - - - - - - -', clk: { tick: 'x.x.x.x.x.x.x.x.' }, dr: { k: 'x.......x.......', s: '....g.......g...' } },
        },
        form: ['A', 'B'], loop: 0,
      },
      reveal: {
        bpm: 126,
        tracks: { stab: tracks.stab, br: { ...tracks.br, vol: 0.45 }, pno: tracks.pno, tuba: tracks.tuba, dr: { type: 'drums', kit: 'orch' }, dj: { type: 'drums', kit: 'jazz' } },
        sections: {
          R: { bars: 2, chords: 'D7 | D7', dr: { s: '2323434545656767|7878989899999999' }, tuba: '1 . . . | 1 . 5 .' },
          H: { bars: 4, chords: 'G | C | G/D D7 | G', stab: 'X--.....X-.X....', br: 'd5 g5 b5 d6 - - b5 - | e6 - - - c6 - - - | d6 - b5 - a5 - c6 - | b5 - - - - - - -', pno: '....x.......x...', tuba: '1 . 5 .', dr: { y: 'x...............', k: 'x.......x.......' }, dj: { s: '....x.......x...', br: 'x.x.x.x.x.x.x.x.' } },
        },
        form: ['R', 'H'], loop: 1,
      },
      finale: { from: 'title', bpm: 136, transpose: 1, form: ['I', 'A2', 'B', 'A2'], sections: { A2: { br: melA } } },
    },
    stingers: {
      // A real gavel lands on the two swings of the TV's 🔨 (0.48 s and 1.08 s), the brass with the SOLD! stamp.
      sold: (X) => { clip('gavel.webm', { vol: 0.3, delay: 0.46 }); clip('gavel.webm', { vol: 0.34, delay: 1.06, gap: 0 }); X.chord('brass', ['g4', 'b4', 'd5', 'g5'], 1.08, 0.6, 0.95); X.drum('y', 1.08, 0.7, 'orch'); },
      // Rusty's gavel opens the bidding; light taps for "going once / twice".
      gavel: () => { clip('gavel.webm', { vol: 0.26, delay: 0.12 }); },
      win: { bpm: 140, tracks: { b: { type: 'brass' }, p: { type: 'honky', mode: 'chord', center: 67, n: 4 }, d: { type: 'drums', kit: 'jazz' } }, chords: 'G | G', bars: 2, parts: { b: 'd5 e5 g5 b5 - a5 g5 e5 | g5+b5+d6 - - - - - - -', p: 'x.x.x.x.x.x.x.x.|X---------------', d: { s: 'x.x.x.x.x.x.x.x.|X...............' } } },
      profit: { bpm: 150, tracks: { p: { type: 'honky' } }, parts: { p: 'g5 b5 d6 g6 - - . .' } },
      // A money pit: the studio audience groans (a recorded 'aww'), the tuba only if it can't play.
      loss: () => { if (!clip('aww.webm', { vol: 0.17, delay: 0.2 })) BOX.audio.stinger('lossTuba', 'bid'); },
      lossTuba: { bpm: 90, tracks: { t: { type: 'tuba' } }, parts: { t: 'd3 - c#3 - c3 - b2 -' } },
      bid: (X) => X.note('honky', 'd6', 0, 0.15, 0.7),
      once: () => { clip('gavel.webm', { vol: 0.14, rate: 1.2 }); },
      twice: () => { clip('gavel.webm', { vol: 0.14, rate: 1.2 }); clip('gavel.webm', { vol: 0.16, rate: 1.2, delay: 0.2, gap: 0 }); },
      // The locker's roll-up door rattles up with the TV's 1.6 s lift; at the reveal it rolls all the way.
      door: () => { clip('garage-lift.webm', { vol: 0.2 }); },
      rollup: () => { clip('garage-rollup.webm', { vol: 0.2 }); setTimeout(() => BOX.audio.stinger('reveal', 'bid'), 900); },
      open: { bpm: 132, tracks: { s: { type: 'brass', mode: 'chord', center: 64, n: 4 } }, chords: 'D7', parts: { s: 'X-..X-..........' } },
      reveal: { bpm: 126, gain: 1.6, tracks: { s: { type: 'brass', mode: 'chord', center: 67, n: 4 }, d: { type: 'drums', kit: 'orch' } }, chords: 'G', parts: { s: 'X-------........', d: { y: 'x' } } },
    },
    // 'bid' is not here: the game's onFx plays an audience shout ("Two hundred!") or this score's 'bid' note.
    fx: { sold: 'sold', open: 'gavel', once: 'once', twice: 'twice', profit: 'profit', loss: 'loss', rollup: 'rollup', jackpot: 'win', set: 'win', over: 'win', door: 'door', tension: 'roll' },
    sfx: { gavel: 'gavel', win: 'win', drum: 'roll', reveal: 'reveal' },
  };
})();
