'use strict';
/* =====================================================================================
   JustGameBox NARRATOR VOICE (public/box/voice.js) -> window.BOX.voice
   =====================================================================================
   Load it on the TV after show.js (show.js installs the browser speechSynthesis voice
   first; this file wraps it). Every host line goes through BOX.voice.speak(text, spec),
   where spec is the intro's host.voice ({ like, accent, pitch, rate, kokoro, speed }).

   Each line is spoken by the first of these that is ready within DEADLINE ms, so the
   cutscene never waits on a voice:
     1. clip      a pre-rendered Kokoro clip (tools/voice-gen.js, `npm run voices`):
                  public/audio/voice/<game>/<hash>.webm, listed in manifest.json. The hash
                  is of the Kokoro voice + speed + the cleaned text (keyOf below). Always on,
                  no download beyond the small clips themselves.
     2. live      lines with names or fun facts, generated on the fly by kokoro-js in a Web
                  Worker (public/box/voice-worker.js, WebGPU only). Off by default: the 🔊
                  panel's "Natural live voice" toggle turns it on (localStorage 'box.voice.live')
                  and only then is kokoro-js and the model (~160 MB, cached) downloaded.
     3. fallback  the browser's speechSynthesis voice chosen by show.js.
   spec.kokoro picks the Kokoro voice (e.g. 'am_fenrir'), spec.speed its speed (default 1).
   A spec without kokoro (narrators, intros with no host) uses NARRATOR.

   Lines are QUEUED, never cut off: a new line waits until the one playing has finished (stale
   waiting lines are dropped instead, see speak's options). Clips play at their natural speed; the
   intro/how-to schedule on the server is built from the clip lengths (box/narration.js). Only
   stop() (the host's Skip) cuts a line short. Every line is let go after its length + TAIL even if
   the audio never reports its end, so narration can never block.

   API
     BOX.voice.speak(text, spec, { maxWait, key, interrupt, onstart }) -> Promise (resolves when the line ends)
     stop()  cut the current line and clear the queue     pending() -> { busy, waiting }
     BOX.voice.preload(gameKey)   fetch a game's clips ahead of the cutscene
     BOX.voice.prepare(text, spec)  warm the live cache for a dynamic line (if live is on)
     BOX.voice.clipMs(text, spec) -> how long the clip plays (ms) or 0 if there is none; estMs(text, spec) the browser-voice guess
     BOX.voice.live / setLive(on) / liveStatus()   the live-voice setting
     BOX.voice.clean(text), spoken(text), keyOf(text, spec), voiceOf(spec)  (shared with the generator)
     BOX.voice.log   the last lines spoken: { at, path: 'clip'|'live'|'fallback', text, lag }
   ===================================================================================== */
