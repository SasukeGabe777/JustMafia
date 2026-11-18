'use strict';
// Song lookup for Tune Buzz (box/games/tune.js): players search for real songs on their phones,
// and the TV plays a free 30-second preview of each one.
//
// Where songs come from:
//   * SPOTIFY_CLIENT_ID + SPOTIFY_CLIENT_SECRET set: search Spotify (client-credentials token,
//     cached until it expires) for titles, artists and album art, and read pasted
//     open.spotify.com/track/... links with the Web API. Spotify no longer gives new apps a
//     preview to play, so the playable clip is matched on iTunes (or Deezer) by title + artist.
//   * No Spotify keys: search the iTunes Search API (no key), and read pasted Spotify links with
//     Spotify's public oEmbed (title only), then match that title on iTunes.
//   * Deezer's public search (no key) is the fallback whenever iTunes fails or its budget is spent.
// Only the typed search text (or the pasted link) is ever sent to these services, never anything
// about the players. Every call has a timeout, results are cached, and outgoing calls have a
// global budget so a big party can't get the server blocked (iTunes allows ~20 calls a minute).
const TIMEOUT_MS = 5000;
const MAX_Q = 80, MAX_URL = 300, LIMIT = 8;
const SEARCH_TTL = 30 * 60 * 1000;

let fetchImpl = (...a) => (typeof fetch === 'function' ? fetch(...a) : Promise.reject(new Error('no fetch')));

// ---- caches ----
const songs = new Map(); // id -> song (LRU): { id, title, artist, album, art, preview, explicit, source }
const searches = new Map(); // key -> { at, value }
function remember(song) {
  if (!song || !song.id) return song;
  songs.delete(song.id); songs.set(song.id, song);
  if (songs.size > 5000) songs.delete(songs.keys().next().value);
  return song;
}
function get(id) { return typeof id === 'string' && id.length <= 64 ? songs.get(id) || null : null; }
function cached(key) { const c = searches.get(key); if (!c) return null; if (Date.now() - c.at > SEARCH_TTL) { searches.delete(key); return null; } return c.value; }
function store(key, value) { searches.set(key, { at: Date.now(), value }); if (searches.size > 800) searches.delete(searches.keys().next().value); return value; }

// ---- outgoing budgets (sliding windows) ----
function budget(max, ms) {
  const hits = [];
  return () => { const now = Date.now(); while (hits.length && now - hits[0] > ms) hits.shift(); if (hits.length >= max) return false; hits.push(now); return true; };
}
let canItunes = budget(18, 60000), canDeezer = budget(40, 5000), canSpotify = budget(80, 30000);

async function getJson(url, opts = {}) {
  const ctl = typeof AbortController === 'function' ? new AbortController() : null;
  const t = ctl && setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const r = await fetchImpl(url, { ...opts, ...(ctl ? { signal: ctl.signal } : {}) });
    if (!r || !r.ok) return null;
    return await r.json();
  } catch { return null; } finally { if (t) clearTimeout(t); }
}

