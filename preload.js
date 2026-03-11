const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  fetchSwagger: () => ipcRenderer.invoke('fetch-swagger'),
  apiRequest:   (opts) => ipcRenderer.invoke('api-request', opts),
  key: {
    load:  ()    => ipcRenderer.invoke('key:load'),
    save:  (key) => ipcRenderer.invoke('key:save', key),
    clear: ()    => ipcRenderer.invoke('key:clear'),
  },
});
