const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  platform: process.platform,

  saveCredentials: (creds) => ipcRenderer.invoke('credentials:save', creds),
  loadCredentials: () => ipcRenderer.invoke('credentials:load'),
  clearCredentials: () => ipcRenderer.invoke('credentials:clear'),
  hasCredentials: () => ipcRenderer.invoke('credentials:has'),

  saveDefaultRegion: (region) => ipcRenderer.invoke('defaultRegion:save', region),
  loadDefaultRegion: () => ipcRenderer.invoke('defaultRegion:load'),

  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),

  saveProfile:        (profile) => ipcRenderer.invoke('profiles:save', profile),
  loadProfiles:       ()        => ipcRenderer.invoke('profiles:load'),
  deleteProfile:      (id)      => ipcRenderer.invoke('profiles:delete', id),
  setActiveProfile:   (id)      => ipcRenderer.invoke('profiles:setActive', id),
  getActiveProfileId: ()        => ipcRenderer.invoke('profiles:getActiveId'),
});