(function () {
  const W = window;
  if (!W.BOX) return;
  const B = W.BOX;
  B.voice = B.voice || {};
  if (B.voice.engine === 'kokoro') return; // loaded twice
  const prev = { speak: B.voice.speak, stop: B.voice.stop };
  const DEADLINE = 1200;
  const NARRATOR = { kokoro: 'bf_emma', speed: 1.0 };
  // The line queue (see speak): a line waits for the one playing instead of cutting it off.
  const MAX_WAIT = 6000; // a queued line older than this when its turn comes is dropped (stale)
  const MAX_PENDING = 3; // more waiting than this: the oldest waiting line is dropped
  const TAIL = 2500; // a line that never reports its end is let go this long after it should have ended
  const ROOT = '/audio/voice/';
  const LIVE_KEY = 'box.voice.live';
  const KOKORO_URL = 'https://cdn.jsdelivr.net/npm/kokoro-js@1.2.1/dist/kokoro.web.js';
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const now = () => performance.now();

  // Same cleaning as show.js's Speech.clean (show.js cleans before speaking; howto.js does not).
  const clean = (s) => String(s || '').replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}\u{20E3}]/gu, '').replace(/["“”]/g, '').replace(/\s+/g, ' ').trim();
  // What the TTS model reads: symbols spelled out, no emoji, no SHOUTED words read as letters.
  // (Changing spoken() re-voices nothing by itself: clips are keyed by clean(), so re-render with --force.)
  const KEEP_CAPS = new Set(['TV', 'DJ', 'VIP', 'ID', 'USA', 'UK', 'DNA', 'UFO', 'FM', 'XP']);
  function spoken(s) {
    return clean(s)
      .replace(/\bJust(?=[A-Z][a-z])/g, 'Just ').replace(/\b([A-Z][a-z]+)([A-Z][a-z]+)\b/g, '$1 $2') // JustBid, TikTok: two words
      .replace(/(\w)!\s+(?=[a-z])/g, '$1 ') // "snap! magazine": no full stop mid-name
      .replace(/\s+=\s+/g, ' means ').replace(/\s*·\s*/g, ', ').replace(/\s\+\s/g, ' plus ').replace(/\b0:00\b/g, 'zero').replace(/\bvs\.?(?=\s)/g, 'versus')
      .replace(/(\d) s\b/g, '$1 seconds').replace(/(^|\s)%(?=[\s.,!?]|$)/g, '$1percent')
      .replace(/\s*↔\s*/g, ' or ').replace(/\p{Extended_Pictographic}/gu, '').replace(/[←-⇿⌀-⏿─-◿│⌫]/g, ' ')
      .replace(/…/g, '...').replace(/(\d)\s*×/g, '$1 times').replace(/×\s*(\d)/g, 'times $1').replace(/×/g, ' times ')
      .replace(/\+\s?(\$?\d)/g, 'plus $1').replace(/[−–]\s?(\$?\d)/g, 'minus $1').replace(/(\d)\s?%/g, '$1 percent').replace(/&/g, ' and ')
      .replace(/\b[A-Z]{2,}\b/g, (w) => (KEEP_CAPS.has(w) ? w : w.toLowerCase()))
      .replace(/\(\s*\)/g, '').replace(/\(\s+/g, '(').replace(/\s+\)/g, ')')
      .replace(/\s+([.,!?])/g, '$1').replace(/([!?])\.(?=\s|$)/g, '$1').replace(/(^|[^.])\.\.(?=\s|$)/g, '$1.').replace(/\s+/g, ' ').trim();
  }
  // 64-bit FNV-1a style hash (two 32-bit lanes) -> 16 hex chars.
  function hash(str) {
    let a = 0x811c9dc5, b = 0x5bd1e995;
    for (const ch of String(str)) { const c = ch.codePointAt(0); a = Math.imul(a ^ c, 0x01000193); b = Math.imul(b ^ c, 0x01000193); b ^= b >>> 13; }
    return (a >>> 0).toString(16).padStart(8, '0') + (b >>> 0).toString(16).padStart(8, '0');
  }
  const voiceOf = (V) => (V && V.kokoro ? { kokoro: String(V.kokoro), speed: Number(V.speed) || 1 } : NARRATOR);
  function keyOf(text, V) { const v = voiceOf(V); return hash(v.kokoro + '|' + v.speed.toFixed(2) + '|' + clean(text)); }

  // ---------- the clip manifest + a small blob cache ----------
  let manifest = null;
  const ready = (W.fetch ? fetch(ROOT + 'manifest.json', { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : null)) : Promise.resolve(null))
    .catch(() => null).then((m) => (manifest = m && m.clips ? m : { clips: {}, games: {} }));
  const blobs = new Map(); // hash -> Promise<objectURL|null>
  function fetchClip(h) {
    if (blobs.has(h)) return blobs.get(h);
    const c = manifest && manifest.clips[h]; if (!c) return Promise.resolve(null);
    const p = fetch(ROOT + c.g + '/' + h + '.webm').then((r) => (r.ok ? r.blob() : null)).then((b) => (b ? URL.createObjectURL(b) : null)).catch(() => null);
    blobs.set(h, p);
    if (blobs.size > 400) { const [k, old] = blobs.entries().next().value; blobs.delete(k); old.then((u) => u && URL.revokeObjectURL(u)); }
    return p;
  }
  function preload(key) { return ready.then((m) => { for (const h of (m.games && m.games[key]) || []) fetchClip(h); }); }
  const race = (p, deadline) => Promise.race([Promise.resolve(p).catch(() => null), new Promise((r) => setTimeout(() => r(null), Math.max(0, deadline - now())))]);

  // ---------- live generation (kokoro-js in a worker, WebGPU only) ----------
  let live = (() => { try { return localStorage.getItem(LIVE_KEY) === '1'; } catch { return false; } })();
  const gpu = !!(W.navigator && navigator.gpu) && typeof W.Worker === 'function';
  let worker = null, wState = 'off', reqId = 0;
  const waits = new Map(), liveCache = new Map(); // hash -> Promise<{url, ms}|null>
  function startWorker() {
    if (worker || !gpu) return;
    try {
      worker = new Worker('/box/voice-worker.js', { type: 'module' }); wState = 'loading';
      worker.onmessage = (e) => {
        const m = e.data || {};
        if (m.type === 'ready') wState = 'ready';
        else if (m.type === 'error') { wState = 'failed'; console.warn('Natural voice unavailable:', m.error); for (const f of waits.values()) f(null); waits.clear(); }
        else if (waits.has(m.id)) { const f = waits.get(m.id); waits.delete(m.id); f(m.type === 'done' ? m : null); }
      };
      worker.onerror = (e) => { wState = 'failed'; console.warn('Natural voice worker failed', e && e.message); for (const f of waits.values()) f(null); waits.clear(); };
      worker.postMessage({ type: 'init', url: KOKORO_URL });
    } catch (e) { wState = 'failed'; console.warn(e); }
  }
  const liveUsable = () => live && gpu && wState === 'ready';
  function liveGen(t, V, h) {
    if (liveCache.has(h)) return liveCache.get(h);
    if (!liveUsable()) return Promise.resolve(null);
    const v = voiceOf(V), id = ++reqId;
    const p = new Promise((res) => { waits.set(id, res); worker.postMessage({ type: 'say', id, text: spoken(t), voice: v.kokoro, speed: v.speed }); })
      .then((m) => (m && m.blob ? { url: URL.createObjectURL(m.blob), ms: m.ms } : null));
    liveCache.set(h, p);
    p.then((r) => { if (!r) liveCache.delete(h); });
    if (liveCache.size > 40) { const [k, old] = liveCache.entries().next().value; liveCache.delete(k); old.then((r) => r && URL.revokeObjectURL(r.url)); }
    return p;
  }
  function setLive(on) {
    live = !!on;
    try { localStorage.setItem(LIVE_KEY, live ? '1' : '0'); } catch { /* private mode */ }
    if (live) startWorker();
  }
  if (live) startWorker();

  // ---------- playback ----------
  const LOG = [];
  function log(path, t, t0, why) {
    const e = { at: Math.round(now()), path, text: t.slice(0, 80), lag: Math.round(now() - t0), why: why || '' };
    LOG.push(e); if (LOG.length > 200) LOG.shift();
    try { W.dispatchEvent(new CustomEvent('box:voice', { detail: e })); } catch { /* old browser */ }
  }
  const vol = () => { try { const s = B.audio && B.audio.settings; return s ? (s.mute ? 0 : clamp(s.master, 0, 1)) : 1; } catch { return 1; } };
  const duck = (on) => { try { if (B.audio && B.audio.duck) B.audio.duck(on); } catch { /* no music */ } };
  // Clips play at their natural speed, never sped up to fit a scene: the scenes are timed to the
  // clips instead (box/narration.js on the server). A line with no clip: an estimate for the browser voice.
  function clipMs(text, V) { const c = manifest && manifest.clips[keyOf(clean(text), V)]; return c ? c.ms : 0; }
  const estMs = (t, V) => Math.round((String(t).length * 70 + 500) / clamp((V && V.rate) || 1, 0.5, 2));
  // A line that never says it ended (a stuck clip, a browser voice that hangs) is let go anyway.
  const capped = (p, ms) => Promise.race([Promise.resolve(p).catch(() => {}), new Promise((r) => setTimeout(r, ms + TAIL))]);
  let cur = null, tok = 0;
  function halt() { if (!cur) return; const c = cur; cur = null; try { c.a.pause(); c.a.removeAttribute('src'); } catch { /* gone */ } c.done(); }
  // -> null if it could not start in time (or stop() took over), else { ended: Promise }.
  async function play(url, my, deadline) {
    const a = new Audio(); a.preload = 'auto'; a.src = url;
    a.volume = vol(); a.defaultPlaybackRate = a.playbackRate = 1;
    let done; const ended = new Promise((r) => { done = r; });
    a.onended = a.onerror = () => { if (cur && cur.a === a) cur = null; done(); };
    cur = { a, done };
    // play() resolves once sound is coming out; give up at the deadline (the fallback speaks instead).
    const started = await race(a.play().then(() => true, () => false), Math.max(deadline, now() + 300));
    if (!started || my !== tok) { if (cur && cur.a === a) halt(); else try { a.pause(); } catch { /* gone */ } return null; }
    return { ended };
  }
  const onstart = (it, ms) => { try { if (it.o.onstart) it.o.onstart(ms); } catch (e) { console.warn(e); } };
  // Say one line now (its turn in the queue). Resolves when it has ended, failed, or timed out.
  async function sayNow(it, my) {
    const t = it.t, V = it.V, t0 = now(), deadline = t0 + DEADLINE;
    const m = await race(ready, deadline);
    if (my !== tok) return;
    const h = keyOf(t, V), c = m && m.clips[h];
    let url = null, ms = 0, path = 'fallback', why = '';
    if (c) { url = await race(fetchClip(h), deadline); ms = c.ms; if (url) path = 'clip'; else why = 'clip not ready'; }
    else if (live && gpu) { const r = await race(liveGen(t, V, h), deadline); if (r) { url = r.url; ms = r.ms; path = 'live'; } else why = wState === 'ready' ? 'live too slow' : 'live ' + wState; }
    else why = 'no clip';
    if (my !== tok) return;
    if (url) {
      const p = await play(url, my, deadline);
      if (my !== tok) return;
      if (p) { log(path, t, t0); onstart(it, ms); return capped(p.ended, ms); }
      why = path + ' failed to start';
    }
    log('fallback', t, t0, why);
    if (!prev.speak) return;
    const est = estMs(t, V); onstart(it, est);
    return capped(prev.speak(t, V), est);
  }
  // ---------- the line queue ----------
  // One line at a time. A new line waits for the current one to finish instead of cutting it off
  // mid-word; a line that waited longer than its maxWait is dropped (stale), and if too many pile up
  // the oldest waiting one goes. Only stop() (the host's Skip) or o.interrupt cuts a line short.
  const Q = []; let busy = false;
  function drop(it, why) { log('dropped', it.t, it.at, why); it.resolve(); }
  function pump() {
    if (busy) return;
    let it = null;
    while (Q.length) { const x = Q.shift(); if (now() - x.at <= x.maxWait) { it = x; break; } drop(x, 'stale'); }
    if (!it) { duck(false); return; }
    busy = true; const my = ++tok; duck(true);
    sayNow(it, my).catch(() => {}).then(() => {
      if (my !== tok) { it.resolve(); return; } // stop() took over (and reset the queue)
      halt(); busy = false; it.resolve(); pump();
    });
  }
  // speak(text, spec, o) -> Promise (resolves when the line ends, or is dropped / stopped).
  //  o.maxWait   ms the line may wait for its turn (default MAX_WAIT)
  //  o.key       a newer line with the same key replaces a waiting one (e.g. 'hint', 'timer')
  //  o.interrupt cut whatever is playing and clear the queue first (a hard scene change)
  //  o.onstart(ms) called when it actually starts, with how long it will take (to sync a mouth)
  function speak(text, V = {}, o = {}) {
    const t = clean(text);
    if (!t) return Promise.resolve();
    o = o || {};
    if (o.interrupt) stop();
    return new Promise((resolve) => {
      if (o.key) for (let i = Q.length - 1; i >= 0; i--) if (Q[i].o.key === o.key) drop(Q.splice(i, 1)[0], 'replaced');
      Q.push({ t, V: V || {}, o, at: now(), maxWait: o.maxWait != null ? o.maxWait : MAX_WAIT, resolve });
      while (Q.length > MAX_PENDING) drop(Q.shift(), 'queue full');
      pump();
    });
  }
  function stop() {
    tok++; busy = false;
    for (const it of Q.splice(0)) it.resolve();
    halt(); try { if (prev.stop) prev.stop(); } catch { /* none */ }
    duck(false);
  }
  const pending = () => ({ busy, waiting: Q.length });
  function prepare(text, V) {
    const t = clean(text); if (!t || !liveUsable()) return;
    ready.then((m) => { const h = keyOf(t, V); if (!m.clips[h]) liveGen(t, V, h); });
  }

  Object.assign(B.voice, {
    engine: 'kokoro', speak, stop, pending, preload, prepare, clipMs, estMs, clean, spoken, keyOf, voiceOf, hash, NARRATOR, MAX_WAIT,
    setLive, liveSupported: gpu, liveStatus: () => (!gpu ? 'unsupported' : !live ? 'off' : wState), log: LOG, ready,
  });
  Object.defineProperty(B.voice, 'live', { get: () => live, configurable: true });
  Object.defineProperty(B.voice, 'manifest', { get: () => manifest, configurable: true });
  try { const q = new URLSearchParams(location.search).get('game'); if (q) preload(q); } catch { /* fine */ }
})();
