'use strict';
// JustFunny: cosy movie-night lounge in F major, 76 bpm. Warm electric piano, a mellow
// sax, walking upright bass, brushes and vibes, like the lobby of an old cinema.
// The music goes quiet while a video plays (the game's music() returns null then).
(function () {
  const S = (window.BOX.scores = window.BOX.scores || {});
  const tracks = {
    ep: { type: 'epiano', mode: 'chord', center: 62, n: 4, rootless: true, vol: 0.45, trem: 0.28, pan: -0.15 },
    sax: { type: 'sax', vol: 0.42, pan: 0.18 },
    vib: { type: 'vibes', vol: 0.4, pan: 0.25 },
    bass: { type: 'upright', mode: 'bass', oct: 2 },
    str: { type: 'strings', mode: 'chord', center: 67, n: 4, vol: 0.16, att: 1 },
    dr: { type: 'drums', kit: 'jazz', vol: 0.6 },
  };
  const A = 'Fmaj9 | Dm9 | Gm9 | C13 | Am7 | D7b9 | Gm9 | C7sus4';
  const B = 'Bbmaj7 | Bbm6 | Am7 | D7 | Gm7 | C9 | Fmaj7 | C7sus4';
  const tune = 'a4 - c5 - e5 - g5 - | f5 - - - e5 - c5 - | d5 - - - bb4 - f5 - | e5 - - - - - . . | g5 - - - e5 - c5 - | f#5 - - - eb5 - - - | d5 - - - f5 - a5 - | g5 - - - - - . .';
  const tuneB = 'd5 - - - f5 - a5 - | g5 - - - db5 - - - | c5 - - - e5 - g5 - | f#5 - - - - - . . | f5 - - - d5 - bb4 - | e5 - - - d5 - c5 - | a4 - - - c5 - e5 - | g5 - - - - - . .';
  const brush = { k: 'g.......g.......', br: 'x.x.x.x.x.x.x.x.', s: '....g.......g...' };
  S.funny = {
    name: 'JustFunny',
    cues: {
      title: {
        bpm: 76, swing: 0.62, tracks,
        sections: {
          I: { bars: 4, chords: 'Fmaj9 | Dm9 | Gm9 | C7sus4', ep: 'x-------x-------', vib: 'c6 - a5 - f5 - e5 - | d5 - - - - - . . | f5 - d5 - bb4 - a4 - | g4 - - - - - . .', bass: '1 - - - - - - - | 1 - - - 5 - - -', dr: { br: 'x.x.x.x.x.x.x.x.' } },
          A: { bars: 8, chords: A, ep: 'x-.....x-.......', bass: '1 - - - 5 - - - | 1 - - - 5 - a -', sax: tune, str: true, dr: brush },
          B: { bars: 8, chords: B, ep: 'x-.....x-.......', bass: 'walk', vib: tuneB, dr: brush },
          A2: { bars: 8, chords: A, ep: 'x-.....x-.......', bass: 'walk', sax: tune, vib: { p: tune, oct: 1, vol: 0.2 }, str: true, dr: brush },
        },
        form: ['I', 'A', 'B', 'A2'], loop: 1,
      },
      lobby: { from: 'title', bpm: 72, form: ['A', 'B'], loop: 0, tracks: { sax: { vol: 0.32 } } },
      intro: { from: 'title', bpm: 80 },
      // Picking the next video.
      think: {
        bpm: 84, swing: 0.6,
        tracks: { ep: tracks.ep, vib: tracks.vib, bass: tracks.bass, dr: tracks.dr },
        sections: {
          A: { bars: 8, chords: 'Bbmaj7 | Am7 | Gm7 | Fmaj7 | Bbmaj7 | Am7 | Gm7 | C7sus4', ep: 'x-----x---x-----', bass: '1 - - - 5 - - -', vib: '. . f5 - a5 - d6 - | c6 - - - . . . . | . . d5 - f5 - bb5 - | a5 - - - . . . . | . . f5 - a5 - d6 - | e6 - - - c6 - - - | bb5 - - - a5 - g5 - | f5 - - - - - . .', dr: { br: 'x.x.x.x.x.x.x.x.', k: 'g...............' } },
        },
        form: ['A'], loop: 0,
      },
      play: { from: 'title', bpm: 78, form: ['A', 'B'], loop: 0 },
      tense: {
        bpm: 104, swing: 0.6,
        tracks: { ep: tracks.ep, bass: tracks.bass, sax: tracks.sax, dr: tracks.dr, clk: { type: 'drums', vol: 0.5 } },
        sections: {
          A: { bars: 4, chords: 'Dm7 | G7 | Dm7 | G7', ep: '..x...x...x...x.', bass: 'walk', clk: { tick: 'x...x...x...x...' }, dr: { r: 'x...x.x.x...x.x.', h: '....x.......x...' } },
          B: { bars: 4, chords: 'Em7 | A7 | Dm7 | G7', ep: '..x...x...x...x.', bass: 'walk', sax: 'b4 - d5 - g5 - - - | c#5 - e5 - g5 - - - | f5 - - - a5 - - - | b5 - - - - - - -', clk: { tick: 'x.x.x.x.x.x.x.x.' }, dr: { r: 'x...x.x.x...x.x.', h: '....x.......x...' } },
        },
        form: ['A', 'B'], loop: 0,
      },
      // Scores after a video.
      reveal: {
        bpm: 92, swing: 0.62,
        tracks: { vib: tracks.vib, ep: tracks.ep, bass: tracks.bass, dr: tracks.dr },
        sections: { R: { bars: 4, chords: 'Bbmaj7 | C13 | Am7 D7b9 | Gm9 C13', ep: 'x-.....x-.......', bass: 'walk', vib: 'd6 - f6 - a6 - - - | e6 - - - - - . . | c6 - - - f#6 - - - | f6 - - - e6 - - -', dr: brush } },
        form: ['R'], loop: 0,
      },
      finale: { from: 'title', bpm: 84, transpose: 2, form: ['A2', 'B', 'A2'], tracks: { stab: { type: 'brass', mode: 'chord', center: 64, n: 4, vol: 0.25, bright: 0.8 } }, sections: { A2: { stab: 'x---------------|................' } } },
    },
    stingers: {
      win: { bpm: 96, swing: 0.62, tracks: { s: { type: 'sax' }, v: { type: 'vibes' }, e: { type: 'epiano', mode: 'chord', center: 62, n: 4 } }, chords: 'Gm9 C13 | Fmaj9', bars: 2, parts: { s: 'f5 a5 c6 e6 - d6 - c6 | a5 - - - - - - -', v: '. . . . . . . . | f6 - - - - - - -', e: '................|x---------------' } },
      cheer: (X) => X.chord('vibes', ['f5', 'a5', 'c6', 'e6'], 0, 1.2, 0.8, 0.05),
      boo: { bpm: 90, tracks: { m: { type: 'mute' } }, parts: { m: 'c5 - b4 - bb4 - a4 -' } },
      start: (X) => { X.chord('epiano', ['f4', 'a4', 'c5', 'e5'], 0, 0.8, 0.8, 0.03); X.drum('tri', 0, 0.6); },
    },
    fx: { win: 'win', start: 'start' },
    sfx: { win: 'win', drum: 'roll' },
  };
})();
