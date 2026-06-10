const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('launcherApi', {
  getState() {
    return ipcRenderer.invoke('launcher:get-state');
  },
  saveConfig(config) {
    return ipcRenderer.invoke('launcher:save-config', config);
  },
  startSession() {
    return ipcRenderer.invoke('launcher:start-session');
  },
  stopSession() {
    return ipcRenderer.invoke('launcher:stop-session');
  },
  onState(listener) {
    const wrapped = (_event, payload) => listener(payload);
    ipcRenderer.on('launcher:state', wrapped);
    return () => ipcRenderer.removeListener('launcher:state', wrapped);
  },
});
