import { createHash } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import {
  PoE2Item,
  ItemDeal,
  DealEvaluation,
  PriceAnalysis,
  NormalizedPrice,
  BuildProfile,
  AppConfig,
  CurrencyType,
  ModStat,
} from '../../models/types';
import { BuildEvaluator } from '../../core/build-evaluator';
import { MarketDatabase } from '../database';
import { AIAdvisor } from '../ai-advisor';

/**
 * ItemEvaluator: The "Value Engine" of Exile-Insight.
 *
 * An item is a "Good Deal" if:
 * 1. It provides a >5% DPS or EHP increase.
 * 2. Its price is <80% of the historical market average for those stat tiers.
 *
 * This class orchestrates BuildEvaluator (stat analysis) + MarketDatabase
 * (price analysis) + AIAdvisor (complex synergy analysis for rares).
 */
export class ItemEvaluator {
  private buildEvaluator: BuildEvaluator;
  private database: MarketDatabase;
  private aiAdvisor: AIAdvisor | null;
  private config: AppConfig;

  constructor(
    buildEvaluator: BuildEvaluator,
    database: MarketDatabase,
    aiAdvisor: AIAdvisor | null,
    config: AppConfig
  ) {
    this.buildEvaluator = buildEvaluator;
    this.database = database;
    this.aiAdvisor = aiAdvisor;
    this.config = config;
  }

  /**
   * Evaluate a batch of items and return the top N deals.
   * This is called by the StreamBuffer on each flush cycle.
   */
  async evaluateBatch(items: PoE2Item[]): Promise<ItemDeal[]> {
    const profile = this.buildEvaluator.getProfile();
    if (!profile) return [];

    const deals: ItemDeal[] = [];

    for (const item of items) {
      const deal = await this.evaluateItem(item, profile);
      if (deal && deal.dealScore > 0) {
        deals.push(deal);
      }
    }

    // Sort by deal score descending, return top N
    deals.sort((a, b) => b.dealScore - a.dealScore);
    return deals.slice(0, this.config.maxDealsPerCycle);
  }

  /**
   * Evaluate a single item against the build profile.
   */
  async evaluateItem(item: PoE2Item, profile: BuildProfile): Promise<ItemDeal | null> {
    // Step 1: Get the stat-based evaluation from BuildEvaluator
    const evaluation = this.buildEvaluator.evaluateItem(item);
    if (!evaluation) return null;

    // Step 2: Analyze pricing
    const pricing = this.analyzePricing(item);
    if (!pricing) return null;

    // Step 3: Check deal thresholds
    const meetsThresholds = this.checkDealThresholds(evaluation, pricing);

    // Step 4: For complex rares, consult the AI advisor
    let aiAnalysis = undefined;
    if (
      this.aiAdvisor &&
      item.rarity === 'Rare' &&
      this.isComplexItem(item) &&
      meetsThresholds
    ) {
      aiAnalysis = await this.aiAdvisor.analyzeItem(item, profile);
    }

    // Step 5: Calculate composite deal score
    const dealScore = this.calculateDealScore(evaluation, pricing, aiAnalysis);

    if (dealScore <= 0) return null;

    // Step 6: Cache the price observation
    this.cachePrice(item, pricing);

    return {
      id: uuidv4(),
      item,
      dealScore,
      evaluation,
      pricing,
      aiAnalysis,
      timestamp: new Date(),
    };
  }

  /**
   * Analyze item pricing against historical market data.
   */
  private analyzePricing(item: PoE2Item): PriceAnalysis | null {
    if (!item.listingPrice) return null;

    const normalizedCurrent = this.normalizePrice(item.listingPrice);
    const itemHash = this.computeItemHash(item);

    // Look up historical average
    const cached = this.database.getPrice(itemHash);
    let marketAvg: NormalizedPrice;
    let sampleSize: number;
    let confidence: number;

    if (cached && cached.sampleCount >= 3) {
      marketAvg = {
        amount: cached.avgPrice,
        currency: 'exalted',
        originalPrice: { amount: cached.avgPrice, currency: 'exalted' },
      };
      sampleSize = cached.sampleCount;
      // Confidence scales with sample size, caps at 1.0 around 50 samples
      confidence = Math.min(1.0, cached.sampleCount / 50);
    } else {
      // Fall back to base type average
      const baseAvg = this.database.getMarketAverage(item.baseType, item.stash.league);
      if (baseAvg && baseAvg.sampleCount >= 3) {
        marketAvg = {
          amount: baseAvg.avgPrice,
          currency: 'exalted',
          originalPrice: { amount: baseAvg.avgPrice, currency: 'exalted' },
        };
        sampleSize = baseAvg.sampleCount;
        confidence = Math.min(0.5, baseAvg.sampleCount / 100); // Lower confidence for base-type averages
      } else {
        // Not enough data — can't evaluate pricing
        marketAvg = normalizedCurrent; // 1:1 ratio means no deal signal
        sampleSize = 0;
        confidence = 0;
      }
    }

    const priceRatio = marketAvg.amount > 0
      ? normalizedCurrent.amount / marketAvg.amount
      : 1;

    return {
      currentPrice: normalizedCurrent,
      marketAverage: marketAvg,
      priceRatio,
      sampleSize,
      confidence,
    };
  }

