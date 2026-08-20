// Electron runs sandboxed preload scripts as CommonJS.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("sdvDesktop", {
  isDesktop: true,
  platform: process.platform,
  getCurrentRepository: () => ipcRenderer.invoke("sdv:get-current-repository"),
  getRecentRepositories: () => ipcRenderer.invoke("sdv:get-recent-repositories"),
  forgetRepository: (directory) =>
    ipcRenderer.invoke("sdv:forget-repository", directory),
  openRepository: () => ipcRenderer.invoke("sdv:open-repository"),
  openRecentRepository: (directory) =>
    ipcRenderer.invoke("sdv:open-recent-repository", directory),
  getSettingsPath: () => ipcRenderer.invoke("sdv:get-settings-path"),
  copySettingsPath: () => ipcRenderer.invoke("sdv:copy-settings-path"),
  getTheme: () => ipcRenderer.invoke("sdv:get-theme"),
  setTheme: (theme) => ipcRenderer.invoke("sdv:set-theme", theme),
  getWindowControls: () => ipcRenderer.invoke("sdv:get-window-controls"),
  setWindowControls: (mode) =>
    ipcRenderer.invoke("sdv:set-window-controls", mode),
  windowAction: (action) => ipcRenderer.invoke("sdv:window-action", action),
  showMenu: (menu, position) =>
    ipcRenderer.invoke("sdv:show-menu", menu, position),
});
