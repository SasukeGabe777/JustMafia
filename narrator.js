'use strict';
// Template-driven narrator. The game engine decides *what* happened;
// the narrator only decides how to say it. (An AI narrator can replace
// line() later without touching game rules.)

const LINES = {
  classic: {
    start: [
      'Welcome to {town}. {count} souls live here... but not all of them are innocent.',
      '{count} townsfolk gather in {town}. Look closely at your neighbors. One of them may be a killer.',
    ],
    roleReveal: ['Check your phones, and keep your secrets close. Some of you are not who you seem.'],
    night: [
      'Night falls over {town}. Lock your doors...',
      'Darkness creeps across {town}. Somewhere, a terrible plan is unfolding...',
      'An unusually quiet night falls over {town}. But somewhere in the dark, someone is wide awake.',
    ],
    kill: [
      'The town awakens to a terrible discovery. {name} was found dead.{role} Only {alive} townspeople remain.',
      'A scream at dawn. {name} will not be joining us today.{role} {alive} remain.',
    ],
    saved: [
      "A shadow crept to {name}'s door last night. What happened behind it remains a mystery, but {name} lives to see another day.",
      'Someone came for {name}. When the shadows cleared, {name} was still standing.',
    ],
    quiet: ['An unusually quiet night. Everyone wakes up safe... for now.'],
    discussion: [
      'Who among you has blood on their hands? Discuss.',
      'The killer walks among you. Speak up, or stay silent and look suspicious.',
    ],
    voting: ['The time for talk is over. Cast your votes!', 'Enough talk. Point your fingers and vote now.'],
    votesIn: ['The votes are in...'],
    eliminated: [
      'The town has spoken. {name} is led away from the square.{role}',
      'With {votes} votes against them, {name} is banished from {town}.{role}',
    ],
    tie: ['A tie! The town is divided, and no one is eliminated today.'],
    noElim: ['The town could not agree. No one is eliminated today.'],
    townWin: ['The last of the Mafia has fallen. {town} is safe at last!'],
    mafiaWin: ['The Mafia now control {town}. The streets belong to them.'],
    multiKill: ['A bloody night in {town}. {name} were all found dead.{role} Only {alive} remain.', 'Dawn reveals {count} bodies. {name} are gone.{role} {alive} remain.'],
    jesterWin: ['The town has made a terrible mistake. {name} was the Jester, and that is exactly what they wanted. The Jester wins!'],
    skWin: ['When the dust settles, only the Serial Killer is left standing in {town}.'],
    draw: ['Nobody is left to claim {town}. It is a draw.'],
    judgeKill: ['By order of the Judge, {name} is removed from {town}.{role}'],
    revive: ['A miracle! {name} returns from the grave.'],
  },
  comedy: {
    start: [
      'Welcome to {town}, population {count}, murderers: yes.',
      '{count} people walk into a town. Statistically, some of them are definitely up to something.',
    ],
    roleReveal: ['Look at your phone. Now look at your neighbor. Now back at your phone. Act natural. Not THAT natural.'],
    night: [
      'Night falls. Everyone goes to sleep, except for the people who absolutely should not.',
      "Bedtime in {town}. If you hear footsteps, it's probably nothing. Probably.",
    ],
    kill: [
      '{name} has been eliminated. Thoughts and prayers.{role} {alive} people remain, nervously.',
      'Bad news: {name} is dead. Good news: more snacks for the rest of you.{role} {alive} remain.',
    ],
    saved: ['Someone tried to ruin {name}’s evening. Their plan needs work. {name} lives!'],
    quiet: ['Nobody died last night! The Mafia either overslept or are plotting something big. Probably the second one.'],
    discussion: ['Time to discuss. Remember: the loudest person is either innocent or REALLY guilty.'],
    voting: ['Voting time! Choose wisely, or at least choose dramatically.'],
    votesIn: ['The votes are in. Drumroll please...'],
    eliminated: ['{name} has been voted off the island.{role}', 'The people have spoken, and they said "bye, {name}."{role}'],
    tie: ['A tie! Democracy has failed us. Nobody leaves today.'],
    noElim: ['The town chickened out. Nobody is eliminated.'],
    townWin: ['The Mafia are gone! {town} celebrates with a modest potluck.'],
    mafiaWin: ['The Mafia win! {town} is now under new management.'],
    multiKill: ['Busy night! {name} all died. That is {count} fewer people at brunch.{role} {alive} remain.'],
    jesterWin: ['You voted out {name}... the JESTER. They win. You played yourselves.'],
    skWin: ['The Serial Killer wins. In fairness, they did put in the most hours.'],
    judgeKill: ['The Judge has spoken: {name} is out. No refunds.{role}'],
    revive: ['{name} is back! Turns out they were just napping.'],
  },
  corporate: {
    start: [
      'Welcome to the quarterly all-hands at {town}. {count} employees present. Some of them are... restructuring specialists.',
    ],
    roleReveal: ['Please check your phones for your confidential role assignment. Do not reply-all.'],
    night: [
      'The office closes for the night. Somewhere, a calendar invite titled "Quick Chat" is being sent...',
      'After hours at {town}. The Mafia have booked a meeting room with no windows.',
    ],
    kill: [
      'Effective immediately, {name} is no longer with the company.{role} {alive} employees remain.',
      '{name} was let go overnight. Their stapler has already been claimed.{role} {alive} remain.',
    ],
    saved: ['HR intercepted a termination notice addressed to {name}. {name} keeps their badge access!'],
    quiet: ['No layoffs last night. Leadership calls this "a period of strategic patience."'],
    discussion: ["Let's circle back on who's been sabotaging the team. Discussion is open. No idea is a bad idea."],
    voting: ['Please submit your votes. This meeting could have been an email, but here we are.'],
    votesIn: ['The results of the performance review are in...'],
    eliminated: ['After careful review, {name} has been offboarded.{role}'],
    tie: ['The vote is tied. The decision has been escalated to a committee that will never meet.'],
    noElim: ['No consensus reached. Action item: vote better next time.'],
    townWin: ['The Mafia have been fully offboarded. {town} hits its quarterly targets!'],
    mafiaWin: ['The Mafia have completed their hostile takeover of {town}.'],
    multiKill: ['Overnight restructuring: {name} have all been let go.{role} {alive} employees remain.'],
    jesterWin: ['{name} was the Jester and wanted to be fired all along. They walk away with a severance package. The Jester wins!'],
    skWin: ['A lone contractor has outlasted the entire company. The Serial Killer wins.'],
    judgeKill: ['Per executive decision, {name} has been offboarded.{role}'],
    revive: ['{name} has been rehired as a consultant.'],
  },
};

