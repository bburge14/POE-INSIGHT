import { XMLParser } from 'fast-xml-parser';
import * as pako from 'pako';
import {
  CharacterBuild,
  BuildRequirement,
  EquippedItem,
  ItemSlot,
  StatId,
} from '../../models/types';

/**
 * BuildParser: Parses Path of Building (PoB) export strings and XML
 * to extract character builds, stats, and equipped items.
 *
 * PoB export strings are Base64-encoded, zlib-compressed XML.
 */
export class BuildParser {
  private xmlParser: XMLParser;

  constructor() {
    this.xmlParser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      parseAttributeValue: true,
    });
  }

  /**
   * Parse a PoB export code (Base64 + zlib compressed XML).
   */
  parsePoBCode(pobCode: string): CharacterBuild {
    const xml = this.decodePoBString(pobCode);
    return this.parseXml(xml, pobCode);
  }

  /**
   * Parse raw PoB XML directly.
   */
  parseXml(xml: string, pobCode?: string): CharacterBuild {
    const parsed = this.xmlParser.parse(xml);
    const pathOfBuilding = parsed.PathOfBuilding;

    if (!pathOfBuilding) {
      throw new Error('Invalid PoB XML: missing PathOfBuilding root element');
    }

    const build = this.extractBuildInfo(pathOfBuilding);
    const stats = this.extractStats(pathOfBuilding);
    const equipped = this.extractEquippedItems(pathOfBuilding);
    const requirements = this.calculateRequirements(stats);

    return {
      ...build,
      stats,
      equipped,
      requirements,
      mainSkill: this.extractMainSkill(pathOfBuilding),
      pobCode,
    };
  }

  /**
   * Decode a PoB export string: Base64 -> inflate -> XML string.
   */
  private decodePoBString(pobCode: string): string {
    // PoB uses URL-safe base64 — convert to standard base64
    const standardBase64 = pobCode
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const binaryString = Buffer.from(standardBase64, 'base64');
    const inflated = pako.inflate(binaryString);
    return new TextDecoder().decode(inflated);
  }

  private extractBuildInfo(pob: Record<string, unknown>): Pick<CharacterBuild, 'name' | 'class' | 'ascendancy' | 'level' | 'league'> {
    const build = pob.Build as Record<string, unknown> | undefined;

    return {
      name: (build?.['@_className'] as string) || 'Unknown',
      class: (build?.['@_className'] as string) || 'Unknown',
      ascendancy: (build?.['@_ascendClassName'] as string) || undefined,
      level: (build?.['@_level'] as number) || 1,
      league: (build?.['@_league'] as string) || 'Standard',
    };
  }

  private extractStats(pob: Record<string, unknown>): CharacterBuild['stats'] {
    // PoB stores computed stats in a PlayerStat or minion stat block
    const statMap = this.buildStatMap(pob);

    return {
      life: statMap['Life'] || 0,
      energyShield: statMap['EnergyShield'] || 0,
      mana: statMap['Mana'] || 0,
      evasion: statMap['Evasion'] || 0,
      armour: statMap['Armour'] || 0,
      blockChance: statMap['BlockChance'] || 0,

      fireRes: statMap['FireResist'] || 0,
      coldRes: statMap['ColdResist'] || 0,
      lightningRes: statMap['LightningResist'] || 0,
      chaosRes: statMap['ChaosResist'] || 0,

      str: statMap['Str'] || 0,
      dex: statMap['Dex'] || 0,
      int: statMap['Int'] || 0,

      totalDps: statMap['TotalDPS'] || statMap['CombinedDPS'] || 0,
      attackSpeed: statMap['Speed'] || 0,
      critChance: statMap['CritChance'] || 0,
      critMultiplier: statMap['CritMultiplier'] || 0,
      accuracy: statMap['Accuracy'] || 0,
    };
  }

  private buildStatMap(pob: Record<string, unknown>): Record<string, number> {
    const statMap: Record<string, number> = {};

    // Navigate PoB's stat storage (varies by version)
    const build = pob.Build as Record<string, unknown> | undefined;
    if (!build) return statMap;

    const playerStats = build.PlayerStat;
    if (Array.isArray(playerStats)) {
      for (const stat of playerStats) {
        const s = stat as Record<string, unknown>;
        if (s['@_stat'] && s['@_value'] !== undefined) {
          statMap[s['@_stat'] as string] = Number(s['@_value']);
        }
      }
    } else if (playerStats && typeof playerStats === 'object') {
      const s = playerStats as Record<string, unknown>;
      if (s['@_stat'] && s['@_value'] !== undefined) {
        statMap[s['@_stat'] as string] = Number(s['@_value']);
      }
    }

    return statMap;
  }

  private extractEquippedItems(pob: Record<string, unknown>): EquippedItem[] {
    const items = pob.Items as Record<string, unknown> | undefined;
    const equipped: EquippedItem[] = [];

    if (!items) return equipped;

    const itemList = items.Item;
    const itemArray = Array.isArray(itemList) ? itemList : itemList ? [itemList] : [];

    for (const item of itemArray) {
      const raw = item as Record<string, unknown>;
      const slotName = raw['@_slot'] as string | undefined;

      if (!slotName) continue;

      const slot = this.mapSlotName(slotName);
      if (!slot) continue;

      const statContributions = this.parseItemStats(raw);

      equipped.push({
        slot,
        item: undefined, // Full PoE2Item is resolved later if needed
        statContributions,
      });
    }

    return equipped;
  }

  private parseItemStats(raw: Record<string, unknown>): Record<StatId, number> {
    const stats: Record<StatId, number> = {};
    const content = raw['#text'] as string | undefined;

    if (!content) return stats;

    // Parse mod lines from the PoB item text block
    const lines = content.split('\n').map(l => l.trim()).filter(Boolean);

    for (const line of lines) {
      const parsed = this.parseModLine(line);
      if (parsed) {
        stats[parsed.statId] = (stats[parsed.statId] || 0) + parsed.value;
      }
    }

    return stats;
  }

  /**
   * Parse a single mod line into a stat ID and value.
   * Examples:
   *   "+50 to maximum Life" -> { statId: "flat_life", value: 50 }
   *   "+40% to Fire Resistance" -> { statId: "percent_fire_res", value: 40 }
   *   "Adds 10 to 20 Physical Damage" -> { statId: "added_phys_min", value: 10 }
   */
  private parseModLine(line: string): { statId: string; value: number } | null {
    const patterns: Array<{ regex: RegExp; statId: string; group?: number }> = [
      // Life
      { regex: /\+(\d+) to maximum Life/, statId: 'flat_life' },
      { regex: /(\d+)% increased maximum Life/, statId: 'percent_life' },

      // Energy Shield
      { regex: /\+(\d+) to maximum Energy Shield/, statId: 'flat_es' },
      { regex: /(\d+)% increased maximum Energy Shield/, statId: 'percent_es' },

      // Resistances
      { regex: /\+(\d+)% to (?:all )?Fire Resistance/, statId: 'percent_fire_res' },
      { regex: /\+(\d+)% to (?:all )?Cold Resistance/, statId: 'percent_cold_res' },
      { regex: /\+(\d+)% to (?:all )?Lightning Resistance/, statId: 'percent_lightning_res' },
      { regex: /\+(\d+)% to (?:all )?Chaos Resistance/, statId: 'percent_chaos_res' },
      { regex: /\+(\d+)% to all Elemental Resistances/, statId: 'percent_all_ele_res' },

      // Attributes
      { regex: /\+(\d+) to Strength/, statId: 'flat_str' },
      { regex: /\+(\d+) to Dexterity/, statId: 'flat_dex' },
      { regex: /\+(\d+) to Intelligence/, statId: 'flat_int' },
      { regex: /\+(\d+) to all Attributes/, statId: 'flat_all_attr' },

      // Damage
      { regex: /Adds (\d+) to \d+ Physical Damage/, statId: 'added_phys_min' },
      { regex: /Adds \d+ to (\d+) Physical Damage/, statId: 'added_phys_max' },
      { regex: /(\d+)% increased Physical Damage/, statId: 'percent_phys' },
      { regex: /(\d+)% increased Attack Speed/, statId: 'percent_attack_speed' },
      { regex: /(\d+)% increased Critical Strike Chance/, statId: 'percent_crit_chance' },
      { regex: /\+(\d+)% to Critical Strike Multiplier/, statId: 'percent_crit_multi' },

      // Defenses
      { regex: /\+(\d+) to Armour/, statId: 'flat_armour' },
      { regex: /(\d+)% increased Armour/, statId: 'percent_armour' },
      { regex: /\+(\d+) to Evasion Rating/, statId: 'flat_evasion' },
      { regex: /(\d+)% increased Evasion Rating/, statId: 'percent_evasion' },
    ];

    for (const { regex, statId } of patterns) {
      const match = line.match(regex);
      if (match) {
        return { statId, value: parseInt(match[1], 10) };
      }
    }

    return null;
  }

  private mapSlotName(pobSlot: string): ItemSlot | null {
    const mapping: Record<string, ItemSlot> = {
      'Helmet': 'helm',
      'Body Armour': 'body',
      'Gloves': 'gloves',
      'Boots': 'boots',
      'Belt': 'belt',
      'Amulet': 'amulet',
      'Ring 1': 'ring1',
      'Ring 2': 'ring2',
      'Weapon 1': 'weapon1',
      'Weapon 2': 'weapon2',
      'Weapon 1 Swap': 'offhand1',
      'Weapon 2 Swap': 'offhand2',
      'Flask 1': 'flask1',
      'Flask 2': 'flask2',
      'Flask 3': 'flask3',
      'Flask 4': 'flask4',
      'Flask 5': 'flask5',
    };
    return mapping[pobSlot] || null;
  }

  private extractMainSkill(pob: Record<string, unknown>): string | undefined {
    const skills = pob.Skills as Record<string, unknown> | undefined;
    if (!skills) return undefined;

    const skillList = skills.Skill;
    const skillArray = Array.isArray(skillList) ? skillList : skillList ? [skillList] : [];

    // Find the main skill (mainActiveSkill flag or first active skill)
    for (const skill of skillArray) {
      const s = skill as Record<string, unknown>;
      if (s['@_mainActiveSkill'] || s['@_enabled'] !== false) {
        const label = s['@_label'] as string | undefined;
        if (label) return label;

        // Fall back to first gem name
        const gems = s.Gem;
        const gemArray = Array.isArray(gems) ? gems : gems ? [gems] : [];
        if (gemArray.length > 0) {
          return (gemArray[0] as Record<string, unknown>)['@_nameSpec'] as string | undefined;
        }
      }
    }

    return undefined;
  }

  /**
   * Calculate build requirements — resistances to cap, attribute minimums, etc.
   */
  private calculateRequirements(stats: CharacterBuild['stats']): BuildRequirement[] {
    const requirements: BuildRequirement[] = [];

    const RES_CAP = 75;

    // Elemental resistance caps
    if (stats.fireRes < RES_CAP) {
      requirements.push({
        type: 'resistance_cap',
        statId: 'percent_fire_res',
        target: RES_CAP,
        current: stats.fireRes,
        label: `Fire Resistance: ${stats.fireRes}% / ${RES_CAP}%`,
      });
    }

    if (stats.coldRes < RES_CAP) {
      requirements.push({
        type: 'resistance_cap',
        statId: 'percent_cold_res',
        target: RES_CAP,
        current: stats.coldRes,
        label: `Cold Resistance: ${stats.coldRes}% / ${RES_CAP}%`,
      });
    }

    if (stats.lightningRes < RES_CAP) {
      requirements.push({
        type: 'resistance_cap',
        statId: 'percent_lightning_res',
        target: RES_CAP,
        current: stats.lightningRes,
        label: `Lightning Resistance: ${stats.lightningRes}% / ${RES_CAP}%`,
      });
    }

    // Chaos resistance has a different soft cap
    const CHAOS_RES_TARGET = 0;
    if (stats.chaosRes < CHAOS_RES_TARGET) {
      requirements.push({
        type: 'resistance_cap',
        statId: 'percent_chaos_res',
        target: CHAOS_RES_TARGET,
        current: stats.chaosRes,
        label: `Chaos Resistance: ${stats.chaosRes}% / ${CHAOS_RES_TARGET}%`,
      });
    }

    return requirements;
  }
}
