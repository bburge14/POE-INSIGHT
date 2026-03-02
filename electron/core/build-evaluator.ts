import {
  CharacterBuild,
  BuildProfile,
  BuildRequirement,
  StatWeight,
  StatId,
  ItemSlot,
  PoE2Item,
  EquippedItem,
  DealEvaluation,
  StatContribution,
} from '../models/types';

/**
 * BuildEvaluator: The brain of Exile-Insight.
 *
 * Takes a parsed CharacterBuild and produces a BuildProfile with stat weights.
 * Then evaluates items against that profile to determine if they're upgrades.
 *
 * KEY DESIGN PRINCIPLE — "Stat Weights as Vectors":
 * When a character NEEDS 50 Strength to equip their gear, the value of Strength
 * is effectively infinite until they hit 50, then drops to near-zero.
 * This prevents recommending stats the build doesn't need.
 *
 * PoE2 NOTE: Sockets are on gems, not gear. This evaluator ignores socket counts
 * on gear entirely and focuses on stat values, mod rolls, and build synergies.
 */
export class BuildEvaluator {
  private profile: BuildProfile | null = null;

  /**
   * Build a complete profile from a parsed character build.
   * This generates stat weight vectors and identifies priority upgrade slots.
   */
  createProfile(build: CharacterBuild): BuildProfile {
    const statWeights = this.calculateStatWeights(build);
    const prioritySlots = this.identifyPrioritySlots(build);

    this.profile = {
      build,
      statWeights,
      prioritySlots,
    };

    return this.profile;
  }

  getProfile(): BuildProfile | null {
    return this.profile;
  }

  /**
   * Calculate stat weight vectors for every relevant stat.
   *
   * The weight of each stat depends on:
   * 1. Whether it's a hard requirement (resistance cap, attribute minimum)
   * 2. How much of it the build already has vs. needs
   * 3. How much it contributes to DPS or EHP
   */
  calculateStatWeights(build: CharacterBuild): StatWeight[] {
    const weights: StatWeight[] = [];

    // --- Attribute Requirements (infinite weight until met) ---
    weights.push(
      this.createRequirementWeight('flat_str', build.stats.str, this.getAttributeRequirement(build, 'str')),
      this.createRequirementWeight('flat_dex', build.stats.dex, this.getAttributeRequirement(build, 'dex')),
      this.createRequirementWeight('flat_int', build.stats.int, this.getAttributeRequirement(build, 'int')),
    );

    // --- Resistance Caps (infinite weight until 75%) ---
    const RES_CAP = 75;
    weights.push(
      this.createResistanceWeight('percent_fire_res', build.stats.fireRes, RES_CAP),
      this.createResistanceWeight('percent_cold_res', build.stats.coldRes, RES_CAP),
      this.createResistanceWeight('percent_lightning_res', build.stats.lightningRes, RES_CAP),
      this.createResistanceWeight('percent_chaos_res', build.stats.chaosRes, 0),
    );

    // --- Defensive Stats ---
    weights.push(
      {
        statId: 'flat_life',
        baseWeight: this.calculateDefensiveWeight(build, 'life'),
        required: false,
        requiredAmount: 0,
        currentAmount: build.stats.life,
      },
      {
        statId: 'percent_life',
        baseWeight: this.calculateDefensiveWeight(build, 'life') * 0.8,
        required: false,
        requiredAmount: 0,
        currentAmount: build.stats.life,
      },
      {
        statId: 'flat_es',
        baseWeight: this.calculateDefensiveWeight(build, 'es'),
        required: false,
        requiredAmount: 0,
        currentAmount: build.stats.energyShield,
      },
      {
        statId: 'flat_armour',
        baseWeight: this.calculateDefensiveWeight(build, 'armour'),
        required: false,
        requiredAmount: 0,
        currentAmount: build.stats.armour,
      },
      {
        statId: 'flat_evasion',
        baseWeight: this.calculateDefensiveWeight(build, 'evasion'),
        required: false,
        requiredAmount: 0,
        currentAmount: build.stats.evasion,
      },
    );

    // --- Offensive Stats ---
    weights.push(
      {
        statId: 'added_phys_min',
        baseWeight: this.calculateOffensiveWeight(build, 'flat_phys'),
        required: false,
        requiredAmount: 0,
        currentAmount: 0,
      },
      {
        statId: 'added_phys_max',
        baseWeight: this.calculateOffensiveWeight(build, 'flat_phys'),
        required: false,
        requiredAmount: 0,
        currentAmount: 0,
      },
      {
        statId: 'percent_phys',
        baseWeight: this.calculateOffensiveWeight(build, 'percent_phys'),
        required: false,
        requiredAmount: 0,
        currentAmount: 0,
      },
      {
        statId: 'percent_attack_speed',
        baseWeight: this.calculateOffensiveWeight(build, 'attack_speed'),
        required: false,
        requiredAmount: 0,
        currentAmount: build.stats.attackSpeed,
      },
      {
        statId: 'percent_crit_chance',
        baseWeight: this.calculateOffensiveWeight(build, 'crit_chance'),
        required: false,
        requiredAmount: 0,
        currentAmount: build.stats.critChance,
      },
      {
        statId: 'percent_crit_multi',
        baseWeight: this.calculateOffensiveWeight(build, 'crit_multi'),
        required: false,
        requiredAmount: 0,
        currentAmount: build.stats.critMultiplier,
      },
    );

    return weights;
  }

