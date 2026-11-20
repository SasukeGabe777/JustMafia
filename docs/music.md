# Soundtrack (recorded music)

JustGameBox ships a recorded instrumental soundtrack in `public/audio/music/`. Where a cue has
a recording, it plays instead of the synthesized score; every cue without one (and any file
that fails to load) still plays the old synth score, so nothing ever goes silent.

**The music is AI-generated.** Every track was generated locally with ACE-Step 1.5 (details
below). Steam requires disclosing AI-generated content: declare it in the Steamworks "AI
Generated Content" section (pre-generated content: the background music), for example:

> The game's background music was generated with the open-source ACE-Step 1.5 music model
> (MIT license) and curated by the developers. All other audio is original.

## Model and license

| | |
| --- | --- |
| Model | ACE-Step 1.5 (`ACE-Step/Ace-Step1.5` on Hugging Face: `acestep-v15-turbo` DiT + `acestep-5Hz-lm-1.7B` planner LM, VAE, Qwen3-Embedding-0.6B text encoder) |
| Code | github.com/ace-step/ACE-Step-1.5 (commit `ca1e85f`), MIT License |
| Weights | MIT License (model card: "You can strictly use the generated music for commercial purposes") |
| Outputs | owned by us; no attribution required (we credit the model anyway, see `THIRD_PARTY.md`) |

Not used, on purpose: Suno / Udio free plans (no commercial use), MusicGen (weights
CC-BY-NC), Stable Audio Open (fine under $1M revenue only).

## How cues find their track

`public/audio/music/manifest.json` (written by `tools/music/pick.js`):

- **Box games** (`public/box/audio.js`): `games.<scoreKey>.<cue>`, else the game's mood set
  `sets.<set>.<cue>` (`games.<key>.set`, default `party`), else `aliases.<cue>` (e.g.
  `story` -> `think`), else the synth score. Sets: `party` (game-show funk), `jazz` (lounge /
  noir / spy), `spooky` (zombie, alien), `epic` (kingdoms, summon, president), `acoustic`
  (ducks, spectrum, marble, sketch, colormatch, actout, pizza, quickdraw). The main menu is
  `games.menu.title`, the shop `games.menu.shop`, Party Mode `games.party.*`.
- **JustMafia** (`public/music.js`, the `mafia` section): `worlds.<world>.<mood>` (each world's
  own `lobby` and `day`), else the world's tone set `tones.<tone>.<mood>` (Noir has its own),
  else the shared `moods.<mood>`, else the composed chiptune. Moods: `lobby day reveal dawn
  night suspense vote trial eerie triumph`.
- Each entry: `{ "file": "sets/party/think.ogg", "loopStart": 4.12, "loopEnd": 71.9 }`
  (`gain` and `"loop": false` optional). The part before `loopStart` is an intro that plays
  once; then `loopStart`..`loopEnd` repeats sample-accurately (the file's tail is already
  crossfaded into the loop start, so the seam is inaudible).

Playback is Web Audio (decoded once, `AudioBufferSourceNode` with loop points) on the same
music bus as the synth, so the volume sliders, mute, the narrator ducking and the crossfades
between cues all work the same. Stingers and sound effects stay synthesized.

**Your own music (my-music/)** still works in JustMafia: in *Game + my music* mode one of your
songs plays after each pass of the recorded track, *My music only* plays only yours, *Game
music only* plays only the soundtrack.

## Swapping a track

The listening folder (every candidate as mp3, the chosen ones marked `__CHOSEN`, with a
`README.txt` table) is printed by the generation run. To use another candidate:

    node tools/music/pick.js <candidates dir> --use sets/party/think=142

`pick.js` copies that candidate's `.ogg` into `public/audio/music/`, rewrites the manifest with
its loop points and remembers the choice in `tools/music/picks.json`. To use a track of your
own instead, drop an `.ogg` / `.webm` (Opus) or `.mp3` in `public/audio/music/` and point the
cue's `file` at it in `manifest.json` (leave out `loopStart` / `loopEnd` to loop the whole file).

## Regenerating

Everything needed is in `tools/music/`:

| file | what it does |
| --- | --- |
| `catalog.json` | every cue: id, prompt (caption), bpm, key, time signature, length, seeds, tier |
| `gen.py` | renders cues with ACE-Step 1.5 (`--lm 1.7B`, turbo, 8 steps, shift 3, instrumental) |
| `process.py` | per candidate: trims, finds a bar-aligned loop (beat grid from the bpm, spectral match of the seam, waveform alignment, equal-power crossfade), normalizes to -16 LUFS integrated with peaks under -1 dBFS, checks clipping / silence / vocals (Demucs htdemucs vocal-stem energy), scores it, encodes Opus 96 kbps (game) and mp3 (listening) |
| `pick.js` | chooses the best candidate per cue (or `picks.json`), copies files, writes the manifest |

Setup (Windows, NVIDIA GPU, ~10 GB disk, outside the repo):

    winget install -e --id Python.Python.3.11 --scope user
    python -m pip install --user uv
    git clone https://github.com/ace-step/ACE-Step-1.5 %LOCALAPPDATA%\jgb-music\ACE-Step-1.5
    cd %LOCALAPPDATA%\jgb-music\ACE-Step-1.5 && uv sync
    uv pip install pyloudnorm imageio-ffmpeg
    uv pip install --no-deps demucs julius openunmix dora-search treetable retrying submitit lameenc

Run (weights download on first use, ~10 GB):

    .venv\Scripts\python.exe <repo>\tools\music\gen.py <repo>\tools\music\catalog.json ..\work\raw --lm 1.7B
    .venv\Scripts\python.exe <repo>\tools\music\process.py ..\work\raw ..\work\done
    node <repo>\tools\music\pick.js %LOCALAPPDATA%\jgb-music\work\done --listen <folder>

`TIER=1,2` limits `gen.py` to some tiers; `--only menu/title,sets/party/*` to some cues. The
same seed and settings give the same track. Never commit the venv, weights or raw renders.

## Size

The committed `.ogg` files are listed with their sizes by `pick.js`. Keep the total under
about 80 MB; beyond that, move the music out of git (Git LFS, or a download step at build
time) rather than bloating the repository history.
