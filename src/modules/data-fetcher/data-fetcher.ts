import axios, { AxiosInstance, AxiosError } from 'axios';
import { EventEmitter } from 'events';
import {
  StashTabResponse,
  RawStashTab,
  RawItem,
  PoE2Item,
  ItemRarity,
  ItemCategory,
  Mod,
  ModStat,
  Price,
  CurrencyType,
  AppConfig,
} from '../../models/types';
import { RateLimiter } from '../../utils/rate-limiter';

/**
 * DataFetcher: Polls the PoE2 Public Stash Tab API.
 *
 * Responsibilities:
 * - Maintain a change_id cursor for incremental polling
 * - Respect rate limits (retry-after headers, exponential backoff)
 * - Transform raw API items into normalized PoE2Item objects
 * - Emit items for downstream processing
 *
 * COMPLIANCE: This is strictly READ-ONLY. No game interaction.
 */
export class DataFetcher extends EventEmitter {
  private client: AxiosInstance;
  private rateLimiter: RateLimiter;
  private nextChangeId: string | null = null;
  private running: boolean = false;
  private pollTimer: ReturnType<typeof setTimeout> | null = null;
  private config: AppConfig;

  constructor(config: AppConfig) {
    super();
    this.config = config;

    this.client = axios.create({
      baseURL: config.poeApiBaseUrl,
      timeout: 30_000,
      headers: {
        'User-Agent': 'ExileInsight/0.1.0 (contact: exile-insight@example.com)',
        'Accept': 'application/json',
      },
    });

    this.rateLimiter = new RateLimiter(config.pollIntervalMs);
  }

  /**
   * Start polling the API. Emits 'items' events with PoE2Item arrays.
   */
  async start(initialChangeId?: string): Promise<void> {
    if (this.running) return;

    this.running = true;
    this.nextChangeId = initialChangeId || null;

    this.emit('status', 'started');
    this.poll();
  }

  /**
   * Stop polling.
   */
  stop(): void {
    this.running = false;
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
    this.emit('status', 'stopped');
  }

  /**
   * Get the current change ID (for persistence/resume).
   */
  getChangeId(): string | null {
    return this.nextChangeId;
  }

  private async poll(): Promise<void> {
    if (!this.running) return;

    try {
      await this.rateLimiter.waitForSlot();

      const response = await this.fetchStashTabs();

      if (response) {
        this.nextChangeId = response.next_change_id;
        this.rateLimiter.recordSuccess();

        const items = this.processStashTabs(response.stashes);

        if (items.length > 0) {
          this.emit('items', items);
        }

        this.emit('poll', {
          changeId: this.nextChangeId,
          itemCount: items.length,
          stashCount: response.stashes.length,
        });
      }
    } catch (error) {
      this.handleError(error as Error);
    }

    // Schedule next poll
    if (this.running) {
      const delay = this.rateLimiter.getDelay();
      this.pollTimer = setTimeout(() => this.poll(), delay || this.config.pollIntervalMs);
    }
  }

  private async fetchStashTabs(): Promise<StashTabResponse | null> {
    const params: Record<string, string> = {};
    if (this.nextChangeId) {
      params.id = this.nextChangeId;
    }

    const response = await this.client.get<StashTabResponse>('', { params });

    // Check for rate limit headers
    const retryAfter = RateLimiter.parseRetryAfter(
      response.headers as Record<string, string>
    );
    if (retryAfter) {
      this.rateLimiter.recordError(retryAfter);
      return null;
    }

    return response.data;
  }

  /**
   * Process raw stash tabs into normalized PoE2Item objects.
   * Filters to only public, priced items in the target league.
   */
  private processStashTabs(stashes: RawStashTab[]): PoE2Item[] {
    const items: PoE2Item[] = [];

    for (const stash of stashes) {
      if (!stash.public) continue;
      if (stash.league !== this.config.league) continue;

      for (const rawItem of stash.items) {
        const price = this.parsePrice(rawItem.note);
        if (!price) continue; // Skip unpriced items

        const item = this.transformItem(rawItem, stash, price);
        if (item) {
          items.push(item);
        }
      }
    }

    return items;
  }

  /**
   * Transform a raw API item into a normalized PoE2Item.
   */
  private transformItem(raw: RawItem, stash: RawStashTab, price: Price): PoE2Item | null {
    const rarity = this.mapFrameType(raw.frameType);
    if (!rarity) return null;

    const category = this.inferCategory(raw);

    return {
      id: raw.id,
      name: raw.name?.replace(/<<set:MS>><<set:M>><<set:S>>/g, '').trim() || '',
      baseType: raw.typeLine,
      itemLevel: raw.ilvl,
      rarity,
      category,
      mods: {
        implicit: this.parseMods(raw.implicitMods),
        explicit: this.parseMods(raw.explicitMods),
        enchant: this.parseMods(raw.enchantMods),
      },
      requirements: this.parseRequirements(raw.requirements),
      influences: raw.influences ? Object.keys(raw.influences).filter(k => raw.influences![k]) : [],
      stash: {
        accountName: stash.accountName,
        stashName: stash.stash,
        league: stash.league,
      },
      listingPrice: price,
    };
  }