  /**
   * Evaluate an item against the current build profile.
   * Returns a DealEvaluation with DPS/EHP changes and stat contributions.
   */
  evaluateItem(item: PoE2Item, targetSlot?: ItemSlot): DealEvaluation | null {
    if (!this.profile) {
      throw new Error('BuildEvaluator: No profile loaded. Call createProfile() first.');
    }

    const slot = targetSlot || item.slot || this.inferSlot(item);
    if (!slot) return null;

    // Get the currently equipped item in this slot
    const currentEquipped = this.profile.build.equipped.find(e => e.slot === slot);
    const currentStats = currentEquipped?.statContributions || {};

    // Extract stats from the candidate item
    const candidateStats = this.extractItemStats(item);

    // Calculate the delta for each stat
    const statContributions: Record<StatId, StatContribution> = {};
    let totalWeightedValue = 0;

    for (const weight of this.profile.statWeights) {
      const currentValue = currentStats[weight.statId] || 0;
      const candidateValue = candidateStats[weight.statId] || 0;
      const delta = candidateValue - currentValue;

      if (delta === 0) continue;

      const effectiveWeight = this.getEffectiveWeight(weight, delta);
      const weightedValue = delta * effectiveWeight;

      statContributions[weight.statId] = {
        value: delta,
        weight: effectiveWeight,
        weightedValue,
      };

      totalWeightedValue += weightedValue;
    }

    // Estimate DPS and EHP changes
    const dpsChange = this.estimateDpsChange(statContributions, this.profile.build);
    const ehpChange = this.estimateEhpChange(statContributions, this.profile.build);

    // Check unmet requirements
    const unmetRequirements = this.checkRequirements(item, this.profile.build);

    return {
      dpsChange,
      ehpChange,
      statContributions,
      meetsRequirements: unmetRequirements.length === 0,
      unmetRequirements,
      isUpgrade: dpsChange.percentage > 0 || ehpChange.percentage > 0,
    };
  }

  /**
   * Create a stat weight for a hard requirement (attribute or resistance).
   * The weight is near-infinite when below the requirement, near-zero when above.
   */
  private createRequirementWeight(
    statId: StatId,
    currentAmount: number,
    requiredAmount: number
  ): StatWeight {
    const deficit = requiredAmount - currentAmount;
    // When there's a deficit, the weight is extremely high (1000)
    // When met, the weight drops to near-zero (0.1) — not zero because
    // extra attributes can still have small value via conversion or thresholds
    const baseWeight = deficit > 0 ? 1000 : 0.1;

    return {
      statId,
      baseWeight,
      required: requiredAmount > 0,
      requiredAmount,
      currentAmount,
    };
  }

