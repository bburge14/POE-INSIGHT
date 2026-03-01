import type { NinjaCurrency, NinjaUniqueItem, ParsedItem, TradeListing, TradeSearchResult, TradeStatFilter } from "@shared/schema";
import { log } from "./index";

const CURRENCY_URL = "https://poe.ninja/poe2/api/economy/exchange/current/overview";

const cache = new Map<string, { data: any; expires: number }>();
const CACHE_TTL = 5 * 60 * 1000;

async function fetchWithCache<T>(url: string, params: Record<string, string>): Promise<T> {
  const key = `${url}?${new URLSearchParams(params).toString()}`;
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) {
    return cached.data as T;
  }

  try {
    const fullUrl = `${url}?${new URLSearchParams(params).toString()}`;
    log(`Fetching: ${fullUrl}`, "ninja");
    const res = await fetch(fullUrl, {
      headers: {
        "User-Agent": "ExileInsight/1.0",
        "Accept": "application/json",
      },
    });

    if (!res.ok) {
      throw new Error(`poe.ninja returned ${res.status}: ${res.statusText}`);
    }

    const data = await res.json();
    cache.set(key, { data, expires: Date.now() + CACHE_TTL });
    return data as T;
  } catch (err: any) {
    log(`poe.ninja fetch error: ${err.message}`, "ninja");
    throw err;
  }
}

export async function getCurrencies(league: string): Promise<NinjaCurrency[]> {
  try {
    const leagueSlug = leagueToSlug(league);
    const data = await fetchWithCache<any>(CURRENCY_URL, {
      league: leagueSlug,
      type: "Currency",
    });

    const lines = data.lines || [];
    const items = data.items || [];

    return lines.map((line: any) => {
      const item = items.find((i: any) => i.id === line.id);
      return {
        id: line.id || "",
        name: item?.name || line.id || "Unknown",
        icon: item?.icon || undefined,
        chaosValue: line.primaryValue || 0,
        volume: line.volumePrimaryValue || 0,
      };
    });
  } catch {
    return [];
  }
}

export async function getUniqueItems(league: string): Promise<NinjaUniqueItem[]> {
  return [];
}

export async function findUniqueByName(name: string, league: string): Promise<NinjaUniqueItem | undefined> {
  return undefined;
}

function leagueToSlug(league: string): string {
  const slugMap: Record<string, string> = {
    "Fate of the Vaal": "vaal",
    "Standard": "standard",
    "Hardcore": "hardcore",
  };
  return slugMap[league] || league.toLowerCase().replace(/\s+/g, "");
}

const ITEM_CLASS_TRADE_CATEGORIES: Record<string, string> = {
  "Body Armours": "armour.chest",
  "Helmets": "armour.helmet",
  "Gloves": "armour.gloves",
  "Boots": "armour.boots",
  "Shields": "armour.shield",
  "Wands": "weapon.wand",
  "Sceptres": "weapon.sceptre",
  "Staves": "weapon.staff",
  "Daggers": "weapon.dagger",
  "Claws": "weapon.claw",
  "One Hand Swords": "weapon.onesword",
  "Two Hand Swords": "weapon.twosword",
  "One Hand Axes": "weapon.oneaxe",
  "Two Hand Axes": "weapon.twoaxe",
  "One Hand Maces": "weapon.onemace",
  "Two Hand Maces": "weapon.twomace",
  "Bows": "weapon.bow",
  "Crossbows": "weapon.crossbow",
  "Quarterstaves": "weapon.quarterstaff",
  "Amulets": "accessory.amulet",
  "Rings": "accessory.ring",
  "Belts": "accessory.belt",
};

interface ModTier {
  min: number;
  max: number;
  tier: string;
}

