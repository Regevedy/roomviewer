const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
// Release identity (historical release date is metadata; packaging date is separate).
app.setName?.('Room Viewer');
const path = require('path');
const {pathToFileURL} = require('node:url');
const fs = require('fs/promises');
const crypto = require('crypto');
const ProjectCodec = require('./project-codec');
const PROJECT_TYPES = new Set(['box','plane','sphere','cylinder','cone','torus',
  'table','chair','sofa','bed','lamp','bookshelf','door','window_frame']);

const PROJECT_MAX_BYTES = 25 * 1024 * 1024;
const EDITOR_FILE = path.join(__dirname, 'index.html');
const EDITOR_URL = pathToFileURL(EDITOR_FILE).href;

// Every privileged action must originate from this editor's TOP-LEVEL frame.
// An iframe, a different BrowserWindow, or an unexpectedly navigated page
// must not be able to invoke file/window operations merely by knowing a name.
function trustedSender(event) {
  const contents = mainWindow && mainWindow.webContents;
  return !!(contents && event && event.sender === contents
    && event.senderFrame && event.senderFrame === contents.mainFrame
    && event.senderFrame.url === EDITOR_URL);
}

let mainWindow;
let currentProjectPath = null;
let pendingOpen = null;
// Serialize filesystem-backed project operations; stale dialog completions must
// never overwrite a newer project association.
let projectIOBusy = false;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 1000,
    minWidth: 1200,
    minHeight: 800,
    frame: false,
    backgroundColor: '#0a0a0f',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      webviewTag: false,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, '..', 'assets', 'icon.ico'),
    show: false
  });

  // Local offline editor: deny popups, renderer-initiated navigation, frames
  // and permission grants (camera, microphone, notifications, etc.).
  const contents = mainWindow.webContents;
  contents.setWindowOpenHandler(() => ({action:'deny'}));
  for (const name of ['will-navigate','will-frame-navigate','will-redirect','will-attach-webview']) {
    contents.on(name, (event) => event.preventDefault());
  }
  if (contents.session) {
    contents.session.setPermissionRequestHandler?.((_webContents, _permission, callback) => callback(false));
    contents.session.setPermissionCheckHandler?.(() => false);
  }
  mainWindow.loadFile(EDITOR_FILE);

  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('closed', () => {
    mainWindow = null;
    currentProjectPath = null;
    pendingOpen = null;
  });
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

ipcMain.on('minimize-window', (event) => { if (trustedSender(event)) mainWindow.minimize(); });
ipcMain.on('maximize-window', (event) => {
  if (trustedSender(event)) mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize();
});
ipcMain.on('close-window', (event) => { if (trustedSender(event)) mainWindow.close(); });

// Save atomically: a failed write must not truncate the previous project file.
async function atomicWrite(filename, data) {
  const temp = path.join(path.dirname(filename), '.' + path.basename(filename) + '.' + crypto.randomUUID() + '.tmp');
  let handle;
  try {
    handle = await fs.open(temp, 'wx');
    await handle.writeFile(data, 'utf8');
    await handle.sync();
    await handle.close();
    handle = null;
    await fs.rename(temp, filename);
  } finally {
    if (handle) await handle.close().catch(() => {});
    await fs.unlink(temp).catch(() => {});
  }
}

ipcMain.handle('project:save', async (event, payload) => {
  if (!trustedSender(event)) return {ok:false, error:'Недопустимый источник запроса'};
  if (projectIOBusy) return {ok:false, error:'Другая файловая операция ещё выполняется'};
  projectIOBusy = true;
  // Any subsequent Save supersedes an uncommitted Open token. A stale
  // confirmation must never redirect future saves to the previously chosen file.
  pendingOpen = null;
  try {
    if (!payload || typeof payload.data !== 'string' || Buffer.byteLength(payload.data, 'utf8') > PROJECT_MAX_BYTES) {
      throw new Error('Недопустимый размер файла проекта');
    }
    // The privileged side must reject malformed scenes, not only a valid-looking header.
    ProjectCodec.decode(payload.data, PROJECT_TYPES);
    let filename = currentProjectPath;
    if (!filename || payload.saveAs) {
      const chosen = await dialog.showSaveDialog(mainWindow, {
        title: 'Сохранить проект Room Viewer',
        defaultPath: filename || 'Room Viewer Project.rvproj',
        filters: [{name: 'Room Viewer Project', extensions: ['rvproj']}]
      });
      if (!trustedSender(event)) throw new Error('Окно редактора уже закрыто');
      if (chosen.canceled || !chosen.filePath) return {canceled:true};
      filename = chosen.filePath.toLowerCase().endsWith('.rvproj') ? chosen.filePath : chosen.filePath + '.rvproj';
    }
    await atomicWrite(filename, payload.data);
    // Saving may outlive an Electron window close. Do not bind its path to a new window.
    if (!trustedSender(event)) throw new Error('Окно редактора уже закрыто');
    currentProjectPath = filename;
    return {ok:true, name:path.basename(filename)};
  } catch (err) { return {ok:false, error:err.message}; }
  finally { projectIOBusy = false; }
});

ipcMain.handle('project:open', async (event) => {
  if (!trustedSender(event)) return {ok:false, error:'Недопустимый источник запроса'};
  if (projectIOBusy) return {ok:false, error:'Другая файловая операция ещё выполняется'};
  projectIOBusy = true;
  try {
    pendingOpen = null;
    const chosen = await dialog.showOpenDialog(mainWindow, {
      title: 'Открыть проект Room Viewer',
      filters: [{name:'Room Viewer Project', extensions:['rvproj']}],
      properties:['openFile']
    });
    if (!trustedSender(event)) throw new Error('Окно редактора уже закрыто');
    if (chosen.canceled || !chosen.filePaths?.length) return {canceled:true};
    const filename = chosen.filePaths[0];
    if ((await fs.stat(filename)).size > PROJECT_MAX_BYTES) throw new Error('Файл проекта слишком большой');
    const data = await fs.readFile(filename, 'utf8');
    if (Buffer.byteLength(data, 'utf8') > PROJECT_MAX_BYTES) throw new Error('Файл проекта слишком большой');
    ProjectCodec.decode(data, PROJECT_TYPES);
    if (!trustedSender(event)) throw new Error('Окно редактора уже закрыто');
    const token = crypto.randomUUID();
    pendingOpen = {path:filename, token};
    // The renderer applies the scene BEFORE committing the new path.
    return {ok:true, token, name:path.basename(filename), data};
  } catch (err) { return {ok:false, error:err.message}; }
  finally { projectIOBusy = false; }
});

ipcMain.handle('project:commit-open', async (event, token) => {
  if (!trustedSender(event) || projectIOBusy || typeof token !== 'string') return false;
  if (!pendingOpen || token !== pendingOpen.token) return false;
  currentProjectPath = pendingOpen.path;
  pendingOpen = null;
  return true;
});
// The renderer must explicitly release Open tokens when a user declines the
// replacement prompt or applying the selected file fails.
ipcMain.handle('project:discard-open', async (event, token) => {
  if (!trustedSender(event) || projectIOBusy || typeof token !== 'string') return false;
  if (!pendingOpen || pendingOpen.token !== token) return false;
  pendingOpen = null;
  return true;
});
ipcMain.handle('project:new', async (event) => {
  if (!trustedSender(event) || projectIOBusy) return false;
  currentProjectPath = null;
  pendingOpen = null;
  return true;
});
