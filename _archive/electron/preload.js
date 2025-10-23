const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electron', {
  saveMidiFile: (fileName, midiData) => 
    ipcRenderer.invoke('save-midi-file', { fileName, midiData }),
  
  exportToFlStudio: (fileName, midiData) => 
    ipcRenderer.invoke('export-to-fl-studio', { fileName, midiData }),
  
  isElectron: true,
});
