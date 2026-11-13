# Your own music

Drop audio files (mp3, m4a, ogg, wav, flac) into these folders and the big screen mixes them
in with the game's own composed soundtrack: a composed track, then one of yours, then a
composed track, and so on, crossfading between them.

## Which folder?

**First pick the world**, then the moment:

- `All/` plays in **every** world.
- One folder per world plays only in that world:

  | Folder | World |
  |---|---|
  | `Small Town/` | Small Town (Mafia Town) |
  | `Medieval Village/` | Medieval Village (Oakhollow) |
  | `Space Station/` | Space Station |
  | `Fantasy Realm/` | Fantasy Realm |
  | `Dragon Peaks/` | Dragon Peaks |
  | `Dungeon Crawl/` | Dungeon Crawl |
  | `Secret Agents/` | Secret Agents |
  | `Federal Investigation/` | Federal Investigation |
  | `RSP Supply/` | RSP Supply |
  | `Snowy Village/` | Snowy Village |
  | `Block World/` | Block World |
  | `Tabletop Quest/` | Tabletop Quest |
  | `Realistic/` | Realistic |
  | `Noir/` | Noir |

**Then pick the moment.** Each folder above has the same ten moment folders:

| Moment folder | Plays during |
|---|---|
| `lobby/` | the lobby, before the game |
| `day/` | the day: morning and discussion |
| `night/` | the night |
| `dawn/` | dawn, when the night's events are revealed |
| `reveal/` | the role card reveal |
| `vote/` | accusations, defense and voting |
| `gallows/` | the execution scene |
| `murder/` | murder scenes |
| `ghosts/` | ghostly, eerie scenes |
| `victory/` | the end of the game |

Examples: `my-music/Noir/night/rainy-jazz.mp3` plays at night in Noir only.
`my-music/All/day/sunny-tune.mp3` plays during the day in every world.

## How your songs are made to fit

Each song's loudness is measured and matched to the game music, silence at the start and end
is trimmed, and it fades in and out over the composed music at the end of a section. The
narrator and sound effects duck it the same way. If a file can't be played, ⚙ Host controls
says which one.

## Choosing the mix

⚙ Host controls → Music mix: *Game + my music* (default), *Game music only* or
*My music only*. The panel also shows how many of your songs it found and which one is playing.

## Online (Render)

Songs here are committed and deploy with the repository. The repository and website are
public, so only add music you have the right to share (your own, or royalty-free with a license
that allows sharing the files). Keep files small (a 3-minute mp3 at 128–192 kbps is 3–4 MB).

After adding files, refresh the TV page (no server restart needed).
