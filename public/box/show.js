'use strict';
/* =====================================================================================
   JustGameBox INTRO ENGINE: the TV cutscene before a game (box/show.js runs the clock).
   =====================================================================================

   tv.js calls BOX.showIntro(el, show, ctx) on every state update while the room is in
   phase 'show' (same `el` each time; it is a fixed full-screen div). The engine builds its
   canvas once, keeps its own clock (show.stepAgo + time since the state arrived), and
   starts drawing on the very first call: if the game's intro file has not loaded yet it
   uses the built-in generic intro and swaps over as soon as the file arrives. Fonts or
   speech that are not ready never block it.

   SHOW MODES (state.show.mode)
     'facts'  step 'facts': opening shots, then the host chats while phones write a fun fact
              (engine: waiting panel + banter + audience cutaways);
              step 'intros': one reveal per featured contestant (perMs each), then the outro.
     'cast'   step 'intros' only: opening shots (openMs), a quick roll call of `featured`
              (perMs each, "…and N more!"; rollMs in all), the outro (outroMs).
   NARRATION TIMING: the server sizes every narrated stretch to its voice clip (box/narration.js):
     show.openShots = each opening shot's ms (a shot with `say` lasts sayAt + the clip + a margin;
     `fit` is no longer used: lines are never sped up), rollMs / moreAt, outroMs, slots (facts-mode
     reveals), wallMs; the how-to gets howStepsMs. Lines queue (public/box/voice.js), so nothing is
     cut off mid-word; the host's Skip cuts the voice (fx 'voiceCut', public/box/tv.js).

   WRITING AN INTRO  ->  public/box/intros/<gameKey>.js  (loaded on demand by the engine)

     BOX.intros.<key> = {
       title: 'Shown name',                       // optional, defaults to the game's name
       theme: { accent, accent2, accent3,        // colours used by the engine's overlays,
                ink, panel, fade,                // contestant cards and confetti
                confetti: ['#hex', ...] },
       host: {                                   // or null for no host / narrator only
         name: 'Sterling Sparks',                // subtitle speaker tag
         voice: { kokoro: 'am_puck', cb: 'hype', speed: 1.05,  // Kokoro voice identity + delivery preset (cb: hype|warm|calm|dry|spooky, tools/voice-gen.js) for the pre-rendered
                  like: /guy|male/i, accent: /en-US/i, pitch: 1.1, rate: 1.1 }, // clips (npm run voices; public/box/voice.js); the rest picks the browser fallback voice
         look: { ... },                          // a BOX.studio.makeHost spec (see below) OR
         draw(g, a) { ... },                     // your own drawing; a = see HOST ANIM below
       },
       lines: {                                  // strings; {name} {n} {title} are filled in
         welcome, joke, meet, banter: [..],      // facts mode
         first, intros: [..], last, noFact,      // contestant reveals (facts mode)
         roll, more, others, play,               // roll call / outro
       },
       stage(g, s, o) {},                        // the set in a 1920x1080 world. o = {
                                                 //  host: false -> leave the host out,
                                                 //  bare: leave out foreground props (the
                                                 //  engine draws its own podiums there),
                                                 //  lights 0..1 (house lights), spots 0..1,
                                                 //  logo 0..1 (0 = none), game: in-game set}
                                                 // Draw the host with s.hostAt(x, y, scale).
       podium(g, s, x, y, sc) {},                // optional host podium (default s.podium)
       podiumGlyph: '$',                        // glyph on the default podium
       hostCam: { x, y, z },                     // medium shot of the host (banter)
       logo(g, s, lit) {},                       // the show logo centred on (0,0), ~700x260
       opening: [                                // the opening shots, in order
         { ms: 4800, draw(g, s) {},              //   s.T ms into the shot, s.k 0..1
           say: 'welcome', sayAt: 300,           //   a line from `lines` (optional; the shot is stretched to fit it)
           sfx: [[150, 'swell']],                //   BOX.sfx cues [msIntoShot, name]
           pose: [[0, 'wave', 2400]],            //   host pose cues [ms, pose, holdMs]
           crowd: [[500, 'cheer', 3000]] },      //   crowd mood cues [ms, mood, holdMs]
       ],
       castOpening: [ ... ],                     // optional: used in 'cast' mode instead
       roll(g, s, featured, u, per, o) {},       // optional: draw your own cast roll call
                                                 //  (o = { more, title, theme }; u = ms into it)
       cutaway(g, s) {},                         // optional: the audience cutaway shot
     };
   Every function is optional except stage; anything missing falls back to the engine.

   DRAW CONTEXT `s` (the engine resets the transform to the 1920x1080 world before
   each draw call and restores it after; drawing is in that virtual world, cover-fitted):
     s.t seconds (global clock), s.now ms, s.T ms into the shot, s.k progress 0..1,
     s.show the show state, s.intro, s.theme, s.mode, s.crowd (current crowd mood)
     s.cam(cx, cy, z)          aim the camera: world point (cx,cy) at screen centre, zoom z
     s.host(x, y, scale)       draw the host (waist / podium top at x,y; ~420 units tall)
     s.hostAt(x, y, scale)     the host behind his podium (intro.podium or the default)
     s.podium(x, y, scale, glyph)  a generic host podium in theme colours
     s.audience(panX, mood)    the engine's live studio audience, full frame (pan 0..1)
     s.backs(x, y, w, h, mood) foreground audience silhouettes (backs of heads)
     s.spots(k, speed)         sweeping spotlights; s.sign(x,y,w,h,text,on,'r,g,b')
     s.face(c, x, y, px, o)    a player's character head (centred, sized like an emoji of px), emoji fallback
     s.body(c, x, y, h, o)     a player's animated full figure, feet at (x,y), ~h tall (o: BOX.drawChar opts)
     s.emoji(e, x, y, px)      cached emoji; s.text(str, x, y, px, fill, {font,align,stroke,max})
     s.rr(x,y,w,h,r)           rounded-rect path; s.ease/s.ss/s.back/s.clamp/s.lerp
   HOST ANIM (`a` passed to host.draw): { t, now, talk (bool), mouth 0..1, blink 0..1,
     look -1..1, pose ('rest'|'talk'|'wave'|'point'|'pointL'|'cheer'|'shrug'|'gavel'),
     hands: { l:[x,y], r:[x,y] } (smoothed targets in host units), ik(sx,sy,tx,ty,a,b,side) }

   BOX.studio (shared kit, also used by the in-game studio frames of Price Panic / JustBid):
     intro(key) -> the intro (loads it if needed), need(key, cb), makeHost(look),
     HostAnim, Confetti, say(text, voice, fitMs), stop(), frame(el, key) -> in-game studio
     frame ({ content, react({line, mood, pose, confetti, prio}), attach() }),
     lobby(el, lobby, opts) -> a game's own lobby on its animated set (see the comment above it).
   makeHost look spec: { skin, skinShade, suit, suit2, sleeve, lapel, shirt, cuff,
     tie: 'bow'|'bolo'|'long'|'none', tieColor, hair: 'pomp'|'short'|'curly'|'bald'|'bun', hairShade, streak,
     hairColor, brow, hat (colour, cowboy hat), mustache (colour), glasses, prop: 'mic'|
     'gavel'|'headset'|'cards'|null, grin (bool), sparkle (colour: sequins) }
   ===================================================================================== */
