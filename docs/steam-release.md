# Releasing JustGameBox on Steam — owner checklist

This is the practical list of what has to happen before JustGameBox can be sold on Steam. The
code side (the desktop app in `desktop/`) is done enough to build and upload; most of what is left
is paperwork, store assets and decisions only the owners can make. Tick things off as you go.

Facts below about Steam's rules, prices and sizes were correct when written (late 2026); Valve
changes them now and then, so double-check anything marked *(check)* in the Steamworks docs
(partner.steamgames.com/doc) before relying on it.

---

## 0. Before anything else (blockers)

- [ ] **Ownership agreement between Justin and Gabe.** Both of you wrote this code. Before money
      comes in, put in writing (even a simple signed document): who owns the game and its code,
      how revenue and costs (the $100 fee, hosting) are split, who controls the Steamworks
      account and the bank account it pays into, what happens if one of you leaves, and who may
      relicense or sell it. Steam pays one legal entity (a person or a company); consider forming
      an LLC/company together so neither of you personally carries the other's share. Talk to a
      lawyer/accountant if the amounts could be significant.
- [ ] **Make the GitHub repository private.** It is public now: anyone can copy the whole game
      and sell or host it. (GitHub → Settings → General → Danger Zone → Change visibility.) Do it
      before the store page is announced. Note: the Render deploy keeps working with a private repo
      once Render is re-authorised for it.
