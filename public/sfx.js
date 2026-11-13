// Tiny synthesized sound effects (no audio files needed).
window.SFX = (function () {
  let ctx = null;
  let master = null;
  let enabled = true, sfxLevel = 1, musicOut = null;

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.55 * sfxLevel;
      master.connect(ctx.destination);
      musicOut = ctx.createGain(); musicOut.gain.value = 0.55; musicOut.connect(ctx.destination); // the soundtrack has its own volume
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone(freq, dur, { type = 'sine', vol = 0.3, at = 0, slide = null } = {}) {
    const c = ensure();
    if (!c || !enabled) return;
    const t = c.currentTime + at;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.05);
  }

  function noise(dur, { vol = 0.3, at = 0, filter = 800, type = 'lowpass' } = {}) {
    const c = ensure();
    if (!c || !enabled) return;
    const t = c.currentTime + at;
    const len = Math.max(1, Math.floor(c.sampleRate * dur));
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource();
    src.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = type; f.frequency.value = filter;
    const g = c.createGain();
    g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t);
  }

  const sounds = {
    join: () => { tone(660, 0.12, { type: 'triangle', vol: 0.2 }); tone(990, 0.18, { type: 'triangle', vol: 0.2, at: 0.09 }); },
    start: () => [392, 523, 659, 784].forEach((f, i) => tone(f, 0.35, { type: 'triangle', vol: 0.2, at: i * 0.13 })),
    night: () => { tone(330, 2.0, { vol: 0.18, slide: 147 }); tone(247, 2.2, { vol: 0.14, at: 0.25, slide: 110 }); },
    day: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.45, { type: 'triangle', vol: 0.16, at: i * 0.12 })),
    knock: () => [0, 0.22, 0.44].forEach((a) => noise(0.09, { vol: 0.9, at: a, filter: 260 })),
    kill: () => { tone(900, 0.7, { type: 'sawtooth', vol: 0.12, slide: 90 }); noise(0.6, { vol: 0.35, filter: 1400 }); tone(70, 0.9, { vol: 0.4, at: 0.05 }); },
    saved: () => [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.35, { vol: 0.16, at: i * 0.08 })),
    tick: () => tone(1250, 0.05, { type: 'square', vol: 0.05 }),
    vote: () => tone(540 + Math.random() * 120, 0.08, { type: 'triangle', vol: 0.12 }),
    drum: () => { for (let i = 0; i < 14; i++) noise(0.05, { vol: 0.25 + i * 0.02, at: i * 0.065, filter: 220 }); tone(98, 0.8, { vol: 0.45, at: 0.95 }); },
    poof: () => noise(0.45, { vol: 0.25, filter: 2400, type: 'bandpass' }),
    boo: () => { tone(420, 0.7, { vol: 0.18, slide: 160 }); tone(430, 0.7, { vol: 0.12, slide: 170, at: 0.03 }); },
    wail: () => { tone(520, 1.3, { vol: 0.1, slide: 260 }); tone(530, 1.3, { vol: 0.08, slide: 250, at: 0.06 }); },
    win: () => [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, 0.4, { type: 'triangle', vol: 0.18, at: i * 0.15 })),
    lose: () => [392, 370, 349, 262].forEach((f, i) => tone(f, 0.7, { type: 'sawtooth', vol: 0.08, at: i * 0.3 })),
    // ---- role draft: a deck of cards ----
    shuffle: () => { for (let i = 0; i < 22; i++) noise(0.025, { vol: 0.18 + Math.random() * 0.12, at: i * 0.045, filter: 2600 + Math.random() * 1500, type: 'highpass' }); },
    deal: () => noise(0.12, { vol: 0.3, filter: 3200, type: 'bandpass' }),
    flip: () => { noise(0.06, { vol: 0.35, filter: 2800, type: 'highpass' }); tone(880, 0.25, { type: 'triangle', vol: 0.1, at: 0.05 }); tone(1320, 0.35, { type: 'triangle', vol: 0.08, at: 0.12 }); },
    // ---- cinematic sounds ----
    creak: () => { tone(180, 1.1, { type: 'sawtooth', vol: 0.05, slide: 120 }); tone(260, 0.9, { type: 'square', vol: 0.025, at: 0.15, slide: 210 }); noise(1.0, { vol: 0.06, filter: 600, type: 'bandpass' }); },
    click: () => { noise(0.03, { vol: 0.6, filter: 3500, type: 'highpass' }); noise(0.03, { vol: 0.5, at: 0.12, filter: 3000, type: 'highpass' }); },
    step: () => noise(0.05, { vol: 0.18, filter: 400 }),
    heartbeat: () => { tone(60, 0.16, { vol: 0.55 }); tone(55, 0.18, { vol: 0.45, at: 0.22 }); },
    sting: () => { tone(1480, 0.9, { type: 'sawtooth', vol: 0.07, slide: 1400 }); tone(1568, 0.9, { type: 'sawtooth', vol: 0.06, slide: 1500 }); tone(110, 1.0, { vol: 0.35, slide: 70 }); },
    gasp: () => noise(0.35, { vol: 0.25, filter: 1800, type: 'bandpass' }),
    thunder: () => { noise(1.8, { vol: 0.7, filter: 180 }); noise(0.3, { vol: 0.5, filter: 2000 }); },
    slash: () => { noise(0.18, { vol: 0.55, filter: 5000, type: 'highpass' }); tone(700, 0.18, { type: 'sawtooth', vol: 0.06, slide: 200 }); },
    hit: () => { tone(80, 0.35, { vol: 0.6, slide: 40 }); noise(0.2, { vol: 0.5, filter: 900 }); },
    zap: () => { tone(1800, 0.25, { type: 'square', vol: 0.08, slide: 300 }); noise(0.12, { vol: 0.2, filter: 4000, type: 'highpass' }); },
    shot: () => { noise(0.25, { vol: 0.9, filter: 2500 }); tone(90, 0.3, { vol: 0.5, slide: 40 }); },
    shatter: () => { for (let i = 0; i < 6; i++) tone(2400 + Math.random() * 2400, 0.25, { type: 'triangle', vol: 0.06, at: i * 0.03 }); noise(0.5, { vol: 0.35, filter: 5000, type: 'highpass' }); },
    whoosh: () => noise(0.5, { vol: 0.25, filter: 1200, type: 'bandpass' }),
    shield: () => { [523, 784, 1047, 1568].forEach((f, i) => tone(f, 0.6, { vol: 0.12, at: i * 0.05 })); tone(262, 1.2, { type: 'triangle', vol: 0.15 }); },
    fall: () => { noise(0.25, { vol: 0.5, filter: 300 }); tone(70, 0.4, { vol: 0.4, at: 0.05 }); },
    owl: () => { tone(420, 0.35, { vol: 0.12, slide: 380 }); tone(400, 0.5, { vol: 0.12, at: 0.45, slide: 350 }); },
    wind: () => noise(2.5, { vol: 0.12, filter: 500, type: 'bandpass' }),
    explosion: () => { noise(1.6, { vol:0.65, filter:700, type:'lowpass' }); tone(52,1.2,{ type:'sawtooth',vol:.25 }); },
    bell: () => [0, 1.1, 2.2].forEach((a) => { tone(196, 1.8, { type: 'triangle', vol: 0.18, at: a }); tone(392, 1.2, { vol: 0.06, at: a }); }),
    reveal: () => [262, 330, 392, 523].forEach((f, i) => tone(f, 0.9, { type: 'triangle', vol: 0.12, at: i * 0.06 })),
    shutter: () => { noise(0.04, { vol: 0.7, filter: 4000, type: 'highpass' }); noise(0.06, { vol: 0.5, at: 0.07, filter: 2500, type: 'highpass' }); },
    glitch: () => { for (let i = 0; i < 8; i++) tone(200 + Math.random() * 1800, 0.05, { type: 'square', vol: 0.06, at: i * 0.04 }); },
    // ---- Themes v2: each world's weapons and deaths ----
    vaporize: () => { tone(300, 0.5, { type: 'sawtooth', vol: 0.08, slide: 2400 }); tone(1800, 0.35, { type: 'square', vol: 0.05, at: 0.05, slide: 200 }); noise(0.5, { vol: 0.2, at: 0.1, filter: 6000, type: 'highpass' }); },
    petrify: () => { [1568, 1319, 1047, 784].forEach((f, i) => tone(f, 0.3, { type: 'sine', vol: 0.08, at: i * 0.05 })); noise(0.7, { vol: 0.3, at: 0.25, filter: 300 }); tone(70, 0.6, { vol: 0.3, at: 0.25 }); },
    fireBreath: () => { noise(0.9, { vol: 0.5, filter: 900 }); noise(0.6, { vol: 0.3, at: 0.1, filter: 2400, type: 'bandpass' }); tone(90, 0.8, { type: 'sawtooth', vol: 0.08, slide: 60 }); },
    roar: () => { tone(120, 1.1, { type: 'sawtooth', vol: 0.16, slide: 60 }); tone(127, 1.1, { type: 'sawtooth', vol: 0.12, slide: 64 }); noise(1.0, { vol: 0.3, filter: 500 }); },
    venom: () => { noise(0.7, { vol: 0.3, filter: 5000, type: 'highpass' }); for (let i = 0; i < 4; i++) tone(500 + i * 90, 0.08, { vol: 0.06, at: 0.2 + i * 0.12, slide: 900 }); },
    suppressed: () => { noise(0.08, { vol: 0.6, filter: 1400, type: 'bandpass' }); tone(220, 0.08, { vol: 0.15, slide: 90 }); },
    laserBeep: () => tone(2200, 0.18, { type: 'square', vol: 0.04 }),
    revolver: () => { noise(0.3, { vol: 1.0, filter: 2200 }); tone(80, 0.4, { vol: 0.6, slide: 35 }); noise(0.9, { vol: 0.18, at: 0.25, filter: 700 }); }, // with an echo down the street
    siren: () => { for (let i = 0; i < 4; i++) tone(i % 2 ? 660 : 880, 0.4, { type: 'triangle', vol: 0.05, at: 0.6 + i * 0.4 }); },
    freeze: () => { for (let i = 0; i < 7; i++) tone(2600 + Math.random() * 2600, 0.2, { type: 'triangle', vol: 0.05, at: i * 0.03 }); noise(0.4, { vol: 0.35, filter: 4000, type: 'highpass' }); tone(1200, 0.5, { vol: 0.04, at: 0.1, slide: 3000 }); },
    crunch: () => { for (let i = 0; i < 5; i++) tone(180 - i * 20, 0.06, { type: 'square', vol: 0.12, at: i * 0.05 }); noise(0.25, { vol: 0.25, filter: 1200 }); [784, 523].forEach((f, i) => tone(f, 0.12, { type: 'square', vol: 0.05, at: 0.3 + i * 0.1 })); },
    arrow: () => { noise(0.25, { vol: 0.25, filter: 3000, type: 'bandpass' }); tone(140, 0.12, { vol: 0.4, at: 0.22, slide: 70 }); },
    diceRoll: () => { for (let i = 0; i < 9; i++) noise(0.03, { vol: 0.35 - i * 0.03, at: i * 0.07 + Math.random() * 0.02, filter: 3200, type: 'bandpass' }); [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.3, { type: 'triangle', vol: 0.1, at: 0.7 + i * 0.08 })); },
    // Big moments: a cinematic low hit, and a rising swell.
    rooster: () => { tone(620, 0.12, { type: 'sawtooth', vol: 0.05, slide: 900 }); tone(900, 0.5, { type: 'sawtooth', vol: 0.05, at: 0.14, slide: 700 }); tone(700, 0.35, { type: 'sawtooth', vol: 0.04, at: 0.62, slide: 420 }); },
    boom: () => { tone(55, 1.6, { vol: 0.55, slide: 32 }); noise(1.2, { vol: 0.4, filter: 160 }); tone(110, 0.9, { type: 'triangle', vol: 0.12, slide: 70 }); },
    swell: () => { [262, 330, 392, 523, 659].forEach((f, i) => tone(f, 2.2 - i * 0.2, { type: 'triangle', vol: 0.07, at: i * 0.12 })); noise(1.5, { vol: 0.08, filter: 3000, type: 'bandpass' }); },
    stab: () => { noise(0.12, { vol: 0.35, filter: 900 }); tone(110, 0.3, { vol: 0.35, at: 0.04, slide: 50 }); },
    // Phase and moment cues.
    chime: () => [659, 784, 988].forEach((f, i) => tone(f, 1.1, { type: 'sine', vol: 0.09, at: i * 0.18 })), // dawn
    gavel: () => [0, 0.32].forEach((a) => { noise(0.07, { vol: 0.8, at: a, filter: 1100, type: 'bandpass' }); tone(170, 0.12, { vol: 0.35, at: a, slide: 110 }); }), // voting opens
    talk: () => { tone(523, 0.14, { type: 'triangle', vol: 0.12 }); tone(659, 0.2, { type: 'triangle', vol: 0.12, at: 0.12 }); }, // discussion opens
    ballot: () => { noise(0.05, { vol: 0.35, filter: 2600, type: 'bandpass' }); tone(880, 0.06, { type: 'triangle', vol: 0.07, at: 0.03 }); }, // a vote is cast
    shrug: () => { tone(392, 0.25, { type: 'triangle', vol: 0.12, slide: 330 }); tone(330, 0.35, { type: 'triangle', vol: 0.12, at: 0.25, slide: 262 }); }, // a tie / no one out
    laugh: () => [0, 0.16, 0.32, 0.48, 0.64].forEach((a, i) => tone(740 - i * 40, 0.12, { type: 'square', vol: 0.06, at: a, slide: 900 - i * 40 })), // the Jester
    cheer: () => { noise(1.6, { vol: 0.22, filter: 1600, type: 'bandpass' }); [0.1, 0.35, 0.6, 0.9].forEach((a) => noise(0.08, { vol: 0.3, at: a, filter: 3000, type: 'highpass' })); }, // a crowd and claps
    pop: () => tone(900 + Math.random() * 300, 0.07, { type: 'sine', vol: 0.07, slide: 1500 }), // a phone reaction
    spirit: () => { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.9, { type: 'sine', vol: 0.05, at: i * 0.07 })); noise(1.2, { vol: 0.06, filter: 4000, type: 'highpass' }); }, // a farewell: the soul rises
  };

  // ---- looping music beds (synthesized pads) ----
  const MOODS = {
    tension: { notes: [0, 1, 7], type: 'sawtooth', vol: 0.05, pulse: 1.6, cutoff: 500 },
    ominous: { notes: [0, 3, 6], type: 'triangle', vol: 0.07, pulse: 0, cutoff: 700 },
    peace: { notes: [0, 4, 7, 11], type: 'sine', vol: 0.05, pulse: 0, cutoff: 1800 },
    eerie: { notes: [0, 6, 13], type: 'sine', vol: 0.05, pulse: 0, cutoff: 1400, wobble: 6 },
    triumph: { notes: [0, 4, 7, 12], type: 'triangle', vol: 0.06, pulse: 0, cutoff: 2400 },
  };
  let bed = null;
  function stopBed(fade = 1.2) {
    if (!bed || !ctx) return;
    const b = bed; bed = null;
    const t = ctx.currentTime;
    b.gain.gain.cancelScheduledValues(t);
    b.gain.gain.setValueAtTime(b.gain.gain.value, t);
    b.gain.gain.linearRampToValueAtTime(0.0001, t + fade);
    setTimeout(() => { b.nodes.forEach((n) => { try { n.stop(); } catch (e) { /* ignore */ } }); b.gain.disconnect(); }, fade * 1000 + 100);
  }
  function music(mood, root = 110, theme = 'smalltown') {
    const c = ensure();
    if (bed && bed.mood === mood && bed.root === root && bed.theme === theme) return;
    stopBed();
    if (!c || !MOODS[mood] || !enabled) return;
    const kits = { snow: { type: 'sine', cutoff: 3000, wobble: 1 }, blocky: { type: 'square', cutoff: 1300 }, tabletop: { type: 'triangle', cutoff: 1600 }, realistic: { type: 'sine', cutoff: 1500 }, noir: { type: 'triangle', cutoff: 900, wobble: 3, pulse: 0.5 }, medieval: { type: 'triangle', cutoff: 1100 }, space: { type: 'sine', wobble: 4, cutoff: 2200 }, fantasy: { type: 'sine', wobble: 2, cutoff: 2600 }, dragons: { type: 'sawtooth', cutoff: 450 }, dungeon: { type: 'triangle', cutoff: 400 }, spies: { type: 'triangle', pulse: 1.2 }, fbi: { type: 'sine', pulse: 0.8 } };
    const m = { ...MOODS[mood], ...(kits[theme] || {}) };
    const gain = c.createGain();
    const filt = c.createBiquadFilter();
    filt.type = 'lowpass'; filt.frequency.value = m.cutoff;
    gain.gain.setValueAtTime(0.0001, c.currentTime);
    gain.gain.linearRampToValueAtTime(m.vol, c.currentTime + 2);
    filt.connect(gain); gain.connect(master);
    const nodes = [];
    m.notes.forEach((semi, i) => {
      for (const det of [-6, 6]) {
        const o = c.createOscillator();
        o.type = m.type;
        o.frequency.value = root * Math.pow(2, semi / 12);
        o.detune.value = det + (m.wobble ? 0 : 0);
        if (m.wobble) {
          const l = c.createOscillator(); const lg = c.createGain();
          l.frequency.value = 0.2 + i * 0.07; lg.gain.value = m.wobble * 4;
          l.connect(lg); lg.connect(o.detune); l.start(); nodes.push(l);
        }
        o.connect(filt); o.start(); nodes.push(o);
      }
    });
    if (m.pulse) { // slow throb
      const l = c.createOscillator(); const lg = c.createGain();
      l.frequency.value = m.pulse; lg.gain.value = m.vol * 0.6;
      l.connect(lg); lg.connect(gain.gain); l.start(); nodes.push(l);
    }
    bed = { mood, root, theme, gain, nodes, vol: m.vol };
  }

  // The soundtrack lives in music.js (one song per world); the old pads are the fallback.
  let musicOn = true;
  const M = () => window.MT_MUSIC;
  return {
    play(name) { try { if (sounds[name]) sounds[name](); } catch (e) { /* ignore */ } },
    unlock: ensure,
    music(mood, root, theme) {
      try {
        if (!M()) { if (mood) music(mood, root, theme); else stopBed(); return; }
        if (!mood || !enabled || !musicOn) { M().stop(); return; }
        const c = ensure(); if (c) M().play(mood, theme, { ctx: c, master: musicOut });
      } catch (e) { /* ignore */ }
    },
    // Duck the music under the narrator's voice (and bring it back after).
    duck(on) { try { if (M()) { M().duck(on); return; } if (!bed || !ctx) return; const g = bed.gain.gain, t = ctx.currentTime; g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(on ? bed.vol * 0.3 : bed.vol, t + (on ? 0.25 : 0.8)); } catch (e) { /* ignore */ } },
    get mood() { return M() ? M().mood : bed ? bed.mood : null; },
    get enabled() { return enabled; },
    set enabled(v) { enabled = !!v; if (!enabled) { stopBed(0.2); if (M()) M().stop(0.2); } },
    // Volumes, 0 to 1: sound effects here, the soundtrack in music.js.
    setVolume(v) { sfxLevel = Math.max(0, Math.min(1, v)); if (master) master.gain.value = 0.55 * sfxLevel; },
    setMusicVolume(v) { if (M()) M().volume(Math.max(0, Math.min(1, v))); },
    get musicOn() { return musicOn; },
    set musicOn(v) { musicOn = !!v; if (!musicOn && M()) M().stop(0.3); },
  };
})();