const STYLES = Object.keys(LINES);
Object.assign(LINES.classic, {
  explosion: ['A peaceful moment in {town}. A suspicious hiss. Then {name}’s home vanishes in smoke. {empty}', 'Someone forgot to put out a fuse at {name}’s house. The whole town has noticed. {empty}'],
  silenced: ['One voice in {town} has fallen quiet for the day.'],
  hustler: ['The clock lurches forward. You have {seconds} seconds to make your case. Choose your words carefully.'],
  storymaker: ['A bell breaks the darkness. The narrative has shifted. Everyone to the square: an immediate vote must happen now!'],
  ash: ['Borrowed time runs out. {name} scatters into ash as night returns.'],
  volatile: ['Against all expectation, {name} returns to {town}. The miracle will last only one day.'],
  nomination: ['{accuser} has accused {name}. Hear the accusation before the defense.'],
  defense: ['{name}, the floor is yours. What should the town believe?'],
  ghostVote: ['A cold breeze moves through the square. A voice from beyond joins the ballot.'],
  emergencyVote: ['Leave your nighttime plans where they are. The town must vote now.'],
});

// Update 4: where a lone night victim was found (AI narrator only). {host} is
// whose house an inspector was watching. Home deaths keep the classic 'kill' lines.
Object.assign(LINES.classic, {
  kill_lake: ['{name} stayed at the lake a little too long. The water is still now.{role} {alive} remain.', 'Ripples spread across the lake at dawn, and {name} never came home.{role} {alive} remain.'],
  kill_hearth: ['The hearth burned low last night. {name} was found beside the cold embers.{role} {alive} remain.', '{name} lingered by the hearth for one more warm moment. It was their last.{role} {alive} remain.'],
  kill_tavern: ['{name} was the last to leave the tavern. They never made it home.{role} {alive} remain.', 'One more round, {name} said. The tavern keeper found them by the door at dawn.{role} {alive} remain.'],
  kill_field: ['{name} wandered into the field outside town to watch the stars. Only the crows saw what happened.{role} {alive} remain.', 'Beyond the last fence of {town}, in the tall grass, lies {name}.{role} {alive} remain.'],
  kill_visit: ['{name} was watching {host}’s house a little too closely. Someone was watching {name}, too.{role} {alive} remain.', 'They found {name} beneath {host}’s window, notebook still in hand.{role} {alive} remain.'],
});
Object.assign(LINES.comedy, {
  kill_lake: ['{name} went for a midnight swim. Lifeguard on duty: nobody.{role} {alive} remain.'],
  kill_hearth: ['{name} got a little too cozy by the hearth. Permanently cozy.{role} {alive} remain.'],
  kill_tavern: ['{name} said "just one more drink." Famous last words, literally.{role} {alive} remain.'],
  kill_field: ['{name} went to the field to "find themselves." Someone else found them first.{role} {alive} remain.'],
  kill_visit: ['{name} was snooping on {host}. Snooping is a high-risk hobby.{role} {alive} remain.'],
});
Object.assign(LINES.corporate, {
  kill_lake: ['{name} took a "wellness walk" by the lake and has been permanently offboarded.{role} {alive} remain.'],
  kill_hearth: ['{name} stayed late in the break room by the fireplace. HR has been notified.{role} {alive} remain.'],
  kill_tavern: ['{name} left the team happy hour last. Their badge was deactivated at dawn.{role} {alive} remain.'],
  kill_field: ['{name} went off-site to "think outside the box." The box won.{role} {alive} remain.'],
  kill_visit: ['{name} was auditing {host}’s office after hours. The audit has been closed.{role} {alive} remain.'],
});

