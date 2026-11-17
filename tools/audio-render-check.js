'use strict';
// Offline render check for the JustGameBox soundtrack (public/box/audio.js + scores).
// Renders 8 bars of every cue (and every stinger) in headless Chrome with an
// OfflineAudioContext and reports peak / RMS (after the master chain), the pre-master peak,
// clipping, the largest voice count and render speed (x real time).
//   node tools/audio-render-check.js            all scores
//   node tools/audio-render-check.js price bid  just these
// Exit code 1 if anything clips, is near-silent or fails to render.
const path = require('node:path');
const fs = require('node:fs');
const { Browser, startServer, cleanup } = require('./cdp');

const PORT = Number(process.env.PORT_AUDIO || 3963), URL = `http://localhost:${PORT}`;
const ALL = fs.readdirSync(path.join(__dirname, '..', 'public', 'box', 'scores')).filter((f) => /^[a-z]\w*\.js$/.test(f)).map((f) => f.replace(/\.js$/, ''));
const want = process.argv.slice(2).filter((a) => !a.startsWith('-'));
const keys = want.length ? want : ALL;

(async () => {
  await startServer(PORT);
  const browser = new Browser({ debugPort: 9363 }); await browser.launch();
  const page = await browser.page();
  await page.go(URL + '/');
  await page.eval(`new Promise((r) => { if (window.BOX && BOX.audio) return r(); const s = document.createElement('script'); s.src = '/box/audio.js'; s.onload = r; document.head.appendChild(s); })`);
  let bad = 0, rows = [], totalAudio = 0, totalMs = 0;
  for (const key of keys) {
    await page.eval(`new Promise((r) => BOX.audio.need(${JSON.stringify(key)}, r))`);
    const cues = await page.eval(`BOX.audio.cues(${JSON.stringify(key)})`);
    const stings = await page.eval(`Object.keys((BOX.scores[${JSON.stringify(key)}] || {}).stingers || {})`);
    for (const [name, st] of [...cues.map((c) => [c, false]), ...stings.map((s) => [s, true])]) {
      let r;
      try { r = await page.eval(`BOX.audio.render(${JSON.stringify(key)}, ${JSON.stringify(name)}, 8, { stinger: ${st} })`); } catch (e) { r = { label: key + '/' + name, error: e.message }; }
      const label = (st ? '  sting ' : '') + (r.label || key + '/' + name);
      let flag = '';
      if (r.error) flag = 'ERROR ' + r.error;
      else if (r.clipped > 0) flag = 'CLIPS';
      else if (r.peakDb > -0.2) flag = 'HOT';
      else if (r.rmsDb < (st ? -45 : -34)) flag = 'QUIET';
      else if (r.prePeakDb > 3) flag = 'DRIVEN';
      if (flag && flag !== 'DRIVEN') bad++;
      if (!r.error) { totalAudio += r.seconds; totalMs += r.renderMs; }
      rows.push(r.error ? `${label.padEnd(40)} ${flag}` : `${label.padEnd(40)} peak ${String(r.peakDb).padStart(6)} dB  rms ${String(r.rmsDb).padStart(6)} dB  pre ${String(r.prePeakDb).padStart(6)} dB  voices ${String(r.maxVoices).padStart(3)}  ${String(r.speed).padStart(6)}x  ${flag}`);
      console.log(rows[rows.length - 1]);
    }
  }
  if (page.errors.length) { console.log('PAGE ERRORS:\n' + page.errors.join('\n')); bad++; }
  console.log(`\n${rows.length} renders, ${Math.round(totalAudio)} s of audio in ${Math.round(totalMs / 1000)} s (${Math.round(totalAudio / (totalMs / 1000) * 10) / 10}x real time). ${bad ? bad + ' problem(s)' : 'All OK'}`);
  cleanup(); process.exit(bad ? 1 : 0);
})().catch((e) => { console.error(e); cleanup(); process.exit(1); });
