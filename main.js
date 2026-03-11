const { app, BrowserWindow, ipcMain, net, shell } = require('electron');
const path = require('path');
const fs   = require('fs');
const crypto = require('crypto');
const os   = require('os');

// ── Key storage helpers ───────────────────────────────────────
const KEY_FILE = () => path.join(app.getPath('userData'), 'api-key.enc');

function getDerivedKey() {
  const secret = `gorelo-api-browser::${os.hostname()}::${os.userInfo().username}`;
  const salt   = Buffer.from('gorelo-api-browser-salt-v1', 'utf8');
  return crypto.scryptSync(secret, salt, 32);
}

function encryptKey(plaintext) {
  const key    = getDerivedKey();
  const iv     = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc    = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag    = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

function decryptKey(data) {
  const key = getDerivedKey();
  const buf = Buffer.from(data, 'base64');
  const iv      = buf.subarray(0, 16);
  const tag     = buf.subarray(16, 32);
  const enc     = buf.subarray(32);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(enc).toString('utf8') + decipher.final('utf8');
}

const SWAGGER_URL  = 'https://api.usw.gorelo.io/swagger/v1/swagger.json';
const RELEASES_URL = 'https://api.github.com/repos/ate-it/GorelloAPIBrowser/releases/latest';

// ── Update check ──────────────────────────────────────────────
function newerVersion(current, latest) {
  const parse = (v) => v.replace(/^v/, '').split('.').map(Number);
  const [ca, cb, cc] = parse(current);
  const [la, lb, lc] = parse(latest);
  return la > ca || (la === ca && lb > cb) || (la === ca && lb === cb && lc > cc);
}

function checkForUpdates(win) {
  const request = net.request({
    url: RELEASES_URL,
    headers: { 'User-Agent': 'gorelo-api-browser' },
  });
  let data = '';

  request.on('response', (response) => {
    response.on('data',  (chunk) => { data += chunk.toString(); });
    response.on('end',   () => {
      try {
        const { tag_name, html_url } = JSON.parse(data);
        if (tag_name && newerVersion(app.getVersion(), tag_name)) {
          win.webContents.send('update:available', {
            version: tag_name.replace(/^v/, ''),
            url: html_url,
          });
        }
      } catch { /* silently ignore parse errors */ }
    });
  });

  request.on('error', () => { /* silently ignore network errors */ });
  request.end();
}

ipcMain.handle('update:open-url', (_event, url) => shell.openExternal(url));
ipcMain.handle('app:version',    () => app.getVersion());

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    frame: false,
    backgroundColor: '#1e293b',
    show: false,
  });

  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  win.once('ready-to-show', () => {
    win.show();
    setTimeout(() => checkForUpdates(win), 3000);
  });

  win.on('maximize',   () => win.webContents.send('win:maximized', true));
  win.on('unmaximize', () => win.webContents.send('win:maximized', false));
}

// ── Window control IPC ────────────────────────────────────────
ipcMain.on('win:minimize', (e) => BrowserWindow.fromWebContents(e.sender)?.minimize());
ipcMain.on('win:maximize', (e) => {
  const w = BrowserWindow.fromWebContents(e.sender);
  w?.isMaximized() ? w.unmaximize() : w.maximize();
});
ipcMain.on('win:close',    (e) => BrowserWindow.fromWebContents(e.sender)?.close());

// ── API key IPC handlers ──────────────────────────────────────
ipcMain.handle('key:load', () => {
  try {
    const data = fs.readFileSync(KEY_FILE(), 'utf8');
    return decryptKey(data.trim());
  } catch {
    return null;
  }
});

ipcMain.handle('key:save', (_event, plaintext) => {
  fs.mkdirSync(path.dirname(KEY_FILE()), { recursive: true });
  fs.writeFileSync(KEY_FILE(), encryptKey(plaintext), 'utf8');
});

ipcMain.handle('key:clear', () => {
  try { fs.unlinkSync(KEY_FILE()); } catch { /* already gone */ }
});

// Fetch swagger.json from main process (bypasses CORS)
ipcMain.handle('fetch-swagger', async () => {
  return new Promise((resolve, reject) => {
    const request = net.request(SWAGGER_URL);
    let data = '';

    request.on('response', (response) => {
      response.on('data', (chunk) => {
        data += chunk.toString();
      });
      response.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error('Failed to parse swagger JSON: ' + e.message));
        }
      });
      response.on('error', reject);
    });

    request.on('error', (err) => {
      reject(new Error('Network error: ' + err.message));
    });

    request.end();
  });
});

// Proxy API requests (handles auth + CORS)
ipcMain.handle('api-request', async (_event, { method, url, headers, body }) => {
  return new Promise((resolve, reject) => {
    const request = net.request({ method, url });

    if (headers) {
      Object.entries(headers).forEach(([k, v]) => request.setHeader(k, v));
    }

    let data = '';
    let statusCode = 0;
    let responseHeaders = {};

    request.on('response', (response) => {
      statusCode = response.statusCode;
      responseHeaders = response.headers;

      response.on('data', (chunk) => {
        data += chunk.toString();
      });
      response.on('end', () => {
        resolve({ status: statusCode, headers: responseHeaders, body: data });
      });
      response.on('error', reject);
    });

    request.on('error', (err) => {
      reject(new Error('Network error: ' + err.message));
    });

    if (body) {
      request.write(body);
    }

    request.end();
  });
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
