const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // File operations
  saveFile: (content, saveAs = false) => ipcRenderer.invoke('save-file', { content, saveAs }),
  exportFile: (content, format) => ipcRenderer.invoke('export-file', { content, format }),
  getCurrentPath: () => ipcRenderer.invoke('get-current-path'),

  // Event listeners from main process
  onFileNew: (callback) => ipcRenderer.on('file-new', callback),
  onFileOpened: (callback) => ipcRenderer.on('file-opened', (event, data) => callback(data)),
  onFileSave: (callback) => ipcRenderer.on('file-save', callback),
  onFileSaveAs: (callback) => ipcRenderer.on('file-save-as', callback),
  onFileExport: (callback) => ipcRenderer.on('file-export', callback),

  // Cleanup
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel)
});
