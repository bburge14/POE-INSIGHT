import { BrowserWindow, app, ipcMain, globalShortcut, screen, shell, clipboard } from 'electron';
import * as path from 'path';
import { EventEmitter } from 'events';
import { ItemDeal, BuildProfile } from '../../models/types';

/**
 * UIOverlay: Electron-based desktop overlay for Exile-Insight.
 *
 * Two windows:
 * 1. Main dashboard window (full app with build/deal monitoring)
 * 2. Price check overlay (transparent, always-on-top popup triggered by Ctrl+D)
 *
 * Global Hotkeys:
 * - Ctrl+D: Read clipboard and trigger price check
 * - Ctrl+Shift+D: Toggle overlay visibility
 * - Escape (in overlay): Close overlay
 */
export class UIOverlay extends EventEmitter {
  private mainWindow: BrowserWindow | null = null;
  private overlayWindow: BrowserWindow | null = null;
  private overlayVisible: boolean = false;

  /**
   * Initialize the main Electron window.
   */
  async createWindow(): Promise<void> {
    this.mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      minWidth: 800,
      minHeight: 600,
      title: 'Exile-Insight',
      backgroundColor: '#0a0a0f',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js'),
      },
      frame: true,
      transparent: false,
      autoHideMenuBar: true,
    });

    await this.mainWindow.loadFile(path.join(__dirname, '../../public/index.html'));

    this.setupIPC();
    this.registerGlobalHotkeys();

    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
      this.destroyOverlay();
      this.emit('closed');
    });
  }

  /**
   * Create the transparent price check overlay window.
   * This is a frameless, always-on-top, transparent window that appears
   * near the cursor when the user triggers a price check.
   */
  private async createOverlayWindow(): Promise<void> {
    if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
      return;
    }

    this.overlayWindow = new BrowserWindow({
      width: 420,
      height: 500,
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: false,
      focusable: true,
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'overlay-preload.js'),
      },
    });

    // Prevent the overlay from stealing focus from the game
    this.overlayWindow.setAlwaysOnTop(true, 'screen-saver');

    await this.overlayWindow.loadFile(path.join(__dirname, '../../public/overlay.html'));

    this.overlayWindow.on('closed', () => {
      this.overlayWindow = null;
      this.overlayVisible = false;
    });

    // Hide on blur so clicking elsewhere dismisses it
    this.overlayWindow.on('blur', () => {
      this.hideOverlay();
    });
  }

  /**
   * Show the overlay near the cursor position with a loading state,
   * then trigger the price check pipeline.
   */
  async showPriceCheck(): Promise<void> {
    // Read clipboard
    const clipboardText = clipboard.readText();
    if (!clipboardText || !clipboardText.trim()) {
      return;
    }

    // Create overlay window if it doesn't exist
    await this.createOverlayWindow();
    if (!this.overlayWindow) return;

    // Position overlay near cursor
    const cursorPos = screen.getCursorScreenPoint();
    const display = screen.getDisplayNearestPoint(cursorPos);
    const bounds = display.workArea;

    // Offset slightly from cursor, keep within screen bounds
    let x = cursorPos.x + 15;
    let y = cursorPos.y + 15;

    // Prevent going off-screen
    if (x + 420 > bounds.x + bounds.width) {
      x = cursorPos.x - 435;
    }
    if (y + 500 > bounds.y + bounds.height) {
      y = bounds.y + bounds.height - 510;
    }
    if (x < bounds.x) x = bounds.x + 5;
    if (y < bounds.y) y = bounds.y + 5;

    this.overlayWindow.setPosition(Math.round(x), Math.round(y));
    this.overlayWindow.show();
    this.overlayVisible = true;

    // Emit event so main.ts can trigger the price check pipeline
    this.emit('price-check', clipboardText);
  }

  /**
   * Send price check results to the overlay window.
   */
  sendPriceCheckResult(data: unknown): void {
    if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
      this.overlayWindow.webContents.send('price-check:result', data);
    }
  }

  /**
   * Hide the overlay window.
   */
  hideOverlay(): void {
    if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
      this.overlayWindow.hide();
      this.overlayVisible = false;
    }
  }

  /**
   * Toggle overlay visibility.
   */
  toggleOverlay(): void {
    if (this.overlayVisible) {
      this.hideOverlay();
    } else {
      // Show with last results or trigger new check
      this.showPriceCheck();
    }
  }

  /**
   * Destroy the overlay window completely.
   */
  private destroyOverlay(): void {
    if (this.overlayWindow && !this.overlayWindow.isDestroyed()) {
      this.overlayWindow.destroy();
    }
    this.overlayWindow = null;
    this.overlayVisible = false;
  }

  /**
   * Register global hotkeys that work even when the game has focus.
   */
  private registerGlobalHotkeys(): void {
    // Ctrl+D: Price check (read clipboard + show overlay)
    globalShortcut.register('CommandOrControl+D', () => {
      this.showPriceCheck();
    });

    // Ctrl+Shift+D: Toggle overlay visibility
    globalShortcut.register('CommandOrControl+Shift+D', () => {
      this.toggleOverlay();
    });
  }

  /**
   * Unregister all global hotkeys (call on shutdown).
   */
  unregisterHotkeys(): void {
    globalShortcut.unregisterAll();
  }

  // ---- Main Dashboard Window Methods (unchanged) ----

  updateDeals(deals: ItemDeal[]): void {
    this.sendToRenderer('deals:update', deals.map(d => this.serializeDeal(d)));
  }

  updateBuildProfile(profile: BuildProfile): void {
    this.sendToRenderer('build:update', {
      name: profile.build.name,
      class: profile.build.class,
      ascendancy: profile.build.ascendancy,
      level: profile.build.level,
      league: profile.build.league,
      mainSkill: profile.build.mainSkill,
      stats: profile.build.stats,
      requirements: profile.build.requirements,
      prioritySlots: profile.prioritySlots,
    });
  }

  updateStatus(status: {
    polling: boolean;
    changeId?: string;
    itemsProcessed?: number;
    rateLimited?: boolean;
    lastError?: string;
  }): void {
    this.sendToRenderer('status:update', status);
  }

  private setupIPC(): void {
    ipcMain.on('build:import', (_event: unknown, pobCode: string) => {
      this.emit('import-build', pobCode);
    });

    ipcMain.on('monitor:start', () => {
      this.emit('start-monitoring');
    });

    ipcMain.on('monitor:stop', () => {
      this.emit('stop-monitoring');
    });

    ipcMain.on('config:update', (_event: unknown, config: Record<string, unknown>) => {
      this.emit('update-config', config);
    });

    // Overlay IPC
    ipcMain.on('overlay:close', () => {
      this.hideOverlay();
    });

    ipcMain.on('overlay:open-external', (_event: unknown, url: string) => {
      if (url && (url.startsWith('https://') || url.startsWith('http://'))) {
        shell.openExternal(url);
      }
    });
  }

  private sendToRenderer(channel: string, data: unknown): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, data);
    }
  }

  private serializeDeal(deal: ItemDeal): Record<string, unknown> {
    return {
      id: deal.id,
      item: {
        name: deal.item.name || deal.item.baseType,
        baseType: deal.item.baseType,
        rarity: deal.item.rarity,
        category: deal.item.category,
        itemLevel: deal.item.itemLevel,
        mods: {
          implicit: deal.item.mods.implicit.map(m => m.text),
          explicit: deal.item.mods.explicit.map(m => m.text),
          enchant: deal.item.mods.enchant.map(m => m.text),
        },
        price: deal.item.listingPrice,
        seller: deal.item.stash.accountName,
      },
      dealScore: deal.dealScore,
      evaluation: {
        dpsChange: deal.evaluation.dpsChange,
        ehpChange: deal.evaluation.ehpChange,
        isUpgrade: deal.evaluation.isUpgrade,
        meetsRequirements: deal.evaluation.meetsRequirements,
        unmetRequirements: deal.evaluation.unmetRequirements,
      },
      pricing: {
        currentPrice: deal.pricing.currentPrice.originalPrice,
        marketAverage: deal.pricing.marketAverage.originalPrice,
        priceRatio: deal.pricing.priceRatio,
        confidence: deal.pricing.confidence,
      },
      aiAnalysis: deal.aiAnalysis,
      timestamp: deal.timestamp.toISOString(),
    };
  }
}