// ---- Spotify (optional) ----
const spotifyKeys = () => { const id = process.env.SPOTIFY_CLIENT_ID, secret = process.env.SPOTIFY_CLIENT_SECRET; return id && secret ? { id, secret } : null; };
let token = null; // { value, exp }
async function spotifyToken() {
  const k = spotifyKeys(); if (!k) return null;
  if (token && Date.now() < token.exp - 60000) return token.value;
  if (!canSpotify()) return null;
  const j = await getJson('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { Authorization: 'Basic ' + Buffer.from(k.id + ':' + k.secret).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  });
  if (!j || !j.access_token) return null;
  token = { value: j.access_token, exp: Date.now() + (Number(j.expires_in) || 3600) * 1000 };
  return token.value;
}
async function spotifyGet(path) {
  const tk = await spotifyToken(); if (!tk || !canSpotify()) return null;
  return getJson('https://api.spotify.com/v1' + path, { headers: { Authorization: 'Bearer ' + tk } });
}
const str = (v, n = 120) => String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, '').trim().slice(0, n);
const https = (u) => (typeof u === 'string' && /^https:\/\/[^\s"'<>]+$/.test(u) && u.length < 600 ? u : null);
function fromSpotify(t) {
  if (!t || !t.id || !t.name) return null;
  const imgs = (t.album && Array.isArray(t.album.images) ? t.album.images : []).slice().sort((a, b) => Math.abs((a.width || 300) - 300) - Math.abs((b.width || 300) - 300));
  return { id: 'sp:' + str(t.id, 40), title: str(t.name), artist: str((t.artists || []).map((a) => a && a.name).filter(Boolean).join(', ')), album: str(t.album && t.album.name), art: https(imgs[0] && imgs[0].url), preview: null, explicit: !!t.explicit, source: 'spotify' };
}
function fromItunes(t) {
  if (!t || !t.trackId || !t.trackName) return null;
  return { id: 'it:' + Number(t.trackId), title: str(t.trackName), artist: str(t.artistName), album: str(t.collectionName), art: https(String(t.artworkUrl100 || '').replace(/\/\d+x\d+bb\./, '/300x300bb.')), preview: https(t.previewUrl), explicit: t.trackExplicitness === 'explicit', source: 'itunes' };
}
function fromDeezer(t) {
  if (!t || !t.id || !t.title) return null;
  return { id: 'dz:' + Number(t.id), title: str(t.title), artist: str(t.artist && t.artist.name), album: str(t.album && t.album.title), art: https(t.album && (t.album.cover_medium || t.album.cover)), preview: https(t.preview), explicit: !!t.explicit_lyrics, source: 'deezer' };
}

async function searchItunes(term, limit = LIMIT) {
  if (!canItunes()) return null;
  const j = await getJson(`https://itunes.apple.com/search?term=${encodeURIComponent(term)}&media=music&entity=song&limit=${limit}`);
  return j && Array.isArray(j.results) ? j.results.map(fromItunes).filter((s) => s && s.preview) : null;
}
async function searchDeezer(term, limit = LIMIT) {
  if (!canDeezer()) return null;
  const j = await getJson(`https://api.deezer.com/search?q=${encodeURIComponent(term)}&limit=${limit}`);
  return j && Array.isArray(j.data) ? j.data.map(fromDeezer).filter((s) => s && s.preview) : null;
}
async function searchSpotify(term, limit = LIMIT) {
  const j = await spotifyGet(`/search?type=track&limit=${limit}&q=${encodeURIComponent(term)}`);
  return j && j.tracks && Array.isArray(j.tracks.items) ? j.tracks.items.map(fromSpotify).filter(Boolean) : null;
}
// Free previews (iTunes first, then Deezer) for a search term.
async function searchFree(term, limit) {
  let r = await searchItunes(term, limit);
  if (!r || !r.length) { const d = await searchDeezer(term, limit); if (d) r = d; }
  return r;
}

// ---- matching a preview to a title + artist ----
const loose = (s) => String(s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s*[([].*?[)\]]/g, ' ').replace(/\s+-\s+.*$/, '').replace(/&/g, ' and ').replace(/[^a-z0-9 ]+/g, '').replace(/\s+/g, ' ').trim();
function similar(a, b) { a = loose(a); b = loose(b); return !!a && !!b && (a === b || a.startsWith(b) || b.startsWith(a)); }
const firstArtist = (a) => String(a || '').split(/,| & | x | feat\.? | ft\.? /i)[0].trim();
async function matchPreview(title, artist) {
  const key = 'm:' + loose(title) + '|' + loose(firstArtist(artist));
  const hit = cached(key); if (hit !== null) return hit || null;
  const term = `${loose(title)} ${loose(firstArtist(artist))}`.trim().slice(0, MAX_Q);
  const pickBest = (list) => (list || []).find((s) => similar(s.title, title) && (!artist || loose(s.artist).includes(loose(firstArtist(artist))) || loose(artist).includes(loose(firstArtist(s.artist))))) || null;
  let best = pickBest(await searchItunes(term, 10));
  if (!best) best = pickBest(await searchDeezer(term, 10));
  store(key, best || false);
  return best;
}

// ---- what Tune Buzz calls ----
// A search box: results with title, artist, album art (and a preview unless it comes from Spotify).
async function search(q) {
  q = str(q, 200);
  if (q.length < 2) return { ok: false, error: 'Type a song or an artist.' };
  if (q.length > MAX_Q) return { ok: false, error: `That search is too long (${MAX_Q} letters max).` };
  const key = 'q:' + q.toLowerCase();
  const hit = cached(key); if (hit) { hit.results.forEach(remember); return { ok: true, ...hit }; }
  let results = null, source = 'itunes';
  if (spotifyKeys()) { results = await searchSpotify(q); source = 'spotify'; }
  if (!results) { results = await searchItunes(q); source = 'itunes'; }
  if (!results || !results.length) { const d = await searchDeezer(q); if (d) { results = d; source = 'deezer'; } }
  if (!results) return { ok: false, error: 'The music search is busy right now. Try again in a moment.' };
  const value = store(key, { results: results.slice(0, LIMIT), source });
  value.results.forEach(remember);
  if (!value.results.length) return { ok: true, results: [], source, note: 'No songs found. Try different words.' };
  return { ok: true, ...value };
}

// A pasted link: open.spotify.com/track/…, spotify:track:…, or music.apple.com/…?i=…
function parseLink(u) {
  u = str(u, MAX_URL + 50);
  let m = u.match(/^https?:\/\/open\.spotify\.com\/(?:intl-[a-z]{2}(?:-[a-z]{2})?\/)?track\/([A-Za-z0-9]{22})/i) || u.match(/^spotify:track:([A-Za-z0-9]{22})$/i);
  if (m) return { kind: 'spotify', id: m[1] };
  m = u.match(/^https?:\/\/(?:geo\.)?music\.apple\.com\/.*[?&]i=(\d{4,15})/i);
  if (m) return { kind: 'apple', id: m[1] };
  return null;
}
const isLink = (s) => /^(https?:\/\/|spotify:)/i.test(String(s || '').trim());
async function fromLink(url) {
  if (typeof url !== 'string' || url.length > MAX_URL) return { ok: false, error: 'That link is too long.' };
  const L = parseLink(url.trim());
  if (!L) return { ok: false, error: 'Paste a Spotify song link (open.spotify.com/track/…), or just type the song name.' };
  const key = 'l:' + L.kind + ':' + L.id, hit = cached(key);
  if (hit) { hit.results.forEach(remember); return { ok: true, ...hit }; }
  let results = null;
  if (L.kind === 'apple') {
    if (!canItunes()) return { ok: false, error: 'The music search is busy right now. Try again in a moment.' };
    const j = await getJson(`https://itunes.apple.com/lookup?id=${L.id}&entity=song`);
    results = j && Array.isArray(j.results) ? j.results.map((t) => (t.wrapperType === 'track' ? fromItunes(t) : null)).filter((s) => s && s.preview) : null;
  } else if (spotifyKeys()) {
    const t = fromSpotify(await spotifyGet('/tracks/' + L.id));
    if (t) { remember(t); const r = await pick(t.id); results = r.ok ? [r.song] : []; if (!r.ok) return r; }
  }
  if (!results && L.kind === 'spotify') {
    // No Spotify keys: the public oEmbed gives the title; match it on iTunes / Deezer.
    const j = await getJson(`https://open.spotify.com/oembed?url=${encodeURIComponent('https://open.spotify.com/track/' + L.id)}`);
    const title = j && str(j.title, MAX_Q);
    if (!title) return { ok: false, error: 'Couldn’t read that Spotify link. Try typing the song name instead.' };
    const r = await search(title);
    if (!r.ok) return r;
    results = r.results;
  }
  if (!results) return { ok: false, error: 'Couldn’t read that link. Try typing the song name instead.' };
  results.forEach(remember);
  const value = store(key, { results: results.slice(0, LIMIT), source: L.kind });
  return { ok: true, ...value, note: results.length ? null : 'No playable preview for that song. Try another one!' };
}

// The player chose a result: make sure it has a playable preview (Spotify results get one here).
async function pick(id) {
  const s = get(id);
  if (!s) return { ok: false, error: 'Search again and pick a song from the list.' };
  if (s.preview) return { ok: true, song: s };
  const m = await matchPreview(s.title, s.artist);
  if (!m || !m.preview) return { ok: false, error: 'No free preview to play for that one, sorry! Pick another song.' };
  s.preview = m.preview; s.previewFrom = m.source; if (!s.art) s.art = m.art;
  remember(s);
  return { ok: true, song: s };
}

// A song we only know by name (the bots' picks): find a playable preview and album art.
async function resolveMeta(title, artist) { const m = await matchPreview(title, artist); return m && m.preview ? m : null; }

// Deezer's preview links expire after a while: fetch a fresh one just before the song plays.
async function refresh(song) {
  if (!song || song.source !== 'deezer' || !/^dz:\d+$/.test(song.id || '')) return song;
  const exp = Number((String(song.preview || '').match(/exp=(\d{9,11})/) || [])[1] || 0);
  if (exp && exp * 1000 - Date.now() > 3 * 60 * 1000) return song;
  if (!canDeezer()) return song;
  const t = fromDeezer(await getJson('https://api.deezer.com/track/' + song.id.slice(3)));
  if (t && t.preview) song.preview = t.preview;
  return song;
}

// Tests: swap the network out, and reset the caches and budgets.
function _setFetch(fn) { fetchImpl = fn; }
function _reset() { songs.clear(); searches.clear(); token = null; canItunes = budget(18, 60000); canDeezer = budget(40, 5000); canSpotify = budget(80, 30000); }

module.exports = { search, fromLink, pick, get, remember, resolveMeta, refresh, isLink, parseLink, spotifyEnabled: () => !!spotifyKeys(), _setFetch, _reset };
