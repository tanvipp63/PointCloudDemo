const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  runPoseInterp: (folderPath) => ipcRenderer.invoke('run-poseinterp', folderPath),
  runRenderVideo: () => ipcRenderer.invoke('run-rendervideo'),
  saveVideo: () => ipcRenderer.invoke('save-video'),
  onPythonLog: (callback) => ipcRenderer.on('python-log', (event, data) => callback(data)), /* More generally used as console log */
  onPythonError: (callback) => ipcRenderer.on('python-error', (event, data) => callback(data)), /* More generally used as console error */
  onPointCloudGenerated: (callback) => ipcRenderer.on('pointcloud-updated', (event, fileUrl) => callback(fileUrl)),
});
