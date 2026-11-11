// New-player help (Judge setting "New player help", on by default).
// Phone: a "what to do now" line for every phase, a How to Play guide, role explanations
// and one-time first-game tips. TV: a one-line explainer per phase and a lobby how-to.
// Everything here reads only what that screen already shows (a phone's own view, or the
// public TV state), so help can never reveal anything secret.
(function () {
  const R = () => window.MT_ROLES;
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ---------- phone: what should I do right now? ----------
  const NIGHT = {
    kill: (v) => (v.role === 'serialKiller' ? 'Tap who you will kill tonight. Only a protector can stop you.' : 'Agree with your team on who to eliminate: tap a target.'),
    heal: 'Tap someone to protect tonight (it can be you).',
    guard: 'Tap someone to guard. If they are attacked, you take the hit.',
    investigate: (v) => (v.role === 'hunter' ? 'Tap someone to learn their exact role. Your whole team will see it.' : 'Tap someone to investigate. Only you will see the result.'),
    block: 'Tap someone to distract. Their ability fails tonight.',
    shoot: 'Only shoot if you are sure. You can also hold fire.',
    mark: 'Tap who you want dead. If they die, you level up.',
    spy: 'Tap a house to watch who comes and goes.',
    silence: 'Tap someone to silence for tomorrow.',
    photo: 'Tap someone to photograph tonight.',
    bomb: 'Tap a house to plant a delayed bomb.',
    seance: 'Tap a fallen player to learn their role.',
    watch: 'Tap someone to watch. You’ll learn who visits them.',
    alert: 'Tap yourself to go on alert, or hold fire to save your alerts.',
    trap: 'Tap a house to trap. It protects them and catches attackers.',
    link: 'Tap someone to bind your fates (once per game), or hold off.',
    frame: 'Tap someone to make them look like Mafia tonight.',
    clean: 'Tap tonight’s likely victim to hide their role if they die.',
  };
  function phoneHint(v) {
    if (!v || v.isJudge) return null;
    if (v.you && v.you.spectator) return { icon: '🍿', text: 'You’re watching this round. You’ll be dealt in next game.' };
    const alive = v.you && v.you.alive;
    switch (v.phase) {
      case 'lobby': return { icon: '⏳', text: 'Waiting for the host to start. Change your look or your house while you wait.' };
      case 'draft': {
        const d = v.draft || {};
        if (d.stage === 'vote') return { icon: '🗳', text: d.locked ? 'Locked in. Wait for everyone else.' : `Tap Vote on up to ${d.picks} roles you want, then Lock in.` };
        return { icon: '🂠', text: 'Watch the deck. Soon you’ll vote on which roles are in this game.' };
      }
      case 'roleReveal': return { icon: '🤫', text: 'Tap your card to see your secret role. Don’t let anyone see it!' };
      case 'night': {
        if (!alive) return { icon: '👻', text: 'You’re out, but no spoilers! You can still haunt the living for fun.' };
        const a = v.action;
        if (v.mafia && v.mafia.canVote) return { icon: '🔪', text: 'Pick tonight’s target with your team (the Mafia panel). Most votes wins.' };
        if (!a || a.dummy) return { icon: '🤔', text: 'Everyone taps someone at night. Pick who seems most suspicious. It keeps everyone’s secrets safe.' };
        const t = NIGHT[a.kind]; return { icon: '🌙', text: typeof t === 'function' ? t(v) : t || 'Use your ability: tap a player.' };
      }
      case 'dawn': case 'morning': return { icon: '📺', text: 'Eyes on the big screen: see what happened last night.' };
      case 'discussion': {
        if (!alive) return { icon: '👻', text: 'You can’t talk to the living anymore. Watch and enjoy!' };
        const team = v.team;
        if (team === 'mafia') return { icon: '🗣', text: 'Talk it out, and blend in. Point suspicion at someone else (carefully).' };
        if (v.role === 'detective' || v.role === 'sheriff' || v.role === 'sorcerer') return { icon: '🗣', text: 'Use what you learned. But if you reveal yourself, you become a target.' };
        return { icon: '🗣', text: 'Talk it out! Who’s acting strange? Listen for stories that don’t add up.' };
      }
      case 'voting': case 'accusation': case 'defense':
        if (!alive) return { icon: '👻', text: 'The living are voting. No hints, ghost!' };
        return { icon: '🗳', text: v.voting && v.voting.choice ? 'Vote cast. You can change it until voting closes.' : 'Tap who you want to eliminate (or Skip). Most votes is out.' };
      case 'verdict': return v.verdict && (v.verdict.canInterrupt || v.verdict.canProtect || v.verdict.canSacrifice || v.verdict.isCondemned) ? { icon: '⚖️', text: 'You have a special choice right now. See below.' } : { icon: '📺', text: 'The verdict: watch the big screen.' };
      case 'execution': return { icon: '📺', text: 'Watch the big screen.' };
      case 'gameover': return { icon: '🏁', text: 'Game over! Press “Rundown of the game” on the TV to see who did what.' };
      default: return null;
    }
  }

  // ---------- phone: How to Play ----------
  function howToHtml(v, roleLabel) {
    const comp = (v && v.composition) || null;
    const roles = comp ? Object.entries(comp).map(([k, n]) => {
      const ref = R().reference(k); if (!ref) return '';
      return `<li><b>${ref.emoji} ${esc(roleLabel ? roleLabel(k) : ref.name)}${n > 1 ? ` ×${n}` : ''}</b> <span class="muted small">(${esc(ref.teamName)})</span><br><span class="small">${esc(ref.ability)}</span></li>`;
    }).join('') : '';
    return `<div class="howto-card">
      <button class="btn small ghost howto-close" data-howto-close>✕</button>
      <h2>❓ How to play</h2>
      <h3>🎯 The goal</h3>
      <p>Some players are secretly <b>Mafia</b>. Everyone else is the <b>Town</b>. The Town wins by voting out all the Mafia. The Mafia win once they equal or outnumber the Town.</p>
      <h3>🔁 Each round</h3>
      <ol>
        <li><b>Night 🌙</b>: everyone taps someone on their phone. Special roles use their power; the Mafia pick someone to eliminate. Everyone taps, so nobody can tell who has a power.</li>
        <li><b>Dawn 📺</b>: the big screen shows what happened.</li>
        <li><b>Discussion 🗣</b>: talk out loud! Share suspicions, defend yourself, catch the liars.</li>
        <li><b>Vote 🗳</b>: tap who to eliminate. Most votes is out.</li>
      </ol>
      <h3>📱 Your phone</h3>
      <ul><li>Your role is secret. Tap your card to peek, and don’t show anyone.</li><li>The bar at the top always tells you what to do right now.</li><li>If you’re eliminated, you become a ghost: no hints to the living!</li></ul>
      ${roles ? `<h3>🃏 Roles in this game</h3><ul class="howto-roles">${roles}</ul>` : ''}
      <h3>💡 Tips</h3>
      <ul><li>Quiet players are suspicious; so are very loud ones.</li><li>Watch who defends whom, and who votes together.</li><li>Claiming a power role can save you, or get you killed tonight.</li></ul>
      <button class="btn" data-howto-close>Got it!</button>
    </div>`;
  }

  // ---------- phone: what does my role do? ----------
  function roleHelpHtml(role) {
    const ref = R().reference(role); if (!ref) return '';
    return `<details class="role-help"><summary>❓ What does my role do?</summary>
      <p><b>When:</b> ${esc(ref.when)}</p>
      ${ref.restrictions.length ? `<ul>${ref.restrictions.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
      <p><b>How you win:</b> ${esc(ref.win)}</p></details>`;
  }

  // ---------- phone: one-time tips (once per device, the first time it applies) ----------
  const TIPS = [
    { id: 'night1', when: (v) => v.phase === 'night' && v.you.alive, text: 'Psst: at night EVERYONE taps someone, even plain Villagers. That way nobody can tell who has a power. Keep your phone hidden!' },
    { id: 'discuss1', when: (v) => v.phase === 'discussion' && v.you.alive, text: 'This is the fun part: talk out loud! Ask people what they did last night and watch for stories that don’t match.' },
    { id: 'vote1', when: (v) => v.phase === 'voting' && v.you.alive, text: 'Most votes is eliminated. A tie usually means nobody goes. You can change your vote until time runs out.' },
    { id: 'ghost1', when: (v) => v.you && !v.you.alive && !v.you.spectator && v.phase !== 'lobby' && v.phase !== 'gameover', text: 'You’re a ghost now. You know more than the living, so no hints! You can still haunt people for fun.' },
    { id: 'mafia1', when: (v) => !!v.mafia, text: 'You’re Mafia! Your teammates are listed on your role card. Agree on a target each night, then act innocent by day.' },
  ];
  function nextTip(v, seen) {
    if (!v || v.isJudge || !v.you) return null;
    return TIPS.find((t) => !seen.includes(t.id) && t.when(v)) || null;
  }

  // ---------- TV: one line per phase, and the lobby how-to ----------
  const TV = {
    lobby: 'Scan the QR code with your phone camera to join. No app needed!',
    draft: 'Vote on your phone for the roles you want in this game.',
    roleReveal: 'Check your phone for your secret role. Don’t show anyone!',
    night: 'Night: everyone, tap someone on your phone. Keep it secret!',
    dawn: 'What happened in the night…',
    morning: 'Listen to the narrator: who didn’t make it?',
    discussion: 'Talk it out! Who’s lying? Who seems suspicious?',
    voting: 'Vote on your phone: who should be eliminated?',
    verdict: 'The votes are in…',
    execution: 'The town’s verdict.',
    gameover: 'Press “Rundown of the game” to see who did what.',
  };
  const tvLine = (st) => (st && st.help ? TV[st.phase] || null : null);
  const LOBBY_STEPS = ['📱 Scan the code and pick a name', '🤫 Get a secret role on your phone', '🌙 At night, everyone taps someone', '🗣 By day, talk and vote out the Mafia'];

  window.MT_HELP = { phoneHint, howToHtml, roleHelpHtml, nextTip, tvLine, LOBBY_STEPS, TIPS };
})();
