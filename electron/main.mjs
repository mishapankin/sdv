import { randomBytes } from "node:crypto";
import {
  mkdir,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  nativeTheme,
  session,
  shell,
  utilityProcess,
} from "electron";

import { getRequestedWorkspace } from "./arguments.mjs";
import { createOperationQueue } from "./operation-queue.mjs";
import {
  forgetRecentRepository,
  parseRecentRepositories,
  rememberRecentRepository,
  serializeRecentRepositories,
} from "./recent-repositories.mjs";
import {
  getDefaultWindowControls,
  parseWindowControls,
  WINDOW_CONTROL_MODES,
} from "./window-controls.mjs";
import { DESKTOP_TOKEN_HEADER } from "../runtime/constants.mjs";
import { preflightWorkspace } from "../runtime/preflight.mjs";
import {
  createServerEnvironment,
  findAvailablePort,
  formatServerUrl,
  resolveStandaloneServerPath,
  waitForServer,
} from "../runtime/server-runtime.mjs";

const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const preloadPath = path.join(packageRoot, "electron", "preload.cjs");
const launcherPath = path.join(packageRoot, "electron", "launcher.html");
const launcherUrl = pathToFileURL(launcherPath).href;
const LOOPBACK_HOST = "127.0.0.1";
const CUSTOM_TITLE_BAR_HEIGHT = 32;
const CUSTOM_MENU_IDS = new Set(["file", "view", "window"]);

let mainWindow;
let activeServer;
let activeOrigin;
let activeRepository;
let initializing = true;
let pendingWorkspace;
let quitting = false;
let windowControlsMode = getDefaultWindowControls(process.platform);
const enqueueWorkspaceOperation = createOperationQueue();

const requestedWorkspace = getRequestedWorkspace(process.argv);
const hasSingleInstanceLock = app.requestSingleInstanceLock(
  requestedWorkspace ? { workspace: requestedWorkspace } : {},
);

if (!hasSingleInstanceLock) {
  app.quit();
}

function getRecentRepositoriesPath() {
  return path.join(app.getPath("userData"), "recent-repositories.json");
}

function getDesktopPreferencesPath() {
  return path.join(app.getPath("userData"), "preferences.json");
}

async function readWindowControlsPreference() {
  try {
    const contents = await readFile(getDesktopPreferencesPath(), "utf8");
    const preferences = JSON.parse(contents);
    return parseWindowControls(preferences?.windowControls, process.platform);
  } catch {
    return getDefaultWindowControls(process.platform);
  }
}

async function writeWindowControlsPreference(mode) {
  const destination = getDesktopPreferencesPath();
  const temporaryPath = `${destination}.${process.pid}-${randomBytes(6).toString("hex")}.tmp`;

  await mkdir(path.dirname(destination), { recursive: true });

  try {
    await writeFile(
      temporaryPath,
      `${JSON.stringify({ windowControls: mode }, null, 2)}\n`,
      "utf8",
    );
    await rename(temporaryPath, destination);
  } catch (error) {
    await rm(temporaryPath, { force: true });
    throw error;
  }
}

async function readRecentRepositories() {
  try {
    const contents = await readFile(getRecentRepositoriesPath(), "utf8");
    return parseRecentRepositories(JSON.parse(contents));
  } catch {
    return [];
  }
}

async function writeRecentRepositories(repositories) {
  const destination = getRecentRepositoriesPath();
  const temporaryPath = `${destination}.${process.pid}-${randomBytes(6).toString("hex")}.tmp`;

  await mkdir(path.dirname(destination), { recursive: true });

  try {
    await writeFile(
      temporaryPath,
      serializeRecentRepositories(repositories),
      "utf8",
    );
    await rename(temporaryPath, destination);
  } catch (error) {
    await rm(temporaryPath, { force: true });
    throw error;
  }
}

async function rememberRepository(directory) {
  const recent = await readRecentRepositories();
  await writeRecentRepositories(rememberRecentRepository(recent, directory));
}

async function forgetRepository(directory) {
  const recent = await readRecentRepositories();
  await writeRecentRepositories(
    forgetRecentRepository(recent, directory),
  );
}

async function getRecentRepositoryViewModels() {
  const recent = await readRecentRepositories();

  return Promise.all(
    recent.map(async (entry) => {
      let available = false;

      try {
        available = (await stat(entry.path)).isDirectory();
      } catch {
        // Keep unavailable entries visible so the user can remove them.
      }

      return {
        available,
        lastOpenedAt: entry.lastOpenedAt,
        name: path.basename(entry.path),
        path: entry.path,
      };
    }),
  );
}

async function getServerPath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "standalone", "server.js");
  }

  return resolveStandaloneServerPath(packageRoot);
}

