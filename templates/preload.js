const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  runPython: (folderPath) => ipcRenderer.invoke('run-python', folderPath),
  onPythonLog: (callback) => ipcRenderer.on('python-log', (event, data) => callback(data)),
  onPythonError: (callback) => ipcRenderer.on('python-error', (event, data) => callback(data)),
});
