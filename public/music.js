// The soundtrack: original chiptune for every world, played by a small synthesizer (lead,
// counter-melody, bass, arpeggio, pad and drums) with a look-ahead step sequencer. No audio files.
//
// Every world has its own theme, key, instruments and character (playful, dreamy, cool, epic,
// dark or grim). Every moment of the game (lobby, day, night, voting, a murder, the gallows,
// victory...) has its own piece in that world's sound. Each piece is COMPOSED as a
// stream of 36-bar tracks (theme, answer phrases, new melodies, breakdowns, build-ups, key
// changes); when a track ends, a newly composed one with new melodies and a different form
// follows on the beat, so the music never loops the same way twice.
window.MT_MUSIC = (function () {
  // Scales (semitones). Melodies are written in scale steps so they follow the chords.
  const S = {
    major: [0, 2, 4, 5, 7, 9, 11], mixo: [0, 2, 4, 5, 7, 9, 10], dorian: [0, 2, 3, 5, 7, 9, 10],
    minor: [0, 2, 3, 5, 7, 8, 10], lydian: [0, 2, 4, 6, 7, 9, 11], harmonic: [0, 2, 3, 5, 7, 8, 11],
  };
  // Melodies: 32 sixteenth-note steps (two bars). Numbers are scale steps counted from the
  // current chord's root (0 root, 2 third, 4 fifth, 7 octave); "." rest; "-" hold.
  const M = (s) => s.replace(/\|/g, ' ').trim().split(/\s+/).map((x) => (x === '.' ? null : x === '-' ? '-' : Number(x)));
  const DRUMS = {
    pop: { kick: 'x.....x.x.......', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.' },
    four: { kick: 'x...x...x...x...', snare: '....x.......x...', hat: '..x...x...x...x.' },
    jig: { kick: 'x.....x.x.....x.', snare: '....x.......x..x', hat: '..x..x..x..x..x.' },
    epic: { kick: 'x.x...x.x.x...x.', snare: '....x.......x...', tom: '..........x.x.xx', hat: '' },
    surf: { kick: 'x..x..x.x..x..x.', snare: '....x.......x...', hat: 'xxxxxxxxxxxxxxxx' },
    swing: { kick: 'x.........x.....', snare: '....x.......x...', hat: 'x..xx..xx..xx..x' },
    brush: { kick: 'x.........x.....', snare: '....x.......x...', hat: 'x.....x.x.....x.' },
    sleigh: { kick: 'x.......x.......', snare: '....x.......x...', hat: 'x.xxx.xxx.xxx.xx' },
    funk: { kick: 'x..x...x..x.....', snare: '....x..x....x...', hat: 'x.x.x.x.x.x.x.x.' },
    soft: { kick: 'x.......x.......', snare: '........x.......', hat: '..x...x...x...x.' },
    space: { kick: 'x.......x.......', snare: '....x.......x...', hat: '..x...x...x...x.' },
    march: { kick: 'x.......x.......', snare: '....x..x....x.xx', hat: 'x...x...x...x...' },
  };
  // Each world's character: how its melodies move and how its tracks are arranged.
  //   rhythms  one-bar rhythm cells for new melodies ("x" note, "-" hold, "." rest)
  //   legato   how long short notes ring (low = bouncy staccato)
  //   lift     key change for the last choruses (semitones)
  //   slow     tempo for the other moments of the game (grim worlds stay slow)
  const FLAVORS = {
    playful: { rhythms: ['x.x.xx.x..x.x...', 'x..xx.x.x.x.x...', 'x.x.x..xx.x.x.x.', 'xx.x..x.x..x.x..', 'x...x.x.x.xx....', 'x.xxx.x.x...x.x.'], legato: 0.55, ornament: 0.45, grace: 0.22, lift: 2, slow: 1,
      bass: ['0.0.4.0.0.0.4.7.', '0.7.0.7.0.7.4.7.', '0...4.4.0...4.7.', '0.0.0.7.4.4.2.0.'], arp: ['0.2.4.7.4.2.0.2.', '0.4.7.12.7.4.0.4.', '7.4.2.0.2.4.7.9.', '0.7.4.7.0.7.4.7.'], hop: 0.35 },
    dreamy: { rhythms: ['x---x-x-x---x---', 'x-x-x---x-x-x---', 'x---x---x-x-x-x-', 'x-----x-x---x---'], legato: 0.95, ornament: 0.25, grace: 0.08, lift: 2, slow: 1,
      bass: ['0.......4.......', '0.......0...4...', '0...4...7...4...'], arp: ['0.2.4.7.9.7.4.2.', '0.4.7.11.7.4.0.4.', '0.7.9.7.4.7.9.7.'], hop: 0.1 },
    cool: { rhythms: ['x..x..x.x..x.x..', 'x.x...x.x..x....', 'x..x.x...x.x.x..', '.x.x..x.x..x..x.'], legato: 0.7, ornament: 0.3, grace: 0.15, lift: 1, slow: 1,
      bass: ['0..0..4.0.7.0.4.', '0.0.1.1.2.2.1.1.', '0..0.7..0..0.4.7'], arp: ['', '7...4...7...4...', '0.4.7.4.0.4.7.4.'], hop: 0.2 },
    epic: { rhythms: ['x---x---x-x-x---', 'x-------x---x-x-', 'x---x-x-x---x---', 'x.x.x---x---x---'], legato: 0.9, ornament: 0.2, grace: 0.05, lift: 2, slow: 1,
      bass: ['0.0.0.0.0.0.4.4.', '0...0...4...4...', '0.0.7.7.0.0.4.4.'], arp: ['0.4.7.4.0.4.7.4.', '0.2.4.7.4.2.0.2.'], hop: 0.15 },
    dark: { rhythms: ['x.x.x.x.x..xx.x.', 'x...x.x.x...x.x.', 'x.xx..x.x.xx..x.', 'x---x.x.x---x...'], legato: 0.75, ornament: 0.2, grace: 0.04, lift: 0, slow: 0.92, scale: 'minor',
      bass: ['0.0.4.0.0.0.4.7.', '0.0.0.0.0.0.0.0.', '0...0...1...1...'], arp: ['0.2.4.7.4.2.0.2.', '0.4.0.4.0.4.0.4.', '0...4...7...4...'], hop: 0.1 },
    // Sad and grim: slow, minor, long sighing notes, a muted horn, brushes and a lonely piano.
    grim: { rhythms: ['x-------x---x---', 'x---x-------....', 'x-----x-x-------', 'x---x---x-------', '....x-----x-x---', 'x-----x---x-x---'], legato: 1, ornament: 0.12, grace: 0, lift: 0, slow: 0.72, scale: 'harmonic',
      bass: ['0.......4.......', '0...2...4...5...', '0.......0...4...', '0...........4...'], arp: ['', '0...2...4...2...', '0.......4.......', '4...2...0.......'], hop: 0 },
  };
  // One theme per world. key: MIDI note of the tonic; prog: chord roots (scale steps), one per bar.
  const SONGS = {
    // Mafia Town: a bouncy village chiptune.
    medieval: { flavor: 'playful', bpm: 132, key: 62, scale: 'mixo', prog: [0, 6, 3, 0], lead: { wave: 'pulse', alt: 'triangle', motif: M('0 . 2 4 . 4 2 0 | 4 - 5 4 2 - . . | 0 . 2 4 . 7 6 4 | 5 - 4 2 0 - - .') }, bass: '0...4...0.4.7...', arp: '0.2.4.2.0.2.4.7.', drums: 'pop' },
    smalltown: { flavor: 'playful', bpm: 128, key: 60, scale: 'major', prog: [0, 4, 5, 3], lead: { wave: 'pulse', alt: 'square', motif: M('4 . 4 5 4 . 2 . | 0 . 2 - 4 - . . | 4 . 4 5 7 . 6 4 | 5 - 4 - 2 - . .') }, bass: '0...0.4.0...4.0.', arp: '0.4.7.4.0.4.7.4.', drums: 'pop' },
    // A tavern jig for the tabletop adventure.
    tabletop: { flavor: 'playful', bpm: 144, key: 57, scale: 'dorian', prog: [0, 6, 5, 6], lead: { wave: 'triangle', alt: 'pulse', vibrato: 5, motif: M('4 . 2 0 . 2 4 . 5 4 2 . 0 - . . | 2 . 4 7 . 6 4 . 5 . 4 2 . 0 . .') }, bass: '0..4..0.0..4..7.', arp: '0.2.4.0.2.4.0.2.', drums: 'jig', swing: 0.12 },
    // Dragons: big drums and a heroic theme.
    dragons: { flavor: 'epic', bpm: 138, key: 50, scale: 'dorian', prog: [0, 6, 5, 6], lead: { wave: 'saw', alt: 'square', cutoff: 2200, motif: M('0 - - - 4 - - - 7 - 5 - 4 - 2 - | 0 - - - -1 - 0 - 2 - - - - - . .') }, bass: '0.0.0.0.0.0.4.4.', arp: '0.4.7.4.0.4.7.4.', drums: 'epic' },
    // Dungeon crawl: dark and driving, torchlight and danger.
    dungeon: { flavor: 'dark', bpm: 116, key: 57, scale: 'minor', prog: [0, 5, 3, 4], lead: { wave: 'pulse', alt: 'saw', cutoff: 2000, motif: M('0 . 0 2 . 3 . 2 | 0 . -1 . 0 - . . | 0 . 0 2 . 4 . 5 | 4 - 3 - 2 - . .') }, bass: '0.0.4.0.0.0.4.7.', arp: '0.2.4.7.4.2.0.2.', drums: 'pop' },
    // Fantasy realm: a flute over harp arpeggios.
    fantasy: { flavor: 'dreamy', bpm: 112, key: 67, scale: 'major', prog: [0, 3, 5, 4], lead: { wave: 'triangle', alt: 'bell', vibrato: 6, motif: M('4 - - 5 4 - 2 - 0 - - 2 4 - - - | 5 - 4 - 2 - 4 - 0 - - - - - - .') }, bass: '0.......4.......', arp: '0.2.4.7.9.7.4.2.', drums: 'soft' },
    // Space station: shimmering lydian synth.
    space: { flavor: 'dreamy', bpm: 120, key: 64, scale: 'lydian', prog: [0, 1, 0, 4], lead: { wave: 'square', alt: 'bell', cutoff: 2600, motif: M('0 - 4 - 7 - 6 - 4 - - - 2 - 4 - | 9 - 7 - 6 - 4 - 7 - - - - - . .') }, bass: '0.0...0.0.0...4.', arp: '0.4.7.11.7.4.0.4.', drums: 'space' },
    // Secret agents: surf-spy guitar energy.
    spies: { flavor: 'cool', bpm: 150, key: 64, scale: 'harmonic', prog: [0, 0, 5, 4], lead: { wave: 'saw', alt: 'pulse', cutoff: 1800, motif: M('0 . 0 1 . 0 . 7 . 6 . 4 . 2 . . | 0 . 0 1 . 0 . 7 . 9 . 7 6 4 . .') }, bass: '0.0.1.1.2.2.1.1.', arp: '', drums: 'surf' },
    // Federal investigation: a funky procedural groove.
    fbi: { flavor: 'cool', bpm: 108, key: 53, scale: 'dorian', prog: [0, 3, 0, 3], lead: { wave: 'pulse', alt: 'saw', cutoff: 2400, motif: M('0 . . 0 . 2 . 4 . . 2 . 0 . . . | 0 . . 0 . 2 . 4 . 6 . 4 2 . . .') }, bass: '0..0..4.0.7.0.4.', arp: '7...4...7...4...', drums: 'funk', swing: 0.08 },
    // Snowy village: sleigh bells and a bright carol.
    snow: { flavor: 'playful', bpm: 140, key: 64, scale: 'major', prog: [0, 5, 3, 4], lead: { wave: 'bell', alt: 'pulse', motif: M('7 . 4 . 5 . 4 2 | 4 - 2 . 0 . . . | 2 . 4 . 7 . 9 . | 7 - - . . . . .') }, bass: '0...4...0...4...', arp: '0.4.7.4.0.4.7.4.', drums: 'sleigh' },
    // Block world: fast, happy chiptune.
    blocky: { flavor: 'playful', bpm: 150, key: 60, scale: 'major', prog: [0, 4, 5, 3], lead: { wave: 'pulse', alt: 'square', motif: M('0 2 4 7 4 2 0 2 | 4 . 4 . 5 4 2 . | 7 6 4 2 4 . 2 0 | 2 - - - 0 - . .') }, bass: '0.0.0.0.4.4.4.4.', arp: '0.4.7.12.7.4.0.4.', drums: 'four' },
    // Realistic: warm, soft pop.
    realistic: { flavor: 'dreamy', bpm: 104, key: 62, scale: 'major', prog: [0, 4, 5, 3], lead: { wave: 'triangle', alt: 'bell', motif: M('4 - - 2 - 0 - - 2 - - - . . . . | 4 - - 5 - 4 - 2 - - - - . . . .') }, bass: '0.......0...4...', arp: '0.4.7.4.0.4.7.4.', drums: 'soft' },
    // Noir: rain on the window. A slow, sad muted horn over brushes and a walking bass.
    noir: { flavor: 'grim', bpm: 74, key: 50, scale: 'harmonic', prog: [0, 5, 3, 4], lead: { wave: 'saw', alt: 'bell', cutoff: 950, vibrato: 4.5, motif: M('4 - - - 3 - 2 - 1 - - - 0 - - - | 2 - - 3 4 - - - 3 - 2 - 0 - - -') }, bass: '0...2...4...5...', arp: '', pad: true, drums: 'brush', swing: 0.18 },
    // RSP Supply: upbeat corporate jingle.
    rsp: { flavor: 'playful', bpm: 118, key: 60, scale: 'major', prog: [0, 3, 4, 0], lead: { wave: 'square', alt: 'pulse', cutoff: 2400, motif: M('0 . 2 . 4 . 7 . | 4 - - - 2 . . . | 5 . 4 . 2 . 4 . | 0 - - - . . . .') }, bass: '0...0...4...0...', arp: '0.4.7.4.0.4.7.4.', drums: 'pop' },
  };
  // ----- What plays when -----
  // Each mood is its own piece, played in the current world's key, instruments and character:
  //   lobby    the world's theme, upbeat           day      the world's theme, relaxed and peaceful
  //   reveal   a mysterious build (role cards)     dawn     a gentle sunrise
  //   night    sneaky and suspicious               suspense a heartbeat pulse (murder scenes)
  //   vote     a driving, tense new song (voting)  trial    a heavy march (the gallows)
  //   eerie    sparse and ghostly                  triumph  a victory fanfare
  const TEMPLATES = {
    lobby: { own: true, tempo: 1, layers: { lead: 0.85, bass: 1, arp: 0.8, pad: 0, drums: 0.8 } },
    day: { own: true, tempo: 0.94, layers: { lead: 0.9, bass: 0.9, arp: 0.8, pad: 0.3, drums: 0.55 } },
    reveal: { scale: 'dark', tempo: 0.95, prog: [0, 6, 5, 6], motif: M('. . . . 0 . 4 . . . 7 . . . 6 . | . . . . 0 . 4 . . . 9 . . . 7 .'), bass: '0.......0.......', arp: '0.4.7.4.0.4.7.4.', pat: { kick: 'x.......x.......', hat: '..x...x...x...x.' }, layers: { lead: 0.8, bass: 0.9, arp: 0.9, pad: 0.7, drums: 0.6 } },
    dawn: { scale: 'major', tempo: 0.9, prog: [0, 4, 5, 3], motif: M('4 - - - 5 - 4 - 2 - - - 0 - - - | 2 - - - 4 - 7 - 6 - - - 4 - - -'), bass: '0.......4.......', arp: '0.2.4.7.9.7.4.2.', pat: { kick: 'x.......x.......', hat: '....x.......x...' }, layers: { lead: 0.9, bass: 0.8, arp: 0.9, pad: 0.6, drums: 0.4 } },
    night: { scale: 'dark', tempo: 0.98, prog: [0, 5, 6, 0], motif: M('0 . . 0 . . 2 . 3 . 2 . 0 . . . | 4 . . 4 . . 5 . 4 . 2 . 1 . . .'), bass: '0.0.0.0.0.0.0.0.', arp: '0...4...7...4...', pat: { kick: 'x.......x.......', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.' }, layers: { lead: 0.75, bass: 1, arp: 0.7, pad: 0.45, drums: 0.6 }, low: true },
    suspense: { scale: 'harmonic', tempo: 1, prog: [0, 0, 5, 4], motif: M('0 . . . . . . . 1 . . . . . . . | 0 . . . . . 4 . 3 . . . 1 . . .'), bass: '0.0.0.0.1.1.0.0.', arp: '0.4.0.4.0.4.0.4.', pat: { kick: 'x..x............', hat: '..x...x...x...x.' }, layers: { lead: 0.8, bass: 1, arp: 0.6, pad: 0.5, drums: 0.8 }, low: true },
    vote: { scale: 'harmonic', tempo: 1.12, prog: [0, 3, 4, 0], motif: M('0 . 2 . 3 . 4 . 7 - 6 - 4 . . . | 3 . 4 . 3 . 2 . 1 - - - . . . .'), bass: '0.0.0.0.0.0.0.0.', arp: '0.2.4.2.0.2.4.2.', pat: { kick: 'x...x...x...x...', snare: '....x.......x.x.', hat: 'xxxxxxxxxxxxxxxx' }, layers: { lead: 1, bass: 1.1, arp: 0.9, pad: 0, drums: 1.05 } },
    trial: { scale: 'minor', tempo: 0.8, prog: [0, 5, 3, 4], motif: M('0 - - - 0 - 2 - 3 - - - 2 - - - | 4 - - - 3 - 2 - 1 - - - - - - -'), bass: '0.......0.......', arp: '', pat: DRUMS.march, layers: { lead: 1, bass: 1, arp: 0, pad: 0.8, drums: 1 } },
    eerie: { scale: 'dark', tempo: 0.8, prog: [0, 1, 0, 6], motif: M('. . . . . . . . 7 . . . 6 . . . | . . . . . . . . 4 . . . 3 . . .'), bass: '0...............', arp: '0...7...4...7...', pat: { hat: '..x.......x.....' }, layers: { lead: 0.6, bass: 0.6, arp: 0.8, pad: 1, drums: 0.4 }, low: true },
    triumph: { scale: 'major', tempo: 1.1, prog: [0, 3, 4, 0], motif: M('0 . 0 . 0 . 4 - - - 2 . 4 . 7 - | 7 - 6 - 4 - 5 - 7 - - - - - . .'), bass: '0...4...0...4...', arp: '0.4.7.12.7.4.0.4.', pat: { kick: 'x...x...x...x...', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.' }, layers: { lead: 1.1, bass: 1, arp: 1, pad: 0.4, drums: 1.1 }, up: true },
  };
  // Older and scene mood names.
  const ALIAS = { peace: 'day', ominous: 'night', tension: 'suspense', voting: 'vote', execution: 'trial', gameover: 'triumph' };
  const MOODS = TEMPLATES;
  // A world's piece for a mood: the template's harmony and melody in the world's key,
  // tempo feel, instruments and character (day and lobby play the world's own theme).
  function build(key, moodName) {
    const w = SONGS[key] || SONGS.medieval, tp = TEMPLATES[moodName] || TEMPLATES.day, fl = FLAVORS[w.flavor] || FLAVORS.playful;
    const dark = ['minor', 'harmonic', 'dorian'].includes(w.scale) ? w.scale : 'dorian';
    let scale = tp.own ? w.scale : tp.scale === 'dark' ? dark : tp.scale;
    if (fl.scale && !tp.own) scale = moodName === 'triumph' ? 'dorian' : fl.scale; // grim worlds stay in the shadows (a bittersweet victory)
    return {
      world: key, mood: moodName, flavor: fl, key: w.key, scale, bpm: w.bpm * tp.tempo * (tp.own ? 1 : fl.slow), swing: w.swing || 0, kit: w.drums,
      prog: tp.own ? w.prog : tp.prog,
      lead: { ...w.lead, motif: tp.own ? w.lead.motif : tp.motif },
      bass: tp.own ? w.bass : tp.bass, arp: tp.own ? w.arp : tp.arp,
      pat: tp.own ? DRUMS[w.drums] || DRUMS.pop : tp.pat, pad: w.pad, layers: tp.layers, low: !!tp.low, up: !!tp.up,
    };
  }

  // ----- The composer -----
  const hash = (str) => { let h = 2166136261; for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619); return h >>> 0; };
  function rngOf(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const pickOf = (rng, a) => a[Math.floor(rng() * a.length)];
  const PROGS = {
    bright: [[3, 4, 0, 0], [5, 3, 4, 0], [0, 5, 3, 4], [1, 4, 0, 5], [3, 0, 4, 4], [5, 4, 3, 4], [0, 3, 1, 4]],
    dark: [[5, 6, 0, 0], [3, 4, 0, 0], [0, 5, 2, 6], [5, 3, 4, 4], [0, 3, 4, 0], [5, 2, 3, 4], [0, 6, 5, 4]],
  };
  // A new two-bar melody in the world's character: chord tones on the strong beats, steps and
  // small leaps in between, and the second bar answering the first (call and response).
  function phrase(rng, fl, busy) {
    const cell = () => (busy ? pickOf(rng, ['x.x.x.x.x.x.x.x.', 'xxx.x.xxx.x.x.x.', 'x.xxx.x.x.xxx.x.']) : pickOf(rng, fl.rhythms));
    const r1 = cell(), r2 = rng() < 0.55 ? r1 : cell(), rhythm = r1 + r2;
    const out = new Array(32).fill(null);
    let d = pickOf(rng, [0, 2, 4, 4, 7]), sounding = false;
    for (let i = 0; i < 32; i++) {
      const c = rhythm[i];
      if (c === '-') { out[i] = sounding ? '-' : null; continue; }
      if (c !== 'x') { sounding = false; continue; }
      if (i % 8 === 0) { const tones = [0, 2, 4, 7].filter((x) => Math.abs(x - d) <= 4); d = tones.length ? pickOf(rng, tones) : 4; }
      else d += pickOf(rng, [-2, -1, -1, 1, 1, 2, 0, 3, -3]);
      d = Math.max(-2, Math.min(9, d)); out[i] = d; sounding = true;
    }
    // Answer: the second bar repeats the first bar's shape a little higher or lower.
    if (r1 === r2 && rng() < 0.6) { const t = pickOf(rng, [1, 2, -1, 4]); for (let i = 16; i < 32; i++) if (typeof out[i - 16] === 'number') out[i] = Math.max(-2, Math.min(9, out[i - 16] + t)); }
    cadence(out, rng);
    return out;
  }
  // End a phrase home (root or fifth).
  function cadence(m, rng) { for (let i = m.length - 1; i >= 0; i--) if (typeof m[i] === 'number') { m[i] = rng() < 0.7 ? 0 : 4; break; } return m; }
  // Passing tones in the gaps (more ornaments for playful worlds).
  function ornament(m, rng, p) {
    const o = m.slice();
    for (let i = 1; i < o.length - 1; i++) {
      if (o[i] !== null || typeof o[i + 1] !== 'number' || rng() > p) continue;
      let j = i - 1; while (j >= 0 && o[j] === '-') j--;
      if (j >= 0 && typeof o[j] === 'number' && o[j] !== o[i + 1]) o[i] = o[j] + Math.sign(o[i + 1] - o[j]);
    }
    return o;
  }
  // The theme, changed a little: a new turn in its second half.
  function vary(m, rng) { const t = pickOf(rng, [1, 2, -1]); const o = m.map((x, i) => (typeof x === 'number' && i >= 16 && i < 28 ? Math.max(-2, Math.min(9, x + t)) : x)); return cadence(o, rng); }
  // A quieter second voice a third below the lead, on the strong beats.
  function counterOf(m) { const o = new Array(m.length).fill(null); let last = null; for (let i = 0; i < m.length; i++) { if (typeof m[i] === 'number' && i % 4 === 0) { o[i] = m[i] - 2; last = i; } else if (last != null && i - last < 4 && i % 4 !== 0) o[i] = '-'; } return o; }
  const sparse = (m) => m.map((x, i) => (typeof x === 'number' && i % 8 !== 0 ? null : x === '-' ? null : x));
  const busyKit = (p) => ({ ...p, hat: 'x.xxx.xxx.xxx.xx', kick: p.kick || 'x.......x.......' });
  const halfKit = (p) => ({ kick: 'x...............', snare: '........x.......', hat: p.hat ? 'x...x...x...x...' : '' });
  const FILL = { snare: '....x...x.x.xxxx', tom: '............x.xx' };

  // Compose one 36-bar track for the current piece. Track N of a piece always
  // sounds the same, and every new track brings new melodies and a new arrangement.
  // Every 8-bar section is a little story, never a loop: a statement, its answer, a new idea
  // and a closing phrase, over 8 bars of changing chords, with the bass and the arpeggio
  // changing figure as it goes. The world's theme only opens a few sections per track.
  function compose(sg, trackNo) {
    const fl = sg.flavor, rng = rngOf(hash(`${sg.world}:${sg.mood}:${trackNo}`));
    const barSec = 240 / sg.bpm;
    const theme = trackNo % 2 ? vary(sg.lead.motif, rng) : sg.lead.motif.slice();
    const brightKey = ['major', 'mixo', 'lydian'].includes(sg.scale);
    const pool = PROGS[brightKey ? 'bright' : 'dark'];
    // 8-bar progressions: four chords, then a different four that turn back home.
    const prog8 = (first) => { const second = pickOf(rng, pool.filter((p) => p.join() !== first.join())).slice(); second[3] = rng() < 0.6 ? 4 : second[3]; return first.concat(second); };
    const progA = prog8(sg.prog);
    const others = pool.filter((p) => p.join() !== sg.prog.join());
    const fresh = () => prog8(pickOf(rng, others));
    // 8 bars of melody: statement (2 bars), answer (2), a new idea (2), a closing phrase (2).
    const period = (x, busy) => {
      const answer = vary(x, rng), idea = phrase(rng, fl, busy), close = cadence(rng() < 0.5 ? phrase(rng, fl, busy) : vary(idea, rng), rng);
      return x.concat(answer, idea, close);
    };
    const neu = (busy) => period(phrase(rng, fl, busy), busy);
    const bassPool = [sg.bass].concat(fl.bass).filter(Boolean), arpPool = [sg.arp].concat(fl.arp).filter(Boolean);
    const twoOf = (a) => { const x = pickOf(rng, a), y = pickOf(rng, a.filter((z) => z !== x).concat(a.length < 2 ? [x] : [])); return [x, y]; };
    const kit = sg.pat || {}, hasDrums = Object.values(kit).some(Boolean);
    const alt = sg.lead.alt || sg.lead.wave, grim = fl === FLAVORS.grim;
    const busyOK = fl.slow >= 0.9;
    const melB = neu(), melC = neu(), melD = neu(busyOK), melE = neu(), melG = neu(), melH = neu(busyOK);
    // The form. Sections are 8 bars (intro, build-up and tag are 4).
    const SEC = {
      intro: { bars: 4, prog: progA, mel: null, lv: { lead: 0, bass: 0.7, arp: 0.8, pad: 0.6, drums: 0.5 }, kit: { kick: kit.kick || '', hat: kit.hat || '' } },
      A: { prog: progA, mel: period(theme), crash: true },
      B: { prog: fresh(), mel: melB },
      C: { prog: fresh(), mel: melC, wave: alt, kit: hasDrums ? halfKit(kit) : kit },
      A2: { prog: progA, mel: period(ornament(theme, rng, fl.ornament)), counter: true, wave: grim ? alt : null, crash: true },
      brk: { prog: fresh(), mel: grim ? melC.map((x) => (typeof x === 'number' ? x : x === '-' ? '-' : null)) : sparse(melE), wave: alt, kit: grim || !kit.hat ? {} : { hat: kit.hat }, bassFixed: '0...............', lv: { lead: 0.7, bass: 0.7, arp: 1, pad: 1.4, drums: 0.6 } },
      build: { bars: 4, prog: progA.slice(4), mel: null, build: true, lv: { lead: 0, arp: 1, pad: 0.6 } },
      D: { prog: fresh(), mel: melD, kit: hasDrums && busyOK ? busyKit(kit) : kit, lv: { arp: 0.4 }, crash: true },
      E: { prog: fresh(), mel: melE, counter: true, wave: alt },
      A3: { prog: progA, mel: period(theme), shift: fl.lift, counter: true, crash: true, kit: hasDrums && busyOK ? busyKit(kit) : kit, oct: grim ? -1 : 0 },
      F: { prog: fresh(), mel: period(vary(melB.slice(0, 32), rng)) },
      G: { prog: fresh(), mel: melG, wave: alt },
      H: { prog: fresh(), mel: melH, kit: hasDrums ? halfKit(kit) : kit, counter: true },
      B2: { prog: fresh(), mel: period(ornament(melB.slice(64, 96), rng, fl.ornament)), counter: true },
      tag: { bars: 4, prog: progA, mel: theme.concat(new Array(32).fill(null)).slice(0, 64), lv: { drums: 0.8 } },
    };
    // Every track is 36 bars, then a newly composed track takes over on the beat. The first
    // track of a piece opens with an intro; later ones rotate between different forms.
    const FORMS = [
      [['A', 8], ['D', 8], ['brk', 4], ['build', 4], ['A3', 8], ['tag', 4]],
      [['B', 8], ['E', 8], ['A2', 8], ['H', 8], ['tag', 4]],
      [['A', 8], ['G', 8], ['C', 8], ['F', 8], ['tag', 4]],
    ];
    const plan = trackNo === sg.firstTrack ? [['intro', 4], ['A', 8], ['B', 8], ['C', 8], ['A2', 8]] : FORMS[trackNo % FORMS.length];
    // Lay the sections out bar by bar.
    const bars = [], mel = [], counter = [], grace = [];
    for (const [k, n] of plan) {
      const sec = SEC[k];
      const m = sec.mel, cm = sec.counter && m ? counterOf(m) : null;
      const [bass1, bass2] = twoOf(bassPool), [arp1, arp2] = twoOf(arpPool);
      for (let b = 0; b < n; b++) {
        const lastBar = b === n - 1 && n >= 4;
        let pat = sec.kit || kit;
        if (sec.build) { const snare = ['....x.......x...', 'x...x...x...x...', 'x.x.x.x.x.x.x.x.', 'xxxxxxxxxxxxxxxx'][b]; pat = { kick: 'x...x...x...x...', snare, hat: kit.hat ? 'x.x.x.x.x.x.x.x.' : '' }; }
        else if (b === 3 && n === 8 && hasDrums && Object.keys(pat).length && !grim) pat = { ...pat, snare: '....x.......x.x.' }; // a small pickup mid-section
        if (lastBar && !sec.build && hasDrums && Object.keys(pat).length) pat = { ...pat, ...(grim ? { snare: '....x.......x.xx' } : FILL) };
        const lv = { lead: 1, bass: 1, arp: 1, pad: 1, drums: 1, ...(sec.lv || {}) };
        if (sec.build) lv.drums = 0.55 + b * 0.18;
        // The bass changes figure every two bars and walks into the next chord at phrase ends.
        const walk = (b === 3 || b === 7) && !grim && rng() < 0.6;
        const bass = sec.bassFixed || (walk ? pickOf(rng, ['0...2...4...6...', '0.0.2.2.4.4.6.6.', '4...2...1...0...']) : (Math.floor(b / 2) % 2 ? bass2 : bass1));
        const arp = Math.floor(b / 4) % 2 ? arp2 : arp1;
        bars.push({ sec: k, root: sec.prog[b % sec.prog.length], shift: sec.shift || 0, bass, arp, arpUp: !grim && b >= 4 && rng() < 0.35 ? 1 : 0, pat, lv, crash: !!sec.crash && b === 0 && hasDrums, wave: sec.wave || null, oct: sec.oct || 0 });
        for (let s = 0; s < 16; s++) {
          const idx = (b % (m ? m.length / 16 : 1)) * 16 + s;
          let x = m ? m[idx] : null;
          if (typeof x === 'number' && b >= 6 && rng() < fl.hop * 0.5) x += 2; // the last bars sometimes reach higher
          mel.push(x); counter.push(cm ? cm[idx] : null);
          grace.push(typeof x === 'number' && s % 4 === 0 && rng() < fl.grace);
        }
      }
    }
    return { plan: plan.map((p) => p[0]), bars, mel, counter, grace, steps: bars.length * 16, seconds: bars.length * barSec };
  }

  let ac = null, out = null, bus = null, pulseWave = null, timer = null, song = null, mood = null, theme = null, step = 0, nextAt = 0, level = 0.8, ducked = false;
  const plays = {}; // how many times each piece has started (so a returning day doesn't restart the same track)
  // ----- Your own music (my-music/ on the server) -----
  // Songs are matched to the piece (moment, and optionally world), decoded ahead of time,
  // measured and fitted: silence trimmed, loudness matched to the composed music, faded in
  // and out. In "mix" mode they alternate with composed tracks; "mine" plays them whenever
  // one is ready; "game" ignores them.
  let custom = [], mixMode = 'mix', offline = false;
  const loaded = new Map(); // url -> 'loading' | 'failed' | { buf, gain, start, dur }
  const turns = {};
  const TARGET_RMS = 0.05, XFADE = 2.5;
  function setCustom(list, mode) { custom = Array.isArray(list) ? list.filter((c) => c && c.url && c.mood) : []; if (mode) mixMode = mode; }
  const customFor = (sg) => custom.filter((c) => c.mood === sg.mood && (!c.world || c.world === sg.world));
  function fit(buf) {
    const ch = [];
    for (let c = 0; c < buf.numberOfChannels; c++) ch.push(buf.getChannelData(c));
    const n = buf.length, amp = (i) => { let v = 0; for (const d of ch) v = Math.max(v, Math.abs(d[i])); return v; };
    let s = 0, e = n - 1;
    while (s < n && amp(s) < 0.01) s += 64;
    while (e > s && amp(e) < 0.01) e -= 64;
    let sum = 0, peak = 0, k = 0;
    for (let i = s; i < e; i += 16) { const v = ch[0][i]; sum += v * v; k++; const a = amp(i); if (a > peak) peak = a; }
    const rms = Math.sqrt(sum / Math.max(1, k)) || 0.1;
    return { buf, gain: Math.min(TARGET_RMS / rms, 0.9 / Math.max(peak, 0.01), 2), start: s / buf.sampleRate, dur: Math.max(1, (e - s) / buf.sampleRate) };
  }
  function prefetch(c) {
    if (!c || loaded.has(c.url) || !ac || offline) return;
    loaded.set(c.url, 'loading');
    // Keep at most three decoded songs in memory.
    const ready = [...loaded.entries()].filter(([, v]) => v && v.buf);
    while (ready.length > 3) { const [url] = ready.shift(); if (!song || !song.custom || song.custom.url !== url) loaded.delete(url); }
    fetch(c.url).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(r.status))))
      .then((b) => new Promise((ok, no) => ac.decodeAudioData(b, ok, no)))
      .then((buf) => loaded.set(c.url, fit(buf)))
      .catch(() => loaded.set(c.url, 'failed'));
  }
  // The next of your songs for this piece, in rotation.
  function nextCustom(sg) {
    if (sg.next) return sg.next;
    const list = customFor(sg).filter((c) => loaded.get(c.url) !== 'failed');
    if (!list.length) return null;
    const id = sg.world + ':' + sg.mood; turns[id] = (turns[id] || 0) + 1;
    sg.next = list[(hash(id) + turns[id]) % list.length];
    return sg.next;
  }
  function startCustom(sg, t) {
    const c = nextCustom(sg), L = c && loaded.get(c.url);
    if (!L || !L.buf || !bus) { if (c) prefetch(c); return false; }
    const src = ac.createBufferSource(), g = ac.createGain(), end = t + L.dur;
    src.buffer = L.buf;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(L.gain, t + XFADE);
    g.gain.setValueAtTime(L.gain, Math.max(t + XFADE, end - XFADE)); g.gain.linearRampToValueAtTime(0.0001, end);
    src.connect(g); g.connect(bus); src.start(t, L.start, L.dur);
    sg.custom = { src, url: c.url, name: c.name, resumeAt: end - XFADE };
    sg.next = null; prefetch(nextCustom(sg)); // get the one after ready
    return true;
  }
  // Should one of your songs start here? (Called at section starts.)
  function wantCustom(sg, local) {
    if (offline || mixMode === 'game' || !customFor(sg).length) return false;
    if (mixMode === 'mine') return local % 128 === 0;
    if (local !== 0) return false;
    if (sg.justResumed) { sg.justResumed = false; return false; } // a composed track after each of yours
    return sg.trackNo !== sg.firstTrack; // the piece opens with its composed track
  }
  const mtof = (n) => 440 * Math.pow(2, (n - 69) / 12);
  function pitch(sg, chordRoot, deg, octave = 0) {
    const sc = S[sg.scale], i = chordRoot + deg, o = Math.floor(i / 7), d = ((i % 7) + 7) % 7;
    return sg.key + sc[d] + 12 * (o + octave);
  }
  function ensurePulse() {
    if (pulseWave) return pulseWave;
    const n = 32, re = new Float32Array(n), im = new Float32Array(n), duty = 0.25;
    for (let k = 1; k < n; k++) im[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty);
    pulseWave = ac.createPeriodicWave(re, im); return pulseWave;
  }
  // One synthesized note.
  function note(midi, t, dur, { wave = 'square', vol = 0.05, cutoff = 0, vibrato = 0, attack = 0.008, release = 0.06 } = {}) {
    const o = ac.createOscillator(), g = ac.createGain();
    if (wave === 'pulse') o.setPeriodicWave(ensurePulse()); else o.type = wave === 'saw' ? 'sawtooth' : wave === 'bell' ? 'sine' : wave;
    o.frequency.setValueAtTime(mtof(midi), t);
    let node = o;
    if (cutoff) { const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cutoff; o.connect(f); node = f; }
    if (vibrato) { const l = ac.createOscillator(), lg = ac.createGain(); l.frequency.value = vibrato; lg.gain.value = 9; l.connect(lg); lg.connect(o.detune); l.start(t + 0.12); l.stop(t + dur + release + 0.05); }
    const end = t + dur;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    if (wave === 'bell') g.gain.exponentialRampToValueAtTime(vol * 0.25, t + Math.min(dur, 0.25));
    g.gain.setValueAtTime(wave === 'bell' ? vol * 0.25 : vol, Math.max(t + attack, end - 0.01));
    g.gain.exponentialRampToValueAtTime(0.0001, end + release);
    node.connect(g); g.connect(bus);
    o.start(t); o.stop(end + release + 0.05);
    if (wave === 'bell') note(midi + 12, t, dur * 0.6, { wave: 'sine', vol: vol * 0.35, release }); // a shimmer an octave up
  }
  function noise(t, dur, vol, type, freq) {
    const len = Math.max(1, Math.floor(ac.sampleRate * dur)), buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = buf; f.type = type; f.frequency.value = freq;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(bus); s.start(t); s.stop(t + dur + 0.02);
  }
  // Drum sounds take the world's flavor (brushes for noir, sleigh bells for snow).
  const DRUM = {
    kick(t, v) { const o = ac.createOscillator(), g = ac.createGain(); o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12); g.gain.setValueAtTime(0.32 * v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18); o.connect(g); g.connect(bus); o.start(t); o.stop(t + 0.2); },
    snare(t, v, sg) { const brush = sg.kit === 'swing' || sg.kit === 'brush'; noise(t, brush ? 0.16 : 0.12, (brush ? 0.09 : 0.14) * v, 'bandpass', brush ? 3200 : 1800); if (!brush) { const o = ac.createOscillator(), g = ac.createGain(); o.type = 'triangle'; o.frequency.value = 190; g.gain.setValueAtTime(0.06 * v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08); o.connect(g); g.connect(bus); o.start(t); o.stop(t + 0.1); } },
    hat(t, v, sg) { const bells = sg.kit === 'sleigh'; noise(t, bells ? 0.07 : 0.035, (bells ? 0.07 : 0.045) * v, 'highpass', bells ? 6000 : 7500); },
    tom(t, v) { const o = ac.createOscillator(), g = ac.createGain(); o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(70, t + 0.2); g.gain.setValueAtTime(0.2 * v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25); o.connect(g); g.connect(bus); o.start(t); o.stop(t + 0.3); },
  };
  // Schedule everything that falls on one sixteenth-note step.
  function playStep(i, t, sixteenth) {
    const sg = song;
    let local = i - sg.trackStart;
    if (local >= sg.track.steps) { sg.trackNo++; sg.track = compose(sg, sg.trackNo); sg.trackStart = i; local = 0; } // next track, on the beat
    if (wantCustom(sg, local) && startCustom(sg, t)) { sg.trackStart = i; return false; } // one of your songs takes over
    if (local === 0 && !offline && mixMode !== 'game') prefetch(nextCustom(sg));
    const tr = sg.track, b = tr.bars[Math.floor(local / 16)], s = local % 16, fl = sg.flavor;
    const m = {}; for (const k of ['lead', 'bass', 'arp', 'pad', 'drums']) m[k] = (sg.layers[k] || 0) * (b.lv[k] == null ? 1 : b.lv[k]);
    const root = b.root, low = sg.low ? -1 : 0, shifted = b.shift ? { ...sg, key: sg.key + b.shift } : sg;
    // Lead melody (and a quick grace note in playful worlds).
    const x = tr.mel[local];
    if (m.lead && typeof x === 'number') {
      let len = 1; while (tr.mel[local + len] === '-' && len < 16) len++;
      const dur = len * sixteenth * (len <= 2 ? fl.legato : 0.95);
      const opts = { wave: b.wave || sg.lead.wave, vol: 0.055 * m.lead, cutoff: sg.lead.cutoff, vibrato: sg.lead.vibrato };
      const midi = pitch(shifted, root, x, (sg.up ? 1 : 0) + low + b.oct);
      if (tr.grace[local] && t - 0.045 > ac.currentTime) note(pitch(shifted, root, x + 1, (sg.up ? 1 : 0) + low + b.oct), t - 0.045, 0.04, { ...opts, vol: opts.vol * 0.6, release: 0.02 });
      note(midi, t, Math.max(sixteenth * 0.5, dur), opts);
    }
    // Counter-melody: a softer voice under the lead.
    const c = tr.counter[local];
    if (m.lead && typeof c === 'number') { let len = 1; while (tr.counter[local + len] === '-' && len < 8) len++; note(pitch(shifted, root, c, low + b.oct), t, len * sixteenth * 0.95, { wave: 'triangle', vol: 0.03 * m.lead, cutoff: 1800 }); }
    // Bass: chord-relative, one or two octaves down.
    const bs = b.bass && b.bass[s];
    if (m.bass && bs && bs !== '.' && bs !== '-') note(pitch(shifted, root, Number(bs), sg.key < 56 ? -1 : -2), t, sixteenth * (fl === FLAVORS.grim ? 3.2 : 1.6), { wave: 'triangle', vol: 0.11 * m.bass, release: 0.04 });
    // Arpeggio: short plucks an octave up (patterns may hold two-digit steps like 11/12).
    if (m.arp && b.arp) {
      const tokens = b.arp.match(/\d+|\./g) || [], a = tokens[s % tokens.length];
      if (a && a !== '.') note(pitch(shifted, root, Number(a), (sg.low ? 0 : 1) + (b.arpUp || 0)), t, sixteenth * (fl === FLAVORS.grim ? 2.4 : 0.7), { wave: fl === FLAVORS.grim ? 'bell' : sg.lead && sg.lead.wave === 'triangle' ? 'triangle' : 'pulse', vol: (fl === FLAVORS.grim ? 0.03 : 0.022) * m.arp, cutoff: 3000, release: 0.05 });
    }
    // Pad: the chord, held for the bar.
    const pad = m.pad || (sg.pad ? 0.6 * (b.lv.pad == null ? 1 : b.lv.pad) : 0);
    if (pad && s === 0) for (const d of [0, 2, 4]) note(pitch(shifted, root, d, 0), t, sixteenth * 15, { wave: 'triangle', vol: 0.018 * pad, cutoff: 1200, attack: 0.25, release: 0.4 });
    // Drums (a cymbal swell opens the big sections).
    if (m.drums) {
      if (b.crash && s === 0) noise(t, 1.1, 0.05 * m.drums, 'highpass', 5000);
      for (const part of ['kick', 'snare', 'hat', 'tom']) { const pat = b.pat[part]; if (pat && pat[s] === 'x') DRUM[part](t, m.drums, sg); }
    }
  }
  function tick() {
    if (!song || !ac) return;
    if (song.custom) { // one of your songs is playing: the composed music waits, then comes back in on its fade
      if (ac.currentTime + 0.25 < song.custom.resumeAt) return;
      const at = song.custom.resumeAt; song.custom = null; song.justResumed = true;
      if (mixMode === 'mine' && startCustom(song, at)) return;
      nextAt = Math.max(at, ac.currentTime + 0.05);
    }
    const sixteenth = 60 / song.bpm / 4;
    while (nextAt < ac.currentTime + 0.2) {
      const swing = song.swing && step % 2 === 1 ? song.swing * sixteenth : 0;
      if (nextAt + swing >= ac.currentTime - 0.05 && playStep(step, nextAt + swing, sixteenth) === false) break;
      nextAt += sixteenth; step++;
    }
  }
  function stop(fade = 1) {
    if (!bus || !ac) { song = null; mood = null; return; }
    const old = bus, t = ac.currentTime;
    if (song && song.custom) { try { song.custom.src.stop(t + fade + 0.1); } catch { /* done */ } }
    old.gain.cancelScheduledValues(t); old.gain.setValueAtTime(old.gain.value, t); old.gain.linearRampToValueAtTime(0.0001, t + fade);
    setTimeout(() => { try { old.disconnect(); } catch { /* gone */ } }, fade * 1000 + 600);
    bus = null; song = null; mood = null; theme = null;
    clearInterval(timer); timer = null;
  }
  // A piece ready to play: its arrangement and first composed track.
  function prepare(key, moodName, trackNo) {
    const sg = build(key, moodName);
    sg.trackNo = trackNo; sg.firstTrack = trackNo; sg.track = compose(sg, trackNo); sg.trackStart = 0;
    return sg;
  }
  // Start (or switch) the soundtrack: a new mood or world crossfades into its own piece.
  function play(newMood, newTheme, audio) {
    newMood = ALIAS[newMood] || newMood;
    if (!newMood || !TEMPLATES[newMood]) return stop();
    if (!audio) return;
    const key = SONGS[newTheme] ? newTheme : 'medieval';
    if (song && theme === key && mood === newMood && bus) return;
    ac = audio.ctx; out = audio.master;
    stop(0.9);
    bus = ac.createGain(); bus.gain.setValueAtTime(0.0001, ac.currentTime); bus.gain.linearRampToValueAtTime(ducked ? level * 0.35 : level, ac.currentTime + 1.2); bus.connect(out);
    const id = key + ':' + newMood; plays[id] = (plays[id] || 0) + 1;
    song = prepare(key, newMood, plays[id] - 1); theme = key; mood = newMood; step = 0; nextAt = ac.currentTime + 0.15;
    timer = setInterval(tick, 25);
    if (mixMode !== 'game') prefetch(nextCustom(song));
  }
  function duck(on) {
    ducked = on; if (!bus || !ac) return;
    const g = bus.gain, t = ac.currentTime; g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(on ? level * 0.35 : level, t + (on ? 0.25 : 0.9));
  }
  function volume(v) { level = Math.max(0, Math.min(1, v)); duck(ducked); }
  // Renders part of a piece into another audio context (an OfflineAudioContext for tests and
  // previews). from: seconds into the piece (the composer is deterministic, so it's the same music).
  function renderTo(ctx2, dest, key, moodName, seconds, from = 0, trackNo = 0) {
    const saved = { ac, bus, song, mood, step };
    ac = ctx2; bus = ctx2.createGain(); bus.gain.value = level; bus.connect(dest); offline = true;
    song = prepare(key, ALIAS[moodName] || moodName, trackNo); pulseWave = null;
    const six = 60 / song.bpm / 4, first = Math.floor(from / six);
    // Walk through the skipped part without sound so track changes happen as they would live.
    for (let i = 0; i < first; i++) { const l = i - song.trackStart; if (l >= song.track.steps) { song.trackNo++; song.track = compose(song, song.trackNo); song.trackStart = i; } }
    for (let i = first, t = 0.05; t < seconds; i++, t += six) playStep(i, t + (song.swing && i % 2 ? song.swing * six : 0), six);
    ({ ac, bus, song, mood, step } = saved); pulseWave = null; offline = false;
  }
  // The form of a piece's tracks (for tests and the curious).
  function describe(key, moodName, trackNo = 0) { const sg = prepare(key, ALIAS[moodName] || moodName, trackNo); return { bpm: Math.round(sg.bpm), flavor: (SONGS[key] || SONGS.medieval).flavor, plan: sg.track.plan, bars: sg.track.bars.length, seconds: Math.round(sg.track.seconds) }; }
  // What is playing right now (for the TV's music panel).
  const nowPlaying = () => (song && song.custom ? { mine: true, name: song.custom.name } : song ? { mine: false, name: 'Composed: ' + song.world + ' ' + song.mood } : null);
  const customSummary = () => { const by = {}; for (const c of custom) by[c.mood] = (by[c.mood] || 0) + 1; return { total: custom.length, by, failed: [...loaded.entries()].filter(([, v]) => v === 'failed').map(([u]) => decodeURIComponent(u.split('/').pop())) }; };
  return { setCustom, nowPlaying, customSummary, get mix() { return mixMode; }, play, stop, duck, volume, renderTo, describe, SONGS, MOODS, FLAVORS, get mood() { return mood; }, get theme() { return theme; }, get level() { return level; } };
})();
