# 🔪 Mafia Town

A big-screen social deduction party game for 3–100 players. The TV shows an animated pixel-art town with cinematic murder scenes, everyone plays from their phone, and the **Judge** runs the game from a private console.

## Contributing together

Gabe/Codex and Justin/Claude use separate task branches, merged into `main`
once tested (pull requests optional). Read [AGENTS.md](AGENTS.md) and the
[collaboration workflow](docs/COLLABORATION.md) before making changes.
Claude Code also has a root `CLAUDE.md` pointing to the same rules.

## Run it

The November expansion adds stable neighborhoods through 100 players, a full
manual character creator, private phone investigations, disaster interventions,
secure Judge transfers/removal, and six new roles. See `PLAN.md` for verification
and remaining live playtest work.

```bash
npm install
npm start
```

1. Open **http://localhost:3000** on the computer connected to the TV or projector, then click **Create a town**.
2. Open the **Judge console**: ⚙ → *Open in new tab*, or *Phone QR* to run it from your phone. It shows every secret role, so keep it off the TV.
3. Players scan the QR code on the TV (or go to the printed `/play` link) and enter the 4-letter room code.
4. Pick a setup in the Judge console (Setup tab), then press **Start game**.

**Phones must be on the same Wi-Fi/network as the host computer.** The first time you run it, Windows may ask to allow Node.js through the firewall. Allow it on **Private networks**.
- If the QR code shows the wrong address, open ⚙ → *Join link base* and enter the right one (e.g. `http://192.168.1.20:3000`). You can also start the server with `PUBLIC_URL=...`.
- For players on different networks, use a tunnel (e.g. `cloudflared tunnel --url http://localhost:3000`) and set the join link base to the tunnel URL.

## How a round plays

| Phase | Big screen | Phones |
|---|---|---|
| Roles | Everyone gathers in the square | Tap to see your secret role (team members see each other) |
| Night | Town goes dark, everyone goes home | Power roles act. Everyone else gets a dummy "who do you suspect?" prompt, so nobody can tell who has a power |
| Dawn | A cinematic for each attack: a hooded figure sneaks in, the victim wakes, and then the attack lands, a protector steps in, or a ward blocks it | Investigators get their results. Blocked players are told |
| Morning | Narrator announces the night's victims, who become ghosts | |
| Discussion | Timer (or open-ended in manual mode). Bots "speak" in bubbles | Peek at your role. Telepaths message each other |
| Voting | Check marks show who has voted | Vote (or skip), and change your vote until voting closes |
| Verdict | Ballots fly to each suspect and vote counts appear | |

## Roles

The **Storytellers (14+)** setup includes the new Investigator, Ghostwriter,
Puppet Master, Paparazzi, Conductor and Glitch. Their complete abilities,
restrictions and win conditions appear in the Judge's role reference. Configure
Puppet/Glitch uses, Harmony objectives and Paparazzi photo goals in Setup.

After entering the room code, players get a character creator with a large
live preview and tabs for Body, Face, Hair, Clothes, Extras and Home. Changes
are a preview until saved (Revert undoes them), and a saved look is
remembered for future games. Run `npm run test:e2e` (needs Chrome) for a
browser test of the creator.

Players customize hair, facial features, one of ten expressions (Smile, Grin,
Neutral, Serious, Surprised, Sad, Angry, Wink, Sleepy, Smirk), clothing and
accessories before the game. They also choose their home: one of twelve buildings (Cottage, Tavern,
Bakery, Smithy, Apothecary, Library, Chapel, Tailor, Watchtower, Windmill,
Farmhouse or Manor), in one of twelve colors, shown on the TV town. Their
appearance and home lock on start. Optional selfie color matching requires
consent, runs locally, and discards the photograph; it only approximates hair
and skin colors, with all manual controls available.

