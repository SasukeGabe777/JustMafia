'use strict';
// End-of-night recap: everything the TV's recap reel (public/box/recap.js) and each phone's
// personal recap card need, worked out from what the room already keeps:
//   room.played    each finished game: winner, top 3, closest finish, biggest climb, the
//                  game's own awards and highlights (box/room.js scoreParty fills these in)
//   room.partyBoard()  party points, wins and games per player
// buildRecap(room) → a snapshot (it doesn't change while the reel plays).

// Fun awards so every player gets at least one, even without a win.
const FILLERS = [
  { icon: '🤗', title: 'Good Sport', desc: 'Smiled all the way to the end' },
  { icon: '🎲', title: 'Wildcard', desc: 'Nobody knew what you would do next' },
  { icon: '🧘', title: 'Zen Master', desc: 'Calm under pressure, all night' },
  { icon: '🐢', title: 'Slow Burner', desc: 'Saving the best for next time' },
  { icon: '🎈', title: 'Life of the Party', desc: 'The room was louder with you in it' },
  { icon: '🕵️', title: 'Dark Horse', desc: 'Watch out for this one next time' },
  { icon: '🍀', title: 'Lucky Charm', desc: 'Luck was on your side (sometimes)' },
  { icon: '🎤', title: 'Hype Machine', desc: 'Cheered for everyone' },
];

function moments(played) {
  const out = [];
  // Closest finish: the smallest gap between first and second (relative to the winning score).
  let close = null;
  for (const g of played) {
    if (!g.gap || g.gap.diff == null) continue;
    const rel = g.gap.diff / Math.max(1, Math.abs(g.gap.top));
    if (!close || rel < close.rel) close = { rel, g };
  }
  if (close) {
    const { g } = close, d = close.g.gap.diff;
    out.push({ kind: 'close', icon: '📸', title: 'Closest finish', game: g.game, text: d === 0 ? `${g.gap.a} and ${g.gap.b} tied at the top of ${g.title}!` : `${g.gap.a} beat ${g.gap.b} by just ${d} in ${g.title}` });
  }
  // Biggest swing: the largest climb up the party standings after one game.
  let swing = null;
  for (const g of played) if (g.swing && (!swing || g.swing.by > swing.s.by)) swing = { s: g.swing, g };
  if (swing && swing.s.by >= 2) out.push({ kind: 'swing', icon: '🚀', title: 'Biggest score swing', game: swing.g.game, text: `${swing.s.name} jumped from #${swing.s.from} to #${swing.s.to} after ${swing.g.title}` });
  // A runaway: the biggest winning margin.
  let run = null;
  for (const g of played) { if (!g.gap || !g.gap.diff) continue; const rel = g.gap.diff / Math.max(1, Math.abs(g.gap.top)); if (rel >= 0.4 && (!run || rel > run.rel)) run = { rel, g }; }
  if (run && (!close || run.g !== close.g)) out.push({ kind: 'runaway', icon: '💨', title: 'Total domination', game: run.g.game, text: `${run.g.gap.a} ran away with ${run.g.title}` });
  // Audience favourites.
  for (const g of played) if (g.fav) out.push({ kind: 'fav', icon: '📣', title: 'Audience favourite', game: g.game, text: `The crowd loved ${g.fav.name} in ${g.title} (${g.fav.votes} vote${g.fav.votes === 1 ? '' : 's'})` });
  // The games' own highlights (game.highlights() or the ones they show at the end).
  for (const g of played) for (const h of (g.highlights || []).slice(0, 2)) out.push({ kind: 'game', icon: h.icon || '✨', title: g.title, game: g.game, text: h.text });
  return out.slice(0, 8);
}

