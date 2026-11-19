// Seasonal events for the whole box (shared by the server and the pages).
//
// One event at a time, by date. An event gives the box a theme (colours, a name, an icon), its own
// season challenges and season-pass track (box/progress.js), and limited-time shop items that can
// only be bought while it runs (the shop: public/shop). Items bought during an event stay owned.
//
//   SEASONS: [{ id, name, icon, blurb, start: 'YYYY-MM-DD', end: 'YYYY-MM-DD' (inclusive, UTC),
//               theme: { a, b, c } (accent colours for banners), items: [catalog/gear ids sold only now],
//               challenges: [] (filled by box/progress.js from its own table, keyed by season id) }]
//   currentSeason(now = Date.now())  -> the running event or null
//   nextSeason(now = Date.now())     -> the next one to start (for "coming soon")
//   daysLeft(season, now)            -> whole days until it ends
(function (root) {
  const SEASONS = [
    { id: 'harvest-2026', name: 'Harvest Fest', icon: '🍂', blurb: 'Pumpkins, cider and cosy sweaters all over the box.', start: '2026-11-01', end: '2026-11-30', theme: { a: '#e8862a', b: '#7a2e12', c: '#ffd27a' }, items: [], challenges: [] },
    { id: 'frost-2026', name: 'Frostival', icon: '❄️', blurb: 'Snow on every game, gifts in the shop.', start: '2026-12-01', end: '2027-01-07', theme: { a: '#7ad0ff', b: '#1d3a7a', c: '#ffffff' }, items: [], challenges: [] },
    { id: 'hearts-2027', name: 'Sweetheart Week', icon: '💘', blurb: 'Pink, red and very extra.', start: '2027-02-07', end: '2027-02-21', theme: { a: '#ff5c8a', b: '#7a1035', c: '#ffd0de' }, items: [], challenges: [] },
    { id: 'bloom-2027', name: 'Spring Bloom', icon: '🌸', blurb: 'Flowers, pastels and spring cleaning.', start: '2027-03-20', end: '2027-04-30', theme: { a: '#ff9ed2', b: '#3f8f3a', c: '#fff4b0' }, items: [], challenges: [] },
    { id: 'summer-2027', name: 'Summer Splash', icon: '🏖️', blurb: 'Beach towels, shades and too much sunscreen.', start: '2027-06-15', end: '2027-08-31', theme: { a: '#2ec4ff', b: '#ff9f1a', c: '#fff6c8' }, items: [], challenges: [] },
    { id: 'spooky-2027', name: 'Spooky Season', icon: '🎃', blurb: 'Ghosts, ghouls and haunted games.', start: '2027-10-01', end: '2027-10-31', theme: { a: '#ff7a1a', b: '#2a1240', c: '#b6ff5c' }, items: [], challenges: [] },
  ];
  const DAY = 86400000;
  const t0 = (d) => Date.parse(d + 'T00:00:00Z'), t1 = (d) => Date.parse(d + 'T00:00:00Z') + DAY;
  function currentSeason(now = Date.now()) { return SEASONS.find((s) => now >= t0(s.start) && now < t1(s.end)) || null; }
  function nextSeason(now = Date.now()) { return SEASONS.filter((s) => t0(s.start) > now).sort((a, b) => t0(a.start) - t0(b.start))[0] || null; }
  function daysLeft(s, now = Date.now()) { return s ? Math.max(0, Math.ceil((t1(s.end) - now) / DAY)) : 0; }
  const API = { SEASONS, currentSeason, nextSeason, daysLeft };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (root) root.MT_SEASONS = API;
})(typeof window !== 'undefined' ? window : null);
