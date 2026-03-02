import type { ParsedItem, ItemEvaluation, BuildProfile, MetaBase, CraftingStep, TradeAdvice, ItemVerdict, BuildFit } from "@shared/schema";
import { findUniqueByName } from "./ninja";

const MOD_STAT_MAP: Record<string, string[]> = {
  "maximum Life": ["Maximum Life"],
  "to Life": ["Maximum Life"],
  "Fire Resistance": ["Fire Resistance"],
  "Cold Resistance": ["Cold Resistance"],
  "Lightning Resistance": ["Lightning Resistance"],
  "Chaos Resistance": ["Chaos Resistance"],
  "all Elemental Resistances": ["Fire Resistance", "Cold Resistance", "Lightning Resistance"],
  "Physical Damage": ["Physical Damage"],
  "Attack Speed": ["Attack Speed"],
  "Cast Speed": ["Cast Speed"],
  "Critical Strike Chance": ["Critical Strike Chance"],
  "Critical Hit Chance": ["Critical Strike Chance"],
  "Critical Strike Multiplier": ["Critical Strike Multiplier"],
  "Critical Damage": ["Critical Strike Multiplier"],
  "Spell Damage": ["Spell Damage"],
  "Energy Shield": ["Energy Shield"],
  "Armour": ["Armour"],
  "Evasion": ["Evasion Rating"],
  "Movement Speed": ["Movement Speed"],
  "Mana": ["Mana"],
  "Life Regeneration": ["Life Regeneration"],
  "Elemental Damage": ["Elemental Damage"],
  "maximum Energy Shield": ["Energy Shield"],
  "maximum Mana": ["Mana"],
  "Rarity of Items": ["Rarity of Items"],
  "adds": ["Added Damage"],
  "Adds": ["Added Damage"],
  "Fire Damage": ["Fire Damage"],
  "Cold Damage": ["Cold Damage"],
  "Lightning Damage": ["Lightning Damage"],
  "Chaos Damage": ["Chaos Damage"],
  "Level of all": ["+Gem Levels"],
  "Level of": ["+Gem Levels"],
  "to all Spell Skill Gems": ["+Gem Levels"],
  "to all Skill Gems": ["+Gem Levels"],
  "Gem Level": ["+Gem Levels"],
  "Damage over Time": ["Damage over Time"],
  "Damage over Time Multiplier": ["Damage over Time"],
  "Burning Damage": ["Fire Damage", "Damage over Time"],
  "Ignite": ["Fire Damage", "Damage over Time"],
  "Poison": ["Chaos Damage", "Damage over Time"],
  "Bleed": ["Physical Damage", "Damage over Time"],
  "Minion": ["Minion Damage"],
  "Mana Regeneration": ["Mana Regeneration"],
  "Mana Cost": ["Mana Cost Reduction"],
  "Cooldown Recovery": ["Cooldown Recovery"],
  "Area of Effect": ["Area of Effect"],
  "Projectile Speed": ["Projectile Speed"],
  "Accuracy": ["Accuracy"],
  "Block": ["Block Chance"],
  "Stun": ["Stun"],
  "Skill Duration": ["Skill Duration"],
  "increased Damage": ["Increased Damage"],
  "more Damage": ["More Damage"],
  "Spirit": ["Spirit"],
  "Strength": ["Strength"],
  "Dexterity": ["Dexterity"],
  "Intelligence": ["Intelligence"],
  "all Attributes": ["Strength", "Dexterity", "Intelligence"],
};

