# Mafia Town: expansion plan

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
served by the game. Original art is drawn in `character-art.js` and `world-art.js`.

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

### Development update 5: RSP Supply theme

- A new selectable theme `rsp` ("RSP Supply", town "Supplyville"). It's a
  lighthearted corporate-takeover parody in which the Mafia team is RSP
  Supply, led by President Tom Smith. Yellow and blue throughout.
- Everything lives in the theme registry (`public/shared/themes.js`), with new
  optional, documented fields any theme can use: `roleNames`, `teamNames`,
  `villain` {name, title, avatar}, `ui` colors, `narration` (overrides lines
  for every narrator style), `effects.confetti`, `civic`, `houseTrim`.
  Helpers `roleName()` / `teamName()` fall back to the normal names, so other
  themes are unchanged. Rules never read any of this.
- Applied to: menus (phone/TV/Judge CSS variables via `<html data-theme>`,
  set from game state), clothing (company lanyard + ID badge), buildings and
  houses (yellow walls, blue roofs, a company plaque over every door; RSP HQ,
  Break Room, Water Cooler, Warehouse, Loading Dock, "Former Employees"
  cemetery), cinematics (navy-suited associates with an office stapler, a
  blue office bedroom, yellow/blue confetti), the town introduction (Tom
  Smith appears in a spotlight: "President of RSP Supply has big plans for
  Supplyville"), text (role card, teammates, composition, game-over and
  victory title use themed names), and narration (takeover lines, themed
  location lore).
- Engine improvements that came with it: the cinema spotlight now works on
  the town stage (it previously never received a position), titles can have
  a readability band, scenes can show a theme villain, and cinema kits are
  per theme (`KITS.rsp`).
- Validation: expansion test covering the theme being selectable, yellow
  walls / blue roofs, villain and themed names, an RSP game narrating the
  takeover and "member of RSP Supply", a medieval game never mentioning RSP,
  the theme locking at start, and every renamed role id existing. The render
  sweep now includes RSP for every scene (1476 runs). The e2e test checks the
  phone menus switching to RSP colors live and back. I reviewed screenshots
  of the town, the Tom Smith intro, and the phone and TV menus.
- Note: the repository is public, so the theme's names are visible there.

### Development update 6: shop, gold pouch and inventory

- Gold: the existing server-side coins are now "gold". `ProfileStore` tracks
  balance (`coins`), lifetime `goldEarned` / `goldSpent` and a 20-entry
  `ledger`, all recorded through one `record()` path. Older profiles are
  migrated on load (balance counted as earned). Purchases are validated on
  the server, and an unaffordable or duplicate purchase changes nothing.
- Catalog (`public/shared/cosmetics.js`): items now carry a category,
  description and optional price override, and the file documents how to add
  items. New premium house designs: Dark Mansion, Modern House and RSP
  Supply Office, with new art and a flat-roof variant in `world-art.js`.
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

## Balance notes from the first simulation runs

These come from 300 games per preset with the built-in bots, so they're only a guide.

- **Classic at 7 players:** about 85% Mafia wins. Two Mafia out of seven is harsh. Consider 1 Mafia below 8 players, or adding a Doctor.
- **Chaos:** the Serial Killer wins about 30–40% of games. Night immunity plus a kill every night is strong. Options: let the Vigilante bypass immunity, or require 12+ players.
- **Big Party at 60–100 players:** the town wins about 90% of games. Two Detectives plus a Sheriff find the Mafia too fast. Options: drop to one investigator, or raise the automatic Mafia ratio for big games.
