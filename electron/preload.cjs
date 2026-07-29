// Electron runs sandboxed preload scripts as CommonJS.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("sdvDesktop", {
  isDesktop: true,
  getCurrentRepository: () => ipcRenderer.invoke("sdv:get-current-repository"),
  openRepository: () => ipcRenderer.invoke("sdv:open-repository"),
});
