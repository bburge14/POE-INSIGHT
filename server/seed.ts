import { storage } from "./storage";
import { log } from "./index";

const DEFAULT_META_BASES = [
  { name: "Tense Crossbow", category: "Two Hand Weapon", tier: "S", notes: "Best crossbow for phys builds" },
  { name: "Gemini Bow", category: "Two Hand Weapon", tier: "S", notes: "Top-tier bow for elemental builds" },
  { name: "Omen Sceptre", category: "One Hand Weapon", tier: "S", notes: "Best caster one-hand" },
  { name: "Prophecy Wand", category: "Wand", tier: "S", notes: "Top-tier caster wand base" },
  { name: "Tornado Wand", category: "Wand", tier: "S", notes: "High spell damage implicit" },
  { name: "Opal Wand", category: "Wand", tier: "A", notes: "Solid caster wand" },
  { name: "Omen Wand", category: "Wand", tier: "A", notes: "Good caster base with spell implicit" },
  { name: "Expert Vaal Regalia", category: "Body Armour", tier: "S", notes: "Highest ES body armour" },
  { name: "Expert Zodiac Leather", category: "Body Armour", tier: "S", notes: "Highest evasion body armour" },
  { name: "Expert Astral Plate", category: "Body Armour", tier: "A", notes: "High armour + all res implicit" },
  { name: "Expert Hubris Circlet", category: "Helmet", tier: "S", notes: "Best ES helmet" },
  { name: "Expert Lion Pelt", category: "Helmet", tier: "A", notes: "Best evasion helmet" },
  { name: "Expert Sorcerer Gloves", category: "Gloves", tier: "A", notes: "Best ES gloves" },
  { name: "Expert Slink Boots", category: "Boots", tier: "A", notes: "Best evasion boots" },
  { name: "Expert Titan Gauntlets", category: "Gloves", tier: "A", notes: "Best armour gloves" },
  { name: "Vermillion Ring", category: "Ring", tier: "S", notes: "Life implicit - BiS ring base" },
  { name: "Opal Ring", category: "Ring", tier: "S", notes: "Elemental damage implicit" },
  { name: "Onyx Amulet", category: "Amulet", tier: "A", notes: "All attributes implicit" },
  { name: "Marble Amulet", category: "Amulet", tier: "S", notes: "Life regen implicit" },
];

const DEFAULT_BUILD_PROFILES = [
  {
    name: "Lightning Monk",
    classType: "Monk",
    weights: {
      "Maximum Life": 9,
      "Fire Resistance": 6,
      "Cold Resistance": 6,
      "Lightning Resistance": 8,
      "Chaos Resistance": 4,
      "Physical Damage": 3,
      "Attack Speed": 8,
      "Cast Speed": 2,
      "Critical Strike Chance": 7,
      "Critical Strike Multiplier": 7,
      "Spell Damage": 2,
      "Energy Shield": 1,
      "Armour": 4,
      "Evasion Rating": 5,
      "Movement Speed": 7,
      "Mana": 3,
      "Life Regeneration": 4,
      "Elemental Damage": 9,
      "Added Damage": 7,
      "Lightning Damage": 9,
      "Fire Damage": 5,
      "Cold Damage": 5,
      "+Gem Levels": 8,
      "Damage over Time": 3,
      "Increased Damage": 7,
      "Spirit": 4,
      "Mana Regeneration": 2,
    },
    isActive: true,
  },
  {
    name: "Fire Sorceress",
    classType: "Sorceress",
    weights: {
      "Maximum Life": 7,
      "Fire Resistance": 8,
      "Cold Resistance": 5,
      "Lightning Resistance": 5,
      "Chaos Resistance": 3,
      "Physical Damage": 1,
      "Attack Speed": 2,
      "Cast Speed": 9,
      "Critical Strike Chance": 6,
      "Critical Strike Multiplier": 6,
      "Spell Damage": 10,
      "Energy Shield": 8,
      "Armour": 1,
      "Evasion Rating": 2,
      "Movement Speed": 6,
      "Mana": 7,
      "Life Regeneration": 3,
      "Elemental Damage": 10,
      "Added Damage": 8,
      "Fire Damage": 10,
      "Cold Damage": 3,
      "Lightning Damage": 3,
      "+Gem Levels": 10,
      "Damage over Time": 8,
      "Increased Damage": 9,
      "Spirit": 6,
      "Mana Regeneration": 5,
    },
    isActive: false,
  },
];

export async function seedDatabase() {
  try {
    const existingBases = await storage.getMetaBases();
    if (existingBases.length === 0) {
      log("Seeding meta bases...", "seed");
      for (const base of DEFAULT_META_BASES) {
        await storage.createMetaBase(base);
      }
      log(`Seeded ${DEFAULT_META_BASES.length} meta bases.`, "seed");
    }

    const existingProfiles = await storage.getProfiles();
    if (existingProfiles.length === 0) {
      log("Seeding build profiles...", "seed");
      for (const profile of DEFAULT_BUILD_PROFILES) {
        await storage.createProfile(profile);
      }
      log(`Seeded ${DEFAULT_BUILD_PROFILES.length} build profiles.`, "seed");
    }
  } catch (err: any) {
    log(`Seed error: ${err.message}`, "seed");
  }
}