function awards(board, played) {
  const out = [], given = new Map(); // id → number of awards
  const give = (r, a) => { if (!r) return; out.push({ id: r.id, name: r.name, avatar: r.avatar, color: r.color, ...a }); given.set(r.id, (given.get(r.id) || 0) + 1); };
  if (!board.length) return out;
  give(board[0], { icon: '👑', title: 'Party Champion', desc: `${board[0].pts} party points` });
  const maxW = Math.max(0, ...board.map((r) => r.wins));
  if (maxW > 0) { const w = board.filter((r) => r.wins === maxW && r.id !== board[0].id)[0]; if (w) give(w, { icon: '⭐', title: 'Star Collector', desc: `${maxW} game win${maxW > 1 ? 's' : ''}` }); }
  // Winners of each game (once per player).
  for (const g of played) { const r = g.winnerId && board.find((b) => b.id === g.winnerId); if (r && !given.has(r.id)) give(r, { icon: '🏆', title: `${g.title} Champ`, desc: `Won ${g.title}` }); }
  let swing = null; for (const g of played) if (g.swing && (!swing || g.swing.by > swing.by)) swing = g.swing;
  if (swing && swing.by >= 2) { const r = board.find((b) => b.id === swing.id); if (r && (given.get(r.id) || 0) < 2) give(r, { icon: '🚀', title: 'Comeback Kid', desc: `Climbed ${swing.by} places in one game` }); }
  if (board.length >= 2) { const r = board[1], gap = board[0].pts - r.pts; if (gap <= 5) give(r, { icon: '😅', title: 'Photo Finish', desc: gap ? `Just ${gap} point${gap > 1 ? 's' : ''} off the top` : 'Tied for the lead!' }); }
  const favs = new Map(); for (const g of played) if (g.fav) favs.set(g.fav.id, (favs.get(g.fav.id) || 0) + 1);
  for (const [id, n] of favs) { const r = board.find((b) => b.id === id); if (r) give(r, { icon: '📣', title: 'Crowd Favourite', desc: `The audience picked you ${n > 1 ? n + ' times' : 'once'}` }); }
  // The games' own end-of-game awards (most memorable first; one per player).
  for (const g of played) for (const a of g.awards || []) { const r = board.find((b) => b.id === a.id); if (r && !given.has(r.id)) give(r, { icon: a.icon || '🏅', title: a.title || 'Award', desc: `In ${g.title}` }); }
  // Everyone else: a filler award, different for each player where possible.
  let k = 0;
  for (const r of board) if (!given.has(r.id)) { const f = r === board[board.length - 1] && board.length >= 3 ? FILLERS[0] : FILLERS[(k++ % (FILLERS.length - 1)) + 1]; give(r, f); }
  return out;
}

function buildRecap(room) {
  const board = room.partyBoard(), played = room.played.slice();
  const pm = room.partyMode;
  return {
    id: (room.recapSeq = (room.recapSeq || 0) + 1),
    at: Date.now(), party: !!(pm && pm.phase === 'done'),
    minutes: room.nightStart ? Math.max(1, Math.round((room.now() - room.nightStart) / 60000)) : null,
    played: played.map((g) => ({ game: g.game, title: g.title, winner: g.winner, winnerId: g.winnerId || null, top: g.top || [], n: g.n || 0, fav: g.fav || null })),
    board: board.slice(0, 16).map((r) => ({ id: r.id, name: r.name, avatar: r.avatar, color: r.color, pts: r.pts, wins: r.wins, games: r.games, bot: r.bot })),
    players: board.length,
    champion: board[0] ? { id: board[0].id, name: board[0].name, avatar: board[0].avatar, color: board[0].color, pts: board[0].pts, wins: board[0].wins } : null,
    moments: moments(played),
    awards: awards(board, played),
    audience: room.audienceCount ? room.audienceCount() : 0,
  };
}

// One player's card for their phone.
function personalRecap(room, recap, p) {
  const board = room.partyBoard(), i = board.findIndex((r) => r.id === p.id), row = board[i] || { pts: 0, wins: 0, games: 0 };
  const mine = room.played.filter((g) => (g.top || []).some((t) => t.id === p.id) || g.winnerId === p.id);
  const best = mine.map((g) => ({ title: g.title, game: g.game, place: (g.top || []).findIndex((t) => t.id === p.id) + 1 })).filter((x) => x.place > 0).sort((a, b) => a.place - b.place)[0] || null;
  return {
    id: recap.id, rank: i >= 0 ? i + 1 : null, of: board.length, pts: row.pts, wins: row.wins, games: row.games, played: room.played.length, best,
    awards: recap.awards.filter((a) => a.id === p.id).map(({ icon, title, desc }) => ({ icon, title, desc })),
    champion: recap.champion ? recap.champion.name : null, me: p.id === (recap.champion && recap.champion.id),
    trophies: (p.nightTrophies || []).slice(-6),
  };
}

module.exports = { buildRecap, personalRecap, FILLERS };
