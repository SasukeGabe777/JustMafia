'use strict';
// Blackjack: neon lounge jazz in F minor. Swung vibes melody over rootless electric piano,
// walking upright bass and a brushed ride; a bossa nova for betting; a phrygian vamp while
// the dealer plays; a brassy shout chorus for the payout.
(function () {
  const S = (window.BOX.scores = window.BOX.scores || {});
  // Recorded table sounds (Kenney Casino Audio, CC0: public/audio/sfx/blackjack/, credits.json there), quiet.
  const clip = (f, o) => BOX.audio.clip('blackjack/' + f, o);
  const tracks = {
    ep: { type: 'epiano', mode: 'chord', center: 62, n: 4, rootless: true, vol: 0.42, pan: -0.2, trem: 0.25 },
    vib: { type: 'vibes', vol: 0.55, pan: 0.18, dly: 0.12 },
    tp: { type: 'mute', vol: 0.5, pan: 0.22 },
    bass: { type: 'upright', mode: 'bass', oct: 2 },
    stab: { type: 'brass', mode: 'chord', center: 65, n: 4, vol: 0.32 },
    dr: { type: 'drums', kit: 'jazz' },
  };
  const A = 'Fm9 | Bbm9 | Eb13 | Abmaj9 | Dbmaj7 | Gm7b5 C7b9 | Fm9 | Gm7b5 C7b9';
  const B = 'Bbm7 | Eb7 | Abmaj7 | Dbmaj7 | Gm7b5 | C7b9 | Fm7 | C7#9';
  const melA = 'c5 - eb5 g5 - ab5 - g5 | f5 - - - db5 - c5 db5 | eb5 - g5 bb5 - c6 - bb5 | g5 - - - . . eb5 f5 | ab5 - f5 - c5 - f5 - | db5 - - - e5 - - - | eb5 - c5 ab4 - g4 - c5 | bb4 - - - db5 - e5 -';
  const melB = 'f5 - - - db5 - bb4 - | g5 - - - db5 - - - | c5 - eb5 - g5 - - - | f5 - - - . . . . | f5 - - - db5 - bb4 - | e5 - - - g5 - bb5 - | ab5 - - - f5 - c5 - | e5 - - - eb5 - - -';
  const ride = { k: 'g.......g.......', r: 'x...x.x.x...x.x.', h: '....x.......x...', s: '..........g.....' };
  const charleston = 'x-.....x-.......';
  S.blackjack = {
    name: 'Blackjack',
    cues: {
      title: {
        bpm: 96, swing: 0.64, tracks,
        sections: {
          I: { bars: 4, chords: 'Dbmaj7 | C7b9 | Dbmaj7 | C7#9', ep: 'x-------x-------', vib: 'ab5 - f5 - c5 - ab4 - | g4 - - - e5 - - - | ab5 - f5 - c5 - ab4 - | bb4 - - - . . . .', bass: '1 - - - 5 - - - | 1 - - - 5 - - .', dr: { r: 'x...x.x.x...x.x.', k: 'g...............' } },
          A: { bars: 8, chords: A, ep: charleston, bass: 'walk', vib: melA, dr: ride },
          B: { bars: 8, chords: B, ep: charleston, bass: 'walk', tp: melB, dr: { ...ride, s: '......g...g.....' } },
          A2: { bars: 8, chords: A, ep: charleston, bass: 'walk', vib: melA, tp: { p: melA, vol: 0.25, oct: -1 }, stab: '................|................|................|................|................|................|................|....x.x.........', dr: ride },
        },
        form: ['I', 'A', 'B', 'A2'], loop: 1,
      },
      lobby: { from: 'title', bpm: 88, form: ['A', 'B'], loop: 0, mute: ['stab'], sections: { A: { dr: { r: 'x...x.x.x...x.x.', h: '....x.......x...' } } } },
      intro: { from: 'title', bpm: 100 },
      // Betting: a neon bossa nova.
      think: {
        bpm: 124,
        tracks: { gtr: { type: 'nylon', mode: 'chord', center: 62, n: 4, vol: 0.45, pan: -0.25, strum: 0.008 }, fl: { type: 'flute', vol: 0.45, pan: 0.2, dly: 0.12 }, bass: { type: 'upright', mode: 'bass' }, pad: { type: 'pad', mode: 'chord', center: 65, vol: 0.18, cut: 1400 }, dr: { type: 'drums', kit: 'jazz', vol: 0.6 } },
        sections: {
          A: { bars: 8, chords: 'Dbmaj7 | Dbmaj7 | Ebm7 | Ab7 | Dbmaj7 | Bbm7 | Ebm9 | Ab13', gtr: 'x..x..x...x..x..', bass: '1 - - 5 1 - - 5', pad: true, fl: 'f5 - - - ab5 - - - | c6 - - - - - . . | bb5 - - - gb5 - eb5 - | c5 - - - . . . . | f5 - - - ab5 - - - | db6 - - - c6 - bb5 - | gb5 - - - eb5 - db5 - | c5 - - - - - . .', dr: 'bossa' },
          B: { bars: 8, chords: 'Gbmaj7 | Fm7 | Ebm7 | Dbmaj7 | Gbmaj7 | F7#9 | Bbm9 | Ab13', gtr: 'x..x..x...x..x..', bass: '1 - - 5 1 - - 5', pad: true, dr: 'bossa' },
        },
        form: ['A', 'B'], loop: 0,
      },
      play: { from: 'title', bpm: 104, form: ['A', 'B', 'A2'], loop: 0, tracks: { vib: { type: 'sax', vol: 0.42 } } },
      // The dealer plays: a phrygian vamp.
      tense: {
        bpm: 112, swing: 0.6,
        tracks: { ost: { type: 'upright', vol: 0.75 }, ep: { type: 'epiano', mode: 'chord', center: 60, n: 3, vol: 0.35 }, tp: { type: 'mute', vol: 0.45 }, vib: { type: 'vibes', vol: 0.4 }, dr: { type: 'drums', kit: 'jazz' }, clk: { type: 'drums', vol: 0.6 } },
        sections: {
          A: { bars: 4, chords: 'Fm | Gb/F | Fm | Gb/F', ost: 'f2 . c3 . f2 . gb2 . | f2 . c3 . f2 . gb2 .', ep: '..x...x...x...x.', clk: { tick: 'x...x...x...x...' }, dr: { r: 'x.x.x.x.x.x.x.x.', t1: 'x.......x.......', k: 'x.......x.......' } },
          B: { bars: 8, chords: 'Fm | Gb/F | Fm | Gb/F | Bbm | C7b9 | Fm | C7b9', ost: 'f2 . c3 . f2 . gb2 . | f2 . c3 . f2 . gb2 .', ep: '..x...x...x...x.', tp: 'c5 - - - db5 - - - | c5 - - - . . . . | ab5 - - - gb5 - f5 - | f5 - - - . . . . | f5 - - - db5 - bb4 - | e5 - - - g5 - bb5 - | ab5 - - - g5 - f5 - | e5 - - - - - - -', vib: 'c6 . . . . . . . | db6 . . . . . . .', clk: { tick: 'x.x.x.x.x.x.x.x.' }, dr: { r: 'x.x.x.x.x.x.x.x.', t1: 'x...x...x...x...', k: 'x.......x.......', s: '....g..g....g..g' } },
        },
        form: ['A', 'B'], loop: 0,
      },
      // Payout: a shout chorus.
      reveal: {
        bpm: 120, swing: 0.62,
        tracks: { stab: { ...tracks.stab, vol: 0.45 }, ep: tracks.ep, bass: tracks.bass, vib: tracks.vib, dr: { type: 'drums', kit: 'jazz' }, orch: { type: 'drums', kit: 'orch' } },
        sections: {
          R: { bars: 2, chords: 'C7sus4 | C7#9', orch: { s: '3434545656767878|8989999999999999' }, bass: '1 - - - 1 - - - | 1 - - - 5 - - -' },
          H: { bars: 4, chords: 'Fm9 | Bbm9 | Eb13 | Abmaj9', stab: 'X--.....x.X.....', ep: charleston, bass: 'walk', vib: 'c6 - ab5 f5 - c5 - eb5 | f5 - - - . . . . | g5 bb5 c6 eb6 - c6 - bb5 | c6 - - - - - . .', dr: ride, orch: { y: 'x...............|................|................|................' } },
        },
        form: ['R', 'H'], loop: 1,
      },
      finale: { from: 'title', bpm: 104, transpose: 2, form: ['I', 'A2', 'B', 'A2'], sections: { A2: { stab: '....x.x.....x...' }, B: { stab: 'x.......x.......' } } },
    },
    stingers: {
      win: { bpm: 120, swing: 0.62, tracks: { s: { type: 'brass', mode: 'chord', center: 67, n: 4 }, v: { type: 'vibes' }, d: { type: 'drums', kit: 'jazz' } }, chords: 'Abmaj9 | Fm9', bars: 2, parts: { s: '..x-..X-------..|X---------------', v: 'c6 eb6 g6 c7 - - - - | f6 - - - - - - -', d: { s: '..x...X.........|X...............', r: 'x...x...x...x...' } } },
      blackjack: { bpm: 140, tracks: { v: { type: 'vibes' }, s: { type: 'brass', mode: 'chord', center: 68, n: 4 } }, chords: 'Dbmaj7 | Fm9', bars: 2, parts: { v: 'f5 ab5 c6 eb6 f6 ab6 c7 - | - - - - - - - -', s: '................|X---------------' } },
      bust: { bpm: 100, tracks: { m: { type: 'mute' } }, parts: { m: 'g4 - f#4 - f4 - - - | e4 - - - - - - -' }, bars: 2 },
      sting: { bpm: 120, tracks: { s: { type: 'brass', mode: 'chord', center: 64, n: 4 } }, chords: 'C7#9', parts: { s: 'X---............' } },
      chips: () => { if (!clip('chips-' + (1 + Math.floor(Math.random() * 3)) + '.webm', { vol: 0.3 })) BOX.audio.stinger('chips', 'generic'); },
      payout: () => { if (!clip('payout.webm', { vol: 0.28, delay: 0.15 })) BOX.audio.stinger('chips', 'generic'); else clip('chips-3.webm', { vol: 0.22, delay: 0.45 }); },
      double: () => { clip('chip-lay.webm', { vol: 0.32 }); clip('chips-1.webm', { vol: 0.24, delay: 0.12 }); },
      flip: () => { clip('flip.webm', { vol: 0.32 }); },
      shuffle: () => { clip('shuffle.webm', { vol: 0.26 }); },
      foley: () => {}, // the cards themselves: the game's onFx deals one recorded card per card on the table
    },
    fx: { bust: 'bust', dealerBust: 'win', dealerBJ: 'sting', settle: 'payout', chip: 'chips', deal: 'foley', flip: 'flip', shuffle: 'shuffle', double: 'double', allin: 'roll', bjWin: 'blackjack', charlie: 'blackjack', win: 'win' },
    sfx: { win: 'win', drum: 'roll', swell: 'blackjack', zap: 'ding', ballot: 'chips' },
  };
})();
