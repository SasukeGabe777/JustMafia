"""Orpheus TTS renderer for tools/voice-gen.js (the default engine; `npm run voices` drives it).

  python tools/voice-orpheus.py <jobs.json> <out_dir>      render (same protocol as voice-chatterbox.py)
  python tools/voice-orpheus.py --measure <dir>             print the delivery metrics of every wav in dir

jobs.json: {"jobs": [{id, text, voice, energetic, pri}]}; voice is an Orpheus voice (tara, leah, jess,
leo, dan, mia, zac, zoe). Writes <out_dir>/<id>.wav (24 kHz mono float, trimmed, long pauses tightened,
loudness-normalized) and one JSON line per clip to <out_dir>/results.jsonl; resumes where it stopped.

Model: Orpheus TTS 0.1-ft (Canopy Labs; code Apache-2.0, weights Apache-2.0 on a Llama-3.2-3B base, so
the Llama 3.2 Community License applies too: commercial use allowed) as the unsloth Q8_0 GGUF, run with
llama.cpp (llama-cpp-python, CUDA), decoded with SNAC 24 kHz (MIT).

Quality gate (every clip; the best of up to VOICE_TRIES seeds is kept):
  * transcribe back with faster-whisper: word error rate above 12% = wrong words or babbling;
  * a pause inside the line longer than 0.9 s (before tightening) = a glitch;
  * quiet / breathy / whispered takes: the raw speech level, the spectral flatness (breath noise is
    flat) and, for energetic hosts, the pitch movement (a flat, low monotone sounds creepy).
"""
import importlib.util
import json
import re
import os
import sys
import time

import numpy as np
import soundfile as sf
import torch

HERE = os.path.dirname(os.path.abspath(__file__))
_spec = importlib.util.spec_from_file_location('cbx', os.path.join(HERE, 'voice-chatterbox.py'))
C = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(C)  # shared: words/wer/trim/silence/whisper/GPU limits
log = C.log

SR = 24000
GGUF = ('unsloth/orpheus-3b-0.1-ft-GGUF', 'orpheus-3b-0.1-ft-Q8_0.gguf')
MAX_TRIES = int(os.environ.get('VOICE_TRIES', '4'))
PAUSE_KEEP_MS = 260   # internal pauses are tightened to at most this (a brisker delivery; job.pause: 450 for narrators)
TARGET_RMS = 0.112    # -19 dBFS speech level, the same as voice-gen.js
# Delivery limits, calibrated on the round-2 takes: the owner's good leo/dan had a raw speech level of
# -17.7..-21.4 dB and 4.3..5.8 semitones of pitch movement; the "quiet and scary" tara -21.6..-26.7 dB, 3.4..4.3.
MIN_LEVEL_DB = float(os.environ.get('VOICE_MIN_LEVEL_DB', '-23'))   # raw speech level
MAX_FLATNESS = float(os.environ.get('VOICE_MAX_FLATNESS', '0.05'))   # breathiness
MIN_PITCH_ST = float(os.environ.get('VOICE_MIN_PITCH_ST', '3.8'))    # pitch movement (semitones) for energetic hosts


# ---------------------------------------------------------------- signal measures
def frames(x, win):
    n = len(x) // win
    return x[: n * win].reshape(n, win) if n else np.zeros((0, win), np.float32)


def level_db(x):
    f = frames(x, int(SR * 0.02))
    e = (f ** 2).mean(axis=1) if len(f) else np.zeros(0)
    act = e[e > 1e-5]
    return 10 * np.log10(act.mean()) if len(act) else -99.0


def flatness(x):
    import librosa
    fl = librosa.feature.spectral_flatness(y=x, n_fft=1024, hop_length=256)[0]
    rms = librosa.feature.rms(y=x, frame_length=1024, hop_length=256)[0]
    act = fl[rms > max(1e-4, np.percentile(rms, 60) * 0.5)]
    return float(np.mean(act)) if len(act) else 1.0