function pipeServerOutput(server) {
  server.stdout?.on("data", (chunk) => {
    console.log(`[sdv-server] ${chunk.toString().trimEnd()}`);
  });
  server.stderr?.on("data", (chunk) => {
    console.error(`[sdv-server] ${chunk.toString().trimEnd()}`);
  });
}

async function startServer(preflight) {
  const port = await findAvailablePort(LOOPBACK_HOST);
  const token = randomBytes(32).toString("base64url");
  const url = formatServerUrl(LOOPBACK_HOST, port);
  const serverPath = await getServerPath();
  const environment = createServerEnvironment({
    environment: preflight.environment,
    host: LOOPBACK_HOST,
    port,
    workspaceDirectory: preflight.directory,
    token,
  });
  const processHandle = utilityProcess.fork(serverPath, [], {
    cwd: path.dirname(serverPath),
    env: environment,
    serviceName: "SDV Next.js server",
    stdio: "pipe",
  });

  pipeServerOutput(processHandle);

  const exited = new Promise((resolve) => {
    processHandle.once("exit", (code) => resolve(code));
  });

  try {
    await Promise.race([
      waitForServer(url, { token }),
      exited.then((code) => {
        throw new Error(`server exited during startup with code ${code}`);
      }),
    ]);
  } catch (error) {
    processHandle.kill();
    throw error;
  }

  return {
    process: processHandle,
    directory: preflight.directory,
    origin: new URL(url).origin,
    token,
    url,
  };
}

async function stopServer(server) {
  if (!server) return;

  await new Promise((resolve) => {
    const timeout = setTimeout(resolve, 2_000);

    server.process.once("exit", () => {
      clearTimeout(timeout);
      resolve();
    });

    if (!server.process.kill()) {
      clearTimeout(timeout);
      resolve();
    }
  });
}

function installSessionGuards() {
  const applicationSession = session.defaultSession;

  applicationSession.setPermissionRequestHandler(
    (_webContents, _permission, callback) => callback(false),
  );

  applicationSession.webRequest.onBeforeSendHeaders(
    (details, callback) => {
      const requestHeaders = { ...details.requestHeaders };

      if (
        activeOrigin &&
        activeServer &&
        new URL(details.url).origin === activeOrigin
      ) {
        requestHeaders[DESKTOP_TOKEN_HEADER] = activeServer.token;
      }

      callback({ requestHeaders });
    },
  );
}

function isTrustedSender(event) {
  try {
    if (!mainWindow || event.sender !== mainWindow.webContents) {
      return false;
    }

    if (event.senderFrame.url === launcherUrl) {
      return true;
    }

    return (
      activeOrigin !== undefined &&
      new URL(event.senderFrame.url).origin === activeOrigin
    );
  } catch {
    return false;
  }
}

function createWindow(bounds) {
  const useCustomControls =
    process.platform !== "darwin" && windowControlsMode !== "native";
  const window = new BrowserWindow({
    title: "SDV",
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 600,
    ...(bounds || {}),
    show: false,
    backgroundColor: "#181a1f",
    ...(useCustomControls ? { frame: false } : {}),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: preloadPath,
      sandbox: true,
    },
  });

  if (process.platform !== "darwin") {
    window.setMenuBarVisibility(false);
  }

  window.once("ready-to-show", () => window.show());
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (
      url === "https://github.com/ataraxy-labs/sem" ||
      url === "https://github.com/Ataraxy-Labs/inspect"
    ) {
      void shell.openExternal(url);
    }

    return { action: "deny" };
  });
  window.webContents.on("will-navigate", (event, url) => {
    if (
      url !== launcherUrl &&
      (!activeOrigin || new URL(url).origin !== activeOrigin)
    ) {
      event.preventDefault();
    }
  });

  return window;
}

async function recreateMainWindow() {
  const previousWindow = mainWindow;
  const previousUrl = previousWindow?.webContents.getURL();
  const bounds = previousWindow?.getBounds();
  const wasMaximized = previousWindow?.isMaximized();
  const wasFullScreen = previousWindow?.isFullScreen();
  const nextWindow = createWindow(bounds);

  mainWindow = nextWindow;

  try {
    if (activeServer) {
      const targetUrl =
        previousUrl && new URL(previousUrl).origin === activeOrigin
          ? previousUrl
          : activeServer.url;
      await nextWindow.loadURL(targetUrl);
    } else {
      await nextWindow.loadFile(launcherPath);
    }
  } catch (error) {
    mainWindow = previousWindow;
    nextWindow.destroy();
    throw error;
  }

  if (wasMaximized) nextWindow.maximize();
  if (wasFullScreen) nextWindow.setFullScreen(true);
  previousWindow?.destroy();
}

