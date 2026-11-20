# Soundtrack and sound effects (recorded audio)

The box games ship real recorded music and a few quiet recorded sound effects. Where a game
cue has a recording, it plays instead of the synthesized score; every cue without one (and any
file that fails to load) still plays the synth score, so nothing ever goes silent. JustMafia
keeps its own music (`public/music.js`) and the `my-music/` folders.

**Licensing:** every recorded track and sound effect is from another creator under a license
that allows selling the game: CC0 / public domain wherever possible, a few CC-BY (credit
required, e.g. Kevin MacLeod's "Bushwick Tarantella" in YesChef). Each file's title, author,
source page and license are in `public/audio/CREDITS.md`, which must ship with the game (show
it on a credits screen). `tools/music/build-manifest.js` refuses NC / ND / SA / GPL / unknown
licenses. None of the shipped music is AI-generated (the voices are; see docs/steam-release.md).

## Files

- Music: `public/audio/music/games/<key>/` holds the tracks plus `music.json`:

      { "cues": { "title": { "file": "games/bid/title.mp3", "loopStart": 4.1, "loopEnd": 71.9, "gain": 0.9 } },
        "credits": [{ "file", "title", "author", "source", "license" }] }

  Cue names are the game's score cues (`public/box/scores/<key>.js`: title, intro, lobby,
  think, play, tense, reveal, finale...). The part before `loopStart` plays once, then
  `loopStart`..`loopEnd` repeats sample-accurately. `gain` balances loudness (tracks are
  matched to JustBid's "Confusement Rag").
- Sound effects: `public/audio/sfx/<key>/` with `credits.json`; `public/audio/sfx/ui/` holds the
  shared TV menu clicks. Played with `BOX.audio.clip('<key>/<file>', { vol, delay, pan })`
  (quiet by default, on the SFX bus so the SFX slider and mute apply) and `BOX.audio.ui(kind)`.
- GENERATED (never edit by hand; regenerate after any change or merge):
  `node tools/music/build-manifest.js` writes `public/audio/music/manifest.json` and
  `public/audio/CREDITS.md` from the per-game files. `tools/test-music-files.js` checks they
  are up to date, every file decodes, cues play their file and fall back to the synth.

## How cues find their track

- **Box games** (`public/box/audio.js`): `games.<scoreKey>.<cue>`, else the game's shared set
  `sets.<set>.<cue>` if any, else `aliases.<cue>`, else the synth score.
- **JustMafia** (`public/music.js`, the manifest's optional `mafia` section): `worlds.<world>.<mood>`,
  else `tones.<tone>.<mood>`, else `moods.<mood>`, else the composed score. No JustMafia tracks
  ship today.

Playback is Web Audio (decoded once, looped with `AudioBufferSourceNode`) on the same music bus
as the synth, so the volume sliders, mute, narrator ducking and crossfades work the same.

## Swapping a track

Put the new file in the game's folder, point the cue's `file` at it in that game's
`music.json`, update its `credits` entry (with the license page URL), and run
`node tools/music/build-manifest.js`.

Good CC0 sources: OpenGameArt (CC0 filter), FreePD (via the Wayback Machine, the site closed),
Kenney.nl audio packs, Freesound (CC0 sounds only), US military band recordings on Wikimedia
Commons / archive.org (public domain). Not allowed: NC, ND, SA/GPL, "personal use", YouTube rips.

## Size

The recorded music is about 140 MB (Opus/MP3). If it grows much more, move it out of git (Git
LFS, or a download step at build time) rather than bloating the repository history.

## Optional: AI generation (not used by the shipped soundtrack)

`tools/music/gen.py`, `process.py`, `pick.js` and `catalog.json` can generate tracks locally with
the open-source ACE-Step 1.5 model (MIT; outputs may be used commercially) on an NVIDIA GPU
(setup in `%LOCALAPPDATA%\jgb-music`). If AI tracks are ever shipped, declare them in Steam's
"AI Generated Content" survey.
