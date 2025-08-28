const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const isPackaged = app.isPackaged;
const basePath = isPackaged ? process.resourcesPath : __dirname;
const { pathToFileURL } = require('url');
const outputsDir = path.join(app.getPath('userData'), 'outputs');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    webPreferences: {
      preload: path.join(basePath, 'templates/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    }
  });

  mainWindow.loadFile('templates/index.html');
}

/* Event handler for link button to access COLMAP txt */
ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] });
  if (result.canceled) return null;
  return result.filePaths[0];
});

/* Event handler for running pose interpolation and frame generation */
ipcMain.handle('run-poseinterp', (event, folderPath) => {
  return new Promise((resolve, reject) => {
    const os = require('os');
    const pythonPath = os.platform() === 'win32' ?
      path.join(basePath, 'backend', 'env_backend', 'Scripts', 'python.exe') :
      path.join(basePath, 'backend', 'env_backend', 'bin', 'python');
    const scriptPath = path.join(basePath, 'backend', 'app.py');

    const pyProcess = spawn(pythonPath, [scriptPath, '--colmap_dir', folderPath, '--generate_frames', '--output_dir', outputsDir]);

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
/* Runs video rendering with ffmpeg */
ipcMain.handle('run-rendervideo', (event) => {
  return new Promise((resolve, reject) => {
    const os = require('os');
    const pythonPath = os.platform() === 'win32' ?
      path.join(basePath, 'backend', 'env_backend', 'Scripts', 'python.exe') :
      path.join(basePath, 'backend', 'env_backend', 'bin', 'python');
    const scriptPath = path.join(basePath, 'backend', 'app.py');

    const pyProcess = spawn(pythonPath, [scriptPath, '--render_rgb', '--output_dir', outputsDir]);

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
/* Video download for download button */
ipcMain.handle('save-video', async () => {
  try {
    const srcPath = path.join(outputsDir, 'rgb.mp4');

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

/* File watchers and updaters for ply file rendering */
const watchedFilename = 'pointcloud.ply';
const watchedPath = path.join(outputsDir, watchedFilename);

function sendPointcloudUpdated(){
  if (!mainWindow || !mainWindow.webContents) return;
  const fileUrl = pathToFileURL(watchedPath).href;
  mainWindow.webContents.send('pointcloud-updated', fileUrl);
}

function startWatchingOutputs() {
  /* on startup */
  try{
    if (fs.existsSync(watchedPath)) {
      mainWindow.webContents.send('python-log', 'pointcloud.ply exists at startup - sending update');
      sendPointcloudUpdated();
    }
  } catch (e){
    mainWindow.webContents.send('python-error', `Watch startup check failed:\n ${e}`);
  }

  /* new file created */
  try{
    fs.watch(outputsDir, (eventType, filename) => {
      if (!filename) return;
      if (filename == watchedFilename){
        setTimeout(() => {
          if (fs.existsSync(watchedPath)) sendPointcloudUpdated();
        }, 300);
      }
    });
  } catch (e) {
    mainWindow.webContents.send('python-error', `fs.watch of outputs failed (maybe folder is missing): ${e}`);
  }

  /* polling */
  try {
    fs.watchFile(watchedPath, {interval : 1000}, (curr,prev) => {
      if (curr.mtimeMs && curr.mtimeMs != prev.mtimeMs) {
        mainWindow.webContents.send('python-log', 'pointcloud.ply changed - sending update');
        sendPointcloudUpdated();
      }
    });
  } catch (e){
    mainWindow.webContents.send('python-error', `fs.watchFile setup failed ${e}`);
  }
}

app.whenReady().then(() => {
  createWindow();
  mainWindow.webContents.on('did-finish-load', () => {
    try {
      //make outputs directory
      fs.mkdirSync(outputsDir, { recursive: true });
      mainWindow.webContents.send('python-log', `Ensured outputs dir: ${outputsDir}`);
    } catch (err) {
      console.error('Failed to create outputs dir', err);
      if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.send('python-error', `Failed to create outputs dir:\n${err.stack || err}`);
      }
    }    
    startWatchingOutputs();
  });
});