const { app, BrowserWindow, dialog, ipcMain, shell } = require("electron");
const fs = require("node:fs/promises");
const path = require("node:path");

const APP_NAME = "SMART Tool";
const SETTINGS_FILE = "desktop-settings.json";

let mainWindow = null;
let desktopHelper = null;
let desktopSettings = { syncFolderPath: null };

function getSettingsPath() {
  return path.join(app.getPath("userData"), SETTINGS_FILE);
}

async function loadDesktopSettings() {
  try {
    const raw = await fs.readFile(getSettingsPath(), "utf8");
    const parsed = JSON.parse(raw);
    desktopSettings = {
      syncFolderPath: typeof parsed.syncFolderPath === "string" ? parsed.syncFolderPath : null,
    };
  } catch {
    desktopSettings = { syncFolderPath: null };
  }
}

async function saveDesktopSettings() {
  await fs.mkdir(app.getPath("userData"), { recursive: true });
  await fs.writeFile(getSettingsPath(), `${JSON.stringify(desktopSettings, null, 2)}\n`, "utf8");
}

async function ensureDesktopHelper() {
  if (desktopHelper) return desktopHelper;

  const helperModule = await import(path.join(__dirname, "..", "desktop-helper", "src", "host.js"));
  desktopHelper = helperModule.createDesktopAcceleratorHost();
  return desktopHelper;
}

async function getSyncFolderState() {
  const folderPath = desktopSettings.syncFolderPath;
  if (!folderPath) {
    return { folderPath: null, folderName: null };
  }

  try {
    const stats = await fs.stat(folderPath);
    if (!stats.isDirectory()) {
      throw new Error("Stored sync folder is not a directory.");
    }

    return {
      folderPath,
      folderName: path.basename(folderPath),
    };
  } catch {
    desktopSettings.syncFolderPath = null;
    await saveDesktopSettings();
    return { folderPath: null, folderName: null };
  }
}

async function createMainWindow() {
  const iconPath = path.join(__dirname, "..", "src", "assets", "logo-icon.png");

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1100,
    minHeight: 760,
    title: APP_NAME,
    show: false,
    autoHideMenuBar: true,
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!mainWindow) return;

    const currentUrl = mainWindow.webContents.getURL();
    if (!currentUrl || url === currentUrl) return;

    event.preventDefault();
    shell.openExternal(url);
  });

  if (app.isPackaged) {
    await mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  } else {
    await mainWindow.loadURL(process.env.SMART_TOOL_DESKTOP_RENDERER_URL || "http://127.0.0.1:8080");
    mainWindow.webContents.openDevTools({ mode: "detach" });
  }
}

function registerIpcHandlers() {
  ipcMain.handle("desktop:meta", async () => ({
    isDesktopApp: true,
    platform: process.platform,
    version: app.getVersion(),
  }));

  ipcMain.handle("desktop-helper:health", async () => {
    const helper = await ensureDesktopHelper();
    return helper.health();
  });

  ipcMain.handle("desktop-helper:load", async (_event, modelId) => {
    const helper = await ensureDesktopHelper();
    return helper.load(modelId);
  });

  ipcMain.handle("desktop-helper:generate", async (_event, prompt, config) => {
    const helper = await ensureDesktopHelper();
    return helper.generate(prompt, config || {});
  });

  ipcMain.handle("desktop-helper:unload", async () => {
    const helper = await ensureDesktopHelper();
    return helper.unload();
  });

  ipcMain.handle("desktop-sync:get-state", async () => getSyncFolderState());

  ipcMain.handle("desktop-sync:select-folder", async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: "Choose a folder for SMART action exports",
      properties: ["openDirectory", "createDirectory"],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    desktopSettings.syncFolderPath = result.filePaths[0];
    await saveDesktopSettings();
    return getSyncFolderState();
  });

  ipcMain.handle("desktop-sync:clear-folder", async () => {
    desktopSettings.syncFolderPath = null;
    await saveDesktopSettings();
    return { ok: true };
  });

  ipcMain.handle("desktop-sync:write-text-file", async (_event, filename, content) => {
    const { folderPath } = await getSyncFolderState();
    if (!folderPath) {
      throw new Error("No sync folder is configured.");
    }

    const safeFilename = path.basename(String(filename || ""));
    if (!safeFilename) {
      throw new Error("A filename is required.");
    }

    const targetPath = path.join(folderPath, safeFilename);
    await fs.mkdir(folderPath, { recursive: true });
    await fs.writeFile(targetPath, String(content || ""), "utf8");
    return { path: targetPath };
  });
}

app.whenReady().then(async () => {
  await loadDesktopSettings();
  registerIpcHandlers();
  await createMainWindow();

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", async () => {
  if (!desktopHelper) return;
  await desktopHelper.unload().catch(() => undefined);
});
