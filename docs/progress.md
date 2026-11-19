# Profile progression: levels, challenges, the seasonal event and its season pass

Status: built on branch `claude/progress`. Code: `box/progress.js` (rules, server),
`public/shared/challenges.js` (definitions shared with the pages), `public/shared/seasons.js`
(the events, shared with the shop), `public/progress-ui.js` + `public/progress.css` (the view).
Tests: `tools/test-progress.js` (in `npm test`).

## Where it lives

On the **wallet** (the JustMafia `ProfileStore` entry, `profiles.js`) as `progress`, so a box
account, JustMafia's phone and the shop all see one level, one set of challenges and one pass.
Box players need a linked wallet (the phone links it the first time the profile sheet opens).

## XP

| Finished… | XP |
|---|---|
| a box game | 20, +8 top half, +15 winner (co-op games: +14 for everyone), × game length (0.6–2.5, a 12-minute game is ×1) |
| a JustMafia game | 40, +25 your side won, +10 survived, × the Judge's event (Blood Moon ×2, Daily Surprises ×1.5) |
| a whole Party Mode | 50, +30 / +20 / +10 for the top 3 |
| a challenge | its own XP (daily 60–120, weekly 200–350, event 400–600) |

Same anti-farming rules as JustGold: box games need 2+ people and 90 s (else "practice game",
no XP); JustMafia games use `rewardBlocker` (no bots, 3+ players, normal speed, 60 s+). Every
result counts once (`progress.seen`, the same ids as the JustGold payment).

## Levels

1..∞. XP from level L to L+1: `min(600, 100 + 20·(L−1))` (level 10 at 1,620 XP, 20 at 5,320, 50 at
22,900). Each level up pays `min(40, 5 + L)` JG; every 5th level an item (the first unowned of
`LEVEL_ITEMS`; 50 JG if you own them all); titles at 5 Rookie, 10 Regular, 20 Veteran, 30 Elite,
40 Champion, 50 Master, 75 Grandmaster, 100 Legend of the Box (worn from 🏆 My profile → Trophies).
Badge colour by band: Bronze 1+, Silver 10+, Gold 20+, Platinum 30+, Diamond 50+, Mythic 75+,
Legend 100+. The badge shows next to the name on the TV roster, the party board, the box phone
header and the profile; level ups get a TV toast ("LEVEL UP! Ana ★5") and phone toasts.

## Challenges

44 in the pool (27 kinds + a "game of the day" for 17 games). **3 a day** (easy, mid, game of the
day) and **5 a week** (2 easy, 2 mid, 1 hard), picked deterministically from the UTC day / ISO
week (`dailyIds(day)`, `weeklyIds(week)`: the same for everyone). A new day starts at 00:00 UTC,
a new week on Monday. JustMafia's old weekly challenges are in the pool (play / win / survive in
JustMafia, win as the Mafia, save someone, catch a Mafia member, use your ability). Box ones: finish
N games, play N different games, top 3, earn JG, card / guessing / bluffing / creative / team-up
games, win, Party Mode, Blackjack hands, a JustSnap cover, catching the JustUndercover mole,
surviving Zombie Survival. Games tell the room their own counts with an optional
`challengeEvents(playerId) -> { tag: n }` (blackjack: hands, snap: cover, undercover: mole).
Rewards: XP + JG (weekly and event ones also a Fate Token, as JustMafia's weekly ones did).
**One free reroll a day** (on a daily or weekly challenge that isn't done; same kind swapped in).

## The seasonal event and its season pass

The running event comes from `seasons.js currentSeason()` (dates, name, icon, theme colours).
It shows as a banner on the title screen, the TV lobby (games with the standard lobby), the box
phone's join screen, the profile view and the shop strip, with "Event ends in N days".
Each event has 2–3 **event challenges** (`EVENT_CHALLENGES` in challenges.js, keyed by season id;
unknown seasons get three generic ones).

**Season pass**: 25 tiers, 120 season XP each (season XP = all XP earned while the event runs).
Free track: JG every other tier (10–30) and on tiers 5/15, a "<Event> Hero" title at tier 25.
Premium track (195 JG, from the box profile or JustMafia's phone): JG on every tier (15–35) and the
event's limited items from `season.items` (filled by the shop), spread over the track with the
last one at tier 25. Until the shop fills them, the old Blood Moon pass items are used. Ids that
are not in the catalog / gear are skipped (that tier pays JG); an item you already own pays
25 JG. Buying late pays every tier already reached. A new event starts a fresh pass.

## Migration of JustMafia's old season pass and weekly challenges

On a wallet's first use: the old 's1' pass XP becomes profile XP (levels and their titles, no
back pay), and an **owned 's1' pass becomes a free premium pass** for the running event (or the
next one, if none is running: `progress.premiumCredit`). Items it granted stay owned. Old weekly
challenge progress is dropped (it was paid as it went). `progress.legacy` keeps a record.

## Sockets

Box (`/box`, every call with `auth`): `progress:get`, `progress:reroll { period, id }`,
`progress:premium` → `{ ok, progress, gold }`; `dev:progress { xp, gold }` with MT_DEV_GRANTS=1
(tests, screenshots). JustMafia: `profile:reroll { period, id }`, `profile:buyPass` (the premium
track); `profiles.view()` carries `progress` (left out of in-game updates). Room state:
`players[i].level`, `me.level`, `prog` (news for the phone), fx `level` and `challenge`.
