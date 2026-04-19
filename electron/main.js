const { app, BrowserWindow, ipcMain, safeStorage, nativeTheme, shell } = require('electron');
const path = require('path');
const Store = require('electron-store');
const { randomUUID } = require('crypto');

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

// Credential store — values are encrypted with OS keychain when available
const store = new Store({ name: 'cloudable-credentials' });

// ── Credential helpers ──────────────────────────────────────────────────────

function encryptValue(value) {
  if (safeStorage.isEncryptionAvailable()) {
    return { data: safeStorage.encryptString(value).toString('base64'), encrypted: true };
  }
  return { data: value, encrypted: false };
}

function decryptValue(entry) {
  if (entry?.encrypted && safeStorage.isEncryptionAvailable()) {
    return safeStorage.decryptString(Buffer.from(entry.data, 'base64'));
  }
  return entry?.data ?? '';
}

function saveCredentials({ accessKeyId, secretKey, region }) {
  store.set('accessKeyId', encryptValue(accessKeyId));
  store.set('secretKey', encryptValue(secretKey));
  store.set('region', region || 'us-east-1');
  applyCredentialsToEnv();
}

function loadCredentials() {
  return {
    accessKeyId: decryptValue(store.get('accessKeyId')),
    secretKey: decryptValue(store.get('secretKey')),
    region: store.get('region', 'us-east-1'),
  };
}

function clearCredentials() {
  store.delete('accessKeyId');
  store.delete('secretKey');
  store.delete('region');
  delete process.env.AWS_ACCESS_KEY_ID;
  delete process.env.AWS_SECRET_ACCESS_KEY;
  delete process.env.AWS_REGION;
}

function applyCredentialsToEnv(creds) {
  const c = creds || loadCredentials();
  if (c.accessKeyId) process.env.AWS_ACCESS_KEY_ID = c.accessKeyId;
  if (c.secretKey)   process.env.AWS_SECRET_ACCESS_KEY = c.secretKey;
  if (c.region)      process.env.AWS_REGION = c.region;
}

// ── Profile helpers ─────────────────────────────────────────────────────────

function saveProfile({ id, name, accessKeyId, secretKey, region }) {
  const profiles = store.get('profiles', []);
  const entry = { id, name, accessKeyId: encryptValue(accessKeyId), secretKey: encryptValue(secretKey), region: region || 'us-east-1' };
  const idx = profiles.findIndex(p => p.id === id);
  if (idx >= 0) profiles[idx] = entry; else profiles.push(entry);
  store.set('profiles', profiles);
}

function loadProfiles() {
  return (store.get('profiles', [])).map(p => ({
    id: p.id, name: p.name,
    accessKeyId: decryptValue(p.accessKeyId),
    secretKey:   decryptValue(p.secretKey),
    region:      p.region,
  }));
}

function deleteProfile(id) {
  store.set('profiles', store.get('profiles', []).filter(p => p.id !== id));
  if (store.get('activeProfileId') === id) store.delete('activeProfileId');
}

function syncCredStore() {
  const credStore = require('../backend/lib/credentials');
  const primary   = loadCredentials();
  const profiles  = loadProfiles();
  const activeId  = store.get('activeProfileId', '__primary__');
  const active    = activeId === '__primary__'
    ? { accessKeyId: primary.accessKeyId, secretKey: primary.secretKey, region: primary.region }
    : (profiles.find(p => p.id === activeId) ?? { accessKeyId: primary.accessKeyId, secretKey: primary.secretKey, region: primary.region });
  credStore.setActive(active);
  credStore.setProfiles(profiles);
  applyCredentialsToEnv(active);
}


function hasCredentials() {
  return !!store.get('accessKeyId');
}

// ── Express server ──────────────────────────────────────────────────────────

let server = null;
const PORT = 3001;

function startServer() {
  const express = require('express');
  const cors = require('cors');

  const expressApp = require('../backend/server');

  // In production, also serve the built frontend static files
  if (!isDev) {
    const frontendDist = path.join(__dirname, '../frontend/dist');
    expressApp.use(express.static(frontendDist));
    expressApp.get(/^(?!\/api).*/, (req, res) => {
      res.sendFile(path.join(frontendDist, 'index.html'));
    });
  }

  return new Promise((resolve, reject) => {
    server = expressApp.listen(PORT, '127.0.0.1', () => {
      console.log(`Cloudable server on :${PORT}`);
      resolve();
    });
    server.on('error', reject);
  });
}

// ── IPC handlers ────────────────────────────────────────────────────────────

ipcMain.handle('credentials:save', (_, creds) => {
  try { saveCredentials(creds); syncCredStore(); return { ok: true }; }
  catch (err) { return { ok: false, error: err.message }; }
});

ipcMain.handle('credentials:load', () => {
  const creds = loadCredentials();
  return {
    accessKeyId: creds.accessKeyId,
    // Return masked secret — renderer only needs to know if it's set
    secretKeyMasked: creds.secretKey ? `••••••••${creds.secretKey.slice(-4)}` : '',
    region: creds.region,
    hasCredentials: hasCredentials(),
  };
});

ipcMain.handle('credentials:clear', () => {
  clearCredentials();
  return { ok: true };
});

ipcMain.handle('credentials:has', () => hasCredentials());

ipcMain.handle('defaultRegion:save', (_, region) => {
  store.set('defaultRegion', region);
  return { ok: true };
});

ipcMain.handle('shell:openExternal', (_, url) => shell.openExternal(url));

ipcMain.handle('profiles:save', (_, profile) => {
  try {
    const id = profile.id || randomUUID();
    saveProfile({ ...profile, id });
    syncCredStore();
    return { ok: true, id };
  } catch (err) { return { ok: false, error: err.message }; }
});

ipcMain.handle('profiles:load', () =>
  loadProfiles().map(p => ({
    id: p.id, name: p.name, accessKeyId: p.accessKeyId,
    secretKeyMasked: p.secretKey ? `••••••••${p.secretKey.slice(-4)}` : '',
    region: p.region,
  }))
);

ipcMain.handle('profiles:delete', (_, id) => {
  deleteProfile(id); syncCredStore(); return { ok: true };
});

ipcMain.handle('profiles:setActive', (_, id) => {
  store.set('activeProfileId', id); syncCredStore(); return { ok: true };
});

ipcMain.handle('profiles:getActiveId', () =>
  store.get('activeProfileId', '__primary__')
);


ipcMain.handle('defaultRegion:load', () => {
  return store.get('defaultRegion', store.get('region', 'us-east-1'));
});

// ── Window ──────────────────────────────────────────────────────────────────

let win = null;

function createWindow() {
  nativeTheme.themeSource = 'dark';

  win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#080808',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const url = isDev ? `http://localhost:5173` : `http://127.0.0.1:${PORT}`;
  win.loadURL(url);

  if (isDev) win.webContents.openDevTools({ mode: 'detach' });
}

// ── App lifecycle ────────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  // Load credentials into process.env before the server starts
  if (hasCredentials()) syncCredStore();

  await startServer();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (server) server.close();
  if (process.platform !== 'darwin') app.quit();
});
