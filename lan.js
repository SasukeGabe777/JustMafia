'use strict';
// Which address can phones on the same Wi-Fi reach this computer at?
// Used by server.js (the join link / QR when PUBLIC_URL is not set) and by the desktop app
// (desktop/main.js: its network-adapter setting lists these).
//
// Every non-internal IPv4 address is scored: private LAN ranges first, Wi-Fi/Ethernet names up,
// and virtual adapters (Hyper-V vEthernet, WSL, VirtualBox, VMware, Docker, VPNs) and link-local
// 169.254.x.x addresses far down, so they are only picked when there is nothing else.
const os = require('os');
const dgram = require('dgram');

const VIRTUAL_NAME = /vEthernet|virtual|vmware|vbox|virtualbox|hyper-v|wsl|docker|podman|loopback|tailscale|zerotier|hamachi|radmin|wireguard|openvpn|tap-?windows|\btun\d*\b|\btap\d*\b|npcap|bluetooth|utun|bridge\d|br-|veth|default switch/i;
// MAC prefixes of virtual NICs: VirtualBox, VMware, Hyper-V, Parallels, QEMU/KVM, Docker.
const VIRTUAL_MAC = /^(0a:00:27|08:00:27|00:50:56|00:0c:29|00:05:69|00:1c:14|00:15:5d|00:1c:42|52:54:00|02:42:)/i;

function scoreOf(name, a) {
  let score = 0;
  if (a.address.startsWith('192.168.')) score += 3;
  else if (a.address.startsWith('10.')) score += 2;
  else if (/^172\.(1[6-9]|2\d|3[01])\./.test(a.address)) score += 1;
  if (a.address.startsWith('169.254.')) score -= 20; // no DHCP answer: nobody can reach it
  if (/wi-?fi|wlan|wireless|ethernet|^en\d|^eth\d/i.test(name)) score += 2;
  const virtual = VIRTUAL_NAME.test(name) || VIRTUAL_MAC.test(a.mac || '');
  if (virtual) score -= 10;
  return { score, virtual };
}

// [{ name, address, score, virtual }] best first.
function lanAddresses() {
  const out = [];
  for (const [name, addrs] of Object.entries(os.networkInterfaces())) {
    for (const a of addrs || []) {
      if (a.family !== 'IPv4' && a.family !== 4) continue;
      if (a.internal) continue;
      out.push({ name, address: a.address, mac: a.mac, ...scoreOf(name, a) });
    }
  }
  return out.sort((x, y) => y.score - x.score);
}

function bestLanAddress() {
  const list = lanAddresses();
  return list.length ? list[0].address : 'localhost';
}

// The address of the adapter that holds the default route (the one the router talks to).
// A UDP "connect" sends no packets; it only asks the OS which local address it would use.
// Resolves null when there is no route (offline) or on any error.
function defaultRouteAddress(timeoutMs = 800) {
  return new Promise((resolve) => {
    let done = false;
    const s = dgram.createSocket('udp4');
    const finish = (v) => { if (done) return; done = true; try { s.close(); } catch { /* closed */ } resolve(v); };
    s.on('error', () => finish(null));
    setTimeout(() => finish(null), timeoutMs).unref();
    try {
      s.connect(53, '192.0.2.1', () => { // TEST-NET-1: never reached, only routed
        try { finish(s.address().address || null); } catch { finish(null); }
      });
    } catch { finish(null); }
  });
}

// The best address, preferring the default-route adapter when it is a sensible LAN address.
async function bestLanAddressAsync() {
  const list = lanAddresses();
  const route = await defaultRouteAddress();
  const hit = route && list.find((x) => x.address === route && !x.virtual && x.score > -5);
  return hit ? hit.address : list.length ? list[0].address : 'localhost';
}

module.exports = { lanAddresses, bestLanAddress, bestLanAddressAsync, defaultRouteAddress };
