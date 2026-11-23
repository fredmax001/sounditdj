const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  // File operations
  selectFiles: () => ipcRenderer.invoke('select-files'),
  selectImportFiles: (options) => ipcRenderer.invoke('select-import-files', options),
  selectDirectory: (defaultPath) => ipcRenderer.invoke('select-directory', defaultPath),
  saveFile: (options) => ipcRenderer.invoke('save-file', options),
  readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
  writeFile: (filePath, data) => ipcRenderer.invoke('write-file', filePath, data),
  openPath: (targetPath) => ipcRenderer.invoke('open-path', targetPath),

  // DJ Library Discovery, Import & Analysis
  getDefaultPaths: (source) => ipcRenderer.invoke('get-default-paths', source),
  discoverLibraries: (source, customDir) => ipcRenderer.invoke('discover-libraries', source, customDir),
  parseAndAnalyzeLocalImport: (payload) => ipcRenderer.invoke('parse-and-analyze-local-import', payload),
  cancelLocalImport: () => ipcRenderer.invoke('cancel-local-import'),
  onLocalImportProgress: (callback) => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on('local-import-progress', listener)
    return () => ipcRenderer.removeListener('local-import-progress', listener)
  },

  // Local Library Persistence & Missing Track Relocation
  loadLocalLibrary: () => ipcRenderer.invoke('load-local-library'),
  saveLocalLibrary: (data) => ipcRenderer.invoke('save-local-library', data),
  scanAudioFolder: (folderPath) => ipcRenderer.invoke('scan-audio-folder', folderPath),
  recheckLocalTracks: (tracks) => ipcRenderer.invoke('recheck-local-tracks', tracks),
  relocateMissingTracks: (payload) => ipcRenderer.invoke('relocate-missing-tracks', payload),

  // DJ Software & USB Exports
  exportLocalSoftware: (payload) => ipcRenderer.invoke('export-local-software', payload),
  exportLocalUsb: (payload) => ipcRenderer.invoke('export-local-usb', payload),
  onLocalExportProgress: (callback) => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on('local-export-progress', listener)
    return () => ipcRenderer.removeListener('local-export-progress', listener)
  },

  // USB devices
  getUsbDevices: () => ipcRenderer.invoke('get-usb-devices'),
  browseUsbDevice: (mountPoint, relativePath) => ipcRenderer.invoke('browse-usb-device', mountPoint, relativePath),
  browseUsbDeviceTracks: (mountPoint) => ipcRenderer.invoke('browse-usb-device-tracks', mountPoint),
  inspectUsbDevice: (mountPoint) => ipcRenderer.invoke('inspect-usb-device', mountPoint),
  ejectUsbDevice: (identifier) => ipcRenderer.invoke('eject-usb-device', identifier),
  onUsbDevicesChanged: (callback) => {
    const listener = (_event, payload) => callback(payload)
    ipcRenderer.on('usb-devices-changed', listener)
    return () => ipcRenderer.removeListener('usb-devices-changed', listener)
  },

  // Folders
  openFolder: (folderType) => ipcRenderer.invoke('open-folder', folderType),

  // App info
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getPlatform: () => ipcRenderer.invoke('get-platform'),

  // Platform detection
  isElectron: true,
  isMac: process.platform === 'darwin',
  isWindows: process.platform === 'win32',
  isLinux: process.platform === 'linux',
})

window.addEventListener('dragover', (e) => {
  e.preventDefault()
})

window.addEventListener('drop', (e) => {
  e.preventDefault()
  const files = Array.from(e.dataTransfer.files)
  if (files.length > 0) {
    window.dispatchEvent(new CustomEvent('files-dropped', {
      detail: files.map((f) => ({
        path: f.path,
        name: f.name,
        size: f.size,
        type: f.type,
      })),
    }))
  }
})
