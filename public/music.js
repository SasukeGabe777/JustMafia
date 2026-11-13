// The soundtrack: original chiptune for every world, played by a small synthesizer (lead,
// counter-melody, bass, arpeggio, pad and drums) with a look-ahead step sequencer. No audio files.
//
// Every world has its own theme, key, instruments and character (playful, dreamy, cool, epic,
// dark or grim). Every moment of the game (lobby, day, night, voting, a murder, the gallows,
// victory...) has its own piece in that world's sound. Each piece is COMPOSED as a full 3–4
// minute track: intro, theme, variations, a second and third melody, a breakdown, a build-up,
// a key change and an ending tag. When a track ends, a newly composed track (same theme, new
// melodies and arrangement) follows on the beat, so the music never loops the same way twice.
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

  // Compose one full track (3–4 minutes) for the current piece. Track N of a piece always
  // sounds the same, and every new track brings new melodies and a new arrangement.
  function compose(sg, trackNo) {
    const fl = sg.flavor, rng = rngOf(hash(`${sg.world}:${sg.mood}:${trackNo}`));
    const barSec = 240 / sg.bpm, target = Math.max(24, Math.round((180 + rng() * 60) / barSec / 4) * 4);
    const theme = trackNo % 2 ? vary(sg.lead.motif, rng) : sg.lead.motif.slice();
    const brightKey = ['major', 'mixo', 'lydian'].includes(sg.scale);
    const progs = PROGS[brightKey ? 'bright' : 'dark'].filter((p) => p.join() !== sg.prog.join());
    const progB = pickOf(rng, progs), progC = pickOf(rng, progs.filter((p) => p !== progB));
    const melB = phrase(rng, fl), melC = phrase(rng, fl), melD = phrase(rng, fl, fl.slow >= 0.9);
    const bassAlt = pickOf(rng, fl.bass), arpAlt = pickOf(rng, fl.arp) || sg.arp, arpMain = sg.arp || arpAlt;
    const kit = sg.pat || {}, hasDrums = Object.values(kit).some(Boolean);
    const alt = sg.lead.alt || sg.lead.wave, grim = fl === FLAVORS.grim;
    // The form. Sections are 8 bars (intro, build-up and tag are 4).
    const SEC = {
      intro: { bars: 4, prog: sg.prog, mel: null, lv: { lead: 0, bass: 0.7, arp: 0.8, pad: 0.6, drums: 0.5 }, kit: { kick: kit.kick || '', hat: kit.hat || '' } },
      A: { prog: sg.prog, mel: theme, crash: true },
      A2: { prog: sg.prog, mel: ornament(theme, rng, fl.ornament), arp: arpAlt },
      A3: { prog: sg.prog, mel: theme, counter: true, bass: bassAlt },
      A4: { prog: sg.prog, mel: ornament(theme, rng, fl.ornament * 0.6), shift: fl.lift, kit: hasDrums ? busyKit(kit) : kit, crash: true, counter: grim, oct: grim ? -1 : 0, wave: grim ? alt : null, lv: grim ? { pad: 1.2 } : null },
      A5: { prog: sg.prog, mel: theme, shift: fl.lift, counter: true, crash: true },
      B: { prog: progB, mel: melB, bass: bassAlt },
      B2: { prog: progB, mel: ornament(melB, rng, fl.ornament), counter: true, crash: true },
      B3: { prog: progB, mel: vary(melB, rng), wave: alt },
      C: { prog: progC, mel: melC, wave: alt, kit: hasDrums ? halfKit(kit) : kit, arp: arpAlt },
      C2: { prog: progC, mel: vary(melC, rng), wave: alt, counter: true },
      D: { prog: rng() < 0.5 ? sg.prog : progB, mel: melD, kit: hasDrums ? busyKit(kit) : kit, lv: { arp: 0.3 } },
      brk: { prog: progC, mel: grim ? melC : sparse(melC), wave: alt, kit: grim || !kit.hat ? {} : { hat: kit.hat }, bass: '0...............', lv: { lead: 0.7, bass: 0.7, arp: 1, pad: 1.4, drums: 0.6 } },
      build: { bars: 4, prog: sg.prog.slice(-4), mel: null, build: true, lv: { lead: 0, arp: 1, pad: 0.6 } },
      tag: { bars: 4, prog: sg.prog, mel: theme.slice(0, 16).concat(new Array(16).fill(null)), lv: { drums: 0.8 } },
    };
    const plan = ['intro', 'A', 'A2', 'B', 'A3', 'C', 'brk', 'build', 'A4', 'B2', 'D', 'A5', 'tag'];
    const full = barSec > 4.2 ? 4 : 8; // very slow pieces use shorter sections
    const len = () => plan.reduce((t, k) => t + (SEC[k].bars || full), 0);
    for (const extra of ['B3', 'C2', 'A3', 'C', 'B2', 'A2']) if (len() < target - 4) plan.splice(plan.length - 2, 0, extra);
    for (const cut of ['A3', 'D', 'B2', 'A2', 'C']) if (len() > target + 4 && plan.includes(cut)) plan.splice(plan.indexOf(cut), 1);
    // Lay the sections out bar by bar.
    const bars = [], mel = [], counter = [], grace = [];
    for (const k of plan) {
      const sec = SEC[k], n = sec.bars || full, cm = sec.counter && sec.mel ? counterOf(sec.mel) : null;
      for (let b = 0; b < n; b++) {
        const lastBar = b === n - 1 && n >= 4, k2 = b % 2;
        let pat = sec.kit || kit;
        if (sec.build) { const snare = ['....x.......x...', 'x...x...x...x...', 'x.x.x.x.x.x.x.x.', 'xxxxxxxxxxxxxxxx'][b]; pat = { kick: 'x...x...x...x...', snare, hat: kit.hat ? 'x.x.x.x.x.x.x.x.' : '' }; }
        else if (lastBar && hasDrums && Object.keys(pat).length && !grim) pat = { ...pat, ...FILL };
        else if (lastBar && hasDrums && grim && Object.keys(pat).length) pat = { ...pat, snare: '....x.......x.xx' };
        const lv = { lead: 1, bass: 1, arp: 1, pad: 1, drums: 1, ...(sec.lv || {}) };
        if (sec.build) lv.drums = 0.55 + b * 0.18;
        bars.push({ sec: k, root: sec.prog[b % sec.prog.length], shift: sec.shift || 0, bass: sec.bass || sg.bass, arp: sec.arp || arpMain, pat, lv, crash: !!sec.crash && b === 0 && hasDrums, wave: sec.wave || null, oct: sec.oct || 0 });
        for (let s = 0; s < 16; s++) {
          let x = sec.mel ? sec.mel[k2 * 16 + s] : null;
          // Every other time through the 2-bar melody, the last pair of bars climbs (playful worlds hop up).
          if (typeof x === 'number' && b >= 4 && k2 === 1 && rng() < fl.hop) x += 2;
          mel.push(x); counter.push(cm ? cm[k2 * 16 + s] : null);
          grace.push(typeof x === 'number' && s % 4 === 0 && rng() < fl.grace);
        }
      }
    }
    return { plan, bars, mel, counter, grace, steps: bars.length * 16, seconds: bars.length * barSec };
  }

  let ac = null, out = null, bus = null, pulseWave = null, timer = null, song = null, mood = null, theme = null, step = 0, nextAt = 0, level = 0.8, ducked = false;
  const plays = {}; // how many times each piece has started (so a returning day doesn't restart the same track)
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
      if (a && a !== '.') note(pitch(shifted, root, Number(a), sg.low ? 0 : 1), t, sixteenth * (fl === FLAVORS.grim ? 2.4 : 0.7), { wave: fl === FLAVORS.grim ? 'bell' : sg.lead && sg.lead.wave === 'triangle' ? 'triangle' : 'pulse', vol: (fl === FLAVORS.grim ? 0.03 : 0.022) * m.arp, cutoff: 3000, release: 0.05 });
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
    const sixteenth = 60 / song.bpm / 4;
    while (nextAt < ac.currentTime + 0.2) {
      const swing = song.swing && step % 2 === 1 ? song.swing * sixteenth : 0;
      if (nextAt + swing >= ac.currentTime - 0.05) playStep(step, nextAt + swing, sixteenth);
      nextAt += sixteenth; step++;
    }
  }
  function stop(fade = 1) {
    if (!bus || !ac) { song = null; mood = null; return; }
    const old = bus, t = ac.currentTime;
    old.gain.cancelScheduledValues(t); old.gain.setValueAtTime(old.gain.value, t); old.gain.linearRampToValueAtTime(0.0001, t + fade);
    setTimeout(() => { try { old.disconnect(); } catch { /* gone */ } }, fade * 1000 + 600);
    bus = null; song = null; mood = null; theme = null;
    clearInterval(timer); timer = null;
  }
  // A piece ready to play: its arrangement and first composed track.
  function prepare(key, moodName, trackNo) {
    const sg = build(key, moodName);
    sg.trackNo = trackNo; sg.track = compose(sg, trackNo); sg.trackStart = 0;
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
    ac = ctx2; bus = ctx2.createGain(); bus.gain.value = level; bus.connect(dest);
    song = prepare(key, ALIAS[moodName] || moodName, trackNo); pulseWave = null;
    const six = 60 / song.bpm / 4, first = Math.floor(from / six);
    // Walk through the skipped part without sound so track changes happen as they would live.
    for (let i = 0; i < first; i++) { const l = i - song.trackStart; if (l >= song.track.steps) { song.trackNo++; song.track = compose(song, song.trackNo); song.trackStart = i; } }
    for (let i = first, t = 0.05; t < seconds; i++, t += six) playStep(i, t + (song.swing && i % 2 ? song.swing * six : 0), six);
    ({ ac, bus, song, mood, step } = saved); pulseWave = null;
  }
  // The form of a piece's tracks (for tests and the curious).
  function describe(key, moodName, trackNo = 0) { const sg = prepare(key, ALIAS[moodName] || moodName, trackNo); return { bpm: Math.round(sg.bpm), flavor: (SONGS[key] || SONGS.medieval).flavor, plan: sg.track.plan, bars: sg.track.bars.length, seconds: Math.round(sg.track.seconds) }; }
  return { play, stop, duck, volume, renderTo, describe, SONGS, MOODS, FLAVORS, get mood() { return mood; }, get theme() { return theme; }, get level() { return level; } };
})();
