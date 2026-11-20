"""Chatterbox TTS renderer for tools/voice-gen.js (do not run by hand; `npm run voices` drives it).

  python tools/voice-chatterbox.py <jobs.json> <out_dir>

jobs.json: {"refs": {voice: ref_wav}, "jobs": [{id, text, voice, exaggeration, cfg, temperature}]}
For every job it writes <out_dir>/<id>.wav (24 kHz mono float) and appends one JSON line to
<out_dir>/results.jsonl: {id, ms, wer, heard, silence_ms, clip, tries, ok}. Jobs that already
have a result line are skipped, so an interrupted run resumes where it stopped.

Quality gate (every clip): the clip is transcribed back with faster-whisper (MIT) and re-rendered
with a new seed (up to MAX_TRIES) when the word error rate is high, it has a long silence inside,
it clips, or it runs far longer than the text needs (a sign of babbling). The best try is kept.

Model: Chatterbox (Resemble AI, MIT licence, weights ResembleAI/chatterbox on Hugging Face).
Its output carries Resemble's imperceptible Perth watermark. The voice of each clip is cloned
from a short reference clip of that host's own Kokoro voice (Kokoro-82M, Apache-2.0), so every
host keeps its identity.
"""
import json
import os
import re
import sys
import time

import numpy as np
import soundfile as sf
import torch

SR_OUT = 24000
MAX_TRIES = int(os.environ.get('VOICE_TRIES', '4'))
WER_OK = 0.12          # accept at or below this word error rate
SIL_MAX_MS = 900       # a pause inside a line longer than this is a glitch
WHISPER = os.environ.get('VOICE_WHISPER', 'small.en')


def log(*a):
    print(*a, flush=True)


# ---------------------------------------------------------------- text checks
NUMS = {'0': 'zero', '1': 'one', '2': 'two', '3': 'three', '4': 'four', '5': 'five', '6': 'six', '7': 'seven', '8': 'eight', '9': 'nine', '10': 'ten'}


def words(s):
    import unicodedata
    s = unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode('ascii') if any(ord(c) > 127 and c not in '’‘…—–' for c in s) else s
    s = s.lower().replace('’', "'").replace('‘', "'")
    s = re.sub(r"[^a-z0-9' ]+", ' ', s)
    out = []
    for w in s.split():
        w = w.strip("'")
        if not w:
            continue
        out.append(NUMS.get(w, w))
    return out


def edits(r, h):
    d = list(range(len(h) + 1))
    for i in range(1, len(r) + 1):
        prev, d[0] = d[0], i
        for j in range(1, len(h) + 1):
            cur = d[j]
            d[j] = min(d[j] + 1, d[j - 1] + 1, prev + (0 if r[i - 1] == h[j - 1] else 1))
            prev = cur
    return d[len(h)]


def wer(ref, hyp):
    """Word error rate, forgiving spelling-only differences: when the letters match almost exactly
    ("JustBid" vs "Just Bid", "Tia" vs "Tía") the character error rate is used instead."""
    r, h = words(ref), words(hyp)
    if not r:
        return 0.0
    w = edits(r, h) / len(r)
    rc, hc = ''.join(r).replace("'", ''), ''.join(h).replace("'", '')
    c = edits(rc, hc) / max(1, len(rc))
    return min(w, c * 2)


def trim(x, sr):
    a = np.abs(x)
    idx = np.where(a > 0.01)[0]
    if not len(idx):
        return x
    s = max(0, idx[0] - int(sr * 0.03))
    e = min(len(x), idx[-1] + int(sr * 0.12))
    return x[s:e]


def longest_silence_ms(x, sr):
    win = int(sr * 0.02)
    if len(x) < win * 3:
        return 0
    n = len(x) // win
    e = np.sqrt((x[: n * win].reshape(n, win) ** 2).mean(axis=1) + 1e-12)
    peak = np.percentile(e, 95)
    quiet = e < max(peak * 0.03, 1e-4)
    best = cur = 0
    for q in quiet:
        cur = cur + 1 if q else 0
        best = max(best, cur)
    return best * 20


