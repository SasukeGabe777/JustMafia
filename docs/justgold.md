# JustGold: one account, one character, one shop, every game

Status: built on branch `claude/justgold`. The state before it is tagged `pre-justgold`
(revert with `git revert -m 1 <merge commit>` or reset a branch to the tag).

## The idea

- **One account.** The JustGameBox profile (name + password, many devices; `box/profiles.js`) is the
  account. It links to one **wallet**: the JustMafia profile (`profiles.js`, `.data/profiles.json`),
  which already has the gold ledger, the owned items and the character look. Existing JustMafia gold
  and items carry over (the phone's `mt.profile` is linked the first time).
- **JustGold (JG)** is the one currency. It is the old JustMafia gold (`coins`, `ledger`), renamed in
  every UI. Earned in JustMafia (unchanged rules) and now in every box game and Party Mode.
- **One character.** The look (`OPTIONS.AVATAR_FIELDS`: body type, hair, outfit, hat, colours…) is the
  same character in the shop and in every box game: the smooth character `MTArt.drawCharacter`
  (`drawSmooth` in `public/avatar.js`). Body type (`body`: female | male, free) changes the build,
  jaw, brows, lashes and lips; old looks without it are inferred (long hair or a dress → female).
  In the games, players' emoji are replaced by their character (`BOX.face` / `BOX.body` /
  `BOX.drawChar` in `public/box/portrait.js`; the room roster carries every player's look and gear;
  bots get a generated character). Players without a saved look keep their emoji. JustMafia draws
  the same character everywhere (town, cutscenes, phone, Judge), with its scene options: lean, arms,
  dragged, dead, scared, theme…; the classic ghost is the character, see-through.
- **One shop** at `/shop` (phone page): Character, Flair, **Games** (JustMafia first, then every box game), Wardrobe, Earn JG.
  `/shop?game=<key>` opens that game's section; JustMafia's links and each box game's join screen / lobby use it.
  Object gear (paddles, card backs, chips, buzzers, banners, frames, easels, podiums, crests, pen sets) is drawn as the object itself (shop.js `drawObject`); balls stay balls.
  Reachable from the box phone (join screen, lobby, between games), the main menu's phone link,
  and the JustMafia lobby. Not during a running game.
