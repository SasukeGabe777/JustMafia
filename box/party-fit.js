'use strict';
// Party Mode: when a game starts in a party, it picks settings that fit the crowd actually in
// the room and the minutes this game has in the party plan.
//
// Each game module has `partyFit({ players, minutes, difficulty })` → the settings it wants (only the fields
// that matter for the crowd and the time, most telling first: the TV shows the first few, e.g.
// "5 orders · 45 seconds"). Anything that is not one of the field's options is dropped, so a
// hook can never put a game into a broken state. A game without the hook gets `generic()`:
// its rounds-like field scaled to the minutes.

// The option value nearest to x (numbers).
const near = (vals, x) => vals.reduce((b, v) => (Math.abs(v - x) < Math.abs(b - x) ? v : b), vals[0]);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// The combination of options whose estimated length (minutes) comes closest to the target.
// grid = { key: [values…] } with each list in order of preference (the first is the usual
// choice; each step down the list costs a little, so a near-tie keeps the usual one);
// est(settings) → minutes. Running a little short beats running long.
function best(grid, est, minutes) {
  const keys = Object.keys(grid);
  let top = null, topScore = Infinity;
  const walk = (i, cur) => {
    if (i === keys.length) {
      const pref = keys.reduce((s, k) => s + grid[k].indexOf(cur[k]), 0);
      const m = est(cur), d = m - minutes, score = (d > 0 ? d * 1.25 : -d) + pref * 0.35;
      if (score < topScore - 1e-9) { topScore = score; top = { ...cur }; }
      return;
    }
    for (const v of grid[keys[i]]) { cur[keys[i]] = v; walk(i + 1, cur); }
  };
  walk(0, {});
  return top || {};
}

// Game length presets in the Party Mode setup ("⏱️ Each game").
const LENGTHS = { quick: 5, standard: 10, long: 20 };
const tier = (m) => (m <= 7 ? 'quick' : m <= 14 ? 'standard' : 'long');

// A game without its own hook: scale its rounds-like field to the minutes, assuming its
// defaults make a ~12 minute game.
const COUNT_KEY = /^(rounds|turns|questions|hands|orders|races|debates|bombs|songs|maxRounds|trip)$/;
function generic(def, { minutes }) {
  const f = (def.fields || []).find((x) => COUNT_KEY.test(x.key) && x.options && x.options.every((o) => typeof o.value === 'number'));
  if (!f) return {};
  const base = Number((def.defaults || {})[f.key]) || f.options[0].value;
  return { [f.key]: near(f.options.map((o) => o.value), (base * minutes) / 12) };
}

// Difficulty (the setup's "How hard?"): 'easy' | 'medium' | 'hard' (Mixed is resolved per game by
// the room). A game with a difficulty has a `difficulty` field with those values, or names its own
// setting: `difficulty: { key: 'pace', values: { easy: 'easy', medium: 'normal', hard: 'sharp' } }`.
// Party Mode always sets it; the hook can use ctx.difficulty to tune other fields as well.
const LEVELS = ['easy', 'medium', 'hard'];
const LEVEL_LABEL = { easy: '🟢 Easy', medium: '🟡 Medium', hard: '🔴 Hard' };
function levelOf(def) {
  if (!def) return null;
  if (def.difficulty && typeof def.difficulty === 'object' && def.difficulty.key && def.difficulty.values) return def.difficulty;
  const f = (def.fields || []).find((x) => x.key === 'difficulty' && Array.isArray(x.options));
  if (f && LEVELS.every((l) => f.options.some((o) => o.value === l))) return { key: 'difficulty', values: { easy: 'easy', medium: 'medium', hard: 'hard' } };
  return null;
}

// Validate a hook's answer against the game's fields: → [[key, value], …] (only real options).
function clean(def, raw) {
  const out = [];
  for (const [k, v] of Object.entries(raw || {})) {
    const f = (def.fields || []).find((x) => x.key === k); if (!f) continue;
    if (f.options) { const o = f.options.find((x) => String(x.value) === String(v)); if (o) out.push([k, o.value]); }
    else if (f.type === 'bool' && typeof v === 'boolean') out.push([k, v]);
  }
  return out;
}

// What the TV says about the chosen settings: the first few option labels, trimmed
// ("🎲 Mixed (a new mode each order)" → "🎲 Mixed"; "1 room · about 15 min" → "1 room").
function labelOf(def, k, v) {
  const f = (def.fields || []).find((x) => x.key === k); if (!f || !f.options) return null;
  const o = f.options.find((x) => String(x.value) === String(v)); if (!o) return null;
  if (typeof o.value === 'boolean') return null; // "On"/"Off" means nothing on its own
  const t = String(o.label).replace(/\s*\(.*$/, '').replace(/\s*[:·].*$/, '').trim();
  return t || null;
}

// → { settings: { key: value } (valid options only), summary: ['5 orders', '45 seconds'] }
function fitSettings(def, ctx = {}) {
  if (!def || def.external) return { settings: {}, summary: [] };
  const players = clamp(Math.round(Number(ctx.players) || 0), 1, 100);
  const minutes = clamp(Number(ctx.minutes) || 10, 2, 120);
  const difficulty = LEVELS.includes(ctx.difficulty) ? ctx.difficulty : null;
  let raw = {};
  try { raw = typeof def.partyFit === 'function' ? def.partyFit({ players, minutes, tier: tier(minutes), difficulty }) : generic(def, { players, minutes }); }
  catch (e) { console.error('[party fit]', def.key, e.message); raw = generic(def, { players, minutes }); }
  raw = { ...(raw || {}) };
  // The chosen difficulty always wins over the hook's own idea of it.
  const L = difficulty && levelOf(def);
  if (L && L.values[difficulty] !== undefined) raw[L.key] = L.values[difficulty];
  const pairs = clean(def, raw);
  const settings = Object.fromEntries(pairs);
  const level = L && Object.prototype.hasOwnProperty.call(settings, L.key) ? difficulty : null;
  // The difficulty leads the chips ("🟢 Easy · 5 orders · 45 seconds").
  const rest = pairs.filter(([k]) => !(level && k === L.key)).map(([k, v]) => labelOf(def, k, v)).filter(Boolean).slice(0, 3);
  const summary = level ? [LEVEL_LABEL[level], ...rest] : rest;
  return { settings, summary, difficulty: level };
}

module.exports = { near, clamp, best, tier, LENGTHS, LEVELS, LEVEL_LABEL, levelOf, generic, fitSettings, labelOf };