  private createResistanceWeight(
    statId: StatId,
    currentRes: number,
    cap: number
  ): StatWeight {
    const deficit = cap - currentRes;
    // Uncapped resistance is catastrophic. Weight scales with how far from cap.
    const baseWeight = deficit > 0
      ? 500 + (deficit * 10) // Bigger deficit = even higher urgency
      : 0.05;               // Over-cap res is nearly worthless

    return {
      statId,
      baseWeight,
      required: deficit > 0,
      requiredAmount: cap,
      currentAmount: currentRes,
    };
  }

  /**
   * Get the effective weight for a stat, accounting for diminishing returns
   * and requirement thresholds.
   */
  private getEffectiveWeight(weight: StatWeight, delta: number): number {
    if (!weight.required) {
      return weight.baseWeight;
    }

    const deficit = weight.requiredAmount - weight.currentAmount;

    if (deficit <= 0) {
      // Requirement already met — stat has minimal value
      return 0.1;
    }

    if (delta <= deficit) {
      // This item helps close the gap but doesn't fully meet the requirement
      return weight.baseWeight;
    }

    // This item overshoots the requirement — split the value
    // The portion that closes the deficit is worth full weight
    // The overflow portion is worth minimal weight
    const valuablePortion = deficit / delta;
    return weight.baseWeight * valuablePortion + 0.1 * (1 - valuablePortion);
  }

  /**
   * Extract stat contributions from an item's mods.
   */
  private extractItemStats(item: PoE2Item): Record<StatId, number> {
    const stats: Record<StatId, number> = {};

    const allMods = [
      ...item.mods.implicit,
      ...item.mods.explicit,
      ...item.mods.enchant,
    ];

    for (const mod of allMods) {
      for (const stat of mod.stats) {
        stats[stat.id] = (stats[stat.id] || 0) + stat.value;
      }
    }

    // Handle "all elemental resistances" by splitting into individual resists
    if (stats['percent_all_ele_res']) {
      const allRes = stats['percent_all_ele_res'];
      stats['percent_fire_res'] = (stats['percent_fire_res'] || 0) + allRes;
      stats['percent_cold_res'] = (stats['percent_cold_res'] || 0) + allRes;
      stats['percent_lightning_res'] = (stats['percent_lightning_res'] || 0) + allRes;
      delete stats['percent_all_ele_res'];
    }

    // Handle "all attributes"
    if (stats['flat_all_attr']) {
      const allAttr = stats['flat_all_attr'];
      stats['flat_str'] = (stats['flat_str'] || 0) + allAttr;
      stats['flat_dex'] = (stats['flat_dex'] || 0) + allAttr;
      stats['flat_int'] = (stats['flat_int'] || 0) + allAttr;
      delete stats['flat_all_attr'];
    }

    return stats;
  }

  /**
   * Estimate the DPS change from stat contributions.
   * Uses a simplified model — the real calculation would need full PoB simulation.
   */
  private estimateDpsChange(
    contributions: Record<StatId, StatContribution>,
    build: CharacterBuild
  ): { absolute: number; percentage: number } {
    const currentDps = build.stats.totalDps || 1;
    let dpsMultiplier = 1;

    // Physical damage
    const flatPhysMin = contributions['added_phys_min']?.value || 0;
    const flatPhysMax = contributions['added_phys_max']?.value || 0;
    const avgFlatPhys = (flatPhysMin + flatPhysMax) / 2;
    if (avgFlatPhys !== 0) {
      // Rough estimate: flat phys increases base damage linearly
      dpsMultiplier += avgFlatPhys * build.stats.attackSpeed * 0.01;
    }

    // Percent physical damage
    const percentPhys = contributions['percent_phys']?.value || 0;
    if (percentPhys !== 0) {
      dpsMultiplier *= 1 + percentPhys / 100;
    }

    // Attack speed
    const attackSpeedDelta = contributions['percent_attack_speed']?.value || 0;
    if (attackSpeedDelta !== 0) {
      dpsMultiplier *= 1 + attackSpeedDelta / 100;
    }

    // Crit
    const critChanceDelta = contributions['percent_crit_chance']?.value || 0;
    const critMultiDelta = contributions['percent_crit_multi']?.value || 0;
    if (critChanceDelta !== 0 || critMultiDelta !== 0) {
      const baseCritEffect = (build.stats.critChance / 100) * (build.stats.critMultiplier / 100 - 1);
      const newCritChance = build.stats.critChance + critChanceDelta;
      const newCritMulti = build.stats.critMultiplier + critMultiDelta;
      const newCritEffect = (newCritChance / 100) * (newCritMulti / 100 - 1);
      const critDelta = newCritEffect - baseCritEffect;
      dpsMultiplier *= 1 + critDelta;
    }

    const absoluteChange = currentDps * (dpsMultiplier - 1);
    const percentageChange = (dpsMultiplier - 1) * 100;

    return {
      absolute: Math.round(absoluteChange * 100) / 100,
      percentage: Math.round(percentageChange * 100) / 100,
    };
  }

