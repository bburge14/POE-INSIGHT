import { contextBridge, ipcRenderer } from 'electron';

/**
 * Preload script: Exposes a safe API to the renderer process.
 * Follows Electron security best practices — no direct Node.js access in renderer.
 */
contextBridge.exposeInMainWorld('exileInsight', {
  // Build management
  importBuild: (pobCode: string) => ipcRenderer.send('build:import', pobCode),
  onBuildUpdate: (callback: (data: unknown) => void) =>
    ipcRenderer.on('build:update', (_event, data) => callback(data)),

  // Monitoring
  startMonitoring: () => ipcRenderer.send('monitor:start'),
  stopMonitoring: () => ipcRenderer.send('monitor:stop'),

  // Deals
  onDealsUpdate: (callback: (deals: unknown[]) => void) =>
    ipcRenderer.on('deals:update', (_event, deals) => callback(deals)),

  // Status
  onStatusUpdate: (callback: (status: unknown) => void) =>
    ipcRenderer.on('status:update', (_event, status) => callback(status)),

  // Config
  updateConfig: (config: Record<string, unknown>) =>
    ipcRenderer.send('config:update', config),
});
