// The soundtrack: original, upbeat chiptune for every world, played by a small synthesizer
// (lead, bass, arpeggio, pad and drums) with a look-ahead step sequencer. No audio files.
// Each world has its own theme song, key and instruments; each moment of the game (day,
// night, voting, a murder, the gallows, victory...) has its own piece in that world's sound.
window.MT_MUSIC = (function () {
  // Scales (semitones). Every song is built on a 7-note scale so melodies can follow chords.
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
    sleigh: { kick: 'x.......x.......', snare: '....x.......x...', hat: 'x.xxx.xxx.xxx.xx' },
    funk: { kick: 'x..x...x..x.....', snare: '....x..x....x...', hat: 'x.x.x.x.x.x.x.x.' },
    soft: { kick: 'x.......x.......', snare: '........x.......', hat: '..x...x...x...x.' },
    space: { kick: 'x.......x.......', snare: '....x.......x...', hat: '..x...x...x...x.' },
  };
  // One song per world. key: MIDI note of the tonic; prog: chord roots (scale steps), one per bar.
  const SONGS = {
    // Mafia Town: a bouncy village chiptune.
    medieval: { bpm: 132, key: 62, scale: 'mixo', prog: [0, 6, 3, 0], lead: { wave: 'pulse', motif: M('0 . 2 4 . 4 2 0 | 4 - 5 4 2 - . . | 0 . 2 4 . 7 6 4 | 5 - 4 2 0 - - .') }, bass: '0...4...0.4.7...', arp: '0.2.4.2.0.2.4.7.', drums: 'pop' },
    smalltown: { bpm: 128, key: 60, scale: 'major', prog: [0, 4, 5, 3], lead: { wave: 'pulse', motif: M('4 . 4 5 4 . 2 . | 0 . 2 - 4 - . . | 4 . 4 5 7 . 6 4 | 5 - 4 - 2 - . .') }, bass: '0...0.4.0...4.0.', arp: '0.4.7.4.0.4.7.4.', drums: 'pop' },
    // A tavern jig for the tabletop adventure.
    tabletop: { bpm: 144, key: 57, scale: 'dorian', prog: [0, 6, 5, 6], lead: { wave: 'triangle', vibrato: 5, motif: M('4 . 2 0 . 2 4 . 5 4 2 . 0 - . . | 2 . 4 7 . 6 4 . 5 . 4 2 . 0 . .') }, bass: '0..4..0.0..4..7.', arp: '0.2.4.0.2.4.0.2.', drums: 'jig', swing: 0.12 },
    // Dragons: big drums and a heroic theme.
    dragons: { bpm: 138, key: 50, scale: 'dorian', prog: [0, 6, 5, 6], lead: { wave: 'saw', cutoff: 2200, motif: M('0 - - - 4 - - - 7 - 5 - 4 - 2 - | 0 - - - -1 - 0 - 2 - - - - - . .') }, bass: '0.0.0.0.0.0.4.4.', arp: '0.4.7.4.0.4.7.4.', drums: 'epic' },
    // Dungeon crawl: an adventurous minor run (driving, not gloomy).
    dungeon: { bpm: 126, key: 57, scale: 'minor', prog: [0, 5, 2, 6], lead: { wave: 'pulse', motif: M('0 . 0 2 . 4 . 2 | 7 . 6 . 4 . 2 . | 0 . 0 2 . 4 . 7 | 6 - 4 - 2 - . .') }, bass: '0.0.4.0.0.0.4.7.', arp: '0.2.4.7.4.2.0.2.', drums: 'pop' },
    // Fantasy realm: a flute over harp arpeggios.
    fantasy: { bpm: 112, key: 67, scale: 'major', prog: [0, 3, 5, 4], lead: { wave: 'triangle', vibrato: 6, motif: M('4 - - 5 4 - 2 - 0 - - 2 4 - - - | 5 - 4 - 2 - 4 - 0 - - - - - - .') }, bass: '0.......4.......', arp: '0.2.4.7.9.7.4.2.', drums: 'soft' },
    // Space station: shimmering lydian synth.
    space: { bpm: 120, key: 64, scale: 'lydian', prog: [0, 1, 0, 4], lead: { wave: 'square', cutoff: 2600, motif: M('0 - 4 - 7 - 6 - 4 - - - 2 - 4 - | 9 - 7 - 6 - 4 - 7 - - - - - . .') }, bass: '0.0...0.0.0...4.', arp: '0.4.7.11.7.4.0.4.', drums: 'space' },
    // Secret agents: surf-spy guitar energy.
    spies: { bpm: 150, key: 64, scale: 'harmonic', prog: [0, 0, 5, 4], lead: { wave: 'saw', cutoff: 1800, motif: M('0 . 0 1 . 0 . 7 . 6 . 4 . 2 . . | 0 . 0 1 . 0 . 7 . 9 . 7 6 4 . .') }, bass: '0.0.1.1.2.2.1.1.', arp: '', drums: 'surf' },
    // Federal investigation: a funky procedural groove.
    fbi: { bpm: 108, key: 53, scale: 'dorian', prog: [0, 3, 0, 3], lead: { wave: 'pulse', motif: M('0 . . 0 . 2 . 4 . . 2 . 0 . . . | 0 . . 0 . 2 . 4 . 6 . 4 2 . . .') }, bass: '0..0..4.0.7.0.4.', arp: '7...4...7...4...', drums: 'funk', swing: 0.08 },
    // Snowy village: sleigh bells and a bright carol.
    snow: { bpm: 140, key: 64, scale: 'major', prog: [0, 5, 3, 4], lead: { wave: 'bell', motif: M('7 . 4 . 5 . 4 2 | 4 - 2 . 0 . . . | 2 . 4 . 7 . 9 . | 7 - - . . . . .') }, bass: '0...4...0...4...', arp: '0.4.7.4.0.4.7.4.', drums: 'sleigh' },
    // Block world: fast, happy chiptune.
    blocky: { bpm: 150, key: 60, scale: 'major', prog: [0, 4, 5, 3], lead: { wave: 'pulse', motif: M('0 2 4 7 4 2 0 2 | 4 . 4 . 5 4 2 . | 7 6 4 2 4 . 2 0 | 2 - - - 0 - . .') }, bass: '0.0.0.0.4.4.4.4.', arp: '0.4.7.12.7.4.0.4.', drums: 'four' },
    // Realistic: warm, soft pop.
    realistic: { bpm: 104, key: 62, scale: 'major', prog: [0, 4, 5, 3], lead: { wave: 'triangle', motif: M('4 - - 2 - 0 - - 2 - - - . . . . | 4 - - 5 - 4 - 2 - - - - . . . .') }, bass: '0.......0...4...', arp: '0.4.7.4.0.4.7.4.', drums: 'soft' },
    // Noir: swing jazz with a muted horn and a walking bass.
    noir: { bpm: 116, key: 55, scale: 'dorian', prog: [1, 4, 0, 0], lead: { wave: 'saw', cutoff: 1100, motif: M('4 . . 2 . 4 . . 6 - 5 . 4 . . . | 2 . . 0 . 2 . . 4 - - - . . . .') }, bass: '0...2...4...5...', arp: '', pad: true, drums: 'swing', swing: 0.22 },
    // RSP Supply: upbeat corporate jingle.
    rsp: { bpm: 118, key: 60, scale: 'major', prog: [0, 3, 4, 0], lead: { wave: 'square', cutoff: 2400, motif: M('0 . 2 . 4 . 7 . | 4 - - - 2 . . . | 5 . 4 . 2 . 4 . | 0 - - - . . . .') }, bass: '0...0...4...0...', arp: '0.4.7.4.0.4.7.4.', drums: 'pop' },
  };
  // ----- What plays when -----
  // Each mood is its own piece, played in the current world's key and instruments, so the
  // world keeps its sound while the music follows the story:
  //   lobby    the world's theme, upbeat           day      the world's theme, relaxed and peaceful
  //   reveal   a mysterious build (role cards)     dawn     a gentle sunrise
  //   night    sneaky and suspicious, still upbeat suspense a heartbeat pulse (murder scenes)
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
    trial: { scale: 'minor', tempo: 0.8, prog: [0, 5, 3, 4], motif: M('0 - - - 0 - 2 - 3 - - - 2 - - - | 4 - - - 3 - 2 - 1 - - - - - - -'), bass: '0.......0.......', arp: '', pat: { kick: 'x.......x.......', tom: '....x..x....x.xx' }, layers: { lead: 1, bass: 1, arp: 0, pad: 0.8, drums: 1 } },
    eerie: { scale: 'dark', tempo: 0.8, prog: [0, 1, 0, 6], motif: M('. . . . . . . . 7 . . . 6 . . . | . . . . . . . . 4 . . . 3 . . .'), bass: '0...............', arp: '0...7...4...7...', pat: { hat: '..x.......x.....' }, layers: { lead: 0.6, bass: 0.6, arp: 0.8, pad: 1, drums: 0.4 }, low: true },
    triumph: { scale: 'major', tempo: 1.1, prog: [0, 3, 4, 0], motif: M('0 . 0 . 0 . 4 - - - 2 . 4 . 7 - | 7 - 6 - 4 - 5 - 7 - - - - - . .'), bass: '0...4...0...4...', arp: '0.4.7.12.7.4.0.4.', pat: { kick: 'x...x...x...x...', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.' }, layers: { lead: 1.1, bass: 1, arp: 1, pad: 0.4, drums: 1.1 }, up: true },
  };
  // Older and scene mood names.
  const ALIAS = { peace: 'day', ominous: 'night', tension: 'suspense', voting: 'vote', execution: 'trial', gameover: 'triumph' };
  const MOODS = TEMPLATES;
  // A world's song for a mood: the template's harmony and melody in the world's key,
  // tempo feel and instruments (day and lobby play the world's own theme).
  function build(key, moodName) {
    const w = SONGS[key] || SONGS.medieval, tp = TEMPLATES[moodName] || TEMPLATES.day;
    const dark = ['minor', 'harmonic', 'dorian'].includes(w.scale) ? w.scale : 'dorian';
    const scale = tp.own ? w.scale : tp.scale === 'dark' ? dark : tp.scale;
    return {
      key: w.key, scale, bpm: w.bpm * tp.tempo, swing: w.swing || 0, kit: w.drums,
      prog: tp.own ? w.prog : tp.prog,
      lead: { ...w.lead, motif: tp.own ? w.lead.motif : tp.motif },
      bass: tp.own ? w.bass : tp.bass, arp: tp.own ? w.arp : tp.arp,
      pat: tp.own ? DRUMS[w.drums] || DRUMS.pop : tp.pat, pad: w.pad, layers: tp.layers, low: !!tp.low, up: !!tp.up,
    };
  }

  let ac = null, out = null, bus = null, pulseWave = null, timer = null, song = null, mood = null, theme = null, step = 0, nextAt = 0, level = 0.8, ducked = false;
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
    snare(t, v, sg) { const brush = sg.kit === 'swing'; noise(t, brush ? 0.16 : 0.12, 0.14 * v, 'bandpass', brush ? 3200 : 1800); if (!brush) { const o = ac.createOscillator(), g = ac.createGain(); o.type = 'triangle'; o.frequency.value = 190; g.gain.setValueAtTime(0.06 * v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08); o.connect(g); g.connect(bus); o.start(t); o.stop(t + 0.1); } },
    hat(t, v, sg) { const bells = sg.kit === 'sleigh'; noise(t, bells ? 0.07 : 0.035, (bells ? 0.07 : 0.045) * v, 'highpass', bells ? 6000 : 7500); },
    tom(t, v) { const o = ac.createOscillator(), g = ac.createGain(); o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(70, t + 0.2); g.gain.setValueAtTime(0.2 * v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25); o.connect(g); g.connect(bus); o.start(t); o.stop(t + 0.3); },
  };
  // Schedule everything that falls on one sixteenth-note step.
  function playStep(i, t, sixteenth) {
    const sg = song, m = sg.layers, bar = Math.floor(i / 16) % sg.prog.length, s = i % 16, cycle = Math.floor(i / (16 * sg.prog.length));
    const root = sg.prog[bar], low = sg.low ? -1 : 0;
    // Lead: a two-bar melody over the chords; every other time round, the second half climbs.
    if (m.lead && sg.lead) {
      const idx = (bar % 2) * 16 + s, x = sg.lead.motif[idx];
      if (typeof x === 'number') {
        let len = 1; while (sg.lead.motif[idx + len] === '-' && idx + len < 32) len++;
        const lift = cycle % 2 === 1 && bar >= 2 ? 2 : 0;
        note(pitch(sg, root, x + lift, (sg.up ? 1 : 0) + low), t, len * sixteenth * 0.92, { wave: sg.lead.wave, vol: 0.055 * m.lead, cutoff: sg.lead.cutoff, vibrato: sg.lead.vibrato });
      }
    }
    // Bass: chord-relative, one or two octaves down.
    const b = sg.bass && sg.bass[s];
    if (m.bass && b && b !== '.') note(pitch(sg, root, Number(b), sg.key < 56 ? -1 : -2), t, sixteenth * 1.6, { wave: 'triangle', vol: 0.11 * m.bass, release: 0.04 });
    // Arpeggio: short plucks an octave up (patterns may hold two-digit steps like 11/12).
    if (m.arp && sg.arp) {
      const tokens = sg.arp.match(/\d+|\./g) || [], a = tokens[s % tokens.length];
      if (a && a !== '.') note(pitch(sg, root, Number(a), sg.low ? 0 : 1), t, sixteenth * 0.7, { wave: sg.lead && sg.lead.wave === 'triangle' ? 'triangle' : 'pulse', vol: 0.022 * m.arp, cutoff: 3000, release: 0.05 });
    }
    // Pad: the chord, held for the bar.
    const pad = m.pad || (sg.pad ? 0.6 : 0);
    if (pad && s === 0) for (const d of [0, 2, 4]) note(pitch(sg, root, d, 0), t, sixteenth * 15, { wave: 'triangle', vol: 0.018 * pad, cutoff: 1200, attack: 0.25, release: 0.4 });
    // Drums.
    if (m.drums) for (const part of ['kick', 'snare', 'hat', 'tom']) { const pat = sg.pat[part]; if (pat && pat[s] === 'x') DRUM[part](t, m.drums, sg); }
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
  // Start (or switch) the soundtrack: a new mood or world crossfades into its own song.
  function play(newMood, newTheme, audio) {
    newMood = ALIAS[newMood] || newMood;
    if (!newMood || !TEMPLATES[newMood]) return stop();
    if (!audio) return;
    const key = SONGS[newTheme] ? newTheme : 'medieval';
    if (song && theme === key && mood === newMood && bus) return;
    ac = audio.ctx; out = audio.master;
    stop(0.9);
    bus = ac.createGain(); bus.gain.setValueAtTime(0.0001, ac.currentTime); bus.gain.linearRampToValueAtTime(ducked ? level * 0.35 : level, ac.currentTime + 1.2); bus.connect(out);
    song = build(key, newMood); theme = key; mood = newMood; step = 0; nextAt = ac.currentTime + 0.15;
    timer = setInterval(tick, 25);
  }
  function duck(on) {
    ducked = on; if (!bus || !ac) return;
    const g = bus.gain, t = ac.currentTime; g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(on ? level * 0.35 : level, t + (on ? 0.25 : 0.9));
  }
  function volume(v) { level = Math.max(0, Math.min(1, v)); duck(ducked); }
  // Renders a song into another audio context (an OfflineAudioContext for tests and previews).
  function renderTo(ctx2, dest, key, moodName, seconds) {
    const saved = { ac, bus, song, mood, step };
    ac = ctx2; bus = ctx2.createGain(); bus.gain.value = level; bus.connect(dest);
    song = build(key, ALIAS[moodName] || moodName); pulseWave = null;
    const six = 60 / song.bpm / 4;
    for (let i = 0, t = 0.05; t < seconds; i++, t += six) playStep(i, t + (song.swing && i % 2 ? song.swing * six : 0), six);
    ({ ac, bus, song, mood, step } = saved); pulseWave = null;
  }
  return { play, stop, duck, volume, renderTo, SONGS, MOODS, get mood() { return mood; }, get theme() { return theme; }, get level() { return level; } };
})();
