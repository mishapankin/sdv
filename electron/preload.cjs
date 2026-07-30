// Electron runs sandboxed preload scripts as CommonJS.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("sdvDesktop", {
  isDesktop: true,
  getCurrentRepository: () => ipcRenderer.invoke("sdv:get-current-repository"),
  getRecentRepositories: () => ipcRenderer.invoke("sdv:get-recent-repositories"),
  forgetRepository: (directory) =>
    ipcRenderer.invoke("sdv:forget-repository", directory),
  openRepository: () => ipcRenderer.invoke("sdv:open-repository"),
  openRecentRepository: (directory) =>
    ipcRenderer.invoke("sdv:open-recent-repository", directory),
  setTheme: (theme) => ipcRenderer.invoke("sdv:set-theme", theme),
});