const MOD_VALUE_THRESHOLDS: Record<string, { low: number; mid: number; high: number }> = {
  "maximum Life": { low: 40, mid: 70, high: 90 },
  "to Life": { low: 40, mid: 70, high: 90 },
  "Fire Resistance": { low: 20, mid: 30, high: 40 },
  "Cold Resistance": { low: 20, mid: 30, high: 40 },
  "Lightning Resistance": { low: 20, mid: 30, high: 40 },
  "Chaos Resistance": { low: 15, mid: 25, high: 35 },
  "all Elemental Resistances": { low: 10, mid: 15, high: 20 },
  "Physical Damage": { low: 40, mid: 80, high: 120 },
  "Attack Speed": { low: 8, mid: 12, high: 16 },
  "Cast Speed": { low: 8, mid: 15, high: 25 },
  "Critical Strike Chance": { low: 15, mid: 25, high: 35 },
  "Critical Hit Chance": { low: 15, mid: 25, high: 35 },
  "Critical Strike Multiplier": { low: 15, mid: 25, high: 35 },
  "Critical Damage": { low: 15, mid: 25, high: 35 },
  "Spell Damage": { low: 30, mid: 60, high: 90 },
  "Energy Shield": { low: 30, mid: 50, high: 80 },
  "Armour": { low: 100, mid: 300, high: 500 },
  "Evasion": { low: 100, mid: 300, high: 500 },
  "Movement Speed": { low: 15, mid: 25, high: 30 },
  "Mana": { low: 30, mid: 50, high: 70 },
  "maximum Energy Shield": { low: 20, mid: 35, high: 50 },
  "maximum Mana": { low: 30, mid: 50, high: 70 },
  "Rarity of Items": { low: 10, mid: 20, high: 30 },
  "Fire Damage": { low: 20, mid: 50, high: 80 },
  "Cold Damage": { low: 20, mid: 50, high: 80 },
  "Lightning Damage": { low: 20, mid: 60, high: 100 },
  "Chaos Damage": { low: 15, mid: 40, high: 70 },
  "adds": { low: 15, mid: 40, high: 70 },
  "Adds": { low: 15, mid: 40, high: 70 },
  "Level of all": { low: 1, mid: 1, high: 2 },
  "Level of": { low: 1, mid: 1, high: 2 },
  "Gem Level": { low: 1, mid: 1, high: 2 },
  "Damage over Time": { low: 15, mid: 25, high: 35 },
  "Burning Damage": { low: 15, mid: 30, high: 50 },
  "Minion": { low: 15, mid: 30, high: 50 },
  "increased Damage": { low: 20, mid: 50, high: 80 },
  "Spirit": { low: 10, mid: 20, high: 30 },
  "Cooldown Recovery": { low: 8, mid: 15, high: 25 },
  "Area of Effect": { low: 8, mid: 15, high: 25 },
  "Accuracy": { low: 100, mid: 250, high: 400 },
  "Skill Duration": { low: 10, mid: 20, high: 30 },
  "Mana Regeneration": { low: 15, mid: 30, high: 50 },
  "Strength": { low: 15, mid: 30, high: 50 },
  "Dexterity": { low: 15, mid: 30, high: 50 },
  "Intelligence": { low: 15, mid: 30, high: 50 },
  "all Attributes": { low: 10, mid: 20, high: 30 },
};

function getModValueQuality(mod: string): number {
  const value = extractModValue(mod);
  if (value === 0) return 0.5;

  const modLower = mod.toLowerCase();
  if (modLower.includes("level of") || modLower.includes("gem level") || modLower.includes("to all") && modLower.includes("skill gems")) {
    return value >= 2 ? 1.0 : 0.9;
  }

  for (const [pattern, thresholds] of Object.entries(MOD_VALUE_THRESHOLDS)) {
    if (modLower.includes(pattern.toLowerCase())) {
      if (value >= thresholds.high) return 1.0;
      if (value >= thresholds.mid) return 0.75;
      if (value >= thresholds.low) return 0.5;
      return 0.25;
    }
  }
  return 0.5;
}

function matchModToStats(mod: string): string[] {
  const matched: string[] = [];
  for (const [pattern, stats] of Object.entries(MOD_STAT_MAP)) {
    if (mod.toLowerCase().includes(pattern.toLowerCase())) {
      matched.push(...stats);
    }
  }
  return matched;
}

function extractModValue(mod: string): number {
  const match = mod.match(/[+-]?(\d+\.?\d*)/);
  return match ? parseFloat(match[1]) : 0;
}

function countResistanceMods(mods: string[]): number {
  return mods.filter(m => /resistance/i.test(m)).length;
}

function hasLifeMod(mods: string[]): boolean {
  return mods.some(m => /maximum life/i.test(m));
}

function getLifeValue(mods: string[]): number {
  const lifeMod = mods.find(m => /maximum life/i.test(m));
  return lifeMod ? extractModValue(lifeMod) : 0;
}

function countOpenModSlots(item: ParsedItem): { prefixes: number; suffixes: number } {
  const maxMods = item.rarity === "Rare" ? 6 : item.rarity === "Magic" ? 2 : 0;
  const currentMods = item.explicitMods.length;
  const openSlots = Math.max(0, maxMods - currentMods);
  const estimatedPrefixes = Math.min(openSlots, Math.ceil(openSlots / 2));
  const estimatedSuffixes = openSlots - estimatedPrefixes;
  return { prefixes: estimatedPrefixes, suffixes: estimatedSuffixes };
}

