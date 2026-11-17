'use strict';
// Most Likely To...: an awards-show orchestra in Bb major. Trumpet fanfares over strings,
// timpani and glockenspiel; a red-carpet waltz with harp while people think; a light
// orchestral pop groove for voting; a timpani roll for "the envelope, please".
(function () {
  const S = (window.BOX.scores = window.BOX.scores || {});
  const tracks = {
    tpt: { type: 'brass', vol: 0.42, bright: 1.25, pan: 0.1 },
    hn: { type: 'brass', mode: 'chord', center: 60, n: 4, vol: 0.28, bright: 0.7, pan: -0.15 },
    str: { type: 'strings', mode: 'chord', center: 64, n: 4, vol: 0.34 },
    vln: { type: 'strings', vol: 0.4, vib: 12, pan: -0.1 },
    harp: { type: 'harp', mode: 'chord', center: 67, n: 4, vol: 0.32, pan: 0.3 },
    glock: { type: 'glock', vol: 0.22, pan: 0.25, oct: 1 },
    bass: { type: 'strings', mode: 'bass', oct: 2, vol: 0.45, cut: 1600, hp: 40 },
    timp: { type: 'timp', vol: 0.5 },
    dr: { type: 'drums', kit: 'orch' },
  };
  const A = 'Bb | Eb/Bb | Bb | F/A | Gm | Eb | F7sus4 F7 | Bb';
  const B = 'Eb | F | Dm | Gm | Cm7 | F | Gm Eb | F7';
  const fan = 'f4 - bb4 - d5 - f5 - | g5 - - - eb5 - - - | f5 - d5 - bb4 - d5 - | c5 - - - - - . . | d5 - g5 - bb5 - d6 - | c6 - - - g5 - eb5 - | f5 - - - eb5 - - - | d5 - - - - - . .';
  const tune = 'g5 - - - a5 - bb5 - | c6 - - - a5 - f5 - | f5 - - - d5 - - - | g5 - - - bb5 - d6 - | eb6 - - - c6 - g5 - | a5 - - - c6 - - - | d6 - - - bb5 - g5 - | a5 - - - c6 - eb6 -';
  S.likely = {
    name: 'Most Likely To...',
    tenseFrom: ['play'], // timed 'play' phases also turn tense in their last 10 s
    cues: {
      title: {
        bpm: 104, tracks,
        sections: {
          I: { bars: 4, chords: 'Bb | Gb | Ab | F7', hn: 'X-----X-X-------|X-----X-X-------|X-----X-X-------|X---------------', timp: 'bb2 - - - . . bb2 bb2 | gb2 - - - . . gb2 gb2 | ab2 - - - . . ab2 ab2 | f2 f2 f2 f2 f2 f2 f2 f2', tpt: 'f5 - - - . . f5 f5 | gb5 - - - . . gb5 gb5 | ab5 - - - . . ab5 ab5 | a5 - - - - - - -', dr: { y: 'x...............|x...............|x...............|................', s: '................|................|................|2345678999999999' } },
          A: { bars: 8, chords: A, str: true, tpt: fan, bass: '1 - - - 5 - - -', timp: 'bb2 - - - . . . . | . . . . . . . . | bb2 - - - f2 - - - | . . . . . . . .', dr: { k: 'x.......x.......', s: '....x.......x...' } },
          B: { bars: 8, chords: B, harp: '1234123412341234', str: { p: true, vol: 0.2 }, vln: tune, glock: '. . . . . . . . | c6 - - - . . . . | . . . . . . . . | d6 - - - . . . . | . . . . . . . . | c6 - - - . . . . | . . . . . . . . | eb6 - - - . . . .', bass: '1 - - - 5 - - -', dr: { s: '....g.......x...', k: 'x.......x.......' } },
          A2: { bars: 8, chords: A, str: true, hn: 'x.......x.......', tpt: fan, vln: { p: fan, oct: 1, vol: 0.28 }, glock: fan, bass: '1 - - - 5 - - -', timp: 'bb2 - - - f2 - - - | . . . . . . . . | bb2 - - - f2 - - - | . . . . . . . . | . . . . . . . . | . . . . . . . . | f2 - f2 - f2 f2 f2 - | bb2 - - - - - . .', dr: { k: 'x.......x.......', s: '....x.......x...', y: 'x' + '.'.repeat(111) + 'x...............' } },
        },
        form: ['I', 'A', 'B', 'A2'], loop: 1,
      },
      lobby: { from: 'title', bpm: 98, form: ['A', 'B'], loop: 0, mute: ['timp', 'hn'], sections: { A: { tpt: { p: fan, vol: 0.3 }, harp: '1234123412341234' } } },
      intro: { from: 'title', bpm: 108 },
      // The red carpet: an elegant waltz.
      think: {
        bpm: 138, beats: 3,
        tracks: { harp: { ...tracks.harp, vol: 0.38 }, str: { ...tracks.str, vol: 0.25 }, fl: { type: 'flute', vol: 0.42, pan: 0.15 }, bass: { type: 'pizz', mode: 'bass', res: 4, oct: 2, vol: 0.6 }, glock: tracks.glock },
        sections: {
          A: { bars: 16, chords: 'Bbmaj7 | Bbmaj7 | Gm7 | Gm7 | Cm7 | Cm7 | F7 | F7 | Dm7 | Dm7 | G7 | G7 | Cm7 | F7 | Bb6 | F7', harp: '1.2.3.4.3.2.', str: true, bass: '1 . 5', fl: 'd5 - - - f5 - | a5 - - - - - | bb5 - - - g5 - | d5 - - - - - | eb5 - - - g5 - | c6 - - - - - | a5 - - - f5 - | eb5 - - - - - | f5 - - - a5 - | c6 - - - - - | b5 - - - g5 - | f5 - - - - - | eb5 - - - g5 - | a5 - - - c6 - | bb5 - - - - - | . . . . . .' },
        },
        form: ['A'], loop: 0,
      },
      // Voting: light orchestral pop.
      play: {
        bpm: 112, tracks,
        sections: {
          A: { bars: 8, chords: 'Bb | Gm | Eb | F | Bb | Gm | Cm7 | F7sus4 F7', harp: '1.2.3.2.1.2.3.2.', str: 'x.......x.......', bass: '1 - . 1 5 - . 5', vln: '. . d5 - f5 - g5 - | bb5 - - - . . . . | . . g5 - f5 - eb5 - | f5 - - - . . . . | . . d5 - f5 - g5 - | bb5 - - - d6 - - - | c6 - - - bb5 - g5 - | a5 - - - . . . .', dr: { k: 'x.......x.......', s: '....x.......x...', y: '' } },
          B: { bars: 8, chords: 'Eb | Bb/D | Cm7 | F | Eb | Bb/D | Gm7 | F7', harp: '1.2.3.2.1.2.3.2.', str: true, bass: '1 - . 1 5 - . 5', glock: 'g5 - - - . . . . | f5 - - - . . . . | eb5 - - - . . . . | c5 - - - . . . .', tpt: '. . . . . . . . | . . . . . . . . | . . . . . . . . | . . . . . . . . | eb5 - g5 - bb5 - - - | d5 - f5 - bb5 - - - | g5 - - - bb5 - d6 - | c6 - - - - - . .', dr: { k: 'x.......x.......', s: '....x.......x...' } },
        },
        form: ['A', 'B'], loop: 0,
      },
      // The envelope, please: timpani roll and string tremolo.
      tense: {
        bpm: 100,
        tracks: { trem: { type: 'strings', mode: 'chord', center: 62, n: 4, vol: 0.3, att: 0.005, rel: 0.05, len: 0.7 }, timp: tracks.timp, hn: tracks.hn, dr: tracks.dr },
        sections: {
          A: { bars: 4, chords: 'F7sus4 | F7sus4 | Gb/F | F7', trem: 'xxxxxxxxxxxxxxxx', timp: 'f2 f2 f2 f2 f2 f2 f2 f2', hn: '................|................|x---------------|x---------------', dr: { s: '2222333344445555|5555666677778888|7777888899999999|9999999999999999' } },
        },
        form: ['A'], loop: 0,
      },
      reveal: {
        bpm: 108,
        tracks: { tpt: tracks.tpt, hn: tracks.hn, str: tracks.str, glock: { type: 'glock', vol: 0.3 }, bass: tracks.bass, timp: tracks.timp, dr: tracks.dr },
        sections: {
          W: { bars: 4, chords: 'Bb | Eb | Bb/F F7 | Bb', tpt: 'f4 - bb4 - d5 - f5 - | g5 - bb5 - eb6 - - - | d6 - - - c6 - - - | bb5 - - - - - - -', hn: 'X-------X-------', str: true, glock: 'bb5 d6 f6 bb6 - - - - | g5 bb5 eb6 g6 - - - - | f6 - - - eb6 - - - | d6 - - - - - - -', bass: '1 - - - 5 - - -', timp: 'bb2 - - - f2 - - - | eb2? - - - . . . . | f2 - f2 - f2 - f2 - | bb2 - - - - - - -', dr: { y: 'x...............|................|................|x...............', k: 'x.......x.......' } },
        },
        form: ['W'], loop: 0,
      },
      finale: { from: 'title', bpm: 108, transpose: 2, form: ['I', 'A2', 'B', 'A2'] },
    },
    stingers: {
      win: { bpm: 110, tracks: { t: { type: 'brass', bright: 1.25 }, h: { type: 'brass', mode: 'chord', center: 62, n: 4 }, k: { type: 'timp' }, d: { type: 'drums', kit: 'orch' } }, chords: 'F | Bb', bars: 2, parts: { t: 'f4 - bb4 - d5 - f5 - | bb5 - - - - - - -', h: '................|X---------------', k: '. . . . f2 f2 f2 f2 | bb2 - - - - - - -', d: { y: '................|x...............' } } },
      crown: { bpm: 120, tracks: { t: { type: 'brass', bright: 1.25 }, g: { type: 'glock' } }, parts: { t: 'bb4 d5 f5 bb5 - - - -', g: '. . . . bb6 - - -' } },
      reveal: (X) => { X.chord('brass', ['bb3', 'd4', 'f4', 'bb4'], 0, 0.9, 1); X.drum('y', 0, 0.8, 'orch'); X.note('timp', 'bb2', 0, 1, 0.9); X.chord('glock', ['bb6', 'd7', 'f7'], 0.02, 1, 0.5, 0.04); },
      none: { bpm: 100, tracks: { c: { type: 'clarinet' } }, parts: { c: 'f4 - e4 - eb4 - - -' } },
      prompt: { bpm: 110, tracks: { h: { type: 'harp', mode: 'chord', center: 67, n: 6 } }, chords: 'Bbmaj7', parts: { h: '123456----------' } },
    },
    fx: { win: 'win', crown: 'crown', reveal: 'reveal', none: 'none', split: 'none', prompt: 'prompt', drum: 'roll' },
    sfx: { win: 'win', drum: 'roll', swell: 'prompt' },
  };
})();
