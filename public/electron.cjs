const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const isDev = require('electron-is-dev');
const path = require('path');
const fs = require('fs');

let mainWindow;

function resolveIcon() {
  const candidates = [
    path.join(__dirname, '../dist-vite/icon-192.png'),
    path.join(__dirname, '../assets/icon.png'),
    path.join(__dirname, 'icon-192.png'),
  ];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) return p;
    } catch {
      /* ignore */
    }
  }
  return undefined;
}

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    icon: resolveIcon(),
  });

  // Producción: carga el sitio publicado (mismo bundle que la web). file:// rompe con base "/" en Vite.
  const startUrl = isDev
    ? 'http://localhost:8080'
    : 'https://mrvpai.web.app/';

  mainWindow.loadURL(startUrl);

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
};

app.on('ready', createWindow);

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

const template = [
  {
    label: 'Archivo',
    submenu: [
      {
        label: 'Salir',
        accelerator: 'CmdOrCtrl+Q',
        click: () => {
          app.quit();
        },
      },
    ],
  },
  {
    label: 'Editar',
    submenu: [
      { label: 'Deshacer', accelerator: 'CmdOrCtrl+Z', role: 'undo' },
      { label: 'Rehacer', accelerator: 'CmdOrCtrl+Y', role: 'redo' },
      { type: 'separator' },
      { label: 'Cortar', accelerator: 'CmdOrCtrl+X', role: 'cut' },
      { label: 'Copiar', accelerator: 'CmdOrCtrl+C', role: 'copy' },
      { label: 'Pegar', accelerator: 'CmdOrCtrl+V', role: 'paste' },
    ],
  },
  {
    label: 'Ver',
    submenu: [
      { label: 'Recargar', accelerator: 'CmdOrCtrl+R', role: 'reload' },
      { label: 'Herramientas', accelerator: 'CmdOrCtrl+Shift+I', role: 'toggleDevTools' },
    ],
  },
  {
    label: 'Ayuda',
    submenu: [
      {
        label: 'Acerca de',
        click: () => {
          const aboutWindow = new BrowserWindow({
            width: 400,
            height: 300,
            parent: mainWindow,
            modal: true,
          });
          const aboutPath = path.join(__dirname, '../assets/about.html');
          if (fs.existsSync(aboutPath)) {
            aboutWindow.loadURL(`file://${aboutPath}`);
          } else {
            aboutWindow.loadURL(`data:text/html,<html><body style="font-family:sans-serif;padding:16px"><h2>MRV 2026</h2><p>Monitoreo Rápido de Vacunados</p></body></html>`);
          }
        },
      },
    ],
  },
];

const menu = Menu.buildFromTemplate(template);
Menu.setApplicationMenu(menu);

ipcMain.handle('get-version', () => {
  return app.getVersion();
});

ipcMain.handle('get-app-path', () => {
  return app.getAppPath();
});