function isDefensiveItem(item: ParsedItem): boolean {
  return ["Body Armours", "Helmets", "Gloves", "Boots", "Shields"].includes(item.itemClass);
}

function isWeapon(item: ParsedItem): boolean {
  return ["One Hand Weapons", "Two Hand Weapons", "Bows", "Wands", "Sceptres", "Staves", "Daggers", "Claws"].some(
    c => item.itemClass.toLowerCase().includes(c.toLowerCase()) || c.toLowerCase().includes(item.itemClass.toLowerCase())
  );
}

function hasGoodDamageMods(mods: string[]): boolean {
  return mods.some(m => /physical damage|spell damage|elemental damage|fire damage|cold damage|lightning damage|chaos damage|adds \d+/i.test(m));
}

function hasCritMods(mods: string[]): boolean {
  return mods.some(m => /critical strike|critical hit|critical damage/i.test(m));
}

function hasSpeedMods(mods: string[]): boolean {
  return mods.some(m => /attack speed|cast speed/i.test(m));
}

function generateCraftingAdvice(item: ParsedItem, metaBase: MetaBase | undefined, score: number, activeProfile?: BuildProfile | null): CraftingStep[] {
  const steps: CraftingStep[] = [];
  const openSlots = countOpenModSlots(item);
  const hasLife = hasLifeMod(item.explicitMods);
  const lifeVal = getLifeValue(item.explicitMods);
  const resCount = countResistanceMods(item.explicitMods);
  const hasDamage = hasGoodDamageMods(item.explicitMods);
  const hasCrit = hasCritMods(item.explicitMods);
  const hasSpeed = hasSpeedMods(item.explicitMods);

  if (item.corrupted) {
    steps.push({
      step: 1,
      action: "No further crafting possible — item is corrupted",
      reason: "Corrupted items cannot be modified. Evaluate as-is for your build or sell."
    });
    return steps;
  }

  if (item.rarity === "Normal") {
    if (metaBase && item.itemLevel >= 84) {
      steps.push({
        step: 1,
        action: "Use Essences for targeted crafting (recommended) or Alt-spam for specific mods",
        currency: "Essence / Orb of Alteration",
        reason: "This is a top-tier meta base at iLvl 84+, unlocking the highest mod tiers. Essences guarantee one good mod. Alt-spam lets you fish for a specific T1 mod before Regal."
      });
      steps.push({
        step: 2,
        action: "If using Alts: Augment if you hit 1 good mod, then Regal Orb to Rare",
        currency: "Orb of Augmentation → Regal Orb",
        reason: "Alt + Aug + Regal gives you up to 3 targeted mods. This is more controlled than Chaos spam."
      });
      steps.push({
        step: 3,
        action: "Fill remaining slots with Crafting Bench mods or Exalted Orbs",
        currency: "Crafting Bench / Exalted Orb",
        reason: "Bench craft for guaranteed mods (life, res, damage). Exalt only if 3+ existing mods are strong."
      });
    } else if (metaBase && item.itemLevel >= 80) {
      steps.push({
        step: 1,
        action: "Use Orb of Alchemy or Essences to make it Rare",
        currency: "Orb of Alchemy / Essence",
        reason: "Good meta base at iLvl 80+. Alchemy is budget-friendly, Essences give a guaranteed mod."
      });
      steps.push({
        step: 2,
        action: "If mods are bad, Chaos Orb reroll. If 2+ good mods, bench craft the rest",
        currency: "Chaos Orb / Crafting Bench",
        reason: "Don't over-invest. Chaos spam is cheap. Stop when you hit a usable combination."
      });
    } else if (item.itemLevel >= 75) {
      steps.push({
        step: 1,
        action: "Orb of Alchemy — budget craft only",
        currency: "Orb of Alchemy",
        reason: "Decent item level but not top-tier. Alch and use if the mods are okay, don't invest further."
      });
    } else {
      steps.push({
        step: 1,
        action: "Not worth crafting — save your currency",
        reason: "Item level too low for good mod tiers. Vendor or skip."
      });
    }
    return steps;
  }

  if (item.rarity === "Magic") {
    const modCount = item.explicitMods.length;
    const hasGreatMod = item.explicitMods.some(m => getModValueQuality(m) >= 0.75);

    if (hasGreatMod && item.itemLevel >= 75) {
      if (modCount < 2) {
        steps.push({
          step: 1,
          action: "Augment to add a second mod before upgrading",
          currency: "Orb of Augmentation",
          reason: "You have a strong mod — add a second one for free before committing to Regal."
        });
      }
      steps.push({
        step: steps.length + 1,
        action: "Regal Orb to upgrade to Rare",
        currency: "Regal Orb",
        reason: "Strong magic mods are a great foundation. Regal adds a third mod and opens up bench crafting."
      });
      steps.push({
        step: steps.length + 1,
        action: "If Regal hits well, bench craft remaining slots. If bad, Annul the bad mod (risky)",
        currency: "Crafting Bench / Orb of Annulment",
        reason: "Bench craft is safe. Annulment is a gamble — only if the Regal mod is terrible and other mods are great."
      });
    } else if (metaBase && item.itemLevel >= 80) {
      steps.push({
        step: 1,
        action: "Regal Orb to Rare, then evaluate",
        currency: "Regal Orb",
        reason: "Meta base is worth upgrading. Check what the Regal adds before investing more."
      });
    } else {
      steps.push({
        step: 1,
        action: "Consider Alt-spamming for better mods first",
        currency: "Orb of Alteration",
        reason: "Current mods aren't strong enough to justify Regal. Reroll with Alts until you hit something good."
      });
    }
    return steps;
  }

  if (item.rarity === "Rare") {
    const totalOpen = openSlots.prefixes + openSlots.suffixes;

    // Excellent item — fine-tune or sell
    if (score >= 70) {
      if (totalOpen > 0) {
        // Recommend specific bench crafts based on what's missing
        if (!hasLife && isDefensiveItem(item) && openSlots.prefixes > 0) {
          steps.push({
            step: steps.length + 1,
            action: "Bench craft Maximum Life (prefix)",
            currency: "Crafting Bench",
            reason: "Strong item missing life. Bench crafting life is the safest way to round it out."
          });
        } else if (!hasDamage && isWeapon(item) && openSlots.prefixes > 0) {
          steps.push({
            step: steps.length + 1,
            action: "Bench craft flat damage or %increased damage (prefix)",
            currency: "Crafting Bench",
            reason: "Weapon with open prefix — add damage to maximize DPS."
          });
        }
        if (resCount < 2 && isDefensiveItem(item) && openSlots.suffixes > 0) {
          steps.push({
            step: steps.length + 1,
            action: "Bench craft your weakest resistance (suffix)",
            currency: "Crafting Bench",
            reason: "Fill the open suffix with whichever resistance you need to cap."
          });
        } else if (!hasSpeed && isWeapon(item) && openSlots.suffixes > 0) {
          steps.push({
            step: steps.length + 1,
            action: "Bench craft Attack/Cast Speed (suffix)",
            currency: "Crafting Bench",
            reason: "Speed is a huge DPS multiplier on weapons."
          });
        } else if (!hasCrit && openSlots.suffixes > 0) {
          steps.push({
            step: steps.length + 1,
            action: "Bench craft Critical Strike Chance (suffix)",
            currency: "Crafting Bench",
            reason: "Crit scales well with existing damage mods."
          });
        }
        if (totalOpen >= 2 && score >= 75) {
          steps.push({
            step: steps.length + 1,
            action: "Consider Exalted Orb slam on remaining open slot",
            currency: "Exalted Orb",
            reason: "Existing mods are strong enough to justify the gamble. Use Omens to bias prefix/suffix if available."
          });
        }
      }

      // Check if Divine Orb could help
      const hasLowRolls = item.explicitMods.some(m => getModValueQuality(m) <= 0.5);
      if (hasLowRolls && item.explicitMods.length >= 4) {
        steps.push({
          step: steps.length + 1,
          action: "Consider Divine Orb to reroll mod values higher",
          currency: "Divine Orb",
          reason: "The mod types are good but some values rolled low. Divine Orbs reroll the numbers without changing mod types."
        });
      }

      if (steps.length === 0) {
        steps.push({
          step: 1,
          action: "Item is already in great shape — use as-is or sell",
          reason: "Strong mods with no easy improvements. Sell at market value or use for your build."
        });
      }
    }
    // Mid-tier item — craft to improve
    else if (score >= 40 && totalOpen > 0) {
      if (!hasLife && isDefensiveItem(item) && openSlots.prefixes > 0) {
        steps.push({
          step: steps.length + 1,
          action: "Bench craft Maximum Life (prefix)",
          currency: "Crafting Bench",
          reason: "Life is essential on armor. Guaranteed life roll from bench is the best bang for your buck."
        });
      }
      if (resCount < 2 && isDefensiveItem(item) && openSlots.suffixes > 0) {
        steps.push({
          step: steps.length + 1,
          action: "Bench craft a resistance (suffix)",
          currency: "Crafting Bench",
          reason: "Capping resistances is top priority for survivability."
        });
      }
      if (!hasDamage && isWeapon(item) && openSlots.prefixes > 0) {
        steps.push({
          step: steps.length + 1,
          action: "Bench craft damage (prefix)",
          currency: "Crafting Bench",
          reason: "Open prefix on a weapon — add damage to make it usable."
        });
      }
      if (steps.length === 0 && totalOpen > 0) {
        steps.push({
          step: steps.length + 1,
          action: "Bench craft a useful mod for your build",
          currency: "Crafting Bench",
          reason: "Open slots available. Check bench recipes and add whatever stat your build needs most."
        });
      }
    }
    // Bad rare on good base — reroll
    else if (score < 30 && (metaBase || item.itemLevel >= 80)) {
      steps.push({
        step: 1,
        action: "Chaos Orb spam to reroll all mods",
        currency: "Chaos Orb",
        reason: "Good base with bad mods. Chaos rerolling is cheap — look for Life + Res or damage combos."
      });
      steps.push({
        step: 2,
        action: "Stop rerolling when you hit 3+ useful mods, then bench craft the rest",
        currency: "Crafting Bench",
        reason: "Don't chase perfection with Chaos. Get a decent foundation and finish with guaranteed bench mods."
      });
    }
    // Bad item — vendor
    else if (score < 30) {
      steps.push({
        step: 1,
        action: "Vendor — not worth the currency investment",
        reason: "Low score with no redeeming qualities. Vendor for shards and move on."
      });
    }
    // Mid item, fully modded
    else if (steps.length === 0 && score >= 40) {
      steps.push({
        step: 1,
        action: "Use as-is or sell — limited crafting upside",
        reason: "Mods are decent but fully modded. Further investment would require Annulment gambles."
      });
    }
    else if (steps.length === 0) {
      steps.push({
        step: 1,
        action: "Vendor or use as a temporary upgrade",
        reason: "Not worth investing currency. Replace when you find something better."
      });
    }
  }

  return steps;
}

