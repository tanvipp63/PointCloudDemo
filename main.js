const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { pathToFileURL } = require('url');
const isPackaged = app.isPackaged;
const resourcesBase = isPackaged ? process.resourcesPath : __dirname;
const outputsDir = path.join(app.getPath('userData'), 'outputs');
const os = require('os');

function debugLog(isError, ...args) {
  console.log(...args);
  if (mainWindow && mainWindow.webContents) {
    if (isError){
      mainWindow.webContents.send('python-error', args.join('\n') + '\n');
    } else {
      mainWindow.webContents.send('python-log', args.join(' ') + '\n');
    }
  }
}

/* Backend running spawn functions */
function resolveBackendRunner() {
  const base = app.isPackaged ? process.resourcesPath : __dirname;
  debugLog(false, 'resolveBackendRunner base=', base, 'isPackaged=', app.isPackaged);

  const exeName = process.platform === 'win32' ? 'app.exe' : 'app';

  // Candidate 1: packaged native exe in extraResources -> resources/backend/dist/<exe>
  const packagedExe = path.join(base, 'backend', 'dist', exeName);

  // Candidate 2: dist exe inside dev environment (if you run --dir builds)
  const devDistExe = path.join(__dirname, 'backend', 'dist', exeName);

  // Candidate 3: venv python (posix / win)
  const venvPython = process.platform === 'win32' ?
    path.join(__dirname, 'backend', 'env_backend', 'Scripts', 'python.exe') :
    path.join(__dirname, 'backend', 'env_backend', 'bin', 'python');

  // Candidate 4: fallback system python3 or python
  const systemPythonCandidates = [ '/usr/bin/python3', '/usr/bin/python', 'python3', 'python' ];

  const candidates = [
    { type: 'exe', path: packagedExe },
    { type: 'exe', path: devDistExe },
    { type: 'python-venv', path: venvPython },
    ...systemPythonCandidates.map(p => ({ type: 'python-system', path: p }))
  ];

  const okCandidates = [];
  for (const c of candidates) {
    try {
      const exists = fs.existsSync(c.path);
      const modeOk = exists ? (process.platform === 'win32' ? true : (fs.statSync(c.path).mode & 0o111) !== 0) : false;
      if (exists && (c.type.startsWith('exe') ? modeOk : true)) {
        okCandidates.push(c);
      }
    } catch (e) {
      debugLog(true, 'check error for', c.path, e && e.message);
    }
  }

  if (okCandidates.length === 0) {
    const tried = candidates.map(c => `${c.path}`).join('\n');
    throw new Error(`No backend executable or python interpreter found. Tried:\n${tried}`);
  }

  const preferred = okCandidates.find(c => c.type === 'exe') || okCandidates[0];
  return preferred;
}

function spawnBackendProcess(args = [], onStdout = () => {}, onStderr = () => {}) {
  let chosen;
  try {
    chosen = resolveBackendRunner();
  } catch (e) {
    debugLog(true, e.message);
    throw e;
  }

  debugLog(false, 'Spawning backend runner');
  if (chosen.type === 'exe') {
    const child = spawn(chosen.path, args, { env: process.env, stdio: ['ignore','pipe','pipe'] });
    child.stdout.on('data', d => onStdout(d.toString()));
    child.stderr.on('data', d => onStderr(d.toString()));
    return child;
  } else {
    const script = path.join(__dirname, 'backend', 'app.py');
    const child = spawn(chosen.path, [script, ...args], { env: process.env, stdio: ['ignore','pipe','pipe'] });
    child.stdout.on('data', d => onStdout(d.toString()));
    child.stderr.on('data', d => onStderr(d.toString()));
    return child;
  }
}

function spawnBackend(flags = []) {
  return new Promise((resolve, reject) => {
    try {
      const child = spawnBackendProcess(
        flags,
        (data) => {
          debugLog(false, data.trim());
        },
        (data) => {
          debugLog(true, data.trim());
        }
      );

      let out = '';
      let err = '';

      if (child.stdout) child.stdout.on('data', d => out += d.toString());
      if (child.stderr) child.stderr.on('data', d => err += d.toString());

      child.on('error', (e) => {
        debugLog(true, 'child process error', e && e.message);
        reject(e);
      });

      child.on('close', (code) => {
        debugLog(false, 'backend exited with code', code);
        if (code === 0) resolve(out);
        else reject(new Error(`Backend exited ${code}\n${err}`));
      });
    } catch (e) {
      reject(e);
    }
  });
}

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

/* Event handler for link button to access COLMAP txt */
ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] });
  if (result.canceled) return null;
  return result.filePaths[0];
});

/* Event handler for running pose interpolation and frame generation */
ipcMain.handle('run-poseinterp', (event, folderPath) => {
  const flags = ['--colmap_dir', folderPath, '--generate_frames', '--output_dir', path.join(app.getPath('userData'), 'outputs')];
  return spawnBackend(flags);
});

/* Runs video rendering with ffmpeg */
ipcMain.handle('run-rendervideo', (event) => {
  const flags = ['--render_rgb', '--output_dir', outputsDir];
  return spawnBackend(flags);
});

/* Video download for download button */
ipcMain.handle('save-video', async () => {
  try {
    const srcPath = path.join(outputsDir, 'rgb.mp4');

    if (!fs.existsSync(srcPath)) {
      throw new Error('No video found to save (outputs/rgb.mp4 not found). Render Video first');
    }

    const defaultName = 'pointclouddemo_rgb.mp4';
    const defaultPath = path.join(app.getPath('downloads'), defaultName);

    const { canceled, filePath } = await dialog.showSaveDialog({
      title: 'Save rendered video',
      defaultPath,
      filters: [{ name: 'MP4 video', extensions: ['mp4'] }],
    });

    if (canceled || !filePath) return null;

    await fs.promises.copyFile(srcPath, filePath);

    return filePath;
  } catch (err) {
    throw err;
  }
});

/* File watchers and updaters for ply file rendering */
const watchedFilename = 'pointcloud.ply';
const watchedPath = path.join(outputsDir, watchedFilename);

function sendPointcloudContents() {
  try {
    if (!mainWindow || !mainWindow.webContents) return;
    if (!fs.existsSync(watchedPath)) {
      mainWindow.webContents.send('pointcloud-error', 'PLY not found');
      return;
    }
    const buffer = fs.readFileSync(watchedPath);
    const b64 = buffer.toString('base64');
    mainWindow.webContents.send('pointcloud-data', { filename: watchedPath, b64 });
  } catch (err) {
    mainWindow.webContents.send('pointcloud-error', `Read failed: ${err.message}`);
  }
}

function sendPointcloudUpdated(){
  if (!mainWindow || !mainWindow.webContents) return;
  const fileUrl = pathToFileURL(watchedPath).href;
  mainWindow.webContents.send('pointcloud-updated', fileUrl);
  sendPointcloudContents();
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