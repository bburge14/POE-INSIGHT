import { app } from 'electron';
import { BuildParser } from './modules/build-parser';
import { BuildEvaluator } from './core/build-evaluator';
import { DataFetcher } from './modules/data-fetcher';
import { ItemEvaluator } from './modules/item-evaluator';
import { AIAdvisor } from './modules/ai-advisor';
import { MarketDatabase } from './modules/database';
import { UIOverlay } from './modules/ui-overlay';
import { StreamBuffer } from './utils/stream-buffer';
import { DEFAULT_CONFIG } from './config/defaults';
import { AppConfig, PoE2Item, ItemDeal } from './models/types';
import axios from 'axios';

/**
 * Exile-Insight: Main Application Controller
 *
 * Orchestrates all modules:
 * - BuildParser → BuildEvaluator → ItemEvaluator
 * - DataFetcher → StreamBuffer → ItemEvaluator
 * - MarketDatabase (persistence)
 * - AIAdvisor (optional LLM layer)
 * - UIOverlay (Electron window + price check overlay)
 *
 * COMPLIANCE: Strictly READ-ONLY. No automated game interaction.
 */
class ExileInsightApp {
  private config: AppConfig;
  private buildParser: BuildParser;
  private buildEvaluator: BuildEvaluator;
  private dataFetcher: DataFetcher;
  private itemEvaluator: ItemEvaluator;
  private aiAdvisor: AIAdvisor | null;
  private database: MarketDatabase;
  private ui: UIOverlay;
  private streamBuffer: StreamBuffer;

  private totalItemsProcessed: number = 0;
  private isMonitoring: boolean = false;

  // The Express server port for the web app API
  private readonly apiPort: number = parseInt(process.env.PORT || '5000', 10);

  constructor() {
    this.config = { ...DEFAULT_CONFIG };

    // Initialize modules
    this.buildParser = new BuildParser();
    this.buildEvaluator = new BuildEvaluator();
    this.database = new MarketDatabase(this.config);

    // AI advisor is optional — only initialize if API key is configured
    this.aiAdvisor = this.config.llmApiKey
      ? new AIAdvisor(this.config)
      : null;

    this.dataFetcher = new DataFetcher(this.config);

    this.itemEvaluator = new ItemEvaluator(
      this.buildEvaluator,
      this.database,
      this.aiAdvisor,
      this.config
    );

    this.ui = new UIOverlay();

    // Stream buffer: collects items for 10s then flushes to evaluator
    this.streamBuffer = new StreamBuffer(
      this.config.debounceWindowMs,
      (items) => this.onBufferFlush(items)
    );

    this.wireEvents();
  }

  /**
   * Start the application.
   */
  async start(): Promise<void> {
    await this.ui.createWindow();

    // Restore last poll state
    const lastChangeId = this.database.getPollState('change_id');
    if (lastChangeId) {
      console.log(`Resuming from change_id: ${lastChangeId}`);
    }

    this.ui.updateStatus({ polling: false });

    // Periodic database maintenance (prune old history)
    setInterval(() => {
      const pruned = this.database.pruneHistory();
      if (pruned > 0) {
        console.log(`Pruned ${pruned} old price history entries`);
      }
    }, 60 * 60 * 1000); // Every hour
  }

  /**
   * Wire up event handlers between modules.
   */
  private wireEvents(): void {
    // UI → App events
    this.ui.on('import-build', (pobCode: string) => this.importBuild(pobCode));
    this.ui.on('start-monitoring', () => this.startMonitoring());
    this.ui.on('stop-monitoring', () => this.stopMonitoring());
    this.ui.on('update-config', (config: Partial<AppConfig>) => this.updateConfig(config));
    this.ui.on('closed', () => this.shutdown());

    // Price check overlay: triggered by Ctrl+D hotkey
    this.ui.on('price-check', (rawText: string) => this.handlePriceCheck(rawText));

    // DataFetcher → StreamBuffer
    this.dataFetcher.on('items', (items: PoE2Item[]) => {
      this.streamBuffer.push(items);
    });

    // DataFetcher status events
    this.dataFetcher.on('poll', (info: { changeId: string; itemCount: number }) => {
      this.totalItemsProcessed += info.itemCount;
      this.database.savePollState('change_id', info.changeId);
      this.ui.updateStatus({
        polling: true,
        changeId: info.changeId,
        itemsProcessed: this.totalItemsProcessed,
      });
    });

    this.dataFetcher.on('rate-limited', (info: { retryAfter?: number }) => {
      console.warn(`Rate limited. Retry after: ${info.retryAfter || 'backoff'}s`);
      this.ui.updateStatus({
        polling: true,
        rateLimited: true,
        itemsProcessed: this.totalItemsProcessed,
      });
    });

    this.dataFetcher.on('error', (info: { message: string }) => {
      console.error('DataFetcher error:', info.message);
      this.ui.updateStatus({
        polling: this.isMonitoring,
        lastError: info.message,
        itemsProcessed: this.totalItemsProcessed,
      });
    });
  }