def clip_ratio(x):
    return float((np.abs(x) >= 0.995).mean()) if len(x) else 0.0


# ---------------------------------------------------------------- models
def load_whisper():
    from faster_whisper import WhisperModel
    try:
        # CTranslate2 finds cuBLAS/cuDNN next to torch's own CUDA DLLs.
        lib = os.path.join(os.path.dirname(torch.__file__), 'lib')
        if hasattr(os, 'add_dll_directory') and os.path.isdir(lib):
            os.add_dll_directory(lib)
        m = WhisperModel(WHISPER, device='cuda', compute_type='float16')
        m.transcribe(np.zeros(16000, dtype=np.float32), language='en')
        return m, 'cuda'
    except Exception as e:  # no usable CUDA for CTranslate2: CPU is fine for short clips
        log('whisper on CPU (' + str(e).split('\n')[0][:120] + ')')
        return WhisperModel(WHISPER, device='cpu', compute_type='int8'), 'cpu'


def hear(wm, x, sr):
    import librosa
    y = librosa.resample(x.astype(np.float32), orig_sr=sr, target_sr=16000)
    segs, _ = wm.transcribe(y, language='en', beam_size=3, vad_filter=False, condition_on_previous_text=False)
    return ' '.join(s.text.strip() for s in segs).strip()


def load_tts():
    from chatterbox.tts import ChatterboxTTS
    for i in range(60):
        try:
            return ChatterboxTTS.from_pretrained(device='cuda')
        except torch.cuda.OutOfMemoryError:
            log('CUDA out of memory loading the model (the GPU is shared); waiting 30 s')
            torch.cuda.empty_cache()
            time.sleep(30)
    raise RuntimeError('GPU stayed full')


def gen(model, text, job, seed):
    for i in range(40):
        try:
            torch.manual_seed(seed)
            with torch.inference_mode():
                w = model.generate(text, exaggeration=float(job.get('exaggeration', 0.5)), cfg_weight=float(job.get('cfg', 0.5)), temperature=float(job.get('temperature', 0.8)))
            return w.squeeze(0).float().cpu().numpy()
        except torch.cuda.OutOfMemoryError:
            log('  CUDA out of memory (the GPU is shared); waiting 20 s')
            torch.cuda.empty_cache()
            time.sleep(20)
    raise RuntimeError('GPU stayed full')


def decode(path):
    import av
    with av.open(path) as f:
        rs = av.AudioResampler(format='flt', layout='mono', rate=SR_OUT)
        parts = []
        for fr in f.decode(audio=0):
            for o in rs.resample(fr):
                parts.append(o.to_ndarray().reshape(-1))
        for o in rs.resample(None):
            parts.append(o.to_ndarray().reshape(-1))
    return np.concatenate(parts) if parts else np.zeros(0, np.float32)


def build_refs(spec, out):
    """A ~10 s reference per voice, stitched from that voice's own existing Kokoro clips."""
    refs = {}
    rdir = os.path.join(out, 'refs')
    os.makedirs(rdir, exist_ok=True)
    # A saved reference (tools/voice-refs/<voice>.webm): decode it once.
    for voice, fp in (spec.get('ref_files') or {}).items():
        p = os.path.join(rdir, voice + '.from-repo.wav')
        refs[voice] = p
        if not os.path.exists(p):
            sf.write(p, decode(fp), SR_OUT, subtype='PCM_16')
    for voice, files in (spec.get('ref_sources') or {}).items():
        p = os.path.join(rdir, voice + '.wav')
        refs[voice] = p
        if os.path.exists(p):
            continue
        clips = []
        for fp in files:
            try:
                x = trim(decode(fp), SR_OUT)
                if 1.5 < len(x) / SR_OUT < 7:
                    clips.append(x)
            except Exception as e:
                log('  could not decode ' + fp + ': ' + str(e))
        # Medium-length lines first: they carry the most natural sentence melody.
        clips.sort(key=lambda x: abs(len(x) / SR_OUT - 3.5))
        gap = np.zeros(int(SR_OUT * 0.3), np.float32)
        y, total = [], 0.0
        for x in clips:
            y += [x, gap]
            total += len(x) / SR_OUT + 0.3
            if total >= 10:
                break
        if not y:
            raise RuntimeError('no reference audio for ' + voice)
        y = np.concatenate(y)
        y = y / max(1e-6, np.abs(y).max()) * 0.9
        sf.write(p, y, SR_OUT, subtype='PCM_16')
        log(f'  reference {voice}: {total:.1f} s of its own Kokoro clips')
    return refs


