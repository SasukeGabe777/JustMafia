'use strict';
// Only the app's own settings page (ui/settings.html) gets this bridge. Game pages, local or
// from an online server, get no preload at all. main.js also checks every call's sender.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('jgb', {
  state: () => ipcRenderer.invoke('jgb:state'),
  testUrl: (url) => ipcRenderer.invoke('jgb:test-url', String(url || '')),
  save: (patch) => ipcRenderer.invoke('jgb:save', patch),
  open: (what) => ipcRenderer.invoke('jgb:open', String(what || '')),
  close: () => ipcRenderer.invoke('jgb:close'),
  quit: () => ipcRenderer.invoke('jgb:quit'),
});
