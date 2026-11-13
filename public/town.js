// The animated town on the big screen. Pure presentation: it receives the
// public host state + cinematic cues and animates them. No game logic here.
(function () {
  const { drawCharacter, drawGhost, drawShadowFigure, roundRect, shade } = window.MTArt;
  const ROLES = window.MT_ROLES.ROLES;
  const THEMES = (window.MT_THEMES && window.MT_THEMES.THEMES) || {};
  const FALLBACK_THEME = {
    building: 'gable', labels: { cemetery: 'CEMETERY' }, night: '10,14,42',
    palette: { grass: '#7cbf5a', grassDark: '#5c9443', road: '#dcc392', roadEdge: '#b89a63', plaza: '#d6ccb6', plazaEdge: '#a99f8b', water: '#4aa3d9', tree: '#3c8d3f', walls: ['#f4e1c1', '#f7d6d0', '#dbe8f5', '#e3f0d3', '#f3e6b3', '#e8d9f0', '#fbe3c8'], roofs: ['#c0392b', '#2e86de', '#8e44ad', '#d35400', '#16a085', '#7f5539', '#34495e', '#b03a6f'] },
  };

  const L = window.MT_LAYOUT;
  const TW = () => window.MT_THEME_WORLD || null; // Themes v2 worlds (theme-world.js)
  const { W, H, CX, CY, ROAD, SQUARE_R, CEM, POND, TAU, seeded } = L;
  // Rendering quality. HD (default): the visible view is drawn at the screen's real
  // resolution with the camera applied while drawing, so pixel art stays sharp at
  // every zoom. Retro: the classic low-res buffer (1/PIX) plus the palette filter.
  // Choose in the TV's ⚙ panel (saved per screen) or with ?pix=3 / ?pixel=1.
  const Q = new URLSearchParams(location.search);
  const storedGfx = (() => { try { return localStorage.getItem('mt.gfx'); } catch { return null; } })();
  const RETRO = Q.get('pix') ? Number(Q.get('pix')) > 1 : storedGfx === 'retro';
  const PIX = Math.max(1, Number(Q.get('pix')) || 3);
  const PIXEL_ON = Q.get('pixel') != null ? Q.get('pixel') !== '0' : RETRO;
  const HD_MAX = 1.5; // max buffer pixels per world unit (caps 4K screens at 2880x1620)
  const FONT = "'Pixelify Sans', 'Silkscreen', monospace";
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);


  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pickOne = (a) => a[Math.floor(Math.random() * a.length)];

  function distToSeg(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay;
    const t = clamp(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy), 0, 1);
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
  }

  // Spokes: paths from the square out to the ring road / cemetery / pond.
  function spokes() {
    const out = [];
    for (const a of [Math.PI * 0.25, Math.PI * 0.75, Math.PI * 1.25, Math.PI * 1.75, -Math.PI / 2, Math.PI / 2]) {
      out.push([CX + Math.cos(a) * SQUARE_R, CY + Math.sin(a) * SQUARE_R, CX + Math.cos(a) * ROAD.rx, CY + Math.sin(a) * ROAD.ry]);
    }
    out.push([CX - SQUARE_R, CY, CEM.x + CEM.w, CY]);          // to cemetery gate
    out.push([CX + SQUARE_R, CY, POND.x - POND.rx - 10, CY]);  // to pond dock
    return out;
  }

  class Town {
    constructor(canvas) {
      this.canvas = canvas;
      this.screen = canvas.getContext('2d');
      this.ctx = this.screen;
      this.bg = document.createElement('canvas');
      this.px = document.createElement('canvas');
      this.R = RETRO ? 1 / PIX : 1; // buffer pixels per world unit (set again on resize)
      this.px.width = Math.round(W * this.R); this.px.height = Math.round(H * this.R);
      // The palette filter reads pixels back; only then keep the buffer CPU-side.
      this.pctx = this.px.getContext('2d', { willReadFrequently: PIXEL_ON });
      this.cam = { ...L.SPOTS.overview };
      this.camAnim = null;
      this.held = new Set();
      this.cineDark = null;
      this.cineWindow = null;
      this.chars = new Map();
      this.seenStories = new Set();
      this.houses = [];
      this.slots = new Map();
      this.phase = 'lobby';
      this.time = 0;
      this.dark = 0; this.targetDark = 0;
      this.red = 0; this.targetRed = 0;
      this.effects = [];
      this.timeline = [];
      this.shadow = null;
      this.skipCount = 0;
      this.showSkip = false;
      this.winner = null;
      this.th = THEMES.smalltown || FALLBACK_THEME;
      this.themeId = 'smalltown';
      this.lastAcc = 0;
      this.fireflies = Array.from({ length: 45 }, () => ({ x: Math.random() * W, y: Math.random() * H, p: Math.random() * TAU, s: rnd(0.4, 1.2) }));
      this.layoutHouses(0);
      this.buildPalette();
      this.cinema = window.Cinema ? new window.Cinema(this) : null;
      this.resize();
      window.addEventListener('resize', () => this.resize());
      this.last = performance.now();
      requestAnimationFrame((t) => this.frame(t));
    }

    // ---------- layout ----------
    resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const cw = window.innerWidth, ch = window.innerHeight;
      this.canvas.width = Math.round(cw * dpr);
      this.canvas.height = Math.round(ch * dpr);
      this.canvas.style.width = cw + 'px';
      this.canvas.style.height = ch + 'px';
      const s = Math.min(cw / W, ch / H);
      this.dpr = dpr;
      this.scale = s;
      this.offX = (cw - W * s) / 2;
      this.offY = (ch - H * s) / 2;
      // HD: match the screen's real pixels (capped); retro: the fixed low-res buffer.
      this.R = RETRO ? 1 / PIX : Math.max(0.5, Math.min(HD_MAX, s * dpr));
      this.px.width = Math.round(W * this.R); this.px.height = Math.round(H * this.R);
      this.renderBackground();
    }

    buildPalette() {
      if (!window.MTPixel || !PIXEL_ON) { this.lut = null; return; }
      const pal = this.th.palette;
      const opts = window.MT_OPTIONS || {};
      const extra = [pal.grass, pal.grassDark, pal.road, pal.roadEdge, pal.plaza, pal.plazaEdge, pal.water, pal.tree]
        .concat(pal.walls, pal.roofs, opts.colors || [], opts.skins || []);
      const night = this.th.night.split(',').map(Number);
      this.lut = window.MTPixel.buildLut(window.MTPixel.buildPalette(extra, [[night, 0.4], [night, 0.74], [[90, 0, 0], 0.38]]));
    }

    // ---------- camera ----------
    focus(x, y, z = 1, dur = 1.5) {
      this.camAnim = { from: { ...this.cam }, to: { x, y, z }, t0: this.time, dur: Math.max(0.01, dur) };
    }

    focusSpot(name, dur = 1.5, zoom) {
      const s = L.SPOTS[name] || L.SPOTS.overview;
      const z = name === 'overview' ? Math.max(1, Math.min(1.35, W / Math.max(1420, ...this.houses.map((h) => Math.abs(h.x - CX) * 2 + 160)))) : s.z;
      this.focus(s.x, s.y, zoom || z, dur);
    }

    focusHouse(i, dur = 1.5, zoom = 2.4) {
      const h = this.houses[i];
      if (h) this.focus(h.x, h.y - 24 * h.s, zoom, dur);
    }

    clampCam(c) {
      const z = Math.max(1, c.z);
      const hw = W / (2 * z), hh = H / (2 * z);
      return { x: clamp(c.x, hw, W - hw), y: clamp(c.y, hh, H - hh), z };
    }

    // Characters a cinematic is "holding" are hidden from the town.
    hold(id) { this.held.add(id); }
    release(id) { this.held.delete(id); }
    releaseAll() { this.held.clear(); }

    // Up to 40 houses sit on one ring; bigger towns get two rings of smaller houses.
    layoutHouses(n) {
      this.houses = L.houses(n);
      this.renderBackground();
    }


    doorOf(i) {
      const h = this.houses[i] || this.houses[0];
      return { x: h.x, y: h.y + 14 * h.s };
    }

    computeSlots() {
      const list = [...this.chars.values()].filter((c) => c.alive).sort((a, b) => a.house - b.house);
      const n = list.length;
      this.slots.clear();
      const rings = n <= 12 ? [{ r: 150, count: n }]
        : n <= 40 ? [{ r: 118, count: Math.floor(n * 0.4) }, { r: 192, count: n - Math.floor(n * 0.4) }]
          : [{ r: 95, count: Math.floor(n * 0.2) }, { r: 160, count: Math.floor(n * 0.33) }, { r: 228, count: n - Math.floor(n * 0.2) - Math.floor(n * 0.33) }];
      let idx = 0;
      rings.forEach((ring, ri) => {
        for (let i = 0; i < ring.count; i++) {
          const a = -Math.PI / 2 + (i / ring.count) * TAU + (ri ? Math.PI / ring.count : 0);
          this.slots.set(list[idx++].id, { x: CX + Math.cos(a) * ring.r * 1.3, y: CY + 22 + Math.sin(a) * ring.r * 0.92 });
        }
      });
    }

    // ---------- state from server ----------
    applyState(st) {
      const prevPhase = this.phase;
      this.state = st;
      this.stateTime = this.time;
      this.wallAtState = performance.now();
      this.phase = st.phase;
      if (st.phase === 'lobby') this.seenStories.clear();
      if (st.theme && st.theme !== this.themeId) {
        this.themeId = st.theme;
        this.th = THEMES[st.theme] || FALLBACK_THEME;
        if (L.applyVariant) L.applyVariant(TW() && TW().variant(st.theme));
        this.buildPalette();
        this.renderBackground();
      }
      const active = st.players.filter((p) => !p.spectator);
      const n = Math.max(0, ...active.map((p) => p.house + 1));
      if (n !== this.houses.length) { this.layoutHouses(n); this.focusSpot('overview'); }

      const seen = new Set();
      for (const p of active) {
        seen.add(p.id);
        let c = this.chars.get(p.id);
        const disaster = st.cinematic && st.cinematic.type === 'disaster' && st.cinematic.targetId === p.id;
        const explosion = st.cinematic && st.cinematic.type === 'stories' && st.cinematic.stories.some((s) => s.scene === 'explosion' && s.targetId === p.id);
        const freshDisaster = (disaster || explosion) && st.cinematic.id !== this.lastCinematicId;
        const isNew = !c;
        if (isNew) {
          const d = this.doorOf(p.home != null ? p.home : p.house);
          c = { id: p.id, x: d.x, y: d.y, alpha: 0, facing: 0, seed: Math.random() * 10, jump: 0, jumpT: 0, voteCount: 0, alive: p.alive, mode: 'wander' };
          this.chars.set(p.id, c);
          if (st.phase === 'lobby') window.SFX && SFX.play('join');
        }
        if (explosion && freshDisaster) c.damagePending = true;
        // An execution scene keeps the condemned visibly alive until its climax.
        if (c.deathPending) {
          if (p.alive && !p.left) c.deathPending = false;
          else if (st.phase === 'execution' || explosion && c.damagePending || (disaster && this.cinema && this.cinema.scene && this.cinema.scene.id === st.cinematic.scene)) { c.name = p.name; c.avatar = p.avatar; c.role = p.role; c.deathOrder = p.deathOrder; continue; }
          else { c.deathPending = false; c.alive = true; }
        }
        const wasAlive = c.alive;
        c.name = p.name;
        c.avatar = p.avatar;
        c.house = p.house; // plot + seat number
        c.home = p.home != null ? p.home : p.house; // the house they live in (own plot or a host's)
        // Housewarming (presentation only): someone just moved in during setup.
        if (!isNew && st.phase === 'lobby' && p.livesWith && c.livesWith !== p.livesWith) {
          const h = this.houses[c.home];
          if (h) { this.burst(h.x, h.y - 40 * h.s, ['#ffd23f', '#ff8fb1', '#ffffff', '#8fd0f2'], 36, 240); this.floatText(h.x, h.y - 90 * h.s, 'Moved in!', '#ffe066'); }
          c.bubble = { text: '🏠', until: this.time + 2.5 };
          window.SFX && SFX.play('join');
        }
        c.livesWith = p.livesWith || null;
        c.homeLook = p.homeLook || (p.avatar && p.avatar.houseStyle ? { style: p.avatar.houseStyle, wall: p.avatar.houseColor, decor: p.avatar.houseDecor } : null);
        if (!c.damagePending) c.houseState = p.houseState || 'normal';
        c.role = p.role;
        if (p.hasVoted && c.hasVoted === false && st.phase === 'voting' && this.time - (this.lastBallotSfx || 0) > 0.12) { this.lastBallotSfx = this.time; SFX.play('ballot'); } // a vote is cast
        c.hasVoted = p.hasVoted;
        c.connected = p.connected;
        c.deathOrder = p.deathOrder;
        c.alive = p.alive && !p.left;
        if (isNew) this.assign(c);
        else if (wasAlive && !c.alive && ((st.phase === 'execution' && prevPhase !== 'execution') || freshDisaster) && this.cinema) { c.alive = true; c.deathPending = true; }
        else if (wasAlive && !c.alive) this.onDeath(c);
        else if (!wasAlive && c.alive) this.assign(c); // back to lobby
      }
      for (const id of [...this.chars.keys()]) if (!seen.has(id)) this.chars.delete(id);
      this.computeSlots();
      if (prevPhase !== this.phase) this.onPhase(this.phase, prevPhase);
      // Bot "speech" during discussion (only the newest few after a reload).
      const acc = (st.accusations || []).filter((a) => a.id > this.lastAcc).slice(-6);
      for (const a of acc) {
        const c = this.chars.get(a.fromId);
        if (c && c.alive) c.bubble = { text: a.text.length > 34 ? a.text.slice(0, 33) + '…' : a.text, until: this.time + 4.5, claim: a.kind === 'claim' };
      }
      if (st.accusations && st.accusations.length) this.lastAcc = Math.max(this.lastAcc, ...st.accusations.map((a) => a.id));
    }

    assign(c) {
      if (!c.alive) { c.mode = 'ghost'; c.inside = false; return; }
      switch (this.phase) {
        case 'lobby': c.mode = 'wander'; c.wt = null; break;
        case 'night': case 'dawn': c.mode = 'home'; break;
        default: c.mode = 'gather';
      }
    }

    onPhase(phase, prev) {
      this.timeline = [];
      if (this.cinema && phase !== 'dawn' && phase !== 'execution') this.cinema.stopPhaseBound();
      if (phase !== 'execution') for (const c of this.chars.values()) if (c.deathPending && !c.damagePending) this.finishDeath(c.id);
      this.shadow = null;
      this.targetDark = phase === 'night' || phase === 'dawn' ? 1 : 0;
      if (phase !== 'verdict' && phase !== 'execution') {
        this.showSkip = false;
        for (const c of this.chars.values()) { c.voteCount = 0; c.doomed = false; }
      }
      if (phase !== 'gameover') { this.winner = null; this.targetRed = 0; }
      for (const c of this.chars.values()) this.assign(c);
      if (phase === 'night' && prev !== 'dawn') SFX.play('night');
      if (phase === 'dawn') SFX.play('chime');
      if (phase === 'discussion') SFX.play('talk');
      if (phase === 'voting' || phase === 'accusation') SFX.play('gavel');
      if (phase === 'defense') SFX.play('gasp');
      if (phase === 'morning') { SFX.play('day'); this.at(0.3, () => SFX.play('rooster')); this.sunrise = this.time; }
    }

    onDeath(c) {
      if (c.inside || c.alpha < 0.5) {
        const d = this.doorOf(c.home);
        c.x = d.x; c.y = d.y;
      }
      c.inside = false;
      c.alpha = 1;
      c.mode = 'ghost';
      c.gt = null;
      this.burst(c.x, c.y - 25, ['#ffffff', '#cfd8ff', '#9aa8d8'], 26, 160);
      SFX.play('poof');
    }

    // ---------- cinematics ----------
    at(delay, fn) { this.timeline.push({ t: this.time + delay, fn }); }

    playCinematic(cine) {
      if (!cine) return;
      this.lastCinematicId = cine.id;
      if (cine.type === 'stories') { this.queueStories(cine.stories); return; }
      if (cine.type === 'disaster' && this.cinema) { this.cinema.play(cine.scene, { victimId: cine.targetId }); return; }
      if (cine.type === 'night') this.playNight(cine);
      else if (cine.type === 'votes') this.playVotes(cine);
      else if (cine.type === 'gameover') this.playGameOver(cine);
      else if (cine.type === 'execution') this.playExecution(cine);
      else if (cine.type === 'scene' && this.cinema) this.cinema.play(cine.scene, { victimId: cine.targetId, outcome: cine.outcome }, { queue: true, phaseBound: true });
      else if (cine.type === 'start') { SFX.play('start'); if (this.cinema) this.cinema.play('introduction', { title: this.state.townName || 'Mafia Town' }, { phaseBound: true }); this.burst(CX, CY, (this.th.effects && this.th.effects.confetti) || ['#f1c40f', '#e74c3c', '#3498db', '#2ecc71'], 60, 380); }
    }

    queueStories(stories) {
      if (!this.cinema) return;
      for (const s of stories || []) {
        if (s.cueId && this.seenStories.has(s.cueId)) continue;
        if (s.cueId) this.seenStories.add(s.cueId);
        this.cinema.play(s.scene, { victimId: s.targetId, title: s.title, sub: s.sub }, { queue: true });
      }
    }

    // One shadowy visit per night event (kill / saved / bodyguard), back to back.
    playNight(cine) {
      if (this.cinema) {
        const events = (cine.events || []).filter((e) => this.chars.get(e.targetId));
        if (!events.length) { this.cinema.play('quietNight', {}, { phaseBound: true }); return; }
        const multi = events.length > 1;
        events.forEach((e) => {
          // The Zombie horde's break-in: a secret scene at a random house (never the bitten one's name).
          if (e.type === 'bite') { this.cinema.play('zombieBite', { victimId: e.targetId }, { queue: true, phaseBound: true }); return; }
          const outcome = e.type === 'multiKill' ? 'multiple' : e.type === 'kill' ? 'kill' : e.type === 'guarded' ? (e.guardDied ? 'guardDies' : 'guard') : 'protected';
          // AI narrator: a kill away from home plays its location scene (lake, hearth, tavern,
          // field, or another house). Home deaths and manual mode use the classic murder scene.
          const story = e.type === 'kill' && e.place && e.place !== 'home' && window.MT_SCENES && window.MT_SCENES['death_' + e.place];
          // e.story: public facts (first death, a roommate, yesterday's vote...) that pick the story beats.
          if (story) this.cinema.play('death_' + e.place, { victimId: e.targetId, place: e.place, placeName: e.placeName, house: e.place === 'visit' ? e.placeHouse : undefined, multi, story: e.story }, { queue: true, phaseBound: true });
          else this.cinema.play('murder', { victimId: e.targetId, outcome, multi, story: e.story }, { queue: true, phaseBound: true });
        });
        return;
      }
      this.playNightSimple(cine);
    }

    playNightSimple(cine) {
      const events = (cine.events || (cine.attackedId ? [{ type: cine.saved ? 'saved' : 'kill', targetId: cine.attackedId }] : []))
        .filter((e) => this.chars.get(e.targetId));
      if (!events.length) {
        this.shadow = { x: -60, y: 760, tx: W + 60, ty: 300, speed: 300, walking: true };
        this.at(7.5, () => { this.shadow = null; });
        return;
      }
      events.forEach((e, i) => this.playVisit(e, i * 3.5, i === events.length - 1));
    }

    playVisit(e, t0, last) {
      const h = this.houses[this.chars.get(e.targetId).home];
      if (!h) return;
      const start = { x: h.x < CX ? -60 : W + 60, y: h.y < CY ? 120 : H - 60 };
      const door = { x: h.x + 26 * h.s, y: h.y + 20 * h.s };
      const d = Math.hypot(door.x - start.x, door.y - start.y);
      const lead = t0 === 0 ? 3.4 : 2.4;
      this.at(t0, () => { this.shadow = { x: start.x, y: start.y, tx: door.x, ty: door.y, speed: d / lead, walking: true }; });
      this.at(t0 + lead + 0.3, () => { SFX.play('knock'); h.shakeUntil = this.time + 0.7; });
      this.at(t0 + lead + 1.4, () => {
        if (!this.shadow) return;
        if (e.type === 'saved' || e.type === 'guarded') {
          SFX.play('saved');
          this.effects.push({ type: 'shield', x: h.x, y: h.y - 30, life: 2.2, max: 2.2 });
          this.burst(h.x, h.y - 30, ['#2ecc71', '#a8ffcf', '#ffffff'], 40, 260);
          this.floatText(h.x, h.y - 90, e.type === 'guarded' ? 'PROTECTED!' : 'SAVED!', '#4dff9a');
          if (e.type === 'guarded' && e.guardDied) this.at(0.6, () => { SFX.play('kill'); this.effects.push({ type: 'flash', x: h.x, y: h.y - 30, color: '255,30,30', r: 160, life: 1, max: 1 }); });
          this.shadow.speed = 600;
        } else {
          SFX.play('kill');
          this.effects.push({ type: 'flash', x: h.x, y: h.y - 30, color: '255,30,30', r: 220, life: 1.2, max: 1.2 });
          this.burst(h.x, h.y - 30, ['#ff2a2a', '#8b0000', '#ff7b7b'], 34, 220);
          this.shadow.speed = d / 3;
        }
        this.shadow.tx = start.x; this.shadow.ty = start.y;
      });
      if (last) this.at(t0 + lead + 4.6, () => { this.shadow = null; });
    }

    playVotes(cine) {
      if (cine.followups && cine.followups.length) this.at(7.4, () => this.queueStories(cine.followups));
      for (const c of this.chars.values()) { c.voteCount = 0; c.doomed = false; }
      this.skipCount = 0;
      this.showSkip = true;
      const n = cine.votes.length;
      const interval = n ? clamp(3.6 / n, 0.02, 0.5) : 0;
      cine.votes.forEach((v, i) => {
        this.at(0.5 + i * interval, () => {
          const from = this.chars.get(v.voterId);
          const to = v.targetId === 'skip' ? null : this.chars.get(v.targetId);
          const tp = to ? { x: to.x, y: to.y - 70 } : { x: CX, y: CY - 10 };
          const fp = from ? { x: from.x, y: from.y - 40 } : { x: CX, y: 60 };
          this.effects.push({ type: 'ballot', x0: fp.x, y0: fp.y, x1: tp.x, y1: tp.y, life: 0.45, max: 0.45, color: from ? from.avatar.color : '#ffffff' });
          SFX.play('vote');
        });
        this.at(0.5 + i * interval + 0.45, () => {
          if (v.targetId === 'skip') this.skipCount++;
          else { const t = this.chars.get(v.targetId); if (t) t.voteCount++; }
        });
      });
      this.at(0.5 + n * interval + 0.9, () => {
        const t = cine.eliminatedId && this.chars.get(cine.eliminatedId);
        if (t) { t.doomed = true; SFX.play('drum'); }
        else { this.floatText(CX, CY - 120, cine.tie ? "IT'S A TIE!" : 'NO ONE ELIMINATED', '#ffe08a'); SFX.play('shrug'); }
      });
    }

    // Plays the server's public execution cue. The outcome (executed / swapped /
    // interrupted) and who may be shown were decided on the server before this.
    playExecution(cine) {
      const condemned = this.chars.get(cine.condemnedId || cine.targetId), dead = cine.outcome === 'interrupted' ? null : this.chars.get(cine.targetId);
      if (!condemned) return;
      const r = dead && dead.role && ROLES[dead.role]; // dead.role is only present when roles are revealed
      const sub = r ? `They were the ${window.MT_THEMES ? window.MT_THEMES.roleName(this.themeId, dead.role, r.name) : r.name}` : '';
      const lw = cine.lastWords, lastWordsText = lw ? [lw.name, lw.word].filter(Boolean).join(' … ') : '';
      // Joining or reconnecting mid-execution: don't replay it from the start.
      const late = cine.at != null && this.state && this.state.serverNow != null && this.state.serverNow - cine.at > 4000;
      const bind = { victimId: condemned.id, outcome: cine.outcome || 'executed', sub, mob: cine.mob, mobCount: cine.mobCount, defenders: cine.defenders || [], guardId: cine.guardId, executionerId: cine.executionerId, guardName: dead && (cine.guardId || cine.executionerId) ? dead.name : '', lastWordsText, story: cine.story };
      if (late || !this.cinema || !this.cinema.play('execution', bind, { phaseBound: true })) { if (dead) this.finishDeath(dead.id); }
    }

    // The visible moment of death for a character whose death was held back.
    finishDeath(id) {
      const c = this.chars.get(id);
      if (!c || !c.deathPending) return;
      c.deathPending = false;
      c.alive = false;
      c.cineTarget = null;
      this.onDeath(c);
      this.computeSlots();
    }

    playGameOver(cine) {
      this.winner = cine.winner;
      this.targetRed = cine.winner === 'mafia' ? 1 : 0;
      // Town and the Jester get a fanfare, a solo killer a sting, the Mafia a dark chord, a draw the wind.
      SFX.play({ town: 'win', jester: 'laugh', serialKiller: 'sting', headhunter: 'sting', draw: 'wind' }[cine.winner] || 'lose');
      if (cine.winner === 'jester') this.at(0.8, () => SFX.play('win'));
      const W8 = (window.MT_ROLES.WINNERS || {})[cine.winner];
      if (this.cinema && W8) {
        const good = cine.winner === 'town' || cine.winner === 'jester';
        const team = cine.winner === 'mafia' && window.MT_THEMES ? window.MT_THEMES.teamName(this.themeId, 'mafia', W8.name) : W8.name;
        const title = cine.winner === 'draw' ? 'Nobody wins…' : `${team} wins!`;
        // Town or Mafia: the winning side celebrates in the square (roles are public at game over).
        // Living winners first, then the fallen (shown faded).
        const side = cine.winner === 'town' || cine.winner === 'mafia' ? cine.winner : null;
        const winners = side ? (this.state.players || []).filter((p) => p.role && ROLES[p.role] && ROLES[p.role].team === side && !p.spectator && this.chars.get(p.id))
          .sort((a, b) => (b.alive ? 1 : 0) - (a.alive ? 1 : 0)).map((p) => p.id) : [];
        if (side && winners.length) this.cinema.play(side === 'town' ? 'victoryTown' : 'victoryMafia', { title, sub: this.state.townName || '', side, winners }, {});
        else this.cinema.play('victory', { title, sub: this.state.townName || '', mood: good ? 'triumph' : 'ominous', cheer: cine.winner === 'town' }, {});
      } else if (cine.winner === 'town') {
        for (let i = 0; i < 6; i++) this.at(i * 0.8, () => this.confetti(120));
      }
    }

    // Atmosphere that tells the story: a golden sunrise sweep each morning, and a gloom that
    // grows as the town empties (fewer living players = greyer, darker days).
    drawAtmosphere(ctx) {
      if (this.sunrise != null && this.time - this.sunrise < 4) {
        const k = (this.time - this.sunrise) / 4, x = -400 + k * (W + 800);
        const g = ctx.createLinearGradient(x - 500, 0, x + 500, 0); g.addColorStop(0, 'rgba(255,200,120,0)'); g.addColorStop(0.5, `rgba(255,210,140,${0.28 * (1 - k)})`); g.addColorStop(1, 'rgba(255,200,120,0)');
        ctx.fillStyle = g; ctx.fillRect(-20, -20, W + 40, H + 40);
      }
      if (!this.state || !['morning', 'discussion', 'voting', 'verdict', 'execution', 'accusation', 'defense'].includes(this.phase)) return;
      const all = this.state.players.filter((p) => !p.spectator).length, alive = this.state.players.filter((p) => !p.spectator && p.alive).length;
      const gloom = all > 3 ? Math.max(0, 1 - alive / all - 0.15) : 0;
      if (gloom > 0.02) { ctx.fillStyle = `rgba(40,44,58,${Math.min(0.3, gloom * 0.4)})`; ctx.fillRect(-20, -20, W + 40, H + 40); }
    }
    // Daily Surprises on the TV: drifting fog banks, or festival lantern strings and fireworks.
    drawSurprise(ctx) {
      const s = this.state && this.state.surprise, t = this.time; if (!s) return;
      if (s === 'fog') {
        for (let i = 0; i < 9; i++) { const x = ((t * (18 + i * 3) + i * 260) % (W + 600)) - 300, y = 140 + i * 105; const g = ctx.createRadialGradient(x, y, 10, x, y, 260); g.addColorStop(0, 'rgba(225,228,235,0.42)'); g.addColorStop(1, 'rgba(225,228,235,0)'); ctx.fillStyle = g; ctx.fillRect(x - 260, y - 260, 520, 520); }
      } else if (s === 'festival') {
        const colors = ['#ff5a7a', '#ffd23f', '#5ad1ff', '#9b7bff', '#5aff9b'];
        for (let row = 0; row < 3; row++) { const y0 = CY - 170 + row * 170; for (let i = 0; i < 18; i++) { const x = CX - 420 + i * 50, y = y0 + Math.sin(i / 17 * Math.PI) * 30; const on = Math.sin(t * 3 + i + row) > -0.3; ctx.fillStyle = on ? colors[(i + row) % colors.length] : '#553'; ctx.beginPath(); ctx.arc(x, y, 5, 0, TAU); ctx.fill(); if (on) { ctx.fillStyle = 'rgba(255,240,180,0.18)'; ctx.beginPath(); ctx.arc(x, y, 14, 0, TAU); ctx.fill(); } } }
        const k = (t % 4) / 4; if (k < 0.6) { const fx = CX + Math.sin(Math.floor(t / 4) * 2.3) * 500, fy = 260 - k * 120; for (let i = 0; i < 16; i++) { const a = i / 16 * TAU, r = k * 140; ctx.fillStyle = colors[i % colors.length]; ctx.globalAlpha = 1 - k / 0.6; ctx.fillRect(fx + Math.cos(a) * r, fy + Math.sin(a) * r, 4, 4); } ctx.globalAlpha = 1; }
      }
    }
    // A live reaction from a phone: the emoji pops up over the character and floats away.
    react(id, emoji) {
      const c = this.chars.get(id); if (!c || !emoji) return;
      (this.reactions = this.reactions || []).push({ id, emoji, t0: this.time, dx: (Math.random() - 0.5) * 24 });
      if (this.time - (this.lastPop || 0) > 0.15) { this.lastPop = this.time; SFX.play('pop'); }
      if (this.reactions.length > 40) this.reactions.shift();
    }
    drawReactions(ctx) {
      if (!this.reactions || !this.reactions.length) return;
      this.reactions = this.reactions.filter((r) => this.time - r.t0 < 2.4);
      ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (const r of this.reactions) {
        const c = this.chars.get(r.id); if (!c) continue;
        const k = (this.time - r.t0) / 2.4, pop = Math.min(1, k * 6), scale = pop < 1 ? 0.4 + pop * 0.9 : 1.3 - Math.min(0.3, (k - 0.17) * 0.6);
        ctx.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
        ctx.font = `${Math.round(30 * scale)}px sans-serif`;
        ctx.fillText(r.emoji, c.x + r.dx + Math.sin(k * 8) * 4, c.y - 92 - k * 70);
      }
      ctx.restore();
    }

    // A ghost's Chill: the ghost swoops over and the living player's house flickers with frost.
    chill({ ghostId, targetId }) {
      const c = this.chars.get(targetId); if (!c) return;
      const h = this.houses[c.home], x = h ? h.x : c.x, y = h ? h.y : c.y;
      this.effects.push({ type: 'chill', x, y, life: 6, max: 6, seed: Math.random() * 10 });
      c.bubble = { text: 'Brrr…!', until: this.time + 2.2 };
      const g = this.chars.get(ghostId);
      if (g && !g.alive && c.alive) { g.mode = 'haunt'; g.hauntTarget = targetId; g.hauntDone = false; }
      if (window.SFX) SFX.play('freeze');
    }
    haunt({ ghostId, kind, targetId }) {
      const g = this.chars.get(ghostId);
      if (!g || g.alive) return;
      if (kind === 'boo') {
        if (!this.chars.get(targetId)) return;
        g.mode = 'haunt';
        g.hauntTarget = targetId;
        g.hauntDone = false;
      } else if (kind === 'spin') {
        g.spinUntil = this.time + 1.6; SFX.play('whoosh');
        g.bubble = { text: pickOne(['Wheee!', '~spin~', 'Woooo!']), until: this.time + 1.8 };
      } else if (kind === 'wail') {
        g.bubble = { text: 'OoooOOOooo~', until: this.time + 2.2 };
        g.mouthUntil = this.time + 2.2;
        SFX.play('wail');
      }
    }

    // ---------- effects ----------
    burst(x, y, colors, count, speed) {
      for (let i = 0; i < count; i++) {
        const a = Math.random() * TAU, v = rnd(0.3, 1) * speed;
        this.effects.push({ type: 'particle', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, g: 300, color: pickOne(colors), size: rnd(3, 7), life: rnd(0.6, 1.2), max: 1.2 });
      }
    }

    confetti(count) {
      const colors = (this.th.effects && this.th.effects.confetti) || ['#f1c40f', '#e74c3c', '#3498db', '#2ecc71', '#9b59b6', '#ff8fd1'];
      for (let i = 0; i < count; i++) {
        this.effects.push({ type: 'confetti', x: rnd(0, W), y: rnd(-80, -10), vx: rnd(-40, 40), vy: rnd(120, 260), rot: rnd(0, TAU), vr: rnd(-6, 6), color: pickOne(colors), life: 6, max: 6 });
      }
    }

    floatText(x, y, text, color) {
      this.effects.push({ type: 'text', x, y, text, color, life: 2.4, max: 2.4 });
    }

    // ---------- simulation ----------
    frame(now) {
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      this.update(dt);
      this.draw();
      requestAnimationFrame((t) => this.frame(t));
    }

    update(dt) {
      this.directCamera();
      this.time += dt;
      const due = this.timeline.filter((e) => e.t <= this.time);
      if (due.length) {
        this.timeline = this.timeline.filter((e) => e.t > this.time);
        due.forEach((e) => e.fn());
      }
      this.dark += (this.targetDark - this.dark) * Math.min(1, dt * 1.3);
      this.red += (this.targetRed - this.red) * Math.min(1, dt * 1.0);
      if (this.camAnim) {
        const a = this.camAnim, p = clamp((this.time - a.t0) / a.dur, 0, 1), e = easeInOut(p);
        this.cam = { x: lerp(a.from.x, a.to.x, e), y: lerp(a.from.y, a.to.y, e), z: lerp(a.from.z, a.to.z, e) };
        if (p >= 1) this.camAnim = null;
      }
      if (this.cinema) this.cinema.update(dt);

      for (const c of this.chars.values()) this.updateChar(c, dt);

      if (this.shadow) {
        const s = this.shadow;
        const dx = s.tx - s.x, dy = s.ty - s.y, d = Math.hypot(dx, dy);
        const step = Math.min(d, s.speed * dt);
        if (d > 1) { s.x += (dx / d) * step; s.y += (dy / d) * step; s.walking = true; } else s.walking = false;
      }

      for (const e of this.effects) {
        e.life -= dt;
        if (e.type === 'particle') { e.vy += e.g * dt; e.x += e.vx * dt; e.y += e.vy * dt; }
        if (e.type === 'confetti') { e.x += e.vx * dt + Math.sin(this.time * 3 + e.rot) * 20 * dt; e.y += e.vy * dt; e.rot += e.vr * dt; }
        if (e.type === 'text') e.y -= 30 * dt;
      }
      this.effects = this.effects.filter((e) => e.life > 0);
    }

    targetFor(c) {
      switch (c.mode) {
        case 'wander': {
          if (!c.wt || (Math.hypot(c.wt.x - c.x, c.wt.y - c.y) < 3 && this.time > c.waitUntil)) {
            const a = Math.random() * TAU, r = rnd(80, 250);
            c.wt = { x: CX + Math.cos(a) * r * 1.35, y: CY + 20 + Math.sin(a) * r * 0.85 };
            c.waitUntil = this.time + rnd(0.5, 4);
          }
          return c.wt;
        }
        case 'gather': return this.slots.get(c.id) || { x: c.x, y: c.y };
        case 'home': return this.doorOf(c.home);
        case 'haunt': {
          const t = this.chars.get(c.hauntTarget);
          if (!t) { c.mode = 'ghost'; return { x: c.x, y: c.y }; }
          const tp = t.alpha < 0.5 ? this.doorOf(t.home) : t;
          return { x: tp.x + 34, y: tp.y + 4 };
        }
        case 'ghost':
        default: {
          if (!c.gt || (Math.hypot(c.gt.x - c.x, c.gt.y - c.y) < 3 && this.time > c.waitUntil)) {
            c.gt = { x: rnd(CEM.x + 10, CEM.x + CEM.w - 10), y: rnd(CEM.y + 20, CEM.y + CEM.h + 10) };
            c.waitUntil = this.time + rnd(1, 5);
          }
          return c.gt;
        }
      }
    }

    // Who the town is looking at, and a gentle camera on the vote leader (no cinematic running).
    // In an empty lobby the camera drifts around town (attract mode).
    directCamera() {
      const busy = this.cinema && this.cinema.active;
      let look = null;
      if (this.phase === 'voting' || this.phase === 'verdict') {
        const lead = [...this.chars.values()].filter((c) => c.alive && c.voteCount > 0).sort((a, b) => b.voteCount - a.voteCount)[0];
        if (lead) look = lead.id;
        if (!busy && lead && lead.voteCount >= 2 && this.time - (this.camDirAt || 0) > 4 && this.camLead !== lead.id) {
          this.camLead = lead.id; this.camDirAt = this.time; this.focus(lead.x, lead.y - 40, 1.3, 2.4);
        }
      } else if (this.camLead) { this.camLead = null; if (!busy) this.focusSpot('overview', 1.6); }
      if (!look && ['discussion', 'morning'].includes(this.phase)) {
        const talker = [...this.chars.values()].filter((c) => c.alive && c.bubble && c.bubble.until > this.time).sort((a, b) => b.bubble.until - a.bubble.until)[0];
        if (talker) look = talker.id;
      }
      this.lookTarget = look;
      if (this.phase === 'lobby' && this.chars.size === 0 && !busy) {
        if (this.time - (this.attractAt || -99) > 9) {
          this.attractAt = this.time; this.attractStep = ((this.attractStep || 0) + 1) % 5;
          const spots = [['square', 1.5], ['pond', 1.6], ['cemetery', 1.5], ['tavern', 1.7], ['overview', 1]];
          const [name, z] = spots[this.attractStep]; this.focusSpot(name, 8.5, z);
        }
      } else if (this.attractAt != null && this.phase === 'lobby' && !busy) { this.attractAt = null; this.focusSpot('overview', 1.2); }
    }

    updateChar(c, dt) {
      const tgt = c.cineTarget || this.targetFor(c);
      const dx = tgt.x - c.x, dy = tgt.y - c.y, d = Math.hypot(dx, dy);
      let speed = 115;
      if (c.mode === 'ghost') speed = Math.hypot(c.x - (CEM.x + CEM.w / 2), c.y - (CEM.y + CEM.h / 2)) > 220 ? 120 : 35;
      if (c.mode === 'haunt') speed = 320;
      if (c.mode === 'wander') speed = 55;
      if (d > 1.5) {
        const step = Math.min(d, speed * dt);
        c.x += (dx / d) * step; c.y += (dy / d) * step;
        c.walking = true;
        if (Math.abs(dx) > 2) c.facing += ((dx > 0 ? 1 : -1) - c.facing) * Math.min(1, dt * 8);
      } else {
        c.walking = false;
        // Standing still, people turn toward whoever the town is watching (the vote leader,
        // or the person talking); otherwise they face front.
        const look = this.lookTarget && this.lookTarget !== c.id ? this.chars.get(this.lookTarget) : null;
        const want = look && Math.abs(look.x - c.x) > 12 ? (look.x > c.x ? 0.7 : -0.7) : 0;
        c.facing += (want - c.facing) * Math.min(1, dt * 3);
      }

      if (c.mode === 'haunt' && d < 6 && !c.hauntDone) {
        c.hauntDone = true;
        c.returnAt = this.time + 1.3;
        c.bubble = { text: 'BOO!', until: this.time + 1.3 };
        c.mouthUntil = this.time + 1.3;
        const t = this.chars.get(c.hauntTarget);
        if (t) { t.jumpT = 0.5; t.scaredUntil = this.time + 1.4; t.bubble = { text: '!!', until: this.time + 1.2 }; }
        SFX.play('boo');
      }
      if (c.mode === 'haunt' && c.hauntDone && this.time > c.returnAt) { c.mode = 'ghost'; c.gt = null; }

      c.inside = c.mode === 'home' && d < 4;
      const ta = c.inside ? 0 : 1;
      c.alpha += (ta - c.alpha) * Math.min(1, dt * 3.5);

      if (this.phase === 'gameover' && c.alive && this.winner && c.role && ROLES[c.role].team === this.winner && c.jumpT <= 0 && Math.random() < dt * 0.9) c.jumpT = 0.5;
      if (c.jumpT > 0) { c.jumpT -= dt; c.jump = Math.sin((1 - Math.max(0, c.jumpT) / 0.5) * Math.PI) * 18; } else c.jump = 0;
      c.spin = c.spinUntil > this.time ? (c.spinUntil - this.time) * 14 : 0;
      if (c.bubble && c.bubble.until < this.time) c.bubble = null;
    }

    // ---------- drawing ----------
    // The static map is cached: one copy at exactly the view resolution (copied 1:1
    // each frame, cheap), and in HD a 2x copy built on demand for zoomed cinematics.
    renderBackground() {
      this.paintBackground(this.bg, this.R);
      this.bgZoom = null;
    }
    backgroundFor(z) {
      if (RETRO || z < 1.15) return this.bg;
      if (!this.bgZoom) { this.bgZoom = document.createElement('canvas'); this.paintBackground(this.bgZoom, Math.min(2.5, this.R * 2)); }
      return this.bgZoom;
    }
    paintBackground(bg, bs) {
      bg.width = Math.round(W * bs);
      bg.height = Math.round(H * bs);
      const ctx = bg.getContext('2d', { willReadFrequently: PIXEL_ON });
      ctx.setTransform(bs, 0, 0, bs, 0, 0);
      const tw = TW(), world = tw && tw.world(this.themeId);
      const rng = seeded(world ? 42 + this.themeId.length * 977 + this.themeId.charCodeAt(0) : 42); // each world grows its own trees

      const pal = this.th.palette;
      // grass
      ctx.fillStyle = pal.grass;
      ctx.fillRect(0, 0, W, H);
      const textured = world ? tw.paintGround(ctx, this.themeId, pal, rng) : false;
      for (let i = 0; i < (textured ? 0 : 260); i++) {
        ctx.fillStyle = rng() > 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,60,0,0.06)';
        ctx.beginPath();
        ctx.ellipse(rng() * W, rng() * H, 20 + rng() * 70, 10 + rng() * 35, rng() * 3, 0, TAU);
        ctx.fill();
      }
      for (let i = 0; i < (textured ? 0 : 500); i++) {
        ctx.strokeStyle = 'rgba(40,110,30,0.55)'; ctx.lineWidth = 3;
        const x = rng() * W, y = rng() * H;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 2, y - 6); ctx.moveTo(x, y); ctx.lineTo(x + 2, y - 5); ctx.stroke();
      }

      // roads
      const roadPass = (w, color) => {
        ctx.strokeStyle = color; ctx.lineWidth = w; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.ellipse(CX, CY, ROAD.rx, ROAD.ry, 0, 0, TAU); ctx.stroke();
        for (const [ax, ay, bx, by] of spokes()) { ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke(); }
        for (const h of this.houses) {
          ctx.beginPath(); ctx.moveTo(h.x, h.y + 6);
          const lane = h.y + 20;
          ctx.lineTo(h.x, lane); ctx.lineTo(CX + 36, lane); ctx.stroke();
        }
        if (this.houses.length) {
          ctx.lineWidth = 12;
          ctx.beginPath(); ctx.moveTo(CX + 36, Math.min(...this.houses.map((h) => h.y + 20)));
          ctx.lineTo(CX + 36, Math.max(...this.houses.map((h) => h.y + 20))); ctx.stroke();
        }
      };
      roadPass(44, pal.roadEdge);
      roadPass(36, pal.road);
      ctx.lineWidth = 16;
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.beginPath(); ctx.ellipse(CX, CY, ROAD.rx, ROAD.ry, 0, 0, TAU); ctx.stroke();

      // town square
      ctx.fillStyle = pal.plazaEdge;
      ctx.beginPath(); ctx.arc(CX, CY, SQUARE_R + 8, 0, TAU); ctx.fill();
      ctx.fillStyle = pal.plaza;
      ctx.beginPath(); ctx.arc(CX, CY, SQUARE_R, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(120,108,88,0.35)'; ctx.lineWidth = 1.5;
      for (let r = 40; r < SQUARE_R; r += 22) {
        ctx.beginPath(); ctx.arc(CX, CY, r, 0, TAU); ctx.stroke();
        const segs = Math.floor((TAU * r) / 30);
        for (let i = 0; i < segs; i++) {
          const a = (i / segs) * TAU + (r % 44 ? 0.1 : 0);
          ctx.beginPath(); ctx.moveTo(CX + Math.cos(a) * r, CY + Math.sin(a) * r);
          ctx.lineTo(CX + Math.cos(a) * (r + 22), CY + Math.sin(a) * (r + 22)); ctx.stroke();
        }
      }
      // fountain base
      ctx.fillStyle = '#8f8a80';
      ctx.beginPath(); ctx.arc(CX, CY, 52, 0, TAU); ctx.fill();
      ctx.fillStyle = pal.water;
      ctx.beginPath(); ctx.arc(CX, CY, 43, 0, TAU); ctx.fill();
      ctx.fillStyle = '#9e998e';
      ctx.beginPath(); ctx.arc(CX, CY, 12, 0, TAU); ctx.fill();

      // lampposts
      for (const a of [Math.PI * 0.25, Math.PI * 0.75, Math.PI * 1.25, Math.PI * 1.75]) {
        const x = CX + Math.cos(a) * (SQUARE_R + 22), y = CY + Math.sin(a) * (SQUARE_R + 22);
        ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath(); ctx.ellipse(x + 3, y + 2, 8, 3, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#3b3f4a'; ctx.fillRect(x - 2.5, y - 46, 5, 46);
        ctx.fillStyle = '#ffe9a8'; roundRect(ctx, x - 7, y - 58, 14, 14, 3); ctx.fill();
        ctx.strokeStyle = '#3b3f4a'; ctx.lineWidth = 2; ctx.stroke();
      }

      // pond (or the world's own: lava, ice, coolant...)
      if (world && tw.paintPond(ctx, this.themeId, pal, POND)) { /* drawn by the world */ } else {
      ctx.fillStyle = pal.grassDark;
      ctx.beginPath(); ctx.ellipse(POND.x, POND.y, POND.rx + 8, POND.ry + 7, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = pal.water;
      ctx.beginPath(); ctx.ellipse(POND.x, POND.y, POND.rx, POND.ry, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.beginPath(); ctx.ellipse(POND.x - 30, POND.y - 18, 40, 10, -0.2, 0, TAU); ctx.fill();
      for (const [lx, ly] of [[POND.x + 40, POND.y + 12], [POND.x - 10, POND.y + 30], [POND.x + 60, POND.y - 22]]) {
        ctx.fillStyle = '#3f8f3a'; ctx.beginPath(); ctx.arc(lx, ly, 9, 0.3, TAU - 0.3); ctx.lineTo(lx, ly); ctx.fill();
      }
      ctx.fillStyle = '#9b7653';
      ctx.fillRect(POND.x - POND.rx - 30, POND.y - 9, 45, 18);
      }

      // cemetery
      ctx.fillStyle = pal.grassDark;
      roundRect(ctx, CEM.x - 12, CEM.y - 12, CEM.w + 24, CEM.h + 24, 14); ctx.fill();
      ctx.fillStyle = shade(pal.grassDark,.08);
      for (let i = 0; i < 30; i++) { ctx.beginPath(); ctx.ellipse(CEM.x + rng() * CEM.w, CEM.y + rng() * CEM.h, 14, 6, 0, 0, TAU); ctx.fill(); }
      ctx.strokeStyle = '#2b2b33'; ctx.lineWidth = 3;
      const fence = (x1, y1, x2, y2) => {
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
        const len = Math.hypot(x2 - x1, y2 - y1), n = Math.floor(len / 14);
        for (let i = 0; i <= n; i++) {
          const x = x1 + ((x2 - x1) * i) / n, y = y1 + ((y2 - y1) * i) / n;
          ctx.beginPath(); ctx.moveTo(x, y + 4); ctx.lineTo(x, y - 14); ctx.stroke();
        }
      };
      const L = CEM.x - 12, R = CEM.x + CEM.w + 12, T = CEM.y - 12, B = CEM.y + CEM.h + 12;
      fence(L, T, R, T); fence(L, B, R, B); fence(L, T, L, B);
      fence(R, T, R, CY - 26); fence(R, CY + 26, R, B);
      ctx.fillStyle = '#4a3a2a'; roundRect(ctx, CEM.x + CEM.w / 2 - 55, T - 40, 110, 26, 5); ctx.fill();
      // dead tree
      ctx.strokeStyle = '#4a3a2a'; ctx.lineWidth = 6; ctx.lineCap = 'round';
      const tx = CEM.x + 20, ty = CEM.y + CEM.h - 5;
      ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(tx, ty - 60); ctx.moveTo(tx, ty - 35); ctx.lineTo(tx + 18, ty - 55); ctx.moveTo(tx, ty - 48); ctx.lineTo(tx - 14, ty - 66); ctx.stroke();

      // trees, bushes, flowers
      const sp = spokes();
      const ok = (x, y, pad) => {
        if (window.MT_WORLD && window.MT_WORLD.CIVICS.some(([min,bx,by]) => this.houses.length >= min && Math.abs(x-bx) < 75+pad && y > by-125-pad && y < by+35+pad)) return false;
        if (Math.hypot(x - CX, y - CY) < SQUARE_R + 60 + pad) return false;
        if (x > CEM.x - 50 - pad && x < CEM.x + CEM.w + 50 + pad && y > CEM.y - 70 - pad && y < CEM.y + CEM.h + 40 + pad) return false;
        if (((x - POND.x) / (POND.rx + 40)) ** 2 + ((y - POND.y) / (POND.ry + 40)) ** 2 < 1) return false;
        const q = Math.sqrt(((x - CX) / ROAD.rx) ** 2 + ((y - CY) / ROAD.ry) ** 2);
        if (Math.abs(q - 1) < 0.08 + pad / 800) return false;
        for (const s of sp) if (distToSeg(x, y, ...s) < 36 + pad) return false;
        for (const h of this.houses) if (Math.hypot(x - h.x, y - (h.y - 25 * h.s)) < 85 * h.s + pad) return false;
        if (y < 95 || y > H - 15) return false;
        return true;
      };
      const trees = [];
      for (let i = 0; i < 1500 && trees.length < 70; i++) {
        const x = rng() * W, y = rng() * H;
        if (ok(x, y, 10) && trees.every((t) => Math.hypot(t.x - x, t.y - y) > 60)) trees.push({ x, y, s: 0.8 + rng() * 0.5, c: rng() });
      }
      if (world) tw.paintSetPieces(ctx, this.themeId, pal, ok); // landmarks: volcano, launch pad, ski hill...
      for (let i = 0; i < (world ? 0 : 300); i++) {
        const x = rng() * W, y = rng() * H;
        if (!ok(x, y, 0)) continue;
        ctx.fillStyle = pickOne(['#ff8fb1', '#fff3a0', '#ffffff', '#c7a4ff', '#ffb36b']);
        ctx.beginPath(); ctx.arc(x, y, 2.6, 0, TAU); ctx.fill();
      }
      trees.sort((a, b) => a.y - b.y);
      for (const t of trees) {
        ctx.save(); ctx.translate(t.x, t.y); ctx.scale(t.s, t.s);
        if (world && tw.drawTree(ctx, this.themeId, t, pal)) { ctx.restore(); continue; }
        ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath(); ctx.ellipse(4, 2, 26, 8, 0, 0, TAU); ctx.fill();
        if (t.c < 0.25) {
          ctx.fillStyle = pal.tree; ctx.beginPath(); ctx.ellipse(0, -14, 22, 16, 0, 0, TAU); ctx.fill();
          ctx.fillStyle = shade(pal.tree,.15); ctx.beginPath(); ctx.ellipse(-4, -18, 13, 9, 0, 0, TAU); ctx.fill();
        } else if (t.c < 0.55) {
          ctx.fillStyle = '#6b4a2b'; ctx.fillRect(-4, -22, 8, 22);
          ctx.fillStyle = shade(pal.tree,-.12);
          for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-24 + i * 4, -18 - i * 16); ctx.lineTo(24 - i * 4, -18 - i * 16); ctx.lineTo(0, -48 - i * 16); ctx.closePath(); ctx.fill(); }
        } else {
          ctx.fillStyle = '#6b4a2b'; ctx.fillRect(-4, -26, 8, 26);
          ctx.fillStyle = pal.tree; ctx.beginPath(); ctx.arc(0, -44, 26, 0, TAU); ctx.fill();
          ctx.fillStyle = shade(pal.tree, 0.2); ctx.beginPath(); ctx.arc(-7, -51, 15, 0, TAU); ctx.fill();
          ctx.fillStyle = shade(pal.tree, -0.15); ctx.beginPath(); ctx.arc(12, -36, 12, 0, TAU); ctx.fill();
        }
        ctx.restore();
      }
      if (this.lut) window.MTPixel.snap(ctx, bg.width, bg.height, this.lut);
    }

    // ---------- frame composition ----------
    draw() {
      const scr = this.screen;
      scr.setTransform(1, 0, 0, 1, 0, 0);
      scr.fillStyle = '#0b0a12';
      scr.fillRect(0, 0, this.canvas.width, this.canvas.height);
      const k = this.scale * this.dpr;
      const cin = this.cinema;
      const interior = cin && cin.active && cin.stage === 'interior';
      // Draw only what the camera sees, straight into the buffer at its resolution, so
      // zooming re-renders the art crisply instead of enlarging a small image.
      const cam = interior ? L.SPOTS.overview : this.clampCam(this.cam);
      const sh = cin ? cin.shakeOffset() : { x: 0, y: 0 };
      const pctx = this.pctx, S = this.R * cam.z;
      pctx.setTransform(1, 0, 0, 1, 0, 0);
      pctx.fillStyle = '#0b0a12'; pctx.fillRect(0, 0, this.px.width, this.px.height);
      pctx.setTransform(S, 0, 0, S, -(cam.x - W / (2 * cam.z)) * S, -(cam.y - H / (2 * cam.z)) * S);
      pctx.imageSmoothingEnabled = !RETRO; pctx.imageSmoothingQuality = 'medium';
      this.drawZoom = cam.z;
      this.ctx = pctx;
      if (interior) cin.drawInteriorStage(pctx);
      else this.drawWorld();
      if (this.lut) window.MTPixel.snap(pctx, this.px.width, this.px.height, this.lut);

      // Copy the finished view to the screen: 1:1 in HD, chunky nearest-neighbor in retro.
      scr.setTransform(k, 0, 0, k, this.offX * this.dpr, this.offY * this.dpr);
      scr.imageSmoothingEnabled = !RETRO && this.px.width !== Math.round(W * k); scr.imageSmoothingQuality = 'medium';
      const look = TW() && TW().screenFilter(this.themeId);
      if (look) scr.filter = look; // Noir: the whole world in black and white
      scr.drawImage(this.px, 0, 0, this.px.width, this.px.height, sh.x, sh.y, W, H);
      if (look) scr.filter = 'none';

      // crisp text overlay in world space (follows the camera)
      this.ctx = scr;
      scr.imageSmoothingEnabled = true;
      if (interior) {
        scr.setTransform(k, 0, 0, k, this.offX * this.dpr, this.offY * this.dpr);
        cin.drawInteriorTexts(scr);
      } else {
        scr.setTransform(k * cam.z, 0, 0, k * cam.z, this.offX * this.dpr + k * (W / 2 - cam.z * cam.x + sh.x), this.offY * this.dpr + k * (H / 2 - cam.z * cam.y + sh.y));
        this.drawSigns();
        this.drawLabels();
        this.drawEffects(true);
        this.drawReactions(scr);
        if (this.showSkip && this.skipCount > 0) this.drawSkip();
        if (cin) cin.drawTownTexts(scr);
      }
      // screen-space cinematic overlay (letterbox, fades, titles)
      scr.setTransform(k, 0, 0, k, this.offX * this.dpr, this.offY * this.dpr);
      // Spotlight follows its actor (world -> screen through the camera).
      const spotActor = cin && cin.spot && cin.actors.get(cin.spot);
      const spotPos = spotActor && (interior ? { x: spotActor.x, y: spotActor.y - 30 * (spotActor.scale || 1) }
        : { x: W / 2 + cam.z * (spotActor.x - cam.x) + sh.x, y: H / 2 + cam.z * (spotActor.y - 30 * (spotActor.scale || 1) - cam.y) + sh.y });
      if (TW()) TW().drawScreenOverlay(scr, this.themeId, this.time, W, H); // vignette, film grain
      if (cin) cin.drawOverlay(scr, spotPos);
      if (this.isCorrupted()) {
        scr.fillStyle = 'rgba(110,255,220,0.12)';
        for (let i = 0; i < 18; i++) scr.fillRect((i * 397 + this.time * 340) % W, (i * 61 + this.time * 220) % H, 140, 5);
        scr.fillStyle = '#c8fff1'; scr.font = `700 22px ${FONT}`; scr.textAlign = 'center'; scr.fillText('SIGNAL CORRUPTED', CX, H - 45);
      }
      // clip anything outside the 16:9 stage
      scr.setTransform(1, 0, 0, 1, 0, 0);
      scr.fillStyle = '#0b0a12';
      if (this.offX > 0) { scr.fillRect(0, 0, this.offX * this.dpr, this.canvas.height); scr.fillRect(this.canvas.width - this.offX * this.dpr - 1, 0, this.offX * this.dpr + 1, this.canvas.height); }
      if (this.offY > 0) { scr.fillRect(0, 0, this.canvas.width, this.offY * this.dpr); scr.fillRect(0, this.canvas.height - this.offY * this.dpr - 1, this.canvas.width, this.offY * this.dpr + 1); }
    }

    drawWorld() {
      const ctx = this.ctx;
      ctx.drawImage(this.backgroundFor(this.drawZoom || 1), 0, 0, W, H);

      // fountain shimmer
      ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        const r = 14 + ((this.time * 14 + i * 10) % 28);
        ctx.globalAlpha = 1 - (r - 14) / 28;
        ctx.beginPath(); ctx.arc(CX, CY, r, 0, TAU); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      const tw = TW();
      if (tw) tw.drawAmbient(this, ctx, 'ground'); // cars, shadows, critters

      this.drawGraves();
      this.drawSettlement();

      // depth-sorted houses + living characters + shadow figure
      const ents = [];
      this.houses.forEach((h, i) => { if (this.ownerOf(i)) ents.push({ y: h.y, draw: () => this.drawHouse(h, i) }); });
      for (const c of this.chars.values()) {
        if (c.alive && c.alpha > 0.02 && !this.held.has(c.id)) ents.push({ y: c.y, draw: () => this.drawChar(c) });
      }
      if (this.cinema) ents.push(...this.cinema.townEntities().map((e) => ({ y: e.y, draw: () => e.draw(ctx) })));
      if (this.shadow) ents.push({ y: this.shadow.y, draw: () => drawShadowFigure(ctx, this.shadow.x, this.shadow.y, this.time, this.shadow.walking) });
      ents.sort((a, b) => a.y - b.y).forEach((e) => e.draw());
      if (tw) tw.drawAmbient(this, ctx, 'sky'); // dragons, drones, birds, bats

      // night
      const dark = this.cineDark != null ? this.cineDark : this.dark;
      if (dark > 0.01 || this.red > 0.01) {
        ctx.fillStyle = `rgba(${this.th.night},${0.74 * dark})`;
        ctx.fillRect(-20, -20, W + 40, H + 40);
        if (this.red > 0.01) { ctx.fillStyle = `rgba(90,0,0,${0.38 * this.red})`; ctx.fillRect(-20, -20, W + 40, H + 40); }
        this.drawLights(dark);
      }
      if (tw) tw.drawAmbient(this, ctx, 'weather'); // snow, rain, embers, aurora
      this.drawSurprise(ctx);
      this.drawAtmosphere(ctx);

      // ghosts glow above the darkness
      for (const c of this.chars.values()) {
        if (!c.alive && !this.held.has(c.id)) {
          drawGhost(ctx, c.x, c.y, c.avatar, { t: this.time, seed: c.seed, spin: c.spin, mouth: c.mouthUntil > this.time, glow: dark > 0.5 });
        }
      }
      if (this.cinema) this.cinema.drawTownGlow(ctx);
      this.drawEffects(false);
    }

    drawSettlement() {
      if (window.MT_WORLD) { window.MT_WORLD.settlement(this); return; }
      const ctx = this.ctx, n = this.chars.size, t = this.time, pal = this.th.palette;
      const building = (x, y, label) => {
        ctx.fillStyle = pal.walls[0]; ctx.fillRect(x - 48, y - 58, 96, 58);
        ctx.fillStyle = pal.roofs[0];
        ctx.beginPath();
        if (this.themeId === 'space') ctx.ellipse(x, y - 58, 50, 36, 0, Math.PI, 0);
        else { ctx.moveTo(x - 58, y - 58); ctx.lineTo(x, y - (this.themeId === 'fantasy' ? 120 : 92)); ctx.lineTo(x + 58, y - 58); }
        ctx.fill();
        if (this.themeId === 'space') { ctx.strokeStyle = '#a6e5ff'; ctx.lineWidth = 4; ctx.strokeRect(x - 49, y - 59, 98, 60); }
        else if (['medieval', 'fantasy', 'dragons', 'dungeon'].includes(this.themeId)) { ctx.fillStyle = '#57402a'; ctx.fillRect(x - 45, y - 57, 6, 57); ctx.fillRect(x + 39, y - 57, 6, 57); }
        ctx.fillStyle = '#5c3c27'; ctx.fillRect(x - 9, y - 30, 18, 30);
        ctx.fillStyle = '#ffe6a1'; ctx.fillRect(x - 33, y - 40, 14, 14); ctx.fillRect(x + 19, y - 40, 14, 14);
      };
      if (n >= 10) building(660, 630, 'tavern');
      if (n >= 25) {
        building(1280, 410, 'hall');
        ctx.fillStyle = '#675247'; ctx.beginPath(); ctx.ellipse(1280, 655, 32, 15, 0, 0, TAU); ctx.fill();
        for (let i = 0; i < 5; i++) { ctx.fillStyle = i % 2 ? '#ffd56a' : '#ee823e'; ctx.beginPath(); ctx.ellipse(1265 + i * 7, 649 - Math.sin(t * 7 + i) * 5, 6, 14 + Math.sin(t * 8 + i) * 5, 0, 0, TAU); ctx.fill(); }
      }
      if (n >= 50) { building(1350, 590, 'market'); building(670, 400, 'workshop'); }
      // Unnamed wildlife is deliberately unlike the selectable human avatars.
      for (let i = 0; i < 4; i++) {
        const x = (t * 27 + i * 470) % W, y = 100 + Math.sin(t + i) * 25;
        ctx.strokeStyle = '#393d49'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x - 6, y - Math.sin(t * 6) * 4); ctx.lineTo(x, y); ctx.lineTo(x + 6, y - Math.sin(t * 6) * 4); ctx.stroke();
      }
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = 'rgba(255,255,255,0.10)'; ctx.beginPath(); ctx.ellipse((t * 9 + i * 650) % W, 115 + i * 21, 115, 17, 0, 0, TAU); ctx.fill();
      }
      for (const h of this.houses) if (h.chimney && this.ownerOf(h.ri)) {
        for (let i = 0; i < 3; i++) { const p = (t * 0.35 + i / 3) % 1; ctx.fillStyle = `rgba(220,223,223,${(1 - p) * 0.26})`; ctx.beginPath(); ctx.ellipse(h.x + 12 + p * 18, h.y - 55 - p * 50, 3 + p * 9, 4 + p * 11, 0, 0, TAU); ctx.fill(); }
      }
    }

    // World-space text that lives on the crisp overlay (signs, grave names).
    drawSigns() {
      const ctx = this.ctx;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#f2e6cf';
      ctx.font = `700 16px ${FONT}`;
      for (const [min, key, label, x, y] of [[10, 'tavern', 'TAVERN', 660, 650], [25, 'hall', 'TOWN HALL', 1280, 430], [25, 'firepit', 'FIREPIT', 1280, 690], [50, 'market', 'MARKET', 1350, 610], [50, 'workshop', 'WORKSHOP', 670, 420]]) {
        if (!window.MT_WORLD && this.chars.size >= min) ctx.fillText((this.th.civic || {})[key] || label, x, y);
      }
      if (window.MT_WORLD) {
        ctx.font = `600 13px ${FONT}`;
        for (const [min,x,y,label] of window.MT_WORLD.CIVICS) if (this.chars.size >= min) { const key = { TAVERN:'tavern','GUILD HALL':'hall',SMITHY:'workshop',MARKET:'market' }[label]; ctx.fillText((this.th.civic || {})[key] || label,x,y+18); }
        if (this.chars.size) ctx.fillText((this.th.civic || {}).firepit || 'FIREPIT',1280,686);
      }
      // Every house has a sign: plot number + owner, then anyone staying there.
      // It follows the live roster, so joins, departures and moves update it.
      if (window.MT_WORLD) this.houses.forEach((h, i) => { const owner = this.ownerOf(i); if (owner) window.MT_WORLD.homeSign(this, h, owner, this.residentsOf(i)); });
      ctx.font = `600 13px ${FONT}`;
      if (!window.MT_WORLD) for (const c of this.chars.values()) if (c.inside && !this.held.has(c.id)) {
        const h = this.houses[c.house]; if (!h) continue;
        ctx.fillStyle = 'rgba(20,22,35,0.8)'; ctx.fillRect(h.x - 55, h.y + 16, 110, 20);
        ctx.fillStyle = c.avatar.nameColor || '#fff'; ctx.fillText(`${c.house + 1} ${c.name.slice(0, 10)}`, h.x, h.y + 26);
      }
      ctx.fillStyle = '#f2e6cf'; ctx.font = `700 16px ${FONT}`;
      ctx.fillText(this.th.labels.cemetery || 'CEMETERY', CEM.x + CEM.w / 2, CEM.y - 12 - 27);
      const dead = [...this.chars.values()].filter((c) => !c.alive).sort((a, b) => (a.deathOrder || 0) - (b.deathOrder || 0));
      ctx.font = `600 11px ${FONT}`;
      dead.forEach((c, i) => {
        const slot = i % 28, col = slot % 7, row = Math.floor(slot / 7);
        const x = CEM.x + 24 + col * 42 + (row % 2) * 10, y = CEM.y + 48 + row * 52;
        ctx.fillStyle = '#3a3d52';
        ctx.fillText('RIP', x, y - 20);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(c.name.length > 7 ? c.name.slice(0, 6) + '…' : c.name, x, y + 9);
      });
    }

    drawHouse(h, i) {
      if (window.MT_WORLD) { window.MT_WORLD.house(this, h, i, this.ownerOf(i), this.residentsOf(i)); return; }
      const ctx = this.ctx;
      const owner = this.ownerOf(i);
      const pal = this.th.palette;
      const wall = pal.walls[h.wi % pal.walls.length];
      const roof = pal.roofs[h.ri % pal.roofs.length];
      ctx.save();
      ctx.translate(h.x + (h.shakeUntil > this.time ? Math.sin(this.time * 70) * 3 : 0), h.y);
      ctx.scale(h.s, h.s);
      const x = 0, y = 0;
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.beginPath(); ctx.ellipse(x + 5, y + 2, 40, 9, 0, 0, TAU); ctx.fill();
      const style = this.th.building || 'gable';
      // walls
      ctx.fillStyle = wall;
      if (style === 'tent') {
        ctx.beginPath(); ctx.moveTo(x - 38, y); ctx.lineTo(x, y - 72); ctx.lineTo(x + 38, y); ctx.closePath(); ctx.fill();
        ctx.fillStyle = roof; ctx.beginPath(); ctx.moveTo(x - 38, y); ctx.lineTo(x, y - 72); ctx.lineTo(x - 10, y); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = shade(roof, -0.3); ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x, y - 72); ctx.lineTo(x, y - 84); ctx.stroke();
      } else if (style === 'spire') {
        roundRect(ctx, x - 26, y - 46, 52, 46, 4); ctx.fill();
        ctx.fillStyle = roof; ctx.beginPath(); ctx.moveTo(x - 32, y - 44); ctx.lineTo(x, y - 96); ctx.lineTo(x + 32, y - 44); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#ffe066'; ctx.beginPath(); ctx.arc(x, y - 98, 3.5, 0, TAU); ctx.fill();
      } else if (style === 'dome') {
        roundRect(ctx, x - 32, y - 30, 64, 30, 6); ctx.fill();
        ctx.fillStyle = roof; ctx.beginPath(); ctx.ellipse(x, y - 30, 34, 30, 0, Math.PI, 0); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.beginPath(); ctx.ellipse(x - 10, y - 44, 10, 6, -0.5, 0, TAU); ctx.fill();
        ctx.strokeStyle = '#c9d1e8'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + 14, y - 54); ctx.lineTo(x + 20, y - 74); ctx.stroke();
        ctx.fillStyle = '#ff5a5a'; ctx.beginPath(); ctx.arc(x + 20, y - 75, 3, 0, TAU); ctx.fill();
      } else if (style === 'crypt') {
        roundRect(ctx, x - 33, y - 48, 66, 48, 2); ctx.fill();
        ctx.fillStyle = roof; ctx.fillRect(x - 37, y - 54, 74, 9);
        ctx.strokeStyle = 'rgba(0,0,0,0.15)'; ctx.lineWidth = 1.5;
        for (let r = 0; r < 4; r++) { ctx.beginPath(); ctx.moveTo(x - 33, y - 12 * r); ctx.lineTo(x + 33, y - 12 * r); ctx.stroke(); }
      } else if (style === 'office' || style === 'bunker') {
        const tall = style === 'office' ? 62 : 38;
        roundRect(ctx, x - 33, y - tall, 66, tall, 2); ctx.fill();
        ctx.fillStyle = roof; ctx.fillRect(x - 36, y - tall - 6, 72, 8);
        if (style === 'office') { ctx.fillStyle = 'rgba(160,200,230,0.7)'; for (let c = 0; c < 4; c++) ctx.fillRect(x - 27 + c * 15, y - 56, 9, 9); }
        else { ctx.fillStyle = shade(roof, -0.2); ctx.fillRect(x + 20, y - tall - 26, 2, 20); ctx.fillStyle = '#e74c3c'; ctx.fillRect(x + 22, y - tall - 26, 12, 8); }
      } else {
        roundRect(ctx, x - 31, y - 42, 62, 42, 4); ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,0.08)'; ctx.fillRect(x - 31, y - 8, 62, 8);
        if (style === 'thatch') {
          ctx.fillStyle = roof; ctx.beginPath(); ctx.ellipse(x, y - 40, 42, 34, 0, Math.PI, 0); ctx.fill();
          ctx.strokeStyle = 'rgba(0,0,0,0.15)'; ctx.lineWidth = 1.5;
          for (let r = 0; r < 5; r++) { ctx.beginPath(); ctx.ellipse(x, y - 40, 42 - r * 7, 34 - r * 6, 0, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); }
        } else {
          if (h.chimney) { ctx.fillStyle = shade(roof, -0.3); ctx.fillRect(x + 12, y - 76, 10, 20); }
          ctx.fillStyle = roof;
          ctx.beginPath(); ctx.moveTo(x - 40, y - 38); ctx.lineTo(x + 40, y - 38); ctx.lineTo(x + 26, y - 70); ctx.lineTo(x - 26, y - 70); ctx.closePath(); ctx.fill();
          ctx.fillStyle = shade(roof, -0.25);
          ctx.fillRect(x - 40, y - 42, 80, 5);
          ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = 1.5;
          for (let r = 0; r < 3; r++) { const yy = y - 48 - r * 8; ctx.beginPath(); ctx.moveTo(x - 36 + r * 3.5, yy); ctx.lineTo(x + 36 - r * 3.5, yy); ctx.stroke(); }
        }
      }
      // door
      ctx.fillStyle = style === 'dome' ? '#5b6280' : '#7a4e2d';
      roundRect(ctx, x - 7, y - 22, 14, 22, style === 'crypt' ? 7 : 3); ctx.fill();
      ctx.fillStyle = '#f5c518'; ctx.beginPath(); ctx.arc(x + 3.5, y - 10, 1.6, 0, TAU); ctx.fill();
      // windows
      const deadOwner = owner && !owner.alive;
      const win = (wx) => {
        ctx.fillStyle = deadOwner ? '#3b3f4a' : '#a8d8ef';
        ctx.fillRect(wx, y - 33, 12, 11);
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5; ctx.strokeRect(wx, y - 33, 12, 11);
        if (deadOwner) {
          ctx.strokeStyle = '#8b6b4a'; ctx.lineWidth = 2.5;
          ctx.beginPath(); ctx.moveTo(wx - 2, y - 34); ctx.lineTo(wx + 14, y - 21); ctx.moveTo(wx + 14, y - 34); ctx.lineTo(wx - 2, y - 21); ctx.stroke();
        }
      };
      if (style !== 'tent') { win(x - 25); win(x + 13); }
      if (!owner) { ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.beginPath(); ctx.ellipse(x, y - 30, 36, 34, 0, 0, TAU); ctx.fill(); }
      ctx.restore();
    }

    // A plot's owner is the player whose plot it is and who lives there (not a guest elsewhere).
    ownerOf(i) {
      this.homeCache();
      return this.ownerCache.get(i);
    }
    // Everyone who lives in the house on plot i (owner first).
    residentsOf(i) {
      this.homeCache();
      return this.residentCache.get(i) || [];
    }
    homeCache() {
      if (this.ownerCache && this.ownerCacheT === this.time) return;
      this.ownerCacheT = this.time;
      this.ownerCache = new Map(); this.residentCache = new Map();
      for (const c of this.chars.values()) if (!c.livesWith) this.ownerCache.set(c.house, c);
      for (const c of this.chars.values()) {
        const home = c.home != null ? c.home : c.house;
        if (!this.residentCache.has(home)) this.residentCache.set(home, []);
        const list = this.residentCache.get(home); if (c.livesWith) list.push(c); else list.unshift(c);
      }
    }

    drawLights(dark) {
      const ctx = this.ctx;
      const savedDark = this.dark;
      this.dark = dark;
      // Blood Moon event night: the whole town turns red under a red moon.
      if (this.state && this.state.bloodMoon && dark > 0.05) {
        ctx.save(); ctx.fillStyle = `rgba(150,12,24,${0.22 * dark})`; ctx.fillRect(-4000, -4000, 12000, 12000);
        ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createRadialGradient(1700, 120, 0, 1700, 120, 180); g.addColorStop(0, `rgba(255,70,60,${0.9 * dark})`); g.addColorStop(0.35, `rgba(200,30,30,${0.5 * dark})`); g.addColorStop(1, 'rgba(120,0,0,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(1700, 120, 180, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      }
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const glow = (x, y, r, rgb, a) => {
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, `rgba(${rgb},${a})`);
        g.addColorStop(1, `rgba(${rgb},0)`);
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
      };
      const lit = (k) => Math.max(0, Math.min(1, (this.dark - k) / 0.12)); // each light switches on at its own darkness level
      [Math.PI * 0.25, Math.PI * 0.75, Math.PI * 1.25, Math.PI * 1.75].forEach((a, li) => {
        const x = CX + Math.cos(a) * (SQUARE_R + 22), y = CY + Math.sin(a) * (SQUARE_R + 22) - 51, on = lit(0.15 + li * 0.12);
        glow(x, y + 40, 110, '255,200,110', 0.22 * on);
        glow(x, y, 22, '255,230,160', 0.8 * on);
      });
      this.houses.forEach((h, i) => {
        if (!this.ownerOf(i) || !this.residentsOf(i).some((c) => c.alive && c.inside)) return;
        const flick = 0.85 + Math.sin(this.time * 3 + i) * 0.05, on = lit(0.25 + ((i * 37) % 10) * 0.05);
        glow(h.x, h.y - 26 * h.s, 70 * h.s, '255,190,90', 0.28 * on * flick);
      });
      const cw = this.cineWindow && this.houses[this.cineWindow.house];
      if (cw) glow(cw.x, cw.y - 26 * cw.s, 90 * cw.s, '255,200,100', 0.5 * this.dark);
      for (const f of this.fireflies) {
        const x = f.x + Math.sin(this.time * 0.5 * f.s + f.p) * 40;
        const y = f.y + Math.cos(this.time * 0.4 * f.s + f.p) * 30;
        const a = (0.5 + 0.5 * Math.sin(this.time * 2 * f.s + f.p)) * this.dark;
        glow(x, y, 8, '220,255,120', 0.7 * a);
      }
      ctx.restore();
      // re-draw lit windows crisply on top of the dark
      this.houses.forEach((h, i) => {
        if (!this.ownerOf(i) || !this.residentsOf(i).some((c) => c.alive && c.inside) || this.th.building === 'tent') return;
        ctx.fillStyle = `rgba(255,214,110,${this.dark})`;
        ctx.fillRect(h.x - 25 * h.s, h.y - 33 * h.s, 12 * h.s, 11 * h.s);
        ctx.fillRect(h.x + 13 * h.s, h.y - 33 * h.s, 12 * h.s, 11 * h.s);
      });
      if (cw) {
        ctx.fillStyle = `rgba(255,214,110,${this.dark})`;
        ctx.fillRect(cw.x - 25 * cw.s, cw.y - 33 * cw.s, 12 * cw.s, 11 * cw.s);
        ctx.fillRect(cw.x + 13 * cw.s, cw.y - 33 * cw.s, 12 * cw.s, 11 * cw.s);
      }
      this.dark = savedDark;
    }

    drawGraves() {
      const ctx = this.ctx;
      const dead = [...this.chars.values()].filter((c) => !c.alive).sort((a, b) => (a.deathOrder || 0) - (b.deathOrder || 0));
      dead.forEach((c, i) => {
        const slot = i % 28, col = slot % 7, row = Math.floor(slot / 7);
        const x = CEM.x + 24 + col * 42 + (row % 2) * 10, y = CEM.y + 48 + row * 52;
        ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath(); ctx.ellipse(x + 3, y + 2, 15, 4, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#8d929c';
        ctx.beginPath(); ctx.moveTo(x - 12, y); ctx.lineTo(x - 12, y - 22); ctx.arc(x, y - 22, 12, Math.PI, 0); ctx.lineTo(x + 12, y); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#a9aeb8'; ctx.fillRect(x - 12, y - 22, 4, 22);
      });
    }

    drawChar(c) {
      const ctx = this.ctx;
      if (c.doomed) {
        const p = 0.5 + 0.5 * Math.sin(this.time * 6);
        ctx.fillStyle = `rgba(255,40,40,${0.25 + 0.3 * p})`;
        ctx.beginPath(); ctx.ellipse(c.x, c.y, 30 + p * 6, 11 + p * 2, 0, 0, TAU); ctx.fill();
      }
      const avatars = this.isCorrupted() ? [...this.chars.values()] : [];
      const av = avatars.length ? avatars[(c.house + 1) % avatars.length].avatar : c.avatar;
      drawCharacter(ctx, c.x, c.y, av, {
        theme: this.themeId,
        t: this.time, walking: c.walking, facing: c.facing, seed: c.seed,
        alpha: c.alpha, jump: c.jump, scared: c.scaredUntil > this.time,
      });
    }

    isCorrupted() {
      const elapsed = Math.max((this.time - this.stateTime) * 1000, performance.now() - this.wallAtState);
      return !!(this.state && this.state.presentation && this.state.presentation.glitchUntil > this.state.serverNow + elapsed);
    }

    drawLabels() {
      const ctx = this.ctx;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (const c of this.chars.values()) {
        const ghost = !c.alive;
        if (!ghost && (c.alpha < 0.3 || this.held.has(c.id))) continue;
        const a = ghost ? 0.8 : c.alpha;
        const corrupt = this.isCorrupted();
        const shownName = corrupt ? `?? ${c.house + 1} #${Math.floor(this.time * 5) % 10}` : c.name;
        const name = shownName.length > 12 ? shownName.slice(0, 11) + '…' : shownName;
        ctx.font = ghost ? `600 12px ${FONT}` : `600 14px ${FONT}`;
        const w = ctx.measureText(name).width + 12;
        const ly = c.y + 13;
        ctx.globalAlpha = a;
        ctx.fillStyle = ghost ? 'rgba(60,70,110,0.55)' : c.avatar.nameplate === 'scroll' ? '#695741' : c.avatar.nameplate === 'veteran' ? '#505d62' : c.avatar.nameplate === 'mafiaBoss' ? '#673143' : ({ neon: '#0f3a4e', royal: '#4a2a6a', bloodMoon: '#5a0a14', gilded: '#7a5a1a' })[c.avatar.nameplate] || 'rgba(20,22,35,0.72)';
        roundRect(ctx, c.x - w / 2, ly - 9, w, 18, 9); ctx.fill();
        ctx.fillStyle = c.connected === false ? '#ff9b9b' : (c.avatar.nameColor || '#ffffff');
        ctx.fillText(name, c.x, ly + 0.5);

        if (c.role && (ghost || this.phase === 'gameover')) {
          const r = ROLES[c.role];
          ctx.font = `700 11px ${FONT}`;
          const t = `${r.emoji} ${r.name}`;
          const rw = ctx.measureText(t).width + 10;
          ctx.fillStyle = r.color;
          roundRect(ctx, c.x - rw / 2, ly + 11, rw, 15, 7.5); ctx.fill();
          ctx.fillStyle = r.darkText ? '#2a2200' : '#ffffff';
          ctx.fillText(t, c.x, ly + 19);
        }

        const headY = c.y - 72 - (c.jump || 0);
        if (!ghost && this.phase === 'voting' && c.hasVoted) {
          ctx.fillStyle = '#2ecc71';
          ctx.beginPath(); ctx.arc(c.x, headY, 10, 0, TAU); ctx.fill();
          ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(c.x - 4.5, headY); ctx.lineTo(c.x - 1, headY + 4); ctx.lineTo(c.x + 5, headY - 4); ctx.stroke();
        }
        if (!ghost && (c.voteCount > 0 || (corrupt && ['discussion', 'voting'].includes(this.phase)))) {
          const r = 13 + Math.min(c.voteCount, 10) * 1.2;
          ctx.fillStyle = c.doomed ? '#ff2a2a' : '#e74c3c';
          ctx.beginPath(); ctx.arc(c.x, headY - 4, r, 0, TAU); ctx.fill();
          ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; ctx.stroke();
          ctx.fillStyle = '#fff'; ctx.font = `700 ${Math.round(r * 1.1)}px ${FONT}`;
          ctx.fillText(String(corrupt ? (c.voteCount + c.house + Math.floor(this.time)) % 9 : c.voteCount), c.x, headY - 3);
        }
        if (c.bubble) this.drawBubble(c.x, c.y - (ghost ? 62 : 80), c.bubble.text, c.bubble.claim);
        ctx.globalAlpha = 1;
      }
    }

    drawBubble(x, y, text, claim) {
      const ctx = this.ctx;
      ctx.font = `700 16px ${FONT}`;
      const w = ctx.measureText(text).width + 18;
      ctx.fillStyle = claim ? '#fff1b8' : '#ffffff';
      roundRect(ctx, x - w / 2, y - 30, w, 26, 10); ctx.fill();
      ctx.beginPath(); ctx.moveTo(x - 6, y - 5); ctx.lineTo(x + 6, y - 5); ctx.lineTo(x, y + 4); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#222';
      ctx.fillText(text, x, y - 16.5);
    }

    drawSkip() {
      const ctx = this.ctx;
      ctx.font = `700 18px ${FONT}`;
      const t = `SKIP × ${this.skipCount}`;
      const w = ctx.measureText(t).width + 24;
      ctx.fillStyle = 'rgba(30,34,52,0.85)';
      roundRect(ctx, CX - w / 2, CY - 24, w, 32, 16); ctx.fill();
      ctx.fillStyle = '#e8ecff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(t, CX, CY - 7);
    }

    drawEffects(textOnly) {
      const ctx = this.ctx;
      for (const e of this.effects) {
        if ((e.type === 'text') !== !!textOnly) continue;
        const p = 1 - e.life / e.max;
        switch (e.type) {
          case 'particle':
            ctx.globalAlpha = Math.max(0, e.life / 1.2);
            ctx.fillStyle = e.color;
            ctx.beginPath(); ctx.arc(e.x, e.y, e.size, 0, TAU); ctx.fill();
            break;
          case 'confetti':
            ctx.globalAlpha = Math.min(1, e.life);
            ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.rot);
            ctx.fillStyle = e.color; ctx.fillRect(-5, -3, 10, 6);
            ctx.restore();
            break;
          case 'chill': {
            const on = Math.sin(this.time * 23 + e.seed) > -0.2 && Math.sin(this.time * 5.3 + e.seed) > -0.6 ? 1 : 0.25, a = Math.min(1, e.life / 1.5, (e.max - e.life) / 0.3) * on;
            ctx.save(); ctx.globalCompositeOperation = 'lighter';
            const g = ctx.createRadialGradient(e.x, e.y - 45, 4, e.x, e.y - 45, 95);
            g.addColorStop(0, `rgba(150,215,255,${0.6 * a})`); g.addColorStop(1, 'rgba(150,215,255,0)');
            ctx.fillStyle = g; ctx.fillRect(e.x - 95, e.y - 140, 190, 190);
            ctx.fillStyle = `rgba(235,248,255,${0.9 * a})`;
            for (let i = 0; i < 12; i++) { const k = ((this.time * 0.4 + i / 12) % 1), px = e.x + Math.sin(i * 2.7 + e.seed) * 60, py = e.y - 100 + k * 100; ctx.fillRect(px - 1, py, 3, 1); ctx.fillRect(px, py - 1, 1, 3); }
            ctx.restore();
            break;
          }
          case 'flash': {
            const g = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, e.r * (0.5 + p));
            g.addColorStop(0, `rgba(${e.color},${0.85 * (1 - p)})`);
            g.addColorStop(1, `rgba(${e.color},0)`);
            ctx.fillStyle = g;
            ctx.beginPath(); ctx.arc(e.x, e.y, e.r * (0.5 + p), 0, TAU); ctx.fill();
            break;
          }
          case 'shield': {
            ctx.globalAlpha = 1 - p;
            ctx.strokeStyle = '#4dff9a'; ctx.lineWidth = 5;
            ctx.beginPath(); ctx.arc(e.x, e.y, 40 + p * 50, 0, TAU); ctx.stroke();
            ctx.fillStyle = '#4dff9a';
            ctx.fillRect(e.x - 6, e.y - 22, 12, 44); ctx.fillRect(e.x - 22, e.y - 6, 44, 12);
            break;
          }
          case 'ballot': {
            const x = e.x0 + (e.x1 - e.x0) * p, y = e.y0 + (e.y1 - e.y0) * p - Math.sin(p * Math.PI) * 60;
            ctx.fillStyle = e.color; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(x, y, 7, 0, TAU); ctx.fill(); ctx.stroke();
            break;
          }
          case 'text':
            ctx.globalAlpha = Math.min(1, e.life);
            ctx.font = `700 40px ${FONT}`;
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.strokeText(e.text, e.x, e.y);
            ctx.fillStyle = e.color; ctx.fillText(e.text, e.x, e.y);
            break;
          default: break;
        }
        ctx.globalAlpha = 1;
      }
    }
  }

  window.Town = Town;
})();