  /**
   * Check if the item meets the threshold criteria for being a "Good Deal".
   */
  private checkDealThresholds(evaluation: DealEvaluation, pricing: PriceAnalysis): boolean {
    const hasDpsUpgrade = evaluation.dpsChange.percentage >= this.config.dpsThreshold;
    const hasEhpUpgrade = evaluation.ehpChange.percentage >= this.config.ehpThreshold;
    const isPriceGood = pricing.priceRatio <= this.config.priceRatioThreshold;

    // Deal must be both a build upgrade AND a good price
    return (hasDpsUpgrade || hasEhpUpgrade) && isPriceGood;
  }

  /**
   * Calculate the composite Deal Score (0-100).
   *
   * Scoring breakdown:
   * - Build upgrade value: 0-40 points
   * - Price value: 0-30 points
   * - AI analysis bonus: 0-15 points
   * - Confidence factor: 0-15 points
   */
  private calculateDealScore(
    evaluation: DealEvaluation,
    pricing: PriceAnalysis,
    aiAnalysis?: { tier: string } & Record<string, unknown>
  ): number {
    let score = 0;

    // --- Build Upgrade Value (0-40) ---
    const dpsScore = Math.min(20, evaluation.dpsChange.percentage * 2);
    const ehpScore = Math.min(20, evaluation.ehpChange.percentage * 2);
    score += dpsScore + ehpScore;

    // Penalty for unmet requirements
    if (!evaluation.meetsRequirements) {
      score *= 0.3; // Harsh penalty — can't equip the item
    }

    // --- Price Value (0-30) ---
    // The lower the price ratio, the better the deal
    if (pricing.priceRatio < this.config.priceRatioThreshold) {
      // Scale: ratio 0.8 = 10 points, ratio 0.5 = 20 points, ratio 0.2 = 30 points
      const priceScore = Math.min(30, (1 - pricing.priceRatio) * 50);
      score += priceScore;
    }

    // --- AI Analysis Bonus (0-15) ---
    if (aiAnalysis) {
      const tierScores: Record<string, number> = {
        'S': 15, 'A': 12, 'B': 8, 'C': 4, 'D': 0, 'F': -10,
      };
      score += tierScores[aiAnalysis.tier] || 0;
    }

    // --- Confidence Factor (0-15) ---
    // Higher confidence in price data = more trustworthy score
    score += pricing.confidence * 15;

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  /**
   * Determine if an item is "complex" enough to warrant AI analysis.
   * Complex items have multiple interacting mods that simple math might miss.
   */
  private isComplexItem(item: PoE2Item): boolean {
    const explicitCount = item.mods.explicit.length;

    // Items with 4+ explicit mods may have complex synergies
    if (explicitCount >= 4) return true;

    // Items with unusual mod combinations
    const hasOffense = item.mods.explicit.some(m =>
      m.stats.some(s => ['percent_phys', 'percent_attack_speed', 'percent_crit_chance', 'percent_crit_multi'].includes(s.id))
    );
    const hasDefense = item.mods.explicit.some(m =>
      m.stats.some(s => ['flat_life', 'flat_es', 'flat_armour', 'flat_evasion'].includes(s.id))
    );

    // Mixed offense/defense items are harder to evaluate
    return hasOffense && hasDefense;
  }

  /**
   * Normalize a price to exalted orbs using configured exchange rates.
   */
  private normalizePrice(price: { amount: number; currency: CurrencyType }): NormalizedPrice {
    const rate = this.config.currencyRates[price.currency] || 1;
    return {
      amount: price.amount * rate,
      currency: 'exalted',
      originalPrice: price,
    };
  }

  /**
   * Compute a hash for an item that groups "similar" items together.
   * Based on base type + mod tier ranges (not exact values).
   */
  private computeItemHash(item: PoE2Item): string {
    const modSig = this.computeModSignature(item);
    const input = `${item.baseType}|${modSig}`;
    return createHash('sha256').update(input).digest('hex').substring(0, 16);
  }

  /**
   * Create a canonical signature of an item's mods for grouping purposes.
   * Groups mods into tier ranges so similar items are bucketed together.
   */
  private computeModSignature(item: PoE2Item): string {
    const allStats: Array<{ id: string; tier: string }> = [];

    for (const mod of [...item.mods.implicit, ...item.mods.explicit]) {
      for (const stat of mod.stats) {
        // Bucket values into tiers: low/mid/high
        const tier = this.statTierBucket(stat);
        allStats.push({ id: stat.id, tier });
      }
    }

    // Sort for canonical ordering
    allStats.sort((a, b) => a.id.localeCompare(b.id));
    return allStats.map(s => `${s.id}:${s.tier}`).join(',');
  }

  private statTierBucket(stat: ModStat): string {
    if (stat.max === 0) return 'zero';
    const ratio = stat.value / stat.max;
    if (ratio >= 0.8) return 'high';
    if (ratio >= 0.5) return 'mid';
    return 'low';
  }

  /**
   * Cache a price observation in the database.
   */
  private cachePrice(item: PoE2Item, pricing: PriceAnalysis): void {
    const itemHash = this.computeItemHash(item);

    this.database.upsertPrice({
      itemHash,
      baseType: item.baseType,
      modSignature: this.computeModSignature(item),
      avgPrice: pricing.currentPrice.amount,
      minPrice: pricing.currentPrice.amount,
      maxPrice: pricing.currentPrice.amount,
      sampleCount: 1,
      lastUpdated: Date.now(),
      league: item.stash.league,
    });

    this.database.recordPriceHistory(
      itemHash,
      pricing.currentPrice.amount,
      pricing.currentPrice.originalPrice.currency,
      item.stash.league
    );
  }
}