(function () {
  if (!window.BOX) return;
  const B = window.BOX, esc = B.esc;
  const TAU = Math.PI * 2;
  const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const ss = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
  const ease = (t) => { t = clamp(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
  const easeOut = (t) => 1 - Math.pow(1 - clamp(t), 3);
  const back = (t) => { t = clamp(t); const c = 2.2; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
  const rng = (seed) => { let s = (seed >>> 0) || 1; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; };
  const hash = (str) => { let h = 2166136261; for (const c of String(str)) h = Math.imul(h ^ c.codePointAt(0), 16777619); return h >>> 0; };
  const pick = (r, a) => a[Math.floor(r() * a.length) % a.length];
  const FONT = '"Lilita One", "Fredoka", system-ui, sans-serif';
  const BODY = '"Fredoka", system-ui, sans-serif';
  const EMOJI = '"Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';
  const OUT = '#1a0b2a';
  const sfx = (n) => { try { B.sfx(n); } catch { /* no audio */ } };
  try { if (document.fonts) { document.fonts.load('40px "Lilita One"'); document.fonts.load('600 40px "Fredoka"'); } } catch { /* fine */ }

  function rr(g, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }
  const shade = (hex, k) => { // k<0 darker, k>0 lighter
    const n = parseInt(String(hex).slice(1), 16); if (!Number.isFinite(n)) return hex;
    const f = (c) => Math.round(k < 0 ? c * (1 + k) : c + (255 - c) * k);
    return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
  };

  // ---------- cached emoji bitmaps ----------
  const emojiCache = new Map();
  function emojiImg(e, px) {
    px = Math.max(8, Math.round(px / 8) * 8);
    const k = e + '|' + px; let c = emojiCache.get(k);
    if (!c) {
      c = document.createElement('canvas'); c.width = c.height = Math.ceil(px * 1.3);
      const x = c.getContext('2d'); x.font = `${px}px ${EMOJI}`; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText(e || '🙂', c.width / 2, c.height / 2 + px * 0.06);
      if (emojiCache.size > 120) emojiCache.clear();
      emojiCache.set(k, c);
    }
    return c;
  }
  function drawEmoji(g, e, x, y, px) { const c = emojiImg(e, Math.min(px, 320)); const s = px * 1.3; g.drawImage(c, x - s / 2, y - s / 2, s, s); }
  // ---------- the contestants' own characters (portrait.js), the emoji as the fallback ----------
  // drawFace: a head-and-shoulders picture centred at (x, y) where an emoji of size px would sit
  // (the picture is a little bigger: it has a transparent margin). Cached Images from BOX.faceUrl.
  // drawBody: the animated full figure (BOX.drawChar), FEET at (x, y), about h tall (with the hat).
  // Both return true when they drew the character, false when they drew the emoji instead.
  const picCache = new Map();
  function picImg(url) {
    if (!url) return null;
    let im = picCache.get(url);
    if (!im) { im = new Image(); im.src = url; if (picCache.size > 160) picCache.clear(); picCache.set(url, im); }
    return im.complete && im.naturalWidth ? im : null;
  }
  const picSize = (n) => Math.max(32, Math.min(640, Math.ceil(n / 32) * 32));
  function drawFace(g, c, x, y, px, o) {
    const sz = px * 1.45; let im = null;
    try { if (c && B.faceUrl) im = picImg(B.faceUrl(c, picSize(sz), o || {})); } catch { im = null; }
    if (im) { g.drawImage(im, x - sz / 2, y - sz / 2, sz, sz); return true; }
    drawEmoji(g, (c && c.avatar) || '🙂', x, y, px); return false;
  }
  function drawBody(g, c, x, y, h, o = {}) {
    try { if (c && B.drawChar && B.drawChar(g, x, y, c, { t: performance.now() / 1000, seed: hash(c.id || c.name || '') % 7, ...o, scale: h / 85 })) return true; } catch { /* the emoji below */ }
    drawEmoji(g, (c && c.avatar) || '🙂', x, y - h * 0.42, h * 0.5); return false;
  }
  function fitFont(g, str, px, max, font) { let p = px; g.font = `${p}px ${font}`; while (max && p > 10 && g.measureText(str).width > max) { p -= 2; g.font = `${p}px ${font}`; } return p; }
  function text(g, str, x, y, px, fill, o = {}) {
    const font = o.font || FONT; fitFont(g, String(str), px, o.max, font);
    g.textAlign = o.align || 'center'; g.textBaseline = o.base || 'middle';
    if (o.stroke) { g.lineJoin = 'round'; g.lineWidth = o.lw || px * 0.16; g.strokeStyle = o.stroke; g.strokeText(str, x, y); }
    g.fillStyle = fill; g.fillText(str, x, y);
  }
  function wrap(g, str, max, lines) {
    const words = String(str).split(/\s+/), out = []; let cur = '';
    for (const w of words) { const t = cur ? cur + ' ' + w : w; if (g.measureText(t).width > max && cur) { out.push(cur); cur = w; } else cur = t; }
    if (cur) out.push(cur);
    if (out.length > lines) { out.length = lines; out[lines - 1] = out[lines - 1].replace(/\s*\S*$/, '') + '…'; }
    return out;
  }

  // ---------- speech: one line at a time, a new line cancels the stale one ----------
  // The host's voice goes through BOX.voice.speak(text, spec) -> Promise (resolves when the line
  // has been spoken). spec = the intro's host.voice { like, accent, gender ('f'|'m'), lang, pitch,
  // rate }. The default uses the browser's speechSynthesis with the best matching voice (neural /
  // "Natural" / "Online" / Google / Premium / Enhanced voices first, then accent and gender). A
  // better voice engine plugs in by replacing BOX.voice.speak (and .stop): public/box/voice.js does,
  // with pre-rendered Kokoro clips (spec.kokoro / spec.speed pick the Kokoro voice; see that file).
  // The music is ducked while any line plays, whichever engine speaks it.
  const Speech = (function () {
    let voices = [], cache = new Map(), keep = null, token = 0, safety = 0;
    const has = () => { try { return !!window.speechSynthesis && typeof window.SpeechSynthesisUtterance === 'function'; } catch { return false; } };
    const load = () => { try { voices = speechSynthesis.getVoices().filter((v) => /^en/i.test(v.lang)); cache = new Map(); } catch { voices = []; } };
    if (has()) { load(); try { speechSynthesis.addEventListener('voiceschanged', load); } catch { /* old browser */ } }
    const FEMALE = /female|woman|zira|aria|jenny|\bava\b|emma|michelle|\bana\b|sara|nancy|jane|hazel|libby|sonia|susan|samantha|karen|moira|tessa|fiona|victoria|allison|serena|catherine|natasha|clara|emily|elizabeth|maisie|olivia|amber|ashley|cora|monica|joanna|kendra|kimberly|salli|\bivy\b|\bamy\b|\bmia\b|isabella|heather|linda|kate|ruth/i;
    const MALE = /\bmale\b|\bman\b|\bguy\b|davis|george|ryan|eric|christopher|andrew|brian|daniel|thomas|\balex\b|\bfred\b|\btom\b|oliver|william|roger|steffan|jason|tony|liam|\bmark\b|david|james|matthew|joey|justin|kevin|russell|arthur|aaron|gordon|\blee\b/i;
    const genderOf = (n) => (FEMALE.test(n) ? 'f' : MALE.test(n) ? 'm' : null);
    const wants = (V) => V.gender || (V.like ? (/female|zira|aria|jenny|samantha|emma|ava|hazel|libby|sonia|susan/i.test(V.like.source) ? 'f' : /male|guy|davis|george|ryan|eric|christopher|andrew|brian|daniel/i.test(V.like.source) ? 'm' : null) : null);
    function rate(v, V) {
      const n = v.name; let s = 0;
      if (/natural|neural/i.test(n)) s += 60; else if (/online|premium|enhanced/i.test(n)) s += 45; else if (/google/i.test(n)) s += 30;
      if (V.accent && V.accent.test(v.lang)) s += 25; else if (/^en[-_]US/i.test(v.lang)) s += 6;
      const g = wants(V), vg = genderOf(n);
      if (g) s += vg ? (vg === g ? 40 : -60) : -5;
      if (V.like && V.like.test(n) && (!g || vg === g)) s += 20;
      return s;
    }
    function voiceFor(V) {
      if (!voices.length) load();
      if (cache.has(V)) return cache.get(V);
      const v = voices.slice().sort((a, b) => rate(b, V) - rate(a, V))[0] || null;
      if (voices.length) cache.set(V, v);
      return v;
    }
    function speak(text, V = {}) {
      return new Promise((resolve) => {
        if (!has()) return resolve();
        try {
          const S = window.speechSynthesis;
          if (S.speaking || S.pending) S.cancel();
          const u = new SpeechSynthesisUtterance(text);
          const v = voiceFor(V); if (v) { u.voice = v; u.lang = v.lang; } else u.lang = V.lang || 'en-US';
          u.rate = clamp(V.rate || 1, 0.5, 2); u.pitch = clamp(V.pitch || 1, 0, 2); u.volume = 1;
          keep = u; u.onend = u.onerror = () => { if (keep === u) keep = null; resolve(); };
          S.speak(u);
        } catch { resolve(); }
      });
    }
    function cancel() { try { if (has()) window.speechSynthesis.cancel(); } catch { /* none */ } keep = null; }
    const duck = (on) => { try { if (B.audio) B.audio.duck(on); } catch { /* no music */ } };
    B.voice = B.voice || {};
    if (!B.voice.speak) B.voice.speak = speak;
    if (!B.voice.stop) B.voice.stop = cancel;
    B.voice.pick = voiceFor; B.voice.voices = () => voices.slice();
    const clean = (s) => String(s || '').replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}\u{20E3}]/gu, '').replace(/["“”]/g, '').replace(/\s+/g, ' ').trim();
    // Returns how long the line takes (ms, estimated), so the mouth and subtitles keep going even with no voice.
    // The line is never sped up to fit (fitMs is ignored: the server times the scenes to the voice
    // clips, box/narration.js); with public/box/voice.js loaded it queues behind a line still playing.
    // o: speak options for voice.js ({ maxWait, key, onstart }).
    function say(str, V, fitMs, o) {
      V = V || { pitch: 1, rate: 1 };
      // o.speak: what the voice says when it differs from the subtitle (a name line's name-free lead).
      const t = clean((o && o.speak) || str); if (!t) return 0;
      const r = V.rate || 1;
      let est = (t.length * 70 + 500) / r;
      try { const ms = B.voice.clipMs && B.voice.clipMs(t, V); if (ms) est = ms; } catch { /* estimate */ }
      if (window.SFX && window.SFX.enabled === false) return est;
      if (B.voice.engine === 'kokoro') { try { B.voice.speak(t, V, o || {}); } catch { /* subtitles only */ } return est; } // it ducks the music itself
      const tok = ++token;
      duck(true); clearTimeout(safety);
      safety = setTimeout(() => { if (tok === token) duck(false); }, est + 2500);
      let p = null; try { p = B.voice.speak(t, V); } catch { /* subtitles only */ }
      Promise.resolve(p).catch(() => {}).then(() => setTimeout(() => { if (tok === token) { clearTimeout(safety); duck(false); } }, 300));
      return est;
    }
    function stop() { token++; clearTimeout(safety); try { B.voice.stop(); } catch { /* none */ } duck(false); }
    return { say, stop, clean };
  })();

  // ---------- host animation state + a configurable cartoon host ----------
  function ik(sx, sy, tx, ty, a, b, side) {
    let dx = tx - sx, dy = ty - sy, d = Math.hypot(dx, dy) || 1;
    const maxd = a + b - 0.5;
    if (d > maxd) { tx = sx + (dx / d) * maxd; ty = sy + (dy / d) * maxd; dx = tx - sx; dy = ty - sy; d = maxd; }
    d = Math.max(d, Math.abs(a - b) + 1);
    const th = Math.atan2(dy, dx), al = Math.acos(clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1));
    const e1 = [sx + Math.cos(th + al) * a, sy + Math.sin(th + al) * a], e2 = [sx + Math.cos(th - al) * a, sy + Math.sin(th - al) * a];
    return [(e1[0] - e2[0]) * side > 0 ? e1 : e2, [tx, ty]];
  }
  class HostAnim {
    constructor(host) { this.host = host; this.talkUntil = 0; this.pose = 'rest'; this.poseUntil = 0; this.seed = hash(host && host.name) % 997; this.last = 0; this.hands = null; }
    talk(now, ms) { this.talkUntil = now + Math.max(600, ms); }
    setPose(p, ms, now = performance.now()) { this.pose = p; this.poseUntil = now + (ms || 1600); }
    targets(now, talk) {
      const t = now / 1000, look = (this.host && this.host.look) || {};
      let pose = now < this.poseUntil ? this.pose : talk ? 'talk' : 'rest', r = [72, -12], l = [-72, -12];
      if (pose === 'wave') r = [150 + Math.sin(t * 10) * 30, -340];
      else if (pose === 'cheer') { r = [128 + Math.sin(t * 8) * 12, -385]; l = [-128 - Math.sin(t * 8 + 1) * 12, -385]; }
      else if (pose === 'point') r = [240, -220];
      else if (pose === 'pointL') l = [-240, -220];
      else if (pose === 'shrug') { r = [165, -150]; l = [-165, -150]; }
      else if (pose === 'gavel') r = (t * 3) % 1 < 0.55 ? [125, -300] : [100, -18];
      else if (pose === 'talk') { const k = Math.floor(t * 1.7 + this.seed) % 4; if (k === 0) r = [128, -128]; else if (k === 1) r = [100, -178]; else if (k === 2) l = [-128, -135]; else { r = [120, -150]; l = [-110, -150]; } }
      if (look.prop === 'mic' && pose !== 'cheer' && pose !== 'pointL') l = talk ? [-64, -186] : [-66, -150];
      return { l, r, pose };
    }
    // The animation snapshot a host's draw() gets.
    frame(now) {
      const dt = this.last ? Math.min(0.05, (now - this.last) / 1000) : 0.016; this.last = now;
      const talk = now < this.talkUntil, t = now / 1000, tg = this.targets(now, talk), k = 1 - Math.exp(-dt * 11);
      if (!this.hands) this.hands = { l: tg.l.slice(), r: tg.r.slice() };
      for (const s of ['l', 'r']) { this.hands[s][0] += (tg[s][0] - this.hands[s][0]) * k; this.hands[s][1] += (tg[s][1] - this.hands[s][1]) * k; }
      return {
        t, now, talk, pose: tg.pose, hands: this.hands, ik, seed: this.seed,
        mouth: talk ? 0.2 + 0.8 * Math.abs(Math.sin(t * 12.5) * Math.sin(t * 4.3 + 0.7)) : 0,
        blink: ((t * 1000 + this.seed * 7) % 3900) < 120 ? 0.12 : 1, look: Math.sin(t * 0.7 + this.seed),
      };
    }
  }

  function makeHost(L) {
    // Sequins on the jacket: fixed spots, twinkling.
    const r = rng(hash(JSON.stringify(L)));
    const spark = L.sparkle ? Array.from({ length: 34 }, () => { const y = -190 + r() * 180, w = 90 - (y + 190) * 0.05; let x = (r() * 2 - 1) * w; if (Math.abs(x) < 34 && y < -100) x += x < 0 ? -34 : 34; return [x, y, r() * TAU]; }) : [];
    const curls = Array.from({ length: 15 }, (_, i) => { const a = Math.PI * (1.05 + (i / 14) * 0.9); return [Math.cos(a) * 64, -292 + Math.sin(a) * 70, 22 + (i % 3) * 4]; });
    const outline = (g, w = 5) => { g.lineWidth = w; g.strokeStyle = OUT; g.stroke(); };
    function arm(g, side, hand, a) {
      const sx = 88 * side, sy = -186, [e, h] = ik(sx, sy, hand[0], hand[1], 92, 88, side);
      g.lineCap = 'round'; g.lineJoin = 'round';
      g.beginPath(); g.moveTo(sx, sy); g.lineTo(e[0], e[1]); g.lineTo(h[0], h[1]);
      g.strokeStyle = OUT; g.lineWidth = 44; g.stroke(); g.strokeStyle = L.sleeve || L.suit; g.lineWidth = 35; g.stroke();
      const dx = h[0] - e[0], dy = h[1] - e[1], d = Math.hypot(dx, dy) || 1;
      g.lineCap = 'butt'; g.strokeStyle = L.cuff || '#fffdf7'; g.lineWidth = 33; g.beginPath(); g.moveTo(h[0] - (dx / d) * 18, h[1] - (dy / d) * 18); g.lineTo(h[0] - (dx / d) * 8, h[1] - (dy / d) * 8); g.stroke();
      g.fillStyle = L.skin; g.beginPath(); g.arc(h[0], h[1], 18, 0, TAU); g.fill(); outline(g, 4);
      return { e, h, ang: Math.atan2(dy, dx) };
    }
    function hair(g, front) {
      const c = L.hairColor || '#3a2214';
      if (L.hair === 'curly' && !front) { g.fillStyle = c; for (const [x, y, rad] of curls) { g.beginPath(); g.arc(x, y + 10, rad + 6, 0, TAU); g.fill(); } g.beginPath(); g.arc(0, -330, 60, 0, TAU); g.fill(); }
      if (L.hair === 'bun' && !front) { g.fillStyle = c; g.beginPath(); g.arc(0, -372, 30, 0, TAU); g.fill(); outline(g, 4); }
      if (!front) return;
      g.fillStyle = c;
      if (L.hair === 'pomp') {
        g.beginPath(); g.moveTo(-60, -290); g.bezierCurveTo(-72, -352, -50, -376, -18, -382); g.bezierCurveTo(14, -414, 76, -408, 76, -368);
        g.bezierCurveTo(78, -340, 66, -316, 60, -290); g.bezierCurveTo(50, -318, 32, -332, 12, -324); g.bezierCurveTo(-12, -340, -42, -328, -60, -290); g.closePath(); g.fill(); outline(g, 5);
        g.strokeStyle = L.hairShade || 'rgba(120,110,150,0.7)'; g.lineWidth = 4; g.lineCap = 'round';
        g.beginPath(); g.moveTo(-44, -340); g.quadraticCurveTo(0, -386, 54, -384); g.moveTo(-30, -326); g.quadraticCurveTo(14, -362, 62, -352); g.moveTo(-50, -312); g.quadraticCurveTo(-46, -336, -24, -350); g.stroke();
        g.beginPath(); g.arc(56, -382, 12, Math.PI * 0.9, Math.PI * 2.4); g.stroke();
        g.strokeStyle = L.streak || 'rgba(255,255,255,0.55)'; g.lineWidth = L.streak ? 10 : 5; g.beginPath(); g.moveTo(-34, -352); g.quadraticCurveTo(4, -394, 48, -392); g.stroke();
        g.fillStyle = c; g.fillRect(-58, -306, 9, 34); g.fillRect(49, -306, 9, 34);
      } else if (L.hair === 'short') {
        g.beginPath(); g.moveTo(-57, -296); g.quadraticCurveTo(-58, -356, 0, -358); g.quadraticCurveTo(58, -356, 57, -296); g.quadraticCurveTo(30, -330, -57, -296); g.fill(); outline(g, 4);
      } else if (L.hair === 'curly' || L.hair === 'bun') {
        for (const [x, y, rad] of curls) if (y < -300) { g.beginPath(); g.arc(x * 0.92, y, rad * 0.8, 0, TAU); g.fill(); }
        if (L.hair === 'bun') { g.beginPath(); g.ellipse(0, -338, 58, 24, 0, Math.PI, TAU); g.fill(); }
      }
    }
    function head(g, a) {
      hair(g, false);
      g.fillStyle = L.skin;
      for (const s of [-1, 1]) { g.beginPath(); g.arc(s * 57, -288, 13, 0, TAU); g.fill(); outline(g, 4); }
      g.beginPath(); g.ellipse(0, -290, 57, 66, 0, 0, TAU); g.fill(); outline(g, 5);
      g.fillStyle = 'rgba(255,110,120,0.22)'; for (const s of [-1, 1]) { g.beginPath(); g.arc(s * 35, -266, 12, 0, TAU); g.fill(); }
      for (const s of [-1, 1]) {
        g.fillStyle = '#fff'; g.beginPath(); g.ellipse(s * 21, -300, 12, 14 * a.blink, 0, 0, TAU); g.fill(); outline(g, 3);
        if (a.blink > 0.5) { g.fillStyle = '#1b1030'; g.beginPath(); g.arc(s * 21 + a.look * 3, -298, 7.5, 0, TAU); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(s * 21 + a.look * 3 + 2, -301, 2, 0, TAU); g.fill(); }
      }
      if (L.glasses) { g.strokeStyle = L.glasses; g.lineWidth = 4; for (const s of [-1, 1]) { g.beginPath(); g.arc(s * 21, -300, 18, 0, TAU); g.stroke(); } g.beginPath(); g.moveTo(-3, -302); g.lineTo(3, -302); g.stroke(); }
      const raise = a.talk ? Math.abs(Math.sin(a.t * 3.1)) * 7 : 0;
      g.strokeStyle = L.brow || L.hairColor || '#3a2214'; g.lineWidth = 7; g.lineCap = 'round';
      for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 9, -322 - raise); g.quadraticCurveTo(s * 22, -331 - raise, s * 35, -322 - raise * 0.5); g.stroke(); }
      g.fillStyle = L.skinShade || shade(L.skin, -0.15); g.beginPath(); g.ellipse(0, -279, 10, 8, 0, 0, TAU); g.fill();
      const my = -251, m = a.mouth;
      if (m < 0.06) {
        g.beginPath();
        if (L.grin) { g.moveTo(-27, my - 5); g.quadraticCurveTo(0, my + 24, 27, my - 5); g.quadraticCurveTo(0, my + 4, -27, my - 5); g.fillStyle = '#fff'; g.fill(); outline(g, 3); }
        else { g.moveTo(-20, my - 2); g.quadraticCurveTo(0, my + 14, 20, my - 2); outline(g, 4); }
      } else {
        const w = 19 + m * 6, h = 5 + m * 17, cy = my + h * 0.3;
        g.beginPath(); g.ellipse(0, cy, w, h, 0, 0, TAU); g.fillStyle = '#5b1424'; g.fill();
        g.save(); g.clip(); g.fillStyle = '#fff'; g.fillRect(-w, cy - h, w * 2, h * 0.55);
        g.fillStyle = '#ff7a8a'; g.beginPath(); g.ellipse(0, cy + h * 0.8, w * 0.6, h * 0.5, 0, 0, TAU); g.fill(); g.restore();
        g.beginPath(); g.ellipse(0, cy, w, h, 0, 0, TAU); outline(g, 3);
      }
      if (L.mustache) {
        g.fillStyle = L.mustache; g.beginPath(); g.moveTo(0, -268);
        g.bezierCurveTo(-20, -278, -40, -270, -50, -262); g.bezierCurveTo(-58, -258, -64, -272, -56, -282); g.bezierCurveTo(-60, -262, -40, -254, 0, -260);
        g.bezierCurveTo(40, -254, 60, -262, 56, -282); g.bezierCurveTo(64, -272, 58, -258, 50, -262); g.bezierCurveTo(40, -270, 20, -278, 0, -268); g.fill(); outline(g, 3);
      }
      hair(g, true);
      if (L.hat) {
        g.fillStyle = L.hat; g.beginPath(); g.ellipse(0, -336, 112, 22, 0, 0, TAU); g.fill(); outline(g, 5);
        g.beginPath(); g.moveTo(-60, -340); g.bezierCurveTo(-66, -392, -52, -416, -24, -411); g.quadraticCurveTo(0, -396, 24, -411); g.bezierCurveTo(52, -416, 66, -392, 60, -340); g.closePath(); g.fill(); outline(g, 5);
        g.fillStyle = L.hatBand || '#4a2410'; g.fillRect(-61, -362, 122, 14);
        g.fillStyle = 'rgba(255,255,255,0.18)'; g.beginPath(); g.ellipse(-30, -390, 10, 18, 0.3, 0, TAU); g.fill();
      }
      if (L.prop === 'headset') {
        g.strokeStyle = '#222'; g.lineWidth = 6; g.beginPath(); g.arc(0, -300, 64, Math.PI * 1.05, Math.PI * 1.95); g.stroke();
        g.beginPath(); g.moveTo(58, -288); g.quadraticCurveTo(52, -250, 24, -246); g.stroke(); g.fillStyle = '#222'; g.beginPath(); g.arc(22, -246, 7, 0, TAU); g.fill();
      }
    }
    return function draw(g, a) {
      const sway = Math.sin(a.t * 0.9 + a.seed) * 4, bounce = a.talk ? -Math.abs(Math.sin(a.t * 6.2)) * 4 : Math.sin(a.t * 1.6) * 1.5;
      g.save(); g.translate(sway, bounce);
      g.fillStyle = L.skin; g.fillRect(-20, -238, 40, 44); g.beginPath(); g.rect(-20, -238, 40, 44); outline(g, 4);
      // torso
      g.beginPath(); g.moveTo(-98, -192); g.quadraticCurveTo(-118, -100, -84, 8); g.lineTo(84, 8); g.quadraticCurveTo(118, -100, 98, -192); g.quadraticCurveTo(0, -226, -98, -192); g.closePath();
      const gr = g.createLinearGradient(-100, 0, 100, 0); gr.addColorStop(0, L.suit2 || shade(L.suit, -0.3)); gr.addColorStop(0.5, L.suit); gr.addColorStop(1, L.suit2 || shade(L.suit, -0.3));
      g.fillStyle = gr; g.fill(); outline(g, 5);
      for (let i = 0; i < spark.length; i++) { const [x, y, p] = spark[i], tw = 0.35 + 0.65 * Math.abs(Math.sin(a.t * 3 + p)); g.fillStyle = L.sparkle; g.globalAlpha = tw; g.beginPath(); g.moveTo(x, y - 5); g.lineTo(x + 2.5, y); g.lineTo(x, y + 5); g.lineTo(x - 2.5, y); g.fill(); }
      g.globalAlpha = 1;
      g.fillStyle = L.shirt || '#fffdf7'; g.beginPath(); g.moveTo(-34, -208); g.lineTo(34, -208); g.lineTo(0, -96); g.closePath(); g.fill();
      g.fillStyle = L.lapel || shade(L.suit, -0.25);
      for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 36, -207); g.lineTo(s * 4, -98); g.lineTo(s * 32, -124); g.lineTo(s * 58, -172); g.closePath(); g.fill(); outline(g, 3); }
      g.fillStyle = L.lapel || '#ffd23f'; for (const y of [-70, -38]) { g.beginPath(); g.arc(0, y, 6, 0, TAU); g.fill(); }
      const tc = L.tieColor || '#ffd23f';
      if (L.tie === 'bow') { g.fillStyle = tc; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(0, -200); g.lineTo(s * 34, -216); g.lineTo(s * 34, -182); g.closePath(); g.fill(); outline(g, 3); } g.beginPath(); g.arc(0, -200, 8, 0, TAU); g.fill(); outline(g, 3); }
      else if (L.tie === 'bolo') { g.strokeStyle = '#2a1608'; g.lineWidth = 3; g.beginPath(); g.moveTo(-14, -208); g.lineTo(-4, -140); g.moveTo(14, -208); g.lineTo(4, -140); g.stroke(); g.fillStyle = '#c9ccd6'; g.beginPath(); g.arc(0, -172, 14, 0, TAU); g.fill(); outline(g, 3); g.fillStyle = tc; g.beginPath(); g.arc(0, -172, 8, 0, TAU); g.fill(); }
      else if (L.tie === 'long') { g.fillStyle = tc; g.beginPath(); g.moveTo(-9, -206); g.lineTo(9, -206); g.lineTo(14, -120); g.lineTo(0, -104); g.lineTo(-14, -120); g.closePath(); g.fill(); outline(g, 3); }
      if (L.watch) { g.strokeStyle = '#ffd23f'; g.lineWidth = 3; g.beginPath(); g.moveTo(-60, -90); g.quadraticCurveTo(-30, -60, -8, -84); g.stroke(); }
      g.save(); g.translate(0, -215); g.rotate(Math.sin(a.t * 1.7 + a.seed) * 0.035 + (a.talk ? Math.sin(a.t * 5.1) * 0.045 : 0)); g.translate(0, 215); head(g, a); g.restore();
      const R = arm(g, 1, a.hands.r, a), Lh = arm(g, -1, a.hands.l, a);
      if (L.prop === 'mic') {
        const [hx, hy] = Lh.h, up = a.pose === 'cheer';
        const tx = up ? hx : -34, ty = up ? hy - 90 : -226, dx = tx - hx, dy = ty - hy, d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d;
        g.strokeStyle = '#222'; g.lineWidth = 9; g.lineCap = 'round'; g.beginPath(); g.moveTo(hx - ux * 14, hy - uy * 14); g.lineTo(hx + ux * 46, hy + uy * 46); g.stroke();
        g.fillStyle = '#9aa0ad'; g.beginPath(); g.arc(hx + ux * 56, hy + uy * 56, 14, 0, TAU); g.fill(); outline(g, 3);
        g.fillStyle = 'rgba(255,255,255,0.6)'; g.beginPath(); g.arc(hx + ux * 52, hy + uy * 52, 4, 0, TAU); g.fill();
        g.fillStyle = L.skin; g.beginPath(); g.arc(hx, hy, 18, 0, TAU); g.fill(); g.lineWidth = 4; g.strokeStyle = OUT; g.stroke();
      }
      if (L.prop === 'gavel') {
        const [hx, hy] = R.h, ang = R.ang;
        g.save(); g.translate(hx, hy); g.rotate(ang);
        g.fillStyle = '#8a5528'; rr(g, -10, -6, 84, 12, 6); g.fill(); g.lineWidth = 3; g.strokeStyle = OUT; g.stroke();
        g.fillStyle = '#a0632e'; rr(g, 66, -26, 30, 52, 8); g.fill(); g.stroke();
        g.fillStyle = '#ffd23f'; g.fillRect(66, -10, 30, 6); g.restore();
        g.fillStyle = L.skin; g.beginPath(); g.arc(hx, hy, 18, 0, TAU); g.fill(); g.lineWidth = 4; g.strokeStyle = OUT; g.stroke();
      }
      if (L.prop === 'cards') { const [hx, hy] = R.h; g.save(); g.translate(hx, hy - 20); g.rotate(-0.2); g.fillStyle = '#fffdf7'; rr(g, -22, -34, 44, 60, 6); g.fill(); g.lineWidth = 3; g.strokeStyle = OUT; g.stroke(); g.restore(); }
      g.restore();
    };
  }

  // ---------- generic studio pieces ----------
  function podium(g, th, t, glyph) {
    const w = 280, h = 210;
    g.beginPath(); g.moveTo(-w / 2, 4); g.lineTo(w / 2, 4); g.lineTo(w / 2 - 26, h); g.lineTo(-w / 2 + 26, h); g.closePath();
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, th.pod1 || shade(th.accent, -0.35)); gr.addColorStop(1, th.pod2 || shade(th.accent, -0.7));
    g.fillStyle = gr; g.fill(); g.lineWidth = 5; g.strokeStyle = OUT; g.stroke();
    rr(g, -86, 44, 172, 118, 18); g.fillStyle = th.podPanel || 'rgba(0,0,0,0.45)'; g.fill(); g.lineWidth = 5; g.strokeStyle = th.accent2 || '#ffd23f'; g.stroke();
    if (glyph) { if (/^[\x20-\x7e]+$/.test(glyph)) text(g, glyph, 0, 104, 92, th.accent2 || '#ffd23f', { stroke: OUT, lw: 8 }); else drawEmoji(g, glyph, 0, 104, 84); }
    rr(g, -w / 2 - 14, -14, w + 28, 24, 10); g.fillStyle = th.podTop || th.accent2 || '#ffd23f'; g.fill(); g.lineWidth = 4; g.strokeStyle = OUT; g.stroke();
    for (let i = 0; i < 9; i++) { const on = (i + Math.floor(t * 6)) % 3 === 0; g.fillStyle = on ? '#fffbe0' : 'rgba(255,240,200,0.35)'; g.beginPath(); g.arc(-w / 2 + 6 + i * ((w - 12) / 8), -2, 5, 0, TAU); g.fill(); }
  }
  function spots(g, th, t, k, speed = 1, xs = [260, 720, 1200, 1660]) {
    if (k <= 0) return;
    const cols = th.spots || ['255,236,200', '255,236,200', '255,236,200', '255,236,200'];
    g.save(); g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < xs.length; i++) {
      const a = Math.sin(t * 0.7 * speed + i * 1.9) * 0.36 + (i < xs.length / 2 ? 0.14 : -0.14), ox = xs[i], oy = -40, len = 1180;
      const ex = ox + Math.sin(a) * len, ey = oy + Math.cos(a) * len, c = cols[i % cols.length];
      const gr = g.createLinearGradient(ox, oy, ex, ey); gr.addColorStop(0, `rgba(${c},${0.38 * k})`); gr.addColorStop(1, `rgba(${c},0)`);
      g.fillStyle = gr; const px = Math.cos(a) * 140, py = -Math.sin(a) * 140;
      g.beginPath(); g.moveTo(ox - 10, oy); g.lineTo(ex + px, ey + py); g.lineTo(ex - px, ey - py); g.lineTo(ox + 10, oy); g.fill();
      const fx = ox + Math.tan(a) * (900 - oy);
      const pg = g.createRadialGradient(fx, 900, 0, fx, 900, 200); pg.addColorStop(0, `rgba(${c},${0.3 * k})`); pg.addColorStop(1, `rgba(${c},0)`);
      g.fillStyle = pg; g.save(); g.translate(fx, 900); g.scale(1, 0.2); g.translate(-fx, -900); g.beginPath(); g.arc(fx, 900, 200, 0, TAU); g.fill(); g.restore();
    }
    g.restore();
  }
  function sign(g, x, y, w, h, str, on, rgb = '255,60,60') {
    g.save(); g.translate(x, y);
    rr(g, -w / 2 - 10, -h / 2 - 10, w + 20, h + 20, 18); g.fillStyle = '#16121c'; g.fill();
    rr(g, -w / 2, -h / 2, w, h, 12);
    if (on) { g.shadowColor = `rgb(${rgb})`; g.shadowBlur = 40; g.fillStyle = `rgb(${rgb})`; g.fill(); g.shadowBlur = 0; }
    else { g.fillStyle = `rgba(${rgb},0.16)`; g.fill(); }
    text(g, str, 0, h * 0.04, h * 0.58, on ? '#fff' : `rgba(${rgb},0.45)`, { max: w - 24 });
    g.restore();
  }

  // ---------- the studio audience ----------
  const SHIRTS = ['#ff4f9a', '#3ee6ff', '#ffd23f', '#2ee6a6', '#7b61ff', '#ff8a3d', '#e8e8f0', '#4a6cff', '#c03a6a', '#46c36a'];
  const SKINS = ['#f5d0b0', '#e0ac85', '#c68a5e', '#8d5a3b', '#5e3a24', '#f1c27d'];
  const HAIRS = ['#2b1a12', '#5a3a20', '#d8a040', '#1a1a1a', '#b04020', '#e8e0d8', '#6a3fd0', '#1a1a1a'];
  const SIGNS = ['WOO!', '♥', 'HI MOM', '★★★', 'YAY!'];
  function makeAudience(seed) {
    const r = rng(seed), rows = [];
    for (let k = 0; k < 5; k++) {
      const s = 0.66 + k * 0.12, y = 470 + k * 128, sp = 112 * s, row = [];
      for (let x = -60 + r() * sp; x < 2760; x += sp * (0.92 + r() * 0.16)) row.push({ x, shirt: pick(r, SHIRTS), skin: pick(r, SKINS), hair: pick(r, HAIRS), style: Math.floor(r() * 5), ph: r() * TAU, sp: 0.8 + r() * 0.5, sign: r() < 0.07 ? pick(r, SIGNS) : null, glasses: r() < 0.18 });
      rows.push({ y, s, row });
    }
    return rows;
  }
  function member(g, m, t, mood) {
    const tt = t * m.sp; let bob = Math.sin(tt * 2 + m.ph) * 2, open = 0;
    if (mood === 'cheer') { bob = -Math.abs(Math.sin(tt * 7 + m.ph)) * 16; open = 1; }
    else if (mood === 'clap') { bob = -Math.abs(Math.sin(tt * 6 + m.ph)) * 5; open = 0.4; }
    else if (mood === 'laugh') { bob = -Math.abs(Math.sin(tt * 10 + m.ph)) * 7; open = 0.8; }
    else if (mood === 'groan') { bob = 6; open = 0.3; }
    else if (mood === 'gasp') { open = 0.9; }
    g.translate(0, bob);
    g.fillStyle = m.shirt; g.beginPath(); g.moveTo(-46, 12); g.quadraticCurveTo(-48, -58, 0, -62); g.quadraticCurveTo(48, -58, 46, 12); g.closePath(); g.fill();
    if (m.style === 3) { g.fillStyle = m.hair; g.beginPath(); g.ellipse(0, -88, 34, 44, 0, 0, TAU); g.fill(); }
    g.fillStyle = m.skin; g.beginPath(); g.arc(0, -92, 28, 0, TAU); g.fill();
    g.fillStyle = m.hair; g.beginPath();
    if (m.style === 0) g.arc(0, -98, 29, Math.PI * 1.02, TAU * 0.99);
    else if (m.style === 1) { g.arc(0, -100, 30, Math.PI * 0.95, TAU * 1.02); }
    else if (m.style === 2) { g.arc(0, -126, 14, 0, TAU); g.moveTo(-28, -98); g.arc(0, -98, 28, Math.PI, TAU); }
    else if (m.style === 3) g.arc(0, -100, 29, Math.PI, TAU);
    else { g.rect(-30, -120, 60, 14); g.rect(-38, -110, 76, 6); }
    g.fill();
    g.fillStyle = '#1b1030'; g.beginPath(); g.arc(-10, -95, 3.4, 0, TAU); g.arc(10, -95, 3.4, 0, TAU); g.fill();
    if (m.glasses) { g.strokeStyle = '#1b1030'; g.lineWidth = 2.5; g.beginPath(); g.arc(-10, -95, 8, 0, TAU); g.moveTo(18, -95); g.arc(10, -95, 8, 0, TAU); g.stroke(); }
    if (open > 0.1) { g.fillStyle = '#5b1424'; g.beginPath(); g.ellipse(0, -79, 6, 3 + open * 5, 0, 0, TAU); g.fill(); }
    else { g.strokeStyle = '#1b1030'; g.lineWidth = 2.5; g.beginPath(); g.arc(0, -84, 8, 0.2, Math.PI - 0.2); g.stroke(); }
    g.lineCap = 'round'; g.lineWidth = 13; g.strokeStyle = m.shirt;
    if (mood === 'cheer') {
      if (m.sign) { g.beginPath(); g.moveTo(-30, -45); g.lineTo(-30, -150); g.moveTo(30, -45); g.lineTo(30, -150); g.stroke(); g.fillStyle = '#fffdf7'; rr(g, -50, -200, 100, 54, 6); g.fill(); text(g, m.sign, 0, -172, 26, '#e0245e', { max: 92 }); }
      else for (const s of [-1, 1]) { const hx = s * (42 + Math.sin(tt * 10 + m.ph + s) * 9), hy = -132; g.beginPath(); g.moveTo(s * 30, -45); g.lineTo(hx, hy); g.stroke(); g.fillStyle = m.skin; g.beginPath(); g.arc(hx, hy, 8, 0, TAU); g.fill(); }
    } else if (mood === 'clap' || mood === 'laugh') {
      const d = 4 + Math.abs(Math.sin(tt * 14 + m.ph)) * 12;
      for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 30, -30); g.lineTo(s * d, -50); g.stroke(); g.fillStyle = m.skin; g.beginPath(); g.arc(s * d, -50, 8, 0, TAU); g.fill(); }
    } else if (mood === 'groan' || mood === 'gasp') {
      for (const s of [-1, 1]) { const hx = s * 24, hy = mood === 'groan' ? -112 : -80; g.beginPath(); g.moveTo(s * 32, -40); g.lineTo(hx, hy); g.stroke(); g.fillStyle = m.skin; g.beginPath(); g.arc(hx, hy, 8, 0, TAU); g.fill(); }
    }
  }
  // Full-frame audience shot. pan 0..1 pans across the seats.
  function audience(g, th, A, t, pan, mood) {
    const camX = 960 + pan * 780;
    let gr = g.createLinearGradient(0, 0, 0, 1080); gr.addColorStop(0, th.audWall1 || '#1b0c30'); gr.addColorStop(1, th.audWall2 || '#07030f');
    g.fillStyle = gr; g.fillRect(-200, -200, 2320, 1480);
    g.save(); g.translate(960 - camX, 0);
    g.fillStyle = 'rgba(255,255,255,0.05)'; for (let x = -100; x < 2800; x += 260) g.fillRect(x, 0, 4, 420);
    for (let x = 200; x < 2800; x += 900) { g.fillStyle = '#0a3a20'; rr(g, x, 120, 90, 40, 6); g.fill(); text(g, 'EXIT', x + 45, 141, 26, '#39ff8a'); }
    const x0 = camX - 1100, x1 = camX + 1100;
    for (let k = 0; k < A.length; k++) {
      const R = A[k];
      g.fillStyle = 'rgba(6,2,14,0.42)'; g.fillRect(x0, -200, x1 - x0, R.y + 20);
      g.fillStyle = th.seat || '#4a1663'; g.fillRect(x0, R.y - 22 * R.s, x1 - x0, 70 * R.s);
      g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(x0, R.y - 22 * R.s, x1 - x0, 4);
      for (const m of R.row) { if (m.x < x0 || m.x > x1) continue; g.save(); g.translate(m.x, R.y); g.scale(R.s, R.s); member(g, m, t, mood); g.restore(); }
    }
    g.restore();
    spots(g, th, t, 0.5, 1.4, [300, 960, 1620]);
    gr = g.createLinearGradient(0, 700, 0, 1080); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.45)'); g.fillStyle = gr; g.fillRect(-200, 700, 2320, 400);
  }
  // Backs of heads along the bottom edge (in front of the stage).
  function makeBacks(seed) { const r = rng(seed); return Array.from({ length: 120 }, () => ({ shirt: shade(pick(r, SHIRTS), -0.72), hair: shade(pick(r, HAIRS), -0.55), skin: shade(pick(r, SKINS), -0.5), ph: r() * TAU, j: r() - 0.5, s: 0.9 + r() * 0.2, up: r() < 0.85 })); }
  function backs(g, th, M, t, x, y, w, h, mood) {
    const rim = th.rim || '#ffb8e8';
    for (let row = 0; row < 2; row++) {
      const r = h * (row ? 0.25 : 0.2), sp = h * (row ? 0.82 : 0.7), cy = y + h * (row ? 0.56 : 0.4), off = row ? 0 : sp / 2;
      const n = Math.ceil(w / sp) + 1;
      for (let i = 0; i < n; i++) {
        const m = M[(i * 2 + row) % M.length], cx = x + off + i * sp + m.j * sp * 0.3, s = m.s * r, tt = t + m.ph;
        let dy = Math.sin(tt * 1.5) * h * 0.01;
        if (mood === 'cheer') dy = -Math.abs(Math.sin(tt * 7)) * h * 0.08; else if (mood === 'clap' || mood === 'laugh') dy = -Math.abs(Math.sin(tt * 6)) * h * 0.025; else if (mood === 'groan') dy = h * 0.05;
        const hy = cy + dy;
        g.lineCap = 'round';
        if (mood === 'cheer' && m.up) {
          g.strokeStyle = m.shirt; g.lineWidth = s * 0.42;
          for (const sd of [-1, 1]) { const hx = cx + sd * (s * 1.5 + Math.sin(tt * 9 + sd) * s * 0.3), hy2 = hy - s * 2.6; g.beginPath(); g.moveTo(cx + sd * s * 1.1, hy + s * 1.2); g.lineTo(hx, hy2); g.stroke(); g.fillStyle = m.skin; g.beginPath(); g.arc(hx, hy2, s * 0.32, 0, TAU); g.fill(); }
        }
        g.fillStyle = m.shirt; g.beginPath(); g.ellipse(cx, hy + s * 2.0, s * 2.0, s * 1.3, 0, Math.PI, TAU); g.lineTo(cx + s * 2, y + h + 4); g.lineTo(cx - s * 2, y + h + 4); g.fill();
        g.fillStyle = m.hair; g.beginPath(); g.arc(cx, hy, s, 0, TAU); g.fill();
        g.strokeStyle = rim; g.globalAlpha = row ? 0.75 : 0.45; g.lineWidth = Math.max(1.5, s * 0.12); g.beginPath(); g.arc(cx, hy, s * 0.96, Math.PI * 1.15, Math.PI * 1.85); g.stroke(); g.globalAlpha = 1;
        if ((mood === 'clap' || mood === 'laugh') && i % 2 === 0) { const d = s * (0.2 + Math.abs(Math.sin(tt * 14)) * 0.5); g.fillStyle = m.skin; for (const sd of [-1, 1]) { g.beginPath(); g.arc(cx + sd * d, hy - s * 1.2, s * 0.3, 0, TAU); g.fill(); } }
        if (mood === 'groan') { g.fillStyle = m.skin; for (const sd of [-1, 1]) { g.beginPath(); g.arc(cx + sd * s * 0.9, hy - s * 0.4, s * 0.32, 0, TAU); g.fill(); } }
      }
    }
  }

  // ---------- confetti (fixed pool) ----------
  class Confetti {
    constructor(max = 220) { this.max = max; this.p = []; this.i = 0; }
    burst(x, y, n, colors, power = 1) {
      for (let k = 0; k < n; k++) {
        const o = { x, y, vx: (Math.random() - 0.5) * 900 * power, vy: (-Math.random() * 700 - 200) * power, r: Math.random() * TAU, vr: (Math.random() - 0.5) * 12, w: 10 + Math.random() * 10, h: 6 + Math.random() * 6, c: colors[k % colors.length], life: 3 + Math.random() * 1.5 };
        if (this.p.length < this.max) this.p.push(o); else { this.p[this.i] = o; this.i = (this.i + 1) % this.max; }
      }
    }
    get alive() { return this.p.length > 0; }
    step(g, dt) {
      for (let i = this.p.length - 1; i >= 0; i--) {
        const o = this.p[i]; o.life -= dt; if (o.life <= 0) { this.p.splice(i, 1); this.i = 0; continue; }
        o.vy += 900 * dt; o.vx *= 1 - dt * 0.9; o.vy = Math.min(o.vy, 380); o.x += o.vx * dt; o.y += o.vy * dt; o.r += o.vr * dt;
        g.save(); g.translate(o.x, o.y); g.rotate(o.r); g.scale(Math.cos(o.r * 2), 1); g.globalAlpha = clamp(o.life); g.fillStyle = o.c; g.fillRect(-o.w / 2, -o.h / 2, o.w, o.h); g.restore();
      }
      g.globalAlpha = 1;
    }
  }

  // ---------- intro registry + lazy loading ----------
  const intros = B.intros = B.intros || {};
  const loading = {};
  function need(key, cb) {
    if (!key || intros[key] || key === 'generic') { if (cb) cb(); return; }
    if (loading[key]) { if (cb && loading[key] !== 'failed') loading[key].push(cb); return; }
    loading[key] = cb ? [cb] : [];
    try {
      const s = document.createElement('script'); s.src = '/box/intros/' + encodeURIComponent(key) + '.js'; s.async = true;
      s.onload = () => { const l = loading[key]; loading[key] = intros[key] ? 'done' : 'failed'; if (Array.isArray(l)) l.forEach((f) => { try { f(); } catch (e) { console.error(e); } }); };
      s.onerror = () => { loading[key] = 'failed'; };
      document.head.appendChild(s);
    } catch { loading[key] = 'failed'; }
  }
  const introFor = (key) => intros[key] || intros.generic;
  // Preload this TV's game so it is ready long before the host presses start.
  try { const q = new URLSearchParams(location.search).get('game') || location.pathname.split('/')[1]; if (q && q !== 'box') need(q); } catch { /* fine */ }

  // The built-in generic intro: any game without its own file (and while one loads).
  const GEN_THEME = { accent: '#3ee6ff', accent2: '#ff4f9a', accent3: '#ffd23f', ink: '#fff8ef', fade: '#0a0b26', wall1: '#161b4c', wall2: '#070a22', floor1: '#1c1f55', floor2: '#06071a', disc1: '#2b2f7a', disc2: '#121540', rim: '#8ff0ff', seat: '#232a6a', confetti: ['#3ee6ff', '#ff4f9a', '#ffd23f', '#2ee6a6', '#ffffff'], spots: ['255,240,210', '120,230,255', '255,120,200', '255,240,210'] };
  function genericStage(g, s, o = {}) {
    const th = s.theme, t = s.t;
    let gr = g.createLinearGradient(0, 0, 0, 780); gr.addColorStop(0, th.wall1); gr.addColorStop(1, th.wall2); g.fillStyle = gr; g.fillRect(-600, -300, 3120, 1100);
    for (let i = 0; i < 9; i++) { // velvet curtains
      g.fillStyle = i % 2 ? '#6a1030' : '#8a1a40'; g.fillRect(-300 + i * 70, 0, 70, 780); g.fillRect(1590 + i * 70, 0, 70, 780);
    }
    g.strokeStyle = th.accent; g.lineWidth = 10; g.beginPath(); g.moveTo(330, 780); g.lineTo(330, 300); g.quadraticCurveTo(330, 70, 960, 70); g.quadraticCurveTo(1590, 70, 1590, 300); g.lineTo(1590, 780); g.stroke();
    for (let i = 0; i < 26; i++) { const a = i / 25, x = lerp(330, 1590, a), y = 70 + Math.pow(Math.abs(a - 0.5) * 2, 2) * 230; g.fillStyle = (i + Math.floor(t * 6)) % 3 ? 'rgba(255,240,200,0.35)' : '#fffbe0'; g.beginPath(); g.arc(x, y, 7, 0, TAU); g.fill(); }
    floor(g, th, t);
    if (o.host !== false) s.hostAt(1380, 800, 0.85);
    if (o.lights != null && o.lights < 1) { g.fillStyle = `rgba(0,0,0,${(1 - o.lights) * 0.85})`; g.fillRect(-600, -300, 3120, 1700); }
    if (o.logo !== 0) { g.save(); g.translate(960, 250); s.intro.logo(g, s, o.logo == null ? 1 : o.logo); g.restore(); }
    spots(g, th, t, o.spots == null ? 0.7 : o.spots);
  }
  function floor(g, th, t) {
    let gr = g.createLinearGradient(0, 760, 0, 1080); gr.addColorStop(0, th.floor1); gr.addColorStop(1, th.floor2); g.fillStyle = gr; g.fillRect(-600, 760, 3120, 700);
    g.strokeStyle = 'rgba(255,255,255,0.06)'; g.lineWidth = 2; g.beginPath(); for (let i = -12; i <= 12; i++) { g.moveTo(960 + i * 40, 760); g.lineTo(960 + i * 260, 1400); } g.stroke();
    g.fillStyle = th.accent; g.globalAlpha = 0.55; g.fillRect(-600, 756, 3120, 5); g.globalAlpha = 1;
    g.save(); g.translate(960, 905); g.scale(1, 0.16); gr = g.createRadialGradient(0, 0, 0, 0, 0, 760); gr.addColorStop(0, th.disc1); gr.addColorStop(1, th.disc2);
    g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 760, 0, TAU); g.fill(); g.lineWidth = 20; g.strokeStyle = th.accent; g.globalAlpha = 0.7; g.stroke(); g.globalAlpha = 1; g.restore();
    for (let k = 0; k < 40; k++) { const a = (k / 40) * TAU, on = (k + Math.floor(t * 8)) % 4 === 0; g.fillStyle = on ? '#fffbe0' : 'rgba(255,240,200,0.3)'; g.beginPath(); g.arc(960 + Math.cos(a) * 760, 905 + Math.sin(a) * 122, on ? 7 : 5, 0, TAU); g.fill(); }
  }
  intros.generic = {
    theme: GEN_THEME,
    host: { name: 'Vicky Volume', voice: { kokoro: 'af_heart', cb: 'hype', speed: 1.0, like: /aria|jenny|ava|emma|samantha|zira|female/i, accent: /en-US/i, pitch: 1.2, rate: 1.04 },
      look: { skin: '#8d5a3b', suit: '#16b8b0', suit2: '#0b6f6a', lapel: '#ff4f9a', shirt: '#1b1240', tie: 'none', hair: 'curly', hairColor: '#7b3fe4', brow: '#2a1240', prop: 'headset', grin: true, sparkle: '#c9fffb' } },
    lines: {
      welcome: 'Welcome, welcome to {title}! I\'m Vicky Volume, and tonight we turn it UP!',
      joke: 'Our budget is so tiny, the confetti is just my old homework!',
      meet: 'Now let\'s meet tonight\'s contestants!',
      banter: ['Contestants, tell me something funny about yourselves!', 'Phones out! The audience is dying to know you!', 'No pressure… but everyone is watching!'],
      first: 'Let\'s meet our contestants! First up, {name}', intros: ['Say hello to {name}', 'Give it up for {name}', 'Here comes {name}', 'Make some noise for {name}'],
      last: 'And last but not least, {name}', noFact: 'a person of mystery!', roll: 'Here\'s tonight\'s cast!', more: '…and {n} more!', others: 'And a big hand for everyone else!', play: 'Let\'s play {title}!',
    },
    stage: genericStage,
    hostCam: { x: 1170, y: 610, z: 1.75 },
    logo(g, s, lit) {
      const title = s.title.toUpperCase();
      rr(g, -400, -110, 800, 220, 30); g.fillStyle = '#120a2b'; g.fill(); g.lineWidth = 10; g.strokeStyle = s.theme.accent; g.stroke();
      for (let i = 0; i < 24; i++) { const a = i / 24, x = -380 + a * 760; g.fillStyle = lit > 0.5 && (i + Math.floor(s.t * 6)) % 3 ? '#fffbe0' : 'rgba(255,240,200,0.25)'; g.beginPath(); g.arc(x, -96, 6, 0, TAU); g.arc(x, 96, 6, 0, TAU); g.fill(); }
      g.globalAlpha = 0.25 + 0.75 * lit; text(g, title, 0, 6, 110, s.theme.accent3, { stroke: s.theme.accent2, lw: 12, max: 720 }); g.globalAlpha = 1;
    },
    opening: [
      { ms: 4000, draw(g, s) { s.cam(960, lerp(600, 520, ease(s.k)), 1 + 0.08 * ease(s.k)); s.intro.stage(g, s, { lights: ss(0, 1800, s.T), logo: s.T < 1300 ? 0 : s.T < 1900 ? (Math.sin(s.T * 0.09) > 0 ? 1 : 0.2) : 1, spots: ss(300, 900, s.T) }); s.sign(200, 90, 220, 70, 'ON AIR', s.T > 600); }, sfx: [[150, 'swell'], [1300, 'start']] },
      { ms: 3600, draw(g, s) { s.audience(s.k, s.T > 400 ? 'cheer' : 'idle'); s.sign(960, 100, 420, 96, 'APPLAUSE', s.T > 400 && (s.T % 760) < 600, '255,150,40'); }, sfx: [[400, 'cheer']] },
      { ms: 3600, draw(g, s) { const k = ease(s.T / 2600); s.cam(lerp(960, 1340, k), lerp(540, 590, k), lerp(1, 2.3, k)); s.intro.stage(g, s, {}); }, say: 'welcome', sayAt: 200, fit: 4000, sfx: [[0, 'whoosh']], pose: [[0, 'wave', 2400]] },
    ],
    castOpening: [
      { ms: 2600, draw(g, s) { s.cam(960, 540, 1 + 0.06 * s.k); s.intro.stage(g, s, { lights: ss(0, 1200, s.T), logo: s.T > 700 ? 1 : 0 }); s.sign(200, 90, 220, 70, 'ON AIR', s.T > 300); }, sfx: [[100, 'swell'], [700, 'start']] },
      { ms: 1800, draw(g, s) { s.audience(s.k, 'cheer'); s.sign(960, 100, 420, 96, 'APPLAUSE', (s.T % 700) < 520, '255,150,40'); }, sfx: [[100, 'cheer']] },
      { ms: 2600, draw(g, s) { const k = ease(s.T / 1800); s.cam(lerp(960, 1340, k), lerp(540, 590, k), lerp(1, 2.3, k)); s.intro.stage(g, s, {}); }, say: 'welcome', sayAt: 100, fit: 2500, pose: [[0, 'wave', 2000]] },
    ],
  };

  // ---------- render loop ----------
  const loop = { items: new Set(), raf: 0, last: 0, errs: 0 };
  function tick(now) {
    const dt = loop.last ? Math.min(0.05, (now - loop.last) / 1000) : 0.016; loop.last = now;
    for (const it of [...loop.items]) {
      if (!it.alive()) { loop.items.delete(it); if (it.dispose) it.dispose(); continue; }
      try { it.frame(now, dt); } catch (e) { if (loop.errs++ < 5) console.error(e); }
    }
    loop.raf = loop.items.size ? requestAnimationFrame(tick) : 0;
  }
  function addLoop(it) { loop.items.add(it); if (!loop.raf) { loop.last = 0; loop.raf = requestAnimationFrame(tick); } }
  function fit(cv, dprCap) {
    const w = Math.max(1, cv.clientWidth), h = Math.max(1, cv.clientHeight), d = Math.min(window.devicePixelRatio || 1, dprCap);
    const W = Math.round(w * d), H = Math.round(h * d);
    if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    return { w, h, d, W, H };
  }
  const fill = (str, v) => String(str || '').replace(/\{(\w+)\}/g, (m, k) => (v[k] != null ? v[k] : ''));
  // The voice never reads a player's name or a count out of a recording: a name line is spoken as
  // its pre-rendered lead ('Give it up for {name}' -> 'Give it up for…') while the screen shows the
  // name. With the live voice on (voice.js "Natural live voice") the whole line is spoken instead.
  const nameless = (raw) => {
    const r = String(raw || ''), tail = /\{(name|n)\}[\s.!?…]*$/.test(r); // the name ends the line: trail off ("Say hello to…")
    let x = r.replace(/[,:]?\s*\{name\}/g, '').replace(/\s*\{n\}/g, '').replace(/\s+([.!?…,])/g, '$1').trim();
    if (tail) x = x.replace(/[\s,.!?…]+$/, '') + '…';
    return /[A-Za-z]/.test(x) ? x : '';
  };
  const liveNames = () => !!(B.voice && B.voice.live && B.voice.liveStatus && B.voice.liveStatus() === 'ready');

  // A draw context for intro code (see the API at the top).
  function makeCtx(owner, g) {
    const s = {
      g, t: 0, now: 0, T: 0, k: 0, ms: 1, show: null, intro: null, theme: null, mode: 'facts', crowd: 'idle', title: '',
      base: [1, 0, 0],
      cam(cx, cy, z) { g.translate(960, 540); g.scale(z, z); g.translate(-cx, -cy); },
      host(x, y, sc) { const H = s.intro.host; if (!H) return; g.save(); g.translate(x, y); g.scale(sc, sc); try { owner.hostDraw()(g, owner.A.frame(s.now)); } catch (e) { if (loop.errs++ < 5) console.error(e); } g.restore(); },
      hostAt(x, y, sc) { s.host(x, y, sc); if (s.intro.podium) s.intro.podium(g, s, x, y, sc); else s.podium(x, y, sc, s.intro.podiumGlyph); },
      podium(x, y, sc, glyph) { g.save(); g.translate(x, y); g.scale(sc, sc); podium(g, s.theme, s.t, glyph); g.restore(); },
      audience(pan, mood) { audience(g, s.theme, owner.aud, s.t, pan, mood || s.crowd); },
      backs(x, y, w, h, mood) { backs(g, s.theme, owner.backsM, s.t, x, y, w, h, mood || s.crowd); },
      spots(k, speed, xs) { spots(g, s.theme, s.t, k, speed, xs); },
      sign(x, y, w, h, str, on, rgb) { sign(g, x, y, w, h, str, on, rgb); },
      emoji(e, x, y, px) { drawEmoji(g, e, x, y, px); },
      // c = a player ({ id, name, avatar, color }): their character, or their emoji without one
      face(c, x, y, px, o) { return drawFace(g, c, x, y, px, o); },
      body(c, x, y, h, o) { return drawBody(g, c, x, y, h, { t: s.t, ...o }); },
      text(str, x, y, px, f, o) { text(g, str, x, y, px, f, o); },
      floor() { floor(g, s.theme, s.t); },
      rr(x, y, w, h, r) { rr(g, x, y, w, h, r); },
      ease, easeOut, back, ss, clamp, lerp, TAU,
    };
    return s;
  }
  const themeOf = (intro) => ({ ...GEN_THEME, ...(intro && intro.theme) });

  // =================================================================================
  // The opening cutscene
  // =================================================================================
  class Intro {
    constructor(el, show) {
      this.el = el; this.key = show.game;
      el.innerHTML = `<canvas class="si-cv"></canvas><div class="si-bug"><span class="si-live">LIVE</span><b class="si-title"></b></div>
        <div class="si-facts" hidden></div><div class="si-sub"><b class="si-who"></b><span class="si-line"></span></div><div class="si-loader" hidden></div>`;
      this.cv = el.querySelector('canvas'); this.g = this.cv.getContext('2d');
      this.factsEl = el.querySelector('.si-facts'); this.subEl = el.querySelector('.si-sub'); this.lineEl = el.querySelector('.si-line'); this.whoEl = el.querySelector('.si-who');
      this.aud = makeAudience(hash(show.game) + 7); this.backsM = makeBacks(hash(show.game) + 3);
      this.conf = new Confetti(260); this.done = new Set(); this.step = null; this.stepStart = performance.now(); this.endsAt = 0;
      this.shot = ''; this.cutAt = 0; this.subUntil = 0; this.saidMeet = false; this.crowd = 'idle'; this.crowdUntil = 0; this.factsHtml = '';
      this.s = makeCtx(this, this.g);
      this.setIntro(); need(show.game, () => this.setIntro());
      try { if (B.voice.preload) B.voice.preload(show.game); } catch { /* no clips */ }
      this.update(show);
      addLoop(this);
    }
    setIntro() {
      const I = introFor(this.key);
      if (I === this.I) return;
      if (I.onShow && this.show) try { I.onShow(this.show); } catch (e) { console.error(e); } // the intro adapts to the game (e.g. YesChef's kitchen)
      this.I = I; this.theme = themeOf(I); this.A = new HostAnim(I.host || {}); this._draw = null;
      this.el.style.setProperty('--si-accent', this.theme.accent); this.el.style.setProperty('--si-accent2', this.theme.accent2);
      this.whoEl.textContent = I.host ? I.host.name : ''; this.whoEl.hidden = !I.host;
    }
    hostDraw() { if (!this._draw) { const H = this.I.host || {}; this._draw = H.draw ? H.draw.bind(H) : makeHost(H.look || intros.generic.host.look); } return this._draw; }
    update(show) {
      const now = performance.now(), start = now - (Number(show.stepAgo) || 0);
      if (show.step !== this.step) { this.step = show.step; this.stepStart = start; }
      else if (Math.abs(start - this.stepStart) > 900) this.stepStart = start;
      this.endsAt = now + (Number(show.endsIn) || 0);
      this.show = show; this.mode = show.mode === 'cast' ? 'cast' : 'facts';
      // An intro with onShow(show) adapts to the game's extra info (show.extra): its host may change.
      if (this.I.onShow) { try { if (this.I.onShow(show)) { this.theme = themeOf(this.I); this._draw = null; this.A = new HostAnim(this.I.host || {}); } } catch (e) { console.error(e); } this.whoEl.textContent = this.I.host ? this.I.host.name : ''; this.whoEl.hidden = !this.I.host; }
      this.title = show.title || this.I.title || '';
      this.el.querySelector('.si-title').textContent = this.I.title || this.title;
      this.renderFacts(show);
      this.prepareLines(show);
    }
    // The live narrator voice (if it is on) starts on the lines with names before they are due.
    prepareLines(S) {
      if (!B.voice.prepare) return;
      const F = S.featured || [], sig = this.mode + S.step + F.map((c) => c.name + c.fact).join('|') + (S.others || []).length;
      if (sig === this.prepSig) return; this.prepSig = sig;
      const V = this.I.host && this.I.host.voice;
      try {
        if (this.mode === 'facts' && S.step === 'intros') F.forEach((c, i) => B.voice.prepare(Speech.clean(this.factLine(i, c, F.length)), V));
        else if (this.mode === 'cast' && (S.others || []).length) B.voice.prepare(Speech.clean(this.line('more', { n: S.others.length })), V);
      } catch { /* subtitles only */ }
    }
    alive() { return this.el.isConnected; }
    lines() { return { ...intros.generic.lines, ...(this.I.lines || {}) }; }
    line(k, v = {}) { const L = this.lines()[k]; return fill(Array.isArray(L) ? L[(v.i || 0) % L.length] : L, { title: this.I.title || this.title, ...v }); }
    say(str, fitMs, now = performance.now(), o) {
      if (!str) return;
      const est = Speech.say(str, this.I.host && this.I.host.voice, fitMs, o);
      if (this.I.host) this.A.talk(now, est);
      this.lineEl.textContent = str; this.subEl.classList.add('on'); this.subUntil = now + est + 1200;
    }
    setCrowd(m, ms, now) { this.crowd = m; this.crowdUntil = now + ms; }
    // Run fn once when the step's clock passes `at`; a late TV (reload) skips stale cues.
    cue(key, at, T, fn) { const k = this.step + ':' + key; if (T < at || this.done.has(k)) return; this.done.add(k); if (T - at < 1500) { try { fn(); } catch (e) { console.error(e); } } }
    renderFacts(S) {
      let html = '';
      if (this.mode === 'facts' && S.step === 'facts') {
        const of = S.of || 0, n = S.submitted || 0, pct = of ? Math.round((n / of) * 100) : 100, host = this.I.host ? this.I.host.name.split(' ')[0] : 'the host';
        html = `<div class="si-fh">📱 Grab your phone!</div><div class="si-ft">Tell ${esc(host)} something funny about yourself</div>
          <div class="si-bar"><i style="width:${pct}%"></i></div><div class="si-fc"><b>${n}</b> of ${of} contestant${of === 1 ? '' : 's'} ready</div>
          ${(S.waiting || []).length ? `<div class="si-fw">Waiting on ${S.waiting.map(esc).join(', ')}</div>` : n >= of ? '<div class="si-fw ok">Everyone’s in! 🎉</div>' : ''}`;
      }
      if (html !== this.factsHtml) { this.factsHtml = html; this.factsEl.innerHTML = html; }
      this.factsEl.hidden = !html;
    }
    runShot(shot, T, now, total) {
      const s = this.s; s.T = T; s.ms = shot.ms; s.k = clamp(T / shot.ms);
      const sc = shot._scale || 1;
      for (const [at, n] of shot.sfx || []) this.cue(shot._id + 'x' + at + n, shot._at + at * sc, total, () => sfx(n));
      for (const [at, p, ms] of shot.pose || []) this.cue(shot._id + 'p' + at + p, shot._at + at * sc, total, () => this.A.setPose(p, ms * sc, now));
      for (const [at, m, ms] of shot.crowd || []) this.cue(shot._id + 'c' + at + m, shot._at + at * sc, total, () => this.setCrowd(m, ms * sc, now));
      if (shot.say) this.cue(shot._id + 'say', shot._at + (shot.sayAt || 0) * sc, total, () => { this.say(this.line(shot.say), (shot.fit || 3500) * sc, now); if (shot.say === 'meet') this.saidMeet = true; });
      g0(this.g, s, () => shot.draw(this.g, s));
    }
    // The opening shots laid out on the step clock. The server sends each shot's length
    // (show.openShots: a shot the narrator speaks in is stretched to fit the line, box/narration.js);
    // without it (another intro still loading, an old server) they are squeezed to `room` ms.
    opening(list, room) {
      const ms = this.show && this.show.openShots;
      if (Array.isArray(ms) && ms.length === list.length) {
        let at = 0;
        return list.map((x, i) => { const o = Object.assign(Object.create(x), { ms: Math.max(1, ms[i]), _at: at, _scale: 1, _id: 'o' + i }); at += o.ms; return o; });
      }
      const total = list.reduce((a, x) => a + x.ms, 0), sc = room ? Math.min(1, room / total) : 1; let at = 0;
      return list.map((x, i) => { const o = Object.assign(Object.create(x), { ms: x.ms * sc, _at: at, _scale: sc, _id: 'o' + i }); at += o.ms; return o; });
    }
    frame(now, dt) {
      const { w, h, d } = fit(this.cv, 1.25), g = this.g, s = this.s;
      if (this.subUntil && now > this.subUntil) { this.subEl.classList.remove('on'); this.subUntil = 0; }
      if (now > this.crowdUntil) this.crowd = 'idle';
      const sc = Math.max(w / 1920, h / 1080) * d;
      s.base = [sc, (w * d - 1920 * sc) / 2, (h * d - 1080 * sc) / 2];
      s.t = now / 1000; s.now = now; s.show = this.show; s.intro = this.I; s.theme = this.theme; s.mode = this.mode; s.crowd = this.crowd; s.title = this.I.title || this.title;
      g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = this.theme.fade || '#000'; g.fillRect(0, 0, this.cv.width, this.cv.height);
      const T = now - this.stepStart;
      let shot;
      if (this.mode === 'cast') shot = this.cast(T, now);
      else if (this.step === 'facts') shot = this.facts(T, now);
      else shot = this.reveals(T, now);
      if (shot !== this.shot) { this.shot = shot; this.cutAt = now; }
      g.setTransform(...[s.base[0], 0, 0, s.base[0], s.base[1], s.base[2]]);
      this.conf.step(g, dt);
      const f = 1 - (now - this.cutAt) / 220; if (f > 0 && this.cutAt) { g.fillStyle = `rgba(255,255,255,${f * 0.28})`; g.fillRect(-500, -500, 2920, 2080); }
    }
    // ---- facts mode, step 'facts' ----
    facts(T, now) {
      const S = this.show, list = this.opening(this.I.opening || intros.generic.opening), end = list.length ? list[list.length - 1]._at + list[list.length - 1].ms : 0;
      const allIn = (S.submitted || 0) >= (S.of || 0);
      this.factsEl.classList.toggle('big', T >= end && this.shot !== 'cut');
      if (T < end) { const sh = list.find((x) => T < x._at + x.ms) || list[list.length - 1]; this.runShot(sh, T - sh._at, now, T); return sh._id; }
      const L = this.lines();
      if (L.joke) this.cue('joke', end + 600, T, () => this.say(this.line('joke'), 3800, now));
      if (L.joke) this.cue('laugh', end + 4200, T, () => { this.setCrowd('laugh', 2200, now); sfx('cheer'); });
      const first = end + (L.joke ? 5000 : 900), slot = Math.floor((T - first) / 7000);
      if (T >= first) this.cue('slot' + slot, first + slot * 7000, T, () => {
        if (allIn || this.endsAt - now < 3000) this.meet(now);
        else if (!this.saidMeet) { this.say(this.line('banter', { i: slot }), 4500, now); this.A.setPose('pointL', 1600, now); }
      });
      if (!this.saidMeet && T > first && this.endsAt - now < 2600 && this.endsAt - now > 300) this.meet(now);
      const cut = T >= first + 9000 && ((T - first - 9000) % 14000) < 3200;
      const s = this.s; s.T = T - end; s.k = 0;
      if (cut) {
        g0(this.g, s, () => (this.I.cutaway ? this.I.cutaway(this.g, s) : s.audience(((T / 9000) % 1), this.crowd === 'idle' ? 'clap' : this.crowd)));
        return 'cut';
      }
      const c = this.I.hostCam || intros.generic.hostCam;
      g0(this.g, s, () => { s.cam(c.x, c.y, c.z + Math.sin(s.t * 0.25) * 0.03); this.I.stage(this.g, s, {}); });
      g0(this.g, s, () => s.backs(-60, 950, 2040, 140));
      return 'host';
    }
    meet(now) { if (this.saidMeet) return; this.saidMeet = true; sfx('drum'); this.say(this.line('meet'), 2300, now); this.A.setPose('cheer', 1600, now); }
    // ---- facts mode, step 'intros': one reveal per featured contestant, then the outro ----
    reveals(T, now) {
      const S = this.show, F = S.featured || [], n = F.length, per = S.perMs || 5200;
      // Each reveal lasts S.slots[i] (the server sizes it to the host's line), else perMs.
      const slot = (i) => (Array.isArray(S.slots) && S.slots[i] ? S.slots[i] : per);
      let at = 0, i = 0; while (i < n && T >= at + slot(i)) { at += slot(i); i++; }
      this.factsEl.hidden = true;
      if (i < n) {
        const Ti = T - at, c = F[i], len = slot(i);
        this.cue('w' + i, at, T, () => sfx('whoosh'));
        this.cue('c' + i, at + 320, T, () => { sfx('cheer'); this.setCrowd('cheer', 2600, now); });
        this.cue('l' + i, at + 250, T, () => { this.say(this.factLine(i, c, n), 0, now, { maxWait: 9000, speak: this.factSpoken(i, c, n) }); this.saidMeet = true; this.A.setPose('pointL', 1800, now); });
        this.contestant(c, i, Ti, len);
        return 'c' + i;
      }
      return this.outro(T - at, now, S.outroMs || 6000);
    }
    leadOf(i, n) { const L = this.lines(); return i === 0 && !this.saidMeet ? L.first : i === n - 1 && n > 2 ? L.last : L.intros[i % L.intros.length]; }
    // What the voice says for a contestant reveal: the lead without the name (plus the no-fact quip).
    factSpoken(i, c, n) {
      if (liveNames()) return null;
      const L = this.lines(), lead = fill(nameless(this.leadOf(i, n)), { title: this.title });
      return String(c.fact || '').trim() ? lead : lead + ' ' + fill(L.noFact, { n: i + 1 });
    }
    factLine(i, c, n) {
      const L = this.lines(), v = { name: c.name, n: i + 1 };
      const lead = fill(this.leadOf(i, n), { ...v, title: this.title });
      const f = String(c.fact || '').trim().replace(/[.!?…\s]+$/, '');
      if (!f) return `${lead}… ${fill(L.noFact, v)}`;
      if (/^(i|i'm|i've|i'd|i'll|my|me|im)\b/i.test(f)) return `${lead}! ${c.name} says: “${f}!”`;
      if (/^(once|can|could|was|were|has|have|had|is|am|still|never|always|got|owns|own|thinks|named|taught|sneezes|loves|hates|eats|ate|went|won|lost|likes|knows|keeps|collects|sleeps|believes|did|does|used|secretly|cried|broke|fell|met|wants|talks|sings|dances|plays|hides|drinks|runs|cannot|can't|has never|almost|accidentally)\b/i.test(f)) return `${lead}… who ${f[0].toLowerCase() + f.slice(1)}!`;
      return `${lead}! ${c.name} says: “${f}!”`;
    }
    contestant(c, i, Ti, per) {
      const g = this.g, s = this.s, I = this.I, th = this.theme, t = s.t;
      s.T = Ti; s.k = Ti / per;
      const whip = 1 - easeOut(Ti / 380);
      g0(g, s, () => {
        s.cam(940 + whip * 600, 560, 1.04 + s.k * 0.05);
        I.stage(g, s, { host: false, bare: true, lights: 0.55, spots: 0.25 });
        g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(-600, -300, 3120, 1700);
        // the spotlight on the contestant
        g.save(); g.globalCompositeOperation = 'lighter';
        const gr = g.createLinearGradient(720, -60, 720, 1000); gr.addColorStop(0, 'rgba(255,250,225,0.5)'); gr.addColorStop(1, 'rgba(255,250,225,0.06)');
        g.fillStyle = gr; g.beginPath(); g.moveTo(690, -60); g.lineTo(750, -60); g.lineTo(960, 960); g.lineTo(480, 960); g.fill();
        const rg = g.createRadialGradient(720, 560, 20, 720, 560, 300); rg.addColorStop(0, hexA(c.color, 0.55)); rg.addColorStop(1, hexA(c.color, 0)); g.fillStyle = rg; g.beginPath(); g.arc(720, 560, 300, 0, TAU); g.fill();
        g.restore();
        // rays behind the avatar
        g.save(); g.translate(720, 560); g.rotate(t * 0.4); g.globalAlpha = 0.18 * ss(100, 600, Ti); g.fillStyle = c.color || th.accent;
        for (let k = 0; k < 12; k++) { g.rotate(TAU / 12); g.beginPath(); g.moveTo(0, 0); g.lineTo(-30, -420); g.lineTo(30, -420); g.fill(); } g.restore();
        // the contestant: a body in their colour, waving arms and their avatar as a face
        const pop = back((Ti - 150) / 520), bob = Math.sin(t * 3) * 8;
        if (pop > 0 && B.hasLook && B.hasLook(c)) {
          // their own character (wearing this game's gear), waving from behind the podium
          g.save(); g.translate(720, 760 + bob * 0.3); g.scale(pop, pop);
          drawBody(g, c, 0, 0, 560, { t, mood: 'grin', arms: { l: 0.25, r: -2.5 + Math.sin(t * 9) * 0.35 } });
          g.restore();
        } else if (pop > 0) {
          g.save(); g.translate(720, 610 + bob * 0.3); g.scale(pop, pop);
          g.lineCap = 'round'; g.strokeStyle = OUT; g.lineWidth = 34;
          const wv = Math.sin(t * 9) * 22;
          for (const sd of [-1, 1]) { g.beginPath(); g.moveTo(sd * 90, -20); g.lineTo(sd * (190 + (sd > 0 ? wv : 0)), -120 - (sd > 0 ? wv * 2 : 0)); g.stroke(); }
          g.strokeStyle = c.color || th.accent; g.lineWidth = 26;
          for (const sd of [-1, 1]) { g.beginPath(); g.moveTo(sd * 90, -20); g.lineTo(sd * (190 + (sd > 0 ? wv : 0)), -120 - (sd > 0 ? wv * 2 : 0)); g.stroke(); }
          g.fillStyle = c.color || th.accent; g.beginPath(); g.moveTo(-120, 80); g.quadraticCurveTo(-125, -40, 0, -48); g.quadraticCurveTo(125, -40, 120, 80); g.closePath(); g.fill(); g.lineWidth = 6; g.strokeStyle = OUT; g.stroke();
          g.restore();
          drawEmoji(g, c.avatar || '🙂', 720, 455 + bob, 240 * pop);
        }
        // their podium + name plate
        g.save(); g.translate(720, 680);
        g.beginPath(); g.moveTo(-170, 0); g.lineTo(170, 0); g.lineTo(150, 260); g.lineTo(-150, 260); g.closePath(); g.fillStyle = th.pod2 || '#1d0838'; g.fill(); g.lineWidth = 6; g.strokeStyle = OUT; g.stroke();
        rr(g, -184, -16, 368, 28, 10); g.fillStyle = th.podTop || th.accent2; g.fill(); g.stroke();
        const plate = easeOut((Ti - 350) / 400);
        rr(g, -150, 40, 300 * plate, 96, 16); g.fillStyle = c.color || th.accent; g.fill(); g.lineWidth = 5; g.stroke();
        if (plate > 0.9) { text(g, c.name, 0, 90, 60, '#fff', { stroke: OUT, lw: 10, max: 270 }); }
        g.restore();
        // the host, pointing at them
        s.hostAt(1600, 832, 0.72);
      });
      // the fun-fact card (screen space)
      const k = easeOut((Ti - 750) / 500);
      if (k > 0) g0(g, s, () => {
        g.translate(1060 + (1 - k) * 500, 150); g.rotate(0.02 - (1 - k) * 0.1); g.globalAlpha = k;
        const fact = c.fact ? '“' + String(c.fact).trim() + '”' : 'A person of mystery…';
        let px = 46, lines; for (; px >= 28; px -= 4) { g.font = `600 ${px}px ${BODY}`; lines = wrap(g, fact, 600, 5); if (lines.length <= 3 || px <= 30) break; }
        const hh = 110 + lines.length * px * 1.2;
        rr(g, 0, 0, 680, hh, 26); g.fillStyle = '#fffdf7'; g.fill(); g.lineWidth = 6; g.strokeStyle = OUT; g.stroke();
        g.beginPath(); g.moveTo(40, hh - 4); g.lineTo(-30, hh + 70); g.lineTo(110, hh - 4); g.fillStyle = '#fffdf7'; g.fill(); g.stroke(); g.fillRect(44, hh - 10, 62, 10);
        rr(g, 26, -24, 400, 50, 25); g.fillStyle = th.accent || '#ff4f9a'; g.fill(); g.lineWidth = 4; g.stroke();
        text(g, `CONTESTANT #${i + 1} · FUN FACT`, 226, 2, 30, '#fff', { stroke: OUT, lw: 6, max: 370 });
        g.font = `600 ${px}px ${BODY}`; g.fillStyle = '#2a1650'; g.textAlign = 'left'; g.textBaseline = 'top';
        lines.forEach((ln, j) => g.fillText(ln, 40, 54 + j * px * 1.2));
      });
      g0(g, s, () => s.backs(-60, 950, 2040, 140));
      if (whip > 0.02) g0(g, s, () => { g.fillStyle = `rgba(255,255,255,${whip * 0.5})`; for (let k2 = 0; k2 < 22; k2++) { const y = (k2 * 97 + i * 31) % 1080; g.fillRect(-200, y, 2400, 3 + (k2 % 3) * 3); } });
    }
    // ---- cast mode: opening, quick roll call, outro ----
    cast(T, now) {
      const S = this.show, open = S.openMs || 7000, per = S.perMs || 900, F = S.featured || [], n = F.length;
      const rollMs = S.rollMs || n * per; // the server makes the roll call as long as its lines
      this.factsEl.hidden = true;
      if (T < open) { const list = this.opening(this.I.castOpening || this.I.opening || intros.generic.castOpening, open), sh = list.find((x) => T < x._at + x.ms) || list[list.length - 1]; this.runShot(sh, T - sh._at, now, T); return sh._id; }
      if (T < open + rollMs) { this.roll(T - open, now, F, per, rollMs); return 'roll'; }
      return this.outro(T - open - rollMs, now, S.outroMs || 3000);
    }
    roll(u, now, F, per, rollMs) {
      const g = this.g, s = this.s, th = this.theme, n = F.length, more = (this.show.others || []).length;
      const moreAt = this.show.moreAt != null ? this.show.moreAt : Math.max(0, n * per - 1400);
      this.cue('roll', open0(this) + 0, open0(this) + u, () => { this.say(this.line('roll'), 0, now); this.A.setPose('point', 1600, now); this.setCrowd('cheer', rollMs + 800, now); });
      this.cue('rollmore', open0(this) + moreAt, open0(this) + u, () => { if (more) this.say(this.line('more', { n: more }), 0, now, { speak: liveNames() ? null : fill(nameless(this.lines().more), { title: this.title }) }); });
      s.T = u; s.k = u / Math.max(1, rollMs);
      // An intro can draw its own roll call (doodle portraits, the couch, …):
      //   roll(g, s, featured, u, per, { more, title, theme }) in the 1920×1080 world; u = ms into it.
      if (typeof this.I.roll === 'function') {
        let ok = true;
        g0(g, s, () => { try { this.I.roll(g, s, F, u, per, { more, title: this.I.title || this.title, theme: th }); } catch (e) { console.error(e); ok = false; } });
        if (ok) return;
      }
      g0(g, s, () => { s.cam(960, 560, 1.02); this.I.stage(g, s, { host: false, bare: true, logo: 0, lights: 0.7, spots: 0.6 }); g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(-600, -300, 3120, 1700); });
      const cols = n <= 6 ? n : Math.ceil(n / 2), rows = Math.ceil(n / cols), tw = Math.min(260, 1600 / Math.max(1, cols)), th2 = rows > 1 ? 300 : 360;
      g0(g, s, () => {
        text(g, (this.I.title || this.title).toUpperCase(), 960, 130, 64, th.accent3 || '#ffd23f', { stroke: OUT, lw: 12, max: 1500 });
        text(g, 'TONIGHT’S CAST', 960, 205, 40, '#fff', { stroke: OUT, lw: 8 });
        F.forEach((c, i) => {
          const at = i * per, k = back((u - at) / 380); if (k <= 0) return;
          const col = i % cols, row = Math.floor(i / cols), rowN = row === rows - 1 ? n - row * cols : cols;
          const x = 960 + (col - (rowN - 1) / 2) * tw, y = (rows > 1 ? 420 : 560) + row * th2;
          g.save(); g.translate(x, y); g.scale(k, k);
          rr(g, -tw * 0.44, -110, tw * 0.88, 230, 26); g.fillStyle = 'rgba(14,8,32,0.85)'; g.fill(); g.lineWidth = 7; g.strokeStyle = c.color || th.accent; g.stroke();
          drawFace(g, c, 0, -30 + Math.sin(s.t * 4 + i) * 5, Math.min(130, tw * 0.55));
          text(g, c.name, 0, 78, 38, '#fff', { stroke: OUT, lw: 7, max: tw * 0.8 });
          g.restore();
        });
        if (more && u > moreAt) text(g, `…and ${more} more!`, 960, 1000, 54, th.accent3 || '#ffd23f', { stroke: OUT, lw: 10 });
      });
      g0(g, s, () => s.backs(-60, 980, 2040, 110));
    }
    // ---- the outro (both modes): optional "everyone else" wall, then "Let's play!" ----
    outro(u, now, dur) {
      const g = this.g, s = this.s, th = this.theme, others = this.show.others || [];
      const wall = this.mode === 'facts' && others.length ? (this.show.wallMs != null ? this.show.wallMs : Math.min(2600, dur * 0.45)) : 0;
      const base = 'out';
      if (u < wall) {
        this.cue(base + 'wall', 0, u, () => { sfx('chime'); this.say(this.line('others'), wall - 200, now); this.setCrowd('cheer', wall, now); });
        s.T = u; s.k = u / wall;
        g0(g, s, () => { s.cam(960, 540, 1); this.I.stage(g, s, { host: false, bare: true, logo: 0, lights: 0.6 }); g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(-600, -300, 3120, 1700); });
        g0(g, s, () => this.wall(others, u));
        g0(g, s, () => s.backs(-60, 960, 2040, 130));
        return 'wall';
      }
      const v = u - wall, len = Math.max(1200, dur - wall);
      this.cue(base + 'play', wall, u, () => {
        sfx('win'); this.say(this.line('play'), Math.min(2600, len - 400), now); this.A.setPose('cheer', len, now); this.setCrowd('cheer', len, now);
        const col = th.confetti || GEN_THEME.confetti; for (const x of [260, 960, 1660]) this.conf.burst(x, -20, 70, col, 0.8);
      });
      this.cue(base + 'pop2', wall + Math.min(1100, len * 0.35), u, () => { sfx('cheer'); const col = th.confetti || GEN_THEME.confetti; this.conf.burst(560, 1000, 50, col, 1.3); this.conf.burst(1360, 1000, 50, col, 1.3); });
      const swoop = ease(ss(len - 1200, len - 100, v));
      s.T = v; s.k = v / len;
      g0(g, s, () => { s.cam(lerp(1060, 960, ease(v / 800)), lerp(600, 250, swoop), lerp(1.12, 6, swoop * swoop)); this.I.stage(g, s, { spots: 1 }); });
      g0(g, s, () => s.backs(-60, 950 + swoop * 300, 2040, 140));
      const k = back((v - 200) / 500);
      if (k > 0 && swoop < 0.6) g0(g, s, () => { g.globalAlpha = 1 - swoop / 0.6; g.translate(960, 560); g.rotate(-0.04); g.scale(k, k); text(g, 'LET’S PLAY!', 0, 0, 170, th.accent3 || '#ffd23f', { stroke: OUT, lw: 22 }); });
      const fade = ss(len - 500, len, v); if (fade > 0) g0(g, s, () => { g.fillStyle = th.fade || '#000'; g.globalAlpha = fade; g.fillRect(-500, -500, 2920, 2080); });
      return 'play';
    }
    wall(list, u) {
      const g = this.g, th = this.theme, n = list.length;
      text(g, 'AND EVERYONE ELSE!', 960, 150, 84, th.accent3 || '#ffd23f', { stroke: OUT, lw: 14 });
      const cols = Math.ceil(Math.sqrt(n * 2.4)), rows = Math.ceil(n / cols), tile = Math.min(1600 / cols, 700 / rows);
      list.forEach((p, i) => {
        const k = back((u - i * 30) / 350); if (k <= 0) return;
        const x = 960 + ((i % cols) - (cols - 1) / 2) * tile, y = 270 + tile / 2 + Math.floor(i / cols) * tile;
        g.save(); g.translate(x, y); g.scale(k, k);
        rr(g, -tile * 0.45, -tile * 0.45, tile * 0.9, tile * 0.9, tile * 0.12); g.fillStyle = 'rgba(14,8,32,0.9)'; g.fill(); g.lineWidth = Math.max(3, tile * 0.04); g.strokeStyle = p.color || th.accent; g.stroke();
        drawFace(g, p, 0, -tile * 0.09, tile * 0.46);
        text(g, p.name, 0, tile * 0.28, Math.max(12, tile * 0.16), '#fff', { max: tile * 0.82 });
        g.restore();
      });
    }
  }
  const open0 = (I) => (I.show.openMs || 7000);
  function g0(g, s, fn) { g.save(); g.setTransform(s.base[0], 0, 0, s.base[0], s.base[1], s.base[2]); try { fn(); } catch (e) { if (loop.errs++ < 5) console.error(e); } g.restore(); }
  function hexA(hex, a) { const n = parseInt(String(hex || '#ffd23f').slice(1), 16); if (!Number.isFinite(n)) return `rgba(255,210,63,${a})`; return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; }

  let current = null;
  B.showIntro = function (el, show) {
    if (!el || !show) return;
    try {
      if (!current || current.el !== el || !el.isConnected) current = new Intro(el, show);
      else current.update(show);
    } catch (e) { console.error(e); }
  };

  // =================================================================================
  // In-game studio frame (Price Panic, JustBid): set behind, host at a podium in a slot,
  // audience along the bottom, confetti in front. The game morphs its HTML into .content.
  // =================================================================================
  class Frame {
    constructor(el, key) {
      this.el = el; this.key = key;
      el.innerHTML = `<div class="st-frame st-${esc(key)}"><canvas class="st-bg"></canvas><div class="st-content"></div><canvas class="st-crowd"></canvas><canvas class="st-fx"></canvas></div>`;
      this.root = el.firstElementChild; this.content = this.root.querySelector('.st-content');
      [this.bg, this.cr, this.fx] = ['.st-bg', '.st-crowd', '.st-fx'].map((q) => this.root.querySelector(q));
      this.cam = document.createElement('div'); this.cam.className = 'st-cam';
      this.cam.innerHTML = '<canvas></canvas><div class="st-sub"><b></b><span></span></div>';
      this.camCv = this.cam.querySelector('canvas'); this.subEl = this.cam.querySelector('.st-sub'); this.subSpan = this.subEl.querySelector('span');
      this.aud = makeAudience(hash(key)); this.backsM = makeBacks(hash(key) + 11); this.conf = new Confetti(180);
      this.crowd = 'idle'; this.crowdUntil = 0; this.pending = null; this.lastSpoke = -1e9; this.subUntil = 0; this.n = 0; this.fxLive = false;
      this.s = null; this.setIntro(); need(key, () => this.setIntro());
      try { if (B.voice.preload) B.voice.preload(key); } catch { /* no clips */ }
      addLoop(this);
    }
    setIntro() { const I = introFor(this.key); if (I === this.I) return; this.I = I; this.theme = themeOf(I); this.A = new HostAnim(I.host || {}); this._draw = null; this.subEl.querySelector('b').textContent = I.host ? I.host.name : ''; }
    hostDraw() { if (!this._draw) { const H = this.I.host || {}; this._draw = H.draw ? H.draw.bind(H) : makeHost(H.look || intros.generic.host.look); } return this._draw; }
    attach() { const slot = this.content.querySelector('.st-slot'); if (slot && this.cam.parentNode !== slot) slot.appendChild(this.cam); }
    alive() { return this.root.isConnected; }
    // o: { line, mood ('cheer'|'clap'|'groan'|'gasp'|'laugh'), moodMs, pose, poseMs, confetti, prio (0..4), speak }
    react(o) { const p = o.prio == null ? 1 : o.prio; if (!this.pending || p >= this.pending.prio) this.pending = { ...o, prio: p }; else if (o.mood && !this.pending.mood) this.pending.mood = o.mood; }
    burst(n = 70) { const w = this.fx.clientWidth || 1200, col = this.theme.confetti || GEN_THEME.confetti; for (const x of [w * 0.2, w * 0.5, w * 0.8]) this.conf.burst(x, -10, Math.round(n / 3), col, 0.7); }
    flush(now) {
      const p = this.pending; this.pending = null;
      if (p.mood) { this.crowd = p.mood; this.crowdUntil = now + (p.moodMs || 2600); }
      if (p.pose) this.A.setPose(p.pose, p.poseMs || 1700, now);
      if (p.confetti) this.burst();
      // Big moments always speak; other lines speak at most every 3 s; small ones are subtitles only.
      const speak = p.speak !== false && p.prio >= 2 && (p.prio >= 3 || now - this.lastSpoke > 3000);
      if (p.line && (speak || p.prio >= 2 || now > this.A.talkUntil)) {
        if (speak) this.lastSpoke = now;
        // Queued behind a line still playing; a reaction that waited too long is dropped (stale).
        const est = speak ? Speech.say(p.line, this.I.host && this.I.host.voice, p.fit || 3200, { maxWait: p.prio >= 3 ? 6000 : 3500 }) : Speech.clean(p.line).length * 60 + 600;
        this.A.talk(now, est); this.subSpan.textContent = p.line; this.subEl.classList.add('on'); this.subUntil = now + est + 1800;
      }
    }
    ctx(g, base) {
      this.ss = this.ss || new Map();
      if (!this.ss.has(g)) this.ss.set(g, makeCtx(this, g)); // one per canvas: the helpers draw on their own context
      const s = this.ss.get(g); s.base = base; s.intro = this.I; s.theme = this.theme; s.crowd = this.crowd; s.mode = 'game'; s.title = this.I.title || '';
      return s;
    }
    frame(now, dt) {
      if (this.pending) this.flush(now);
      if (now > this.crowdUntil) this.crowd = 'idle';
      if (this.subUntil && now > this.subUntil) { this.subEl.classList.remove('on'); this.subUntil = 0; }
      const t = now / 1000;
      // The set: half resolution (soft, like a lens focused on the game) at 30 fps.
      if ((this.n++ & 1) === 0) {
        const { w, h, d } = fit(this.bg, 0.5), g = this.bg.getContext('2d'), sc = Math.max(w / 1920, h / 1080) * d;
        const s = this.ctx(g, [sc, (w * d - 1920 * sc) / 2, (h * d - 1080 * sc) / 2]); s.t = t; s.now = now; s.T = 0; s.k = 0;
        g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = this.theme.fade || '#000'; g.fillRect(0, 0, this.bg.width, this.bg.height);
        g0(g, s, () => this.I.stage(g, s, { host: false, bare: true, spots: 0.55, logo: 0, game: true }));
      }
      { // the crowd strip
        const { w, h, d } = fit(this.cr, 1.5), g = this.cr.getContext('2d');
        g.setTransform(d, 0, 0, d, 0, 0); g.clearRect(0, 0, w, h);
        const s = this.ctx(g, [d, 0, 0]); s.t = t;
        backs(g, this.theme, this.backsM, t, -20, 0, w + 40, h, this.crowd);
      }
      if (this.cam.isConnected) {
        const { w, h, d } = fit(this.camCv, 2), g = this.camCv.getContext('2d');
        g.setTransform(d, 0, 0, d, 0, 0); g.clearRect(0, 0, w, h);
        const s = this.ctx(g, [d, 0, 0]); s.t = t; s.now = now;
        const cx = w / 2, py = h * 0.8, sc = (py - 8) / 415;
        g.save(); g.globalCompositeOperation = 'lighter';
        const rg = g.createRadialGradient(cx, h * 0.45, 4, cx, h * 0.45, h * 0.62); rg.addColorStop(0, 'rgba(255,240,210,0.28)'); rg.addColorStop(1, 'rgba(255,240,210,0)');
        g.fillStyle = rg; g.fillRect(0, 0, w, h); g.restore();
        g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.ellipse(cx, h - 4, w * 0.42, 14, 0, 0, TAU); g.fill();
        s.hostAt(cx, py, sc);
        g.fillStyle = '#ff3b3b'; rr(g, 8, 8, 52, 22, 6); g.fill(); text(g, 'LIVE', 34, 20, 15, '#fff', { font: BODY });
      }
      if (this.conf.alive || this.fxLive) {
        const { w, h, d } = fit(this.fx, 1), g = this.fx.getContext('2d');
        g.setTransform(d, 0, 0, d, 0, 0); g.clearRect(0, 0, w, h); this.conf.step(g, dt); this.fxLive = this.conf.alive;
      }
    }
  }
  // =================================================================================
  // A lobby inside the game's world: BOX.studio.lobby(el, lobby, opts), for a game's lobbyTv.
  // Builds once, then patches: the selects keep focus. The set (intro.stage) animates behind.
  // opts: { key, title (html), tagline, icons: { fieldKey: emoji }, setTitle, joinTitle,
  //         startLabel, crowdTitle, door (bool: a roll-up door opens over the settings) }
  // Keeps the ids the tests use: #code, img#qr, #settings select[data-set], #roster .chip, #add-bots, #start.
  // =================================================================================
  class LobbyBg {
    constructor(cv, key) { this.cv = cv; this.key = key; this.n = 0; this.aud = makeAudience(hash(key)); this.backsM = makeBacks(hash(key) + 5); this.crowd = 'idle'; this.set(); need(key, () => this.set()); addLoop(this); }
    set() { const I = introFor(this.key); if (I === this.I) return; this.I = I; this.theme = themeOf(I); this.A = new HostAnim(I.host || {}); this._draw = null; this.s = null; }
    hostDraw() { if (!this._draw) { const H = this.I.host || {}; this._draw = H.draw ? H.draw.bind(H) : makeHost(H.look || intros.generic.host.look); } return this._draw; }
    alive() { return this.cv.isConnected; }
    frame(now) {
      if ((this.n++ & 1) === 1) return; // 30 fps is plenty for a backdrop
      const { w, h, d } = fit(this.cv, 0.75), g = this.cv.getContext('2d'), sc = Math.max(w / 1920, h / 1080) * d;
      if (!this.s) this.s = makeCtx(this, g);
      const s = this.s; s.base = [sc, (w * d - 1920 * sc) / 2, (h * d - 1080 * sc) / 2]; s.t = now / 1000; s.now = now; s.intro = this.I; s.theme = this.theme; s.title = this.I.title || ''; s.crowd = 'idle';
      if ((now / 1000) % 9 < 0.05) this.A.setPose('wave', 1800, now);
      g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = this.theme.fade || '#000'; g.fillRect(0, 0, this.cv.width, this.cv.height);
      g0(g, s, () => { s.cam(960, 560, 1.02); this.I.stage(g, s, { host: false, spots: 0.6, logo: 0 }); g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(-600, -300, 3120, 1700); });
    }
  }
  function lobby(el, L, o) {
    let st = el._sl;
    if (!st || !el.contains(st.root)) {
      el.innerHTML = `<div class="sl-lobby sl-${esc(o.key)}"><canvas class="sl-bg"></canvas>
        <div class="sl-grid">
          <header class="sl-head"><div class="sl-title">${o.title}</div><div class="sl-tag">${esc(o.tagline || '')}</div></header>
          <section class="sl-set"><div class="sl-box"><div class="sl-boxhead">${esc(o.setTitle || 'Settings')}</div><div class="sl-items" id="settings"></div>${o.door ? '<div class="sl-door"><span></span></div>' : ''}</div></section>
          <aside class="sl-join"><div class="sl-jt">${esc(o.joinTitle || 'Join on your phone!')}</div><img id="qr" alt="QR code to join"><div class="sl-cl">Room code</div><div class="sl-code" id="code"></div>
            <div class="sl-url" id="url"></div><div class="sl-vip" id="vip"></div><div class="sl-err" id="lobby-err"></div>
            <button class="sl-start" id="start">${esc(o.startLabel || 'Start the show!')}</button>
            <div class="sl-links"><button id="add-bots">+ 5 test bots</button><button id="rm-bots">remove bots</button><button id="sl-pick">🎮 Another game</button><button id="sl-back">◀ Games</button></div></aside>
          <footer class="sl-crowd"><div class="sl-ct"><span id="count"></span></div><div class="sl-lineup" id="lineup"></div><div class="sl-roster" id="roster"></div></footer>
        </div></div>`;
      st = el._sl = { root: el.firstElementChild, L, fsig: '', psig: '', lsig: '' };
      new LobbyBg(st.root.querySelector('.sl-bg'), o.key);
      const $ = (q) => st.root.querySelector(q);
      $('#start').onclick = async () => { const r = await st.L.start(); $('#lobby-err').textContent = r && r.ok ? '' : (r && r.error) || 'Could not start the game.'; if (r && r.ok) sfx('start'); };
      $('#add-bots').onclick = () => st.L.bots(5); $('#rm-bots').onclick = () => st.L.removeBots();
      $('#sl-pick').onclick = () => st.L.pick(); $('#sl-back').onclick = () => st.L.back();
    }
    st.L = L;
    const $ = (q) => st.root.querySelector(q);
    if ($('#code').textContent !== L.code) $('#code').textContent = L.code;
    if ($('#qr').dataset.u !== L.joinUrl) { $('#qr').src = L.qr; $('#qr').dataset.u = L.joinUrl; }
    $('#url').textContent = String(L.joinUrl || '').replace(/^https?:\/\//, '');
    $('#vip').innerHTML = L.vip ? `👑 <b>${esc(L.vip)}</b> is the host and can start from their phone` : 'The first person to join becomes the host 👑';
    const n = L.players.length;
    $('#count').textContent = n ? `${n} player${n === 1 ? '' : 's'} in · ${o.crowdTitle || 'tonight’s contestants'}` : 'Waiting for players… scan the code!';
    $('#start').disabled = n < (L.min || 1);
    // Settings: one item per field, a real <select> laid over it (click the item to choose).
    const fsig = JSON.stringify(L.fields.map((f) => [f.key, f.label, f.options.map((x) => [x.value, x.label])]));
    const box = $('#settings');
    if (fsig !== st.fsig) {
      st.fsig = fsig;
      box.innerHTML = L.fields.map((f, i) => `<label class="sl-item" style="--i:${i}" data-k="${esc(f.key)}"><span class="sl-ic">${esc((o.icons && o.icons[f.key]) || '⚙️')}</span><b>${esc(f.label)}</b><span class="sl-val"></span>
        <select data-set="${esc(f.key)}" aria-label="${esc(f.label)}">${f.options.map((x) => `<option value="${esc(String(x.value))}">${esc(x.label)}</option>`).join('')}</select></label>`).join('');
      for (const s of box.querySelectorAll('select')) s.onchange = () => { s.blur(); sfx('click'); st.L.set(s.dataset.set, s.value); const v = s.closest('.sl-item').querySelector('.sl-val'); v.textContent = s.options[s.selectedIndex] ? s.options[s.selectedIndex].text : ''; };
    }
    for (const f of L.fields) {
      const it = box.querySelector(`[data-k="${CSS.escape(f.key)}"]`); if (!it) continue;
      const s = it.querySelector('select'), cur = String(L.settings[f.key]);
      if (document.activeElement !== s && s.value !== cur) s.value = cur;
      const opt = f.options.find((x) => String(x.value) === cur);
      const v = it.querySelector('.sl-val'), txt = opt ? opt.label : cur; if (v.textContent !== txt) v.textContent = txt;
    }
    const lh = L.lineupHtml || ''; if (lh !== st.lsig) { st.lsig = lh; $('#lineup').innerHTML = lh; }
    const psig = JSON.stringify(L.players.map((p) => [p.id, p.name, p.avatar, p.color, p.online]));
    if (psig !== st.psig) {
      const fresh = new Set(L.players.map((p) => p.id)); const old = st.ids || new Set();
      st.psig = psig; st.ids = fresh;
      $('#roster').innerHTML = L.players.map((p, i) => `<span class="chip sl-p ${p.online ? '' : 'off'} ${old.has(p.id) ? '' : 'new'}" style="--c:${esc(p.color || '#ffd23f')};--d:${(i % 7) * 0.13}s" data-kick="${esc(p.id)}" title="Click to remove"><i class="sl-pad">${B.face ? B.face(p, 80, { fill: true }) : esc(p.avatar || '🙂')}</i><span class="sl-pn">${esc(p.name)}</span></span>`).join('') || `<span class="sl-empty">${esc(o.emptyCrowd || 'Nobody here yet. Scan the code!')}</span>`;
      for (const c of $('#roster').querySelectorAll('[data-kick]')) c.onclick = () => { if (confirm('Remove this player?')) st.L.kick(c.dataset.kick); };
    }
  }

  const frames = new WeakMap();
  function frame(el, key) {
    let F = frames.get(el);
    if (!F || F.key !== key || el.firstElementChild !== F.root) { F = new Frame(el, key); frames.set(el, F); }
    return F;
  }

  B.studio = {
    intro: (key) => { need(key); return introFor(key); }, need, makeHost, HostAnim, Confetti, frame, lobby,
    say: Speech.say, stop: Speech.stop, nameless,
    draw: { podium, spots, sign, audience, backs, floor, emoji: drawEmoji, face: drawFace, body: drawBody, text, rr, wrap },
    util: { clamp, lerp, ss, ease, easeOut, back, rng, hash, shade, hexA, OUT, FONT, BODY, TAU },
  };
})();