interface BuildArchetype {
  name: string;
  keywords: string[];
  modPatterns: string[];
  ninjaSlug: string;
}

const BUILD_ARCHETYPES: BuildArchetype[] = [
  {
    name: "Lightning Spell Caster",
    keywords: ["lightning", "spell", "cast"],
    modPatterns: ["lightning damage", "spell damage", "cast speed", "lightning resistance", "intelligence", "energy shield", "critical strike", "mana"],
    ninjaSlug: "skill=Storm%20Call,Lightning%20Bolt,Arc,Spark,Tempest%20Flurry",
  },
  {
    name: "Fire Spell Caster",
    keywords: ["fire", "spell", "burn", "ignite"],
    modPatterns: ["fire damage", "spell damage", "cast speed", "burning damage", "ignite", "intelligence", "energy shield"],
    ninjaSlug: "skill=Fireball,Flame%20Wall,Controlled%20Blaze,Incinerate",
  },
  {
    name: "Cold Spell Caster",
    keywords: ["cold", "freeze", "chill", "ice"],
    modPatterns: ["cold damage", "spell damage", "cast speed", "freeze", "chill", "intelligence", "energy shield"],
    ninjaSlug: "skill=Ice%20Nova,Frozen%20Orb,Winter%20Orb,Cold%20Snap",
  },
  {
    name: "Physical Melee",
    keywords: ["physical", "melee", "attack"],
    modPatterns: ["physical damage", "attack speed", "accuracy", "strength", "armour", "life", "critical strike"],
    ninjaSlug: "skill=Heavy%20Strike,Ground%20Slam,Cleave,Sunder",
  },
  {
    name: "Bow / Ranged Attack",
    keywords: ["bow", "projectile", "ranged"],
    modPatterns: ["physical damage", "attack speed", "dexterity", "evasion", "projectile", "accuracy", "critical strike"],
    ninjaSlug: "skill=Lightning%20Arrow,Rain%20of%20Arrows,Tornado%20Shot",
  },
  {
    name: "Fire DoT / Ignite",
    keywords: ["dot", "ignite", "burn"],
    modPatterns: ["fire damage", "damage over time", "burning damage", "ignite", "spell damage"],
    ninjaSlug: "skill=Controlled%20Blaze,Flame%20Wall",
  },
  {
    name: "Chaos / Poison",
    keywords: ["chaos", "poison", "dot"],
    modPatterns: ["chaos damage", "poison", "damage over time", "dexterity"],
    ninjaSlug: "skill=Viper%20Strike,Poison",
  },
  {
    name: "Minion / Summoner",
    keywords: ["minion", "summon"],
    modPatterns: ["minion", "spirit", "intelligence"],
    ninjaSlug: "skill=Summon",
  },
  {
    name: "Tank / Defensive",
    keywords: ["tank", "defense"],
    modPatterns: ["armour", "life", "block", "resistance", "life regeneration", "energy shield", "strength"],
    ninjaSlug: "class=Warrior,Marauder",
  },
  {
    name: "Elemental Damage Caster",
    keywords: ["elemental", "spell"],
    modPatterns: ["elemental damage", "spell damage", "cast speed", "all elemental resistance", "critical strike", "mana"],
    ninjaSlug: "skill=Elemental",
  },
];

