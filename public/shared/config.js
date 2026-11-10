// Role options are data, shared by setup, validation, engine and phone UI.
(function (root) {
  const BASE = { mode: 'standard', uses: 0, cooldown: 0, minDay: 1, selfTarget: false, startingInfo: 'none' };
  const ROLE_DEFAULTS = {
    doctor: { selfTarget: true, noRepeat: true }, vigilante: { uses: 1 },
    detonator: { uses: 1, minDelay: 3, maxDelay: 12 }, silencer: {}, sorcerer: {},
    hustler: { uses: 1, fraction: 0.4, minSeconds: 15 },
    alchemist: { midasUses: 1, volatileUses: 1, temporaryVoting: true },
    jester: { behavior: 'classic', uses: 1, copyDuration: 'night' },
    storymaker: { uses: 1 }, puppetMaster: { uses: 2 }, glitch: { uses: 1 },
  };
  const FIELDS = {
    uses: { label: 'Uses per game (0 = unlimited)', type: 'number', min: 0, max: 10 },
    cooldown: { label: 'Nights between uses', type: 'number', min: 0, max: 10 },
    minDay: { label: 'First activation night', type: 'number', min: 1, max: 20 },
    selfTarget: { label: 'Allow self targeting', type: 'boolean' },
    noRepeat: { label: 'Prevent repeated targets', type: 'boolean' },
    minDelay: { label: 'Minimum explosion delay (phase transitions)', type: 'number', min: 3, max: 12 },
    maxDelay: { label: 'Maximum explosion delay', type: 'number', min: 3, max: 20 },
    fraction: { label: 'Discussion time multiplier', type: 'number', min: 0.3, max: 0.5, step: 0.05 },
    minSeconds: { label: 'Minimum discussion seconds', type: 'number', min: 5, max: 60 },
    midasUses: { label: 'Midas potions', type: 'number', min: 1, max: 3 },
    volatileUses: { label: 'Volatile potions', type: 'number', min: 1, max: 3 },
    temporaryVoting: { label: 'Temporary return may vote', type: 'boolean' },
    behavior: { label: 'Jester behavior', choices: ['classic', 'mimic', 'hybrid'] },
    copyDuration: { label: 'Copied ability lasts', choices: ['night', 'game'] },
    startingInfo: { label: 'Starting information', choices: ['none', 'neighborEvil', 'teamPair', 'infoTrio', 'townTrio'] },
  };
  const COPYABLE = ['detective', 'sheriff', 'doctor', 'bodyguard', 'roleblocker', 'sorcerer', 'silencer', 'hustler', 'detonator'];
  const STATUS = {
    drunk: { label: 'Drunk', visibility: 'judge', information: true },
    poisoned: { label: 'Poisoned', visibility: 'judge', information: true },
    malfunction: { label: 'Malfunction', visibility: 'judge', information: true },
    silenced: { label: 'SILENCED', visibility: 'owner', dayOnly: true },
    temporaryRevival: { label: 'Returned', visibility: 'public' },
    protected: { label: 'Protected', visibility: 'judge' },
    marked: { label: 'Midas mark', visibility: 'judge' },
  };
  function standard(role) { return { ...BASE, ...(ROLE_DEFAULTS[role] || {}) }; }
  function normalize(role, input) {
    const s = standard(role);
    if (!input || input.mode !== 'custom') return s;
    s.mode = 'custom';
    for (const key of Object.keys(s)) {
      const def = FIELDS[key], value = input[key];
      if (!def || value == null) continue;
      if (def.choices && def.choices.includes(value)) s[key] = value;
      else if (def.type === 'boolean') s[key] = value === true;
      else if (def.type === 'number' && Number.isFinite(Number(value))) s[key] = Math.min(def.max, Math.max(def.min, def.step ? Number(value) : Math.floor(Number(value))));
    }
    if (s.maxDelay) s.maxDelay = Math.max(s.minDelay, s.maxDelay);
    return s;
  }
  const DEFAULTS = { storytellerMode: 'classic', misinformation: 'invert', assistance: 'gentle',
    mafiaDecision: 'plurality', mafiaTie: 'none', mafiaExtraKills: 0, mafiaBluffs: 3,
    ghostVotes: false, ghostChat: false, whispers: false, whispersPerDay: 3,
    whisperLength: 160, judgeReadsWhispers: false, whisperTeam: 'any',
    votingMode: 'classic', accusationSeconds: 30, defenseSeconds: 30,
    nominationsPerDay: 1, nominationCooldown: 10, nominationSeconds: 30,
    nominationSecondsRequired: 0, repeatNominations: false, nominationEndsDiscussion: true, roleConfig: {} };
  const API = { BASE, ROLE_DEFAULTS, FIELDS, COPYABLE, STATUS, standard, normalize, DEFAULTS };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.MT_CONFIG = API;
})(typeof window !== 'undefined' ? window : globalThis);
