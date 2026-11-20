'use strict';
// The message main.js passes in the query (?msg=...).
const msg = new URLSearchParams(location.search).get('msg');
if (msg) {
  document.getElementById('msg').textContent = msg;
  if (/went wrong/i.test(msg)) document.querySelector('.spinner').hidden = true;
}
