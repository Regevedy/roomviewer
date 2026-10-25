'use strict';
const {contextBridge, ipcRenderer} = require('electron');
const windowCommands = new Set(['minimize-window','maximize-window','close-window']);
const projectCommands = new Set(['project:save','project:open','project:commit-open','project:discard-open','project:new']);
contextBridge.exposeInMainWorld('roomViewerDesktop', Object.freeze({
  windowAction: (channel) => {
    if (!windowCommands.has(channel)) throw new Error('Недопустимая команда окна');
    ipcRenderer.send(channel);
  },
  invoke: (channel, payload) => {
    if (!projectCommands.has(channel)) return Promise.reject(new Error('Недопустимая команда проекта'));
    return ipcRenderer.invoke(channel, payload);
  }
}));
