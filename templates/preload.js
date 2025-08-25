const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  runPoseInterp: (folderPath) => ipcRenderer.invoke('run-poseinterp', folderPath),
  runRenderVideo: () => ipcRenderer.invoke('run-rendervideo'),
  saveVideo: () => ipcRenderer.invoke('save-video'),
  onPythonLog: (callback) => ipcRenderer.on('python-log', (event, data) => callback(data)),
  onPythonError: (callback) => ipcRenderer.on('python-error', (event, data) => callback(data)),
});
