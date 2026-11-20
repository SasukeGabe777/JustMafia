// What the JustMafia narrator SAYS for a line (the TV still SHOWS the full text).
//
// Narrator lines are pre-rendered voice clips (tools/voice-gen.js, `npm run voices`), so the
// spoken words must be the same every time. A template's dynamic parts are handled like a TV
// game-show host would: the screen shows the player's name, the voice says "someone" / "they".
//   {name} {condemned} ...   first mention "someone", later "they / them / their"
//                            (in cutscene captions the victim is on screen: always "they")
//   {town}                   "the town" ("Welcome to town", "in town", ...)
//   {role}                   spoken as its own clip after the line ("They were the Doctor.")
//   {alive} {count} ...      sentences with numbers are not spoken (the HUD shows the count)
// SAY[template] overrides the automatic form where it reads badly ('' = say nothing).
// sayOf(template, { caption, plural }) -> [spoken clips]   (plural: {name} is several people)
// roleSay(rolePhrase) -> 'They were the Doctor.'          (rolePhrase from game.rolePhrase)
(function (root) {
  const SAY = {
    // ----- classic -----
    'Welcome to {town}. {count} souls live here... but not all of them are innocent.': 'Welcome to town. Plenty of souls live here... but not all of them are innocent.',
    '{count} townsfolk gather in {town}. Look closely at your neighbors. One of them may be a killer.': 'The townsfolk gather. Look closely at your neighbors. One of them may be a killer.',
    "A shadow came for {name} last night, but someone was watching over them. {name} was protected and lives to see another day.": 'A shadow came for someone last night... but someone was watching over them. They were protected, and they live to see another day.',
    'Someone tried to kill {name} last night. A protector stepped in, and {name} survived.': 'Someone tried to kill a neighbor last night. A protector stepped in, and they survived.',
    'With {votes} votes against them, {name} is banished from {town}.{role}': 'The votes are against them. They are banished from the town.',
    'A bloody night in {town}. {name} were all found dead.{role} Only {alive} remain.': 'A bloody night in town. They were all found dead.',
    'Dawn reveals {count} bodies. {name} are gone.{role} {alive} remain.': 'Dawn reveals the bodies. They are gone.',
    'The town has made a terrible mistake. {name} was the Jester, and that is exactly what they wanted. The Jester wins!': 'The town has made a terrible mistake. That was the Jester... and that is exactly what they wanted. The Jester wins!',
    'The town has made a terrible mistake. {name} was the Jester, and that is exactly what they wanted! The Jester wins... but the game goes on.': 'The town has made a terrible mistake. That was the Jester... and that is exactly what they wanted! The Jester wins... but the game goes on.',
    'Against all expectation, {name} returns to {town}. The miracle will last only one day.': 'Against all expectation, someone returns to town. The miracle will last only one day.',
    '{accuser} has accused {name}. Hear the accusation before the defense.': 'An accusation has been made. Hear it out, before the defense.',
    '{name}, the floor is yours. What should the town believe?': 'The floor is yours. What should the town believe?',
    'A miracle! {name} returns from the grave.': 'A miracle! Someone returns from the grave.',
    'At the noose, the executioner stops… and pulls off the hood. It is {name}, the Executioner. They set {condemned} free and take their place.': 'At the noose, the executioner stops... and pulls off the hood. It is the Executioner! They set the condemned free, and take their place.',
    'Saved by the Executioner! {name} reveals themselves and gives their life so {condemned} may live.': 'Saved by the Executioner! They reveal themselves, and give their life so the condemned may live.',
    '{name} throws themselves in front of {condemned} and takes their place at the gallows.{role}': 'Someone throws themselves in front of the condemned, and takes their place at the gallows.',
    'At the last moment, {name} pushes {condemned} aside. The town’s justice falls on {name} instead.{role}': 'At the last moment, someone pushes the condemned aside. The town’s justice falls on them instead.',
    'One more round, {name} said. The tavern keeper found them by the door at dawn.{role} {alive} remain.': 'One more round, they said. The tavern keeper found them by the door at dawn.',
    'The first empty chair in {town} belongs to {name}.{role} Take a moment. Then look at the neighbors still beside you.': 'The first empty chair in town. Take a moment. Then look at the neighbors still beside you.',
    // ----- comedy -----
    'Welcome to {town}, population {count}, murderers: yes.': 'Welcome to town. Population: lots. Murderers: yes.',
    '{count} people walk into a town. Statistically, some of them are definitely up to something.': 'A bunch of people walk into a town. Statistically, some of them are definitely up to something.',
    'Bad news: {name} is dead. Good news: more snacks for the rest of you.{role} {alive} remain.': 'Bad news: someone is dead. Good news: more snacks for the rest of you.',
    'Someone tried to ruin {name}’s evening. Their plan needs work. {name} lives!': 'Someone tried to ruin a neighbor’s evening. Their plan needs work. Everybody lives!',
    'The people have spoken, and they said "bye, {name}."{role}': 'The people have spoken. And they said: bye!',
    'Busy night! {name} all died. That is {count} fewer people at brunch.{role} {alive} remain.': 'Busy night! They all died. That is a lot fewer people at brunch.',
    'You voted out {name}... the JESTER. They win. You played yourselves.': 'You voted out... the Jester. They win. You played yourselves.',
    '{name} is back! Turns out they were just napping.': 'Somebody is back! Turns out they were just napping.',
    '{name} said "just one more drink." Famous last words, literally.{role} {alive} remain.': 'Just one more drink, they said. Famous last words. Literally.',
    '{name} went to the field to "find themselves." Someone else found them first.{role} {alive} remain.': 'Someone went to the field to find themselves. Someone else found them first.',
    // ----- corporate -----
    'Welcome to the quarterly all-hands at {town}. {count} employees present. Some of them are... restructuring specialists.': 'Welcome to the quarterly all-hands. Everyone is present. Some of them are... restructuring specialists.',
    'HR intercepted a termination notice addressed to {name}. {name} keeps their badge access!': 'HR intercepted a termination notice last night. Everyone keeps their badge access!',
    'Overnight restructuring: {name} have all been let go.{role} {alive} employees remain.': 'Overnight restructuring. They have all been let go.',
    '{name} was the Jester and wanted to be fired all along. They walk away with a severance package. The Jester wins!': 'That was the Jester, and they wanted to be fired all along. They walk away with a severance package. The Jester wins!',
    '{name} went off-site to "think outside the box." The box won.{role} {alive} remain.': 'Someone went off-site to think outside the box. The box won.',
    '{name} took a "wellness walk" by the lake and has been permanently offboarded.{role} {alive} remain.': 'Someone took a wellness walk by the lake, and has been permanently offboarded.',
    // ----- cutscene captions -----
    '{name} and {roommate} shared a home. Tonight, {roommate} slept soundly.': 'They shared a home. Tonight, their housemate slept soundly.',
    'Yesterday, {name} had pointed the finger at {accused}. Had someone been watching?': 'Yesterday, they had pointed the finger at a neighbor. Had someone been watching?',
    'Just yesterday, {name} had stood up for {defended} at the gallows.': 'Just yesterday, they had stood up for a neighbor at the gallows.',
    'Only yesterday, {name} begged the town to spare {defended}. Today, it was their turn.': 'Only yesterday, they begged the town to spare a neighbor. Today, it was their turn.',
    '{name} was protected, and lives to see another day.': 'They were protected... and they live to see another day.',
    'Only {alive} remain. Was it the right choice?': 'Was it the right choice?',
    '{name} was watching {host}’s house.': 'They were watching a neighbor’s house.',
  };

  const NUM = /\{(alive|count|votes|seconds|n)\}/;
  const PEOPLE = 'name|condemned|accuser|host|roommate|defended|accused|guard|villain';
  const OTHER = { roommate: 'their housemate', host: 'a neighbor', condemned: 'the condemned', defended: 'a neighbor', accused: 'a neighbor', accuser: 'someone', guard: 'someone', villain: 'the villain' };
  const AGREE = { was: 'were', is: 'are', has: 'have', 'wasn’t': 'weren’t', "wasn't": "weren't", 'isn’t': 'aren’t', "isn't": "aren't", does: 'do', 'doesn’t': 'don’t', "doesn't": "don't" };
  const KEEP_S = /^(always|across|perhaps|this|his|its|less|unless|was|has|is|does|yes|towards)$/i;
  // A present-tense verb after "they": "lives" -> "live", "pushes" -> "push"; past tense stays.
  function agree(w) {
    if (AGREE[w]) return AGREE[w];
    if (/^[a-z]+s$/.test(w) && !KEEP_S.test(w) && !/ss$/.test(w)) return /(sh|ch|x|z|ss)es$/.test(w) ? w.slice(0, -2) : /ies$/.test(w) ? w.slice(0, -3) + 'y' : w.slice(0, -1);
    return w;
  }
  const cap = (s) => s.replace(/^(\s*["“]?)([a-z])/, (m, a, b) => a + b.toUpperCase());
  // {town} in a sentence -> plain words.
  function town(s) {
    return s.replace(/\bat \{town\}/g, 'in town').replace(/\b(Welcome to|welcome to|to|in|from) \{town\}/g, '$1 town').replace(/\{town\}(’s|'s)/g, 'the town’s')
      .replace(/(^|[.!?…]\s+)\{town\}/g, '$1The town').replace(/\{town\}/g, 'the town');
  }
  // One sentence: people -> someone/they/them/their, or null to leave it out.
  function people(s, st) {
    if (NUM.test(s)) return null;
    const re = new RegExp('\\{(' + PEOPLE + ')\\}(’s|\'s)?(\\s+([A-Za-z’\']+))?', 'g');
    let out = s.replace(re, (m, who, poss, sp, next, off) => {
      const start = /^\s*["“]?$/.test(s.slice(0, off)) || /[.!?…:]\s*["“]?$/.test(s.slice(0, off));
      if (who !== 'name') { const w = OTHER[who] || 'someone'; return (poss ? w + '’s' : w) + (sp || ''); }
      const first = !st.named && !st.caption && !st.plural; st.named = true;
      // "Someone followed {name} home": the line already has a someone, so the victim is "a neighbor".
      const some = st.someone ? 'a neighbor' : 'someone';
      if (poss) return (first ? some + '’s' : 'their') + (sp || '');
      const subject = start || /^(was|is|has|had|will|would|could|can|did|does|were|went|got|took|ran|woke|fought|stayed|lingered|wandered|drove|warmed|stood|walked|blew|came|tried|left|said|never|didn’t|couldn’t|wasn’t|isn’t|also|still|just|all|might|must)$/i.test(next || '') || /ed$/.test(next || '');
      if (subject) {
        if (first) return some + (sp || '');
        return 'they' + (sp ? sp.replace(next, agree(next)) : '');
      }
      return (first ? some : 'them') + (sp || '');
    });
    return cap(town(out));
  }
  const sentences = (t) => (String(t).match(/[^.!?…]+(?:[.!?…]+["”’)]*|$)\s*/g) || [String(t)]).map((x) => x.trim()).filter(Boolean);
  const tidy = (s) => s.replace(/\p{Extended_Pictographic}|️|‍/gu, '').replace(/\{role\}/g, '').replace(/\{\w+\}/g, '').replace(/\s+([.,!?])/g, '$1').replace(/\s+/g, ' ').trim();
  function sayOf(tpl, o = {}) {
    if (tpl == null) return [];
    const over = Object.prototype.hasOwnProperty.call(SAY, tpl) ? SAY[tpl] : null;
    if (over != null) return sentencesOf(over);
    const st = { caption: !!o.caption, plural: !!o.plural, someone: /\bsome(one|body)\b/i.test(tpl), named: false };
    const out = [];
    for (const s0 of sentences(String(tpl).replace(/\{role\}/g, ''))) { const s = people(s0, st); if (s && /[A-Za-z]/.test(tidy(s))) out.push(tidy(s)); }
    return sentencesOf(out.join(' '));
  }
  // The spoken text is split into clips at sentence ends only when it is long (one clip per
  // sentence would sound choppy); a clip holds up to ~220 characters.
  function sentencesOf(t) {
    const s = sentences(t), out = [];
    for (const x of s) { if (out.length && (out[out.length - 1] + ' ' + x).length <= 220) out[out.length - 1] += ' ' + x; else out.push(x); }
    return out.map(tidy).filter(Boolean);
  }
  // " They were the Med-Bay Surgeon (Doctor)." -> "They were the Med-Bay Surgeon."
  const roleSay = (phrase) => (phrase ? tidy('They were ' + String(phrase).replace(/\s*\([^)]*\)/g, '') + '.') : '');

  // ---------- which narrator voice, and the clip key (the same key as public/box/voice.js) ----------
  // Each world has a narrator (a Kokoro voice identity, re-voiced by Chatterbox with the calm
  // 'narrator' preset; see tools/voice-gen.js). Clips live in public/audio/voice/mafia-<voice>/.
  const NARRATOR_VOICE = {
    smalltown: 'bm_george', medieval: 'bm_george', tabletop: 'bm_george', dragons: 'bm_george', dungeon: 'bm_george',
    fantasy: 'bf_emma', snow: 'bf_emma',
    noir: 'am_onyx', fbi: 'am_onyx', spies: 'am_onyx', realistic: 'am_onyx',
    space: 'af_nova', blocky: 'af_nova',
  };
  // The Orpheus voice each narrator is rendered in (dan was the owner's pick for the narrator).
  const ORPHEUS = { bm_george: 'zac', am_onyx: 'dan', bf_emma: 'leah', af_nova: 'jess' };
  const voiceFor = (theme) => { const k = NARRATOR_VOICE[theme] || NARRATOR_VOICE.smalltown; return { kokoro: k, speed: 1, cb: 'narrator', orpheus: ORPHEUS[k] }; };
  // Copies of public/box/voice.js clean() / hash() / keyOf() (tools/test-voice-timing.js checks they match).
  const clean = (s) => String(s || '').replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}\u{20E3}]/gu, '').replace(/["“”]/g, '').replace(/\s+/g, ' ').trim();
  function hash(str) {
    let a = 0x811c9dc5, b = 0x5bd1e995;
    for (const ch of String(str)) { const c = ch.codePointAt(0); a = Math.imul(a ^ c, 0x01000193); b = Math.imul(b ^ c, 0x01000193); b ^= b >>> 13; }
    return (a >>> 0).toString(16).padStart(8, '0') + (b >>> 0).toString(16).padStart(8, '0');
  }
  const keyOf = (text, V) => hash(V.kokoro + '|' + (Number(V.speed) || 1).toFixed(2) + (V.cb ? '|' + V.cb : '') + (V.orpheus ? '|o:' + V.orpheus : '') + '|' + clean(text));

  const API = { SAY, sayOf, roleSay, NARRATOR_VOICE, voiceFor, clean, hash, keyOf };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else root.MT_SAY = API;
})(typeof window !== 'undefined' ? window : globalThis);
