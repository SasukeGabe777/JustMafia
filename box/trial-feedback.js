'use strict';
// Feedback for TRIAL games (experimental games marked `trial: true` in their module, e.g. Kill the
// King). At the end of a trial game each phone can send a thumbs up / down plus an optional short
// note. The game keeps them in memory (its TV state shows the tally) and this appends one JSON line
// per vote to <DATA_DIR>/trial-feedback.jsonl (git-ignored, like the profiles; data-dir.js), so the
// owner can read what testers thought. Nothing personal is stored: no names, no ids, no tokens.
//   TRIAL_FEEDBACK_FILE=<path>  write somewhere else (tests); 'off' turns the file off.
// Only the live server writes the file (a room with a socket namespace) unless TRIAL_FEEDBACK_FILE
// is set, so rules tests on a virtual clock never touch .data.
const fs = require('fs');
const path = require('path');

const MAX_NOTE = 200;
function fileFor() {
  const env = process.env.TRIAL_FEEDBACK_FILE;
  if (env === 'off') return null;
  if (env) return path.resolve(env);
  return path.join(require('../data-dir').DATA_DIR, 'trial-feedback.jsonl');
}
// A note as typed on a phone: no control characters or markup, one line, at most MAX_NOTE.
function cleanNote(s) {
  if (typeof s !== 'string') return '';
  return s.replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, MAX_NOTE);
}
// → true when the line was written.
function save(room, entry) {
  if (!process.env.TRIAL_FEEDBACK_FILE && !(room && room.nsp)) return false;
  const file = fileFor(); if (!file) return false;
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.appendFileSync(file, JSON.stringify({ at: new Date().toISOString(), ...entry }) + '\n');
    return true;
  } catch (e) { console.error('[trial feedback]', e.message); return false; }
}
function readAll(file = fileFor()) {
  try { return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean); } catch { return []; }
}

module.exports = { save, readAll, cleanNote, fileFor, MAX_NOTE };