const MOD_TIERS: Record<string, ModTier[]> = {
  "increased Spell Damage": [
    { min: 10, max: 19, tier: "T7" },
    { min: 20, max: 34, tier: "T6" },
    { min: 35, max: 49, tier: "T5" },
    { min: 50, max: 69, tier: "T4" },
    { min: 70, max: 89, tier: "T3" },
    { min: 90, max: 104, tier: "T2" },
    { min: 105, max: 119, tier: "T1" },
  ],
  "to maximum Life": [
    { min: 10, max: 19, tier: "T7" },
    { min: 20, max: 29, tier: "T6" },
    { min: 30, max: 44, tier: "T5" },
    { min: 45, max: 59, tier: "T4" },
    { min: 60, max: 79, tier: "T3" },
    { min: 80, max: 99, tier: "T2" },
    { min: 100, max: 119, tier: "T1" },
  ],
  "to Fire Resistance": [
    { min: 6, max: 11, tier: "T5" },
    { min: 12, max: 17, tier: "T4" },
    { min: 18, max: 23, tier: "T3" },
    { min: 24, max: 35, tier: "T2" },
    { min: 36, max: 48, tier: "T1" },
  ],
  "to Cold Resistance": [
    { min: 6, max: 11, tier: "T5" },
    { min: 12, max: 17, tier: "T4" },
    { min: 18, max: 23, tier: "T3" },
    { min: 24, max: 35, tier: "T2" },
    { min: 36, max: 48, tier: "T1" },
  ],
  "to Lightning Resistance": [
    { min: 6, max: 11, tier: "T5" },
    { min: 12, max: 17, tier: "T4" },
    { min: 18, max: 23, tier: "T3" },
    { min: 24, max: 35, tier: "T2" },
    { min: 36, max: 48, tier: "T1" },
  ],
  "to Chaos Resistance": [
    { min: 5, max: 10, tier: "T5" },
    { min: 11, max: 16, tier: "T4" },
    { min: 17, max: 22, tier: "T3" },
    { min: 23, max: 30, tier: "T2" },
    { min: 31, max: 38, tier: "T1" },
  ],
  "to all Elemental Resistances": [
    { min: 3, max: 5, tier: "T4" },
    { min: 6, max: 8, tier: "T3" },
    { min: 9, max: 12, tier: "T2" },
    { min: 13, max: 16, tier: "T1" },
  ],
  "increased Attack Speed": [
    { min: 5, max: 7, tier: "T4" },
    { min: 8, max: 10, tier: "T3" },
    { min: 11, max: 13, tier: "T2" },
    { min: 14, max: 16, tier: "T1" },
  ],
  "increased Cast Speed": [
    { min: 5, max: 8, tier: "T4" },
    { min: 9, max: 12, tier: "T3" },
    { min: 13, max: 18, tier: "T2" },
    { min: 19, max: 25, tier: "T1" },
  ],
  "increased Critical Strike Chance": [
    { min: 10, max: 14, tier: "T4" },
    { min: 15, max: 19, tier: "T3" },
    { min: 20, max: 29, tier: "T2" },
    { min: 30, max: 39, tier: "T1" },
  ],
  "to Critical Strike Multiplier": [
    { min: 8, max: 12, tier: "T4" },
    { min: 13, max: 18, tier: "T3" },
    { min: 19, max: 25, tier: "T2" },
    { min: 26, max: 35, tier: "T1" },
  ],
  "to maximum Energy Shield": [
    { min: 3, max: 10, tier: "T6" },
    { min: 11, max: 20, tier: "T5" },
    { min: 21, max: 30, tier: "T4" },
    { min: 31, max: 42, tier: "T3" },
    { min: 43, max: 56, tier: "T2" },
    { min: 57, max: 72, tier: "T1" },
  ],
  "increased Rarity of Items found": [
    { min: 6, max: 10, tier: "T3" },
    { min: 11, max: 18, tier: "T2" },
    { min: 19, max: 28, tier: "T1" },
  ],
  "to maximum Mana": [
    { min: 15, max: 24, tier: "T5" },
    { min: 25, max: 34, tier: "T4" },
    { min: 35, max: 49, tier: "T3" },
    { min: 50, max: 64, tier: "T2" },
    { min: 65, max: 79, tier: "T1" },
  ],
  "increased Physical Damage": [
    { min: 20, max: 39, tier: "T5" },
    { min: 40, max: 64, tier: "T4" },
    { min: 65, max: 89, tier: "T3" },
    { min: 90, max: 114, tier: "T2" },
    { min: 115, max: 149, tier: "T1" },
  ],
  "increased Movement Speed": [
    { min: 10, max: 14, tier: "T3" },
    { min: 15, max: 19, tier: "T2" },
    { min: 20, max: 30, tier: "T1" },
  ],
  "to Armour": [
    { min: 50, max: 100, tier: "T4" },
    { min: 101, max: 200, tier: "T3" },
    { min: 201, max: 350, tier: "T2" },
    { min: 351, max: 500, tier: "T1" },
  ],
  "to Evasion Rating": [
    { min: 50, max: 100, tier: "T4" },
    { min: 101, max: 200, tier: "T3" },
    { min: 201, max: 350, tier: "T2" },
    { min: 351, max: 500, tier: "T1" },
  ],
  "increased Elemental Damage": [
    { min: 10, max: 19, tier: "T4" },
    { min: 20, max: 34, tier: "T3" },
    { min: 35, max: 49, tier: "T2" },
    { min: 50, max: 69, tier: "T1" },
  ],
  "to Strength": [
    { min: 8, max: 12, tier: "T4" },
    { min: 13, max: 17, tier: "T3" },
    { min: 18, max: 22, tier: "T2" },
    { min: 23, max: 30, tier: "T1" },
  ],
  "to Dexterity": [
    { min: 8, max: 12, tier: "T4" },
    { min: 13, max: 17, tier: "T3" },
    { min: 18, max: 22, tier: "T2" },
    { min: 23, max: 30, tier: "T1" },
  ],
  "to Intelligence": [
    { min: 8, max: 12, tier: "T4" },
    { min: 13, max: 17, tier: "T3" },
    { min: 18, max: 22, tier: "T2" },
    { min: 23, max: 30, tier: "T1" },
  ],
  "to all Attributes": [
    { min: 4, max: 6, tier: "T3" },
    { min: 7, max: 10, tier: "T2" },
    { min: 11, max: 16, tier: "T1" },
  ],
  "to Spirit": [
    { min: 5, max: 8, tier: "T4" },
    { min: 9, max: 14, tier: "T3" },
    { min: 15, max: 20, tier: "T2" },
    { min: 21, max: 30, tier: "T1" },
  ],
  "Life Regeneration per second": [
    { min: 3, max: 5, tier: "T4" },
    { min: 6, max: 10, tier: "T3" },
    { min: 11, max: 16, tier: "T2" },
    { min: 17, max: 24, tier: "T1" },
  ],
  "increased Mana Regeneration Rate": [
    { min: 10, max: 19, tier: "T4" },
    { min: 20, max: 39, tier: "T3" },
    { min: 40, max: 59, tier: "T2" },
    { min: 60, max: 79, tier: "T1" },
  ],
  "to Accuracy Rating": [
    { min: 50, max: 100, tier: "T4" },
    { min: 101, max: 175, tier: "T3" },
    { min: 176, max: 275, tier: "T2" },
    { min: 276, max: 400, tier: "T1" },
  ],
  "increased Area of Effect": [
    { min: 5, max: 8, tier: "T3" },
    { min: 9, max: 14, tier: "T2" },
    { min: 15, max: 25, tier: "T1" },
  ],
};