  /**
   * Parse the price note from a stash tab item.
   * Format: "~price <amount> <currency>" or "~b/o <amount> <currency>"
   */
  private parsePrice(note?: string): Price | null {
    if (!note) return null;

    const match = note.match(/~(?:price|b\/o)\s+([\d.]+)\s+(\S+)/);
    if (!match) return null;

    const amount = parseFloat(match[1]);
    if (isNaN(amount) || amount <= 0) return null;

    const currencyMap: Record<string, CurrencyType> = {
      'exalted': 'exalted',
      'exa': 'exalted',
      'divine': 'divine',
      'div': 'divine',
      'chaos': 'chaos',
      'gold': 'gold',
      'alch': 'alchemy',
      'fusing': 'fusing',
      'fuse': 'fusing',
      'chromatic': 'chromatic',
      'chrome': 'chromatic',
      'jeweller': 'jeweller',
      'jew': 'jeweller',
      'alt': 'alteration',
      'alteration': 'alteration',
      'transmute': 'transmutation',
      'vaal': 'vaal',
      'regal': 'regal',
      'scour': 'scouring',
      'chance': 'chance',
      'mirror': 'mirror',
    };

    const currency = currencyMap[match[2].toLowerCase()];
    if (!currency) return null;

    return { amount, currency };
  }

  private parseMods(modTexts?: string[]): Mod[] {
    if (!modTexts) return [];

    return modTexts.map(text => ({
      text,
      stats: this.parseModStats(text),
    }));
  }

  /**
   * Parse stat IDs and values from a mod text line.
   */
  private parseModStats(text: string): ModStat[] {
    const stats: ModStat[] = [];

    const patterns: Array<{ regex: RegExp; statId: string }> = [
      { regex: /\+(\d+) to maximum Life/, statId: 'flat_life' },
      { regex: /(\d+)% increased maximum Life/, statId: 'percent_life' },
      { regex: /\+(\d+) to maximum Energy Shield/, statId: 'flat_es' },
      { regex: /\+(\d+)% to Fire Resistance/, statId: 'percent_fire_res' },
      { regex: /\+(\d+)% to Cold Resistance/, statId: 'percent_cold_res' },
      { regex: /\+(\d+)% to Lightning Resistance/, statId: 'percent_lightning_res' },
      { regex: /\+(\d+)% to Chaos Resistance/, statId: 'percent_chaos_res' },
      { regex: /\+(\d+)% to all Elemental Resistances/, statId: 'percent_all_ele_res' },
      { regex: /\+(\d+) to Strength/, statId: 'flat_str' },
      { regex: /\+(\d+) to Dexterity/, statId: 'flat_dex' },
      { regex: /\+(\d+) to Intelligence/, statId: 'flat_int' },
      { regex: /\+(\d+) to all Attributes/, statId: 'flat_all_attr' },
      { regex: /Adds (\d+) to \d+ Physical Damage/, statId: 'added_phys_min' },
      { regex: /Adds \d+ to (\d+) Physical Damage/, statId: 'added_phys_max' },
      { regex: /(\d+)% increased Physical Damage/, statId: 'percent_phys' },
      { regex: /(\d+)% increased Attack Speed/, statId: 'percent_attack_speed' },
      { regex: /(\d+)% increased Critical Strike Chance/, statId: 'percent_crit_chance' },
      { regex: /\+(\d+)% to Critical Strike Multiplier/, statId: 'percent_crit_multi' },
      { regex: /\+(\d+) to Armour/, statId: 'flat_armour' },
      { regex: /(\d+)% increased Armour/, statId: 'percent_armour' },
      { regex: /\+(\d+) to Evasion Rating/, statId: 'flat_evasion' },
      { regex: /(\d+)% increased Evasion Rating/, statId: 'percent_evasion' },
    ];

    for (const { regex, statId } of patterns) {
      const match = text.match(regex);
      if (match) {
        const value = parseInt(match[1], 10);
        stats.push({
          id: statId,
          value,
          min: value, // Without tier data, min=max=value
          max: value,
        });
      }
    }

    return stats;
  }

  private parseRequirements(reqs?: Array<{ name: string; values: [string, number][] }>): {
    level?: number;
    str?: number;
    dex?: number;
    int?: number;
  } {
    if (!reqs) return {};

    const result: Record<string, number> = {};
    for (const req of reqs) {
      const value = req.values?.[0]?.[0];
      if (value === undefined) continue;

      const numVal = parseInt(String(value), 10);
      if (isNaN(numVal)) continue;

      switch (req.name) {
        case 'Level': result.level = numVal; break;
        case 'Str': result.str = numVal; break;
        case 'Dex': result.dex = numVal; break;
        case 'Int': result.int = numVal; break;
      }
    }
    return result;
  }

  private mapFrameType(frameType: number): ItemRarity | null {
    switch (frameType) {
      case 0: return 'Normal';
      case 1: return 'Magic';
      case 2: return 'Rare';
      case 3: return 'Unique';
      default: return null; // Gem, currency, etc. — not evaluated
    }
  }

  private inferCategory(raw: RawItem): ItemCategory {
    const cat = raw.extended?.category?.toLowerCase();
    if (!cat) return 'armour';

    if (cat.includes('weapon')) return 'weapon';
    if (cat.includes('armour')) return 'armour';
    if (cat.includes('accessory') || cat.includes('ring') || cat.includes('amulet') || cat.includes('belt')) return 'accessory';
    if (cat.includes('gem')) return 'gem';
    if (cat.includes('jewel')) return 'jewel';
    if (cat.includes('flask')) return 'flask';
    if (cat.includes('currency')) return 'currency';

    return 'armour';
  }

  private handleError(error: Error): void {
    if (error instanceof AxiosError) {
      const status = error.response?.status;

      if (status === 429) {
        // Rate limited — extract retry-after
        const retryAfter = RateLimiter.parseRetryAfter(
          (error.response?.headers || {}) as Record<string, string>
        );
        this.rateLimiter.recordError(retryAfter);
        this.emit('rate-limited', { retryAfter });
        return;
      }

      if (status === 503) {
        // Service unavailable — back off
        this.rateLimiter.recordError(30);
        this.emit('error', { message: 'API temporarily unavailable', status });
        return;
      }
    }

    this.rateLimiter.recordError();
    this.emit('error', { message: error.message, error });
  }
}