function line(style, key, vars = {}, rng = Math.random) {
  let bank = (LINES[style] && LINES[style][key]) || LINES.classic[key] || [''];
  const nightFlavor = {
    medieval: ['Lanterns dim along the lanes of {town}. Behind shuttered cottages, a footstep breaks the silence.', 'The tavern doors close in {town}. Not every traveler has gone to sleep.'],
    space: ['Habitat lights dim across {town}. A motion sensor blinks in an empty corridor.', 'Night cycle begins in {town}. Beyond the glass, the stars keep their secrets.'],
    fantasy: ['The enchanted woods fall silent around {town}. A shadow crosses the moonlit path.', 'Blue embers flicker in {town}. Somewhere, a door opens without a sound.'],
    dragons: ['Ash drifts across the roofs of {town}. Something moves beneath the mountain.', 'The watchfires dim in {town}. A shadow slips between the stones.'],
    dungeon: ['Torches gutter in the passages of {town}. Listen carefully.', 'Stone doors close in {town}. A distant echo sounds like a footstep.'],
    spies: ['Streetlights blink across {town}. Somewhere, a surveillance feed goes dark.', 'The last office closes in {town}. One operative is still at work.'],
    fbi: ['Radios fall quiet in {town}. Someone has slipped past the perimeter.', 'The night shift begins in {town}. Every closed door could conceal a secret.'],
  };
  if (key === 'night' && style === 'classic' && nightFlavor[vars.theme]) bank = nightFlavor[vars.theme];
  if (key === 'kill' && vars.firstDeath && style === 'classic') bank = ['The first empty chair in {town} belongs to {name}.{role} Take a moment. Then look at the neighbors still beside you.'];
  if (key === 'discussion' && vars.alive <= 5 && style === 'classic') bank = ['Only {alive} voices remain in {town}. Think about who benefits from the silence.', 'There are fewer places to hide in {town} now. Choose your words carefully.'];
  const render = (tpl) => tpl.replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? String(vars[k]) : ''));
  const fresh = bank.filter((tpl) => render(tpl) !== vars.previous);
  if (fresh.length) bank = fresh;
  const tpl = bank[Math.floor(rng() * bank.length)];
  return render(tpl);
}

module.exports = { line, STYLES };
