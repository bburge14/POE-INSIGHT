import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';
import { PriceCacheEntry, AppConfig } from '../../models/types';

/**
 * MarketDatabase: Local SQLite database for caching market prices.
 *
 * Stores historical price data to minimize API calls and enable
 * "market average" calculations for the deal scoring engine.
 *
 * Uses a rolling window for averages, with configurable retention.
 */
export class MarketDatabase {
  private db: Database.Database;

  constructor(config: AppConfig) {
    const dbDir = path.dirname(config.dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    this.db = new Database(config.dbPath);
    this.db.pragma('journal_mode = WAL'); // Better concurrent read performance
    this.db.pragma('synchronous = NORMAL');

    this.initSchema();
  }

  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS price_cache (
        item_hash TEXT PRIMARY KEY,
        base_type TEXT NOT NULL,
        mod_signature TEXT NOT NULL,
        avg_price REAL NOT NULL,
        min_price REAL NOT NULL,
        max_price REAL NOT NULL,
        sample_count INTEGER NOT NULL DEFAULT 1,
        last_updated INTEGER NOT NULL,
        league TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_price_cache_base_type
        ON price_cache(base_type, league);

      CREATE INDEX IF NOT EXISTS idx_price_cache_updated
        ON price_cache(last_updated);

      CREATE TABLE IF NOT EXISTS price_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        item_hash TEXT NOT NULL,
        price REAL NOT NULL,
        currency TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        league TEXT NOT NULL,
        FOREIGN KEY (item_hash) REFERENCES price_cache(item_hash)
      );

      CREATE INDEX IF NOT EXISTS idx_price_history_hash
        ON price_history(item_hash, timestamp);

      CREATE TABLE IF NOT EXISTS currency_rates (
        currency TEXT PRIMARY KEY,
        rate_to_exalted REAL NOT NULL,
        last_updated INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS poll_state (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);
  }

  /**
   * Get the cached price data for an item by its hash.
   */
  getPrice(itemHash: string): PriceCacheEntry | null {
    const row = this.db.prepare(`
      SELECT item_hash, base_type, mod_signature, avg_price, min_price, max_price,
             sample_count, last_updated, league
      FROM price_cache
      WHERE item_hash = ?
    `).get(itemHash) as Record<string, unknown> | undefined;

    if (!row) return null;

    return {
      itemHash: row.item_hash as string,
      baseType: row.base_type as string,
      modSignature: row.mod_signature as string,
      avgPrice: row.avg_price as number,
      minPrice: row.min_price as number,
      maxPrice: row.max_price as number,
      sampleCount: row.sample_count as number,
      lastUpdated: row.last_updated as number,
      league: row.league as string,
    };
  }

  /**
   * Upsert a price observation. Updates the rolling average.
   */
  upsertPrice(entry: PriceCacheEntry): void {
    const existing = this.getPrice(entry.itemHash);

    if (existing) {
      // Update rolling average
      const totalSamples = existing.sampleCount + 1;
      const newAvg = ((existing.avgPrice * existing.sampleCount) + entry.avgPrice) / totalSamples;
      const newMin = Math.min(existing.minPrice, entry.minPrice);
      const newMax = Math.max(existing.maxPrice, entry.maxPrice);

      this.db.prepare(`
        UPDATE price_cache
        SET avg_price = ?, min_price = ?, max_price = ?,
            sample_count = ?, last_updated = ?
        WHERE item_hash = ?
      `).run(newAvg, newMin, newMax, totalSamples, Date.now(), entry.itemHash);
    } else {
      this.db.prepare(`
        INSERT INTO price_cache (item_hash, base_type, mod_signature, avg_price,
                                 min_price, max_price, sample_count, last_updated, league)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        entry.itemHash, entry.baseType, entry.modSignature,
        entry.avgPrice, entry.minPrice, entry.maxPrice,
        entry.sampleCount, entry.lastUpdated, entry.league
      );
    }
  }

  /**
   * Record a single price observation in the history table.
   */
  recordPriceHistory(itemHash: string, price: number, currency: string, league: string): void {
    this.db.prepare(`
      INSERT INTO price_history (item_hash, price, currency, timestamp, league)
      VALUES (?, ?, ?, ?, ?)
    `).run(itemHash, price, currency, Date.now(), league);
  }

  /**
   * Get price history for an item within a time window.
   */
  getPriceHistory(itemHash: string, windowMs: number = 24 * 60 * 60 * 1000): Array<{ price: number; timestamp: number }> {
    const cutoff = Date.now() - windowMs;

    return this.db.prepare(`
      SELECT price, timestamp
      FROM price_history
      WHERE item_hash = ? AND timestamp > ?
      ORDER BY timestamp DESC
    `).all(itemHash, cutoff) as Array<{ price: number; timestamp: number }>;
  }

  /**
   * Get the market average price for similar items (by base type and league).
   */
  getMarketAverage(baseType: string, league: string): { avgPrice: number; sampleCount: number } | null {
    const row = this.db.prepare(`
      SELECT AVG(avg_price) as avg_price, SUM(sample_count) as sample_count
      FROM price_cache
      WHERE base_type = ? AND league = ?
    `).get(baseType, league) as { avg_price: number | null; sample_count: number | null } | undefined;

    if (!row || row.avg_price === null) return null;

    return {
      avgPrice: row.avg_price,
      sampleCount: row.sample_count || 0,
    };
  }

  /**
   * Save/load poll state (change_id persistence).
   */
  savePollState(key: string, value: string): void {
    this.db.prepare(`
      INSERT OR REPLACE INTO poll_state (key, value) VALUES (?, ?)
    `).run(key, value);
  }

  getPollState(key: string): string | null {
    const row = this.db.prepare(`
      SELECT value FROM poll_state WHERE key = ?
    `).get(key) as { value: string } | undefined;

    return row?.value || null;
  }

  /**
   * Clean up old price history entries (default: older than 7 days).
   */
  pruneHistory(maxAgeMs: number = 7 * 24 * 60 * 60 * 1000): number {
    const cutoff = Date.now() - maxAgeMs;

    const result = this.db.prepare(`
      DELETE FROM price_history WHERE timestamp < ?
    `).run(cutoff);

    return result.changes;
  }

  /**
   * Close the database connection.
   */
  close(): void {
    this.db.close();
  }
}
