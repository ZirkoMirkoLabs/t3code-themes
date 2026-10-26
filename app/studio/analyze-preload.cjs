'use strict';
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('analyzer', {
  onJob: cb => ipcRenderer.on('analyze:job', (_e, job) => cb(job)),
  done: (id, result) => ipcRenderer.send('analyze:done', id, result),
});