  /**
   * Handle a price check request from the overlay.
   * Calls the existing Express API server to evaluate the clipboard item text.
   */
  private async handlePriceCheck(rawText: string): Promise<void> {
    console.log('Price check triggered, item text length:', rawText.length);

    try {
      // Step 1: Parse and evaluate via the Express API
      const evalResponse = await axios.post(`http://localhost:${this.apiPort}/api/evaluate`, {
        rawText,
      }, {
        timeout: 15000,
      });

      const { parsed, evaluation } = evalResponse.data;

      // Step 2: Fetch trade data using the parsed item
      let tradeData = null;
      try {
        const tradeResponse = await axios.post(`http://localhost:${this.apiPort}/api/trade/search`, {
          parsed,
          league: 'Standard',
        }, {
          timeout: 10000,
        });
        tradeData = tradeResponse.data;
      } catch (tradeErr) {
        console.warn('Trade search failed (non-fatal):', (tradeErr as Error).message);
      }

      // Send combined results to the overlay
      this.ui.sendPriceCheckResult({
        parsed,
        evaluation,
        trade: tradeData,
      });
    } catch (err) {
      console.error('Price check failed:', (err as Error).message);
      this.ui.sendPriceCheckResult({
        error: `Price check failed: ${(err as Error).message}`,
      });
    }
  }

  /**
   * Import a PoB build code.
   */
  private importBuild(pobCode: string): void {
    try {
      const build = this.buildParser.parsePoBCode(pobCode);
      const profile = this.buildEvaluator.createProfile(build);

      this.ui.updateBuildProfile(profile);

      console.log(`Build imported: ${build.name} (${build.class})`);
      console.log(`  Level: ${build.level}`);
      console.log(`  DPS: ${build.stats.totalDps}`);
      console.log(`  Requirements: ${build.requirements.length} unmet`);
      console.log(`  Priority slots: ${profile.prioritySlots.join(', ')}`);
    } catch (error) {
      console.error('Failed to import build:', error);
      this.ui.updateStatus({
        polling: this.isMonitoring,
        lastError: `Build import failed: ${(error as Error).message}`,
      });
    }
  }

  /**
   * Start monitoring the PoE2 API.
   */
  private async startMonitoring(): Promise<void> {
    if (this.isMonitoring) return;

    const profile = this.buildEvaluator.getProfile();
    if (!profile) {
      this.ui.updateStatus({
        polling: false,
        lastError: 'Import a build first before monitoring.',
      });
      return;
    }

    this.isMonitoring = true;
    this.streamBuffer.start();

    const lastChangeId = this.database.getPollState('change_id') || undefined;
    await this.dataFetcher.start(lastChangeId);

    console.log('Monitoring started');
  }

  /**
   * Stop monitoring.
   */
  private stopMonitoring(): void {
    if (!this.isMonitoring) return;

    this.isMonitoring = false;
    this.dataFetcher.stop();
    this.streamBuffer.stop();

    this.ui.updateStatus({ polling: false, itemsProcessed: this.totalItemsProcessed });

    console.log('Monitoring stopped');
  }

  /**
   * Handle a batch of items flushed from the stream buffer.
   */
  private async onBufferFlush(items: PoE2Item[]): Promise<void> {
    if (items.length === 0) return;

    console.log(`Evaluating batch of ${items.length} items...`);

    try {
      const deals: ItemDeal[] = await this.itemEvaluator.evaluateBatch(items);

      if (deals.length > 0) {
        console.log(`Found ${deals.length} deals (top score: ${deals[0].dealScore})`);
        this.ui.updateDeals(deals);
      }
    } catch (error) {
      console.error('Evaluation error:', error);
    }
  }

  /**
   * Update configuration at runtime.
   */
  private updateConfig(partial: Partial<AppConfig>): void {
    Object.assign(this.config, partial);
    console.log('Config updated:', Object.keys(partial).join(', '));
  }

  /**
   * Clean shutdown.
   */
  private shutdown(): void {
    console.log('Shutting down...');
    this.stopMonitoring();
    this.ui.unregisterHotkeys();
    this.database.close();
  }
}

// ---- Electron App Lifecycle ----

let exileInsight: ExileInsightApp;

app.whenReady().then(async () => {
  exileInsight = new ExileInsightApp();
  await exileInsight.start();
});

app.on('window-all-closed', () => {
  app.quit();
});

app.on('will-quit', () => {
  // Clean up global shortcuts when app quits
  const { globalShortcut } = require('electron');
  globalShortcut.unregisterAll();
});