function analyzeBuildFits(item: ParsedItem): BuildFit[] {
  const allMods = [...item.implicitMods, ...item.explicitMods];
  const allModsLower = allMods.map(m => m.toLowerCase()).join(" ");

  const fits: { archetype: BuildArchetype; matchCount: number; matchedMods: string[] }[] = [];

  for (const arch of BUILD_ARCHETYPES) {
    let matchCount = 0;
    const matchedMods: string[] = [];

    for (const mod of allMods) {
      const modLower = mod.toLowerCase();
      for (const pattern of arch.modPatterns) {
        if (modLower.includes(pattern)) {
          matchCount++;
          if (!matchedMods.includes(mod)) {
            matchedMods.push(mod);
          }
          break;
        }
      }
    }

    if (matchCount >= 2) {
      fits.push({ archetype: arch, matchCount, matchedMods });
    }
  }

  fits.sort((a, b) => b.matchCount - a.matchCount);

  return fits.slice(0, 3).map((fit, i) => {
    const confidence: BuildFit["confidence"] =
      fit.matchCount >= 4 ? "high" :
      fit.matchCount >= 3 ? "medium" : "low";

    return {
      archetype: fit.archetype.name,
      confidence,
      relevantMods: fit.matchedMods,
      ninjaUrl: `https://poe.ninja/poe2/builds/vaal?${fit.archetype.ninjaSlug}`,
    };
  });
}