| Role | Team | Ability |
|---|---|---|
| 🏡 Villager | Town | None |
| 🔪 Mafia | Mafia | The family shares one kill each night |
| 🎩 Godfather | Mafia | Has the final say on the kill. Looks innocent to investigators |
| 🚫 Roleblocker | Mafia | Makes one person's night ability fail. Takes over the killing if the killers die |
| 🔍 Detective | Town | Learns if someone is Mafia |
| ⭐ Sheriff | Town | Learns if someone is dangerous (Mafia or Serial Killer) |
| 💉 Doctor | Town | Protects one person from attacks (not the same person two nights in a row) |
| 🛡️ Bodyguard | Town | Guards someone and dies in their place if they're attacked |
| 🎯 Vigilante | Town | Limited bullets. May shoot at night, or hold fire |
| 🏛️ Mayor | Town | Their vote secretly counts twice |
| 🔮 Telepath ×2 | Town | Private coded messages to the other Telepath ("I suspect X", "Protect X", "Do not trust my last message"…) |
| 🃏 Jester | Neutral | Wins if the town votes them out |
| 🗡️ Serial Killer | Neutral | Kills each night and can't be killed at night. Wins by being the last one standing |

Night actions resolve together, in this order: blocks → protection → kills → investigations. Ties are broken by a seeded random generator, so results are deterministic.

**Win conditions:** the Town wins when no Mafia or Serial Killer is left alive. The Mafia win at parity, or (optionally) when everyone else is gone. The Serial Killer wins as the last one standing. The Jester wins if voted out.

## Judge console (`/judge`)

- **Game:** start, pause or resume, next phase, +30s, open and close voting, back to lobby. It also shows:
  - live progress on night actions and votes
  - the live vote tally
  - what will happen at dawn
  - the narrator
  - the Telepath messages
- **Setup:** presets (Classic, First timers, Town vs Family, Chaos, Big party), and saving or loading your own setups. It also covers:
  - theme, town name, narrator style, and min and max players
  - an automatic or exact Mafia count, and a count for each role
  - timers, and automatic or manual phases
  - rules: reveal roles on death, skip votes, tie rule, plurality or majority, anonymous votes, Mafia win condition, Doctor self-protect, Telepath timing, ghost haunting, bot chatter

  Setups that would break the game are blocked, with an explanation.
- **Players:** everyone's real role and status. You can force roles before the game, change a night action, vote or role mid-game, and eliminate or revive players. Every override is written to the log.
- **Test mode:**
  - Add up to 99 bots with personalities (Analyst, Aggressive, Cautious, Follower, Chaotic).
  - Speed 1×–50×, skip animations, bots acting on their own (or not), and "make bots act now".
  - **Balance simulations:** thousands of headless games in seconds, with win rates, game length, role survival and effectiveness, elimination patterns and voting behavior. Results download as JSON.
- **🎥 Scenes:** a clickable map of the town. Move the TV camera, play storytelling scenes on any house (murder with any outcome, investigation, watcher, visitor, fleeing, empty house, graveyard…), and change the music. This never changes the game.
- **Narrator mode:** *AI* (the TV narrates and speaks) or *Human Judge* (you narrate in person, and suggested lines appear only in your console). You can also say a custom line on the TV, or skip narration.
- **Dawn reveals:** *automatic*, or *Judge-controlled*: dawn waits and you play each night event when you're ready.
- **📖 Roles:** the full role reference (team, ability, timing, restrictions, win condition).
- **Log:** everything that happened, including the hidden events.

On the TV, ⚙ keeps quick controls. Keys: **Space** pause, **N** next phase, **H** panel, **F** fullscreen.

## Look & themes

Judge selection/removal:

- **Randomize Judge** in the Judge console's Game tab selects a connected human
  before gameplay. Their phone shows **Open my Judge console**. They receive no
  normal role; the TV then operates as a public display.
- Phone **Settings → Vote to Remove Judge** is separate from elimination voting.
  It requires 80% of connected human participants, including ghosts. Votes are
  counted once per identity and individual choices are private.
- A successful petition revokes old administrative access and pauses the game.
  Participants can volunteer in Settings, explicitly agreeing to forfeit their
  player seat if selected. Dead/observer volunteers are preferred. The replacement
  opens their console from their phone and presses **Resume** to continue.
- With no volunteer, the game stays safely paused until someone volunteers.
- Judge intervention: select a living player and Hurricane/Flood/Meteor, preview,
  then explicitly confirm elimination. The event is logged and the game pauses
  for the reveal. Resume or advance afterward; ordinary victory rules apply.

Everything is cozy pixel art. The town is rendered at low resolution, snapped to a warm palette and scaled up crisply. Cinematics cut into themed interiors.


Small Town, Medieval Village, Space Station, Fantasy Realm, Dragon Peaks, Dungeon Crawl, Secret Agents and Federal Investigation. Each one changes the town's colors, building shapes, place names and night tint. Themes are presentation-only: add one in `public/shared/themes.js` without touching game rules.

