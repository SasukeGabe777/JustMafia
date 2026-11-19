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
  bots get a generated character). Players without a saved look keep their emoji. JustMafia still
  draws its town with the pixel `character-art.js` (moving it to drawSmooth is the next step;
  drawSmooth already takes JustMafia's options: lean, arms, dragged, dead, scared, theme…).
- **One shop** at `/shop` (phone page): character items, flair, gear for each game, JustMafia items.
  Reachable from the box phone (join screen, lobby, between games), the main menu's phone link,
  and the JustMafia lobby. Not during a running game.
- **JustMafia keeps** its season pass, Fate tokens, worlds and achievements on its own phone screen
  ("Season & unlocks"): nothing to buy there except the pass and Fate (game mechanics).

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

| event | in | out |
|---|---|---|
| `account:status` | `{ auth, mafia? }` | `{ ok, account, saved, name, gold, games }` (no account yet: the gold of `mafia`) |
| `profile:claim` | `{ auth, name, password }` (`pin` still accepted) | `{ ok, error?, profile }`; once saved, only `profile:password` changes it |
| `profile:login` | `{ name, password }` | `{ ok, id, token, profile }`: a new device token; then `account:wallet` gives this phone the wallet |
| `profile:password` | `{ auth, old, password }` | `{ ok, error? }` |
| `profile:logout` | `{ auth }` | `{ ok }`: this phone's token stops working (refused while not saved) |

