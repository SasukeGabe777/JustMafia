# Mafia Town: expansion plan

## November 23, 2026 - JustPitch, the improv pitch game (branch claude/pitch)

Owner: a locked game inspired by the "present while someone backstage messes you up" format, an
evolution of JustSketch. Inspired by the format only: original name, host, modes, prompts and art
(no show or cast names, catchphrases or look-alike branding anywhere).

- **Rules** (`box/games/pitch.js`, content in `pitch-content.js`; key `pitch`, Creative shelf, 3–100,
  best 4–10, locked until a game of JustSketch Relay is finished: `UNLOCK_RULES`, `public/unlocks.js`,
  tile `data-lock`). A match: card → prep (both players draw the OTHER one's slides at once on
  JustSketch's sketchpad; strokes validated by sketch.js `cleanStrokes`, now exported) → A presents
  while B sabotages → SWAP (new topic) → B presents → the audience votes → result. The saboteur flips
  to the next slide (unshown ones pop up by themselves), sends cue cards from a hand of 4 (6 s
  cooldown, new hand), or writes their own (cleaned + the room's word filter). The presenter's phone
  is a prompter (Done it ✓ = +10); the TV shows the cue flying in and a BACKSTAGE feed.
- **Formats:** Auto = round-robin for 3–4 (everyone meets everyone), bracket for 5–8 (single
  elimination, byes for odd counts, never two byes for one player if avoidable), quick bracket for
  9+ (one round, then the two biggest vote shares meet in the final). Bots: 3 players ≈ 8 min,
  4 ≈ 16, 7 ≈ 17, 12 ≈ 20 min at default lengths. Leavers lose by walkover.
- **Five modes** (Mixed rotates them): 🗣️ Focus Group (the saboteur sends lines to read and topics
  to steer to; "panelist" lines go to an audience phone to shout out, also twice per pitch by
  themselves), 📊 The Big Presentation (3 drawn slides under dealt headings), 📚 Buy My Book (drawn
  cover, "quotes from the book"; the room rates both books 1–5 stars, stars count as votes),
  🎙️ Press Conference (Exhibit A; reporter questions, plus questions the audience sends in, which
  the saboteur can pick: +50 to the asker), 📺 Late-Night Infomercial (product shot, demo
  instructions, caller testimonials, price tags that stay on screen). Content setting
  Everything / Family / Party (room Family mode wins).
- **Scoring:** +100 a vote (+20 a star), +300 the match win, +50 a "nastiest saboteur" vote, +50
  for backing the winner, +10 a cue taken on, +500 the champion. Audience-mode watchers vote
  through a room poll, capped at the players' weight. `results()`: champion, then bracket depth /
  wins, then points. Awards: Silver Tongue, Bestselling Author, Chief Saboteur, Unflappable,
  Crowd Pleaser.
- **Kit:** TV + phone screens (keynote hall, projection screen styled per mode, podium, backstage
  monitor, bracket view), designed lobby (agenda cards + speaker pass), title screen, intro with
  host Vance Velvet (Orpheus `leo`), 6-step tutorial, partyFit, practice (one 45 s match), gear (8
  items: mics, ties, shades, top hat, headphones), tile art, synth score + recorded CC0 music
  (Holizna "Happy Dance", congusbongus "Which Brand Of Mustard Shall I Buy", Tsorthan Grove
  "Tension") and SFX (ding, mic tap, slide click, ooh, applause; Freesound CC0).
- Tests: `tools/test-box-pitch.js` (16), test-box-kit, test-box-gear, test-box-party,
  test-practice, test-party-plan, e2e-box (tile list). Screens checked by headless screenshots of
  every phase in all five modes (TV 1920×1080, phones 390 px).
- Limits: the cue cards are honour-system (nobody checks the presenter did it); e2e-box has no
  dedicated JustPitch block (it is locked; the screenshot driver played it on real pages instead);
  bots' slides are scribbles.
## November 23, 2026 - Kill the King (TRIAL game, branch claude/king)

The owner's "trial game": a co-op siege plus social climbing, coups and secret roles. Key `king`,
category Friends & Secrets, 4–12 players (best 5–10), 5 rounds (~25 min) or 3 (~15 min).
- **Trial status.** `trial: true` in the module, `data-trial` + a striped TRIAL badge on the tile
  (hub.css `.trial-badge`), the badge in the lobby, on the title screen, in the TV top bar and on
  the intro's logo banner; the first how-to step says it is a trial. Not locked. On its shelf, but
  `public/party/party.js` never deals a `data-trial` tile into a Party Mode lineup (the host can still
  play it mid-party with 🎮 Another game; `partyFit` still fits it to the slot).
- **Feedback.** At the unmask and end screens each phone has 👍/👎 plus an optional note (200 chars,
  no markup, filtered). `box/trial-feedback.js` appends one JSON line per vote to
  `<DATA_DIR>/trial-feedback.jsonl` (game, rating, note, players, rounds, survived; no names or ids).
  Only the live server writes it (or `TRIAL_FEEDBACK_FILE`); the TV shows the 👍/👎 tally.
- **A round:** brief → MISSION (co-op phone task) → repel (defence vs the wave) → COURT (secret
  messages, coup button, secret powers) → dusk (only after an Assassin attempt) → COUP vote and the old
  King's trial (only if someone pressed Coup) → JUDGEMENT (King summons: Kill / Demote / Reveal or mercy;
  hearing with binding deals) → verdict → PAY. End: siege → unmask → over (podium, rivalries, awards).
- **Rules decisions.**
  - Missions (original): Mend the Wall (tap cracked stones, solo warm-up), Light the Beacons (your rune is
    asked for by someone else: shout it; bots "shout" theirs on the TV), Ring the Bells (rings within
    0.7 s make one peal worth 0.6 × ringers each), Man the Gate (pairs; the winch turns only while the
    whole pair holds, slips every 4 s, pairs reshuffle every 20 s). Order for 5 rounds: wall, beacons,
    bells, gate, beacons; 3 rounds: wall, beacons, bells.
  - Kingdom: the target is the sum of the waves (players × mission seconds × 0.75 × 0.8…1.1, growing).
    Missing a wave only dents the walls; the kingdom falls only if total defence < target after the last
    round. Then everyone keeps 25% of their points (the Turncloak keeps everything, +150).
  - Ladder: seat 0 King; tiers Crown 100 / Nobles (seats 1–2) 60 / Guild (seats 3–5) 35 / Commons (the
    bottom seat and seats 6+) 15 per round, plus a mission bonus (defence ÷ 3, max 25). Titles King,
    Knight, Steward, Cook, Blacksmith, Bard, Jester, Stablehand, Gardener; the bottom seat is Peasant.
  - Coup: during court, anyone alive but the King. YES from ceil(60%) of all living players (the King
    counts and always votes no; the caller yes). Passed: the caller is King; seats between keep their
    places, everyone below the caller moves up one; the old King gets SPARE (to the bottom) or KILL
    (a ghost; ties spare). Failed: the caller drops to the bottom. One coup a round.
  - Judgement: King summons a living player with Kill / Demote / Reveal (or mercy). Every living player
    votes; the King is AYE, the accused NAY; ties go to the King; an audience poll adds one vote.
    Acquitted: +20. Reveal shows the accused's sent messages from this and last round on the TV at the
    verdict (the only time message text reaches the TV). Contracts: the King may offer any voter below
    the Knight "AYE → you rise one seat"; the accused may offer "NAY → 10/25/50 of my points". Offers
    are binding and paid automatically if the voter votes that way; accepting pledges your vote;
    voting the other way after accepting is a broken oath (20-point fine to the offerer).
  - Ghosts: off the ladder, no rank pay, no votes, half-strength missions, can still message; once a
    round they may Haunt a living player who voted to kill them (steal 15, halve their next mission).
  - Secret roles (2/3/4/5 for 4/5–6/7–8/9+ players; "Secret roles: Off" setting): Assassin (marks in
    court every other round, 50% kill at dusk, a miss leaves a fresh clue), Spy (one player a round:
    their SENT messages, recipients hidden), Ghoul (on death picks one of its killers, any living
    player if none: drains half their pay every round), Fortune Teller (one peek at a secret role a
    game), Turncloak (paid by the goblins if the kingdom falls; bots sandbag missions).
  - Messages: 1–3 recipients, presets or typed, 100 chars, always run through the word filter (strict
    with the streamer filter), rate-limited; open in every phase except missions and the end.
- **Presentation.** Sir Bellow, a pompous royal herald (crimson tabard, feathered cap, moustache),
  hosts the intro (night hills full of goblin torches → the throne room → the KILL THE KING banner
  with its TRIAL ribbon) and announces every phase on the TV (34 static lines, all pre-voiced; Orpheus
  `leo`, delivery `hype`). TV: canvas castle and goblin horde (pushed back by the defence), the throne
  room with the King on the throne, the ladder by tier, court whisper lines with flying envelopes, the
  coup duel, the hearing with votes flying in, the unmask cards, and round-1 "How it works" banners.
  Phones: the role card (tap to show / hide), one mission at a time, a Messages tab with unread count,
  votes, deals, a two-tap Coup button, secret powers, feedback. Gear: Court hat, Court prop, Cloak (7 items).
- **Audio.** CC0 music from OpenGameArt (RandomMind "Rejoicing" and "The Old Tower Inn", Spring Spring
  "Some Militaristic Tune", Umplix "The Confrontation" and "A Knight's Challenge"; none of the five
  JustKingdoms tracks) and eight CC0 Freesound/OpenGameArt effects (fanfare, gavel, war horn, gate,
  ghost whoosh, bell, scroll, blade). Credits in music.json / credits.json; manifest rebuilt.
- **Tests.** `tools/test-box-king.js` (20 tests: tiers, missions and targets, the ghost half-effect,
  judgement outcomes, contracts, the coup's 60% and seat shift, each secret role, the fall rule,
  message privacy and filtering, secret roles never on the TV, trial feedback, bots playing whole
  games at 4–10 players, kicks, Party Mode exclusion, every herald line pre-voiced); kit, party, practice,
  party-plan, gear tests; an e2e-box section (badge, hidden role, mission taps, a message that reaches
  the inbox while only a line reaches the TV).
- **Limits (trial).** Mission balance is tuned on bots, not on real crowds. The practice round covers
  round 1 only (it stops at the 3-minute cap). The Assassin's odds, pay tiers and the 25% fall rule are
  first guesses: the feedback file is there to find out.

## November 20, 2026 - Natural voices: Orpheus re-voice + a recorded JustMafia narrator (branch claude/voices-natural)

- **How the engine was chosen.** The owner listened to three A/B rounds (files in `%LOCALAPPDATA%\jgb-voice\ab`, `ab2`, `ab3`):
  Chatterbox (MIT, cloned from each Kokoro voice) "better but still like text to speech"; round 2 Orpheus vs
  Dia 1.6B vs Orpheus+Chatterbox voice conversion: **Orpheus, its own voices, won** (leo and dan were
  liked; tara came out "quiet and scary"). Round 3 tried the female voices on upbeat hosts: mia is quiet
  like tara, so upbeat hosts use jess and zoe. Rejected: Higgs Audio v2 (Boson community license needs an
  expanded license above 100k annual users), Kyutai TTS (CC-BY weights, but no public voice cloning and
  several voices come from non-commercial datasets), XTTS/F5 (non-commercial).
- **Orpheus TTS 0.1-ft** (Canopy Labs; Apache-2.0, a Llama 3.2 3B fine-tune so the Llama 3.2 Community
  License applies too: commercial use OK) as the unsloth Q8_0 GGUF through llama.cpp (CUDA) + SNAC 24 kHz
  (MIT), in `tools/voice-orpheus.py`. Every host has an Orpheus voice (`host.voice.orpheus`, part of the clip
  key with the delivery preset `cb`); the full cast is in `tools/voice-gen.js`' history and the intros.
  JustMafia narrators: zac (Small Town, Medieval, Tabletop, Dragons, Dungeon), dan (Noir, FBI, Spies,
  Realistic), leah (Fantasy, Snow), jess (Space, Blocky).
- **Quality gate (every clip, best of up to 4 seeds kept):** transcribe back with faster-whisper small.en
  (MIT; word error rate above 12% = re-roll, spelling-only differences forgiven), a pause over 0.9 s,
  far too long for the text, and the owner's "quiet and scary" complaint measured: raw speech level below
  -23 dB, spectral flatness above 0.05 (breathy) or, for upbeat hosts, under 3.8 semitones of pitch movement
  (flat). Then long pauses are tightened (260 ms for upbeat hosts, 450 ms for narrators) and every clip is
  normalized to the same speech level (-19 dBFS) before the usual 24 kbps mono Opus WebM encode.
- **GPU etiquette.** PyTorch is capped at 40% of the card, the cache is freed after every clip, and the render
  waits while the whole card is above 9.5 GB (`VOICE_GPU_FRACTION`, `VOICE_GPU_TOTAL_MAX_MB`). Renders resume from
  `%LOCALAPPDATA%/jgb-voice/render`; `--encode-only` publishes what an interrupted run made.
- **Setup (once per PC, Windows + NVIDIA):** Python 3.11; `python -m venv %LOCALAPPDATA%\jgb-voice\venv`; in it
  `pip install torch==2.6.0 torchaudio==2.6.0 --index-url https://download.pytorch.org/whl/cu124`,
  `pip install chatterbox-tts faster-whisper snac "setuptools<80"` and
  `pip install llama-cpp-python==0.3.4 --only-binary=:all: --index-url https://abetlen.github.io/llama-cpp-python/whl/cu124`
  (newer wheels crash with an illegal instruction on this CPU). Then `npm run voices` (`-- mafia`, `-- price`, ...).
  Without the venv it falls back to the old in-browser Kokoro path (`--engine kokoro`).
- **Record it yourself.** `npm run voices -- --sheet lines.csv` writes a recording sheet (line id, game,
  character, what to read). Save takes as `<id>.wav` in one folder and run `npm run voices -- --recordings <folder>`:
  Chatterbox voice conversion (MIT) turns each take into that character's voice (the delivery stays the
  reader's), checks it by speech recognition, and saves it as the clip (`e: 'rec'`; later TTS runs keep it).
- **JustMafia narrator** (was the browser speech voice only). `public/shared/narration-say.js` turns each
  template into what the voice SAYS: names become "someone" / "they" (in cutscene captions the victim is on
  screen, so "they"), `{town}` "the town", sentences with counts are not spoken, and a role reveal is its own
  clip ("They were the Doctor."). The TV still SHOWS the full line. The server sends `narration.say`
  (game.js `narrate`, surprises, shroud); cutscene captions send theirs with the `mt-caption` event.
  `public/host.js` plays the clips with the voice on/off and narrator volume settings; the browser voice is the
  last resort (a Judge's typed line, the appended story sentence, a missing clip) or when a browser voice is
  picked by hand in Host controls ("Recorded narrator" is the default). `tools/voice-lines-mafia.js` lists every
  reachable line. Also fixed: role phrases like "the The Fixer".
- **JustGameBox name lines.** Contestant reveals and "…and N more" are spoken as their pre-rendered name-free
  lead ("Give it up for…", "…and more high rollers!") while the card shows the name and fact (show.js
  `nameless()`, `factSpoken()`, `Speech.say(..., { speak })`); with "Natural live voice" on, the full line is
  spoken live instead. Static in-game host lines (`line: '…'` in a game's TV code) are pre-voiced too.
- **Script.** How-to steps are spoken as title + rule; the phone hint stays on screen (shorter, more natural).
- **Result:** 2,093 clips, 134.7 min of speech, 25.1 MB (24 kbps Opus): 634 JustGameBox lines and 1,459 JustMafia
  narrator lines (4 world voices). Transcribe-back mean WER 0.9%; 14 clips above 12%, nearly all invented role names the
  recognizer mishears ("Frost Writer" heard as "Frost Rider"). Rendered in ~3.3 h on the RTX 3060 (x0.46 real time).
  Still the browser voice: a Judge's typed lines, the appended story sentence, in-game reactions built at run time
  (names, scores; the optional live Kokoro voice can read those).
- Tests: `tools/test-narration-voice.js` (keys match, spoken forms clean and name-free, every narrator line
  has a clip once rendered, name-free leads); `test-voice-timing.js`.
## November 20, 2026 - JustGold chests: earn faster, see it everywhere (branch claude/gold-chests)

Owner: "earning takes way too long and the only way to see how much you have is in the shop… every
game including in party mode have a chest opening up scene… After the party mode they should have a
big award on their chest". Done:
- Earning re-tuned (`box/gold.js`, table in `docs/justgold.md` "Earning JustGold"): a 10-minute game
  pays 15–33 JG before bonuses (was 3–10), plus achievements, on-a-roll / win streaks, the first game
  of the day (+25) and day streaks; a common item after ~3 games, a rare one in an evening. Short
  games pay half and are capped; practice, solo-with-bots, kicked and too-short rules unchanged.
- A chest after every box game (`public/box/chest.js`): each phone opens its own (shake, burst, coins
  line by line, counter to the new balance, haptics, quiet coin sounds), the TV shows everyone's row;
  host can skip; ~8.5 s. Party Mode finale: the legendary party chest (stayed all night +40, +8 a game,
  +75/50/30 top 3). Guests see "Save your stuff" and keep the gold if they save in the same room.
- Balance: phone header pill, TV lobby roster, main menu. JustMafia: goldRate 1.25, daily bonus, the
  reward scene draws the chest.
- Tests: `tools/test-justgold.js`, `tools/test-progress.js`, `tools/e2e-chest.js` (new).

## November 19, 2026 - Difficulty everywhere, practice rounds only for new games (branch claude/difficulty)

- **YesChef difficulty** (`difficulty`: 🟢 Easy default / 🟡 Medium / 🔴 Hard; Hard = the game as it was).
  Per order: Easy at most 3 things (1–2 toppings all over or on halves, 2–3 burger layers with one
  patty, 1–2 scoops + 1 topping; special mode 1 topping per side), Medium one step under Hard
  (`SIZES` in box/games/pizza.js). Order shown ×1.6 / ×1.25 / ×1, build time ×1.5 / ×1.2 / ×1.
  Phone tray: the order's items + 3 decoys (Easy) / + 5 (Medium) / everything (Hard). Scoring: a
  topping one slot off counts 60% / 35% / 0, a wrong base 30% / 12% / 0, the total curved (^0.7 /
  ^0.88 / ^1). Easy lists the ingredients on the TV ticket and phone once the order hides (not in
  Head Chef) and reads phone orders at 0.8×. Bots +0.14 / +0.06 memory. Level chip on the TV order
  board, lobby header and phone bar.
- **Box difficulty convention** (docs/game-kit.md "Difficulty"): new `difficulty` fields in Hot Take
  Trivia (question rating; default Mixed), Color Match (ΔE slope 1.0/1.4/1.9 and look time),
  Price Panic (Bullseye 10/5/3%, bust ¾ or ½, Hard falls off ×2), Bomb Squad (modules 2→4 no radio /
  as before / 4→6 radio from bomb 2). Mapped existing settings: Quick Draw `pace`, Zombie
  `difficulty` (forgiving/normal/brutal), JustMarble `holes`, Letter Rush `hard` letters (+ party
  time/categories), Tune Buzz `clip`; Emoji Charades and JustEscape already use easy/medium/hard.
  None for social/voting games, card games, Plinko, Ducks, Kingdoms, Summon.
- **Party Mode "How hard?"** (Easy / Medium / Hard / 🎲 Mixed, remembered per TV, Easy on a new TV):
  `setParty opts.difficulty`, `partyFit({ players, minutes, difficulty })`, level first in the chips,
  in the lineup summary. Mixed = shuffled easy/medium/hard cycles across the lineup.
- **Practice defaults**: on only for a game new here (not in the TV's box.done, not played or
  practised tonight, not finished by most humans' profiles), re-checked as people join until the host
  touches it; `?practice=0` none. Party question "🎓 Practice rounds before new games?" (Yes for new
  games / No / Every game), default Yes for new games. Bug fixed: the old setup's "On" meant every
  game and was remembered, so already-played games kept getting practice; old saved "On" migrates to
  "new games". Also, before, a TV that had finished any game got no practice for anything new.
- Tests: test-box-pizza (kitchen × mode × difficulty), test-practice, test-party-plan, and the four
  new fields' game tests. Limits: the per-TV memory is still localStorage (a cleared/incognito TV
  relies on profiles and tonight's room).

## November 19, 2026 - YesChef: JustPizza becomes a food court (branch claude/yeschef)

JustPizza is renamed **YesChef** (the internal key stays `pizza`: routes, gear ids, saved data).
The YesChef food court has five kitchens on the same engine (box/games/pizza.js `KITCHENS`):
- 🍕 Pizzeria Pina, Nonna Pina: crust, sauce, cheese, toppings on 8 slices (any turn or flip).
- 🌮 El Cohete taco truck, Tía Lupe: shell, filling, salsa, toppings on each of 3 tacos (the
  tacos can be in any order on the plate; which taco gets what counts).
- 🍣 Ren's Sushi Bar, Chef Ren: wrap, rice, filling, toppings on 8 pieces in two rows (the board
  can be turned around; rows, pairs and every-other-piece patterns count).
- 🍔 Buck's Burger Joint, Big Buck: bun, then up to 10 layers stacked bottom to top. Order
  matters (bag of layers 45% + longest common subsequence 55%).
- 🍨 Coco's Sundae Stand, Coco Sprinkles: cone/cup/bowl, sauce, up to 4 scoops in order, and a
  set of toppings.
Setting **Kitchen**: one kitchen, 🎲 Surprise me (random per game, the default and Party Mode's
choice) or 🔀 Food court (all five before any repeat, never twice in a row). Every mode works
in every kitchen; the `halves` twist is named per kitchen (Half & Half, Mix & Match, Rainbow
Roll, Tower Burger, Mega Sundae) and the rush too. Each kitchen has its own owner (host kit +
hat, own Kokoro voice, 20 in-game lines), customers, TV back wall (the intro's set painted on a
canvas), neon sign, counter, phone station and order-phase tune.
- Engine hooks (small, generic): `game.showExtra()` reaches the intro and how-to as
  `show.extra` (box/show.js); an intro may define `onShow(show)` (public/box/show.js, howto.js,
  play.js call it); `show: { openMs }` lets a cast intro ask for a longer opening (YesChef: 14 s;
  room.js preview timing follows it); tools/voice-gen.js renders an intro's `variants` (one pass
  per kitchen, each in its owner's voice: 157 YesChef clips, 133 new).
- Gear: a separate YesChef block (Taco Truck Bandana, Sushi Headband, Diner Paper Hat, Ice Cream
  Scoop; new shapes hachimaki, paperHat, iceScoop). Pizza gear is now 11 of the 12-item cap.
- Tests: tools/test-box-pizza.js (every kitchen × every mode with bots, per-kitchen scoring,
  junk, food court rotation, partyFit); e2e-box plays the pizzeria and the burger joint.
- Limits: the intro's opening length is fixed per game (the narrator-voice retiming work may
  replace `openMs`); a Party Mode "play intros in the break" preview shows the food court with
  Nonna since the next game's kitchen is not chosen yet.
## November 19, 2026 - Shop seasons, daily deals and theme sets (branch claude/shop-season)

Requested: limited-time shop items, items that swap out every so often, and themed outfit sets per
game world with a small bonus. Details and the socket API: `docs/justgold.md` ("Seasons, deals and sets").

- **Limited-time event items**: 48 new character items (hats, outfits, extras, shoes, effects,
  nameplates), 7–9 per event in `public/shared/seasons.js` (`ITEMS[kind]`; Harvest Fest, Frostival,
  Sweetheart Week, Spring Bloom, Summer Splash, Spooky Season; Harvest/Frostival 2027 added with the
  same ids). The server sells them only while their event runs; owners keep them.
- **Daily deals** (6 items a UTC day, the same for everyone, 2 of them 20–30% off at a server-enforced
  price) and a **weekly spotlight** set (35% off its bundle). Deals are buyable off your shelf that day;
  the play-to-reveal shelf (`STOCK`/`nextStock`) is unchanged: the new items are `special` and never on it.
- **Theme sets**: 10 sets (Wild West, Secret Agent, Head Chef, Great Detective, High Stakes, Royal Court,
  Last Survivor, Space Cadet, Paparazzi, Pirate Crew), 3–4 pieces, 19 new pieces. Bundle = the missing
  pieces at 20% off; wearing the whole set pays +5% JG (min 1, max 3) in that set's game
  (`box/gold.js withSetBonus` in `BoxRoom.payGold`) and lights up the shop nameplate.
- **Art**: every new item drawn in `public/avatar.js` (drawSmooth: hats, outfit details, held props,
  back/face/chest extras, shoes, effects) for both bodies; nameplate styles in `shop.css` and `town.js`.
- **Shop UI**: event tab first in the event's colours, Deals (countdown), Sets (progress, try-on,
  bundle, bonus), LIMITED / deal / set ribbons; `/shop?mock=1&now=YYYY-MM-DD&tab=…` previews any day.
- Tests: `tools/test-shop-season.js` (9: event items in/out of season with an injected clock, owned
  after, next year; deals deterministic per day and discount charged; spotlight; sets valid; bundle
  price and ownership; set bonus applied once and capped through a real BoxRoom payout; every new
  item changes the drawn character on a stub canvas, male and female; sockets). `test-justgold` now
  picks a non-discounted item. Ran `npm test` (minus render-smoke), e2e-shop, e2e-account, e2e-box.
- Limits: the set bonus is not shown on the TV during a game (only the phone toast and the ledger);
  events beyond 2027 need new `SEASONS` entries (same `kind`, same items).
## November 19, 2026 - Onboarding: how it works, new-here games, practice rounds (branch claude/onboarding)

Helping first-time groups in, from the title screen to their first finished game.

- **How it works** (`public/hub-onboard.js` + `hub-onboard.css`): a one-minute animated explainer
  (7 scenes, ~60 s) on the title screen the first time this TV opens it (`box.hiw`); replay from the
  "▶ How it works · 1 min" link. Phones are the controllers (QR / `<host>/join` + code), the first to
  join is the host and starts from their phone, everything plays on the TV, your character +
  JustGold + the shop, Party Mode, "you're ready". Drawn with `BOX.body` characters, progress bar,
  Skip / any key closes, a click goes on, narrated by a pre-rendered clip if one exists, else the
  browser voice (never waits for it). Not on narrow screens or Party Mode links.
- **New here? Start with these 5**: Most Likely To, JustPizza, Emoji Charades, JustSnap, Quick Draw,
  but only unlocked games (a locked one is replaced by the next beginner game: Price Panic, Blackjack
  Night…); names, art and player counts come from the tiles (renames follow). Shown while the TV has
  finished fewer than 3 games; "Got it, hide this". Part of the arrow-key menu (`HUB_NAV`).
  **Just pick for us**: group size (2–3 / 4–8 / 9+) → a 30-minute Party Mode of 3–4 easy games that
  suit the group (quick length, intros on, practice rounds for new games).
- **Locked games**: "Play games to unlock more: N/33 unlocked" with a progress bar and buttons for
  what to finish next (`UNLOCKS.LIST[k].from`); picking a locked tile opens a card ("Quick Draw is
  locked. Finish a game of President to unlock it." + ▶ Play President); "What's new" banner with
  confetti for games unlocked since the last visit (the tile's lock-break animation stays).
- **Practice rounds** (`box/room.js`): a "Practice round first" setting on every box game except
  JustRaiseDucks, JustKingdoms, JustEscape, JustMarble (and JustMafia), where it is hidden. On by
  default for a TV that has never finished a game (`host:create onboard`, the TV's `box.done` list),
  for games it hasn't played. The practice copy uses the game's `partyFit` for 2 minutes and the
  fewest rounds (`def.practiceSettings()` can override); it ends at the game's end or the first new
  round after 60 s (3 minutes at most), records nothing (party points, played list, JustGold,
  stats/trophies, unlocks, audience favourite), then "Practice over, now for real!" (6 s) and the real
  game with the real settings, without the intro. TV: a PRACTICE badge (also over the intro), host row
  "Skip practice"; phones: a practice strip (host: Skip / Start for real), tips from the intro's
  how-to steps when the game moves to a new phase (or after a quiet 16 s), and the "Now for real!"
  card. Party Mode setup question 7: "Practice rounds: On / Off / Only for new games" (default: only
  new games for a new TV, else off; remembered).
- **Phone tour**: the first time a phone joins (`box.tour`), ~20 s spotlight on the header buttons
  (you, react, shop, profile, how to play, host menu), skippable.
- **Account timing** (`public/account-ui.js`): the "Save your stuff" card never shows before the
  player has finished a game (games on the account, JustGold, or this phone's `jg.played`); until
  then only "Played before? Sign in". After the first real game it comes up on the game-over screen:
  "You earned 15 JG! Save it with a name + password" (or "Save your stuff" when no JG was paid).
  JustMafia's phone refreshes its account line when gold arrives.
- **Tests**: `tools/test-practice.js` (in `npm test`: every practising game runs a practice with bots
  and records nothing, then the real game with the real settings and no intro; the intro + skip;
  the time cap; Party Mode on/off/new); `tools/e2e-onboard.js` (`npm run e2e-onboard`, in
  `test:e2e`): how it works shows once and skips, the New-here row and lineup, locked games, a
  practice round on TV + phone, the phone tour, the account card hidden before the first game and
  shown after. `e2e-box` opens its TVs with `practice=0`.
- Limits: the practice round of games without a round counter (Two Truths, Debate Club, Tune Buzz)
  can run to the 3-minute cap; tips follow the game's phases, not its exact moment; the explainer's
  narration is the browser voice until clips are rendered for it.

## November 19, 2026 - JustUndercover (branch claude/undercover)

A new box game (key `undercover`, Party shelf, 3–20 players, best 4–10): "a mole has slipped into
the agency". Two requested ideas in one game with modes: Undercover-style word clues and a
fake-artist shared drawing.

- **Rules** (`box/games/undercover.js`): cases of brief → clues → talk → vote → verdict (→ the
  caught mole's last guess) → reveal. Modes: Mixed (Sketch Line every other case, the word modes in
  between), Word Clues (the mole has a similar word and nobody knows their side; one-word clues in
  turns; vote someone out; repeat until the moles are out, match the agents left, or 2–3
  interrogations run out), Sketch Line (the faker only knows the file; one line each on a shared
  drawing, two laps; one vote; a caught faker who names the word still wins), Blank Agent (the mole
  has no word; a caught blank agent who names it wins), Double Agents (2+ moles), Rival Words (no
  mole: half have each word; pick your teammates), Speed Round (8 s clues), Picture Clue (everyone
  doodles their clue at once). Settings: cases 1–6, clue time 15/25/40 s, talk 30–120 s, moles
  auto/1/2/3 (auto by players, always fewer than the agents), word file (every file or one of 12).
  Over 10 players the clues are given all at once; Sketch Line goes one lap. Scoring: +50 a vote on
  a mole, +150 agents' win (+75 if already ejected), +75 per interrogation a mole survives, +300 a
  moles' win, +150 bonus for a caught Word Clues mole naming the password; Rival Words +60 per
  teammate found, −30 per rival picked, +20 for being found. The mole's guess is forgiving like
  Tune Buzz (case, spaces, "the", plurals, small typos); clues that contain or nearly are your own
  password are refused, as are repeats. `partyFit` picks cases/talk/clue time for 5–30 minutes.
- **Words** (`box/games/undercover-words.js`): 12 original family-friendly files × 40–42 similar
  pairs (484 pairs), each word with two one-word hints the bots use.
- **Secrecy:** the TV state never carries a password or a role before the case reveal (only the
  ejected player's MOLE/AGENT stamp, and a caught faker's guess when it decides the case); each phone
  gets only its own card; the phone shows the password only while you hold the ID card.
- **Screens:** Director Grey (intro + in-game NPC at his desk, eye patch, voiced with bm_daniel, 40
  clips), the agency briefing room, TOP SECRET case file brief, cork case board with BOX.face photos
  and clue tags, the shared Sketch Line paper drawn stroke by stroke in each agent's colour, the
  dossier verdict with the MOLE/AGENT stamp, the reveal folders, the debrief podium (BOX.body).
  Phones: hold-to-peek ID card, clue box, line/doodle pad, vote/teammate lists, the last guess.
  Designed lobby (mission setup folder + visitor pass QR), title screen, tile art, spy-jazz score,
  gear (Agent Fedora, Night Trilby, Mirror Shades, Perfect Disguise, Top Secret File, Spy Phone,
  Pocket Lens, Agency Tie).
- **Tests:** `tools/test-box-undercover.js` (16 tests: word lists, every mode with bots at 3/6/12,
  roles and impostor counts, secrecy of TV and phones through whole games, clue/stroke/vote/pick
  validation, forgiving guesses, scoring per mode, disconnects/reconnects, late joiners and kicks,
  host Next, partyFit) in `npm test`; an undercover block in `tools/e2e-box.js` (peek, clue on the
  board, vote, verdict). Screens checked by screenshots of Word Clues, Sketch Line, Picture Clue,
  Rival Words and Blank Agent (TV + phone).
- Limits: bots' Sketch Line strokes are random squiggles, and their clues come from the hint lists
  (two per word, then generic file words), so bot-only games are easier on the agents than people.
## November 19, 2026 - JustSnap, the phone-camera game (branch claude/snap)

SNAP! magazine needs photos for its next issue. Margo Flash, its editor (an in-world character drawn
with the shared host kit: silver hair, pink streak, huge red glasses, beret, camera on a strap), hands
out an assignment; everyone runs around taking photos with their phone; the photos go up on the TV
(numbered, anonymous) and the room votes or guesses. Key `snap`, category Creative, best 3–10.

- **Photo pipeline:** the phone uses a plain file input (`capture="environment"`, `"user"` for selfies,
  plus "Choose from gallery"), so it works on plain-http LAN addresses where `getUserMedia` is blocked.
  Decode with `createImageBitmap(file, { imageOrientation: 'from-image' })` (an `<img>` fallback), draw to a
  canvas at most 1024 px on the long side, JPEG 0.82 stepping down to 0.42 until ≤ 260 KB (then smaller
  sizes), a 360 px thumbnail (≤ 60 KB), preview with Retake / Send, 30 s timeout + retry. Sent as binary
  ArrayBuffers in `player:act { op: 'photo' }`. `server.js` raises socket.io `maxHttpBufferSize` to 2 MB.
- **Server (box/games/snap.js):** magic bytes (JPEG/PNG/WebP only), ≤ 700 KB photo / 120 KB thumbnail,
  one photo per player per slot (resending replaces it), 600 ms between uploads and 24 a minute per
  player, 48 MB per game. Memory only: freed when the round ends (except the round's best photo, kept
  for the final "best photos of the night" issue, max 12) and with the game. Served by `box/index.js` at
  `/box/photo/<room>/<random 16-char id>` (`?t=1` thumbnail), `Cache-Control: no-store`, nosniff, CSP;
  404 once freed, in another room or after the room closes. Bots get generated SVG "photos" (box/games/snap-art.js).
- **Safety:** host hide (🙈 on the TV gallery/reveal, or the host phone) frees the photo and voids its
  votes; "Host approves photos" setting (host phone list or the TV's 🛂 panel, blurred until clicked;
  the host's own photos need no OK; unreviewed photos are dropped after 25 s); anonymous until the
  reveal; typed text goes through the room's filter.
- **Modes (10 + Mixed):** Photo Hunt, Scavenger Race (4 items, speed bonus, majority flags reject),
  Close-Up Mystery (answer + multiple choice from other players' answers; photographer scores the sweet
  spot), Colour Match (8x8 colour grid scored in Lab on the server + style vote), Selfie Faces (a secret
  prompt each; guess which), Tiny Giants, Caption This (everyone captions someone else's photo in a
  ring), Spot the Change (before/after + mark; tap within 14%), Alphabet Hunt (name must start with the
  letter; flags), Team Recreate (teams of ~3, one photo per team, no voting for your own team).
- **Settings:** mode, rounds 3/5/7/10, time to shoot 60/90/120 s, host approval. About 7 min (3 × 60 s)
  to 33 min (10 × 2 min); defaults (5 × 90 s) about 14 min. `partyFit` picks rounds and seconds.
- **Kit:** title screen, intro (flashes in the dark office, the neon sign, Margo; roll call pins every
  portrait up as an instant photo), 6-step tutorial, pre-voiced story lines, score, tile art, gear
  (cameras, beret/paparazzo cap, press passes, shades; new `camera` and `pressPass` shapes in wear-art.js).
- Tests: `tools/test-box-snap.js` (21, incl. a real socket.io binary upload → URL → 404), a JustSnap
  block in `tools/e2e-box.js` (a canvas JPEG handed to the phone's file input, shown on the TV gallery).
- Limits: the colour grid is measured on the phone (the server has no JPEG decoder), so a modified
  client could fake a Colour Match score. HEIC files that the browser can't decode ask for the
  gallery / "Most compatible" camera setting. Not tested on a real iPhone/Android camera here.

## November 19, 2026 - One character in every game (branch claude/characters)

Your JustGameBox character replaces the emoji in the box games, and every game has things your
character wears in it.

- **One character:** the smooth shop character (`drawSmooth` in `public/avatar.js`) is the character in
  the shop and in every box game (TV and phone). New free look field `body` (female | male) in
  `options.js`, validated by `profiles.js` / `game.js`, picked first in the shop and in the JustMafia
  creator: female = narrower shoulders, waist and hips, softer chin, lashes, coloured lips, thin arched
  brows; male = broader shoulders, squarer jaw, thick brows. Old looks without `body` are inferred (long
  hair or a dress → female). drawSmooth now also takes the JustMafia scene options (lean, arms, dragged,
  expression override, theme equipment) plus `wear` (game wearables).
- **Faces everywhere:** `public/box/portrait.js` adds `BOX.face`, `BOX.body`, `BOX.drawChar`, `BOX.faceUrl`,
  `BOX.bodyUrl`, `BOX.setRoster`. The TV roster (tvState players) and a new `roster` field in
  playerState (sent only when it changed) carry every look and gear by id; bots get a generated
  character; humans without a saved look keep their emoji. Every box game client, the intro engine
  (`s.face` / `s.body`), intros, recap cards, party board and lobby rosters use them.
- **Wearables per game:** `public/shared/gear.js` slots now have a `spot` (head/face/hand/chest/back);
  ~150 wearables in smooth vector style drawn by `public/wear-art.js` (cowboy hats and badges in Quick
  Draw, visor/shades/bow tie at Blackjack, crowns and capes in President, hockey mask and bat in Zombie,
  deerstalker and magnifier in JustEscape, chef hats and aprons for the coming pizza game…). A worn spot
  replaces your own hat/extra in that game only. Object slots kept: marble skin, drop ball, card back,
  chips, paddle, buzzer, pen set, banner, meme frame, gallery frame, podium light, crest. Phone themes
  removed (old ids ignored). Existing quickdraw hats, zombie bandanas, escape magnifiers and letters
  pencils keep their ids and became wearables.
- **Shop:** body picker first; per-game gear shows on your character (cards and stage), with the game
  tile as a backdrop.
- **JustMafia on the smooth character** (claude/mafia-art): `character-art.js` is gone; the town, cutscenes,
  phone, Judge, creator, rewards, farewells and previews all draw `drawSmooth`, so the shop look (incl. body
  female/male) is exactly the JustMafia character. Classic ghost = your own character, see-through and pale
  blue with fading legs (costume ghostSkins stay, 1.4x); translucent characters are composited off-screen
  (no overlap artefacts). Added the NPC `execHood`, a distinct scared face (sweat, trembling mouth), beards
  keep the mood's mouth, photo faceSprite, `MTArt.EXPRESSIONS`. Cinema: two-layer noose, the bodyguard and
  detective use real outfits/poses (tuxedo + shades, arms out; trench coat + fedora holding the magnifier).
  Checked by screenshots of every scene in /preview and a full bot game (TV + 2 phones); e2e creator,
  execution, rewards, shop, help, draft, judge pass. Retro mode (`?pix=3`) still snaps everything,
  characters included, through the palette LUT (the default HD mode has no LUT).
- Limits: Pizza items ship
  before the pizza game. Small faces (24 px) are readable but busy with glowing gear.

## November 16, 2026 - JustGameBox

JustMafia became one game in a party box. `/` is the JustGameBox title screen (JustMafia,
President, Blackjack Night, JustRaiseDucks, two empty slots for games still to be chosen);
JustMafia's TV moved to `/mafia`. Box games share one framework (`box/room.js`, socket
namespace `/box`): room code + QR, lobby settings, bots, reconnect tokens, coalesced syncs,
server-owned rules, public TV state and private phone state. Box and Mafia room codes never
collide, and Mafia's join page forwards box codes.

- President: multi-table, card trading, promotion/relegation between tables, turn timers, bots.
- Blackjack Night: simultaneous play for the whole room, splits/doubles, Bust Bets, comeback chips.
- JustRaiseDucks: a farm per player in Duck Valley (TV canvas: buildings, decorations, ducks
  animate what their owner is doing), five skills with phone mini-games, energy/mood, food,
  buildings, decorations, hats, race gear, tactics, weather, farm events, predictions, badges,
  end-of-season awards. Races are simulated on the server and replayed on the TV as a
  side-scrolling course with a following camera, commentary and phone cheering. All art is
  original and drawn in code (duck-raising genre, not copied from any existing game).

Validation: `tools/test-box.js` (18 tests, including 100-player bot games of all three) and
`tools/e2e-box.js` (8 headless-Chrome checks: title screen, QR lobbies, phone joins, a real
turn of each game, Duck Valley, a race, no page errors). Not yet played by real people on
phones; mini-game difficulty and race balance are first guesses.

### JustRaiseDucks, second pass (same day)

- Hatching: each player picks one of three eggs; the egg's talent gives +25% XP in one skill.
  Ducks grow (duckling, young, grown, champion) as their total level rises, and look bigger on the TV.
- Leagues: Rookie Cup up to the Grand Championship (double points); top 3 earn trophies shown on the farm.
- Wild ducks fill races to 6 racers; their level follows the room's average (about a third of
  small-room races go to a wild duck in bot tests).
- Six course themes (meadow, beach, forest, snow, canyon, night) with obstacle variants:
  hurdles, logs, mud, sand, ice, lily pads, waves, rapids, icy water, ice cliffs, cloud updrafts.
- Phone redesign: your own animated farm at the top (tap to pet), skill cards with level rings,
  a categorized shop (food, farm, decor, gear, hats), a race tab, a "My duck" tab and a bottom nav.
- Title screen: JustMafia and JustRaiseDucks as big tiles with one big coming-soon slot; President,
  Blackjack Night and four coming-soon slots in the smaller row.
- Validation: test-box (20) and e2e-box (8) pass. Still untested by real players on real phones.

### JustRaiseDucks third pass + Jackbox-style host (same day)

- Live lobby: JustRaiseDucks opens straight into Duck Valley (like JustMafia's town). Farms pop
  in as people join; players hatch their egg, name and color their duck before the start.
- Host: the first person (not a bot) to join is the host and gets Start / Play again on their
  phone in every box game; the TV can still start too. JustMafia keeps its own Judge rules.
- Training difficulty: Easy (0.7x XP, 10 energy), Medium, Hard (1.7x XP, 22 energy, faster
  mini-games, wipeout under 7). ⭐ targets build a streak worth up to +30% XP; personal bests.
- Perks: a choice of three each time the duck grows up (8 perks that change races).
- Gifts between farms, a Lucky Spin each training period, more quest types.
- Calmer phone: farm picture with only name/stage/coins, energy and mood bars below, a skill
  sheet for picking difficulty, collapsible quests.
- Validation: test-box 24 and e2e-box 9 pass. Still untested by real players.

### More small games and JustKingdoms (same day)

- Seven more small games on the shared framework (built by parallel agents, integrated and tested
  together): JustSketch Relay, Who Said It?, Price Panic, Emoji Charades, Most Likely To…,
  Where Do You Stand?, JustBid. Each has its own rules tests (tools/test-box-<key>.js).
- JustKingdoms, the third big game (/kingdoms, own title and look): engine (economy, 5 ages, buildings,
  units with counters, hex map with seating-order placement, villages, armies, battles, vassals,
  rebellion, alliances, trades, events, three win modes + score, computer players with four
  personalities), a full-screen animated world map on the TV, and a five-tab phone. Design in
  docs/justkingdoms.md, the screen contract in docs/justkingdoms-api.md.
- Platform fixes: "Play again" works for every game; sound cues carrying a player id no longer stop
  later sounds and animations (the id moves to `who`).
- Title screen: small games sorted by type, each tile shows players, time and type.
- Validation: every game's rules tests, and tools/e2e-box.js (22 headless-Chrome checks: every game
  started from the host's phone, played with real taps/typing/drawing to its end screen, no page
  errors; JustKingdoms title → lobby → world map; JustRaiseDucks flows). Not yet played by real
  groups; JustKingdoms balance (ages arrive by ~minute 20 with bots) needs real playtests.

## November 10, 2026 - shared GitHub development

Gabe/Codex and Justin/Claude collaborate in
`https://github.com/SasukeGabe777/JustMafia` using separate local checkouts,
task branches, and reviewed pull requests. Shared agent instructions are in
`AGENTS.md`; `CLAUDE.md` directs Claude to them. `docs/COLLABORATION.md`
documents task claiming, integration, conflict handling, tests, and handoffs.
A pull request template records overlap and actual validation. Main-branch
protection is recommended but has not been configured by this local change.
Documentation changes passed `git diff --check`; no game code changed.

## November 9, 2026 — Storyteller / original-art update

This section supersedes older pending markers below. The supplied Gather packs
were inspected as reference material. No Gather or Darkest Dungeon artwork is
served by the game. Original art is drawn in `avatar.js` (characters) and `world-art.js`.

### Architecture audit before this update

| Area | Existing state | Extension |
|---|---|---|
| Roles | Shared registry, legacy role interactions and six expansion roles | Registry additions and normalized Standard/Custom options |
| Night | Single authoritative resolver; one Mafia attack, killer-only selection and Godfather override | Staged resolver, all-Mafia plurality voting, optional Legacy mode |
| Views | Public TV, private phone and rotating Judge channels | Preserve filters; Grimoire, team coordination and social channels stay private |
| Voting | Open voting, Mayor weight, skip/tie settings, Puppet Master | Optional nomination/defense phases, one ghost ballot, silence restrictions |
| Characters/photos | Shared vector avatar and local photo color sampler | Original modular pixel art, expanded wardrobe, local framed photo workflow |
| Town/scenes | Stable 100 slots, palette themes, reusable scene timelines | Eight residential families, civic growth, persistent ruins, ten new scene previews |
| Persistence | Rooms lived in memory; no durable player economy | Replaceable server profile store with atomic local disk writes |
| Tests | Rules, virtual-clock bots, socket games, renderer sweep | New status/role/social/profile tests and real socket privacy/ownership tests |

### Implemented phases

- [x] **Action/status foundation:** `rules/night-pipeline.js` resolves collection,
  simultaneous blocks, statuses, protection, special actions, collective kill,
  other attacks, information, observations and outcomes. An immutable snapshot
  of ability definitions prevents spent uses changing later stages. Deaths are
  applied at morning; delayed events use logical server phase transitions.
- [x] **Mafia coordination:** every living Mafia member votes and sees teammate
  votes/totals. One collective kill by default; Godfather breaks tied leaders,
  otherwise no kill. Explicit seeded-random tie and Legacy override modes remain
  configurable. Six constrained tactical messages per night. A copied/stolen
  ability target remains separate from the collective kill ballot.
- [x] **New roles:** Town Detonator (default one charge, minimum three phase
  transitions; explosions wait for daytime and destroy even empty homes), Mafia
  Silencer, Town Sorcerer, Mafia Hustler, Mafia Alchemist, opt-in Mimic/Hybrid
  Jester and Town Storymaker. Classic Jester is preserved. Midas copies only
  supported active abilities with owner, restrictions and remaining uses;
  Volatile returns a fallen Mafia for one day, then ash, with no potion loops.
  Storymaker snapshots/restores the same night and remaining time around a
  first-class emergency vote. Instant interruption happens before resolution;
  it is not a retroactively blockable submitted night action.
- [x] **Storyteller information:** source/expiration/visibility statuses; hidden
  drunk, poisoned and malfunction effects alter delivered information, never
  objective truth. Central resolver supports inversion, plausible alternatives,
  a Judge-selected legal false result and bounded assisted selection. Assistance
  selects among false results; it cannot change deaths, teams or winners.
  Reusable true starting facts and 0–3 unused Town bluff roles are private.
- [x] **Grimoire:** searchable living/ghost/alignment views, avatars, statuses,
  uses, targets, team votes, copied/stolen abilities, ghost budgets, whisper
  usage, delayed events, resolution order and chronological true/delivered logs.
  Advanced settings are collapsible with per-role Configure, Standard/Custom,
  reset-role/reset-all and saved setup support.
- [x] **Ghosts/social/voting:** optional one dead ballot per game, ghost-only
  chat plus Judge visibility, consent-based 30-second text huddles with server
  limits, and optional nomination → accusation → defense → single-candidate
  ballot. Seconding, cooldowns, repeat nominations and discussion resumption are
  configurable. Private whisper content stays out of the Judge payload by
  default. Silence blocks digital voting, nomination, whispers and Telepaths.
- [x] **Character creator/progression:** 17 free core hairstyles plus three
  decorative unlocks, basic/premium outfits, six footwear styles, expanded hats
  and accessories, named colors, live preview and owned-item randomization.
  Server validates profile identity, ownership, purchases and centralized
  rewards. Profiles track coins, owned items, achievements, statistics and look.
  Test/bot/forced-role/accelerated/short games do not award currency.
- [x] **Optional photo flow:** explicit local consent, camera permission,
  framing, capture/upload preview, retake, color matching or a pixel face.
  Source pixels are discarded after use. Face pixels remain in memory on that
  phone only and disappear on reload; they are neither uploaded nor shared in
  town/cinematics. Manual customization is complete. LAN HTTP may require the
  file input's Take Photo option because browsers restrict live camera APIs.
- [x] **Original world art:** detailed masonry/timber/slate houses, theme-aware
  architecture/equipment, population-based tavern/guild/smithy/apothecary/market/
  inn/shops/stables/workshops/gates, vegetation, smoke, birds, clouds and fire.
  Door anchors and house ownership are unchanged. Exploded houses retain ruins.
  `/art` previews all building families, hairstyles and outfits; `/preview`
  covers scenes and populations through 100.
- [x] **New cinematics/narration:** fuse planting, full explosion/debris/smoke,
  town crier/emergency vote, revival, ash, shortened clock, nomination, ghost
  ballot and optional silence preview extend the existing timeline library.
  Public attackers remain anonymous. Scene previews do not eliminate players.
  House damage/death waits for the explosion climax on the TV. Human narration
  disables phase timers across new nights, speeches and reveals; music and SFX
  remain available. AI mode is local template narration and browser speech,
  without an external generative or premium voice service.

### Persistence and operational limits

- `.data/profiles.json` persists across restarts on this machine. Browser site
  data holds the opaque profile key. Back up both the server file and browser
  credentials; clearing either loses access. This is a single-process local
  development store, not a multi-server transactional database. `ProfileStore`
  is replaceable; tests can use `MT_PROFILE_STORE=memory`.
- Running game rooms, current statuses, Grimoire logs and delayed effects remain
  in server memory. A server restart ends those sessions; profile coins survive.
- The photo face is intentionally **local preview only**, not synchronized face
  integration. Reliable hairstyle/face recognition and cross-device photo
  storage remain unimplemented optional follow-ups.
- Browser automation cannot currently navigate a local tab (provider error).
  Interactive TV/Judge/phone QA, real iPhone/Android camera checks, projector
  readability and GPU/mobile frame rates still need live playtesting.
- A 20-game Cinematic Chaos sample at 25/50/100 completed without engine errors:
  Town won 28.6%/85.7%/100%. This is exploratory bot evidence, not balanced
  production tuning; large games need more human testing.

### Validation

- 34 legacy rules tests, 33 first-expansion tests, 30 Storyteller interaction
  tests, a durable-profile test, two socket security suites, full socket games
  across Classic/Chaos/Big Party/Storytellers/Cinematic Chaos, and renderer QA.
- Renderer sweep expanded to **1,152** scene/outcome/theme/population runs, with
  timeline action validation, customized residents, anonymous attackers and
  clean queue/lighting/effect teardown. Canvas is stubbed: these are execution
  checks, not screenshots or frame-rate measurements.
- New deterministic bot coverage includes both new presets at 25/50/100.
  Existing 4/10/25/50/100 layout, ownership and simulation checks are retained.
- `npm test` is the aggregate regression command; `npm run balance -- 200
  cinematicChaos 25 50 100` uses the existing simulation architecture.
- Final renderer rerun passed all 1,152 sweeps and the live bot game through
  gameover/reset (2,874 frames, zero renderer errors). Its driver now discards
  sweep-only animation callbacks and does not multiply frames per socket packet;
  the first aggregate run had timed out in that test harness. Other aggregate
  groups passed, and affected mechanics/socket checks were rerun after fixes.

The historical audit below describes the first feature-expansion pass.

## November 2026 feedback audit and implementation

Preserve the 100-player engine; optimize the detailed town for 50. Reuse the
existing pixel art, theme registry, Room engine, bots, virtual clock, and timeline
renderer. Appearance is shared across themes and never encodes a secret role.

Audit before changes:
- Already functional: naming, 100-player capacity, simultaneous night resolution,
  murder outcome timelines, voting/execution/victory scenes, scene preview,
  Judge scenes/camera/music, role reference, theme lock, Human Judge narration,
  private views, reconnect tokens, bot simulations. Extend these systems.
- Partial: population-dependent rings moved houses; creator had only skin,
  shirt color and hat; narration lacked context; themed props were limited.
- Missing: Judge election/removal, disaster confirmation, Investigator,
  Ghostwriter, Puppet Master, Paparazzi, Conductor, Glitch, private phone scenes.

Implementation checklist (updated after verification below):
- [x] Stable neighborhood growth and ambient civic buildings, 4/10/25/50/100.
- [x] Expanded manual creator and shared cinematic appearance; lobby-only edits.
- [x] Disaster and role timelines; private investigation scenes; sequence QA.
- [x] Secure Judge credential rotation, random selection, 80% connected-human
  removal (including eliminated players), volunteer replacement with forfeiture.
- [x] Confirmed disasters and win-condition compatibility.
- [x] All new roles, phone controls, Judge configuration, bots and simulations.
- [x] Contextual narration, Human Judge pacing, theme-aware presentation.
- [x] Regression, socket authorization and renderer coverage.

### Completed implementation

| Feature | Implementation and verification |
|---|---|
| Dynamic town | `public/shared/layout.js` supplies 100 deterministic, bounded neighborhood slots. House assignments survive joins, removals, disconnects and game start. The Judge map and TV share geometry. Roads, civic buildings at population milestones, chimney smoke, clouds, birds and firepit movement extend the existing lighting and wandering players. Tests check 4/10/25/50/100 layouts and stable ownership. |
| Character creator | `options.js`, `avatar.js`, `play.js` and engine sanitization cover hairstyle/color, facial hair, eyes, face, features, clothing, pants, shoes, hats, accessories, skin, shirt and name colors. Shared drawing supplies town, voting, phone and resident cinematic appearances. Edits lock on start, survive reconnects and adapt equipment to the existing themes. |
| Cinematics | Existing timeline actions drive introductions, protection, three disasters, supernatural messages, pixelated photographs and blessings. Added failed-attack and multiple-masked-attacker storytelling variants. Existing automatic murder/save/guard scenes and secrecy are preserved: public immunity remains indistinguishable from protection, and public attackers never use identifying player avatars. Long title cards fit the stage. |
| Private investigations | Detective/Sheriff and Investigator receive a phone-only approach/observation animation and their own result. Investigator clues use actual effective visits, not dummy prompts; a shared Mafia attack counts as one visitor. Blocked actions do not generate false successful clues. |
| Judge scenes/reference | Existing scene dashboard is extended with tavern, hall and firepit spots and new previews. House references are validated. Manual scenes change presentation only. Registry-generated role reference includes all additions, timing, restrictions and win conditions. |
| Narration/themes | Human mode suppresses automatic speech and timers, retains private suggestions, music and SFX, and can switch without resetting the phase. AI mode remains local template narration with theme flavor, first-death/final-survivor context, repetition avoidance and existing sentence pacing. Civic labels/architecture, outfit equipment and synthesized music timbres extend the same theme registry and kits. Theme lock and town name persistence remain intact, including introduction/victory cards. |
| Random Judge | Lobby-only selection chooses a connected human, reserves their observer seat and excludes them from role assignment. Their phone prominently opens the private console using their existing identity token. Previous administrative sockets and bootstrap keys lose control. The TV retains public display/reconnect access. |
| Judge removal/replacement | `governance.js` counts one ballot per identity, requires `ceil(connected eligible humans * 0.8)`, includes eliminated players and reevaluates connections. Individual votes remain private. Petitions prevent kicking human voters. Removal pauses timed or open-ended gameplay and rotates both admin authorization and the private channel. Explicit volunteers may replace the Judge; dead/observer volunteers are preferred, active volunteers forfeit their seat. A replacement resumes the same game. Retired Judges cannot reappoint themselves or retain future role-specific phone feeds. |
| Disasters | Preview creates a one-use confirmation nonce, expiring after 60 seconds, phase change or credential rotation. Confirmation kills through the engine, logs a Judge intervention, pauses for the cinematic and evaluates victory. The Judge resumes/advances after the reveal. Preview alone does not eliminate anyone. |
| New roles | Investigator, Ghostwriter, Puppet Master, Paparazzi, Conductor and Glitch are registered and available in setup, reference, phones, Judge inspection, Test Mode and bots. Ghostwriter: up to three fixed tokens once per day, published at the next discussion/vote. Puppet Master: configurable real ballot redirection limits, public voting only. Paparazzi: publish successful-action clues; independently co-win by surviving with the configured photo total. Conductor: achievable two-voter objectives and confirmed-Town blessings. Glitch: configurable uses, 30 seconds of presentation corruption without changing actual ballots, names or avatars. |
| Test Mode/balance | The Storytellers preset includes every new role. Simulations still use Room, filtered bot views and the virtual clock; reports now count observations, clues, redirects, photos, Harmony, blessings and corruption. `/preview` selects population, theme, scene and outcome without a game. |
| Optional photo helper | Consent-gated JPEG/PNG/WebP processing stays on the phone. Experimental centered-selfie sampling matches approximate hair/skin palette colors, clears decoded pixels and the selected file, and never uploads/displays the photograph. Full manual customization is always available. This is color matching, not face integration, hairstyle recognition or generative avatar creation. |

### Verification and remaining playtest work

- `npm test`: original 34 rules tests, 33 expansion tests, real-socket governance,
  classic/Chaos/Big Party/Storytellers socket games, and renderer smoke tests.
- Socket coverage includes forged/stale credentials, malformed requests,
  presentation-only scenes, explicit disaster confirmation, ghost removal votes,
  replacement, private-channel revocation, and display/phone reconnects.
- Renderer sweep: **832** scene/outcome/theme/population runs, plus a 100-player
  role-scene queue and temporary-corruption cleanup. Customized resident avatars
  and anonymous attackers are asserted. Canvas is stubbed, so this proves
  execution and cleanup, not visual quality or GPU frame rate.
- A 200-game Storytellers sample at 14/25/50 players completed without engine
  failures. Town won 55.2% / 49.3% / 90.9% respectively; Paparazzi independently
  won 21% overall. These are exploratory bot results, not a balance guarantee.
- **Still needs live browser/mobile/projector playtesting:** visual readability,
  cinematic pacing, installed speech voice quality, photo framing accuracy and
  real GPU/mobile performance. Browser automation could not open a local tab in
  this environment. The 50-player preset especially needs balance tuning.
- Advanced selfie feature recognition/face integration remains optional future
  work. No paid image, speech or narration API dependency was introduced.

### JustGameBox Party Mode plan: intros, game length, fitted settings (claude/party-plan)

- Party Mode setup has two new questions: **How long should each game run?** (Quick ~5 min /
  Standard ~10 / Long ~20 / Auto = each game its usual length) and **🎬 Intro cutscenes** (Play each
  intro / Play them in the break / Skip intros). Lineups are built from each game's planned minutes
  (kept within what the game can stretch to) plus the break and intro overhead: 1 hour of Long ≈ 3
  games, of Quick ≈ 9. The choices are remembered on the TV and travel to the server (setParty opts:
  intros, each, plan {key: minutes}, players).
- Every box game module has `partyFit({ players, minutes })`; `box/party-fit.js` validates the answer
  against the fields, has a generic fallback (rounds scaled to the minutes) and makes a short summary.
  Settings are fitted when the lineup reaches a game, refitted as people join/leave the lobby and at
  Start, unless the host changed them (lobby flow). The TV shows them on the lobby strip, the standings
  board ("Up next"), the intro badge and the title card; phones show them too.
- Intros: "break" plays the next game's cutscene (cast mode, no how-to) on the TV after 8 s of
  standings (the break stretches to fit it), then the game starts straight away; the first game's
  plays as the party starts. "skip" shows a 4.5 s title card. The host can switch modes in the ⚙ menu.
- Tests: `tools/test-party-plan.js` (every game's fit for 2/6/15/40 players × 5/10/20 min, whole bot
  parties in each intro mode, lobby flow); e2e-box checks lineup sizes respond to the length.
- Limits: the minutes-per-round figures in each hook are estimates, not measured from real play.

### Player homes (claude/custom-houses)

- [x] Players pick one of twelve home styles in the lobby: Cottage, Tavern,
  Bakery, Smithy, Apothecary, Library, Chapel, Tailor, Watchtower, Windmill,
  Farmhouse and Manor. They also pick one of twelve wall colors. All are free.
- Stored as `avatar.houseStyle` / `avatar.houseColor`. `options.js` holds the
  shared lists. `Room.sanitizeAvatar` validates them and assigns a random
  value when unset, so bots and older saved characters still produce a varied
  town. `ProfileStore.validateAvatar` persists them. As with the rest of the
  appearance, they lock at game start and are public, never role-linked.
- Art extends the existing procedural `MT_WORLD.building` renderer with no
  new image assets. Each style sets its own footprint and adds its own props
  (tavern mug sign and barrels, bakery awning and oven, smithy forge, windmill
  sails, manor wings, and so on). Theme roofs, decor, damage and ruins still
  apply. Civic buildings and unstyled houses render exactly as before.
- The phone creator shows live previews of all twelve homes in the current
  theme, plus color swatches. "Randomize Character" leaves the home alone.
  `/art` shows all twelve styles for each theme.
- Validation: `npm test` passes, with 34 expansion tests including the new
  Homes test. The profile test now covers home persistence and rejection of
  invalid values. The renderer sweep now gives each resident a styled home
  (all 12 styles and colors, 1152 scene/theme/population runs, 0 errors); the
  sweep caught one windmill bug, which is now fixed. I checked `/art` and the
  phone creator visually in headless Chrome screenshots. Not yet checked on a
  real phone, on a projector, or with 50-100 styled homes in a live game.

### Development update 1: character expressions (claude/expressions)

- Bug: the "Features" picker (`smile` / `freckles` / `serious`) did not visibly
  change faces. `smile` had no art (every character had the same flat mouth).
  `serious` redrew that same mouth and added 1px brows at y=-48, which the hair
  fringe (rows -50..-48) then covered. Smile vs Serious differed by only 3-5
  pixels on most hairstyles. Mood and freckles also shared one field.
- Fix: a separate `avatar.expression` field with ten options (Smile, Grin,
  Neutral, Serious, Surprised, Sad, Angry, Wink, Sleepy, Smirk), drawn by an
  `EXPRESSIONS` table in `character-art.js`. Each one has its own eyes, brows
  and mouth. Brows are drawn after the hair so the fringe can't hide them.
  `features` is now face markings only: None, Freckles or Rosy cheeks. Saved
  `features: 'serious'` migrates to the Serious expression (server and profiles).
  Animation states still override the chosen expression (the cinematic scared
  reaction). Every surface uses the one shared renderer: phone preview, TV
  town, voting, cinematics, ghosts and the Judge grimoire.
- Validation: `tools/test-expressions.js` rasterizes the real renderer and
  requires every pair of expressions to differ by 6 or more pixels for every
  hairstyle (dark and light hair), every hat and accessory combination, and at
  2x scale. The old renderer fails this check. It also covers markings,
  migration and the scared override. A new expansion test covers
  save/migrate/fallback/lock/public views; the profile test covers persistence.
  `tools/test-expression-sockets.js` checks over real sockets that the TV and
  other phones update live, that the expression survives a refresh and a
  profile rejoin, and that it locks at start. `/art` shows all ten; I checked
  them visually in headless Chrome. Not yet checked on a real phone or
  projector.

### Development update 2: character creator screen (claude/creator-screen)

- Joining is now two steps. First the room code (a `?room=` link skips this
  step), then a dedicated creator screen. It has a large animated preview
  (idle breathing and blinking, with a name tag in the chosen name color),
  pixel-style category tabs (Body, Face, Hair, Clothes, Extras, Home) and
  visual tiles drawn by the real renderer, framed on the part they change
  (head, hat, body, feet, house), plus color swatches. The creator covers
  skin, face shape, expression, eyes, markings, facial hair, hair and hair
  color, outfit, clothing/pants/shoe colors, footwear, hats, accessories,
  name color, nameplate, effect, and the home.
- Draft vs saved: edits only change the preview and an "Unsaved" badge
  until **Save look** (no room needed; new `profile:avatar` event),
  **Save & join**, or **Save** (lobby edit). **Revert** returns to the
  saved look; **Randomize** still exists and leaves the home alone. A saved
  look lives on the device and in the server profile (`lookSaved`), so it
  survives refreshes, leaving and rejoining, and cleared device storage. A
  new `room:check` event validates the code before the creator opens.
- Extensible: `MT_OPTIONS.AVATAR_FIELDS` is now the one list of saved fields.
  `Room.sanitizeAvatar` and `ProfileStore.validateAvatar` iterate it (same
  defaults and random-pick order as before, so seeded simulations are
  unchanged). `public/creator-config.js` lays out the tabs. Adding an option
  means an options list, one AVATAR_FIELDS line, the art, and one config line.
- Kept: photo assistant, wardrobe shop (locked items hidden from tiles, with
  a count pointing to the shop), lobby-only edits, and `/test` autojoin. Also
  fixed the phone page's horizontal overflow, which came from canvases'
  intrinsic 300px width inside grid tracks.
- Validation: `npm test` (all suites), plus `npm run test:e2e`
  (`tools/e2e-creator.js`). That test drives real headless Chrome at
  390x844 over the DevTools protocol: a new player lands on the creator; all
  143 visible options across 6 tabs update the live preview and selection;
  Unsaved and Revert work; Randomize works; Save & join delivers the exact
  look to the TV; it survives a refresh; lobby edits reach the TV; a second
  player keeps their own look; rejoining another room starts from the saved
  look; Save look persists; the server profile restores the look after
  device storage is cleared; `/test` auto-join phones still join directly;
  there is no horizontal overflow; and there are no page errors. That is 10
  checks, and they passed 3 runs in a row. I reviewed the screenshots of
  every tab. Not yet checked on a physical phone.

### Development update 3: house customization and ownership

- Houses are now a separate system from the character. `player.homeLook` /
  `profile.home` hold the design, validated through `MT_OPTIONS.HOME_FIELDS`:
  design (12 styles), wall color (12), roof color (theme default + 9), door
  (6: plank, arched, double, painted, round, iron), windows (6: classic,
  shuttered, round, stained, planters, tall), yard decoration (8, free) and
  shop decoration (catalog unlocks). Older saves that kept
  houseStyle/houseColor/houseDecor on the avatar are migrated by the room,
  the profile store and the phone.
- Ownership: `p.house` stays the unique plot and seat number ("PLAYER 3"
  keeps working). A player can live on their own plot, claim an empty plot
  (`Room.freePlots`), or move in with an owner (`p.livesWith`, up to
  `MAX_RESIDENTS` = 4 per house). Only owners' plots show a house. Guests go
  back to their own plot automatically when their host leaves, is removed,
  or moves in elsewhere (`reindexHouses`). Claims are lobby-only; residency
  holds through the game. Views expose `home`, `livesWith` and `homeLook`.
- Signs: every house on the TV has a wooden sign with plot number + owner
  and "+ residents". They're rebuilt from the live roster each frame, so
  joins, departures and moves update them. Characters walk to the house
  they live in. Window lights, cinematics (victim's home), damage (worst
  state among residents) and the Judge scene map all follow the home.
- Phone: after Save & join, a "Claim your house" screen opens. It shows a
  live house preview with its sign, "Where you live" choices (own house /
  empty plots / live with X with occupancy), and designer tabs (Design,
  Paint, Door, Yard) using the creator's tile system. The design is a draft
  until Move in / Save house. The lobby shows your house status and a
  "Your house" button. The design persists on the device and in the server
  profile (`player:home`, `profile:home`). `/test` auto-join skips the screen.
- Validation: new expansion tests for every house field, sanitizing,
  independent designs, legacy migration and the lock at start; an ownership
  test covering empty plots, taken plots, moving in, capacity, guests and
  self, unique seats, guests returning when the owner moves or leaves, own
  house, and the lock at start; profile tests for house persistence,
  fallback and decor ownership. The renderer sweep now gives every resident
  a full design with all doors/windows/yards/roofs and shared houses (1152
  runs). `npm run test:e2e` now has 14 checks, adding: claiming after join,
  all 55 house options previewing live, Move in reaching the TV, a second
  player designing separately then moving in, both phones showing the
  residency, a TV screenshot with signs, and the house persisting across
  rooms and from the server profile. Not yet checked on a physical phone or
  projector; the signs are small at 100-player scale.

### Development update 4: narrator and story (AI narrator)

- With the AI narrator running dawn automatically, each single night kill
  gets a story location: the victim's house, the lake, the hearth, the tavern,
  the field outside town, or another player's house. The last one is used
  only when the victim was really investigating that house that night
  (Detective/Sheriff `investigate`, Investigator `spy`) and roles are revealed
  on death, so the TV never leaks a hidden role. `Room.deathPlace` picks from a
  hash of room, day and victim: deterministic, and it never consumes the
  rules RNG, so seeded games and simulations are unchanged. Presentation only;
  no rule reads it.
- Lore narration: new `kill_lake/hearth/tavern/field/visit` lines in all three
  narrator styles, e.g. "{name} stayed at the lake a little too long…". Home
  deaths and multi-kills keep the classic lines.
- Scenes: `death_lake` (drowning: run into the water, splash, ripples, sink),
  `death_hearth` (embers), `death_tavern` (tipsy last customer),
  `death_field` (fog outside town) and `death_visit` (watching a lit window).
  All use the existing timeline engine with a hooded attacker and never a
  player avatar, plus new `place*` points, a `camera: 'place'` target, and
  `splash`/`embers`/`ripple` effects. Locations live in `MT_LAYOUT.PLACES`.
- Unchanged: the Human narrator, and the Judge's manual reveal mode
  (`revealMode: 'judge'`), keep the classic murder scene and text. Saves,
  guards and multi-kills keep their scenes.
- Validation: expansion tests cover all five public locations appearing over
  80 seeded games with matching lore, never "visit" for non-inspectors,
  inspectors dying at the watched house (with the host's name in the lore)
  only when roles are revealed, determinism, and manual mode staying
  classic. The existing Judge-reveal rules test still passes unchanged. The
  render sweep grew to 1312 scene runs across all themes and populations
  with 0 errors. I checked all five scenes in headless Chrome via
  `/preview?scene=death_lake` and tuned the lake ripples, the watcher
  position and the field framing. Not yet checked on a projector.

### Development update 5: optional theme fields

- The theme registry (`public/shared/themes.js`) gained optional, documented
  fields any theme can use: `roleNames`, `teamNames`, `villain` {name, title,
  avatar}, `ui` colors, `narration` (overrides lines for every narrator
  style), `effects.confetti`, `civic`, `houseTrim`. Helpers `roleName()` /
  `teamName()` fall back to the normal names. Rules never read any of this.
- Engine improvements that came with it: the cinema spotlight now works on
  the town stage, titles can have a readability band, scenes can show a theme
  villain, and cinema kits are per theme.
- The one-off custom theme that first used these fields was later removed
  before release; a saved setup naming it falls back to the default world.

### Development update 6: shop, gold pouch and inventory

- Gold: the existing server-side coins are now "gold". `ProfileStore` tracks
  balance (`coins`), lifetime `goldEarned` / `goldSpent` and a 20-entry
  `ledger`, all recorded through one `record()` path. Older profiles are
  migrated on load (balance counted as earned). Purchases are validated on
  the server, and an unaffordable or duplicate purchase changes nothing.
- Catalog (`public/shared/cosmetics.js`): items now carry a category,
  description and optional price override, and the file documents how to add
  items. New premium house designs: Dark Mansion and Modern House,
  with new art and a flat-roof variant in `world-art.js`.
  Random/default homes only use the 12 free designs.
- Inventory: `profile.inventory` (owned shop items with their equipped
  state) and `ProfileStore.equip()` / socket `profile:equip` equip or
  unequip any owned item on the saved character or house. In the lobby this
  applies to your seat right away, so the TV updates.
- Phone: a Shop button (lobby, gold pouch popover, creator). The shop screen
  (`public/shop-ui.js`) is a Zelda-style counter scene: a drawn shop interior
  with a shopkeeper, the current section's wares on the shelves, and the
  selected item on a cushion with a price tag, plus shopkeeper dialogue. It
  has section tabs (Clothing, Hats & Gear, Hairstyles, House, Flair,
  Inventory), item tiles with price/owned/equipped/locked badges, and a
  detail panel with description, price, your gold, and Buy (disabled with a
  reason when unaffordable or achievement-locked) or Equip/Unequip. The pixel
  gold pouch shows in the game header; tapping it shows balance / earned /
  spent and recent entries. The old in-creator shop panel was replaced.
- Validation: profile tests (pouch fields, failed purchase unchanged, award
  ledger, exact deduction, no double purchase, inventory, equip/unequip of
  house and character items, unowned equip refused, persistence, migration).
  New `tools/e2e-shop.js` (real Chrome, 7 checks: pouch, shop open/close,
  preview + unaffordable, buying deducts exactly, inventory equip/unequip
  reaching the TV, refresh persistence, no page errors). The e2e helpers now
  live in `tools/cdp.js`; `npm run test:e2e` runs both suites.
  `MT_DEV_GRANTS=1` enables a test-only gold grant.

### New player help, Judge console v2, DLC 1 roles

- **New player help** (`newPlayerHelp`, default on; `public/help.js`, `help.css`):
  - Quick join card on the creator (random look, auto house, no claim step).
  - A per-phase "what to do now" bar from the phone's own view, and a "?" How to Play overlay with the roles in play.
  - "What does my role do?" on the role card, and one-time tips (`mt.tips`).
  - TV: a lobby how-to and a per-phase `#hud-help` line.
  - `room:check` returns `help`. Test: `tools/e2e-help.js` (7).
- **Judge console v2** (`judge-v2.css`, restructured `judge.html`; all IDs and handlers kept):
  - A sticky control bar (Start / Next / Pause / +30s / roles).
  - Five tabs: Play, Setup, Players, Scenes, More. Grimoire, test mode and the log moved to More; old saved tabs map there.
  - Play shows a live headline (`#g-status`) and only the relevant cards.
  - Setup uses collapsible sections, with role-pack filters (`ROLE_PACKS`: core / expansion / dlc1 / all) and a compact ⚙ per role.
  - Test: `tools/e2e-judge.js` (5).
- **DLC 1** (`rules/dlc1.js`, installed last):
  - The night pipeline has a new `information` handler stage (it runs after attacks).
  - Handlers: frame / trap (statuses stage), alert / clean / link (specials stage), seance / watch (information stage).
  - Trap results come from a `resolveNight` wrapper.
  - `shownRole` covers the Framer and the Impostor's cover role.
  - The `kill` wrapper handles the Janitor (`p.cleaned` hides the role until game over) and Cupid's heartbreak (announced in the narration).
  - The Crier's proclamation goes through `dayAbility {op:'crier'}`; Eavesdropper and Cupid info appear in `playerView`.
  - Test: `tools/test-dlc1.js` (9, including 12 bot games).

### Update 8: farewell animations + house-specific visuals; story-aware deaths

- **Farewells:**
  - `OPTIONS.deathAnim` is an avatar field, sold in the shop's Animations section (80–200 gold) and equipped from the inventory.
  - `public/farewell-art.js` draws each effect as a pure function of time. The shop loops it as a preview; the TV plays it once over the body (cinema `farewell()` on `die`/`drop`).
  - It is the victim's own item, so it never reveals the killer.
- **House visuals:** `drawHouseDecor` tints the bedroom with the house paint and adds signature furniture for all 15 designs. The house is the owner's (a roommate dies in the owner's house).
- **Story context:** `rules/story.js` → `storyContext(p)` returns only public facts:
  - first, late and alive count
  - roommate (house signs)
  - defended (gallows defenders)
  - accused and nearly (public votes only)
  - survived (a public save scene)
  - It is attached to night kill events and execution cinematics.
  - Scenes use `storyCaption` / `storyBubble` (first matching fact wins).
  - The dawn narration gets one personal sentence (`storySentence`).
  - Lines never name a possible killer.
- `dawnEvent` is 16.2 s so a farewell can play before the fade.
- Tests: `tools/test-story.js` (6).

### Story-driven death scenes, the Headhunter, and the Hunter

**Scenes**
- New cinema actions:
  - `grab {front}` (a face-to-face hold) and `struggle` (thrashing arms)
  - `dragBody` (a fallen body slides behind its killer, leaving a trail)
  - `caption` (narrator story beats; AI narrator only; spoken through the TV voice via the `mt-caption` event)
  - actor-relative points `{ actor }`, interior props, and `placeShore`.
- Bug fixed: `a_release` was defined twice, so the second definition overrode the tether release (grabs never let go). The resident release is now `a_unhold`.
- The bedroom murder, every outdoor death (lake, hearth, tavern, field, visit) and the new `death_chase` now use grab → struggle → blow → fall → X eyes → blood pool, with four narrator beats each.
  - The lake drags the body to the shore.
  - The camera pushes in for the struggle, and the chase is followed by the camera.
- New `headhunt` and `headhuntExecution` scenes.
- Manual mode: the Judge picks a scene for each kill in the dawn reveal list (`reveal {index, place, setPlace}`). All death scenes are in the Judge's manual Scenes list.
- The AI narrator's location roll now includes `chase`.

**Roles** (`rules/headhunter.js`, installed last because it wraps kill/night/views)
- Hunter (Mafia): exact-role investigation of non-Mafia players. Results appear as `mafiaView.intel` for the whole team.
- Headhunter (neutral, max 1):
  - The mark is set live and becomes a fake teammate vote in `mafiaView`/`teamPicks` display only (never `teamPicks` resolution, never shown to the borrowed face).
  - Levels come from mark deaths (any cause except leaving).
  - `shownRole`: a Villager, or the chosen disguise from level 1.
  - Powers: puppet (locks one Mafia vote), strike, reveal, all roles, and a daily execution.
  - Neutral-killer win logic is shared with the Serial Killer.
- `player:headhunter` socket event. Tests: `tools/test-headhunter.js` (11).

### Role Draft (new Default role selection) and the optional Rundown

**Role Draft**
- New setting `roleSelection`: `draft` (Default, new games) or `manual` ("Custom roles": the unchanged previous behavior). `draftSeconds` sets the vote length.
  - Editing `roleCounts`, the old role switches, or a preset switches to Custom roles, unless the same update sets `roleSelection` (saved setups).
- `mafiaView.rolesInGame`: the dealt composition, shown in the Mafia coordination panel.
- Phase `draft` with stages deck (7 s) → vote → result (5.5 s) → collect (5 s), then the existing `startGame()` / roleReveal.
- Server: `rules/draft.js`. Logic: `public/shared/draft.js` (pure; card scaling, balanced candidates with per-room rotation, finalize with ties and repair).
- The vote closes early once everyone connected has locked in.
- A drafted roleReveal waits up to 30 s for players to flip their own card (`player:flip`). It ends 3.5 s after everyone has looked; the TV only learns *who* looked.
- Late joiners during the draft are dealt in.
- Kicking someone during the draft removes them like in the lobby (this fixed a bug where a kick ended the game). No winner checks run before roles exist.
- UI: `public/draft-ui.js` + `public/draft.css`, shared by the TV overlay and the phones.
  - Web Animations are offset by the server stage time, so all screens stay in sync and a reloaded phone resumes mid-animation.
  - New sfx: shuffle, deal, flip.
  - Judge console: Manual/Default select and vote seconds.
- Tests:
  - `tools/test-draft.js` (12 tests): defaults, manual unchanged, scaling 4→3 / 8→5, balance, rotation, vote validation, early close, fair ties, invalid-vote repair for 4–30 players, dealing and secrecy, flips, leave/join/reconnect mid-draft, cancel/pause, old saved settings.
  - `tools/e2e-draft.js` (6 checks): real Chrome with a TV and 2 phones.
  - `tools/stress-20.js` now drafts with 20 phones.

**Rundown of the game** (optional, after game over)
- TV button or Judge console (view / show on TV / hide).
- Tells the story night by night from the event log and vote history: actions, outcomes, votes, gallows interventions, last words, Judge removals, who was who, and awards. Built only at game over.

### Lobby-only customization and shop; in-game role card fix

- Once a game starts, the phone is purely the game. "Change my look",
  "Your house" and "Shop" exist only on the lobby card. A player still in
  the shop, creator or house screen is returned to the game. The gold pouch
  stays visible, but its menu says the shop reopens in the lobby.
- Enforced on the server too: while a profile holds a seat in a game that
  isn't in the lobby, `profile:buy`, `profile:equip`, `profile:avatar` and
  `profile:home` are refused (look/house room edits were already
  lobby-only).
- Bug fixed (introduced in update 5): the phone role card referenced an
  undefined variable when showing themed role names. That made every phone's
  in-game render throw at game start, leaving the lobby card on screen. The
  e2e shop test now starts a game and asserts the role card renders with no
  page errors.
- Validation: `tools/e2e-shop.js` (8 checks) now starts a real game:
  the shop closes, the lobby buttons disappear, the role card renders, the
  pouch shows the shop as closed, and the server refuses buy/equip/look
  changes, leaving the avatar unchanged. Creator e2e still 15/15.

### HD graphics (sharp pixel art)

- Before: the TV drew the whole 1920x1080 map into a 640x360 buffer
  (`PIX = 3`), snapped every pixel to a limited palette, and scaled the
  buffer up with nearest-neighbor, again for every camera zoom. The result
  was heavily pixelated and noisy.
- Now (HD, the default): the town draws only what the camera sees, straight
  into a buffer at the screen's real resolution (capped at 1.5 buffer pixels
  per world unit for 4K), with the camera applied while drawing. Pixel-art
  sprites, houses, signs and effects stay sharp in wide shots and in 2-3x
  cinematic close-ups. The static map is cached at view resolution (copied
  1:1) plus a 2x copy built on demand for zoomed scenes. The palette filter
  is off in HD.
- Retro mode keeps the original look (low-res buffer + palette filter): TV
  ⚙ panel → "🎨 Graphics: HD/Retro" (saved per screen), or `?pix=3`.
- Validation: the render sweep (1512 runs, 0 errors) runs in HD. Headless
  Chrome with the GPU disabled measured 60 fps retro vs 50 fps HD at
  1920x1080 with 30 players (33 fps before the cached-background
  optimization). Real browsers with GPU acceleration should hold 60; not yet
  measured on the actual TV. Side-by-side screenshots of a wide view and a
  zoomed cinematic were reviewed.

### Move-in requests (setup only)

- Moving in with another player now asks them first. `Room.claimHome({ with })`
  creates a request; the owner gets 20 seconds (`MOVE_ASK_MS`, room clock, so
  virtual-clock tests work) to answer via `player:moveReply`. Yes moves the
  asker in, after re-checking capacity and availability. No, a timeout, a
  cancel, or picking another option leaves them home, and the asker sees what
  happened. Bots, who can't answer, accept. Requests exist only in the lobby;
  `startGame` cancels any still pending, and removals drop requests involving
  the removed player.
- Phone: the owner gets a solid Yes/No card on top of any lobby screen, with a
  countdown bar and the page dimmed. The asker's house screen shows "Asked
  Ana… 17s" with Cancel, then the answer ("said yes", "no thanks", "didn't
  answer in time"). The option reads "Ask to live with X", then "Asked X",
  then "Living with X". The lobby status line shows a pending request.
- Gameplay is unchanged: residency still only affects the TV (shared house
  and sign, characters walking home to the same door). New on the TV: a
  housewarming burst, "Moved in!" and a 🏠 bubble when someone moves in
  during setup.
- Validation: new expansion test (pending until answered, 20s deadline, yes,
  no, timeout via virtual clock, late answer ignored, only the asked owner can
  answer, cancel, bots accept, game start cancels and late answers fail); the
  ownership test adapted to the request flow. Creator e2e (15/15) now does the
  flow across two real phones: the request card appears on Ana's phone with a
  countdown, No reaches Ben, then Yes moves him in.

### Development update 7: end-of-game gold rewards

- The server calculates and pays rewards (`ProfileStore.award`), once per game
  id, and returns a breakdown: finished the game, your side won, neutral win
  bonus, survived, role actions, objectives, correct investigations, helping
  teammates (saves), and each achievement unlocked by the game. Every value,
  per-category cap and the per-game maximum (now 60) live in `REWARDS` in
  `public/shared/cosmetics.js`; repeated actions only count up to their caps.
- `rules/progression.js` stores each player's result (`rewardResults`) and
  sends it only to that player's phone (`view.reward`; the TV never gets
  it). Practice games still pay nothing, and now say why: test bots, fewer
  than 3 people, hand-picked roles, sped-up games, or shorter than the
  minimum. `MT_REWARD_MIN_MS` shortens the minimum for tests only.
- Phone reward scene (`public/reward-ui.js`), automatic after a completed
  game: your character (grinning), your pixel gold pouch, coins arcing into
  it for each breakdown line as it appears, the balance counting up from
  before to after, and "Capped at …" when the per-game max applied. It plays
  once per game per phone, with a replay button on the results card; the
  header pouch keeps the old balance until you close the scene. Practice
  games show the reason instead. The results list also uses themed role
  names.
- Validation: expansion test plays real games to the end (breakdown sums,
  gold actually paid, victory/survival lines only for the right players,
  winners earn more than losers, the TV never receives rewards, settling
  twice / replaying a game id pays nothing, bots or a short game explain why,
  farming hits caps and the max). New `tools/e2e-rewards.js` (real Chrome, 3
  human players): the scene opens after the game; coins animate while the
  header pouch waits; the breakdown and total are right; the balance
  persists after refresh; no auto-replay; replay doesn't pay twice; no page
  errors.

### Hooded executioner, character rig, and the Executioner role

- Animation upgrade: characters now have a small limb rig in
  `character-art.js`: `lean` (the body tilts from the feet), `arms` (each arm
  rotates from its shoulder joint), a real stride (feet lift in turn), and
  `dragged` (heels planted). Cinema tethers (`grab` / `release`) lock a dragged
  character's wrist to the dragger's hand, so they're physically pulled along,
  leaning back, with dust at their heels. A follow camera keeps moving action
  framed. A redesigned gallows has a raised deck, stairs, a lever and a
  trapdoor that swings open; the trapdoor drop falls through and jerks to a
  stop on the rope; a noose rope is drawn to the neck while standing.
- The execution is now done by one anonymous hooded executioner NPC (black
  full-face hood, no player's look). They grip the condemned by the wrist,
  drag them across the square and up the stairs onto the trapdoor, place the
  noose, then walk to the lever and pull it. Then X eyes, the rope gives way,
  bleed out, decay, bones, reveal and last words. The townsfolk react where
  they stand; there is no mob, so no scene figure can be read as a voter.
  Interrupted and Bodyguard variants use the same drag.
- New Town role: Executioner (🪓). Once per game, during the verdict, they
  may reveal themselves and die in the condemned's place. The scene, "Saved by
  the Executioner": at the noose the hooded executioner stops and unmasks (the
  Executioner's own character, public by their choice), frees the condemned,
  puts the noose on themselves and drops. Priority: interruption >
  Executioner > Bodyguard. Their role is public from then on
  (`revealedExecutioner`).
- Hood of Mercy (`hat:executionerHood`): a crimson, gold-trimmed full-face hood,
  an achievement reward ("Save someone as the Executioner") unlocked through
  the normal end-of-game rewards.
- Validation: Executioner expansion test (only that role gets the option,
  priority over the Bodyguard, the condemned survives, role secret before and
  public after, once per game, an interruption still wins and doesn't spend
  the sacrifice, the hood is locked until earned, then buy and equip). The
  render sweep (1627 runs) checks that no scene figure wears a player's look
  (public or anonymous votes), the executioner is the hooded NPC dragging by
  the wrist, and unmasking reveals the Executioner while the condemned lives.
  The expression test confirms full-face hoods hide the face. Execution e2e
  still 5/5. Limits: the preview tool's frozen screenshots don't animate
  the follow camera; check the close framing on the live TV.

### Cinematic vote executions with interventions (mystery first)

- When a vote eliminates someone (only then), the TV plays a new execution
  scene. The townsfolk rally and seize the condemned, who is terrified and
  pleads; friends who chose to defend them rush in and argue. The mob carries
  the condemned overhead to a gallows on the square and throws them up to the
  noose. They hang and sway; their eyes turn to X's; the rope gives way; they
  bleed out on the ground and decompose to bones. Then the reveal: the role
  appears only when roles are revealed on death, and last words follow if left.
- Server-authoritative, decided before anything is shown (`startExecution`).
  During an extended verdict window (`VERDICT_WINDOW_MS`):
  - Role Blocker: "Interrupt the execution" (once per game). Nobody dies, and
    the scene shows an anonymous masked figure with a smoke bomb.
  - Bodyguard: "Take their place" (once per game). The Bodyguard is hanged
    instead and shown, because their death is public; the condemned survives.
    An interruption takes priority over a protection.
  - Anyone: "Defend them" is visual only and public by the player's choice.
  - The condemned: last words made only from a living player's name and/or a
    fixed word (LIAR, INNOCENT, TRUST, WATCH, SUSPECT, AVENGE ME, GOODBYE).
    Free text is refused. Shown only if they actually die.
  - Settings `executionInterventions` and `lastWords` (both on by default).
- What each audience sees (`executionCinematic`, `verdictOptions`): the TV
  cue carries no roles or teams. The mob is the real voters only when votes
  are public; with anonymous votes it's masked townsfolk (hooded, faces in
  shadow), so no figure wears a player's look. The interrupter is never
  identified in the cue or narration. Each phone gets only its own verdict
  options; the TV gets none.
- Robustness: skipping (host "Next phase") never changes the outcome, because
  the server resolved it first. A TV that joins or reconnects more than 4s
  into an execution doesn't replay it (it shows the end state). Duplicate
  executions are impossible (`pending` is consumed; kills require alive).
  Interventions reset each game.
- Reusable engine pieces: props (gallows, blood pool, bones), a mob that
  follows the visibility rules, defenders, masked figures, carried/hanging
  poses, X-eye and decay states, a reusable `HANGING` timeline, outcome
  branches, and conditions (`lastWords`, `defenders`). The execution phase
  now lasts 24s.
- Validation: rules test (public cue, no role/team); expansion test (per-player
  options, TV gets none, free-text last words refused, public mob = voters,
  anonymous mob leaks no ids, interruption beats protection, the interrupter
  is never identified, once per game, Bodyguard swap, no last words from a
  survivor, settings off, skipping keeps the outcome). Render sweep (1589 runs)
  with secrecy checks: an anonymous mob never wears a player look, the public
  mob is exactly the voters, the interrupter is masked, and a late TV join
  doesn't replay. New `tools/e2e-execution.js` (real phone + 4 players): the
  same verdict gives different information per player, Ana interrupts from her
  phone, her choice survives a reconnect, the outcome is decided on the server,
  the TV cue and narration never identify her, and skipping keeps the outcome.
- Next (from the cinematic brief): extend the same visibility-aware scene
  system to night attacks and rescues, betrayals and confrontations, role
  abilities, game changers and victories.

The historical phases below describe earlier iterations; this completion audit
supersedes their pending markers for features implemented above.

This plan is based on the feature brief (Judge scenes, day/night flow, themes, pregame setup, voting, roles, Telepaths, Test Mode). It extends the existing game rather than rebuilding it.

## What already existed (v1)

- **Server-authoritative engine** (`game.js`): phases, roles, voting, filtered views, bots. Kept, and extended.
- **Socket layer** (`server.js`): rooms, reconnects, QR codes. Kept, plus a Judge channel.
- **Big screen** (`town.js`): canvas town and cinematic cues. Kept, plus themes, two-ring layout and multi-event nights.
- **Phone** (`play.js`): join, role card, night actions, voting, ghosts. Kept, with prompts per role and Telepath messaging.
- **Tests**: `tools/simulate.js` (socket end to end) and `tools/render-smoke.js` (renderer).

## Architecture decisions

1. **One rules engine for everything.** Real games, bots, headless simulations and tests all call the same `Room`. Timers go through an injectable clock (`clock.js`), so simulations jump straight to the next timer instead of waiting.
2. **Data-driven roles** (`public/shared/roles.js`). Each role declares its team, night ability (`kill`, `shoot`, `heal`, `guard`, `block`, `investigate`), targeting rules, limits and flags (`appearsInnocent`, `nightImmune`, `voteWeight`, `pair`). `resolveNight` resolves abilities by kind, in a fixed priority order:
   1. blocks
   2. heals and guards
   3. kills and shots
   4. investigations

   Ties are broken by the room's seeded random generator, so results are deterministic. Most new roles are one entry in the registry.
3. **Three views, three trust levels.**
   - `hostView`: the TV. Public information only.
   - `playerView`: one phone. Public information plus that player's own secrets. Bots get exactly this too.
   - `judgeView`: the Judge console. Everything. Sent on its own channel, and you need the host key to join it.
4. **Mechanics and presentation are separate.** The engine emits `cinematic` cues and narration keys. The big screen decides how to show them. Themes are presentation-only (`public/shared/themes.js`).

## Status

### Phase 1: core systems ✅

- **Role registry, done.** Roles: Villager, Mafia, Godfather, Roleblocker, Detective, Sheriff, Doctor, Bodyguard, Vigilante, Mayor, Telepath (×2), Jester, Serial Killer.
- **Win conditions, done.** Town, Mafia (at parity or when everyone else is gone), Serial Killer, Jester, and a draw as a safety net.
- **Night resolution, done.** Priority order, roleblocks, Bodyguard trades places, night immunity, and promotion when the Mafia's killers are gone.
- **Voting rules, done.** Mayor's double vote, skip on or off, tie rule, plurality or majority, and anonymous votes.
- **Judge flow controls, done.** Open and close voting (manual mode), pause and resume, extend, skip a phase.
- **Overrides, done.** The Judge can set a night action, set a vote, eliminate, revive, change a role, or force a role before the game. Every override is logged.
- **Expanded pregame setup, done.** Theme, min and max players (up to 100), automatic or exact Mafia count, a count per role, timers, rules toggles, presets, and saved setups (kept in the Judge's browser). Live validation flags setups that break the game and warns about balance.
- **Telepaths, done.** A private coded-message link between the two Telepaths, from a fixed list of messages. Messages can name a player. The Judge sets when they can talk.
- **Up to 100 players, done.** Bigger rooms batch their state updates, and the town switches to two rings of houses.

### Phase 2: Test Mode and analytics ✅

- **Bots, done.** Five personalities (Analyst, Aggressive, Cautious, Follower, Chaotic).
  - Each bot keeps a suspicion score for every player, built from votes, accusations, revealed roles, its own investigations and Telepath messages.
  - Role-specific logic: investigators announce what they find, the Mafia coordinate and bluff, the Jester baits votes, and so on.
  - Bots only see their own phone view.
- **Test controls, done.**
  - Add up to 99 bots, with a personality per bot.
  - Speed from 1× to 50×, skip animations, auto-acting bots on or off, and "make bots act now".
  - Inspect every role and action, and override any decision.
  - Force roles to set up a scenario.
- **Simulations, done.** Thousands of headless games in a worker thread, launched from the Judge console or `npm run balance`.
- **Analytics, done.** Win rates overall and by player count, average days and minutes, role survival and win rates, causes of death, how often day eliminations hit a non-Town player, tie and skip rates, Doctor and Bodyguard saves, investigator hit rates, Vigilante friendly fire. Results download as JSON.
- **Tests, done.** `npm test` runs:
  - 28 rules tests
  - the socket end-to-end games, including the Chaos preset and a 60-player Big Party
  - the renderer smoke test

### Phase 3: cinematic gameplay & Judge controls (revised after playtest feedback)

Playtest feedback: the audience wants **animated stories**, not a camera zooming into a house. A murder should play as a 10–15 second scene: an assassin approaches, sneaks in, the victim notices, an attack, the lights flicker, fade to black.

**Art direction (added mid-phase):** the whole game is cozy farm-sim **pixel art**. The style is original; no assets are borrowed.
- **The big screen** draws its world into a 640×360 buffer (`?pix=N` changes this). Every frame is snapped to a warm hand-picked palette in `public/pixel.js`, including pre-blended night tints, and then upscaled with nearest-neighbor. Text (names, bubbles, titles) is drawn on a crisp overlay in the *Pixelify Sans* font. `?pixel=0` turns the palette snap off.
- **The TV HUD, phones, Judge console and preview** use the same skin: wood frames, parchment panels, bevelled pixel buttons.

**Engine vs presentation.** Nearly all of Phase 3 is presentation. The small engine changes are marked below. Cinematics never change game state.

1. ✅ **Cinematic engine** (`public/cinema.js`).
   - **Actions**, reusable across scenes:
     - movement: spawn, move (walk, sneak, run), pose (stand, sleep, cower, guard, peek), face, flee through a window
     - combat: attack (theme weapon swing or ranged bolt), hit, die, shield ward, smoke, glint
     - effects: knock, house light, lamp, flicker, thunder, door, shake, flash, fog
     - presentation: camera, stage cut, fade, letterbox, title, music mood, sfx loops, crowd reactions, walk the condemned, execute
   - **Stages**:
     - the town, with a real camera over the real map (`town.focus` / `focusSpot` / `focusHouse`)
     - a full-screen **interior** drawn per theme: a suburban bedroom, a stone cottage, or a space habitat
   - **Scenes are data** (`public/scenes.js`): `[time, action, args]` timelines with outcome branches.
2. ✅ **Murder cinematic** (about 14s) with every outcome: `kill | protected | guard | guardDies | blocked`.
   - ✅ Quiet night, execution (the condemned walks to the fountain, the crowd reacts, and their visual death is held back until the climax), victory.
   - ✅ Manual scenes: investigation, watcher, peek, flee, visitor, empty house, graveyard, square.
3. ✅ **Secrecy.** Engine change: `cinematic.events` is sanitized to `{type, targetId, guardDied?}`.
   - Saves and immunity look identical, protectors are anonymous, and attackers are hooded.
   - *Also fixed:* the TV used to receive `settings.forcedRoles`, which mapped players to their roles. Tests cover both.
4. ✅ **Judge scene controls** (console → 🎥 Scenes): a clickable mini-map of the real layout, camera spots, zooming to a house, every manual scene on the selected house, a murder outcome picker, music moods, and stop.
   - Server relays: `judge:scene/camera/music/stop/narration`. They are Judge-only and validated, they go to the TV only, and they never touch game state.
5. ✅ **Cinematic event queue.** Engine change: `revealMode: auto | judge`.
   - In Judge mode, dawn has no timer. The console lists the night's public events with ▶ Play, Replay and Play all, plus blocked attempts marked ⚠ as optional extra information.
   - **Next phase** moves on to the morning.
6. ✅ **Role reference** (📖 Roles in the console header). It's generated from the role registry (`MT_ROLES.reference`), so it can't drift from the rules.
7. **Narrator modes.** Engine change: `narratorMode: ai | human`.
   - ✅ *Human Judge*: the TV and phones get no narration. Lines appear in the console as private 💡 suggestions. The mode defaults to manual phases and Judge reveals.
   - ✅ Custom "📣 Say" lines and "⏭ Skip narration".
   - ✅ The TV speaks sentence by sentence, with dramatic pauses.
   - ⏳ Still to do: context-aware AI lines (first death, few left, quiet streaks) and per-theme flavor.
8. **Themes.**
   - ✅ The theme locks once the game starts.
   - ✅ Each theme kit has its own assassin look and weapon (knife, dagger, blaster, wand, axe, pistol), its own interior and its own music root.
   - ⏳ Still to do: per-theme town props (e.g. medieval stalls, space domes) beyond palettes and building shapes, and per-theme music beds.
9. ✅ **Preview** at `/preview`: any scene × outcome × theme, day or night, with no game. `?autoplay=1&t=8&freeze=1` jumps to a moment, which is useful for screenshots.

Tests:
- `npm test` covers sanitization, forced-role secrecy, the execution cue, Human Judge mode, the theme lock and Judge reveals (34 rules tests).
- The socket tests check that scene controls are Judge-only and validated.
- The renderer smoke test now plays **every scene × outcome × theme** to the end (128 runs) and checks that the town is left clean.

### Phase 4: new roles (after Phase 3)

All of these hook into the role registry, bots, simulations, the Judge console and cinematics.

| Role | Team | Engine work | Presentation |
|---|---|---|---|
| Detective+ | Town | none | private phone animation (spy, then the result) |
| Investigator | Town | track night *visits* per house; clue text generated from real visits | phone spying animation |
| Ghostwriter | Town (dead) | day action after death: up to 3 tokens from a word bank plus names; frequency setting | "Message from beyond" scene at the next discussion |
| Puppet Master | Mafia | voting-phase action: redirect one living player's vote; uses setting; only with public votes | ballot visibly swerves; the victim's phone shows the changed vote |
| Paparazzi | Neutral (wins by surviving to the end with N photos published) | night: photograph a target; captures the *kind* of their action | flash + silhouette reveal at day start (the Judge can trigger it) |
| Conductor | Town | nightly objective generated from living players; checked at verdict; charge setting | Harmony Gauge on the TV; Town Blessing reveals a confirmed Town player |
| Glitch | Town | limited CORRUPT uses in day phases | 30s visual corruption on the TV only; the real state is untouched |

### Phase 5: polish, testing & balance

- Rules tests for every new role and interaction.
- Disconnects during actions, rapid phase skipping, 100 players.
- A render smoke test over every scene × outcome × theme.
- Simulations for the new roles: vote manipulation, Investigator clue value, Conductor objective difficulty, Ghostwriter and Paparazzi information strength.

## Balance pass (November 13, 2026)

About 40,000 headless games, run in parallel. Bots alone vote almost at random (they catch a
Mafia member about 25% of the time), so the simulator now models sharp real players:
`room.simReads` (simulations only, never set in live games) gives each Town bot a noisy gut read
every day that leans slightly toward the real killers. At reads 20, Town votes out a killer about
40–50% of the time. The defaults below are tuned for that; check with
`npm run balance -- 400 all 8 12 16` (add `--reads=0` for the old bot-only numbers).

- **Mafia family size** (autoMafiaCount): 1 up to 8 players, 2 up to 12, 3 up to 15, 4 up to 18,
  5 up to 22, then about 3 in 10 (30 players: 9). Support roles that don't fit (e.g. Godfather plus
  Roleblocker at 7) are left out with a warning.
- **Jester:** being voted out still wins, but the game now goes on and the Jester shares the final
  result (it was ending 15–28% of drafted games). Role option `endsGame` restores the old rule.
- **Serial Killer:** kills every other night (role option `cooldown`); new option `immuneTo: mafia`.
- **Puppet Master:** one forced ballot per game (was two).
- **Draft:** Serial Killer and Headhunter count on the evil side when the draft checks balance.
- **Presets:** Chaos (10+) swaps the Telepaths for a Sheriff; Storyteller adds a Framer; Cinematic
  Chaos drops the Doctor; Big party has one Detective (was two).

Results at reads 20: drafted games with every role, Town 49.7% / Mafia 45.4% / solo killers 5%.
Classic 53–59% Town at 7–14 players, Town vs Family 48% at 7, Storyteller 47–55% at 16–20,
Cinematic Chaos 44–50% at 16–20, Big party 44–48% at 30–40. Group size still swings a few points
(8 players leans Town, 10 leans Mafia), as in any Mafia game. Each role's swing (vs an average game
of the same size) is within ±3 points for most roles; Sheriff (+7) and Detective (+5) are the
strongest Town roles on purpose. Talk-based roles (Conductor, Crier, Ghostwriter, Investigator)
look slightly weak with bots, which can't use them well; real players should do better.

## Profile progression: levels, challenges, seasonal events (November 19, 2026)

Branch `claude/progress`; design in `docs/progress.md`. JustMafia's season pass and weekly
challenges moved into a box-wide system on the wallet (`box/progress.js`, `public/shared/challenges.js`):
a player level (1..∞, XP from every finished box game, Party Mode and JustMafia game), 3 daily and
5 weekly challenges across all games (deterministic per UTC day / ISO week, 1 free reroll a day),
2–3 event challenges per seasonal event, and the event's season pass (25 tiers; free track + a
195 JG premium track with the event's limited items from `seasons.js`). Old 's1' pass owners get a
free premium pass for the current (or next) event; old pass XP became profile XP. UI: ⭐ Progress in
the box phone's 🏆 My profile and in JustMafia's Season & unlocks (replacing Season / Weekly), level
badges on the TV roster, party board and phone header, level-up / challenge toasts on phone and TV,
event banners on the title screen, TV lobby, join screen and a level + event strip in the shop.
Validated: `tools/test-progress.js` (14 tests, incl. real bot games of 5 box games, Party Mode,
JustMafia sims, sockets), updated `test-season.js`, `e2e-shop.js`; screenshots looked at.
Limits: games with their own TV lobby (e.g. Most Likely To…) don't show the lobby banner; players
without a linked wallet earn nothing until the phone links it (opening the profile does).

### Title screen header cleanup (claude/hub-clean)
The seasonal event banner floated on its own centred row between the header and the games, with a
tiny icon (a `.jgp-banner span` rule shrank the icon too). The header is now one row: logo, tagline
and How it works on the left; on the right the event card (`data-season-banner="hub"`: icon, name,
"Seasonal event · N days left", or "Next event · starts in N days" muted when none is running), shaped
and sized like the Party Mode button beside it, in the event's colours. The open-room notice and its
"Back to room" / "New room" buttons became one strip under the header (`.room-bar`); the phone-only
join and shop links moved into the header so phones see them first. Also fixed the event icon size on
the phone join screen banner. Validated: screenshots at 1920, 1366, 1024, 800 and 390 wide (first
visit, returning, no event, open room), `e2e-onboard.js`, `test-box-kit.js`, `test-season.js`, `e2e-box.js`.
## UI polish: shop and phone screens (November 20, 2026)

Audited /shop (390x844, 360x740, 1366x768), the box phone (/box/play: join, lobby, host menu, How
to play, profile, avatar sheet, a Price Panic round, results) and JustMafia's phone (/play: creator,
claim a house, lobby, Season & unlocks, draft, role card) with headless screenshots.
- Box phone header no longer runs off the screen: Leave moved into the avatar sheet (tap yourself),
  header buttons are even 42px squares; on phones under 375px the name hides (avatar + level stay).
- Join avatar picker is 6 per row (it was clipped at 360px); bigger tap targets for the audience link,
  sheet close button, tour buttons, lobby actions, host bar and the account banner.
- Host bar: caption on top, buttons share one row; profile tabs are equal icon-over-label tiles.
- Shop: compact header on phones (no truncated subtitle), 44px tabs / 40px chips, faded edges on the
  sideways tab rows (wrapping on desktop), action bar under the shelf on desktop, no long-press text
  selection, consistent earn rows (coin + amount), short ledger dates, no duplicated JustMafia blurb.
- JustMafia phone: Pixelify Sans had no fi ligature ("Mafia" showed a broken glyph): ligatures off;
  sticky header no longer lets cards peek above it; deck news readable on parchment; room under the
  react button; "Played before? Sign in" framed like the cards.
Validated: test-box-kit, e2e-shop, e2e-account, e2e-box; no page errors in the screenshot runs.
## JustRaiseDucks training mini-games: hitboxes, feel and drawn art (November 20, 2026)

- Every mini-game hit test now uses the numbers the drawing uses: `DUCK_ART.duckBox` gives the duck's
  body box, feet zone and round core from the same scale/stage/bob as `drawDuck`. `?dkdebug=1` on the
  phone page draws all hitboxes (and keeps a miss log on `DUCK_MINI.dbg`).
- Sky Rings: a ring is judged once, when the duck's centre crosses its plane: through the opening
  (PERFECT near the centre), clipping the rim, or missed. The ring's back half is drawn behind the duck
  and its front half over it. Ring openings are the duck's size plus a margin per difficulty; storm
  cloud hitboxes are the drawn puffs. Hold-to-fly steers toward a target speed (quick reversals,
  nose tilts with speed); gusts stay well under top speed; rings spawn within reach.
- Hurdle Dash: hurdles trip only the feet zone; floatier jump (150 px, ~0.68 s) so each hurdle has
  ~0.2 s of timing slack; birds fly just above a grown duck's head; the ground strip no longer smears.
- Paddle Power: a real beat clock (no jump at stage changes), early/late feedback, the next pad glows,
  a stroke meter. Cliff Climb: the grab point is a drawn dot at the end of the duck's wing, the
  PERFECT band is drawn at its true width, loose rocks never overlap the hold. Bug Snack: tap radius
  = drawn body + a fingertip of slop; bees only sting on a direct tap; moving bugs stay on screen.
- Emoji used as sprites replaced with original canvas art (`DUCK_ART.drawIcon/drawBug/drawBird`): corn,
  birds, bugs, bees, beetles, crystals, rocks, storm clouds, the climbing wing; farm decorations,
  trophies, effects, mood faces and the training bubble; race event icons and cheers. Emoji remain
  only in text labels.
- Validated: test-box-ducks, test-box-kit, the ducks sections of e2e-box; phone-size (390x844)
  screenshots of every mini-game with and without hitboxes; scripted perfect-play bots on Easy and
  Hard finish runs with no unfair misses (Hard rings: an occasional clip right as a gust starts).
  Not yet played on real phones.
## Pets: a little animated friend on your shoulder (November 20, 2026)

Branch `claude/pets`; details in `docs/justgold.md` ("Pets"). New look field `pet` (one or none) with
16 original pets in 4 rarities (80–495 JG), drawn in the smooth style by `MTArt.drawPet` (own block at
the end of `public/avatar.js`) on the screen-left shoulder for both body types and every size. Idle
loop (breathing, blink, flick, look-around, hop) driven by time, repeating every 4 s; reduced motion
gives a still pose. Cached box pictures with a pet animate through one throttled rAF frame loop in
`portrait.js`. Shop: new 🐾 Pets tab with animated cards, buy / wear / take off, wardrobe group;
JustMafia's creator lists owned pets. Pets are `special` (not on the shelf or in daily deals).
Validated: `tools/test-pets.js` (5 tests), `tools/e2e-pets.js` (6 checks, screenshots looked at),
`test-box-kit`, `test-expressions`, `test-box-gear`, `test-shop-stock`, `test-shop-season`, `test-story`,
`test-profiles`, `test-box-profiles`, `e2e-shop`, `e2e-account`. `test-justgold`'s "a finished box game pays
JustGold once" fails the same way on the commit before this branch (ledger delta 10 vs 3 with
today's date); its other tests pass. Limits: JustMafia's join creator still starts from the phone's
stored draft (existing behaviour); the server keeps the account's pet when the phone doesn't send one.

## Seasonal events v2: an event every half month, animated title screen, items and sets for every event (November 20, 2026)

Branch `claude/events`; details in `docs/progress.md` (calendar table) and `docs/justgold.md`.
- `public/shared/seasons.js` is now a rule, not a list: 24 kinds, 1st–15th and 16th–end of every month
  (UTC), any year, ids `<kind>-<year>` (today: `harvest-2026`, Nov 16–30). Real holidays where there is
  one (New Year, Valentine's, St Patrick's, Easter time, Earth Day, May flowers, Ocean Day, solstice,
  summer fireworks, Moon landing, the August meteor shower, back to school, Talk Like a Pirate Day,
  Halloween, Thanksgiving, winter holidays) and original events in the gaps (Neon Nights, Dino Days,
  Robot Rumble, Blood Moon, Campfire Nights, Gingerbread Town). Same API (`currentSeason`, `nextSeason`,
  `daysLeft`, `SEASONS`) plus `nextOfKind`, `seasonById`, `isSeasonId`; `?eventDate=` previews a date.
- Title screen: `public/hub-events.js` + a small block in `hub.css`: one animated canvas scene per
  event (leaves and a harvest moon, snow and aurora, red moon and bats, fireworks, jellyfish, synthwave
  grid, lanterns, …), shaded in the middle for readability, reduced-motion aware, falls back to soft
  party lights. The header layout (event card beside Party Mode) is unchanged.
- 121 new limited items (18 kinds × 6–7: hat, outfit, two extras, shoes for most, effect, nameplate),
  drawn in their own file `public/avatar-events.js` through small hooks in `avatar.js drawSmooth`
  (hat, hatBack, details, behind, hand, chest, face, back, shoe, effect); script tag on every page that
  loads avatar.js. A full themed set per event (`ev-<kind>`, 4–5 pieces), bundle only during its event,
  set bonus in every game while it runs. Event challenges (3 per kind) and the pass track per kind
  (nameplate free at tier 10, the rest premium).
- Validated: `test-shop-season` (12, incl. calendar for 2026–2028, holidays, event sets, every event's
  pass, every item drawn on both bodies), `test-progress` (14), `test-season`, `test-justgold` (after
  merging main's fix), `test-box-kit`, `test-expressions`, `test-pets`, `e2e-shop`, `e2e-onboard`,
  `e2e-pets`; screenshots of the hub for all 24 events at 1920×1080 and 8 at 390 px, the shop's Event
  tab (phone + wide, try-on, bundle) and every event set on female and male characters were looked at.
- Limits: the main scene features sit at the edges, so on a TV most of the scene shows around the
  tiles rather than behind them; JustMafia's own title screen keeps its look; the old 6-kind event
  windows changed (e.g. Harvest Fest is now Nov 16–30, not the whole month).

## Steam desktop app (claude/steam-app, November 20, 2026)

- `desktop/`: Electron 45.3.4 app (electron-builder 26.18.1, steamworks.js 0.4.0, own
  package.json/lock). `server.js` runs as a utilityProcess child on 0.0.0.0 (stable port 47800,
  next free one if taken); the window (no menu, no dev tools when packaged, single instance,
  autoplay without a click, F11/Alt+Enter fullscreen) shows the title screen from 127.0.0.1.
  App settings window (F10, or a button injected into the title screen's ⚙ menu; only this local
  page gets an IPC bridge): Local/Online mode with server URL test, network adapter pick (join link
  changes live via `setBaseUrl`), firewall/same-Wi-Fi help with buttons to Windows' pages (the app
  never changes the firewall), port, fullscreen, Steam overlay, saves/music/log folders.
  Online mode loads a hosted server (checked via /healthz, waits up to 75 s for a sleeping free
  host); unreachable → local mode with a message. Server crash → restarted on the same port.
- Server: `DATA_DIR` (data-dir.js) for profiles.json and box-profiles.json (the only .data
  writers), `MUSIC_DIR`, `HOST`, lan.js (adapter scoring: virtual adapters/MACs and 169.254 down;
  the default-route adapter preferred in the app), fatal listen errors, achievements.js hook.
- Steam: guarded; App ID from STEAM_APP_ID/SteamAppId/steam_appid.txt, 480 only in development,
  packaged without an ID = no Steam. Achievement stubs only.
- Fonts: all 22 Google Fonts families self-hosted (`public/fonts/`, latin + latin-ext, licences);
  pages and CSS no longer call Google. Left on CDNs on purpose: kokoro-js (optional live voice, needs
  the internet for its model anyway), YouTube/TikTok/Instagram embeds and iTunes/Deezer (online games).
- The build ships only git-tracked runtime files + production deps (scripts/stage-server.js,
  after-pack.js); the repo's my-music songs are left out (licences unconfirmed; JGB_BUNDLE_MUSIC=1).
- package.json renamed `mafia-town` → `justgamebox`. THIRD_PARTY_NOTICES.md and
  docs/steam-release.md (owner checklist) added.
- Validation: the built exe was tested only hidden (JGB_TEST_HIDDEN=1, tools/e2e-desktop.js):
  title screen, self-hosted fonts, autoplay, settings window, QR = LAN link, a headless phone
  joined via the LAN address, saves in userData, single instance, quit stops the server, online
  mode and its fallback all passed. Not verified: how it looks on screen (fullscreen, settings
  window layout), the Steam overlay/achievements with a real App ID, a real phone on Wi-Fi,
  Steam Deck.

## JustRaiseDucks: Smarts, the maze, eight new worlds, automatic naps (claude/ducks-smarts, November 23, 2026)

- Smarts 🧠 is the sixth skill everywhere the other five are: XP/levels, stat bars, duck card, TV
  spotlight and farm sign, quests, bots, wild ducks, the egg (Starry egg), Walnuts (+40 Smarts XP), a
  Hedge Maze farm building (+20% Smarts XP per level), the Maze Map gear (no wrong turns), the Inner
  Compass perk (half the wrong turns). Growth stages are scaled to six skills (12/30/60). Old ducks
  are migrated on every lookup (`migrate`): missing skills/buildings start at 0.
- Lily Path (the Smarts mini-game, `ducks-mini.js`): a frog hops a path across the lily pads, then
  the duck repeats it pad by pad; quick taps are PERFECT, a cleared path pays a bonus and the next
  is one hop longer, a wrong pad splashes and the frog shows it again. The rules (`lilyPath`) run
  headless in the tests; `dkdebug=1` on the phone page draws the pad hit circles and the next pad.
- The maze section (every world has one; Terrain: Everything includes it, Classic has none, Brainy
  has two or more): a fork every 11 m. The server decides each duck's choice at each fork like a
  hurdle (Smarts, the map, the compass and fog set the odds): the shortcut (a burst of speed), a
  think (0.9 s at the signpost, head-scratching) or a wrong turn (2.6 s: on the TV it turns round,
  waddles down the dead-end path, finds the wall, turns again and walks back). Commentary, a quiet
  click (`sfx/ducks/maze.ogg`, Kenney CC0) and the phone's live race follow it.
- Eight new worlds (`public/box/games/ducks-lands.js`, original canvas art; the six old worlds draw
  exactly as before): Volcano Run (lava streams to leap, ash, basalt, lava pit, lava tubes), Murky
  Swamp (roots, murky water with floating logs, mud bank, misty bog, reed maze), City Rooftops
  (chimneys, puddles, fountain pool, building wall with windows, the gap between buildings, alley
  maze), Lost Jungle (roots, rapids, waterfall climb, gorge with vines, temple maze), Dusty Desert
  (cactus hurdles, dunes, oasis, sandstone, slot-canyon maze), Sky Islands (floating islands, cloud
  path, sky lake, big glides over the clouds, cloud maze), Candy Land (gumdrops, taffy, chocolate
  river, candy-cane cliff, cotton-candy clouds, licorice maze), Haunted Farm (hay bales, foggy pond,
  the old barn roof, a foggy ravine, a corn maze, bats and the moon). Each has its own far layer,
  props, ground, obstacles, ambient effect and section weights.
- Naps are automatic: no Nap button or op. A duck too tired for even an Easy run falls asleep by
  itself (after a run or on the farm tick); the phone pops up "😴 <Name> is exhausted and needs a
  nap" with a sleeping duck and a countdown; it can't train until it wakes (+35 ⚡), but it can be
  fed and petted and the shop works. The TV farm shows it sleeping (Zzz). A race wakes it.
- Training stops when a race starts: a mini-game in progress closes at once and sends its score so
  far, which counts (capped by the time played before the start; a cut run never breaks a streak or
  wipes out); after 6 s nothing more is accepted. Phones show "🏁 Race in progress: training opens
  after the race" until the podium is over; the server refuses training then too.
- Validation: test-box-ducks (21 tests: Smarts, Lily Path scoring, maze forks deterministic and
  stat-driven, every theme, terrain modes, training stopped at the race start, auto-nap, bots),
  test-box, test-box-kit, test-box-gear, e2e-box (six mini-games on a real phone page, a run stopped
  by the race start). Headless frame strips of every world and of the maze moments were checked.
  Not yet seen: real phones and a real TV.

## JustRaiseDucks: Risk it!, three foods, a feeder show, Smarts rebalanced (claude/ducks-risk, November 24, 2026)

- Easy / Medium / Hard are gone. Every mini-game plays at one normal pace (⭐ target 16, ⚡15). After
  a run that earned XP the result card offers **🎲 Risk it?**: one very hard 15-second round (the old
  Hard pace and windows) with a goal shown up front (a share of the score just made, 6-30). Meet it:
  the run's XP is added again (double). Miss it: the duck falls over (phone card + TV farm tumble)
  and keeps only half of that XP (a level gained can be lost). No extra energy. The server decides:
  no offer, no risk; scores are capped by time; a round reported before its 15 s are up, cancelled
  after the countdown or never reported back counts as a fall. Offers expire (30 s on the phone,
  45 s on the server) as "keep it"; none is made in the last ~27 s before a race; an open offer or
  a risk round cut by the race start keeps the XP (or wins if the goal was already met). Old runs
  and best scores saved with a difficulty still load (best = the best of the three).
- Food is three sizes: Seeds (5 coins, +20 ⚡), Corn Cob (12, +45), Feast Bowl (28, fills up), on a
  quick-buy row on the training page (price + pantry count) and in the shop. A tap feeds one (from
  the pantry first); a full duck saves it in the pantry (max 9 each). Berries, Worms, Duck Cake,
  Lucky Clover and Walnuts are gone; any in a pantry convert to the nearest new food.
- Every farm has a feeder (dressed up with a green roof by the Auto Feeder building): when fed, it
  shakes and pops the food into its bowl, the duck waddles over, pecks it up piece by piece (soft
  clicks from the existing ducks/maze.ogg) and hops with a heart.
- Bug Snack (Stamina) is easier: bugs stay up ~50% longer, fewer bees (a bee only breaks the
  combo), bugs only walk in the final stretch, a bigger fingertip slop and PERFECT window.
- Smarts rebalanced: measured with six ducks equal but one skill raised (200 seeds per row), Smarts
  won 27% at L8+4 on Everything and 58% on Brainy (the top skill). Fork odds now level off
  (diminishing returns), wrong turns / thinking / shortcuts cost and give less, the Maze Map halves
  wrong turns (no longer zero), the Inner Compass cuts 30%. Lily Path pads score without the combo
  multiplier (a fast perfect memory used to score up to 3× the other games). After: 11-20% on
  Everything (mid-pack; Run 23-35% is the strongest), 28-40% on Brainy, next to Run.
- Validation: test-box-ducks (29 tests: Risk it! win/fall/kept for all six games and forged
  scores, food + pantry migration, Bug Snack pace, a Smarts balance check), test-box-kit, test-box,
  e2e-box (a real Risk it! round on the phone). Headless screenshots checked.

## JustRaiseDucks: every skill counts, varied seasons, help for non-gamers, real climbing and flying (claude/ducks-balance, November 24, 2026)

- Owner asks: "Balance each skill and make each one needed to train that makes it good"; help bad
  players / non-gamers; fly and climb shown for real (a bridge to fly across, a rock wall to climb);
  each race a bit different, the skills spread evenly over the whole 5- or 8-race season.
- Measured with `node tools/ducks-balance.js` (six ducks equal, one skill raised; balanced vs
  specialist; balanced vs "all but one"; per world; per season). Before (one skill +4 at level 8,
  Everything, 200 races): Run 37%, Smarts 20%, Climb 22%, Swim 12%, Fly 7%, Stamina 3% (Stamina
  60% at level 1, nearly useless later); Classic terrain Run 75%. After: every skill 13-21% at
  every level (max/min about 1.2-1.9x per 200-race row, within 1.6x at 500 races); Classic 13-23%
  (no Smarts there: no mazes); Brainy favours Smarts (23-32%); Marathon favours Stamina (~25%).
- Race model (box/games/ducks.js): one skill curve for every section, SKILL_SPEED = 1 + 0.3·lv^0.65
  (a skill at 0 is a real bottleneck, diminishing returns at the top); each section has its own
  mishap, rarer with the skill (trip/clip Run, gulp Swim, dip Fly, slip Climb, wrong turn Smarts;
  mishap = p / SKILL_SPEED²); Stamina is late-race fatigue in every race (depth from the same curve,
  never zero below level 25; Energy Bar = +3 levels, Iron Lungs 40% less, tactics and heat as
  before). Section variants (mud, sand, taffy…) no longer depend on Run. Section v0 values tuned so
  each section takes about the same time. Cliffs are two climbing walls (WALL: ducks climb at 28% of
  their pace on the wall, hand over hand), ledges between.
- Seasons: `planSeason()` deals every race (but the final) two featured skills from a deck holding
  every skill equally (Classic: no Smarts; Brainy: Smarts twice as often), so over 3/5/8/10 races
  each skill is featured within one of every other and never left out; the final uses everything.
  A featured skill gets 2 sections (3 on a Marathon); featured Stamina makes a long race where the
  ducks tire early (fatigue from 30%). Worlds are picked to suit the featured sections and never
  repeat within a season. The TV next-race card, the race-day hype and the phone race card show
  "Featuring 🪽 Fly · 🧗 Climb". Over a season a balanced duck beats a half-specialist 84-100% and
  a duck missing any one skill 85-100% (per race 62-100%).
- Seen in play: race commentary when a duck reaches the section of its weak skill ("Rex can't swim
  well and paddles slowly!"), gulps and dips; the phone's training page marks the weakest skill
  ("Your weakest skill: Fly (Lv 0)… train it!") and the results card says what slowed you down.
- Fair training: `node tools/ducks-minipay.js` models the six mini-games for three kinds of player.
  Bug Snack paid ~2.7× the others, Paddle Power least. Per-game XP rate PAY (hurdles 0.9, paddle
  1.25, rings 1.08, climb 0.87, bugs 0.4, maze 0.84) → struggling and casual players earn within
  ~1.2× across the six games. Risk it! goals re-tuned per game (paddle 0.7, climb 0.7, bugs 0.8 up
  to 50) so a casual player meets the goal 25-47% of the time in every game (model).
- Non-gamers: an XP floor (a full run with 3+ points earns at least 40 base XP); quiet adaptive help
  per player per game (a run under ~50 base XP adds a step, 80+ takes one away, up to 3: 8% slower
  each and wider windows / more fingertip slop; never announced, never in Risk it!); the first run
  of each game shows a 3-second animated fingertip "how to play" (the server says it is the first).
- New landscape pieces: broken bridges (meadow, forest, night, candy, haunted) and river gaps
  (beach, snow, swamp, jungle) to fly over, wind streaks on windy days; weak flyers dip and flap,
  strong ones glide high. Cliffs are climbed hand over hand up steep walls with holds, vines
  (forest, jungle), hay-bale stacks (meadow, haunted) or ladders (city walls, barns).
- Old saves: levels and XP unchanged (the XP table did not change); missing assist/runs fill in.
- Validation: test-box-ducks (37 tests, incl. season spread, season balance, per-game pay, floor,
  quiet help, weak moments), test-box-kit, test-box, e2e-box; headless TV/phone screenshots of the
  new walls, bridges, rivers, hints and the how-to hand checked. Limits: the mini-game pay and
  Risk it! odds come from a model of the games, not from real players.

## JustRaiseDucks: themed races (1-6 skills), combined sections, weather, the Golden Goose boss race (claude/ducks-themed-races, November 24, 2026)

- Owner asks: each area themed, a random number of skills per race depending on the area ("either a
  ton of different abilities used or just one") so people can catch up with what they trained,
  semi-random but fair over a season; areas that combine stats; random weather per race (it
  depends); an optional championship boss race set at the start.
- Worlds (`THEMES[k].skills` / `.counts` in box/games/ducks.js): each of the 14 worlds has skill
  weights from its scenery and odds for how many skills a race there features. Meadow Run+Swim(+Stamina),
  Beach Swim (Run, Stamina), Forest Climb+Run+Smarts, Frosty Peaks Climb+Stamina, Red Rock Canyon
  Fly+Climb, Firefly Night Swim+Fly+Smarts, Volcano Climb+Fly, Murky Swamp Swim+Smarts, City
  Rooftops Fly+Climb+Run, Lost Jungle Climb+Swim+Smarts, Dusty Desert Run+Stamina, Sky Islands Fly
  (often Fly only), Candy Land everything (often 5-6 skills), Haunted Farm Smarts+Run.
- `planSeason()` plans every race (world + featured skills) from the room seed: worlds never repeat;
  the count is drawn from the world's odds (overall ~17-21% single-skill races, ~70% 2-4 skills,
  ~6-10% 5-6 skills); skills are drawn by world weight × a lean toward the skills featured least so
  far (SEASON.lean); on 4+ races every skill is featured before the final; a plan where a skill gets
  over 1.9× (or under 0.45×) the average season share is re-planned (up to 40 tries). Shares count
  what the race really builds (`raceShares`: combined sections half to each skill, Stamina one share).
  Brainy: Smarts in every race; Classic: no Smarts. The final features everything.
- Courses are built only from the featured skills (a Fly-only race is all ravines). A single-skill
  race gets a banner ("🪽 Sky Dash: Fly only!", "💪 Long Trek: Stamina only!"); 5-6 skills
  "🌈 All-rounder course!". A Stamina-only race is a long trek on flat trail where everyone walks at
  one pace (TREK) and only fatigue differs. Featured Stamina: the ducks tire from 15% of the course.
- Combined sections (COMBO): waterfall (Climb+Swim), rapids with logs to hop (Swim+Run), rooftop maze
  you flap over (Smarts+Fly), flooded reed maze (Smarts+Swim), dunes uphill slog (Run+Stamina),
  floating rocks (Climb+Fly), broken bridge (Fly+Run), jungle gorge on the vines (Fly+Climb),
  rooftop walls (Run+Climb), foggy ravine / foggy pond (Fly+Smarts, Swim+Smarts). Used (75%) when the
  race features both skills, never in single-skill races. Speed = average of both skill speeds; the
  section's mishap uses the weaker skill. Each skill gives and gets about equally. The TV animates
  both actions (hops onto logs, splashes on the climbing duck, flapping over maze walls, wading,
  swinging on a vine, leaning into the dunes); the phone's course list marks them (🧗+🌊).
- Section lengths re-tuned so a level is worth the same on every kind of section in head-to-heads
  (track 38 m, pond 32 m, cliff v0 2.0).
- Weather (WEATHER, WEATHER_ODDS): clear, rain, wind, heat, fog, snow, storm, sandstorm, ash, picked
  per world (desert heat/sandstorms, almost no rain; Sky Islands windy; swamp foggy; peaks snowy;
  volcano heat/ash); the first race is clear; about 30% of races clear. Modest effects (≤6% speed per
  section kind, more trips/slips in rain, wrong turns in fog/sandstorm/ash, faster tiring in heat).
  Wind: a tailwind carries strong flyers further, a headwind slows weak flyers most. 12% of races the
  weather turns mid-race (a downpour, a blizzard, a sandstorm, or it clears) at a set point.
  The forecast with a tip ("🌧️ Rain expected: swimmers rejoice!…") is on the TV next-race card, the
  hype screen, the race intro and the phone; the TV draws rain, storms with lightning, snow, sand
  haze and streaks, falling ash, heat shimmer, gusts and fog, and says when the weather turns.
- Boss race (lobby setting "Championship boss race", off by default): the Golden Goose (a big golden
  crowned bird, drawn 1.5× size) races the Grand Championship at the best player duck's average level
  (BOSS). Big intro on the TV, taunts when it leads, a shout when a duck overtakes it. It scores no
  points and is never in the standings. If any player duck beats it: every player +50 coins, the
  ducks that beat it get the 👑 "Beat the Golden Goose" badge and trophy. Measured: a player duck beats
  it 33-47% (best duck uneven, typical) to 51-56% (even best duck plus two weaker ducks).
- Balance (`node tools/ducks-balance.js`, 200 races per row): one skill +4, default terrain:
  every skill 12-21% (max/min 1.4-1.8× per 200-race row, within 1.6× at 300 races in the test; Classic 14-28%, Brainy favours Smarts 32-44% since every Brainy race has a maze). Single-skill races: a
  specialist (half or all of 30 levels in that skill) beats three balanced level-5 ducks 100% of the
  time, every skill. Over a whole season a balanced duck still beats a half-specialist 74-98% of
  match-ups (Stamina half-in 65-79%); a duck missing one skill now mostly loses only the races that
  feature it (balanced duck 50-74% per season; no Stamina 99-100%).
- Validation: test-box-ducks (42 tests: season spread/shares/1-6 counts, single-skill races, world
  themes, combined sections, weather odds/determinism/effects/mid-race turn, boss off by default and
  on), test-box-kit, test-box, e2e-box (ports 3630/9630). Headless TV/phone screenshots of a Fly-only
  race, an all-rounder, a combined-section race in rain turning to storm, a Stamina trek in a
  heatwave and the boss final in a sandstorm. Limits: not yet played by real people; the boss odds
  and the weather effects are tuned in simulation.

## JustRaiseDucks: races are just the players; the Season Rules noticeboard (claude/ducks-settings, November 24, 2026)

- Wild ducks are now a lobby setting (`wild`, default Off; old settings without the key are Off).
  Off: a race is only the ducks of the people playing (2 players = a 2-duck race, points 10/8…).
  On: wild ducks fill every race to 6 as before (they score nothing).
- One player and no wild ducks: every race is a time trial. A hidden pace duck (as strong as a wild
  duck would be in that league) sets the par time; it is never drawn or listed. Beat par for gold,
  within 8% silver, within 16% bronze (PAR); the medal pays points/coins/trophies like 1st/2nd/3rd
  (no medal = 4th). The TV shows "TIME TRIAL" before the race, par commentary during it, a clock card
  on the results (time, par, medal); the phone shows its time vs par. The Golden Goose still joins the
  final when the boss setting is on (also against a lone player, who still races the clock).
- Settings screen: Ducks draws its own settings through a new optional hook in public/box/tv.js
  (`BOX.games.<key>.settingsTv(el, { fields, settings, partyMode, set, ui })`, live-lobby games
  only; other games keep the shared panel). The join card has a wooden "Season Rules" sign with a
  summary (about N minutes, races, wild ducks); it opens a farm noticeboard with four pinned notes
  (The season, Courses & weather, Who races, Farm life), chunky choice buttons, ON/OFF switches, and
  a plain line saying what each choice means. Mouse, keyboard (arrows, Enter, Tab, Esc) and phone
  width work. Party Mode's fit (races, timer, course, energy) is unchanged and shows a note on the board.
- Validation: test-box-ducks (46 tests, new: wild off by default incl. missing key, wild on fills to
  6, solo time trial medals/rewards/phone view, boss joins without wild ducks for 1 and 2 players),
  test-box (wild test now sets wild on), test-box-kit, test-box-party, e2e-box (ports 3640/9640:
  the board opens, arrows move, settings save on the server, Esc closes). Headless screenshots of
  the board at 1600x900 and 400 px, a 2-player race and results, a solo time trial.
  Limits: the par margins (8%/16%) are a first guess, not yet tuned with real players.

## TrashZombies: a phone-first zombie shooter (claude/trashzombies, November 24, 2026)

- New box game `trash` (TrashZombies; `zombie` is the separate story game). Original genre take on a
  top-down twin-stick arena shooter with waves and roguelite level-up choices; all art is drawn in
  code (public/box/games/trash-art.js), all names original.
- The PHONE is the whole game: a full-screen landscape canvas (public/box/games/trash-sim.js runs the
  area locally: zombies, bullets, XP gems, pickups, abilities). Touch: drag anywhere to move (a
  floating stick under the thumb), the fixed stick bottom-right aims and fires (pointer ids, so the
  two thumbs never mix); auto-aim (setting, on by default) shoots the nearest zombie while the aim
  stick is idle. Keyboard + mouse on a computer: WASD/arrows, mouse aim, hold left click (or Space)
  to fire, Esc/P pause, 1/2/3 cards, E grabs a pickup from further away; hints follow the device.
  The hero is the player's own JustGameBox character (BOX.drawChar, pre-rendered into walk/idle/
  hurt/dead frames; players with no saved look get the seeded made-up character), plus three trash
  gear slots (head, face, back) in public/shared/gear.js.
- A run: the garage intro (dark garage, the roll-up door rattles up, you walk out), then waves.
  Each wave has a kill target; zombies spawn from the edges up to a live cap (<= 90); types:
  Shambler, Sprinter (w2), Bloater that pops (w3), Can-Head (w4, tough), Spitter (w5), the Dumpster
  Brute boss every 5th wave. Clearing an area opens the exits; walking out an edge enters the next
  cell of a 9x9 town grid with a different look (12 looks from the seed, neighbours never match:
  junkyard, suburb, parking lot, gas station, dead mall, park, rooftops, sewer, carnival, school,
  docks, landfill; plus "Your Street" with the garage). Each area entered is the next wave (going
  back gives the same layout and a fresh wave). 23 abilities in Attack / Defense / Special, tiered;
  every level offers 3 cards, one per category when possible. 8 pickups. One extra life only through
  the Spare Lunchbox ability (no free revive). Death: stats + build + Play again (a new run).
- Server (box/games/trash.js): runs, cells, explored map, home cells, kill feed, standings; loose
  sanity checks on the 1 s status pings (kills per second, level vs kills, ability tiers <= level-1,
  health caps, waves need areas). Session length: endless (ends after everyone is down 45 s, or no
  phone connected for 3 min), first to wave 20, or 5-30 minutes. Party Mode: included with a fixed
  time (partyFit picks 5/10/15/20 min from the plan). No practice round (NO_PRACTICE). New module
  flag `dropIn: true`: room.busy() lets late phones join a running TrashZombies (own garage).
- Co-op: each player spawns in their own garage far apart; walking into a cell with another human
  joins that area. The first one there is the area host: their phone runs the zombies and sends
  ~15 snapshots/s through a new relay (socket 'player:live' -> game.live(p, msg) -> 'live' to the
  other phones; play.js ctx.live / G.live). Guests send position/aim, the hits their own bullets
  land, pickup grabs and nuke/freeze; everyone draws everyone's shots. XP shared in the area (or own
  kills only, setting). Level-up never pauses co-op: the chooser can't be hurt while choosing. The
  host walking out or dropping (2.5 s) hands the area to the next phone, which carries on from the
  last snapshot. Waves scale with the players in the area. Relay is rate limited (60/s/phone),
  size limited and only between members of the same area.
