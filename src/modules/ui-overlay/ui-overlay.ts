import { BrowserWindow, app, ipcMain } from 'electron';
import * as path from 'path';
import { EventEmitter } from 'events';
import { ItemDeal, BuildProfile } from '../../models/types';

/**
 * UIOverlay: Electron-based desktop overlay for Exile-Insight.
 *
 * Design: Dark-mode, high-contrast aesthetic similar to modern fintech dashboards.
 * Uses Tailwind CSS for styling.
 *
 * Displays:
 * - Top 5 deals found in the last 10-second window
 * - Build profile summary with unmet requirements highlighted
 * - Deal details with stat breakdowns and AI analysis
 * - Real-time polling status and rate limit indicators
 */
export class UIOverlay extends EventEmitter {
  private mainWindow: BrowserWindow | null = null;

  /**
   * Initialize the Electron window.
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
      // Overlay-friendly settings
      frame: true,
      transparent: false,
      autoHideMenuBar: true,
    });

    await this.mainWindow.loadFile(path.join(__dirname, '../../public/index.html'));

    this.setupIPC();

    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
      this.emit('closed');
    });
  }

  /**
   * Send the latest deals to the UI.
   */
  updateDeals(deals: ItemDeal[]): void {
    this.sendToRenderer('deals:update', deals.map(d => this.serializeDeal(d)));
  }

  /**
   * Send the build profile to the UI for display.
   */
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

  /**
   * Update the polling status indicator.
   */
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
    ipcMain.on('build:import', (_event, pobCode: string) => {
      this.emit('import-build', pobCode);
    });

    ipcMain.on('monitor:start', () => {
      this.emit('start-monitoring');
    });

    ipcMain.on('monitor:stop', () => {
      this.emit('stop-monitoring');
    });

    ipcMain.on('config:update', (_event, config: Record<string, unknown>) => {
      this.emit('update-config', config);
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
