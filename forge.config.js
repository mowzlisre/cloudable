const path = require('path');

module.exports = {
  packagerConfig: {
    name: 'Cloudable',
    executableName: 'cloudable',
    appBundleId: 'com.cloudable.desktop',
    appCategoryType: 'public.app-category.finance',
    icon: path.resolve(__dirname, 'electron/assets/icon'),
    asar: true,
    // Build frontend before packaging
    ignore: (filePath) => {
      if (!filePath) return false;
      // Exclude frontend source — keep only the built dist
      if (/^\/frontend\/(?!dist)/.test(filePath)) return true;
      // Exclude dev/CI artifacts
      if (/^\/(\.github|\.git|dist-electron|out)/.test(filePath)) return true;
      // Exclude backend env and deploy scripts
      if (/^\/backend\/(\.env|deploy\.sh)/.test(filePath)) return true;
      return false;
    },
    osxSign: {},        // Attempt signing if CSC_LINK is set; no-op otherwise
  },

  makers: [
    // macOS — ZIP is more reliable than DMG for unsigned distribution
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin'],
    },
    // Windows — Squirrel installer
    {
      name: '@electron-forge/maker-squirrel',
      platforms: ['win32'],
      config: {
        name: 'Cloudable',
        setupExe: 'Cloudable-Setup.exe',
        noMsi: true,
      },
    },
    // Linux — .deb package
    {
      name: '@electron-forge/maker-deb',
      platforms: ['linux'],
      config: {
        options: {
          name: 'cloudable',
          productName: 'Cloudable',
          genericName: 'AWS Cost Intelligence',
          description: 'AWS cost and infrastructure intelligence desktop app',
          categories: ['Finance', 'Network'],
          icon: path.resolve(__dirname, 'electron/assets/icon.png'),
        },
      },
    },
  ],
};
