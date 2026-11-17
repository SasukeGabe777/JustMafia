'use strict';
// JustGameBox text filter: swaps swear words and slurs in player-typed text for a
// grawlix (#@$!). One word list for both sides:
//   - the server: require('../public/box/filter') (box/room.js room.cleanText(s))
//   - the TV: window.BOX_FILTER, wired up as BOX.filterText(s) in tv.js
// Words are matched whole (after undoing l33t-speak and stretched letters) so names like
// "Scunthorpe" or "class" stay as they are. STEMS also catch longer forms ("fucking").
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BOX_FILTER = api;
}(typeof self !== 'undefined' ? self : this, function () {
  // Bad at the start of any word.
  const STEMS = ['fuck', 'fuk', 'fck', 'phuck', 'motherf', 'shit', 'bullshit', 'cunt', 'bitch', 'biatch', 'whore', 'slut', 'cocksuck', 'dickhead', 'pussy', 'twat', 'wank', 'bollock',
    'nigg', 'faggot', 'fagot', 'retard', 'tranny', 'wetback', 'beaner', 'raghead', 'towelhead', 'jizz', 'dildo', 'porn', 'rapist', 'molest', 'pedophil', 'paedophil'];
  // Bad only as the whole word (they hide inside harmless words otherwise).
  const WORDS = ['ass', 'asses', 'arse', 'asshole', 'assholes', 'arsehole', 'jackass', 'dumbass', 'fag', 'fags', 'cum', 'cums', 'tit', 'tits', 'titty', 'titties', 'boob', 'boobs', 'damnit',
    'goddamn', 'bastard', 'bastards', 'piss', 'pissed', 'crap', 'prick', 'pricks', 'rape', 'raped', 'raping', 'sex', 'sexy', 'nude', 'nudes', 'naked', 'horny', 'kys', 'stfu', 'wtf', 'milf', 'hoe', 'hoes', 'nig', 'negro',
    'cock', 'cocks', 'dick', 'dicks', 'spic', 'spics', 'paki', 'pakis', 'coon', 'coons', 'kike', 'kikes', 'chink', 'chinks', 'gook', 'gooks', 'dyke', 'dykes', 'nazi', 'nazis', 'spastic', 'spaz', 'pedo', 'pedos'];
  // Mild words only covered in family mode (strict).
  const FAMILY_ONLY = new Set(['sex', 'sexy', 'nude', 'nudes', 'naked', 'crap', 'piss', 'pissed', 'damnit', 'goddamn']);
  const LEET = { '0': 'o', '1': 'i', '!': 'i', '3': 'e', '4': 'a', '@': 'a', '5': 's', '$': 's', '7': 't', '+': 't', '8': 'b', '9': 'g', '|': 'i', '€': 'e' };
  const stemSet = STEMS.slice().sort((a, b) => b.length - a.length);
  const wordSet = new Set(WORDS);
  // Normalise one word: lower case, l33t letters back to letters, drop separators, squash runs.
  function norm(w) {
    let s = String(w).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');
    s = s.replace(/[01!3@4$57+89|€]/g, (c) => LEET[c] || c).replace(/[^a-z]/g, '');
    return s;
  }
  const squash = (s) => s.replace(/(.)\1+/g, '$1');
  function badWord(w, strict) {
    const n = norm(w); if (n.length < 2) return false;
    const variants = [n, squash(n)];
    for (const v of variants) {
      if (wordSet.has(v) && (strict || !FAMILY_ONLY.has(v))) return true;
      if (v.endsWith('s') && wordSet.has(v.slice(0, -1)) && (strict || !FAMILY_ONLY.has(v.slice(0, -1)))) return true;
      for (const st of stemSet) if (v.startsWith(st)) return true;
    }
    return false;
  }
  const GRAWLIX = '#@$%&!*';
  const cover = (w) => { let o = w.charAt(0); for (let i = 1; i < w.length; i++) o += GRAWLIX[i % GRAWLIX.length]; return o; };
  // A "word" here also spans l33t symbols and dotted spellings (f.u.c.k, sh!t).
  const TOKEN = /[\p{L}\p{N}@$!|€*+]+(?:[.\-_ ][\p{L}\p{N}@$!|€*+](?![\p{L}\p{N}]))*/gu;
  // filter(text, { strict }) → the same text with bad words covered. strict = family mode.
  function filter(text, opts = {}) {
    if (text == null) return text;
    const s = String(text); if (!s) return s;
    return s.replace(TOKEN, (tok) => {
      // Spelled out with dots/spaces ("f u c k"): judge the letters together.
      if (/[.\-_ ]/.test(tok)) { const joined = tok.replace(/[.\-_ ]/g, ''); if (joined.length >= 3 && badWord(joined, opts.strict)) return cover(joined); }
      // Trailing "!" is punctuation, not a letter i ("hello!").
      const m = tok.match(/^(.*?)([!|]*)$/), core = m[1] || tok, tail = m[1] ? m[2] : '';
      return badWord(core, opts.strict) ? cover(core) + tail : core + tail;
    });
  }
  const isClean = (text, opts) => filter(text, opts) === String(text == null ? '' : text);
  return { filter, isClean, badWord };
}));