- **JustMafia keeps** Fate tokens, worlds and achievements on its own phone screen ("Season & unlocks").
  Its old season pass and weekly challenges became the box-wide **profile progression** (level, daily /
  weekly / event challenges, the seasonal event's season pass): see `docs/progress.md`. That screen's
  ⭐ Progress tab shows it, and the premium pass can be bought there or from the box profile.

## Data

Wallet (JustMafia `ProfileStore` entry), new fields:
- `verifiers: []` (several devices; the old single `verifier` still works) and `addDevice(id) → token`.
- `gear: { <gameKey>: itemId }` (what is equipped for each game).
- `boxGames: [gameId…]` (last 200 box results paid, so nothing pays twice).

Account (`box/profiles.js`): `wallet: <wallet id>`.

Room players (`BoxRoom` player object) get, from the linked wallet when they join:
- `look`: the validated avatar object (null without an account; then the emoji is used).
- `gear`: `{ <gameKey>: value }` for the games that use gear.
Both are in `tvState().players[i]` and `playerState().me`, and games may read `p.look` / `p.gear`.

## Catalog

`public/shared/cosmetics.js` CATALOG (JustMafia items) is grouped for the shop:
- **Character** (every game): outfit, shoeStyle, hat, accessory, hair. Free colours: skin, hairColor,
  color, eyes, face, facialHair, expression, pants, shoes, nameColor, features.
- **Flair** (every game): nameplate, effect.
- **JustMafia only**: houseStyle, houseDecor, deathAnim, reactions, ghostSkin.

`public/shared/gear.js` (shared by server and pages) `GEAR`: per-game items
`{ id: 'gear:<game>:<name>', game, slot, spot, name, value, cost, desc, paint }`. The free default is implied.
Every game has **wearables** (`spot`: head, face, hand, chest or back): things your character wears in
that game (cowboy hats in Quick Draw, a dealer visor at Blackjack, a hockey mask in Zombie Survival, a
chef's hat for pizza…), drawn on the character by `public/wear-art.js` (`paint.shape`); a worn spot
replaces your own hat/extra in that game only. A few games keep an object slot too (marble skin, drop
ball, card back, chips, paddle, buzzer, pen set, banner, meme frame, gallery frame, podium light, crest).
The old phone-theme slots are gone; their ids no longer exist and are ignored (gearValues skips unknown ids).

## Earning JustGold

Box games pay at the end of a game (`BoxRoom` scoring → `wallet.awardBox()`), to humans with an
account who played it, when the room had at least 2 humans and the game ran at least 90 s. Amount =
`GOLD[game]` by place: `{ play, top, win }` (top = top half). Longer games pay more. Party Mode pays a
finale bonus to everyone who played the party (`partyFinished`): the easiest way to get JG.
JustMafia keeps its own rules (`REWARDS`, capped at 30 a game). Everything goes through `record()`
(the ledger), so the pouch shows where every coin came from.

## Socket API (`/box` namespace; every call carries `auth = { id, token }` of the account)

| event | in | out |
|---|---|---|
| `account:wallet` | `{ auth, mafia }` (`mafia` = the phone's `mt.profile`, optional) | `{ ok, wallet: { id, token } }`: link (or create) the wallet; the phone stores it as `mt.profile` |
| `shop:state` | `{ auth }` | `{ ok, gold, look, owned, gear, catalog, gearCatalog, ledger, earn, busy }` |
| `shop:buy` | `{ auth, itemId }` | `{ ok, error?, state }` |
| `shop:equip` | `{ auth, itemId, on }` | `{ ok, error?, state }` (character items, flair, gear, JustMafia items) |
| `shop:look` | `{ auth, look }` | `{ ok, state }` (free colours and owned items; validated) |

`busy` is true while the account is in a running game (box or JustMafia): buying and equipping wait
until the lobby or the end of the game.

### Save your stuff (name + password)

The account starts as a guest on one phone. **Save your stuff** (`public/account-ui.js`, one panel
shared by the box phone, the shop and JustMafia's phone) saves it under a name + password, so the
same JustGold, character, items and stats can be used on any phone. Passwords: any characters,
4–64, scrypt + salt (`box/profiles.js`). Old 4–6 digit PINs are numeric passwords and still sign in
(old saves keep the hash under `pin`; it is moved to `password` on load). Wrong guesses (sign in or
change password) lock that name for a minute after 5 tries.

Where: the box phone join screen ("Sign in" link / "Save your stuff" card) and a one-time reminder
after a game, the 🏆 My profile sheet ("💾 Save" tab), the shop (banner over the character; "Sign in"
on the start screen), JustMafia's phone (join screen, character creator, lobby).

When: never before the player has finished a game (games on the account, JustGold, or this phone's
`jg.played` flag, set when a real game ends; a practice round doesn't count). Until then every banner
is just "Played before? Sign in". The first finished game brings it up on the game-over screen:
"You earned 15 JG! Save it with a name + password" (`acct.nudge(el, { earned })`).

| event | in | out |
|---|---|---|
| `account:status` | `{ auth, mafia? }` | `{ ok, account, saved, name, gold, games }` (no account yet: the gold of `mafia`) |
| `profile:claim` | `{ auth, name, password }` (`pin` still accepted) | `{ ok, error?, profile }`; once saved, only `profile:password` changes it |
| `profile:login` | `{ name, password }` | `{ ok, id, token, profile }`: a new device token; then `account:wallet` gives this phone the wallet |
| `profile:password` | `{ auth, old, password }` | `{ ok, error? }` |
| `profile:logout` | `{ auth }` | `{ ok }`: this phone's token stops working (refused while not saved) |

## Seasons, deals and sets (branch `claude/shop-season`)

Rules live in `public/shared/shop-season.js` (shared by the server and the shop page) and are
enforced by the server (`profiles.js` `buy` / `buyGear` / `buySet` / `wearSet`, `box/gold.js`). The
store's clock is `ProfileStore.now()` (`setClock(fn)` in tests).

**Limited-time event items.** Each event in `public/shared/seasons.js` (Harvest Fest, Frostival,
Sweetheart Week, Spring Bloom, Summer Splash, Spooky Season) has a `kind` and 7–9 new character items
(`seasons.js ITEMS[kind]`: hats, outfits, extras, shoes, effects, nameplates; 48 in all). They can be
bought only while an event of that kind runs; the server refuses them otherwise ("Limited: sold
during Frostival (back 1 Dec)"). Owned items stay owned and wearable. The same ids come back every
year: `harvest-2027` and `frost-2027` are already listed with the same items.

**New items are not on the shelf.** Event items and the new theme-set pieces are listed in
`options.js OPTIONS.SPECIAL` and marked `special` in the catalog, so `STOCKABLE` / `nextStock` (the
play-to-reveal shelf) are unchanged for every existing and new profile.

**Daily deals.** `dailyDeals(now)`: 6 items picked by the UTC date (the same for everyone; 4 character
/ flair / JustMafia items and 2 game-gear items from everyday gold items), the first two 20–30% off.
New deals at UTC midnight. The deal price is what `buy` / `buyGear` charge that day (ledger: "Bought X
(deal −25%)"). A deal can be bought that day even if it is not on your own shelf yet; your shelf and
what you own do not change. **Weekly spotlight**: one theme set a week (from Monday 00:00 UTC), its
bundle 35% off instead of 20%.

**Theme sets** (`SETS`): 10 outfits for game worlds, 3–4 pieces each, one per look field, so the whole
set can be worn at once, and every piece works in every game:

| set | game | pieces (new ones in bold) |
|---|---|---|
| 🤠 Wild West | Quick Draw | Cowboy hat, Sheriff, **Lasso**, **Spur Boots** |
| 🕵️ Secret Agent | JustUndercover | **Agent Trilby**, **Agent Suit**, **Night-Vision Shades**, Shadow Aura |
| 👨‍🍳 Head Chef | Pizza (also `yeschef`) | Chef hat, **Chef's Whites**, **Wooden Spoon** |
| 🔍 Great Detective | JustEscape | **Deerstalker**, **Inverness Coat**, **Magnifying Glass**, Leather Boots |
| 🎰 High Stakes | Blackjack | **Dealer's Vest**, **Fan of Aces**, **Lucky Dice**, Noble Shoes |
| 👑 Royal Court | President | Crown, Royal Robe, Royal Cape, Sparkles |
| 🧟 Last Survivor | Zombie Survival | Bandana, **Survivor Gear**, Backpack, Tall Boots |
| 🛸 Space Cadet | Alien Abduction | **Saucer Hat**, Cyber Suit, **Ray Gun**, **Orbiting Planets** |
| 📸 Paparazzi | JustSnap | Beret, **Photographer's Vest**, **Camera** |
| 🏴‍☠️ Pirate Crew | JustBid | Pirate hat, Pirate Coat, Eyepatch |

Every set piece can be bought on its own from the Sets shelf (even before the shelf reveal), or the
pieces you're missing together as a **bundle** for 20% off (one ledger line). **Set bonus**: wearing
the whole set (your saved look) in that set's own game adds +5% to what the game pays you (at least 1,
at most 3 JG), once per payout (`box/gold.js withSetBonus`, used by `BoxRoom.payGold`; the ledger
says "· 🤠 set +1" and the phone toast shows it). In the shop your nameplate lights up with the set's
icon. Party Mode finales and JustMafia rewards are not changed.

**Shop page.** Tabs: the running event first (in its colours, with LIMITED · N days left), Deals
(countdown to the next swap, the spotlight set), Character, Flair, Games, **Sets** (progress, try-on of
the whole set, bundle price, bonus), Wardrobe, Earn JG. Cards show ⏳ / −% / set ribbons.
`/shop?mock=1` computes all of it offline; `&now=2027-02-10` previews another day, `&tab=sets` opens a tab.

| event | in | out |
|---|---|---|
| `shop:state` | (as above) | also `event`, `nextEvent`, `deals { day, endsAt, items[{id,pct,price}], spotlight }`, `sets[{ id, name, icon, game, items, have, total, worn, spotlight, bundle{missing,full,pct,price} }]`, `setRules`, `now`; catalog/gear items carry `price` (today), `pct`, `limited`, `set` |
| `shop:bundle` | `{ auth, setId, wear }` | `{ ok, error?, state }`: buys the missing pieces at the bundle price (`wear`: puts the set on) |
| `shop:wearSet` | `{ auth, setId }` | `{ ok, error?, state }`: wear an owned set |