function generateTradeAdvice(item: ParsedItem, score: number, priceEstimate?: { chaosValue: number; divineValue: number }, activeProfile?: BuildProfile | null): TradeAdvice {
  if (item.rarity === "Unique") {
    if (priceEstimate) {
      if (priceEstimate.divineValue >= 1) {
        return {
          action: "list_for_sale",
          estimatedValue: `${priceEstimate.divineValue.toFixed(1)} Divine (${priceEstimate.chaosValue.toFixed(0)}c)`,
          reasoning: "This unique is worth a significant amount. List it on the trade site unless your build needs it."
        };
      }
      if (priceEstimate.chaosValue >= 10) {
        return {
          action: "list_for_sale",
          estimatedValue: `${priceEstimate.chaosValue.toFixed(0)} Chaos`,
          reasoning: "Worth listing for sale. Price it slightly under market to sell quickly."
        };
      }
      if (priceEstimate.chaosValue >= 1) {
        return {
          action: "price_check",
          estimatedValue: `~${priceEstimate.chaosValue.toFixed(0)} Chaos`,
          reasoning: "Low-value unique. Only worth selling if you have the stash space, otherwise vendor for Orb of Chance."
        };
      }
      return {
        action: "vendor",
        reasoning: "This unique is worth less than 1 chaos. Vendor it for Orb of Chance materials."
      };
    }
    return {
      action: "price_check",
      reasoning: "Could not fetch price data. Check poe.ninja or the trade site manually before deciding."
    };
  }

  if (item.rarity === "Normal") {
    if (score >= 40) {
      return {
        action: "dont_sell",
        reasoning: "Good crafting base — use it yourself or craft on it before selling."
      };
    }
    return {
      action: "vendor",
      reasoning: "Not a valuable base. Vendor for currency shards."
    };
  }

  if (score >= 75) {
    const weights = activeProfile?.weights as Record<string, number> | undefined;
    const buildRelevant = weights ? item.explicitMods.some(mod => {
      const stats = matchModToStats(mod);
      return stats.some(s => (weights[s] || 0) >= 7);
    }) : false;

    if (buildRelevant) {
      return {
        action: "dont_sell",
        reasoning: "This item has high-value mods that match your active build. Keep it as an upgrade or use it."
      };
    }
    return {
      action: "list_for_sale",
      reasoning: "Strong rare item with desirable mods. Search the trade site with similar stat filters to find the right price — rare item pricing depends heavily on exact mod rolls and league economy."
    };
  }

  if (score >= 50) {
    const hasGoodLife = getLifeValue(item.explicitMods) >= 70;
    const hasMultiRes = countResistanceMods(item.explicitMods) >= 2;

    if (hasGoodLife && hasMultiRes) {
      return {
        action: "list_for_sale",
        reasoning: "Life + multiple resistances is always in demand. Search trade site with the stat filters below to see what similar items are selling for."
      };
    }
    return {
      action: "price_check",
      reasoning: "Decent item but pricing depends on demand. Use the stat filters to search the trade site for comparable items."
    };
  }

  if (score >= 30) {
    return {
      action: "vendor",
      reasoning: "Below average item. Not worth the listing effort — vendor for Alteration Shards."
    };
  }

  return {
    action: "vendor",
    reasoning: "Low-quality item. Vendor immediately for currency shards."
  };
}

