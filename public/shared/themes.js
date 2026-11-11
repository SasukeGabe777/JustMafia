// Theme registry. A theme only changes presentation (names, colors,
// building shapes, mood); game rules never look at it.
//
// To add a theme, copy an entry and change its values. Fields:
//   townName     default town name when the theme is picked
//   labels       words the big screen uses for places
//   palette      colors for the ground, roads, plaza, water and buildings
//   building     shape the renderer draws: gable | thatch | dome | spire | tent | crypt | office | bunker
//   night        RGB tint used for the night overlay
//   music        (future) background music pack id; null = synthesized SFX only
// Optional (all presentation; rules never read them):
//   civic        names for the tavern / hall / firepit / market / workshop
//   roleNames    { roleId: 'Display name' } shown on phones, TV text and narration
//   teamNames    { mafia: 'Display name', town: ..., neutral: ... }
//   villain      { name, title, avatar } the theme's face of the antagonist team
//   ui           { accent, accent2, ink, paper, wood, woodDark } menu colors (CSS vars)
//   narration    { key: [lines] } overrides narrator lines for every narrator style
//   houseTrim    accent color for a small plaque on every house
//   effects      { confetti: [colors] }
// To add a theme: copy an entry (RSP Supply below shows every optional field),
// add its id to THEME_ORDER, and optionally a cinema kit in public/cinema.js.
(function (root) {
  const THEMES = {
    smalltown: {
      name: 'Small Town', emoji: '🏘️', townName: 'Mafia Town', building: 'gable',
      labels: { cemetery: 'CEMETERY' },
      palette: { grass: '#7cbf5a', grassDark: '#5c9443', road: '#dcc392', roadEdge: '#b89a63', plaza: '#d6ccb6', plazaEdge: '#a99f8b', water: '#4aa3d9', tree: '#3c8d3f', walls: ['#f4e1c1', '#f7d4d4', '#d9ecf7', '#e3f3d6', '#fbe8b5', '#e8dcf5'], roofs: ['#c0392b', '#2c5f8a', '#7a4e2d', '#2e7d4f', '#8e44ad', '#d35400'] },
      night: '10,14,42', music: null,
    },
    medieval: {
      name: 'Medieval Village', emoji: '🏰', townName: 'Oakhollow', building: 'thatch',
      labels: { cemetery: 'GRAVEYARD' },
      palette: { grass: '#687363', grassDark: '#414d44', road: '#9e927a', roadEdge: '#625e54', plaza: '#aaa08a', plazaEdge: '#716a5b', water: '#4c7178', tree: '#3d5647', walls: ['#b8aa8a', '#b7a28b', '#a7a69a', '#c3b59a', '#9caa9a', '#b7a2a1', '#a9b0ad', '#ccbb99'], roofs: ['#505968', '#685750', '#585c61', '#596b65', '#6d5663', '#635c70', '#4e6270', '#79614d'] },
      night: '14,12,30', music: null,
    },
    space: {
      name: 'Space Station', emoji: '🚀', townName: 'Kepler Station', building: 'dome',
      labels: { cemetery: 'AIRLOCK' },
      palette: { grass: '#2b2f45', grassDark: '#1c1f30', road: '#5b6280', roadEdge: '#3d4360', plaza: '#7a83a8', plazaEdge: '#4d5475', water: '#38e0d0', tree: '#6cf0b0', walls: ['#d7dcea', '#c4cbe0', '#e4e8f3', '#b9c1da'], roofs: ['#4fb3ff', '#8f7bff', '#3ee6c1', '#ff7bd5'] },
      night: '2,2,14', music: null,
    },
    fantasy: {
      name: 'Fantasy Realm', emoji: '🧙', townName: 'Eldermere', building: 'spire',
      labels: { cemetery: 'BARROWS' },
      palette: { grass: '#6fbf7a', grassDark: '#4f9a5b', road: '#d8c8a0', roadEdge: '#a8966c', plaza: '#cfd7c8', plazaEdge: '#98a58f', water: '#5fb7e8', tree: '#2f8f5a', walls: ['#f2e9ff', '#e6f7ff', '#fff3d9', '#e9ffe9'], roofs: ['#6c4bd8', '#2f7fd8', '#d84b9b', '#1fa38a'] },
      night: '18,8,46', music: null,
    },
    dragons: {
      name: 'Dragon Peaks', emoji: '🐉', townName: 'Emberfall', building: 'tent',
      labels: { cemetery: 'ASHFIELD' },
      palette: { grass: '#9a8a6a', grassDark: '#7a6a4c', road: '#c99a6a', roadEdge: '#9a6c42', plaza: '#b8a58a', plazaEdge: '#8a765c', water: '#ff7a2f', tree: '#6a5a3a', walls: ['#e8c9a0', '#d9b48a', '#f0d6b0', '#c9a27a'], roofs: ['#a8321e', '#7a1f12', '#c2501f', '#5e1a10'] },
      night: '40,8,4', music: null,
    },
    dungeon: {
      name: 'Dungeon Crawl', emoji: '🕯️', townName: 'The Deep Halls', building: 'crypt',
      labels: { cemetery: 'OSSUARY' },
      palette: { grass: '#4a4650', grassDark: '#36333b', road: '#6e6874', roadEdge: '#4f4a55', plaza: '#7d7784', plazaEdge: '#59535f', water: '#3d7a6a', tree: '#5a7a4a', walls: ['#8b8592', '#9a94a1', '#7a7480', '#a49eab'], roofs: ['#4e4854', '#3f3a45', '#5c5562', '#463f4c'] },
      night: '6,4,10', music: null,
    },
    spies: {
      name: 'Secret Agents', emoji: '🕶️', townName: 'Operation Nightfall', building: 'office',
      labels: { cemetery: 'COMPROMISED' },
      palette: { grass: '#5d6b62', grassDark: '#47534b', road: '#9aa3a8', roadEdge: '#6f787d', plaza: '#b7bec2', plazaEdge: '#858d92', water: '#3f6f9a', tree: '#3e5a48', walls: ['#d8dde0', '#c3cbd0', '#e6eaec', '#b0b9bf'], roofs: ['#2c3e50', '#1f2b38', '#34495e', '#263645'] },
      night: '4,10,20', music: null,
    },
    fbi: {
      name: 'Federal Investigation', emoji: '🗂️', townName: 'Field Office 9', building: 'bunker',
      labels: { cemetery: 'EVIDENCE' },
      palette: { grass: '#7d8f6a', grassDark: '#617252', road: '#b0a890', roadEdge: '#867e68', plaza: '#cfc8b4', plazaEdge: '#9e977f', water: '#4a7fa8', tree: '#4f6a3e', walls: ['#e4dfcf', '#d2cdbc', '#ece8db', '#c4bfad'], roofs: ['#1d3557', '#2a4a73', '#3c5a80', '#14253d'] },
      night: '6,10,28', music: null,
    },
  };
  THEMES.space.civic = { tavern: 'CANTINA', hall: 'COMMAND', firepit: 'REACTOR', market: 'TRADING POST', workshop: 'LAB' };
  THEMES.fantasy.civic = { tavern: 'MOON INN', hall: 'MAGE HALL', firepit: 'ENCHANTED FIRE', market: 'BAZAAR', workshop: 'ALCHEMY' };
  THEMES.medieval.civic = { tavern: 'TAVERN', hall: 'GUILD HALL', firepit: 'HEARTH', market: 'MARKET', workshop: 'SMITHY' };
  THEMES.fbi.civic = { tavern: 'BREAK ROOM', hall: 'FIELD OFFICE', firepit: 'BRIEFING', market: 'SUPPLIES', workshop: 'FORENSICS' };
  // RSP Supply: a lighthearted corporate-takeover parody. The Mafia team becomes
  // RSP Supply, led by its President, Tom Smith. Yellow and blue everywhere.
  THEMES.rsp = {
    name: 'RSP Supply', emoji: '📦', townName: 'Supplyville', building: 'gable',
    labels: { cemetery: 'FORMER EMPLOYEES' },
    palette: { grass: '#7fb069', grassDark: '#5f8f4e', road: '#c9ccd3', roadEdge: '#9da2ad', plaza: '#e6e8ed', plazaEdge: '#a9aeb9', water: '#3f7fd6',
      tree: '#3f8a4f', walls: ['#ffe27a', '#f6d34a', '#fff1b3', '#e9c23a', '#ffd95e', '#f3e3a3'], roofs: ['#1f4fa8', '#2a63c4', '#173d82', '#3a74d6', '#204a96', '#2f5fb8'] },
    night: '6,12,40', music: null,
    civic: { tavern: 'BREAK ROOM', hall: 'RSP HQ', firepit: 'WATER COOLER', market: 'WAREHOUSE', workshop: 'LOADING DOCK' },
    houseTrim: '#1f4fa8',
    villain: { name: 'Tom Smith', title: 'President of RSP Supply',
      avatar: { color: '#1f4fa8', skin: '#f3c9a0', hat: 'none', hair: 'slickedBack', hairColor: '#969b9d', facialHair: 'none', eyes: '#416f91', face: 'square', features: 'none', expression: 'smirk', outfit: 'mafiaSuit', pants: '#2d2f3a', shoes: '#151821', shoeStyle: 'nobleShoes', accessory: 'glasses', nameColor: '#ffe066' } },
    teamNames: { mafia: 'RSP Supply', town: 'The Townsfolk', neutral: 'Freelancers' },
    roleNames: { mafia: 'RSP Supply Associate', godfather: 'Tom Smith, President', roleblocker: 'Mandatory Meeting Scheduler', silencer: 'Corporate Lawyer',
      puppetMaster: 'Marketing Department', hustler: 'Regional Sales Manager', alchemist: 'Product Development', villager: 'Townsperson', detective: 'Auditor',
      sheriff: 'Inspector', doctor: 'Union Rep', bodyguard: 'Security Guard', serialKiller: 'Rogue Contractor' },
    ui: { accent: '#ffd21f', accent2: '#1f4fa8', ink: '#0f1f45', paper: '#fff6cf', paper2: '#fffbe6', wood: '#1f4fa8', woodDark: '#0f2a63', woodLight: '#4d7fd9', bg: '#0c1d4a' },
    effects: { confetti: ['#ffd21f', '#1f4fa8', '#ffffff', '#3a74d6'] },
    narration: {
      start: ['Welcome to {town}. {count} townsfolk live here... and RSP Supply has its eye on every single one of them. President Tom Smith calls it "an exciting growth opportunity."',
        'Breaking news: RSP Supply plans to acquire {town}. Tom Smith promises "synergy." {count} townsfolk promise to resist. Some of them are lying.'],
      roleReveal: ['Check your phones. Some of you secretly work for RSP Supply. Tom Smith thanks you for your loyalty.'],
      night: ['The lights dim in {town}. At RSP Supply headquarters, Tom Smith is scheduling a very quiet meeting.', 'Night falls on {town}. Somewhere, an RSP Supply clipboard is being filled with names.'],
      kill: ['{name} has been acquired by RSP Supply. Tom Smith calls it "a smooth transition."{role} {alive} townsfolk remain independent.', 'Overnight, {name} was absorbed into the RSP Supply org chart.{role} {alive} remain.'],
      mafiaWin: ['The deal is closed. RSP Supply now owns {town}. Tom Smith unveils the new logo: yellow, blue, and everywhere.'],
      townWin: ['The takeover has failed! The last RSP Supply associate is escorted out, and Tom Smith cancels the press conference. {town} stays independent!'],
      eliminated: ['The town votes. {name} is walked out of {town} with a cardboard box.{role}'],
      kill_lake: ['{name} stayed at the lake a little too long. RSP Supply has since installed a "Swim at Your Own Risk" sign.{role} {alive} remain.'],
      kill_tavern: ['{name} was the last one in the break room. RSP Supply has reassigned their parking spot.{role} {alive} remain.'],
      kill_hearth: ['{name} lingered by the water cooler too long. Tom Smith calls it "a learning moment."{role} {alive} remain.'],
      kill_field: ['{name} wandered past the RSP Supply warehouse and into the field. They did not return.{role} {alive} remain.'],
      kill_visit: ['{name} was auditing {host}’s house after hours. RSP Supply closed the audit permanently.{role} {alive} remain.'],
    },
  };
  // ----- Worlds added in Themes v2 (their look, life and deaths live in public/theme-world.js) -----
  THEMES.snow = {
    name: 'Snowy Village', emoji: '❄️', townName: 'Frostvale', building: 'gable',
    labels: { cemetery: 'FROZEN GRAVES' },
    palette: { grass: '#e9f1f8', grassDark: '#c6d5e4', road: '#b7c2cf', roadEdge: '#8d99a8', plaza: '#dfe8f0', plazaEdge: '#a5b3c2', water: '#b9e2f5', tree: '#2f5d4a',
      walls: ['#8a5a3a', '#a06a44', '#7a4e32', '#c8a27a', '#b5835a', '#9a6a4a'], roofs: ['#3a4a5a', '#5a3a2a', '#2e4058', '#6a2a2a', '#40505e'] },
    night: '6,14,40', music: null,
  };
  THEMES.blocky = {
    name: 'Block World', emoji: '🧱', townName: 'Cubeshire', building: 'block',
    labels: { cemetery: 'BEDROCK' },
    palette: { grass: '#62ad3f', grassDark: '#447f2b', road: '#9b7a52', roadEdge: '#6f5436', plaza: '#8f8f8f', plazaEdge: '#5f5f5f', water: '#3a6fd8', tree: '#2f7d23',
      walls: ['#b08a5a', '#9a7448', '#c8c8c8', '#a0a0a0', '#c49a62'], roofs: ['#6b4a2b', '#5a5a5a', '#8a3a2a', '#3a5a2a'] },
    night: '4,6,30', music: null,
  };
  THEMES.tabletop = {
    name: 'Tabletop Quest', emoji: '🎲', townName: 'Tavern Tales', building: 'thatch',
    labels: { cemetery: 'FALLEN HEROES' },
    palette: { grass: '#e8d6ab', grassDark: '#d2ba88', road: '#c8a46a', roadEdge: '#8a6a3a', plaza: '#efe2c0', plazaEdge: '#9a7a4a', water: '#86aebd', tree: '#5a7a3a',
      walls: ['#f2e6c8', '#e8d8b0', '#f6ecd2', '#eadcb8'], roofs: ['#8a3a2a', '#3a5a7a', '#5a4a2a', '#2a5a3a'] },
    night: '24,14,6', music: null,
  };
  THEMES.realistic = {
    name: 'Realistic', emoji: '📷', townName: 'Maple Hollow', building: 'gable',
    labels: { cemetery: 'CEMETERY' },
    palette: { grass: '#5d7f3b', grassDark: '#42612a', road: '#5f5d5a', roadEdge: '#454341', plaza: '#a39d92', plazaEdge: '#7a746a', water: '#3d6e85', tree: '#2f4f22',
      walls: ['#d9d2c5', '#c9b9a3', '#e6e1d8', '#b8a48a', '#9fa6a8', '#cfc2ad'], roofs: ['#4a3f38', '#5a5f66', '#6b4a3a', '#3f4a52', '#5c4c44'] },
    night: '8,12,26', music: null,
  };
  THEMES.noir = {
    name: 'Noir', emoji: '🎬', townName: 'Rain City', building: 'office',
    labels: { cemetery: 'POTTER’S FIELD' },
    palette: { grass: '#4c4c4c', grassDark: '#353535', road: '#262626', roadEdge: '#161616', plaza: '#5a5a5a', plazaEdge: '#3a3a3a', water: '#707070', tree: '#2a2a2a',
      walls: ['#9a9a9a', '#7a7a7a', '#b0b0b0', '#8a8a8a'], roofs: ['#222222', '#333333', '#2a2a2a'] },
    night: '0,0,0', music: null,
  };
  // Themed text for the worlds above and the older non-classic themes (written in
  // theme-text.js): role/team names, place labels and the narrator's voice. The
  // classic look (Medieval Village "Mafia Town", Small Town) and RSP Supply stay as they are.
  const TEXT = (typeof module !== 'undefined' && module.exports ? (() => { try { return require('./theme-text').THEME_TEXT; } catch (e) { return null; } })() : root.MT_THEME_TEXT && root.MT_THEME_TEXT.THEME_TEXT) || {};
  for (const [id, t] of Object.entries(TEXT)) {
    const th = THEMES[id]; if (!th || ['medieval', 'smalltown', 'rsp'].includes(id)) continue;
    if (t.townName) th.townName = t.townName;
    if (t.cemetery) th.labels = { ...th.labels, cemetery: t.cemetery };
    if (t.civic) th.civic = { ...(th.civic || {}), ...t.civic };
    if (t.teamNames) th.teamNames = t.teamNames;
    if (t.roleNames) th.roleNames = t.roleNames;
    if (t.narration) th.narration = t.narration;
  }
  const THEME_ORDER = ['medieval', 'smalltown', 'space', 'fantasy', 'dragons', 'dungeon', 'spies', 'fbi', 'snow', 'blocky', 'tabletop', 'realistic', 'noir', 'rsp'];
  // Themed display names (fall back to the role/team's own name). A themed role keeps
  // its real name beside it, so everyone knows what it does: "Med-Bay Surgeon (Doctor)".
  const roleTitle = (themeId, roleId, fallback) => { const t = THEMES[themeId]; return (t && t.roleNames && t.roleNames[roleId]) || fallback; };
  const roleName = (themeId, roleId, fallback) => { const themed = roleTitle(themeId, roleId, fallback); return themed && fallback && themed !== fallback ? `${themed} (${fallback})` : themed; };
  const teamName = (themeId, team, fallback) => { const t = THEMES[themeId]; return (t && t.teamNames && t.teamNames[team]) || fallback; };
  const API = { THEMES, THEME_ORDER, roleName, roleTitle, teamName };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.MT_THEMES = API;
})(typeof window !== 'undefined' ? window : globalThis);