  /**
   * Estimate the EHP (Effective Hit Points) change from stat contributions.
   */
  private estimateEhpChange(
    contributions: Record<StatId, StatContribution>,
    build: CharacterBuild
  ): { absolute: number; percentage: number } {
    const currentEhp = this.calculateEhp(build);
    let ehpDelta = 0;

    // Flat life
    const flatLife = contributions['flat_life']?.value || 0;
    ehpDelta += flatLife;

    // Percent life (approximate)
    const percentLife = contributions['percent_life']?.value || 0;
    if (percentLife !== 0) {
      ehpDelta += build.stats.life * (percentLife / 100);
    }

    // Energy shield
    const flatEs = contributions['flat_es']?.value || 0;
    ehpDelta += flatEs;

    // Armour contribution to EHP (diminishing returns model)
    const flatArmour = contributions['flat_armour']?.value || 0;
    if (flatArmour !== 0) {
      // Armour formula: damage reduction = armour / (armour + 5 * damage)
      // Rough EHP contribution at average hit of 1000
      const avgHit = 1000;
      const currentReduction = build.stats.armour / (build.stats.armour + 5 * avgHit);
      const newReduction = (build.stats.armour + flatArmour) / ((build.stats.armour + flatArmour) + 5 * avgHit);
      ehpDelta += build.stats.life * (newReduction - currentReduction);
    }

    // Evasion contribution
    const flatEvasion = contributions['flat_evasion']?.value || 0;
    if (flatEvasion !== 0) {
      // Rough evasion -> EHP: each 100 evasion ≈ 1% more effective life
      ehpDelta += build.stats.life * (flatEvasion / 10000);
    }

    const percentageChange = currentEhp > 0 ? (ehpDelta / currentEhp) * 100 : 0;

    return {
      absolute: Math.round(ehpDelta * 100) / 100,
      percentage: Math.round(percentageChange * 100) / 100,
    };
  }

  private calculateEhp(build: CharacterBuild): number {
    // Simplified EHP: Life + ES, modified by armour/evasion
    const basePool = build.stats.life + build.stats.energyShield;
    const avgHit = 1000;
    const armourReduction = build.stats.armour / (build.stats.armour + 5 * avgHit);
    return basePool / (1 - armourReduction);
  }

  private calculateDefensiveWeight(build: CharacterBuild, type: string): number {
    switch (type) {
      case 'life':
        // Life is always valuable, more so at lower levels
        return build.stats.life < 3000 ? 8 : build.stats.life < 5000 ? 5 : 3;
      case 'es':
        // ES is most valuable for ES-based builds
        return build.stats.energyShield > build.stats.life ? 7 : 2;
      case 'armour':
        return build.stats.armour > 5000 ? 1 : 3;
      case 'evasion':
        return build.stats.evasion > 5000 ? 1 : 3;
      default:
        return 1;
    }
  }