function extractModValue(mod: string): number {
  const match = mod.match(/[+-]?(\d+\.?\d*)/);
  return match ? parseFloat(match[1]) : 0;
}

function findModTier(mod: string, value: number): { pattern: string; tier: ModTier } | null {
  for (const [pattern, tiers] of Object.entries(MOD_TIERS)) {
    if (mod.toLowerCase().includes(pattern.toLowerCase())) {
      for (const tier of tiers) {
        if (value >= tier.min && value <= tier.max) {
          return { pattern, tier };
        }
      }
      const closestTier = tiers.reduce((closest, t) => {
        const dist = Math.min(Math.abs(value - t.min), Math.abs(value - t.max));
        const closestDist = Math.min(Math.abs(value - closest.min), Math.abs(value - closest.max));
        return dist < closestDist ? t : closest;
      });
      return { pattern, tier: closestTier };
    }
  }
  return null;
}

function getStatName(mod: string): string {
  const lower = mod.toLowerCase();
  if (lower.includes("spell damage")) return "Spell Damage";
  if (lower.includes("maximum life")) return "Maximum Life";
  if (lower.includes("fire resistance")) return "Fire Resistance";
  if (lower.includes("cold resistance")) return "Cold Resistance";
  if (lower.includes("lightning resistance")) return "Lightning Resistance";
  if (lower.includes("chaos resistance")) return "Chaos Resistance";
  if (lower.includes("all elemental resistance")) return "All Elemental Resistances";
  if (lower.includes("attack speed")) return "Attack Speed";
  if (lower.includes("cast speed")) return "Cast Speed";
  if (lower.includes("critical strike chance")) return "Critical Strike Chance";
  if (lower.includes("critical strike multiplier") || lower.includes("critical damage")) return "Critical Strike Multiplier";
  if (lower.includes("energy shield")) return "Energy Shield";
  if (lower.includes("physical damage") && lower.includes("increased")) return "Physical Damage";
  if (lower.includes("movement speed")) return "Movement Speed";
  if (lower.includes("armour") || lower.includes("armor")) return "Armour";
  if (lower.includes("evasion")) return "Evasion Rating";
  if (lower.includes("rarity")) return "Item Rarity";
  if (lower.includes("mana") && !lower.includes("regeneration")) return "Maximum Mana";
  if (lower.includes("mana regeneration")) return "Mana Regeneration";
  if (lower.includes("strength")) return "Strength";
  if (lower.includes("dexterity")) return "Dexterity";
  if (lower.includes("intelligence")) return "Intelligence";
  if (lower.includes("all attributes")) return "All Attributes";
  if (lower.includes("spirit")) return "Spirit";
  if (lower.includes("life regeneration")) return "Life Regeneration";
  if (lower.includes("accuracy")) return "Accuracy Rating";
  if (lower.includes("area of effect")) return "Area of Effect";
  if (lower.includes("elemental damage")) return "Elemental Damage";
  if (lower.includes("adds") && lower.includes("damage")) return "Added Damage";
  if (lower.includes("level of") || lower.includes("gem level")) return "+Gem Levels";
  return mod.replace(/[+-]?\d+\.?\d*%?\s*/g, "").trim() || "Unknown Stat";
}

