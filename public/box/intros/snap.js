'use strict';
// JustSnap intro cutscene (format: the API comment at the top of public/box/show.js).
(function () {
  BOX.intros = BOX.intros || {};
  BOX.intros["snap"] = {
    theme: { accent: '#ffd23f', accent2: '#ff4f9a', accent3: '#3ee6ff' },
    host: null, // or { name, voice, look } for a host with lines
    lines: { roll: 'Here’s tonight’s cast!', play: 'Let’s play {title}!' },
    stage(g) { g.fillStyle = '#1b1240'; g.fillRect(-600, -300, 3120, 1700); g.font = '220px serif'; g.textAlign = 'center'; g.fillText("📸", 960, 620); },
  };
})();
