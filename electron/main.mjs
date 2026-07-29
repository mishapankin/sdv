import { randomBytes } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  session,
  utilityProcess,
} from "electron";

import { getRequestedWorkspace } from "./arguments.mjs";
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
const LOOPBACK_HOST = "127.0.0.1";
const RECENT_REPOSITORIES_LIMIT = 10;

let mainWindow;
let activeServer;
let activeOrigin;
let activeRepository;
let quitting = false;

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

async function readRecentRepositories() {
  try {
    const contents = await readFile(getRecentRepositoriesPath(), "utf8");
    const parsed = JSON.parse(contents);

    return Array.isArray(parsed)
      ? parsed.filter((entry) => typeof entry === "string")
      : [];
  } catch {
    return [];
  }
}

async function rememberRepository(directory) {
  const recent = await readRecentRepositories();
  const repositories = [
    directory,
    ...recent.filter((entry) => entry !== directory),
  ].slice(0, RECENT_REPOSITORIES_LIMIT);

  await writeFile(
    getRecentRepositoriesPath(),
    `${JSON.stringify(repositories, null, 2)}\n`,
    "utf8",
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
    return (
      activeOrigin !== undefined &&
      new URL(event.senderFrame.url).origin === activeOrigin
    );
  } catch {
    return false;
  }
}

function createWindow() {
  const window = new BrowserWindow({
    title: "SDV",
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 600,
    show: false,
    backgroundColor: "#181a1f",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: preloadPath,
      sandbox: true,
    },
  });

  window.once("ready-to-show", () => window.show());
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event, url) => {
    if (!activeOrigin || new URL(url).origin !== activeOrigin) {
      event.preventDefault();
    }
  });

  return window;
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

  await Promise.all([
    stopServer(previousServer),
    rememberRepository(nextServer.directory),
  ]);

  return { ok: true };
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

  return openWorkspace(selection.filePaths[0]);
}

function installIpcHandlers() {
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
      label: "File",
      submenu: [
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
      label: "Window",
      submenu: [{ role: "minimize" }, { role: "zoom" }],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

async function openInitialWorkspace() {
  const recentRepositories = await readRecentRepositories();
  const initialWorkspace = requestedWorkspace || recentRepositories[0];

  if (initialWorkspace) {
    const result = await openWorkspace(initialWorkspace);
    if (result.ok) return true;
  }

  const selection = await selectRepository();
  return selection.ok;
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
      void openWorkspace(workspace);
    }

    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    installSessionGuards();
    installIpcHandlers();
    installApplicationMenu();
    mainWindow = createWindow();

    if (!(await openInitialWorkspace())) {
      app.quit();
    }
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