## Scene preview (`/preview`)

Population controls cover 4, 10, 25, 50 and 100. Previews include all three
disasters and role reveals, and show varied customized characters. For a quick
full-system test, load Storytellers, add at least 14 bots, and use Test Mode.
Run `npm run balance -- 200 storytellers 14 25 50` for expansion metrics.

Plays any cinematic (scene × outcome × theme, day or night) without a game. H hides the controls.

## Test bench (`/test`)

One page with everything: the big screen, the Judge console and up to 8 test phones side by side. Each phone auto-joins as "Tester N" with its own session. It's in the same room as the TV and Judge, so you can play every seat at once. Fill the rest of the town with bots from Judge → Test mode. Use ⤢ to blow any panel up full-size, and **New room** to start fresh.

Someone on your network can open `http://<this computer's LAN IP>:3000/test` (the server prints the exact link at startup). They get their own room and test bench.

## Testing & balancing

- `npm test` runs:
  - the rules tests (every mechanic, overrides, secrecy, setup validation, determinism, a 100-player game)
  - socket end-to-end games (4–60 players, presets, hidden-information leak checks, Judge authentication)
  - the headless renderer smoke test
- `npm run balance -- 1000 chaos 8 12 16` prints a balance report for a preset (or `all`) at the given player counts.
- To play solo, add bots in the Judge console and join from a phone or a second tab at `/play`.

## Code map

The November Storyteller update adds optional advanced play without changing the
basic join flow. Use **Judge → Setup → Storyteller & role options** for role
Standard/Custom settings, ghosts, whispers and nominations, and **Grimoire** for
secret information and the event log. Try **Cinematic Chaos (18+)** or
**Storyteller (16+)** after testing Classic. Every Mafia member now shares a
single collective kill ballot; ties mean no kill unless configured otherwise.
Legacy Godfather override remains selectable.

Visit `/art` for the original character/building gallery and `/preview` for the
new explosion, revival, ash and town-crier scenes. All 17 core hairstyles are
free. Cosmetic purchases and rewards are server-validated. Profiles persist in
`.data/profiles.json`; keep the file and this browser's site data. Running rooms
remain memory-only. This local JSON store assumes a single server process.

Photo matching and an optional pixel face are processed on the phone. The face
is **local preview only**, disappears on reload and is never uploaded or sent
to other players. On plain HTTP over the LAN, use the file input's Take Photo
option if the browser disallows live camera access. No supplied third-party
artwork or paid photo/narration API is used.

- `game.js`: rules engine and the source of truth. It produces three filtered views: TV, phone and Judge.
- `rules/`: staged night resolver, statuses/delayed effects, Mafia coordination,
  special roles, Storyteller information, social voting and bot integration.
- `profiles.js`, `public/shared/cosmetics.js`: replaceable durable profiles,
  cosmetic catalog, achievements and centralized reward configuration.
- `public/character-art.js`, `public/world-art.js`: original pixel artwork.
- `public/creator-ui.js`, `photo-ui.js`, `story-ui.js`, `grimoire.js`: expanded
  phone creator/social actions and the private Judge tools.
- `public/shared/roles.js`: role registry, setup validation, presets and Telepath messages. Add roles here.
- `public/shared/themes.js`: theme registry.
- `bots.js`: bot brains and personalities. Bots see only their own phone view.
- `clock.js`: real and virtual clocks. `sim.js` and `sim-worker.js` run headless simulations and analytics.
- `narrator.js`: narration templates for each style. Swap in an AI narrator here later.
- `server.js`: Express + Socket.IO, QR codes, rooms, the Judge channel.
- `public/town.js`: the animated town (canvas, camera, pixel pipeline). `public/avatar.js` draws the characters.
- `public/cinema.js`: the cinematic engine (actions, actors, themed interiors). `public/scenes.js` holds the scene timelines.
- `public/pixel.js`: the palette snap. `public/shared/layout.js`: town geometry, shared by the TV and the Judge's map.
- `public/host.js` + `index.html`: big-screen HUD.
- `public/judge.js` + `judge.html`: Judge console.
- `public/play.js` + `play.html`: phone controller.

See **PLAN.md** for the roadmap (cinematic Judge scenes, theme art, music, more roles).
