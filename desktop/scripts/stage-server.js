'use strict';
// Copy the game server (the repo's runtime files) into desktop/.stage/server and install its
// production dependencies there. electron-builder then ships that folder as resources/server.
//   node scripts/stage-server.js            (npm run build does this first)
// Only files tracked by git are copied (so stray local files never ship), minus dev-only folders.
// my-music/: only its README and folder layout ship. The songs in the repo are NOT shipped
// unless JGB_BUNDLE_MUSIC=1, because their licences must be confirmed first
// (docs/steam-release.md); players add their own songs in the app's music folder.
const fs = require('fs');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const OUT = path.resolve(__dirname, '..', '.stage', 'server');
const BUNDLE_MUSIC = process.env.JGB_BUNDLE_MUSIC === '1';
const SKIP_DIRS = ['desktop/', 'tools/', 'docs/', '.github/', '.claude/', '.data/', '.qa/', '.cache/', '.asset-audit/'];
const SKIP_FILES = new Set(['render.yaml', '.gitignore', '.gitattributes', 'AGENTS.md', 'CLAUDE.md', 'PLAN.md', 'README.md']);
const AUDIO = /\.(mp3|m4a|aac|ogg|oga|wav|webm|flac)$/i;

function gitFiles() {
  const candidates = [process.env.GIT, 'git', 'C:/Program Files/Git/cmd/git.exe', path.join(process.env.LOCALAPPDATA || '', 'Programs/Git/cmd/git.exe')].filter(Boolean);
  for (const git of candidates) {
    try { return execFileSync(git, ['ls-files', '-z'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64e6 }).split('\0').filter(Boolean); } catch { /* try the next */ }
  }
  throw new Error('git was not found. Install Git, or set GIT to git.exe, so the build copies only tracked files.');
}

function keep(f) {
  if (SKIP_DIRS.some((d) => f.startsWith(d))) return false;
  if (SKIP_FILES.has(f)) return false;
  if (f.startsWith('my-music/') && AUDIO.test(f) && !BUNDLE_MUSIC) return false;
  return true;
}

fs.rmSync(OUT, { recursive: true, force: true });
let n = 0;
for (const f of gitFiles()) {
  if (!keep(f)) continue;
  const src = path.join(ROOT, f);
  if (!fs.existsSync(src)) continue; // deleted in the working tree
  fs.mkdirSync(path.dirname(path.join(OUT, f)), { recursive: true });
  fs.copyFileSync(src, path.join(OUT, f));
  n++;
}
if (BUNDLE_MUSIC) fs.writeFileSync(path.join(OUT, '.music-bundled'), 'my-music songs are bundled in this build\n');
console.log(`  staged ${n} files → ${path.relative(process.cwd(), OUT)}${BUNDLE_MUSIC ? ' (with my-music songs)' : ''}`);

// Production dependencies only (express, socket.io, qrcode), exactly as locked.
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const r = spawnSync(npm, ['ci', '--omit=dev', '--ignore-scripts', '--no-audit', '--no-fund'], { cwd: OUT, stdio: 'inherit', shell: process.platform === 'win32' });
if (r.status !== 0) { console.error('npm ci failed in the staged server'); process.exit(1); }
console.log('  server dependencies installed');
