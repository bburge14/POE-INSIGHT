import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, jsonb, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const buildProfiles = pgTable("build_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  classType: text("class_type").notNull(),
  weights: jsonb("weights").notNull().$type<Record<string, number>>(),
  isActive: boolean("is_active").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const savedItems = pgTable("saved_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  rawText: text("raw_text").notNull(),
  parsedData: jsonb("parsed_data").notNull().$type<ParsedItem>(),
  evaluation: jsonb("evaluation").$type<ItemEvaluation>(),
  notes: text("notes"),
  savedAt: timestamp("saved_at").defaultNow(),
});

export const metaBases = pgTable("meta_bases", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  category: text("category").notNull(),
  tier: text("tier").notNull(),
  notes: text("notes"),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertBuildProfileSchema = createInsertSchema(buildProfiles).omit({
  id: true,
  createdAt: true,
});

export const insertSavedItemSchema = createInsertSchema(savedItems).omit({
  id: true,
  savedAt: true,
});

export const insertMetaBaseSchema = createInsertSchema(metaBases).omit({
  id: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type BuildProfile = typeof buildProfiles.$inferSelect;
export type InsertBuildProfile = z.infer<typeof insertBuildProfileSchema>;
export type SavedItem = typeof savedItems.$inferSelect;
export type InsertSavedItem = z.infer<typeof insertSavedItemSchema>;
export type MetaBase = typeof metaBases.$inferSelect;
export type InsertMetaBase = z.infer<typeof insertMetaBaseSchema>;

export interface ParsedItem {
  itemClass: string;
  rarity: "Normal" | "Magic" | "Rare" | "Unique";
  name: string;
  baseType: string;
  itemLevel: number;
  requirements: {
    level?: number;
    str?: number;
    dex?: number;
    int?: number;
  };
  implicitMods: string[];
  explicitMods: string[];
  defenses?: {
    armour?: number;
    evasion?: number;
    energyShield?: number;
  };
  sockets?: string;
  corrupted?: boolean;
  unidentified?: boolean;
}

export type ItemVerdict = "sell" | "craft" | "keep" | "vendor" | "price_check";

export interface CraftingStep {
  step: number;
  action: string;
  currency?: string;
  reason: string;
}

export interface TradeAdvice {
  action: "list_for_sale" | "price_check" | "dont_sell" | "vendor";
  estimatedValue?: string;
  reasoning: string;
}

export interface BuildFit {
  archetype: string;
  confidence: "high" | "medium" | "low";
  relevantMods: string[];
  ninjaUrl?: string;
}

export interface ItemEvaluation {
  verdict: ItemVerdict;
  verdictSummary: string;
  isGoodBase: boolean;
  isMetaBase: boolean;
  isCraftWorthy: boolean;
  score: number;
  reasons: string[];
  craftingAdvice?: CraftingStep[];
  tradeAdvice?: TradeAdvice;
  buildFits?: BuildFit[];
  priceEstimate?: {
    chaosValue: number;
    divineValue: number;
    source: string;
  };
  modScores?: { mod: string; score: number; weight: number }[];
  aiAnalysis?: AIItemAnalysis;
}

export interface AIItemAnalysis {
  verdict: string;
  reasoning: string;
  synergies: string[];
  warnings: string[];
  craftingTips: string[];
  estimatedTier: "S" | "A" | "B" | "C" | "D" | "F";
  keepForBuilds: string[];
}

export interface NinjaCurrency {
  id: string;
  name: string;
  icon?: string;
  chaosValue: number;
  volume?: number;
}

export interface NinjaUniqueItem {
  id: number;
  name: string;
  baseType: string;
  icon: string;
  chaosValue: number;
  divineValue?: number;
  listingCount: number;
}

export interface TradeStatFilter {
  modText: string;
  statName: string;
  value: number;
  min: number;
  max: number;
  tierLabel?: string;
}

export interface TradeListing {
  id: string;
  price: {
    amount: number;
    currency: string;
  };
  seller: string;
  listed: string;
  itemName?: string;
  itemMods?: string[];
  whisper?: string;
}

export interface TradeSearchResult {
  listings: TradeListing[];
  total: number;
  tradeUrl: string;
  statFilters: TradeStatFilter[];
  itemCategory?: string;
  searchQuery?: any;
}