function determineVerdict(item: ParsedItem, score: number, isCraftWorthy: boolean, isMetaBase: boolean, tradeAdvice: TradeAdvice): { verdict: ItemVerdict; summary: string } {
  if (item.rarity === "Unique") {
    if (tradeAdvice.action === "list_for_sale") {
      return { verdict: "sell", summary: `Sell this unique — ${tradeAdvice.estimatedValue || "check price"}` };
    }
    if (tradeAdvice.action === "vendor") {
      return { verdict: "vendor", summary: "Vendor this — not worth selling on trade" };
    }
    return { verdict: "price_check", summary: "Price check this unique before deciding" };
  }

  if (item.rarity === "Normal") {
    if (isCraftWorthy) {
      return { verdict: "craft", summary: `Craft on this ${isMetaBase ? "meta " : ""}base — Alch it and go` };
    }
    return { verdict: "vendor", summary: "Vendor — not a valuable base for crafting" };
  }

  if (isCraftWorthy && score >= 40 && score < 70) {
    const openSlots = countOpenModSlots(item);
    if (openSlots.prefixes + openSlots.suffixes > 0) {
      return { verdict: "craft", summary: "Craft on this — good mods with open slots to fill" };
    }
  }

  if (score >= 70) {
    if (tradeAdvice.action === "dont_sell") {
      return { verdict: "keep", summary: "Keep this — strong item for your build" };
    }
    return { verdict: "sell", summary: "Sell this — search trade site with stat filters for pricing" };
  }

  if (score >= 50) {
    if (tradeAdvice.action === "list_for_sale") {
      return { verdict: "sell", summary: "Worth selling — check trade site for current prices" };
    }
    return { verdict: "price_check", summary: "Might be worth something — search trade site to compare" };
  }

  return { verdict: "vendor", summary: "Vendor this — not worth keeping or selling" };
}

