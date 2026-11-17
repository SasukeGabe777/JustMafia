# JustKingdoms — design (v1)

The third big JustGameBox game (next to JustMafia and JustRaiseDucks). Everyone rules a kingdom on
one shared world map on the TV and plays from their phone: gather materials with peasants, build,
train better units, expand with new villages, then conquer, make peace, or launch a rocket.
Best with 5–10 players; must keep working up to 100. All art is drawn in code; all names original.

## 1. The table is the map (seating)
- In the lobby every phone shows a **round table** with one seat per player; you tap the seat where
  you are really sitting (relative to the TV). The TV shows the table filling up live.
- Kingdoms are placed around the world **in seating order**: the people beside you on the couch are
  your neighbours on the map. Neighbours are close (short marches, easy trade, easy alliances —
  or an easy stab in the back). People across the room are far away.
- If nobody picks seats, join order is used.

## 2. The world map
- A **hex map** (axial coordinates q, r; pointy-top). Size grows with players:
  radius R = clamp(round(2.2 + sqrt(N) * 1.6), 3, 12) → ~37 hexes for 2 players, ~127 for 9, ~470 for 100.
- **Home tiles** sit on a ring at radius round(R * 0.68), evenly spaced by seat order. Each home tile
  holds the player's **capital** (castle).
- **Terrain** (seeded): plains 🌾 (food), forest 🌲 (wood), hills ⛰️ (stone), gold vein ✨ (gold, rarer),
  lake 💧 (impassable), mountains 🏔️ (impassable). Every capital gets a fair start: its six neighbours
  include at least one plains, forest and hills tile and no impassable tile.
- The **Heartland** (the hexes within radius 1 of the centre) are rich tiles (×2 output) and hold the
  **Ancient Ruins** (bonus science) — a natural place to fight over.
- Tiles have: terrain, owner (player id or null), `village` level (0 = none, 1–3), `garrison` (units),
  `walls` (0–3, capitals and villages).

## 3. Economy (real time, server tick every 1 s)
- Resources: Food 🌾, Wood 🪵, Stone 🪨, Gold 🪙, Science 🔬.
- **Peasants** are your workers. You assign them on the phone to jobs: farm, chop, quarry, mine, study.
  Each worker on a job yields per second: `0.6 × (1 + 0.25 × matchingTilesOwned) × buildingBonus × techBonus`
  (study yields science 0.3/s each, needs a Library).
- **Population cap** = 5 + 4 × Houses level + 3 × villages owned; every unit (peasant or soldier) uses 1.
  Peasants eat: −0.1 food/s each; soldiers −0.2 food/s. Starving (food at 0): production −50%.
- Starting kingdom: capital (Castle Lv1), 1 Farm, 3 peasants (1 farmer to start the story, 2 idle),
  food 50, wood 50, stone 0, gold 0.

## 4. Ages (the "farmer to empire" climb)
Upgrading the **Castle** advances your age and unlocks things. Costs and build times:
(Costs below are the v1 numbers; the current costs and the time-limit pace are in §13b.)

| Age | Castle | Cost | Time | Unlocks |
|---|---|---|---|---|
| 1 Hamlet | Lv1 | — | — | Farm, Houses, Lumber Camp, Militia, Scout |
| 2 Village | Lv2 | 150🌾 150🪵 | 40 s | Quarry, Barracks (Spearmen), Walls, new villages (Settlers) |
| 3 Town | Lv3 | 300🌾 250🪵 200🪨 | 60 s | Mine, Archery Range, Market, Library, Watchtower |
| 4 City | Lv4 | 500🌾 400🪵 400🪨 300🪙 | 80 s | Stable (Knights), Workshop (Catapults), University |
| 5 Kingdom | Lv5 | 800 each + 300🔬 | 100 s | Royal Guard, Observatory, Launch Pad (science mode) |