  private calculateOffensiveWeight(build: CharacterBuild, type: string): number {
    const dps = build.stats.totalDps || 1;

    switch (type) {
      case 'flat_phys':
        // Flat phys is more valuable at low gear levels
        return dps < 50000 ? 6 : dps < 200000 ? 4 : 2;
      case 'percent_phys':
        return 4;
      case 'attack_speed':
        return 5;
      case 'crit_chance':
        return build.stats.critChance < 50 ? 4 : 2;
      case 'crit_multi':
        return build.stats.critChance > 30 ? 5 : 1; // Crit multi only matters with decent crit chance
      default:
        return 1;
    }
  }

  /**
   * Identify which equipment slots have the biggest upgrade potential.
   * Empty slots and slots with low-tier items get priority.
   */
  private identifyPrioritySlots(build: CharacterBuild): ItemSlot[] {
    const allSlots: ItemSlot[] = [
      'helm', 'body', 'gloves', 'boots', 'belt',
      'amulet', 'ring1', 'ring2', 'weapon1', 'offhand1',
    ];

    const slotScores: Array<{ slot: ItemSlot; score: number }> = [];

    for (const slot of allSlots) {
      const equipped = build.equipped.find(e => e.slot === slot);

      if (!equipped || !equipped.item) {
        // Empty slot = highest priority
        slotScores.push({ slot, score: 100 });
        continue;
      }

      // Score based on rarity (lower rarity = more room for upgrade)
      const rarityScore: Record<string, number> = {
        'Normal': 80, 'Magic': 60, 'Rare': 20, 'Unique': 10,
      };
      const score = rarityScore[equipped.item.rarity] || 30;
      slotScores.push({ slot, score });
    }

    slotScores.sort((a, b) => b.score - a.score);
    return slotScores.filter(s => s.score >= 20).map(s => s.slot);
  }

  private getAttributeRequirement(build: CharacterBuild, attr: 'str' | 'dex' | 'int'): number {
    // Find the highest attribute requirement across equipped items
    let maxReq = 0;
    for (const equipped of build.equipped) {
      if (equipped.item?.requirements) {
        const req = equipped.item.requirements[attr] || 0;
        maxReq = Math.max(maxReq, req);
      }
    }
    return maxReq;
  }

  private checkRequirements(item: PoE2Item, build: CharacterBuild): string[] {
    const unmet: string[] = [];

    if (item.requirements.level && build.level < item.requirements.level) {
      unmet.push(`Level ${item.requirements.level} required (you are ${build.level})`);
    }
    if (item.requirements.str && build.stats.str < item.requirements.str) {
      unmet.push(`${item.requirements.str} Strength required (you have ${build.stats.str})`);
    }
    if (item.requirements.dex && build.stats.dex < item.requirements.dex) {
      unmet.push(`${item.requirements.dex} Dexterity required (you have ${build.stats.dex})`);
    }
    if (item.requirements.int && build.stats.int < item.requirements.int) {
      unmet.push(`${item.requirements.int} Intelligence required (you have ${build.stats.int})`);
    }

    return unmet;
  }

  private inferSlot(item: PoE2Item): ItemSlot | null {
    // Infer the equipment slot from the item category/baseType
    const baseType = item.baseType.toLowerCase();

    if (item.category === 'weapon') return 'weapon1';
    if (baseType.includes('helmet') || baseType.includes('crown') || baseType.includes('mask') || baseType.includes('hood')) return 'helm';
    if (baseType.includes('body') || baseType.includes('vest') || baseType.includes('robe') || baseType.includes('plate')) return 'body';
    if (baseType.includes('glove') || baseType.includes('gauntlet') || baseType.includes('mitt')) return 'gloves';
    if (baseType.includes('boot') || baseType.includes('greave') || baseType.includes('slipper')) return 'boots';
    if (baseType.includes('belt') || baseType.includes('sash') || baseType.includes('stygian')) return 'belt';
    if (baseType.includes('amulet') || baseType.includes('talisman')) return 'amulet';
    if (baseType.includes('ring') || baseType.includes('circle')) return 'ring1';
    if (baseType.includes('shield') || baseType.includes('buckler') || baseType.includes('quiver')) return 'offhand1';

    return null;
  }
}
