# JustKingdoms — server ↔ screens API (as built)

Engine: box/games/kingdoms.js (+ kingdoms-data.js, kingdoms-map.js, kingdoms-ai.js). Key `kingdoms`,
`liveLobby: true`. One 1 s tick; bots act every 4 s. Design: docs/justkingdoms.md (deviations are in the
comment block at the top of kingdoms.js — notably a 5-minute beginner's peace for capitals, `peaceIn`).
To get real states for screen work: build a BoxRoom with a VirtualClock (see tools/test-box-kingdoms.js),
add bots, start, advance the clock, then call `room.tvState()` / `room.playerState(p)`.

## tv()
```
{ phase:'lobby'|'play'|'over', now /*game ms; compare with army t0/t1*/, seats:[{id,name,color,seat}] /*seat null = unpicked*/, tableSize,
  world:{ R, tiles:[{q,r,t,o,v,w,g, c?, x?}] }   // t: p plains f forest h hills g gold l lake m mountain r ruins; o owner|null;
                                                 // v village 0-3; w walls; g garrison count; c = capital's owner (capitals only); x:1 rich heartland
  kingdoms:[{id,name,owner,color,seat,home:{q,r},age,castle,score,ally /*'A3'|null*/,vassalOf,traitor,traitorIn,
             msg:{key,text,to,endsIn}|null,alive,gone,bot,stage /*rocket stages done 0-3*/,building,land,villages,army,capitals}],
  armies:[{id,o /*null = bandits*/,from:{q,r},to:{q,r},n,kind /*most common unit or 'bandits'*/,order,t0,t1,path:[q0,r0,q1,r1,…]}],
  battles:[{q,r,at,win /*winner id|'bandits'|null*/,a,d}]   // last ~8 s
  alliances:[{id,members:[ids],monument}],
  events:{current:{kind,name,icon,text,endsIn}|null, nextIn, on},
  mode, speed, timeLimit, timeLeft, peaceIn,
  progress:{domination /*0-1*/,leader,capitals,of,monument /*0-1*/,monumentBy,monumentNeed,rockets:[{id,stage,building,endsIn}]},
  ticker:[{id,text,kind /*info|build|war|diplo|event|win*/}] /*last 14*/,
  winner:null|{mode:'conquest'|'diplomacy'|'science'|'score',ids,names,reason:'win'|'time'},
  standings:null|[{rank,id,name,owner,color,score,age,land,villages,capitals,vassalOf,stage}], awards:null|[{title,id,name,value}] }
```
In the lobby `world` is `{R:0,tiles:[]}` and `kingdoms` is empty. Army position: interpolate along `path`
with `(now - t0) / (t1 - t0)`; the client should advance `now` locally between updates.

## view(p) (phone)
Always: `phase, now, seats, tableSize, seat, kingdomName, mode, speed, timeLimit, timeLeft, peaceIn, winner,
standings, awards, presets {key:text}, defs` (defs = names/icons for res, terrain, units (atk/def/speed/vs),
buildings, ages, jobs, events). In the lobby only these (+ seat, kingdomName).
In play/over:
- `world {R, tiles}` — whole map if R ≤ 8, else tiles within 4 hexes of your land; plus `u {unit:n}` on your/allied/scouted tiles (`seen` ms).
- `kingdoms` (TV fields + `rel`: self|ally|liege|vassal|neighbour|other, `dist`), `events`, `progress`, `ticker` (last 6), `spectator`.
- `armies`: yours, your allies', and those heading for your tiles.
- Private: `me`, `res {food,wood,stone,gold,sci}`, `rates` (net/s), `starving`, `workers {farm,chop,quarry,mine,study,idle}`,
  `peasants`, `jobsOpen`, `perWorker`, `pop`, `cap`, `upkeep`, `buildings {…levels, castle}`,
  `queue [{b,lvl,name,dur,endsIn}]`, `training [{u,n,name,dur,endsIn}]`, `units [{q,r,capital,v,units}]`,
  `myArmies [army + units, endsIn]`, `incoming [{id,o,name,to,n,endsIn,capital}]`,
  `research {done, current {tech,name,dur,endsIn}|null, techs:[{key,name,icon,about,track,tier,cost,time,done,can,why,missing}]}`,
  `available {age:{next,name,icon,cost,time,can,why,missing}|null, buildings:[{b,name,icon,about,age,lvl,max,cost,time,can,why,missing}],
  units:[{u,name,icon,age,atk,def,speed,cost,time,can,why,missing}]}`, `alerts [{id,text,kind:'good'|'bad'|'diplo'|'info',ago}]`,
  `diplomacy {in:[{id,kind:'ally'|'trade',from,name,give,get,expiresIn}], out:[…], neighbours, alliance:{id,members:[{id,name}],monument,need}|null, market:{rate}|null, canGift}`,
  `rebel {liege,liegeName,my,need,can,chance,cooldown}|null`, `rocket {stage,building,endsIn,cost,missing}|null`.

## act ops (phone → server; every op returns {ok} or {ok:false,error}); tiles as {q,r} | [q,r] | "q,r"
seat {seat} · rename {name} · jobs {farm,chop,quarry,mine,study} (partial ok) · build {b} (incl. 'castle') · age ·
train {u, n} · cancel {queue:'build'|'train'|'research', i} · research {tech} ·
march {from?, to, units:{u:n}, order?: move|claim|attack|reinforce|scout} · claim {to} · upgrade {at, what:'village'|'walls'} ·
ally {to} · allyAnswer {from|id, yes} · leaveAlly · gift {to, res} · trade {to, give, get} · tradeAnswer {id, yes} ·
message {preset, to?} (peace,next,help,thanks,deal,sorry,watch,gg) · rebel · rocket · monument {res:{gold,stone}} · market {give, get, n}

## TV fx kinds
seat · age · village · battle {q,r,win} · capture · vassal · rebel · alliance · betray · gift · message · event {event} ·
rocket · launchpad · launch · monument · kingdom · win · (start from the room)