## 5. Buildings (in your capital; each has levels 1–3, upgrade cost ×1.8 per level)
| Building | Age | Base cost | Effect |
|---|---|---|---|
| Farm | 1 | 40🪵 | +20% food per level |
| Houses | 1 | 50🪵 | +4 pop cap per level |
| Lumber Camp | 1 | 40🪵 | +20% wood per level |
| Quarry | 2 | 60🪵 | +20% stone per level |
| Barracks | 2 | 80🪵 40🪨 | trains Militia/Spearmen; −10% train time per level |
| Walls | 2 | 100🪨 | capital defence +25% per level (villages get their own walls) |
| Mine | 3 | 80🪵 80🪨 | +20% gold per level |
| Archery Range | 3 | 120🪵 | trains Archers |
| Market | 3 | 100🪵 50🪙 | trade resources with the market (rates 3:1 → 2:1 by level); send gifts |
| Library | 3 | 120🪵 60🪨 | unlocks "study" job; +20% science per level |
| Watchtower | 3 | 80🪨 | see armies marching at you earlier; +10% defence |
| Stable | 4 | 150🪵 100🪙 | trains Knights |
| Workshop | 4 | 200🪵 100🪨 | trains Catapults |
| University | 4 | 200🪨 150🪙 | +40% science per level, research faster |
| Observatory | 5 | 300🪨 200🪙 | science mode: unlocks Rocketry research |
| Launch Pad | 5 | 600🪨 400🪙 300🪵 | the rocket (see win modes) |
Only one building builds at a time per kingdom (a build queue of 3).

## 6. Units (rock–paper–scissors + siege)
| Unit | Age | Cost | Time | Atk | Def | Speed (s/hex) | Notes |
|---|---|---|---|---|---|---|---|
| Peasant | 1 | 30🌾 | 8 s | 1 | 1 | 6 | works; can't attack |
| Scout | 1 | 20🌾 20🪵 | 8 s | 0 | 1 | 2 | reveals a tile's garrison, never fights |
| Settlers | 2 | 80🌾 60🪵 | 15 s | 0 | 1 | 5 | founds a village on a free tile next to your land |
| Militia | 1 | 30🌾 15🪵 | 10 s | 3 | 3 | 5 | cheap defence |
| Spearman | 2 | 40🌾 25🪵 | 12 s | 4 | 6 | 5 | ×2 vs Knights |
| Archer | 3 | 35🌾 35🪵 10🪙 | 12 s | 6 | 3 | 5 | ×2 vs Spearmen |
| Knight | 4 | 60🌾 40🪙 | 16 s | 9 | 7 | 3 | ×2 vs Archers |
| Catapult | 4 | 120🪵 80🪨 | 25 s | 12 | 2 | 8 | ×3 vs walls; ignores 50% of wall bonus |
| Royal Guard | 5 | 80🌾 80🪙 | 20 s | 10 | 12 | 4 | elite |

## 7. Armies, villages and battles
- Units live in a tile's garrison (capital by default). An **army** is a group you send from one of your
  tiles to a target tile; it marches hex by hex (slowest unit's speed; roads through your own land
  are 25% faster). The TV shows the banner moving with the unit count.
