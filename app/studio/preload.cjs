'use strict';
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('studio', {
  info: () => ipcRenderer.invoke('studio:info'),
  pickFile: kind => ipcRenderer.invoke('studio:pick-file', kind),
  setKey: (id, value) => ipcRenderer.invoke('studio:set-key', id, value),
  testKey: (id, typed) => ipcRenderer.invoke('studio:test-key', id, typed),
  higgsfieldLogin: () => ipcRenderer.invoke('studio:higgsfield-login'),
  openLink: url => ipcRenderer.invoke('studio:open-link', url),
  estimate: opts => ipcRenderer.invoke('studio:estimate', opts),
  run: opts => ipcRenderer.invoke('studio:run', opts),
  finishNow: () => ipcRenderer.invoke('studio:finish-now'),
  apply: id => ipcRenderer.invoke('studio:apply', id),
  openFolder: id => ipcRenderer.invoke('studio:open-folder', id),
  onEvent: cb => ipcRenderer.on('studio:event', (_e, ev) => cb(ev)),
});
