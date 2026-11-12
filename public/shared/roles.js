// Role registry, setup validation and presets. Shared by the server
// (require) and the browser (window.MT_ROLES).
//
// To add a role: add an entry to ROLES. Night abilities are described by
// `night.kind` and resolved generically by the engine (see game.js
// resolveNight), so most new roles need no engine changes:
//   kind: 'kill' | 'shoot' | 'heal' | 'guard' | 'block' | 'investigate'
//   targets: 'others' (anyone else alive) | 'any' (self too) | 'nonTeam' (not your team)
//   teamKill: the whole team shares one kill per night (Mafia)
//   noRepeat: can't pick the same target two nights running (Doctor)
//   optional: may choose to do nothing (Vigilante)
//   limited: settings key holding the number of uses
//   reveal: what an investigation learns: 'mafia' (Mafia yes/no) or 'killer' (dangerous yes/no)
(function (root) {
  const ROLES = {
    villager: {
      name: 'Villager', team: 'town', emoji: '🏡', color: '#f1c40f', darkText: true,
      blurb: 'No special powers, just your wits. Work with the town to find the Mafia and vote them out.',
    },
    mafia: {
      name: 'Mafia', team: 'mafia', emoji: '🔪', color: '#e74c3c', knowsTeam: true,
      night: { kind: 'kill', teamKill: true, targets: 'nonTeam' },
      blurb: 'Each night, agree with your fellow Mafia on someone to eliminate. By day, blend in. You win when the Mafia equal or outnumber everyone else.',
    },
    godfather: {
      name: 'Godfather', team: 'mafia', emoji: '🎩', color: '#9e1b1b', knowsTeam: true, appearsInnocent: true, max: 1,
      night: { kind: 'kill', teamKill: true, leader: true, targets: 'nonTeam' },
      blurb: "You lead the Mafia and break ties between leading kill targets. Alignment investigations say you're innocent, but the Sorcerer learns your exact role. Legacy mode gives your pick a full override.",
    },
    roleblocker: {
      name: 'Roleblocker', team: 'mafia', emoji: '🚫', color: '#c0392b', knowsTeam: true,
      night: { kind: 'block', targets: 'nonTeam' },
      blurb: "Each night, distract a non-Mafia player so their ability fails. Once per game at the gallows, cause a commotion that stops an execution. You also vote on the Mafia's kill; in Legacy mode you take over killing if the killers fall.",
    },
    detective: {
      name: 'Detective', team: 'town', emoji: '🔍', color: '#3aa0ff',
      night: { kind: 'investigate', reveal: 'mafia', targets: 'others' },
      blurb: 'Each night, investigate one person to learn whether they are on the Mafia’s side. The Godfather passes as innocent, but an Impostor’s cover story doesn’t fool you. Share what you learn... carefully.',
    },
    sheriff: {
      name: 'Sheriff', team: 'town', emoji: '⭐', color: '#d4a017',
      night: { kind: 'investigate', reveal: 'killedTonight', targets: 'others' },
      blurb: 'Each night, stake out one person: at dawn you learn whether they were out killing that night (the Mafia member who carried out the kill, every Mafia who voted for it, the Serial Killer, a Vigilante). A framed player looks guilty too.',
    },
    doctor: {
      name: 'Doctor', team: 'town', emoji: '💉', color: '#2ecc71',
      night: { kind: 'heal', targets: 'any', noRepeat: true },
      blurb: "Each night, protect one person from being killed. You can't protect the same person two nights in a row.",
    },
    bodyguard: {
      name: 'Bodyguard', team: 'town', emoji: '🛡️', color: '#16a085',
      night: { kind: 'guard', targets: 'others' },
      blurb: 'Each night, guard one person. If they are attacked, you take the hit and die in their place. Unlike the Doctor, you can guard the same person every night.',
    },
    vigilante: {
      name: 'Vigilante', team: 'town', emoji: '🎯', color: '#8e44ad',
      night: { kind: 'shoot', targets: 'others', optional: true, limited: 'vigilanteShots' },
      blurb: "You're on the town's side, with two bullets (the Judge can change this). At night you may shoot someone you're sure is evil. If you kill a Town member, the guilt makes you put the gun away for good.",
    },
    mayor: {
      name: 'Mayor', team: 'town', emoji: '🏛️', color: '#2980b9', voteWeight: 2,
      blurb: 'Your vote secretly counts twice. Use your influence to lead the town to the Mafia.',
    },
    telepath: {
      name: 'Telepath', team: 'town', emoji: '🔮', color: '#b07cff', pair: true,
      blurb: 'You share a psychic link with one other Telepath. Send each other coded messages from your phone. Nobody else can see them.',
    },
    jester: {
      name: 'Jester', team: 'neutral', emoji: '🃏', color: '#ff6fb5',
      blurb: 'You win if the town votes YOU out. Act just suspicious enough... but not too much.',
    },
    serialKiller: {
      name: 'Serial Killer', team: 'neutral', emoji: '🗡️', color: '#5d6d7e', nightImmune: true, max: 1,
      night: { kind: 'kill', targets: 'others' },
      blurb: "You're on nobody's side. Kill one person each night. You can't be killed at night. Win by being the last one standing.",
    },
  };

  Object.assign(ROLES, {
    investigator: { name: 'Investigator', team: 'town', emoji: '👁', color: '#59b8b1', night: { kind: 'spy', targets: 'others' }, blurb: 'Spy on one house each night. Learn how many other visitors arrived and whether someone departed. Clues describe real activity, without identities or roles.' },
    ghostwriter: { name: 'Ghostwriter', team: 'town', emoji: '✒', color: '#b9a0ef', when: 'After death, during the day', restrictions: ['One message per day; at most three approved tokens.', 'Messages publish at the next discussion or voting opening.'], blurb: 'After death, write a clue using up to three words from the fixed word bank. Your message appears at the next discussion or vote.' },
    puppetMaster: { name: 'Puppet Master', team: 'mafia', emoji: '🧵', color: '#ad4c72', knowsTeam: true, when: 'During public voting', restrictions: ['Unavailable with anonymous votes.', 'Configurable uses per game; one forced ballot per victim per phase.'], blurb: 'Secretly redirect and lock one living player’s ballot for this voting phase. Limited uses per game; public voting only.' },
    paparazzi: { name: 'Paparazzi', team: 'neutral', emoji: '📸', color: '#cfac68', night: { kind: 'photo', targets: 'others' }, blurb: 'Photograph one player each night. If they leave their house, the photo is published at dawn showing whose house they went to. Win independently by surviving until game end with the configured number of photos published (default two).' },
    conductor: { name: 'Conductor', team: 'town', emoji: '🎼', color: '#d69cdb', when: 'Discussion and voting', restrictions: ['A private objective names two living voters.', 'Default two completed objectives per blessing.'], blurb: 'Convince the two voters named in your secret objective to choose the same living target. Each completed objective adds Harmony. Enough Harmony reveals one confirmed Town player.' },
    glitch: { name: 'The Glitch', team: 'town', emoji: '⚡', color: '#6be1d2', when: 'Discussion or voting', restrictions: ['Configurable uses per game (default one).', 'Corruption lasts 30 seconds and changes presentation only.'], blurb: 'Activate CORRUPT for 30 seconds of scrambled TV names, avatars and displayed vote counts. Real ballots and results stay accurate. Wins with the Town.' },
  });

  // Order roles appear in setup screens.
  Object.assign(ROLES, {
    detonator: { name: 'Detonator', team: 'town', emoji: '💣', color: '#be865e', night: { kind: 'bomb', targets: 'others' }, restrictions: ['Standard: one bomb per game, at least three phase transitions before detonation.', 'An empty house still explodes; damage lasts until the next game.'], blurb: 'Plant a delayed explosive on a living player’s house. It detonates during a later daytime phase, killing a living owner and destroying the building. Wins with Town.' },
    silencer: { name: 'Silencer', team: 'mafia', knowsTeam: true, emoji: '🤫', color: '#805b91', night: { kind: 'silence', targets: 'others' }, blurb: 'Silence one player for the following day. They cannot vote, nominate, post or whisper digitally. Their phone clearly shows SILENCED; outside voice chat relies on the group’s rules.' },
    sorcerer: { name: 'Sorcerer', team: 'town', emoji: '🪄', color: '#789fd0', night: { kind: 'investigate', targets: 'others', reveal: 'role' }, blurb: 'Each night, read one player’s fate: you learn two roles, and one of them is theirs. It sees through the Godfather. Drunk, poison or malfunction can corrupt the information you receive.' },
    hustler: { name: 'Hustler', team: 'mafia', knowsTeam: true, emoji: '⏳', color: '#cc9f5f', night: { kind: 'hustle', targets: 'any', optional: true }, blurb: 'Once per game, rush the next daytime discussion to 40% of its normal length (minimum 15 seconds). Nomination speeches keep their own configured timers.' },
    alchemist: { name: 'Alchemist', team: 'mafia', knowsTeam: true, emoji: '⚗', color: '#6dbba4', night: { kind: 'midas', targets: 'others', optional: true }, blurb: 'Two distinct potions. Midas marks a living target: if eliminated the next day, a Mafia member inherits their supported active ability and its remaining uses. Volatile returns a dead Mafia teammate for one day, then they turn to ash permanently.' },
    // Verdict-window role: once per game, reveal yourself during an execution and
    // die in the condemned's place ("Saved by the Executioner"). The reveal is public.
    executioner: { name: 'Executioner', team: 'town', emoji: '🪓', color: '#7a1f2b', blurb: 'Once per game, during any execution, you may reveal yourself as the Executioner and give your own life in place of the condemned. Everyone will see it. Wins with Town.' },
    // The Mafia's detective: learns exact roles for the family (also votes on the Mafia kill).
    hunter: { name: 'Hunter', team: 'mafia', knowsTeam: true, emoji: '🏹', color: '#8c3b2e', night: { kind: 'investigate', reveal: 'role', targets: 'nonTeam' }, blurb: "The Mafia's detective. Each night, learn the exact role of one player outside the family; your whole team sees what you find. Your prey senses it: they wake knowing someone hunted them. You also vote on the Mafia's kill." },
    // Neutral: marks who they want dead. Every time a mark dies (night or gallows) they level up.
    headhunter: { name: 'Headhunter', team: 'neutral', emoji: '🎯', color: '#c47a1c', max: 1, night: { kind: 'mark', targets: 'others', optional: true }, blurb: 'Each night (or day), secretly mark who you want dead. Your mark appears as a fake vote on the Mafia’s night screen. Every time your mark dies, at night or at the gallows, you level up and unlock new powers. Win by being the last one standing.' },
    // ----- DLC 1 -----
    medium: { name: 'Medium', team: 'town', emoji: '🕯', color: '#9a86d8', night: { kind: 'seance', targets: 'dead' }, blurb: 'Each night, hold a séance with one fallen player: learn how they died (the Mafia, the Serial Killer, a Vigilante, the gallows...) and their exact role, even if roles stay hidden on death. You alone can hear the dead: call on up to two ghosts, and each may whisper you one word every day and every night.' },
    lookout: { name: 'Lookout', team: 'town', emoji: '👀', color: '#4fa3a0', night: { kind: 'watch', targets: 'others' }, blurb: 'Each night, watch one player’s house. At dawn you learn the names of everyone who visited it (a Mafia kill counts as the one member who carried it out).' },
    veteran: { name: 'Veteran', team: 'town', emoji: '🎖', color: '#6f7d3a', night: { kind: 'alert', targets: 'self', optional: true }, blurb: 'Twice per game, go on alert for the night: attacks on you fail, and anyone who visits you that night dies. Careful: friends visit too.' },
    trapper: { name: 'Trapper', team: 'town', emoji: '🪤', color: '#8a6a3c', night: { kind: 'trap', targets: 'others', optional: true }, blurb: 'Set a trap at another player’s house. It takes one night to set, then stays there until it catches someone: the first attack on that house fails and you learn the attacker’s name. Moving the trap starts over.' },
    cupid: { name: 'Cupid', team: 'town', emoji: '💘', color: '#e86a9a', night: { kind: 'link', targets: 'others', optional: true }, blurb: 'Once per game, bind yourself to another player. You both learn of the bond. If either of you dies, the other dies of a broken heart.' },
    eavesdropper: { name: 'Eavesdropper', team: 'town', emoji: '👂', color: '#5d8fb8', when: 'All game (passive)', blurb: 'You overhear the Mafia’s coordination messages every night, but never who said them.' },
    crier: { name: 'Town Crier', team: 'town', emoji: '📯', color: '#c98f2e', when: 'Once a day, during discussion', blurb: 'Once a day, make an anonymous proclamation on the big screen about one player: SAFE, SUSPICIOUS, LYING, HONEST or IN DANGER.' },
    framer: { name: 'Framer', team: 'mafia', knowsTeam: true, emoji: '🖼', color: '#a3443a', night: { kind: 'frame', targets: 'nonTeam' }, blurb: 'Each night, frame one player: tonight, every investigation sees them as Mafia. You also vote on the Mafia’s kill.' },
    janitor: { name: 'Janitor', team: 'mafia', knowsTeam: true, emoji: '🧹', color: '#6e5a4a', night: { kind: 'clean', targets: 'nonTeam', optional: true }, blurb: 'Once per game, clean up after a kill: if your target dies tonight, their role stays hidden from the town, and only you learn it.' },
    impostor: { name: 'Impostor', team: 'mafia', knowsTeam: true, emoji: '🎭', color: '#8d3d6e', when: 'All game (passive)', blurb: 'You hide behind a Town role chosen at the start: role readings (Sorcerer, Hunter, Medium) show your cover story. A Detective still sees you as Mafia, and a Crafter’s pickaxe sees the truth. You also vote on the Mafia’s kill.' },
    crafter: { name: 'Crafter', team: 'town', emoji: '🔨', color: '#b07a3a', night: { kind: 'craft', targets: 'others', optional: true }, when: 'Search each night and once a day; craft any time', blurb: 'Search for one material each night and once each day, then craft tools from your recipe book: a Pickaxe (break a window: learn a role), a Lantern (see your visitors), a Magnifying Glass (see every visit tonight) or a Sword (strike someone down during the day).' },
    storymaker: { name: 'Storymaker', team: 'town', emoji: '📜', color: '#e3bf80', night: { kind: 'interrupt', targets: 'any', optional: true }, blurb: 'Once per game, interrupt the night with a town crier and an emergency vote. After the verdict, resume the interrupted night with its still-valid actions and remaining time. Wins with Town.' },
  });
  // Headhunter levels: the Nth correct mark (the marked player died) unlocks level N.
  const HEADHUNTER_LEVELS = [
    { level: 0, power: null, title: 'Hidden', text: 'Investigations see you as a plain Villager. Mark someone you want dead.' },
    { level: 1, power: 'disguise', title: 'Disguise', text: 'Choose a fake role: investigations see that role instead of yours.' },
    { level: 2, power: 'puppet', title: 'Puppet', text: 'Once a night, force one Mafia member’s kill vote onto a target of your choice.' },
    { level: 3, power: 'strike', title: 'Strike', text: 'Once per game, kill someone on the spot, at night or during the day.' },
    { level: 4, power: 'reveal', title: 'Insight', text: 'Once a night, learn one player’s exact role.' },
    { level: 5, power: 'allSight', title: 'All-seeing', text: 'You know everyone’s role.' },
    { level: 6, power: 'execute', title: 'Executioner', text: 'Once a day, execute anyone during discussion or voting.' },
  ];
  const ROLE_ORDER = ['mafia', 'godfather', 'roleblocker', 'hunter', 'puppetMaster', 'silencer', 'hustler', 'alchemist', 'detective', 'sheriff', 'sorcerer', 'investigator', 'doctor', 'bodyguard', 'executioner', 'vigilante', 'detonator', 'storymaker', 'crafter', 'mayor', 'telepath', 'ghostwriter', 'conductor', 'glitch', 'paparazzi', 'jester', 'serialKiller', 'headhunter', 'framer', 'janitor', 'impostor', 'medium', 'lookout', 'veteran', 'trapper', 'cupid', 'eavesdropper', 'crier', 'villager'];
  // Role packs: how the Judge console groups roles (Core, Expansion, DLC 1).
  const ROLE_PACKS = {
    core: { label: 'Core', roles: ['mafia', 'godfather', 'roleblocker', 'detective', 'sheriff', 'doctor', 'bodyguard', 'vigilante', 'mayor', 'telepath', 'jester', 'serialKiller', 'executioner'] },
    expansion: { label: 'Expansion', roles: ['crafter', 'hunter', 'puppetMaster', 'silencer', 'hustler', 'alchemist', 'sorcerer', 'investigator', 'detonator', 'storymaker', 'ghostwriter', 'conductor', 'glitch', 'paparazzi', 'headhunter'] },
    dlc1: { label: 'DLC 1', roles: ['framer', 'janitor', 'impostor', 'medium', 'lookout', 'veteran', 'trapper', 'cupid', 'eavesdropper', 'crier'] },
  };
  const GHOST_WORDS = ['IS', 'NOT', 'LIAR', 'TRUST', 'WATCH', 'DANGER', 'SAFE', 'MAYBE', 'TOGETHER', 'ALONE'];

  const TEAMS = {
    town: { name: 'Town', color: '#3aa0ff', emoji: '🏡' },
    mafia: { name: 'Mafia', color: '#e74c3c', emoji: '🔪' },
    neutral: { name: 'Neutral', color: '#a0a0b0', emoji: '🎭' },
  };

  // Winners: a faction id, or a neutral role that can win on its own.
  const WINNERS = {
    town: { name: 'The Town', emoji: '🎉' },
    mafia: { name: 'The Mafia', emoji: '🔪' },
    serialKiller: { name: 'The Serial Killer', emoji: '🗡️' },
    jester: { name: 'The Jester', emoji: '🃏' },
    headhunter: { name: 'The Headhunter', emoji: '🎯' },
    draw: { name: 'Nobody', emoji: '🤝' },
  };

  // Coded Telepath messages. {player} is filled with a chosen name.
  const TELEPATH_MESSAGES = [
    { id: 'suspect', text: 'I suspect {player}.', player: true, sus: 30 },
    { id: 'trust', text: 'I trust {player}.', player: true, sus: -30 },
    { id: 'investigate', text: 'Investigate {player}.', player: true, sus: 10 },
    { id: 'protect', text: 'Protect {player}.', player: true, sus: -15 },
    { id: 'vote', text: "Let's vote for {player}.", player: true, sus: 25 },
    { id: 'danger', text: "I'm in danger." },
    { id: 'agree', text: 'Agreed.' },
    { id: 'quiet', text: 'Stay quiet for now.' },
    { id: 'ignore', text: 'Do not trust my last message.' },
  ];

  const isMafiaTeam = (role) => !!ROLES[role] && ROLES[role].team === 'mafia';
  const isKillerRole = (role) => !!ROLES[role] && !!ROLES[role].night && ROLES[role].night.kind === 'kill';
  // What an investigation sees.
  function investigate(role, reveal) {
    const r = ROLES[role];
    if (!r || r.appearsInnocent) return false;
    if (reveal === 'killer') return r.team === 'mafia' || role === 'serialKiller' || role === 'headhunter';
    return r.team === 'mafia';
  }

  function autoMafiaCount(n) {
    return Math.min(Math.max(1, Math.floor((n - 1) / 3)), Math.max(1, Math.round(n / 4.5)));
  }

  // Turns settings + player count into a concrete role list (unshuffled),
  // with errors that would break the game and warnings about balance.
  function buildRoleList(settings, n) {
    const counts = Object.assign({}, settings.roleCounts || {});
    const errors = [];
    const warnings = [];
    const forced = settings.forcedRoles || {};
    if (settings.anonymousVotes && counts.puppetMaster > 0) errors.push('Puppet Master requires public voting. Turn off anonymous votes or remove this role.');
    for (const k of Object.keys(counts)) {
      if (!ROLES[k] || k === 'villager') { delete counts[k]; continue; }
      counts[k] = Math.max(0, Math.min(100, parseInt(counts[k], 10) || 0));
      if (ROLES[k].max && counts[k] > ROLES[k].max) { counts[k] = ROLES[k].max; warnings.push(`Only one ${ROLES[k].name} allowed.`); }
    }
    if (counts.telepath && counts.telepath !== 2) { counts.telepath = 2; warnings.push('Telepaths come in pairs (always 2).'); }
    const autoMafia = settings.autoMafia !== false;
    if (autoMafia) {
      const otherMafia = ROLE_ORDER.filter((k) => k !== 'mafia' && isMafiaTeam(k)).reduce((s, k) => s + (counts[k] || 0), 0);
      counts.mafia = Math.max(counts.godfather ? 0 : 1, autoMafiaCount(n) - otherMafia);
    }
    const list = [];
    for (const k of ROLE_ORDER) for (let i = 0; i < (counts[k] || 0); i++) list.push(k);
    if (list.length > n) errors.push(`${list.length} special roles but only ${n} players. Remove some roles or add players.`);
    while (list.length < n) list.push('villager');

    const mafiaTeam = list.filter(isMafiaTeam).length;
    const killers = list.filter((r) => isMafiaTeam(r) && isKillerRole(r)).length;
    const neutralKillers = list.filter((r) => r === 'serialKiller').length;
    const town = list.filter((r) => ROLES[r].team === 'town').length;
    if (mafiaTeam && !killers) errors.push('The Mafia need a Mafia member or a Godfather to do the killing.');
    if (!mafiaTeam && !neutralKillers) errors.push('There are no killers! Add at least one Mafia member or a Serial Killer.');
    if (mafiaTeam >= n - mafiaTeam) errors.push('The Mafia would win immediately. Lower the Mafia count.');
    if (town < 1) errors.push('Someone has to be on the town\'s side.');
    if (!errors.length && mafiaTeam > n / 3) warnings.push('That is a lot of Mafia for this many players. The town will struggle.');
    if (!errors.length && n >= 7 && !list.some((r) => ['detective', 'sheriff'].includes(r))) warnings.push('No investigator: the town has very little information.');
    const forcedCounts = {};
    for (const role of Object.values(forced)) {
      if (!ROLES[role]) errors.push(`Unknown forced role "${role}".`);
      else forcedCounts[role] = (forcedCounts[role] || 0) + 1;
    }
    for (const [role, c] of Object.entries(forcedCounts)) {
      const avail = list.filter((r) => r === role).length;
      if (c > avail) errors.push(`${c} players are forced to be ${ROLES[role].name}, but the setup only has ${avail}.`);
    }
    return { roles: list, errors, warnings, autoMafia };
  }

  // Built-in setups. They use an automatic Mafia count (autoMafia).
  const PRESETS = {
    storytellerV2: { label:'Storyteller (16+)', desc:'Optional statuses, bluffs, ghosts, whispers and structured nominations. Recommended for experienced groups.', settings:{ autoMafia:true, storytellerMode:'human', misinformation:'judge', mafiaBluffs:3, ghostVotes:true, ghostChat:true, whispers:true, votingMode:'nomination', roleCounts:{ godfather:1,silencer:1,alchemist:1,sorcerer:1,doctor:1,investigator:1,storymaker:1,ghostwriter:1 }, roleConfig:{ sorcerer:{ mode:'custom',startingInfo:'townTrio' } } } },
    cinematicChaos: { label:'Cinematic Chaos (18+)', desc:'Delayed explosives, borrowed abilities, a shortened clock and emergency votes.', settings:{ autoMafia:true, ghostVotes:true, ghostChat:true, whispers:true, votingMode:'classic', roleCounts:{ godfather:1,silencer:1,hustler:1,alchemist:1,detonator:1,sorcerer:1,doctor:1,storymaker:1,jester:1 }, roleConfig:{ jester:{ mode:'custom',behavior:'hybrid' } } } },
    storytellers: { label: 'Storytellers (14+)', desc: 'Investigator, Ghostwriter, Puppet Master, Paparazzi, Conductor and Glitch.', settings: { autoMafia: true, anonymousVotes: false, roleCounts: { puppetMaster: 1, detective: 1, investigator: 1, doctor: 1, ghostwriter: 1, paparazzi: 1, conductor: 1, glitch: 1 } } },
    classic: { label: 'Classic', desc: 'Mafia, Detective, Doctor, Villagers.', settings: { autoMafia: true, roleCounts: { detective: 1, doctor: 1 } } },
    beginner: { label: 'First timers', desc: 'Just Mafia and Villagers plus a Detective. Longer discussion.', settings: { autoMafia: true, roleCounts: { detective: 1 }, discussionSeconds: 180 } },
    expanded: { label: 'Town vs Family', desc: 'Godfather and Roleblocker against a stacked town.', settings: { autoMafia: true, roleCounts: { godfather: 1, roleblocker: 1, detective: 1, doctor: 1, bodyguard: 1, vigilante: 1, mayor: 1 } } },
    chaos: { label: 'Chaos', desc: 'Jester, Serial Killer, Telepaths, everything.', settings: { autoMafia: true, roleCounts: { godfather: 1, detective: 1, doctor: 1, vigilante: 1, telepath: 2, jester: 1, serialKiller: 1 } } },
    bigParty: { label: 'Big party (30+)', desc: 'Scaled for large groups.', settings: { autoMafia: true, roleCounts: { godfather: 1, roleblocker: 1, detective: 2, sheriff: 1, doctor: 2, bodyguard: 1, vigilante: 1, mayor: 1, telepath: 2, jester: 1 }, discussionSeconds: 180, votingSeconds: 60 } },
  };

  // Judge reference card for a role, generated from the registry so it never
  // drifts from the real rules.
  const WHEN = { kill: 'Every night', shoot: 'At night, while bullets last', heal: 'Every night', guard: 'Every night', block: 'Every night', investigate: 'Every night' };
  const TARGETS = { others: 'anyone but themselves', any: 'anyone, including themselves', nonTeam: 'anyone outside their team' };
  function reference(key) {
    const r = ROLES[key];
    if (!r) return null;
    const n = r.night;
    const restrictions = [];
    restrictions.push(...(r.restrictions || []));
    if (n) restrictions.push(`Targets ${TARGETS[n.targets] || 'one player'}.`);
    if (n && n.teamKill) restrictions.push('The Mafia team shares one kill per night.');
    if (n && n.leader) restrictions.push('Breaks tied leading Mafia targets by default. Legacy mode allows a full override.');
    if (n && n.noRepeat) restrictions.push("Can't pick the same person two nights in a row.");
    if (n && n.optional) restrictions.push(key === 'trapper' ? 'May leave the trap where it is.' : 'May hold fire.');
    if (n && n.limited) restrictions.push(`Limited uses (setting: ${n.limited}).`);
    if (r.appearsInnocent) restrictions.push('Looks innocent to the Detective. The Sorcerer’s reading still includes the true role, and the Sheriff catches them if they kill.');
    if (r.nightImmune) restrictions.push("Can't be killed at night.");
    if (r.voteWeight > 1) restrictions.push(`Their vote counts ${r.voteWeight}× (secretly).`);
    if (r.pair) restrictions.push('Always comes as a pair.');
    if (key === 'roleblocker') restrictions.push('Takes over the killing if all Mafia killers die.');
    if (key === 'headhunter') restrictions.push('Levels up each time a marked player dies. Powers: 1 disguise · 2 puppet a Mafia vote · 3 one strike · 4 nightly role reveal · 5 sees all roles · 6 daily execution.');
    if (key === 'hunter') restrictions.push('Results are shared with the whole Mafia team.');
    if (key === 'bodyguard') restrictions.push('Dies in place of the person they guard (unless the Doctor saved the Bodyguard).');
    const win = key === 'paparazzi' ? 'Survive to game end and publish the configured number of photos (default two). May win alongside any faction.' : key === 'jester' ? 'Wins if the town votes them out.'
      : key === 'serialKiller' || key === 'headhunter' ? 'Wins by being the last one standing.'
        : r.team === 'mafia' ? 'Wins with the Mafia: when they equal the rest (or everyone else is gone, by setting).'
          : 'Wins with the Town: when no Mafia or Serial Killer is left.';
    return {
      key, name: r.name, emoji: r.emoji, color: r.color, team: r.team,
      teamName: (TEAMS[r.team] && TEAMS[r.team].name) || r.team,
      when: r.when || (n ? WHEN[n.kind] || 'Every night' : key === 'telepath' ? 'Any time the Judge allows' : 'Passive'),
      ability: r.blurb, restrictions, win,
    };
  }

  const API = { ROLE_PACKS, HEADHUNTER_LEVELS, ROLES, ROLE_ORDER, TEAMS, WINNERS, TELEPATH_MESSAGES, GHOST_WORDS, PRESETS, isMafiaTeam, isKillerRole, investigate, autoMafiaCount, buildRoleList, reference };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.MT_ROLES = API;
})(typeof window !== 'undefined' ? window : globalThis);
