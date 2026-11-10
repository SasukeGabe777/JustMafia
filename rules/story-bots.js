'use strict';
// Bot decisions use the same private payload and validated commands as phones.
module.exports = function install(Room) {
  const schedule = Room.prototype.scheduleBots;
  Room.prototype.scheduleBots = function (now = false) {
    schedule.call(this, now); if (!this.settings.botsAuto && !now) return;
    const phaseId = this.phaseId;
    const later = (seconds, fn) => this.later(now ? 20 : this.ms(seconds), () => { if (this.phaseId === phaseId && !this.paused) fn(); });
    for (const p of this.inGame().filter((p) => p.isBot)) {
      const v = this.playerView(p), brain = this.brains.get(p.id); if (!brain) continue;
      if (v.phase === 'night' && v.you.alive) {
        if (v.mafia && v.mafia.canVote) later(2 + this.rng() * 2, () => {
          const own = this.playerView(p), m = own.mafia; if (!m || !m.canVote || !m.targets.length) return;
          const lead = m.picks.find((x) => x.id !== p.id), target = lead ? lead.targetId : brain.night({ ...own, action:{ kind:'kill', targets:m.targets } });
          if (target) { this.voteMafia(p,target); this.sendMafia(p,{ tactic:'suggest',targetId:target }); }
        });
        if (v.special && v.special.mimic) later(1, () => { this.specialAction(p,{ op:'mimic',role:'detective' }); const target = brain.night(this.playerView(p)); if (target) this.nightAction(p,target); });
        if (v.special && v.special.interrupt && this.rng() < .5) later(4, () => this.specialAction(p,{ op:'interrupt' }));
        if (v.role === 'alchemist') later(1, () => {
          const own = this.playerView(p), dead = (own.teammates || []).filter((x) => !x.alive);
          const volatile = own.special.variants.find((x) => x.id === 'volatile');
          if (dead.length && volatile && !volatile.label.includes('(0 left)')) this.chooseVariant(p,'volatile');
        });
        if (v.special && v.special.variants.some((a) => a.id.startsWith('stolen-'))) later(1, () => this.chooseVariant(p,v.special.variants.find((a) => a.id.startsWith('stolen-')).id));
      }
      if (v.phase === 'voting' && !v.you.alive && v.voting && !v.voting.choice) later(3, () => { const t = brain.vote(this.playerView(p)); if (t) this.vote(p,t); });
      if (v.phase === 'discussion' && v.social && v.social.canNominate) later(2 + this.rng() * 4, () => {
        if (this.nomination && this.nomination.state === 'pending') return this.secondNomination(p);
        const own = this.playerView(p), targets = own.players.filter((x) => x.alive && x.id !== p.id && !x.spectator).map((x) => x.id);
        const target = brain.vote({ ...own, voting:{ targets,canSkip:false } }); if (target) this.nominate(p,target);
      });
    }
  };
};
