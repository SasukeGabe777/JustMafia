# JustGameBox soundtrack: scores

Every game's music is composed in code and synthesized live in the browser by the audio
engine in `public/box/audio.js` (`BOX.audio`). Nothing is downloaded and no audio files
are needed. One file per game, `public/box/scores/<key>.js`, loaded on demand by the TV.

Special scores: `menu` (main menu), `party` (Party Mode: `shuffle`, `board`, `finale`),
`generic` (the fallback for any missing game or cue) and `_template.js` (the starter
that `tools/new-game.js` copies for a new game).

## Cue names

| cue | when it plays |
| --- | --- |
| `title` | the game's title screen (its main theme) |
| `lobby` | the room lobby while players join |
| `intro` | the game-show opening cutscene (ducked under the host's voice) |
| `think` | calm gameplay: guessing, writing, choosing |
| `play` | the main gameplay groove |
| `tense` | countdowns: the TV switches `think` to `tense` for the last 10 seconds |
| `reveal` | answers or results being revealed |
| `finale` | game over |

Every game score has all eight. Games may add their own (Zombie Survival adds `story`,
`action` and `lose`). A missing cue falls back sensibly (`think` -> `play`,
`finale` -> `win` -> `title`, ...) and then to the generic score.

**Which cue plays when:** `public/box/tv.js` picks `title` / `lobby` / `intro`, the Party
Mode cues, and `finale` at game over. During play it calls the game's `music(s)` (in its
`BOX.games.<key>` entry in `public/box/games/<key>.js`) or, if there is none, the score's
`phaseCue(s)`; both get the game's TV state and return a cue name (or `null` for silence,
e.g. while a JustFunny video plays). A score's `tenseFrom: ['play']` also turns timed
`play` phases tense.

## Writing a score

```js
BOX.scores.mygame = {
  name: 'My Game',
  cues: {
    title: {
      bpm: 112, swing: 0.5, swing16: 0.55,   // swing: 8th-note swing (0.5 straight, 0.64 jazz)
      beats: 4, steps: 4,                    // 4/4 in 16ths; waltz beats: 3; 6/8 beats: 2, steps: 3
      transpose: 0,
      tracks: {
        keys: { type: 'epiano', mode: 'chord', center: 64, n: 4, vol: 0.45, pan: -0.2, trem: 0.25 },
        bass: { type: 'bass', mode: 'bass', oct: 2 },
        lead: { type: 'brass', vol: 0.4 },          // mode 'notes' is the default
        dr:   { type: 'drums', kit: 'funk' },
      },
      sections: {
        A: { bars: 8, chords: 'Fmaj7 | Dm7 | Gm7 C7 | ...',
             keys: '..x-..x-..x-.x-.',              // chord rhythm in 16ths
             bass: '1 . 1 5 . 8 7 5',               // chord degrees in 8ths
             lead: 'a4 c5 f5 - e5 - c5 . | ...',    // notes in 8ths
             dr: { k: 'x.....x...x.....', s: '....x.......x...', h: 'x.x.x.x.x.x.x.xo' } },
        B: { ... },
      },
      form: ['A', 'B', 'A'], loop: 0,               // play the form, then loop from index `loop`
    },
    lobby: { from: 'title', bpm: 100, mute: ['lead'] }, // a variation of another cue
  },
  stingers: { win: { bpm: 120, tracks: {...}, chords: 'C', bars: 1, parts: { b: 'c5 e5 g5 c6 - - - -' } },
              ding: (X) => X.note('chime', 'a6', 0, 0.8, 0.8) },
  fx: { gameFxKind: 'stingerName' },   // the game's fx cues, restyled
  sfx: { cheer: 'stingerName' },       // any BOX.sfx('name') on the TV, restyled
};
```

**Patterns.** Short patterns repeat to fill the section; `|` and spaces are only for
reading. `res` (in steps) sets the grid: chord and drum tracks default to 16ths (`res: 1`),
notes and bass to 8ths (`res: 2`).

- **chord** (`mode: 'chord'`): `x` play the voiced chord, `X` accent, `g` ghost, `1`-`9`
  one note of the voicing (arpeggios), `-` hold, `.` rest; `true` holds every chord for its
  full length (pads). Voicings are voice-led automatically (`center`, `n`, `rootless`).
- **bass** (`mode: 'bass'`): chord degrees `1 3 5 7 8 9`, `b`/`#` alter, `'` / `,` octave,
  `a` / `A` chromatic approach to the next chord from below / above, `x` dead note,
  `walk` = an automatic walking bass.
- **notes**: `c5`, `f#4`, `bb3`; `c4+e4+g4` together; `-` hold, `.` rest; `!` accent,
  `?` soft, `~` glide from the last note.
- **drums**: one line per piece, `x` hit, `X` accent, `g` ghost, `1`-`9` velocity, `o` open hat,
  `f` flam. Pieces: `k s c h o r y t1 t2 t3 sh tb cb wb wb2 rim sn br hb tk fd vn tick tock
  cg bg tri sw`. Kits: `std funk jazz lofi 808 orch world`.

**Instruments:** `pad strings choir brass mute sax organ bass synthbass sub808 tuba lead
flute whistle clarinet sine fmkeys pluck clav` (synths) and `piano honky epiano vibes
marimba glock celesta musicbox kalimba chime cbell timp guitar nylon harpsi pizz banjo harp
lute upright` (rendered once per pitch). Mixer keys: `vol pan rev dly hp lp trem oct len
strum human` plus instrument settings (`cut att rel vib bright wave uni ratio index`).

**Built-in stingers** (usable by name in any score's `fx` / `sfx`): `cash coin gavel
heartbeat groan roll rimshot tick tock whoosh riser impact boom ding buzzer chips knock
cymbal swell crowd`.

## Checking a score

`node tools/audio-render-check.js mygame` renders 8 bars of every cue and every stinger
offline in headless Chrome and prints peak / RMS / voices / render speed. It fails on
clipping, near-silence or errors. Keep cues around -14 to -18 dB RMS.

## Dropping in real recorded tracks

Put the file in `public/audio/<game>/` and list it in `public/audio/manifest.json`:

```json
{
  "price": { "title": "title.mp3", "think": { "file": "think.ogg", "gain": 0.8 }, "stinger:win": "win.mp3" },
  "menu":  { "title": "theme.mp3" }
}
```

A listed file replaces that synthesized cue (looping, unless `"loop": false`), with the same
crossfades, ducking and volume settings; `stinger:<name>` replaces a stinger. Only listed
files are ever requested, so nothing 404s.

## Narrator voices

`public/box/show.js` speaks host lines through `BOX.voice.speak(text, spec)`, which returns a
promise that resolves when the line is done. `spec` is the intro's `host.voice`
(`{ like, accent, gender, lang, pitch, rate }`). The default picks the best browser voice
(neural / Natural / Online / Google / Premium / Enhanced first, then accent and gender). To
use a better voice engine, replace `BOX.voice.speak` (and `BOX.voice.stop`); the music ducks
under every line either way.
