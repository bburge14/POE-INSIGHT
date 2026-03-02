import { contextBridge, ipcRenderer, shell } from 'electron';

/**
 * Overlay preload script: Exposes a safe API to the overlay renderer.
 * This is the bridge between overlay.html and the Electron main process.
 *
 * The overlay.html expects `window.exileInsight` with:
 * - closeOverlay(): Hide the overlay
 * - onPriceCheckResult(callback): Receive price check data
 * - openExternal(url): Open trade site in browser
 */
contextBridge.exposeInMainWorld('exileInsight', {
  // Close the overlay window
  closeOverlay: () => ipcRenderer.send('overlay:close'),

  // Receive price check results from the main process
  onPriceCheckResult: (callback: (data: unknown) => void) => {
    ipcRenderer.on('price-check:result', (_event: unknown, data: unknown) => callback(data));
  },

  // Open a URL in the user's default browser
  openExternal: (url: string) => ipcRenderer.send('overlay:open-external', url),
});