async function openWorkspace(directory) {
  const preflight = preflightWorkspace(directory);

  if (!preflight.ok) {
    dialog.showErrorBox("Unable to open repository", preflight.error);
    return { ok: false, error: preflight.error };
  }

  let nextServer;

  try {
    nextServer = await startServer(preflight);
  } catch (error) {
    const message = `sdv: unable to start the local server: ${error.message}`;
    dialog.showErrorBox("Unable to start SDV", message);
    return { ok: false, error: message };
  }

  const previousServer = activeServer;
  activeServer = nextServer;
  activeOrigin = nextServer.origin;
  activeRepository = nextServer.directory;

  try {
    await mainWindow.loadURL(nextServer.url);
  } catch (error) {
    activeServer = previousServer;
    activeOrigin = previousServer?.origin;
    activeRepository = previousServer?.directory;
    await stopServer(nextServer);

    const message = `sdv: unable to load the viewer: ${error.message}`;
    dialog.showErrorBox("Unable to load SDV", message);
    return { ok: false, error: message };
  }

  await stopServer(previousServer);

  try {
    await rememberRepository(nextServer.directory);
  } catch (error) {
    console.error(`sdv: unable to remember repository: ${error.message}`);
  }

  return { ok: true };
}

async function showLauncher() {
  const previousServer = activeServer;

  activeServer = undefined;
  activeOrigin = undefined;
  activeRepository = undefined;

  try {
    await mainWindow.loadFile(launcherPath);
  } catch (error) {
    activeServer = previousServer;
    activeOrigin = previousServer?.origin;
    activeRepository = previousServer?.directory;
    throw error;
  }

  await stopServer(previousServer);
}

function enqueueOpenWorkspace(directory) {
  return enqueueWorkspaceOperation(() => openWorkspace(directory));
}

function enqueueShowLauncher() {
  return enqueueWorkspaceOperation(showLauncher);
}

async function selectRepository() {
  const selection = await dialog.showOpenDialog(mainWindow, {
    title: "Open Git repository",
    buttonLabel: "Open Repository",
    properties: ["openDirectory"],
  });

  if (selection.canceled || !selection.filePaths[0]) {
    return { ok: false, canceled: true };
  }

  return enqueueOpenWorkspace(selection.filePaths[0]);
}

function installIpcHandlers() {
  ipcMain.handle("sdv:set-theme", (event, theme) => {
    if (!isTrustedSender(event)) {
      throw new Error("untrusted IPC sender");
    }
    if (theme !== "system" && theme !== "light" && theme !== "dark") {
      throw new Error("invalid theme");
    }

    nativeTheme.themeSource = theme;
  });

  ipcMain.handle("sdv:get-window-controls", (event) => {
    if (!isTrustedSender(event)) {
      throw new Error("untrusted IPC sender");
    }

    return {
      mode: windowControlsMode,
      defaultMode: getDefaultWindowControls(process.platform),
      platform: process.platform,
    };
  });

  ipcMain.handle("sdv:set-window-controls", async (event, mode) => {
    if (!isTrustedSender(event)) {
      throw new Error("untrusted IPC sender");
    }
    if (
      process.platform === "darwin" ||
      !WINDOW_CONTROL_MODES.has(mode)
    ) {
      throw new Error("invalid window controls mode");
    }

    await writeWindowControlsPreference(mode);

    if (windowControlsMode !== mode) {
      windowControlsMode = mode;
      setTimeout(() => {
        void recreateMainWindow().catch((error) => {
          console.error(`sdv: unable to apply window controls: ${error.message}`);
        });
      }, 0);
    }
  });

  ipcMain.handle("sdv:window-action", (event, action) => {
    if (!isTrustedSender(event)) {
      throw new Error("untrusted IPC sender");
    }
    if (!mainWindow || !["minimize", "maximize", "close"].includes(action)) {
      throw new Error("invalid window action");
    }

    if (action === "minimize") mainWindow.minimize();
    if (action === "maximize") {
      if (mainWindow.isMaximized()) mainWindow.unmaximize();
      else mainWindow.maximize();
    }
    if (action === "close") mainWindow.close();
  });

  ipcMain.handle("sdv:show-menu", (event, menuId, position) => {
    if (!isTrustedSender(event)) {
      throw new Error("untrusted IPC sender");
    }
    if (
      process.platform === "darwin" ||
      !CUSTOM_MENU_IDS.has(menuId) ||
      typeof position !== "object" ||
      position === null ||
      !Number.isFinite(position.x) ||
      !Number.isFinite(position.y)
    ) {
      throw new Error("invalid menu request");
    }

    const menuItem = Menu.getApplicationMenu()?.getMenuItemById(
      `menu-${menuId}`,
    );

    if (!mainWindow || !menuItem?.submenu) {
      throw new Error("menu is unavailable");
    }

    menuItem.submenu.popup({
      window: mainWindow,
      x: Math.max(0, Math.round(position.x)),
      y: Math.max(CUSTOM_TITLE_BAR_HEIGHT, Math.round(position.y)),
    });
  });

  ipcMain.handle("sdv:get-current-repository", (event) => {
    if (!isTrustedSender(event)) {
      throw new Error("untrusted IPC sender");
    }

    return activeRepository
      ? {
          name: path.basename(activeRepository),
        }
      : null;
  });

  ipcMain.handle("sdv:open-repository", async (event) => {
    if (!isTrustedSender(event)) {
      throw new Error("untrusted IPC sender");
    }

    return selectRepository();
  });

  ipcMain.handle("sdv:get-recent-repositories", async (event) => {
    if (!isTrustedSender(event)) {
      throw new Error("untrusted IPC sender");
    }

    return getRecentRepositoryViewModels();
  });

  ipcMain.handle("sdv:open-recent-repository", async (event, directory) => {
    if (!isTrustedSender(event)) {
      throw new Error("untrusted IPC sender");
    }
    if (typeof directory !== "string" || directory.length > 4096) {
      throw new Error("invalid repository path");
    }

    return enqueueOpenWorkspace(directory);
  });

  ipcMain.handle("sdv:forget-repository", async (event, directory) => {
    if (!isTrustedSender(event)) {
      throw new Error("untrusted IPC sender");
    }
    if (typeof directory !== "string" || directory.length > 4096) {
      throw new Error("invalid repository path");
    }

    await forgetRepository(directory);
    return { ok: true };
  });
}

