const { contextBridge, ipcRenderer } = require('electron');
// Minimal bridge: page scripts cannot access Node.js or arbitrary IPC channels.
contextBridge.exposeInMainWorld('ZakiTechNativeTTS', {
  speak: options => ipcRenderer.invoke('molano-tts:speak', { text: String((options && options.text) || ''), lang: String((options && options.lang) || 'en-US') }),
  stop: () => ipcRenderer.invoke('molano-tts:stop')
});
