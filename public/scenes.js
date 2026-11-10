// Scene data for the cinematic engine (cinema.js). Each scene is a timeline
// of [seconds, action, args, condition?]. Outcome branches are appended to
// the shared steps. Text can use {name} (the resident), {title} and {sub}.
//
// Secrecy: scenes only ever show public facts. Attackers are hooded figures,
// protectors are anonymous, and Doctor saves and night immunity look the same.
(function () {
  // Sneak up to the house in the town, then cut inside the bedroom.
  const APPROACH = [
    [0, 'letterbox', true],
    [0, 'dark', 1],
    [0, 'music', 'tension'],
    [0, 'camera', { to: 'house', zoom: 2.4, dur: 1.6 }],
    [0.4, 'spawn', { id: 'assassin', kind: 'assassin', at: 'street', crouch: true, fadeIn: 0.7 }],
    [0.6, 'move', { id: 'assassin', to: 'doorSide', dur: 2.5, gait: 'sneak', crouch: true }],
    [1.2, 'loop', { sfx: 'heartbeat', every: 0.85, until: 7.4 }],
    [2.4, 'sfx', 'owl'],
    [3.15, 'sfx', 'click'],
  ];
  const ENTER = [
    [3.45, 'fade', { to: 1, dur: 0.4 }],
    [3.9, 'stage', 'interior'],
    [3.9, 'lamp', false],
    [3.9, 'spawn', { id: 'victim', kind: 'resident', at: 'bed', pose: 'sleep' }],
    [3.9, 'spawn', { id: 'assassin', kind: 'assassin', at: 'offLeft', crouch: true, alpha: 0, facing: 1 }],
    [3.95, 'fade', { to: 0, dur: 0.5 }],
    [4.1, 'bubble', { id: 'victim', text: 'z z z', dur: 1.6 }],
    [4.3, 'door', { to: 1, dur: 1.1 }],
    [4.3, 'sfx', 'creak'],
    [4.7, 'alpha', { id: 'assassin', to: 1, dur: 0.4 }],
    [4.7, 'move', { id: 'assassin', to: 'mid', dur: 1.2, gait: 'sneak', crouch: true }],
    [5.9, 'move', { id: 'assassin', to: 'bedside', dur: 0.8, gait: 'sneak', crouch: true }],
    [6.35, 'sfx', 'creak'],
    [6.6, 'bubble', { id: 'victim', text: '!', dur: 1 }],
    [6.6, 'sfx', 'gasp'],
    [6.7, 'pose', { id: 'victim', pose: 'stand' }],
    [6.7, 'move', { id: 'victim', to: 'standBed', dur: 0.3, gait: 'run' }],
    [6.75, 'lamp', true],
    [6.9, 'face', { id: 'victim', dir: 'left' }],
    [6.9, 'scared', { id: 'victim' }],
    [6.95, 'thunder'],
    [7.0, 'flicker', { dur: 0.8 }],
    [7.0, 'pose', { id: 'assassin', pose: 'stand', crouch: false }],
  ];
  // Fade out, show a title card, and come back to the town.
  const ENDING = (title, sub, color, t = 10.4, mood) => [
    [t, 'fade', { to: 0.88, dur: 0.9 }],
    [t + 0.9, 'stage', 'town'],
    [t + 0.9, 'camera', { to: 'overview', dur: 0.01 }],
    [t + 1.0, 'title', { text: title, sub, color, dur: 2.6 }],
    ...(mood ? [[t + 0.9, 'music', mood]] : []),
    [t + 3.4, 'fade', { to: 0, dur: 0.6 }],
    [t + 3.4, 'letterbox', false],
  ];

  const SCENES = {
    murder: {
      name: 'Murder',
      kind: 'night',
      needsHouse: true,
      steps: APPROACH,
      defaultOutcome: 'kill',
      outcomes: {
        kill: {
          name: 'Killed',
          duration: 14.2,
          steps: [
            ...ENTER,
            [7.3, 'move', { id: 'assassin', to: 'strike', dur: 0.4, gait: 'run' }],
            [7.75, 'attack', { id: 'assassin', target: 'victim' }],
            [8.1, 'hit', { id: 'victim', dir: 1 }],
            [8.2, 'die', { id: 'victim' }],
            [8.3, 'sfx', 'sting'],
            [8.35, 'lamp', false],
            [8.35, 'flicker', { dur: 0.5 }],
            [8.6, 'music', 'eerie'],
            [9.2, 'move', { id: 'assassin', to: 'doorway', dur: 1.4, gait: 'walk' }],
            [9.9, 'alpha', { id: 'assassin', to: 0, dur: 0.5 }],
            ...ENDING('{name} did not survive the night', '', '#ff6b6b', 10.4),
          ],
        },
        protected: {
          name: 'Protected (save or immune)',
          duration: 14.6,
          steps: [
            ...ENTER,
            [7.3, 'move', { id: 'assassin', to: 'strike', dur: 0.4, gait: 'run' }],
            [7.75, 'attack', { id: 'assassin', target: 'victim', blocked: true }],
            [8.05, 'shield', { id: 'victim', dur: 2.2 }],
            [8.15, 'shake', 0.5],
            [8.2, 'move', { id: 'assassin', to: { from: 'strike', dx: -110 }, dur: 0.3, gait: 'run' }],
            [8.6, 'bubble', { id: 'assassin', text: '?!', dur: 1 }],
            [9.2, 'move', { id: 'assassin', to: 'underWindow', dur: 0.6, gait: 'run' }],
            [9.8, 'shards'],
            [9.8, 'move', { id: 'assassin', to: 'outWindow', dur: 0.35, gait: 'run', fadeOut: true }],
            [10.1, 'thunder'],
            [10.3, 'bubble', { id: 'victim', text: 'Phew…', dur: 1.2 }],
            [10.3, 'music', 'peace'],
            ...ENDING('An attack was stopped', '{name} survived the night', '#7dffb0', 10.8),
          ],
        },
        guard: {
          name: 'Bodyguard blocks',
          duration: 14.6,
          steps: [
            ...ENTER,
            [7.25, 'spawn', { id: 'guard', kind: 'protector', at: 'doorway', facing: 1 }],
            [7.25, 'sfx', 'creak'],
            [7.3, 'move', { id: 'guard', to: 'guardSpot', dur: 0.45, gait: 'run' }],
            [7.8, 'pose', { id: 'guard', pose: 'guard' }],
            [7.8, 'face', { id: 'guard', dir: 'left' }],
            [7.9, 'attack', { id: 'assassin', target: 'guard', blocked: true }],
            [8.2, 'shake', 0.6],
            [8.2, 'sfx', 'hit'],
            [8.3, 'move', { id: 'assassin', to: { from: 'bedside', dx: -90 }, dur: 0.3, gait: 'run' }],
            [8.7, 'bubble', { id: 'assassin', text: '!?', dur: 0.9 }],
            [9.3, 'move', { id: 'assassin', to: 'doorway', dur: 0.8, gait: 'run', fadeOut: true }],
            [9.9, 'bubble', { id: 'guard', text: 'Not tonight.', dur: 1.4 }],
            [10.0, 'music', 'peace'],
            ...ENDING('A protector stepped in', '{name} survived the night', '#7dffb0', 10.8),
          ],
        },
        guardDies: {
          name: 'Bodyguard dies',
          duration: 14.6,
          steps: [
            ...ENTER,
            [7.25, 'spawn', { id: 'guard', kind: 'protector', at: 'doorway', facing: 1 }],
            [7.25, 'sfx', 'creak'],
            [7.3, 'move', { id: 'guard', to: 'guardSpot', dur: 0.45, gait: 'run' }],
            [7.8, 'pose', { id: 'guard', pose: 'guard' }],
            [7.8, 'face', { id: 'guard', dir: 'left' }],
            [7.9, 'attack', { id: 'assassin', target: 'guard' }],
            [8.25, 'hit', { id: 'guard', dir: 1 }],
            [8.35, 'die', { id: 'guard' }],
            [8.45, 'sfx', 'sting'],
            [8.5, 'flicker', { dur: 0.6 }],
            [9.0, 'move', { id: 'assassin', to: 'doorway', dur: 1.0, gait: 'run', fadeOut: true }],
            [9.6, 'bubble', { id: 'victim', text: 'No…', dur: 1.3 }],
            [9.8, 'music', 'eerie'],
            ...ENDING('A protector gave their life', '{name} survived the night', '#ffd36b', 10.8),
          ],
        },
        // Judge-only: an attack that never happened (roleblocked). Stays outside.
        blocked: {
          name: 'Attack never came (Judge only)',
          duration: 9.8,
          steps: [
            [3.3, 'sfx', 'knock'],
            [3.6, 'houseLight', true],
            [3.7, 'pose', { id: 'assassin', pose: 'stand', crouch: false }],
            [3.8, 'bubble', { id: 'assassin', text: '…', dur: 1 }],
            [4.6, 'move', { id: 'assassin', to: 'street', dur: 1.2, gait: 'run', fadeOut: true }],
            [5.2, 'houseLight', false],
            [5.4, 'music', 'eerie'],
            [5.6, 'title', { text: 'Something stopped them…', sub: '', color: '#cdbfff', dur: 2.8 }],
            [8.4, 'letterbox', false],
          ],
        },
      },
    },

    quietNight: {
      name: 'Quiet night',
      kind: 'night',
      duration: 7.4,
      steps: [
        [0, 'letterbox', true],
        [0, 'dark', 1],
        [0, 'music', 'peace'],
        [0, 'fog', true],
        [0, 'camera', { to: 'house', zoom: 1.7, dur: 2.6 }],
        [1.0, 'sfx', 'owl'],
        [2.6, 'camera', { to: 'square', zoom: 1.5, dur: 3 }],
        [2.8, 'title', { text: 'A quiet night…', sub: 'No one was attacked', color: '#bcd0ff', dur: 3.4 }],
        [3.9, 'sfx', 'owl'],
        [5.6, 'fog', false],
        [6.2, 'letterbox', false],
      ],
    },

    execution: {
      name: 'Execution',
      kind: 'day',
      duration: 10.4,
      steps: [
        [0, 'letterbox', true],
        [0, 'music', 'tension'],
        [0, 'camera', { to: 'square', zoom: 2.0, dur: 1.5 }],
        [0.3, 'crowd', { count: 5, lines: ['Guilty!', 'No way…', 'Hmm…', 'Do it!', 'Wait!', 'Sorry…'], dur: 1.8 }],
        [0.6, 'walkResident', { to: 'fountain' }],
        [1.0, 'sfx', 'drum'],
        [2.6, 'bubble', { id: 'victim', text: '…', dur: 1.4 }],
        [3.4, 'camera', { to: 'fountain', dx: 0, dy: -30, zoom: 2.8, dur: 1.4 }],
        [4.2, 'loop', { sfx: 'heartbeat', every: 0.6, until: 5.6 }],
        [5.8, 'sfx', 'sting'],
        [5.8, 'flash', { a: 0.8 }],
        [5.8, 'execute'],
        [5.9, 'shake', 0.6],
        [6.1, 'music', 'eerie'],
        [6.4, 'title', { text: '{name} has been eliminated', sub: '{sub}', color: '#ffd36b', dur: 3.2 }],
        [8.6, 'camera', { to: 'overview', dur: 1.4 }],
        [9.6, 'letterbox', false],
      ],
    },

    victory: {
      name: 'Victory',
      kind: 'day',
      duration: 7,
      steps: [
        [0, 'letterbox', true],
        [0, 'music', '{mood}'],
        [0, 'camera', { to: 'square', zoom: 1.5, dur: 1.8 }],
        [0.4, 'confetti', 140, { when: 'cheer' }],
        [0.8, 'title', { text: '{title}', sub: '{sub}', color: '#ffe066', dur: 5 }],
        [2.0, 'confetti', 140, { when: 'cheer' }],
        [5.6, 'camera', { to: 'overview', dur: 1.3 }],
        [6.4, 'letterbox', false],
      ],
    },

    // ---------- manual (Judge) scenes: never touch the game ----------
    investigation: {
      name: 'Investigation',
      kind: 'manual',
      needsHouse: true,
      duration: 9,
      steps: [
        [0, 'letterbox', true],
        [0, 'music', 'tension'],
        [0, 'camera', { to: 'house', zoom: 2.4, dur: 1.5 }],
        [0.5, 'spawn', { id: 'det', kind: 'detective', at: 'street', fadeIn: 0.5 }],
        [0.7, 'move', { id: 'det', to: 'window', dur: 2.2, gait: 'sneak' }],
        [3.0, 'pose', { id: 'det', pose: 'peek' }],
        [3.1, 'glint', { id: 'det' }],
        [3.3, 'bubble', { id: 'det', text: 'Hmm…', dur: 1.6 }],
        [4.6, 'glint', { id: 'det' }],
        [5.0, 'bubble', { id: 'det', text: '!', dur: 1 }],
        [5.6, 'pose', { id: 'det', pose: 'stand' }],
        [5.8, 'move', { id: 'det', to: 'away', dur: 2.2, gait: 'walk', fadeOut: true }],
        [6.2, 'title', { text: 'Someone is asking questions…', sub: '', color: '#ffe8a8', dur: 2.4 }],
        [8.4, 'letterbox', false],
      ],
    },
    watcher: {
      name: 'Watcher outside',
      kind: 'manual',
      needsHouse: true,
      duration: 8,
      steps: [
        [0, 'letterbox', true],
        [0, 'music', 'ominous'],
        [0, 'camera', { to: 'house', zoom: 2.2, dur: 1.6 }],
        [0.6, 'spawn', { id: 'w', kind: 'assassin', at: 'nearStreet', alpha: 0, armed: false }],
        [0.8, 'alpha', { id: 'w', to: 1, dur: 1.4 }],
        [1.0, 'loop', { sfx: 'heartbeat', every: 1, until: 5.5 }],
        [3.0, 'houseLight', true],
        [3.6, 'eyes', { id: 'w', on: false }],
        [3.7, 'alpha', { id: 'w', to: 0, dur: 0.4 }],
        [4.4, 'title', { text: 'Someone is watching…', sub: '', color: '#cdbfff', dur: 2.6 }],
        [6.8, 'houseLight', false],
        [7.4, 'letterbox', false],
      ],
    },
    peek: {
      name: 'Peeking',
      kind: 'manual',
      needsHouse: true,
      duration: 6.5,
      steps: [
        [0, 'letterbox', true],
        [0, 'camera', { to: 'house', zoom: 2.6, dur: 1.4 }],
        [1.2, 'spawn', { id: 'p', kind: 'figure', at: 'doorSide', alpha: 0 }],
        [1.4, 'alpha', { id: 'p', to: 1, dur: 0.3 }],
        [1.6, 'sfx', 'creak'],
        [2.6, 'bubble', { id: 'p', text: '👀', dur: 1.2 }],
        [3.8, 'alpha', { id: 'p', to: 0, dur: 0.3 }],
        [4.0, 'sfx', 'whoosh'],
        [5.9, 'letterbox', false],
      ],
    },
    flee: {
      name: 'Fleeing',
      kind: 'manual',
      needsHouse: true,
      duration: 6.5,
      steps: [
        [0, 'letterbox', true],
        [0, 'music', 'tension'],
        [0, 'camera', { to: 'house', zoom: 2.2, dur: 1.2 }],
        [1.2, 'sfx', 'creak'],
        [1.3, 'spawn', { id: 'f', kind: 'figure', at: 'door' }],
        [1.4, 'move', { id: 'f', to: 'awayFar', dur: 2.4, gait: 'run' }],
        [1.4, 'loop', { sfx: 'step', every: 0.22, until: 3.6 }],
        [2.0, 'camera', { to: 'street', zoom: 1.6, dur: 2 }],
        [5.9, 'letterbox', false],
      ],
    },
    visitor: {
      name: 'Night visitor',
      kind: 'manual',
      needsHouse: true,
      duration: 8,
      steps: [
        [0, 'letterbox', true],
        [0, 'camera', { to: 'house', zoom: 2.4, dur: 1.4 }],
        [0.4, 'spawn', { id: 'v', kind: 'figure', at: 'street', fadeIn: 0.5 }],
        [0.6, 'move', { id: 'v', to: 'doorSide', dur: 2, gait: 'walk' }],
        [2.8, 'knock'],
        [3.6, 'knock'],
        [4.0, 'houseLight', true],
        [4.6, 'bubble', { id: 'v', text: "It's me.", dur: 1.4 }],
        [6.0, 'move', { id: 'v', to: 'door', dur: 0.5, gait: 'walk', fadeOut: true }],
        [6.8, 'houseLight', false],
        [7.4, 'letterbox', false],
      ],
    },
    emptyHouse: {
      name: 'Empty house',
      kind: 'manual',
      needsHouse: true,
      duration: 8,
      steps: [
        [0, 'letterbox', true],
        [0, 'music', 'eerie'],
        [0, 'camera', { to: 'house', zoom: 2.6, dur: 1.6 }],
        [1.6, 'fade', { to: 1, dur: 0.4 }],
        [2.0, 'stage', 'interior'],
        [2.0, 'door', { to: 0.4, dur: 0.01 }],
        [2.05, 'fade', { to: 0, dur: 0.6 }],
        [2.4, 'sfx', 'wind'],
        [3.4, 'thunder'],
        [3.6, 'title', { text: 'No one is home…', sub: '', color: '#cdbfff', dur: 2.6 }],
        [6.0, 'fade', { to: 1, dur: 0.5 }],
        [6.5, 'stage', 'town'],
        [6.5, 'camera', { to: 'overview', dur: 0.01 }],
        [6.6, 'fade', { to: 0, dur: 0.6 }],
        [7.2, 'letterbox', false],
      ],
    },
    graveyard: {
      name: 'Graveyard',
      kind: 'manual',
      duration: 8,
      steps: [
        [0, 'letterbox', true],
        [0, 'music', 'eerie'],
        [0, 'fog', true],
        [0, 'camera', { to: 'cemetery', dur: 2 }],
        [1.0, 'sfx', 'wind'],
        [2.5, 'sfx', 'bell'],
        [6.4, 'fog', false],
        [7.2, 'letterbox', false],
      ],
    },
    square: {
      name: 'Town square',
      kind: 'manual',
      duration: 6,
      steps: [
        [0, 'camera', { to: 'square', dur: 1.8 }],
        [0.2, 'sfx', 'bell'],
      ],
    },
  };

  // Extra storytelling variants. Automatic public cues still conceal immunity
  // and use the existing protected outcome, preserving the reveal rules.
  SCENES.murder.outcomes.failed = { name: 'Failed attack', duration: 13.6, steps: [
    ...ENTER, [7.3, 'move', { id: 'assassin', to: 'strike', dur: 0.4, gait: 'run' }],
    [7.8, 'attack', { id: 'assassin', target: 'victim', blocked: true }],
    [8, 'move', { id: 'victim', to: 'corner', dur: 0.3, gait: 'run' }],
    [8.3, 'bubble', { id: 'assassin', text: '?!', dur: 1 }],
    [8.8, 'move', { id: 'assassin', to: 'doorway', dur: 0.6, gait: 'run', fadeOut: true }],
    ...ENDING('The attack failed', '{name} survived the night', '#b1f0ba', 9.8, 'peace'),
  ] };
  SCENES.murder.outcomes.multiple = { name: 'Multiple masked attackers', duration: 14.2, steps: [
    ...SCENES.murder.outcomes.kill.steps,
    [1, 'spawn', { id: 'second', kind: 'assassin', at: 'street', fadeIn: 0.5 }],
    [1.3, 'move', { id: 'second', to: 'door', dur: 2, gait: 'sneak' }],
    [4.6, 'spawn', { id: 'second', kind: 'assassin', at: 'doorway', fadeIn: 0.4 }],
    [4.9, 'move', { id: 'second', to: 'mid', dur: 1.4, gait: 'sneak' }],
    [7.4, 'move', { id: 'second', to: 'bedside', dur: 0.4, gait: 'run' }],
    [8, 'attack', { id: 'second', target: 'victim' }],
    [9, 'move', { id: 'second', to: 'doorway', dur: 1, gait: 'run', fadeOut: true }],
  ] };

  // Update 4 (AI narrator only): night deaths away from the bedroom. Same secrecy
  // as the murder scene: a hooded attacker, never a player avatar. The victim is
  // held in town and replaced by a stand-in resident at the story location.
  const OUTDOOR = ({ name, place, title, color, music = 'tension', intro = [], death = [[5.9, 'die', { id: 'victim' }]], extra = [] }) => ({
    name, kind: 'night', place, needsHouse: true, duration: 13.8,
    steps: [
      [0, 'letterbox', true], [0, 'dark', 1], [0, 'hold'], [0, 'music', music],
      [0, 'camera', { to: place === 'visit' ? 'house' : 'place', zoom: place === 'visit' ? 2.6 : undefined, dur: 1.6 }],
      [0.4, 'spawn', { id: 'victim', kind: 'resident', at: 'place' }],
      ...intro,
      [1.2, 'spawn', { id: 'assassin', kind: 'assassin', at: 'placeFrom', crouch: true, fadeIn: 0.8 }],
      [1.6, 'move', { id: 'assassin', to: 'placeBehind', dur: 3.2, gait: 'sneak', crouch: true }],
      [1.8, 'loop', { sfx: 'heartbeat', every: 0.85, until: 5.3 }],
      [5.0, 'pose', { id: 'assassin', pose: 'stand', crouch: false }],
      [5.15, 'bubble', { id: 'victim', text: '!', dur: 0.8 }], [5.15, 'scared', { id: 'victim' }], [5.15, 'sfx', 'gasp'],
      [5.4, 'attack', { id: 'assassin', target: 'victim' }],
      [5.8, 'hit', { id: 'victim', dir: -1 }],
      ...death,
      [6.0, 'sfx', 'sting'], [6.5, 'music', 'eerie'],
      [7.0, 'move', { id: 'assassin', to: 'placeAway', dur: 2.2, gait: 'walk', fadeOut: true }],
      ...extra,
      ...ENDING(title, '', color, 9.4),
    ],
  });
  Object.assign(SCENES, {
    death_lake: OUTDOOR({ name: 'Death at the lake', place: 'lake', title: '{name} stayed at the lake too long', color: '#8fd0f2',
      intro: [[0.9, 'bubble', { id: 'victim', text: '~ ~ ~', dur: 1.6 }], [2.8, 'bubble', { id: 'victim', text: 'So peaceful…', dur: 1.6 }]],
      death: [[5.85, 'move', { id: 'victim', to: 'placeWater', dur: 0.8, gait: 'run' }], [6.5, 'splash'], [6.6, 'alpha', { id: 'victim', to: 0, dur: 1.8 }], [7.6, 'splash']] }),
    death_hearth: OUTDOOR({ name: 'Death at the hearth', place: 'hearth', title: '{name} never left the hearth', color: '#ffb36b',
      intro: [[0.6, 'embers'], [0.9, 'bubble', { id: 'victim', text: 'So warm…', dur: 1.6 }], [2.6, 'embers'], [4.2, 'embers']],
      extra: [[6.2, 'embers'], [7.8, 'embers']] }),
    death_tavern: OUTDOOR({ name: 'Death outside the tavern', place: 'tavern', title: '{name} was the last to leave the tavern', color: '#e8c37a',
      intro: [[0.5, 'sfx', 'creak'], [0.9, 'bubble', { id: 'victim', text: '*hic*', dur: 1.2 }], [2.2, 'move', { id: 'victim', to: { from: 'place', dx: 14 }, dur: 0.9, gait: 'walk' }], [3.3, 'bubble', { id: 'victim', text: 'One more round…', dur: 1.6 }]] }),
    death_field: OUTDOOR({ name: 'Death in the field', place: 'field', title: '{name} wandered too far from town', color: '#c3dc9a', music: 'eerie',
      intro: [[0, 'fog', true], [0.9, 'bubble', { id: 'victim', text: 'What a sky…', dur: 1.8 }], [2.4, 'sfx', 'owl']],
      extra: [[9.3, 'fog', false]] }),
    death_visit: OUTDOOR({ name: "Death at another's house", place: 'visit', title: "{name} was watching {host}'s house", color: '#ff8a7a',
      intro: [[0.6, 'houseLight', true], [0.9, 'bubble', { id: 'victim', text: '…', dur: 1.4 }], [2.6, 'bubble', { id: 'victim', text: '(taking notes)', dur: 1.8 }]],
      extra: [[6.4, 'houseLight', false]] }),
  });

  // Reuse the timeline action library for interventions and role reveals.
  for (const kind of ['hurricane', 'flood', 'meteor']) SCENES[kind] = {
    name: kind === 'flood' ? 'Flood / drowning' : kind[0].toUpperCase() + kind.slice(1),
    kind: 'intervention', needsHouse: true, duration: 11,
    steps: [
      [0, 'letterbox', true], [0, 'music', 'ominous'], [0, 'hold'],
      [0, 'camera', { to: 'house', zoom: 2.5, dur: 1.5 }],
      [0.5, 'spawn', { id: 'victim', kind: 'resident', at: 'door' }],
      [1, 'scared', { id: 'victim' }], [1, 'environment', { kind, dur: 7 }],
      ...(kind === 'meteor' ? [[0, 'camera', { to: 'overview', dur: 1 }], [1, 'camera', { to: { from: 'door', dx: -150, dy: -240 }, zoom: 1.4, dur: 1.5 }], [3, 'camera', { to: 'house', zoom: 2.5, dur: 2.5 }]] : []),
      [1.5, 'loop', { sfx: 'wind', every: 1.5, until: 6 }],
      [3, 'bubble', { id: 'victim', text: '!', dur: 1.4 }],
      [6, 'thunder'], [6, 'shake', 1], [6, 'flash', { a: 0.9, color: '255,200,120' }],
      [6.2, 'die', { id: 'victim' }],
      [6.2, 'execute'],
      [7.5, 'fade', { to: 0.8, dur: 0.7 }],
      [8, 'title', { text: 'JUDGE INTERVENTION', sub: '{name} has been eliminated', color: '#ffcc86', dur: 2.6 }],
      [10, 'letterbox', false], [10, 'fade', { to: 0, dur: 0.8 }],
    ],
  };
  Object.assign(SCENES, {
    introduction: { name: 'Town introduction', duration: 12, steps: [
      [0, 'letterbox', true], [0, 'music', 'peace'], [0, 'camera', { to: 'overview', dur: 1 }],
      [1, 'title', { text: '{title}', sub: 'Every neighbor has a story. Every house holds a secret.', dur: 4, color: '#ffe6ab' }],
      [5, 'camera', { to: 'square', dur: 3 }], [9, 'camera', { to: 'overview', dur: 2 }], [11, 'letterbox', false],
      // Themes with an antagonist (RSP Supply: Tom Smith) introduce them at the fountain.
      [5.2, 'spawn', { id: 'villain', kind: 'resident', at: { from: 'fountain', dy: 135 }, avatar: 'villain', fadeIn: 0.8, scale: 1.6 }, { when: 'villain' }],
      [5.8, 'spot', { id: 'villain' }, { when: 'villain' }],
      [6.0, 'bubble', { id: 'villain', text: 'Synergy.', dur: 1.8 }, { when: 'villain' }],
      [6.4, 'title', { text: '{villain}', sub: '{villainTitle} has big plans for {title}', color: '#ffd21f', dur: 2.6, band: true }, { when: 'villain' }],
      [9.0, 'spot', {}, { when: 'villain' }],
      [9.2, 'alpha', { id: 'villain', to: 0, dur: 0.8 }, { when: 'villain' }],
    ] },
    protection: { name: 'Player protection', needsHouse: true, duration: 8, steps: [
      [0, 'camera', { to: 'house', zoom: 2.6, dur: 1.5 }], [0, 'hold'],
      [0.5, 'spawn', { id: 'victim', kind: 'resident', at: 'door' }],
      [0.6, 'spawn', { id: 'guard', kind: 'protector', at: 'street' }],
      [1, 'move', { id: 'guard', to: 'doorSide', dur: 2, gait: 'run' }],
      [3, 'shield', { id: 'victim', dur: 3 }], [3, 'sfx', 'saved'],
      [4, 'title', { text: 'PROTECTED', sub: '{name}', dur: 2.5, color: '#b1f0ba' }],
    ] },
  });
  for (const [id, name, color, mood] of [['beyond', 'Message from beyond', '#cdbfff', 'eerie'], ['photograph', 'Night snapshot', '#ffffff', 'tension'], ['blessing', 'Town blessing', '#ffe6ab', 'triumph']]) {
    SCENES[id] = { name, duration: 6.5, steps: [
      [0, 'letterbox', true], [0, 'music', mood], [0, 'camera', { to: id === 'beyond' ? 'cemetery' : 'square', dur: 1 }],
      [0, 'fog', id === 'beyond'], [1, 'flash', { a: id === 'photograph' ? 1 : 0.2 }],
      [1, 'sfx', id === 'photograph' ? 'shutter' : 'saved'],
      ...(id === 'photograph' ? [[1, 'snapshot', {}]] : []),
      [1.5, 'title', { text: '{title}', sub: '{sub}', color, dur: 4 }],
      [6, 'letterbox', false], [6, 'fog', false],
    ] };
  }

  // Which scenes the Judge can trigger by hand (and on which kind of target).
  Object.assign(SCENES, {
    planting: { name:'A suspicious fuse', needsHouse:true, duration:9, steps:[
      [0,'hold'], [0,'letterbox',true], [0,'music','tension'], [0,'camera',{ to:'house',zoom:2.8,dur:1.5 }],
      [1,'spawn',{ id:'visitor',kind:'assassin',at:'street' }], [1.2,'move',{ id:'visitor',to:'door',dur:2,gait:'sneak' }],
      [3.3,'environment',{ kind:'fuse',dur:5 }], [4,'bubble',{ id:'visitor',text:'…',dur:1 }],
      [5,'move',{ id:'visitor',to:'street',dur:2,gait:'run',fadeOut:true }], [8,'letterbox',false],
    ] },
    explosion: { name:'Detonator: house explosion', needsHouse:true, duration:12, steps:[
      [0,'hold'], [0,'letterbox',true], [0,'music','peace'], [0,'camera',{ to:'overview',dur:1 }],
      [1.3,'camera',{ to:'house',zoom:2.6,dur:2 }], [2,'environment',{ kind:'fuse',dur:3 }],
      [3.3,'spawn',{ id:'victim',kind:'resident',at:'door',ifAlive:true }], [3.5,'bubble',{ id:'victim',text:'?',dur:1 }],
      [4.5,'environment',{ kind:'explosion',dur:6 }], [4.5,'sfx','explosion'], [4.5,'shake',1.4], [4.5,'flash',{ a:1,color:'255,220,140' }],
      [4.7,'destroyHouse'], [4.7,'die',{ id:'victim' }], [4.7,'execute'], [5,'crowd',{ kind:'gasp' }],
      [7,'title',{ text:'THE FUSE HAS RUN OUT',sub:'{sub}',color:'#efbf88',dur:4 }], [11,'letterbox',false],
    ] },
    crier: { name:'Storymaker: town crier', duration:10, steps:[
      [0,'letterbox',true], [0,'dark',.8], [0,'music','ominous'], [0,'camera',{ to:'square',dur:2 }],
      [1,'spawn',{ id:'crier',kind:'figure',at:{ dx:750,dy:550 } }], [1,'move',{ id:'crier',to:{ dx:950,dy:550 },dur:2,gait:'run' }],
      [3,'sfx','bell'], [3,'bubble',{ id:'crier',text:'!',dur:1 }], [4,'title',{ text:'THE NARRATIVE HAS SHIFTED!',sub:'AN IMMEDIATE VOTE MUST HAPPEN NOW!',color:'#e6c68b',dur:5 }], [9,'letterbox',false],
    ] },
    revival: { name:'Volatile: one day return', needsHouse:true, duration:8, steps:[
      [0,'letterbox',true], [0,'music','eerie'], [0,'camera',{ to:'house',zoom:2.5,dur:1.5 }], [0,'hold'], [0,'fog',true],
      [1,'spawn',{ id:'victim',kind:'resident',at:'door',fadeIn:3 }], [1,'environment',{ kind:'revival',dur:5 }], [2,'sfx','saved'],
      [4,'title',{ text:'ONE MORE DAY',sub:'{sub}',color:'#b6d5bc',dur:3 }], [7,'fog',false], [7,'letterbox',false],
    ] },
    ash: { name:'Volatile: turns to ash', needsHouse:true, duration:8, steps:[
      [0,'letterbox',true], [0,'camera',{ to:'house',zoom:2.6,dur:1.5 }], [0,'hold'], [0,'music','eerie'],
      [1,'spawn',{ id:'victim',kind:'resident',at:'door' }], [2,'environment',{ kind:'ash',dur:5 }],
      [2,'sfx','wind'], [3,'die',{ id:'victim' }], [3,'execute'], [4,'title',{ text:'BORROWED TIME',sub:'{sub}',color:'#c3bdbe',dur:3 }], [7,'letterbox',false],
    ] },
  });
  for (const [id,name,title,mood] of [['hustle','Hustler: shortened clock','TIME IS RUNNING OUT','tension'],['nomination','Public nomination','THE ACCUSATION','ominous'],['ghostVote','A ghost casts a ballot','A VOICE FROM BEYOND','eerie'],['silence','A voice falls quiet','SILENCED','eerie'],['emergencyVote','Emergency ballot','EMERGENCY VOTE','tension']]) {
    SCENES[id] = { name,duration:7,steps:[[0,'letterbox',true],[0,'camera',{ to:'square',dur:1.5 }],[0,'music',mood],[1,'sfx',id === 'hustle' ? 'tick' : 'bell'],[1.5,'title',{ text:title,sub:'{sub}',color:'#dec49d',dur:4.5 }],[6.5,'letterbox',false]] };
  }
  const MANUAL = ['murder', 'investigation', 'watcher', 'peek', 'flee', 'visitor', 'emptyHouse', 'graveyard', 'square', 'quietNight'];

  MANUAL.push('introduction', 'protection', 'hurricane', 'flood', 'meteor');
  MANUAL.push('planting', 'explosion', 'crier', 'revival', 'ash', 'hustle', 'nomination', 'ghostVote', 'silence', 'emergencyVote');
  window.MT_SCENES = SCENES;
  window.MT_SCENE_MANUAL = MANUAL;
})();
