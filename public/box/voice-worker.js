// JustGameBox live narrator voice: kokoro-js (MIT) running the Kokoro-82M model (Apache-2.0)
// on WebGPU, off the main thread so the cutscene animation never stutters. Started by
// public/box/voice.js only when the "Natural live voice" setting is on.
//   in:  { type: 'init', url }  then  { type: 'say', id, text, voice, speed }
//   out: { type: 'ready' } | { type: 'error', error } | { type: 'done', id, blob (WAV), ms } | { type: 'fail', id, error }
let tts = null, queue = Promise.resolve();
self.onmessage = (e) => {
  const m = e.data || {};
  if (m.type === 'init') {
    queue = queue.then(async () => {
      try {
        const { KokoroTTS } = await import(m.url);
        tts = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', { dtype: 'fp16', device: 'webgpu' });
        await tts.generate('Hi.', { voice: 'af_heart' }); // warm up the GPU kernels
        self.postMessage({ type: 'ready' });
      } catch (err) { self.postMessage({ type: 'error', error: String((err && err.message) || err) }); }
    });
  } else if (m.type === 'say') {
    queue = queue.then(async () => {
      if (!tts) return self.postMessage({ type: 'fail', id: m.id, error: 'not loaded' });
      try {
        const a = await tts.generate(m.text, { voice: m.voice, speed: m.speed || 1 });
        self.postMessage({ type: 'done', id: m.id, blob: a.toBlob(), ms: Math.round((a.audio.length / a.sampling_rate) * 1000) });
      } catch (err) { self.postMessage({ type: 'fail', id: m.id, error: String((err && err.message) || err) }); }
    });
  }
};
