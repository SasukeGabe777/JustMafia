'use strict';
// Zombie Survival: horror synth score in D minor. Drones, a detuned music box, a heartbeat
// pulse that speeds up, choir swells and low brass; a driving taiko action cue for the
// outcomes; a heroic D-major finale (bVI-bVII-I) when survivors escape, a dirge when nobody does.
// The game's phases map to cues in phaseCue(s) below (the game file itself is not touched).
(function () {
  const S = (window.BOX.scores = window.BOX.scores || {});
  const drone = { type: 'pad', mode: 'chord', center: 50, n: 3, vol: 0.32, cut: 900, att: 2.5, rel: 3 };
  const tracks = {
    drone,
    box: { type: 'musicbox', vol: 0.4, pan: 0.2, detune: -14, dly: 0.25 },
    choir: { type: 'choir', mode: 'chord', center: 62, n: 3, vol: 0.32, att: 1.5, rel: 2 },
    sub: { type: 'sub808', mode: 'bass', oct: 1, vol: 0.5 },
    low: { type: 'brass', mode: 'chord', center: 48, n: 3, vol: 0.35, bright: 0.6 },
    hb: { type: 'drums', vol: 0.9 },
    dr: { type: 'drums', kit: 'world' },
  };
  const A = 'Dm | Bbm/Db | Dm | Gm/Bb | Dm | Ebmaj7 | Dm | C#dim7';
  const tune = 'a5 . d6 . f6 - e6 . | db6 - - - bb5 - - - | a5 . f5 . d5 - e5 . | g5 - - - bb5 - - - | a5 . d6 . f6 - g6 . | g6 - - - bb5 - d6 - | f6 - e6 - d6 - a5 - | g5 - - - e5 - c#5 -';
  S.zombie = {
    name: 'Zombie Survival',
    // Which cue each phase of the game plays (the TV calls this; tv.js turns the last 10 s
    // of a 'think' phase into 'tense').
    phaseCue(s) {
      if (!s) return 'story';
      if (s.phase === 'chapter') return 'story';
      if (s.phase === 'choose') return s.scene && s.scene.final ? 'tense' : 'think';
      if (s.phase === 'outcome') return 'action';
      if (s.phase === 'board') return 'reveal';
      if (s.phase === 'over') return s.alive > 0 ? 'finale' : 'lose';
      return 'think';
    },
    cues: {
      title: {
        bpm: 66, tracks,
        sections: {
          I: { bars: 4, chords: 'Dm | Dm | Bbm/Db | Dm', drone: true, sub: '1 - - - - - - - | 1 - - - - - - -', hb: { hb: 'x...............' } },
          A: { bars: 8, chords: A, drone: true, box: tune, sub: '1 - - - - - - -', hb: { hb: 'x.......x.......' } },
          B: { bars: 8, chords: 'Bb | A7 | Dm | Bbm | Gm | A7 | Bbm | A7', drone: true, choir: true, sub: '1 - - - - - - -', low: 'x---------------|................|................|x---------------|................|................|x---------------|x-------x-------', hb: { hb: 'x.......x.......' }, dr: { k: 'x...............', y: '................|................|................|................|................|................|................|........x.......' } },
          A2: { bars: 8, chords: A, drone: true, choir: { p: true, vol: 0.2 }, box: tune, sub: '1 - - - - - - -', hb: { hb: 'x...x...x...x...' }, dr: { k: 'x.......x.......' } },
        },
        form: ['I', 'A', 'B', 'A2'], loop: 1,
      },
      lobby: { from: 'title', bpm: 60, form: ['A', 'B'], loop: 0, mute: ['dr', 'low'] },
      intro: { from: 'title', bpm: 70, sections: { A: { low: 'x---------------|................|................|................' } } },
      // A new chapter: cold ambient with a theremin line.
      story: {
        bpm: 56,
        tracks: { drone, choir: { ...tracks.choir, vol: 0.25 }, th: { type: 'sine', vol: 0.32, vib: 26, glide: 0.25, dly: 0.3 }, sub: tracks.sub, bell: { type: 'chime', vol: 0.18, detune: -20 } },
        sections: {
          A: { bars: 8, chords: 'Dm | Dm | Bb | Bb | Gm | Gm | A | A', drone: true, choir: true, sub: '1 - - - - - - -', th: 'd5 - - - - - - - | ~f5 - - - ~e5 - - - | ~d5 - - - - - - - | ~f5 - - - ~a5 - - - | ~g5 - - - - - - - | ~bb5 - - - ~a5 - - - | ~c#5 - - - - - - - | ~e5 - - - - - - -', bell: 'd6 - - - - - - - | . . . . . . . . | . . . . . . . . | . . . . . . . .' },
        },
        form: ['A'], loop: 0,
      },
      // Choosing: a heartbeat pulse and a held breath.
      think: {
        bpm: 92,
        tracks: { drone, sub: { ...tracks.sub, vol: 0.45 }, pl: { type: 'pluck', mode: 'chord', center: 62, n: 3, vol: 0.28, dly: 0.25, dec: 0.2 }, box: tracks.box, hb: tracks.hb, clk: { type: 'drums', vol: 0.5 } },
        sections: {
          A: { bars: 8, chords: 'Dm | Dm | Bb/D | Bb/D | Gm/D | Gm/D | A/D | A7/C#', drone: true, sub: '1 . . 1 . . 1 .', pl: '1..2..3.1..2..3.', hb: { hb: 'x.......x.......' }, clk: { tick: '....x.......x...' } },
          B: { bars: 8, chords: 'Dm | Ebmaj7 | Dm | Ebmaj7 | Gm | A7 | Dm | A7', drone: true, sub: '1 . . 1 . . 1 .', pl: '1..2..3.1..2..3.', box: 'f6 - - - e6 - - - | g6 - - - d6 - - - | f6 - - - e6 - - - | bb5 - - - - - - - | bb5 - - - a5 - - - | c#6 - - - e6 - - - | d6 - - - - - - - | . . . . . . . .', hb: { hb: 'x.......x.......' }, clk: { tick: '..x...x...x...x.' } },
        },
        form: ['A', 'B'], loop: 0,
      },
      // The last seconds: the heartbeat doubles, strings rise.
      tense: {
        bpm: 120,
        tracks: { drone, sb: { type: 'synthbass', mode: 'bass', oct: 2, vol: 0.45 }, str: { type: 'strings', mode: 'chord', center: 64, n: 3, vol: 0.38, att: 0.6 }, hb: tracks.hb, dr: tracks.dr, clk: { type: 'drums', vol: 0.6 } },
        sections: {
          A: { bars: 4, chords: 'Dm | Dm | Eb/D | Eb/D', drone: true, sb: '1 1 1 1 1 1 1 1', str: 'x---------------', hb: { hb: 'x...x...x...x...' }, clk: { tick: 'x.x.x.x.x.x.x.x.' }, dr: { sw: '................|................|................|x...............' } },
          B: { bars: 4, chords: 'Dm | Eb/D | E/D | F/D', drone: true, sb: '1 1 1 1 1 1 1 1', str: 'x-------x-------', hb: { hb: 'x...x...x...x...' }, clk: { tick: 'xxxxxxxxxxxxxxxx' }, dr: { k: 'x...x...x...x...', t1: '..............xx' } },
        },
        form: ['A', 'B'], loop: 0,
      },
      // The outcome plays out: driving action.
      action: {
        bpm: 138,
        tracks: { sb: { type: 'synthbass', mode: 'bass', res: 1, oct: 2, vol: 0.45 }, str: { type: 'strings', mode: 'chord', center: 62, n: 3, vol: 0.4, att: 0.01, rel: 0.08, len: 0.5 }, low: tracks.low, choir: tracks.choir, dr: tracks.dr, orch: { type: 'drums', kit: 'orch' } },
        sections: {
          A: { bars: 8, chords: 'Dm | Dm | Bb | C | Dm | Dm | Bb | A', sb: '1 1 8 1 1 8 1 5 1 1 8 1 1 8 5 7', str: 'x..x..x...x..x..', low: 'x---------------', dr: { k: 'x..x..x.x..x..x.', s: '....x.......x...', fd: '..x...x...x...x.' }, orch: { s: '................|................|................|............xxxx' } },
          B: { bars: 8, chords: 'Gm | Gm | Dm | Dm | Bb | C | A | A7', sb: '1 1 8 1 1 8 1 5 1 1 8 1 1 8 5 7', str: 'x..x..x...x..x..', choir: true, low: 'x-------x-------', dr: { k: 'x..x..x.x..x..x.', s: '....x.......x...', fd: 'x.x.x.x.x.x.x.x.' }, orch: { y: 'x...............' } },
        },
        form: ['A', 'B'], loop: 0,
      },
      // The board: aftermath.
      reveal: {
        bpm: 72,
        tracks: { pno: { type: 'piano', vol: 0.45, pan: 0.1 }, str: { type: 'strings', mode: 'chord', center: 60, n: 4, vol: 0.3, att: 0.8 }, cello: { type: 'strings', mode: 'bass', oct: 2, vol: 0.4, cut: 1500 }, drone },
        sections: {
          A: { bars: 8, chords: 'Dm | Bb | F | A | Dm | Gm | Bb | A', str: true, cello: '1 - - - - - - -', pno: 'a4 - d5 - f5 - a5 - | f5 - - - d5 - - - | c5 - f5 - a5 - c6 - | c#6 - - - - - - - | a5 - f5 - d5 - f5 - | g5 - - - bb4 - - - | d5 - - - f5 - bb5 - | a5 - - - - - - -' },
        },
        form: ['A'], loop: 0,
      },
      // Survivors escape: heroic.
      finale: {
        bpm: 100,
        tracks: { br: { type: 'brass', vol: 0.45, bright: 1.2 }, br2: { type: 'brass', vol: 0.32, oct: -1 }, str: { type: 'strings', mode: 'chord', center: 64, n: 4, vol: 0.38 }, choir: { type: 'choir', mode: 'chord', center: 67, n: 3, vol: 0.28 }, bass: { type: 'bass', mode: 'bass' }, timp: { type: 'timp', vol: 0.5 }, dr: { type: 'drums', kit: 'orch' } },
        sections: {
          A: { bars: 8, chords: 'D | Bb | C | D | G | Bb | C | D', str: true, bass: '1 - - - 1 - 5 -', br: 'a4 - d5 - f#5 - - - | f5 - - - d5 - - - | e5 - g5 - c6 - - - | a5 - - - - - - - | b5 - - - g5 - d5 - | d6 - - - bb5 - f5 - | e5 - g5 - c6 - e6 - | d6 - - - - - - -', br2: 'a4 - d5 - f#5 - - - | f5 - - - d5 - - - | e5 - g5 - c6 - - - | a5 - - - - - - -', timp: 'd2 - - - a2 - - - | . . . . . . . . | c3 - - - g2 - - - | d2 - d2 - d2 - - -', dr: { s: '....x.......x...', k: 'x.......x.......', y: 'x...............|................|................|................' } },
          B: { bars: 8, chords: 'Bm | G | D | A | Bm | G | Bb C | D', str: true, choir: true, bass: '1 - - - 1 - 5 -', br: 'f#5 - - - - - d5 - | g5 - - - - - b5 - | a5 - - - f#5 - d5 - | e5 - - - - - - - | f#5 - - - - - d5 - | g5 - - - b5 - d6 - | d6 - - - e6 - - - | f#6 - - - - - - -', timp: 'd2 - - - . . . . | . . . . . . . . | . . . . . . . . | a2 - a2 - a2 - - -', dr: { k: 'x.......x.......', s: '....x.......x...' } },
        },
        form: ['A', 'B'], loop: 0,
      },
      lose: {
        bpm: 58,
        tracks: { pno: { type: 'piano', vol: 0.4 }, choir: { type: 'choir', mode: 'chord', center: 57, n: 3, vol: 0.3, att: 2 }, drone, bell: { type: 'cbell', vol: 0.22 } },
        sections: { A: { bars: 8, chords: 'Dm | Gm/D | Dm | A7/C# | Bbmaj7 | Gm | Dm | A7', drone: true, choir: true, pno: 'f5 - - - e5 - d5 - | d5 - - - bb4 - - - | a4 - - - d5 - f5 - | e5 - - - - - - - | d5 - - - c5 - bb4 - | bb4 - - - g4 - - - | a4 - - - f4 - - - | e4 - - - - - - -', bell: 'd4 - - - - - - - | . . . . . . . . | . . . . . . . . | . . . . . . . .' } },
        form: ['A'], loop: 0,
      },
    },
    stingers: {
      scare: (X) => { X.chord('brass', ['d3', 'eb3', 'a3', 'd4'], 0, 0.9, 1, 0, { bright: 0.7 }); X.chord('strings', ['c#5', 'd5', 'eb5'], 0, 1, 0.9); X.drum('y', 0, 0.8, 'orch'); X.drum('tk', 0, 1); },
      chapter: (X) => { X.drum('tk', 0, 1); X.tone({ dur: 2.2, f0: 73, f1: 55, wave: 'sawtooth', vol: 0.08, lp: 400 }); X.chord('choir', ['d4', 'a4', 'd5'], 0.1, 2.2, 0.8); },
      safe: (X) => { X.chord('celesta', ['d5', 'f#5', 'a5'], 0, 0.8, 0.7, 0.05); },
      death: (X) => { X.note('cbell', 'd3', 0, 2.5, 0.9); X.drum('tk', 0, 0.7); },
      win: { bpm: 100, tracks: { b: { type: 'brass', bright: 1.2 }, s: { type: 'strings', mode: 'chord', center: 64, n: 4 }, d: { type: 'drums', kit: 'orch' } }, chords: 'Bb C | D', bars: 2, parts: { b: 'f5 - - - g5 - - - | a5 - - - - - - -', s: 'x-------x-------|x---------------', d: { y: '................|x...............', k: '................|x...............' } } },
      wipe: (X) => { X.chord('choir', ['d3', 'f3', 'a3'], 0, 2.5, 0.8); X.note('cbell', 'd3', 0, 3, 0.8); X.drum('hb', 0.4, 0.9); X.drum('hb', 1.6, 0.6); },
    },
    fx: { chapter: 'chapter', allin: 'heartbeat', gift: 'safe', win: 'win', wipe: 'wipe' },
    sfx: { groan: 'groan', heartbeat: 'heartbeat', hit: 'scare', fall: 'death', shield: 'safe', thunder: 'chapter' },
  };
})();
