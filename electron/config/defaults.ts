import { AppConfig, CurrencyType } from '../models/types';

const defaultCurrencyRates: Record<CurrencyType, number> = {
  exalted: 1,
  divine: 1.2,
  chaos: 0.008,
  gold: 0.00001,
  alchemy: 0.003,
  fusing: 0.004,
  chromatic: 0.001,
  jeweller: 0.002,
  alteration: 0.001,
  transmutation: 0.0002,
  vaal: 0.005,
  regal: 0.006,
  scouring: 0.004,
  chance: 0.002,
  mirror: 200,
};

export const DEFAULT_CONFIG: AppConfig = {
  poeApiBaseUrl: 'https://api.pathofexile.com/public-stash-tabs',
  pollIntervalMs: 1500,
  debounceWindowMs: 10_000,
  maxDealsPerCycle: 5,
  league: 'Standard',
  llmModel: 'gpt-4o',
  llmBaseUrl: 'https://api.openai.com/v1',
  dbPath: './data/exile-insight.db',
  dpsThreshold: 5,
  ehpThreshold: 5,
  priceRatioThreshold: 0.8,
  currencyRates: defaultCurrencyRates,
};