def pitch_st(x):
    import librosa
    f0 = librosa.yin(x, fmin=65, fmax=450, sr=SR, frame_length=2048, hop_length=256)
    rms = librosa.feature.rms(y=x, frame_length=2048, hop_length=256)[0][: len(f0)]
    v = f0[(rms > np.percentile(rms, 50)) & (f0 > 66) & (f0 < 445)]
    return float(np.std(12 * np.log2(v))) if len(v) > 8 else 0.0


def tighten(x, keep_ms=PAUSE_KEEP_MS):
    """Shorten every pause longer than PAUSE_KEEP_MS to PAUSE_KEEP_MS (keeps commas and full stops audible)."""
    win = int(SR * 0.02)
    f = frames(x, win)
    if not len(f):
        return x
    e = np.sqrt((f ** 2).mean(axis=1) + 1e-12)
    quiet = e < max(np.percentile(e, 95) * 0.03, 1e-4)
    keep = keep_ms // 20
    out, run = [], 0
    for i in range(len(f)):
        run = run + 1 if quiet[i] else 0
        if run <= keep:
            out.append(f[i])
    return np.concatenate(out + [x[len(f) * win:]]) if out else x


def normalize(x):
    """Speech RMS to -19 dBFS with a soft knee above 0.75 (as voice-gen.js does)."""
    win = int(SR * 0.02)
    f = frames(x, win)
    e = (f ** 2).mean(axis=1) if len(f) else np.zeros(0)
    act = e[e > 1e-5]
    rms = float(np.sqrt(act.mean())) if len(act) else 0.0
    g = min(8.0, TARGET_RMS / rms) if rms > 0 else 1.0
    y = x * g
    a = np.abs(y)
    k = 0.75
    m = a > k
    y[m] = np.sign(y[m]) * (k + (0.99 - k) * np.tanh((a[m] - k) / (0.99 - k)))
    return y.astype(np.float32)


def measure(x, energetic):
    lv, fl, ps = level_db(x), flatness(x), pitch_st(x)
    bad = []
    if lv < MIN_LEVEL_DB:
        bad.append('quiet')
    if fl > MAX_FLATNESS:
        bad.append('breathy')
    if energetic and ps < MIN_PITCH_ST:
        bad.append('flat')
    return {'level_db': round(lv, 1), 'flatness': round(fl, 3), 'pitch_st': round(ps, 2)}, bad


# ---------------------------------------------------------------- model
class Orpheus:
    def __init__(self):
        if hasattr(os, 'add_dll_directory'):
            os.add_dll_directory(os.path.join(os.path.dirname(torch.__file__), 'lib'))  # CUDA runtime for llama.cpp
        from huggingface_hub import hf_hub_download
        from llama_cpp import Llama
        from snac import SNAC
        torch.cuda.set_per_process_memory_fraction(C.GPU_FRACTION)
        C.wait_for_room()
        self.llm = Llama(model_path=hf_hub_download(*GGUF), n_gpu_layers=-1, n_ctx=8192, verbose=False)
        self.snac = SNAC.from_pretrained('hubertsiuzdak/snac_24khz').eval().to('cuda')

    def say(self, voice, text, seed, max_s=45):
        llm = self.llm
        toks = [128259, 128000] + llm.tokenize(f'{voice}: {text}'.encode('utf-8'), add_bos=False, special=False) + [128009, 128260, 128261, 128257]
        llm.reset()
        llm.set_seed(seed)
        codes = []
        for t in llm.generate(toks, temp=0.6, top_p=0.9, repeat_penalty=1.1, reset=True):
            if t in (128258, 128009) or len(codes) > 7 * 12 * max_s:
                break
            if t >= 128266:
                codes.append(t - 128266)
        n = len(codes) // 7
        L = ([], [], [])
        for i in range(n):
            c = codes[7 * i: 7 * i + 7]
            L[0].append(c[0]); L[1].append(c[1] - 4096); L[2].append(c[2] - 2 * 4096); L[2].append(c[3] - 3 * 4096)
            L[1].append(c[4] - 4 * 4096); L[2].append(c[5] - 5 * 4096); L[2].append(c[6] - 6 * 4096)
        if not n or any(v < 0 or v > 4095 for l in L for v in l):
            return None
        with torch.inference_mode():
            a = self.snac.decode([torch.tensor(l, device='cuda').unsqueeze(0) for l in L])
        return a.squeeze().float().cpu().numpy()


