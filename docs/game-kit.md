# JustGameBox game kit

Every small game in JustGameBox has the same set of pieces. A new game starts with all of
them, and `node tools/test-box-kit.js` fails if any game is missing one.

## Start a new game

```
node tools/new-game.js <key> "<Name>" --type cards|guess|create|friends|action --icon 🎲
```

This creates the files below with a small working placeholder game, and registers it in the
server, both pages, the main menu, the "pick the next game" lists, Party Mode and `npm test`.
Then replace the placeholder with the real game, and restart the server.

## What every game has

| Piece | Where | What it is |
|---|---|---|
| Rules | `box/games/<key>.js` | `{ key, name, min, fields, defaults, create, show }`. The game class has `start`, `act`, `tv`, `view`, `next`, and `results()` (player ids best-first once the phase is `over`, for party points). Validate every phone input; use `room.after` timers. |
| Intro cutscene | `show` in the module + `public/box/intros/<key>.js` | `show: { facts: false }` plays a short cutscene and a roll call before the game; `show: true` is the game-show opening where phones write fun facts. The intro file uses the engine in `public/box/show.js` (the API is at the top of that file). |
| Title screen | `public/box/titles/<key>.js` | The animated scene shown before a room is made (`public/box/title.js` has the format). It sets the game's art style: fonts, colours, props. |
| Designed lobby | `lobbyTv(el, lobby)` in the client file | Settings as part of the game's world (e.g. JustBid's locker, Two Truths' evidence board). Keep `#code`, `img#qr`, one `select[data-set]` per setting in `#settings`, `#roster .chip`, `#add-bots`, `#start`. |
| TV screens | `tv(el, state, ctx)` | In the title's style, readable from a couch, clear about what's happening and who we're waiting on. |
| Phone screens | `phone(el, view, ctx)` | One obvious action, big tap targets, `BOX.morph` (never `innerHTML`, so nothing flickers or loses taps). |
| How to play | `how: [...]` | Shown on the phone's ❓ and in the lobby. |
| Haptics | `ctx.haptic(kind)` | `tap`, `select`, `success`, `error`, `turn`, `win`, `buzz`, `warn`, `big`. At least: your turn, good and bad results, the end. |
| Styles | `public/box/games/<key>.css` | Scoped to the game (`body.g-<key>` on the TV and phone). |
| Soundtrack | `public/box/scores/<key>.js` | Music cues for title, lobby, intro, play moods, reveal and finale, plus stingers (see `public/box/scores/README.md`). Real recordings can replace any cue: `public/audio/<key>/<cue>.mp3`. |
| Tests | `tools/test-box-<key>.js` | Bots play whole games on a virtual clock; inputs are validated; `results()` works. |
| Main menu tile | `public/hub.html` | Players, time and type chips, and its category `data-type="cards|guess|create|friends|action"` (from `public/categories.js`). The category puts it on its main-menu shelf **and** in Party Mode; nothing else to register. |
| Ideal crowd | `best: [lo, hi]` in the module + `data-best="lo-hi"` on the tile | The player count where the game is at its best. Party Mode builds lineups from games that suit the group, and the menu's "How many of you?" badges them. The kit test checks the two match. |

## Unlockable games

Add `locked: { how: 'Finish a Party Mode to unlock it.' }` to the module, the game to
`LIST` in `public/unlocks.js`, and a rule to `UNLOCK_RULES` in `box/room.js`. Finishing a whole
Party Mode currently unlocks every locked game. The main menu's ⚙ menu can unlock or re-lock
everything for testing.

## Checks before shipping

- `node tools/test-box-<key>.js` and `node tools/test-box-kit.js`
- `node tools/shot-titles.js <key>` (title screen plus Start → lobby, screenshots)
- `node tools/e2e-box.js` (every game on real TV and phone pages, no page errors)