function installApplicationMenu() {
  const template = [
    ...(process.platform === "darwin"
      ? [
          {
            label: app.name,
            submenu: [
              { role: "about" },
              { type: "separator" },
              { role: "services" },
              { type: "separator" },
              { role: "hide" },
              { role: "hideOthers" },
              { role: "unhide" },
              { type: "separator" },
              { role: "quit" },
            ],
          },
        ]
      : []),
    {
      id: "menu-file",
      label: "File",
      submenu: [
        {
          label: "Welcome",
          accelerator: "CmdOrCtrl+Shift+O",
          click: () => void enqueueShowLauncher(),
        },
        {
          label: "Open Repository…",
          accelerator: "CmdOrCtrl+O",
          click: () => void selectRepository(),
        },
        { type: "separator" },
        process.platform === "darwin"
          ? { role: "close" }
          : { role: "quit" },
      ],
    },
    {
      id: "menu-view",
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    {
      id: "menu-window",
      label: "Window",
      submenu: [{ role: "minimize" }, { role: "zoom" }],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

if (hasSingleInstanceLock) {
  app.on("second-instance", (_event, _argv, _cwd, additionalData) => {
    const workspace =
      additionalData &&
      typeof additionalData === "object" &&
      "workspace" in additionalData &&
      typeof additionalData.workspace === "string"
        ? additionalData.workspace
        : undefined;

    if (workspace) {
      if (initializing || !mainWindow) {
        pendingWorkspace = workspace;
      } else {
        void enqueueOpenWorkspace(workspace);
      }
    }

    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app
    .whenReady()
    .then(async () => {
      windowControlsMode = await readWindowControlsPreference();
      installSessionGuards();
      installIpcHandlers();
      installApplicationMenu();
      mainWindow = createWindow();

      const initialWorkspace = pendingWorkspace || requestedWorkspace;
      pendingWorkspace = undefined;

      if (initialWorkspace) {
        const result = await enqueueOpenWorkspace(initialWorkspace);
        if (!result.ok) {
          await enqueueShowLauncher();
        }
      } else {
        await enqueueShowLauncher();
      }

      initializing = false;

      if (pendingWorkspace) {
        const workspace = pendingWorkspace;
        pendingWorkspace = undefined;
        void enqueueOpenWorkspace(workspace);
      }
    })
    .catch((error) => {
      const message = `sdv: unable to initialize the desktop application: ${error.message}`;
      console.error(message);
      dialog.showErrorBox("Unable to start SDV", message);
      app.quit();
    });

  app.on("window-all-closed", () => app.quit());

  app.on("before-quit", (event) => {
    if (!activeServer || quitting) return;

    event.preventDefault();
    quitting = true;

    void stopServer(activeServer).finally(() => {
      activeServer = undefined;
      app.quit();
    });
  });
}
