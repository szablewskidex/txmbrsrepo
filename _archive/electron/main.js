const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    title: 'PianoRollAI',
    backgroundColor: '#1a1d1c',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    icon: path.join(__dirname, '../public/icons/icon-192.png'),
  });

  // Load app
  const isDev = process.env.NODE_ENV === 'development';
  
  if (isDev) {
    mainWindow.loadURL('http://localhost:9003');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../out/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Handle MIDI file save
ipcMain.handle('save-midi-file', async (event, { fileName, midiData }) => {
  try {
    const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
      title: 'Save MIDI File',
      defaultPath: fileName,
      filters: [
        { name: 'MIDI Files', extensions: ['mid', 'midi'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });

    if (canceled || !filePath) {
      return { success: false, canceled: true };
    }

    // Convert base64 to buffer if needed
    const buffer = Buffer.from(midiData, 'base64');
    fs.writeFileSync(filePath, buffer);

    return { success: true, filePath };
  } catch (error) {
    console.error('Error saving MIDI file:', error);
    return { success: false, error: error.message };
  }
});

// Handle export to FL Studio folder
ipcMain.handle('export-to-fl-studio', async (event, { fileName, midiData }) => {
  try {
    // Common FL Studio MIDI folders
    const possiblePaths = [
      path.join(process.env.USERPROFILE, 'Documents', 'Image-Line', 'FL Studio', 'MIDI'),
      path.join(process.env.USERPROFILE, 'Documents', 'FL Studio', 'MIDI'),
      path.join(process.env.APPDATA, 'Image-Line', 'FL Studio', 'MIDI'),
    ];

    // Find first existing path
    let flStudioPath = null;
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        flStudioPath = p;
        break;
      }
    }

    if (!flStudioPath) {
      // Ask user to select FL Studio MIDI folder
      const { filePaths, canceled } = await dialog.showOpenDialog(mainWindow, {
        title: 'Select FL Studio MIDI Folder',
        properties: ['openDirectory'],
        defaultPath: path.join(process.env.USERPROFILE, 'Documents'),
      });

      if (canceled || !filePaths || filePaths.length === 0) {
        return { success: false, canceled: true };
      }

      flStudioPath = filePaths[0];
    }

    const filePath = path.join(flStudioPath, fileName);
    const buffer = Buffer.from(midiData, 'base64');
    fs.writeFileSync(filePath, buffer);

    return { success: true, filePath };
  } catch (error) {
    console.error('Error exporting to FL Studio:', error);
    return { success: false, error: error.message };
  }
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});
