'use strict';
// Time sources for the engine. Real games use wall-clock timers; headless
// simulations use a virtual clock that jumps straight to the next timer,
// so thousands of games run in seconds with the exact same rules.

class RealClock {
  now() { return Date.now(); }
  set(fn, ms) { return setTimeout(fn, ms); }
  clear(h) { clearTimeout(h); }
}

class VirtualClock {
  constructor() { this.t = 0; this.seq = 0; this.queue = new Map(); }
  now() { return this.t; }
  set(fn, ms) { const id = ++this.seq; this.queue.set(id, { at: this.t + Math.max(0, ms || 0), fn, id }); return id; }
  clear(id) { this.queue.delete(id); }
  // Runs the earliest timer. Returns false when nothing is scheduled.
  step() {
    let next = null;
    for (const e of this.queue.values()) if (!next || e.at < next.at || (e.at === next.at && e.id < next.id)) next = e;
    if (!next) return false;
    this.queue.delete(next.id);
    this.t = next.at;
    next.fn();
    return true;
  }
}

module.exports = { RealClock, VirtualClock };