def render_one(model, wm, j):
    text, nwords = j['text'], max(1, len(C.words(j['text'])))
    best = None
    for t in range(MAX_TRIES):
        C.wait_for_room()
        try:
            x = model.say(j['voice'], text, 1234 + t * 7919 + int(j.get('seed', 0)), max_s=min(60, 4 + len(text) / 9))
        except OSError as e:  # llama.cpp error: try another seed
            log('  llama.cpp error, retrying: ' + str(e)[:80])
            x = None
        if x is None or len(x) < SR * 0.2:
            continue
        x = C.trim(x, SR)
        sil = C.longest_silence_ms(x, SR)
        m, bad = measure(x, j.get('energetic'))
        y = normalize(tighten(x, int(j.get('pause', PAUSE_KEEP_MS))))
        heard = C.hear(wm, y, SR)
        w = C.wer(re.sub(r'<\w+>', ' ', text), heard)  # emotion tags (<laugh>) are not words
        too_long = len(y) / SR > 2 + len(text) * 0.095
        score = w + (0.5 if sil > C.SIL_MAX_MS else 0) + (0.5 if too_long else 0) + 0.3 * len(bad)
        r = {'id': j['id'], 'ms': int(len(y) / SR * 1000), 'wer': round(w, 3), 'heard': heard, 'silence_ms': sil, 'long': too_long, 'bad': bad, **m, 'tries': t + 1, 'score': round(score, 3)}
        if best is None or score < best[0]['score']:
            best = (r, y)
        if score <= C.WER_OK:
            break
        torch.cuda.empty_cache()
    return best


def main():
    if sys.argv[1] == '--measure':
        d = sys.argv[2]
        for f in sorted(os.listdir(d)):
            if f.endswith('.wav'):
                x, sr = sf.read(os.path.join(d, f), dtype='float32')
                x = C.trim(x if x.ndim == 1 else x.mean(axis=1), sr)
                m, bad = measure(x, True)
                print(f'{f:52s} {m} {bad}')
        return
    jobs_path, out = sys.argv[1], sys.argv[2]
    os.makedirs(out, exist_ok=True)
    spec = json.load(open(jobs_path, encoding='utf-8'))
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
    todo.sort(key=lambda j: (j.get('pri', 0), j['voice']))
    log(f'{len(spec["jobs"])} jobs, {len(done)} already rendered, {len(todo)} to go')
    if not todo:
        return
    t0 = time.time()
    model = Orpheus()
    wm, wdev = C.load_whisper()
    log(f'Orpheus (Q8 GGUF, llama.cpp CUDA) + whisper {C.WHISPER} on {wdev} ready in {time.time() - t0:.0f} s')
    audio_s, tr = 0.0, time.time()
    with open(res_path, 'a', encoding='utf-8') as rf:
        for n, j in enumerate(todo):
            best = render_one(model, wm, j)
            if best is None:
                log(f'  FAILED (no audio): "{j["text"][:70]}"')
                continue
            r, y = best
            r['ok'] = r['score'] <= C.WER_OK + 1e-9
            sf.write(os.path.join(out, j['id'] + '.wav'), y, SR, subtype='FLOAT')
            rf.write(json.dumps(r) + '\n')
            rf.flush()
            audio_s += r['ms'] / 1000
            if not r['ok']:
                log(f'  kept best of {r["tries"]}: wer {r["wer"]} {r["bad"]} pause {r["silence_ms"]}: "{j["text"][:60]}" heard "{r["heard"][:60]}"')
            if (n + 1) % 20 == 0 or n == len(todo) - 1:
                el = time.time() - tr
                log(f'  {n + 1}/{len(todo)}  {el / 60:.0f} min  ({audio_s / 60:.1f} min of speech, x{audio_s / max(1, el):.2f} real time)')


if __name__ == '__main__':
    main()
