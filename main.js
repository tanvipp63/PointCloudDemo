const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
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

ipcMain.handle('run-poseinterp', (event, folderPath) => {
  return new Promise((resolve, reject) => {
    const os = require('os');
    const pythonPath = os.platform() === 'win32' ?
      path.join(__dirname, 'backend', 'env_backend', 'Scripts', 'python.exe') :
      path.join(__dirname, 'backend', 'env_backend', 'bin', 'python');
    const scriptPath = path.join(__dirname, 'backend', 'app.py');

    const pyProcess = spawn(pythonPath, [scriptPath, '--colmap_dir', folderPath, '--generate_frames']);

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

ipcMain.handle('run-rendervideo', (event) => {
  return new Promise((resolve, reject) => {
    const os = require('os');
    const pythonPath = os.platform() === 'win32' ?
      path.join(__dirname, 'backend', 'env_backend', 'Scripts', 'python.exe') :
      path.join(__dirname, 'backend', 'env_backend', 'bin', 'python');
    const scriptPath = path.join(__dirname, 'backend', 'app.py');

    const pyProcess = spawn(pythonPath, [scriptPath, '--render_rgb']);

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

ipcMain.handle('save-video', async () => {
  try {
    const srcPath = path.join(__dirname, 'outputs', 'rgb.mp4');

    // ensure the source file exists
    if (!fs.existsSync(srcPath)) {
      throw new Error('No video found to save (outputs/rgb.mp4 not found). Render Video first');
    }

    // propose default filename in user's Downloads folder
    const defaultName = 'pointclouddemo_rgb.mp4';
    const defaultPath = path.join(app.getPath('downloads'), defaultName);

    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Save rendered video',
      defaultPath,
      filters: [{ name: 'MP4 video', extensions: ['mp4'] }],
    });

    if (canceled || !filePath) return null;

    await fs.promises.copyFile(srcPath, filePath);

    // shell.showItemInFolder(filePath);

    return filePath;
  } catch (err) {
    throw err;
  }
});