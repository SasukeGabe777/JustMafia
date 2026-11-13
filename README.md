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

### Play online (Render)

`render.yaml` deploys the game to [Render](https://render.com) on the free plan: render.com → **New → Blueprint** → pick this repository → **Apply**. Every push to `main` redeploys it. Join links and QR codes use the site's address automatically (`RENDER_EXTERNAL_URL`; `PUBLIC_URL` overrides it). Open the site on the TV computer, create a town, and players join from any network.

Free-plan limits: the server sleeps after 15 minutes without visitors, and the next visit takes about a minute to wake it. Saved characters, gold and unlocks are wiped whenever it restarts or redeploys (its disk isn't kept), and running rooms end. A paid instance with a disk mounted at `.data` keeps profiles.

## How a round plays

| Phase | Big screen | Phones |
|---|---|---|
| Role draft (Default) | A deck of role cards drops in, fans out and shuffles. The candidate cards flip up with live vote counts (⭐ = leading), the winners get an "IN THE GAME" ribbon, then the cards go back into the deck and one card is dealt to each player | Read each card (team, timing, what it does), vote for up to N cards, lock in. Then your own card is dealt face down: tap to flip it |
| Roles | Everyone gathers in the square | Tap to see your secret role (team members see each other) |
| Night | Town goes dark, everyone goes home | Power roles act. Everyone else gets a dummy "who do you suspect?" prompt, so nobody can tell who has a power |
| Dawn | A cinematic for each attack: a hooded figure sneaks in, the victim wakes, and then the attack lands, a protector steps in, or a ward blocks it | Investigators get their results. Blocked players are told |
| Morning | Narrator announces the night's victims, who become ghosts | |
| Discussion | Timer (or open-ended in manual mode). Bots "speak" in bubbles | Peek at your role. Telepaths message each other |
| Voting | Check marks show who has voted | Vote (or skip), and change your vote until voting closes |
| Verdict | Ballots fly to each suspect and vote counts appear | |

### New player help (Judge console → Rules → 🧭 New player help; on by default)

- **Quick join:** the QR link opens the character creator with a "⚡ Quick join" card on top. Type a name, tap once, and you're in with a random look and an assigned house (no house step). Customize later in the lobby.
- **"What to do now" bar:** shown on every phone for every phase. It is role-aware but uses only that phone's own view (for example "Tap someone to investigate. Only you will see the result.").
- **"?" How to Play:** the goal, the round, your phone, tips, and the roles in this game with their real descriptions.
- **"What does my role do?"** on the role card: when it acts, its rules, and how it wins.
- **One-time tips** (once per device): the first night, discussion, vote, being a ghost, being Mafia.
- **TV:** a 4-step how-to in the lobby, and a one-line explainer for each phase under the phase name.
- Turning the setting off hides all of it at once.

### Role selection: Default (card draft) or Manual

Set in the Judge console → Setup → Roles.

- **Default (new games):** after Start, the players vote on which special roles are in this game.
  - The number of **special roles** scales with the players: up to 5 players → 2, then one more every 2 players (6 → 3, 8 → 4, 10 → 5 … 20 → 10, cap 12). Plain Mafia and Villagers are not counted.
  - The vote shows two more Town/Neutral cards than that, plus Mafia cards (e.g. Godfather). A Mafia card upgrades a Mafia seat and only gets in if someone votes for it.
  - Cards come from the real role bank (`public/shared/draft.js`): a mix of Mafia, Town (always an investigator and a protector when possible) and, in bigger games, Neutral roles.
  - Roles a room hasn't seen much are offered more often, and complex roles only appear in bigger games.
  - The server counts the votes and breaks ties with a random draw.
  - It then repairs anything invalid while keeping as many votes as possible: there is **always at least one Mafia**, the Mafia is never bigger or stronger than normal, and there are never more roles than players.
  - Mafia and Villagers fill the other seats. Roles are dealt at random by the server, and each phone only ever receives its own.
- **The deck holds every role, in 10 unlock tiers (Judge → Card deck → "Learn as you play", the default):**
  - **Tier 0, the tutorial round:** a room's very first game is Mafia, Detective and Doctor, with no vote. Bigger groups get the scaled number of special roles: easy Town roles from tiers 1–2 are added (e.g. 8 players: + 2 of Sheriff, Bodyguard, Vigilante, Mayor, Medium, Lookout, Crier).
  - Finishing it unlocks **tier 1** (Godfather, Sheriff, Bodyguard, Vigilante, Mayor, Jester, Executioner).
  - **Bigger groups start further along** so there are always enough cards: up to 12 players start at tier 1, 14–16 at tier 2, 20 at tier 3, 25+ at tier 4. After the tutorial their reveal shows every role that joined.
  - Every finished game after that unlocks the next tier of 3, from simple to complex. At game over the TV shows **"✨ You just unlocked!"**: the new role cards float in and flip over, then **▶ Play again**. Phones list them too.
  - Unlocked roles join the next draft, and by game 11 every role is in.
  - The draft stays balanced the whole time.
  - Unlocks are per room for now (later: logins that pool each player's unlocks).
- **"Every role, fully random"** (Judge toggle): every role is in the deck from game 1, drawn at random. The final setup is still repaired to be valid (always at least one Mafia).
- **Custom roles (manual):** exactly the previous behavior, using the role list in Setup.
  - Changing that list or loading a preset switches to Custom roles automatically. Pick Default again to go back to the draft.
  - Test-mode forced roles also use the list.
- After the vote, the **Mafia coordination** panel lists which roles are in this game (never who holds them), so the Mafia know which Town threats to hunt and which claims are risky.
- **Next phase** steps through the draft stages. Back to lobby cancels it. People can join during the draft and are dealt in.

## Roles

The **Storytellers (14+)** setup includes the new Investigator, Ghostwriter,
Puppet Master, Paparazzi, Conductor and Glitch. Their complete abilities,
restrictions and win conditions appear in the Judge's role reference. Configure
Puppet/Glitch uses, Harmony objectives and Paparazzi photo goals in Setup.

After entering the room code, players get a character creator with a large
live preview and tabs for Body, Face, Hair, Clothes and Extras. After joining,
they claim a house: their own plot, an empty plot, or moving in with another
player (up to 4 per house). They can also design it: 12 designs, wall and
roof colors, doors, windows and yard decorations. Every house on the TV has
a sign naming the owner and everyone staying there. Changes
are a preview until saved (Revert undoes them), and a saved look is
remembered for future games. Run `npm run test:e2e` (needs Chrome) for a
browser test of the creator.

Players customize hair, facial features, one of ten expressions (Smile, Grin,
Neutral, Serious, Surprised, Sad, Angry, Wink, Sleepy, Smirk), clothing and
accessories before the game. House designs include Cottage, Tavern, Bakery,
Smithy, Apothecary, Library, Chapel, Tailor, Watchtower, Windmill, Farmhouse
and Manor. Appearance, house and residency lock on start. Optional selfie color matching requires
consent, runs locally, and discards the photograph; it only approximates hair
and skin colors, with all manual controls available.

| Role | Team | Ability |
|---|---|---|
| 🏡 Villager | Town | None |
| 🔪 Mafia | Mafia | The family shares one kill each night |
| 🎩 Godfather | Mafia | Has the final say on the kill. Looks innocent to investigators |
| 🚫 Roleblocker | Mafia | Makes one person's night ability fail. Takes over the killing if the killers die |
| 🔍 Detective | Town | Learns if someone is Mafia |
| ⭐ Sheriff | Town | Stakes someone out: learns whether they were out killing that night (any killer, including Mafia who voted for the kill; a framed player looks guilty) |
| 💉 Doctor | Town | Protects one person from attacks (not the same person two nights in a row) |
| 🛡️ Bodyguard | Town | Guards someone and dies in their place if they're attacked |
| 🎯 Vigilante | Town | Two bullets (setting). May shoot at night, or hold fire. Killing a Town member puts the gun away for good |
| 🏛️ Mayor | Town | Their vote secretly counts twice |
| 🔮 Telepath ×2 | Town | Private coded messages to the other Telepath ("I suspect X", "Protect X", "Do not trust my last message"…) |
| 🃏 Jester | Neutral | Wins if the town votes them out |
| 🗡️ Serial Killer | Neutral | Kills each night and can't be killed at night. Wins by being the last one standing |
| 🏹 Hunter | Mafia | The Mafia's detective: learns one non-Mafia player's exact role each night, shared with the whole family. Also votes on the kill |
| 🎯 Headhunter | Neutral | Marks who they want dead (night, or any time). The mark shows on the Mafia's night screen as a vote from one of their own (never counted). Each time the mark dies (night or gallows) they level up. **1** disguise (investigations see a role of their choice; a Villager before that) · **2** once a night, force a Mafia member's kill vote · **3** one strike per game, any time, with its own scene · **4** learn one role a night · **5** sees every role · **6** one execution per day. Wins as the last one standing |

Night actions resolve together, in this order: blocks → protection → kills → investigations. Ties are broken by a seeded random generator, so results are deterministic.

**Crafter** (Town, Expansion pack): searches for one material each night and once each day (Wood, Stone, Iron, Glass, String), then crafts tools from a recipe book in their phone workshop: **Pickaxe** (wood + stone + iron, night: break a window and learn the target's TRUE role at dawn, the only check no disguise, frame or cover role fools), **Lantern** (glass + string, night: learn everyone who visited your house), **Magnifying Glass** (glass + iron, night: learn every visit that night), **Sword** (wood + 2 iron, day: strike one player down on the spot, anonymously). Tools stack; each use spends one. Rules: `rules/crafter.js`, data: `public/shared/crafting.js`.

**DLC 1** (Judge console → Setup → Roles → *DLC 1* pack; also offered in the card draft):

| Role | Team | What it does |
|---|---|---|
| 🕯 Medium | Town | Each night, a séance with one fallen player: how they died (Mafia, Serial Killer, Vigilante, the gallows...) and their role |
| 👀 Lookout | Town | Watch someone's house; learn the names of everyone who visited it |
| 🎖 Veteran | Town | 2 alerts per game: attacks on you fail and every visitor dies (friend or foe) |
| 🪤 Trapper | Town | Set a trap at another house: it's ready the next night and stays until the first attack, which fails and names the attacker |
| 💘 Cupid | Town | Once: bind yourself to someone. If either dies, the other dies of a broken heart |
| 👂 Eavesdropper | Town | Hears the Mafia's coordination messages, never who said them |
| 📯 Town Crier | Town | Once a day, an anonymous proclamation on the TV ("Ana IS SAFE!") |
| 🖼 Framer | Mafia | Frame someone: tonight every investigation sees them as Mafia |
| 🧹 Janitor | Mafia | Once: if the target dies tonight, their role stays hidden (only the Janitor learns it) |
| 🎭 Impostor | Mafia | Role readings (Sorcerer, Hunter, Medium) see a Town cover role; the Detective and the Crafter's pickaxe see the truth |

**Win conditions:** the Town wins when no Mafia, Serial Killer or Headhunter is left alive. The Mafia win at parity, or (optionally) when everyone else is gone. The Serial Killer and the Headhunter each win as the last one standing. The Jester wins if voted out.

**Farewells (Update 8):**
- Buy one in the shop's Animations section and equip it from your inventory: Rose Petals, Fireflies, A Last Letter, Candlelight, Sky Lantern, Falling Stars or Spirit Rises.
- When you die, it plays over your body on the TV, at night or at the gallows.
- It belongs to the victim, so it never hints at who the killer was.
- The bedroom murder also takes on the victim's own house: its paint color, plus signature furniture for each design (a tavern's barrels, a bakery's oven, a library's shelves, a chapel's stained glass, a dark mansion's watching portrait…).

**Every death tells its own story:**
- The scenes and the dawn narration change with how the game has gone: the first death, a roommate who will find them ("Maya found them at dawn"), who they voted against yesterday, the town nearly hanging them, an earlier narrow escape, or how few remain.
- What they cry out and whisper as they fall changes too.
- Only public facts are used. Vote-based lines only appear when votes are public, and no line ever points at anyone as the killer.

**Death scenes:**
- Every death is acted out with the character rig: the victim is grabbed and struggles, falls with X eyes, and a blood pool spreads under them.
- Death locations: their bed, the lake (where the body is dragged to the shore and slips under), the hearth, outside the tavern, the field, chased home, or watching another house.
- With the AI narrator, each scene carries the narrator's story beats as captions, read aloud when the TV voice is on.
- With a human narrator there are no captions. Instead, the Judge picks how each kill plays at dawn (Judge console → dawn reveal list), and can play any death scene by hand from the Scenes tab.

With the AI narrator, night deaths become stories. A victim may be found at
home, by the lake ("stayed at the lake a little too long"), at the hearth,
outside the tavern, in the field outside town, or beside the house they were
investigating (only when roles are revealed on death). Each location has its
own scene. The Human narrator and the Judge's manual reveal keep the classic
murder scene.

**Shop and gold:** every player has a gold pouch (balance, earned, spent).
Gold comes from completed games: after each game, the phone shows coins
flying into your pouch with a breakdown (win, survival, role actions,
objectives, helping teammates, achievements). Values are configurable in
`REWARDS` (`public/shared/cosmetics.js`). Games with bots, hand-picked roles,
fewer than 3 people, or under a minute pay nothing. Gold persists on the
server. The 🛒 Shop
sells clothing, hats, hairstyles, house designs and decorations, and flair;
purchases go to your inventory, where you equip or unequip them.

**Executions:** when a vote eliminates someone, the TV shows the townsfolk
seizing them and hanging them at the gallows. During the verdict, a Role
Blocker can secretly interrupt it (the Bodyguard no longer swaps at the gallows; that is the Executioner's job) (once
per game each). Anyone can visibly defend the accused, and the condemned can
leave last words made from a name and a fixed word. With anonymous votes, the
mob is masked, and the interrupter is never identified.

**RSP Supply theme:** pick "📦 RSP Supply" in Setup for a yellow-and-blue
corporate-takeover version. The Mafia become RSP Supply, led by President Tom
Smith. Themes are defined entirely in `public/shared/themes.js`; copy the RSP
Supply entry to make another.

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

## Season pass, challenges, events and party mode

- **Season 1: Blood Moon** (Shop → 🎟 Season). Every finished game earns season XP
  (finish 40, win +25, survive +10, each weekly challenge +60). The pass costs
  **150 gold** and pays every tier you reach, including tiers you passed before
  you bought it: gold, plus 8 pass-only cosmetics (Blood Moon Crown, Bat Wings,
  Vampire Count, Blood Knight and more). Pass items cannot be bought.
- **Weekly challenges**: three per ISO week (the same for everyone), each paid once,
  on top of the per-game gold cap.
- **Locked cosmetics**: only a few hairstyles, outfits, hats and houses are free;
  the rest are bought with gold, earned through achievements or found in the pass.
- **The shop fills up as you play** (per profile): a new player sees a small starter shelf
  (two cheap items of each kind). Every finished game puts 1 new item on the shelves, a win
  1 more, and your first game in a new world 2 more (cheapest first, a mix of kinds; rules in
  `STOCK` in `public/shared/cosmetics.js`). Hidden items can't be bought. The game-over card
  lists what just arrived, and Shop → 🔒 **Locked** shows how many items are still in the
  back room, the next three as mystery silhouettes, and how to unlock more.
- **The shopkeeper is alive**: a jointed body that breathes, blinks, polishes the counter and
  waves; holds the item you pick up high to show it off; throws his arms up in a shower of
  coins when you buy; shrugs when you're short of gold; wags a finger at locked items.
- **Events** (Judge → Basics → Event): *Blood Moon* turns every third night red,
  the Mafia kill twice, and season XP is doubled.
- **Party mode** (Judge → Basics): everyone can wear every cosmetic in that room
  without unlocking it. Nothing is added to their profile.

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

### Worlds (Themes v2)

The classic look (Medieval Village "Mafia Town", Small Town) and RSP Supply are unchanged. The other eleven themes are full **worlds**: Space Station, Fantasy Realm, Dragon Peaks, Dungeon Crawl, Secret Agents, Federal Investigation, and five new ones: **Snowy Village**, **Block World** (blocky voxel look, all original), **Tabletop Quest** (a parchment battle map with dice), **Realistic** (natural colors, soft lighting and textures; the characters keep their current look) and **Noir** (black and white, rain, film grain).

- **Roles change with the world** and keep their real name beside them, e.g. *Med-Bay Surgeon (Doctor)*, *Alpha Wolf (Godfather)*. Teams are renamed too (*The Dragon Cult*, *The Outfit*…). Text lives in `public/shared/theme-text.js`.
- **The narrator adapts**: every world has its own lines for the start, nights, deaths (one per death location), votes and wins (Noir is a first-person private eye; Tabletop is the Game Master).
- **A different map**: the pond and graveyard shift and change (lava pool, frozen lake, coolant pool…), each world has its own ground, trees and landmarks (volcano, launch pad, ski hill, block cliff, compass rose…). Houses and roads stay put so the Judge's map and cinematics still line up (`MT_LAYOUT.applyVariant`).
- **A living world**: dragons flying overhead, drones and shuttles, fairy wisps, bats and torches, helicopters with searchlights, police cars, reindeer and northern lights, block sheep and square clouds, a giant rolling d20, cars with headlights in the rain.
- **Every world kills differently**: its own weapon, impact, sounds and aftermath. Blaster → vaporized into glowing dust; wand → turned to stone; dragon-claw gauntlet → dragonfire and ash; poisoned dagger → green venom; silenced pistol with a laser sight; revolver → chalk outline; icicle → frozen; pixel sword → bursts into cubes; bow → critical hit (a d20 shows 20); knife (Realistic); revolver flash in the rain (Noir).
- **World gear**: each world has two cosmetics, earned by finishing games there (1st and 3rd game). They are never sold. Shop → 🗺 **Worlds** shows every world as a map card with your progress and its rewards.

Art and life: `public/theme-world.js`. Kills: kits in `public/cinema.js`. Tests: `tools/test-themes.js`.

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


## Role uniqueness (balance pass)

Every role reads the night its own way, so each one is worth having when it shows up:

- **Detective** = which side (yes/no; the Godfather passes, the Impostor doesn't) · **Sheriff** = did they kill tonight · **Sorcerer** = two possible roles, one true · **Hunter** (Mafia) = the exact role, but the prey is warned · **Crafter's pickaxe** = the true role, nothing fools it · **Medium** = how a dead player died, and their role.
- **Lookout** = names of visitors to a house · **Investigator** = how many visitors, and whether the owner went out · **Paparazzi** = publishes where someone went · **Crafter's lantern / magnifying glass** = your own visitors / every visit. All use one shared visit list (a Mafia kill is the one member who carried it out; acting on yourself is not a visit).
- **Doctor** = flexible healer, every night (no repeats) · **Bodyguard** = dies in someone's place, can guard the same person every night · **Trapper** = a trap that takes a night to set and waits until it catches an attacker · **Veteran** = alert: immune, visitors die.
- **Executioner** owns the gallows swap; the **Roleblocker** can interrupt one execution.

## The "AAA" update

- **Bots that play and talk.** Bots play their roles (Mafia silence/frame the most dangerous players, Trappers protect claimers, Veterans alert when accused, Lookouts watch suspects...) and think out loud: they react to deaths, defend themselves, share or fake findings, point at voting patterns and explain their votes. Each personality has its own voice. Phones show it as one collapsed "💬 Town talk" line.
- **End-of-game highlights and movie credits.** After the victory scene and the unlock reveal, the TV replays up to three key moments as cinematics (▶ REPLAY), then rolls the credits: the cast (role, team, how their story ended), awards (MVP, Lifesaver, Sharpest Mind, Deadliest, Innocent but Accused, Worst Vote, Never Caught, First Blood, Last One Standing) and the game in numbers. Phones show your awards. (`rules/credits.js`)
- **A narrator voice per world** (voice, pitch and pace), music that ducks under it, a low hit on deaths and verdicts, a swell on wins.
- **Live reactions.** A small corner button on the phone opens six emojis; they float over your character on the TV (rate-limited, TV only). Reaction packs are cosmetics: Classic (free), Spooky, Royal, Party, Detective, Sweetheart, and Blood Moon (Season 1 pass).
- **Haptics.** Phones vibrate when you die, when news about you arrives overnight, and on taps. Tap the role card to reveal it, tap again to hide it.
- **Fate Tokens ✦ and Fate Cards.** A second currency (2 to start; +1 per win, weekly challenge, new world, mastery title; or 120 gold each) for one-time cards: Role Wish, Team Wish, Reroll. A wish is spent only if it comes true. Shop → ✦ Fate. (`rules/fate.js`)
- **My stats.** Every finished game (practice included) builds your career: win rates, role mastery (Apprentice 5, Expert 15, Master 30), rivalries (who took you out, who you took out, who voted you), awards and recent games. Phone: 📊 My stats. TV lobby: 🏛 Hall of Fame. (`rules/career.js`)
- **Daily Surprises** (Judge event): from night 2 some nights bring Fog (no visit information), a Festival (no Mafia kill) or a Blood Moon (two kills), announced by the narrator and shown on the TV.
- **TV polish.** Lamps light one by one at nightfall, a rooster and a sunrise sweep at dawn, the town grows gloomier as it empties, people look at the vote leader or whoever is talking, the camera drifts to the leading suspect, and an empty lobby plays attract mode.
- **Campaigns** (Judge toggle): five games become chapters of one story, with recaps, scarred houses for last chapter's victims, a running Town vs Mafia score and a finale. (`rules/campaign.js`)

## The afterlife and betting

Dying no longer means sitting out. A ghost's phone offers (none of it can leak secrets to the living):

- **Ghost predictions.** Before each vote, guess who gets voted out; before each night, guess who dies. Right guesses pay a little gold in games that pay, and the best guesser gets the 🔮 **Ghost Oracle** award in the credits.
- **A Chill** (once per game). Pick a living player: their house flickers with frost on the TV and their phone shivers. Harmless, very spooky.
- **The Medium's spirit line.** Only a living Medium can hear the dead, and the Medium chooses who: up to two ghosts at a time. Each chosen ghost may whisper one word from a fixed list (Trust, Liar, Danger…) every day and every night. No names, ever.
- **Mafia ghosts** may shroud one day's ballot per game: that vote's reveal hides who voted for whom.
- **Ghost bets.** Ghosts with a saved character bet their own gold against each other: who wins the game, or who is voted out today. The gold is held until the bet settles; the winner takes both stakes; untaken or undecided bets are refunded. Bets only move gold between players.
- **A win from beyond the grave** pays a small bonus when your side wins after you died.

**Cosmetics.** A 👻 **Ghosts** shop tab holds ghost looks (Bedsheet, Chained Spirit and Royal Phantom for gold; Will-o'-Wisp, Shadow Wraith and The Oracle from the ghost achievements: become a ghost, send 3 Chills, make 5 right predictions). Two new farewells show you becoming a ghost: **Ectoplasm** and **Breaking Chains**. The 🎰 **High Roller** line (shown in the Hats & Gear and Flair tabs) is unlocked by your first bet (Casino Reactions) and climbs in tiers you buy in order: Dealer's Visor → High Roller Top Hat → Jackpot Rain.

## Economy

`public/shared/cosmetics.js` has two dials in `ECONOMY`: every gold reward (games, challenges, season tiers, achievements) is paid at `goldRate` (now 0.5, half the base values written in the file) and every gold price (items, the season pass, Fate Token trades) is charged at `priceRate` (now 1.3, 30% above base, rounded to 5).

## Soundtrack and narrator

- **Music** (`public/music.js`): original chiptune, synthesized live (no audio files). Every world has its own theme song, key and instruments (a tavern jig for Tabletop, sleigh bells for Snow, big drums for Dragons...) and its own character: playful worlds bounce with staccato notes, grace notes and key changes; Noir is slow, sad and grim (a muted horn over brushes and a lonely piano); the Dungeon is dark and driving. Every piece is composed as a full 3–4 minute track: intro, theme, variations, new melodies, a breakdown, a build-up, a key change and an ending. When a track ends, a newly composed one (same theme, new melodies and arrangement) continues on the beat, so it never loops the same way twice. Each moment of the game has its own piece played in that world's sound: an upbeat lobby, peaceful days, a mysterious role reveal, a gentle dawn, sneaky-but-upbeat nights, a tense voting song, a march at the gallows, a heartbeat for murder scenes and a victory fanfare. With the TV narrating, the music follows the game automatically; a Judge's music choice overrides it.
- **Narrator**: picks the most natural voice the browser has (Microsoft Edge's free "Natural" voices sound the most human; Chrome's Google voices are next) and reads every line in full, queued instead of cut off. Pick a voice by hand and test it in ⚙ Host controls.
- **Sound effects** (`public/sfx.js`): every public moment has one: night, dawn, morning, discussion and voting opening, each vote, the verdict drum, ties, murders (with each world's weapon), saves, guards, executions, the Jester's laugh, explosions, photos, ghosts, farewells, reactions and a winner-specific fanfare.
- **Volume**: ⚙ Host controls has separate sliders for the narrator, the music and sound effects (saved on that screen).