export async function evaluateItem(
  item: ParsedItem,
  metaBases: MetaBase[],
  activeProfile?: BuildProfile | null,
  league: string = "Standard"
): Promise<ItemEvaluation> {
  const reasons: string[] = [];
  let score = 0;

  const isHighIlvl = item.itemLevel >= 80;
  const isVeryHighIlvl = item.itemLevel >= 84;

  const metaBase = metaBases.find(
    (b) => b.name.toLowerCase() === item.baseType.toLowerCase()
  );
  const isMetaBase = !!metaBase;
  const isWhiteBase = item.rarity === "Normal";
  const isGoodBase = isWhiteBase && isHighIlvl;
  let isCraftWorthy = false;

  if (isGoodBase) {
    score += 20;
    reasons.push(`High item level base (iLvl ${item.itemLevel}) — good foundation for crafting.`);
  }

  if (isVeryHighIlvl) {
    score += 10;
    reasons.push("Item level 84+ unlocks the highest-tier modifier rolls.");
  }

  if (isMetaBase) {
    score += 25;
    reasons.push(`"${item.baseType}" is a ${metaBase.tier}-tier meta base — highly sought after.`);
    if (isWhiteBase && isHighIlvl) {
      isCraftWorthy = true;
    }
  }

  if (item.rarity === "Normal" && !isHighIlvl) {
    reasons.push("Low item level white base — vendor or skip.");
  }

  if (item.rarity === "Rare" && item.itemLevel < 60) {
    score -= 15;
    reasons.push(`Low item level (${item.itemLevel}) — mod tiers are severely limited. Unlikely to have trade value.`);
  } else if (item.rarity === "Rare" && item.itemLevel < 75) {
    score -= 5;
    reasons.push(`Mid-range item level (${item.itemLevel}) — decent but not top-tier mod rolls.`);
  }

  const weights = activeProfile?.weights as Record<string, number> | undefined;
  const modScores: { mod: string; score: number; weight: number }[] = [];
  let buildRelevantModCount = 0;

  const allMods = [...item.implicitMods, ...item.explicitMods];
  for (const mod of allMods) {
    const matchedStats = matchModToStats(mod);
    let modScore = 0;
    let maxWeight = 0;
    const valueQuality = getModValueQuality(mod);

    if (weights) {
      for (const stat of matchedStats) {
        const w = weights[stat] || 0;
        modScore += w * 10 * valueQuality;
        maxWeight = Math.max(maxWeight, w);
      }
      if (maxWeight >= 5 && valueQuality >= 0.5) buildRelevantModCount++;
    } else {
      if (mod.toLowerCase().includes("life")) modScore = 40 * valueQuality;
      else if (mod.toLowerCase().includes("resistance")) modScore = 30 * valueQuality;
      else if (mod.toLowerCase().includes("damage")) modScore = 35 * valueQuality;
      else modScore = 20 * valueQuality;
      maxWeight = modScore / 10;
    }

    modScores.push({ mod, score: Math.min(Math.round(modScore), 100), weight: maxWeight });
    score += modScore / allMods.length;
  }

  if (item.explicitMods.length >= 4) {
    score += 5;
    reasons.push(`${item.explicitMods.length} explicit modifiers — well-rolled.`);
  }

  if (activeProfile && buildRelevantModCount >= 3) {
    score += 10;
    reasons.push(`${buildRelevantModCount} mods are highly relevant to your ${activeProfile.name} build.`);
  }

  let priceEstimate: ItemEvaluation["priceEstimate"] | undefined;

  if (item.rarity === "Unique") {
    try {
      const unique = await findUniqueByName(item.name, league);
      if (unique) {
        priceEstimate = {
          chaosValue: unique.chaosValue,
          divineValue: unique.divineValue || 0,
          source: "poe.ninja",
        };
        score += Math.min(unique.chaosValue / 10, 30);
        reasons.push(`Market price: ${unique.chaosValue.toFixed(1)} chaos on poe.ninja.`);
      }
    } catch {
      reasons.push("Could not fetch unique price from poe.ninja.");
    }
  }

  if (item.rarity !== "Unique" && item.itemLevel > 0 && item.itemLevel < 50) {
    score = Math.min(score, 30);
  }

  score = Math.max(0, Math.min(Math.round(score), 100));

  if (score >= 60) isCraftWorthy = true;

  const craftingAdvice = generateCraftingAdvice(item, metaBase, score, activeProfile);
  const tradeAdvice = generateTradeAdvice(item, score, priceEstimate, activeProfile);
  const buildFits = analyzeBuildFits(item);
  const { verdict, summary } = determineVerdict(item, score, isCraftWorthy, isMetaBase, tradeAdvice);

  if (buildFits.length > 0) {
    const topFit = buildFits[0];
    reasons.push(`Best fit: ${topFit.archetype} build (${topFit.confidence} confidence) — ${topFit.relevantMods.length} matching mods.`);
  }

  return {
    verdict,
    verdictSummary: summary,
    isGoodBase,
    isMetaBase,
    isCraftWorthy,
    score,
    reasons,
    craftingAdvice: craftingAdvice.length > 0 ? craftingAdvice : undefined,
    tradeAdvice,
    buildFits: buildFits.length > 0 ? buildFits : undefined,
    priceEstimate,
    modScores: modScores.length > 0 ? modScores.sort((a, b) => b.score - a.score) : undefined,
  };
}
