import OpenAI from 'openai';
import {
  PoE2Item,
  BuildProfile,
  AIAnalysis,
  AITier,
  AppConfig,
} from '../../models/types';

/**
 * AIAdvisor: Uses an LLM to evaluate complex rare items with synergies
 * that simple stat math might miss.
 *
 * Example insight: "This item has no life, but the damage scaling for
 * your specific Monk build makes it a Tier 1 upgrade."
 *
 * Only invoked for rare items with 4+ mods or mixed offense/defense profiles.
 */
export class AIAdvisor {
  private client: OpenAI;
  private model: string;

  constructor(config: AppConfig) {
    this.client = new OpenAI({
      apiKey: config.llmApiKey,
      baseURL: config.llmBaseUrl,
    });
    this.model = config.llmModel;
  }

  /**
   * Analyze a complex item for synergies the stat engine might miss.
   */
  async analyzeItem(item: PoE2Item, profile: BuildProfile): Promise<AIAnalysis> {
    const prompt = this.buildPrompt(item, profile);

    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          {
            role: 'system',
            content: this.getSystemPrompt(),
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 500,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        return this.fallbackAnalysis();
      }

      return this.parseResponse(content);
    } catch (error) {
      // LLM failures should not break the pipeline — return a neutral analysis
      console.error('AI Advisor error:', error);
      return this.fallbackAnalysis();
    }
  }

  private getSystemPrompt(): string {
    return `You are an expert Path of Exile 2 item evaluator. You analyze rare items for complex synergies that simple stat-weight math might miss.

Your job is to evaluate whether an item is a good fit for a specific character build, considering:
1. Mod interactions and scaling synergies
2. Build-specific value (e.g., a Monk build benefits differently from stats than a Witch)
3. Hidden value in mods that don't directly map to DPS/EHP (e.g., mana sustain, movement speed)
4. Whether the item fills a niche the build is missing

IMPORTANT PoE2 CONTEXT:
- Sockets are on GEMS, not on gear. Do NOT evaluate socket count on items.
- Gold is a primary currency alongside traditional orbs.
- Consider the new PoE2 ascendancy classes and their unique scaling mechanics.

Respond with a JSON object:
{
  "tier": "S" | "A" | "B" | "C" | "D" | "F",
  "reasoning": "1-2 sentence explanation",
  "synergies": ["list of identified synergies"],
  "warnings": ["list of any concerns"]
}

Tier guide:
- S: Build-defining, must-buy item
- A: Significant upgrade with strong synergies
- B: Solid upgrade, good value
- C: Marginal upgrade, some value
- D: Not worth buying
- F: Actively bad for this build`;
  }

  private buildPrompt(item: PoE2Item, profile: BuildProfile): string {
    const build = profile.build;

    const modLines = [
      ...item.mods.implicit.map(m => `[Implicit] ${m.text}`),
      ...item.mods.explicit.map(m => `[Explicit] ${m.text}`),
      ...item.mods.enchant.map(m => `[Enchant] ${m.text}`),
    ];

    const unmetReqs = build.requirements
      .filter(r => r.current < r.target)
      .map(r => r.label);

    return `Evaluate this item for my build:

**Item:** ${item.name || item.baseType}
**Base Type:** ${item.baseType}
**Item Level:** ${item.itemLevel}
**Rarity:** ${item.rarity}
**Category:** ${item.category}
**Listing Price:** ${item.listingPrice?.amount} ${item.listingPrice?.currency}

**Mods:**
${modLines.join('\n')}

**My Build:**
- Class: ${build.class}${build.ascendancy ? ` (${build.ascendancy})` : ''}
- Level: ${build.level}
- Main Skill: ${build.mainSkill || 'Unknown'}
- Total DPS: ${build.stats.totalDps.toLocaleString()}
- Life: ${build.stats.life} | ES: ${build.stats.energyShield}
- Resistances: Fire ${build.stats.fireRes}% | Cold ${build.stats.coldRes}% | Lightning ${build.stats.lightningRes}% | Chaos ${build.stats.chaosRes}%
- Attributes: STR ${build.stats.str} | DEX ${build.stats.dex} | INT ${build.stats.int}

**Unmet Requirements:**
${unmetReqs.length > 0 ? unmetReqs.join('\n') : 'None'}

**Priority Upgrade Slots:** ${profile.prioritySlots.join(', ') || 'None identified'}

Consider build-specific synergies, scaling interactions, and any hidden value this item may have.`;
  }

  private parseResponse(content: string): AIAnalysis {
    try {
      const parsed = JSON.parse(content);

      const validTiers: AITier[] = ['S', 'A', 'B', 'C', 'D', 'F'];
      const tier: AITier = validTiers.includes(parsed.tier) ? parsed.tier : 'C';

      return {
        tier,
        reasoning: parsed.reasoning || 'No reasoning provided.',
        synergies: Array.isArray(parsed.synergies) ? parsed.synergies : [],
        warnings: Array.isArray(parsed.warnings) ? parsed.warnings : [],
      };
    } catch {
      return this.fallbackAnalysis();
    }
  }

  private fallbackAnalysis(): AIAnalysis {
    return {
      tier: 'C',
      reasoning: 'AI analysis unavailable — defaulting to neutral rating.',
      synergies: [],
      warnings: ['AI analysis could not be completed'],
    };
  }
}