- **Orders:** `move` (to your own tile), `claim` (Settlers to a free tile adjacent to your land → new
  village Lv1), `attack` (enemy tile), `reinforce` (an ally's tile), `scout`.
- **Battle** on arrival: each side's power = Σ (atk for attacker / def for defender) × counter
  bonuses × defender multiplier (walls, watchtower, capital +20%, hills +15%) × luck (0.9–1.1).
  Losses are proportional (loser loses 100% unless retreating at <30%; winner loses
  `loserPower/winnerPower × 70%`). Catapults reduce walls by 1 level on a win.
- **Capturing**: a village whose garrison is beaten changes owner (keeps its level −1). A capital that
  is beaten makes its owner a **vassal** of the attacker: they keep playing, keep their villages, but
  send 25% of production as tribute and can't attack their liege; they can **rebel** when their power
  passes their liege's capital defence (a phone button with a success roll).
- Villages: level 1–3 (upgrade with wood/stone); each adds pop cap and +1 production slot of its terrain.

## 8. Diplomacy (the table talk)
- From the phone: **propose alliance**, accept/decline, **leave alliance** (marked 🗡️ Traitor for 3
  minutes, visible on the TV), **send gift** (resources, via Market), **trade offer** (give X for Y),
  preset **messages** shown on the TV next to your castle ("🤝 Peace?", "⚔️ You're next", "🙏 Help!").
- Allies: can't attack each other, share vision, can reinforce each other, march 25% faster through
  each other's land. Alliance colours: a shared banner ring on the TV.
- Neighbours (by seat) start with a "Neighbour" relation: trading costs nothing extra; marches are short.

## 9. Ways to win (lobby setting "Win by")
- **⚔️ World Domination**: hold every remaining capital (directly or via vassals) — or the largest share
  of capitals when time runs out.
- **🕊️ World Diplomacy**: all non-vassal kingdoms in ONE alliance, and that alliance completes the
  **Peace Monument** together (each member contributes gold+stone; total scales with players). Everyone
  in it wins together. Anyone can break it by betraying (the monument loses 30%).
- **🚀 Science**: research up to Rocketry (Observatory → Rocketry tech), build the Launch Pad, then the
  rocket (3 stages, each a big cost and a 60 s build visible to everyone with a countdown on the TV).
  Enemies can attack your capital to destroy the current stage. Launch = win.
- **🌍 Anything goes** (default): first to any of the three.
- **Time limit** (setting 20/30/45/60 min): if nobody has won, the highest **Kingdom Score** wins
  (land, villages, buildings, army, science, wonders, gold).

## 10. Research (Library/University; costs science)
Three short tracks of 4 techs each: **Economy** (Better Plows +15% food, Saws +15% wood, Masonry
−15% stone costs, Banking +20% gold), **War** (Tactics +10% attack, Shields +10% defence,
Engineering +1 wall level cap, Logistics +25% march speed), **Science** (Writing +20% science,
Astronomy, Physics, Rocketry → enables Launch Pad). Each tech: cost 60/120/200/320🔬, 30–60 s.

## 11. Events (keeps 5–10 player games lively)
Every ~3 minutes a world event on the TV: Bountiful Harvest (+food), Plague (−peasants unless Library),
Bandits raid the weakest village (neutral army), Gold Rush (gold tiles ×2 for 60 s), Comet (science +).

## 12. Computer players (bots)
Simple personalities chosen at random: **Builder** (economy, ages fast), **Warlord** (army, attacks the
weakest neighbour), **Diplomat** (proposes alliances to neighbours, sends gifts), **Scholar** (science).
Every ~4 s a bot: rebalances workers to what it needs, queues the next building from its plan, trains
units to its target ratio, claims a free adjacent tile with Settlers when it can, and (Warlord, or anyone
attacked) attacks a reachable weaker tile. Bots accept alliances from neighbours often, strangers rarely.

## 13. Screens
- **TV (full screen like Duck Valley)**: the hex world map fills the screen — terrain drawn in code,
  each kingdom's land tinted in its colour with a border, castles that grow with the age, villages,
  marching army banners, battle bursts, alliance rings, vassal chains, message bubbles over castles,
  events banner, a small top bar (time left, win mode progress: capitals held / monument % / rocket %)
  and a scrolling news ticker. Lobby: the round table seat picker + QR/code card. Own title screen at
  `/kingdoms` with its own look (parchment, banners), like `/ducks`.
- **Phone**: tabs 🏰 Kingdom (resources, workers, build queue), ⚔️ Army (train, garrison, armies),
  🗺️ Map (your area of the map: tap a tile → actions), 🤝 Diplomacy (kingdoms list, alliances,
  gifts, trade, messages), 🔬 Research. Big buttons, clear costs (greyed if unaffordable, with what's
  missing), a notifications feed ("⚔️ Sam is marching on your village! 0:24").

## 13b. Upgrade v2: pacing, comebacks, table diplomacy, guidance (as built)
- **Pacing.** Base worker yield 0.45/s. Age costs: 2 = 160🌾 160🪵 (45 s); 3 = 450🌾 400🪵 250🪨 (75 s);
  4 = 900🌾 750🪵 650🪨 500🪙 (100 s); 5 = 1500🌾 1300🪵 1300🪨 1200🪙 500🔬 (120 s). Ages 3–5, the Launch Pad,
  rocket stages (cost and time) and the Peace Monument scale with the time limit (**pace**: 20 min ×0.55,
  30 ×1, 45 ×1.6, 60 ×2.2). Bot-only timeline, 8 kingdoms, 30 min (seeds 7/11/13): Age 2 ≈ 3.3 min,
  Age 3 first ≈ 6.5 (median ≈ 7), Age 4 first ≈ 12–13 (median ≈ 14–15), Age 5 first ≈ 18–21 (median ≈ 22–24),
  wins at 23–30 min (science or peace) or on time.
- **Royal Decrees** (a guided path for first-timers, 11 steps: put everyone to work → Houses → 6 peasants →
  Age 2 → a village → 6 soldiers → Age 3 → Library → a friend → Age 4 → pick a victory). One is active;
  finishing it pays a small reward at once. The phone's goal card shows it with a one-tap button.
- **Auto workers** (`jobs {auto:true}`): the steward spreads every peasant toward the next age with food covered.
  **Recall** brings every soldier on villages/land back to the capital.
- **Comebacks.** Underdog bonus: after minute 3, a kingdom below 75% of the leader's score produces up to
  +40% ((0.75 − ratio) × 0.8). The people rise: losing a village gives 2+age/2 free Militia at the capital,
  losing the capital 3+age (max 6 times a game). Rebels need only 75% of the liege's capital defence.
  **Coalition:** a kingdom holding ≥3 capitals and ≥30% of them (or, after minute 10, scoring ≥1.6× the
  runner-up) is marked 🎯: everyone else gets +20% attack against its land.
- **Royal Council** (≥3 kingdoms): at minute 7, then every 5.5 min, a 40 s vote on the phones, one vote each,
  not yourself, changeable. Motions alternate: 🏅 Royal Grant (winner gets (80+60×age) gold and stone;
  ties → the lowest score) and ⚖️ Sanctions (−30% production for 2 min; ties → the highest score). Bots vote
  for the leader / whoever hit them, and grant to friends or the weakest.
- **Bounties:** put ≥50 gold (escrowed) on a kingdom that isn't your ally; whoever takes one of its villages or
  its capital collects every bounty on it; unclaimed bounties return after 5 minutes. Shown on the TV.
- **Peace needs to hold:** contributing to the monument needs Age 4; need = 400 × max(4, kingdoms) × pace.
  When every free kingdom is in one alliance and the monument is complete, a 60 s countdown starts; anyone
  leaving the alliance breaks it. Bots won't join a bloc of over half the free kingdoms before 70% of the time.
- **Final 3 minutes** are announced on the TV and phones. New awards: 💰 Bounty Hunter, 🔥 Comeback Kid.
- **TV:** right-hand column with the live council vote, ⚔️ attacks on capitals/villages with countdowns, and
  🏆 the race (conquest / monument or peace countdown / best rocket / score); alliance threads and red war
  lines between capitals, 👑 over the score leader, 🎯 over a coalition target, 💰 bounty and ⚖️ sanction
  badges, avatars; ribbons for first-to-age, council results, coalitions, bounties, peace holds/breaks.
- **Phone:** updates in place with BOX.morph (the map canvas lives in a data-keep slot); council banner →
  two-tap vote; status tags (🔥 underdog, ⚖️ sanctioned, 🎯 coalition, 💰 bounty); 💰 Bounty sheet.
- `results()` returns player ids best-first (winners, then score) once the game is over.

## 14. State contract (server ↔ screens)
Server module `box/games/kingdoms.js`, key `kingdoms`, `liveLobby: true`, `standalone` on the client.
- `tv()` → `{ phase: 'lobby'|'play'|'over', seats: [{id,name,color,seat}], world: { R, tiles: [{q,r,t,o,v,w,g}] },
  kingdoms: [{id,name,color,home:{q,r},age,castle,score,ally,vassalOf,traitor,msg,alive,stage}],
  armies: [{id,o,from:{q,r},to:{q,r},n,kind,t0,t1}], battles: [{q,r,at,win}], events: {...},
  mode, progress: {domination, monument, rockets:[{id,stage,endsIn}]}, timeLeft, ticker: [...],
  winner: null|{mode, ids, names} }`
  (t terrain code, o owner id, v village level, w walls, g garrison size — exact composition hidden
  unless revealed by a scout; only counts are public).
- `view(p)` → the TV fields relevant to the player + private: `res`, `workers`, `pop`, `cap`,
  `buildings`, `queue`, `units` per tile, `myArmies`, `research`, `available` (what can be built/trained
  now with costs and missing amounts), `alerts`, `diplomacy` (offers in/out), `seat`.
- `act(p, msg)` ops: `seat {seat}`, `jobs {farm,chop,quarry,mine,study}`, `build {b}`, `train {u, n}`,
  `march {from, to, units:{u:n}, order}`, `claim {to}`, `research {tech}`, `age`, `ally {to}`,
  `allyAnswer {from, yes}`, `leaveAlly`, `gift {to, res}`, `trade {to, give, get}`, `tradeAnswer {...}`,
  `message {to?, preset}`, `rebel`, `rocket`, `monument {res}`, `market {give, get, n}`.
