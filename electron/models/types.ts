// ============================================================================
// Exile-Insight: Core Type Definitions
// All shared types for the application
// ============================================================================

// --- Currency & Pricing ---

export type CurrencyType =
  | 'exalted'
  | 'divine'
  | 'chaos'
  | 'gold'
  | 'alchemy'
  | 'fusing'
  | 'chromatic'
  | 'jeweller'
  | 'alteration'
  | 'transmutation'
  | 'vaal'
  | 'regal'
  | 'scouring'
  | 'chance'
  | 'mirror';

export interface Price {
  amount: number;
  currency: CurrencyType;
}

export interface NormalizedPrice {
  amount: number;
  currency: 'exalted'; // All prices normalized to exalted for comparison
  originalPrice: Price;
}

// --- Item Types ---

export type ItemRarity = 'Normal' | 'Magic' | 'Rare' | 'Unique';

export type ItemCategory =
  | 'weapon'
  | 'armour'
  | 'accessory'
  | 'gem'
  | 'jewel'
  | 'flask'
  | 'currency'
  | 'gold';

export type ItemSlot =
  | 'helm'
  | 'body'
  | 'gloves'
  | 'boots'
  | 'belt'
  | 'amulet'
  | 'ring1'
  | 'ring2'
  | 'weapon1'
  | 'weapon2'
  | 'offhand1'
  | 'offhand2'
  | 'flask1'
  | 'flask2'
  | 'flask3'
  | 'flask4'
  | 'flask5'
  | 'jewel';

export interface ModStat {
  id: string;         // e.g., "flat_life", "percent_fire_res"
  value: number;
  min: number;
  max: number;
}

export interface Mod {
  text: string;        // Human-readable mod text
  tier?: number;       // Mod tier (1 = best)
  stats: ModStat[];
}

export interface ItemRequirements {
  level?: number;
  str?: number;
  dex?: number;
  int?: number;
}

export interface StashInfo {
  accountName: string;
  stashName: string;
  league: string;
}

export interface PoE2Item {
  id: string;
  name: string;
  baseType: string;
  itemLevel: number;
  rarity: ItemRarity;
  category: ItemCategory;
  slot?: ItemSlot;
  mods: {
    implicit: Mod[];
    explicit: Mod[];
    enchant: Mod[];
  };
  requirements: ItemRequirements;
  influences: string[];
  stash: StashInfo;
  listingPrice?: Price;
}

// --- Build / Character ---

export type StatId = string; // e.g., "flat_life", "percent_fire_res", "added_phys_min"

/**
 * A single stat weight entry. When `required` is set, the stat has near-infinite
 * value until `requiredAmount` is reached, then drops to `baseWeight`.
 */
export interface StatWeight {
  statId: StatId;
  baseWeight: number;          // Weight after requirements are met
  required: boolean;           // Is this a hard requirement?
  requiredAmount: number;      // Target value for the requirement
  currentAmount: number;       // Current value from gear + passives
}

export interface BuildRequirement {
  type: 'resistance_cap' | 'attribute_min' | 'gem_level' | 'custom';
  statId: StatId;
  target: number;
  current: number;
  label: string;               // Human-readable description
}

export interface EquippedItem {
  slot: ItemSlot;
  item?: PoE2Item;             // undefined = empty slot
  statContributions: Record<StatId, number>;
}

export interface CharacterBuild {
  name: string;
  class: string;
  ascendancy?: string;
  level: number;
  league: string;

  // Core character stats from PoB
  stats: {
    life: number;
    energyShield: number;
    mana: number;
    evasion: number;
    armour: number;
    blockChance: number;

    fireRes: number;
    coldRes: number;
    lightningRes: number;
    chaosRes: number;

    str: number;
    dex: number;
    int: number;

    // Offensive
    totalDps: number;
    attackSpeed: number;
    critChance: number;
    critMultiplier: number;
    accuracy: number;
  };

  equipped: EquippedItem[];
  requirements: BuildRequirement[];
  mainSkill?: string;
  pobCode?: string;
}

export interface BuildProfile {
  build: CharacterBuild;
  statWeights: StatWeight[];
  prioritySlots: ItemSlot[];   // Slots with biggest upgrade potential
}

// --- Deal Scoring ---

export interface StatContribution {
  value: number;
  weight: number;
  weightedValue: number;
}

export interface DealEvaluation {
  dpsChange: {
    absolute: number;
    percentage: number;
  };
  ehpChange: {
    absolute: number;
    percentage: number;
  };
  statContributions: Record<StatId, StatContribution>;
  meetsRequirements: boolean;
  unmetRequirements: string[];
  isUpgrade: boolean;
}

export interface PriceAnalysis {
  currentPrice: NormalizedPrice;
  marketAverage: NormalizedPrice;
  priceRatio: number;          // currentPrice / marketAverage. <0.8 = good deal
  sampleSize: number;          // How many data points for the average
  confidence: number;          // 0-1, based on sample size
}

export type AITier = 'S' | 'A' | 'B' | 'C' | 'D' | 'F';

export interface AIAnalysis {
  tier: AITier;
  reasoning: string;
  synergies: string[];
  warnings: string[];
}

export interface ItemDeal {
  id: string;
  item: PoE2Item;
  dealScore: number;           // 0-100
  evaluation: DealEvaluation;
  pricing: PriceAnalysis;
  aiAnalysis?: AIAnalysis;     // Only for complex rares
  timestamp: Date;
}

// --- API Types ---

export interface StashTabResponse {
  next_change_id: string;
  stashes: RawStashTab[];
}

export interface RawStashTab {
  accountName: string;
  stash: string;
  stashType: string;
  items: RawItem[];
  public: boolean;
  league: string;
}

export interface RawItem {
  id: string;
  name: string;
  typeLine: string;
  ilvl: number;
  frameType: number;            // 0=Normal, 1=Magic, 2=Rare, 3=Unique
  implicitMods?: string[];
  explicitMods?: string[];
  enchantMods?: string[];
  requirements?: Array<{ name: string; values: [string, number][] }>;
  note?: string;                // Price tag from the stash
  influences?: Record<string, boolean>;
  extended?: {
    category?: string;
    subcategories?: string[];
  };
}

// --- Database Types ---

export interface PriceCacheEntry {
  itemHash: string;             // Hash of base type + key mod tiers
  baseType: string;
  modSignature: string;         // Canonical string of mod tier ranges
  avgPrice: number;             // In exalted orbs
  minPrice: number;
  maxPrice: number;
  sampleCount: number;
  lastUpdated: number;          // Unix timestamp
  league: string;
}

// --- Configuration ---

export interface AppConfig {
  poeApiBaseUrl: string;
  pollIntervalMs: number;       // Base poll interval (modified by rate limiter)
  debounceWindowMs: number;     // Buffer window for deal batching (default: 10000)
  maxDealsPerCycle: number;     // Top N deals to show per cycle (default: 5)
  league: string;
  llmApiKey?: string;
  llmModel: string;
  llmBaseUrl: string;
  dbPath: string;
  dpsThreshold: number;        // Min % DPS increase (default: 5)
  ehpThreshold: number;        // Min % EHP increase (default: 5)
  priceRatioThreshold: number; // Max price ratio for "good deal" (default: 0.8)
  currencyRates: Record<CurrencyType, number>; // Exchange rates to exalted
}
