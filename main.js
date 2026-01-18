const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');

let mainWindow;
let currentFilePath = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    backgroundColor: '#2D2D2A',
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile('index.html');

  // Remove default menu clutter
  const menu = Menu.buildFromTemplate([
    {
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'File',
      submenu: [
        { label: 'New', accelerator: 'CmdOrCtrl+N', click: () => mainWindow.webContents.send('file-new') },
        { label: 'Open...', accelerator: 'CmdOrCtrl+O', click: () => handleOpen() },
        { label: 'Save', accelerator: 'CmdOrCtrl+S', click: () => mainWindow.webContents.send('file-save') },
        { label: 'Save As...', accelerator: 'CmdOrCtrl+Shift+S', click: () => mainWindow.webContents.send('file-save-as') },
        { type: 'separator' },
        { label: 'Export...', accelerator: 'CmdOrCtrl+E', click: () => mainWindow.webContents.send('file-export') }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    }
  ]);
  Menu.setApplicationMenu(menu);
}

async function handleOpen() {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [{ name: 'Markdown', extensions: ['md'] }]
  });

  if (!result.canceled && result.filePaths.length > 0) {
    const filePath = result.filePaths[0];
    const content = fs.readFileSync(filePath, 'utf-8');
    currentFilePath = filePath;
    mainWindow.webContents.send('file-opened', { path: filePath, content });
  }
}

// IPC Handlers
ipcMain.handle('save-file', async (event, { content, saveAs }) => {
  let filePath = currentFilePath;

  if (!filePath || saveAs) {
    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath: 'untitled.md',
      filters: [{ name: 'Markdown', extensions: ['md'] }]
    });
    if (result.canceled) return { success: false };
    filePath = result.filePath;
  }

  try {
    fs.writeFileSync(filePath, content, 'utf-8');
    currentFilePath = filePath;
    return { success: true, path: filePath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('export-file', async (event, { content, format }) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: `document.${format}`,
    filters: [{ name: format.toUpperCase(), extensions: [format] }]
  });

  if (result.canceled) return { success: false };

  const tempMd = path.join(app.getPath('temp'), 'nervous-export.md');
  fs.writeFileSync(tempMd, content, 'utf-8');

  return new Promise((resolve) => {
    const outputPath = result.filePath;
    const cmd = `pandoc "${tempMd}" -o "${outputPath}" --from=markdown --standalone`;

    exec(cmd, (error, stdout, stderr) => {
      fs.unlinkSync(tempMd);
      if (error) {
        resolve({ success: false, error: stderr || error.message });
      } else {
        resolve({ success: true, path: outputPath });
      }
    });
  });
});

ipcMain.handle('get-current-path', () => currentFilePath);

ipcMain.on('set-current-path', (event, filePath) => {
  currentFilePath = filePath;
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
