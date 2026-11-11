// Themed text for every non-classic theme: role/team names, place labels and narration.
// Data only. Merged into public/shared/themes.js.
(function (root) {
  const THEME_TEXT = {
    // ---------------------------------------------------------------- SPACE
    space: {
      townName: 'Kepler Station',
      cemetery: 'AIRLOCK',
      civic: { tavern: 'CANTINA', hall: 'COMMAND', firepit: 'REACTOR', market: 'TRADING POST', workshop: 'LAB' },
      teamNames: { mafia: 'The Syndicate', town: 'The Crew', neutral: 'Drifters' },
      roleNames: { crafter: 'Fabricator',
        villager: 'Colonist', mafia: 'Saboteur', godfather: 'Syndicate Boss', roleblocker: 'Signal Jammer',
        detective: 'Scan Officer', sheriff: 'Security Chief', doctor: 'Med-Bay Surgeon', bodyguard: 'Shield Trooper',
        vigilante: 'Rogue Marine', mayor: 'Station Commander', telepath: 'Psi-Link Twin', jester: 'Space Clown',
        serialKiller: 'Rogue Android', investigator: 'Motion Tracker', ghostwriter: 'Black Box', puppetMaster: 'Mind Hacker',
        paparazzi: 'Holo-Cam Drone', conductor: 'Comms Officer', glitch: 'System Bug', detonator: 'Demolitions Tech',
        silencer: 'Comms Cutter', sorcerer: 'Deep Scanner', hustler: 'Clock Hacker', alchemist: 'Bio-Chemist',
        executioner: 'Airlock Warden', hunter: 'Syndicate Scout', headhunter: 'Bounty Droid', medium: 'Echo Receiver',
        lookout: 'Camera Watch', veteran: 'Old Spacer', trapper: 'Laser Tripwire', cupid: 'Bond Engineer',
        eavesdropper: 'Comms Tapper', crier: 'Station PA', framer: 'Data Forger', janitor: 'Cleanup Bot',
        impostor: 'Shapeshifter', storymaker: 'Red Alert Officer',
      },
      narration: {
        start: [
          'Welcome aboard {town}. {count} colonists drift through the dark between the stars... and a saboteur syndicate hides among the crew.',
          'Life support is green on {town}. {count} crew members check in. Not all of them are loyal to the station.',
        ],
        roleReveal: ['Check your wrist terminals, and keep your clearance level to yourself. Some of you answer to the Syndicate.'],
        night: [
          'The station dims to night cycle. The corridors of {town} hum, and somewhere a blaster powers up...',
          'Sleep cycle begins on {town}. Lock your pod doors. Not every footstep in the hull belongs to a friend.',
        ],
        kill: [
          'Morning cycle. A scorch mark on the deck plating, and a drift of glowing dust where {name} once stood.{role} {alive} crew remain.',
          'A blaster flash lit the corridor last night. {name} was vaporized into shimmering dust.{role} {alive} remain.',
        ],
        multiKill: [
          'The blasters were busy last night. {name} have all been reduced to glowing dust.{role} {alive} remain.',
          'Morning cycle reveals {count} scorch marks on the deck. {name} are gone, scattered like stardust.{role} {alive} remain.',
        ],
        saved: [
          'A blaster bolt screamed toward {name} last night, but a shield flared just in time. {name} is still breathing.',
          'Someone targeted {name} in the dark. The med-bay pulled them back from the edge. {name} survives.',
        ],
        quiet: ['A quiet night cycle. No alarms, no scorch marks. Everyone reports for duty... for now.'],
        discussion: [
          'The Syndicate is still aboard. Compare your logs, crew. Who was off-shift last night?',
          'Somebody on this station is a saboteur. Talk it out before the air runs thin.',
        ],
        voting: ['Debate over. Cast your votes for the airlock!', 'Command needs a decision. Vote now, crew.'],
        votesIn: ['The votes are logged...'],
        eliminated: [
          'The crew has decided. {name} is escorted to the airlock, and the outer door hisses shut.{role}',
          'With {votes} votes logged against them, {name} is cycled out the airlock into the quiet stars.{role}',
        ],
        tie: ['A split vote! Command cannot act on a tie. The airlock stays sealed today.'],
        noElim: ['No consensus on deck. The airlock stays sealed today.'],
        townWin: ['The last saboteur has been cycled out the airlock. {town} is secure, and the stars are calm again!'],
        mafiaWin: ['The Syndicate controls every console on {town}. The station belongs to them now.'],
        jesterWin: ['The crew just spaced {name}, the Space Clown. It was the joke they were waiting for. The Jester wins!'],
        skWin: ['When the emergency lights flicker off, only the Rogue Android is left walking the halls of {town}.'],
        kill_lake: [
          '{name} lingered by the coolant pool. A blaster flash, a ripple of light, and only glowing dust drifting on the surface.{role} {alive} remain.',
          'The coolant pool shimmers this morning. Glowing dust floats where {name} last stood.{role} {alive} remain.',
        ],
        kill_hearth: [
          '{name} stayed by the reactor core to keep warm. A blaster flash outshone the core, and {name} dissolved into sparks.{role} {alive} remain.',
          'The reactor core hums on, but {name} is now just a drift of glowing dust beside it.{role} {alive} remain.',
        ],
        kill_tavern: [
          '{name} was the last one out of the cantina. A blaster flash by the door, and nothing left but shimmering dust.{role} {alive} remain.',
          'One more drink at the cantina, {name} said. The barbot swept up glowing dust at dawn.{role} {alive} remain.',
        ],
        kill_field: [
          '{name} went out to the observation deck to watch the stars. A blaster flash, and now {name} is stardust too.{role} {alive} remain.',
          'Out on the hull, past the last module of {town}, a scatter of glowing dust is all that is left of {name}.{role} {alive} remain.',
        ],
        kill_chase: [
          '{name} ran for their pod through the dark corridor. A blaster bolt caught them three steps from the hatch.{role} {alive} remain.',
          'Someone followed {name} down the corridor last night. Only glowing dust reached the pod door.{role} {alive} remain.',
        ],
        kill_visit: [
          '{name} was watching {host}’s pod a little too closely. A blaster flash in the vent, and {name} became dust.{role} {alive} remain.',
          'Glowing dust settles beneath {host}’s viewport. {name} was spying there, scanner still humming.{role} {alive} remain.',
        ],
      },
    },

    // -------------------------------------------------------------- FANTASY
    fantasy: {
      townName: 'Eldermere',
      cemetery: 'BARROWS',
      civic: { tavern: 'MOON INN', hall: 'MAGE HALL', firepit: 'ENCHANTED FIRE', market: 'BAZAAR', workshop: 'ALCHEMY' },
      teamNames: { mafia: 'The Dark Coven', town: 'The Realm', neutral: 'Wanderers' },
      roleNames: { crafter: 'Rune Smith',
        villager: 'Elfkin', mafia: 'Dark Acolyte', godfather: 'Coven Archmage', roleblocker: 'Binding Witch',
        detective: 'Truthseer', sheriff: 'Moon Warden', doctor: 'Healing Priestess', bodyguard: 'Oath Knight',
        vigilante: 'Rogue Ranger', mayor: 'High Elder', telepath: 'Moonbound Twin', jester: 'Trickster Fae',
        serialKiller: 'Wild Wraith', investigator: 'Rune Watcher', ghostwriter: 'Spirit Scribe', puppetMaster: 'Mind Charmer',
        paparazzi: 'Scrying Pixie', conductor: 'Harmony Bard', glitch: 'Wild Magic', detonator: 'Firerune Sage',
        silencer: 'Hush Hexer', sorcerer: 'Oracle', hustler: 'Time Witch', alchemist: 'Potion Brewer',
        executioner: 'Martyr Knight', hunter: 'Shadow Seeker', headhunter: 'Bounty Hexer', medium: 'Ghost Whisperer',
        lookout: 'Owl Sentinel', veteran: 'Elder Battlemage', trapper: 'Ward Weaver', cupid: 'Love Sprite',
        eavesdropper: 'Whisper Wisp', crier: 'Royal Herald', framer: 'Illusionist', janitor: 'Oblivion Witch',
        impostor: 'Glamour Witch', storymaker: 'Lorekeeper',
      },
      narration: {
        start: [
          'Welcome to {town}, where the trees sing and the lanterns glow. {count} souls dwell here... and a dark coven hides among them.',
          '{count} elves, mages and wanderers gather in {town}. Beware: some of them have sworn themselves to shadow.',
        ],
        roleReveal: ['Read your runes in secret, and guard them well. Not every spell in this realm is cast for good.'],
        night: [
          'The moons rise over {town}. In a hidden grove, the coven begins to chant...',
          'Starlight fades over {town}. Somewhere, purple sparks crackle at a dark sorcerer’s fingertips.',
        ],
        kill: [
          'The realm wakes to a chill. {name} stands frozen in stone, purple sparks still fading from their eyes.{role} {alive} remain.',
          'A dark curse found {name} in the night. Where they stood, there is only a silent statue.{role} {alive} remain.',
        ],
        multiKill: [
          'A cruel night in {town}. {name} have all been turned to stone by the coven’s curse.{role} {alive} remain.',
          'Dawn reveals {count} new statues in the lanes. {name} are petrified, never to move again.{role} {alive} remain.',
        ],
        saved: [
          'Purple sparks swirled around {name} last night, but a healing light broke the curse. {name} still breathes.',
          'The coven cursed {name} in the dark, yet a ward held strong. {name} lives to see the dawn.',
        ],
        quiet: ['A peaceful night. No curses, no statues. The realm wakes whole... for now.'],
        discussion: [
          'The coven hides among you, wearing friendly faces. Speak, and let the truth shine through.',
          'Dark magic walks the lanes of {town}. Who smells of sulfur and secrets?',
        ],
        voting: ['The council is over. Cast your votes!', 'Raise your wands and name the sorcerer. Vote now.'],
        votesIn: ['The runes have been counted...'],
        eliminated: [
          'The realm has spoken. {name} is banished beyond the enchanted gates.{role}',
          'With {votes} votes against them, {name} is cast out of {town} forever.{role}',
        ],
        tie: ['A tie! The magic is split, and no one is banished today.'],
        noElim: ['The council could not agree. No one is banished today.'],
        townWin: ['The last dark sorcerer is gone. The statues soften back to flesh in story and song. {town} is free!'],
        mafiaWin: ['The Dark Coven rules {town}. The lanterns burn purple now.'],
        jesterWin: ['The realm banished {name}, the Trickster Fae, exactly as they wished. Laughter echoes through the trees. The Jester wins!'],
        skWin: ['When the last spell fades, only the Wild Wraith drifts through the empty lanes of {town}.'],
        kill_lake: [
          '{name} gazed into the moonlit pond too long. Purple sparks danced on the water, and now a stone figure kneels at its edge.{role} {alive} remain.',
          'The pond is still. A statue of {name} stares into it forever.{role} {alive} remain.',
        ],
        kill_hearth: [
          'The enchanted fire burned violet last night. {name} was found beside it, turned entirely to stone.{role} {alive} remain.',
          '{name} warmed their hands at the enchanted fire one last time. The curse left only a cold statue.{role} {alive} remain.',
        ],
        kill_tavern: [
          '{name} was the last to leave the Moon Inn. A flash of purple sparks, and a statue now guards its door.{role} {alive} remain.',
          'One more cup of moonwine, {name} said. The innkeeper found them turned to stone at dawn.{role} {alive} remain.',
        ],
        kill_field: [
          '{name} wandered into the meadow to read the stars. Now a stone figure stands among the wildflowers.{role} {alive} remain.',
          'Beyond the last silver tree of {town}, in the tall grass, stands a statue of {name}.{role} {alive} remain.',
        ],
        kill_chase: [
          '{name} ran for home as purple sparks chased them down the lane. The curse caught them three steps from their door.{role} {alive} remain.',
          'Someone followed {name} home last night. At dawn, a statue of {name} reaches for the doorknob.{role} {alive} remain.',
        ],
        kill_visit: [
          '{name} was watching {host}’s tower a little too closely. Someone cursed the watcher, and {name} turned to stone.{role} {alive} remain.',
          'A statue of {name} stands beneath {host}’s window, scrying glass still in hand.{role} {alive} remain.',
        ],
      },
    },

    // -------------------------------------------------------------- DRAGONS
    dragons: {
      townName: 'Emberfall',
      cemetery: 'ASHFIELD',
      civic: { tavern: 'FLAGON HALL', hall: 'RIDER KEEP', firepit: 'GREAT BRAZIER', market: 'SCALE MARKET', workshop: 'FORGE' },
      teamNames: { mafia: 'The Dragon Cult', town: 'The Riders', neutral: 'Outlanders' },
      roleNames: { crafter: 'Forge Hand',
        villager: 'Mountain Folk', mafia: 'Cultist', godfather: 'Wyrm Prophet', roleblocker: 'Chain Binder',
        detective: 'Scale Reader', sheriff: 'Peak Warden', doctor: 'Burn Healer', bodyguard: 'Shieldbearer',
        vigilante: 'Lone Rider', mayor: 'Dragon Lord', telepath: 'Bonded Rider', jester: 'Ash Fool',
        serialKiller: 'Wild Wyvern', investigator: 'Smoke Tracker', ghostwriter: 'Ember Scribe', puppetMaster: 'Wyrm Whisperer',
        paparazzi: 'Sky Sketcher', conductor: 'War Drummer', glitch: 'Wild Spark', detonator: 'Fire Keg Sapper',
        silencer: 'Smoke Muzzler', sorcerer: 'Flame Oracle', hustler: 'Hourglass Smith', alchemist: 'Ember Brewer',
        executioner: 'Pyre Keeper', hunter: 'Cult Scout', headhunter: 'Dragon Slayer', medium: 'Ash Speaker',
        lookout: 'Watchtower Guard', veteran: 'Scarred Rider', trapper: 'Snare Setter', cupid: 'Heartflame',
        eavesdropper: 'Cave Listener', crier: 'Horn Blower', framer: 'Soot Smearer', janitor: 'Ash Sweeper',
        impostor: 'Turncloak', storymaker: 'Saga Teller',
      },
      narration: {
        start: [
          'Welcome to {town}, high in the smoking peaks. {count} folk live beneath the dragon-riders’ wings... and a dragon cult hides among them.',
          '{count} souls gather in {town}. Somewhere in the caves, a cult feeds its dragon. Some of you feed it too.',
        ],
        roleReveal: ['Check your phones, and hide your oaths. Some of you have bowed to the Wyrm.'],
        night: [
          'Night falls on {town}. High above, great wings beat against the stars...',
          'The braziers dim in {town}. In the mountain caves, something enormous breathes in.',
        ],
        kill: [
          'A roar shook {town} in the night. Where {name} stood, there is only ash and drifting embers.{role} {alive} remain.',
          'Dragonfire lit the sky last night. {name} was reduced to ash.{role} {alive} remain.',
        ],
        multiKill: [
          'The dragon flew twice over {town}. {name} have all been reduced to ash and embers.{role} {alive} remain.',
          'Dawn reveals {count} scorched circles in the snow. {name} are gone in a breath of fire.{role} {alive} remain.',
        ],
        saved: [
          'Dragonfire roared toward {name} last night, but a shield turned the flames aside. {name} is singed, but alive.',
          'The cult sent fire for {name}. A healer’s salve held it back. {name} survives.',
        ],
        quiet: ['A quiet night. No roar, no flames. The peaks wake unburned... for now.'],
        discussion: [
          'The cult hides among the riders. Whose cloak smells of smoke this morning?',
          'Someone in {town} whispers to the dragon. Speak up, or be suspected.',
        ],
        voting: ['Enough talk. Cast your votes!', 'Raise your torches and name the cultist. Vote now.'],
        votesIn: ['The torches have been counted...'],
        eliminated: [
          'The riders have spoken. {name} is marched down the mountain path, never to return.{role}',
          'With {votes} votes against them, {name} is exiled from {town}.{role}',
        ],
        tie: ['A tie! The riders are split, and no one is exiled today.'],
        noElim: ['The riders could not agree. No one is exiled today.'],
        townWin: ['The last cultist has fallen. The dragon flies off into the clouds, and {town} is safe at last!'],
        mafiaWin: ['The Dragon Cult rules {town}. Every brazier now burns in the Wyrm’s name.'],
        jesterWin: ['The riders exiled {name}, the Ash Fool, and that was the whole joke. The Jester wins!'],
        skWin: ['When the smoke clears, only the Wild Wyvern circles above {town}.'],
        kill_lake: [
          '{name} lingered at the hot spring too long. Dragonfire boiled the water, and only ash floats on the steam.{role} {alive} remain.',
          'The hot spring hisses this morning. Embers drift where {name} last bathed.{role} {alive} remain.',
        ],
        kill_hearth: [
          '{name} stood by the great brazier. A second, greater fire came down from the sky, and left only ash.{role} {alive} remain.',
          'The great brazier still glows. Beside it, a pile of embers is all that remains of {name}.{role} {alive} remain.',
        ],
        kill_tavern: [
          '{name} was the last to leave the flagon hall. A roar, a wall of flame, and ash at the door.{role} {alive} remain.',
          'One more flagon, {name} said. At dawn the keeper swept embers off the doorstep.{role} {alive} remain.',
        ],
        kill_field: [
          '{name} climbed the ridge outside town to watch the dragons fly. One of them breathed fire, and only ash remains.{role} {alive} remain.',
          'Beyond the last wall of {town}, on the scorched slope, ash marks where {name} fell.{role} {alive} remain.',
        ],
        kill_chase: [
          '{name} ran for home as a shadow crossed the moon. The dragonfire caught them three steps from their door.{role} {alive} remain.',
          'Wings followed {name} home last night. Only embers reached the doorstep.{role} {alive} remain.',
        ],
        kill_visit: [
          '{name} was watching {host}’s hut a little too closely. The dragon was watching {name}, and now only embers glow there.{role} {alive} remain.',
          'A ring of ash lies beneath {host}’s window, where {name} was spying.{role} {alive} remain.',
        ],
      },
    },

    // -------------------------------------------------------------- DUNGEON
    dungeon: {
      townName: 'The Deep Halls',
      cemetery: 'OSSUARY',
      civic: { tavern: 'ALEHOUSE', hall: 'THRONE CRYPT', firepit: 'TORCH CIRCLE', market: 'BLACK MARKET', workshop: 'ARMORY' },
      teamNames: { mafia: 'The Thieves’ Guild', town: 'The Delvers', neutral: 'Lurkers' },
      roleNames: { crafter: 'Tinkerer',
        villager: 'Delver', mafia: 'Cutthroat', godfather: 'Guildmaster', roleblocker: 'Door Jammer',
        detective: 'Torch Inquirer', sheriff: 'Hall Warden', doctor: 'Antidote Healer', bodyguard: 'Shield Guard',
        vigilante: 'Crypt Stalker', mayor: 'Hall Steward', telepath: 'Echo Twin', jester: 'Crypt Fool',
        serialKiller: 'Lurking Ghoul', investigator: 'Footprint Reader', ghostwriter: 'Crypt Scribe', puppetMaster: 'String Puller',
        paparazzi: 'Torch Sketcher', conductor: 'Chime Ringer', glitch: 'Flicker Torch', detonator: 'Powder Miner',
        silencer: 'Gag Thief', sorcerer: 'Rune Reader', hustler: 'Sand Thief', alchemist: 'Venom Brewer',
        executioner: 'Gallows Keeper', hunter: 'Guild Spotter', headhunter: 'Bounty Stalker', medium: 'Bone Speaker',
        lookout: 'Torch Sentry', veteran: 'Grizzled Warrior', trapper: 'Pit Digger', cupid: 'Heartbinder',
        eavesdropper: 'Vent Listener', crier: 'Bell Ringer', framer: 'Evidence Planter', janitor: 'Crypt Sweeper',
        impostor: 'Masked Thief', storymaker: 'Bard of Echoes',
      },
      narration: {
        start: [
          'Welcome to {town}, deep beneath the earth. {count} delvers live by torchlight... and a guild of assassins hides among them.',
          '{count} souls gather in the torchlit halls of {town}. Somewhere in the dark, a blade is being dipped in venom.',
        ],
        roleReveal: ['Check your phones by torchlight, and tell no one. The Thieves’ Guild has members everywhere.'],
        night: [
          'The torches gutter in {town}. Down a forgotten corridor, a blade drips green...',
          'Darkness swallows {town}. Lock your door and listen for soft footsteps on the stone.',
        ],
        kill: [
          'A cry echoed through the halls at dawn. {name} was found with a poisoned blade, green venom glowing on the stone.{role} {alive} remain.',
          'A venomed dagger found {name} in the dark. They will not light a torch today.{role} {alive} remain.',
        ],
        multiKill: [
          'The guild was busy last night. {name} all fell to poisoned blades.{role} {alive} remain.',
          'Dawn reveals {count} daggers glistening with green venom. {name} are gone.{role} {alive} remain.',
        ],
        saved: [
          'A poisoned blade found {name} last night, but an antidote arrived just in time. {name} lives.',
          'Someone struck at {name} in the dark. A guard’s shield caught the blade. {name} survives.',
        ],
        quiet: ['A quiet night. No daggers, no venom. Every torch is lit... for now.'],
        discussion: [
          'The Guild walks these halls in borrowed boots. Whose hands smell of venom?',
          'An assassin hides in {town}. Speak now, or the shadows will speak for you.',
        ],
        voting: ['Enough whispering. Cast your votes!', 'Point your torches at the thief. Vote now.'],
        votesIn: ['The votes are counted by torchlight...'],
        eliminated: [
          'The halls have spoken. {name} is marched to the deepest gate and locked out of {town}.{role}',
          'With {votes} votes against them, {name} is cast into the lower tunnels.{role}',
        ],
        tie: ['A tie! The delvers are divided, and no one is cast out today.'],
        noElim: ['The halls could not agree. No one is cast out today.'],
        townWin: ['The last assassin has been unmasked. The torches burn bright, and {town} is safe at last!'],
        mafiaWin: ['The Thieves’ Guild owns every corridor of {town}. The torches answer to them now.'],
        jesterWin: ['The halls cast out {name}, the Crypt Fool, who laughed all the way down the tunnel. The Jester wins!'],
        skWin: ['When the last torch flickers, only the Lurking Ghoul still wanders {town}.'],
        kill_lake: [
          '{name} knelt by the underground pool to drink. A poisoned blade struck from the shadows, and green venom clouds the water.{role} {alive} remain.',
          'The underground pool glows faintly green this morning. {name} never came back from it.{role} {alive} remain.',
        ],
        kill_hearth: [
          'The torch circle burned low last night. {name} was found beside it, a venom-green dagger at their side.{role} {alive} remain.',
          '{name} lingered at the torch circle for one more warm moment. A poisoned blade ended it.{role} {alive} remain.',
        ],
        kill_tavern: [
          '{name} was the last to leave the alehouse. A poisoned blade waited by the door.{role} {alive} remain.',
          'One more mug, {name} said. The keeper found them at dawn, green venom on the floor.{role} {alive} remain.',
        ],
        kill_field: [
          '{name} wandered into the outer caverns to see the glowing mushrooms. A venomed dagger found them first.{role} {alive} remain.',
          'Beyond the last gate of {town}, among the stalagmites, lies {name}, a green-stained blade nearby.{role} {alive} remain.',
        ],
        kill_chase: [
          '{name} ran for home through the dark tunnels. A poisoned blade caught them three steps from their door.{role} {alive} remain.',
          'Soft footsteps followed {name} home last night. A venomed blade, a green stain, and {name} never made it inside.{role} {alive} remain.',
        ],
        kill_visit: [
          '{name} was watching {host}’s chamber a little too closely. Someone with a venomed blade was watching {name}.{role} {alive} remain.',
          'They found {name} beneath {host}’s window, a green-stained dagger beside them.{role} {alive} remain.',
        ],
      },
    },

    // ---------------------------------------------------------------- SPIES
    spies: {
      townName: 'Operation Nightfall',
      cemetery: 'COMPROMISED',
      civic: { tavern: 'HOTEL BAR', hall: 'HQ', firepit: 'SAFE HOUSE', market: 'EMBASSY', workshop: 'GADGET LAB' },
      teamNames: { mafia: 'The Network', town: 'The Agency', neutral: 'Freelancers' },
      roleNames: { crafter: 'Gadgeteer',
        villager: 'Field Agent', mafia: 'Double Agent', godfather: 'Spymaster', roleblocker: 'Handler',
        detective: 'Analyst', sheriff: 'Counterintel', doctor: 'Field Medic', bodyguard: 'Close Protection',
        vigilante: 'Rogue Operative', mayor: 'Station Chief', telepath: 'Cipher Partner', jester: 'Loose Cannon',
        serialKiller: 'Lone Assassin', investigator: 'Surveillance Van', ghostwriter: 'Dead Drop', puppetMaster: 'Mind Controller',
        paparazzi: 'Spy Camera', conductor: 'Coordinator', glitch: 'Static Bug', detonator: 'Demolitions',
        silencer: 'Gag Order', sorcerer: 'Codebreaker', hustler: 'Countdown', alchemist: 'Chemist',
        executioner: 'Fall Guy', hunter: 'Enemy Scout', headhunter: 'Contract Killer', medium: 'Archive Clerk',
        lookout: 'Stakeout', veteran: 'Retired Spy', trapper: 'Tripwire', cupid: 'Sworn Partner',
        eavesdropper: 'Wiretapper', crier: 'Radio Broadcast', framer: 'Forger', janitor: 'Cleaner',
        impostor: 'Deep Cover', storymaker: 'Code Red',
      },
      narration: {
        start: [
          'Welcome to {town}. {count} agents have been assigned to this mission... and the enemy network has planted moles among them.',
          'Briefing is over. {count} operatives in the field. Trust no one: some of them are double agents.',
        ],
        roleReveal: ['Check your dossiers. Memorize your cover. Then destroy the evidence.'],
        night: [
          'Night falls on {town}. Somewhere across the street, a red dot finds a window...',
          'The city goes dark. Curtains close, phones go silent, and the network begins to move.',
        ],
        kill: [
          'A red dot on the chest, a soft pfft, then nothing. {name} has been taken off the board.{role} {alive} agents remain.',
          'A silenced pistol, a quiet street. {name} will not report in today.{role} {alive} remain.',
        ],
        multiKill: [
          'The network cleaned house last night. {name} were all silenced without a sound.{role} {alive} remain.',
          'Dawn brings {count} missed check-ins. {count} red dots, {count} silent shots: {name} are gone.{role} {alive} remain.',
        ],
        saved: [
          'A red dot settled on {name} last night, but someone pulled them out of the line of fire. {name} is still in play.',
          'The network made a move on {name}. Protection intercepted it. {name} survives.',
        ],
        quiet: ['A quiet night. No red dots, no missed check-ins. Everyone reports in... for now.'],
        discussion: [
          'The moles are in this room. Compare stories. Find the cracks in their cover.',
          'Someone here is feeding the enemy. Talk, agents, and watch for the lie.',
        ],
        voting: ['Debrief over. Cast your votes!', 'Time to burn a cover. Vote now.'],
        votesIn: ['The votes are decoded...'],
        eliminated: [
          'The Agency has decided. {name} is pulled from the field and their cover is burned.{role}',
          'With {votes} votes against them, {name} is disavowed and escorted out of {town}.{role}',
        ],
        tie: ['A tie! The Agency is deadlocked, and no one is burned today.'],
        noElim: ['No consensus at HQ. No one is burned today.'],
        townWin: ['The last double agent has been exposed. Mission accomplished. {town} is complete!'],
        mafiaWin: ['The network has compromised the entire Agency. {town} has failed.'],
        jesterWin: ['The Agency burned {name}, the Loose Cannon, which was exactly the plan. The Jester wins!'],
        skWin: ['When the dust settles, only the Lone Assassin is left in {town}, and nobody even knew their real name.'],
        kill_lake: [
          '{name} stopped by the river to make a drop. A red dot on the water, a silent shot, and then nothing.{role} {alive} remain.',
          'A red dot on the river, then ripples at dawn. {name} never came back from the drop point.{role} {alive} remain.',
        ],
        kill_hearth: [
          '{name} stayed at the safe house fireplace too long. A red dot through the window, a silenced shot, and the safe house was not safe.{role} {alive} remain.',
          'A red dot crossed the safe house wall. {name} was found beside the cold fireplace.{role} {alive} remain.',
        ],
        kill_tavern: [
          '{name} was the last to leave the hotel bar. A red dot followed them out, and a silenced shot finished the night.{role} {alive} remain.',
          'One more martini, {name} said. The bartender found them in the lobby at dawn.{role} {alive} remain.',
        ],
        kill_field: [
          '{name} went to the airfield outside town for a midnight exchange. A red dot was waiting.{role} {alive} remain.',
          'Beyond the edge of {town}, on the empty airstrip, lies {name}.{role} {alive} remain.',
        ],
        kill_chase: [
          '{name} ran for the safe house. A red dot found their back three steps from the door.{role} {alive} remain.',
          'A car followed {name} home last night, headlights off. A red dot, a muffled shot, and {name} never made it inside.{role} {alive} remain.',
        ],
        kill_visit: [
          '{name} had {host}’s apartment under surveillance. Someone had a red dot on {name} too.{role} {alive} remain.',
          'They found {name} beneath {host}’s window, binoculars still in hand, a red dot fading away.{role} {alive} remain.',
        ],
      },
    },

    // ------------------------------------------------------------------ FBI
    fbi: {
      townName: 'Field Office 9',
      cemetery: 'EVIDENCE',
      civic: { tavern: 'BREAK ROOM', hall: 'FIELD OFFICE', firepit: 'BRIEFING', market: 'SUPPLIES', workshop: 'FORENSICS' },
      teamNames: { mafia: 'The Crime Family', town: 'The Bureau', neutral: 'Persons of Interest' },
      roleNames: { crafter: 'Lab Tech',
        villager: 'Civilian', mafia: 'Made Man', godfather: 'Crime Boss', roleblocker: 'Fixer',
        detective: 'Special Agent', sheriff: 'Profiler', doctor: 'Paramedic', bodyguard: 'Protection Detail',
        vigilante: 'Rogue Cop', mayor: 'Bureau Chief', telepath: 'Partner Agent', jester: 'False Confessor',
        serialKiller: 'The Unsub', investigator: 'Surveillance Tech', ghostwriter: 'Cold Case File', puppetMaster: 'Jury Tamperer',
        paparazzi: 'Press Photographer', conductor: 'Negotiator', glitch: 'Computer Virus', detonator: 'Demo Expert',
        silencer: 'Mob Lawyer', sorcerer: 'Lab Analyst', hustler: 'Fast Talker', alchemist: 'Mob Chemist',
        executioner: 'Fall Guy', hunter: 'Mob Informant', headhunter: 'Hitman', medium: 'Coroner',
        lookout: 'Stakeout Agent', veteran: 'Retired Agent', trapper: 'Sting Operation', cupid: 'Sworn Partners',
        eavesdropper: 'Wiretap', crier: 'News Anchor', framer: 'Evidence Planter', janitor: 'Cleaner',
        impostor: 'The Mole', storymaker: 'Breaking News',
      },
      narration: {
        start: [
          'Welcome to {town}. {count} people are part of this investigation... and a crime family has people on the inside.',
          'The case file is open. {count} names on the board. Some of them work for the Family.',
        ],
        roleReveal: ['Check your badges, and keep your assignment classified. The Family has ears in this building.'],
        night: [
          'Night falls on {town}. The office empties, and somewhere a revolver is loaded...',
          'The streetlights buzz outside {town}. The Family is making its moves tonight.',
        ],
        kill: [
          'A revolver shot rang out last night. By morning, {name} is a chalk outline behind yellow tape.{role} {alive} remain.',
          'New crime scene at dawn. The tape is up, and the chalk outline belongs to {name}.{role} {alive} remain.',
        ],
        multiKill: [
          'Multiple shots fired overnight. {name} are now chalk outlines in the case file.{role} {alive} remain.',
          'Forensics is working {count} crime scenes this morning. {name} are gone.{role} {alive} remain.',
        ],
        saved: [
          'Shots were fired at {name} last night, but someone got them to safety. {name} is shaken, but alive.',
          'The Family put a hit on {name}. Protection got there first. {name} survives.',
        ],
        quiet: ['A quiet night. No shots fired, no new tape. Everyone clocks in... for now.'],
        discussion: [
          'The Family has someone in this room. Review the evidence. Who doesn’t add up?',
          'Somebody here is on the payroll. Talk, or look like you have something to hide.',
        ],
        voting: ['Briefing over. Cast your votes!', 'Time to make an arrest. Vote now.'],
        votesIn: ['The votes are in...'],
        eliminated: [
          'The Bureau has made its call. {name} is cuffed and led out of {town}.{role}',
          'With {votes} votes against them, {name} is placed under arrest.{role}',
        ],
        tie: ['A tie! The case is split, and no arrest is made today.'],
        noElim: ['Not enough evidence. No arrest is made today.'],
        townWin: ['The last member of the Family is in custody. Case closed. {town} is clean!'],
        mafiaWin: ['The Family owns {town} now. The files have quietly gone missing.'],
        jesterWin: ['The Bureau arrested {name}, the False Confessor, who wanted the headlines all along. The Jester wins!'],
        skWin: ['When the last file closes, only the Unsub is left in {town}, still unidentified.'],
        kill_lake: [
          'A revolver shot echoed over the reservoir. By dawn, a chalk outline marked the shore where {name} fell.{role} {alive} remain.',
          'Yellow tape circles the reservoir this morning. The outline belongs to {name}.{role} {alive} remain.',
        ],
        kill_hearth: [
          '{name} stayed late in the briefing room. One shot, and now a chalk outline lies by the whiteboard.{role} {alive} remain.',
          'The coffee in the briefing room went cold. So did the trail: {name} is a chalk outline on the floor.{role} {alive} remain.',
        ],
        kill_tavern: [
          '{name} was the last one in the break room. A single revolver shot, and a chalk outline by the vending machine.{role} {alive} remain.',
          'One more coffee, {name} said. The night shift found the chalk outline at dawn.{role} {alive} remain.',
        ],
        kill_field: [
          '{name} drove out to the empty lot past town to meet a source. The source never came. A revolver did.{role} {alive} remain.',
          'Beyond the edge of {town}, a chalk outline in the gravel marks where {name} fell.{role} {alive} remain.',
        ],
        kill_chase: [
          '{name} ran for their car. A revolver shot caught them three steps from the door, and now there is tape around the space.{role} {alive} remain.',
          'Someone tailed {name} home last night. The chalk outline is on their front step.{role} {alive} remain.',
        ],
        kill_visit: [
          '{name} was running surveillance on {host}’s house. One revolver shot later, {name} is a chalk outline on the curb.{role} {alive} remain.',
          'A chalk outline lies beneath {host}’s window, where {name} was taking notes.{role} {alive} remain.',
        ],
      },
    },

    // ----------------------------------------------------------------- SNOW
    snow: {
      townName: 'Frostvale',
      cemetery: 'ICE FIELD',
      civic: { tavern: 'COCOA HOUSE', hall: 'LODGE', firepit: 'BONFIRE', market: 'FUR MARKET', workshop: 'SLED SHOP' },
      teamNames: { mafia: 'The Frost Wolves', town: 'The Village', neutral: 'Wanderers' },
      roleNames: { crafter: 'Ice Carver',
        villager: 'Snowfolk', mafia: 'Frost Wolf', godfather: 'Alpha Wolf', roleblocker: 'Blizzard Caller',
        detective: 'Aurora Seer', sheriff: 'Snow Ranger', doctor: 'Hearth Healer', bodyguard: 'Sled Guard',
        vigilante: 'Lone Skier', mayor: 'Village Elder', telepath: 'Aurora Twin', jester: 'Snow Clown',
        serialKiller: 'The Yeti', investigator: 'Track Reader', ghostwriter: 'Frost Writer', puppetMaster: 'Wolf Whisperer',
        paparazzi: 'Snow Sketcher', conductor: 'Choir Leader', glitch: 'Frost Flicker', detonator: 'Avalanche Maker',
        silencer: 'Frozen Tongue', sorcerer: 'Ice Oracle', hustler: 'Blizzard Rusher', alchemist: 'Frost Brewer',
        executioner: 'Ice Martyr', hunter: 'Wolf Scout', headhunter: 'Pelt Collector', medium: 'Spirit Listener',
        lookout: 'Chimney Watch', veteran: 'Old Mountaineer', trapper: 'Snare Setter', cupid: 'Snow Angel',
        eavesdropper: 'Howl Listener', crier: 'Horn Caller', framer: 'Pawprint Faker', janitor: 'Snow Sweeper',
        impostor: 'Wolf in Wool', storymaker: 'Fireside Teller',
      },
      narration: {
        start: [
          'Welcome to {town}, where the northern lights dance over the snow. {count} villagers live here... and the Frost Wolves run among them.',
          '{count} villagers gather by the fire in {town}. Out in the drifts, a howl rises. Some of you know that howl.',
        ],
        roleReveal: ['Check your phones under your mittens, and keep your secret warm. Some of you run with the pack.'],
        night: [
          'Night falls on {town}. The aurora glows green, and icicles grow sharp along the eaves...',
          'The wind howls through {town}. Bar your doors. The wolves are out tonight.',
        ],
        kill: [
          'An icicle struck in the night. {name} froze solid, and by dawn the ice had shattered into glittering shards.{role} {alive} remain.',
          'The village wakes to a frozen silhouette. {name} was turned to ice, then shattered like glass.{role} {alive} remain.',
        ],
        multiKill: [
          'A bitter night in {town}. {name} were all frozen solid and shattered.{role} {alive} remain.',
          'Dawn reveals {count} piles of glittering ice. {name} are gone.{role} {alive} remain.',
        ],
        saved: [
          'An icicle flew at {name} last night, but someone pulled them to the warm hearth just in time. {name} thaws out, alive.',
          'The wolves went for {name} in the snow. A guardian stood in the way. {name} survives.',
        ],
        quiet: ['A quiet night. No howls, no shattered ice. The village wakes warm... for now.'],
        discussion: [
          'The Frost Wolves hide among you in woolly sweaters. Whose boots are wet this morning?',
          'A wolf sits by our fire. Speak up, or let the cold speak for you.',
        ],
        voting: ['Enough chatter. Cast your votes!', 'Point your mittens at the wolf. Vote now.'],
        votesIn: ['The votes are counted...'],
        eliminated: [
          'The village has spoken. {name} is sent out past the last lantern into the snow.{role}',
          'With {votes} votes against them, {name} is banished from {town} into the blizzard.{role}',
        ],
        tie: ['A tie! The village is split, and no one is banished today.'],
        noElim: ['The village could not agree. No one is banished today.'],
        townWin: ['The last Frost Wolf has been driven out. The aurora blazes, and {town} is safe at last!'],
        mafiaWin: ['The Frost Wolves rule {town}. Their howls echo down every snowy lane.'],
        jesterWin: ['The village banished {name}, the Snow Clown, who skipped off giggling into the drifts. The Jester wins!'],
        skWin: ['When the blizzard clears, only the Yeti is left in {town}, and it is very pleased.'],
        kill_lake: [
          '{name} went skating on the frozen pond. An icicle struck, the cold took hold, and a frozen figure shattered on the ice.{role} {alive} remain.',
          'The frozen pond glitters with shards this morning. {name} never skated home.{role} {alive} remain.',
        ],
        kill_hearth: [
          'The bonfire burned low last night. {name} froze solid beside the dying embers and shattered at dawn.{role} {alive} remain.',
          '{name} lingered by the bonfire for one more warm moment. The icicle came from behind.{role} {alive} remain.',
        ],
        kill_tavern: [
          '{name} was the last to leave the cocoa house. An icicle struck in the doorway, and now only glittering shards remain.{role} {alive} remain.',
          'One more mug of cocoa, {name} said. At dawn the owner swept frozen shards off the step.{role} {alive} remain.',
        ],
        kill_field: [
          '{name} wandered into the snowfield to watch the northern lights. They froze where they stood, then shattered.{role} {alive} remain.',
          'Beyond the last fence of {town}, glittering ice shards mark where {name} stood.{role} {alive} remain.',
        ],
        kill_chase: [
          '{name} ran for home through the drifts. An icicle caught them three steps from their door.{role} {alive} remain.',
          'Paw prints followed {name} home last night. A frozen figure stands on the doorstep, cracked through.{role} {alive} remain.',
        ],
        kill_visit: [
          '{name} was watching {host}’s cabin a little too closely. An icicle fell, and {name} froze and shattered on the spot.{role} {alive} remain.',
          'A shattered ice figure lies beneath {host}’s window. {name} was spying there.{role} {alive} remain.',
        ],
      },
    },

    // --------------------------------------------------------------- BLOCKY
    blocky: {
      townName: 'Cubeshire',
      cemetery: 'RESPAWN VOID',
      civic: { tavern: 'SNACK CUBE', hall: 'BUILD HALL', firepit: 'CAMPFIRE', market: 'TRADE BLOCK', workshop: 'CRAFT TABLE' },
      teamNames: { mafia: 'The Griefers', town: 'The Builders', neutral: 'Wildcards' },
      roleNames: { crafter: 'Workbench Wiz',
        villager: 'Blockling', mafia: 'Griefer', godfather: 'Grief Lord', roleblocker: 'Block Wall',
        detective: 'Pixel Inspector', sheriff: 'Cube Marshal', doctor: 'Respawn Medic', bodyguard: 'Shield Block',
        vigilante: 'Lone Builder', mayor: 'Server Admin', telepath: 'Paired Cube', jester: 'Pixel Prankster',
        serialKiller: 'Rogue Cube', investigator: 'Block Tracker', ghostwriter: 'Sign Writer', puppetMaster: 'Remote Controller',
        paparazzi: 'Screenshotter', conductor: 'Build Leader', glitch: 'Lag Spike', detonator: 'Boom Block',
        silencer: 'Chat Muter', sorcerer: 'Data Miner', hustler: 'Speed Runner', alchemist: 'Potion Crafter',
        executioner: 'Swap Block', hunter: 'Griefer Scout', headhunter: 'Bounty Builder', medium: 'Ghost Pixel',
        lookout: 'Tower Builder', veteran: 'Iron Knight', trapper: 'Pit Builder', cupid: 'Heart Block',
        eavesdropper: 'Chat Logger', crier: 'Broadcast Block', framer: 'Skin Swapper', janitor: 'Block Cleaner',
        impostor: 'Fake Skin', storymaker: 'Server Event',
      },
      narration: {
        start: [
          'Welcome to {town}, a world built one cube at a time. {count} builders live here... and the Griefers are hiding among them.',
          '{count} blocky builders spawn into {town}. Somebody here wants to knock it all down.',
        ],
        roleReveal: ['Check your inventory, and keep it private. Some of you are on the Griefers’ team.'],
        night: [
          'The square sun sets over {town}. The pixels go dark, and a pixel sword glints...',
          'Night falls block by block in {town}. Wall yourself in. The Griefers are out.',
        ],
        kill: [
          'A pixel sword flashed in the night. {name} burst into a shower of little cubes.{role} {alive} builders remain.',
          'Morning in {town}. A pile of tiny cubes sits where {name} used to be.{role} {alive} remain.',
        ],
        multiKill: [
          'The Griefers went on a spree. {name} all burst into little cubes.{role} {alive} remain.',
          'Dawn reveals {count} scattered piles of cubes. {name} are gone.{role} {alive} remain.',
        ],
        saved: [
          'A pixel sword swung at {name} last night, but a shield block popped up just in time. {name} is still in one piece.',
          'The Griefers tried to break {name}. A medic patched them back together. {name} survives.',
        ],
        quiet: ['A quiet night. No sword swings, no scattered cubes. Everyone respawns at home... for now.'],
        discussion: [
          'The Griefers are hiding in plain sight. Check the build logs. Who broke what?',
          'A Griefer is standing right next to you. Talk, or look suspiciously square.',
        ],
        voting: ['Build time is over. Cast your votes!', 'Place your vote blocks now.'],
        votesIn: ['The votes are stacked up...'],
        eliminated: [
          'The builders have spoken. {name} is kicked from the server.{role}',
          'With {votes} votes against them, {name} is booted out of {town}.{role}',
        ],
        tie: ['A tie! The builders are split, and nobody gets kicked today.'],
        noElim: ['No agreement in {town}. Nobody gets kicked today.'],
        townWin: ['The last Griefer has been kicked. The builders rebuild, and {town} is safe at last!'],
        mafiaWin: ['The Griefers rule {town}. Every block is theirs to break.'],
        jesterWin: ['The builders kicked {name}, the Pixel Prankster, who wanted to get kicked all along. The Jester wins!'],
        skWin: ['When the last block falls, only the Rogue Cube is left in {town}.'],
        kill_lake: [
          '{name} went for a swim in the square pond. A pixel sword flashed, and little cubes bobbed on the water.{role} {alive} remain.',
          'Tiny cubes float on the pond this morning. {name} never swam back.{role} {alive} remain.',
        ],
        kill_hearth: [
          '{name} stayed by the campfire too long. One pixel sword strike, and {name} burst into cubes beside the flames.{role} {alive} remain.',
          'The campfire still crackles. Next to it, a little pile of cubes is all that is left of {name}.{role} {alive} remain.',
        ],
        kill_tavern: [
          '{name} was the last to leave the snack cube. A pixel sword waited by the door, and cubes scattered everywhere.{role} {alive} remain.',
          'One more snack, {name} said. The owner swept up little cubes at dawn.{role} {alive} remain.',
        ],
        kill_field: [
          '{name} wandered past the edge of {town} to look at the blocky stars. A pixel sword found them first.{role} {alive} remain.',
          'Out in the grass blocks beyond {town}, a little pile of cubes marks where {name} stood.{role} {alive} remain.',
        ],
        kill_chase: [
          '{name} ran for home across the blocks. A pixel sword caught them three blocks from their door.{role} {alive} remain.',
          'Someone followed {name} home last night. Only a trail of tiny cubes reached the door.{role} {alive} remain.',
        ],
        kill_visit: [
          '{name} was peeking at {host}’s house a little too closely. A pixel sword was peeking back.{role} {alive} remain.',
          'A pile of little cubes sits beneath {host}’s window, right where {name} was spying.{role} {alive} remain.',
        ],
      },
    },

    // ------------------------------------------------------------- TABLETOP
    tabletop: {
      townName: 'Tavern Tales',
      cemetery: 'DISCARD PILE',
      civic: { tavern: 'THE INN', hall: 'GUILDHALL', firepit: 'CAMPFIRE', market: 'MERCHANT ROW', workshop: 'BLACKSMITH' },
      teamNames: { mafia: 'The Villain’s Cult', town: 'The Party', neutral: 'Wandering NPCs' },
      roleNames: { crafter: 'Artificer',
        villager: 'Commoner', mafia: 'Rogue', godfather: 'Cult Leader', roleblocker: 'Hold Caster',
        detective: 'Truth Cleric', sheriff: 'Paladin', doctor: 'Healer', bodyguard: 'Fighter',
        vigilante: 'Ranger', mayor: 'Party Leader', telepath: 'Twin Familiars', jester: 'Chaotic Bard',
        serialKiller: 'Wandering Monster', investigator: 'Perception Check', ghostwriter: 'Ghostly Note', puppetMaster: 'Charm Caster',
        paparazzi: 'Sketch Artist', conductor: 'Inspiring Minstrel', glitch: 'Wild Surge', detonator: 'Fireball Trap',
        silencer: 'Hush Caster', sorcerer: 'Truesight Wizard', hustler: 'Initiative Thief', alchemist: 'Potion Master',
        executioner: 'Noble Martyr', hunter: 'Cult Spy', headhunter: 'Bounty Seeker', medium: 'Speak with Dead',
        lookout: 'Night Watch', veteran: 'Retired Hero', trapper: 'Trapsmith', cupid: 'Love Charm',
        eavesdropper: 'Lurking Familiar', crier: 'Town Herald', framer: 'Illusionist', janitor: 'Cleanup Crew',
        impostor: 'Doppelganger', storymaker: 'Plot Twist',
      },
      narration: {
        start: [
          'The Game Master unrolls the map. Welcome to {town}. {count} adventurers sit around the table... and some of them secretly serve the Villain.',
          'Roll for initiative! {count} heroes gather in {town}. Read your character sheets carefully. Not every hero is a hero.',
        ],
        roleReveal: ['Check your character sheets, and hide them behind your hand. Some of you rolled a secret alignment.'],
        night: [
          'The Game Master lowers the screen. Night falls over {town}, and somewhere a bowstring is drawn...',
          'Long rest. The party sleeps in {town}. The dice rattle behind the screen.',
        ],
        kill: [
          'The Game Master rolls behind the screen... a natural 20. An arrow flies true, and {name}’s miniature tips over.{role} {alive} remain.',
          'Critical hit! An arrow out of the dark finds {name}. Their miniature falls flat on the map.{role} {alive} remain.',
        ],
        multiKill: [
          'The dice were cruel last night. Critical hit after critical hit: {name} have all fallen to arrows.{role} {alive} remain.',
          'The Game Master knocks over {count} miniatures. {name} are out of the campaign.{role} {alive} remain.',
        ],
        saved: [
          'An arrow streaked toward {name} last night, but a healing spell landed first. {name} is back on their feet.',
          'The Villain rolled to hit {name}... and missed. A shield caught the arrow. {name} survives.',
        ],
        quiet: ['A quiet night. Every roll missed, and every miniature still stands... for now.'],
        discussion: [
          'The Villain’s Cult hides at this table. Roll for insight. Who’s lying?',
          'The Game Master smiles. Someone in the party is not who they say they are. Discuss.',
        ],
        voting: ['Out of character, everyone: cast your votes!', 'Time to roll for justice. Vote now.'],
        votesIn: ['The dice have been counted...'],
        eliminated: [
          'The party has decided. {name} is escorted out of {town}, and their miniature leaves the map.{role}',
          'With {votes} votes against them, {name} is exiled from the party.{role}',
        ],
        tie: ['A tie! The party argues over the rules, and no one is exiled today.'],
        noElim: ['The party could not agree. No one is exiled today.'],
        townWin: ['The last cultist is defeated! Roll for loot. {town} is saved, and the campaign ends in triumph!'],
        mafiaWin: ['The Villain’s Cult rules {town}. The Game Master closes the book on a dark ending.'],
        jesterWin: ['The party exiled {name}, the Chaotic Bard, who was playing for laughs all along. The Jester wins!'],
        skWin: ['When the dice stop rolling, only the Wandering Monster is left on the map of {town}.'],
        kill_lake: [
          '{name} stopped by the lake to refill their waterskin. Natural 20 on the attack roll: an arrow, a splash, and their miniature tips into the blue.{role} {alive} remain.',
          'Ripples spread across the lake on the map. {name}’s miniature lies on its side at the shore.{role} {alive} remain.',
        ],
        kill_hearth: [
          '{name} kept watch by the campfire alone. Critical hit from the shadows, and their miniature tips over by the flames.{role} {alive} remain.',
          'The campfire burns on the map. {name}’s miniature lies beside it, an arrow in the margin.{role} {alive} remain.',
        ],
        kill_tavern: [
          '{name} was the last to leave the inn. The Game Master rolls a natural 20: an arrow at the door, and the miniature falls.{role} {alive} remain.',
          'One more round, {name} said. The innkeeper found their miniature tipped over at dawn.{role} {alive} remain.',
        ],
        kill_field: [
          '{name} wandered off the edge of the map to explore. Critical hit from the tall grass. Their miniature tips over.{role} {alive} remain.',
          'Beyond the last road of {town}, on the parchment fields, lies {name}’s fallen miniature.{role} {alive} remain.',
        ],
        kill_chase: [
          '{name} dashed for home. The Villain rolled a natural 20, and an arrow caught them three squares from their door.{role} {alive} remain.',
          'Someone followed {name} home last night. A critical hit, and their miniature topples at the doorstep.{role} {alive} remain.',
        ],
        kill_visit: [
          '{name} rolled stealth to spy on {host}’s house. The Villain rolled higher, and then rolled a natural 20.{role} {alive} remain.',
          'A miniature lies tipped over beneath {host}’s window. {name} was spying there.{role} {alive} remain.',
        ],
      },
    },

    // ------------------------------------------------------------ REALISTIC
    realistic: {
      townName: 'Maple Hollow',
      cemetery: 'CEMETERY',
      civic: { tavern: 'THE DINER', hall: 'TOWN HALL', firepit: 'FIRE PIT', market: 'GROCERY', workshop: 'GARAGE' },
      teamNames: { mafia: 'The Syndicate', town: 'The Town', neutral: 'Outsiders' },
      roleNames: { crafter: 'Handyman',
        villager: 'Resident', mafia: 'Syndicate Member', godfather: 'The Boss', roleblocker: 'Enforcer',
        detective: 'Homicide Lead', sheriff: 'Deputy', doctor: 'ER Nurse', bodyguard: 'Security Guard',
        vigilante: 'Avenger', mayor: 'Council Chair', telepath: 'Childhood Friend', jester: 'Troublemaker',
        serialKiller: 'The Stranger', investigator: 'Night Watchman', ghostwriter: 'Last Letter', puppetMaster: 'Power Broker',
        paparazzi: 'Reporter', conductor: 'Community Organizer', glitch: 'Power Outage', detonator: 'Demolition Man',
        silencer: 'Intimidator', sorcerer: 'Forensic Analyst', hustler: 'Smooth Talker', alchemist: 'Pharmacist',
        executioner: 'Stand-In', hunter: 'Syndicate Tail', headhunter: 'Hired Gun', medium: 'Coroner',
        lookout: 'Neighborhood Watch', veteran: 'Retired Marine', trapper: 'Alarm Installer', cupid: 'Sweetheart',
        eavesdropper: 'Wire Listener', crier: 'Radio Host', framer: 'Evidence Planter', janitor: 'Fixer',
        impostor: 'The Mole', storymaker: 'Emergency Meeting',
      },
      narration: {
        start: [
          'Maple Hollow. {count} people. A diner, a church, a quiet main street. And somewhere beneath it all, the Syndicate.',
          '{count} residents in {town}. Everyone knows everyone here. That’s what makes it dangerous.',
        ],
        roleReveal: ['Look at your phone. Say nothing. Some of the people at this table already belong to the Syndicate.'],
        night: [
          'Night settles over {town}. Porch lights click off one by one.',
          'The town goes quiet. Somewhere, someone is waiting in the dark.',
        ],
        kill: [
          'They found {name} at first light. A knife in the dark, and no one heard a thing.{role} {alive} remain.',
          'Dawn in {town}. A neighbor’s scream. {name} is gone.{role} {alive} remain.',
        ],
        multiKill: [
          'It was a long night in {town}. Knives in the dark, and by dawn, {name} were all gone.{role} {alive} remain.',
          'The morning brings {count} sirens. {name} won’t be coming to the diner today.{role} {alive} remain.',
        ],
        saved: [
          'Someone came for {name} last night. Someone else was already there. {name} is alive.',
          'An attack on {name} in the dark. Help arrived in time. {name} survived the night.',
        ],
        quiet: ['A quiet night. No sirens. Everyone wakes up. For now.'],
        discussion: [
          'Somebody at this table knows exactly what happened last night. Talk.',
          'The Syndicate is one of you. Look at your neighbors. Really look.',
        ],
        voting: ['That’s enough. Cast your votes.', 'It’s time to decide. Vote.'],
        votesIn: ['The votes are in.'],
        eliminated: [
          'The town has decided. {name} is driven to the county line and told never to come back.{role}',
          '{votes} votes. {name} packs a bag and leaves {town} before sundown.{role}',
        ],
        tie: ['A tie. The town is divided, and no one leaves today.'],
        noElim: ['No agreement. No one leaves today.'],
        townWin: ['The last of the Syndicate is gone. {town} is quiet again. Maybe, this time, it will stay that way.'],
        mafiaWin: ['The Syndicate owns {town} now. Nobody says it out loud. Nobody has to.'],
        jesterWin: ['The town forced out {name}. That was exactly what they wanted. The Jester wins.'],
        skWin: ['When it was over, only the Stranger was left in {town}. Nobody ever learned their name.'],
        kill_lake: [
          '{name} went down to the lake alone. A knife in the dark, and at dawn the fishermen found them on the dock.{role} {alive} remain.',
          'Mist on the lake this morning. A knife in the dark, and {name} never came home from the water.{role} {alive} remain.',
        ],
        kill_hearth: [
          'The fire pit had burned down to ash. {name} was found beside it at first light. A knife, and no sound.{role} {alive} remain.',
          '{name} sat by the fire pit for one more minute. Someone was waiting behind them with a knife.{role} {alive} remain.',
        ],
        kill_tavern: [
          '{name} was the last one out of the diner. A knife in the dark alley. The cook found them by the back door at dawn.{role} {alive} remain.',
          'One more coffee, {name} said. A knife in the parking lot, and they were found beside their car at dawn.{role} {alive} remain.',
        ],
        kill_field: [
          '{name} walked out past the edge of town to clear their head. A knife in the dark. The search party found them at dawn.{role} {alive} remain.',
          'Beyond the last fence of {town}, in the cornfield, lies {name}. Found at dawn. No one heard the knife.{role} {alive} remain.',
        ],
        kill_chase: [
          '{name} was walking fast to get home. A knife in the dark, three steps from their porch.{role} {alive} remain.',
          'Someone followed {name} home last night with a knife. The porch light was still on when they were found at dawn.{role} {alive} remain.',
        ],
        kill_visit: [
          '{name} was watching {host}’s house from across the street. Someone with a knife was watching {name}. Found at dawn.{role} {alive} remain.',
          'They found {name} beneath {host}’s window at dawn, notebook still in hand. A knife in the dark, and not a sound.{role} {alive} remain.',
        ],
      },
    },

    // ----------------------------------------------------------------- NOIR
    noir: {
      townName: 'Rain City',
      cemetery: 'POTTER’S FIELD',
      civic: { tavern: 'JAZZ CLUB', hall: 'CITY HALL', firepit: 'BARREL FIRE', market: 'PAWN SHOP', workshop: 'DOCKS' },
      teamNames: { mafia: 'The Outfit', town: 'The City', neutral: 'Drifters' },
      roleNames: { crafter: 'The Fixer',
        villager: 'Citizen', mafia: 'Outfit Goon', godfather: 'Kingpin', roleblocker: 'Muscle',
        detective: 'Private Eye', sheriff: 'Beat Cop', doctor: 'Night Nurse', bodyguard: 'Bruiser',
        vigilante: 'Trigger Man', mayor: 'Councilman', telepath: 'Old Partner', jester: 'Two-Bit Clown',
        serialKiller: 'The Rain Killer', investigator: 'Tail Man', ghostwriter: 'Dead Man’s Diary', puppetMaster: 'Wire Puller',
        paparazzi: 'Shutterbug', conductor: 'Bandleader', glitch: 'Flickering Neon', detonator: 'Mad Bomber',
        silencer: 'Hush Money', sorcerer: 'The Insider', hustler: 'Card Sharp', alchemist: 'Bootlegger',
        executioner: 'Fall Guy', hunter: 'Outfit Tail', headhunter: 'Hired Gun', medium: 'Fortune Teller',
        lookout: 'Night Watchman', veteran: 'Old Soldier', trapper: 'Snare Man', cupid: 'Sweetheart',
        eavesdropper: 'Phone Tapper', crier: 'Newsboy', framer: 'Frame-Up Artist', janitor: 'Cleaner',
        impostor: 'Turncoat', storymaker: 'Late Edition',
      },
      narration: {
        start: [
          'It was raining in {town}. It’s always raining in {town}. {count} people in this city, and I had a feeling some of them belonged to the Outfit.',
          'I lit a cigarette and looked at the faces. {count} of them. Every one had a story, and some of the stories were lies.',
        ],
        roleReveal: ['Check your cards and keep them close to the vest. In this town, everybody’s got an angle.'],
        night: [
          'Night fell on {town} like a wet coat. The neon buzzed, and somewhere a revolver clicked.',
          'The rain picked up. I locked my door and listened. This city never really sleeps.',
        ],
        kill: [
          'A flash in the rain, one shot, and then just the gutter running. I found {name} under the streetlamp.{role} {alive} left in this city.',
          'The rain washed the street clean, but it couldn’t wash away {name} under that streetlamp.{role} {alive} remain.',
        ],
        multiKill: [
          'The Outfit was busy last night. {name}, all of them under streetlamps, all of them in the rain.{role} {alive} remain.',
          'I counted {count} revolver flashes in the rain last night and {count} streetlamps this morning. {name} are gone.{role} {alive} remain.',
        ],
        saved: [
          'Somebody took a shot at {name} last night. Somebody else got there first. {name} is still breathing, and I want to know why.',
          'The Outfit came for {name}. They left empty-handed. {name} lives.',
        ],
        quiet: ['A quiet night. Just the rain. In this city, that’s almost worse.'],
        discussion: [
          'The Outfit has a man in this room. I could smell it. Start talking.',
          'Everybody’s got an alibi. Somebody’s alibi is a lie. Let’s hear them.',
        ],
        voting: ['Talk is cheap. Cast your votes.', 'Time to point fingers. Vote.'],
        votesIn: ['The votes are in. I didn’t like the look of them.'],
        eliminated: [
          'The city made its call. {name} walked out into the rain and didn’t look back.{role}',
          '{votes} votes. {name} got a one-way ticket out of {town}.{role}',
        ],
        tie: ['A tie. Nobody’s leaving tonight. The rain keeps falling.'],
        noElim: ['Nobody could agree. Nobody leaves today. That’s {town} for you.'],
        townWin: ['The last of the Outfit went down. The rain let up for the first time in years. {town} is clean, for now.'],
        mafiaWin: ['The Outfit owns {town}. Every streetlamp, every gutter, every badge. I should have left when I had the chance.'],
        jesterWin: ['The city ran {name} out of town, and {name} was grinning the whole way. Some guys just want the spotlight. The Jester wins.'],
        skWin: ['When it was over, only the Rain Killer was left walking the wet streets of {town}. I never even got a name.'],
        kill_lake: [
          '{name} stood on the pier too long. A flash in the rain, and the harbor swallowed the sound. I found them under the pier lamp.{role} {alive} remain.',
          'Fog on the harbor this morning. One flash in the rain, and I found {name} under the dock lamp.{role} {alive} remain.',
        ],
        kill_hearth: [
          '{name} warmed their hands at the barrel fire in the alley. One flash in the rain, and the fire was the only thing still moving.{role} {alive} remain.',
          'The barrel fire was still smoking when I found {name} under the streetlamp beside it.{role} {alive} remain.',
        ],
        kill_tavern: [
          '{name} was the last one out of the jazz club. A flash in the rain by the door, and the sax kept playing.{role} {alive} remain.',
          'One more drink, {name} told the bartender. I found them under the club’s streetlamp at dawn.{role} {alive} remain.',
        ],
        kill_field: [
          '{name} drove out past the city limits to meet somebody. A revolver flash in the rain, and the last streetlamp on the road lit them up.{role} {alive} remain.',
          'Beyond the last streetlamp of {town}, out where the road turns to mud, I found {name}.{role} {alive} remain.',
        ],
        kill_chase: [
          '{name} ran for home through the rain. A flash behind them, three steps from the door.{role} {alive} remain.',
          'Somebody tailed {name} home last night. The streetlamp outside their door told me the rest.{role} {alive} remain.',
        ],
        kill_visit: [
          '{name} was watching {host}’s place from across the street. A flash in the rain, and I found {name} under the streetlamp.{role} {alive} remain.',
          'I found {name} under the streetlamp below {host}’s window, notebook soaked through.{role} {alive} remain.',
        ],
      },
    },
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = { THEME_TEXT };
  else root.MT_THEME_TEXT = { THEME_TEXT };
})(typeof window !== 'undefined' ? window : globalThis);
