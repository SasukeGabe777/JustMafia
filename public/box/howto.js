'use strict';
// How to play: the tutorial that follows every intro cutscene (server: box/show.js 'howto' step).
// The TV walks through the game's rules one step at a time while every phone shows the same
// step with a "Got it" button. Steps come from the game's intro file:
//   BOX.intros.<key>.tutorial = [
//     { icon: '🗳️', title: 'Vote', text: 'Pick who fits the prompt best.', phone: 'Tap a name on your phone.', say: 'optional narrator line' },
//     …up to 8 steps (match the module's howSteps; default 5)
//   ]
// or, if it has none, the game's `how` list (BOX.games.<key>.how).
// BOX.showHowto(el, show, ctx) draws it on the TV; BOX.howtoSteps(key) gives the steps (phones use it too).
(function () {
  const { esc } = BOX;
  function howtoSteps(key) {
    const I = BOX.intros && BOX.intros[key], G = BOX.games[key] || {};
    if (I && Array.isArray(I.tutorial) && I.tutorial.length) return I.tutorial.slice(0, 8);
    return (G.how || []).slice(0, 8).map((t, i) => ({ icon: ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣'][i], title: `Step ${i + 1}`, text: t, phone: null }));
  }
  // Which step is showing: the server's steps are evenly timed; extra steps share the time.
  function stepAt(show, steps, at) {
    const n = Math.max(1, steps.length), slot = (show.howStepMs || 7500) * Math.max(1, Math.min(8, show.howSteps || 5)) / n;
    const t = (show.stepAgo || 0) + (Date.now() - at);
    return { i: Math.min(n - 1, Math.floor(t / slot)), done: t >= slot * n, slot, t };
  }
  const st = { el: null, key: null, at: 0, show: null, said: -1, raf: 0 };
  // fitMs: the time the step gives the line (a pre-rendered voice clip plays a little faster to fit).
  function speak(text, fitMs) {
    try {
      const I = BOX.intros && BOX.intros[st.key], spec = I && I.host && I.host.voice;
      if (BOX.voice && BOX.voice.speak) BOX.voice.speak(text, { ...(spec || {}), fitMs });
      else if (window.speechSynthesis) { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); u.rate = 1.02; speechSynthesis.speak(u); }
    } catch { /* no voice */ }
  }
  function frame() {
    if (!st.el || !document.body.contains(st.el)) { st.el = null; return; }
    const show = st.show, steps = howtoSteps(st.key), G = BOX.games[st.key] || {}, I = (BOX.intros && BOX.intros[st.key]) || {};
    const { i, done, slot } = stepAt(show, steps, st.at), s = steps[i] || {};
    if (st.el.dataset.i !== String(i) || st.el.dataset.done !== String(done)) {
      st.el.dataset.i = String(i); st.el.dataset.done = String(done);
      const th = I.theme || {};
      st.el.style.setProperty('--ht-a', th.accent || '#ffd23f'); st.el.style.setProperty('--ht-b', th.accent2 || '#ff4f9a'); st.el.style.setProperty('--ht-c', th.accent3 || '#3ee6ff');
      BOX.morph(st.el.querySelector('.ht-body'), done
        ? `<div class="ht-go"><div class="ht-go-icon">${esc(G.icon || '🎮')}</div><h2>That’s it. Let’s play!</h2></div>`
        : `<div class="ht-card" id="ht-card-${i}">
            <div class="ht-step"><span class="ht-num">${i + 1}</span><span class="ht-of">of ${steps.length}</span></div>
            <div class="ht-main"><div class="ht-icon">${esc(s.icon || '👉')}</div><div><h2>${esc(s.title || '')}</h2><p>${esc(s.text || '')}</p></div></div>
            ${s.phone ? `<div class="ht-phone"><div class="ht-ph"><div class="ht-ph-notch"></div><div class="ht-ph-screen"><span>📱</span><b>${esc(s.phone)}</b></div></div><div class="ht-ph-label">On your phone</div></div>` : ''}
          </div>`);
      st.el.querySelector('.ht-dots').innerHTML = steps.map((_, k) => `<i class="${k < i || done ? 'past' : k === i ? 'on' : ''}"></i>`).join('');
      if (!done && st.said !== i) { st.said = i; speak(s.say || [s.title, s.text, s.phone].filter(Boolean).join('. '), slot - 400); BOX.sfx('pop'); }
      if (done && st.said !== 99) { st.said = 99; speak('That’s it. Let’s play!'); }
    }
    st.raf = requestAnimationFrame(frame);
  }
  function showHowto(el, show, ctx) {
    const key = show.game;
    try { const I = BOX.intros && BOX.intros[key]; if (I && I.onShow) I.onShow(show); } catch { /* the default steps */ } // e.g. YesChef: the kitchen's own steps
    if (st.el !== el || st.key !== key || !el.querySelector('.ht')) {
      el.innerHTML = `<div class="ht"><div class="ht-bg"></div><header class="ht-head"><span class="ht-tag">HOW TO PLAY</span><h1>${esc((BOX.games[key] || {}).icon || '')} ${esc(show.title || '')}</h1></header>
        <div class="ht-body"></div><footer class="ht-foot"><div class="ht-dots"></div><div class="ht-ready" id="ht-ready"></div></footer></div>`;
      st.el = el.querySelector('.ht'); st.key = key; st.said = -1;
      cancelAnimationFrame(st.raf); st.raf = requestAnimationFrame(frame);
    }
    st.show = show; st.at = Date.now();
    const r = el.querySelector('#ht-ready');
    if (r) r.innerHTML = show.readyOf ? `✓ <b>${show.ready}</b> of ${show.readyOf} got it · tap <b>Got it</b> on your phone to start sooner` : '';
  }
  BOX.showHowto = showHowto;
  BOX.howtoSteps = howtoSteps;
  BOX.howtoStepAt = stepAt;
})();
