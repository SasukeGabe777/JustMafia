const { io } = require('socket.io-client');
const s = io('http://localhost:3100', { transports: ['websocket'] });
s.emit('host:create', {}, async (r) => {
  const a = (t, x = {}) => new Promise((res) => s.emit('host:action', { type: t, ...x }, res));
  await a('settings', { settings: { maxPlayers: 100 } });
  await a('addBots', { count: 9 });
  console.log(r.code + '.' + r.hostKey);
  setTimeout(() => process.exit(0), 60000 * 30); // keep the TV socket alive a while
});