function buildStatFilters(parsed: ParsedItem): TradeStatFilter[] {
  const filters: TradeStatFilter[] = [];
  const allMods = [...parsed.explicitMods, ...parsed.implicitMods];

  for (const mod of allMods) {
    const value = extractModValue(mod);
    if (value === 0) continue;

    const tierInfo = findModTier(mod, value);
    const statName = getStatName(mod);

    if (tierInfo) {
      filters.push({
        modText: mod,
        statName,
        value,
        min: tierInfo.tier.min,
        max: tierInfo.tier.max,
        tierLabel: tierInfo.tier.tier,
      });
    } else {
      const margin = Math.max(Math.round(value * 0.1), 1);
      filters.push({
        modText: mod,
        statName,
        value,
        min: Math.max(0, value - margin),
        max: value + margin,
      });
    }
  }

  return filters;
}

function buildTradeUrl(parsed: ParsedItem, league: string): string {
  const leagueSlug = league === "Fate of the Vaal" ? "Fate+of+the+Vaal"
    : league === "Standard" ? "Standard"
    : encodeURIComponent(league);
  return `https://www.pathofexile.com/trade2/search/poe2/${leagueSlug}`;
}

function buildTradeQuery(parsed: ParsedItem, statFilters: TradeStatFilter[]): any {
  const query: any = {
    query: {
      status: { option: "online" },
      stats: [
        {
          type: "and",
          filters: [],
        },
      ],
    },
    sort: { price: "asc" },
  };

  if (parsed.rarity === "Unique") {
    query.query.name = parsed.name;
    query.query.type = parsed.baseType;
  } else {
    if (parsed.baseType) {
      query.query.type = parsed.baseType;
    }
  }

  const category = ITEM_CLASS_TRADE_CATEGORIES[parsed.itemClass];
  if (category) {
    query.query.filters = query.query.filters || {};
    query.query.filters.type_filters = {
      filters: {
        category: { option: category },
      },
    };
  }

  return query;
}

async function tryTradeApiSearch(query: any, league: string): Promise<string | null> {
  try {
    const leaguePath = encodeURIComponent(league);
    const url = `https://www.pathofexile.com/api/trade2/search/poe2/${leaguePath}`;
    log(`Trying PoE2 trade API: ${url}`, "trade");

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "ExileInsight/1.0 (trade-advisor)",
        "Accept": "application/json",
      },
      body: JSON.stringify(query),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.id) {
        const leagueSlug = league === "Fate of the Vaal" ? "Fate+of+the+Vaal"
          : encodeURIComponent(league);
        const directUrl = `https://www.pathofexile.com/trade2/search/poe2/${leagueSlug}/${data.id}`;
        log(`Trade API returned search ID: ${data.id}`, "trade");
        return directUrl;
      }
    } else {
      log(`Trade API returned ${res.status}: ${res.statusText}`, "trade");
    }
  } catch (err: any) {
    log(`Trade API error: ${err.message}`, "trade");
  }
  return null;
}

export async function searchTrade(parsed: ParsedItem, league: string): Promise<TradeSearchResult> {
  const statFilters = buildStatFilters(parsed);
  const tradeQuery = buildTradeQuery(parsed, statFilters);
  const listings: TradeListing[] = [];

  let tradeUrl = buildTradeUrl(parsed, league);

  const directUrl = await tryTradeApiSearch(tradeQuery, league);
  if (directUrl) {
    tradeUrl = directUrl;
  }

  const category = ITEM_CLASS_TRADE_CATEGORIES[parsed.itemClass] || "";

  if (parsed.rarity === "Unique") {
    listings.push({
      id: "hint-unique",
      price: { amount: 0, currency: "unknown" },
      seller: "Trade Site",
      listed: "",
      itemName: parsed.name,
      itemMods: [`Search for "${parsed.name}" on the official trade site`],
    });
  } else {
    const searchTerms: string[] = [];
    if (parsed.baseType) searchTerms.push(`Base: ${parsed.baseType}`);
    if (parsed.itemLevel >= 80) searchTerms.push(`iLvl: ${parsed.itemLevel}+`);

    listings.push({
      id: "hint-search-base",
      price: { amount: 0, currency: "chaos" },
      seller: "Search Tip",
      listed: "",
      itemName: `${parsed.baseType} (${parsed.itemClass})`,
      itemMods: [
        category ? `Trade category: ${category}` : "Search by item type",
        ...searchTerms,
      ],
    });
  }

  return {
    listings,
    total: listings.length,
    tradeUrl,
    statFilters,
    itemCategory: category,
    searchQuery: tradeQuery,
  };
}
