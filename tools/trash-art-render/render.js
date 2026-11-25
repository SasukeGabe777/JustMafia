'use strict';
// node render.js <jobs.js> <outDir> [idFilterRegex]
// Serves this folder + the asset folders over localhost, drives headless muted Chrome (CDP), and
// writes each job's atlas (<out>/<file>) plus <out>/_meta/<id>.json.
const http = require('node:http'), fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const { spawn } = require('node:child_process');
const WebSocket = require(process.env.WS_MODULE || 'ws');

const [, , jobsFile, outDir, filter] = process.argv;
const { roots, jobs } = require(path.resolve(jobsFile));
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => fs.existsSync(p));
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.png': 'image/png', '.jpg': 'image/jpeg', '.bin': 'application/octet-stream' };
const mounts = { '/': __dirname, ...roots };

const server = http.createServer((req, res) => {
  const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const m = Object.keys(mounts).sort((a, b) => b.length - a.length).find((k) => u.startsWith(k));
  const base = path.resolve(mounts[m]), file = path.resolve(base, '.' + u.slice(m.length - (m.endsWith('/') ? 1 : 0)));
  if (!file.startsWith(base) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'iso-chrome-'));
  const dbg = 9400 + Math.floor(Math.random() * 400);
  const chrome = spawn(CHROME, ['--headless=new', '--mute-audio', '--no-first-run', '--no-default-browser-check', '--enable-unsafe-swiftshader', '--use-angle=d3d11', '--ignore-gpu-blocklist', '--force-gpu-mem-available-mb=2048', `--remote-debugging-port=${dbg}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
  const kill = () => { try { chrome.kill(); } catch {} server.close(); };
  try {
    let info; for (let i = 0; i < 200 && !info; i++) { try { info = await (await fetch(`http://127.0.0.1:${dbg}/json/version`)).json(); } catch { await new Promise((r) => setTimeout(r, 100)); } }
    const ws = new WebSocket(info.webSocketDebuggerUrl, { maxPayload: 1024 * 1024 * 1024 }); await new Promise((r) => ws.once('open', r));
    let id = 0; const pend = new Map(); const logs = [];
    ws.on('message', (raw) => { const m = JSON.parse(raw); if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); } else if (m.method === 'Runtime.consoleAPICalled') logs.push(m.params.args.map((a) => a.value ?? a.description).join(' ')); else if (m.method === 'Runtime.exceptionThrown') logs.push('EXC ' + JSON.stringify(m.params.exceptionDetails).slice(0, 600)); });
    const send = (method, params = {}, sessionId) => { const i = ++id; ws.send(JSON.stringify({ id: i, method, params, sessionId })); return new Promise((res, rej) => pend.set(i, { res, rej })); };
    const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
    await send('Runtime.enable', {}, sessionId); await send('Page.enable', {}, sessionId);
    await send('Page.navigate', { url: `http://127.0.0.1:${port}/render.html` }, sessionId);
    const ev = async (expression) => { const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, sessionId); if (r.exceptionDetails) throw new Error((r.exceptionDetails.exception && r.exceptionDetails.exception.description) || r.exceptionDetails.text); return r.result.value; };
    for (let i = 0; i < 100; i++) { if (await ev('!!(window.ISO && window.ISO.ready)').catch(() => false)) break; await new Promise((r) => setTimeout(r, 100)); }
    if (!(await ev('!!(window.ISO && window.ISO.ready)'))) throw new Error('page not ready: ' + logs.join('\n'));
    console.log('GPU:', await ev(`(() => { const c = document.createElement('canvas').getContext('webgl2'); const e = c.getExtension('WEBGL_debug_renderer_info'); return e ? c.getParameter(e.UNMASKED_RENDERER_WEBGL) : 'n/a'; })()`));
    if (process.env.EVAL) { console.log(await ev(process.env.EVAL)); return; }
    fs.mkdirSync(path.join(outDir, '_meta'), { recursive: true });
    const re = filter ? new RegExp(filter) : null;
    for (const j of jobs) {
      if (re && !re.test(j.id)) continue;
      const t0 = Date.now();
      try {
        const r = await ev(`ISO.job(${JSON.stringify(j.spec)})`);
        const out = path.join(outDir, j.file); fs.mkdirSync(path.dirname(out), { recursive: true });
        fs.writeFileSync(out, Buffer.from(r.data.split(',')[1], 'base64'));
        fs.writeFileSync(path.join(outDir, '_meta', j.id + '.json'), JSON.stringify({ id: j.id, file: j.file, ...r.meta, ...(j.extra || {}) }));
        console.log('ok', j.id, j.file, (fs.statSync(out).size / 1024).toFixed(0) + 'K', ((Date.now() - t0) / 1000).toFixed(1) + 's');
      } catch (e) { console.log('FAIL', j.id, e.message.slice(0, 400)); }
    }
    if (logs.length) console.log('page log:', logs.slice(-60).join('\n'));
  } finally { kill(); }
})().catch((e) => { console.error(e); process.exit(1); });