- TV: the lobby (garage door + house rules board), the town map (explored cells as thumbnails, fog,
  player faces with HP rings, danger pulse, co-op glow, garage-door animation when a run starts),
  side list + kill feed, results podium with builds. Sounds: garage roll-up (JustBid's CC0 clip),
  zombie groans / body fall (Zombie Survival's CC0 clips), synth stingers. Music: the CC0 zombie
  tracks already shipped (Zombies March, Night of the Streets, When the Shadows Gather, Sad Tune)
  mapped in public/audio/music/games/trash/music.json; synth fallback score in E-minor garage punk.
  Intro: narrator lines voiced (Orpheus, 10 clips). Hub: unlocked from the start (like Kill the
  King; it isn't an evolution of an existing game), action shelf, best 1-4.
- Validation: tools/test-box-trash.js (21 tests: area determinism + neighbour looks + clear lanes,
  offers, waves, spawn spread, drop-in, sanity checks, co-op join, relay routing/limits, host
  hand-off on leave and on drop, death/respawn/all-down end, results, timed/w20/partyFit, bots
  playing a whole night, and the phone simulation sandboxed: intro -> wave, exits shut until clear,
  auto-aim kills, cap, cards + pause + stacking, every pickup and its timer, lunchbox, co-op
  snapshot -> guest -> hits -> host, shared XP, pickup grab/give, guest takeover). test-box-kit,
  test-box-gear, test-practice, test-party-plan, test-voice-timing, e2e-box (new TrashZombies
  section: touch drag + aim stick with two touch points, cards, WASD + mouse + Esc + number keys,
  pickup, area change, TV map). Headless playthrough (844x390 touch phones, 1600x900 TV): garage
  intro, 100-zombie horde, cards, every pickup, new areas, boss, 3 players on the map, a 2-phone
  co-op area, death, results. Frame work time on the phone page ~1 ms average (2-4 ms max) with
  ~80 zombies on a desktop CPU; a mid phone is maybe 4-6x slower, still inside 16 ms; the page drops
  its resolution if frames get slow.
  Limits: not played on real phones yet; co-op tested with two headless phones on one machine (no
  real network latency); spit hits on guests are approximate; no friendly fire.
