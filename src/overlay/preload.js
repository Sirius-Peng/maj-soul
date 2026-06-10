const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('overlayApi', {
  onState(listener) {
    const wrapped = (_event, payload) => listener(payload);
    ipcRenderer.on('overlay:state', wrapped);
    return () => ipcRenderer.removeListener('overlay:state', wrapped);
  },
});

