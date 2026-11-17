'use strict';
// Haptics for every phone page (JustMafia and every JustGameBox game).
// - Every navigator.vibrate(...) call in the games goes through here, so one switch turns
//   vibration off everywhere ('haptics' in localStorage).
// - Android: the Vibration API. iPhone (iOS 18+): Safari has no Vibration API, but toggling a
//   switch control plays the system haptic, so a hidden switch is clicked instead (this only
//   works while the player is touching the screen, which covers taps and button presses).
// - Every tap on a button gets a light tick.
// HAPTIC.play(kind) with kind: tap, select, success, error, turn, win, buzz, warn, or a pattern.
(function () {
  const PATTERNS = { tap: 8, select: 14, success: [20, 40, 30], error: [40, 30, 40], turn: [30, 50, 30, 50, 70], win: [40, 60, 40, 60, 140], buzz: 60, warn: [15, 30, 15], big: [80, 50, 120] };
  const native = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function' ? navigator.vibrate.bind(navigator) : null;
  let enabled = true;
  try { enabled = localStorage.getItem('haptics') !== 'off'; } catch { /* private mode */ }
  // iPhone fallback: a hidden <input type="checkbox" switch>; clicking its label ticks.
  let iosLabel = null;
  const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  function iosTick() {
    try {
      if (!iosLabel) {
        iosLabel = document.createElement('label'); iosLabel.setAttribute('aria-hidden', 'true');
        iosLabel.style.cssText = 'position:fixed;left:-100px;top:-100px;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none';
        const input = document.createElement('input'); input.type = 'checkbox'; input.setAttribute('switch', ''); input.tabIndex = -1;
        iosLabel.appendChild(input); document.body.appendChild(iosLabel);
      }
      const was = document.activeElement;
      iosLabel.click();
      if (was && was !== document.body && was !== document.activeElement && was.focus) was.focus({ preventScroll: true }); // never steal the keyboard
    } catch { /* no haptics */ }
  }
  function vibrate(p) {
    if (!enabled) return false;
    if (native) { try { return native(p); } catch { return false; } }
    if (isIOS) {
      // A pattern becomes a few ticks (each one needs the touch that is still in progress).
      const n = Array.isArray(p) ? Math.min(3, Math.ceil(p.length / 2)) : 1;
      for (let i = 0; i < n; i++) setTimeout(iosTick, i * 90);
      return true;
    }
    return false;
  }
  const HAPTIC = {
    play(kind) { return vibrate(PATTERNS[kind] != null ? PATTERNS[kind] : kind); },
    tap() { return vibrate(PATTERNS.tap); },
    get enabled() { return enabled; },
    set(on) { enabled = !!on; try { localStorage.setItem('haptics', on ? 'on' : 'off'); } catch { /* */ } if (on) vibrate(PATTERNS.success); },
    supported: !!native || isIOS,
  };
  window.HAPTIC = HAPTIC;
  // Route every existing navigator.vibrate call through the switch (and the iPhone fallback).
  try { Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true, writable: true }); } catch { /* read-only: games still work */ }
  // A light tick on every button press.
  const TAPPABLE = 'button, a[href], [role="button"], .chip, .tile, summary, select, label, [data-tap]';
  document.addEventListener('pointerdown', (e) => {
    const t = e.target && e.target.closest && e.target.closest(TAPPABLE);
    if (t && !t.disabled && !t.closest('[data-no-haptic]')) vibrate(PATTERNS.tap);
  }, { capture: true, passive: true });
})();
