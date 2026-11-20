'use strict';
// President: royal baroque. Harpsichord continuo, strings, bright trumpets and timpani.
// A D-major processional for the title, an original minuet for the lobby, an air while
// players think, an allegro on a circle-of-fifths sequence for play, and a D-minor
// "revolution" with driving string ostinato when the table turns.
(function () {
  const S = (window.BOX.scores = window.BOX.scores || {});
  // Recorded card sounds (Kenney Casino Audio, CC0: public/audio/sfx/president/, credits.json there), quiet.
  const clip = (f, o) => BOX.audio.clip('president/' + f, o);
  const card = (f, vol, fb) => { if (!clip(f, { vol })) BOX.sfx(fb); }; // fb: the old synth sound if the clip can't play
  const tracks = {
    hp: { type: 'harpsi', mode: 'chord', center: 64, n: 4, vol: 0.4, pan: -0.2 },
    arp: { type: 'harpsi', mode: 'chord', center: 67, n: 4, vol: 0.3, pan: 0.25 },
    str: { type: 'strings', mode: 'chord', center: 62, n: 4, vol: 0.32 },
    vln: { type: 'strings', vol: 0.4, pan: 0.15, vib: 12 },
    tpt: { type: 'brass', vol: 0.42, bright: 1.3, pan: -0.05 },
    cello: { type: 'strings', mode: 'bass', oct: 2, vol: 0.5, cut: 1800, hp: 40 },
    timp: { type: 'timp', vol: 0.55 },
    dr: { type: 'drums', kit: 'orch' },
  };
  const fan = 'a4 - d5 - f#5 - a5 - | b5 - g5 - d5 - b4 - | a4 b4 c#5 d5 e5 f#5 g5 a5 | g5 - - - e5 - c#5 - | d5 - f#5 - b5 - a5 g5 | g5 - - - e5 f#5 g5 b5 | a5 - d5 - c#5 - e5 - | d5 - - - - - . .';
  S.president = {
    name: 'President',
    cues: {
      title: {
        bpm: 92, tracks,
        sections: {
          I: { bars: 4, chords: 'D | A | D | A7', tpt: 'a4 - - a4 d5 - - - | e5 - - e5 a5 - - - | f#5 - - f#5 a5 - d6 - | c#6 - - - e5 - - -', timp: 'd2 - - - a2 - - - | a2 - - - e2? - - - | d2 - - - a2 - - - | a2 - a2 a2 a2 - - -', str: true, cello: '1 - - - - - - -', dr: { y: 'x...............|................|x...............|................' } },
          A: { bars: 8, chords: 'D | G/D | D | A7/C# | Bm | Em/G | A7sus4 A7 | D', hp: 'x...x...x...x...', str: true, tpt: fan, cello: '1 - 1 - 5 - 1 -', timp: 'd2 - - - . . . . | . . . . . . . . | d2 - - - a2 - - - | . . . . . . . . | . . . . . . . . | . . . . . . . . | a2 - - - a2 - a2 - | d2 - - - - - . .' },
          B: { bars: 8, chords: 'Bm | F#m | G | D | Em | A | D/F# G | A7', arp: '1232123212321232', str: { p: true, vol: 0.2 }, vln: 'f#5 - - - d5 - - - | c#5 - - - a4 - - - | b4 - - - d5 - g5 - | f#5 - - - - - . . | g5 - - - e5 - - - | e5 - - - c#5 - - - | d5 - - - b4 - - - | c#5 - - - e5 - - -', cello: '1 - 5 - 1 - 5 -' },
          A2: { bars: 8, chords: 'D | G/D | D | A7/C# | Bm | Em/G | A7sus4 A7 | D', hp: 'x...x...x...x...', arp: '1232123212321232', str: true, tpt: fan, vln: { p: fan, oct: -1, vol: 0.3 }, cello: '1 - 1 - 5 - 1 -', timp: 'd2 - d2 - a2 - - - | . . . . . . . . | d2 - d2 - a2 - - - | . . . . . . . . | . . . . . . . . | . . . . . . . . | a2 - - - a2 a2 a2 - | d2 - - - - - . .', dr: { y: '.'.repeat(112) + 'x...............' } },
        },
        form: ['I', 'A', 'B', 'A2'], loop: 1,
      },
      // An original minuet (3/4).
      lobby: {
        bpm: 120, beats: 3,
        tracks: { mel: { type: 'harpsi', vol: 0.5 }, hp: { type: 'harpsi', mode: 'chord', center: 62, n: 3, vol: 0.32, pan: -0.2 }, bass: { type: 'pizz', mode: 'bass', res: 4, oct: 2, vol: 0.7 }, str: { type: 'strings', mode: 'chord', center: 64, n: 3, vol: 0.2 }, fl: { type: 'flute', vol: 0.35, pan: 0.25 } },
        sections: {
          A: { bars: 8, chords: 'G | D/F# | Em | C | G/D | D7 | G | D7', hp: '....x...x...', bass: '1 . 5', mel: 'b4 - d5 - g5 - | a5 - f#5 - d5 - | g5 - e5 - b4 c5 | e5 - - - c5 - | d5 - g5 - b5 - | c6 - a5 - f#5 - | g5 a5 b5 - d5 - | a4 - - - d5 -' },
          B: { bars: 8, chords: 'Em | B7 | Em | A7 | D | G | Am D7 | G', hp: '....x...x...', bass: '1 . 5', str: true, mel: 'e5 - g5 - b5 - | a5 - f#5 - d#5 - | e5 - b4 - g4 - | c#5 - e5 - g5 - | f#5 - a5 - d5 - | b4 - d5 - g5 - | c5 - e5 - f#5 - | g5 - - - - -', fl: '. . . . . . | . . . . . . | . . . . . . | . . . . . . | d6 - - - - - | d6 - - - b5 - | a5 - - - c6 - | b5 - - - - -' },
          A2: { bars: 8, chords: 'G | D/F# | Em | C | G/D | D7 | G | D7', hp: '....x...x...', bass: '1 . 5', str: true, mel: 'b4 - d5 - g5 - | a5 - f#5 - d5 - | g5 - e5 - b4 c5 | e5 - - - c5 - | d5 - g5 - b5 - | c6 - a5 - f#5 - | g5 a5 b5 - d5 - | g4 - - - - -', fl: 'b5 - - - - - | a5 - - - - - | g5 - - - - - | g5 - - - e5 - | d5 - - - - - | f#5 - - - - - | g5 - - - - - | . . . . . .' },
        },
        form: ['A', 'B', 'A2'], loop: 0,
      },
      intro: { from: 'title', bpm: 96 },
      // An air for thinking.
      think: {
        bpm: 72,
        tracks: { str: { type: 'strings', mode: 'chord', center: 60, n: 4, vol: 0.3, att: 0.6 }, vln: { type: 'strings', vol: 0.42, att: 0.15, vib: 14, pan: 0.15 }, hp: { type: 'harpsi', mode: 'chord', center: 67, n: 4, vol: 0.22, pan: -0.2 }, cello: tracks.cello },
        sections: {
          A: { bars: 8, chords: 'D | Bm | G | A | F#m | Bm | Em A7 | D', str: true, hp: '1.3.2.4.1.3.2.4.', cello: '1 - - - 5 - - -', vln: 'f#5 - - - - - e5 d5 | d5 - - - c#5 - - - | b4 - - - d5 - g5 - | e5 - - - - - . . | a5 - - - - - g5 f#5 | f#5 - - - e5 - d5 - | g5 - - - e5 - c#5 - | d5 - - - - - . .' },
          B: { bars: 8, chords: 'G | D/F# | Em | Bm | G | D/F# | Em7 | A7sus4 A7', str: true, hp: '1.3.2.4.1.3.2.4.', cello: '1 - - - 5 - - -', vln: 'b5 - - - - - a5 - | a5 - - - - - f#5 - | g5 - - - e5 - - - | f#5 - - - d5 - - - | d6 - - - - - b5 - | a5 - - - f#5 - - - | g5 - - - - - . . | e5 - - - c#5 - - -' },
        },
        form: ['A', 'B'], loop: 0,
      },
      // Allegro: harpsichord figuration over a circle of fifths.
      play: {
        bpm: 116, tracks,
        sections: {
          A: { bars: 8, chords: 'D | G | C#m7b5 | F#7 | Bm | E7 | A | A7', arp: '1232123212321232', vln: 'f#5 - - - - - e5 - | d5 - - - - - c#5 - | e5 - - - - - d5 - | c#5 - - - a#4 - - - | d5 - - - - - c#5 - | b4 - - - g#4 - - - | a4 - c#5 - e5 - a5 - | g5 - - - e5 - c#5 -', cello: 'walk', hp: '....x.......x...' },
          B: { bars: 8, chords: 'Bm | Em | A7 | D | G | C#m7b5 F#7 | Bm | A7', arp: '1232123212321232', str: { p: true, vol: 0.22 }, tpt: '. . . . . . . . | . . . . . . . . | a4 - - a4 a4 - - - | d5 - - - - - . . | . . . . . . . . | . . . . . . . . | f#5 - - f#5 f#5 - - - | e5 - - - c#5 - - -', cello: 'walk', timp: '. . . . . . . . | . . . . . . . . | a2 - - - a2 - - - | d2 - - - - - - - | . . . . . . . . | . . . . . . . . | . . . . . . . . | a2 - a2 - a2 - - -' },
        },
        form: ['A', 'B'], loop: 0,
      },
      // Revolution! D minor, string ostinato and timpani.
      tense: {
        bpm: 132,
        tracks: { ost: { type: 'strings', mode: 'chord', center: 62, n: 2, att: 0.008, rel: 0.06, vol: 0.45, len: 0.6 }, hi: { type: 'strings', vol: 0.38, vib: 10 }, tuba: { type: 'tuba', mode: 'bass', res: 4, oct: 2, vol: 0.55 }, hp: tracks.hp, timp: tracks.timp, dr: { type: 'drums', kit: 'orch' } },
        sections: {
          A: { bars: 8, chords: 'Dm | Dm | Bb | A7 | Dm | Gm | A7 | A7', ost: '1212121212121212', tuba: '1 1 1 1', timp: 'd2 - - - d2 - - - | d2 - - - d2 - - - | . . . . . . . . | a2 - - - a2 - - - | d2 - - - d2 - - - | . . . . . . . . | a2 - a2 - a2 - a2 - | a2 a2 a2 a2 a2 a2 a2 a2', dr: { s: 'x..gx.g.x..gxggg' } },
          B: { bars: 8, chords: 'Gm | Dm | Bb | A | Gm | Dm/F | E7 | A7', ost: '1212121212121212', tuba: '1 1 1 1', hp: 'x...x...x...x...', hi: 'd5 - - - - - - - | f5 - - - - - - - | f5 - - - d5 - - - | c#5 - - - e5 - - - | bb5 - - - - - - - | a5 - - - f5 - - - | g#5 - - - b5 - - - | a5 - - - - - - -', dr: { s: 'x..gx.g.x..gxggg', y: 'x...............' } },
        },
        form: ['A', 'B'], loop: 0,
      },
      reveal: {
        bpm: 100,
        tracks: { tpt: tracks.tpt, tpt2: { type: 'brass', vol: 0.32, oct: -1 }, str: tracks.str, hp: tracks.hp, timp: tracks.timp, dr: { type: 'drums', kit: 'orch' } },
        sections: {
          R: { bars: 2, chords: 'A7 | A7', timp: 'a2 a2 a2 a2 a2 a2 a2 a2 | a2 a2 a2 a2 a2 a2 a2 a2', dr: { s: '3434545656767878|8989999999999999' }, str: true },
          H: { bars: 4, chords: 'D | G | A7 | D', tpt: 'd5 - - d5 f#5 - a5 - | b5 - - - g5 - - - | a5 - - a5 c#6 - e6 - | d6 - - - - - - -', tpt2: 'd5 - - d5 f#5 - a5 - | g5 - - - d5 - - - | e5 - - e5 a5 - c#6 - | a5 - - - - - - -', str: true, hp: 'x...x...x...x...', timp: 'd2 - - - a2 - - - | . . . . . . . . | a2 - - - a2 - - - | d2 - - - - - - -', dr: { y: 'x...............|................|................|x...............' } },
        },
        form: ['R', 'H'], loop: 1,
      },
      finale: { from: 'title', bpm: 98, tracks: { bell: { type: 'chime', vol: 0.3 } }, form: ['I', 'A2', 'B', 'A2'], sections: { A2: { bell: 'd6 - - - - - - - | . . . . . . . . | a5 - - - - - - - | . . . . . . . .' } } },
    },
    stingers: {
      win: { bpm: 108, tracks: { t: { type: 'brass', bright: 1.3 }, t2: { type: 'brass', oct: -1 }, k: { type: 'timp' }, d: { type: 'drums', kit: 'orch' } }, bars: 2, parts: { t: 'a4 - - a4 d5 - f#5 - | a5 - - - - - - -', t2: 'f#4 - - f#4 a4 - d5 - | f#5 - - - - - - -', k: 'a2 - - a2 d2 - - - | d2 - - - - - - -', d: { y: '................|x...............' } } },
      revolution: (X) => { X.drum('tk', 0, 1); X.chord('brass', ['d3', 'a3', 'd4', 'f4'], 0, 1.2, 1); X.chord('strings', ['d5', 'f5', 'a5'], 0, 1.4, 0.9); X.note('timp', 'd2', 0, 1, 1); X.drum('y', 0, 0.8, 'orch'); },
      flourish: { bpm: 120, tracks: { h: { type: 'harpsi' } }, parts: { h: 'd5 f#5 a5 d6 f#6 - - -' } },
      burn: (X) => { ['g4', 'b4', 'd5', 'g5', 'b5', 'd6'].forEach((n, i) => X.note('harpsi', n, i * 0.03, 0.6, 0.7)); X.note('timp', 'g2', 0, 0.8, 0.9); },
      bells: (X) => { X.chord('cbell', ['d4', 'a4'], 0, 2, 0.8); X.note('cbell', 'd5', 0.5, 2, 0.6); },
      round: { bpm: 100, tracks: { t: { type: 'brass', bright: 1.3 } }, parts: { t: 'a4 - - a4 d5 - - -' } },
      card: () => card('play-' + (1 + Math.floor(Math.random() * 3)) + '.webm', 0.3, 'deal'),
      slap: () => card('slap.webm', 0.34, 'flip'), // a high card slapped down
      sweep: () => card('sweep.webm', 0.26, 'poof'), // the pile is cleared away
      tribute: () => card('tribute.webm', 0.28, 'whoosh'), // cards slid across to pay tribute
      deal: () => card('deal.webm', 0.28, 'deal'),
      shuffle: () => card('shuffle.webm', 0.24, 'shuffle'),
    },
    fx: { card: 'card', big: 'slap', clear: 'sweep', give: 'tribute', deal: 'deal', shuffle: 'shuffle', win: 'win', revolution: 'revolution', final: 'roll', roundOver: 'bells', tableDone: 'flourish', out: 'flourish', burn: 'burn' },
    sfx: { win: 'win', drum: 'roll', bell: 'bells', start: 'round' },
  };
})();