- [ ] **Music in `my-music/` — licences.** The repo contains commercial-sounding tracks (e.g.
      "Venture Forth", "Shepherds of Haven", "Galactic Chronicles", "Dinosauria … Soundtrack",
      "The Hounds of Hübschdorf"). Unless you hold a licence that allows **redistribution inside a
      sold game**, they must not ship. The desktop build already **leaves them out** (only the
      folder layout + README ship; players can add their own songs via App settings → "Open my
      music folder"). They are also served publicly by the Render site and sit in a public repo
      today — remove them from the repo/site too unless licensed. To ship licensed songs later:
      `JGB_BUNDLE_MUSIC=1 npm run desktop:build`.
- [ ] **Decide on Tune Buzz** (see "Outstanding legal risks" below). You chose to keep it for now.

## 1. Steamworks partner account

- [ ] Sign up at **partner.steamgames.com** (Steamworks). You'll need:
  - legal name/entity, address, and a **bank account** for payouts;
  - **tax information** (the tax interview: US persons give an SSN/EIN on a W-9; others fill a
    W-8BEN / W-8BEN-E — this sets the US withholding rate);
  - identity verification (government ID) and a phone number.
- [ ] Pay the **Steam Direct fee: US $100 per game.** It is recouped (paid back in your payouts)
      once the game makes US $1,000 adjusted gross revenue. *(check)*
- [ ] After paying, Steam creates your **App ID** (a number). It appears in the Steamworks
      dashboard. **Nothing in this repo invents an App ID** — once you have it:
  - for local testing, put it in `desktop/steam_appid.txt` (one line, just the number), or set
    `STEAM_APP_ID`. In development (not packaged), the app otherwise uses 480 (Valve's public
    "Spacewar" test app); `JGB_STEAM=0` turns Steam off completely.
  - do **not** ship `steam_appid.txt` in the uploaded build: when Steam launches the game it
    provides the App ID itself.
- [ ] Note Valve's waiting period: there is a minimum time between paying the fee and being
      allowed to release (30 days at the time of writing *(check)*).

## 2. Store page

Fill in Steamworks → your app → Store page. Assets (PNG or JPG; sizes as Steam asks for them now
*(check — Valve raised several in 2024)*):

| Asset | Size (px) | Notes |
|---|---|---|
| Header capsule | 920 × 430 | Top of the store page, many lists. Logo must be readable. |
| Small capsule | 462 × 174 | Search results, lists — logo only, big. |
| Main capsule | 1232 × 706 | Front page / featured. |
| Vertical capsule | 748 × 896 | Seasonal sales, some layouts. |
| Screenshots | 1920 × 1080 (min 1280 × 720), 16:9 | **At least 5.** Real gameplay: TV + phones. No awards/marketing text. |
| Page background | 1438 × 810 | Optional. |
| Library capsule | 600 × 900 | The game in players' Steam library grid. |
| Library header | 920 × 430 | |
| Library hero | 3840 × 1240 | Wide banner art, **no logo/text** (the logo is layered on top). |
| Library logo | 1280 wide and/or 720 tall, transparent PNG | Placed over the hero. |
| Event cover / header | 800 × 450 / 1920 × 622 | For announcements and events. |
| Community icon | 184 × 184 | |
| Client icon / shortcut icon | .ico, 32×32 / 256×256 | Can come from `desktop/build/icon.png`. |
| Achievement icons | 256 × 256 (one unlocked + one locked/grey each) | Only if you add achievements. |

- [ ] **Trailer** (strongly recommended): MP4 (H.264), 1920 × 1080, 30/60 fps, high bitrate
      (5000+ kbps), 30–90 seconds; show phones in hand + the TV within the first 5 seconds. Steam
      transcodes it. Put the first trailer first — it autoplays.
- [ ] **Short description** (up to ~300 characters) and the long "About this game" text. Say
      clearly: *one copy on the PC/TV, everyone else plays with their phone's browser, no app
      install for players, same Wi-Fi (or Online mode).* Number of players, game list, languages
      (English only for now).
- [ ] **Tags**: e.g. Party, Party Game, Local Multiplayer, Social Deduction, Casual, Trivia,
      Drawing, Funny, Multiplayer, Family Friendly (if the rating allows), Card Game, Board Game.
- [ ] **Features/categories**: Shared/Split Screen PvP and Co-op (local), Online PvP only if you
      ship a hosted server, Remote Play Together only if tested (below), Steam Achievements / Cloud
      only once configured.
- [ ] **System requirements**: Windows 10/11 64-bit; any CPU/GPU from the last ~8 years; 4 GB
      RAM; ~400 MB disk; **a Wi-Fi/Ethernet network and smartphones with a web browser** for players.
- [ ] **Pricing**: pick the base USD price; Steam suggests regional prices (accept or edit).
      Party games of this kind usually sit at US $9.99–$29.99. You can't raise the price easily
      after launch discounts; launch discount max 40%, and price changes have cooldowns *(check)*.
- [ ] **Age rating — IARC questionnaire** (Steamworks → Store page → "Content Survey"/ratings).
      Answer honestly; things this game has: cartoon/text violence (Mafia murders, executions,
      Zombie Survival), **simulated gambling** (Blackjack Night, betting JustGold, JustBid, the
      afterlife wagers — no real money), user-generated text and drawings shown on screen, user
      photos (JustSnap), online interaction between players (phones), crude humour in some prompt
      packs (check Meme Maker / JustBlanks / Truths prompts). Also fill Steam's own **Mature
      Content** survey.
- [ ] **AI-generated content disclosure** (Content Survey → "AI Generated Content"). Steam requires
      describing both:
  - **Pre-generated** AI content: the narrator voice clips in `public/audio/voice/` are generated
    with the Kokoro-82M text-to-speech model (and any Chatterbox voices, if used); any music that
    was generated with AI tools; any AI-assisted art/text (the code was written with AI coding
    assistants — Valve currently asks about content, not code *(check)*). Say what guardrails
    you used (you reviewed every line/clip).
  - **Live-generated** AI content: the optional "Natural live voice" runs Kokoro in the player's
    browser and **reads text players typed (names, answers)** aloud. Steam requires describing
    guardrails against generating illegal/infringing content: e.g. it only speaks game text and
    player names, names are length-limited and filtered (add a profanity filter for spoken names
    if you don't have one), the feature is off by default. If you'd rather not deal with it,
    remove the live voice from the Steam build.
  - Steam shows your disclosure on the store page.
- [ ] Release date: set a "Coming Soon" date or "To be announced".

## 3. Legal texts

- [ ] **EULA**: Steam lets you use its standard Steam Subscriber Agreement only, or add your own
      EULA (shown on first launch by Steam). For a small team the default is usually fine; add a
      custom one if you want to limit liability for user content, online servers, etc.
- [ ] **Privacy policy** (needed because the game stores personal data): what is stored —
      profile names, **account names + passwords** (stored as scrypt hashes, never plain text),
      gold/items/stats; JustSnap **photos** (kept in memory for the game only, not saved to disk,
      not uploaded anywhere in local mode); in **Online mode** all of this lives on the hosted
      server you run, so you are the data controller (GDPR for EU players, COPPA if children
      under 13 can play — consider a 13+ age gate for accounts). Explain how to delete data (in
      local mode: the saves folder; online: contact you). Link it on the store page and in the
      app. Tune Buzz / Funny Videos contact Apple/Deezer/YouTube/TikTok/Instagram servers — say so.
- [ ] **Third-party licences**: `THIRD_PARTY_NOTICES.md` lists every bundled package, the fonts,
      Electron/Chromium and the AI models; it ships next to `JustGameBox.exe` and the build also
      carries each package's own LICENSE, the font licences (`public/fonts/licenses/`) and
      Electron's `LICENSE.electron.txt` / `LICENSES.chromium.html`. Regenerate it with
      `node tools/third-party-notices.js` after any dependency change. Summary:
  - express, socket.io, qrcode and their dependencies: MIT / ISC / BSD-3 (permissive).
  - Electron (MIT), Chromium (BSD + others), steamworks.js (MIT), Steamworks SDK redistributable
    `steam_api64.dll` (Valve's SDK agreement — fine for Steam partners).
  - Fonts, now **self-hosted** in `public/fonts/` (so the offline app works and no page loads
    Google Fonts): Fredoka, Pixelify Sans, Lilita One, Nunito, Bangers, Bungee, Bungee Shade,
    Caveat Brush, Monoton, Pacifico, Press Start 2P, Righteous, Rubik Mono One, Abril Fatface,
    Black Ops One, Cinzel, Cinzel Decorative, MedievalSharp, Anton — SIL Open Font License 1.1;
    Permanent Marker, Special Elite, Luckiest Guy — Apache 2.0. Both allow commercial use and
    bundling (OFL: don't sell the fonts on their own).
  - Kokoro-82M model: Apache 2.0 (commercial use OK; generated audio is yours). kokoro-js:
    Apache-2.0 according to its npm package (an older comment in tools/voice-gen.js says MIT).
  - Chatterbox (Resemble AI) is MIT, if any clips were made with it — record which.
  - Any AI music generator: check that tool's terms allow commercial use of its output (many
    free tiers don't). List it in the notices.

### Outstanding legal risks (owner decided to leave for now — listed so it's not forgotten)

- **Tune Buzz streams 30-second song previews from the iTunes Search API and Deezer.** Those
  previews are licensed for promoting the songs inside apps that link to the store, not for use as
  game content in a paid product. Apple's and Deezer's API terms may not allow it, and the rights
  holders could object. Options later: remove Tune Buzz from the Steam build, use licensed/royalty-
  free music, or get written permission. Also needs the internet.
- **`my-music/` songs** (see section 0).
- **Funny Videos** embeds YouTube/TikTok/Instagram players — allowed by their embed terms, but
  the content is third-party and unmoderated; needs the internet.

## 4. Steam features

- **Steam Cloud** (optional, recommended): Steamworks → Application → Steam Cloud → set a quota
  (e.g. 10 MB, 100 files) and **Auto-Cloud** root: `WinAppDataRoaming`, subdirectory
  `JustGameBox/saves`, pattern `*.json`. The app keeps saves exactly there
  (`%APPDATA%\JustGameBox\saves\profiles.json`, `box-profiles.json`). App settings stay local.
- **Achievements** (optional): create them in Steamworks (API name like `ACH_FIRST_PARTY`, names,
  icons), publish, then call `require('./achievements').unlock('ACH_FIRST_PARTY')` from game code.
  They belong to the **PC owner's Steam account** (the host), not to phone players — design them
  as host goals ("Host 10 parties", "Play all 30 games"). Nothing is wired yet; the plumbing
  (server → `desktop/main.js` → `desktop/steam.js`) is in place and safely does nothing without
  Steam.
- **Steam overlay**: works when Steam runs (Shift+Tab); can be turned off in App settings if it
  causes stutter (Electron needs the `in-process-gpu` workaround that steamworks.js applies).
- **Remote Play Together**: Steam streams the host's screen and input to remote friends. For
  JustGameBox that alone doesn't help — players use their own phones, not the host's controls —
  so remote friends should use **Online mode** (a hosted server) instead. RPT can still be used
  to *watch* the TV screen while joining by phone via Online mode. Don't tick "Remote Play
  Together" unless you test that it's useful.
- **Steam Deck / controllers**: the Windows build runs on Deck through Proton (untested so far —
  test the LAN server and phone joining on a Deck before claiming support). The title screen needs
  a mouse or the touchscreen; there is no gamepad navigation yet, so rate it "Unknown" or add a
  Steam Input mouse/trackpad configuration first. Deck Verified needs controller-only navigation
  and legible text at 1280×800.
- **DRM**: none (the game runs fine copied without Steam). `steamworks.js` offers
  `restartAppIfNecessary` if you ever want the exe to relaunch through Steam; not enabled.

## 5. Building and uploading the game (SteamPipe)

### Build

1. Install **Node.js 22.12+** (Electron 45's installer needs it; the server itself still runs on
   Node 20) and Git.
2. From the repo root: `npm ci`, then `npm run desktop:build`.
   (First time: `desktop/` installs Electron, electron-builder and steamworks.js by itself.)
3. Result: **`desktop/dist/win-unpacked/`** — `JustGameBox.exe`, `resources/server/` (the game
   server, with only git-tracked files and production dependencies), notices. This folder is
   what you upload. (Never commit it; `.gitignore` covers it.)
4. Test it: `node tools/e2e-desktop.js` (runs the built exe hidden + a headless phone and checks
   local mode, LAN joining, online mode and fallback). Then try it for real on a TV with phones.

### Upload with SteamCMD

1. Download the **Steamworks SDK** from the partner site; use `sdk/tools/ContentBuilder/`.
2. In Steamworks → your app → SteamPipe → Depots, note the **depot ID** (usually App ID + 1).
3. Create `ContentBuilder/scripts/app_build_<APPID>.vdf` (replace the numbers with yours):

```vdf
"AppBuild"
{
  "AppID"       "<APPID>"
  "Desc"        "JustGameBox 0.1.0"
  "BuildOutput" "..\output\"
  "ContentRoot" "C:\path\to\JustMafia\desktop\dist\win-unpacked\"
  "SetLive"     ""        // leave empty; set the branch live by hand in Steamworks
  "Depots"
  {
    "<DEPOTID>"
    {
      "FileMapping"
      {
        "LocalPath" "*"
        "DepotPath" "."
        "recursive" "1"
      }
      "FileExclusion" "*.pdb"
      "FileExclusion" "steam_appid.txt"
    }
  }
}
```

4. Upload (Steam Guard will ask for a code the first time):

```bat
cd sdk\tools\ContentBuilder
builder\steamcmd.exe +login <your_steam_build_account> +run_app_build ..\scripts\app_build_<APPID>.vdf +quit
```

   Use a separate Steam account for builds with only the "edit app metadata / publish" rights it
   needs.
5. Steamworks → SteamPipe → Builds: set the new build live on a **beta branch** first (e.g.
   `testing`, password protected), install it through Steam on a clean PC and test, then set it
   live on `default`.
6. Steamworks → Installation → **General / Launch options**: executable `JustGameBox.exe`,
   operating system Windows, 64-bit. No installer or redistributables are needed (Electron ships
   everything). Publish the changes (Publish tab).

## 6. Review and release timing

- [ ] The **store page** must be submitted for review and then be visible as **"Coming Soon" for at
      least 2 weeks** before release. Start collecting wishlists early.
- [ ] The **build** is also reviewed (Valve launches it and checks it matches the store page).
      Each review takes about **3–5 business days**; plan for a round of fixes.
- [ ] Release checklist in Steamworks turns green → press Release (or schedule it).
- [ ] After launch: watch the forum/reviews; ship fixes by uploading new builds the same way.

## 7. What the app does (for the store text and support answers)

- **Local mode (default)**: the PC runs the game server; the TV window shows the title screen;
  phones on the same Wi-Fi join by QR (`http://<PC's LAN IP>:47800/j/CODE`). No internet needed
  (except Tune Buzz, Funny Videos and the optional live voice).
- **Windows Firewall**: the first launch makes Windows ask whether JustGameBox may use the network
  — players must allow **Private networks**. App settings → "Phones can't join?" explains this and
  opens the firewall page; the app never changes the firewall itself.
- **Online mode**: App settings (F10 or ⚙ → App settings) → Online server → enter the address of
  a hosted JustGameBox server (the same `server.js`, e.g. on Render; set `PUBLIC_URL` there if the
  host isn't Render). Remote friends join with that address. If it can't be reached the app plays
  locally and says so. **You would need to run that server** (cost, uptime, privacy) if you
  advertise online play; none is configured by default.
- Saves: `%APPDATA%\JustGameBox\saves` (survive updates and uninstall/reinstall; Steam Cloud can
  sync them). Logs: `%APPDATA%\JustGameBox\logs\app.log`.
- Keys: F11 / Alt+Enter fullscreen, F10 / Ctrl+, App settings, Alt+F4 quit.
