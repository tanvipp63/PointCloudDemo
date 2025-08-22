const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, 'templates/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    }
  });

  mainWindow.loadFile('templates/index.html');
}

app.whenReady().then(createWindow);

ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] });
  if (result.canceled) return null;
  return result.filePaths[0];
});

ipcMain.handle('run-python', (event, folderPath) => {
  return new Promise((resolve, reject) => {
    const os = require('os');
    const pythonPath = os.platform() === 'win32' ?
      path.join(__dirname, 'backend', 'env_backend', 'Scripts', 'python.exe') :
      path.join(__dirname, 'backend', 'env_backend', 'bin', 'python');
    const scriptPath = path.join(__dirname, 'backend', 'app.py');

    const pyProcess = spawn(pythonPath, [scriptPath, '--colmap_dir', folderPath, '--render_rgb']);

    let output = '';
    let error = '';

    pyProcess.stdout.on('data', (data) => {
      output += data.toString();
      mainWindow.webContents.send('python-log', data.toString());
    });

    pyProcess.stderr.on('data', (data) => {
      error += data.toString();
      mainWindow.webContents.send('python-error', data.toString());
    });

    pyProcess.on('close', (code) => {
      if (code === 0) {
        resolve(output);
      } else {
        reject(new Error(`Python script exited with code ${code}\n${error}`));
      }
    });
  });
});
