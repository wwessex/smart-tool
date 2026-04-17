const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("smartToolDesktop", {
  isDesktopApp: true,
  platform: process.platform,
  version: process.env.npm_package_version || "0.0.0",
  desktopHelper: {
    health: () => ipcRenderer.invoke("desktop-helper:health"),
    load: (modelId) => ipcRenderer.invoke("desktop-helper:load", modelId),
    generate: (prompt, config) => ipcRenderer.invoke("desktop-helper:generate", prompt, config),
    unload: () => ipcRenderer.invoke("desktop-helper:unload"),
  },
  syncFolder: {
    getState: () => ipcRenderer.invoke("desktop-sync:get-state"),
    selectFolder: () => ipcRenderer.invoke("desktop-sync:select-folder"),
    clearFolder: () => ipcRenderer.invoke("desktop-sync:clear-folder"),
    writeTextFile: (filename, content) => ipcRenderer.invoke("desktop-sync:write-text-file", filename, content),
  },
});
