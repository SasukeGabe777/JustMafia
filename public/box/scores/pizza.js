'use strict';
// YesChef (key pizza): the food court's music. Nonna Pina's trattoria band: a mandolin (lute) strumming off-beats, an accordion-
// like clarinet singing a tarantella-flavoured tune in A minor, upright bass on the downbeats and
// a tambourine. The building music is a calm lo-fi kitchen groove that turns tense for the last
// ten seconds; the reveal is a brass fanfare; the finale is the theme, a tone up.
// Cues: title lobby intro think play tense reveal finale (public/box/scores/README.md), plus one
// tune per kitchen for the order phase: taco, sushi, burger, sundae (the pizzeria keeps play).
(function () {
  const S = (window.BOX.scores = window.BOX.scores || {});
  const tracks = {
    keys: { type: 'lute', mode: 'chord', center: 62, n: 3, vol: 0.42, pan: -0.2 },
    pad: { type: 'strings', mode: 'chord', center: 64, n: 4, vol: 0.18, cut: 1800 },
    bass: { type: 'upright', mode: 'bass', oct: 2, vol: 0.6 },
    lead: { type: 'clarinet', vol: 0.42, pan: 0.12, vib: 6, dly: 0.12 },
    bell: { type: 'glock', vol: 0.16, pan: 0.3, oct: 1 },
    dr: { type: 'drums', kit: 'world', vol: 0.7 },
  };
  const A = 'Am | Dm | E7 | Am | Am | Dm | E7 | Am';
  const B = 'C | G7 | G7 | C | F | C | E7 | Am';
  const melA = 'e5 - a5 - c6 - b5 a5 | d5 - f5 - a5 - g5 f5 | e5 - g#5 - b5 - a5 g#5 | a5 - - - . . e5 e5 | a5 - c6 - e6 - d6 c6 | d6 - c6 - b5 - a5 f5 | e5 - b5 - g#5 - d5 - | a5 - - - - - . .';
  const melB = 'g5 - e5 - c5 - e5 g5 | f5 - d5 - b4 - d5 f5 | g5 - f5 - d5 - b4 - | c5 - - - . . g5 g5 | a5 - f5 - c6 - a5 f5 | g5 - e5 - c5 - e5 g5 | b5 - g#5 - e5 - d5 b4 | a4 - - - - - . .';
  const groove = { k: 'x.......x.......', tb: 'x.x.x.x.x.x.x.xX', s: '....g.......x...' };
  const fill = { k: 'x.......x.......|x.......x...x.x.', tb: 'x.x.x.x.x.x.x.xX|xxxxxxxxxxxxxxxx', s: '....g.......x...|....x.....x.x.XX' };
  S.pizza = {
    name: 'pizza',
    cues: {
      title: {
        bpm: 120, tracks,
        sections: {
          I: { bars: 4, chords: 'Am | Dm | E7 | Am', keys: 'x.x.x.x.x.x.x.x.', bass: '1 - 5 - 1 - 5 -', bell: 'e5 . a5 . c6 . . . | d5 . f5 . a5 . . . | e5 . g#5 . b5 . . . | a5 . . . . . . .', dr: { tb: 'x.x.x.x.x.x.x.x.', y: '................|................|................|............x.x.' } },
          A: { bars: 8, chords: A, keys: '..x...x...x...x.', bass: '1 - 5 - 1 - 5 -', lead: melA, dr: groove },
          B: { bars: 8, chords: B, keys: '..x...x...x...x.', pad: true, bass: '1 - 5 - 1 - 5 -', lead: melB, bell: '. . . . . . . . | . . . . . . . . | . . . . . . . . | c6 - - - . . . .', dr: fill },
          A2: { bars: 8, chords: A, keys: 'x.xxx.xxx.xxx.xx', pad: true, bass: '1 - 5 - 1 - 5 -', lead: melA, bell: melA, dr: groove },
        },
        form: ['I', 'A', 'B', 'A2'], loop: 1,
      },
      lobby: { from: 'title', bpm: 100, tracks: { lead: { vol: 0.3 } }, form: ['A', 'B'], loop: 0,
        sections: { A: { lead: false, bell: '. . . . c5 . . . | . . . . a4 . . .', dr: { k: 'x.......x.......', s: '....g.......x...', h: '..x...x...x...x.' } }, B: { lead: melB, dr: { k: 'x.......x.......', s: '....x.......x...', sh: 'xgxgxgxgxgxgxgxg' } } } },
      intro: { from: 'title', bpm: 116, form: ['I', 'A', 'B', 'A2'] },
      think: {
        bpm: 90, swing16: 0.56,
        tracks: { keys: { type: 'epiano', mode: 'chord', center: 63, n: 4, vol: 0.45, trem: 0.3, pan: -0.2 }, arp: { type: 'marimba', mode: 'chord', center: 72, n: 4, vol: 0.32, pan: 0.25, dly: 0.2 }, bass: { type: 'bass', mode: 'bass', cut: 600 }, pad: { type: 'pad', mode: 'chord', center: 64, vol: 0.25, cut: 1400 }, dr: { type: 'drums', kit: 'lofi', vol: 0.6 } },
        sections: {
          A: { bars: 8, chords: 'Dm9 | G13 | Cmaj9 | Am9 | Dm9 | G13 | Ebmaj7 | G7sus4', keys: 'x---------x-----', arp: '1.2.3.4.3.2.4.3.', bass: '1 - - - - - 5 . | 1 - - . 5 - - .', pad: true, dr: { k: 'x.......x.x.....', s: '....g.......g...', h: '..x...x...x...x.' } },
          B: { bars: 8, chords: 'Fmaj7 | Em7 | Dm9 | Cmaj9 | Bbmaj7 | Am7 | Abmaj7 | G7sus4', keys: 'x-----x---x-----', arp: '4.3.2.1.2.3.4.2.', bass: '1 - - . 1 - 5 . | 1 - - - 5 - - .', pad: true, dr: { k: 'x.......x.x.....', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' } },
        },
        form: ['A', 'B'], loop: 0,
      },
      play: { from: 'title', bpm: 138, form: ['A', 'B', 'A2'], loop: 0 },
      kitchen: { from: 'think', bpm: 102, tracks: { lead: { type: 'fmkeys', ratio: 3, index: 1.2, vol: 0.4, dly: 0.2, pan: 0.1 } },
        sections: {
          A: { lead: 'd5 - f5 a5 - g5 - e5 | d5 - - - . . b4 d5 | e5 - g5 b5 - a5 - g5 | e5 - - - . . . . | d5 - f5 a5 - g5 - e5 | d5 - - - . . f5 g5 | g5 - - - f5 - eb5 - | d5 - - - . . . .', dr: { k: 'x.....x...x.....', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' } },
          B: { dr: { k: 'x.....x...x..x..', s: '....x.......x...', h: 'xxx.xxx.xxx.xxx.' } },
        } },
      tense: {
        bpm: 128,
        tracks: { sb: { type: 'synthbass', mode: 'bass', oct: 2, vol: 0.5 }, str: { type: 'strings', mode: 'chord', center: 62, n: 3, vol: 0.4, att: 0.02, rel: 0.1 }, pad: { type: 'pad', mode: 'chord', center: 60, vol: 0.25, cut: 1200 }, tk: { type: 'drums' }, dr: { type: 'drums', kit: 'std' }, lead: { type: 'brass', vol: 0.35 } },
        sections: {
          A: { bars: 8, chords: 'Dm | Dm | Bb | C | Dm | Dm | Bb | A7', sb: '1 1 8 1 1 8 1 5', str: 'x..x..x.x..x..x.', pad: true, tk: { tick: 'x.x.x.x.x.x.x.x.', tock: '' }, dr: { k: 'x...x...x...x...', s: '........x.......', t1: '..............xx' } },
          B: { bars: 8, chords: 'Gm | A7 | Dm | Bb | Gm | A7 | Bb | A7', sb: '1 1 8 1 1 8 1 5', str: 'x..x..x.x..x..x.', pad: true, lead: 'd5 - - - e5 - - - | f5 - - - e5 - - - | d5 - - - a4 - - - | bb4 - - - c5 - - - | d5 - - - e5 - - - | f5 - - - g5 - - - | a5 - - - g5 - f5 - | e5 - - - - - - -', tk: { tick: 'x.x.x.x.x.x.x.x.' }, dr: { k: 'x...x...x...x...', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' } },
        },
        form: ['A', 'B'], loop: 0,
      },
      reveal: {
        bpm: 110,
        tracks: { br: { type: 'brass', mode: 'chord', center: 66, n: 4, vol: 0.5 }, str: { type: 'strings', mode: 'chord', center: 64, n: 4, vol: 0.4 }, bass: { type: 'bass', mode: 'bass' }, tp: { type: 'timp', vol: 0.5 }, dr: { type: 'drums', kit: 'orch' } },
        sections: {
          R: { bars: 2, chords: 'C7sus4 | C7', str: 'x-------x-------', tp: 'c3 c3 c3 c3 c3 c3 c3 c3 | c3 c3 c3 c3 g2 g2 g2 g2', dr: { s: '2323434545656767|7878989899999999' } },
          H: { bars: 4, chords: 'F | Bb/F | F | C7', br: 'X-----x-x---x---', str: true, bass: '1 - - - 5 - 1 .', dr: { k: 'x.......x.......', y: 'x...............', s: '....x.......x...' } },
        },
        form: ['R', 'H'], loop: 1,
      },
      finale: { from: 'title', bpm: 114, transpose: 2, tracks: { br: { type: 'brass', mode: 'chord', center: 67, n: 3, vol: 0.38 } },
        sections: { A: { br: '....x.x.....x...' }, B: { br: 'x.......x.......' }, A2: { br: '....x.x.....x...' } } },
      // YesChef's other kitchens: each one's own tune while the customer shows the order.
      // El Cohete (taco truck): trumpets, a strummed guitar and an oom-pah tuba in D.
      taco: {
        bpm: 150,
        tracks: { gtr: { type: 'nylon', mode: 'chord', center: 62, n: 3, vol: 0.4, pan: -0.25 }, bass: { type: 'tuba', mode: 'bass', oct: 2, vol: 0.55 }, lead: { type: 'brass', vol: 0.42, pan: 0.15 }, lead2: { type: 'brass', vol: 0.22, pan: -0.1 }, dr: { type: 'drums', kit: 'world', vol: 0.65 } },
        sections: {
          A: { bars: 8, chords: 'D | A7 | A7 | D | D | G | A7 | D', gtr: '..x...x...x...x.', bass: '1 . 5 . 1 . 5 .',
            lead: 'a4 d5 f#5 a5 - f#5 d5 . | e5 g5 a5 c#6 - a5 g5 . | c#5 e5 g5 a5 - g5 e5 . | f#5 - d5 - . . a4 . | a4 d5 f#5 a5 - b5 a5 . | b5 - g5 - e5 - d5 . | e5 f#5 g5 e5 c#5 - a4 . | d5 - - - . . . .',
            lead2: 'f#4 a4 d5 f#5 - d5 a4 . | c#5 e5 f#5 a5 - f#5 e5 . | a4 c#5 e5 f#5 - e5 c#5 . | d5 - a4 - . . f#4 . | f#4 a4 d5 f#5 - g5 f#5 . | g5 - d5 - c#5 - b4 . | c#5 d5 e5 c#5 a4 - e4 . | f#4 - - - . . . .',
            dr: { k: 'x.......x.......', s: '....x.......x...', sh: 'x.x.x.x.x.x.x.x.' } },
        },
        form: ['A'], loop: 0,
      },
      // Ren's Sushi Bar: a plucked koto-like harp and a breathy flute on a pentatonic tune.
      sushi: {
        bpm: 96,
        tracks: { harp: { type: 'harp', mode: 'chord', center: 64, n: 3, vol: 0.38, pan: -0.2, dly: 0.25 }, pad: { type: 'pad', mode: 'chord', center: 60, vol: 0.2, cut: 1200 }, bass: { type: 'bass', mode: 'bass', cut: 500, vol: 0.45 }, lead: { type: 'flute', vol: 0.4, pan: 0.15, vib: 5, dly: 0.2 }, dr: { type: 'drums', kit: 'world', vol: 0.45 } },
        sections: {
          A: { bars: 8, chords: 'Am | F | G | Em | Am | F | G | Am', harp: 'x.x.x...x.x.x...', pad: true, bass: '1 - - - 5 - - -',
            lead: 'e5 - g5 a5 - g5 e5 . | d5 - c5 - a4 - . . | c5 d5 e5 - g5 - e5 . | d5 - - - . . . . | e5 - g5 a5 - c6 a5 . | g5 - e5 - d5 - c5 . | d5 e5 c5 - a4 - g4 . | a4 - - - . . . .',
            dr: { k: 'x.......x.......', s: '............x...', h: '..x...x...x...x.' } },
        },
        form: ['A'], loop: 0,
      },
      // Buck's Burger Joint: a swinging fifties diner: honky-tonk piano, walking bass, a sax.
      burger: {
        bpm: 168, swing: 0.6,
        tracks: { keys: { type: 'honky', mode: 'chord', center: 62, n: 3, vol: 0.42, pan: -0.2 }, bass: { type: 'upright', mode: 'bass', oct: 2, vol: 0.6 }, lead: { type: 'sax', vol: 0.42, pan: 0.15 }, dr: { type: 'drums', kit: 'std', vol: 0.65 } },
        sections: {
          A: { bars: 8, chords: 'C | C | F | C | G7 | F | C | G7', keys: '..x...x...x...x.', bass: '1 3 5 6 8 6 5 3',
            lead: 'c5 e5 g5 a5 - g5 e5 c5 | . . c5 . e5 - g5 . | f5 a5 c6 d6 - c6 a5 f5 | g5 - e5 - c5 - . . | g5 b5 d6 f6 - d6 b5 g5 | a5 - f5 - c5 - . . | c5 e5 g5 c6 - g5 e5 c5 | d5 - b4 - g4 - . .',
            dr: { k: 'x.......x.......', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' } },
        },
        form: ['A'], loop: 0,
      },
      // Coco's Sundae Stand: an ice-cream-truck music box with glockenspiel and pizzicato.
      sundae: {
        bpm: 132,
        tracks: { box: { type: 'musicbox', vol: 0.45, pan: 0.1 }, bell: { type: 'glock', vol: 0.22, pan: -0.2, oct: 1 }, bass: { type: 'pizz', mode: 'bass', oct: 2, vol: 0.5 }, keys: { type: 'celesta', mode: 'chord', center: 67, n: 3, vol: 0.25 }, dr: { type: 'drums', kit: 'lofi', vol: 0.4 } },
        sections: {
          A: { bars: 8, chords: 'F | C7 | C7 | F | F | Bb | C7 | F', keys: '..x...x...x...x.', bass: '1 . 5 . 1 . 5 .',
            box: 'c6 a5 f5 a5 c6 - a5 . | bb5 g5 e5 g5 bb5 - g5 . | c6 bb5 a5 g5 a5 - f5 . | g5 - e5 - c5 - . . | c6 a5 f5 a5 c6 - f6 . | d6 - bb5 - g5 - . . | c6 bb5 a5 g5 e5 - g5 . | f5 - - - . . . .',
            bell: 'f5 . . . c5 . . . | e5 . . . c5 . . . | e5 . . . g5 . . . | f5 . . . . . . . | f5 . . . a5 . . . | bb5 . . . d5 . . . | c5 . . . e5 . . . | f5 . . . . . . .',
            dr: { k: 'x.......x.......', s: '....x.......x...' } },
        },
        form: ['A'], loop: 0,
      },
    },
    stingers: {
      win: { bpm: 120, tracks: { b: { type: 'brass', vol: 0.6 }, g: { type: 'glock', vol: 0.4 }, d: { type: 'drums', kit: 'orch' } }, bars: 2, parts: { b: 'c5+e5+g5 . c5+e5+g5 c5+f5+a5 - - c5+e5+g5 - | c5+e5+g5+c6 - - - - - - -', g: 'g5 . g5 a5 - - g5 - | c6 - - - - - - -', d: { s: 'x.x.x.....x.....', y: '................|x...............' } } },
      reveal: { bpm: 110, gain: 1, tracks: { b: { type: 'brass', vol: 0.55 }, d: { type: 'drums', kit: 'orch' } }, bars: 1, parts: { b: 'f4+a4+c5+f5 - - - - - - -', d: { k: 'x', y: 'x' } } },
      good: { bpm: 140, tracks: { g: { type: 'fmkeys', ratio: 3, index: 1.2 } }, bars: 1, parts: { g: 'c5 e5 g5 c6 - - - -' } },
      bad: { bpm: 100, tracks: { b: { type: 'mute' } }, bars: 1, parts: { b: 'e4 - eb4 - d4 - - -' } },
      round: { bpm: 120, tracks: { b: { type: 'pluck', dly: 0.3 } }, bars: 1, parts: { b: 'c5 g5 c6 . . . . .' } },
    },
    sfx: {},
  };
})();