def main():
    jobs_path, out = sys.argv[1], sys.argv[2]
    os.makedirs(out, exist_ok=True)
    spec = json.load(open(jobs_path, encoding='utf-8'))
    spec['refs'] = {**build_refs(spec, out), **(spec.get('refs') or {})}
    res_path = os.path.join(out, 'results.jsonl')
    done = set()
    if os.path.exists(res_path):
        for ln in open(res_path, encoding='utf-8'):
            try:
                r = json.loads(ln)
                if os.path.exists(os.path.join(out, r['id'] + '.wav')):
                    done.add(r['id'])
            except Exception:
                pass
    todo = [j for j in spec['jobs'] if j['id'] not in done]
    log(f'{len(spec["jobs"])} jobs, {len(done)} already rendered, {len(todo)} to go')
    if not todo:
        return
    t0 = time.time()
    model = load_tts()
    wm, wdev = load_whisper()
    log(f'models ready in {time.time() - t0:.0f} s (whisper {WHISPER} on {wdev})')
    # Group by voice so each reference is prepared once.
    todo.sort(key=lambda j: (j['voice'], j.get('exaggeration', 0.5)))
    cur_ref = None
    audio_s = 0.0
    tr = time.time()
    with open(res_path, 'a', encoding='utf-8') as rf:
        for n, j in enumerate(todo):
            ref = spec['refs'][j['voice']]
            key = (ref, j.get('exaggeration', 0.5))
            if key != cur_ref:
                model.prepare_conditionals(ref, exaggeration=float(j.get('exaggeration', 0.5)))
                cur_ref = key
            text = j['text']
            nwords = max(1, len(words(text)))
            best = None
            for t in range(MAX_TRIES):
                x = trim(gen(model, text, j, 1234 + t * 7919 + int(j.get('seed', 0))), model.sr)
                ms = int(len(x) / model.sr * 1000)
                heard = hear(wm, x, model.sr) if len(x) > model.sr * 0.15 else ''
                w = wer(text, heard)
                sil = longest_silence_ms(x, model.sr)
                cr = clip_ratio(x)
                too_long = ms > 1500 + len(text) * 95
                score = w + (0.5 if sil > SIL_MAX_MS else 0) + (0.5 if cr > 0.002 else 0) + (0.5 if too_long else 0)
                r = {'id': j['id'], 'ms': ms, 'wer': round(w, 3), 'heard': heard, 'silence_ms': sil, 'clip': round(cr, 5), 'long': too_long, 'tries': t + 1, 'score': round(score, 3)}
                if best is None or score < best[0]['score']:
                    best = (r, x)
                if w <= WER_OK and sil <= SIL_MAX_MS and cr <= 0.002 and not too_long:
                    break
            r, x = best
            r['ok'] = r['score'] <= WER_OK + 1e-9
            sf.write(os.path.join(out, j['id'] + '.wav'), x, model.sr, subtype='FLOAT')
            rf.write(json.dumps(r) + '\n')
            rf.flush()
            audio_s += r['ms'] / 1000
            if not r['ok']:
                log(f'  check failed after {r["tries"]} tries: wer {r["wer"]} sil {r["silence_ms"]} long {r["long"]}: "{text[:70]}" heard "{r["heard"][:70]}"')
            if (n + 1) % 20 == 0 or n == len(todo) - 1:
                el = time.time() - tr
                log(f'  {n + 1}/{len(todo)}  {el:.0f} s  ({audio_s:.0f} s of speech, x{audio_s / max(1, el):.2f} real time)')


if __name__ == '__main__':
    main()
